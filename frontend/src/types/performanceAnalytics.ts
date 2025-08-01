/**
 * Performance Analytics Type Definitions
 * 
 * Type definitions for the performance analytics dashboard system
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import { LODLevel, LODMetrics } from '../components/layout/MissionControl/LODSystem/LODManager';

/**
 * Extended performance metrics including LOD data
 */
export interface ExtendedPerformanceMetrics {
  // Core metrics
  timestamp: number;
  frameTime: number;
  fps: number;
  
  // CPU breakdown
  cpu: {
    jsTime: number;
    physicsTime: number;
    animationTime: number;
    renderPrepTime: number;
    otherTime?: number;
  };
  
  // GPU metrics
  gpu: {
    drawTime: number;
    shaderTime: number;
    textureTime: number;
    bandwidth: number;
    utilization?: number;
  };
  
  // Memory usage
  memory: {
    jsHeap: number;
    gpuMemory: number;
    textureMemory: number;
    bufferMemory: number;
    totalSystem?: number;
  };
  
  // Rendering statistics
  rendering: {
    drawCalls: number;
    triangles: number;
    vertices: number;
    programs: number;
    textures: number;
    instances: number;
    culledObjects?: number;
  };
  
  // Analysis results
  bottleneck: 'cpu' | 'gpu' | 'memory' | 'bandwidth' | 'none';
  recommendations: string[];
  
  // LOD integration
  lodMetrics?: LODMetrics;
  
  // Custom metrics
  customMetrics?: Record<string, number>;
}

/**
 * Performance alert configuration
 */
export interface PerformanceAlert {
  id: string;
  type: 'fps' | 'memory' | 'drawCalls' | 'frameTime' | 'gpu' | 'custom';
  severity: 'warning' | 'error' | 'info';
  condition: 'above' | 'below' | 'equals' | 'between';
  threshold: number;
  thresholdMax?: number; // For 'between' condition
  duration: number; // seconds before triggering
  enabled: boolean;
  message: string;
  customMetric?: string; // For custom type
}

/**
 * Performance target for scoring
 */
export interface PerformanceTarget {
  name: string;
  metric: string;
  target: number;
  weight: number;
  unit?: string;
  description?: string;
}

/**
 * Performance comparison snapshot
 */
export interface PerformanceSnapshot {
  id: string;
  name: string;
  timestamp: number;
  data: ExtendedPerformanceMetrics[];
  settings: {
    lodConfig?: any;
    renderSettings?: any;
    physicsSettings?: any;
  };
  metadata?: {
    device?: string;
    browser?: string;
    resolution?: string;
    notes?: string;
  };
}

/**
 * Performance report export format
 */
export interface PerformanceReport {
  timestamp: string;
  duration: number;
  statistics: {
    fps: MetricStatistics;
    frameTime: MetricStatistics;
    drawCalls: MetricStatistics;
    memory: MetricStatistics;
    [key: string]: MetricStatistics;
  };
  history: ExtendedPerformanceMetrics[];
  alerts: {
    configured: PerformanceAlert[];
    triggered: TriggeredAlert[];
  };
  targets: PerformanceTarget[];
  score: number;
  bottlenecks: BottleneckAnalysis[];
  recommendations: OptimizationRecommendation[];
  lodAnalysis?: LODAnalysis;
}

/**
 * Metric statistics
 */
