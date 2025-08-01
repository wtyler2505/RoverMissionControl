/**
 * ConnectionModal - WebSocket Connection Management Dialog
 * Professional modal for connection errors, reconnection, and configuration
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  AlertTitle,
  Tabs,
  Tab,
  TextField,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Switch,
  Slider,
  Divider,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Storage as StorageIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import {
  ConnectionState,
  ConnectionModalProps,
  WebSocketConfig,
  Protocol,
  ConnectionOptions
} from '../../services/websocket/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`connection-tabpanel-${index}`}
    aria-labelledby={`connection-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

/**
 * Get appropriate alert severity based on connection state
 */
const getAlertSeverity = (state: ConnectionState): 'error' | 'warning' | 'info' | 'success' => {
  switch (state) {
    case ConnectionState.CONNECTED:
    case ConnectionState.AUTHENTICATED:
    case ConnectionState.ACTIVE:
      return 'success';
    case ConnectionState.ERROR:
      return 'error';
    case ConnectionState.CONNECTING:
    case ConnectionState.RECONNECTING:
      return 'warning';
    default:
      return 'info';
  }
};

/**
 * Connection management modal component
 */
export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  open,
  onClose,
  onConnect,
  onDisconnect,
  connectionStatus,
  config
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<WebSocketConfig>>(config);
  const [connectionOptions, setConnectionOptions] = useState<ConnectionOptions>({
    auth: {
      token: '',
      userId: '',
      role: ''
    },
    query: {},
    headers: {}
  });

  const { state, error, metrics, activeSubscriptions } = connectionStatus;
  const isConnected = state === ConnectionState.CONNECTED || 
                     state === ConnectionState.AUTHENTICATED || 
                     state === ConnectionState.ACTIVE;

  useEffect(() => {
    if (state === ConnectionState.CONNECTING || state === ConnectionState.RECONNECTING) {
      setConnecting(true);
    } else {
      setConnecting(false);
    }
  }, [state]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleConnect = async () => {
    if (onConnect) {
      setConnecting(true);
      try {
        await onConnect(connectionOptions);
      } catch (err) {
        console.error('Connection failed:', err);
      } finally {
        setConnecting(false);
      }
    }
  };

  const handleDisconnect = async () => {
    if (onDisconnect) {
      await onDisconnect();
    }
  };

  const handleClose = () => {
    onClose();
  };

  const renderStatusTab = () => (
    <TabPanel value={activeTab} index={0}>
      {/* Connection Status Alert */}
      <Alert 
        severity={getAlertSeverity(state)} 
        sx={{ mb: 2 }}
        icon={
          state === ConnectionState.CONNECTED ? <ConnectedIcon /> :
          state === ConnectionState.ERROR ? <ErrorIcon /> :
          state === ConnectionState.CONNECTING ? <RefreshIcon className="animate-spin" /> :
          <DisconnectedIcon />
        }
      >
        <AlertTitle>
          {state === ConnectionState.CONNECTED && 'Connected'}
          {state === ConnectionState.AUTHENTICATED && 'Authenticated'}
          {state === ConnectionState.ACTIVE && 'Active Connection'}
          {state === ConnectionState.CONNECTING && 'Connecting...'}
          {state === ConnectionState.RECONNECTING && 'Reconnecting...'}
          {state === ConnectionState.ERROR && 'Connection Error'}
          {state === ConnectionState.DISCONNECTED && 'Disconnected'}
          {state === ConnectionState.IDLE && 'Connection Idle'}
        </AlertTitle>
        
        {error && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            {error.message}
          </Typography>
        )}
        
        {connecting && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Establishing connection...
            </Typography>
          </Box>
        )}
      </Alert>

      {/* Connection Metrics */}
      {isConnected && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Connection Metrics
            </Typography>
            
            <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
              <Chip
                icon={<SpeedIcon />}
                label={`${Math.round(metrics.currentLatency)}ms latency`}
                color={metrics.currentLatency < 100 ? 'success' : 
                       metrics.currentLatency < 300 ? 'warning' : 'error'}
                variant="outlined"
              />
              
              <Chip
                icon={<StorageIcon />}
                label={`${metrics.messagesSent + metrics.messagesReceived} messages`}
                variant="outlined"
              />
              
              <Chip
                icon={<SecurityIcon />}
                label={connectionStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
                color={connectionStatus.authenticated ? 'success' : 'warning'}
                variant="outlined"
              />
            </Box>

            <Typography variant="body2" color="text.secondary">
              Uptime: {Math.floor(metrics.uptime / 1000 / 60)} minutes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Reconnections: {metrics.reconnectionCount}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Active Subscriptions ({activeSubscriptions.length})
            </Typography>
            
            <List dense>
              {activeSubscriptions.map((subscription) => (
                <ListItem key={subscription.id}>
                  <ListItemIcon>
                    <Chip
                      size="small"
                      color={subscription.active ? 'success' : 'default'}
                      label={subscription.active ? 'Active' : 'Inactive'}
                    />
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={subscription.channel}
                    secondary={`${subscription.messageCount} messages received`}
                  />
                  
                  <ListItemSecondaryAction>
                    <Typography variant="caption">
                      {new Date(subscription.lastMessage).toLocaleTimeString()}
                    </Typography>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </TabPanel>
  );

  const renderConnectionTab = () => (
    <TabPanel value={activeTab} index={1}>
      <Box display="flex" flexDirection="column" gap={2}>
        {/* Server URL */}
        <TextField
          fullWidth
          label="Server URL"
          value={localConfig.url || ''}
          onChange={(e) => setLocalConfig({ ...localConfig, url: e.target.value })}
          helperText="WebSocket server endpoint (e.g., ws://localhost:8000)"
        />

        {/* Authentication */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Authentication
            </Typography>
            
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                fullWidth
                label="User ID"
                value={connectionOptions.auth?.userId || ''}
                onChange={(e) => setConnectionOptions({
                  ...connectionOptions,
                  auth: { ...connectionOptions.auth, userId: e.target.value }
                })}
              />
              
              <TextField
                fullWidth
                label="Access Token"
                type={showPassword ? 'text' : 'password'}
                value={connectionOptions.auth?.token || ''}
                onChange={(e) => setConnectionOptions({
                  ...connectionOptions,
                  auth: { ...connectionOptions.auth, token: e.target.value }
                })}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  )
                }}
              />
              
              <TextField
                fullWidth
                label="Role"
                value={connectionOptions.auth?.role || ''}
                onChange={(e) => setConnectionOptions({
                  ...connectionOptions,
                  auth: { ...connectionOptions.auth, role: e.target.value }
                })}
                helperText="User role for authorization"
              />
            </Box>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <FormControlLabel
          control={
            <Switch
              checked={showAdvanced}
              onChange={(e) => setShowAdvanced(e.target.checked)}
            />
          }
          label="Show Advanced Settings"
        />

        {showAdvanced && (
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Advanced Configuration
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={3}>
                {/* Timeout Settings */}
                <FormControl>
                  <FormLabel>Connection Timeout (ms)</FormLabel>
                  <Slider
                    value={localConfig.timeout || 20000}
                    onChange={(_, value) => setLocalConfig({
                      ...localConfig,
                      timeout: value as number
                    })}
                    min={5000}
                    max={60000}
                    step={1000}
                    marks={[
                      { value: 5000, label: '5s' },
                      { value: 20000, label: '20s' },
                      { value: 60000, label: '60s' }
                    ]}
                    valueLabelDisplay="on"
                  />
                </FormControl>

                {/* Reconnection Settings */}
                <FormControl>
                  <FormLabel>Max Reconnection Attempts</FormLabel>
                  <Slider
                    value={localConfig.reconnectAttempts || 5}
                    onChange={(_, value) => setLocalConfig({
                      ...localConfig,
                      reconnectAttempts: value as number
                    })}
                    min={1}
                    max={20}
                    step={1}
                    marks={[
                      { value: 1, label: '1' },
                      { value: 5, label: '5' },
                      { value: 10, label: '10' },
                      { value: 20, label: '20' }
                    ]}
                    valueLabelDisplay="on"
                  />
                </FormControl>

                {/* Feature Toggles */}
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localConfig.compression !== false}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          compression: e.target.checked
                        })}
                      />
                    }
                    label="Enable Compression"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localConfig.debug === true}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          debug: e.target.checked
                        })}
                      />
                    }
                    label="Debug Mode"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={localConfig.performance?.enableMetrics !== false}
                        onChange={(e) => setLocalConfig({
                          ...localConfig,
                          performance: {
                            ...localConfig.performance,
                            enableMetrics: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Performance Metrics"
                  />
                </FormGroup>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </TabPanel>
  );

  const renderDiagnosticsTab = () => (
    <TabPanel value={activeTab} index={2}>
      <Box display="flex" flexDirection="column" gap={2}>
        {/* Error Information */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>Error Details</AlertTitle>
            <Typography variant="body2">
              <strong>Type:</strong> {error.type}
            </Typography>
            <Typography variant="body2">
              <strong>Code:</strong> {error.code}
            </Typography>
            <Typography variant="body2">
              <strong>Message:</strong> {error.message}
            </Typography>
            <Typography variant="body2">
              <strong>Recoverable:</strong> {error.recoverable ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="body2">
              <strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString()}
            </Typography>
          </Alert>
        )}

        {/* System Information */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Information
            </Typography>
            
            <Typography variant="body2">
              <strong>User Agent:</strong> {navigator.userAgent}
            </Typography>
            <Typography variant="body2">
              <strong>WebSocket Support:</strong> {typeof WebSocket !== 'undefined' ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="body2">
              <strong>IndexedDB Support:</strong> {typeof indexedDB !== 'undefined' ? 'Yes' : 'No'}
            </Typography>
            <Typography variant="body2">
              <strong>Online:</strong> {navigator.onLine ? 'Yes' : 'No'}
            </Typography>
          </CardContent>
        </Card>

        {/* Protocol Information */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Protocol Configuration
            </Typography>
            
            <Typography variant="body2">
              <strong>Supported Protocols:</strong> {config.protocols.join(', ')}
            </Typography>
            <Typography variant="body2">
              <strong>Compression:</strong> {config.compression ? 'Enabled' : 'Disabled'}
            </Typography>
            <Typography variant="body2">
              <strong>Heartbeat Interval:</strong> {config.heartbeatInterval}ms
            </Typography>
            <Typography variant="body2">
              <strong>Queue Max Size:</strong> {config.queue.maxSize}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </TabPanel>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">WebSocket Connection</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Status" icon={<InfoIcon />} />
          <Tab label="Connection" icon={<SettingsIcon />} />
          <Tab label="Diagnostics" icon={<WarningIcon />} />
        </Tabs>

        {renderStatusTab()}
        {renderConnectionTab()}
        {renderDiagnosticsTab()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
        
        {!isConnected ? (
          <Button
            variant="contained"
            onClick={handleConnect}
            disabled={connecting}
            startIcon={connecting ? <RefreshIcon className="animate-spin" /> : <ConnectedIcon />}
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={handleDisconnect}
            startIcon={<DisconnectedIcon />}
          >
            Disconnect
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};