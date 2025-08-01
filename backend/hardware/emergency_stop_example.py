"""
Emergency Stop System Example
Demonstrates how to set up and use the emergency stop hardware integration

This example shows:
- Device discovery and connection
- State monitoring
- Emergency activation/deactivation
- Fault handling
- System diagnostics
"""

import asyncio
import logging
from datetime import datetime
from emergency_stop_manager import (
    EmergencyStopManager, 
    SafetyConfiguration,
    SystemSafetyState,
    EmergencyEvent,
    FaultType
)
from emergency_stop import (
    EmergencyStopConfig,
    SerialEmergencyStopAdapter,
    USBHIDEmergencyStopAdapter,
    RedundantEmergencyStopAdapter,
    ButtonType,
    EmergencyStopState
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


async def main():
    """Main example function"""
    
    # Create safety configuration
    config = SafetyConfiguration(
        require_redundancy=True,
        auto_discovery_enabled=True,
        heartbeat_check_enabled=True,
        fail_safe_on_fault=True,
        minimum_buttons_required=1,
        alarm_on_activation=True,
        log_all_events=True,
        test_mode_allowed=True
    )
    
    # Create emergency stop manager
    manager = EmergencyStopManager(config)
    
    # Register event handlers
    manager.register_state_change_handler(on_state_change)
    manager.register_emergency_handler(on_emergency)
    manager.register_fault_handler(on_fault)
    
    try:
        # Initialize the system
        logger.info("Initializing emergency stop system...")
        await manager.initialize()
        
        # Wait for devices to be discovered
        await asyncio.sleep(2)
        
        # Display initial status
        logger.info(f"System state: {manager.system_state.value}")
        logger.info(f"Connected devices: {manager.device_count}")
        
        # Get device states
        device_states = manager.get_device_states()
        for device_id, status in device_states.items():
            logger.info(f"Device {device_id}:")
            logger.info(f"  - State: {status.state.value}")
            logger.info(f"  - Type: {status.button_type.value}")
            logger.info(f"  - Healthy: {status.is_healthy}")
            logger.info(f"  - Voltage: {status.voltage_level}V")
            
        # Example 1: Manual device addition (if auto-discovery didn't find all)
        if manager.device_count == 0:
            await add_manual_devices(manager)
            
        # Example 2: Test the system
        logger.info("\n--- Running system test ---")
        test_results = await manager.test_system()
        logger.info(f"Test result: {test_results['overall']}")
        
        # Example 3: Simulate emergency activation
        logger.info("\n--- Simulating emergency activation ---")
        await asyncio.sleep(2)
        
        success = await manager.activate_emergency_stop(
            source="example_script",
            reason="Demonstration of emergency activation"
        )
        
        if success:
            logger.info("Emergency stop activated successfully")
            
            # Show current state
            await asyncio.sleep(1)
            logger.info(f"System is now in {manager.system_state.value} state")
            
            # Wait a bit
            await asyncio.sleep(3)
            
            # Deactivate
            logger.info("\n--- Deactivating emergency stop ---")
            success = await manager.deactivate_emergency_stop(
                operator_id="demo_operator",
                override_safety=True  # For demo purposes
            )
            
            if success:
                logger.info("Emergency stop deactivated successfully")
            else:
                logger.error("Failed to deactivate emergency stop")
                
        # Example 4: Get diagnostics
        logger.info("\n--- System diagnostics ---")
        diagnostics = manager.export_diagnostics()
        logger.info(f"System health: {diagnostics}")
        
        # Example 5: Get event history
        events = manager.get_emergency_events(limit=10)
        logger.info(f"\n--- Recent events ({len(events)} total) ---")
        for event in events:
            logger.info(f"  - {event.timestamp}: {event.trigger_reason}")
            
        # Keep running for monitoring
        logger.info("\n--- Monitoring system (press Ctrl+C to stop) ---")
        while True:
            await asyncio.sleep(5)
            # Could add periodic status checks here
            
    except KeyboardInterrupt:
        logger.info("\nShutting down...")
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
    finally:
        # Clean shutdown
        await manager.shutdown()
        logger.info("Emergency stop system shutdown complete")


async def add_manual_devices(manager: EmergencyStopManager):
    """Example of manually adding devices"""
    logger.info("Adding manual devices for demonstration...")
    
    # Example 1: Add a serial emergency stop
    serial_config = EmergencyStopConfig(
        name="demo_serial_estop",
        button_type=ButtonType.PRIMARY,
        heartbeat_interval_ms=100,
        heartbeat_timeout_ms=500
    )
    
    serial_adapter = SerialEmergencyStopAdapter(
        config=serial_config,
        port="COM3",  # Adjust for your system
        baudrate=115200
    )
    
    try:
        await manager.add_device("serial_primary", serial_adapter)
        logger.info("Added serial emergency stop device")
    except Exception as e:
        logger.error(f"Failed to add serial device: {e}")
        
    # Example 2: Add a USB HID emergency stop
    usb_config = EmergencyStopConfig(
        name="demo_usb_estop",
        button_type=ButtonType.SECONDARY,
        heartbeat_interval_ms=50
    )
    
    usb_adapter = USBHIDEmergencyStopAdapter(
        config=usb_config,
        vendor_id=0x16C0,  # Example VID
        product_id=0x05DF   # Example PID
    )
    
    try:
        await manager.add_device("usb_secondary", usb_adapter)
        logger.info("Added USB emergency stop device")
    except Exception as e:
        logger.error(f"Failed to add USB device: {e}")


# Event handlers
def on_state_change(state: SystemSafetyState):
    """Handle system state changes"""
    logger.warning(f"SYSTEM STATE CHANGED: {state.value}")
    
    if state == SystemSafetyState.EMERGENCY:
        logger.error("!!! EMERGENCY STOP ACTIVE !!!")
        # Here you would trigger additional safety actions
    elif state == SystemSafetyState.SAFE:
        logger.info("System returned to safe state")


async def on_emergency(event: EmergencyEvent):
    """Handle emergency events"""
    logger.error(f"EMERGENCY EVENT: {event.trigger_reason}")
    logger.error(f"  Source: {event.trigger_source.value}")
    logger.error(f"  Actions: {[a.name for a in event.actions_taken]}")
    
    # Simulate notifying operators
    await notify_operators(event)


async def on_fault(device_id: str, faults: list[FaultType]):
    """Handle device faults"""
    logger.error(f"DEVICE FAULT on {device_id}:")
    for fault in faults:
        logger.error(f"  - {fault.name}")
        
    # Take corrective action based on fault type
    if FaultType.HEARTBEAT_TIMEOUT in faults:
        logger.error("  => Device may be disconnected!")
    elif FaultType.POWER_LOSS in faults:
        logger.error("  => Check device power supply!")


async def notify_operators(event: EmergencyEvent):
    """Simulate operator notification"""
    logger.info("Notifying operators of emergency event...")
    # In real system, would send alerts via email, SMS, etc.
    await asyncio.sleep(0.1)  # Simulate notification delay


if __name__ == "__main__":
    asyncio.run(main())