/**
 * Multi-Modal Feedback System for Emergency Stop Interface
 * 
 * Provides comprehensive feedback through visual, auditory, and haptic channels.
 * Implements enterprise-grade notification patterns for safety-critical operations.
 * 
 * @component
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Fade,
  Grow,
  Slide,
  Zoom,
  Alert,
  AlertTitle,
  Chip,
  LinearProgress,
  Button,
  useTheme,
  alpha,
  Portal,
  Collapse,
  Badge,
} from '@mui/material';
import {
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  Vibration as VibrationIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Replay as ReplayIcon,
  AccessibleForward as AccessibilityIcon,
  Language as LanguageIcon,
  Help as HelpIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  NotificationsActive as AlertIcon,
} from '@mui/icons-material';

// Types
export enum FeedbackSeverity {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

export enum FeedbackChannel {
  VISUAL = 'visual',
  AUDITORY = 'auditory',
  HAPTIC = 'haptic',
  SCREEN_READER = 'screenReader',
}

export interface FeedbackMessage {
  id: string;
  severity: FeedbackSeverity;
  title: string;
  message: string;
  timestamp: Date;
  channels: FeedbackChannel[];
  duration?: number;
  actions?: FeedbackAction[];
  expandable?: boolean;
  details?: string;
  helpLink?: string;
  soundPattern?: SoundPattern;
  hapticPattern?: HapticPattern;
  persistent?: boolean;
  requiresAcknowledgment?: boolean;
  acknowledged?: boolean;
  locale?: string;
  context?: string;
}

export interface FeedbackAction {
  id: string;
  label: string;
  handler: () => void;
  variant?: 'text' | 'outlined' | 'contained';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

export enum SoundPattern {
  SINGLE_BEEP = 'singleBeep',
  DOUBLE_BEEP = 'doubleBeep',
  TRIPLE_BEEP = 'tripleBeep',
  CONTINUOUS = 'continuous',
  SIREN = 'siren',
  CHIME = 'chime',
  WARNING = 'warning',
  SUCCESS = 'success',
  ERROR = 'error',
}

export enum HapticPattern {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  DOUBLE = 'double',
  TRIPLE = 'triple',
  CONTINUOUS = 'continuous',
  SOS = 'sos',
}

interface FeedbackSystemProps {
  /**
   * Position of the feedback container
   */
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  /**
   * Maximum number of visible notifications
   */
  maxVisible?: number;
  /**
   * Enable sound by default
   */
  enableSound?: boolean;
  /**
   * Enable haptic feedback by default
   */
  enableHaptic?: boolean;
  /**
   * Default locale for messages
   */
  defaultLocale?: string;
  /**
   * Custom sound files
   */
  soundFiles?: Record<SoundPattern, string>;
  /**
   * Callback when a message is acknowledged
   */
  onAcknowledge?: (messageId: string) => void;
  /**
   * Callback when help is requested
   */
  onHelpRequest?: (messageId: string) => void;
}

