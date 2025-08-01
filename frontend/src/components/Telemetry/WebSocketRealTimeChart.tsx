/**
 * WebSocketRealTimeChart - Enhanced real-time chart that integrates with WebSocket telemetry streams
 * Extends RealTimeChart with automatic data subscription and real-time updates
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  FormControl,
  InputLabel,
  Select,
  Switch,
  FormControlLabel,
  Button,
  Badge
} from '@mui/material';
import {
  Pause,
  PlayArrow,
  Settings,
  Analytics,
  Speed,
  Memory,
  SignalCellularAlt,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  Timeline,
  Refresh,
  SaveAlt,
  BugReport,
  Psychology,
  TrendingUp,
  Assessment,
  Cable,
  Stream
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { EnhancedRealTimeChart } from './EnhancedRealTimeChart';
import { 
  telemetryStreamManager, 
  StreamChannel,
  StreamAnalysisConfig 
} from '../../services/telemetry/TelemetryStreamManager';
import { 
  TelemetryDataPoint, 
  StreamQuality,
  TelemetryStreamConfig 
} from '../../types/telemetry';

/**
 * Component props
 */
interface WebSocketRealTimeChartProps {
  streamId: string;
  title?: string;
  height?: number;
  showControls?: boolean;
  showAnalysisResults?: boolean;
  analysisConfig?: Partial<StreamAnalysisConfig>;
  onDataReceived?: (data: TelemetryDataPoint) => void;
  onAnalysisResult?: (result: any) => void;
  className?: string;
}

/**
 * Styled components
 */
const ChartContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}));

const ChartHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default
}));

const ChartContent = styled(Box)(({ theme }) => ({
  flex: 1,
  position: 'relative',
  overflow: 'hidden'
}));

const StatusChip = styled(Chip)<{ quality?: StreamQuality }>(({ theme, quality }) => ({
  height: 24,
  fontSize: '0.75rem',
  borderColor: 
    quality === StreamQuality.Good ? theme.palette.success.main :
    quality === StreamQuality.Fair ? theme.palette.warning.main :
    quality === StreamQuality.Poor ? theme.palette.error.main :
    theme.palette.grey[500]
}));

const AnalysisIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  zIndex: 10,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.5, 1),
  boxShadow: theme.shadows[2]
}));

const ControlsPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  borderTop: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default
}));

/**
 * WebSocketRealTimeChart component
 */
