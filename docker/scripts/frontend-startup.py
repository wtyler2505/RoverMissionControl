#!/usr/bin/env python3
"""
Frontend Startup Script with Safety-Critical Features

This script implements a fail-safe startup sequence for the frontend service:
- Environment configuration validation
- Backend connectivity health checks with circuit breaker
- Nginx configuration validation and testing
- Graceful nginx shutdown with connection draining
- Proper signal handling for container orchestration

Safety Design Principles:
- Fail-safe: Service refuses to start if backend is unreachable
- Health verification: Multiple stages of health checking
- Graceful degradation: Can start in limited mode if non-critical services fail
- Audit trail: All operations logged with correlation IDs
"""

import os
import sys
import signal
import time
import logging
import subprocess
import json
import requests
import threading
import hashlib
import socket
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(correlation_id)s] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('/var/log/nginx/startup.log', mode='a')
    ]
)
logger = logging.getLogger('frontend-startup')

# Safety-critical configuration
CONFIG = {
    'startup_timeout': 180,  # 3 minutes maximum startup time
    'backend_check_retries': 20,  # Number of backend connection attempts
    'backend_check_interval': 3,  # Seconds between attempts
    'health_check_timeout': 10,  # Timeout for individual health checks
    'nginx_config_test_timeout': 30,  # Nginx config test timeout
    'shutdown_grace_period': 25,  # Seconds for graceful shutdown
    'connection_drain_timeout': 20,  # Time to drain existing connections
    'required_env_vars': [
        'REACT_APP_API_URL',
        'REACT_APP_WS_URL'
    ],
    'optional_env_vars': [
        'REACT_APP_ENVIRONMENT',
        'REACT_APP_SENTRY_DSN',
        'REACT_APP_FEATURE_FLAGS'
    ],
    'backend_endpoints': [
        '/api/health',
        '/api/v1/status'
    ],
    'critical_assets': [
        '/usr/share/nginx/html/index.html',
        '/usr/share/nginx/html/static/js',
        '/usr/share/nginx/html/static/css'
    ]
}

# Global state
shutdown_event = threading.Event()
startup_complete = False
correlation_id = hashlib.md5(f"{os.getpid()}-{time.time()}".encode()).hexdigest()[:8]

# Add correlation ID to logger
logging.LoggerAdapter(logger, {'correlation_id': correlation_id})


class StartupError(Exception):
    """Raised when startup validation fails"""
    pass


