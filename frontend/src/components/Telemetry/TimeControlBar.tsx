import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Slider,
  Typography,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Chip,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  FastForward,
  FastRewind,
  AccessTime,
  DateRange,
  Timeline,
  Sync,
  SyncDisabled,
  Speed,
  Timer,
  Schedule,
  Today,
  History,
  Update,
  Bookmark,
  BookmarkBorder,
  Flag,
  FlagOutlined,
  Loop,
  LoopOutlined,
  ZoomIn,
  ZoomOut,
  FitScreen,
} from '@mui/icons-material';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMinutes, subHours, subDays, addMinutes } from 'date-fns';

interface TimeControlBarProps {
  globalTimeWindow: number; // milliseconds
  onTimeWindowChange: (window: number) => void;
  syncTime: boolean;
  onSyncTimeChange: (sync: boolean) => void;
  isPlaying: boolean;
  onPlayPauseChange: (playing: boolean) => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  currentTime: number; // timestamp
  onCurrentTimeChange: (time: number) => void;
  minTime?: number;
  maxTime?: number;
  showBookmarks?: boolean;
  showMarkers?: boolean;
  enableLoop?: boolean;
  onBookmark?: (time: number, label: string) => void;
  onMarker?: (time: number, label: string) => void;
  bookmarks?: Array<{ time: number; label: string; id: string }>;
  markers?: Array<{ time: number; label: string; id: string; color?: string }>;
}

interface TimeRange {
  start: number;
  end: number;
}

interface TimePreset {
  label: string;
  value: number; // milliseconds
  icon: React.ReactNode;
}

const timePresets: TimePreset[] = [
  { label: '30 seconds', value: 30000, icon: <Timer /> },
  { label: '1 minute', value: 60000, icon: <Timer /> },
  { label: '5 minutes', value: 300000, icon: <Schedule /> },
  { label: '15 minutes', value: 900000, icon: <Schedule /> },
  { label: '30 minutes', value: 1800000, icon: <Schedule /> },
  { label: '1 hour', value: 3600000, icon: <AccessTime /> },
  { label: '6 hours', value: 21600000, icon: <Today /> },
  { label: '24 hours', value: 86400000, icon: <DateRange /> },
];

const playbackSpeeds = [0.1, 0.25, 0.5, 1, 2, 4, 8, 16];

