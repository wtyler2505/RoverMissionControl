/**
 * ConnectionMonitoringPanel - Real-time Connection Health Visualization
 * 
 * Displays connection health status for all monitored connections with
 * visual indicators, metrics, and controls for manual intervention.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Collapse,
  Badge,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import {
  SignalCellular4Bar as ExcellentIcon,
  SignalCellular3Bar as GoodIcon,
  SignalCellular2Bar as FairIcon,
  SignalCellular1Bar as PoorIcon,
  SignalCellularConnectedNoInternet0Bar as CriticalIcon,
  SignalCellularOff as DisconnectedIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  NetworkCheck as NetworkCheckIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Download as DownloadIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
} from '@mui/icons-material';
import {
  ConnectionHealthMonitor,
  ConnectionType,
  ConnectionHealthLevel,
  ConnectionHealthStatus,
  ConnectionQualityMetrics,
  HealthThresholds,
} from '../../services/websocket/ConnectionHealthMonitor';
import { useEmergencyStop } from '../../hooks/useEmergencyStop';
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
  ChartOptions,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

// Animation for critical connections
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const blink = keyframes`
  0%, 50%, 100% {
    opacity: 1;
  }
  25%, 75% {
    opacity: 0.3;
  }
`;

interface ConnectionMonitoringPanelProps {
  /**
   * Connection health monitor instance
   */
  monitor: ConnectionHealthMonitor;
  /**
   * Whether to show detailed metrics
   */
  showDetails?: boolean;
  /**
   * Whether to enable sound alerts
   */
  enableSoundAlerts?: boolean;
  /**
   * Whether to show the settings dialog
   */
  showSettings?: boolean;
  /**
   * Callback when emergency stop is triggered
   */
  onEmergencyStop?: (reason: string) => void;
  /**
   * Position of the panel
   */
  position?: {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
  };
}

interface MetricsHistory {
  timestamps: string[];
  latency: number[];
  packetLoss: number[];
  jitter: number[];
}

