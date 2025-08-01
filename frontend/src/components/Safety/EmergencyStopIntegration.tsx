/**
 * Emergency Stop Integration Component
 * 
 * Complete integration of emergency stop UI with hardware backend.
 * Provides full bidirectional communication, state synchronization,
 * and comprehensive safety features.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  AlertTitle,
  Snackbar,
  IconButton,
  Tooltip,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Emergency as EmergencyIcon,
  Hardware as HardwareIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  NotificationsActive as NotificationsIcon,
  Download as DownloadIcon,
  BugReport as TestIcon,
  Wifi as WifiIcon,
} from '@mui/icons-material';
import EmergencyStopButton from './EmergencyStopButton';
import EmergencyStopHardwareStatus from './EmergencyStopHardwareStatus';
import ConnectionMonitoringPanel from './ConnectionMonitoringPanel';
import { ConnectionHealthMonitor } from '../../services/ConnectionHealthMonitor';
import {
  useEmergencyStop,
  SystemSafetyState,
  EmergencyEvent,
  FaultType,
  EmergencyStopState,
} from '../../hooks/useEmergencyStop';
import { EmergencyFeedbackIntegration } from './feedback/EmergencyFeedbackIntegration';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`emergency-tabpanel-${index}`}
      aria-labelledby={`emergency-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

interface EmergencyStopIntegrationProps {
  /**
   * User ID for audit trail
   */
  userId?: string;
  /**
   * Whether to show the hardware status panel
   */
  showHardwareStatus?: boolean;
  /**
   * Whether to enable sound alerts
   */
  enableSound?: boolean;
  /**
   * Whether to enable vibration feedback
   */
  enableVibration?: boolean;
  /**
   * Position for the emergency button
   */
  buttonPosition?: {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
  };
}

