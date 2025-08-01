#!/bin/bash
# Frontend Startup Script - Shell Version
# Implements safety-critical startup sequence for nginx-based frontend

set -euo pipefail  # Exit on error, undefined variables, pipe failures

# Enable debug mode if DEBUG environment variable is set
[[ "${DEBUG:-false}" == "true" ]] && set -x

# Constants
readonly SCRIPT_NAME="$(basename "$0")"
readonly LOG_DIR="/var/log/nginx"
readonly HTML_DIR="/usr/share/nginx/html"
readonly PID_FILE="/var/run/nginx.pid"
readonly STARTUP_TIMEOUT=180  # 3 minutes
readonly BACKEND_CHECK_RETRIES=20
readonly BACKEND_CHECK_INTERVAL=3
readonly SHUTDOWN_GRACE_PERIOD=25
readonly CORRELATION_ID="$(date +%s | md5sum | cut -c1-8)"

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Circuit breaker state
CIRCUIT_BREAKER_FAILURES=0
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_STATE="closed"
CIRCUIT_BREAKER_LAST_FAILURE=0
CIRCUIT_BREAKER_RECOVERY_TIME=60

# Logging functions with correlation ID
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$1] [${CORRELATION_ID}] ${2}" | tee -a "${LOG_DIR}/startup.log"
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

log_debug() {
    [[ "${DEBUG:-false}" == "true" ]] && log "DEBUG" "${BLUE}$1${NC}"
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
    log_info "Received SIGHUP signal, reloading nginx configuration..."
    reload_nginx
}

# Error handler
error_handler() {
    local line_number=$1
    local error_code=$2
    log_error "Error occurred in ${SCRIPT_NAME} at line ${line_number}, exit code: ${error_code}"
    cleanup_on_failure
    exit "${error_code}"
}

# Setup handlers
setup_handlers() {
    trap 'trap_sigterm' SIGTERM
    trap 'trap_sigint' SIGINT
    trap 'trap_sighup' SIGHUP
    trap 'error_handler ${LINENO} $?' ERR
}

# Circuit breaker check
circuit_breaker_check() {
    local current_time=$(date +%s)
    
    if [[ "${CIRCUIT_BREAKER_STATE}" == "open" ]]; then
        local time_since_failure=$((current_time - CIRCUIT_BREAKER_LAST_FAILURE))
        
        if [[ ${time_since_failure} -gt ${CIRCUIT_BREAKER_RECOVERY_TIME} ]]; then
            log_info "Circuit breaker transitioning to half-open state"
            CIRCUIT_BREAKER_STATE="half-open"
        else
            log_error "Circuit breaker is open, refusing connection attempt"
            return 1
        fi
    fi
    
    return 0
}

# Circuit breaker record failure
circuit_breaker_failure() {
    CIRCUIT_BREAKER_FAILURES=$((CIRCUIT_BREAKER_FAILURES + 1))
    CIRCUIT_BREAKER_LAST_FAILURE=$(date +%s)
    
    if [[ ${CIRCUIT_BREAKER_FAILURES} -ge ${CIRCUIT_BREAKER_THRESHOLD} ]]; then
        log_error "Circuit breaker opened after ${CIRCUIT_BREAKER_FAILURES} failures"
        CIRCUIT_BREAKER_STATE="open"
    fi
}

# Circuit breaker success
circuit_breaker_success() {
    if [[ "${CIRCUIT_BREAKER_STATE}" == "half-open" ]]; then
        log_info "Circuit breaker closed - service recovered"
        CIRCUIT_BREAKER_STATE="closed"
        CIRCUIT_BREAKER_FAILURES=0
    fi
}

