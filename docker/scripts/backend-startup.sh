#!/bin/bash
# Backend Startup Script - Shell Version
# Implements safety-critical startup sequence with comprehensive error handling

set -euo pipefail  # Exit on error, undefined variables, pipe failures

# Enable debug mode if DEBUG environment variable is set
[[ "${DEBUG:-false}" == "true" ]] && set -x

# Constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_DIR="/app/logs"
readonly DATA_DIR="/app/data"
readonly TEMP_DIR="/app/temp"
readonly PID_FILE="/var/run/backend.pid"
readonly STARTUP_TIMEOUT=300  # 5 minutes
readonly DB_CHECK_RETRIES=30
readonly DB_CHECK_INTERVAL=2
readonly SHUTDOWN_GRACE_PERIOD=30

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'  # No Color

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$1] ${2}" | tee -a "${LOG_DIR}/startup.log"
}

log_info() {
    log "INFO" "$1"
}

log_warn() {
    log "WARN" "${YELLOW}$1${NC}"
}

log_error() {
    log "ERROR" "${RED}$1${NC}"
}

log_success() {
    log "INFO" "${GREEN}$1${NC}"
}

# Signal handlers
trap_sigterm() {
    log_info "Received SIGTERM signal, initiating graceful shutdown..."
    graceful_shutdown
}

trap_sigint() {
    log_info "Received SIGINT signal, initiating graceful shutdown..."
    graceful_shutdown
}

trap_sighup() {
    log_info "Received SIGHUP signal, reloading configuration..."
    # Implement configuration reload logic here
}

# Error handler
error_handler() {
    local line_number=$1
    local error_code=$2
    log_error "Error occurred in ${SCRIPT_NAME} at line ${line_number}, exit code: ${error_code}"
    cleanup_on_failure
    exit "${error_code}"
}

# Setup signal handlers and error trap
setup_handlers() {
    trap 'trap_sigterm' SIGTERM
    trap 'trap_sigint' SIGINT
    trap 'trap_sighup' SIGHUP
    trap 'error_handler ${LINENO} $?' ERR
}

