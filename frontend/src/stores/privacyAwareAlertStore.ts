/**
 * Privacy-Aware Alert Store
 * Extends the existing alert store with privacy consent validation
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { AlertData, AlertState } from './alertStore';
import { ConsentCategory, consentManager } from '../services/privacy/ConsentManager';
import { privacyAwareAlertService } from '../services/privacy/PrivacyAwareAlertService';
import { AlertPriority } from '../theme/alertPriorities';

export interface PrivacyAwareAlertState extends AlertState {
  // Privacy-specific state
  privacyConsents: Record<ConsentCategory, boolean>;
  privacyInitialized: boolean;
  privacyError: string | null;
  needsInitialConsent: boolean;
  
  // Privacy-aware actions
  initializePrivacy: () => Promise<void>;
  updatePrivacyConsent: (category: ConsentCategory, granted: boolean) => Promise<void>;
  addAlertWithPrivacy: (alert: AlertData) => Promise<string>;
  checkConsentBeforeAction: (action: string, category: ConsentCategory) => Promise<boolean>;
  exportPrivacyData: () => Promise<void>;
  deletePrivacyData: () => Promise<void>;
  
  // Enhanced alert actions with privacy checks
  addAlertSafe: (alert: AlertData) => Promise<string>;
  acknowledgeAlertSafe: (alertId: string, acknowledgedBy: string, reason?: string) => Promise<void>;
  
  // Privacy audit methods
  getPrivacyAuditLog: () => Promise<any[]>;
  logPrivacyAction: (action: string, details: any) => Promise<void>;
}

export const usePrivacyAwareAlertStore = create<PrivacyAwareAlertState>()(
  devtools(
    persist(
      (set, get) => ({
        // Inherit from existing alert store state
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
        
        // Existing persistence and sync state
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
        config: {
          maxAlertsPerPriority: {
            critical: 10,
            high: 20,
            medium: 30,
            low: 40,
            info: 50,
          },
          maxTotalAlerts: 100,
          overflowStrategy: 'drop-oldest',
        },
        _queueManager: null,
        _persistenceService: privacyAwareAlertService,
        _syncService: null,

        // Privacy-specific state
        privacyConsents: {} as Record<ConsentCategory, boolean>,
        privacyInitialized: false,
        privacyError: null,
        needsInitialConsent: false,

        // Initialize privacy system
        initializePrivacy: async () => {
          const state = get();
          if (state.privacyInitialized) return;

          try {
            await consentManager.initialize();
            await privacyAwareAlertService.initialize();

            const [consents, needsConsent] = await Promise.all([
              consentManager.getAllConsents(),
              consentManager.needsInitialConsent()
            ]);

            set({
              privacyConsents: consents,
              needsInitialConsent: needsConsent,
              privacyInitialized: true,
              privacyError: null
            });

            console.log('Privacy-aware alert store initialized');
          } catch (error) {
            console.error('Failed to initialize privacy for alert store:', error);
            set({
              privacyError: 'Failed to initialize privacy settings',
              privacyInitialized: false
            });
          }
        },

        // Update privacy consent
        updatePrivacyConsent: async (category: ConsentCategory, granted: boolean) => {
          try {
            await consentManager.updateConsent(category, granted);
            
            set(state => ({
              privacyConsents: {
                ...state.privacyConsents,
                [category]: granted
              },
              privacyError: null
            }));

            // Log the privacy action
            await get().logPrivacyAction('consent_updated', {
              category,
              granted,
              timestamp: new Date()
            });

            console.log(`Privacy consent updated: ${category} = ${granted}`);
          } catch (error) {
            console.error('Failed to update privacy consent:', error);
            set({ privacyError: 'Failed to update privacy consent' });
            throw error;
          }
        },

        // Check consent before performing an action
        checkConsentBeforeAction: async (action: string, category: ConsentCategory): Promise<boolean> => {
          const state = get();
          
          if (!state.privacyInitialized) {
            await state.initializePrivacy();
          }

          const hasConsent = await consentManager.hasConsent(category);
          
          if (!hasConsent) {
            console.log(`Action blocked by privacy consent: ${action} requires ${category}`);
            await get().logPrivacyAction('action_blocked', {
              action,
              category,
              reason: 'No consent',
              timestamp: new Date()
            });
          }

          return hasConsent;
        },

        // Add alert with privacy validation
        addAlertWithPrivacy: async (alertData: AlertData): Promise<string> => {
          const state = get();
          
          // Initialize privacy if needed
          if (!state.privacyInitialized) {
            await state.initializePrivacy();
          }

          // Check if we can store this type of alert
          const requiredCategory: ConsentCategory = alertData.persistent || alertData.priority === 'critical' 
            ? 'alert_acknowledgment' 
            : 'alerts_storage';

          const canStore = await state.checkConsentBeforeAction('store_alert', requiredCategory);
          
          if (!canStore && alertData.priority !== 'critical') {
            // For non-critical alerts without consent, we'll show them temporarily
            // but not persist them
            console.log('Alert shown temporarily without persistence due to privacy settings');
            
            // Create a temporary alert ID and add to display queue only
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const tempAlert = {
              id: tempId,
              priority: alertData.priority,
              data: alertData,
              groupId: alertData.groupId,
              timestamp: new Date(),
              processed: false
            };

            set(state => ({
              alerts: [...state.alerts, tempAlert]
            }));

            return tempId;
          }

          // Store with privacy validation
          try {
            const id = await privacyAwareAlertService.storeAlert({
              id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
            });

            // Update display state
            state._updateAlerts?.();

            return id;
          } catch (error) {
            console.error('Failed to add alert with privacy validation:', error);
            throw error;
          }
        },

        // Safe wrapper for adding alerts
        addAlertSafe: async (alertData: AlertData): Promise<string> => {
          return get().addAlertWithPrivacy(alertData);
        },

        // Safe wrapper for acknowledging alerts
        acknowledgeAlertSafe: async (alertId: string, acknowledgedBy: string, reason?: string): Promise<void> => {
          const state = get();
          
          const canAcknowledge = await state.checkConsentBeforeAction('acknowledge_alert', 'alert_acknowledgment');
          
          if (!canAcknowledge) {
            console.warn('Alert acknowledgment blocked by privacy settings, but recording for compliance');
            // For compliance, we might still need to record acknowledgments
          }

          try {
            await privacyAwareAlertService.acknowledgeAlert(alertId, acknowledgedBy);
            
            // Log the privacy-sensitive action
            await state.logPrivacyAction('alert_acknowledged', {
              alertId,
              acknowledgedBy,
              reason,
              hasConsent: canAcknowledge,
              timestamp: new Date()
            });

            // Update local state
            set(state => ({
              alerts: state.alerts.filter(a => a.id !== alertId)
            }));

          } catch (error) {
            console.error('Failed to acknowledge alert safely:', error);
            throw error;
          }
        },

        // Export privacy data
        exportPrivacyData: async (): Promise<void> => {
          try {
            const exportData = await privacyAwareAlertService.exportUserAlertData();
            
            // Create downloadable file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
              type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `alert-privacy-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            await get().logPrivacyAction('data_exported', {
              type: 'alert_data',
              timestamp: new Date()
            });

          } catch (error) {
            console.error('Failed to export privacy data:', error);
            set({ privacyError: 'Failed to export privacy data' });
            throw error;
          }
        },

        // Delete privacy data
        deletePrivacyData: async (): Promise<void> => {
          try {
            const deleteResult = await privacyAwareAlertService.deleteUserAlertData();
            
            // Clear local state
            set({
              alerts: [],
              persistedAlerts: [],
              dismissedAlerts: []
            });

            await get().logPrivacyAction('data_deleted', {
              ...deleteResult,
              type: 'alert_data'
            });

            console.log('Alert privacy data deleted:', deleteResult);
          } catch (error) {
            console.error('Failed to delete privacy data:', error);
            set({ privacyError: 'Failed to delete privacy data' });
            throw error;
          }
        },

        // Get privacy audit log
        getPrivacyAuditLog: async (): Promise<any[]> => {
          try {
            // This would typically fetch from a secure audit log
            // For now, return stored actions from localStorage
            const auditLog = localStorage.getItem('privacy-audit-log');
            return auditLog ? JSON.parse(auditLog) : [];
          } catch (error) {
            console.error('Failed to get privacy audit log:', error);
            return [];
          }
        },

        // Log privacy action
        logPrivacyAction: async (action: string, details: any): Promise<void> => {
          try {
            const auditEntry = {
              id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              action,
              details,
              timestamp: new Date(),
              userId: consentManager.userId,
              deviceId: consentManager.deviceId,
              sessionId: consentManager.sessionId
            };

            // Store in localStorage (in production, this would go to a secure audit service)
            const existingLog = localStorage.getItem('privacy-audit-log');
            const auditLog = existingLog ? JSON.parse(existingLog) : [];
            auditLog.push(auditEntry);
            
            // Keep only last 1000 entries
            if (auditLog.length > 1000) {
              auditLog.splice(0, auditLog.length - 1000);
            }
            
            localStorage.setItem('privacy-audit-log', JSON.stringify(auditLog));
          } catch (error) {
            console.error('Failed to log privacy action:', error);
          }
        },

        // Inherited methods from existing alert store (with privacy wrapper)
        addAlert: async (alert: AlertData) => {
          return get().addAlertSafe(alert);
        },

        acknowledgeAlert: async (alertId: string, acknowledgedBy: string, reason?: string) => {
          return get().acknowledgeAlertSafe(alertId, acknowledgedBy, reason);
        },

        // Other inherited methods would be implemented here...
        removeAlert: (id: string) => {
          // Implementation would go here
          console.log('removeAlert:', id);
        },

        clearAlerts: (priority?: AlertPriority) => {
          // Implementation would go here
          console.log('clearAlerts:', priority);
        },

        dismissAlert: async (id: string) => {
          // Implementation would go here
          console.log('dismissAlert:', id);
        },

        updateConfig: (config: any) => {
          // Implementation would go here
          console.log('updateConfig:', config);
        },

        pauseProcessing: () => {
          console.log('pauseProcessing');
        },

        resumeProcessing: () => {
          console.log('resumeProcessing');
        },

        connectWebSocket: (wsClient: any) => {
          console.log('connectWebSocket:', wsClient);
        },

        disconnectWebSocket: () => {
          console.log('disconnectWebSocket');
        },

        syncWithServer: async () => {
          console.log('syncWithServer');
        },

        loadPersistedAlerts: async (filter?: any) => {
          console.log('loadPersistedAlerts:', filter);
        },

        openAcknowledgeModal: (alert: any) => {
          console.log('openAcknowledgeModal:', alert);
        },

        closeAcknowledgeModal: () => {
          console.log('closeAcknowledgeModal');
        },

        openHistoryPanel: () => {
          console.log('openHistoryPanel');
        },

        closeHistoryPanel: () => {
          console.log('closeHistoryPanel');
        },

        initializePersistence: async () => {
          console.log('initializePersistence');
        },

        retryCrossTabSync: () => {
          console.log('retryCrossTabSync');
        },

        // Internal methods
        _initializeQueue: () => {
          console.log('_initializeQueue');
        },

        _updateAlerts: () => {
          console.log('_updateAlerts');
        },

        _handleWebSocketAlert: (alert: any) => {
          console.log('_handleWebSocketAlert:', alert);
        },

        _handleSyncComplete: (syncResponse: any) => {
          console.log('_handleSyncComplete:', syncResponse);
        },

        _handleCrossTabSync: (message: any) => {
          console.log('_handleCrossTabSync:', message);
        },

        _handleSyncStatusChange: (status: any) => {
          console.log('_handleSyncStatusChange:', status);
        },

        _checkAcknowledgmentRequirements: (alert: any): boolean => {
          return ['critical', 'high'].includes(alert.priority) && !alert.acknowledged;
        },
      }),
      {
        name: 'privacy-aware-alert-storage',
        partialize: (state) => ({
          dismissedAlerts: state.dismissedAlerts,
          config: state.config,
          lastSyncTimestamp: state.lastSyncTimestamp,
          historyPanelOpen: state.historyPanelOpen,
          privacyConsents: state.privacyConsents, // Persist privacy consents
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            // Initialize both alert system and privacy
            state._initializeQueue?.();
            state.initializePersistence?.();
            state.initializePrivacy?.();
          }
        },
      }
    ),
    {
      name: 'PrivacyAwareAlertStore',
    }
  )
);