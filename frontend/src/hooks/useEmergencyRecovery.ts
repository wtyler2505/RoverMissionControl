/**
 * Emergency Recovery Hook
 * 
 * React hook for managing emergency stop recovery state and operations.
 * Provides a clean interface for recovery session management with
 * real-time updates and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RecoverySession,
  RecoveryStep,
  RecoveryResult,
  RecoveryConfiguration,
  EmergencyStopCause,
  SystemComponent,
  ComponentStatus,
  AuditLogEntry,
  RecoveryContext,
  RecoverySessionStatus,
} from '../types/recovery';
import EmergencyStopRecoveryManager from '../services/recoveryManager';

interface UseEmergencyRecoveryOptions {
  configuration?: Partial<RecoveryConfiguration>;
  autoRefreshInterval?: number;
  enableRealTimeUpdates?: boolean;
}

interface UseEmergencyRecoveryReturn {
  // State
  context: RecoveryContext;
  session: RecoverySession | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startRecovery: (
    operatorId: string,
    operatorName: string,
    cause: EmergencyStopCause,
    templateId?: string
  ) => Promise<void>;
  executeStep: (stepId: string) => Promise<void>;
  skipStep: (stepId: string, reason: string) => Promise<void>;
  requestRollback: (stepId: string, reason: string) => Promise<void>;
  abortSession: (reason: string) => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  
  // Utilities
  canStartRecovery: boolean;
  canExecuteStep: (stepId: string) => boolean;
  canSkipStep: (stepId: string) => boolean;
  canRollback: (stepId: string) => boolean;
  getStepProgress: () => number;
  getEstimatedTimeRemaining: () => number;
}

const DEFAULT_CONFIGURATION: RecoveryConfiguration = {
  maxRecoveryTimeMs: 3600000, // 1 hour
  requireTwoPersonConfirmation: false,
  allowSkipNonCriticalSteps: true,
  automaticRollbackOnFailure: true,
  requireHardwareVerification: true,
  requireSoftwareVerification: true,
  enableAuditLogging: true,
  suspendOnCommunicationLoss: true,
  maxRetryAttempts: 3,
  stepTimeoutMs: 300000, // 5 minutes
  verificationTimeoutMs: 60000, // 1 minute
  rolesToAllowRecovery: ['operator', 'supervisor', 'admin'],
  criticalComponents: [
    SystemComponent.MOTORS,
    SystemComponent.SENSORS,
    SystemComponent.SAFETY_SYSTEMS,
    SystemComponent.EMERGENCY_HARDWARE,
  ],
  emergencyContacts: [],
};

export const useEmergencyRecovery = (
  options: UseEmergencyRecoveryOptions = {}
): UseEmergencyRecoveryReturn => {
  const {
    configuration: userConfig = {},
    autoRefreshInterval = 5000,
    enableRealTimeUpdates = true,
  } = options;

  // Merge configuration
  const config: RecoveryConfiguration = {
    ...DEFAULT_CONFIGURATION,
    ...userConfig,
  };

  // State
  const [session, setSession] = useState<RecoverySession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<Record<SystemComponent, ComponentStatus>>({} as Record<SystemComponent, ComponentStatus>);
  const [emergencyStopStatus, setEmergencyStopStatus] = useState({
    isActive: false,
    cause: EmergencyStopCause.UNKNOWN,
    triggerTime: new Date(),
    canClear: false,
  });

  // Refs
  const recoveryManagerRef = useRef<EmergencyStopRecoveryManager | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize recovery manager
  useEffect(() => {
    recoveryManagerRef.current = new EmergencyStopRecoveryManager(config);
    
    // Set up event handlers
    recoveryManagerRef.current.onSessionStarted((newSession) => {
      setSession(newSession);
    });

    recoveryManagerRef.current.onSessionCompleted((completedSession) => {
      setSession(completedSession);
      setEmergencyStopStatus(prev => ({ ...prev, isActive: false, canClear: true }));
    });

    recoveryManagerRef.current.onSessionAborted((abortedSession, reason) => {
      setSession(abortedSession);
      setError(`Session aborted: ${reason}`);
    });

    recoveryManagerRef.current.onAuditEvent((entry) => {
      console.log('Audit Event:', entry);
      // Could emit to external audit system
    });

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [config]);

  // Set up auto-refresh
  useEffect(() => {
    if (enableRealTimeUpdates && session?.status === RecoverySessionStatus.IN_PROGRESS) {
      refreshIntervalRef.current = setInterval(() => {
        refreshSystemStatus();
      }, autoRefreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [session, enableRealTimeUpdates, autoRefreshInterval]);

  // Initialize system status
  useEffect(() => {
    const initialStatus: Record<SystemComponent, ComponentStatus> = {} as Record<SystemComponent, ComponentStatus>;
    Object.values(SystemComponent).forEach(component => {
      initialStatus[component] = ComponentStatus.UNKNOWN;
    });
    setSystemStatus(initialStatus);

    // Simulate emergency stop detection
    setEmergencyStopStatus({
      isActive: true,
      cause: EmergencyStopCause.MANUAL_ACTIVATION,
      triggerTime: new Date(),
      canClear: false,
    });
  }, []);

  // Create recovery context
  const context: RecoveryContext = {
    session,
    currentStep: session?.steps.find(step => step.status === 'in_progress') || null,
    configuration: config,
    isActive: session?.status === RecoverySessionStatus.IN_PROGRESS,
    canStart: !session && emergencyStopStatus.isActive,
    canPause: session?.status === RecoverySessionStatus.IN_PROGRESS,
    canResume: session?.status === RecoverySessionStatus.SUSPENDED,
    canAbort: session?.status === RecoverySessionStatus.IN_PROGRESS,
    canRollback: session?.requiresRollback === false,
    systemStatus,
    emergencyStopStatus,
  };

  // Actions
  const startRecovery = useCallback(async (
    operatorId: string,
    operatorName: string,
    cause: EmergencyStopCause,
    templateId?: string
  ) => {
    if (!recoveryManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const newSession = await recoveryManagerRef.current.startRecoverySession(
        operatorId,
        operatorName,
        cause,
        templateId
      );
      setSession(newSession);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recovery';
      setError(errorMessage);
      console.error('Recovery start error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const executeStep = useCallback(async (stepId: string) => {
    if (!recoveryManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await recoveryManagerRef.current.executeStep(stepId);
      
      // Update session state
      const updatedSession = recoveryManagerRef.current.getActiveSession();
      setSession(updatedSession);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Step execution failed';
      setError(errorMessage);
      console.error('Step execution error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const skipStep = useCallback(async (stepId: string, reason: string) => {
    if (!recoveryManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await recoveryManagerRef.current.skipStep(stepId, reason);
      
      // Update session state
      const updatedSession = recoveryManagerRef.current.getActiveSession();
      setSession(updatedSession);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Step skip failed';
      setError(errorMessage);
      console.error('Step skip error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestRollback = useCallback(async (stepId: string, reason: string) => {
    if (!recoveryManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await recoveryManagerRef.current.requestRollback(stepId, reason);
      
      // Update session state
      const updatedSession = recoveryManagerRef.current.getActiveSession();
      setSession(updatedSession);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Rollback request failed';
      setError(errorMessage);
      console.error('Rollback error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const abortSession = useCallback(async (reason: string) => {
    if (!recoveryManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await recoveryManagerRef.current.abortSession(reason);
      
      // Update session state
      const updatedSession = recoveryManagerRef.current.getActiveSession();
      setSession(updatedSession);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Session abort failed';
      setError(errorMessage);
      console.error('Session abort error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSystemStatus = useCallback(async () => {
    if (!recoveryManagerRef.current) return;

    try {
      // Update system component status
      const newStatus: Record<SystemComponent, ComponentStatus> = {} as Record<SystemComponent, ComponentStatus>;
      
      for (const component of Object.values(SystemComponent)) {
        // In a real implementation, this would query actual system status
        newStatus[component] = recoveryManagerRef.current.getSystemComponentStatus(component);
      }
      
      setSystemStatus(newStatus);

      // Update emergency stop status
      setEmergencyStopStatus(prev => ({
        ...prev,
        isActive: recoveryManagerRef.current!.isEmergencyStopActive(),
      }));

    } catch (err) {
      console.error('System status refresh error:', err);
    }
  }, []);

  // Utility functions
  const canStartRecovery = !session && emergencyStopStatus.isActive;

  const canExecuteStep = useCallback((stepId: string): boolean => {
    if (!session) return false;
    const step = session.steps.find(s => s.id === stepId);
    return step?.status === 'pending' && !isLoading;
  }, [session, isLoading]);

  const canSkipStep = useCallback((stepId: string): boolean => {
    if (!session) return false;
    const step = session.steps.find(s => s.id === stepId);
    return step?.canSkip === true && step?.status === 'pending' && !isLoading;
  }, [session, isLoading]);

  const canRollback = useCallback((stepId: string): boolean => {
    if (!session) return false;
    const step = session.steps.find(s => s.id === stepId);
    return step?.canRollback === true && step?.status !== 'pending' && !isLoading;
  }, [session, isLoading]);

  const getStepProgress = useCallback((): number => {
    if (!session) return 0;
    return (session.completedSteps / session.totalSteps) * 100;
  }, [session]);

  const getEstimatedTimeRemaining = useCallback((): number => {
    if (!session) return 0;
    
    const remainingSteps = session.steps.filter(step => 
      step.status === 'pending' || step.status === 'in_progress'
    );
    
    return remainingSteps.reduce((total, step) => {
      return total + step.estimatedDurationMs;
    }, 0);
  }, [session]);

  return {
    // State
    context,
    session,
    isLoading,
    error,
    
    // Actions
    startRecovery,
    executeStep,
    skipStep,
    requestRollback,
    abortSession,
    refreshSystemStatus,
    
    // Utilities
    canStartRecovery,
    canExecuteStep,
    canSkipStep,
    canRollback,
    getStepProgress,
    getEstimatedTimeRemaining,
  };
};

export default useEmergencyRecovery;