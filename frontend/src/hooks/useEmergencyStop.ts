/**
 * Emergency Stop Hardware Integration Hook
 * 
 * Provides real-time bidirectional communication with emergency stop hardware
 * through WebSocket connection. Manages hardware state, fault detection, and
 * emergency event handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../services/websocket';

// Types for emergency stop system
export enum SystemSafetyState {
  SAFE = 'safe',
  WARNING = 'warning',
  EMERGENCY = 'emergency',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

export enum EmergencyStopState {
  NORMAL = 'normal',
  TRIGGERED = 'triggered',
  FAULT = 'fault',
  UNKNOWN = 'unknown',
  TEST = 'test'
}

export enum ButtonType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  REMOTE = 'remote',
  SOFTWARE = 'software',
  EXTERNAL = 'external'
}

export enum FaultType {
  COMMUNICATION_LOSS = 'COMMUNICATION_LOSS',
  HEARTBEAT_TIMEOUT = 'HEARTBEAT_TIMEOUT',
  INVALID_STATE = 'INVALID_STATE',
  HARDWARE_FAILURE = 'HARDWARE_FAILURE',
  POWER_LOSS = 'POWER_LOSS',
  WIRING_FAULT = 'WIRING_FAULT',
  BUTTON_STUCK = 'BUTTON_STUCK',
  REDUNDANCY_MISMATCH = 'REDUNDANCY_MISMATCH'
}

export interface EmergencyDevice {
  deviceId: string;
  state: EmergencyStopState;
  buttonType: ButtonType;
  isHealthy: boolean;
  voltage: number;
  responseTimeMs: number;
  faultCodes: FaultType[];
  lastHeartbeat?: string;
  activationCount?: number;
}

export interface EmergencyEvent {
  timestamp: string;
  triggerSource: ButtonType;
  triggerReason: string;
  systemStateBefore: SystemSafetyState;
  systemStateAfter: SystemSafetyState;
  actionsTaken: string[];
  clearedTimestamp?: string;
  clearedBy?: string;
}

export interface EmergencyStopStatus {
  systemState: SystemSafetyState;
  isEmergencyActive: boolean;
  deviceCount: number;
  devices: Record<string, EmergencyDevice>;
  activeFaults: FaultType[];
  lastStateChange?: string;
  recentEvents: EmergencyEvent[];
}

export interface UseEmergencyStopOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onEmergencyActivated?: (event: EmergencyEvent) => void;
  onEmergencyCleared?: (event: EmergencyEvent) => void;
  onFault?: (deviceId: string, faults: FaultType[]) => void;
  onDeviceConnected?: (deviceId: string) => void;
  onDeviceDisconnected?: (deviceId: string) => void;
}

export interface UseEmergencyStopReturn {
  // State
  status: EmergencyStopStatus;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  activateEmergencyStop: (reason: string) => Promise<boolean>;
  deactivateEmergencyStop: (safetyConfirmed: boolean, overrideSafety?: boolean) => Promise<boolean>;
  testSystem: () => Promise<any>;
  refreshDevices: () => Promise<void>;
  
  // Device management
  getDevice: (deviceId: string) => EmergencyDevice | undefined;
  getPrimaryDevice: () => EmergencyDevice | undefined;
  getHealthyDeviceCount: () => number;
  
  // Diagnostics
  getDiagnostics: () => Promise<any>;
  exportEventLog: () => EmergencyEvent[];
}

const DEFAULT_OPTIONS: UseEmergencyStopOptions = {
  autoConnect: true,
  reconnectInterval: 5000,
  heartbeatInterval: 30000
};

export const useEmergencyStop = (
  options: UseEmergencyStopOptions = {}
): UseEmergencyStopReturn => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // WebSocket connection
  const ws = useWebSocket('/api/emergency-stop/ws');
  
  // State
  const [status, setStatus] = useState<EmergencyStopStatus>({
    systemState: SystemSafetyState.UNKNOWN,
    isEmergencyActive: false,
    deviceCount: 0,
    devices: {},
    activeFaults: [],
    recentEvents: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for callbacks
  const callbacksRef = useRef(options);
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);
  
  // Heartbeat timer
  const heartbeatTimerRef = useRef<NodeJS.Timeout>();
  
  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws.socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'emergency_state':
            handleEmergencyState(message.data);
            break;
            
          case 'device_status':
            handleDeviceStatus(message.data);
            break;
            
          case 'device_update':
            handleDeviceUpdate(message.data);
            break;
            
          case 'emergency_event':
            handleEmergencyEvent(message.data);
            break;
            
          case 'fault_notification':
            handleFaultNotification(message.data);
            break;
            
          case 'event_history':
            handleEventHistory(message.data);
            break;
            
          case 'test_results':
            handleTestResults(message.data);
            break;
            
          case 'diagnostics':
            handleDiagnostics(message.data);
            break;
            
          case 'command_result':
            handleCommandResult(message.data);
            break;
            
          case 'error':
            handleError(message.data);
            break;
        }
      } catch (err) {
        console.error('Failed to parse emergency stop message:', err);
        setError('Communication error with emergency stop system');
      }
    };
    
    ws.socket.addEventListener('message', handleMessage);
    
    // Subscribe to updates
    if (ws.isConnected) {
      ws.send({
        type: 'subscribe',
        data: { topics: ['all'] }
      });
      
      setIsLoading(false);
    }
    
    return () => {
      ws.socket.removeEventListener('message', handleMessage);
    };
  }, [ws.socket, ws.isConnected]);
  
  // Heartbeat mechanism
  useEffect(() => {
    if (!ws.isConnected || !opts.heartbeatInterval) return;
    
    const sendHeartbeat = () => {
      ws.send({
        type: 'heartbeat',
        data: { timestamp: new Date().toISOString() }
      });
    };
    
    heartbeatTimerRef.current = setInterval(sendHeartbeat, opts.heartbeatInterval);
    
    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
      }
    };
  }, [ws.isConnected, opts.heartbeatInterval]);
  
  // Message handlers
  const handleEmergencyState = useCallback((data: any) => {
    setStatus(prev => ({
      ...prev,
      systemState: data.system_state,
      isEmergencyActive: data.is_emergency_active,
      deviceCount: data.device_count || prev.deviceCount,
      lastStateChange: data.timestamp
    }));
  }, []);
  
  const handleDeviceStatus = useCallback((data: any) => {
    const devices: Record<string, EmergencyDevice> = {};
    
    for (const [deviceId, deviceData] of Object.entries(data.devices || {})) {
      devices[deviceId] = {
        deviceId,
        state: deviceData.state,
        buttonType: deviceData.button_type,
        isHealthy: deviceData.is_healthy,
        voltage: deviceData.voltage,
        responseTimeMs: deviceData.response_time_ms,
        faultCodes: deviceData.fault_codes || [],
        activationCount: deviceData.activation_count
      } as EmergencyDevice;
    }
    
    setStatus(prev => ({
      ...prev,
      devices,
      deviceCount: Object.keys(devices).length
    }));
  }, []);
  
  const handleDeviceUpdate = useCallback((data: any) => {
    const { device_id, status: deviceStatus } = data;
    
    setStatus(prev => ({
      ...prev,
      devices: {
        ...prev.devices,
        [device_id]: {
          ...prev.devices[device_id],
          ...deviceStatus,
          deviceId: device_id
        }
      }
    }));
    
    // Notify if device state changed
    if (deviceStatus.state === EmergencyStopState.TRIGGERED) {
      callbacksRef.current.onDeviceConnected?.(device_id);
    }
  }, []);
  
  const handleEmergencyEvent = useCallback((data: any) => {
    const event: EmergencyEvent = {
      timestamp: data.timestamp,
      triggerSource: data.trigger_source,
      triggerReason: data.trigger_reason,
      systemStateBefore: data.system_state_before,
      systemStateAfter: data.system_state_after,
      actionsTaken: data.actions_taken || []
    };
    
    // Add to recent events
    setStatus(prev => ({
      ...prev,
      recentEvents: [event, ...prev.recentEvents].slice(0, 100)
    }));
    
    // Notify callbacks
    if (event.systemStateAfter === SystemSafetyState.EMERGENCY) {
      callbacksRef.current.onEmergencyActivated?.(event);
    } else if (event.systemStateBefore === SystemSafetyState.EMERGENCY) {
      callbacksRef.current.onEmergencyCleared?.(event);
    }
  }, []);
  
  const handleFaultNotification = useCallback((data: any) => {
    const { device_id, faults } = data;
    
    // Update device faults
    setStatus(prev => ({
      ...prev,
      devices: {
        ...prev.devices,
        [device_id]: {
          ...prev.devices[device_id],
          faultCodes: faults,
          isHealthy: false
        }
      },
      activeFaults: Array.from(new Set([...prev.activeFaults, ...faults]))
    }));
    
    // Notify callback
    callbacksRef.current.onFault?.(device_id, faults);
  }, []);
  
  const handleEventHistory = useCallback((data: any) => {
    const events: EmergencyEvent[] = (data.events || []).map((e: any) => ({
      timestamp: e.timestamp,
      triggerSource: e.trigger_source,
      triggerReason: e.trigger_reason,
      clearedTimestamp: e.cleared,
      systemStateBefore: SystemSafetyState.UNKNOWN,
      systemStateAfter: SystemSafetyState.UNKNOWN,
      actionsTaken: []
    }));
    
    setStatus(prev => ({
      ...prev,
      recentEvents: events
    }));
  }, []);
  
  const handleTestResults = useCallback((data: any) => {
    console.log('Emergency stop test results:', data);
  }, []);
  
  const handleDiagnostics = useCallback((data: any) => {
    console.log('Emergency stop diagnostics:', data);
  }, []);
  
  const handleCommandResult = useCallback((data: any) => {
    console.log('Command result:', data);
  }, []);
  
  const handleError = useCallback((data: any) => {
    setError(data.error || 'Unknown error');
    console.error('Emergency stop error:', data);
  }, []);
  
  // Actions
  const activateEmergencyStop = useCallback(async (reason: string): Promise<boolean> => {
    if (!ws.isConnected) {
      setError('Not connected to emergency stop system');
      return false;
    }
    
    try {
      // Send activation command
      ws.send({
        type: 'activate_emergency',
        data: {
          reason,
          source: 'frontend'
        }
      });
      
      // Wait for response (would need promise handling)
      return true;
    } catch (err) {
      console.error('Failed to activate emergency stop:', err);
      setError('Failed to activate emergency stop');
      return false;
    }
  }, [ws]);
  
  const deactivateEmergencyStop = useCallback(async (
    safetyConfirmed: boolean,
    overrideSafety: boolean = false
  ): Promise<boolean> => {
    if (!ws.isConnected) {
      setError('Not connected to emergency stop system');
      return false;
    }
    
    if (!safetyConfirmed && !overrideSafety) {
      setError('Safety checks must be confirmed');
      return false;
    }
    
    try {
      ws.send({
        type: 'deactivate_emergency',
        data: {
          operator_id: 'current_user', // Would get from auth context
          override_safety: overrideSafety
        }
      });
      
      return true;
    } catch (err) {
      console.error('Failed to deactivate emergency stop:', err);
      setError('Failed to deactivate emergency stop');
      return false;
    }
  }, [ws]);
  
  const testSystem = useCallback(async () => {
    if (!ws.isConnected) {
      setError('Not connected to emergency stop system');
      return null;
    }
    
    try {
      ws.send({
        type: 'test_system',
        data: {}
      });
      
      // Would need promise handling for response
      return {};
    } catch (err) {
      console.error('Failed to test system:', err);
      setError('Failed to test system');
      return null;
    }
  }, [ws]);
  
  const refreshDevices = useCallback(async () => {
    // Trigger device discovery through REST API
    try {
      const response = await fetch('/api/emergency-stop/devices/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add auth headers
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to discover devices');
      }
      
      // WebSocket will send updates
    } catch (err) {
      console.error('Failed to refresh devices:', err);
      setError('Failed to refresh devices');
    }
  }, []);
  
  const getDiagnostics = useCallback(async () => {
    if (!ws.isConnected) {
      setError('Not connected to emergency stop system');
      return null;
    }
    
    try {
      ws.send({
        type: 'get_diagnostics',
        data: {}
      });
      
      // Would need promise handling for response
      return {};
    } catch (err) {
      console.error('Failed to get diagnostics:', err);
      setError('Failed to get diagnostics');
      return null;
    }
  }, [ws]);
  
  // Helper functions
  const getDevice = useCallback((deviceId: string): EmergencyDevice | undefined => {
    return status.devices[deviceId];
  }, [status.devices]);
  
  const getPrimaryDevice = useCallback((): EmergencyDevice | undefined => {
    return Object.values(status.devices).find(d => d.buttonType === ButtonType.PRIMARY);
  }, [status.devices]);
  
  const getHealthyDeviceCount = useCallback((): number => {
    return Object.values(status.devices).filter(d => d.isHealthy).length;
  }, [status.devices]);
  
  const exportEventLog = useCallback((): EmergencyEvent[] => {
    return status.recentEvents;
  }, [status.recentEvents]);
  
  return {
    // State
    status,
    isConnected: ws.isConnected,
    isLoading,
    error,
    
    // Actions
    activateEmergencyStop,
    deactivateEmergencyStop,
    testSystem,
    refreshDevices,
    
    // Device management
    getDevice,
    getPrimaryDevice,
    getHealthyDeviceCount,
    
    // Diagnostics
    getDiagnostics,
    exportEventLog
  };
};