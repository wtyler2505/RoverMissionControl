import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Alert,
  Snackbar
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { CommandTracker } from './CommandTracker';
import { CommandProgressIndicator, MultiStepProgress } from './CommandProgressIndicator';
import { getAcknowledgmentService } from '../../services/acknowledgment.service';
import { CommandPriority, CommandType } from '../../../../shared/types/command-queue.types';

/**
 * Example component demonstrating the command acknowledgment system
 */
export const CommandAcknowledgmentExample: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const acknowledgmentService = getAcknowledgmentService();

  // Multi-step command example
  const [multiStepProgress, setMultiStepProgress] = useState([
    { id: 'init', label: 'Initialize', status: 'pending' as const, progress: 0 },
    { id: 'validate', label: 'Validate Parameters', status: 'pending' as const, progress: 0 },
    { id: 'execute', label: 'Execute Command', status: 'pending' as const, progress: 0 },
    { id: 'verify', label: 'Verify Results', status: 'pending' as const, progress: 0 }
  ]);

  const sendExampleCommand = async (type: CommandType, priority: CommandPriority = CommandPriority.NORMAL) => {
    try {
      // In a real application, this would send a command through your command service
      // For demonstration, we'll simulate the command flow
      const commandId = `cmd-${Date.now()}`;
      
      // Simulate command creation and tracking
      await acknowledgmentService.trackCommand(commandId);
      
      setNotification(`Command ${commandId} sent with ${priority === CommandPriority.HIGH ? 'high' : 'normal'} priority`);
    } catch (error) {
      console.error('Failed to send command:', error);
      setNotification('Failed to send command');
    }
  };

  const simulateMultiStepCommand = async () => {
    // Reset progress
    setMultiStepProgress(steps => steps.map(s => ({ ...s, status: 'pending' as const, progress: 0 })));
    
    // Simulate step progression
    for (let i = 0; i < multiStepProgress.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set current step to active
      setMultiStepProgress(steps => steps.map((s, idx) => ({
        ...s,
        status: idx < i ? 'completed' : idx === i ? 'active' : 'pending'
      } as any)));
      
      // Simulate progress within step
      for (let p = 0; p <= 100; p += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setMultiStepProgress(steps => steps.map((s, idx) => ({
          ...s,
          progress: idx === i ? p / 100 : s.progress,
          message: idx === i && p > 0 ? `Processing... ${p}%` : s.message
        })));
      }
      
      // Complete step
      setMultiStepProgress(steps => steps.map((s, idx) => ({
        ...s,
        status: idx <= i ? 'completed' : s.status,
        progress: idx <= i ? 1 : s.progress,
        message: idx === i ? 'Complete' : s.message
      } as any)));
    }
  };

  const handleCommandComplete = (commandId: string) => {
    setNotification(`Command ${commandId} completed successfully!`);
  };

  const handleCommandFail = (commandId: string) => {
    setNotification(`Command ${commandId} failed!`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Command Acknowledgment System Demo
      </Typography>
      
      <Stack spacing={3}>
        {/* Command Actions */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Send Test Commands
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={() => sendExampleCommand(CommandType.MOVE_FORWARD)}
            >
              Move Forward
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<SendIcon />}
              onClick={() => sendExampleCommand(CommandType.READ_SENSOR, CommandPriority.HIGH)}
            >
              Read Sensor (High Priority)
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<SendIcon />}
              onClick={() => sendExampleCommand(CommandType.EMERGENCY_STOP, CommandPriority.EMERGENCY)}
            >
              Emergency Stop
            </Button>
          </Stack>
        </Paper>

        {/* Progress Indicators Demo */}
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Progress Indicators
          </Typography>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Circular Progress
              </Typography>
              <Stack direction="row" spacing={3} alignItems="center">
                <CommandProgressIndicator
                  progress={0.25}
                  variant="circular"
                  size="small"
                  message="Initializing..."
                />
                <CommandProgressIndicator
                  progress={0.5}
                  variant="circular"
                  size="medium"
                  color="secondary"
                  message="Processing..."
                />
                <CommandProgressIndicator
                  progress={0.75}
                  variant="circular"
                  size="large"
                  color="success"
                  message="Almost done..."
                />
              </Stack>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Linear Progress
              </Typography>
              <Box sx={{ width: '100%', maxWidth: 400 }}>
                <CommandProgressIndicator
                  progress={0.6}
                  variant="linear"
                  message="Downloading firmware update..."
                  animated
                />
              </Box>
            </Box>
            
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Multi-Step Progress
              </Typography>
              <Box sx={{ maxWidth: 400 }}>
                <MultiStepProgress steps={multiStepProgress} />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={simulateMultiStepCommand}
                  sx={{ mt: 2 }}
                >
                  Simulate Multi-Step Command
                </Button>
              </Box>
            </Box>
          </Stack>
        </Paper>

        {/* Command Tracker */}
        <Box>
          <Button
            variant="outlined"
            onClick={() => setIsTracking(!isTracking)}
            sx={{ mb: 2 }}
          >
            {isTracking ? 'Hide' : 'Show'} Command Tracker
          </Button>
          
          {isTracking && (
            <CommandTracker
              maxCommands={10}
              showStats
              onCommandComplete={handleCommandComplete}
              onCommandFail={handleCommandFail}
            />
          )}
        </Box>
      </Stack>

      {/* Notifications */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={() => setNotification(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setNotification(null)}
          severity={notification?.includes('failed') ? 'error' : 'success'}
          variant="filled"
        >
          {notification}
        </Alert>
      </Snackbar>
    </Box>
  );
};