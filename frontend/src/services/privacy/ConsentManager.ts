/**
 * Consent Management Service
 * Handles user consent for data collection and privacy preferences according to GDPR requirements
 */

import Dexie, { Table } from 'dexie';

export interface ConsentPreference {
  id: string;
  category: ConsentCategory;
  granted: boolean;
  timestamp: Date;
  version: string; // Privacy policy version when consent was given
  source: 'initial' | 'update' | 'renewal' | 'withdrawal' | 'contextual' | 'periodic_review';
  metadata?: Record<string, any>;
  ipAddress?: string; // For audit purposes (if legally required)
  userAgent?: string; // For audit purposes
  reasonForChange?: string; // User-provided reason for consent change
}

export interface ConsentRecord {
  userId: string;
  deviceId: string;
  sessionId: string;
  preferences: ConsentPreference[];
  lastUpdated: Date;
  policyVersion: string;
  lastReviewDate?: Date; // Last time user reviewed consent settings
  nextReviewDate?: Date; // When user should next review consent
  reviewFrequency: number; // Days between reviews (default: 180)
  ipAddress?: string; // For audit purposes (if legally required)
  userAgent?: string; // For audit purposes
}

export type ConsentCategory = 
  | 'alerts_storage'              // Storing alert data locally and remotely
  | 'alerts_critical'             // Critical system alerts (separate from general)
  | 'alerts_warnings'             // Warning level alerts
  | 'alerts_info'                 // Informational alerts
  | 'alert_acknowledgment'        // Recording alert acknowledgments
  | 'alert_response_times'        // Track user response times to alerts
  | 'alert_patterns'              // Analyze alert patterns and trends
  | 'usage_analytics'             // Collecting usage statistics
  | 'usage_feature_tracking'      // Track which features are used
  | 'usage_error_reporting'       // Report application errors
  | 'performance_monitoring'      // Performance and error monitoring
  | 'performance_detailed'        // Detailed performance metrics
  | 'user_preferences'            // Storing user interface preferences
  | 'user_customization'          // User interface customizations
  | 'session_data'               // Storing session information
  | 'session_analytics'          // Session duration and patterns
  | 'diagnostic_data'            // Technical diagnostic information
  | 'diagnostic_crash_reports'   // Automatic crash report submission
  | 'cross_device_sync'          // Synchronizing data across devices
  | 'location_telemetry'         // Rover location and movement data
  | 'camera_telemetry'           // Camera usage and settings
  | 'sensor_telemetry';          // Sensor data collection

export interface ConsentConfiguration {
  category: ConsentCategory;
  name: string;
  description: string;
  detailedDescription: string; // More comprehensive explanation
  required: boolean; // Whether this is essential for app functionality
  defaultValue: boolean;
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
  dataRetentionDays?: number; // -1 for indefinite, 0 for session only
  thirdParties?: string[]; // List of third parties that may access this data
  dataTypes: string[]; // Types of data collected for this category
  purposes: string[]; // Specific purposes for data collection
  consequences?: string; // What happens if consent is not given
  benefits?: string; // Benefits to user if consent is given
  sensitive: boolean; // Whether this involves sensitive personal data
  childSafe: boolean; // Whether this is appropriate for users under 18
  grouping: 'essential' | 'functional' | 'analytics' | 'marketing' | 'telemetry';
}

export interface ConsentVersioning {
  id: string;
  version: string;
  effectiveDate: Date;
  changes: string[];
  requiresNewConsent: boolean;
  notificationSent: boolean;
  userNotified?: Date;
}

export interface ConsentReviewSchedule {
  id: string;
  userId: string;
  scheduledDate: Date;
  completed: boolean;
  completedDate?: Date;
  reviewType: 'periodic' | 'policy_update' | 'user_initiated';
  remindersSent: number;
  lastReminderDate?: Date;
}

class ConsentDatabase extends Dexie {
  consents!: Table<ConsentRecord>;
  consentHistory!: Table<ConsentPreference>;
  consentVersions!: Table<ConsentVersioning>;
  reviewSchedules!: Table<ConsentReviewSchedule>;

