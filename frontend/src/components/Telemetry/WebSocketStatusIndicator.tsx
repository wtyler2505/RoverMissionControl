/**
 * WebSocketStatusIndicator - Displays WebSocket connection status and health metrics
 * Shows connection state, protocol, latency, and stream health information
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Tooltip,
  IconButton,
  Collapse,
  Stack,
  LinearProgress,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  TextField,
  Switch,
  FormControlLabel,
  Grid
} from '@mui/material';
import {
  WifiTethering,
  WifiOff,
  SignalWifi4Bar,
  SignalWifi2Bar,
  SignalWifi1Bar,
  ExpandMore,
  ExpandLess,
  Settings,
  Refresh,
  Speed,
  DataUsage,
  Memory,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  Cable,
  Sync,
  SyncDisabled,
  NetworkCheck,
  Router
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { telemetryStreamManager } from '../../services/telemetry/TelemetryStreamManager';
import { BinaryProtocol, StreamQuality } from '../../types/telemetry';

/**
 * Connection status type
 */
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting' | 'error';

/**
 * Protocol info interface
 */
interface ProtocolInfo {
  current: BinaryProtocol;
  available: BinaryProtocol[];
  compressionEnabled: boolean;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
}

/**
 * Connection metrics interface
 */
interface ConnectionMetrics {
  latency: number;
  uptime: number;
  reconnectCount: number;
  errorCount: number;
  messageQueueSize: number;
  activeStreams: number;
  dataRate: number;
}

/**
 * Component props
 */
interface WebSocketStatusIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetails?: boolean;
  onSettingsClick?: () => void;
  className?: string;
}

/**
 * Styled components
 */
const StatusContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  minWidth: 300,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: 'all 0.3s ease'
}));

const StatusIcon = styled(Box)<{ status: ConnectionStatus }>(({ theme, status }) => ({
  display: 'flex',
  alignItems: 'center',
  color: status === 'connected' ? theme.palette.success.main :
         status === 'connecting' || status === 'reconnecting' ? theme.palette.warning.main :
         status === 'error' ? theme.palette.error.main :
         theme.palette.text.disabled
}));

const LatencyIndicator = styled(Box)<{ latency: number }>(({ theme, latency }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  color: latency < 50 ? theme.palette.success.main :
         latency < 100 ? theme.palette.warning.main :
         theme.palette.error.main
}));

const ProtocolChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem',
  backgroundColor: theme.palette.primary.dark,
  color: theme.palette.primary.contrastText
}));

const MetricItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}));

const StreamHealthIcon = styled(Box)<{ quality: StreamQuality }>(({ theme, quality }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: quality === StreamQuality.Good ? theme.palette.success.main :
                   quality === StreamQuality.Fair ? theme.palette.warning.main :
                   theme.palette.error.main
}));

/**
 * Helper function to get connection icon
 */
const getConnectionIcon = (status: ConnectionStatus, latency: number) => {
  if (status === 'disconnected' || status === 'error') {
    return <WifiOff />;
  }
  if (status === 'connecting' || status === 'reconnecting') {
    return <Sync className="rotating" />;
  }
  if (latency < 50) {
    return <SignalWifi4Bar />;
  }
  if (latency < 100) {
    return <SignalWifi2Bar />;
  }
  return <SignalWifi1Bar />;
};

/**
 * Helper function to format bytes
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Helper function to format uptime
 */
const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

/**
 * WebSocketStatusIndicator component
 */
