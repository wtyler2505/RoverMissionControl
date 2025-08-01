/**
 * Emergency Stop Configuration Interface
 * 
 * Provides comprehensive configuration interface for emergency stop levels,
 * testing mode parameters, and system-wide safety settings. Allows administrators
 * to customize stop level behaviors, thresholds, and validation criteria.
 * 
 * Features:
 * - Stop level configuration with parameter adjustment
 * - Automatic trigger threshold configuration
 * - Testing mode security settings
 * - Recovery procedure customization
 * - Compliance and audit settings
 * - Import/export configuration profiles
 * - Real-time validation and testing
 * 
 * @module EmergencyStopConfiguration
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  AlertTitle,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Save as SaveIcon,
  Restore as RestoreIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  TestTube as TestTubeIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { EmergencyStopLevel } from './EmergencyStopLevels';

// Configuration interfaces
export interface StopLevelConfiguration {
  level: EmergencyStopLevel;
  name: string;
  description: string;
  enabled: boolean;
  estimatedDuration: number;
  confirmationRequired: boolean;
  confirmationTimeout: number;
  actions: StopAction[];
  automaticTriggers: AutomaticTrigger[];
  recoverySteps: RecoveryStep[];
  customParameters: Record<string, any>;
}

export interface StopAction {
  id: string;
  name: string;
  description: string;
  order: number;
  timeout: number;
  critical: boolean;
  retryCount: number;
  rollbackAction?: string;
}

export interface AutomaticTrigger {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: string;
  threshold: number;
  comparisonOperator: '>' | '<' | '==' | '>=' | '<=' | '!=';
  dataSource: string;
  debounceTime: number;
  priority: number;
}

export interface RecoveryStep {
  id: string;
  name: string;
  description: string;
  order: number;
  automated: boolean;
  timeout: number;
  validationRequired: boolean;
  prerequisites: string[];
}

export interface TestModeConfiguration {
  enabled: boolean;
  securityLevel: 'low' | 'medium' | 'high';
  requireAuthentication: boolean;
  allowedUsers: string[];
  sessionTimeout: number;
  auditLogging: boolean;
  simulationFidelity: number; // 0-100
  dataRecording: boolean;
  maxTestDuration: number;
  concurrentTestsAllowed: number;
}

export interface SafetyConfiguration {
  failSafeMode: 'immediate' | 'graceful' | 'custom';
  emergencyContactNotification: boolean;
  emergencyContacts: string[];
  complianceMode: 'standard' | 'aerospace' | 'automotive' | 'marine';
  auditRetentionDays: number;
  encryptionEnabled: boolean;
  redundancyLevel: number;
  watchdogTimeout: number;
}

// Default configurations
const DEFAULT_STOP_LEVEL_CONFIG: Record<EmergencyStopLevel, StopLevelConfiguration> = {
  [EmergencyStopLevel.SOFT_STOP]: {
    level: EmergencyStopLevel.SOFT_STOP,
    name: 'Soft Stop',
    description: 'Graceful shutdown with operator warnings',
    enabled: true,
    estimatedDuration: 15,
    confirmationRequired: false,
    confirmationTimeout: 10,
    actions: [
      {
        id: 'warning',
        name: 'Send Warning',
        description: 'Send warning to operator',
        order: 1,
        timeout: 2,
        critical: false,
        retryCount: 0,
      },
      {
        id: 'decelerate',
        name: 'Begin Deceleration',
        description: 'Begin controlled deceleration',
        order: 2,
        timeout: 10,
        critical: true,
        retryCount: 2,
      },
    ],
    automaticTriggers: [
      {
        id: 'low_battery',
        name: 'Low Battery Warning',
        description: 'Battery level below warning threshold',
        enabled: true,
        condition: 'battery_level',
        threshold: 20,
        comparisonOperator: '<',
        dataSource: 'telemetry.power.battery_level',
        debounceTime: 5000,
        priority: 2,
      },
    ],
    recoverySteps: [
      {
        id: 'verify_systems',
        name: 'Verify Systems',
        description: 'Verify all systems operational',
        order: 1,
        automated: true,
        timeout: 30,
        validationRequired: true,
        prerequisites: [],
      },
    ],
    customParameters: {
      decelerationRate: 0.5,
      warningSound: true,
      logDetail: 'normal',
    },
  },
  // Additional levels would be defined here...
  [EmergencyStopLevel.HARD_STOP]: {
    level: EmergencyStopLevel.HARD_STOP,
    name: 'Hard Stop',
    description: 'Immediate halt with power maintained',
    enabled: true,
    estimatedDuration: 5,
    confirmationRequired: true,
    confirmationTimeout: 15,
    actions: [],
    automaticTriggers: [],
    recoverySteps: [],
    customParameters: {},
  },
  [EmergencyStopLevel.EMERGENCY_STOP]: {
    level: EmergencyStopLevel.EMERGENCY_STOP,
    name: 'Emergency Stop',
    description: 'All systems halt immediately',
    enabled: true,
    estimatedDuration: 2,
    confirmationRequired: true,
    confirmationTimeout: 10,
    actions: [],
    automaticTriggers: [],
    recoverySteps: [],
    customParameters: {},
  },
  [EmergencyStopLevel.CRITICAL_STOP]: {
    level: EmergencyStopLevel.CRITICAL_STOP,
    name: 'Critical Stop',
    description: 'Power shutdown with lockout',
    enabled: true,
    estimatedDuration: 1,
    confirmationRequired: true,
    confirmationTimeout: 5,
    actions: [],
    automaticTriggers: [],
    recoverySteps: [],
    customParameters: {},
  },
  [EmergencyStopLevel.FAILSAFE_MODE]: {
    level: EmergencyStopLevel.FAILSAFE_MODE,
    name: 'Failsafe Mode',
    description: 'Minimal systems operation',
    enabled: true,
    estimatedDuration: 30,
    confirmationRequired: false,
    confirmationTimeout: 0,
    actions: [],
    automaticTriggers: [],
    recoverySteps: [],
    customParameters: {},
  },
};

const DEFAULT_TEST_MODE_CONFIG: TestModeConfiguration = {
  enabled: true,
  securityLevel: 'medium',
  requireAuthentication: true,
  allowedUsers: [],
  sessionTimeout: 3600,
  auditLogging: true,
  simulationFidelity: 95,
  dataRecording: true,
  maxTestDuration: 1800,
  concurrentTestsAllowed: 3,
};

const DEFAULT_SAFETY_CONFIG: SafetyConfiguration = {
  failSafeMode: 'graceful',
  emergencyContactNotification: true,
  emergencyContacts: [],
  complianceMode: 'standard',
  auditRetentionDays: 2555, // ~7 years
  encryptionEnabled: true,
  redundancyLevel: 2,
  watchdogTimeout: 5000,
};

interface EmergencyStopConfigurationProps {
  onSaveConfiguration: (config: {
    stopLevels: Record<EmergencyStopLevel, StopLevelConfiguration>;
    testMode: TestModeConfiguration;
    safety: SafetyConfiguration;
  }) => Promise<void>;
  onLoadConfiguration: () => Promise<{
    stopLevels: Record<EmergencyStopLevel, StopLevelConfiguration>;
    testMode: TestModeConfiguration;
    safety: SafetyConfiguration;
  }>;
  onTestConfiguration: (level: EmergencyStopLevel) => Promise<boolean>;
  onExportConfiguration: (config: any) => void;
  onImportConfiguration: (config: any) => void;
  disabled?: boolean;
}

const EmergencyStopConfiguration: React.FC<EmergencyStopConfigurationProps> = ({
  onSaveConfiguration,
  onLoadConfiguration,
  onTestConfiguration,
  onExportConfiguration,
  onImportConfiguration,
  disabled = false,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [stopLevelConfigs, setStopLevelConfigs] = useState<Record<EmergencyStopLevel, StopLevelConfiguration>>(DEFAULT_STOP_LEVEL_CONFIG);
  const [testModeConfig, setTestModeConfig] = useState<TestModeConfiguration>(DEFAULT_TEST_MODE_CONFIG);
  const [safetyConfig, setSafetyConfig] = useState<SafetyConfiguration>(DEFAULT_SAFETY_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EmergencyStopLevel | null>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<StopAction | null>(null);
  const [editingTrigger, setEditingTrigger] = useState<AutomaticTrigger | null>(null);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await onLoadConfiguration();
        setStopLevelConfigs(config.stopLevels);
        setTestModeConfig(config.testMode);
        setSafetyConfig(config.safety);
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    
    loadConfig();
  }, [onLoadConfiguration]);

  // Save configuration
  const handleSaveConfiguration = async () => {
    try {
      await onSaveConfiguration({
        stopLevels: stopLevelConfigs,
        testMode: testModeConfig,
        safety: safetyConfig,
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  };

  // Test configuration
  const handleTestConfiguration = async (level: EmergencyStopLevel) => {
    try {
      const result = await onTestConfiguration(level);
      // Show result to user
      console.log(`Test result for level ${level}:`, result);
    } catch (error) {
      console.error('Failed to test configuration:', error);
    }
  };

  // Update stop level configuration
  const updateStopLevelConfig = (level: EmergencyStopLevel, updates: Partial<StopLevelConfiguration>) => {
    setStopLevelConfigs(prev => ({
      ...prev,
      [level]: {
        ...prev[level],
        ...updates,
      },
    }));
    setHasChanges(true);
  };

  // Export configuration
  const handleExportConfiguration = () => {
    const config = {
      stopLevels: stopLevelConfigs,
      testMode: testModeConfig,
      safety: safetyConfig,
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
    onExportConfiguration(config);
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Emergency Stop Configuration
        </Typography>
        <Stack direction="row" spacing={2}>
          {hasChanges && (
            <Chip label="Unsaved Changes" color="warning" size="small" />
          )}
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            disabled={disabled}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportConfiguration}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveConfiguration}
            disabled={disabled || !hasChanges}
          >
            Save Configuration
          </Button>
        </Stack>
      </Box>

      {/* Configuration tabs */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Stop Levels" icon={<SettingsIcon />} />
        <Tab label="Test Mode" icon={<TestTubeIcon />} />
        <Tab label="Safety Settings" icon={<ShieldIcon />} />
        <Tab label="Validation" icon={<CheckCircleIcon />} />
      </Tabs>

      {/* Stop Levels Tab */}
      {activeTab === 0 && (
        <Stack spacing={3}>
          {Object.values(stopLevelConfigs).map((config) => (
            <Card key={config.level}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Level {config.level}: {config.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {config.description}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={config.enabled}
                          onChange={(e) => updateStopLevelConfig(config.level, { enabled: e.target.checked })}
                          disabled={disabled}
                        />
                      }
                      label="Enabled"
                    />
                    <Button
                      size="small"
                      startIcon={<TestTubeIcon />}
                      onClick={() => handleTestConfiguration(config.level)}
                      disabled={disabled || !config.enabled}
                    >
                      Test
                    </Button>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => setEditingLevel(config.level)}
                      disabled={disabled}
                    >
                      Configure
                    </Button>
                  </Stack>
                </Box>

                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Chip 
                    label={`Duration: ${config.estimatedDuration}s`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip 
                    label={`Actions: ${config.actions.length}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip 
                    label={`Triggers: ${config.automaticTriggers.length}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip 
                    label={config.confirmationRequired ? 'Confirmation Required' : 'No Confirmation'}
                    color={config.confirmationRequired ? 'warning' : 'success'}
                    size="small"
                  />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Test Mode Tab */}
      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Mode Configuration
            </Typography>
            
            <Stack spacing={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={testModeConfig.enabled}
                    onChange={(e) => {
                      setTestModeConfig(prev => ({ ...prev, enabled: e.target.checked }));
                      setHasChanges(true);
                    }}
                    disabled={disabled}
                  />
                }
                label="Enable Test Mode"
              />

              <FormControl fullWidth>
                <InputLabel>Security Level</InputLabel>
                <Select
                  value={testModeConfig.securityLevel}
                  label="Security Level"
                  onChange={(e) => {
                    setTestModeConfig(prev => ({ ...prev, securityLevel: e.target.value as any }));
                    setHasChanges(true);
                  }}
                  disabled={disabled || !testModeConfig.enabled}
                >
                  <MenuItem value="low">Low - Basic logging</MenuItem>
                  <MenuItem value="medium">Medium - Authentication required</MenuItem>
                  <MenuItem value="high">High - Full audit trail</MenuItem>
                </Select>
              </FormControl>

              <Box>
                <Typography gutterBottom>
                  Simulation Fidelity: {testModeConfig.simulationFidelity}%
                </Typography>
                <Slider
                  value={testModeConfig.simulationFidelity}
                  onChange={(_, value) => {
                    setTestModeConfig(prev => ({ ...prev, simulationFidelity: value as number }));
                    setHasChanges(true);
                  }}
                  min={50}
                  max={100}
                  step={5}
                  marks
                  valueLabelDisplay="auto"
                  disabled={disabled || !testModeConfig.enabled}
                />
              </Box>

              <TextField
                label="Max Test Duration (seconds)"
                type="number"
                value={testModeConfig.maxTestDuration}
                onChange={(e) => {
                  setTestModeConfig(prev => ({ ...prev, maxTestDuration: parseInt(e.target.value) }));
                  setHasChanges(true);
                }}
                disabled={disabled || !testModeConfig.enabled}
              />

              <TextField
                label="Session Timeout (seconds)"
                type="number"
                value={testModeConfig.sessionTimeout}
                onChange={(e) => {
                  setTestModeConfig(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) }));
                  setHasChanges(true);
                }}
                disabled={disabled || !testModeConfig.enabled}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={testModeConfig.dataRecording}
                    onChange={(e) => {
                      setTestModeConfig(prev => ({ ...prev, dataRecording: e.target.checked }));
                      setHasChanges(true);
                    }}
                    disabled={disabled || !testModeConfig.enabled}
                  />
                }
                label="Enable Data Recording"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={testModeConfig.auditLogging}
                    onChange={(e) => {
                      setTestModeConfig(prev => ({ ...prev, auditLogging: e.target.checked }));
                      setHasChanges(true);
                    }}
                    disabled={disabled || !testModeConfig.enabled}
                  />
                }
                label="Enable Audit Logging"
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Safety Settings Tab */}
      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Safety Configuration
            </Typography>
            
            <Stack spacing={3}>
              <FormControl fullWidth>
                <InputLabel>Fail-Safe Mode</InputLabel>
                <Select
                  value={safetyConfig.failSafeMode}
                  label="Fail-Safe Mode"
                  onChange={(e) => {
                    setSafetyConfig(prev => ({ ...prev, failSafeMode: e.target.value as any }));
                    setHasChanges(true);
                  }}
                  disabled={disabled}
                >
                  <MenuItem value="immediate">Immediate - Stop all systems instantly</MenuItem>
                  <MenuItem value="graceful">Graceful - Allow controlled shutdown</MenuItem>
                  <MenuItem value="custom">Custom - Use configured behavior</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth>
                <InputLabel>Compliance Mode</InputLabel>
                <Select
                  value={safetyConfig.complianceMode}
                  label="Compliance Mode"
                  onChange={(e) => {
                    setSafetyConfig(prev => ({ ...prev, complianceMode: e.target.value as any }));
                    setHasChanges(true);
                  }}
                  disabled={disabled}
                >
                  <MenuItem value="standard">Standard - Basic safety requirements</MenuItem>
                  <MenuItem value="aerospace">Aerospace - DO-178C compliance</MenuItem>
                  <MenuItem value="automotive">Automotive - ISO 26262 compliance</MenuItem>
                  <MenuItem value="marine">Marine - IEC 61508 compliance</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Audit Retention (days)"
                type="number"
                value={safetyConfig.auditRetentionDays}
                onChange={(e) => {
                  setSafetyConfig(prev => ({ ...prev, auditRetentionDays: parseInt(e.target.value) }));
                  setHasChanges(true);
                }}
                disabled={disabled}
                helperText="Number of days to retain audit logs (compliance requirement)"
              />

              <TextField
                label="Watchdog Timeout (ms)"
                type="number"
                value={safetyConfig.watchdogTimeout}
                onChange={(e) => {
                  setSafetyConfig(prev => ({ ...prev, watchdogTimeout: parseInt(e.target.value) }));
                  setHasChanges(true);
                }}
                disabled={disabled}
                helperText="System watchdog timeout in milliseconds"
              />

              <Box>
                <Typography gutterBottom>
                  Redundancy Level: {safetyConfig.redundancyLevel}
                </Typography>
                <Slider
                  value={safetyConfig.redundancyLevel}
                  onChange={(_, value) => {
                    setSafetyConfig(prev => ({ ...prev, redundancyLevel: value as number }));
                    setHasChanges(true);
                  }}
                  min={1}
                  max={5}
                  step={1}
                  marks
                  valueLabelDisplay="auto"
                  disabled={disabled}
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={safetyConfig.encryptionEnabled}
                    onChange={(e) => {
                      setSafetyConfig(prev => ({ ...prev, encryptionEnabled: e.target.checked }));
                      setHasChanges(true);
                    }}
                    disabled={disabled}
                  />
                }
                label="Enable Encryption"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={safetyConfig.emergencyContactNotification}
                    onChange={(e) => {
                      setSafetyConfig(prev => ({ ...prev, emergencyContactNotification: e.target.checked }));
                      setHasChanges(true);
                    }}
                    disabled={disabled}
                  />
                }
                label="Emergency Contact Notification"
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Validation Tab */}
      {activeTab === 3 && (
        <Alert severity="info">
          <AlertTitle>Configuration Validation</AlertTitle>
          Configuration validation tools are coming soon. Use the test buttons on individual stop levels to validate configurations.
        </Alert>
      )}

      {/* Level Configuration Dialog */}
      <Dialog
        open={!!editingLevel}
        onClose={() => setEditingLevel(null)}
        maxWidth="lg"
        fullWidth
      >
        {editingLevel && (
          <>
            <DialogTitle>
              Configure Level {editingLevel}: {stopLevelConfigs[editingLevel].name}
            </DialogTitle>
            
            <DialogContent>
              <Box sx={{ pt: 1 }}>
                <Typography variant="h6" gutterBottom>
                  Basic Settings
                </Typography>
                
                <Stack spacing={2} sx={{ mb: 3 }}>
                  <TextField
                    label="Name"
                    value={stopLevelConfigs[editingLevel].name}
                    onChange={(e) => updateStopLevelConfig(editingLevel, { name: e.target.value })}
                    fullWidth
                  />
                  
                  <TextField
                    label="Description"
                    value={stopLevelConfigs[editingLevel].description}
                    onChange={(e) => updateStopLevelConfig(editingLevel, { description: e.target.value })}
                    fullWidth
                    multiline
                    rows={2}
                  />
                  
                  <TextField
                    label="Estimated Duration (seconds)"
                    type="number"
                    value={stopLevelConfigs[editingLevel].estimatedDuration}
                    onChange={(e) => updateStopLevelConfig(editingLevel, { estimatedDuration: parseInt(e.target.value) })}
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={stopLevelConfigs[editingLevel].confirmationRequired}
                        onChange={(e) => updateStopLevelConfig(editingLevel, { confirmationRequired: e.target.checked })}
                      />
                    }
                    label="Confirmation Required"
                  />
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Actions ({stopLevelConfigs[editingLevel].actions.length})
                </Typography>
                
                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => setShowActionDialog(true)}
                  sx={{ mb: 2 }}
                >
                  Add Action
                </Button>

                <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Order</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Timeout</TableCell>
                        <TableCell>Critical</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stopLevelConfigs[editingLevel].actions.map((action) => (
                        <TableRow key={action.id}>
                          <TableCell>{action.order}</TableCell>
                          <TableCell>{action.name}</TableCell>
                          <TableCell>{action.timeout}s</TableCell>
                          <TableCell>
                            <Chip
                              label={action.critical ? 'Critical' : 'Normal'}
                              color={action.critical ? 'error' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => setEditingAction(action)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton size="small">
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {stopLevelConfigs[editingLevel].actions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No actions configured
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="h6" gutterBottom>
                  Automatic Triggers ({stopLevelConfigs[editingLevel].automaticTriggers.length})
                </Typography>
                
                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  size="small"
                  onClick={() => setShowTriggerDialog(true)}
                  sx={{ mb: 2 }}
                >
                  Add Trigger
                </Button>

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Condition</TableCell>
                        <TableCell>Threshold</TableCell>
                        <TableCell>Enabled</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stopLevelConfigs[editingLevel].automaticTriggers.map((trigger) => (
                        <TableRow key={trigger.id}>
                          <TableCell>{trigger.name}</TableCell>
                          <TableCell>{trigger.condition}</TableCell>
                          <TableCell>{trigger.comparisonOperator} {trigger.threshold}</TableCell>
                          <TableCell>
                            <Switch
                              checked={trigger.enabled}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => setEditingTrigger(trigger)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton size="small">
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {stopLevelConfigs[editingLevel].automaticTriggers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No automatic triggers configured
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setEditingLevel(null)}>
                Close
              </Button>
              <Button
                variant="contained"
                onClick={() => handleTestConfiguration(editingLevel)}
                startIcon={<TestTubeIcon />}
              >
                Test Configuration
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Action Dialog */}
      <Dialog
        open={showActionDialog}
        onClose={() => {
          setShowActionDialog(false);
          setEditingAction(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingAction ? 'Edit Action' : 'Add Action'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Action configuration dialog content would go here.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowActionDialog(false);
            setEditingAction(null);
          }}>
            Cancel
          </Button>
          <Button variant="contained">
            {editingAction ? 'Update' : 'Add'} Action
          </Button>
        </DialogActions>
      </Dialog>

      {/* Trigger Dialog */}
      <Dialog
        open={showTriggerDialog}
        onClose={() => {
          setShowTriggerDialog(false);
          setEditingTrigger(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingTrigger ? 'Edit Trigger' : 'Add Trigger'}
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Trigger configuration dialog content would go here.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowTriggerDialog(false);
            setEditingTrigger(null);
          }}>
            Cancel
          </Button>
          <Button variant="contained">
            {editingTrigger ? 'Update' : 'Add'} Trigger
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmergencyStopConfiguration;