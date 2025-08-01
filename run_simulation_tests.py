#!/usr/bin/env python3
"""
Comprehensive test runner for the Rover Mission Control simulation system.
Runs all backend, frontend, and end-to-end tests with coverage reporting.
"""

import os
import sys
import subprocess
import json
import time
from pathlib import Path
from typing import Dict, List, Tuple

# Colors for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(message: str):
    """Print a formatted header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{message.center(80)}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 80}{Colors.ENDC}\n")

def print_section(message: str):
    """Print a formatted section header."""
    print(f"\n{Colors.OKBLUE}{Colors.BOLD}{message}{Colors.ENDC}")
    print(f"{Colors.OKBLUE}{'-' * len(message)}{Colors.ENDC}")

def print_success(message: str):
    """Print a success message."""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_error(message: str):
    """Print an error message."""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

def print_warning(message: str):
    """Print a warning message."""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def run_command(command: List[str], cwd: str = None) -> Tuple[int, str, str]:
    """Run a command and return exit code, stdout, and stderr."""
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        text=True
    )
    stdout, stderr = process.communicate()
    return process.returncode, stdout, stderr

def check_dependencies():
    """Check if all required dependencies are installed."""
    print_section("Checking Dependencies")
    
    dependencies = {
        "Python": ["python", "--version"],
        "Node.js": ["node", "--version"],
        "npm": ["npm", "--version"],
        "pytest": ["pytest", "--version"],
        "Jest": ["npx", "jest", "--version"],
        "Playwright": ["npx", "playwright", "--version"]
    }
    
    all_ok = True
    for name, command in dependencies.items():
        try:
            returncode, stdout, stderr = run_command(command)
            if returncode == 0:
                version = stdout.strip() or stderr.strip()
                print_success(f"{name}: {version}")
            else:
                print_error(f"{name}: Not found or error")
                all_ok = False
        except FileNotFoundError:
            print_error(f"{name}: Not found")
            all_ok = False
    
    return all_ok

def setup_test_environment():
    """Setup test environment variables and configurations."""
    print_section("Setting up Test Environment")
    
    # Set environment variables
    os.environ["TESTING"] = "true"
    os.environ["DATABASE_URL"] = "sqlite:///test_rover_platform.db"
    os.environ["JWT_SECRET_KEY"] = "test-secret-key"
    os.environ["BACKEND_URL"] = "http://localhost:8000"
    os.environ["FRONTEND_URL"] = "http://localhost:3000"
    
    print_success("Environment variables set")
    
    # Create test directories if needed
    test_dirs = ["backend/tests", "frontend/src/__tests__", "e2e", "coverage"]
    for dir_path in test_dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
    
    print_success("Test directories created")

def run_backend_tests() -> bool:
    """Run backend Python tests with pytest."""
    print_header("Running Backend Tests")
    
    # Run pytest with coverage
    command = [
        "pytest",
        "backend/tests/test_simulation_system.py",
        "backend/tests/test_simulation_websocket.py",
        "-v",
        "--cov=backend",
        "--cov-report=html:coverage/backend",
        "--cov-report=term-missing",
        "--asyncio-mode=auto"
    ]
    
    print(f"Running: {' '.join(command)}")
    returncode, stdout, stderr = run_command(command)
    
    print(stdout)
    if stderr:
        print(stderr)
    
    if returncode == 0:
        print_success("Backend tests passed!")
        return True
    else:
        print_error("Backend tests failed!")
        return False

def run_frontend_tests() -> bool:
    """Run frontend React tests with Jest."""
    print_header("Running Frontend Tests")
    
    # Change to frontend directory
    os.chdir("frontend")
    
    # Run Jest tests
    command = [
        "npm",
        "test",
        "--",
        "--coverage",
        "--watchAll=false",
        "--coverageDirectory=../coverage/frontend"
    ]
    
    print(f"Running: {' '.join(command)}")
    returncode, stdout, stderr = run_command(command)
    
    print(stdout)
    if stderr:
        print(stderr)
    
    # Change back to root
    os.chdir("..")
    
    if returncode == 0:
        print_success("Frontend tests passed!")
        return True
    else:
        print_error("Frontend tests failed!")
        return False

def run_e2e_tests() -> bool:
    """Run end-to-end tests with Playwright."""
    print_header("Running End-to-End Tests")
    
    # Install Playwright browsers if needed
    print("Ensuring Playwright browsers are installed...")
    run_command(["npx", "playwright", "install"])
    
    # Start backend and frontend servers
    print_section("Starting Test Servers")
    
    # Start backend
    backend_process = subprocess.Popen(
        ["python", "backend/server.py"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    print_success("Backend server started (PID: {})".format(backend_process.pid))
    
    # Start frontend
    frontend_process = subprocess.Popen(
        ["npm", "start"],
        cwd="frontend",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    print_success("Frontend server started (PID: {})".format(frontend_process.pid))
    
    # Wait for servers to be ready
    print("Waiting for servers to be ready...")
    time.sleep(10)
    
    # Run Playwright tests
    command = [
        "npx",
        "playwright",
        "test",
        "e2e/simulation-system.e2e.test.ts",
        "--reporter=html:coverage/e2e"
    ]
    
    print(f"Running: {' '.join(command)}")
    returncode, stdout, stderr = run_command(command)
    
    print(stdout)
    if stderr:
        print(stderr)
    
    # Stop servers
    print_section("Stopping Test Servers")
    backend_process.terminate()
    frontend_process.terminate()
    print_success("Test servers stopped")
    
    if returncode == 0:
        print_success("E2E tests passed!")
        return True
    else:
        print_error("E2E tests failed!")
        return False

def generate_test_report():
    """Generate a comprehensive test report."""
    print_header("Generating Test Report")
    
    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "backend": "UNKNOWN",
            "frontend": "UNKNOWN",
            "e2e": "UNKNOWN",
            "overall": "UNKNOWN"
        },
        "coverage": {
            "backend": "N/A",
            "frontend": "N/A"
        }
    }
    
    # Check for coverage reports
    if Path("coverage/backend/index.html").exists():
        print_success("Backend coverage report available at: coverage/backend/index.html")
        report["coverage"]["backend"] = "Available"
    
    if Path("coverage/frontend/lcov-report/index.html").exists():
        print_success("Frontend coverage report available at: coverage/frontend/lcov-report/index.html")
        report["coverage"]["frontend"] = "Available"
    
    if Path("coverage/e2e/index.html").exists():
        print_success("E2E test report available at: coverage/e2e/index.html")
    
    # Save report
    with open("test-report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print_success("Test report saved to: test-report.json")

def main():
    """Main test runner function."""
    print_header("Rover Mission Control - Simulation System Test Suite")
    
    # Check dependencies
    if not check_dependencies():
        print_error("Missing dependencies. Please install all required tools.")
        sys.exit(1)
    
    # Setup environment
    setup_test_environment()
    
    # Track results
    results = {
        "backend": False,
        "frontend": False,
        "e2e": False
    }
    
    # Run tests based on arguments
    if len(sys.argv) > 1:
        test_type = sys.argv[1].lower()
        if test_type == "backend":
            results["backend"] = run_backend_tests()
        elif test_type == "frontend":
            results["frontend"] = run_frontend_tests()
        elif test_type == "e2e":
            results["e2e"] = run_e2e_tests()
        else:
            print_error(f"Unknown test type: {test_type}")
            print("Usage: python run_simulation_tests.py [backend|frontend|e2e|all]")
            sys.exit(1)
    else:
        # Run all tests
        results["backend"] = run_backend_tests()
        results["frontend"] = run_frontend_tests()
        results["e2e"] = run_e2e_tests()
    
    # Generate report
    generate_test_report()
    
    # Print summary
    print_header("Test Summary")
    
    all_passed = True
    for test_type, passed in results.items():
        if passed:
            print_success(f"{test_type.upper()} tests: PASSED")
        else:
            print_error(f"{test_type.upper()} tests: FAILED")
            all_passed = False
    
    print()
    if all_passed:
        print_success("All tests passed! 🎉")
        sys.exit(0)
    else:
        print_error("Some tests failed. Please check the logs above.")
        sys.exit(1)

if __name__ == "__main__":
    main()