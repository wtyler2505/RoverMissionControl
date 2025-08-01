/**
 * Transport Manager
 * Handles automatic transport switching between WebSocket and HTTP fallback
 * with compression status monitoring and seamless failover
 */

import { EventEmitter } from './EventEmitter';
import { 
  ConnectionState, 
  WebSocketError,
  Protocol,
  WebSocketMessage,
  MessageType,
  Priority
} from './types';

/**
 * Transport types supported
 */
export enum TransportType {
  WEBSOCKET = 'websocket',
  HTTP_LONGPOLL = 'http-longpoll',
  SOCKET_IO = 'socket.io'
}

/**
 * Transport status information
 */
export interface TransportStatus {
  type: TransportType;
  connected: boolean;
  latency: number;
  bandwidth: number; // KB/s
  compressionEnabled: boolean;
  compressionRatio?: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  lastError?: string;
  fallbackReason?: string;
}

/**
 * Transport metrics
 */
export interface TransportMetrics {
  messagessSent: number;
  messagesReceived: number;
  bytessSent: number;
  bytesReceived: number;
  errors: number;
  reconnects: number;
  avgLatency: number;
  avgBandwidth: number;
  compressionSavings: number;
}

/**
 * HTTP fallback client configuration
 */
export interface HttpFallbackConfig {
  baseUrl: string;
  pollTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Transport events
 */
export interface TransportEvents {
  'transport:switched': (from: TransportType, to: TransportType, reason: string) => void;
  'transport:error': (error: Error, transport: TransportType) => void;
  'transport:status': (status: TransportStatus) => void;
  'compression:status': (enabled: boolean, ratio?: number) => void;
  'quality:change': (quality: TransportStatus['connectionQuality']) => void;
}

/**
 * HTTP Fallback Client
 */
class HttpFallbackClient {
  private config: HttpFallbackConfig;
  private sessionId?: string;
  private lastMessageId?: string;
  private polling = false;
  private abortController?: AbortController;
  private metrics: TransportMetrics = {
    messagessSent: 0,
    messagesReceived: 0,
    bytessSent: 0,
    bytesReceived: 0,
    errors: 0,
    reconnects: 0,
    avgLatency: 0,
    avgBandwidth: 0,
    compressionSavings: 0
  };

