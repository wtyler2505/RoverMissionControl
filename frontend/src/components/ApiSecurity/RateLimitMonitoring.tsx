import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Button
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useSnackbar } from 'notistack';
import { 
  rateLimitService, 
  RateLimitPolicy, 
  RateLimitViolation,
  RateLimitMetrics,
  RealtimeMetrics 
} from '../../services/rateLimitService';

interface RateLimitMonitoringProps {
  policies: RateLimitPolicy[];
}

export const RateLimitMonitoring: React.FC<RateLimitMonitoringProps> = ({ policies }) => {
  const [loading, setLoading] = useState(true);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<number>(24);
  const [violations, setViolations] = useState<RateLimitViolation[]>([]);
  const [metrics, setMetrics] = useState<RateLimitMetrics[]>([]);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    loadData();
    if (autoRefresh) {
      const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedPolicyId, timeRange, autoRefresh]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [violationsData, metricsData, realtimeData] = await Promise.all([
        rateLimitService.getViolations(
          selectedPolicyId === 'all' ? undefined : selectedPolicyId,
          undefined,
          timeRange,
          100
        ),
        rateLimitService.getMetrics(
          selectedPolicyId === 'all' ? undefined : selectedPolicyId,
          timeRange
        ),
        rateLimitService.getRealtimeMetrics()
      ]);
      
      setViolations(violationsData);
      setMetrics(metricsData);
      setRealtimeMetrics(realtimeData);
    } catch (error: any) {
      enqueueSnackbar('Failed to load monitoring data', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const triggerMetricsCollection = async () => {
    try {
      await rateLimitService.triggerMetricsCollection();
      enqueueSnackbar('Metrics collection triggered', { variant: 'success' });
      setTimeout(loadData, 2000); // Reload after 2 seconds
    } catch (error: any) {
      enqueueSnackbar('Failed to trigger metrics collection', { variant: 'error' });
    }
  };

  // Calculate aggregated metrics
  const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
  const totalBlocked = metrics.reduce((sum, m) => sum + m.blockedRequests, 0);
  const avgViolationRate = totalRequests > 0 ? (totalBlocked / totalRequests) * 100 : 0;

  // Prepare chart data
  const violationTrendData = realtimeMetrics?.violationTrend || [];
  
  const topViolatorsData = realtimeMetrics?.topViolators.slice(0, 5).map(v => ({
    name: v.identifier.split(':').pop() || v.identifier,
    violations: v.count
  })) || [];

  const violationsByPolicyData = metrics.reduce((acc, m) => {
    const policyName = m.policyName || 'Unknown';
    if (!acc[policyName]) {
      acc[policyName] = 0;
    }
    acc[policyName] += m.blockedRequests;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(violationsByPolicyData).map(([name, value]) => ({
    name,
    value
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <Box>
      {/* Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Policy</InputLabel>
            <Select
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              label="Policy"
            >
              <MenuItem value="all">All Policies</MenuItem>
              {policies.map(policy => (
                <MenuItem key={policy.id} value={policy.id}>
                  {policy.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              label="Time Range"
            >
              <MenuItem value={1}>Last Hour</MenuItem>
              <MenuItem value={6}>Last 6 Hours</MenuItem>
              <MenuItem value={24}>Last 24 Hours</MenuItem>
              <MenuItem value={168}>Last Week</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <Chip
            label={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            color={autoRefresh ? "success" : "default"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="small"
          />
          <Tooltip title="Refresh now">
            <IconButton onClick={loadData} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            size="small"
            onClick={triggerMetricsCollection}
            startIcon={<BarChartIcon />}
          >
            Collect Metrics
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* Real-time Stats */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Total Requests
                        </Typography>
                        <Typography variant="h4">
                          {totalRequests.toLocaleString()}
                        </Typography>
                      </Box>
                      <SpeedIcon fontSize="large" color="primary" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Blocked Requests
                        </Typography>
                        <Typography variant="h4" color="error">
                          {totalBlocked.toLocaleString()}
                        </Typography>
                      </Box>
                      <ErrorIcon fontSize="large" color="error" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Violation Rate
                        </Typography>
                        <Typography variant="h4">
                          {avgViolationRate.toFixed(2)}%
                        </Typography>
                      </Box>
                      {avgViolationRate > 5 ? (
                        <TrendingUpIcon fontSize="large" color="error" />
                      ) : (
                        <TrendingDownIcon fontSize="large" color="success" />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Recent Violations (5m)
                        </Typography>
                        <Typography variant="h4">
                          {realtimeMetrics?.recentViolations || 0}
                        </Typography>
                      </Box>
                      <TimelineIcon fontSize="large" color="warning" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>          {/* Violation Trend Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Violation Trend (Last 5 Minutes)
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={violationTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="minute" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <ChartTooltip 
                      labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="violations" 
                      stroke="#8884d8" 
                      name="Violations"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Top Violators Chart */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Violators
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topViolatorsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip />
                    <Bar dataKey="violations" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Violations by Policy */}
          {pieData.length > 0 && (
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Violations by Policy
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Performance Metrics */}
          <Grid item xs={12} md={pieData.length > 0 ? 8 : 12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Impact
                </Typography>
                <Grid container spacing={2}>
                  {metrics.slice(0, 5).map((metric, index) => (
                    <Grid item xs={12} key={index}>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2">
                          {metric.policyName || 'Unknown Policy'}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip 
                            label={`${metric.totalRequests} requests`} 
                            size="small" 
                            variant="outlined"
                          />
                          {metric.avgResponseTimeMs && (
                            <Chip 
                              label={`Avg: ${metric.avgResponseTimeMs.toFixed(0)}ms`} 
                              size="small" 
                              color="primary"
                              variant="outlined"
                            />
                          )}
                          {metric.p95ResponseTimeMs && (
                            <Chip 
                              label={`P95: ${metric.p95ResponseTimeMs.toFixed(0)}ms`} 
                              size="small" 
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                      <LinearProgress 
                        variant="determinate" 
                        value={metric.violationRate * 100} 
                        sx={{ mt: 1, height: 8, borderRadius: 4 }}
                        color={metric.violationRate > 0.1 ? "error" : "primary"}
                      />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Recent Violations Table */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Recent Violations
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Policy</TableCell>
                        <TableCell>Identifier</TableCell>
                        <TableCell>Endpoint</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Exceeded By</TableCell>
                        <TableCell>IP Address</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {violations.slice(0, 10).map((violation) => (
                        <TableRow key={violation.id}>
                          <TableCell>
                            <Typography variant="caption">
                              {new Date(violation.violatedAt).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={violation.policyName} 
                              size="small" 
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {violation.identifier}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                              {violation.endpoint}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={violation.method} 
                              size="small" 
                              color={violation.method === 'GET' ? 'primary' : 'secondary'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography 
                              variant="caption" 
                              color="error"
                              fontWeight="medium"
                            >
                              +{violation.limitExceededBy}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {violation.ipAddress || '-'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                      {violations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            <Box py={3}>
                              <CheckIcon color="success" sx={{ fontSize: 48 }} />
                              <Typography variant="body2" color="textSecondary">
                                No violations in the selected time range
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                {violations.length > 10 && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Showing 10 of {violations.length} violations. Export data for complete view.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};