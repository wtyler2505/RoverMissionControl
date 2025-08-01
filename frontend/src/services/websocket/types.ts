/**
 * WebSocket Types and Interfaces
 * Comprehensive TypeScript definitions for WebSocket communication
 */

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  IDLE = 'idle',
  ACTIVE = 'active'
}

export enum MessageType {
  COMMAND = 'command',
  TELEMETRY = 'telemetry',
  STATUS = 'status',
  HEARTBEAT = 'heartbeat',
  AUTH = 'auth',
  ERROR = 'error',
  NOTIFICATION = 'notification',
  BINARY = 'binary',
  // Alert-specific message types
  ALERT = 'alert',
  ALERT_ACK = 'alert_ack',
  ALERT_SYNC = 'alert_sync',
  ALERT_BATCH = 'alert_batch'
}

export enum Protocol {
  JSON = 'json',
  MESSAGEPACK = 'messagepack',
  CBOR = 'cbor',
  BINARY = 'binary'
}

export enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface WebSocketConfig {
  url: string;
  reconnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
  reconnectDelayMax: number;
  randomizationFactor: number;
  timeout: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  protocols: Protocol[];
  compression: boolean;
  debug: boolean;
  auth: {
    enabled: boolean;
    tokenRefreshThreshold: number; // seconds before expiry to refresh
    autoRefresh: boolean;
  };
  queue: {
    maxSize: number;
    persistOffline: boolean;
    priorityEnabled: boolean;
  };
  performance: {
    enableMetrics: boolean;
    metricsInterval: number;
    latencyThreshold: number; // ms
  };
  alerts?: {
    batchSize?: number;
    batchTimeout?: number;
    compressionThreshold?: number;
    maxRetries?: number;
    retryBackoffMs?: number;
    syncInterval?: number;
    acknowledgmentTimeout?: number;
    resyncOnReconnect?: boolean;
    subscribedPriorities?: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
    autoAcknowledgeInfo?: boolean;
    adaptiveBatching?: boolean;
    lowLatencyThreshold?: number;
    highLatencyThreshold?: number;
  };
}

export interface AuthenticationData {
  token?: string;
  refreshToken?: string;
  userId?: string;
  role?: string;
  permissions?: string[];
  expiresAt?: number;
}

export interface ConnectionMetrics {
  connectionCount: number;
  reconnectionCount: number;
  messagesReceived: number;
  messagesSent: number;
  bytesReceived: number;
  bytesSent: number;
  averageLatency: number;
  currentLatency: number;
  lastHeartbeat: number;
  uptime: number;
  errorCount: number;
  queuedMessages: number;
}

export interface QueuedMessage {
  id: string;
  type: MessageType;
  payload: any;
  priority: Priority;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  expiresAt?: number;
}

export interface WebSocketMessage {
  id: string;
  type: MessageType;
  payload: any;
  timestamp: number;
  protocol: Protocol;
  compressed: boolean;
  acknowledged: boolean;
  retryCount?: number;
  priority?: Priority;
}

export interface ConnectionEvent {
  type: 'connect' | 'disconnect' | 'reconnect' | 'error' | 'authenticated' | 'heartbeat';
  timestamp: number;
  data?: any;
  error?: Error;
  latency?: number;
}

export interface WebSocketError extends Error {
  code: string;
  type: 'connection' | 'authentication' | 'protocol' | 'timeout' | 'queue' | 'unknown';
  recoverable: boolean;
  timestamp: number;
  context?: any;
}

export interface HeartbeatData {
  timestamp: number;
  clientTime: number;
  serverTime: number;
  latency: number;
  sequence: number;
}

export interface SubscriptionConfig {
  channel: string;
  filter?: Record<string, any>;
  compression?: boolean;
  protocol?: Protocol;
  priority?: Priority;
}

export interface TelemetryStream {
  id: string;
  channel: string;
  active: boolean;
  messageCount: number;
  bytesReceived: number;
  lastMessage: number;
  subscriptionConfig: SubscriptionConfig;
}

export interface ConnectionStatus {
  state: ConnectionState;
  connected: boolean;
  authenticated: boolean;
  lastConnected?: number;
  lastDisconnected?: number;
  reconnectAttempt: number;
  error?: WebSocketError;
  metrics: ConnectionMetrics;
  activeSubscriptions: TelemetryStream[];
  queueStatus: {
    size: number;
    processing: boolean;
    lastProcessed?: number;
  };
  protocolNegotiation?: ProtocolNegotiation;
}

export interface WebSocketEventHandlers {
  onConnect?: (event: ConnectionEvent) => void;
  onDisconnect?: (event: ConnectionEvent) => void;
  onReconnect?: (event: ConnectionEvent) => void;
  onReconnectAttempt?: (data: ReconnectAttemptData) => void;
  onError?: (error: WebSocketError) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onStateChange?: (state: ConnectionState, previousState: ConnectionState) => void;
  onAuthenticated?: (data: AuthenticationData) => void;
  onHeartbeat?: (data: HeartbeatData) => void;
  onQueueUpdate?: (queueSize: number, processing: boolean) => void;
  onMetricsUpdate?: (metrics: ConnectionMetrics) => void;
}

export interface ReconnectAttemptData {
  attemptNumber: number;
  maxAttempts: number;
  nextRetryIn?: number;
}

export interface ProtocolNegotiation {
  supportedProtocols: Protocol[];
  preferredProtocol: Protocol;
  selectedProtocol?: Protocol;
  compressionSupported: boolean;
  compressionEnabled: boolean;
}

