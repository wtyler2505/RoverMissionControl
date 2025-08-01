"""
Hardware Commands
Command implementations for hardware protocol operations
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

from ..command_queue.command_base import Command, CommandResult, CommandStatus, CommandType, CommandPriority
from ..command_queue.command_factory import register_command
from .manager import hardware_manager
from .base import ProtocolType, DataPacket


logger = logging.getLogger(__name__)


# Hardware-specific command types
class HardwareCommandType:
    # Connection management
    CONNECT_ADAPTER = "connect_adapter"
    DISCONNECT_ADAPTER = "disconnect_adapter"
    
    # Device communication
    SEND_TO_DEVICE = "send_to_device"
    READ_FROM_DEVICE = "read_from_device"
    QUERY_DEVICE = "query_device"
    
    # Protocol-specific operations
    I2C_READ_REGISTER = "i2c_read_register"
    I2C_WRITE_REGISTER = "i2c_write_register"
    SPI_TRANSFER = "spi_transfer"
    CAN_SEND_MESSAGE = "can_send_message"
    SERIAL_SEND_DATA = "serial_send_data"
    
    # System operations
    SCAN_DEVICES = "scan_devices"
    GET_SYSTEM_STATUS = "get_system_status"
    RESET_ADAPTER = "reset_adapter"


@register_command(HardwareCommandType.CONNECT_ADAPTER)
class ConnectAdapterCommand(Command):
    """Command to connect a hardware adapter"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate connect adapter parameters"""
        if 'adapter_id' not in self.parameters:
            raise ValueError("Missing required parameter: adapter_id")
    
    async def execute(self) -> CommandResult:
        """Execute connect adapter command"""
        try:
            adapter_id = self.parameters['adapter_id']
            
            logger.info(f"Connecting adapter: {adapter_id}")
            await hardware_manager.connect_adapter(adapter_id)
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    'adapter_id': adapter_id,
                    'connected': True,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.DISCONNECT_ADAPTER)
class DisconnectAdapterCommand(Command):
    """Command to disconnect a hardware adapter"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate disconnect adapter parameters"""
        if 'adapter_id' not in self.parameters:
            raise ValueError("Missing required parameter: adapter_id")
    
    async def execute(self) -> CommandResult:
        """Execute disconnect adapter command"""
        try:
            adapter_id = self.parameters['adapter_id']
            
            logger.info(f"Disconnecting adapter: {adapter_id}")
            await hardware_manager.disconnect_adapter(adapter_id)
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    'adapter_id': adapter_id,
                    'connected': False,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.SEND_TO_DEVICE)
