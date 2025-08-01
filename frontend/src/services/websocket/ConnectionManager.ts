/**
 * ConnectionManager - Advanced Connection State Management
 * Handles connection lifecycle, authentication, and reconnection logic
 */

import {
  ConnectionState,
  ConnectionStatus,
  ConnectionEvent,
  ConnectionMetrics,
  WebSocketError,
  WebSocketConfig,
  AuthenticationData,
  HeartbeatData,
  TelemetryStream,
  SubscriptionConfig
} from './types';

export class ConnectionManager {
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private previousState: ConnectionState = ConnectionState.DISCONNECTED;
  private config: WebSocketConfig;
  private metrics: ConnectionMetrics;
  private authData?: AuthenticationData;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private tokenRefreshTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private lastError?: WebSocketError;
  private connectionStartTime = 0;
  private reconnectAttempt = 0;
  private activeSubscriptions = new Map<string, TelemetryStream>();
  private eventCallbacks: {
    onStateChange?: (state: ConnectionState, previousState: ConnectionState) => void;
    onEvent?: (event: ConnectionEvent) => void;
    onError?: (error: WebSocketError) => void;
    onMetricsUpdate?: (metrics: ConnectionMetrics) => void;
    onTokenRefresh?: () => Promise<AuthenticationData>;
    onHeartbeatTimeout?: () => void;
  } = {};

