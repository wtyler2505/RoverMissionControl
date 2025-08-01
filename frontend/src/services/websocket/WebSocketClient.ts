/**
 * WebSocketClient - Main WebSocket Client Implementation
 * Comprehensive client with Socket.IO integration, authentication, and advanced features
 */

import { io, Socket } from 'socket.io-client';
import {
  WebSocketClient as IWebSocketClient,
  WebSocketConfig,
  ConnectionState,
  ConnectionStatus,
  ConnectionOptions,
  MessageType,
  Priority,
  Protocol,
  AuthenticationData,
  WebSocketMessage,
  SubscriptionConfig,
  WebSocketEventHandlers,
  ConnectionMetrics,
  HeartbeatData,
  WebSocketError,
  ProtocolNegotiation
} from './types';
import { ConnectionManager } from './ConnectionManager';
import { MessageQueue } from './MessageQueue';
import { ReconnectionLogger } from './ReconnectionLogger';
import { HeartbeatManager, HeartbeatConfig, HeartbeatStats } from './HeartbeatManager';
import { 
  ProtocolManager, 
  ProtocolMetrics, 
  ProtocolRecommendation,
  NegotiationResult,
  ProtocolPreferences
} from './ProtocolManager';
import { 
  TelemetryManager, 
  TelemetryStreamConfig, 
  TelemetryDataPoint, 
  TelemetryStreamStats,
  StreamSubscription 
} from './TelemetryManager';
import { TransportManager, TransportType, TransportStatus } from './TransportManager';
import { AlertWebSocketManager, AlertWebSocketConfig } from './AlertWebSocketManager';
import { 
  AlertWebSocketMessage, 
  AlertMessageData, 
  AlertAcknowledgment, 
  AlertSyncRequest, 
  AlertSyncResponse,
  ExtendedWebSocketEventHandlers 
} from './types';

/**
 * Default configuration for WebSocket client
 */
const DEFAULT_CONFIG: WebSocketConfig = {
  url: 'ws://localhost:8000',
  reconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  reconnectDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 20000,
  heartbeatInterval: 25000,
  heartbeatTimeout: 60000,
  protocols: [Protocol.JSON, Protocol.MESSAGEPACK],
  compression: true,
  debug: false,
  auth: {
    enabled: true,
    tokenRefreshThreshold: 300, // 5 minutes
    autoRefresh: true
  },
  queue: {
    maxSize: 1000,
    persistOffline: true,
    priorityEnabled: true
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 5000,
    latencyThreshold: 1000
  }
};

/**
 * Advanced WebSocket client with Socket.IO integration
 */
export class WebSocketClient implements IWebSocketClient {
  public readonly config: WebSocketConfig;
  private socket?: Socket;
  private connectionManager: ConnectionManager;
  private messageQueue: MessageQueue;
  private reconnectionLogger: ReconnectionLogger;
  private heartbeatManager: HeartbeatManager;
  private protocolManager: ProtocolManager;
  private telemetryManager: TelemetryManager;
  private transportManager: TransportManager;
  private alertManager: AlertWebSocketManager;
  private eventHandlers: ExtendedWebSocketEventHandlers = {};
  private subscriptions = new Map<string, SubscriptionConfig>();
  private protocolNegotiation?: ProtocolNegotiation;
  private heartbeatSequence = 0;
  private pendingMessages = new Map<string, { resolve: Function; reject: Function; timestamp: number }>();

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize managers
    this.connectionManager = new ConnectionManager(this.config);
    this.messageQueue = new MessageQueue(this.config);
    this.reconnectionLogger = new ReconnectionLogger();
    
    // Set up message queue callbacks
    this.setupMessageQueue();
    
    // Initialize heartbeat manager
    const heartbeatConfig: HeartbeatConfig = {
      interval: this.config.heartbeatInterval,
      timeout: this.config.heartbeatTimeout,
      maxMissedHeartbeats: 3,
      enablePing: true,
      enablePong: true
    };
    
    this.heartbeatManager = new HeartbeatManager(heartbeatConfig, {
      onHeartbeat: (data) => {
        this.connectionManager.onHeartbeat(data);
        this.eventHandlers.onHeartbeat?.(data);
      },
      onTimeout: (consecutiveMissed) => {
        if (this.config.debug) {
          console.error(`Heartbeat timeout: ${consecutiveMissed} consecutive missed`);
        }
        this.handleHeartbeatTimeout();
      },
      onUnhealthy: (stats) => {
        if (this.config.debug) {
          console.warn('Connection unhealthy:', stats);
        }
      },
      onHealthy: () => {
        if (this.config.debug) {
          console.log('Connection healthy again');
        }
      },
      onLatencyWarning: (latency) => {
        if (this.config.debug) {
          console.warn(`High latency detected: ${latency}ms`);
        }
      }
    });
    