class SendToDeviceCommand(Command):
    """Command to send data to a hardware device"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate send to device parameters"""
        required = ['device_id', 'data']
        for param in required:
            if param not in self.parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        # Validate data format
        data = self.parameters['data']
        if isinstance(data, str):
            try:
                # Try to decode as hex string
                bytes.fromhex(data.replace(' ', ''))
            except ValueError:
                raise ValueError("Invalid hex string format for data")
        elif not isinstance(data, (bytes, list)):
            raise ValueError("Data must be bytes, hex string, or list of integers")
    
    async def execute(self) -> CommandResult:
        """Execute send to device command"""
        try:
            device_id = self.parameters['device_id']
            data = self.parameters['data']
            
            # Convert data to bytes if needed
            if isinstance(data, str):
                data = bytes.fromhex(data.replace(' ', ''))
            elif isinstance(data, list):
                data = bytes(data)
            
            # Extract additional parameters
            kwargs = {k: v for k, v in self.parameters.items() 
                     if k not in ['device_id', 'data']}
            
            logger.info(f"Sending data to device {device_id}: {data.hex()}")
            
            # Check if we need a response
            expect_response = self.parameters.get('expect_response', False)
            
            if expect_response:
                response = await hardware_manager.send_command_to_device(
                    device_id, data, **kwargs
                )
                result_data = {
                    'device_id': device_id,
                    'sent_data': data.hex(),
                    'response_data': response.data.hex(),
                    'response_size': len(response.data),
                    'timestamp': datetime.utcnow().isoformat()
                }
            else:
                await hardware_manager.send_to_adapter(
                    hardware_manager.get_device(device_id).adapter_id,
                    data, **kwargs
                )
                result_data = {
                    'device_id': device_id,
                    'sent_data': data.hex(),
                    'bytes_sent': len(data),
                    'timestamp': datetime.utcnow().isoformat()
                }
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data=result_data
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.I2C_READ_REGISTER)
class I2CReadRegisterCommand(Command):
    """Command to read from I2C device register"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate I2C read register parameters"""
        required = ['adapter_id', 'address', 'register']
        for param in required:
            if param not in self.parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        address = self.parameters['address']
        if not 0x00 <= address <= 0x7F:
            raise ValueError(f"Invalid I2C address: 0x{address:02X}")
    
    async def execute(self) -> CommandResult:
        """Execute I2C read register command"""
        try:
            adapter_id = self.parameters['adapter_id']
            address = self.parameters['address']
            register = self.parameters['register']
            size = self.parameters.get('size', 1)
            
            adapter = hardware_manager.get_adapter(adapter_id)
            if not adapter or adapter.protocol_type != ProtocolType.I2C:
                raise ValueError(f"I2C adapter {adapter_id} not found")
            
            logger.info(f"Reading I2C register 0x{register:02X} from device 0x{address:02X}")
            
            if size == 1:
                value = await adapter.read_register(address, register)
                result_data = {
                    'address': f"0x{address:02X}",
                    'register': f"0x{register:02X}",
                    'value': f"0x{value:02X}",
                    'raw_value': value
                }
            else:
                data = await adapter.read_block(address, register, size)
                result_data = {
                    'address': f"0x{address:02X}",
                    'register': f"0x{register:02X}",
                    'data': data.hex(),
                    'size': len(data)
                }
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data=result_data
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.I2C_WRITE_REGISTER)
class I2CWriteRegisterCommand(Command):
    """Command to write to I2C device register"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate I2C write register parameters"""
        required = ['adapter_id', 'address', 'register', 'value']
        for param in required:
            if param not in self.parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        address = self.parameters['address']
        if not 0x00 <= address <= 0x7F:
            raise ValueError(f"Invalid I2C address: 0x{address:02X}")
    
    async def execute(self) -> CommandResult:
        """Execute I2C write register command"""
        try:
            adapter_id = self.parameters['adapter_id']
            address = self.parameters['address']
            register = self.parameters['register']
            value = self.parameters['value']
            
            adapter = hardware_manager.get_adapter(adapter_id)
            if not adapter or adapter.protocol_type != ProtocolType.I2C:
                raise ValueError(f"I2C adapter {adapter_id} not found")
            
            logger.info(f"Writing 0x{value:02X} to I2C register 0x{register:02X} on device 0x{address:02X}")
            
            if isinstance(value, int):
                await adapter.write_register(address, register, value)
            elif isinstance(value, (list, bytes)):
                data = bytes(value) if isinstance(value, list) else value
                await adapter.write_block(address, register, data)
            else:
                raise ValueError("Value must be int, bytes, or list")
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    'address': f"0x{address:02X}",
                    'register': f"0x{register:02X}",
                    'value': value if isinstance(value, int) else f"0x{value.hex()}" if isinstance(value, bytes) else str(value),
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.CAN_SEND_MESSAGE)
class CANSendMessageCommand(Command):
    """Command to send CAN message"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate CAN send message parameters"""
        required = ['adapter_id', 'arbitration_id', 'data']
        for param in required:
            if param not in self.parameters:
                raise ValueError(f"Missing required parameter: {param}")
        
        arbitration_id = self.parameters['arbitration_id']
        if not 0x000 <= arbitration_id <= 0x7FF:  # Standard 11-bit ID
            is_extended = self.parameters.get('is_extended_id', False)
            if not is_extended or not 0x00000000 <= arbitration_id <= 0x1FFFFFFF:
                raise ValueError(f"Invalid CAN arbitration ID: 0x{arbitration_id:X}")
    
    async def execute(self) -> CommandResult:
        """Execute CAN send message command"""
        try:
            adapter_id = self.parameters['adapter_id']
            arbitration_id = self.parameters['arbitration_id']
            data = self.parameters['data']
            is_extended_id = self.parameters.get('is_extended_id', False)
            is_remote_frame = self.parameters.get('is_remote_frame', False)
            
            adapter = hardware_manager.get_adapter(adapter_id)
            if not adapter or adapter.protocol_type != ProtocolType.CAN:
                raise ValueError(f"CAN adapter {adapter_id} not found")
            
            # Convert data if needed
            if isinstance(data, str):
                data = bytes.fromhex(data.replace(' ', ''))
            elif isinstance(data, list):
                data = bytes(data)
            
            logger.info(f"Sending CAN message ID 0x{arbitration_id:X}: {data.hex()}")
            
            await adapter.send_message(
                arbitration_id=arbitration_id,
                data=data,
                is_extended_id=is_extended_id,
                is_remote_frame=is_remote_frame
            )
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    'arbitration_id': f"0x{arbitration_id:X}",
                    'data': data.hex(),
                    'dlc': len(data),
                    'is_extended_id': is_extended_id,
                    'is_remote_frame': is_remote_frame,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.SCAN_DEVICES)
class ScanDevicesCommand(Command):
    """Command to scan for devices on hardware adapters"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate scan devices parameters"""
        # No required parameters - adapter_id is optional
        pass
    
    async def execute(self) -> CommandResult:
        """Execute scan devices command"""
        try:
            adapter_id = self.parameters.get('adapter_id')
            
            logger.info(f"Scanning for devices on {adapter_id or 'all adapters'}")
            
            scan_results = await hardware_manager.scan_for_devices(adapter_id)
            
            total_devices = sum(len(devices) for devices in scan_results.values())
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    'scan_results': scan_results,
                    'total_devices_found': total_devices,
                    'adapters_scanned': list(scan_results.keys()),
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )


@register_command(HardwareCommandType.GET_SYSTEM_STATUS)
class GetSystemStatusCommand(Command):
    """Command to get hardware system status"""
    
    def __init__(self, **kwargs):
        super().__init__(command_type=CommandType.CUSTOM, **kwargs)
    
    def _validate_parameters(self):
        """Validate get system status parameters"""
        # No parameters required
        pass
    
    async def execute(self) -> CommandResult:
        """Execute get system status command"""
        try:
            logger.info("Getting hardware system status")
            
            status = hardware_manager.get_system_status()
            
            return CommandResult(
                success=True,
                command_id=self.id,
                status=CommandStatus.COMPLETED,
                result_data={
                    'system_status': status,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            return CommandResult(
                success=False,
                command_id=self.id,
                status=CommandStatus.FAILED,
                error_message=str(e),
                error_details={'exception': type(e).__name__}
            )