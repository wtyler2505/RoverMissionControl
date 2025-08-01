/**
 * Retention Configuration Panel
 * Administrative interface for configuring data retention policies
 */

import React, { useState, useEffect } from 'react';
import { AlertPriority } from '../../theme/alertPriorities';
import { 
  RetentionPolicy, 
  RetentionPolicyConfig, 
  RetentionPeriod, 
  RetentionRule,
  retentionPolicy,
  DEFAULT_RETENTION_POLICY 
} from '../../services/retention/RetentionPolicy';
import { enhancedAlertPersistenceService } from '../../services/retention/EnhancedAlertPersistenceService';

interface RetentionConfigurationPanelProps {
  onConfigurationChange?: (config: RetentionPolicyConfig) => void;
  readOnly?: boolean;
  className?: string;
}

interface ValidationError {
  field: string;
  message: string;
}

/**
 * Retention Configuration Panel Component
 */
export const RetentionConfigurationPanel: React.FC<RetentionConfigurationPanelProps> = ({
  onConfigurationChange,
  readOnly = false,
  className = ''
}) => {
  const [config, setConfig] = useState<RetentionPolicyConfig>(DEFAULT_RETENTION_POLICY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeTab, setActiveTab] = useState<'priorities' | 'global' | 'compliance'>('priorities');

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      const currentConfig = retentionPolicy.getCurrentPolicy();
      setConfig(currentConfig);
    } catch (error) {
      console.error('Failed to load retention configuration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateConfiguration = (config: RetentionPolicyConfig): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Validate each priority rule
    const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
    
    priorities.forEach(priority => {
      const rule = config.rules[priority];
      if (!rule) {
        errors.push({ field: `rules.${priority}`, message: `Missing rule for ${priority} priority` });
        return;
      }

      // Validate period ranges
      if (rule.minPeriod && rule.maxPeriod && rule.minPeriod.duration > rule.maxPeriod.duration) {
        errors.push({ 
          field: `rules.${priority}.periods`, 
          message: `Minimum period cannot be greater than maximum period for ${priority}` 
        });
      }

      if (rule.defaultPeriod.duration < 0) {
        errors.push({ 
          field: `rules.${priority}.defaultPeriod`, 
          message: `Default period cannot be negative for ${priority}` 
        });
      }

      if (rule.minPeriod && rule.defaultPeriod.duration < rule.minPeriod.duration) {
        errors.push({ 
          field: `rules.${priority}.defaultPeriod`, 
          message: `Default period cannot be less than minimum period for ${priority}` 
        });
      }

      if (rule.maxPeriod && rule.defaultPeriod.duration > rule.maxPeriod.duration) {
        errors.push({ 
          field: `rules.${priority}.defaultPeriod`, 
          message: `Default period cannot be greater than maximum period for ${priority}` 
        });
      }
    });

    // Validate global settings
    if (config.globalSettings.purgeInterval <= 0) {
      errors.push({ field: 'globalSettings.purgeInterval', message: 'Purge interval must be positive' });
    }

    if (config.globalSettings.legalHoldMaxDuration <= 0) {
      errors.push({ field: 'globalSettings.legalHoldMaxDuration', message: 'Legal hold max duration must be positive' });
    }

    if (config.globalSettings.auditLogRetention <= 0) {
      errors.push({ field: 'globalSettings.auditLogRetention', message: 'Audit log retention must be positive' });
    }

    // Validate compliance settings
    if (config.complianceSettings.notificationPeriod < 0) {
      errors.push({ field: 'complianceSettings.notificationPeriod', message: 'Notification period cannot be negative' });
    }

    return errors;
  };

  const handleConfigurationUpdate = (updates: Partial<RetentionPolicyConfig>) => {
    const newConfig = { ...config, ...updates, lastUpdated: new Date() };
    setConfig(newConfig);
    setHasUnsavedChanges(true);
    
    // Validate configuration
    const validationErrors = validateConfiguration(newConfig);
    setErrors(validationErrors);
  };

  const handleRuleUpdate = (priority: AlertPriority, updates: Partial<RetentionRule>) => {
    const newConfig = {
      ...config,
      rules: {
        ...config.rules,
        [priority]: { ...config.rules[priority], ...updates }
      }
    };
    setConfig(newConfig);
    setHasUnsavedChanges(true);
    
    const validationErrors = validateConfiguration(newConfig);
    setErrors(validationErrors);
  };

  const handlePeriodUpdate = (priority: AlertPriority, periodType: keyof RetentionRule, period: Partial<RetentionPeriod>) => {
    const currentPeriod = config.rules[priority][periodType] as RetentionPeriod;
    const newPeriod = { ...currentPeriod, ...period };
    
    handleRuleUpdate(priority, { [periodType]: newPeriod });
  };

  const saveConfiguration = async () => {
    try {
      setIsSaving(true);
      
      // Validate before saving
      const validationErrors = validateConfiguration(config);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }

      // Update the retention policy
      retentionPolicy.updateDefaultPolicy(config);
      
      // Update the enhanced service configuration
      await enhancedAlertPersistenceService.updateRetentionConfiguration({
        enableAutomaticPurging: config.globalSettings.enableAutomaticPurging,
        purgeInterval: config.globalSettings.purgeInterval,
        enableGracePeriod: config.globalSettings.gracePeriodEnabled,
        enableNotifications: config.complianceSettings.notifyBeforeDeletion
      });

      setHasUnsavedChanges(false);
      setErrors([]);
      
      // Notify parent component
      if (onConfigurationChange) {
        onConfigurationChange(config);
      }

      console.log('Retention configuration saved successfully');
    } catch (error) {
      console.error('Failed to save retention configuration:', error);
      setErrors([{ field: 'general', message: 'Failed to save configuration. Please try again.' }]);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_RETENTION_POLICY);
    setHasUnsavedChanges(true);
    setErrors([]);
  };

  const formatDuration = (period: RetentionPeriod): string => {
    return RetentionPolicy.formatDuration(period);
  };

  const createDurationOptions = (unit: RetentionPeriod['unit']) => {
    const multipliers = {
      hours: [1, 6, 12, 24],
      days: [1, 7, 14, 30, 90],
      months: [1, 3, 6, 12],
      years: [1, 2, 5, 7]
    };

    return multipliers[unit].map(value => ({
      value,
      label: `${value} ${unit}${value !== 1 ? 's' : ''}`
    }));
  };

  if (isLoading) {
    return (
      <div className={`retention-config-panel ${className}`}>
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading retention configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`retention-config-panel ${className}`}>
      <div className="config-header">
        <div className="header-content">
          <h2>Data Retention Configuration</h2>
          <p className="config-description">
            Configure GDPR-compliant data retention policies for alert management
          </p>
          
          {hasUnsavedChanges && (
            <div className="unsaved-changes-indicator">
              <span className="status-dot" />
              Unsaved changes
            </div>
          )}
        </div>

        <div className="header-actions">
          <button
            type="button"
            onClick={resetToDefaults}
            className="btn-secondary"
            disabled={readOnly || isSaving}
          >
            Reset to Defaults
          </button>
          
          <button
            type="button"
            onClick={saveConfiguration}
            disabled={readOnly || isSaving || errors.length > 0}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="validation-errors">
          <h4>Configuration Errors</h4>
          <ul>
            {errors.map((error, index) => (
              <li key={index} className="error-item">
                <strong>{error.field}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="config-tabs">
        <div className="tab-headers">
          <button
            type="button"
            className={`tab-header ${activeTab === 'priorities' ? 'active' : ''}`}
            onClick={() => setActiveTab('priorities')}
          >
            Priority Rules
          </button>
          <button
            type="button"
            className={`tab-header ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTab('global')}
          >
            Global Settings
          </button>
          <button
            type="button"
            className={`tab-header ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            Compliance
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'priorities' && (
            <div className="priorities-config">
              <h3>Alert Priority Retention Rules</h3>
              <p className="section-description">
                Configure retention periods for different alert priority levels
              </p>

              <div className="priority-rules-grid">
                {(['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[]).map(priority => {
                  const rule = config.rules[priority];
                  return (
                    <div key={priority} className={`priority-rule-card ${priority}`}>
                      <div className="rule-header">
                        <h4 className="priority-name">{priority.toUpperCase()}</h4>
                        <div className="rule-settings">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={rule.legalHoldAllowed}
                              onChange={(e) => handleRuleUpdate(priority, { legalHoldAllowed: e.target.checked })}
                              disabled={readOnly}
                            />
                            Legal Hold Allowed
                          </label>
                        </div>
                      </div>

                      <div className="rule-description">
                        <p>{rule.description}</p>
                      </div>

                      <div className="period-config">
                        <div className="period-field">
                          <label>Default Retention Period</label>
                          <div className="period-inputs">
                            <input
                              type="number"
                              min="0"
                              value={Math.floor(rule.defaultPeriod.duration / getUnitMultiplier(rule.defaultPeriod.unit))}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                const duration = value * getUnitMultiplier(rule.defaultPeriod.unit);
                                handlePeriodUpdate(priority, 'defaultPeriod', { duration });
                              }}
                              disabled={readOnly}
                              className="period-value"
                            />
                            <select
                              value={rule.defaultPeriod.unit}
                              onChange={(e) => {
                                const unit = e.target.value as RetentionPeriod['unit'];
                                const currentValue = Math.floor(rule.defaultPeriod.duration / getUnitMultiplier(rule.defaultPeriod.unit));
                                const duration = currentValue * getUnitMultiplier(unit);
                                handlePeriodUpdate(priority, 'defaultPeriod', { unit, duration });
                              }}
                              disabled={readOnly}
                              className="period-unit"
                            >
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                              <option value="months">Months</option>
                              <option value="years">Years</option>
                            </select>
                          </div>
                        </div>

                        {rule.minPeriod && (
                          <div className="period-field">
                            <label>Minimum Period</label>
                            <div className="period-inputs">
                              <input
                                type="number"
                                min="0"
                                value={Math.floor(rule.minPeriod.duration / getUnitMultiplier(rule.minPeriod.unit))}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const duration = value * getUnitMultiplier(rule.minPeriod!.unit);
                                  handlePeriodUpdate(priority, 'minPeriod', { duration });
                                }}
                                disabled={readOnly}
                                className="period-value"
                              />
                              <select
                                value={rule.minPeriod.unit}
                                onChange={(e) => {
                                  const unit = e.target.value as RetentionPeriod['unit'];
                                  const currentValue = Math.floor(rule.minPeriod!.duration / getUnitMultiplier(rule.minPeriod!.unit));
                                  const duration = currentValue * getUnitMultiplier(unit);
                                  handlePeriodUpdate(priority, 'minPeriod', { unit, duration });
                                }}
                                disabled={readOnly}
                                className="period-unit"
                              >
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {rule.maxPeriod && (
                          <div className="period-field">
                            <label>Maximum Period</label>
                            <div className="period-inputs">
                              <input
                                type="number"
                                min="0"
                                value={Math.floor(rule.maxPeriod.duration / getUnitMultiplier(rule.maxPeriod.unit))}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  const duration = value * getUnitMultiplier(rule.maxPeriod!.unit);
                                  handlePeriodUpdate(priority, 'maxPeriod', { duration });
                                }}
                                disabled={readOnly}
                                className="period-value"
                              />
                              <select
                                value={rule.maxPeriod.unit}
                                onChange={(e) => {
                                  const unit = e.target.value as RetentionPeriod['unit'];
                                  const currentValue = Math.floor(rule.maxPeriod!.duration / getUnitMultiplier(rule.maxPeriod!.unit));
                                  const duration = currentValue * getUnitMultiplier(unit);
                                  handlePeriodUpdate(priority, 'maxPeriod', { unit, duration });
                                }}
                                disabled={readOnly}
                                className="period-unit"
                              >
                                <option value="hours">Hours</option>
                                <option value="days">Days</option>
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'global' && (
            <div className="global-config">
              <h3>Global Retention Settings</h3>
              <p className="section-description">
                Configure system-wide retention behavior and automation
              </p>

              <div className="config-section">
                <h4>Automatic Purging</h4>
                <div className="config-fields">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.globalSettings.enableAutomaticPurging}
                      onChange={(e) => handleConfigurationUpdate({
                        globalSettings: {
                          ...config.globalSettings,
                          enableAutomaticPurging: e.target.checked
                        }
                      })}
                      disabled={readOnly}
                    />
                    Enable Automatic Purging
                  </label>

                  <div className="field-group">
                    <label>Purge Interval (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={Math.floor(config.globalSettings.purgeInterval / (60 * 60 * 1000))}
                      onChange={(e) => {
                        const hours = parseInt(e.target.value) || 24;
                        handleConfigurationUpdate({
                          globalSettings: {
                            ...config.globalSettings,
                            purgeInterval: hours * 60 * 60 * 1000
                          }
                        });
                      }}
                      disabled={readOnly || !config.globalSettings.enableAutomaticPurging}
                      className="number-input"
                    />
                  </div>
                </div>
              </div>

              <div className="config-section">
                <h4>Grace Period</h4>
                <div className="config-fields">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.globalSettings.gracePeriodEnabled}
                      onChange={(e) => handleConfigurationUpdate({
                        globalSettings: {
                          ...config.globalSettings,
                          gracePeriodEnabled: e.target.checked
                        }
                      })}
                      disabled={readOnly}
                    />
                    Enable Grace Period
                  </label>
                  <p className="field-description">
                    When enabled, alerts get an additional grace period before permanent deletion
                  </p>
                </div>
              </div>

              <div className="config-section">
                <h4>Legal Hold Settings</h4>
                <div className="config-fields">
                  <div className="field-group">
                    <label>Maximum Legal Hold Duration (years)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={Math.floor(config.globalSettings.legalHoldMaxDuration / (365 * 24 * 60 * 60 * 1000))}
                      onChange={(e) => {
                        const years = parseInt(e.target.value) || 7;
                        handleConfigurationUpdate({
                          globalSettings: {
                            ...config.globalSettings,
                            legalHoldMaxDuration: years * 365 * 24 * 60 * 60 * 1000
                          }
                        });
                      }}
                      disabled={readOnly}
                      className="number-input"
                    />
                  </div>
                </div>
              </div>

              <div className="config-section">
                <h4>Audit Log Retention</h4>
                <div className="config-fields">
                  <div className="field-group">
                    <label>Audit Log Retention Period (years)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={Math.floor(config.globalSettings.auditLogRetention / (365 * 24 * 60 * 60 * 1000))}
                      onChange={(e) => {
                        const years = parseInt(e.target.value) || 7;
                        handleConfigurationUpdate({
                          globalSettings: {
                            ...config.globalSettings,
                            auditLogRetention: years * 365 * 24 * 60 * 60 * 1000
                          }
                        });
                      }}
                      disabled={readOnly}
                      className="number-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="compliance-config">
              <h3>GDPR Compliance Settings</h3>
              <p className="section-description">
                Configure settings for GDPR and privacy regulation compliance
              </p>

              <div className="config-section">
                <h4>Privacy Compliance</h4>
                <div className="config-fields">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.complianceSettings.gdprCompliant}
                      onChange={(e) => handleConfigurationUpdate({
                        complianceSettings: {
                          ...config.complianceSettings,
                          gdprCompliant: e.target.checked
                        }
                      })}
                      disabled={readOnly}
                    />
                    GDPR Compliant Mode
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.complianceSettings.requireExplicitConsent}
                      onChange={(e) => handleConfigurationUpdate({
                        complianceSettings: {
                          ...config.complianceSettings,
                          requireExplicitConsent: e.target.checked
                        }
                      })}
                      disabled={readOnly}
                    />
                    Require Explicit Consent for Data Processing
                  </label>
                </div>
              </div>

              <div className="config-section">
                <h4>User Rights</h4>
                <div className="config-fields">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.complianceSettings.allowUserOverride}
                      onChange={(e) => handleConfigurationUpdate({
                        complianceSettings: {
                          ...config.complianceSettings,
                          allowUserOverride: e.target.checked
                        }
                      })}
                      disabled={readOnly}
                    />
                    Allow User Override of Retention Periods
                  </label>
                  <p className="field-description">
                    Warning: Enabling this may conflict with legal and business requirements
                  </p>
                </div>
              </div>

              <div className="config-section">
                <h4>Notifications</h4>
                <div className="config-fields">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={config.complianceSettings.notifyBeforeDeletion}
                      onChange={(e) => handleConfigurationUpdate({
                        complianceSettings: {
                          ...config.complianceSettings,
                          notifyBeforeDeletion: e.target.checked
                        }
                      })}
                      disabled={readOnly}
                    />
                    Notify Before Data Deletion
                  </label>

                  <div className="field-group">
                    <label>Notification Period (days before deletion)</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={config.complianceSettings.notificationPeriod}
                      onChange={(e) => {
                        const days = parseInt(e.target.value) || 7;
                        handleConfigurationUpdate({
                          complianceSettings: {
                            ...config.complianceSettings,
                            notificationPeriod: days
                          }
                        });
                      }}
                      disabled={readOnly || !config.complianceSettings.notifyBeforeDeletion}
                      className="number-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="config-footer">
        <div className="config-info">
          <p>Configuration Version: {config.version}</p>
          <p>Last Updated: {config.lastUpdated.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

// Helper function to get unit multiplier
function getUnitMultiplier(unit: RetentionPeriod['unit']): number {
  switch (unit) {
    case 'hours': return 60 * 60 * 1000;
    case 'days': return 24 * 60 * 60 * 1000;
    case 'months': return 30 * 24 * 60 * 60 * 1000; // Approximate
    case 'years': return 365 * 24 * 60 * 60 * 1000; // Approximate
    default: return 1;
  }
}

export default RetentionConfigurationPanel;