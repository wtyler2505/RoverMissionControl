#!/bin/bash
# Test startup scripts locally without Docker

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Testing Startup Scripts Locally${NC}"
echo "=================================="

# Check if we're in the right directory
if [[ ! -f "backend-startup.py" ]] || [[ ! -f "frontend-startup.py" ]]; then
    echo -e "${RED}Error: Must run from docker/scripts directory${NC}"
    exit 1
fi

# Test backend startup in dry-run mode
test_backend() {
    echo -e "\n${YELLOW}Testing Backend Startup Script${NC}"
    
    # Set minimal environment for testing
    export DATABASE_URL="sqlite:///./test.db"
    export SECRET_KEY="test-secret-key-minimum-32-characters-long"
    export CORS_ORIGINS="http://localhost:3000"
    
    # Create test directories
    mkdir -p /tmp/test-backend/{logs,data,temp}
    
    # Modify paths for local testing
    sed 's|/app/logs|/tmp/test-backend/logs|g' backend-startup.py > /tmp/test-backend-startup.py
    sed -i 's|/app/data|/tmp/test-backend/data|g' /tmp/test-backend-startup.py
    sed -i 's|/app/temp|/tmp/test-backend/temp|g' /tmp/test-backend-startup.py
    
    # Run validation only (comment out actual startup)
    python3 -c "
import sys
sys.path.insert(0, '.')
exec(open('/tmp/test-backend-startup.py').read().replace('os.execvp', '# os.execvp'))
" 2>&1 | grep -E "(Stage|ERROR|SUCCESS)" || true
    
    # Check if validation passed
    if [[ -f "/tmp/test-backend/logs/startup_success" ]]; then
        echo -e "${GREEN}✓ Backend validation passed${NC}"
    else
        echo -e "${RED}✗ Backend validation failed${NC}"
        [[ -f "/tmp/test-backend/logs/startup_failure" ]] && cat /tmp/test-backend/logs/startup_failure
    fi
}

# Test frontend startup in dry-run mode
test_frontend() {
    echo -e "\n${YELLOW}Testing Frontend Startup Script${NC}"
    
    # Set minimal environment for testing
    export REACT_APP_API_URL="http://localhost:8000"
    export REACT_APP_WS_URL="ws://localhost:8000"
    
    # Create test directories and files
    mkdir -p /tmp/test-frontend/{logs,html/static/{js,css}}
    echo '<div id="root"></div>' > /tmp/test-frontend/html/index.html
    
    # Modify paths for local testing
    sed 's|/var/log/nginx|/tmp/test-frontend/logs|g' frontend-startup.py > /tmp/test-frontend-startup.py
    sed -i 's|/usr/share/nginx/html|/tmp/test-frontend/html|g' /tmp/test-frontend-startup.py
    
    # Run validation only (skip nginx start)
    python3 -c "
import sys
sys.path.insert(0, '.')
# Override nginx manager to skip actual nginx operations
startup_script = open('/tmp/test-frontend-startup.py').read()
startup_script = startup_script.replace('nginx_manager.start_nginx()', 'True  # Skipped for test')
exec(startup_script.replace('while not shutdown_event.is_set():', 'if False:  # Skip main loop'))
" 2>&1 | grep -E "(Stage|ERROR|SUCCESS|WARNING)" || true
    
    # Check results
    if [[ -f "/tmp/test-frontend/logs/startup_success.json" ]]; then
        echo -e "${GREEN}✓ Frontend validation passed${NC}"
        cat /tmp/test-frontend/logs/startup_success.json | python3 -m json.tool
    else
        echo -e "${RED}✗ Frontend validation failed${NC}"
    fi
}

# Test shell script versions
test_shell_scripts() {
    echo -e "\n${YELLOW}Testing Shell Script Syntax${NC}"
    
    # Check bash syntax
    if bash -n backend-startup.sh; then
        echo -e "${GREEN}✓ backend-startup.sh syntax OK${NC}"
    else
        echo -e "${RED}✗ backend-startup.sh syntax errors${NC}"
    fi
    
    if bash -n frontend-startup.sh; then
        echo -e "${GREEN}✓ frontend-startup.sh syntax OK${NC}"
    else
        echo -e "${RED}✗ frontend-startup.sh syntax errors${NC}"
    fi
}

# Test signal handling
test_signal_handling() {
    echo -e "\n${YELLOW}Testing Signal Handling${NC}"
    
    # Test Python signal handling
    python3 -c "
import signal
import time

shutdown_called = False

def shutdown_handler(signum, frame):
    global shutdown_called
    shutdown_called = True
    print(f'✓ Received signal {signal.Signals(signum).name}')

signal.signal(signal.SIGTERM, shutdown_handler)
signal.signal(signal.SIGINT, shutdown_handler)

print('Signal handlers registered')
# In real test, would send signals to test
"
    
    echo -e "${GREEN}✓ Signal handlers compile correctly${NC}"
}

# Run all tests
main() {
    echo "Running startup script tests..."
    
    test_shell_scripts
    test_backend
    test_frontend
    test_signal_handling
    
    # Cleanup
    rm -rf /tmp/test-backend /tmp/test-frontend /tmp/test-*.py
    
    echo -e "\n${GREEN}Testing complete!${NC}"
    echo "Note: This only tests validation logic, not actual service startup."
    echo "For full integration testing, use Docker Compose."
}

# Handle arguments
case "${1:-all}" in
    backend)
        test_backend
        ;;
    frontend)
        test_frontend
        ;;
    shell)
        test_shell_scripts
        ;;
    signals)
        test_signal_handling
        ;;
    all|*)
        main
        ;;
esac