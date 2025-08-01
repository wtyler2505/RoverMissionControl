/**
 * Accessible Temperature Chart Component
 * Real-time temperature monitoring with comprehensive accessibility features
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
  Switch,
  FormControlLabel,
  Slider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
  Thermostat as ThermostatIcon,
  Warning as WarningIcon,
  ErrorOutline as ErrorIcon,
  CheckCircle as CheckIcon
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

import AccessibilityEnhancer from '../Charts/accessibility/AccessibilityEnhancer';

export interface TemperatureData {
  timestamp: number;
  time: Date;
  temperature: number; // Celsius
  sensor: string;
  location: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
  humidity?: number; // Optional humidity reading
  pressure?: number; // Optional pressure reading
}

export interface AccessibleTemperatureChartProps {
  temperatureData: TemperatureData[];
  sensors?: string[];
  selectedSensor?: string;
  onSensorChange?: (sensor: string) => void;
  thresholds?: {
    warning: number;
    critical: number;
    optimal: { min: number; max: number };
  };
  showTrends?: boolean;
  realTimeMode?: boolean;
  onTemperatureAlert?: (alert: TemperatureAlert) => void;
  accessibility?: {
    highContrast?: boolean;
    reducedMotion?: boolean;
    screenReaderOptimized?: boolean;
    voiceAlerts?: boolean;
  };
}

interface TemperatureAlert {
  id: string;
  sensor: string;
  temperature: number;
  threshold: number;
  type: 'warning' | 'critical' | 'normal';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface TrendAnalysis {
  direction: 'rising' | 'falling' | 'stable';
  rate: number; // degrees per minute
  prediction: number; // predicted temperature in 5 minutes
}

const AccessibleTemperatureChart: React.FC<AccessibleTemperatureChartProps> = ({
  temperatureData,
  sensors = [],
  selectedSensor,
  onSensorChange,
  thresholds = {
    warning: 70,
    critical: 85,
    optimal: { min: 20, max: 65 }
  },
  showTrends = true,
  realTimeMode = false,
  onTemperatureAlert,
  accessibility = {}
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const [alerts, setAlerts] = useState<TemperatureAlert[]>([]);
  const [focusedDataPoint, setFocusedDataPoint] = useState<TemperatureData | null>(null);
  const [announcementInterval, setAnnouncementInterval] = useState(30); // seconds
  const [lastAnnouncementTime, setLastAnnouncementTime] = useState<Date | null>(null);
  const [trendAnalysis, setTrendAnalysis] = useState<TrendAnalysis | null>(null);

  // Filter data by selected sensor
  const filteredData = useMemo(() => {
    if (!selectedSensor) return temperatureData;
    return temperatureData.filter(data => data.sensor === selectedSensor);
  }, [temperatureData, selectedSensor]);

  // Get current temperature and status
  const currentTemperature = useMemo(() => {
    return filteredData.length > 0 ? filteredData[filteredData.length - 1] : null;
  }, [filteredData]);

  // Calculate temperature status
  const getTemperatureStatus = useCallback((temp: number): 'normal' | 'warning' | 'critical' => {
    if (temp >= thresholds.critical) return 'critical';
    if (temp >= thresholds.warning) return 'warning';
    return 'normal';
  }, [thresholds]);

  // Calculate trend analysis
  const calculateTrend = useCallback((data: TemperatureData[]): TrendAnalysis | null => {
    if (data.length < 3) return null;

    const recent = data.slice(-5); // Last 5 data points
    const temperatures = recent.map(d => d.temperature);
    const times = recent.map(d => d.timestamp);

    // Simple linear regression for trend
    const n = temperatures.length;
    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = temperatures.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * temperatures[i], 0);
    const sumXX = times.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const ratePerMinute = slope * 60000; // Convert from per ms to per minute

    let direction: 'rising' | 'falling' | 'stable' = 'stable';
    if (Math.abs(ratePerMinute) > 0.1) {
      direction = ratePerMinute > 0 ? 'rising' : 'falling';
    }

    const currentTemp = temperatures[temperatures.length - 1];
    const prediction = currentTemp + (ratePerMinute * 5); // 5 minutes ahead

    return {
      direction,
      rate: Math.abs(ratePerMinute),
      prediction
    };
  }, []);

  // Update trend analysis
  useEffect(() => {
    if (showTrends && filteredData.length >= 3) {
      const trend = calculateTrend(filteredData);
      setTrendAnalysis(trend);
    }
  }, [filteredData, showTrends, calculateTrend]);

  // Monitor temperature changes for alerts
  useEffect(() => {
    if (!currentTemperature) return;

    const now = new Date();
    const temp = currentTemperature.temperature;
    const status = getTemperatureStatus(temp);
    const sensor = currentTemperature.sensor;

    // Check for new alerts
    const existingAlert = alerts.find(a => 
      a.sensor === sensor && 
      a.type === status && 
      !a.acknowledged &&
      (now.getTime() - a.timestamp.getTime()) < 300000 // 5 minutes
    );

    if (!existingAlert && status !== 'normal') {
      const newAlert: TemperatureAlert = {
        id: `${sensor}-${status}-${now.getTime()}`,
        sensor,
        temperature: temp,
        threshold: status === 'critical' ? thresholds.critical : thresholds.warning,
        type: status,
        message: `${sensor} temperature ${status}: ${temp.toFixed(1)}°C exceeds ${status === 'critical' ? thresholds.critical : thresholds.warning}°C threshold`,
        timestamp: now,
        acknowledged: false
      };

      setAlerts(prevAlerts => [...prevAlerts, newAlert]);
      onTemperatureAlert?.(newAlert);
      
      // Announce alert
      announceToScreenReader(newAlert.message, 'assertive');
      
      if (accessibility.voiceAlerts) {
        announceWithVoice(`Temperature alert: ${newAlert.message}`);
      }
    }
  }, [currentTemperature, getTemperatureStatus, thresholds, alerts, onTemperatureAlert, accessibility.voiceAlerts]);

  // Periodic status announcements
  useEffect(() => {
    if (!accessibility.screenReaderOptimized || !currentTemperature || announcementInterval <= 0) return;

    const interval = setInterval(() => {
      const now = new Date();
      if (lastAnnouncementTime && (now.getTime() - lastAnnouncementTime.getTime()) < (announcementInterval * 1000)) {
        return;
      }

      const announcement = generateStatusAnnouncement();
      announceToScreenReader(announcement, 'polite');
      setLastAnnouncementTime(now);
    }, announcementInterval * 1000);

    return () => clearInterval(interval);
  }, [accessibility.screenReaderOptimized, currentTemperature, announcementInterval, lastAnnouncementTime]);

  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!liveRegionRef.current) return;

    const liveRegion = liveRegionRef.current;
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.textContent = '';
    
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 100);
  }, []);

  const announceWithVoice = useCallback((message: string) => {
    if (!window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 0.9;
    utterance.volume = 0.8;
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const generateStatusAnnouncement = useCallback((): string => {
    if (!currentTemperature) return 'No temperature data available';

    const temp = currentTemperature.temperature.toFixed(1);
    const status = getTemperatureStatus(currentTemperature.temperature);
    const sensor = currentTemperature.sensor;
    const location = currentTemperature.location;
    
    let announcement = `${sensor} at ${location}: ${temp} degrees Celsius, status ${status}`;

    if (trendAnalysis && trendAnalysis.direction !== 'stable') {
      announcement += `, trending ${trendAnalysis.direction} at ${trendAnalysis.rate.toFixed(1)} degrees per minute`;
    }

    const activeAlerts = alerts.filter(a => !a.acknowledged && a.sensor === sensor);
    if (activeAlerts.length > 0) {
      announcement += `, ${activeAlerts.length} active alert${activeAlerts.length > 1 ? 's' : ''}`;
    }

    return announcement;
  }, [currentTemperature, getTemperatureStatus, trendAnalysis, alerts]);

  const generateDataSummary = useCallback((): string => {
    if (filteredData.length === 0) return 'No temperature data available';

    const dataCount = filteredData.length;
    const timeRange = dataCount > 1 ? 
      `from ${filteredData[0].time.toLocaleString()} to ${filteredData[dataCount - 1].time.toLocaleString()}` :
      `at ${filteredData[0].time.toLocaleString()}`;

    const temperatures = filteredData.map(d => d.temperature);
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;

    let summary = `Temperature chart for ${selectedSensor || 'all sensors'} with ${dataCount} data points ${timeRange}. `;
    summary += `Temperature range: ${minTemp.toFixed(1)}°C to ${maxTemp.toFixed(1)}°C, average ${avgTemp.toFixed(1)}°C. `;
    
    if (currentTemperature) {
      const status = getTemperatureStatus(currentTemperature.temperature);
      summary += `Current temperature: ${currentTemperature.temperature.toFixed(1)}°C, status ${status}. `;
    }

    const activeAlerts = alerts.filter(a => !a.acknowledged);
    if (activeAlerts.length > 0) {
      summary += `${activeAlerts.length} active alert${activeAlerts.length > 1 ? 's' : ''}. `;
    }

    summary += `Warning threshold: ${thresholds.warning}°C, Critical threshold: ${thresholds.critical}°C.`;

    return summary;
  }, [filteredData, selectedSensor, currentTemperature, getTemperatureStatus, alerts, thresholds]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    const { key, altKey, ctrlKey } = event;

    switch (key) {
      case 's':
      case 'S':
        if (altKey) {
          event.preventDefault();
          const summary = generateDataSummary();
          announceToScreenReader(summary, 'assertive');
        }
        break;
      case 't':
      case 'T':
        if (altKey) {
          event.preventDefault();
          if (trendAnalysis) {
            const trendMessage = `Temperature is ${trendAnalysis.direction} at ${trendAnalysis.rate.toFixed(1)} degrees per minute. Predicted temperature in 5 minutes: ${trendAnalysis.prediction.toFixed(1)} degrees Celsius.`;
            announceToScreenReader(trendMessage, 'polite');
          }
        }
        break;
      case 'a':
      case 'A':
        if (altKey) {
          event.preventDefault();
          const activeAlerts = alerts.filter(a => !a.acknowledged);
          if (activeAlerts.length > 0) {
            const alertMessage = `${activeAlerts.length} active alert${activeAlerts.length > 1 ? 's' : ''}. ${activeAlerts.map(a => a.message).join('. ')}`;
            announceToScreenReader(alertMessage, 'assertive');
          } else {
            announceToScreenReader('No active alerts', 'polite');
          }
        }
        break;
    }
  }, [generateDataSummary, trendAnalysis, alerts, announceToScreenReader]);

  const getTemperatureColor = useCallback((temp: number): string => {
    if (accessibility.highContrast) {
      const status = getTemperatureStatus(temp);
      switch (status) {
        case 'critical': return '#ff0000';
        case 'warning': return '#ffaa00';
        default: return '#00ff00';
      }
    }

    if (temp >= thresholds.critical) return theme.palette.error.main;
    if (temp >= thresholds.warning) return theme.palette.warning.main;
    if (temp >= thresholds.optimal.min && temp <= thresholds.optimal.max) return theme.palette.success.main;
    return theme.palette.info.main;
  }, [accessibility.highContrast, getTemperatureStatus, thresholds, theme]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload as TemperatureData;
    
    return (
      <Box
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          p: 2,
          boxShadow: theme.shadows[3]
        }}
        role="tooltip"
        aria-label={`Temperature data for ${data.time.toLocaleString()}`}
      >
        <Typography variant="subtitle2" gutterBottom>
          {data.sensor} - {data.location}
        </Typography>
        <Typography variant="body2">
          Time: {data.time.toLocaleString()}
        </Typography>
        <Typography variant="body2">
          Temperature: {data.temperature.toFixed(1)}°C
        </Typography>
        <Typography variant="body2">
          Status: {data.status}
        </Typography>
        {data.humidity && (
          <Typography variant="body2">
            Humidity: {data.humidity}%
          </Typography>
        )}
        {data.pressure && (
          <Typography variant="body2">
            Pressure: {data.pressure} kPa
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <AccessibilityEnhancer
      chartType="Temperature Monitoring Chart"
      chartData={filteredData}
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
      onDataPointSelect={(dataPoint, index) => {
        setFocusedDataPoint(filteredData[index]);
        const announcement = `Selected: ${dataPoint.sensor} at ${dataPoint.location}, ${dataPoint.temperature.toFixed(1)} degrees Celsius at ${dataPoint.time.toLocaleString()}`;
        announceToScreenReader(announcement, 'polite');
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

          {/* Header with current status */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ThermostatIcon 
                sx={{ 
                  color: currentTemperature ? getTemperatureColor(currentTemperature.temperature) : theme.palette.grey[500],
                  fontSize: 32 
                }}
              />
              <Box>
                <Typography variant="h5" component="h2">
                  Temperature Monitor
                </Typography>
                {currentTemperature && (
                  <Typography variant="h6" color={getTemperatureColor(currentTemperature.temperature)}>
                    {currentTemperature.temperature.toFixed(1)}°C
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Sensor selector */}
            {sensors.length > 1 && (
              <Box sx={{ minWidth: 150 }}>
                <Typography variant="body2" gutterBottom>Sensor:</Typography>
                <select
                  value={selectedSensor || ''}
                  onChange={(e) => onSensorChange?.(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: `1px solid ${theme.palette.divider}`,
                    backgroundColor: accessibility.highContrast ? '#000000' : theme.palette.background.paper,
                    color: accessibility.highContrast ? '#ffffff' : 'inherit'
                  }}
                  aria-label="Select temperature sensor"
                >
                  <option value="">All Sensors</option>
                  {sensors.map(sensor => (
                    <option key={sensor} value={sensor}>{sensor}</option>
                  ))}
                </select>
              </Box>
            )}
          </Box>

          {/* Active alerts */}
          {alerts.filter(a => !a.acknowledged).map(alert => (
            <Alert
              key={alert.id}
              severity={alert.type === 'critical' ? 'error' : 'warning'}
              action={
                <Button 
                  color="inherit" 
                  size="small" 
                  onClick={() => acknowledgeAlert(alert.id)}
                  aria-label={`Acknowledge ${alert.type} temperature alert`}
                >
                  Acknowledge
                </Button>
              }
              sx={{ mb: 2 }}
            >
              {alert.message}
            </Alert>
          ))}

          {/* Trend analysis */}
          {showTrends && trendAnalysis && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: theme.palette.action.hover, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Trend Analysis
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {trendAnalysis.direction === 'rising' ? (
                  <WarningIcon color="warning" />
                ) : trendAnalysis.direction === 'falling' ? (
                  <CheckIcon color="success" />
                ) : (
                  <CheckIcon color="info" />
                )}
                <Typography variant="body2">
                  Temperature is {trendAnalysis.direction} at {trendAnalysis.rate.toFixed(1)}°C/min
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Predicted: {trendAnalysis.prediction.toFixed(1)}°C in 5min
                </Typography>
              </Box>
            </Box>
          )}

          {/* Chart */}
          <Box
            ref={chartRef}
            sx={{
              height: 400,
              '&:focus-within': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: '2px'
              }
            }}
            tabIndex={0}
            role="img"
            aria-label={generateDataSummary()}
            onKeyDown={handleKeyboardNavigation}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time"
                  tickFormatter={(time) => new Date(time).toLocaleTimeString()}
                  aria-label="Time axis"
                />
                <YAxis 
                  domain={['dataMin - 5', 'dataMax + 5']}
                  aria-label="Temperature axis in degrees Celsius"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {/* Temperature line */}
                <Line 
                  type="monotone" 
                  dataKey="temperature" 
                  stroke={theme.palette.primary.main}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Temperature (°C)"
                />
                
                {/* Threshold lines */}
                <ReferenceLine 
                  y={thresholds.warning} 
                  stroke={theme.palette.warning.main}
                  strokeDasharray="5 5"
                  label={{ value: "Warning", position: "insideTopRight" }}
                />
                <ReferenceLine 
                  y={thresholds.critical} 
                  stroke={theme.palette.error.main}
                  strokeDasharray="5 5"
                  label={{ value: "Critical", position: "insideTopRight" }}
                />
                
                {/* Optimal range */}
                <ReferenceLine 
                  y={thresholds.optimal.min} 
                  stroke={theme.palette.success.main}
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                />
                <ReferenceLine 
                  y={thresholds.optimal.max} 
                  stroke={theme.palette.success.main}
                  strokeDasharray="2 2"
                  strokeOpacity={0.5}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Controls */}
          {accessibility.screenReaderOptimized && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: theme.palette.action.hover, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Accessibility Controls
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={accessibility.voiceAlerts || false}
                    onChange={(e) => {
                      // This would typically update parent state
                      console.log('Voice alerts:', e.target.checked);
                    }}
                    aria-label="Enable voice alerts for temperature changes"
                  />
                }
                label="Voice Alerts"
              />
              
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Announcement Interval: {announcementInterval}s
                </Typography>
                <Slider
                  value={announcementInterval}
                  onChange={(_, value) => setAnnouncementInterval(value as number)}
                  min={10}
                  max={120}
                  step={10}
                  marks={[
                    { value: 10, label: '10s' },
                    { value: 30, label: '30s' },
                    { value: 60, label: '1m' },
                    { value: 120, label: '2m' }
                  ]}
                  aria-label="Set interval for status announcements"
                />
              </Box>
            </Box>
          )}

          {/* Keyboard shortcuts */}
          <Typography 
            variant="caption" 
            color="text.secondary" 
            sx={{ display: 'block', mt: 2 }}
          >
            Keyboard: Alt+S (summary), Alt+T (trend), Alt+A (alerts)
          </Typography>
        </CardContent>
      </Card>
    </AccessibilityEnhancer>
  );
};

export default AccessibleTemperatureChart;