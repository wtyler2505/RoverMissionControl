/**
 * Grid System Types for Rover Mission Control
 * Comprehensive type definitions for flexible drag-and-drop grid system
 */

export interface GridConfig {
  cols: number;
  rowHeight: number;
  margin: [number, number];
  containerPadding: [number, number];
  isDraggable: boolean;
  isResizable: boolean;
  compactType: 'vertical' | 'horizontal' | null;
  preventCollision: boolean;
  useCSSTransforms: boolean;
  autoSize: boolean;
}

export interface GridBreakpoints {
  lg: number;
  md: number;
  sm: number;
  xs: number;
  xxs: number;
}

export interface GridCols {
  lg: number;
  md: number;
  sm: number;
  xs: number;
  xxs: number;
}

export interface PanelLayout {
  i: string; // Unique identifier
  x: number; // X position in grid units
  y: number; // Y position in grid units
  w: number; // Width in grid units
  h: number; // Height in grid units
  minW?: number; // Minimum width
  maxW?: number; // Maximum width
  minH?: number; // Minimum height
  maxH?: number; // Maximum height
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean; // Cannot be moved or resized
  moved?: boolean; // If item has been moved (for performance)
  resizeHandles?: Array<'s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne'>;
}

export interface ResponsiveLayouts {
  lg: PanelLayout[];
  md: PanelLayout[];
  sm: PanelLayout[];
  xs: PanelLayout[];
  xxs: PanelLayout[];
}

export type PanelType = 
  | 'telemetry'
  | 'control'
  | 'visualization'
  | 'status'
  | 'communication'
  | 'custom';

export interface PanelConfig {
  id: string;
  type: PanelType;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<any>;
  component: React.ComponentType<PanelProps>;
  defaultSize: {
    w: number;
    h: number;
  };
  minSize: {
    w: number;
    h: number;
  };
  maxSize?: {
    w: number;
    h: number;
  };
  category: string;
  description?: string;
  supportedThemes?: string[];
  requiresAuth?: boolean;
  permissions?: string[];
}

export interface PanelProps {
  id: string;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  onSettings?: () => void;
  theme?: any;
  data?: any;
  config?: Record<string, any>;
  layout?: PanelLayout;
  gridRef?: React.RefObject<any>;
}

export interface PanelInstance {
  id: string;
  panelId: string; // Reference to PanelConfig
  layout: PanelLayout;
  config: Record<string, any>;
  isMinimized: boolean;
  isMaximized: boolean;
  isVisible: boolean;
  lastModified: number;
  customTitle?: string;
  customIcon?: string;
}

export interface GridState {
  layouts: ResponsiveLayouts;
  panels: PanelInstance[];
  currentBreakpoint: keyof GridBreakpoints;
  isDragging: boolean;
  isResizing: boolean;
  draggedPanel?: string;
  lastSaved: number;
  version: number;
}

export interface GridContextValue {
  state: GridState;
  config: GridConfig;
  breakpoints: GridBreakpoints;
  cols: GridCols;
  
  // Panel management
  addPanel: (panelConfig: PanelConfig, position?: Partial<PanelLayout>) => void;
  removePanel: (panelId: string) => void;
  updatePanel: (panelId: string, updates: Partial<PanelInstance>) => void;
  minimizePanel: (panelId: string) => void;
  maximizePanel: (panelId: string) => void;
  togglePanel: (panelId: string) => void;
  
  // Layout management
  updateLayout: (layout: PanelLayout[], breakpoint: string) => void;
  resetLayout: () => void;
  saveLayout: () => void;
  loadLayout: (layoutData: string) => void;
  
  // Grid operations
  compactLayout: () => void;
  autoArrangeLayout: () => void;
  onLayoutChange: (layout: PanelLayout[], layouts: ResponsiveLayouts) => void;
  onBreakpointChange: (breakpoint: string, cols: number) => void;
  
  // State management
  exportState: () => string;
  importState: (stateData: string) => void;
  clearState: () => void;
}

// Animation and accessibility types
export interface PanelAnimationConfig {
  duration: number;
  easing: string;
  reduceMotion: boolean;
}

export interface AccessibilityConfig {
  enableKeyboardNavigation: boolean;
  announceChanges: boolean;
  focusManagement: boolean;
  screenReaderSupport: boolean;
  highContrastMode: boolean;
  largeText: boolean;
}

// Performance and persistence types
export interface GridPerformanceConfig {
  enableVirtualization: boolean;
  lazyLoad: boolean;
  debounceMs: number;
  throttleMs: number;
  enableAnimations: boolean;
  useCSSTransforms: boolean;
}

export interface PersistenceConfig {
  key: string;
  version: number;
  storage: 'localStorage' | 'sessionStorage' | 'indexedDB';
  autoSave: boolean;
  saveInterval: number;
  compression: boolean;
}

// Event types
export interface GridEventHandlers {
  onDragStart?: (layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => void;
  onDrag?: (layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => void;
  onDragStop?: (layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => void;
  onResizeStart?: (layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => void;
  onResize?: (layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => void;
  onResizeStop?: (layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => void;
  onWidthChange?: (containerWidth: number, margin: [number, number], cols: number, containerPadding: [number, number]) => void;
}

// Error handling types
export interface GridError {
  type: 'layout' | 'panel' | 'persistence' | 'validation';
  message: string;
  context?: any;
  timestamp: number;
}

export interface GridErrorBoundary {
  hasError: boolean;
  error?: GridError;
  errorInfo?: any;
  retry: () => void;
  reset: () => void;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: GridError[];
  warnings: string[];
}

export interface GridValidator {
  validateLayout: (layout: PanelLayout[]) => ValidationResult;
  validatePanelConfig: (config: PanelConfig) => ValidationResult;
  validateGridState: (state: GridState) => ValidationResult;
  validateBreakpoint: (breakpoint: string, layout: PanelLayout[]) => ValidationResult;
}

// Advanced features
export interface GridAdvancedFeatures {
  snapToGrid: boolean;
  magneticSnapping: boolean;
  collisionDetection: boolean;
  autoCompaction: boolean;
  layoutOptimization: boolean;
  multiSelection: boolean;
  grouping: boolean;
  layering: boolean;
}

// Export utility type
export type Breakpoint = keyof GridBreakpoints;
export type LayoutChangeHandler = (layout: PanelLayout[], layouts: ResponsiveLayouts) => void;
export type BreakpointChangeHandler = (breakpoint: string, cols: number) => void;