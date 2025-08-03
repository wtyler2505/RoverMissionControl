/**
 * TimelinePlaybackControls Component
 * Mission-critical playback controls for rover timeline visualization
 * Provides comprehensive control over timeline navigation and playback
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  ButtonGroup,
  Chip,
  useTheme,
  styled,
  SliderProps,
  alpha
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipPrevious,
  SkipNext,
  FastRewind,
  FastForward,
  FirstPage,
  LastPage,
  Speed,
  Timeline,
  VisibilityOutlined,
  KeyboardArrowLeft,
  KeyboardArrowRight
} from '@mui/icons-material';
import { format, addSeconds, addMinutes, addHours, addDays } from 'date-fns';
import { useChartTheme } from '../base/ChartThemeProvider';

// Types and interfaces
export interface PlaybackSpeed {
  value: number;
  label: string;
  icon?: React.ReactNode;
}

export interface StepInterval {
  value: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
  label: string;
}

export interface TimeFormat {
  value: string;
  label: string;
  formatter: (date: Date) => string;
}

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  currentTime: Date;
  speed: number;
  canPlay: boolean;
  canPause: boolean;
  canStop: boolean;
}

export interface TimelinePlaybackControlsProps {
  // Time range and current position
  startTime: Date;
  endTime: Date;
  currentTime: Date;
  
  // Playback state
  isPlaying?: boolean;
  playbackSpeed?: number;
  
  // Event handlers
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onTimeChange?: (time: Date) => void;
  onSpeedChange?: (speed: number) => void;
  onStepForward?: (interval: StepInterval) => void;
  onStepBackward?: (interval: StepInterval) => void;
  onJumpToStart?: () => void;
  onJumpToEnd?: () => void;
  
  // Configuration
  availableSpeeds?: PlaybackSpeed[];
  stepIntervals?: StepInterval[];
  timeFormats?: TimeFormat[];
  defaultTimeFormat?: string;
  
  // UI customization
  showMiniTimeline?: boolean;
  showSpeedSelector?: boolean;
  showStepControls?: boolean;
  showJumpControls?: boolean;
  showTimeDisplay?: boolean;
  showTooltips?: boolean;
  
  // Responsive behavior
  breakpoint?: 'mobile' | 'tablet' | 'desktop';
  compactMode?: boolean;
  
  // Accessibility
  ariaLabel?: string;
  describedBy?: string;
  
  // Keyboard shortcuts
  enableKeyboardShortcuts?: boolean;
  
  // Animation settings
  animationDuration?: number;
  
  // Error state
  error?: string;
  disabled?: boolean;
  
  // Data visualization
  timelineTasks?: Array<{
    id: string;
    startTime: Date;
    endTime: Date;
    color?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  
  // Performance
  throttleMs?: number;
}

// Default configurations
const DEFAULT_SPEEDS: PlaybackSpeed[] = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
  { value: 8, label: '8x' }
];

const DEFAULT_STEP_INTERVALS: StepInterval[] = [
  { value: 10, unit: 'seconds', label: '10s' },
  { value: 1, unit: 'minutes', label: '1m' },
  { value: 5, unit: 'minutes', label: '5m' },
  { value: 1, unit: 'hours', label: '1h' }
];

const DEFAULT_TIME_FORMATS: TimeFormat[] = [
  { 
    value: 'HH:mm:ss', 
    label: 'Time', 
    formatter: (date: Date) => format(date, 'HH:mm:ss') 
  },
  { 
    value: 'MMM dd HH:mm', 
    label: 'Date & Time', 
    formatter: (date: Date) => format(date, 'MMM dd HH:mm') 
  },
  { 
    value: 'yyyy-MM-dd HH:mm:ss', 
    label: 'Full DateTime', 
    formatter: (date: Date) => format(date, 'yyyy-MM-dd HH:mm:ss') 
  }
];

// Styled components
const ControlsContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'compactMode'
})<{ compactMode?: boolean }>(({ theme, compactMode }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(compactMode ? 1 : 2),
  padding: theme.spacing(compactMode ? 1 : 2),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[2],
  border: `1px solid ${theme.palette.divider}`,
  flexWrap: compactMode ? 'wrap' : 'nowrap',
  minHeight: compactMode ? 56 : 72,
  
  '&:focus-within': {
    boxShadow: `${theme.shadows[2]}, 0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
  },
  
  '@media (max-width: 768px)': {
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    padding: theme.spacing(1)
  }
}));

const PlaybackButton = styled(IconButton, {
  shouldForwardProp: (prop) => !['variant', 'size'].includes(prop as string)
})<{ variant?: 'primary' | 'secondary'; size?: 'small' | 'medium' | 'large' }>(
  ({ theme, variant = 'secondary', size = 'medium' }) => ({
    transition: theme.transitions.create(['all'], {
      duration: theme.transitions.duration.short
    }),
    
    ...(variant === 'primary' && {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
        transform: 'scale(1.05)'
      },
      '&:active': {
        transform: 'scale(0.95)'
      }
    }),
    
    '&:disabled': {
      opacity: 0.5,
      transform: 'none'
    },
    
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: 2
    }
  })
);

const TimeSlider = styled(Slider)<SliderProps>(({ theme }) => ({
  minWidth: 200,
  flex: 1,
  
  '& .MuiSlider-thumb': {
    transition: theme.transitions.create(['box-shadow', 'transform'], {
      duration: theme.transitions.duration.short
    }),
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0 0 0 8px ${alpha(theme.palette.primary.main, 0.16)}`,
      transform: 'scale(1.1)'
    },
    '&.Mui-active': {
      boxShadow: `0 0 0 14px ${alpha(theme.palette.primary.main, 0.16)}`,
      transform: 'scale(1.2)'
    }
  },
  
  '& .MuiSlider-track': {
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`
  },
  
  '& .MuiSlider-rail': {
    opacity: 0.3
  },
  
  '@media (max-width: 768px)': {
    minWidth: 150,
    width: '100%'
  }
}));

const MiniTimeline = styled(Box)(({ theme }) => ({
  height: 4,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  borderRadius: 2,
  position: 'relative',
  overflow: 'hidden',
  marginTop: theme.spacing(0.5),
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: theme.palette.primary.main,
    transition: theme.transitions.create('width', {
      duration: theme.transitions.duration.short
    })
  }
}));

const TimeDisplayContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: 120,
  
  '@media (max-width: 768px)': {
    minWidth: 100
  }
}));

/**
 * TimelinePlaybackControls Component
 */
