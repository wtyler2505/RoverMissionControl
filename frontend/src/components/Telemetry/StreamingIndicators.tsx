/**
 * StreamingIndicators - Real-time status indicators for streaming data
 * Shows connection status, data rates, latency, and quality metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  LinearProgress,
  CircularProgress,
  Tooltip,
  IconButton,
  Collapse,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge,
  Button,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  SignalCellularAlt,
  SignalCellular4Bar,
  SignalCellular2Bar,
  SignalCellular0Bar,
  NetworkCheck,
  Speed,
  Storage,
  Memory,
  Timeline,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  Info,
  ExpandMore,
  ExpandLess,
  Refresh,
  Settings,
  FiberManualRecord,
  Circle,
  WifiTethering,
  DataUsage,
  TrendingUp,
  TrendingDown,
  HorizontalRule
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { StreamingIndicatorStatus, StreamAlert, StreamPerformanceStats } from '../../types/streaming';
import { formatBytes, formatDuration } from '../../utils/format';

/**
 * Props for StreamingIndicators
 */
export interface StreamingIndicatorsProps {
  streams: StreamingIndicatorStatus[];
  showDetails?: boolean;
  compact?: boolean;
  onAlertDismiss?: (streamId: string, alertId: string) => void;
  onStreamClick?: (streamId: string) => void;
  onRefresh?: () => void;
}

/**
 * Styled components
 */
const IndicatorsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius
}));

