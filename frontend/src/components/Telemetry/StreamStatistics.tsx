/**
 * StreamStatistics - Displays real-time statistics and quality metrics for telemetry streams
 * Shows data rate, latency, buffer usage, and analysis results
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  Chip,
  LinearProgress,
  CircularProgress,
  Tooltip,
  IconButton,
  Collapse,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Menu,
  MenuItem,
  Badge,
  useTheme
} from '@mui/material';
import {
  Speed,
  Memory,
  Storage,
  Timeline,
  SignalCellularAlt,
  Assessment,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Refresh,
  MoreVert,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  Analytics,
  BugReport,
  Psychology,
  CompareArrows,
  DataUsage,
  Timer,
  NetworkCheck,
  CloudQueue,
  Router,
  Insights
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { telemetryStreamManager } from '../../services/telemetry/TelemetryStreamManager';
import { StreamQuality } from '../../types/telemetry';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

/**
 * Component props
 */
interface StreamStatisticsProps {
  streamId?: string;
  showAllStreams?: boolean;
  compact?: boolean;
  refreshInterval?: number;
  onStreamClick?: (streamId: string) => void;
  className?: string;
}

/**
 * Stream statistics data
 */
interface StreamStats {
  streamId: string;
  name: string;
  dataRate: number;
  dataRateTrend: 'up' | 'down' | 'stable';
  latency: number;
  bufferUsage: number;
  dataPoints: number;
  quality: StreamQuality;
  lastUpdate: number;
  errorRate: number;
  droppedPackets: number;
  analysisResults?: {
    anomalies?: number;
    driftDetected?: boolean;
    correlations?: string[];
    predictions?: any;
    trends?: any;
  };
}

/**
 * Styled components
 */
const StatisticsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column'
}));

const StatCard = styled(Paper)<{ quality?: StreamQuality }>(({ theme, quality }) => ({
  padding: theme.spacing(2),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  borderLeft: `4px solid ${
    quality === StreamQuality.Good ? theme.palette.success.main :
    quality === StreamQuality.Fair ? theme.palette.warning.main :
    theme.palette.error.main
  }`,
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[4]
  }
}));

const MetricBox = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(1)
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  fontSize: '1.2rem'
}));

const MetricLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
}));

const TrendIcon = styled(Box)<{ trend: 'up' | 'down' | 'stable' }>(({ theme, trend }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  marginLeft: theme.spacing(0.5),
  color: trend === 'up' ? theme.palette.success.main :
         trend === 'down' ? theme.palette.error.main :
         theme.palette.text.secondary
}));

const QualityIndicator = styled(Box)<{ quality: StreamQuality }>(({ theme, quality }) => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  backgroundColor:
    quality === StreamQuality.Good ? theme.palette.success.main :
    quality === StreamQuality.Fair ? theme.palette.warning.main :
    theme.palette.error.main,
  display: 'inline-block',
  marginRight: theme.spacing(1)
}));

const AnalysisChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem',
  marginRight: theme.spacing(0.5),
  marginBottom: theme.spacing(0.5)
}));

/**
 * Helper functions
 */