export const WebSocketRealTimeChart: React.FC<WebSocketRealTimeChartProps> = ({
  streamId,
  title,
  height = 400,
  showControls = true,
  showAnalysisResults = true,
  analysisConfig,
  onDataReceived,
  onAnalysisResult,
  className
}) => {
  // State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [streamHealth, setStreamHealth] = useState<any>(null);
  const [streamStats, setStreamStats] = useState<any>(null);
  const [chartData, setChartData] = useState<TelemetryDataPoint[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [updateRate, setUpdateRate] = useState(1); // Hz
  const [bufferSize, setBufferSize] = useState(1000);
  const [showRawData, setShowRawData] = useState(false);
  
  const dataBufferRef = useRef<TelemetryDataPoint[]>([]);
  const lastUpdateRef = useRef<number>(0);

  /**
   * Subscribe to stream on mount
   */
  useEffect(() => {
    const subscribeToStream = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get channel info
        const channels = telemetryStreamManager.getAvailableChannels();
        const streamChannel = channels.find(ch => ch.id === streamId);
        
        if (!streamChannel) {
          throw new Error(`Stream ${streamId} not found`);
        }
        
        setChannel(streamChannel);

        // Subscribe to stream
        const config: Partial<TelemetryStreamConfig> = {
          bufferSize,
          frequency: updateRate
        };

        const fullAnalysisConfig: StreamAnalysisConfig = {
          enableStatistics: true,
          enableAnomalyDetection: false,
          enableCorrelation: false,
          enableTrendAnalysis: false,
          enablePredictions: false,
          enableDriftDetection: false,
          ...analysisConfig
        };

        await telemetryStreamManager.subscribe(streamId, config, fullAnalysisConfig);
        setIsSubscribed(true);

      } catch (err) {
        console.error('Failed to subscribe to stream:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    subscribeToStream();

    // Cleanup on unmount
    return () => {
      if (isSubscribed) {
        telemetryStreamManager.unsubscribe(streamId).catch(console.error);
      }
    };
  }, [streamId, updateRate, bufferSize, analysisConfig]);

  /**
   * Listen for stream data and health updates
   */
  useEffect(() => {
    if (!isSubscribed) return;

    const handleStreamData = (receivedStreamId: string, data: TelemetryDataPoint) => {
      if (receivedStreamId !== streamId || isPaused) return;

      // Add to buffer
      dataBufferRef.current.push(data);
      if (dataBufferRef.current.length > bufferSize) {
        dataBufferRef.current = dataBufferRef.current.slice(-bufferSize);
      }

      // Update chart at specified rate
      const now = Date.now();
      if (now - lastUpdateRef.current >= 1000 / updateRate) {
        setChartData([...dataBufferRef.current]);
        lastUpdateRef.current = now;
      }

      // Callback
      onDataReceived?.(data);
    };

    const handleStreamHealth = (health: any) => {
      if (health.streamId === streamId) {
        setStreamHealth(health);
      }
    };

    const handleAnalysisResult = (receivedStreamId: string, result: any) => {
      if (receivedStreamId !== streamId) return;

      setAnalysisResults(prev => ({
        ...prev,
        [result.type]: result.result
      }));

      onAnalysisResult?.(result);
    };

    // Subscribe to events
    telemetryStreamManager.on('stream:data', handleStreamData);
    telemetryStreamManager.on('stream:health', handleStreamHealth);
    telemetryStreamManager.on('analysis:result', handleAnalysisResult);

    // Update stats periodically
    const statsInterval = setInterval(() => {
      const stats = telemetryStreamManager.getStreamStatistics(streamId);
      setStreamStats(stats);
    }, 1000);

    return () => {
      telemetryStreamManager.off('stream:data', handleStreamData);
      telemetryStreamManager.off('stream:health', handleStreamHealth);
      telemetryStreamManager.off('analysis:result', handleAnalysisResult);
      clearInterval(statsInterval);
    };
  }, [streamId, isSubscribed, isPaused, updateRate, bufferSize, onDataReceived, onAnalysisResult]);

  /**
   * Handle pause/resume
   */
  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    dataBufferRef.current = [];
    setChartData([]);
    setAnalysisResults({});
  };

  /**
   * Handle settings menu
   */
  const handleSettingsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setSettingsAnchor(event.currentTarget);
  };

  const handleSettingsClose = () => {
    setSettingsAnchor(null);
  };

  /**
   * Handle export
   */
  const handleExport = () => {
    // Export current data
    const exportData = {
      streamId,
      channel: channel?.name,
      timestamp: new Date().toISOString(),
      dataPoints: chartData.length,
      data: chartData,
      statistics: streamStats,
      analysisResults
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${streamId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Get status color
   */
  const getStatusColor = () => {
    if (!streamHealth) return 'default';
    if (streamHealth.status === 'healthy') return 'success';
    if (streamHealth.status === 'degraded') return 'warning';
    return 'error';
  };

  /**
   * Render analysis indicators
   */
  const renderAnalysisIndicators = () => {
    if (!showAnalysisResults || !analysisResults) return null;

    const indicators = [];

    if (analysisResults.anomaly) {
      const count = analysisResults.anomaly.anomalies?.length || 0;
      if (count > 0) {
        indicators.push(
          <Tooltip key="anomaly" title={`${count} anomalies detected`}>
            <Badge badgeContent={count} color="warning">
              <BugReport fontSize="small" />
            </Badge>
          </Tooltip>
        );
      }
    }

    if (analysisResults.drift?.isDrift) {
      indicators.push(
        <Tooltip key="drift" title="Drift detected">
          <TrendingUp fontSize="small" color="warning" />
        </Tooltip>
      );
    }

    if (analysisResults.prediction) {
      indicators.push(
        <Tooltip key="prediction" title="Predictions available">
          <Psychology fontSize="small" color="primary" />
        </Tooltip>
      );
    }

    if (analysisResults.correlation && analysisResults.correlation.length > 0) {
      indicators.push(
        <Tooltip key="correlation" title={`${analysisResults.correlation.length} correlations`}>
          <Badge badgeContent={analysisResults.correlation.length} color="primary">
            <Timeline fontSize="small" />
          </Badge>
        </Tooltip>
      );
    }

    return indicators.length > 0 ? (
      <AnalysisIndicator>
        <Stack direction="row" spacing={1}>
          {indicators}
        </Stack>
      </AnalysisIndicator>
    ) : null;
  };

  if (loading) {
    return (
      <ChartContainer className={className} sx={{ height }}>
        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
          <CircularProgress />
        </Box>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer className={className} sx={{ height }}>
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer className={className} sx={{ height }}>
      <ChartHeader>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              {title || channel?.name || streamId}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusChip
                icon={<Cable />}
                label={streamId}
                size="small"
                variant="outlined"
                quality={streamHealth?.quality}
              />
              {streamHealth && (
                <StatusChip
                  icon={<SignalCellularAlt />}
                  label={`${streamHealth.latency}ms`}
                  size="small"
                  color={getStatusColor()}
                />
              )}
              {streamStats && (
                <StatusChip
                  icon={<Speed />}
                  label={`${streamStats.dataRate?.toFixed(1) || 0} Hz`}
                  size="small"
                />
              )}
              {streamStats && (
                <StatusChip
                  icon={<Memory />}
                  label={`${streamStats.bufferUsage?.toFixed(0) || 0}%`}
                  size="small"
                />
              )}
            </Stack>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title={isPaused ? 'Resume' : 'Pause'}>
              <IconButton onClick={handlePauseResume}>
                {isPaused ? <PlayArrow /> : <Pause />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton onClick={handleExport}>
                <SaveAlt />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={handleSettingsOpen}>
                <Settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </ChartHeader>

      <ChartContent>
        {renderAnalysisIndicators()}
        
        <EnhancedRealTimeChart
          data={chartData}
          height={height - (showControls ? 120 : 80)}
          streamId={streamId}
          enableBrushSelection={true}
          onBrushSelection={(selection) => {
            console.log('Brush selection:', selection);
          }}
        />

        {showRawData && streamStats && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 1,
              backgroundColor: 'background.paper',
              borderTop: 1,
              borderColor: 'divider'
            }}
          >
            <Typography variant="caption" component="pre">
              Latest: {JSON.stringify(chartData[chartData.length - 1], null, 2)}
            </Typography>
          </Box>
        )}
      </ChartContent>

      {showControls && (
        <ControlsPanel>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Update Rate</InputLabel>
              <Select
                value={updateRate}
                label="Update Rate"
                onChange={(e) => setUpdateRate(Number(e.target.value))}
              >
                <MenuItem value={0.1}>0.1 Hz</MenuItem>
                <MenuItem value={0.5}>0.5 Hz</MenuItem>
                <MenuItem value={1}>1 Hz</MenuItem>
                <MenuItem value={5}>5 Hz</MenuItem>
                <MenuItem value={10}>10 Hz</MenuItem>
                <MenuItem value={30}>30 Hz</MenuItem>
                <MenuItem value={60}>60 Hz</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={showRawData}
                  onChange={(e) => setShowRawData(e.target.checked)}
                  size="small"
                />
              }
              label="Show Raw Data"
            />

            <Box flex={1} />

            <Typography variant="caption" color="text.secondary">
              {chartData.length} points • Buffer: {bufferSize}
            </Typography>
          </Stack>
        </ControlsPanel>
      )}

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={handleSettingsClose}
      >
        <MenuItem>
          <ListItemIcon>
            <Analytics fontSize="small" />
          </ListItemIcon>
          <ListItemText>Configure Analysis</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <Stream fontSize="small" />
          </ListItemIcon>
          <ListItemText>Stream Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem>
          <ListItemIcon>
            <Assessment fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Full Report</ListItemText>
        </MenuItem>
      </Menu>
    </ChartContainer>
  );
};

export default WebSocketRealTimeChart;