export interface ConnectionOptions {
  forceNew?: boolean;
  multiplex?: boolean;
  transports?: ('websocket' | 'polling')[];
  upgrade?: boolean;
  rememberUpgrade?: boolean;
  auth?: AuthenticationData;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

// React Context Types
export interface WebSocketContextValue {
  client: WebSocketClient | null;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  isAuthenticated: boolean;
  connect: (options?: ConnectionOptions) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (type: MessageType, payload: any, priority?: Priority) => Promise<void>;
  subscribe: (config: SubscriptionConfig) => Promise<string>;
  unsubscribe: (subscriptionId: string) => Promise<void>;
  authenticate: (credentials: AuthenticationData) => Promise<void>;
  getMetrics: () => ConnectionMetrics;
  clearQueue: () => Promise<void>;
  exportMetrics: () => string;
}

// Event Types for React Components
export interface ConnectionStatusProps {
  showDetails?: boolean;
  compact?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onStatusClick?: () => void;
}

export interface ConnectionModalProps {
  open: boolean;
  onClose: () => void;
  onConnect?: (options: ConnectionOptions) => void;
  onDisconnect?: () => void;
  connectionStatus: ConnectionStatus;
  config: WebSocketConfig;
}

// Storage interface for offline message persistence
export interface MessageStorage {
  save: (messages: QueuedMessage[]) => Promise<void>;
  load: () => Promise<QueuedMessage[]>;
  clear: () => Promise<void>;
  size: () => Promise<number>;
}

// Forward declaration for WebSocketClient
export interface WebSocketClient {
  config: WebSocketConfig;
  connectionStatus: ConnectionStatus;
  connect(options?: ConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  sendMessage(type: MessageType, payload: any, priority?: Priority): Promise<void>;
  subscribe(config: SubscriptionConfig): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  authenticate(credentials: AuthenticationData): Promise<void>;
  on<K extends keyof WebSocketEventHandlers>(event: K, handler: WebSocketEventHandlers[K]): void;
  off<K extends keyof WebSocketEventHandlers>(event: K, handler?: WebSocketEventHandlers[K]): void;
  getMetrics(): ConnectionMetrics;
  exportMetrics(): string;
  destroy(): Promise<void>;
  getHeartbeatStats(): any; // Will be typed as HeartbeatStats when imported
  isConnectionHealthy(): boolean;
  getQueueStats(): any; // Will be typed properly when imported
  getBackpressureStats(): any; // Will be typed as FlowControlStats when imported
  clearQueue(): Promise<void>;
  getCurrentProtocol(): Protocol;
  switchProtocol(protocol: Protocol): Promise<void>;
  getProtocolMetrics(): Map<Protocol, any>; // Will be typed as ProtocolMetrics when imported
  getProtocolRecommendation(): any | null; // Will be typed as ProtocolRecommendation when imported
}

// Alert-specific WebSocket types
export interface AlertWebSocketMessage {
  id: string;
  type: 'new' | 'update' | 'remove' | 'clear';
  priority: 'critical' | 'high' | 'medium' | 'low' | 'info';
  timestamp: number;
  data: AlertMessageData;
  clientId?: string;
  syncId?: string;
  batchId?: string;
}

export interface AlertMessageData {
  title?: string;
  message: string;
  closable?: boolean;
  persistent?: boolean;
  action?: {
    label: string;
    actionType: string;
    parameters?: Record<string, any>;
  };
  metadata?: Record<string, any>;
  groupId?: string;
  source: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  expiresAt?: number;
}

export interface AlertAcknowledgment {
  alertId: string;
  acknowledgedBy: string;
  acknowledgedAt: number;
  clientId: string;
  syncAcrossClients: boolean;
}

export interface AlertSyncRequest {
  lastSyncTimestamp?: number;
  priorities?: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
  includeAcknowledged?: boolean;
  maxCount?: number;
}

export interface AlertSyncResponse {
  alerts: AlertWebSocketMessage[];
  syncTimestamp: number;
  hasMore: boolean;
  totalCount: number;
}

export interface AlertBatchMessage {
  batchId: string;
  alerts: AlertWebSocketMessage[];
  timestamp: number;
  isComplete: boolean;
  sequenceNumber: number;
  totalSequences: number;
}

export interface AlertConnectionState {
  lastSyncTimestamp: number;
  subscribedPriorities: Set<string>;
  acknowledgedAlerts: Set<string>;
  pendingAcknowledgments: Map<string, AlertAcknowledgment>;
  syncInProgress: boolean;
  connectionLossTime?: number;
}

export interface AlertEventHandlers {
  onAlertReceived?: (alert: AlertWebSocketMessage) => void | Promise<void>;
  onAlertsCleared?: (criteria: { priority?: string; source?: string }) => void | Promise<void>;
  onAlertAcknowledged?: (ack: AlertAcknowledgment) => void | Promise<void>;
  onAlertSyncComplete?: (syncResult: AlertSyncResponse) => void | Promise<void>;
  onAlertError?: (error: AlertWebSocketError) => void | Promise<void>;
}

export interface AlertWebSocketError extends WebSocketError {
  alertId?: string;
  operation: 'send' | 'acknowledge' | 'sync' | 'batch';
}

// Extend existing WebSocketEventHandlers to include alert handlers
export interface ExtendedWebSocketEventHandlers extends WebSocketEventHandlers {
  onAlertReceived?: (alert: AlertWebSocketMessage) => void | Promise<void>;
  onAlertsCleared?: (criteria: { priority?: string; source?: string }) => void | Promise<void>;  
  onAlertAcknowledged?: (ack: AlertAcknowledgment) => void | Promise<void>;
  onAlertSyncComplete?: (syncResult: AlertSyncResponse) => void | Promise<void>;
}

// Re-export ProtocolMetrics from ProtocolManager
export type { ProtocolMetrics } from './ProtocolManager';