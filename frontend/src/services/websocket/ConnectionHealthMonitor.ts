/**
 * ConnectionHealthMonitor - Real-time Connection Health Monitoring
 * 
 * Monitors connection health across WebSocket, REST API, and hardware interfaces.
 * Implements multi-level monitoring, quality metrics, and safe state transitions.
 * Follows IEC 61508 SIL-2 safety standards for critical systems.
 */

import {
  ConnectionState,
  ConnectionMetrics,
  WebSocketError,
  ConnectionEvent,
} from './types';
import { EmergencyStopState, SystemSafetyState } from '../../hooks/useEmergencyStop';

export enum ConnectionType {
  WEBSOCKET = 'websocket',
  REST_API = 'rest_api',
  HARDWARE_SERIAL = 'hardware_serial',
  HARDWARE_USB = 'hardware_usb',
  HARDWARE_GPIO = 'hardware_gpio',
}

export enum ConnectionHealthLevel {
  EXCELLENT = 'excellent',    // < 50ms latency, 0% loss
  GOOD = 'good',             // < 100ms latency, < 1% loss
  FAIR = 'fair',             // < 200ms latency, < 5% loss
  POOR = 'poor',             // < 500ms latency, < 10% loss
  CRITICAL = 'critical',      // > 500ms latency or > 10% loss
  DISCONNECTED = 'disconnected'
}

export interface ConnectionQualityMetrics {
  latency: number;           // Current latency in ms
  averageLatency: number;    // Exponential moving average
  minLatency: number;        // Minimum observed
  maxLatency: number;        // Maximum observed
  packetLoss: number;        // Percentage of lost packets
  jitter: number;            // Latency variation
  throughput: number;        // Bytes per second
  errorRate: number;         // Errors per minute
  lastUpdate: number;        // Timestamp of last update
}

export interface ConnectionHealthStatus {
  type: ConnectionType;
  health: ConnectionHealthLevel;
  connected: boolean;
  lastSeen: number;
  metrics: ConnectionQualityMetrics;
  errors: WebSocketError[];
  consecutiveFailures: number;
  uptime: number;
  reconnectAttempts: number;
}

export interface HealthThresholds {
  excellentLatency: number;  // Default: 50ms
  goodLatency: number;       // Default: 100ms
  fairLatency: number;       // Default: 200ms
  poorLatency: number;       // Default: 500ms
  criticalTimeout: number;   // Default: 5000ms
  packetLossThreshold: number; // Default: 10%
  jitterThreshold: number;   // Default: 50ms
  minSamples: number;        // Minimum samples for metrics
}

export interface SafeStateTransition {
  trigger: 'connection_loss' | 'quality_degradation' | 'hardware_fault' | 'manual';
  fromState: SystemSafetyState;
  toState: SystemSafetyState;
  timestamp: number;
  reason: string;
  actions: string[];
}

export interface ConnectionHealthMonitorConfig {
  monitoringInterval: number;     // How often to check health (ms)
  metricsWindow: number;          // Time window for metrics (ms)
  thresholds: HealthThresholds;
  enableAutoStop: boolean;        // Auto-stop on critical connection loss
  gracePeriod: number;           // Grace period before emergency stop (ms)
  reconnectConfig: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
  };
  logging: {
    enabled: boolean;
    maxEvents: number;
    persistToStorage: boolean;
  };
}

export class ConnectionHealthMonitor {
  private config: ConnectionHealthMonitorConfig;
  private connections: Map<string, ConnectionHealthStatus> = new Map();
  private monitoringTimer?: NodeJS.Timeout;
  private metricsBuffer: Map<string, number[]> = new Map();
  private eventLog: ConnectionEvent[] = [];
  private safeStateTransitions: SafeStateTransition[] = [];
  private callbacks: {
    onHealthChange?: (connectionId: string, health: ConnectionHealthLevel) => void;
    onConnectionLost?: (connectionId: string, type: ConnectionType) => void;
    onConnectionRestored?: (connectionId: string, type: ConnectionType) => void;
    onEmergencyStop?: (reason: string, connections: string[]) => void;
    onMetricsUpdate?: (connectionId: string, metrics: ConnectionQualityMetrics) => void;
    onSafeStateTransition?: (transition: SafeStateTransition) => void;
  } = {};

