"""
Protocol Adapter Factory
Centralized creation and management of protocol adapters
"""

import logging
from typing import Dict, Type, Any, Optional, List
from enum import Enum

from .base import ProtocolAdapter, ProtocolConfig, ProtocolType
from .serial_adapter import SerialAdapter, SerialConfig
from .i2c_adapter import I2CAdapter, I2CConfig
from .spi_adapter import SPIAdapter, SPIConfig
from .can_adapter import CANAdapter, CANConfig
from .ethernet_adapter import EthernetAdapter, EthernetConfig
from .mock_adapter import MockAdapter, MockConfig


logger = logging.getLogger(__name__)


class ProtocolAdapterFactory:
    """
    Factory class for creating protocol adapters
    """
    
    # Registry of adapter classes
    _adapter_registry: Dict[ProtocolType, Type[ProtocolAdapter]] = {
        ProtocolType.SERIAL: SerialAdapter,
        ProtocolType.I2C: I2CAdapter,
        ProtocolType.SPI: SPIAdapter,
        ProtocolType.CAN: CANAdapter,
        ProtocolType.ETHERNET: EthernetAdapter,
        ProtocolType.MOCK: MockAdapter,
    }
    
    # Registry of configuration classes
    _config_registry: Dict[ProtocolType, Type[ProtocolConfig]] = {
        ProtocolType.SERIAL: SerialConfig,
        ProtocolType.I2C: I2CConfig,
        ProtocolType.SPI: SPIConfig,
        ProtocolType.CAN: CANConfig,
        ProtocolType.ETHERNET: EthernetConfig,
        ProtocolType.MOCK: MockConfig,
    }
    
    # Active adapters
    _active_adapters: Dict[str, ProtocolAdapter] = {}
    
    @classmethod
    def create_adapter(cls, protocol_type: ProtocolType, 
                      config: ProtocolConfig,
                      adapter_id: Optional[str] = None) -> ProtocolAdapter:
        """
        Create a protocol adapter instance
        
        Args:
            protocol_type: Type of protocol adapter to create
            config: Configuration for the adapter
            adapter_id: Optional unique identifier for the adapter
            
        Returns:
            Created adapter instance
            
        Raises:
            ValueError: If protocol type is not supported
            TypeError: If config type doesn't match protocol type
        """
        if protocol_type not in cls._adapter_registry:
            raise ValueError(f"Unsupported protocol type: {protocol_type}")
        
        adapter_class = cls._adapter_registry[protocol_type]
        expected_config_class = cls._config_registry[protocol_type]
        
        if not isinstance(config, expected_config_class):
            raise TypeError(f"Expected {expected_config_class.__name__}, got {type(config).__name__}")
        
        # Create adapter
        adapter = adapter_class(config)
        
        # Register adapter if ID provided
        if adapter_id:
            cls._active_adapters[adapter_id] = adapter
        
        logger.info(f"Created {protocol_type.value} adapter: {config.name}")
        return adapter
    
    @classmethod
    def create_config(cls, protocol_type: ProtocolType, **kwargs) -> ProtocolConfig:
        """
        Create a configuration instance for the specified protocol type
        
        Args:
            protocol_type: Type of protocol
            **kwargs: Configuration parameters
            
        Returns:
            Configuration instance
            
        Raises:
            ValueError: If protocol type is not supported
        """
        if protocol_type not in cls._config_registry:
            raise ValueError(f"Unsupported protocol type: {protocol_type}")
        
        config_class = cls._config_registry[protocol_type]
        return config_class(**kwargs)
    
    @classmethod
    def create_serial_adapter(cls, port: str, baudrate: int = 115200, 
                            adapter_id: Optional[str] = None, **kwargs) -> SerialAdapter:
        """Convenience method to create Serial adapter"""
        config = SerialConfig(
            name=f"Serial_{port}",
            port=port,
            baudrate=baudrate,
            **kwargs
        )
        return cls.create_adapter(ProtocolType.SERIAL, config, adapter_id)
    
    @classmethod
    def create_i2c_adapter(cls, bus_number: int = 1,
                          adapter_id: Optional[str] = None, **kwargs) -> I2CAdapter:
        """Convenience method to create I2C adapter"""
        config = I2CConfig(
            name=f"I2C_Bus{bus_number}",
            bus_number=bus_number,
            **kwargs
        )
        return cls.create_adapter(ProtocolType.I2C, config, adapter_id)
    
    @classmethod
    def create_spi_adapter(cls, bus: int = 0, device: int = 0,
                          adapter_id: Optional[str] = None, **kwargs) -> SPIAdapter:
        """Convenience method to create SPI adapter"""
        config = SPIConfig(
            name=f"SPI_{bus}_{device}",
            bus=bus,
            device=device,
            **kwargs
        )
        return cls.create_adapter(ProtocolType.SPI, config, adapter_id)
    
    @classmethod
    def create_can_adapter(cls, channel: str = "can0", bitrate: int = 500000,
                          adapter_id: Optional[str] = None, **kwargs) -> CANAdapter:
        """Convenience method to create CAN adapter"""
        config = CANConfig(
            name=f"CAN_{channel}",
            channel=channel,
            bitrate=bitrate,
            **kwargs
        )
        return cls.create_adapter(ProtocolType.CAN, config, adapter_id)
    
    @classmethod
    def create_ethernet_adapter(cls, host: str = "localhost", port: int = 8080,
                               adapter_id: Optional[str] = None, **kwargs) -> EthernetAdapter:
        """Convenience method to create Ethernet adapter"""
        config = EthernetConfig(
            name=f"Ethernet_{host}_{port}",
            host=host,
            port=port,
            **kwargs
        )
        return cls.create_adapter(ProtocolType.ETHERNET, config, adapter_id)
    
    @classmethod
    def create_mock_adapter(cls, simulated_protocol: ProtocolType = ProtocolType.SERIAL,
                           adapter_id: Optional[str] = None, **kwargs) -> MockAdapter:
        """Convenience method to create Mock adapter"""
        config = MockConfig(
            name=f"Mock_{simulated_protocol.value}",
            simulated_protocol=simulated_protocol,
            **kwargs
        )
        return cls.create_adapter(ProtocolType.MOCK, config, adapter_id)
    
    @classmethod
    def get_adapter(cls, adapter_id: str) -> Optional[ProtocolAdapter]:
        """Get an active adapter by ID"""
        return cls._active_adapters.get(adapter_id)
    
    @classmethod
    def get_all_adapters(cls) -> Dict[str, ProtocolAdapter]:
        """Get all active adapters"""
        return cls._active_adapters.copy()
    
    @classmethod
    def remove_adapter(cls, adapter_id: str) -> None:
        """Remove and disconnect an adapter"""
        if adapter_id in cls._active_adapters:
            adapter = cls._active_adapters[adapter_id]
            if adapter.is_connected:
                # Note: This is not async, so we can't await disconnect
                # In practice, you'd want to handle this differently
                logger.warning(f"Adapter {adapter_id} is still connected when removing")
            del cls._active_adapters[adapter_id]
    
    @classmethod
    async def disconnect_all(cls) -> None:
        """Disconnect all active adapters"""
        disconnect_tasks = []
        for adapter in cls._active_adapters.values():
            if adapter.is_connected:
                disconnect_tasks.append(adapter.disconnect())
        
        if disconnect_tasks:
            await asyncio.gather(*disconnect_tasks, return_exceptions=True)
    
    @classmethod
    def get_supported_protocols(cls) -> List[ProtocolType]:
        """Get list of supported protocol types"""
        return list(cls._adapter_registry.keys())
    
    @classmethod
    def is_protocol_supported(cls, protocol_type: ProtocolType) -> bool:
        """Check if a protocol type is supported"""
        return protocol_type in cls._adapter_registry
    
    @classmethod
    def register_adapter(cls, protocol_type: ProtocolType, 
                        adapter_class: Type[ProtocolAdapter],
                        config_class: Type[ProtocolConfig]) -> None:
        """
        Register a custom adapter class
        
        Args:
            protocol_type: Protocol type enum value
            adapter_class: Adapter class
            config_class: Configuration class
        """
        if not issubclass(adapter_class, ProtocolAdapter):
            raise TypeError("adapter_class must inherit from ProtocolAdapter")
        
        if not issubclass(config_class, ProtocolConfig):
            raise TypeError("config_class must inherit from ProtocolConfig")
        
        cls._adapter_registry[protocol_type] = adapter_class
        cls._config_registry[protocol_type] = config_class
        
        logger.info(f"Registered custom adapter for {protocol_type.value}")
    
    @classmethod
    def get_adapter_info(cls) -> Dict[str, Dict[str, Any]]:
        """Get information about all registered adapters"""
        info = {}
        for protocol_type, adapter_class in cls._adapter_registry.items():
            config_class = cls._config_registry[protocol_type]
            info[protocol_type.value] = {
                'adapter_class': adapter_class.__name__,
                'config_class': config_class.__name__,
                'module': adapter_class.__module__,
                'active_count': sum(1 for a in cls._active_adapters.values() 
                                  if a.protocol_type == protocol_type)
            }
        return info
    
    @classmethod
    def create_from_dict(cls, config_dict: Dict[str, Any],
                        adapter_id: Optional[str] = None) -> ProtocolAdapter:
        """
        Create adapter from dictionary configuration
        
        Args:
            config_dict: Dictionary containing protocol type and configuration
            adapter_id: Optional adapter ID
            
        Returns:
            Created adapter instance
        """
        if 'protocol_type' not in config_dict:
            raise ValueError("config_dict must contain 'protocol_type'")
        
        protocol_type_str = config_dict.pop('protocol_type')
        try:
            protocol_type = ProtocolType(protocol_type_str)
        except ValueError:
            raise ValueError(f"Invalid protocol type: {protocol_type_str}")
        
        config = cls.create_config(protocol_type, **config_dict)
        return cls.create_adapter(protocol_type, config, adapter_id)
    
    @classmethod
    def create_test_setup(cls) -> Dict[str, ProtocolAdapter]:
        """
        Create a complete test setup with mock adapters for all protocols
        
        Returns:
            Dictionary of adapter_id -> adapter
        """
        test_adapters = {}
        
        # Create mock adapters for each protocol type
        for protocol_type in [ProtocolType.SERIAL, ProtocolType.I2C, 
                             ProtocolType.SPI, ProtocolType.CAN, ProtocolType.ETHERNET]:
            adapter_id = f"test_{protocol_type.value}"
            adapter = cls.create_mock_adapter(
                simulated_protocol=protocol_type,
                adapter_id=adapter_id,
                name=f"Test_{protocol_type.value}",
                connection_delay=0.1,
                transmission_delay=0.01
            )
            test_adapters[adapter_id] = adapter
        
        logger.info(f"Created test setup with {len(test_adapters)} mock adapters")
        return test_adapters


# Import asyncio for disconnect_all method
import asyncio