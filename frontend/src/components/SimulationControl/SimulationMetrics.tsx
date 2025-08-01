/**
 * Simulation Metrics Component
 * Displays real-time metrics and performance data
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  alpha
} from '@mui/material';
import {
  Speed,
  Memory,
  Storage,
  Timer,
  DeviceHub,
  NetworkCheck,
  TrendingUp,
  TrendingDown,
  Refresh,
  FullscreenOutlined,
  Warning,
  CheckCircle,
  Info,
  Error
} from '@mui/icons-material';
import { SimulationStats, SimulationEvent } from './types';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
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
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface SimulationMetricsProps {
  stats: SimulationStats;
  events: SimulationEvent[];
}

interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
};

export const SimulationMetrics: React.FC<SimulationMetricsProps> = ({
  stats,
  events
}) => {
  const theme = useTheme();
  const [performanceHistory, setPerformanceHistory] = useState({
    timestamps: [] as string[],
    cpuUsage: [] as number[],
    memoryUsage: [] as number[],
    eventRate: [] as number[]
  });
  
  const [eventStats, setEventStats] = useState({
    byType: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    recentRate: 0
  });
  
  // Update performance history
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    
    setPerformanceHistory(prev => {
      const maxPoints = 20;
      const newHistory = {
        timestamps: [...prev.timestamps, timestamp].slice(-maxPoints),
        cpuUsage: [...prev.cpuUsage, stats.cpuUsage].slice(-maxPoints),
        memoryUsage: [...prev.memoryUsage, stats.memoryUsage].slice(-maxPoints),
        eventRate: [...prev.eventRate, events.length].slice(-maxPoints)
      };
      return newHistory;
    });
  }, [stats, events.length]);
  
  // Calculate event statistics
  useEffect(() => {
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    
    events.forEach(event => {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      bySource[event.source] = (bySource[event.source] || 0) + 1;
    });
    
    // Calculate recent event rate (events per second)
    const recentEvents = events.filter(e => {
      const eventTime = new Date(e.timestamp).getTime();
      const now = Date.now();
      return now - eventTime < 5000; // Last 5 seconds
    });
    
    setEventStats({
      byType,
      bySource,
      recentRate: recentEvents.length / 5
    });
  }, [events]);
  
  const metrics: MetricCard[] = [
    {
      title: 'Simulation Time',
      value: formatUptime(stats.simulationTime),
      icon: <Timer />,
      color: theme.palette.primary.main,
      trend: 'up'
    },
    {
      title: 'Active Devices',
      value: stats.devicesActive,
      unit: 'devices',
      icon: <DeviceHub />,
      color: theme.palette.success.main,
      trend: stats.devicesActive > 0 ? 'up' : 'stable'
    },
    {
      title: 'CPU Usage',
      value: stats.cpuUsage.toFixed(1),
      unit: '%',
      icon: <Speed />,
      color: stats.cpuUsage > 80 ? theme.palette.error.main : theme.palette.info.main,
      trend: stats.cpuUsage > 50 ? 'up' : 'down'
    },
    {
      title: 'Memory Usage',
      value: stats.memoryUsage.toFixed(1),
      unit: '%',
      icon: <Memory />,
      color: stats.memoryUsage > 80 ? theme.palette.error.main : theme.palette.warning.main,
      trend: stats.memoryUsage > 50 ? 'up' : 'down'
    },
    {
      title: 'Event Rate',
      value: eventStats.recentRate.toFixed(1),
      unit: 'events/s',
      icon: <TrendingUp />,
      color: theme.palette.secondary.main
    },
    {
      title: 'Total Events',
      value: stats.eventsProcessed.toLocaleString(),
      icon: <Storage />,
      color: theme.palette.grey[600]
    }
  ];
  
  const performanceChartData = {
    labels: performanceHistory.timestamps,
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: performanceHistory.cpuUsage,
        borderColor: theme.palette.info.main,
        backgroundColor: alpha(theme.palette.info.main, 0.1),
        tension: 0.4,
        fill: true
      },
      {
        label: 'Memory Usage (%)',
        data: performanceHistory.memoryUsage,
        borderColor: theme.palette.warning.main,
        backgroundColor: alpha(theme.palette.warning.main, 0.1),
        tension: 0.4,
        fill: true
      }
    ]
  };
  
  const eventTypeChartData = {
    labels: Object.keys(eventStats.byType).slice(0, 5),
    datasets: [{
      data: Object.values(eventStats.byType).slice(0, 5),
      backgroundColor: [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.success.main,
        theme.palette.warning.main,
        theme.palette.error.main
      ]
    }]
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
      }
    }
  };
  
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          boxWidth: 12
        }
      }
    }
  };
  
  const renderMetricCard = (metric: MetricCard) => (
    <Grid item xs={6} sm={4} md={2} key={metric.title}>
      <Paper
        sx={{
          p: 2,
          height: '100%',
          bgcolor: alpha(metric.color, 0.05),
          border: 1,
          borderColor: alpha(metric.color, 0.2)
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box color={metric.color}>{metric.icon}</Box>
          {metric.trend && (
            <Box color={metric.trend === 'up' ? 'success.main' : 'error.main'}>
              {metric.trend === 'up' ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
            </Box>
          )}
        </Box>
        <Typography variant="h4" fontWeight="bold">
          {metric.value}
          {metric.unit && (
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}{metric.unit}
            </Typography>
          )}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {metric.title}
        </Typography>
      </Paper>
    </Grid>
  );
  
  const getEventLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <Error color="error" fontSize="small" />;
      case 'warning':
        return <Warning color="warning" fontSize="small" />;
      case 'success':
        return <CheckCircle color="success" fontSize="small" />;
      default:
        return <Info color="info" fontSize="small" />;
    }
  };
  
  return (
    <Box>
      {/* Metric Cards */}
      <Grid container spacing={2} mb={3}>
        {metrics.map(renderMetricCard)}
      </Grid>
      
      <Grid container spacing={3}>
        {/* Performance Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">System Performance</Typography>
                <Box>
                  <Tooltip title="Refresh">
                    <IconButton size="small">
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Fullscreen">
                    <IconButton size="small">
                      <FullscreenOutlined />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Box height={250}>
                <Line data={performanceChartData} options={chartOptions} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Event Distribution */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Event Distribution
              </Typography>
              <Box height={250}>
                {Object.keys(eventStats.byType).length > 0 ? (
                  <Doughnut data={eventTypeChartData} options={doughnutOptions} />
                ) : (
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    height="100%"
                  >
                    <Typography color="text.secondary">
                      No events recorded
                    </Typography>
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Network Stats */}
        {stats.networkStats && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Network Statistics
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <NetworkCheck color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Packets Sent
                        </Typography>
                        <Typography variant="h6">
                          {stats.networkStats.packetsSent.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <NetworkCheck color="success" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Packets Received
                        </Typography>
                        <Typography variant="h6">
                          {stats.networkStats.packetsReceived.toLocaleString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Warning color="error" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Packet Loss
                        </Typography>
                        <Typography variant="h6">
                          {((stats.networkStats.packetsLost / stats.networkStats.packetsSent) * 100).toFixed(2)}%
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Timer color="warning" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Avg Latency
                        </Typography>
                        <Typography variant="h6">
                          {stats.networkStats.avgLatency.toFixed(1)} ms
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Bandwidth Usage
                  </Typography>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box flex={1}>
                      <LinearProgress
                        variant="determinate"
                        value={(stats.networkStats.bandwidth / 100) * 100}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                    </Box>
                    <Typography variant="body2">
                      {stats.networkStats.bandwidth.toFixed(1)} Mbps
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {/* Recent Events */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Events
              </Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {events.slice(-10).reverse().map((event, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {getEventLevelIcon(event.metadata?.level || 'info')}
                          <Typography variant="body2">
                            {event.eventType}
                          </Typography>
                          <Chip
                            label={event.source}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};