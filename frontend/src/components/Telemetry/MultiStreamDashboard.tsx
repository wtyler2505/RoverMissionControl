/**
 * MultiStreamDashboard - Dashboard for visualizing multiple real-time streams
 * Supports synchronized time axes, flexible layouts, and stream management
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  IconButton,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Tooltip,
  Badge,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Fade,
  Zoom,
  alpha,
  SelectChangeEvent
} from '@mui/material';
import {
  Add,
  Remove,
  GridView,
  ViewList,
  ViewModule,
  Layers,
  Settings,
  Save,
  Download,
  Upload,
  Refresh,
  Sync,
  SyncDisabled,
  Height,
  Fullscreen,
  FullscreenExit,
  RecordVoiceOver,
  FiberManualRecord,
  Stop,
  PlayArrow,
  Pause,
  Screenshot,
  VideoCameraBack,
  Share,
  Close,
  Warning,
  CheckCircle
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { RealTimeStreamChart } from './RealTimeStreamChart';
import { StreamSelector } from './StreamSelector';
import { useTelemetry } from './TelemetryProvider';
import {
  MultiStreamLayout,
  StreamingBufferConfig,
  StreamRenderConfig,
  StreamingIndicatorStatus,
  StreamGroup,
  StreamRecordingConfig,
  StreamExportOptions
} from '../../types/streaming';
import { TelemetryStreamConfig, TelemetryDataType } from '../../services/websocket/TelemetryManager';

/**
 * Props for MultiStreamDashboard
 */
export interface MultiStreamDashboardProps {
  initialStreams?: string[];
  layout?: MultiStreamLayout;
  height?: number;
  onStreamSelect?: (streamIds: string[]) => void;
  onExport?: (options: StreamExportOptions) => void;
  showControls?: boolean;
  showRecording?: boolean;
}

/**
 * Styled components
 */
const DashboardContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden'
}));

const HeaderBar = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  borderRadius: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${theme.palette.divider}`
}));

const StreamGrid = styled(Box)<{ $layout: string }>(({ theme, $layout }) => ({
  padding: theme.spacing(2),
  display: $layout === 'grid' ? 'grid' : 'flex',
  gridTemplateColumns: $layout === 'grid' ? 'repeat(auto-fit, minmax(400px, 1fr))' : undefined,
  flexDirection: $layout === 'stack' ? 'column' : 'row',
  gap: theme.spacing(2),
  height: '100%',
  overflow: 'auto'
}));

const StreamCard = styled(Paper)<{ $highlighted?: boolean }>(({ theme, $highlighted }) => ({
  position: 'relative',
  border: `2px solid ${$highlighted ? theme.palette.primary.main : 'transparent'}`,
  transition: 'all 0.3s ease',
  '&:hover': {
    boxShadow: theme.shadows[4]
  }
}));

const StreamOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  right: 0,
  padding: theme.spacing(0.5),
  display: 'flex',
  gap: theme.spacing(0.5),
  opacity: 0,
  transition: 'opacity 0.3s ease',
  '.MuiPaper-root:hover &': {
    opacity: 1
  }
}));

const RecordingIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(2),
  left: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  backgroundColor: alpha(theme.palette.error.main, 0.9),
  color: theme.palette.common.white,
  borderRadius: theme.shape.borderRadius,
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%': { opacity: 0.8 },
    '50%': { opacity: 1 },
    '100%': { opacity: 0.8 }
  }
}));

const StatusBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  fontSize: '0.875rem'
}));

/**
 * Default configurations
 */
const DEFAULT_BUFFER_CONFIG: StreamingBufferConfig = {
  capacity: 10000,
  windowSize: 60000, // 1 minute
  updateInterval: 50, // 20 Hz
  interpolation: 'linear',
  compressionThreshold: 5000
};

const DEFAULT_RENDER_CONFIG: StreamRenderConfig = {
  color: '#2196f3',
  lineWidth: 2,
  opacity: 1,
  showPoints: false,
  animated: true,
  glowEffect: true
};

const STREAM_COLORS = [
  '#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0',
  '#00bcd4', '#8bc34a', '#ff5722', '#673ab7', '#009688'
];

/**
 * Stream configuration dialog
 */
const StreamConfigDialog: React.FC<{
  open: boolean;
  stream: TelemetryStreamConfig | null;
  renderConfig: StreamRenderConfig;
  onClose: () => void;
  onSave: (renderConfig: StreamRenderConfig) => void;
}> = ({ open, stream, renderConfig, onClose, onSave }) => {
  const [config, setConfig] = useState(renderConfig);
  
  useEffect(() => {
    setConfig(renderConfig);
  }, [renderConfig]);
  
  const handleSave = () => {
    onSave(config);
    onClose();
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Stream Configuration
        {stream && (
          <Typography variant="body2" color="text.secondary">
            {stream.name} ({stream.streamId})
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Color"
            type="color"
            value={config.color}
            onChange={(e) => setConfig({ ...config, color: e.target.value })}
            fullWidth
          />
          
          <TextField
            label="Line Width"
            type="number"
            value={config.lineWidth}
            onChange={(e) => setConfig({ ...config, lineWidth: Number(e.target.value) })}
            inputProps={{ min: 1, max: 10 }}
            fullWidth
          />
          
          <TextField
            label="Opacity"
            type="number"
            value={config.opacity}
            onChange={(e) => setConfig({ ...config, opacity: Number(e.target.value) })}
            inputProps={{ min: 0, max: 1, step: 0.1 }}
            fullWidth
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={config.showPoints || false}
                onChange={(e) => setConfig({ ...config, showPoints: e.target.checked })}
              />
            }
            label="Show Points"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={config.animated || false}
                onChange={(e) => setConfig({ ...config, animated: e.target.checked })}
              />
            }
            label="Animated"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={config.glowEffect || false}
                onChange={(e) => setConfig({ ...config, glowEffect: e.target.checked })}
              />
            }
            label="Glow Effect"
          />
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * MultiStreamDashboard component
 */
export const MultiStreamDashboard: React.FC<MultiStreamDashboardProps> = ({
  initialStreams = [],
  layout: initialLayout = { type: 'grid' },
  height = 600,
  onStreamSelect,
  onExport,
  showControls = true,
  showRecording = true
}) => {
  const { availableStreams, subscribe, unsubscribe } = useTelemetry();
  const [selectedStreams, setSelectedStreams] = useState<string[]>(initialStreams);
  const [layout, setLayout] = useState<MultiStreamLayout>(initialLayout);
  const [syncTime, setSyncTime] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedStreamConfig, setSelectedStreamConfig] = useState<TelemetryStreamConfig | null>(null);
  const [streamRenderConfigs, setStreamRenderConfigs] = useState<Map<string, StreamRenderConfig>>(new Map());
  const [streamStatuses, setStreamStatuses] = useState<Map<string, StreamingIndicatorStatus>>(new Map());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Initialize render configs for streams
  useEffect(() => {
    const configs = new Map<string, StreamRenderConfig>();
    selectedStreams.forEach((streamId, index) => {
      if (!streamRenderConfigs.has(streamId)) {
        configs.set(streamId, {
          ...DEFAULT_RENDER_CONFIG,
          color: STREAM_COLORS[index % STREAM_COLORS.length]
        });
      } else {
        configs.set(streamId, streamRenderConfigs.get(streamId)!);
      }
    });
    setStreamRenderConfigs(configs);
  }, [selectedStreams]);
  
  // Get active stream configurations
  const activeStreamConfigs = useMemo(() => {
    return selectedStreams
      .map(id => availableStreams.find(s => s.streamId === id))
      .filter(Boolean) as TelemetryStreamConfig[];
  }, [selectedStreams, availableStreams]);
  
  // Handle stream selection
  const handleStreamToggle = useCallback(async (streamId: string) => {
    if (selectedStreams.includes(streamId)) {
      // Remove stream
      setSelectedStreams(prev => prev.filter(id => id !== streamId));
      await unsubscribe(streamId);
    } else {
      // Add stream
      const streamConfig = availableStreams.find(s => s.streamId === streamId);
      if (streamConfig) {
        setSelectedStreams(prev => [...prev, streamId]);
        await subscribe(streamConfig);
      }
    }
  }, [selectedStreams, availableStreams, subscribe, unsubscribe]);
  
  // Handle stream configuration
  const handleStreamConfig = (streamId: string) => {
    const config = availableStreams.find(s => s.streamId === streamId);
    if (config) {
      setSelectedStreamConfig(config);
      setConfigDialogOpen(true);
    }
  };
  
  // Handle render config save
  const handleRenderConfigSave = (renderConfig: StreamRenderConfig) => {
    if (selectedStreamConfig) {
      setStreamRenderConfigs(prev => new Map(prev).set(selectedStreamConfig.streamId, renderConfig));
    }
  };
  
  // Handle layout change
  const handleLayoutChange = (newLayout: MultiStreamLayout['type']) => {
    setLayout({ ...layout, type: newLayout });
  };
  
  // Handle fullscreen
  const handleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };
  
  // Handle recording
  const handleRecordingToggle = () => {
    setIsRecording(prev => !prev);
    // TODO: Implement actual recording logic
  };
  
  // Handle export
  const handleExport = (format: StreamExportOptions['format']) => {
    if (onExport) {
      onExport({
        format,
        quality: 'high',
        includeOverlays: true,
        includeStats: true
      });
    }
  };
  
  // Calculate stream health
  const overallHealth = useMemo(() => {
    if (streamStatuses.size === 0) return { status: 'unknown', quality: 0 };
    
    let totalQuality = 0;
    let errorCount = 0;
    
    streamStatuses.forEach(status => {
      totalQuality += status.quality;
      if (status.status === 'error' || status.status === 'offline') {
        errorCount++;
      }
    });
    
    const avgQuality = totalQuality / streamStatuses.size;
    const status = errorCount > 0 ? 'degraded' : avgQuality > 0.9 ? 'healthy' : 'warning';
    
    return { status, quality: avgQuality };
  }, [streamStatuses]);
  
  // Handle status updates
  const handleStatusUpdate = useCallback((status: StreamingIndicatorStatus) => {
    setStreamStatuses(prev => new Map(prev).set(status.streamId, status));
  }, []);
  
  return (
    <DashboardContainer ref={containerRef} sx={{ height }}>
      {showControls && (
        <HeaderBar elevation={0}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h6">Multi-Stream Dashboard</Typography>
            
            <Chip
              size="small"
              label={`${selectedStreams.length} streams`}
              color="primary"
              variant="outlined"
            />
            
            <Chip
              size="small"
              icon={overallHealth.status === 'healthy' ? <CheckCircle /> : <Warning />}
              label={`${(overallHealth.quality * 100).toFixed(0)}% health`}
              color={overallHealth.status === 'healthy' ? 'success' : 'warning'}
              variant="outlined"
            />
          </Stack>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={syncTime}
                  onChange={(e) => setSyncTime(e.target.checked)}
                />
              }
              label="Sync Time"
            />
            
            <Divider orientation="vertical" flexItem />
            
            <Tooltip title="Grid Layout">
              <IconButton
                size="small"
                onClick={() => handleLayoutChange('grid')}
                color={layout.type === 'grid' ? 'primary' : 'default'}
              >
                <GridView />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Stack Layout">
              <IconButton
                size="small"
                onClick={() => handleLayoutChange('stack')}
                color={layout.type === 'stack' ? 'primary' : 'default'}
              >
                <ViewList />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Overlay Layout">
              <IconButton
                size="small"
                onClick={() => handleLayoutChange('overlay')}
                color={layout.type === 'overlay' ? 'primary' : 'default'}
              >
                <Layers />
              </IconButton>
            </Tooltip>
            
            <Divider orientation="vertical" flexItem />
            
            <Tooltip title="Add Stream">
              <IconButton
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                <Add />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              <IconButton size="small" onClick={handleFullscreen}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton size="small">
                <Settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </HeaderBar>
      )}
      
      {isRecording && (
        <RecordingIndicator>
          <FiberManualRecord fontSize="small" />
          <Typography variant="caption">Recording...</Typography>
        </RecordingIndicator>
      )}
      
      <StreamGrid $layout={layout.type}>
        {activeStreamConfigs.map((streamConfig) => (
          <StreamCard key={streamConfig.streamId} elevation={1}>
            <RealTimeStreamChart
              streamId={streamConfig.streamId}
              streamName={streamConfig.name}
              bufferConfig={DEFAULT_BUFFER_CONFIG}
              renderConfig={streamRenderConfigs.get(streamConfig.streamId) || DEFAULT_RENDER_CONFIG}
              height={layout.type === 'stack' ? 200 : 300}
              showStats={true}
              showIndicators={true}
              onStatusChange={handleStatusUpdate}
            />
            
            <StreamOverlay>
              <Tooltip title="Configure">
                <IconButton
                  size="small"
                  onClick={() => handleStreamConfig(streamConfig.streamId)}
                >
                  <Settings fontSize="small" />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  onClick={() => handleStreamToggle(streamConfig.streamId)}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Tooltip>
            </StreamOverlay>
          </StreamCard>
        ))}
        
        {selectedStreams.length === 0 && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            height="100%"
            color="text.secondary"
          >
            <Stack spacing={2} alignItems="center">
              <Typography variant="h6">No streams selected</Typography>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                Add Stream
              </Button>
            </Stack>
          </Box>
        )}
      </StreamGrid>
      
      {showControls && (
        <StatusBar>
          <Typography variant="body2" color="text.secondary">
            Update Rate: 20 Hz
          </Typography>
          <Typography variant="body2" color="text.secondary">
            •
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Window: 60s
          </Typography>
          <Typography variant="body2" color="text.secondary">
            •
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Buffer: 10K points/stream
          </Typography>
        </StatusBar>
      )}
      
      {/* Stream selection menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Available Streams</Typography>
        </MenuItem>
        <Divider />
        {availableStreams
          .filter(s => s.dataType === TelemetryDataType.NUMERIC)
          .map((stream) => (
            <MenuItem
              key={stream.streamId}
              onClick={() => {
                handleStreamToggle(stream.streamId);
                setAnchorEl(null);
              }}
              disabled={selectedStreams.includes(stream.streamId)}
            >
              <ListItemIcon>
                {selectedStreams.includes(stream.streamId) && <CheckCircle />}
              </ListItemIcon>
              <ListItemText
                primary={stream.name}
                secondary={`${stream.streamId} • ${stream.units || 'units'}`}
              />
            </MenuItem>
          ))}
      </Menu>
      
      {/* Stream config dialog */}
      <StreamConfigDialog
        open={configDialogOpen}
        stream={selectedStreamConfig}
        renderConfig={
          selectedStreamConfig
            ? streamRenderConfigs.get(selectedStreamConfig.streamId) || DEFAULT_RENDER_CONFIG
            : DEFAULT_RENDER_CONFIG
        }
        onClose={() => {
          setConfigDialogOpen(false);
          setSelectedStreamConfig(null);
        }}
        onSave={handleRenderConfigSave}
      />
      
      {/* Floating action buttons */}
      {showRecording && (
        <SpeedDial
          ariaLabel="Recording actions"
          sx={{ position: 'absolute', bottom: 80, right: 16 }}
          icon={<SpeedDialIcon icon={<VideoCameraBack />} openIcon={<Close />} />}
        >
          <SpeedDialAction
            icon={isRecording ? <Stop /> : <FiberManualRecord />}
            tooltipTitle={isRecording ? 'Stop Recording' : 'Start Recording'}
            onClick={handleRecordingToggle}
          />
          <SpeedDialAction
            icon={<Screenshot />}
            tooltipTitle="Screenshot"
            onClick={() => handleExport('image_sequence')}
          />
          <SpeedDialAction
            icon={<Download />}
            tooltipTitle="Export Data"
            onClick={() => handleExport('data')}
          />
          <SpeedDialAction
            icon={<Share />}
            tooltipTitle="Share"
            onClick={() => {}}
          />
        </SpeedDial>
      )}
    </DashboardContainer>
  );
};

export default MultiStreamDashboard;