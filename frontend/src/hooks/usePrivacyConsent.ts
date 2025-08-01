/**
 * Privacy Consent Hook
 * Provides a React hook interface for managing privacy consent throughout the application
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ConsentManager, 
  ConsentCategory, 
  ConsentPreference,
  consentManager 
} from '../services/privacy/ConsentManager';
import { consentVersioningService } from '../services/privacy/ConsentVersioningService';

export interface PrivacyConsentState {
  consents: Record<ConsentCategory, boolean>;
  needsInitialConsent: boolean;
  needsReview: boolean;
  reviewOverdue: boolean;
  daysOverdue: number;
  policyUpdatesAvailable: boolean;
  loading: boolean;
  error: string | null;
  statistics: any;
}

export interface PrivacyConsentActions {
  hasConsent: (category: ConsentCategory) => boolean;
  updateConsent: (category: ConsentCategory, granted: boolean, reason?: string) => Promise<void>;
  updateMultipleConsents: (updates: Array<{ category: ConsentCategory; granted: boolean; reasonForChange?: string }>) => Promise<void>;
  exportConsentData: () => Promise<void>;
  withdrawAllConsent: () => Promise<void>;
  markInitialConsentComplete: () => void;
  completeReview: () => Promise<void>;
  getConsentHistory: (category?: ConsentCategory, limit?: number) => Promise<ConsentPreference[]>;
  getConsentStatistics: () => Promise<any>;
  requestContextualConsent: (categories: ConsentCategory[], context: any) => Promise<any>;
  checkPolicyUpdates: () => Promise<any>;
  refresh: () => Promise<void>;
}

export function usePrivacyConsent(): PrivacyConsentState & PrivacyConsentActions {
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({} as any);
  const [needsInitialConsent, setNeedsInitialConsent] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewOverdue, setReviewOverdue] = useState(false);
  const [daysOverdue, setDaysOverdue] = useState(0);
  const [policyUpdatesAvailable, setPolicyUpdatesAvailable] = useState(false);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize consent manager and load initial state
  const initialize = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!initialized) {
        await consentManager.initialize();
        setInitialized(true);
      }

      const [currentConsents, needsConsent, reviewStatus, stats, policyStatus] = await Promise.all([
        consentManager.getAllConsents(),
        consentManager.needsInitialConsent(),
        consentManager.isConsentReviewDue(),
        consentManager.getConsentStatistics(),
        consentVersioningService.checkUserPolicyStatus(consentManager.userId)
      ]);

      setConsents(currentConsents);
      setNeedsInitialConsent(needsConsent);
      setNeedsReview(reviewStatus.isDue || policyStatus.needsReview);
      setReviewOverdue(reviewStatus.daysOverdue > 0 || policyStatus.daysOverdue > 0);
      setDaysOverdue(Math.max(reviewStatus.daysOverdue, policyStatus.daysOverdue));
      setPolicyUpdatesAvailable(policyStatus.changesSinceLastConsent.length > 0);
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to initialize privacy consent:', err);
      setError('Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  }, [initialized]);

  // Initial load
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Check if user has consent for a specific category
  const hasConsent = useCallback((category: ConsentCategory): boolean => {
    return consents[category] ?? false;
  }, [consents]);

  // Update consent for a single category
  const updateConsent = useCallback(async (category: ConsentCategory, granted: boolean, reason?: string) => {
    try {
      setError(null);
      await consentManager.updateConsent(category, granted, 'update', reason);
      
      // Update local state
      setConsents(prev => ({
        ...prev,
        [category]: granted
      }));
      
      // Refresh statistics
      const newStats = await consentManager.getConsentStatistics();
      setStatistics(newStats);
    } catch (err) {
      console.error('Failed to update consent:', err);
      setError('Failed to update privacy preference');
      throw err;
    }
  }, []);

  // Update multiple consents at once
  const updateMultipleConsents = useCallback(async (
    updates: Array<{ category: ConsentCategory; granted: boolean; reasonForChange?: string }>
  ) => {
    try {
      setError(null);
      await consentManager.updateMultipleConsents(updates);
      
      // Update local state
      setConsents(prev => {
        const newConsents = { ...prev };
        updates.forEach(({ category, granted }) => {
          newConsents[category] = granted;
        });
        return newConsents;
      });
      
      // Refresh statistics
      const newStats = await consentManager.getConsentStatistics();
      setStatistics(newStats);
    } catch (err) {
      console.error('Failed to update multiple consents:', err);
      setError('Failed to update privacy preferences');
      throw err;
    }
  }, []);

  // Export consent data
  const exportConsentData = useCallback(async () => {
    try {
      setError(null);
      const exportData = await consentManager.exportConsentData();
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `privacy-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export consent data:', err);
      setError('Failed to export privacy data');
      throw err;
    }
  }, []);

  // Withdraw all non-required consent
  const withdrawAllConsent = useCallback(async () => {
    try {
      setError(null);
      await consentManager.withdrawAllConsent();
      
      // Refresh consents to reflect changes
      const updatedConsents = await consentManager.getAllConsents();
      setConsents(updatedConsents);
    } catch (err) {
      console.error('Failed to withdraw consent:', err);
      setError('Failed to withdraw consent');
      throw err;
    }
  }, []);

  // Mark initial consent as complete
  const markInitialConsentComplete = useCallback(() => {
    setNeedsInitialConsent(false);
  }, []);

  // Complete consent review
  const completeReview = useCallback(async () => {
    try {
      setError(null);
      await consentManager.completeConsentReview();
      
      // Update review status
      const reviewStatus = await consentManager.isConsentReviewDue();
      setNeedsReview(reviewStatus.isDue);
      setReviewOverdue(reviewStatus.daysOverdue > 0);
      setDaysOverdue(reviewStatus.daysOverdue);
      
      // Mark policy updates as acknowledged
      const notifications = consentVersioningService.getPendingNotifications(consentManager.userId);
      for (const notification of notifications) {
        await consentVersioningService.acknowledgeNotification(notification.id);
      }
      setPolicyUpdatesAvailable(false);
    } catch (err) {
      console.error('Failed to complete review:', err);
      setError('Failed to complete privacy review');
      throw err;
    }
  }, []);

  // Get consent history
  const getConsentHistory = useCallback(async (
    category?: ConsentCategory, 
    limit: number = 50
  ): Promise<ConsentPreference[]> => {
    try {
      setError(null);
      if (category) {
        return await consentManager.getConsentHistory(category);
      } else {
        const result = await consentManager.getConsentHistoryPaginated(undefined, limit);
        return result.items;
      }
    } catch (err) {
      console.error('Failed to get consent history:', err);
      setError('Failed to load consent history');
      return [];
    }
  }, []);

  // Get consent statistics
  const getConsentStatistics = useCallback(async () => {
    try {
      setError(null);
      const stats = await consentManager.getConsentStatistics();
      setStatistics(stats);
      return stats;
    } catch (err) {
      console.error('Failed to get consent statistics:', err);
      setError('Failed to load consent statistics');
      return null;
    }
  }, []);

  // Request contextual consent
  const requestContextualConsent = useCallback(async (
    categories: ConsentCategory[], 
    context: {
      featureName: string;
      reason: string;
      benefits: string[];
      consequences?: string;
    }
  ) => {
    try {
      setError(null);
      return await consentManager.requestContextualConsent(categories, context);
    } catch (err) {
      console.error('Failed to request contextual consent:', err);
      setError('Failed to request consent');
      throw err;
    }
  }, []);

  // Check for policy updates
  const checkPolicyUpdates = useCallback(async () => {
    try {
      setError(null);
      const policyStatus = await consentVersioningService.checkUserPolicyStatus(consentManager.userId);
      setPolicyUpdatesAvailable(policyStatus.changesSinceLastConsent.length > 0);
      setNeedsReview(policyStatus.needsReview);
      setDaysOverdue(policyStatus.daysOverdue);
      return policyStatus;
    } catch (err) {
      console.error('Failed to check policy updates:', err);
      setError('Failed to check policy updates');
      return null;
    }
  }, []);

  // Refresh consent state
  const refresh = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // Memoized return value to prevent unnecessary re-renders
  return useMemo(() => ({
    // State
    consents,
    needsInitialConsent,
    needsReview,
    reviewOverdue,
    daysOverdue,
    policyUpdatesAvailable,
    loading,
    error,
    statistics,
    
    // Actions
    hasConsent,
    updateConsent,
    updateMultipleConsents,
    exportConsentData,
    withdrawAllConsent,
    markInitialConsentComplete,
    completeReview,
    getConsentHistory,
    getConsentStatistics,
    requestContextualConsent,
    checkPolicyUpdates,
    refresh
  }), [
    consents,
    needsInitialConsent,
    needsReview,
    reviewOverdue,
    daysOverdue,
    policyUpdatesAvailable,
    loading,
    error,
    statistics,
    hasConsent,
    updateConsent,
    updateMultipleConsents,
    exportConsentData,
    withdrawAllConsent,
    markInitialConsentComplete,
    completeReview,
    getConsentHistory,
    getConsentStatistics,
    requestContextualConsent,
    checkPolicyUpdates,
    refresh
  ]);
}

// Specific hook for alert-related consent
export function useAlertPrivacyConsent() {
  const privacy = usePrivacyConsent();
  
  return useMemo(() => ({
    ...privacy,
    canStoreAlerts: privacy.hasConsent('alerts_storage'),
    canTrackAcknowledgments: privacy.hasConsent('alert_acknowledgment'),
    canSyncAcrossDevices: privacy.hasConsent('cross_device_sync'),
    canCollectDiagnostics: privacy.hasConsent('diagnostic_data'),
    
    // Helper method to check if alert persistence is allowed
    isAlertPersistenceAllowed: () => {
      return privacy.hasConsent('alerts_storage') || privacy.hasConsent('alert_acknowledgment');
    },
    
    // Helper method to get allowed storage categories for alerts
    getAllowedAlertStorageCategories: () => {
      const categories: string[] = [];
      
      if (privacy.hasConsent('alerts_storage')) {
        categories.push('general_alerts');
      }
      
      if (privacy.hasConsent('alert_acknowledgment')) {
        categories.push('acknowledgments');
      }
      
      if (privacy.hasConsent('cross_device_sync')) {
        categories.push('sync_data');
      }
      
      return categories;
    }
  }), [privacy]);
}