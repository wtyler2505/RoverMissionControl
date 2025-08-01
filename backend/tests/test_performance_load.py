"""
Performance and Load Testing for Rover Mission Control Backend
"""

import pytest
import asyncio
import time
import psutil
import os
import concurrent.futures
from unittest.mock import Mock, patch
from typing import Dict, Any, List
import httpx
from fastapi.testclient import TestClient
import statistics
import threading
import queue

pytestmark = [pytest.mark.performance, pytest.mark.slow]


class PerformanceMetrics:
    """Helper class to collect and analyze performance metrics."""
    
    def __init__(self):
        self.response_times = []
        self.memory_usage = []
        self.cpu_usage = []
        self.error_count = 0
        self.total_requests = 0
        self.start_time = None
        self.end_time = None
    
    def start_monitoring(self):
        """Start performance monitoring."""
        self.start_time = time.time()
        self.response_times.clear()
        self.memory_usage.clear()
        self.cpu_usage.clear()
        self.error_count = 0
        self.total_requests = 0
    
    def record_request(self, response_time: float, success: bool = True):
        """Record a request's performance metrics."""
        self.response_times.append(response_time)
        self.total_requests += 1
        if not success:
            self.error_count += 1
    
    def record_system_metrics(self):
        """Record current system metrics."""
        process = psutil.Process(os.getpid())
        self.memory_usage.append(process.memory_info().rss / 1024 / 1024)  # MB
        self.cpu_usage.append(process.cpu_percent())
    
    def stop_monitoring(self):
        """Stop performance monitoring."""
        self.end_time = time.time()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get performance summary."""
        if not self.response_times:
            return {"error": "No data collected"}
        
        duration = self.end_time - self.start_time if self.end_time else 0
        
        return {
            "duration": duration,
            "total_requests": self.total_requests,
            "requests_per_second": self.total_requests / duration if duration > 0 else 0,
            "error_rate": self.error_count / self.total_requests if self.total_requests > 0 else 0,
            "response_time": {
                "min": min(self.response_times),
                "max": max(self.response_times),
                "mean": statistics.mean(self.response_times),
                "median": statistics.median(self.response_times),
                "p95": statistics.quantiles(self.response_times, n=20)[18] if len(self.response_times) >= 20 else max(self.response_times),
                "p99": statistics.quantiles(self.response_times, n=100)[98] if len(self.response_times) >= 100 else max(self.response_times)
            },
            "memory": {
                "min": min(self.memory_usage) if self.memory_usage else 0,
                "max": max(self.memory_usage) if self.memory_usage else 0,
                "mean": statistics.mean(self.memory_usage) if self.memory_usage else 0
            },
            "cpu": {
                "min": min(self.cpu_usage) if self.cpu_usage else 0,
                "max": max(self.cpu_usage) if self.cpu_usage else 0,
                "mean": statistics.mean(self.cpu_usage) if self.cpu_usage else 0
            }
        }


@pytest.fixture
def performance_metrics():
    """Provide performance metrics collector."""
    return PerformanceMetrics()


class TestAPIPerformance:
    """Test API endpoint performance characteristics."""
    
    @pytest.mark.benchmark
    def test_health_endpoint_performance(self, client: TestClient, performance_metrics: PerformanceMetrics):
        """Benchmark health endpoint performance."""
        performance_metrics.start_monitoring()
        
        # Run 1000 requests
        for _ in range(1000):
            start_time = time.time()
            response = client.get("/health")
            end_time = time.time()
            
            performance_metrics.record_request(
                response_time=end_time - start_time,
                success=response.status_code == 200
            )
            
            if len(performance_metrics.response_times) % 100 == 0:
                performance_metrics.record_system_metrics()
        
        performance_metrics.stop_monitoring()
        summary = performance_metrics.get_summary()
        
        # Performance assertions
        assert summary["response_time"]["mean"] < 0.05  # 50ms average
        assert summary["response_time"]["p95"] < 0.1    # 95th percentile under 100ms
        assert summary["error_rate"] == 0               # No errors
        assert summary["requests_per_second"] > 500     # At least 500 RPS
    
    @pytest.mark.benchmark
    def test_telemetry_endpoint_performance(self, client: TestClient, performance_metrics: PerformanceMetrics):
        """Benchmark telemetry endpoint performance."""
        performance_metrics.start_monitoring()
        
        # Test telemetry retrieval performance
        for _ in range(500):
            start_time = time.time()
            response = client.get("/api/telemetry/latest")
            end_time = time.time()
            
            performance_metrics.record_request(
                response_time=end_time - start_time,
                success=response.status_code == 200
            )
        
        performance_metrics.stop_monitoring()
        summary = performance_metrics.get_summary()
        
        # Performance assertions for data-heavy endpoint
        assert summary["response_time"]["mean"] < 0.1   # 100ms average
        assert summary["response_time"]["p95"] < 0.2    # 95th percentile under 200ms
        assert summary["error_rate"] < 0.01             # Less than 1% error rate
    
    @pytest.mark.benchmark
    def test_command_submission_performance(self, client: TestClient, performance_metrics: PerformanceMetrics, sample_command_data: Dict[str, Any]):
        """Benchmark command submission performance."""
        performance_metrics.start_monitoring()
        
        # Test command submission performance
        for i in range(200):
            command_data = sample_command_data.copy()
            command_data["sequence"] = i
            
            start_time = time.time()
            response = client.post("/api/commands", json=command_data)
            end_time = time.time()
            
            performance_metrics.record_request(
                response_time=end_time - start_time,
                success=response.status_code in [200, 201]
            )
        
        performance_metrics.stop_monitoring()
        summary = performance_metrics.get_summary()
        
        # Performance assertions for write operations
        assert summary["response_time"]["mean"] < 0.15  # 150ms average
        assert summary["response_time"]["p95"] < 0.3    # 95th percentile under 300ms
        assert summary["error_rate"] < 0.05             # Less than 5% error rate


class TestConcurrencyPerformance:
    """Test performance under concurrent load."""
    
    @pytest.mark.load
    def test_concurrent_health_checks(self, client: TestClient, performance_metrics: PerformanceMetrics):
        """Test concurrent health check performance."""
        performance_metrics.start_monitoring()
        
        def make_request():
            start_time = time.time()
            response = client.get("/health")
            end_time = time.time()
            return end_time - start_time, response.status_code == 200
        
        # Use ThreadPoolExecutor for concurrent requests
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            futures = [executor.submit(make_request) for _ in range(1000)]
            
            for future in concurrent.futures.as_completed(futures):
                response_time, success = future.result()
                performance_metrics.record_request(response_time, success)
        
        performance_metrics.stop_monitoring()
        summary = performance_metrics.get_summary()
        
        # Concurrent performance assertions
        assert summary["response_time"]["mean"] < 0.2   # 200ms average under load
        assert summary["response_time"]["p95"] < 0.5    # 95th percentile under 500ms
        assert summary["error_rate"] < 0.01             # Less than 1% error rate
        assert summary["requests_per_second"] > 100     # At least 100 RPS under concurrent load
    
    @pytest.mark.load
    def test_mixed_endpoint_concurrent_load(self, client: TestClient, performance_metrics: PerformanceMetrics, sample_command_data: Dict[str, Any]):
        """Test mixed endpoint performance under concurrent load."""
        performance_metrics.start_monitoring()
        
        def make_health_request():
            start_time = time.time()
            response = client.get("/health")
            end_time = time.time()
            return end_time - start_time, response.status_code == 200, "health"
        
        def make_telemetry_request():
            start_time = time.time()
            response = client.get("/api/telemetry/latest")
            end_time = time.time()
            return end_time - start_time, response.status_code == 200, "telemetry"
        
        def make_command_request():
            start_time = time.time()
            response = client.post("/api/commands", json=sample_command_data)
            end_time = time.time()
            return end_time - start_time, response.status_code in [200, 201], "command"
        
        # Mix of different request types
        request_functions = [make_health_request] * 500 + [make_telemetry_request] * 300 + [make_command_request] * 200
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
            futures = [executor.submit(func) for func in request_functions]
            
            endpoint_metrics = {"health": [], "telemetry": [], "command": []}
            
            for future in concurrent.futures.as_completed(futures):
                response_time, success, endpoint_type = future.result()
                performance_metrics.record_request(response_time, success)
                endpoint_metrics[endpoint_type].append(response_time)
        
        performance_metrics.stop_monitoring()
        summary = performance_metrics.get_summary()
        
        # Mixed load performance assertions
        assert summary["response_time"]["mean"] < 0.3   # 300ms average under mixed load
        assert summary["error_rate"] < 0.02             # Less than 2% error rate
        assert len(endpoint_metrics["health"]) == 500
        assert len(endpoint_metrics["telemetry"]) == 300
        assert len(endpoint_metrics["command"]) == 200


class TestMemoryPerformance:
    """Test memory usage and garbage collection performance."""
    
    @pytest.mark.performance
    def test_memory_usage_under_load(self, client: TestClient):
        """Test memory usage under sustained load."""
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        memory_readings = []
        
        # Generate sustained load for 30 seconds
        start_time = time.time()
        request_count = 0
        
        while time.time() - start_time < 30:
            # Make various types of requests
            client.get("/health")
            client.get("/api/telemetry/latest")
            client.get("/api/hardware/devices")
            request_count += 3
            
            # Record memory usage every 100 requests
            if request_count % 100 == 0:
                current_memory = process.memory_info().rss / 1024 / 1024
                memory_readings.append(current_memory)
        
        final_memory = process.memory_info().rss / 1024 / 1024
        max_memory = max(memory_readings) if memory_readings else final_memory
        memory_increase = max_memory - initial_memory
        
        # Memory usage assertions
        assert memory_increase < 100  # Should not increase by more than 100MB
        assert final_memory < initial_memory + 50  # Final memory should be reasonable
        
        # Memory growth should be controlled
        if len(memory_readings) > 10:
            recent_average = statistics.mean(memory_readings[-10:])
            early_average = statistics.mean(memory_readings[:10])
            growth_rate = (recent_average - early_average) / len(memory_readings)
            assert growth_rate < 1.0  # Less than 1MB growth per measurement
    
    @pytest.mark.performance
    def test_memory_leaks_detection(self, client: TestClient, sample_telemetry_data: Dict[str, Any]):
        """Test for potential memory leaks."""
        import gc
        
        process = psutil.Process(os.getpid())
        
        # Record initial state
        gc.collect()  # Force garbage collection
        initial_memory = process.memory_info().rss / 1024 / 1024
        initial_objects = len(gc.get_objects())
        
        # Create and destroy many objects
        for cycle in range(10):
            # Create temporary load
            for _ in range(100):
                response = client.post("/api/telemetry", json=sample_telemetry_data)
                response = client.get("/api/telemetry/latest")
                response = client.get("/api/commands/history")
            
            # Force garbage collection between cycles
            gc.collect()
            
            # Check memory usage
            current_memory = process.memory_info().rss / 1024 / 1024
            current_objects = len(gc.get_objects())
            
            # Memory should not continuously grow
            if cycle > 2:  # Allow initial warmup
                assert current_memory < initial_memory + 50  # Max 50MB increase
                assert current_objects < initial_objects * 2  # Max 2x object increase
        
        # Final cleanup check
        gc.collect()
        final_memory = process.memory_info().rss / 1024 / 1024
        final_objects = len(gc.get_objects())
        
        # Should return close to initial state after cleanup
        assert final_memory < initial_memory + 30  # Max 30MB permanent increase
        assert final_objects < initial_objects * 1.5  # Max 1.5x permanent object increase


class TestDatabasePerformance:
    """Test database operation performance."""
    
    @pytest.mark.performance
    def test_database_query_performance(self, client: TestClient, test_db, seed_test_data):
        """Test database query performance."""
        import sqlite3
        
        # Insert test data for performance testing
        cursor = test_db.cursor()
        
        # Insert large amount of telemetry data
        telemetry_data = []
        for i in range(1000):
            telemetry_data.append((
                1,  # device_id
                f"sensor_type_{i % 10}",
                float(i % 100),
                "unit",
                f"2024-01-01 12:{i // 60:02d}:{i % 60:02d}"
            ))
        
        cursor.executemany("""
            INSERT INTO telemetry_data (device_id, sensor_type, value, unit, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, telemetry_data)
        test_db.commit()
        
        # Test query performance
        query_times = []
        
        for _ in range(100):
            start_time = time.time()
            response = client.get("/api/telemetry/history?limit=50")
            end_time = time.time()
            
            query_times.append(end_time - start_time)
            assert response.status_code == 200
        
        # Database query performance assertions
        avg_query_time = statistics.mean(query_times)
        max_query_time = max(query_times)
        
        assert avg_query_time < 0.1   # Average query under 100ms
        assert max_query_time < 0.5   # Max query under 500ms
    
    @pytest.mark.performance
    def test_database_write_performance(self, client: TestClient, sample_telemetry_data: Dict[str, Any]):
        """Test database write performance."""
        write_times = []
        
        for i in range(200):
            test_data = sample_telemetry_data.copy()
            test_data["sequence"] = i
            
            start_time = time.time()
            response = client.post("/api/telemetry", json=test_data)
            end_time = time.time()
            
            write_times.append(end_time - start_time)
            assert response.status_code in [200, 201]
        
        # Database write performance assertions
        avg_write_time = statistics.mean(write_times)
        max_write_time = max(write_times)
        
        assert avg_write_time < 0.2   # Average write under 200ms
        assert max_write_time < 0.8   # Max write under 800ms


