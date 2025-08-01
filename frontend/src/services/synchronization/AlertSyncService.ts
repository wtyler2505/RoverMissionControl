/**
 * Alert Synchronization Service
 * Handles cross-tab synchronization using Broadcast Channel API with leader election
 */

import { AlertPersistenceService, PersistedAlert } from '../persistence/AlertPersistenceService';
import { AlertPriority } from '../../theme/alertPriorities';

export interface SyncMessage {
  type: 'alert-added' | 'alert-updated' | 'alert-removed' | 'alert-acknowledged' | 'alert-dismissed' | 'sync-request' | 'sync-response' | 'leader-election' | 'heartbeat';
  payload: any;
  timestamp: Date;
  deviceId: string;
  sessionId: string;
  messageId: string;
}

export interface LeaderElectionMessage {
  type: 'leader-election';
  subtype: 'nomination' | 'acceptance' | 'challenge';
  deviceId: string;
  sessionId: string;
  priority: number;
  timestamp: Date;
}

export interface SyncStatus {
  isLeader: boolean;
  connectedTabs: number;
  lastSync: Date | null;
  syncInProgress: boolean;
  conflictCount: number;
  leaderDeviceId: string | null;
}

export class AlertSyncService {
  private channel: BroadcastChannel;
  private persistenceService: AlertPersistenceService;
  private isLeader = false;
  private connectedTabs = new Set<string>();
  private lastHeartbeat = new Date();
  private leaderElectionTimeout?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private syncCallbacks = new Set<(message: SyncMessage) => void>();
  private statusCallbacks = new Set<(status: SyncStatus) => void>();
  private messageQueue: SyncMessage[] = [];
  private deviceId: string;
  private sessionId: string;

  constructor(persistenceService: AlertPersistenceService) {
    this.persistenceService = persistenceService;
    this.deviceId = persistenceService.currentDeviceId;
    this.sessionId = persistenceService.currentSessionId;
    this.channel = new BroadcastChannel('rover-alert-sync');
    
    this.setupChannelListeners();
    this.startLeaderElection();
    this.startHeartbeat();
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    try {
      // Send initial sync request to other tabs
      await this.broadcastMessage({
        type: 'sync-request',
        payload: {
          requestId: this.generateMessageId(),
          deviceId: this.deviceId,
          sessionId: this.sessionId
        },
        timestamp: new Date(),
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        messageId: this.generateMessageId()
      });

      console.log('Alert sync service initialized');
    } catch (error) {
      console.error('Failed to initialize alert sync service:', error);
      throw error;
    }
  }

  /**
   * Broadcast alert addition to other tabs
   */
  async broadcastAlertAdded(alert: PersistedAlert): Promise<void> {
    await this.broadcastMessage({
      type: 'alert-added',
      payload: alert,
      timestamp: new Date(),
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      messageId: this.generateMessageId()
    });
  }

  /**
   * Broadcast alert update to other tabs
   */
  async broadcastAlertUpdated(alert: PersistedAlert): Promise<void> {
    await this.broadcastMessage({
      type: 'alert-updated',
      payload: alert,
      timestamp: new Date(),
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      messageId: this.generateMessageId()
    });
  }

  /**
   * Broadcast alert removal to other tabs
   */
  async broadcastAlertRemoved(alertId: string): Promise<void> {
    await this.broadcastMessage({
      type: 'alert-removed',
      payload: { alertId },
      timestamp: new Date(),
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      messageId: this.generateMessageId()
    });
  }

  /**
   * Broadcast alert acknowledgment to other tabs
   */
  async broadcastAlertAcknowledged(alertId: string, acknowledgedBy: string): Promise<void> {
    await this.broadcastMessage({
      type: 'alert-acknowledged',
      payload: { alertId, acknowledgedBy, acknowledgedAt: new Date() },
      timestamp: new Date(),
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      messageId: this.generateMessageId()
    });
  }

  /**
   * Broadcast alert dismissal to other tabs
   */
  async broadcastAlertDismissed(alertId: string): Promise<void> {
    await this.broadcastMessage({
      type: 'alert-dismissed',
      payload: { alertId, dismissedAt: new Date() },
      timestamp: new Date(),
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      messageId: this.generateMessageId()
    });
  }

  /**
   * Add sync callback
   */
  addSyncCallback(callback: (message: SyncMessage) => void): void {
    this.syncCallbacks.add(callback);
  }

  /**
   * Remove sync callback
   */
  removeSyncCallback(callback: (message: SyncMessage) => void): void {
    this.syncCallbacks.delete(callback);
  }

  /**
   * Add status callback
   */
  addStatusCallback(callback: (status: SyncStatus) => void): void {
    this.statusCallbacks.add(callback);
  }