  constructor() {
    super('ConsentManagementDB');
    
    this.version(2).stores({
      consents: '++userId, deviceId, lastUpdated, policyVersion, nextReviewDate',
      consentHistory: '++id, category, timestamp, granted, version, source',
      consentVersions: '++id, version, effectiveDate, requiresNewConsent',
      reviewSchedules: '++id, userId, scheduledDate, completed, reviewType'
    });

    // Add hooks for automatic timestamp updates
    this.consents.hook('creating', (primKey, obj, trans) => {
      obj.lastUpdated = obj.lastUpdated || new Date();
      obj.reviewFrequency = obj.reviewFrequency || 180; // 6 months default
      if (!obj.nextReviewDate) {
        obj.nextReviewDate = new Date(Date.now() + (obj.reviewFrequency * 24 * 60 * 60 * 1000));
      }
    });

    this.consents.hook('updating', (modifications, primKey, obj, trans) => {
      modifications.lastUpdated = new Date();
    });
  }
}

export class ConsentManager {
  private db: ConsentDatabase;
  private currentUserId: string;
  private currentDeviceId: string;
  private currentSessionId: string;
  private currentPolicyVersion: string = '1.0.0';
  
  // Enhanced consent configuration with granular GDPR-compliant categories
  private consentConfigurations: ConsentConfiguration[] = [
    // Essential/Required Categories
    {
      category: 'alert_acknowledgment',
      name: 'Critical Alert Acknowledgment',
      description: 'Record when you acknowledge critical system alerts.',
      detailedDescription: 'We are legally required to track acknowledgment of critical safety alerts to ensure mission compliance and operator accountability. This includes timestamps, user identity, and response actions.',
      required: true,
      defaultValue: true,
      legalBasis: 'legal_obligation',
      dataRetentionDays: 2555, // 7 years for compliance
      thirdParties: [],
      dataTypes: ['Timestamp', 'User ID', 'Alert ID', 'Response action'],
      purposes: ['Safety compliance', 'Audit trail', 'Legal requirement'],
      consequences: 'Application cannot function safely without alert acknowledgment tracking.',
      benefits: 'Ensures proper safety protocols and legal compliance.',
      sensitive: false,
      childSafe: true,
      grouping: 'essential'
    },
    {
      category: 'session_data',
      name: 'Session Management',
      description: 'Maintain your current session state and login status.',
      detailedDescription: 'Temporary data needed to keep you logged in and maintain your current view state, including authentication tokens, current page, and temporary settings.',
      required: true,
      defaultValue: true,
      legalBasis: 'contract',
      dataRetentionDays: 0, // Session only
      thirdParties: [],
      dataTypes: ['Session token', 'Current page', 'Temporary preferences'],
      purposes: ['User authentication', 'Application state'],
      consequences: 'Application will not function without session management.',
      benefits: 'Seamless user experience with proper authentication.',
      sensitive: false,
      childSafe: true,
      grouping: 'essential'
    },
    
    // Alert Data Categories
    {
      category: 'alerts_storage',
      name: 'General Alert History',
      description: 'Store your non-critical alert history and preferences.',
      detailedDescription: 'Save informational and warning alerts to help you track system status over time. This includes alert content, timestamps, and your interaction history with non-critical notifications.',
      required: false,
      defaultValue: true,
      legalBasis: 'consent',
      dataRetentionDays: 30,
      thirdParties: [],
      dataTypes: ['Alert content', 'Timestamps', 'User interactions', 'Alert preferences'],
      purposes: ['Historical tracking', 'Pattern analysis', 'User experience'],
      benefits: 'Better awareness of system patterns and personalized alert management.',
      sensitive: false,
      childSafe: true,
      grouping: 'functional'
    },
    {
      category: 'alerts_critical',
      name: 'Critical Alert Details',
      description: 'Enhanced logging for critical system alerts.',
      detailedDescription: 'Detailed logging of critical alerts including system context, user response times, and resolution actions to improve emergency response procedures.',
      required: false,
      defaultValue: true,
      legalBasis: 'legitimate_interest',
      dataRetentionDays: 365,
      thirdParties: [],
      dataTypes: ['System context', 'Response times', 'Resolution actions', 'Environmental data'],
      purposes: ['Emergency response improvement', 'Safety analysis', 'System optimization'],
      benefits: 'Improved emergency response and system safety.',
      sensitive: false,
      childSafe: true,
      grouping: 'functional'
    },
    {
      category: 'alert_response_times',
      name: 'Alert Response Analytics',
      description: 'Track how quickly you respond to different types of alerts.',
      detailedDescription: 'Analyze your response patterns to different alert types to optimize alert presentation and identify training opportunities. Includes response times, success rates, and interaction patterns.',
      required: false,
      defaultValue: false,
      legalBasis: 'consent',
      dataRetentionDays: 90,
      thirdParties: [],
      dataTypes: ['Response times', 'Alert types', 'Success rates', 'Interaction patterns'],
      purposes: ['Performance optimization', 'Training insights', 'Alert effectiveness'],
      benefits: 'Personalized alert timing and improved response efficiency.',
      sensitive: false,
      childSafe: true,
      grouping: 'analytics'
    },
    
    // Telemetry Categories
    {
      category: 'location_telemetry',
      name: 'Rover Location Data',
      description: 'Collect rover position and movement telemetry.',
      detailedDescription: 'Track rover position, movement patterns, and navigation data to improve autonomous operations and provide accurate mission status. Includes GPS coordinates, speed, heading, and path history.',
      required: false,
      defaultValue: true,
      legalBasis: 'consent',
      dataRetentionDays: 30,
      thirdParties: [],
      dataTypes: ['GPS coordinates', 'Speed', 'Heading', 'Path history', 'Waypoints'],
      purposes: ['Mission tracking', 'Navigation improvement', 'Performance analysis'],
      benefits: 'Better mission tracking and improved autonomous navigation.',
      sensitive: false,
      childSafe: true,
      grouping: 'telemetry'
    },
    {
      category: 'sensor_telemetry',
      name: 'Sensor Data Collection',
      description: 'Collect data from rover sensors for analysis.',
      detailedDescription: 'Gather data from various rover sensors including environmental sensors, cameras, and mechanical systems to improve performance and detect issues early.',
      required: false,
      defaultValue: true,
      legalBasis: 'consent',
      dataRetentionDays: 30,
      thirdParties: [],
      dataTypes: ['Environmental readings', 'System status', 'Sensor health', 'Calibration data'],
      purposes: ['Performance monitoring', 'Predictive maintenance', 'Environmental analysis'],
      benefits: 'Proactive maintenance and improved system reliability.',
      sensitive: false,
      childSafe: true,
      grouping: 'telemetry'
    },
    
    // User Experience Categories
    {
      category: 'user_preferences',
      name: 'Interface Preferences',
      description: 'Store your personal interface settings and preferences.',
      detailedDescription: 'Save your theme selection, layout preferences, notification settings, and other interface customizations to provide a consistent experience across sessions.',
      required: false,
      defaultValue: true,
      legalBasis: 'consent',
      dataRetentionDays: -1, // Indefinite
      thirdParties: [],
      dataTypes: ['Theme settings', 'Layout preferences', 'Notification settings', 'Language choice'],
      purposes: ['Personalization', 'User experience', 'Accessibility'],
      benefits: 'Consistent, personalized interface across all sessions.',
      sensitive: false,
      childSafe: true,
      grouping: 'functional'
    },
    {
      category: 'usage_analytics',
      name: 'Application Usage Statistics',
      description: 'Anonymous statistics about how you use the application.',
      detailedDescription: 'Collect anonymized data about which features you use, how often, and in what patterns to improve the application design and identify popular features.',
      required: false,
      defaultValue: false,
      legalBasis: 'consent',
      dataRetentionDays: 365,
      thirdParties: ['Analytics Provider'],
      dataTypes: ['Feature usage', 'Session duration', 'Click patterns', 'Navigation paths'],
      purposes: ['Product improvement', 'Feature development', 'User experience research'],
      benefits: 'Improved application features and better user experience.',
      sensitive: false,
      childSafe: true,
      grouping: 'analytics'
    },
    
    // Technical Categories
    {
      category: 'performance_monitoring',
      name: 'Performance Monitoring',
      description: 'Monitor application performance and system health.',
      detailedDescription: 'Track application response times, memory usage, and system performance to identify and resolve issues quickly. Includes error logs and performance metrics.',
      required: false,
      defaultValue: true,
      legalBasis: 'legitimate_interest',
      dataRetentionDays: 90,
      thirdParties: [],
      dataTypes: ['Response times', 'Memory usage', 'Error logs', 'System metrics'],
      purposes: ['Issue resolution', 'Performance optimization', 'System stability'],
      benefits: 'Faster issue resolution and better application performance.',
      sensitive: false,
      childSafe: true,
      grouping: 'functional'
    },
    {
      category: 'diagnostic_crash_reports',
      name: 'Automatic Crash Reporting',
      description: 'Automatically send crash reports when errors occur.',
      detailedDescription: 'Automatically collect and send detailed crash reports including stack traces, system state, and error context to help developers fix bugs quickly.',
      required: false,
      defaultValue: false,
      legalBasis: 'consent',
      dataRetentionDays: 30,
      thirdParties: ['Error Reporting Service'],
      dataTypes: ['Stack traces', 'System state', 'Error context', 'User actions'],
      purposes: ['Bug fixing', 'Stability improvement', 'Error prevention'],
      benefits: 'Faster bug fixes and improved application stability.',
      sensitive: false,
      childSafe: true,
      grouping: 'analytics'
    },
    {
      category: 'cross_device_sync',
      name: 'Cross-Device Synchronization',
      description: 'Sync your data and settings across multiple devices.',
      detailedDescription: 'Synchronize your preferences, alert history, and settings across all your devices for a seamless experience. Data is encrypted and stored securely.',
      required: false,
      defaultValue: false,
      legalBasis: 'consent',
      dataRetentionDays: 90,
      thirdParties: ['Cloud Sync Provider'],
      dataTypes: ['User preferences', 'Alert history', 'Settings', 'Device information'],
      purposes: ['Data synchronization', 'Multi-device experience', 'Backup'],
      benefits: 'Seamless experience across all your devices.',
      sensitive: false,
      childSafe: true,
      grouping: 'functional'
    }
  ];

