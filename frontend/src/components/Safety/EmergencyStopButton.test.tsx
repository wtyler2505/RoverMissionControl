/**
 * Unit tests for the EmergencyStopButton component
 * 
 * @module EmergencyStopButton.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material';
import EmergencyStopButton from './EmergencyStopButton';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('EmergencyStopButton', () => {
  const mockOnActivate = jest.fn();
  const mockOnDeactivate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default props', () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const button = screen.getByRole('button', { name: /activate emergency stop/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('EMERGENCY STOP');
  });

  it('shows activated state correctly', () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={true}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const button = screen.getByRole('button', { name: /clear emergency stop/i });
    expect(button).toHaveTextContent('STOP ACTIVE');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onActivate when clicked in inactive state', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const button = screen.getByRole('button', { name: /activate emergency stop/i });
    await userEvent.click(button);

    expect(mockOnActivate).toHaveBeenCalledTimes(1);
    expect(mockOnDeactivate).not.toHaveBeenCalled();
  });

  it('shows deactivation dialog when clicked in active state', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={true}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const button = screen.getByRole('button', { name: /clear emergency stop/i });
    await userEvent.click(button);

    // Check if dialog appears
    expect(screen.getByText('Clear Emergency Stop?')).toBeInTheDocument();
    expect(screen.getByText(/safety verification required/i)).toBeInTheDocument();
  });

  it('requires confirmation before deactivation', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={true}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    // Open deactivation dialog
    const button = screen.getByRole('button', { name: /clear emergency stop/i });
    await userEvent.click(button);

    // Try to clear without confirmation
    const clearButton = screen.getByRole('button', { name: /clear emergency stop/i });
    await userEvent.click(clearButton);

    expect(mockOnDeactivate).toHaveBeenCalledTimes(1);
  });

  it('respects disabled state', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
        disabled={true}
      />
    );

    const button = screen.getByRole('button', { name: /activate emergency stop/i });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(mockOnActivate).not.toHaveBeenCalled();
  });

  it('renders with custom label', () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
        label="E-STOP"
      />
    );

    expect(screen.getByText('E-STOP')).toBeInTheDocument();
  });

  it('handles keyboard shortcuts', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    // Test Ctrl+Shift+Space
    fireEvent.keyDown(window, {
      key: ' ',
      code: 'Space',
      ctrlKey: true,
      shiftKey: true,
    });

    await waitFor(() => {
      expect(mockOnActivate).toHaveBeenCalledTimes(1);
    });

    // Reset
    mockOnActivate.mockClear();

    // Test Shift+Escape
    fireEvent.keyDown(window, {
      key: 'Escape',
      shiftKey: true,
    });

    await waitFor(() => {
      expect(mockOnActivate).toHaveBeenCalledTimes(1);
    });
  });

  it('requires double confirmation when enabled', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={true}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
        requireDoubleConfirmation={true}
      />
    );

    // Open deactivation dialog
    const button = screen.getByRole('button', { name: /clear emergency stop/i });
    await userEvent.click(button);

    // Should show confirmation input
    expect(screen.getByPlaceholderText('Type CONFIRM CLEAR')).toBeInTheDocument();

    // Clear button should be disabled initially
    const clearButton = screen.getAllByRole('button', { name: /clear emergency stop/i })[1];
    expect(clearButton).toBeDisabled();

    // Type confirmation
    const input = screen.getByPlaceholderText('Type CONFIRM CLEAR');
    await userEvent.type(input, 'CONFIRM CLEAR');

    // Clear button should now be enabled
    expect(clearButton).not.toBeDisabled();

    // Click clear
    await userEvent.click(clearButton);
    expect(mockOnDeactivate).toHaveBeenCalledTimes(1);
  });

  it('cancels deactivation when dialog is closed', async () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={true}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    // Open deactivation dialog
    const button = screen.getByRole('button', { name: /clear emergency stop/i });
    await userEvent.click(button);

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnDeactivate).not.toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
      />
    );

    const button = screen.getByRole('button', { name: /activate emergency stop/i });
    expect(button).toHaveAttribute('aria-label', 'Activate emergency stop');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAttribute('aria-describedby', 'emergency-stop-description');

    // Check description exists
    expect(screen.getByText(/press ctrl\+shift\+space/i)).toBeInTheDocument();
  });

  it('renders in different sizes', () => {
    const { rerender } = renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={mockOnActivate}
        onDeactivate={mockOnDeactivate}
        size="small"
      />
    );

    let button = screen.getByRole('button', { name: /activate emergency stop/i });
    expect(button).toHaveStyle({ width: '120px', height: '80px' });

    rerender(
      <ThemeProvider theme={theme}>
        <EmergencyStopButton
          isActivated={false}
          onActivate={mockOnActivate}
          onDeactivate={mockOnDeactivate}
          size="medium"
        />
      </ThemeProvider>
    );

    button = screen.getByRole('button', { name: /activate emergency stop/i });
    expect(button).toHaveStyle({ width: '160px', height: '100px' });

    rerender(
      <ThemeProvider theme={theme}>
        <EmergencyStopButton
          isActivated={false}
          onActivate={mockOnActivate}
          onDeactivate={mockOnDeactivate}
          size="large"
        />
      </ThemeProvider>
    );

    button = screen.getByRole('button', { name: /activate emergency stop/i });
    expect(button).toHaveStyle({ width: '200px', height: '120px' });
  });

  it('handles async operations correctly', async () => {
    const asyncOnActivate = jest.fn().mockResolvedValue(undefined);
    const asyncOnDeactivate = jest.fn().mockResolvedValue(undefined);

    renderWithTheme(
      <EmergencyStopButton
        isActivated={false}
        onActivate={asyncOnActivate}
        onDeactivate={asyncOnDeactivate}
      />
    );

    const button = screen.getByRole('button', { name: /activate emergency stop/i });
    await userEvent.click(button);

    await waitFor(() => {
      expect(asyncOnActivate).toHaveBeenCalledTimes(1);
    });
  });
});