const StreamIndicator = styled(Box)<{ $status: string }>(({ theme, $status }) => ({
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${
    $status === 'active' ? alpha(theme.palette.success.main, 0.3) :
    $status === 'error' ? alpha(theme.palette.error.main, 0.3) :
    $status === 'paused' ? alpha(theme.palette.warning.main, 0.3) :
    alpha(theme.palette.grey[500], 0.3)
  }`,
  backgroundColor:
    $status === 'active' ? alpha(theme.palette.success.main, 0.05) :
    $status === 'error' ? alpha(theme.palette.error.main, 0.05) :
    $status === 'paused' ? alpha(theme.palette.warning.main, 0.05) :
    alpha(theme.palette.grey[500], 0.05),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    backgroundColor:
      $status === 'active' ? alpha(theme.palette.success.main, 0.1) :
      $status === 'error' ? alpha(theme.palette.error.main, 0.1) :
      $status === 'paused' ? alpha(theme.palette.warning.main, 0.1) :
      alpha(theme.palette.grey[500], 0.1),
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[2]
  }
}));

const MetricBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.background.paper, 0.5)
}));

const QualityBar = styled(LinearProgress)(({ theme }) => ({
  height: 6,
  borderRadius: 3,
  backgroundColor: alpha(theme.palette.action.disabled, 0.1)
}));

const StatusDot = styled(Box)<{ $status: string }>(({ theme, $status }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor:
    $status === 'active' ? theme.palette.success.main :
    $status === 'error' ? theme.palette.error.main :
    $status === 'paused' ? theme.palette.warning.main :
    theme.palette.grey[500],
  animation: $status === 'active' ? 'pulse 2s infinite' : 'none',
  '@keyframes pulse': {
    '0%': { opacity: 1, transform: 'scale(1)' },
    '50%': { opacity: 0.7, transform: 'scale(1.2)' },
    '100%': { opacity: 1, transform: 'scale(1)' }
  }
}));

const AlertItem = styled(Alert)(({ theme }) => ({
  '&:not(:last-child)': {
    marginBottom: theme.spacing(1)
  }
}));

/**
 * Get signal strength icon based on quality
 */
const getSignalIcon = (quality: number) => {
  if (quality >= 0.9) return <SignalCellular4Bar />;
  if (quality >= 0.7) return <SignalCellular2Bar />;
  if (quality >= 0.5) return <SignalCellularAlt />;
  return <SignalCellular0Bar />;
};

/**
 * Get latency color
 */
const getLatencyColor = (latency: number, theme: any) => {
  if (latency < 50) return theme.palette.success.main;
  if (latency < 150) return theme.palette.warning.main;
  return theme.palette.error.main;
};

/**
 * Format data rate
 */
const formatDataRate = (rate: number): string => {
  if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k Hz`;
  return `${rate.toFixed(0)} Hz`;
};

/**
 * Individual stream indicator
 */
const StreamIndicatorItem: React.FC<{
  status: StreamingIndicatorStatus;
  compact?: boolean;
  showDetails?: boolean;
  onClick?: () => void;
}> = ({ status, compact = false, showDetails = false, onClick }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  
  const qualityColor = useMemo(() => {
    if (status.quality >= 0.9) return 'success';
    if (status.quality >= 0.7) return 'warning';
    return 'error';
  }, [status.quality]);
  
  const bufferHealthColor = useMemo(() => {
    if (status.bufferHealth >= 0.9) return 'success';
    if (status.bufferHealth >= 0.5) return 'warning';
    return 'error';
  }, [status.bufferHealth]);
  
  if (compact) {
    return (
      <StreamIndicator $status={status.status} onClick={onClick}>
        <Stack direction="row" spacing={1} alignItems="center">
          <StatusDot $status={status.status} />
          <Typography variant="body2" fontWeight="medium">
            {status.streamId}
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            {getSignalIcon(status.quality)}
          </Box>
        </Stack>
      </StreamIndicator>
    );
  }
  
  return (
    <StreamIndicator $status={status.status} onClick={onClick}>
      <Stack spacing={1}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <StatusDot $status={status.status} />
            <Typography variant="subtitle2" fontWeight="bold">
              {status.streamId}
            </Typography>
            <Chip
              size="small"
              label={status.status}
              color={
                status.status === 'active' ? 'success' :
                status.status === 'error' ? 'error' :
                status.status === 'paused' ? 'warning' :
                'default'
              }
              variant="outlined"
            />
          </Stack>
          
          {showDetails && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Stack>
        
        {/* Metrics */}
        <Stack direction="row" spacing={2}>
          <MetricBox>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Speed fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Rate
              </Typography>
            </Stack>
            <Typography variant="body2" fontWeight="medium">
              {formatDataRate(status.dataRate)}
            </Typography>
          </MetricBox>
          
          <MetricBox>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Timeline fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Latency
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              fontWeight="medium"
              color={getLatencyColor(status.latency, theme)}
            >
              {status.latency.toFixed(0)}ms
            </Typography>
          </MetricBox>
          
          <MetricBox sx={{ flex: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {getSignalIcon(status.quality)}
              <Typography variant="caption" color="text.secondary">
                Quality
              </Typography>
            </Stack>
            <Box sx={{ width: '100%', mt: 0.5 }}>
              <QualityBar
                variant="determinate"
                value={status.quality * 100}
                color={qualityColor}
              />
            </Box>
          </MetricBox>
          
          <MetricBox sx={{ flex: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Storage fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Buffer
              </Typography>
            </Stack>
            <Box sx={{ width: '100%', mt: 0.5 }}>
              <QualityBar
                variant="determinate"
                value={status.bufferHealth * 100}
                color={bufferHealthColor}
              />
            </Box>
          </MetricBox>
        </Stack>
        
        {/* Alerts */}
        {status.alerts.length > 0 && (
          <Badge badgeContent={status.alerts.length} color="error">
            <Alert
              severity={
                status.alerts.some(a => a.severity === 'critical') ? 'error' :
                status.alerts.some(a => a.severity === 'error') ? 'error' :
                status.alerts.some(a => a.severity === 'warning') ? 'warning' :
                'info'
              }
              variant="outlined"
              sx={{ width: '100%', py: 0.5 }}
            >
              {status.alerts.length} active alert{status.alerts.length > 1 ? 's' : ''}
            </Alert>
          </Badge>
        )}
        
        {/* Expanded details */}
        <Collapse in={expanded}>
          <Divider sx={{ my: 1 }} />
          <Stack spacing={1}>
            {status.alerts.map((alert) => (
              <AlertItem
                key={alert.id}
                severity={
                  alert.severity === 'critical' ? 'error' :
                  alert.severity === 'error' ? 'error' :
                  alert.severity === 'warning' ? 'warning' :
                  'info'
                }
                variant="outlined"
              >
                <AlertTitle>{alert.type.replace('_', ' ').toUpperCase()}</AlertTitle>
                {alert.message}
              </AlertItem>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    </StreamIndicator>
  );
};

/**
 * Summary statistics
 */
const SummaryStats: React.FC<{
  streams: StreamingIndicatorStatus[];
}> = ({ streams }) => {
  const stats = useMemo(() => {
    const active = streams.filter(s => s.status === 'active').length;
    const errors = streams.filter(s => s.status === 'error').length;
    const totalRate = streams.reduce((sum, s) => sum + s.dataRate, 0);
    const avgLatency = streams.reduce((sum, s) => sum + s.latency, 0) / streams.length || 0;
    const avgQuality = streams.reduce((sum, s) => sum + s.quality, 0) / streams.length || 0;
    const totalAlerts = streams.reduce((sum, s) => sum + s.alerts.length, 0);
    
    return {
      active,
      errors,
      total: streams.length,
      totalRate,
      avgLatency,
      avgQuality,
      totalAlerts
    };
  }, [streams]);
  
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        System Overview
      </Typography>
      
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Chip
          icon={<WifiTethering />}
          label={`${stats.active}/${stats.total} Active`}
          color={stats.active === stats.total ? 'success' : 'warning'}
          variant="outlined"
        />
        
        <Chip
          icon={<DataUsage />}
          label={`${formatDataRate(stats.totalRate)} Total`}
          variant="outlined"
        />
        
        <Chip
          icon={<NetworkCheck />}
          label={`${stats.avgLatency.toFixed(0)}ms Avg`}
          color={stats.avgLatency < 100 ? 'success' : stats.avgLatency < 200 ? 'warning' : 'error'}
          variant="outlined"
        />
        
        <Chip
          icon={getSignalIcon(stats.avgQuality)}
          label={`${(stats.avgQuality * 100).toFixed(0)}% Quality`}
          color={stats.avgQuality > 0.9 ? 'success' : stats.avgQuality > 0.7 ? 'warning' : 'error'}
          variant="outlined"
        />
        
        {stats.totalAlerts > 0 && (
          <Chip
            icon={<Warning />}
            label={`${stats.totalAlerts} Alerts`}
            color="error"
            variant="outlined"
          />
        )}
      </Stack>
    </Paper>
  );
};

/**
 * StreamingIndicators component
 */
export const StreamingIndicators: React.FC<StreamingIndicatorsProps> = ({
  streams,
  showDetails = true,
  compact = false,
  onAlertDismiss,
  onStreamClick,
  onRefresh
}) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  useEffect(() => {
    if (!autoRefresh || !onRefresh) return;
    
    const interval = setInterval(onRefresh, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);
  
  const criticalStreams = useMemo(() => {
    return streams.filter(s => 
      s.status === 'error' || 
      s.alerts.some(a => a.severity === 'critical' || a.severity === 'error')
    );
  }, [streams]);
  
  return (
    <IndicatorsContainer elevation={1}>
      <Stack spacing={2}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Stream Status</Typography>
          
          <Stack direction="row" spacing={1}>
            {onRefresh && (
              <Tooltip title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}>
                <IconButton
                  size="small"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  color={autoRefresh ? 'primary' : 'default'}
                >
                  <Refresh />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Settings">
              <IconButton size="small">
                <Settings />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        
        {/* Summary */}
        {!compact && <SummaryStats streams={streams} />}
        
        {/* Critical alerts */}
        {criticalStreams.length > 0 && (
          <Alert severity="error" variant="outlined">
            <AlertTitle>Critical Issues</AlertTitle>
            {criticalStreams.length} stream{criticalStreams.length > 1 ? 's' : ''} require attention
          </Alert>
        )}
        
        {/* Stream list */}
        <Stack spacing={1}>
          {streams.map((stream) => (
            <StreamIndicatorItem
              key={stream.streamId}
              status={stream}
              compact={compact}
              showDetails={showDetails}
              onClick={() => onStreamClick?.(stream.streamId)}
            />
          ))}
        </Stack>
        
        {streams.length === 0 && (
          <Box textAlign="center" py={4} color="text.secondary">
            <Typography variant="body2">No active streams</Typography>
          </Box>
        )}
      </Stack>
    </IndicatorsContainer>
  );
};

export default StreamingIndicators;