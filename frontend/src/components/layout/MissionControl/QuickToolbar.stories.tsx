/**
 * Storybook stories for QuickToolbar component
 * Demonstrates various configurations and use cases
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { QuickToolbar } from './QuickToolbar';
import { RoverContext, ToolAction, ToolbarLayout } from './QuickToolbar';

const meta: Meta<typeof QuickToolbar> = {
  title: 'Mission Control/QuickToolbar',
  component: QuickToolbar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The QuickToolbar provides a customizable floating toolbar with mission-critical actions.

Features:
- Drag-and-drop tool reordering
- Context-aware tool visibility
- Keyboard navigation and shortcuts
- Accessibility compliance (WCAG 2.1 AA)
- User preference persistence
- Plugin architecture for custom tools
- Integration with CommandBar

The toolbar adapts to different rover states and user permissions, showing only relevant tools.
        `
      }
    }
  },
  argTypes: {
    roverContext: {
      description: 'Current rover state and context',
      control: 'object'
    },
    tools: {
      description: 'Available tool actions',
      control: 'object'
    },
    initialLayout: {
      description: 'Initial toolbar layout configuration',
      control: 'object'
    },
    onToolExecute: {
      description: 'Callback when tool is executed',
      action: 'tool-executed'
    },
    onPreferencesChange: {
      description: 'Callback when preferences change',
      action: 'preferences-changed'
    },
    onCommandBarIntegration: {
      description: 'Callback for CommandBar integration',
      action: 'command-bar-integration'
    }
  }
};

export default meta;
type Story = StoryObj<typeof QuickToolbar>;

// Default rover context for stories
const defaultRoverContext: RoverContext = {
  isConnected: true,
  currentState: 'operational',
  capabilities: ['navigation', 'sampling', 'imaging', 'communication'],
  batteryLevel: 85,
  location: { x: 100, y: 200, z: 50 },
  isEmergency: false,
  activeCommands: [],
  permissions: ['navigate', 'sample', 'image', 'diagnostics']
};

// Emergency rover context
const emergencyRoverContext: RoverContext = {
  ...defaultRoverContext,
  isEmergency: true,
  batteryLevel: 25,
  currentState: 'emergency',
  activeCommands: ['emergency-stop']
};

// Disconnected rover context
const disconnectedRoverContext: RoverContext = {
  ...defaultRoverContext,
  isConnected: false,
  currentState: 'disconnected',
  activeCommands: []
};

// Limited capabilities context
const limitedRoverContext: RoverContext = {
  ...defaultRoverContext,
  capabilities: ['communication'],
  batteryLevel: 15,
  currentState: 'low-power',
  permissions: ['diagnostics']
};

// Custom tool examples
const customTools: ToolAction[] = [
  {
    id: 'thermal-scan',
    name: 'Thermal Scan',
    category: 'diagnostic',
    description: 'Perform thermal imaging scan of surroundings',
    icon: '🌡️',
    shortcut: 'Ctrl+T',
    state: 'enabled',
    contextRequirements: ['thermal_camera'],
    onExecute: async () => {
      action('thermal-scan-executed')();
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    isVisible: (context) => context.capabilities.includes('thermal_imaging')
  },
  {
    id: 'soil-analysis',
    name: 'Soil Analysis',
    category: 'sampling',
    description: 'Analyze soil composition at current location',
    icon: '🏔️',
    shortcut: 'Ctrl+A',
    state: 'enabled',
    confirmationRequired: true,
    dangerLevel: 'medium',
    contextRequirements: ['spectrometer', 'drilling_capability'],
    onExecute: async () => {
      action('soil-analysis-executed')();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  },
  {
    id: 'deep-sleep',
    name: 'Deep Sleep',
    category: 'system',
    description: 'Enter power-saving deep sleep mode',
    icon: '😴',
    shortcut: 'Ctrl+Shift+S',
    state: 'enabled',
    confirmationRequired: true,
    dangerLevel: 'high',
    onExecute: async () => {
      action('deep-sleep-executed')();
    }
  }
];

// Layout configurations
const floatingLayout: Partial<ToolbarLayout> = {
  position: 'floating',
  orientation: 'vertical',
  size: 'medium',
  showLabels: false,
  autoHide: false,
  maxTools: 8
};

const bottomLayout: Partial<ToolbarLayout> = {
  position: 'bottom',
  orientation: 'horizontal',
  size: 'large',
  showLabels: true,
  autoHide: false,
  maxTools: 10
};

const compactLayout: Partial<ToolbarLayout> = {
  position: 'floating',
  orientation: 'horizontal',
  size: 'small',
  showLabels: false,
  autoHide: true,
  maxTools: 6
};

// Default story
export const Default: Story = {
  args: {
    roverContext: defaultRoverContext,
    initialLayout: floatingLayout,
    onToolExecute: action('tool-executed'),
    onPreferencesChange: action('preferences-changed'),
    onCommandBarIntegration: action('command-integration')
  }
};

// Operational state with all tools
export const Operational: Story = {
  args: {
    ...Default.args,
    roverContext: defaultRoverContext,
    tools: [...(Default.args?.tools || []), ...customTools],
    initialLayout: {
      position: 'floating',
      orientation: 'vertical',
      size: 'medium',
      showLabels: true,
      autoHide: false,
      maxTools: 10
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Toolbar in operational state with full tool set and labels enabled.'
      }
    }
  }
};

// Emergency state
export const Emergency: Story = {
  args: {
    ...Default.args,
    roverContext: emergencyRoverContext,
    initialLayout: {
      position: 'floating',
      orientation: 'horizontal',
      size: 'large',
      showLabels: true,
      autoHide: false,
      maxTools: 4
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Emergency state showing only safety-critical tools with high visibility.'
      }
    }
  }
};

// Disconnected state
export const Disconnected: Story = {
  args: {
    ...Default.args,
    roverContext: disconnectedRoverContext
  },
  parameters: {
    docs: {
      description: {
        story: 'Disconnected state with tools disabled and visual feedback.'
      }
    }
  }
};

// Limited capabilities
export const LimitedCapabilities: Story = {
  args: {
    ...Default.args,
    roverContext: limitedRoverContext,
    initialLayout: compactLayout
  },
  parameters: {
    docs: {
      description: {
        story: 'Limited rover capabilities showing only available tools in compact layout.'
      }
    }
  }
};

// Bottom horizontal layout
export const BottomHorizontal: Story = {
  args: {
    ...Default.args,
    initialLayout: bottomLayout
  },
  parameters: {
    docs: {
      description: {
        story: 'Horizontal toolbar positioned at bottom with labels and large size.'
      }
    }
  }
};

// Compact floating toolbar
export const Compact: Story = {
  args: {
    ...Default.args,
    initialLayout: {
      position: 'floating',
      orientation: 'horizontal',
      size: 'small',
      showLabels: false,
      autoHide: true,
      maxTools: 5
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact toolbar with minimal footprint and auto-hide capability.'
      }
    }
  }
};

// Custom tools showcase
export const CustomTools: Story = {
  args: {
    ...Default.args,
    tools: customTools,
    initialLayout: {
      position: 'floating',
      orientation: 'vertical',
      size: 'medium',
      showLabels: true,
      autoHide: false,
      maxTools: 8
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates custom tool implementations with specialized functionality.'
      }
    }
  }
};

// High contrast mode
export const HighContrast: Story = {
  args: {
    ...Default.args,
    roverContext: {
      ...defaultRoverContext,
      activeCommands: ['emergency-stop', 'sample-collect']
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'Toolbar optimized for high contrast accessibility mode.'
      }
    }
  },
  globals: {
    backgrounds: { value: 'dark' }
  }
};

// Mobile responsive
export const MobileResponsive: Story = {
  args: {
    ...Default.args,
    initialLayout: {
      position: 'floating',
      orientation: 'horizontal',
      size: 'medium',
      showLabels: false,
      autoHide: false,
      maxTools: 6
    }
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    },
    docs: {
      description: {
        story: 'Responsive toolbar adaptation for mobile devices.'
      }
    }
  }
};

// Loading states
export const LoadingStates: Story = {
  args: {
    ...Default.args,
    roverContext: {
      ...defaultRoverContext,
      activeCommands: ['sample-collect', 'navigate-waypoint']
    },
    tools: [
      {
        id: 'loading-tool-1',
        name: 'Processing',
        category: 'system',
        description: 'Tool currently processing',
        icon: '⚙️',
        state: 'loading',
        onExecute: async () => {}
      },
      {
        id: 'error-tool-1',
        name: 'Error Tool',
        category: 'diagnostic',
        description: 'Tool with error state',
        icon: '❌',
        state: 'error',
        onExecute: async () => {}
      },
      {
        id: 'active-tool-1',
        name: 'Active Tool',
        category: 'navigation',
        description: 'Currently active tool',
        icon: '🎯',
        state: 'active',
        onExecute: async () => {}
      }
    ]
  },
  parameters: {
    docs: {
      description: {
        story: 'Various tool states including loading, error, and active indicators.'
      }
    }
  }
};

// Accessibility demo
export const AccessibilityDemo: Story = {
  args: {
    ...Default.args,
    initialLayout: {
      position: 'floating',
      orientation: 'vertical',
      size: 'large',
      showLabels: true,
      autoHide: false,
      maxTools: 6
    }
  },
  parameters: {
    docs: {
      description: {
        story: `
Accessibility features demonstration:
- Use Tab to navigate between tools
- Use Arrow keys for directional navigation
- Use Enter or Space to execute tools
- Use Escape to exit navigation
- Global keyboard shortcuts (Ctrl+H for Home, etc.)
- Screen reader compatible with ARIA labels
        `
      }
    }
  }
};

// Plugin architecture demo
export const PluginArchitecture: Story = {
  args: {
    ...Default.args,
    tools: [
      // Core tools
      {
        id: 'core-emergency',
        name: 'Emergency',
        category: 'safety',
        description: 'Core emergency stop',
        icon: '🚨',
        state: 'enabled',
        onExecute: async () => action('core-emergency')()
      },
      // Plugin tools
      {
        id: 'plugin-weather',
        name: 'Weather Check',
        category: 'custom',
        description: 'Weather monitoring plugin',
        icon: '⛅',
        state: 'enabled',
        metadata: { plugin: 'weather-station', version: '1.2.0' },
        onExecute: async () => action('plugin-weather')()
      },
      {
        id: 'plugin-geology',
        name: 'Rock Scanner',
        category: 'custom',
        description: 'Geological analysis plugin',
        icon: '🪨',
        state: 'enabled',
        metadata: { plugin: 'geo-analyzer', version: '2.1.0' },
        onExecute: async () => action('plugin-geology')()
      }
    ]
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates plugin architecture with core and plugin-provided tools.'
      }
    }
  }
};