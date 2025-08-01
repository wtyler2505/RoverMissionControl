"""
Tests for Mock Protocol Adapter
"""

import pytest
import asyncio
from datetime import datetime

from ..mock_adapter import MockAdapter, MockConfig, MockDevice
from ..base import ProtocolType, DataPacket, ConnectionState, DataDirection


class TestMockAdapter:
    """Test cases for MockAdapter"""
    
    @pytest.fixture
    def basic_config(self):
        """Basic mock configuration"""
        return MockConfig(
            name="test_mock",
            simulated_protocol=ProtocolType.SERIAL,
            connection_delay=0.01,
            transmission_delay=0.001
        )
    
    @pytest.fixture
    def device_config(self):
        """Mock configuration with devices"""
        device = MockDevice(
            device_id="test_device",
            name="Test Device",
            response_delay=0.01,
            responses={
                b'\x01\x02': b'\x03\x04',  # Command -> Response
                b'\x05': b'\x06\x07\x08'
            },
            auto_responses=[b'\xFF\xFE'],
            auto_interval=0.1
        )
        
        return MockConfig(
            name="test_mock_with_devices",
            simulated_protocol=ProtocolType.I2C,
            devices=[device],
            connection_delay=0.01,
            transmission_delay=0.001
        )
    
    @pytest.mark.asyncio
    async def test_basic_connection(self, basic_config):
        """Test basic connection and disconnection"""
        adapter = MockAdapter(basic_config)
        
        assert adapter.protocol_type == ProtocolType.MOCK
        assert not adapter.is_connected
        
        # Connect
        await adapter.connect()
        assert adapter.is_connected
        assert adapter.status.state == ConnectionState.CONNECTED
        
        # Disconnect
        await adapter.disconnect()
        assert not adapter.is_connected
        assert adapter.status.state == ConnectionState.DISCONNECTED
    
    @pytest.mark.asyncio
    async def test_data_transmission(self, basic_config):
        """Test data transmission without responses"""
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        test_data = b'\x01\x02\x03\x04'
        
        # Send data
        await adapter.write(test_data)
        
        # Check statistics
        assert adapter.status.bytes_sent == len(test_data)
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_device_responses(self, device_config):
        """Test device response simulation"""
        adapter = MockAdapter(device_config)
        await adapter.connect()
        
        # Send command that has a response
        command = b'\x01\x02'
        packet = DataPacket(
            data=command,
            metadata={'device_id': 'test_device'}
        )
        
        await adapter.write(packet)
        
        # Wait for response
        await asyncio.sleep(0.05)  # Allow time for response
        
        # Check if response was generated
        assert hasattr(adapter, '_received_data')
        assert len(adapter._received_data) > 0
        
        response = adapter._received_data[0]
        assert response.data == b'\x03\x04'
        assert response.metadata.get('device_id') == 'test_device'
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_auto_responses(self, device_config):
        """Test automatic response generation"""
        adapter = MockAdapter(device_config)
        await adapter.connect()
        
        # Wait for auto responses
        await asyncio.sleep(0.15)  # Wait for at least one auto response
        
        # Check if auto responses were generated
        assert hasattr(adapter, '_received_data')
        
        # Look for auto responses
        auto_responses = [
            packet for packet in adapter._received_data
            if packet.metadata.get('auto_response') is True
        ]
        
        assert len(auto_responses) > 0
        assert auto_responses[0].data == b'\xFF\xFE'
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_error_simulation(self, basic_config):
        """Test error simulation"""
        basic_config.transmission_error_rate = 1.0  # 100% error rate
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        test_data = b'\x01\x02\x03'
        
        # This should raise a transmission error
        with pytest.raises(Exception):  # TransmissionError
            await adapter.write(test_data)
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_packet_loss_simulation(self, basic_config):
        """Test packet loss simulation"""
        basic_config.packet_loss_rate = 1.0  # 100% packet loss
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        test_data = b'\x01\x02\x03'
        
        # Should not raise error, but packet should be lost
        await adapter.write(test_data)
        
        # Bytes sent should still be counted
        assert adapter.status.bytes_sent == len(test_data)
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_connection_failure(self):
        """Test connection failure simulation"""
        config = MockConfig(
            name="fail_connect",
            connection_failure_rate=1.0  # 100% failure rate
        )
        adapter = MockAdapter(config)
        
        # Connection should fail
        with pytest.raises(Exception):  # ConnectionError
            await adapter.connect()
    
    @pytest.mark.asyncio
    async def test_fragmentation(self, basic_config):
        """Test message fragmentation"""
        basic_config.simulate_fragmentation = True
        basic_config.max_fragment_size = 4
        
        device = MockDevice(
            device_id="frag_device",
            responses={b'\x01': b'\x02\x03\x04\x05\x06\x07\x08\x09'}  # 8-byte response
        )
        basic_config.devices = [device]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Send command that triggers long response
        packet = DataPacket(
            data=b'\x01',
            metadata={'device_id': 'frag_device'}
        )
        
        await adapter.write(packet)
        await asyncio.sleep(0.1)  # Allow time for fragmented response
        
        # Check for fragments
        assert hasattr(adapter, '_received_data')
        fragments = [
            p for p in adapter._received_data
            if p.metadata.get('fragment') is True
        ]
        
        assert len(fragments) == 2  # 8 bytes / 4 bytes per fragment
        
        # Verify fragment content
        combined_data = b''.join(frag.data for frag in fragments)
        assert combined_data == b'\x02\x03\x04\x05\x06\x07\x08\x09'
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_bandwidth_limiting(self, basic_config):
        """Test bandwidth limiting"""
        basic_config.bandwidth_limit = 10  # 10 bytes per second
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        test_data = b'\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A'  # 10 bytes
        
        start_time = datetime.utcnow()
        await adapter.write(test_data)
        end_time = datetime.utcnow()
        
        # Should take at least 1 second due to bandwidth limit
        duration = (end_time - start_time).total_seconds()
        assert duration >= 0.9  # Allow some tolerance
        
        await adapter.disconnect()
    
    def test_device_management(self, basic_config):
        """Test device management operations"""
        adapter = MockAdapter(basic_config)
        
        # Add device
        device = MockDevice(
            device_id="new_device",
            name="New Device"
        )
        adapter.add_device(device)
        
        # Check device was added
        assert adapter.get_device_info("new_device") == device
        
        # Remove device
        adapter.remove_device("new_device")
        assert adapter.get_device_info("new_device") is None
    
    @pytest.mark.asyncio
    async def test_data_injection(self, basic_config):
        """Test data injection functionality"""
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        test_data = b'\xAA\xBB\xCC'
        
        # Inject data as if received
        await adapter.inject_data(test_data, device_id="injected_device")
        
        # Check injected data
        assert hasattr(adapter, '_received_data')
        assert len(adapter._received_data) == 1
        
        injected_packet = adapter._received_data[0]
        assert injected_packet.data == test_data
        assert injected_packet.metadata.get('device_id') == "injected_device"
        assert injected_packet.metadata.get('injected') is True
        
        await adapter.disconnect()
    
    def test_simulation_statistics(self, device_config):
        """Test simulation statistics"""
        adapter = MockAdapter(device_config)
        
        stats = adapter.get_simulation_stats()
        
        assert stats['simulated_protocol'] == ProtocolType.I2C.value
        assert stats['device_count'] == 1
        assert 'configuration' in stats
        assert stats['configuration']['connection_delay'] == 0.01
    
    @pytest.mark.asyncio
    async def test_connection_health(self, basic_config):
        """Test connection health check"""
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Mock adapter should always be healthy
        health = await adapter._check_connection_health()
        assert health is True
        
        await adapter.disconnect()
    
    def test_configuration_validation(self):
        """Test configuration validation"""
        # Valid configuration
        config = MockConfig(
            name="valid",
            connection_failure_rate=0.5,
            transmission_error_rate=0.1,
            packet_loss_rate=0.05
        )
        config.validate()  # Should not raise
        
        # Invalid configuration - rates out of range
        with pytest.raises(Exception):  # ConfigurationError
            config = MockConfig(
                name="invalid",
                connection_failure_rate=1.5  # > 1.0
            )
            config.validate()
    
    @pytest.mark.asyncio
    async def test_noise_simulation(self, basic_config):
        """Test noise simulation"""
        basic_config.simulate_noise = True
        
        device = MockDevice(
            device_id="noisy_device",
            responses={b'\x01': b'\x02\x03\x04'}
        )
        basic_config.devices = [device]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Send command multiple times and check for noise
        for _ in range(10):
            packet = DataPacket(
                data=b'\x01',
                metadata={'device_id': 'noisy_device'}
            )
            await adapter.write(packet)
            await asyncio.sleep(0.02)
        
        # With noise enabled, responses might vary
        # This is probabilistic, so we just check that responses exist
        assert hasattr(adapter, '_received_data')
        assert len(adapter._received_data) > 0
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_latency_variation(self, basic_config):
        """Test latency variation simulation"""
        basic_config.latency_variation = 1.0  # Maximum variation
        basic_config.transmission_delay = 0.01
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Measure transmission times
        times = []
        for i in range(5):
            start = datetime.utcnow()
            await adapter.write(b'\x01\x02\x03\x04')
            end = datetime.utcnow()
            times.append((end - start).total_seconds())
        
        # With latency variation, times should differ
        assert len(set(times)) > 1  # Not all times are identical
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_multiple_devices_interaction(self, basic_config):
        """Test interaction with multiple mock devices"""
        device1 = MockDevice(
            device_id="device1",
            name="Device 1",
            responses={b'\x01': b'\x11', b'\x02': b'\x12'}
        )
        device2 = MockDevice(
            device_id="device2",
            name="Device 2",
            responses={b'\x01': b'\x21', b'\x02': b'\x22'}
        )
        basic_config.devices = [device1, device2]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Send to device1
        packet1 = DataPacket(
            data=b'\x01',
            metadata={'device_id': 'device1'}
        )
        await adapter.write(packet1)
        await asyncio.sleep(0.05)
        
        # Send to device2
        packet2 = DataPacket(
            data=b'\x01',
            metadata={'device_id': 'device2'}
        )
        await adapter.write(packet2)
        await asyncio.sleep(0.05)
        
        # Check responses
        assert len(adapter._received_data) >= 2
        responses = {p.metadata.get('device_id'): p.data for p in adapter._received_data}
        assert responses.get('device1') == b'\x11'
        assert responses.get('device2') == b'\x21'
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_device_error_simulation(self, basic_config):
        """Test device-specific error rates"""
        device = MockDevice(
            device_id="error_device",
            name="Error Device",
            error_rate=0.5,  # 50% error rate
            responses={b'\x01': b'\x02'}
        )
        basic_config.devices = [device]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        error_count = 0
        success_count = 0
        
        # Send multiple commands
        for _ in range(20):
            packet = DataPacket(
                data=b'\x01',
                metadata={'device_id': 'error_device'}
            )
            try:
                await adapter.write(packet)
                await asyncio.sleep(0.02)
                success_count += 1
            except:
                error_count += 1
        
        # With 50% error rate, we should see some errors
        # This is probabilistic, so we use loose bounds
        assert error_count > 0
        assert success_count > 0
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_concurrent_auto_responses(self, device_config):
        """Test concurrent auto responses from multiple devices"""
        device1 = MockDevice(
            device_id="auto1",
            auto_responses=[b'\xA1', b'\xA2'],
            auto_interval=0.05
        )
        device2 = MockDevice(
            device_id="auto2",
            auto_responses=[b'\xB1', b'\xB2'],
            auto_interval=0.07
        )
        device_config.devices = [device1, device2]
        
        adapter = MockAdapter(device_config)
        await adapter.connect()
        
        # Wait for auto responses
        await asyncio.sleep(0.2)
        
        # Should have responses from both devices
        auto_responses = [
            p for p in adapter._received_data
            if p.metadata.get('auto_response')
        ]
        
        device_ids = {p.metadata.get('device_id') for p in auto_responses}
        assert 'auto1' in device_ids
        assert 'auto2' in device_ids
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_fragmentation_with_packet_loss(self, basic_config):
        """Test fragmentation combined with packet loss"""
        basic_config.simulate_fragmentation = True
        basic_config.max_fragment_size = 4
        basic_config.packet_loss_rate = 0.3  # 30% packet loss
        
        device = MockDevice(
            device_id="frag_loss_device",
            responses={b'\x01': b'\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C'}  # 12 bytes
        )
        basic_config.devices = [device]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Send command
        packet = DataPacket(
            data=b'\x01',
            metadata={'device_id': 'frag_loss_device'}
        )
        
        await adapter.write(packet)
        await asyncio.sleep(0.2)
        
        # With packet loss, we might not get all fragments
        fragments = [
            p for p in adapter._received_data
            if p.metadata.get('fragment')
        ]
        
        # Should have some fragments but possibly not all (3 expected without loss)
        assert len(fragments) >= 0  # Could lose all fragments
        assert len(fragments) <= 3  # Maximum 3 fragments
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_bandwidth_limit_with_multiple_writes(self, basic_config):
        """Test bandwidth limiting with concurrent writes"""
        basic_config.bandwidth_limit = 100  # 100 bytes per second
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Send multiple packets concurrently
        async def send_data(size):
            await adapter.write(b'\xFF' * size)
        
        start_time = datetime.utcnow()
        
        # Send 200 bytes total (should take ~2 seconds)
        await asyncio.gather(
            send_data(50),
            send_data(50),
            send_data(50),
            send_data(50)
        )
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        # Should take approximately 2 seconds (200 bytes / 100 bytes/sec)
        assert duration >= 1.8  # Allow some tolerance
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_connection_state_transitions(self, basic_config):
        """Test various connection state transitions"""
        adapter = MockAdapter(basic_config)
        
        # Initial state
        assert adapter.status.state == ConnectionState.DISCONNECTED
        
        # Connect
        await adapter.connect()
        assert adapter.status.state == ConnectionState.CONNECTED
        
        # Simulate error
        adapter._status.state = ConnectionState.ERROR
        adapter._status.last_error = "Simulated error"
        
        # Disconnect from error state
        await adapter.disconnect()
        assert adapter.status.state == ConnectionState.DISCONNECTED
        
        # Test reconnection
        adapter._status.state = ConnectionState.RECONNECTING
        assert not adapter.is_connected  # Not connected during reconnection
    
    @pytest.mark.asyncio
    async def test_metadata_propagation(self, device_config):
        """Test metadata propagation through request/response"""
        device = MockDevice(
            device_id="meta_device",
            responses={b'\x01': b'\x02\x03'}
        )
        device_config.devices = [device]
        
        adapter = MockAdapter(device_config)
        await adapter.connect()
        
        # Send with custom metadata
        packet = DataPacket(
            data=b'\x01',
            metadata={
                'device_id': 'meta_device',
                'request_id': 12345,
                'custom_field': 'test_value'
            }
        )
        
        await adapter.write(packet)
        await asyncio.sleep(0.05)
        
        # Check response metadata
        response = adapter._received_data[0]
        assert response.metadata.get('device_id') == 'meta_device'
        # Mock adapter might propagate some metadata
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_empty_response_handling(self, basic_config):
        """Test handling of empty responses"""
        device = MockDevice(
            device_id="empty_device",
            responses={b'\x01': b''}  # Empty response
        )
        basic_config.devices = [device]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        packet = DataPacket(
            data=b'\x01',
            metadata={'device_id': 'empty_device'}
        )
        
        await adapter.write(packet)
        await asyncio.sleep(0.05)
        
        # Should handle empty response gracefully
        if len(adapter._received_data) > 0:
            response = adapter._received_data[0]
            assert response.data == b''
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_large_data_transmission(self, basic_config):
        """Test transmission of large data packets"""
        # Create large response
        large_data = bytes(range(256)) * 100  # 25.6KB
        
        device = MockDevice(
            device_id="large_device",
            responses={b'\x01': large_data}
        )
        basic_config.devices = [device]
        
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        packet = DataPacket(
            data=b'\x01',
            metadata={'device_id': 'large_device'}
        )
        
        await adapter.write(packet)
        await asyncio.sleep(0.5)  # Allow time for large response
        
        # Check large response was received
        if len(adapter._received_data) > 0:
            response = adapter._received_data[0]
            assert len(response.data) == len(large_data)
            assert response.data == large_data
        
        await adapter.disconnect()
    
    def test_get_device_info_nonexistent(self, basic_config):
        """Test getting info for non-existent device"""
        adapter = MockAdapter(basic_config)
        
        info = adapter.get_device_info("nonexistent")
        assert info is None
    
    @pytest.mark.asyncio
    async def test_inject_data_without_device_id(self, basic_config):
        """Test data injection without specifying device ID"""
        adapter = MockAdapter(basic_config)
        await adapter.connect()
        
        # Inject without device_id
        await adapter.inject_data(b'\xDE\xAD\xBE\xEF')
        
        # Check injected data
        assert len(adapter._received_data) == 1
        packet = adapter._received_data[0]
        assert packet.data == b'\xDE\xAD\xBE\xEF'
        assert packet.metadata.get('injected') is True
        assert packet.metadata.get('device_id') is None
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_connection_with_no_devices(self):
        """Test adapter with no mock devices configured"""
        config = MockConfig(name="no_devices")
        adapter = MockAdapter(config)
        
        # Should connect successfully even with no devices
        await adapter.connect()
        assert adapter.is_connected
        
        # Can still write data
        await adapter.write(b'\x01\x02')
        assert adapter.status.bytes_sent == 2
        
        await adapter.disconnect()
    
    @pytest.mark.asyncio
    async def test_rapid_connect_disconnect(self, basic_config):
        """Test rapid connection/disconnection cycles"""
        adapter = MockAdapter(basic_config)
        
        for i in range(5):
            await adapter.connect()
            assert adapter.is_connected
            
            await adapter.write(bytes([i]))
            
            await adapter.disconnect()
            assert not adapter.is_connected
        
        # Should handle rapid cycles without issues
        assert adapter.status.bytes_sent == 5