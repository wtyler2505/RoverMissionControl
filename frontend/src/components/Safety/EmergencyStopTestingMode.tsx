/**
 * Emergency Stop Testing Mode System
 * 
 * Comprehensive testing mode for safe validation of emergency features without
 * triggering real-world actions. Provides simulated emergency scenarios, test
 * data recording and playback, performance benchmarking, stress testing
 * capabilities, and user training scenarios.
 * 
 * Features:
 * - Simulated emergency scenarios with realistic behavior
 * - Test data recording and playback for analysis
 * - Performance benchmarking and metrics collection
 * - Stress testing with configurable load patterns
 * - User training scenarios with guided workflows
 * - Comprehensive test results analysis and reporting
 * - Integration with existing emergency stop system
 * 
 * @module EmergencyStopTestingMode
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  CircularProgress,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Pause as PauseIcon,
  Replay as ReplayIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Assessment as AssessmentIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  School as SchoolIcon,
  BugReport as BugReportIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { EmergencyStopLevel } from './EmergencyStopLevels';

// Test scenario types
export enum TestScenarioType {
  BASIC_FUNCTIONALITY = 'basic_functionality',
  STRESS_TEST = 'stress_test',
  FAILURE_SIMULATION = 'failure_simulation',
  USER_TRAINING = 'user_training',
  PERFORMANCE_BENCHMARK = 'performance_benchmark',
  RECOVERY_VALIDATION = 'recovery_validation',
  INTEGRATION_TEST = 'integration_test',
  COMPLIANCE_VALIDATION = 'compliance_validation',
}

// Test execution status
export enum TestExecutionStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

// Test scenario configuration
export interface TestScenario {
  id: string;
  name: string;
  type: TestScenarioType;
  description: string;
  duration: number; // seconds
  stopLevels: EmergencyStopLevel[];
  parameters: Record<string, any>;
  expectedResults: string[];
  validationCriteria: string[];
  automatedValidation: boolean;
}

// Test execution results
export interface TestExecutionResult {
  scenarioId: string;
  startTime: Date;
  endTime: Date;
  status: TestExecutionStatus;
  stopLevelResults: Record<EmergencyStopLevel, StopLevelTestResult>;
  metrics: TestMetrics;
  logs: TestLogEntry[];
  errors: string[];
  warnings: string[];
  passed: boolean;
  score: number; // 0-100
}

// Stop level test result
export interface StopLevelTestResult {
  level: EmergencyStopLevel;
  executionTime: number;
  responseTime: number;
  stepsCompleted: number;
  stepsTotal: number;
  errors: string[];
  warnings: string[];
  passed: boolean;
  metrics: Record<string, number>;
}

// Test metrics
export interface TestMetrics {
  totalExecutionTime: number;
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  warningCount: number;
  performanceScore: number;
  memoryUsage: number;
  cpuUsage: number;
  networkLatency: number;
}

// Test log entry
export interface TestLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}

// Predefined test scenarios
const PREDEFINED_SCENARIOS: TestScenario[] = [
  {
    id: 'basic-all-levels',
    name: 'Basic All Levels Test',
    type: TestScenarioType.BASIC_FUNCTIONALITY,
    description: 'Test all emergency stop levels with basic validation',
    duration: 60,
    stopLevels: [
      EmergencyStopLevel.SOFT_STOP,
      EmergencyStopLevel.HARD_STOP,
      EmergencyStopLevel.EMERGENCY_STOP,
      EmergencyStopLevel.CRITICAL_STOP,
      EmergencyStopLevel.FAILSAFE_MODE,
    ],
    parameters: {
      delayBetweenLevels: 5,
      validateRecovery: true,
      logDetail: 'normal',
    },
    expectedResults: [
      'All stop levels execute within expected time',
      'No errors during execution',
      'Recovery procedures validate successfully',
      'All systems return to normal state',
    ],
    validationCriteria: [
      'Response time < 5 seconds for all levels',
      'No system errors logged',
      'Recovery completes within 30 seconds',
    ],
    automatedValidation: true,
  },
  {
    id: 'stress-rapid-execution',
    name: 'Rapid Execution Stress Test',
    type: TestScenarioType.STRESS_TEST,
    description: 'Execute emergency stops in rapid succession to test system resilience',
    duration: 120,
    stopLevels: [EmergencyStopLevel.HARD_STOP, EmergencyStopLevel.EMERGENCY_STOP],
    parameters: {
      executionsPerMinute: 20,
      randomizeLevel: true,
      validateBetweenRuns: false,
      stressMemory: true,
    },
    expectedResults: [
      'System handles rapid executions without degradation',
      'Memory usage remains stable',
      'No resource leaks detected',
      'All executions complete successfully',
    ],
    validationCriteria: [
      'Response time increase < 50% from baseline',
      'Memory usage increase < 20%',
      'Success rate > 95%',
    ],
    automatedValidation: true,
  },
  {
    id: 'failure-simulation',
    name: 'Hardware Failure Simulation',
    type: TestScenarioType.FAILURE_SIMULATION,
    description: 'Simulate various hardware failures and validate emergency responses',
    duration: 180,
    stopLevels: [EmergencyStopLevel.EMERGENCY_STOP, EmergencyStopLevel.CRITICAL_STOP],
    parameters: {
      simulateFailures: ['communication_loss', 'power_failure', 'sensor_malfunction'],
      failureIntensity: 'medium',
      recoveryValidation: true,
    },
    expectedResults: [
      'System detects simulated failures correctly',
      'Appropriate stop level triggered automatically',
      'Failure recovery procedures work correctly',
      'System state restored after recovery',
    ],
    validationCriteria: [
      'Failure detection time < 2 seconds',
      'Correct stop level selected for each failure type',
      'Recovery success rate > 90%',
    ],
    automatedValidation: true,
  },
  {
    id: 'user-training-basic',
    name: 'Basic User Training Scenario',
    type: TestScenarioType.USER_TRAINING,
    description: 'Guided training for new operators on emergency stop procedures',
    duration: 300,
    stopLevels: [EmergencyStopLevel.SOFT_STOP, EmergencyStopLevel.HARD_STOP],
    parameters: {
      guidedMode: true,
      showHints: true,
      allowRetries: true,
      trackProgress: true,
    },
    expectedResults: [
      'User completes all training steps',
      'Demonstrates understanding of each stop level',
      'Passes knowledge validation quiz',
      'Meets minimum performance thresholds',
    ],
    validationCriteria: [
      'Training completion rate > 80%',
      'Quiz score > 85%',
      'Practical demonstration score > 80%',
    ],
    automatedValidation: false,
  },
  {
    id: 'performance-benchmark',
    name: 'Performance Benchmark Suite',
    type: TestScenarioType.PERFORMANCE_BENCHMARK,
    description: 'Comprehensive performance testing with detailed metrics collection',
    duration: 240,
    stopLevels: [
      EmergencyStopLevel.SOFT_STOP,
      EmergencyStopLevel.HARD_STOP,
      EmergencyStopLevel.EMERGENCY_STOP,
    ],
    parameters: {
      iterations: 100,
      measureLatency: true,
      measureThroughput: true,
      resourceMonitoring: true,
      detailedMetrics: true,
    },
    expectedResults: [
      'Baseline performance metrics established',
      'Response time distribution analyzed',
      'Resource utilization patterns identified',
      'Performance regression detection validated',
    ],
    validationCriteria: [
      'Average response time < 1 second',
      'P95 response time < 3 seconds',
      'Memory usage stable over time',
      'CPU usage < 50% average',
    ],
    automatedValidation: true,
  },
];

interface EmergencyStopTestingModeProps {
  onExecuteTest: (scenario: TestScenario) => Promise<TestExecutionResult>;
  onStopTest: () => Promise<void>;
  currentExecution?: {
    scenario: TestScenario;
    status: TestExecutionStatus;
    progress: number;
    currentStep: string;
    elapsedTime: number;
  };
  testResults: TestExecutionResult[];
  onExportResults: (results: TestExecutionResult[]) => void;
  onImportScenario: (scenario: TestScenario) => void;
  disabled?: boolean;
}

const EmergencyStopTestingMode: React.FC<EmergencyStopTestingModeProps> = ({
  onExecuteTest,
  onStopTest,
  currentExecution,
  testResults,
  onExportResults,
  onImportScenario,
  disabled = false,
}) => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [customScenario, setCustomScenario] = useState<Partial<TestScenario>>({});
  const [showScenarioDialog, setShowScenarioDialog] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  const [selectedResult, setSelectedResult] = useState<TestExecutionResult | null>(null);
  const [filterResults, setFilterResults] = useState<TestScenarioType | 'all'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Execute test scenario
  const handleExecuteTest = async (scenario: TestScenario) => {
    if (disabled || currentExecution) return;
    
    try {
      const result = await onExecuteTest(scenario);
      console.log('Test execution completed:', result);
    } catch (error) {
      console.error('Test execution failed:', error);
    }
  };

  // Stop current test
  const handleStopTest = async () => {
    if (!currentExecution) return;
    
    try {
      await onStopTest();
    } catch (error) {
      console.error('Failed to stop test:', error);
    }
  };

  // Export test results
  const handleExportResults = () => {
    const filteredResults = filterResults === 'all' 
      ? testResults 
      : testResults.filter(r => {
          const scenario = PREDEFINED_SCENARIOS.find(s => s.id === r.scenarioId);
          return scenario?.type === filterResults;
        });
    
    onExportResults(filteredResults);
  };

  // Import test scenario
  const handleImportScenario = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const scenario = JSON.parse(e.target?.result as string) as TestScenario;
        onImportScenario(scenario);
      } catch (error) {
        console.error('Failed to import scenario:', error);
      }
    };
    reader.readAsText(file);
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Get status color
  const getStatusColor = (status: TestExecutionStatus) => {
    switch (status) {
      case TestExecutionStatus.COMPLETED: return 'success';
      case TestExecutionStatus.RUNNING: return 'primary';
      case TestExecutionStatus.FAILED: return 'error';
      case TestExecutionStatus.CANCELLED: return 'warning';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = (status: TestExecutionStatus) => {
    switch (status) {
      case TestExecutionStatus.COMPLETED: return <CheckCircleIcon />;
      case TestExecutionStatus.RUNNING: return <PlayIcon />;
      case TestExecutionStatus.FAILED: return <ErrorIcon />;
      case TestExecutionStatus.CANCELLED: return <StopIcon />;
      case TestExecutionStatus.PAUSED: return <PauseIcon />;
      default: return <InfoIcon />;
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Emergency Stop Testing Mode
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            Import Scenario
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportResults}
            disabled={testResults.length === 0}
          >
            Export Results
          </Button>
        </Stack>
      </Box>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportScenario}
      />

      {/* Current execution status */}
      {currentExecution && (
        <Alert 
          severity="info" 
          action={
            <Button color="inherit" size="small" onClick={handleStopTest}>
              Stop Test
            </Button>
          }
          sx={{ mb: 3 }}
        >
          <AlertTitle>
            Test Execution in Progress: {currentExecution.scenario.name}
          </AlertTitle>
          <Typography variant="body2" gutterBottom>
            Status: {currentExecution.status} | Step: {currentExecution.currentStep}
          </Typography>
          <LinearProgress 
            variant="determinate" 
            value={currentExecution.progress} 
            sx={{ mt: 1 }}
          />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Elapsed: {formatDuration(currentExecution.elapsedTime)} / {formatDuration(currentExecution.scenario.duration)}
          </Typography>
        </Alert>
      )}

      {/* Main content tabs */}
      <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Test Scenarios" icon={<PlayIcon />} />
        <Tab label="Test Results" icon={<AssessmentIcon />} />
        <Tab label="Custom Scenarios" icon={<SettingsIcon />} />
        <Tab label="Training Mode" icon={<SchoolIcon />} />
      </Tabs>

      {/* Test Scenarios Tab */}
      {activeTab === 0 && (
        <Stack spacing={2}>
          {PREDEFINED_SCENARIOS.map((scenario) => (
            <Card key={scenario.id}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {scenario.name}
                      </Typography>
                      <Chip 
                        label={scenario.type.replace('_', ' ')}
                        color="primary"
                        size="small"
                      />
                      <Chip 
                        label={formatDuration(scenario.duration)}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {scenario.description}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>Stop Levels:</strong> {scenario.stopLevels.map(level => `Level ${level}`).join(', ')}
                    </Typography>
                    
                    <Typography variant="body2">
                      <strong>Validation:</strong> {scenario.automatedValidation ? 'Automated' : 'Manual'}
                    </Typography>
                  </Box>
                  
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedScenario(scenario);
                          setShowScenarioDialog(true);
                        }}
                      >
                        <InfoIcon />
                      </IconButton>
                    </Tooltip>
                    
                    <Button
                      variant="contained"
                      onClick={() => handleExecuteTest(scenario)}
                      disabled={disabled || !!currentExecution}
                      startIcon={<PlayIcon />}
                    >
                      Execute
                    </Button>
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Test Results Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'between', alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Filter by Type</InputLabel>
              <Select
                value={filterResults}
                label="Filter by Type"
                onChange={(e) => setFilterResults(e.target.value as any)}
              >
                <MenuItem value="all">All Types</MenuItem>
                {Object.values(TestScenarioType).map(type => (
                  <MenuItem key={type} value={type}>
                    {type.replace('_', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Scenario</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {testResults
                  .filter(result => {
                    if (filterResults === 'all') return true;
                    const scenario = PREDEFINED_SCENARIOS.find(s => s.id === result.scenarioId);
                    return scenario?.type === filterResults;
                  })
                  .map((result) => {
                    const scenario = PREDEFINED_SCENARIOS.find(s => s.id === result.scenarioId);
                    const duration = result.endTime.getTime() - result.startTime.getTime();
                    
                    return (
                      <TableRow key={`${result.scenarioId}-${result.startTime.getTime()}`}>
                        <TableCell>{scenario?.name || result.scenarioId}</TableCell>
                        <TableCell>{result.startTime.toLocaleString()}</TableCell>
                        <TableCell>{formatDuration(Math.floor(duration / 1000))}</TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(result.status)}
                            label={result.status}
                            color={getStatusColor(result.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={result.score}
                              sx={{ width: 60, height: 6 }}
                            />
                            <Typography variant="body2">
                              {result.score}%
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            onClick={() => {
                              setSelectedResult(result);
                              setShowResultsDialog(true);
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {testResults.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No test results available. Execute a test scenario to see results here.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Custom Scenarios Tab */}
      {activeTab === 2 && (
        <Alert severity="info">
          <AlertTitle>Custom Scenarios</AlertTitle>
          Custom scenario creation is coming soon. You can import scenarios from JSON files using the Import button above.
        </Alert>
      )}

      {/* Training Mode Tab */}
      {activeTab === 3 && (
        <Alert severity="info">
          <AlertTitle>Training Mode</AlertTitle>
          Interactive training scenarios are available in the main test scenarios. Look for scenarios with type "user_training".
        </Alert>
      )}

      {/* Scenario Details Dialog */}
      <Dialog
        open={showScenarioDialog}
        onClose={() => setShowScenarioDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedScenario && (
          <>
            <DialogTitle>
              <Typography variant="h6">
                {selectedScenario.name}
              </Typography>
            </DialogTitle>
            
            <DialogContent>
              <Typography variant="body1" paragraph>
                {selectedScenario.description}
              </Typography>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Expected Results</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box component="ul" sx={{ pl: 2 }}>
                    {selectedScenario.expectedResults.map((result, index) => (
                      <Typography key={index} component="li" variant="body2" gutterBottom>
                        {result}
                      </Typography>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Validation Criteria</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box component="ul" sx={{ pl: 2 }}>
                    {selectedScenario.validationCriteria.map((criteria, index) => (
                      <Typography key={index} component="li" variant="body2" gutterBottom>
                        {criteria}
                      </Typography>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Parameters</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box component="pre" sx={{ fontSize: '0.875rem', overflow: 'auto' }}>
                    {JSON.stringify(selectedScenario.parameters, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setShowScenarioDialog(false)}>
                Close
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setShowScenarioDialog(false);
                  handleExecuteTest(selectedScenario);
                }}
                disabled={disabled || !!currentExecution}
                startIcon={<PlayIcon />}
              >
                Execute Test
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Results Details Dialog */}
      <Dialog
        open={showResultsDialog}
        onClose={() => setShowResultsDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        {selectedResult && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {getStatusIcon(selectedResult.status)}
                <Typography variant="h6">
                  Test Results: {PREDEFINED_SCENARIOS.find(s => s.id === selectedResult.scenarioId)?.name}
                </Typography>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Stack spacing={3}>
                {/* Summary */}
                <Box>
                  <Typography variant="h6" gutterBottom>Summary</Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    <Chip label={`Score: ${selectedResult.score}%`} color="primary" />
                    <Chip label={`Status: ${selectedResult.status}`} color={getStatusColor(selectedResult.status) as any} />
                    <Chip label={`Errors: ${selectedResult.errors.length}`} color={selectedResult.errors.length > 0 ? 'error' : 'success'} />
                    <Chip label={`Warnings: ${selectedResult.warnings.length}`} color={selectedResult.warnings.length > 0 ? 'warning' : 'success'} />
                  </Stack>
                </Box>

                {/* Metrics */}
                <Box>
                  <Typography variant="h6" gutterBottom>Performance Metrics</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>Execution Time</strong></TableCell>
                          <TableCell>{formatDuration(selectedResult.metrics.totalExecutionTime)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Average Response Time</strong></TableCell>
                          <TableCell>{selectedResult.metrics.averageResponseTime}ms</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Success Rate</strong></TableCell>
                          <TableCell>{selectedResult.metrics.successRate}%</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Performance Score</strong></TableCell>
                          <TableCell>{selectedResult.metrics.performanceScore}%</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Stop Level Results */}
                <Box>
                  <Typography variant="h6" gutterBottom>Stop Level Results</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Level</TableCell>
                          <TableCell>Execution Time</TableCell>
                          <TableCell>Response Time</TableCell>
                          <TableCell>Completion</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(selectedResult.stopLevelResults).map(([level, result]) => (
                          <TableRow key={level}>
                            <TableCell>Level {level}</TableCell>
                            <TableCell>{result.executionTime}ms</TableCell>
                            <TableCell>{result.responseTime}ms</TableCell>
                            <TableCell>{result.stepsCompleted}/{result.stepsTotal}</TableCell>
                            <TableCell>
                              <Chip
                                label={result.passed ? 'Passed' : 'Failed'}
                                color={result.passed ? 'success' : 'error'}
                                size="small"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Errors and Warnings */}
                {(selectedResult.errors.length > 0 || selectedResult.warnings.length > 0) && (
                  <Box>
                    <Typography variant="h6" gutterBottom>Issues</Typography>
                    
                    {selectedResult.errors.length > 0 && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        <AlertTitle>Errors ({selectedResult.errors.length})</AlertTitle>
                        <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                          {selectedResult.errors.map((error, index) => (
                            <Typography key={index} component="li" variant="body2">
                              {error}
                            </Typography>
                          ))}
                        </Box>
                      </Alert>
                    )}
                    
                    {selectedResult.warnings.length > 0 && (
                      <Alert severity="warning">
                        <AlertTitle>Warnings ({selectedResult.warnings.length})</AlertTitle>
                        <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                          {selectedResult.warnings.map((warning, index) => (
                            <Typography key={index} component="li" variant="body2">
                              {warning}
                            </Typography>
                          ))}
                        </Box>
                      </Alert>
                    )}
                  </Box>
                )}
              </Stack>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setShowResultsDialog(false)}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default EmergencyStopTestingMode;