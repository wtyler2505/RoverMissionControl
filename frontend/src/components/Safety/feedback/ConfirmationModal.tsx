/**
 * Confirmation Modal Component
 * 
 * Enterprise-grade modal dialog for critical confirmations with multiple
 * verification methods and comprehensive feedback.
 * 
 * @component
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Stack,
  Alert,
  AlertTitle,
  Chip,
  IconButton,
  InputAdornment,
  Radio,
  RadioGroup,
  Fade,
  Zoom,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Lock as LockIcon,
  Fingerprint as FingerprintIcon,
  Pin as PinIcon,
  TextFields as TextIcon,
  Timer as TimerIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

// Types
export enum ConfirmationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ConfirmationMethod {
  SIMPLE_CONFIRM = 'simpleConfirm',
  TYPE_TEXT = 'typeText',
  CHECKBOX = 'checkbox',
  PIN = 'pin',
  HOLD_BUTTON = 'holdButton',
  MULTIPLE_CHOICE = 'multipleChoice',
  BIOMETRIC = 'biometric',
  TWO_FACTOR = 'twoFactor',
}

export interface ConfirmationRequirement {
  method: ConfirmationMethod;
  config?: {
    text?: string; // For TYPE_TEXT
    pin?: string; // For PIN
    holdDuration?: number; // For HOLD_BUTTON (ms)
    options?: string[]; // For MULTIPLE_CHOICE
    correctAnswer?: string; // For MULTIPLE_CHOICE
    checkboxLabel?: string; // For CHECKBOX
  };
}

export interface ConfirmationModalProps {
  /**
   * Whether the modal is open
   */
  open: boolean;
  /**
   * Modal title
   */
  title: string;
  /**
   * Modal message/content
   */
  message: string;
  /**
   * Additional details (optional)
   */
  details?: string;
  /**
   * Severity level
   */
  severity: ConfirmationSeverity;
  /**
   * Confirmation requirements
   */
  requirements: ConfirmationRequirement[];
  /**
   * Confirm button text
   */
  confirmText?: string;
  /**
   * Cancel button text
   */
  cancelText?: string;
  /**
   * Whether to show countdown timer
   */
  showCountdown?: boolean;
  /**
   * Countdown duration in seconds
   */
  countdownDuration?: number;
  /**
   * Handler for confirmation
   */
  onConfirm: () => void | Promise<void>;
  /**
   * Handler for cancellation
   */
  onCancel: () => void;
  /**
   * Whether the action is destructive
   */
  destructive?: boolean;
  /**
   * Custom icon
   */
  icon?: React.ReactNode;
  /**
   * Whether to disable backdrop click
   */
  disableBackdropClick?: boolean;
  /**
   * Whether to disable escape key
   */
  disableEscapeKey?: boolean;
}

// Severity Configuration
const getSeverityConfig = (severity: ConfirmationSeverity, theme: any) => {
  switch (severity) {
    case ConfirmationSeverity.LOW:
      return {
        color: theme.palette.info.main,
        icon: <InfoIcon />,
        title: 'Confirmation Required',
      };
    case ConfirmationSeverity.MEDIUM:
      return {
        color: theme.palette.warning.main,
        icon: <WarningIcon />,
        title: 'Important Confirmation',
      };
    case ConfirmationSeverity.HIGH:
      return {
        color: theme.palette.error.main,
        icon: <ErrorIcon />,
        title: 'Critical Confirmation',
      };
    case ConfirmationSeverity.CRITICAL:
      return {
        color: '#ff0000',
        icon: <ErrorIcon />,
        title: 'CRITICAL ACTION',
      };
  }
};

