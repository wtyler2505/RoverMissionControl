/**
 * Rollback Visualization Component
 * 
 * Displays visual representation of command rollback process:
 * - Timeline of original command execution
 * - Compensating actions being taken
 * - Resource cleanup status
 * - System state restoration
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Alert,
  Grid,
  Divider
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Undo as UndoIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Storage as ResourceIcon,
  CleaningServices as CleanupIcon,
  RestoreFromTrash as RestoreIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Power as PowerIcon,
  DirectionsCar as MoveIcon,
  RotateRight as RotateIcon,
  Sensors as SensorIcon
} from '@mui/icons-material';
import { keyframes } from '@mui/system';

interface RollbackStep {
  id: string;
  type: 'cleanup' | 'restore' | 'compensate';
  action: string;
  target: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  details?: string;
  error?: string;
}

interface CommandExecution {
  commandId: string;
  commandType: string;
  parameters: Record<string, any>;
  startTime: Date;
  endTime?: Date;
  status: 'executing' | 'completed' | 'failed' | 'cancelled';
  stateChanges: Array<{
    property: string;
    oldValue: any;
    newValue: any;
  }>;
}

interface RollbackVisualizationProps {
  commandExecution: CommandExecution;
  rollbackSteps: RollbackStep[];
  isActive: boolean;
  onStepClick?: (step: RollbackStep) => void;
}

// Animation for active step
const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

export const RollbackVisualization: React.FC<RollbackVisualizationProps> = ({
  commandExecution,
  rollbackSteps,
  isActive,
  onStepClick
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [activeStepIndex, setActiveStepIndex] = useState(-1);

  useEffect(() => {
    // Find the current active step
    const activeIndex = rollbackSteps.findIndex(
      step => step.status === 'in_progress'
    );
    setActiveStepIndex(activeIndex);
  }, [rollbackSteps]);

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const getCommandIcon = (commandType: string) => {
    const iconMap: Record<string, React.ReactElement> = {
      move_forward: <MoveIcon />,
      move_backward: <MoveIcon sx={{ transform: 'rotate(180deg)' }} />,
      turn_left: <RotateIcon sx={{ transform: 'scaleX(-1)' }} />,
      turn_right: <RotateIcon />,
      set_speed: <SpeedIcon />,
      set_power: <PowerIcon />,
      read_sensor: <SensorIcon />,
      stop: <StopIcon />,
    };
    return iconMap[commandType] || <StartIcon />;
  };

  const getStepIcon = (step: RollbackStep) => {
    switch (step.type) {
      case 'cleanup':
        return <CleanupIcon />;
      case 'restore':
        return <RestoreIcon />;
      case 'compensate':
        return <UndoIcon />;
      default:
        return <CheckIcon />;
    }
  };

  const getStepColor = (status: string): 'inherit' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'grey' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'in_progress':
        return 'primary';
      case 'skipped':
        return 'grey';
      default:
        return 'inherit';
    }
  };

  const formatDuration = (start: Date, end?: Date): string => {
    if (!end) return 'In progress...';
    const duration = end.getTime() - start.getTime();
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const calculateProgress = (): number => {
    const completed = rollbackSteps.filter(
      step => ['completed', 'failed', 'skipped'].includes(step.status)
    ).length;
    return (completed / rollbackSteps.length) * 100;
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h6" gutterBottom>
          Command Rollback Visualization
        </Typography>
        {isActive && (
          <LinearProgress
            variant="determinate"
            value={calculateProgress()}
            sx={{ mb: 2 }}
          />
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Original Command Execution */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Original Command Execution
              </Typography>
              
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                {getCommandIcon(commandExecution.commandType)}
                <Box flex={1}>
                  <Typography variant="body2">
                    {commandExecution.commandType.replace(/_/g, ' ').toUpperCase()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    ID: {commandExecution.commandId}
                  </Typography>
                </Box>
                <Chip
                  label={commandExecution.status}
                  color={commandExecution.status === 'cancelled' ? 'warning' : 'default'}
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Parameters */}
              <Typography variant="subtitle2" gutterBottom>
                Parameters:
              </Typography>
              <Box mb={2}>
                {Object.entries(commandExecution.parameters).map(([key, value]) => (
                  <Typography key={key} variant="body2" color="textSecondary">
                    {key}: {JSON.stringify(value)}
                  </Typography>
                ))}
              </Box>

              {/* State Changes */}
              {commandExecution.stateChanges.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    State Changes:
                  </Typography>
                  <List dense>
                    {commandExecution.stateChanges.map((change, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <WarningIcon fontSize="small" color="warning" />
                        </ListItemIcon>
                        <ListItemText
                          primary={change.property}
                          secondary={`${change.oldValue} → ${change.newValue}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {/* Timing */}
              <Box mt={2}>
                <Typography variant="caption" color="textSecondary">
                  Started: {commandExecution.startTime.toLocaleTimeString()}
                </Typography>
                {commandExecution.endTime && (
                  <>
                    <br />
                    <Typography variant="caption" color="textSecondary">
                      Duration: {formatDuration(commandExecution.startTime, commandExecution.endTime)}
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Rollback Steps */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                Rollback Steps
              </Typography>

              <Stepper activeStep={activeStepIndex} orientation="vertical">
                {rollbackSteps.map((step, index) => (
                  <Step key={step.id} completed={step.status === 'completed'}>
                    <StepLabel
                      error={step.status === 'failed'}
                      icon={
                        <Box
                          sx={{
                            animation: step.status === 'in_progress' 
                              ? `${pulse} 2s ease-in-out infinite` 
                              : 'none'
                          }}
                        >
                          {getStepIcon(step)}
                        </Box>
                      }
                      onClick={() => onStepClick?.(step)}
                      sx={{ cursor: onStepClick ? 'pointer' : 'default' }}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="body2">
                          {step.action}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStepExpansion(step.id);
                          }}
                        >
                          {expandedSteps.has(step.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </Box>
                    </StepLabel>
                    <StepContent>
                      <Collapse in={expandedSteps.has(step.id)}>
                        <Box p={2} bgcolor="grey.50" borderRadius={1}>
                          <Typography variant="body2" gutterBottom>
                            <strong>Target:</strong> {step.target}
                          </Typography>
                          
                          {step.details && (
                            <Typography variant="body2" color="textSecondary" gutterBottom>
                              {step.details}
                            </Typography>
                          )}

                          {step.error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              {step.error}
                            </Alert>
                          )}

                          {step.startTime && (
                            <Typography variant="caption" color="textSecondary">
                              {step.endTime 
                                ? `Duration: ${formatDuration(step.startTime, step.endTime)}`
                                : 'In progress...'}
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>

              {rollbackSteps.length === 0 && (
                <Box textAlign="center" py={3}>
                  <Typography variant="body2" color="textSecondary">
                    No rollback steps defined
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Summary */}
      {!isActive && rollbackSteps.length > 0 && (
        <Box mt={3}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Rollback Summary
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4">
                  {rollbackSteps.filter(s => s.status === 'completed').length}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Completed
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4" color="error">
                  {rollbackSteps.filter(s => s.status === 'failed').length}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Failed
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4" color="textSecondary">
                  {rollbackSteps.filter(s => s.status === 'skipped').length}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Skipped
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4">
                  {(() => {
                    const times = rollbackSteps
                      .filter(s => s.startTime && s.endTime)
                      .map(s => s.endTime!.getTime() - s.startTime!.getTime());
                    const total = times.reduce((a, b) => a + b, 0);
                    return total < 1000 ? `${total}ms` : `${(total / 1000).toFixed(1)}s`;
                  })()}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Total Time
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}
    </Box>
  );
};