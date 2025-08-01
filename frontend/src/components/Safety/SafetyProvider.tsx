/**
 * Safety Provider Context
 * 
 * Manages the global safety state for the rover mission control system.
 * Provides emergency stop functionality and safety event management.
 * 
 * @module SafetyProvider
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import {
  SafetySystemStatus,
  SafetyConfiguration,
  SafetyEvent,
  SafetyEventHandler,
  SafetyContextValue,
  EmergencyStopState,
} from './types';

const defaultConfig: SafetyConfiguration = {
  enableAudioAlerts: true,
  enableVibration: true,
  requireDoubleConfirmation: true,
  autoRecoveryTimeout: 0,
  safetyCheckInterval: 5000,
  maxRetryAttempts: 3,
};

const defaultStatus: SafetySystemStatus = {
  overallState: 'safe',
  emergencyStop: {
    isActive: false,
  },
  activeWarnings: [],
  recentEvents: [],
  systemChecks: {
    communications: true,
    power: true,
    motors: true,
    sensors: true,
    navigation: true,
  },
};

const SafetyContext = createContext<SafetyContextValue | undefined>(undefined);

interface SafetyProviderProps {
  children: ReactNode;
  initialConfig?: Partial<SafetyConfiguration>;
  onEmergencyStop?: (state: EmergencyStopState) => void;
  onSafetyEvent?: (event: SafetyEvent) => void;
}

export const SafetyProvider: React.FC<SafetyProviderProps> = ({
  children,
  initialConfig = {},
  onEmergencyStop,
  onSafetyEvent,
}) => {
  const [status, setStatus] = useState<SafetySystemStatus>(defaultStatus);
  const [config, setConfig] = useState<SafetyConfiguration>({
    ...defaultConfig,
    ...initialConfig,
  });
  
  const subscribersRef = useRef<Set<SafetyEventHandler>>(new Set());
  const eventIdCounter = useRef(0);
  const safetyCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Generate unique event ID
  const generateEventId = useCallback(() => {
    eventIdCounter.current += 1;
    return `safety_event_${Date.now()}_${eventIdCounter.current}`;
  }, []);
  
  // Notify all subscribers of a safety event
  const notifySubscribers = useCallback((event: SafetyEvent) => {
    subscribersRef.current.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in safety event handler:', error);
      }
    });
    
    // Call external handler if provided
    if (onSafetyEvent) {
      onSafetyEvent(event);
    }
  }, [onSafetyEvent]);
  
  // Create and dispatch a safety event
  const createSafetyEvent = useCallback(
    (eventData: Omit<SafetyEvent, 'id' | 'timestamp'>): SafetyEvent => {
      const event: SafetyEvent = {
        ...eventData,
        id: generateEventId(),
        timestamp: new Date(),
      };
      
      // Update status with new event
      setStatus((prev) => ({
        ...prev,
        recentEvents: [event, ...prev.recentEvents.slice(0, 99)], // Keep last 100 events
        activeWarnings:
          event.type === 'safety_warning'
            ? [...prev.activeWarnings, event]
            : prev.activeWarnings,
      }));
      
      // Notify subscribers
      notifySubscribers(event);
      
      return event;
    },
    [generateEventId, notifySubscribers]
  );
  
  // Activate emergency stop
  const activateEmergencyStop = useCallback(
    async (reason?: string) => {
      const emergencyStopState: EmergencyStopState = {
        isActive: true,
        activatedAt: new Date(),
        activatedBy: 'current_user', // TODO: Get from auth context
        reason,
        affectedSystems: ['motors', 'navigation', 'communications'],
      };
      
      // Update status
      setStatus((prev) => ({
        ...prev,
        overallState: 'emergency',
        emergencyStop: emergencyStopState,
        systemChecks: {
          communications: false,
          power: true,
          motors: false,
          sensors: true,
          navigation: false,
        },
      }));
      
      // Create safety event
      createSafetyEvent({
        type: 'emergency_stop',
        severity: 'critical',
        message: `Emergency stop activated${reason ? `: ${reason}` : ''}`,
        data: emergencyStopState,
      });
      
      // Notify external handler
      if (onEmergencyStop) {
        onEmergencyStop(emergencyStopState);
      }
      
      // TODO: Send emergency stop command to backend
      try {
        const response = await fetch('/api/safety/emergency-stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'activate', reason }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to activate emergency stop on server');
        }
      } catch (error) {
        console.error('Emergency stop backend error:', error);
        // Continue with local state even if backend fails
      }
    },
    [createSafetyEvent, onEmergencyStop]
  );
  
  // Deactivate emergency stop
  const deactivateEmergencyStop = useCallback(async () => {
    // Update status
    setStatus((prev) => ({
      ...prev,
      overallState: 'safe',
      emergencyStop: {
        isActive: false,
      },
      systemChecks: {
        communications: true,
        power: true,
        motors: true,
        sensors: true,
        navigation: true,
      },
    }));
    
    // Create safety event
    createSafetyEvent({
      type: 'recovery',
      severity: 'high',
      message: 'Emergency stop cleared - System recovering',
      data: { clearedBy: 'current_user' },
    });
    
    // TODO: Send clear command to backend
    try {
      const response = await fetch('/api/safety/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to deactivate emergency stop on server');
      }
    } catch (error) {
      console.error('Emergency stop deactivation error:', error);
    }
  }, [createSafetyEvent]);
  
  // Report a safety event
  const reportSafetyEvent = useCallback(
    (eventData: Omit<SafetyEvent, 'id' | 'timestamp'>) => {
      createSafetyEvent(eventData);
    },
    [createSafetyEvent]
  );
  
  // Clear a safety warning
  const clearWarning = useCallback((warningId: string) => {
    setStatus((prev) => ({
      ...prev,
      activeWarnings: prev.activeWarnings.filter((w) => w.id !== warningId),
    }));
  }, []);
  
  // Subscribe to safety events
  const subscribe = useCallback((handler: SafetyEventHandler) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);
  
  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<SafetyConfiguration>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);
  
  // Perform periodic safety checks
  useEffect(() => {
    if (config.safetyCheckInterval > 0) {
      const performSafetyCheck = async () => {
        try {
          // TODO: Implement actual safety checks with backend
          const response = await fetch('/api/safety/status');
          if (response.ok) {
            const data = await response.json();
            // Update system checks based on response
            setStatus((prev) => ({
              ...prev,
              systemChecks: data.systemChecks || prev.systemChecks,
            }));
          }
        } catch (error) {
          console.error('Safety check failed:', error);
        }
      };
      
      // Initial check
      performSafetyCheck();
      
      // Set up interval
      safetyCheckIntervalRef.current = setInterval(
        performSafetyCheck,
        config.safetyCheckInterval
      );
      
      return () => {
        if (safetyCheckIntervalRef.current) {
          clearInterval(safetyCheckIntervalRef.current);
        }
      };
    }
  }, [config.safetyCheckInterval]);
  
  // Auto-recovery logic
  useEffect(() => {
    if (
      config.autoRecoveryTimeout > 0 &&
      status.emergencyStop.isActive &&
      status.emergencyStop.activatedAt
    ) {
      const timeout = setTimeout(() => {
        // Check if it's safe to auto-recover
        const allSystemsOk = Object.values(status.systemChecks).every((check) => check);
        if (allSystemsOk) {
          createSafetyEvent({
            type: 'recovery',
            severity: 'medium',
            message: 'Auto-recovery initiated after timeout',
          });
          deactivateEmergencyStop();
        }
      }, config.autoRecoveryTimeout * 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [
    config.autoRecoveryTimeout,
    status.emergencyStop,
    status.systemChecks,
    createSafetyEvent,
    deactivateEmergencyStop,
  ]);
  
  const contextValue: SafetyContextValue = {
    status,
    config,
    activateEmergencyStop,
    deactivateEmergencyStop,
    reportSafetyEvent,
    clearWarning,
    subscribe,
    updateConfig,
  };
  
  return (
    <SafetyContext.Provider value={contextValue}>
      {children}
    </SafetyContext.Provider>
  );
};

// Custom hook to use safety context
export const useSafety = (): SafetyContextValue => {
  const context = useContext(SafetyContext);
  if (!context) {
    throw new Error('useSafety must be used within a SafetyProvider');
  }
  return context;
};

export default SafetyProvider;