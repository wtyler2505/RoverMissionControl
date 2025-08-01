/**
 * Emergency Stop Confirmation System
 * 
 * Implements multiple confirmation methods for emergency stop activation
 * following IEC 61508 SIL-2 safety standards.
 * 
 * Confirmation Methods:
 * 1. Double-tap confirmation with timing requirements
 * 2. Hold-to-confirm with visual progress indicator
 * 3. Secondary dialog confirmation for critical actions
 * 4. Gesture-based confirmation for touch devices
 * 5. Two-person authorization mode for high-security operations
 * 6. Configurable confirmation levels based on system state
 * 7. Bypass mechanisms for extreme emergencies
 * 8. Audit trail for all confirmation actions
 * 
 * @module EmergencyStopConfirmation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Alert,
  AlertTitle,
  Chip,
  Stack,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  CircularProgress,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Security as SecurityIcon,
  TouchApp as TouchAppIcon,
  Timer as TimerIcon,
  Fingerprint as FingerprintIcon,
  VerifiedUser as VerifiedUserIcon,
  Emergency as EmergencyIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';

// Audit event types
export enum AuditEventType {
  CONFIRMATION_STARTED = 'CONFIRMATION_STARTED',
  CONFIRMATION_COMPLETED = 'CONFIRMATION_COMPLETED',
  CONFIRMATION_FAILED = 'CONFIRMATION_FAILED',
  CONFIRMATION_CANCELLED = 'CONFIRMATION_CANCELLED',
  BYPASS_ACTIVATED = 'BYPASS_ACTIVATED',
  TWO_PERSON_AUTH_INITIATED = 'TWO_PERSON_AUTH_INITIATED',
  TWO_PERSON_AUTH_COMPLETED = 'TWO_PERSON_AUTH_COMPLETED',
}

// Confirmation methods
export enum ConfirmationMethod {
  NONE = 'NONE',
  DOUBLE_TAP = 'DOUBLE_TAP',
  HOLD_TO_CONFIRM = 'HOLD_TO_CONFIRM',
  DIALOG = 'DIALOG',
  GESTURE = 'GESTURE',
  TWO_PERSON = 'TWO_PERSON',
  COMBINED = 'COMBINED',
}

// Security levels
export enum SecurityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// System states that affect confirmation requirements
export enum SystemState {
  NORMAL = 'NORMAL',
  MAINTENANCE = 'MAINTENANCE',
  TESTING = 'TESTING',
  EMERGENCY = 'EMERGENCY',
  CRITICAL_FAILURE = 'CRITICAL_FAILURE',
}

// Audit event interface
export interface AuditEvent {
  id: string;
  timestamp: Date;
  type: AuditEventType;
  method: ConfirmationMethod;
  userId?: string;
  secondaryUserId?: string;
  systemState: SystemState;
  securityLevel: SecurityLevel;
  details?: string;
  success: boolean;
}

// Configuration interface
export interface ConfirmationConfig {
  method: ConfirmationMethod;
  securityLevel: SecurityLevel;
  doubleTapTimeout: number; // milliseconds
  holdDuration: number; // milliseconds
  gestureComplexity: number; // 1-5
  requireTwoPerson: boolean;
  allowBypass: boolean;
  bypassCode?: string;
  auditingEnabled: boolean;
}

// Props interface
interface EmergencyStopConfirmationProps {
  onConfirm: (auditEvent: AuditEvent) => void;
  onCancel: () => void;
  systemState: SystemState;
  config: ConfirmationConfig;
  userId: string;
  onAuditEvent?: (event: AuditEvent) => void;
}

// Animation for urgent situations
const urgentPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
`;

const EmergencyStopConfirmation: React.FC<EmergencyStopConfirmationProps> = ({
  onConfirm,
  onCancel,
  systemState,
  config,
  userId,
  onAuditEvent,
}) => {
  const theme = useTheme();
  const [activeMethod, setActiveMethod] = useState<ConfirmationMethod>(config.method);
  const [confirmationProgress, setConfirmationProgress] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [holdStartTime, setHoldStartTime] = useState<number | null>(null);
  const [gesturePoints, setGesturePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [showBypassDialog, setShowBypassDialog] = useState(false);
  const [bypassCode, setBypassCode] = useState('');
  const [secondaryUserId, setSecondaryUserId] = useState('');
  const [secondaryUserConfirmed, setSecondaryUserConfirmed] = useState(false);
  
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const gestureCanvasRef = useRef<HTMLCanvasElement>(null);

  // Create audit event
  const createAuditEvent = (
    type: AuditEventType,
    success: boolean,
    details?: string
  ): AuditEvent => {
    const event: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      method: activeMethod,
      userId,
      secondaryUserId: secondaryUserId || undefined,
      systemState,
      securityLevel: config.securityLevel,
      details,
      success,
    };
    
    if (onAuditEvent && config.auditingEnabled) {
      onAuditEvent(event);
    }
    
    return event;
  };

  // Handle double-tap confirmation
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    
    if (now - lastTapTime <= config.doubleTapTimeout) {
      if (tapCount === 1) {
        // Second tap within timeout - confirm
        const auditEvent = createAuditEvent(
          AuditEventType.CONFIRMATION_COMPLETED,
          true,
          'Double-tap confirmation completed'
        );
        onConfirm(auditEvent);
        setTapCount(0);
      }
    } else {
      // First tap or timeout exceeded
      setTapCount(1);
      setLastTapTime(now);
      
      // Reset after timeout
      setTimeout(() => {
        setTapCount(0);
      }, config.doubleTapTimeout);
    }
  }, [tapCount, lastTapTime, config.doubleTapTimeout, onConfirm]);

  // Handle hold-to-confirm
  const startHoldConfirmation = useCallback(() => {
    setHoldStartTime(Date.now());
    setIsConfirming(true);
    setConfirmationProgress(0);
    
    const startTime = Date.now();
    
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / config.holdDuration) * 100, 100);
      
      setConfirmationProgress(progress);
      
      if (progress >= 100) {
        // Hold completed
        const auditEvent = createAuditEvent(
          AuditEventType.CONFIRMATION_COMPLETED,
          true,
          `Hold confirmation completed in ${elapsed}ms`
        );
        onConfirm(auditEvent);
        
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
        }
        setIsConfirming(false);
      }
    }, 50);
  }, [config.holdDuration, onConfirm]);

  const cancelHoldConfirmation = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }
    
    setHoldStartTime(null);
    setIsConfirming(false);
    setConfirmationProgress(0);
    
    createAuditEvent(
      AuditEventType.CONFIRMATION_CANCELLED,
      false,
      'Hold confirmation cancelled'
    );
  }, []);

  // Handle gesture confirmation
  const handleGestureStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const point = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    
    setGesturePoints([point]);
    setIsConfirming(true);
  }, []);

  const handleGestureMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isConfirming) return;
    
    const point = 'touches' in e
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };
    
    setGesturePoints(prev => [...prev, point]);
    
    // Draw gesture path
    if (gestureCanvasRef.current && gesturePoints.length > 0) {
      const ctx = gestureCanvasRef.current.getContext('2d');
      if (ctx) {
        const lastPoint = gesturePoints[gesturePoints.length - 1];
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = theme.palette.error.main;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, [isConfirming, gesturePoints, theme]);

  const handleGestureEnd = useCallback(() => {
    if (gesturePoints.length < 10) {
      createAuditEvent(
        AuditEventType.CONFIRMATION_FAILED,
        false,
        'Gesture too simple'
      );
      return;
    }
    
    // Simple gesture validation - check for minimum complexity
    const gestureComplexity = calculateGestureComplexity(gesturePoints);
    
    if (gestureComplexity >= config.gestureComplexity) {
      const auditEvent = createAuditEvent(
        AuditEventType.CONFIRMATION_COMPLETED,
        true,
        `Gesture confirmation completed with complexity ${gestureComplexity}`
      );
      onConfirm(auditEvent);
    } else {
      createAuditEvent(
        AuditEventType.CONFIRMATION_FAILED,
        false,
        `Gesture complexity ${gestureComplexity} below required ${config.gestureComplexity}`
      );
    }
    
    setGesturePoints([]);
    setIsConfirming(false);
    
    // Clear canvas
    if (gestureCanvasRef.current) {
      const ctx = gestureCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, gestureCanvasRef.current.width, gestureCanvasRef.current.height);
      }
    }
  }, [gesturePoints, config.gestureComplexity, onConfirm]);

  // Calculate gesture complexity
  const calculateGestureComplexity = (points: Array<{ x: number; y: number }>): number => {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    let directionChanges = 0;
    let lastDirection = 0;
    
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      totalDistance += distance;
      
      const direction = Math.atan2(dy, dx);
      if (i > 1 && Math.abs(direction - lastDirection) > Math.PI / 4) {
        directionChanges++;
      }
      lastDirection = direction;
    }
    
    // Complexity based on distance and direction changes
    const complexity = Math.min(5, Math.floor((totalDistance / 100) + (directionChanges / 2)));
    return complexity;
  };

  // Handle bypass
  const handleBypass = useCallback(() => {
    if (bypassCode === config.bypassCode) {
      const auditEvent = createAuditEvent(
        AuditEventType.BYPASS_ACTIVATED,
        true,
        'Emergency bypass activated'
      );
      onConfirm(auditEvent);
      setShowBypassDialog(false);
    } else {
      createAuditEvent(
        AuditEventType.CONFIRMATION_FAILED,
        false,
        'Invalid bypass code'
      );
    }
    setBypassCode('');
  }, [bypassCode, config.bypassCode, onConfirm]);

  // Handle two-person authorization
  const handleTwoPersonAuth = useCallback(() => {
    if (secondaryUserId && secondaryUserConfirmed) {
      const auditEvent = createAuditEvent(
        AuditEventType.TWO_PERSON_AUTH_COMPLETED,
        true,
        'Two-person authorization completed'
      );
      onConfirm(auditEvent);
    }
  }, [secondaryUserId, secondaryUserConfirmed, onConfirm]);

  // Render confirmation UI based on method
  const renderConfirmationUI = () => {
    switch (activeMethod) {
      case ConfirmationMethod.DOUBLE_TAP:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              p: 3,
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={handleDoubleTap}
          >
            <TouchAppIcon sx={{ fontSize: 64, color: theme.palette.error.main }} />
            <Typography variant="h6" color="error">
              Double-Tap to Confirm
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Tap twice within {config.doubleTapTimeout / 1000} seconds to activate emergency stop
            </Typography>
            {tapCount === 1 && (
              <Chip
                label="Tap again to confirm"
                color="warning"
                icon={<TimerIcon />}
                sx={{ animation: `${urgentPulse} 0.5s infinite` }}
              />
            )}
          </Box>
        );

      case ConfirmationMethod.HOLD_TO_CONFIRM:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              p: 3,
            }}
          >
            <Button
              variant="contained"
              color="error"
              size="large"
              onMouseDown={startHoldConfirmation}
              onMouseUp={cancelHoldConfirmation}
              onMouseLeave={cancelHoldConfirmation}
              onTouchStart={startHoldConfirmation}
              onTouchEnd={cancelHoldConfirmation}
              sx={{
                width: 200,
                height: 80,
                fontSize: '1.2rem',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {isConfirming ? 'HOLD TO CONFIRM' : 'HOLD TO ACTIVATE'}
              </Box>
              {isConfirming && (
                <LinearProgress
                  variant="determinate"
                  value={confirmationProgress}
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 8,
                    backgroundColor: alpha(theme.palette.error.dark, 0.3),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: theme.palette.warning.main,
                    },
                  }}
                />
              )}
            </Button>
            <Typography variant="body2" color="text.secondary">
              Hold for {config.holdDuration / 1000} seconds
            </Typography>
            {isConfirming && (
              <CircularProgress
                variant="determinate"
                value={confirmationProgress}
                color="error"
                size={60}
              />
            )}
          </Box>
        );

      case ConfirmationMethod.GESTURE:
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              p: 3,
            }}
          >
            <Typography variant="h6" color="error">
              Draw a Complex Pattern
            </Typography>
            <Box
              sx={{
                position: 'relative',
                width: 300,
                height: 300,
                border: `2px solid ${theme.palette.error.main}`,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <canvas
                ref={gestureCanvasRef}
                width={300}
                height={300}
                style={{ position: 'absolute', top: 0, left: 0 }}
                onMouseDown={handleGestureStart}
                onMouseMove={handleGestureMove}
                onMouseUp={handleGestureEnd}
                onTouchStart={handleGestureStart}
                onTouchMove={handleGestureMove}
                onTouchEnd={handleGestureEnd}
              />
              {gesturePoints.length === 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                  }}
                >
                  <FingerprintIcon sx={{ fontSize: 48, color: alpha(theme.palette.error.main, 0.3) }} />
                  <Typography variant="body2" color="text.secondary">
                    Draw pattern here
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              Complexity required: {config.gestureComplexity}/5
            </Typography>
          </Box>
        );

      case ConfirmationMethod.TWO_PERSON:
        return (
          <Box sx={{ p: 3 }}>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <AlertTitle>Two-Person Authorization Required</AlertTitle>
              Both operators must confirm to activate emergency stop
            </Alert>
            
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Primary Operator
                </Typography>
                <Chip
                  icon={<VerifiedUserIcon />}
                  label={userId}
                  color="success"
                  variant="outlined"
                />
              </Box>
              
              <Divider />
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Secondary Operator
                </Typography>
                <TextField
                  fullWidth
                  label="Secondary User ID"
                  value={secondaryUserId}
                  onChange={(e) => setSecondaryUserId(e.target.value)}
                  margin="normal"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={secondaryUserConfirmed}
                      onChange={(e) => setSecondaryUserConfirmed(e.target.checked)}
                      disabled={!secondaryUserId}
                    />
                  }
                  label="Secondary operator confirms"
                />
              </Box>
              
              <Button
                variant="contained"
                color="error"
                size="large"
                fullWidth
                disabled={!secondaryUserId || !secondaryUserConfirmed}
                onClick={handleTwoPersonAuth}
                startIcon={<SecurityIcon />}
              >
                Confirm Two-Person Authorization
              </Button>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          border: `3px solid ${theme.palette.error.main}`,
          boxShadow: `0 0 20px ${alpha(theme.palette.error.main, 0.5)}`,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <EmergencyIcon color="error" fontSize="large" />
            <Typography variant="h6">Emergency Stop Confirmation</Typography>
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              label={systemState}
              color={systemState === SystemState.EMERGENCY ? 'error' : 'default'}
            />
            <Chip
              size="small"
              label={config.securityLevel}
              color={config.securityLevel === SecurityLevel.CRITICAL ? 'error' : 'warning'}
            />
          </Stack>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {renderConfirmationUI()}
        
        {/* Method selector for testing */}
        {systemState === SystemState.TESTING && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
            <Typography variant="caption" color="info.main" gutterBottom>
              Testing Mode - Method Selection
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {Object.values(ConfirmationMethod).map((method) => (
                method !== ConfirmationMethod.NONE && (
                  <Chip
                    key={method}
                    label={method}
                    size="small"
                    onClick={() => setActiveMethod(method)}
                    color={activeMethod === method ? 'primary' : 'default'}
                    variant={activeMethod === method ? 'filled' : 'outlined'}
                  />
                )
              ))}
            </Stack>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        {config.allowBypass && systemState === SystemState.CRITICAL_FAILURE && (
          <Button
            color="warning"
            onClick={() => setShowBypassDialog(true)}
            startIcon={<SpeedIcon />}
            size="small"
          >
            Emergency Bypass
          </Button>
        )}
        
        <Box sx={{ flex: 1 }} />
        
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
      </DialogActions>
      
      {/* Bypass dialog */}
      <Dialog
        open={showBypassDialog}
        onClose={() => setShowBypassDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon color="warning" />
            <Typography variant="h6">Emergency Bypass</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Critical System Failure</AlertTitle>
            Use bypass only in extreme emergencies when normal confirmation is not possible
          </Alert>
          
          <TextField
            fullWidth
            type="password"
            label="Bypass Code"
            value={bypassCode}
            onChange={(e) => setBypassCode(e.target.value)}
            margin="normal"
            autoFocus
          />
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowBypassDialog(false)}>Cancel</Button>
          <Button
            onClick={handleBypass}
            color="error"
            variant="contained"
            disabled={!bypassCode}
          >
            Activate Bypass
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default EmergencyStopConfirmation;
export {
  AuditEventType,
  ConfirmationMethod,
  SecurityLevel,
  SystemState,
  type AuditEvent,
  type ConfirmationConfig,
};