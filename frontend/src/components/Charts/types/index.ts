/**
 * Chart Component Type Definitions
 * Provides comprehensive TypeScript interfaces for the D3.js chart system
 */

import { Theme } from '../../../theme/themes';

// Data Types
export interface ChartDataPoint {
  x: number | Date | string;
  y: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface TimeSeriesDataPoint {
  time: Date;
  value: number;
  category?: string;
  threshold?: number;
  metadata?: Record<string, any>;
}

export interface HeatmapDataPoint {
  x: number | string;
  y: number | string;
  value: number;
  label?: string;
}

export interface GaugeDataPoint {
  value: number;
  min: number;
  max: number;
  thresholds?: Array<{
    value: number;
    label: string;
    color: string;
  }>;
}

// Chart Dimensions
export interface ChartDimensions {
  width: number;
  height: number;
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

// Scale Types
export type ScaleType = 'linear' | 'time' | 'log' | 'band' | 'ordinal' | 'sequential';

export interface AxisConfig {
  label?: string;
  tickFormat?: (value: any) => string;
  tickCount?: number;
  gridLines?: boolean;
  scale?: ScaleType;
  domain?: [number, number] | [Date, Date] | string[];
  nice?: boolean;
}

// Animation Configuration
export interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing?: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  delay?: number;
}

// Tooltip Configuration
export interface TooltipConfig {
  enabled: boolean;
  format?: (data: any) => string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  offset?: { x: number; y: number };
  showCrosshair?: boolean;
}

// Legend Configuration
export interface LegendConfig {
  enabled: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  orientation: 'horizontal' | 'vertical';
  interactive?: boolean;
  itemSpacing?: number;
}

// Base Chart Props
export interface BaseChartProps {
  data: any[];
  dimensions?: Partial<ChartDimensions>;
  theme?: Theme;
  className?: string;
  ariaLabel?: string;
  animation?: Partial<AnimationConfig>;
  tooltip?: Partial<TooltipConfig>;
  legend?: Partial<LegendConfig>;
  onDataPointClick?: (data: any, event: React.MouseEvent) => void;
  onChartClick?: (event: React.MouseEvent) => void;
  renderMode?: 'svg' | 'canvas';
  responsive?: boolean;
  performanceMode?: boolean;
}

// Line Chart Props
export interface LineChartProps extends BaseChartProps {
  data: TimeSeriesDataPoint[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  interpolation?: 'linear' | 'monotone' | 'step' | 'basis' | 'cardinal';
  showPoints?: boolean;
  showArea?: boolean;
  multiLine?: boolean;
  strokeWidth?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  thresholds?: Array<{
    value: number;
    label: string;
    color: string;
    style?: 'solid' | 'dashed' | 'dotted';
  }>;
}

// Area Chart Props
export interface AreaChartProps extends LineChartProps {
  opacity?: number;
  gradient?: boolean;
  stackedAreas?: boolean;
}

// Bar Chart Props
export interface BarChartProps extends BaseChartProps {
  data: ChartDataPoint[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  orientation?: 'vertical' | 'horizontal';
  grouped?: boolean;
  stacked?: boolean;
  barPadding?: number;
  cornerRadius?: number;
}

// Gauge Chart Props
export interface GaugeChartProps extends BaseChartProps {
  data: GaugeDataPoint;
  startAngle?: number;
  endAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  needleWidth?: number;
  showLabels?: boolean;
  showTicks?: boolean;
  tickCount?: number;
  colorScale?: string[];
}

// Heatmap Chart Props
export interface HeatmapChartProps extends BaseChartProps {
  data: HeatmapDataPoint[];
  xAxis?: AxisConfig;
  yAxis?: AxisConfig;
  colorScale?: string[];
  cellPadding?: number;
  cellRadius?: number;
  showValues?: boolean;
  valueFormat?: (value: number) => string;
}

// Chart Update Configuration
export interface ChartUpdateConfig {
  transition: boolean;
  duration: number;
  preserveAspectRatio?: boolean;
}

// Performance Optimization Options
export interface PerformanceOptions {
  enableWebWorker?: boolean;
  enableCanvas?: boolean;
  dataPointLimit?: number;
  enableDecimation?: boolean;
  enableThrottling?: boolean;
  throttleDelay?: number;
}

// Export Configuration
export interface ExportConfig {
  format: 'png' | 'svg' | 'pdf' | 'csv' | 'json';
  filename?: string;
  quality?: number;
  includeMetadata?: boolean;
}

// Chart Events
export interface ChartEvents {
  onZoom?: (transform: any) => void;
  onPan?: (transform: any) => void;
  onBrush?: (selection: [number, number] | [Date, Date]) => void;
  onHover?: (data: any, event: MouseEvent) => void;
  onLeave?: (event: MouseEvent) => void;
  onRender?: (renderTime: number) => void;
  onError?: (error: Error) => void;
}

// Chart State
export interface ChartState {
  isLoading: boolean;
  error: Error | null;
  zoomTransform: any;
  selection: any;
  hoveredData: any;
  dimensions: ChartDimensions;
}

// Chart Context
export interface ChartContextValue {
  theme: Theme;
  dimensions: ChartDimensions;
  scales: Record<string, any>;
  updateChart: (config?: ChartUpdateConfig) => void;
  exportChart: (config: ExportConfig) => Promise<void>;
  performance: {
    lastRenderTime: number;
    dataPointCount: number;
    fps: number;
  };
}

// Responsive Container Props
export interface ResponsiveContainerProps {
  children: (dimensions: ChartDimensions) => React.ReactNode;
  aspectRatio?: number;
  minHeight?: number;
  maxHeight?: number;
  debounceTime?: number;
  className?: string;
}

// Chart Annotation
export interface ChartAnnotation {
  type: 'line' | 'rect' | 'text' | 'circle';
  x?: number | Date | string;
  y?: number;
  x2?: number | Date | string;
  y2?: number;
  text?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
}

// Data Transformer Types
export type DataTransformer<T = any> = (data: T[]) => T[];

export interface TransformationPipeline {
  transforms: DataTransformer[];
  apply: <T>(data: T[]) => T[];
}

// Scale Factory Types
export interface ScaleFactoryOptions {
  domain: any[];
  range: any[];
  type: ScaleType;
  padding?: number;
  nice?: boolean;
  clamp?: boolean;
}

// Chart Registry for dynamic chart types
export interface ChartRegistryEntry {
  type: string;
  component: React.ComponentType<any>;
  defaultProps: any;
  validator?: (props: any) => string | null;
}