// Confirmation Method Components
const ConfirmationMethodComponent: React.FC<{
  requirement: ConfirmationRequirement;
  completed: boolean;
  onComplete: (success: boolean) => void;
}> = ({ requirement, completed, onComplete }) => {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<NodeJS.Timeout>();
  const holdStartRef = useRef<number>();

  // Handle hold button
  const handleHoldStart = useCallback(() => {
    setHolding(true);
    holdStartRef.current = Date.now();
    
    const duration = requirement.config?.holdDuration || 3000;
    const updateInterval = 50;
    
    holdTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - holdStartRef.current!;
      const progress = Math.min((elapsed / duration) * 100, 100);
      setHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(holdTimerRef.current);
        onComplete(true);
      }
    }, updateInterval);
  }, [requirement.config?.holdDuration, onComplete]);

  const handleHoldEnd = useCallback(() => {
    setHolding(false);
    setHoldProgress(0);
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearInterval(holdTimerRef.current);
      }
    };
  }, []);

  // Render based on method
  switch (requirement.method) {
    case ConfirmationMethod.TYPE_TEXT:
      return (
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Type the following text to confirm: <strong>{requirement.config?.text}</strong>
          </Typography>
          <TextField
            fullWidth
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onComplete(e.target.value === requirement.config?.text);
            }}
            placeholder="Type here..."
            disabled={completed}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <TextIcon />
                </InputAdornment>
              ),
              endAdornment: completed && (
                <InputAdornment position="end">
                  <CheckCircleIcon color="success" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      );

    case ConfirmationMethod.CHECKBOX:
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={completed}
              onChange={(e) => onComplete(e.target.checked)}
              color="primary"
            />
          }
          label={requirement.config?.checkboxLabel || 'I understand and confirm this action'}
        />
      );

    case ConfirmationMethod.PIN:
      return (
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Enter your PIN to confirm
          </Typography>
          <TextField
            fullWidth
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (e.target.value.length === requirement.config?.pin?.length) {
                onComplete(e.target.value === requirement.config?.pin);
              }
            }}
            placeholder="Enter PIN"
            disabled={completed}
            inputProps={{
              maxLength: requirement.config?.pin?.length || 4,
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PinIcon />
                </InputAdornment>
              ),
              endAdornment: completed && (
                <InputAdornment position="end">
                  <CheckCircleIcon color="success" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      );

    case ConfirmationMethod.HOLD_BUTTON:
      return (
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Hold the button for {(requirement.config?.holdDuration || 3000) / 1000} seconds to confirm
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color={completed ? 'success' : 'primary'}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={handleHoldEnd}
            onTouchStart={handleHoldStart}
            onTouchEnd={handleHoldEnd}
            disabled={completed}
            startIcon={<TimerIcon />}
            sx={{ position: 'relative', overflow: 'hidden' }}
          >
            {completed ? 'Confirmed' : holding ? 'Keep holding...' : 'Hold to confirm'}
            {holding && (
              <LinearProgress
                variant="determinate"
                value={holdProgress}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                }}
              />
            )}
          </Button>
        </Box>
      );

    case ConfirmationMethod.MULTIPLE_CHOICE:
      return (
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Select the correct option to confirm
          </Typography>
          <RadioGroup
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onComplete(e.target.value === requirement.config?.correctAnswer);
            }}
          >
            {requirement.config?.options?.map((option) => (
              <FormControlLabel
                key={option}
                value={option}
                control={<Radio />}
                label={option}
                disabled={completed}
              />
            ))}
          </RadioGroup>
        </Box>
      );

    case ConfirmationMethod.BIOMETRIC:
      return (
        <Box sx={{ textAlign: 'center' }}>
          <IconButton
            size="large"
            color={completed ? 'success' : 'primary'}
            onClick={() => {
              // Simulate biometric authentication
              setTimeout(() => onComplete(true), 1000);
            }}
            disabled={completed}
            sx={{
              border: 2,
              borderColor: completed ? 'success.main' : 'primary.main',
              p: 3,
            }}
          >
            <FingerprintIcon sx={{ fontSize: 48 }} />
          </IconButton>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {completed ? 'Authenticated' : 'Touch to authenticate with biometrics'}
          </Typography>
        </Box>
      );

    case ConfirmationMethod.TWO_FACTOR:
      return (
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Enter your 2FA code
          </Typography>
          <TextField
            fullWidth
            value={value}
            onChange={(e) => {
              const code = e.target.value.replace(/\D/g, '');
              setValue(code);
              if (code.length === 6) {
                // Simulate 2FA verification
                onComplete(true);
              }
            }}
            placeholder="000000"
            disabled={completed}
            inputProps={{
              maxLength: 6,
              pattern: '[0-9]*',
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SecurityIcon />
                </InputAdornment>
              ),
              endAdornment: completed && (
                <InputAdornment position="end">
                  <CheckCircleIcon color="success" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      );

    default:
      return null;
  }
};

