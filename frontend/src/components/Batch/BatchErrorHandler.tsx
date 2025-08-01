import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  AlertTitle,
  Button,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  CardActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Tooltip,
  Badge,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  CircularProgress,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Refresh as RetryIcon,
  Undo as RollbackIcon,
  SkipNext as SkipIcon,
  Stop as AbortIcon,
  PlayArrow as ContinueIcon,
  BugReport as DebugIcon,
  Code as LogIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ContentCopy as CopyIcon,
  Download as ExportIcon,
  Help as HelpIcon,
  AutoFixHigh as AutoFixIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface CommandError {
  commandId: string;
  commandType: string;
  error: string;
  errorCode?: string;
  errorDetails?: any;
  timestamp: string;
  retryCount: number;
  canRetry: boolean;
  canRollback: boolean;
  suggestedFix?: string;
  stackTrace?: string;
}

interface RecoveryOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: 'retry' | 'skip' | 'rollback' | 'abort' | 'fix';
  requiresConfirmation: boolean;
  fixScript?: string;
}

interface BatchErrorHandlerProps {
  batchId: string;
  errors: CommandError[];
  onRecoveryAction: (action: string, commandIds: string[], options?: any) => void;
  onDismiss?: () => void;
  isExecuting?: boolean;
}

const BatchErrorHandler: React.FC<BatchErrorHandlerProps> = ({
  batchId,
  errors,
  onRecoveryAction,
  onDismiss,
  isExecuting = false,
}) => {
  const [selectedErrors, setSelectedErrors] = useState<Set<string>>(new Set());
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [selectedRecovery, setSelectedRecovery] = useState<RecoveryOption | null>(null);
  const [recoveryOptions, setRecoveryOptions] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [showAutoFix, setShowAutoFix] = useState(false);
  const [autoFixProgress, setAutoFixProgress] = useState(0);

  // Group errors by type
  const errorGroups = useMemo(() => {
    const groups: Record<string, CommandError[]> = {};
    errors.forEach(error => {
      const key = error.errorCode || 'unknown';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(error);
    });
    return groups;
  }, [errors]);

  // Recovery options based on error type
  const getRecoveryOptions = useCallback((error: CommandError): RecoveryOption[] => {
    const options: RecoveryOption[] = [];

    if (error.canRetry) {
      options.push({
        id: 'retry',
        label: 'Retry Command',
        description: 'Attempt to execute the command again',
        icon: <RetryIcon />,
        action: 'retry',
        requiresConfirmation: false,
      });
    }

    options.push({
      id: 'skip',
      label: 'Skip Command',
      description: 'Skip this command and continue with the batch',
      icon: <SkipIcon />,
      action: 'skip',
      requiresConfirmation: true,
    });

    if (error.canRollback) {
      options.push({
        id: 'rollback',
        label: 'Rollback',
        description: 'Rollback to the state before this command',
        icon: <RollbackIcon />,
        action: 'rollback',
        requiresConfirmation: true,
      });
    }

    if (error.suggestedFix) {
      options.push({
        id: 'fix',
        label: 'Apply Suggested Fix',
        description: error.suggestedFix,
        icon: <AutoFixIcon />,
        action: 'fix',
        requiresConfirmation: true,
        fixScript: error.suggestedFix,
      });
    }

    options.push({
      id: 'abort',
      label: 'Abort Batch',
      description: 'Stop the entire batch execution',
      icon: <AbortIcon />,
      action: 'abort',
      requiresConfirmation: true,
    });

    return options;
  }, []);

  // Handle error selection
  const toggleErrorSelection = useCallback((errorId: string) => {
    setSelectedErrors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(errorId)) {
        newSet.delete(errorId);
      } else {
        newSet.add(errorId);
      }
      return newSet;
    });
  }, []);

  // Handle bulk selection
  const selectAll = useCallback(() => {
    setSelectedErrors(new Set(errors.map(e => e.commandId)));
  }, [errors]);

  const deselectAll = useCallback(() => {
    setSelectedErrors(new Set());
  }, []);

  // Handle recovery action
  const handleRecoveryAction = useCallback((option: RecoveryOption) => {
    if (option.requiresConfirmation) {
      setSelectedRecovery(option);
      setShowRecoveryDialog(true);
    } else {
      const commandIds = Array.from(selectedErrors);
      onRecoveryAction(option.action, commandIds, recoveryOptions);
    }
  }, [selectedErrors, recoveryOptions, onRecoveryAction]);

  // Confirm recovery action
  const confirmRecoveryAction = useCallback(() => {
    if (selectedRecovery) {
      const commandIds = Array.from(selectedErrors);
      onRecoveryAction(selectedRecovery.action, commandIds, recoveryOptions);
      setShowRecoveryDialog(false);
      setSelectedRecovery(null);
    }
  }, [selectedRecovery, selectedErrors, recoveryOptions, onRecoveryAction]);

  // Auto-fix simulation
  const handleAutoFix = useCallback(async () => {
    setShowAutoFix(true);
    setAutoFixProgress(0);

    // Simulate auto-fix process
    const fixableErrors = errors.filter(e => e.suggestedFix);
    const totalSteps = fixableErrors.length;

    for (let i = 0; i < totalSteps; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAutoFixProgress((i + 1) / totalSteps * 100);
      
      // Apply fix
      onRecoveryAction('fix', [fixableErrors[i].commandId], {
        fixScript: fixableErrors[i].suggestedFix,
      });
    }

    setShowAutoFix(false);
    setAutoFixProgress(0);
  }, [errors, onRecoveryAction]);

  // Copy error details
  const copyErrorDetails = useCallback((error: CommandError) => {
    const details = JSON.stringify({
      commandId: error.commandId,
      commandType: error.commandType,
      error: error.error,
      errorCode: error.errorCode,
      errorDetails: error.errorDetails,
      timestamp: error.timestamp,
      stackTrace: error.stackTrace,
    }, null, 2);

    navigator.clipboard.writeText(details);
  }, []);

  // Export error report
  const exportErrorReport = useCallback(() => {
    const report = {
      batchId,
      timestamp: new Date().toISOString(),
      totalErrors: errors.length,
      errors: errors.map(e => ({
        commandId: e.commandId,
        commandType: e.commandType,
        error: e.error,
        errorCode: e.errorCode,
        timestamp: e.timestamp,
        retryCount: e.retryCount,
      })),
      errorGroups: Object.entries(errorGroups).map(([code, errs]) => ({
        errorCode: code,
        count: errs.length,
        commands: errs.map(e => e.commandId),
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${batchId}_errors_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [batchId, errors, errorGroups]);

  // Render error item
  const renderErrorItem = (error: CommandError) => {
    const isExpanded = expandedErrors.has(error.commandId);
    const isSelected = selectedErrors.has(error.commandId);
    const recoveryOpts = getRecoveryOptions(error);

    return (
      <Card key={error.commandId} variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="flex-start" gap={2}>
            <Checkbox
              checked={isSelected}
              onChange={() => toggleErrorSelection(error.commandId)}
              disabled={isExecuting}
            />
            <Box flex={1}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <ErrorIcon color="error" />
                <Typography variant="subtitle1">
                  Command {error.commandId}
                </Typography>
                <Chip
                  label={error.commandType}
                  size="small"
                  variant="outlined"
                />
                {error.errorCode && (
                  <Chip
                    label={error.errorCode}
                    size="small"
                    color="error"
                  />
                )}
              </Box>
              
              <Typography variant="body2" color="error" gutterBottom>
                {error.error}
              </Typography>

              <Box display="flex" alignItems="center" gap={2} mt={1}>
                <Typography variant="caption" color="text.secondary">
                  {format(new Date(error.timestamp), 'MMM d, HH:mm:ss')}
                </Typography>
                {error.retryCount > 0 && (
                  <Chip
                    label={`${error.retryCount} retries`}
                    size="small"
                    variant="outlined"
                  />
                )}
                {error.suggestedFix && (
                  <Tooltip title="Suggested fix available">
                    <AutoFixIcon fontSize="small" color="info" />
                  </Tooltip>
                )}
              </Box>

              <Collapse in={isExpanded}>
                <Box mt={2}>
                  {error.errorDetails && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Error Details:
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1 }}>
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '12px',
                          overflow: 'auto',
                          maxHeight: 200,
                        }}>
                          {JSON.stringify(error.errorDetails, null, 2)}
                        </pre>
                      </Paper>
                    </Box>
                  )}

                  {error.stackTrace && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Stack Trace:
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 1 }}>
                        <pre style={{ 
                          margin: 0, 
                          fontSize: '12px',
                          overflow: 'auto',
                          maxHeight: 200,
                        }}>
                          {error.stackTrace}
                        </pre>
                      </Paper>
                    </Box>
                  )}

                  {error.suggestedFix && (
                    <Alert severity="info" icon={<AutoFixIcon />}>
                      <AlertTitle>Suggested Fix</AlertTitle>
                      {error.suggestedFix}
                    </Alert>
                  )}
                </Box>
              </Collapse>
            </Box>
            <Box>
              <IconButton
                size="small"
                onClick={() => setExpandedErrors(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(error.commandId)) {
                    newSet.delete(error.commandId);
                  } else {
                    newSet.add(error.commandId);
                  }
                  return newSet;
                })}
              >
                {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => copyErrorDetails(error)}
              >
                <CopyIcon />
              </IconButton>
            </Box>
          </Box>

          {isSelected && !isExecuting && (
            <CardActions>
              {recoveryOpts.map(opt => (
                <Button
                  key={opt.id}
                  size="small"
                  startIcon={opt.icon}
                  onClick={() => handleRecoveryAction(opt)}
                >
                  {opt.label}
                </Button>
              ))}
            </CardActions>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render error summary
  const renderErrorSummary = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="error">
            {errors.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Total Errors
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="warning.main">
            {errors.filter(e => e.canRetry).length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Retryable
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="info.main">
            {errors.filter(e => e.suggestedFix).length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Auto-fixable
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4" color="text.secondary">
            {Object.keys(errorGroups).length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Error Types
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <Box>
      <Alert 
        severity="error" 
        sx={{ mb: 3 }}
        action={
          onDismiss && (
            <Button color="inherit" size="small" onClick={onDismiss}>
              Dismiss
            </Button>
          )
        }
      >
        <AlertTitle>Batch Execution Errors</AlertTitle>
        {errors.length} command{errors.length !== 1 ? 's' : ''} failed during batch execution.
        Review the errors below and select recovery actions.
      </Alert>

      {renderErrorSummary()}

      <Paper sx={{ mb: 3 }}>
        <Box p={2} display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">Error Details</Typography>
            <Chip
              label={`${selectedErrors.size} selected`}
              size="small"
              color="primary"
              variant={selectedErrors.size > 0 ? 'filled' : 'outlined'}
            />
          </Box>
          <Box display="flex" gap={1}>
            {selectedErrors.size > 0 && selectedErrors.size < errors.length && (
              <Button size="small" onClick={selectAll}>
                Select All
              </Button>
            )}
            {selectedErrors.size > 0 && (
              <Button size="small" onClick={deselectAll}>
                Deselect All
              </Button>
            )}
            <Button
              size="small"
              startIcon={<ExportIcon />}
              onClick={exportErrorReport}
            >
              Export Report
            </Button>
          </Box>
        </Box>

        <Divider />

        <Box p={2}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label={`All Errors (${errors.length})`} />
            <Tab label={`By Type (${Object.keys(errorGroups).length})`} />
            <Tab label="Recovery Options" />
          </Tabs>

          {/* All Errors Tab */}
          {activeTab === 0 && (
            <Box>
              {errors.map(renderErrorItem)}
            </Box>
          )}

          {/* By Type Tab */}
          {activeTab === 1 && (
            <Box>
              {Object.entries(errorGroups).map(([code, groupErrors]) => (
                <Accordion key={code}>
                  <AccordionSummary expandIcon={<ExpandIcon />}>
                    <Box display="flex" alignItems="center" gap={2} width="100%">
                      <Typography>{code}</Typography>
                      <Chip label={groupErrors.length} size="small" />
                      <Box flex={1} />
                      <Typography variant="body2" color="text.secondary">
                        {groupErrors[0].error}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {groupErrors.map(renderErrorItem)}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          )}

          {/* Recovery Options Tab */}
          {activeTab === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Select errors and choose a recovery strategy below.
              </Alert>

              {selectedErrors.size === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  Select one or more errors to see recovery options
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Quick Actions for {selectedErrors.size} selected error{selectedErrors.size !== 1 ? 's' : ''}:
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                          <RetryIcon color="primary" />
                          <Typography variant="h6">Retry All</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Attempt to execute all selected commands again with the same parameters.
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={recoveryOptions.retryWithBackoff || false}
                              onChange={(e) => setRecoveryOptions(prev => ({
                                ...prev,
                                retryWithBackoff: e.target.checked,
                              }))}
                            />
                          }
                          label="Use exponential backoff"
                        />
                      </CardContent>
                      <CardActions>
                        <Button
                          variant="contained"
                          startIcon={<RetryIcon />}
                          onClick={() => handleRecoveryAction({
                            id: 'retry',
                            label: 'Retry All',
                            description: '',
                            icon: <RetryIcon />,
                            action: 'retry',
                            requiresConfirmation: false,
                          })}
                          disabled={isExecuting}
                        >
                          Retry Selected
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Box display="flex" alignItems="center" gap={2} mb={2}>
                          <AutoFixIcon color="info" />
                          <Typography variant="h6">Auto Fix</Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          Automatically apply suggested fixes for errors that have them.
                        </Typography>
                        <Typography variant="body2">
                          {errors.filter(e => e.suggestedFix).length} errors have suggested fixes
                        </Typography>
                      </CardContent>
                      <CardActions>
                        <Button
                          variant="contained"
                          color="info"
                          startIcon={<AutoFixIcon />}
                          onClick={handleAutoFix}
                          disabled={isExecuting || errors.filter(e => e.suggestedFix).length === 0}
                        >
                          Auto Fix Available
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                </Grid>
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Recovery Confirmation Dialog */}
      <Dialog
        open={showRecoveryDialog}
        onClose={() => setShowRecoveryDialog(false)}
      >
        <DialogTitle>Confirm Recovery Action</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action will affect {selectedErrors.size} command{selectedErrors.size !== 1 ? 's' : ''}.
          </Alert>
          {selectedRecovery && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Action: {selectedRecovery.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedRecovery.description}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRecoveryDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmRecoveryAction}
            color="primary"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Auto-fix Progress Dialog */}
      <Dialog open={showAutoFix}>
        <DialogTitle>Applying Auto Fixes</DialogTitle>
        <DialogContent>
          <Box sx={{ width: 300, p: 2 }}>
            <CircularProgress
              variant="determinate"
              value={autoFixProgress}
              size={80}
              thickness={4}
              sx={{ display: 'block', mx: 'auto', mb: 2 }}
            />
            <Typography variant="body2" align="center">
              {Math.round(autoFixProgress)}% complete
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default BatchErrorHandler;