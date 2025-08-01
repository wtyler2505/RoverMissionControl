/**
 * ConnectionStatus - WebSocket Connection Status Indicator
 * Professional UI component showing real-time connection state
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  Typography,
  Collapse,
  Paper,
  LinearProgress,
  CircularProgress,
  useTheme,
  Divider
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import {
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  Sync as ConnectingIcon,
  Error as ErrorIcon,
  Security as AuthenticatedIcon,
  Speed as LatencyIcon,
  Storage as QueueIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Circle as StatusDotIcon,
  Compress as CompressIcon,
  DataObject as ProtocolIcon
} from '@mui/icons-material';
import {
  ConnectionState,
  ConnectionStatus as IConnectionStatus,
  ConnectionStatusProps,
  Protocol
} from '../../services/websocket/types';
import { ProtocolIndicator } from './ProtocolIndicator';
import { TransportStatus } from './TransportStatus';

/**
 * Get status color based on connection state
 */
const getStatusColor = (state: ConnectionState): 'success' | 'error' | 'warning' | 'info' => {
  switch (state) {
    case ConnectionState.CONNECTED:
    case ConnectionState.AUTHENTICATED:
    case ConnectionState.ACTIVE:
      return 'success';
    case ConnectionState.ERROR:
      return 'error';
    case ConnectionState.CONNECTING:
    case ConnectionState.RECONNECTING:
      return 'warning';
    case ConnectionState.IDLE:
      return 'info';
    default:
      return 'error';
  }
};

/**
 * Get status icon based on connection state
 */
const getStatusIcon = (state: ConnectionState) => {
  switch (state) {
    case ConnectionState.CONNECTED:
      return <ConnectedIcon />;
    case ConnectionState.AUTHENTICATED:
    case ConnectionState.ACTIVE:
      return <AuthenticatedIcon />;
    case ConnectionState.CONNECTING:
    case ConnectionState.RECONNECTING:
      return <ConnectingIcon className="animate-spin" />;
    case ConnectionState.ERROR:
      return <ErrorIcon />;
    case ConnectionState.IDLE:
      return <ConnectedIcon color="action" />;
    default:
      return <DisconnectedIcon />;
  }
};

/**
 * Get human-readable status text
 */
const getStatusText = (state: ConnectionState): string => {
  switch (state) {
    case ConnectionState.CONNECTED:
      return 'Connected';
    case ConnectionState.AUTHENTICATED:
      return 'Authenticated';
    case ConnectionState.ACTIVE:
      return 'Active';
    case ConnectionState.CONNECTING:
      return 'Connecting...';
    case ConnectionState.RECONNECTING:
      return 'Reconnecting...';
    case ConnectionState.ERROR:
      return 'Error';
    case ConnectionState.IDLE:
      return 'Idle';
    case ConnectionState.DISCONNECTED:
    default:
      return 'Disconnected';
  }
};

/**
 * Format latency for display
 */
