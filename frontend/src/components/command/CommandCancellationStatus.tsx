/**
 * Command Cancellation Status Component
 * 
 * Shows real-time cancellation status for commands with:
 * - Visual state indicators
 * - Progress tracking
 * - Action buttons
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
  Popover,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  LinearProgress
} from '@mui/material';
import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  RestoreFromTrash as RollbackIcon,
  CleaningServices as CleanupIcon,
  HourglassEmpty as PendingIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import {
  CancellationState,
  CancellationStatus,
  getCancellationService
} from '../../services/cancellationService';
import { CommandCancellationDialog } from './CommandCancellationDialog';

interface CommandCancellationStatusProps {
  commandId: string;
  commandType: string;
  commandStatus: string;
  canCancel?: boolean;
  onCancelled?: () => void;
  size?: 'small' | 'medium';
}

export const CommandCancellationStatus: React.FC<CommandCancellationStatusProps> = ({
  commandId,
  commandType,
  commandStatus,
  canCancel = true,
  onCancelled,
  size = 'medium'
}) => {
  const [cancellationStatus, setCancellationStatus] = useState<CancellationStatus | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);

  const cancellationService = getCancellationService();

  useEffect(() => {
    // Check for existing cancellation status
    checkCancellationStatus();

    // Subscribe to cancellation events
    const unsubscribe = cancellationService.subscribeToCancellationEvents(
      commandId,
      (event) => {
        // Update status from event
        setCancellationStatus({
          commandId: event.commandId,
          state: event.cancellationState,
          reason: event.reason,
          requesterId: event.requester,
          timestamp: new Date(),
          validationErrors: event.validationErrors || [],
          cleanupActions: event.cleanupActions || [],
          rollbackActions: event.rollbackActions || []
        });
      }
    );

    return unsubscribe;
  }, [commandId]);

  const checkCancellationStatus = async () => {
    try {
      const status = await cancellationService.getCancellationStatus(commandId);
      setCancellationStatus(status);
    } catch (error) {
      // No cancellation status - this is normal
    }
  };

  const handleCancelClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setShowDialog(true);
  };

  const handleInfoClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handlePopoverClose = () => {
    setAnchorEl(null);
  };

  const getCancellationStateColor = (state: CancellationState): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (state) {
      case CancellationState.REQUESTED:
      case CancellationState.VALIDATING:
        return 'info';
      case CancellationState.CANCELLING:
      case CancellationState.CLEANING_UP:
      case CancellationState.ROLLING_BACK:
        return 'warning';
      case CancellationState.COMPLETED:
        return 'success';
      case CancellationState.FAILED:
      case CancellationState.REJECTED:
        return 'error';
      default:
        return 'default';
    }
  };

  const getCancellationStateIcon = (state: CancellationState) => {
    switch (state) {
      case CancellationState.REQUESTED:
        return <PendingIcon fontSize="small" />;
      case CancellationState.VALIDATING:
        return <SecurityIcon fontSize="small" />;
      case CancellationState.CANCELLING:
        return <CancelIcon fontSize="small" />;
      case CancellationState.CLEANING_UP:
        return <CleanupIcon fontSize="small" />;
      case CancellationState.ROLLING_BACK:
        return <RollbackIcon fontSize="small" />;
      case CancellationState.COMPLETED:
        return <CheckCircleIcon fontSize="small" />;
      case CancellationState.FAILED:
      case CancellationState.REJECTED:
        return <ErrorIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const isInProgress = (state: CancellationState): boolean => {
    return [
      CancellationState.REQUESTED,
      CancellationState.VALIDATING,
      CancellationState.CANCELLING,
      CancellationState.CLEANING_UP,
      CancellationState.ROLLING_BACK
    ].includes(state);
  };

  const canShowCancelButton = (): boolean => {
    if (!canCancel) return false;
    
    // Can't cancel if already cancelled or cancelling
    if (cancellationStatus && isInProgress(cancellationStatus.state)) return false;
    if (cancellationStatus?.state === CancellationState.COMPLETED) return false;
    
    // Can cancel if in appropriate command status
    return ['pending', 'queued', 'executing', 'retrying'].includes(commandStatus);
  };

  const formatTimestamp = (date: Date): string => {
    return date.toLocaleTimeString();
  };

  // If there's an active cancellation, show its status
  if (cancellationStatus) {
    const inProgress = isInProgress(cancellationStatus.state);
    
    return (
      <>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            icon={getCancellationStateIcon(cancellationStatus.state)}
            label={cancellationStatus.state.replace(/_/g, ' ')}
            color={getCancellationStateColor(cancellationStatus.state)}
            size={size}
            onClick={handleInfoClick}
            sx={{ cursor: 'pointer' }}
          />
          {inProgress && (
            <CircularProgress size={20} thickness={4} />
          )}
        </Box>

        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handlePopoverClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Box p={2} maxWidth={400}>
            <Typography variant="subtitle2" gutterBottom>
              Cancellation Details
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemText
                  primary="State"
                  secondary={cancellationStatus.state.replace(/_/g, ' ')}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Reason"
                  secondary={cancellationStatus.reason.replace(/_/g, ' ')}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Requested At"
                  secondary={formatTimestamp(cancellationStatus.timestamp)}
                />
              </ListItem>
              {cancellationStatus.completedAt && (
                <ListItem>
                  <ListItemText
                    primary="Completed At"
                    secondary={formatTimestamp(cancellationStatus.completedAt)}
                  />
                </ListItem>
              )}
            </List>

            {cancellationStatus.validationErrors.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Validation Errors:
                </Typography>
                <List dense>
                  {cancellationStatus.validationErrors.map((error, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <ErrorIcon color="error" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={error} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {cancellationStatus.cleanupActions.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Cleanup Actions:
                </Typography>
                <List dense>
                  {cancellationStatus.cleanupActions.map((action, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CleanupIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={action} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {cancellationStatus.rollbackActions.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Rollback Actions:
                </Typography>
                <List dense>
                  {cancellationStatus.rollbackActions.map((action, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <RollbackIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={action} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {cancellationStatus.errorMessage && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="error" gutterBottom>
                  Error:
                </Typography>
                <Typography variant="body2" color="error">
                  {cancellationStatus.errorMessage}
                </Typography>
              </>
            )}
          </Box>
        </Popover>
      </>
    );
  }

  // If command can be cancelled, show cancel button
  if (canShowCancelButton()) {
    return (
      <>
        <Tooltip title="Cancel Command">
          <IconButton
            size={size}
            onClick={handleCancelClick}
            color="default"
            disabled={loading}
          >
            {loading ? (
              <CircularProgress size={20} thickness={4} />
            ) : (
              <CancelIcon />
            )}
          </IconButton>
        </Tooltip>

        <CommandCancellationDialog
          open={showDialog}
          commandId={commandId}
          commandType={commandType}
          commandStatus={commandStatus}
          onClose={() => setShowDialog(false)}
          onCancelled={(success) => {
            if (success) {
              onCancelled?.();
            }
            setShowDialog(false);
          }}
          requiresConfirmation={['firmware_update', 'reset', 'emergency_stop'].includes(commandType)}
          isCritical={commandType === 'emergency_stop'}
        />
      </>
    );
  }

  // No cancellation UI needed
  return null;
};