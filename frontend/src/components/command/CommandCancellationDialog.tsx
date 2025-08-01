/**
 * Command Cancellation Dialog Component
 * 
 * Provides a safe UI for command cancellation with:
 * - Confirmation requirements for critical commands
 * - Real-time cancellation progress
 * - Rollback options
 * - Safety warnings
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Box,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  RestoreFromTrash as RollbackIcon,
  CleaningServices as CleanupIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import {
  CancellationReason,
  CancellationState,
  CancellationConfirmation,
  CancellationEvent,
  getCancellationService
} from '../../services/cancellationService';

interface CommandCancellationDialogProps {
  open: boolean;
  commandId: string;
  commandType: string;
  commandStatus: string;
  onClose: () => void;
  onCancelled?: (success: boolean) => void;
  requiresConfirmation?: boolean;
  isCritical?: boolean;
}

const cancellationSteps = [
  'Validation',
  'Cancelling',
  'Cleanup',
  'Rollback',
  'Complete'
];

export const CommandCancellationDialog: React.FC<CommandCancellationDialogProps> = ({
  open,
  commandId,
  commandType,
  commandStatus,
  onClose,
  onCancelled,
  requiresConfirmation = false,
  isCritical = false
}) => {
  const [reason, setReason] = useState<CancellationReason>(CancellationReason.USER_REQUEST);
  const [notes, setNotes] = useState('');
  const [requestRollback, setRequestRollback] = useState(true);
  const [force, setForce] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [requiredConfirmation, setRequiredConfirmation] = useState<CancellationConfirmation | null>(null);
  
  const [cancelling, setCancelling] = useState(false);
  const [cancellationState, setCancellationState] = useState<CancellationState | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [cleanupActions, setCleanupActions] = useState<string[]>([]);
  const [rollbackActions, setRollbackActions] = useState<string[]>([]);
  
  const cancellationService = getCancellationService();

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setReason(CancellationReason.USER_REQUEST);
      setNotes('');
      setRequestRollback(true);
      setForce(false);
      setConfirmationText('');
      setRequiredConfirmation(null);
      setCancelling(false);
      setCancellationState(null);
      setActiveStep(-1);
      setError(null);
      setValidationErrors([]);
      setCleanupActions([]);
      setRollbackActions([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !commandId) return;

    // Subscribe to cancellation events
    const unsubscribe = cancellationService.subscribeToCancellationEvents(
      commandId,
      handleCancellationEvent
    );

    return unsubscribe;
  }, [open, commandId]);

  const handleCancellationEvent = (event: CancellationEvent) => {
    setCancellationState(event.cancellationState);
    
    // Update step based on state
    switch (event.cancellationState) {
      case CancellationState.VALIDATING:
        setActiveStep(0);
        break;
      case CancellationState.CANCELLING:
        setActiveStep(1);
        break;
      case CancellationState.CLEANING_UP:
        setActiveStep(2);
        break;
      case CancellationState.ROLLING_BACK:
        setActiveStep(3);
        break;
      case CancellationState.COMPLETED:
        setActiveStep(4);
        break;
    }

    // Update lists
    if (event.validationErrors) {
      setValidationErrors(event.validationErrors);
    }
    if (event.cleanupActions) {
      setCleanupActions(event.cleanupActions);
    }
    if (event.rollbackActions) {
      setRollbackActions(event.rollbackActions);
    }
  };

  const handleCancel = async () => {
    setError(null);
    setCancelling(true);

    try {
      const response = await cancellationService.cancelCommandWithConfirmation(
        {
          commandId,
          reason,
          force,
          rollback: requestRollback,
          notes,
          confirmationToken: confirmationText || undefined
        },
        async (confirmation) => {
          setRequiredConfirmation(confirmation);
          return new Promise((resolve) => {
            // Wait for user to provide confirmation
            // This will be resolved when they click confirm with the right text
            const checkInterval = setInterval(() => {
              if (confirmationText === confirmation.confirmationText) {
                clearInterval(checkInterval);
                resolve(true);
              }
            }, 100);

            // Timeout after expiration
            setTimeout(() => {
              clearInterval(checkInterval);
              resolve(false);
            }, confirmation.expiresAt - Date.now());
          });
        }
      );

      if (response.success) {
        // Wait a bit to show completion
        setTimeout(() => {
          onCancelled?.(true);
          onClose();
        }, 1500);
      } else {
        setError(response.message || 'Cancellation failed');
        setCancelling(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to cancel command');
      setCancelling(false);
    }
  };

  const canProceed = () => {
    if (requiredConfirmation) {
      return confirmationText === requiredConfirmation.confirmationText;
    }
    return true;
  };

  const getStateIcon = (state: CancellationState | null) => {
    switch (state) {
      case CancellationState.VALIDATING:
        return <SecurityIcon />;
      case CancellationState.CANCELLING:
        return <CancelIcon />;
      case CancellationState.CLEANING_UP:
        return <CleanupIcon />;
      case CancellationState.ROLLING_BACK:
        return <RollbackIcon />;
      case CancellationState.COMPLETED:
        return <CheckCircleIcon color="success" />;
      case CancellationState.FAILED:
      case CancellationState.REJECTED:
        return <ErrorIcon color="error" />;
      default:
        return null;
    }
  };

  const getSeverityChip = () => {
    if (isCritical) {
      return <Chip label="Critical Command" color="error" size="small" />;
    }
    if (requiresConfirmation) {
      return <Chip label="Requires Confirmation" color="warning" size="small" />;
    }
    return null;
  };

  return (
    <Dialog
      open={open}
      onClose={cancelling ? undefined : onClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={cancelling}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Cancel Command</Typography>
          {getSeverityChip()}
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Command Info */}
        <Box mb={3}>
          <Typography variant="body2" color="textSecondary">
            Command ID: {commandId}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Type: {commandType}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Status: {commandStatus}
          </Typography>
        </Box>

        {/* Warnings */}
        {isCritical && (
          <Alert severity="error" icon={<WarningIcon />} sx={{ mb: 2 }}>
            This is a critical command. Cancellation may affect system stability.
            Please ensure you understand the consequences before proceeding.
          </Alert>
        )}

        {commandStatus === 'executing' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            This command is currently executing. Cancellation will attempt to:
            <List dense>
              <ListItem>
                <ListItemIcon><CleanupIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Clean up any resources in use" />
              </ListItem>
              {requestRollback && (
                <ListItem>
                  <ListItemIcon><RollbackIcon fontSize="small" /></ListItemIcon>
                  <ListItemText primary="Roll back any changes made" />
                </ListItem>
              )}
            </List>
          </Alert>
        )}

        {/* Cancellation Progress */}
        {cancelling && (
          <Box mb={3}>
            <Stepper activeStep={activeStep} alternativeLabel>
              {cancellationSteps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            <Box mt={2} mb={2}>
              <LinearProgress variant="indeterminate" />
            </Box>

            {/* Current State Display */}
            {cancellationState && (
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                {getStateIcon(cancellationState)}
                <Typography variant="body1" ml={1}>
                  {cancellationState.replace(/_/g, ' ').toUpperCase()}
                </Typography>
              </Box>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Validation Errors:</Typography>
                <List dense>
                  {validationErrors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={error} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            {/* Cleanup Actions */}
            {cleanupActions.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Cleanup Actions:
                </Typography>
                <List dense>
                  {cleanupActions.map((action, index) => (
                    <ListItem key={index}>
                      <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary={action} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Rollback Actions */}
            {rollbackActions.length > 0 && (
              <Box mb={2}>
                <Typography variant="subtitle2" gutterBottom>
                  Rollback Actions:
                </Typography>
                <List dense>
                  {rollbackActions.map((action, index) => (
                    <ListItem key={index}>
                      <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                      <ListItemText primary={action} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Box>
        )}

        {/* Cancellation Form */}
        {!cancelling && (
          <>
            {/* Reason Selection */}
            <TextField
              select
              fullWidth
              label="Cancellation Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as CancellationReason)}
              margin="normal"
              SelectProps={{
                native: true,
              }}
            >
              <option value={CancellationReason.USER_REQUEST}>User Request</option>
              <option value={CancellationReason.TIMEOUT}>Timeout</option>
              <option value={CancellationReason.EMERGENCY_STOP}>Emergency Stop</option>
              <option value={CancellationReason.DEPENDENCY_FAILED}>Dependency Failed</option>
              <option value={CancellationReason.RESOURCE_UNAVAILABLE}>Resource Unavailable</option>
              <option value={CancellationReason.SAFETY_VIOLATION}>Safety Violation</option>
            </TextField>

            {/* Notes */}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Additional Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              margin="normal"
            />

            {/* Options */}
            <Box mt={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={requestRollback}
                    onChange={(e) => setRequestRollback(e.target.checked)}
                  />
                }
                label="Attempt to rollback command effects"
              />
              
              {isCritical && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={force}
                      onChange={(e) => setForce(e.target.checked)}
                      color="error"
                    />
                  }
                  label="Force cancellation (override safety checks)"
                />
              )}
            </Box>

            {/* Confirmation */}
            {requiredConfirmation && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  This command requires confirmation. Please type the following text:
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontFamily: 'monospace',
                    bgcolor: 'grey.100',
                    p: 1,
                    borderRadius: 1,
                    mt: 1,
                    mb: 2
                  }}
                >
                  {requiredConfirmation.confirmationText}
                </Typography>
                <TextField
                  fullWidth
                  label="Confirmation Text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  error={confirmationText !== '' && confirmationText !== requiredConfirmation.confirmationText}
                  helperText={
                    confirmationText !== '' && confirmationText !== requiredConfirmation.confirmationText
                      ? 'Text does not match'
                      : ''
                  }
                />
              </Alert>
            )}
          </>
        )}

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={onClose}
          disabled={cancelling}
        >
          Close
        </Button>
        {!cancelling && cancellationState !== CancellationState.COMPLETED && (
          <Button
            onClick={handleCancel}
            color="error"
            variant="contained"
            disabled={!canProceed()}
            startIcon={<CancelIcon />}
          >
            Cancel Command
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};