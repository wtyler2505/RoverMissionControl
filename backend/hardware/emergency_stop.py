"""
Emergency Stop Hardware Abstraction Layer
Enterprise-grade implementation with fail-safe operation and redundancy

This module provides a robust hardware abstraction layer for emergency stop devices
with support for multiple hardware interfaces, watchdog monitoring, and fail-safe
operation modes. Follows IEC 61508 SIL-2 safety standards.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Dict, List, Optional, Callable, Union, Tuple, Any
import struct
import time
from contextlib import asynccontextmanager

from .base import ProtocolAdapter, ProtocolConfig, ProtocolType, ConnectionState, DataPacket
from .serial_adapter import SerialAdapter, SerialConfig
from .factory import ProtocolFactory

logger = logging.getLogger(__name__)


class EmergencyStopState(Enum):
    """Emergency stop states following IEC 61508 standards"""
    NORMAL = "normal"  # System operating normally
    TRIGGERED = "triggered"  # Emergency stop activated
    FAULT = "fault"  # Hardware fault detected
    UNKNOWN = "unknown"  # State cannot be determined
    TEST = "test"  # Test mode active


class ButtonType(Enum):
    """Types of emergency stop buttons"""
    PRIMARY = "primary"  # Main emergency stop button
    SECONDARY = "secondary"  # Backup emergency stop
    REMOTE = "remote"  # Remote emergency stop
    SOFTWARE = "software"  # Software-triggered stop
    EXTERNAL = "external"  # External trigger (e.g., safety mat)


class FaultType(Enum):
    """Types of hardware faults"""
    COMMUNICATION_LOSS = auto()
    HEARTBEAT_TIMEOUT = auto()
    INVALID_STATE = auto()
    HARDWARE_FAILURE = auto()
    POWER_LOSS = auto()
    WIRING_FAULT = auto()
    BUTTON_STUCK = auto()
    REDUNDANCY_MISMATCH = auto()


@dataclass
class EmergencyStopStatus:
    """Comprehensive status for emergency stop hardware"""
    state: EmergencyStopState
    button_type: ButtonType
    is_healthy: bool
    last_heartbeat: Optional[datetime] = None
    fault_codes: List[FaultType] = field(default_factory=list)
    voltage_level: float = 0.0  # Voltage reading (if available)
    response_time_ms: float = 0.0  # Last response time
    activation_count: int = 0  # Total activations
    test_mode: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EmergencyStopConfig(ProtocolConfig):
    """Configuration for emergency stop hardware"""
    button_type: ButtonType = ButtonType.PRIMARY
    heartbeat_interval_ms: int = 100  # Heartbeat interval in milliseconds
    heartbeat_timeout_ms: int = 500  # Heartbeat timeout
    watchdog_timeout_ms: int = 1000  # Watchdog timer timeout
    debounce_time_ms: int = 50  # Button debounce time
    redundancy_enabled: bool = True  # Enable redundant checking
    fail_safe_state: EmergencyStopState = EmergencyStopState.TRIGGERED  # State on failure
    auto_recovery: bool = False  # Auto-recover from faults
    test_mode_allowed: bool = True  # Allow test mode
    voltage_threshold_low: float = 4.5  # Low voltage threshold
    voltage_threshold_high: float = 5.5  # High voltage threshold
    
    def validate(self) -> None:
        """Validate emergency stop configuration"""
        super().validate()
        if self.heartbeat_interval_ms <= 0:
            raise ValueError("Heartbeat interval must be positive")
        if self.heartbeat_timeout_ms <= self.heartbeat_interval_ms:
            raise ValueError("Heartbeat timeout must be greater than interval")
        if self.watchdog_timeout_ms <= 0:
            raise ValueError("Watchdog timeout must be positive")


class EmergencyStopProtocol:
    """Wire protocol for emergency stop communication"""
    
    # Protocol constants
    SYNC_BYTE = 0xAA
    PROTOCOL_VERSION = 0x01
    
    # Command codes
    CMD_STATUS = 0x01
    CMD_ACTIVATE = 0x02
    CMD_DEACTIVATE = 0x03
    CMD_TEST = 0x04
    CMD_HEARTBEAT = 0x05
    CMD_RESET = 0x06
    CMD_GET_CONFIG = 0x07
    CMD_SET_CONFIG = 0x08
    CMD_DIAGNOSTIC = 0x09
    
    # Response codes
    RESP_ACK = 0x10
    RESP_NACK = 0x11
    RESP_STATUS = 0x12
    RESP_HEARTBEAT = 0x13
    RESP_CONFIG = 0x14
    RESP_DIAGNOSTIC = 0x15
    
    @staticmethod
    def create_packet(command: int, data: bytes = b'') -> bytes:
        """Create a protocol packet with CRC16"""
        header = struct.pack('BBB', 
                           EmergencyStopProtocol.SYNC_BYTE,
                           EmergencyStopProtocol.PROTOCOL_VERSION,
                           command)
        length = struct.pack('H', len(data))  # 16-bit length
        
        # Calculate CRC16
        payload = header + length + data
        crc = EmergencyStopProtocol._calculate_crc16(payload)
        
        return payload + struct.pack('H', crc)
    
    @staticmethod
    def parse_packet(data: bytes) -> Optional[Tuple[int, bytes]]:
        """Parse a protocol packet and verify CRC"""
        if len(data) < 7:  # Minimum packet size
            return None
            
        sync, version, command = struct.unpack('BBB', data[:3])
        
        if sync != EmergencyStopProtocol.SYNC_BYTE:
            return None
        if version != EmergencyStopProtocol.PROTOCOL_VERSION:
            return None
            
        length = struct.unpack('H', data[3:5])[0]
        
        if len(data) < 7 + length:
            return None
            
        payload_data = data[5:5+length]
        received_crc = struct.unpack('H', data[5+length:7+length])[0]
        
        # Verify CRC
        calculated_crc = EmergencyStopProtocol._calculate_crc16(data[:5+length])
        if calculated_crc != received_crc:
            return None
            
        return command, payload_data
    
    @staticmethod
    def _calculate_crc16(data: bytes) -> int:
        """Calculate CRC16-CCITT"""
        crc = 0xFFFF
        for byte in data:
            crc ^= byte << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ 0x1021
                else:
                    crc <<= 1
                crc &= 0xFFFF
        return crc


class EmergencyStopAdapter(ProtocolAdapter):
    """Base adapter for emergency stop hardware"""
    
    def __init__(self, config: EmergencyStopConfig):
        super().__init__(config)
        self.config: EmergencyStopConfig = config
        
        # Status tracking
        self._status = EmergencyStopStatus(
            state=EmergencyStopState.UNKNOWN,
            button_type=config.button_type,
            is_healthy=False
        )
        
        # Heartbeat and watchdog
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._watchdog_task: Optional[asyncio.Task] = None
        self._last_heartbeat_sent: Optional[datetime] = None
        self._heartbeat_failures: int = 0
        
        # State change callbacks
        self._state_change_handlers: List[Callable[[EmergencyStopState], None]] = []
        self._fault_handlers: List[Callable[[List[FaultType]], None]] = []
        
        # Redundancy checking
        self._redundant_state: Optional[EmergencyStopState] = None
        self._redundancy_mismatch_count: int = 0
        
    def _get_protocol_type(self) -> ProtocolType:
        """Emergency stop uses various protocols"""
        return ProtocolType.SERIAL  # Default to serial
        
    async def _connect_impl(self) -> None:
        """Implementation-specific connection logic"""
        # Subclasses implement specific connection
        pass
        
    async def _disconnect_impl(self) -> None:
        """Implementation-specific disconnect logic"""
        # Stop heartbeat and watchdog
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
                
        if self._watchdog_task:
            self._watchdog_task.cancel()
            try:
                await self._watchdog_task
            except asyncio.CancelledError:
                pass
    
    async def initialize(self) -> None:
        """Initialize emergency stop hardware"""
        logger.info(f"Initializing emergency stop adapter: {self.config.button_type.value}")
        
        # Start heartbeat monitoring
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        self._watchdog_task = asyncio.create_task(self._watchdog_loop())
        
        # Get initial status
        await self.update_status()
        
    async def _heartbeat_loop(self) -> None:
        """Heartbeat monitoring loop"""
        while self.is_connected:
            try:
                # Send heartbeat
                await self._send_heartbeat()
                
                # Wait for interval
                await asyncio.sleep(self.config.heartbeat_interval_ms / 1000.0)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")
                self._heartbeat_failures += 1
                
                if self._heartbeat_failures > 3:
                    await self._handle_fault([FaultType.HEARTBEAT_TIMEOUT])
                    
    async def _watchdog_loop(self) -> None:
        """Watchdog timer loop"""
        while self.is_connected:
            try:
                # Check last heartbeat
                if self._status.last_heartbeat:
                    elapsed = (datetime.utcnow() - self._status.last_heartbeat).total_seconds() * 1000
                    
                    if elapsed > self.config.watchdog_timeout_ms:
                        logger.warning(f"Watchdog timeout: {elapsed}ms")
                        await self._handle_fault([FaultType.HEARTBEAT_TIMEOUT])
                        
                # Check for stuck button
                if self._status.state == EmergencyStopState.TRIGGERED:
                    # Additional checks for stuck button
                    pass
                    
                await asyncio.sleep(self.config.watchdog_timeout_ms / 1000.0)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Watchdog error: {e}")
                
    async def _send_heartbeat(self) -> None:
        """Send heartbeat to hardware"""
        packet = EmergencyStopProtocol.create_packet(EmergencyStopProtocol.CMD_HEARTBEAT)
        await self.write(packet)
        self._last_heartbeat_sent = datetime.utcnow()
        
    async def _handle_fault(self, faults: List[FaultType]) -> None:
        """Handle hardware faults"""
        logger.error(f"Emergency stop fault detected: {faults}")
        
        # Update status
        self._status.fault_codes.extend(faults)
        self._status.is_healthy = False
        
        # Enter fail-safe state
        if self.config.fail_safe_state == EmergencyStopState.TRIGGERED:
            self._status.state = EmergencyStopState.TRIGGERED
            await self._notify_state_change(EmergencyStopState.TRIGGERED)
        
        # Notify fault handlers
        for handler in self._fault_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(faults)
                else:
                    handler(faults)
            except Exception as e:
                logger.error(f"Fault handler error: {e}")
                
    async def update_status(self) -> EmergencyStopStatus:
        """Get current hardware status"""
        try:
            # Request status from hardware
            packet = EmergencyStopProtocol.create_packet(EmergencyStopProtocol.CMD_STATUS)
            await self.write(packet)
            
            # Read response with timeout
            response = await self.read(timeout=0.1)
            
            # Parse response
            result = EmergencyStopProtocol.parse_packet(response.data)
            if result:
                command, data = result
                if command == EmergencyStopProtocol.RESP_STATUS:
                    # Parse status data
                    self._parse_status_response(data)
                    
        except Exception as e:
            logger.error(f"Failed to update status: {e}")
            self._status.is_healthy = False
            
        return self._status
    
    def _parse_status_response(self, data: bytes) -> None:
        """Parse status response from hardware"""
        if len(data) >= 4:
            state_byte, voltage_raw, response_time = struct.unpack('BBH', data[:4])
            
            # Map state
            state_map = {
                0x00: EmergencyStopState.NORMAL,
                0x01: EmergencyStopState.TRIGGERED,
                0x02: EmergencyStopState.FAULT,
                0xFF: EmergencyStopState.UNKNOWN
            }
            
            new_state = state_map.get(state_byte, EmergencyStopState.UNKNOWN)
            
            # Check for state change
            if new_state != self._status.state:
                self._status.state = new_state
                asyncio.create_task(self._notify_state_change(new_state))
            
            # Update other fields
            self._status.voltage_level = voltage_raw / 10.0  # Convert to volts
            self._status.response_time_ms = response_time
            self._status.last_heartbeat = datetime.utcnow()
            self._status.is_healthy = True
            self._heartbeat_failures = 0
            
            # Check voltage levels
            if (self._status.voltage_level < self.config.voltage_threshold_low or
                self._status.voltage_level > self.config.voltage_threshold_high):
                self._status.fault_codes.append(FaultType.POWER_LOSS)
                self._status.is_healthy = False
                
    async def activate_emergency_stop(self) -> bool:
        """Activate emergency stop"""
        try:
            logger.warning(f"ACTIVATING EMERGENCY STOP: {self.config.button_type.value}")
            
            # Send activation command
            packet = EmergencyStopProtocol.create_packet(EmergencyStopProtocol.CMD_ACTIVATE)
            await self.write(packet)
            
            # Wait for acknowledgment
            response = await self.read(timeout=0.1)
            result = EmergencyStopProtocol.parse_packet(response.data)
            
            if result and result[0] == EmergencyStopProtocol.RESP_ACK:
                self._status.state = EmergencyStopState.TRIGGERED
                self._status.activation_count += 1
                await self._notify_state_change(EmergencyStopState.TRIGGERED)
                return True
                
        except Exception as e:
            logger.error(f"Failed to activate emergency stop: {e}")
            # Fail safe - assume triggered
            self._status.state = EmergencyStopState.TRIGGERED
            await self._notify_state_change(EmergencyStopState.TRIGGERED)
            
        return False
        
    async def deactivate_emergency_stop(self) -> bool:
        """Deactivate emergency stop (requires safety checks)"""
        try:
            logger.info(f"Deactivating emergency stop: {self.config.button_type.value}")
            
            # Send deactivation command
            packet = EmergencyStopProtocol.create_packet(EmergencyStopProtocol.CMD_DEACTIVATE)
            await self.write(packet)
            
            # Wait for acknowledgment
            response = await self.read(timeout=0.1)
            result = EmergencyStopProtocol.parse_packet(response.data)
            
            if result and result[0] == EmergencyStopProtocol.RESP_ACK:
                self._status.state = EmergencyStopState.NORMAL
                self._status.fault_codes.clear()  # Clear faults on successful deactivation
                await self._notify_state_change(EmergencyStopState.NORMAL)
                return True
                
        except Exception as e:
            logger.error(f"Failed to deactivate emergency stop: {e}")
            
        return False
        
    async def test_emergency_stop(self) -> bool:
        """Test emergency stop functionality"""
        if not self.config.test_mode_allowed:
            logger.warning("Test mode not allowed")
            return False
            
        try:
            logger.info("Testing emergency stop")
            
            # Enter test mode
            self._status.test_mode = True
            packet = EmergencyStopProtocol.create_packet(EmergencyStopProtocol.CMD_TEST)
            await self.write(packet)
            
            # Wait for test completion
            response = await self.read(timeout=1.0)
            result = EmergencyStopProtocol.parse_packet(response.data)
            
            self._status.test_mode = False
            
            if result and result[0] == EmergencyStopProtocol.RESP_ACK:
                return True
                
        except Exception as e:
            logger.error(f"Emergency stop test failed: {e}")
            self._status.test_mode = False
            
        return False
        
    async def run_diagnostics(self) -> Dict[str, Any]:
        """Run comprehensive diagnostics"""
        diagnostics = {
            'timestamp': datetime.utcnow().isoformat(),
            'button_type': self.config.button_type.value,
            'state': self._status.state.value,
            'is_healthy': self._status.is_healthy,
            'voltage_level': self._status.voltage_level,
            'response_time_ms': self._status.response_time_ms,
            'activation_count': self._status.activation_count,
            'fault_codes': [f.name for f in self._status.fault_codes],
            'heartbeat_failures': self._heartbeat_failures,
            'redundancy_mismatches': self._redundancy_mismatch_count,
        }
        
        try:
            # Request detailed diagnostics from hardware
            packet = EmergencyStopProtocol.create_packet(EmergencyStopProtocol.CMD_DIAGNOSTIC)
            await self.write(packet)
            
            response = await self.read(timeout=0.5)
            result = EmergencyStopProtocol.parse_packet(response.data)
            
            if result and result[0] == EmergencyStopProtocol.RESP_DIAGNOSTIC:
                # Parse diagnostic data
                diagnostics['hardware_diagnostics'] = self._parse_diagnostic_data(result[1])
                
        except Exception as e:
            logger.error(f"Diagnostic error: {e}")
            diagnostics['diagnostic_error'] = str(e)
            
        return diagnostics
        
    def _parse_diagnostic_data(self, data: bytes) -> Dict[str, Any]:
        """Parse diagnostic data from hardware"""
        # Implementation depends on hardware specifics
        return {'raw_data': data.hex()}
        
    async def _notify_state_change(self, new_state: EmergencyStopState) -> None:
        """Notify all state change handlers"""
        for handler in self._state_change_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(new_state)
                else:
                    handler(new_state)
            except Exception as e:
                logger.error(f"State change handler error: {e}")
                
    def register_state_change_handler(self, handler: Callable[[EmergencyStopState], None]) -> None:
        """Register a state change handler"""
        self._state_change_handlers.append(handler)
        
    def register_fault_handler(self, handler: Callable[[List[FaultType]], None]) -> None:
        """Register a fault handler"""
        self._fault_handlers.append(handler)
        
    @property
    def current_state(self) -> EmergencyStopState:
        """Get current emergency stop state"""
        return self._status.state
        
    @property
    def is_triggered(self) -> bool:
        """Check if emergency stop is triggered"""
        return self._status.state == EmergencyStopState.TRIGGERED
        
    @property
    def is_healthy(self) -> bool:
        """Check if hardware is healthy"""
        return self._status.is_healthy and not self._status.fault_codes


class SerialEmergencyStopAdapter(EmergencyStopAdapter):
    """Serial port implementation of emergency stop adapter"""
    
    def __init__(self, config: EmergencyStopConfig, port: str, baudrate: int = 115200):
        super().__init__(config)
        
        # Create serial configuration
        self._serial_config = SerialConfig(
            name=f"emergency_stop_{config.button_type.value}",
            port=port,
            baudrate=baudrate,
            timeout=0.1,
            retry_count=3
        )
        
        # Create underlying serial adapter
        self._serial_adapter = SerialAdapter(self._serial_config)
        
    async def _connect_impl(self) -> None:
        """Connect to serial emergency stop device"""
        await self._serial_adapter.connect()
        
    async def _disconnect_impl(self) -> None:
        """Disconnect from serial device"""
        await super()._disconnect_impl()
        await self._serial_adapter.disconnect()
        
    async def _write_impl(self, packet: DataPacket) -> None:
        """Write data to serial port"""
        await self._serial_adapter.write(packet.data)
        
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read data from serial port"""
        return await self._serial_adapter.read(size, timeout)