export const TimelinePlaybackControls: React.FC<TimelinePlaybackControlsProps> = ({
  startTime,
  endTime,
  currentTime,
  isPlaying = false,
  playbackSpeed = 1,
  onPlay,
  onPause,
  onStop,
  onTimeChange,
  onSpeedChange,
  onStepForward,
  onStepBackward,
  onJumpToStart,
  onJumpToEnd,
  availableSpeeds = DEFAULT_SPEEDS,
  stepIntervals = DEFAULT_STEP_INTERVALS,
  timeFormats = DEFAULT_TIME_FORMATS,
  defaultTimeFormat = 'HH:mm:ss',
  showMiniTimeline = true,
  showSpeedSelector = true,
  showStepControls = true,
  showJumpControls = true,
  showTimeDisplay = true,
  showTooltips = true,
  breakpoint = 'desktop',
  compactMode = false,
  ariaLabel = 'Timeline playback controls',
  describedBy,
  enableKeyboardShortcuts = true,
  animationDuration = 300,
  error,
  disabled = false,
  timelineTasks = [],
  throttleMs = 100
}) => {
  const theme = useTheme();
  const chartTheme = useChartTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [selectedTimeFormat, setSelectedTimeFormat] = useState(defaultTimeFormat);
  const [isDragging, setIsDragging] = useState(false);
  const [lastKeyPress, setLastKeyPress] = useState<number>(0);
  
  // Memoized calculations
  const totalDuration = useMemo(() => 
    endTime.getTime() - startTime.getTime(), 
    [startTime, endTime]
  );
  
  const currentProgress = useMemo(() => {
    if (totalDuration === 0) return 0;
    return ((currentTime.getTime() - startTime.getTime()) / totalDuration) * 100;
  }, [currentTime, startTime, totalDuration]);
  
  const playbackState = useMemo<PlaybackState>(() => ({
    isPlaying,
    isPaused: !isPlaying && currentTime < endTime,
    isStopped: currentTime >= endTime,
    currentTime,
    speed: playbackSpeed,
    canPlay: currentTime < endTime && !disabled,
    canPause: isPlaying && !disabled,
    canStop: (isPlaying || currentTime > startTime) && !disabled
  }), [isPlaying, currentTime, endTime, startTime, playbackSpeed, disabled]);
  
  const selectedTimeFormatter = useMemo(() => 
    timeFormats.find(fmt => fmt.value === selectedTimeFormat)?.formatter || 
    ((date: Date) => format(date, selectedTimeFormat)),
    [selectedTimeFormat, timeFormats]
  );
  
  // Throttled time change handler
  const throttledTimeChange = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (time: Date) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onTimeChange?.(time);
        }, throttleMs);
      };
    })(),
    [onTimeChange, throttleMs]
  );
  
  // Event handlers
  const handlePlay = useCallback(() => {
    if (playbackState.canPlay) {
      onPlay?.();
    }
  }, [onPlay, playbackState.canPlay]);
  
  const handlePause = useCallback(() => {
    if (playbackState.canPause) {
      onPause?.();
    }
  }, [onPause, playbackState.canPause]);
  
  const handleStop = useCallback(() => {
    if (playbackState.canStop) {
      onStop?.();
    }
  }, [onStop, playbackState.canStop]);
  
  const handleTimeSliderChange = useCallback((_: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      const newTime = new Date(startTime.getTime() + (totalDuration * value) / 100);
      if (!isDragging) {
        throttledTimeChange(newTime);
      }
    }
  }, [startTime, totalDuration, isDragging, throttledTimeChange]);
  
  const handleTimeSliderChangeCommitted = useCallback((_: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      const newTime = new Date(startTime.getTime() + (totalDuration * value) / 100);
      onTimeChange?.(newTime);
      setIsDragging(false);
    }
  }, [startTime, totalDuration, onTimeChange]);
  
  const handleSpeedChange = useCallback((event: any) => {
    const newSpeed = event.target.value as number;
    onSpeedChange?.(newSpeed);
  }, [onSpeedChange]);
  
  const handleStepForward = useCallback((interval: StepInterval) => {
    onStepForward?.(interval);
  }, [onStepForward]);
  
  const handleStepBackward = useCallback((interval: StepInterval) => {
    onStepBackward?.(interval);
  }, [onStepBackward]);
  
  const handleJumpToStart = useCallback(() => {
    onJumpToStart?.();
  }, [onJumpToStart]);
  
  const handleJumpToEnd = useCallback(() => {
    onJumpToEnd?.();
  }, [onJumpToEnd]);
  
  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent rapid key presses
      const now = Date.now();
      if (now - lastKeyPress < 100) return;
      setLastKeyPress(now);
      
      // Only handle shortcuts when controls are focused or no input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && 
        (activeElement.tagName === 'INPUT' || 
         activeElement.tagName === 'TEXTAREA' || 
         activeElement.getAttribute('contenteditable') === 'true');
      
      if (isInputFocused && !containerRef.current?.contains(activeElement)) {
        return;
      }
      
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          if (isPlaying) {
            handlePause();
          } else {
            handlePlay();
          }
          break;
          
        case 'KeyS':
          if (event.ctrlKey || event.metaKey) return;
          event.preventDefault();
          handleStop();
          break;
          
        case 'ArrowLeft':
          event.preventDefault();
          if (stepIntervals.length > 0) {
            handleStepBackward(stepIntervals[0]);
          }
          break;
          
        case 'ArrowRight':
          event.preventDefault();
          if (stepIntervals.length > 0) {
            handleStepForward(stepIntervals[0]);
          }
          break;
          
        case 'Home':
          event.preventDefault();
          handleJumpToStart();
          break;
          
        case 'End':
          event.preventDefault();
          handleJumpToEnd();
          break;
          
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
          const speedIndex = parseInt(event.code.slice(-1)) - 1;
          if (speedIndex < availableSpeeds.length) {
            onSpeedChange?.(availableSpeeds[speedIndex].value);
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    enableKeyboardShortcuts,
    isPlaying,
    lastKeyPress,
    handlePlay,
    handlePause,
    handleStop,
    handleStepForward,
    handleStepBackward,
    handleJumpToStart,
    handleJumpToEnd,
    stepIntervals,
    availableSpeeds,
    onSpeedChange
  ]);
  
  // Responsive breakpoint detection
  const isMobile = breakpoint === 'mobile' || compactMode;
  const isTablet = breakpoint === 'tablet';
  
  // Error handling
  if (error) {
    return (
      <ControlsContainer compactMode={compactMode} role="alert">
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      </ControlsContainer>
    );
  }
  
  return (
    <ControlsContainer
      ref={containerRef}
      compactMode={compactMode}
      role="toolbar"
      aria-label={ariaLabel}
      aria-describedby={describedBy}
    >
      {/* Jump to Start Button */}
      {showJumpControls && !isMobile && (
        <Tooltip title={showTooltips ? "Jump to start (Home)" : ""} arrow>
          <span>
            <PlaybackButton
              onClick={handleJumpToStart}
              disabled={disabled || currentTime <= startTime}
              size={compactMode ? 'small' : 'medium'}
              aria-label="Jump to start"
            >
              <FirstPage />
            </PlaybackButton>
          </span>
        </Tooltip>
      )}
      
      {/* Step Backward */}
      {showStepControls && stepIntervals.length > 0 && (
        <Tooltip title={showTooltips ? `Step back ${stepIntervals[0].label} (←)` : ""} arrow>
          <span>
            <PlaybackButton
              onClick={() => handleStepBackward(stepIntervals[0])}
              disabled={disabled}
              size={compactMode ? 'small' : 'medium'}
              aria-label={`Step backward ${stepIntervals[0].label}`}
            >
              {isMobile ? <KeyboardArrowLeft /> : <FastRewind />}
            </PlaybackButton>
          </span>
        </Tooltip>
      )}
      
      {/* Main Playback Controls */}
      <ButtonGroup variant="contained" size={compactMode ? 'small' : 'medium'}>
        <Tooltip title={showTooltips ? "Play (Space)" : ""} arrow>
          <span>
            <PlaybackButton
              variant="primary"
              onClick={handlePlay}
              disabled={disabled || !playbackState.canPlay}
              aria-label="Play"
            >
              <PlayArrow />
            </PlaybackButton>
          </span>
        </Tooltip>
        
        <Tooltip title={showTooltips ? "Pause (Space)" : ""} arrow>
          <span>
            <PlaybackButton
              variant="primary"
              onClick={handlePause}
              disabled={disabled || !playbackState.canPause}
              aria-label="Pause"
            >
              <Pause />
            </PlaybackButton>
          </span>
        </Tooltip>
        
        <Tooltip title={showTooltips ? "Stop (S)" : ""} arrow>
          <span>
            <PlaybackButton
              variant="primary"
              onClick={handleStop}
              disabled={disabled || !playbackState.canStop}
              aria-label="Stop"
            >
              <Stop />
            </PlaybackButton>
          </span>
        </Tooltip>
      </ButtonGroup>
      
      {/* Step Forward */}
      {showStepControls && stepIntervals.length > 0 && (
        <Tooltip title={showTooltips ? `Step forward ${stepIntervals[0].label} (→)` : ""} arrow>
          <span>
            <PlaybackButton
              onClick={() => handleStepForward(stepIntervals[0])}
              disabled={disabled}
              size={compactMode ? 'small' : 'medium'}
              aria-label={`Step forward ${stepIntervals[0].label}`}
            >
              {isMobile ? <KeyboardArrowRight /> : <FastForward />}
            </PlaybackButton>
          </span>
        </Tooltip>
      )}
      
      {/* Jump to End Button */}
      {showJumpControls && !isMobile && (
        <Tooltip title={showTooltips ? "Jump to end (End)" : ""} arrow>
          <span>
            <PlaybackButton
              onClick={handleJumpToEnd}
              disabled={disabled || currentTime >= endTime}
              size={compactMode ? 'small' : 'medium'}
              aria-label="Jump to end"
            >
              <LastPage />
            </PlaybackButton>
          </span>
        </Tooltip>
      )}
      
      {/* Time Scrubber */}
      <Box sx={{ flex: 1, minWidth: isMobile ? 120 : 200, mx: 1 }}>
        <TimeSlider
          value={currentProgress}
          onChange={handleTimeSliderChange}
          onChangeCommitted={handleTimeSliderChangeCommitted}
          onMouseDown={() => setIsDragging(true)}
          disabled={disabled}
          aria-label="Timeline scrubber"
          aria-valuetext={`Current time: ${selectedTimeFormatter(currentTime)}`}
          min={0}
          max={100}
          step={0.1}
        />
        
        {/* Mini Timeline Preview */}
        {showMiniTimeline && timelineTasks.length > 0 && (
          <MiniTimeline 
            sx={{ 
              '&::before': { 
                width: `${currentProgress}%` 
              } 
            }}
          >
            {timelineTasks.map((task) => {
              const taskStart = ((task.startTime.getTime() - startTime.getTime()) / totalDuration) * 100;
              const taskWidth = ((task.endTime.getTime() - task.startTime.getTime()) / totalDuration) * 100;
              
              return (
                <Box
                  key={task.id}
                  sx={{
                    position: 'absolute',
                    left: `${taskStart}%`,
                    width: `${taskWidth}%`,
                    height: '100%',
                    backgroundColor: task.color || theme.palette.primary.light,
                    opacity: 0.6
                  }}
                />
              );
            })}
          </MiniTimeline>
        )}
      </Box>
      
      {/* Time Display */}
      {showTimeDisplay && (
        <TimeDisplayContainer>
          <Timeline fontSize="small" />
          <Typography
            variant={compactMode ? 'caption' : 'body2'}
            fontFamily="monospace"
            color="textPrimary"
            aria-live="polite"
          >
            {selectedTimeFormatter(currentTime)}
          </Typography>
        </TimeDisplayContainer>
      )}
      
      {/* Speed Selector */}
      {showSpeedSelector && !isMobile && (
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <InputLabel id="speed-selector-label">
            <Speed fontSize="small" />
          </InputLabel>
          <Select
            labelId="speed-selector-label"
            value={playbackSpeed}
            onChange={handleSpeedChange}
            disabled={disabled}
            aria-label="Playback speed"
          >
            {availableSpeeds.map((speed) => (
              <MenuItem key={speed.value} value={speed.value}>
                {speed.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      
      {/* Speed Chip for Mobile */}
      {showSpeedSelector && isMobile && (
        <Chip
          icon={<Speed />}
          label={`${playbackSpeed}x`}
          size="small"
          variant="outlined"
          onClick={() => {
            const currentIndex = availableSpeeds.findIndex(s => s.value === playbackSpeed);
            const nextIndex = (currentIndex + 1) % availableSpeeds.length;
            onSpeedChange?.(availableSpeeds[nextIndex].value);
          }}
          disabled={disabled}
          aria-label={`Current speed: ${playbackSpeed}x. Tap to change speed.`}
        />
      )}
      
      {/* Additional Step Controls for Mobile */}
      {isMobile && stepIntervals.length > 1 && (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {stepIntervals.slice(1, 3).map((interval) => (
            <Chip
              key={`${interval.value}-${interval.unit}`}
              label={interval.label}
              size="small"
              variant="outlined"
              onClick={() => handleStepForward(interval)}
              disabled={disabled}
            />
          ))}
        </Box>
      )}
      
      {/* Time Format Selector (Desktop Only) */}
      {!isMobile && !isTablet && timeFormats.length > 1 && (
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Format</InputLabel>
          <Select
            value={selectedTimeFormat}
            onChange={(e) => setSelectedTimeFormat(e.target.value)}
            disabled={disabled}
            aria-label="Time format"
          >
            {timeFormats.map((fmt) => (
              <MenuItem key={fmt.value} value={fmt.value}>
                {fmt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      
      {/* Status Indicator */}
      {(isPlaying || playbackState.isStopped) && (
        <Chip
          icon={isPlaying ? <PlayArrow /> : <Stop />}
          label={isPlaying ? 'Playing' : 'Stopped'}
          size="small"
          color={isPlaying ? 'success' : 'default'}
          variant="filled"
        />
      )}
    </ControlsContainer>
  );
};

export default TimelinePlaybackControls;