  constructor(userId: string = 'anonymous', deviceId?: string, sessionId?: string) {
    this.db = new ConsentDatabase();
    this.currentUserId = userId;
    this.currentDeviceId = deviceId || this.generateDeviceId();
    this.currentSessionId = sessionId || this.generateSessionId();
  }

  /**
   * Initialize the consent manager
   */
  async initialize(): Promise<void> {
    try {
      await this.db.open();
      console.log('Consent Manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Consent Manager:', error);
      throw error;
    }
  }

  /**
   * Check if user has provided consent for a specific category
   */
  async hasConsent(category: ConsentCategory): Promise<boolean> {
    try {
      const record = await this.getCurrentConsentRecord();
      if (!record) {
        // Return default value for new users
        const config = this.getConsentConfiguration(category);
        return config?.defaultValue ?? false;
      }

      const preference = record.preferences.find(p => p.category === category);
      if (!preference) {
        // Return default value if no explicit preference exists
        const config = this.getConsentConfiguration(category);
        return config?.defaultValue ?? false;
      }

      return preference.granted;
    } catch (error) {
      console.error('Failed to check consent:', error);
      // Fail safe: return false for non-required categories
      const config = this.getConsentConfiguration(category);
      return config?.required ?? false;
    }
  }

  /**
   * Update consent for a specific category
   */
  async updateConsent(
    category: ConsentCategory, 
    granted: boolean, 
    source: ConsentPreference['source'] = 'update',
    reasonForChange?: string
  ): Promise<void> {
    try {
      const now = new Date();
      const preference: ConsentPreference = {
        id: this.generateId(),
        category,
        granted,
        timestamp: now,
        version: this.currentPolicyVersion,
        source,
        reasonForChange,
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent
      };

      // Add to history
      await this.db.consentHistory.add(preference);

      // Update current record
      const record = await this.getCurrentConsentRecord();
      if (record) {
        // Update existing record
        const existingIndex = record.preferences.findIndex(p => p.category === category);
        if (existingIndex >= 0) {
          record.preferences[existingIndex] = preference;
        } else {
          record.preferences.push(preference);
        }
        record.lastUpdated = now;
        await this.db.consents.put(record);
      } else {
        // Create new record
        const newRecord: ConsentRecord = {
          userId: this.currentUserId,
          deviceId: this.currentDeviceId,
          sessionId: this.currentSessionId,
          preferences: [preference],
          lastUpdated: now,
          policyVersion: this.currentPolicyVersion,
          userAgent: navigator.userAgent
        };
        await this.db.consents.add(newRecord);
      }

      console.log(`Consent updated for ${category}: ${granted}`);
    } catch (error) {
      console.error('Failed to update consent:', error);
      throw error;
    }
  }

