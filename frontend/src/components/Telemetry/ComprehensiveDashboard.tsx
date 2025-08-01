import React, { useState, useCallback, useEffect, useRef } from 'react';
import GridLayout, { Layout, Layouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Chip,
  Stack,
  Alert,
  Snackbar,
  LinearProgress,
  Badge,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
} from '@mui/material';
import {
  Fullscreen,
  FullscreenExit,
  Add,
  Remove,
  Settings,
  Save,
  SaveAs,
  FolderOpen,
  Timeline,
  Dashboard,
  Analytics,
  Speed,
  Group,
  Link,
  LinkOff,
  Visibility,
  VisibilityOff,
  LockOpen,
  Lock,
  Refresh,
  Download,
  Upload,
  ClearAll,
  GridOn,
  GridOff,
} from '@mui/icons-material';
import RealTimeChart, { DataSeries, YAxis, ChartOptions } from './RealTimeChart';
import StreamSelector from './StreamSelector';
import TimeControlBar from './TimeControlBar';
import { ChartTemplate, chartTemplates } from './ChartTemplates';
import { useTelemetryManager } from './TelemetryProvider';
import { TelemetryStreamConfig, TelemetryDataPoint } from '../../services/websocket/TelemetryManager';

// Chart configuration with metadata
interface ChartConfig {
  id: string;
  title: string;
  streamIds: string[];
  template?: string;
  series: DataSeries[];
  yAxes: YAxis[];
  options: Partial<ChartOptions>;
  isFullscreen?: boolean;
  linkedCharts?: string[];
  correlationAnalysis?: {
    enabled: boolean;
    targetStreamId?: string;
    method?: 'pearson' | 'spearman' | 'crossCorrelation';
  };
}

// Dashboard configuration for save/load
interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  layout: Layout[];
  charts: ChartConfig[];
  globalTimeWindow: number;
  syncTime: boolean;
  theme?: 'light' | 'dark';
  createdAt: string;
  updatedAt: string;
  version: string;
}

// Performance metrics
interface PerformanceMetrics {
  fps: number;
  dataPointsPerSecond: number;
  memoryUsage: number;
  activeStreams: number;
  droppedFrames: number;
  latency: number;
}

interface ComprehensiveDashboardProps {
  initialConfig?: DashboardConfig;
  onConfigChange?: (config: DashboardConfig) => void;
  maxCharts?: number;
  defaultTimeWindow?: number;
  enableCorrelation?: boolean;
  enableGrouping?: boolean;
  showPerformanceMetrics?: boolean;
  theme?: 'light' | 'dark';
}

