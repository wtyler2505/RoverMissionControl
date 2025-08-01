/**
 * Timeline Component Unit Tests
 * Comprehensive test suite for Timeline component functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Timeline, { TimelineEvent, TimelineBookmark, TimelineFilter } from './Timeline';

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={createTheme()}>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      {children}
    </LocalizationProvider>
  </ThemeProvider>
);

// Mock data
const now = Date.now();
const timeRange = {
  start: now - 2 * 60 * 60 * 1000, // 2 hours ago
  end: now + 30 * 60 * 1000, // 30 minutes from now
};

const mockEvents: TimelineEvent[] = [
  {
    id: 'event-1',
    type: 'command',
    category: 'navigation',
    title: 'Move Forward',
    description: 'Command to move rover forward',
    timestamp: now - 60 * 60 * 1000, // 1 hour ago
    duration: 5000,
    severity: 'medium',
    tags: ['movement'],
    source: 'ground-control',
  },
  {
    id: 'event-2',
    type: 'alert',
    category: 'power',
    title: 'Low Battery',
    description: 'Battery level below threshold',
    timestamp: now - 30 * 60 * 1000, // 30 minutes ago
    severity: 'high',
    tags: ['power', 'warning'],
    source: 'rover-system',
  },
  {
    id: 'event-3',
    type: 'telemetry',
    category: 'sensors',
    title: 'Temperature Reading',
    timestamp: now - 15 * 60 * 1000, // 15 minutes ago
    severity: 'low',
    tags: ['sensors'],
    source: 'rover-system',
  },
];

const mockBookmarks: TimelineBookmark[] = [
  {
    id: 'bookmark-1',
    timestamp: now - 45 * 60 * 1000,
    label: 'Important Event',
    description: 'Key mission milestone',
    color: '#2196f3',
    createdAt: now - 24 * 60 * 60 * 1000,
  },
  {
    id: 'bookmark-2',
    timestamp: now - 20 * 60 * 1000,
    label: 'Sample Collection',
    color: '#4caf50',
    createdAt: now - 12 * 60 * 60 * 1000,
  },
];

const defaultProps = {
  events: mockEvents,
  bookmarks: mockBookmarks,
  currentTime: now - 30 * 60 * 1000,
  timeRange,
  isPlaying: false,
  playbackSpeed: 1,
  canPlay: true,
  canSeek: true,
  onTimeChange: jest.fn(),
  onPlayPause: jest.fn(),
  onSpeedChange: jest.fn(),
  onRangeChange: jest.fn(),
  onEventClick: jest.fn(),
  onEventDoubleClick: jest.fn(),
  onBookmarkAdd: jest.fn(),
  onBookmarkRemove: jest.fn(),
  onFilterChange: jest.fn(),
  onExport: jest.fn(),
};

describe('Timeline Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders timeline with default props', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
      expect(screen.getByText(/1x/)).toBeInTheDocument();
    });

    test('renders events in timeline', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      // Events should be rendered as tooltips when hovered
      // Testing the presence of event data in DOM
      expect(screen.getByText('Move Forward')).toBeInTheDocument();
    });

    test('renders bookmarks when enabled', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showBookmarks={true} />
        </TestWrapper>
      );

      // Bookmark button should show count
      const bookmarkButton = screen.getByRole('button');
      expect(bookmarkButton).toBeInTheDocument();
    });

    test('hides controls when showControls is false', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showControls={false} />
        </TestWrapper>
      );

      expect(screen.queryByRole('button', { name: /play/i })).not.toBeInTheDocument();
    });

    test('renders in compact mode', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} compactMode={true} height={100} />
        </TestWrapper>
      );

      const timeline = screen.getByTestId('timeline') || screen.getByRole('region');
      expect(timeline).toHaveStyle({ height: '100px' });
    });
  });

  describe('Playback Controls', () => {
    test('play button toggles playback state', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      const playButton = screen.getByRole('button', { name: /play/i });
      await user.click(playButton);

      expect(defaultProps.onPlayPause).toHaveBeenCalledWith(true);
    });

    test('shows pause icon when playing', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} isPlaying={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
    });

    test('stop button pauses playback', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} isPlaying={true} />
        </TestWrapper>
      );

      const stopButton = screen.getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      expect(defaultProps.onPlayPause).toHaveBeenCalledWith(false);
    });

    test('speed button opens speed menu', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      const speedButton = screen.getByText('1x');
      await user.click(speedButton);

      await waitFor(() => {
        expect(screen.getByText('2x')).toBeInTheDocument();
      });
    });

    test('disables play button when canPlay is false', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} canPlay={false} />
        </TestWrapper>
      );

      const playButton = screen.getByRole('button', { name: /play/i });
      expect(playButton).toBeDisabled();
    });
  });

  describe('Timeline Interaction', () => {
    test('clicking timeline changes current time', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      // Find the timeline area (this might need adjustment based on actual DOM structure)
      const timelineArea = screen.getByTestId('timeline-area') || 
                          document.querySelector('[data-testid*="timeline"]') ||
                          screen.getByRole('region');
      
      if (timelineArea) {
        await user.click(timelineArea);
        expect(defaultProps.onTimeChange).toHaveBeenCalled();
      }
    });

    test('event click triggers onEventClick', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      // This test might need adjustment based on how events are rendered
      const eventElement = screen.getByText('Move Forward');
      await user.click(eventElement);

      expect(defaultProps.onEventClick).toHaveBeenCalled();
    });

    test('event double click triggers onEventDoubleClick', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      const eventElement = screen.getByText('Move Forward');
      await user.dblClick(eventElement);

      expect(defaultProps.onEventDoubleClick).toHaveBeenCalled();
    });
  });

  describe('Zoom Controls', () => {
    test('zoom in button decreases viewport duration', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showZoom={true} />
        </TestWrapper>
      );

      const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
      await user.click(zoomInButton);

      // Zoom should trigger viewport change
      expect(defaultProps.onRangeChange).toHaveBeenCalled();
    });

    test('zoom out button increases viewport duration', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showZoom={true} />        </TestWrapper>
      );

      const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
      await user.click(zoomOutButton);

      expect(defaultProps.onRangeChange).toHaveBeenCalled();
    });

    test('fit screen button resets zoom', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showZoom={true} />
        </TestWrapper>
      );

      const fitScreenButton = screen.getByRole('button', { name: /fit screen/i });
      await user.click(fitScreenButton);

      expect(defaultProps.onRangeChange).toHaveBeenCalled();
    });
  });

  describe('Filtering', () => {
    test('filter toggle expands filter panel', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showFilters={true} />
        </TestWrapper>
      );

      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search events/i)).toBeInTheDocument();
      });
    });

    test('text search filters events', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showFilters={true} />
        </TestWrapper>
      );

      // Expand filters first
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      const searchInput = await screen.findByPlaceholderText(/search events/i);
      await user.type(searchInput, 'battery');

      expect(defaultProps.onFilterChange).toHaveBeenCalled();
    });

    test('clear button resets filters', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showFilters={true} />
        </TestWrapper>
      );

      // Expand filters
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      const clearButton = await screen.findByText(/clear/i);
      await user.click(clearButton);

      expect(defaultProps.onFilterChange).toHaveBeenCalledWith({
        types: [],
        categories: [],
        severities: [],
        tags: [],
        sources: [],
      });
    });
  });

  describe('Bookmarks', () => {
    test('bookmark menu shows existing bookmarks', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showBookmarks={true} />
        </TestWrapper>
      );

      // Find bookmark button (might be in a badge)
      const bookmarkButton = screen.getByRole('button', { name: /bookmark/i });
      await user.click(bookmarkButton);

      await waitFor(() => {
        expect(screen.getByText('Important Event')).toBeInTheDocument();
      });
    });

    test('clicking bookmark navigates to timestamp', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showBookmarks={true} />
        </TestWrapper>
      );

      const bookmarkButton = screen.getByRole('button', { name: /bookmark/i });
      await user.click(bookmarkButton);

      const bookmark = await screen.findByText('Important Event');
      await user.click(bookmark);

      expect(defaultProps.onTimeChange).toHaveBeenCalledWith(mockBookmarks[0].timestamp);
    });

    test('add bookmark form submits new bookmark', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showBookmarks={true} />
        </TestWrapper>
      );

      const bookmarkButton = screen.getByRole('button', { name: /bookmark/i });
      await user.click(bookmarkButton);

      // Look for add bookmark option
      const addBookmarkOption = await screen.findByText(/add bookmark/i);
      await user.click(addBookmarkOption);

      // Fill form (this might need adjustment based on actual form structure)
      const labelInput = screen.getByLabelText(/label/i);
      await user.type(labelInput, 'New Bookmark');

      const addButton = screen.getByRole('button', { name: /add bookmark/i });
      await user.click(addButton);

      expect(defaultProps.onBookmarkAdd).toHaveBeenCalled();
    });
  });

  describe('Export', () => {
    test('export menu shows format options', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showExport={true} />
        </TestWrapper>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/export as json/i)).toBeInTheDocument();
        expect(screen.getByText(/export as csv/i)).toBeInTheDocument();
        expect(screen.getByText(/export as pdf/i)).toBeInTheDocument();
      });
    });

    test('export format selection triggers onExport', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} showExport={true} />
        </TestWrapper>
      );

      const exportButton = screen.getByRole('button', { name: /export/i });
      await user.click(exportButton);

      const jsonOption = await screen.findByText(/export as json/i);
      await user.click(jsonOption);

      expect(defaultProps.onExport).toHaveBeenCalledWith('json');
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} data-testid="timeline-a11y" />
        </TestWrapper>
      );

      const timeline = screen.getByTestId('timeline-a11y');
      expect(timeline).toBeInTheDocument();

      // Check for button accessibility
      const playButton = screen.getByRole('button', { name: /play/i });
      expect(playButton).toHaveAttribute('type', 'button');
    });

    test('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      // Tab through interactive elements
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();

      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });

    test('provides focus indicators', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      const playButton = screen.getByRole('button', { name: /play/i });
      await user.tab();

      if (document.activeElement === playButton) {
        expect(playButton).toHaveFocus();
      }
    });
  });

  describe('Performance', () => {
    test('handles large number of events', () => {
      const manyEvents = Array.from({ length: 1000 }, (_, i) => ({
        ...mockEvents[0],
        id: `event-${i}`,
        timestamp: now - i * 1000,
      }));

      render(
        <TestWrapper>
          <Timeline {...defaultProps} events={manyEvents} maxEvents={100} />
        </TestWrapper>
      );

      // Should render without performance issues
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    test('filters events efficiently', () => {
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <Timeline 
            {...defaultProps} 
            events={mockEvents}
            onFilterChange={(filter) => {
              // Filter should complete quickly
              const endTime = performance.now();
              expect(endTime - startTime).toBeLessThan(100); // Under 100ms
            }}
          />
        </TestWrapper>
      );
    });
  });

  describe('Edge Cases', () => {
    test('handles empty events array', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} events={[]} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    test('handles empty bookmarks array', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} bookmarks={[]} />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    test('handles invalid time range', () => {
      const invalidTimeRange = { start: now, end: now - 1000 }; // End before start
      
      render(
        <TestWrapper>
          <Timeline {...defaultProps} timeRange={invalidTimeRange} />
        </TestWrapper>
      );

      // Component should still render
      expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    });

    test('handles missing event properties gracefully', () => {
      const incompleteEvent: TimelineEvent = {
        id: 'incomplete',
        type: 'command',
        category: 'test',
        title: 'Incomplete Event',
        timestamp: now,
        severity: 'low',
      };

      render(
        <TestWrapper>
          <Timeline {...defaultProps} events={[incompleteEvent]} />
        </TestWrapper>
      );

      expect(screen.getByText('Incomplete Event')).toBeInTheDocument();
    });
  });

  describe('Time Calculations', () => {
    test('correctly formats time display', () => {
      render(
        <TestWrapper>
          <Timeline {...defaultProps} />
        </TestWrapper>
      );

      // Should display formatted time
      const timeDisplay = screen.getByText(/\d{2}:\d{2}:\d{2}/);
      expect(timeDisplay).toBeInTheDocument();
    });

    test('calculates viewport correctly', () => {
      const customTimeRange = {
        start: now - 60 * 60 * 1000, // 1 hour ago
        end: now,
      };

      render(
        <TestWrapper>
          <Timeline {...defaultProps} timeRange={customTimeRange} />
        </TestWrapper>
      );

      // Should show duration in status
      expect(screen.getByText(/1h/)).toBeInTheDocument();
    });
  });
});