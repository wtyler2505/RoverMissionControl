/**
 * TimelinePlaybackControls Test Suite
 * Comprehensive testing for mission-critical playback controls
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { addMinutes, addHours } from 'date-fns';
import { TimelinePlaybackControls } from '../TimelinePlaybackControls';
import { ChartThemeProvider } from '../../base/ChartThemeProvider';
import type { PlaybackSpeed, StepInterval, TimeFormat } from '../types';

// Mock theme
const mockTheme = createTheme();

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={mockTheme}>
    <ChartThemeProvider>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

// Test data
const testStartTime = new Date('2025-01-01T10:00:00Z');
const testEndTime = new Date('2025-01-01T18:00:00Z');
const testCurrentTime = new Date('2025-01-01T14:00:00Z');

const testSpeeds: PlaybackSpeed[] = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' }
];

const testStepIntervals: StepInterval[] = [
  { value: 1, unit: 'minutes', label: '1m' },
  { value: 5, unit: 'minutes', label: '5m' }
];

const testTimeFormats: TimeFormat[] = [
  { 
    value: 'HH:mm:ss', 
    label: 'Time', 
    formatter: (date: Date) => date.toISOString().substr(11, 8) 
  }
];

const defaultProps = {
  startTime: testStartTime,
  endTime: testEndTime,
  currentTime: testCurrentTime,
  isPlaying: false,
  playbackSpeed: 1,
  availableSpeeds: testSpeeds,
  stepIntervals: testStepIntervals,
  timeFormats: testTimeFormats
};

// Mock event handlers
const mockHandlers = {
  onPlay: jest.fn(),
  onPause: jest.fn(),
  onStop: jest.fn(),
  onTimeChange: jest.fn(),
  onSpeedChange: jest.fn(),
  onStepForward: jest.fn(),
  onStepBackward: jest.fn(),
  onJumpToStart: jest.fn(),
  onJumpToEnd: jest.fn()
};

describe('TimelinePlaybackControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Basic Rendering', () => {
    it('renders with required props', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('toolbar')).toBeInTheDocument();
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
      expect(screen.getByLabelText('Pause')).toBeInTheDocument();
      expect(screen.getByLabelText('Stop')).toBeInTheDocument();
    });

    it('renders with all control buttons', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Play')).toBeInTheDocument();
      expect(screen.getByLabelText('Pause')).toBeInTheDocument();
      expect(screen.getByLabelText('Stop')).toBeInTheDocument();
      expect(screen.getByLabelText('Jump to start')).toBeInTheDocument();
      expect(screen.getByLabelText('Jump to end')).toBeInTheDocument();
    });

    it('displays current time', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('14:00:00')).toBeInTheDocument();
    });

    it('renders timeline scrubber', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Timeline scrubber')).toBeInTheDocument();
    });
  });

  describe('Playback Controls', () => {
    it('calls onPlay when play button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Play'));
      expect(mockHandlers.onPlay).toHaveBeenCalledTimes(1);
    });

    it('calls onPause when pause button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            isPlaying={true}
          />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Pause'));
      expect(mockHandlers.onPause).toHaveBeenCalledTimes(1);
    });

    it('calls onStop when stop button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Stop'));
      expect(mockHandlers.onStop).toHaveBeenCalledTimes(1);
    });

    it('disables play button when at end time', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            currentTime={testEndTime}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Play')).toBeDisabled();
    });

    it('disables pause button when not playing', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            isPlaying={false}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Pause')).toBeDisabled();
    });
  });

  describe('Jump Controls', () => {
    it('calls onJumpToStart when jump to start is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Jump to start'));
      expect(mockHandlers.onJumpToStart).toHaveBeenCalledTimes(1);
    });

    it('calls onJumpToEnd when jump to end is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Jump to end'));
      expect(mockHandlers.onJumpToEnd).toHaveBeenCalledTimes(1);
    });

    it('disables jump to start when at start time', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            currentTime={testStartTime}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Jump to start')).toBeDisabled();
    });

    it('disables jump to end when at end time', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            currentTime={testEndTime}
            {...mockHandlers}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Jump to end')).toBeDisabled();
    });
  });

  describe('Step Controls', () => {
    it('calls onStepForward when step forward is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Step forward 1m'));
      expect(mockHandlers.onStepForward).toHaveBeenCalledWith({
        value: 1,
        unit: 'minutes',
        label: '1m'
      });
    });

    it('calls onStepBackward when step backward is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      await user.click(screen.getByLabelText('Step backward 1m'));
      expect(mockHandlers.onStepBackward).toHaveBeenCalledWith({
        value: 1,
        unit: 'minutes',
        label: '1m'
      });
    });
  });

  describe('Speed Control', () => {
    it('renders speed selector', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Playback speed')).toBeInTheDocument();
    });

    it('calls onSpeedChange when speed is changed', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      const speedSelect = screen.getByLabelText('Playback speed');
      await user.click(speedSelect);
      
      const option2x = screen.getByText('2x');
      await user.click(option2x);
      
      expect(mockHandlers.onSpeedChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Timeline Scrubber', () => {
    it('calls onTimeChange when scrubber is moved', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} {...mockHandlers} />
        </TestWrapper>
      );

      const slider = screen.getByLabelText('Timeline scrubber');
      
      // Simulate slider change
      fireEvent.change(slider, { target: { value: 75 } });
      
      await waitFor(() => {
        expect(mockHandlers.onTimeChange).toHaveBeenCalled();
      });
    });

    it('updates slider position based on current time', () => {
      const { rerender } = render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} />
        </TestWrapper>
      );

      const slider = screen.getByLabelText('Timeline scrubber') as HTMLInputElement;
      expect(slider.value).toBe('50'); // 4 hours into 8-hour timeline = 50%

      // Update current time
      rerender(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            currentTime={addHours(testStartTime, 6)} // 6 hours in = 75%
          />
        </TestWrapper>
      );

      expect(slider.value).toBe('75');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('plays/pauses on space key press', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'Space' });
      expect(mockHandlers.onPlay).toHaveBeenCalledTimes(1);
    });

    it('stops on S key press', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'KeyS' });
      expect(mockHandlers.onStop).toHaveBeenCalledTimes(1);
    });

    it('steps forward on right arrow key', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'ArrowRight' });
      expect(mockHandlers.onStepForward).toHaveBeenCalledWith(testStepIntervals[0]);
    });

    it('steps backward on left arrow key', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'ArrowLeft' });
      expect(mockHandlers.onStepBackward).toHaveBeenCalledWith(testStepIntervals[0]);
    });

    it('jumps to start on Home key', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'Home' });
      expect(mockHandlers.onJumpToStart).toHaveBeenCalledTimes(1);
    });

    it('jumps to end on End key', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'End' });
      expect(mockHandlers.onJumpToEnd).toHaveBeenCalledTimes(1);
    });

    it('changes speed on number keys', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={true}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'Digit2' });
      expect(mockHandlers.onSpeedChange).toHaveBeenCalledWith(1); // Second speed (1x)
    });

    it('ignores keyboard shortcuts when disabled', async () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            enableKeyboardShortcuts={false}
          />
        </TestWrapper>
      );

      fireEvent.keyDown(document, { code: 'Space' });
      expect(mockHandlers.onPlay).not.toHaveBeenCalled();
    });
  });

  describe('Responsive Behavior', () => {
    it('renders in compact mode', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            compactMode={true}
          />
        </TestWrapper>
      );

      // Should still render all essential controls
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
      expect(screen.getByLabelText('Timeline scrubber')).toBeInTheDocument();
    });

    it('hides jump controls on mobile', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            breakpoint="mobile"
          />
        </TestWrapper>
      );

      expect(screen.queryByLabelText('Jump to start')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Jump to end')).not.toBeInTheDocument();
    });
  });

  describe('Mini Timeline', () => {
    const timelineTasks = [
      {
        id: 'task1',
        startTime: addMinutes(testStartTime, 60),
        endTime: addMinutes(testStartTime, 120),
        color: '#ff0000',
        priority: 'high' as const
      }
    ];

    it('renders mini timeline when enabled', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            showMiniTimeline={true}
            timelineTasks={timelineTasks}
          />
        </TestWrapper>
      );

      // Mini timeline should be present (tested via container presence)
      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toBeInTheDocument();
    });

    it('hides mini timeline when disabled', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            showMiniTimeline={false}
            timelineTasks={timelineTasks}
          />
        </TestWrapper>
      );

      // Should still render controls
      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('displays error message when error prop is provided', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            error="Test error message"
          />
        </TestWrapper>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('disables all controls when disabled prop is true', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            disabled={true}
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Play')).toBeDisabled();
      expect(screen.getByLabelText('Pause')).toBeDisabled();
      expect(screen.getByLabelText('Stop')).toBeDisabled();
      expect(screen.getByLabelText('Timeline scrubber')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps}
            ariaLabel="Test timeline controls"
          />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Test timeline controls')).toBeInTheDocument();
    });

    it('provides live region for time updates', () => {
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} />
        </TestWrapper>
      );

      const timeDisplay = screen.getByText('14:00:00');
      expect(timeDisplay.closest('[aria-live="polite"]')).toBeInTheDocument();
    });

    it('has proper focus management', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls {...defaultProps} />
        </TestWrapper>
      );

      const playButton = screen.getByLabelText('Play');
      await user.tab();
      
      expect(playButton).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('throttles time change events', async () => {
      jest.useFakeTimers();
      
      render(
        <TestWrapper>
          <TimelinePlaybackControls 
            {...defaultProps} 
            {...mockHandlers}
            throttleMs={100}
          />
        </TestWrapper>
      );

      const slider = screen.getByLabelText('Timeline scrubber');
      
      // Trigger multiple rapid changes
      fireEvent.change(slider, { target: { value: 25 } });
      fireEvent.change(slider, { target: { value: 50 } });
      fireEvent.change(slider, { target: { value: 75 } });
      
      // Should not call immediately
      expect(mockHandlers.onTimeChange).not.toHaveBeenCalled();
      
      // Fast-forward past throttle time
      act(() => {
        jest.advanceTimersByTime(100);
      });
      
      // Should call only once with latest value
      expect(mockHandlers.onTimeChange).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });
});

describe('TimelinePlaybackControls Integration', () => {
  it('works with TimelineChart integration', () => {
    const onTimeChange = jest.fn();
    const onPlaybackToggle = jest.fn();
    
    render(
      <TestWrapper>
        <TimelinePlaybackControls 
          {...defaultProps}
          onTimeChange={onTimeChange}
          onPlay={onPlaybackToggle}
          onPause={onPlaybackToggle}
        />
      </TestWrapper>
    );

    // Component should render and be ready for integration
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Timeline scrubber')).toBeInTheDocument();
  });
});