/**
 * Emergency Stop Button Component
 * 
 * Safety-critical interface component following ISO/IEC 61508 and IEC 62061 standards
 * for emergency stop functionality in the rover mission control system.
 * 
 * Design principles:
 * - High visibility and contrast (red button with yellow background)
 * - Large target area for quick activation
 * - Multiple activation methods (click, keyboard, touch)
 * - Clear visual states and feedback
 * - Confirmation for deactivation to prevent accidental reset
 * - Accessibility compliant (WCAG 2.1 AA)
 * 
 * @module EmergencyStopButton
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Alert,
  AlertTitle,
  Backdrop,
  Fade,
  useTheme,
  useMediaQuery,
  alpha,
  keyframes,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Stop as StopIcon,
  Emergency as EmergencyIcon,
  PanTool as PanToolIcon,
} from '@mui/icons-material';
import EmergencyStopConfirmation, {
  ConfirmationMethod,
  SecurityLevel,
  SystemState,
  ConfirmationConfig,
  AuditEvent,
} from './EmergencyStopConfirmation';

// Animation keyframes for visual prominence
const pulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 15px rgba(255, 0, 0, 0);
    transform: scale(1.05);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 0, 0, 0);
    transform: scale(1);
  }
`;

const emergencyFlash = keyframes`
  0%, 100% {
    background-color: #FF0000;
  }
  50% {
    background-color: #DC143C;
  }
`;

const warningStripe = keyframes`
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 40px 40px;
  }
`;

interface EmergencyStopButtonProps {
  /** Current state of the emergency stop */
  isActivated: boolean;
  /** Callback when emergency stop is triggered */
  onActivate: () => void | Promise<void>;
  /** Callback when emergency stop is cleared */
  onDeactivate: () => void | Promise<void>;
  /** Optional label text (defaults to "EMERGENCY STOP") */
  label?: string;
  /** Size variant for different screen sizes */
  size?: 'small' | 'medium' | 'large';
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Position on screen (for fixed positioning) */
  position?: {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
  };
  /** Whether to show the button in a fixed position */
  fixed?: boolean;
  /** Additional safety confirmation required */
  requireDoubleConfirmation?: boolean;
  /** Sound alert on activation */
  enableSound?: boolean;
  /** Vibration feedback on mobile devices */
  enableVibration?: boolean;
  /** System state for confirmation requirements */
  systemState?: SystemState;
  /** Confirmation configuration */
  confirmationConfig?: ConfirmationConfig;
  /** User ID for audit trail */
  userId?: string;
  /** Callback for audit events */
  onAuditEvent?: (event: AuditEvent) => void;
}

