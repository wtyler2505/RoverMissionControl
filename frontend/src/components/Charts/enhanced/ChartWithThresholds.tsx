/**
 * ChartWithThresholds Component
 * Enhanced chart integration that combines existing charts with threshold overlays and alert indicators
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Box, Card, CardContent, CardHeader, IconButton, Menu, MenuItem, Tooltip, Chip } from '@mui/material';
import { 
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Notifications as NotificationsIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

// Import existing chart components
import { TelemetryLineChart } from '../charts/TelemetryLineChart';
import { TelemetryAreaChart } from '../charts/TelemetryAreaChart';
import { TelemetryGaugeChart } from '../charts/TelemetryGaugeChart';
import { TelemetryHeatmapChart } from '../charts/TelemetryHeatmapChart';
import { TelemetryScatterChart } from '../charts/TelemetryScatterChart';

// Import new threshold components
import ThresholdOverlay from '../overlays/ThresholdOverlay';
import AlertIndicator from '../indicators/AlertIndicator';
import ThresholdConfiguration from '../configuration/ThresholdConfiguration';

import { 
  ChartWithThresholdsProps,
  ThresholdDefinition,
  AlertInstance,
  ThresholdTemplate
} from '../types/threshold-types';

const ChartComponents = {
  line: TelemetryLineChart,
  area: TelemetryAreaChart,
  gauge: TelemetryGaugeChart,
  heatmap: TelemetryHeatmapChart,
  scatter: TelemetryScatterChart
};

export const ChartWithThresholds: React.FC<ChartWithThresholdsProps> = ({
  chartType,
  data,
  thresholds,
  alerts,
  thresholdVisualizationMode = 'overlay',
  alertIndicatorMode = 'floating',
  onThresholdInteraction,
  onAlertInteraction,
  realTimeEnabled = false,
  className,
  ...chartProps
}) => {
  const theme = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [showThresholds, setShowThresholds] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 800, height: 400 });
  const [chartScales, setChartScales] = useState<{ x: any; y: any }>({ x: null, y: null });
  
  // Chart component selection
  const ChartComponent = ChartComponents[chartType];
  
  // Filter active alerts for this chart's data timeframe
  const relevantAlerts = useMemo(() => {
    if (!data.length || !alerts.length) return [];
    
    const dataTimeRange = {
      start: data[0]?.time || data[0]?.x || data[0]?.timestamp,
      end: data[data.length - 1]?.time || data[data.length - 1]?.x || data[data.length - 1]?.timestamp
    };
    
    if (!dataTimeRange.start || !dataTimeRange.end) return alerts;
    
    return alerts.filter(alert => 
      alert.timestamp >= dataTimeRange.start && 
      alert.timestamp <= dataTimeRange.end
    );
  }, [data, alerts]);
  
  // Handle chart resize
  useEffect(() => {
    if (!chartRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setChartDimensions({ width, height });
      }
    });
    
    resizeObserver.observe(chartRef.current);
    
    return () => resizeObserver.disconnect();
  }, []);
  
  // Handle threshold interactions
  const handleThresholdClick = useCallback((threshold: ThresholdDefinition, event: MouseEvent) => {
    onThresholdInteraction?.(threshold, 'click');
  }, [onThresholdInteraction]);
  
  const handleThresholdHover = useCallback((threshold: ThresholdDefinition | null, event: MouseEvent) => {
    onThresholdInteraction?.(threshold!, threshold ? 'hover' : 'leave');
  }, [onThresholdInteraction]);
  
  // Handle alert interactions
  const handleAlertClick = useCallback((alert: AlertInstance) => {
    onAlertInteraction?.(alert, 'click');
  }, [onAlertInteraction]);
  
  const handleAlertAcknowledge = useCallback((alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      onAlertInteraction?.(alert, 'acknowledge');
    }
  }, [alerts, onAlertInteraction]);
  
  const handleAlertResolve = useCallback((alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      onAlertInteraction?.(alert, 'resolve');
    }
  }, [alerts, onAlertInteraction]);
  
  // Calculate chart statistics
  const chartStats = useMemo(() => {
    const activeAlerts = relevantAlerts.filter(a => !a.acknowledged && !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const enabledThresholds = thresholds.filter(t => t.enabled);
    
    return {
      totalThresholds: thresholds.length,
      enabledThresholds: enabledThresholds.length,
      totalAlerts: relevantAlerts.length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length
    };
  }, [thresholds, relevantAlerts]);
  
  // Render chart header with threshold and alert info
  const renderChartHeader = () => (
    <CardHeader
      title={
        <Box display="flex" alignItems="center" gap={2}>
          <span>Chart</span>
          
          {chartStats.enabledThresholds > 0 && (
            <Chip
              icon={<VisibilityIcon />}
              label={`${chartStats.enabledThresholds} Thresholds`}
              size="small"
              variant="outlined"
              color={showThresholds ? 'primary' : 'default'}
            />
          )}
          
          {chartStats.activeAlerts > 0 && (
            <Chip
              icon={<NotificationsIcon />}
              label={`${chartStats.activeAlerts} Active`}
              size="small"
              color={chartStats.criticalAlerts > 0 ? 'error' : 'warning'}
            />
          )}
        </Box>
      }
      action={
        <Box display="flex" alignItems="center" gap={1}>
          {/* Real-time indicator */}
          {realTimeEnabled && (
            <Chip
              label="LIVE"
              color="success"
              size="small"
              sx={{
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': { opacity: 1 },
                  '50%': { opacity: 0.7 },
                  '100%': { opacity: 1 }
                }
              }}
            />
          )}
          
          {/* Threshold visibility toggle */}
          <Tooltip title={showThresholds ? 'Hide Thresholds' : 'Show Thresholds'}>
            <IconButton
              size="small"
              onClick={() => setShowThresholds(!showThresholds)}
            >
              {showThresholds ? <VisibilityIcon /> : <VisibilityOffIcon />}
            </IconButton>
          </Tooltip>
          
          {/* Configuration button */}
          <Tooltip title="Configure Thresholds">
            <IconButton
              size="small"
              onClick={() => setShowConfiguration(true)}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          
          {/* Menu button */}
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
          >
            <MoreVertIcon />
          </IconButton>
        </Box>
      }
    />
  );
  
  // Render the chart with overlays
  const renderChart = () => (
    <Box
      ref={chartRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: chartDimensions.height,
        overflow: 'hidden'
      }}
    >
      {/* Base chart */}
      <ChartComponent
        data={data}
        {...chartProps}
        onScalesUpdate={setChartScales}
        dimensions={chartDimensions}
      />
      
      {/* Threshold overlay */}
      {showThresholds && thresholds.length > 0 && thresholdVisualizationMode === 'overlay' && (
        <ThresholdOverlay
          thresholds={thresholds}
          alerts={relevantAlerts}
          data={data}
          dimensions={chartDimensions}
          scales={chartScales}
          animationEnabled={!realTimeEnabled}
          interactiveEnabled={true}
          showConfidenceIntervals={false}
          onThresholdClick={handleThresholdClick}
          onThresholdHover={handleThresholdHover}
        />
      )}
      
      {/* Alert indicator */}
      {showAlerts && relevantAlerts.length > 0 && alertIndicatorMode === 'floating' && (
        <AlertIndicator
          alerts={relevantAlerts}
          position="top-right"
          maxVisible={5}
          showCount={true}
          showSeverityIcons={true}
          showTimestamp={true}
          onAlertClick={handleAlertClick}
          onAcknowledge={handleAlertAcknowledge}
          onResolve={handleAlertResolve}
        />
      )}
    </Box>
  );
  
  // Render threshold sidebar (if mode is sidebar)
  const renderThresholdSidebar = () => {
    if (thresholdVisualizationMode !== 'sidebar') return null;
    
    return (
      <Box
        sx={{
          width: 250,
          borderLeft: `1px solid ${theme.palette.divider}`,
          overflow: 'auto'
        }}
      >
        {/* Threshold list in sidebar */}
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            Thresholds
          </Typography>
          
          {thresholds.map(threshold => (
            <Card key={threshold.id} sx={{ mb: 1 }} variant="outlined">
              <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Switch
                    checked={threshold.enabled}
                    size="small"
                    onChange={(e) => onThresholdInteraction?.(threshold, e.target.checked ? 'enable' : 'disable')}
                  />
                  
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight="bold">
                      {threshold.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {threshold.operator} {threshold.value}
                    </Typography>
                  </Box>
                  
                  <Chip
                    label={threshold.severity}
                    size="small"
                    color={threshold.severity === 'critical' || threshold.severity === 'error' ? 'error' : 
                           threshold.severity === 'warning' ? 'warning' : 'info'}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    );
  };
  
  if (!ChartComponent) {
    return (
      <Card className={className}>
        <CardContent>
          <Typography color="error">
            Unsupported chart type: {chartType}
          </Typography>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Box className={className}>
      <Card>
        {/* Header */}
        {renderChartHeader()}
        
        {/* Content */}
        <CardContent sx={{ p: 0 }}>
          <Box display="flex">
            {/* Main chart area */}
            <Box flex={1}>
              {renderChart()}
            </Box>
            
            {/* Sidebar */}
            {renderThresholdSidebar()}
          </Box>
        </CardContent>
        
        {/* Embedded alert indicator */}
        {showAlerts && relevantAlerts.length > 0 && alertIndicatorMode === 'embedded' && (
          <Box p={2} borderTop={`1px solid ${theme.palette.divider}`}>
            <AlertIndicator
              alerts={relevantAlerts}
              position="top-left"
              maxVisible={3}
              showCount={true}
              showSeverityIcons={true}
              showTimestamp={false}
              onAlertClick={handleAlertClick}
              onAcknowledge={handleAlertAcknowledge}
              onResolve={handleAlertResolve}
            />
          </Box>
        )}
      </Card>
      
      {/* Context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          setShowThresholds(!showThresholds);
          setMenuAnchor(null);
        }}>
          {showThresholds ? 'Hide' : 'Show'} Thresholds
        </MenuItem>
        
        <MenuItem onClick={() => {
          setShowAlerts(!showAlerts);
          setMenuAnchor(null);
        }}>
          {showAlerts ? 'Hide' : 'Show'} Alerts
        </MenuItem>
        
        <MenuItem onClick={() => {
          setShowConfiguration(true);
          setMenuAnchor(null);
        }}>
          Configure Thresholds
        </MenuItem>
      </Menu>
      
      {/* Configuration dialog */}
      {showConfiguration && (
        <Dialog
          open={showConfiguration}
          onClose={() => setShowConfiguration(false)}
          maxWidth="lg"
          fullWidth
        >
          <ThresholdConfiguration
            thresholds={thresholds}
            templates={[]} // Would be provided by parent
            availableMetrics={[]} // Would be provided by parent
            onThresholdCreate={async (threshold) => {
              // Implementation would be provided by parent
              return threshold as ThresholdDefinition;
            }}
            onThresholdUpdate={async (id, updates) => {
              // Implementation would be provided by parent
              return { ...thresholds.find(t => t.id === id)!, ...updates };
            }}
            onThresholdDelete={async (id) => {
              // Implementation would be provided by parent
            }}
            onThresholdTest={async (id, testValue) => {
              // Implementation would be provided by parent
              return { alertTriggered: false };
            }}
            onTemplateApply={async (templateId, variables) => {
              // Implementation would be provided by parent
              return { threshold: {} as ThresholdDefinition };
            }}
            onBulkOperation={async (operation, thresholdIds, updates) => {
              // Implementation would be provided by parent
              return { success: thresholdIds.length, failed: 0 };
            }}
            onImportExport={async (action, data) => {
              // Implementation would be provided by parent
            }}
          />
        </Dialog>
      )}
    </Box>
  );
};

export default ChartWithThresholds;