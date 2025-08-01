/**
 * Consent Versioning Service
 * Handles privacy policy updates, version tracking, and user notifications
 */

import { consentManager, ConsentVersioning } from './ConsentManager';

export interface PolicyChange {
  section: string;
  changeType: 'added' | 'modified' | 'removed';
  description: string;
  impact: 'low' | 'medium' | 'high';
  requiresConsent: boolean;
}

export interface PolicyUpdateNotification {
  id: string;
  userId: string;
  policyVersion: string;
  notificationDate: Date;
  read: boolean;
  acknowledged: boolean;
  acknowledgedDate?: Date;
  notificationMethod: 'modal' | 'banner' | 'email';
}

export class ConsentVersioningService {
  private static instance: ConsentVersioningService;
  private notifications: PolicyUpdateNotification[] = [];

  public static getInstance(): ConsentVersioningService {
    if (!ConsentVersioningService.instance) {
      ConsentVersioningService.instance = new ConsentVersioningService();
    }
    return ConsentVersioningService.instance;
  }

  /**
   * Create a new privacy policy version
   */
  async createPolicyVersion(
    version: string,
    changes: PolicyChange[],
    effectiveDate: Date = new Date()
  ): Promise<void> {
    try {
      const requiresNewConsent = changes.some(change => change.requiresConsent);
      const changeDescriptions = changes.map(change => 
        `${change.section}: ${change.description} (${change.changeType})`
      );

      await consentManager.updatePolicyVersion(
        version,
        changeDescriptions,
        requiresNewConsent
      );

      // If new consent is required, create notification for users
      if (requiresNewConsent) {
        await this.scheduleUserNotifications(version, changes);
      }

      console.log(`Policy version ${version} created successfully`);
    } catch (error) {
      console.error('Failed to create policy version:', error);
      throw error;
    }
  }

  /**
   * Get policy version comparison
   */
  async comparePolicyVersions(
    fromVersion: string,
    toVersion: string
  ): Promise<{
    versions: ConsentVersioning[];
    totalChanges: number;
    requiresNewConsent: boolean;
    impactLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      const versions = await consentManager.getPolicyVersionHistory();
      
      const fromIndex = versions.findIndex(v => v.version === fromVersion);
      const toIndex = versions.findIndex(v => v.version === toVersion);
      
      if (fromIndex === -1 || toIndex === -1) {
        throw new Error('Version not found');
      }

      const relevantVersions = versions.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1);
      const totalChanges = relevantVersions.reduce((acc, v) => acc + v.changes.length, 0);
      const requiresNewConsent = relevantVersions.some(v => v.requiresNewConsent);
      
      // Determine impact level based on number of changes and consent requirement
      let impactLevel: 'low' | 'medium' | 'high' = 'low';
      if (requiresNewConsent || totalChanges > 10) {
        impactLevel = 'high';
      } else if (totalChanges > 5) {
        impactLevel = 'medium';
      }

