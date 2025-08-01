import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  LinearProgress,
  Chip,
  Alert,
  AlertTitle,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  SignalCellularAlt as SignalIcon,
  Build as BuildIcon,
  BugReport as BugIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import axios from 'axios';

interface DeviceHealth {
  device_id: string;
  health_status: 'healthy' | 'warning' | 'critical' | 'unknown';
  is_connected: boolean;
  error_rate: number;
  last_activity: string | null;
  uptime_seconds: number;
  quick_stats: {
    bytes_sent: number;
    bytes_received: number;
    error_count: number;
  };
}

interface DiagnosticSession {
  session_id: string;
  device_id: string;
  level: string;
  status: 'started' | 'running' | 'completed' | 'error';
  progress?: number;
  current_test?: string;
  error?: string;
}

interface DiagnosticReport {
  device_id: string;
  device_name: string;
  protocol_type: string;
  health_status: string;
  health_score: number;
  test_results: TestResult[];
  metrics: CommunicationMetrics | null;
  tests_passed: number;
  tests_failed: number;
  tests_warning: number;
  recommendations: string[];
  duration: number;
  timestamp: string;
}

interface TestResult {
  test_id: string;
  test_name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped' | 'error';
  duration: number;
  message: string;
  details: Record<string, any>;
  error?: string;
}

