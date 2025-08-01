/**
 * Alert Queue WebSocket Integration Example
 * 
 * Demonstrates the complete integration of the Alert system with WebSocket infrastructure
 * showcasing real-time alert communication, acknowledgments, and synchronization.
 */

import { WebSocketClient } from './WebSocketClient';
import { useAlertStore } from '../../stores/alertStore';
import { AlertPriority } from '../../theme/alertPriorities';
import { 
  AlertWebSocketMessage, 
  AlertMessageData, 
  AlertSyncResponse,
  MessageType 
} from './types';

// Example 1: Basic WebSocket Client Setup with Alert Integration
export class AlertIntegratedWebSocketExample {
  private wsClient: WebSocketClient;
  private alertStore: any;

  constructor() {
    // Initialize WebSocket client with alert configuration
    this.wsClient = new WebSocketClient({
      url: 'ws://localhost:8000',
      reconnect: true,
      reconnectAttempts: 5,
      debug: true,
      // Alert-specific configuration
      alerts: {
        batchSize: 25,           // Smaller batches for low latency
        batchTimeout: 500,       // 500ms timeout for responsive alerts
        compressionThreshold: 512, // Compress larger alert batches
        maxRetries: 3,
        retryBackoffMs: 1000,
        syncInterval: 15000,     // Sync every 15 seconds
        acknowledgmentTimeout: 3000,
        resyncOnReconnect: true,
        subscribedPriorities: ['critical', 'high', 'medium', 'low'],
        autoAcknowledgeInfo: true,
        adaptiveBatching: true,
        lowLatencyThreshold: 50,
        highLatencyThreshold: 300
      }
    });

    // Get alert store instance
    this.alertStore = useAlertStore.getState();
  }

  async initialize(): Promise<void> {
    // Set up alert-specific event handlers
    this.setupAlertEventHandlers();

    // Connect WebSocket
    await this.wsClient.connect({
      auth: {
        token: 'your-auth-token',
        userId: 'user123'
      }
    });

    // Connect alert store to WebSocket
    this.alertStore.connectWebSocket(this.wsClient);

    console.log('Alert-integrated WebSocket client initialized successfully');
  }

  private setupAlertEventHandlers(): void {
    // Handle incoming alerts
    this.wsClient.on('onAlertReceived', async (alert: AlertWebSocketMessage) => {
      console.log('Received alert:', alert);
      
      // Custom processing for critical alerts
      if (alert.priority === 'critical') {
        // Show immediate notification
        this.showCriticalAlertNotification(alert);
        
        // Log to audit system
        await this.auditCriticalAlert(alert);
      }
      
      // Handle actionable alerts
      if (alert.data.action) {
        this.registerAlertAction(alert);
      }
    });

    // Handle alert acknowledgments from other clients
    this.wsClient.on('onAlertAcknowledged', (ack: any) => {
      console.log('Alert acknowledged by another client:', ack);
      // Update UI to show acknowledgment
      this.updateAlertAcknowledgmentUI(ack);
    });

    // Handle synchronization completion
    this.wsClient.on('onAlertSyncComplete', (syncResponse: AlertSyncResponse) => {
      console.log(`Synchronized ${syncResponse.alerts.length} alerts`);
      if (syncResponse.hasMore) {
        console.log(`${syncResponse.totalCount - syncResponse.alerts.length} more alerts available`);
      }
    });

    // Handle connection events for alert resync
    this.wsClient.on('onConnect', () => {
      console.log('WebSocket connected - alert sync will begin automatically');
    });

    this.wsClient.on('onReconnect', () => {
      console.log('WebSocket reconnected - resyncing alerts');
    });
  }