  /**
   * Update multiple consent preferences at once
   */
  async updateMultipleConsents(
    consents: Array<{ category: ConsentCategory; granted: boolean; reasonForChange?: string }>,
    source: ConsentPreference['source'] = 'update'
  ): Promise<void> {
    try {
      await this.db.transaction('rw', [this.db.consents, this.db.consentHistory], async () => {
        for (const consent of consents) {
          await this.updateConsent(consent.category, consent.granted, source, consent.reasonForChange);
        }
      });
    } catch (error) {
      console.error('Failed to update multiple consents:', error);
      throw error;
    }
  }

  /**
   * Get current consent record for the user
   */
  async getCurrentConsentRecord(): Promise<ConsentRecord | undefined> {
    try {
      return await this.db.consents
        .where('userId')
        .equals(this.currentUserId)
        .and(record => record.deviceId === this.currentDeviceId)
        .first();
    } catch (error) {
      console.error('Failed to get current consent record:', error);
      return undefined;
    }
  }

  /**
   * Get all consent preferences for the current user
   */
  async getAllConsents(): Promise<Record<ConsentCategory, boolean>> {
    try {
      const record = await this.getCurrentConsentRecord();
      const consents: Partial<Record<ConsentCategory, boolean>> = {};

      // Initialize with default values
      for (const config of this.consentConfigurations) {
        consents[config.category] = config.defaultValue;
      }

      // Override with actual preferences
      if (record) {
        for (const preference of record.preferences) {
          consents[preference.category] = preference.granted;
        }
      }

      return consents as Record<ConsentCategory, boolean>;
    } catch (error) {
      console.error('Failed to get all consents:', error);
      // Return default values
      const defaults: Partial<Record<ConsentCategory, boolean>> = {};
      for (const config of this.consentConfigurations) {
        defaults[config.category] = config.defaultValue;
      }
      return defaults as Record<ConsentCategory, boolean>;
    }
  }