// Main Component
export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  open,
  title,
  message,
  details,
  severity,
  requirements,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  showCountdown = false,
  countdownDuration = 10,
  onConfirm,
  onCancel,
  destructive = false,
  icon,
  disableBackdropClick = false,
  disableEscapeKey = false,
}) => {
  const theme = useTheme();
  const [completedRequirements, setCompletedRequirements] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [countdown, setCountdown] = useState(countdownDuration);
  const countdownRef = useRef<NodeJS.Timeout>();

  const severityConfig = getSeverityConfig(severity, theme);
  const allRequirementsMet = completedRequirements.size === requirements.length;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setCompletedRequirements(new Set());
      setConfirming(false);
      setCountdown(countdownDuration);
    }
  }, [open, countdownDuration]);

  // Countdown timer
  useEffect(() => {
    if (open && showCountdown && countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      onCancel();
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [open, showCountdown, countdown, onCancel]);

  // Handle requirement completion
  const handleRequirementComplete = useCallback((index: number, success: boolean) => {
    setCompletedRequirements(prev => {
      const next = new Set(prev);
      if (success) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }, []);

  // Handle confirmation
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Confirmation error:', error);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick' && disableBackdropClick) return;
        if (reason === 'escapeKeyDown' && disableEscapeKey) return;
        onCancel();
      }}
      maxWidth="sm"
      fullWidth
      TransitionComponent={Zoom}
      PaperProps={{
        sx: {
          borderTop: `4px solid ${severityConfig.color}`,
          overflow: 'visible',
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ color: severityConfig.color }}>
            {icon || severityConfig.icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{title || severityConfig.title}</Typography>
            {showCountdown && (
              <Chip
                label={`Auto-cancel in ${countdown}s`}
                size="small"
                color="warning"
                sx={{ mt: 0.5 }}
              />
            )}
          </Box>
          <IconButton onClick={onCancel} disabled={confirming}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Message */}
          <Alert 
            severity={severity === ConfirmationSeverity.CRITICAL ? 'error' : 'warning'}
            sx={{
              backgroundColor: alpha(severityConfig.color, 0.1),
              color: theme.palette.text.primary,
              '& .MuiAlert-icon': {
                color: severityConfig.color,
              },
            }}
          >
            <AlertTitle>Action Required</AlertTitle>
            {message}
          </Alert>

          {/* Details */}
          {details && (
            <Box
              sx={{
                p: 2,
                backgroundColor: alpha(theme.palette.action.hover, 0.5),
                borderRadius: 1,
                borderLeft: `3px solid ${severityConfig.color}`,
              }}
            >
              <Typography variant="body2">{details}</Typography>
            </Box>
          )}

          {/* Requirements */}
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="textSecondary">
              Complete the following to confirm:
            </Typography>
            {requirements.map((req, index) => (
              <Fade
                key={index}
                in={true}
                timeout={300 * (index + 1)}
              >
                <Box
                  sx={{
                    p: 2,
                    border: `1px solid ${
                      completedRequirements.has(index)
                        ? theme.palette.success.main
                        : theme.palette.divider
                    }`,
                    borderRadius: 1,
                    backgroundColor: completedRequirements.has(index)
                      ? alpha(theme.palette.success.main, 0.05)
                      : 'transparent',
                  }}
                >
                  <ConfirmationMethodComponent
                    requirement={req}
                    completed={completedRequirements.has(index)}
                    onComplete={(success) => handleRequirementComplete(index, success)}
                  />
                </Box>
              </Fade>
            ))}
          </Stack>

          {/* Progress */}
          <Box>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="caption" color="textSecondary">
                Requirements completed
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {completedRequirements.size} / {requirements.length}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={(completedRequirements.size / requirements.length) * 100}
              sx={{
                height: 8,
                borderRadius: 4,
                backgroundColor: alpha(theme.palette.action.hover, 0.3),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  backgroundColor: 
                    completedRequirements.size === requirements.length
                      ? theme.palette.success.main
                      : theme.palette.primary.main,
                },
              }}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button
          onClick={onCancel}
          disabled={confirming}
          color="inherit"
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!allRequirementsMet || confirming}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          sx={{
            minWidth: 120,
            position: 'relative',
          }}
        >
          {confirming ? 'Confirming...' : confirmText}
          {confirming && (
            <LinearProgress
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
              }}
            />
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationModal;