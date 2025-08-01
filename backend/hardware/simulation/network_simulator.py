"""
Network Condition Simulator
Simulates various network conditions including latency, packet loss, and bandwidth limitations
"""

from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional, Tuple, Callable
from enum import Enum
import asyncio
import random
import time
from collections import deque
from datetime import datetime, timedelta
import math


class NetworkConditionType(Enum):
    """Types of network conditions"""
    PERFECT = "perfect"
    SATELLITE = "satellite"
    CELLULAR_4G = "cellular_4g"
    CELLULAR_3G = "cellular_3g"
    WIFI_GOOD = "wifi_good"
    WIFI_POOR = "wifi_poor"
    CONGESTED = "congested"
    INTERMITTENT = "intermittent"
    CUSTOM = "custom"


@dataclass
class NetworkStats:
    """Network performance statistics"""
    packets_sent: int = 0
    packets_received: int = 0
    packets_lost: int = 0
    packets_corrupted: int = 0
    packets_duplicated: int = 0
    packets_reordered: int = 0
    
    bytes_sent: int = 0
    bytes_received: int = 0
    
    min_latency: float = float('inf')
    max_latency: float = 0.0
    avg_latency: float = 0.0
    latency_samples: List[float] = field(default_factory=list)
    
    connection_drops: int = 0
    last_drop_time: Optional[datetime] = None
    
    def update_latency(self, latency: float):
        """Update latency statistics"""
        self.latency_samples.append(latency)
        self.min_latency = min(self.min_latency, latency)
        self.max_latency = max(self.max_latency, latency)
        self.avg_latency = sum(self.latency_samples) / len(self.latency_samples)
    
    def get_loss_rate(self) -> float:
        """Calculate packet loss rate"""
        total = self.packets_sent
        if total == 0:
            return 0.0
        return self.packets_lost / total
    
    def get_throughput(self, duration: float) -> float:
        """Calculate throughput in bytes per second"""
        if duration <= 0:
            return 0.0
        return self.bytes_received / duration


@dataclass
class PacketInfo:
    """Information about a network packet"""
    packet_id: int
    data: bytes
    size: int
    timestamp: float
    source: str = ""
    destination: str = ""
    protocol: str = "tcp"
    priority: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NetworkProfile:
    """Network condition profile"""
    name: str
    
    # Latency parameters (milliseconds)
    latency_base: float = 0.0  # Base latency
    latency_variation: float = 0.0  # Random variation
    latency_spike_probability: float = 0.0  # Probability of latency spike
    latency_spike_multiplier: float = 5.0  # Spike multiplier
    
    # Packet loss parameters
    packet_loss_rate: float = 0.0  # Base packet loss rate (0.0 to 1.0)
    burst_loss_probability: float = 0.0  # Probability of burst loss
    burst_loss_duration: float = 1.0  # Duration of burst loss (seconds)
    
    # Bandwidth parameters
    bandwidth_limit: float = float('inf')  # Bytes per second
    bandwidth_variation: float = 0.0  # Bandwidth variation (0.0 to 1.0)
    
    # Connection stability
    connection_drop_rate: float = 0.0  # Drops per hour
    connection_recovery_time: float = 5.0  # Seconds to recover
    
    # Packet corruption
    corruption_rate: float = 0.0  # Probability of corruption
    
    # Packet duplication
    duplication_rate: float = 0.0  # Probability of duplication
    
    # Packet reordering
    reorder_rate: float = 0.0  # Probability of reordering
    reorder_delay: float = 100.0  # Delay for reordered packets (ms)
    
    # Asymmetric conditions
    upload_multiplier: float = 1.0  # Upload speed relative to download
    
    # Time-based variations
    enable_time_patterns: bool = False  # Enable time-based patterns
    peak_hours: List[int] = field(default_factory=lambda: [9, 17])  # Peak usage hours
    peak_degradation: float = 0.5  # Performance degradation during peak


@dataclass
class NetworkCondition:
    """Current network condition state"""
    profile: NetworkProfile
    is_connected: bool = True
    current_bandwidth: float = 0.0
    current_latency: float = 0.0
    in_burst_loss: bool = False
    burst_loss_end_time: float = 0.0
    last_update_time: float = field(default_factory=time.time)
    
    # Packet queues
    send_queue: deque = field(default_factory=deque)
    receive_queue: deque = field(default_factory=deque)
    reorder_buffer: List[Tuple[float, PacketInfo]] = field(default_factory=list)
    
    # Statistics
    stats: NetworkStats = field(default_factory=NetworkStats)


