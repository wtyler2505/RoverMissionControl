#!/usr/bin/env python3
"""
Simple test runner for HAL components
"""

import sys
import os
import asyncio

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

async def test_mock_adapter():
    """Test basic mock adapter functionality"""
    print("Testing Mock Adapter...")
    
    try:
        from hardware.mock_adapter import MockAdapter, MockConfig
        from hardware.base import DataPacket, DataDirection
        
        # Create config
        config = MockConfig(
            name="Test Mock Adapter",
            transmission_delay=0.01
        )
        
        # Create adapter
        adapter = MockAdapter(config)
        
        # Test connection
        await adapter.connect()
        assert adapter.is_connected, "Adapter should be connected"
        print("[OK] Connection successful")
        
        # Test write
        packet = DataPacket(data=b"Hello")
        await adapter.write(packet)
        print("[OK] Write successful")
        
        # Use inject_data to simulate received data
        await adapter.inject_data(b"World")
        
        # Test read
        response = await adapter.read(timeout=1.0)
        assert response.data == b"World", f"Expected b'World', got {response.data}"
        print("[OK] Read successful")
        
        # Test disconnect
        await adapter.disconnect()
        assert not adapter.is_connected, "Adapter should be disconnected"
        print("[OK] Disconnection successful")
        
        print("\n[PASS] Mock Adapter tests passed!")
        return True
        
    except Exception as e:
        print(f"\n[FAIL] Mock Adapter test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_factory():
    """Test protocol factory"""
    print("\nTesting Protocol Factory...")
    
    try:
        from hardware.factory import ProtocolAdapterFactory
        from hardware.base import ProtocolType
        from hardware.mock_adapter import MockConfig
        
        # Create mock adapter
        config = MockConfig(name="Factory Test")
        adapter = ProtocolAdapterFactory.create_adapter(
            ProtocolType.MOCK, 
            config,
            adapter_id="test_adapter"
        )
        
        assert adapter is not None, "Adapter should be created"
        print("[OK] Adapter creation successful")
        
        # Check active adapters
        assert "test_adapter" in ProtocolAdapterFactory._active_adapters
        print("[OK] Adapter registered successfully")
        
        # Test get adapter
        retrieved = ProtocolAdapterFactory.get_adapter("test_adapter")
        assert retrieved is adapter, "Should retrieve same adapter"
        print("[OK] Adapter retrieval successful")
        
        print("\n[PASS] Factory tests passed!")
        return True
        
    except Exception as e:
        print(f"\n[FAIL] Factory test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_simulation_integration():
    """Test simulation HAL integration"""
    print("\nTesting Simulation Integration...")
    
    try:
        from hardware.simulation.hal_integration import HALSimulationIntegration
        from hardware.base import ProtocolType
        
        # Create integration
        integration = HALSimulationIntegration()
        
        # Initialize with basic config
        await integration.initialize({})
        print("[OK] Integration initialized")
        
        # Add a simulated device
        device_id = await integration.add_simulated_device(
            profile_name="temp_sensor",
            protocol_type=ProtocolType.MOCK
        )
        
        assert device_id is not None, "Device should be created"
        print(f"[OK] Simulated device added: {device_id}")
        
        # Get devices
        devices = await integration.get_simulated_devices()
        assert len(devices) == 1, f"Expected 1 device, got {len(devices)}"
        print("[OK] Device retrieval successful")
        
        print("\n[PASS] Simulation integration tests passed!")
        return True
        
    except Exception as e:
        print(f"\n[FAIL] Simulation integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_hal_send_command():
    """Test HAL send_command functionality"""
    print("\nTesting HAL send_command...")
    
    try:
        from hardware.simulation.hal_integration import HALSimulationIntegration
        from hardware.base import ProtocolType
        from hardware.mock_adapter import MockDevice
        import json
        
        # Create integration
        integration = HALSimulationIntegration()
        
        # Initialize with basic config
        await integration.initialize({})
        print("[OK] Integration initialized")
        
        # Add a simulated device
        device_id = await integration.add_simulated_device(
            profile_name="temp_sensor",
            protocol_type=ProtocolType.MOCK
        )
        print(f"[OK] Device added: {device_id}")
        
        # Get the adapter and configure mock responses
        adapter_id = integration.simulated_devices[device_id].adapter_id
        adapter = integration.adapters[adapter_id]
        
        # Set up a mock response for our command
        test_command = {"action": "read_temperature"}
        test_response = {"temperature": 25.5, "unit": "celsius"}
        
        # Configure the mock device to respond to our command
        mock_device = MockDevice(device_id=device_id)
        mock_device.responses[json.dumps(test_command).encode('utf-8')] = json.dumps(test_response).encode('utf-8')
        adapter.add_device(mock_device)
        
        # Send command
        response = await integration.send_command(device_id, test_command)
        print(f"[OK] Command sent to sensor: {test_command}")
        print(f"[OK] Response received: {response}")
        
        # Verify response
        assert response == test_response, f"Expected {test_response}, got {response}"
        print("[OK] Response matches expected value")
        
        print("\n[PASS] HAL send_command test passed!")
        return True
        
    except Exception as e:
        print(f"\n[FAIL] HAL send_command test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    print("="*60)
    print("HARDWARE ABSTRACTION LAYER - SIMPLE TEST SUITE")
    print("="*60)
    
    results = []
    
    # Run tests
    results.append(await test_mock_adapter())
    results.append(await test_factory())
    results.append(await test_simulation_integration())
    results.append(await test_hal_send_command())
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        print("\n[SUCCESS] ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n[ERROR] {total - passed} TESTS FAILED")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)