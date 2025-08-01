/**
 * Retention Policy Configuration
 * Defines data retention periods and policies for GDPR compliance
 */

import { AlertPriority } from '../../theme/alertPriorities';

export interface RetentionPeriod {
  duration: number; // Duration in milliseconds
  unit: 'hours' | 'days' | 'months' | 'years';
  label: string;
}

export interface RetentionRule {
  priority: AlertPriority;
  defaultPeriod: RetentionPeriod;
  maxPeriod?: RetentionPeriod;
  minPeriod?: RetentionPeriod;
  legalHoldAllowed: boolean;
  gracePeriod?: RetentionPeriod; // Additional time before permanent deletion
  description: string;
}

export interface RetentionPolicyConfig {
  version: string;
  lastUpdated: Date;
  rules: Record<AlertPriority, RetentionRule>;
  globalSettings: {
    enableAutomaticPurging: boolean;
    purgeInterval: number; // in milliseconds
    gracePeriodEnabled: boolean;
    legalHoldMaxDuration: number; // maximum legal hold duration in milliseconds
    auditLogRetention: number; // how long to keep deletion audit logs
  };
  complianceSettings: {
    gdprCompliant: boolean;
    requireExplicitConsent: boolean;
    allowUserOverride: boolean;
    notifyBeforeDeletion: boolean;
    notificationPeriod: number; // days before deletion to notify
  };
}

/**
 * Default GDPR-compliant retention policy
 */
export const DEFAULT_RETENTION_POLICY: RetentionPolicyConfig = {
  version: '1.0.0',
  lastUpdated: new Date(),
  rules: {
    critical: {
      priority: 'critical',
      defaultPeriod: {
        duration: 365 * 24 * 60 * 60 * 1000, // 1 year
        unit: 'years',
        label: '1 Year'
      },
      maxPeriod: {
        duration: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
        unit: 'years',
        label: '7 Years'
      },
      minPeriod: {
        duration: 90 * 24 * 60 * 60 * 1000, // 90 days
        unit: 'days',
        label: '90 Days'
      },
      legalHoldAllowed: true,
      gracePeriod: {
        duration: 30 * 24 * 60 * 60 * 1000, // 30 days
        unit: 'days',
        label: '30 Days'
      },
      description: 'Critical alerts may require extended retention for safety and compliance purposes'
    },
    high: {
      priority: 'high',
      defaultPeriod: {
        duration: 180 * 24 * 60 * 60 * 1000, // 6 months
        unit: 'months',
        label: '6 Months'
      },
      maxPeriod: {
        duration: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
        unit: 'years',
        label: '2 Years'
      },
      minPeriod: {
        duration: 30 * 24 * 60 * 60 * 1000, // 30 days
        unit: 'days',
        label: '30 Days'
      },
      legalHoldAllowed: true,
      gracePeriod: {
        duration: 14 * 24 * 60 * 60 * 1000, // 14 days
        unit: 'days',
        label: '14 Days'
      },
      description: 'High priority alerts with moderate retention period'
    },
    medium: {
      priority: 'medium',
      defaultPeriod: {
        duration: 90 * 24 * 60 * 60 * 1000, // 3 months
        unit: 'months',
        label: '3 Months'
      },
      maxPeriod: {
        duration: 365 * 24 * 60 * 60 * 1000, // 1 year
        unit: 'years',
        label: '1 Year'
      },
      minPeriod: {
        duration: 7 * 24 * 60 * 60 * 1000, // 7 days
        unit: 'days',
        label: '7 Days'
      },
      legalHoldAllowed: false,
      gracePeriod: {
        duration: 7 * 24 * 60 * 60 * 1000, // 7 days
        unit: 'days',
        label: '7 Days'
      },
      description: 'Medium priority alerts with standard retention period'
    },
    low: {
      priority: 'low',
      defaultPeriod: {
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month
        unit: 'months',
        label: '1 Month'
      },
      maxPeriod: {
        duration: 90 * 24 * 60 * 60 * 1000, // 3 months
        unit: 'months',
        label: '3 Months'
      },
      minPeriod: {
        duration: 24 * 60 * 60 * 1000, // 1 day
        unit: 'days',
        label: '1 Day'
      },
      legalHoldAllowed: false,
      gracePeriod: {
        duration: 3 * 24 * 60 * 60 * 1000, // 3 days
        unit: 'days',
        label: '3 Days'
      },
      description: 'Low priority alerts with short retention period'
    },
    info: {
      priority: 'info',
      defaultPeriod: {
        duration: 7 * 24 * 60 * 60 * 1000, // 1 week
        unit: 'days',
        label: '1 Week'
      },
      maxPeriod: {
        duration: 30 * 24 * 60 * 60 * 1000, // 1 month
        unit: 'months',
        label: '1 Month'
      },
      minPeriod: {
        duration: 0, // Can be deleted immediately
        unit: 'hours',
        label: 'Immediate'
      },
      legalHoldAllowed: false,
      description: 'Informational alerts with minimal retention period'
    }
  },
  globalSettings: {
    enableAutomaticPurging: true,
    purgeInterval: 24 * 60 * 60 * 1000, // 24 hours
    gracePeriodEnabled: true,
    legalHoldMaxDuration: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
    auditLogRetention: 7 * 365 * 24 * 60 * 60 * 1000 // 7 years
  },
  complianceSettings: {
    gdprCompliant: true,
    requireExplicitConsent: true,
    allowUserOverride: false, // Administrators only
    notifyBeforeDeletion: true,
    notificationPeriod: 7 // 7 days before deletion
  }
};

