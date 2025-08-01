import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Notifications as NotificationsIcon,
  NotificationsActive as NotificationsActiveIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ExpandMore as ExpandMoreIcon,
  VolumeUp as VolumeUpIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Web as WebhookIcon,
  History as HistoryIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';

// Alert system interfaces
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertCondition = 'above' | 'below' | 'equal' | 'not_equal' | 'change_rate' | 'anomaly_count' | 'correlation_loss';
export type NotificationMethod = 'browser' | 'email' | 'sms' | 'webhook' | 'sound';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  streamId: string;
  streamName: string;
  enabled: boolean;
  condition: AlertCondition;
  threshold: number;
  severity: AlertSeverity;
  cooldownMinutes: number;
  notifications: NotificationMethod[];
  customMessage?: string;
  evaluationWindow?: number; // seconds
  consecutiveViolations?: number;
  created: Date;
  modified: Date;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  ruleName: string;
  streamId: string;
  streamName: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface NotificationConfig {
  browser: {
    enabled: boolean;
    permission?: NotificationPermission;
  };
  email: {
    enabled: boolean;
    addresses: string[];
    smtpConfig?: any;
  };
  sms: {
    enabled: boolean;
    phoneNumbers: string[];
    apiConfig?: any;
  };
  webhook: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
    method: 'POST' | 'PUT';
  };
  sound: {
    enabled: boolean;
    volume: number;
    soundFile?: string;
  };
}

interface AlertConfigurationProps {
  streams: Array<{ id: string; name: string }>;
  onRuleChange?: (rules: AlertRule[]) => void;
  onAlertTriggered?: (alert: AlertHistory) => void;
  initialRules?: AlertRule[];
  className?: string;
}

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  browser: { enabled: true },
  email: { enabled: false, addresses: [] },
  sms: { enabled: false, phoneNumbers: [] },
  webhook: { enabled: false, url: '', method: 'POST' },
  sound: { enabled: true, volume: 0.5 }
};

const SEVERITY_COLORS = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  critical: 'error'
} as const;

const SEVERITY_ICONS = {
  info: <InfoIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
  critical: <ErrorIcon />
};

