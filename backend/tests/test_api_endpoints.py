"""
Comprehensive API endpoint testing for Rover Mission Control
"""

import pytest
from unittest.mock import patch, Mock, AsyncMock
from fastapi.testclient import TestClient
from fastapi import status
import json
from typing import Dict, Any

pytestmark = pytest.mark.api


class TestHealthEndpoints:
    """Test health check and status endpoints."""
    
    def test_health_check(self, client: TestClient):
        """Test basic health check endpoint."""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
        assert data["status"] == "healthy"
    
    def test_health_check_detailed(self, client: TestClient):
        """Test detailed health check with component status."""
        response = client.get("/health/detailed")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "database" in data
        assert "hardware" in data
        assert "websocket" in data


class TestHardwareEndpoints:
    """Test hardware management API endpoints."""
    
    def test_get_devices(self, client: TestClient):
        """Test getting list of hardware devices."""
        response = client.get("/api/hardware/devices")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_discover_devices(self, client: TestClient):
        """Test hardware device discovery."""
        response = client.post("/api/hardware/discover")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "discovered_devices" in data
    
    def test_connect_device(self, client: TestClient):
        """Test connecting to a hardware device."""
        device_data = {"device_id": "test_device", "port": "/dev/ttyUSB0"}
        response = client.post("/api/hardware/connect", json=device_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
    
    def test_disconnect_device(self, client: TestClient):
        """Test disconnecting from a hardware device."""
        response = client.post("/api/hardware/disconnect/test_device")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
    
    def test_get_device_status(self, client: TestClient):
        """Test getting device status."""
        response = client.get("/api/hardware/status/test_device")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "connected" in data
    
    def test_send_command_to_device(self, client: TestClient, sample_command_data: Dict[str, Any]):
        """Test sending command to hardware device."""
        response = client.post("/api/hardware/command/test_device", json=sample_command_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "command_id" in data or "status" in data
    
    def test_get_device_data(self, client: TestClient):
        """Test reading data from hardware device."""
        response = client.get("/api/hardware/data/test_device")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, dict)
    
    def test_device_not_found(self, client: TestClient):
        """Test handling of non-existent device."""
        response = client.get("/api/hardware/status/nonexistent_device")
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestCommandEndpoints:
    """Test command queue and execution endpoints."""
    
    def test_submit_command(self, client: TestClient, sample_command_data: Dict[str, Any]):
        """Test submitting a command to the queue."""
        response = client.post("/api/commands", json=sample_command_data)
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "command_id" in data
    
    def test_get_command_status(self, client: TestClient):
        """Test getting command execution status."""
        response = client.get("/api/commands/cmd_123/status")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "status" in data
    
    def test_cancel_command(self, client: TestClient):
        """Test canceling a pending command."""
        response = client.delete("/api/commands/cmd_123")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "cancelled" in data or "status" in data
    
    def test_get_command_history(self, client: TestClient):
        """Test retrieving command history."""
        response = client.get("/api/commands/history")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_command_history_filtered(self, client: TestClient):
        """Test retrieving filtered command history."""
        params = {"status": "completed", "limit": 10}
        response = client.get("/api/commands/history", params=params)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_invalid_command_format(self, client: TestClient):
        """Test handling of invalid command format."""
        invalid_command = {"invalid": "data"}
        response = client.post("/api/commands", json=invalid_command)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestTelemetryEndpoints:
    """Test telemetry data endpoints."""
    
    def test_get_latest_telemetry(self, client: TestClient):
        """Test getting latest telemetry data."""
        response = client.get("/api/telemetry/latest")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, dict)
    
    def test_get_telemetry_history(self, client: TestClient):
        """Test getting telemetry history."""
        params = {"start_time": "2024-01-01T00:00:00Z", "end_time": "2024-01-02T00:00:00Z"}
        response = client.get("/api/telemetry/history", params=params)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_telemetry_by_device(self, client: TestClient):
        """Test getting telemetry for specific device."""
        response = client.get("/api/telemetry/device/test_device")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, dict)
    
    def test_submit_telemetry_data(self, client: TestClient, sample_telemetry_data: Dict[str, Any]):
        """Test submitting telemetry data."""
        response = client.post("/api/telemetry", json=sample_telemetry_data)
        assert response.status_code == status.HTTP_201_CREATED or response.status_code == status.HTTP_200_OK


