"""
Hardware Diagnostics and Capability Reporting System
Provides comprehensive diagnostics tools for all protocol adapters
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Tuple
from enum import Enum
import json
import statistics
import time

from .base import ProtocolAdapter, ProtocolType, ConnectionState, DataPacket

logger = logging.getLogger(__name__)


class DiagnosticLevel(Enum):
    """Diagnostic test levels"""
    BASIC = "basic"          # Connection and basic I/O
    STANDARD = "standard"    # Performance and error rate tests
    COMPREHENSIVE = "comprehensive"  # Full suite including stress tests
    CUSTOM = "custom"        # User-defined test sets


class HealthStatus(Enum):
    """Device health status levels"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class TestResult(Enum):
    """Individual test result status"""
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    SKIPPED = "skipped"
    ERROR = "error"


@dataclass
class DiagnosticTest:
    """Represents a single diagnostic test"""
    test_id: str
    name: str
    description: str
    category: str
    level: DiagnosticLevel
    timeout: float = 30.0
    critical: bool = False  # If true, failure affects overall health
    
    async def run(self, adapter: ProtocolAdapter, context: Dict[str, Any]) -> 'DiagnosticResult':
        """Run the diagnostic test"""
        raise NotImplementedError("Test must implement run method")


@dataclass
class DiagnosticResult:
    """Result of a diagnostic test"""
    test_id: str
    test_name: str
    status: TestResult
    duration: float  # seconds
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.utcnow)
    error: Optional[str] = None


@dataclass
class CommunicationMetrics:
    """Communication quality metrics"""
    latency_avg: float  # Average latency in ms
    latency_min: float
    latency_max: float
    latency_std: float
    
    throughput_tx: float  # Bytes per second
    throughput_rx: float
    
    error_rate: float  # Errors per 100 transmissions
    packet_loss_rate: float
    
    successful_transmissions: int
    failed_transmissions: int
    total_bytes_sent: int
    total_bytes_received: int
    
    uptime: timedelta
    last_error: Optional[str] = None
    measurement_duration: float = 0.0  # seconds


@dataclass
class DeviceCapability:
    """Represents a device capability"""
    capability_id: str
    name: str
    category: str
    supported: bool
    version: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)
    limitations: List[str] = field(default_factory=list)