export interface MetricStatistics {
  average: number;
  min: number;
  max: number;
  median: number;
  stdDev: number;
  percentile95: number;
  percentile99: number;
  current: number;
  trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Triggered alert information
 */
export interface TriggeredAlert {
  alertId: string;
  timestamp: number;
  value: number;
  duration: number;
  resolved: boolean;
}

/**
 * Bottleneck analysis result
 */
export interface BottleneckAnalysis {
  timestamp: number;
  type: 'cpu' | 'gpu' | 'memory' | 'bandwidth';
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  impact: number; // 0-100
  details: string;
}

/**
 * Optimization recommendation
 */
export interface OptimizationRecommendation {
  priority: 'low' | 'medium' | 'high';
  category: 'rendering' | 'memory' | 'computation' | 'network' | 'lod';
  title: string;
  description: string;
  expectedImprovement: {
    metric: string;
    current: number;
    potential: number;
    unit: string;
  };
  implementation: string[];
  effort: 'low' | 'medium' | 'high';
}

/**
 * LOD analysis results
 */
export interface LODAnalysis {
  effectiveness: number; // 0-100
  transitionFrequency: number;
  qualityScore: number;
  performanceGain: number;
  distribution: {
    level: LODLevel;
    count: number;
    percentage: number;
  }[];
  recommendations: string[];
}

/**
 * Performance analytics configuration
 */
export interface PerformanceAnalyticsConfig {
  enabled: boolean;
  updateInterval: number;
  maxHistorySize: number;
  alerts: PerformanceAlert[];
  targets: PerformanceTarget[];
  autoExport: {
    enabled: boolean;
    interval: number; // minutes
    format: 'json' | 'csv' | 'pdf';
    destination?: string;
  };
  visualization: {
    theme: 'light' | 'dark' | 'auto';
    chartType: 'line' | 'area' | 'bar';
    showGrid: boolean;
    animate: boolean;
  };
}

/**
 * Component performance profile
 */
export interface ComponentPerformance {
  name: string;
  category: 'model' | 'terrain' | 'effect' | 'ui' | 'physics' | 'other';
  metrics: {
    cpuTime: number;
    gpuTime: number;
    memory: number;
    drawCalls: number;
  };
  status: 'optimal' | 'acceptable' | 'warning' | 'critical';
  lodLevel?: LODLevel;
  instanceCount?: number;
  optimizations?: string[];
}

/**
 * Performance benchmark scenario
 */
export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  category: 'stress' | 'normal' | 'minimal';
  duration: number; // seconds
  setup: () => void | Promise<void>;
  run: (progress: (value: number) => void) => void | Promise<void>;
  teardown: () => void | Promise<void>;
  expectedMetrics: {
    minFPS: number;
    maxFrameTime: number;
    maxMemoryMB: number;
    maxDrawCalls: number;
  };
  config?: Record<string, any>;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  scenarioId: string;
  timestamp: number;
  passed: boolean;
  score: number; // 0-100
  metrics: {
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    frameTimeP95: number;
    frameTimeP99: number;
    memoryPeak: number;
    drawCallsPeak: number;
  };
  failures: string[];
  profile: ExtendedPerformanceMetrics[];
}

/**
 * Real-time performance stream data
 */
export interface PerformanceStreamData {
  timestamp: number;
  instant: {
    fps: number;
    frameTime: number;
    cpuUsage: number;
    gpuUsage: number;
    memoryUsage: number;
  };
  deltas: {
    drawCalls: number;
    triangles: number;
    stateChanges: number;
  };
}

/**
 * Performance analytics dashboard props
 */
export interface PerformanceAnalyticsDashboardProps {
  enabled?: boolean;
  config?: Partial<PerformanceAnalyticsConfig>;
  onMetricsUpdate?: (metrics: ExtendedPerformanceMetrics) => void;
  onAlertTriggered?: (alert: PerformanceAlert, value: number) => void;
  onReportGenerated?: (report: PerformanceReport) => void;
  customMetrics?: Record<string, () => number>;
  benchmarkScenarios?: BenchmarkScenario[];
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Hook return type for performance analytics
 */
export interface UsePerformanceAnalyticsReturn {
  metrics: ExtendedPerformanceMetrics | null;
  history: ExtendedPerformanceMetrics[];
  statistics: Record<string, MetricStatistics>;
  alerts: {
    active: Set<string>;
    history: TriggeredAlert[];
  };
  bottlenecks: BottleneckAnalysis[];
  recommendations: OptimizationRecommendation[];
  actions: {
    captureSnapshot: (name?: string) => PerformanceSnapshot;
    runBenchmark: (scenarioId: string) => Promise<BenchmarkResult>;
    exportReport: (format: 'json' | 'csv' | 'pdf') => void;
    clearHistory: () => void;
    updateConfig: (config: Partial<PerformanceAnalyticsConfig>) => void;
  };
}