  constructor(config: HttpFallbackConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/fallback/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.sessionId = data.session_id;
      
      // Start polling
      this.startPolling();
    } catch (error) {
      throw new Error(`Failed to create HTTP session: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.polling = false;
    
    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.sessionId) {
      try {
        await fetch(`${this.config.baseUrl}/api/fallback/session/${this.sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.getAuthToken()}`
          }
        });
      } catch (error) {
        console.error('Failed to close HTTP session:', error);
      }
    }
  }

  async sendMessage(message: WebSocketMessage): Promise<void> {
    if (!this.sessionId) {
      throw new Error('Not connected');
    }

    const startTime = performance.now();
    
    try {
      const response = await fetch(`${this.config.baseUrl}/api/fallback/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({
          session_id: this.sessionId,
          type: message.type,
          payload: message.payload,
          compression: message.compressed
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const latency = performance.now() - startTime;
      this.updateMetrics('send', message, latency);
    } catch (error) {
      this.metrics.errors++;
      throw error;
    }
  }

  private async startPolling(): Promise<void> {
    this.polling = true;

    while (this.polling) {
      try {
        this.abortController = new AbortController();
        
        const response = await fetch(`${this.config.baseUrl}/api/fallback/poll`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getAuthToken()}`
          },
          body: JSON.stringify({
            session_id: this.sessionId,
            last_message_id: this.lastMessageId,
            timeout: this.config.pollTimeout
          }),
          signal: this.abortController.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          for (const message of data.messages) {
            this.onMessage?.(message);
          }
          this.lastMessageId = data.last_message_id;
        }

        // Update metrics
        this.metrics.messagesReceived += data.messages?.length || 0;
        
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Polling was intentionally stopped
          break;
        }
        
        this.metrics.errors++;
        console.error('Polling error:', error);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      }
    }
  }

  private updateMetrics(direction: 'send' | 'receive', message: any, latency?: number): void {
    const messageSize = JSON.stringify(message).length;
    
    if (direction === 'send') {
      this.metrics.messagessSent++;
      this.metrics.bytessSent += messageSize;
    } else {
      this.metrics.messagesReceived++;
      this.metrics.bytesReceived += messageSize;
    }

    if (latency) {
      // Update average latency
      const totalMessages = this.metrics.messagessSent + this.metrics.messagesReceived;
      this.metrics.avgLatency = 
        (this.metrics.avgLatency * (totalMessages - 1) + latency) / totalMessages;
    }
  }

  private getAuthToken(): string {
    // Get auth token from localStorage or session
    return localStorage.getItem('auth_token') || '';
  }

  getMetrics(): TransportMetrics {
    return { ...this.metrics };
  }

  // Message handler callback
  onMessage?: (message: any) => void;
}

/**
 * Transport Manager Implementation
 */
export class TransportManager extends EventEmitter<TransportEvents> {
  private currentTransport: TransportType = TransportType.SOCKET_IO;
  private webSocketClient?: any; // Reference to main WebSocket client
  private httpFallback?: HttpFallbackClient;
  private status: TransportStatus = {
    type: TransportType.SOCKET_IO,
    connected: false,
    latency: 0,
    bandwidth: 0,
    compressionEnabled: false,
    connectionQuality: 'good'
  };
  private metrics = new Map<TransportType, TransportMetrics>();
  private qualityCheckInterval?: NodeJS.Timeout;
  private transportCheckInterval?: NodeJS.Timeout;
  private fallbackConfig: HttpFallbackConfig = {
    baseUrl: window.location.origin,
    pollTimeout: 30,
    maxRetries: 3,
    retryDelay: 1000
  };

  constructor() {
    super();
    this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * Initialize metrics for all transports
   */
  private initializeMetrics(): void {
    const emptyMetrics: TransportMetrics = {
      messagessSent: 0,
      messagesReceived: 0,
      bytessSent: 0,
      bytesReceived: 0,
      errors: 0,
      reconnects: 0,
      avgLatency: 0,
      avgBandwidth: 0,
      compressionSavings: 0
    };

    this.metrics.set(TransportType.WEBSOCKET, { ...emptyMetrics });
    this.metrics.set(TransportType.HTTP_LONGPOLL, { ...emptyMetrics });
    this.metrics.set(TransportType.SOCKET_IO, { ...emptyMetrics });
  }

  /**
   * Start monitoring transport quality
   */
  private startMonitoring(): void {
    // Quality check every 5 seconds
    this.qualityCheckInterval = setInterval(() => {
      this.checkConnectionQuality();
    }, 5000);

    // Transport health check every 10 seconds
    this.transportCheckInterval = setInterval(() => {
      this.checkTransportHealth();
    }, 10000);
  }

  /**
   * Set WebSocket client reference
   */
  setWebSocketClient(client: any): void {
    this.webSocketClient = client;
    
    // Listen for WebSocket events
    if (client) {
      client.on('connect', () => {
        this.updateTransportStatus(TransportType.SOCKET_IO, true);
      });

      client.on('disconnect', () => {
        this.updateTransportStatus(TransportType.SOCKET_IO, false);
        this.checkFallbackNeeded();
      });

      client.on('error', (error: WebSocketError) => {
        this.emit('transport:error', error, TransportType.SOCKET_IO);
        this.checkFallbackNeeded();
      });
    }
  }

  /**
   * Update transport status
   */
  private updateTransportStatus(type: TransportType, connected: boolean): void {
    this.status.type = type;
    this.status.connected = connected;
    this.emit('transport:status', { ...this.status });
  }

  /**
   * Check if fallback is needed
   */
  private async checkFallbackNeeded(): Promise<void> {
    // Check if WebSocket is truly unavailable
    const wsAvailable = await this.checkWebSocketAvailability();
    
    if (!wsAvailable && this.currentTransport !== TransportType.HTTP_LONGPOLL) {
      await this.switchToHttpFallback('WebSocket unavailable');
    }
  }

  /**
   * Check WebSocket availability
   */
  private async checkWebSocketAvailability(): Promise<boolean> {
    try {
      // Try to create a test WebSocket connection
      const testWs = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          testWs.close();
          resolve(false);
        }, 3000);

        testWs.onopen = () => {
          clearTimeout(timeout);
          testWs.close();
          resolve(true);
        };

        testWs.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }

  /**
   * Switch to HTTP fallback
   */
  private async switchToHttpFallback(reason: string): Promise<void> {
    if (this.currentTransport === TransportType.HTTP_LONGPOLL) {
      return;
    }

    const previousTransport = this.currentTransport;
    
    try {
      // Create HTTP fallback client
      this.httpFallback = new HttpFallbackClient(this.fallbackConfig);
      
      // Set message handler
      this.httpFallback.onMessage = (message) => {
        this.webSocketClient?.handleIncomingMessage(message);
      };

      // Connect
      await this.httpFallback.connect();
      
      this.currentTransport = TransportType.HTTP_LONGPOLL;
      this.status.fallbackReason = reason;
      
      this.emit('transport:switched', previousTransport, TransportType.HTTP_LONGPOLL, reason);
      this.updateTransportStatus(TransportType.HTTP_LONGPOLL, true);
      
    } catch (error) {
      this.emit('transport:error', error as Error, TransportType.HTTP_LONGPOLL);
      throw error;
    }
  }

  /**
   * Switch back to WebSocket
   */
  private async switchToWebSocket(): Promise<void> {
    if (this.currentTransport === TransportType.SOCKET_IO) {
      return;
    }

    const previousTransport = this.currentTransport;
    
    try {
      // Disconnect HTTP fallback
      if (this.httpFallback) {
        await this.httpFallback.disconnect();
        this.httpFallback = undefined;
      }

      // Reconnect WebSocket
      if (this.webSocketClient) {
        await this.webSocketClient.reconnect();
      }

      this.currentTransport = TransportType.SOCKET_IO;
      delete this.status.fallbackReason;
      
      this.emit('transport:switched', previousTransport, TransportType.SOCKET_IO, 'WebSocket available');
      
    } catch (error) {
      this.emit('transport:error', error as Error, TransportType.SOCKET_IO);
      // Stay on fallback
      this.currentTransport = previousTransport;
    }
  }

  /**
   * Check connection quality
   */
  private checkConnectionQuality(): void {
    const metrics = this.metrics.get(this.currentTransport);
    if (!metrics) return;

    // Calculate quality based on latency and error rate
    const errorRate = metrics.errors / (metrics.messagessSent + metrics.messagesReceived || 1);
    
    let quality: TransportStatus['connectionQuality'];
    
    if (this.status.latency < 50 && errorRate < 0.01) {
      quality = 'excellent';
    } else if (this.status.latency < 150 && errorRate < 0.05) {
      quality = 'good';
    } else if (this.status.latency < 300 && errorRate < 0.1) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    if (quality !== this.status.connectionQuality) {
      this.status.connectionQuality = quality;
      this.emit('quality:change', quality);
      this.emit('transport:status', { ...this.status });
    }

    // Check compression effectiveness
    if (metrics.compressionSavings > 0) {
      const ratio = metrics.compressionSavings / metrics.bytessSent;
      this.status.compressionRatio = ratio;
      this.emit('compression:status', true, ratio);
    }
  }

  /**
   * Check transport health and switch if needed
   */
  private async checkTransportHealth(): Promise<void> {
    // If on HTTP fallback, periodically check if WebSocket is available again
    if (this.currentTransport === TransportType.HTTP_LONGPOLL) {
      const wsAvailable = await this.checkWebSocketAvailability();
      if (wsAvailable) {
        await this.switchToWebSocket();
      }
    }

    // If quality is poor for too long, consider switching
    if (this.status.connectionQuality === 'poor' && this.currentTransport === TransportType.SOCKET_IO) {
      const metrics = this.metrics.get(TransportType.SOCKET_IO);
      if (metrics && metrics.errors > 10) {
        await this.switchToHttpFallback('Poor connection quality');
      }
    }
  }

  /**
   * Send message through current transport
   */
  async sendMessage(message: WebSocketMessage): Promise<void> {
    if (this.currentTransport === TransportType.HTTP_LONGPOLL && this.httpFallback) {
      await this.httpFallback.sendMessage(message);
    } else if (this.webSocketClient) {
      await this.webSocketClient.sendMessage(message.type, message.payload, message.priority);
    } else {
      throw new Error('No transport available');
    }

    // Update metrics
    const metrics = this.metrics.get(this.currentTransport);
    if (metrics) {
      metrics.messagessSent++;
      metrics.bytessSent += JSON.stringify(message).length;
    }
  }

  /**
   * Get current transport type
   */
  getCurrentTransport(): TransportType {
    return this.currentTransport;
  }

  /**
   * Get transport status
   */
  getStatus(): TransportStatus {
    return { ...this.status };
  }

  /**
   * Get transport metrics
   */
  getMetrics(transport?: TransportType): TransportMetrics | Map<TransportType, TransportMetrics> {
    if (transport) {
      return this.metrics.get(transport) || this.createEmptyMetrics();
    }
    return new Map(this.metrics);
  }

  /**
   * Update compression status
   */
  updateCompressionStatus(enabled: boolean, ratio?: number): void {
    this.status.compressionEnabled = enabled;
    this.status.compressionRatio = ratio;
    this.emit('compression:status', enabled, ratio);
    this.emit('transport:status', { ...this.status });
  }

  /**
   * Force transport switch (for testing)
   */
  async forceTransport(type: TransportType): Promise<void> {
    if (type === TransportType.HTTP_LONGPOLL) {
      await this.switchToHttpFallback('Manual switch');
    } else if (type === TransportType.SOCKET_IO || type === TransportType.WEBSOCKET) {
      await this.switchToWebSocket();
    }
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): TransportMetrics {
    return {
      messagessSent: 0,
      messagesReceived: 0,
      bytessSent: 0,
      bytesReceived: 0,
      errors: 0,
      reconnects: 0,
      avgLatency: 0,
      avgBandwidth: 0,
      compressionSavings: 0
    };
  }

  /**
   * Destroy transport manager
   */
  destroy(): void {
    if (this.qualityCheckInterval) {
      clearInterval(this.qualityCheckInterval);
    }

    if (this.transportCheckInterval) {
      clearInterval(this.transportCheckInterval);
    }

    if (this.httpFallback) {
      this.httpFallback.disconnect();
    }

    this.removeAllListeners();
    this.metrics.clear();
  }
}