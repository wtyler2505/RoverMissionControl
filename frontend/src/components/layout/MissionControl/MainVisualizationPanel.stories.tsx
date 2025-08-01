/**
 * Storybook Stories for MainVisualizationPanel
 * 
 * Comprehensive stories demonstrating all states and configurations
 * of the main visualization panel component.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { within, userEvent, expect } from '@storybook/test';
import { MainVisualizationPanel } from './MainVisualizationPanel';
import './MainVisualizationPanel.css';

const meta = {
  title: 'Layout/MissionControl/MainVisualizationPanel',
  component: MainVisualizationPanel,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'desktop'
    },
    docs: {
      description: {
        component: `
The MainVisualizationPanel is the primary 3D visualization component of the Mission Control Center.
It provides real-time 3D rover visualization, mapping, and data analysis capabilities with 
enterprise-grade accessibility and performance features.

## Features
- Multiple visualization modes (3D, Map, Data)
- Three.js integration placeholder
- Drag-and-drop support
- Context menu with panel options
- WCAG 2.1 AA accessibility compliance
- Responsive design for all screen sizes
- Keyboard navigation support
- Fullscreen capability

## Accessibility
- Proper ARIA labels and landmarks
- Keyboard navigation (Tab, F11, Ctrl+1/2/3, Ctrl+R)
- Screen reader announcements
- High contrast mode support
- Reduced motion support
        `
      }
    }
  },
  argTypes: {
    mode: {
      control: { type: 'select' },
      options: ['3d', 'map', 'data'],
      description: 'Current visualization mode'
    },
    isFullscreen: {
      control: { type: 'boolean' },
      description: 'Whether panel is in fullscreen mode'
    },
    isLoading: {
      control: { type: 'boolean' },
      description: 'Loading state of the panel'
    },
    error: {
      control: { type: 'text' },
      description: 'Error message to display'
    },
    isMinimized: {
      control: { type: 'boolean' },
      description: 'Whether panel is minimized'
    },
    threeJSConfig: {
      control: { type: 'object' },
      description: 'Three.js configuration options'
    },
    dragDropConfig: {
      control: { type: 'object' },
      description: 'Drag and drop configuration'
    }
  },
  args: {
    id: 'main-viz-panel',
    onModeChange: action('mode-changed'),
    onFullscreenToggle: action('fullscreen-toggled'),
    onSettings: action('settings-opened'),
    onMinimize: action('minimized'),
    onMaximize: action('maximized'),
    onClose: action('closed'),
    testId: 'main-visualization-panel'
  }
} satisfies Meta<typeof MainVisualizationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// ========== Basic Stories ==========

/**
 * Default state showing 3D visualization mode
 */
export const Default: Story = {
  args: {
    mode: '3d'
  }
};

/**
 * Map visualization mode
 */
export const MapMode: Story = {
  args: {
    mode: 'map'
  }
};

/**
 * Data visualization mode
 */
export const DataMode: Story = {
  args: {
    mode: 'data'
  }
};

// ========== State Stories ==========

/**
 * Loading state with spinner
 */
export const Loading: Story = {
  args: {
    isLoading: true,
    mode: '3d'
  }
};

/**
 * Error state with error message
 */
export const Error: Story = {
  args: {
    error: 'Failed to connect to rover telemetry. Please check network connection.',
    mode: '3d'
  }
};

/**
 * Minimized state showing compact view
 */
export const Minimized: Story = {
  args: {
    isMinimized: true
  }
};

/**
 * Fullscreen mode
 */
export const Fullscreen: Story = {
  args: {
    isFullscreen: true,
    mode: '3d'
  },
  parameters: {
    viewport: {
      defaultViewport: 'fullscreen'
    }
  }
};

// ========== Configuration Stories ==========

/**
 * Custom Three.js configuration
 */
export const CustomThreeJSConfig: Story = {
  args: {
    mode: '3d',
    threeJSConfig: {
      enableOrbitControls: false,
      enableGrid: false,
      enableAxes: false,
      backgroundColor: '#000033',
      cameraPosition: [20, 20, 20],
      fieldOfView: 60
    }
  }
};

/**
 * Custom drag and drop configuration
 */
export const CustomDragDrop: Story = {
  args: {
    mode: '3d',
    dragDropConfig: {
      enableDragToReposition: false,
      enableDropZones: false,
      dragThreshold: 10,
      snapToGrid: true
    }
  }
};

/**
 * With visualization data
 */
export const WithData: Story = {
  args: {
    mode: 'data',
    visualizationData: {
      temperature: [25.4, 26.1, 24.8],
      pressure: [1013.2, 1012.8, 1014.1],
      humidity: [45.2, 44.9, 46.1],
      battery: [87.5]
    }
  }
};

/**
 * Custom context menu items
 */
export const CustomContextMenu: Story = {
  args: {
    mode: '3d',
    customContextMenuItems: [
      {
        id: 'custom-action-1',
        label: 'Capture Screenshot',
        icon: '📸',
        shortcut: 'Ctrl+Shift+S',
        action: action('screenshot-captured')
      },
      {
        id: 'custom-action-2',
        label: 'Share View',
        icon: '🔗',
        action: action('view-shared')
      }
    ]
  }
};

// ========== Responsive Stories ==========

