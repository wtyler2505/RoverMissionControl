"""
Hardware and simulation-related data models.
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any, Union
from datetime import datetime
from enum import Enum

class DeviceType(str, Enum):
    """Types of hardware devices."""
    SENSOR = "sensor"
    ACTUATOR = "actuator"
    CONTROLLER = "controller"
    COMMUNICATION = "communication"
    POWER = "power"
    UNKNOWN = "unknown"

class ProtocolType(str, Enum):
    """Communication protocol types."""
    SERIAL = "serial"
    I2C = "i2c"
    SPI = "spi"
    CAN = "can"
    ETHERNET = "ethernet"
    MOCK = "mock"

class DeviceStatus(str, Enum):
    """Device connection status."""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    INITIALIZING = "initializing"
    UNKNOWN = "unknown"

class DeviceCapability(BaseModel):
    """Represents a device capability."""
    name: str
    type: str
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

class DeviceInfo(BaseModel):
    """Information about a hardware device."""
    id: str
    name: str
    type: DeviceType
    protocol: ProtocolType
    address: str
    status: DeviceStatus
    capabilities: List[DeviceCapability] = []
    firmware_version: Optional[str] = None
    last_seen: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None

class SimulationDeviceConfig(BaseModel):
    """Configuration for a simulated device."""
    profile: str = Field(..., description="Device profile to use")
    initial_state: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Initial device state")
    error_rate: Optional[float] = Field(0.0, ge=0.0, le=1.0, description="Error injection rate")
    response_delay: Optional[float] = Field(0.0, ge=0.0, description="Response delay in seconds")

class NetworkConditionConfig(BaseModel):
    """Network simulation conditions."""
    latency_ms: float = Field(0.0, ge=0.0, description="Network latency in milliseconds")
    jitter_ms: float = Field(0.0, ge=0.0, description="Latency variation in milliseconds")
    packet_loss: float = Field(0.0, ge=0.0, le=1.0, description="Packet loss rate")
    bandwidth_limit_mbps: Optional[float] = Field(None, ge=0.0, description="Bandwidth limit in Mbps")
    profile: Optional[str] = Field(None, description="Predefined network profile")

class EnvironmentConfig(BaseModel):
    """Environmental simulation conditions."""
    temperature_c: float = Field(20.0, description="Ambient temperature in Celsius")
    pressure_kpa: float = Field(101.325, description="Atmospheric pressure in kPa")
    humidity_percent: float = Field(50.0, ge=0.0, le=100.0, description="Relative humidity")
    light_level_lux: float = Field(1000.0, ge=0.0, description="Light level in lux")
    vibration_level: float = Field(0.0, ge=0.0, le=10.0, description="Vibration intensity")
    electromagnetic_interference: float = Field(0.0, ge=0.0, le=10.0, description="EMI level")

class SimulationConfig(BaseModel):
    """Configuration for starting a simulation."""
    name: str = Field(..., description="Simulation session name")
    devices: List[SimulationDeviceConfig] = Field(default_factory=list, description="Devices to simulate")
    network_conditions: Optional[NetworkConditionConfig] = None
    environment: Optional[EnvironmentConfig] = None
    auto_discovery: bool = Field(True, description="Enable automatic device discovery")
    record_session: bool = Field(False, description="Record session for playback")

class ScenarioStep(BaseModel):
    """A single step in a simulation scenario."""
    name: str
    action: str
    target: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    delay: Optional[float] = Field(0.0, description="Delay after step in seconds")
    conditions: Optional[Dict[str, Any]] = None

class ScenarioConfig(BaseModel):
    """Configuration for a simulation scenario."""
    id: str
    name: str
    description: Optional[str] = None
    steps: List[ScenarioStep]
    duration: Optional[float] = None
    repeat: int = Field(1, ge=1, description="Number of times to repeat")
    metadata: Optional[Dict[str, Any]] = None

class DiagnosticResult(BaseModel):
    """Result from a diagnostic test."""
    test_name: str
    status: str = Field(..., description="passed, failed, or warning")
    message: str
    details: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None

class CommunicationMetrics(BaseModel):
    """Metrics for device communication."""
    messages_sent: int = 0
    messages_received: int = 0
    errors: int = 0
    average_latency_ms: float = 0.0
    uptime_seconds: float = 0.0
    last_error: Optional[str] = None

class FirmwareInfo(BaseModel):
    """Firmware information and update status."""
    device_id: str
    current_version: str
    available_version: Optional[str] = None
    update_available: bool = False
    last_update: Optional[datetime] = None
    update_status: Optional[str] = None

class DeviceProfileDefinition(BaseModel):
    """Definition of a device behavior profile."""
    name: str
    type: DeviceType
    description: str
    parameters: Dict[str, Any]
    capabilities: List[str]
    error_modes: Optional[List[str]] = None
    response_patterns: Optional[Dict[str, Any]] = None