  /**
   * Check if user needs to provide initial consent
   */
  async needsInitialConsent(): Promise<boolean> {
    try {
      const record = await this.getCurrentConsentRecord();
      return !record || record.policyVersion !== this.currentPolicyVersion;
    } catch (error) {
      console.error('Failed to check initial consent need:', error);
      return true; // Err on the side of showing consent
    }
  }

  /**
   * Get consent history for audit purposes
   */
  async getConsentHistory(category?: ConsentCategory): Promise<ConsentPreference[]> {
    try {
      let query = this.db.consentHistory.orderBy('timestamp').reverse();
      
      if (category) {
        query = query.filter(p => p.category === category);
      }

      return await query.toArray();
    } catch (error) {
      console.error('Failed to get consent history:', error);
      return [];
    }
  }

  /**
   * Withdraw all consent (right to erasure preparation)
   */
  async withdrawAllConsent(): Promise<void> {
    try {
      const nonRequiredCategories = this.consentConfigurations
        .filter(config => !config.required)
        .map(config => config.category);

      const withdrawals = nonRequiredCategories.map(category => ({
        category,
        granted: false
      }));

      await this.updateMultipleConsents(withdrawals, 'withdrawal');
      console.log('All non-required consents withdrawn');
    } catch (error) {
      console.error('Failed to withdraw all consent:', error);
      throw error;
    }
  }

