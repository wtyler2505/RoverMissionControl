import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Avatar,
  useTheme,
  alpha,
  CircularProgress,
  Alert,
  Fade,
  Zoom,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  AppBar,
  Toolbar,
  Badge,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  DeviceHub,
  Build,
  BugReport,
  SystemUpdate,
  Message,
  PlayCircle,
  Settings,
  Search,
  Notifications,
  DarkMode,
  LightMode,
  Security,
  ExitToApp,
  Refresh,
  Download,
  Upload,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  Storage,
  Memory,
  NetworkCheck,
  Speed,
  Timeline,
  Assessment,
} from '@mui/icons-material';

// Import existing HAL components
import DeviceDiscoveryPanel from '../HardwareDiscovery/DeviceDiscoveryPanel';
import DiagnosticsDashboard from '../HardwareDiagnostics/DiagnosticsDashboard';
import FirmwareManagementDashboard from '../FirmwareManagement/FirmwareManagementDashboard';
import CommunicationLogViewer from '../CommunicationLogs/CommunicationLogViewer';
import SimulationDashboard from '../SimulationControl/SimulationDashboard';

interface SystemStatus {
  totalDevices: number;
  activeDevices: number;
  firmwareUpdatesAvailable: number;
  criticalAlerts: number;
  warningAlerts: number;
  simulationActive: boolean;
  lastScanTime: Date;
  systemHealth: 'healthy' | 'warning' | 'critical';
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactElement;
  action: () => void;
  disabled?: boolean;
  requiresRole?: string[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`hal-tabpanel-${index}`}
      aria-labelledby={`hal-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const HALDashboard: React.FC = () => {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [darkMode, setDarkMode] = useState(theme.palette.mode === 'dark');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    totalDevices: 0,
    activeDevices: 0,
    firmwareUpdatesAvailable: 0,
    criticalAlerts: 0,
    warningAlerts: 0,
    simulationActive: false,
    lastScanTime: new Date(),
    systemHealth: 'healthy',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Simulate loading initial data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      // Simulate fetching system status
      setSystemStatus({
        totalDevices: 12,
        activeDevices: 8,
        firmwareUpdatesAvailable: 3,
        criticalAlerts: 0,
        warningAlerts: 2,
        simulationActive: true,
        lastScanTime: new Date(),
        systemHealth: 'warning',
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    await new Promise(resolve => setTimeout(resolve, 2000));
    setSystemStatus(prev => ({
      ...prev,
      lastScanTime: new Date(),
    }));
    setRefreshing(false);
  };

  const quickActions: QuickAction[] = [
    {
      id: 'scan',
      label: 'Scan for Devices',
      icon: <Search />,
      action: () => console.log('Scanning for devices...'),
    },
    {
      id: 'diagnostics',
      label: 'Run Diagnostics',
      icon: <BugReport />,
      action: () => console.log('Running diagnostics...'),
    },
    {
      id: 'firmware',
      label: 'Check Updates',
      icon: <SystemUpdate />,
      action: () => console.log('Checking firmware updates...'),
    },
    {
      id: 'simulation',
      label: 'Toggle Simulation',
      icon: <PlayCircle />,
      action: () => setSystemStatus(prev => ({ ...prev, simulationActive: !prev.simulationActive })),
    },
  ];

  const navigationItems = [
    { label: 'Overview', icon: <DashboardIcon />, index: 0 },
    { label: 'Device Discovery', icon: <DeviceHub />, index: 1 },
    { label: 'Diagnostics', icon: <BugReport />, index: 2 },
    { label: 'Firmware', icon: <SystemUpdate />, index: 3 },
    { label: 'Communication', icon: <Message />, index: 4 },
    { label: 'Simulation', icon: <PlayCircle />, index: 5 },
  ];

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return theme.palette.success.main;
      case 'warning':
        return theme.palette.warning.main;
      case 'critical':
        return theme.palette.error.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle sx={{ color: theme.palette.success.main }} />;
      case 'warning':
        return <Warning sx={{ color: theme.palette.warning.main }} />;
      case 'critical':
        return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      default:
        return <Info sx={{ color: theme.palette.info.main }} />;
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" color="text.secondary">
          Initializing Hardware Abstraction Layer...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
      {/* Side Navigation Drawer */}
      <Drawer
        variant="persistent"
        open={drawerOpen}
        sx={{
          width: drawerOpen ? 280 : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            borderRight: `1px solid ${theme.palette.divider}`,
            backgroundImage: `linear-gradient(180deg, ${alpha(
              theme.palette.primary.main,
              0.05
            )} 0%, transparent 100%)`,
          },
        }}
      >
        <Toolbar>
          <Storage sx={{ mr: 2, color: theme.palette.primary.main }} />
          <Typography variant="h6" noWrap component="div">
            HAL Control Center
          </Typography>
        </Toolbar>
        <Divider />
        <List>
          {navigationItems.map((item) => (
            <ListItemButton
              key={item.index}
              selected={activeTab === item.index}
              onClick={() => setActiveTab(item.index)}
              sx={{
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  borderLeft: `4px solid ${theme.palette.primary.main}`,
                },
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <Box sx={{ p: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                icon={<LightMode />}
                checkedIcon={<DarkMode />}
              />
            }
            label="Dark Mode"
          />
        </Box>
      </Drawer>

      {/* Main Content Area */}
      <Box component="main" sx={{ flexGrow: 1, overflow: 'auto' }}>
        {/* Top Bar */}
        <AppBar
          position="sticky"
          color="default"
          elevation={0}
          sx={{
            borderBottom: `1px solid ${theme.palette.divider}`,
            bgcolor: 'background.paper',
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ mr: 2 }}
            >
              <DashboardIcon />
            </IconButton>

            <Box sx={{ flexGrow: 1 }} />

            {/* System Status Indicators */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 2 }}>
              <Tooltip title="System Health">
                <Chip
                  icon={getHealthIcon(systemStatus.systemHealth)}
                  label={systemStatus.systemHealth.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: alpha(getHealthColor(systemStatus.systemHealth), 0.1),
                    color: getHealthColor(systemStatus.systemHealth),
                    fontWeight: 'bold',
                  }}
                />
              </Tooltip>

              <Tooltip title="Active Devices">
                <Badge badgeContent={systemStatus.activeDevices} color="primary">
                  <DeviceHub />
                </Badge>
              </Tooltip>

              <Tooltip title="Alerts">
                <Badge
                  badgeContent={systemStatus.criticalAlerts + systemStatus.warningAlerts}
                  color="error"
                >
                  <Notifications />
                </Badge>
              </Tooltip>
            </Box>

            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={refreshing}>
                <Refresh className={refreshing ? 'rotating' : ''} />
              </IconButton>
            </Tooltip>

            <IconButton>
              <Settings />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Content Area */}
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <TabPanel value={activeTab} index={0}>
            {/* Overview Dashboard */}
            <Fade in timeout={500}>
              <Box>
                <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
                  Hardware Abstraction Layer Overview
                </Typography>

                {/* Status Cards */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Zoom in timeout={300}>
                      <Card
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                          color: 'white',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ bgcolor: alpha('#fff', 0.2), mr: 2 }}>
                              <DeviceHub />
                            </Avatar>
                            <Box>
                              <Typography variant="h3">{systemStatus.totalDevices}</Typography>
                              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Total Devices
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {systemStatus.activeDevices} active
                          </Typography>
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Zoom in timeout={400}>
                      <Card
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                          color: 'white',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ bgcolor: alpha('#fff', 0.2), mr: 2 }}>
                              <NetworkCheck />
                            </Avatar>
                            <Box>
                              <Typography variant="h3">
                                {Math.round((systemStatus.activeDevices / systemStatus.totalDevices) * 100)}%
                              </Typography>
                              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Connection Rate
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            All protocols active
                          </Typography>
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Zoom in timeout={500}>
                      <Card
                        sx={{
                          background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                          color: 'white',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ bgcolor: alpha('#fff', 0.2), mr: 2 }}>
                              <SystemUpdate />
                            </Avatar>
                            <Box>
                              <Typography variant="h3">{systemStatus.firmwareUpdatesAvailable}</Typography>
                              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Updates Available
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            Review and install
                          </Typography>
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>

                  <Grid item xs={12} sm={6} md={3}>
                    <Zoom in timeout={600}>
                      <Card
                        sx={{
                          background: systemStatus.simulationActive
                            ? `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`
                            : `linear-gradient(135deg, ${theme.palette.grey[600]} 0%, ${theme.palette.grey[800]} 100%)`,
                          color: 'white',
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar sx={{ bgcolor: alpha('#fff', 0.2), mr: 2 }}>
                              <PlayCircle />
                            </Avatar>
                            <Box>
                              <Typography variant="h5">
                                {systemStatus.simulationActive ? 'ACTIVE' : 'INACTIVE'}
                              </Typography>
                              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                Simulation Mode
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {systemStatus.simulationActive ? 'Running scenarios' : 'Ready to start'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Zoom>
                  </Grid>
                </Grid>

                {/* Quick Actions */}
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Quick Actions
                </Typography>
                <Grid container spacing={2} sx={{ mb: 4 }}>
                  {quickActions.map((action, index) => (
                    <Grid item xs={12} sm={6} md={3} key={action.id}>
                      <Zoom in timeout={300 + index * 100}>
                        <Card>
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Avatar
                              sx={{
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                color: theme.palette.primary.main,
                                width: 56,
                                height: 56,
                                mx: 'auto',
                                mb: 2,
                              }}
                            >
                              {action.icon}
                            </Avatar>
                            <Typography variant="h6">{action.label}</Typography>
                          </CardContent>
                          <CardActions>
                            <Button
                              fullWidth
                              variant="contained"
                              onClick={action.action}
                              disabled={action.disabled}
                            >
                              Execute
                            </Button>
                          </CardActions>
                        </Card>
                      </Zoom>
                    </Grid>
                  ))}
                </Grid>

                {/* Recent Activity */}
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  Recent Activity
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    Device Arduino_Rover_01 connected via Serial (COM3)
                  </Alert>
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Firmware update completed for ESP32_Sensor_02
                  </Alert>
                  <Alert severity="warning">
                    High latency detected on CAN bus network
                  </Alert>
                </Paper>
              </Box>
            </Fade>
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <DeviceDiscoveryPanel />
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <DiagnosticsDashboard />
          </TabPanel>

          <TabPanel value={activeTab} index={3}>
            <FirmwareManagementDashboard />
          </TabPanel>

          <TabPanel value={activeTab} index={4}>
            <CommunicationLogViewer />
          </TabPanel>

          <TabPanel value={activeTab} index={5}>
            <SimulationDashboard />
          </TabPanel>
        </Container>
      </Box>

      <style jsx global>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default HALDashboard;