    // Initialize protocol manager
    const protocolPreferences: Partial<ProtocolPreferences> = {
      preferredProtocol: this.config.protocols[0],
      autoSwitch: true,
      switchThreshold: {
        errorRate: 0.05,
        latency: 100,
        throughput: 10
      }
    };
    this.protocolManager = new ProtocolManager(protocolPreferences);
    
    // Initialize telemetry manager
    this.telemetryManager = new TelemetryManager(this);
    
    // Initialize transport manager
    this.transportManager = new TransportManager();
    this.transportManager.setWebSocketClient(this);
    
    // Initialize alert manager
    this.alertManager = new AlertWebSocketManager(config.alerts);
    this.alertManager.initialize(this);
    
    // Setup protocol manager event listeners
    this.setupProtocolManagerListeners();
    
    // Setup transport manager listeners
    this.setupTransportManagerListeners();
    
    // Setup manager callbacks
    this.setupManagerCallbacks();
  }

  /**
   * Get current connection status
   */
  get connectionStatus(): ConnectionStatus {
    const status = this.connectionManager.getStatus();
    const queueStats = this.messageQueue.getStats();
    
    status.queueStatus = {
      size: queueStats.total,
      processing: queueStats.processing,
      lastProcessed: undefined // TODO: Track from queue
    };
    
    return status;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(options: ConnectionOptions = {}): Promise<void> {
    if (this.connectionManager.isConnected()) {
      throw new Error('Already connected');
    }

    this.connectionManager.setState(ConnectionState.CONNECTING);

    try {
      // Setup Socket.IO connection
      await this.setupSocket(options);
      
      // Perform protocol negotiation
      await this.negotiateProtocol();
      
      // Authenticate if enabled
      if (this.config.auth.enabled && options.auth) {
        await this.authenticate(options.auth);
      }
      
      // Start message queue processing
      this.messageQueue.processQueue();
      
      // Start heartbeat monitoring
      if (this.socket) {
        this.heartbeatManager.start(this.socket);
      }
      
    } catch (error) {
      this.connectionManager.onDisconnected(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    // Stop heartbeat monitoring
    this.heartbeatManager.stop();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
    
    this.messageQueue.stopProcessing();
    this.connectionManager.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Send a message
   */
  async sendMessage(
    type: MessageType,
    payload: any,
    priority: Priority = Priority.NORMAL
  ): Promise<void> {
    if (!this.connectionManager.isConnected()) {
      // Queue message for later
      await this.messageQueue.enqueue(type, payload, priority);
      return;
    }

    // Use ProtocolManager to determine the best protocol for this message
    const recommendedProtocol = this.protocolManager.getRecommendedProtocol({
      id: '',
      type,
      payload,
      timestamp: Date.now(),
      protocol: Protocol.JSON,
      compressed: false,
      acknowledged: false,
      priority
    });
    
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      timestamp: Date.now(),
      protocol: recommendedProtocol || this.protocolManager.getCurrentProtocol(),
      compressed: false, // Will be set by ProtocolManager if needed
      acknowledged: false,
      priority
    };

    return this.sendSocketMessage(message);
  }

  /**
   * Subscribe to telemetry stream
   */
  async subscribe(config: SubscriptionConfig): Promise<string> {
    const subscriptionId = this.generateSubscriptionId();
    
    if (this.connectionManager.isConnected()) {
      await this.sendMessage(MessageType.COMMAND, {
        action: 'subscribe',
        subscriptionId,
        config
      }, Priority.HIGH);
    }
    
    this.subscriptions.set(subscriptionId, config);
    this.connectionManager.addSubscription(subscriptionId, config);
    
    return subscriptionId;
  }

  /**
   * Unsubscribe from telemetry stream
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    if (this.connectionManager.isConnected()) {
      await this.sendMessage(MessageType.COMMAND, {
        action: 'unsubscribe',
        subscriptionId
      }, Priority.HIGH);
    }
    
    this.subscriptions.delete(subscriptionId);
    this.connectionManager.removeSubscription(subscriptionId);
  }

  /**
   * Authenticate with the server
   */
  async authenticate(credentials: AuthenticationData): Promise<void> {
    if (!this.connectionManager.isConnected()) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, this.config.timeout);

      this.socket?.emit('authenticate', credentials, (response: any) => {
        clearTimeout(timeoutId);
        
        if (response.success) {
          this.connectionManager.onAuthenticated(response.data);
          resolve();
        } else {
          const error = new Error(response.error || 'Authentication failed');
          this.connectionManager.onAuthenticationFailed(error);
          reject(error);
        }
      });
    });
  }

  /**
   * Register event handler
   */
  on<K extends keyof ExtendedWebSocketEventHandlers>(
    event: K,
    handler: ExtendedWebSocketEventHandlers[K]
  ): void {
    this.eventHandlers[event] = handler;
    
    // Forward alert-specific events to alert manager
    if (event.startsWith('onAlert')) {
      this.alertManager.on(event.replace('on', '').toLowerCase() as any, handler as any);
    }
  }

  /**
   * Unregister event handler
   */
  off<K extends keyof ExtendedWebSocketEventHandlers>(
    event: K,
    handler?: ExtendedWebSocketEventHandlers[K]
  ): void {
    if (handler) {
      if (this.eventHandlers[event] === handler) {
        delete this.eventHandlers[event];
      }
    } else {
      delete this.eventHandlers[event];
    }
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return this.connectionManager.getStatus().metrics;
  }


  /**
   * Get message queue statistics
   */
  getQueueStats() {
    return this.messageQueue.getStats();
  }

  /**
   * Get backpressure statistics
   */
  getBackpressureStats() {
    return this.messageQueue.getBackpressureStats();
  }

  /**
   * Clear message queue
   */
  async clearQueue(): Promise<void> {
    await this.messageQueue.clear();
  }

  /**
   * Export metrics and debugging data
   */
  exportMetrics(): string {
    return JSON.stringify({
      connection: this.connectionManager.exportData(),
      queue: this.messageQueue.exportData(),
      heartbeat: this.heartbeatManager.exportData(),
      subscriptions: Object.fromEntries(this.subscriptions),
      protocolNegotiation: this.protocolNegotiation,
      reconnectionStats: this.reconnectionLogger.getStats(),
      timestamp: Date.now()
    }, null, 2);
  }

  /**
   * Get telemetry manager instance
   */
  getTelemetryManager(): TelemetryManager {
    return this.telemetryManager;
  }

  /**
   * Subscribe to a telemetry stream
   */
  async subscribeTelemetry(config: TelemetryStreamConfig): Promise<string> {
    return await this.telemetryManager.subscribe(config);
  }

  /**
   * Unsubscribe from a telemetry stream
   */
  async unsubscribeTelemetry(streamId: string): Promise<void> {
    return await this.telemetryManager.unsubscribe(streamId);
  }

  /**
   * Get telemetry data for a stream
   */
  getTelemetryData(streamId: string, count?: number): TelemetryDataPoint[] {
    return this.telemetryManager.getData(streamId, count);
  }

  /**
   * Get telemetry stream statistics
   */
  getTelemetryStreamStats(streamId: string): TelemetryStreamStats | null {
    return this.telemetryManager.getStreamStats(streamId);
  }

  /**
   * Get all telemetry stream statistics
   */
  getAllTelemetryStreamStats(): Map<string, TelemetryStreamStats> {
    return this.telemetryManager.getAllStreamStats();
  }

  /**
   * Get active telemetry subscriptions
   */
  getActiveTelemetrySubscriptions(): StreamSubscription[] {
    return this.telemetryManager.getActiveSubscriptions();
  }

  /**
   * Clear telemetry data for a stream
   */
  clearTelemetryStreamData(streamId: string): void {
    this.telemetryManager.clearStreamData(streamId);
  }

  /**
   * Export telemetry stream data
   */
  exportTelemetryStreamData(streamId: string): {
    config: TelemetryStreamConfig;
    data: TelemetryDataPoint[];
    stats: TelemetryStreamStats;
  } | null {
    return this.telemetryManager.exportStreamData(streamId);
  }

  /**
   * Get current transport type
   */
  getCurrentTransport(): TransportType {
    return this.transportManager.getCurrentTransport();
  }
  
  /**
   * Get transport status
   */
  getTransportStatus(): TransportStatus {
    return this.transportManager.getStatus();
  }
  
  /**
   * Get transport metrics
   */
  getTransportMetrics(transport?: TransportType) {
    return this.transportManager.getMetrics(transport);
  }
  
  /**
   * Force transport switch (for testing)
   */
  async forceTransport(type: TransportType): Promise<void> {
    return this.transportManager.forceTransport(type);
  }

  /**
   * Send alert via WebSocket
   */
  async sendAlert(alertData: AlertMessageData): Promise<string> {
    return this.alertManager.sendAlert(alertData);
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(
    alertId: string, 
    acknowledgedBy: string,
    syncAcrossClients = true
  ): Promise<void> {
    return this.alertManager.acknowledgeAlert(alertId, acknowledgedBy, syncAcrossClients);
  }

  /**
   * Synchronize alerts with server
   */
  async syncAlerts(syncRequest?: Partial<AlertSyncRequest>): Promise<AlertSyncResponse> {
    return this.alertManager.syncAlerts(syncRequest);
  }

  /**
   * Get alert manager status
   */
  getAlertStatus(): {
    connectionState: any;
    queueSizes: {
      outgoing: number;
      acknowledgments: number;
      retries: number;
    };
    metrics: {
      averageLatency: number;
      currentBatchSize: number;
      successRate: number;
    };
  } {
    return this.alertManager.getStatus();
  }

  /**
   * Cleanup and destroy client
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    
    this.connectionManager.destroy();
    await this.messageQueue.destroy();
    this.heartbeatManager.stop();
    this.protocolManager.destroy();
    await this.telemetryManager.destroy();
    this.transportManager.destroy();
    this.alertManager.destroy();
    
    this.subscriptions.clear();
    this.eventHandlers = {};
    this.pendingMessages.clear();
  }

  private async setupSocket(options: ConnectionOptions): Promise<void> {
    const socketOptions = {
      transports: options.transports || ['websocket', 'polling'],
      upgrade: options.upgrade !== false,
      rememberUpgrade: options.rememberUpgrade !== false,
      timeout: this.config.timeout,
      forceNew: options.forceNew || false,
      multiplex: options.multiplex !== false,
      auth: options.auth,
      query: options.query,
      extraHeaders: options.headers,
      // Enable binary support for Socket.IO
      forceBase64: false,
      enableBinary: true
    };

    this.socket = io(this.config.url, socketOptions);

    // Setup event handlers
    this.socket.on('connect', () => {
      this.connectionManager.onConnected();
      this.eventHandlers.onConnect?.({
        type: 'connect',
        timestamp: Date.now()
      });
    });

    this.socket.on('disconnect', (reason: string) => {
      const error = reason !== 'io client disconnect' ? new Error(reason) : undefined;
      this.connectionManager.onDisconnected(error);
      this.eventHandlers.onDisconnect?.({
        type: 'disconnect',
        timestamp: Date.now(),
        data: { reason }
      });
    });

    this.socket.on('connect_error', (error: Error) => {
      this.connectionManager.onDisconnected(error);
      this.eventHandlers.onError?.(this.createWebSocketError(error, 'connection'));
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      this.connectionManager.onConnected();
      this.eventHandlers.onReconnect?.({
        type: 'reconnect',
        timestamp: Date.now(),
        data: { attemptNumber }
      });
    });

    // Message handlers
    this.socket.on('message', (data: any) => {
      this.handleIncomingMessage(data);
    });
    
    // Binary message handler
    this.socket.on('binary_message', (data: ArrayBuffer | Uint8Array) => {
      this.handleIncomingMessage(data);
    });

    this.socket.on('telemetry', (data: any) => {
      this.handleTelemetryMessage(data);
    });
    
    // Binary telemetry handler
    this.socket.on('binary_telemetry', (data: ArrayBuffer | Uint8Array) => {
      this.handleTelemetryMessage(data);
    });

    // Alert-specific message handlers
    this.socket.on('alert', (data: any) => {
      this.handleAlertMessage(data);
    });

    this.socket.on('alert_batch', (data: any) => {
      this.handleAlertMessage(data);
    });

    this.socket.on('alert_sync', (data: any) => {
      this.handleAlertMessage(data);
    });

    this.socket.on('heartbeat', (data: HeartbeatData) => {
      // Let HeartbeatManager handle it instead
      // The manager will call the callbacks
    });

    this.socket.on('error', (error: Error) => {
      const wsError = this.createWebSocketError(error, 'protocol');
      this.eventHandlers.onError?.(wsError);
    });

    // Wait for connection
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.socket!.on('connect', () => {
        clearTimeout(timeoutId);
        resolve();
      });

      this.socket!.on('connect_error', (error: Error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  private async negotiateProtocol(): Promise<void> {
    if (!this.socket) throw new Error('Socket not initialized');

    // Use ProtocolManager's capabilities
    const capabilities = this.protocolManager.getCapabilities();
    
    this.protocolNegotiation = {
      supportedProtocols: capabilities.supportedProtocols,
      preferredProtocol: this.config.protocols[0],
      compressionSupported: capabilities.compressionSupported,
      compressionEnabled: false
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Protocol negotiation timeout'));
      }, 5000);

      this.socket!.emit('negotiate_protocol', this.protocolNegotiation, async (response: any) => {
        clearTimeout(timeoutId);
        
        if (response.success) {
          try {
            // Let ProtocolManager handle the negotiation result
            const negotiationResult = await this.protocolManager.negotiate({
              supportedProtocols: response.supportedProtocols || [response.protocol],
              preferredProtocol: response.protocol,
              compressionSupported: response.compression,
              compressionEnabled: response.compression
            });
            
            this.protocolNegotiation!.selectedProtocol = negotiationResult.selectedProtocol;
            this.protocolNegotiation!.compressionEnabled = negotiationResult.compressionEnabled;
            
            resolve();
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(response.error || 'Protocol negotiation failed'));
        }
      });
    });
  }

  private async sendSocketMessage(message: WebSocketMessage): Promise<void> {
    if (!this.socket) throw new Error('Socket not connected');

    // Serialize message based on protocol
    const serializedMessage = await this.serializeMessage(message);
    const messageSize = this.estimateMessageSize(serializedMessage);
    
    // Use binary frame if data is binary
    const eventName = (serializedMessage instanceof ArrayBuffer || serializedMessage instanceof Uint8Array) 
      ? 'binary_message' 
      : 'message';

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(message.id);
        reject(new Error('Message timeout'));
      }, this.config.timeout);

      this.pendingMessages.set(message.id, {
        resolve: () => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(message.id);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          this.pendingMessages.delete(message.id);
          reject(error);
        },
        timestamp: Date.now()
      });
      
      this.socket!.emit(eventName as any, serializedMessage, (ack: any) => {
        const pending = this.pendingMessages.get(message.id);
        if (pending) {
          if (ack.success) {
            this.connectionManager.onMessageSent(messageSize);
            pending.resolve();
          } else {
            pending.reject(new Error(ack.error || 'Message failed'));
          }
        }
      });
    });
  }

  private async handleIncomingMessage(data: any): Promise<void> {
    try {
      const message = await this.deserializeMessage(data);
      const messageSize = this.estimateMessageSize(data);
      
      this.connectionManager.onMessageReceived(messageSize);
      this.eventHandlers.onMessage?.(message);
      
      // Handle acknowledgment if needed
      if (data.id && this.pendingMessages.has(data.id)) {
        const pending = this.pendingMessages.get(data.id);
        pending?.resolve();
      }
      
    } catch (error) {
      const wsError = this.createWebSocketError(error as Error, 'protocol');
      this.eventHandlers.onError?.(wsError);
    }
  }

  private async handleTelemetryMessage(data: any): Promise<void> {
    try {
      const message = await this.deserializeMessage(data);
      const messageSize = this.estimateMessageSize(data);
      
      // Update subscription metrics
      if (data.subscriptionId) {
        this.connectionManager.updateSubscription(data.subscriptionId, messageSize);
      }
      
      this.connectionManager.onMessageReceived(messageSize);
      this.eventHandlers.onMessage?.(message);
      
    } catch (error) {
      const wsError = this.createWebSocketError(error as Error, 'protocol');
      this.eventHandlers.onError?.(wsError);
    }
  }

  private async handleAlertMessage(data: any): Promise<void> {
    try {
      const message = await this.deserializeMessage(data);
      const messageSize = this.estimateMessageSize(data);
      
      this.connectionManager.onMessageReceived(messageSize);
      
      // Route to alert manager based on message type
      if (message.type === MessageType.ALERT) {
        this.eventHandlers.onAlertReceived?.(message.payload as AlertWebSocketMessage);
      } else if (message.type === MessageType.ALERT_BATCH) {
        // Alert batch messages are handled internally by AlertWebSocketManager
        this.eventHandlers.onMessage?.(message);
      } else if (message.type === MessageType.ALERT_SYNC) {
        this.eventHandlers.onAlertSyncComplete?.(message.payload as AlertSyncResponse);
      }
      
      // Also emit generic message event
      this.eventHandlers.onMessage?.(message);
      
    } catch (error) {
      const wsError = this.createWebSocketError(error as Error, 'protocol');
      this.eventHandlers.onError?.(wsError);
    }
  }

  private setupMessageQueue(): void {
    // Set up message queue callbacks
    this.messageQueue.setEventCallbacks({
      onQueueUpdate: (size, processing) => {
        this.eventHandlers.onQueueUpdate?.(size, processing);
      },
      onError: (error) => {
        const wsError = this.createWebSocketError(error, 'queue');
        this.eventHandlers.onError?.(wsError);
      },
      onMessageProcessed: (message, success) => {
        if (this.config.debug) {
          console.log(`Queue message ${success ? 'sent' : 'failed'}:`, message.id);
        }
      },
      onBackpressure: (active, stats) => {
        if (this.config.debug) {
          console.log(`Backpressure ${active ? 'active' : 'inactive'}:`, stats);
        }
        // Could emit custom event for UI updates
      },
      onMessageDropped: (message, reason) => {
        if (this.config.debug) {
          console.warn(`Message dropped:`, message.id, reason);
        }
        const error = new Error(`Message dropped: ${reason}`);
        const wsError = this.createWebSocketError(error, 'queue', false);
        this.eventHandlers.onError?.(wsError);
      }
    });

    // Set queue send callback
    this.messageQueue.setSendCallback(async (queuedMessage) => {
      if (!this.connectionManager.isConnected()) {
        return false;
      }
      
      try {
        const message: WebSocketMessage = {
          id: queuedMessage.id,
          type: queuedMessage.type,
          payload: queuedMessage.payload,
          timestamp: queuedMessage.timestamp,
          protocol: this.protocolManager.getCurrentProtocol(),
          compressed: false, // Will be set by ProtocolManager if needed
          acknowledged: false,
          priority: queuedMessage.priority,
          retryCount: queuedMessage.retryCount
        };
        
        await this.sendSocketMessage(message);
        return true;
      } catch (error) {
        if (this.config.debug) {
          console.warn('Failed to send queued message:', error);
        }
        return false;
      }
    });
  }

  private setupManagerCallbacks(): void {
    this.connectionManager.setEventCallbacks({
      onStateChange: (state, previousState) => {
        this.eventHandlers.onStateChange?.(state, previousState);
        
        // Handle reconnection state
        if (state === ConnectionState.RECONNECTING) {
          this.handleReconnection();
        }
        
        // Process queued messages when connected
        if (state === ConnectionState.CONNECTED && previousState !== ConnectionState.CONNECTED) {
          this.messageQueue.processQueue();
        }
        
        // Log state transitions for telemetry
        if (state === ConnectionState.ERROR && previousState === ConnectionState.RECONNECTING) {
          const status = this.connectionManager.getStatus();
          this.reconnectionLogger.logGiveUp(status.reconnectAttempt || 0, state);
        }
      },
      onError: (error) => {
        this.eventHandlers.onError?.(error);
      },
      onMetricsUpdate: (metrics) => {
        this.eventHandlers.onMetricsUpdate?.(metrics);
      },
      onTokenRefresh: async () => {
        // TODO: Implement token refresh logic
        throw new Error('Token refresh not implemented');
      },
      onHeartbeatTimeout: () => {
        if (this.socket) {
          this.socket.disconnect();
        }
      }
    });

  }

  private async serializeMessage(message: WebSocketMessage): Promise<ArrayBuffer | Uint8Array | any> {
    // Use ProtocolManager for binary protocols
    const currentProtocol = this.protocolManager.getCurrentProtocol();
    
    if (currentProtocol === Protocol.JSON) {
      // For JSON, return the object directly (Socket.IO will handle JSON serialization)
      return message;
    }
    
    // For binary protocols, use ProtocolManager's encode method
    try {
      const encoded = await this.protocolManager.encode(message);
      return encoded;
    } catch (error) {
      // Fallback to JSON if encoding fails
      if (this.config.debug) {
        console.error('Binary encoding failed, falling back to JSON:', error);
      }
      return message;
    }
  }

  private async deserializeMessage(data: ArrayBuffer | Uint8Array | any): Promise<WebSocketMessage> {
    // Check if data is binary
    if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
      try {
        // Use ProtocolManager to decode binary data
        return await this.protocolManager.decode(data);
      } catch (error) {
        if (this.config.debug) {
          console.error('Binary decoding failed:', error);
        }
        throw error;
      }
    }
    
    // For JSON data, return as-is (Socket.IO already parsed it)
    return data as WebSocketMessage;
  }

  private estimateMessageSize(data: any): number {
    if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Uint8Array) {
      return data.byteLength;
    } else if (typeof data === 'string') {
      return data.length;
    } else {
      return JSON.stringify(data).length;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createWebSocketError(
    originalError: Error,
    type: WebSocketError['type'],
    recoverable = true
  ): WebSocketError {
    const error = new Error(originalError.message) as WebSocketError;
    error.name = 'WebSocketError';
    error.code = originalError.name || 'UNKNOWN';
    error.type = type;
    error.recoverable = recoverable;
    error.timestamp = Date.now();
    error.context = {
      state: this.connectionManager.getState(),
      connected: this.connectionManager.isConnected()
    };
    
    return error;
  }

  /**
   * Handle automatic reconnection
   */
  private async handleReconnection(): Promise<void> {
    const status = this.connectionManager.getStatus();
    const attemptNumber = status.reconnectAttempt || 0;
    
    if (this.config.debug) {
      console.log(`Attempting reconnection #${attemptNumber}...`);
    }

    const reconnectData = {
      attemptNumber,
      maxAttempts: this.config.reconnectAttempts,
      nextRetryIn: this.connectionManager.getNextRetryDelay?.()
    };
    
    // Log reconnection attempt
    this.reconnectionLogger.logAttempt(reconnectData, this.connectionManager.getState());
    
    // Emit reconnection attempt event
    this.eventHandlers.onReconnectAttempt?.(reconnectData);

    try {
      // Save current auth data if available
      const authData = this.connectionManager.getAuthData();
      
      // Attempt to reconnect
      await this.connect({ 
        auth: authData,
        forceNew: true 
      });
      
      // Restore subscriptions
      for (const [id, config] of this.subscriptions) {
        await this.sendMessage(MessageType.COMMAND, {
          action: 'subscribe',
          subscriptionId: id,
          config
        }, Priority.HIGH);
      }
      
      // Process queued messages
      this.messageQueue.processQueue();
      
      // Log successful reconnection
      this.reconnectionLogger.logSuccess(
        attemptNumber,
        this.connectionManager.getState(),
        this.connectionManager.getStatus().metrics
      );
      
      if (this.config.debug) {
        console.log('Reconnection successful');
      }
    } catch (error) {
      // Log failed reconnection
      this.reconnectionLogger.logFailure(
        attemptNumber,
        error as Error,
        this.connectionManager.getState()
      );
      
      if (this.config.debug) {
        console.error('Reconnection failed:', error);
      }
      
      // Connection manager will handle the next retry
    }
  }

  /**
   * Manually trigger reconnection
   */
  async reconnect(): Promise<void> {
    if (this.connectionManager.isConnected()) {
      throw new Error('Already connected');
    }
    
    // Log manual reconnection
    this.reconnectionLogger.logManualReconnect(this.connectionManager.getState());
    
    // Reset reconnection attempts
    this.connectionManager.resetReconnectAttempts?.();
    
    // Clear any existing error
    this.connectionManager.clearError();
    
    // Attempt connection
    await this.handleReconnection();
  }

  /**
   * Get reconnection statistics
   */
  getReconnectionStats() {
    return this.reconnectionLogger.getStats();
  }

  /**
   * Get heartbeat statistics
   */
  getHeartbeatStats(): HeartbeatStats {
    return this.heartbeatManager.getStats();
  }
  
  /**
   * Check if connection is healthy
   */
  isConnectionHealthy(): boolean {
    const heartbeatStats = this.heartbeatManager.getStats();
    return heartbeatStats.isHealthy && this.connectionManager.isConnected();
  }

  /**
   * Handle heartbeat timeout
   */
  private handleHeartbeatTimeout(): void {
    if (this.socket?.connected) {
      // Force disconnect to trigger reconnection
      this.socket.disconnect();
      
      // Create error for connection manager
      const error = new Error('Heartbeat timeout - connection appears to be dead');
      this.connectionManager.onDisconnected(error);
      
      // Emit error event
      const wsError = this.createWebSocketError(error, 'connection', true);
      this.eventHandlers.onError?.(wsError);
    }
  }

  
  /**
   * Get protocol performance metrics
   */
  getProtocolMetrics(): Map<Protocol, ProtocolMetrics> {
    return this.protocolManager.getMetrics();
  }
  
  /**
   * Get metrics for specific protocol
   */
  getProtocolMetricsForProtocol(protocol: Protocol): ProtocolMetrics | undefined {
    return this.protocolManager.getProtocolMetrics(protocol);
  }
  
  /**
   * Manually switch to a different protocol
   */
  async switchProtocol(protocol: Protocol): Promise<void> {
    try {
      await this.protocolManager.switchProtocol(protocol, 'manual');
      
      // Notify server about protocol change
      if (this.socket && this.connectionManager.isConnected()) {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Protocol switch notification timeout'));
          }, 5000);
          
          this.socket!.emit('switch_protocol', { protocol }, (response: any) => {
            clearTimeout(timeoutId);
            if (response.success) {
              resolve();
            } else {
              reject(new Error(response.error || 'Protocol switch failed'));
            }
          });
        });
      }
    } catch (error) {
      const wsError = this.createWebSocketError(error as Error, 'protocol');
      this.eventHandlers.onError?.(wsError);
      throw wsError;
    }
  }
  
  /**
   * Get protocol optimization recommendation
   */
  getProtocolRecommendation(): ProtocolRecommendation | null {
    // Force generation of fresh recommendation
    const currentProtocol = this.protocolManager.getCurrentProtocol();
    const metrics = this.protocolManager.getMetrics();
    
    // Find best performing protocol based on recent metrics
    let bestProtocol = currentProtocol;
    let bestScore = 0;
    
    for (const [protocol, protocolMetrics] of metrics) {
      if (protocolMetrics.messageCount < 10) continue; // Need enough data
      
      // Calculate simple performance score
      const latencyScore = 1000 / (protocolMetrics.encodingTime.average + protocolMetrics.decodingTime.average + 1);
      const throughputScore = protocolMetrics.throughput;
      const errorPenalty = 1 - protocolMetrics.errorRate;
      
      const score = (latencyScore + throughputScore) * errorPenalty;
      
      if (score > bestScore) {
        bestScore = score;
        bestProtocol = protocol;
      }
    }
    
    if (bestProtocol === currentProtocol) {
      return null;
    }
    
    const currentMetrics = metrics.get(currentProtocol);
    const recommendedMetrics = metrics.get(bestProtocol);
    
    if (!currentMetrics || !recommendedMetrics) {
      return null;
    }
    
    return {
      currentProtocol,
      recommendedProtocol: bestProtocol,
      reason: 'Better performance detected',
      confidence: Math.min(0.9, recommendedMetrics.messageCount / 100),
      potentialImprovement: {
        latency: ((currentMetrics.encodingTime.average - recommendedMetrics.encodingTime.average) / 
                  currentMetrics.encodingTime.average) * 100,
        throughput: ((recommendedMetrics.throughput - currentMetrics.throughput) / 
                     currentMetrics.throughput) * 100
      }
    };
  }
  
  /**
   * Get current protocol
   */
  getCurrentProtocol(): Protocol {
    return this.protocolManager.getCurrentProtocol();
  }
  
  /**
   * Setup transport manager event listeners
   */
  private setupTransportManagerListeners(): void {
    this.transportManager.on('transport:switched', (from, to, reason) => {
      if (this.config.debug) {
        console.log(`Transport switched from ${from} to ${to}: ${reason}`);
      }
      
      // Update protocol negotiation for HTTP fallback
      if (to === TransportType.HTTP_LONGPOLL) {
        this.protocolNegotiation = {
          ...this.protocolNegotiation!,
          compressionEnabled: false // HTTP fallback may not support same compression
        };
      }
    });
    
    this.transportManager.on('transport:error', (error, transport) => {
      const wsError = this.createWebSocketError(error, 'connection');
      this.eventHandlers.onError?.(wsError);
    });
    
    this.transportManager.on('transport:status', (status) => {
      // Could emit custom event for UI updates
      if (this.config.debug) {
        console.log('Transport status:', status);
      }
    });
    
    this.transportManager.on('compression:status', (enabled, ratio) => {
      if (this.protocolNegotiation) {
        this.protocolNegotiation.compressionEnabled = enabled;
      }
      
      // Update protocol manager about compression status
      if (ratio) {
        this.transportManager.updateCompressionStatus(enabled, ratio);
      }
    });
    
    this.transportManager.on('quality:change', (quality) => {
      if (this.config.debug) {
        console.log(`Connection quality: ${quality}`);
      }
    });
  }

  /**
   * Setup protocol manager event listeners
   */
  private setupProtocolManagerListeners(): void {
    this.protocolManager.on('protocol:switched', (event) => {
      if (this.config.debug) {
        console.log(`Protocol switched from ${event.from} to ${event.to} (${event.reason})`);
      }
      // Could emit custom event for UI updates
    });
    
    this.protocolManager.on('protocol:negotiated', (result) => {
      if (this.config.debug) {
        console.log('Protocol negotiated:', result);
      }
    });
    
    this.protocolManager.on('protocol:error', (error) => {
      this.eventHandlers.onError?.(error);
    });
    
    this.protocolManager.on('metrics:updated', (metrics) => {
      // Could emit custom event for UI updates
      if (this.config.debug && this.config.performance.enableMetrics) {
        console.log('Protocol metrics updated:', metrics);
      }
    });
    
    this.protocolManager.on('recommendation:available', (recommendation) => {
      if (this.config.debug) {
        console.log('Protocol recommendation available:', recommendation);
      }
      // Could emit custom event for UI to show recommendation
    });
  }
}