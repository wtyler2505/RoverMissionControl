/**
 * Metrics Summary Widget
 * 
 * Displays key performance metrics in a compact summary view
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Grid,
  Paper,
  LinearProgress,
  Tooltip,
  useTheme,
  alpha,
  IconButton,
  Trend,
  Stack
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { 
  PerformanceAnalytics,
  CommandPerformanceMetrics 
} from '../../../types/progress-tracking.types';
import { formatDuration, formatNumber, formatPercentage } from '../../../utils/time.utils';

interface MetricsSummaryProps {
  analytics: PerformanceAnalytics | null;
  recentMetrics: CommandPerformanceMetrics[];
  onRefresh?: () => void;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: string;
  progress?: number;
  info?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color,
  progress,
  info
}) => {
  const theme = useTheme();
  
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUpIcon fontSize="small" color="success" />;
      case 'down':
        return <TrendingDownIcon fontSize="small" color="error" />;
      case 'flat':
        return <TrendingFlatIcon fontSize="small" color="action" />;
      default:
        return null;
    }
  };

  const getTrendColor = () => {
    // For error rate, down is good
    if (title.includes('Error')) {
      return trend === 'down' ? theme.palette.success.main : 
             trend === 'up' ? theme.palette.error.main : 
             theme.palette.text.secondary;
    }
    // For other metrics, up is generally good
    return trend === 'up' ? theme.palette.success.main : 
           trend === 'down' ? theme.palette.error.main : 
           theme.palette.text.secondary;
  };

  return (
    <Paper
      sx={{
        p: 2,
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <Box
          sx={{
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(color || theme.palette.primary.main, 0.1),
            color: color || theme.palette.primary.main,
            mr: 2
          }}
        >
          {icon}
        </Box>
        
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            {info && (
              <Tooltip title={info}>
                <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              </Tooltip>
            )}
          </Box>
          
          <Typography variant="h5" sx={{ fontWeight: 'bold', color }}>
            {value}
          </Typography>
          
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          
          {trend && trendValue && (
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5, gap: 0.5 }}>
              {getTrendIcon()}
              <Typography 
                variant="caption" 
                sx={{ color: getTrendColor(), fontWeight: 'medium' }}
              >
                {trendValue}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            bgcolor: alpha(theme.palette.divider, 0.1),
            '& .MuiLinearProgress-bar': {
              bgcolor: color || theme.palette.primary.main
            }
          }}
        />
      )}
    </Paper>
  );
};

export const MetricsSummary: React.FC<MetricsSummaryProps> = ({
  analytics,
  recentMetrics,
  onRefresh
}) => {
  const theme = useTheme();

  // Calculate trends from recent metrics
  const trends = useMemo(() => {
    if (recentMetrics.length < 10) return null;
    
    const recentHalf = recentMetrics.slice(-Math.floor(recentMetrics.length / 2));
    const olderHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
    
    const recentAvgExec = average(recentHalf.map(m => m.executionTime));
    const olderAvgExec = average(olderHalf.map(m => m.executionTime));
    const execTrend = calculateTrend(olderAvgExec, recentAvgExec);
    
    const recentErrorRate = recentHalf.filter(m => m.errorCount > 0).length / recentHalf.length;
    const olderErrorRate = olderHalf.filter(m => m.errorCount > 0).length / olderHalf.length;
    const errorTrend = calculateTrend(olderErrorRate, recentErrorRate);
    
    const recentThroughput = recentHalf.length / 
      ((recentHalf[recentHalf.length - 1].timestamp.getTime() - recentHalf[0].timestamp.getTime()) / 1000);
    const olderThroughput = olderHalf.length / 
      ((olderHalf[olderHalf.length - 1].timestamp.getTime() - olderHalf[0].timestamp.getTime()) / 1000);
    const throughputTrend = calculateTrend(olderThroughput, recentThroughput);
    
    return {
      execution: execTrend,
      error: errorTrend,
      throughput: throughputTrend
    };
  }, [recentMetrics]);

  if (!analytics) {
    return (
      <Box 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}
      >
        <Typography variant="body1" color="text.secondary">
          Loading metrics...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Performance Summary
        </Typography>
        {onRefresh && (
          <Tooltip title="Refresh Metrics">
            <IconButton size="small" onClick={onRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Time Range */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
        {analytics.timeRange.start.toLocaleTimeString()} - {analytics.timeRange.end.toLocaleTimeString()}
      </Typography>

      {/* Metrics Grid */}
      <Grid container spacing={2} sx={{ flex: 1 }}>
        {/* Total Commands */}
        <Grid item xs={6}>
          <MetricCard
            title="Total Commands"
            value={formatNumber(analytics.totalCommands)}
            icon={<SpeedIcon />}
            color={theme.palette.primary.main}
            info="Total commands processed in this time range"
          />
        </Grid>

        {/* Success Rate */}
        <Grid item xs={6}>
          <MetricCard
            title="Success Rate"
            value={formatPercentage(analytics.successRate)}
            icon={<SuccessIcon />}
            progress={analytics.successRate * 100}
            color={analytics.successRate > 0.95 ? theme.palette.success.main : theme.palette.warning.main}
            info="Percentage of commands completed successfully"
          />
        </Grid>

        {/* Average Execution Time */}
        <Grid item xs={6}>
          <MetricCard
            title="Avg Execution"
            value={formatDuration(analytics.averageExecutionTime)}
            subtitle={`P95: ${formatDuration(analytics.p95ExecutionTime)}`}
            icon={<TimerIcon />}
            trend={trends?.execution.trend}
            trendValue={trends?.execution.value}
            color={theme.palette.info.main}
            info="Average time to execute commands"
          />
        </Grid>

        {/* Error Rate */}
        <Grid item xs={6}>
          <MetricCard
            title="Error Rate"
            value={formatPercentage(analytics.errorRate)}
            icon={<ErrorIcon />}
            progress={analytics.errorRate * 100}
            trend={trends?.error.trend}
            trendValue={trends?.error.value}
            color={analytics.errorRate > 0.1 ? theme.palette.error.main : theme.palette.success.main}
            info="Percentage of commands that failed"
          />
        </Grid>

        {/* Throughput */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>
                Throughput
              </Typography>
              {trends?.throughput && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {trends.throughput.trend === 'up' ? 
                    <TrendingUpIcon fontSize="small" color="success" /> :
                    trends.throughput.trend === 'down' ?
                    <TrendingDownIcon fontSize="small" color="error" /> :
                    <TrendingFlatIcon fontSize="small" color="action" />
                  }
                  <Typography variant="caption" color="text.secondary">
                    {trends.throughput.value}
                  </Typography>
                </Box>
              )}
            </Box>
            
            <Stack direction="row" spacing={2} divider={<Box sx={{ width: 1, bgcolor: 'divider' }} />}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Current
                </Typography>
                <Typography variant="h6">
                  {analytics.throughput.current.toFixed(2)}/s
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Average
                </Typography>
                <Typography variant="h6">
                  {analytics.throughput.average.toFixed(2)}/s
                </Typography>
              </Box>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Peak
                </Typography>
                <Typography variant="h6">
                  {analytics.throughput.peak.toFixed(2)}/s
                </Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

// Utility functions
const average = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
};

const calculateTrend = (oldValue: number, newValue: number): { trend: 'up' | 'down' | 'flat', value: string } => {
  if (oldValue === 0) return { trend: 'flat', value: '0%' };
  
  const percentChange = ((newValue - oldValue) / oldValue) * 100;
  
  if (Math.abs(percentChange) < 2) {
    return { trend: 'flat', value: '0%' };
  } else if (percentChange > 0) {
    return { trend: 'up', value: `+${percentChange.toFixed(1)}%` };
  } else {
    return { trend: 'down', value: `${percentChange.toFixed(1)}%` };
  }
};