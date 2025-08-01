import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  FormControlLabel,
  Switch,
  Grid,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  DragIndicator as DragIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useWebSocket } from '../WebSocket/WebSocketProvider';
import { CommandType, CommandPriority } from '../../types/command.types';
import CommandForm from '../command/CommandForm';
import { validateCommand } from '../../utils/commandValidation';

interface BatchDependency {
  fromCommandId: string;
  toCommandId: string;
  dependencyType: 'completion' | 'success' | 'data' | 'conditional';
  condition?: any;
}

interface BatchCommand {
  id: string;
  type: CommandType;
  priority: CommandPriority;
  parameters: Record<string, any>;
  metadata: {
    name?: string;
    description?: string;
    tags?: string[];
  };
}

interface BatchConfiguration {
  name: string;
  description: string;
  executionMode: 'sequential' | 'parallel' | 'mixed';
  transactionMode: 'all_or_nothing' | 'best_effort' | 'stop_on_error' | 'isolated';
  priority: CommandPriority;
  enableRollback: boolean;
  validateBeforeExecution: boolean;
  parallelLimit?: number;
  timeoutSeconds?: number;
  retryFailedCommands: boolean;
  tags: string[];
}

interface BatchBuilderProps {
  onExecute?: (batch: any) => void;
  onSaveTemplate?: (template: any) => void;
  initialCommands?: BatchCommand[];
  templateId?: string;
}