class NetworkSimulator:
    """Simulates network conditions for testing"""
    
    def __init__(self, profile: NetworkProfile = None):
        self.profile = profile or self._create_perfect_profile()
        self.condition = NetworkCondition(profile=self.profile)
        self.packet_counter = 0
        self.start_time = time.time()
        self._tasks: List[asyncio.Task] = []
        self._running = False
        self._packet_handlers: List[Callable[[PacketInfo], None]] = []
    
    def _create_perfect_profile(self) -> NetworkProfile:
        """Create a perfect network profile"""
        return NetworkProfile(
            name="perfect",
            latency_base=0.0,
            packet_loss_rate=0.0,
            bandwidth_limit=float('inf')
        )
    
    async def start(self):
        """Start network simulation"""
        self._running = True
        
        # Start background tasks
        self._tasks.append(asyncio.create_task(self._process_send_queue()))
        self._tasks.append(asyncio.create_task(self._process_receive_queue()))
        self._tasks.append(asyncio.create_task(self._update_conditions()))
        self._tasks.append(asyncio.create_task(self._simulate_connection_drops()))
    
    async def stop(self):
        """Stop network simulation"""
        self._running = False
        
        # Cancel all tasks
        for task in self._tasks:
            task.cancel()
        
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
        
        self._tasks.clear()
    
    async def send_packet(self, data: bytes, source: str = "", 
                         destination: str = "", priority: int = 0) -> bool:
        """Simulate sending a packet"""
        if not self.condition.is_connected:
            self.condition.stats.packets_lost += 1
            return False
        
        # Create packet info
        packet = PacketInfo(
            packet_id=self.packet_counter,
            data=data,
            size=len(data),
            timestamp=time.time(),
            source=source,
            destination=destination,
            priority=priority
        )
        self.packet_counter += 1
        
        # Update stats
        self.condition.stats.packets_sent += 1
        self.condition.stats.bytes_sent += packet.size
        
        # Add to send queue
        self.condition.send_queue.append(packet)
        
        return True
    
    async def receive_packet(self, timeout: float = 1.0) -> Optional[PacketInfo]:
        """Receive a packet from the network"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            if self.condition.receive_queue:
                packet = self.condition.receive_queue.popleft()
                
                # Update stats
                self.condition.stats.packets_received += 1
                self.condition.stats.bytes_received += packet.size
                
                # Calculate actual latency
                actual_latency = (time.time() - packet.timestamp) * 1000  # ms
                self.condition.stats.update_latency(actual_latency)
                
                # Notify handlers
                for handler in self._packet_handlers:
                    handler(packet)
                
                return packet
            
            await asyncio.sleep(0.001)  # 1ms polling interval
        
        return None
    
    def add_packet_handler(self, handler: Callable[[PacketInfo], None]):
        """Add a packet reception handler"""
        self._packet_handlers.append(handler)
    
    def remove_packet_handler(self, handler: Callable[[PacketInfo], None]):
        """Remove a packet reception handler"""
        if handler in self._packet_handlers:
            self._packet_handlers.remove(handler)
    
    async def _process_send_queue(self):
        """Process packets in the send queue"""
        while self._running:
            if not self.condition.send_queue:
                await asyncio.sleep(0.001)
                continue
            
            packet = self.condition.send_queue.popleft()
            
            # Check bandwidth limit
            if self.profile.bandwidth_limit < float('inf'):
                transfer_time = packet.size / self.condition.current_bandwidth
                await asyncio.sleep(transfer_time)
            
            # Simulate packet loss
            if self._should_lose_packet():
                self.condition.stats.packets_lost += 1
                continue
            
            # Calculate latency
            latency = self._calculate_latency()
            
            # Simulate packet corruption
            if random.random() < self.profile.corruption_rate:
                # Corrupt the packet data
                corrupted_data = bytearray(packet.data)
                corruption_pos = random.randint(0, len(corrupted_data) - 1)
                corrupted_data[corruption_pos] ^= random.randint(1, 255)
                packet.data = bytes(corrupted_data)
                packet.metadata['corrupted'] = True
                self.condition.stats.packets_corrupted += 1
            
            # Simulate packet duplication
            if random.random() < self.profile.duplication_rate:
                # Duplicate the packet
                dup_packet = PacketInfo(
                    packet_id=packet.packet_id,
                    data=packet.data,
                    size=packet.size,
                    timestamp=packet.timestamp,
                    source=packet.source,
                    destination=packet.destination,
                    priority=packet.priority,
                    metadata={**packet.metadata, 'duplicated': True}
                )
                self.condition.stats.packets_duplicated += 1
                
                # Schedule duplicate delivery
                asyncio.create_task(self._deliver_packet(dup_packet, latency + 10))
            
            # Simulate packet reordering
            if random.random() < self.profile.reorder_rate:
                # Delay this packet
                deliver_time = time.time() + (latency + self.profile.reorder_delay) / 1000
                self.condition.reorder_buffer.append((deliver_time, packet))
                self.condition.stats.packets_reordered += 1
            else:
                # Normal delivery
                await self._deliver_packet(packet, latency)
    
    async def _deliver_packet(self, packet: PacketInfo, latency_ms: float):
        """Deliver a packet after simulated latency"""
        await asyncio.sleep(latency_ms / 1000)
        
        if self.condition.is_connected:
            self.condition.receive_queue.append(packet)
    
    async def _process_receive_queue(self):
        """Process reordered packets"""
        while self._running:
            current_time = time.time()
            
            # Check reorder buffer
            delivered = []
            for i, (deliver_time, packet) in enumerate(self.condition.reorder_buffer):
                if current_time >= deliver_time:
                    self.condition.receive_queue.append(packet)
                    delivered.append(i)
            
            # Remove delivered packets
            for i in reversed(delivered):
                self.condition.reorder_buffer.pop(i)
            
            await asyncio.sleep(0.01)  # 10ms interval
    
    async def _update_conditions(self):
        """Update network conditions based on profile"""
        while self._running:
            current_time = time.time()
            
            # Update bandwidth
            self.condition.current_bandwidth = self._calculate_bandwidth()
            
            # Update burst loss state
            if self.condition.in_burst_loss and current_time > self.condition.burst_loss_end_time:
                self.condition.in_burst_loss = False
            elif not self.condition.in_burst_loss and random.random() < self.profile.burst_loss_probability:
                self.condition.in_burst_loss = True
                self.condition.burst_loss_end_time = current_time + self.profile.burst_loss_duration
            
            # Update based on time patterns
            if self.profile.enable_time_patterns:
                hour = datetime.now().hour
                if self.profile.peak_hours[0] <= hour <= self.profile.peak_hours[1]:
                    # Apply peak hour degradation
                    self.condition.current_bandwidth *= (1 - self.profile.peak_degradation)
            
            self.condition.last_update_time = current_time
            
            await asyncio.sleep(1.0)  # Update every second
    
    async def _simulate_connection_drops(self):
        """Simulate random connection drops"""
        while self._running:
            if self.profile.connection_drop_rate > 0:
                # Calculate time until next drop
                drops_per_second = self.profile.connection_drop_rate / 3600
                if drops_per_second > 0:
                    wait_time = random.expovariate(drops_per_second)
                    await asyncio.sleep(wait_time)
                    
                    if self._running and self.condition.is_connected:
                        # Drop connection
                        self.condition.is_connected = False
                        self.condition.stats.connection_drops += 1
                        self.condition.stats.last_drop_time = datetime.now()
                        
                        # Schedule recovery
                        recovery_time = random.uniform(
                            self.profile.connection_recovery_time * 0.5,
                            self.profile.connection_recovery_time * 1.5
                        )
                        await asyncio.sleep(recovery_time)
                        
                        # Restore connection
                        self.condition.is_connected = True
                else:
                    await asyncio.sleep(60)  # Check every minute
            else:
                await asyncio.sleep(60)  # Check every minute
    
    def _calculate_latency(self) -> float:
        """Calculate current latency in milliseconds"""
        base_latency = self.profile.latency_base
        
        # Add random variation
        if self.profile.latency_variation > 0:
            variation = random.gauss(0, self.profile.latency_variation)
            base_latency += variation
        
        # Add latency spikes
        if random.random() < self.profile.latency_spike_probability:
            base_latency *= self.profile.latency_spike_multiplier
        
        # Ensure non-negative
        return max(0, base_latency)
    
    def _calculate_bandwidth(self) -> float:
        """Calculate current bandwidth in bytes per second"""
        if self.profile.bandwidth_limit == float('inf'):
            return float('inf')
        
        base_bandwidth = self.profile.bandwidth_limit
        
        # Add variation
        if self.profile.bandwidth_variation > 0:
            variation = random.uniform(
                -self.profile.bandwidth_variation,
                self.profile.bandwidth_variation
            )
            base_bandwidth *= (1 + variation)
        
        # Ensure positive
        return max(1, base_bandwidth)
    
    def _should_lose_packet(self) -> bool:
        """Determine if a packet should be lost"""
        if self.condition.in_burst_loss:
            return True
        
        return random.random() < self.profile.packet_loss_rate
    
    def get_stats(self) -> NetworkStats:
        """Get current network statistics"""
        return self.condition.stats
    
    def reset_stats(self):
        """Reset network statistics"""
        self.condition.stats = NetworkStats()
    
    def set_profile(self, profile: NetworkProfile):
        """Change network profile"""
        self.profile = profile
        self.condition.profile = profile


def create_network_profiles() -> Dict[str, NetworkProfile]:
    """Create predefined network profiles"""
    profiles = {}
    
    # Perfect network
    profiles['perfect'] = NetworkProfile(
        name='perfect',
        latency_base=0.1,
        packet_loss_rate=0.0,
        bandwidth_limit=float('inf')
    )
    
    # Satellite connection
    profiles['satellite'] = NetworkProfile(
        name='satellite',
        latency_base=600.0,  # 600ms base latency
        latency_variation=50.0,
        latency_spike_probability=0.05,
        packet_loss_rate=0.01,
        bandwidth_limit=10 * 1024 * 1024,  # 10 Mbps
        upload_multiplier=0.1  # Asymmetric
    )
    
    # 4G Cellular
    profiles['cellular_4g'] = NetworkProfile(
        name='cellular_4g',
        latency_base=50.0,
        latency_variation=20.0,
        latency_spike_probability=0.1,
        packet_loss_rate=0.005,
        burst_loss_probability=0.01,
        bandwidth_limit=50 * 1024 * 1024,  # 50 Mbps
        bandwidth_variation=0.3,
        connection_drop_rate=0.5  # 0.5 drops per hour
    )
    
    # 3G Cellular
    profiles['cellular_3g'] = NetworkProfile(
        name='cellular_3g',
        latency_base=150.0,
        latency_variation=50.0,
        latency_spike_probability=0.2,
        packet_loss_rate=0.02,
        burst_loss_probability=0.05,
        bandwidth_limit=2 * 1024 * 1024,  # 2 Mbps
        bandwidth_variation=0.5,
        connection_drop_rate=2.0  # 2 drops per hour
    )
    
    # Good WiFi
    profiles['wifi_good'] = NetworkProfile(
        name='wifi_good',
        latency_base=5.0,
        latency_variation=2.0,
        packet_loss_rate=0.001,
        bandwidth_limit=100 * 1024 * 1024,  # 100 Mbps
        bandwidth_variation=0.1
    )
    
    # Poor WiFi
    profiles['wifi_poor'] = NetworkProfile(
        name='wifi_poor',
        latency_base=50.0,
        latency_variation=30.0,
        latency_spike_probability=0.15,
        packet_loss_rate=0.05,
        burst_loss_probability=0.1,
        bandwidth_limit=5 * 1024 * 1024,  # 5 Mbps
        bandwidth_variation=0.5,
        connection_drop_rate=5.0,  # 5 drops per hour
        reorder_rate=0.02
    )
    
    # Congested network
    profiles['congested'] = NetworkProfile(
        name='congested',
        latency_base=100.0,
        latency_variation=100.0,
        latency_spike_probability=0.3,
        latency_spike_multiplier=10.0,
        packet_loss_rate=0.1,
        bandwidth_limit=1 * 1024 * 1024,  # 1 Mbps
        bandwidth_variation=0.7,
        reorder_rate=0.1,
        enable_time_patterns=True,
        peak_degradation=0.8
    )
    
    # Intermittent connection
    profiles['intermittent'] = NetworkProfile(
        name='intermittent',
        latency_base=30.0,
        latency_variation=20.0,
        packet_loss_rate=0.01,
        burst_loss_probability=0.2,
        burst_loss_duration=5.0,
        bandwidth_limit=20 * 1024 * 1024,  # 20 Mbps
        connection_drop_rate=10.0,  # 10 drops per hour
        connection_recovery_time=30.0
    )
    
    return profiles