class TestWebSocketPerformance:
    """Test WebSocket performance characteristics."""
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_websocket_message_throughput(self, test_app):
        """Test WebSocket message throughput performance."""
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws/telemetry") as websocket:
                
                # Test message sending throughput
                start_time = time.time()
                messages_sent = 0
                
                for i in range(1000):
                    message = {"type": "test", "sequence": i, "data": "test_data"}
                    websocket.send_json(message)
                    messages_sent += 1
                
                send_time = time.time() - start_time
                
                # Test message receiving throughput
                start_time = time.time()
                messages_received = 0
                
                try:
                    for _ in range(messages_sent):
                        response = websocket.receive_json(timeout=0.1)
                        messages_received += 1
                except:
                    pass  # Timeout expected
                
                receive_time = time.time() - start_time
                
                # Throughput assertions
                send_throughput = messages_sent / send_time
                receive_throughput = messages_received / receive_time if receive_time > 0 else 0
                
                assert send_throughput > 100    # At least 100 messages/sec send
                assert receive_throughput > 50  # At least 50 messages/sec receive
    
    @pytest.mark.performance
    @pytest.mark.asyncio
    async def test_websocket_concurrent_connections(self, test_app):
        """Test WebSocket performance with concurrent connections."""
        connection_count = 20
        message_count = 50
        
        async def connection_handler(client_id: int):
            with TestClient(test_app) as client:
                with client.websocket_connect(f"/ws/telemetry?client_id={client_id}") as websocket:
                    # Send messages from this connection
                    for i in range(message_count):
                        message = {"type": "perf_test", "client_id": client_id, "sequence": i}
                        websocket.send_json(message)
                    
                    # Try to receive responses
                    received_count = 0
                    for _ in range(message_count):
                        try:
                            response = websocket.receive_json(timeout=0.1)
                            received_count += 1
                        except:
                            break
                    
                    return received_count
        
        # Run concurrent connections
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=connection_count) as executor:
            futures = [executor.submit(connection_handler, i) for i in range(connection_count)]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        
        end_time = time.time()
        total_time = end_time - start_time
        
        # Performance assertions
        total_messages = connection_count * message_count
        total_received = sum(results)
        
        assert total_time < 30  # Should complete within 30 seconds
        assert total_received > total_messages * 0.7  # At least 70% message success rate


