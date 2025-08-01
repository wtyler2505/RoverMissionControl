import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ScriptableContext,
  TooltipItem,
  Chart
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Chip,
  Badge,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip as MuiTooltip,
  Fade,
  Zoom
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  NotificationsActive as AlertIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

// Types
export interface ThresholdDefinition {
  id: string;
  name: string;
  type: 'static' | 'dynamic_percentile' | 'dynamic_stddev' | 'conditional' | 'time_based';
  value?: number;
  upperBound?: number;
  lowerBound?: number;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'in_range' | 'out_of_range';
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  hysteresis?: number;
  color?: string;
  style?: 'solid' | 'dashed' | 'dotted';
  fill?: boolean;
  showLabel?: boolean;
  showValue?: boolean;
}

export interface AlertInstance {
  id: string;
  thresholdId: string;
  timestamp: Date;
  value: number;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface TelemetryDataPoint {
  timestamp: Date;
  value: number;
  quality?: 'good' | 'poor' | 'bad';
}

interface ThresholdChartProps {
  data: TelemetryDataPoint[];
  thresholds: ThresholdDefinition[];
  alerts: AlertInstance[];
  title: string;
  metricName: string;
  unit?: string;
  width?: number;
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltips?: boolean;
  realTime?: boolean;
  onThresholdToggle?: (thresholdId: string, enabled: boolean) => void;
  onThresholdEdit?: (threshold: ThresholdDefinition) => void;
  onAlertAcknowledge?: (alertId: string) => void;
  onAlertResolve?: (alertId: string) => void;
  className?: string;
}

const SEVERITY_COLORS = {
  info: '#2196f3',
  warning: '#ff9800', 
  error: '#f44336',
  critical: '#9c27b0'
};

const SEVERITY_ICONS = {
  info: <InfoIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
  critical: <ErrorIcon />
};

export const ThresholdChart: React.FC<ThresholdChartProps> = ({
  data,
  thresholds,
  alerts,
  title,
  metricName,
  unit = '',
  width,
  height = 400,
  showLegend = true,
  showGrid = true,
  showTooltips = true,
  realTime = false,
  onThresholdToggle,
  onThresholdEdit,
  onAlertAcknowledge,
  onAlertResolve,
  className = ''
}) => {
  const chartRef = useRef<Chart<'line', any, any>>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [showThresholds, setShowThresholds] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<AlertInstance | null>(null);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  
  // Calculate dynamic thresholds based on data
  const dynamicThresholds = useMemo(() => {
    return thresholds.map(threshold => {
      if (threshold.type === 'dynamic_percentile' || threshold.type === 'dynamic_stddev') {
        // Calculate dynamic values based on historical data
        const values = data.slice(-100).map(d => d.value); // Last 100 points
        
        if (values.length < 10) return threshold; // Need minimum data
        
        let calculatedValue = threshold.value || 0;
        
        if (threshold.type === 'dynamic_percentile') {
          // Calculate 95th percentile
          values.sort((a, b) => a - b);
          const index = Math.floor(0.95 * values.length);
          calculatedValue = values[index];
        } else if (threshold.type === 'dynamic_stddev') {
          // Calculate mean + 2 standard deviations
          const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
          const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
          const stdDev = Math.sqrt(variance);
          calculatedValue = mean + 2 * stdDev;
        }
        
        return {
          ...threshold,
          value: calculatedValue,
          isDynamic: true
        };
      }
      
      return threshold;
    });
  }, [data, thresholds]);
  
  // Get active alerts for current view
  const visibleAlerts = useMemo(() => {
    if (!data.length || !alerts.length) return [];
    
    const timeRange = {
      start: data[0].timestamp,
      end: data[data.length - 1].timestamp
    };
    
    return alerts.filter(alert => 
      alert.timestamp >= timeRange.start && 
      alert.timestamp <= timeRange.end &&
      !alert.resolved
    );
  }, [data, alerts]);
  
  // Chart configuration
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: realTime ? 0 : 750,
      easing: 'easeInOutQuart'
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: showLegend,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          filter: (legendItem) => {
            // Hide threshold legend items if thresholds are hidden
            if (!showThresholds && legendItem.text?.includes('Threshold')) {
              return false;
            }
            return true;
          }
        }
      },
      tooltip: {
        enabled: showTooltips,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: '#333',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context: TooltipItem<'line'>[]) => {
            const point = context[0];
            const timestamp = new Date(point.label);
            return timestamp.toLocaleString();
          },
          label: (context: TooltipItem<'line'>) => {
            const value = context.parsed.y;
            return `${context.dataset.label}: ${value.toFixed(2)} ${unit}`;
          },
          afterBody: (context: TooltipItem<'line'>[]) => {
            const point = context[0];
            const timestamp = new Date(point.label);
            
            // Show alert information if exists
            const alert = visibleAlerts.find(a => 
              Math.abs(a.timestamp.getTime() - timestamp.getTime()) < 60000 // Within 1 minute
            );
            
            if (alert) {
              return [`🚨 Alert: ${alert.message}`];
            }
            
            return [];
          }
        }
      },
      annotation: {
        annotations: showThresholds ? dynamicThresholds.reduce((acc, threshold, index) => {
          if (!threshold.enabled) return acc;
          
          const color = threshold.color || SEVERITY_COLORS[threshold.severity];
          const baseOpacity = 0.7;
          
          // Static line threshold
          if (threshold.value !== undefined) {
            acc[`threshold-${threshold.id}`] = {
              type: 'line' as const,
              mode: 'horizontal' as const,
              scaleID: 'y',
              value: threshold.value,
              borderColor: color,
              borderWidth: 2,
              borderDash: threshold.style === 'dashed' ? [5, 5] : 
                         threshold.style === 'dotted' ? [2, 2] : [],
              label: {
                display: threshold.showLabel !== false,
                content: threshold.name,
                position: 'end',
                backgroundColor: alpha(color, 0.1),
                borderColor: color,
                borderRadius: 4,
                borderWidth: 1,
                color: color,
                font: {
                  size: 11,
                  weight: 'bold'
                },
                padding: 4
              }
            };
            
            // Add hysteresis band if configured
            if (threshold.hysteresis) {
              acc[`hysteresis-${threshold.id}`] = {
                type: 'box' as const,
                xMin: data[0]?.timestamp,
                xMax: data[data.length - 1]?.timestamp,
                yMin: threshold.value - threshold.hysteresis,
                yMax: threshold.value + threshold.hysteresis,
                backgroundColor: alpha(color, 0.1),
                borderColor: alpha(color, 0.3),
                borderWidth: 1
              };
            }
          }
          
          // Range threshold
          if (threshold.upperBound !== undefined && threshold.lowerBound !== undefined) {
            // Acceptable range (green)
            if (threshold.operator === 'in_range') {
              acc[`range-${threshold.id}`] = {
                type: 'box' as const,
                xMin: data[0]?.timestamp,
                xMax: data[data.length - 1]?.timestamp,
                yMin: threshold.lowerBound,
                yMax: threshold.upperBound,
                backgroundColor: alpha('#4caf50', 0.15),
                borderColor: alpha('#4caf50', 0.3),
                borderWidth: 1
              };
            }
            // Alert range (red)
            else if (threshold.operator === 'out_of_range') {
              acc[`range-danger-${threshold.id}`] = {
                type: 'box' as const,
                xMin: data[0]?.timestamp,
                xMax: data[data.length - 1]?.timestamp,
                yMin: threshold.upperBound,
                yMax: 1000, // Large value
                backgroundColor: alpha(color, 0.1),
                borderColor: alpha(color, 0.3),
                borderWidth: 1
              };
            }
            
            // Boundary lines
            acc[`upper-bound-${threshold.id}`] = {
              type: 'line' as const,
              mode: 'horizontal' as const,
              scaleID: 'y',
              value: threshold.upperBound,
              borderColor: color,
              borderWidth: 1,
              borderDash: [3, 3]
            };
            
            acc[`lower-bound-${threshold.id}`] = {
              type: 'line' as const,
              mode: 'horizontal' as const,
              scaleID: 'y',
              value: threshold.lowerBound,
              borderColor: color,
              borderWidth: 1,
              borderDash: [3, 3]
            };
          }
          
          return acc;
        }, {} as any) : {}
      }
    },
    scales: {
      x: {
        type: 'time',
        display: true,
        grid: {
          display: showGrid,
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          maxTicksLimit: 10,
          color: '#666'
        }
      },
      y: {
        display: true,
        grid: {
          display: showGrid,
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: '#666',
          callback: function(value) {
            return `${Number(value).toFixed(1)} ${unit}`;
          }
        },
        title: {
          display: true,
          text: `${metricName} (${unit})`,
          color: '#333',
          font: {
            size: 12,
            weight: 'bold'
          }
        }
      }
    },
    onHover: (event, activeElements) => {
      if (event.native?.target) {
        const target = event.native.target as HTMLElement;
        target.style.cursor = activeElements.length > 0 ? 'crosshair' : 'default';
      }
    },
    onClick: (event, activeElements) => {
      if (activeElements.length > 0 && visibleAlerts.length > 0) {
        const element = activeElements[0];
        const dataIndex = element.index;
        const timestamp = new Date(data[dataIndex].timestamp);
        
        // Find alert near clicked point
        const nearbyAlert = visibleAlerts.find(alert => 
          Math.abs(alert.timestamp.getTime() - timestamp.getTime()) < 300000 // Within 5 minutes
        );
        
        if (nearbyAlert) {
          setSelectedAlert(nearbyAlert);
          setAlertDialogOpen(true);
        }
      }
    }
  }), [
    realTime, showLegend, showTooltips, showGrid, showThresholds, 
    dynamicThresholds, visibleAlerts, data, metricName, unit
  ]);
  
  // Chart data
  const chartData = useMemo(() => {
    const datasets: any[] = [];
    
    // Main data line
    datasets.push({
      label: metricName,
      data: data.map(point => ({
        x: point.timestamp,
        y: point.value
      })),
      borderColor: '#1976d2',
      backgroundColor: alpha('#1976d2', 0.1),
      borderWidth: 2,
      fill: false,
      tension: 0.1,
      pointRadius: data.length > 1000 ? 0 : 2,
      pointHoverRadius: 4,
      pointBackgroundColor: data.map(point => {
        switch (point.quality) {
          case 'poor': return '#ff9800';
          case 'bad': return '#f44336';
          default: return '#1976d2';
        }
      })
    });
    
    // Alert points
    if (showAlerts && visibleAlerts.length > 0) {
      const alertPoints = visibleAlerts.map(alert => {
        // Find closest data point
        const closestPoint = data.reduce((closest, point) => {
          const alertTime = alert.timestamp.getTime();
          const pointTime = point.timestamp.getTime();
          const closestTime = closest.timestamp.getTime();
          
          return Math.abs(pointTime - alertTime) < Math.abs(closestTime - alertTime)
            ? point : closest;
        });
        
        return {
          x: alert.timestamp,
          y: closestPoint.value,
          alert: alert
        };
      });
      
      datasets.push({
        label: 'Alerts',
        data: alertPoints,
        borderColor: 'transparent',
        backgroundColor: alertPoints.map(point => 
          alpha(SEVERITY_COLORS[point.alert.severity], 0.8)
        ),
        borderWidth: 2,
        fill: false,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointStyle: 'triangle',
        showLine: false,
        order: -1 // Render on top
      });
    }
    
    return { datasets };
  }, [data, metricName, showAlerts, visibleAlerts]);
  
  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchor(null);
  };
  
  const handleThresholdToggle = useCallback((thresholdId: string, enabled: boolean) => {
    onThresholdToggle?.(thresholdId, enabled);
  }, [onThresholdToggle]);
  
  const handleAlertAction = useCallback((alertId: string, action: 'acknowledge' | 'resolve') => {
    if (action === 'acknowledge') {
      onAlertAcknowledge?.(alertId);
    } else {
      onAlertResolve?.(alertId);
    }
    setAlertDialogOpen(false);
    setSelectedAlert(null);
  }, [onAlertAcknowledge, onAlertResolve]);
  
  // Active alerts count
  const activeAlertsCount = visibleAlerts.filter(a => !a.acknowledged).length;
  const criticalAlertsCount = visibleAlerts.filter(a => 
    a.severity === 'critical' && !a.acknowledged
  ).length;
  
  return (
    <Card className={className}>
      <CardContent>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6" component="h3">
              {title}
            </Typography>
            
            {/* Alert indicators */}
            {activeAlertsCount > 0 && (
              <Box display="flex" alignItems="center" gap={1}>
                <Badge badgeContent={activeAlertsCount} color="error">
                  <AlertIcon color="error" />
                </Badge>
                
                {criticalAlertsCount > 0 && (
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${criticalAlertsCount} Critical`}
                    color="error"
                    size="small"
                  />
                )}
              </Box>
            )}
            
            {/* Threshold status */}
            <Chip
              icon={<TimelineIcon />}
              label={`${dynamicThresholds.filter(t => t.enabled).length} Thresholds`}
              size="small"
              variant="outlined"
            />
          </Box>
          
          {/* Menu button */}
          <IconButton onClick={handleMenuOpen} size="small">
            <MoreVertIcon />
          </IconButton>
        </Box>
        
        {/* Chart */}
        <Box 
          height={height} 
          width={width || '100%'}
          position="relative"
        >
          <Line 
            ref={chartRef}
            data={chartData} 
            options={chartOptions}
          />
          
          {/* Real-time indicator */}
          {realTime && (
            <Fade in={true}>
              <Chip
                label="LIVE"
                color="success"
                size="small"
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  animation: 'pulse 2s infinite'
                }}
              />
            </Fade>
          )}
        </Box>
        
        {/* Alert summary */}
        {visibleAlerts.length > 0 && (
          <Box mt={2}>
            <Alert 
              severity={criticalAlertsCount > 0 ? 'error' : 'warning'}
              action={
                <Button 
                  color="inherit" 
                  size="small"
                  onClick={() => {
                    // Show all alerts
                    console.log('Show all alerts');
                  }}
                >
                  View All
                </Button>
              }
            >
              {activeAlertsCount} active alert{activeAlertsCount !== 1 ? 's' : ''} 
              {criticalAlertsCount > 0 && ` (${criticalAlertsCount} critical)`}
            </Alert>
          </Box>
        )}
      </CardContent>
      
      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => setShowThresholds(!showThresholds)}>
          <ListItemIcon>
            {showThresholds ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </ListItemIcon>
          <ListItemText>
            {showThresholds ? 'Hide' : 'Show'} Thresholds
          </ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => setShowAlerts(!showAlerts)}>
          <ListItemIcon>
            {showAlerts ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </ListItemIcon>
          <ListItemText>
            {showAlerts ? 'Hide' : 'Show'} Alerts
          </ListItemText>
        </MenuItem>
        
        <MenuItem onClick={() => console.log('Configure thresholds')}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText>Configure Thresholds</ListItemText>
        </MenuItem>
      </Menu>
      
      {/* Threshold controls */}
      {showThresholds && dynamicThresholds.length > 0 && (
        <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
          <Typography variant="subtitle2" gutterBottom>
            Threshold Controls
          </Typography>
          
          <Box display="flex" flexWrap="wrap" gap={1}>
            {dynamicThresholds.map(threshold => (
              <Box key={threshold.id} display="flex" alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={threshold.enabled}
                      onChange={(e) => handleThresholdToggle(threshold.id, e.target.checked)}
                      size="small"
                    />
                  }
                  label=""
                />
                
                <MuiTooltip 
                  title={`${threshold.name}: ${threshold.value?.toFixed(2)} ${unit}`}
                >
                  <Chip
                    icon={SEVERITY_ICONS[threshold.severity]}
                    label={threshold.name}
                    color={threshold.severity === 'critical' ? 'error' : 
                           threshold.severity === 'error' ? 'error' :
                           threshold.severity === 'warning' ? 'warning' : 'info'}
                    size="small"
                    variant={threshold.enabled ? 'filled' : 'outlined'}
                    onClick={() => onThresholdEdit?.(threshold)}
                    sx={{
                      cursor: onThresholdEdit ? 'pointer' : 'default'
                    }}
                  />
                </MuiTooltip>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      
      {/* Alert detail dialog */}
      <Dialog
        open={alertDialogOpen}
        onClose={() => setAlertDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        TransitionComponent={Zoom}
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={2}>
                {SEVERITY_ICONS[selectedAlert.severity]}
                <Typography variant="h6">
                  {selectedAlert.severity.toUpperCase()} Alert
                </Typography>
                <Chip
                  label={selectedAlert.acknowledged ? 'Acknowledged' : 'Active'}
                  color={selectedAlert.acknowledged ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Typography variant="body1" gutterBottom>
                <strong>Message:</strong> {selectedAlert.message}
              </Typography>
              
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Time:</strong> {selectedAlert.timestamp.toLocaleString()}
              </Typography>
              
              <Typography variant="body2" color="textSecondary" gutterBottom>
                <strong>Value:</strong> {selectedAlert.value.toFixed(2)} {unit}
              </Typography>
              
              <Typography variant="body2" color="textSecondary">
                <strong>Alert ID:</strong> {selectedAlert.id}
              </Typography>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setAlertDialogOpen(false)}>
                Close
              </Button>
              
              {!selectedAlert.acknowledged && (
                <Button
                  onClick={() => handleAlertAction(selectedAlert.id, 'acknowledge')}
                  startIcon={<CheckCircleIcon />}
                  color="primary"
                >
                  Acknowledge
                </Button>
              )}
              
              {!selectedAlert.resolved && (
                <Button
                  onClick={() => handleAlertAction(selectedAlert.id, 'resolve')}
                  startIcon={<CancelIcon />}
                  color="error"
                >
                  Resolve
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
};

export default ThresholdChart;