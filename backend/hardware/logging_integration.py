"""
Integration layer between hardware adapters and communication logging
Provides automatic logging hooks and middleware for all protocol adapters
"""

import asyncio
import logging
from typing import Any, Dict, Optional, Callable, List
from functools import wraps
from datetime import datetime

from .base import (
    ProtocolAdapter, ProtocolType, DataPacket, 
    DataDirection, ConnectionState
)
from .manager import HardwareManager, HardwareDevice
from .communication_logger import (
    CommunicationLogger, LogLevel, CommunicationLogEntry,
    get_logger
)
from .protocol_analyzers import ProtocolAnalyzerFactory, AnalysisResult


logger = logging.getLogger(__name__)


class LoggingProtocolAdapter:
    """
    Wrapper for protocol adapters that adds automatic logging
    Uses decorator pattern to add logging without modifying adapters
    """
    
    def __init__(self, 
                 adapter: ProtocolAdapter,
                 adapter_id: str,
                 comm_logger: Optional[CommunicationLogger] = None,
                 log_level: LogLevel = LogLevel.INFO,
                 enable_analysis: bool = True):
        self._adapter = adapter
        self._adapter_id = adapter_id
        self._comm_logger = comm_logger or get_logger()
        self._log_level = log_level
        self._enable_analysis = enable_analysis
        
        # Create protocol analyzer if analysis is enabled
        if enable_analysis:
            try:
                self._analyzer = ProtocolAnalyzerFactory.create_analyzer(
                    adapter.protocol_type
                )
            except ValueError:
                logger.warning(f"No analyzer available for {adapter.protocol_type.value}")
                self._analyzer = None
        else:
            self._analyzer = None
        
        # Wrap adapter methods
        self._wrap_methods()
        
        # Register event handlers
        self._register_handlers()
    
    def _wrap_methods(self) -> None:
        """Wrap adapter methods with logging"""
        # Store original methods
        self._original_connect = self._adapter.connect
        self._original_disconnect = self._adapter.disconnect
        self._original_write = self._adapter.write
        self._original_read = self._adapter.read
        
        # Replace with wrapped versions
        self._adapter.connect = self._logged_connect
        self._adapter.disconnect = self._logged_disconnect
        self._adapter.write = self._logged_write
        self._adapter.read = self._logged_read
    
    def _register_handlers(self) -> None:
        """Register event handlers for logging"""
        self._adapter.register_event_handler('connected', self._on_connected)
        self._adapter.register_event_handler('disconnected', self._on_disconnected)
        self._adapter.register_event_handler('error', self._on_error)
    
    async def _logged_connect(self) -> None:
        """Logged version of connect"""
        start_time = datetime.utcnow()
        
        try:
            await self._original_connect()
            
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            if self._comm_logger:
                await self._comm_logger.log(
                    adapter_id=self._adapter_id,
                    protocol_type=self._adapter.protocol_type,
                    direction=DataDirection.BIDIRECTIONAL,
                    level=LogLevel.INFO,
                    message=f"Connected successfully",
                    metadata={
                        'config': self._adapter.config.__dict__,
                        'duration_ms': duration_ms
                    },
                    duration_ms=duration_ms
                )
        
        except Exception as e:
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            if self._comm_logger:
                await self._comm_logger.log_error(
                    adapter_id=self._adapter_id,
                    protocol_type=self._adapter.protocol_type,
                    error=str(e),
                    metadata={'duration_ms': duration_ms}
                )
            raise
    
    async def _logged_disconnect(self) -> None:
        """Logged version of disconnect"""
        if self._comm_logger:
            await self._comm_logger.log(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                direction=DataDirection.BIDIRECTIONAL,
                level=LogLevel.INFO,
                message="Disconnecting"
            )
        
        await self._original_disconnect()
    
    async def _logged_write(self, data: Union[bytes, DataPacket], **kwargs) -> None:
        """Logged version of write"""
        packet = data if isinstance(data, DataPacket) else DataPacket(
            data=data,
            direction=DataDirection.TX,
            metadata=kwargs
        )
        
        # Log at trace level for data
        if self._comm_logger:
            await self._comm_logger.log_packet(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                packet=packet,
                level=LogLevel.TRACE,
                device_id=kwargs.get('device_id')
            )
        
        # Perform analysis if enabled
        if self._analyzer and self._log_level <= LogLevel.DEBUG:
            try:
                analysis = self._analyzer.analyze_packet(packet)
                await self._log_analysis(analysis, packet)
            except Exception as e:
                logger.error(f"Analysis error: {e}")
        
        # Call original method
        await self._original_write(data, **kwargs)
    
    async def _logged_read(self, size: Optional[int] = None, 
                          timeout: Optional[float] = None) -> DataPacket:
        """Logged version of read"""
        start_time = datetime.utcnow()
        
        try:
            packet = await self._original_read(size, timeout)
            
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            # Log at trace level for data
            if self._comm_logger:
                await self._comm_logger.log_packet(
                    adapter_id=self._adapter_id,
                    protocol_type=self._adapter.protocol_type,
                    packet=packet,
                    level=LogLevel.TRACE,
                    device_id=packet.metadata.get('device_id')
                )
            
            # Perform analysis if enabled
            if self._analyzer and self._log_level <= LogLevel.DEBUG:
                try:
                    analysis = self._analyzer.analyze_packet(packet)
                    await self._log_analysis(analysis, packet)
                except Exception as e:
                    logger.error(f"Analysis error: {e}")
            
            return packet
            
        except asyncio.TimeoutError:
            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000
            
            if self._comm_logger:
                await self._comm_logger.log(
                    adapter_id=self._adapter_id,
                    protocol_type=self._adapter.protocol_type,
                    direction=DataDirection.RX,
                    level=LogLevel.WARNING,
                    message=f"Read timeout after {timeout}s",
                    duration_ms=duration_ms
                )
            raise
    
    async def _log_analysis(self, analysis: AnalysisResult, packet: DataPacket) -> None:
        """Log analysis results"""
        if not self._comm_logger:
            return
        
        # Log warnings
        for warning in analysis.warnings:
            await self._comm_logger.log(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                direction=packet.direction,
                level=LogLevel.WARNING,
                message=f"Analysis warning: {warning}",
                metadata={'analysis': analysis.details}
            )
        
        # Log errors
        for error in analysis.errors:
            await self._comm_logger.log(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                direction=packet.direction,
                level=LogLevel.ERROR,
                message=f"Analysis error: {error}",
                metadata={'analysis': analysis.details}
            )
        
        # Log analysis summary at debug level
        if self._log_level <= LogLevel.DEBUG:
            await self._comm_logger.log(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                direction=packet.direction,
                level=LogLevel.DEBUG,
                message=f"Analysis: {analysis.summary}",
                metadata={'analysis': analysis.details}
            )
    
    async def _on_connected(self, data: Dict[str, Any]) -> None:
        """Handle connected event"""
        if self._comm_logger:
            await self._comm_logger.log_connection_event(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                event='connected',
                state=ConnectionState.CONNECTED,
                metadata=data
            )
    
    async def _on_disconnected(self, data: Dict[str, Any]) -> None:
        """Handle disconnected event"""
        if self._comm_logger:
            await self._comm_logger.log_connection_event(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                event='disconnected',
                state=ConnectionState.DISCONNECTED,
                metadata=data
            )
    
    async def _on_error(self, data: Dict[str, Any]) -> None:
        """Handle error event"""
        if self._comm_logger:
            await self._comm_logger.log_error(
                adapter_id=self._adapter_id,
                protocol_type=self._adapter.protocol_type,
                error=data.get('error', 'Unknown error'),
                metadata=data
            )
    
    def unwrap(self) -> ProtocolAdapter:
        """Get the original unwrapped adapter"""
        # Restore original methods
        self._adapter.connect = self._original_connect
        self._adapter.disconnect = self._original_disconnect
        self._adapter.write = self._original_write
        self._adapter.read = self._original_read
        
        return self._adapter


