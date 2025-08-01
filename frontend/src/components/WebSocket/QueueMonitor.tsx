/**
 * QueueMonitor - Real-time display of message queue and backpressure status
 * Shows queue depth, processing rate, backpressure indicators, and message statistics
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
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableRow,
  CircularProgress,
  Badge
} from '@mui/material';
import {
  QueueRounded as QueueIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as ThroughputIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as NormalIcon,
  PriorityHigh as HighPriorityIcon,
  LowPriority as LowPriorityIcon,
  Block as BackpressureIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { useWebSocket } from './WebSocketProvider';
import { Priority, MessageType } from '../../services/websocket/types';
import { FlowControlStats } from '../../services/websocket/BackpressureManager';

export interface QueueMonitorProps {
  position?: 'inline' | 'floating';
  expandable?: boolean;
  showDetails?: boolean;
  updateInterval?: number;
  maxHeight?: number;
}

interface QueueStats {
  total: number;
  byPriority: Record<Priority, number>;
  byType: Record<MessageType, number>;
  processing: boolean;
  oldestTimestamp?: number;
  newestTimestamp?: number;
  throughput: number;
  backpressure: FlowControlStats;
}

const getPriorityIcon = (priority: Priority) => {
  switch (priority) {
    case Priority.CRITICAL:
      return <ErrorIcon fontSize="small" color="error" />;
    case Priority.HIGH:
      return <HighPriorityIcon fontSize="small" color="warning" />;
    case Priority.LOW:
      return <LowPriorityIcon fontSize="small" color="action" />;
    default:
      return <NormalIcon fontSize="small" color="success" />;
  }
};

const getPriorityLabel = (priority: Priority): string => {
  switch (priority) {
    case Priority.CRITICAL: return 'Critical';
    case Priority.HIGH: return 'High';
    case Priority.NORMAL: return 'Normal';
    case Priority.LOW: return 'Low';
    default: return 'Unknown';
  }
};

const getQueueHealthColor = (total: number, maxSize: number): 'success' | 'warning' | 'error' => {
  const percentage = (total / maxSize) * 100;
  if (percentage < 50) return 'success';
  if (percentage < 80) return 'warning';
  return 'error';
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
};

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  position = 'inline',
  expandable = true,
  showDetails = false,
  updateInterval = 500,
  maxHeight = 400
}) => {
  const { client } = useWebSocket();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [expanded, setExpanded] = useState(showDetails);
  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    if (!client) return;

    const updateStats = () => {
      const queueStats = client.getQueueStats();
      setStats(queueStats);
      
      // Trigger pulse animation on activity
      if (queueStats.processing) {
        setPulseAnimation(true);
        setTimeout(() => setPulseAnimation(false), 300);
      }
    };

    updateStats();
    const interval = setInterval(updateStats, updateInterval);

    return () => clearInterval(interval);
  }, [client, updateInterval]);

  if (!stats) {
    return null;
  }

  const maxQueueSize = 1000; // TODO: Get from config
  const queuePercentage = (stats.total / maxQueueSize) * 100;
  const healthColor = getQueueHealthColor(stats.total, maxQueueSize);
  const messageAge = stats.oldestTimestamp 
    ? Date.now() - stats.oldestTimestamp 
    : 0;

  const content = (
    <Paper
      elevation={position === 'floating' ? 3 : 1}
      sx={{
        p: 2,
        ...(position === 'floating' && {
          position: 'fixed',
          bottom: 16,
          left: 16,
          zIndex: 1300,
          maxWidth: 450,
          maxHeight: maxHeight
        })
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box display="flex" alignItems="center" gap={1}>
          <Badge 
            badgeContent={stats.total} 
            color={healthColor}
            max={999}
          >
            <QueueIcon
              color={stats.processing ? 'primary' : 'action'}
              sx={{
                animation: pulseAnimation ? 'pulse 0.3s ease-in-out' : 'none',
                '@keyframes pulse': {
                  '0%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.2)' },
                  '100%': { transform: 'scale(1)' }
                }
              }}
            />
          </Badge>
          <Typography variant="subtitle1" fontWeight="medium">
            Message Queue
          </Typography>
          {stats.processing && (
            <CircularProgress size={16} thickness={2} />
          )}
        </Box>
        
        {expandable && (
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        )}
      </Box>

      <Box mt={1}>
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Tooltip title="Queue fill level">
            <Box flex={1} minWidth={120}>
              <LinearProgress
                variant="determinate"
                value={queuePercentage}
                color={healthColor}
                sx={{ height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {stats.total} / {maxQueueSize} messages
              </Typography>
            </Box>
          </Tooltip>

          <Tooltip title="Message throughput">
            <Box display="flex" alignItems="center" gap={0.5}>
              <ThroughputIcon fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                {stats.throughput.toFixed(1)} msg/s
              </Typography>
            </Box>
          </Tooltip>

          {stats.backpressure.backpressureActive && (
            <Chip
              icon={<BackpressureIcon />}
              label="Backpressure"
              size="small"
              color="warning"
              variant="filled"
            />
          )}

          {stats.backpressure.droppedMessages > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${stats.backpressure.droppedMessages} dropped`}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </Box>

        {messageAge > 30000 && stats.total > 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            <AlertTitle>Queue Delay</AlertTitle>
            Oldest message queued {formatDuration(messageAge)} ago
          </Alert>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box mt={2} sx={{ maxHeight: maxHeight - 200, overflowY: 'auto' }}>
          <Grid container spacing={2}>
            {/* Priority breakdown */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Messages by Priority
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {Object.entries(stats.byPriority).map(([priority, count]) => {
                  const p = Number(priority) as Priority;
                  if (count === 0) return null;
                  return (
                    <Chip
                      key={priority}
                      icon={getPriorityIcon(p)}
                      label={`${getPriorityLabel(p)}: ${count}`}
                      size="small"
                      variant="outlined"
                    />
                  );
                })}
              </Box>
            </Grid>

            {/* Backpressure details */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Flow Control
              </Typography>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell>Congestion Level</TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" gap={1}>
                        <LinearProgress
                          variant="determinate"
                          value={stats.backpressure.congestionLevel * 100}
                          color={stats.backpressure.congestionLevel > 0.7 ? 'error' : 'primary'}
                          sx={{ flex: 1, height: 6 }}
                        />
                        <Typography variant="caption">
                          {(stats.backpressure.congestionLevel * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Target Throughput</TableCell>
                    <TableCell align="right">
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <SpeedIcon fontSize="small" />
                        {stats.backpressure.targetThroughput} msg/s
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Outstanding</TableCell>
                    <TableCell align="right">
                      {stats.backpressure.outstandingMessages} messages
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Bytes in Flight</TableCell>
                    <TableCell align="right">
                      {(stats.backpressure.bytesInFlight / 1024).toFixed(1)} KB
                    </TableCell>
                  </TableRow>
                  {stats.backpressure.throttledMessages > 0 && (
                    <TableRow>
                      <TableCell>Throttled</TableCell>
                      <TableCell align="right">
                        {stats.backpressure.throttledMessages} messages
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Grid>

            {/* Message type breakdown if available */}
            {Object.keys(stats.byType).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Messages by Type
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {Object.entries(stats.byType).map(([type, count]) => {
                    if (count === 0) return null;
                    return (
                      <Chip
                        key={type}
                        label={`${type}: ${count}`}
                        size="small"
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  );

  return content;
};

/**
 * Minimal queue indicator for status bars
 */
export const QueueIndicator: React.FC = () => {
  const { client } = useWebSocket();
  const [queueSize, setQueueSize] = useState(0);
  const [backpressure, setBackpressure] = useState(false);

  useEffect(() => {
    if (!client) return;

    const updateStatus = () => {
      const stats = client.getQueueStats();
      setQueueSize(stats.total);
      setBackpressure(stats.backpressure.backpressureActive);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);

    return () => clearInterval(interval);
  }, [client]);

  if (queueSize === 0 && !backpressure) {
    return null;
  }

  return (
    <Tooltip title={`Queue: ${queueSize} messages${backpressure ? ' (backpressure active)' : ''}`}>
      <Box display="flex" alignItems="center" gap={0.5}>
        <Badge badgeContent={queueSize} color={backpressure ? 'warning' : 'primary'} max={99}>
          <QueueIcon fontSize="small" color={backpressure ? 'warning' : 'action'} />
        </Badge>
      </Box>
    </Tooltip>
  );
};