const formatDataRate = (rate: number): string => {
  if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k/s`;
  return `${rate.toFixed(1)}/s`;
};

const formatLatency = (latency: number): string => {
  if (latency < 1) return '<1ms';
  return `${latency.toFixed(0)}ms`;
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getQualityColor = (quality: StreamQuality, theme: any): string => {
  switch (quality) {
    case StreamQuality.Good:
      return theme.palette.success.main;
    case StreamQuality.Fair:
      return theme.palette.warning.main;
    case StreamQuality.Poor:
      return theme.palette.error.main;
    default:
      return theme.palette.text.secondary;
  }
};

/**
 * StreamStatistics component
 */
export const StreamStatistics: React.FC<StreamStatisticsProps> = ({
  streamId,
  showAllStreams = false,
  compact = false,
  refreshInterval = 1000,
  onStreamClick,
  className
}) => {
  const theme = useTheme();
  const [statistics, setStatistics] = useState<Map<string, StreamStats>>(new Map());
  const [expandedStreams, setExpandedStreams] = useState<Set<string>>(new Set());
  const [dataHistory, setDataHistory] = useState<Map<string, number[]>>(new Map());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Update statistics
   */
  useEffect(() => {
    const updateStats = () => {
      const streams = showAllStreams 
        ? telemetryStreamManager.getActiveStreams()
        : streamId ? [{ config: { streamId } }] : [];

      const newStats = new Map<string, StreamStats>();
      const newHistory = new Map(dataHistory);

      streams.forEach(stream => {
        const id = stream.config.streamId;
        const stats = telemetryStreamManager.getStreamStatistics(id);
        const health = telemetryStreamManager.getStreamHealth(id);
        const channels = telemetryStreamManager.getAvailableChannels();
        const channel = channels.find(ch => ch.id === id);

        if (stats && health && channel) {
          // Calculate data rate trend
          const history = newHistory.get(id) || [];
          history.push(stats.dataRate || 0);
          if (history.length > 60) history.shift(); // Keep last 60 samples
          newHistory.set(id, history);

          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (history.length > 10) {
            const recent = history.slice(-10);
            const older = history.slice(-20, -10);
            const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
            const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
            
            if (recentAvg > olderAvg * 1.1) trend = 'up';
            else if (recentAvg < olderAvg * 0.9) trend = 'down';
          }

          newStats.set(id, {
            streamId: id,
            name: channel.name,
            dataRate: stats.dataRate || 0,
            dataRateTrend: trend,
            latency: health.latency,
            bufferUsage: (stats.dataPoints / (stats.bufferSize || 1)) * 100,
            dataPoints: stats.dataPoints,
            quality: health.quality,
            lastUpdate: stats.lastUpdate || Date.now(),
            errorRate: health.errorRate,
            droppedPackets: stats.droppedPackets || 0,
            analysisResults: stats.analysisResults
          });
        }
      });

      setStatistics(newStats);
      setDataHistory(newHistory);
      setLoading(false);
    };

    updateStats();
    const interval = setInterval(updateStats, refreshInterval);

    return () => clearInterval(interval);
  }, [streamId, showAllStreams, refreshInterval, dataHistory]);

  /**
   * Handle stream expansion
   */
  const toggleStreamExpansion = (streamId: string) => {
    setExpandedStreams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(streamId)) {
        newSet.delete(streamId);
      } else {
        newSet.add(streamId);
      }
      return newSet;
    });
  };

  /**
   * Handle menu open
   */
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, streamId: string) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedStreamId(streamId);
  };

  /**
   * Handle menu close
   */
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedStreamId(null);
  };

  /**
   * Reset stream statistics
   */
  const handleResetStats = () => {
    if (selectedStreamId) {
      // Would implement reset functionality
      console.log('Reset stats for:', selectedStreamId);
    }
    handleMenuClose();
  };

  /**
   * Create mini chart data
   */
  const createMiniChartData = (streamId: string) => {
    const history = dataHistory.get(streamId) || [];
    const labels = history.map((_, i) => '');
    
    return {
      labels,
      datasets: [{
        data: history,
        borderColor: theme.palette.primary.main,
        backgroundColor: `${theme.palette.primary.main}20`,
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.4,
        fill: true
      }]
    };
  };

  /**
   * Mini chart options
   */
  const miniChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false }
    },
    scales: {
      x: { display: false },
      y: { display: false }
    },
    elements: {
      line: { borderWidth: 1 },
      point: { radius: 0 }
    }
  };

  /**
   * Render compact statistics
   */
  const renderCompactStats = (stats: StreamStats) => (
    <Stack direction="row" spacing={2} alignItems="center">
      <QualityIndicator quality={stats.quality} />
      <Box flex={1}>
        <Typography variant="body2" fontWeight="bold">
          {stats.name}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {formatDataRate(stats.dataRate)}
          </Typography>
          <TrendIcon trend={stats.dataRateTrend}>
            {stats.dataRateTrend === 'up' && <TrendingUp fontSize="inherit" />}
            {stats.dataRateTrend === 'down' && <TrendingDown fontSize="inherit" />}
            {stats.dataRateTrend === 'stable' && <TrendingFlat fontSize="inherit" />}
          </TrendIcon>
          <Typography variant="caption" color="text.secondary">
            • {formatLatency(stats.latency)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            • {stats.bufferUsage.toFixed(0)}%
          </Typography>
        </Stack>
      </Box>
      {stats.analysisResults?.anomalies && stats.analysisResults.anomalies > 0 && (
        <Badge badgeContent={stats.analysisResults.anomalies} color="warning">
          <Warning fontSize="small" />
        </Badge>
      )}
    </Stack>
  );

  /**
   * Render full statistics
   */
  const renderFullStats = (stats: StreamStats) => {
    const isExpanded = expandedStreams.has(stats.streamId);

    return (
      <StatCard
        key={stats.streamId}
        quality={stats.quality}
        onClick={() => onStreamClick?.(stats.streamId)}
      >
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={1}>
              <QualityIndicator quality={stats.quality} />
              <Typography variant="h6">{stats.name}</Typography>
              <Chip
                label={stats.streamId}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Stack direction="row" spacing={1}>
              <IconButton
                size="small"
                onClick={() => toggleStreamExpansion(stats.streamId)}
              >
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, stats.streamId)}
              >
                <MoreVert />
              </IconButton>
            </Stack>
          </Stack>

          {/* Main Metrics */}
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <MetricBox>
                <Stack direction="row" alignItems="center" justifyContent="center">
                  <MetricValue>{formatDataRate(stats.dataRate)}</MetricValue>
                  <TrendIcon trend={stats.dataRateTrend}>
                    {stats.dataRateTrend === 'up' && <TrendingUp fontSize="small" />}
                    {stats.dataRateTrend === 'down' && <TrendingDown fontSize="small" />}
                    {stats.dataRateTrend === 'stable' && <TrendingFlat fontSize="small" />}
                  </TrendIcon>
                </Stack>
                <MetricLabel>Data Rate</MetricLabel>
              </MetricBox>
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricBox>
                <MetricValue>{formatLatency(stats.latency)}</MetricValue>
                <MetricLabel>Latency</MetricLabel>
              </MetricBox>
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricBox>
                <MetricValue>{stats.bufferUsage.toFixed(0)}%</MetricValue>
                <MetricLabel>Buffer</MetricLabel>
              </MetricBox>
            </Grid>
            <Grid item xs={6} sm={3}>
              <MetricBox>
                <MetricValue>{stats.dataPoints.toLocaleString()}</MetricValue>
                <MetricLabel>Points</MetricLabel>
              </MetricBox>
            </Grid>
          </Grid>

          {/* Mini Chart */}
          {dataHistory.get(stats.streamId)?.length > 5 && (
            <Box height={60}>
              <Line data={createMiniChartData(stats.streamId)} options={miniChartOptions} />
            </Box>
          )}

          {/* Buffer Usage Bar */}
          <Box>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">
                Buffer Usage
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.bufferUsage.toFixed(0)}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={stats.bufferUsage}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: theme.palette.grey[300],
                '& .MuiLinearProgress-bar': {
                  backgroundColor: 
                    stats.bufferUsage > 90 ? theme.palette.error.main :
                    stats.bufferUsage > 70 ? theme.palette.warning.main :
                    theme.palette.success.main
                }
              }}
            />
          </Box>

          {/* Analysis Results */}
          {stats.analysisResults && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Analysis Results
              </Typography>
              <Box>
                {stats.analysisResults.anomalies !== undefined && (
                  <AnalysisChip
                    icon={<BugReport fontSize="small" />}
                    label={`${stats.analysisResults.anomalies} anomalies`}
                    color={stats.analysisResults.anomalies > 0 ? 'warning' : 'default'}
                    size="small"
                  />
                )}
                {stats.analysisResults.driftDetected && (
                  <AnalysisChip
                    icon={<TrendingUp fontSize="small" />}
                    label="Drift detected"
                    color="warning"
                    size="small"
                  />
                )}
                {stats.analysisResults.correlations && stats.analysisResults.correlations.length > 0 && (
                  <AnalysisChip
                    icon={<CompareArrows fontSize="small" />}
                    label={`${stats.analysisResults.correlations.length} correlations`}
                    color="primary"
                    size="small"
                  />
                )}
                {stats.analysisResults.predictions && (
                  <AnalysisChip
                    icon={<Psychology fontSize="small" />}
                    label="Predictions available"
                    color="secondary"
                    size="small"
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Expanded Details */}
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Timer fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Last Update"
                      secondary={new Date(stats.lastUpdate).toLocaleTimeString()}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <NetworkCheck fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Error Rate"
                      secondary={`${(stats.errorRate * 100).toFixed(2)}%`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CloudQueue fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Dropped Packets"
                      secondary={stats.droppedPackets.toLocaleString()}
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Stream Health
                </Typography>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Quality</Typography>
                    <Chip
                      label={stats.quality}
                      size="small"
                      sx={{
                        backgroundColor: getQualityColor(stats.quality, theme),
                        color: theme.palette.getContrastText(getQualityColor(stats.quality, theme))
                      }}
                    />
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">Status</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stats.dataRate > 0 ? 'Active' : 'Idle'}
                    </Typography>
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </Collapse>
        </Stack>
      </StatCard>
    );
  };

  /**
   * Render summary
   */
  const renderSummary = () => {
    const totalStreams = statistics.size;
    const activeStreams = Array.from(statistics.values()).filter(s => s.dataRate > 0).length;
    const totalDataRate = Array.from(statistics.values()).reduce((sum, s) => sum + s.dataRate, 0);
    const avgLatency = totalStreams > 0 
      ? Array.from(statistics.values()).reduce((sum, s) => sum + s.latency, 0) / totalStreams
      : 0;

    return (
      <Alert 
        severity="info" 
        icon={<Insights />}
        sx={{ mb: 2 }}
      >
        <Stack direction="row" spacing={3} alignItems="center">
          <Box>
            <Typography variant="caption" color="text.secondary">
              Active Streams
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {activeStreams} / {totalStreams}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Data Rate
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {formatDataRate(totalDataRate)}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box>
            <Typography variant="caption" color="text.secondary">
              Avg Latency
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {formatLatency(avgLatency)}
            </Typography>
          </Box>
        </Stack>
      </Alert>
    );
  };

  if (loading) {
    return (
      <StatisticsContainer className={className}>
        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
          <CircularProgress />
        </Box>
      </StatisticsContainer>
    );
  }

  if (statistics.size === 0) {
    return (
      <StatisticsContainer className={className}>
        <Alert severity="info">
          No active streams to display statistics
        </Alert>
      </StatisticsContainer>
    );
  }

  return (
    <StatisticsContainer className={className}>
      <Typography variant="h6" gutterBottom>
        Stream Statistics
      </Typography>

      {showAllStreams && renderSummary()}

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <Stack spacing={2}>
          {Array.from(statistics.values()).map(stats => 
            compact ? renderCompactStats(stats) : renderFullStats(stats)
          )}
        </Stack>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleResetStats}>
          <ListItemIcon>
            <Refresh fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reset Statistics</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Assessment fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Statistics</ListItemText>
        </MenuItem>
      </Menu>
    </StatisticsContainer>
  );
};

export default StreamStatistics;