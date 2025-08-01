/**
 * Storybook stories for CommandBar component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { CommandBar } from './CommandBar';
import { ConnectionStatus, CommandQueueStatus, CommandHistory } from './types';

// Mock data
const mockConnectionStatus: ConnectionStatus = {
  isConnected: true,
  lastHeartbeat: new Date(),
  latency: 42,
  protocol: 'websocket',
  endpoint: 'ws://localhost:8000'
};

const mockDisconnectedStatus: ConnectionStatus = {
  isConnected: false,
  protocol: 'websocket',
  reconnectAttempts: 3
};

const mockQueueStatus: CommandQueueStatus = {
  pending: 0,
  executing: 0,
  completed: 15,
  failed: 0
};

const mockBusyQueueStatus: CommandQueueStatus = {
  pending: 3,
  executing: 1,
  completed: 12,
  failed: 1,
  totalEstimatedTime: 45
};

const mockHistory: CommandHistory[] = [
  {
    id: '1',
    command: 'status',
    parameters: {},
    timestamp: new Date(Date.now() - 30000),
    status: 'completed',
    executionTime: 250
  },
  {
    id: '2',
    command: 'move forward 5 slow',
    parameters: { distance: 5, speed: 'slow' },
    timestamp: new Date(Date.now() - 120000),
    status: 'completed',
    executionTime: 12000
  },
  {
    id: '3',
    command: 'sample soil 10',
    parameters: { depth: 10 },
    timestamp: new Date(Date.now() - 300000),
    status: 'completed',
    executionTime: 45000
  },
  {
    id: '4',
    command: 'turn left 90',
    parameters: { angle: 90 },
    timestamp: new Date(Date.now() - 400000),
    status: 'failed',
    error: 'Navigation system error'
  }
];

const meta: Meta<typeof CommandBar> = {
  title: 'Layout/MissionControl/CommandBar',
  component: CommandBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Mission Control Command Bar - A comprehensive command interface for rover operations.

## Features
- **Fuzzy Search**: Intelligent command suggestions with fuzzy matching
- **Command History**: Navigate through previous commands with arrow keys
- **Validation**: Real-time command validation with error feedback
- **Confirmation**: Safety confirmations for dangerous operations
- **Quick Actions**: One-click access to common commands
- **Status Indicators**: Real-time connection and queue status
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Accessibility**: WCAG 2.1 AA compliant with screen reader support

## Keyboard Shortcuts
- **Ctrl+K**: Focus command bar
- **↑/↓**: Navigate suggestions or command history
- **Tab**: Complete current suggestion
- **Enter**: Execute command
- **Escape**: Close suggestions

## Command Categories
- **Navigation**: Movement and positioning
- **Sampling**: Sample collection and analysis
- **System**: System management and diagnostics
- **Emergency**: Emergency and safety commands
- **Telemetry**: Data streaming and monitoring
        `
      }
    }
  },
  argTypes: {
    connectionStatus: {
      description: 'Current connection status to rover',
      control: { type: 'object' }
    },
    queueStatus: {
      description: 'Command queue status information',
      control: { type: 'object' }
    },
    history: {
      description: 'Command execution history',
      control: { type: 'object' }
    },
    onExecuteCommand: {
      description: 'Callback when a command is executed',
      action: 'executeCommand'
    },
    onConfirmCommand: {
      description: 'Callback for command confirmation (optional)',
      action: 'confirmCommand'
    }
  },
  decorators: [
    (Story) => (
      <div style={{ 
        height: '100vh', 
        backgroundColor: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div style={{ 
          padding: '20px',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxWidth: '800px',
          width: '100%'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Mission Control Interface</h3>
          <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
            The command bar is positioned at the bottom of the viewport. Try typing commands like:
          </p>
          <ul style={{ margin: '8px 0 0 0', padding: '0 0 0 20px', fontSize: '14px', color: '#666' }}>
            <li><code>status</code> - Check rover status</li>
            <li><code>move forward 5</code> - Move rover forward</li>
            <li><code>emergency stop</code> - Emergency halt</li>
            <li><code>sample soil</code> - Collect soil sample</li>
          </ul>
        </div>
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof CommandBar>;

export const Default: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  }
};

export const Disconnected: Story = {
  args: {
    connectionStatus: mockDisconnectedStatus,
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Command bar when rover connection is lost. Input is disabled and status shows disconnected state.'
      }
    }
  }
};

export const BusyQueue: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockBusyQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Command bar with active command queue. Shows pending commands and current execution status.'
      }
    }
  }
};

export const HighLatency: Story = {
  args: {
    connectionStatus: {
      ...mockConnectionStatus,
      latency: 2500
    },
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Command bar with high latency connection. Useful for testing with poor network conditions.'
      }
    }
  }
};

export const ErrorState: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: {
      ...mockQueueStatus,
      failed: 2
    },
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Command bar showing error state when commands have failed execution.'
      }
    }
  }
};

export const NoHistory: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockQueueStatus,
    history: [],
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Fresh command bar with no command history.'
      }
    }
  }
};

export const SerialConnection: Story = {
  args: {
    connectionStatus: {
      ...mockConnectionStatus,
      protocol: 'serial',
      endpoint: 'COM3',
      latency: 15
    },
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Command bar connected via serial protocol instead of WebSocket.'
      }
    }
  }
};

export const HttpFallback: Story = {
  args: {
    connectionStatus: {
      ...mockConnectionStatus,
      protocol: 'http',
      endpoint: 'http://rover.local/api',
      latency: 180
    },
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: 'Command bar using HTTP fallback when WebSocket connection is unavailable.'
      }
    }
  }
};

// Interactive stories for testing specific features
export const TestCommandSuggestions: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: `
Interactive test for command suggestions. Try typing:
- "move" - See navigation commands
- "stat" - See status command
- "emer" - See emergency commands
- "sam" - See sampling commands
        `
      }
    }
  }
};

export const TestDangerousCommands: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: `
Test dangerous commands that require confirmation:
- "emergency stop" - Critical command
- "reboot" - High danger level
- "move forward 50" - Requires confirmation
        `
      }
    }
  }
};

export const TestKeyboardNavigation: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: `
Test keyboard navigation:
1. Press Ctrl+K to focus command bar
2. Type "move" to see suggestions
3. Use ↑/↓ arrows to navigate
4. Press Tab to complete suggestion
5. Use ↑/↓ without suggestions to browse history
        `
      }
    }
  }
};

export const AccessibilityTest: Story = {
  args: {
    connectionStatus: mockConnectionStatus,
    queueStatus: mockQueueStatus,
    history: mockHistory,
    onExecuteCommand: action('executeCommand'),
    onConfirmCommand: action('confirmCommand')
  },
  parameters: {
    docs: {
      description: {
        story: `
Accessibility testing story:
- Screen reader support with proper ARIA labels
- High contrast mode compatibility
- Full keyboard navigation
- Focus management and trapping
- Semantic HTML structure
        `
      }
    }
  }
};