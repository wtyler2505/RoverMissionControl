/**
 * Chart Showcase Component
 * Demonstrates all chart types and their integration with the mission control system
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Paper
} from '@mui/material';

import {
  LineChart,
  AreaChart,
  BarChart,
  GaugeChart,
  HeatmapChart,
  ChartThemeProvider,
  useTimeSeriesData,
  useRealTimeData,
  commonPipelines
} from './index';

import {
  TimeSeriesDataPoint,
  ChartDataPoint,
  HeatmapDataPoint,
  GaugeDataPoint
} from './types';

// Generate sample data
const generateTimeSeriesData = (count = 50): TimeSeriesDataPoint[] => {
  const now = new Date();
  const data: TimeSeriesDataPoint[] = [];
  
  for (let i = 0; i < count; i++) {
    const time = new Date(now.getTime() - (count - i) * 1000);
    const baseValue = 50 + Math.sin(i / 10) * 20;
    const noise = (Math.random() - 0.5) * 10;
    const value = Math.max(0, baseValue + noise);
    
    let category: 'normal' | 'warning' | 'critical' = 'normal';
    if (value > 80) category = 'critical';
    else if (value > 65) category = 'warning';
    
    data.push({
      time,
      value,
      category,
      metadata: { sensorId: `sensor-${i % 3 + 1}` }
    });
  }
  
  return data;
};

const generateBarData = (): ChartDataPoint[] => {
  const categories = ['Power', 'Thermal', 'Navigation', 'Communication', 'Sensors'];
  return categories.map(cat => ({
    x: cat,
    y: Math.random() * 100,
    category: Math.random() > 0.7 ? 'critical' : Math.random() > 0.4 ? 'warning' : 'normal'
  }));
};

const generateHeatmapData = (): HeatmapDataPoint[] => {
  const data: HeatmapDataPoint[] = [];
  const sensors = ['Temp-1', 'Temp-2', 'Temp-3', 'Temp-4'];
  const timeSlots = ['00:00', '06:00', '12:00', '18:00'];
  
  sensors.forEach(sensor => {
    timeSlots.forEach(time => {
      data.push({
        x: time,
        y: sensor,
        value: 20 + Math.random() * 40,
        label: `${sensor} at ${time}`
      });
    });
  });
  
  return data;
};

const generateGaugeData = (): GaugeDataPoint => ({
  value: 65 + Math.random() * 20,
  min: 0,
  max: 100,
  thresholds: [
    { value: 70, label: 'Warning', color: '#ff9800' },
    { value: 85, label: 'Critical', color: '#f44336' }
  ]
});

export const ChartShowcase: React.FC = () => {
  const [selectedChart, setSelectedChart] = useState<string>('line');
  const [darkMode, setDarkMode] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showTooltips, setShowTooltips] = useState(true);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  // Sample data
  const timeSeriesData = useMemo(() => generateTimeSeriesData(), []);
  const barData = useMemo(() => generateBarData(), []);
  const heatmapData = useMemo(() => generateHeatmapData(), []);
  const [gaugeData, setGaugeData] = useState<GaugeDataPoint>(generateGaugeData());

  // Real-time data simulation
  const {
    data: realTimeData,
    isStreaming,
    startStreaming,
    stopStreaming
  } = useRealTimeData(
    () => {
      const now = new Date();
      const value = 50 + Math.sin(Date.now() / 10000) * 25 + (Math.random() - 0.5) * 10;
      let category: 'normal' | 'warning' | 'critical' = 'normal';
      if (value > 80) category = 'critical';
      else if (value > 65) category = 'warning';
      
      return [{
        time: now,
        value: Math.max(0, Math.min(100, value)),
        category,
        metadata: { realTime: true }
      }];
    },
    2000, // Update every 2 seconds
    100 // Keep last 100 points
  );

  // Update gauge data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setGaugeData(generateGaugeData());
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Toggle real-time streaming
  const handleRealTimeToggle = () => {
    if (realTimeEnabled) {
      stopStreaming();
    } else {
      startStreaming();
    }
    setRealTimeEnabled(!realTimeEnabled);
  };

  const renderChart = () => {
    const commonProps = {
      animation: { enabled: animationsEnabled, duration: 300 },
      tooltip: { enabled: showTooltips },
      xAxis: { gridLines: showGrid },
      yAxis: { gridLines: showGrid }
    };

    const dataToUse = realTimeEnabled && realTimeData.length > 0 ? realTimeData : timeSeriesData;

    switch (selectedChart) {
      case 'line':
        return (
          <LineChart
            data={dataToUse}
            {...commonProps}
            xAxis={{ ...commonProps.xAxis, label: 'Time' }}
            yAxis={{ ...commonProps.yAxis, label: 'Value' }}
            showPoints
            enableZoom
            enablePan
            thresholds={[
              { value: 70, label: 'Warning', color: '#ff9800', style: 'dashed' },
              { value: 85, label: 'Critical', color: '#f44336', style: 'solid' }
            ]}
            ariaLabel="Mission telemetry line chart"
          />
        );

      case 'area':
        return (
          <AreaChart
            data={dataToUse}
            {...commonProps}
            xAxis={{ ...commonProps.xAxis, label: 'Time' }}
            yAxis={{ ...commonProps.yAxis, label: 'Value' }}
            gradient
            opacity={0.7}
            thresholds={[
              { value: 70, label: 'Warning', color: '#ff9800', style: 'dashed' },
              { value: 85, label: 'Critical', color: '#f44336', style: 'solid' }
            ]}
            ariaLabel="Mission telemetry area chart"
          />
        );

      case 'bar':
        return (
          <BarChart
            data={barData}
            {...commonProps}
            xAxis={{ ...commonProps.xAxis, label: 'System Component' }}
            yAxis={{ ...commonProps.yAxis, label: 'Performance Score' }}
            cornerRadius={4}
            ariaLabel="System performance bar chart"
          />
        );

      case 'gauge':
        return (
          <GaugeChart
            data={gaugeData}
            animation={{ enabled: animationsEnabled, duration: 1000 }}
            showLabels
            showTicks
            tickCount={10}
            ariaLabel="System health gauge"
          />
        );

      case 'heatmap':
        return (
          <HeatmapChart
            data={heatmapData}
            {...commonProps}
            xAxis={{ ...commonProps.xAxis, label: 'Time Slot' }}
            yAxis={{ ...commonProps.yAxis, label: 'Sensor' }}
            showValues
            valueFormat={d => `${d.toFixed(1)}°C`}
            colorScale={['#0066cc', '#ffffff', '#ff4444']}
            ariaLabel="Temperature sensor heatmap"
          />
        );

      default:
        return null;
    }
  };

  return (
    <ChartThemeProvider>
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Chart Component Showcase
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Interactive demonstration of the D3.js chart library integrated with the Rover Mission Control system
        </Typography>

        <Grid container spacing={3}>
          {/* Controls */}
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Chart Controls
              </Typography>
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={selectedChart}
                  onChange={(e) => setSelectedChart(e.target.value)}
                >
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="area">Area Chart</MenuItem>
                  <MenuItem value="bar">Bar Chart</MenuItem>
                  <MenuItem value="gauge">Gauge Chart</MenuItem>
                  <MenuItem value="heatmap">Heatmap Chart</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={realTimeEnabled}
                    onChange={handleRealTimeToggle}
                    disabled={selectedChart === 'bar' || selectedChart === 'heatmap'}
                  />
                }
                label="Real-time Data"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                  />
                }
                label="Show Grid"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={showTooltips}
                    onChange={(e) => setShowTooltips(e.target.checked)}
                  />
                }
                label="Show Tooltips"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={animationsEnabled}
                    onChange={(e) => setAnimationsEnabled(e.target.checked)}
                  />
                }
                label="Animations"
              />

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Chart Information
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                <strong>Selected:</strong> {selectedChart.charAt(0).toUpperCase() + selectedChart.slice(1)} Chart
              </Typography>
              
              {realTimeEnabled && (
                <Typography variant="body2" color="text.secondary">
                  <strong>Status:</strong> {isStreaming ? 'Streaming' : 'Stopped'}
                </Typography>
              )}

              <Typography variant="body2" color="text.secondary">
                <strong>Data Points:</strong> {
                  selectedChart === 'gauge' ? 1 :
                  selectedChart === 'bar' ? barData.length :
                  selectedChart === 'heatmap' ? heatmapData.length :
                  realTimeEnabled ? realTimeData.length : timeSeriesData.length
                }
              </Typography>
            </Paper>
          </Grid>

          {/* Chart Display */}
          <Grid item xs={12} md={9}>
            <Card>
              <CardContent>
                <Box sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderChart()}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Chart Features */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Chart Features Demonstrated
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Performance Features
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Data decimation for large datasets<br/>
                    • Canvas rendering fallback<br/>
                    • Performance monitoring integration<br/>
                    • Efficient re-rendering with React.memo
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Accessibility Features
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • WCAG 2.1 AA compliance<br/>
                    • Screen reader support<br/>
                    • Keyboard navigation<br/>
                    • High contrast mode support
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Interactive Features
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Zoom and pan capabilities<br/>
                    • Real-time data updates<br/>
                    • Hover interactions<br/>
                    • Click handlers and events
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Theming Integration
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    • Material-UI theme integration<br/>
                    • Mission-critical color schemes<br/>
                    • Responsive design<br/>
                    • Dark mode support
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </ChartThemeProvider>
  );
};

export default ChartShowcase;