/**
 * HistoricalComparisonDashboard Component
 * Comprehensive dashboard for historical data comparison across multiple telemetry streams
 * Provides advanced analytics, comparison tools, and data management capabilities
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Chip,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Alert,
  LinearProgress,
  Tooltip,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Snackbar
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Timeline as TimelineIcon,
  Assessment as AnalyticsIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Compare as CompareIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Memory as MemoryIcon,
  Speed as PerformanceIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Save as SaveIcon,
  Restore as LoadIcon
} from '@mui/icons-material';

import { HistoricalComparisonChart } from './HistoricalComparisonChart';
import { ComparisonModeSelector } from './ComparisonModeSelector';
import { StatisticalSummaryPanel } from './StatisticalSummaryPanel';
import { TimeRangeAlignmentTools } from './TimeRangeAlignmentTools';
import { ProgressiveDataLoader } from './ProgressiveDataLoader';
import { useHistoricalComparison } from './useHistoricalComparison';

import {
  ComparisonMode,
  HistoricalPeriod,
  ComparisonDataset,
  AlignmentConfig,
  TimeRange,
  ProgressiveLoadingConfig,
  StatisticalMetric,
  DEFAULT_TIME_PRESETS,
  DEFAULT_COMPARISON_COLORS
} from './types';

export interface HistoricalComparisonDashboardProps {
  // Data sources
  telemetryStreams: Array<{
    id: string;
    name: string;
    data: any[];
    unit?: string;
    description?: string;
  }>;
  
  // Configuration
  defaultLayout?: 'grid' | 'tabs' | 'single';
  allowLayoutChange?: boolean;
  enableRealTimeUpdates?: boolean;
  
  // Features
  enableAdvancedAnalytics?: boolean;
  enableDataExport?: boolean;
  enableSessionManagement?: boolean;
  
  // Callbacks
  onDataRequest?: (streamId: string, timeRange: TimeRange, resolution: number) => Promise<any[]>;
  onSessionSave?: (session: any) => void;
  onSessionLoad?: (sessionId: string) => any;
}

interface DashboardState {
  activeTab: number;
  layout: 'grid' | 'tabs' | 'single';
  sidebarOpen: boolean;
  selectedStreams: string[];
  globalAlignment: AlignmentConfig;
  globalMode: ComparisonMode;
  notifications: Array<{
    id: string;
    type: 'info' | 'warning' | 'error' | 'success';
    message: string;
    timestamp: Date;
  }>;
}

export const HistoricalComparisonDashboard: React.FC<HistoricalComparisonDashboardProps> = ({
  telemetryStreams = [],
  defaultLayout = 'tabs',
  allowLayoutChange = true,
  enableRealTimeUpdates = true,
  enableAdvancedAnalytics = true,
  enableDataExport = true,
  enableSessionManagement = true,
  onDataRequest,
  onSessionSave,
  onSessionLoad
}) => {
  // Dashboard state
  const [state, setState] = useState<DashboardState>({
    activeTab: 0,
    layout: defaultLayout,
    sidebarOpen: false,
    selectedStreams: telemetryStreams.slice(0, 2).map(s => s.id),
    globalAlignment: { mode: 'absolute' },
    globalMode: 'overlay',
    notifications: []
  });

  // Progressive loading configuration
  const loadingConfig: ProgressiveLoadingConfig = useMemo(() => ({
    enableProgressive: true,
    overviewResolution: 200,
    detailResolution: 1000,
    fullResolution: 5000,
    chunkSize: 20000,
    maxConcurrentRequests: 4,
    adaptiveLoading: true,
    memoryThreshold: 800
  }), []);

  // Historical comparison hooks for each selected stream
  const streamComparisons = useMemo(() => {
    const comparisons: Record<string, ReturnType<typeof useHistoricalComparison>> = {};
    
    state.selectedStreams.forEach(streamId => {
      // Note: In a real implementation, each stream would have its own hook instance
      // For now, we'll simulate this with a single hook per stream
    });
    
    return comparisons;
  }, [state.selectedStreams]);

  // Overall system metrics
  const [systemMetrics, setSystemMetrics] = useState({
    totalMemoryUsage: 0,
    totalDataPoints: 0,
    activeComparisons: 0,
    loadingTasks: 0
  });

  // Add notification
  const addNotification = useCallback((type: DashboardState['notifications'][0]['type'], message: string) => {
    const notification = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date()
    };
    
    setState(prev => ({
      ...prev,
      notifications: [...prev.notifications, notification]
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== notification.id)
      }));
    }, 5000);
  }, []);

  // Handle stream selection change
  const handleStreamSelectionChange = useCallback((streamId: string, selected: boolean) => {
    setState(prev => ({
      ...prev,
      selectedStreams: selected 
        ? [...prev.selectedStreams, streamId]
        : prev.selectedStreams.filter(id => id !== streamId)
    }));

    addNotification('info', `${selected ? 'Added' : 'Removed'} stream: ${telemetryStreams.find(s => s.id === streamId)?.name}`);
  }, [telemetryStreams, addNotification]);

  // Handle global alignment change
  const handleGlobalAlignmentChange = useCallback((alignment: AlignmentConfig) => {
    setState(prev => ({ ...prev, globalAlignment: alignment }));
    addNotification('info', `Global alignment changed to ${alignment.mode}`);
  }, [addNotification]);

  // Handle global mode change
  const handleGlobalModeChange = useCallback((mode: ComparisonMode) => {
    setState(prev => ({ ...prev, globalMode: mode }));
    addNotification('info', `Global comparison mode changed to ${mode}`);
  }, [addNotification]);

  // Handle layout change
  const handleLayoutChange = useCallback((layout: DashboardState['layout']) => {
    setState(prev => ({ ...prev, layout }));
  }, []);

  // Export all data
  const handleExportAll = useCallback(async (format: 'csv' | 'json') => {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        streams: state.selectedStreams.map(streamId => {
          const stream = telemetryStreams.find(s => s.id === streamId);
          return {
            id: streamId,
            name: stream?.name,
            data: stream?.data || []
          };
        }),
        configuration: {
          alignment: state.globalAlignment,
          mode: state.globalMode,
          layout: state.layout
        }
      };

      const content = format === 'csv' ? convertToCSV(data) : JSON.stringify(data, null, 2);
      const blob = new Blob([content], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historical-comparison-dashboard.${format}`;
      link.click();
      URL.revokeObjectURL(url);

      addNotification('success', `Dashboard data exported as ${format.toUpperCase()}`);
    } catch (error) {
      addNotification('error', 'Failed to export dashboard data');
    }
  }, [state, telemetryStreams, addNotification]);

  // Save session
  const handleSaveSession = useCallback(() => {
    const session = {
      id: Date.now().toString(),
      name: `Session ${new Date().toLocaleString()}`,
      timestamp: new Date().toISOString(),
      configuration: {
        selectedStreams: state.selectedStreams,
        globalAlignment: state.globalAlignment,
        globalMode: state.globalMode,
        layout: state.layout
      }
    };

    onSessionSave?.(session);
    addNotification('success', 'Session saved successfully');
  }, [state, onSessionSave, addNotification]);

  // Update system metrics periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const totalDataPoints = telemetryStreams
        .filter(s => state.selectedStreams.includes(s.id))
        .reduce((sum, stream) => sum + (stream.data?.length || 0), 0);

      setSystemMetrics({
        totalMemoryUsage: totalDataPoints * 64 / (1024 * 1024), // Rough estimate in MB
        totalDataPoints,
        activeComparisons: state.selectedStreams.length,
        loadingTasks: 0 // Would be calculated from actual loading states
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [telemetryStreams, state.selectedStreams]);

  // Render dashboard header
  const renderHeader = () => (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          onClick={() => setState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }))}
        >
          <MenuIcon />
        </IconButton>
        
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Historical Comparison Dashboard
        </Typography>

        {/* System metrics */}
        <Box display="flex" alignItems="center" gap={2} mr={2}>
          <Tooltip title={`${systemMetrics.totalDataPoints.toLocaleString()} data points`}>
            <Chip
              icon={<TimelineIcon />}
              label={`${Math.round(systemMetrics.totalDataPoints / 1000)}K`}
              size="small"
              variant="outlined"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
            />
          </Tooltip>
          
          <Tooltip title={`Memory usage: ${systemMetrics.totalMemoryUsage.toFixed(1)} MB`}>
            <Chip
              icon={<MemoryIcon />}
              label={`${systemMetrics.totalMemoryUsage.toFixed(0)}MB`}
              size="small"
              variant="outlined"
              color={systemMetrics.totalMemoryUsage > 500 ? 'warning' : 'default'}
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
            />
          </Tooltip>

          <Badge badgeContent={state.selectedStreams.length} color="secondary">
            <CompareIcon />
          </Badge>
        </Box>

        {/* Layout controls */}
        {allowLayoutChange && (
          <Box display="flex" gap={1}>
            {(['grid', 'tabs', 'single'] as const).map(layout => (
              <Button
                key={layout}
                size="small"
                variant={state.layout === layout ? 'contained' : 'outlined'}
                onClick={() => handleLayoutChange(layout)}
                sx={{ 
                  color: 'white', 
                  borderColor: 'rgba(255,255,255,0.5)',
                  '&.MuiButton-contained': {
                    backgroundColor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                {layout}
              </Button>
            ))}
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );

  // Render sidebar
  const renderSidebar = () => (
    <Drawer
      anchor="left"
      open={state.sidebarOpen}
      onClose={() => setState(prev => ({ ...prev, sidebarOpen: false }))}
      sx={{ '& .MuiDrawer-paper': { width: 320 } }}
    >
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Dashboard Controls
        </Typography>

        {/* Stream selection */}
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Telemetry Streams
        </Typography>
        <List dense>
          {telemetryStreams.map(stream => (
            <ListItem key={stream.id} disablePadding>
              <ListItemButton
                onClick={() => handleStreamSelectionChange(
                  stream.id, 
                  !state.selectedStreams.includes(stream.id)
                )}
              >
                <ListItemIcon>
                  {state.selectedStreams.includes(stream.id) ? 
                    <CheckCircle color="primary" /> : 
                    <TimelineIcon />
                  }
                </ListItemIcon>
                <ListItemText
                  primary={stream.name}
                  secondary={stream.description}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ my: 2 }} />

        {/* Global controls */}
        <Typography variant="subtitle2" gutterBottom>
          Global Settings
        </Typography>
        
        <ComparisonModeSelector
          currentMode={state.globalMode}
          availableModes={['overlay', 'side-by-side', 'difference', 'statistical']}
          onModeChange={handleGlobalModeChange}
          size="small"
          orientation="vertical"
        />

        <Divider sx={{ my: 2 }} />

        {/* Session management */}
        {enableSessionManagement && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Session Management
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button
                size="small"
                startIcon={<SaveIcon />}
                onClick={handleSaveSession}
                variant="outlined"
              >
                Save
              </Button>
              <Button
                size="small"
                startIcon={<LoadIcon />}
                onClick={() => {/* Implement load session */}}
                variant="outlined"
              >
                Load
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  );

  // Render chart for a specific stream
  const renderStreamChart = (streamId: string) => {
    const stream = telemetryStreams.find(s => s.id === streamId);
    if (!stream) return null;

    // Convert stream data to historical format
    const currentData = stream.data?.map((d: any) => ({
      ...d,
      historicalPeriod: 'current',
      originalTimestamp: d.time,
      alignedTimestamp: d.time
    })) || [];

    return (
      <Card key={streamId} sx={{ height: '100%' }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">{stream.name}</Typography>
            <Chip label={stream.unit || 'units'} size="small" />
          </Box>

          <HistoricalComparisonChart
            currentData={currentData}
            historicalPeriods={[]} // Would be populated with actual periods
            datasets={[]}
            mode={state.globalMode}
            alignment={state.globalAlignment}
            visualization={{
              mode: state.globalMode,
              alignment: state.globalAlignment,
              showConfidenceBands: true,
              showTrendlines: false,
              showAnomalies: true,
              showStatisticalMarkers: false,
              highlightDifferences: state.globalMode === 'difference',
              animationDuration: 300,
              colorScheme: DEFAULT_COMPARISON_COLORS
            }}
            progressiveLoading={loadingConfig}
            showLegend={true}
            dimensions={{ width: 800, height: 400, margin: { top: 20, right: 30, bottom: 40, left: 50 } }}
            onModeChange={handleGlobalModeChange}
            onAlignmentChange={handleGlobalAlignmentChange}
          />
        </CardContent>
        
        <CardActions>
          <Button size="small" startIcon={<HistoryIcon />}>
            Add Historical Period
          </Button>
          <Button size="small" startIcon={<AnalyticsIcon />}>
            Advanced Analytics
          </Button>
        </CardActions>
      </Card>
    );
  };

  // Render main content based on layout
  const renderMainContent = () => {
    switch (state.layout) {
      case 'grid':
        return (
          <Grid container spacing={2}>
            {state.selectedStreams.map(streamId => (
              <Grid item xs={12} md={6} lg={4} key={streamId}>
                {renderStreamChart(streamId)}
              </Grid>
            ))}
          </Grid>
        );

      case 'tabs':
        return (
          <Box>
            <Tabs 
              value={state.activeTab} 
              onChange={(_, newValue) => setState(prev => ({ ...prev, activeTab: newValue }))}
              variant="scrollable"
              scrollButtons="auto"
            >
              {state.selectedStreams.map((streamId, index) => {
                const stream = telemetryStreams.find(s => s.id === streamId);
                return (
                  <Tab 
                    key={streamId} 
                    label={stream?.name || streamId}
                    icon={<TimelineIcon />}
                  />
                );
              })}
            </Tabs>
            
            {state.selectedStreams.map((streamId, index) => (
              <Box 
                key={streamId}
                hidden={state.activeTab !== index}
                sx={{ pt: 2 }}
              >
                {state.activeTab === index && renderStreamChart(streamId)}
              </Box>
            ))}
          </Box>
        );

      case 'single':
        const activeStreamId = state.selectedStreams[state.activeTab] || state.selectedStreams[0];
        return activeStreamId ? renderStreamChart(activeStreamId) : null;

      default:
        return null;
    }
  };

  // Convert data to CSV format
  const convertToCSV = (data: any): string => {
    // Simple CSV conversion implementation
    return JSON.stringify(data);
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      {renderHeader()}

      {/* Sidebar */}
      {renderSidebar()}

      {/* Main content */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {/* System alerts */}
        {systemMetrics.totalMemoryUsage > 600 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            High memory usage detected ({systemMetrics.totalMemoryUsage.toFixed(1)} MB). 
            Consider reducing data resolution or removing streams.
          </Alert>
        )}

        {/* Main content area */}
        {renderMainContent()}

        {/* Speed dial for quick actions */}
        <SpeedDial
          ariaLabel="Dashboard Actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<DownloadIcon />}
            tooltipTitle="Export Data"
            onClick={() => handleExportAll('json')}
          />
          <SpeedDialAction
            icon={<RefreshIcon />}
            tooltipTitle="Refresh All"
            onClick={() => addNotification('info', 'Refreshing all data...')}
          />
          <SpeedDialAction
            icon={<SettingsIcon />}
            tooltipTitle="Settings"
            onClick={() => setState(prev => ({ ...prev, sidebarOpen: true }))}
          />
        </SpeedDial>
      </Box>

      {/* Notifications */}
      {state.notifications.map(notification => (
        <Snackbar
          key={notification.id}
          open
          autoHideDuration={5000}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Alert severity={notification.type}>
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </Box>
  );
};

export default HistoricalComparisonDashboard;