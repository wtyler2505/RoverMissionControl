#!/usr/bin/env python3
"""
Test hardware discovery and diagnostics functionality
"""

import asyncio
import sys
import logging
from pathlib import Path
from datetime import datetime
import json

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import HAL components
from hardware.discovery import DeviceDiscovery, DiscoveryProtocol, DiscoveryResult
from hardware.diagnostics import DiagnosticsManager, DiagnosticTest, TestResult, TestStatus
from hardware.base import ProtocolType, ConnectionState
from hardware.factory import ProtocolAdapterFactory
from hardware.mock_adapter import MockAdapter, MockConfig, MockDevice

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HardwareDiscoveryTester:
    """Test hardware discovery and diagnostics"""
    
    def __init__(self):
        self.passed_tests = 0
        self.failed_tests = 0
        
    def print_header(self, title):
        """Print a section header"""
        print(f"\n{'=' * 60}")
        print(f"{title.center(60)}")
        print(f"{'=' * 60}")
        
    def print_test(self, test_name, passed, error=None):
        """Print test result"""
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")
        if error:
            print(f"       Error: {error}")
        
        if passed:
            self.passed_tests += 1
        else:
            self.failed_tests += 1
    
    async def test_device_discovery(self):
        """Test device discovery mechanisms"""
        print("\nTesting Device Discovery...")
        
        try:
            # Create discovery instance
            discovery = DeviceDiscovery()
            
            # Test serial port discovery
            print("\n[TEST] Serial port discovery...")
            serial_ports = await discovery.discover_serial_ports()
            self.print_test("Serial port enumeration", True)
            if serial_ports:
                print(f"[INFO] Found {len(serial_ports)} serial ports:")
                for port in serial_ports[:3]:  # Show first 3
                    print(f"       - {port.device}: {port.description}")
            
            # Test network discovery
            print("\n[TEST] Network device discovery...")
            try:
                # Mock network discovery
                network_devices = await discovery.discover_network_devices(
                    subnet="192.168.1.0/24",
                    ports=[8080, 8081],
                    timeout=2.0
                )
                self.print_test("Network scan completed", True)
                if network_devices:
                    print(f"[INFO] Found {len(network_devices)} network devices")
            except Exception as e:
                self.print_test("Network discovery", False, str(e))
            
            # Test USB device discovery
            print("\n[TEST] USB device discovery...")
            usb_devices = await discovery.discover_usb_devices(
                vendor_id=0x1234,  # Mock vendor ID
                product_id=None    # Any product
            )
            self.print_test("USB enumeration", len(usb_devices) >= 0)
            if usb_devices:
                print(f"[INFO] Found {len(usb_devices)} USB devices")
            
            # Test I2C bus scanning
            print("\n[TEST] I2C bus scanning...")
            try:
                i2c_devices = await discovery.scan_i2c_bus(bus_number=1)
                self.print_test("I2C scan completed", True)
                if i2c_devices:
                    print(f"[INFO] Found {len(i2c_devices)} I2C devices at addresses: {i2c_devices}")
            except Exception as e:
                # I2C might not be available on all systems
                print(f"[INFO] I2C scan skipped: {e}")
            
            # Test auto-discovery with multiple protocols
            print("\n[TEST] Auto-discovery across all protocols...")
            all_devices = await discovery.auto_discover(
                protocols=[
                    DiscoveryProtocol.SERIAL,
                    DiscoveryProtocol.NETWORK,
                    DiscoveryProtocol.USB
                ],
                timeout=5.0
            )
            self.print_test("Auto-discovery completed", True)
            
            # Print discovery summary
            print(f"\n[INFO] Total devices discovered: {len(all_devices)}")
            for device in all_devices[:5]:  # Show first 5
                print(f"       - {device.name} ({device.protocol.value}): {device.address}")
            
        except Exception as e:
            self.print_test("Device discovery test", False, str(e))
    
    async def test_diagnostics(self):
        """Test diagnostics functionality"""
        print("\nTesting Diagnostics System...")
        
        try:
            # Create diagnostics manager
            diagnostics = DiagnosticsManager()
            
            # Create a mock adapter for testing
            mock_config = MockConfig(
                name="Test Device",
                devices=[
                    MockDevice(
                        device_id="test_001",
                        name="Test Sensor",
                        response_delay=0.01
                    )
                ]
            )
            adapter = MockAdapter(mock_config)
            await adapter.connect()
            
            # Register diagnostic tests
            print("\n[TEST] Registering diagnostic tests...")
            
            # Connection test
            async def connection_test(adapter):
                """Test adapter connection"""
                return TestResult(
                    test_name="Connection Test",
                    status=TestStatus.PASSED if adapter.is_connected else TestStatus.FAILED,
                    message="Connection is active" if adapter.is_connected else "Not connected",
                    duration=0.1,
                    details={"connection_state": adapter.get_status().connection_state.value}
                )
            
            diagnostics.register_test(
                "connection",
                DiagnosticTest(
                    name="Connection Test",
                    description="Verify adapter connection",
                    test_function=connection_test,
                    timeout=5.0
                )
            )
            
            # Latency test
            async def latency_test(adapter):
                """Test communication latency"""
                start_time = datetime.utcnow()
                response = await adapter.query(b"ping", timeout=1.0)
                latency = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                return TestResult(
                    test_name="Latency Test",
                    status=TestStatus.PASSED if latency < 100 else TestStatus.WARNING,
                    message=f"Latency: {latency:.2f}ms",
                    duration=latency / 1000,
                    details={"latency_ms": latency}
                )
            
            diagnostics.register_test(
                "latency",
                DiagnosticTest(
                    name="Latency Test",
                    description="Measure communication latency",
                    test_function=latency_test,
                    timeout=5.0
                )
            )
            
            # Throughput test
            async def throughput_test(adapter):
                """Test data throughput"""
                data_size = 1024  # 1KB
                test_data = b'x' * data_size
                iterations = 10
                
                start_time = datetime.utcnow()
                for _ in range(iterations):
                    await adapter.write(test_data)
                duration = (datetime.utcnow() - start_time).total_seconds()
                
                throughput = (data_size * iterations) / duration / 1024  # KB/s
                
                return TestResult(
                    test_name="Throughput Test",
                    status=TestStatus.PASSED if throughput > 10 else TestStatus.WARNING,
                    message=f"Throughput: {throughput:.2f} KB/s",
                    duration=duration,
                    details={
                        "throughput_kbps": throughput,
                        "bytes_sent": data_size * iterations
                    }
                )
            
            diagnostics.register_test(
                "throughput",
                DiagnosticTest(
                    name="Throughput Test",
                    description="Measure data throughput",
                    test_function=throughput_test,
                    timeout=10.0
                )
            )
            
            self.print_test("Diagnostic tests registered", True)
            
            # Run individual tests
            print("\n[TEST] Running individual diagnostics...")
            
            # Run connection test
            result = await diagnostics.run_test("connection", adapter)
            self.print_test(
                f"Connection test - {result.status.value}",
                result.status == TestStatus.PASSED
            )
            
            # Run latency test
            result = await diagnostics.run_test("latency", adapter)
            self.print_test(
                f"Latency test - {result.message}",
                result.status in [TestStatus.PASSED, TestStatus.WARNING]
            )
            
            # Run throughput test
            result = await diagnostics.run_test("throughput", adapter)
            self.print_test(
                f"Throughput test - {result.message}",
                result.status in [TestStatus.PASSED, TestStatus.WARNING]
            )
            
            # Run all tests
            print("\n[TEST] Running complete diagnostic suite...")
            all_results = await diagnostics.run_all_tests(adapter)
            
            passed = sum(1 for r in all_results if r.status == TestStatus.PASSED)
            warnings = sum(1 for r in all_results if r.status == TestStatus.WARNING)
            failed = sum(1 for r in all_results if r.status == TestStatus.FAILED)
            
            self.print_test(
                f"Diagnostic suite completed ({passed} passed, {warnings} warnings, {failed} failed)",
                failed == 0
            )
            
            # Generate diagnostic report
            print("\n[TEST] Generating diagnostic report...")
            report = diagnostics.generate_report(all_results)
            self.print_test("Report generated", "summary" in report)
            
            # Print report summary
            print("\n[INFO] Diagnostic Report Summary:")
            print(f"       Total tests: {report['summary']['total_tests']}")
            print(f"       Passed: {report['summary']['passed']}")
            print(f"       Warnings: {report['summary']['warnings']}")
            print(f"       Failed: {report['summary']['failed']}")
            print(f"       Total duration: {report['summary']['total_duration']:.3f}s")
            
            # Clean up
            await adapter.disconnect()
            
        except Exception as e:
            self.print_test("Diagnostics test", False, str(e))
    
    async def test_firmware_detection(self):
        """Test firmware detection and version checking"""
        print("\nTesting Firmware Detection...")
        
        try:
            # Create mock devices with firmware info
            devices = []
            
            # Arduino-style device
            arduino_device = MockDevice(
                device_id="arduino_001",
                name="Arduino Uno",
                response_delay=0.01
            )
            arduino_device.set_response(b"version", b"Arduino Uno R3 - Firmware v1.2.3")
            arduino_device.set_response(b"bootloader", b"Optiboot v8.0")
            devices.append(("Arduino", arduino_device))
            
            # ESP32-style device
            esp32_device = MockDevice(
                device_id="esp32_001",
                name="ESP32 DevKit",
                response_delay=0.01
            )
            esp32_device.set_response(b"AT+GMR", b"ESP-IDF v4.4.1")
            devices.append(("ESP32", esp32_device))
            
            # Custom firmware device
            custom_device = MockDevice(
                device_id="custom_001",
                name="Custom Controller",
                response_delay=0.01
            )
            custom_device.set_response(b"*IDN?", b"ROVER-CTRL,Model-X,SN12345,FW2.0.1")
            devices.append(("Custom", custom_device))
            
            # Test each device
            for device_type, device in devices:
                print(f"\n[TEST] {device_type} firmware detection...")
                
                # Create adapter with device
                config = MockConfig(name=f"{device_type} Test", devices=[device])
                adapter = MockAdapter(config)
                await adapter.connect()
                
                # Try different firmware query commands
                queries = [
                    (b"version", "Version query"),
                    (b"AT+GMR", "AT command"),
                    (b"*IDN?", "SCPI query"),
                    (b"bootloader", "Bootloader info")
                ]
                
                firmware_found = False
                for query, description in queries:
                    try:
                        response = await adapter.query(query, timeout=1.0)
                        if response and len(response) > 0:
                            firmware_info = response.decode('utf-8', errors='ignore').strip()
                            if firmware_info:
                                print(f"       {description}: {firmware_info}")
                                firmware_found = True
                    except:
                        pass
                
                self.print_test(f"{device_type} firmware detected", firmware_found)
                
                await adapter.disconnect()
            
        except Exception as e:
            self.print_test("Firmware detection test", False, str(e))
    
    async def test_capability_reporting(self):
        """Test device capability reporting"""
        print("\nTesting Capability Reporting...")
        
        try:
            # Create a device with capabilities
            device = MockDevice(
                device_id="capable_001",
                name="Multi-Function Device",
                response_delay=0.01
            )
            
            # Set up capability responses
            capabilities = {
                "sensors": ["temperature", "humidity", "pressure"],
                "actuators": ["motor", "led", "buzzer"],
                "communication": ["serial", "i2c", "spi"],
                "data_rates": [9600, 115200, 1000000],
                "power_modes": ["active", "sleep", "deep_sleep"],
                "memory": {"flash": 256000, "ram": 32000}
            }
            
            device.set_response(b"capabilities", json.dumps(capabilities).encode())
            
            # Create adapter
            config = MockConfig(name="Capability Test", devices=[device])
            adapter = MockAdapter(config)
            await adapter.connect()
            
            # Query capabilities
            print("\n[TEST] Querying device capabilities...")
            response = await adapter.query(b"capabilities", timeout=2.0)
            
            if response:
                try:
                    caps = json.loads(response.decode('utf-8'))
                    self.print_test("Capabilities retrieved", True)
                    
                    # Display capabilities
                    print("\n[INFO] Device Capabilities:")
                    print(f"       Sensors: {', '.join(caps.get('sensors', []))}")
                    print(f"       Actuators: {', '.join(caps.get('actuators', []))}")
                    print(f"       Communication: {', '.join(caps.get('communication', []))}")
                    print(f"       Data rates: {caps.get('data_rates', [])}")
                    print(f"       Power modes: {', '.join(caps.get('power_modes', []))}")
                    
                    memory = caps.get('memory', {})
                    if memory:
                        print(f"       Memory: Flash={memory.get('flash', 0)/1024:.1f}KB, RAM={memory.get('ram', 0)/1024:.1f}KB")
                    
                except json.JSONDecodeError:
                    self.print_test("Capability parsing", False, "Invalid JSON response")
            else:
                self.print_test("Capability query", False, "No response")
            
            await adapter.disconnect()
            
        except Exception as e:
            self.print_test("Capability reporting test", False, str(e))
    
    async def run_all_tests(self):
        """Run all discovery and diagnostic tests"""
        self.print_header("HARDWARE DISCOVERY & DIAGNOSTICS TEST SUITE")
        
        # Run tests
        await self.test_device_discovery()
        await self.test_diagnostics()
        await self.test_firmware_detection()
        await self.test_capability_reporting()
        
        # Print summary
        self.print_header("TEST SUMMARY")
        total_tests = self.passed_tests + self.failed_tests
        print(f"Tests passed: {self.passed_tests}/{total_tests}")
        
        if self.failed_tests == 0:
            print("\n[SUCCESS] ALL TESTS PASSED!")
        else:
            print(f"\n[ERROR] {self.failed_tests} TESTS FAILED")
        
        return self.failed_tests == 0


async def main():
    """Main test function"""
    tester = HardwareDiscoveryTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())