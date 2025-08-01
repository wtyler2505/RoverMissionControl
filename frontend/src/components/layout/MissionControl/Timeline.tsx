/**
 * Timeline Component for Mission Control
 * Interactive timeline scrubber for mission events and data playback
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Slider,
  Typography,
  Stack,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Chip,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  ToggleButton,
  ToggleButtonGroup,
  ButtonGroup,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Zoom,
  Fade,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  FastForward,
  FastRewind,
  AccessTime,
  Timeline as TimelineIcon,
  Bookmark,
  BookmarkBorder,
  Flag,
  FilterList,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Loop,
  Speed,
  Sync,
  SyncDisabled,
  Refresh,
  Settings,
  Download,
  Upload,
  History,
  Schedule,
  Today,
  Event,
  Warning,
  Error,
  Info,
  CheckCircle,
  RadioButtonUnchecked,
  Visibility,
  VisibilityOff,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatDistanceToNow, isValid } from 'date-fns';

// Types and interfaces
export interface TimelineEvent {
  id: string;
  type: 'command' | 'telemetry' | 'alert' | 'milestone' | 'user' | 'system';
  category: string;
  title: string;
  description?: string;
  timestamp: number;
  duration?: number; // For events with duration
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: Record<string, any>;
  tags?: string[];
  source?: string;
  userId?: string;
  relatedEvents?: string[];
}

export interface TimelineBookmark {
  id: string;
  timestamp: number;
  label: string;
  description?: string;
  color?: string;
  userId?: string;
  createdAt: number;
}

export interface TimelineRange {
  start: number;
  end: number;
}

export interface TimelineFilter {
  types: string[];
  categories: string[];
  severities: string[];
  tags: string[];
  sources: string[];
  dateRange?: TimelineRange;
  textSearch?: string;
}

export interface TimelineProps {
  // Core timeline data
  events: TimelineEvent[];
  bookmarks?: TimelineBookmark[];
  currentTime: number;
  timeRange: TimelineRange;
  
  // Playback controls
  isPlaying?: boolean;
  playbackSpeed?: number;
  canPlay?: boolean;
  canSeek?: boolean;
  
  // Display options
  showControls?: boolean;
  showBookmarks?: boolean;
  showFilters?: boolean;
  showExport?: boolean;
  showZoom?: boolean;
  compactMode?: boolean;
  height?: number | string;
  
  // Event handlers
  onTimeChange?: (timestamp: number) => void;
  onPlayPause?: (playing: boolean) => void;
  onSpeedChange?: (speed: number) => void;
  onRangeChange?: (range: TimelineRange) => void;
  onEventClick?: (event: TimelineEvent) => void;
  onEventDoubleClick?: (event: TimelineEvent) => void;
  onBookmarkAdd?: (bookmark: Omit<TimelineBookmark, 'id' | 'createdAt'>) => void;
  onBookmarkRemove?: (bookmarkId: string) => void;
  onFilterChange?: (filter: TimelineFilter) => void;
  onExport?: (format: 'json' | 'csv' | 'pdf') => void;
  
  // Configuration
  zoomLevels?: number[];
  playbackSpeeds?: number[];
  maxEvents?: number;
  className?: string;
  'data-testid'?: string;
}

const DEFAULT_PLAYBACK_SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16];
const DEFAULT_ZOOM_LEVELS = [1, 2, 4, 8, 16, 32, 64, 128];

const EVENT_TYPE_COLORS = {
  command: '#2196f3',
  telemetry: '#4caf50',
  alert: '#ff9800',
  milestone: '#9c27b0',
  user: '#00bcd4',
  system: '#607d8b',
};

const SEVERITY_COLORS = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
  critical: '#d32f2f',
};

export const Timeline: React.FC<TimelineProps> = ({
  events = [],
  bookmarks = [],
  currentTime,
  timeRange,
  isPlaying = false,
  playbackSpeed = 1,
  canPlay = true,
  canSeek = true,
  showControls = true,
  showBookmarks = true,
  showFilters = true,
  showExport = true,
  showZoom = true,
  compactMode = false,
  height = 200,
  onTimeChange,
  onPlayPause,
  onSpeedChange,
  onRangeChange,
  onEventClick,
  onEventDoubleClick,
  onBookmarkAdd,
  onBookmarkRemove,
  onFilterChange,
  onExport,
  zoomLevels = DEFAULT_ZOOM_LEVELS,
  playbackSpeeds = DEFAULT_PLAYBACK_SPEEDS,
  maxEvents = 10000,
  className,
  'data-testid': testId,
}) => {
  const theme = useTheme();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [bookmarkMenuAnchor, setBookmarkMenuAnchor] = useState<HTMLElement | null>(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<HTMLElement | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<HTMLElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  
  // Timeline state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewportStart, setViewportStart] = useState(timeRange.start);
  const [viewportEnd, setViewportEnd] = useState(timeRange.end);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  
  // Filter state
  const [filter, setFilter] = useState<TimelineFilter>({
    types: [],
    categories: [],
    severities: [],
    tags: [],
    sources: [],
  });
  
  // Bookmark form state
  const [bookmarkForm, setBookmarkForm] = useState({
    label: '',
    description: '',
    color: '#2196f3',
  });

  // Calculate viewport duration
  const viewportDuration = viewportEnd - viewportStart;
  
  // Filter events based on current filter and viewport
  const filteredEvents = useMemo(() => {
    let filtered = events.filter(event => {
      // Time range filter
      if (event.timestamp < viewportStart || event.timestamp > viewportEnd) {
        return false;
      }
      
      // Type filter
      if (filter.types.length > 0 && !filter.types.includes(event.type)) {
        return false;
      }
      
      // Category filter
      if (filter.categories.length > 0 && !filter.categories.includes(event.category)) {
        return false;
      }
      
      // Severity filter
      if (filter.severities.length > 0 && !filter.severities.includes(event.severity)) {
        return false;
      }
      
      // Tags filter
      if (filter.tags.length > 0 && event.tags) {
        const hasMatchingTag = filter.tags.some(tag => event.tags!.includes(tag));
        if (!hasMatchingTag) return false;
      }
      
      // Source filter
      if (filter.sources.length > 0 && event.source && !filter.sources.includes(event.source)) {
        return false;
      }
      
      // Text search
      if (filter.textSearch) {
        const searchLower = filter.textSearch.toLowerCase();
        const matchesTitle = event.title.toLowerCase().includes(searchLower);
        const matchesDescription = event.description?.toLowerCase().includes(searchLower);
        const matchesCategory = event.category.toLowerCase().includes(searchLower);
        
        if (!matchesTitle && !matchesDescription && !matchesCategory) {
          return false;
        }
      }
      
      return true;
    });

    // Limit events for performance
    if (filtered.length > maxEvents) {
      filtered = filtered.slice(0, maxEvents);
    }
    
    return filtered;
  }, [events, viewportStart, viewportEnd, filter, maxEvents]);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const types = [...new Set(events.map(e => e.type))];
    const categories = [...new Set(events.map(e => e.category))];
    const severities = [...new Set(events.map(e => e.severity))];
    const tags = [...new Set(events.flatMap(e => e.tags || []))];
    const sources = [...new Set(events.map(e => e.source).filter(Boolean))];
    
    return { types, categories, severities, tags, sources };
  }, [events]);

  // Convert timestamp to pixel position
  const timeToPixel = useCallback((timestamp: number) => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.clientWidth;
    const progress = (timestamp - viewportStart) / viewportDuration;
    return progress * width;
  }, [viewportStart, viewportDuration]);

  // Convert pixel position to timestamp
  const pixelToTime = useCallback((pixel: number) => {
    if (!timelineRef.current) return viewportStart;
    const width = timelineRef.current.clientWidth;
    const progress = pixel / width;
    return viewportStart + (progress * viewportDuration);
  }, [viewportStart, viewportDuration]);

  // Handle timeline click for seeking
  const handleTimelineClick = useCallback((event: React.MouseEvent) => {
    if (!canSeek || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const timestamp = pixelToTime(x);
    
    onTimeChange?.(timestamp);
  }, [canSeek, pixelToTime, onTimeChange]);

  // Handle timeline drag for panning
  const handleTimelineDrag = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStartX;
    const deltaTime = (deltaX / timelineRef.current!.clientWidth) * -viewportDuration;
    const newStart = Math.max(timeRange.start, dragStartTime + deltaTime);
    const newEnd = Math.min(timeRange.end, newStart + viewportDuration);
    
    setViewportStart(newStart);
    setViewportEnd(newEnd);
  }, [isDragging, dragStartX, dragStartTime, viewportDuration, timeRange]);

  // Handle zoom
  const handleZoom = useCallback((direction: 'in' | 'out', centerTime?: number) => {
    const factor = direction === 'in' ? 0.5 : 2;
    const newDuration = Math.min(Math.max(viewportDuration * factor, 1000), timeRange.end - timeRange.start);
    const center = centerTime || currentTime;
    
    const newStart = Math.max(timeRange.start, center - newDuration / 2);
    const newEnd = Math.min(timeRange.end, newStart + newDuration);
    
    setViewportStart(newStart);
    setViewportEnd(newEnd);
    
    const newZoomLevel = (timeRange.end - timeRange.start) / newDuration;
    setZoomLevel(newZoomLevel);
  }, [viewportDuration, timeRange, currentTime]);

  // Handle pan to keep current time in view
  const panToCurrentTime = useCallback(() => {
    const buffer = viewportDuration * 0.1; // 10% buffer
    
    if (currentTime < viewportStart + buffer) {
      const newStart = Math.max(timeRange.start, currentTime - buffer);
      const newEnd = newStart + viewportDuration;
      setViewportStart(newStart);
      setViewportEnd(newEnd);
    } else if (currentTime > viewportEnd - buffer) {
      const newEnd = Math.min(timeRange.end, currentTime + buffer);
      const newStart = newEnd - viewportDuration;
      setViewportStart(newStart);
      setViewportEnd(newEnd);
    }
  }, [currentTime, viewportStart, viewportEnd, viewportDuration, timeRange]);

  // Auto-follow current time when playing
  useEffect(() => {
    if (isPlaying) {
      panToCurrentTime();
    }
  }, [isPlaying, currentTime, panToCurrentTime]);

  // Handle bookmark creation
  const handleAddBookmark = useCallback(() => {
    if (!onBookmarkAdd || !bookmarkForm.label) return;
    
    onBookmarkAdd({
      timestamp: currentTime,
      label: bookmarkForm.label,
      description: bookmarkForm.description,
      color: bookmarkForm.color,
    });
    
    setBookmarkForm({ label: '', description: '', color: '#2196f3' });
    setBookmarkMenuAnchor(null);
  }, [onBookmarkAdd, currentTime, bookmarkForm]);

  // Handle filter changes
  const handleFilterChange = useCallback((key: keyof TimelineFilter, value: any) => {
    const newFilter = { ...filter, [key]: value };
    setFilter(newFilter);
    onFilterChange?.(newFilter);
  }, [filter, onFilterChange]);

  // Format time for display
  const formatTime = useCallback((timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm:ss.SSS');
  }, []);

  const formatDuration = useCallback((ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper
        className={className}
        data-testid={testId}
        elevation={2}
        sx={{
          height,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {/* Header with controls */}
        {showControls && (
          <Box
            sx={{
              p: 1,
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              {/* Playback controls */}
              {canPlay && (
                <ButtonGroup size="small" variant="outlined">
                  <IconButton
                    onClick={() => onPlayPause?.(!isPlaying)}
                    color={isPlaying ? 'secondary' : 'primary'}
                  >
                    {isPlaying ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  <IconButton onClick={() => onPlayPause?.(false)}>
                    <Stop />
                  </IconButton>
                </ButtonGroup>
              )}

              {/* Speed control */}
              <Button
                size="small"
                variant="outlined"
                onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
                endIcon={<Speed />}
              >
                {playbackSpeed}x
              </Button>

              <Divider orientation="vertical" flexItem />

              {/* Zoom controls */}
              {showZoom && (
                <ButtonGroup size="small" variant="outlined">
                  <IconButton onClick={() => handleZoom('in')}>
                    <ZoomIn />
                  </IconButton>
                  <IconButton onClick={() => handleZoom('out')}>
                    <ZoomOut />
                  </IconButton>
                  <IconButton
                    onClick={() => {
                      setViewportStart(timeRange.start);
                      setViewportEnd(timeRange.end);
                      setZoomLevel(1);
                    }}
                  >
                    <FitScreen />
                  </IconButton>
                </ButtonGroup>
              )}

              <Divider orientation="vertical" flexItem />

              {/* Time display */}
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <AccessTime fontSize="small" />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', minWidth: 80 }}>
                  {formatTime(currentTime)}
                </Typography>
              </Stack>

              <Box sx={{ flexGrow: 1 }} />

              {/* Filter toggle */}
              {showFilters && (
                <IconButton
                  size="small"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  color={filtersExpanded ? 'primary' : 'default'}
                >
                  <FilterList />
                </IconButton>
              )}

              {/* Bookmark controls */}
              {showBookmarks && (
                <IconButton
                  size="small"
                  onClick={(e) => setBookmarkMenuAnchor(e.currentTarget)}
                >
                  <Badge badgeContent={bookmarks.length} color="primary">
                    <Bookmark />
                  </Badge>
                </IconButton>
              )}

              {/* Export */}
              {showExport && (
                <IconButton
                  size="small"
                  onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                >
                  <Download />
                </IconButton>
              )}

              {/* Settings */}
              <IconButton
                size="small"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings />
              </IconButton>
            </Stack>

            {/* Expandable filters */}
            <Collapse in={filtersExpanded}>
              <Box sx={{ mt: 1, p: 1, backgroundColor: 'background.default', borderRadius: 1 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small"
                      placeholder="Search events..."
                      value={filter.textSearch || ''}
                      onChange={(e) => handleFilterChange('textSearch', e.target.value)}
                      sx={{ width: 200 }}
                    />
                    
                    <FormControl size="small" sx={{ width: 120 }}>
                      <InputLabel>Type</InputLabel>
                      <Select
                        multiple
                        value={filter.types}
                        onChange={(e) => handleFilterChange('types', e.target.value)}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {filterOptions.types.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ width: 120 }}>
                      <InputLabel>Severity</InputLabel>
                      <Select
                        multiple
                        value={filter.severities}
                        onChange={(e) => handleFilterChange('severities', e.target.value)}
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {filterOptions.severities.map((severity) => (
                          <MenuItem key={severity} value={severity}>
                            {severity}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <Button
                      size="small"
                      onClick={() => {
                        const emptyFilter = {
                          types: [],
                          categories: [],
                          severities: [],
                          tags: [],
                          sources: [],
                        };
                        setFilter(emptyFilter);
                        onFilterChange?.(emptyFilter);
                      }}
                    >
                      Clear
                    </Button>
                  </Stack>

                  <Typography variant="caption" color="text.secondary">
                    Showing {filteredEvents.length} of {events.length} events
                  </Typography>
                </Stack>
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Main timeline area */}
        <Box
          sx={{
            position: 'relative',
            flexGrow: 1,
            backgroundColor: 'background.default',
            cursor: canSeek ? 'crosshair' : 'default',
          }}
          ref={timelineRef}
          onClick={handleTimelineClick}
          onMouseDown={(e) => {
            setIsDragging(true);
            setDragStartX(e.clientX);
            setDragStartTime(viewportStart);
          }}
          onMouseMove={handleTimelineDrag}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          {/* Timeline background with time markers */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `repeating-linear-gradient(
                90deg,
                ${alpha(theme.palette.divider, 0.3)} 0px,
                ${alpha(theme.palette.divider, 0.3)} 1px,
                transparent 1px,
                transparent 50px
              )`,
            }}
          />

          {/* Current time indicator */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: timeToPixel(currentTime),
              width: 2,
              backgroundColor: theme.palette.error.main,
              zIndex: 10,
              boxShadow: `0 0 4px ${alpha(theme.palette.error.main, 0.5)}`,
            }}
          />

          {/* Bookmarks */}
          {showBookmarks && bookmarks.map((bookmark) => (
            <Tooltip
              key={bookmark.id}
              title={`${bookmark.label} - ${formatTime(bookmark.timestamp)}`}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: timeToPixel(bookmark.timestamp),
                  width: 1,
                  backgroundColor: bookmark.color || theme.palette.primary.main,
                  zIndex: 5,
                  '&:hover': {
                    width: 3,
                  },
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onTimeChange?.(bookmark.timestamp);
                }}
              />
            </Tooltip>
          ))}

          {/* Events */}
          {filteredEvents.map((event) => {
            const x = timeToPixel(event.timestamp);
            const width = event.duration ? Math.max(2, timeToPixel(event.timestamp + event.duration) - x) : 2;
            const isHovered = hoveredEvent === event.id;
            const isSelected = selectedEvent?.id === event.id;
            
            return (
              <Tooltip
                key={event.id}
                title={
                  <Box>
                    <Typography variant="subtitle2">{event.title}</Typography>
                    <Typography variant="caption">
                      {event.category} • {formatTime(event.timestamp)}
                    </Typography>
                    {event.description && (
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {event.description}
                      </Typography>
                    )}
                  </Box>
                }
              >
                <Box
                  sx={{
                    position: 'absolute',
                    top: '20%',
                    height: '60%',
                    left: x,
                    width: Math.max(width, 8),
                    backgroundColor: EVENT_TYPE_COLORS[event.type] || theme.palette.grey[500],
                    borderRadius: 0.5,
                    cursor: 'pointer',
                    opacity: isHovered || isSelected ? 1 : 0.8,
                    transform: isHovered ? 'scaleY(1.2)' : 'scaleY(1)',
                    transition: 'all 0.2s ease',
                    zIndex: isSelected ? 8 : isHovered ? 7 : 6,
                    border: isSelected ? `2px solid ${theme.palette.primary.main}` : 'none',
                    '&:hover': {
                      transform: 'scaleY(1.2)',
                      zIndex: 7,
                    },
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEvent(event);
                    onEventClick?.(event);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onEventDoubleClick?.(event);
                  }}
                  onMouseEnter={() => setHoveredEvent(event.id)}
                  onMouseLeave={() => setHoveredEvent(null)}
                />
              </Tooltip>
            );
          })}

          {/* Viewport range indicators */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 20,
              backgroundColor: alpha(theme.palette.background.paper, 0.8),
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {formatTime(viewportStart)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDuration(viewportDuration)} • {filteredEvents.length} events
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              {formatTime(viewportEnd)}
            </Typography>
          </Box>
        </Box>

        {/* Speed menu */}
        <Menu
          anchorEl={speedMenuAnchor}
          open={Boolean(speedMenuAnchor)}
          onClose={() => setSpeedMenuAnchor(null)}
        >
          {playbackSpeeds.map((speed) => (
            <MenuItem
              key={speed}
              selected={speed === playbackSpeed}
              onClick={() => {
                onSpeedChange?.(speed);
                setSpeedMenuAnchor(null);
              }}
            >
              {speed}x
            </MenuItem>
          ))}
        </Menu>

        {/* Bookmark menu */}
        <Menu
          anchorEl={bookmarkMenuAnchor}
          open={Boolean(bookmarkMenuAnchor)}
          onClose={() => setBookmarkMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              setBookmarkMenuAnchor(null);
              // Show add bookmark form
            }}
          >
            <ListItemIcon>
              <BookmarkBorder />
            </ListItemIcon>
            <ListItemText>Add Bookmark</ListItemText>
          </MenuItem>
          <Divider />
          {bookmarks.map((bookmark) => (
            <MenuItem
              key={bookmark.id}
              onClick={() => {
                onTimeChange?.(bookmark.timestamp);
                setBookmarkMenuAnchor(null);
              }}
            >
              <ListItemIcon>
                <Bookmark style={{ color: bookmark.color }} />
              </ListItemIcon>
              <ListItemText
                primary={bookmark.label}
                secondary={formatTime(bookmark.timestamp)}
              />
            </MenuItem>
          ))}
        </Menu>

        {/* Export menu */}
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
        >
          <MenuItem onClick={() => { onExport?.('json'); setExportMenuAnchor(null); }}>
            <ListItemText>Export as JSON</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { onExport?.('csv'); setExportMenuAnchor(null); }}>
            <ListItemText>Export as CSV</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { onExport?.('pdf'); setExportMenuAnchor(null); }}>
            <ListItemText>Export as PDF</ListItemText>
          </MenuItem>
        </Menu>
      </Paper>
    </LocalizationProvider>
  );
};

export default Timeline;