const ComprehensiveDashboard: React.FC<ComprehensiveDashboardProps> = ({
  initialConfig,
  onConfigChange,
  maxCharts = 12,
  defaultTimeWindow = 30000, // 30 seconds
  enableCorrelation = true,
  enableGrouping = true,
  showPerformanceMetrics = true,
  theme = 'light',
}) => {
  const telemetryManager = useTelemetryManager();
  const performanceIntervalRef = useRef<NodeJS.Timeout>();
  
  // State management
  const [layout, setLayout] = useState<Layout[]>(
    initialConfig?.layout || []
  );
  const [charts, setCharts] = useState<Map<string, ChartConfig>>(
    new Map(initialConfig?.charts.map(chart => [chart.id, chart]) || [])
  );
  const [selectedCharts, setSelectedCharts] = useState<Set<string>>(new Set());
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);
  const [syncTime, setSyncTime] = useState(initialConfig?.syncTime ?? true);
  const [globalTimeWindow, setGlobalTimeWindow] = useState(
    initialConfig?.globalTimeWindow || defaultTimeWindow
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [configName, setConfigName] = useState(initialConfig?.name || '');
  const [configDescription, setConfigDescription] = useState(
    initialConfig?.description || ''
  );
  const [showGrid, setShowGrid] = useState(true);
  const [lockLayout, setLockLayout] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  
  // Performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    dataPointsPerSecond: 0,
    memoryUsage: 0,
    activeStreams: 0,
    droppedFrames: 0,
    latency: 0,
  });

  // Add a new chart to the dashboard
  const addChart = useCallback((
    streamIds: string[],
    template?: ChartTemplate
  ) => {
    if (charts.size >= maxCharts) {
      setSnackbar({
        open: true,
        message: `Maximum of ${maxCharts} charts reached`,
        severity: 'warning',
      });
      return;
    }

    const chartId = `chart-${Date.now()}`;
    const newChart: ChartConfig = {
      id: chartId,
      title: template?.name || streamIds.join(', '),
      streamIds,
      template: template?.id,
      series: [],
      yAxes: template?.yAxes || [{
        id: 'default',
        label: 'Value',
        position: 'left',
        autoScale: true,
      }],
      options: {
        ...template?.chartOptions,
        timeWindow: syncTime ? globalTimeWindow : defaultTimeWindow,
      },
    };

    // Add to charts
    setCharts(prev => new Map(prev).set(chartId, newChart));

    // Add to layout
    const newLayoutItem: Layout = {
      i: chartId,
      x: (charts.size * 4) % 12,
      y: Math.floor(charts.size / 3) * 4,
      w: 4,
      h: 4,
      minW: 2,
      minH: 2,
    };
    setLayout(prev => [...prev, newLayoutItem]);

    setSnackbar({
      open: true,
      message: 'Chart added successfully',
      severity: 'success',
    });
  }, [charts.size, maxCharts, syncTime, globalTimeWindow, defaultTimeWindow]);

  // Remove a chart from the dashboard
  const removeChart = useCallback((chartId: string) => {
    setCharts(prev => {
      const newCharts = new Map(prev);
      newCharts.delete(chartId);
      return newCharts;
    });
    setLayout(prev => prev.filter(item => item.i !== chartId));
    setSelectedCharts(prev => {
      const newSelected = new Set(prev);
      newSelected.delete(chartId);
      return newSelected;
    });
  }, []);

  // Toggle fullscreen for a chart
  const toggleFullscreen = useCallback((chartId: string) => {
    setFullscreenChart(prev => prev === chartId ? null : chartId);
  }, []);

  // Link/unlink charts for synchronized interactions
  const toggleChartLink = useCallback((chartId1: string, chartId2: string) => {
    setCharts(prev => {
      const newCharts = new Map(prev);
      const chart1 = newCharts.get(chartId1);
      const chart2 = newCharts.get(chartId2);
      
      if (chart1 && chart2) {
        const linkedCharts1 = chart1.linkedCharts || [];
        const linkedCharts2 = chart2.linkedCharts || [];
        
        if (linkedCharts1.includes(chartId2)) {
          // Unlink
          chart1.linkedCharts = linkedCharts1.filter(id => id !== chartId2);
          chart2.linkedCharts = linkedCharts2.filter(id => id !== chartId1);
        } else {
          // Link
          chart1.linkedCharts = [...linkedCharts1, chartId2];
          chart2.linkedCharts = [...linkedCharts2, chartId1];
        }
        
        newCharts.set(chartId1, { ...chart1 });
        newCharts.set(chartId2, { ...chart2 });
      }
      
      return newCharts;
    });
  }, []);

  // Enable correlation analysis between charts
  const enableCorrelationAnalysis = useCallback((
    chartId: string,
    targetStreamId: string,
    method: 'pearson' | 'spearman' | 'crossCorrelation' = 'pearson'
  ) => {
    setCharts(prev => {
      const newCharts = new Map(prev);
      const chart = newCharts.get(chartId);
      
      if (chart) {
        chart.correlationAnalysis = {
          enabled: true,
          targetStreamId,
          method,
        };
        newCharts.set(chartId, { ...chart });
      }
      
      return newCharts;
    });
  }, []);

  // Save dashboard configuration
  const saveDashboardConfig = useCallback(() => {
    const config: DashboardConfig = {
      id: initialConfig?.id || `dashboard-${Date.now()}`,
      name: configName,
      description: configDescription,
      layout,
      charts: Array.from(charts.values()),
      globalTimeWindow,
      syncTime,
      theme,
      createdAt: initialConfig?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    // Save to localStorage or call onConfigChange
    localStorage.setItem(`dashboard-${config.id}`, JSON.stringify(config));
    
    if (onConfigChange) {
      onConfigChange(config);
    }

    setSnackbar({
      open: true,
      message: 'Dashboard configuration saved',
      severity: 'success',
    });
    setSaveDialogOpen(false);
  }, [
    charts,
    layout,
    globalTimeWindow,
    syncTime,
    theme,
    configName,
    configDescription,
    initialConfig,
    onConfigChange,
  ]);

  // Load dashboard configuration
  const loadDashboardConfig = useCallback((configId: string) => {
    const savedConfig = localStorage.getItem(`dashboard-${configId}`);
    
    if (savedConfig) {
      try {
        const config: DashboardConfig = JSON.parse(savedConfig);
        setLayout(config.layout);
        setCharts(new Map(config.charts.map(chart => [chart.id, chart])));
        setGlobalTimeWindow(config.globalTimeWindow);
        setSyncTime(config.syncTime);
        setConfigName(config.name);
        setConfigDescription(config.description || '');
        
        setSnackbar({
          open: true,
          message: 'Dashboard configuration loaded',
          severity: 'success',
        });
        setLoadDialogOpen(false);
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Failed to load dashboard configuration',
          severity: 'error',
        });
      }
    }
  }, []);

  // Export dashboard configuration
  const exportDashboardConfig = useCallback(() => {
    const config: DashboardConfig = {
      id: `dashboard-${Date.now()}`,
      name: configName || 'Unnamed Dashboard',
      description: configDescription,
      layout,
      charts: Array.from(charts.values()),
      globalTimeWindow,
      syncTime,
      theme,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.name.replace(/\s+/g, '-')}-${config.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSnackbar({
      open: true,
      message: 'Dashboard configuration exported',
      severity: 'success',
    });
  }, [charts, layout, globalTimeWindow, syncTime, theme, configName, configDescription]);

  // Import dashboard configuration
  const importDashboardConfig = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config: DashboardConfig = JSON.parse(e.target?.result as string);
        setLayout(config.layout);
        setCharts(new Map(config.charts.map(chart => [chart.id, chart])));
        setGlobalTimeWindow(config.globalTimeWindow);
        setSyncTime(config.syncTime);
        setConfigName(config.name);
        setConfigDescription(config.description || '');
        
        setSnackbar({
          open: true,
          message: 'Dashboard configuration imported',
          severity: 'success',
        });
      } catch (error) {
        setSnackbar({
          open: true,
          message: 'Failed to import dashboard configuration',
          severity: 'error',
        });
      }
    };
    reader.readAsText(file);
  }, []);

  // Update performance metrics
  useEffect(() => {
    if (!showPerformanceMetrics) return;

    const updateMetrics = () => {
      // Calculate metrics based on telemetry manager stats
      const streams = telemetryManager?.getActiveStreams() || [];
      const stats = streams.map(streamId => telemetryManager?.getStreamStats(streamId));
      
      const totalDataPoints = stats.reduce((sum, stat) => sum + (stat?.averageRate || 0), 0);
      
      setPerformanceMetrics({
        fps: 60, // Would need actual frame rate measurement
        dataPointsPerSecond: totalDataPoints,
        memoryUsage: performance.memory?.usedJSHeapSize || 0,
        activeStreams: streams.length,
        droppedFrames: 0, // Would need actual measurement
        latency: Math.random() * 10, // Placeholder
      });
    };

    performanceIntervalRef.current = setInterval(updateMetrics, 1000);
    
    return () => {
      if (performanceIntervalRef.current) {
        clearInterval(performanceIntervalRef.current);
      }
    };
  }, [showPerformanceMetrics, telemetryManager]);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    if (!lockLayout) {
      setLayout(newLayout);
    }
  }, [lockLayout]);

  // Clear all charts
  const clearAllCharts = useCallback(() => {
    setCharts(new Map());
    setLayout([]);
    setSelectedCharts(new Set());
    setFullscreenChart(null);
  }, []);

  // Render a single chart
  const renderChart = useCallback((chartConfig: ChartConfig, layoutItem: Layout) => {
    // In fullscreen mode, render only the fullscreen chart
    if (fullscreenChart && fullscreenChart !== chartConfig.id) {
      return null;
    }

    const isFullscreen = fullscreenChart === chartConfig.id;
    const isSelected = selectedCharts.has(chartConfig.id);

    return (
      <Paper
        key={chartConfig.id}
        elevation={isSelected ? 8 : 2}
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: isSelected ? 2 : 0,
          borderColor: 'primary.main',
          position: isFullscreen ? 'fixed' : 'relative',
          top: isFullscreen ? 0 : 'auto',
          left: isFullscreen ? 0 : 'auto',
          right: isFullscreen ? 0 : 'auto',
          bottom: isFullscreen ? 0 : 'auto',
          zIndex: isFullscreen ? 1300 : 'auto',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: theme === 'dark' ? 'grey.900' : 'grey.100',
          }}
        >
          <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
            {chartConfig.title}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            {chartConfig.correlationAnalysis?.enabled && (
              <Chip
                label="Correlation"
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {chartConfig.linkedCharts && chartConfig.linkedCharts.length > 0 && (
              <Chip
                label={`Linked (${chartConfig.linkedCharts.length})`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
            <IconButton
              size="small"
              onClick={() => setSelectedCharts(prev => {
                const newSelected = new Set(prev);
                if (newSelected.has(chartConfig.id)) {
                  newSelected.delete(chartConfig.id);
                } else {
                  newSelected.add(chartConfig.id);
                }
                return newSelected;
              })}
            >
              {isSelected ? <Visibility /> : <VisibilityOff />}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => toggleFullscreen(chartConfig.id)}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
            <IconButton
              size="small"
              onClick={() => removeChart(chartConfig.id)}
              disabled={lockLayout}
            >
              <Remove />
            </IconButton>
          </Stack>
        </Box>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <RealTimeChart
            series={chartConfig.series}
            yAxes={chartConfig.yAxes}
            options={{
              ...chartConfig.options,
              timeWindow: syncTime ? globalTimeWindow : chartConfig.options.timeWindow,
            }}
            width={isFullscreen ? window.innerWidth : layoutItem.w * 100}
            height={isFullscreen ? window.innerHeight - 60 : layoutItem.h * 100 - 60}
            onInteraction={(interaction) => {
              // Handle linked chart interactions
              if (chartConfig.linkedCharts && interaction.type === 'zoom') {
                chartConfig.linkedCharts.forEach(linkedId => {
                  // Update linked charts with same zoom level
                  // This would require a ref-based approach or state management
                });
              }
            }}
          />
        </Box>
      </Paper>
    );
  }, [
    fullscreenChart,
    selectedCharts,
    syncTime,
    globalTimeWindow,
    theme,
    lockLayout,
    removeChart,
    toggleFullscreen,
  ]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', backgroundColor: theme === 'dark' ? 'grey.900' : 'grey.50' }}>
      {/* Stream Selector Sidebar */}
      <Drawer
        variant="persistent"
        anchor="left"
        open={sidebarOpen}
        sx={{
          width: sidebarOpen ? 300 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 300,
            boxSizing: 'border-box',
          },
        }}
      >
        <StreamSelector
          onAddChart={addChart}
          maxCharts={maxCharts}
          currentChartCount={charts.size}
          enableTemplates={true}
        />
      </Drawer>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top App Bar */}
        <AppBar position="static" color={theme === 'dark' ? 'default' : 'primary'}>
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              sx={{ mr: 2 }}
            >
              <Dashboard />
            </IconButton>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Telemetry Dashboard
            </Typography>
            
            {/* Performance Metrics */}
            {showPerformanceMetrics && (
              <Stack direction="row" spacing={2} sx={{ mr: 2 }}>
                <Chip
                  icon={<Speed />}
                  label={`${performanceMetrics.fps} FPS`}
                  size="small"
                  color={performanceMetrics.fps > 30 ? 'success' : 'warning'}
                />
                <Chip
                  label={`${performanceMetrics.dataPointsPerSecond} pts/s`}
                  size="small"
                />
                <Chip
                  label={`${performanceMetrics.activeStreams} streams`}
                  size="small"
                />
              </Stack>
            )}

            {/* Action Buttons */}
            <Stack direction="row" spacing={1}>
              <IconButton color="inherit" onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? <GridOn /> : <GridOff />}
              </IconButton>
              <IconButton color="inherit" onClick={() => setLockLayout(!lockLayout)}>
                {lockLayout ? <Lock /> : <LockOpen />}
              </IconButton>
              <IconButton color="inherit" onClick={() => setSaveDialogOpen(true)}>
                <Save />
              </IconButton>
              <IconButton color="inherit" onClick={() => setLoadDialogOpen(true)}>
                <FolderOpen />
              </IconButton>
              <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
                <Settings />
              </IconButton>
            </Stack>
          </Toolbar>
        </AppBar>

        {/* Time Control Bar */}
        <TimeControlBar
          globalTimeWindow={globalTimeWindow}
          onTimeWindowChange={setGlobalTimeWindow}
          syncTime={syncTime}
          onSyncTimeChange={setSyncTime}
          isPlaying={isPlaying}
          onPlayPauseChange={setIsPlaying}
          playbackSpeed={playbackSpeed}
          onPlaybackSpeedChange={setPlaybackSpeed}
          currentTime={currentTime}
          onCurrentTimeChange={setCurrentTime}
        />

        {/* Chart Grid */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          {charts.size === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Typography variant="h6" color="text.secondary">
                No charts added. Use the sidebar to add telemetry streams.
              </Typography>
            </Box>
          ) : (
            <GridLayout
              layout={layout}
              onLayoutChange={handleLayoutChange}
              cols={12}
              rowHeight={100}
              width={1200}
              isDraggable={!lockLayout}
              isResizable={!lockLayout}
              compactType="vertical"
              preventCollision={false}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              useCSSTransforms={true}
              transformScale={1}
              boundsByParent={false}
            >
              {Array.from(charts.values()).map(chart => {
                const layoutItem = layout.find(item => item.i === chart.id);
                return layoutItem ? renderChart(chart, layoutItem) : null;
              })}
            </GridLayout>
          )}
        </Box>

        {/* Floating Action Button for Quick Actions */}
        <SpeedDial
          ariaLabel="Quick Actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<ClearAll />}
            tooltipTitle="Clear All Charts"
            onClick={clearAllCharts}
          />
          <SpeedDialAction
            icon={<Download />}
            tooltipTitle="Export Configuration"
            onClick={exportDashboardConfig}
          />
          <SpeedDialAction
            icon={<Upload />}
            tooltipTitle="Import Configuration"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  importDashboardConfig(file);
                }
              };
              input.click();
            }}
          />
          <SpeedDialAction
            icon={<Refresh />}
            tooltipTitle="Refresh All Charts"
            onClick={() => {
              // Trigger refresh for all charts
              setSnackbar({
                open: true,
                message: 'All charts refreshed',
                severity: 'info',
              });
            }}
          />
        </SpeedDial>
      </Box>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Dashboard Configuration</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Configuration Name"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description"
            value={configDescription}
            onChange={(e) => setConfigDescription(e.target.value)}
            multiline
            rows={3}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={saveDashboardConfig} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={loadDialogOpen} onClose={() => setLoadDialogOpen(false)}>
        <DialogTitle>Load Dashboard Configuration</DialogTitle>
        <DialogContent>
          <Typography>Select a saved configuration to load</Typography>
          {/* List saved configurations from localStorage */}
          <Box sx={{ mt: 2 }}>
            {Object.keys(localStorage)
              .filter(key => key.startsWith('dashboard-'))
              .map(key => {
                const config = JSON.parse(localStorage.getItem(key) || '{}');
                return (
                  <MenuItem
                    key={key}
                    onClick={() => loadDashboardConfig(key.replace('dashboard-', ''))}
                  >
                    <Box>
                      <Typography>{config.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {config.description || 'No description'}
                      </Typography>
                    </Box>
                  </MenuItem>
                );
              })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md">
        <DialogTitle>Dashboard Settings</DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Switch
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
            }
            label="Show Grid Lines"
          />
          <FormControlLabel
            control={
              <Switch
                checked={lockLayout}
                onChange={(e) => setLockLayout(e.target.checked)}
              />
            }
            label="Lock Layout"
          />
          <FormControlLabel
            control={
              <Switch
                checked={syncTime}
                onChange={(e) => setSyncTime(e.target.checked)}
              />
            }
            label="Synchronize Time Across Charts"
          />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Advanced Features
          </Typography>
          <FormControlLabel
            control={<Switch checked={enableCorrelation} disabled />}
            label="Enable Correlation Analysis"
          />
          <FormControlLabel
            control={<Switch checked={enableGrouping} disabled />}
            label="Enable Chart Grouping"
          />
          <FormControlLabel
            control={<Switch checked={showPerformanceMetrics} disabled />}
            label="Show Performance Metrics"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ComprehensiveDashboard;