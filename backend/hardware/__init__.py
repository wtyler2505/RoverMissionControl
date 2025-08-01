"""
Hardware Abstraction Layer Protocol Adapters

This module provides a unified interface for various hardware communication protocols
including Serial, I2C, SPI, CAN bus, and Ethernet interfaces.
"""

from .base import (
    ProtocolAdapter,
    ProtocolConfig,
    ProtocolStatus,
    ProtocolError,
    ConnectionState,
    DataPacket,
    ProtocolType
)

from .serial_adapter import SerialAdapter, SerialConfig
from .i2c_adapter import I2CAdapter, I2CConfig
from .spi_adapter import SPIAdapter, SPIConfig
from .can_adapter import CANAdapter, CANConfig
from .ethernet_adapter import EthernetAdapter, EthernetConfig

from .factory import ProtocolAdapterFactory

__all__ = [
    # Base classes
    'ProtocolAdapter',
    'ProtocolConfig',
    'ProtocolStatus',
    'ProtocolError',
    'ConnectionState',
    'DataPacket',
    'ProtocolType',
    
    # Adapters
    'SerialAdapter',
    'SerialConfig',
    'I2CAdapter',
    'I2CConfig',
    'SPIAdapter',
    'SPIConfig',
    'CANAdapter',
    'CANConfig',
    'EthernetAdapter',
    'EthernetConfig',
    
    # Factory
    'ProtocolAdapterFactory'
]