@dataclass
class DeviceCapabilities:
    """Complete device capability report"""
    device_id: str
    device_name: str
    protocol_type: ProtocolType
    firmware_version: Optional[str] = None
    hardware_version: Optional[str] = None
    
    # Communication capabilities
    max_baud_rate: Optional[int] = None
    supported_protocols: List[str] = field(default_factory=list)
    buffer_size: Optional[int] = None
    
    # Feature capabilities
    capabilities: List[DeviceCapability] = field(default_factory=list)
    
    # Performance limits
    max_throughput: Optional[float] = None  # Bytes per second
    max_packet_size: Optional[int] = None
    min_response_time: Optional[float] = None  # milliseconds
    
    # Additional metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DiagnosticReport:
    """Complete diagnostic report for a device"""
    device_id: str
    device_name: str
    protocol_type: ProtocolType
    
    # Overall status
    health_status: HealthStatus
    health_score: float  # 0.0 to 1.0
    
    # Test results
    test_results: List[DiagnosticResult] = field(default_factory=list)
    tests_passed: int = 0
    tests_failed: int = 0
    tests_warning: int = 0
    
    # Communication metrics
    metrics: Optional[CommunicationMetrics] = None
    
    # Capabilities
    capabilities: Optional[DeviceCapabilities] = None
    
    # Troubleshooting
    issues_detected: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    # Metadata
    diagnostic_level: DiagnosticLevel = DiagnosticLevel.STANDARD
    duration: float = 0.0  # Total diagnostic time in seconds
    timestamp: datetime = field(default_factory=datetime.utcnow)
    
    def to_json(self) -> str:
        """Convert report to JSON format"""
        def serialize(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            elif isinstance(obj, timedelta):
                return obj.total_seconds()
            elif isinstance(obj, Enum):
                return obj.value
            elif hasattr(obj, '__dict__'):
                return obj.__dict__
            return str(obj)
        
        return json.dumps(self.__dict__, default=serialize, indent=2)


class DiagnosticManager:
    """
    Manages diagnostics for protocol adapters
    Coordinates test execution and report generation
    """
    
    def __init__(self):
        self._tests: Dict[str, DiagnosticTest] = {}
        self._test_suites: Dict[DiagnosticLevel, List[str]] = {
            DiagnosticLevel.BASIC: [],
            DiagnosticLevel.STANDARD: [],
            DiagnosticLevel.COMPREHENSIVE: [],
            DiagnosticLevel.CUSTOM: []
        }
        self._initialize_default_tests()
    
    def _initialize_default_tests(self):
        """Initialize default diagnostic tests"""
        # Basic connectivity test
        self.register_test(
            ConnectionHealthTest(
                test_id="conn_health",
                name="Connection Health",
                description="Verify basic connection status and responsiveness",
                category="connectivity",
                level=DiagnosticLevel.BASIC,
                critical=True
            )
        )
        
        # Latency test
        self.register_test(
            LatencyTest(
                test_id="latency",
                name="Latency Measurement",
                description="Measure round-trip communication latency",
                category="performance",
                level=DiagnosticLevel.STANDARD
            )
        )
        
        # Throughput test
        self.register_test(
            ThroughputTest(
                test_id="throughput",
                name="Throughput Test",
                description="Measure data transfer rates",
                category="performance",
                level=DiagnosticLevel.STANDARD
            )
        )
        
        # Error rate test
        self.register_test(
            ErrorRateTest(
                test_id="error_rate",
                name="Error Rate Analysis",
                description="Analyze communication error rates",
                category="reliability",
                level=DiagnosticLevel.STANDARD
            )
        )
        
        # Buffer test
        self.register_test(
            BufferTest(
                test_id="buffer",
                name="Buffer Capacity",
                description="Test buffer limits and overflow handling",
                category="limits",
                level=DiagnosticLevel.COMPREHENSIVE
            )
        )
    
    def register_test(self, test: DiagnosticTest):
        """Register a diagnostic test"""
        self._tests[test.test_id] = test
        self._test_suites[test.level].append(test.test_id)
    
    async def run_diagnostics(
        self,
        adapter: ProtocolAdapter,
        level: DiagnosticLevel = DiagnosticLevel.STANDARD,
        test_ids: Optional[List[str]] = None,
        progress_callback: Optional[Callable[[str, float], None]] = None
    ) -> DiagnosticReport:
        """
        Run diagnostics on a protocol adapter
        
        Args:
            adapter: The protocol adapter to diagnose
            level: Diagnostic level to run
            test_ids: Specific test IDs to run (overrides level)
            progress_callback: Callback for progress updates (message, percentage)
        
        Returns:
            Complete diagnostic report
        """
        start_time = time.time()
        
        # Initialize report
        report = DiagnosticReport(
            device_id=adapter.config.name,
            device_name=adapter.config.name,
            protocol_type=adapter.protocol_type,
            health_status=HealthStatus.UNKNOWN,
            health_score=0.0,
            diagnostic_level=level
        )
        
        # Determine tests to run
        if test_ids:
            tests_to_run = [self._tests[tid] for tid in test_ids if tid in self._tests]
        else:
            tests_to_run = self._get_tests_for_level(level)
        
        total_tests = len(tests_to_run)
        context = {"adapter": adapter, "report": report}
        
        # Run tests
        for idx, test in enumerate(tests_to_run):
            if progress_callback:
                progress = (idx / total_tests) * 100
                progress_callback(f"Running {test.name}...", progress)
            
            try:
                result = await test.run(adapter, context)
                report.test_results.append(result)
                
                # Update counters
                if result.status == TestResult.PASSED:
                    report.tests_passed += 1
                elif result.status == TestResult.FAILED:
                    report.tests_failed += 1
                elif result.status == TestResult.WARNING:
                    report.tests_warning += 1
                
            except Exception as e:
                logger.error(f"Test {test.test_id} failed with error: {e}")
                report.test_results.append(DiagnosticResult(
                    test_id=test.test_id,
                    test_name=test.name,
                    status=TestResult.ERROR,
                    duration=0.0,
                    message=f"Test error: {str(e)}",
                    error=str(e)
                ))
        
        # Collect metrics
        report.metrics = await self._collect_metrics(adapter)
        
        # Get capabilities
        report.capabilities = await self._get_capabilities(adapter)
        
        # Calculate health status
        report.health_status, report.health_score = self._calculate_health(report)
        
        # Generate recommendations
        report.recommendations = self._generate_recommendations(report)
        
        # Set duration
        report.duration = time.time() - start_time
        
        if progress_callback:
            progress_callback("Diagnostics complete", 100)
        
        return report
    
    def _get_tests_for_level(self, level: DiagnosticLevel) -> List[DiagnosticTest]:
        """Get tests for a specific diagnostic level"""
        tests = []
        
        # Include all tests up to the specified level
        if level in [DiagnosticLevel.BASIC, DiagnosticLevel.STANDARD, DiagnosticLevel.COMPREHENSIVE]:
            tests.extend([self._tests[tid] for tid in self._test_suites[DiagnosticLevel.BASIC]])
            
        if level in [DiagnosticLevel.STANDARD, DiagnosticLevel.COMPREHENSIVE]:
            tests.extend([self._tests[tid] for tid in self._test_suites[DiagnosticLevel.STANDARD]])
            
        if level == DiagnosticLevel.COMPREHENSIVE:
            tests.extend([self._tests[tid] for tid in self._test_suites[DiagnosticLevel.COMPREHENSIVE]])
        
        return tests
    
    async def _collect_metrics(self, adapter: ProtocolAdapter) -> CommunicationMetrics:
        """Collect communication metrics from adapter"""
        stats = adapter.get_statistics()
        
        # Calculate uptime
        if adapter.status.connected_at:
            uptime = datetime.utcnow() - adapter.status.connected_at
        else:
            uptime = timedelta(0)
        
        # Basic metrics from adapter stats
        metrics = CommunicationMetrics(
            latency_avg=0.0,  # Will be populated by latency test
            latency_min=0.0,
            latency_max=0.0,
            latency_std=0.0,
            throughput_tx=0.0,  # Will be populated by throughput test
            throughput_rx=0.0,
            error_rate=0.0,
            packet_loss_rate=0.0,
            successful_transmissions=0,
            failed_transmissions=stats.get('error_count', 0),
            total_bytes_sent=stats.get('bytes_sent', 0),
            total_bytes_received=stats.get('bytes_received', 0),
            uptime=uptime,
            last_error=stats.get('last_error')
        )
        
        return metrics
    
    async def _get_capabilities(self, adapter: ProtocolAdapter) -> DeviceCapabilities:
        """Get device capabilities"""
        caps = DeviceCapabilities(
            device_id=adapter.config.name,
            device_name=adapter.config.name,
            protocol_type=adapter.protocol_type
        )
        
        # Protocol-specific capability detection
        if hasattr(adapter, 'get_capabilities'):
            try:
                device_caps = await adapter.get_capabilities()
                caps.capabilities.extend(device_caps)
            except:
                pass
        
        # Add common capabilities based on protocol type
        caps.capabilities.extend(self._get_protocol_capabilities(adapter.protocol_type))
        
        return caps
    
    def _get_protocol_capabilities(self, protocol_type: ProtocolType) -> List[DeviceCapability]:
        """Get standard capabilities for a protocol type"""
        capabilities = []
        
        if protocol_type == ProtocolType.SERIAL:
            capabilities.extend([
                DeviceCapability(
                    capability_id="serial.baudrate",
                    name="Configurable Baud Rate",
                    category="communication",
                    supported=True,
                    parameters={"rates": [9600, 19200, 38400, 57600, 115200]}
                ),
                DeviceCapability(
                    capability_id="serial.flow_control",
                    name="Flow Control",
                    category="communication",
                    supported=True,
                    parameters={"modes": ["none", "hardware", "software"]}
                )
            ])
        
        elif protocol_type == ProtocolType.I2C:
            capabilities.append(
                DeviceCapability(
                    capability_id="i2c.clock_speed",
                    name="Clock Speed Configuration",
                    category="communication",
                    supported=True,
                    parameters={"speeds": [100000, 400000, 1000000, 3400000]}
                )
            )
        
        # Add more protocol-specific capabilities as needed
        
        return capabilities
    
    def _calculate_health(self, report: DiagnosticReport) -> Tuple[HealthStatus, float]:
        """Calculate overall health status and score"""
        if not report.test_results:
            return HealthStatus.UNKNOWN, 0.0
        
        # Calculate base score
        total_tests = len(report.test_results)
        passed_weight = report.tests_passed * 1.0
        warning_weight = report.tests_warning * 0.7
        failed_weight = report.tests_failed * 0.0
        
        score = (passed_weight + warning_weight + failed_weight) / total_tests
        
        # Check critical tests
        critical_failed = any(
            r.status == TestResult.FAILED 
            for r in report.test_results 
            if r.test_id in ['conn_health']  # Add more critical test IDs
        )
        
        if critical_failed:
            return HealthStatus.CRITICAL, score * 0.5
        
        # Determine status based on score
        if score >= 0.9:
            status = HealthStatus.HEALTHY
        elif score >= 0.7:
            status = HealthStatus.WARNING
        else:
            status = HealthStatus.CRITICAL
        
        return status, score
    
    def _generate_recommendations(self, report: DiagnosticReport) -> List[str]:
        """Generate troubleshooting recommendations based on report"""
        recommendations = []
        
        # Check for connection issues
        conn_test = next((r for r in report.test_results if r.test_id == "conn_health"), None)
        if conn_test and conn_test.status != TestResult.PASSED:
            recommendations.append("Check physical connections and cable integrity")
            recommendations.append("Verify device power and proper grounding")
        
        # Check for performance issues
        if report.metrics:
            if report.metrics.error_rate > 5.0:
                recommendations.append("High error rate detected - check for interference or signal quality issues")
            
            if report.metrics.latency_avg > 100:
                recommendations.append("High latency detected - consider reducing communication distance or checking for bottlenecks")
        
        # Protocol-specific recommendations
        if report.protocol_type == ProtocolType.SERIAL:
            recommendations.append("Ensure baud rate matches device configuration")
            recommendations.append("Check flow control settings if experiencing data loss")
        
        return recommendations


# Concrete diagnostic test implementations

class ConnectionHealthTest(DiagnosticTest):
    """Test basic connection health"""
    
    async def run(self, adapter: ProtocolAdapter, context: Dict[str, Any]) -> DiagnosticResult:
        start_time = time.time()
        
        try:
            if not adapter.is_connected:
                return DiagnosticResult(
                    test_id=self.test_id,
                    test_name=self.name,
                    status=TestResult.FAILED,
                    duration=time.time() - start_time,
                    message="Adapter not connected",
                    details={"connected": False}
                )
            
            # Try a simple echo test if supported
            if hasattr(adapter, 'echo_test'):
                success = await adapter.echo_test()
                status = TestResult.PASSED if success else TestResult.FAILED
                message = "Echo test successful" if success else "Echo test failed"
            else:
                # Just check connection state
                status = TestResult.PASSED
                message = "Connection active"
            
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=status,
                duration=time.time() - start_time,
                message=message,
                details={
                    "connected": True,
                    "state": adapter.status.state.value
                }
            )
            
        except Exception as e:
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.ERROR,
                duration=time.time() - start_time,
                message=f"Test error: {str(e)}",
                error=str(e)
            )


