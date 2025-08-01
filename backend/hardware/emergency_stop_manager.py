"""
Emergency Stop Manager
Central coordination for multiple emergency stop devices with fail-safe operation

This module manages multiple emergency stop devices, coordinates their states,
and ensures system-wide safety through redundancy and fail-safe mechanisms.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Callable, Set, Any
from enum import Enum, auto
import json

from .emergency_stop import (
    EmergencyStopAdapter, EmergencyStopState, EmergencyStopStatus,
    ButtonType, FaultType, EmergencyStopConfig, SerialEmergencyStopAdapter,
    USBHIDEmergencyStopAdapter, RedundantEmergencyStopAdapter
)
from .discovery import DeviceDiscovery, DiscoveredDevice

logger = logging.getLogger(__name__)


class SystemSafetyState(Enum):
    """Overall system safety state"""
    SAFE = "safe"  # All systems normal
    WARNING = "warning"  # Minor issues detected
    EMERGENCY = "emergency"  # Emergency stop active
    CRITICAL = "critical"  # Multiple failures
    UNKNOWN = "unknown"  # State cannot be determined


class EmergencyAction(Enum):
    """Actions to take during emergency"""
    STOP_ALL_MOTION = auto()
    DISABLE_POWER = auto()
    ENGAGE_BRAKES = auto()
    SOUND_ALARM = auto()
    NOTIFY_OPERATORS = auto()
    LOG_EVENT = auto()
    ACTIVATE_BEACON = auto()


@dataclass
class EmergencyEvent:
    """Record of an emergency stop event"""
    timestamp: datetime
    trigger_source: ButtonType
    trigger_reason: str
    system_state_before: SystemSafetyState
    system_state_after: SystemSafetyState
    actions_taken: List[EmergencyAction]
    operator_id: Optional[str] = None
    cleared_timestamp: Optional[datetime] = None
    cleared_by: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SafetyConfiguration:
    """Safety system configuration"""
    require_redundancy: bool = True
    auto_discovery_enabled: bool = True
    heartbeat_check_enabled: bool = True
    fail_safe_on_fault: bool = True
    allow_software_override: bool = False
    minimum_buttons_required: int = 1
    alarm_on_activation: bool = True
    log_all_events: bool = True
    test_mode_allowed: bool = True
    recovery_requires_all_clear: bool = True
    watchdog_timeout_ms: int = 1000


class EmergencyStopManager:
    """Manages multiple emergency stop devices and coordinates safety"""
    
    def __init__(self, config: SafetyConfiguration):
        self.config = config
        
        # Device management
        self._devices: Dict[str, EmergencyStopAdapter] = {}
        self._device_states: Dict[str, EmergencyStopStatus] = {}
        self._primary_device_id: Optional[str] = None
        
        # State tracking
        self._system_state = SystemSafetyState.UNKNOWN
        self._active_faults: Set[FaultType] = set()
        self._emergency_events: List[EmergencyEvent] = []
        self._last_state_change: Optional[datetime] = None
        
        # Callbacks
        self._state_change_handlers: List[Callable[[SystemSafetyState], None]] = []
        self._emergency_handlers: List[Callable[[EmergencyEvent], None]] = []
        self._fault_handlers: List[Callable[[str, List[FaultType]], None]] = []
        
        # Background tasks
        self._monitor_task: Optional[asyncio.Task] = None
        self._discovery_task: Optional[asyncio.Task] = None
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
        
        logger.info(f"Emergency Stop Manager initialized with config: {config}")
        
    async def initialize(self) -> None:
        """Initialize the emergency stop system"""
        logger.info("Initializing Emergency Stop Manager")
        
        # Start monitoring
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        
        # Start auto-discovery if enabled
        if self.config.auto_discovery_enabled:
            self._discovery_task = asyncio.create_task(self._discovery_loop())
            
        # Perform initial discovery
        await self.discover_devices()
        
        # Check minimum requirements
        if len(self._devices) < self.config.minimum_buttons_required:
            logger.error(f"Insufficient emergency stop devices: {len(self._devices)} < "
                        f"{self.config.minimum_buttons_required}")
            self._system_state = SystemSafetyState.CRITICAL
            
    async def shutdown(self) -> None:
        """Shutdown the emergency stop system"""
        logger.info("Shutting down Emergency Stop Manager")
        
        # Cancel background tasks
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
                
        if self._discovery_task:
            self._discovery_task.cancel()
            try:
                await self._discovery_task
            except asyncio.CancelledError:
                pass
                
        # Disconnect all devices
        await self.disconnect_all_devices()
        
    async def discover_devices(self) -> List[str]:
        """Discover emergency stop devices"""
        logger.info("Discovering emergency stop devices")
        discovered = []
        
        # Use device discovery to find emergency stop devices
        discovery = DeviceDiscovery()
        devices = await discovery.discover_serial_devices()
        
        for device in devices:
            if self._is_emergency_stop_device(device):
                device_id = await self._add_discovered_device(device)
                if device_id:
                    discovered.append(device_id)
                    
        # Also check for known USB devices
        usb_devices = self._discover_usb_devices()
        for usb_device in usb_devices:
            device_id = await self._add_usb_device(usb_device)
            if device_id:
                discovered.append(device_id)
                
        logger.info(f"Discovered {len(discovered)} emergency stop devices")
        return discovered
        
    def _is_emergency_stop_device(self, device: DiscoveredDevice) -> bool:
        """Check if a discovered device is an emergency stop"""
        # Check various indicators
        indicators = [
            'emergency', 'estop', 'e-stop', 'safety', 'kill'
        ]
        
        device_str = f"{device.name} {device.description}".lower()
        return any(indicator in device_str for indicator in indicators)
        
    def _discover_usb_devices(self) -> List[Dict[str, Any]]:
        """Discover known USB emergency stop devices"""
        # Known USB emergency stop devices (VID, PID pairs)
        known_devices = [
            {'vid': 0x16C0, 'pid': 0x05DF, 'name': 'USB Emergency Stop'},
            {'vid': 0x1234, 'pid': 0x5678, 'name': 'Industrial E-Stop'},
        ]
        
        discovered = []
        try:
            import hid
            for known in known_devices:
                try:
                    # Try to get device info
                    device = hid.device()
                    device.open(known['vid'], known['pid'])
                    device.close()
                    discovered.append(known)
                except:
                    pass
        except ImportError:
            logger.debug("USB HID support not available")
            
        return discovered
        
    async def _add_discovered_device(self, device: DiscoveredDevice) -> Optional[str]:
        """Add a discovered serial device"""
        try:
            # Generate device ID
            device_id = f"serial_{device.port}_{device.name}".replace(' ', '_')
            
            # Check if already added
            if device_id in self._devices:
                return None
                
            # Create configuration
            config = EmergencyStopConfig(
                name=device_id,
                button_type=self._determine_button_type(device),
                heartbeat_interval_ms=100,
                heartbeat_timeout_ms=500
            )
            
            # Create adapter
            adapter = SerialEmergencyStopAdapter(
                config=config,
                port=device.port,
                baudrate=device.baudrate or 115200
            )
            
            # Add device
            await self.add_device(device_id, adapter)
            return device_id
            
        except Exception as e:
            logger.error(f"Failed to add discovered device {device.name}: {e}")
            return None
            
    async def _add_usb_device(self, usb_info: Dict[str, Any]) -> Optional[str]:
        """Add a discovered USB device"""
        try:
            device_id = f"usb_{usb_info['vid']:04x}_{usb_info['pid']:04x}"
            
            if device_id in self._devices:
                return None
                
            config = EmergencyStopConfig(
                name=device_id,
                button_type=ButtonType.PRIMARY,
                heartbeat_interval_ms=50  # USB is faster
            )
            
            adapter = USBHIDEmergencyStopAdapter(
                config=config,
                vendor_id=usb_info['vid'],
                product_id=usb_info['pid']
            )
            
            await self.add_device(device_id, adapter)
            return device_id
            
        except Exception as e:
            logger.error(f"Failed to add USB device: {e}")
            return None
            
    def _determine_button_type(self, device: DiscoveredDevice) -> ButtonType:
        """Determine button type from device info"""
        name_lower = device.name.lower()
        
        if 'primary' in name_lower or 'main' in name_lower:
            return ButtonType.PRIMARY
        elif 'secondary' in name_lower or 'backup' in name_lower:
            return ButtonType.SECONDARY
        elif 'remote' in name_lower:
            return ButtonType.REMOTE
        else:
            # Default based on number of devices
            return ButtonType.PRIMARY if not self._devices else ButtonType.SECONDARY
            
    async def add_device(self, device_id: str, adapter: EmergencyStopAdapter) -> None:
        """Add an emergency stop device"""
        async with self._lock:
            if device_id in self._devices:
                logger.warning(f"Device {device_id} already registered")
                return
                
            logger.info(f"Adding emergency stop device: {device_id}")
            
            # Register callbacks
            adapter.register_state_change_handler(
                lambda state: asyncio.create_task(self._handle_device_state_change(device_id, state))
            )
            adapter.register_fault_handler(
                lambda faults: asyncio.create_task(self._handle_device_fault(device_id, faults))
            )
            
            # Connect and initialize
            try:
                await adapter.connect()
                await adapter.initialize()
                
                # Store device
                self._devices[device_id] = adapter
                self._device_states[device_id] = await adapter.update_status()
                
                # Set as primary if none exists
                if not self._primary_device_id:
                    self._primary_device_id = device_id
                    
                # Update system state
                await self._update_system_state()
                
            except Exception as e:
                logger.error(f"Failed to add device {device_id}: {e}")
                raise
                
    async def remove_device(self, device_id: str) -> None:
        """Remove an emergency stop device"""
        async with self._lock:
            if device_id not in self._devices:
                return
                
            logger.info(f"Removing emergency stop device: {device_id}")
            
            # Disconnect device
            adapter = self._devices[device_id]
            await adapter.disconnect()
            
            # Remove from tracking
            del self._devices[device_id]
            del self._device_states[device_id]
            
            # Update primary if needed
            if self._primary_device_id == device_id:
                self._primary_device_id = next(iter(self._devices), None)
                
            # Update system state
            await self._update_system_state()
            
    async def disconnect_all_devices(self) -> None:
        """Disconnect all devices"""
        tasks = []
        for device_id, adapter in self._devices.items():
            tasks.append(adapter.disconnect())
            
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            
        self._devices.clear()
        self._device_states.clear()
        self._primary_device_id = None
        
    async def activate_emergency_stop(self, 
                                    source: Optional[str] = None,
                                    reason: str = "Manual activation") -> bool:
        """Activate emergency stop across all devices"""
        logger.warning(f"ACTIVATING EMERGENCY STOP - Source: {source}, Reason: {reason}")
        
        async with self._lock:
            # Record event
            event = EmergencyEvent(
                timestamp=datetime.utcnow(),
                trigger_source=ButtonType.SOFTWARE if not source else self._get_device_type(source),
                trigger_reason=reason,
                system_state_before=self._system_state,
                system_state_after=SystemSafetyState.EMERGENCY,
                actions_taken=[]
            )
            
            # Activate all devices
            results = await asyncio.gather(
                *[adapter.activate_emergency_stop() for adapter in self._devices.values()],
                return_exceptions=True
            )
            
            # Check results
            success_count = sum(1 for r in results if r is True)
            total_count = len(results)
            
            if success_count == 0 and total_count > 0:
                logger.error("Failed to activate any emergency stop devices")
                return False
                
            # Take emergency actions
            await self._execute_emergency_actions(event)
            
            # Update state
            self._system_state = SystemSafetyState.EMERGENCY
            self._last_state_change = datetime.utcnow()
            
            # Store event
            self._emergency_events.append(event)
            
            # Notify handlers
            await self._notify_emergency(event)
            await self._notify_state_change(SystemSafetyState.EMERGENCY)
            
            return True
            
    async def deactivate_emergency_stop(self, 
                                      operator_id: str,
                                      override_safety: bool = False) -> bool:
        """Deactivate emergency stop (requires safety checks)"""
        logger.info(f"Attempting to deactivate emergency stop - Operator: {operator_id}")
        
        async with self._lock:
            # Safety checks
            if not override_safety:
                if not await self._perform_safety_checks():
                    logger.warning("Safety checks failed - cannot deactivate")
                    return False
                    
            # Deactivate all devices
            results = await asyncio.gather(
                *[adapter.deactivate_emergency_stop() for adapter in self._devices.values()],
                return_exceptions=True
            )
            
            # Check results
            success_count = sum(1 for r in results if r is True)
            
            if success_count < len(self._devices) and self.config.recovery_requires_all_clear:
                logger.error("Not all devices cleared - cannot deactivate")
                return False
                
            # Update last event
            if self._emergency_events:
                last_event = self._emergency_events[-1]
                last_event.cleared_timestamp = datetime.utcnow()
                last_event.cleared_by = operator_id
                
            # Update state
            self._system_state = SystemSafetyState.SAFE
            self._last_state_change = datetime.utcnow()
            
            # Notify handlers
            await self._notify_state_change(SystemSafetyState.SAFE)
            
            return True
            
    async def _perform_safety_checks(self) -> bool:
        """Perform safety checks before deactivation"""
        # Check all devices are healthy
        for device_id, status in self._device_states.items():
            if not status.is_healthy:
                logger.warning(f"Device {device_id} is not healthy")
                return False
                
        # Check no active faults
        if self._active_faults:
            logger.warning(f"Active faults present: {self._active_faults}")
            return False
            
        # Additional application-specific checks would go here
        
        return True
        
    async def test_system(self) -> Dict[str, Any]:
        """Test the emergency stop system"""
        logger.info("Testing emergency stop system")
        
        test_results = {
            'timestamp': datetime.utcnow().isoformat(),
            'devices': {},
            'overall': 'PASS'
        }
        
        # Test each device
        for device_id, adapter in self._devices.items():
            try:
                # Run adapter test
                test_passed = await adapter.test_emergency_stop()
                
                # Get diagnostics
                diagnostics = await adapter.run_diagnostics()
                
                test_results['devices'][device_id] = {
                    'test_passed': test_passed,
                    'diagnostics': diagnostics
                }
                
                if not test_passed:
                    test_results['overall'] = 'FAIL'
                    
            except Exception as e:
                logger.error(f"Test failed for device {device_id}: {e}")
                test_results['devices'][device_id] = {
                    'test_passed': False,
                    'error': str(e)
                }
                test_results['overall'] = 'FAIL'
                
        return test_results
        
    async def _monitor_loop(self) -> None:
        """Background monitoring loop"""
        while True:
            try:
                # Update all device states
                for device_id, adapter in list(self._devices.items()):
                    try:
                        status = await adapter.update_status()
                        self._device_states[device_id] = status
                    except Exception as e:
                        logger.error(f"Failed to update status for {device_id}: {e}")
                        
                # Update system state
                await self._update_system_state()
                
                # Check for stuck buttons
                await self._check_stuck_buttons()
                
                # Wait before next check
                await asyncio.sleep(0.5)  # 500ms interval
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
                await asyncio.sleep(1.0)
                
    async def _discovery_loop(self) -> None:
        """Background device discovery loop"""
        while True:
            try:
                # Periodic discovery
                await asyncio.sleep(30.0)  # Every 30 seconds
                await self.discover_devices()
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Discovery loop error: {e}")
                
    async def _update_system_state(self) -> None:
        """Update overall system state based on device states"""
        if not self._devices:
            self._system_state = SystemSafetyState.UNKNOWN
            return
            
        # Check for emergency states
        emergency_count = sum(1 for status in self._device_states.values()
                            if status.state == EmergencyStopState.TRIGGERED)
        
        if emergency_count > 0:
            self._system_state = SystemSafetyState.EMERGENCY
        elif self._active_faults:
            self._system_state = SystemSafetyState.CRITICAL
        elif any(not status.is_healthy for status in self._device_states.values()):
            self._system_state = SystemSafetyState.WARNING
        else:
            self._system_state = SystemSafetyState.SAFE
            
    async def _check_stuck_buttons(self) -> None:
        """Check for stuck emergency stop buttons"""
        current_time = datetime.utcnow()
        
        for device_id, status in self._device_states.items():
            if status.state == EmergencyStopState.TRIGGERED:
                # Check if button has been stuck for too long
                if self._last_state_change:
                    stuck_duration = (current_time - self._last_state_change).total_seconds()
                    if stuck_duration > 300:  # 5 minutes
                        logger.warning(f"Device {device_id} may have stuck button "
                                     f"(triggered for {stuck_duration}s)")
                        
    async def _handle_device_state_change(self, device_id: str, state: EmergencyStopState) -> None:
        """Handle state change from a device"""
        logger.info(f"Device {device_id} state changed to: {state}")
        
        async with self._lock:
            # Update device state
            if device_id in self._device_states:
                self._device_states[device_id].state = state
                
            # Update system state
            await self._update_system_state()
            
            # Handle emergency activation
            if state == EmergencyStopState.TRIGGERED:
                await self.activate_emergency_stop(
                    source=device_id,
                    reason="Hardware button activation"
                )
                
    async def _handle_device_fault(self, device_id: str, faults: List[FaultType]) -> None:
        """Handle fault from a device"""
        logger.error(f"Device {device_id} reported faults: {faults}")
        
        async with self._lock:
            # Add to active faults
            self._active_faults.update(faults)
            
            # Update system state
            await self._update_system_state()
            
            # Notify fault handlers
            for handler in self._fault_handlers:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(device_id, faults)
                    else:
                        handler(device_id, faults)
                except Exception as e:
                    logger.error(f"Fault handler error: {e}")
                    
            # Take fail-safe action if configured
            if self.config.fail_safe_on_fault and FaultType.HEARTBEAT_TIMEOUT in faults:
                await self.activate_emergency_stop(
                    source=device_id,
                    reason="Heartbeat timeout - fail-safe activation"
                )
                
    async def _execute_emergency_actions(self, event: EmergencyEvent) -> None:
        """Execute emergency actions"""
        actions = []
        
        # Always stop motion
        actions.append(EmergencyAction.STOP_ALL_MOTION)
        
        # Log event
        if self.config.log_all_events:
            actions.append(EmergencyAction.LOG_EVENT)
            
        # Sound alarm
        if self.config.alarm_on_activation:
            actions.append(EmergencyAction.SOUND_ALARM)
            
        # Additional actions based on configuration
        actions.extend([
            EmergencyAction.DISABLE_POWER,
            EmergencyAction.ENGAGE_BRAKES,
            EmergencyAction.NOTIFY_OPERATORS,
            EmergencyAction.ACTIVATE_BEACON
        ])
        
        event.actions_taken = actions
        
        # Execute actions (implementation specific)
        logger.info(f"Executing emergency actions: {actions}")
        
    async def _notify_state_change(self, new_state: SystemSafetyState) -> None:
        """Notify state change handlers"""
        for handler in self._state_change_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(new_state)
                else:
                    handler(new_state)
            except Exception as e:
                logger.error(f"State change handler error: {e}")
                
    async def _notify_emergency(self, event: EmergencyEvent) -> None:
        """Notify emergency handlers"""
        for handler in self._emergency_handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(event)
                else:
                    handler(event)
            except Exception as e:
                logger.error(f"Emergency handler error: {e}")
                
    def _get_device_type(self, device_id: str) -> ButtonType:
        """Get button type for a device"""
        if device_id in self._devices:
            return self._devices[device_id].config.button_type
        return ButtonType.UNKNOWN
        
    def register_state_change_handler(self, handler: Callable[[SystemSafetyState], None]) -> None:
        """Register a system state change handler"""
        self._state_change_handlers.append(handler)
        
    def register_emergency_handler(self, handler: Callable[[EmergencyEvent], None]) -> None:
        """Register an emergency event handler"""
        self._emergency_handlers.append(handler)
        
    def register_fault_handler(self, handler: Callable[[str, List[FaultType]], None]) -> None:
        """Register a fault handler"""
        self._fault_handlers.append(handler)
        
    @property
    def system_state(self) -> SystemSafetyState:
        """Get current system safety state"""
        return self._system_state
        
    @property
    def is_emergency_active(self) -> bool:
        """Check if emergency stop is active"""
        return self._system_state == SystemSafetyState.EMERGENCY
        
    @property
    def device_count(self) -> int:
        """Get number of connected devices"""
        return len(self._devices)
        
    def get_device_states(self) -> Dict[str, EmergencyStopStatus]:
        """Get all device states"""
        return self._device_states.copy()
        
    def get_emergency_events(self, limit: int = 100) -> List[EmergencyEvent]:
        """Get recent emergency events"""
        return self._emergency_events[-limit:]
        
    def export_diagnostics(self) -> Dict[str, Any]:
        """Export comprehensive diagnostics"""
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'system_state': self._system_state.value,
            'device_count': len(self._devices),
            'devices': {
                device_id: {
                    'state': status.state.value,
                    'is_healthy': status.is_healthy,
                    'button_type': status.button_type.value,
                    'fault_codes': [f.name for f in status.fault_codes],
                    'voltage': status.voltage_level,
                    'response_time_ms': status.response_time_ms,
                    'activation_count': status.activation_count
                }
                for device_id, status in self._device_states.items()
            },
            'active_faults': [f.name for f in self._active_faults],
            'recent_events': [
                {
                    'timestamp': event.timestamp.isoformat(),
                    'trigger_source': event.trigger_source.value,
                    'trigger_reason': event.trigger_reason,
                    'cleared': event.cleared_timestamp.isoformat() if event.cleared_timestamp else None
                }
                for event in self._emergency_events[-10:]
            ],
            'configuration': {
                'require_redundancy': self.config.require_redundancy,
                'minimum_buttons': self.config.minimum_buttons_required,
                'fail_safe_enabled': self.config.fail_safe_on_fault
            }
        }