  /**
   * Export consent data for user (GDPR data portability)
   */
  async exportConsentData(): Promise<{
    currentConsents: Record<ConsentCategory, boolean>;
    consentHistory: ConsentPreference[];
    metadata: {
      userId: string;
      deviceId: string;
      exportTimestamp: Date;
      policyVersion: string;
    };
  }> {
    try {
      const [currentConsents, history] = await Promise.all([
        this.getAllConsents(),
        this.getConsentHistory()
      ]);

      return {
        currentConsents,
        consentHistory: history,
        metadata: {
          userId: this.currentUserId,
          deviceId: this.currentDeviceId,
          exportTimestamp: new Date(),
          policyVersion: this.currentPolicyVersion
        }
      };
    } catch (error) {
      console.error('Failed to export consent data:', error);
      throw error;
    }
  }

  /**
   * Delete all consent data (right to erasure)
   */
  async deleteAllConsentData(): Promise<void> {
    try {
      await this.db.transaction('rw', [this.db.consents, this.db.consentHistory], async () => {
        // Delete consent records
        await this.db.consents.where('userId').equals(this.currentUserId).delete();
        
        // Delete consent history
        await this.db.consentHistory.toCollection().delete();
      });

      console.log('All consent data deleted');
    } catch (error) {
      console.error('Failed to delete consent data:', error);
      throw error;
    }
  }

  /**
   * Get consent configuration for a category
   */
  getConsentConfiguration(category: ConsentCategory): ConsentConfiguration | undefined {
    return this.consentConfigurations.find(config => config.category === category);
  }

  /**
   * Get all consent configurations
   */
  getAllConsentConfigurations(): ConsentConfiguration[] {
    return [...this.consentConfigurations];
  }

