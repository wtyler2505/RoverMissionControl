"""
Integration Example: Optimized WebSocket Server Usage
Demonstrates how to integrate the performance-optimized WebSocket system
"""

import asyncio
import logging
import time
from typing import Dict, Any, List, Optional
from fastapi import FastAPI
import uvicorn

from .optimized_websocket_server import (
    OptimizedWebSocketServer, 
    OptimizedServerConfig,
    create_optimized_websocket_server
)
from .performance_optimizer import (
    OptimizedTelemetryStreamer,
    MessagePriority,
    PerformanceMetrics
)
from .performance_monitor import (
    PerformanceMonitor,
    PerformanceTarget,
    LoadTestScenario
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RoverTelemetrySimulator:
    """Simulate rover telemetry data for testing"""
    
    def __init__(self, frequency: int = 200):
        self.frequency = frequency
        self.running = False
        self._task: Optional[asyncio.Task] = None
        self.websocket_server: Optional[OptimizedWebSocketServer] = None
        
    def set_websocket_server(self, server: OptimizedWebSocketServer):
        """Set the WebSocket server for telemetry broadcasting"""
        self.websocket_server = server
        
    async def start(self):
        """Start generating simulated telemetry data"""
        if self.running:
            return
            
        self.running = True
        self._task = asyncio.create_task(self._generate_telemetry())
        logger.info(f"Rover telemetry simulator started at {self.frequency} Hz")
        
    async def stop(self):
        """Stop telemetry generation"""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Rover telemetry simulator stopped")
        
    async def _generate_telemetry(self):
        """Generate and broadcast telemetry data"""
        sequence = 0
        interval = 1.0 / self.frequency
        
        while self.running:
            try:
                # Generate realistic rover telemetry
                telemetry_data = self._create_telemetry_sample(sequence)
                
                # Broadcast via optimized WebSocket server
                if self.websocket_server:
                    # Use different priorities based on data criticality
                    priority = MessagePriority.CRITICAL if telemetry_data.get('emergency_stop') else MessagePriority.NORMAL
                    await self.websocket_server.broadcast_telemetry(telemetry_data, priority)
                
                sequence += 1
                await asyncio.sleep(interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Telemetry generation error: {e}")
                await asyncio.sleep(0.1)  # Brief pause on error
                
    def _create_telemetry_sample(self, sequence: int) -> Dict[str, Any]:
        """Create a realistic telemetry data sample"""
        import math
        import random
        
        # Simulate realistic rover data patterns
        t = time.time()
        
        return {
            "timestamp": t,
            "sequence": sequence,
            "battery": {
                "motor": {
                    "voltage": 24.0 + random.uniform(-1.0, 1.0),
                    "current": 5.0 + random.uniform(-2.0, 3.0),
                    "temperature": 35.0 + random.uniform(-5.0, 10.0)
                },
                "logic": {
                    "voltage": 12.0 + random.uniform(-0.5, 0.5),
                    "current": 1.2 + random.uniform(-0.5, 0.8),
                    "temperature": 30.0 + random.uniform(-3.0, 8.0)
                }
            },
            "wheels": {
                "fl": {"rpm": 100 + 50 * math.sin(t * 0.1) + random.uniform(-10, 10)},
                "fr": {"rpm": 100 + 50 * math.sin(t * 0.1) + random.uniform(-10, 10)},
                "rl": {"rpm": 100 + 50 * math.sin(t * 0.1) + random.uniform(-10, 10)},
                "rr": {"rpm": 100 + 50 * math.sin(t * 0.1) + random.uniform(-10, 10)}
            },
            "position": [
                10.0 + 5 * math.cos(t * 0.05),
                20.0 + 5 * math.sin(t * 0.05),
                0.5 + 0.2 * random.uniform(-1, 1)
            ],
            "orientation": {
                "roll": random.uniform(-5, 5),
                "pitch": random.uniform(-3, 3),
                "yaw": (t * 10) % 360
            },
            "sensors": {
                "imu": {
                    "accel_x": random.uniform(-2, 2),
                    "accel_y": random.uniform(-2, 2),
                    "accel_z": 9.81 + random.uniform(-0.5, 0.5),
                    "gyro_x": random.uniform(-10, 10),
                    "gyro_y": random.uniform(-10, 10),
                    "gyro_z": random.uniform(-20, 20)
                },
                "lidar_distance": 5.0 + 3.0 * random.random(),
                "camera_fps": 30,
                "gps": {
                    "latitude": 40.7128 + random.uniform(-0.001, 0.001),
                    "longitude": -74.0060 + random.uniform(-0.001, 0.001),
                    "altitude": 10.0 + random.uniform(-2, 2),
                    "satellites": random.randint(8, 12)
                }
            },
            "temperature": 25.0 + random.uniform(-5, 15),
            "emergency_stop": random.random() < 0.001,  # 0.1% chance
            "watchdog_triggered": random.random() < 0.0001,  # 0.01% chance
            "signal_strength": random.uniform(0.7, 1.0),
            "uptime_seconds": sequence / self.frequency
        }


async def create_optimized_rover_app() -> FastAPI:
    """Create FastAPI app with optimized WebSocket server and telemetry"""
    
    # Create FastAPI app
    app = FastAPI(
        title="Optimized Rover Mission Control",
        description="High-performance WebSocket telemetry system",
        version="1.0.0"
    )
    
    # Configure optimized WebSocket server
    config = OptimizedServerConfig(
        target_latency_ms=50.0,
        target_frequency_hz=200,
        max_connections=100,
        enable_batching=True,
        enable_compression=True,
        max_batch_size=50,
        max_batch_delay_ms=5,
        enable_performance_monitoring=True
    )
    
    # Create optimized WebSocket server
    websocket_server = await create_optimized_websocket_server(app, config)
    
    # Create telemetry simulator
    telemetry_simulator = RoverTelemetrySimulator(frequency=200)
    telemetry_simulator.set_websocket_server(websocket_server)
    
    # Create performance monitor
    performance_targets = PerformanceTarget(
        max_latency_p95_ms=50.0,
        min_message_rate_hz=200.0,
        max_dropped_message_rate=0.001,
        min_compression_ratio=1.5
    )
    
    performance_monitor = PerformanceMonitor(
        targets=performance_targets,
        benchmark_interval_minutes=30  # Run automated benchmarks every 30 minutes
    )
    
    # Add startup and shutdown events
    @app.on_event("startup")
    async def startup_event():
        """Initialize optimized systems on startup"""
        logger.info("Starting optimized rover mission control system...")
        
        # Start telemetry simulation
        await telemetry_simulator.start()
        
        # Start performance monitoring
        await performance_monitor.start_monitoring()
        
        # Register performance callback for real-time monitoring
        def on_performance_update(metrics: PerformanceMetrics):
            if metrics.average_latency_ms > 40:  # Warning threshold
                logger.warning(f"High latency detected: {metrics.average_latency_ms:.1f}ms")
                
        websocket_server.register_metrics_callback(on_performance_update)
        
        logger.info("Optimized rover mission control system ready!")
        logger.info(f"Target performance: <{config.target_latency_ms}ms latency, {config.target_frequency_hz} Hz")
        
    @app.on_event("shutdown")
    async def shutdown_event():
        """Clean shutdown of optimized systems"""
        logger.info("Shutting down optimized rover mission control system...")
        
        await telemetry_simulator.stop()
        await performance_monitor.stop_monitoring()
        
        logger.info("Shutdown complete")
    
    # API endpoints for performance monitoring
    @app.get("/api/performance/metrics")
    async def get_performance_metrics():
        """Get current performance metrics"""
        return websocket_server.get_performance_metrics()
        
    @app.get("/api/performance/connections")
    async def get_connection_stats():
        """Get detailed connection statistics"""
        return websocket_server.get_connection_stats()
        
    @app.get("/api/performance/backpressure")
    async def get_backpressure_status():
        """Get backpressure status"""
        return websocket_server.get_backpressure_status()
        
    @app.get("/api/performance/summary")
    async def get_performance_summary(hours: int = 24):
        """Get performance summary for the last N hours"""
        return performance_monitor.get_performance_summary(hours)
        
    @app.post("/api/performance/benchmark")
    async def run_benchmark():
        """Run comprehensive performance benchmark"""
        try:
            results = await performance_monitor.run_comprehensive_benchmark()
            return {"success": True, "results": results}
        except Exception as e:
            return {"success": False, "error": str(e)}
            
    @app.post("/api/telemetry/emergency")
    async def trigger_emergency_data():
        """Trigger high-priority emergency telemetry"""
        emergency_data = {
            "timestamp": time.time(),
            "type": "emergency",
            "emergency_stop": True,
            "reason": "Manual trigger via API",
            "location": [0, 0, 0],
            "battery_critical": True
        }
        
        await websocket_server.broadcast_telemetry(emergency_data, MessagePriority.CRITICAL)
        return {"success": True, "message": "Emergency telemetry broadcasted"}
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """System health check"""
        metrics = websocket_server.get_performance_metrics()
        connection_stats = websocket_server.get_connection_stats()
        
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "performance": {
                "latency_p95_ms": metrics.p95_latency_ms,
                "message_rate_hz": metrics.message_rate_hz,
                "target_latency_ms": config.target_latency_ms,
                "target_frequency_hz": config.target_frequency_hz
            },
            "connections": {
                "total": connection_stats['total_connections'],
                "max": config.max_connections
            },
            "issues": []
        }
        
        # Check for performance issues
        if metrics.p95_latency_ms > config.target_latency_ms:
            health_status["issues"].append(f"High latency: {metrics.p95_latency_ms:.1f}ms > {config.target_latency_ms}ms")
            health_status["status"] = "degraded"
            
        if metrics.message_rate_hz < config.target_frequency_hz * 0.8:
            health_status["issues"].append(f"Low message rate: {metrics.message_rate_hz:.1f} Hz < {config.target_frequency_hz * 0.8} Hz")
            health_status["status"] = "degraded"
            
        if metrics.dropped_messages > metrics.total_messages * 0.01:
            health_status["issues"].append(f"High drop rate: {metrics.dropped_messages} / {metrics.total_messages}")
            health_status["status"] = "unhealthy"
        
        return health_status
    
    return app


async def run_performance_demo():
    """Demonstrate the optimized WebSocket performance"""
    logger.info("=== WebSocket Performance Optimization Demo ===")
    
    # Create and run the optimized app
    app = await create_optimized_rover_app()
    
    logger.info("Starting optimized server on http://localhost:8000")
    logger.info("WebSocket endpoint: ws://localhost:8000/socket.io/")
    logger.info("Performance metrics: http://localhost:8000/api/performance/metrics")
    logger.info("Health check: http://localhost:8000/health")
    
    # Run the server
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=False,  # Reduce overhead
        loop="asyncio"
    )
    
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    print("🚀 Starting Optimized WebSocket Performance Demo")
    print(f"⚡ Performance Targets: <50ms latency, 200Hz telemetry")
    print(f"🔧 Features: Message batching, LZ4 compression, backpressure handling")
    print(f"📊 Monitoring: Real-time metrics, regression detection, automated benchmarks")
    print()
    
    try:
        asyncio.run(run_performance_demo())
    except KeyboardInterrupt:
        print("\n👋 Demo stopped by user")
    except Exception as e:
        print(f"❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()