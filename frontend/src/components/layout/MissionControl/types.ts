/**
 * Mission Control Layout Types
 * Comprehensive type definitions for the mission control center layout system
 */

import { GridState, PanelInstance } from '../../../types/grid';

export type LayoutPreset = 'operations' | 'analysis' | 'emergency' | 'maintenance';

export interface MissionControlArea {
  id: string;
  name: string;
  gridArea: string;
  defaultPanels: string[];
  minWidth?: string;
  minHeight?: string;
  isCollapsible?: boolean;
  isResizable?: boolean;
  priority: number; // For responsive collapse order
}

export interface LayoutConfiguration {
  id: LayoutPreset;
  name: string;
  description: string;
  gridTemplate: {
    areas: string;
    columns: string;
    rows: string;
  };
  areas: MissionControlArea[];
  responsive: {
    [breakpoint: string]: {
      gridTemplate: {
        areas: string;
        columns: string;
        rows: string;
      };
      hiddenAreas?: string[];
    };
  };
  shortcuts?: {
    [key: string]: string; // key combo -> panel id
  };
}

export interface MissionControlState {
  currentPreset: LayoutPreset;
  activeAreas: string[];
  focusedPanel?: string;
  focusHistory: string[];
  isTransitioning: boolean;
  customLayouts: { [key: string]: LayoutConfiguration };
  preferences: {
    autoSave: boolean;
    animationsEnabled: boolean;
    keyboardNavigation: boolean;
    highContrast: boolean;
  };
}

export interface PanelFocusContext {
  panelId: string;
  areaId: string;
  timestamp: number;
  interactionType: 'keyboard' | 'mouse' | 'programmatic';
}

export interface LayoutTransition {
  from: LayoutPreset;
  to: LayoutPreset;
  duration: number;
  easing: string;
  stagger?: number;
}

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  action: () => void;
  category: 'navigation' | 'panel' | 'layout' | 'accessibility';
  global?: boolean;
}

export interface AccessibilityAnnouncement {
  message: string;
  priority: 'low' | 'medium' | 'high';
  type: 'status' | 'alert' | 'log';
}

export interface LayoutEventData {
  type: 'preset-change' | 'panel-focus' | 'area-collapse' | 'area-expand' | 'shortcut-trigger';
  payload: any;
  timestamp: number;
  source: 'user' | 'system' | 'external';
}

export interface MissionControlLayoutProps {
  initialPreset?: LayoutPreset;
  customPresets?: LayoutConfiguration[];
  onPresetChange?: (preset: LayoutPreset) => void;
  onPanelFocus?: (context: PanelFocusContext) => void;
  onLayoutEvent?: (event: LayoutEventData) => void;
  className?: string;
  'data-testid'?: string;
  children?: React.ReactNode;
}

export interface LayoutContextValue {
  state: MissionControlState;
  configurations: Record<LayoutPreset, LayoutConfiguration>;
  
  // State actions
  setPreset: (preset: LayoutPreset) => void;
  toggleArea: (areaId: string) => void;
  focusPanel: (panelId: string, source?: 'keyboard' | 'mouse' | 'programmatic') => void;
  cycleFocus: (direction: 'next' | 'previous') => void;
  
  // Layout actions
  saveCustomLayout: (id: string, config: LayoutConfiguration) => void;
  loadCustomLayout: (id: string) => void;
  resetToDefault: () => void;
  
  // Utility functions
  getAreaPanels: (areaId: string) => PanelInstance[];
  isPanelVisible: (panelId: string) => boolean;
  getShortcuts: () => KeyboardShortcut[];
  announceToScreenReader: (announcement: AccessibilityAnnouncement) => void;
}

