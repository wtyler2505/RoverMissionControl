/**
 * Hook for backend alert synchronization
 * Integrates alert store with backend API for cross-device sync
 */

import { useEffect, useRef, useState } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { alertApi, AlertSyncData, AlertConflict } from '../services/api/alertApi';
import { AlertPriority } from '../theme/alertPriorities';

interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: Date;
  pendingChanges: number;
  syncError?: Error;
  conflicts: AlertConflict[];
}

interface UseAlertSyncOptions {
  enabled?: boolean;
  syncInterval?: number; // milliseconds
  onSyncComplete?: (synced: number) => void;
  onSyncError?: (error: Error) => void;
  onConflict?: (conflicts: AlertConflict[]) => void;
}

export const useAlertSync = (options: UseAlertSyncOptions = {}) => {
  const {
    enabled = true,
    syncInterval = 30000, // 30 seconds
    onSyncComplete,
    onSyncError,
    onConflict,
  } = options;

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    pendingChanges: 0,
    conflicts: [],
  });

  const { alerts, addAlert, removeAlert } = useAlertStore();
  const syncTimeoutRef = useRef<NodeJS.Timeout>();
  const lastSyncRef = useRef<string>(new Date().toISOString());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Convert store alerts to sync format
  const convertToSyncData = (alert: any): AlertSyncData => ({
    id: alert.id,
    clientId: alert.id,
    priority: alert.priority,
    title: alert.data?.title,
    message: alert.data?.message || '',
    timestamp: alert.timestamp.toISOString(),
    acknowledgedAt: alert.data?.acknowledgedAt,
    acknowledgedBy: alert.data?.acknowledgedBy,
    dismissedAt: alert.data?.dismissedAt,
    metadata: alert.data?.metadata,
    deviceId: localStorage.getItem('rover-device-id') || 'unknown',
    version: alert.data?.version || 1,
  });

  // Perform sync
  const performSync = async () => {
    if (!enabled || syncStatus.isSyncing) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, syncError: undefined }));

    try {
      // Get alerts that need syncing
      const localAlerts = alerts
        .filter(alert => {
          // Only sync persisted alerts
          return alert.data?.persistent !== false;
        })
        .map(convertToSyncData);

      // Sync with backend
      const response = await alertApi.syncAlerts(
        lastSyncRef.current,
        localAlerts
      );

      // Process remote alerts
      let syncedCount = 0;
      for (const remoteAlert of response.alerts) {
        // Check if we already have this alert
        const existingAlert = alerts.find(a => a.id === remoteAlert.id);
        
        if (!existingAlert) {
          // Add new alert from remote
          await addAlert({
            title: remoteAlert.title,
            message: remoteAlert.message,
            priority: remoteAlert.priority,
            metadata: {
              ...remoteAlert.metadata,
              syncedFrom: 'backend',
              acknowledgedAt: remoteAlert.acknowledgedAt,
              acknowledgedBy: remoteAlert.acknowledgedBy,
            },
            source: 'backend',
          });
          syncedCount++;
        } else if (remoteAlert.version > (existingAlert.data?.version || 1)) {
          // Update existing alert with newer version
          // For now, we'll remove and re-add
          removeAlert(existingAlert.id);
          await addAlert({
            title: remoteAlert.title,
            message: remoteAlert.message,
            priority: remoteAlert.priority,
            metadata: {
              ...remoteAlert.metadata,
              version: remoteAlert.version,
              syncedFrom: 'backend',
            },
            source: 'backend',
          });
          syncedCount++;
        }
      }

      // Handle conflicts
      if (response.conflicts.length > 0) {
        setSyncStatus(prev => ({ ...prev, conflicts: response.conflicts }));
        onConflict?.(response.conflicts);
      }

      // Update sync status
      lastSyncRef.current = response.lastSyncTimestamp;
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingChanges: 0,
        conflicts: response.conflicts,
      }));

      onSyncComplete?.(syncedCount);
    } catch (error) {
      console.error('Alert sync failed:', error);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: error as Error,
      }));
      onSyncError?.(error as Error);
    }
  };

  // Manual sync trigger
  const syncNow = () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    performSync();
  };

  // Resolve a conflict
  const resolveConflict = async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'dismiss'
  ) => {
    const conflict = syncStatus.conflicts.find(c => c.alertId === conflictId);
    if (!conflict) return;

    switch (resolution) {
      case 'local':
        // Keep local version, update version number
        const localAlert = alerts.find(a => a.id === conflictId);
        if (localAlert) {
          // Increment version to ensure it syncs
          localAlert.data = {
            ...localAlert.data,
            version: Math.max(
              conflict.localVersion.version,
              conflict.remoteVersion.version
            ) + 1,
          };
        }
        break;

      case 'remote':
        // Accept remote version
        removeAlert(conflictId);
        await addAlert({
          title: conflict.remoteVersion.title,
          message: conflict.remoteVersion.message,
          priority: conflict.remoteVersion.priority,
          metadata: conflict.remoteVersion.metadata,
          source: 'backend',
        });
        break;

      case 'dismiss':
        // Dismiss both versions
        removeAlert(conflictId);
        await alertApi.dismissAlert(conflictId, true);
        break;
    }

    // Remove resolved conflict
    setSyncStatus(prev => ({
      ...prev,
      conflicts: prev.conflicts.filter(c => c.alertId !== conflictId),
    }));

    // Trigger sync to propagate resolution
    syncNow();
  };

  // Set up periodic sync
  useEffect(() => {
    if (!enabled) return;

    // Initial sync
    performSync();

    // Set up periodic sync
    const interval = setInterval(performSync, syncInterval);
    syncTimeoutRef.current = interval;

    // Subscribe to real-time updates
    unsubscribeRef.current = alertApi.subscribeToUpdates(
      async (remoteAlert) => {
        // Handle real-time alert
        await addAlert({
          title: remoteAlert.title,
          message: remoteAlert.message,
          priority: remoteAlert.priority,
          metadata: {
            ...remoteAlert.metadata,
            realtime: true,
          },
          source: 'backend',
        });
      },
      (error) => {
        console.error('Real-time sync error:', error);
      }
    );

    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [enabled, syncInterval]);

  // Track pending changes
  useEffect(() => {
    const pendingCount = alerts.filter(alert => {
      const syncTime = alert.data?.syncedAt
        ? new Date(alert.data.syncedAt)
        : new Date(0);
      return alert.timestamp > syncTime;
    }).length;

    setSyncStatus(prev => ({ ...prev, pendingChanges: pendingCount }));
  }, [alerts]);

  return {
    syncStatus,
    syncNow,
    resolveConflict,
    isOnline: !syncStatus.syncError,
  };
};

// Hook for syncing alert acknowledgments
export const useAlertAcknowledgment = () => {
  const { alerts, removeAlert } = useAlertStore();

  const acknowledgeAlert = async (alertId: string, metadata?: any) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    const acknowledgment = {
      alertId,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: 'current-user', // TODO: Get from auth context
      deviceId: localStorage.getItem('rover-device-id') || 'unknown',
      metadata,
    };

    try {
      // Send to backend
      await alertApi.acknowledgeAlert(acknowledgment);

      // Update local state
      alert.data = {
        ...alert.data,
        ...acknowledgment,
      };

      // Remove if not persistent
      if (!alert.data?.persistent) {
        removeAlert(alertId);
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  };

  return { acknowledgeAlert };
};