  /**
   * Remove status callback
   */
  removeStatusCallback(callback: (status: SyncStatus) => void): void {
    this.statusCallbacks.delete(callback);
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): SyncStatus {
    return {
      isLeader: this.isLeader,
      connectedTabs: this.connectedTabs.size,
      lastSync: this.lastHeartbeat,
      syncInProgress: false, // TODO: Track actual sync state
      conflictCount: 0, // TODO: Track conflicts
      leaderDeviceId: this.isLeader ? this.deviceId : null
    };
  }

  /**
   * Force leadership election
   */
  async forceLeaderElection(): Promise<void> {
    this.isLeader = false;
    await this.startLeaderElection();
  }

  /**
   * Setup broadcast channel listeners
   */
  private setupChannelListeners(): void {
    this.channel.addEventListener('message', async (event) => {
      const message: SyncMessage = event.data;
      
      // Ignore messages from same session
      if (message.sessionId === this.sessionId) {
        return;
      }

      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error('Error handling sync message:', error);
      }
    });
  }

  /**
   * Handle incoming sync messages
   */
  private async handleMessage(message: SyncMessage): Promise<void> {
    // Update connected tabs
    this.connectedTabs.add(message.sessionId);

    // Handle different message types
    switch (message.type) {
      case 'alert-added':
        await this.handleAlertAdded(message);
        break;
      case 'alert-updated':
        await this.handleAlertUpdated(message);
        break;
      case 'alert-removed':
        await this.handleAlertRemoved(message);
        break;
      case 'alert-acknowledged':
        await this.handleAlertAcknowledged(message);
        break;
      case 'alert-dismissed':
        await this.handleAlertDismissed(message);
        break;
      case 'sync-request':
        await this.handleSyncRequest(message);
        break;
      case 'sync-response':
        await this.handleSyncResponse(message);
        break;
      case 'leader-election':
        await this.handleLeaderElection(message);
        break;
      case 'heartbeat':
        await this.handleHeartbeat(message);
        break;
    }

    // Notify callbacks
    this.syncCallbacks.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });

    // Update status
    this.notifyStatusCallbacks();
  }

  /**
   * Handle alert added message
   */
  private async handleAlertAdded(message: SyncMessage): Promise<void> {
    const alert: PersistedAlert = message.payload;
    
    // Check if alert already exists to prevent duplicates
    const existingAlerts = await this.persistenceService.getAlerts({
      limit: 1,
      offset: 0
    });
    
    const exists = existingAlerts.some(existing => existing.id === alert.id);
    if (!exists) {
      await this.persistenceService.storeAlert(alert);
    }
  }

  /**
   * Handle alert updated message
   */
  private async handleAlertUpdated(message: SyncMessage): Promise<void> {
    const alert: PersistedAlert = message.payload;
    await this.persistenceService.storeAlert(alert);
  }

  /**
   * Handle alert removed message
   */
  private async handleAlertRemoved(message: SyncMessage): Promise<void> {
    const { alertId } = message.payload;
    await this.persistenceService.removeAlert(alertId);
  }

  /**
   * Handle alert acknowledged message
   */
  private async handleAlertAcknowledged(message: SyncMessage): Promise<void> {
    const { alertId, acknowledgedBy } = message.payload;
    await this.persistenceService.acknowledgeAlert(alertId, acknowledgedBy);
  }

  /**
   * Handle alert dismissed message
   */
  private async handleAlertDismissed(message: SyncMessage): Promise<void> {
    const { alertId } = message.payload;
    await this.persistenceService.dismissAlert(alertId);
  }

  /**
   * Handle sync request message
   */
  private async handleSyncRequest(message: SyncMessage): Promise<void> {
    if (this.isLeader) {
      // Send all alerts to requesting tab
      const alerts = await this.persistenceService.getAlerts();
      
      await this.broadcastMessage({
        type: 'sync-response',
        payload: {
          requestId: message.payload.requestId,
          alerts,
          syncTimestamp: new Date()
        },
        timestamp: new Date(),
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        messageId: this.generateMessageId()
      });
    }
  }

  /**
   * Handle sync response message
   */
  private async handleSyncResponse(message: SyncMessage): Promise<void> {
    const { alerts } = message.payload;
    
    // Store received alerts
    for (const alert of alerts) {
      await this.persistenceService.storeAlert(alert);
    }
  }

  /**
   * Handle leader election message
   */
  private async handleLeaderElection(message: SyncMessage): Promise<void> {
    const electionMsg = message as unknown as LeaderElectionMessage;
    
    switch (electionMsg.subtype) {
      case 'nomination':
        await this.handleLeaderNomination(electionMsg);
        break;
      case 'acceptance':
        await this.handleLeaderAcceptance(electionMsg);
        break;
      case 'challenge':
        await this.handleLeaderChallenge(electionMsg);
        break;
    }
  }

  /**
   * Handle heartbeat message
   */
  private async handleHeartbeat(message: SyncMessage): Promise<void> {
    // Update last seen time for the tab
    this.connectedTabs.add(message.sessionId);
  }

  /**
   * Start leader election process
   */
  private async startLeaderElection(): Promise<void> {
    const priority = this.calculateLeaderPriority();
    
    await this.broadcastMessage({
      type: 'leader-election',
      payload: {
        subtype: 'nomination',
        priority,
        deviceId: this.deviceId,
        sessionId: this.sessionId
      },
      timestamp: new Date(),
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      messageId: this.generateMessageId()
    });

    // Wait for responses
    this.leaderElectionTimeout = setTimeout(() => {
      this.becomeLeader();
    }, 2000);
  }

  /**
   * Handle leader nomination
   */
  private async handleLeaderNomination(message: LeaderElectionMessage): Promise<void> {
    const myPriority = this.calculateLeaderPriority();
    
    if (message.priority > myPriority) {
      // Accept their leadership
      await this.broadcastMessage({
        type: 'leader-election',
        payload: {
          subtype: 'acceptance',
          priority: myPriority,
          deviceId: this.deviceId,
          sessionId: this.sessionId
        },
        timestamp: new Date(),
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        messageId: this.generateMessageId()
      });
    } else if (message.priority < myPriority) {
      // Challenge their nomination
      await this.broadcastMessage({
        type: 'leader-election',
        payload: {
          subtype: 'challenge',
          priority: myPriority,
          deviceId: this.deviceId,
          sessionId: this.sessionId
        },
        timestamp: new Date(),
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        messageId: this.generateMessageId()
      });
    }
  }

  /**
   * Handle leader acceptance
   */
  private async handleLeaderAcceptance(message: LeaderElectionMessage): Promise<void> {
    // Another tab accepted our leadership
    this.becomeLeader();
  }

  /**
   * Handle leader challenge
   */
  private async handleLeaderChallenge(message: LeaderElectionMessage): Promise<void> {
    const myPriority = this.calculateLeaderPriority();
    
    if (message.priority > myPriority) {
      // Step down
      this.isLeader = false;
      if (this.leaderElectionTimeout) {
        clearTimeout(this.leaderElectionTimeout);
      }
    }
  }

  /**
   * Become the leader tab
   */
  private becomeLeader(): void {
    this.isLeader = true;
    console.log('Became alert sync leader');
    
    if (this.leaderElectionTimeout) {
      clearTimeout(this.leaderElectionTimeout);
    }

    this.notifyStatusCallbacks();
  }

  /**
   * Calculate leader priority based on tab age and capabilities
   */
  private calculateLeaderPriority(): number {
    const now = Date.now();
    const sessionAge = now - parseInt(this.sessionId.split('-')[1], 10);
    const hasVisibility = !document.hidden;
    const hasFocus = document.hasFocus();
    
    let priority = sessionAge / 1000; // Older tabs have higher priority
    if (hasVisibility) priority += 1000;
    if (hasFocus) priority += 500;
    
    return priority;
  }

  /**
   * Start heartbeat to maintain connection
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      await this.broadcastMessage({
        type: 'heartbeat',
        payload: {
          isLeader: this.isLeader,
          timestamp: new Date()
        },
        timestamp: new Date(),
        deviceId: this.deviceId,
        sessionId: this.sessionId,
        messageId: this.generateMessageId()
      });

      this.lastHeartbeat = new Date();
      
      // Clean up stale tabs (no heartbeat for 30 seconds)
      const staleThreshold = new Date(Date.now() - 30000);
      this.connectedTabs.forEach(sessionId => {
        // TODO: Track last seen time per tab
        // For now, we'll keep all tabs in the set
      });
    }, 10000); // Send heartbeat every 10 seconds
  }

  /**
   * Broadcast message to all tabs
   */
  private async broadcastMessage(message: SyncMessage): Promise<void> {
    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error('Failed to broadcast message:', error);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Notify status callbacks
   */
  private notifyStatusCallbacks(): void {
    const status = this.getSyncStatus();
    this.statusCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        console.error('Error in status callback:', error);
      }
    });
  }

  /**
   * Close the sync service
   */
  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.leaderElectionTimeout) {
      clearTimeout(this.leaderElectionTimeout);
    }
    
    this.channel.close();
    this.syncCallbacks.clear();
    this.statusCallbacks.clear();
  }
}