/**
 * Retention Policy Management Class
 */
export class RetentionPolicy {
  private config: RetentionPolicyConfig;
  private customPolicies: Map<string, RetentionPolicyConfig> = new Map();

  constructor(config: RetentionPolicyConfig = DEFAULT_RETENTION_POLICY) {
    this.config = { ...config };
    this.loadCustomPolicies();
  }

  /**
   * Get retention period for a specific alert priority
   */
  getRetentionPeriod(priority: AlertPriority, customPolicyId?: string): RetentionPeriod {
    const policy = customPolicyId ? this.customPolicies.get(customPolicyId) : this.config;
    if (!policy) {
      throw new Error(`Policy not found: ${customPolicyId}`);
    }

    const rule = policy.rules[priority];
    if (!rule) {
      throw new Error(`No retention rule found for priority: ${priority}`);
    }

    return rule.defaultPeriod;
  }

  /**
   * Calculate expiration date for an alert
   */
  calculateExpirationDate(
    creationDate: Date,
    priority: AlertPriority,
    customPolicyId?: string,
    overridePeriod?: RetentionPeriod
  ): Date {
    const period = overridePeriod || this.getRetentionPeriod(priority, customPolicyId);
    return new Date(creationDate.getTime() + period.duration);
  }

  /**
   * Calculate grace period end date
   */
  calculateGracePeriodEnd(
    expirationDate: Date,
    priority: AlertPriority,
    customPolicyId?: string
  ): Date | null {
    const policy = customPolicyId ? this.customPolicies.get(customPolicyId) : this.config;
    if (!policy || !policy.globalSettings.gracePeriodEnabled) {
      return null;
    }

    const rule = policy.rules[priority];
    if (!rule.gracePeriod) {
      return null;
    }

    return new Date(expirationDate.getTime() + rule.gracePeriod.duration);
  }

  /**
   * Check if an alert can be placed on legal hold
   */
  canPlaceLegalHold(priority: AlertPriority, customPolicyId?: string): boolean {
    const policy = customPolicyId ? this.customPolicies.get(customPolicyId) : this.config;
    if (!policy) return false;

    const rule = policy.rules[priority];
    return rule ? rule.legalHoldAllowed : false;
  }

  /**
   * Validate a custom retention period against policy constraints
   */
  validateRetentionPeriod(
    priority: AlertPriority,
    period: RetentionPeriod,
    customPolicyId?: string
  ): { valid: boolean; reason?: string } {
    const policy = customPolicyId ? this.customPolicies.get(customPolicyId) : this.config;
    if (!policy) {
      return { valid: false, reason: 'Policy not found' };
    }

    const rule = policy.rules[priority];
    if (!rule) {
      return { valid: false, reason: 'No rule found for priority' };
    }

    // Check minimum period
    if (rule.minPeriod && period.duration < rule.minPeriod.duration) {
      return {
        valid: false,
        reason: `Period is below minimum of ${rule.minPeriod.label}`
      };
    }

    // Check maximum period
    if (rule.maxPeriod && period.duration > rule.maxPeriod.duration) {
      return {
        valid: false,
        reason: `Period exceeds maximum of ${rule.maxPeriod.label}`
      };
    }

    return { valid: true };
  }

