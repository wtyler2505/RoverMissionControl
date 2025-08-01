/**
 * WebSocket Services - Export Index
 * Central export point for all WebSocket-related services and utilities
 */

// Main classes
export { WebSocketClient } from './WebSocketClient';
export { ConnectionManager } from './ConnectionManager';
export { MessageQueue } from './MessageQueue';
export { HeartbeatManager } from './HeartbeatManager';
export { BackpressureManager } from './BackpressureManager';
export { ProtocolManager } from './ProtocolManager';
// Enhanced Binary Serialization System (Task 54.4)
export { 
  SerializerFactory,
  SchemaRegistry,
  CompressionManager,
  TelemetrySerializationManager,
  TelemetrySerializationUtils,
  MessagePackSerializer,
  CBORSerializer,
  JSONSerializer,
  telemetrySerializer,
  getEnhancedSerializationMetrics,
  SCHEMA_VERSION
} from './BinarySerializer';

// Binary Telemetry Integration (Task 54.4)
export {
  BinaryWebSocketTelemetryClient,
  createBinaryTelemetryClient
} from './TelemetryBinaryIntegration';
export { TelemetryManager } from './TelemetryManager';
export { WebSocketTelemetryClient, DEFAULT_TELEMETRY_CONFIG } from './WebSocketTelemetryClient';

// Streaming Data Processing Pipeline (Task 54.5)
export {
  TelemetryProcessingPipeline,
  DataTransformationStage,
  WindowedOperationsStage,
  DataInterpolationStage,
  TimeAlignmentStage
} from './TelemetryProcessingPipeline';

// Advanced Data Buffering System (Task 54.3)
export { 
  TelemetryBufferManager, 
  DEFAULT_BUFFER_CONFIG 
} from './TelemetryBufferManager';
export { 
  BufferedTelemetryClient, 
  DEFAULT_BUFFERED_TELEMETRY_CONFIG 
} from './BufferedTelemetryClient';

// Advanced Telemetry Subscription System (Task 54.2)
export { ChannelRegistry } from './ChannelRegistry';
export { EnhancedTelemetryManager } from './EnhancedTelemetryManager';
export { SubscriptionValidator } from './SubscriptionValidator';
export { 
  SubscriptionMessageBuilder, 
  SubscriptionValidator as ProtocolValidator,
  SubscriptionProtocolUtils 
} from './SubscriptionProtocol';
export {
  FilterManager,
  PropertyFilter,
  TemporalFilter,
  FrequencyFilter,
  QualityFilter,
  CompoundFilter,
  FilterFactory
} from './TelemetryFilters';
export type { HeartbeatConfig, HeartbeatStats, HeartbeatCallbacks } from './HeartbeatManager';
export type { BackpressureConfig, FlowControlStats, BackpressureCallbacks } from './BackpressureManager';
export type { 
  ProtocolMetrics, 
  ProtocolRecommendation, 
  NegotiationResult,
  ProtocolPreferences 
} from './ProtocolManager';
export type { 
  TelemetryStreamConfig, 
  TelemetryDataPoint, 
  TelemetryStreamStats,
  StreamSubscription,
  TelemetryUpdateEvent,
  TelemetryManagerEvents 
} from './TelemetryManager';
export { TelemetryDataType } from './TelemetryManager';

// Enhanced Binary Serialization Types (Task 54.4)
export type {
  TelemetrySchema,
  SchemaField,
  SerializationHeader,
  TelemetryBinaryFormat,
  SerializationOptions,
  DeserializationOptions,
  TelemetrySerializationOptions,
  TelemetryDeserializationOptions,
  EnhancedSerializationMetrics
} from './BinarySerializer';
export { CompressionType } from './BinarySerializer';

// Binary Telemetry Integration Types (Task 54.4)
export type {
  BinaryTelemetryConfig,
  BinaryTelemetryEvent
} from './TelemetryBinaryIntegration';

// Advanced Subscription System Types (Task 54.2)
export type {
  ChannelMetadata,
  ChannelQueryFilter,
  ChannelDiscoveryResult,
  DataQualitySpec
} from './ChannelRegistry';
export { ChannelPermissionLevel, ChannelCategory } from './ChannelRegistry';

export type {
  TelemetryFilter,
  FilterConfiguration,
  FilterStatistics,
  FilterContext
} from './TelemetryFilters';
export { FilterType, ComparisonOperator, LogicalOperator } from './TelemetryFilters';

export type {
  SubscriptionRequest,
  SubscriptionResponse,
  SubscriptionDataMessage,
  SubscriptionStatusChange,
  BatchSubscriptionRequest,
  BatchSubscriptionResponse,
  SubscriptionMessage
} from './SubscriptionProtocol';
export { 
  SubscriptionMessageType, 
  SubscriptionStatusCode,
  SUBSCRIPTION_PROTOCOL_VERSION 
} from './SubscriptionProtocol';

export type {
  EnhancedSubscription,
  SubscriptionGroup,
  ChannelDependency,
  EnhancedTelemetryManagerEvents
} from './EnhancedTelemetryManager';

export type {
  UserContext,
  ValidationContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ResourceUsageEstimate,
  ServerCapabilities
} from './SubscriptionValidator';
export type {
  TelemetryClientConfig,
  TelemetrySubscription,
  TelemetryPerformanceMetrics,
  TelemetryClientEvents
} from './WebSocketTelemetryClient';

// Streaming Data Processing Pipeline Types (Task 54.5)
export type {
  ProcessingStage,
  ProcessingContext,
  ProcessingStageMetrics,
  PipelineConfig,
  PipelineEvents,
  PipelinePerformanceMetrics
} from './TelemetryProcessingPipeline';
export {
  ProcessingStageType,
  InterpolationMethod,
  WindowOperationType
} from './TelemetryProcessingPipeline';

// Advanced Data Buffering System Types (Task 54.3)
export type {
  BufferConfig,
  BufferStatistics,
  BufferFlushEvent,
  BufferManagerEvents
} from './TelemetryBufferManager';
export { 
  BufferOverflowStrategy, 
  FlushTrigger 
} from './TelemetryBufferManager';
export type {
  BufferedTelemetryConfig,
  StreamBufferConfig,
  BufferedTelemetryEvents,
  BufferOptimizationRecommendation
} from './BufferedTelemetryClient';

// Types and interfaces
export * from './types';

// Utility functions and constants
export const DEFAULT_WS_CONFIG = {
  url: 'ws://localhost:8000/ws',
  reconnect: true,
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  reconnectDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 20000,
  heartbeatInterval: 25000,
  heartbeatTimeout: 60000,
  protocols: ['json', 'messagepack'],
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
  }
};