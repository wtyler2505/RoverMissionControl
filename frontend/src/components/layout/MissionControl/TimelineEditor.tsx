/**
 * TimelineEditor Component
 * 
 * Visual timeline editor for creating and editing animations.
 * Supports drag-and-drop keyframes, multiple tracks, and real-time preview.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Slider,
  Typography,
  Menu,
  MenuItem,
  Divider,
  Tooltip,
  Chip,
  Stack,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Popover,
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipNext,
  SkipPrevious,
  Loop,
  ZoomIn,
  ZoomOut,
  Add,
  Delete,
  ContentCopy,
  ContentPaste,
  Undo,
  Redo,
  Save,
  FolderOpen,
  GridOn,
  Timeline as TimelineIcon,
  LinearScale,
  ShowChart,
  Layers,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
  VolumeUp,
  VolumeMute
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { 
  AnimationClip, 
  AnimationTrack, 
  AnimationKeyframe,
  EasingFunction,
  InterpolationType,
  BlendMode
} from './AnimationSystem';

// ========== Types ==========

interface TimelineSelection {
  trackId?: string;
  keyframeIndex?: number;
  startTime?: number;
  endTime?: number;
}

interface TimelineViewport {
  startTime: number;
  endTime: number;
  pixelsPerSecond: number;
  scrollX: number;
  scrollY: number;
}

interface TrackState {
  id: string;
  expanded: boolean;
  height: number;
  locked: boolean;
  visible: boolean;
  muted: boolean;
}

interface KeyframeDragState {
  trackId: string;
  keyframeIndex: number;
  startTime: number;
  startX: number;
  currentTime: number;
}

interface CurveEditorState {
  visible: boolean;
  trackId?: string;
  keyframeIndex?: number;
  curveType: 'value' | 'easing';
}

interface TimelineHistory {
  clips: AnimationClip[];
  index: number;
  maxSize: number;
}

export interface TimelineEditorProps {
  clip: AnimationClip;
  currentTime: number;
  isPlaying: boolean;
  onClipChange: (clip: AnimationClip) => void;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onStop: () => void;
  onExport?: (clip: AnimationClip) => void;
  onImport?: () => void;
  height?: number;
  'data-testid'?: string;
}

// ========== Constants ==========

const TRACK_HEIGHT = 40;
const TRACK_HEADER_WIDTH = 200;
const TIMELINE_HEADER_HEIGHT = 60;
const RULER_HEIGHT = 30;
const MIN_PIXELS_PER_SECOND = 10;
const MAX_PIXELS_PER_SECOND = 200;
const SNAP_THRESHOLD = 5;
const KEYFRAME_WIDTH = 12;

const EASING_PRESETS: { label: string; value: EasingFunction }[] = [
  { label: 'Linear', value: 'linear' },
  { label: 'Ease In', value: 'easeIn' },
  { label: 'Ease Out', value: 'easeOut' },
  { label: 'Ease In Out', value: 'easeInOut' },
  { label: 'Ease In Quad', value: 'easeInQuad' },
  { label: 'Ease Out Quad', value: 'easeOutQuad' },
  { label: 'Ease In Out Quad', value: 'easeInOutQuad' },
  { label: 'Ease In Cubic', value: 'easeInCubic' },
  { label: 'Ease Out Cubic', value: 'easeOutCubic' },
  { label: 'Ease In Out Cubic', value: 'easeInOutCubic' },
  { label: 'Ease In Elastic', value: 'easeInElastic' },
  { label: 'Ease Out Elastic', value: 'easeOutElastic' },
  { label: 'Ease In Out Elastic', value: 'easeInOutElastic' },
  { label: 'Ease In Bounce', value: 'easeInBounce' },
  { label: 'Ease Out Bounce', value: 'easeOutBounce' },
  { label: 'Ease In Out Bounce', value: 'easeInOutBounce' }
];

const INTERPOLATION_TYPES: { label: string; value: InterpolationType }[] = [
  { label: 'Linear', value: 'linear' },
  { label: 'Step', value: 'step' },
  { label: 'Cubic', value: 'cubic' },
  { label: 'Bezier', value: 'bezier' }
];

const BLEND_MODES: { label: string; value: BlendMode }[] = [
  { label: 'Override', value: 'override' },
  { label: 'Additive', value: 'additive' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Screen', value: 'screen' }
];

// ========== Timeline Editor Component ==========

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  clip,
  currentTime,
  isPlaying,
  onClipChange,
  onTimeChange,
  onPlayPause,
  onStop,
  onExport,
  onImport,
  height = 600,
  'data-testid': testId = 'timeline-editor'
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLCanvasElement>(null);

  // State
  const [viewport, setViewport] = useState<TimelineViewport>({
    startTime: 0,
    endTime: Math.max(10, clip.duration),
    pixelsPerSecond: 50,
    scrollX: 0,
    scrollY: 0
  });

  const [selection, setSelection] = useState<TimelineSelection>({});
  const [trackStates, setTrackStates] = useState<Map<string, TrackState>>(new Map());
  const [dragState, setDragState] = useState<KeyframeDragState | null>(null);
  const [curveEditor, setCurveEditor] = useState<CurveEditorState>({ visible: false, curveType: 'value' });
  const [history, setHistory] = useState<TimelineHistory>({
    clips: [clip],
    index: 0,
    maxSize: 50
  });

  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapInterval, setSnapInterval] = useState(0.1);
  const [showGrid, setShowGrid] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copyBuffer, setCopyBuffer] = useState<AnimationKeyframe[] | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    trackId?: string;
    keyframeIndex?: number;
  } | null>(null);

  // Initialize track states
  useEffect(() => {
    const newStates = new Map<string, TrackState>();
    clip.tracks.forEach(track => {
      if (!trackStates.has(track.id)) {
        newStates.set(track.id, {
          id: track.id,
          expanded: true,
          height: TRACK_HEIGHT,
          locked: false,
          visible: true,
          muted: false
        });
      } else {
        newStates.set(track.id, trackStates.get(track.id)!);
      }
    });
    setTrackStates(newStates);
  }, [clip.tracks]);

  // Auto-scroll during playback
  useEffect(() => {
    if (isPlaying && autoScroll) {
      const visibleDuration = viewport.endTime - viewport.startTime;
      if (currentTime > viewport.endTime - visibleDuration * 0.1) {
        setViewport(prev => ({
          ...prev,
          startTime: currentTime - visibleDuration * 0.1,
          endTime: currentTime + visibleDuration * 0.9
        }));
      }
    }
  }, [currentTime, isPlaying, autoScroll, viewport]);

  // Draw ruler
  useEffect(() => {
    const canvas = rulerRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw ruler
    ctx.fillStyle = theme.palette.text.primary;
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';

    const startTime = viewport.startTime;
    const endTime = viewport.endTime;
    const duration = endTime - startTime;
    const pixelsPerSecond = width / duration;

    // Major ticks every second
    for (let time = Math.floor(startTime); time <= endTime; time++) {
      const x = (time - startTime) * pixelsPerSecond;
      ctx.beginPath();
      ctx.moveTo(x, height - 10);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.fillText(time.toFixed(0) + 's', x, height - 12);
    }

    // Minor ticks every 0.1 second
    ctx.strokeStyle = theme.palette.divider;
    for (let time = Math.floor(startTime * 10) / 10; time <= endTime; time += 0.1) {
      const x = (time - startTime) * pixelsPerSecond;
      ctx.beginPath();
      ctx.moveTo(x, height - 5);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Current time indicator
    if (currentTime >= startTime && currentTime <= endTime) {
      const x = (currentTime - startTime) * pixelsPerSecond;
      ctx.strokeStyle = theme.palette.primary.main;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [viewport, currentTime, theme]);

  // History management
  const pushHistory = useCallback((newClip: AnimationClip) => {
    setHistory(prev => {
      const newHistory = [...prev.clips.slice(0, prev.index + 1), newClip];
      if (newHistory.length > prev.maxSize) {
        newHistory.shift();
      }
      return {
        ...prev,
        clips: newHistory,
        index: newHistory.length - 1
      };
    });
    onClipChange(newClip);
  }, [onClipChange]);

  const undo = useCallback(() => {
    if (history.index > 0) {
      const newIndex = history.index - 1;
      setHistory(prev => ({ ...prev, index: newIndex }));
      onClipChange(history.clips[newIndex]);
    }
  }, [history, onClipChange]);

  const redo = useCallback(() => {
    if (history.index < history.clips.length - 1) {
      const newIndex = history.index + 1;
      setHistory(prev => ({ ...prev, index: newIndex }));
      onClipChange(history.clips[newIndex]);
    }
  }, [history, onClipChange]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setViewport(prev => {
      const newPixelsPerSecond = Math.min(prev.pixelsPerSecond * 1.2, MAX_PIXELS_PER_SECOND);
      const center = (prev.startTime + prev.endTime) / 2;
      const newDuration = (timelineRef.current?.clientWidth || 800) / newPixelsPerSecond;
      return {
        ...prev,
        pixelsPerSecond: newPixelsPerSecond,
        startTime: center - newDuration / 2,
        endTime: center + newDuration / 2
      };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewport(prev => {
      const newPixelsPerSecond = Math.max(prev.pixelsPerSecond / 1.2, MIN_PIXELS_PER_SECOND);
      const center = (prev.startTime + prev.endTime) / 2;
      const newDuration = (timelineRef.current?.clientWidth || 800) / newPixelsPerSecond;
      return {
        ...prev,
        pixelsPerSecond: newPixelsPerSecond,
        startTime: Math.max(0, center - newDuration / 2),
        endTime: center + newDuration / 2
      };
    });
  }, []);

  // Keyframe operations
  const addKeyframe = useCallback((trackId: string, time: number) => {
    const track = clip.tracks.find(t => t.id === trackId);
    if (!track) return;

    const newKeyframe: AnimationKeyframe = {
      time,
      value: 0, // Default value, should be interpolated from surrounding keyframes
      easing: 'linear',
      interpolation: 'linear'
    };

    const newTrack = {
      ...track,
      keyframes: [...track.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
    };

    const newClip = {
      ...clip,
      tracks: clip.tracks.map(t => t.id === trackId ? newTrack : t)
    };

    pushHistory(newClip);
  }, [clip, pushHistory]);

  const deleteKeyframe = useCallback((trackId: string, keyframeIndex: number) => {
    const track = clip.tracks.find(t => t.id === trackId);
    if (!track) return;

    const newKeyframes = [...track.keyframes];
    newKeyframes.splice(keyframeIndex, 1);

    const newTrack = {
      ...track,
      keyframes: newKeyframes
    };

    const newClip = {
      ...clip,
      tracks: clip.tracks.map(t => t.id === trackId ? newTrack : t)
    };

    pushHistory(newClip);
  }, [clip, pushHistory]);

  const updateKeyframe = useCallback((
    trackId: string, 
    keyframeIndex: number, 
    updates: Partial<AnimationKeyframe>
  ) => {
    const track = clip.tracks.find(t => t.id === trackId);
    if (!track || !track.keyframes[keyframeIndex]) return;

    const newKeyframes = [...track.keyframes];
    newKeyframes[keyframeIndex] = {
      ...newKeyframes[keyframeIndex],
      ...updates
    };

    // Re-sort if time changed
    if (updates.time !== undefined) {
      newKeyframes.sort((a, b) => a.time - b.time);
    }

    const newTrack = {
      ...track,
      keyframes: newKeyframes
    };

    const newClip = {
      ...clip,
      tracks: clip.tracks.map(t => t.id === trackId ? newTrack : t)
    };

    pushHistory(newClip);
  }, [clip, pushHistory]);

  // Track operations
  const addTrack = useCallback(() => {
    const newTrack: AnimationTrack = {
      id: `track_${Date.now()}`,
      name: `New Track ${clip.tracks.length + 1}`,
      type: 'custom',
      targetId: '',
      property: '',
      keyframes: [],
      enabled: true,
      weight: 1
    };

    const newClip = {
      ...clip,
      tracks: [...clip.tracks, newTrack]
    };

    pushHistory(newClip);
  }, [clip, pushHistory]);

  const deleteTrack = useCallback((trackId: string) => {
    const newClip = {
      ...clip,
      tracks: clip.tracks.filter(t => t.id !== trackId)
    };

    pushHistory(newClip);
  }, [clip, pushHistory]);

  const updateTrack = useCallback((trackId: string, updates: Partial<AnimationTrack>) => {
    const newClip = {
      ...clip,
      tracks: clip.tracks.map(t => t.id === trackId ? { ...t, ...updates } : t)
    };

    pushHistory(newClip);
  }, [clip, pushHistory]);

  // Copy/Paste operations
  const copyKeyframes = useCallback(() => {
    if (!selection.trackId || selection.keyframeIndex === undefined) return;
    
    const track = clip.tracks.find(t => t.id === selection.trackId);
    if (!track) return;

    setCopyBuffer([track.keyframes[selection.keyframeIndex]]);
  }, [clip, selection]);

  const pasteKeyframes = useCallback((trackId: string, time: number) => {
    if (!copyBuffer || copyBuffer.length === 0) return;

    const track = clip.tracks.find(t => t.id === trackId);
    if (!track) return;

    const baseTime = copyBuffer[0].time;
    const newKeyframes = copyBuffer.map(kf => ({
      ...kf,
      time: time + (kf.time - baseTime)
    }));

    const newTrack = {
      ...track,
      keyframes: [...track.keyframes, ...newKeyframes].sort((a, b) => a.time - b.time)
    };

    const newClip = {
      ...clip,
      tracks: clip.tracks.map(t => t.id === trackId ? newTrack : t)
    };

    pushHistory(newClip);
  }, [clip, copyBuffer, pushHistory]);

  // Mouse event handlers
  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - TRACK_HEADER_WIDTH;
    const time = viewport.startTime + (x / viewport.pixelsPerSecond);
    
    if (snapEnabled) {
      const snappedTime = Math.round(time / snapInterval) * snapInterval;
      onTimeChange(snappedTime);
    } else {
      onTimeChange(time);
    }
  }, [viewport, snapEnabled, snapInterval, onTimeChange]);

  const handleKeyframeDragStart = useCallback((
    e: React.MouseEvent,
    trackId: string,
    keyframeIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const track = clip.tracks.find(t => t.id === trackId);
    if (!track) return;

    const keyframe = track.keyframes[keyframeIndex];
    setDragState({
      trackId,
      keyframeIndex,
      startTime: keyframe.time,
      startX: e.clientX,
      currentTime: keyframe.time
    });

    setSelection({ trackId, keyframeIndex });
  }, [clip]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaTime = deltaX / viewport.pixelsPerSecond;
    let newTime = dragState.startTime + deltaTime;

    // Apply snapping
    if (snapEnabled) {
      newTime = Math.round(newTime / snapInterval) * snapInterval;
    }

    // Clamp to valid range
    newTime = Math.max(0, Math.min(clip.duration, newTime));

    setDragState(prev => prev ? { ...prev, currentTime: newTime } : null);
  }, [dragState, viewport, snapEnabled, snapInterval, clip.duration]);

  const handleMouseUp = useCallback(() => {
    if (!dragState) return;

    if (dragState.currentTime !== dragState.startTime) {
      updateKeyframe(dragState.trackId, dragState.keyframeIndex, { time: dragState.currentTime });
    }

    setDragState(null);
  }, [dragState, updateKeyframe]);

  useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Context menu
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    trackId?: string,
    keyframeIndex?: number
  ) => {
    e.preventDefault();
    setContextMenu({
      mouseX: e.clientX,
      mouseY: e.clientY,
      trackId,
      keyframeIndex
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Render helpers
  const renderTrackHeader = (track: AnimationTrack, state: TrackState) => (
    <Box
      sx={{
        width: TRACK_HEADER_WIDTH,
        height: state.height,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        px: 1,
        bgcolor: 'background.paper',
        gap: 0.5
      }}
    >
      <IconButton
        size="small"
        onClick={() => updateTrack(track.id, { enabled: !track.enabled })}
      >
        {track.enabled ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
      </IconButton>
      
      <IconButton
        size="small"
        onClick={() => setTrackStates(prev => {
          const newStates = new Map(prev);
          const state = newStates.get(track.id)!;
          newStates.set(track.id, { ...state, locked: !state.locked });
          return newStates;
        })}
      >
        {state.locked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
      </IconButton>

      <Typography variant="body2" sx={{ flex: 1, ml: 1 }} noWrap>
        {track.name}
      </Typography>

      <IconButton
        size="small"
        onClick={(e) => handleContextMenu(e, track.id)}
      >
        <Delete fontSize="small" />
      </IconButton>
    </Box>
  );

  const renderTrackContent = (track: AnimationTrack, state: TrackState) => {
    const trackWidth = (viewport.endTime - viewport.startTime) * viewport.pixelsPerSecond;

    return (
      <Box
        sx={{
          position: 'relative',
          height: state.height,
          width: trackWidth,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: state.locked ? 'action.disabledBackground' : 'background.default',
          cursor: state.locked ? 'not-allowed' : 'pointer'
        }}
        onClick={(e) => {
          if (!state.locked) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const time = viewport.startTime + (x / viewport.pixelsPerSecond);
            addKeyframe(track.id, snapEnabled ? Math.round(time / snapInterval) * snapInterval : time);
          }
        }}
        onContextMenu={(e) => handleContextMenu(e, track.id)}
      >
        {/* Grid lines */}
        {showGrid && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                90deg,
                ${theme.palette.divider} 0,
                ${theme.palette.divider} 1px,
                transparent 1px,
                transparent ${viewport.pixelsPerSecond}px
              )`,
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Keyframes */}
        {track.keyframes.map((keyframe, index) => {
          const x = (keyframe.time - viewport.startTime) * viewport.pixelsPerSecond;
          const isDragging = dragState?.trackId === track.id && dragState?.keyframeIndex === index;
          const dragX = isDragging
            ? (dragState.currentTime - viewport.startTime) * viewport.pixelsPerSecond
            : x;

          if (dragX < -KEYFRAME_WIDTH || dragX > trackWidth + KEYFRAME_WIDTH) {
            return null; // Outside viewport
          }

          return (
            <Box
              key={index}
              sx={{
                position: 'absolute',
                left: dragX - KEYFRAME_WIDTH / 2,
                top: '50%',
                transform: 'translateY(-50%)',
                width: KEYFRAME_WIDTH,
                height: KEYFRAME_WIDTH,
                bgcolor: selection.trackId === track.id && selection.keyframeIndex === index
                  ? 'primary.main'
                  : 'secondary.main',
                borderRadius: '50%',
                cursor: state.locked ? 'not-allowed' : 'grab',
                boxShadow: isDragging ? 3 : 1,
                transition: isDragging ? 'none' : 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-50%) scale(1.2)'
                }
              }}
              onMouseDown={(e) => !state.locked && handleKeyframeDragStart(e, track.id, index)}
              onContextMenu={(e) => handleContextMenu(e, track.id, index)}
            />
          );
        })}
      </Box>
    );
  };

  const renderPlayhead = () => {
    const x = (currentTime - viewport.startTime) * viewport.pixelsPerSecond;
    const totalHeight = clip.tracks.length * TRACK_HEIGHT + RULER_HEIGHT;

    return (
      <Box
        sx={{
          position: 'absolute',
          left: TRACK_HEADER_WIDTH + x,
          top: 0,
          width: 2,
          height: totalHeight,
          bgcolor: 'primary.main',
          pointerEvents: 'none',
          zIndex: 10,
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: -5,
            width: 12,
            height: 12,
            bgcolor: 'primary.main',
            transform: 'rotate(45deg)',
            transformOrigin: 'center'
          }
        }}
      />
    );
  };

  return (
    <Paper
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
      data-testid={testId}
    >
      {/* Header */}
      <Box
        sx={{
          height: TIMELINE_HEADER_HEIGHT,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          gap: 2,
          bgcolor: 'background.paper'
        }}
      >
        {/* Playback controls */}
        <ButtonGroup size="small">
          <IconButton onClick={() => onTimeChange(0)}>
            <SkipPrevious />
          </IconButton>
          <IconButton onClick={onPlayPause}>
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton onClick={onStop}>
            <Stop />
          </IconButton>
          <IconButton onClick={() => onTimeChange(clip.duration)}>
            <SkipNext />
          </IconButton>
        </ButtonGroup>

        {/* Time display */}
        <Typography variant="body2" sx={{ minWidth: 80 }}>
          {currentTime.toFixed(2)}s / {clip.duration.toFixed(2)}s
        </Typography>

        <Divider orientation="vertical" flexItem />

        {/* Edit controls */}
        <ButtonGroup size="small">
          <Tooltip title="Undo">
            <IconButton onClick={undo} disabled={history.index === 0}>
              <Undo />
            </IconButton>
          </Tooltip>
          <Tooltip title="Redo">
            <IconButton onClick={redo} disabled={history.index === history.clips.length - 1}>
              <Redo />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <ButtonGroup size="small">
          <Tooltip title="Copy">
            <IconButton onClick={copyKeyframes} disabled={!selection.keyframeIndex}>
              <ContentCopy />
            </IconButton>
          </Tooltip>
          <Tooltip title="Paste">
            <IconButton disabled={!copyBuffer}>
              <ContentPaste />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <Divider orientation="vertical" flexItem />

        {/* View controls */}
        <ButtonGroup size="small">
          <Tooltip title="Zoom In">
            <IconButton onClick={zoomIn}>
              <ZoomIn />
            </IconButton>
          </Tooltip>
          <Tooltip title="Zoom Out">
            <IconButton onClick={zoomOut}>
              <ZoomOut />
            </IconButton>
          </Tooltip>
        </ButtonGroup>

        <ToggleButtonGroup
          size="small"
          value={[
            snapEnabled && 'snap',
            showGrid && 'grid',
            autoScroll && 'auto'
          ].filter(Boolean)}
        >
          <ToggleButton
            value="snap"
            onClick={() => setSnapEnabled(prev => !prev)}
          >
            <Tooltip title="Snap to Grid">
              <LinearScale />
            </Tooltip>
          </ToggleButton>
          <ToggleButton
            value="grid"
            onClick={() => setShowGrid(prev => !prev)}
          >
            <Tooltip title="Show Grid">
              <GridOn />
            </Tooltip>
          </ToggleButton>
          <ToggleButton
            value="auto"
            onClick={() => setAutoScroll(prev => !prev)}
          >
            <Tooltip title="Auto Scroll">
              <TimelineIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        {/* Loop control */}
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={clip.loop}
              onChange={(e) => pushHistory({ ...clip, loop: e.target.checked })}
            />
          }
          label="Loop"
        />

        {/* File operations */}
        {(onImport || onExport) && (
          <>
            <Divider orientation="vertical" flexItem />
            <ButtonGroup size="small">
              {onImport && (
                <Tooltip title="Import">
                  <IconButton onClick={onImport}>
                    <FolderOpen />
                  </IconButton>
                </Tooltip>
              )}
              {onExport && (
                <Tooltip title="Export">
                  <IconButton onClick={() => onExport(clip)}>
                    <Save />
                  </IconButton>
                </Tooltip>
              )}
            </ButtonGroup>
          </>
        )}
      </Box>

      {/* Timeline content */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Ruler */}
        <Box
          sx={{
            height: RULER_HEIGHT,
            display: 'flex',
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Box
            sx={{
              width: TRACK_HEADER_WIDTH,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper'
            }}
          />
          <Box sx={{ flex: 1, position: 'relative' }}>
            <canvas
              ref={rulerRef}
              width={timelineRef.current?.clientWidth || 800}
              height={RULER_HEIGHT}
              style={{
                display: 'block',
                width: '100%',
                height: '100%'
              }}
            />
          </Box>
        </Box>

        {/* Tracks */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            overflow: 'auto'
          }}
        >
          {/* Track headers */}
          <Box
            sx={{
              width: TRACK_HEADER_WIDTH,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden'
            }}
          >
            {clip.tracks.map(track => {
              const state = trackStates.get(track.id) || {
                id: track.id,
                expanded: true,
                height: TRACK_HEIGHT,
                locked: false,
                visible: true,
                muted: false
              };
              return (
                <React.Fragment key={track.id}>
                  {renderTrackHeader(track, state)}
                </React.Fragment>
              );
            })}
            
            {/* Add track button */}
            <Box
              sx={{
                height: TRACK_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderTop: 1,
                borderColor: 'divider'
              }}
            >
              <Button
                size="small"
                startIcon={<Add />}
                onClick={addTrack}
              >
                Add Track
              </Button>
            </Box>
          </Box>

          {/* Track content */}
          <Box
            ref={timelineRef}
            sx={{
              flex: 1,
              position: 'relative',
              overflow: 'auto'
            }}
            onClick={handleTimelineClick}
          >
            {clip.tracks.map(track => {
              const state = trackStates.get(track.id) || {
                id: track.id,
                expanded: true,
                height: TRACK_HEIGHT,
                locked: false,
                visible: true,
                muted: false
              };
              return (
                <React.Fragment key={track.id}>
                  {renderTrackContent(track, state)}
                </React.Fragment>
              );
            })}

            {/* Playhead */}
            {renderPlayhead()}
          </Box>
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        {contextMenu?.keyframeIndex !== undefined ? (
          <>
            <MenuItem onClick={() => {
              if (contextMenu.trackId && contextMenu.keyframeIndex !== undefined) {
                setCurveEditor({
                  visible: true,
                  trackId: contextMenu.trackId,
                  keyframeIndex: contextMenu.keyframeIndex,
                  curveType: 'value'
                });
              }
              handleCloseContextMenu();
            }}>
              Edit Value
            </MenuItem>
            <MenuItem onClick={() => {
              if (contextMenu.trackId && contextMenu.keyframeIndex !== undefined) {
                setCurveEditor({
                  visible: true,
                  trackId: contextMenu.trackId,
                  keyframeIndex: contextMenu.keyframeIndex,
                  curveType: 'easing'
                });
              }
              handleCloseContextMenu();
            }}>
              Edit Easing
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => {
              copyKeyframes();
              handleCloseContextMenu();
            }}>
              Copy
            </MenuItem>
            <MenuItem onClick={() => {
              if (contextMenu.trackId && contextMenu.keyframeIndex !== undefined) {
                deleteKeyframe(contextMenu.trackId, contextMenu.keyframeIndex);
              }
              handleCloseContextMenu();
            }}>
              Delete
            </MenuItem>
          </>
        ) : contextMenu?.trackId ? (
          <>
            <MenuItem onClick={() => {
              if (contextMenu.trackId) {
                // Open track properties
              }
              handleCloseContextMenu();
            }}>
              Track Properties
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => {
              if (contextMenu.trackId) {
                deleteTrack(contextMenu.trackId);
              }
              handleCloseContextMenu();
            }}>
              Delete Track
            </MenuItem>
          </>
        ) : null}
      </Menu>

      {/* Curve Editor Dialog */}
      <Popover
        open={curveEditor.visible}
        onClose={() => setCurveEditor({ visible: false, curveType: 'value' })}
        anchorOrigin={{ vertical: 'center', horizontal: 'center' }}
        transformOrigin={{ vertical: 'center', horizontal: 'center' }}
      >
        <Box sx={{ p: 2, minWidth: 300 }}>
          <Typography variant="h6" gutterBottom>
            Edit {curveEditor.curveType === 'value' ? 'Value' : 'Easing'}
          </Typography>
          
          {curveEditor.curveType === 'easing' && curveEditor.trackId && curveEditor.keyframeIndex !== undefined && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Easing Function</InputLabel>
              <Select
                value={
                  clip.tracks.find(t => t.id === curveEditor.trackId)
                    ?.keyframes[curveEditor.keyframeIndex]?.easing || 'linear'
                }
                onChange={(e) => {
                  if (curveEditor.trackId && curveEditor.keyframeIndex !== undefined) {
                    updateKeyframe(
                      curveEditor.trackId,
                      curveEditor.keyframeIndex,
                      { easing: e.target.value as EasingFunction }
                    );
                  }
                }}
              >
                {EASING_PRESETS.map(preset => (
                  <MenuItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setCurveEditor({ visible: false, curveType: 'value' })}>
              Close
            </Button>
          </Box>
        </Box>
      </Popover>
    </Paper>
  );
};

export default TimelineEditor;