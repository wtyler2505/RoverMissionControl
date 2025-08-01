/**
 * Real-Time Streaming Types
 * Type definitions for high-performance streaming visualization
 */

import { TelemetryDataPoint, TelemetryStreamConfig } from '../services/websocket/TelemetryManager';

/**
 * Streaming buffer configuration
 */
export interface StreamingBufferConfig {
  capacity: number;              // Maximum points to store
  windowSize: number;           // Time window in milliseconds
  updateInterval: number;       // Update frequency in milliseconds
  interpolation?: 'linear' | 'step' | 'smooth';
  aggregation?: 'none' | 'average' | 'min' | 'max' | 'last';
  compressionThreshold?: number; // Points above which to apply compression
}

/**
 * Stream rendering configuration
 */
export interface StreamRenderConfig {
  color: string;
  lineWidth: number;
  opacity?: number;
  showPoints?: boolean;
  pointRadius?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  fillArea?: boolean;
  fillOpacity?: number;
  animated?: boolean;
  glowEffect?: boolean;
}

/**
 * Stream visualization state
 */
export interface StreamVisualizationState {
  streamId: string;
  buffer: StreamingDataBuffer;
  renderConfig: StreamRenderConfig;
  visible: boolean;
  paused: boolean;
  highlighted: boolean;
  stats: StreamPerformanceStats;
}

/**
 * Performance statistics for streaming
 */
export interface StreamPerformanceStats {
  fps: number;
  renderTime: number;           // Average render time in ms
  dataRate: number;            // Points per second
  droppedFrames: number;
  bufferUtilization: number;   // 0-1
  latency: number;             // End-to-end latency in ms
}

/**
 * Multi-stream layout configuration
 */
export interface MultiStreamLayout {
  type: 'grid' | 'stack' | 'overlay' | 'custom';
  rows?: number;
  columns?: number;
  gap?: number;
  synchronized?: boolean;      // Sync time axes
  sharedScale?: boolean;      // Share Y-axis scale
}

/**
 * Stream interaction event
 */
export interface StreamInteractionEvent {
  type: 'hover' | 'click' | 'select' | 'zoom' | 'pan';
  streamId: string;
  timestamp?: number;
  value?: number;
  position?: { x: number; y: number };
  range?: { start: number; end: number };
}

/**
 * Streaming indicator status
 */
export interface StreamingIndicatorStatus {
  streamId: string;
  status: 'active' | 'paused' | 'buffering' | 'error' | 'offline';
  dataRate: number;
  latency: number;
  quality: number;             // 0-1 quality metric
  bufferHealth: number;        // 0-1 buffer health
  alerts: StreamAlert[];
}

/**
 * Stream alert
 */
export interface StreamAlert {
  id: string;
  streamId: string;
  type: 'latency' | 'data_loss' | 'buffer_overflow' | 'quality' | 'connection';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: number;
  resolved?: boolean;
}

/**
 * Real-time annotation for streams
 */
export interface StreamAnnotation {
  id: string;
  streamId: string;
  timestamp: number;
  type: 'marker' | 'event' | 'alert' | 'note';
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  duration?: number;           // For range annotations
  priority?: number;
}

/**
 * Stream recording configuration
 */
export interface StreamRecordingConfig {
  streamIds: string[];
  duration?: number;           // Max duration in ms
  sizeLimit?: number;         // Max size in bytes
  format: 'json' | 'csv' | 'binary' | 'parquet';
  compression?: boolean;
  includeMetadata?: boolean;
  triggerCondition?: {
    type: 'manual' | 'threshold' | 'event' | 'schedule';
    config: any;
  };
}

/**
 * Streaming data buffer interface
 */
export interface StreamingDataBuffer {
  readonly capacity: number;
  readonly size: number;
  readonly windowSize: number;
  
  push(point: TelemetryDataPoint): void;
  pushBatch(points: TelemetryDataPoint[]): void;
  getRange(startTime: number, endTime: number): TelemetryDataPoint[];
  getLatest(count: number): TelemetryDataPoint[];
  getAll(): TelemetryDataPoint[];
  clear(): void;
  trim(beforeTime: number): void;
  getStatistics(): BufferStatistics;
}

/**
 * Buffer statistics
 */
export interface BufferStatistics {
  count: number;
  oldestTimestamp: number;
  newestTimestamp: number;
  averageInterval: number;
  utilization: number;
  compressionRatio?: number;
}

/**
 * Stream group for synchronized visualization
 */
export interface StreamGroup {
  id: string;
  name: string;
  streamIds: string[];
  syncTime: boolean;
  syncScale: boolean;
  layout: MultiStreamLayout;
  sharedConfig?: Partial<StreamRenderConfig>;
}

/**
 * Streaming chart configuration
 */
export interface StreamingChartConfig {
  streams: StreamVisualizationState[];
  layout: MultiStreamLayout;
  timeWindow: number;
  updateInterval: number;
  showGrid: boolean;
  showLegend: boolean;
  showStats: boolean;
  showIndicators: boolean;
  enableInteraction: boolean;
  enableRecording: boolean;
  theme: StreamingChartTheme;
}

/**
 * Streaming chart theme
 */
export interface StreamingChartTheme {
  backgroundColor: string;
  gridColor: string;
  textColor: string;
  font: string;
  animationDuration: number;
  glowIntensity: number;
}

/**
 * WebGL streaming configuration
 */
export interface WebGLStreamConfig {
  antialias: boolean;
  powerPreference: 'high-performance' | 'low-power' | 'default';
  preserveDrawingBuffer: boolean;
  maxPointsPerStream: number;
  useInstancing: boolean;
  useVAO: boolean;              // Vertex Array Objects
}

/**
 * Stream export options
 */
export interface StreamExportOptions {
  format: 'video' | 'gif' | 'image_sequence' | 'data';
  quality: 'low' | 'medium' | 'high' | 'lossless';
  fps?: number;
  duration?: number;
  includeOverlays?: boolean;
  includeStats?: boolean;
}