import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondary,
  ListItemIcon,
  Collapse,
  Badge,
  Tab,
  Tabs,
  Paper,
  Menu,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Memory as MemoryIcon,
  Router as RouterIcon,
  Speed as SpeedIcon,
  Cable as CableIcon,
  Sensors as SensorsIcon,
  PowerSettingsNew as PowerIcon,
  Storage as StorageIcon,
  Tv as DisplayIcon,
  Keyboard as InputIcon,
  QuestionMark as UnknownIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { discoveryService } from '../../services/discoveryService';
import { DeviceRegistrationDialog } from './DeviceRegistrationDialog';
import { ManualDeviceDialog } from './ManualDeviceDialog';
import { DeviceDetailsDialog } from './DeviceDetailsDialog';
import { DiscoverySettingsDialog } from './DiscoverySettingsDialog';

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
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const DeviceDiscoveryPanel: React.FC = () => {
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [registeredDevices, setRegisteredDevices] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<any>(null);
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>(['serial', 'i2c']);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedDeviceForMenu, setSelectedDeviceForMenu] = useState<string | null>(null);

  // Dialog states
  const [registrationDialogOpen, setRegistrationDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [deviceToRegister, setDeviceToRegister] = useState<any>(null);

  // WebSocket connection for real-time events
  useEffect(() => {
    const ws = discoveryService.connectWebSocket((event) => {
      if (event.device_discovered) {
        // Add to discovered devices
        setDiscoveredDevices(prev => {
          const exists = prev.find(d => d.device_id === event.device_discovered.device_id);
          if (!exists) {
            return [...prev, event.device_discovered];
          }
          return prev;
        });
        setSuccess(`New device discovered: ${event.device_discovered.device_id}`);
      } else if (event.device_registered) {
        // Move from discovered to registered
        const deviceId = event.device_registered.device_id;
        setDiscoveredDevices(prev => prev.filter(d => d.device_id !== deviceId));
        fetchRegisteredDevices();
        setSuccess(`Device registered: ${deviceId}`);
      }
    });

    return () => {
      ws?.close();
    };
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchDiscoveredDevices();
    fetchRegisteredDevices();
    fetchDiscoveryStatus();
  }, []);

  const fetchDiscoveredDevices = async () => {
    try {
      const devices = await discoveryService.getDiscoveredDevices();
      setDiscoveredDevices(devices);
    } catch (err) {
      setError('Failed to fetch discovered devices');
    }
  };

  const fetchRegisteredDevices = async () => {
    try {
      // This would fetch from hardware manager
      // For now, we'll use a placeholder
      setRegisteredDevices([]);
    } catch (err) {
      setError('Failed to fetch registered devices');
    }
  };

  const fetchDiscoveryStatus = async () => {
    try {
      const status = await discoveryService.getDiscoveryStatus();
      setDiscoveryStatus(status);
    } catch (err) {
      setError('Failed to fetch discovery status');
    }
  };

  const handleStartDiscovery = async () => {
    try {
      setIsDiscovering(true);
      setError(null);
      await discoveryService.startDiscovery(selectedProtocols);
      setSuccess('Discovery started');
      setTimeout(fetchDiscoveryStatus, 1000);
    } catch (err) {
      setError('Failed to start discovery');
      setIsDiscovering(false);
    }
  };

  const handleStopDiscovery = async () => {
    try {
      await discoveryService.stopDiscovery();
      setIsDiscovering(false);
      setSuccess('Discovery stopped');
      fetchDiscoveryStatus();
    } catch (err) {
      setError('Failed to stop discovery');
    }
  };

  const handleScanNow = async () => {
    try {
      setError(null);
      const result = await discoveryService.scanNow();
      setSuccess(`Scan complete: ${result.discovered} devices found`);
      fetchDiscoveredDevices();
    } catch (err) {
      setError('Failed to perform scan');
    }
  };

  const handleRegisterDevice = (device: any) => {
    setDeviceToRegister(device);
    setRegistrationDialogOpen(true);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await discoveryService.removeDevice(deviceId);
      setSuccess('Device removed');
      fetchDiscoveredDevices();
    } catch (err) {
      setError('Failed to remove device');
    }
  };

  const handleShowDetails = (device: any) => {
    setSelectedDevice(device);
    setDetailsDialogOpen(true);
  };

  const handleToggleExpand = (deviceId: string) => {
    setExpandedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, deviceId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedDeviceForMenu(deviceId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedDeviceForMenu(null);
  };

  const getDeviceIcon = (deviceClass: string) => {
    switch (deviceClass) {
      case 'sensor': return <SensorsIcon />;
      case 'actuator': return <SettingsIcon />;
      case 'controller': return <MemoryIcon />;
      case 'communication': return <RouterIcon />;
      case 'power': return <PowerIcon />;
      case 'storage': return <StorageIcon />;
      case 'display': return <DisplayIcon />;
      case 'input': return <InputIcon />;
      default: return <UnknownIcon />;
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'serial': return <CableIcon />;
      case 'i2c': return <SpeedIcon />;
      case 'spi': return <SpeedIcon />;
      case 'can': return <RouterIcon />;
      case 'ethernet': return <RouterIcon />;
      default: return <CableIcon />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'success';
    if (confidence >= 0.7) return 'warning';
    return 'error';
  };

  const renderDeviceCard = (device: any, isRegistered: boolean = false) => {
    const isExpanded = expandedDevices.has(device.device_id);
    
    return (
      <Card key={device.device_id} sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item>
              <Tooltip title={device.device_class}>
                {getDeviceIcon(device.device_class)}
              </Tooltip>
            </Grid>
            <Grid item xs>
              <Typography variant="h6" component="div">
                {device.identity?.model || device.device_id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {device.identity?.manufacturer || 'Unknown Manufacturer'}
              </Typography>
            </Grid>
            <Grid item>
              <Chip
                icon={getProtocolIcon(device.protocol_type)}
                label={device.protocol_type.toUpperCase()}
                size="small"
                sx={{ mr: 1 }}
              />
              {!isRegistered && (
                <Chip
                  label={`${Math.round(device.confidence * 100)}%`}
                  size="small"
                  color={getConfidenceColor(device.confidence)}
                />
              )}
            </Grid>
            <Grid item>
              <IconButton onClick={() => handleToggleExpand(device.device_id)}>
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
              <IconButton onClick={(e) => handleMenuOpen(e, device.device_id)}>
                <MoreVertIcon />
              </IconButton>
            </Grid>
          </Grid>

          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Device Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Address"
                      secondary={device.address || 'N/A'}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Discovery Method"
                      secondary={device.discovery_method}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Discovered At"
                      secondary={new Date(device.discovered_at).toLocaleString()}
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Capabilities
                </Typography>
                {device.capabilities && device.capabilities.length > 0 ? (
                  <List dense>
                    {device.capabilities.map((cap: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={cap.name}
                          secondary={cap.description}
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No capabilities detected
                  </Typography>
                )}
              </Grid>
            </Grid>
            {!isRegistered && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleRegisterDevice(device)}
                  startIcon={<AddIcon />}
                >
                  Register Device
                </Button>
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label={`Discovered (${discoveredDevices.length})`} />
          <Tab label={`Registered (${registeredDevices.length})`} />
          <Tab label="Discovery Status" />
        </Tabs>
      </Paper>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Protocols</InputLabel>
                <Select
                  multiple
                  value={selectedProtocols}
                  onChange={(e) => setSelectedProtocols(e.target.value as string[])}
                  label="Protocols"
                >
                  <MenuItem value="serial">Serial</MenuItem>
                  <MenuItem value="i2c">I2C</MenuItem>
                  <MenuItem value="spi">SPI</MenuItem>
                  <MenuItem value="can">CAN</MenuItem>
                  <MenuItem value="ethernet">Ethernet</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item>
              <Button
                variant="contained"
                onClick={isDiscovering ? handleStopDiscovery : handleStartDiscovery}
                startIcon={isDiscovering ? <StopIcon /> : <PlayIcon />}
                color={isDiscovering ? "error" : "primary"}
                sx={{ mr: 1 }}
              >
                {isDiscovering ? 'Stop Discovery' : 'Start Discovery'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleScanNow}
                startIcon={<SearchIcon />}
                sx={{ mr: 1 }}
              >
                Scan Now
              </Button>
              <Button
                variant="outlined"
                onClick={() => setManualDialogOpen(true)}
                startIcon={<AddIcon />}
                sx={{ mr: 1 }}
              >
                Add Manual
              </Button>
              <IconButton onClick={() => setSettingsDialogOpen(true)}>
                <SettingsIcon />
              </IconButton>
            </Grid>
          </Grid>
        </Box>

        {isDiscovering && <LinearProgress sx={{ mb: 2 }} />}

        {discoveredDevices.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No devices discovered yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start discovery to find connected devices
            </Typography>
          </Box>
        ) : (
          discoveredDevices.map(device => renderDeviceCard(device))
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {registeredDevices.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No registered devices
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Register discovered devices to use them
            </Typography>
          </Box>
        ) : (
          registeredDevices.map(device => renderDeviceCard(device, true))
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {discoveryStatus && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Discovery Statistics
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText
                        primary="Total Discovered"
                        secondary={discoveryStatus.discovered_devices}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemText
                        primary="Active Tasks"
                        secondary={discoveryStatus.active_discovery_tasks.join(', ') || 'None'}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Devices by Protocol
                  </Typography>
                  <List>
                    {Object.entries(discoveryStatus.devices_by_protocol || {}).map(([protocol, count]) => (
                      <ListItem key={protocol}>
                        <ListItemIcon>
                          {getProtocolIcon(protocol)}
                        </ListItemIcon>
                        <ListItemText
                          primary={protocol.toUpperCase()}
                          secondary={`${count} devices`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          const device = discoveredDevices.find(d => d.device_id === selectedDeviceForMenu);
          if (device) handleShowDetails(device);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <InfoIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          const device = discoveredDevices.find(d => d.device_id === selectedDeviceForMenu);
          if (device) handleRegisterDevice(device);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Register Device</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => {
          if (selectedDeviceForMenu) handleDeleteDevice(selectedDeviceForMenu);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Remove</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <DeviceRegistrationDialog
        open={registrationDialogOpen}
        device={deviceToRegister}
        onClose={() => {
          setRegistrationDialogOpen(false);
          setDeviceToRegister(null);
        }}
        onRegister={(adapterId, name) => {
          // Handle registration
          discoveryService.registerDevice(deviceToRegister.device_id, adapterId, name)
            .then(() => {
              setSuccess('Device registered successfully');
              fetchDiscoveredDevices();
              fetchRegisteredDevices();
            })
            .catch(() => setError('Failed to register device'));
        }}
      />

      <ManualDeviceDialog
        open={manualDialogOpen}
        onClose={() => setManualDialogOpen(false)}
        onAdd={(deviceData) => {
          discoveryService.registerManualDevice(deviceData)
            .then(() => {
              setSuccess('Manual device added successfully');
              fetchDiscoveredDevices();
            })
            .catch(() => setError('Failed to add manual device'));
        }}
      />

      <DeviceDetailsDialog
        open={detailsDialogOpen}
        device={selectedDevice}
        onClose={() => setDetailsDialogOpen(false)}
      />

      <DiscoverySettingsDialog
        open={settingsDialogOpen}
        config={discoveryStatus?.configuration}
        onClose={() => setSettingsDialogOpen(false)}
        onSave={(config) => {
          discoveryService.updateConfig(config)
            .then(() => {
              setSuccess('Settings updated');
              fetchDiscoveryStatus();
            })
            .catch(() => setError('Failed to update settings'));
        }}
      />
    </Box>
  );
};

export default DeviceDiscoveryPanel;