  constructor(config: Partial<ConnectionHealthMonitorConfig> = {}) {
    this.config = {
      monitoringInterval: 1000,
      metricsWindow: 60000,
      thresholds: {
        excellentLatency: 50,
        goodLatency: 100,
        fairLatency: 200,
        poorLatency: 500,
        criticalTimeout: 5000,
        packetLossThreshold: 10,
        jitterThreshold: 50,
        minSamples: 10,
      },
      enableAutoStop: true,
      gracePeriod: 3000,
      reconnectConfig: {
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 1.5,
      },
      logging: {
        enabled: true,
        maxEvents: 1000,
        persistToStorage: true,
      },
      ...config,
    };
  }

  /**
   * Register a connection for monitoring
   */
  registerConnection(
    id: string,
    type: ConnectionType,
    initialState: Partial<ConnectionHealthStatus> = {}
  ): void {
    const status: ConnectionHealthStatus = {
      type,
      health: ConnectionHealthLevel.DISCONNECTED,
      connected: false,
      lastSeen: Date.now(),
      metrics: this.initializeMetrics(),
      errors: [],
      consecutiveFailures: 0,
      uptime: 0,
      reconnectAttempts: 0,
      ...initialState,
    };

    this.connections.set(id, status);
    this.metricsBuffer.set(id, []);
    this.logEvent({
      type: 'connection_registered',
      timestamp: Date.now(),
      data: { id, type },
    });
  }

  /**
   * Update connection metrics
   */
  updateMetrics(
    connectionId: string,
    latency: number,
    success: boolean = true
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const now = Date.now();
    connection.lastSeen = now;

    if (success) {
      // Update latency metrics
      this.updateLatencyMetrics(connection, latency);
      
      // Calculate jitter
      const buffer = this.metricsBuffer.get(connectionId) || [];
      buffer.push(latency);
      
      // Keep only recent samples
      const windowStart = now - this.config.metricsWindow;
      const recentSamples = buffer.filter((_, i) => 
        now - (i * this.config.monitoringInterval) > windowStart
      );
      this.metricsBuffer.set(connectionId, recentSamples);

      if (recentSamples.length >= this.config.thresholds.minSamples) {
        connection.metrics.jitter = this.calculateJitter(recentSamples);
      }

      // Reset consecutive failures on success
      connection.consecutiveFailures = 0;
      connection.connected = true;
    } else {
      // Increment failure count
      connection.consecutiveFailures++;
      connection.metrics.errorRate++;
    }

    // Update health level
    const oldHealth = connection.health;
    connection.health = this.calculateHealthLevel(connection);

    if (oldHealth !== connection.health) {
      this.callbacks.onHealthChange?.(connectionId, connection.health);
      this.handleHealthTransition(connectionId, oldHealth, connection.health);
    }

    this.callbacks.onMetricsUpdate?.(connectionId, connection.metrics);
  }

  /**
   * Report connection loss
   */
  reportConnectionLoss(connectionId: string, error?: Error): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.connected = false;
    connection.health = ConnectionHealthLevel.DISCONNECTED;
    connection.consecutiveFailures++;

    if (error) {
      connection.errors.push({
        name: error.name,
        message: error.message,
        code: 'CONNECTION_LOST',
        type: 'connection',
        recoverable: true,
        timestamp: Date.now(),
      } as WebSocketError);
    }

    this.callbacks.onConnectionLost?.(connectionId, connection.type);
    this.logEvent({
      type: 'connection_lost',
      timestamp: Date.now(),
      data: { connectionId, type: connection.type, error: error?.message },
    });