interface CommunicationMetrics {
  latency_avg: number;
  latency_min: number;
  latency_max: number;
  throughput_tx: number;
  throughput_rx: number;
  error_rate: number;
  uptime_seconds: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`diagnostic-tabpanel-${index}`}
      aria-labelledby={`diagnostic-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const DiagnosticsDashboard: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const [devices, setDevices] = useState<DeviceHealth[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [runningDiagnostics, setRunningDiagnostics] = useState<Map<string, DiagnosticSession>>(new Map());
  const [diagnosticReports, setDiagnosticReports] = useState<Map<string, DiagnosticReport>>(new Map());
  const [tabValue, setTabValue] = useState(0);
  const [diagnosticLevel, setDiagnosticLevel] = useState('standard');
  const [showDiagnosticDialog, setShowDiagnosticDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch device health status
  const fetchDeviceHealth = useCallback(async () => {
    try {
      const response = await axios.get('/api/hardware/diagnostics/health');
      setDevices(response.data);
    } catch (error) {
      console.error('Failed to fetch device health:', error);
    }
  }, []);

  // Auto-refresh
  useEffect(() => {
    fetchDeviceHealth();
    
    if (autoRefresh) {
      const interval = setInterval(fetchDeviceHealth, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchDeviceHealth, autoRefresh]);

  // Check diagnostic sessions
  useEffect(() => {
    const checkSessions = async () => {
      const sessions = Array.from(runningDiagnostics.values());
      
      for (const session of sessions) {
        if (session.status === 'started' || session.status === 'running') {
          try {
            const statusResponse = await axios.get(`/api/hardware/diagnostics/status/${session.session_id}`);
            const updatedSession = { ...session, ...statusResponse.data };
            
            setRunningDiagnostics(prev => new Map(prev).set(session.session_id, updatedSession));
            
            if (updatedSession.status === 'completed') {
              // Fetch the full report
              const reportResponse = await axios.get(`/api/hardware/diagnostics/report/${session.session_id}`);
              setDiagnosticReports(prev => new Map(prev).set(session.device_id, reportResponse.data));
              
              enqueueSnackbar(`Diagnostics completed for ${session.device_id}`, { variant: 'success' });
              
              // Remove from running
              setRunningDiagnostics(prev => {
                const newMap = new Map(prev);
                newMap.delete(session.session_id);
                return newMap;
              });
            } else if (updatedSession.status === 'error') {
              enqueueSnackbar(`Diagnostics failed for ${session.device_id}: ${updatedSession.error}`, { variant: 'error' });
              
              // Remove from running
              setRunningDiagnostics(prev => {
                const newMap = new Map(prev);
                newMap.delete(session.session_id);
                return newMap;
              });
            }
          } catch (error) {
            console.error('Failed to check diagnostic session:', error);
          }
        }
      }
    };
    
    if (runningDiagnostics.size > 0) {
      const interval = setInterval(checkSessions, 1000);
      return () => clearInterval(interval);
    }
  }, [runningDiagnostics, enqueueSnackbar]);

  const runDiagnostics = async () => {
    if (!selectedDevice) {
      enqueueSnackbar('Please select a device', { variant: 'warning' });
      return;
    }
    
    setShowDiagnosticDialog(false);
    setLoading(true);
    
    try {
      const response = await axios.post(`/api/hardware/diagnostics/run/${selectedDevice}`, null, {
        params: { level: diagnosticLevel }
      });
      
      const session: DiagnosticSession = {
        ...response.data,
        progress: 0,
        current_test: 'Initializing...'
      };
      
      setRunningDiagnostics(prev => new Map(prev).set(session.session_id, session));
      enqueueSnackbar(`Diagnostics started for ${selectedDevice}`, { variant: 'info' });
    } catch (error) {
      enqueueSnackbar('Failed to start diagnostics', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (deviceId: string) => {
    const report = diagnosticReports.get(deviceId);
    if (!report) return;
    
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `diagnostic_report_${deviceId}_${new Date().toISOString()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'critical':
        return <ErrorIcon color="error" />;
      default:
        return <InfoIcon color="disabled" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        {/* Header */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" component="h1">
              Hardware Diagnostics
            </Typography>
            <Box>
              <Tooltip title="Auto-refresh">
                <IconButton
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  color={autoRefresh ? 'primary' : 'default'}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<PlayIcon />}
                onClick={() => setShowDiagnosticDialog(true)}
                disabled={devices.length === 0}
              >
                Run Diagnostics
              </Button>
            </Box>
          </Box>
        </Grid>

        {/* Device Health Overview */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Device Health Overview
              </Typography>
              <Grid container spacing={2}>
                {devices.map((device) => (
                  <Grid item xs={12} sm={6} md={4} key={device.device_id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle1">{device.device_id}</Typography>
                          <Chip
                            icon={getHealthIcon(device.health_status)}
                            label={device.health_status.toUpperCase()}
                            color={getHealthColor(device.health_status) as any}
                            size="small"
                          />
                        </Box>
                        <Box mt={2}>
                          <Typography variant="body2" color="text.secondary">
                            Connection: {device.is_connected ? 'Connected' : 'Disconnected'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Error Rate: {device.error_rate.toFixed(2)}%
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Uptime: {formatDuration(device.uptime_seconds)}
                          </Typography>
                          <Box mt={1} display="flex" justifyContent="space-between">
                            <Typography variant="caption">
                              TX: {formatBytes(device.quick_stats.bytes_sent)}
                            </Typography>
                            <Typography variant="caption">
                              RX: {formatBytes(device.quick_stats.bytes_received)}
                            </Typography>
                          </Box>
                        </Box>
                        
                        {/* Running diagnostic indicator */}
                        {Array.from(runningDiagnostics.values()).some(s => s.device_id === device.device_id) && (
                          <Box mt={2}>
                            <LinearProgress />
                            <Typography variant="caption" color="primary">
                              Running diagnostics...
                            </Typography>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Diagnostic Reports */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
                <Tab label="Test Results" />
                <Tab label="Performance Metrics" />
                <Tab label="Recommendations" />
              </Tabs>

              <TabPanel value={tabValue} index={0}>
                {diagnosticReports.size > 0 ? (
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Device</TableCell>
                          <TableCell>Test</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Duration</TableCell>
                          <TableCell>Message</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Array.from(diagnosticReports.entries()).map(([deviceId, report]) => (
                          report.test_results.map((test) => (
                            <TableRow key={`${deviceId}-${test.test_id}`}>
                              <TableCell>{deviceId}</TableCell>
                              <TableCell>{test.test_name}</TableCell>
                              <TableCell>
                                <Chip
                                  icon={test.status === 'passed' ? <CheckIcon /> : 
                                        test.status === 'failed' ? <ErrorIcon /> :
                                        test.status === 'warning' ? <WarningIcon /> : <InfoIcon />}
                                  label={test.status.toUpperCase()}
                                  color={test.status === 'passed' ? 'success' : 
                                         test.status === 'failed' ? 'error' :
                                         test.status === 'warning' ? 'warning' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>{test.duration.toFixed(2)}s</TableCell>
                              <TableCell>{test.message}</TableCell>
                              <TableCell>
                                <Tooltip title="View Details">
                                  <IconButton size="small">
                                    <InfoIcon />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info">
                    <AlertTitle>No Diagnostic Reports</AlertTitle>
                    Run diagnostics on a device to see test results.
                  </Alert>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                {diagnosticReports.size > 0 ? (
                  <Grid container spacing={3}>
                    {Array.from(diagnosticReports.entries()).map(([deviceId, report]) => (
                      report.metrics && (
                        <Grid item xs={12} md={6} key={deviceId}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="h6" gutterBottom>
                                {deviceId} Performance
                              </Typography>
                              <List dense>
                                <ListItem>
                                  <ListItemIcon>
                                    <SpeedIcon />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Latency"
                                    secondary={`Avg: ${report.metrics.latency_avg.toFixed(2)}ms (Min: ${report.metrics.latency_min.toFixed(2)}ms, Max: ${report.metrics.latency_max.toFixed(2)}ms)`}
                                  />
                                </ListItem>
                                <Divider />
                                <ListItem>
                                  <ListItemIcon>
                                    <SignalIcon />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Throughput"
                                    secondary={`TX: ${(report.metrics.throughput_tx / 1024).toFixed(2)} KB/s, RX: ${(report.metrics.throughput_rx / 1024).toFixed(2)} KB/s`}
                                  />
                                </ListItem>
                                <Divider />
                                <ListItem>
                                  <ListItemIcon>
                                    <WarningIcon />
                                  </ListItemIcon>
                                  <ListItemText
                                    primary="Error Rate"
                                    secondary={`${report.metrics.error_rate.toFixed(3)}%`}
                                  />
                                </ListItem>
                              </List>
                            </CardContent>
                          </Card>
                        </Grid>
                      )
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="info">
                    <AlertTitle>No Performance Data</AlertTitle>
                    Run diagnostics to collect performance metrics.
                  </Alert>
                )}
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                {diagnosticReports.size > 0 ? (
                  <Grid container spacing={3}>
                    {Array.from(diagnosticReports.entries()).map(([deviceId, report]) => (
                      <Grid item xs={12} key={deviceId}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box display="flex" justifyContent="space-between" alignItems="center">
                              <Typography variant="h6" gutterBottom>
                                {deviceId} Recommendations
                              </Typography>
                              <IconButton onClick={() => downloadReport(deviceId)} size="small">
                                <DownloadIcon />
                              </IconButton>
                            </Box>
                            {report.recommendations.length > 0 ? (
                              <List>
                                {report.recommendations.map((rec, index) => (
                                  <ListItem key={index}>
                                    <ListItemIcon>
                                      <BuildIcon />
                                    </ListItemIcon>
                                    <ListItemText primary={rec} />
                                  </ListItem>
                                ))}
                              </List>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No recommendations - device is operating normally.
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Alert severity="info">
                    <AlertTitle>No Recommendations</AlertTitle>
                    Run diagnostics to get troubleshooting recommendations.
                  </Alert>
                )}
              </TabPanel>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Diagnostic Dialog */}
      <Dialog open={showDiagnosticDialog} onClose={() => setShowDiagnosticDialog(false)}>
        <DialogTitle>Run Diagnostics</DialogTitle>
        <DialogContent>
          <Box sx={{ minWidth: 400, pt: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Device</InputLabel>
              <Select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                label="Select Device"
              >
                {devices.map((device) => (
                  <MenuItem key={device.device_id} value={device.device_id}>
                    {device.device_id} - {device.health_status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Diagnostic Level</InputLabel>
              <Select
                value={diagnosticLevel}
                onChange={(e) => setDiagnosticLevel(e.target.value)}
                label="Diagnostic Level"
              >
                <MenuItem value="basic">Basic - Connection and I/O</MenuItem>
                <MenuItem value="standard">Standard - Performance and Reliability</MenuItem>
                <MenuItem value="comprehensive">Comprehensive - Full Test Suite</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDiagnosticDialog(false)}>Cancel</Button>
          <Button onClick={runDiagnostics} variant="contained" disabled={!selectedDevice || loading}>
            {loading ? <CircularProgress size={24} /> : 'Run Diagnostics'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DiagnosticsDashboard;