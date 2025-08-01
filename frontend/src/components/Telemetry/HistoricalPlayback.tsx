/**
 * HistoricalPlayback - UI component for historical telemetry playback
 * Features timeline scrubber, playback controls, and comparison mode
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Slider,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Chip,
  Stack,
  Button,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Alert,
  Zoom,
  Fade
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  Loop,
  Speed,
  Download,
  CompareArrows,
  Timeline,
  BookmarkAdd,
  BookmarkBorder,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  Settings,
  Info,
  Warning
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { 
  PlaybackController, 
  PlaybackState, 
  PlaybackSpeed, 
  PLAYBACK_SPEEDS,
  PlaybackPosition,
  InterpolationMethod
} from '../../services/telemetry/PlaybackController';
import { 
  HistoricalDataManager,
  ExportFormat,
  ExportOptions
} from '../../services/telemetry/HistoricalDataManager';
import { TelemetryDataPoint } from '../../services/websocket/TelemetryManager';
import TimelineAnnotations, { TimelineAnnotation } from './TimelineAnnotations';

/**
 * Props for HistoricalPlayback component
 */
export interface HistoricalPlaybackProps {
  historicalDataManager: HistoricalDataManager;
  streamIds: string[];
  startTime: number;
  endTime: number;
  onDataUpdate?: (streamId: string, data: TelemetryDataPoint) => void;
  onComparisonToggle?: (enabled: boolean) => void;
  height?: number;
  showAnnotations?: boolean;
  annotations?: TimelineAnnotation[];
  onAnnotationAdd?: (annotation: TimelineAnnotation) => void;
  onAnnotationUpdate?: (annotation: TimelineAnnotation) => void;
  onAnnotationDelete?: (id: string) => void;
}

/**
 * Styled components
 */
const PlaybackContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  background: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  position: 'relative',
  overflow: 'hidden'
}));

const TimelineContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  height: 60,
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
  background: theme.palette.action.hover,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden'
}));

const ProgressBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
  transition: 'width 0.1s ease-out'
}));

const BufferBar = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  background: theme.palette.action.selected,
  opacity: 0.5
}));

const TimelineSlider = styled(Slider)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 'calc(100% - 32px)',
  left: 16,
  right: 16,
  '& .MuiSlider-thumb': {
    width: 16,
    height: 16,
    background: theme.palette.primary.main,
    '&:hover': {
      boxShadow: '0 0 0 8px rgba(25, 118, 210, 0.16)'
    }
  },
  '& .MuiSlider-rail': {
    opacity: 0
  },
  '& .MuiSlider-track': {
    opacity: 0
  }
}));

const ControlsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  flexWrap: 'wrap'
}));

const PlaybackControls = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1)
}));

const TimeDisplay = styled(Typography)(({ theme }) => ({
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
  minWidth: 180,
  textAlign: 'center'
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem'
}));

/**
 * Format time for display
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
};

/**
 * Format duration
 */
const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

/**
 * HistoricalPlayback component
 */
export const HistoricalPlayback: React.FC<HistoricalPlaybackProps> = ({
  historicalDataManager,
  streamIds,
  startTime,
  endTime,
  onDataUpdate,
  onComparisonToggle,
  height = 200,
  showAnnotations = true,
  annotations = [],
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete
}) => {
  // State
  const [playbackController, setPlaybackController] = useState<PlaybackController | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(PlaybackState.STOPPED);
  const [position, setPosition] = useState<PlaybackPosition | null>(null);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [loop, setLoop] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [interpolation, setInterpolation] = useState<InterpolationMethod>(InterpolationMethod.LINEAR);
  const [isSeeking, setIsSeeking] = useState(false);
  const [bufferPercentage, setBufferPercentage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();

  // Initialize playback controller
  useEffect(() => {
    const controller = new PlaybackController(historicalDataManager, {
      startTime,
      endTime,
      speed,
      loop,
      interpolation,
      bufferSize: 30,
      seekPrecision: 10
    });

    // Set up event listeners
    controller.on('state:changed', setPlaybackState);
    controller.on('position:update', setPosition);
    controller.on('speed:changed', setSpeed);
    controller.on('buffer:low', setBufferPercentage);
    controller.on('buffer:ready', () => setBufferPercentage(1));
    controller.on('error', (err) => setError(err.message));
    
    if (onDataUpdate) {
      controller.on('data:update', onDataUpdate);
    }

    // Add streams
    Promise.all(
      streamIds.map(streamId => controller.addStream(streamId, interpolation))
    ).catch(err => setError(err.message));

    setPlaybackController(controller);

    return () => {
      controller.destroy();
    };
  }, [historicalDataManager, streamIds, startTime, endTime, interpolation]);

  // Handle speed changes
  const handleSpeedChange = useCallback((newSpeed: PlaybackSpeed) => {
    playbackController?.setSpeed(newSpeed);
    setSpeed(newSpeed);
  }, [playbackController]);

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    if (!playbackController) return;

    try {
      if (playbackState === PlaybackState.PLAYING) {
        playbackController.pause();
      } else {
        await playbackController.play();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [playbackController, playbackState]);

  // Handle stop
  const handleStop = useCallback(() => {
    playbackController?.stop();
  }, [playbackController]);

  // Handle seek
  const handleSeek = useCallback(async (event: Event, value: number | number[]) => {
    if (!playbackController || Array.isArray(value)) return;
    
    setIsSeeking(true);
    try {
      await playbackController.seek(value);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSeeking(false);
    }
  }, [playbackController]);

  // Handle loop toggle
  const handleLoopToggle = useCallback(() => {
    const newLoop = !loop;
    playbackController?.setLoop(newLoop);
    setLoop(newLoop);
  }, [playbackController, loop]);

  // Handle comparison mode
  const handleComparisonToggle = useCallback(() => {
    const newMode = !comparisonMode;
    setComparisonMode(newMode);
    onComparisonToggle?.(newMode);
  }, [comparisonMode, onComparisonToggle]);

  // Handle interpolation change
  const handleInterpolationChange = useCallback((event: any) => {
    setInterpolation(event.target.value);
  }, []);

  // Handle export
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!position) return;

    try {
      const options: ExportOptions = {
        format,
        streamIds,
        startTime: position.currentTime - 60000, // Last minute
        endTime: position.currentTime,
        includeMetadata: true,
        compression: true
      };

      const downloadUrl = await historicalDataManager.exportData(options);
      
      // Create download link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `telemetry-export-${Date.now()}.${format}`;
      link.click();
    } catch (err) {
      setError((err as Error).message);
    }
    
    setExportMenuAnchor(null);
  }, [historicalDataManager, streamIds, position]);

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    setZoomLevel(prev => Math.max(0.1, Math.min(10, prev + delta)));
  }, []);

  // Handle skip
  const handleSkip = useCallback(async (seconds: number) => {
    if (!playbackController || !position) return;
    
    try {
      await playbackController.seek(position.currentTime + seconds * 1000);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [playbackController, position]);

  // Format position display
  const positionDisplay = useMemo(() => {
    if (!position) return '';
    
    return `${formatTime(position.currentTime)} / ${formatTime(endTime)} (${formatDuration(position.remainingTime)})`;
  }, [position, endTime]);

  // Buffer width percentage
  const bufferWidth = useMemo(() => {
    return `${bufferPercentage * 100}%`;
  }, [bufferPercentage]);

  // Progress width percentage
  const progressWidth = useMemo(() => {
    return position ? `${position.progress * 100}%` : '0%';
  }, [position]);

  return (
    <PlaybackContainer elevation={2} style={{ height }}>
      {error && (
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      <ControlsContainer>
        <PlaybackControls>
          <Tooltip title="Previous minute">
            <IconButton onClick={() => handleSkip(-60)} size="small">
              <SkipPrevious />
            </IconButton>
          </Tooltip>

          <Tooltip title={playbackState === PlaybackState.PLAYING ? 'Pause' : 'Play'}>
            <IconButton 
              onClick={handlePlayPause} 
              color="primary"
              disabled={!playbackController || playbackState === PlaybackState.BUFFERING}
            >
              {playbackState === PlaybackState.PLAYING ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Stop">
            <IconButton onClick={handleStop} size="small">
              <Stop />
            </IconButton>
          </Tooltip>

          <Tooltip title="Next minute">
            <IconButton onClick={() => handleSkip(60)} size="small">
              <SkipNext />
            </IconButton>
          </Tooltip>

          <Tooltip title={loop ? 'Loop enabled' : 'Loop disabled'}>
            <IconButton 
              onClick={handleLoopToggle} 
              color={loop ? 'primary' : 'default'}
              size="small"
            >
              <Loop />
            </IconButton>
          </Tooltip>

          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={speed}
              onChange={(e) => handleSpeedChange(e.target.value as PlaybackSpeed)}
              startAdornment={<Speed sx={{ mr: 0.5, fontSize: 16 }} />}
            >
              {PLAYBACK_SPEEDS.map(s => (
                <MenuItem key={s} value={s}>{s}x</MenuItem>
              ))}
            </Select>
          </FormControl>
        </PlaybackControls>

        <TimeDisplay>{positionDisplay}</TimeDisplay>

        <Stack direction="row" spacing={1} alignItems="center">
          <StatusChip
            label={playbackState}
            color={playbackState === PlaybackState.PLAYING ? 'success' : 'default'}
            size="small"
          />

          {bufferPercentage < 0.3 && (
            <StatusChip
              label="Low Buffer"
              color="warning"
              icon={<Warning />}
              size="small"
            />
          )}

          <ToggleButton
            value="comparison"
            selected={comparisonMode}
            onChange={handleComparisonToggle}
            size="small"
          >
            <CompareArrows sx={{ fontSize: 18 }} />
          </ToggleButton>

          <IconButton 
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            size="small"
          >
            <Download />
          </IconButton>

          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
          >
            <MenuItem onClick={() => handleExport(ExportFormat.CSV)}>
              <ListItemText>Export as CSV</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport(ExportFormat.JSON)}>
              <ListItemText>Export as JSON</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleExport(ExportFormat.XLSX)}>
              <ListItemText>Export as Excel</ListItemText>
            </MenuItem>
          </Menu>
        </Stack>
      </ControlsContainer>

      <TimelineContainer ref={timelineRef}>
        <BufferBar style={{ width: bufferWidth }} />
        <ProgressBar style={{ width: progressWidth }} />
        
        <TimelineSlider
          value={position?.currentTime || startTime}
          min={startTime}
          max={endTime}
          onChange={handleSeek}
          disabled={!playbackController || isSeeking}
        />

        {showAnnotations && (
          <TimelineAnnotations
            annotations={annotations}
            startTime={startTime}
            endTime={endTime}
            currentTime={position?.currentTime || startTime}
            onAnnotationClick={setSelectedAnnotation}
            onAnnotationAdd={onAnnotationAdd}
            onAnnotationUpdate={onAnnotationUpdate}
            onAnnotationDelete={onAnnotationDelete}
            zoomLevel={zoomLevel}
          />
        )}
      </TimelineContainer>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Interpolation</InputLabel>
          <Select
            value={interpolation}
            onChange={handleInterpolationChange}
            label="Interpolation"
          >
            <MenuItem value={InterpolationMethod.NONE}>None</MenuItem>
            <MenuItem value={InterpolationMethod.LINEAR}>Linear</MenuItem>
            <MenuItem value={InterpolationMethod.CUBIC}>Cubic</MenuItem>
            <MenuItem value={InterpolationMethod.STEP}>Step</MenuItem>
            <MenuItem value={InterpolationMethod.SMOOTH}>Smooth</MenuItem>
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => handleZoom(-0.5)} size="small">
            <ZoomOut />
          </IconButton>
          <Typography variant="caption" sx={{ alignSelf: 'center' }}>
            {Math.round(zoomLevel * 100)}%
          </Typography>
          <IconButton onClick={() => handleZoom(0.5)} size="small">
            <ZoomIn />
          </IconButton>
        </Stack>
      </Box>

      {playbackState === PlaybackState.BUFFERING && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10
          }}
        >
          <CircularProgress />
        </Box>
      )}
    </PlaybackContainer>
  );
};

export default HistoricalPlayback;