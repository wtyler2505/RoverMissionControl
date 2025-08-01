/**
 * Firmware Management Dashboard
 * Central interface for managing firmware across all devices
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  Alert,
  AlertTitle,
  Snackbar,
  Badge,
  Tooltip,
  Fab,
  Zoom,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  CloudUpload as UploadIcon,
  Emergency as EmergencyIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Storage as StorageIcon,
  NotificationsActive as NotificationsIcon,
} from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';
import FirmwareStatusCard from './FirmwareStatusCard';
import FirmwareRepository from './FirmwareRepository';
import FirmwareUploadDialog from './FirmwareUploadDialog';
import FirmwareHistoryDialog from './FirmwareHistoryDialog';
import FirmwareSettingsDialog from './FirmwareSettingsDialog';
import EmergencyStopDialog from './EmergencyStopDialog';
import { firmwareApi } from '../../services/api/firmwareApi';

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
      id={`firmware-tabpanel-${index}`}
      aria-labelledby={`firmware-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const FirmwareManagementDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [devices, setDevices] = useState<any[]>([]);
  const [firmwareVersions, setFirmwareVersions] = useState<Record<string, any>>({});
  const [updateInfo, setUpdateInfo] = useState<Record<string, any>>({});
  const [activeSessions, setActiveSessions] = useState<Record<string, any>>({});
  const [emergencyStopActive, setEmergencyStopActive] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  
  // Notification state
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // WebSocket connection for real-time updates
  const { sendMessage, lastMessage, connectionStatus } = useWebSocket(
    'ws://localhost:8000/api/firmware/ws/updates'
  );

  // Load devices from hardware manager
  const loadDevices = useCallback(async () => {
    try {
      // This would come from the hardware manager API
      const response = await fetch('/api/hardware/devices');
      const data = await response.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
      showNotification('Failed to load devices', 'error');
    }
  }, []);

  // Check emergency stop status
  const checkEmergencyStatus = useCallback(async () => {
    try {
      const status = await firmwareApi.getEmergencyStopStatus();
      setEmergencyStopActive(status.emergency_stop_active);
    } catch (error) {
      console.error('Failed to check emergency status:', error);
    }
  }, []);

  // Load active update sessions
  const loadActiveSessions = useCallback(async () => {
    try {
      const sessions = await firmwareApi.getUpdateSessions();
      setActiveSessions(sessions);
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  }, []);

  // Initialize dashboard
  useEffect(() => {
    loadDevices();
    checkEmergencyStatus();
    loadActiveSessions();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      checkEmergencyStatus();
      loadActiveSessions();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadDevices, checkEmergencyStatus, loadActiveSessions]);

  // Handle WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      const data = JSON.parse(lastMessage.data);
      
      switch (data.type) {
        case 'update_progress':
          setActiveSessions(prev => ({
            ...prev,
            [data.data.session_id]: data.data,
          }));
          break;
          
        case 'update_completed':
          setActiveSessions(prev => {
            const { [data.data.session_id]: _, ...rest } = prev;
            return rest;
          });
          
          showNotification(
            data.data.success
              ? `Firmware update completed for ${data.data.device_id}`
              : `Firmware update failed for ${data.data.device_id}`,
            data.data.success ? 'success' : 'error'
          );
          
          // Refresh device firmware version
          checkDeviceFirmware(data.data.device_id);
          break;
          
        case 'emergency_stop':
          setEmergencyStopActive(true);
          showNotification('Emergency stop activated!', 'error');
          break;
      }
    }
  }, [lastMessage]);

  // Check firmware version for a device
  const checkDeviceFirmware = async (deviceId: string) => {
    setLoading(prev => ({ ...prev, [deviceId]: true }));
    setErrors(prev => ({ ...prev, [deviceId]: '' }));
    
    try {
      const version = await firmwareApi.getDeviceFirmwareVersion(deviceId);
      setFirmwareVersions(prev => ({ ...prev, [deviceId]: version }));
    } catch (error) {
      setErrors(prev => ({ ...prev, [deviceId]: 'Failed to get firmware version' }));
    } finally {
      setLoading(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  // Check for updates
  const checkForUpdates = async (deviceId: string) => {
    setLoading(prev => ({ ...prev, [deviceId]: true }));
    
    try {
      const updates = await firmwareApi.checkFirmwareUpdates(deviceId);
      setUpdateInfo(prev => ({ ...prev, [deviceId]: updates }));
      
      if (updates.update_available) {
        showNotification(
          updates.critical_update
            ? `Critical update available for ${deviceId}`
            : `Update available for ${deviceId}`,
          updates.critical_update ? 'warning' : 'info'
        );
      }
    } catch (error) {
      showNotification(`Failed to check updates for ${deviceId}`, 'error');
    } finally {
      setLoading(prev => ({ ...prev, [deviceId]: false }));
    }
  };

  // Start firmware update
  const startUpdate = async (deviceId: string, version: string) => {
    if (emergencyStopActive) {
      showNotification('Cannot start update - emergency stop is active', 'error');
      return;
    }
    
    try {
      const result = await firmwareApi.startFirmwareUpdate(deviceId, version);
      showNotification(`Firmware update started for ${deviceId}`, 'success');
      
      // The session will be tracked via WebSocket updates
    } catch (error: any) {
      showNotification(
        error.response?.data?.detail || `Failed to start update for ${deviceId}`,
        'error'
      );
    }
  };

  // Cancel update
  const cancelUpdate = async (sessionId: string) => {
    try {
      await firmwareApi.cancelUpdateSession(sessionId);
      showNotification('Update cancelled', 'warning');
    } catch (error) {
      showNotification('Failed to cancel update', 'error');
    }
  };

  // Trigger emergency stop
  const triggerEmergencyStop = async () => {
    try {
      await firmwareApi.triggerEmergencyStop();
      setEmergencyStopActive(true);
      showNotification('Emergency stop activated - all updates halted', 'error');
    } catch (error) {
      showNotification('Failed to trigger emergency stop', 'error');
    }
  };

  // Clear emergency stop
  const clearEmergencyStop = async () => {
    try {
      await firmwareApi.clearEmergencyStop();
      setEmergencyStopActive(false);
      showNotification('Emergency stop cleared', 'success');
    } catch (error) {
      showNotification('Failed to clear emergency stop', 'error');
    }
  };

  // Show notification
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({ open: true, message, severity });
  };

  // Count devices needing updates
  const getUpdateCount = () => {
    return Object.values(updateInfo).filter(info => info?.update_available).length;
  };

  // Count active updates
  const getActiveUpdateCount = () => {
    return Object.keys(activeSessions).length;
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Firmware Management
          </Typography>
          
          <Box display="flex" gap={2}>
            <Tooltip title="Upload Firmware">
              <IconButton onClick={() => setUploadDialogOpen(true)}>
                <UploadIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsDialogOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Refresh All">
              <IconButton onClick={loadDevices}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Emergency Stop Alert */}
        {emergencyStopActive && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={() => setEmergencyDialogOpen(true)}
              >
                Clear
              </Button>
            }
          >
            <AlertTitle>Emergency Stop Active</AlertTitle>
            All firmware updates are disabled. Clear the emergency stop to resume normal operations.
          </Alert>
        )}

        {/* Active Updates Alert */}
        {getActiveUpdateCount() > 0 && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Updates in Progress</AlertTitle>
            {getActiveUpdateCount()} firmware update(s) currently in progress.
          </Alert>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab 
              label={
                <Badge badgeContent={devices.length} color="primary">
                  Devices
                </Badge>
              }
            />
            <Tab 
              label={
                <Badge badgeContent={getUpdateCount()} color="warning">
                  Available Updates
                </Badge>
              }
            />
            <Tab label="Repository" />
            <Tab label="History" />
          </Tabs>
        </Paper>

        {/* Tab Panels */}
        <TabPanel value={activeTab} index={0}>
          {/* Devices Tab */}
          <Grid container spacing={3}>
            {devices.map(device => (
              <Grid item xs={12} md={6} lg={4} key={device.device_id}>
                <FirmwareStatusCard
                  deviceId={device.device_id}
                  deviceName={device.name}
                  currentVersion={firmwareVersions[device.device_id]}
                  updateInfo={updateInfo[device.device_id]}
                  updateSession={activeSessions[Object.keys(activeSessions).find(
                    sid => activeSessions[sid]?.device_id === device.device_id
                  ) || '']}
                  onCheckUpdates={() => checkForUpdates(device.device_id)}
                  onStartUpdate={(version) => startUpdate(device.device_id, version)}
                  onCancelUpdate={cancelUpdate}
                  onEmergencyStop={triggerEmergencyStop}
                  loading={loading[device.device_id]}
                  error={errors[device.device_id]}
                />
              </Grid>
            ))}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {/* Available Updates Tab */}
          <Grid container spacing={3}>
            {devices
              .filter(device => updateInfo[device.device_id]?.update_available)
              .map(device => (
                <Grid item xs={12} md={6} lg={4} key={device.device_id}>
                  <FirmwareStatusCard
                    deviceId={device.device_id}
                    deviceName={device.name}
                    currentVersion={firmwareVersions[device.device_id]}
                    updateInfo={updateInfo[device.device_id]}
                    updateSession={activeSessions[Object.keys(activeSessions).find(
                      sid => activeSessions[sid]?.device_id === device.device_id
                    ) || '']}
                    onCheckUpdates={() => checkForUpdates(device.device_id)}
                    onStartUpdate={(version) => startUpdate(device.device_id, version)}
                    onCancelUpdate={cancelUpdate}
                    onEmergencyStop={triggerEmergencyStop}
                    loading={loading[device.device_id]}
                    error={errors[device.device_id]}
                  />
                </Grid>
              ))}
            
            {Object.values(updateInfo).filter(info => info?.update_available).length === 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  All devices are up to date. No firmware updates available.
                </Alert>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          {/* Repository Tab */}
          <FirmwareRepository />
        </TabPanel>

        <TabPanel value={activeTab} index={3}>
          {/* History Tab */}
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setHistoryDialogOpen(true)}
          >
            View Update History
          </Button>
        </TabPanel>

        {/* Emergency Stop FAB */}
        {getActiveUpdateCount() > 0 && !emergencyStopActive && (
          <Zoom in>
            <Fab
              color="error"
              sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
              }}
              onClick={() => setEmergencyDialogOpen(true)}
            >
              <EmergencyIcon />
            </Fab>
          </Zoom>
        )}

        {/* Dialogs */}
        <FirmwareUploadDialog
          open={uploadDialogOpen}
          onClose={() => setUploadDialogOpen(false)}
          onUploadComplete={() => {
            setUploadDialogOpen(false);
            showNotification('Firmware uploaded successfully', 'success');
          }}
        />

        <FirmwareHistoryDialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          deviceId={selectedDevice}
        />

        <FirmwareSettingsDialog
          open={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
        />

        <EmergencyStopDialog
          open={emergencyDialogOpen}
          onClose={() => setEmergencyDialogOpen(false)}
          emergencyStopActive={emergencyStopActive}
          onTriggerStop={triggerEmergencyStop}
          onClearStop={clearEmergencyStop}
          activeSessions={Object.values(activeSessions)}
        />

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert
            onClose={() => setNotification(prev => ({ ...prev, open: false }))}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default FirmwareManagementDashboard;