const BatchBuilder: React.FC<BatchBuilderProps> = ({
  onExecute,
  onSaveTemplate,
  initialCommands = [],
  templateId,
}) => {
  const { sendMessage } = useWebSocket();
  const [activeStep, setActiveStep] = useState(0);
  const [commands, setCommands] = useState<BatchCommand[]>(initialCommands);
  const [dependencies, setDependencies] = useState<BatchDependency[]>([]);
  const [configuration, setConfiguration] = useState<BatchConfiguration>({
    name: '',
    description: '',
    executionMode: 'sequential',
    transactionMode: 'best_effort',
    priority: CommandPriority.NORMAL,
    enableRollback: true,
    validateBeforeExecution: true,
    retryFailedCommands: false,
    tags: [],
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showCommandDialog, setShowCommandDialog] = useState(false);
  const [editingCommand, setEditingCommand] = useState<BatchCommand | null>(null);
  const [showDependencyDialog, setShowDependencyDialog] = useState(false);
  const [newDependency, setNewDependency] = useState<Partial<BatchDependency>>({});
  const [selectedTab, setSelectedTab] = useState(0);

  // Validate entire batch
  const validateBatch = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!configuration.name) {
      errors.name = 'Batch name is required';
    }

    if (commands.length === 0) {
      errors.commands = 'At least one command is required';
    }

    // Validate individual commands
    commands.forEach((cmd, index) => {
      const cmdErrors = validateCommand(cmd.type, cmd.parameters);
      if (Object.keys(cmdErrors).length > 0) {
        errors[`command_${index}`] = `Command ${index + 1} has validation errors`;
      }
    });

    // Validate dependencies
    const commandIds = new Set(commands.map(cmd => cmd.id));
    dependencies.forEach((dep, index) => {
      if (!commandIds.has(dep.fromCommandId) || !commandIds.has(dep.toCommandId)) {
        errors[`dependency_${index}`] = `Dependency ${index + 1} references non-existent command`;
      }
    });

    // Check for circular dependencies
    if (hasCircularDependencies()) {
      errors.dependencies = 'Circular dependencies detected';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [commands, dependencies, configuration]);

  // Check for circular dependencies using DFS
  const hasCircularDependencies = useCallback(() => {
    const graph: Record<string, string[]> = {};
    commands.forEach(cmd => {
      graph[cmd.id] = [];
    });
    dependencies.forEach(dep => {
      graph[dep.fromCommandId].push(dep.toCommandId);
    });

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);

      for (const neighbor of graph[node] || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(node);
      return false;
    };

    for (const node of Object.keys(graph)) {
      if (!visited.has(node)) {
        if (hasCycle(node)) return true;
      }
    }

    return false;
  }, [commands, dependencies]);

  // Add command
  const handleAddCommand = useCallback((command: BatchCommand) => {
    if (editingCommand) {
      setCommands(prev => prev.map(cmd => 
        cmd.id === editingCommand.id ? command : cmd
      ));
    } else {
      setCommands(prev => [...prev, { ...command, id: `cmd_${Date.now()}` }]);
    }
    setShowCommandDialog(false);
    setEditingCommand(null);
  }, [editingCommand]);

  // Remove command
  const handleRemoveCommand = useCallback((commandId: string) => {
    setCommands(prev => prev.filter(cmd => cmd.id !== commandId));
    // Remove related dependencies
    setDependencies(prev => prev.filter(dep => 
      dep.fromCommandId !== commandId && dep.toCommandId !== commandId
    ));
  }, []);

  // Reorder commands
  const handleDragEnd = useCallback((result: any) => {
    if (!result.destination) return;

    const items = Array.from(commands);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCommands(items);
  }, [commands]);

  // Add dependency
  const handleAddDependency = useCallback(() => {
    if (newDependency.fromCommandId && newDependency.toCommandId) {
      setDependencies(prev => [...prev, {
        ...newDependency as BatchDependency,
      }]);
      setShowDependencyDialog(false);
      setNewDependency({});
    }
  }, [newDependency]);

  // Execute batch
  const handleExecute = useCallback(async () => {
    if (!validateBatch()) {
      return;
    }

    const batch = {
      name: configuration.name,
      description: configuration.description,
      commands: commands.map(cmd => ({
        command_type: cmd.type,
        priority: cmd.priority,
        parameters: cmd.parameters,
        metadata: {
          source: 'batch_builder',
          ...cmd.metadata,
        },
      })),
      dependencies,
      execution_mode: configuration.executionMode,
      transaction_mode: configuration.transactionMode,
      priority: configuration.priority,
      metadata: {
        source: 'batch_builder',
        tags: configuration.tags,
        enable_rollback: configuration.enableRollback,
        validate_before_execution: configuration.validateBeforeExecution,
        retry_failed_commands: configuration.retryFailedCommands,
      },
    };

    if (onExecute) {
      onExecute(batch);
    } else {
      // Send via WebSocket
      sendMessage({
        type: 'batch.create',
        payload: batch,
      });
    }
  }, [commands, dependencies, configuration, validateBatch, onExecute, sendMessage]);

  // Save as template
  const handleSaveTemplate = useCallback(() => {
    const template = {
      template_id: templateId || `template_${Date.now()}`,
      name: configuration.name,
      description: configuration.description,
      command_templates: commands.map(cmd => ({
        type: cmd.type,
        priority: cmd.priority,
        parameter_template: cmd.parameters,
        metadata: cmd.metadata,
      })),
      dependencies,
      execution_mode: configuration.executionMode,
      transaction_mode: configuration.transactionMode,
      default_priority: configuration.priority,
      tags: configuration.tags,
    };

    if (onSaveTemplate) {
      onSaveTemplate(template);
    }
  }, [commands, dependencies, configuration, templateId, onSaveTemplate]);

  // Export batch
  const handleExport = useCallback(() => {
    const exportData = {
      configuration,
      commands,
      dependencies,
      version: '1.0',
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${configuration.name || 'export'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [configuration, commands, dependencies]);

  // Import batch
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setConfiguration(data.configuration);
        setCommands(data.commands);
        setDependencies(data.dependencies || []);
      } catch (error) {
        console.error('Failed to import batch:', error);
      }
    };
    reader.readAsText(file);
  }, []);

  // Render command card
  const renderCommandCard = useCallback((command: BatchCommand, index: number) => (
    <Card variant="outlined" sx={{ mb: 1 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="subtitle1">
              {command.metadata?.name || `Command ${index + 1}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Type: {command.type} | Priority: {command.priority}
            </Typography>
            {command.metadata?.description && (
              <Typography variant="body2" color="text.secondary">
                {command.metadata.description}
              </Typography>
            )}
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={() => {
                setEditingCommand(command);
                setShowCommandDialog(true);
              }}
            >
              <SettingsIcon />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => handleRemoveCommand(command.id)}
              color="error"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>
        {validationErrors[`command_${index}`] && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {validationErrors[`command_${index}`]}
          </Alert>
        )}
      </CardContent>
    </Card>
  ), [validationErrors, handleRemoveCommand]);

  // Get dependency graph visualization
  const dependencyGraph = useMemo(() => {
    const nodes = commands.map(cmd => ({
      id: cmd.id,
      label: cmd.metadata?.name || cmd.type,
    }));

    const edges = dependencies.map(dep => ({
      from: dep.fromCommandId,
      to: dep.toCommandId,
      type: dep.dependencyType,
    }));

    return { nodes, edges };
  }, [commands, dependencies]);

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Batch Command Builder
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Step 1: Configuration */}
          <Step>
            <StepLabel>Configure Batch</StepLabel>
            <StepContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Batch Name"
                    value={configuration.name}
                    onChange={(e) => setConfiguration(prev => ({ ...prev, name: e.target.value }))}
                    error={!!validationErrors.name}
                    helperText={validationErrors.name}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Priority</InputLabel>
                    <Select
                      value={configuration.priority}
                      onChange={(e) => setConfiguration(prev => ({ 
                        ...prev, 
                        priority: e.target.value as CommandPriority 
                      }))}
                    >
                      <MenuItem value={CommandPriority.LOW}>Low</MenuItem>
                      <MenuItem value={CommandPriority.NORMAL}>Normal</MenuItem>
                      <MenuItem value={CommandPriority.HIGH}>High</MenuItem>
                      <MenuItem value={CommandPriority.EMERGENCY}>Emergency</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Description"
                    value={configuration.description}
                    onChange={(e) => setConfiguration(prev => ({ ...prev, description: e.target.value }))}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Execution Mode</InputLabel>
                    <Select
                      value={configuration.executionMode}
                      onChange={(e) => setConfiguration(prev => ({ 
                        ...prev, 
                        executionMode: e.target.value as any 
                      }))}
                    >
                      <MenuItem value="sequential">Sequential</MenuItem>
                      <MenuItem value="parallel">Parallel</MenuItem>
                      <MenuItem value="mixed">Mixed (Based on Dependencies)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Transaction Mode</InputLabel>
                    <Select
                      value={configuration.transactionMode}
                      onChange={(e) => setConfiguration(prev => ({ 
                        ...prev, 
                        transactionMode: e.target.value as any 
                      }))}
                    >
                      <MenuItem value="all_or_nothing">All or Nothing</MenuItem>
                      <MenuItem value="best_effort">Best Effort</MenuItem>
                      <MenuItem value="stop_on_error">Stop on Error</MenuItem>
                      <MenuItem value="isolated">Isolated</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={configuration.enableRollback}
                          onChange={(e) => setConfiguration(prev => ({ 
                            ...prev, 
                            enableRollback: e.target.checked 
                          }))}
                        />
                      }
                      label="Enable Rollback"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={configuration.validateBeforeExecution}
                          onChange={(e) => setConfiguration(prev => ({ 
                            ...prev, 
                            validateBeforeExecution: e.target.checked 
                          }))}
                        />
                      }
                      label="Validate Before Execution"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={configuration.retryFailedCommands}
                          onChange={(e) => setConfiguration(prev => ({ 
                            ...prev, 
                            retryFailedCommands: e.target.checked 
                          }))}
                        />
                      }
                      label="Retry Failed Commands"
                    />
                  </Box>
                </Grid>
              </Grid>
              <Box mt={2}>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(1)}
                  disabled={!configuration.name}
                >
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 2: Add Commands */}
          <Step>
            <StepLabel>Add Commands</StepLabel>
            <StepContent>
              <Box mb={2}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setShowCommandDialog(true)}
                >
                  Add Command
                </Button>
              </Box>

              {validationErrors.commands && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {validationErrors.commands}
                </Alert>
              )}

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="commands">
                  {(provided) => (
                    <Box {...provided.droppableProps} ref={provided.innerRef}>
                      {commands.map((command, index) => (
                        <Draggable key={command.id} draggableId={command.id} index={index}>
                          {(provided) => (
                            <Box
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              {renderCommandCard(command, index)}
                            </Box>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </DragDropContext>

              <Box mt={2} display="flex" gap={1}>
                <Button onClick={() => setActiveStep(0)}>Back</Button>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(2)}
                  disabled={commands.length === 0}
                >
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 3: Dependencies */}
          <Step>
            <StepLabel>Configure Dependencies (Optional)</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" paragraph>
                Define execution dependencies between commands. This is optional for sequential execution.
              </Typography>

              <Box mb={2}>
                <Button
                  variant="outlined"
                  startIcon={<LinkIcon />}
                  onClick={() => setShowDependencyDialog(true)}
                  disabled={commands.length < 2}
                >
                  Add Dependency
                </Button>
              </Box>

              {validationErrors.dependencies && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {validationErrors.dependencies}
                </Alert>
              )}

              <List>
                {dependencies.map((dep, index) => {
                  const fromCmd = commands.find(c => c.id === dep.fromCommandId);
                  const toCmd = commands.find(c => c.id === dep.toCommandId);
                  return (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${fromCmd?.metadata?.name || dep.fromCommandId} → ${toCmd?.metadata?.name || dep.toCommandId}`}
                        secondary={`Type: ${dep.dependencyType}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => setDependencies(prev => 
                            prev.filter((_, i) => i !== index)
                          )}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  );
                })}
              </List>

              <Box mt={2} display="flex" gap={1}>
                <Button onClick={() => setActiveStep(1)}>Back</Button>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(3)}
                >
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Step 4: Review and Execute */}
          <Step>
            <StepLabel>Review and Execute</StepLabel>
            <StepContent>
              <Alert severity="info" sx={{ mb: 2 }}>
                Review your batch configuration before execution.
              </Alert>

              <Box mb={2}>
                <Typography variant="subtitle1" gutterBottom>Summary</Typography>
                <Typography variant="body2">
                  • {commands.length} command{commands.length !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="body2">
                  • {dependencies.length} dependenc{dependencies.length !== 1 ? 'ies' : 'y'}
                </Typography>
                <Typography variant="body2">
                  • Execution Mode: {configuration.executionMode}
                </Typography>
                <Typography variant="body2">
                  • Transaction Mode: {configuration.transactionMode}
                </Typography>
              </Box>

              <Box display="flex" gap={1} flexWrap="wrap">
                <Button onClick={() => setActiveStep(2)}>Back</Button>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayIcon />}
                  onClick={handleExecute}
                  disabled={Object.keys(validationErrors).length > 0}
                >
                  Execute Batch
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveTemplate}
                >
                  Save as Template
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={handleExport}
                >
                  Export
                </Button>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  id="import-batch"
                  onChange={handleImport}
                />
                <label htmlFor="import-batch">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<UploadIcon />}
                  >
                    Import
                  </Button>
                </label>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>

      {/* Command Dialog */}
      <Dialog
        open={showCommandDialog}
        onClose={() => {
          setShowCommandDialog(false);
          setEditingCommand(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingCommand ? 'Edit Command' : 'Add Command'}
        </DialogTitle>
        <DialogContent>
          <CommandForm
            initialCommand={editingCommand}
            onSubmit={handleAddCommand}
            onCancel={() => {
              setShowCommandDialog(false);
              setEditingCommand(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Dependency Dialog */}
      <Dialog
        open={showDependencyDialog}
        onClose={() => {
          setShowDependencyDialog(false);
          setNewDependency({});
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Dependency</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>From Command</InputLabel>
                <Select
                  value={newDependency.fromCommandId || ''}
                  onChange={(e) => setNewDependency(prev => ({ 
                    ...prev, 
                    fromCommandId: e.target.value 
                  }))}
                >
                  {commands.map(cmd => (
                    <MenuItem key={cmd.id} value={cmd.id}>
                      {cmd.metadata?.name || `Command ${commands.indexOf(cmd) + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>To Command</InputLabel>
                <Select
                  value={newDependency.toCommandId || ''}
                  onChange={(e) => setNewDependency(prev => ({ 
                    ...prev, 
                    toCommandId: e.target.value 
                  }))}
                >
                  {commands
                    .filter(cmd => cmd.id !== newDependency.fromCommandId)
                    .map(cmd => (
                      <MenuItem key={cmd.id} value={cmd.id}>
                        {cmd.metadata?.name || `Command ${commands.indexOf(cmd) + 1}`}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Dependency Type</InputLabel>
                <Select
                  value={newDependency.dependencyType || 'completion'}
                  onChange={(e) => setNewDependency(prev => ({ 
                    ...prev, 
                    dependencyType: e.target.value as any 
                  }))}
                >
                  <MenuItem value="completion">Completion</MenuItem>
                  <MenuItem value="success">Success</MenuItem>
                  <MenuItem value="data">Data</MenuItem>
                  <MenuItem value="conditional">Conditional</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowDependencyDialog(false);
            setNewDependency({});
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddDependency}
            disabled={!newDependency.fromCommandId || !newDependency.toCommandId}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchBuilder;