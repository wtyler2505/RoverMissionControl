/**
 * Accessibility Showcase for Rover Telemetry Components
 * Demonstrates all accessibility features and serves as a testing playground
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  Switch,
  Button,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Accessibility as AccessibilityIcon,
  Visibility as VisibilityIcon,
  VolumeUp as VolumeUpIcon,
  Keyboard as KeyboardIcon
} from '@mui/icons-material';

import AccessibleRoverTelemetryChart, { RoverTelemetryData } from './AccessibleRoverTelemetryChart';
import AccessibleBatteryVisualization, { BatteryData } from './AccessibleBatteryVisualization';
import AccessibleTemperatureChart, { TemperatureData } from './AccessibleTemperatureChart';
import AccessibleSpeedGauge, { SpeedData } from './AccessibleSpeedGauge';
import { AccessibilityTestRunner } from '../Charts/accessibility/AccessibilityTestRunner';
import AccessibilityReportDashboard from '../Charts/accessibility/AccessibilityReportDashboard';

interface AccessibilityShowcaseProps {
  realTimeMode?: boolean;
}

const AccessibilityShowcase: React.FC<AccessibilityShowcaseProps> = ({
  realTimeMode = true
}) => {
  const theme = useTheme();
  const [currentTab, setCurrentTab] = useState(0);
  
  // Accessibility settings
  const [accessibilitySettings, setAccessibilitySettings] = useState({
    highContrast: false,
    reducedMotion: false,
    screenReaderOptimized: false,
    voiceAlerts: false,
    alternativeFormats: true
  });

  // Mock telemetry data generation
  const [telemetryData, setTelemetryData] = useState<RoverTelemetryData[]>([]);
  const [batteryData, setBatteryData] = useState<BatteryData>({
    level: 75,
    voltage: 12.4,
    current: -2.1,
    temperature: 35,
    timeRemaining: 180,
    chargingStatus: 'discharging',
    health: 92,
    cycleCount: 156,
    timestamp: new Date()
  });
  const [temperatureData, setTemperatureData] = useState<TemperatureData[]>([]);
  const [speedData, setSpeedData] = useState<SpeedData>({
    timestamp: Date.now(),
    time: new Date(),
    speed: 5.2,
    direction: 45,
    acceleration: 0.3,
    status: 'moving',
    distance: 1250,
    efficiency: 78
  });

  // Generate mock data
  useEffect(() => {
    const generateMockData = () => {
      const now = new Date();
      
      // Generate telemetry data
      const newTelemetryData: RoverTelemetryData[] = [];
      for (let i = 0; i < 50; i++) {
        const timestamp = new Date(now.getTime() - (49 - i) * 60000); // 1-minute intervals
        newTelemetryData.push({
          timestamp: timestamp.getTime(),
          time: timestamp,
          batteryLevel: Math.max(10, 85 - i * 1.5 + Math.random() * 10 - 5),
          temperature: 25 + Math.sin(i * 0.2) * 15 + Math.random() * 5,
          speed: Math.max(0, 3 + Math.sin(i * 0.1) * 2 + Math.random() * 2),
          location: { x: i * 10, y: Math.sin(i * 0.1) * 50 },
          sensors: {
            cpu: 45 + Math.random() * 20,
            memory: 60 + Math.random() * 15,
            disk: 30 + Math.random() * 10
          },
          status: i > 40 && Math.random() > 0.8 ? 'warning' : 'normal',
          quality: Math.max(70, 95 - Math.random() * 15)
        });
      }
      setTelemetryData(newTelemetryData);

      // Generate temperature data
      const newTemperatureData: TemperatureData[] = [];
      const sensors = ['CPU', 'Battery', 'Motor'];
      
      for (let i = 0; i < 30; i++) {
        sensors.forEach(sensor => {
          const timestamp = new Date(now.getTime() - (29 - i) * 120000); // 2-minute intervals
          newTemperatureData.push({
            timestamp: timestamp.getTime(),
            time: timestamp,
            temperature: sensor === 'CPU' ? 45 + Math.random() * 25 :
                        sensor === 'Battery' ? 30 + Math.random() * 15 :
                        35 + Math.random() * 20,
            sensor,
            location: sensor === 'CPU' ? 'Main Board' : 
                     sensor === 'Battery' ? 'Power Module' : 'Drive System',
            status: Math.random() > 0.9 ? 'warning' : 'normal',
            humidity: 45 + Math.random() * 20,
            pressure: 101.3 + Math.random() * 2
          });
        });
      }
      setTemperatureData(newTemperatureData);
    };

    generateMockData();

    // Set up real-time updates if enabled
    if (realTimeMode) {
      const interval = setInterval(() => {
        // Update battery data
        setBatteryData(prev => ({
          ...prev,
          level: Math.max(5, prev.level - 0.1 + Math.random() * 0.2),
          voltage: 12.4 + Math.random() * 0.2 - 0.1,
          current: -2.1 + Math.random() * 0.4,
          temperature: 35 + Math.random() * 5,
          timestamp: new Date(),
          timeRemaining: Math.max(0, prev.timeRemaining! - 1)
        }));

        // Update speed data
        setSpeedData(prev => ({
          ...prev,
          timestamp: Date.now(),
          time: new Date(),
          speed: Math.max(0, prev.speed + (Math.random() - 0.5) * 0.5),
          direction: (prev.direction + Math.random() * 4 - 2) % 360,
          acceleration: Math.random() * 2 - 1,
          distance: prev.distance + prev.speed * 5 // 5-second updates
        }));

        // Add new telemetry point
        setTelemetryData(prev => {
          const latest = prev[prev.length - 1];
          const newPoint: RoverTelemetryData = {
            timestamp: Date.now(),
            time: new Date(),
            batteryLevel: Math.max(5, latest.batteryLevel - 0.02 + Math.random() * 0.1),
            temperature: latest.temperature + (Math.random() - 0.5) * 2,
            speed: Math.max(0, latest.speed + (Math.random() - 0.5) * 0.3),
            location: { 
              x: latest.location.x + latest.speed * 5, 
              y: latest.location.y + (Math.random() - 0.5) * 10 
            },
            sensors: {
              cpu: Math.max(20, Math.min(90, latest.sensors.cpu + (Math.random() - 0.5) * 5)),
              memory: Math.max(30, Math.min(95, latest.sensors.memory + (Math.random() - 0.5) * 3)),
              disk: Math.max(20, Math.min(85, latest.sensors.disk + (Math.random() - 0.5) * 2))
            },
            status: latest.batteryLevel < 15 ? 'critical' : 
                   latest.temperature > 75 ? 'warning' : 'normal',
            quality: Math.max(70, Math.min(100, latest.quality + (Math.random() - 0.5) * 5))
          };
          
          return [...prev.slice(-49), newPoint]; // Keep last 50 points
        });
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [realTimeMode]);

  const handleAccessibilityChange = (setting: keyof typeof accessibilitySettings) => {
    setAccessibilitySettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleAlert = (alert: any) => {
    console.log('Accessibility Alert:', alert);
    // In a real application, this would trigger system notifications
  };

  const tabContent = [
    {
      label: 'Multi-Metric Chart',
      content: (
        <AccessibleRoverTelemetryChart
          telemetryData={telemetryData}
          metric="all"
          showThresholds={true}
          criticalThresholds={{
            battery: { low: 25, critical: 15 },
            temperature: { high: 70, critical: 85 },
            speed: { max: 10 }
          }}
          onAlertTriggered={handleAlert}
          realTimeMode={realTimeMode}
          accessibility={accessibilitySettings}
        />
      )
    },
    {
      label: 'Battery Monitor',
      content: (
        <AccessibleBatteryVisualization
          batteryData={batteryData}
          showDetails={true}
          criticalLevel={15}
          lowLevel={25}
          onCriticalAlert={handleAlert}
          onLowBatteryWarning={handleAlert}
          enableVoiceAlerts={accessibilitySettings.voiceAlerts}
          accessibility={accessibilitySettings}
        />
      )
    },
    {
      label: 'Temperature Chart',
      content: (
        <AccessibleTemperatureChart
          temperatureData={temperatureData}
          selectedSensor="CPU"
          thresholds={{
            warning: 70,
            critical: 85,
            optimal: { min: 20, max: 65 }
          }}
          showTrends={true}
          realTimeMode={realTimeMode}
          onTemperatureAlert={handleAlert}
          accessibility={accessibilitySettings}
        />
      )
    },
    {
      label: 'Speed Gauge',
      content: (
        <AccessibleSpeedGauge
          speedData={speedData}
          maxDisplaySpeed={15}
          speedUnit="m/s"
          showDirection={true}
          showAcceleration={true}
          thresholds={{
            maxSafe: 8,
            warning: 10,
            critical: 12
          }}
          onSpeedAlert={handleAlert}
          accessibility={accessibilitySettings}
        />
      )
    }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AccessibilityIcon fontSize="large" />
          Accessible Rover Telemetry Showcase
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Demonstrating WCAG 2.1 AA compliant telemetry visualizations for mission-critical rover operations
        </Typography>
      </Box>

      {/* Accessibility Controls */}
      <Card sx={{ mb: 4 }}>
        <CardHeader 
          title="Accessibility Settings"
          subheader="Configure accessibility features to test different user needs"
          avatar={<AccessibilityIcon />}
        />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={accessibilitySettings.highContrast}
                    onChange={() => handleAccessibilityChange('highContrast')}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VisibilityIcon fontSize="small" />
                    High Contrast
                  </Box>
                }
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={accessibilitySettings.reducedMotion}
                    onChange={() => handleAccessibilityChange('reducedMotion')}
                    color="primary"
                  />
                }
                label="Reduced Motion"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={accessibilitySettings.screenReaderOptimized}
                    onChange={() => handleAccessibilityChange('screenReaderOptimized')}
                    color="primary"
                  />
                }
                label="Screen Reader Mode"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={accessibilitySettings.voiceAlerts}
                    onChange={() => handleAccessibilityChange('voiceAlerts')}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VolumeUpIcon fontSize="small" />
                    Voice Alerts
                  </Box>
                }
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Keyboard Instructions */}
      <Alert 
        severity="info" 
        sx={{ mb: 4 }}
        icon={<KeyboardIcon />}
      >
        <Typography variant="subtitle2" gutterBottom>
          Keyboard Navigation Instructions:
        </Typography>
        <Typography variant="body2">
          • <strong>Tab</strong> - Navigate between components
          • <strong>Arrow Keys</strong> - Navigate data points within charts
          • <strong>Alt+S</strong> - Announce data summary
          • <strong>Alt+C</strong> - Announce current status
          • <strong>Alt+H</strong> - Show keyboard help
          • <strong>Enter/Space</strong> - Activate focused element
          • <strong>Escape</strong> - Exit focus mode
        </Typography>
      </Alert>

      {/* Component Showcase */}
      <Card>
        <CardContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs 
              value={currentTab} 
              onChange={(_, newValue) => setCurrentTab(newValue)}
              aria-label="Telemetry component showcase tabs"
            >
              {tabContent.map((tab, index) => (
                <Tab 
                  key={index}
                  label={tab.label} 
                  id={`showcase-tab-${index}`}
                  aria-controls={`showcase-tabpanel-${index}`}
                />
              ))}
            </Tabs>
          </Box>

          {tabContent.map((tab, index) => (
            <Box
              key={index}
              role="tabpanel"
              hidden={currentTab !== index}
              id={`showcase-tabpanel-${index}`}
              aria-labelledby={`showcase-tab-${index}`}
            >
              {currentTab === index && (
                <Box>
                  <Typography variant="h5" gutterBottom>
                    {tab.label}
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  {tab.content}
                </Box>
              )}
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Accessibility Information */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Accessibility Features Implemented
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                WCAG 2.1 AA Compliance:
              </Typography>
              <ul>
                <li>Color contrast ratios meet 4.5:1 requirement</li>
                <li>All interactive elements are keyboard accessible</li>
                <li>Proper ARIA labels and descriptions</li>
                <li>Live regions for real-time data announcements</li>
                <li>Focus indicators visible and sufficient</li>
                <li>Alternative text for all visual content</li>
              </ul>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom>
                Mission-Critical Features:
              </Typography>
              <ul>
                <li>Emergency alerts with assertive announcements</li>
                <li>Voice synthesis for critical alerts</li>
                <li>High contrast mode for extreme conditions</li>
                <li>Reduced motion support for vestibular sensitivity</li>
                <li>Alternative data table formats</li>
                <li>Comprehensive keyboard navigation</li>
              </ul>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  );
};

export default AccessibilityShowcase;