class CircuitBreaker:
    """Circuit breaker pattern for backend connectivity"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
        self.lock = threading.Lock()
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        with self.lock:
            if self.state == 'open':
                if time.time() - self.last_failure_time > self.recovery_timeout:
                    self.state = 'half-open'
                    logger.info(f"Circuit breaker transitioning to half-open state")
                else:
                    raise Exception("Circuit breaker is open")
            
            try:
                result = func(*args, **kwargs)
                if self.state == 'half-open':
                    self.state = 'closed'
                    self.failure_count = 0
                    logger.info("Circuit breaker closed - service recovered")
                return result
                
            except Exception as e:
                self.failure_count += 1
                self.last_failure_time = time.time()
                
                if self.failure_count >= self.failure_threshold:
                    self.state = 'open'
                    logger.error(f"Circuit breaker opened after {self.failure_count} failures")
                
                raise e


class EnvironmentValidator:
    """Validates frontend environment configuration"""
    
    def __init__(self):
        self.validation_results: Dict[str, bool] = {}
        self.validation_errors: List[str] = []
        self.warnings: List[str] = []
    
    def validate_all(self) -> bool:
        """Run all validation checks"""
        logger.info("Starting environment validation...")
        
        checks = [
            self.validate_env_vars,
            self.validate_urls,
            self.validate_assets,
            self.validate_nginx_config,
            self.validate_permissions
        ]
        
        all_passed = True
        for check in checks:
            if not check():
                all_passed = False
        
        return all_passed
    
    def validate_env_vars(self) -> bool:
        """Validate required environment variables"""
        logger.info("Validating environment variables...")
        
        # Check required variables
        for var in CONFIG['required_env_vars']:
            value = os.environ.get(var)
            if not value:
                error = f"Required environment variable {var} is not set"
                self.validation_errors.append(error)
                logger.error(error)
                return False
            
            # Validate URL format
            if var.endswith('_URL'):
                try:
                    parsed = urlparse(value)
                    if not parsed.scheme or not parsed.netloc:
                        error = f"{var} has invalid URL format: {value}"
                        self.validation_errors.append(error)
                        logger.error(error)
                        return False
                except Exception as e:
                    error = f"{var} URL parsing failed: {e}"
                    self.validation_errors.append(error)
                    logger.error(error)
                    return False
        
        # Check optional variables
        for var in CONFIG['optional_env_vars']:
            if not os.environ.get(var):
                self.warnings.append(f"Optional variable {var} not set")
                logger.warning(f"Optional environment variable {var} is not set")
        
        logger.info("Environment variables validated successfully")
        return True
    
    def validate_urls(self) -> bool:
        """Validate and normalize URLs"""
        logger.info("Validating URL configuration...")
        
        api_url = os.environ.get('REACT_APP_API_URL', '')
        ws_url = os.environ.get('REACT_APP_WS_URL', '')
        
        # Ensure WebSocket URL uses correct protocol
        if ws_url and not ws_url.startswith(('ws://', 'wss://')):
            error = f"WebSocket URL must use ws:// or wss:// protocol: {ws_url}"
            self.validation_errors.append(error)
            logger.error(error)
            return False
        
        # Check if URLs point to resolvable hosts
        for url_str in [api_url, ws_url]:
            if url_str:
                try:
                    parsed = urlparse(url_str)
                    # Skip DNS resolution for Docker service names
                    if not parsed.hostname or parsed.hostname in ['backend', 'localhost']:
                        continue
                        
                    socket.gethostbyname(parsed.hostname)
                except socket.gaierror:
                    self.warnings.append(f"Cannot resolve hostname: {parsed.hostname}")
                    logger.warning(f"Cannot resolve hostname: {parsed.hostname}")
        
        logger.info("URL configuration validated")
        return True
    
    def validate_assets(self) -> bool:
        """Validate critical frontend assets exist"""
        logger.info("Validating frontend assets...")
        
        missing_assets = []
        for asset_path in CONFIG['critical_assets']:
            if not os.path.exists(asset_path):
                missing_assets.append(asset_path)
        
        if missing_assets:
            error = f"Missing critical assets: {missing_assets}"
            self.validation_errors.append(error)
            logger.error(error)
            return False
        
        # Check asset integrity (simplified - could use checksums)
        index_path = '/usr/share/nginx/html/index.html'
        try:
            with open(index_path, 'r') as f:
                content = f.read()
                if '<div id="root">' not in content:
                    error = "index.html missing React root element"
                    self.validation_errors.append(error)
                    logger.error(error)
                    return False
        except Exception as e:
            error = f"Failed to validate index.html: {e}"
            self.validation_errors.append(error)
            logger.error(error)
            return False
        
        logger.info("Frontend assets validated successfully")
        return True
    
    def validate_nginx_config(self) -> bool:
        """Test nginx configuration"""
        logger.info("Validating nginx configuration...")
        
        try:
            result = subprocess.run(
                ['nginx', '-t'],
                capture_output=True,
                timeout=CONFIG['nginx_config_test_timeout']
            )
            
            if result.returncode != 0:
                error = f"Nginx config test failed: {result.stderr.decode()}"
                self.validation_errors.append(error)
                logger.error(error)
                return False
            
            logger.info("Nginx configuration is valid")
            return True
            
        except subprocess.TimeoutExpired:
            error = "Nginx config test timeout"
            self.validation_errors.append(error)
            logger.error(error)
            return False
        except Exception as e:
            error = f"Nginx config test error: {e}"
            self.validation_errors.append(error)
            logger.error(error)
            return False
    
    def validate_permissions(self) -> bool:
        """Validate file permissions for nginx user"""
        logger.info("Validating file permissions...")
        
        nginx_user = 'nginx'  # or 'www-data' depending on distro
        html_dir = '/usr/share/nginx/html'
        
        # Check if nginx user can read files
        try:
            result = subprocess.run(
                ['su', '-s', '/bin/sh', nginx_user, '-c', f'ls {html_dir}'],
                capture_output=True,
                timeout=10
            )
            
            if result.returncode != 0:
                self.warnings.append(f"Nginx user may have permission issues: {result.stderr.decode()}")
                logger.warning("Potential nginx permission issues detected")
        except Exception as e:
            self.warnings.append(f"Could not verify nginx permissions: {e}")
            logger.warning(f"Could not verify nginx permissions: {e}")
        
        return True  # Non-critical, so we return True


class BackendHealthChecker:
    """Checks backend service health with circuit breaker"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.circuit_breaker = CircuitBreaker()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Frontend-Startup-HealthCheck/1.0',
            'X-Correlation-ID': correlation_id
        })
    
    def check_health(self, retries: int = 20, interval: int = 3) -> Tuple[bool, Dict]:
        """Check backend health with retries"""
        logger.info(f"Checking backend health at {self.base_url}...")
        
        health_status = {
            'available': False,
            'endpoints': {},
            'response_times': [],
            'errors': []
        }
        
        for attempt in range(retries):
            try:
                # Try each health endpoint
                for endpoint in CONFIG['backend_endpoints']:
                    start_time = time.time()
                    
                    response = self.circuit_breaker.call(
                        self._make_request,
                        endpoint
                    )
                    
                    response_time = time.time() - start_time
                    health_status['response_times'].append(response_time)
                    
                    if response.status_code == 200:
                        health_status['endpoints'][endpoint] = 'healthy'
                        health_status['available'] = True
                        
                        # Parse health response
                        try:
                            data = response.json()
                            if 'status' in data and data['status'] != 'healthy':
                                logger.warning(f"Backend reports status: {data['status']}")
                        except:
                            pass
                    else:
                        health_status['endpoints'][endpoint] = f"unhealthy ({response.status_code})"
                
                if health_status['available']:
                    avg_response_time = sum(health_status['response_times']) / len(health_status['response_times'])
                    logger.info(f"Backend is healthy (avg response time: {avg_response_time:.3f}s)")
                    return True, health_status
                    
            except Exception as e:
                error_msg = f"Health check attempt {attempt + 1} failed: {e}"
                health_status['errors'].append(error_msg)
                logger.warning(error_msg)
            
            if attempt < retries - 1:
                # Exponential backoff with jitter
                sleep_time = min(interval * (1.5 ** attempt) + (time.time() % 1), 30)
                logger.info(f"Retrying in {sleep_time:.1f} seconds...")
                time.sleep(sleep_time)
        
        logger.error("Backend health check failed after all retries")
        return False, health_status
    
    def _make_request(self, endpoint: str) -> requests.Response:
        """Make HTTP request to backend"""
        url = f"{self.base_url}{endpoint}"
        return self.session.get(url, timeout=CONFIG['health_check_timeout'])
    
    def check_websocket(self) -> bool:
        """Check WebSocket connectivity"""
        ws_url = os.environ.get('REACT_APP_WS_URL', '')
        if not ws_url:
            logger.warning("No WebSocket URL configured")
            return True  # Non-critical
        
        logger.info(f"Checking WebSocket connectivity at {ws_url}...")
        
        # Simple WebSocket check using curl
        try:
            # Convert ws:// to http:// for curl test
            test_url = ws_url.replace('ws://', 'http://').replace('wss://', 'https://')
            result = subprocess.run(
                ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', test_url],
                capture_output=True,
                timeout=10
            )
            
            # Even a 404 means the server is reachable
            if result.returncode == 0:
                logger.info("WebSocket endpoint is reachable")
                return True
            else:
                logger.warning(f"WebSocket endpoint check failed: {result.stderr.decode()}")
                return False
                
        except Exception as e:
            logger.warning(f"WebSocket check error: {e}")
            return False


