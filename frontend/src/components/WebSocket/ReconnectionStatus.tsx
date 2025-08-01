/**
 * ReconnectionStatus - UI component for displaying reconnection status
 * Shows reconnection attempts, countdown timer, and manual retry options
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Button,
  Collapse,
  IconButton,
  Chip,
  Grid,
  Tooltip,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Fade,
  Zoom
} from '@mui/material';
import {
  WifiOff as WifiOffIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Timer as TimerIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Block as BlockIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useWebSocket } from '../../services/websocket/WebSocketProvider';
import { CircuitState, ReconnectionMetrics } from '../../services/websocket/ReconnectionManager';
import { ConnectionState } from '../../services/websocket/types';

interface ReconnectionStatusProps {
  position?: 'top' | 'bottom' | 'floating';
  showDetails?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const ReconnectionStatus: React.FC<ReconnectionStatusProps> = ({
  position = 'bottom',
  showDetails = true,
  autoHide = true,
  autoHideDelay = 5000
}) => {
  const { 
    connectionState, 
    reconnectionManager,
    reconnect,
    cancelReconnect 
  } = useWebSocket();

  const [expanded, setExpanded] = useState(false);
  const [metrics, setMetrics] = useState<ReconnectionMetrics | null>(null);
  const [nextRetryIn, setNextRetryIn] = useState<number>(0);
  const [circuitState, setCircuitState] = useState<CircuitState>(CircuitState.CLOSED);
  const [visible, setVisible] = useState(false);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  // Update visibility based on connection state
  useEffect(() => {
    const shouldShow = [
      ConnectionState.RECONNECTING,
      ConnectionState.ERROR,
      ConnectionState.DISCONNECTED
    ].includes(connectionState);

    if (shouldShow) {
      setVisible(true);
    } else if (autoHide && connectionState === ConnectionState.CONNECTED) {
      const timer = setTimeout(() => setVisible(false), autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [connectionState, autoHide, autoHideDelay]);

  // Subscribe to reconnection events
  useEffect(() => {
    if (!reconnectionManager) return;

    const updateMetrics = () => {
      setMetrics(reconnectionManager.getMetrics());
      setCircuitState(reconnectionManager.getCircuitState());
    };

    const handleReconnectScheduled = (data: any) => {
      setNextRetryIn(Math.ceil(data.delay / 1000));
      
      // Clear existing countdown
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }

      // Start countdown
      const interval = setInterval(() => {
        setNextRetryIn(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setCountdownInterval(interval);
    };

    const handleReconnectSuccess = () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
      }
      setNextRetryIn(0);
    };

    // Subscribe to events
    reconnectionManager.on('reconnect-scheduled', handleReconnectScheduled);
    reconnectionManager.on('reconnect-success', handleReconnectSuccess);
    reconnectionManager.on('reconnect-failure', updateMetrics);
    reconnectionManager.on('circuit-breaker-state-change', updateMetrics);

    // Initial update
    updateMetrics();

    return () => {
      reconnectionManager.off('reconnect-scheduled', handleReconnectScheduled);
      reconnectionManager.off('reconnect-success', handleReconnectSuccess);
      reconnectionManager.off('reconnect-failure', updateMetrics);
      reconnectionManager.off('circuit-breaker-state-change', updateMetrics);
      
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [reconnectionManager, countdownInterval]);

  const handleManualReconnect = useCallback(() => {
    reconnect();
  }, [reconnect]);

  const handleCancelReconnect = useCallback(() => {
    cancelReconnect();
    setNextRetryIn(0);
  }, [cancelReconnect]);

  const getStatusIcon = () => {
    switch (connectionState) {
      case ConnectionState.RECONNECTING:
        return <CircularProgress size={20} />;
      case ConnectionState.ERROR:
        return <ErrorIcon color="error" />;
      case ConnectionState.DISCONNECTED:
        return <WifiOffIcon color="warning" />;
      case ConnectionState.CONNECTED:
        return <CheckCircleIcon color="success" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionState) {
      case ConnectionState.RECONNECTING:
        return 'info';
      case ConnectionState.ERROR:
        return 'error';
      case ConnectionState.DISCONNECTED:
        return 'warning';
      case ConnectionState.CONNECTED:
        return 'success';
      default:
        return 'default';
    }
  };

  const getCircuitBreakerStatus = () => {
    switch (circuitState) {
      case CircuitState.OPEN:
        return { icon: <BlockIcon />, color: 'error', text: 'Circuit Breaker Open' };
      case CircuitState.HALF_OPEN:
        return { icon: <WarningIcon />, color: 'warning', text: 'Testing Recovery' };
      case CircuitState.CLOSED:
        return { icon: <CheckCircleIcon />, color: 'success', text: 'Normal Operation' };
    }
  };

  const positionStyles = {
    top: { top: 0, left: 0, right: 0 },
    bottom: { bottom: 0, left: 0, right: 0 },
    floating: { 
      position: 'fixed' as const, 
      bottom: 20, 
      right: 20, 
      maxWidth: 400,
      zIndex: 1300 
    }
  };

  if (!visible) return null;

  const circuitStatus = getCircuitBreakerStatus();

  return (
    <Fade in={visible}>
      <Box
        sx={{
          position: position === 'floating' ? 'fixed' : 'relative',
          ...positionStyles[position],
          zIndex: 1200
        }}
      >
        <Paper 
          elevation={position === 'floating' ? 8 : 0}
          sx={{ 
            p: 2,
            borderRadius: position === 'floating' ? 2 : 0
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              {getStatusIcon()}
            </Grid>
            
            <Grid item xs>
              <Typography variant="subtitle1" component="div">
                {connectionState === ConnectionState.RECONNECTING && 'Reconnecting...'}
                {connectionState === ConnectionState.ERROR && 'Connection Error'}
                {connectionState === ConnectionState.DISCONNECTED && 'Disconnected'}
                {connectionState === ConnectionState.CONNECTED && 'Connected'}
              </Typography>
              
              {nextRetryIn > 0 && (
                <Box display="flex" alignItems="center" gap={1}>
                  <TimerIcon fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Next attempt in {nextRetryIn}s
                  </Typography>
                </Box>
              )}
            </Grid>

            <Grid item>
              <Box display="flex" gap={1}>
                {connectionState === ConnectionState.RECONNECTING && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={handleCancelReconnect}
                    startIcon={<BlockIcon />}
                  >
                    Cancel
                  </Button>
                )}
                
                {connectionState !== ConnectionState.RECONNECTING && 
                 connectionState !== ConnectionState.CONNECTED && 
                 circuitState !== CircuitState.OPEN && (
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    onClick={handleManualReconnect}
                    startIcon={<RefreshIcon />}
                  >
                    Retry Now
                  </Button>
                )}

                {showDetails && (
                  <IconButton
                    size="small"
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                )}
              </Box>
            </Grid>
          </Grid>

          {connectionState === ConnectionState.RECONNECTING && (
            <Box mt={2}>
              <LinearProgress variant="indeterminate" />
            </Box>
          )}

          <Collapse in={expanded && showDetails}>
            <Box mt={2}>
              <Divider sx={{ mb: 2 }} />
              
              {metrics && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Alert 
                      severity={circuitStatus.color as any}
                      icon={circuitStatus.icon}
                    >
                      <AlertTitle>{circuitStatus.text}</AlertTitle>
                      {circuitState === CircuitState.OPEN && (
                        <Typography variant="body2">
                          Too many consecutive failures. Reconnection temporarily disabled.
                        </Typography>
                      )}
                    </Alert>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="overline" color="text.secondary">
                      Connection Metrics
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUpIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Total Attempts"
                          secondary={metrics.totalAttempts}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircleIcon fontSize="small" color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Successful"
                          secondary={metrics.successfulReconnections}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <ErrorIcon fontSize="small" color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Failed"
                          secondary={metrics.failedReconnections}
                        />
                      </ListItem>
                    </List>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="overline" color="text.secondary">
                      Performance
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <SpeedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Avg Delay"
                          secondary={`${Math.round(metrics.averageDelay)}ms`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <TimerIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Max Delay"
                          secondary={`${Math.round(metrics.maxDelay)}ms`}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <TrendingUpIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Current Streak"
                          secondary={metrics.currentStreak}
                        />
                      </ListItem>
                    </List>
                  </Grid>

                  {reconnectionManager && (
                    <Grid item xs={12}>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`Strategy: ${reconnectionManager.config?.strategy || 'exponential'}`}
                          icon={<SettingsIcon />}
                        />
                        <Chip
                          size="small"
                          label={`Max Attempts: ${reconnectionManager.config?.maxAttempts || 10}`}
                        />
                        <Chip
                          size="small"
                          label={`Circuit Breaker: ${metrics.circuitBreakerActivations} activations`}
                          color={metrics.circuitBreakerActivations > 0 ? 'warning' : 'default'}
                        />
                      </Box>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          </Collapse>
        </Paper>
      </Box>
    </Fade>
  );
};