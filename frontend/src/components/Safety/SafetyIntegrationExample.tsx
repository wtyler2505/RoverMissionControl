/**
 * Safety Integration Example
 * 
 * Demonstrates how to integrate the emergency stop button and safety system
 * into a mission control interface.
 * 
 * @module SafetyIntegrationExample
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import EmergencyStopButton from './EmergencyStopButton';
import SafetyProvider, { useSafety } from './SafetyProvider';
import { SafetyEvent } from './types';

// Safety status panel component
const SafetyStatusPanel: React.FC = () => {
  const { status, config } = useSafety();

  const getStatusColor = (check: boolean) => (check ? 'success' : 'error');
  const getStatusIcon = (check: boolean) =>
    check ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          System Safety Status
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Chip
            label={status.overallState.toUpperCase()}
            color={
              status.overallState === 'safe'
                ? 'success'
                : status.overallState === 'warning'
                ? 'warning'
                : 'error'
            }
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        
        <List dense>
          <ListItem>
            <ListItemIcon>{getStatusIcon(status.systemChecks.communications)}</ListItemIcon>
            <ListItemText
              primary="Communications"
              secondary={status.systemChecks.communications ? 'Online' : 'Offline'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>{getStatusIcon(status.systemChecks.power)}</ListItemIcon>
            <ListItemText
              primary="Power Systems"
              secondary={status.systemChecks.power ? 'Normal' : 'Critical'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>{getStatusIcon(status.systemChecks.motors)}</ListItemIcon>
            <ListItemText
              primary="Motor Control"
              secondary={status.systemChecks.motors ? 'Enabled' : 'Disabled'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>{getStatusIcon(status.systemChecks.sensors)}</ListItemIcon>
            <ListItemText
              primary="Sensor Array"
              secondary={status.systemChecks.sensors ? 'Operational' : 'Fault'}
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>{getStatusIcon(status.systemChecks.navigation)}</ListItemIcon>
            <ListItemText
              primary="Navigation"
              secondary={status.systemChecks.navigation ? 'Active' : 'Halted'}
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
};

// Safety event log component
const SafetyEventLog: React.FC = () => {
  const { status } = useSafety();
  
  const getEventIcon = (severity: SafetyEvent['severity']) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'high':
        return <WarningIcon color="warning" />;
      case 'medium':
        return <InfoIcon color="info" />;
      case 'low':
        return <InfoIcon />;
      default:
        return <InfoIcon />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent Safety Events
        </Typography>
        
        {status.recentEvents.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No recent safety events
          </Typography>
        ) : (
          <List dense>
            {status.recentEvents.slice(0, 5).map((event) => (
              <ListItem key={event.id}>
                <ListItemIcon>{getEventIcon(event.severity)}</ListItemIcon>
                <ListItemText
                  primary={event.message}
                  secondary={new Date(event.timestamp).toLocaleString()}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

// Mission control header with emergency stop
const MissionControlHeader: React.FC = () => {
  const { status } = useSafety();
  
  return (
    <AppBar position="static" color="default">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Rover Mission Control
        </Typography>
        
        {status.emergencyStop.isActive && (
          <Chip
            label="EMERGENCY STOP ACTIVE"
            color="error"
            sx={{ mr: 2, animation: 'blink 1s infinite' }}
          />
        )}
        
        <Tooltip title="System Settings">
          <IconButton>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Notifications">
          <IconButton>
            <NotificationsIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};

// Main integration example component
const SafetyIntegrationExample: React.FC = () => {
  const [missionTime, setMissionTime] = useState(0);
  const [roverPosition, setRoverPosition] = useState({ x: 0, y: 0 });
  
  // Simulate mission time
  useEffect(() => {
    const interval = setInterval(() => {
      setMissionTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Simulate rover movement
  useEffect(() => {
    const interval = setInterval(() => {
      setRoverPosition((prev) => ({
        x: prev.x + (Math.random() - 0.5) * 2,
        y: prev.y + (Math.random() - 0.5) * 2,
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <SafetyProvider
      onEmergencyStop={(state) => {
        console.log('Emergency stop activated:', state);
      }}
      onSafetyEvent={(event) => {
        console.log('Safety event:', event);
      }}
    >
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <MissionControlHeader />
        
        <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          <Grid container spacing={3}>
            {/* Mission Status */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                  Mission Status
                </Typography>
                
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Mission Time
                    </Typography>
                    <Typography variant="h6">{formatTime(missionTime)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Rover Position
                    </Typography>
                    <Typography variant="h6">
                      X: {roverPosition.x.toFixed(1)}, Y: {roverPosition.y.toFixed(1)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Battery Level
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={85}
                        sx={{ flexGrow: 1, height: 8 }}
                      />
                      <Typography variant="body2">85%</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Signal Strength
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={92}
                        color="success"
                        sx={{ flexGrow: 1, height: 8 }}
                      />
                      <Typography variant="body2">92%</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
              
              {/* Main control area */}
              <Paper sx={{ p: 3, height: 400, position: 'relative' }}>
                <Typography variant="h6" gutterBottom>
                  Rover Control Interface
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Main control interface would be displayed here
                </Typography>
              </Paper>
            </Grid>
            
            {/* Safety panels */}
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <SafetyStatusPanel />
                <SafetyEventLog />
              </Box>
            </Grid>
          </Grid>
        </Box>
        
        {/* Emergency Stop Button - Fixed Position */}
        <EmergencyStopButton
          isActivated={false}
          onActivate={async () => {
            console.log('Emergency stop activated!');
            // In a real application, this would trigger emergency procedures
          }}
          onDeactivate={async () => {
            console.log('Emergency stop cleared');
            // In a real application, this would resume normal operations
          }}
          fixed={true}
          position={{ bottom: 30, right: 30 }}
          requireDoubleConfirmation={true}
        />
      </Box>
      
      <style>{`
        @keyframes blink {
          0%, 50%, 100% { opacity: 1; }
          25%, 75% { opacity: 0.5; }
        }
      `}</style>
    </SafetyProvider>
  );
};

export default SafetyIntegrationExample;