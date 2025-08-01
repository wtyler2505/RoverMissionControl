/**
 * Emergency Stop Levels System
 * 
 * Implements multiple emergency stop levels with different severity and actions.
 * Each level provides graduated response capabilities for different emergency scenarios.
 * 
 * Stop Levels:
 * - Level 1: Soft Stop (graceful shutdown, warnings)
 * - Level 2: Hard Stop (immediate halt, maintain power)
 * - Level 3: Emergency Stop (all systems halt)
 * - Level 4: Critical Stop (power shutdown, lockout)
 * - Level 5: Failsafe Mode (minimal systems only)
 * 
 * @module EmergencyStopLevels
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  ButtonGroup,
  Alert,
  AlertTitle,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Stop as StopIcon,
  Power as PowerIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
  PanTool as PanToolIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipNext as SkipNextIcon,
} from '@mui/icons-material';

// Animation for critical alerts
const criticalPulse = keyframes`
  0%, 100% { 
    background-color: #d32f2f; 
    transform: scale(1);
  }
  50% { 
    background-color: #f44336; 
    transform: scale(1.02);
  }
`;

// Emergency stop levels configuration
export enum EmergencyStopLevel {
  SOFT_STOP = 1,      // Level 1: Graceful shutdown with warnings
  HARD_STOP = 2,      // Level 2: Immediate halt, maintain power
  EMERGENCY_STOP = 3, // Level 3: All systems halt
  CRITICAL_STOP = 4,  // Level 4: Power shutdown, lockout
  FAILSAFE_MODE = 5,  // Level 5: Minimal systems only
}

// Stop level configuration
export interface StopLevelConfig {
  level: EmergencyStopLevel;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  severity: 'info' | 'warning' | 'error';
  actions: string[];
  confirmationRequired: boolean;
  automaticTriggers: string[];
  recoverySteps: string[];
  estimatedDuration: number; // seconds
}

// System state for stop level decisions
export interface SystemState {
  isMoving: boolean;
  powerLevel: number;
  sensorsActive: number;
  communicationHealth: 'good' | 'degraded' | 'poor' | 'lost';
  batteryLevel: number;
  emergencyBattery: boolean;
  hardwareStatus: 'normal' | 'warning' | 'error' | 'critical';
}

// Stop execution status
export interface StopExecution {
  level: EmergencyStopLevel;
  startTime: Date;
  estimatedCompletion: Date;
  currentStep: string;
  progress: number;
  errors: string[];
  warnings: string[];
}

const STOP_LEVEL_CONFIGS: Record<EmergencyStopLevel, StopLevelConfig> = {
  [EmergencyStopLevel.SOFT_STOP]: {
    level: EmergencyStopLevel.SOFT_STOP,
    name: 'Soft Stop',
    description: 'Graceful shutdown with operator warnings and controlled deceleration',
    icon: <PauseIcon />,
    color: '#ff9800',
    severity: 'warning',
    actions: [
      'Send warning to operator',
      'Begin controlled deceleration',
      'Save current mission state',
      'Prepare for safe stop position',
      'Maintain all systems online',
    ],
    confirmationRequired: false,
    automaticTriggers: [
      'Low battery warning (< 20%)',
      'Communication degraded',
      'Minor sensor malfunction',
      'Scheduled maintenance window',
    ],
    recoverySteps: [
      'Verify all systems operational',
      'Check mission parameters',
      'Resume from saved state',
    ],
    estimatedDuration: 15,
  },
  [EmergencyStopLevel.HARD_STOP]: {
    level: EmergencyStopLevel.HARD_STOP,
    name: 'Hard Stop',
    description: 'Immediate halt of all movement while maintaining power to critical systems',
    icon: <StopIcon />,
    color: '#f44336',
    severity: 'error',
    actions: [
      'Immediate motor shutdown',
      'Engage mechanical brakes',
      'Maintain power to sensors',
      'Keep communication active',
      'Log stop event',
      'Send immediate alerts',
    ],
    confirmationRequired: true,
    automaticTriggers: [
      'Obstacle detected < 1m',
      'Tilt angle > 30 degrees',
      'Communication poor quality',
      'Critical sensor failure',
    ],
    recoverySteps: [
      'Clear obstacle or hazard',
      'Verify mechanical systems',
      'Confirm operator ready',
      'Manual restart required',
    ],
    estimatedDuration: 5,
  },
  [EmergencyStopLevel.EMERGENCY_STOP]: {
    level: EmergencyStopLevel.EMERGENCY_STOP,
    name: 'Emergency Stop',
    description: 'All systems halt immediately, only life-critical functions remain active',
    icon: <PanToolIcon />,
    color: '#d32f2f',
    severity: 'error',
    actions: [
      'Immediate shutdown all motors',
      'Deploy emergency brakes',
      'Cut power to non-critical systems',
      'Maintain emergency communication',
      'Activate emergency beacon',
      'Log critical event',
    ],
    confirmationRequired: true,
    automaticTriggers: [
      'Imminent collision detected',
      'Critical hardware failure',
      'Loss of main communication',
      'Battery critically low (< 5%)',
    ],
    recoverySteps: [
      'Manual inspection required',
      'Hardware diagnostics',
      'Safety checklist completion',
      'Supervisor authorization',
    ],
    estimatedDuration: 2,
  },
  [EmergencyStopLevel.CRITICAL_STOP]: {
    level: EmergencyStopLevel.CRITICAL_STOP,
    name: 'Critical Stop',
    description: 'Complete power shutdown with system lockout and manual override required',
    icon: <PowerIcon />,
    color: '#b71c1c',
    severity: 'error',
    actions: [
      'Complete power shutdown',
      'Engage physical lockouts',
      'Emergency position hold',
      'Activate distress beacon',
      'Enable manual override only',
      'Secure all interfaces',
    ],
    confirmationRequired: true,
    automaticTriggers: [
      'Fire/smoke detected',
      'Electrical fault detected',
      'Multiple system failures',
      'Security breach detected',
    ],
    recoverySteps: [
      'Physical inspection by technician',
      'Manual override activation',
      'Complete system diagnostics',
      'Management authorization',
    ],
    estimatedDuration: 1,
  },
  [EmergencyStopLevel.FAILSAFE_MODE]: {
    level: EmergencyStopLevel.FAILSAFE_MODE,
    name: 'Failsafe Mode',
    description: 'Minimal systems operation with emergency-only functionality',
    icon: <ShieldIcon />,
    color: '#4a148c',
    severity: 'error',
    actions: [
      'Switch to emergency battery',
      'Minimal sensor operation',
      'Emergency communication only',
      'Position hold mode',
      'Reduce all power consumption',
      'Continuous system monitoring',
    ],
    confirmationRequired: false,
    automaticTriggers: [
      'Primary power failure',
      'Multiple communication failures',
      'Environmental hazard detected',
      'Prolonged isolation',
    ],
    recoverySteps: [
      'Restore primary power',
      'Re-establish communications',
      'System integrity check',
      'Gradual system restoration',
    ],
    estimatedDuration: 30,
  },
};

interface EmergencyStopLevelsProps {
  systemState: SystemState;
  onStopLevelExecute: (level: EmergencyStopLevel, testMode?: boolean) => Promise<void>;
  onStopLevelCancel: () => Promise<void>;
  currentExecution?: StopExecution;
  testMode?: boolean;
  onTestModeChange?: (enabled: boolean) => void;
  disabled?: boolean;
}

const EmergencyStopLevels: React.FC<EmergencyStopLevelsProps> = ({
  systemState,
  onStopLevelExecute,
  onStopLevelCancel,
  currentExecution,
  testMode = false,
  onTestModeChange,
  disabled = false,
}) => {
  const theme = useTheme();
  const [selectedLevel, setSelectedLevel] = useState<EmergencyStopLevel | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [showLevelDetails, setShowLevelDetails] = useState<EmergencyStopLevel | null>(null);

  // Calculate recommended stop level based on system state
  const getRecommendedLevel = useCallback((): EmergencyStopLevel => {
    // Critical conditions requiring immediate action
    if (systemState.batteryLevel < 5 || 
        systemState.hardwareStatus === 'critical' ||
        systemState.communicationHealth === 'lost') {
      return EmergencyStopLevel.EMERGENCY_STOP;
    }

    // Serious conditions requiring hard stop
    if (systemState.batteryLevel < 15 || 
        systemState.hardwareStatus === 'error' ||
        systemState.communicationHealth === 'poor') {
      return EmergencyStopLevel.HARD_STOP;
    }

    // Warning conditions suggesting soft stop
    if (systemState.batteryLevel < 25 || 
        systemState.hardwareStatus === 'warning' ||
        systemState.communicationHealth === 'degraded') {
      return EmergencyStopLevel.SOFT_STOP;
    }

    return EmergencyStopLevel.SOFT_STOP;
  }, [systemState]);

  // Update execution progress
  useEffect(() => {
    if (currentExecution) {
      const now = new Date();
      const totalTime = currentExecution.estimatedCompletion.getTime() - currentExecution.startTime.getTime();
      const elapsed = now.getTime() - currentExecution.startTime.getTime();
      setExecutionProgress(Math.min((elapsed / totalTime) * 100, 100));
    } else {
      setExecutionProgress(0);
    }
  }, [currentExecution]);

  // Handle stop level execution
  const handleExecuteLevel = async (level: EmergencyStopLevel) => {
    const config = STOP_LEVEL_CONFIGS[level];
    
    if (config.confirmationRequired && !testMode) {
      setSelectedLevel(level);
      setShowConfirmDialog(true);
      return;
    }

    try {
      await onStopLevelExecute(level, testMode);
    } catch (error) {
      console.error(`Failed to execute stop level ${level}:`, error);
    }
  };

  // Handle confirmation dialog
  const handleConfirmExecution = async () => {
    if (selectedLevel) {
      setShowConfirmDialog(false);
      try {
        await onStopLevelExecute(selectedLevel, testMode);
      } catch (error) {
        console.error(`Failed to execute stop level ${selectedLevel}:`, error);
      } finally {
        setSelectedLevel(null);
      }
    }
  };

  const recommendedLevel = getRecommendedLevel();

  return (
    <Box sx={{ p: 2 }}>
      {/* Header with test mode toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Emergency Stop Levels
        </Typography>
        {onTestModeChange && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              label={testMode ? 'TEST MODE ACTIVE' : 'LIVE MODE'}
              color={testMode ? 'warning' : 'success'}
              variant={testMode ? 'filled' : 'outlined'}
              icon={testMode ? <SecurityIcon /> : <PlayIcon />}
            />
            <Button
              variant={testMode ? 'contained' : 'outlined'}
              color={testMode ? 'warning' : 'primary'}
              onClick={() => onTestModeChange(!testMode)}
              startIcon={testMode ? <PlayIcon /> : <SecurityIcon />}
              disabled={!!currentExecution}
            >
              {testMode ? 'Exit Test Mode' : 'Enter Test Mode'}
            </Button>
          </Box>
        )}
      </Box>

      {/* Test mode warning */}
      {testMode && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Test Mode Active</AlertTitle>
          Emergency stop actions will be simulated and logged without affecting actual rover systems.
          All procedures will be validated but no real-world actions will be taken.
        </Alert>
      )}

      {/* System state overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Current System State
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Chip 
              label={`Battery: ${systemState.batteryLevel}%`}
              color={systemState.batteryLevel > 25 ? 'success' : systemState.batteryLevel > 15 ? 'warning' : 'error'}
            />
            <Chip 
              label={`Communication: ${systemState.communicationHealth}`}
              color={systemState.communicationHealth === 'good' ? 'success' : 
                     systemState.communicationHealth === 'degraded' ? 'warning' : 'error'}
            />
            <Chip 
              label={`Hardware: ${systemState.hardwareStatus}`}
              color={systemState.hardwareStatus === 'normal' ? 'success' : 
                     systemState.hardwareStatus === 'warning' ? 'warning' : 'error'}
            />
            <Chip 
              label={`Power: ${systemState.powerLevel}%`}
              color={systemState.powerLevel > 50 ? 'success' : systemState.powerLevel > 25 ? 'warning' : 'error'}
            />
          </Stack>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Recommended Stop Level: 
              <Chip 
                label={STOP_LEVEL_CONFIGS[recommendedLevel].name}
                color={STOP_LEVEL_CONFIGS[recommendedLevel].severity as any}
                size="small"
                sx={{ ml: 1 }}
              />
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Current execution status */}
      {currentExecution && (
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={onStopLevelCancel}>
              Cancel
            </Button>
          }
          sx={{ 
            mb: 3,
            animation: currentExecution.level >= EmergencyStopLevel.CRITICAL_STOP ? 
              `${criticalPulse} 1s ease-in-out infinite` : 'none'
          }}
        >
          <AlertTitle>
            {STOP_LEVEL_CONFIGS[currentExecution.level].name} In Progress
          </AlertTitle>
          <Typography variant="body2" gutterBottom>
            Current Step: {currentExecution.currentStep}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={executionProgress} 
            sx={{ mt: 1 }}
          />
          {currentExecution.errors.length > 0 && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              Errors: {currentExecution.errors.join(', ')}
            </Typography>
          )}
        </Alert>
      )}

      {/* Stop level buttons */}
      <Stack spacing={2}>
        {Object.values(STOP_LEVEL_CONFIGS).map((config) => (
          <Card 
            key={config.level}
            sx={{ 
              border: recommendedLevel === config.level ? `2px solid ${config.color}` : '1px solid transparent',
              backgroundColor: recommendedLevel === config.level ? alpha(config.color, 0.05) : 'inherit',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      backgroundColor: alpha(config.color, 0.1),
                      color: config.color,
                    }}
                  >
                    {config.icon}
                  </Box>
                  
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        Level {config.level}: {config.name}
                      </Typography>
                      {recommendedLevel === config.level && (
                        <Chip label="Recommended" color="primary" size="small" />
                      )}
                      {config.confirmationRequired && (
                        <Chip label="Confirmation Required" color="warning" size="small" />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {config.description}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Duration:</strong> ~{config.estimatedDuration} seconds
                    </Typography>
                    
                    <Typography variant="body2">
                      <strong>Key Actions:</strong> {config.actions.slice(0, 3).join(', ')}
                      {config.actions.length > 3 && '...'}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => setShowLevelDetails(config.level)}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                  
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => handleExecuteLevel(config.level)}
                    disabled={disabled || !!currentExecution}
                    sx={{
                      backgroundColor: config.color,
                      '&:hover': {
                        backgroundColor: alpha(config.color, 0.8),
                      },
                      minWidth: 120,
                    }}
                    startIcon={config.icon}
                  >
                    Execute
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Confirmation Dialog */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false);
          setSelectedLevel(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WarningIcon color="error" fontSize="large" />
            <Typography variant="h6">
              Confirm {selectedLevel ? STOP_LEVEL_CONFIGS[selectedLevel].name : 'Emergency Stop'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedLevel && (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                <AlertTitle>Safety Critical Action</AlertTitle>
                This action will execute a {STOP_LEVEL_CONFIGS[selectedLevel].name} and cannot be undone.
                {testMode && ' (Test mode - no actual systems will be affected)'}
              </Alert>
              
              <Typography variant="body1" gutterBottom>
                <strong>Actions to be taken:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                {STOP_LEVEL_CONFIGS[selectedLevel].actions.map((action, index) => (
                  <Typography key={index} component="li" variant="body2">
                    {action}
                  </Typography>
                ))}
              </Box>
              
              <Typography variant="body1" gutterBottom>
                <strong>Recovery will require:</strong>
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {STOP_LEVEL_CONFIGS[selectedLevel].recoverySteps.map((step, index) => (
                  <Typography key={index} component="li" variant="body2">
                    {step}
                  </Typography>
                ))}
              </Box>
            </>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button
            onClick={() => {
              setShowConfirmDialog(false);
              setSelectedLevel(null);
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmExecution}
            color="error"
            variant="contained"
            startIcon={<WarningIcon />}
          >
            {testMode ? 'Execute Test' : 'Execute Stop Level'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Level Details Dialog */}
      <Dialog
        open={!!showLevelDetails}
        onClose={() => setShowLevelDetails(null)}
        maxWidth="md"
        fullWidth
      >
        {showLevelDetails && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {STOP_LEVEL_CONFIGS[showLevelDetails].icon}
                <Typography variant="h6">
                  Level {showLevelDetails}: {STOP_LEVEL_CONFIGS[showLevelDetails].name}
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Typography variant="body1" paragraph>
                {STOP_LEVEL_CONFIGS[showLevelDetails].description}
              </Typography>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Actions Performed
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                {STOP_LEVEL_CONFIGS[showLevelDetails].actions.map((action, index) => (
                  <Typography key={index} component="li" variant="body2" gutterBottom>
                    {action}
                  </Typography>
                ))}
              </Box>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Automatic Triggers
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                {STOP_LEVEL_CONFIGS[showLevelDetails].automaticTriggers.map((trigger, index) => (
                  <Typography key={index} component="li" variant="body2" gutterBottom>
                    {trigger}
                  </Typography>
                ))}
              </Box>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                Recovery Requirements
              </Typography>
              <Box component="ul" sx={{ pl: 2 }}>
                {STOP_LEVEL_CONFIGS[showLevelDetails].recoverySteps.map((step, index) => (
                  <Typography key={index} component="li" variant="body2" gutterBottom>
                    {step}
                  </Typography>
                ))}
              </Box>
              
              <Alert severity="info" sx={{ mt: 3 }}>
                <Typography variant="body2">
                  <strong>Estimated Duration:</strong> {STOP_LEVEL_CONFIGS[showLevelDetails].estimatedDuration} seconds
                </Typography>
                <Typography variant="body2">
                  <strong>Confirmation Required:</strong> {STOP_LEVEL_CONFIGS[showLevelDetails].confirmationRequired ? 'Yes' : 'No'}
                </Typography>
              </Alert>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setShowLevelDetails(null)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default EmergencyStopLevels;