const ConnectionMonitoringPanel: React.FC<ConnectionMonitoringPanelProps> = ({
  monitor,
  showDetails = true,
  enableSoundAlerts = true,
  showSettings = true,
  onEmergencyStop,
  position = { top: 20, left: 20 },
}) => {
  const theme = useTheme();
  const { activateEmergencyStop } = useEmergencyStop();

  // State
  const [connections, setConnections] = useState<Map<string, ConnectionHealthStatus>>(new Map());
  const [overallHealth, setOverallHealth] = useState<ConnectionHealthLevel>(ConnectionHealthLevel.EXCELLENT);
  const [criticalConnections, setCriticalConnections] = useState<string[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [autoStop, setAutoStop] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(enableSoundAlerts);
  const [monitoringPaused, setMonitoringPaused] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<Map<string, MetricsHistory>>(new Map());
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  // Audio for alerts
  const warningSound = useMemo(() => {
    if (typeof window !== 'undefined' && soundEnabled) {
      return new Audio('/sounds/connection-warning.mp3');
    }
    return null;
  }, [soundEnabled]);

  const criticalSound = useMemo(() => {
    if (typeof window !== 'undefined' && soundEnabled) {
      return new Audio('/sounds/connection-critical.mp3');
    }
    return null;
  }, [soundEnabled]);

  // Update connections from monitor
  useEffect(() => {
    const updateInterval = setInterval(() => {
      if (!monitoringPaused) {
        const allConnections = monitor.getAllConnectionsStatus();
        setConnections(new Map(allConnections));
        setOverallHealth(monitor.getOverallHealth());
        setCriticalConnections(monitor.getCriticalConnections());

        // Update metrics history
        const newHistory = new Map(metricsHistory);
        for (const [id, connection] of allConnections) {
          let history = newHistory.get(id) || {
            timestamps: [],
            latency: [],
            packetLoss: [],
            jitter: [],
          };

          // Keep last 60 data points (1 minute at 1 second intervals)
          if (history.timestamps.length > 60) {
            history.timestamps.shift();
            history.latency.shift();
            history.packetLoss.shift();
            history.jitter.shift();
          }

          history.timestamps.push(new Date().toLocaleTimeString());
          history.latency.push(connection.metrics.latency);
          history.packetLoss.push(connection.metrics.packetLoss);
          history.jitter.push(connection.metrics.jitter);

          newHistory.set(id, history);
        }
        setMetricsHistory(newHistory);
      }
    }, 1000);

    return () => clearInterval(updateInterval);
  }, [monitor, monitoringPaused, metricsHistory]);

  // Set up callbacks
  useEffect(() => {
    monitor.setCallbacks({
      onHealthChange: (connectionId, health) => {
        console.log(`Connection ${connectionId} health changed to ${health}`);
        
        // Play sound for critical transitions
        if (health === ConnectionHealthLevel.CRITICAL && criticalSound) {
          criticalSound.play().catch(console.error);
        } else if (health === ConnectionHealthLevel.POOR && warningSound) {
          warningSound.play().catch(console.error);
        }
      },
      onConnectionLost: (connectionId, type) => {
        console.error(`Connection lost: ${connectionId} (${type})`);
        if (criticalSound) {
          criticalSound.play().catch(console.error);
        }
      },
      onEmergencyStop: (reason, connections) => {
        console.error(`Emergency stop triggered: ${reason}`, connections);
        if (autoStop) {
          activateEmergencyStop(reason);
          onEmergencyStop?.(reason);
        }
      },
      onSafeStateTransition: (transition) => {
        console.log('Safe state transition:', transition);
      },
    });
  }, [monitor, autoStop, soundEnabled, warningSound, criticalSound, activateEmergencyStop, onEmergencyStop]);

  // Get connection health icon
  const getHealthIcon = (health: ConnectionHealthLevel) => {
    switch (health) {
      case ConnectionHealthLevel.EXCELLENT:
        return <ExcellentIcon sx={{ color: theme.palette.success.main }} />;
      case ConnectionHealthLevel.GOOD:
        return <GoodIcon sx={{ color: theme.palette.success.light }} />;
      case ConnectionHealthLevel.FAIR:
        return <FairIcon sx={{ color: theme.palette.warning.main }} />;
      case ConnectionHealthLevel.POOR:
        return <PoorIcon sx={{ color: theme.palette.warning.dark }} />;
      case ConnectionHealthLevel.CRITICAL:
        return <CriticalIcon sx={{ color: theme.palette.error.main }} />;
      case ConnectionHealthLevel.DISCONNECTED:
        return <DisconnectedIcon sx={{ color: theme.palette.error.dark }} />;
    }
  };

  // Get connection type label
  const getConnectionTypeLabel = (type: ConnectionType) => {
    switch (type) {
      case ConnectionType.WEBSOCKET:
        return 'WebSocket';
      case ConnectionType.REST_API:
        return 'REST API';
      case ConnectionType.HARDWARE_SERIAL:
        return 'Serial Port';
      case ConnectionType.HARDWARE_USB:
        return 'USB Device';
      case ConnectionType.HARDWARE_GPIO:
        return 'GPIO';
      default:
        return type;
    }
  };

  // Toggle connection expansion
  const toggleConnectionExpansion = (connectionId: string) => {
    const newExpanded = new Set(expandedConnections);
    if (newExpanded.has(connectionId)) {
      newExpanded.delete(connectionId);
    } else {
      newExpanded.add(connectionId);
    }
    setExpandedConnections(newExpanded);
  };

  // Export metrics report
  const handleExportMetrics = () => {
    const report = monitor.exportMetricsReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-metrics-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Refresh all connections
  const handleRefreshAll = () => {
    // This would trigger a refresh in the actual implementation
    console.log('Refreshing all connections...');
  };

  // Chart options
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  // Get overall health color
  const getOverallHealthColor = () => {
    switch (overallHealth) {
      case ConnectionHealthLevel.EXCELLENT:
      case ConnectionHealthLevel.GOOD:
        return theme.palette.success.main;
      case ConnectionHealthLevel.FAIR:
        return theme.palette.warning.main;
      case ConnectionHealthLevel.POOR:
      case ConnectionHealthLevel.CRITICAL:
        return theme.palette.error.main;
      case ConnectionHealthLevel.DISCONNECTED:
        return theme.palette.error.dark;
    }
  };

  return (
    <>
      <Paper
        sx={{
          position: 'fixed',
          ...position,
          width: 400,
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: theme.zIndex.drawer + 1,
          boxShadow: theme.shadows[8],
          ...(criticalConnections.length > 0 && {
            animation: `${pulse} 2s ease-in-out infinite`,
            border: `2px solid ${theme.palette.error.main}`,
          }),
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            backgroundColor: alpha(getOverallHealthColor(), 0.1),
            borderBottom: `3px solid ${getOverallHealthColor()}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NetworkCheckIcon sx={{ color: getOverallHealthColor() }} />
            <Typography variant="h6">Connection Monitor</Typography>
            {criticalConnections.length > 0 && (
              <Badge badgeContent={criticalConnections.length} color="error">
                <WarningIcon
                  sx={{
                    animation: `${blink} 1s ease-in-out infinite`,
                    color: theme.palette.error.main,
                  }}
                />
              </Badge>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={monitoringPaused ? 'Resume monitoring' : 'Pause monitoring'}>
              <IconButton
                size="small"
                onClick={() => setMonitoringPaused(!monitoringPaused)}
              >
                {monitoringPaused ? <PlayIcon /> : <PauseIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh all">
              <IconButton size="small" onClick={handleRefreshAll}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export metrics">
              <IconButton size="small" onClick={handleExportMetrics}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={soundEnabled ? 'Disable sound alerts' : 'Enable sound alerts'}>
              <IconButton
                size="small"
                onClick={() => setSoundEnabled(!soundEnabled)}
              >
                {soundEnabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
              </IconButton>
            </Tooltip>
            {showSettings && (
              <Tooltip title="Settings">
                <IconButton
                  size="small"
                  onClick={() => setShowSettingsDialog(true)}
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Critical Alert */}
        {criticalConnections.length > 0 && (
          <Alert
            severity="error"
            sx={{ m: 2, mb: 0 }}
            action={
              autoStop ? null : (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() =>
                    activateEmergencyStop('Manual stop due to connection loss')
                  }
                >
                  STOP NOW
                </Button>
              )
            }
          >
            <AlertTitle>Critical Connection Failure</AlertTitle>
            {criticalConnections.length} connection(s) in critical state
            {autoStop && ' - Emergency stop will trigger automatically'}
          </Alert>
        )}

        {/* Connection List */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Grid container spacing={2}>
            {Array.from(connections.entries()).map(([id, connection]) => {
              const isExpanded = expandedConnections.has(id);
              const isCritical =
                connection.health === ConnectionHealthLevel.CRITICAL ||
                connection.health === ConnectionHealthLevel.DISCONNECTED;

              return (
                <Grid item xs={12} key={id}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      ...(isCritical && {
                        backgroundColor: alpha(theme.palette.error.main, 0.05),
                        border: `1px solid ${theme.palette.error.main}`,
                      }),
                      '&:hover': {
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.05
                        ),
                      },
                    }}
                    onClick={() => toggleConnectionExpansion(id)}
                  >
                    {/* Connection Header */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getHealthIcon(connection.health)}
                        <Box>
                          <Typography variant="subtitle1">
                            {getConnectionTypeLabel(connection.type)}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {id}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={connection.health}
                          size="small"
                          sx={{
                            backgroundColor: alpha(
                              getOverallHealthColor(),
                              0.1
                            ),
                            color: getOverallHealthColor(),
                          }}
                        />
                        {connection.metrics.latency > 0 && (
                          <Typography variant="caption" color="textSecondary">
                            {connection.metrics.latency.toFixed(0)}ms
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {/* Expanded Details */}
                    <Collapse in={isExpanded && showDetails}>
                      <Box sx={{ mt: 2 }}>
                        {/* Metrics */}
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={6}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                Avg Latency
                              </Typography>
                              <Typography variant="body2">
                                {connection.metrics.averageLatency.toFixed(1)}ms
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                Packet Loss
                              </Typography>
                              <Typography variant="body2">
                                {connection.metrics.packetLoss.toFixed(1)}%
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                Jitter
                              </Typography>
                              <Typography variant="body2">
                                {connection.metrics.jitter.toFixed(1)}ms
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box>
                              <Typography
                                variant="caption"
                                color="textSecondary"
                              >
                                Uptime
                              </Typography>
                              <Typography variant="body2">
                                {Math.floor(connection.uptime / 1000)}s
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Latency Chart */}
                        {metricsHistory.has(id) && (
                          <Box sx={{ height: 100, mb: 1 }}>
                            <Line
                              data={{
                                labels: metricsHistory.get(id)!.timestamps,
                                datasets: [
                                  {
                                    data: metricsHistory.get(id)!.latency,
                                    borderColor: theme.palette.primary.main,
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.1
                                    ),
                                    tension: 0.4,
                                  },
                                ],
                              }}
                              options={chartOptions}
                            />
                          </Box>
                        )}

                        {/* Progress Bars */}
                        <Box sx={{ mb: 1 }}>
                          <Typography variant="caption" color="textSecondary">
                            Connection Quality
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={
                              connection.health === ConnectionHealthLevel.EXCELLENT
                                ? 100
                                : connection.health === ConnectionHealthLevel.GOOD
                                ? 80
                                : connection.health === ConnectionHealthLevel.FAIR
                                ? 60
                                : connection.health === ConnectionHealthLevel.POOR
                                ? 40
                                : 20
                            }
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: alpha(
                                theme.palette.action.disabled,
                                0.1
                              ),
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: getOverallHealthColor(),
                              },
                            }}
                          />
                        </Box>

                        {/* Recent Errors */}
                        {connection.errors.length > 0 && (
                          <Box>
                            <Typography
                              variant="caption"
                              color="error"
                              sx={{ display: 'block', mb: 0.5 }}
                            >
                              Recent Errors:
                            </Typography>
                            {connection.errors.slice(-3).map((error, i) => (
                              <Typography
                                key={i}
                                variant="caption"
                                color="textSecondary"
                                sx={{ display: 'block' }}
                              >
                                {new Date(error.timestamp).toLocaleTimeString()}:{' '}
                                {error.message}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      </Paper>

      {/* Settings Dialog */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Connection Monitoring Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoStop}
                  onChange={(e) => setAutoStop(e.target.checked)}
                />
              }
              label="Enable automatic emergency stop on critical connection loss"
            />
            <Typography variant="caption" color="textSecondary" sx={{ ml: 4 }}>
              When enabled, the system will automatically trigger an emergency stop
              when critical hardware connections are lost
            </Typography>

            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Connection Thresholds
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Configure thresholds for connection health levels
              </Typography>
              {/* Threshold configuration would go here */}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConnectionMonitoringPanel;