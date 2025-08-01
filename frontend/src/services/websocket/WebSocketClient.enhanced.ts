/**
 * Enhanced WebSocketClient with ReconnectionManager integration
 * This file shows the modifications needed to integrate the ReconnectionManager
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
import { ReconnectionManager, ReconnectionConfig, ReconnectionStrategy } from './ReconnectionManager';

/**
 * Enhanced WebSocket configuration
 */
interface EnhancedWebSocketConfig extends WebSocketConfig {
  reconnection?: ReconnectionConfig;
}

/**
 * Default enhanced configuration
 */
const DEFAULT_ENHANCED_CONFIG: EnhancedWebSocketConfig = {
  url: 'ws://localhost:8000',
  reconnect: true,
  reconnectAttempts: 10,
  reconnectDelay: 500,
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
    tokenRefreshThreshold: 300,
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
  },
  reconnection: {
    strategy: ReconnectionStrategy.EXPONENTIAL,
    baseDelay: 500,
    maxDelay: 30000,
    maxAttempts: 10,
    factor: 2,
    jitterType: 'equal' as any,
    jitterFactor: 0.3,
    resetTimeout: 60000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 30000,
    enableTelemetry: true
  }
};

/**
 * Enhanced WebSocket client with ReconnectionManager
 */
export class EnhancedWebSocketClient implements IWebSocketClient {
  public readonly config: EnhancedWebSocketConfig;
  private socket?: Socket;
  private connectionManager: ConnectionManager;
  private messageQueue: MessageQueue;
  private reconnectionManager: ReconnectionManager;
  private eventHandlers: WebSocketEventHandlers = {};
  private subscriptions = new Map<string, SubscriptionConfig>();
  private protocolNegotiation?: ProtocolNegotiation;
  private heartbeatSequence = 0;
  private pendingMessages = new Map<string, { resolve: Function; reject: Function; timestamp: number }>();
  private isReconnecting = false;
  private manualDisconnect = false;

  constructor(config: Partial<EnhancedWebSocketConfig> = {}) {
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config };
    
    // Initialize managers
    this.connectionManager = new ConnectionManager(this.config);
    this.messageQueue = new MessageQueue(this.config);
    this.reconnectionManager = new ReconnectionManager(this.config.reconnection);
    
