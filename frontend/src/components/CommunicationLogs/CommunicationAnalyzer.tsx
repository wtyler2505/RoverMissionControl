import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  AlertTitle,
  Tab,
  Tabs,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Refresh as RefreshIcon,
  Analytics as AnalyticsIcon,
  NetworkCheck as NetworkIcon,
  Storage as StorageIcon,
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
  Tooltip as ChartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface CommunicationSummary {
  time_range: {
    start: string;
    end: string;
    hours: number;
  };
  total_entries: number;
  by_protocol: Record<string, number>;
  by_adapter: Record<string, number>;
  by_level: Record<string, number>;
  errors: Array<{
    timestamp: string;
    adapter_id: string;
    error: string;
  }>;
  top_devices: Record<string, number>;
  data_volume: {
    total_bytes: number;
    tx_bytes: number;
    rx_bytes: number;
  };
  current_status: {
    adapters: Record<string, any>;
    devices: Record<string, any>;
    summary: {
      total_adapters: number;
      connected_adapters: number;
      total_devices: number;
      active_devices: number;
    };
  };
}

interface ProtocolAnalysis {
  protocol_type: string;
  summary: string;
  details: Record<string, any>;
  warnings: string[];
  errors: string[];
  timestamp: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const CommunicationAnalyzer: React.FC = () => {
  const [summary, setSummary] = useState<CommunicationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(1); // hours
  const [activeTab, setActiveTab] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('');
  const [analysis, setAnalysis] = useState<ProtocolAnalysis | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/hardware/logs/summary?hours=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [timeRange]);

  const protocolData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.by_protocol).map(([name, value]) => ({
      name,
      value,
    }));
  }, [summary]);

  const levelData = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.by_level).map(([name, value]) => ({
      name: name.toUpperCase(),
      value,
    }));
  }, [summary]);

  const dataVolumeChart = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'TX', value: summary.data_volume.tx_bytes },
      { name: 'RX', value: summary.data_volume.rx_bytes },
    ];
  }, [summary]);

  const renderOverview = () => {
    if (!summary) return null;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Logs
                  </Typography>
                  <Typography variant="h4">
                    {summary.total_entries.toLocaleString()}
                  </Typography>
                </Box>
                <TimelineIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Data Volume
                  </Typography>
                  <Typography variant="h4">
                    {formatBytes(summary.data_volume.total_bytes)}
                  </Typography>
                </Box>
                <StorageIcon color="secondary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Devices
                  </Typography>
                  <Typography variant="h4">
                    {summary.current_status.summary.active_devices} / {summary.current_status.summary.total_devices}
                  </Typography>
                </Box>
                <NetworkIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Error Rate
                  </Typography>
                  <Typography variant="h4">
                    {summary.errors.length}
                  </Typography>
                </Box>
                <ErrorIcon color="error" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Protocol Distribution
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie
                  data={protocolData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {protocolData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 300 }}>
            <Typography variant="h6" gutterBottom>
              Log Levels
            </Typography>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={levelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {levelData.map((entry, index) => {
                    let fill = COLORS[0];
                    if (entry.name === 'ERROR') fill = '#FF0000';
                    else if (entry.name === 'WARNING') fill = '#FFA500';
                    else if (entry.name === 'INFO') fill = '#00C49F';
                    else if (entry.name === 'DEBUG') fill = '#0088FE';
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Data Flow
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dataVolumeChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatBytes(value)} />
                <ChartTooltip formatter={(value: number) => formatBytes(value)} />
                <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" />
              </AreaChart>
            </ResponsiveContainer>
            <Box display="flex" justifyContent="space-around" mt={2}>
              <Box textAlign="center">
                <Typography variant="caption" color="textSecondary">
                  Transmit (TX)
                </Typography>
                <Typography variant="h6" color="primary">
                  {formatBytes(summary.data_volume.tx_bytes)}
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="caption" color="textSecondary">
                  Receive (RX)
                </Typography>
                <Typography variant="h6" color="secondary">
                  {formatBytes(summary.data_volume.rx_bytes)}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderDevices = () => {
    if (!summary) return null;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Device Activity
            </Typography>
            <List>
              {Object.entries(summary.top_devices)
                .sort(([, a], [, b]) => b - a)
                .map(([deviceId, count]) => {
                  const device = summary.current_status.devices[deviceId];
                  return (
                    <React.Fragment key={deviceId}>
                      <ListItem>
                        <ListItemIcon>
                          <Chip
                            label={device?.protocol || 'Unknown'}
                            size="small"
                            color={device?.active ? 'success' : 'default'}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={device?.name || deviceId}
                          secondary={`${count} messages • ${device?.address || 'No address'}`}
                        />
                        <Box>
                          <LinearProgress
                            variant="determinate"
                            value={(count / summary.total_entries) * 100}
                            sx={{ width: 100, mb: 0.5 }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            {((count / summary.total_entries) * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  );
                })}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Adapter Status
            </Typography>
            <List dense>
              {Object.entries(summary.current_status.adapters).map(([adapterId, adapter]) => (
                <ListItem key={adapterId}>
                  <ListItemIcon>
                    {adapter.connected ? (
                      <SuccessIcon color="success" />
                    ) : (
                      <ErrorIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={adapterId}
                    secondary={`${adapter.protocol} • ${adapter.status}`}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    );
  };

  const renderErrors = () => {
    if (!summary) return null;

    return (
      <Box>
        {summary.errors.length === 0 ? (
          <Alert severity="success">
            <AlertTitle>No Errors</AlertTitle>
            No communication errors detected in the last {timeRange} hour(s).
          </Alert>
        ) : (
          <List>
            {summary.errors.map((error, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    <ErrorIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary={error.error}
                    secondary={
                      <>
                        <Typography component="span" variant="body2">
                          {error.adapter_id}
                        </Typography>
                        {' • '}
                        <Typography component="span" variant="body2" color="textSecondary">
                          {format(new Date(error.timestamp), 'PPpp')}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
                {index < summary.errors.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h5">
            Communication Analysis
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Time Range</InputLabel>
              <Select
                value={timeRange}
                label="Time Range"
                onChange={(e) => setTimeRange(e.target.value as number)}
              >
                <MenuItem value={1}>Last Hour</MenuItem>
                <MenuItem value={3}>Last 3 Hours</MenuItem>
                <MenuItem value={6}>Last 6 Hours</MenuItem>
                <MenuItem value={12}>Last 12 Hours</MenuItem>
                <MenuItem value={24}>Last 24 Hours</MenuItem>
              </Select>
            </FormControl>
            <IconButton onClick={fetchSummary} disabled={loading}>
              <Tooltip title="Refresh">
                {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
              </Tooltip>
            </IconButton>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab label="Overview" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Devices" icon={<NetworkIcon />} iconPosition="start" />
          <Tab
            label={`Errors (${summary?.errors.length || 0})`}
            icon={<ErrorIcon />}
            iconPosition="start"
          />
        </Tabs>
        <Box sx={{ p: 3 }}>
          {activeTab === 0 && renderOverview()}
          {activeTab === 1 && renderDevices()}
          {activeTab === 2 && renderErrors()}
        </Box>
      </Paper>
    </Box>
  );
};
