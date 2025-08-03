// Timeline Chart Types - Mission Timeline Visualization
// Extends existing chart types with timeline-specific functionality

import { BaseChartProps } from '../base/BaseChart';
import { TimeSeriesDataPoint } from '../types';

// Task/Event types for Gantt chart
export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress?: number; // 0-100
  status?: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';
  dependencies?: string[]; // Task IDs
  resourceId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  metadata?: Record<string, any>;
}

export interface MissionEvent {
  id: string;
  timestamp: Date;
  type: 'milestone' | 'alert' | 'command' | 'telemetry' | 'annotation';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description?: string;
  relatedTaskIds?: string[];
  coordinates?: { lat: number; lon: number };
  metadata?: Record<string, any>;
}

export interface TimelineAnnotation {
  id: string;
  startTime: Date;
  endTime?: Date;
  text: string;
  author: string;
  createdAt: Date;
  color?: string;
  taskId?: string;
  replies?: TimelineAnnotation[];
}

// Timeline chart specific props
export interface TimelineChartProps extends Omit<BaseChartProps, 'data'> {
  tasks: GanttTask[];
  events?: MissionEvent[];
  annotations?: TimelineAnnotation[];
  
  // Time range
  startDate: Date;
  endDate: Date;
  currentTime?: Date;
  
  // Playback controls
  playbackSpeed?: number; // 0.25x, 0.5x, 1x, 2x, 4x
  isPlaying?: boolean;
  onTimeChange?: (time: Date) => void;
  onPlaybackToggle?: () => void;
  
  // Display options
  showDependencies?: boolean;
  showProgress?: boolean;
  showEvents?: boolean;
  showAnnotations?: boolean;
  showGrid?: boolean;
  showToday?: boolean;
  
  // Interaction callbacks
  onTaskClick?: (task: GanttTask) => void;
  onTaskDrag?: (task: GanttTask, newStart: Date, newEnd: Date) => void;
  onEventClick?: (event: MissionEvent) => void;
  onAnnotationAdd?: (annotation: Omit<TimelineAnnotation, 'id' | 'createdAt'>) => void;
  onTimeRangeChange?: (start: Date, end: Date) => void;
  
  // Comparison mode
  comparisonData?: {
    tasks: GanttTask[];
    label: string;
    color?: string;
  }[];
  
  // Level of detail
  zoomLevel?: number;
  minZoom?: number;
  maxZoom?: number;
  
  // Filtering
  taskFilter?: (task: GanttTask) => boolean;
  eventFilter?: (event: MissionEvent) => boolean;
  
  // Export options
  enableExport?: boolean;
  exportFormats?: ('png' | 'svg' | 'pdf' | 'json')[];
}

// Zoom level detail configurations
export interface LevelOfDetail {
  level: 'overview' | 'summary' | 'detailed' | 'granular';
  showSubtasks: boolean;
  showEvents: boolean;
  showAnnotations: boolean;
  showDependencies: boolean;
  timeGranularity: 'year' | 'month' | 'week' | 'day' | 'hour' | 'minute';
}

// Timeline interaction state
export interface TimelineInteractionState {
  selectedTaskIds: Set<string>;
  hoveredTaskId: string | null;
  hoveredEventId: string | null;
  isDragging: boolean;
  draggedTaskId: string | null;
  zoomTransform: {
    x: number;
    y: number;
    k: number;
  };
  playbackState: 'playing' | 'paused' | 'stopped';
  currentTime: Date;
}

// Resource allocation for resource-based Gantt
export interface Resource {
  id: string;
  name: string;
  type: 'rover' | 'operator' | 'system' | 'equipment';
  availability: Array<{
    start: Date;
    end: Date;
  }>;
  capacity?: number;
}

// Timeline data processor options
export interface TimelineDataProcessorOptions {
  aggregationLevel?: 'minute' | 'hour' | 'day' | 'week' | 'month';
  mergeOverlappingTasks?: boolean;
  calculateCriticalPath?: boolean;
  optimizeResourceAllocation?: boolean;
}

// Export configuration
export interface TimelineExportConfig {
  format: 'png' | 'svg' | 'pdf' | 'json' | 'csv';
  includeEvents?: boolean;
  includeAnnotations?: boolean;
  includeDependencies?: boolean;
  dateFormat?: string;
  resolution?: number; // For image exports
  paperSize?: 'A4' | 'A3' | 'Letter' | 'Legal'; // For PDF
}

// Performance optimization options
export interface TimelinePerformanceOptions {
  enableVirtualization?: boolean;
  virtualizeThreshold?: number; // Number of tasks before virtualization
  enableLOD?: boolean; // Level of detail rendering
  lodThresholds?: {
    overview: number;
    summary: number;
    detailed: number;
  };
  enableCanvasRendering?: boolean;
  canvasThreshold?: number; // Number of elements before switching to canvas
  debounceDelay?: number; // Milliseconds to debounce interactions
}

// Statistical analysis for timeline
export interface TimelineStatistics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  averageTaskDuration: number;
  criticalPathLength: number;
  resourceUtilization: Record<string, number>;
  bottlenecks: Array<{
    taskId: string;
    reason: string;
    impact: 'low' | 'medium' | 'high';
  }>;
}

// Playback controls types
export interface PlaybackSpeed {
  value: number;
  label: string;
  icon?: React.ReactNode;
}

export interface StepInterval {
  value: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
  label: string;
}

export interface TimeFormat {
  value: string;
  label: string;
  formatter: (date: Date) => string;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: Date;
  speed: number;
  canPlay: boolean;
  canPause: boolean;
  canStop: boolean;
}

export interface TimelinePlaybackControlsProps {
  // Time range and current position
  startTime: Date;
  endTime: Date;
  currentTime: Date;
  
  // Playback state
  isPlaying?: boolean;
  playbackSpeed?: number;
  
  // Event handlers
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onTimeChange?: (time: Date) => void;
  onSpeedChange?: (speed: number) => void;
  onStepForward?: (interval: StepInterval) => void;
  onStepBackward?: (interval: StepInterval) => void;
  onJumpToStart?: () => void;
  onJumpToEnd?: () => void;
  
  // Configuration
  availableSpeeds?: PlaybackSpeed[];
  stepIntervals?: StepInterval[];
  timeFormats?: TimeFormat[];
  defaultTimeFormat?: string;
  
  // UI customization
  showMiniTimeline?: boolean;
  showSpeedSelector?: boolean;
  showStepControls?: boolean;
  showJumpControls?: boolean;
  showTimeDisplay?: boolean;
  showTooltips?: boolean;
  
  // Responsive behavior
  breakpoint?: 'mobile' | 'tablet' | 'desktop';
  compactMode?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  describedBy?: string;
  
  // Keyboard shortcuts
  enableKeyboardShortcuts?: boolean;
  
  // Animation settings
  animationDuration?: number;
  
  // Error state
  error?: string;
  disabled?: boolean;
  
  // Data visualization
  timelineTasks?: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
    color?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  
  // Performance
  throttleMs?: number;
}