      return {
        versions: relevantVersions,
        totalChanges,
        requiresNewConsent,
        impactLevel
      };
    } catch (error) {
      console.error('Failed to compare policy versions:', error);
      throw error;
    }
  }

  /**
   * Check if user needs to review policy changes
   */
  async checkUserPolicyStatus(userId: string): Promise<{
    needsReview: boolean;
    currentUserVersion: string;
    latestVersion: string;
    changesSinceLastConsent: ConsentVersioning[];
    requiresNewConsent: boolean;
    daysOverdue: number;
  }> {
    try {
      const [policyChanges, versions] = await Promise.all([
        consentManager.getPolicyChangesSinceLastConsent(),
        consentManager.getPolicyVersionHistory()
      ]);

      const latestVersion = versions[0]?.version || '1.0.0';
      const record = await consentManager.getCurrentConsentRecord();
      const currentUserVersion = record?.policyVersion || '0.0.0';

      const needsReview = policyChanges.hasChanges || policyChanges.requiresNewConsent;
      
      // Calculate days overdue if review is required
      let daysOverdue = 0;
      if (needsReview && record?.nextReviewDate) {
        const now = new Date();
        const reviewDate = new Date(record.nextReviewDate);
        if (now > reviewDate) {
          daysOverdue = Math.floor((now.getTime() - reviewDate.getTime()) / (24 * 60 * 60 * 1000));
        }
      }

      return {
        needsReview,
        currentUserVersion,
        latestVersion,
        changesSinceLastConsent: policyChanges.versions,
        requiresNewConsent: policyChanges.requiresNewConsent,
        daysOverdue
      };
    } catch (error) {
      console.error('Failed to check user policy status:', error);
      throw error;
    }
  }

  /**
   * Create notification for policy update
   */
  async scheduleUserNotifications(
    policyVersion: string,
    changes: PolicyChange[]
  ): Promise<void> {
    try {
      const userId = consentManager.userId;
      const highImpactChanges = changes.filter(c => c.impact === 'high' || c.requiresConsent);

      const notification: PolicyUpdateNotification = {
        id: this.generateId(),
        userId,
        policyVersion,
        notificationDate: new Date(),
        read: false,
        acknowledged: false,
        notificationMethod: highImpactChanges.length > 0 ? 'modal' : 'banner'
      };

      this.notifications.push(notification);
      
      // Store in localStorage for persistence
      localStorage.setItem('privacy-notifications', JSON.stringify(this.notifications));

      console.log(`Notification scheduled for policy version ${policyVersion}`);
    } catch (error) {
      console.error('Failed to schedule user notifications:', error);
      throw error;
    }
  }

  /**
   * Get pending notifications for user
   */
  getPendingNotifications(userId: string): PolicyUpdateNotification[] {
    // Load from localStorage
    const stored = localStorage.getItem('privacy-notifications');
    if (stored) {
      this.notifications = JSON.parse(stored);
    }

    return this.notifications.filter(n => 
      n.userId === userId && !n.acknowledged
    );
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      localStorage.setItem('privacy-notifications', JSON.stringify(this.notifications));
    }
  }

  /**
   * Acknowledge policy update notification
   */
  async acknowledgeNotification(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.acknowledged = true;
      notification.acknowledgedDate = new Date();
      localStorage.setItem('privacy-notifications', JSON.stringify(this.notifications));
    }
  }

  /**
   * Get policy change summary for user display
   */
  formatChangesSummary(changes: PolicyChange[]): {
    summary: string;
    details: { section: string; changes: PolicyChange[] }[];
    requiresAction: boolean;
  } {
    const groupedChanges = changes.reduce((acc, change) => {
      if (!acc[change.section]) {
        acc[change.section] = [];
      }
      acc[change.section].push(change);
      return acc;
    }, {} as Record<string, PolicyChange[]>);

    const details = Object.entries(groupedChanges).map(([section, sectionChanges]) => ({
      section,
      changes: sectionChanges
    }));

    const requiresAction = changes.some(c => c.requiresConsent);
    
    let summary = `${changes.length} change${changes.length !== 1 ? 's' : ''} `;
    const highImpact = changes.filter(c => c.impact === 'high').length;
    const mediumImpact = changes.filter(c => c.impact === 'medium').length;
    
    if (highImpact > 0) {
      summary += `including ${highImpact} high-impact change${highImpact !== 1 ? 's' : ''}`;
    } else if (mediumImpact > 0) {
      summary += `including ${mediumImpact} medium-impact change${mediumImpact !== 1 ? 's' : ''}`;
    } else {
      summary += 'with low impact';
    }

    if (requiresAction) {
      summary += '. Your review and consent is required.';
    } else {
      summary += '. No action required.';
    }

    return {
      summary,
      details,
      requiresAction
    };
  }

  /**
   * Create a policy update changelog
   */
  generateChangelog(versions: ConsentVersioning[]): string {
    let changelog = '# Privacy Policy Changelog\n\n';
    
    for (const version of versions) {
      changelog += `## Version ${version.version}\n`;
      changelog += `*Effective: ${version.effectiveDate.toLocaleDateString()}*\n\n`;
      
      if (version.requiresNewConsent) {
        changelog += '**⚠️ This update requires your consent**\n\n';
      }
      
      changelog += '### Changes:\n';
      for (const change of version.changes) {
        changelog += `- ${change}\n`;
      }
      changelog += '\n';
    }

    return changelog;
  }

  /**
   * Export user's policy acknowledgment history
   */
  async exportPolicyHistory(userId: string): Promise<{
    userId: string;
    exportDate: Date;
    acknowledgedVersions: {
      version: string;
      acknowledgedDate: Date;
      method: string;
    }[];
    pendingReviews: {
      version: string;
      scheduledDate: Date;
      overdue: boolean;
    }[];
  }> {
    try {
      const notifications = this.getPendingNotifications(userId);
      const record = await consentManager.getCurrentConsentRecord();
      
      const acknowledgedVersions = this.notifications
        .filter(n => n.userId === userId && n.acknowledged)
        .map(n => ({
          version: n.policyVersion,
          acknowledgedDate: n.acknowledgedDate!,
          method: n.notificationMethod
        }));

      const pendingReviews = notifications.map(n => ({
        version: n.policyVersion,
        scheduledDate: n.notificationDate,
        overdue: new Date() > n.notificationDate
      }));

      return {
        userId,
        exportDate: new Date(),
        acknowledgedVersions,
        pendingReviews
      };
    } catch (error) {
      console.error('Failed to export policy history:', error);
      throw error;
    }
  }

  /**
   * Pre-defined policy update scenarios
   */
  static readonly COMMON_UPDATES = {
    GDPR_COMPLIANCE: {
      version: '2.1.0',
      changes: [
        {
          section: 'Data Processing',
          changeType: 'modified' as const,
          description: 'Enhanced data processing transparency and user rights',
          impact: 'high' as const,
          requiresConsent: true
        },
        {
          section: 'Data Retention',
          changeType: 'modified' as const,
          description: 'Updated retention periods to comply with GDPR',
          impact: 'medium' as const,
          requiresConsent: false
        }
      ]
    },
    THIRD_PARTY_INTEGRATION: {
      version: '2.2.0',
      changes: [
        {
          section: 'Third Party Services',
          changeType: 'added' as const,
          description: 'Added new analytics service provider',
          impact: 'medium' as const,
          requiresConsent: true
        }
      ]
    },
    SECURITY_ENHANCEMENT: {
      version: '2.0.1',
      changes: [
        {
          section: 'Data Security',
          changeType: 'modified' as const,
          description: 'Enhanced encryption and security measures',
          impact: 'low' as const,
          requiresConsent: false
        }
      ]
    }
  };

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `policy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const consentVersioningService = ConsentVersioningService.getInstance();