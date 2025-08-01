/**
 * Command Cancellation Hook
 * 
 * Provides easy-to-use cancellation functionality with:
 * - Automatic event subscription
 * - State management
 * - Error handling
 * - Confirmation dialogs
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CancellationReason,
  CancellationState,
  CancellationStatus,
  CancellationEvent,
  CancellationResponse,
  getCancellationService
} from '../services/cancellationService';

interface UseCommandCancellationOptions {
  autoCheckStatus?: boolean;
  subscribeToEvents?: boolean;
  onStateChange?: (state: CancellationState) => void;
  onCompleted?: (success: boolean) => void;
  onError?: (error: string) => void;
}

interface UseCommandCancellationResult {
  // State
  cancellationStatus: CancellationStatus | null;
  isActive: boolean;
  isInProgress: boolean;
  error: string | null;
  
  // Actions
  cancelCommand: (
    commandId: string,
    options?: {
      reason?: CancellationReason;
      rollback?: boolean;
      force?: boolean;
      notes?: string;
    }
  ) => Promise<boolean>;
  
  cancelMultiple: (
    commandIds: string[],
    reason?: CancellationReason,
    rollback?: boolean
  ) => Promise<{ succeeded: string[]; failed: string[] }>;
  
  checkStatus: (commandId: string) => Promise<void>;
  clearError: () => void;
  
  // Helpers
  canCancel: (commandStatus: string) => boolean;
  getCancellationProgress: () => number;
}

export function useCommandCancellation(
  commandId?: string,
  options: UseCommandCancellationOptions = {}
): UseCommandCancellationResult {
  const {
    autoCheckStatus = true,
    subscribeToEvents = true,
    onStateChange,
    onCompleted,
    onError
  } = options;

  const [cancellationStatus, setCancellationStatus] = useState<CancellationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  
  const cancellationService = getCancellationService();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Check if cancellation is in progress
  const isInProgress = cancellationStatus ? [
    CancellationState.REQUESTED,
    CancellationState.VALIDATING,
    CancellationState.CANCELLING,
    CancellationState.CLEANING_UP,
    CancellationState.ROLLING_BACK
  ].includes(cancellationStatus.state) : false;

  // Subscribe to cancellation events
  useEffect(() => {
    if (!commandId || !subscribeToEvents) return;

    const handleEvent = (event: CancellationEvent) => {
      const newStatus: CancellationStatus = {
        commandId: event.commandId,
        state: event.cancellationState,
        reason: event.reason,
        requesterId: event.requester,
        timestamp: new Date(),
        validationErrors: event.validationErrors || [],
        cleanupActions: event.cleanupActions || [],
        rollbackActions: event.rollbackActions || []
      };
      
      setCancellationStatus(newStatus);
      setIsActive(true);
      
      // Notify state change
      onStateChange?.(event.cancellationState);
      
      // Check for completion
      if (event.cancellationState === CancellationState.COMPLETED) {
        onCompleted?.(true);
      } else if (event.cancellationState === CancellationState.FAILED ||
                 event.cancellationState === CancellationState.REJECTED) {
        onCompleted?.(false);
      }
    };

    unsubscribeRef.current = cancellationService.subscribeToCancellationEvents(
      commandId,
      handleEvent
    );

    return () => {
      unsubscribeRef.current?.();
    };
  }, [commandId, subscribeToEvents, onStateChange, onCompleted]);

  // Auto-check status on mount
  useEffect(() => {
    if (commandId && autoCheckStatus) {
      checkStatus(commandId);
    }
  }, [commandId, autoCheckStatus]);

  const checkStatus = useCallback(async (commandId: string) => {
    try {
      const status = await cancellationService.getCancellationStatus(commandId);
      if (status) {
        setCancellationStatus(status);
        setIsActive(true);
      } else {
        setCancellationStatus(null);
        setIsActive(false);
      }
    } catch (err: any) {
      console.error('Failed to check cancellation status:', err);
      // Not having a cancellation status is normal - don't treat as error
      setCancellationStatus(null);
      setIsActive(false);
    }
  }, []);

  const cancelCommand = useCallback(async (
    commandId: string,
    options: {
      reason?: CancellationReason;
      rollback?: boolean;
      force?: boolean;
      notes?: string;
    } = {}
  ): Promise<boolean> => {
    const {
      reason = CancellationReason.USER_REQUEST,
      rollback = true,
      force = false,
      notes
    } = options;

    setError(null);
    
    try {
      const response = await cancellationService.cancelCommand({
        commandId,
        reason,
        rollback,
        force,
        notes
      });

      if (!response.success) {
        const errorMsg = response.message || 'Cancellation failed';
        setError(errorMsg);
        onError?.(errorMsg);
        return false;
      }

      return true;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to cancel command';
      setError(errorMsg);
      onError?.(errorMsg);
      return false;
    }
  }, [onError]);

  const cancelMultiple = useCallback(async (
    commandIds: string[],
    reason: CancellationReason = CancellationReason.USER_REQUEST,
    rollback: boolean = true
  ): Promise<{ succeeded: string[]; failed: string[] }> => {
    setError(null);
    
    try {
      const responses = await cancellationService.cancelMultipleCommands(
        commandIds,
        reason,
        rollback
      );

      const succeeded: string[] = [];
      const failed: string[] = [];

      responses.forEach(response => {
        if (response.success) {
          succeeded.push(response.commandId);
        } else {
          failed.push(response.commandId);
        }
      });

      if (failed.length > 0) {
        const errorMsg = `Failed to cancel ${failed.length} command(s)`;
        setError(errorMsg);
        onError?.(errorMsg);
      }

      return { succeeded, failed };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to cancel commands';
      setError(errorMsg);
      onError?.(errorMsg);
      return { succeeded: [], failed: commandIds };
    }
  }, [onError]);

  const canCancel = useCallback((commandStatus: string): boolean => {
    // Can't cancel if already cancelling
    if (isActive && isInProgress) return false;
    if (cancellationStatus?.state === CancellationState.COMPLETED) return false;
    
    // Can cancel if in appropriate status
    return ['pending', 'queued', 'executing', 'retrying'].includes(commandStatus);
  }, [isActive, isInProgress, cancellationStatus]);

  const getCancellationProgress = useCallback((): number => {
    if (!cancellationStatus) return 0;
    
    const progressMap: Record<CancellationState, number> = {
      [CancellationState.REQUESTED]: 10,
      [CancellationState.VALIDATING]: 20,
      [CancellationState.CANCELLING]: 40,
      [CancellationState.CLEANING_UP]: 60,
      [CancellationState.ROLLING_BACK]: 80,
      [CancellationState.COMPLETED]: 100,
      [CancellationState.FAILED]: 100,
      [CancellationState.REJECTED]: 100
    };
    
    return progressMap[cancellationStatus.state] || 0;
  }, [cancellationStatus]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    cancellationStatus,
    isActive,
    isInProgress,
    error,
    
    // Actions
    cancelCommand,
    cancelMultiple,
    checkStatus,
    clearError,
    
    // Helpers
    canCancel,
    getCancellationProgress
  };
}