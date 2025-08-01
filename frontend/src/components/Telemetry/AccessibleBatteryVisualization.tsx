/**
 * Accessible Battery Visualization Component
 * Mission-critical battery level display with comprehensive accessibility features
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  LinearProgress, 
  Alert, 
  Card, 
  CardContent, 
  Button,
  Chip,
  Tooltip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Battery20 as BatteryLowIcon,
  Battery50 as BatteryMediumIcon,
  Battery80 as BatteryHighIcon,
  BatteryAlert as BatteryCriticalIcon,
  BatteryFull as BatteryFullIcon
} from '@mui/icons-material';

import AccessibilityEnhancer from '../Charts/accessibility/AccessibilityEnhancer';

export interface BatteryData {
  level: number; // 0-100
  voltage: number; // Volts
  current: number; // Amperes
  temperature: number; // Celsius
  timeRemaining?: number; // Minutes
  chargingStatus: 'charging' | 'discharging' | 'full' | 'unknown';
  health: number; // 0-100, battery health percentage
  cycleCount: number;
  timestamp: Date;
}

export interface AccessibleBatteryVisualizationProps {
  batteryData: BatteryData;
  showDetails?: boolean;
  criticalLevel?: number;
  lowLevel?: number;
  onCriticalAlert?: (level: number) => void;
  onLowBatteryWarning?: (level: number) => void;
  enableVoiceAlerts?: boolean;
  compactMode?: boolean;
  accessibility?: {
    highContrast?: boolean;
    reducedMotion?: boolean;
    screenReaderOptimized?: boolean;
  };
}

interface BatteryAlert {
  id: string;
  type: 'critical' | 'low' | 'charging' | 'full';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

const AccessibleBatteryVisualization: React.FC<AccessibleBatteryVisualizationProps> = ({
  batteryData,
  showDetails = true,
  criticalLevel = 15,
  lowLevel = 25,
  onCriticalAlert,
  onLowBatteryWarning,
  enableVoiceAlerts = false,
  compactMode = false,
  accessibility = {}
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  
  const [alerts, setAlerts] = useState<BatteryAlert[]>([]);
  const [lastAnnouncementTime, setLastAnnouncementTime] = useState<Date | null>(null);
  const [focusedElement, setFocusedElement] = useState<string | null>(null);

  // Calculate battery status and color
  const batteryStatus = useMemo(() => {
    if (batteryData.level <= criticalLevel) return 'critical';
    if (batteryData.level <= lowLevel) return 'low';
    if (batteryData.level <= 50) return 'medium';
    if (batteryData.level <= 80) return 'good';
    return 'excellent';
  }, [batteryData.level, criticalLevel, lowLevel]);

  const batteryColor = useMemo(() => {
    if (accessibility.highContrast) {
      switch (batteryStatus) {
        case 'critical': return '#ff0000';
        case 'low': return '#ffaa00';
        case 'medium': return '#ffff00';
        case 'good': return '#00ff00';
        case 'excellent': return '#00ff00';
        default: return '#ffffff';
      }
    }

    switch (batteryStatus) {
      case 'critical': return theme.palette.error.main;
      case 'low': return theme.palette.warning.main;
      case 'medium': return theme.palette.info.main;
      case 'good': return theme.palette.success.main;
      case 'excellent': return theme.palette.success.dark;
      default: return theme.palette.grey[500];
    }
  }, [batteryStatus, theme, accessibility.highContrast]);

  const batteryIcon = useMemo(() => {
    const iconProps = { 
      sx: { color: batteryColor, fontSize: compactMode ? 24 : 32 },
      'aria-hidden': true
    };

    switch (batteryStatus) {
      case 'critical': return <BatteryCriticalIcon {...iconProps} />;
      case 'low': return <BatteryLowIcon {...iconProps} />;
      case 'medium': return <BatteryMediumIcon {...iconProps} />;
      case 'good': return <BatteryHighIcon {...iconProps} />;
      case 'excellent': return <BatteryFullIcon {...iconProps} />;
      default: return <BatteryMediumIcon {...iconProps} />;
    }
  }, [batteryStatus, batteryColor, compactMode]);

  // Generate comprehensive aria label
  const generateAriaLabel = useCallback((): string => {
    const level = Math.round(batteryData.level);
    const status = batteryStatus;
    const chargingText = batteryData.chargingStatus === 'charging' ? ', charging' : 
                       batteryData.chargingStatus === 'full' ? ', fully charged' : '';
    
    let timeText = '';
    if (batteryData.timeRemaining && batteryData.chargingStatus === 'discharging') {
      const hours = Math.floor(batteryData.timeRemaining / 60);
      const minutes = batteryData.timeRemaining % 60;
      timeText = hours > 0 ? 
        `, approximately ${hours} hours ${minutes} minutes remaining` :
        `, approximately ${minutes} minutes remaining`;
    }

    return `Battery level ${level} percent, status ${status}${chargingText}${timeText}`;
  }, [batteryData, batteryStatus]);

  // Generate detailed description for screen readers
  const generateDetailedDescription = useCallback((): string => {
    const parts = [
      `Battery health: ${batteryData.health}%`,
      `Voltage: ${batteryData.voltage.toFixed(2)} volts`,
      `Current: ${batteryData.current.toFixed(2)} amperes`,
      `Temperature: ${batteryData.temperature}°C`,
      `Cycle count: ${batteryData.cycleCount}`,
      `Last updated: ${batteryData.timestamp.toLocaleString()}`
    ];

    return parts.join(', ');
  }, [batteryData]);

  // Monitor battery level changes and create alerts  
  useEffect(() => {
    const now = new Date();
    const newAlerts: BatteryAlert[] = [];

    // Critical level alert
    if (batteryData.level <= criticalLevel && batteryData.chargingStatus !== 'charging') {
      const existingCritical = alerts.find(a => a.type === 'critical' && !a.acknowledged);
      if (!existingCritical) {
        newAlerts.push({
          id: `critical-${now.getTime()}`,
          type: 'critical',
          message: `CRITICAL: Battery level at ${Math.round(batteryData.level)}%. Immediate action required.`,
          timestamp: now,
          acknowledged: false
        });
        onCriticalAlert?.(batteryData.level);
      }
    }

    // Low level warning
    if (batteryData.level <= lowLevel && batteryData.level > criticalLevel && batteryData.chargingStatus !== 'charging') {
      const existingLow = alerts.find(a => a.type === 'low' && !a.acknowledged);
      if (!existingLow) {
        newAlerts.push({
          id: `low-${now.getTime()}`,
          type: 'low',
          message: `Battery low at ${Math.round(batteryData.level)}%. Consider charging soon.`,
          timestamp: now,
          acknowledged: false
        });
        onLowBatteryWarning?.(batteryData.level);
      }
    }

    // Charging status change
    if (batteryData.chargingStatus === 'charging') {
      const existingCharging = alerts.find(a => a.type === 'charging' && !a.acknowledged);
      if (!existingCharging) {
        newAlerts.push({
          id: `charging-${now.getTime()}`,
          type: 'charging',
          message: `Battery charging. Current level: ${Math.round(batteryData.level)}%.`,
          timestamp: now,
          acknowledged: false
        });
      }
    }

    // Full battery
    if (batteryData.chargingStatus === 'full' && batteryData.level >= 95) {
      const existingFull = alerts.find(a => a.type === 'full' && !a.acknowledged);
      if (!existingFull) {
        newAlerts.push({
          id: `full-${now.getTime()}`,
          type: 'full',
          message: 'Battery fully charged.',
          timestamp: now,
          acknowledged: false
        });
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(prevAlerts => [...prevAlerts, ...newAlerts]);
      
      // Announce to screen reader and voice
      newAlerts.forEach(alert => {
        announceToScreenReader(alert.message, alert.type === 'critical' ? 'assertive' : 'polite');
        
        if (enableVoiceAlerts) {
          announceWithVoice(alert.message);
        }
      });
    }
  }, [batteryData.level, batteryData.chargingStatus, criticalLevel, lowLevel, alerts, onCriticalAlert, onLowBatteryWarning, enableVoiceAlerts]);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegionRef.current) return;

    // Throttle announcements to avoid overwhelming screen readers
    const now = new Date();
    if (lastAnnouncementTime && (now.getTime() - lastAnnouncementTime.getTime()) < 3000) {
      return;
    }

    const liveRegion = liveRegionRef.current;
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = '';
    
    setTimeout(() => {
      liveRegion.textContent = message;
      setLastAnnouncementTime(now);
    }, 100);
  }, [lastAnnouncementTime]);

  const announceWithVoice = useCallback((message: string) => {
    if (!window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    utterance.pitch = batteryStatus === 'critical' ? 1.2 : 1.0;
    
    window.speechSynthesis.speak(utterance);
  }, [batteryStatus]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    const { key, altKey } = event;

    switch (key) {
      case 's':
      case 'S':
        if (altKey) {
          event.preventDefault();
          const summary = `${generateAriaLabel()}. ${generateDetailedDescription()}`;
          announceToScreenReader(summary, 'assertive');
        }
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedElement === 'battery-display') {
          const announcement = `${generateAriaLabel()}. Press Alt+S for detailed information.`;
          announceToScreenReader(announcement, 'polite');
        }
        break;
    }
  }, [focusedElement, generateAriaLabel, generateDetailedDescription, announceToScreenReader]);

  const renderCompactView = () => (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        border: `2px solid ${batteryColor}`,
        borderRadius: 1,
        backgroundColor: accessibility.highContrast ? '#000000' : 'transparent',
        '&:focus-within': {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: '2px'
        }
      }}
      tabIndex={0}
      role="img"
      aria-label={generateAriaLabel()}
      onKeyDown={handleKeyboardNavigation}
      onFocus={() => setFocusedElement('battery-display')}
      onBlur={() => setFocusedElement(null)}
    >
      {batteryIcon}
      <Typography 
        variant="body2" 
        fontWeight="bold"
        sx={{ color: accessibility.highContrast ? '#ffffff' : 'inherit' }}
      >
        {Math.round(batteryData.level)}%
      </Typography>
      <Chip
        label={batteryData.chargingStatus}
        size="small"
        color={batteryData.chargingStatus === 'charging' ? 'primary' : 'default'}
        sx={{ fontSize: '0.7rem' }}
      />
    </Box>
  );

  const renderFullView = () => (
    <Card
      ref={containerRef}
      sx={{
        backgroundColor: accessibility.highContrast ? '#000000' : 'inherit',
        color: accessibility.highContrast ? '#ffffff' : 'inherit',
        border: accessibility.highContrast ? '2px solid #ffffff' : 'none'
      }}
    >
      <CardContent>
        {/* Header with icon and level */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}
          tabIndex={0}
          role="img"
          aria-label={generateAriaLabel()}
          aria-describedby="battery-details"
          onKeyDown={handleKeyboardNavigation}
          onFocus={() => setFocusedElement('battery-display')}
          onBlur={() => setFocusedElement(null)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {batteryIcon}
            <Box>
              <Typography variant="h4" component="h2" fontWeight="bold">
                {Math.round(batteryData.level)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Battery Level
              </Typography>
            </Box>
          </Box>
          
          <Box sx={{ textAlign: 'right' }}>
            <Chip
              label={batteryData.chargingStatus.charAt(0).toUpperCase() + batteryData.chargingStatus.slice(1)}
              color={batteryData.chargingStatus === 'charging' ? 'primary' : 'default'}
              sx={{ mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary">
              Status: {batteryStatus}
            </Typography>
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={batteryData.level}
            sx={{
              height: 12,
              borderRadius: 6,
              backgroundColor: accessibility.highContrast ? '#333333' : undefined,
              '& .MuiLinearProgress-bar': {
                backgroundColor: batteryColor,
                borderRadius: 6,
                transition: accessibility.reducedMotion ? 'none' : undefined
              }
            }}
            aria-label={`Battery level ${Math.round(batteryData.level)} percent`}
          />
          
          {/* Threshold indicators */}
          <Box sx={{ position: 'relative', mt: 0.5 }}>
            <Box
              sx={{
                position: 'absolute',
                left: `${criticalLevel}%`,
                width: 2,
                height: 8,
                backgroundColor: theme.palette.error.main,
                transform: 'translateX(-50%)'
              }}
              aria-label={`Critical threshold at ${criticalLevel}%`}
            />
            <Box
              sx={{
                position: 'absolute',
                left: `${lowLevel}%`,
                width: 2,
                height: 8,
                backgroundColor: theme.palette.warning.main,
                transform: 'translateX(-50%)'
              }}
              aria-label={`Low battery threshold at ${lowLevel}%`}
            />
          </Box>
        </Box>

        {/* Time remaining */}
        {batteryData.timeRemaining && batteryData.chargingStatus === 'discharging' && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            Estimated time remaining: {Math.floor(batteryData.timeRemaining / 60)}h {batteryData.timeRemaining % 60}m
          </Typography>
        )}

        {/* Detailed information */}
        {showDetails && (
          <Box
            id="battery-details"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 2,
              mt: 2,
              p: 2,
              backgroundColor: accessibility.highContrast ? '#111111' : theme.palette.action.hover,
              borderRadius: 1
            }}
          >
            <Box>
              <Typography variant="body2" color="text.secondary">Health</Typography>
              <Typography variant="h6">{batteryData.health}%</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Voltage</Typography>
              <Typography variant="h6">{batteryData.voltage.toFixed(2)}V</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Current</Typography>
              <Typography variant="h6">{batteryData.current.toFixed(2)}A</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Temperature</Typography>
              <Typography variant="h6">{batteryData.temperature}°C</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Cycles</Typography>
              <Typography variant="h6">{batteryData.cycleCount}</Typography>
            </Box>
          </Box>
        )}

        {/* Active alerts */}
        {alerts.filter(alert => !alert.acknowledged).map(alert => (
          <Alert
            key={alert.id}
            severity={alert.type === 'critical' ? 'error' : alert.type === 'low' ? 'warning' : 'info'}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => acknowledgeAlert(alert.id)}
                aria-label={`Acknowledge ${alert.type} alert`}
              >
                Acknowledge
              </Button>
            }
            sx={{ mt: 1 }}
          >
            {alert.message}
          </Alert>
        ))}

        {/* Keyboard shortcuts help */}
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ display: 'block', mt: 2, fontSize: '0.75rem' }}
        >
          Keyboard: Alt+S for details, Enter/Space to announce status
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <AccessibilityEnhancer
      chartType="Battery Status Indicator"
      chartData={[batteryData]}
      options={{
        enabled: true,
        screenReaderOptimized: accessibility.screenReaderOptimized || false,
        keyboardNavigation: true,
        liveRegions: true,
        alternativeFormats: true,
        colorBlindFriendly: true,
        highContrast: accessibility.highContrast || false,
        reducedMotion: accessibility.reducedMotion || false
      }}
    >
      <Box>
        {/* Live region for screen reader announcements */}
        <div
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          style={{ 
            position: 'absolute', 
            left: '-10000px', 
            width: '1px', 
            height: '1px', 
            overflow: 'hidden' 
          }}
        />

        {compactMode ? renderCompactView() : renderFullView()}
      </Box>
    </AccessibilityEnhancer>
  );
};

export default AccessibleBatteryVisualization;