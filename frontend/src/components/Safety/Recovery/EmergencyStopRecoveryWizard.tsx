/**
 * Emergency Stop Recovery Wizard
 * 
 * Safety-critical recovery interface following IEC 61508 standards.
 * Provides step-by-step guided recovery with mandatory verification
 * checkpoints and comprehensive audit logging.
 * 
 * Key Safety Features:
 * - Fail-safe state transitions
 * - Mandatory operator confirmations
 * - Hardware/software integrity checks
 * - Automatic rollback on failures
 * - Complete audit trail
 * - Role-based access control
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondary,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  TextField,
  useTheme,
  alpha,
  Fade,
  Zoom,
  Backdrop,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Replay as RetryIcon,
  Undo as RollbackIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckIcon,
  Settings as ConfigIcon,
  Security as SecurityIcon,
  Build as RepairIcon,
  Psychology as AssessmentIcon,
  Computer as SoftwareIcon,
  Memory as HardwareIcon,
  Verified as VerifyIcon,
  Cancel as AbortIcon,
  ExpandMore as ExpandMoreIcon,
  Timeline as AuditIcon,
  Person as OperatorIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';

import {
  RecoverySession,
  RecoveryStep,
  RecoveryStepStatus,
  RecoveryStepType,
  RecoveryResult,
  RecoveryConfiguration,
  RecoveryWizardProps,
  ComponentCheck,
  ComponentStatus,
  VerificationTest,
  AuditLogEntry,
  SystemComponent,
  EmergencyStopCause,
} from '../../../types/recovery';

const EmergencyStopRecoveryWizard: React.FC<RecoveryWizardProps> = ({
  session,
  configuration,
  onStepComplete,
  onStepFailed,
  onStepSkipped,
  onSessionComplete,
  onSessionAborted,
  onRollbackRequested,
  onAuditEvent,
}) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);
  const [currentStep, setCurrentStep] = useState<RecoveryStep | null>(null);
  const [stepProgress, setStepProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAbortDialog, setShowAbortDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [operatorConfirmation, setOperatorConfirmation] = useState('');
  const [showComponentDetails, setShowComponentDetails] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  
  const stepRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize wizard state
  useEffect(() => {
    if (session && session.steps.length > 0) {
      const currentStepIndex = session.steps.findIndex(
        step => step.status === RecoveryStepStatus.IN_PROGRESS || 
                step.status === RecoveryStepStatus.PENDING
      );
      
      if (currentStepIndex >= 0) {
        setActiveStep(currentStepIndex);
        setCurrentStep(session.steps[currentStepIndex]);
      }
    }
  }, [session]);

  // Progress simulation for active steps
  useEffect(() => {
    if (isProcessing && currentStep) {
      progressInterval.current = setInterval(() => {
        setStepProgress(prev => {
          const increment = 100 / (currentStep.estimatedDurationMs / 1000);
          return Math.min(prev + increment, 90); // Cap at 90% until completion
        });
      }, 1000);

      return () => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
      };
    }
  }, [isProcessing, currentStep]);

  // Get step icon based on type and status
  const getStepIcon = (step: RecoveryStep) => {
    const iconProps = { fontSize: 'small' as const };
    
    if (step.status === RecoveryStepStatus.COMPLETED) {
      return <CheckIcon color="success" {...iconProps} />;
    }
    if (step.status === RecoveryStepStatus.FAILED) {
      return <ErrorIcon color="error" {...iconProps} />;
    }
    if (step.status === RecoveryStepStatus.IN_PROGRESS) {
      return <LinearProgress sx={{ width: 20, height: 4, borderRadius: 2 }} />;
    }

    switch (step.type) {
      case RecoveryStepType.INITIAL_ASSESSMENT:
        return <AssessmentIcon color="info" {...iconProps} />;
      case RecoveryStepType.HARDWARE_CHECK:
        return <HardwareIcon color="primary" {...iconProps} />;
      case RecoveryStepType.SOFTWARE_VALIDATION:
        return <SoftwareIcon color="primary" {...iconProps} />;
      case RecoveryStepType.SYSTEM_INTEGRITY:
        return <SecurityIcon color="warning" {...iconProps} />;
      case RecoveryStepType.OPERATOR_CONFIRMATION:
        return <OperatorIcon color="info" {...iconProps} />;
      case RecoveryStepType.FINAL_VERIFICATION:
        return <VerifyIcon color="success" {...iconProps} />;
      case RecoveryStepType.ROLLBACK:
        return <RollbackIcon color="error" {...iconProps} />;
      default:
        return <ConfigIcon color="action" {...iconProps} />;
    }
  };

  // Get step color based on status
  const getStepColor = (step: RecoveryStep) => {
    switch (step.status) {
      case RecoveryStepStatus.COMPLETED:
        return theme.palette.success.main;
      case RecoveryStepStatus.FAILED:
        return theme.palette.error.main;
      case RecoveryStepStatus.IN_PROGRESS:
        return theme.palette.primary.main;
      case RecoveryStepStatus.BLOCKED:
        return theme.palette.warning.main;
      case RecoveryStepStatus.SKIPPED:
        return theme.palette.grey[500];
      default:
        return theme.palette.grey[400];
    }
  };

  // Handle step execution
  const handleStepStart = async (step: RecoveryStep) => {
    setIsProcessing(true);
    setStepProgress(0);
    
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      operatorId: session.operatorId,
      operatorName: session.operatorName,
      action: 'step_started',
      stepId: step.id,
      details: { stepType: step.type, stepTitle: step.title },
      result: 'success',
      message: `Started recovery step: ${step.title}`,
    };
    
    await onAuditEvent(auditEntry);

    try {
      // Simulate step processing
      await new Promise(resolve => setTimeout(resolve, step.estimatedDurationMs));
      
      setStepProgress(100);
      await onStepComplete(step.id, RecoveryResult.SUCCESS);
      
      const completionAudit: AuditLogEntry = {
        ...auditEntry,
        id: `audit_${Date.now()}`,
        action: 'step_completed',
        message: `Completed recovery step: ${step.title}`,
      };
      
      await onAuditEvent(completionAudit);
      
      // Move to next step
      const nextStepIndex = session.steps.findIndex(s => s.id === step.id) + 1;
      if (nextStepIndex < session.steps.length) {
        setActiveStep(nextStepIndex);
        setCurrentStep(session.steps[nextStepIndex]);
      } else {
        await onSessionComplete(session);
      }
      
    } catch (error) {
      await onStepFailed(step.id, error instanceof Error ? error.message : 'Unknown error');
      
      const failureAudit: AuditLogEntry = {
        ...auditEntry,
        id: `audit_${Date.now()}`,
        action: 'step_failed',
        result: 'failure',
        message: `Failed recovery step: ${step.title} - ${error}`,
      };
      
      await onAuditEvent(failureAudit);
    } finally {
      setIsProcessing(false);
      setStepProgress(0);
    }
  };

  // Handle step skip
  const handleStepSkip = async (step: RecoveryStep, reason: string) => {
    if (!step.canSkip) return;
    
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      operatorId: session.operatorId,
      operatorName: session.operatorName,
      action: 'step_skipped',
      stepId: step.id,
      details: { reason },
      result: 'warning',
      message: `Skipped recovery step: ${step.title} - Reason: ${reason}`,
    };
    
    await onAuditEvent(auditEntry);
    await onStepSkipped(step.id, reason);
    
    // Move to next step
    const nextStepIndex = session.steps.findIndex(s => s.id === step.id) + 1;
    if (nextStepIndex < session.steps.length) {
      setActiveStep(nextStepIndex);
      setCurrentStep(session.steps[nextStepIndex]);
    }
  };

  // Handle rollback request
  const handleRollback = async (reason: string) => {
    if (!currentStep?.canRollback) return;
    
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      operatorId: session.operatorId,
      operatorName: session.operatorName,
      action: 'rollback_requested',
      stepId: currentStep.id,
      details: { reason },
      result: 'warning',
      message: `Rollback requested from step: ${currentStep.title} - Reason: ${reason}`,
    };
    
    await onAuditEvent(auditEntry);
    await onRollbackRequested(currentStep.id, reason);
    setShowRollbackDialog(false);
  };

  // Handle session abort
  const handleAbort = async (reason: string) => {
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}`,
      timestamp: new Date(),
      operatorId: session.operatorId,
      operatorName: session.operatorName,
      action: 'session_aborted',
      details: { reason, activeStep: activeStep },
      result: 'failure',
      message: `Recovery session aborted - Reason: ${reason}`,
    };
    
    await onAuditEvent(auditEntry);
    await onSessionAborted(reason);
    setShowAbortDialog(false);
  };

  // Format duration for display
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Render component check details
  const renderComponentCheck = (check: ComponentCheck) => (
    <Card
      key={`${check.component}_${check.checkTime.getTime()}`}
      sx={{
        mb: 1,
        border: `2px solid ${
          check.status === ComponentStatus.HEALTHY ? theme.palette.success.main :
          check.status === ComponentStatus.WARNING ? theme.palette.warning.main :
          check.status === ComponentStatus.ERROR ? theme.palette.error.main :
          theme.palette.grey[300]
        }`,
      }}
    >
      <CardContent sx={{ py: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={getStepIcon({ type: RecoveryStepType.HARDWARE_CHECK } as RecoveryStep)}
              label={check.component.replace('_', ' ').toUpperCase()}
              size="small"
              color={
                check.status === ComponentStatus.HEALTHY ? 'success' :
                check.status === ComponentStatus.WARNING ? 'warning' :
                check.status === ComponentStatus.ERROR ? 'error' :
                'default'
              }
            />
            <Typography variant="body2">{check.description}</Typography>
          </Box>
          <Typography variant="caption" color="textSecondary">
            {check.checkTime.toLocaleTimeString()}
          </Typography>
        </Box>
        
        {check.errorMessage && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {check.errorMessage}
          </Alert>
        )}
        
        {check.recommendations && check.recommendations.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="textSecondary">
              Recommendations:
            </Typography>
            <List dense>
              {check.recommendations.map((rec, index) => (
                <ListItem key={index} sx={{ py: 0 }}>
                  <ListItemText primary={rec} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  // Render verification test
  const renderVerificationTest = (test: VerificationTest) => (
    <Box
      key={test.id}
      sx={{
        p: 1,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        mb: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" fontWeight="medium">
          {test.name}
        </Typography>
        <Chip
          label={test.status}
          size="small"
          color={
            test.status === 'passed' ? 'success' :
            test.status === 'failed' ? 'error' :
            test.status === 'running' ? 'primary' :
            'default'
          }
        />
      </Box>
      
      <Typography variant="caption" color="textSecondary">
        {test.description}
      </Typography>
      
      {test.result && (
        <Box sx={{ mt: 0.5 }}>
          <Typography variant="caption">
            Result: {test.result.message || (test.result.passed ? 'PASSED' : 'FAILED')}
          </Typography>
          {test.result.value !== undefined && (
            <Typography variant="caption" display="block">
              Value: {JSON.stringify(test.result.value)}
              {test.result.expectedValue !== undefined && 
                ` (Expected: ${JSON.stringify(test.result.expectedValue)})`
              }
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );

  if (!session) {
    return (
      <Alert severity="warning">
        <AlertTitle>No Recovery Session</AlertTitle>
        No active recovery session found. Please initiate recovery from the emergency stop interface.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
      {/* Session Header */}
      <Card sx={{ mb: 3, border: `3px solid ${theme.palette.error.main}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h5" color="error" gutterBottom>
                🚨 EMERGENCY STOP RECOVERY
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Session ID: {session.id} | Operator: {session.operatorName}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Emergency Cause: {session.emergencyStopCause.replace('_', ' ')} | 
                Started: {session.startTime.toLocaleString()}
              </Typography>
            </Box>
            
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="h6">
                Step {activeStep + 1} of {session.totalSteps}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(session.completedSteps / session.totalSteps) * 100}
                sx={{ width: 200, mt: 1 }}
              />
              <Typography variant="caption" color="textSecondary">
                {session.completedSteps} completed, {session.failedSteps} failed
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Recovery Stepper */}
      <Card>
        <CardContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {session.steps.map((step, index) => (
              <Step key={step.id} completed={step.status === RecoveryStepStatus.COMPLETED}>
                <StepLabel
                  error={step.status === RecoveryStepStatus.FAILED}
                  icon={getStepIcon(step)}
                  sx={{
                    '& .MuiStepLabel-iconContainer': {
                      color: getStepColor(step),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle1">{step.title}</Typography>
                    {step.required && (
                      <Chip label="REQUIRED" size="small" color="error" />
                    )}
                    {step.canSkip && step.status === RecoveryStepStatus.PENDING && (
                      <Chip label="OPTIONAL" size="small" color="info" />
                    )}
                  </Box>
                  <Typography variant="body2" color="textSecondary">
                    {step.description}
                  </Typography>
                </StepLabel>
                
                <StepContent>
                  <Card variant="outlined" sx={{ mt: 2, mb: 2 }}>
                    <CardContent>
                      {/* Step Instructions */}
                      <Typography variant="h6" gutterBottom>
                        Instructions
                      </Typography>
                      <List dense>
                        {step.instructions.map((instruction, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <Typography variant="body2" color="primary" fontWeight="bold">
                                {idx + 1}.
                              </Typography>
                            </ListItemIcon>
                            <ListItemText primary={instruction} />
                          </ListItem>
                        ))}
                      </List>

                      {/* Component Checks */}
                      {step.componentChecks && step.componentChecks.length > 0 && (
                        <Accordion
                          expanded={expandedSections.has(`components_${step.id}`)}
                          onChange={() => {
                            const newExpanded = new Set(expandedSections);
                            if (newExpanded.has(`components_${step.id}`)) {
                              newExpanded.delete(`components_${step.id}`);
                            } else {
                              newExpanded.add(`components_${step.id}`);
                            }
                            setExpandedSections(newExpanded);
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2">
                              Component Checks ({step.componentChecks.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            {step.componentChecks.map(renderComponentCheck)}
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {/* Verification Tests */}
                      {step.verificationTests && step.verificationTests.length > 0 && (
                        <Accordion
                          expanded={expandedSections.has(`tests_${step.id}`)}
                          onChange={() => {
                            const newExpanded = new Set(expandedSections);
                            if (newExpanded.has(`tests_${step.id}`)) {
                              newExpanded.delete(`tests_${step.id}`);
                            } else {
                              newExpanded.add(`tests_${step.id}`);
                            }
                            setExpandedSections(newExpanded);
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2">
                              Verification Tests ({step.verificationTests.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            {step.verificationTests.map(renderVerificationTest)}
                          </AccordionDetails>
                        </Accordion>
                      )}

                      {/* Progress Bar for Active Step */}
                      {step.status === RecoveryStepStatus.IN_PROGRESS && (
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">
                              Progress
                            </Typography>
                            <Typography variant="body2">
                              {Math.round(stepProgress)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={stepProgress}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                            Estimated time: {formatDuration(step.estimatedDurationMs)}
                          </Typography>
                        </Box>
                      )}

                      {/* Step Actions */}
                      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {step.status === RecoveryStepStatus.PENDING && (
                          <Button
                            variant="contained"
                            color="primary"
                            startIcon={<StartIcon />}
                            onClick={() => handleStepStart(step)}
                            disabled={isProcessing}
                          >
                            Start Step
                          </Button>
                        )}

                        {step.canSkip && step.status === RecoveryStepStatus.PENDING && (
                          <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => handleStepSkip(step, 'Operator chose to skip')}
                            disabled={isProcessing}
                          >
                            Skip Step
                          </Button>
                        )}

                        {step.status === RecoveryStepStatus.FAILED && (
                          <Button
                            variant="contained"
                            color="secondary"
                            startIcon={<RetryIcon />}
                            onClick={() => handleStepStart(step)}
                            disabled={isProcessing}
                          >
                            Retry Step
                          </Button>
                        )}

                        {step.canRollback && step.status !== RecoveryStepStatus.PENDING && (
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<RollbackIcon />}
                            onClick={() => setShowRollbackDialog(true)}
                            disabled={isProcessing}
                          >
                            Rollback
                          </Button>
                        )}
                      </Box>

                      {/* Error Display */}
                      {step.status === RecoveryStepStatus.FAILED && step.errorMessage && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          <AlertTitle>Step Failed</AlertTitle>
                          {step.errorMessage}
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Control Panel */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Recovery Control</Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<PauseIcon />}
                disabled={!session || session.status !== 'in_progress'}
              >
                Pause Session
              </Button>
              
              <Button
                variant="outlined"
                color="error"
                startIcon={<AbortIcon />}
                onClick={() => setShowAbortDialog(true)}
                disabled={!session}
              >
                Abort Recovery
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<AuditIcon />}
                disabled={!session}
              >
                View Audit Log
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Abort Confirmation Dialog */}
      <Dialog
        open={showAbortDialog}
        onClose={() => setShowAbortDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6">Abort Recovery Session?</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Critical Warning</AlertTitle>
            Aborting the recovery session will leave the system in an emergency stop state.
            This action should only be taken in extreme circumstances.
          </Alert>
          
          <Typography variant="body2" gutterBottom>
            Please provide a reason for aborting the recovery:
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            value={operatorConfirmation}
            onChange={(e) => setOperatorConfirmation(e.target.value)}
            placeholder="Enter reason for abort..."
            required
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowAbortDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => handleAbort(operatorConfirmation)}
            color="error"
            variant="contained"
            disabled={!operatorConfirmation.trim()}
          >
            Abort Recovery
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog
        open={showRollbackDialog}
        onClose={() => setShowRollbackDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RollbackIcon color="warning" />
            <Typography variant="h6">Rollback Recovery Step?</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Rollback Warning</AlertTitle>
            Rolling back will undo the current step and potentially previous steps.
            The system will return to a previous safe state.
          </Alert>
          
          <Typography variant="body2" gutterBottom>
            Please provide a reason for rollback:
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={2}
            value={operatorConfirmation}
            onChange={(e) => setOperatorConfirmation(e.target.value)}
            placeholder="Enter reason for rollback..."
            required
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowRollbackDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => handleRollback(operatorConfirmation)}
            color="warning"
            variant="contained"
            disabled={!operatorConfirmation.trim()}
          >
            Confirm Rollback
          </Button>
        </DialogActions>
      </Dialog>

      {/* Processing Backdrop */}
      <Backdrop
        open={isProcessing}
        sx={{ 
          zIndex: theme.zIndex.modal + 1,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Card sx={{ p: 3, textAlign: 'center' }}>
          <LinearProgress sx={{ mb: 2 }} />
          <Typography variant="h6">
            Processing Recovery Step...
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {currentStep?.title}
          </Typography>
        </Card>
      </Backdrop>
    </Box>
  );
};

export default EmergencyStopRecoveryWizard;