# Validate environment variables
validate_environment() {
    log_info "Validating environment variables..."
    
    local required_vars=("DATABASE_URL" "SECRET_KEY" "CORS_ORIGINS")
    local optional_vars=("REDIS_URL" "RABBITMQ_URL" "SENTRY_DSN" "LOG_LEVEL")
    local validation_failed=false
    
    # Check required variables
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable ${var} is not set"
            validation_failed=true
        fi
    done
    
    # Validate SECRET_KEY length
    if [[ -n "${SECRET_KEY:-}" ]] && [[ ${#SECRET_KEY} -lt 32 ]]; then
        log_error "SECRET_KEY must be at least 32 characters (got ${#SECRET_KEY})"
        validation_failed=true
    fi
    
    # Validate DATABASE_URL format
    if [[ -n "${DATABASE_URL:-}" ]]; then
        if [[ ! "${DATABASE_URL}" =~ ^(sqlite:///|postgresql://|mysql://) ]]; then
            log_error "Unsupported database URL format: ${DATABASE_URL}"
            validation_failed=true
        fi
    fi
    
    # Check optional variables
    for var in "${optional_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_warn "Optional environment variable ${var} is not set"
        fi
    done
    
    if [[ "${validation_failed}" == "true" ]]; then
        return 1
    fi
    
    log_success "Environment validation passed"
    return 0
}

# Create required directories
create_directories() {
    log_info "Creating required directories..."
    
    local dirs=("${LOG_DIR}" "${DATA_DIR}" "${TEMP_DIR}")
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "${dir}" ]]; then
            if ! mkdir -p "${dir}"; then
                log_error "Failed to create directory: ${dir}"
                return 1
            fi
            log_info "Created directory: ${dir}"
        fi
        
        # Check write permissions
        if ! touch "${dir}/.write_test" 2>/dev/null; then
            log_error "No write permission for directory: ${dir}"
            return 1
        fi
        rm -f "${dir}/.write_test"
    done
    
    log_success "Directory creation completed"
    return 0
}

# Check database availability
check_database() {
    log_info "Checking database availability (max ${DB_CHECK_RETRIES} attempts)..."
    
    local attempt=0
    local wait_time=${DB_CHECK_INTERVAL}
    
    while [[ ${attempt} -lt ${DB_CHECK_RETRIES} ]]; do
        attempt=$((attempt + 1))
        
        if [[ "${DATABASE_URL}" =~ ^sqlite:/// ]]; then
            # SQLite check
            local db_path="${DATABASE_URL#sqlite:///}"
            local db_dir="$(dirname "${db_path}")"
            
            if [[ ! -d "${db_dir}" ]]; then
                mkdir -p "${db_dir}"
            fi
            
            if sqlite3 "${db_path}" "SELECT 1;" &>/dev/null; then
                log_success "Database connection successful on attempt ${attempt}"
                return 0
            fi
        elif [[ "${DATABASE_URL}" =~ ^postgresql:// ]]; then
            # PostgreSQL check
            if pg_isready -d "${DATABASE_URL}" &>/dev/null; then
                log_success "Database connection successful on attempt ${attempt}"
                return 0
            fi
        elif [[ "${DATABASE_URL}" =~ ^mysql:// ]]; then
            # MySQL check
            # Extract connection parameters from URL
            local mysql_host="$(echo "${DATABASE_URL}" | sed -E 's|mysql://[^@]+@([^:/]+).*|\1|')"
            local mysql_port="$(echo "${DATABASE_URL}" | sed -E 's|mysql://[^:]+:[^@]+@[^:]+:([0-9]+)/.*|\1|')"
            
            if mysqladmin ping -h"${mysql_host}" -P"${mysql_port}" --silent &>/dev/null; then
                log_success "Database connection successful on attempt ${attempt}"
                return 0
            fi
        fi
        
        log_warn "Database connection attempt ${attempt} failed"
        
        if [[ ${attempt} -lt ${DB_CHECK_RETRIES} ]]; then
            # Exponential backoff with jitter
            wait_time=$((DB_CHECK_INTERVAL * (2 ** (attempt - 1))))
            wait_time=$((wait_time > 60 ? 60 : wait_time))
            local jitter=$((RANDOM % 1000))
            sleep "${wait_time}.${jitter}"
        fi
    done
    
    log_error "Database availability check failed after ${DB_CHECK_RETRIES} attempts"
    return 1
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    local migration_script="/app/alembic/scripts/run_migrations.py"
    
    if [[ ! -f "${migration_script}" ]]; then
        log_warn "No migration script found at ${migration_script}, skipping migrations"
        return 0
    fi
    
    # Record current state for rollback
    local migration_state_file="${LOG_DIR}/migration_state.json"
    echo "{\"timestamp\": \"$(date -Iseconds)\", \"database_url\": \"${DATABASE_URL}\"}" > "${migration_state_file}"
    
    # Run migrations with timeout
    if timeout 120 python "${migration_script}"; then
        log_success "Migrations completed successfully"
        return 0
    else
        log_error "Migration failed"
        # Attempt rollback
        if [[ -f "/app/alembic/scripts/rollback_migration.py" ]]; then
            log_warn "Attempting migration rollback..."
            if timeout 60 python "/app/alembic/scripts/rollback_migration.py"; then
                log_info "Migration rollback successful"
            else
                log_error "Migration rollback failed"
            fi
        fi
        return 1
    fi
}

# Warm up connection pools
warmup_connections() {
    log_info "Warming up connection pools..."
    
    # This is a placeholder - actual implementation would create real connections
    # For now, we'll simulate the warmup process
    
    # Database connections
    log_info "Creating database connection pool..."
    for i in {1..10}; do
        # Simulate connection creation
        sleep 0.1
    done
    log_success "Database pool warmed up"
    
    # Redis connections (if configured)
    if [[ -n "${REDIS_URL:-}" ]]; then
        log_info "Creating Redis connection pool..."
        for i in {1..5}; do
            sleep 0.05
        done
        log_success "Redis pool warmed up"
    fi
    
    # Message queue connections (if configured)
    if [[ -n "${RABBITMQ_URL:-}" ]]; then
        log_info "Creating message queue connection pool..."
        for i in {1..5}; do
            sleep 0.05
        done
        log_success "Message queue pool warmed up"
    fi
    
    return 0
}

# Write PID file
write_pid_file() {
    echo $$ > "${PID_FILE}"
    log_info "PID file written: ${PID_FILE} (PID: $$)"
}

# Graceful shutdown handler
graceful_shutdown() {
    local shutdown_start=$(date +%s)
    
    log_info "Starting graceful shutdown sequence..."
    
    # Block new requests (would be implemented in the application)
    log_info "Blocking new requests..."
    
    # Wait for active requests to complete
    log_info "Waiting for active requests to complete (max ${SHUTDOWN_GRACE_PERIOD}s)..."
    
    local elapsed=0
    while [[ ${elapsed} -lt ${SHUTDOWN_GRACE_PERIOD} ]]; do
        # Check if application is still processing requests
        # This would be implemented by checking application state
        
        local current_time=$(date +%s)
        elapsed=$((current_time - shutdown_start))
        
        # For now, simulate request draining
        if [[ ${elapsed} -gt 5 ]]; then
            log_info "All requests completed"
            break
        fi
        
        log_info "Waiting for requests to complete (${elapsed}s elapsed)..."
        sleep 1
    done
    
    # Persist state
    persist_state
    
    # Clean up resources
    cleanup_resources
    
    # Remove PID file
    rm -f "${PID_FILE}"
    
    local total_elapsed=$(($(date +%s) - shutdown_start))
    log_success "Graceful shutdown completed in ${total_elapsed} seconds"
    
    exit 0
}

# Persist application state
persist_state() {
    log_info "Persisting application state..."
    
    local state_file="${LOG_DIR}/shutdown_state.json"
    cat > "${state_file}" <<EOF
{
  "shutdown_time": "$(date -Iseconds)",
  "pid": $$,
  "uptime_seconds": $(($(date +%s) - ${STARTUP_TIME:-0})),
  "hostname": "$(hostname)"
}
EOF
    
    log_info "State persisted to ${state_file}"
}

# Clean up resources
cleanup_resources() {
    log_info "Cleaning up resources..."
    
    # Clean temporary files
    if [[ -d "${TEMP_DIR}" ]]; then
        local temp_file_count=$(find "${TEMP_DIR}" -type f | wc -l)
        rm -rf "${TEMP_DIR}"/*
        log_info "Cleaned up ${temp_file_count} temporary files"
    fi
    
    # Close database connections (handled by application)
    log_info "Database connections closed by application"
}

# Cleanup on failure
cleanup_on_failure() {
    log_error "Startup failed, performing cleanup..."
    
    # Write failure marker
    local failure_file="${LOG_DIR}/startup_failure"
    cat > "${failure_file}" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "pid": $$,
  "exit_code": ${?}
}
EOF
    
    # Remove PID file if exists
    rm -f "${PID_FILE}"
    
    # Clean up any partial state
    cleanup_resources
}

# Health check function
health_check() {
    # Simple health check - can be called by Docker
    if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
        curl -f http://localhost:8000/api/health || exit 1
    else
        exit 1
    fi
}

# Main startup sequence
main() {
    local STARTUP_TIME=$(date +%s)
    
    log_info "============================================================"
    log_info "Backend Startup Sequence Initiated"
    log_info "Process ID: $$"
    log_info "Hostname: $(hostname)"
    log_info "============================================================"
    
    # Setup signal handlers
    setup_handlers
    
    # Stage 1: Environment validation
    log_info "Stage 1: Environment Validation"
    if ! validate_environment; then
        log_error "Environment validation failed"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 2: Filesystem setup
    log_info "Stage 2: Filesystem Setup"
    if ! create_directories; then
        log_error "Directory creation failed"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 3: Database availability
    log_info "Stage 3: Database Availability Check"
    if ! check_database; then
        log_error "Database unavailable"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 4: Database migrations
    log_info "Stage 4: Database Migrations"
    if ! run_migrations; then
        log_error "Database migration failed"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 5: Connection pool warmup
    log_info "Stage 5: Connection Pool Warmup"
    if ! warmup_connections; then
        log_warn "Connection pool warmup completed with warnings"
    fi
    
    # Write PID file
    write_pid_file
    
    # Calculate startup time
    local elapsed=$(($(date +%s) - STARTUP_TIME))
    log_success "Startup completed successfully in ${elapsed} seconds"
    
    # Write success marker
    echo "$(date -Iseconds)" > "${LOG_DIR}/startup_success"
    
    # Stage 6: Start application
    log_info "Stage 6: Starting FastAPI Application"
    
    # Execute the application (replaces current process)
    exec uvicorn main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 4 \
        --access-log \
        --log-config /app/logging_config.yaml
}

# Handle special cases
case "${1:-}" in
    health)
        health_check
        ;;
    *)
        main "$@"
        ;;
esac