  /**
   * Get consent history with detailed filtering and pagination
   */
  async getConsentHistoryPaginated(
    category?: ConsentCategory,
    limit: number = 50,
    offset: number = 0,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{items: ConsentPreference[], total: number}> {
    try {
      let query = this.db.consentHistory.orderBy('timestamp').reverse();
      
      if (category) {
        query = query.filter(p => p.category === category);
      }
      
      if (dateFrom || dateTo) {
        query = query.filter((p: ConsentPreference) => {
          const timestamp = new Date(p.timestamp);
          if (dateFrom && timestamp < dateFrom) return false;
          if (dateTo && timestamp > dateTo) return false;
          return true;
        });
      }

      const total = await query.count();
      const items = await query.offset(offset).limit(limit).toArray();
      
      return { items, total };
    } catch (error) {
      console.error('Failed to get paginated consent history:', error);
      return { items: [], total: 0 };
    }
  }

  /**
   * Get consent statistics for analytics
   */
  async getConsentStatistics(): Promise<{
    totalChanges: number;
    categoriesWithConsent: number;
    categoriesWithoutConsent: number;
    lastChanged: Date | null;
    mostChangedCategory: ConsentCategory | null;
    changesBySource: Record<ConsentPreference['source'], number>;
  }> {
    try {
      const [history, currentConsents] = await Promise.all([
        this.getConsentHistory(),
        this.getAllConsents()
      ]);

      const totalChanges = history.length;
      const categoriesWithConsent = Object.values(currentConsents).filter(Boolean).length;
      const categoriesWithoutConsent = Object.values(currentConsents).filter(v => !v).length;
      const lastChanged = history.length > 0 ? history[0].timestamp : null;
      
      // Find most changed category
      const categoryChanges = history.reduce((acc, pref) => {
        acc[pref.category] = (acc[pref.category] || 0) + 1;
        return acc;
      }, {} as Record<ConsentCategory, number>);
      
      const mostChangedCategory = Object.entries(categoryChanges)
        .sort(([,a], [,b]) => b - a)[0]?.[0] as ConsentCategory || null;
      
      // Changes by source
      const changesBySource = history.reduce((acc, pref) => {
        acc[pref.source] = (acc[pref.source] || 0) + 1;
        return acc;
      }, {} as Record<ConsentPreference['source'], number>);

      return {
        totalChanges,
        categoriesWithConsent,
        categoriesWithoutConsent,
        lastChanged,
        mostChangedCategory,
        changesBySource
      };
    } catch (error) {
      console.error('Failed to get consent statistics:', error);
      return {
        totalChanges: 0,
        categoriesWithConsent: 0,
        categoriesWithoutConsent: 0,
        lastChanged: null,
        mostChangedCategory: null,
        changesBySource: {} as Record<ConsentPreference['source'], number>
      };
    }
  }

  /**
   * Schedule periodic consent review
   */
  async scheduleConsentReview(
    reviewType: 'periodic' | 'policy_update' | 'user_initiated' = 'periodic',
    daysFromNow: number = 180
  ): Promise<void> {
    try {
      const scheduledDate = new Date(Date.now() + (daysFromNow * 24 * 60 * 60 * 1000));
      
      const schedule: ConsentReviewSchedule = {
        id: this.generateId(),
        userId: this.currentUserId,
        scheduledDate,
        completed: false,
        reviewType,
        remindersSent: 0
      };

      await this.db.reviewSchedules.add(schedule);
      
      // Update next review date in consent record
      const record = await this.getCurrentConsentRecord();
      if (record) {
        record.nextReviewDate = scheduledDate;
        await this.db.consents.put(record);
      }
      
      console.log(`Consent review scheduled for ${scheduledDate.toISOString()}`);
    } catch (error) {
      console.error('Failed to schedule consent review:', error);
      throw error;
    }
  }

  /**
   * Check if consent review is due
   */
  async isConsentReviewDue(): Promise<{
    isDue: boolean;
    daysOverdue: number;
    scheduledDate: Date | null;
    reviewType: 'periodic' | 'policy_update' | 'user_initiated' | null;
  }> {
    try {
      const record = await this.getCurrentConsentRecord();
      if (!record?.nextReviewDate) {
        return { isDue: false, daysOverdue: 0, scheduledDate: null, reviewType: null };
      }

      const now = new Date();
      const scheduledDate = new Date(record.nextReviewDate);
      const isDue = now >= scheduledDate;
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - scheduledDate.getTime()) / (24 * 60 * 60 * 1000)));
      
      // Find the review schedule to get type
      const schedule = await this.db.reviewSchedules
        .where('userId').equals(this.currentUserId)
        .and(s => !s.completed && s.scheduledDate <= now)
        .first();
      
