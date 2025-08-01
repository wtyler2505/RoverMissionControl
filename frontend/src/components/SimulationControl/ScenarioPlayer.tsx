/**
 * Scenario Player Component
 * Manages scenario execution and control
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  LinearProgress,
  Divider,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Collapse,
  Tooltip,
  Menu,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  PlayArrow,
  Stop,
  Pause,
  SkipNext,
  Delete,
  Edit,
  Add,
  CheckCircle,
  Error,
  Warning,
  Info,
  Schedule,
  Code,
  Description,
  MoreVert,
  ExpandMore,
  Loop,
  Assignment,
  BugReport,
  Settings,
  Upload,
  Download,
  Refresh
} from '@mui/icons-material';
import { Scenario, ScenarioStep } from './types';

interface ScenarioPlayerProps {
  scenarios: Scenario[];
  onExecute: (scenarioId: string, variables?: Record<string, any>) => void;
  onRefresh: () => void;
}

interface ScenarioExecution {
  scenarioId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  startTime: string;
  endTime?: string;
  logs: ExecutionLog[];
}

interface ExecutionLog {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  stepId?: string;
}

const getStepIcon = (actionType: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    'set_environment': <Settings />,
    'set_device_state': <Assignment />,
    'send_command': <Code />,
    'wait': <Schedule />,
    'assert_state': <BugReport />,
    'inject_fault': <Warning />,
    'clear_fault': <CheckCircle />,
    'set_network': <Settings />,
    'trigger_event': <Info />,
    'log_message': <Description />,
    'checkpoint': <CheckCircle />,
    'loop_start': <Loop />,
    'loop_end': <Loop />,
    'conditional': <Code />
  };
  
  return iconMap[actionType] || <Assignment />;
};

export const ScenarioPlayer: React.FC<ScenarioPlayerProps> = ({
  scenarios,
  onExecute,
  onRefresh
}) => {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [executionVariables, setExecutionVariables] = useState<Record<string, any>>({});
  const [executions, setExecutions] = useState<Record<string, ScenarioExecution>>({});
  const [expandedScenarios, setExpandedScenarios] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuScenario, setMenuScenario] = useState<Scenario | null>(null);
  
  // Mock execution updates via WebSocket
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/scenario-execution');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleExecutionUpdate(data);
    };
    
    return () => {
      ws.close();
    };
  }, []);
  
  const handleExecutionUpdate = (update: any) => {
    if (update.type === 'execution_started') {
      setExecutions(prev => ({
        ...prev,
        [update.scenarioId]: {
          scenarioId: update.scenarioId,
          status: 'running',
          currentStep: 0,
          totalSteps: update.totalSteps,
          startTime: new Date().toISOString(),
          logs: [{
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `Scenario execution started`
          }]
        }
      }));
    } else if (update.type === 'step_completed') {
      setExecutions(prev => {
        const execution = prev[update.scenarioId];
        if (execution) {
          return {
            ...prev,
            [update.scenarioId]: {
              ...execution,
              currentStep: update.stepIndex + 1,
              logs: [
                ...execution.logs,
                {
                  timestamp: new Date().toISOString(),
                  level: 'success',
                  message: `Step completed: ${update.stepId}`,
                  stepId: update.stepId
                }
              ]
            }
          };
        }
        return prev;
      });
    } else if (update.type === 'execution_completed') {
      setExecutions(prev => {
        const execution = prev[update.scenarioId];
        if (execution) {
          return {
            ...prev,
            [update.scenarioId]: {
              ...execution,
              status: 'completed',
              endTime: new Date().toISOString(),
              logs: [
                ...execution.logs,
                {
                  timestamp: new Date().toISOString(),
                  level: 'success',
                  message: `Scenario completed successfully`
                }
              ]
            }
          };
        }
        return prev;
      });
    } else if (update.type === 'execution_failed') {
      setExecutions(prev => {
        const execution = prev[update.scenarioId];
        if (execution) {
          return {
            ...prev,
            [update.scenarioId]: {
              ...execution,
              status: 'failed',
              endTime: new Date().toISOString(),
              logs: [
                ...execution.logs,
                {
                  timestamp: new Date().toISOString(),
                  level: 'error',
                  message: `Execution failed: ${update.error}`,
                  stepId: update.stepId
                }
              ]
            }
          };
        }
        return prev;
      });
    }
  };
  
  const handleScenarioSelect = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setExecutionVariables(scenario.variables || {});
    setExecuteDialogOpen(true);
  };
  
  const handleExecute = () => {
    if (selectedScenario) {
      onExecute(selectedScenario.scenarioId, executionVariables);
      setExecuteDialogOpen(false);
    }
  };
  
  const handleScenarioExpand = (scenarioId: string) => {
    const newExpanded = new Set(expandedScenarios);
    if (newExpanded.has(scenarioId)) {
      newExpanded.delete(scenarioId);
    } else {
      newExpanded.add(scenarioId);
    }
    setExpandedScenarios(newExpanded);
  };
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, scenario: Scenario) => {
    setAnchorEl(event.currentTarget);
    setMenuScenario(scenario);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuScenario(null);
  };
  
  const handleExportScenario = (scenario: Scenario) => {
    const dataStr = JSON.stringify(scenario, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${scenario.scenarioId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    handleMenuClose();
  };
  
  const handleImportScenario = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const scenario = JSON.parse(e.target?.result as string);
          // In a real implementation, this would upload to the backend
          console.log('Imported scenario:', scenario);
          onRefresh();
        } catch (error) {
          console.error('Failed to parse scenario file:', error);
        }
      };
      reader.readAsText(file);
    }
  };
  
  const renderScenarioStep = (step: ScenarioStep, index: number) => {
    return (
      <Step key={step.stepId}>
        <StepLabel
          icon={getStepIcon(step.actionType)}
          optional={
            step.description && (
              <Typography variant="caption">{step.description}</Typography>
            )
          }
        >
          {step.stepId}
        </StepLabel>
        <StepContent>
          <Box>
            <Typography variant="body2" gutterBottom>
              Action: <strong>{step.actionType}</strong>
            </Typography>
            
            {step.delayBefore > 0 && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Wait {step.delayBefore}s before execution
              </Typography>
            )}
            
            {Object.keys(step.parameters).length > 0 && (
              <Box mt={1}>
                <Typography variant="body2" gutterBottom>
                  Parameters:
                </Typography>
                <Paper variant="outlined" sx={{ p: 1, bgcolor: 'grey.50' }}>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                    {JSON.stringify(step.parameters, null, 2)}
                  </pre>
                </Paper>
              </Box>
            )}
            
            <Box display="flex" gap={0.5} mt={1}>
              {step.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
              {step.retryCount > 0 && (
                <Chip
                  label={`Retry: ${step.retryCount}`}
                  size="small"
                  color="warning"
                />
              )}
              {step.skipCondition && (
                <Chip
                  label="Conditional"
                  size="small"
                  color="info"
                />
              )}
            </Box>
          </Box>
        </StepContent>
      </Step>
    );
  };
  
  const renderScenarioCard = (scenario: Scenario) => {
    const isExpanded = expandedScenarios.has(scenario.scenarioId);
    const execution = executions[scenario.scenarioId];
    
    return (
      <Accordion
        key={scenario.scenarioId}
        expanded={isExpanded}
        onChange={() => handleScenarioExpand(scenario.scenarioId)}
      >
        <AccordionSummary
          expandIcon={<ExpandMore />}
          aria-controls={`${scenario.scenarioId}-content`}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
            <Box display="flex" alignItems="center" gap={2}>
              <Typography variant="h6">{scenario.name}</Typography>
              <Chip
                label={`v${scenario.version}`}
                size="small"
                variant="outlined"
              />
              {execution && (
                <Chip
                  label={execution.status}
                  size="small"
                  color={
                    execution.status === 'running' ? 'primary' :
                    execution.status === 'completed' ? 'success' :
                    execution.status === 'failed' ? 'error' : 'default'
                  }
                />
              )}
            </Box>
            <Box display="flex" alignItems="center" gap={1} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrow />}
                onClick={() => handleScenarioSelect(scenario)}
                disabled={execution?.status === 'running'}
              >
                Execute
              </Button>
              <IconButton
                size="small"
                onClick={(e) => handleMenuOpen(e, scenario)}
              >
                <MoreVert />
              </IconButton>
            </Box>
          </Box>
        </AccordionSummary>
        
        <AccordionDetails>
          <Grid container spacing={2}>
            {/* Scenario Info */}
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {scenario.description}
              </Typography>
              <Box display="flex" gap={2} mt={1}>
                <Typography variant="caption">
                  Author: {scenario.author || 'Unknown'}
                </Typography>
                <Typography variant="caption">
                  Created: {new Date(scenario.createdAt).toLocaleDateString()}
                </Typography>
                <Typography variant="caption">
                  Steps: {scenario.steps.length}
                </Typography>
              </Box>
            </Grid>
            
            {/* Execution Progress */}
            {execution && (
              <Grid item xs={12}>
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="subtitle2">
                      Execution Progress
                    </Typography>
                    <Typography variant="body2">
                      {execution.currentStep} / {execution.totalSteps}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(execution.currentStep / execution.totalSteps) * 100}
                    sx={{ mb: 2 }}
                  />
                </Box>
              </Grid>
            )}
            
            {/* Scenario Steps */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Scenario Steps
              </Typography>
              <Stepper orientation="vertical">
                {scenario.steps.map((step, index) => renderScenarioStep(step, index))}
              </Stepper>
            </Grid>
            
            {/* Execution Logs */}
            {execution && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Execution Logs
                </Typography>
                <Paper
                  variant="outlined"
                  sx={{
                    maxHeight: 400,
                    overflow: 'auto',
                    p: 1,
                    bgcolor: 'grey.900',
                    color: 'common.white'
                  }}
                >
                  {execution.logs.map((log, index) => (
                    <Box key={index} mb={0.5}>
                      <Typography
                        variant="caption"
                        sx={{
                          color: 
                            log.level === 'error' ? 'error.main' :
                            log.level === 'warning' ? 'warning.main' :
                            log.level === 'success' ? 'success.main' :
                            'grey.400',
                          fontFamily: 'monospace'
                        }}
                      >
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              </Grid>
            )}
            
            {/* Variables */}
            {scenario.variables && Object.keys(scenario.variables).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Default Variables
                </Typography>
                <Paper variant="outlined" sx={{ p: 1 }}>
                  <pre style={{ margin: 0, fontSize: '0.8rem' }}>
                    {JSON.stringify(scenario.variables, null, 2)}
                  </pre>
                </Paper>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>
    );
  };
  
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Test Scenarios</Typography>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={<Upload />}
            component="label"
          >
            Import
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleImportScenario}
            />
          </Button>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => {/* Open scenario creation dialog */}}
          >
            Create Scenario
          </Button>
          <IconButton onClick={onRefresh}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>
      
      {scenarios.length === 0 ? (
        <Alert severity="info">
          No scenarios available. Create or import a scenario to get started.
        </Alert>
      ) : (
        <Box>
          {scenarios.map(renderScenarioCard)}
        </Box>
      )}
      
      {/* Execute Dialog */}
      <Dialog
        open={executeDialogOpen}
        onClose={() => setExecuteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Execute Scenario</DialogTitle>
        <DialogContent>
          {selectedScenario && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedScenario.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedScenario.description}
              </Typography>
              
              {Object.keys(executionVariables).length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Execution Variables
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={2}>
                    {Object.entries(executionVariables).map(([key, value]) => (
                      <TextField
                        key={key}
                        fullWidth
                        label={key}
                        value={value}
                        onChange={(e) => setExecutionVariables({
                          ...executionVariables,
                          [key]: e.target.value
                        })}
                      />
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecuteDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExecute}
            variant="contained"
            startIcon={<PlayArrow />}
          >
            Execute
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          if (menuScenario) {
            handleExportScenario(menuScenario);
          }
        }}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};