    // Check if emergency stop is needed
    this.evaluateEmergencyStop();
  }

  /**
   * Report connection restored
   */
  reportConnectionRestored(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.connected = true;
    connection.consecutiveFailures = 0;
    connection.reconnectAttempts++;

    this.callbacks.onConnectionRestored?.(connectionId, connection.type);
    this.logEvent({
      type: 'connection_restored',
      timestamp: Date.now(),
      data: { connectionId, type: connection.type },
    });
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (this.monitoringTimer) return;

    this.monitoringTimer = setInterval(() => {
      this.checkAllConnections();
    }, this.config.monitoringInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(connectionId: string): ConnectionHealthStatus | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * Get all connections status
   */
  getAllConnectionsStatus(): Map<string, ConnectionHealthStatus> {
    return new Map(this.connections);
  }

  /**
   * Get overall system health
   */
  getOverallHealth(): ConnectionHealthLevel {
    let worstHealth = ConnectionHealthLevel.EXCELLENT;
    const healthPriority = [
      ConnectionHealthLevel.EXCELLENT,
      ConnectionHealthLevel.GOOD,
      ConnectionHealthLevel.FAIR,
      ConnectionHealthLevel.POOR,
      ConnectionHealthLevel.CRITICAL,
      ConnectionHealthLevel.DISCONNECTED,
    ];

    for (const connection of this.connections.values()) {
      const currentPriority = healthPriority.indexOf(connection.health);
      const worstPriority = healthPriority.indexOf(worstHealth);
      if (currentPriority > worstPriority) {
        worstHealth = connection.health;
      }
    }

    return worstHealth;
  }

  /**
   * Get critical connections
   */
  getCriticalConnections(): string[] {
    const critical: string[] = [];
    for (const [id, connection] of this.connections) {
      if (
        connection.health === ConnectionHealthLevel.CRITICAL ||
        connection.health === ConnectionHealthLevel.DISCONNECTED
      ) {
        critical.push(id);
      }
    }
    return critical;
  }

  /**
   * Export event log
   */
  exportEventLog(): ConnectionEvent[] {
    return [...this.eventLog];
  }

  /**
   * Export metrics report
   */
  exportMetricsReport(): any {
    const report: any = {
      timestamp: new Date().toISOString(),
      connections: {},
      overallHealth: this.getOverallHealth(),
      criticalConnections: this.getCriticalConnections(),
      safeStateTransitions: this.safeStateTransitions,
    };

    for (const [id, connection] of this.connections) {
      report.connections[id] = {
        type: connection.type,
        health: connection.health,
        connected: connection.connected,
        metrics: connection.metrics,
        uptime: connection.uptime,
        reconnectAttempts: connection.reconnectAttempts,
        recentErrors: connection.errors.slice(-5),
      };
    }

    return report;
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: typeof this.callbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Manual override - force connection health
   */
  forceConnectionHealth(
    connectionId: string,
    health: ConnectionHealthLevel
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const oldHealth = connection.health;
    connection.health = health;

    this.logEvent({
      type: 'manual_override',
      timestamp: Date.now(),
      data: { connectionId, oldHealth, newHealth: health },
    });

    if (oldHealth !== health) {
      this.callbacks.onHealthChange?.(connectionId, health);
    }
  }

  /**
   * Destroy monitor and cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.connections.clear();
    this.metricsBuffer.clear();
    this.eventLog = [];
    this.callbacks = {};
  }

  // Private methods

  private initializeMetrics(): ConnectionQualityMetrics {
    return {
      latency: 0,
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      packetLoss: 0,
      jitter: 0,
      throughput: 0,
      errorRate: 0,
      lastUpdate: Date.now(),
    };
  }

  private updateLatencyMetrics(
    connection: ConnectionHealthStatus,
    latency: number
  ): void {
    const metrics = connection.metrics;
    
    metrics.latency = latency;
    metrics.minLatency = Math.min(metrics.minLatency, latency);
    metrics.maxLatency = Math.max(metrics.maxLatency, latency);
    
    // Exponential moving average
    if (metrics.averageLatency === 0) {
      metrics.averageLatency = latency;
    } else {
      metrics.averageLatency = metrics.averageLatency * 0.9 + latency * 0.1;
    }
    
    metrics.lastUpdate = Date.now();
  }

  private calculateJitter(samples: number[]): number {
    if (samples.length < 2) return 0;

    let sumDiff = 0;
    for (let i = 1; i < samples.length; i++) {
      sumDiff += Math.abs(samples[i] - samples[i - 1]);
    }

    return sumDiff / (samples.length - 1);
  }

  private calculateHealthLevel(
    connection: ConnectionHealthStatus
  ): ConnectionHealthLevel {
    if (!connection.connected) {
      return ConnectionHealthLevel.DISCONNECTED;
    }

    const { metrics } = connection;
    const { thresholds } = this.config;

    // Check critical conditions
    if (
      Date.now() - connection.lastSeen > thresholds.criticalTimeout ||
      connection.consecutiveFailures > 5
    ) {
      return ConnectionHealthLevel.CRITICAL;
    }

    // Evaluate based on latency and packet loss
    if (
      metrics.averageLatency <= thresholds.excellentLatency &&
      metrics.packetLoss === 0
    ) {
      return ConnectionHealthLevel.EXCELLENT;
    }

    if (
      metrics.averageLatency <= thresholds.goodLatency &&
      metrics.packetLoss < 1
    ) {
      return ConnectionHealthLevel.GOOD;
    }

    if (
      metrics.averageLatency <= thresholds.fairLatency &&
      metrics.packetLoss < 5
    ) {
      return ConnectionHealthLevel.FAIR;
    }

    if (
      metrics.averageLatency <= thresholds.poorLatency &&
      metrics.packetLoss < thresholds.packetLossThreshold
    ) {
      return ConnectionHealthLevel.POOR;
    }

    return ConnectionHealthLevel.CRITICAL;
  }

  private checkAllConnections(): void {
    const now = Date.now();

    for (const [id, connection] of this.connections) {
      // Check for timeout
      const timeSinceLastSeen = now - connection.lastSeen;
      if (
        timeSinceLastSeen > this.config.thresholds.criticalTimeout &&
        connection.connected
      ) {
        this.reportConnectionLoss(
          id,
          new Error(`Connection timeout: ${timeSinceLastSeen}ms`)
        );
      }

      // Update uptime
      if (connection.connected) {
        connection.uptime += this.config.monitoringInterval;
      }

      // Calculate packet loss
      const buffer = this.metricsBuffer.get(id) || [];
      const expectedSamples = Math.floor(
        this.config.metricsWindow / this.config.monitoringInterval
      );
      if (expectedSamples > 0) {
        connection.metrics.packetLoss =
          ((expectedSamples - buffer.length) / expectedSamples) * 100;
      }
    }
  }

  private handleHealthTransition(
    connectionId: string,
    oldHealth: ConnectionHealthLevel,
    newHealth: ConnectionHealthLevel
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Log significant transitions
    if (
      (oldHealth === ConnectionHealthLevel.EXCELLENT ||
        oldHealth === ConnectionHealthLevel.GOOD) &&
      (newHealth === ConnectionHealthLevel.CRITICAL ||
        newHealth === ConnectionHealthLevel.DISCONNECTED)
    ) {
      this.logEvent({
        type: 'health_degradation',
        timestamp: Date.now(),
        data: {
          connectionId,
          type: connection.type,
          oldHealth,
          newHealth,
          metrics: connection.metrics,
        },
      });
    }
  }

  private evaluateEmergencyStop(): void {
    if (!this.config.enableAutoStop) return;

    const criticalConnections = this.getCriticalConnections();
    const criticalTypes = new Set<ConnectionType>();

    for (const id of criticalConnections) {
      const connection = this.connections.get(id);
      if (connection) {
        criticalTypes.add(connection.type);
      }
    }

    // Check if critical connection types warrant emergency stop
    const shouldTriggerEmergency =
      criticalTypes.has(ConnectionType.HARDWARE_SERIAL) ||
      criticalTypes.has(ConnectionType.HARDWARE_USB) ||
      criticalTypes.has(ConnectionType.HARDWARE_GPIO) ||
      (criticalTypes.has(ConnectionType.WEBSOCKET) &&
        criticalConnections.length > 1);

    if (shouldTriggerEmergency) {
      // Use grace period before triggering
      setTimeout(() => {
        // Re-check after grace period
        const stillCritical = this.getCriticalConnections();
        if (stillCritical.length > 0) {
          this.triggerEmergencyStop(
            'Critical connection loss detected',
            stillCritical
          );
        }
      }, this.config.gracePeriod);
    }
  }

  private triggerEmergencyStop(reason: string, connections: string[]): void {
    const transition: SafeStateTransition = {
      trigger: 'connection_loss',
      fromState: SystemSafetyState.SAFE,
      toState: SystemSafetyState.EMERGENCY,
      timestamp: Date.now(),
      reason,
      actions: [
        'Emergency stop activated',
        'All systems halted',
        'Awaiting connection restoration',
      ],
    };

    this.safeStateTransitions.push(transition);
    this.callbacks.onSafeStateTransition?.(transition);
    this.callbacks.onEmergencyStop?.(reason, connections);

    this.logEvent({
      type: 'emergency_stop_triggered',
      timestamp: Date.now(),
      data: { reason, connections, transition },
    });
  }

  private logEvent(event: ConnectionEvent): void {
    if (!this.config.logging.enabled) return;

    this.eventLog.push(event);

    // Trim log if needed
    if (this.eventLog.length > this.config.logging.maxEvents) {
      this.eventLog = this.eventLog.slice(-this.config.logging.maxEvents);
    }

    // Persist to storage if enabled
    if (this.config.logging.persistToStorage) {
      try {
        const key = 'connection_health_log';
        const existing = localStorage.getItem(key);
        const allEvents = existing ? JSON.parse(existing) : [];
        allEvents.push(event);
        
        // Keep only recent events in storage
        const recentEvents = allEvents.slice(-this.config.logging.maxEvents);
        localStorage.setItem(key, JSON.stringify(recentEvents));
      } catch (error) {
        console.error('Failed to persist connection event:', error);
      }
    }
  }
}