    // Setup manager callbacks
    this.setupManagerCallbacks();
    this.setupReconnectionCallbacks();
  }

  /**
   * Setup reconnection manager callbacks
   */
  private setupReconnectionCallbacks(): void {
    // Listen to reconnection events
    this.reconnectionManager.on('reconnect-attempt', async () => {
      try {
        await this.performReconnect();
      } catch (error) {
        this.reconnectionManager.onReconnectFailure(error as WebSocketError);
      }
    });

    this.reconnectionManager.on('reconnect-success', () => {
      this.isReconnecting = false;
      this.connectionManager.setState(ConnectionState.CONNECTED);
      this.emit('reconnected', { 
        attempts: this.reconnectionManager.getMetrics().totalAttempts 
      });
    });

    this.reconnectionManager.on('circuit-breaker-open', (error) => {
      this.connectionManager.setState(ConnectionState.ERROR);
      this.emit('error', error);
    });

    this.reconnectionManager.on('max-attempts-reached', (error) => {
      this.connectionManager.setState(ConnectionState.ERROR);
      this.emit('error', error);
    });
  }

  /**
   * Connect with enhanced reconnection
   */
  async connect(options: ConnectionOptions = {}): Promise<void> {
    if (this.connectionManager.isConnected()) {
      throw new Error('Already connected');
    }

    this.manualDisconnect = false;
    this.connectionManager.setState(ConnectionState.CONNECTING);

    try {
      await this.setupSocket(options);
      await this.negotiateProtocol();
      
      if (this.config.auth.enabled && options.auth) {
        await this.authenticate(options.auth);
      }
      
      this.messageQueue.processQueue();
      this.reconnectionManager.onReconnectSuccess();
      
    } catch (error) {
      this.connectionManager.onDisconnected(error as Error);
      
      // Trigger reconnection if enabled
      if (this.config.reconnect && !this.manualDisconnect) {
        this.startReconnection();
      }
      
      throw error;
    }
  }

  /**
   * Start reconnection process
   */
  private async startReconnection(): Promise<void> {
    if (this.isReconnecting || !this.reconnectionManager.canReconnect()) {
      return;
    }

    this.isReconnecting = true;
    this.connectionManager.setState(ConnectionState.RECONNECTING);

    try {
      await this.reconnectionManager.scheduleReconnect();
    } catch (error) {
      this.isReconnecting = false;
      this.connectionManager.setState(ConnectionState.ERROR);
      this.emit('error', error);
    }
  }

  /**
   * Perform actual reconnection
   */
  private async performReconnect(): Promise<void> {
    try {
      // Clean up existing socket
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = undefined;
      }

      // Attempt to reconnect
      await this.setupSocket({});
      await this.negotiateProtocol();
      
      // Re-authenticate if needed
      const authData = this.getStoredAuthData();
      if (this.config.auth.enabled && authData) {
        await this.authenticate(authData);
      }
      
      // Restore subscriptions
      await this.restoreSubscriptions();
      
      // Process queued messages
      this.messageQueue.processQueue();
      
      // Success
      this.reconnectionManager.onReconnectSuccess();
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Setup socket with enhanced error handling
   */
  private async setupSocket(options: ConnectionOptions): Promise<void> {
    const socketOptions = {
      reconnection: false, // We handle reconnection manually
      timeout: this.config.timeout,
      transports: ['websocket', 'polling'],
      auth: options.auth || {},
      query: options.query || {}
    };

    this.socket = io(this.config.url, socketOptions);

    // Setup event handlers
    this.socket.on('connect', () => {
      this.connectionManager.onConnected();
      this.startHeartbeat();
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.stopHeartbeat();
      this.connectionManager.onDisconnected(new Error(reason));
      
      // Trigger reconnection if not manual disconnect
      if (!this.manualDisconnect && this.config.reconnect) {
        this.startReconnection();
      }
    });

    this.socket.on('error', (error) => {
      const wsError: WebSocketError = {
        code: 'SOCKET_ERROR',
        message: error.message || 'Socket error',
        severity: 'high' as any,
        timestamp: Date.now(),
        context: { error }
      };
      
      this.emit('error', wsError);
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);

      this.socket!.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Disconnect with manual flag
   */
  async disconnect(): Promise<void> {
    this.manualDisconnect = true;
    this.reconnectionManager.cancelReconnect();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = undefined;
    }
    
    this.messageQueue.stopProcessing();
    this.connectionManager.setState(ConnectionState.DISCONNECTED);
  }

  /**
   * Reconnect manually
   */
  async reconnect(): Promise<void> {
    this.reconnectionManager.reset();
    await this.disconnect();
    await this.connect();
  }

  /**
   * Cancel ongoing reconnection
   */
  cancelReconnect(): void {
    this.reconnectionManager.cancelReconnect();
    this.isReconnecting = false;
  }

  /**
   * Get reconnection manager
   */
  getReconnectionManager(): ReconnectionManager {
    return this.reconnectionManager;
  }

  /**
   * Restore subscriptions after reconnection
   */
  private async restoreSubscriptions(): Promise<void> {
    const promises = Array.from(this.subscriptions.entries()).map(
      async ([id, config]) => {
        try {
          await this.sendMessage(MessageType.COMMAND, {
            action: 'subscribe',
            subscriptionId: id,
            config
          }, Priority.HIGH);
        } catch (error) {
          console.error(`Failed to restore subscription ${id}:`, error);
        }
      }
    );

    await Promise.allSettled(promises);
  }

  /**
   * Get stored authentication data
   */
  private getStoredAuthData(): AuthenticationData | null {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        return { token };
      }
    } catch (error) {
      console.error('Failed to get stored auth data:', error);
    }
    return null;
  }

  // ... rest of the WebSocketClient methods remain the same ...
}