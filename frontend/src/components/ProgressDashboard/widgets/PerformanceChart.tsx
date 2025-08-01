/**
 * Performance Chart Widget
 * 
 * Visualizes command performance metrics over time with multiple chart types
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Paper,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  Stack
} from '@mui/material';
import {
  ShowChart as LineIcon,
  BarChart as BarIcon,
  DonutLarge as DonutIcon,
  Timeline as TimelineIcon,
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import {
  CommandPerformanceMetrics,
  PerformanceAnalytics
} from '../../../types/progress-tracking.types';
import { formatDuration, formatTimestamp } from '../../../utils/time.utils';

interface PerformanceChartProps {
  metrics: CommandPerformanceMetrics[];
  analytics: PerformanceAnalytics | null;
  timeRange: 'last_15m' | 'last_1h' | 'last_6h' | 'last_24h';
  onTimeRangeChange?: (range: string) => void;
}

type ChartType = 'line' | 'bar' | 'area' | 'pie';
type MetricType = 'execution_time' | 'queue_time' | 'throughput' | 'success_rate' | 'error_distribution';

const CHART_COLORS = {
  primary: '#2196F3',
  secondary: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#00BCD4',
  success: '#4CAF50'
};

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  metrics,
  analytics,
  timeRange,
  onTimeRangeChange
}) => {
  const theme = useTheme();
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('execution_time');
  const [showAverage, setShowAverage] = useState(true);
  const [showPercentiles, setShowPercentiles] = useState(false);

  // Process metrics for time series data
  const timeSeriesData = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];

    // Group metrics by time intervals (5 minute buckets)
    const bucketSize = 5 * 60 * 1000; // 5 minutes in ms
    const buckets = new Map<number, CommandPerformanceMetrics[]>();

    metrics.forEach(metric => {
      const bucketTime = Math.floor(metric.timestamp.getTime() / bucketSize) * bucketSize;
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      buckets.get(bucketTime)!.push(metric);
    });

    // Calculate aggregated values for each bucket
    return Array.from(buckets.entries())
      .map(([time, bucketMetrics]) => {
        const executionTimes = bucketMetrics.map(m => m.executionTime);
        const queueTimes = bucketMetrics.map(m => m.queueTime);
        const successCount = bucketMetrics.filter(m => m.errorCount === 0).length;
        
        return {
          time: new Date(time),
          timestamp: formatTimestamp(new Date(time)),
          executionTime: average(executionTimes),
          queueTime: average(queueTimes),
          throughput: bucketMetrics.length / (bucketSize / 1000), // per second
          successRate: (successCount / bucketMetrics.length) * 100,
          errorCount: bucketMetrics.reduce((sum, m) => sum + m.errorCount, 0),
          count: bucketMetrics.length,
          p50: percentile(executionTimes, 50),
          p95: percentile(executionTimes, 95),
          p99: percentile(executionTimes, 99)
        };
      })
      .sort((a, b) => a.time.getTime() - b.time.getTime());
  }, [metrics]);

  // Calculate command type distribution for pie chart
  const commandTypeDistribution = useMemo(() => {
    if (!analytics?.commandTypeBreakdown) return [];

    return Object.entries(analytics.commandTypeBreakdown).map(([type, data]) => ({
      name: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      value: data.count,
      percentage: (data.count / analytics.totalCommands) * 100,
      avgTime: data.avgExecutionTime
    }));
  }, [analytics]);

  const renderLineChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={timeSeriesData}>
        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
        <XAxis 
          dataKey="timestamp" 
          style={{ fontSize: '0.75rem' }}
          tick={{ fill: theme.palette.text.secondary }}
        />
        <YAxis 
          style={{ fontSize: '0.75rem' }}
          tick={{ fill: theme.palette.text.secondary }}
          label={{
            value: getYAxisLabel(),
            angle: -90,
            position: 'insideLeft',
            style: { fill: theme.palette.text.secondary }
          }}
        />
        <ChartTooltip 
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4
          }}
          formatter={(value: any) => formatMetricValue(value)}
        />
        <Legend />
        
        {renderMetricLines()}
        
        {showAverage && analytics && (
          <ReferenceLine 
            y={getAverageValue()} 
            stroke={theme.palette.warning.main}
            strokeDasharray="5 5"
            label="Average"
          />
        )}
        
        <Brush 
          dataKey="timestamp" 
          height={30}
          stroke={theme.palette.primary.main}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  const renderBarChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={timeSeriesData}>
        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
        <XAxis 
          dataKey="timestamp" 
          style={{ fontSize: '0.75rem' }}
          tick={{ fill: theme.palette.text.secondary }}
        />
        <YAxis 
          style={{ fontSize: '0.75rem' }}
          tick={{ fill: theme.palette.text.secondary }}
        />
        <ChartTooltip 
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4
          }}
          formatter={(value: any) => formatMetricValue(value)}
        />
        <Legend />
        
        {renderMetricBars()}
      </BarChart>
    </ResponsiveContainer>
  );

  const renderAreaChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={timeSeriesData}>
        <defs>
          <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
        <XAxis 
          dataKey="timestamp" 
          style={{ fontSize: '0.75rem' }}
          tick={{ fill: theme.palette.text.secondary }}
        />
        <YAxis 
          style={{ fontSize: '0.75rem' }}
          tick={{ fill: theme.palette.text.secondary }}
        />
        <ChartTooltip 
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4
          }}
          formatter={(value: any) => formatMetricValue(value)}
        />
        <Legend />
        
        {renderMetricAreas()}
      </AreaChart>
    </ResponsiveContainer>
  );

  const renderPieChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={commandTypeDistribution}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomizedLabel}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {commandTypeDistribution.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={Object.values(CHART_COLORS)[index % Object.values(CHART_COLORS).length]} 
            />
          ))}
        </Pie>
        <ChartTooltip 
          contentStyle={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 4
          }}
          formatter={(value: any, name: string, props: any) => [
            `${value} (${props.payload.percentage.toFixed(1)}%)`,
            name
          ]}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );

  const renderMetricLines = () => {
    switch (selectedMetric) {
      case 'execution_time':
        return (
          <>
            <Line 
              type="monotone" 
              dataKey="executionTime" 
              stroke={CHART_COLORS.primary} 
              name="Execution Time"
              strokeWidth={2}
            />
            {showPercentiles && (
              <>
                <Line 
                  type="monotone" 
                  dataKey="p50" 
                  stroke={CHART_COLORS.info} 
                  name="P50"
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="p95" 
                  stroke={CHART_COLORS.warning} 
                  name="P95"
                  strokeDasharray="5 5"
                />
                <Line 
                  type="monotone" 
                  dataKey="p99" 
                  stroke={CHART_COLORS.error} 
                  name="P99"
                  strokeDasharray="5 5"
                />
              </>
            )}
          </>
        );
      case 'queue_time':
        return (
          <Line 
            type="monotone" 
            dataKey="queueTime" 
            stroke={CHART_COLORS.secondary} 
            name="Queue Time"
            strokeWidth={2}
          />
        );
      case 'throughput':
        return (
          <Line 
            type="monotone" 
            dataKey="throughput" 
            stroke={CHART_COLORS.info} 
            name="Commands/sec"
            strokeWidth={2}
          />
        );
      case 'success_rate':
        return (
          <>
            <Line 
              type="monotone" 
              dataKey="successRate" 
              stroke={CHART_COLORS.success} 
              name="Success Rate %"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="errorCount" 
              stroke={CHART_COLORS.error} 
              name="Errors"
              strokeWidth={2}
              yAxisId="right"
            />
          </>
        );
      default:
        return null;
    }
  };

  const renderMetricBars = () => {
    switch (selectedMetric) {
      case 'execution_time':
        return (
          <Bar 
            dataKey="executionTime" 
            fill={CHART_COLORS.primary} 
            name="Execution Time"
          />
        );
      case 'queue_time':
        return (
          <Bar 
            dataKey="queueTime" 
            fill={CHART_COLORS.secondary} 
            name="Queue Time"
          />
        );
      case 'throughput':
        return (
          <Bar 
            dataKey="count" 
            fill={CHART_COLORS.info} 
            name="Commands"
          />
        );
      case 'error_distribution':
        return (
          <>
            <Bar 
              dataKey="count" 
              fill={CHART_COLORS.primary} 
              name="Total"
            />
            <Bar 
              dataKey="errorCount" 
              fill={CHART_COLORS.error} 
              name="Errors"
            />
          </>
        );
      default:
        return null;
    }
  };

  const renderMetricAreas = () => {
    return (
      <>
        <Area
          type="monotone"
          dataKey="executionTime"
          stroke={CHART_COLORS.primary}
          fillOpacity={1}
          fill="url(#colorPrimary)"
          name="Execution Time"
        />
        <Area
          type="monotone"
          dataKey="queueTime"
          stroke={CHART_COLORS.secondary}
          fillOpacity={1}
          fill="url(#colorSecondary)"
          name="Queue Time"
        />
      </>
    );
  };

  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
    const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);

    if (percent < 0.05) return null; // Don't show labels for small slices

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ fontSize: '0.75rem', fontWeight: 'bold' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const getYAxisLabel = () => {
    switch (selectedMetric) {
      case 'execution_time':
      case 'queue_time':
        return 'Time (ms)';
      case 'throughput':
        return 'Commands/sec';
      case 'success_rate':
        return 'Percentage';
      default:
        return '';
    }
  };

  const getAverageValue = () => {
    if (!analytics) return 0;
    switch (selectedMetric) {
      case 'execution_time':
        return analytics.averageExecutionTime;
      case 'queue_time':
        return analytics.averageQueueTime;
      case 'throughput':
        return analytics.throughput.average;
      case 'success_rate':
        return analytics.successRate * 100;
      default:
        return 0;
    }
  };

  const formatMetricValue = (value: number) => {
    switch (selectedMetric) {
      case 'execution_time':
      case 'queue_time':
        return formatDuration(value);
      case 'throughput':
        return `${value.toFixed(2)}/s`;
      case 'success_rate':
        return `${value.toFixed(1)}%`;
      default:
        return value.toFixed(2);
    }
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return renderLineChart();
      case 'bar':
        return renderBarChart();
      case 'area':
        return renderAreaChart();
      case 'pie':
        return renderPieChart();
      default:
        return renderLineChart();
    }
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Export chart data');
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Performance Analytics
          </Typography>
          
          {analytics && (
            <Stack direction="row" spacing={1} sx={{ mr: 2 }}>
              <Chip 
                label={`Avg: ${formatDuration(analytics.averageExecutionTime)}`}
                size="small"
                variant="outlined"
              />
              <Chip 
                label={`Success: ${(analytics.successRate * 100).toFixed(1)}%`}
                size="small"
                color={analytics.successRate > 0.95 ? 'success' : 'warning'}
                variant="outlined"
              />
            </Stack>
          )}
          
          <Tooltip title="Export Data">
            <IconButton size="small" onClick={handleExport}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Controls */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Chart Type */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, value) => value && setChartType(value)}
            size="small"
          >
            <ToggleButton value="line">
              <LineIcon />
            </ToggleButton>
            <ToggleButton value="bar">
              <BarIcon />
            </ToggleButton>
            <ToggleButton value="area">
              <TimelineIcon />
            </ToggleButton>
            {selectedMetric === 'error_distribution' && (
              <ToggleButton value="pie">
                <DonutIcon />
              </ToggleButton>
            )}
          </ToggleButtonGroup>

          {/* Metric Selection */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Metric</InputLabel>
            <Select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as MetricType)}
              label="Metric"
            >
              <MenuItem value="execution_time">Execution Time</MenuItem>
              <MenuItem value="queue_time">Queue Time</MenuItem>
              <MenuItem value="throughput">Throughput</MenuItem>
              <MenuItem value="success_rate">Success Rate</MenuItem>
              <MenuItem value="error_distribution">Error Distribution</MenuItem>
            </Select>
          </FormControl>

          {/* Time Range */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => onTimeRangeChange?.(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="last_15m">Last 15m</MenuItem>
              <MenuItem value="last_1h">Last 1h</MenuItem>
              <MenuItem value="last_6h">Last 6h</MenuItem>
              <MenuItem value="last_24h">Last 24h</MenuItem>
            </Select>
          </FormControl>

          {/* Options */}
          {chartType === 'line' && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <ToggleButton
                value="average"
                selected={showAverage}
                onChange={() => setShowAverage(!showAverage)}
                size="small"
              >
                Show Average
              </ToggleButton>
              {selectedMetric === 'execution_time' && (
                <ToggleButton
                  value="percentiles"
                  selected={showPercentiles}
                  onChange={() => setShowPercentiles(!showPercentiles)}
                  size="small"
                >
                  Show Percentiles
                </ToggleButton>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Chart */}
      <Paper 
        sx={{ 
          flex: 1, 
          p: 2, 
          bgcolor: alpha(theme.palette.background.paper, 0.5),
          minHeight: 400
        }}
      >
        {timeSeriesData.length > 0 ? (
          renderChart()
        ) : (
          <Box 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center' 
            }}
          >
            <Typography variant="body1" color="text.secondary">
              No performance data available for the selected time range
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

// Utility functions
const average = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
};

const percentile = (numbers: number[], p: number): number => {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};