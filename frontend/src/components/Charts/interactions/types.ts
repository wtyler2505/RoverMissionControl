/**
 * Type definitions for chart interaction system
 */

import { TimeSeriesDataPoint, ChartDimensions } from '../types';

// Zoom and Pan types
export interface ZoomState {
  k: number; // scale factor
  x: number; // x translation
  y: number; // y translation
}

export interface ZoomConfig {
  enabled: boolean;
  scaleExtent: [number, number]; // [minZoom, maxZoom]
  translateExtent?: [[number, number], [number, number]];
  wheelDelta?: number;
  touchable?: boolean;
  clickDistance?: number;
}

// Tooltip types
export interface TooltipData {
  x: number;
  y: number;
  data: TimeSeriesDataPoint | TimeSeriesDataPoint[];
  series?: string[];
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface TooltipConfig {
  enabled: boolean;
  followCursor?: boolean;
  offset?: { x: number; y: number };
  formatter?: (data: TooltipData) => string | React.ReactNode;
  showDelay?: number;
  hideDelay?: number;
  interactive?: boolean;
  maxWidth?: number;
}

// Selection types
export interface SelectionBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SelectionConfig {
  enabled: boolean;
  mode: 'box' | 'x' | 'y' | 'lasso' | 'brush';
  multi?: boolean;
  onSelect?: (selection: SelectionBounds, data: TimeSeriesDataPoint[]) => void;
  onClear?: () => void;
  color?: string;
  opacity?: number;
}

// Filter types
export interface FilterState {
  timeRange?: [Date, Date];
  channels?: string[];
  valueRange?: [number, number];
  anomaliesOnly?: boolean;
  thresholdFilter?: {
    type: 'above' | 'below' | 'between';
    values: number[];
  };
}

export interface FilterConfig {
  enabled: boolean;
  timeRangePresets?: Array<{
    label: string;
    getValue: () => [Date, Date];
  }>;
  channelOptions?: string[];
  onFilterChange?: (filters: FilterState) => void;
  persistState?: boolean;
}

// Context Menu types
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  shortcut?: string;
  divider?: boolean;
  submenu?: ContextMenuItem[];
  action?: (context: ContextMenuContext) => void;
}

export interface ContextMenuContext {
  x: number;
  y: number;
  chartX?: number;
  chartY?: number;
  data?: TimeSeriesDataPoint;
  selection?: SelectionBounds;
}

export interface ContextMenuConfig {
  enabled: boolean;
  items: ContextMenuItem[];
  onOpen?: (context: ContextMenuContext) => void;
  onClose?: () => void;
}

// Drill-down types
export interface DrillDownState {
  level: number;
  path: Array<{
    id: string;
    label: string;
    data?: any;
  }>;
  currentView?: any;
}

export interface DrillDownConfig {
  enabled: boolean;
  maxDepth?: number;
  onDrill?: (item: any, level: number) => Promise<any>;
  onBack?: () => void;
  breadcrumbRenderer?: (path: DrillDownState['path']) => React.ReactNode;
}

// Touch gesture types
export interface TouchGestureState {
  touches: Array<{ id: number; x: number; y: number }>;
  scale?: number;
  rotation?: number;
  center?: { x: number; y: number };
}

export interface TouchGestureConfig {
  enabled: boolean;
  pinchZoom?: boolean;
  panGesture?: boolean;
  rotateGesture?: boolean;
  swipeGesture?: boolean;
  longPress?: boolean;
  onGesture?: (type: string, state: TouchGestureState) => void;
}

// Keyboard navigation types
export interface KeyboardNavigationConfig {
  enabled: boolean;
  focusable?: boolean;
  shortcuts?: Record<string, (event: KeyboardEvent) => void>;
  announceChanges?: boolean;
  customAnnouncements?: Record<string, string>;
}

// Annotation types
export interface Annotation {
  id: string;
  type: 'point' | 'line' | 'rect' | 'text' | 'arrow';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  text?: string;
  style?: Record<string, any>;
  editable?: boolean;
  draggable?: boolean;
}

export interface AnnotationConfig {
  enabled: boolean;
  annotations?: Annotation[];
  onAdd?: (annotation: Annotation) => void;
  onEdit?: (annotation: Annotation) => void;
  onDelete?: (id: string) => void;
  toolbar?: boolean;
}

// Performance optimization types
export interface PerformanceConfig {
  targetFPS?: number;
  enableWebWorker?: boolean;
  enableViewportCulling?: boolean;
  enableLOD?: boolean; // Level of Detail
  maxRenderPoints?: number;
  debounceDelay?: number;
  throttleDelay?: number;
}

// Accessibility types
export interface AccessibilityConfig {
  announcer?: boolean;
  highContrastMode?: boolean;
  focusIndicator?: boolean;
  keyboardNavigation?: boolean;
  screenReaderDescriptions?: boolean;
  motionReduced?: boolean;
}

// Master interaction configuration
export interface InteractionConfig {
  zoom?: ZoomConfig;
  tooltip?: TooltipConfig;
  selection?: SelectionConfig;
  filter?: FilterConfig;
  contextMenu?: ContextMenuConfig;
  drillDown?: DrillDownConfig;
  touch?: TouchGestureConfig;
  keyboard?: KeyboardNavigationConfig;
  annotations?: AnnotationConfig;
  performance?: PerformanceConfig;
  accessibility?: AccessibilityConfig;
}

// Interaction event types
export type InteractionEvent = 
  | { type: 'zoom'; state: ZoomState }
  | { type: 'pan'; delta: { x: number; y: number } }
  | { type: 'select'; bounds: SelectionBounds }
  | { type: 'hover'; point: TimeSeriesDataPoint | null }
  | { type: 'click'; point: TimeSeriesDataPoint }
  | { type: 'contextmenu'; context: ContextMenuContext }
  | { type: 'filter'; filters: FilterState }
  | { type: 'annotation'; action: 'add' | 'edit' | 'delete'; annotation: Annotation }
  | { type: 'drill'; level: number; data: any }
  | { type: 'gesture'; gesture: string; state: TouchGestureState };

// Interaction state
export interface InteractionState {
  zoom: ZoomState;
  selection: SelectionBounds | null;
  hoveredPoint: TimeSeriesDataPoint | null;
  filters: FilterState;
  drillDown: DrillDownState;
  annotations: Annotation[];
  contextMenuOpen: boolean;
  tooltipVisible: boolean;
  focusedElement: string | null;
}

// Interaction callbacks
export interface InteractionCallbacks {
  onInteraction?: (event: InteractionEvent) => void;
  onStateChange?: (state: Partial<InteractionState>) => void;
}