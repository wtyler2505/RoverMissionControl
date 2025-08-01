/**
 * Grid System Exports - Flexible drag-and-drop grid system
 * Mission-critical grid layout system for rover control interface
 */

// Main grid components
export { default as GridContainer } from './GridContainer';
export type { GridContainerProps, GridContainerRef } from './GridContainer';

export { default as GridPanel } from './GridPanel';
export type { GridPanelProps } from './GridPanel';

export { default as GridToolbar } from './GridToolbar';
export type { GridToolbarProps } from './GridToolbar';

export { default as GridErrorBoundary } from './GridErrorBoundary';

// Context and hooks
export { GridProvider, useGrid, useGridState, useGridActions } from './GridContext';

// Panel components
export { default as TelemetryPanel } from './Panels/TelemetryPanel';
export { default as ControlPanel } from './Panels/ControlPanel';
export { default as VisualizationPanel } from './Panels/VisualizationPanel';
export { default as StatusPanel } from './Panels/StatusPanel';
export { default as CommunicationPanel } from './Panels/CommunicationPanel';

// Panel configurations for the grid system
export const PANEL_CONFIGS = {
  telemetry: {
    id: 'telemetry',
    type: 'telemetry' as const,
    title: 'Telemetry Panel',
    subtitle: 'Real-time sensor data',
    component: TelemetryPanel,
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 12, h: 8 },
    category: 'Data',
    description: 'Real-time sensor data and metrics monitoring',
    supportedThemes: ['default', 'dark', 'highContrast', 'missionCritical'],
    requiresAuth: false,
    permissions: ['telemetry:read']
  },
  control: {
    id: 'control',
    type: 'control' as const,
    title: 'Control Panel',
    subtitle: 'Rover control interface',
    component: ControlPanel,
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    maxSize: { w: 6, h: 8 },
    category: 'Control',
    description: 'Manual and autonomous rover control interface',
    supportedThemes: ['default', 'dark', 'highContrast', 'missionCritical'],
    requiresAuth: true,
    permissions: ['rover:control']
  },
  visualization: {
    id: 'visualization',
    type: 'visualization' as const,
    title: 'Visualization Panel',
    subtitle: '3D visualization and charts',
    component: VisualizationPanel,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 10 },
    category: 'Display',
    description: '3D rover visualization, charts, and mapping',
    supportedThemes: ['default', 'dark', 'highContrast', 'missionCritical'],
    requiresAuth: false,
    permissions: ['visualization:read']
  },
  status: {
    id: 'status',
    type: 'status' as const,
    title: 'Status Panel',
    subtitle: 'System health monitoring',
    component: StatusPanel,
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 8, h: 6 },
    category: 'Monitoring',
    description: 'System health, alerts, and diagnostic information',
    supportedThemes: ['default', 'dark', 'highContrast', 'missionCritical'],
    requiresAuth: false,
    permissions: ['system:read']
  },
  communication: {
    id: 'communication',
    type: 'communication' as const,
    title: 'Communication Panel',
    subtitle: 'Mission logs and communication',
    component: CommunicationPanel,
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 8, h: 10 },
    category: 'Communication',
    description: 'Mission logs, command interface, and communication status',
    supportedThemes: ['default', 'dark', 'highContrast', 'missionCritical'],
    requiresAuth: true,
    permissions: ['communication:read', 'communication:write']
  }
};