export const AlertConfiguration: React.FC<AlertConfigurationProps> = ({
  streams,
  onRuleChange,
  onAlertTriggered,
  initialRules = [],
  className = ''
}) => {
  const [rules, setRules] = useState<AlertRule[]>(initialRules);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>([]);
  const [notificationConfig, setNotificationConfig] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
  const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set());
  
  const [tabValue, setTabValue] = useState(0);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: AlertSeverity }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Initialize browser notification permission
  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationConfig(prev => ({
          ...prev,
          browser: { ...prev.browser, permission }
        }));
      });
    }
  }, []);

  // Emit rule changes
  useEffect(() => {
    onRuleChange?.(rules);
  }, [rules, onRuleChange]);

  const createNewRule = useCallback((): AlertRule => ({
    id: `rule-${Date.now()}`,
    name: 'New Alert Rule',
    streamId: streams[0]?.id || '',
    streamName: streams[0]?.name || '',
    enabled: true,
    condition: 'above',
    threshold: 100,
    severity: 'warning',
    cooldownMinutes: 5,
    notifications: ['browser'],
    consecutiveViolations: 1,
    evaluationWindow: 60,
    created: new Date(),
    modified: new Date()
  }), [streams]);

  const saveRule = useCallback(() => {
    if (!editingRule) return;

    const updatedRules = rules.some(r => r.id === editingRule.id)
      ? rules.map(r => r.id === editingRule.id ? { ...editingRule, modified: new Date() } : r)
      : [...rules, editingRule];

    setRules(updatedRules);
    setShowRuleDialog(false);
    setEditingRule(null);
    
    setSnackbar({
      open: true,
      message: 'Alert rule saved successfully',
      severity: 'info'
    });
  }, [editingRule, rules]);

  const deleteRule = useCallback((ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    setActiveAlerts(prev => {
      const updated = new Set(prev);
      updated.delete(ruleId);
      return updated;
    });
    
    setSnackbar({
      open: true,
      message: 'Alert rule deleted',
      severity: 'info'
    });
  }, []);

  const toggleRule = useCallback((ruleId: string) => {
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled, modified: new Date() } : r
    ));
  }, []);

  const testRule = useCallback((rule: AlertRule) => {
    // Simulate alert for testing
    const testAlert: AlertHistory = {
      id: `test-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      streamId: rule.streamId,
      streamName: rule.streamName,
      severity: rule.severity,
      message: rule.customMessage || `Test alert: ${rule.name}`,
      value: rule.threshold + (rule.condition === 'above' ? 10 : -10),
      threshold: rule.threshold,
      timestamp: new Date(),
      acknowledged: false
    };

    triggerAlert(testAlert);
  }, []);

  const triggerAlert = useCallback((alert: AlertHistory) => {
    // Add to history
    setAlertHistory(prev => [alert, ...prev.slice(0, 99)]); // Keep last 100 alerts
    setActiveAlerts(prev => new Set([...prev, alert.ruleId]));

    // Send notifications
    const rule = rules.find(r => r.id === alert.ruleId);
    if (rule) {
      rule.notifications.forEach(method => {
        switch (method) {
          case 'browser':
            if (notificationConfig.browser.enabled && 
                notificationConfig.browser.permission === 'granted') {
              new Notification(alert.message, {
                icon: '/favicon.ico',
                body: `${alert.streamName}: ${alert.value} (threshold: ${alert.threshold})`,
                tag: alert.ruleId
              });
            }
            break;
          
          case 'sound':
            if (notificationConfig.sound.enabled) {
              const audio = new Audio('/notification.mp3');
              audio.volume = notificationConfig.sound.volume;
              audio.play().catch(() => {}); // Ignore errors
            }
            break;
          
          case 'webhook':
            if (notificationConfig.webhook.enabled && notificationConfig.webhook.url) {
              fetch(notificationConfig.webhook.url, {
                method: notificationConfig.webhook.method,
                headers: {
                  'Content-Type': 'application/json',
                  ...notificationConfig.webhook.headers
                },
                body: JSON.stringify(alert)
              }).catch(() => {}); // Ignore errors
            }
            break;
        }
      });
    }

    // Show snackbar
    setSnackbar({
      open: true,
      message: alert.message,
      severity: alert.severity
    });

    // Callback
    onAlertTriggered?.(alert);
  }, [rules, notificationConfig, onAlertTriggered]);

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlertHistory(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy: 'user' }
        : alert
    ));

    // Remove from active alerts if this was the last unacknowledged alert for this rule
    const alert = alertHistory.find(a => a.id === alertId);
    if (alert) {
      const hasOtherActiveAlerts = alertHistory.some(a => 
        a.ruleId === alert.ruleId && a.id !== alertId && !a.acknowledged
      );
      
      if (!hasOtherActiveAlerts) {
        setActiveAlerts(prev => {
          const updated = new Set(prev);
          updated.delete(alert.ruleId);
          return updated;
        });
      }
    }
  }, [alertHistory]);

  const clearHistory = useCallback(() => {
    setAlertHistory([]);
    setActiveAlerts(new Set());
  }, []);

  const activeAlertsCount = useMemo(() => {
    return alertHistory.filter(alert => !alert.acknowledged).length;
  }, [alertHistory]);

  const criticalAlertsCount = useMemo(() => {
    return alertHistory.filter(alert => !alert.acknowledged && alert.severity === 'critical').length;
  }, [alertHistory]);

  const renderRuleForm = () => {
    if (!editingRule) return null;

    const selectedStream = streams.find(s => s.id === editingRule.streamId);

    return (
      <Dialog
        open={showRuleDialog}
        onClose={() => setShowRuleDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {rules.some(r => r.id === editingRule.id) ? 'Edit Alert Rule' : 'Create Alert Rule'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rule Name"
                value={editingRule.name}
                onChange={(e) => setEditingRule(prev => prev ? {...prev, name: e.target.value} : null)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Stream</InputLabel>
                <Select
                  value={editingRule.streamId}
                  onChange={(e) => {
                    const stream = streams.find(s => s.id === e.target.value);
                    setEditingRule(prev => prev ? {
                      ...prev, 
                      streamId: e.target.value,
                      streamName: stream?.name || ''
                    } : null);
                  }}
                  label="Stream"
                >
                  {streams.map(stream => (
                    <MenuItem key={stream.id} value={stream.id}>
                      {stream.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={editingRule.description || ''}
                onChange={(e) => setEditingRule(prev => prev ? {...prev, description: e.target.value} : null)}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Condition</InputLabel>
                <Select
                  value={editingRule.condition}
                  onChange={(e) => setEditingRule(prev => prev ? {...prev, condition: e.target.value as AlertCondition} : null)}
                  label="Condition"
                >
                  <MenuItem value="above">Above Threshold</MenuItem>
                  <MenuItem value="below">Below Threshold</MenuItem>
                  <MenuItem value="equal">Equal To</MenuItem>
                  <MenuItem value="not_equal">Not Equal To</MenuItem>
                  <MenuItem value="change_rate">Change Rate</MenuItem>
                  <MenuItem value="anomaly_count">Anomaly Count</MenuItem>
                  <MenuItem value="correlation_loss">Correlation Loss</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Threshold"
                type="number"
                value={editingRule.threshold}
                onChange={(e) => setEditingRule(prev => prev ? {...prev, threshold: Number(e.target.value)} : null)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={editingRule.severity}
                  onChange={(e) => setEditingRule(prev => prev ? {...prev, severity: e.target.value as AlertSeverity} : null)}
                  label="Severity"
                >
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cooldown (minutes)"
                type="number"
                value={editingRule.cooldownMinutes}
                onChange={(e) => setEditingRule(prev => prev ? {...prev, cooldownMinutes: Number(e.target.value)} : null)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Evaluation Window (seconds)"
                type="number"
                value={editingRule.evaluationWindow || 60}
                onChange={(e) => setEditingRule(prev => prev ? {...prev, evaluationWindow: Number(e.target.value)} : null)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Custom Alert Message (optional)"
                value={editingRule.customMessage || ''}
                onChange={(e) => setEditingRule(prev => prev ? {...prev, customMessage: e.target.value} : null)}
                placeholder="Leave empty for default message"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Notification Methods</Typography>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {(['browser', 'sound', 'email', 'sms', 'webhook'] as NotificationMethod[]).map(method => (
                  <FormControlLabel
                    key={method}
                    control={
                      <Switch
                        checked={editingRule.notifications.includes(method)}
                        onChange={(e) => {
                          const notifications = e.target.checked
                            ? [...editingRule.notifications, method]
                            : editingRule.notifications.filter(n => n !== method);
                          setEditingRule(prev => prev ? {...prev, notifications} : null);
                        }}
                      />
                    }
                    label={method.charAt(0).toUpperCase() + method.slice(1)}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRuleDialog(false)}>Cancel</Button>
          <Button onClick={saveRule} variant="contained">Save Rule</Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderNotificationSettings = () => (
    <Dialog
      open={showNotificationDialog}
      onClose={() => setShowNotificationDialog(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Notification Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          {/* Browser Notifications */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <NotificationsIcon sx={{ mr: 1 }} />
              <Typography>Browser Notifications</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationConfig.browser.enabled}
                    onChange={(e) => setNotificationConfig(prev => ({
                      ...prev,
                      browser: { ...prev.browser, enabled: e.target.checked }
                    }))}
                  />
                }
                label="Enable Browser Notifications"
              />
              {notificationConfig.browser.permission === 'denied' && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  Browser notifications are blocked. Please enable them in your browser settings.
                </Alert>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Sound Notifications */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <VolumeUpIcon sx={{ mr: 1 }} />
              <Typography>Sound Notifications</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationConfig.sound.enabled}
                    onChange={(e) => setNotificationConfig(prev => ({
                      ...prev,
                      sound: { ...prev.sound, enabled: e.target.checked }
                    }))}
                  />
                }
                label="Enable Sound Notifications"
                sx={{ mb: 2 }}
              />
              
              {notificationConfig.sound.enabled && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>Volume</Typography>
                  <Slider
                    value={notificationConfig.sound.volume}
                    onChange={(_, value) => setNotificationConfig(prev => ({
                      ...prev,
                      sound: { ...prev.sound, volume: value as number }
                    }))}
                    min={0}
                    max={1}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 0.5, label: '50%' },
                      { value: 1, label: '100%' }
                    ]}
                  />
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Webhook Notifications */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <WebhookIcon sx={{ mr: 1 }} />
              <Typography>Webhook Notifications</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={notificationConfig.webhook.enabled}
                    onChange={(e) => setNotificationConfig(prev => ({
                      ...prev,
                      webhook: { ...prev.webhook, enabled: e.target.checked }
                    }))}
                  />
                }
                label="Enable Webhook Notifications"
                sx={{ mb: 2 }}
              />
              
              {notificationConfig.webhook.enabled && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Webhook URL"
                      value={notificationConfig.webhook.url}
                      onChange={(e) => setNotificationConfig(prev => ({
                        ...prev,
                        webhook: { ...prev.webhook, url: e.target.value }
                      }))}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Method</InputLabel>
                      <Select
                        value={notificationConfig.webhook.method}
                        onChange={(e) => setNotificationConfig(prev => ({
                          ...prev,
                          webhook: { ...prev.webhook, method: e.target.value as 'POST' | 'PUT' }
                        }))}
                        label="Method"
                      >
                        <MenuItem value="POST">POST</MenuItem>
                        <MenuItem value="PUT">PUT</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowNotificationDialog(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box className={className}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <Badge badgeContent={activeAlertsCount} color="error">
                <NotificationsIcon />
              </Badge>
              <Typography variant="h6">Alert Configuration</Typography>
              {criticalAlertsCount > 0 && (
                <Chip
                  icon={<ErrorIcon />}
                  label={`${criticalAlertsCount} Critical`}
                  color="error"
                  size="small"
                />
              )}
            </Box>

            <Box display="flex" gap={1}>
              <Button
                startIcon={<SettingsIcon />}
                onClick={() => setShowNotificationDialog(true)}
                variant="outlined"
                size="small"
              >
                Notifications
              </Button>
              
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingRule(createNewRule());
                  setShowRuleDialog(true);
                }}
                variant="contained"
                size="small"
              >
                Add Rule
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            label="Rules" 
            icon={<Badge badgeContent={rules.filter(r => r.enabled).length} color="primary">
              <SettingsIcon />
            </Badge>} 
          />
          <Tab 
            label="Active Alerts" 
            icon={<Badge badgeContent={activeAlertsCount} color="error">
              <NotificationsActiveIcon />
            </Badge>} 
          />
          <Tab 
            label="History" 
            icon={<Badge badgeContent={alertHistory.length} color="info">
              <HistoryIcon />
            </Badge>} 
          />
        </Tabs>
      </Box>

      {/* Rules Tab */}
      {tabValue === 0 && (
        <Grid container spacing={2}>
          {rules.map(rule => (
            <Grid item xs={12} key={rule.id}>
              <Card variant={rule.enabled ? "elevation" : "outlined"}>
                <CardContent>
                  <Box display="flex" alignItems="center" justifyContent="between" mb={2}>
                    <Box display="flex" alignItems="center" gap={2} flex={1}>
                      <Switch
                        checked={rule.enabled}
                        onChange={() => toggleRule(rule.id)}
                      />
                      
                      <Box flex={1}>
                        <Typography variant="h6">{rule.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                          {rule.streamName} • {rule.condition} {rule.threshold}
                        </Typography>
                        {rule.description && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            {rule.description}
                          </Typography>
                        )}
                      </Box>

                      <Chip
                        icon={SEVERITY_ICONS[rule.severity]}
                        label={rule.severity.toUpperCase()}
                        color={SEVERITY_COLORS[rule.severity]}
                        size="small"
                      />

                      {activeAlerts.has(rule.id) && (
                        <Chip
                          icon={<NotificationsActiveIcon />}
                          label="ACTIVE"
                          color="error"
                          variant="filled"
                          size="small"
                        />
                      )}
                    </Box>

                    <Box display="flex" gap={1}>
                      <Tooltip title="Test Rule">
                        <IconButton
                          size="small"
                          onClick={() => testRule(rule)}
                          color="primary"
                        >
                          <PlayArrowIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Edit Rule">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingRule(rule);
                            setShowRuleDialog(true);
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Delete Rule">
                        <IconButton
                          size="small"
                          onClick={() => deleteRule(rule.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Box display="flex" flexWrap="wrap" gap={1}>
                    <Chip label={`${rule.cooldownMinutes}min cooldown`} size="small" />
                    <Chip label={`${rule.evaluationWindow || 60}s window`} size="small" />
                    {rule.notifications.map(method => (
                      <Chip
                        key={method}
                        label={method}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {rules.length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                No alert rules configured. Click "Add Rule" to create your first alert.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Active Alerts Tab */}
      {tabValue === 1 && (
        <Box>
          <Paper>
            <List>
              {alertHistory
                .filter(alert => !alert.acknowledged)
                .map((alert, index) => (
                  <React.Fragment key={alert.id}>
                    <ListItem>
                      <ListItemIcon>
                        {SEVERITY_ICONS[alert.severity]}
                      </ListItemIcon>
                      
                      <ListItemText
                        primary={alert.message}
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              {alert.streamName}: {alert.value} (threshold: {alert.threshold})
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {alert.timestamp.toLocaleString()}
                            </Typography>
                          </Box>
                        }
                      />

                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          onClick={() => acknowledgeAlert(alert.id)}
                          startIcon={<CheckCircleIcon />}
                        >
                          Acknowledge
                        </Button>
                      </ListItemSecondaryAction>
                    </ListItem>
                    
                    {index < alertHistory.filter(a => !a.acknowledged).length - 1 && (
                      <Divider />
                    )}
                  </React.Fragment>
                ))}
            </List>
            
            {alertHistory.filter(alert => !alert.acknowledged).length === 0 && (
              <Box p={3} textAlign="center">
                <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color="success.main">
                  No Active Alerts
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  All alerts have been acknowledged or cleared.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* History Tab */}
      {tabValue === 2 && (
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Alert History</Typography>
            <Button
              startIcon={<ClearIcon />}
              onClick={clearHistory}
              disabled={alertHistory.length === 0}
              color="error"
            >
              Clear History
            </Button>
          </Box>

          <Paper>
            <List>
              {alertHistory.map((alert, index) => (
                <React.Fragment key={alert.id}>
                  <ListItem>
                    <ListItemIcon>
                      {SEVERITY_ICONS[alert.severity]}
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography>{alert.message}</Typography>
                          {alert.acknowledged && (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label="Acknowledged"
                              size="small"
                              color="success"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {alert.streamName}: {alert.value} (threshold: {alert.threshold})
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {alert.timestamp.toLocaleString()}
                            {alert.acknowledgedAt && (
                              <> • Acknowledged: {alert.acknowledgedAt.toLocaleString()}</>
                            )}
                          </Typography>
                        </Box>
                      }
                    />

                    {!alert.acknowledged && (
                      <ListItemSecondaryAction>
                        <Button
                          size="small"
                          onClick={() => acknowledgeAlert(alert.id)}
                          startIcon={<CheckCircleIcon />}
                        >
                          Acknowledge
                        </Button>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                  
                  {index < alertHistory.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
            
            {alertHistory.length === 0 && (
              <Box p={3} textAlign="center">
                <HistoryIcon color="disabled" sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  No Alert History
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Alert history will appear here when alerts are triggered.
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* Dialogs */}
      {renderRuleForm()}
      {renderNotificationSettings()}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity === 'critical' ? 'error' : snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AlertConfiguration;