  // Example: Send different types of alerts
  async sendExampleAlerts(): Promise<void> {
    // Critical system alert
    await this.wsClient.sendAlert({
      title: 'Emergency Stop Activated',
      message: 'Rover emergency stop has been triggered. All movement halted.',
      priority: 'critical',
      source: 'rover-control',
      closable: false,
      persistent: true,
      metadata: {
        timestamp: Date.now(),
        location: 'rover-main-controller',
        severity: 'emergency'
      }
    });

    // High priority warning
    await this.wsClient.sendAlert({
      title: 'Battery Low',
      message: 'Rover battery level is below 15%. Consider returning to base.',
      priority: 'high',
      source: 'power-management',
      closable: true,
      action: {
        label: 'Return to Base',
        actionType: 'navigation.return_to_base',
        parameters: { reason: 'low_battery' }
      },
      metadata: {
        batteryLevel: 14,
        estimatedTime: '15 minutes'
      }
    });

    // Grouped alerts for similar events
    const groupId = `network-issues-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await this.wsClient.sendAlert({
        title: 'Network Latency',
        message: `High network latency detected on sensor ${i + 1}`,
        priority: 'medium',
        source: 'network-monitor',
        closable: true,
        groupId,
        metadata: {
          sensorId: i + 1,
          latency: 250 + i * 50
        }
      });
    }
  }

  // Example: Acknowledge alerts
  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      await this.wsClient.acknowledgeAlert(alertId, 'operator-john', true);
      console.log(`Alert ${alertId} acknowledged successfully`);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }

  // Example: Manual synchronization
  async manualSync(): Promise<void> {
    try {
      const syncResponse = await this.wsClient.syncAlerts({
        priorities: ['critical', 'high'],
        includeAcknowledged: false,
        maxCount: 50
      });
      
      console.log('Manual sync completed:', syncResponse);
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  }

  // Example: Get system status including alerts
  getAlertSystemStatus(): any {
    const alertStatus = this.wsClient.getAlertStatus();
    const wsStatus = this.wsClient.connectionStatus;
    const storeStatus = this.alertStore.queueStatus;

    return {
      websocket: {
        connected: wsStatus.connected,
        latency: wsStatus.metrics.currentLatency,
        protocol: this.wsClient.getCurrentProtocol()
      },
      alertManager: {
        outgoingQueue: alertStatus.queueSizes.outgoing,
        pendingAcks: alertStatus.queueSizes.acknowledgments,
        retryQueue: alertStatus.queueSizes.retries,
        averageLatency: alertStatus.metrics.averageLatency,
        successRate: alertStatus.metrics.successRate,
        adaptiveBatchSize: alertStatus.metrics.currentBatchSize
      },
      alertStore: {
        totalAlerts: storeStatus.total,
        alertsByPriority: storeStatus.byPriority,
        processedAlerts: storeStatus.processed,
        groupedAlerts: storeStatus.grouped
      }
    };
  }

  // Example utility methods
  private showCriticalAlertNotification(alert: AlertWebSocketMessage): void {
    // Show browser notification for critical alerts
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.data.title || 'Critical Alert', {
        body: alert.data.message,
        icon: '/alert-critical.ico',
        tag: `alert-${alert.id}`,
        requireInteraction: true
      });
    }

    // Flash UI or play sound
    document.body.classList.add('critical-alert-active');
    setTimeout(() => {
      document.body.classList.remove('critical-alert-active');
    }, 5000);
  }

  private async auditCriticalAlert(alert: AlertWebSocketMessage): Promise<void> {
    // Log critical alert to audit system
    const auditEntry = {
      type: 'critical_alert',
      alertId: alert.id,
      timestamp: alert.timestamp,
      source: alert.data.source,
      title: alert.data.title,
      message: alert.data.message,
      metadata: alert.data.metadata
    };

    // Send to audit service (example)
    try {
      await fetch('/api/audit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditEntry)
      });
    } catch (error) {
      console.error('Failed to audit critical alert:', error);
    }
  }

  private registerAlertAction(alert: AlertWebSocketMessage): void {
    // Register actionable alert for UI interaction
    if (alert.data.action) {
      console.log(`Registering action "${alert.data.action.label}" for alert ${alert.id}`);
      
      // Add to alert store with action handler
      this.alertStore.addAlert({
        title: alert.data.title,
        message: alert.data.message,
        priority: alert.priority as AlertPriority,
        action: {
          label: alert.data.action.label,
          handler: async () => {
            await this.executeAlertAction(alert.data.action!);
          }
        },
        source: 'websocket',
        metadata: alert.data.metadata
      });
    }
  }

  private async executeAlertAction(action: any): Promise<void> {
    console.log('Executing alert action:', action);
    
    // Handle different action types
    switch (action.actionType) {
      case 'navigation.return_to_base':
        await this.wsClient.sendMessage(MessageType.COMMAND, {
          action: 'rover_command',
          command: 'return_to_base',
          parameters: action.parameters
        });
        break;
        
      case 'system.emergency_stop':
        await this.wsClient.sendMessage(MessageType.COMMAND, {
          action: 'rover_command',
          command: 'emergency_stop'
        });
        break;
        
      default:
        console.warn('Unknown action type:', action.actionType);
    }
  }

  private updateAlertAcknowledgmentUI(ack: any): void {
    // Update UI to show that alert was acknowledged by another user
    const alertElement = document.querySelector(`[data-alert-id="${ack.alert_id}"]`);
    if (alertElement) {
      alertElement.classList.add('acknowledged-by-other');
      
      const ackInfo = document.createElement('div');
      ackInfo.className = 'alert-ack-info';
      ackInfo.textContent = `Acknowledged by ${ack.acknowledged_by}`;
      alertElement.appendChild(ackInfo);
    }
  }

  // Cleanup
  async destroy(): Promise<void> {
    this.alertStore.disconnectWebSocket();
    await this.wsClient.destroy();
  }
}

// Example 2: React Hook for Alert WebSocket Integration
export function useAlertWebSocket() {
  const alertStore = useAlertStore();

  const connectToAlertWebSocket = async (wsUrl: string, authToken?: string) => {
    const wsClient = new WebSocketClient({
      url: wsUrl,
      reconnect: true,
      alerts: {
        adaptiveBatching: true,
        resyncOnReconnect: true,
        subscribedPriorities: ['critical', 'high', 'medium', 'low']
      }
    });

    await wsClient.connect({
      auth: authToken ? { token: authToken } : undefined
    });

    alertStore.connectWebSocket(wsClient);
    return wsClient;
  };

  const sendAlert = async (alertData: Partial<AlertMessageData>) => {
    if (alertStore.wsClient) {
      return await alertStore.wsClient.sendAlert({
        message: 'Alert message',
        source: 'client',
        ...alertData
      });
    }
    throw new Error('WebSocket not connected');
  };

  const acknowledgeAlert = async (alertId: string, acknowledgedBy: string) => {
    return await alertStore.acknowledgeAlert(alertId, acknowledgedBy);
  };

  const syncAlerts = async () => {
    return await alertStore.syncWithServer();
  };

  return {
    connectToAlertWebSocket,
    sendAlert,
    acknowledgeAlert,
    syncAlerts,
    alerts: alertStore.alerts,
    queueStatus: alertStore.queueStatus,
    syncInProgress: alertStore.syncInProgress
  };
}

// Example 3: Performance Monitoring Integration
export class AlertPerformanceMonitor {
  private wsClient: WebSocketClient;
  private metrics: Map<string, number[]> = new Map();

  constructor(wsClient: WebSocketClient) {
    this.wsClient = wsClient;
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    // Monitor alert latency
    this.wsClient.on('onAlertReceived', (alert: AlertWebSocketMessage) => {
      const now = Date.now();
      const alertAge = now - alert.timestamp;
      
      this.recordMetric('alert-latency', alertAge);
      
      if (alertAge > 5000) { // Alert older than 5 seconds
        console.warn(`Stale alert received: ${alert.id}, age: ${alertAge}ms`);
      }
    });

    // Monitor acknowledgment round-trip time
    this.wsClient.on('onAlertAcknowledged', (ack: any) => {
      const roundTripTime = Date.now() - ack.acknowledged_at;
      this.recordMetric('ack-roundtrip', roundTripTime);
    });

    // Monitor sync performance
    this.wsClient.on('onAlertSyncComplete', (syncResponse: AlertSyncResponse) => {
      const syncDuration = Date.now() - syncResponse.syncTimestamp;
      this.recordMetric('sync-duration', syncDuration);
      this.recordMetric('sync-count', syncResponse.alerts.length);
    });
  }

  private recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const [metric, values] of this.metrics.entries()) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        
        report[metric] = {
          average: Math.round(avg),
          min,
          max,
          count: values.length,
          latest: values[values.length - 1]
        };
      }
    }
    
    return report;
  }
}

// Export example usage
export default AlertIntegratedWebSocketExample;