class LatencyTest(DiagnosticTest):
    """Measure communication latency"""
    
    async def run(self, adapter: ProtocolAdapter, context: Dict[str, Any]) -> DiagnosticResult:
        start_time = time.time()
        latencies = []
        
        try:
            # Perform multiple ping tests
            test_count = 10
            test_data = b'\x01\x02\x03\x04'  # Simple test pattern
            
            for _ in range(test_count):
                ping_start = time.time()
                
                # Send and receive echo
                await adapter.write(test_data)
                response = await adapter.read(len(test_data), timeout=1.0)
                
                ping_time = (time.time() - ping_start) * 1000  # Convert to ms
                latencies.append(ping_time)
                
                await asyncio.sleep(0.1)  # Small delay between tests
            
            # Calculate statistics
            avg_latency = statistics.mean(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            std_latency = statistics.stdev(latencies) if len(latencies) > 1 else 0
            
            # Update metrics in context
            if context["report"].metrics:
                context["report"].metrics.latency_avg = avg_latency
                context["report"].metrics.latency_min = min_latency
                context["report"].metrics.latency_max = max_latency
                context["report"].metrics.latency_std = std_latency
            
            # Determine status
            if avg_latency < 10:
                status = TestResult.PASSED
                message = f"Excellent latency: {avg_latency:.2f}ms"
            elif avg_latency < 50:
                status = TestResult.PASSED
                message = f"Good latency: {avg_latency:.2f}ms"
            elif avg_latency < 100:
                status = TestResult.WARNING
                message = f"Moderate latency: {avg_latency:.2f}ms"
            else:
                status = TestResult.FAILED
                message = f"High latency: {avg_latency:.2f}ms"
            
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=status,
                duration=time.time() - start_time,
                message=message,
                details={
                    "average_ms": avg_latency,
                    "min_ms": min_latency,
                    "max_ms": max_latency,
                    "std_dev_ms": std_latency,
                    "samples": test_count
                }
            )
            
        except Exception as e:
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.ERROR,
                duration=time.time() - start_time,
                message=f"Latency test failed: {str(e)}",
                error=str(e)
            )