const EmergencyStopIntegration: React.FC<EmergencyStopIntegrationProps> = ({
  userId = 'default-user',
  showHardwareStatus = true,
  enableSound = true,
  enableVibration = true,
  buttonPosition = { top: 20, right: 20 },
}) => {
  const theme = useTheme();
  const {
    status,
    isConnected,
    error,
    activateEmergencyStop,
    deactivateEmergencyStop,
    testSystem,
    exportEventLog,
    getHealthyDeviceCount,
  } = useEmergencyStop({
    onEmergencyActivated: handleEmergencyActivated,
    onEmergencyCleared: handleEmergencyCleared,
    onFault: handleFault,
  });

  // Local state
  const [tabValue, setTabValue] = useState(0);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EmergencyEvent | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [showConnectionMonitor, setShowConnectionMonitor] = useState(false);
  const connectionMonitorRef = useRef<ConnectionHealthMonitor | null>(null);
  
  // Initialize connection monitor
  useEffect(() => {
    connectionMonitorRef.current = new ConnectionHealthMonitor({
      websocketUrl: process.env.REACT_APP_WS_URL || 'ws://localhost:8000',
      apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:8000',
      hardwareUrl: process.env.REACT_APP_HARDWARE_URL || 'http://localhost:8001',
      checkInterval: 5000,
      timeout: 5000,
      onHealthChange: (connection, health) => {
        console.log(`Connection ${connection} health:`, health);
      },
      onConnectionLoss: (connection) => {
        if (connection === 'hardware') {
          activateEmergencyStop('Hardware connection lost');
        }
      },
    });
    
    connectionMonitorRef.current.startMonitoring();
    
    return () => {
      connectionMonitorRef.current?.stopMonitoring();
    };
  }, []);

  // Hardware-backed emergency state
  const isEmergencyActive = status.isEmergencyActive;

  // Event handlers from hardware
  function handleEmergencyActivated(event: EmergencyEvent) {
    addNotification(`EMERGENCY STOP ACTIVATED: ${event.triggerReason}`);
    // Additional actions like sound alarms would go here
  }

  function handleEmergencyCleared(event: EmergencyEvent) {
    addNotification('Emergency stop cleared - System returning to normal');
  }

  function handleFault(deviceId: string, faults: FaultType[]) {
    const faultNames = faults.map(f => f.replace(/_/g, ' ')).join(', ');
    addNotification(`Hardware fault on ${deviceId}: ${faultNames}`);
  }

  // Notification system
  const addNotification = useCallback((message: string) => {
    setNotifications(prev => [...prev, message]);
    // Auto-remove after 10 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== message));
    }, 10000);
  }, []);

  // Handle emergency activation
  const handleActivate = async () => {
    const success = await activateEmergencyStop('Manual activation from UI');
    if (!success) {
      addNotification('Failed to activate emergency stop - check hardware connection');
    }
  };

  // Handle emergency deactivation
  const handleDeactivate = async () => {
    const success = await deactivateEmergencyStop(true, false);
    if (!success) {
      addNotification('Failed to deactivate emergency stop - safety checks failed');
    }
  };

  // Handle audit event
  const handleAuditEvent = (event: any) => {
    console.log('Audit event:', event);
    // Would send to logging system
  };

  // Run system test
  const handleRunTest = async () => {
    setShowTestDialog(true);
    const results = await testSystem();
    setTestResults(results);
  };

  // Export event log
  const handleExportLog = () => {
    const events = exportEventLog();
    const data = JSON.stringify(events, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency-stop-log-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get badge content for tabs
  const getHardwareBadge = () => {
    const faultCount = status.activeFaults.length;
    if (faultCount > 0) return faultCount;
    if (!isConnected) return '!';
    return null;
  };

  const getEventBadge = () => {
    const recentCount = status.recentEvents.filter(
      e => new Date(e.timestamp).getTime() > Date.now() - 3600000 // Last hour
    ).length;
    return recentCount > 0 ? recentCount : null;
  };

  // Get system health color
  const getHealthColor = () => {
    switch (status.systemState) {
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

  // Get connection health status
  const connectionHealth = connectionMonitorRef.current ? {
    websocket: connectionMonitorRef.current.getConnectionHealth('websocket').level !== 'Disconnected',
    hardware: connectionMonitorRef.current.getConnectionHealth('hardware').level !== 'Disconnected',
    latency: connectionMonitorRef.current.getConnectionHealth('websocket').metrics.latency || 0,
  } : {
    websocket: isConnected,
    hardware: isConnected,
    latency: 0,
  };

  return (
    <Box>
      {/* Emergency Feedback Integration */}
      <EmergencyFeedbackIntegration
        systemState={status.systemState}
        emergencyState={status.isEmergencyActive ? 'TRIGGERED' : 'NORMAL'}
        recentEvents={status.recentEvents}
        deviceHealth={{
          count: status.deviceCount,
          healthy: getHealthyDeviceCount(),
          faults: status.activeFaults,
        }}
        connectionStatus={connectionHealth}
        showStatusBanner={true}
        showFeedbackPanel={false}
        onEmergencyStopConfirm={handleActivate}
        onEmergencyStopClear={handleDeactivate}
      />
      
      {/* Main Emergency Stop Button */}
      <EmergencyStopButton
        isActivated={isEmergencyActive}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        position={buttonPosition}
        fixed={true}
        enableSound={enableSound}
        enableVibration={enableVibration}
        systemState={
          status.systemState === SystemSafetyState.CRITICAL
            ? 'critical'
            : status.systemState === SystemSafetyState.WARNING
            ? 'warning'
            : 'normal'
        }
        userId={userId}
        onAuditEvent={handleAuditEvent}
      />

      {/* Hardware Status Panel */}
      {showHardwareStatus && (
        <Paper
          sx={{
            position: 'fixed',
            top: 150,
            right: 20,
            width: 400,
            maxHeight: '70vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            zIndex: theme.zIndex.modal - 1,
            boxShadow: theme.shadows[8],
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              backgroundColor: alpha(getHealthColor(), 0.1),
              borderBottom: `3px solid ${getHealthColor()}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EmergencyIcon sx={{ color: getHealthColor() }} />
              <Typography variant="h6">Emergency Stop System</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Run system test">
                <IconButton size="small" onClick={handleRunTest}>
                  <TestIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export event log">
                <IconButton size="small" onClick={handleExportLog}>
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Connection Status */}
          {!isConnected && (
            <Alert severity="error" sx={{ m: 2, mb: 0 }}>
              <AlertTitle>Hardware Disconnected</AlertTitle>
              Emergency stop hardware is not connected
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ m: 2, mb: 0 }}>
              {error}
            </Alert>
          )}

          {/* Tabs */}
          <Tabs
            value={tabValue}
            onChange={(e, v) => setTabValue(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={
                <Badge badgeContent={getHardwareBadge()} color="error">
                  <HardwareIcon />
                </Badge>
              }
              label="Hardware"
              id="emergency-tab-0"
            />
            <Tab
              icon={
                <Badge badgeContent={getEventBadge()} color="warning">
                  <HistoryIcon />
                </Badge>
              }
              label="Events"
              id="emergency-tab-1"
            />
            <Tab
              icon={<SettingsIcon />}
              label="Settings"
              id="emergency-tab-2"
            />
            <Tab
              icon={
                <Badge badgeContent={!isConnected ? '!' : null} color="error">
                  <WifiIcon />
                </Badge>
              }
              label="Connection"
              id="emergency-tab-3"
            />
          </Tabs>

          {/* Tab Panels */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <TabPanel value={tabValue} index={0}>
              <EmergencyStopHardwareStatus
                showDiagnostics={true}
                showRefresh={true}
                compact={true}
              />
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Recent Events
                </Typography>
                {status.recentEvents.length === 0 ? (
                  <Typography variant="body2" color="textSecondary">
                    No recent emergency events
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {status.recentEvents.slice(0, 10).map((event, index) => (
                      <Paper
                        key={index}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.05),
                          },
                        }}
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDialog(true);
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {event.systemStateAfter === SystemSafetyState.EMERGENCY ? (
                            <ErrorIcon color="error" />
                          ) : (
                            <CheckCircleIcon color="success" />
                          )}
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2">
                              {event.triggerReason}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {new Date(event.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                          <Chip
                            label={event.triggerSource}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  System Configuration
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Connected Devices
                    </Typography>
                    <Typography variant="h4">
                      {status.deviceCount}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Healthy Devices
                    </Typography>
                    <Typography variant="h4">
                      {getHealthyDeviceCount()}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      System State
                    </Typography>
                    <Chip
                      label={status.systemState}
                      sx={{
                        mt: 1,
                        backgroundColor: alpha(getHealthColor(), 0.1),
                        color: getHealthColor(),
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </TabPanel>

            <TabPanel value={tabValue} index={3}>
              {connectionMonitorRef.current && (
                <ConnectionMonitoringPanel
                  monitor={connectionMonitorRef.current}
                  showDetails={true}
                  enableSoundAlerts={enableSound}
                  showSettings={false}
                  onEmergencyStop={(reason) => {
                    activateEmergencyStop(`Auto-stop: ${reason}`);
                  }}
                  position={{ top: 0, left: 0 }}
                />
              )}
            </TabPanel>
          </Box>
        </Paper>
      )}

      {/* Event Details Dialog */}
      <Dialog
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Emergency Event Details</DialogTitle>
        <DialogContent>
          {selectedEvent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Timestamp
                </Typography>
                <Typography>
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Trigger Source
                </Typography>
                <Chip label={selectedEvent.triggerSource} />
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Reason
                </Typography>
                <Typography>{selectedEvent.triggerReason}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  Actions Taken
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                  {selectedEvent.actionsTaken.map((action, i) => (
                    <Chip key={i} label={action} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
              {selectedEvent.clearedTimestamp && (
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Cleared
                  </Typography>
                  <Typography>
                    {new Date(selectedEvent.clearedTimestamp).toLocaleString()}
                    {selectedEvent.clearedBy && ` by ${selectedEvent.clearedBy}`}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEventDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog
        open={showTestDialog}
        onClose={() => setShowTestDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>System Test Results</DialogTitle>
        <DialogContent>
          {testResults ? (
            <Box>
              <Alert severity={testResults.overall === 'PASS' ? 'success' : 'error'} sx={{ mb: 2 }}>
                Overall Result: {testResults.overall}
              </Alert>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                {JSON.stringify(testResults, null, 2)}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography>Running system test...</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTestDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbars */}
      {notifications.map((notification, index) => (
        <Snackbar
          key={index}
          open={true}
          message={notification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          sx={{ bottom: 24 + index * 60 }}
        />
      ))}
    </Box>
  );
};

export default EmergencyStopIntegration;