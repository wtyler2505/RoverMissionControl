/**
 * Enhanced Alert Store using Zustand
 * Manages alert state, queue, persistence, and cross-tab synchronization
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AlertQueueManager, AlertQueueConfig, ProcessedAlert } from '../utils/alertQueue/AlertQueueManager';
import { AlertPriority } from '../theme/alertPriorities';
import { 
  AlertWebSocketMessage, 
  AlertMessageData, 
  AlertSyncResponse 
} from '../services/websocket/types';
import { 
  AlertPersistenceService, 
  PersistedAlert, 
  alertPersistenceService 
} from '../services/persistence/AlertPersistenceService';
import { 
  AlertSyncService, 
  SyncMessage, 
  SyncStatus 
} from '../services/synchronization/AlertSyncService';

export interface AlertData {
  title?: string;
  message: string;
  priority: AlertPriority;
  closable?: boolean;
  persistent?: boolean;
  action?: {
    label: string;
    handler: () => void | Promise<void>;
  };
  metadata?: Record<string, any>;
  groupId?: string;
  source?: string;
}

export interface AlertState {
  // State
  alerts: ProcessedAlert[];
  persistedAlerts: PersistedAlert[];
  dismissedAlerts: string[];
  queueStatus: {
    total: number;
    byPriority: Record<AlertPriority, number>;
    processed: number;
    grouped: number;
  };
  
  // Persistence and sync state
  persistenceInitialized: boolean;
  syncStatus: SyncStatus;
  acknowledgeModalAlert: PersistedAlert | null;
  historyPanelOpen: boolean;
  
  // WebSocket synchronization state
  lastSyncTimestamp: number;
  syncInProgress: boolean;
  wsClient: any | null;
  
  // Configuration
  config: Partial<AlertQueueConfig>;
  
  // Enhanced Actions
  addAlert: (alert: AlertData) => Promise<string>;
  removeAlert: (id: string) => void;
  clearAlerts: (priority?: AlertPriority) => void;
  dismissAlert: (id: string) => void;
  updateConfig: (config: Partial<AlertQueueConfig>) => void;
  
  // Persistence Actions
  acknowledgeAlert: (alertId: string, acknowledgedBy: string, reason?: string) => Promise<void>;
  loadPersistedAlerts: (filter?: any) => Promise<void>;
  openAcknowledgeModal: (alert: PersistedAlert) => void;
  closeAcknowledgeModal: () => void;
  openHistoryPanel: () => void;
  closeHistoryPanel: () => void;
  
  // WebSocket integration
  connectWebSocket: (wsClient: any) => void;
  disconnectWebSocket: () => void;
  syncWithServer: () => Promise<void>;
  
  // Cross-tab sync actions
  initializePersistence: () => Promise<void>;
  retryCrossTabSync: () => void;
  
  // Queue management
  pauseProcessing: () => void;
  resumeProcessing: () => void;
  
  // Internal
  _queueManager: AlertQueueManager | null;
  _persistenceService: AlertPersistenceService;
  _syncService: AlertSyncService | null;
  _initializeQueue: () => void;
  _updateAlerts: () => void;
  _handleWebSocketAlert: (alert: AlertWebSocketMessage) => void;
  _handleSyncComplete: (syncResponse: AlertSyncResponse) => void;
  _handleCrossTabSync: (message: SyncMessage) => void;
  _handleSyncStatusChange: (status: SyncStatus) => void;
  _checkAcknowledgmentRequirements: (alert: PersistedAlert) => boolean;
}

const defaultConfig: Partial<AlertQueueConfig> = {
  maxAlertsPerPriority: {
    critical: 10,
    high: 20,
    medium: 30,
    low: 40,
    info: 50,
  },
  maxTotalAlerts: 100,
  overflowStrategy: 'drop-oldest',
};

export const useAlertStore = create<AlertState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        alerts: [],
        persistedAlerts: [],
        dismissedAlerts: [],
        queueStatus: {
          total: 0,
          byPriority: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            info: 0,
          },
          processed: 0,
          grouped: 0,
        },
        
        // Persistence and sync state
        persistenceInitialized: false,
        syncStatus: {
          isLeader: false,
          connectedTabs: 0,
          lastSync: null,
          syncInProgress: false,
          conflictCount: 0,
          leaderDeviceId: null,
        },
        acknowledgeModalAlert: null,
        historyPanelOpen: false,
        
        lastSyncTimestamp: 0,
        syncInProgress: false,
        wsClient: null,
        config: defaultConfig,
        _queueManager: null,
        _persistenceService: alertPersistenceService,
        _syncService: null,

        // Initialize queue manager
        _initializeQueue: () => {
          const state = get();
          if (state._queueManager) return;

          const queueManager = new AlertQueueManager(state.config);
          
          // Add processor to update store
          queueManager.addProcessor(async () => {
            state._updateAlerts();
          });

          set({ _queueManager: queueManager });
        },

        // Update alerts from queue
        _updateAlerts: () => {
          const state = get();
          if (!state._queueManager) return;

          const alerts = state._queueManager.getAllAlerts();
          const queueStatus = state._queueManager.getStatus();
          
          // Filter out dismissed alerts
          const visibleAlerts = alerts.filter(
            alert => !state.dismissedAlerts.includes(alert.id)
          );

          set({ alerts: visibleAlerts, queueStatus });
        },

        // Add alert with persistence
        addAlert: async (alertData: AlertData) => {
          const state = get();
          
          // Initialize queue if needed
          if (!state._queueManager) {
            state._initializeQueue();
          }

          const id = await state._queueManager!.addAlert({
            priority: alertData.priority,
            data: alertData,
            groupId: alertData.groupId,
          });

          // Create persisted alert
          const persistedAlert: Omit<PersistedAlert, 'deviceId' | 'sessionId' | 'timestamp' | 'lastModified' | 'version'> = {
            id,
            title: alertData.title,
            message: alertData.message,
            priority: alertData.priority,
            timestamp: new Date(),
            closable: alertData.closable ?? true,
            persistent: alertData.persistent ?? false,
            acknowledged: false,
            source: alertData.source || 'local',
            groupId: alertData.groupId,
            metadata: alertData.metadata,
            syncStatus: 'pending',
          };

          // Store in persistence layer
          try {
            await state._persistenceService.storeAlert(persistedAlert);
            
            // Broadcast to other tabs
            if (state._syncService) {
              await state._syncService.broadcastAlertAdded({
                ...persistedAlert,
                deviceId: state._persistenceService.currentDeviceId,
                sessionId: state._persistenceService.currentSessionId,
                timestamp: persistedAlert.timestamp,
                lastModified: new Date(),
                version: 1,
              } as PersistedAlert);
            }
            
            // Check if acknowledgment is required
            if (state._checkAcknowledgmentRequirements({
              ...persistedAlert,
              deviceId: state._persistenceService.currentDeviceId,
              sessionId: state._persistenceService.currentSessionId,
              lastModified: new Date(),
              version: 1,
            } as PersistedAlert)) {
              state.openAcknowledgeModal({
                ...persistedAlert,
                deviceId: state._persistenceService.currentDeviceId,
                sessionId: state._persistenceService.currentSessionId,
                lastModified: new Date(),
                version: 1,
              } as PersistedAlert);
            }
          } catch (error) {
            console.error('Failed to persist alert:', error);
          }

          // Immediately update alerts
          state._updateAlerts();

          // Send to WebSocket if connected
          if (alertData.source !== 'websocket' && state.wsClient) {
            // TODO: Integrate with WebSocket service
          }

          return id;
        },

        // Remove alert
        removeAlert: (id: string) => {
          const state = get();
          if (!state._queueManager) return;

          state._queueManager.removeAlert(id);
          state._updateAlerts();
        },

        // Clear alerts
        clearAlerts: (priority?: AlertPriority) => {
          const state = get();
          if (!state._queueManager) return;

          if (priority) {
            // Clear specific priority
            const alerts = state.alerts.filter(a => a.priority === priority);
            alerts.forEach(alert => state._queueManager!.removeAlert(alert.id));
          } else {
            // Clear all
            state._queueManager.clear();
          }

          state._updateAlerts();
        },

        // Dismiss alert (hide but don't remove from queue)
        dismissAlert: async (id: string) => {
          const state = get();
          
          // Update in persistence layer
          try {
            await state._persistenceService.dismissAlert(id);
            
            // Broadcast to other tabs
            if (state._syncService) {
              await state._syncService.broadcastAlertDismissed(id);
            }
          } catch (error) {
            console.error('Failed to dismiss alert in persistence:', error);
          }
          
          set(state => ({
            dismissedAlerts: [...state.dismissedAlerts, id],
            alerts: state.alerts.filter(a => a.id !== id),
          }));
        },

        // Update configuration
        updateConfig: (newConfig: Partial<AlertQueueConfig>) => {
          set(state => ({
            config: { ...state.config, ...newConfig },
          }));

          // Reinitialize queue with new config
          const state = get();
          if (state._queueManager) {
            const alerts = state._queueManager.getAllAlerts();
            state._queueManager = new AlertQueueManager(state.config);
            
            // Re-add existing alerts
            alerts.forEach(alert => {
              state._queueManager!.addAlert({
                priority: alert.priority,
                data: alert.data,
                groupId: alert.groupId,
              });
            });

            state._updateAlerts();
          }
        },

        // Pause processing
        pauseProcessing: () => {
          // TODO: Implement pause functionality in AlertQueueManager
          console.log('Pausing alert processing');
        },

        // Resume processing
        resumeProcessing: () => {
          // TODO: Implement resume functionality in AlertQueueManager
          console.log('Resuming alert processing');
        },

        // WebSocket integration methods
        connectWebSocket: (wsClient: any) => {
          set({ wsClient });
          
          // Set up WebSocket event handlers
          if (wsClient) {
            wsClient.on('onAlertReceived', get()._handleWebSocketAlert);
            wsClient.on('onAlertSyncComplete', get()._handleSyncComplete);
            
            // Initial sync on connection
            setTimeout(() => {
              get().syncWithServer().catch(console.error);
            }, 1000);
          }
        },

        disconnectWebSocket: () => {
          const state = get();
          if (state.wsClient) {
            state.wsClient.off('onAlertReceived', state._handleWebSocketAlert);
            state.wsClient.off('onAlertSyncComplete', state._handleSyncComplete);
          }
          set({ wsClient: null });
        },

        syncWithServer: async () => {
          const state = get();
          if (!state.wsClient || state.syncInProgress) return;

          set({ syncInProgress: true });
          
          try {
            const syncResponse = await state.wsClient.syncAlerts({
              lastSyncTimestamp: state.lastSyncTimestamp,
              includeAcknowledged: false
            });
            
            // Process response in _handleSyncComplete
          } catch (error) {
            console.error('Alert sync failed:', error);
          } finally {
            set({ syncInProgress: false });
          }
        },

        acknowledgeAlert: async (alertId: string, acknowledgedBy: string, reason?: string) => {
          const state = get();

          try {
            // Update in persistence layer
            await state._persistenceService.acknowledgeAlert(alertId, acknowledgedBy);
            
            // Broadcast to other tabs
            if (state._syncService) {
              await state._syncService.broadcastAlertAcknowledged(alertId, acknowledgedBy);
            }
            
            // Send to WebSocket if connected
            if (state.wsClient) {
              await state.wsClient.acknowledgeAlert(alertId, acknowledgedBy, true);
            }
            
            // Close acknowledgment modal if this alert was being acknowledged
            if (state.acknowledgeModalAlert?.id === alertId) {
              state.closeAcknowledgeModal();
            }
            
            // Update local state immediately for responsive UX
            await state.dismissAlert(alertId);
          } catch (error) {
            console.error('Failed to acknowledge alert:', error);
            throw error;
          }
        },

        // WebSocket event handlers
        _handleWebSocketAlert: (alert: AlertWebSocketMessage) => {
          const state = get();
          
          // Convert WebSocket alert to local alert format
          const alertData: AlertData = {
            title: alert.data.title,
            message: alert.data.message,
            priority: alert.priority as AlertPriority,
            closable: alert.data.closable,
            persistent: alert.data.persistent,
            action: alert.data.action ? {
              label: alert.data.action.label,
              handler: async () => {
                // Handle server-defined actions
                console.log('Executing alert action:', alert.data.action);
              }
            } : undefined,
            metadata: alert.data.metadata,
            groupId: alert.data.groupId,
            source: 'websocket'
          };

          if (alert.type === 'new') {
            // Add new alert
            state.addAlert(alertData);
          } else if (alert.type === 'remove') {
            // Remove alert
            state.removeAlert(alert.id);
          } else if (alert.type === 'clear') {
            // Clear alerts by criteria
            if (alert.priority) {
              state.clearAlerts(alert.priority as AlertPriority);
            } else {
              state.clearAlerts();
            }
          }
        },

        _handleSyncComplete: (syncResponse: AlertSyncResponse) => {
          const state = get();
          
          // Update sync timestamp
          set({ lastSyncTimestamp: syncResponse.syncTimestamp });
          
          // Process received alerts
          syncResponse.alerts.forEach(alert => {
            state._handleWebSocketAlert(alert);
          });
          
          console.log(`Synced ${syncResponse.alerts.length} alerts from server`);
        },

        // Enhanced persistence methods
        initializePersistence: async () => {
          const state = get();
          
          try {
            // Initialize persistence service
            await state._persistenceService.initialize();
            
            // Initialize sync service
            const syncService = new AlertSyncService(state._persistenceService);
            await syncService.initialize();
            
            // Set up sync callbacks
            syncService.addSyncCallback(state._handleCrossTabSync);
            syncService.addStatusCallback(state._handleSyncStatusChange);
            
            set({ 
              _syncService: syncService,
              persistenceInitialized: true 
            });
            
            // Load persisted alerts
            await state.loadPersistedAlerts();
            
            console.log('Alert persistence initialized successfully');
          } catch (error) {
            console.error('Failed to initialize alert persistence:', error);
          }
        },

        loadPersistedAlerts: async (filter?: any) => {
          const state = get();
          
          try {
            const alerts = await state._persistenceService.getAlerts(filter);
            set({ persistedAlerts: alerts });
          } catch (error) {
            console.error('Failed to load persisted alerts:', error);
          }
        },

        openAcknowledgeModal: (alert: PersistedAlert) => {
          set({ acknowledgeModalAlert: alert });
        },

        closeAcknowledgeModal: () => {
          set({ acknowledgeModalAlert: null });
        },

        openHistoryPanel: () => {
          set({ historyPanelOpen: true });
        },

        closeHistoryPanel: () => {
          set({ historyPanelOpen: false });
        },

        retryCrossTabSync: () => {
          const state = get();
          if (state._syncService) {
            state._syncService.forceLeaderElection();
          }
        },

        _handleCrossTabSync: (message: SyncMessage) => {
          const state = get();
          
          // Handle cross-tab sync messages
          switch (message.type) {
            case 'alert-added':
            case 'alert-updated':
            case 'alert-removed':
            case 'alert-acknowledged':
            case 'alert-dismissed':
              // Reload persisted alerts to reflect changes
              state.loadPersistedAlerts();
              break;
          }
        },

        _handleSyncStatusChange: (status: SyncStatus) => {
          set({ syncStatus: status });
        },

        _checkAcknowledgmentRequirements: (alert: PersistedAlert): boolean => {
          // Critical and high priority alerts require acknowledgment
          return ['critical', 'high'].includes(alert.priority) && !alert.acknowledged;
        },
      }),
      {
        name: 'alert-storage',
        partialize: (state) => ({
          dismissedAlerts: state.dismissedAlerts,
          config: state.config,
          lastSyncTimestamp: state.lastSyncTimestamp,
          historyPanelOpen: state.historyPanelOpen,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Initialize queue after rehydration
            state._initializeQueue();
            // Initialize persistence after rehydration
            state.initializePersistence();
          }
        },
      }
    ),
    {
      name: 'AlertStore',
    }
  )
);

// Helper hook for adding alerts
export const useAddAlert = () => {
  const addAlert = useAlertStore(state => state.addAlert);
  return addAlert;
};

// Helper hook for getting alerts by priority
export const useAlertsByPriority = (priority: AlertPriority) => {
  return useAlertStore(state => 
    state.alerts.filter(alert => alert.priority === priority)
  );
};

// Helper hook for getting queue status
export const useAlertQueueStatus = () => {
  return useAlertStore(state => state.queueStatus);
};

// Pre-defined alert creators
export const alertCreators = {
  critical: (message: string, title?: string) => ({
    priority: 'critical' as AlertPriority,
    message,
    title,
    closable: false,
    persistent: true,
  }),
  
  error: (message: string, title = 'Error') => ({
    priority: 'high' as AlertPriority,
    message,
    title,
    closable: true,
  }),
  
  warning: (message: string, title = 'Warning') => ({
    priority: 'medium' as AlertPriority,
    message,
    title,
    closable: true,
  }),
  
  success: (message: string, title?: string) => ({
    priority: 'low' as AlertPriority,
    message,
    title,
    closable: true,
  }),
  
  info: (message: string, title?: string) => ({
    priority: 'info' as AlertPriority,
    message,
    title,
    closable: true,
  }),
};