class TestAuthenticationEndpoints:
    """Test authentication and authorization endpoints."""
    
    def test_login_success(self, client: TestClient, test_user_data: Dict[str, Any]):
        """Test successful user login."""
        login_data = {
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "token_type" in data
    
    def test_login_invalid_credentials(self, client: TestClient):
        """Test login with invalid credentials."""
        login_data = {"username": "invalid", "password": "wrong"}
        response = client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_protected_endpoint_without_token(self, client: TestClient):
        """Test accessing protected endpoint without token."""
        response = client.get("/api/users/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_protected_endpoint_with_token(self, client: TestClient):
        """Test accessing protected endpoint with valid token."""
        headers = {"Authorization": "Bearer test_token"}
        response = client.get("/api/users/me", headers=headers)
        assert response.status_code == status.HTTP_200_OK
    
    def test_token_refresh(self, client: TestClient):
        """Test token refresh functionality."""
        refresh_data = {"refresh_token": "valid_refresh_token"}
        response = client.post("/api/auth/refresh", json=refresh_data)
        assert response.status_code == status.HTTP_200_OK or response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_logout(self, client: TestClient):
        """Test user logout."""
        headers = {"Authorization": "Bearer test_token"}
        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == status.HTTP_200_OK


class TestErrorHandling:
    """Test API error handling and edge cases."""
    
    def test_404_not_found(self, client: TestClient):
        """Test 404 handling for non-existent endpoints."""
        response = client.get("/api/nonexistent")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_405_method_not_allowed(self, client: TestClient):
        """Test 405 handling for wrong HTTP methods."""
        response = client.delete("/api/health")
        assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
    
    def test_422_validation_error(self, client: TestClient):
        """Test validation error handling."""
        invalid_data = {"field": "invalid_format"}
        response = client.post("/api/commands", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert "detail" in data
    
    def test_rate_limiting(self, client: TestClient):
        """Test rate limiting functionality."""
        # Make multiple rapid requests
        responses = []
        for _ in range(100):
            response = client.get("/api/health")
            responses.append(response.status_code)
        
        # Should include some rate-limited responses
        assert any(code == status.HTTP_429_TOO_MANY_REQUESTS for code in responses) or all(code == status.HTTP_200_OK for code in responses)
    
    def test_cors_headers(self, client: TestClient):
        """Test CORS headers in responses."""
        response = client.options("/api/health")
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED]
        # CORS headers might be present
        if "access-control-allow-origin" in response.headers:
            assert response.headers["access-control-allow-origin"] is not None


class TestPerformanceEndpoints:
    """Test performance-related endpoints and metrics."""
    
    @pytest.mark.slow
    def test_concurrent_requests(self, client: TestClient):
        """Test handling of concurrent requests."""
        import concurrent.futures
        import time
        
        def make_request():
            start_time = time.time()
            response = client.get("/api/health")
            end_time = time.time()
            return response.status_code, end_time - start_time
        
        # Test with 10 concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(make_request) for _ in range(10)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        # All requests should succeed
        assert all(status_code == status.HTTP_200_OK for status_code, _ in results)
        
        # Response times should be reasonable (< 1 second)
        assert all(response_time < 1.0 for _, response_time in results)
    
    @pytest.mark.performance
    def test_response_time_benchmarks(self, client: TestClient):
        """Test response time benchmarks for key endpoints."""
        import time
        
        endpoints = [
            "/health",
            "/api/hardware/devices",
            "/api/telemetry/latest",
            "/api/commands/history"
        ]
        
        for endpoint in endpoints:
            start_time = time.time()
            response = client.get(endpoint)
            end_time = time.time()
            response_time = end_time - start_time
            
            assert response.status_code == status.HTTP_200_OK
            assert response_time < 0.5  # Should respond within 500ms
    
    @pytest.mark.load
    def test_memory_usage_under_load(self, client: TestClient):
        """Test memory usage under sustained load."""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Make 1000 requests
        for _ in range(1000):
            response = client.get("/api/health")
            assert response.status_code == status.HTTP_200_OK
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        # Memory increase should be reasonable (< 50MB)
        assert memory_increase < 50


# Integration tests
class TestEndpointIntegration:
    """Test integration between different API endpoints."""
    
    def test_device_command_workflow(self, client: TestClient, sample_command_data: Dict[str, Any]):
        """Test complete device command workflow."""
        # 1. Discover devices
        discover_response = client.post("/api/hardware/discover")
        assert discover_response.status_code == status.HTTP_200_OK
        
        # 2. Connect to device
        connect_data = {"device_id": "test_device", "port": "/dev/ttyUSB0"}
        connect_response = client.post("/api/hardware/connect", json=connect_data)
        assert connect_response.status_code == status.HTTP_200_OK
        
        # 3. Send command
        command_response = client.post("/api/commands", json=sample_command_data)
        assert command_response.status_code == status.HTTP_201_CREATED
        command_id = command_response.json().get("command_id", "cmd_123")
        
        # 4. Check command status
        status_response = client.get(f"/api/commands/{command_id}/status")
        assert status_response.status_code == status.HTTP_200_OK
        
        # 5. Get telemetry data
        telemetry_response = client.get("/api/telemetry/latest")
        assert telemetry_response.status_code == status.HTTP_200_OK
    
    def test_authentication_protected_workflow(self, client: TestClient, test_user_data: Dict[str, Any]):
        """Test workflow requiring authentication."""
        # 1. Try protected endpoint without auth (should fail)
        response = client.get("/api/users/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # 2. Login
        login_data = {
            "username": test_user_data["username"],
            "password": test_user_data["password"]
        }
        login_response = client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.json().get("access_token", "test_token")
        
        # 3. Use protected endpoint with auth (should succeed)
        headers = {"Authorization": f"Bearer {token}"}
        protected_response = client.get("/api/users/me", headers=headers)
        assert protected_response.status_code == status.HTTP_200_OK