# Validate environment variables
validate_environment() {
    log_info "Validating environment variables..."
    
    local required_vars=("REACT_APP_API_URL" "REACT_APP_WS_URL")
    local optional_vars=("REACT_APP_ENVIRONMENT" "REACT_APP_SENTRY_DSN" "REACT_APP_FEATURE_FLAGS")
    local validation_failed=false
    
    # Check required variables
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_error "Required environment variable ${var} is not set"
            validation_failed=true
        else
            # Validate URL format
            if [[ "${var}" =~ _URL$ ]]; then
                local url_value="${!var}"
                if [[ ! "${url_value}" =~ ^https?:// ]] && [[ ! "${url_value}" =~ ^wss?:// ]]; then
                    log_error "${var} has invalid URL format: ${url_value}"
                    validation_failed=true
                fi
            fi
        fi
    done
    
    # Validate WebSocket URL protocol
    if [[ -n "${REACT_APP_WS_URL:-}" ]]; then
        if [[ ! "${REACT_APP_WS_URL}" =~ ^wss?:// ]]; then
            log_error "WebSocket URL must use ws:// or wss:// protocol: ${REACT_APP_WS_URL}"
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

# Validate frontend assets
validate_assets() {
    log_info "Validating frontend assets..."
    
    local critical_assets=(
        "${HTML_DIR}/index.html"
        "${HTML_DIR}/static/js"
        "${HTML_DIR}/static/css"
    )
    
    local missing_assets=()
    
    for asset in "${critical_assets[@]}"; do
        if [[ ! -e "${asset}" ]]; then
            missing_assets+=("${asset}")
        fi
    done
    
    if [[ ${#missing_assets[@]} -gt 0 ]]; then
        log_error "Missing critical assets: ${missing_assets[*]}"
        return 1
    fi
    
    # Check index.html integrity
    if ! grep -q '<div id="root">' "${HTML_DIR}/index.html"; then
        log_error "index.html missing React root element"
        return 1
    fi
    
    # Check asset permissions
    if ! find "${HTML_DIR}" -type f -readable | head -1 >/dev/null; then
        log_error "Frontend assets are not readable"
        return 1
    fi
    
    log_success "Frontend assets validated successfully"
    return 0
}

# Test nginx configuration
validate_nginx_config() {
    log_info "Validating nginx configuration..."
    
    if ! timeout 30 nginx -t 2>&1; then
        log_error "Nginx configuration test failed"
        return 1
    fi
    
    log_success "Nginx configuration is valid"
    return 0
}

# Check backend health
check_backend_health() {
    log_info "Checking backend health at ${REACT_APP_API_URL}..."
    
    if [[ -z "${REACT_APP_API_URL:-}" ]]; then
        log_warn "No backend URL configured, skipping health check"
        return 0
    fi
    
    local health_endpoints=("/api/health" "/api/v1/status")
    local attempt=0
    local backend_healthy=false
    
    while [[ ${attempt} -lt ${BACKEND_CHECK_RETRIES} ]]; do
        attempt=$((attempt + 1))
        
        # Check circuit breaker
        if ! circuit_breaker_check; then
            break
        fi
        
        for endpoint in "${health_endpoints[@]}"; do
            local url="${REACT_APP_API_URL}${endpoint}"
            log_debug "Checking endpoint: ${url}"
            
            local start_time=$(date +%s%N)
            local response_code=$(curl -s -o /dev/null -w "%{http_code}" \
                --max-time 10 \
                -H "User-Agent: Frontend-Startup-HealthCheck/1.0" \
                -H "X-Correlation-ID: ${CORRELATION_ID}" \
                "${url}" 2>/dev/null || echo "000")
            local end_time=$(date +%s%N)
            local response_time=$(( (end_time - start_time) / 1000000 ))
            
            if [[ "${response_code}" == "200" ]]; then
                log_info "Backend endpoint ${endpoint} is healthy (${response_time}ms)"
                backend_healthy=true
                circuit_breaker_success
                break 2
            elif [[ "${response_code}" == "000" ]]; then
                log_warn "Backend endpoint ${endpoint} is unreachable"
                circuit_breaker_failure
            else
                log_warn "Backend endpoint ${endpoint} returned ${response_code}"
            fi
        done
        
        if [[ ${attempt} -lt ${BACKEND_CHECK_RETRIES} ]]; then
            # Exponential backoff with jitter
            local wait_time=$((BACKEND_CHECK_INTERVAL * (attempt / 2 + 1)))
            wait_time=$((wait_time > 30 ? 30 : wait_time))
            local jitter=$((RANDOM % 1000))
            log_info "Retrying in ${wait_time}.${jitter} seconds (attempt ${attempt}/${BACKEND_CHECK_RETRIES})..."
            sleep "${wait_time}.${jitter}"
        fi
    done
    
    if [[ "${backend_healthy}" != "true" ]]; then
        log_error "Backend health check failed after ${BACKEND_CHECK_RETRIES} attempts"
        return 1
    fi
    
    log_success "Backend is healthy"
    return 0
}

# Check WebSocket connectivity
check_websocket() {
    log_info "Checking WebSocket connectivity..."
    
    if [[ -z "${REACT_APP_WS_URL:-}" ]]; then
        log_warn "No WebSocket URL configured"
        return 0
    fi
    
    # Convert ws:// to http:// for basic connectivity check
    local test_url="${REACT_APP_WS_URL//ws:/http:}"
    test_url="${test_url//wss:/https:}"
    
    if curl -s -o /dev/null --max-time 10 "${test_url}" 2>/dev/null; then
        log_info "WebSocket endpoint is reachable"
        return 0
    else
        log_warn "WebSocket endpoint check failed (non-critical)"
        return 0  # Non-critical, so return success
    fi
}

# Start nginx
start_nginx() {
    log_info "Starting nginx..."
    
    # Ensure log directory exists
    mkdir -p "${LOG_DIR}"
    
    # Start nginx in foreground
    nginx -g 'daemon off;' &
    local nginx_pid=$!
    
    # Write PID file
    echo ${nginx_pid} > "${PID_FILE}"
    
    # Give nginx time to start
    sleep 2
    
    # Check if nginx started successfully
    if ! kill -0 ${nginx_pid} 2>/dev/null; then
        log_error "Nginx failed to start"
        return 1
    fi
    
    log_success "Nginx started successfully (PID: ${nginx_pid})"
    
    # Store PID globally
    NGINX_PID=${nginx_pid}
    return 0
}

# Reload nginx configuration
reload_nginx() {
    log_info "Reloading nginx configuration..."
    
    if [[ ! -f "${PID_FILE}" ]]; then
        log_error "No nginx PID file found"
        return 1
    fi
    
    local nginx_pid=$(cat "${PID_FILE}")
    
    # Test configuration first
    if ! nginx -t; then
        log_error "Configuration test failed, not reloading"
        return 1
    fi
    
    # Send SIGHUP to reload
    if kill -HUP "${nginx_pid}" 2>/dev/null; then
        log_success "Nginx configuration reloaded"
        return 0
    else
        log_error "Failed to reload nginx configuration"
        return 1
    fi
}

# Graceful shutdown
graceful_shutdown() {
    local shutdown_start=$(date +%s)
    
    log_info "Starting graceful shutdown sequence..."
    
    # Block new connections (nginx handles this with SIGQUIT)
    log_info "Sending graceful shutdown signal to nginx..."
    
    if [[ -f "${PID_FILE}" ]]; then
        local nginx_pid=$(cat "${PID_FILE}")
        
        # Send SIGQUIT for graceful shutdown
        if kill -QUIT "${nginx_pid}" 2>/dev/null; then
            log_info "Sent SIGQUIT to nginx (PID: ${nginx_pid})"
            
            # Wait for nginx to shut down
            local elapsed=0
            while [[ ${elapsed} -lt ${SHUTDOWN_GRACE_PERIOD} ]]; do
                if ! kill -0 "${nginx_pid}" 2>/dev/null; then
                    log_success "Nginx shut down gracefully"
                    break
                fi
                
                elapsed=$(($(date +%s) - shutdown_start))
                log_info "Waiting for nginx to shut down (${elapsed}/${SHUTDOWN_GRACE_PERIOD}s)..."
                sleep 1
            done
            
            # Force kill if still running
            if kill -0 "${nginx_pid}" 2>/dev/null; then
                log_warn "Nginx did not shut down gracefully, forcing termination"
                kill -KILL "${nginx_pid}" 2>/dev/null
            fi
        fi
    fi
    
    # Write shutdown state
    write_shutdown_state
    
    # Cleanup
    cleanup_resources
    
    local total_elapsed=$(($(date +%s) - shutdown_start))
    log_success "Shutdown sequence completed in ${total_elapsed} seconds"
    
    exit 0
}

# Write startup success
write_startup_success() {
    local success_file="${LOG_DIR}/startup_success.json"
    cat > "${success_file}" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "correlation_id": "${CORRELATION_ID}",
  "pid": $$,
  "backend_url": "${REACT_APP_API_URL:-}",
  "ws_url": "${REACT_APP_WS_URL:-}"
}
EOF
    log_info "Startup success marker written to ${success_file}"
}

# Write shutdown state
write_shutdown_state() {
    local state_file="${LOG_DIR}/shutdown_state.json"
    cat > "${state_file}" <<EOF
{
  "shutdown_time": "$(date -Iseconds)",
  "correlation_id": "${CORRELATION_ID}",
  "uptime_seconds": $(($(date +%s) - ${STARTUP_TIME:-0})),
  "graceful": true
}
EOF
    log_info "Shutdown state written to ${state_file}"
}

# Cleanup on failure
cleanup_on_failure() {
    log_error "Startup failed, performing cleanup..."
    
    # Write failure marker
    local failure_file="${LOG_DIR}/startup_failure.json"
    cat > "${failure_file}" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "correlation_id": "${CORRELATION_ID}",
  "exit_code": ${?}
}
EOF
    
    # Kill nginx if started
    if [[ -n "${NGINX_PID:-}" ]]; then
        kill -TERM "${NGINX_PID}" 2>/dev/null || true
    fi
    
    # Remove PID file
    rm -f "${PID_FILE}"
}

# Cleanup resources
cleanup_resources() {
    log_info "Cleaning up resources..."
    
    # Remove PID files
    rm -f "${PID_FILE}" /var/run/frontend.pid
    
    # Clean temporary files
    find /tmp -name "nginx-*" -type f -mtime +1 -delete 2>/dev/null || true
    
    log_info "Resource cleanup completed"
}

# Health check endpoint (for Docker)
health_check() {
    if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
        # Check if nginx is responding
        curl -f http://localhost:80/ >/dev/null 2>&1 || exit 1
        exit 0
    else
        exit 1
    fi
}

# Main startup sequence
main() {
    local STARTUP_TIME=$(date +%s)
    
    log_info "============================================================"
    log_info "Frontend Startup Sequence Initiated"
    log_info "Process ID: $$"
    log_info "Correlation ID: ${CORRELATION_ID}"
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
    
    # Stage 2: Asset validation
    log_info "Stage 2: Asset Validation"
    if ! validate_assets; then
        log_error "Asset validation failed"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 3: Nginx configuration test
    log_info "Stage 3: Nginx Configuration Test"
    if ! validate_nginx_config; then
        log_error "Nginx configuration invalid"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 4: Backend health check
    log_info "Stage 4: Backend Health Check"
    if ! check_backend_health; then
        log_error "Backend health check failed"
        cleanup_on_failure
        exit 1
    fi
    
    # Stage 5: WebSocket check
    log_info "Stage 5: WebSocket Connectivity Check"
    check_websocket  # Non-critical, so we don't exit on failure
    
    # Stage 6: Start nginx
    log_info "Stage 6: Starting Nginx"
    if ! start_nginx; then
        log_error "Failed to start nginx"
        cleanup_on_failure
        exit 1
    fi
    
    # Calculate startup time
    local elapsed=$(($(date +%s) - STARTUP_TIME))
    log_success "Startup completed successfully in ${elapsed} seconds"
    
    # Write success marker
    write_startup_success
    
    # Keep script running and wait for signals
    log_info "Frontend service is running..."
    wait ${NGINX_PID}
}

# Handle command line arguments
case "${1:-}" in
    health)
        health_check
        ;;
    *)
        main "$@"
        ;;
esac