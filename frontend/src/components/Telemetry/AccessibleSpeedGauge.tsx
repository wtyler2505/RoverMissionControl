/**
 * Accessible Speed Gauge Component
 * Real-time speed monitoring with comprehensive accessibility features and alternative representations
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Alert, 
  Card, 
  CardContent, 
  Button,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Speed as SpeedIcon,
  DirectionsCar as CarIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Stop as StopIcon
} from '@mui/icons-material';

import AccessibilityEnhancer from '../Charts/accessibility/AccessibilityEnhancer';

export interface SpeedData {
  timestamp: number;
  time: Date;
  speed: number; // m/s
  direction: number; // degrees, 0-360
  acceleration: number; // m/s²
  status: 'stopped' | 'moving' | 'accelerating' | 'decelerating' | 'emergency_stop';
  distance: number; // total distance traveled in meters
  maxSpeed?: number; // maximum allowed speed
  efficiency?: number; // energy efficiency rating 0-100
}

export interface AccessibleSpeedGaugeProps {
  speedData: SpeedData;
  maxDisplaySpeed?: number;
  speedUnit?: 'm/s' | 'km/h' | 'mph';
  showDirection?: boolean;
  showAcceleration?: boolean;
  thresholds?: {
    maxSafe: number;
    warning: number;
    critical: number;
  };
  onSpeedAlert?: (alert: SpeedAlert) => void;
  compactMode?: boolean;
  accessibility?: {
    highContrast?: boolean;
    reducedMotion?: boolean;
    screenReaderOptimized?: boolean;
    voiceAlerts?: boolean;
    alternativeFormats?: boolean;
  };
}

interface SpeedAlert {
  id: string;
  type: 'overspeeding' | 'rapid_acceleration' | 'emergency_stop' | 'efficiency_low';
  speed: number;
  threshold?: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface SpeedHistory {
  timestamp: number;
  speed: number;
  acceleration: number;
}

const AccessibleSpeedGauge: React.FC<AccessibleSpeedGaugeProps> = ({
  speedData,
  maxDisplaySpeed = 20, // 20 m/s default max
  speedUnit = 'm/s',
  showDirection = true,
  showAcceleration = true,
  thresholds = {
    maxSafe: 15,
    warning: 18,
    critical: 20
  },
  onSpeedAlert,
  compactMode = false,
  accessibility = {}
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const gaugeRef = useRef<SVGSVGElement>(null);

  const [alerts, setAlerts] = useState<SpeedAlert[]>([]);
  const [speedHistory, setSpeedHistory] = useState<SpeedHistory[]>([]);
  const [lastAnnouncementTime, setLastAnnouncementTime] = useState<Date | null>(null);
  const [showAlternativeView, setShowAlternativeView] = useState(false);

  // Convert speed to selected unit
  const convertSpeed = useCallback((speed: number): number => {
    switch (speedUnit) {
      case 'km/h': return speed * 3.6;
      case 'mph': return speed * 2.237;
      default: return speed; // m/s
    }
  }, [speedUnit]);

  const convertedSpeed = useMemo(() => convertSpeed(speedData.speed), [speedData.speed, convertSpeed]);
  const convertedMaxSpeed = useMemo(() => convertSpeed(maxDisplaySpeed), [maxDisplaySpeed, convertSpeed]);
  const convertedThresholds = useMemo(() => ({
    maxSafe: convertSpeed(thresholds.maxSafe),
    warning: convertSpeed(thresholds.warning),
    critical: convertSpeed(thresholds.critical)
  }), [thresholds, convertSpeed]);

  // Update speed history for trend analysis
  useEffect(() => {
    const newEntry: SpeedHistory = {
      timestamp: speedData.timestamp,
      speed: speedData.speed,
      acceleration: speedData.acceleration
    };

    setSpeedHistory(prev => {
      const updated = [...prev, newEntry];
      // Keep only last 50 entries for performance
      return updated.slice(-50);
    });
  }, [speedData]);

  // Calculate speed status and color
  const speedStatus = useMemo(() => {
    if (speedData.status === 'emergency_stop') return 'emergency';
    if (speedData.speed === 0) return 'stopped';
    if (speedData.speed >= thresholds.critical) return 'critical';
    if (speedData.speed >= thresholds.warning) return 'warning';
    if (speedData.speed >= thresholds.maxSafe) return 'caution';
    return 'normal';
  }, [speedData.speed, speedData.status, thresholds]);

  const speedColor = useMemo(() => {
    if (accessibility.highContrast) {
      switch (speedStatus) {
        case 'emergency': return '#ff0000';
        case 'critical': return '#ff0000';
        case 'warning': return '#ffaa00';
        case 'caution': return '#ffff00';
        case 'stopped': return '#888888';
        case 'normal': return '#00ff00';
        default: return '#ffffff';
      }
    }

    switch (speedStatus) {
      case 'emergency': return theme.palette.error.dark;
      case 'critical': return theme.palette.error.main;
      case 'warning': return theme.palette.warning.main;
      case 'caution': return theme.palette.warning.light;
      case 'stopped': return theme.palette.grey[500];
      case 'normal': return theme.palette.success.main;
      default: return theme.palette.info.main;
    }
  }, [speedStatus, theme, accessibility.highContrast]);

  // Monitor for speed alerts
  useEffect(() => {
    const now = new Date();
    const speed = speedData.speed;
    const newAlerts: SpeedAlert[] = [];

    // Check for overspeeding
    if (speed > thresholds.critical) {
      const existingAlert = alerts.find(a => a.type === 'overspeeding' && !a.acknowledged);
      if (!existingAlert) {
        newAlerts.push({
          id: `overspeeding-${now.getTime()}`,
          type: 'overspeeding',
          speed,
          threshold: thresholds.critical,
          message: `CRITICAL: Speed ${convertSpeed(speed).toFixed(1)} ${speedUnit} exceeds maximum safe limit of ${convertSpeed(thresholds.critical).toFixed(1)} ${speedUnit}`,
          timestamp: now,
          acknowledged: false
        });
      }
    }

    // Check for rapid acceleration
    if (Math.abs(speedData.acceleration) > 5) { // 5 m/s² threshold
      const existingAccelAlert = alerts.find(a => a.type === 'rapid_acceleration' && !a.acknowledged);
      if (!existingAccelAlert) {
        newAlerts.push({
          id: `rapid_accel-${now.getTime()}`,
          type: 'rapid_acceleration',
          speed,
          message: `Rapid ${speedData.acceleration > 0 ? 'acceleration' : 'deceleration'}: ${Math.abs(speedData.acceleration).toFixed(1)} m/s²`,
          timestamp: now,
          acknowledged: false
        });
      }
    }

    // Check for emergency stop
    if (speedData.status === 'emergency_stop') {
      const existingEmergency = alerts.find(a => a.type === 'emergency_stop' && !a.acknowledged);
      if (!existingEmergency) {
        newAlerts.push({
          id: `emergency-${now.getTime()}`,
          type: 'emergency_stop',
          speed,
          message: 'EMERGENCY STOP activated',
          timestamp: now,
          acknowledged: false
        });
      }
    }

    // Check for low efficiency
    if (speedData.efficiency !== undefined && speedData.efficiency < 60 && speed > 0) {
      const existingEfficiency = alerts.find(a => a.type === 'efficiency_low' && !a.acknowledged);
      if (!existingEfficiency) {
        newAlerts.push({
          id: `efficiency-${now.getTime()}`,
          type: 'efficiency_low',
          speed,
          message: `Low energy efficiency: ${speedData.efficiency}%`,
          timestamp: now,
          acknowledged: false
        });
      }
    }

    if (newAlerts.length > 0) {
      setAlerts(prevAlerts => [...prevAlerts, ...newAlerts]);
      
      newAlerts.forEach(alert => {
        onSpeedAlert?.(alert);
        announceToScreenReader(alert.message, alert.type === 'overspeeding' || alert.type === 'emergency_stop' ? 'assertive' : 'polite');
        
        if (accessibility.voiceAlerts) {
          announceWithVoice(alert.message);
        }
      });
    }
  }, [speedData, thresholds, alerts, onSpeedAlert, accessibility.voiceAlerts, convertSpeed, speedUnit]);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegionRef.current) return;

    // Throttle announcements
    const now = new Date();
    if (lastAnnouncementTime && (now.getTime() - lastAnnouncementTime.getTime()) < 2000) {
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
    utterance.rate = 1.0;
    utterance.volume = 0.9;
    utterance.pitch = speedStatus === 'emergency' || speedStatus === 'critical' ? 1.3 : 1.0;
    
    window.speechSynthesis.speak(utterance);
  }, [speedStatus]);

  const generateStatusAnnouncement = useCallback((): string => {
    const speed = convertedSpeed.toFixed(1);
    const status = speedData.status;
    
    let announcement = `Current speed: ${speed} ${speedUnit}, status: ${status}`;
    
    if (showDirection) {
      const direction = getDirectionName(speedData.direction);
      announcement += `, heading ${direction}`;
    }
    
    if (showAcceleration && Math.abs(speedData.acceleration) > 0.1) {
      const accelType = speedData.acceleration > 0 ? 'accelerating' : 'decelerating';
      announcement += `, ${accelType} at ${Math.abs(speedData.acceleration).toFixed(1)} meters per second squared`;
    }
    
    if (speedData.efficiency !== undefined) {
      announcement += `, efficiency ${speedData.efficiency}%`;
    }
    
    const activeAlerts = alerts.filter(a => !a.acknowledged);
    if (activeAlerts.length > 0) {
      announcement += `, ${activeAlerts.length} active alert${activeAlerts.length > 1 ? 's' : ''}`;
    }
    
    return announcement;
  }, [convertedSpeed, speedUnit, speedData, showDirection, showAcceleration, alerts]);

  const generateDataSummary = useCallback((): string => {
    const maxSpeedReached = speedHistory.length > 0 ? 
      Math.max(...speedHistory.map(h => convertSpeed(h.speed))) : 0;
    
    const avgSpeed = speedHistory.length > 0 ? 
      speedHistory.reduce((sum, h) => sum + convertSpeed(h.speed), 0) / speedHistory.length : 0;
    
    let summary = `Speed gauge displaying current speed of ${convertedSpeed.toFixed(1)} ${speedUnit}. `;
    summary += `Status: ${speedData.status}. `;
    
    if (speedHistory.length > 5) {
      summary += `Maximum speed reached: ${maxSpeedReached.toFixed(1)} ${speedUnit}. `;
      summary += `Average speed: ${avgSpeed.toFixed(1)} ${speedUnit}. `;
    }
    
    summary += `Safe maximum: ${convertedThresholds.maxSafe.toFixed(1)} ${speedUnit}, `;
    summary += `Warning threshold: ${convertedThresholds.warning.toFixed(1)} ${speedUnit}, `;
    summary += `Critical threshold: ${convertedThresholds.critical.toFixed(1)} ${speedUnit}. `;
    
    if (speedData.distance > 0) {
      summary += `Total distance traveled: ${(speedData.distance / 1000).toFixed(2)} kilometers. `;
    }
    
    return summary;
  }, [convertedSpeed, speedUnit, speedData, speedHistory, convertSpeed, convertedThresholds]);

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
          const summary = generateDataSummary();
          announceToScreenReader(summary, 'assertive');
        }
        break;
      case 'c':
      case 'C':
        if (altKey) {
          event.preventDefault();
          const currentStatus = generateStatusAnnouncement();
          announceToScreenReader(currentStatus, 'polite');
        }
        break;
      case 't':
      case 'T':
        if (altKey) {
          event.preventDefault();
          setShowAlternativeView(!showAlternativeView);
          announceToScreenReader(`Switched to ${showAlternativeView ? 'gauge' : 'table'} view`, 'polite');
        }
        break;
    }
  }, [generateDataSummary, generateStatusAnnouncement, showAlternativeView, announceToScreenReader]);

  // SVG Gauge Component
  const renderGauge = () => {
    const size = compactMode ? 120 : 200;
    const center = size / 2;
    const radius = (size / 2) - 20;
    const circumference = 2 * Math.PI * radius;
    
    // Calculate angle for current speed (0-180 degrees)
    const maxAngle = 180;
    const speedAngle = Math.min((convertedSpeed / convertedMaxSpeed) * maxAngle, maxAngle);
    
    // Create threshold markers
    const thresholdAngles = {
      maxSafe: (convertedThresholds.maxSafe / convertedMaxSpeed) * maxAngle,
      warning: (convertedThresholds.warning / convertedMaxSpeed) * maxAngle,
      critical: (convertedThresholds.critical / convertedMaxSpeed) * maxAngle
    };

    return (
      <svg
        ref={gaugeRef}
        width={size}
        height={size * 0.7}
        viewBox={`0 0 ${size} ${size * 0.7}`}
        role="img"
        aria-label={generateStatusAnnouncement()}
        tabIndex={0}
        onKeyDown={handleKeyboardNavigation}
        style={{
          outline: 'none',
          '&:focus': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px'
          }
        }}
      >
        {/* Background arc */}
        <path
          d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`}
          fill="none"
          stroke={accessibility.highContrast ? '#333333' : theme.palette.grey[300]}
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* Speed arc */}
        <path
          d={`M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius * Math.cos((Math.PI * speedAngle) / 180)} ${center - radius * Math.sin((Math.PI * speedAngle) / 180)}`}
          fill="none"
          stroke={speedColor}
          strokeWidth="8"
          strokeLinecap="round"
          style={{
            transition: accessibility.reducedMotion ? 'none' : 'all 0.3s ease'
          }}
        />
        
        {/* Threshold markers */}
        {Object.entries(thresholdAngles).map(([key, angle]) => {
          const x = center + radius * Math.cos((Math.PI * angle) / 180);
          const y = center - radius * Math.sin((Math.PI * angle) / 180);
          const color = key === 'critical' ? theme.palette.error.main : 
                      key === 'warning' ? theme.palette.warning.main : 
                      theme.palette.success.main;
          
          return (
            <circle
              key={key}
              cx={x}
              cy={y}
              r="4"
              fill={color}
              aria-label={`${key} threshold at ${convertedThresholds[key as keyof typeof convertedThresholds].toFixed(1)} ${speedUnit}`}
            />
          );
        })}
        
        {/* Center display */}
        <circle
          cx={center}
          cy={center}
          r="30"
          fill={accessibility.highContrast ? '#000000' : theme.palette.background.paper}
          stroke={speedColor}
          strokeWidth="2"
        />
        
        {/* Speed text */}
        <text
          x={center}
          y={center - 5}
          textAnchor="middle"
          fontSize={compactMode ? "14" : "18"}
          fontWeight="bold"
          fill={accessibility.highContrast ? '#ffffff' : theme.palette.text.primary}
        >
          {convertedSpeed.toFixed(1)}
        </text>
        
        {/* Unit text */}
        <text
          x={center}
          y={center + 15}
          textAnchor="middle"
          fontSize={compactMode ? "10" : "12"}
          fill={accessibility.highContrast ? '#ffffff' : theme.palette.text.secondary}
        >
          {speedUnit}
        </text>
      </svg>
    );
  };

  // Alternative table view
  const renderAlternativeView = () => (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small" aria-label="Speed data table">
        <TableHead>
          <TableRow>
            <TableCell>Metric</TableCell>
            <TableCell align="right">Value</TableCell>
            <TableCell align="right">Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Current Speed</TableCell>
            <TableCell align="right">{convertedSpeed.toFixed(1)} {speedUnit}</TableCell>
            <TableCell align="right">
              <Chip 
                label={speedStatus} 
                color={speedStatus === 'critical' || speedStatus === 'emergency' ? 'error' : 
                       speedStatus === 'warning' || speedStatus === 'caution' ? 'warning' : 'success'}
                size="small"
              />
            </TableCell>
          </TableRow>
          
          {showDirection && (
            <TableRow>
              <TableCell>Direction</TableCell>
              <TableCell align="right">{speedData.direction}° ({getDirectionName(speedData.direction)})</TableCell>
              <TableCell align="right">-</TableCell>
            </TableRow>
          )}
          
          {showAcceleration && (
            <TableRow>
              <TableCell>Acceleration</TableCell>
              <TableCell align="right">{speedData.acceleration.toFixed(2)} m/s²</TableCell>
              <TableCell align="right">
                {Math.abs(speedData.acceleration) > 5 ? 
                  <Chip label="High" color="warning" size="small" /> : 
                  <Chip label="Normal" color="success" size="small" />
                }
              </TableCell>
            </TableRow>
          )}
          
          <TableRow>
            <TableCell>Distance Traveled</TableCell>
            <TableCell align="right">{(speedData.distance / 1000).toFixed(2)} km</TableCell>
            <TableCell align="right">-</TableCell>
          </TableRow>
          
          {speedData.efficiency !== undefined && (
            <TableRow>
              <TableCell>Energy Efficiency</TableCell>
              <TableCell align="right">{speedData.efficiency}%</TableCell>
              <TableCell align="right">
                <Chip 
                  label={speedData.efficiency >= 80 ? 'Excellent' : speedData.efficiency >= 60 ? 'Good' : 'Poor'} 
                  color={speedData.efficiency >= 80 ? 'success' : speedData.efficiency >= 60 ? 'info' : 'warning'}
                  size="small"
                />
              </TableCell>
            </TableRow>
          )}
          
          <TableRow>
            <TableCell>Max Safe Speed</TableCell>
            <TableCell align="right">{convertedThresholds.maxSafe.toFixed(1)} {speedUnit}</TableCell>
            <TableCell align="right">-</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  const getStatusIcon = () => {
    switch (speedStatus) {
      case 'emergency': return <StopIcon sx={{ color: speedColor }} />;
      case 'critical': return <WarningIcon sx={{ color: speedColor }} />;
      case 'warning': 
      case 'caution': return <SpeedIcon sx={{ color: speedColor }} />;
      case 'stopped': return <StopIcon sx={{ color: speedColor }} />;
      case 'normal': return <CheckIcon sx={{ color: speedColor }} />;
      default: return <CarIcon sx={{ color: speedColor }} />;
    }
  };

  return (
    <AccessibilityEnhancer
      chartType="Speed Gauge"
      chartData={[speedData]}
      options={{
        enabled: true,
        screenReaderOptimized: accessibility.screenReaderOptimized || false,
        keyboardNavigation: true,
        liveRegions: true,
        alternativeFormats: accessibility.alternativeFormats !== false,
        colorBlindFriendly: true,
        highContrast: accessibility.highContrast || false,
        reducedMotion: accessibility.reducedMotion || false
      }}
    >
      <Card
        ref={containerRef}
        sx={{
          backgroundColor: accessibility.highContrast ? '#000000' : 'inherit',
          color: accessibility.highContrast ? '#ffffff' : 'inherit',
          border: accessibility.highContrast ? '2px solid #ffffff' : 'none'
        }}
      >
        <CardContent>
          {/* Live region for announcements */}
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

          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon()}
              <Typography variant={compactMode ? "h6" : "h5"} component="h2">
                Speed Monitor
              </Typography>
            </Box>
            
            {accessibility.alternativeFormats !== false && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowAlternativeView(!showAlternativeView)}
                aria-label={`Switch to ${showAlternativeView ? 'gauge' : 'table'} view`}
              >
                {showAlternativeView ? 'Gauge View' : 'Table View'}
              </Button>
            )}
          </Box>

          {/* Active alerts */}
          {alerts.filter(a => !a.acknowledged).map(alert => (
            <Alert
              key={alert.id}
              severity={alert.type === 'overspeeding' || alert.type === 'emergency_stop' ? 'error' : 'warning'}
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
              sx={{ mb: 2 }}
            >
              {alert.message}
            </Alert>
          ))}

          {/* Main display */}
          {showAlternativeView ? (
            renderAlternativeView()
          ) : (
            <Box sx={{ display: 'flex', flexDirection: compactMode ? 'row' : 'column', alignItems: 'center', gap: 2 }}>
              {renderGauge()}
              
              {!compactMode && (
                <Box sx={{ textAlign: 'center', width: '100%' }}>
                  {/* Status indicators */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={`Status: ${speedData.status}`}
                      color={getChipColor(speedStatus)}
                      size="small"
                    />
                    <Chip
                      label={`${convertedSpeed.toFixed(1)} ${speedUnit}`}
                      variant="outlined"
                      size="small"
                    />
                    {speedData.efficiency !== undefined && (
                      <Chip
                        label={`${speedData.efficiency}% efficiency`}
                        color={speedData.efficiency >= 60 ? 'success' : 'warning'}
                        size="small"
                      />
                    )}
                  </Box>

                  {/* Progress bar representation */}
                  <Box sx={{ width: '100%', mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Speed Progress ({convertedSpeed.toFixed(1)} / {convertedMaxSpeed.toFixed(1)} {speedUnit})
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={(convertedSpeed / convertedMaxSpeed) * 100}
                      sx={{
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: accessibility.highContrast ? '#333333' : undefined,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: speedColor,
                          borderRadius: 5,
                          transition: accessibility.reducedMotion ? 'none' : undefined
                        }
                      }}
                      aria-label={`Speed level ${((convertedSpeed / convertedMaxSpeed) * 100).toFixed(1)} percent`}
                    />
                  </Box>

                  {/* Additional metrics */}
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 2 }}>
                    {showDirection && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Direction</Typography>
                        <Typography variant="h6">{speedData.direction}°</Typography>
                        <Typography variant="caption">{getDirectionName(speedData.direction)}</Typography>
                      </Box>
                    )}
                    
                    {showAcceleration && (
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="body2" color="text.secondary">Acceleration</Typography>
                        <Typography variant="h6">{speedData.acceleration.toFixed(1)}</Typography>
                        <Typography variant="caption">m/s²</Typography>
                      </Box>
                    )}
                    
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Distance</Typography>
                      <Typography variant="h6">{(speedData.distance / 1000).toFixed(2)}</Typography>
                      <Typography variant="caption">km</Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Keyboard shortcuts */}
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ display: 'block', mt: 2 }}
          >
            Keyboard: Alt+S (summary), Alt+C (current status), Alt+T (toggle view)
          </Typography>
        </CardContent>
      </Card>
    </AccessibilityEnhancer>
  );
};

// Helper functions
function getDirectionName(degrees: number): string {
  const directions = [
    'North', 'North-Northeast', 'Northeast', 'East-Northeast',
    'East', 'East-Southeast', 'Southeast', 'South-Southeast',
    'South', 'South-Southwest', 'Southwest', 'West-Southwest',
    'West', 'West-Northwest', 'Northwest', 'North-Northwest'
  ];
  
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

function getChipColor(status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'emergency':
    case 'critical':
      return 'error';
    case 'warning':
    case 'caution':
      return 'warning';
    case 'normal':
      return 'success';
    case 'stopped':
      return 'default';
    default:
      return 'info';
  }
}

export default AccessibleSpeedGauge;