      return {
        isDue,
        daysOverdue,
        scheduledDate,
        reviewType: schedule?.reviewType || null
      };
    } catch (error) {
      console.error('Failed to check consent review due:', error);
      return { isDue: false, daysOverdue: 0, scheduledDate: null, reviewType: null };
    }
  }

  /**
   * Complete consent review
   */
  async completeConsentReview(): Promise<void> {
    try {
      const now = new Date();
      
      // Mark all pending reviews as completed
      const pendingReviews = await this.db.reviewSchedules
        .where('userId').equals(this.currentUserId)
        .and(s => !s.completed)
        .toArray();
      
      for (const review of pendingReviews) {
        review.completed = true;
        review.completedDate = now;
        await this.db.reviewSchedules.put(review);
      }
      
      // Update consent record
      const record = await this.getCurrentConsentRecord();
      if (record) {
        record.lastReviewDate = now;
        record.reviewFrequency = record.reviewFrequency || 180;
        record.nextReviewDate = new Date(now.getTime() + (record.reviewFrequency * 24 * 60 * 60 * 1000));
        await this.db.consents.put(record);
      }
      
      // Schedule next periodic review
      await this.scheduleConsentReview('periodic', record?.reviewFrequency || 180);
      
      console.log('Consent review completed successfully');
    } catch (error) {
      console.error('Failed to complete consent review:', error);
      throw error;
    }
  }

  /**
   * Request contextual consent for new features
   */
  async requestContextualConsent(
    categories: ConsentCategory[],
    context: {
      featureName: string;
      reason: string;
      benefits: string[];
      consequences?: string;
    }
  ): Promise<{
    required: ConsentCategory[];
    optional: ConsentCategory[];
    alreadyGranted: ConsentCategory[];
  }> {
    try {
      const currentConsents = await this.getAllConsents();
      const configurations = this.getAllConsentConfigurations();
      
      const required: ConsentCategory[] = [];
      const optional: ConsentCategory[] = [];
      const alreadyGranted: ConsentCategory[] = [];
      
      for (const category of categories) {
        const config = configurations.find(c => c.category === category);
        if (!config) continue;
        
        if (currentConsents[category]) {
          alreadyGranted.push(category);
        } else if (config.required) {
          required.push(category);
        } else {
          optional.push(category);
        }
      }
      
      // Log the contextual consent request
      console.log(`Contextual consent requested for feature: ${context.featureName}`, {
        required,
        optional,
        alreadyGranted,
        context
      });
      
      return { required, optional, alreadyGranted };
    } catch (error) {
      console.error('Failed to request contextual consent:', error);
      throw error;
    }
  }

  /**
   * Update privacy policy version and handle consent versioning
   */
  async updatePolicyVersion(
    newVersion: string, 
    changes: string[], 
    requiresNewConsent: boolean = false
  ): Promise<void> {
    try {
      const now = new Date();
      
      // Create version record
      const versionRecord: ConsentVersioning = {
        id: this.generateId(),
        version: newVersion,
        effectiveDate: now,
        changes,
        requiresNewConsent,
        notificationSent: false
      };
      
      await this.db.consentVersions.add(versionRecord);
      
      // Update current version
      this.currentPolicyVersion = newVersion;
      
      // If new consent is required, schedule review for all users
      if (requiresNewConsent) {
        await this.scheduleConsentReview('policy_update', 7); // 7 days to review
      }
      
      console.log(`Policy updated to version ${newVersion}`, { requiresNewConsent, changes });
    } catch (error) {
      console.error('Failed to update policy version:', error);
      throw error;
    }
  }

  /**
   * Get policy version history
   */
  async getPolicyVersionHistory(): Promise<ConsentVersioning[]> {
    try {
      return await this.db.consentVersions.orderBy('effectiveDate').reverse().toArray();
    } catch (error) {
      console.error('Failed to get policy version history:', error);
      return [];
    }
  }

  /**
   * Get current policy changes since user's last consent
   */
  async getPolicyChangesSinceLastConsent(): Promise<{
    hasChanges: boolean;
    versions: ConsentVersioning[];
    requiresNewConsent: boolean;
  }> {
    try {
      const record = await this.getCurrentConsentRecord();
      const userPolicyVersion = record?.policyVersion || '0.0.0';
      
      const versions = await this.db.consentVersions
        .where('effectiveDate')
        .above(record?.lastUpdated || new Date(0))
        .toArray();
      
      const requiresNewConsent = versions.some(v => v.requiresNewConsent);
      
      return {
        hasChanges: versions.length > 0,
        versions,
        requiresNewConsent
      };
    } catch (error) {
      console.error('Failed to get policy changes:', error);
      return { hasChanges: false, versions: [], requiresNewConsent: false };
    }
  }

  /**
   * Get client IP address (if available and legally permitted)
   */
  private async getClientIP(): Promise<string | undefined> {
    try {
      // In a real application, you might get this from your backend
      // For privacy compliance, only collect if legally required
      return undefined; // Disabled by default for privacy
    } catch {
      return undefined;
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate device ID
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem('rover-consent-device-id');
    if (stored) return stored;

    const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('rover-consent-device-id', deviceId);
    return deviceId;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.db.close();
  }

  // Getters
  get userId(): string {
    return this.currentUserId;
  }

  get deviceId(): string {
    return this.currentDeviceId;
  }

  get sessionId(): string {
    return this.currentSessionId;
  }

  get policyVersion(): string {
    return this.currentPolicyVersion;
  }
}

// Singleton instance
export const consentManager = new ConsentManager();