  /**
   * Get all available retention policies
   */
  getAvailablePolicies(): Array<{ id: string; name: string; description: string }> {
    const policies = [
      {
        id: 'default',
        name: 'Default GDPR Policy',
        description: 'Standard GDPR-compliant retention policy'
      }
    ];

    this.customPolicies.forEach((policy, id) => {
      policies.push({
        id,
        name: `Custom Policy ${id}`,
        description: `Custom retention policy version ${policy.version}`
      });
    });

    return policies;
  }

  /**
   * Create or update a custom retention policy
   */
  setCustomPolicy(id: string, config: RetentionPolicyConfig): void {
    // Validate the policy configuration
    this.validatePolicyConfig(config);
    
    // Store the custom policy
    this.customPolicies.set(id, { ...config });
    this.saveCustomPolicies();
  }

  /**
   * Remove a custom retention policy
   */
  removeCustomPolicy(id: string): boolean {
    const removed = this.customPolicies.delete(id);
    if (removed) {
      this.saveCustomPolicies();
    }
    return removed;
  }

  /**
   * Get current policy configuration
   */
  getCurrentPolicy(customPolicyId?: string): RetentionPolicyConfig {
    if (customPolicyId) {
      const policy = this.customPolicies.get(customPolicyId);
      if (!policy) {
        throw new Error(`Custom policy not found: ${customPolicyId}`);
      }
      return policy;
    }
    return this.config;
  }

  /**
   * Update the default policy configuration
   */
  updateDefaultPolicy(updates: Partial<RetentionPolicyConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      lastUpdated: new Date()
    };
    this.saveDefaultPolicy();
  }

  /**
   * Validate policy configuration
   */
  private validatePolicyConfig(config: RetentionPolicyConfig): void {
    // Check required fields
    if (!config.version || !config.rules) {
      throw new Error('Invalid policy configuration: missing required fields');
    }

    // Validate each priority rule
    const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
    for (const priority of priorities) {
      const rule = config.rules[priority];
      if (!rule) {
        throw new Error(`Missing retention rule for priority: ${priority}`);
      }

      // Validate periods
      if (rule.minPeriod && rule.maxPeriod && 
          rule.minPeriod.duration > rule.maxPeriod.duration) {
        throw new Error(`Invalid period range for ${priority}: min > max`);
      }

      if (rule.defaultPeriod.duration < 0) {
        throw new Error(`Invalid default period for ${priority}: negative duration`);
      }
    }

    // Validate global settings
    if (config.globalSettings.purgeInterval <= 0) {
      throw new Error('Invalid purge interval: must be positive');
    }

    if (config.globalSettings.legalHoldMaxDuration <= 0) {
      throw new Error('Invalid legal hold max duration: must be positive');
    }
  }

  /**
   * Load custom policies from localStorage
   */
  private loadCustomPolicies(): void {
    try {
      const stored = localStorage.getItem('rover-retention-policies');
      if (stored) {
        const policies = JSON.parse(stored);
        this.customPolicies = new Map(Object.entries(policies));
      }
    } catch (error) {
      console.error('Failed to load custom retention policies:', error);
    }
  }

  /**
   * Save custom policies to localStorage
   */
  private saveCustomPolicies(): void {
    try {
      const policies = Object.fromEntries(this.customPolicies);
      localStorage.setItem('rover-retention-policies', JSON.stringify(policies));
    } catch (error) {
      console.error('Failed to save custom retention policies:', error);
    }
  }

  /**
   * Save default policy to localStorage
   */
  private saveDefaultPolicy(): void {
    try {
      localStorage.setItem('rover-default-retention-policy', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save default retention policy:', error);
    }
  }

  /**
   * Convert duration to human-readable string
   */
  static formatDuration(period: RetentionPeriod): string {
    const value = Math.floor(period.duration / this.getUnitMultiplier(period.unit));
    return `${value} ${period.unit}${value !== 1 ? 's' : ''}`;
  }

  /**
   * Get multiplier for time units
   */
  private static getUnitMultiplier(unit: RetentionPeriod['unit']): number {
    switch (unit) {
      case 'hours': return 60 * 60 * 1000;
      case 'days': return 24 * 60 * 60 * 1000;
      case 'months': return 30 * 24 * 60 * 60 * 1000; // Approximate
      case 'years': return 365 * 24 * 60 * 60 * 1000; // Approximate
      default: return 1;
    }
  }
}

// Singleton instance
export const retentionPolicy = new RetentionPolicy();