/**
 * Alert API Service
 * Handles backend synchronization for cross-device alert persistence
 */

import { AlertPriority } from '../../theme/alertPriorities';

export interface AlertSyncData {
  id: string;
  clientId: string;
  priority: AlertPriority;
  title?: string;
  message: string;
  timestamp: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  dismissedAt?: string;
  metadata?: Record<string, any>;
  deviceId: string;
  version: number;
}

export interface AlertSyncResponse {
  alerts: AlertSyncData[];
  lastSyncTimestamp: string;
  conflicts: AlertConflict[];
}

export interface AlertConflict {
  alertId: string;
  type: 'acknowledgment' | 'dismissal' | 'version';
  localVersion: AlertSyncData;
  remoteVersion: AlertSyncData;
  resolution: 'local' | 'remote' | 'merge';
}

export interface AlertAcknowledgment {
  alertId: string;
  acknowledgedAt: string;
  acknowledgedBy: string;
  deviceId: string;
  metadata?: Record<string, any>;
}

class AlertApiService {
  private baseUrl: string;
  private authToken: string | null = null;
  private deviceId: string;

  constructor(baseUrl: string = '/api/v1/alerts') {
    this.baseUrl = baseUrl;
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string) {
    this.authToken = token;
  }

  /**
   * Sync alerts with backend
   */
  async syncAlerts(
    lastSyncTimestamp: string,
    localAlerts: AlertSyncData[]
  ): Promise<AlertSyncResponse> {
    try {
      const response = await this.fetch('/sync', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: this.deviceId,
          lastSyncTimestamp,
          alerts: localAlerts,
        }),
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.resolveConflicts(data, localAlerts);
    } catch (error) {
      console.error('Alert sync error:', error);
      throw error;
    }
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    filters: {
      priority?: AlertPriority[];
      startDate?: string;
      endDate?: string;
      acknowledged?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ alerts: AlertSyncData[]; total: number }> {
    const params = new URLSearchParams();
    
    if (filters.priority?.length) {
      params.append('priority', filters.priority.join(','));
    }
    if (filters.startDate) {
      params.append('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params.append('endDate', filters.endDate);
    }
    if (filters.acknowledged !== undefined) {
      params.append('acknowledged', String(filters.acknowledged));
    }
    params.append('limit', String(filters.limit || 50));
    params.append('offset', String(filters.offset || 0));

    const response = await this.fetch(`/history?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(acknowledgment: AlertAcknowledgment): Promise<void> {
    const response = await this.fetch(`/${acknowledgment.alertId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(acknowledgment),
    });

    if (!response.ok) {
      throw new Error(`Failed to acknowledge alert: ${response.statusText}`);
    }
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(
    alertId: string,
    permanent: boolean = false
  ): Promise<void> {
    const response = await this.fetch(`/${alertId}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({
        deviceId: this.deviceId,
        dismissedAt: new Date().toISOString(),
        permanent,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to dismiss alert: ${response.statusText}`);
    }
  }

  /**
   * Delete alerts (GDPR compliance)
   */
  async deleteAlerts(alertIds: string[]): Promise<void> {
    const response = await this.fetch('/delete', {
      method: 'DELETE',
      body: JSON.stringify({ alertIds }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete alerts: ${response.statusText}`);
    }
  }

  /**
   * Export user alerts (GDPR compliance)
   */
  async exportAlerts(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const response = await this.fetch(`/export?format=${format}`);

    if (!response.ok) {
      throw new Error(`Failed to export alerts: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Subscribe to real-time alert updates
   */
  subscribeToUpdates(
    onUpdate: (alert: AlertSyncData) => void,
    onError?: (error: Error) => void
  ): () => void {
    // In a real implementation, this would use SSE or WebSocket
    // For now, we'll use polling as a fallback
    let intervalId: NodeJS.Timeout | null = null;
    let lastTimestamp = new Date().toISOString();

    const poll = async () => {
      try {
        const response = await this.syncAlerts(lastTimestamp, []);
        lastTimestamp = response.lastSyncTimestamp;
        
        response.alerts.forEach(alert => {
          onUpdate(alert);
        });
      } catch (error) {
        onError?.(error as Error);
      }
    };

    // Poll every 30 seconds
    intervalId = setInterval(poll, 30000);

    // Return cleanup function
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }

  /**
   * Private helper methods
   */
  private async fetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
  }

  private resolveConflicts(
    response: AlertSyncResponse,
    localAlerts: AlertSyncData[]
  ): AlertSyncResponse {
    // Simple conflict resolution strategy
    const resolved = response.conflicts.map(conflict => {
      switch (conflict.type) {
        case 'acknowledgment':
          // First acknowledgment wins
          const firstAck = conflict.localVersion.acknowledgedAt < 
            conflict.remoteVersion.acknowledgedAt
            ? conflict.localVersion
            : conflict.remoteVersion;
          return { ...conflict, resolution: 'merge' as const };

        case 'dismissal':
          // Acknowledgment takes precedence over dismissal
          if (conflict.localVersion.acknowledgedAt || 
              conflict.remoteVersion.acknowledgedAt) {
            return { ...conflict, resolution: 'merge' as const };
          }
          // Otherwise, most recent action wins
          return { ...conflict, resolution: 'remote' as const };

        case 'version':
          // Last write wins for version conflicts
          return { 
            ...conflict, 
            resolution: conflict.localVersion.version > 
              conflict.remoteVersion.version ? 'local' : 'remote' as const
          };

        default:
          return { ...conflict, resolution: 'remote' as const };
      }
    });

    return {
      ...response,
      conflicts: resolved,
    };
  }

  private getOrCreateDeviceId(): string {
    const stored = localStorage.getItem('rover-device-id');
    if (stored) return stored;

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('rover-device-id', deviceId);
    return deviceId;
  }
}

// Export singleton instance
export const alertApi = new AlertApiService();

// Export types and class for testing
export { AlertApiService };

// Helper function to initialize API with auth
export const initializeAlertApi = (authToken: string, baseUrl?: string) => {
  if (baseUrl) {
    Object.assign(alertApi, new AlertApiService(baseUrl));
  }
  alertApi.setAuthToken(authToken);
};