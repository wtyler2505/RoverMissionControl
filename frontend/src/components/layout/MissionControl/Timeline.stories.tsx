/**
 * Timeline Storybook Stories
 * Interactive documentation and testing for Timeline component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { within, userEvent, expect } from '@storybook/test';
import { Box, ThemeProvider, createTheme } from '@mui/material';
import Timeline, { TimelineEvent, TimelineBookmark, TimelineFilter } from './Timeline';

// Generate sample events
const generateSampleEvents = (count: number, timeRange: { start: number; end: number }): TimelineEvent[] => {
  const events: TimelineEvent[] = [];
  const eventTypes = ['command', 'telemetry', 'alert', 'milestone', 'user', 'system'] as const;
  const categories = ['navigation', 'communication', 'sensors', 'power', 'thermal', 'imaging'];
  const severities = ['low', 'medium', 'high', 'critical'] as const;
  
  for (let i = 0; i < count; i++) {
    const timestamp = timeRange.start + Math.random() * (timeRange.end - timeRange.start);
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    
    events.push({
      id: `event-${i}`,
      type,
      category,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Event ${i + 1}`,
      description: `Sample ${type} event in ${category} category`,
      timestamp,
      duration: type === 'command' ? 1000 + Math.random() * 5000 : undefined,
      severity,
      tags: [`tag-${Math.floor(Math.random() * 3) + 1}`],
      source: `source-${Math.floor(Math.random() * 3) + 1}`,
    });
  }
  
  return events.sort((a, b) => a.timestamp - b.timestamp);
};

const generateSampleBookmarks = (count: number, timeRange: { start: number; end: number }): TimelineBookmark[] => {
  const bookmarks: TimelineBookmark[] = [];
  const colors = ['#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#f44336'];
  
  for (let i = 0; i < count; i++) {
    const timestamp = timeRange.start + Math.random() * (timeRange.end - timeRange.start);
    bookmarks.push({
      id: `bookmark-${i}`,
      timestamp,
      label: `Bookmark ${i + 1}`,
      description: `Sample bookmark ${i + 1}`,
      color: colors[Math.floor(Math.random() * colors.length)],
      createdAt: Date.now() - Math.random() * 86400000,
    });
  }
  
  return bookmarks.sort((a, b) => a.timestamp - b.timestamp);
};

const now = Date.now();
const timeRange = {
  start: now - 2 * 60 * 60 * 1000, // 2 hours ago
  end: now + 30 * 60 * 1000, // 30 minutes from now
};

const sampleEvents = generateSampleEvents(50, timeRange);
const sampleBookmarks = generateSampleBookmarks(5, timeRange);

const meta: Meta<typeof Timeline> = {
  title: 'Mission Control/Timeline',
  component: Timeline,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive timeline scrubber for mission events and data playback with filtering, bookmarks, and export capabilities.',
      },
    },
  },
  argTypes: {
    events: {
      description: 'Array of timeline events to display',
      control: { type: 'object' },
    },
    bookmarks: {
      description: 'Array of bookmarks for quick navigation',
      control: { type: 'object' },
    },
    currentTime: {
      description: 'Current playback time (timestamp)',
      control: { type: 'number' },
    },
    timeRange: {
      description: 'Visible time range',
      control: { type: 'object' },
    },
    isPlaying: {
      description: 'Whether timeline is in playback mode',
      control: { type: 'boolean' },
    },
    playbackSpeed: {
      description: 'Playback speed multiplier',
      control: { type: 'number', min: 0.1, max: 16, step: 0.1 },
    },
    showControls: {
      description: 'Show playback and navigation controls',
      control: { type: 'boolean' },
    },
    showBookmarks: {
      description: 'Show bookmark functionality',
      control: { type: 'boolean' },
    },
    showFilters: {
      description: 'Show event filtering options',
      control: { type: 'boolean' },
    },
    showExport: {
      description: 'Show export functionality',
      control: { type: 'boolean' },
    },
    compactMode: {
      description: 'Use compact display mode',
      control: { type: 'boolean' },
    },
    height: {
      description: 'Timeline height',
      control: { type: 'number', min: 100, max: 500, step: 10 },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={createTheme()}>
        <Box sx={{ p: 2, backgroundColor: 'background.default', minHeight: '100vh' }}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Timeline>;

// Default story
export const Default: Story = {
  args: {
    events: sampleEvents.slice(0, 20),
    bookmarks: sampleBookmarks.slice(0, 3),
    currentTime: now - 30 * 60 * 1000,
    timeRange,
    isPlaying: false,
    playbackSpeed: 1,
    showControls: true,
    showBookmarks: true,
    showFilters: true,
    showExport: true,
    showZoom: true,
    compactMode: false,
    height: 250,
    canPlay: true,
    canSeek: true,
    onTimeChange: action('onTimeChange'),
    onPlayPause: action('onPlayPause'),
    onSpeedChange: action('onSpeedChange'),
    onRangeChange: action('onRangeChange'),
    onEventClick: action('onEventClick'),
    onEventDoubleClick: action('onEventDoubleClick'),
    onBookmarkAdd: action('onBookmarkAdd'),
    onBookmarkRemove: action('onBookmarkRemove'),
    onFilterChange: action('onFilterChange'),
    onExport: action('onExport'),
  },
};

// Playing state
export const Playing: Story = {
  args: {
    ...Default.args,
    isPlaying: true,
    playbackSpeed: 2,
  },
};

// Compact mode
export const CompactMode: Story = {
  args: {
    ...Default.args,
    compactMode: true,
    height: 150,
    showControls: true,
    showFilters: false,
  },
};

// Many events
export const ManyEvents: Story = {
  args: {
    ...Default.args,
    events: sampleEvents,
    height: 300,
  },
};

// Real-time mode
export const RealTimeMode: Story = {
  args: {
    ...Default.args,
    events: sampleEvents.filter(e => e.timestamp <= now),
    currentTime: now,
    timeRange: {
      start: now - 60 * 60 * 1000, // 1 hour ago
      end: now + 5 * 60 * 1000, // 5 minutes from now
    },
    isPlaying: true,
    canSeek: false,
  },
};

// Historical data
export const HistoricalData: Story = {
  args: {
    ...Default.args,
    events: generateSampleEvents(30, {
      start: now - 24 * 60 * 60 * 1000, // 24 hours ago
      end: now - 12 * 60 * 60 * 1000, // 12 hours ago
    }),
    bookmarks: generateSampleBookmarks(8, {
      start: now - 24 * 60 * 60 * 1000,
      end: now - 12 * 60 * 60 * 1000,
    }),
    currentTime: now - 18 * 60 * 60 * 1000,
    timeRange: {
      start: now - 24 * 60 * 60 * 1000,
      end: now - 12 * 60 * 60 * 1000,
    },
    canPlay: true,
    canSeek: true,
  },
};

// Critical events only
export const CriticalEvents: Story = {
  args: {
    ...Default.args,
    events: sampleEvents.map(event => ({
      ...event,
      severity: Math.random() > 0.7 ? 'critical' : 'high',
    })),
    height: 200,
  },
};

// No events
export const NoEvents: Story = {
  args: {
    ...Default.args,
    events: [],
    bookmarks: [],
  },
};

// Minimal UI
export const MinimalUI: Story = {
  args: {
    ...Default.args,
    showControls: false,
    showBookmarks: false,
    showFilters: false,
    showExport: false,
    showZoom: false,
    height: 100,
    events: sampleEvents.slice(0, 10),
  },
};

// Large timeline
export const LargeTimeline: Story = {
  args: {
    ...Default.args,
    height: 400,
    events: sampleEvents,
    bookmarks: sampleBookmarks,
  },
};

// Event interaction tests
export const EventInteractions: Story = {
  args: {
    ...Default.args,
    events: [
      {
        id: 'test-command',
        type: 'command',
        category: 'navigation',
        title: 'Move Forward',
        description: 'Command to move rover forward 5 meters',
        timestamp: now - 45 * 60 * 1000,
        duration: 3000,
        severity: 'medium',
        tags: ['movement', 'navigation'],
        source: 'ground-control',
      },
      {
        id: 'test-alert',
        type: 'alert',
        category: 'power',
        title: 'Low Battery Warning',
        description: 'Battery level dropped below 20%',
        timestamp: now - 30 * 60 * 1000,
        severity: 'high',
        tags: ['power', 'warning'],
        source: 'rover-system',
      },
      {
        id: 'test-milestone',
        type: 'milestone',
        category: 'mission',
        title: 'Sample Collection Complete',
        description: 'Successfully collected geological sample #5',
        timestamp: now - 15 * 60 * 1000,
        severity: 'low',
        tags: ['science', 'samples'],
        source: 'science-team',
      },
    ],
    height: 200,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test timeline interaction
    const timeline = canvas.getByTestId('timeline');
    expect(timeline).toBeInTheDocument();
    
    // Test play/pause button
    const playButton = canvas.getByRole('button', { name: /play/i });
    await userEvent.click(playButton);
    
    // Test filter toggle
    const filterButton = canvas.getByRole('button', { name: /filter/i });
    await userEvent.click(filterButton);
  },
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    ...Default.args,
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <Box sx={{ p: 2, backgroundColor: 'background.default', minHeight: '100vh' }}>
          <Story />
        </Box>
      </ThemeProvider>
    ),
  ],
};

// Accessibility test
export const AccessibilityTest: Story = {
  args: {
    ...Default.args,
    'data-testid': 'timeline-accessibility',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test keyboard navigation
    const timeline = canvas.getByTestId('timeline-accessibility');
    expect(timeline).toBeInTheDocument();
    
    // Test ARIA labels and roles
    const playButton = canvas.getByRole('button');
    expect(playButton).toBeInTheDocument();
    
    // Test focus management
    await userEvent.tab();
    expect(document.activeElement).toBeInTheDocument();
  },
};

// Performance test with many events
export const PerformanceTest: Story = {
  args: {
    ...Default.args,
    events: generateSampleEvents(1000, {
      start: now - 24 * 60 * 60 * 1000,
      end: now,
    }),
    maxEvents: 100, // Limit for performance
    height: 300,
  },
};

// Export functionality
export const ExportFeatures: Story = {
  args: {
    ...Default.args,
    showExport: true,
    onExport: action('onExport'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test export menu
    const exportButton = canvas.getByRole('button', { name: /export/i });
    if (exportButton) {
      await userEvent.click(exportButton);
    }
  },
};

// Filter functionality
export const FilterFeatures: Story = {
  args: {
    ...Default.args,
    showFilters: true,
    onFilterChange: action('onFilterChange'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test filter expansion
    const filterButton = canvas.getByRole('button', { name: /filter/i });
    await userEvent.click(filterButton);
  },
};