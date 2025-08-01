/**
 * WebSocket Components - Export Index
 * Central export point for all WebSocket-related components and hooks
 */

// Components
export { ConnectionStatus } from './ConnectionStatus';
export { ConnectionModal } from './ConnectionModal';
export { ConnectionNotification } from './ConnectionNotification';
export { HeartbeatMonitor, HeartbeatIndicator } from './HeartbeatMonitor';
export { QueueMonitor, QueueIndicator } from './QueueMonitor';
export { ProtocolSelector } from './ProtocolSelector';
export { ProtocolMonitor } from './ProtocolMonitor';
export { ProtocolIndicator } from './ProtocolIndicator';
export { ProtocolMetrics } from './ProtocolMetrics';

// Transport Components
export { TransportStatus } from './TransportStatus';
export { TransportNotification } from './TransportNotification';
export { TransportMetrics } from './TransportMetrics';

// Telemetry Components
export { RealTimeChart } from '../Telemetry/RealTimeChart';
export { TelemetryProvider, useTelemetry } from '../Telemetry/TelemetryProvider';
export { ComprehensiveDashboard } from '../Telemetry/ComprehensiveDashboard';
export { 
  WebSocketProvider,
  useWebSocket,
  useWebSocketStatus,
  useWebSocketMessaging,
  useWebSocketConnection
} from './WebSocketProvider';

// Re-export types for convenience
export type {
  WebSocketContextValue,
  ConnectionStatusProps,
  ConnectionModalProps,
  WebSocketConfig,
  ConnectionState,
  ConnectionStatus,
  ConnectionOptions,
  MessageType,
  Priority,
  Protocol,
  AuthenticationData,
  ConnectionMetrics,
  WebSocketError,
  ConnectionEvent,
  HeartbeatData,
  SubscriptionConfig,
  TelemetryStream,
  QueuedMessage,
  WebSocketMessage,
  WebSocketEventHandlers,
  ProtocolNegotiation
} from '../../services/websocket/types';

// Re-export protocol-specific types
export type {
  ProtocolMetrics,
  ProtocolRecommendation,
  NegotiationResult,
  ProtocolSwitchEvent
} from '../../services/websocket/ProtocolManager';

// Re-export telemetry types
export type {
  TelemetryStreamConfig,
  TelemetryDataPoint,
  TelemetryStreamStats,
  StreamSubscription,
  TelemetryUpdateEvent,
  TelemetryManagerEvents,
  TelemetryDataType
} from '../../services/websocket/TelemetryManager';

// Re-export transport types
export type {
  TransportStatus as ITransportStatus,
  TransportMetrics as ITransportMetrics,
  TransportEvents
} from '../../services/websocket/TransportManager';

export { TransportType } from '../../services/websocket/TransportManager';