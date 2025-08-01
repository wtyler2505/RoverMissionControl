/**
 * Emergency Stop Levels Integration Component
 * 
 * Main integration component that orchestrates the multi-level emergency stop system
 * with comprehensive testing mode capabilities. Provides unified interface for:
 * - Multiple emergency stop levels (1-5) with different severity
 * - Comprehensive testing mode with safe validation
 * - Configuration interface for stop levels and testing parameters
 * - Results analysis and reporting system
 * - Real-time system monitoring and status
 * 
 * This component serves as the central hub for all emergency stop functionality,
 * integrating with existing safety systems while providing new multi-level
 * capabilities and testing infrastructure.
 * 
 * @module EmergencyStopLevelsIntegration
 */

import React, { useState, useEffect, useCallback, useContext } from 'react';
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Backdrop,
  CircularProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Assessment as AssessmentIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TestTube as TestTubeIcon,
} from '@mui/icons-material';

// Import our new components
import EmergencyStopLevels, { 
  EmergencyStopLevel, 
  SystemState as StopSystemState, 
  StopExecution 
} from './EmergencyStopLevels';
import EmergencyStopTestingMode, {
  TestScenario,
  TestExecutionResult,
  TestExecutionStatus,
} from './EmergencyStopTestingMode';
import EmergencyStopConfiguration from './EmergencyStopConfiguration';

// Import existing components
import EmergencyStopButton from './EmergencyStopButton';
import EmergencyStopHardwareStatus from './EmergencyStopHardwareStatus';
import { useEmergencyStop } from '../../hooks/useEmergencyStop';
import { WebSocketContext } from '../../contexts/WebSocketContext';

// Integration state management
interface IntegrationState {
  isTestMode: boolean;
  currentExecution?: StopExecution;
  testExecution?: {
    scenario: TestScenario;
    status: TestExecutionStatus;
    progress: number;
    currentStep: string;
    elapsedTime: number;
  };
  systemState: StopSystemState;
  testResults: TestExecutionResult[];
  configuration: any;
}

interface EmergencyStopLevelsIntegrationProps {
  onEmergencyStop?: (level: EmergencyStopLevel, testMode: boolean) => Promise<void>;
  onSystemStateChange?: (state: StopSystemState) => void;
  disabled?: boolean;
}

