"""
Mock Protocol Adapter
Simulates hardware communication for testing and development
"""

import asyncio
import logging
import random
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta

from .base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, DataPacket,
    ConnectionError, TransmissionError, ConfigurationError,
    DataDirection, ConnectionState
)


logger = logging.getLogger(__name__)


@dataclass
class MockDevice:
    """Represents a mock device for simulation"""
    device_id: str
    name: str = ""
    response_delay: float = 0.1  # Seconds
    error_rate: float = 0.0  # 0.0 to 1.0
    responses: Dict[bytes, bytes] = field(default_factory=dict)  # Request -> Response
    auto_responses: List[bytes] = field(default_factory=list)  # Periodic messages
    auto_interval: float = 1.0  # Seconds between auto responses


@dataclass
class MockConfig(ProtocolConfig):
    """Configuration for Mock protocol adapter"""
    simulated_protocol: ProtocolType = ProtocolType.SERIAL
    
    # Connection simulation
    connection_delay: float = 0.5  # Time to "connect"
    disconnect_delay: float = 0.2  # Time to "disconnect"
    connection_failure_rate: float = 0.0  # 0.0 to 1.0
    
    # Transmission simulation
    transmission_delay: float = 0.01  # Per byte transmission delay
    transmission_error_rate: float = 0.0  # 0.0 to 1.0
    packet_loss_rate: float = 0.0  # 0.0 to 1.0
    
    # Mock devices
    devices: List[MockDevice] = field(default_factory=list)
    
    # Realistic simulation options
    simulate_noise: bool = False  # Add random noise to responses
    simulate_fragmentation: bool = False  # Fragment large messages
    max_fragment_size: int = 64
    
    # Advanced simulation
    bandwidth_limit: Optional[int] = None  # Bytes per second
    latency_variation: float = 0.0  # Random latency variation (0.0 to 1.0)
    
    def validate(self) -> None:
        """Validate mock configuration"""
        super().validate()
        
        if not 0.0 <= self.connection_failure_rate <= 1.0:
            raise ConfigurationError("Connection failure rate must be between 0.0 and 1.0")
        
        if not 0.0 <= self.transmission_error_rate <= 1.0:
            raise ConfigurationError("Transmission error rate must be between 0.0 and 1.0")
        
        if not 0.0 <= self.packet_loss_rate <= 1.0:
            raise ConfigurationError("Packet loss rate must be between 0.0 and 1.0")