class ThroughputTest(DiagnosticTest):
    """Measure data throughput"""
    
    async def run(self, adapter: ProtocolAdapter, context: Dict[str, Any]) -> DiagnosticResult:
        start_time = time.time()
        
        try:
            # Test different packet sizes
            packet_sizes = [64, 256, 1024, 4096]
            tx_rates = []
            rx_rates = []
            
            for size in packet_sizes:
                # Generate test data
                test_data = bytes(range(256)) * (size // 256 + 1)
                test_data = test_data[:size]
                
                # Transmit test
                tx_start = time.time()
                await adapter.write(test_data)
                tx_time = time.time() - tx_start
                tx_rate = size / tx_time if tx_time > 0 else 0
                tx_rates.append(tx_rate)
                
                # Receive test (if echo is available)
                try:
                    rx_start = time.time()
                    response = await adapter.read(size, timeout=2.0)
                    rx_time = time.time() - rx_start
                    rx_rate = len(response.data) / rx_time if rx_time > 0 else 0
                    rx_rates.append(rx_rate)
                except:
                    rx_rates.append(0)
                
                await asyncio.sleep(0.1)
            
            # Calculate average rates
            avg_tx_rate = statistics.mean(tx_rates)
            avg_rx_rate = statistics.mean(rx_rates) if any(rx_rates) else 0
            
            # Update metrics
            if context["report"].metrics:
                context["report"].metrics.throughput_tx = avg_tx_rate
                context["report"].metrics.throughput_rx = avg_rx_rate
            
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.PASSED,
                duration=time.time() - start_time,
                message=f"TX: {avg_tx_rate/1024:.2f} KB/s, RX: {avg_rx_rate/1024:.2f} KB/s",
                details={
                    "tx_rate_bps": avg_tx_rate,
                    "rx_rate_bps": avg_rx_rate,
                    "packet_sizes_tested": packet_sizes
                }
            )
            
        except Exception as e:
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.ERROR,
                duration=time.time() - start_time,
                message=f"Throughput test failed: {str(e)}",
                error=str(e)
            )


