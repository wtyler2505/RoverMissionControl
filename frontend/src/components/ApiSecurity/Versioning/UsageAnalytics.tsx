import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  Error as ErrorIcon,
  People as PeopleIcon,
  Public as PublicIcon,
  Star as FeatureIcon,
  Memory as ResourceIcon,
  Refresh as RefreshIcon,
  GetApp as DownloadIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { VersioningService } from '../../../services/versioningService';
import {
  VersionUsageMetrics,
  EndpointUsage,
  GeographicUsage,
  FeatureUsage,
  ResourceUsage,
  UsageTrend,
  UsageChart,
} from '../../../types/versioning';

const CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#ff00ff', '#00ffff', '#ff0000', '#800080', '#ffa500'
];

const UsageAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<VersionUsageMetrics | null>(null);
  const [analyticsCharts, setAnalyticsCharts] = useState<UsageChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [timeRange, setTimeRange] = useState<string>('30d');
  
  const [versions, setVersions] = useState<string[]>([]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const [metricsResponse, chartsResponse] = await Promise.all([
        VersioningService.getVersionMetrics(selectedVersion || undefined, timeRange),
        VersioningService.getUsageAnalytics(timeRange),
      ]);
      
      if (metricsResponse.success) {
        setMetrics(metricsResponse.data);
      } else {
        setError(metricsResponse.message || 'Failed to load metrics');
      }
      
      if (chartsResponse.success) {
        setAnalyticsCharts(chartsResponse.data);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const response = await VersioningService.getVersions();
      if (response.success) {
        const versionList = response.data.map(v => v.version);
        setVersions(versionList);
      }
    } catch (err) {
      console.error('Error loading versions:', err);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [selectedVersion, timeRange]);

  const handleExportData = () => {
    if (!metrics) return;
    
    const exportData = {
      metrics,
      exportedAt: new Date().toISOString(),
      filters: {
        version: selectedVersion,
        timeRange,
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-analytics-${timeRange}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${bytes} B`;
  };

  const getTrendIcon = (current: number, previous: number) => {
    if (current > previous) {
      return <TrendingUpIcon color="success" />;
    } else if (current < previous) {
      return <TrendingDownIcon color="error" />;
    }
    return <TrendingUpIcon color="disabled" />;
  };

  const renderMetricCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    trend?: { current: number; previous: number }
  ) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" component="div">
              {value}
            </Typography>
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {getTrendIcon(trend.current, trend.previous)}
                <Typography variant="caption" color="textSecondary" sx={{ ml: 0.5 }}>
                  vs previous period
                </Typography>
              </Box>
            )}
          </Box>
          <Box sx={{ color: 'primary.main' }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const renderChart = (chart: UsageChart) => {
    const commonProps = {
      width: '100%',
      height: 300,
      data: chart.data,
    };

    switch (chart.type) {
      case 'line':
        return (
          <ResponsiveContainer {...commonProps}>
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <RechartsTooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="y"
                stroke="#8884d8"
                strokeWidth={2}
                dot={{ fill: '#8884d8' }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer {...commonProps}>
            <AreaChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <RechartsTooltip />
              <Area
                type="monotone"
                dataKey="y"
                stroke="#82ca9d"
                fill="#82ca9d"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" />
              <YAxis />
              <RechartsTooltip />
              <Bar dataKey="y" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer {...commonProps}>
            <PieChart>
              <Pie
                data={chart.data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="y"
                label={({ x, y }) => `${x}: ${y}`}
              >
                {chart.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Usage Analytics</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Version</InputLabel>
            <Select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              label="Version"
            >
              <MenuItem value="">All Versions</MenuItem>
              {versions.map((version) => (
                <MenuItem key={version} value={version}>
                  {version}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          
          <Tooltip title="Refresh Data">
            <IconButton onClick={loadAnalytics}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Export Data">
            <IconButton onClick={handleExportData}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {metrics && (
        <>
          {/* Key Metrics */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              {renderMetricCard(
                'Total Requests',
                formatNumber(metrics.totalRequests),
                <AnalyticsIcon />
              )}
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              {renderMetricCard(
                'Avg Response Time',
                `${metrics.avgResponseTime}ms`,
                <SpeedIcon />
              )}
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              {renderMetricCard(
                'Error Rate',
                `${(metrics.errorRate * 100).toFixed(2)}%`,
                <ErrorIcon />
              )}
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              {renderMetricCard(
                'Unique Clients',
                formatNumber(metrics.uniqueClients),
                <PeopleIcon />
              )}
            </Grid>
          </Grid>

          {/* Charts from Analytics Service */}
          {analyticsCharts.length > 0 && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {analyticsCharts.map((chart, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Paper sx={{ p: 2, height: 400 }}>
                    <Typography variant="h6" gutterBottom>
                      {chart.title}
                    </Typography>
                    {renderChart(chart)}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Usage Trends */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Usage Trends Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <RechartsTooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke="#8884d8"
                      name="Requests"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#82ca9d"
                      name="Response Time (ms)"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#ff7300"
                      name="Error Rate (%)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Top Endpoints */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Top Endpoints
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Endpoint</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell align="right">Requests</TableCell>
                        <TableCell align="right">Avg Time</TableCell>
                        <TableCell align="right">Error Rate</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {metrics.topEndpoints.slice(0, 10).map((endpoint, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {endpoint.endpoint}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={endpoint.method}
                              size="small"
                              color={
                                endpoint.method === 'GET' ? 'primary' :
                                endpoint.method === 'POST' ? 'success' :
                                endpoint.method === 'PUT' ? 'warning' :
                                endpoint.method === 'DELETE' ? 'error' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">
                            {formatNumber(endpoint.requests)}
                          </TableCell>
                          <TableCell align="right">
                            {endpoint.avgResponseTime}ms
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${(endpoint.errorRate * 100).toFixed(1)}%`}
                              size="small"
                              color={endpoint.errorRate > 0.05 ? 'error' : 'success'}
                              variant="outlined"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>

            {/* Geographic Distribution */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Geographic Distribution
                </Typography>
                <List dense>
                  {metrics.geographicDistribution.slice(0, 10).map((geo, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <PublicIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={geo.country}
                        secondary={`${formatNumber(geo.requests)} requests (${geo.percentage.toFixed(1)}%)`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>

          {/* Feature Usage and Resource Utilization */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Feature Usage
                </Typography>
                <List dense>
                  {metrics.featureUsage.map((feature, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <FeatureIcon color="secondary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={feature.feature}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="textSecondary">
                              {formatNumber(feature.usageCount)} uses by {formatNumber(feature.uniqueUsers)} users
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Adoption rate: {(feature.adoptionRate * 100).toFixed(1)}%
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Resource Utilization
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <ResourceIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="CPU Usage"
                      secondary={`${metrics.resourceUtilization.cpuUsage.toFixed(1)}%`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ResourceIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Memory Usage"
                      secondary={formatBytes(metrics.resourceUtilization.memoryUsage)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ResourceIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Network Bandwidth"
                      secondary={`${formatBytes(metrics.resourceUtilization.networkBandwidth)}/s`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ResourceIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Storage Usage"
                      secondary={formatBytes(metrics.resourceUtilization.storageUsage)}
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
          </Grid>

          {/* Summary Statistics */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Summary Statistics
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="textSecondary">
                  Requests (24h)
                </Typography>
                <Typography variant="h6">
                  {formatNumber(metrics.requestsLast24h)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="textSecondary">
                  Requests (7d)
                </Typography>
                <Typography variant="h6">
                  {formatNumber(metrics.requestsLast7d)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="textSecondary">
                  Requests (30d)
                </Typography>
                <Typography variant="h6">
                  {formatNumber(metrics.requestsLast30d)}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="body2" color="textSecondary">
                  Version
                </Typography>
                <Typography variant="h6">
                  {metrics.version || 'All Versions'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default UsageAnalytics;