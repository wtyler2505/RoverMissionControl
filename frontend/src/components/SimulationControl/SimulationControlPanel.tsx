/**
 * Simulation Control Panel
 * Controls for starting, stopping, and configuring the simulation
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  ButtonGroup,
  IconButton,
  Typography,
  Slider,
  Switch,
  FormControlLabel,
  TextField,
  Grid,
  Divider,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Pause,
  SkipNext,
  FastForward,
  Settings,
  Speed,
  Timer,
  Memory,
  NetworkCheck,
  Science
} from '@mui/icons-material';
import { SimulationState, SimulationMode, SimulationConfig } from './types';

interface SimulationControlPanelProps {
  state: SimulationState;
  mode: SimulationMode;
  config: SimulationConfig;
  onStateChange: (action: 'start' | 'stop' | 'pause' | 'resume' | 'step') => void;
  onModeChange: (mode: SimulationMode) => void;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
}

export const SimulationControlPanel: React.FC<SimulationControlPanelProps> = ({
  state,
  mode,
  config,
  onStateChange,
  onModeChange,
  onConfigChange
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState(config);
  
  const handleStart = () => {
    if (state === SimulationState.PAUSED) {
      onStateChange('resume');
    } else {
      onStateChange('start');
    }
  };
  
  const handleStop = () => {
    onStateChange('stop');
  };
  
  const handlePause = () => {
    onStateChange('pause');
  };
  
  const handleStep = () => {
    if (state === SimulationState.PAUSED || state === SimulationState.STOPPED) {
      onStateChange('step');
    }
  };
  
  const handleSpeedChange = (event: Event, newValue: number | number[]) => {
    const speed = newValue as number;
    onConfigChange({ timeAcceleration: speed });
  };
  
  const handleSettingsOpen = () => {
    setTempConfig(config);
    setSettingsOpen(true);
  };
  
  const handleSettingsClose = () => {
    setSettingsOpen(false);
  };
  
  const handleSettingsSave = () => {
    onConfigChange(tempConfig);
    setSettingsOpen(false);
  };
  
  const getStateColor = () => {
    switch (state) {
      case SimulationState.RUNNING:
        return 'success';
      case SimulationState.PAUSED:
        return 'warning';
      case SimulationState.STOPPED:
        return 'default';
      case SimulationState.ERROR:
        return 'error';
      default:
        return 'default';
    }
  };
  
  const getStateLabel = () => {
    switch (state) {
      case SimulationState.RUNNING:
        return 'Running';
      case SimulationState.PAUSED:
        return 'Paused';
      case SimulationState.STOPPED:
        return 'Stopped';
      case SimulationState.ERROR:
        return 'Error';
      default:
        return 'Unknown';
    }
  };
  
  return (
    <>
      <Card>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            {/* Status and Mode */}
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" gap={2}>
                <Chip
                  label={getStateLabel()}
                  color={getStateColor()}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  Mode: {mode}
                </Typography>
              </Box>
            </Grid>
            
            {/* Control Buttons */}
            <Grid item xs={12} md={4}>
              <Box display="flex" justifyContent="center">
                <ButtonGroup variant="contained" size="large">
                  <Tooltip title={state === SimulationState.PAUSED ? "Resume" : "Start"}>
                    <span>
                      <Button
                        onClick={handleStart}
                        disabled={state === SimulationState.RUNNING}
                        startIcon={<PlayArrow />}
                        color="primary"
                      >
                        {state === SimulationState.PAUSED ? 'Resume' : 'Start'}
                      </Button>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="Pause">
                    <span>
                      <Button
                        onClick={handlePause}
                        disabled={state !== SimulationState.RUNNING}
                        startIcon={<Pause />}
                        color="warning"
                      >
                        Pause
                      </Button>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="Stop">
                    <span>
                      <Button
                        onClick={handleStop}
                        disabled={state === SimulationState.STOPPED}
                        startIcon={<Stop />}
                        color="error"
                      >
                        Stop
                      </Button>
                    </span>
                  </Tooltip>
                  
                  <Tooltip title="Step">
                    <span>
                      <IconButton
                        onClick={handleStep}
                        disabled={state === SimulationState.RUNNING}
                        color="primary"
                      >
                        <SkipNext />
                      </IconButton>
                    </span>
                  </Tooltip>
                </ButtonGroup>
              </Box>
            </Grid>
            
            {/* Speed Control */}
            <Grid item xs={12} md={3}>
              <Box display="flex" alignItems="center" gap={1}>
                <Speed />
                <Typography variant="body2" sx={{ minWidth: 40 }}>
                  {config.timeAcceleration}x
                </Typography>
                <Slider
                  value={config.timeAcceleration}
                  onChange={handleSpeedChange}
                  min={0.1}
                  max={10}
                  step={0.1}
                  marks={[
                    { value: 0.1, label: '0.1x' },
                    { value: 1, label: '1x' },
                    { value: 5, label: '5x' },
                    { value: 10, label: '10x' }
                  ]}
                  sx={{ minWidth: 150 }}
                />
              </Box>
            </Grid>
            
            {/* Settings Button */}
            <Grid item xs={12} md={2}>
              <Box display="flex" justifyContent="flex-end">
                <Tooltip title="Settings">
                  <IconButton onClick={handleSettingsOpen} color="primary">
                    <Settings />
                  </IconButton>
                </Tooltip>
              </Box>
            </Grid>
            
            {/* Mode Selection */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="body2">Simulation Mode:</Typography>
                <ButtonGroup variant="outlined" size="small">
                  <Button
                    onClick={() => onModeChange(SimulationMode.REALTIME)}
                    variant={mode === SimulationMode.REALTIME ? 'contained' : 'outlined'}
                  >
                    Real-time
                  </Button>
                  <Button
                    onClick={() => onModeChange(SimulationMode.ACCELERATED)}
                    variant={mode === SimulationMode.ACCELERATED ? 'contained' : 'outlined'}
                  >
                    Accelerated
                  </Button>
                  <Button
                    onClick={() => onModeChange(SimulationMode.STEP)}
                    variant={mode === SimulationMode.STEP ? 'contained' : 'outlined'}
                  >
                    Step
                  </Button>
                  <Button
                    onClick={() => onModeChange(SimulationMode.PLAYBACK)}
                    variant={mode === SimulationMode.PLAYBACK ? 'contained' : 'outlined'}
                  >
                    Playback
                  </Button>
                </ButtonGroup>
              </Box>
            </Grid>
            
            {/* Quick Status */}
            <Grid item xs={12}>
              <Box display="flex" gap={3} mt={1}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Timer fontSize="small" />
                  <Typography variant="caption">
                    Rate: {config.simulationRate} Hz
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Science fontSize="small" />
                  <Typography variant="caption">
                    Physics: {config.enablePhysics ? 'On' : 'Off'}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <NetworkCheck fontSize="small" />
                  <Typography variant="caption">
                    Network Sim: {config.enableNetworkSimulation ? 'On' : 'Off'}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Memory fontSize="small" />
                  <Typography variant="caption">
                    Recording: {config.enableRecording ? 'On' : 'Off'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={handleSettingsClose} maxWidth="md" fullWidth>
        <DialogTitle>Simulation Settings</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Timing Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Timing Configuration
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Simulation Rate (Hz)"
                type="number"
                value={tempConfig.simulationRate}
                onChange={(e) => setTempConfig({
                  ...tempConfig,
                  simulationRate: Number(e.target.value)
                })}
                inputProps={{ min: 1, max: 1000 }}
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Physics Rate (Hz)"
                type="number"
                value={tempConfig.physicsRate}
                onChange={(e) => setTempConfig({
                  ...tempConfig,
                  physicsRate: Number(e.target.value)
                })}
                inputProps={{ min: 1, max: 1000 }}
                disabled={!tempConfig.enablePhysics}
              />
            </Grid>
            
            {/* Feature Toggles */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Features
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tempConfig.enablePhysics}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      enablePhysics: e.target.checked
                    })}
                  />
                }
                label="Enable Physics Simulation"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tempConfig.enableNetworkSimulation}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      enableNetworkSimulation: e.target.checked
                    })}
                  />
                }
                label="Enable Network Simulation"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tempConfig.enableRecording}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      enableRecording: e.target.checked
                    })}
                  />
                }
                label="Enable Recording"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tempConfig.autoDiscoverDevices}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      autoDiscoverDevices: e.target.checked
                    })}
                  />
                }
                label="Auto-discover Devices"
              />
            </Grid>
            
            {/* Network Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Network Configuration
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth disabled={!tempConfig.enableNetworkSimulation}>
                <InputLabel>Default Network Profile</InputLabel>
                <Select
                  value={tempConfig.defaultNetworkProfile}
                  onChange={(e) => setTempConfig({
                    ...tempConfig,
                    defaultNetworkProfile: e.target.value
                  })}
                  label="Default Network Profile"
                >
                  <MenuItem value="perfect">Perfect</MenuItem>
                  <MenuItem value="satellite">Satellite</MenuItem>
                  <MenuItem value="cellular_4g">Cellular 4G</MenuItem>
                  <MenuItem value="cellular_3g">Cellular 3G</MenuItem>
                  <MenuItem value="wifi_good">WiFi (Good)</MenuItem>
                  <MenuItem value="wifi_poor">WiFi (Poor)</MenuItem>
                  <MenuItem value="congested">Congested</MenuItem>
                  <MenuItem value="intermittent">Intermittent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Recording Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Recording Configuration
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Recording Buffer Size"
                type="number"
                value={tempConfig.recordingBufferSize}
                onChange={(e) => setTempConfig({
                  ...tempConfig,
                  recordingBufferSize: Number(e.target.value)
                })}
                inputProps={{ min: 100, max: 100000 }}
                disabled={!tempConfig.enableRecording}
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Auto-save Interval (seconds)"
                type="number"
                value={tempConfig.autoSaveInterval}
                onChange={(e) => setTempConfig({
                  ...tempConfig,
                  autoSaveInterval: Number(e.target.value)
                })}
                inputProps={{ min: 10, max: 3600 }}
                disabled={!tempConfig.enableRecording}
              />
            </Grid>
            
            {/* Performance Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Performance Configuration
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Max Concurrent Devices"
                type="number"
                value={tempConfig.maxConcurrentDevices}
                onChange={(e) => setTempConfig({
                  ...tempConfig,
                  maxConcurrentDevices: Number(e.target.value)
                })}
                inputProps={{ min: 1, max: 1000 }}
              />
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Event Queue Size"
                type="number"
                value={tempConfig.eventQueueSize}
                onChange={(e) => setTempConfig({
                  ...tempConfig,
                  eventQueueSize: Number(e.target.value)
                })}
                inputProps={{ min: 100, max: 10000 }}
              />
            </Grid>
            
            {/* Debug Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Debug Configuration
              </Typography>
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tempConfig.verboseLogging}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      verboseLogging: e.target.checked
                    })}
                  />
                }
                label="Verbose Logging"
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tempConfig.debugMode}
                    onChange={(e) => setTempConfig({
                      ...tempConfig,
                      debugMode: e.target.checked
                    })}
                  />
                }
                label="Debug Mode"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleSettingsClose}>Cancel</Button>
          <Button onClick={handleSettingsSave} variant="contained">
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};