class ErrorRateTest(DiagnosticTest):
    """Test communication error rates"""
    
    async def run(self, adapter: ProtocolAdapter, context: Dict[str, Any]) -> DiagnosticResult:
        start_time = time.time()
        
        try:
            # Get current error statistics
            stats = adapter.get_statistics()
            error_count = stats.get('error_count', 0)
            bytes_sent = stats.get('bytes_sent', 0)
            bytes_received = stats.get('bytes_received', 0)
            
            # Calculate error rate
            total_operations = (bytes_sent + bytes_received) / 100  # Approximate operations
            error_rate = (error_count / total_operations * 100) if total_operations > 0 else 0
            
            # Update metrics
            if context["report"].metrics:
                context["report"].metrics.error_rate = error_rate
            
            # Determine status
            if error_rate < 0.1:
                status = TestResult.PASSED
                message = f"Excellent reliability: {error_rate:.3f}% error rate"
            elif error_rate < 1.0:
                status = TestResult.PASSED
                message = f"Good reliability: {error_rate:.3f}% error rate"
            elif error_rate < 5.0:
                status = TestResult.WARNING
                message = f"Moderate error rate: {error_rate:.3f}%"
            else:
                status = TestResult.FAILED
                message = f"High error rate: {error_rate:.3f}%"
            
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=status,
                duration=time.time() - start_time,
                message=message,
                details={
                    "error_rate_percent": error_rate,
                    "total_errors": error_count,
                    "bytes_transmitted": bytes_sent + bytes_received
                }
            )
            
        except Exception as e:
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.ERROR,
                duration=time.time() - start_time,
                message=f"Error rate test failed: {str(e)}",
                error=str(e)
            )