class LoggingHardwareManager(HardwareManager):
    """
    Extended hardware manager with integrated communication logging
    """
    
    def __init__(self, comm_logger: Optional[CommunicationLogger] = None):
        super().__init__()
        self._comm_logger = comm_logger or get_logger()
        self._wrapped_adapters: Dict[str, LoggingProtocolAdapter] = {}
        self._logging_config = {
            'default_level': LogLevel.INFO,
            'enable_analysis': True,
            'adapter_levels': {}
        }
    
    def set_logging_level(self, level: LogLevel, adapter_id: Optional[str] = None) -> None:
        """Set logging level for all adapters or specific adapter"""
        if adapter_id:
            self._logging_config['adapter_levels'][adapter_id] = level
            # Update wrapped adapter if it exists
            if adapter_id in self._wrapped_adapters:
                self._wrapped_adapters[adapter_id]._log_level = level
        else:
            self._logging_config['default_level'] = level
            # Update all wrapped adapters
            for wrapped in self._wrapped_adapters.values():
                wrapped._log_level = level
    
    def enable_analysis(self, enabled: bool = True) -> None:
        """Enable or disable protocol analysis"""
        self._logging_config['enable_analysis'] = enabled
        # Update all wrapped adapters
        for wrapped in self._wrapped_adapters.values():
            wrapped._enable_analysis = enabled
    
    async def add_adapter(self, adapter_id: str, adapter: ProtocolAdapter) -> None:
        """Add adapter with automatic logging wrapper"""
        # Wrap adapter with logging
        log_level = self._logging_config['adapter_levels'].get(
            adapter_id, 
            self._logging_config['default_level']
        )
        
        wrapped = LoggingProtocolAdapter(
            adapter=adapter,
            adapter_id=adapter_id,
            comm_logger=self._comm_logger,
            log_level=log_level,
            enable_analysis=self._logging_config['enable_analysis']
        )
        
        self._wrapped_adapters[adapter_id] = wrapped
        
        # Call parent method
        await super().add_adapter(adapter_id, adapter)
    
    async def remove_adapter(self, adapter_id: str) -> None:
        """Remove adapter and unwrap logging"""
        if adapter_id in self._wrapped_adapters:
            # Unwrap the adapter
            wrapped = self._wrapped_adapters[adapter_id]
            wrapped.unwrap()
            del self._wrapped_adapters[adapter_id]
        
        # Call parent method
        await super().remove_adapter(adapter_id)
    
    async def send_command_to_device(self, device_id: str, data: bytes, 
                                   **kwargs) -> DataPacket:
        """Send command with automatic logging"""
        if self._comm_logger:
            # Create correlation ID for request-response tracking
            correlation_id = f"{device_id}_{datetime.utcnow().timestamp()}"
            
            async with self._comm_logger.timed_operation(
                adapter_id=self._devices[device_id].adapter_id,
                protocol_type=self._devices[device_id].protocol_type,
                operation=f"Command to {device_id}",
                correlation_id=correlation_id
            ):
                # Add correlation ID to kwargs
                kwargs['correlation_id'] = correlation_id
                response = await super().send_command_to_device(device_id, data, **kwargs)
                return response
        else:
            return await super().send_command_to_device(device_id, data, **kwargs)
    
    async def get_communication_statistics(self) -> Dict[str, Any]:
        """Get communication statistics from logger"""
        if self._comm_logger:
            return await self._comm_logger.get_statistics()
        return {}
    
    async def search_communication_logs(self, 
                                      adapter_id: Optional[str] = None,
                                      device_id: Optional[str] = None,
                                      start_time: Optional[datetime] = None,
                                      end_time: Optional[datetime] = None,
                                      level: Optional[LogLevel] = None,
                                      limit: int = 100) -> List[CommunicationLogEntry]:
        """Search communication logs"""
        if not self._comm_logger:
            return []
        
        from .communication_logger import LogFilter
        
        filter = LogFilter(
            adapter_ids=[adapter_id] if adapter_id else None,
            device_ids=[device_id] if device_id else None,
            start_time=start_time,
            end_time=end_time,
            levels=[level] if level else None
        )
        
        return await self._comm_logger.search(filter, limit)
    
    def add_log_stream_handler(self, handler: Callable[[CommunicationLogEntry], None]) -> None:
        """Add real-time log stream handler"""
        if self._comm_logger:
            self._comm_logger.add_stream_handler(handler)
    
    def remove_log_stream_handler(self, handler: Callable[[CommunicationLogEntry], None]) -> None:
        """Remove log stream handler"""
        if self._comm_logger:
            self._comm_logger.remove_stream_handler(handler)


def create_logging_hardware_manager(comm_logger: Optional[CommunicationLogger] = None) -> LoggingHardwareManager:
    """Create hardware manager with logging integration"""
    return LoggingHardwareManager(comm_logger)
