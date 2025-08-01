/**
 * ThresholdChartExample Component
 * Comprehensive example demonstrating all threshold and alert features
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Paper,
  Divider
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Import threshold components
import {
  ChartWithThresholds,
  AlertDashboard,
  ThresholdConfiguration,
  ThresholdDefinition,
  AlertInstance,
  ThresholdTemplate,
  createThreshold,
  createAlert,
  THRESHOLD_COLORS
} from '../index';

// Mock data generators
const generateTimeSeriesData = (points: number = 100, volatility: number = 0.2) => {
  const data = [];
  const now = new Date();
  let value = 50;
  
  for (let i = points - 1; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000); // 1 minute intervals
    value += (Math.random() - 0.5) * volatility * 10;
    value = Math.max(0, Math.min(100, value)); // Clamp between 0-100
    
    data.push({
      time: timestamp,
      value: value,
      x: timestamp,
      y: value
    });
  }
  
  return data;
};

const generateMockThresholds = (): ThresholdDefinition[] => [
  {
    id: 'threshold-1',
    name: 'Critical CPU Threshold',
    description: 'Triggers when CPU usage exceeds 90%',
    metricId: 'cpu-usage',
    metricName: 'CPU Usage',
    type: 'static',
    severity: 'critical',
    enabled: true,
    value: 90,
    operator: 'gt',
    consecutiveViolations: 2,
    hysteresis: 2,
    color: THRESHOLD_COLORS.critical,
    style: 'solid',
    showLabel: true,
    showValue: true,
    tags: ['cpu', 'performance'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'threshold-2',
    name: 'Memory Warning',
    description: 'Warning when memory usage is high',
    metricId: 'memory-usage',
    metricName: 'Memory Usage',
    type: 'dynamic_percentile',
    severity: 'warning',
    enabled: true,
    percentile: 95,
    baselineWindow: { value: 1, unit: 'hours' },
    minDataPoints: 20,
    consecutiveViolations: 1,
    color: THRESHOLD_COLORS.warning,
    style: 'dashed',
    showLabel: true,
    showValue: true,
    tags: ['memory', 'performance'],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'threshold-3',
    name: 'Optimal Range',
    description: 'Optimal performance range',
    metricId: 'performance-score',
    metricName: 'Performance Score',
    type: 'static',
    severity: 'info',
    enabled: true,
    operator: 'in_range',
    lowerBound: 40,
    upperBound: 70,
    color: THRESHOLD_COLORS.info,
    style: 'dotted',
    fill: true,
    fillOpacity: 0.1,
    showLabel: true,
    showValue: false,
    tags: ['performance', 'optimal'],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const generateMockAlerts = (data: any[], thresholds: ThresholdDefinition[]): AlertInstance[] => {
  const alerts: AlertInstance[] = [];
  
  // Generate some mock alerts based on data points that would violate thresholds
  data.forEach((point, index) => {
    thresholds.forEach(threshold => {
      // Simple threshold violation logic
      let violated = false;
      
      if (threshold.type === 'static' && threshold.value !== undefined) {
        if (threshold.operator === 'gt' && point.value > threshold.value) {
          violated = true;
        } else if (threshold.operator === 'lt' && point.value < threshold.value) {
          violated = true;
        } else if (threshold.operator === 'in_range' && 
                   threshold.lowerBound !== undefined && threshold.upperBound !== undefined) {
          violated = point.value < threshold.lowerBound || point.value > threshold.upperBound;
        }
      }
      
      // Randomly generate some alerts for demonstration
      if (violated && Math.random() < 0.1) { // 10% chance of alert
        alerts.push({
          id: `alert-${threshold.id}-${index}`,
          thresholdId: threshold.id,
          timestamp: point.time,
          value: point.value,
          severity: threshold.severity,
          message: `${threshold.name} violated: ${point.value.toFixed(2)}`,
          acknowledged: Math.random() < 0.3, // 30% acknowledged
          resolved: Math.random() < 0.2, // 20% resolved
          escalationLevel: 0,
          suppressed: false
        });
      }
    });
  });
  
  return alerts.slice(0, 10); // Limit to 10 alerts for demo
};

const mockTemplates: ThresholdTemplate[] = [
  {
    id: 'template-1',
    name: 'High CPU Alert',
    description: 'Standard high CPU usage alert template',
    category: 'Performance',
    thresholdType: 'static',
    config: {
      type: 'static',
      operator: 'gt',
      severity: 'error',
      consecutiveViolations: 3
    },
    requiredVariables: ['threshold_value', 'metric_name'],
    optionalVariables: ['hysteresis'],
    isSystem: true,
    tags: ['cpu', 'performance', 'system']
  },
  {
    id: 'template-2',
    name: 'Dynamic Memory Threshold',
    description: 'Adaptive memory usage threshold based on historical data',
    category: 'Performance',
    thresholdType: 'dynamic_percentile',
    config: {
      type: 'dynamic_percentile',
      percentile: 95,
      severity: 'warning',
      baselineWindow: { value: 2, unit: 'hours' }
    },
    requiredVariables: ['metric_name'],
    optionalVariables: ['percentile', 'baseline_window'],
    isSystem: true,
    tags: ['memory', 'adaptive', 'performance']
  }
];

const mockMetrics = [
  { id: 'cpu-usage', name: 'CPU Usage', unit: '%' },
  { id: 'memory-usage', name: 'Memory Usage', unit: '%' },
  { id: 'disk-io', name: 'Disk I/O', unit: 'MB/s' },
  { id: 'network-throughput', name: 'Network Throughput', unit: 'Mbps' },
  { id: 'response-time', name: 'Response Time', unit: 'ms' }
];

export const ThresholdChartExample: React.FC = () => {
  const theme = useTheme();
  
  // State
  const [chartType, setChartType] = useState<'line' | 'area' | 'gauge' | 'heatmap' | 'scatter'>('line');
  const [dataPoints, setDataPoints] = useState(100);
  const [volatility, setVolatility] = useState(0.2);
  const [realTimeEnabled, setRealTimeEnabled] = useState(false);
  const [thresholdMode, setThresholdMode] = useState<'overlay' | 'sidebar'>('overlay');
  const [alertMode, setAlertMode] = useState<'floating' | 'embedded'>('floating');
  const [showDashboard, setShowDashboard] = useState(false);
  const [showConfiguration, setShowConfiguration] = useState(false);
  
  // Data
  const [data, setData] = useState(() => generateTimeSeriesData(dataPoints, volatility));
  const [thresholds, setThresholds] = useState<ThresholdDefinition[]>(generateMockThresholds());
  const [alerts, setAlerts] = useState<AlertInstance[]>([]);
  
  // Generate alerts based on current data and thresholds
  useEffect(() => {
    const newAlerts = generateMockAlerts(data, thresholds);
    setAlerts(newAlerts);
  }, [data, thresholds]);
  
  // Real-time data simulation
  useEffect(() => {
    if (!realTimeEnabled) return;
    
    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData];
        const lastValue = newData[newData.length - 1]?.value || 50;
        const newValue = Math.max(0, Math.min(100, lastValue + (Math.random() - 0.5) * volatility * 10));
        const newPoint = {
          time: new Date(),
          value: newValue,
          x: new Date(),
          y: newValue
        };
        
        newData.push(newPoint);
        return newData.slice(-dataPoints); // Keep only last N points
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [realTimeEnabled, volatility, dataPoints]);
  
  // Regenerate data when parameters change
  useEffect(() => {
    if (!realTimeEnabled) {
      setData(generateTimeSeriesData(dataPoints, volatility));
    }
  }, [dataPoints, volatility, realTimeEnabled]);
  
  // Threshold operations
  const handleThresholdCreate = useCallback(async (threshold: Partial<ThresholdDefinition>) => {
    const newThreshold: ThresholdDefinition = {
      id: `threshold-${Date.now()}`,
      name: threshold.name || 'New Threshold',
      metricId: threshold.metricId || 'cpu-usage',
      metricName: threshold.metricName || 'CPU Usage',
      type: threshold.type || 'static',
      severity: threshold.severity || 'warning',
      enabled: true,
      operator: threshold.operator || 'gt',
      value: threshold.value || 50,
      consecutiveViolations: 1,
      tags: threshold.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...threshold
    };
    
    setThresholds(prev => [...prev, newThreshold]);
    return newThreshold;
  }, []);
  
  const handleThresholdUpdate = useCallback(async (id: string, updates: Partial<ThresholdDefinition>) => {
    setThresholds(prev => prev.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date() } : t));
    const updated = thresholds.find(t => t.id === id);
    return { ...updated!, ...updates };
  }, [thresholds]);
  
  const handleThresholdDelete = useCallback(async (id: string) => {
    setThresholds(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const handleThresholdTest = useCallback(async (id: string, testValue?: number) => {
    const threshold = thresholds.find(t => t.id === id);
    if (!threshold) return { alertTriggered: false };
    
    const value = testValue !== undefined ? testValue : data[data.length - 1]?.value || 0;
    let violated = false;
    
    if (threshold.type === 'static' && threshold.value !== undefined) {
      violated = threshold.operator === 'gt' ? value > threshold.value : value < threshold.value;
    }
    
    return {
      alertTriggered: violated,
      message: violated ? `Alert would be triggered for value ${value}` : `No alert for value ${value}`,
      testValue: value,
      thresholdValue: threshold.value
    };
  }, [thresholds, data]);
  
  // Alert operations
  const handleAlertAcknowledge = useCallback(async (alertId: string, comment?: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId 
        ? { ...a, acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy: 'user' }
        : a
    ));
  }, []);
  
  const handleAlertResolve = useCallback(async (alertId: string, comment?: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId 
        ? { ...a, resolved: true, resolvedAt: new Date(), resolvedBy: 'user' }
        : a
    ));
  }, []);
  
  const handleAlertSilence = useCallback(async (alertId: string, duration: number) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId 
        ? { ...a, suppressed: true, metadata: { ...a.metadata, silencedUntil: new Date(Date.now() + duration * 60000) } }
        : a
    ));
  }, []);
  
  // Interaction handlers
  const handleThresholdInteraction = useCallback((threshold: ThresholdDefinition, action: string) => {
    console.log('Threshold interaction:', threshold.name, action);
  }, []);
  
  const handleAlertInteraction = useCallback((alert: AlertInstance, action: string) => {
    console.log('Alert interaction:', alert.message, action);
    
    switch (action) {
      case 'acknowledge':
        handleAlertAcknowledge(alert.id);
        break;
      case 'resolve':
        handleAlertResolve(alert.id);
        break;
    }
  }, [handleAlertAcknowledge, handleAlertResolve]);
  
  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Threshold and Alert System Demo
      </Typography>
      
      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Configuration
          </Typography>
          
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Chart Type</InputLabel>
                <Select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as any)}
                  label="Chart Type"
                >
                  <MenuItem value="line">Line Chart</MenuItem>
                  <MenuItem value="area">Area Chart</MenuItem>
                  <MenuItem value="gauge">Gauge Chart</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Data Points</InputLabel>
                <Select
                  value={dataPoints}
                  onChange={(e) => setDataPoints(Number(e.target.value))}
                  label="Data Points"
                >
                  <MenuItem value={50}>50 Points</MenuItem>
                  <MenuItem value={100}>100 Points</MenuItem>
                  <MenuItem value={200}>200 Points</MenuItem>
                  <MenuItem value={500}>500 Points</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Volatility</InputLabel>
                <Select
                  value={volatility}
                  onChange={(e) => setVolatility(Number(e.target.value))}
                  label="Volatility"
                >
                  <MenuItem value={0.1}>Low (0.1)</MenuItem>
                  <MenuItem value={0.2}>Medium (0.2)</MenuItem>
                  <MenuItem value={0.5}>High (0.5)</MenuItem>
                  <MenuItem value={1.0}>Extreme (1.0)</MenuItem>
                </SELECT>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Threshold Mode</InputLabel>
                <Select
                  value={thresholdMode}
                  onChange={(e) => setThresholdMode(e.target.value as any)}
                  label="Threshold Mode"
                >
                  <MenuItem value="overlay">Overlay</MenuItem>
                  <MenuItem value="sidebar">Sidebar</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Alert Mode</InputLabel>
                <Select
                  value={alertMode}
                  onChange={(e) => setAlertMode(e.target.value as any)}
                  label="Alert Mode"
                >
                  <MenuItem value="floating">Floating</MenuItem>
                  <MenuItem value="embedded">Embedded</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={2}>
              <Box display="flex" flexDirection="column" gap={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={realTimeEnabled}
                      onChange={(e) => setRealTimeEnabled(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Real-time"
                />
              </Box>
            </Grid>
          </Grid>
          
          <Box display="flex" gap={2} mt={2}>
            <Button
              variant="outlined"
              onClick={() => setShowConfiguration(true)}
            >
              Configure Thresholds
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => setShowDashboard(true)}
            >
              Alert Dashboard
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => setData(generateTimeSeriesData(dataPoints, volatility))}
            >
              Regenerate Data
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      {/* Chart with Thresholds */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={showDashboard ? 8 : 12}>
          <ChartWithThresholds
            chartType={chartType}
            data={data}
            thresholds={thresholds}
            alerts={alerts}
            thresholdVisualizationMode={thresholdMode}
            alertIndicatorMode={alertMode}
            onThresholdInteraction={handleThresholdInteraction}
            onAlertInteraction={handleAlertInteraction}
            realTimeEnabled={realTimeEnabled}
            width={thresholdMode === 'sidebar' ? undefined : '100%'}
            height={400}
          />
        </Grid>
        
        {showDashboard && (
          <Grid item xs={12} lg={4}>
            <Paper sx={{ height: 400, overflow: 'auto' }}>
              <AlertDashboard
                alerts={alerts}
                thresholds={thresholds}
                onAlertAcknowledge={handleAlertAcknowledge}
                onAlertResolve={handleAlertResolve}
                onAlertSilence={handleAlertSilence}
                onBulkOperation={async (operation, alertIds) => {
                  // Handle bulk operations
                  console.log('Bulk operation:', operation, alertIds);
                }}
                onFilterChange={(filter) => {
                  console.log('Filter changed:', filter);
                }}
                refreshInterval={realTimeEnabled ? 5000 : undefined}
              />
            </Paper>
          </Grid>
        )}
      </Grid>
      
      {/* Statistics */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Statistics
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {data.length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Data Points
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {thresholds.filter(t => t.enabled).length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Active Thresholds
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {alerts.filter(a => !a.acknowledged && !a.resolved).length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Active Alerts
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {alerts.filter(a => a.severity === 'critical' && !a.resolved).length}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Critical Alerts
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Configuration Dialog */}
      {showConfiguration && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
          onClick={() => setShowConfiguration(false)}
        >
          <Box
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 2,
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'auto',
              p: 3
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ThresholdConfiguration
              thresholds={thresholds}
              templates={mockTemplates}
              availableMetrics={mockMetrics}
              onThresholdCreate={handleThresholdCreate}
              onThresholdUpdate={handleThresholdUpdate}
              onThresholdDelete={handleThresholdDelete}
              onThresholdTest={handleThresholdTest}
              onTemplateApply={async (templateId, variables) => {
                const template = mockTemplates.find(t => t.id === templateId);
                if (template) {
                  const threshold = await handleThresholdCreate({
                    name: variables.metric_name ? `${template.name} - ${variables.metric_name}` : template.name,
                    metricName: variables.metric_name || 'Unknown Metric',
                    ...template.config,
                    value: variables.threshold_value ? Number(variables.threshold_value) : undefined,
                    hysteresis: variables.hysteresis ? Number(variables.hysteresis) : undefined
                  });
                  return { threshold };
                }
                throw new Error('Template not found');
              }}
              onBulkOperation={async (operation, thresholdIds, updates) => {
                let success = 0, failed = 0;
                
                for (const id of thresholdIds) {
                  try {
                    switch (operation) {
                      case 'enable':
                        await handleThresholdUpdate(id, { enabled: true });
                        break;
                      case 'disable':
                        await handleThresholdUpdate(id, { enabled: false });
                        break;
                      case 'delete':
                        await handleThresholdDelete(id);
                        break;
                    }
                    success++;
                  } catch {
                    failed++;
                  }
                }
                
                return { success, failed };
              }}
              onImportExport={async (action, data) => {
                if (action === 'export') {
                  const exportData = {
                    thresholds,
                    exportedAt: new Date().toISOString(),
                    version: '1.0'
                  };
                  
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                    type: 'application/json'
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'thresholds-export.json';
                  link.click();
                  URL.revokeObjectURL(url);
                } else {
                  // Import logic would go here
                  console.log('Import data:', data);
                }
              }}
            />
            
            <Box display="flex" justifyContent="flex-end" mt={3}>
              <Button onClick={() => setShowConfiguration(false)}>
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ThresholdChartExample;