class BufferTest(DiagnosticTest):
    """Test buffer capacity and limits"""
    
    async def run(self, adapter: ProtocolAdapter, context: Dict[str, Any]) -> DiagnosticResult:
        start_time = time.time()
        
        try:
            # Test increasing buffer sizes
            max_successful_size = 0
            test_sizes = [64, 128, 256, 512, 1024, 2048, 4096, 8192]
            
            for size in test_sizes:
                try:
                    test_data = bytes(range(256)) * (size // 256 + 1)
                    test_data = test_data[:size]
                    
                    await adapter.write(test_data)
                    max_successful_size = size
                    
                except Exception:
                    break
                
                await asyncio.sleep(0.1)
            
            # Update capabilities
            if context["report"].capabilities:
                context["report"].capabilities.buffer_size = max_successful_size
                context["report"].capabilities.max_packet_size = max_successful_size
            
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.PASSED,
                duration=time.time() - start_time,
                message=f"Maximum buffer size: {max_successful_size} bytes",
                details={
                    "max_buffer_size": max_successful_size,
                    "sizes_tested": test_sizes[:test_sizes.index(max_successful_size) + 1]
                }
            )
            
        except Exception as e:
            return DiagnosticResult(
                test_id=self.test_id,
                test_name=self.name,
                status=TestResult.ERROR,
                duration=time.time() - start_time,
                message=f"Buffer test failed: {str(e)}",
                error=str(e)
            )


# Diagnostic command sets for protocols

class DiagnosticCommands:
    """Protocol-specific diagnostic command sets"""
    
    @staticmethod
    def get_serial_commands() -> Dict[str, bytes]:
        """Get diagnostic commands for serial protocol"""
        return {
            "echo_test": b"AT\r\n",  # Standard AT command echo
            "version": b"AT+VERSION\r\n",
            "status": b"AT+STATUS\r\n",
            "reset": b"AT+RST\r\n",
            "loopback": b"AT+LOOPBACK\r\n"
        }
    
    @staticmethod
    def get_i2c_commands() -> Dict[str, List[int]]:
        """Get diagnostic commands for I2C protocol"""
        return {
            "who_am_i": [0x0F],  # Common WHO_AM_I register
            "status": [0x00],    # Status register
            "reset": [0xFF, 0x00],  # Soft reset command
            "self_test": [0x10, 0x01]  # Self-test enable
        }
    
    @staticmethod
    def get_spi_commands() -> Dict[str, bytes]:
        """Get diagnostic commands for SPI protocol"""
        return {
            "read_id": b"\x9F",  # Read device ID
            "status": b"\x05",   # Read status register
            "reset": b"\x66\x99",  # Reset sequence
            "self_test": b"\xAB"  # Self-test command
        }
    
    @staticmethod
    def get_can_commands() -> Dict[str, Dict[str, Any]]:
        """Get diagnostic commands for CAN protocol"""
        return {
            "status_request": {"id": 0x7DF, "data": [0x01, 0x00]},
            "version_request": {"id": 0x7DF, "data": [0x09, 0x02]},
            "reset": {"id": 0x7DF, "data": [0x11, 0x01]},
            "self_test": {"id": 0x7DF, "data": [0x19, 0x01]}
        }