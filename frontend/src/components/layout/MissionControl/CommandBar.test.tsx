/**
 * Unit tests for CommandBar component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@emotion/react';
import { CommandBar } from './CommandBar';
import { ConnectionStatus, CommandQueueStatus } from './types';
import { defaultTheme } from '../../../theme/themes';

// Mock theme provider wrapper
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={defaultTheme}>
    {children}
  </ThemeProvider>
);

// Default props
const defaultConnectionStatus: ConnectionStatus = {
  isConnected: true,
  lastHeartbeat: new Date(),
  latency: 50,
  protocol: 'websocket',
  endpoint: 'ws://localhost:8000'
};

const defaultQueueStatus: CommandQueueStatus = {
  pending: 0,
  executing: 0,
  completed: 5,
  failed: 0
};

const defaultProps = {
  connectionStatus: defaultConnectionStatus,
  queueStatus: defaultQueueStatus,
  onExecuteCommand: jest.fn(),
  onConfirmCommand: jest.fn()
};

describe('CommandBar', () => {
  let mockOnExecuteCommand: jest.Mock;
  let mockOnConfirmCommand: jest.Mock;

  beforeEach(() => {
    mockOnExecuteCommand = jest.fn().mockResolvedValue(undefined);
    mockOnConfirmCommand = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    expect(screen.getByTestId('command-input')).toBeInTheDocument();
  });

  it('displays connection status correctly', () => {
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    expect(screen.getByText('websocket • 50ms')).toBeInTheDocument();
  });

  it('shows disconnected status when not connected', () => {
    const disconnectedStatus = { ...defaultConnectionStatus, isConnected: false };
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          connectionStatus={disconnectedStatus} 
        />
      </ThemeWrapper>
    );

    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('displays queue status when commands are pending', () => {
    const queueWithPending = { ...defaultQueueStatus, pending: 3 };
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          queueStatus={queueWithPending} 
        />
      </ThemeWrapper>
    );

    expect(screen.getByTestId('queue-pending')).toHaveTextContent('3 queued');
  });

  it('focuses input when Ctrl+K is pressed', async () => {
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    // Press Ctrl+K
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it('shows suggestions when typing', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'status');

    await waitFor(() => {
      expect(screen.getByText('Display rover system status')).toBeInTheDocument();
    });
  });

  it('navigates suggestions with arrow keys', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'move');

    await waitFor(() => {
      expect(screen.getByTestId('suggestion-0')).toBeInTheDocument();
    });

    // Arrow down to select next suggestion
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    await waitFor(() => {
      expect(screen.getByTestId('suggestion-1')).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('executes simple command without confirmation', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'status');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnExecuteCommand).toHaveBeenCalledWith('status', expect.any(Object));
    });
  });

  it('shows confirmation modal for dangerous commands', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
          onConfirmCommand={mockOnConfirmCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'emergency stop');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('command-confirmation')).toBeInTheDocument();
    });
  });

  it('executes command after confirmation', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
          onConfirmCommand={mockOnConfirmCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'reboot');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('command-confirmation')).toBeInTheDocument();
    });

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockOnExecuteCommand).toHaveBeenCalledWith('reboot', expect.any(Object));
    });
  });

  it('cancels command confirmation', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
          onConfirmCommand={mockOnConfirmCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'reboot');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByTestId('command-confirmation')).toBeInTheDocument();
    });

    // Click cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId('command-confirmation')).not.toBeInTheDocument();
    });

    expect(mockOnExecuteCommand).not.toHaveBeenCalled();
  });

  it('handles quick action buttons', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    const emergencyStopButton = screen.getByTestId('quick-action-emergency-stop');
    await user.click(emergencyStopButton);

    const input = screen.getByTestId('command-input');
    expect(input).toHaveValue('emergency stop');
  });

  it('disables input when disconnected', () => {
    const disconnectedStatus = { ...defaultConnectionStatus, isConnected: false };
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          connectionStatus={disconnectedStatus} 
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    expect(input).toBeDisabled();
  });

  it('disables actions when executing', async () => {
    const user = userEvent.setup();
    
    // Mock a slow-executing command
    mockOnExecuteCommand.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'status');
    fireEvent.keyDown(input, { key: 'Enter' });

    // Check that quick actions are disabled
    const emergencyButton = screen.getByTestId('quick-action-emergency-stop');
    expect(emergencyButton).toBeDisabled();
  });

  it('completes suggestion with Tab key', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar {...defaultProps} />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'stat');

    await waitFor(() => {
      expect(screen.getByText('status')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(input).toHaveValue('status');
    });
  });

  it('navigates command history with arrow keys', async () => {
    const history = [
      {
        id: '1',
        command: 'status',
        parameters: {},
        timestamp: new Date(),
        status: 'completed' as const
      },
      {
        id: '2',
        command: 'move forward 5',
        parameters: { distance: 5 },
        timestamp: new Date(),
        status: 'completed' as const
      }
    ];

    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          history={history}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    await user.click(input);

    // Arrow up to navigate history
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('move forward 5');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('status');
  });

  it('clears input after successful execution', async () => {
    const user = userEvent.setup();
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'status');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnExecuteCommand).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('handles command execution errors gracefully', async () => {
    const user = userEvent.setup();
    mockOnExecuteCommand.mockRejectedValue(new Error('Command failed'));
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          onExecuteCommand={mockOnExecuteCommand}
        />
      </ThemeWrapper>
    );

    const input = screen.getByTestId('command-input');
    
    await user.click(input);
    await user.type(input, 'status');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockOnExecuteCommand).toHaveBeenCalled();
    });

    // Should not clear input on error
    expect(input).toHaveValue('status');
  });

  it('shows executing status when commands are running', () => {
    const executingQueue = { ...defaultQueueStatus, executing: 2 };
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          queueStatus={executingQueue} 
        />
      </ThemeWrapper>
    );

    expect(screen.getByText('Executing...')).toBeInTheDocument();
  });

  it('shows error status when commands have failed', () => {
    const failedQueue = { ...defaultQueueStatus, failed: 1 };
    
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          queueStatus={failedQueue} 
        />
      </ThemeWrapper>
    );

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          className="custom-command-bar"
        />
      </ThemeWrapper>
    );

    expect(container.firstChild).toHaveClass('custom-command-bar');
  });

  it('applies testId correctly', () => {
    render(
      <ThemeWrapper>
        <CommandBar 
          {...defaultProps} 
          testId="test-command-bar"
        />
      </ThemeWrapper>
    );

    expect(screen.getByTestId('test-command-bar')).toBeInTheDocument();
  });
});