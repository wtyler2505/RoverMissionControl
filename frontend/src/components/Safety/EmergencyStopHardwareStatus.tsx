/**
 * Emergency Stop Hardware Status Component
 * 
 * Displays real-time hardware status for all connected emergency stop devices
 * with health monitoring, fault detection, and diagnostic information.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  LinearProgress,
  Tooltip,
  IconButton,
  Alert,
  AlertTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondary,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Power as PowerIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Router as RouterIcon,
  Refresh as RefreshIcon,
  BugReport as BugReportIcon,
  Timeline as TimelineIcon,
  Usb as UsbIcon,
  Cable as CableIcon,
  Sensors as SensorsIcon,
} from '@mui/icons-material';
import {
  EmergencyDevice,
  ButtonType,
  EmergencyStopState,
  FaultType,
  SystemSafetyState,
  useEmergencyStop,
} from '../../hooks/useEmergencyStop';

interface EmergencyStopHardwareStatusProps {
  /**
   * Whether to show detailed diagnostics
   */
  showDiagnostics?: boolean;
  /**
   * Callback when device is selected
   */
  onDeviceSelect?: (deviceId: string) => void;
  /**
   * Whether to show refresh button
   */
  showRefresh?: boolean;
  /**
   * Compact mode for smaller displays
   */
  compact?: boolean;
}