const formatLatency = (latency: number): string => {
  if (latency === 0) return 'N/A';
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

/**
 * Format bytes for display
 */
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Format uptime for display
 */
const formatUptime = (uptime: number): string => {
  if (uptime === 0) return 'N/A';
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Get protocol display name
 */
const getProtocolName = (protocol: Protocol): string => {
  switch (protocol) {
    case Protocol.JSON:
      return 'JSON';
    case Protocol.MESSAGEPACK:
      return 'MessagePack';
    case Protocol.CBOR:
      return 'CBOR';
    case Protocol.BINARY:
      return 'Binary';
    default:
      return 'Unknown';
  }
};

/**
 * Format percentage for display
 */
const formatPercentage = (value: number): string => {
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * Connection status indicator component
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps & {
  connectionStatus: IConnectionStatus;
}> = ({
  connectionStatus,
  showDetails = false,
  compact = false,
  position = 'top-right',
  onStatusClick
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const { state, metrics, error, queueStatus, activeSubscriptions, protocolNegotiation } = connectionStatus;
  const statusColor = getStatusColor(state);
  const statusIcon = getStatusIcon(state);
  const statusText = getStatusText(state);
  
  // Extract protocol information with backward compatibility
  const currentProtocol = protocolNegotiation?.selectedProtocol || Protocol.JSON;
  const compressionEnabled = protocolNegotiation?.compressionEnabled || false;

  const handleClick = () => {
    if (onStatusClick) {
      onStatusClick();
    } else if (showDetails) {
      setExpanded(!expanded);
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency === 0) return theme.palette.text.disabled;
    if (latency < 100) return theme.palette.success.main;
    if (latency < 300) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const compactView = (
    <Tooltip
      title={
        <Box>
          <Typography variant="body2">{statusText}</Typography>
          {error && (
            <Typography variant="caption" color="error">
              {error.message}
            </Typography>
          )}
          <Typography variant="caption">
            Protocol: {getProtocolName(currentProtocol)}{compressionEnabled ? ' (Compressed)' : ''}
          </Typography>
          <Typography variant="caption">
            Latency: {formatLatency(metrics.currentLatency)}
          </Typography>
          <Typography variant="caption">
            Queue: {queueStatus.size} messages
          </Typography>
        </Box>
      }
    >
      <Chip
        icon={statusIcon}
        label={compact ? '' : statusText}
        color={statusColor}
        size="small"
        onClick={handleClick}
        sx={{
          position: 'fixed',
          top: position.includes('top') ? 16 : 'auto',
          bottom: position.includes('bottom') ? 16 : 'auto',
          left: position.includes('left') ? 16 : 'auto',
          right: position.includes('right') ? 16 : 'auto',
          zIndex: theme.zIndex.tooltip,
          cursor: onStatusClick || showDetails ? 'pointer' : 'default'
        }}
      />
    </Tooltip>
  );

  if (!showDetails) {
    return compactView;
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Main status indicator */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          minWidth: 300,
          position: 'fixed',
          top: position.includes('top') ? 16 : 'auto',
          bottom: position.includes('bottom') ? 16 : 'auto',
          left: position.includes('left') ? 16 : 'auto',
          right: position.includes('right') ? 16 : 'auto',
          zIndex: theme.zIndex.tooltip
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            {statusIcon}
            <Typography variant="h6" color={`${statusColor}.main`}>
              {statusText}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              • {getProtocolName(currentProtocol)}
            </Typography>
          </Box>
          
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            aria-label="Toggle details"
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </Box>

        {/* Error display */}
        {error && (
          <Box mt={1}>
            <Typography variant="body2" color="error">
              {error.message}
            </Typography>
          </Box>
        )}

        {/* Quick stats */}
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <LatencyIcon fontSize="small" />
              <Typography
                variant="body2"
                color={getLatencyColor(metrics.currentLatency)}
              >
                {formatLatency(metrics.currentLatency)}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              <QueueIcon fontSize="small" />
              <Typography variant="body2">
                {queueStatus.size}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6}>
            <ProtocolIndicator 
              variant="text" 
              size="small" 
              showCompression={true}
              showMetrics={false}
            />
          </Grid>
          
          <Grid item xs={6}>
            <Box display="flex" alignItems="center" gap={1}>
              {compressionEnabled && (
                <>
                  <CompressIcon fontSize="small" color="primary" />
                  <Typography variant="body2" color="primary">
                    Enabled
                  </Typography>
                </>
              )}
              {!compressionEnabled && (
                <Typography variant="body2" color="text.secondary">
                  No compression
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>

        {/* Detailed information */}
        <Collapse in={expanded}>
          <Box mt={2}>
            {/* Connection metrics */}
            <Typography variant="subtitle2" gutterBottom>
              Connection Metrics
            </Typography>
            
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Uptime
                </Typography>
                <Typography variant="body2">
                  {formatUptime(metrics.uptime)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Reconnects
                </Typography>
                <Typography variant="body2">
                  {metrics.reconnectionCount}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Messages Sent
                </Typography>
                <Typography variant="body2">
                  {metrics.messagesSent.toLocaleString()}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Messages Received
                </Typography>
                <Typography variant="body2">
                  {metrics.messagesReceived.toLocaleString()}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Data Sent
                </Typography>
                <Typography variant="body2">
                  {formatBytes(metrics.bytesSent)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Data Received
                </Typography>
                <Typography variant="body2">
                  {formatBytes(metrics.bytesReceived)}
                </Typography>
              </Grid>
            </Grid>

            {/* Latency information */}
            <Typography variant="subtitle2" gutterBottom>
              Latency
            </Typography>
            
            <Box sx={{ mb: 2 }}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="caption">
                  Current: {formatLatency(metrics.currentLatency)}
                </Typography>
                <Typography variant="caption">
                  Average: {formatLatency(metrics.averageLatency)}
                </Typography>
              </Box>
              
              <LinearProgress
                variant="determinate"
                value={Math.min((metrics.currentLatency / 1000) * 100, 100)}
                color={
                  metrics.currentLatency < 100 ? 'success' :
                  metrics.currentLatency < 300 ? 'warning' : 'error'
                }
              />
            </Box>

            {/* Protocol Information */}
            <Typography variant="subtitle2" gutterBottom>
              Protocol Information
            </Typography>
            
            <Grid container spacing={1} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Current Protocol
                </Typography>
                <Typography variant="body2">
                  {getProtocolName(currentProtocol)}
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Compression
                </Typography>
                <Typography variant="body2">
                  {compressionEnabled ? 'Enabled' : 'Disabled'}
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Protocol Performance
                  </Typography>
                  <ProtocolIndicator 
                    variant="chip" 
                    size="small" 
                    showCompression={true}
                    showMetrics={true}
                  />
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                    Transport Status
                  </Typography>
                  <TransportStatus 
                    variant="detailed"
                    showMetrics={false}
                  />
                </Box>
              </Grid>
              
              {protocolNegotiation && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Supported Protocols
                    </Typography>
                    <Typography variant="body2">
                      {protocolNegotiation.supportedProtocols.length}
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Preferred Protocol
                    </Typography>
                    <Typography variant="body2">
                      {getProtocolName(protocolNegotiation.preferredProtocol)}
                    </Typography>
                  </Grid>
                </>
              )}
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Active subscriptions */}
            {activeSubscriptions.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Active Subscriptions ({activeSubscriptions.length})
                </Typography>
                
                {activeSubscriptions.slice(0, 3).map((subscription) => (
                  <Box
                    key={subscription.id}
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      <StatusDotIcon
                        fontSize="small"
                        color={subscription.active ? 'success' : 'disabled'}
                      />
                      <Typography variant="body2">
                        {subscription.channel}
                      </Typography>
                    </Box>
                    
                    <Typography variant="caption" color="text.secondary">
                      {subscription.messageCount} msgs
                    </Typography>
                  </Box>
                ))}
                
                {activeSubscriptions.length > 3 && (
                  <Typography variant="caption" color="text.secondary">
                    +{activeSubscriptions.length - 3} more...
                  </Typography>
                )}
              </Box>
            )}

            {/* Queue status */}
            {queueStatus.size > 0 && (
              <Box mt={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Message Queue
                </Typography>
                
                <Box display="flex" alignItems="center" gap={1}>
                  <QueueIcon fontSize="small" />
                  <Typography variant="body2">
                    {queueStatus.size} messages queued
                  </Typography>
                  {queueStatus.processing && (
                    <CircularProgress size={16} />
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};