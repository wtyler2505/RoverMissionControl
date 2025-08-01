/**
 * Example usage of TelemetryProvider and related hooks
 * This demonstrates how to integrate telemetry functionality in your application
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Alert,
  Card,
  CardContent,
  CardActions,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  FiberManualRecord as RecordIcon,
  SignalCellular4Bar as SignalIcon,
  SignalCellularConnectedNoInternet0Bar as NoSignalIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import {
  TelemetryProvider,
  useTelemetry,
  useRealTimeTelemetry,
  useTelemetryStatistics,
  useTelemetryRecording,
  useTelemetryHealth,
  useTelemetryAlerts,
  useTelemetryExport
} from './';
import { TelemetryDataType } from '../../services/websocket/TelemetryManager';
import RealTimeChart from './RealTimeChart';

/**
 * Example telemetry stream component
 */
const TelemetryStreamCard: React.FC<{ streamId: string }> = ({ streamId }) => {
  const { data, stats, health, isActive, isPaused, pause, resume, clear } = useRealTimeTelemetry(streamId, {
    name: `${streamId} Stream`,
    dataType: TelemetryDataType.NUMERIC,
    bufferSize: 500,
    units: 'm/s'
  });

  const statistics = useTelemetryStatistics(streamId, 30); // 30 second window
  const { exportToFile, isExporting } = useTelemetryExport();

  const handleExport = async () => {
    try {
      await exportToFile(streamId, 'json');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getHealthIcon = () => {
    if (!health) return <NoSignalIcon color="disabled" />;
    switch (health.status) {
      case 'healthy':
        return <SignalIcon color="success" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'error':
      case 'offline':
        return <NoSignalIcon color="error" />;
      default:
        return <SignalIcon color="disabled" />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">{streamId}</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Tooltip title={health?.status || 'Unknown'}>
              {getHealthIcon()}
            </Tooltip>
            <Chip
              label={isActive ? 'Active' : 'Inactive'}
              color={isActive ? 'success' : 'default'}
              size="small"
            />
          </Box>
        </Box>

        {/* Statistics */}
        <Grid container spacing={2} mb={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="textSecondary">Current</Typography>
            <Typography variant="body2">{statistics.current.toFixed(2)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="textSecondary">Average</Typography>
            <Typography variant="body2">{statistics.average.toFixed(2)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="textSecondary">Min/Max</Typography>
            <Typography variant="body2">
              {statistics.min.toFixed(2)} / {statistics.max.toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="textSecondary">Rate</Typography>
            <Typography variant="body2">{statistics.rate.toFixed(1)} Hz</Typography>
          </Grid>
        </Grid>

        {/* Stream stats */}
        {stats && (
          <Box mb={2}>
            <Typography variant="caption" color="textSecondary">
              Buffer: {stats.bufferUtilization * 100}% | 
              Quality: {(stats.dataQuality * 100).toFixed(0)}% |
              Dropped: {stats.droppedPoints}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={stats.bufferUtilization * 100} 
              sx={{ mt: 0.5 }}
            />
          </Box>
        )}

        {/* Mini chart preview */}
        {data.length > 0 && (
          <Box height={100} mb={2}>
            <RealTimeChart
              data={[{
                id: streamId,
                data: data.map(p => ({
                  timestamp: p.timestamp,
                  value: typeof p.value === 'number' ? p.value : 0
                })),
                color: '#1976d2',
                name: streamId
              }]}
              options={{
                height: 100,
                timeWindow: 30000,
                showGrid: false,
                showAxes: false,
                showLegend: false
              }}
            />
          </Box>
        )}
      </CardContent>
      
      <CardActions>
        {isActive && !isPaused ? (
          <IconButton onClick={pause} size="small">
            <PauseIcon />
          </IconButton>
        ) : (
          <IconButton onClick={resume} size="small">
            <PlayIcon />
          </IconButton>
        )}
        <IconButton onClick={clear} size="small">
          <StopIcon />
        </IconButton>
        <IconButton onClick={handleExport} disabled={isExporting} size="small">
          <DownloadIcon />
        </IconButton>
      </CardActions>
    </Card>
  );
};

/**
 * Recording controls component
 */
const RecordingControls: React.FC = () => {
  const { 
    session, 
    isRecording, 
    canRecord, 
    startRecording, 
    stopRecording, 
    exportRecording,
    activeStreamIds 
  } = useTelemetryRecording();

  const handleStartRecording = () => {
    if (canRecord) {
      startRecording(activeStreamIds);
    }
  };

  const handleExportRecording = async () => {
    try {
      const blob = await exportRecording('json');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording_${session?.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Recording</Typography>
        {isRecording && <RecordIcon color="error" />}
      </Box>

      {session ? (
        <Box>
          <Typography variant="body2" gutterBottom>
            Status: {session.status}
          </Typography>
          <Typography variant="body2" gutterBottom>
            Duration: {((Date.now() - session.startTime) / 1000).toFixed(0)}s
          </Typography>
          <Typography variant="body2" gutterBottom>
            Data Points: {session.dataPoints}
          </Typography>
          <Typography variant="body2" gutterBottom>
            Size: {(session.fileSize / 1024 / 1024).toFixed(2)} MB
          </Typography>
          
          <Box mt={2}>
            {isRecording ? (
              <Button
                variant="contained"
                color="error"
                onClick={stopRecording}
                startIcon={<StopIcon />}
                fullWidth
              >
                Stop Recording
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleExportRecording}
                startIcon={<DownloadIcon />}
                fullWidth
              >
                Export Recording
              </Button>
            )}
          </Box>
        </Box>
      ) : (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            {canRecord 
              ? `Ready to record ${activeStreamIds.length} streams`
              : 'No active streams to record'
            }
          </Alert>
          <Button
            variant="contained"
            onClick={handleStartRecording}
            startIcon={<RecordIcon />}
            disabled={!canRecord}
            fullWidth
          >
            Start Recording
          </Button>
        </Box>
      )}
    </Paper>
  );
};

/**
 * Stream health overview component
 */
const StreamHealthOverview: React.FC = () => {
  const { 
    overallHealth, 
    streamHealth, 
    activeStreamsCount, 
    healthyStreamsCount 
  } = useTelemetryHealth();

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>System Health</Typography>
      
      <Box mb={2}>
        <Chip
          label={`Overall: ${overallHealth}`}
          color={getHealthColor(overallHealth) as any}
          sx={{ mb: 1 }}
        />
        <Typography variant="body2">
          {healthyStreamsCount} of {activeStreamsCount} streams healthy
        </Typography>
      </Box>

      <List dense>
        {Array.from(streamHealth.entries()).map(([streamId, health]) => (
          <ListItem key={streamId}>
            <ListItemIcon>
              <Chip
                size="small"
                color={getHealthColor(health.status) as any}
                label={health.status[0].toUpperCase()}
              />
            </ListItemIcon>
            <ListItemText
              primary={streamId}
              secondary={`Last update: ${new Date(health.lastUpdate).toLocaleTimeString()}`}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

/**
 * Alerts monitoring component
 */
const AlertsMonitor: React.FC = () => {
  const alerts = useTelemetryAlerts([
    {
      streamId: 'rover.velocity',
      condition: 'above',
      threshold: 5.0,
      message: 'Velocity exceeds safe limit'
    },
    {
      streamId: 'rover.battery',
      condition: 'below',
      threshold: 20.0,
      message: 'Low battery warning'
    },
    {
      streamId: 'rover.temperature',
      condition: 'above',
      threshold: 85.0,
      message: 'High temperature warning'
    }
  ]);

  if (alerts.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Alerts</Typography>
        <Alert severity="success">No active alerts</Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>Active Alerts</Typography>
      <List>
        {alerts.map(alert => (
          <ListItem key={alert.id}>
            <Alert severity="warning" sx={{ width: '100%' }}>
              {alert.message || `${alert.streamId} ${alert.condition} ${alert.threshold}`}
            </Alert>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

/**
 * Main example application
 */
const TelemetryExample: React.FC = () => {
  const { isConnected, refreshAvailableStreams, availableStreams } = useTelemetry();

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Telemetry Dashboard</Typography>
        <Box display="flex" gap={1}>
          <Chip
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
          />
          <IconButton onClick={refreshAvailableStreams}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Stream cards */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {['rover.velocity', 'rover.battery', 'rover.temperature'].map(streamId => (
              <Grid item xs={12} sm={6} key={streamId}>
                <TelemetryStreamCard streamId={streamId} />
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Control panels */}
        <Grid item xs={12} md={4}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <StreamHealthOverview />
            </Grid>
            <Grid item xs={12}>
              <RecordingControls />
            </Grid>
            <Grid item xs={12}>
              <AlertsMonitor />
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

/**
 * App wrapper with TelemetryProvider
 */
export const TelemetryExampleApp: React.FC = () => {
  return (
    <TelemetryProvider
      autoConnect={true}
      preferences={{
        defaultBufferSize: 1000,
        chartDefaults: {
          timeWindow: 60,
          refreshRate: 30,
          theme: 'dark'
        }
      }}
    >
      <TelemetryExample />
    </TelemetryProvider>
  );
};

export default TelemetryExampleApp;