const EmergencyStopLevelsIntegration: React.FC<EmergencyStopLevelsIntegrationProps> = ({
  onEmergencyStop,
  onSystemStateChange,
  disabled = false,
}) => {
  const theme = useTheme();
  const { ws, isConnected } = useContext(WebSocketContext);
  const emergencyStopHook = useEmergencyStop();
  
  const [activeTab, setActiveTab] = useState(0);
  const [integrationState, setIntegrationState] = useState<IntegrationState>({
    isTestMode: false,
    systemState: {
      isMoving: false,
      powerLevel: 85,
      sensorsActive: 12,
      communicationHealth: 'good',
      batteryLevel: 78,
      emergencyBattery: true,
      hardwareStatus: 'normal',
    },
    testResults: [],
    configuration: null,
  });
  
  const [showModeChangeDialog, setShowModeChangeDialog] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState(false);

  // Initialize WebSocket connections for real-time updates
  useEffect(() => {
    if (ws && isConnected) {
      // Subscribe to system state updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'emergency_stop_system_state',
      }));

      // Subscribe to emergency stop events
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'emergency_stop_events',
      }));

      const handleMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'system_state_update':
              setIntegrationState(prev => ({
                ...prev,
                systemState: data.payload,
              }));
              if (onSystemStateChange) {
                onSystemStateChange(data.payload);
              }
              break;
              
            case 'emergency_stop_execution':
              setIntegrationState(prev => ({
                ...prev,
                currentExecution: data.payload,
              }));
              break;
              
            case 'test_execution_update':
              setIntegrationState(prev => ({
                ...prev,
                testExecution: data.payload,
              }));
              break;
              
            case 'test_completion':
              setIntegrationState(prev => ({
                ...prev,
                testResults: [...prev.testResults, data.payload],
                testExecution: undefined,
              }));
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.addEventListener('message', handleMessage);
      
      return () => {
        ws.removeEventListener('message', handleMessage);
      };
    }
  }, [ws, isConnected, onSystemStateChange]);

  // Execute emergency stop level
  const handleStopLevelExecute = useCallback(async (level: EmergencyStopLevel, testMode = false) => {
    try {
      if (testMode !== integrationState.isTestMode) {
        throw new Error('Test mode mismatch - please switch modes first');
      }

      const payload = {
        type: 'execute_emergency_stop_level',
        payload: {
          level,
          testMode,
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      // Call external handler if provided
      if (onEmergencyStop) {
        await onEmergencyStop(level, testMode);
      }

      // If not in test mode, also trigger the traditional emergency stop
      if (!testMode && emergencyStopHook.onActivate) {
        await emergencyStopHook.onActivate();
      }

    } catch (error) {
      console.error('Failed to execute emergency stop level:', error);
      throw error;
    }
  }, [ws, isConnected, integrationState.isTestMode, onEmergencyStop, emergencyStopHook]);

  // Cancel current stop execution
  const handleStopLevelCancel = useCallback(async () => {
    try {
      const payload = {
        type: 'cancel_emergency_stop_execution',
        payload: {
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      setIntegrationState(prev => ({
        ...prev,
        currentExecution: undefined,
      }));

    } catch (error) {
      console.error('Failed to cancel emergency stop execution:', error);
      throw error;
    }
  }, [ws, isConnected]);

  // Handle test mode change
  const handleTestModeChange = useCallback((enabled: boolean) => {
    if (integrationState.currentExecution || integrationState.testExecution) {
      alert('Cannot change test mode while an operation is in progress');
      return;
    }

    setPendingModeChange(enabled);
    setShowModeChangeDialog(true);
  }, [integrationState.currentExecution, integrationState.testExecution]);

  // Confirm test mode change
  const confirmTestModeChange = useCallback(async () => {
    try {
      const payload = {
        type: 'set_test_mode',
        payload: {
          enabled: pendingModeChange,
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      setIntegrationState(prev => ({
        ...prev,
        isTestMode: pendingModeChange,
      }));

      setShowModeChangeDialog(false);
      setPendingModeChange(false);

    } catch (error) {
      console.error('Failed to change test mode:', error);
    }
  }, [ws, isConnected, pendingModeChange]);

  // Execute test scenario
  const handleExecuteTest = useCallback(async (scenario: TestScenario): Promise<TestExecutionResult> => {
    try {
      const payload = {
        type: 'execute_test_scenario',
        payload: {
          scenario,
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      // Return a promise that resolves when the test completes
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Test execution timeout'));
        }, scenario.duration * 1000 + 30000); // Add 30s buffer

        const handleTestComplete = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'test_completion' && data.payload.scenarioId === scenario.id) {
              clearTimeout(timeout);
              ws?.removeEventListener('message', handleTestComplete);
              resolve(data.payload);
            }
          } catch (error) {
            // Ignore parsing errors
          }
        };

        ws?.addEventListener('message', handleTestComplete);
      });

    } catch (error) {
      console.error('Failed to execute test scenario:', error);
      throw error;
    }
  }, [ws, isConnected]);

  // Stop current test
  const handleStopTest = useCallback(async () => {
    try {
      const payload = {
        type: 'stop_test_execution',
        payload: {
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      setIntegrationState(prev => ({
        ...prev,
        testExecution: undefined,
      }));

    } catch (error) {
      console.error('Failed to stop test execution:', error);
      throw error;
    }
  }, [ws, isConnected]);

  // Configuration handlers
  const handleSaveConfiguration = useCallback(async (config: any) => {
    try {
      const payload = {
        type: 'save_configuration',
        payload: {
          configuration: config,
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      setIntegrationState(prev => ({
        ...prev,
        configuration: config,
      }));

    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }, [ws, isConnected]);

  const handleLoadConfiguration = useCallback(async () => {
    try {
      const payload = {
        type: 'load_configuration',
        payload: {
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      // Return current configuration or defaults
      return integrationState.configuration || {
        stopLevels: {},
        testMode: {},
        safety: {},
      };

    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }, [ws, isConnected, integrationState.configuration]);

  const handleTestConfiguration = useCallback(async (level: EmergencyStopLevel): Promise<boolean> => {
    try {
      const payload = {
        type: 'test_configuration',
        payload: {
          level,
          timestamp: new Date().toISOString(),
        },
      };

      if (ws && isConnected) {
        ws.send(JSON.stringify(payload));
      }

      // For now, return true - in real implementation, wait for response
      return true;

    } catch (error) {
      console.error('Failed to test configuration:', error);
      return false;
    }
  }, [ws, isConnected]);

  // Export handlers
  const handleExportResults = useCallback((results: TestExecutionResult[]) => {
    const exportData = {
      results,
      exportDate: new Date().toISOString(),
      systemInfo: integrationState.systemState,
      version: '1.0',
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency-stop-test-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [integrationState.systemState]);

  const handleExportConfiguration = useCallback((config: any) => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergency-stop-configuration-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleImportScenario = useCallback((scenario: TestScenario) => {
    console.log('Imported scenario:', scenario);
    // In real implementation, validate and add to available scenarios
  }, []);

  const handleImportConfiguration = useCallback((config: any) => {
    console.log('Imported configuration:', config);
    // In real implementation, validate and apply configuration
  }, []);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header with system status */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Emergency Stop System
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Chip 
            label={integrationState.isTestMode ? 'TEST MODE' : 'LIVE MODE'}
            color={integrationState.isTestMode ? 'warning' : 'success'}
            variant={integrationState.isTestMode ? 'filled' : 'outlined'}
            icon={integrationState.isTestMode ? <TestTubeIcon /> : <ShieldIcon />}
          />
          <Chip 
            label={isConnected ? 'Connected' : 'Disconnected'}
            color={isConnected ? 'success' : 'error'}
            size="small"
          />
          <Chip 
            label={`Battery: ${integrationState.systemState.batteryLevel}%`}
            color={integrationState.systemState.batteryLevel > 25 ? 'success' : 'error'}
            size="small"
          />
        </Stack>
      </Box>

      {/* Emergency stop overview */}
      {(integrationState.currentExecution || integrationState.testExecution) && (
        <Alert 
          severity={integrationState.isTestMode ? 'info' : 'error'} 
          sx={{ mb: 3 }}
        >
          <AlertTitle>
            {integrationState.isTestMode ? 'Test Execution in Progress' : 'Emergency Stop Active'}
          </AlertTitle>
          {integrationState.currentExecution && (
            <Typography variant="body2">
              Level {integrationState.currentExecution.level} execution: {integrationState.currentExecution.currentStep}
            </Typography>
          )}
          {integrationState.testExecution && (
            <Typography variant="body2">
              Test: {integrationState.testExecution.scenario.name} - {integrationState.testExecution.currentStep}
            </Typography>
          )}
        </Alert>
      )}

      {/* Main content tabs */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Emergency Stop Levels" icon={<StopIcon />} />
        <Tab label="Testing Mode" icon={<TestTubeIcon />} />
        <Tab label="Configuration" icon={<SettingsIcon />} />
        <Tab label="Hardware Status" icon={<ShieldIcon />} />
        <Tab label="Traditional Interface" icon={<WarningIcon />} />
      </Tabs>

      {/* Emergency Stop Levels Tab */}
      {activeTab === 0 && (
        <EmergencyStopLevels
          systemState={integrationState.systemState}
          onStopLevelExecute={handleStopLevelExecute}
          onStopLevelCancel={handleStopLevelCancel}
          currentExecution={integrationState.currentExecution}
          testMode={integrationState.isTestMode}
          onTestModeChange={handleTestModeChange}
          disabled={disabled}
        />
      )}

      {/* Testing Mode Tab */}
      {activeTab === 1 && (
        <EmergencyStopTestingMode
          onExecuteTest={handleExecuteTest}
          onStopTest={handleStopTest}
          currentExecution={integrationState.testExecution}
          testResults={integrationState.testResults}
          onExportResults={handleExportResults}
          onImportScenario={handleImportScenario}
          disabled={disabled || !integrationState.isTestMode}
        />
      )}

      {/* Configuration Tab */}
      {activeTab === 2 && (
        <EmergencyStopConfiguration
          onSaveConfiguration={handleSaveConfiguration}
          onLoadConfiguration={handleLoadConfiguration}
          onTestConfiguration={handleTestConfiguration}
          onExportConfiguration={handleExportConfiguration}
          onImportConfiguration={handleImportConfiguration}
          disabled={disabled}
        />
      )}

      {/* Hardware Status Tab */}
      {activeTab === 3 && (
        <EmergencyStopHardwareStatus
          onDeviceAction={(action) => console.log('Device action:', action)}
          onConfigUpdate={(config) => console.log('Config update:', config)}
        />
      )}

      {/* Traditional Interface Tab */}
      {activeTab === 4 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            <AlertTitle>Traditional Emergency Stop Interface</AlertTitle>
            This is the original emergency stop button interface for compatibility and backup purposes.
          </Alert>
          
          <EmergencyStopButton
            isActivated={emergencyStopHook.isActivated}
            onActivate={emergencyStopHook.onActivate || (() => Promise.resolve())}
            onDeactivate={emergencyStopHook.onDeactivate || (() => Promise.resolve())}
            systemState={emergencyStopHook.systemState}
            confirmationConfig={emergencyStopHook.confirmationConfig}
            userId={emergencyStopHook.userId}
            onAuditEvent={emergencyStopHook.onAuditEvent}
            fixed={false}
          />
        </Box>
      )}

      {/* Test Mode Change Confirmation Dialog */}
      <Dialog
        open={showModeChangeDialog}
        onClose={() => setShowModeChangeDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <WarningIcon color="warning" />
            <Typography variant="h6">
              {pendingModeChange ? 'Enter Test Mode?' : 'Exit Test Mode?'}
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity={pendingModeChange ? 'warning' : 'info'} sx={{ mb: 2 }}>
            <AlertTitle>Mode Change Confirmation</AlertTitle>
            {pendingModeChange ? (
              <>
                You are about to enter Test Mode. In this mode:
                <ul style={{ marginTop: 8 }}>
                  <li>Emergency stop actions will be simulated</li>
                  <li>No real rover systems will be affected</li>
                  <li>All actions will be logged for analysis</li>
                  <li>Test scenarios can be executed safely</li>
                </ul>
              </>
            ) : (
              <>
                You are about to exit Test Mode and return to Live Mode:
                <ul style={{ marginTop: 8 }}>
                  <li>Emergency stop actions will affect real systems</li>
                  <li>All safety protocols will be fully active</li>
                  <li>Test scenarios will not be available</li>
                  <li>Maximum safety measures will apply</li>
                </ul>
              </>
            )}
          </Alert>
          
          <Typography variant="body2" color="text.secondary">
            Current System Status: {integrationState.systemState.hardwareStatus} | 
            Battery: {integrationState.systemState.batteryLevel}% | 
            Communication: {integrationState.systemState.communicationHealth}
          </Typography>
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setShowModeChangeDialog(false)}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmTestModeChange}
            color={pendingModeChange ? 'warning' : 'primary'}
            variant="contained"
          >
            {pendingModeChange ? 'Enter Test Mode' : 'Return to Live Mode'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loading backdrop for operations */}
      <Backdrop
        open={!!integrationState.currentExecution || !!integrationState.testExecution}
        sx={{ 
          zIndex: theme.zIndex.modal + 1,
          backgroundColor: alpha(
            integrationState.isTestMode ? theme.palette.warning.main : theme.palette.error.main, 
            0.1
          ),
        }}
      >
        <Box sx={{ textAlign: 'center', color: 'white' }}>
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            {integrationState.isTestMode ? 'Test in Progress...' : 'Emergency Stop Active'}
          </Typography>
          {integrationState.currentExecution && (
            <Typography variant="body2">
              {integrationState.currentExecution.currentStep}
            </Typography>
          )}
          {integrationState.testExecution && (
            <Typography variant="body2">
              {integrationState.testExecution.currentStep}
            </Typography>
          )}
        </Box>
      </Backdrop>
    </Box>
  );
};

export default EmergencyStopLevelsIntegration;