const EmergencyStopHardwareStatus: React.FC<EmergencyStopHardwareStatusProps> = ({
  showDiagnostics = true,
  onDeviceSelect,
  showRefresh = true,
  compact = false,
}) => {
  const theme = useTheme();
  const {
    status,
    isConnected,
    isLoading,
    error,
    refreshDevices,
    getHealthyDeviceCount,
  } = useEmergencyStop();

  // Get status color based on system state
  const getStatusColor = (state: SystemSafetyState) => {
    switch (state) {
      case SystemSafetyState.SAFE:
        return theme.palette.success.main;
      case SystemSafetyState.WARNING:
        return theme.palette.warning.main;
      case SystemSafetyState.EMERGENCY:
        return theme.palette.error.main;
      case SystemSafetyState.CRITICAL:
        return theme.palette.error.dark;
      default:
        return theme.palette.grey[500];
    }
  };

  // Get device state icon
  const getDeviceStateIcon = (state: EmergencyStopState) => {
    switch (state) {
      case EmergencyStopState.NORMAL:
        return <CheckCircleIcon color="success" />;
      case EmergencyStopState.TRIGGERED:
        return <ErrorIcon color="error" />;
      case EmergencyStopState.FAULT:
        return <WarningIcon color="warning" />;
      case EmergencyStopState.TEST:
        return <InfoIcon color="info" />;
      default:
        return <InfoIcon color="disabled" />;
    }
  };

  // Get device type icon
  const getDeviceTypeIcon = (type: ButtonType) => {
    switch (type) {
      case ButtonType.PRIMARY:
        return <PowerIcon />;
      case ButtonType.SECONDARY:
        return <RouterIcon />;
      case ButtonType.REMOTE:
        return <SensorsIcon />;
      case ButtonType.SOFTWARE:
        return <MemoryIcon />;
      default:
        return <CableIcon />;
    }
  };

  // Format fault codes for display
  const formatFaultCode = (fault: FaultType): string => {
    return fault.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  // Format voltage display
  const formatVoltage = (voltage: number): string => {
    return voltage > 0 ? `${voltage.toFixed(1)}V` : 'N/A';
  };

  // Format response time
  const formatResponseTime = (ms: number): string => {
    return ms > 0 ? `${ms.toFixed(0)}ms` : 'N/A';
  };

  // Calculate system health percentage
  const getSystemHealth = (): number => {
    const total = status.deviceCount;
    if (total === 0) return 0;
    const healthy = getHealthyDeviceCount();
    return Math.round((healthy / total) * 100);
  };

  if (isLoading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
          Connecting to emergency stop hardware...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Hardware Connection Error</AlertTitle>
        {error}
      </Alert>
    );
  }

  if (!isConnected) {
    return (
      <Alert severity="warning">
        <AlertTitle>Hardware Disconnected</AlertTitle>
        Not connected to emergency stop hardware system
      </Alert>
    );
  }

  const healthPercentage = getSystemHealth();
  const devices = Object.values(status.devices);

  return (
    <Box>
      {/* System Overview */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              Emergency Stop Hardware Status
            </Typography>
            {showRefresh && (
              <Tooltip title="Refresh devices">
                <IconButton onClick={refreshDevices} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  System State
                </Typography>
                <Chip
                  label={status.systemState}
                  sx={{
                    mt: 1,
                    backgroundColor: alpha(getStatusColor(status.systemState), 0.1),
                    color: getStatusColor(status.systemState),
                    fontWeight: 'bold',
                  }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Connected Devices
                </Typography>
                <Typography variant="h4" sx={{ mt: 1 }}>
                  {status.deviceCount}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  System Health
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="h4" sx={{ mr: 1 }}>
                    {healthPercentage}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={healthPercentage}
                    sx={{
                      width: 60,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: alpha(theme.palette.error.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor:
                          healthPercentage >= 80
                            ? theme.palette.success.main
                            : healthPercentage >= 50
                            ? theme.palette.warning.main
                            : theme.palette.error.main,
                      },
                    }}
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary">
                  Active Faults
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    mt: 1,
                    color: status.activeFaults.length > 0 ? theme.palette.error.main : 'inherit',
                  }}
                >
                  {status.activeFaults.length}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Device List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Connected Devices
          </Typography>

          {devices.length === 0 ? (
            <Alert severity="warning">
              No emergency stop devices detected. Please check hardware connections.
            </Alert>
          ) : (
            <List>
              {devices.map((device, index) => (
                <React.Fragment key={device.deviceId}>
                  {index > 0 && <Divider />}
                  <ListItem
                    button={!!onDeviceSelect}
                    onClick={() => onDeviceSelect?.(device.deviceId)}
                    sx={{
                      py: compact ? 1 : 2,
                      '&:hover': onDeviceSelect ? {
                        backgroundColor: alpha(theme.palette.primary.main, 0.05),
                      } : undefined,
                    }}
                  >
                    <ListItemIcon>
                      {getDeviceStateIcon(device.state)}
                    </ListItemIcon>

                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {device.deviceId}
                          </Typography>
                          <Chip
                            icon={getDeviceTypeIcon(device.buttonType)}
                            label={device.buttonType}
                            size="small"
                            variant="outlined"
                          />
                          {device.state === EmergencyStopState.TRIGGERED && (
                            <Chip
                              label="TRIGGERED"
                              size="small"
                              color="error"
                              sx={{ animation: 'pulse 1s infinite' }}
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={compact ? 12 : 4}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <PowerIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="textSecondary">
                                  Voltage: {formatVoltage(device.voltage)}
                                </Typography>
                              </Box>
                            </Grid>
                            <Grid item xs={12} sm={compact ? 12 : 4}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <SpeedIcon fontSize="small" color="action" />
                                <Typography variant="body2" color="textSecondary">
                                  Response: {formatResponseTime(device.responseTimeMs)}
                                </Typography>
                              </Box>
                            </Grid>
                            {device.activationCount !== undefined && (
                              <Grid item xs={12} sm={compact ? 12 : 4}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <TimelineIcon fontSize="small" color="action" />
                                  <Typography variant="body2" color="textSecondary">
                                    Activations: {device.activationCount}
                                  </Typography>
                                </Box>
                              </Grid>
                            )}
                          </Grid>

                          {/* Fault codes */}
                          {device.faultCodes.length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {device.faultCodes.map((fault) => (
                                <Chip
                                  key={fault}
                                  label={formatFaultCode(fault)}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  icon={<WarningIcon />}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      }
                    />

                    {showDiagnostics && (
                      <ListItemSecondary>
                        <Tooltip title="Run diagnostics">
                          <IconButton size="small">
                            <BugReportIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondary>
                    )}
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Active Faults Summary */}
      {status.activeFaults.length > 0 && (
        <Alert severity="error" sx={{ mt: 2 }}>
          <AlertTitle>Active System Faults</AlertTitle>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            {status.activeFaults.map((fault) => (
              <Chip
                key={fault}
                label={formatFaultCode(fault)}
                size="small"
                color="error"
              />
            ))}
          </Box>
        </Alert>
      )}
    </Box>
  );
};

export default EmergencyStopHardwareStatus;