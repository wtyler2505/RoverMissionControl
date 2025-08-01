/**
 * Enhanced Alert Grouping Manager
 * Provides advanced grouping mechanisms for related alerts with multiple dismissal options
 */

import { AlertPriority } from '../../theme/alertPriorities';
import { ProcessedAlert } from './AlertQueueManager';

export interface AlertGroupCriteria {
  // Similarity criteria
  messagePattern?: RegExp;
  titleSimilarity?: number; // 0-1 threshold
  sourceSimilarity?: boolean;
  timingWindow?: number; // milliseconds
  priorityGrouping?: boolean;
  metadataKeys?: string[];
  customGroupingFn?: (alerts: ProcessedAlert[]) => Map<string, ProcessedAlert[]>;
}

export interface AlertGroup {
  id: string;
  groupKey: string;
  alerts: ProcessedAlert[];
  primaryAlert: ProcessedAlert; // Representative alert shown in UI
  groupType: 'automatic' | 'manual' | 'conditional';
  createdAt: Date;
  lastUpdated: Date;
  
  // Grouping metadata
  commonSource?: string;
  commonPriority?: AlertPriority;
  similarityScore?: number;
  groupingCriteria: string[];
  
  // Dismissal tracking
  dismissalState: {
    isDismissed: boolean;
    dismissedAt?: Date;
    dismissalType?: DismissalType;
    dismissedBy?: string;
    reason?: string;
    undoable: boolean;
    undoExpiresAt?: Date;
  };
}

export type DismissalType = 'manual' | 'timed' | 'bulk' | 'conditional' | 'auto-priority';
export type DismissalBehavior = 'persistent' | 'sticky' | 'blocking' | 'auto-hide' | 'timeout';

export interface DismissalRule {
  id: string;
  priority: AlertPriority;
  behavior: DismissalBehavior;
  timeoutMs?: number;
  requiresAcknowledgment?: boolean;
  conditions?: {
    minViewTime?: number;
    userInteraction?: boolean;
    explicitAction?: boolean;
  };
}

export interface DismissalAction {
  type: DismissalType;
  alertIds: string[];
  groupIds?: string[];
  timestamp: Date;
  user?: string;
  reason?: string;
  undoable: boolean;
  undoExpiresAt?: Date;
}

export interface UndoManager {
  actions: DismissalAction[];
  maxHistorySize: number;
  canUndo: (actionId: string) => boolean;
  undo: (actionId: string) => Promise<boolean>;
  clearExpired: () => void;
}

// Default dismissal rules based on priority
const DEFAULT_DISMISSAL_RULES: Record<AlertPriority, DismissalRule> = {
  critical: {
    id: 'critical-persistent',
    priority: 'critical',
    behavior: 'persistent',
    requiresAcknowledgment: true,
    conditions: {
      explicitAction: true,
    },
  },
  high: {
    id: 'high-sticky',
    priority: 'high',
    behavior: 'sticky',
    requiresAcknowledgment: true,
    conditions: {
      explicitAction: true,
    },
  },
  medium: {
    id: 'medium-viewed',
    priority: 'medium',
    behavior: 'auto-hide',
    timeoutMs: 30000, // 30 seconds after viewing
    conditions: {
      minViewTime: 3000, // Must be viewed for 3 seconds
    },
  },
  low: {
    id: 'low-timeout',
    priority: 'low',
    behavior: 'timeout',
    timeoutMs: 60000, // 1 minute
  },
  info: {
    id: 'info-center-only',
    priority: 'info',
    behavior: 'auto-hide',
    timeoutMs: 15000, // 15 seconds
  },
};

export class EnhancedAlertGroupingManager {
  private groups: Map<string, AlertGroup> = new Map();
  private dismissalRules: Map<AlertPriority, DismissalRule> = new Map();
  private undoManager: UndoManager;
  private eventCallbacks: Map<string, Function[]> = new Map();