// Sound Manager
class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<SoundPattern, AudioBuffer> = new Map();
  private volume: number = 0.7;
  private enabled: boolean = true;

  constructor(soundFiles?: Record<SoundPattern, string>) {
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
      this.loadDefaultSounds();
      if (soundFiles) {
        this.loadCustomSounds(soundFiles);
      }
    }
  }

  private loadDefaultSounds() {
    // Generate default sounds programmatically
    this.generateBeep(SoundPattern.SINGLE_BEEP, 440, 0.1);
    this.generateBeep(SoundPattern.DOUBLE_BEEP, 440, 0.1, 2);
    this.generateBeep(SoundPattern.TRIPLE_BEEP, 440, 0.1, 3);
    this.generateSiren(SoundPattern.SIREN);
    this.generateChime(SoundPattern.CHIME);
    this.generateBeep(SoundPattern.WARNING, 330, 0.3);
    this.generateBeep(SoundPattern.SUCCESS, 523, 0.2);
    this.generateBeep(SoundPattern.ERROR, 220, 0.4);
  }

  private generateBeep(pattern: SoundPattern, frequency: number, duration: number, count: number = 1) {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const totalDuration = duration * count + (count - 1) * 0.1;
    const buffer = this.audioContext.createBuffer(1, totalDuration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < count; i++) {
      const startTime = i * (duration + 0.1);
      const startSample = Math.floor(startTime * sampleRate);
      const endSample = Math.floor((startTime + duration) * sampleRate);

      for (let j = startSample; j < endSample; j++) {
        const t = (j - startSample) / sampleRate;
        const envelope = Math.sin((t / duration) * Math.PI);
        data[j] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3;
      }
    }

    this.sounds.set(pattern, buffer);
  }

  private generateSiren(pattern: SoundPattern) {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 2;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const frequency = 440 + 220 * Math.sin(2 * Math.PI * 2 * t);
      data[i] = Math.sin(2 * Math.PI * frequency * t) * 0.3;
    }

    this.sounds.set(pattern, buffer);
  }

  private generateChime(pattern: SoundPattern) {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.5;
    const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    const frequencies = [523, 659, 784]; // C, E, G

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      let sample = 0;
      
      frequencies.forEach((freq, index) => {
        const delay = index * 0.1;
        if (t >= delay) {
          const envelope = Math.exp(-(t - delay) * 3);
          sample += Math.sin(2 * Math.PI * freq * (t - delay)) * envelope * 0.2;
        }
      });

      data[i] = sample;
    }

    this.sounds.set(pattern, buffer);
  }

  private async loadCustomSounds(soundFiles: Record<SoundPattern, string>) {
    // Load custom sound files
    for (const [pattern, url] of Object.entries(soundFiles)) {
      try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.sounds.set(pattern as SoundPattern, audioBuffer);
      } catch (error) {
        console.error(`Failed to load sound ${pattern}:`, error);
      }
    }
  }

  play(pattern: SoundPattern) {
    if (!this.enabled || !this.audioContext || !this.sounds.has(pattern)) return;

    const source = this.audioContext.createBufferSource();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = this.sounds.get(pattern)!;
    source.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    gainNode.gain.value = this.volume;
    
    source.start();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

// Haptic Manager
class HapticManager {
  private enabled: boolean = true;

  vibrate(pattern: HapticPattern) {
    if (!this.enabled || !navigator.vibrate) return;

    const patterns: Record<HapticPattern, number[]> = {
      [HapticPattern.LIGHT]: [50],
      [HapticPattern.MEDIUM]: [100],
      [HapticPattern.HEAVY]: [200],
      [HapticPattern.DOUBLE]: [100, 50, 100],
      [HapticPattern.TRIPLE]: [100, 50, 100, 50, 100],
      [HapticPattern.CONTINUOUS]: [1000],
      [HapticPattern.SOS]: [100, 50, 100, 50, 100, 150, 200, 50, 200, 50, 200, 150, 100, 50, 100, 50, 100],
    };

    navigator.vibrate(patterns[pattern] || [100]);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

// Main Component
export const FeedbackSystem: React.FC<FeedbackSystemProps> = ({
  position = { vertical: 'top', horizontal: 'right' },
  maxVisible = 5,
  enableSound = true,
  enableHaptic = true,
  defaultLocale = 'en',
  soundFiles,
  onAcknowledge,
  onHelpRequest,
}) => {
  const theme = useTheme();
  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(enableSound);
  const [hapticEnabled, setHapticEnabled] = useState(enableHaptic);
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);
  
  const soundManagerRef = useRef<SoundManager>();
  const hapticManagerRef = useRef<HapticManager>();
  const screenReaderRef = useRef<HTMLDivElement>(null);

  // Initialize managers
  useEffect(() => {
    soundManagerRef.current = new SoundManager(soundFiles);
    hapticManagerRef.current = new HapticManager();
    
    soundManagerRef.current.setEnabled(soundEnabled);
    hapticManagerRef.current.setEnabled(hapticEnabled);

    return () => {
      // Cleanup
    };
  }, [soundFiles]);

  // Update managers when settings change
  useEffect(() => {
    soundManagerRef.current?.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    hapticManagerRef.current?.setEnabled(hapticEnabled);
  }, [hapticEnabled]);

  // Add message
  const addMessage = useCallback((message: Omit<FeedbackMessage, 'id' | 'timestamp'>) => {
    const newMessage: FeedbackMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setMessages(prev => [newMessage, ...prev]);

    // Process channels
    if (message.channels.includes(FeedbackChannel.AUDITORY) && message.soundPattern) {
      soundManagerRef.current?.play(message.soundPattern);
    }

    if (message.channels.includes(FeedbackChannel.HAPTIC) && message.hapticPattern) {
      hapticManagerRef.current?.vibrate(message.hapticPattern);
    }

    if (message.channels.includes(FeedbackChannel.SCREEN_READER)) {
      announceToScreenReader(message.title + '. ' + message.message);
    }

    // Auto-dismiss non-persistent messages
    if (!message.persistent && message.duration) {
      setTimeout(() => {
        removeMessage(newMessage.id);
      }, message.duration);
    }

    return newMessage.id;
  }, []);

  // Remove message
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
    setExpandedMessages(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  // Acknowledge message
  const acknowledgeMessage = useCallback((id: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, acknowledged: true } : msg
    ));
    
    if (onAcknowledge) {
      onAcknowledge(id);
    }

    // Remove after acknowledgment if not persistent
    const message = messages.find(msg => msg.id === id);
    if (message && !message.persistent) {
      setTimeout(() => removeMessage(id), 1000);
    }
  }, [messages, onAcknowledge]);

  // Toggle message expansion
  const toggleExpanded = useCallback((id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Announce to screen reader
  const announceToScreenReader = useCallback((text: string) => {
    if (screenReaderRef.current) {
      screenReaderRef.current.textContent = text;
      // Force re-announcement
      setTimeout(() => {
        if (screenReaderRef.current) {
          screenReaderRef.current.textContent = '';
        }
      }, 100);
    }
  }, []);

  // Get icon for severity
  const getSeverityIcon = (severity: FeedbackSeverity) => {
    switch (severity) {
      case FeedbackSeverity.SUCCESS:
        return <SuccessIcon />;
      case FeedbackSeverity.INFO:
        return <InfoIcon />;
      case FeedbackSeverity.WARNING:
        return <WarningIcon />;
      case FeedbackSeverity.ERROR:
        return <ErrorIcon />;
      case FeedbackSeverity.CRITICAL:
      case FeedbackSeverity.EMERGENCY:
        return <AlertIcon />;
    }
  };

  // Get color for severity
  const getSeverityColor = (severity: FeedbackSeverity) => {
    switch (severity) {
      case FeedbackSeverity.SUCCESS:
        return theme.palette.success.main;
      case FeedbackSeverity.INFO:
        return theme.palette.info.main;
      case FeedbackSeverity.WARNING:
        return theme.palette.warning.main;
      case FeedbackSeverity.ERROR:
        return theme.palette.error.main;
      case FeedbackSeverity.CRITICAL:
        return theme.palette.error.dark;
      case FeedbackSeverity.EMERGENCY:
        return '#ff0000';
    }
  };

  // Calculate position styles
  const positionStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: 'fixed',
      zIndex: theme.zIndex.snackbar,
      pointerEvents: 'none',
      maxWidth: 480,
      width: '100%',
    };

    // Vertical position
    if (position.vertical === 'top') {
      styles.top = 24;
    } else {
      styles.bottom = 24;
    }

    // Horizontal position
    if (position.horizontal === 'left') {
      styles.left = 24;
    } else if (position.horizontal === 'center') {
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
    } else {
      styles.right = 24;
    }

    return styles;
  }, [position, theme.zIndex.snackbar]);

  // Visible messages
  const visibleMessages = messages.slice(0, maxVisible);

  // Public API
  useEffect(() => {
    // Expose public API
    (window as any).__feedbackSystem = {
      addMessage,
      removeMessage,
      acknowledgeMessage,
      clearAll: () => setMessages([]),
      getMessages: () => messages,
    };

    return () => {
      delete (window as any).__feedbackSystem;
    };
  }, [addMessage, removeMessage, acknowledgeMessage, messages]);

  return (
    <>
      {/* Screen Reader Announcements */}
      <div
        ref={screenReaderRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      />

      {/* Feedback Container */}
      <Portal>
        <Box sx={positionStyles}>
          <Stack spacing={1} sx={{ pointerEvents: 'auto' }}>
            {/* Control Bar */}
            <Paper
              elevation={3}
              sx={{
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                backgroundColor: alpha(theme.palette.background.paper, 0.95),
                backdropFilter: 'blur(10px)',
              }}
            >
              <Typography variant="caption" sx={{ flex: 1 }}>
                Feedback System
              </Typography>
              <IconButton
                size="small"
                onClick={() => setSoundEnabled(!soundEnabled)}
                color={soundEnabled ? 'primary' : 'default'}
                title={soundEnabled ? 'Disable sound' : 'Enable sound'}
              >
                {soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setHapticEnabled(!hapticEnabled)}
                color={hapticEnabled ? 'primary' : 'default'}
                title={hapticEnabled ? 'Disable haptic' : 'Enable haptic'}
              >
                <VibrationIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setShowAccessibilityPanel(!showAccessibilityPanel)}
                title="Accessibility options"
              >
                <AccessibilityIcon fontSize="small" />
              </IconButton>
              {messages.length > 0 && (
                <Badge badgeContent={messages.length} color="primary">
                  <IconButton
                    size="small"
                    onClick={() => setMessages([])}
                    title="Clear all messages"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Badge>
              )}
            </Paper>

            {/* Messages */}
            {visibleMessages.map((message, index) => (
              <Grow
                key={message.id}
                in={true}
                timeout={300}
                style={{ transformOrigin: '0 0 0' }}
              >
                <Alert
                  severity={message.severity === FeedbackSeverity.CRITICAL || 
                           message.severity === FeedbackSeverity.EMERGENCY ? 'error' : 
                           message.severity as any}
                  icon={getSeverityIcon(message.severity)}
                  action={
                    <Stack direction="row" spacing={0.5}>
                      {message.helpLink && (
                        <IconButton
                          size="small"
                          onClick={() => onHelpRequest?.(message.id)}
                          title="Get help"
                        >
                          <HelpIcon fontSize="small" />
                        </IconButton>
                      )}
                      {message.expandable && (
                        <IconButton
                          size="small"
                          onClick={() => toggleExpanded(message.id)}
                          title={expandedMessages.has(message.id) ? 'Collapse' : 'Expand'}
                        >
                          {expandedMessages.has(message.id) ? 
                            <ExpandLessIcon fontSize="small" /> : 
                            <ExpandMoreIcon fontSize="small" />
                          }
                        </IconButton>
                      )}
                      {!message.requiresAcknowledgment && (
                        <IconButton
                          size="small"
                          onClick={() => removeMessage(message.id)}
                          title="Dismiss"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  }
                  sx={{
                    backgroundColor: message.severity === FeedbackSeverity.EMERGENCY ?
                      alpha('#ff0000', 0.95) :
                      alpha(theme.palette.background.paper, 0.95),
                    backdropFilter: 'blur(10px)',
                    borderLeft: `4px solid ${getSeverityColor(message.severity)}`,
                    animation: message.severity === FeedbackSeverity.EMERGENCY ?
                      'emergency-pulse 1s ease-in-out infinite' : 'none',
                    '@keyframes emergency-pulse': {
                      '0%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.02)' },
                      '100%': { transform: 'scale(1)' },
                    },
                  }}
                >
                  <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {message.title}
                    {message.context && (
                      <Chip 
                        label={message.context} 
                        size="small" 
                        variant="outlined"
                        sx={{ ml: 'auto' }}
                      />
                    )}
                  </AlertTitle>
                  {message.message}
                  
                  {/* Expandable Details */}
                  <Collapse in={expandedMessages.has(message.id)}>
                    {message.details && (
                      <Box sx={{ mt: 2, p: 2, backgroundColor: alpha(theme.palette.action.hover, 0.3), borderRadius: 1 }}>
                        <Typography variant="body2">{message.details}</Typography>
                      </Box>
                    )}
                  </Collapse>

                  {/* Actions */}
                  {(message.actions || message.requiresAcknowledgment) && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {message.actions?.map(action => (
                        <Button
                          key={action.id}
                          size="small"
                          variant={action.variant || 'outlined'}
                          color={action.color || 'primary'}
                          onClick={action.handler}
                        >
                          {action.label}
                        </Button>
                      ))}
                      {message.requiresAcknowledgment && !message.acknowledged && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          onClick={() => acknowledgeMessage(message.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </Box>
                  )}

                  {/* Progress */}
                  {!message.persistent && message.duration && !message.acknowledged && (
                    <LinearProgress
                      variant="determinate"
                      value={100}
                      sx={{
                        mt: 1,
                        height: 2,
                        backgroundColor: alpha(theme.palette.action.hover, 0.3),
                        '& .MuiLinearProgress-bar': {
                          animation: `countdown ${message.duration}ms linear`,
                          transformOrigin: 'left',
                        },
                        '@keyframes countdown': {
                          from: { transform: 'scaleX(1)' },
                          to: { transform: 'scaleX(0)' },
                        },
                      }}
                    />
                  )}
                </Alert>
              </Grow>
            ))}

            {/* More messages indicator */}
            {messages.length > maxVisible && (
              <Paper
                elevation={2}
                sx={{
                  p: 1,
                  textAlign: 'center',
                  backgroundColor: alpha(theme.palette.background.paper, 0.95),
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  +{messages.length - maxVisible} more messages
                </Typography>
              </Paper>
            )}
          </Stack>
        </Box>
      </Portal>
    </>
  );
};

// Export utilities
export const feedbackSystem = {
  success: (title: string, message: string, options?: Partial<FeedbackMessage>) => {
    (window as any).__feedbackSystem?.addMessage({
      severity: FeedbackSeverity.SUCCESS,
      title,
      message,
      channels: [FeedbackChannel.VISUAL, FeedbackChannel.AUDITORY],
      soundPattern: SoundPattern.SUCCESS,
      duration: 5000,
      ...options,
    });
  },
  info: (title: string, message: string, options?: Partial<FeedbackMessage>) => {
    (window as any).__feedbackSystem?.addMessage({
      severity: FeedbackSeverity.INFO,
      title,
      message,
      channels: [FeedbackChannel.VISUAL],
      duration: 5000,
      ...options,
    });
  },
  warning: (title: string, message: string, options?: Partial<FeedbackMessage>) => {
    (window as any).__feedbackSystem?.addMessage({
      severity: FeedbackSeverity.WARNING,
      title,
      message,
      channels: [FeedbackChannel.VISUAL, FeedbackChannel.AUDITORY],
      soundPattern: SoundPattern.WARNING,
      duration: 8000,
      ...options,
    });
  },
  error: (title: string, message: string, options?: Partial<FeedbackMessage>) => {
    (window as any).__feedbackSystem?.addMessage({
      severity: FeedbackSeverity.ERROR,
      title,
      message,
      channels: [FeedbackChannel.VISUAL, FeedbackChannel.AUDITORY, FeedbackChannel.HAPTIC],
      soundPattern: SoundPattern.ERROR,
      hapticPattern: HapticPattern.HEAVY,
      duration: 10000,
      ...options,
    });
  },
  emergency: (title: string, message: string, options?: Partial<FeedbackMessage>) => {
    (window as any).__feedbackSystem?.addMessage({
      severity: FeedbackSeverity.EMERGENCY,
      title,
      message,
      channels: [FeedbackChannel.VISUAL, FeedbackChannel.AUDITORY, FeedbackChannel.HAPTIC, FeedbackChannel.SCREEN_READER],
      soundPattern: SoundPattern.SIREN,
      hapticPattern: HapticPattern.SOS,
      persistent: true,
      requiresAcknowledgment: true,
      ...options,
    });
  },
};

export default FeedbackSystem;