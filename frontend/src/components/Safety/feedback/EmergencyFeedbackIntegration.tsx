/**
 * Emergency Feedback Integration Component
 * 
 * Integrates all feedback system components with the emergency stop interface.
 * Provides comprehensive multi-modal feedback for safety-critical operations.
 * 
 * @component
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Language as LanguageIcon,
  Close as CloseIcon,
  VolumeUp as VolumeIcon,
  Vibration as VibrationIcon,
  NotificationsActive as NotificationsIcon,
} from '@mui/icons-material';

// Import all feedback components
import {
  FeedbackSystem,
  feedbackSystem,
  FeedbackSeverity,
  FeedbackChannel,
  SoundPattern,
  HapticPattern,
  FeedbackMessage,
} from './FeedbackSystem';

import {
  StatusBanner,
  SystemStatus,
  StatusSection,
  StatusMetric,
} from './StatusBanner';

import {
  ConfirmationModal,
  ConfirmationSeverity,
  ConfirmationMethod,
  ConfirmationRequirement,
} from './ConfirmationModal';

import {
  LocalizationProvider,
  useLocalization,
  Locale,
} from './LocalizationProvider';

import {
  FeedbackHistory,
  FeedbackHistoryEntry,
} from './FeedbackHistory';

// Import emergency stop types
import {
  SystemSafetyState,
  EmergencyStopState,
  EmergencyEvent,
} from '../../../hooks/useEmergencyStop';

// Types
interface EmergencyFeedbackIntegrationProps {
  /**
   * Current system safety state
   */
  systemState: SystemSafetyState;
  /**
   * Emergency stop state
   */
  emergencyState: EmergencyStopState;
  /**
   * Recent emergency events
   */
  recentEvents: EmergencyEvent[];
  /**
   * Device health status
   */
  deviceHealth: {
    count: number;
    healthy: number;
    faults: string[];
  };
  /**
   * Connection status
   */
  connectionStatus: {
    websocket: boolean;
    hardware: boolean;
    latency: number;
  };
  /**
   * Whether to show the status banner
   */
  showStatusBanner?: boolean;
  /**
   * Whether to show the feedback panel
   */
  showFeedbackPanel?: boolean;
  /**
   * Default locale
   */
  defaultLocale?: Locale;
  /**
   * Callback when emergency stop is confirmed
   */
  onEmergencyStopConfirm?: () => void;
  /**
   * Callback when emergency stop is cleared
   */
  onEmergencyStopClear?: () => void;
}