class TestSystemResourceUsage:
    """Test system resource usage under various conditions."""
    
    @pytest.mark.performance
    def test_cpu_usage_under_load(self, client: TestClient):
        """Test CPU usage under sustained load."""
        import psutil
        
        process = psutil.Process(os.getpid())
        cpu_readings = []
        
        # Generate load while monitoring CPU
        start_time = time.time()
        request_count = 0
        
        while time.time() - start_time < 20:  # 20 second test
            # Mixed load
            client.get("/health")
            client.get("/api/telemetry/latest")
            client.get("/api/hardware/devices")
            request_count += 3
            
            # Record CPU usage every 50 requests
            if request_count % 50 == 0:
                cpu_percent = process.cpu_percent()
                cpu_readings.append(cpu_percent)
        
        # CPU usage assertions
        if cpu_readings:
            avg_cpu = statistics.mean(cpu_readings)
            max_cpu = max(cpu_readings)
            
            assert avg_cpu < 80  # Average CPU usage under 80%
            assert max_cpu < 95  # Peak CPU usage under 95%
    
    @pytest.mark.performance
    def test_file_descriptor_usage(self, client: TestClient):
        """Test file descriptor usage doesn't leak."""
        import psutil
        
        process = psutil.Process(os.getpid())
        initial_fds = process.num_fds() if hasattr(process, 'num_fds') else 0
        
        # Generate requests that might create file descriptors
        for _ in range(500):
            client.get("/health")
            client.get("/api/hardware/devices")
            client.post("/api/hardware/discover")
        
        final_fds = process.num_fds() if hasattr(process, 'num_fds') else 0
        
        # File descriptor usage should be controlled
        if initial_fds > 0:  # Only test if we can measure FDs
            fd_increase = final_fds - initial_fds
            assert fd_increase < 50  # Should not increase by more than 50 FDs
    
    @pytest.mark.performance
    def test_thread_count_stability(self, client: TestClient):
        """Test thread count remains stable under load."""
        import psutil
        
        process = psutil.Process(os.getpid())
        initial_threads = process.num_threads()
        
        thread_counts = []
        
        # Generate sustained load
        for cycle in range(10):
            # Heavy request cycle
            for _ in range(100):
                client.get("/health")
            
            # Record thread count
            current_threads = process.num_threads()
            thread_counts.append(current_threads)
            
            time.sleep(0.5)  # Brief pause between cycles
        
        final_threads = process.num_threads()
        
        # Thread count should remain stable
        thread_increase = final_threads - initial_threads
        max_threads = max(thread_counts)
        
        assert thread_increase < 20  # Should not increase by more than 20 threads
        assert max_threads < initial_threads + 30  # Peak threads controlled