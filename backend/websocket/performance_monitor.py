"""
Performance Monitor and Benchmarking Tool for WebSocket Optimization
Automated performance monitoring, regression detection, and load testing
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Optional, Any, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from pathlib import Path
import aiofiles
import statistics
from collections import deque, defaultdict

logger = logging.getLogger(__name__)


@dataclass
class PerformanceBenchmark:
    """Performance benchmark data point"""
    timestamp: float
    latency_p50: float
    latency_p95: float
    latency_p99: float
    message_rate_hz: float
    throughput_mbps: float
    connection_count: int
    dropped_messages: int
    compression_ratio: float
    cpu_usage_percent: float
    memory_usage_mb: float
    test_scenario: str
    duration_seconds: float


@dataclass
class PerformanceTarget:
    """Performance targets for regression detection"""
    max_latency_p95_ms: float = 50.0
    min_message_rate_hz: float = 200.0
    max_dropped_message_rate: float = 0.001  # 0.1%
    min_compression_ratio: float = 1.5
    max_cpu_usage_percent: float = 80.0
    max_memory_usage_mb: float = 512.0


@dataclass
class RegressionAlert:
    """Performance regression alert"""
    timestamp: float
    metric_name: str
    current_value: float
    target_value: float
    deviation_percent: float
    severity: str  # 'warning', 'critical'
    description: str


class PerformanceRegression:
    """Detect performance regressions using statistical analysis"""
    
    def __init__(self, window_size: int = 100, sensitivity: float = 2.0):
        self.window_size = window_size
        self.sensitivity = sensitivity  # Standard deviations for detection
        
        # Historical data windows
        self.latency_history = deque(maxlen=window_size)
        self.throughput_history = deque(maxlen=window_size)
        self.drop_rate_history = deque(maxlen=window_size)
        
        # Baseline statistics
        self.baselines: Dict[str, Dict[str, float]] = {}
        
    def add_measurement(self, benchmark: PerformanceBenchmark):
        """Add new performance measurement"""
        self.latency_history.append(benchmark.latency_p95)
        self.throughput_history.append(benchmark.message_rate_hz)
        
        drop_rate = benchmark.dropped_messages / max(benchmark.message_rate_hz * benchmark.duration_seconds, 1)
        self.drop_rate_history.append(drop_rate)
        
        # Update baselines if we have enough data
        if len(self.latency_history) >= 20:
            self._update_baselines()
            
    def _update_baselines(self):
        """Update baseline statistics for regression detection"""
        self.baselines = {
            'latency_p95': {
                'mean': statistics.mean(self.latency_history),
                'stdev': statistics.stdev(self.latency_history),
                'median': statistics.median(self.latency_history)
            },
            'message_rate': {
                'mean': statistics.mean(self.throughput_history),
                'stdev': statistics.stdev(self.throughput_history),
                'median': statistics.median(self.throughput_history)
            },
            'drop_rate': {
                'mean': statistics.mean(self.drop_rate_history),
                'stdev': statistics.stdev(self.drop_rate_history),
                'median': statistics.median(self.drop_rate_history)
            }
        }
        
    def detect_regression(self, benchmark: PerformanceBenchmark) -> List[RegressionAlert]:
        """Detect performance regressions in latest benchmark"""
        alerts = []
        
        if not self.baselines:
            return alerts
            
        # Check latency regression
        latency_baseline = self.baselines['latency_p95']
        if benchmark.latency_p95 > latency_baseline['mean'] + self.sensitivity * latency_baseline['stdev']:
            deviation = ((benchmark.latency_p95 - latency_baseline['mean']) / latency_baseline['mean']) * 100
            alerts.append(RegressionAlert(
                timestamp=benchmark.timestamp,
                metric_name='latency_p95',
                current_value=benchmark.latency_p95,
                target_value=latency_baseline['mean'],
                deviation_percent=deviation,
                severity='critical' if deviation > 50 else 'warning',
                description=f"P95 latency increased by {deviation:.1f}% from baseline"
            ))
            
        # Check throughput regression
        rate_baseline = self.baselines['message_rate']
        if benchmark.message_rate_hz < rate_baseline['mean'] - self.sensitivity * rate_baseline['stdev']:
            deviation = ((rate_baseline['mean'] - benchmark.message_rate_hz) / rate_baseline['mean']) * 100
            alerts.append(RegressionAlert(
                timestamp=benchmark.timestamp,
                metric_name='message_rate_hz',
                current_value=benchmark.message_rate_hz,
                target_value=rate_baseline['mean'],
                deviation_percent=deviation,
                severity='critical' if deviation > 25 else 'warning',
                description=f"Message rate decreased by {deviation:.1f}% from baseline"
            ))
            
        # Check drop rate regression
        current_drop_rate = benchmark.dropped_messages / max(benchmark.message_rate_hz * benchmark.duration_seconds, 1)
        drop_baseline = self.baselines['drop_rate']
        if current_drop_rate > drop_baseline['mean'] + self.sensitivity * drop_baseline['stdev']:
            deviation = ((current_drop_rate - drop_baseline['mean']) / max(drop_baseline['mean'], 0.001)) * 100
            alerts.append(RegressionAlert(
                timestamp=benchmark.timestamp,
                metric_name='drop_rate',
                current_value=current_drop_rate,
                target_value=drop_baseline['mean'],
                deviation_percent=deviation,
                severity='critical' if current_drop_rate > 0.01 else 'warning',
                description=f"Message drop rate increased by {deviation:.1f}% from baseline"
            ))
            
        return alerts


class LoadTestScenario:
    """Define load test scenarios for benchmarking"""
    
    def __init__(
        self,
        name: str,
        connection_count: int,
        message_rate_per_connection: int,
        duration_seconds: int,
        message_size_bytes: int = 1024,
        enable_compression: bool = True,
        ramp_up_time: int = 10
    ):
        self.name = name
        self.connection_count = connection_count
        self.message_rate_per_connection = message_rate_per_connection
        self.duration_seconds = duration_seconds
        self.message_size_bytes = message_size_bytes
        self.enable_compression = enable_compression
        self.ramp_up_time = ramp_up_time
        
    @property
    def total_message_rate(self) -> int:
        return self.connection_count * self.message_rate_per_connection


class WebSocketLoadTester:
    """Load testing tool for WebSocket performance benchmarking"""
    
    def __init__(self, server_url: str = "ws://localhost:8000"):
        self.server_url = server_url
        self.active_connections: List[Any] = []
        self.test_results: Dict[str, List[float]] = defaultdict(list)
        self.message_count = 0
        self.bytes_sent = 0
        self.dropped_messages = 0
        
    async def run_load_test(self, scenario: LoadTestScenario) -> PerformanceBenchmark:
        """Run a load test scenario and return performance benchmark"""
        logger.info(f"Starting load test: {scenario.name}")
        logger.info(f"Connections: {scenario.connection_count}, Rate: {scenario.total_message_rate} msg/s")
        
        start_time = time.time()
        
        # Create test message payload
        test_message = {
            "timestamp": 0,
            "test_data": "x" * (scenario.message_size_bytes - 100),  # Approximate size
            "sequence": 0,
            "scenario": scenario.name
        }
        
        try:
            # Ramp up connections
            await self._ramp_up_connections(scenario)
            
            # Run test for specified duration
            await self._run_test_messages(scenario, test_message)
            
            # Collect final metrics
            end_time = time.time()
            actual_duration = end_time - start_time
            
            # Calculate performance metrics
            benchmark = self._calculate_benchmark(scenario, actual_duration, start_time)
            
            logger.info(f"Load test completed: {scenario.name}")
            logger.info(f"P95 Latency: {benchmark.latency_p95:.1f}ms, Rate: {benchmark.message_rate_hz:.1f} Hz")
            
            return benchmark
            
        finally:
            await self._cleanup_connections()
            
    async def _ramp_up_connections(self, scenario: LoadTestScenario):
        """Gradually establish connections to avoid overwhelming the server"""
        import socketio
        
        connections_per_batch = max(1, scenario.connection_count // 10)
        delay_between_batches = scenario.ramp_up_time / 10
        
        for batch_start in range(0, scenario.connection_count, connections_per_batch):
            batch_end = min(batch_start + connections_per_batch, scenario.connection_count)
            
            # Create batch of connections
            batch_tasks = []
            for i in range(batch_start, batch_end):
                task = asyncio.create_task(self._create_connection(i))
                batch_tasks.append(task)
                
            # Wait for batch to connect
            try:
                await asyncio.gather(*batch_tasks, timeout=10)
            except asyncio.TimeoutError:
                logger.warning(f"Some connections in batch {batch_start}-{batch_end} failed to connect")
                
            # Delay before next batch
            if batch_end < scenario.connection_count:
                await asyncio.sleep(delay_between_batches)
                
        logger.info(f"Established {len(self.active_connections)} connections")
        
    async def _create_connection(self, connection_id: int):
        """Create a single WebSocket connection for load testing"""
        import socketio
        
        sio = socketio.AsyncClient(
            reconnection=False,  # Disable for cleaner test results
            logger=False,
            engineio_logger=False
        )
        
        # Track connection metrics
        connection_metrics = {
            'id': connection_id,
            'latencies': [],
            'messages_sent': 0,
            'messages_received': 0,
            'connect_time': None,
            'last_message_time': None
        }
        
        @sio.event
        async def connect():
            connection_metrics['connect_time'] = time.time()
            
        @sio.event
        async def telemetry_batch(data):
            connection_metrics['messages_received'] += data.get('message_count', 1)
            connection_metrics['last_message_time'] = time.time()
            
        @sio.event
        async def latency_response(data):
            if 'client_timestamp' in data:
                latency = (time.time() - data['client_timestamp']) * 1000
                connection_metrics['latencies'].append(latency)
                
        try:
            await sio.connect(self.server_url)
            
            # Subscribe to telemetry
            await sio.emit('subscribe_telemetry', {
                'channels': ['telemetry'],
                'frequency': 200,
                'enable_batching': True
            })
            
            self.active_connections.append((sio, connection_metrics))
            
        except Exception as e:
            logger.error(f"Failed to create connection {connection_id}: {e}")
            
    async def _run_test_messages(self, scenario: LoadTestScenario, test_message: Dict[str, Any]):
        """Send test messages at specified rate for the duration"""
        message_interval = 1.0 / scenario.message_rate_per_connection
        
        # Create message sending tasks for each connection
        tasks = []
        for sio, metrics in self.active_connections:
            task = asyncio.create_task(
                self._send_messages_for_connection(sio, metrics, test_message, message_interval, scenario.duration_seconds)
            )
            tasks.append(task)
            
        # Wait for all message sending to complete
        try:
            await asyncio.gather(*tasks, timeout=scenario.duration_seconds + 30)
        except asyncio.TimeoutError:
            logger.warning("Some message sending tasks timed out")
            
    async def _send_messages_for_connection(
        self, 
        sio: Any, 
        metrics: Dict[str, Any], 
        test_message: Dict[str, Any], 
        interval: float, 
        duration: float
    ):
        """Send messages for a single connection at specified interval"""
        start_time = time.time()
        sequence = 0
        
        while time.time() - start_time < duration:
            try:
                # Prepare message with current timestamp and sequence
                message = {
                    **test_message,
                    "timestamp": time.time(),
                    "sequence": sequence,
                    "connection_id": metrics['id']
                }
                
                # Send latency test message occasionally
                if sequence % 50 == 0:
                    await sio.emit('latency_test', {
                        'message_id': f"load_test_{metrics['id']}_{sequence}",
                        'timestamp': time.time()
                    })
                
                # Send telemetry message
                await sio.emit('telemetry', message)
                
                metrics['messages_sent'] += 1
                self.message_count += 1
                self.bytes_sent += len(json.dumps(message))
                sequence += 1
                
                # Wait for next interval
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Failed to send message on connection {metrics['id']}: {e}")
                self.dropped_messages += 1
                
    def _calculate_benchmark(self, scenario: LoadTestScenario, duration: float, start_time: float) -> PerformanceBenchmark:
        """Calculate performance benchmark from test results"""
        all_latencies = []
        total_messages_received = 0
        
        for sio, metrics in self.active_connections:
            all_latencies.extend(metrics['latencies'])
            total_messages_received += metrics['messages_received']
            
        # Calculate latency percentiles
        latency_p50 = statistics.median(all_latencies) if all_latencies else 0
        latency_p95 = statistics.quantiles(all_latencies, n=20)[18] if len(all_latencies) > 20 else (all_latencies[-1] if all_latencies else 0)
        latency_p99 = statistics.quantiles(all_latencies, n=100)[98] if len(all_latencies) > 100 else (all_latencies[-1] if all_latencies else 0)
        
        # Calculate throughput
        actual_message_rate = self.message_count / duration
        throughput_mbps = (self.bytes_sent / duration) / (1024 * 1024)
        
        # Estimate compression ratio (rough approximation)
        compression_ratio = scenario.message_size_bytes / max(self.bytes_sent / max(self.message_count, 1), 1)
        
        return PerformanceBenchmark(
            timestamp=start_time,
            latency_p50=latency_p50,
            latency_p95=latency_p95,
            latency_p99=latency_p99,
            message_rate_hz=actual_message_rate,
            throughput_mbps=throughput_mbps,
            connection_count=len(self.active_connections),
            dropped_messages=self.dropped_messages,
            compression_ratio=compression_ratio,
            cpu_usage_percent=0.0,  # Would need system monitoring
            memory_usage_mb=0.0,    # Would need system monitoring
            test_scenario=scenario.name,
            duration_seconds=duration
        )
        
    async def _cleanup_connections(self):
        """Clean up all test connections"""
        cleanup_tasks = []
        
        for sio, metrics in self.active_connections:
            cleanup_tasks.append(asyncio.create_task(self._cleanup_connection(sio)))
            
        if cleanup_tasks:
            try:
                await asyncio.gather(*cleanup_tasks, timeout=10)
            except asyncio.TimeoutError:
                logger.warning("Some connections failed to cleanup properly")
                
        self.active_connections.clear()
        
    async def _cleanup_connection(self, sio: Any):
        """Clean up a single connection"""
        try:
            await sio.disconnect()
        except Exception as e:
            logger.error(f"Error cleaning up connection: {e}")


class PerformanceMonitor:
    """Automated performance monitoring and regression detection"""
    
    def __init__(
        self,
        targets: Optional[PerformanceTarget] = None,
        data_retention_days: int = 30,
        benchmark_interval_minutes: int = 60
    ):
        self.targets = targets or PerformanceTarget()
        self.data_retention_days = data_retention_days
        self.benchmark_interval_minutes = benchmark_interval_minutes
        
        # Initialize components
        self.regression_detector = PerformanceRegression()
        self.load_tester = WebSocketLoadTester()
        
        # Performance history
        self.benchmark_history: List[PerformanceBenchmark] = []
        self.alert_history: List[RegressionAlert] = []
        
        # Monitoring state
        self._monitoring_task: Optional[asyncio.Task] = None
        self._running = False
        
        # Data persistence
        self.data_dir = Path("performance_data")
        self.data_dir.mkdir(exist_ok=True)
        
    async def start_monitoring(self):
        """Start automated performance monitoring"""
        if self._running:
            return
            
        self._running = True
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())
        
        logger.info("Performance monitoring started")
        
    async def stop_monitoring(self):
        """Stop performance monitoring"""
        self._running = False
        
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass
                
        logger.info("Performance monitoring stopped")
        
    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self._running:
            try:
                # Run automated benchmark
                benchmark = await self._run_automated_benchmark()
                
                # Add to history and detect regressions
                self.benchmark_history.append(benchmark)
                self.regression_detector.add_measurement(benchmark)
                
                # Check for regressions
                alerts = self.regression_detector.detect_regression(benchmark)
                self.alert_history.extend(alerts)
                
                # Check against absolute targets
                target_alerts = self._check_absolute_targets(benchmark)
                self.alert_history.extend(target_alerts)
                
                # Log alerts
                for alert in alerts + target_alerts:
                    if alert.severity == 'critical':
                        logger.error(f"CRITICAL: {alert.description}")
                    else:
                        logger.warning(f"WARNING: {alert.description}")
                        
                # Save data
                await self._save_benchmark_data(benchmark)
                
                # Clean up old data
                await self._cleanup_old_data()
                
                # Wait for next benchmark
                await asyncio.sleep(self.benchmark_interval_minutes * 60)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                await asyncio.sleep(60)  # Short retry delay
                
    async def _run_automated_benchmark(self) -> PerformanceBenchmark:
        """Run automated benchmark test"""
        # Use a moderate load test scenario for monitoring
        scenario = LoadTestScenario(
            name="automated_monitoring",
            connection_count=10,
            message_rate_per_connection=20,  # 200 Hz total
            duration_seconds=30,
            message_size_bytes=512
        )
        
        return await self.load_tester.run_load_test(scenario)
        
    def _check_absolute_targets(self, benchmark: PerformanceBenchmark) -> List[RegressionAlert]:
        """Check benchmark against absolute performance targets"""
        alerts = []
        
        # Check latency target
        if benchmark.latency_p95 > self.targets.max_latency_p95_ms:
            alerts.append(RegressionAlert(
                timestamp=benchmark.timestamp,
                metric_name='latency_p95',
                current_value=benchmark.latency_p95,
                target_value=self.targets.max_latency_p95_ms,
                deviation_percent=((benchmark.latency_p95 - self.targets.max_latency_p95_ms) / self.targets.max_latency_p95_ms) * 100,
                severity='critical',
                description=f"P95 latency {benchmark.latency_p95:.1f}ms exceeds target {self.targets.max_latency_p95_ms}ms"
            ))
            
        # Check message rate target
        if benchmark.message_rate_hz < self.targets.min_message_rate_hz:
            alerts.append(RegressionAlert(
                timestamp=benchmark.timestamp,
                metric_name='message_rate_hz',
                current_value=benchmark.message_rate_hz,
                target_value=self.targets.min_message_rate_hz,
                deviation_percent=((self.targets.min_message_rate_hz - benchmark.message_rate_hz) / self.targets.min_message_rate_hz) * 100,
                severity='critical',
                description=f"Message rate {benchmark.message_rate_hz:.1f} Hz below target {self.targets.min_message_rate_hz} Hz"
            ))
            
        return alerts
        
    async def _save_benchmark_data(self, benchmark: PerformanceBenchmark):
        """Save benchmark data to disk"""
        date_str = datetime.fromtimestamp(benchmark.timestamp).strftime("%Y-%m-%d")
        file_path = self.data_dir / f"benchmarks_{date_str}.jsonl"
        
        benchmark_json = json.dumps(asdict(benchmark))
        
        async with aiofiles.open(file_path, "a") as f:
            await f.write(benchmark_json + "\n")
            
    async def _cleanup_old_data(self):
        """Remove old benchmark data files"""
        cutoff_date = datetime.now() - timedelta(days=self.data_retention_days)
        
        for file_path in self.data_dir.glob("benchmarks_*.jsonl"):
            try:
                file_date_str = file_path.stem.split("_")[1]
                file_date = datetime.strptime(file_date_str, "%Y-%m-%d")
                
                if file_date < cutoff_date:
                    file_path.unlink()
                    logger.info(f"Cleaned up old benchmark file: {file_path}")
                    
            except (ValueError, IndexError):
                # Skip files with unexpected names
                continue
                
    async def run_comprehensive_benchmark(self) -> Dict[str, PerformanceBenchmark]:
        """Run comprehensive benchmark suite"""
        scenarios = [
            LoadTestScenario("low_load", 5, 10, 60),
            LoadTestScenario("normal_load", 10, 20, 60),
            LoadTestScenario("high_load", 20, 20, 60),
            LoadTestScenario("stress_test", 50, 10, 120),
            LoadTestScenario("burst_test", 10, 100, 30),
        ]
        
        results = {}
        
        for scenario in scenarios:
            logger.info(f"Running benchmark scenario: {scenario.name}")
            try:
                benchmark = await self.load_tester.run_load_test(scenario)
                results[scenario.name] = benchmark
                
                # Brief pause between scenarios
                await asyncio.sleep(10)
                
            except Exception as e:
                logger.error(f"Benchmark scenario {scenario.name} failed: {e}")
                
        return results
        
    def get_performance_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance summary for the last N hours"""
        cutoff_time = time.time() - (hours * 3600)
        recent_benchmarks = [b for b in self.benchmark_history if b.timestamp >= cutoff_time]
        
        if not recent_benchmarks:
            return {"error": "No recent benchmark data"}
            
        # Calculate summary statistics
        latencies = [b.latency_p95 for b in recent_benchmarks]
        rates = [b.message_rate_hz for b in recent_benchmarks]
        
        summary = {
            "time_period_hours": hours,
            "benchmark_count": len(recent_benchmarks),
            "latency_p95": {
                "min": min(latencies),
                "max": max(latencies),
                "avg": statistics.mean(latencies),
                "median": statistics.median(latencies)
            },
            "message_rate_hz": {
                "min": min(rates),
                "max": max(rates),
                "avg": statistics.mean(rates),
                "median": statistics.median(rates)
            },
            "alerts_count": len([a for a in self.alert_history if a.timestamp >= cutoff_time]),
            "target_compliance": {
                "latency_violations": sum(1 for b in recent_benchmarks if b.latency_p95 > self.targets.max_latency_p95_ms),
                "rate_violations": sum(1 for b in recent_benchmarks if b.message_rate_hz < self.targets.min_message_rate_hz)
            }
        }
        
        return summary