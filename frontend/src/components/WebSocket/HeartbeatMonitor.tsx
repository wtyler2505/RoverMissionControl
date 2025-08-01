/**
 * HeartbeatMonitor - Real-time display of WebSocket connection health
 * Shows heartbeat statistics, latency, and connection quality indicators
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Collapse,
  Grid,
  Tooltip,
  Alert,
  AlertTitle
} from '@mui/material';
import {
  FavoriteRounded as HeartbeatIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SignalCellular4Bar as StrongSignalIcon,
  SignalCellular2Bar as MediumSignalIcon,
  SignalCellular0Bar as WeakSignalIcon,
  Warning as WarningIcon,
  CheckCircle as HealthyIcon,
  Error as UnhealthyIcon
} from '@mui/icons-material';
import { useWebSocket } from './WebSocketProvider';
import { ConnectionState } from '../../services/websocket/types';
import { HeartbeatStats } from '../../services/websocket/HeartbeatManager';

export interface HeartbeatMonitorProps {
  position?: 'inline' | 'floating';
  expandable?: boolean;
  showDetails?: boolean;
  updateInterval?: number;
}

const getSignalIcon = (latency: number) => {
  if (latency < 50) return <StrongSignalIcon color="success" />;
  if (latency < 150) return <MediumSignalIcon color="warning" />;
  return <WeakSignalIcon color="error" />;
};

const getHealthColor = (isHealthy: boolean, consecutiveMissed: number) => {
  if (!isHealthy) return 'error';
  if (consecutiveMissed > 0) return 'warning';
  return 'success';
};

const formatLatency = (latency: number): string => {
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

const calculateSuccessRate = (stats: HeartbeatStats): number => {
  const total = stats.totalSent;
  if (total === 0) return 100;
  const successRate = ((total - stats.missedCount) / total) * 100;
  return Math.round(successRate);
};

export const HeartbeatMonitor: React.FC<HeartbeatMonitorProps> = ({
  position = 'inline',
  expandable = true,
  showDetails = false,
  updateInterval = 1000
}) => {
  const { client, connectionStatus } = useWebSocket();
  const [stats, setStats] = useState<HeartbeatStats | null>(null);
  const [expanded, setExpanded] = useState(showDetails);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    if (!client) return;

    const updateStats = () => {
      const heartbeatStats = client.getHeartbeatStats();
      setStats(heartbeatStats);
      
      // Trigger pulse animation on new heartbeat
      if (heartbeatStats.lastHeartbeatTime > (stats?.lastHeartbeatTime || 0)) {
        setPulseAnimation(true);
        setTimeout(() => setPulseAnimation(false), 300);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, updateInterval);

    return () => clearInterval(interval);
  }, [client, updateInterval, stats?.lastHeartbeatTime]);

  if (!stats || connectionStatus.state === ConnectionState.DISCONNECTED) {
    return null;
  }

  const successRate = calculateSuccessRate(stats);
  const healthColor = getHealthColor(stats.isHealthy, stats.consecutiveMissed);
  const timeSinceLastHeartbeat = Date.now() - stats.lastHeartbeatTime;

  const content = (
    <Paper
      elevation={position === 'floating' ? 3 : 1}
      sx={{
        p: 2,
        ...(position === 'floating' && {
          position: 'fixed',
          bottom: 16,
          right: 16,
          zIndex: 1300,
          maxWidth: 400
        })
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <HeartbeatIcon
            color={healthColor as any}
            sx={{
              animation: pulseAnimation ? 'pulse 0.3s ease-in-out' : 'none',
              '@keyframes pulse': {
                '0%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.2)' },
                '100%': { transform: 'scale(1)' }
              }
            }}
          />
          <Typography variant="subtitle1" fontWeight="medium">
            Connection Health
          </Typography>
          {stats.isHealthy ? (
            <HealthyIcon color="success" fontSize="small" />
          ) : (
            <UnhealthyIcon color="error" fontSize="small" />
          )}
        </Box>
        
        {expandable && (
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>

      <Box mt={1} display="flex" alignItems="center" gap={2}>
        <Tooltip title="Current latency">
          <Box display="flex" alignItems="center" gap={0.5}>
            {getSignalIcon(stats.lastLatency)}
            <Typography variant="body2" color="text.secondary">
              {formatLatency(stats.lastLatency)}
            </Typography>
          </Box>
        </Tooltip>

        <Chip
          label={`${successRate}% success`}
          size="small"
          color={successRate > 95 ? 'success' : successRate > 80 ? 'warning' : 'error'}
          variant="outlined"
        />

        {stats.consecutiveMissed > 0 && (
          <Chip
            icon={<WarningIcon />}
            label={`${stats.consecutiveMissed} missed`}
            size="small"
            color="warning"
            variant="filled"
          />
        )}
      </Box>

      <Collapse in={expanded}>
        <Box mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Average Latency
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {formatLatency(stats.averageLatency)}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Total Heartbeats
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {stats.totalSent}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Received
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {stats.totalReceived}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">
                Missed
              </Typography>
              <Typography variant="body2" fontWeight="medium" color={stats.missedCount > 0 ? 'error' : 'inherit'}>
                {stats.missedCount}
              </Typography>
            </Grid>
          </Grid>

          {timeSinceLastHeartbeat > 10000 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <AlertTitle>No Recent Heartbeat</AlertTitle>
              Last heartbeat was {Math.round(timeSinceLastHeartbeat / 1000)}s ago
            </Alert>
          )}

          <Box mt={2}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Connection Quality
            </Typography>
            <LinearProgress
              variant="determinate"
              value={successRate}
              color={successRate > 95 ? 'success' : successRate > 80 ? 'warning' : 'error'}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );

  return content;
};

/**
 * Minimal heartbeat indicator for status bars
 */
export const HeartbeatIndicator: React.FC = () => {
  const { client, connectionStatus } = useWebSocket();
  const [stats, setStats] = useState<HeartbeatStats | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!client) return;

    const updateStats = () => {
      const heartbeatStats = client.getHeartbeatStats();
      setStats(heartbeatStats);
      
      if (heartbeatStats.lastHeartbeatTime > (stats?.lastHeartbeatTime || 0)) {
        setPulse(true);
        setTimeout(() => setPulse(false), 300);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);

    return () => clearInterval(interval);
  }, [client, stats?.lastHeartbeatTime]);

  if (!stats || connectionStatus.state === ConnectionState.DISCONNECTED) {
    return null;
  }

  const healthColor = getHealthColor(stats.isHealthy, stats.consecutiveMissed);

  return (
    <Tooltip title={`Latency: ${formatLatency(stats.lastLatency)}`}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <HeartbeatIcon
          fontSize="small"
          color={healthColor as any}
          sx={{
            animation: pulse ? 'pulse 0.3s ease-in-out' : 'none',
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.3)' },
              '100%': { transform: 'scale(1)' }
            }
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {formatLatency(stats.lastLatency)}
        </Typography>
      </Box>
    </Tooltip>
  );
};