// Helper function to convert system state to status
const getSystemStatus = (state: SystemSafetyState): SystemStatus => {
  switch (state) {
    case SystemSafetyState.SAFE:
      return SystemStatus.NORMAL;
    case SystemSafetyState.WARNING:
      return SystemStatus.WARNING;
    case SystemSafetyState.EMERGENCY:
      return SystemStatus.EMERGENCY;
    case SystemSafetyState.CRITICAL:
      return SystemStatus.CRITICAL;
    default:
      return SystemStatus.NORMAL;
  }
};

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`feedback-tabpanel-${index}`}
      aria-labelledby={`feedback-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
};

// Main Component
export const EmergencyFeedbackIntegration: React.FC<EmergencyFeedbackIntegrationProps> = ({
  systemState,
  emergencyState,
  recentEvents,
  deviceHealth,
  connectionStatus,
  showStatusBanner = true,
  showFeedbackPanel = true,
  defaultLocale = 'en',
  onEmergencyStopConfirm,
  onEmergencyStopClear,
}) => {
  const theme = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [feedbackHistory, setFeedbackHistory] = useState<FeedbackHistoryEntry[]>([]);
  const feedbackSystemRef = useRef<any>(null);

  // Create status sections for banner
  const statusSections: StatusSection[] = [
    {
      id: 'system',
      title: 'System Status',
      status: getSystemStatus(systemState),
      metrics: [
        {
          id: 'state',
          label: 'Safety State',
          value: systemState,
          status: getSystemStatus(systemState),
        },
        {
          id: 'emergency',
          label: 'Emergency Stop',
          value: emergencyState,
          status: emergencyState === 'TRIGGERED' ? SystemStatus.EMERGENCY : SystemStatus.NORMAL,
        },
      ],
      expandable: true,
    },
    {
      id: 'hardware',
      title: 'Hardware Status',
      status: deviceHealth.faults.length > 0 ? SystemStatus.WARNING : SystemStatus.NORMAL,
      metrics: [
        {
          id: 'devices',
          label: 'Total Devices',
          value: deviceHealth.count,
          status: SystemStatus.NORMAL,
        },
        {
          id: 'healthy',
          label: 'Healthy Devices',
          value: deviceHealth.healthy,
          unit: `/ ${deviceHealth.count}`,
          status: deviceHealth.healthy === deviceHealth.count ? SystemStatus.NORMAL : SystemStatus.WARNING,
        },
        {
          id: 'faults',
          label: 'Active Faults',
          value: deviceHealth.faults.length,
          status: deviceHealth.faults.length > 0 ? SystemStatus.WARNING : SystemStatus.NORMAL,
        },
      ],
      expandable: true,
    },
    {
      id: 'connection',
      title: 'Connection Status',
      status: connectionStatus.websocket && connectionStatus.hardware ? 
        SystemStatus.NORMAL : SystemStatus.ERROR,
      metrics: [
        {
          id: 'websocket',
          label: 'WebSocket',
          value: connectionStatus.websocket ? 'Connected' : 'Disconnected',
          status: connectionStatus.websocket ? SystemStatus.NORMAL : SystemStatus.ERROR,
        },
        {
          id: 'hardware',
          label: 'Hardware',
          value: connectionStatus.hardware ? 'Connected' : 'Disconnected',
          status: connectionStatus.hardware ? SystemStatus.NORMAL : SystemStatus.ERROR,
        },
        {
          id: 'latency',
          label: 'Latency',
          value: connectionStatus.latency,
          unit: 'ms',
          status: connectionStatus.latency < 100 ? SystemStatus.NORMAL : 
                  connectionStatus.latency < 500 ? SystemStatus.WARNING : 
                  SystemStatus.ERROR,
          trend: 'stable',
        },
      ],
      expandable: true,
    },
  ];

  // Handle emergency events
  useEffect(() => {
    recentEvents.forEach(event => {
      const severity = event.systemStateAfter === SystemSafetyState.EMERGENCY ? 
        FeedbackSeverity.EMERGENCY : 
        event.systemStateAfter === SystemSafetyState.CRITICAL ?
        FeedbackSeverity.CRITICAL :
        FeedbackSeverity.WARNING;

      const message: Partial<FeedbackMessage> = {
        severity,
        title: event.triggerSource,
        message: event.triggerReason,
        channels: [
          FeedbackChannel.VISUAL,
          FeedbackChannel.AUDITORY,
          FeedbackChannel.HAPTIC,
          FeedbackChannel.SCREEN_READER,
        ],
        soundPattern: severity === FeedbackSeverity.EMERGENCY ? 
          SoundPattern.SIREN : SoundPattern.WARNING,
        hapticPattern: severity === FeedbackSeverity.EMERGENCY ? 
          HapticPattern.SOS : HapticPattern.HEAVY,
        persistent: severity === FeedbackSeverity.EMERGENCY,
        requiresAcknowledgment: severity === FeedbackSeverity.EMERGENCY,
        context: 'Emergency Stop',
        timestamp: new Date(event.timestamp),
      };

      // Add to feedback system
      if (feedbackSystemRef.current) {
        const id = feedbackSystemRef.current.addMessage(message);
        
        // Add to history
        setFeedbackHistory(prev => [{
          ...message as FeedbackMessage,
          id,
          timestamp: new Date(event.timestamp),
        }, ...prev]);
      }
    });
  }, [recentEvents]);

  // Handle connection loss
  useEffect(() => {
    if (!connectionStatus.websocket || !connectionStatus.hardware) {
      feedbackSystem.error(
        'Connection Lost',
        `${!connectionStatus.websocket ? 'WebSocket' : 'Hardware'} connection lost. Emergency stop may be activated.`,
        {
          channels: [FeedbackChannel.VISUAL, FeedbackChannel.AUDITORY, FeedbackChannel.HAPTIC],
          persistent: true,
          context: 'Connection',
        }
      );
    }
  }, [connectionStatus]);

  // Confirmation requirements for emergency stop
  const emergencyStopRequirements: ConfirmationRequirement[] = [
    {
      method: ConfirmationMethod.TYPE_TEXT,
      config: {
        text: 'EMERGENCY STOP',
      },
    },
    {
      method: ConfirmationMethod.HOLD_BUTTON,
      config: {
        holdDuration: 3000,
      },
    },
  ];

  // Confirmation requirements for clearing emergency stop
  const clearRequirements: ConfirmationRequirement[] = [
    {
      method: ConfirmationMethod.CHECKBOX,
      config: {
        checkboxLabel: 'I confirm the system is safe to resume operation',
      },
    },
    {
      method: ConfirmationMethod.PIN,
      config: {
        pin: '1234', // Should be user-specific in production
      },
    },
  ];

  return (
    <LocalizationProvider defaultLocale={defaultLocale}>
      <Box>
        {/* Status Banner */}
        {showStatusBanner && (
          <StatusBanner
            sections={statusSections}
            position="top"
            collapsible={true}
            animate={true}
            updateInterval={1000}
          />
        )}

        {/* Feedback System */}
        <FeedbackSystem
          ref={feedbackSystemRef}
          position={{ vertical: 'top', horizontal: 'right' }}
          maxVisible={5}
          enableSound={true}
          enableHaptic={true}
          defaultLocale={defaultLocale}
        />

        {/* Feedback Panel */}
        {showFeedbackPanel && (
          <Paper
            sx={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 400,
              maxHeight: 500,
              display: 'flex',
              flexDirection: 'column',
              zIndex: theme.zIndex.modal - 2,
            }}
            elevation={4}
          >
            {/* Header */}
            <Box
              sx={{
                p: 2,
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <FeedbackIcon />
              <Typography variant="h6" sx={{ flex: 1 }}>
                Feedback System
              </Typography>
              <IconButton
                size="small"
                sx={{ color: 'inherit' }}
                onClick={() => setShowSettings(true)}
              >
                <SettingsIcon />
              </IconButton>
            </Box>

            {/* Tabs */}
            <Tabs
              value={tabValue}
              onChange={(_, value) => setTabValue(value)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab
                icon={<NotificationsIcon />}
                label="Active"
                id="feedback-tab-0"
              />
              <Tab
                icon={
                  <Badge badgeContent={feedbackHistory.length} color="primary">
                    <HistoryIcon />
                  </Badge>
                }
                label="History"
                id="feedback-tab-1"
              />
            </Tabs>

            {/* Tab Panels */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <TabPanel value={tabValue} index={0}>
                <Stack spacing={2}>
                  <Typography variant="body2" color="textSecondary">
                    Active feedback messages appear in the notification area.
                  </Typography>
                  
                  {/* Quick Actions */}
                  <Stack spacing={1}>
                    <Button
                      variant="contained"
                      color="error"
                      fullWidth
                      onClick={() => setShowEmergencyConfirm(true)}
                      disabled={emergencyState === 'TRIGGERED'}
                    >
                      Activate Emergency Stop
                    </Button>
                    
                    {emergencyState === 'TRIGGERED' && (
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        onClick={() => setShowClearConfirm(true)}
                      >
                        Clear Emergency Stop
                      </Button>
                    )}
                  </Stack>

                  <Divider />

                  {/* Test Actions */}
                  <Typography variant="subtitle2">Test Feedback</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button
                      size="small"
                      onClick={() => feedbackSystem.success('Test', 'Success message')}
                    >
                      Success
                    </Button>
                    <Button
                      size="small"
                      onClick={() => feedbackSystem.warning('Test', 'Warning message')}
                    >
                      Warning
                    </Button>
                    <Button
                      size="small"
                      onClick={() => feedbackSystem.error('Test', 'Error message')}
                    >
                      Error
                    </Button>
                    <Button
                      size="small"
                      onClick={() => feedbackSystem.emergency('Test', 'Emergency message')}
                    >
                      Emergency
                    </Button>
                  </Stack>
                </Stack>
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <FeedbackHistory
                  entries={feedbackHistory}
                  enableReplay={true}
                  enableExport={true}
                  enableDelete={false}
                  onReplay={(entry) => {
                    // Re-send the message
                    if (feedbackSystemRef.current) {
                      feedbackSystemRef.current.addMessage(entry);
                    }
                  }}
                  onExport={(entries, format) => {
                    // Handle export
                    console.log('Export', entries.length, 'entries as', format);
                  }}
                />
              </TabPanel>
            </Box>
          </Paper>
        )}

        {/* Emergency Stop Confirmation */}
        <ConfirmationModal
          open={showEmergencyConfirm}
          title="Activate Emergency Stop"
          message="This will immediately stop all rover operations and engage safety protocols."
          details="All movement will cease, and the system will enter a safe state. Manual intervention will be required to resume operations."
          severity={ConfirmationSeverity.CRITICAL}
          requirements={emergencyStopRequirements}
          confirmText="ACTIVATE EMERGENCY STOP"
          cancelText="Cancel"
          showCountdown={true}
          countdownDuration={30}
          onConfirm={() => {
            setShowEmergencyConfirm(false);
            onEmergencyStopConfirm?.();
            feedbackSystem.emergency(
              'Emergency Stop Activated',
              'All systems have been stopped. Manual clearance required to resume.',
              {
                persistent: true,
                requiresAcknowledgment: true,
              }
            );
          }}
          onCancel={() => setShowEmergencyConfirm(false)}
          destructive={true}
        />

        {/* Clear Emergency Stop Confirmation */}
        <ConfirmationModal
          open={showClearConfirm}
          title="Clear Emergency Stop"
          message="Confirm that it is safe to resume normal operations."
          details="Ensure all safety conditions have been verified and the cause of the emergency stop has been resolved."
          severity={ConfirmationSeverity.HIGH}
          requirements={clearRequirements}
          confirmText="Clear Emergency Stop"
          cancelText="Cancel"
          onConfirm={() => {
            setShowClearConfirm(false);
            onEmergencyStopClear?.();
            feedbackSystem.success(
              'Emergency Stop Cleared',
              'System returning to normal operation mode.',
              {
                channels: [FeedbackChannel.VISUAL, FeedbackChannel.AUDITORY],
                soundPattern: SoundPattern.SUCCESS,
              }
            );
          }}
          onCancel={() => setShowClearConfirm(false)}
        />

        {/* Settings Dialog */}
        <Dialog
          open={showSettings}
          onClose={() => setShowSettings(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Feedback System Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              {/* Language Selection */}
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Language
                </Typography>
                <LanguageSelector />
              </Box>

              {/* Sound Settings */}
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Sound Settings
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="textSecondary">
                    Configure sound alerts and volume
                  </Typography>
                  {/* Add sound configuration UI */}
                </Stack>
              </Box>

              {/* Haptic Settings */}
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Haptic Feedback
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2" color="textSecondary">
                    Configure vibration patterns
                  </Typography>
                  {/* Add haptic configuration UI */}
                </Stack>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

// Language Selector Component
const LanguageSelector: React.FC = () => {
  const { locale, setLocale, supportedLocales } = useLocalization();

  return (
    <Stack spacing={1}>
      {supportedLocales.map(localeInfo => (
        <Button
          key={localeInfo.code}
          variant={locale === localeInfo.code ? 'contained' : 'outlined'}
          onClick={() => setLocale(localeInfo.code)}
          startIcon={<span>{localeInfo.flag}</span>}
          fullWidth
          sx={{ justifyContent: 'flex-start' }}
        >
          {localeInfo.nativeName} ({localeInfo.name})
        </Button>
      ))}
    </Stack>
  );
};

export default EmergencyFeedbackIntegration;