  constructor(
    private config?: {
      maxGroupSize?: number;
      maxGroups?: number;
      undoHistorySize?: number;
      groupingCriteria?: AlertGroupCriteria;
      customRules?: DismissalRule[];
    }
  ) {
    // Initialize dismissal rules
    Object.values(DEFAULT_DISMISSAL_RULES).forEach(rule => {
      this.dismissalRules.set(rule.priority, rule);
    });

    // Override with custom rules
    config?.customRules?.forEach(rule => {
      this.dismissalRules.set(rule.priority, rule);
    });

    // Initialize undo manager
    this.undoManager = {
      actions: [],
      maxHistorySize: config?.undoHistorySize || 50,
      canUndo: (actionId: string) => {
        const action = this.undoManager.actions.find(a => a.timestamp.getTime().toString() === actionId);
        return action ? action.undoable && (!action.undoExpiresAt || action.undoExpiresAt > new Date()) : false;
      },
      undo: async (actionId: string) => {
        const actionIndex = this.undoManager.actions.findIndex(a => a.timestamp.getTime().toString() === actionId);
        if (actionIndex === -1) return false;

        const action = this.undoManager.actions[actionIndex];
        if (!this.undoManager.canUndo(actionId)) return false;

        // Restore dismissed alerts/groups
        if (action.type === 'bulk' && action.groupIds) {
          action.groupIds.forEach(groupId => {
            const group = this.groups.get(groupId);
            if (group) {
              group.dismissalState.isDismissed = false;
              group.dismissalState.dismissedAt = undefined;
              group.dismissalState.dismissalType = undefined;
            }
          });
        }

        // Remove the action from history
        this.undoManager.actions.splice(actionIndex, 1);
        this.emit('undoPerformed', { actionId, action });
        return true;
      },
      clearExpired: () => {
        const now = new Date();
        this.undoManager.actions = this.undoManager.actions.filter(action => 
          !action.undoExpiresAt || action.undoExpiresAt > now
        );
      }
    };

    // Set up cleanup interval
    setInterval(() => {
      this.undoManager.clearExpired();
      this.cleanupExpiredGroups();
    }, 60000); // Every minute
  }

  /**
   * Analyze and group related alerts
   */
  analyzeAndGroup(alerts: ProcessedAlert[]): Map<string, AlertGroup> {
    const criteria = this.config?.groupingCriteria || {};
    const newGroups = new Map<string, AlertGroup>();

    // Custom grouping function takes precedence
    if (criteria.customGroupingFn) {
      const customGroups = criteria.customGroupingFn(alerts);
      customGroups.forEach((groupAlerts, groupKey) => {
        if (groupAlerts.length > 1) {
          const group = this.createGroup(groupKey, groupAlerts, 'automatic');
          newGroups.set(group.id, group);
        }
      });
      return newGroups;
    }

    // Automatic grouping by various criteria
    const groupingMaps = new Map<string, ProcessedAlert[]>();

    alerts.forEach(alert => {
      const groupKeys: string[] = [];

      // Group by source similarity
      if (criteria.sourceSimilarity && alert.data?.source) {
        groupKeys.push(`source:${alert.data.source}`);
      }

      // Group by priority
      if (criteria.priorityGrouping) {
        groupKeys.push(`priority:${alert.priority}`);
      }

      // Group by message pattern
      if (criteria.messagePattern && alert.data?.message) {
        const match = alert.data.message.match(criteria.messagePattern);
        if (match) {
          groupKeys.push(`pattern:${match[0]}`);
        }
      }

      // Group by title similarity
      if (criteria.titleSimilarity && alert.data?.title) {
        const similarAlerts = alerts.filter(other => 
          other.id !== alert.id && 
          other.data?.title &&
          this.calculateSimilarity(alert.data.title, other.data.title) >= (criteria.titleSimilarity || 0.8)
        );
        if (similarAlerts.length > 0) {
          const titleKey = alert.data.title.toLowerCase().replace(/\s+/g, '-');
          groupKeys.push(`title:${titleKey}`);
        }
      }

      // Group by timing window
      if (criteria.timingWindow) {
        const timeWindow = Math.floor(alert.timestamp.getTime() / criteria.timingWindow);
        groupKeys.push(`time:${timeWindow}`);
      }

      // Group by metadata keys
      if (criteria.metadataKeys && alert.data?.metadata) {
        criteria.metadataKeys.forEach(key => {
          if (alert.data.metadata![key]) {
            groupKeys.push(`meta:${key}:${alert.data.metadata![key]}`);
          }
        });
      }

      // Add alert to all matching groups
      groupKeys.forEach(groupKey => {
        const existing = groupingMaps.get(groupKey) || [];
        existing.push(alert);
        groupingMaps.set(groupKey, existing);
      });
    });

    // Create groups from grouped alerts
    groupingMaps.forEach((groupAlerts, groupKey) => {
      if (groupAlerts.length > 1) {
        const group = this.createGroup(groupKey, groupAlerts, 'automatic');
        newGroups.set(group.id, group);
      }
    });

    // Update internal groups map
    newGroups.forEach((group, id) => {
      this.groups.set(id, group);
    });

    this.emit('groupsUpdated', { groups: Array.from(newGroups.values()) });
    return newGroups;
  }