export const WebSocketStatusIndicator: React.FC<WebSocketStatusIndicatorProps> = ({
  position = 'top-right',
  showDetails = false,
  onSettingsClick,
  className
}) => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [expanded, setExpanded] = useState(showDetails);
  const [protocol, setProtocol] = useState<ProtocolInfo>({
    current: BinaryProtocol.JSON,
    available: [BinaryProtocol.JSON],
    compressionEnabled: false,
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransferred: 0
  });
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    latency: 0,
    uptime: 0,
    reconnectCount: 0,
    errorCount: 0,
    messageQueueSize: 0,
    activeStreams: 0,
    dataRate: 0
  });
  const [streamHealth, setStreamHealth] = useState<any[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [protocolSettings, setProtocolSettings] = useState({
    autoSwitch: true,
    preferredProtocol: BinaryProtocol.MessagePack,
    compressionThreshold: 1024,
    heartbeatInterval: 30
  });

  /**
   * Update connection status
   */
  useEffect(() => {
    const updateStatus = () => {
      const connectionStatus = telemetryStreamManager.getConnectionStatus();
      
      // Update status based on connection
      if (connectionStatus.connected) {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }

      // Update protocol info
      setProtocol(prev => ({
        ...prev,
        current: connectionStatus.protocol,
        available: [BinaryProtocol.JSON, BinaryProtocol.MessagePack, BinaryProtocol.CBOR]
      }));

      // Update metrics
      setMetrics(prev => ({
        ...prev,
        latency: connectionStatus.latency,
        activeStreams: telemetryStreamManager.getActiveStreams().length
      }));

      // Update stream health
      const health = telemetryStreamManager.getStreamHealth();
      if (Array.isArray(health)) {
        setStreamHealth(health);
      }
    };

    // Initial update
    updateStatus();

    // Set up update interval
    const interval = setInterval(updateStatus, 1000);

    // Set up event listeners
    telemetryStreamManager.on('connection:status', (newStatus: string) => {
      setStatus(newStatus as ConnectionStatus);
    });

    telemetryStreamManager.on('protocol:switched', (from: BinaryProtocol, to: BinaryProtocol) => {
      setProtocol(prev => ({ ...prev, current: to }));
    });

    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * Handle menu open
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  /**
   * Handle menu close
   */
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  /**
   * Handle reconnect
   */
  const handleReconnect = async () => {
    try {
      await telemetryStreamManager.initialize();
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  };

  /**
   * Handle settings save
   */
  const handleSettingsSave = () => {
    // Apply protocol settings
    // This would typically update the protocol manager configuration
    setSettingsOpen(false);
  };

  /**
   * Get overall health status
   */
  const getOverallHealth = () => {
    if (status !== 'connected') return 'offline';
    
    const unhealthyStreams = streamHealth.filter(h => h.status !== 'healthy').length;
    if (unhealthyStreams === 0) return 'healthy';
    if (unhealthyStreams < streamHealth.length / 2) return 'degraded';
    return 'unhealthy';
  };

  const overallHealth = getOverallHealth();

  return (
    <>
      <StatusContainer className={className}>
        <StatusIcon status={status}>
          <Tooltip title={`Status: ${status}`}>
            <Box>{getConnectionIcon(status, metrics.latency)}</Box>
          </Tooltip>
        </StatusIcon>

        <Box flex={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" fontWeight="bold">
              WebSocket
            </Typography>
            <ProtocolChip
              label={protocol.current}
              size="small"
              icon={<Cable fontSize="small" />}
            />
            {protocol.compressionEnabled && (
              <Tooltip title="Compression enabled">
                <DataUsage fontSize="small" color="primary" />
              </Tooltip>
            )}
          </Stack>
          
          {status === 'connected' && (
            <Stack direction="row" spacing={2} mt={0.5}>
              <LatencyIndicator latency={metrics.latency}>
                <Speed fontSize="small" />
                <Typography variant="caption">{metrics.latency}ms</Typography>
              </LatencyIndicator>
              
              <Box display="flex" alignItems="center" gap={0.5}>
                <Router fontSize="small" />
                <Typography variant="caption">
                  {metrics.activeStreams} streams
                </Typography>
              </Box>

              {overallHealth !== 'healthy' && (
                <Tooltip title={`Stream health: ${overallHealth}`}>
                  <Warning fontSize="small" color="warning" />
                </Tooltip>
              )}
            </Stack>
          )}
        </Box>

        <Stack direction="row" spacing={1}>
          {status === 'disconnected' && (
            <Tooltip title="Reconnect">
              <IconButton size="small" onClick={handleReconnect}>
                <Refresh />
              </IconButton>
            </Tooltip>
          )}

          <Tooltip title="More options">
            <IconButton size="small" onClick={handleMenuOpen}>
              <Settings />
            </IconButton>
          </Tooltip>

          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Stack>
      </StatusContainer>

      <Collapse in={expanded}>
        <Paper sx={{ mt: 1, p: 2 }}>
          <Grid container spacing={2}>
            {/* Connection Metrics */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Connection Metrics
              </Typography>
              <Box>
                <MetricItem>
                  <Typography variant="body2">Uptime</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatUptime(metrics.uptime)}
                  </Typography>
                </MetricItem>
                <MetricItem>
                  <Typography variant="body2">Data Rate</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(metrics.dataRate)}/s
                  </Typography>
                </MetricItem>
                <MetricItem>
                  <Typography variant="body2">Messages</Typography>
                  <Typography variant="body2" color="text.secondary">
                    ↑ {protocol.messagesSent} ↓ {protocol.messagesReceived}
                  </Typography>
                </MetricItem>
                <MetricItem>
                  <Typography variant="body2">Queue Size</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metrics.messageQueueSize}
                  </Typography>
                </MetricItem>
              </Box>
            </Grid>

            {/* Stream Health */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Stream Health
              </Typography>
              <Box>
                {streamHealth.length === 0 ? (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    No active streams
                  </Alert>
                ) : (
                  streamHealth.map(health => (
                    <MetricItem key={health.streamId}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <StreamHealthIcon quality={health.quality} />
                        <Typography variant="body2">{health.streamId}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {health.dataRate.toFixed(1)} Hz
                      </Typography>
                    </MetricItem>
                  ))
                )}
              </Box>
            </Grid>
          </Grid>

          {/* Protocol Information */}
          <Box mt={2}>
            <Typography variant="subtitle2" gutterBottom>
              Protocol Information
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Chip
                label={`Protocol: ${protocol.current}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Transferred: ${formatBytes(protocol.bytesTransferred)}`}
                size="small"
                variant="outlined"
              />
              {metrics.reconnectCount > 0 && (
                <Chip
                  label={`Reconnects: ${metrics.reconnectCount}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
              {metrics.errorCount > 0 && (
                <Chip
                  label={`Errors: ${metrics.errorCount}`}
                  size="small"
                  color="error"
                  variant="outlined"
                />
              )}
            </Stack>
          </Box>
        </Paper>
      </Collapse>

      {/* Options Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { handleMenuClose(); setSettingsOpen(true); }}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          <ListItemText>Connection Settings</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { handleMenuClose(); handleReconnect(); }}>
          <ListItemIcon>
            <Refresh fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reconnect</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <NetworkCheck fontSize="small" />
          </ListItemIcon>
          <ListItemText>Run Diagnostics</ListItemText>
        </MenuItem>
      </Menu>

      {/* Settings Dialog */}
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>WebSocket Connection Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={protocolSettings.autoSwitch}
                  onChange={(e) => setProtocolSettings(prev => ({
                    ...prev,
                    autoSwitch: e.target.checked
                  }))}
                />
              }
              label="Auto-switch protocols based on performance"
            />

            <FormControl fullWidth>
              <Typography variant="body2" gutterBottom>
                Preferred Protocol
              </Typography>
              <Select
                value={protocolSettings.preferredProtocol}
                onChange={(e) => setProtocolSettings(prev => ({
                  ...prev,
                  preferredProtocol: e.target.value as BinaryProtocol
                }))}
                size="small"
              >
                <MenuItem value={BinaryProtocol.JSON}>JSON</MenuItem>
                <MenuItem value={BinaryProtocol.MessagePack}>MessagePack</MenuItem>
                <MenuItem value={BinaryProtocol.CBOR}>CBOR</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Compression Threshold (bytes)"
              type="number"
              value={protocolSettings.compressionThreshold}
              onChange={(e) => setProtocolSettings(prev => ({
                ...prev,
                compressionThreshold: parseInt(e.target.value) || 1024
              }))}
              size="small"
              fullWidth
            />

            <TextField
              label="Heartbeat Interval (seconds)"
              type="number"
              value={protocolSettings.heartbeatInterval}
              onChange={(e) => setProtocolSettings(prev => ({
                ...prev,
                heartbeatInterval: parseInt(e.target.value) || 30
              }))}
              size="small"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
          <Button onClick={handleSettingsSave} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WebSocketStatusIndicator;