class USBHIDEmergencyStopAdapter(EmergencyStopAdapter):
    """USB HID implementation for emergency stop devices"""
    
    def __init__(self, config: EmergencyStopConfig, vendor_id: int, product_id: int):
        super().__init__(config)
        self._vendor_id = vendor_id
        self._product_id = product_id
        self._device = None
        
    async def _connect_impl(self) -> None:
        """Connect to USB HID device"""
        # Import hid library (optional dependency)
        try:
            import hid
        except ImportError:
            raise RuntimeError("USB HID support requires 'hidapi' package")
            
        # Open device
        self._device = hid.device()
        self._device.open(self._vendor_id, self._product_id)
        self._device.set_nonblocking(True)
        
    async def _disconnect_impl(self) -> None:
        """Disconnect from USB HID device"""
        await super()._disconnect_impl()
        if self._device:
            self._device.close()
            self._device = None
            
    async def _write_impl(self, packet: DataPacket) -> None:
        """Write data to USB HID device"""
        if self._device:
            # HID reports are typically 64 bytes
            report = bytearray(64)
            report[:len(packet.data)] = packet.data
            self._device.write(report)
            
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read data from USB HID device"""
        if not self._device:
            raise ConnectionError("Not connected to USB device")
            
        # Polling read with timeout
        start_time = time.time()
        while (time.time() - start_time) < timeout:
            data = self._device.read(64)
            if data:
                return DataPacket(data=bytes(data))
            await asyncio.sleep(0.001)  # 1ms polling interval
            
        return DataPacket(data=b'')  # Timeout


class RedundantEmergencyStopAdapter(EmergencyStopAdapter):
    """Redundant emergency stop adapter with multiple hardware channels"""
    
    def __init__(self, config: EmergencyStopConfig, 
                 primary_adapter: EmergencyStopAdapter,
                 secondary_adapter: EmergencyStopAdapter):
        super().__init__(config)
        self._primary = primary_adapter
        self._secondary = secondary_adapter
        self._voting_enabled = True
        
    async def _connect_impl(self) -> None:
        """Connect both adapters"""
        await asyncio.gather(
            self._primary._connect_impl(),
            self._secondary._connect_impl()
        )
        
    async def _disconnect_impl(self) -> None:
        """Disconnect both adapters"""
        await super()._disconnect_impl()
        await asyncio.gather(
            self._primary._disconnect_impl(),
            self._secondary._disconnect_impl()
        )
        
    async def update_status(self) -> EmergencyStopStatus:
        """Get status with redundancy checking"""
        # Get status from both channels
        primary_status, secondary_status = await asyncio.gather(
            self._primary.update_status(),
            self._secondary.update_status(),
            return_exceptions=True
        )
        
        # Handle exceptions
        if isinstance(primary_status, Exception):
            logger.error(f"Primary channel error: {primary_status}")
            primary_status = None
        if isinstance(secondary_status, Exception):
            logger.error(f"Secondary channel error: {secondary_status}")
            secondary_status = None
            
        # Voting logic
        if primary_status and secondary_status:
            # Both channels active - check for agreement
            if primary_status.state != secondary_status.state:
                self._redundancy_mismatch_count += 1
                logger.warning(f"Redundancy mismatch: primary={primary_status.state}, "
                             f"secondary={secondary_status.state}")
                
                # Use fail-safe state on mismatch
                self._status.state = self.config.fail_safe_state
                self._status.fault_codes.append(FaultType.REDUNDANCY_MISMATCH)
            else:
                # Agreement - use primary status
                self._status = primary_status
                self._redundancy_mismatch_count = 0
        elif primary_status:
            # Only primary active
            self._status = primary_status
            self._status.fault_codes.append(FaultType.HARDWARE_FAILURE)
        elif secondary_status:
            # Only secondary active
            self._status = secondary_status
            self._status.fault_codes.append(FaultType.HARDWARE_FAILURE)
        else:
            # Both channels failed
            self._status.state = self.config.fail_safe_state
            self._status.fault_codes.extend([
                FaultType.HARDWARE_FAILURE,
                FaultType.COMMUNICATION_LOSS
            ])
            self._status.is_healthy = False
            
        return self._status
        
    async def activate_emergency_stop(self) -> bool:
        """Activate with redundancy"""
        # Activate on both channels
        results = await asyncio.gather(
            self._primary.activate_emergency_stop(),
            self._secondary.activate_emergency_stop(),
            return_exceptions=True
        )
        
        # Success if at least one channel activated
        return any(r is True for r in results if not isinstance(r, Exception))
        
    async def _write_impl(self, packet: DataPacket) -> None:
        """Write to both channels"""
        await asyncio.gather(
            self._primary._write_impl(packet),
            self._secondary._write_impl(packet),
            return_exceptions=True
        )
        
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Read from primary channel (secondary as backup)"""
        try:
            return await self._primary._read_impl(size, timeout)
        except Exception:
            return await self._secondary._read_impl(size, timeout)


# Factory registration
def register_emergency_stop_adapters():
    """Register emergency stop adapters with the protocol factory"""
    # This would be called during initialization
    pass