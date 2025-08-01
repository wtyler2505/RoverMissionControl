/**
 * Unified Progress Dashboard Component
 * 
 * Provides a comprehensive view of all command progress, real-time updates,
 * performance metrics, and system health monitoring.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  IconButton,
  Badge,
  Tooltip,
  Chip,
  useTheme,
  alpha,
  Drawer,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Fade,
  Zoom,
  useMediaQuery
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Notifications as NotificationsIcon,
  Analytics as AnalyticsIcon,
  Warning as WarningIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FilterList as FilterIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ProgressTrackingService } from '../../services/progress-tracking.service';
import { 
  EnhancedProgress, 
  ProgressNotification,
  Alert,
  PerformanceAnalytics,
  DashboardWidget,
  CommandPerformanceMetrics
} from '../../types/progress-tracking.types';
import { CommandOverview } from './widgets/CommandOverview';
import { PerformanceChart } from './widgets/PerformanceChart';
import { NotificationFeed } from './widgets/NotificationFeed';
import { AlertList } from './widgets/AlertList';
import { ResourceUsageMonitor } from './widgets/ResourceUsageMonitor';
import { CommandQueue } from './widgets/CommandQueue';
import { MetricsSummary } from './widgets/MetricsSummary';
import { ProgressTimeline } from './widgets/ProgressTimeline';
import { DashboardSettings } from './DashboardSettings';

interface ProgressDashboardProps {
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  filterCommandTypes?: string[];
  filterPriorities?: number[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
};

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  fullScreen = false,
  onToggleFullScreen,
  filterCommandTypes = [],
  filterPriorities = []
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Service instance
  const progressService = useMemo(() => ProgressTrackingService.getInstance(), []);

  // State
  const [activeTab, setActiveTab] = useState(0);
  const [progressMap, setProgressMap] = useState<Map<string, EnhancedProgress>>(new Map());
  const [notifications, setNotifications] = useState<ProgressNotification[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [analytics, setAnalytics] = useState<PerformanceAnalytics | null>(null);
  const [metrics, setMetrics] = useState<CommandPerformanceMetrics[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Subscribe to service observables
  useEffect(() => {
    const subscriptions = [
      // Progress updates
      progressService.getAllProgress$().subscribe(progress => {
        if (!isPaused) {
          setProgressMap(progress);
          setLastUpdate(new Date());
        }
      }),

      // Notifications
      progressService.getNotifications$().subscribe(notification => {
        setNotifications(prev => [notification, ...prev].slice(0, 100)); // Keep last 100
        if (!notification.read) {
          setUnreadNotifications(prev => prev + 1);
        }
      }),

      // Alerts
      progressService.getAlerts$().subscribe(alert => {
        setAlerts(prev => {
          const updated = prev.filter(a => a.id !== alert.id);
          return [alert, ...updated];
        });
        if (!alert.acknowledged) {
          setActiveAlerts(prev => prev + 1);
        } else {
          setActiveAlerts(prev => Math.max(0, prev - 1));
        }
      }),

      // Analytics
      progressService.getAnalytics$().subscribe(data => {
        if (data && !isPaused) {
          setAnalytics(data);
        }
      }),

      // Metrics
      progressService.getMetrics$().subscribe(metric => {
        if (!isPaused) {
          setMetrics(prev => [...prev, metric].slice(-50)); // Keep last 50
        }
      })
    ];

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [progressService, isPaused]);

  // Filter progress based on props
  const filteredProgress = useMemo(() => {
    const filtered = new Map<string, EnhancedProgress>();
    progressMap.forEach((progress, commandId) => {
      // Apply filters if needed
      // For now, include all
      filtered.set(commandId, progress);
    });
    return filtered;
  }, [progressMap, filterCommandTypes, filterPriorities]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = filteredProgress.size;
    let active = 0;
    let completed = 0;
    let failed = 0;
    let stalled = 0;

    filteredProgress.forEach(progress => {
      if (progress.overallProgress >= 1) {
        completed++;
      } else if (progress.errorRate > 0) {
        failed++;
      } else if (progress.isStalled) {
        stalled++;
      } else if (progress.overallProgress > 0) {
        active++;
      }
    });

    return { total, active, completed, failed, stalled };
  }, [filteredProgress]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleNotificationRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadNotifications(prev => Math.max(0, prev - 1));
  };

  const handleAlertAcknowledge = (alertId: string) => {
    progressService.acknowledgeAlert(alertId, 'current-user'); // TODO: Get actual user ID
  };

  const handleRefresh = () => {
    setLastUpdate(new Date());
    // Force refresh analytics
    progressService['calculateAnalytics']();
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
  };

  const getDashboardLayout = () => {
    if (isMobile) {
      return { cols: 1, spacing: 2 };
    } else if (isTablet) {
      return { cols: 2, spacing: 2 };
    } else {
      return { cols: 3, spacing: 3 };
    }
  };

  const layout = getDashboardLayout();

  return (
    <Box sx={{ height: fullScreen ? '100vh' : 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar variant="dense">
          <DashboardIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Progress Dashboard
          </Typography>

          {/* Status Chips */}
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Chip 
              label={`Active: ${summaryStats.active}`} 
              color="primary" 
              size="small"
              variant="outlined"
            />
            <Chip 
              label={`Completed: ${summaryStats.completed}`} 
              color="success" 
              size="small"
              variant="outlined"
            />
            {summaryStats.failed > 0 && (
              <Chip 
                label={`Failed: ${summaryStats.failed}`} 
                color="error" 
                size="small"
              />
            )}
            {summaryStats.stalled > 0 && (
              <Chip 
                label={`Stalled: ${summaryStats.stalled}`} 
                color="warning" 
                size="small"
              />
            )}
          </Box>

          {/* Action Buttons */}
          <Tooltip title={isPaused ? "Resume Updates" : "Pause Updates"}>
            <IconButton onClick={togglePause} color={isPaused ? "error" : "default"}>
              {isPaused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Notifications">
            <IconButton>
              <Badge badgeContent={unreadNotifications} color="primary">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Alerts">
            <IconButton>
              <Badge badgeContent={activeAlerts} color="error">
                <WarningIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          {onToggleFullScreen && (
            <Tooltip title={fullScreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
              <IconButton onClick={onToggleFullScreen}>
                {fullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              </IconButton>
            </Tooltip>
          )}
        </Toolbar>

        {/* Tabs */}
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant={isMobile ? "scrollable" : "standard"}
          scrollButtons={isMobile ? "auto" : false}
        >
          <Tab label="Overview" icon={<DashboardIcon />} iconPosition="start" />
          <Tab label="Performance" icon={<AnalyticsIcon />} iconPosition="start" />
          <Tab label="Notifications" icon={<NotificationsIcon />} iconPosition="start" />
          <Tab label="Alerts" icon={<WarningIcon />} iconPosition="start" />
        </Tabs>
      </AppBar>

      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
        {/* Overview Tab */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={layout.spacing}>
            {/* Command Overview */}
            <Grid item xs={12} md={8}>
              <Fade in timeout={300}>
                <Paper sx={{ p: 2, height: '400px' }}>
                  <CommandOverview 
                    progressMap={filteredProgress}
                    onCommandClick={(commandId) => console.log('Command clicked:', commandId)}
                  />
                </Paper>
              </Fade>
            </Grid>

            {/* Metrics Summary */}
            <Grid item xs={12} md={4}>
              <Fade in timeout={400}>
                <Paper sx={{ p: 2, height: '400px' }}>
                  <MetricsSummary 
                    analytics={analytics}
                    recentMetrics={metrics}
                  />
                </Paper>
              </Fade>
            </Grid>

            {/* Command Queue */}
            <Grid item xs={12} md={6}>
              <Fade in timeout={500}>
                <Paper sx={{ p: 2, height: '300px' }}>
                  <CommandQueue 
                    progressMap={filteredProgress}
                  />
                </Paper>
              </Fade>
            </Grid>

            {/* Resource Usage */}
            <Grid item xs={12} md={6}>
              <Fade in timeout={600}>
                <Paper sx={{ p: 2, height: '300px' }}>
                  <ResourceUsageMonitor 
                    analytics={analytics}
                  />
                </Paper>
              </Fade>
            </Grid>

            {/* Progress Timeline */}
            <Grid item xs={12}>
              <Fade in timeout={700}>
                <Paper sx={{ p: 2, height: '250px' }}>
                  <ProgressTimeline 
                    progressMap={filteredProgress}
                  />
                </Paper>
              </Fade>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={layout.spacing}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, height: '600px' }}>
                <PerformanceChart 
                  metrics={metrics}
                  analytics={analytics}
                  timeRange="last_1h"
                />
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={activeTab} index={2}>
          <Paper sx={{ p: 2, maxHeight: '600px', overflow: 'auto' }}>
            <NotificationFeed 
              notifications={notifications}
              onRead={handleNotificationRead}
              onAction={(notificationId, action) => {
                console.log('Notification action:', notificationId, action);
              }}
            />
          </Paper>
        </TabPanel>

        {/* Alerts Tab */}
        <TabPanel value={activeTab} index={3}>
          <Paper sx={{ p: 2, maxHeight: '600px', overflow: 'auto' }}>
            <AlertList 
              alerts={alerts}
              onAcknowledge={handleAlertAcknowledge}
              onResolve={(alertId) => console.log('Resolve alert:', alertId)}
            />
          </Paper>
        </TabPanel>
      </Box>

      {/* Last Update Indicator */}
      <Box sx={{ 
        position: 'absolute', 
        bottom: 16, 
        right: 16,
        bgcolor: alpha(theme.palette.background.paper, 0.9),
        px: 2,
        py: 0.5,
        borderRadius: 2,
        boxShadow: 1
      }}>
        <Typography variant="caption" color="text.secondary">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Typography>
      </Box>

      {/* Settings Drawer */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <DashboardSettings 
          onClose={() => setSettingsOpen(false)}
          onConfigUpdate={(config) => {
            progressService.updateConfig(config);
            setSettingsOpen(false);
          }}
        />
      </Drawer>
    </Box>
  );
};