// Default layout configurations
export const DEFAULT_LAYOUTS: Record<LayoutPreset, LayoutConfiguration> = {
  operations: {
    id: 'operations',
    name: 'Operations',
    description: 'Standard operational layout with primary 3D view and control panels',
    gridTemplate: {
      areas: `
        "header header header header"
        "sidebar main-3d main-3d status"
        "sidebar telemetry telemetry status"
        "footer footer footer footer"
      `,
      columns: '280px 1fr 1fr 320px',
      rows: '60px 2fr 1fr 60px'
    },
    areas: [
      {
        id: 'header',
        name: 'Header',
        gridArea: 'header',
        defaultPanels: ['mission-status', 'alerts'],
        isCollapsible: false,
        priority: 1
      },
      {
        id: 'sidebar',
        name: 'Navigation',
        gridArea: 'sidebar',
        defaultPanels: ['navigation', 'quick-actions'],
        isCollapsible: true,
        minWidth: '200px',
        priority: 3
      },
      {
        id: 'main-3d',
        name: 'Primary Visualization',
        gridArea: 'main-3d',
        defaultPanels: ['3d-scene', 'trajectory'],
        priority: 1
      },
      {
        id: 'telemetry',
        name: 'Telemetry',
        gridArea: 'telemetry',
        defaultPanels: ['realtime-data', 'charts'],
        priority: 2
      },
      {
        id: 'status',
        name: 'Status',
        gridArea: 'status',
        defaultPanels: ['system-health', 'communications'],
        isCollapsible: true,
        minWidth: '250px',
        priority: 4
      },
      {
        id: 'footer',
        name: 'Footer',
        gridArea: 'footer',
        defaultPanels: ['command-bar', 'timeline'],
        isCollapsible: false,
        priority: 1
      }
    ],
    responsive: {
      lg: {
        gridTemplate: {
          areas: `
            "header header header header"
            "sidebar main-3d main-3d status"
            "sidebar telemetry telemetry status"
            "footer footer footer footer"
          `,
          columns: '280px 1fr 1fr 320px',
          rows: '60px 2fr 1fr 60px'
        }
      },
      md: {
        gridTemplate: {
          areas: `
            "header header header"
            "sidebar main-3d status"
            "sidebar telemetry status"
            "footer footer footer"
          `,
          columns: '250px 1fr 280px',
          rows: '60px 2fr 1fr 60px'
        }
      },
      sm: {
        gridTemplate: {
          areas: `
            "header header"
            "main-3d status"
            "telemetry status"
            "footer footer"
          `,
          columns: '1fr 280px',
          rows: '60px 2fr 1fr 60px'
        },
        hiddenAreas: ['sidebar']
      },
      xs: {
        gridTemplate: {
          areas: `
            "header"
            "main-3d"
            "telemetry"
            "footer"
          `,
          columns: '1fr',
          rows: '60px 2fr 1fr 60px'
        },
        hiddenAreas: ['sidebar', 'status']
      }
    },
    shortcuts: {
      'ctrl+1': 'main-3d',
      'ctrl+2': 'telemetry',
      'ctrl+3': 'status',
      'ctrl+4': 'sidebar'
    }
  },

  analysis: {
    id: 'analysis',
    name: 'Analysis',
    description: 'Data analysis focused layout with expanded telemetry and visualization',
    gridTemplate: {
      areas: `
        "header header header header"
        "tools charts charts data"
        "tools timeline timeline data"
        "footer footer footer footer"
      `,
      columns: '250px 1fr 1fr 300px',
      rows: '60px 2fr 1fr 60px'
    },
    areas: [
      {
        id: 'header',
        name: 'Header',
        gridArea: 'header',
        defaultPanels: ['analysis-toolbar', 'time-controls'],
        isCollapsible: false,
        priority: 1
      },
      {
        id: 'tools',
        name: 'Analysis Tools',
        gridArea: 'tools',
        defaultPanels: ['data-filters', 'analysis-config'],
        isCollapsible: true,
        minWidth: '200px',
        priority: 3
      },
      {
        id: 'charts',
        name: 'Visualization',
        gridArea: 'charts',
        defaultPanels: ['correlation-matrix', 'trend-analysis'],
        priority: 1
      },
      {
        id: 'timeline',
        name: 'Timeline',
        gridArea: 'timeline',
        defaultPanels: ['historical-playback', 'annotations'],
        priority: 2
      },
      {
        id: 'data',
        name: 'Data Inspector',
        gridArea: 'data',
        defaultPanels: ['raw-data', 'statistics'],
        isCollapsible: true,
        minWidth: '250px',
        priority: 4
      },
      {
        id: 'footer',
        name: 'Footer',
        gridArea: 'footer',
        defaultPanels: ['export-tools', 'analysis-notes'],
        isCollapsible: false,
        priority: 1
      }
    ],
    responsive: {
      lg: {
        gridTemplate: {
          areas: `
            "header header header header"
            "tools charts charts data"
            "tools timeline timeline data"
            "footer footer footer footer"
          `,
          columns: '250px 1fr 1fr 300px',
          rows: '60px 2fr 1fr 60px'
        }
      },
      md: {
        gridTemplate: {
          areas: `
            "header header header"
            "tools charts data"
            "tools timeline data"
            "footer footer footer"
          `,
          columns: '230px 1fr 280px',
          rows: '60px 2fr 1fr 60px'
        }
      },
      sm: {
        gridTemplate: {
          areas: `
            "header header"
            "charts data"
            "timeline data"
            "footer footer"
          `,
          columns: '1fr 280px',
          rows: '60px 2fr 1fr 60px'
        },
        hiddenAreas: ['tools']
      }
    },
    shortcuts: {
      'ctrl+1': 'charts',
      'ctrl+2': 'timeline',
      'ctrl+3': 'data',
      'ctrl+4': 'tools'
    }
  },

  emergency: {
    id: 'emergency',
    name: 'Emergency',
    description: 'Emergency response layout with critical alerts and quick actions',
    gridTemplate: {
      areas: `
        "alerts alerts alerts alerts"
        "status main-3d main-3d comms"
        "status commands commands comms"
        "emergency emergency emergency emergency"
      `,
      columns: '300px 1fr 1fr 300px',
      rows: '80px 2fr 1fr 80px'
    },
    areas: [
      {
        id: 'alerts',
        name: 'Critical Alerts',
        gridArea: 'alerts',
        defaultPanels: ['emergency-alerts', 'system-warnings'],
        isCollapsible: false,
        priority: 1
      },
      {
        id: 'status',
        name: 'System Status',
        gridArea: 'status',
        defaultPanels: ['health-monitor', 'diagnostics'],
        isCollapsible: false,
        minWidth: '250px',
        priority: 2
      },
      {
        id: 'main-3d',
        name: 'Rover View',
        gridArea: 'main-3d',
        defaultPanels: ['3d-scene', 'camera-feeds'],
        priority: 1
      },
      {
        id: 'commands',
        name: 'Emergency Commands',
        gridArea: 'commands',
        defaultPanels: ['emergency-stop', 'recovery-actions'],
        priority: 2
      },
      {
        id: 'comms',
        name: 'Communications',
        gridArea: 'comms',
        defaultPanels: ['mission-control', 'team-chat'],
        isCollapsible: false,
        minWidth: '250px',
        priority: 3
      },
      {
        id: 'emergency',
        name: 'Emergency Actions',
        gridArea: 'emergency',
        defaultPanels: ['emergency-protocols', 'contact-list'],
        isCollapsible: false,
        priority: 1
      }
    ],
    responsive: {
      lg: {
        gridTemplate: {
          areas: `
            "alerts alerts alerts alerts"
            "status main-3d main-3d comms"
            "status commands commands comms"
            "emergency emergency emergency emergency"
          `,
          columns: '300px 1fr 1fr 300px',
          rows: '80px 2fr 1fr 80px'
        }
      },
      md: {
        gridTemplate: {
          areas: `
            "alerts alerts alerts"
            "status main-3d comms"
            "status commands comms"
            "emergency emergency emergency"
          `,
          columns: '280px 1fr 280px',
          rows: '80px 2fr 1fr 80px'
        }
      },
      sm: {
        gridTemplate: {
          areas: `
            "alerts alerts"
            "main-3d comms"
            "commands comms"
            "emergency emergency"
          `,
          columns: '1fr 280px',
          rows: '80px 2fr 1fr 80px'
        },
        hiddenAreas: ['status']
      }
    },
    shortcuts: {
      'ctrl+e': 'emergency',
      'ctrl+1': 'main-3d',
      'ctrl+2': 'commands',
      'ctrl+3': 'comms'
    }
  },

  maintenance: {
    id: 'maintenance',
    name: 'Maintenance',
    description: 'Maintenance and diagnostics layout with detailed system information',
    gridTemplate: {
      areas: `
        "header header header header"
        "diagnostics hardware hardware logs"
        "diagnostics firmware firmware logs"
        "footer footer footer footer"
      `,
      columns: '320px 1fr 1fr 300px',
      rows: '60px 1fr 1fr 60px'
    },
    areas: [
      {
        id: 'header',
        name: 'Header',
        gridArea: 'header',
        defaultPanels: ['maintenance-toolbar', 'system-overview'],
        isCollapsible: false,
        priority: 1
      },
      {
        id: 'diagnostics',
        name: 'Diagnostics',
        gridArea: 'diagnostics',
        defaultPanels: ['system-diagnostics', 'performance-metrics'],
        isCollapsible: true,
        minWidth: '280px',
        priority: 2
      },
      {
        id: 'hardware',
        name: 'Hardware Status',
        gridArea: 'hardware',
        defaultPanels: ['hardware-monitor', 'sensor-status'],
        priority: 1
      },
      {
        id: 'firmware',
        name: 'Firmware Management',
        gridArea: 'firmware',
        defaultPanels: ['firmware-versions', 'update-manager'],
        priority: 2
      },
      {
        id: 'logs',
        name: 'System Logs',
        gridArea: 'logs',
        defaultPanels: ['error-logs', 'audit-trail'],
        isCollapsible: true,
        minWidth: '250px',
        priority: 3
      },
      {
        id: 'footer',
        name: 'Footer',
        gridArea: 'footer',
        defaultPanels: ['maintenance-actions', 'schedule'],
        isCollapsible: false,
        priority: 1
      }
    ],
    responsive: {
      lg: {
        gridTemplate: {
          areas: `
            "header header header header"
            "diagnostics hardware hardware logs"
            "diagnostics firmware firmware logs"
            "footer footer footer footer"
          `,
          columns: '320px 1fr 1fr 300px',
          rows: '60px 1fr 1fr 60px'
        }
      },
      md: {
        gridTemplate: {
          areas: `
            "header header header"
            "diagnostics hardware logs"
            "diagnostics firmware logs"
            "footer footer footer"
          `,
          columns: '300px 1fr 280px',
          rows: '60px 1fr 1fr 60px'
        }
      },
      sm: {
        gridTemplate: {
          areas: `
            "header header"
            "hardware logs"
            "firmware logs"
            "footer footer"
          `,
          columns: '1fr 280px',
          rows: '60px 1fr 1fr 60px'
        },
        hiddenAreas: ['diagnostics']
      }
    },
    shortcuts: {
      'ctrl+1': 'hardware',
      'ctrl+2': 'firmware',
      'ctrl+3': 'logs',
      'ctrl+4': 'diagnostics'
    }
  }
};