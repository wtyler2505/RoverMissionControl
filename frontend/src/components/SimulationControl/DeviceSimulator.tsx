/**
 * Device Simulator Component
 * Manages simulated devices and their behavior
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Slider,
  Switch,
  FormControlLabel,
  Collapse,
  Alert,
  Tooltip,
  Divider,
  Paper,
  Tab,
  Tabs
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  ExpandMore,
  ExpandLess,
  Sensors,
  SettingsRemote,
  Warning,
  CheckCircle,
  Error,
  Info,
  Memory,
  ThermostatAuto,
  Speed,
  LocationOn,
  Vibration,
  PowerSettingsNew
} from '@mui/icons-material';
import {
  DeviceState,
  DeviceProfile,
  SensorProfile,
  ActuatorProfile,
  DeviceType,
  SensorType,
  ActuatorType,
  NoiseProfile,
  ResponseProfile,
  ErrorProfile
} from './types';

interface DeviceSimulatorProps {
  devices: DeviceState[];
  onDeviceAdd: (profile: DeviceProfile) => void;
  onDeviceRemove: (deviceId: string) => void;
  onDeviceUpdate: (deviceId: string, state: Partial<DeviceState>) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
};

const getDeviceIcon = (deviceType: DeviceType) => {
  switch (deviceType) {
    case DeviceType.SENSOR:
      return <Sensors />;
    case DeviceType.ACTUATOR:
      return <SettingsRemote />;
    case DeviceType.CONTROLLER:
      return <Memory />;
    default:
      return <Memory />;
  }
};

const getSensorIcon = (sensorType: SensorType) => {
  switch (sensorType) {
    case SensorType.TEMPERATURE:
      return <ThermostatAuto />;
    case SensorType.ACCELEROMETER:
    case SensorType.GYROSCOPE:
      return <Vibration />;
    case SensorType.GPS:
      return <LocationOn />;
    default:
      return <Sensors />;
  }
};

export const DeviceSimulator: React.FC<DeviceSimulatorProps> = ({
  devices,
  onDeviceAdd,
  onDeviceRemove,
  onDeviceUpdate
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceState | null>(null);
  const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());
  const [tabValue, setTabValue] = useState(0);
  
  // New device form state
  const [newDevice, setNewDevice] = useState<Partial<DeviceProfile>>({
    deviceId: '',
    name: '',
    deviceType: DeviceType.SENSOR,
    model: 'Generic',
    manufacturer: 'SimCorp',
    powerConsumption: 0.1,
    operatingVoltage: 5.0,
    operatingCurrent: 0.02,
    tempMin: -40,
    tempMax: 85,
    humidityMax: 95,
    protocol: 'serial',
    baudRate: 115200,
    responseFormat: 'ascii',
    responseProfile: {
      delayMin: 0.0,
      delayMax: 0.1,
      riseTime: 0.0,
      overshoot: 0.0,
      settlingTime: 0.0
    },
    errorProfile: {
      failureRate: 0.0,
      recoveryTime: 1.0,
      degradationRate: 0.0,
      intermittentFaultRate: 0.0,
      errorCodes: []
    }
  });
  
  const [sensorConfig, setSensorConfig] = useState<Partial<SensorProfile>>({
    sensorType: SensorType.TEMPERATURE,
    rangeMin: 0,
    rangeMax: 100,
    resolution: 0.1,
    accuracy: 1.0,
    samplingRate: 10.0,
    calibrationOffset: 0.0,
    calibrationScale: 1.0,
    requiresWarmup: false,
    warmupTime: 0.0,
    noiseProfile: {
      gaussianStddev: 0.0,
      periodicAmplitude: 0.0,
      periodicFrequency: 1.0,
      randomWalkStep: 0.0,
      spikeProbability: 0.0,
      spikeMagnitude: 0.0
    },
    driftRate: 0.0,
    averagingSamples: 1,
    outlierThreshold: 3.0
  });
  
  const [actuatorConfig, setActuatorConfig] = useState<Partial<ActuatorProfile>>({
    actuatorType: ActuatorType.MOTOR,
    controlType: 'position',
    controlRangeMin: 0,
    controlRangeMax: 100,
    maxSpeed: 100,
    maxAcceleration: 50,
    maxForce: 10,
    hasFeedback: true,
    feedbackType: 'encoder',
    feedbackResolution: 0.1,
    currentLimit: 1.0,
    temperatureLimit: 80,
    dutyCycleLimit: 1.0,
    backlash: 0.0,
    friction: 0.1,
    inertia: 0.01
  });
  
  const handleDeviceExpand = (deviceId: string) => {
    const newExpanded = new Set(expandedDevices);
    if (newExpanded.has(deviceId)) {
      newExpanded.delete(deviceId);
    } else {
      newExpanded.add(deviceId);
    }
    setExpandedDevices(newExpanded);
  };
  
  const handleAddDevice = () => {
    let profile: DeviceProfile;
    
    if (newDevice.deviceType === DeviceType.SENSOR) {
      profile = {
        ...newDevice,
        ...sensorConfig
      } as SensorProfile;
    } else if (newDevice.deviceType === DeviceType.ACTUATOR) {
      profile = {
        ...newDevice,
        ...actuatorConfig
      } as ActuatorProfile;
    } else {
      profile = newDevice as DeviceProfile;
    }
    
    // Generate device ID if not provided
    if (!profile.deviceId) {
      profile.deviceId = `${profile.deviceType}_${Date.now()}`;
    }
    
    onDeviceAdd(profile);
    setAddDialogOpen(false);
    resetNewDevice();
  };
  
  const resetNewDevice = () => {
    setNewDevice({
      deviceId: '',
      name: '',
      deviceType: DeviceType.SENSOR,
      model: 'Generic',
      manufacturer: 'SimCorp',
      powerConsumption: 0.1,
      operatingVoltage: 5.0,
      operatingCurrent: 0.02,
      tempMin: -40,
      tempMax: 85,
      humidityMax: 95,
      protocol: 'serial',
      baudRate: 115200,
      responseFormat: 'ascii',
      responseProfile: {
        delayMin: 0.0,
        delayMax: 0.1,
        riseTime: 0.0,
        overshoot: 0.0,
        settlingTime: 0.0
      },
      errorProfile: {
        failureRate: 0.0,
        recoveryTime: 1.0,
        degradationRate: 0.0,
        intermittentFaultRate: 0.0,
        errorCodes: []
      }
    });
  };
  
  const handleDeviceCommand = (deviceId: string, command: string) => {
    // Send command to device
    fetch(`/api/simulation/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
  };
  
  const handleInjectFault = (deviceId: string, faultType: string) => {
    onDeviceUpdate(deviceId, {
      errors: [faultType]
    });
  };
  
  const getDeviceStatus = (device: DeviceState) => {
    if (device.errors.length > 0) {
      return { color: 'error' as const, label: 'Error', icon: <Error /> };
    }
    if (!device.connected) {
      return { color: 'default' as const, label: 'Disconnected', icon: <Warning /> };
    }
    return { color: 'success' as const, label: 'Connected', icon: <CheckCircle /> };
  };
  
  const renderDeviceCard = (device: DeviceState) => {
    const status = getDeviceStatus(device);
    const isExpanded = expandedDevices.has(device.deviceId);
    const profile = device.profile;
    
    return (
      <Card key={device.deviceId} sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              {getDeviceIcon(profile.deviceType)}
              <Box>
                <Typography variant="h6">{profile.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {profile.model} | {device.deviceId}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={status.label}
                color={status.color}
                size="small"
                icon={status.icon}
              />
              <IconButton
                onClick={() => handleDeviceExpand(device.deviceId)}
                size="small"
              >
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
              <IconButton
                onClick={() => {
                  setSelectedDevice(device);
                  setEditDialogOpen(true);
                }}
                size="small"
              >
                <Edit />
              </IconButton>
              <IconButton
                onClick={() => onDeviceRemove(device.deviceId)}
                size="small"
                color="error"
              >
                <Delete />
              </IconButton>
            </Box>
          </Box>
          
          <Collapse in={isExpanded}>
            <Divider sx={{ my: 2 }} />
            
            {/* Device Details */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Device Information
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Type"
                      secondary={profile.deviceType}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Protocol"
                      secondary={`${profile.protocol} @ ${profile.baudRate} bps`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Power"
                      secondary={`${profile.powerConsumption}W @ ${profile.operatingVoltage}V`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Operating Range"
                      secondary={`${profile.tempMin}°C to ${profile.tempMax}°C, <${profile.humidityMax}% RH`}
                    />
                  </ListItem>
                </List>
              </Grid>
              
              <Grid item xs={12} md={6}>
                {profile.deviceType === DeviceType.SENSOR && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Sensor Data
                    </Typography>
                    {device.sensorData && Object.entries(device.sensorData).map(([key, value]) => (
                      <Box key={key} display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">{key}:</Typography>
                        <Typography variant="body2" fontFamily="monospace">
                          {typeof value === 'object' ? JSON.stringify(value) : value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                
                {profile.deviceType === DeviceType.ACTUATOR && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Actuator State
                    </Typography>
                    {device.actuatorState && Object.entries(device.actuatorState).map(([key, value]) => (
                      <Box key={key} display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">{key}:</Typography>
                        <Typography variant="body2" fontFamily="monospace">
                          {value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Grid>
              
              {/* Device Controls */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Device Controls
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleDeviceCommand(device.deviceId, 'reset')}
                  >
                    Reset
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleDeviceCommand(device.deviceId, 'calibrate')}
                  >
                    Calibrate
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => handleInjectFault(device.deviceId, 'connection_lost')}
                  >
                    Simulate Disconnect
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => handleInjectFault(device.deviceId, 'hardware_failure')}
                  >
                    Simulate Failure
                  </Button>
                </Box>
              </Grid>
              
              {/* Error Display */}
              {device.errors.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="error">
                    <Typography variant="subtitle2">Active Errors:</Typography>
                    {device.errors.map((error, index) => (
                      <Typography key={index} variant="body2">
                        • {error}
                      </Typography>
                    ))}
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Collapse>
        </CardContent>
      </Card>
    );
  };
  
  // Group devices by type
  const groupedDevices = devices.reduce((acc, device) => {
    const type = device.profile.deviceType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(device);
    return acc;
  }, {} as Record<DeviceType, DeviceState[]>);
  
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Simulated Devices</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Device
        </Button>
      </Box>
      
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label={`All (${devices.length})`} />
          {Object.values(DeviceType).map((type) => (
            <Tab
              key={type}
              label={`${type} (${groupedDevices[type]?.length || 0})`}
            />
          ))}
        </Tabs>
        
        <TabPanel value={tabValue} index={0}>
          {devices.map(renderDeviceCard)}
        </TabPanel>
        
        {Object.values(DeviceType).map((type, index) => (
          <TabPanel key={type} value={tabValue} index={index + 1}>
            {groupedDevices[type]?.map(renderDeviceCard) || (
              <Typography color="text.secondary" align="center">
                No {type.toLowerCase()} devices
              </Typography>
            )}
          </TabPanel>
        ))}
      </Paper>
      
      {/* Add Device Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add Simulated Device</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6">Basic Information</Typography>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Device ID"
                value={newDevice.deviceId}
                onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
                helperText="Leave empty to auto-generate"
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Device Name"
                value={newDevice.name}
                onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                required
              />
            </Grid>
            
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>Device Type</InputLabel>
                <Select
                  value={newDevice.deviceType}
                  onChange={(e) => setNewDevice({ 
                    ...newDevice, 
                    deviceType: e.target.value as DeviceType 
                  })}
                  label="Device Type"
                >
                  {Object.values(DeviceType).map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Model"
                value={newDevice.model}
                onChange={(e) => setNewDevice({ ...newDevice, model: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Manufacturer"
                value={newDevice.manufacturer}
                onChange={(e) => setNewDevice({ ...newDevice, manufacturer: e.target.value })}
              />
            </Grid>
            
            {/* Type-specific Configuration */}
            {newDevice.deviceType === DeviceType.SENSOR && (
              <>
                <Grid item xs={12}>
                  <Divider />
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    Sensor Configuration
                  </Typography>
                </Grid>
                
                <Grid item xs={4}>
                  <FormControl fullWidth>
                    <InputLabel>Sensor Type</InputLabel>
                    <Select
                      value={sensorConfig.sensorType}
                      onChange={(e) => setSensorConfig({ 
                        ...sensorConfig, 
                        sensorType: e.target.value as SensorType 
                      })}
                      label="Sensor Type"
                    >
                      {Object.values(SensorType).map((type) => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Range Min"
                    type="number"
                    value={sensorConfig.rangeMin}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      rangeMin: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Range Max"
                    type="number"
                    value={sensorConfig.rangeMax}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      rangeMax: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Resolution"
                    type="number"
                    value={sensorConfig.resolution}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      resolution: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Accuracy (%)"
                    type="number"
                    value={sensorConfig.accuracy}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      accuracy: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Sampling Rate (Hz)"
                    type="number"
                    value={sensorConfig.samplingRate}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      samplingRate: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Noise Configuration
                  </Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Gaussian Noise (σ)"
                    type="number"
                    value={sensorConfig.noiseProfile?.gaussianStddev}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      noiseProfile: {
                        ...sensorConfig.noiseProfile!,
                        gaussianStddev: Number(e.target.value)
                      }
                    })}
                  />
                </Grid>
                
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Drift Rate (units/hour)"
                    type="number"
                    value={sensorConfig.driftRate}
                    onChange={(e) => setSensorConfig({ 
                      ...sensorConfig, 
                      driftRate: Number(e.target.value) 
                    })}
                  />
                </Grid>
              </>
            )}
            
            {newDevice.deviceType === DeviceType.ACTUATOR && (
              <>
                <Grid item xs={12}>
                  <Divider />
                  <Typography variant="h6" sx={{ mt: 2 }}>
                    Actuator Configuration
                  </Typography>
                </Grid>
                
                <Grid item xs={4}>
                  <FormControl fullWidth>
                    <InputLabel>Actuator Type</InputLabel>
                    <Select
                      value={actuatorConfig.actuatorType}
                      onChange={(e) => setActuatorConfig({ 
                        ...actuatorConfig, 
                        actuatorType: e.target.value as ActuatorType 
                      })}
                      label="Actuator Type"
                    >
                      {Object.values(ActuatorType).map((type) => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={4}>
                  <FormControl fullWidth>
                    <InputLabel>Control Type</InputLabel>
                    <Select
                      value={actuatorConfig.controlType}
                      onChange={(e) => setActuatorConfig({ 
                        ...actuatorConfig, 
                        controlType: e.target.value 
                      })}
                      label="Control Type"
                    >
                      <MenuItem value="position">Position</MenuItem>
                      <MenuItem value="velocity">Velocity</MenuItem>
                      <MenuItem value="torque">Torque</MenuItem>
                      <MenuItem value="pwm">PWM</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={actuatorConfig.hasFeedback}
                        onChange={(e) => setActuatorConfig({ 
                          ...actuatorConfig, 
                          hasFeedback: e.target.checked 
                        })}
                      />
                    }
                    label="Has Feedback"
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Max Speed"
                    type="number"
                    value={actuatorConfig.maxSpeed}
                    onChange={(e) => setActuatorConfig({ 
                      ...actuatorConfig, 
                      maxSpeed: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Max Acceleration"
                    type="number"
                    value={actuatorConfig.maxAcceleration}
                    onChange={(e) => setActuatorConfig({ 
                      ...actuatorConfig, 
                      maxAcceleration: Number(e.target.value) 
                    })}
                  />
                </Grid>
                
                <Grid item xs={4}>
                  <TextField
                    fullWidth
                    label="Current Limit (A)"
                    type="number"
                    value={actuatorConfig.currentLimit}
                    onChange={(e) => setActuatorConfig({ 
                      ...actuatorConfig, 
                      currentLimit: Number(e.target.value) 
                    })}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddDevice}
            variant="contained"
            disabled={!newDevice.name}
          >
            Add Device
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};