  /**
   * Create a new alert group
   */
  private createGroup(groupKey: string, alerts: ProcessedAlert[], groupType: AlertGroup['groupType']): AlertGroup {
    // Sort alerts by priority and timestamp to select primary
    const sortedAlerts = [...alerts].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.timestamp.getTime() - a.timestamp.getTime(); // Newest first
    });

    const primaryAlert = sortedAlerts[0];
    const now = new Date();

    return {
      id: this.generateGroupId(),
      groupKey,
      alerts: sortedAlerts,
      primaryAlert,
      groupType,
      createdAt: now,
      lastUpdated: now,
      commonSource: this.findCommonValue(alerts, a => a.data?.source),
      commonPriority: this.findCommonValue(alerts, a => a.priority),
      similarityScore: this.calculateGroupSimilarity(alerts),
      groupingCriteria: this.identifyGroupingCriteria(groupKey),
      dismissalState: {
        isDismissed: false,
        undoable: true,
      },
    };
  }

  /**
   * Dismiss alerts with specific behavior
   */
  async dismissAlert(
    alertId: string, 
    type: DismissalType = 'manual',
    options?: {
      reason?: string;
      user?: string;
      force?: boolean;
    }
  ): Promise<boolean> {
    const alert = this.findAlertById(alertId);
    if (!alert) return false;

    const rule = this.dismissalRules.get(alert.priority);
    if (!rule) return false;

    // Check if dismissal is allowed
    if (!options?.force && !this.canDismissAlert(alert, rule, type)) {
      this.emit('dismissalBlocked', { alertId, rule, type });
      return false;
    }

    // Find group containing this alert
    const group = this.findGroupByAlertId(alertId);
    const undoExpiresAt = new Date(Date.now() + 300000); // 5 minutes undo window

    if (group) {
      // Update group dismissal state
      group.dismissalState = {
        isDismissed: true,
        dismissedAt: new Date(),
        dismissalType: type,
        dismissedBy: options?.user,
        reason: options?.reason,
        undoable: type !== 'auto-priority',
        undoExpiresAt: type !== 'auto-priority' ? undoExpiresAt : undefined,
      };
      group.lastUpdated = new Date();
    }

    // Record dismissal action for undo
    const action: DismissalAction = {
      type,
      alertIds: [alertId],
      groupIds: group ? [group.id] : undefined,
      timestamp: new Date(),
      user: options?.user,
      reason: options?.reason,
      undoable: type !== 'auto-priority',
      undoExpiresAt: type !== 'auto-priority' ? undoExpiresAt : undefined,
    };

    this.addUndoAction(action);
    this.emit('alertDismissed', { alertId, group, action });

    // Handle auto-timeout for certain behaviors
    if (rule.timeoutMs && rule.behavior === 'timeout') {
      setTimeout(() => {
        this.autoTimeoutDismiss(alertId);
      }, rule.timeoutMs);
    }

    return true;
  }

  /**
   * Bulk dismiss multiple alerts or groups
   */
  async bulkDismiss(
    items: { alertIds?: string[]; groupIds?: string[] },
    type: DismissalType = 'bulk',
    options?: {
      reason?: string;
      user?: string;
      force?: boolean;
    }
  ): Promise<{ successful: string[]; failed: string[] }> {
    const successful: string[] = [];
    const failed: string[] = [];
    const processedGroups = new Set<string>();

    // Process individual alerts
    if (items.alertIds) {
      for (const alertId of items.alertIds) {
        const success = await this.dismissAlert(alertId, type, options);
        if (success) {
          successful.push(alertId);
        } else {
          failed.push(alertId);
        }
      }
    }

    // Process groups
    if (items.groupIds) {
      for (const groupId of items.groupIds) {
        const group = this.groups.get(groupId);
        if (!group || processedGroups.has(groupId)) continue;

        const canDismissAll = group.alerts.every(alert => {
          const rule = this.dismissalRules.get(alert.priority);
          return rule && (options?.force || this.canDismissAlert(alert, rule, type));
        });

        if (canDismissAll) {
          // Dismiss entire group
          group.dismissalState = {
            isDismissed: true,
            dismissedAt: new Date(),
            dismissalType: type,
            dismissedBy: options?.user,
            reason: options?.reason,
            undoable: true,
            undoExpiresAt: new Date(Date.now() + 300000),
          };
          group.lastUpdated = new Date();
          successful.push(groupId);
          processedGroups.add(groupId);
        } else {
          failed.push(groupId);
        }
      }
    }

    // Record bulk action for undo
    if (successful.length > 0) {
      const action: DismissalAction = {
        type,
        alertIds: items.alertIds?.filter(id => successful.includes(id)) || [],
        groupIds: items.groupIds?.filter(id => successful.includes(id)) || [],
        timestamp: new Date(),
        user: options?.user,
        reason: options?.reason,
        undoable: true,
        undoExpiresAt: new Date(Date.now() + 300000),
      };

      this.addUndoAction(action);
      this.emit('bulkDismissed', { action, successful, failed });
    }

    return { successful, failed };
  }

  /**
   * Conditional dismiss based on criteria
   */
  async conditionalDismiss(
    criteria: {
      priority?: AlertPriority[];
      sourcePattern?: RegExp;
      ageThreshold?: number; // milliseconds
      groupSize?: number;
      customCondition?: (alert: ProcessedAlert) => boolean;
    },
    options?: {
      reason?: string;
      user?: string;
      dryRun?: boolean;
    }
  ): Promise<{ matched: ProcessedAlert[]; dismissed: string[] }> {
    const allAlerts = this.getAllVisibleAlerts();
    const matched: ProcessedAlert[] = [];

    // Apply criteria filters
    allAlerts.forEach(alert => {
      let matches = true;

      if (criteria.priority?.length && !criteria.priority.includes(alert.priority)) {
        matches = false;
      }

      if (criteria.sourcePattern && alert.data?.source && !criteria.sourcePattern.test(alert.data.source)) {
        matches = false;
      }

      if (criteria.ageThreshold) {
        const age = Date.now() - alert.timestamp.getTime();
        if (age < criteria.ageThreshold) {
          matches = false;
        }
      }

      if (criteria.groupSize) {
        const group = this.findGroupByAlertId(alert.id);
        if (!group || group.alerts.length < criteria.groupSize) {
          matches = false;
        }
      }

      if (criteria.customCondition && !criteria.customCondition(alert)) {
        matches = false;
      }

      if (matches) {
        matched.push(alert);
      }
    });

    // Perform dismissal if not dry run
    const dismissed: string[] = [];
    if (!options?.dryRun) {
      for (const alert of matched) {
        const success = await this.dismissAlert(alert.id, 'conditional', {
          reason: options?.reason || 'Conditional dismissal',
          user: options?.user,
        });
        if (success) {
          dismissed.push(alert.id);
        }
      }
    }

    this.emit('conditionalDismissed', { criteria, matched, dismissed });
    return { matched, dismissed };
  }

  /**
   * Get dismissal feedback for UI
   */
  getDismissalFeedback(alertId: string): {
    canDismiss: boolean;
    behavior: DismissalBehavior;
    requiresAcknowledgment: boolean;
    timeoutMs?: number;
    reason?: string;
  } | null {
    const alert = this.findAlertById(alertId);
    if (!alert) return null;

    const rule = this.dismissalRules.get(alert.priority);
    if (!rule) return null;

    return {
      canDismiss: this.canDismissAlert(alert, rule, 'manual'),
      behavior: rule.behavior,
      requiresAcknowledgment: rule.requiresAcknowledgment || false,
      timeoutMs: rule.timeoutMs,
      reason: this.getDismissalBlockReason(alert, rule),
    };
  }

  /**
   * Get undo-able actions
   */
  getUndoableActions(): Array<{
    id: string;
    type: DismissalType;
    timestamp: Date;
    description: string;
    canUndo: boolean;
  }> {
    return this.undoManager.actions.map(action => ({
      id: action.timestamp.getTime().toString(),
      type: action.type,
      timestamp: action.timestamp,
      description: this.generateActionDescription(action),
      canUndo: this.undoManager.canUndo(action.timestamp.getTime().toString()),
    }));
  }

  /**
   * Undo a dismissal action
   */
  async undoDismissal(actionId: string): Promise<boolean> {
    const success = await this.undoManager.undo(actionId);
    if (success) {
      this.emit('dismissalUndone', { actionId });
    }
    return success;
  }

  // Helper methods
  private canDismissAlert(alert: ProcessedAlert, rule: DismissalRule, type: DismissalType): boolean {
    // Critical and persistent alerts require explicit action
    if (rule.behavior === 'persistent' && type === 'auto-priority') {
      return false;
    }

    // Blocking alerts cannot be dismissed until acknowledged
    if (rule.behavior === 'blocking' && !rule.requiresAcknowledgment) {
      return false;
    }

    return true;
  }

  private getDismissalBlockReason(alert: ProcessedAlert, rule: DismissalRule): string | undefined {
    if (rule.behavior === 'persistent') {
      return 'Critical alerts require manual acknowledgment';
    }
    if (rule.behavior === 'blocking') {
      return 'This alert must be acknowledged before dismissal';
    }
    return undefined;
  }

  private findAlertById(alertId: string): ProcessedAlert | null {
    for (const group of this.groups.values()) {
      const alert = group.alerts.find(a => a.id === alertId);
      if (alert) return alert;
    }
    return null;
  }

  private findGroupByAlertId(alertId: string): AlertGroup | null {
    for (const group of this.groups.values()) {
      if (group.alerts.some(a => a.id === alertId)) {
        return group;
      }
    }
    return null;
  }

  private getAllVisibleAlerts(): ProcessedAlert[] {
    const alerts: ProcessedAlert[] = [];
    this.groups.forEach(group => {
      if (!group.dismissalState.isDismissed) {
        alerts.push(...group.alerts);
      }
    });
    return alerts;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1,     // deletion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private findCommonValue<T>(items: ProcessedAlert[], extractor: (item: ProcessedAlert) => T | undefined): T | undefined {
    const values = items.map(extractor).filter(v => v !== undefined);
    if (values.length === 0) return undefined;
    
    const first = values[0];
    return values.every(v => v === first) ? first : undefined;
  }

  private calculateGroupSimilarity(alerts: ProcessedAlert[]): number {
    if (alerts.length < 2) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < alerts.length; i++) {
      for (let j = i + 1; j < alerts.length; j++) {
        const alert1 = alerts[i];
        const alert2 = alerts[j];
        
        if (alert1.data?.title && alert2.data?.title) {
          totalSimilarity += this.calculateSimilarity(alert1.data.title, alert2.data.title);
          comparisons++;
        }
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private identifyGroupingCriteria(groupKey: string): string[] {
    const criteria: string[] = [];
    
    if (groupKey.includes('source:')) criteria.push('source');
    if (groupKey.includes('priority:')) criteria.push('priority');
    if (groupKey.includes('pattern:')) criteria.push('message-pattern');
    if (groupKey.includes('title:')) criteria.push('title-similarity');
    if (groupKey.includes('time:')) criteria.push('timing-window');
    if (groupKey.includes('meta:')) criteria.push('metadata');
    
    return criteria;
  }

  private generateGroupId(): string {
    return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private addUndoAction(action: DismissalAction): void {
    this.undoManager.actions.unshift(action);
    if (this.undoManager.actions.length > this.undoManager.maxHistorySize) {
      this.undoManager.actions.splice(this.undoManager.maxHistorySize);
    }
  }

  private generateActionDescription(action: DismissalAction): string {
    const itemCount = (action.alertIds?.length || 0) + (action.groupIds?.length || 0);
    const typeLabel = action.type.charAt(0).toUpperCase() + action.type.slice(1);
    return `${typeLabel} dismissed ${itemCount} item${itemCount !== 1 ? 's' : ''}`;
  }

  private autoTimeoutDismiss(alertId: string): void {
    // Auto-dismiss after timeout (used for low priority alerts)
    this.dismissAlert(alertId, 'auto-priority', {
      reason: 'Auto-dismissed after timeout',
      force: true,
    });
  }

  private cleanupExpiredGroups(): void {
    // Remove dismissed groups older than retention period
    const retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
    const cutoff = new Date(Date.now() - retentionPeriod);
    
    for (const [groupId, group] of this.groups.entries()) {
      if (group.dismissalState.isDismissed && 
          group.dismissalState.dismissedAt && 
          group.dismissalState.dismissedAt < cutoff) {
        this.groups.delete(groupId);
      }
    }
  }

  // Event system
  private on(event: string, callback: Function): void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event)!.push(callback);
  }

  private emit(event: string, data?: any): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Public getters
  getGroups(): AlertGroup[] {
    return Array.from(this.groups.values());
  }

  getVisibleGroups(): AlertGroup[] {
    return Array.from(this.groups.values()).filter(group => !group.dismissalState.isDismissed);
  }

  getDismissalRules(): Map<AlertPriority, DismissalRule> {
    return new Map(this.dismissalRules);
  }

  getUndoManager(): UndoManager {
    return this.undoManager;
  }
}