class MockAdapter(ProtocolAdapter):
    """
    Mock protocol adapter for testing and simulation
    """
    
    def __init__(self, config: MockConfig):
        super().__init__(config)
        self.config: MockConfig = config
        self._device_map: Dict[str, MockDevice] = {}
        self._auto_response_tasks: List[asyncio.Task] = []
        self._bandwidth_tokens: int = 0
        self._last_bandwidth_update: datetime = datetime.utcnow()
        self._received_data: List[DataPacket] = []  # Initialize received data queue
        
        # Build device map
        for device in config.devices:
            self._device_map[device.device_id] = device
    
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.MOCK
    
    async def _connect_impl(self) -> None:
        """Simulate connection establishment"""
        # Simulate connection delay
        await asyncio.sleep(self.config.connection_delay)
        
        # Simulate connection failure
        if random.random() < self.config.connection_failure_rate:
            raise ConnectionError("Simulated connection failure")
        
        # Start auto-response tasks for devices
        for device in self._device_map.values():
            if device.auto_responses:
                task = asyncio.create_task(self._auto_response_loop(device))
                self._auto_response_tasks.append(task)
        
        # Initialize bandwidth tokens
        if self.config.bandwidth_limit:
            self._bandwidth_tokens = self.config.bandwidth_limit
            self._last_bandwidth_update = datetime.utcnow()
        
        # Store mock info in metadata
        self._status.metadata['mock_info'] = {
            'simulated_protocol': self.config.simulated_protocol.value,
            'device_count': len(self._device_map),
            'auto_response_tasks': len(self._auto_response_tasks),
            'connection_delay': self.config.connection_delay,
            'transmission_delay': self.config.transmission_delay
        }
        
        logger.info(f"Mock adapter connected (simulating {self.config.simulated_protocol.value})")
    
    async def _disconnect_impl(self) -> None:
        """Simulate disconnection"""
        # Cancel auto-response tasks
        for task in self._auto_response_tasks:
            task.cancel()
        
        # Wait for tasks to complete
        if self._auto_response_tasks:
            await asyncio.gather(*self._auto_response_tasks, return_exceptions=True)
        
        self._auto_response_tasks.clear()
        
        # Simulate disconnect delay
        await asyncio.sleep(self.config.disconnect_delay)
        
        logger.info("Mock adapter disconnected")
    
    async def _write_impl(self, packet: DataPacket) -> None:
        """Simulate data transmission"""
        # Check bandwidth limit
        if self.config.bandwidth_limit:
            await self._check_bandwidth_limit(packet.size)
        
        # Simulate transmission delay
        base_delay = self.config.transmission_delay * packet.size
        if self.config.latency_variation > 0:
            variation = random.uniform(-self.config.latency_variation, self.config.latency_variation)
            delay = max(0, base_delay * (1 + variation))
        else:
            delay = base_delay
        
        await asyncio.sleep(delay)
        
        # Simulate packet loss
        if random.random() < self.config.packet_loss_rate:
            logger.debug("Simulated packet loss")
            return
        
        # Simulate transmission error
        if random.random() < self.config.transmission_error_rate:
            raise TransmissionError("Simulated transmission error")
        
        # Handle device-specific behavior
        device_id = packet.metadata.get('device_id')
        logger.debug(f"MockAdapter._write_impl: device_id={device_id}, data={packet.data}")
        if device_id and device_id in self._device_map:
            device = self._device_map[device_id]
            logger.debug(f"MockAdapter: Found device {device_id}, checking for response to {packet.data}")
            
            # Simulate device error
            if random.random() < device.error_rate:
                raise TransmissionError(f"Simulated device error for {device_id}")
            
            # Generate response if configured
            if packet.data in device.responses:
                response_data = device.responses[packet.data]
                logger.debug(f"MockAdapter: Found response for {packet.data}: {response_data}")
                await asyncio.sleep(device.response_delay)
                
                # Add noise if enabled
                if self.config.simulate_noise:
                    response_data = self._add_noise(response_data)
                
                response_packet = DataPacket(
                    data=response_data,
                    direction=DataDirection.RX,
                    metadata={
                        'device_id': device_id,
                        'response_to': packet.data.hex(),
                        'simulated': True
                    }
                )
                
                # Handle fragmentation
                if self.config.simulate_fragmentation and len(response_data) > self.config.max_fragment_size:
                    await self._send_fragmented_response(response_packet)
                else:
                    await self._handle_received_data(response_packet)
            else:
                logger.debug(f"MockAdapter: No response configured for {packet.data}")
        
        # Update metadata
        packet.metadata.update({
            'simulated': True,
            'transmission_delay': delay,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        """Simulate data reception"""
        # Wait for simulated received data
        logger.debug(f"MockAdapter._read_impl: waiting for data, timeout={timeout}s")
        try:
            async with asyncio.timeout(timeout):
                while True:
                    if hasattr(self, '_received_data') and self._received_data:
                        logger.debug(f"MockAdapter._read_impl: found {len(self._received_data)} packets in queue")
                        packet = self._received_data.pop(0)
                        
                        # Simulate read delay
                        read_delay = self.config.transmission_delay * packet.size
                        logger.debug(f"MockAdapter._read_impl: read_delay={read_delay}s for {packet.size} bytes")
                        await asyncio.sleep(read_delay)
                        
                        logger.debug(f"MockAdapter._read_impl: returning packet with {packet.size} bytes")
                        return packet
                    
                    await asyncio.sleep(0.01)
        except asyncio.TimeoutError:
            logger.debug(f"MockAdapter._read_impl: timeout after {timeout}s")
            raise TransmissionError("Simulated read timeout")
    
    async def _auto_response_loop(self, device: MockDevice) -> None:
        """Generate automatic responses from a device"""
        try:
            while True:
                await asyncio.sleep(device.auto_interval)
                
                if device.auto_responses:
                    # Pick random auto response
                    response_data = random.choice(device.auto_responses)
                    
                    # Add noise if enabled
                    if self.config.simulate_noise:
                        response_data = self._add_noise(response_data)
                    
                    packet = DataPacket(
                        data=response_data,
                        direction=DataDirection.RX,
                        metadata={
                            'device_id': device.device_id,
                            'auto_response': True,
                            'simulated': True
                        }
                    )
                    
                    await self._handle_received_data(packet)
                    
        except asyncio.CancelledError:
            logger.debug(f"Auto response loop cancelled for device {device.device_id}")
    
    async def _handle_received_data(self, packet: DataPacket) -> None:
        """Handle simulated received data"""
        if not hasattr(self, '_received_data'):
            self._received_data = []
        
        self._received_data.append(packet)
        logger.debug(f"MockAdapter: Added response to queue, queue size: {len(self._received_data)}")
        
        await self._emit_event('data_received', {
            'size': packet.size,
            'device_id': packet.metadata.get('device_id'),
            'simulated': True,
            'data': packet.to_hex()
        })
    
    async def _send_fragmented_response(self, packet: DataPacket) -> None:
        """Send response in fragments"""
        data = packet.data
        fragment_size = self.config.max_fragment_size
        
        for i in range(0, len(data), fragment_size):
            fragment_data = data[i:i + fragment_size]
            fragment_packet = DataPacket(
                data=fragment_data,
                direction=DataDirection.RX,
                metadata={
                    **packet.metadata,
                    'fragment': True,
                    'fragment_index': i // fragment_size,
                    'total_fragments': (len(data) + fragment_size - 1) // fragment_size
                }
            )
            
            await self._handle_received_data(fragment_packet)
            
            # Add delay between fragments
            await asyncio.sleep(self.config.transmission_delay * fragment_size)
    
    def _add_noise(self, data: bytes) -> bytes:
        """Add random noise to data"""
        # Simple noise: randomly flip some bits
        noise_level = 0.01  # 1% bit error rate
        noisy_data = bytearray(data)
        
        for i in range(len(noisy_data)):
            for bit in range(8):
                if random.random() < noise_level:
                    noisy_data[i] ^= (1 << bit)
        
        return bytes(noisy_data)
    
    async def _check_bandwidth_limit(self, size: int) -> None:
        """Check and enforce bandwidth limits"""
        if not self.config.bandwidth_limit:
            return
        
        now = datetime.utcnow()
        time_diff = (now - self._last_bandwidth_update).total_seconds()
        
        # Replenish tokens based on time passed
        tokens_to_add = int(self.config.bandwidth_limit * time_diff)
        self._bandwidth_tokens = min(
            self.config.bandwidth_limit,
            self._bandwidth_tokens + tokens_to_add
        )
        self._last_bandwidth_update = now
        
        # Check if we have enough tokens
        if size > self._bandwidth_tokens:
            # Calculate delay needed
            delay = (size - self._bandwidth_tokens) / self.config.bandwidth_limit
            await asyncio.sleep(delay)
            self._bandwidth_tokens = 0
        else:
            self._bandwidth_tokens -= size
    
    # Mock-specific utility methods
    
    def add_device(self, device: MockDevice) -> None:
        """Add a mock device"""
        self._device_map[device.device_id] = device
        self.config.devices.append(device)
        
        # Start auto-response task if connected
        if self.is_connected and device.auto_responses:
            task = asyncio.create_task(self._auto_response_loop(device))
            self._auto_response_tasks.append(task)
    
    def remove_device(self, device_id: str) -> None:
        """Remove a mock device"""
        if device_id in self._device_map:
            del self._device_map[device_id]
            # Remove from config devices list
            self.config.devices = [d for d in self.config.devices if d.device_id != device_id]
    
    def set_device_response(self, device_id: str, request: bytes, response: bytes) -> None:
        """Set a device response for a specific request"""
        if device_id in self._device_map:
            self._device_map[device_id].responses[request] = response
    
    def trigger_device_error(self, device_id: str) -> None:
        """Trigger an immediate error for a device"""
        if device_id in self._device_map:
            self._device_map[device_id].error_rate = 1.0
    
    def clear_device_error(self, device_id: str) -> None:
        """Clear error state for a device"""
        if device_id in self._device_map:
            self._device_map[device_id].error_rate = 0.0
    
    async def inject_data(self, data: bytes, device_id: Optional[str] = None) -> None:
        """Inject data as if received from a device"""
        packet = DataPacket(
            data=data,
            direction=DataDirection.RX,
            metadata={
                'device_id': device_id,
                'injected': True,
                'simulated': True
            }
        )
        await self._handle_received_data(packet)
    
    def simulate_connection_loss(self) -> None:
        """Simulate connection loss"""
        if self.is_connected:
            self._status.state = ConnectionState.ERROR
            self._status.last_error = "Simulated connection loss"
            asyncio.create_task(self._emit_event('connection_lost', {
                'reason': 'simulated',
                'timestamp': datetime.utcnow().isoformat()
            }))
    
    def get_device_info(self, device_id: str) -> Optional[MockDevice]:
        """Get mock device information"""
        return self._device_map.get(device_id)
    
    def get_simulation_stats(self) -> Dict[str, Any]:
        """Get simulation statistics"""
        return {
            'simulated_protocol': self.config.simulated_protocol.value,
            'device_count': len(self._device_map),
            'auto_response_tasks': len(self._auto_response_tasks),
            'bandwidth_tokens': self._bandwidth_tokens if self.config.bandwidth_limit else None,
            'configuration': {
                'connection_delay': self.config.connection_delay,
                'transmission_delay': self.config.transmission_delay,
                'error_rate': self.config.transmission_error_rate,
                'packet_loss_rate': self.config.packet_loss_rate,
                'simulate_noise': self.config.simulate_noise,
                'simulate_fragmentation': self.config.simulate_fragmentation
            }
        }
    
    async def _check_connection_health(self) -> bool:
        """Always healthy for mock adapter"""
        return True