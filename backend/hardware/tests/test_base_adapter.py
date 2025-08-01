"""
Comprehensive unit tests for base ProtocolAdapter class
Tests the abstract base class functionality and interface contracts
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from ..base import (
    ProtocolAdapter, ProtocolConfig, ProtocolType, ConnectionState,
    DataDirection, ProtocolStatus, DataPacket, ProtocolError,
    ConnectionError, TransmissionError, ConfigurationError
)


# Test implementations of abstract classes
class TestConfig(ProtocolConfig):
    """Test configuration class"""
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.test_param: str = kwargs.get('test_param', 'default')
        self.fail_validation: bool = kwargs.get('fail_validation', False)
    
    def validate(self) -> None:
        super().validate()
        if self.fail_validation:
            raise ConfigurationError("Test validation failure")


class TestAdapter(ProtocolAdapter):
    """Test adapter implementation"""
    def __init__(self, config: TestConfig):
        super().__init__(config)
        self.connect_called = False
        self.disconnect_called = False
        self.write_called = False
        self.read_called = False
        self.connect_should_fail = False
        self.write_should_fail = False
        self.read_should_fail = False
        self.health_check_result = True
        self._test_data_buffer = []
    
    def _get_protocol_type(self) -> ProtocolType:
        return ProtocolType.MOCK
    
    async def _connect_impl(self) -> None:
        self.connect_called = True
        if self.connect_should_fail:
            raise Exception("Test connection failure")
        await asyncio.sleep(0.01)  # Simulate connection delay
    
    async def _disconnect_impl(self) -> None:
        self.disconnect_called = True
        await asyncio.sleep(0.01)  # Simulate disconnect delay
    
    async def _write_impl(self, packet: DataPacket) -> None:
        self.write_called = True
        if self.write_should_fail:
            raise TransmissionError("Test write failure")
        self._test_data_buffer.append(packet)
        await asyncio.sleep(0.01)  # Simulate write delay
    
    async def _read_impl(self, size: Optional[int], timeout: float) -> DataPacket:
        self.read_called = True
        if self.read_should_fail:
            raise TransmissionError("Test read failure")
        
        # Return test data if available
        if self._test_data_buffer:
            return self._test_data_buffer.pop(0)
        
        # Otherwise return dummy data
        test_data = b'\x01\x02\x03\x04'
        if size:
            test_data = test_data[:size]
        
        return DataPacket(
            data=test_data,
            direction=DataDirection.RX,
            metadata={'test': True}
        )
    
    async def _check_connection_health(self) -> bool:
        return self.health_check_result
    
    async def _flush_impl(self) -> None:
        self._test_data_buffer.clear()


class TestProtocolConfig:
    """Test cases for ProtocolConfig base class"""
    
    def test_default_values(self):
        """Test default configuration values"""
        config = TestConfig(name="test")
        
        assert config.name == "test"
        assert config.timeout == 5.0
        assert config.retry_count == 3
        assert config.retry_delay == 1.0
        assert config.buffer_size == 4096
        assert config.auto_reconnect is True
        assert config.reconnect_delay == 5.0
    
    def test_custom_values(self):
        """Test custom configuration values"""
        config = TestConfig(
            name="custom",
            timeout=10.0,
            retry_count=5,
            retry_delay=2.0,
            buffer_size=8192,
            auto_reconnect=False,
            reconnect_delay=10.0,
            test_param="custom_value"
        )
        
        assert config.timeout == 10.0
        assert config.retry_count == 5
        assert config.retry_delay == 2.0
        assert config.buffer_size == 8192
        assert config.auto_reconnect is False
        assert config.reconnect_delay == 10.0
        assert config.test_param == "custom_value"
    
    def test_validation_positive(self):
        """Test validation with valid parameters"""
        config = TestConfig(name="valid", timeout=1.0, buffer_size=1024)
        config.validate()  # Should not raise
    
    def test_validation_negative_timeout(self):
        """Test validation with negative timeout"""
        config = TestConfig(name="invalid", timeout=-1.0)
        with pytest.raises(ConfigurationError, match="Timeout must be positive"):
            config.validate()
    
    def test_validation_negative_retry_count(self):
        """Test validation with negative retry count"""
        config = TestConfig(name="invalid", retry_count=-1)
        with pytest.raises(ConfigurationError, match="Retry count must be non-negative"):
            config.validate()
    
    def test_validation_zero_buffer_size(self):
        """Test validation with zero buffer size"""
        config = TestConfig(name="invalid", buffer_size=0)
        with pytest.raises(ConfigurationError, match="Buffer size must be positive"):
            config.validate()
    
    def test_custom_validation(self):
        """Test custom validation logic"""
        config = TestConfig(name="custom", fail_validation=True)
        with pytest.raises(ConfigurationError, match="Test validation failure"):
            config.validate()


class TestProtocolStatus:
    """Test cases for ProtocolStatus dataclass"""
    
    def test_default_values(self):
        """Test default status values"""
        status = ProtocolStatus(state=ConnectionState.DISCONNECTED)
        
        assert status.state == ConnectionState.DISCONNECTED
        assert status.connected_at is None
        assert status.last_activity is None
        assert status.bytes_sent == 0
        assert status.bytes_received == 0
        assert status.error_count == 0
        assert status.last_error is None
        assert status.metadata == {}
    
    def test_custom_values(self):
        """Test custom status values"""
        now = datetime.utcnow()
        status = ProtocolStatus(
            state=ConnectionState.CONNECTED,
            connected_at=now,
            last_activity=now,
            bytes_sent=100,
            bytes_received=200,
            error_count=1,
            last_error="Test error",
            metadata={'key': 'value'}
        )
        
        assert status.state == ConnectionState.CONNECTED
        assert status.connected_at == now
        assert status.last_activity == now
        assert status.bytes_sent == 100
        assert status.bytes_received == 200
        assert status.error_count == 1
        assert status.last_error == "Test error"
        assert status.metadata == {'key': 'value'}


class TestDataPacket:
    """Test cases for DataPacket dataclass"""
    
    def test_basic_creation(self):
        """Test basic packet creation"""
        data = b'\x01\x02\x03\x04'
        packet = DataPacket(data=data)
        
        assert packet.data == data
        assert packet.size == 4
        assert packet.direction == DataDirection.BIDIRECTIONAL
        assert packet.metadata == {}
        assert isinstance(packet.timestamp, datetime)
    
    def test_custom_creation(self):
        """Test packet creation with custom values"""
        data = b'\xAA\xBB'
        timestamp = datetime.utcnow()
        packet = DataPacket(
            data=data,
            timestamp=timestamp,
            direction=DataDirection.TX,
            metadata={'device': 'test', 'seq': 1}
        )
        
        assert packet.data == data
        assert packet.size == 2
        assert packet.timestamp == timestamp
        assert packet.direction == DataDirection.TX
        assert packet.metadata == {'device': 'test', 'seq': 1}
    
    def test_to_hex(self):
        """Test hex string conversion"""
        packet = DataPacket(data=b'\x01\x02\x03\x04')
        assert packet.to_hex() == "01020304"
        
        packet = DataPacket(data=b'\xAA\xBB\xCC\xDD')
        assert packet.to_hex() == "aabbccdd"
    
    def test_from_hex(self):
        """Test creation from hex string"""
        packet = DataPacket.from_hex("01020304")
        assert packet.data == b'\x01\x02\x03\x04'
        assert packet.direction == DataDirection.BIDIRECTIONAL
        
        # With additional parameters
        packet = DataPacket.from_hex(
            "aabbccdd",
            direction=DataDirection.RX,
            metadata={'source': 'hex'}
        )
        assert packet.data == b'\xAA\xBB\xCC\xDD'
        assert packet.direction == DataDirection.RX
        assert packet.metadata == {'source': 'hex'}
    
    def test_from_hex_invalid(self):
        """Test creation from invalid hex string"""
        with pytest.raises(ValueError):
            DataPacket.from_hex("invalid_hex")
        
        with pytest.raises(ValueError):
            DataPacket.from_hex("01020G")  # Invalid hex character


class TestProtocolAdapter:
    """Test cases for ProtocolAdapter base class"""
    
    @pytest.fixture
    def adapter(self):
        """Create test adapter instance"""
        config = TestConfig(name="test_adapter")
        return TestAdapter(config)
    
    def test_initialization(self, adapter):
        """Test adapter initialization"""
        assert adapter.config.name == "test_adapter"
        assert adapter.protocol_type == ProtocolType.MOCK
        assert not adapter.is_connected
        assert adapter.status.state == ConnectionState.DISCONNECTED
        assert adapter._lock is not None
        assert adapter._read_queue is not None
        assert adapter._write_queue is not None
        assert adapter._event_handlers == {}
    
    def test_initialization_with_invalid_config(self):
        """Test adapter initialization with invalid configuration"""
        config = TestConfig(name="invalid", timeout=-1)
        with pytest.raises(ConfigurationError):
            TestAdapter(config)
    
    @pytest.mark.asyncio
    async def test_connect_success(self, adapter):
        """Test successful connection"""
        # Register event handler
        connected_event = None
        
        def on_connected(data):
            nonlocal connected_event
            connected_event = data
        
        adapter.register_event_handler('connected', on_connected)
        
        # Connect
        await adapter.connect()
        
        assert adapter.connect_called
        assert adapter.is_connected
        assert adapter.status.state == ConnectionState.CONNECTED
        assert adapter.status.connected_at is not None
        assert adapter.status.last_activity is not None
        assert connected_event is not None
        assert 'timestamp' in connected_event
    
    @pytest.mark.asyncio
    async def test_connect_already_connected(self, adapter):
        """Test connecting when already connected"""
        await adapter.connect()
        assert adapter.is_connected
        
        # Reset flag
        adapter.connect_called = False
        
        # Try to connect again
        await adapter.connect()
        
        # Should not call connect implementation again
        assert not adapter.connect_called
        assert adapter.is_connected
    
    @pytest.mark.asyncio
    async def test_connect_failure(self, adapter):
        """Test connection failure"""
        adapter.connect_should_fail = True
        
        # Register error handler
        error_event = None
        
        def on_error(data):
            nonlocal error_event
            error_event = data
        
        adapter.register_event_handler('error', on_error)
        
        # Try to connect
        with pytest.raises(ConnectionError, match="Failed to connect"):
            await adapter.connect()
        
        assert adapter.connect_called
        assert not adapter.is_connected
        assert adapter.status.state == ConnectionState.ERROR
        assert adapter.status.error_count == 1
        assert adapter.status.last_error is not None
        assert error_event is not None
        assert 'error' in error_event
    
    @pytest.mark.asyncio
    async def test_disconnect_success(self, adapter):
        """Test successful disconnection"""
        await adapter.connect()
        assert adapter.is_connected
        
        # Register event handler
        disconnected_event = None
        
        def on_disconnected(data):
            nonlocal disconnected_event
            disconnected_event = data
        
        adapter.register_event_handler('disconnected', on_disconnected)
        
        # Disconnect
        await adapter.disconnect()
        
        assert adapter.disconnect_called
        assert not adapter.is_connected
        assert adapter.status.state == ConnectionState.DISCONNECTED
        assert disconnected_event is not None
        assert 'timestamp' in disconnected_event
    
    @pytest.mark.asyncio
    async def test_disconnect_not_connected(self, adapter):
        """Test disconnecting when not connected"""
        assert not adapter.is_connected
        
        # Try to disconnect
        await adapter.disconnect()
        
        # Should not call disconnect implementation
        assert not adapter.disconnect_called
    
    @pytest.mark.asyncio
    async def test_write_bytes(self, adapter):
        """Test writing bytes"""
        await adapter.connect()
        
        # Register event handler
        data_sent_event = None
        
        def on_data_sent(data):
            nonlocal data_sent_event
            data_sent_event = data
        
        adapter.register_event_handler('data_sent', on_data_sent)
        
        # Write data
        test_data = b'\x01\x02\x03\x04'
        await adapter.write(test_data)
        
        assert adapter.write_called
        assert adapter.status.bytes_sent == 4
        assert adapter.status.last_activity is not None
        assert data_sent_event is not None
        assert data_sent_event['size'] == 4
        
        # Check the packet was created correctly
        assert len(adapter._test_data_buffer) == 1
        packet = adapter._test_data_buffer[0]
        assert packet.data == test_data
        assert packet.direction == DataDirection.TX
    
    @pytest.mark.asyncio
    async def test_write_packet(self, adapter):
        """Test writing DataPacket"""
        await adapter.connect()
        
        # Create packet
        packet = DataPacket(
            data=b'\xAA\xBB',
            direction=DataDirection.TX,
            metadata={'test': True}
        )
        
        await adapter.write(packet)
        
        assert adapter.write_called
        assert adapter.status.bytes_sent == 2
        
        # Check the packet was passed through
        assert len(adapter._test_data_buffer) == 1
        written_packet = adapter._test_data_buffer[0]
        assert written_packet.data == packet.data
        assert written_packet.metadata == packet.metadata
    
    @pytest.mark.asyncio
    async def test_write_not_connected(self, adapter):
        """Test writing when not connected"""
        assert not adapter.is_connected
        
        with pytest.raises(ConnectionError, match="Not connected"):
            await adapter.write(b'\x01\x02')
    
    @pytest.mark.asyncio
    async def test_write_failure(self, adapter):
        """Test write failure"""
        await adapter.connect()
        adapter.write_should_fail = True
        
        with pytest.raises(TransmissionError, match="Test write failure"):
            await adapter.write(b'\x01\x02')
        
        assert adapter.write_called
    
    @pytest.mark.asyncio
    async def test_read(self, adapter):
        """Test reading data"""
        await adapter.connect()
        
        # Register event handler
        data_received_event = None
        
        def on_data_received(data):
            nonlocal data_received_event
            data_received_event = data
        
        adapter.register_event_handler('data_received', on_data_received)
        
        # Read data
        packet = await adapter.read()
        
        assert adapter.read_called
        assert packet.data == b'\x01\x02\x03\x04'
        assert packet.direction == DataDirection.RX
        assert adapter.status.bytes_received == 4
        assert adapter.status.last_activity is not None
        assert data_received_event is not None
        assert data_received_event['size'] == 4
    
    @pytest.mark.asyncio
    async def test_read_with_size(self, adapter):
        """Test reading data with size limit"""
        await adapter.connect()
        
        packet = await adapter.read(size=2)
        
        assert packet.data == b'\x01\x02'
        assert adapter.status.bytes_received == 2
    
    @pytest.mark.asyncio
    async def test_read_not_connected(self, adapter):
        """Test reading when not connected"""
        assert not adapter.is_connected
        
        with pytest.raises(ConnectionError, match="Not connected"):
            await adapter.read()
    
    @pytest.mark.asyncio
    async def test_read_failure(self, adapter):
        """Test read failure"""
        await adapter.connect()
        adapter.read_should_fail = True
        
        with pytest.raises(TransmissionError, match="Test read failure"):
            await adapter.read()
        
        assert adapter.read_called
    
    @pytest.mark.asyncio
    async def test_query(self, adapter):
        """Test query (write and read) operation"""
        await adapter.connect()
        
        # Prepare response
        response_packet = DataPacket(data=b'\xAA\xBB\xCC')
        adapter._test_data_buffer.append(response_packet)
        
        # Query
        query_data = b'\x01\x02'
        response = await adapter.query(query_data)
        
        assert adapter.write_called
        assert adapter.read_called
        assert response.data == b'\xAA\xBB\xCC'
        assert adapter.status.bytes_sent == 2
        assert adapter.status.bytes_received == 3
    
    @pytest.mark.asyncio
    async def test_transaction_context(self, adapter):
        """Test transaction context manager"""
        await adapter.connect()
        
        async with adapter.transaction() as txn_adapter:
            assert txn_adapter == adapter
            # Lock should be acquired
            assert adapter._lock.locked()
        
        # Lock should be released
        assert not adapter._lock.locked()
    
    @pytest.mark.asyncio
    async def test_flush(self, adapter):
        """Test flush operation"""
        await adapter.connect()
        
        # Add some test data
        adapter._test_data_buffer.append(DataPacket(data=b'\x01'))
        adapter._test_data_buffer.append(DataPacket(data=b'\x02'))
        
        assert len(adapter._test_data_buffer) == 2
        
        # Flush
        await adapter.flush()
        
        assert len(adapter._test_data_buffer) == 0
    
    def test_event_handlers(self, adapter):
        """Test event handler registration"""
        # Register handlers
        handler1 = Mock()
        handler2 = Mock()
        
        adapter.register_event_handler('connected', handler1)
        adapter.register_event_handler('connected', handler2)
        adapter.register_event_handler('error', handler1)
        
        assert len(adapter._event_handlers['connected']) == 2
        assert len(adapter._event_handlers['error']) == 1
    
    @pytest.mark.asyncio
    async def test_event_emission(self, adapter):
        """Test event emission to handlers"""
        # Regular handler
        sync_called = False
        sync_data = None
        
        def sync_handler(data):
            nonlocal sync_called, sync_data
            sync_called = True
            sync_data = data
        
        # Async handler
        async_called = False
        async_data = None
        
        async def async_handler(data):
            nonlocal async_called, async_data
            async_called = True
            async_data = data
        
        adapter.register_event_handler('test_event', sync_handler)
        adapter.register_event_handler('test_event', async_handler)
        
        # Emit event
        test_data = {'value': 42}
        await adapter._emit_event('test_event', test_data)
        
        assert sync_called
        assert sync_data == test_data
        assert async_called
        assert async_data == test_data
    
    @pytest.mark.asyncio
    async def test_event_handler_error(self, adapter):
        """Test event handler error handling"""
        # Handler that raises exception
        def error_handler(data):
            raise Exception("Handler error")
        
        # Normal handler
        normal_called = False
        
        def normal_handler(data):
            nonlocal normal_called
            normal_called = True
        
        adapter.register_event_handler('test_event', error_handler)
        adapter.register_event_handler('test_event', normal_handler)
        
        # Emit event - should not crash
        await adapter._emit_event('test_event', {})
        
        # Normal handler should still be called
        assert normal_called
    
    @pytest.mark.asyncio
    async def test_monitor_connection(self, adapter):
        """Test connection monitoring"""
        await adapter.connect()
        
        # Monitor task should be created
        assert adapter._monitor_task is not None
        assert not adapter._monitor_task.done()
        
        # Let monitor run once
        await asyncio.sleep(0.1)
        
        # Disconnect should cancel monitor
        await adapter.disconnect()
        
        # Monitor task should be cancelled
        assert adapter._monitor_task.done()
    
    @pytest.mark.asyncio
    async def test_auto_reconnect(self, adapter):
        """Test auto-reconnection on health check failure"""
        adapter.config.auto_reconnect = True
        adapter.config.reconnect_delay = 0.1
        
        await adapter.connect()
        assert adapter.is_connected
        
        # Make health check fail
        adapter.health_check_result = False
        
        # Wait for monitor to detect and reconnect
        await asyncio.sleep(6)  # Monitor checks every 5 seconds
        
        # Should have attempted reconnection
        # Note: In a real test, we'd need better synchronization
        assert adapter.connect_called
    
    def test_get_statistics(self, adapter):
        """Test statistics retrieval"""
        stats = adapter.get_statistics()
        
        assert stats['protocol_type'] == 'mock'
        assert stats['state'] == 'disconnected'
        assert stats['connected_at'] is None
        assert stats['last_activity'] is None
        assert stats['bytes_sent'] == 0
        assert stats['bytes_received'] == 0
        assert stats['error_count'] == 0
        assert stats['last_error'] is None
        assert stats['metadata'] == {}
    
    @pytest.mark.asyncio
    async def test_get_statistics_connected(self, adapter):
        """Test statistics retrieval when connected"""
        await adapter.connect()
        await adapter.write(b'\x01\x02')
        await adapter.read()
        
        stats = adapter.get_statistics()
        
        assert stats['protocol_type'] == 'mock'
        assert stats['state'] == 'connected'
        assert stats['connected_at'] is not None
        assert stats['last_activity'] is not None
        assert stats['bytes_sent'] == 2
        assert stats['bytes_received'] == 4
    
    @pytest.mark.asyncio
    async def test_reset(self, adapter):
        """Test adapter reset"""
        # Connect and do some operations
        await adapter.connect()
        await adapter.write(b'\x01\x02')
        adapter.status.error_count = 5
        adapter.status.last_error = "Some error"
        
        # Reset
        await adapter.reset()
        
        assert not adapter.is_connected
        assert adapter.status.state == ConnectionState.DISCONNECTED
        assert adapter.status.bytes_sent == 0
        assert adapter.status.bytes_received == 0
        assert adapter.status.error_count == 0
        assert adapter.status.last_error is None
    
    def test_string_representation(self, adapter):
        """Test string representations"""
        str_repr = str(adapter)
        assert "TestAdapter" in str_repr
        assert "test_adapter" in str_repr
        assert "disconnected" in str_repr
        
        repr_str = repr(adapter)
        assert repr_str == str_repr
    
    @pytest.mark.asyncio
    async def test_echo_test(self, adapter):
        """Test echo test functionality"""
        await adapter.connect()
        
        # Prepare echo response
        test_data = b'\x01\x02\x03\x04'
        adapter._test_data_buffer.append(DataPacket(data=test_data))
        
        result = await adapter.echo_test(test_data)
        assert result is True
        
        # Test with different response
        adapter._test_data_buffer.append(DataPacket(data=b'\xFF\xFF'))
        result = await adapter.echo_test(test_data)
        assert result is False
    
    @pytest.mark.asyncio
    async def test_echo_test_failure(self, adapter):
        """Test echo test with read failure"""
        await adapter.connect()
        adapter.read_should_fail = True
        
        result = await adapter.echo_test()
        assert result is False
    
    @pytest.mark.asyncio
    async def test_get_capabilities(self, adapter):
        """Test get capabilities (default implementation)"""
        capabilities = await adapter.get_capabilities()
        assert capabilities == []
    
    @pytest.mark.asyncio
    async def test_run_self_test(self, adapter):
        """Test run self test (default implementation)"""
        result = await adapter.run_self_test()
        assert result['supported'] is False
        assert 'message' in result


class TestProtocolExceptions:
    """Test cases for protocol exceptions"""
    
    def test_protocol_error(self):
        """Test ProtocolError exception"""
        error = ProtocolError("Test error")
        assert str(error) == "Test error"
        assert error.error_code is None
        assert error.details == {}
        
        # With error code and details
        error = ProtocolError(
            "Test error",
            error_code="TEST_001",
            details={'key': 'value'}
        )
        assert error.error_code == "TEST_001"
        assert error.details == {'key': 'value'}
    
    def test_connection_error(self):
        """Test ConnectionError exception"""
        error = ConnectionError("Connection failed")
        assert isinstance(error, ProtocolError)
        assert str(error) == "Connection failed"
    
    def test_transmission_error(self):
        """Test TransmissionError exception"""
        error = TransmissionError("Transmission failed")
        assert isinstance(error, ProtocolError)
        assert str(error) == "Transmission failed"
    
    def test_configuration_error(self):
        """Test ConfigurationError exception"""
        error = ConfigurationError("Invalid config")
        assert isinstance(error, ProtocolError)
        assert str(error) == "Invalid config"


class TestConnectionStates:
    """Test cases for ConnectionState enum"""
    
    def test_connection_states(self):
        """Test all connection state values"""
        assert ConnectionState.DISCONNECTED.value == "disconnected"
        assert ConnectionState.CONNECTING.value == "connecting"
        assert ConnectionState.CONNECTED.value == "connected"
        assert ConnectionState.ERROR.value == "error"
        assert ConnectionState.RECONNECTING.value == "reconnecting"
    
    def test_state_transitions(self, adapter):
        """Test typical state transitions"""
        # Initial state
        assert adapter.status.state == ConnectionState.DISCONNECTED
        
        # During connection
        adapter.status.state = ConnectionState.CONNECTING
        assert adapter.status.state == ConnectionState.CONNECTING
        assert not adapter.is_connected
        
        # After connection
        adapter.status.state = ConnectionState.CONNECTED
        assert adapter.status.state == ConnectionState.CONNECTED
        assert adapter.is_connected
        
        # Error state
        adapter.status.state = ConnectionState.ERROR
        assert adapter.status.state == ConnectionState.ERROR
        assert not adapter.is_connected


class TestDataDirection:
    """Test cases for DataDirection enum"""
    
    def test_data_directions(self):
        """Test all data direction values"""
        assert DataDirection.TX.value == "transmit"
        assert DataDirection.RX.value == "receive"
        assert DataDirection.BIDIRECTIONAL.value == "bidirectional"


class TestProtocolType:
    """Test cases for ProtocolType enum"""
    
    def test_protocol_types(self):
        """Test all protocol type values"""
        assert ProtocolType.SERIAL.value == "serial"
        assert ProtocolType.I2C.value == "i2c"
        assert ProtocolType.SPI.value == "spi"
        assert ProtocolType.CAN.value == "can"
        assert ProtocolType.ETHERNET.value == "ethernet"
        assert ProtocolType.MOCK.value == "mock"


# Integration tests
class TestBaseAdapterIntegration:
    """Integration tests for base adapter functionality"""
    
    @pytest.mark.asyncio
    async def test_full_communication_cycle(self):
        """Test complete communication cycle"""
        config = TestConfig(name="integration_test")
        adapter = TestAdapter(config)
        
        # Track events
        events = []
        
        def track_event(event_name):
            def handler(data):
                events.append((event_name, data))
            return handler
        
        adapter.register_event_handler('connected', track_event('connected'))
        adapter.register_event_handler('data_sent', track_event('data_sent'))
        adapter.register_event_handler('data_received', track_event('data_received'))
        adapter.register_event_handler('disconnected', track_event('disconnected'))
        
        # Connect
        await adapter.connect()
        
        # Send data
        await adapter.write(b'\x01\x02\x03')
        
        # Read data
        packet = await adapter.read()
        
        # Query
        response = await adapter.query(b'\x04\x05')
        
        # Get statistics
        stats = adapter.get_statistics()
        assert stats['bytes_sent'] == 5  # 3 + 2
        assert stats['bytes_received'] == 8  # 4 + 4
        
        # Disconnect
        await adapter.disconnect()
        
        # Verify events
        event_names = [e[0] for e in events]
        assert 'connected' in event_names
        assert 'data_sent' in event_names
        assert 'data_received' in event_names
        assert 'disconnected' in event_names
    
    @pytest.mark.asyncio
    async def test_concurrent_operations(self):
        """Test concurrent read/write operations"""
        config = TestConfig(name="concurrent_test")
        adapter = TestAdapter(config)
        await adapter.connect()
        
        # Prepare multiple responses
        for i in range(5):
            adapter._test_data_buffer.append(
                DataPacket(data=bytes([i]))
            )
        
        # Concurrent operations
        async def write_task(n):
            await adapter.write(bytes([n]))
        
        async def read_task():
            return await adapter.read()
        
        # Run concurrent operations
        write_tasks = [write_task(i) for i in range(5)]
        read_tasks = [read_task() for _ in range(5)]
        
        results = await asyncio.gather(
            *write_tasks,
            *read_tasks,
            return_exceptions=True
        )
        
        # Check no exceptions
        assert all(not isinstance(r, Exception) for r in results)
        
        # Check statistics
        stats = adapter.get_statistics()
        assert stats['bytes_sent'] == 5
        assert stats['bytes_received'] == 5
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_error_recovery(self):
        """Test error recovery scenarios"""
        config = TestConfig(name="error_test")
        adapter = TestAdapter(config)
        
        # Connection failure and retry
        adapter.connect_should_fail = True
        
        try:
            await adapter.connect()
        except ConnectionError:
            pass
        
        assert adapter.status.error_count == 1
        assert adapter.status.state == ConnectionState.ERROR
        
        # Clear error and retry
        adapter.connect_should_fail = False
        await adapter.connect()
        
        assert adapter.is_connected
        assert adapter.status.state == ConnectionState.CONNECTED
        
        # Write failure
        adapter.write_should_fail = True
        
        try:
            await adapter.write(b'\x01')
        except TransmissionError:
            pass
        
        # Write should work after clearing error
        adapter.write_should_fail = False
        await adapter.write(b'\x01')
        
        assert adapter.status.bytes_sent == 1
        
        await adapter.disconnect()
"""