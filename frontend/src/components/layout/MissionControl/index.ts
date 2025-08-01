/**
 * Mission Control Layout Components
 * 
 * Centralized exports for all Mission Control Center layout components
 * providing a clean and organized API for consuming components.
 */

// Main Visualization Panel
export { MainVisualizationPanel, default as MainVisualizationPanel } from './MainVisualizationPanel';
export type { 
  MainVisualizationPanelProps,
  VisualizationMode,
  ThreeJSConfig,
  ContextMenuItem,
  DragDropConfig
} from './MainVisualizationPanel';

// Timeline Component
export { Timeline, default as Timeline } from './Timeline';
export type {
  TimelineEvent,
  TimelineBookmark,
  TimelineRange,
  TimelineFilter,
  TimelineProps
} from './Timeline';

// MiniMap Component
export { MiniMap, default as MiniMap } from './MiniMap';
export type {
  Position,
  BoundingBox,
  MiniMapLayer,
  PointOfInterest,
  PathPoint,
  MiniMapViewport,
  MiniMapProps
} from './MiniMap';

// Status Bar Component
export { StatusBar, StatusBarProvider, useStatusBar } from './StatusBar';
export type {
  StatusBarProps,
  StatusBarData,
  StatusBarConfiguration,
  StatusBarContextValue,
  StatusWidget,
  StatusWidgetProps,
  SystemHealthData,
  ConnectionStatusData,
  CommandQueueData,
  MissionData,
  PowerStatusData,
  NotificationData,
  StatusUpdateEvent,
  StatusLevel,
  HealthStatus,
  MissionStatusType,
  SignalStrength
} from './StatusBar';

// Quick Toolbar Component
export { QuickToolbar, default as QuickToolbar } from './QuickToolbar';
export { ToolbarCustomization } from './ToolbarCustomization';
export type {
  QuickToolbarProps,
  ToolAction,
  ToolGroup,
  ToolCategory,
  ToolState,
  RoverContext,
  ToolbarLayout,
  ToolbarPreferences,
  ToolbarContextValue
} from './QuickToolbar';

// Component configurations and constants
export const MISSION_CONTROL_CONSTANTS = {
  /**
   * Standard panel sizes for Mission Control components
   */
  PANEL_SIZES: {
    MAIN_VISUALIZATION: {
      desktop: '60%',
      tablet: '100%',
      mobile: '100%'
    },
    SIDEBAR: {
      desktop: '25%',
      tablet: '100%',
      mobile: '100%'
    },
    COMMAND_BAR: {
      height: '80px'
    },
    STATUS_BAR: {
      height: '40px'
    }
  },

  /**
   * Responsive breakpoints for Mission Control layout
   */
  BREAKPOINTS: {
    desktop: 1200,
    tablet: 768,
    mobile: 480
  },

  /**
   * Z-index layers for proper stacking
   */
  Z_INDEX: {
    base: 1,
    panel: 10,
    overlay: 100,
    modal: 1000,
    contextMenu: 10000
  },

  /**
   * Animation durations for consistent motion
   */
  ANIMATIONS: {
    fast: 150,
    medium: 300,
    slow: 500
  }
} as const;

/**
 * Default configurations for Mission Control components
 */
export const DEFAULT_CONFIGS = {
  /**
   * Default Three.js configuration for 3D visualization
   */
  THREEJS: {
    enableOrbitControls: true,
    enableGrid: true,
    enableAxes: true,
    backgroundColor: '#1a1a1a',
    cameraPosition: [10, 10, 10] as [number, number, number],
    fieldOfView: 75
  },

  /**
   * Default drag and drop configuration
   */
  DRAG_DROP: {
    enableDragToReposition: true,
    enableDropZones: true,
    dragThreshold: 5,
    snapToGrid: false
  }
} as const;

/**
 * Utility functions for Mission Control layout
 */
export const MissionControlUtils = {
  /**
   * Determine screen size category based on window width
   */
  getScreenSize: (width: number): 'desktop' | 'tablet' | 'mobile' => {
    if (width >= MISSION_CONTROL_CONSTANTS.BREAKPOINTS.desktop) {
      return 'desktop';
    } else if (width >= MISSION_CONTROL_CONSTANTS.BREAKPOINTS.tablet) {
      return 'tablet';
    } else {
      return 'mobile';
    }
  },

  /**
   * Calculate optimal panel dimensions based on screen size
   */
  calculatePanelDimensions: (
    screenSize: 'desktop' | 'tablet' | 'mobile',
    panelType: 'main' | 'sidebar' | 'commandBar' | 'statusBar'
  ) => {
    const sizes = MISSION_CONTROL_CONSTANTS.PANEL_SIZES;
    
    switch (panelType) {
      case 'main':
        return sizes.MAIN_VISUALIZATION[screenSize];
      case 'sidebar':
        return sizes.SIDEBAR[screenSize];
      case 'commandBar':
        return sizes.COMMAND_BAR.height;
      case 'statusBar':
        return sizes.STATUS_BAR.height;
      default:
        return '100%';
    }
  },

  /**
   * Generate accessible ARIA labels for visualization modes
   */
  getVisualizationModeLabel: (mode: VisualizationMode): string => {
    const labels = {
      '3d': '3D visualization of rover and environment',
      'map': 'Map view of rover location and terrain',
      'data': 'Data visualization charts and metrics'
    };
    return labels[mode];
  },

  /**
   * Create context menu items with accessibility support
   */
  createContextMenuItem: (
    id: string,
    label: string,
    action: () => void,
    options: {
      icon?: string;
      shortcut?: string;
      disabled?: boolean;
    } = {}
  ): ContextMenuItem => ({
    id,
    label,
    action,
    ...options
  })
};

/**
 * Type exports for better TypeScript integration
 */
export type ScreenSize = 'desktop' | 'tablet' | 'mobile';
export type PanelType = 'main' | 'sidebar' | 'commandBar' | 'statusBar';