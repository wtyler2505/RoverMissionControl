/**
 * Main Simulation Dashboard
 * Central hub for simulation control and monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Tab,
  Tabs,
  Paper,
  Alert,
  Snackbar,
  useTheme
} from '@mui/material';
import { SimulationControlPanel } from './SimulationControlPanel';
import { DeviceSimulator } from './DeviceSimulator';
import { NetworkConditionPanel } from './NetworkConditionPanel';
import { EnvironmentControls } from './EnvironmentControls';
import { ScenarioPlayer } from './ScenarioPlayer';
import { SimulationRecorder } from './SimulationRecorder';
import { SimulationMetrics } from './SimulationMetrics';
import { 
  SimulationState, 
  SimulationMode, 
  SimulationConfig,
  SimulationStats,
  DeviceState,
  EnvironmentalConditions,
  NetworkProfile,
  Scenario,
  SimulationEvent
} from './types';

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
      id={`simulation-tabpanel-${index}`}
      aria-labelledby={`simulation-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

interface SimulationDashboardProps {
  onConfigChange?: (config: SimulationConfig) => void;
}

export const SimulationDashboard: React.FC<SimulationDashboardProps> = ({
  onConfigChange
}) => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  
  // Simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>(SimulationState.STOPPED);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>(SimulationMode.REALTIME);
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>({
    simulationRate: 100,
    timeAcceleration: 1.0,
    enableRecording: true,
    recordingBufferSize: 10000,
    autoSaveInterval: 60,
    enablePhysics: true,
    physicsRate: 100,
    enableNetworkSimulation: true,
    defaultNetworkProfile: 'wifi_good',
    autoDiscoverDevices: true,
    deviceStartupDelay: 0.5,
    maxConcurrentDevices: 100,
    eventQueueSize: 1000,
    verboseLogging: false,
    debugMode: false
  });
  
  const [simulationStats, setSimulationStats] = useState<SimulationStats>({
    simulationTime: 0,
    realTime: 0,
    devicesActive: 0,
    eventsProcessed: 0,
    cpuUsage: 0,
    memoryUsage: 0
  });
  
  // Component state
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [environment, setEnvironment] = useState<EnvironmentalConditions | null>(null);
  const [networkProfile, setNetworkProfile] = useState<NetworkProfile | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [events, setEvents] = useState<SimulationEvent[]>([]);
  const [recordings, setRecordings] = useState<string[]>([]);
  
  // Alerts
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/simulation`);
    
    ws.onopen = () => {
      console.log('Connected to simulation WebSocket');
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleSimulationEvent(data);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      showAlert('WebSocket connection error', 'error');
    };
    
    ws.onclose = () => {
      console.log('Disconnected from simulation WebSocket');
    };
    
    return () => {
      ws.close();
    };
  }, []);
  
  const handleSimulationEvent = (event: SimulationEvent) => {
    // Add to events list
    setEvents(prev => [...prev.slice(-99), event]);
    
    // Handle specific event types
    switch (event.eventType) {
      case 'simulation_started':
        setSimulationState(SimulationState.RUNNING);
        break;
      case 'simulation_stopped':
        setSimulationState(SimulationState.STOPPED);
        break;
      case 'simulation_paused':
        setSimulationState(SimulationState.PAUSED);
        break;
      case 'device_added':
        fetchDevices();
        break;
      case 'device_removed':
        fetchDevices();
        break;
      case 'environment_changed':
        fetchEnvironment();
        break;
      case 'network_profile_changed':
        fetchNetworkProfile();
        break;
      case 'stats_update':
        setSimulationStats(event.data as SimulationStats);
        break;
    }
  };
  
  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/simulation/devices');
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };
  
  const fetchEnvironment = async () => {
    try {
      const response = await fetch('/api/simulation/environment');
      const data = await response.json();
      setEnvironment(data);
    } catch (error) {
      console.error('Failed to fetch environment:', error);
    }
  };
  
  const fetchNetworkProfile = async () => {
    try {
      const response = await fetch('/api/simulation/network');
      const data = await response.json();
      setNetworkProfile(data);
    } catch (error) {
      console.error('Failed to fetch network profile:', error);
    }
  };
  
  const fetchScenarios = async () => {
    try {
      const response = await fetch('/api/simulation/scenarios');
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    }
  };
  
  const fetchRecordings = async () => {
    try {
      const response = await fetch('/api/simulation/recordings');
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error('Failed to fetch recordings:', error);
    }
  };
  
  useEffect(() => {
    fetchDevices();
    fetchEnvironment();
    fetchNetworkProfile();
    fetchScenarios();
    fetchRecordings();
  }, []);
  
  const handleSimulationControl = async (action: 'start' | 'stop' | 'pause' | 'resume' | 'step') => {
    try {
      const response = await fetch(`/api/simulation/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: simulationMode,
          config: simulationConfig
        })
      });
      
      if (response.ok) {
        showAlert(`Simulation ${action} successful`, 'success');
      } else {
        showAlert(`Failed to ${action} simulation`, 'error');
      }
    } catch (error) {
      console.error(`Failed to ${action} simulation:`, error);
      showAlert(`Failed to ${action} simulation`, 'error');
    }
  };
  
  const handleConfigUpdate = (newConfig: Partial<SimulationConfig>) => {
    const updatedConfig = { ...simulationConfig, ...newConfig };
    setSimulationConfig(updatedConfig);
    
    if (onConfigChange) {
      onConfigChange(updatedConfig);
    }
    
    // Update backend
    fetch('/api/simulation/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedConfig)
    }).catch(error => {
      console.error('Failed to update config:', error);
      showAlert('Failed to update configuration', 'error');
    });
  };
  
  const handleDeviceAdd = async (deviceProfile: any) => {
    try {
      const response = await fetch('/api/simulation/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceProfile)
      });
      
      if (response.ok) {
        showAlert('Device added successfully', 'success');
        fetchDevices();
      } else {
        showAlert('Failed to add device', 'error');
      }
    } catch (error) {
      console.error('Failed to add device:', error);
      showAlert('Failed to add device', 'error');
    }
  };
  
  const handleDeviceRemove = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/simulation/devices/${deviceId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        showAlert('Device removed successfully', 'success');
        fetchDevices();
      } else {
        showAlert('Failed to remove device', 'error');
      }
    } catch (error) {
      console.error('Failed to remove device:', error);
      showAlert('Failed to remove device', 'error');
    }
  };
  
  const handleEnvironmentUpdate = async (conditions: EnvironmentalConditions) => {
    try {
      const response = await fetch('/api/simulation/environment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions)
      });
      
      if (response.ok) {
        setEnvironment(conditions);
        showAlert('Environment updated successfully', 'success');
      } else {
        showAlert('Failed to update environment', 'error');
      }
    } catch (error) {
      console.error('Failed to update environment:', error);
      showAlert('Failed to update environment', 'error');
    }
  };
  
  const handleNetworkProfileChange = async (profileName: string) => {
    try {
      const response = await fetch('/api/simulation/network', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: profileName })
      });
      
      if (response.ok) {
        showAlert('Network profile updated successfully', 'success');
        fetchNetworkProfile();
      } else {
        showAlert('Failed to update network profile', 'error');
      }
    } catch (error) {
      console.error('Failed to update network profile:', error);
      showAlert('Failed to update network profile', 'error');
    }
  };
  
  const handleScenarioExecute = async (scenarioId: string, variables?: Record<string, any>) => {
    try {
      const response = await fetch(`/api/simulation/scenarios/${scenarioId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables })
      });
      
      if (response.ok) {
        showAlert('Scenario execution started', 'success');
      } else {
        showAlert('Failed to execute scenario', 'error');
      }
    } catch (error) {
      console.error('Failed to execute scenario:', error);
      showAlert('Failed to execute scenario', 'error');
    }
  };
  
  const handleRecordingPlayback = async (recordingId: string, speed: number = 1.0) => {
    try {
      const response = await fetch(`/api/simulation/recordings/${recordingId}/playback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed })
      });
      
      if (response.ok) {
        showAlert('Recording playback started', 'success');
      } else {
        showAlert('Failed to start playback', 'error');
      }
    } catch (error) {
      console.error('Failed to start playback:', error);
      showAlert('Failed to start playback', 'error');
    }
  };
  
  const showAlert = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setAlertOpen(true);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Simulation Control Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Control Panel */}
        <Grid item xs={12}>
          <SimulationControlPanel
            state={simulationState}
            mode={simulationMode}
            config={simulationConfig}
            onStateChange={handleSimulationControl}
            onModeChange={setSimulationMode}
            onConfigChange={handleConfigUpdate}
          />
        </Grid>
        
        {/* Metrics */}
        <Grid item xs={12}>
          <SimulationMetrics
            stats={simulationStats}
            events={events}
          />
        </Grid>
        
        {/* Main Content Tabs */}
        <Grid item xs={12}>
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="simulation tabs">
                <Tab label="Devices" />
                <Tab label="Environment" />
                <Tab label="Network" />
                <Tab label="Scenarios" />
                <Tab label="Recording" />
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              <DeviceSimulator
                devices={devices}
                onDeviceAdd={handleDeviceAdd}
                onDeviceRemove={handleDeviceRemove}
                onDeviceUpdate={(deviceId, state) => {
                  // Handle device state update
                  fetch(`/api/simulation/devices/${deviceId}/state`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                  });
                }}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <EnvironmentControls
                conditions={environment}
                onChange={handleEnvironmentUpdate}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              <NetworkConditionPanel
                currentProfile={networkProfile}
                onProfileChange={handleNetworkProfileChange}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={3}>
              <ScenarioPlayer
                scenarios={scenarios}
                onExecute={handleScenarioExecute}
                onRefresh={fetchScenarios}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={4}>
              <SimulationRecorder
                recordings={recordings}
                isRecording={simulationConfig.enableRecording && simulationState === SimulationState.RUNNING}
                onPlayback={handleRecordingPlayback}
                onRefresh={fetchRecordings}
              />
            </TabPanel>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Alert Snackbar */}
      <Snackbar
        open={alertOpen}
        autoHideDuration={6000}
        onClose={() => setAlertOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setAlertOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};