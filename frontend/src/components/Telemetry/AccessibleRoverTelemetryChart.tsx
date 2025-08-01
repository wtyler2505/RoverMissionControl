/**
 * Accessible Rover Telemetry Chart
 * Mission-critical telemetry visualization with comprehensive accessibility features
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, Alert, Chip, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import * as d3 from 'd3';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { AccessibleChartBase, AccessibleChartProps } from '../Charts/accessibility/AccessibleChartBase';
import AccessibilityEnhancer, { FocusableElement } from '../Charts/accessibility/AccessibilityEnhancer';

export interface RoverTelemetryData {
  timestamp: number;
  time: Date;
  batteryLevel: number;
  temperature: number;
  speed: number;
  location: { x: number; y: number };
  sensors: {
    cpu: number;
    memory: number;
    disk: number;
  };
  status: 'normal' | 'warning' | 'critical' | 'offline';
  quality: number; // Signal quality 0-100
}

export interface AccessibleRoverTelemetryChartProps extends AccessibleChartProps {
  telemetryData: RoverTelemetryData[];
  metric: 'battery' | 'temperature' | 'speed' | 'all';
  showThresholds?: boolean;
  criticalThresholds?: {
    battery: { low: number; critical: number };
    temperature: { high: number; critical: number };
    speed: { max: number };
  };
  onAlertTriggered?: (alert: { metric: string; value: number; threshold: number; severity: 'warning' | 'critical' }) => void;
  realTimeMode?: boolean;
  bufferSize?: number;
}

interface ChartAlert {
  id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  acknowledged: boolean;
}

const AccessibleRoverTelemetryChart: React.FC<AccessibleRoverTelemetryChartProps> = ({
  telemetryData,
  metric,
  showThresholds = true,
  criticalThresholds = {
    battery: { low: 20, critical: 10 },
    temperature: { high: 75, critical: 85 },
    speed: { max: 50 }
  },
  onAlertTriggered,
  realTimeMode = false,
  bufferSize = 100,
  ...accessibleProps
}) => {
  const theme = useTheme();
  const [alerts, setAlerts] = useState<ChartAlert[]>([]);
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState<Date | null>(null);
  const [focusedDataPoint, setFocusedDataPoint] = useState<RoverTelemetryData | null>(null);

  // Process data for display
  const processedData = useMemo(() => {
    const data = realTimeMode && telemetryData.length > bufferSize 
      ? telemetryData.slice(-bufferSize) 
      : telemetryData;

    return data.map((point, index) => ({
      ...point,
      index,
      timeFormatted: point.time.toLocaleString(),
      batteryStatus: getBatteryStatus(point.batteryLevel, criticalThresholds.battery),
      temperatureStatus: getTemperatureStatus(point.temperature, criticalThresholds.temperature),
      speedStatus: getSpeedStatus(point.speed, criticalThresholds.speed)
    }));
  }, [telemetryData, realTimeMode, bufferSize, criticalThresholds]);

  // Chart configuration based on metric
  const chartConfig = useMemo(() => {
    switch (metric) {
      case 'battery':
        return {
          dataKey: 'batteryLevel',
          name: 'Battery Level (%)',
          color: theme.palette.success.main,
          domain: [0, 100],
          unit: '%',
          criticalLines: [
            { value: criticalThresholds.battery.critical, color: theme.palette.error.main, label: 'Critical' },
            { value: criticalThresholds.battery.low, color: theme.palette.warning.main, label: 'Low' }
          ]
        };
      case 'temperature':
        return {
          dataKey: 'temperature',
          name: 'Temperature (°C)',
          color: theme.palette.info.main,
          domain: [0, 100],
          unit: '°C',
          criticalLines: [
            { value: criticalThresholds.temperature.critical, color: theme.palette.error.main, label: 'Critical' },
            { value: criticalThresholds.temperature.high, color: theme.palette.warning.main, label: 'High' }
          ]
        };
      case 'speed':
        return {
          dataKey: 'speed',
          name: 'Speed (m/s)',
          color: theme.palette.primary.main,
          domain: [0, criticalThresholds.speed.max + 10],
          unit: 'm/s',
          criticalLines: [
            { value: criticalThresholds.speed.max, color: theme.palette.warning.main, label: 'Max Speed' }
          ]
        };
      default:
        return {
          dataKey: 'batteryLevel',
          name: 'Multiple Metrics',
          color: theme.palette.primary.main,
          domain: [0, 100],
          unit: 'mixed'
        };
    }
  }, [metric, theme, criticalThresholds]);

  // Monitor for threshold violations and create alerts
  useEffect(() => {
    if (telemetryData.length === 0) return;

    const latestData = telemetryData[telemetryData.length - 1];
    const newAlerts: ChartAlert[] = [];

    // Check battery alerts
    if (latestData.batteryLevel <= criticalThresholds.battery.critical) {
      newAlerts.push({
        id: `battery-critical-${Date.now()}`,
        metric: 'battery',
        value: latestData.batteryLevel,
        threshold: criticalThresholds.battery.critical,
        severity: 'critical',
        timestamp: latestData.time,
        acknowledged: false
      });
    } else if (latestData.batteryLevel <= criticalThresholds.battery.low) {
      newAlerts.push({
        id: `battery-low-${Date.now()}`,
        metric: 'battery',
        value: latestData.batteryLevel,
        threshold: criticalThresholds.battery.low,
        severity: 'warning',
        timestamp: latestData.time,
        acknowledged: false
      });
    }

    // Check temperature alerts
    if (latestData.temperature >= criticalThresholds.temperature.critical) {
      newAlerts.push({
        id: `temp-critical-${Date.now()}`,
        metric: 'temperature',
        value: latestData.temperature,
        threshold: criticalThresholds.temperature.critical,
        severity: 'critical',
        timestamp: latestData.time,
        acknowledged: false
      });
    } else if (latestData.temperature >= criticalThresholds.temperature.high) {
      newAlerts.push({
        id: `temp-high-${Date.now()}`,
        metric: 'temperature',
        value: latestData.temperature,
        threshold: criticalThresholds.temperature.high,
        severity: 'warning',
        timestamp: latestData.time,
        acknowledged: false
      });
    }

    // Check speed alerts
    if (latestData.speed > criticalThresholds.speed.max) {
      newAlerts.push({
        id: `speed-max-${Date.now()}`,
        metric: 'speed',
        value: latestData.speed,
        threshold: criticalThresholds.speed.max,
        severity: 'warning',
        timestamp: latestData.time,
        acknowledged: false
      });
    }

    if (newAlerts.length > 0) {
      setAlerts(prevAlerts => [...prevAlerts, ...newAlerts]);
      
      // Trigger callbacks and announcements
      newAlerts.forEach(alert => {
        onAlertTriggered?.(alert);
        announceAlert(alert);
      });
    }
  }, [telemetryData, criticalThresholds, onAlertTriggered]);

  const announceAlert = useCallback((alert: ChartAlert) => {
    const now = new Date();
    
    // Throttle announcements to avoid overwhelming screen readers
    if (lastAnnouncement && (now.getTime() - lastAnnouncement.getTime()) < 5000) {
      return;
    }

    const announcement = `${alert.severity.toUpperCase()} ALERT: ${alert.metric} ${alert.value}${getUnitForMetric(alert.metric)} ${alert.severity === 'critical' ? 'is critically' : 'has exceeded'} threshold of ${alert.threshold}${getUnitForMetric(alert.metric)}`;
    
    // This would typically use the AccessibilityEnhancer's announcement system
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.rate = 0.9;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    }

    setLastAnnouncement(now);
  }, [lastAnnouncement]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  const clearAcknowledgedAlerts = useCallback(() => {
    setAlerts(prevAlerts => prevAlerts.filter(alert => !alert.acknowledged));
  }, []);

  // Custom tooltip with accessibility
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload as RoverTelemetryData & { index: number };
    
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
        aria-label={`Data point details for ${new Date(label).toLocaleString()}`}
      >
        <Typography variant="subtitle2" gutterBottom>
          {new Date(label).toLocaleString()}
        </Typography>
        
        {metric === 'all' ? (
          <>
            <Typography variant="body2">Battery: {data.batteryLevel}%</Typography>
            <Typography variant="body2">Temperature: {data.temperature}°C</Typography>
            <Typography variant="body2">Speed: {data.speed} m/s</Typography>
          </>
        ) : (
          <Typography variant="body2">
            {chartConfig.name}: {payload[0].value}{chartConfig.unit}
          </Typography>
        )}
        
        <Typography variant="body2" color="text.secondary">
          Status: {data.status}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Signal Quality: {data.quality}%
        </Typography>
      </Box>
    );
  };

  // Generate comprehensive data summary for screen readers
  const generateDataSummary = useCallback((): string => {
    if (processedData.length === 0) return 'No telemetry data available';

    const latestData = processedData[processedData.length - 1];
    const dataRange = processedData.length > 1 ? 
      `spanning ${processedData.length} data points from ${processedData[0].timeFormatted} to ${latestData.timeFormatted}` : 
      `single data point at ${latestData.timeFormatted}`;

    let summary = `Rover telemetry chart ${dataRange}. `;

    if (metric === 'all') {
      summary += `Current status: Battery at ${latestData.batteryLevel}%, temperature at ${latestData.temperature}°C, speed at ${latestData.speed} meters per second. `;
    } else {
      const value = latestData[chartConfig.dataKey as keyof RoverTelemetryData];
      summary += `Current ${chartConfig.name.toLowerCase()}: ${value}${chartConfig.unit}. `;
    }

    // Add alert information
    const activeAlerts = alerts.filter(alert => !alert.acknowledged);
    if (activeAlerts.length > 0) {
      const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
      const warningAlerts = activeAlerts.filter(alert => alert.severity === 'warning');
      
      if (criticalAlerts.length > 0) {
        summary += `CRITICAL: ${criticalAlerts.length} critical alert${criticalAlerts.length > 1 ? 's' : ''} active. `;
      }
      if (warningAlerts.length > 0) {
        summary += `WARNING: ${warningAlerts.length} warning alert${warningAlerts.length > 1 ? 's' : ''} active. `;
      }
    }

    summary += `Overall rover status: ${latestData.status}. Signal quality: ${latestData.quality}%.`;

    return summary;
  }, [processedData, chartConfig, metric, alerts]);

  // Generate data point specific labels
  const generateDataPointLabel = useCallback((dataPoint: any, index: number): string => {
    const point = dataPoint as RoverTelemetryData;
    const baseLabel = `Data point ${index + 1} of ${processedData.length}`;
    const timeLabel = `Time: ${point.time.toLocaleString()}`;
    
    if (metric === 'all') {
      return `${baseLabel}, ${timeLabel}, Battery: ${point.batteryLevel}%, Temperature: ${point.temperature}°C, Speed: ${point.speed} m/s, Status: ${point.status}`;
    } else {
      const value = point[chartConfig.dataKey as keyof RoverTelemetryData];
      return `${baseLabel}, ${timeLabel}, ${chartConfig.name}: ${value}${chartConfig.unit}, Status: ${point.status}`;
    }
  }, [processedData.length, metric, chartConfig]);

  const generateDataPointDescription = useCallback((dataPoint: any, index: number): string => {
    const point = dataPoint as RoverTelemetryData;
    const parts = [
      `Signal quality: ${point.quality}%`,
      `Location: X=${point.location.x}, Y=${point.location.y}`,
      `CPU usage: ${point.sensors.cpu}%`,
      `Memory usage: ${point.sensors.memory}%`,
      `Disk usage: ${point.sensors.disk}%`
    ];
    
    return parts.join(', ');
  }, []);

  const handleDataPointSelect = useCallback((dataPoint: any, index: number) => {
    const point = processedData[index];
    setFocusedDataPoint(point);
    
    // Announce selection to screen reader
    const announcement = generateDataPointLabel(point, index);
    // This would use the AccessibilityEnhancer's announcement system in practice
    console.log('Screen reader announcement:', announcement);
  }, [processedData, generateDataPointLabel]);

  const renderAlerts = () => {
    const activeAlerts = alerts.filter(alert => !alert.acknowledged);
    
    if (activeAlerts.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        {activeAlerts.slice(0, 3).map(alert => (
          <Alert
            key={alert.id}
            severity={alert.severity}
            action={
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => acknowledgeAlert(alert.id)}
                aria-label={`Acknowledge ${alert.severity} alert for ${alert.metric}`}
              >
                Acknowledge
              </Button>
            }
            sx={{ mb: 1 }}
          >
            {alert.metric.toUpperCase()}: {alert.value}{getUnitForMetric(alert.metric)} exceeds {alert.threshold}{getUnitForMetric(alert.metric)} threshold
          </Alert>
        ))}
        
        {activeAlerts.length > 3 && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowAlertsDialog(true)}
            aria-label={`View all ${activeAlerts.length} active alerts`}
          >
            View All {activeAlerts.length} Alerts
          </Button>
        )}
      </Box>
    );
  };

  const renderChart = () => {
    if (metric === 'all') {
      // Multi-metric chart
      return (
        <ResponsiveContainer width="100%" height={400} role="img" aria-label="Multi-metric rover telemetry chart">
          <LineChart data={processedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timeFormatted" 
              tick={{ fontSize: 12 }}
              aria-label="Time axis"
            />
            <YAxis aria-label="Value axis" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="batteryLevel" 
              stroke={theme.palette.success.main}
              name="Battery (%)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, 'aria-label': 'Selected battery data point' }}
            />
            <Line 
              type="monotone" 
              dataKey="temperature" 
              stroke={theme.palette.info.main}
              name="Temperature (°C)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, 'aria-label': 'Selected temperature data point' }}
            />
            <Line 
              type="monotone" 
              dataKey="speed" 
              stroke={theme.palette.primary.main}
              name="Speed (m/s)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, 'aria-label': 'Selected speed data point' }}
            />
          </LineChart>
        </ResponsiveContainer>
      );
    } else {
      // Single metric chart
      return (
        <ResponsiveContainer width="100%" height={400} role="img" aria-label={`${chartConfig.name} rover telemetry chart`}>
          <LineChart data={processedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="timeFormatted" 
              tick={{ fontSize: 12 }}
              aria-label="Time axis"
            />
            <YAxis 
              domain={chartConfig.domain}
              aria-label={`${chartConfig.name} axis`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={chartConfig.dataKey} 
              stroke={chartConfig.color}
              name={chartConfig.name}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6, 'aria-label': `Selected ${chartConfig.name.toLowerCase()} data point` }}
            />
            
            {/* Threshold lines */}
            {showThresholds && chartConfig.criticalLines?.map((line, index) => (
              <Line
                key={`threshold-${index}`}
                type="monotone"
                dataKey={() => line.value}
                stroke={line.color}
                strokeDasharray="5 5"
                name={`${line.label} Threshold`}
                dot={false}
                aria-label={`${line.label} threshold line at ${line.value}${chartConfig.unit}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }
  };

  return (
    <AccessibilityEnhancer
      chartType={`Rover Telemetry ${metric === 'all' ? 'Multi-Metric' : chartConfig.name}`}
      chartData={processedData}
      options={{
        enabled: true,
        screenReaderOptimized: true,
        keyboardNavigation: true,
        liveRegions: true,
        alternativeFormats: true,
        colorBlindFriendly: true,
        highContrast: accessibleProps.highContrast || false,
        reducedMotion: accessibleProps.reducedMotion || false
      }}
      onDataPointSelect={handleDataPointSelect}
      onFocusChange={(element) => {
        // Handle focus changes for keyboard navigation
        if (element && element.type === 'data-point') {
          const index = element.value?.index;
          if (index !== undefined && processedData[index]) {
            setFocusedDataPoint(processedData[index]);
          }
        }
      }}
    >
      <Box>
        {/* Status indicators */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={`Status: ${processedData[processedData.length - 1]?.status || 'Unknown'}`}
            color={getStatusColor(processedData[processedData.length - 1]?.status)}
            size="small"
          />
          <Chip
            label={`Data Points: ${processedData.length}`}
            variant="outlined"
            size="small"
          />
          {realTimeMode && (
            <Chip
              label="Real-Time"
              color="primary"
              size="small"
            />
          )}
        </Box>

        {/* Active alerts */}
        {renderAlerts()}

        {/* Chart container */}
        <Box
          sx={{
            position: 'relative',
            '&:focus-within': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: '2px'
            }
          }}
          tabIndex={0}
          role="img"
          aria-label={generateDataSummary()}
          aria-describedby="telemetry-chart-description"
        >
          {renderChart()}
        </Box>

        {/* Screen reader description */}
        <div
          id="telemetry-chart-description"
          style={{ 
            position: 'absolute', 
            left: '-10000px', 
            width: '1px', 
            height: '1px', 
            overflow: 'hidden' 
          }}
        >
          {generateDataSummary()}
        </div>

        {/* Focused data point details */}
        {focusedDataPoint && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: theme.palette.action.hover, borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Selected Data Point Details
            </Typography>
            <Typography variant="body2">
              Time: {focusedDataPoint.time.toLocaleString()}
            </Typography>
            <Typography variant="body2">
              Battery: {focusedDataPoint.batteryLevel}% ({focusedDataPoint.batteryStatus})
            </Typography>
            <Typography variant="body2">
              Temperature: {focusedDataPoint.temperature}°C ({focusedDataPoint.temperatureStatus})
            </Typography>
            <Typography variant="body2">
              Speed: {focusedDataPoint.speed} m/s ({focusedDataPoint.speedStatus})
            </Typography>
            <Typography variant="body2">
              Status: {focusedDataPoint.status}
            </Typography>
            <Typography variant="body2">
              Signal Quality: {focusedDataPoint.quality}%
            </Typography>
          </Box>
        )}

        {/* Alerts dialog */}
        <Dialog
          open={showAlertsDialog}
          onClose={() => setShowAlertsDialog(false)}
          maxWidth="md"
          fullWidth
          aria-labelledby="alerts-dialog-title"
        >
          <DialogTitle id="alerts-dialog-title">
            Active Telemetry Alerts ({alerts.filter(a => !a.acknowledged).length})
          </DialogTitle>
          <DialogContent>
            {alerts.filter(a => !a.acknowledged).map(alert => (
              <Alert
                key={alert.id}
                severity={alert.severity}
                action={
                  <Button 
                    color="inherit" 
                    size="small" 
                    onClick={() => acknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </Button>
                }
                sx={{ mb: 1 }}
              >
                <Typography variant="subtitle2">
                  {alert.metric.toUpperCase()} Alert - {alert.timestamp.toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  Value: {alert.value}{getUnitForMetric(alert.metric)} exceeds threshold: {alert.threshold}{getUnitForMetric(alert.metric)}
                </Typography>
              </Alert>
            ))}
            
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={clearAcknowledgedAlerts}
              >
                Clear Acknowledged
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </AccessibilityEnhancer>
  );
};

// Helper functions
function getBatteryStatus(level: number, thresholds: { low: number; critical: number }): string {
  if (level <= thresholds.critical) return 'critical';
  if (level <= thresholds.low) return 'low';
  return 'normal';
}

function getTemperatureStatus(temp: number, thresholds: { high: number; critical: number }): string {
  if (temp >= thresholds.critical) return 'critical';
  if (temp >= thresholds.high) return 'high';
  return 'normal';
}

function getSpeedStatus(speed: number, thresholds: { max: number }): string {
  if (speed > thresholds.max) return 'excessive';
  return 'normal';
}

function getStatusColor(status?: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  switch (status) {
    case 'normal': return 'success';
    case 'warning': return 'warning';
    case 'critical': return 'error';
    case 'offline': return 'default';
    default: return 'info';
  }
}

function getUnitForMetric(metric: string): string {
  switch (metric) {
    case 'battery': return '%';
    case 'temperature': return '°C';
    case 'speed': return ' m/s';
    default: return '';
  }
}

export default AccessibleRoverTelemetryChart;