const TimeControlBar: React.FC<TimeControlBarProps> = ({
  globalTimeWindow,
  onTimeWindowChange,
  syncTime,
  onSyncTimeChange,
  isPlaying,
  onPlayPauseChange,
  playbackSpeed,
  onPlaybackSpeedChange,
  currentTime,
  onCurrentTimeChange,
  minTime,
  maxTime,
  showBookmarks = true,
  showMarkers = true,
  enableLoop = true,
  onBookmark,
  onMarker,
  bookmarks = [],
  markers = [],
}) => {
  const playbackIntervalRef = useRef<NodeJS.Timeout>();
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: currentTime - globalTimeWindow,
    end: currentTime,
  });
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopRange, setLoopRange] = useState<TimeRange | null>(null);
  const [presetMenuAnchor, setPresetMenuAnchor] = useState<null | HTMLElement>(null);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);
  const [bookmarkPopoverAnchor, setBookmarkPopoverAnchor] = useState<null | HTMLElement>(null);
  const [markerPopoverAnchor, setMarkerPopoverAnchor] = useState<null | HTMLElement>(null);
  const [customTimeDialogOpen, setCustomTimeDialogOpen] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [markerLabel, setMarkerLabel] = useState('');
  const [jumpToTime, setJumpToTime] = useState<Date | null>(new Date(currentTime));

  // Update time range when current time or window changes
  useEffect(() => {
    setTimeRange({
      start: currentTime - globalTimeWindow,
      end: currentTime,
    });
  }, [currentTime, globalTimeWindow]);

  // Handle playback
  useEffect(() => {
    if (isPlaying) {
      playbackIntervalRef.current = setInterval(() => {
        onCurrentTimeChange(prev => {
          const next = prev + (100 * playbackSpeed);
          
          // Handle loop
          if (loopEnabled && loopRange) {
            if (next > loopRange.end) {
              return loopRange.start;
            }
          }
          
          // Handle max time
          if (maxTime && next > maxTime) {
            onPlayPauseChange(false);
            return maxTime;
          }
          
          return next;
        });
      }, 100);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, loopEnabled, loopRange, maxTime, onCurrentTimeChange, onPlayPauseChange]);

  // Handle time window preset selection
  const handlePresetSelect = useCallback((preset: TimePreset) => {
    onTimeWindowChange(preset.value);
    setPresetMenuAnchor(null);
  }, [onTimeWindowChange]);

  // Handle custom time window
  const handleCustomTimeWindow = useCallback((start: Date, end: Date) => {
    const window = end.getTime() - start.getTime();
    if (window > 0) {
      onTimeWindowChange(window);
      onCurrentTimeChange(end.getTime());
    }
  }, [onTimeWindowChange, onCurrentTimeChange]);

  // Handle skip forward/backward
  const handleSkip = useCallback((direction: 'forward' | 'backward') => {
    const skipAmount = globalTimeWindow * 0.5; // Skip by half the window
    const newTime = direction === 'forward' 
      ? currentTime + skipAmount 
      : currentTime - skipAmount;
    
    // Clamp to bounds
    let clampedTime = newTime;
    if (minTime && clampedTime < minTime) clampedTime = minTime;
    if (maxTime && clampedTime > maxTime) clampedTime = maxTime;
    
    onCurrentTimeChange(clampedTime);
  }, [currentTime, globalTimeWindow, minTime, maxTime, onCurrentTimeChange]);

  // Handle zoom
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 0.5 : 2;
    const newWindow = globalTimeWindow * factor;
    
    // Clamp to reasonable bounds (100ms to 7 days)
    const clampedWindow = Math.max(100, Math.min(newWindow, 7 * 24 * 60 * 60 * 1000));
    onTimeWindowChange(clampedWindow);
  }, [globalTimeWindow, onTimeWindowChange]);

  // Add bookmark
  const handleAddBookmark = useCallback(() => {
    if (onBookmark && bookmarkLabel) {
      onBookmark(currentTime, bookmarkLabel);
      setBookmarkLabel('');
      setBookmarkPopoverAnchor(null);
    }
  }, [currentTime, bookmarkLabel, onBookmark]);

  // Add marker
  const handleAddMarker = useCallback(() => {
    if (onMarker && markerLabel) {
      onMarker(currentTime, markerLabel);
      setMarkerLabel('');
      setMarkerPopoverAnchor(null);
    }
  }, [currentTime, markerLabel, onMarker]);

  // Jump to bookmark or marker
  const handleJumpTo = useCallback((time: number) => {
    onCurrentTimeChange(time);
  }, [onCurrentTimeChange]);

  // Format time for display
  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm:ss.SSS');
  };

  const formatTimeWindow = (ms: number) => {
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(0)}s`;
    } else if (ms < 3600000) {
      return `${(ms / 60000).toFixed(0)}m`;
    } else if (ms < 86400000) {
      return `${(ms / 3600000).toFixed(1)}h`;
    } else {
      return `${(ms / 86400000).toFixed(1)}d`;
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack spacing={2}>
          {/* Main Controls Row */}
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Playback Controls */}
            <Stack direction="row" spacing={1}>
              <IconButton
                onClick={() => handleSkip('backward')}
                disabled={minTime !== undefined && currentTime <= minTime}
              >
                <SkipPrevious />
              </IconButton>
              
              <IconButton
                onClick={() => onPlayPauseChange(!isPlaying)}
                color="primary"
                sx={{ 
                  backgroundColor: 'action.selected',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              
              <IconButton
                onClick={() => handleSkip('forward')}
                disabled={maxTime !== undefined && currentTime >= maxTime}
              >
                <SkipNext />
              </IconButton>
            </Stack>

            <Divider orientation="vertical" flexItem />

            {/* Speed Control */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Speed />
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
                endIcon={<Badge badgeContent={`${playbackSpeed}x`} color="primary" />}
              >
                Speed
              </Button>
            </Stack>

            <Divider orientation="vertical" flexItem />

            {/* Time Window Control */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Timeline />
              <Button
                variant="outlined"
                size="small"
                onClick={(e) => setPresetMenuAnchor(e.currentTarget)}
              >
                Window: {formatTimeWindow(globalTimeWindow)}
              </Button>
              <IconButton size="small" onClick={() => handleZoom('in')}>
                <ZoomIn />
              </IconButton>
              <IconButton size="small" onClick={() => handleZoom('out')}>
                <ZoomOut />
              </IconButton>
            </Stack>

            <Divider orientation="vertical" flexItem />

            {/* Current Time Display */}
            <Stack direction="row" spacing={1} alignItems="center">
              <AccessTime />
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {formatTime(currentTime)}
              </Typography>
              <IconButton 
                size="small" 
                onClick={() => setCustomTimeDialogOpen(true)}
                title="Jump to time"
              >
                <History />
              </IconButton>
            </Stack>

            <Box sx={{ flex: 1 }} />

            {/* Right Side Controls */}
            <Stack direction="row" spacing={1} alignItems="center">
              {/* Loop Control */}
              {enableLoop && (
                <Tooltip title={loopEnabled ? "Disable loop" : "Enable loop"}>
                  <IconButton
                    onClick={() => {
                      setLoopEnabled(!loopEnabled);
                      if (!loopEnabled) {
                        setLoopRange(timeRange);
                      } else {
                        setLoopRange(null);
                      }
                    }}
                    color={loopEnabled ? "primary" : "default"}
                  >
                    {loopEnabled ? <Loop /> : <LoopOutlined />}
                  </IconButton>
                </Tooltip>
              )}

              {/* Bookmarks */}
              {showBookmarks && (
                <>
                  <Badge badgeContent={bookmarks.length} color="primary">
                    <IconButton
                      onClick={(e) => setBookmarkPopoverAnchor(e.currentTarget)}
                    >
                      <Bookmark />
                    </IconButton>
                  </Badge>
                  <IconButton
                    onClick={(e) => {
                      setBookmarkPopoverAnchor(e.currentTarget);
                      setBookmarkLabel('');
                    }}
                    title="Add bookmark"
                  >
                    <BookmarkBorder />
                  </IconButton>
                </>
              )}

              {/* Markers */}
              {showMarkers && (
                <>
                  <Badge badgeContent={markers.length} color="secondary">
                    <IconButton
                      onClick={(e) => setMarkerPopoverAnchor(e.currentTarget)}
                    >
                      <Flag />
                    </IconButton>
                  </Badge>
                  <IconButton
                    onClick={(e) => {
                      setMarkerPopoverAnchor(e.currentTarget);
                      setMarkerLabel('');
                    }}
                    title="Add marker"
                  >
                    <FlagOutlined />
                  </IconButton>
                </>
              )}

              <Divider orientation="vertical" flexItem />

              {/* Sync Toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={syncTime}
                    onChange={(e) => onSyncTimeChange(e.target.checked)}
                    icon={<SyncDisabled />}
                    checkedIcon={<Sync />}
                  />
                }
                label="Sync Charts"
                labelPlacement="start"
              />
            </Stack>
          </Stack>

          {/* Time Range Slider */}
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="caption" sx={{ minWidth: 100 }}>
              {format(new Date(timeRange.start), 'HH:mm:ss')}
            </Typography>
            <Slider
              value={[timeRange.start, timeRange.end]}
              onChange={(e, value) => {
                if (Array.isArray(value)) {
                  setTimeRange({ start: value[0], end: value[1] });
                  onCurrentTimeChange(value[1]);
                  onTimeWindowChange(value[1] - value[0]);
                }
              }}
              min={minTime || Date.now() - 24 * 60 * 60 * 1000}
              max={maxTime || Date.now()}
              step={100}
              marks={[
                ...bookmarks.map(b => ({ value: b.time, label: '' })),
                ...markers.map(m => ({ value: m.time, label: '' })),
              ]}
              sx={{
                '& .MuiSlider-mark': {
                  backgroundColor: 'primary.main',
                  height: 8,
                  width: 2,
                },
              }}
            />
            <Typography variant="caption" sx={{ minWidth: 100 }}>
              {format(new Date(timeRange.end), 'HH:mm:ss')}
            </Typography>
          </Stack>
        </Stack>

        {/* Time Preset Menu */}
        <Menu
          anchorEl={presetMenuAnchor}
          open={Boolean(presetMenuAnchor)}
          onClose={() => setPresetMenuAnchor(null)}
        >
          {timePresets.map(preset => (
            <MenuItem
              key={preset.value}
              onClick={() => handlePresetSelect(preset)}
            >
              <ListItemIcon>{preset.icon}</ListItemIcon>
              <ListItemText>{preset.label}</ListItemText>
            </MenuItem>
          ))}
          <Divider />
          <MenuItem onClick={() => {
            setPresetMenuAnchor(null);
            setCustomTimeDialogOpen(true);
          }}>
            <ListItemIcon><DateRange /></ListItemIcon>
            <ListItemText>Custom Range...</ListItemText>
          </MenuItem>
        </Menu>

        {/* Speed Menu */}
        <Menu
          anchorEl={speedMenuAnchor}
          open={Boolean(speedMenuAnchor)}
          onClose={() => setSpeedMenuAnchor(null)}
        >
          {playbackSpeeds.map(speed => (
            <MenuItem
              key={speed}
              selected={speed === playbackSpeed}
              onClick={() => {
                onPlaybackSpeedChange(speed);
                setSpeedMenuAnchor(null);
              }}
            >
              {speed}x
            </MenuItem>
          ))}
        </Menu>

        {/* Bookmark Popover */}
        <Popover
          open={Boolean(bookmarkPopoverAnchor)}
          anchorEl={bookmarkPopoverAnchor}
          onClose={() => setBookmarkPopoverAnchor(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 2, minWidth: 250 }}>
            {bookmarkLabel !== undefined ? (
              <Stack spacing={2}>
                <Typography variant="subtitle2">Add Bookmark</Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Label"
                  value={bookmarkLabel}
                  onChange={(e) => setBookmarkLabel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddBookmark();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAddBookmark}
                  disabled={!bookmarkLabel}
                >
                  Add Bookmark
                </Button>
              </Stack>
            ) : (
              <List>
                {bookmarks.length === 0 ? (
                  <ListItem>
                    <ListItemText secondary="No bookmarks" />
                  </ListItem>
                ) : (
                  bookmarks.map(bookmark => (
                    <ListItem
                      key={bookmark.id}
                      button
                      onClick={() => {
                        handleJumpTo(bookmark.time);
                        setBookmarkPopoverAnchor(null);
                      }}
                    >
                      <ListItemIcon>
                        <Bookmark color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={bookmark.label}
                        secondary={formatTime(bookmark.time)}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Box>
        </Popover>

        {/* Marker Popover */}
        <Popover
          open={Boolean(markerPopoverAnchor)}
          anchorEl={markerPopoverAnchor}
          onClose={() => setMarkerPopoverAnchor(null)}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 2, minWidth: 250 }}>
            {markerLabel !== undefined ? (
              <Stack spacing={2}>
                <Typography variant="subtitle2">Add Marker</Typography>
                <TextField
                  fullWidth
                  size="small"
                  label="Label"
                  value={markerLabel}
                  onChange={(e) => setMarkerLabel(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddMarker();
                    }
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAddMarker}
                  disabled={!markerLabel}
                >
                  Add Marker
                </Button>
              </Stack>
            ) : (
              <List>
                {markers.length === 0 ? (
                  <ListItem>
                    <ListItemText secondary="No markers" />
                  </ListItem>
                ) : (
                  markers.map(marker => (
                    <ListItem
                      key={marker.id}
                      button
                      onClick={() => {
                        handleJumpTo(marker.time);
                        setMarkerPopoverAnchor(null);
                      }}
                    >
                      <ListItemIcon>
                        <Flag style={{ color: marker.color || 'secondary' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={marker.label}
                        secondary={formatTime(marker.time)}
                      />
                    </ListItem>
                  ))
                )}
              </List>
            )}
          </Box>
        </Popover>

        {/* Custom Time Dialog */}
        <Popover
          open={customTimeDialogOpen}
          onClose={() => setCustomTimeDialogOpen(false)}
          anchorOrigin={{
            vertical: 'center',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'center',
            horizontal: 'center',
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Jump to Time
            </Typography>
            <DateTimePicker
              label="Select Time"
              value={jumpToTime}
              onChange={(newValue) => {
                setJumpToTime(newValue);
                if (newValue) {
                  onCurrentTimeChange(newValue.getTime());
                  setCustomTimeDialogOpen(false);
                }
              }}
              renderInput={(params) => <TextField {...params} />}
            />
          </Box>
        </Popover>
      </Paper>
    </LocalizationProvider>
  );
};

export default TimeControlBar;