  constructor(config: WebSocketConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
    
    if (this.config.performance.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  /**
   * Set event callbacks
   */
  setEventCallbacks(callbacks: typeof this.eventCallbacks): void {
    this.eventCallbacks = { ...this.eventCallbacks, ...callbacks };
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get previous connection state
   */
  getPreviousState(): ConnectionState {
    return this.previousState;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED || 
           this.state === ConnectionState.AUTHENTICATED ||
           this.state === ConnectionState.ACTIVE ||
           this.state === ConnectionState.IDLE;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.state === ConnectionState.AUTHENTICATED ||
           this.state === ConnectionState.ACTIVE ||
           this.state === ConnectionState.IDLE;
  }

  /**
   * Transition to a new state
   */
  setState(newState: ConnectionState, eventData?: any): void {
    if (this.state === newState) return;
    
    this.previousState = this.state;
    this.state = newState;
    
    // Handle state-specific logic
    this.handleStateTransition(newState, eventData);
    
    // Notify callbacks
    this.eventCallbacks.onStateChange?.(newState, this.previousState);
    
    // Create and emit event
    const event: ConnectionEvent = {
      type: this.getEventTypeFromState(newState),
      timestamp: Date.now(),
      data: eventData
    };
    
    this.eventCallbacks.onEvent?.(event);
    
    if (this.config.debug) {
      console.log(`WebSocket state: ${this.previousState} → ${newState}`, eventData);
    }
  }

  /**
   * Handle connection established
   */
  onConnected(): void {
    this.connectionStartTime = Date.now();
    this.reconnectAttempt = 0;
    this.metrics.connectionCount++;
    this.clearReconnectTimer();
    this.setState(ConnectionState.CONNECTED);
    
    if (this.config.heartbeatInterval > 0) {
      this.startHeartbeat();
    }
  }

  /**
   * Handle disconnection
   */
  onDisconnected(error?: Error): void {
    this.clearHeartbeat();
    this.clearTokenRefreshTimer();
    
    if (error) {
      const wsError = this.createWebSocketError(error, 'connection');
      this.lastError = wsError;
      this.setState(ConnectionState.ERROR, { error: wsError });
      this.eventCallbacks.onError?.(wsError);
    } else {
      this.setState(ConnectionState.DISCONNECTED);
    }
    
    // Start reconnection if enabled
    if (this.config.reconnect && this.reconnectAttempt < this.config.reconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle authentication success
   */
  onAuthenticated(authData: AuthenticationData): void {
    this.authData = authData;
    this.setState(ConnectionState.AUTHENTICATED, { auth: authData });
    
    // Schedule token refresh if needed
    if (this.config.auth.autoRefresh && authData.expiresAt) {
      this.scheduleTokenRefresh(authData.expiresAt);
    }
  }

  /**
   * Handle authentication failure
   */
  onAuthenticationFailed(error: Error): void {
    const wsError = this.createWebSocketError(error, 'authentication');
    this.lastError = wsError;
    this.setState(ConnectionState.ERROR, { error: wsError });
    this.eventCallbacks.onError?.(wsError);
  }

  /**
   * Handle heartbeat received
   */
  onHeartbeat(data: HeartbeatData): void {
    this.metrics.lastHeartbeat = data.timestamp;
    this.metrics.currentLatency = data.latency;
    this.updateAverageLatency(data.latency);
    
    const event: ConnectionEvent = {
      type: 'heartbeat',
      timestamp: Date.now(),
      data,
      latency: data.latency
    };
    
    this.eventCallbacks.onEvent?.(event);
    
    // Update state based on activity
    if (this.state === ConnectionState.AUTHENTICATED || this.state === ConnectionState.IDLE) {
      this.setState(ConnectionState.ACTIVE);
    }
  }

  /**
   * Handle message received
   */
  onMessageReceived(size: number): void {
    this.metrics.messagesReceived++;
    this.metrics.bytesReceived += size;
    
    // Update activity state
    if (this.isAuthenticated() && this.state !== ConnectionState.ACTIVE) {
      this.setState(ConnectionState.ACTIVE);
    }
  }

  /**
   * Handle message sent
   */
  onMessageSent(size: number): void {
    this.metrics.messagesSent++;
    this.metrics.bytesSent += size;
  }

  /**
   * Add subscription
   */
  addSubscription(id: string, config: SubscriptionConfig): void {
    const stream: TelemetryStream = {
      id,
      channel: config.channel,
      active: true,
      messageCount: 0,
      bytesReceived: 0,
      lastMessage: Date.now(),
      subscriptionConfig: config
    };
    
    this.activeSubscriptions.set(id, stream);
  }

  /**
   * Remove subscription
   */
  removeSubscription(id: string): void {
    this.activeSubscriptions.delete(id);
  }

  /**
   * Update subscription with received message
   */
  updateSubscription(id: string, messageSize: number): void {
    const subscription = this.activeSubscriptions.get(id);
    if (subscription) {
      subscription.messageCount++;
      subscription.bytesReceived += messageSize;
      subscription.lastMessage = Date.now();
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return {
      state: this.state,
      connected: this.isConnected(),
      authenticated: this.isAuthenticated(),
      lastConnected: this.connectionStartTime || undefined,
      lastDisconnected: this.previousState === ConnectionState.DISCONNECTED ? Date.now() : undefined,
      reconnectAttempt: this.reconnectAttempt,
      error: this.lastError,
      metrics: { ...this.metrics },
      activeSubscriptions: Array.from(this.activeSubscriptions.values()),
      queueStatus: {
        size: 0, // Will be updated by MessageQueue
        processing: false,
        lastProcessed: undefined
      }
    };
  }

  /**
   * Get authentication data
   */
  getAuthData(): AuthenticationData | undefined {
    return this.authData;
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.lastError = undefined;
    if (this.state === ConnectionState.ERROR) {
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Reset connection metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.eventCallbacks.onMetricsUpdate?.(this.metrics);
  }

  /**
   * Export connection data for debugging
   */
  exportData(): string {
    return JSON.stringify({
      state: this.state,
      previousState: this.previousState,
      metrics: this.metrics,
      authData: this.authData ? { ...this.authData, token: '[REDACTED]' } : undefined,
      activeSubscriptions: Array.from(this.activeSubscriptions.values()),
      config: this.config,
      timestamp: Date.now()
    }, null, 2);
  }

  /**
   * Get next retry delay for reconnection
   */
  getNextRetryDelay(): number {
    return this.calculateReconnectDelay();
  }

  /**
   * Reset reconnection attempts
   */
  resetReconnectAttempts(): void {
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.clearHeartbeat();
    this.clearReconnectTimer();
    this.clearTokenRefreshTimer();
    this.clearMetricsTimer();
    this.activeSubscriptions.clear();
    this.eventCallbacks = {};
  }

  private initializeMetrics(): ConnectionMetrics {
    return {
      connectionCount: 0,
      reconnectionCount: 0,
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      averageLatency: 0,
      currentLatency: 0,
      lastHeartbeat: 0,
      uptime: 0,
      errorCount: 0,
      queuedMessages: 0
    };
  }

  private handleStateTransition(newState: ConnectionState, eventData?: any): void {
    switch (newState) {
      case ConnectionState.CONNECTING:
        this.connectionStartTime = Date.now();
        break;
        
      case ConnectionState.RECONNECTING:
        this.metrics.reconnectionCount++;
        break;
        
      case ConnectionState.ERROR:
        this.metrics.errorCount++;
        break;
        
      case ConnectionState.IDLE:
        // Start idle timer if needed
        break;
    }
  }

  private getEventTypeFromState(state: ConnectionState): ConnectionEvent['type'] {
    switch (state) {
      case ConnectionState.CONNECTED:
        return 'connect';
      case ConnectionState.DISCONNECTED:
      case ConnectionState.ERROR:
        return 'disconnect';
      case ConnectionState.RECONNECTING:
        return 'reconnect';
      case ConnectionState.AUTHENTICATED:
        return 'authenticated';
      default:
        return 'connect';
    }
  }

  private startHeartbeat(): void {
    // Heartbeat is now managed by HeartbeatManager in WebSocketClient
    // This method is kept for backward compatibility but does nothing
    // The HeartbeatManager will call onHeartbeatTimeout when needed
  }

  private clearHeartbeat(): void {
    // Heartbeat is now managed by HeartbeatManager in WebSocketClient
    // This method is kept for backward compatibility but does nothing
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    
    const delay = this.calculateReconnectDelay();
    this.setState(ConnectionState.RECONNECTING, { delay, attempt: this.reconnectAttempt + 1 });
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempt++;
      // Reconnection logic will be handled by WebSocketClient
    }, delay);
  }

  private calculateReconnectDelay(): number {
    const baseDelay = this.config.reconnectDelay;
    const maxDelay = this.config.reconnectDelayMax;
    const randomization = this.config.randomizationFactor;
    
    // Exponential backoff
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);
    
    // Add randomization to prevent thundering herd
    const randomizedDelay = cappedDelay * (1 + (Math.random() - 0.5) * randomization);
    
    return Math.max(randomizedDelay, 0);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private scheduleTokenRefresh(expiresAt: number): void {
    this.clearTokenRefreshTimer();
    
    const refreshTime = expiresAt - (this.config.auth.tokenRefreshThreshold * 1000);
    const delay = refreshTime - Date.now();
    
    if (delay > 0) {
      this.tokenRefreshTimer = setTimeout(async () => {
        try {
          if (this.eventCallbacks.onTokenRefresh) {
            const newAuthData = await this.eventCallbacks.onTokenRefresh();
            this.onAuthenticated(newAuthData);
          }
        } catch (error) {
          this.onAuthenticationFailed(error as Error);
        }
      }, delay);
    }
  }

  private clearTokenRefreshTimer(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = undefined;
    }
  }

  private startMetricsCollection(): void {
    this.clearMetricsTimer();
    
    this.metricsTimer = setInterval(() => {
      // Update uptime
      if (this.connectionStartTime > 0) {
        this.metrics.uptime = Date.now() - this.connectionStartTime;
      }
      
      this.eventCallbacks.onMetricsUpdate?.(this.metrics);
    }, this.config.performance.metricsInterval);
  }

  private clearMetricsTimer(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
  }

  private updateAverageLatency(newLatency: number): void {
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = newLatency;
    } else {
      // Exponential moving average
      this.metrics.averageLatency = (this.metrics.averageLatency * 0.9) + (newLatency * 0.1);
    }
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
      state: this.state,
      reconnectAttempt: this.reconnectAttempt,
      uptime: this.metrics.uptime
    };
    
    return error;
  }
}