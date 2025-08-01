/**
 * Retention System Demo
 * Comprehensive demonstration of the GDPR-compliant data retention system
 */

import React, { useState, useEffect } from 'react';
import { RetentionConfigurationPanel } from './RetentionConfigurationPanel';
import { RetentionDashboard } from './RetentionDashboard';
import { 
  enhancedAlertPersistenceService, 
  retentionService,
  retentionPolicy 
} from './index';
import { AlertPriority } from '../../theme/alertPriorities';
import { PersistedAlert } from '../../services/persistence/AlertPersistenceService';

interface RetentionSystemDemoProps {
  className?: string;
}

type DemoView = 'dashboard' | 'configuration' | 'simulation' | 'audit';

/**
 * Comprehensive demo of the retention system
 */
export const RetentionSystemDemo: React.FC<RetentionSystemDemoProps> = ({
  className = ''
}) => {
  const [activeView, setActiveView] = useState<DemoView>('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [simulatedAlerts, setSimulatedAlerts] = useState<PersistedAlert[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    initializeRetentionSystem();
  }, []);

  const initializeRetentionSystem = async () => {
    try {
      console.log('Initializing retention system demo...');
      
      // Initialize the enhanced persistence service
      await enhancedAlertPersistenceService.initialize();
      
      // Load existing alerts for demo
      await loadDemoAlerts();
      
      setIsInitialized(true);
      console.log('Retention system demo initialized successfully');
    } catch (error) {
      console.error('Failed to initialize retention system demo:', error);
    }
  };

  const loadDemoAlerts = async () => {
    try {
      const alerts = await enhancedAlertPersistenceService.getAlerts();
      setSimulatedAlerts(alerts);
      
      const logs = retentionService.getAuditLogs();
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to load demo alerts:', error);
    }
  };

  const generateSampleAlerts = async () => {
    try {
      setIsSimulating(true);
      
      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
      const sampleMessages = [
        'Communication system offline',
        'Battery level critical',
        'Navigation sensor calibration needed',
        'Routine maintenance scheduled',
        'System status update',
        'Emergency protocol activated',
        'Data synchronization completed',
        'Temperature threshold exceeded',
        'Software update available',
        'Mission milestone reached'
      ];

      const newAlerts: PersistedAlert[] = [];

      // Generate alerts with different creation dates to simulate retention scenarios
      for (let i = 0; i < 20; i++) {
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const message = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
        
        // Create alerts with dates ranging from 1 year ago to now
        const daysAgo = Math.floor(Math.random() * 365);
        const createdAt = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));
        
        const alert = {
          id: `demo-alert-${Date.now()}-${i}`,
          message: `${message} (Demo Alert ${i + 1})`,
          priority,
          timestamp: createdAt,
          closable: true,
          persistent: priority === 'critical' || priority === 'high',
          acknowledged: Math.random() > 0.7,
          source: 'demo-system',
          syncStatus: 'synced' as const,
        };

        // Store the alert with retention metadata
        await enhancedAlertPersistenceService.storeAlert(alert);
        
        // Simulate some legal holds on critical alerts
        if (priority === 'critical' && Math.random() > 0.8) {
          await enhancedAlertPersistenceService.placeLegalHold(
            alert.id,
            'demo-admin',
            'Demonstration legal hold for compliance testing',
            'DEMO-CASE-001'
          );
        }
      }

      // Reload alerts to show updated data
      await loadDemoAlerts();
      
      console.log('Generated sample alerts for retention demo');
    } catch (error) {
      console.error('Failed to generate sample alerts:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const clearDemoData = async () => {
    try {
      const alerts = await enhancedAlertPersistenceService.getAlerts();
      
      // Remove demo alerts only
      for (const alert of alerts) {
        if (alert.id.startsWith('demo-alert-')) {
          await enhancedAlertPersistenceService.removeAlert(alert.id);
        }
      }
      
      await loadDemoAlerts();
      console.log('Demo data cleared');
    } catch (error) {
      console.error('Failed to clear demo data:', error);
    }
  };

  const simulateDataLifecycle = async () => {
    try {
      setIsSimulating(true);
      
      console.log('Simulating data lifecycle...');
      
      // Run retention cleanup
      const result = await enhancedAlertPersistenceService.performRetentionCleanup();
      
      console.log('Lifecycle simulation completed:', result);
      
      // Reload data
      await loadDemoAlerts();
      
      alert(`Lifecycle simulation completed:\n${result.deleted} alerts deleted\n${result.skipped} alerts skipped\n${result.failed} failed deletions`);
    } catch (error) {
      console.error('Failed to simulate data lifecycle:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const renderNavigationTabs = () => (
    <div className="demo-navigation">
      <div className="nav-tabs">
        <button
          type="button"
          className={`nav-tab ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveView('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`nav-tab ${activeView === 'configuration' ? 'active' : ''}`}
          onClick={() => setActiveView('configuration')}
        >
          Configuration
        </button>
        <button
          type="button"
          className={`nav-tab ${activeView === 'simulation' ? 'active' : ''}`}
          onClick={() => setActiveView('simulation')}
        >
          Simulation
        </button>
        <button
          type="button"
          className={`nav-tab ${activeView === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveView('audit')}
        >
          Audit Logs
        </button>
      </div>
    </div>
  );

  const renderSimulationPanel = () => (
    <div className="simulation-panel">
      <div className="panel-header">
        <h2>Retention System Simulation</h2>
        <p className="panel-description">
          Test and demonstrate GDPR-compliant data retention features
        </p>
      </div>

      <div className="simulation-controls">
        <div className="control-section">
          <h3>Demo Data Generation</h3>
          <p>Generate sample alerts with various creation dates to test retention policies</p>
          <div className="control-buttons">
            <button
              type="button"
              onClick={generateSampleAlerts}
              disabled={isSimulating}
              className="btn-primary"
            >
              {isSimulating ? 'Generating...' : 'Generate Sample Alerts'}
            </button>
            <button
              type="button"
              onClick={clearDemoData}
              disabled={isSimulating}
              className="btn-secondary"
            >
              Clear Demo Data
            </button>
          </div>
        </div>

        <div className="control-section">
          <h3>Lifecycle Simulation</h3>
          <p>Simulate the automated data retention and purging process</p>
          <div className="control-buttons">
            <button
              type="button"
              onClick={simulateDataLifecycle}
              disabled={isSimulating}
              className="btn-primary"
            >
              {isSimulating ? 'Simulating...' : 'Run Lifecycle Simulation'}
            </button>
          </div>
        </div>

        <div className="demo-stats">
          <h3>Current Demo Data</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Alerts:</span>
              <span className="stat-value">{simulatedAlerts.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Demo Alerts:</span>
              <span className="stat-value">
                {simulatedAlerts.filter(a => a.id.startsWith('demo-alert-')).length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Legal Holds:</span>
              <span className="stat-value">
                {simulatedAlerts.filter(a => a.metadata?.retention?.legalHold?.enabled).length}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Audit Entries:</span>
              <span className="stat-value">{auditLogs.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="feature-showcase">
        <h3>Key Features Demonstrated</h3>
        <div className="features-grid">
          <div className="feature-card">
            <h4>🔄 Automated Purging</h4>
            <p>Background worker automatically deletes expired alerts according to retention policies</p>
          </div>
          <div className="feature-card">
            <h4>⚖️ Legal Hold Support</h4>
            <p>Prevent deletion of specific alerts for legal or compliance purposes</p>
          </div>
          <div className="feature-card">
            <h4>📊 Priority-Based Retention</h4>
            <p>Different retention periods for critical, high, medium, low, and info alerts</p>
          </div>
          <div className="feature-card">
            <h4>🛡️ GDPR Compliance</h4>
            <p>Privacy-aware processing with consent management and right to erasure</p>
          </div>
          <div className="feature-card">
            <h4>📈 Grace Periods</h4>
            <p>Additional time before permanent deletion for data recovery</p>
          </div>
          <div className="feature-card">
            <h4>📋 Audit Logging</h4>
            <p>Comprehensive audit trail of all retention-related operations</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuditPanel = () => (
    <div className="audit-panel">
      <div className="panel-header">
        <h2>Retention Audit Logs</h2>
        <p className="panel-description">
          Comprehensive audit trail of all retention and data lifecycle operations
        </p>
      </div>

      <div className="audit-controls">
        <button
          type="button"
          onClick={loadDemoAlerts}
          className="btn-secondary"
        >
          Refresh Logs
        </button>
      </div>

      <div className="audit-logs-container">
        {auditLogs.length === 0 ? (
          <div className="empty-state">
            <p>No audit logs available. Generate some demo data to see audit entries.</p>
          </div>
        ) : (
          <div className="audit-logs-list">
            {auditLogs.slice(0, 50).map((log, index) => (
              <div key={index} className={`audit-log-entry ${log.action}`}>
                <div className="log-header">
                  <span className="log-action">{log.action.toUpperCase()}</span>
                  <span className="log-timestamp">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="log-details">
                  <div className="log-field">
                    <strong>Alert ID:</strong> {log.alertId}
                  </div>
                  {log.userId && (
                    <div className="log-field">
                      <strong>User:</strong> {log.userId}
                    </div>
                  )}
                  {log.reason && (
                    <div className="log-field">
                      <strong>Reason:</strong> {log.reason}
                    </div>
                  )}
                  <div className="log-field">
                    <strong>Policy Version:</strong> {log.policyVersion}
                  </div>
                  {log.metadata && (
                    <div className="log-metadata">
                      <strong>Metadata:</strong>
                      <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!isInitialized) {
    return (
      <div className={`retention-system-demo ${className}`}>
        <div className="loading-state">
          <div className="spinner" />
          <p>Initializing retention system demo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`retention-system-demo ${className}`}>
      <div className="demo-header">
        <h1>GDPR-Compliant Data Retention System</h1>
        <p className="demo-description">
          Comprehensive demonstration of automated data lifecycle management, 
          legal hold capabilities, and privacy-compliant retention policies.
        </p>
      </div>

      {renderNavigationTabs()}

      <div className="demo-content">
        {activeView === 'dashboard' && (
          <RetentionDashboard autoRefresh={true} refreshInterval={10000} />
        )}

        {activeView === 'configuration' && (
          <RetentionConfigurationPanel
            onConfigurationChange={(config) => {
              console.log('Retention configuration updated:', config);
            }}
          />
        )}

        {activeView === 'simulation' && renderSimulationPanel()}

        {activeView === 'audit' && renderAuditPanel()}
      </div>
    </div>
  );
};

export default RetentionSystemDemo;