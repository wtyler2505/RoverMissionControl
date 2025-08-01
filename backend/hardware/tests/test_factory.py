"""
Tests for Protocol Adapter Factory
"""

import pytest
from typing import Type

from ..factory import ProtocolAdapterFactory
from ..base import ProtocolType, ProtocolAdapter, ProtocolConfig
from ..serial_adapter import SerialAdapter, SerialConfig
from ..i2c_adapter import I2CAdapter, I2CConfig
from ..mock_adapter import MockAdapter, MockConfig


class TestProtocolAdapterFactory:
    """Test cases for ProtocolAdapterFactory"""
    
    def test_supported_protocols(self):
        """Test getting supported protocols"""
        protocols = ProtocolAdapterFactory.get_supported_protocols()
        
        assert ProtocolType.SERIAL in protocols
        assert ProtocolType.I2C in protocols
        assert ProtocolType.SPI in protocols
        assert ProtocolType.CAN in protocols
        assert ProtocolType.ETHERNET in protocols
        assert ProtocolType.MOCK in protocols
    
    def test_is_protocol_supported(self):
        """Test protocol support checking"""
        assert ProtocolAdapterFactory.is_protocol_supported(ProtocolType.SERIAL)
        assert ProtocolAdapterFactory.is_protocol_supported(ProtocolType.MOCK)
    
    def test_create_config(self):
        """Test configuration creation"""
        # Create serial config
        config = ProtocolAdapterFactory.create_config(
            ProtocolType.SERIAL,
            name="test_serial",
            port="COM1",
            baudrate=9600
        )
        assert isinstance(config, SerialConfig)
        assert config.name == "test_serial"
        assert config.port == "COM1"
        assert config.baudrate == 9600
        
        # Create mock config
        config = ProtocolAdapterFactory.create_config(
            ProtocolType.MOCK,
            name="test_mock",
            simulated_protocol=ProtocolType.I2C
        )
        assert isinstance(config, MockConfig)
        assert config.name == "test_mock"
        assert config.simulated_protocol == ProtocolType.I2C
    
    def test_create_adapter(self):
        """Test adapter creation"""
        # Create mock adapter
        config = MockConfig(
            name="test_adapter",
            simulated_protocol=ProtocolType.SERIAL
        )
        
        adapter = ProtocolAdapterFactory.create_adapter(
            ProtocolType.MOCK,
            config,
            adapter_id="test_id"
        )
        
        assert isinstance(adapter, MockAdapter)
        assert adapter.protocol_type == ProtocolType.MOCK
        assert adapter.config.name == "test_adapter"
        
        # Check it was registered
        assert ProtocolAdapterFactory.get_adapter("test_id") == adapter
    
    def test_create_adapter_type_mismatch(self):
        """Test adapter creation with wrong config type"""
        # Try to create I2C adapter with Serial config
        config = SerialConfig(name="wrong", port="COM1")
        
        with pytest.raises(TypeError):
            ProtocolAdapterFactory.create_adapter(ProtocolType.I2C, config)
    
    def test_create_adapter_unsupported_protocol(self):
        """Test adapter creation with unsupported protocol"""
        config = MockConfig(name="test")
        
        # Create a fake protocol type
        fake_protocol = "fake_protocol"
        
        with pytest.raises(ValueError):
            ProtocolAdapterFactory.create_adapter(fake_protocol, config)
    
    def test_convenience_methods(self):
        """Test convenience adapter creation methods"""
        # Mock adapter
        adapter = ProtocolAdapterFactory.create_mock_adapter(
            simulated_protocol=ProtocolType.SERIAL,
            adapter_id="mock_test"
        )
        assert isinstance(adapter, MockAdapter)
        assert adapter.config.simulated_protocol == ProtocolType.SERIAL
        
        # Check registration
        assert ProtocolAdapterFactory.get_adapter("mock_test") == adapter
    
    def test_adapter_management(self):
        """Test adapter management operations"""
        # Create adapter
        adapter = ProtocolAdapterFactory.create_mock_adapter(
            adapter_id="mgmt_test"
        )
        
        # Get all adapters
        all_adapters = ProtocolAdapterFactory.get_all_adapters()
        assert "mgmt_test" in all_adapters
        
        # Remove adapter
        ProtocolAdapterFactory.remove_adapter("mgmt_test")
        assert ProtocolAdapterFactory.get_adapter("mgmt_test") is None
    
    def test_create_from_dict(self):
        """Test creating adapter from dictionary"""
        config_dict = {
            'protocol_type': 'mock',
            'name': 'dict_test',
            'simulated_protocol': 'serial',
            'connection_delay': 0.1
        }
        
        adapter = ProtocolAdapterFactory.create_from_dict(
            config_dict,
            adapter_id="dict_test"
        )
        
        assert isinstance(adapter, MockAdapter)
        assert adapter.config.name == 'dict_test'
        assert adapter.config.connection_delay == 0.1
    
    def test_create_from_dict_invalid(self):
        """Test creating adapter from invalid dictionary"""
        # Missing protocol_type
        config_dict = {
            'name': 'invalid_test'
        }
        
        with pytest.raises(ValueError):
            ProtocolAdapterFactory.create_from_dict(config_dict)
        
        # Invalid protocol_type
        config_dict = {
            'protocol_type': 'invalid_protocol',
            'name': 'invalid_test'
        }
        
        with pytest.raises(ValueError):
            ProtocolAdapterFactory.create_from_dict(config_dict)
    
    def test_create_test_setup(self):
        """Test creating complete test setup"""
        test_adapters = ProtocolAdapterFactory.create_test_setup()
        
        # Should have mock adapters for each protocol
        expected_protocols = [
            ProtocolType.SERIAL,
            ProtocolType.I2C,
            ProtocolType.SPI,
            ProtocolType.CAN,
            ProtocolType.ETHERNET
        ]
        
        assert len(test_adapters) == len(expected_protocols)
        
        for protocol in expected_protocols:
            adapter_id = f"test_{protocol.value}"
            assert adapter_id in test_adapters
            
            adapter = test_adapters[adapter_id]
            assert isinstance(adapter, MockAdapter)
            assert adapter.config.simulated_protocol == protocol
    
    def test_get_adapter_info(self):
        """Test getting adapter information"""
        info = ProtocolAdapterFactory.get_adapter_info()
        
        assert 'serial' in info
        assert 'mock' in info
        
        serial_info = info['serial']
        assert serial_info['adapter_class'] == 'SerialAdapter'
        assert serial_info['config_class'] == 'SerialConfig'
        assert 'active_count' in serial_info
    
    def test_register_custom_adapter(self):
        """Test registering custom adapter"""
        # Create a custom protocol type (for testing)
        from enum import Enum
        
        class CustomProtocolType(Enum):
            CUSTOM = "custom"
        
        # Create custom adapter and config classes
        class CustomConfig(ProtocolConfig):
            def validate(self):
                super().validate()
        
        class CustomAdapter(ProtocolAdapter):
            def _get_protocol_type(self):
                return CustomProtocolType.CUSTOM
            
            async def _connect_impl(self):
                pass
            
            async def _disconnect_impl(self):
                pass
            
            async def _write_impl(self, packet):
                pass
            
            async def _read_impl(self, size, timeout):
                pass
        
        # This test demonstrates the registration capability
        # In practice, you'd extend the ProtocolType enum
        
        # The factory is designed to be extensible
        assert hasattr(ProtocolAdapterFactory, 'register_adapter')
    
    @pytest.mark.asyncio
    async def test_disconnect_all(self):
        """Test disconnecting all adapters"""
        # Create some test adapters
        adapter1 = ProtocolAdapterFactory.create_mock_adapter(adapter_id="disc_test1")
        adapter2 = ProtocolAdapterFactory.create_mock_adapter(adapter_id="disc_test2")
        
        # Connect them
        await adapter1.connect()
        await adapter2.connect()
        
        assert adapter1.is_connected
        assert adapter2.is_connected
        
        # Disconnect all
        await ProtocolAdapterFactory.disconnect_all()
        
        assert not adapter1.is_connected
        assert not adapter2.is_connected
        
        # Clean up
        ProtocolAdapterFactory.remove_adapter("disc_test1")
        ProtocolAdapterFactory.remove_adapter("disc_test2")
    
    def test_config_validation_integration(self):
        """Test that factory properly validates configurations"""
        # Valid configuration should work
        config = MockConfig(
            name="valid_config",
            connection_failure_rate=0.0,
            transmission_error_rate=0.0
        )
        
        adapter = ProtocolAdapterFactory.create_adapter(
            ProtocolType.MOCK,
            config
        )
        assert adapter is not None
        
        # Invalid configuration should fail during creation
        invalid_config = MockConfig(
            name="invalid_config",
            timeout=-1  # Invalid timeout
        )
        
        with pytest.raises(Exception):  # ConfigurationError
            ProtocolAdapterFactory.create_adapter(
                ProtocolType.MOCK,
                invalid_config
            )
    
    def test_adapter_cleanup(self):
        """Test proper cleanup when removing adapters"""
        # Create multiple adapters
        adapters = {}
        for i in range(5):
            adapter_id = f"cleanup_test_{i}"
            adapter = ProtocolAdapterFactory.create_mock_adapter(
                adapter_id=adapter_id
            )
            adapters[adapter_id] = adapter
        
        # Verify all are registered
        all_adapters = ProtocolAdapterFactory.get_all_adapters()
        for adapter_id in adapters:
            assert adapter_id in all_adapters
        
        # Remove all adapters
        for adapter_id in list(adapters.keys()):
            ProtocolAdapterFactory.remove_adapter(adapter_id)
        
        # Verify all are removed
        all_adapters = ProtocolAdapterFactory.get_all_adapters()
        for adapter_id in adapters:
            assert adapter_id not in all_adapters
    
    def test_duplicate_adapter_ids(self):
        """Test handling of duplicate adapter IDs"""
        # Create first adapter
        adapter1 = ProtocolAdapterFactory.create_mock_adapter(
            adapter_id="duplicate_id"
        )
        
        # Create second adapter with same ID (should replace)
        adapter2 = ProtocolAdapterFactory.create_mock_adapter(
            adapter_id="duplicate_id"
        )
        
        # Should only have the second adapter
        retrieved = ProtocolAdapterFactory.get_adapter("duplicate_id")
        assert retrieved == adapter2
        assert retrieved != adapter1
        
        # Clean up
        ProtocolAdapterFactory.remove_adapter("duplicate_id")
    
    def test_create_config_with_invalid_protocol(self):
        """Test config creation with invalid protocol type"""
        # Use a string that's not a valid protocol
        with pytest.raises(ValueError):
            ProtocolAdapterFactory.create_config("invalid_protocol", name="test")
    
    def test_convenience_methods_with_custom_params(self):
        """Test all convenience methods with custom parameters"""
        # Serial adapter
        serial = ProtocolAdapterFactory.create_serial_adapter(
            port="COM10",
            baudrate=9600,
            adapter_id="serial_custom",
            parity="even",
            stop_bits=2
        )
        assert serial.config.port == "COM10"
        assert serial.config.baudrate == 9600
        ProtocolAdapterFactory.remove_adapter("serial_custom")
        
        # I2C adapter
        i2c = ProtocolAdapterFactory.create_i2c_adapter(
            bus_number=2,
            adapter_id="i2c_custom",
            clock_speed=400000
        )
        assert i2c.config.bus_number == 2
        ProtocolAdapterFactory.remove_adapter("i2c_custom")
        
        # SPI adapter
        spi = ProtocolAdapterFactory.create_spi_adapter(
            bus=1,
            device=2,
            adapter_id="spi_custom",
            speed_hz=1000000,
            mode=3
        )
        assert spi.config.bus == 1
        assert spi.config.device == 2
        ProtocolAdapterFactory.remove_adapter("spi_custom")
        
        # CAN adapter
        can = ProtocolAdapterFactory.create_can_adapter(
            channel="can1",
            bitrate=250000,
            adapter_id="can_custom"
        )
        assert can.config.channel == "can1"
        assert can.config.bitrate == 250000
        ProtocolAdapterFactory.remove_adapter("can_custom")
        
        # Ethernet adapter
        eth = ProtocolAdapterFactory.create_ethernet_adapter(
            host="192.168.1.100",
            port=9999,
            adapter_id="eth_custom",
            socket_type="tcp"
        )
        assert eth.config.host == "192.168.1.100"
        assert eth.config.port == 9999
        ProtocolAdapterFactory.remove_adapter("eth_custom")
    
    def test_adapter_type_verification(self):
        """Test that factory creates correct adapter types"""
        type_mapping = {
            ProtocolType.SERIAL: SerialAdapter,
            ProtocolType.I2C: I2CAdapter,
            ProtocolType.MOCK: MockAdapter,
        }
        
        for protocol_type, expected_class in type_mapping.items():
            config = ProtocolAdapterFactory.create_config(
                protocol_type,
                name=f"test_{protocol_type.value}"
            )
            adapter = ProtocolAdapterFactory.create_adapter(
                protocol_type,
                config
            )
            assert isinstance(adapter, expected_class)
            assert adapter.protocol_type == protocol_type
    
    def test_active_adapter_statistics(self):
        """Test getting statistics about active adapters"""
        # Create various adapters
        ProtocolAdapterFactory.create_mock_adapter(
            simulated_protocol=ProtocolType.SERIAL,
            adapter_id="stat_serial_1"
        )
        ProtocolAdapterFactory.create_mock_adapter(
            simulated_protocol=ProtocolType.SERIAL,
            adapter_id="stat_serial_2"
        )
        ProtocolAdapterFactory.create_mock_adapter(
            simulated_protocol=ProtocolType.I2C,
            adapter_id="stat_i2c_1"
        )
        
        # Get adapter info
        info = ProtocolAdapterFactory.get_adapter_info()
        
        # Check active counts
        assert info['mock']['active_count'] >= 3
        
        # Clean up
        ProtocolAdapterFactory.remove_adapter("stat_serial_1")
        ProtocolAdapterFactory.remove_adapter("stat_serial_2")
        ProtocolAdapterFactory.remove_adapter("stat_i2c_1")
    
    def test_create_from_dict_edge_cases(self):
        """Test edge cases for dictionary-based creation"""
        # Test with enum value as string
        config_dict = {
            'protocol_type': 'serial',  # String instead of enum
            'name': 'serial_from_dict',
            'port': 'COM1',
            'baudrate': 115200
        }
        
        adapter = ProtocolAdapterFactory.create_from_dict(config_dict)
        assert adapter.protocol_type == ProtocolType.SERIAL
        assert adapter.config.name == 'serial_from_dict'
        
        # Test with extra parameters (should be passed to config)
        config_dict = {
            'protocol_type': 'mock',
            'name': 'mock_with_extras',
            'simulated_protocol': 'i2c',
            'custom_param': 'ignored_by_base',  # Extra param
            'connection_delay': 0.5
        }
        
        adapter = ProtocolAdapterFactory.create_from_dict(config_dict)
        assert adapter.config.connection_delay == 0.5
    
    @pytest.mark.asyncio
    async def test_disconnect_all_error_handling(self):
        """Test disconnect_all handles errors gracefully"""
        # Create adapters
        adapter1 = ProtocolAdapterFactory.create_mock_adapter(adapter_id="disc_err_1")
        adapter2 = ProtocolAdapterFactory.create_mock_adapter(adapter_id="disc_err_2")
        
        # Connect one adapter
        await adapter1.connect()
        
        # Make adapter2 fail on disconnect (even though not connected)
        adapter2.disconnect_should_fail = True  # Mock attribute
        
        # Disconnect all should not raise even if one fails
        await ProtocolAdapterFactory.disconnect_all()
        
        # Clean up
        ProtocolAdapterFactory.remove_adapter("disc_err_1")
        ProtocolAdapterFactory.remove_adapter("disc_err_2")
    
    def test_factory_thread_safety_simulation(self):
        """Test factory behavior with simulated concurrent access"""
        import threading
        
        results = {'errors': []}
        
        def create_and_remove_adapter(thread_id):
            try:
                adapter_id = f"thread_{thread_id}"
                adapter = ProtocolAdapterFactory.create_mock_adapter(
                    adapter_id=adapter_id
                )
                # Simulate some work
                import time
                time.sleep(0.01)
                ProtocolAdapterFactory.remove_adapter(adapter_id)
            except Exception as e:
                results['errors'].append((thread_id, str(e)))
        
        # Create multiple threads
        threads = []
        for i in range(10):
            thread = threading.Thread(
                target=create_and_remove_adapter,
                args=(i,)
            )
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # Should complete without errors
        assert len(results['errors']) == 0
    
    def test_get_adapter_nonexistent(self):
        """Test getting non-existent adapter returns None"""
        adapter = ProtocolAdapterFactory.get_adapter("nonexistent_id")
        assert adapter is None
    
    def test_remove_nonexistent_adapter(self):
        """Test removing non-existent adapter doesn't raise"""
        # Should not raise exception
        ProtocolAdapterFactory.remove_adapter("nonexistent_id")
    
    def test_protocol_type_case_sensitivity(self):
        """Test protocol type string case handling"""
        # Protocol type strings should be case-sensitive
        config_dict = {
            'protocol_type': 'SERIAL',  # Uppercase
            'name': 'case_test'
        }
        
        with pytest.raises(ValueError):
            ProtocolAdapterFactory.create_from_dict(config_dict)
    
    def test_custom_adapter_registration_validation(self):
        """Test validation when registering custom adapters"""
        # Try to register with non-adapter class
        class NotAnAdapter:
            pass
        
        class NotAConfig:
            pass
        
        # Should validate inheritance
        with pytest.raises(TypeError):
            ProtocolAdapterFactory.register_adapter(
                ProtocolType.SERIAL,  # Reuse existing type for test
                NotAnAdapter,
                NotAConfig
            )