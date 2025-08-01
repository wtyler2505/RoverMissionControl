"""
Locust load testing configuration for Rover Mission Control Backend
Run with: locust -f backend/tests/locustfile.py --host=http://localhost:8000
"""

from locust import HttpUser, task, between, events
import json
import time
import random
from typing import Dict, Any


class RoverMissionControlUser(HttpUser):
    """Simulate a rover mission control user."""
    
    wait_time = between(1, 5)  # Wait 1-5 seconds between tasks
    
    def on_start(self):
        """Initialize user session."""
        self.auth_token = None
        self.device_id = f"rover_{random.randint(1000, 9999)}"
        self.user_id = f"user_{random.randint(100, 999)}"
        
        # Attempt to authenticate
        self.authenticate()
    
    def authenticate(self):
        """Authenticate user and get token."""
        login_data = {
            "username": "testuser",
            "password": "testpassword"
        }
        
        with self.client.post("/api/auth/login", json=login_data, catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.auth_token = data.get("access_token")
                    response.success()
                except:
                    response.failure("Failed to parse authentication response")
            elif response.status_code == 401:
                # Expected for test environment without proper auth
                response.success()
            else:
                response.failure(f"Authentication failed with status {response.status_code}")
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers if token is available."""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    @task(10)
    def check_health(self):
        """Check system health - most frequent task."""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    if "status" in data:
                        response.success()
                    else:
                        response.failure("Health check missing status field")
                except:
                    response.failure("Failed to parse health check response")
            else:
                response.failure(f"Health check failed with status {response.status_code}")
    
    @task(8)
    def get_telemetry_latest(self):
        """Get latest telemetry data."""
        headers = self.get_auth_headers()
        with self.client.get("/api/telemetry/latest", headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401, 404]:  # Accept various responses
                response.success()
            else:
                response.failure(f"Telemetry request failed with status {response.status_code}")
    
    @task(6)
    def get_hardware_devices(self):
        """Get list of hardware devices."""
        headers = self.get_auth_headers()
        with self.client.get("/api/hardware/devices", headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Hardware devices request failed with status {response.status_code}")
    
    @task(5)
    def get_command_history(self):
        """Get command execution history."""
        headers = self.get_auth_headers()
        params = {"limit": random.randint(10, 50)}
        with self.client.get("/api/commands/history", params=params, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Command history request failed with status {response.status_code}")
    
    @task(4)
    def submit_command(self):
        """Submit a command to the rover."""
        commands = [
            {
                "command": "move_forward",
                "parameters": {"distance": random.uniform(1, 10), "speed": random.uniform(0.1, 1.0)},
                "priority": "normal",
                "timeout": 30
            },
            {
                "command": "rotate",
                "parameters": {"angle": random.uniform(-180, 180), "speed": 0.5},
                "priority": "normal",
                "timeout": 20
            },
            {
                "command": "capture_image",
                "parameters": {"resolution": random.choice(["640x480", "1280x720"]), "format": "jpg"},
                "priority": "normal",
                "timeout": 15
            },
            {
                "command": "get_sensor_data",
                "parameters": {"sensor_types": ["temperature", "humidity", "gps"]},
                "priority": "low",
                "timeout": 10
            }
        ]
        
        command_data = random.choice(commands)
        headers = self.get_auth_headers()
        
        with self.client.post("/api/commands", json=command_data, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 201, 401, 422]:  # Accept various responses
                response.success()
            else:
                response.failure(f"Command submission failed with status {response.status_code}")
    
    @task(3)
    def submit_telemetry_data(self):
        """Submit telemetry data to the server."""
        telemetry_data = {
            "device_id": self.device_id,
            "timestamp": time.time(),
            "sensors": {
                "temperature": {"value": random.uniform(20, 30), "unit": "°C"},
                "humidity": {"value": random.uniform(40, 80), "unit": "%"},
                "battery": {"value": random.uniform(50, 100), "unit": "%"},
                "gps": {
                    "latitude": random.uniform(40.7, 40.8),
                    "longitude": random.uniform(-74.1, -74.0),
                    "altitude": random.uniform(0, 100),
                    "unit": "degrees"
                }
            }
        }
        
        headers = self.get_auth_headers()
        with self.client.post("/api/telemetry", json=telemetry_data, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 201, 401, 422]:
                response.success()
            else:
                response.failure(f"Telemetry submission failed with status {response.status_code}")
    
    @task(3)
    def get_device_status(self):
        """Get status of a specific device."""
        headers = self.get_auth_headers()
        with self.client.get(f"/api/hardware/status/{self.device_id}", headers=headers, catch_response=True) as response:
            if response.status_code in [200, 404, 401]:  # Device might not exist
                response.success()
            else:
                response.failure(f"Device status request failed with status {response.status_code}")
    
    @task(2)
    def discover_devices(self):
        """Trigger device discovery."""
        headers = self.get_auth_headers()
        with self.client.post("/api/hardware/discover", headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Device discovery failed with status {response.status_code}")
    
    @task(2)
    def get_telemetry_history(self):
        """Get historical telemetry data."""
        params = {
            "start_time": "2024-01-01T00:00:00Z",
            "end_time": "2024-01-02T00:00:00Z",
            "limit": random.randint(10, 100)
        }
        headers = self.get_auth_headers()
        
        with self.client.get("/api/telemetry/history", params=params, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"Telemetry history request failed with status {response.status_code}")
    
    @task(1)
    def emergency_stop(self):
        """Send emergency stop command."""
        emergency_command = {
            "command": "emergency_stop",
            "parameters": {},
            "priority": "critical",
            "timeout": 5
        }
        
        headers = self.get_auth_headers()
        with self.client.post("/api/commands", json=emergency_command, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 201, 401]:
                response.success()
            else:
                response.failure(f"Emergency stop failed with status {response.status_code}")


class AdministratorUser(HttpUser):
    """Simulate an administrator performing management tasks."""
    
    wait_time = between(5, 15)  # Administrators work more slowly
    weight = 1  # Lower weight means fewer admin users
    
    def on_start(self):
        """Initialize administrator session."""
        self.auth_token = None
        self.authenticate_admin()
    
    def authenticate_admin(self):
        """Authenticate as administrator."""
        admin_data = {
            "username": "admin",
            "password": "admin_password"
        }
        
        with self.client.post("/api/auth/login", json=admin_data, catch_response=True) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.auth_token = data.get("access_token")
                    response.success()
                except:
                    response.failure("Failed to parse admin authentication response")
            else:
                response.success()  # Accept auth failure in test environment
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers."""
        if self.auth_token:
            return {"Authorization": f"Bearer {self.auth_token}"}
        return {}
    
    @task(5)
    def view_system_status(self):
        """View detailed system status."""
        headers = self.get_auth_headers()
        with self.client.get("/health/detailed", headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure(f"System status check failed with status {response.status_code}")
    
    @task(3)
    def manage_users(self):
        """Perform user management tasks."""
        headers = self.get_auth_headers()
        
        # Get user list
        with self.client.get("/api/users", headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401, 404]:
                response.success()
            else:
                response.failure(f"User management failed with status {response.status_code}")
    
    @task(2)
    def configure_hardware(self):
        """Configure hardware settings."""
        config_data = {
            "device_id": f"config_device_{random.randint(1, 100)}",
            "settings": {
                "baudrate": random.choice([9600, 115200]),
                "timeout": random.uniform(1.0, 5.0),
                "enabled": True
            }
        }
        
        headers = self.get_auth_headers()
        with self.client.post("/api/hardware/configure", json=config_data, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 201, 401, 404]:
                response.success()
            else:
                response.failure(f"Hardware configuration failed with status {response.status_code}")
    
    @task(2)
    def review_audit_logs(self):
        """Review system audit logs."""
        params = {"limit": 50, "level": "info"}
        headers = self.get_auth_headers()
        
        with self.client.get("/api/audit/logs", params=params, headers=headers, catch_response=True) as response:
            if response.status_code in [200, 401, 404]:
                response.success()
            else:
                response.failure(f"Audit log review failed with status {response.status_code}")


class DeveloperUser(HttpUser):
    """Simulate a developer testing APIs."""
    
    wait_time = between(2, 8)
    weight = 2  # Moderate number of developer users
    
    @task(5)
    def test_api_endpoints(self):
        """Test various API endpoints."""
        endpoints = [
            "/health",
            "/api/hardware/devices",
            "/api/telemetry/latest",
            "/api/commands/history"
        ]
        
        endpoint = random.choice(endpoints)
        with self.client.get(endpoint, catch_response=True) as response:
            if response.status_code in [200, 401, 404]:
                response.success()
            else:
                response.failure(f"API test failed for {endpoint} with status {response.status_code}")
    
    @task(3)
    def stress_test_endpoint(self):
        """Perform rapid requests to stress test endpoints."""
        for _ in range(random.randint(5, 15)):
            with self.client.get("/health", catch_response=True) as response:
                if response.status_code == 200:
                    response.success()
                else:
                    response.failure(f"Stress test failed with status {response.status_code}")
    
    @task(2)
    def test_error_conditions(self):
        """Test error handling."""
        # Test with invalid data
        invalid_data = {"invalid": "data", "format": True}
        
        with self.client.post("/api/commands", json=invalid_data, catch_response=True) as response:
            if response.status_code in [400, 422, 401]:  # Expected error responses
                response.success()
            else:
                response.failure(f"Error condition test failed with status {response.status_code}")


# Load testing events and custom metrics
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Initialize load testing."""
    print("Starting Rover Mission Control load test...")
    print(f"Target host: {environment.host}")
    print(f"Users: {environment.runner.user_count}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Finalize load testing."""
    print("Load test completed!")
    
    # Print summary statistics
    stats = environment.runner.stats
    print(f"Total requests: {stats.total.num_requests}")
    print(f"Total failures: {stats.total.num_failures}")
    print(f"Average response time: {stats.total.avg_response_time:.2f}ms")
    print(f"Max response time: {stats.total.max_response_time:.2f}ms")
    print(f"Requests per second: {stats.total.current_rps:.2f}")
    
    # Calculate error rate
    error_rate = (stats.total.num_failures / stats.total.num_requests * 100) if stats.total.num_requests > 0 else 0
    print(f"Error rate: {error_rate:.2f}%")


# Custom load testing scenarios
class HighLoadScenario(HttpUser):
    """High-intensity load testing scenario."""
    
    wait_time = between(0.1, 0.5)  # Very short wait times
    weight = 10  # High weight for load testing
    
    @task
    def rapid_fire_requests(self):
        """Make rapid consecutive requests."""
        endpoints = ["/health", "/api/telemetry/latest", "/api/hardware/devices"]
        
        for endpoint in endpoints:
            with self.client.get(endpoint, catch_response=True) as response:
                if response.status_code in [200, 401]:
                    response.success()
                else:
                    response.failure(f"High load test failed for {endpoint}")


class LongRunningUser(HttpUser):
    """Simulate users with long-running sessions."""
    
    wait_time = between(30, 120)  # Long wait times between requests
    weight = 3
    
    @task
    def periodic_check(self):
        """Perform periodic system checks."""
        with self.client.get("/health", catch_response=True) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure("Long-running user health check failed")
    
    @task
    def fetch_data_batch(self):
        """Fetch large batches of data."""
        params = {"limit": 1000}  # Large data request
        
        with self.client.get("/api/telemetry/history", params=params, catch_response=True) as response:
            if response.status_code in [200, 401]:
                response.success()
            else:
                response.failure("Large data batch request failed")


# Configuration for different testing phases
class WarmupUser(HttpUser):
    """User class for system warmup phase."""
    
    wait_time = between(5, 10)
    
    @task
    def warmup_requests(self):
        """Make warmup requests to initialize system."""
        endpoints = ["/health", "/api/hardware/devices"]
        
        for endpoint in endpoints:
            self.client.get(endpoint)


# User classes are automatically discovered by Locust
# To run specific scenarios:
# locust -f locustfile.py --users=50 --spawn-rate=5 --run-time=300s
# locust -f locustfile.py RoverMissionControlUser --users=20 --spawn-rate=2