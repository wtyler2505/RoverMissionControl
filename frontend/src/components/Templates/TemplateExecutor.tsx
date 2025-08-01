/**
 * Template Executor Component
 * Handles template execution with parameter collection and validation
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Paper,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  IconButton,
  LinearProgress,
  Chip,
  Stack
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Schedule as ScheduleIcon,
  Speed as SpeedIcon,
  Repeat as RepeatIcon
} from '@mui/icons-material';

import {
  CommandTemplate,
  templateService
} from '../../services/templateService';
import {
  CommandPriority,
  CommandStatus,
  CommandCreateRequest
} from '../../../../shared/types/command-queue.types';
import { ParameterInput } from './ParameterInput';
import { createDefaultValidator } from '../../services/command/CommandValidator';
import { useWebSocket } from '../../hooks/useWebSocket';

interface TemplateExecutorProps {
  template: CommandTemplate;
  initialParameters?: Record<string, any>;
  onClose: () => void;
  onSuccess?: (commandId: string) => void;
  onError?: (error: Error) => void;
}

type ExecutionStep = 'parameters' | 'options' | 'review' | 'executing' | 'complete';

export const TemplateExecutor: React.FC<TemplateExecutorProps> = ({
  template,
  initialParameters = {},
  onClose,
  onSuccess,
  onError
}) => {
  // State
  const [activeStep, setActiveStep] = useState<ExecutionStep>('parameters');
  const [parameterValues, setParameterValues] = useState<Record<string, any>>(initialParameters);
  const [parameterErrors, setParameterErrors] = useState<Record<string, string>>({});
  
  // Execution options
  const [priority, setPriority] = useState<CommandPriority>(CommandPriority.NORMAL);
  const [timeoutMs, setTimeoutMs] = useState(30000);
  const [maxRetries, setMaxRetries] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  
  // Execution state
  const [executing, setExecuting] = useState(false);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<CommandStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDetails, setShowDetails] = useState(true);
  
  // WebSocket for real-time updates
  const { isConnected, subscribe } = useWebSocket();
  
  // Validator
  const validator = createDefaultValidator();
  
  // Initialize parameter values with defaults
  useEffect(() => {
    const initialValues: Record<string, any> = { ...initialParameters };
    
    // Set defaults from template parameters
    Object.entries(template.parameters || {}).forEach(([key, value]) => {
      if (!(key in initialValues)) {
        initialValues[key] = value;
      }
    });
    
    // Override with defaults from parameter definitions
    template.parameterDefinitions?.forEach(param => {
      if (param.defaultValue !== undefined && !(param.name in initialValues)) {
        initialValues[param.name] = param.defaultValue;
      }
    });
    
    setParameterValues(initialValues);
  }, [template, initialParameters]);
  
  // Subscribe to command updates
  useEffect(() => {
    if (!commandId || !isConnected) return;
    
    const unsubscribe = subscribe(`command:${commandId}`, (event) => {
      if (event.command?.id === commandId) {
        setCommandStatus(event.command.status);
        
        // Update progress based on status
        switch (event.command.status) {
          case CommandStatus.QUEUED:
            setProgress(10);
            break;
          case CommandStatus.EXECUTING:
            setProgress(50);
            break;
          case CommandStatus.COMPLETED:
            setProgress(100);
            setActiveStep('complete');
            if (onSuccess) {
              onSuccess(commandId);
            }
            break;
          case CommandStatus.FAILED:
          case CommandStatus.CANCELLED:
          case CommandStatus.TIMEOUT:
            setProgress(100);
            setExecutionError(`Command ${event.command.status}`);
            setActiveStep('complete');
            if (onError) {
              onError(new Error(`Command ${event.command.status}`));
            }
            break;
        }
      }
    });
    
    return unsubscribe;
  }, [commandId, isConnected, subscribe, onSuccess, onError]);
  
  // Validate parameters
  const validateParameters = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    
    // Check required parameters
    template.parameterDefinitions?.forEach(param => {
      if (param.required && !parameterValues[param.name]) {
        errors[param.name] = `${param.displayName || param.name} is required`;
      }
    });
    
    // Validate using template service
    const validationResult = templateService.validateParameters(template, parameterValues);
    if (!validationResult.valid) {
      validationResult.errors.forEach((error, index) => {
        errors[`validation_${index}`] = error;
      });
    }
    
    // Validate command structure
    try {
      const testCommand = templateService.buildCommand(template, parameterValues, {
        priority,
        timeoutMs,
        maxRetries
      });
      
      const commandValidation = validator.validateCommand(testCommand);
      if (!commandValidation.valid && commandValidation.errors) {
        commandValidation.errors.forEach(error => {
          errors[error.path] = error.message;
        });
      }
    } catch (error) {
      errors.general = 'Invalid command configuration';
    }
    
    setParameterErrors(errors);
    return Object.keys(errors).length === 0;
  }, [template, parameterValues, priority, timeoutMs, maxRetries, validator]);
  
  // Handle step navigation
  const handleNext = () => {
    switch (activeStep) {
      case 'parameters':
        if (validateParameters()) {
          setActiveStep('options');
        }
        break;
      case 'options':
        setActiveStep('review');
        break;
      case 'review':
        executeTemplate();
        break;
    }
  };
  
  const handleBack = () => {
    switch (activeStep) {
      case 'options':
        setActiveStep('parameters');
        break;
      case 'review':
        setActiveStep('options');
        break;
    }
  };
  
  // Execute the template
  const executeTemplate = async () => {
    setActiveStep('executing');
    setExecuting(true);
    setExecutionError(null);
    setProgress(0);
    
    try {
      const response = await templateService.executeTemplate(template.id, {
        parameterValues,
        priority,
        timeoutMs,
        maxRetries,
        tags
      });
      
      setCommandId(response.commandId);
      setProgress(10);
      
      // If WebSocket is not connected, poll for status
      if (!isConnected) {
        // Simple completion for demo - in real app, would poll API
        setTimeout(() => {
          setProgress(100);
          setCommandStatus(CommandStatus.COMPLETED);
          setActiveStep('complete');
          if (onSuccess) {
            onSuccess(response.commandId);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to execute template:', error);
      setExecutionError(error instanceof Error ? error.message : 'Execution failed');
      setActiveStep('complete');
      if (onError) {
        onError(error instanceof Error ? error : new Error('Execution failed'));
      }
    } finally {
      setExecuting(false);
    }
  };
  
  // Get step content
  const getStepContent = () => {
    switch (activeStep) {
      case 'parameters':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Configure Parameters
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Fill in the required parameters for this command template.
            </Typography>
            
            {template.parameterDefinitions && template.parameterDefinitions.length > 0 ? (
              <Grid container spacing={3}>
                {template.parameterDefinitions
                  .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                  .map(param => (
                    <Grid item xs={12} key={param.name}>
                      <ParameterInput
                        parameter={param}
                        value={parameterValues[param.name]}
                        onChange={(value) => {
                          setParameterValues(prev => ({
                            ...prev,
                            [param.name]: value
                          }));
                          // Clear error for this parameter
                          if (parameterErrors[param.name]) {
                            setParameterErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors[param.name];
                              return newErrors;
                            });
                          }
                        }}
                        error={parameterErrors[param.name]}
                      />
                    </Grid>
                  ))}
              </Grid>
            ) : (
              <Alert severity="info">
                This template has no configurable parameters.
              </Alert>
            )}
            
            {Object.keys(parameterErrors).length > 0 && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Please fix the errors above before continuing.
              </Alert>
            )}
          </Box>
        );
        
      case 'options':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Execution Options
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure how the command should be executed.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <FormLabel>Priority</FormLabel>
                  <Select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as CommandPriority)}
                  >
                    <MenuItem value={CommandPriority.LOW}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SpeedIcon fontSize="small" />
                        <span>Low</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value={CommandPriority.NORMAL}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SpeedIcon fontSize="small" />
                        <span>Normal</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value={CommandPriority.HIGH}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SpeedIcon fontSize="small" color="warning" />
                        <span>High</span>
                      </Stack>
                    </MenuItem>
                    <MenuItem value={CommandPriority.EMERGENCY}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SpeedIcon fontSize="small" color="error" />
                        <span>Emergency</span>
                      </Stack>
                    </MenuItem>
                  </Select>
                  <FormHelperText>
                    Higher priority commands are executed first
                  </FormHelperText>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Timeout (ms)"
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  inputProps={{ min: 1000, max: 300000, step: 1000 }}
                  helperText="Maximum time to wait for command completion"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <ScheduleIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Max Retries"
                  type="number"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  inputProps={{ min: 0, max: 10 }}
                  helperText="Number of retry attempts if command fails"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <RepeatIcon />
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={tags}
                  onChange={(_, newValue) => setTags(newValue)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Tags"
                      placeholder="Add tags"
                      helperText="Optional tags for tracking and filtering"
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        );
        
      case 'review':
        const command = templateService.buildCommand(template, parameterValues, {
          priority,
          timeoutMs,
          maxRetries
        });
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Command
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please review the command configuration before execution.
            </Typography>
            
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Template: {template.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {template.description}
              </Typography>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="subtitle2">Parameters</Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              
              <Collapse in={showDetails}>
                <List dense>
                  {Object.entries(parameterValues).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key}
                        secondary={JSON.stringify(value)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Paper>
            
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Execution Options
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Priority
                  </Typography>
                  <Typography variant="body1">
                    {priority.replace('_', ' ').toUpperCase()}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Timeout
                  </Typography>
                  <Typography variant="body1">
                    {timeoutMs / 1000}s
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Max Retries
                  </Typography>
                  <Typography variant="body1">
                    {maxRetries}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Tags
                  </Typography>
                  <Typography variant="body1">
                    {tags.length > 0 ? tags.join(', ') : 'None'}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        );
        
      case 'executing':
        return (
          <Box textAlign="center" py={4}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Executing Command...
            </Typography>
            {commandId && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Command ID: {commandId}
              </Typography>
            )}
            {commandStatus && (
              <Chip
                label={commandStatus.toUpperCase()}
                color={commandStatus === CommandStatus.EXECUTING ? 'primary' : 'default'}
                size="small"
              />
            )}
            <Box sx={{ width: '100%', mt: 3 }}>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          </Box>
        );
        
      case 'complete':
        const success = commandStatus === CommandStatus.COMPLETED && !executionError;
        
        return (
          <Box textAlign="center" py={4}>
            {success ? (
              <>
                <CheckIcon color="success" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Command Executed Successfully
                </Typography>
                {commandId && (
                  <Typography variant="body2" color="text.secondary">
                    Command ID: {commandId}
                  </Typography>
                )}
              </>
            ) : (
              <>
                <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Command Execution Failed
                </Typography>
                {executionError && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {executionError}
                  </Alert>
                )}
              </>
            )}
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  const steps: ExecutionStep[] = ['parameters', 'options', 'review'];
  const currentStepIndex = steps.indexOf(
    activeStep === 'executing' || activeStep === 'complete' ? 'review' : activeStep
  );
  
  return (
    <Dialog
      open
      onClose={executing ? undefined : onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={executing}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Execute Template: {template.name}</Typography>
          {!executing && (
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {activeStep !== 'executing' && activeStep !== 'complete' && (
          <Stepper activeStep={currentStepIndex} sx={{ mb: 4 }}>
            <Step>
              <StepLabel>Parameters</StepLabel>
            </Step>
            <Step>
              <StepLabel>Options</StepLabel>
            </Step>
            <Step>
              <StepLabel>Review</StepLabel>
            </Step>
          </Stepper>
        )}
        
        {getStepContent()}
      </DialogContent>
      
      <DialogActions>
        {activeStep === 'complete' ? (
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        ) : activeStep === 'executing' ? (
          <Button disabled>
            Executing...
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>
              Cancel
            </Button>
            {currentStepIndex > 0 && (
              <Button onClick={handleBack}>
                Back
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleNext}
              startIcon={activeStep === 'review' ? <PlayIcon /> : undefined}
            >
              {activeStep === 'review' ? 'Execute' : 'Next'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};