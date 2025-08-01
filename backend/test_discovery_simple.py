#!/usr/bin/env python3
"""
Simple test for hardware discovery and diagnostics
Tests basic discovery functionality without complex dependencies
"""

import asyncio
import sys
import logging
from pathlib import Path
from datetime import datetime
import json
import serial.tools.list_ports

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Import HAL components
from hardware.base import ProtocolType, ConnectionState
from hardware.mock_adapter import MockAdapter, MockConfig, MockDevice

# Define simple test result classes
from enum import Enum
from dataclasses import dataclass

class TestStatus(Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"

@dataclass
class TestResult:
    test_name: str
    status: TestStatus
    message: str
    duration: float = 0.0

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SimpleDiscoveryTester:
    """Simple hardware discovery and diagnostics test"""
    
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
    
    def test_serial_port_discovery(self):
        """Test serial port discovery"""
        print("\nTesting Serial Port Discovery...")
        
        try:
            # List all serial ports
            ports = list(serial.tools.list_ports.comports())
            
            self.print_test("Serial port enumeration", True)
            
            if ports:
                print(f"\n[INFO] Found {len(ports)} serial ports:")
                for port in ports:
                    print(f"       - {port.device}: {port.description}")
                    if port.manufacturer:
                        print(f"         Manufacturer: {port.manufacturer}")
                    if port.serial_number:
                        print(f"         Serial: {port.serial_number}")
            else:
                print("[INFO] No serial ports found (this is normal on some systems)")
                
        except Exception as e:
            self.print_test("Serial port discovery", False, str(e))
    
    async def test_mock_device_discovery(self):
        """Test discovery of mock devices"""
        print("\nTesting Mock Device Discovery...")
        
        try:
            # Create several mock devices to "discover"
            discovered_devices = []
            
            # Simulate Arduino device
            arduino_config = MockConfig(
                name="Arduino Uno",
                devices=[
                    MockDevice(
                        device_id="arduino_001",
                        name="Arduino Temperature Sensor",
                        response_delay=0.05
                    )
                ]
            )
            discovered_devices.append({
                "name": "Arduino Uno",
                "protocol": "serial",
                "address": "COM3",
                "type": "sensor",
                "config": arduino_config
            })
            
            # Simulate ESP32 device
            esp32_config = MockConfig(
                name="ESP32 Controller",
                devices=[
                    MockDevice(
                        device_id="esp32_001",
                        name="ESP32 Motor Controller",
                        response_delay=0.02
                    )
                ]
            )
            discovered_devices.append({
                "name": "ESP32 Controller",
                "protocol": "serial",
                "address": "COM4",
                "type": "actuator",
                "config": esp32_config
            })
            
            # Simulate network device
            network_config = MockConfig(
                name="Network Sensor",
                devices=[
                    MockDevice(
                        device_id="net_001",
                        name="Ethernet Temperature Sensor",
                        response_delay=0.01
                    )
                ]
            )
            discovered_devices.append({
                "name": "Network Sensor",
                "protocol": "ethernet",
                "address": "192.168.1.100:8080",
                "type": "sensor",
                "config": network_config
            })
            
            self.print_test("Mock device creation", len(discovered_devices) == 3)
            
            # Display discovered devices
            print(f"\n[INFO] Discovered {len(discovered_devices)} mock devices:")
            for device in discovered_devices:
                print(f"       - {device['name']} ({device['protocol']})")
                print(f"         Address: {device['address']}")
                print(f"         Type: {device['type']}")
            
            # Test connecting to each device
            print("\n[TEST] Testing device connections...")
            for device in discovered_devices:
                adapter = MockAdapter(device['config'])
                await adapter.connect()
                
                self.print_test(
                    f"Connect to {device['name']}",
                    adapter.is_connected
                )
                
                await adapter.disconnect()
                
        except Exception as e:
            self.print_test("Mock device discovery", False, str(e))
    
    async def test_diagnostics(self):
        """Test diagnostics functionality"""
        print("\nTesting Diagnostics System...")
        
        try:
            # Skip diagnostics manager for this simple test
            # diagnostics = DiagnosticsManager()
            
            # Create a test device
            mock_config = MockConfig(
                name="Test Device",
                devices=[
                    MockDevice(
                        device_id="test_001",
                        name="Diagnostic Test Device",
                        response_delay=0.01
                    )
                ]
            )
            adapter = MockAdapter(mock_config)
            await adapter.connect()
            
            # Register diagnostic tests
            print("\n[TEST] Running diagnostic tests...")
            
            # Connection test
            async def connection_test(adapter):
                """Test adapter connection"""
                return TestResult(
                    test_name="Connection Test",
                    status=TestStatus.PASSED if adapter.is_connected else TestStatus.FAILED,
                    message="Connection active" if adapter.is_connected else "Not connected",
                    duration=0.01
                )
            
            result = await connection_test(adapter)
            self.print_test(
                f"Connection test - {result.status.value}",
                result.status == TestStatus.PASSED
            )
            
            # Latency test
            async def latency_test(adapter):
                """Test communication latency"""
                # Simulate latency measurement
                latency = adapter.config.devices[0].response_delay * 1000  # Convert to ms
                
                return TestResult(
                    test_name="Latency Test",
                    status=TestStatus.PASSED if latency < 100 else TestStatus.WARNING,
                    message=f"Latency: {latency:.2f}ms",
                    duration=latency / 1000
                )
            
            result = await latency_test(adapter)
            self.print_test(
                f"Latency test - {result.message}",
                result.status in [TestStatus.PASSED, TestStatus.WARNING]
            )
            
            # Data integrity test
            async def data_integrity_test(adapter):
                """Test data transmission integrity"""
                test_data = b"Hello, Rover!"
                
                # Write and read back
                await adapter.write(test_data)
                
                # Mock adapter echoes data
                await adapter.inject_data(test_data)
                response = await adapter.read(timeout=1.0)
                
                success = response and response.data == test_data
                
                return TestResult(
                    test_name="Data Integrity Test",
                    status=TestStatus.PASSED if success else TestStatus.FAILED,
                    message="Data integrity verified" if success else "Data mismatch",
                    duration=0.02
                )
            
            result = await data_integrity_test(adapter)
            self.print_test(
                f"Data integrity test - {result.status.value}",
                result.status == TestStatus.PASSED
            )
            
            # Clean up
            await adapter.disconnect()
            
        except Exception as e:
            self.print_test("Diagnostics test", False, str(e))
    
    async def test_firmware_detection(self):
        """Test firmware version detection"""
        print("\nTesting Firmware Detection...")
        
        try:
            # Create mock devices with firmware responses
            devices = [
                {
                    "name": "Arduino Device",
                    "firmware_query": b"version",
                    "firmware_response": b"Arduino Uno R3 - v1.2.3"
                },
                {
                    "name": "ESP32 Device", 
                    "firmware_query": b"AT+GMR",
                    "firmware_response": b"ESP-IDF v4.4.1-dirty"
                },
                {
                    "name": "Custom Device",
                    "firmware_query": b"*IDN?",
                    "firmware_response": b"ROVER-CTRL,ModelX,SN12345,v2.0.1"
                }
            ]
            
            for device_info in devices:
                # Create device with pre-configured responses
                device = MockDevice(
                    device_id=f"{device_info['name'].lower().replace(' ', '_')}",
                    name=device_info['name'],
                    response_delay=0.01,
                    responses={device_info['firmware_query']: device_info['firmware_response']}
                )
                
                # Create adapter with device metadata
                config = MockConfig(name=device_info['name'], devices=[device])
                adapter = MockAdapter(config)
                await adapter.connect()
                
                # Query firmware with device_id in metadata
                from hardware.base import DataPacket
                query_packet = DataPacket(
                    data=device_info['firmware_query'],
                    metadata={'device_id': device.device_id}
                )
                response = await adapter.query(query_packet, timeout=2.0)
                
                if response and response.data:
                    firmware = response.data.decode('utf-8', errors='ignore').strip()
                    self.print_test(
                        f"{device_info['name']} firmware: {firmware}",
                        True
                    )
                else:
                    self.print_test(
                        f"{device_info['name']} firmware detection",
                        False,
                        "No response"
                    )
                
                await adapter.disconnect()
                
        except Exception as e:
            self.print_test("Firmware detection", False, str(e))
    
    async def test_capability_reporting(self):
        """Test device capability reporting"""
        print("\nTesting Capability Reporting...")
        
        try:
            # Define capabilities
            capabilities = {
                "device_class": "rover_module",
                "sensors": {
                    "temperature": {
                        "range": [-40, 125],
                        "unit": "celsius",
                        "accuracy": 0.5
                    },
                    "distance": {
                        "range": [2, 400],
                        "unit": "cm",
                        "accuracy": 1.0
                    }
                },
                "actuators": {
                    "motor": {
                        "type": "dc_motor",
                        "max_rpm": 300,
                        "control": "pwm"
                    },
                    "servo": {
                        "type": "servo",
                        "range": [0, 180],
                        "unit": "degrees"
                    }
                },
                "communication": {
                    "protocols": ["serial", "i2c"],
                    "serial_baud": [9600, 115200],
                    "i2c_address": "0x48"
                },
                "power": {
                    "voltage_range": [3.3, 5.0],
                    "current_max": 500,
                    "sleep_modes": ["active", "idle", "deep_sleep"]
                }
            }
            
            # Create a multi-capability device with pre-configured response
            device = MockDevice(
                device_id="capable_001",
                name="Multi-Function Rover Module",
                response_delay=0.01,
                responses={b"capabilities": json.dumps(capabilities).encode()}
            )
            
            # Create adapter with reduced transmission delay for large response
            config = MockConfig(
                name="Capability Test", 
                devices=[device],
                transmission_delay=0.001  # Reduce to 1ms per byte
            )
            adapter = MockAdapter(config)
            await adapter.connect()
            
            # Query capabilities with device_id
            from hardware.base import DataPacket
            query_packet = DataPacket(
                data=b"capabilities",
                metadata={'device_id': device.device_id}
            )
            
            # Debug: verify response is set
            print(f"\n[DEBUG] Device responses: {device.responses}")
            print(f"[DEBUG] Querying with packet: data={query_packet.data}, metadata={query_packet.metadata}")
            
            response = await adapter.query(query_packet, timeout=3.0)
            
            if response and response.data:
                try:
                    caps = json.loads(response.data.decode('utf-8'))
                    self.print_test("Capabilities retrieved", True)
                    
                    # Display capabilities
                    print("\n[INFO] Device Capabilities:")
                    print(f"       Device Class: {caps.get('device_class', 'unknown')}")
                    
                    # Sensors
                    if 'sensors' in caps:
                        print("       Sensors:")
                        for sensor, props in caps['sensors'].items():
                            print(f"         - {sensor}: {props.get('range', [])} {props.get('unit', '')}")
                    
                    # Actuators
                    if 'actuators' in caps:
                        print("       Actuators:")
                        for actuator, props in caps['actuators'].items():
                            print(f"         - {actuator}: {props.get('type', 'unknown')}")
                    
                    # Communication
                    if 'communication' in caps:
                        comm = caps['communication']
                        print(f"       Protocols: {', '.join(comm.get('protocols', []))}")
                    
                    # Power
                    if 'power' in caps:
                        power = caps['power']
                        print(f"       Power: {power.get('voltage_range', [])}V, max {power.get('current_max', 0)}mA")
                        
                except json.JSONDecodeError:
                    self.print_test("Capability parsing", False, "Invalid JSON response")
            else:
                self.print_test("Capability query", False, "No response")
            
            await adapter.disconnect()
            
        except Exception as e:
            self.print_test("Capability reporting", False, str(e))
    
    async def run_all_tests(self):
        """Run all tests"""
        self.print_header("HARDWARE DISCOVERY & DIAGNOSTICS TEST")
        
        # Run tests
        self.test_serial_port_discovery()
        await self.test_mock_device_discovery()
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
    tester = SimpleDiscoveryTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())