/**
 * Tablet view (768px - 1199px)
 */
export const TabletView: Story = {
  args: {
    mode: '3d'
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet'
    }
  }
};

/**
 * Mobile view (< 768px)
 */
export const MobileView: Story = {
  args: {
    mode: '3d'
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
};

// ========== Interactive Stories ==========

/**
 * Mode switching interaction test
 */
export const ModeSwitching: Story = {
  args: {
    mode: '3d'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for component to render
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find and click map mode button
    const mapButton = canvas.getByRole('tab', { name: /MAP/i });
    await userEvent.click(mapButton);
    
    // Verify map content is displayed
    await expect(canvas.getByRole('img', { name: /map view/i })).toBeInTheDocument();
    
    // Click data mode button
    const dataButton = canvas.getByRole('tab', { name: /DATA/i });
    await userEvent.click(dataButton);
    
    // Verify data content is displayed
    await expect(canvas.getByRole('region', { name: /data visualization/i })).toBeInTheDocument();
  }
};

/**
 * Keyboard navigation test
 */
export const KeyboardNavigation: Story = {
  args: {
    mode: '3d'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Focus the panel
    const panel = canvas.getByRole('main', { name: /main visualization panel/i });
    panel.focus();
    
    // Test mode switching with keyboard
    await userEvent.keyboard('{Control>}1{/Control}');
    await expect(canvas.getByRole('tab', { name: /3D/i })).toHaveAttribute('aria-selected', 'true');
    
    await userEvent.keyboard('{Control>}2{/Control}');
    await expect(canvas.getByRole('tab', { name: /MAP/i })).toHaveAttribute('aria-selected', 'true');
    
    await userEvent.keyboard('{Control>}3{/Control}');
    await expect(canvas.getByRole('tab', { name: /DATA/i })).toHaveAttribute('aria-selected', 'true');
  }
};

/**
 * Context menu interaction test
 */
export const ContextMenuInteraction: Story = {
  args: {
    mode: '3d'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Right-click to open context menu
    const panel = canvas.getByRole('main');
    await userEvent.pointer({ keys: '[MouseRight]', target: panel });
    
    // Wait for context menu to appear
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify context menu is visible
    const contextMenu = canvas.getByRole('menu', { name: /visualization panel options/i });
    await expect(contextMenu).toBeInTheDocument();
    
    // Click fullscreen option
    const fullscreenOption = canvas.getByRole('menuitem', { name: /enter fullscreen/i });
    await userEvent.click(fullscreenOption);
  }
};

// ========== Accessibility Stories ==========

/**
 * High contrast mode
 */
export const HighContrast: Story = {
  args: {
    mode: '3d'
  },
  parameters: {
    backgrounds: { default: 'dark' },
    docs: {
      description: {
        story: 'High contrast mode for accessibility compliance'
      }
    }
  }
};

/**
 * Screen reader optimized
 */
export const ScreenReader: Story = {
  args: {
    mode: '3d'
  },
  parameters: {
    docs: {
      description: {
        story: `
This story demonstrates screen reader optimization features:
- Proper ARIA labels and landmarks
- Live regions for dynamic content announcements
- Semantic HTML structure
- Keyboard navigation support
        `
      }
    }
  }
};

// ========== Performance Stories ==========

/**
 * Performance test with multiple updates
 */
export const PerformanceTest: Story = {
  args: {
    mode: '3d',
    visualizationData: {}
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Simulate rapid data updates
    for (let i = 0; i < 10; i++) {
      // Update visualization data
      args.visualizationData = {
        ...args.visualizationData,
        [`metric_${i}`]: Math.random() * 100
      };
      
      // Small delay between updates
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Verify panel still responds
    const panel = canvas.getByRole('main');
    await expect(panel).toBeInTheDocument();
  }
};

// ========== Edge Cases ==========

/**
 * Very long error message
 */
export const LongErrorMessage: Story = {
  args: {
    error: `A very long error message that tests how the component handles extensive error text. This could happen when detailed diagnostic information is provided to help operators understand complex system failures in mission-critical rover operations. The error handling should gracefully display this information without breaking the layout or causing accessibility issues.`,
    mode: '3d'
  }
};

/**
 * Empty state
 */
export const EmptyState: Story = {
  args: {
    mode: 'data',
    visualizationData: {}
  }
};

/**
 * All features enabled
 */
export const AllFeaturesEnabled: Story = {
  args: {
    mode: '3d',
    threeJSConfig: {
      enableOrbitControls: true,
      enableGrid: true,
      enableAxes: true,
      backgroundColor: '#1a1a2e',
      cameraPosition: [15, 15, 15],
      fieldOfView: 70
    },
    dragDropConfig: {
      enableDragToReposition: true,
      enableDropZones: true,
      dragThreshold: 3,
      snapToGrid: true
    },
    customContextMenuItems: [
      {
        id: 'advanced-settings',
        label: 'Advanced Settings',
        icon: '⚡',
        action: action('advanced-settings-opened')
      }
    ],
    visualizationData: {
      position: { x: 10, y: 5, z: 8 },
      orientation: { roll: 2, pitch: -3, yaw: 45 },
      sensors: ['camera', 'lidar', 'gps', 'imu']
    }
  }
};