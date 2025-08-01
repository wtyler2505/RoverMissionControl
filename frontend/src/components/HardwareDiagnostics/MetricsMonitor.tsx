import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  useTheme,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  SwapVert as SwapVertIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import axios from 'axios';

interface MetricData {
  timestamp: number;
  txRate: number;
  rxRate: number;
  errorRate: number;
  totalErrors: number;
}

interface CommunicationMetrics {
  device_id: string;
  measurement_duration: number;
  throughput: {
    tx_rate_bps: number;
    rx_rate_bps: number;
    tx_rate_kbps: number;
    rx_rate_kbps: number;
  };
  totals: {
    bytes_sent: number;
    bytes_received: number;
    error_count: number;
  };
  deltas: {
    bytes_sent: number;
    bytes_received: number;
    errors: number;
  };
  error_rate: number;
}

interface MetricsMonitorProps {
  deviceId: string;
  initialDuration?: number;
}

const MetricsMonitor: React.FC<MetricsMonitorProps> = ({ deviceId, initialDuration = 5 }) => {
  const theme = useTheme();
  const [metrics, setMetrics] = useState<CommunicationMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<MetricData[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [duration, setDuration] = useState(initialDuration);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxDataPoints = 60; // Keep last 60 data points

  useEffect(() => {
    if (isMonitoring && deviceId) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isMonitoring, deviceId, duration]);

  const startMonitoring = () => {
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, duration * 1000);
  };

  const stopMonitoring = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`/api/hardware/diagnostics/metrics/${deviceId}`, {
        params: { duration_seconds: duration }
      });
      
      const newMetrics: CommunicationMetrics = response.data;
      setMetrics(newMetrics);
      setError(null);
      
      // Add to historical data
      const newDataPoint: MetricData = {
        timestamp: Date.now(),
        txRate: newMetrics.throughput.tx_rate_kbps,
        rxRate: newMetrics.throughput.rx_rate_kbps,
        errorRate: newMetrics.error_rate,
        totalErrors: newMetrics.totals.error_count,
      };
      
      setHistoricalData(prev => {
        const updated = [...prev, newDataPoint];
        return updated.slice(-maxDataPoints); // Keep only last N points
      });
    } catch (err) {
      setError('Failed to fetch metrics');
      console.error('Error fetching metrics:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getTrend = (current: number, previous: number) => {
    if (!previous || current === previous) return null;
    return current > previous ? 'up' : 'down';
  };

  const getErrorSeverity = (errorRate: number) => {
    if (errorRate < 0.1) return 'success';
    if (errorRate < 1) return 'warning';
    return 'error';
  };

  if (!metrics && !error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Real-Time Metrics</Typography>
        <Box display="flex" gap={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Update Interval</InputLabel>
            <Select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              label="Update Interval"
            >
              <MenuItem value={1}>1 second</MenuItem>
              <MenuItem value={5}>5 seconds</MenuItem>
              <MenuItem value={10}>10 seconds</MenuItem>
              <MenuItem value={30}>30 seconds</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title={isMonitoring ? 'Pause Monitoring' : 'Resume Monitoring'}>
            <IconButton onClick={() => setIsMonitoring(!isMonitoring)} color="primary">
              {isMonitoring ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Refresh Now">
            <IconButton onClick={fetchMetrics} disabled={!isMonitoring}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.main', color: 'error.contrastText' }}>
          <Typography>{error}</Typography>
        </Paper>
      )}

      {metrics && (
        <>
          {/* Current Metrics */}
          <Grid container spacing={2} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        TX Rate
                      </Typography>
                      <Typography variant="h4">
                        {metrics.throughput.tx_rate_kbps.toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        KB/s
                      </Typography>
                    </Box>
                    <TrendingUpIcon color="primary" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        RX Rate
                      </Typography>
                      <Typography variant="h4">
                        {metrics.throughput.rx_rate_kbps.toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        KB/s
                      </Typography>
                    </Box>
                    <TrendingDownIcon color="secondary" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Error Rate
                      </Typography>
                      <Typography variant="h4">
                        {metrics.error_rate.toFixed(3)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        %
                      </Typography>
                    </Box>
                    <Chip
                      icon={<ErrorIcon />}
                      label={getErrorSeverity(metrics.error_rate).toUpperCase()}
                      color={getErrorSeverity(metrics.error_rate) as any}
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Total Data
                      </Typography>
                      <Typography variant="h6">
                        {formatBytes(metrics.totals.bytes_sent + metrics.totals.bytes_received)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        TX: {formatBytes(metrics.totals.bytes_sent)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        RX: {formatBytes(metrics.totals.bytes_received)}
                      </Typography>
                    </Box>
                    <SwapVertIcon color="action" />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Historical Charts */}
          {historicalData.length > 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Throughput History
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={formatTimestamp}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis label={{ value: 'KB/s', angle: -90, position: 'insideLeft' }} />
                        <ChartTooltip
                          labelFormatter={formatTimestamp}
                          formatter={(value: number) => `${value.toFixed(2)} KB/s`}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="txRate"
                          name="TX Rate"
                          stroke={theme.palette.primary.main}
                          fill={theme.palette.primary.light}
                          fillOpacity={0.6}
                        />
                        <Area
                          type="monotone"
                          dataKey="rxRate"
                          name="RX Rate"
                          stroke={theme.palette.secondary.main}
                          fill={theme.palette.secondary.light}
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} lg={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Error Rate Trend
                    </Typography>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={historicalData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="timestamp"
                          tickFormatter={formatTimestamp}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis label={{ value: 'Error %', angle: -90, position: 'insideLeft' }} />
                        <ChartTooltip
                          labelFormatter={formatTimestamp}
                          formatter={(value: number) => `${value.toFixed(3)}%`}
                        />
                        <Line
                          type="monotone"
                          dataKey="errorRate"
                          name="Error Rate"
                          stroke={theme.palette.error.main}
                          strokeWidth={2}
                          dot={{ fill: theme.palette.error.main }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </>
      )}
    </Box>
  );
};

export default MetricsMonitor;