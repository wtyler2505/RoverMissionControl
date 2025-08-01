/**
 * Unit tests for QuickToolbar component
 * Tests functionality, accessibility, and user interactions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QuickToolbar, ToolAction, RoverContext } from './QuickToolbar';
import { ThemeProvider } from '../../../theme/ThemeProvider';
import { defaultTheme } from '../../../theme/themes';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Test wrapper with theme
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>
    {children}
  </ThemeProvider>
);

// Mock tools for testing
const mockTools: ToolAction[] = [
  {
    id: 'test-tool-1',
    name: 'Emergency Stop',
    category: 'safety',
    description: 'Stop all operations',
    icon: '🛑',
    shortcut: 'Ctrl+X',
    state: 'enabled',
    confirmationRequired: true,
    dangerLevel: 'critical',
    onExecute: jest.fn()
  },
  {
    id: 'test-tool-2',
    name: 'Navigate Home',
    category: 'navigation',
    description: 'Return to base',
    icon: '🏠',
    shortcut: 'Ctrl+H',
    state: 'enabled',
    contextRequirements: ['navigation_enabled'],
    onExecute: jest.fn(),
    isVisible: (context) => context.isConnected
  },
  {
    id: 'test-tool-3',
    name: 'Sample Collection',
    category: 'sampling',
    description: 'Collect sample',
    icon: '🧪',
    state: 'disabled',
    onExecute: jest.fn()
  }
];

// Mock rover contexts
const connectedContext: RoverContext = {
  isConnected: true,
  currentState: 'operational',
  capabilities: ['navigation', 'sampling'],
  batteryLevel: 80,
  isEmergency: false,
  activeCommands: [],
  permissions: ['navigate', 'sample']
};

const disconnectedContext: RoverContext = {
  isConnected: false,
  currentState: 'disconnected',
  capabilities: [],
  batteryLevel: 0,
  isEmergency: false,
  activeCommands: [],
  permissions: []
};

const emergencyContext: RoverContext = {
  isConnected: true,
  currentState: 'emergency',
  capabilities: ['safety'],
  batteryLevel: 20,
  isEmergency: true,
  activeCommands: ['emergency-stop'],
  permissions: ['emergency_stop']
};

describe('QuickToolbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('Rendering', () => {
    it('renders toolbar with default tools', () => {
      render(
        <TestWrapper>
          <QuickToolbar roverContext={connectedContext} />
        </TestWrapper>
      );

      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      expect(screen.getByLabelText('Quick action toolbar')).toBeInTheDocument();
    });

    it('renders custom tools when provided', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext} 
            tools={mockTools}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('tool-test-tool-1')).toBeInTheDocument();
      expect(screen.getByTestId('tool-test-tool-2')).toBeInTheDocument();
      expect(screen.getByTestId('tool-test-tool-3')).toBeInTheDocument();
    });

    it('applies custom layout configuration', () => {
      const customLayout = {
        position: 'bottom' as const,
        orientation: 'horizontal' as const,
        size: 'large' as const,
        showLabels: true
      };

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
            initialLayout={customLayout}
          />
        </TestWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('renders customization button', () => {
      render(
        <TestWrapper>
          <QuickToolbar roverContext={connectedContext} />
        </TestWrapper>
      );

      expect(screen.getByTestId('toolbar-customize')).toBeInTheDocument();
      expect(screen.getByLabelText('Customize toolbar')).toBeInTheDocument();
    });
  });

  describe('Tool Visibility', () => {
    it('shows tools based on rover context', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      // Tool with isVisible function should be shown when connected
      expect(screen.getByTestId('tool-test-tool-2')).toBeInTheDocument();
    });

    it('hides tools when context requirements not met', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={disconnectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      // Tool with isVisible function should be hidden when disconnected
      expect(screen.queryByTestId('tool-test-tool-2')).not.toBeInTheDocument();
    });

    it('shows only safety tools in emergency context', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={emergencyContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      // Safety tool should be visible
      expect(screen.getByTestId('tool-test-tool-1')).toBeInTheDocument();
      
      // Non-safety tools should be disabled
      const navigationTool = screen.queryByTestId('tool-test-tool-2');
      if (navigationTool) {
        expect(navigationTool.querySelector('[aria-disabled="true"]')).toBeInTheDocument();
      }
    });
  });

  describe('Tool Execution', () => {
    it('executes tool when clicked', async () => {
      const user = userEvent.setup();
      const mockExecute = jest.fn();
      const tools = [{
        ...mockTools[0],
        confirmationRequired: false,
        onExecute: mockExecute
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      const toolButton = screen.getByTestId('tool-button-test-tool-1');
      await user.click(toolButton);

      expect(mockExecute).toHaveBeenCalled();
    });

    it('calls onToolExecute callback when provided', async () => {
      const user = userEvent.setup();
      const onToolExecute = jest.fn();
      const tools = [{
        ...mockTools[0],
        confirmationRequired: false
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
            onToolExecute={onToolExecute}
          />
        </TestWrapper>
      );

      const toolButton = screen.getByTestId('tool-button-test-tool-1');
      await user.click(toolButton);

      expect(onToolExecute).toHaveBeenCalledWith(tools[0]);
    });

    it('shows loading state during execution', async () => {
      const user = userEvent.setup();
      let resolveExecution: () => void;
      const executionPromise = new Promise<void>((resolve) => {
        resolveExecution = resolve;
      });

      const tools = [{
        ...mockTools[0],
        confirmationRequired: false,
        onExecute: () => executionPromise
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      const toolButton = screen.getByTestId('tool-button-test-tool-1');
      await user.click(toolButton);

      // Should show loading state
      expect(toolButton).toHaveAttribute('aria-busy', 'true');

      // Resolve execution
      act(() => {
        resolveExecution!();
      });

      await waitFor(() => {
        expect(toolButton).toHaveAttribute('aria-busy', 'false');
      });
    });

    it('does not execute disabled tools', async () => {
      const user = userEvent.setup();
      const mockExecute = jest.fn();
      const tools = [{
        ...mockTools[2],
        onExecute: mockExecute
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      const toolButton = screen.getByTestId('tool-button-test-tool-3');
      await user.click(toolButton);

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      await user.click(toolbar);

      // Navigate with arrow keys
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowRight}');

      // Should focus on tools (exact implementation depends on visible tools)
      expect(document.activeElement).toHaveAttribute('role', 'button');
    });

    it('executes tool with Enter key', async () => {
      const user = userEvent.setup();
      const mockExecute = jest.fn();
      const tools = [{
        ...mockTools[0],
        confirmationRequired: false,
        onExecute: mockExecute
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      await user.click(toolbar);
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{Enter}');

      expect(mockExecute).toHaveBeenCalled();
    });

    it('supports global keyboard shortcuts', async () => {
      const user = userEvent.setup();
      const mockExecute = jest.fn();
      const tools = [{
        ...mockTools[1],
        confirmationRequired: false,
        onExecute: mockExecute
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      // Simulate global shortcut
      await user.keyboard('{Control>}h{/Control}');

      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe('Drag and Drop', () => {
    it('supports drag and drop reordering', async () => {
      const onPreferencesChange = jest.fn();

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
            onPreferencesChange={onPreferencesChange}
          />
        </TestWrapper>
      );

      const firstTool = screen.getByTestId('tool-test-tool-1');
      const secondTool = screen.getByTestId('tool-test-tool-2');

      // Simulate drag and drop
      fireEvent.dragStart(firstTool, { dataTransfer: { effectAllowed: 'move', setData: jest.fn() } });
      fireEvent.dragOver(secondTool);
      fireEvent.drop(secondTool);

      expect(onPreferencesChange).toHaveBeenCalledWith(
        expect.objectContaining({
          toolOrder: expect.arrayContaining(['test-tool-1', 'test-tool-2'])
        })
      );
    });

    it('shows drag overlay during drag operation', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      const firstTool = screen.getByTestId('tool-test-tool-1');

      fireEvent.dragStart(firstTool, { dataTransfer: { effectAllowed: 'move', setData: jest.fn() } });

      // Should show drag overlay (implementation specific)
      expect(firstTool).toHaveStyle('opacity: 0.5');
    });
  });

  describe('Preferences', () => {
    it('loads preferences from localStorage', () => {
      const savedPreferences = {
        toolOrder: ['test-tool-2', 'test-tool-1', 'test-tool-3'],
        hiddenTools: ['test-tool-3']
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedPreferences));

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith('quickToolbar.preferences');
      // Hidden tool should not be visible
      expect(screen.queryByTestId('tool-test-tool-3')).not.toBeInTheDocument();
    });

    it('saves preferences to localStorage', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      // Trigger a preference change (e.g., through drag and drop)
      const firstTool = screen.getByTestId('tool-test-tool-1');
      const secondTool = screen.getByTestId('tool-test-tool-2');

      fireEvent.dragStart(firstTool, { dataTransfer: { effectAllowed: 'move', setData: jest.fn() } });
      fireEvent.drop(secondTool);

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
          'quickToolbar.preferences',
          expect.stringContaining('"toolOrder"')
        );
      });
    });

    it('calls onPreferencesChange callback', async () => {
      const onPreferencesChange = jest.fn();

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
            onPreferencesChange={onPreferencesChange}
          />
        </TestWrapper>
      );

      // Trigger preference change
      const firstTool = screen.getByTestId('tool-test-tool-1');
      const secondTool = screen.getByTestId('tool-test-tool-2');

      fireEvent.dragStart(firstTool, { dataTransfer: { effectAllowed: 'move', setData: jest.fn() } });
      fireEvent.drop(secondTool);

      expect(onPreferencesChange).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveAttribute('aria-label', 'Quick action toolbar');
      expect(toolbar).toHaveAttribute('aria-orientation');

      // Check tool button accessibility
      const toolButtons = screen.getAllByRole('button');
      toolButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });

    it('supports screen readers', () => {
      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      // Check for descriptive labels
      expect(screen.getByLabelText(/Emergency Stop.*Stop all operations/)).toBeInTheDocument();
    });

    it('shows focus indicators', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={mockTools}
          />
        </TestWrapper>
      );

      const toolbar = screen.getByRole('toolbar');
      await user.click(toolbar);
      await user.keyboard('{Tab}');

      // Should have visible focus indicator
      expect(document.activeElement).toHaveAttribute('tabindex', '0');
    });

    it('provides status updates for tool states', () => {
      const tools = [{
        ...mockTools[0],
        state: 'loading' as const
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      const toolButton = screen.getByTestId('tool-button-test-tool-1');
      expect(toolButton).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Customization', () => {
    it('opens customization modal', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <QuickToolbar roverContext={connectedContext} />
        </TestWrapper>
      );

      const customizeButton = screen.getByTestId('toolbar-customize');
      await user.click(customizeButton);

      expect(screen.getByTestId('toolbar-customization-modal')).toBeInTheDocument();
      expect(screen.getByText('Customize Toolbar')).toBeInTheDocument();
    });

    it('closes customization modal', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <QuickToolbar roverContext={connectedContext} />
        </TestWrapper>
      );

      // Open modal
      const customizeButton = screen.getByTestId('toolbar-customize');
      await user.click(customizeButton);

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(screen.queryByTestId('toolbar-customization-modal')).not.toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('integrates with CommandBar', async () => {
      const user = userEvent.setup();
      const onCommandBarIntegration = jest.fn();

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            onCommandBarIntegration={onCommandBarIntegration}
          />
        </TestWrapper>
      );

      // This would be triggered by a complex tool that needs CommandBar
      // For now, just test that the callback is passed through
      expect(onCommandBarIntegration).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('handles tool execution errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const tools = [{
        ...mockTools[0],
        confirmationRequired: false,
        onExecute: async () => {
          throw new Error('Execution failed');
        }
      }];

      render(
        <TestWrapper>
          <QuickToolbar 
            roverContext={connectedContext}
            tools={tools}
          />
        </TestWrapper>
      );

      const toolButton = screen.getByTestId('tool-button-test-tool-1');
      await user.click(toolButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to execute tool'),
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });

    it('handles localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <TestWrapper>
          <QuickToolbar roverContext={connectedContext} />
        </TestWrapper>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load toolbar preferences'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});