// Default layout configurations for different breakpoints
export const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'status', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'telemetry', x: 3, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { i: 'control', x: 7, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'visualization', x: 0, y: 2, w: 7, h: 4, minW: 4, minH: 3 },
    { i: 'communication', x: 7, y: 4, w: 5, h: 5, minW: 3, minH: 3 }
  ],
  md: [
    { i: 'status', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
    { i: 'telemetry', x: 3, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { i: 'control', x: 7, y: 0, w: 3, h: 4, minW: 2, minH: 3 },
    { i: 'visualization', x: 0, y: 2, w: 7, h: 4, minW: 4, minH: 3 },
    { i: 'communication', x: 0, y: 6, w: 10, h: 4, minW: 3, minH: 3 }
  ],
  sm: [
    { i: 'status', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'telemetry', x: 4, y: 0, w: 4, h: 3, minW: 2, minH: 2 },
    { i: 'control', x: 0, y: 2, w: 4, h: 4, minW: 2, minH: 3 },
    { i: 'visualization', x: 0, y: 6, w: 8, h: 4, minW: 4, minH: 3 },
    { i: 'communication', x: 0, y: 10, w: 8, h: 4, minW: 3, minH: 3 }
  ],
  xs: [
    { i: 'status', x: 0, y: 0, w: 6, h: 2, minW: 2, minH: 2 },
    { i: 'telemetry', x: 0, y: 2, w: 6, h: 3, minW: 2, minH: 2 },
    { i: 'control', x: 0, y: 5, w: 6, h: 4, minW: 2, minH: 3 },
    { i: 'visualization', x: 0, y: 9, w: 6, h: 4, minW: 4, minH: 3 },
    { i: 'communication', x: 0, y: 13, w: 6, h: 4, minW: 3, minH: 3 }
  ],
  xxs: [
    { i: 'status', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 2 },
    { i: 'telemetry', x: 0, y: 2, w: 4, h: 3, minW: 2, minH: 2 },
    { i: 'control', x: 0, y: 5, w: 4, h: 4, minW: 2, minH: 3 },
    { i: 'visualization', x: 0, y: 9, w: 4, h: 4, minW: 4, minH: 3 },
    { i: 'communication', x: 0, y: 13, w: 4, h: 4, minW: 3, minH: 3 }
  ]
};

// Grid utility functions
export const GridUtils = {
  /**
   * Generate a unique panel ID
   */
  generatePanelId: (): string => {
    return `panel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Validate a layout configuration
   */
  validateLayout: (layout: any[]): boolean => {
    return layout.every(item => 
      item.i && 
      typeof item.x === 'number' && 
      typeof item.y === 'number' && 
      typeof item.w === 'number' && 
      typeof item.h === 'number' &&
      item.x >= 0 && 
      item.y >= 0 && 
      item.w > 0 && 
      item.h > 0
    );
  },

  /**
   * Find the next available position in a layout
   */
  findNextPosition: (layout: any[], width: number, height: number, cols: number = 12): { x: number; y: number } => {
    if (layout.length === 0) {
      return { x: 0, y: 0 };
    }

    // Find the maximum Y coordinate
    const maxY = Math.max(...layout.map(item => item.y + item.h));
    
    // Try to fit in the current row first
    for (let y = 0; y <= maxY; y++) {
      for (let x = 0; x <= cols - width; x++) {
        const position = { x, y };
        const wouldCollide = layout.some(item => 
          position.x < item.x + item.w &&
          position.x + width > item.x &&
          position.y < item.y + item.h &&
          position.y + height > item.y
        );
        
        if (!wouldCollide) {
          return position;
        }
      }
    }

    // If no space found, place at the bottom
    return { x: 0, y: maxY };
  },

  /**
   * Compact a layout by removing gaps
   */
  compactLayout: (layout: any[]): any[] => {
    const sorted = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
    const compacted = [];

    for (const item of sorted) {
      let newY = 0;
      
      // Find the lowest possible Y position
      while (compacted.some(existing => 
        item.x < existing.x + existing.w &&
        item.x + item.w > existing.x &&
        newY < existing.y + existing.h &&
        newY + item.h > existing.y
      )) {
        newY++;
      }

      compacted.push({ ...item, y: newY });
    }

    return compacted;
  },

  /**
   * Export layout to JSON string
   */
  exportLayout: (layouts: any, panels: any[]): string => {
    return JSON.stringify({
      layouts,
      panels,
      timestamp: Date.now(),
      version: '1.0'
    }, null, 2);
  },

  /**
   * Import layout from JSON string
   */
  importLayout: (jsonString: string): { layouts: any; panels: any[] } | null => {
    try {
      const data = JSON.parse(jsonString);
      if (data.layouts && data.panels) {
        return { layouts: data.layouts, panels: data.panels };
      }
    } catch (error) {
      console.error('Failed to import layout:', error);
    }
    return null;
  }
};

// Re-export types
export type * from '../../../types/grid';