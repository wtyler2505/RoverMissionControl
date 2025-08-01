/**
 * Retention Dashboard
 * Monitoring and statistics dashboard for data retention system
 */

import React, { useState, useEffect } from 'react';
import { AlertPriority } from '../../theme/alertPriorities';
import { enhancedAlertPersistenceService } from '../../services/retention/EnhancedAlertPersistenceService';
import { retentionService } from '../../services/retention/RetentionService';

interface RetentionDashboardProps {
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface DashboardStats {
  totalAlerts: number;
  activeAlerts: number;
  expiredAlerts: number;
  gracePeriodAlerts: number;
  legalHoldAlerts: number;
  pendingDeletion: number;
  recentlyDeleted: number;
  retentionByPriority: Record<AlertPriority, {
    active: number;
    expired: number;
    averageAge: number;
  }>;
  workerStatus: {
    isInitialized: boolean;
    isRunning: boolean;
    hasWorker: boolean;
    lastPurge?: Date;
  };
  lastCleanup?: Date;
  nextScheduledCleanup?: Date;
}

interface LegalHoldInfo {
  alertId: string;
  priority: AlertPriority;
  message: string;
  placedBy: string;
  placedAt: Date;
  reason: string;
  expiresAt?: Date;
}

/**
 * Retention Dashboard Component
 */
export const RetentionDashboard: React.FC<RetentionDashboardProps> = ({
  className = '',
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [legalHolds, setLegalHolds] = useState<LegalHoldInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);
  const [isRunningCleanup, setIsRunningCleanup] = useState(false);

  useEffect(() => {
    loadDashboardData();

    if (autoRefresh) {
      const interval = setInterval(loadDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  const loadDashboardData = async () => {
    try {
      setError(null);
      
      // Get retention statistics
      const retentionStats = await enhancedAlertPersistenceService.getRetentionStats();
      setStats(retentionStats);

      // Get legal holds information
      const alerts = await enhancedAlertPersistenceService.getAlerts();
      const alertsOnLegalHold = alerts.filter(alert => 
        alert.metadata?.retention?.legalHold?.enabled
      );

      const legalHoldInfo: LegalHoldInfo[] = alertsOnLegalHold.map(alert => ({
        alertId: alert.id,
        priority: alert.priority,
        message: alert.message,
        placedBy: alert.metadata.retention.legalHold.placedBy,
        placedAt: new Date(alert.metadata.retention.legalHold.placedAt),
        reason: alert.metadata.retention.legalHold.reason,
        expiresAt: alert.metadata.retention.legalHold.expiresAt ? 
          new Date(alert.metadata.retention.legalHold.expiresAt) : undefined
      }));

      setLegalHolds(legalHoldInfo);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setError('Failed to load retention statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const runImmediateCleanup = async () => {
    try {
      setIsRunningCleanup(true);
      setError(null);
      
      const result = await enhancedAlertPersistenceService.performRetentionCleanup();
      
      console.log('Manual cleanup completed:', result);
      
      // Refresh dashboard data
      await loadDashboardData();
      
      // Show success message (you might want to use a toast notification here)
      alert(`Cleanup completed: ${result.deleted} alerts deleted, ${result.skipped} skipped`);
    } catch (error) {
      console.error('Failed to run cleanup:', error);
      setError('Failed to run cleanup operation');
    } finally {
      setIsRunningCleanup(false);
    }
  };

  const formatDuration = (milliseconds: number): string => {
    const days = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
    const hours = Math.floor((milliseconds % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return '<1h';
    }
  };

  const getPriorityColor = (priority: AlertPriority): string => {
    const colors = {
      critical: '#dc2626',
      high: '#f59e0b',
      medium: '#3b82f6',
      low: '#22c55e',
      info: '#64748b'
    };
    return colors[priority];
  };

  const getHealthStatus = (): { status: 'healthy' | 'warning' | 'error'; message: string } => {
    if (!stats) return { status: 'error', message: 'No data available' };

    if (!stats.workerStatus.isInitialized) {
      return { status: 'error', message: 'Background worker not initialized' };
    }

    if (!stats.workerStatus.isRunning) {
      return { status: 'warning', message: 'Automatic purging is disabled' };
    }

    if (stats.pendingDeletion > 100) {
      return { status: 'warning', message: `${stats.pendingDeletion} alerts pending deletion` };
    }

    return { status: 'healthy', message: 'Retention system operating normally' };
  };

  if (isLoading && !stats) {
    return (
      <div className={`retention-dashboard ${className}`}>
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading retention dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={`retention-dashboard ${className}`}>
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={loadDashboardData} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const healthStatus = getHealthStatus();

  return (
    <div className={`retention-dashboard ${className}`}>
      <div className="dashboard-header">
        <div className="header-content">
          <h2>Data Retention Dashboard</h2>
          <p className="dashboard-description">
            Monitor and manage GDPR-compliant data retention for alert system
          </p>
        </div>

        <div className="header-actions">
          <div className="refresh-info">
            <span className="last-update">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="btn-secondary"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            onClick={runImmediateCleanup}
            disabled={isRunningCleanup}
            className="btn-primary"
          >
            {isRunningCleanup ? 'Running...' : 'Run Cleanup'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}

      <div className="dashboard-content">
        {/* System Health Status */}
        <div className="health-section">
          <div className={`health-card ${healthStatus.status}`}>
            <div className="health-icon">
              {healthStatus.status === 'healthy' && '✅'}
              {healthStatus.status === 'warning' && '⚠️'}
              {healthStatus.status === 'error' && '❌'}
            </div>
            <div className="health-content">
              <h3>System Health</h3>
              <p>{healthStatus.message}</p>
            </div>
          </div>
        </div>

        {/* Overview Statistics */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats?.totalAlerts || 0}</div>
            <div className="stat-label">Total Alerts</div>
          </div>

          <div className="stat-card active">
            <div className="stat-value">{stats?.activeAlerts || 0}</div>
            <div className="stat-label">Active Alerts</div>
          </div>

          <div className="stat-card expired">
            <div className="stat-value">{stats?.expiredAlerts || 0}</div>
            <div className="stat-label">Expired Alerts</div>
          </div>

          <div className="stat-card grace-period">
            <div className="stat-value">{stats?.gracePeriodAlerts || 0}</div>
            <div className="stat-label">Grace Period</div>
          </div>

          <div className="stat-card pending-deletion">
            <div className="stat-value">{stats?.pendingDeletion || 0}</div>
            <div className="stat-label">Pending Deletion</div>
          </div>

          <div className="stat-card legal-hold">
            <div className="stat-value">{stats?.legalHoldAlerts || 0}</div>
            <div className="stat-label">Legal Hold</div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="priority-section">
          <h3>Retention by Priority</h3>
          <div className="priority-grid">
            {stats && Object.entries(stats.retentionByPriority).map(([priority, data]) => (
              <div key={priority} className="priority-card">
                <div className="priority-header">
                  <div 
                    className="priority-indicator"
                    style={{ backgroundColor: getPriorityColor(priority as AlertPriority) }}
                  />
                  <h4>{priority.toUpperCase()}</h4>
                </div>
                
                <div className="priority-stats">
                  <div className="priority-stat">
                    <span className="stat-value">{data.active}</span>
                    <span className="stat-label">Active</span>
                  </div>
                  <div className="priority-stat">
                    <span className="stat-value">{data.expired}</span>
                    <span className="stat-label">Expired</span>
                  </div>
                  <div className="priority-stat">
                    <span className="stat-value">{data.averageAge}d</span>
                    <span className="stat-label">Avg Age</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal Holds */}
        {legalHolds.length > 0 && (
          <div className="legal-holds-section">
            <h3>Active Legal Holds ({legalHolds.length})</h3>
            <div className="legal-holds-list">
              {legalHolds.map((hold, index) => (
                <div key={index} className="legal-hold-card">
                  <div className="hold-header">
                    <div className="hold-priority">
                      <div 
                        className="priority-badge"
                        style={{ backgroundColor: getPriorityColor(hold.priority) }}
                      >
                        {hold.priority}
                      </div>
                    </div>
                    <div className="hold-id">
                      ID: {hold.alertId.substring(0, 8)}...
                    </div>
                  </div>
                  
                  <div className="hold-content">
                    <p className="hold-message">{hold.message}</p>
                    <div className="hold-details">
                      <div className="detail-item">
                        <strong>Placed by:</strong> {hold.placedBy}
                      </div>
                      <div className="detail-item">
                        <strong>Date:</strong> {hold.placedAt.toLocaleDateString()}
                      </div>
                      <div className="detail-item">
                        <strong>Reason:</strong> {hold.reason}
                      </div>
                      {hold.expiresAt && (
                        <div className="detail-item">
                          <strong>Expires:</strong> {hold.expiresAt.toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* System Information */}
        <div className="system-info-section">
          <h3>System Information</h3>
          <div className="info-grid">
            <div className="info-card">
              <h4>Background Worker</h4>
              <div className="info-details">
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className={`info-value ${stats?.workerStatus.isRunning ? 'running' : 'stopped'}`}>
                    {stats?.workerStatus.isRunning ? 'Running' : 'Stopped'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Initialized:</span>
                  <span className="info-value">
                    {stats?.workerStatus.isInitialized ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h4>Cleanup Schedule</h4>
              <div className="info-details">
                {stats?.lastCleanup && (
                  <div className="info-item">
                    <span className="info-label">Last Cleanup:</span>
                    <span className="info-value">
                      {stats.lastCleanup.toLocaleString()}
                    </span>
                  </div>
                )}
                {stats?.nextScheduledCleanup && (
                  <div className="info-item">
                    <span className="info-label">Next Cleanup:</span>
                    <span className="info-value">
                      {stats.nextScheduledCleanup.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="info-card">
              <h4>Recently Deleted</h4>
              <div className="info-details">
                <div className="info-item">
                  <span className="info-label">Last 30 days:</span>
                  <span className="info-value">{stats?.recentlyDeleted || 0} alerts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetentionDashboard;