"""
Hardware Manager
Integrates protocol adapters with the command system and provides unified hardware access
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from dataclasses import dataclass, field

from .base import ProtocolAdapter, ProtocolType, DataPacket, ConnectionState
from .factory import ProtocolAdapterFactory
try:
    from ..command_queue.command_base import Command, CommandResult, CommandStatus, CommandType
except ImportError:
    # Define minimal command classes for testing
    from enum import Enum
    from dataclasses import dataclass
    from typing import Any, Optional
    
    class CommandType(Enum):
        CONTROL = "control"
        QUERY = "query"
        CONFIG = "config"
    
    class CommandStatus(Enum):
        PENDING = "pending"
        EXECUTING = "executing"
        COMPLETED = "completed"
        FAILED = "failed"
    
    @dataclass
    class Command:
        command_type: CommandType
        target_id: str
        command: str
        parameters: dict = None
        timeout: float = 30.0
    
    @dataclass
    class CommandResult:
        status: CommandStatus
        data: Any = None
        error: Optional[str] = None


logger = logging.getLogger(__name__)


@dataclass
class HardwareDevice:
    """Represents a hardware device accessible through protocol adapters"""
    device_id: str
    name: str
    protocol_type: ProtocolType
    adapter_id: str
    address: Optional[Union[str, int]] = None  # Device address (port, I2C addr, etc.)
    capabilities: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    is_active: bool = True


class HardwareManager:
    """
    Central manager for all hardware protocol adapters
    Provides unified interface for hardware communication
    """
    
    def __init__(self):
        self._adapters: Dict[str, ProtocolAdapter] = {}
        self._devices: Dict[str, HardwareDevice] = {}
        self._event_handlers: Dict[str, List] = {}
        self._monitoring_tasks: Dict[str, asyncio.Task] = {}
        
    async def add_adapter(self, adapter_id: str, adapter: ProtocolAdapter) -> None:
        """Add a protocol adapter to the manager"""
        if adapter_id in self._adapters:
            raise ValueError(f"Adapter {adapter_id} already exists")
        
        self._adapters[adapter_id] = adapter
        
        # Set up event handlers for the adapter
        adapter.register_event_handler('connected', self._on_adapter_connected)
        adapter.register_event_handler('disconnected', self._on_adapter_disconnected)
        adapter.register_event_handler('error', self._on_adapter_error)
        adapter.register_event_handler('data_received', self._on_data_received)
        
        logger.info(f"Added {adapter.protocol_type.value} adapter: {adapter_id}")
    
    async def remove_adapter(self, adapter_id: str) -> None:
        """Remove and disconnect a protocol adapter"""
        if adapter_id not in self._adapters:
            raise ValueError(f"Adapter {adapter_id} not found")
        
        adapter = self._adapters[adapter_id]
        
        # Disconnect if connected
        if adapter.is_connected:
            await adapter.disconnect()
        
        # Remove devices using this adapter
        devices_to_remove = [
            device_id for device_id, device in self._devices.items()
            if device.adapter_id == adapter_id
        ]
        for device_id in devices_to_remove:
            del self._devices[device_id]
        
        # Cancel monitoring task
        if adapter_id in self._monitoring_tasks:
            self._monitoring_tasks[adapter_id].cancel()
            del self._monitoring_tasks[adapter_id]
        
        del self._adapters[adapter_id]
        logger.info(f"Removed adapter: {adapter_id}")
    
    async def connect_adapter(self, adapter_id: str) -> None:
        """Connect a specific adapter"""
        if adapter_id not in self._adapters:
            raise ValueError(f"Adapter {adapter_id} not found")
        
        adapter = self._adapters[adapter_id]
        await adapter.connect()
        
        # Start monitoring task
        self._monitoring_tasks[adapter_id] = asyncio.create_task(
            self._monitor_adapter(adapter_id)
        )
    
    async def disconnect_adapter(self, adapter_id: str) -> None:
        """Disconnect a specific adapter"""
        if adapter_id not in self._adapters:
            raise ValueError(f"Adapter {adapter_id} not found")
        
        adapter = self._adapters[adapter_id]
        await adapter.disconnect()
        
        # Cancel monitoring task
        if adapter_id in self._monitoring_tasks:
            self._monitoring_tasks[adapter_id].cancel()
            del self._monitoring_tasks[adapter_id]
    
    async def connect_all(self) -> Dict[str, bool]:
        """Connect all adapters, return success status for each"""
        results = {}
        for adapter_id in self._adapters:
            try:
                await self.connect_adapter(adapter_id)
                results[adapter_id] = True
            except Exception as e:
                logger.error(f"Failed to connect adapter {adapter_id}: {e}")
                results[adapter_id] = False
        return results
    
    async def disconnect_all(self) -> None:
        """Disconnect all adapters"""
        disconnect_tasks = []
        for adapter_id in self._adapters:
            if self._adapters[adapter_id].is_connected:
                disconnect_tasks.append(self.disconnect_adapter(adapter_id))
        
        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)
    
    def add_device(self, device: HardwareDevice) -> None:
        """Register a hardware device"""
        if device.adapter_id not in self._adapters:
            raise ValueError(f"Adapter {device.adapter_id} not found")
        
        self._devices[device.device_id] = device
        logger.info(f"Registered device: {device.device_id} ({device.name})")
    
    def remove_device(self, device_id: str) -> None:
        """Unregister a hardware device"""
        if device_id in self._devices:
            del self._devices[device_id]
            logger.info(f"Unregistered device: {device_id}")
    
    async def send_command_to_device(self, device_id: str, data: bytes, 
                                   **kwargs) -> DataPacket:
        """Send command to a specific device and wait for response"""
        if device_id not in self._devices:
            raise ValueError(f"Device {device_id} not found")
        
        device = self._devices[device_id]
        adapter = self._adapters[device.adapter_id]
        
        if not adapter.is_connected:
            raise ConnectionError(f"Adapter {device.adapter_id} not connected")
        
        # Add device-specific metadata
        metadata = kwargs.copy()
        metadata.update({
            'device_id': device_id,
            'device_name': device.name,
            'protocol': adapter.protocol_type.value
        })
        
        # Add protocol-specific addressing
        if device.address is not None:
            if adapter.protocol_type == ProtocolType.I2C:
                metadata['address'] = device.address
            elif adapter.protocol_type == ProtocolType.SPI:
                metadata['chip_select'] = device.address
            elif adapter.protocol_type == ProtocolType.CAN:
                metadata['arbitration_id'] = device.address
            elif adapter.protocol_type == ProtocolType.ETHERNET:
                if isinstance(device.address, str):
                    host, port = device.address.split(':')
                    metadata.update({'target_host': host, 'target_port': int(port)})
            elif adapter.protocol_type == ProtocolType.SERIAL:
                # Serial doesn't need addressing - already bound to specific port
                pass
        
        # Send command and wait for response
        packet = DataPacket(data=data, metadata=metadata)
        
        if hasattr(adapter, 'query'):
            # Use query method if available (request-response)
            response = await adapter.query(packet, **kwargs)
        else:
            # Manual send/receive
            await adapter.write(packet)
            response = await adapter.read(**kwargs)
        
        return response
    
    async def send_to_adapter(self, adapter_id: str, data: bytes, **kwargs) -> None:
        """Send data directly to an adapter"""
        if adapter_id not in self._adapters:
            raise ValueError(f"Adapter {adapter_id} not found")
        
        adapter = self._adapters[adapter_id]
        await adapter.write(data, **kwargs)
    
    def get_adapter(self, adapter_id: str) -> Optional[ProtocolAdapter]:
        """Get adapter by ID"""
        return self._adapters.get(adapter_id)
    
    def get_device(self, device_id: str) -> Optional[HardwareDevice]:
        """Get device by ID"""
        return self._devices.get(device_id)
    
    def get_adapters_by_protocol(self, protocol_type: ProtocolType) -> List[ProtocolAdapter]:
        """Get all adapters of a specific protocol type"""
        return [
            adapter for adapter in self._adapters.values()
            if adapter.protocol_type == protocol_type
        ]
    
    def get_devices_by_protocol(self, protocol_type: ProtocolType) -> List[HardwareDevice]:
        """Get all devices using a specific protocol"""
        return [
            device for device in self._devices.values()
            if device.protocol_type == protocol_type
        ]
    
    def get_connected_adapters(self) -> List[str]:
        """Get list of connected adapter IDs"""
        return [
            adapter_id for adapter_id, adapter in self._adapters.items()
            if adapter.is_connected
        ]
    
    def get_active_devices(self) -> List[str]:
        """Get list of active device IDs"""
        return [
            device_id for device_id, device in self._devices.items()
            if device.is_active and device.adapter_id in self.get_connected_adapters()
        ]
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get overall system status"""
        adapter_status = {}
        for adapter_id, adapter in self._adapters.items():
            adapter_status[adapter_id] = {
                'protocol': adapter.protocol_type.value,
                'connected': adapter.is_connected,
                'status': adapter.status.state.value,
                'statistics': adapter.get_statistics()
            }
        
        device_status = {}
        for device_id, device in self._devices.items():
            device_status[device_id] = {
                'name': device.name,
                'protocol': device.protocol_type.value,
                'adapter': device.adapter_id,
                'active': device.is_active,
                'address': device.address,
                'capabilities': device.capabilities
            }
        
        return {
            'adapters': adapter_status,
            'devices': device_status,
            'summary': {
                'total_adapters': len(self._adapters),
                'connected_adapters': len(self.get_connected_adapters()),
                'total_devices': len(self._devices),
                'active_devices': len(self.get_active_devices())
            }
        }
    
    async def scan_for_devices(self, adapter_id: Optional[str] = None) -> Dict[str, List]:
        """Scan for devices on adapters"""
        results = {}
        
        adapters_to_scan = [adapter_id] if adapter_id else self._adapters.keys()
        
        for aid in adapters_to_scan:
            if aid not in self._adapters:
                continue
            
            adapter = self._adapters[aid]
            if not adapter.is_connected:
                continue
            
            try:
                if adapter.protocol_type == ProtocolType.I2C and hasattr(adapter, 'scan_bus'):
                    devices = await adapter.scan_bus()
                    results[aid] = [f"0x{addr:02X}" for addr in devices]
                elif adapter.protocol_type == ProtocolType.CAN and hasattr(adapter, 'scan_network'):
                    devices = await adapter.scan_network()
                    results[aid] = [f"Node_{node}" for node in devices]
                elif adapter.protocol_type == ProtocolType.SERIAL and hasattr(adapter, 'list_ports'):
                    ports = adapter.list_ports()
                    results[aid] = list(ports.keys())
                else:
                    results[aid] = []
            except Exception as e:
                logger.error(f"Device scan failed for adapter {aid}: {e}")
                results[aid] = []
        
        return results
    
    def register_event_handler(self, event: str, handler) -> None:
        """Register global event handler"""
        if event not in self._event_handlers:
            self._event_handlers[event] = []
        self._event_handlers[event].append(handler)
    
    async def _emit_event(self, event: str, data: Dict[str, Any]) -> None:
        """Emit event to registered handlers"""
        if event in self._event_handlers:
            for handler in self._event_handlers[event]:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(data)
                    else:
                        handler(data)
                except Exception as e:
                    logger.error(f"Error in event handler for {event}: {e}")
    
    async def _on_adapter_connected(self, data: Dict[str, Any]) -> None:
        """Handle adapter connected event"""
        await self._emit_event('adapter_connected', data)
    
    async def _on_adapter_disconnected(self, data: Dict[str, Any]) -> None:
        """Handle adapter disconnected event"""
        await self._emit_event('adapter_disconnected', data)
    
    async def _on_adapter_error(self, data: Dict[str, Any]) -> None:
        """Handle adapter error event"""
        await self._emit_event('adapter_error', data)
    
    async def _on_data_received(self, data: Dict[str, Any]) -> None:
        """Handle data received event"""
        await self._emit_event('data_received', data)
    
    async def _monitor_adapter(self, adapter_id: str) -> None:
        """Monitor adapter health and handle reconnection"""
        adapter = self._adapters[adapter_id]
        
        while adapter_id in self._adapters:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                
                if adapter.is_connected:
                    # Check if adapter is healthy
                    if hasattr(adapter, '_check_connection_health'):
                        is_healthy = await adapter._check_connection_health()
                        if not is_healthy:
                            logger.warning(f"Adapter {adapter_id} health check failed")
                            await self._emit_event('adapter_unhealthy', {
                                'adapter_id': adapter_id,
                                'timestamp': datetime.utcnow().isoformat()
                            })
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor error for adapter {adapter_id}: {e}")
    
    async def shutdown(self) -> None:
        """Shutdown the hardware manager"""
        # Cancel all monitoring tasks
        for task in self._monitoring_tasks.values():
            task.cancel()
        
        if self._monitoring_tasks:
            await asyncio.gather(*self._monitoring_tasks.values(), return_exceptions=True)
        
        # Disconnect all adapters
        await self.disconnect_all()
        
        # Clear all data
        self._adapters.clear()
        self._devices.clear()
        self._monitoring_tasks.clear()
        
        logger.info("Hardware manager shutdown complete")


# Global hardware manager instance
hardware_manager = HardwareManager()