class NginxManager:
    """Manages nginx lifecycle with safety features"""
    
    def __init__(self):
        self.nginx_pid = None
        self.startup_time = None
    
    def start_nginx(self) -> bool:
        """Start nginx with monitoring"""
        logger.info("Starting nginx...")
        
        try:
            # Start nginx in foreground mode
            process = subprocess.Popen(
                ['nginx', '-g', 'daemon off;'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Give nginx time to start
            time.sleep(2)
            
            # Check if nginx started successfully
            if process.poll() is not None:
                stderr = process.stderr.read().decode()
                logger.error(f"Nginx failed to start: {stderr}")
                return False
            
            self.nginx_pid = process.pid
            self.startup_time = time.time()
            logger.info(f"Nginx started successfully (PID: {self.nginx_pid})")
            
            # Write PID file
            with open('/var/run/nginx.pid', 'w') as f:
                f.write(str(self.nginx_pid))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to start nginx: {e}")
            return False
    
    def graceful_shutdown(self, timeout: int = 25) -> bool:
        """Gracefully shutdown nginx with connection draining"""
        logger.info("Initiating nginx graceful shutdown...")
        
        if not self.nginx_pid:
            logger.warning("No nginx PID found")
            return True
        
        try:
            # Send SIGQUIT for graceful shutdown
            os.kill(self.nginx_pid, signal.SIGQUIT)
            logger.info("Sent SIGQUIT to nginx for graceful shutdown")
            
            # Wait for nginx to shut down
            start_time = time.time()
            while time.time() - start_time < timeout:
                try:
                    os.kill(self.nginx_pid, 0)  # Check if process exists
                    time.sleep(0.5)
                except ProcessLookupError:
                    elapsed = time.time() - start_time
                    logger.info(f"Nginx shut down gracefully in {elapsed:.2f} seconds")
                    return True
            
            # If still running after timeout, force kill
            logger.warning("Nginx did not shut down gracefully, forcing termination")
            os.kill(self.nginx_pid, signal.SIGKILL)
            return False
            
        except Exception as e:
            logger.error(f"Error during nginx shutdown: {e}")
            return False
    
    def reload_config(self) -> bool:
        """Reload nginx configuration without downtime"""
        logger.info("Reloading nginx configuration...")
        
        try:
            # Test config first
            result = subprocess.run(['nginx', '-t'], capture_output=True)
            if result.returncode != 0:
                logger.error(f"Config test failed: {result.stderr.decode()}")
                return False
            
            # Send SIGHUP to reload
            if self.nginx_pid:
                os.kill(self.nginx_pid, signal.SIGHUP)
                logger.info("Nginx configuration reloaded successfully")
                return True
            else:
                logger.error("No nginx PID for reload")
                return False
                
        except Exception as e:
            logger.error(f"Failed to reload nginx config: {e}")
            return False


class ShutdownHandler:
    """Handles graceful shutdown coordination"""
    
    def __init__(self, nginx_manager: NginxManager):
        self.nginx_manager = nginx_manager
        self.shutdown_start_time = None
        self.shutdown_callbacks = []
    
    def register_callback(self, callback):
        """Register shutdown callback"""
        self.shutdown_callbacks.append(callback)
    
    def handle_signal(self, signum, frame):
        """Handle shutdown signals"""
        signal_name = signal.Signals(signum).name
        logger.info(f"Received {signal_name} signal")
        
        self.shutdown_start_time = time.time()
        shutdown_event.set()
        
        # Execute shutdown sequence
        self._execute_shutdown()
    
    def _execute_shutdown(self):
        """Execute shutdown sequence"""
        logger.info("Starting shutdown sequence...")
        
        # 1. Stop accepting new connections
        logger.info("Blocking new connections...")
        # Nginx handles this automatically with graceful shutdown
        
        # 2. Wait for existing connections to complete
        logger.info(f"Draining connections (max {CONFIG['connection_drain_timeout']}s)...")
        
        # 3. Execute callbacks
        for callback in self.shutdown_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"Shutdown callback error: {e}")
        
        # 4. Shutdown nginx gracefully
        if self.nginx_manager.graceful_shutdown(CONFIG['connection_drain_timeout']):
            logger.info("Nginx shutdown completed")
        else:
            logger.warning("Nginx required forced termination")
        
        # 5. Write shutdown state
        self._write_shutdown_state()
        
        # 6. Final cleanup
        self._cleanup()
        
        elapsed = time.time() - self.shutdown_start_time
        logger.info(f"Shutdown sequence completed in {elapsed:.2f} seconds")
        
        sys.exit(0)
    
    def _write_shutdown_state(self):
        """Write shutdown state for debugging"""
        try:
            state = {
                'shutdown_time': datetime.now().isoformat(),
                'correlation_id': correlation_id,
                'uptime_seconds': time.time() - startup_time if 'startup_time' in globals() else 0,
                'graceful': True
            }
            
            with open('/var/log/nginx/shutdown_state.json', 'w') as f:
                json.dump(state, f, indent=2)
                
        except Exception as e:
            logger.error(f"Failed to write shutdown state: {e}")
    
    def _cleanup(self):
        """Final cleanup tasks"""
        logger.info("Performing final cleanup...")
        
        # Remove PID files
        for pid_file in ['/var/run/nginx.pid', '/var/run/frontend.pid']:
            try:
                os.remove(pid_file)
            except:
                pass
        
        # Close log files
        logging.shutdown()


def write_startup_success():
    """Write startup success marker"""
    success_info = {
        'timestamp': datetime.now().isoformat(),
        'correlation_id': correlation_id,
        'pid': os.getpid(),
        'backend_url': os.environ.get('REACT_APP_API_URL'),
        'ws_url': os.environ.get('REACT_APP_WS_URL')
    }
    
    with open('/var/log/nginx/startup_success.json', 'w') as f:
        json.dump(success_info, f, indent=2)


def main():
    """Main startup sequence"""
    global startup_time, startup_complete
    startup_time = time.time()
    
    logger.info("=" * 60)
    logger.info("Frontend Startup Sequence Initiated")
    logger.info(f"Process ID: {os.getpid()}")
    logger.info(f"Correlation ID: {correlation_id}")
    logger.info("=" * 60)
    
    # Initialize components
    validator = EnvironmentValidator()
    nginx_manager = NginxManager()
    shutdown_handler = ShutdownHandler(nginx_manager)
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, shutdown_handler.handle_signal)
    signal.signal(signal.SIGINT, shutdown_handler.handle_signal)
    signal.signal(signal.SIGHUP, lambda s, f: nginx_manager.reload_config())
    
    try:
        # Stage 1: Environment validation
        logger.info("Stage 1: Environment Validation")
        if not validator.validate_all():
            raise StartupError(f"Validation failed: {validator.validation_errors}")
        
        # Log warnings
        for warning in validator.warnings:
            logger.warning(f"Validation warning: {warning}")
        
        # Stage 2: Backend health check
        logger.info("Stage 2: Backend Health Check")
        backend_url = os.environ.get('REACT_APP_API_URL', '')
        if backend_url:
            health_checker = BackendHealthChecker(backend_url)
            healthy, health_status = health_checker.check_health(
                CONFIG['backend_check_retries'],
                CONFIG['backend_check_interval']
            )
            
            if not healthy:
                raise StartupError(f"Backend health check failed: {health_status['errors']}")
            
            # Check WebSocket connectivity
            if not health_checker.check_websocket():
                logger.warning("WebSocket connectivity check failed (non-critical)")
        else:
            logger.warning("No backend URL configured, skipping health check")
        
        # Stage 3: Start nginx
        logger.info("Stage 3: Starting Nginx")
        if not nginx_manager.start_nginx():
            raise StartupError("Failed to start nginx")
        
        # Mark startup as complete
        startup_complete = True
        elapsed = time.time() - startup_time
        logger.info(f"Startup completed successfully in {elapsed:.2f} seconds")
        
        # Write success marker
        write_startup_success()
        
        # Keep the script running
        logger.info("Frontend service is running...")
        while not shutdown_event.is_set():
            time.sleep(1)
            
    except StartupError as e:
        logger.error(f"Startup failed: {e}")
        
        # Write failure marker
        failure_info = {
            'timestamp': datetime.now().isoformat(),
            'correlation_id': correlation_id,
            'error': str(e),
            'validation_errors': validator.validation_errors if 'validator' in locals() else []
        }
        
        with open('/var/log/nginx/startup_failure.json', 'w') as f:
            json.dump(failure_info, f, indent=2)
        
        sys.exit(1)
        
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        sys.exit(2)


if __name__ == '__main__':
    main()