const EmergencyStopButton: React.FC<EmergencyStopButtonProps> = ({
  isActivated,
  onActivate,
  onDeactivate,
  label = 'EMERGENCY STOP',
  size = 'large',
  disabled = false,
  position = { top: 20, right: 20 },
  fixed = true,
  requireDoubleConfirmation = false,
  enableSound = true,
  enableVibration = true,
  systemState = SystemState.NORMAL,
  confirmationConfig = {
    method: ConfirmationMethod.HOLD_TO_CONFIRM,
    securityLevel: SecurityLevel.MEDIUM,
    doubleTapTimeout: 500,
    holdDuration: 2000,
    gestureComplexity: 3,
    requireTwoPerson: false,
    allowBypass: false,
    auditingEnabled: true,
  },
  userId = 'default-user',
  onAuditEvent,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [deactivateConfirmed, setDeactivateConfirmed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showActivatedOverlay, setShowActivatedOverlay] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Initialize audio for emergency sound
  useEffect(() => {
    if (enableSound && typeof window !== 'undefined') {
      // Create a simple beep sound using Web Audio API
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';
        gainNode.gain.value = 0;
        
        // Store audio context for later use
        (audioRef as any).current = { audioContext, oscillator, gainNode };
      }
    }
  }, [enableSound]);

  // Play emergency sound
  const playEmergencySound = useCallback(() => {
    if (enableSound && (audioRef as any).current) {
      const { audioContext, gainNode } = (audioRef as any).current;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    }
  }, [enableSound]);

  // Trigger vibration on mobile devices
  const triggerVibration = useCallback(() => {
    if (enableVibration && 'vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, [enableVibration]);

  // Handle emergency stop activation
  const handleActivate = async () => {
    if (disabled || isActivated) return;

    // Use advanced confirmation system if configured
    if (confirmationConfig.method !== ConfirmationMethod.NONE && 
        systemState !== SystemState.CRITICAL_FAILURE) {
      setShowConfirmation(true);
      return;
    }

    // Direct activation for critical failures or no confirmation
    setIsProcessing(true);
    playEmergencySound();
    triggerVibration();
    setShowActivatedOverlay(true);

    try {
      await onActivate();
    } catch (error) {
      console.error('Failed to activate emergency stop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle confirmation complete
  const handleConfirmationComplete = async (auditEvent: AuditEvent) => {
    setShowConfirmation(false);
    
    if (onAuditEvent) {
      onAuditEvent(auditEvent);
    }

    setIsProcessing(true);
    playEmergencySound();
    triggerVibration();
    setShowActivatedOverlay(true);

    try {
      await onActivate();
    } catch (error) {
      console.error('Failed to activate emergency stop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle emergency stop deactivation
  const handleDeactivate = async () => {
    if (!deactivateConfirmed) return;

    setIsProcessing(true);
    try {
      await onDeactivate();
      setShowDeactivateDialog(false);
      setDeactivateConfirmed(false);
      setShowActivatedOverlay(false);
    } catch (error) {
      console.error('Failed to deactivate emergency stop:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + Space for emergency stop
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'Space') {
        event.preventDefault();
        if (!isActivated && !disabled) {
          handleActivate();
        }
      }
      // ESC key for quick access
      if (event.key === 'Escape' && event.shiftKey) {
        event.preventDefault();
        if (!isActivated && !disabled) {
          handleActivate();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActivated, disabled]);

  // Button size configurations
  const sizeConfig = {
    small: {
      width: 120,
      height: 80,
      fontSize: '0.875rem',
      iconSize: 24,
    },
    medium: {
      width: 160,
      height: 100,
      fontSize: '1rem',
      iconSize: 32,
    },
    large: {
      width: 200,
      height: 120,
      fontSize: '1.125rem',
      iconSize: 40,
    },
  };

  const currentSize = sizeConfig[isMobile ? 'medium' : size];

  return (
    <>
      <Box
        sx={{
          ...(fixed && {
            position: 'fixed',
            ...position,
            zIndex: theme.zIndex.modal + 100,
          }),
        }}
      >
        <Button
          ref={buttonRef}
          onClick={isActivated ? () => setShowDeactivateDialog(true) : handleActivate}
          disabled={disabled || isProcessing}
          aria-label={isActivated ? 'Clear emergency stop' : 'Activate emergency stop'}
          aria-pressed={isActivated}
          aria-describedby="emergency-stop-description"
          sx={{
            width: currentSize.width,
            height: currentSize.height,
            borderRadius: 2,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            animation: !isActivated && !disabled ? `${pulse} 2s infinite` : 'none',
            
            // Base styling
            backgroundColor: isActivated ? '#FF0000' : '#DC143C',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: currentSize.fontSize,
            textTransform: 'uppercase',
            letterSpacing: 1,
            
            // Border and shadow for prominence
            border: `4px solid ${isActivated ? '#8B0000' : '#FF0000'}`,
            boxShadow: isActivated
              ? `0 0 20px rgba(255, 0, 0, 0.8), inset 0 0 20px rgba(0, 0, 0, 0.3)`
              : `0 4px 20px rgba(255, 0, 0, 0.5), 0 0 40px rgba(255, 0, 0, 0.3)`,
            
            '&:hover': {
              backgroundColor: isActivated ? '#CC0000' : '#FF0000',
              boxShadow: isActivated
                ? `0 0 30px rgba(255, 0, 0, 0.9), inset 0 0 20px rgba(0, 0, 0, 0.3)`
                : `0 4px 30px rgba(255, 0, 0, 0.7), 0 0 60px rgba(255, 0, 0, 0.5)`,
              transform: 'scale(1.05)',
            },
            
            '&:active': {
              transform: 'scale(0.98)',
              boxShadow: 'inset 0 4px 20px rgba(0, 0, 0, 0.5)',
            },
            
            '&:focus': {
              outline: `4px solid ${theme.palette.warning.main}`,
              outlineOffset: 4,
            },
            
            '&:disabled': {
              backgroundColor: alpha(theme.palette.error.main, 0.3),
              color: alpha(theme.palette.common.white, 0.5),
              border: `4px solid ${alpha(theme.palette.error.dark, 0.3)}`,
              boxShadow: 'none',
            },
            
            // Warning stripes for activated state
            ...(isActivated && {
              background: `
                repeating-linear-gradient(
                  45deg,
                  #FF0000,
                  #FF0000 10px,
                  #FFFF00 10px,
                  #FFFF00 20px
                )
              `,
              animation: `${warningStripe} 1s linear infinite, ${emergencyFlash} 0.5s ease infinite`,
            }),
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
            }}
          >
            {isActivated ? (
              <PanToolIcon sx={{ fontSize: currentSize.iconSize }} />
            ) : (
              <StopIcon sx={{ fontSize: currentSize.iconSize }} />
            )}
            <Typography
              variant="button"
              sx={{
                fontSize: currentSize.fontSize,
                lineHeight: 1.2,
                textAlign: 'center',
              }}
            >
              {isActivated ? 'STOP ACTIVE' : label}
            </Typography>
          </Box>
        </Button>
        
        {/* Accessibility description */}
        <Typography
          id="emergency-stop-description"
          sx={{ position: 'absolute', left: -9999, width: 1 }}
        >
          Emergency stop button. Press Ctrl+Shift+Space or Shift+Escape to activate.
          {isActivated ? ' Emergency stop is currently active.' : ''}
        </Typography>
      </Box>

      {/* Activated overlay for visual feedback */}
      <Backdrop
        open={showActivatedOverlay && isActivated}
        sx={{
          zIndex: theme.zIndex.modal + 50,
          backgroundColor: alpha(theme.palette.error.main, 0.2),
        }}
      />

      {/* Advanced Confirmation Dialog */}
      {showConfirmation && (
        <EmergencyStopConfirmation
          onConfirm={handleConfirmationComplete}
          onCancel={() => setShowConfirmation(false)}
          systemState={systemState}
          config={confirmationConfig}
          userId={userId}
          onAuditEvent={onAuditEvent}
        />
      )}

      {/* Deactivation confirmation dialog */}
      <Dialog
        open={showDeactivateDialog}
        onClose={() => {
          setShowDeactivateDialog(false);
          setDeactivateConfirmed(false);
        }}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 300 }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" fontSize="large" />
            <Typography variant="h6">Clear Emergency Stop?</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <AlertTitle>Safety Verification Required</AlertTitle>
            Before clearing the emergency stop, ensure:
          </Alert>
          
          <Box component="ul" sx={{ pl: 2 }}>
            <Typography component="li" variant="body2" gutterBottom>
              All rover systems are in a safe state
            </Typography>
            <Typography component="li" variant="body2" gutterBottom>
              The cause of the emergency has been resolved
            </Typography>
            <Typography component="li" variant="body2" gutterBottom>
              All team members have been notified
            </Typography>
            <Typography component="li" variant="body2" gutterBottom>
              System diagnostics show normal operation
            </Typography>
          </Box>
          
          {requireDoubleConfirmation && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                Type "CONFIRM CLEAR" to proceed with deactivation:
              </Typography>
              <input
                type="text"
                onChange={(e) => setDeactivateConfirmed(e.target.value === 'CONFIRM CLEAR')}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: '8px',
                  fontSize: '14px',
                  border: '2px solid #ff0000',
                  borderRadius: '4px',
                }}
                placeholder="Type CONFIRM CLEAR"
              />
            </Alert>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button
            onClick={() => {
              setShowDeactivateDialog(false);
              setDeactivateConfirmed(false);
            }}
            color="inherit"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeactivate}
            color="success"
            variant="contained"
            disabled={requireDoubleConfirmation ? !deactivateConfirmed : false}
            startIcon={<EmergencyIcon />}
          >
            Clear Emergency Stop
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default EmergencyStopButton;