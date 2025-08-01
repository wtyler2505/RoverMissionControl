import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  FormGroup,
  FormControlLabel,
  Checkbox,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  NotificationsActive as AlertIcon,
  NotificationsOff as AlertOffIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  Webhook as WebhookIcon,
  Warning as WarningIcon,
  PlayArrow as TestIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  TrendingUp as ThresholdIcon,
  Pattern as PatternIcon,
  BubbleChart as AnomalyIcon,
  Code as CustomIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import auditService, { getSeverityColor } from '../../../services/auditService';
import {
  AuditAlert,
  AlertType,
  AuditCategory,
  AuditSeverity
} from '../../../types/audit';

interface AlertFormData {
  name: string;
  description: string;
  alert_type: AlertType;
  is_active: boolean;
  category?: AuditCategory;
  severity_threshold?: AuditSeverity;
  event_types: string[];
  condition_config: {
    threshold_count?: number;
    threshold_window_minutes?: number;
    pattern_regex?: string;
    anomaly_baseline_days?: number;
    anomaly_deviation_percent?: number;
    custom_script?: string;
  };
  notification_channels: string[];
  notification_config: {
    email_recipients?: string[];
    sms_recipients?: string[];
    webhook_urls?: string[];
    slack_channels?: string[];
  };
  cooldown_minutes: number;
  auto_response?: string;
}

const defaultFormData: AlertFormData = {
  name: '',
  description: '',
  alert_type: AlertType.THRESHOLD,
  is_active: true,
  event_types: [],
  condition_config: {
    threshold_count: 5,
    threshold_window_minutes: 60
  },
  notification_channels: ['email'],
  notification_config: {
    email_recipients: []
  },
  cooldown_minutes: 60,
  auto_response: undefined
};

const AuditAlertConfig: React.FC = () => {
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AuditAlert | null>(null);
  const [formData, setFormData] = useState<AlertFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchAlerts();
    fetchEventTypes();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditService.getAlerts();
      setAlerts(data);
    } catch (err) {
      setError('Failed to load alerts');
      console.error('Alerts error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const types = await auditService.getEventTypes();
      setAvailableEventTypes(types);
    } catch (err) {
      console.error('Event types error:', err);
    }
  };

  const handleToggleAlert = async (alertId: string, isActive: boolean) => {
    try {
      await auditService.updateAlert(alertId, { is_active: isActive });
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, is_active: isActive } : alert
      ));
    } catch (err) {
      console.error('Toggle alert error:', err);
    }
  };

  const handleTestAlert = async (alertId: string) => {
    try {
      setTesting(alertId);
      const result = await auditService.testAlert(alertId);
      setTestResults(result);
      setShowTestDialog(true);
    } catch (err) {
      console.error('Test alert error:', err);
    } finally {
      setTesting(null);
    }
  };

  const handleEditAlert = (alert: AuditAlert) => {
    setEditingAlert(alert);
    setFormData({
      name: alert.name,
      description: alert.description || '',
      alert_type: alert.alert_type,
      is_active: alert.is_active,
      category: alert.category,
      severity_threshold: alert.severity_threshold,
      event_types: alert.event_types || [],
      condition_config: alert.condition_config,
      notification_channels: alert.notification_channels,
      notification_config: alert.notification_config,
      cooldown_minutes: alert.cooldown_minutes,
      auto_response: alert.auto_response
    });
    setShowDialog(true);
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        await auditService.deleteAlert(alertId);
        await fetchAlerts();
      } catch (err) {
        console.error('Delete alert error:', err);
      }
    }
  };

  const handleSaveAlert = async () => {
    try {
      setSaving(true);
      
      const alertData = {
        ...formData,
        condition_config: { ...formData.condition_config },
        notification_config: { ...formData.notification_config }
      };
      
      if (editingAlert) {
        await auditService.updateAlert(editingAlert.id, alertData);
      } else {
        await auditService.createAlert(alertData as any);
      }
      
      await fetchAlerts();
      handleCloseDialog();
    } catch (err) {
      console.error('Save alert error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingAlert(null);
    setFormData(defaultFormData);
    setActiveTab(0);
  };

  const getAlertTypeIcon = (type: AlertType) => {
    switch (type) {
      case AlertType.THRESHOLD: return <ThresholdIcon />;
      case AlertType.PATTERN: return <PatternIcon />;
      case AlertType.ANOMALY: return <AnomalyIcon />;
      case AlertType.CUSTOM: return <CustomIcon />;
    }
  };

  const renderConditionConfig = () => {
    switch (formData.alert_type) {
      case AlertType.THRESHOLD:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Threshold Count"
                value={formData.condition_config.threshold_count || 5}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  condition_config: {
                    ...prev.condition_config,
                    threshold_count: parseInt(e.target.value)
                  }
                }))}
                helperText="Number of events to trigger alert"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Time Window (minutes)"
                value={formData.condition_config.threshold_window_minutes || 60}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  condition_config: {
                    ...prev.condition_config,
                    threshold_window_minutes: parseInt(e.target.value)
                  }
                }))}
                helperText="Time window for counting events"
              />
            </Grid>
          </Grid>
        );
      
      case AlertType.PATTERN:
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Pattern Regex"
            value={formData.condition_config.pattern_regex || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              condition_config: {
                ...prev.condition_config,
                pattern_regex: e.target.value
              }
            }))}
            helperText="Regular expression to match against audit logs"
          />
        );
      
      case AlertType.ANOMALY:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Baseline Days"
                value={formData.condition_config.anomaly_baseline_days || 30}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  condition_config: {
                    ...prev.condition_config,
                    anomaly_baseline_days: parseInt(e.target.value)
                  }
                }))}
                helperText="Days of historical data for baseline"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Deviation Percent"
                value={formData.condition_config.anomaly_deviation_percent || 50}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  condition_config: {
                    ...prev.condition_config,
                    anomaly_deviation_percent: parseInt(e.target.value)
                  }
                }))}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>
                }}
                helperText="Percentage deviation from baseline"
              />
            </Grid>
          </Grid>
        );
      
      case AlertType.CUSTOM:
        return (
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Custom Script"
            value={formData.condition_config.custom_script || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              condition_config: {
                ...prev.condition_config,
                custom_script: e.target.value
              }
            }))}
            helperText="JavaScript function that returns true to trigger alert"
            sx={{ fontFamily: 'monospace' }}
          />
        );
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Alert Configuration
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowDialog(true)}
        >
          Create Alert
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Alert Statistics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Alerts
                  </Typography>
                  <Typography variant="h4">
                    {alerts.length}
                  </Typography>
                </Box>
                <AlertIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Alerts
                  </Typography>
                  <Typography variant="h4">
                    {alerts.filter(a => a.is_active).length}
                  </Typography>
                </Box>
                <CheckIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Triggers
                  </Typography>
                  <Typography variant="h4">
                    {alerts.reduce((sum, a) => sum + a.trigger_count, 0)}
                  </Typography>
                </Box>
                <WarningIcon color="warning" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Triggers</TableCell>
              <TableCell>Last Triggered</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {alert.name}
                    </Typography>
                    {alert.description && (
                      <Typography variant="caption" color="textSecondary">
                        {alert.description}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getAlertTypeIcon(alert.alert_type)}
                    <Typography variant="body2">
                      {alert.alert_type.charAt(0).toUpperCase() + alert.alert_type.slice(1)}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {alert.category ? (
                    <Chip label={alert.category.replace(/_/g, ' ')} size="small" />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {alert.severity_threshold ? (
                    <Chip
                      label={alert.severity_threshold}
                      size="small"
                      style={{
                        backgroundColor: getSeverityColor(alert.severity_threshold),
                        color: 'white'
                      }}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={alert.is_active}
                    onChange={(e) => handleToggleAlert(alert.id, e.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell>{alert.trigger_count}</TableCell>
                <TableCell>
                  {alert.last_triggered ? (
                    format(new Date(alert.last_triggered), 'MMM dd, HH:mm')
                  ) : (
                    'Never'
                  )}
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={1}>
                    <Tooltip title="Test Alert">
                      <IconButton
                        size="small"
                        onClick={() => handleTestAlert(alert.id)}
                        disabled={testing === alert.id}
                      >
                        {testing === alert.id ? <CircularProgress size={16} /> : <TestIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditAlert(alert)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteAlert(alert.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Alert Dialog */}
      <Dialog open={showDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingAlert ? 'Edit Alert' : 'Create Alert'}
        </DialogTitle>
        <DialogContent>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="Basic Info" />
            <Tab label="Conditions" />
            <Tab label="Notifications" />
          </Tabs>
          
          {/* Basic Info Tab */}
          {activeTab === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Alert Name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Alert Type</InputLabel>
                  <Select
                    value={formData.alert_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, alert_type: e.target.value as AlertType }))}
                    label="Alert Type"
                  >
                    <MenuItem value={AlertType.THRESHOLD}>Threshold</MenuItem>
                    <MenuItem value={AlertType.PATTERN}>Pattern</MenuItem>
                    <MenuItem value={AlertType.ANOMALY}>Anomaly</MenuItem>
                    <MenuItem value={AlertType.CUSTOM}>Custom</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Cooldown (minutes)"
                  value={formData.cooldown_minutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, cooldown_minutes: parseInt(e.target.value) }))}
                  helperText="Minimum time between alerts"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.is_active}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    />
                  }
                  label="Alert is active"
                />
              </Grid>
            </Grid>
          )}
          
          {/* Conditions Tab */}
          {activeTab === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category Filter</InputLabel>
                  <Select
                    value={formData.category || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      category: e.target.value as AuditCategory || undefined 
                    }))}
                    label="Category Filter"
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {Object.values(AuditCategory).map(cat => (
                      <MenuItem key={cat} value={cat}>
                        {cat.replace(/_/g, ' ')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity Threshold</InputLabel>
                  <Select
                    value={formData.severity_threshold || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      severity_threshold: e.target.value as AuditSeverity || undefined 
                    }))}
                    label="Severity Threshold"
                  >
                    <MenuItem value="">All Severities</MenuItem>
                    {Object.values(AuditSeverity).map(sev => (
                      <MenuItem key={sev} value={sev}>
                        {sev.charAt(0).toUpperCase() + sev.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Event Types</InputLabel>
                  <Select
                    multiple
                    value={formData.event_types}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_types: e.target.value as string[] }))}
                    label="Event Types"
                    renderValue={(selected) => `${selected.length} selected`}
                  >
                    {availableEventTypes.map(type => (
                      <MenuItem key={type} value={type}>
                        <Checkbox checked={formData.event_types.includes(type)} />
                        <ListItemText primary={type} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Condition Configuration
                </Typography>
                {renderConditionConfig()}
              </Grid>
            </Grid>
          )}
          
          {/* Notifications Tab */}
          {activeTab === 2 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Notification Channels
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.notification_channels.includes('email')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              notification_channels: [...prev.notification_channels, 'email']
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              notification_channels: prev.notification_channels.filter(c => c !== 'email')
                            }));
                          }
                        }}
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <EmailIcon fontSize="small" />
                        Email
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.notification_channels.includes('sms')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              notification_channels: [...prev.notification_channels, 'sms']
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              notification_channels: prev.notification_channels.filter(c => c !== 'sms')
                            }));
                          }
                        }}
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <SmsIcon fontSize="small" />
                        SMS
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.notification_channels.includes('webhook')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData(prev => ({
                              ...prev,
                              notification_channels: [...prev.notification_channels, 'webhook']
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              notification_channels: prev.notification_channels.filter(c => c !== 'webhook')
                            }));
                          }
                        }}
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <WebhookIcon fontSize="small" />
                        Webhook
                      </Box>
                    }
                  />
                </FormGroup>
              </Grid>
              
              {formData.notification_channels.includes('email') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Email Recipients"
                    value={formData.notification_config.email_recipients?.join(', ') || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      notification_config: {
                        ...prev.notification_config,
                        email_recipients: e.target.value.split(',').map(e => e.trim()).filter(Boolean)
                      }
                    }))}
                    helperText="Comma-separated email addresses"
                  />
                </Grid>
              )}
              
              {formData.notification_channels.includes('webhook') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Webhook URLs"
                    value={formData.notification_config.webhook_urls?.join(', ') || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      notification_config: {
                        ...prev.notification_config,
                        webhook_urls: e.target.value.split(',').map(u => u.trim()).filter(Boolean)
                      }
                    }))}
                    helperText="Comma-separated webhook URLs"
                  />
                </Grid>
              )}
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Auto Response (Optional)"
                  value={formData.auto_response || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, auto_response: e.target.value || undefined }))}
                  helperText="Automated action to take when alert triggers"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSaveAlert}
            variant="contained"
            disabled={saving || !formData.name}
            startIcon={saving && <CircularProgress size={16} />}
          >
            {editingAlert ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Results Dialog */}
      <Dialog open={showTestDialog} onClose={() => setShowTestDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Alert Test Results</DialogTitle>
        <DialogContent>
          {testResults && (
            <Box>
              <Alert 
                severity={testResults.would_trigger ? 'warning' : 'info'}
                icon={testResults.would_trigger ? <AlertIcon /> : <AlertOffIcon />}
                sx={{ mb: 2 }}
              >
                {testResults.would_trigger 
                  ? 'This alert would trigger based on current data'
                  : 'This alert would not trigger based on current data'}
              </Alert>
              
              <Typography variant="subtitle2" gutterBottom>
                Matching Events: {testResults.matching_events}
              </Typography>
              
              {testResults.sample_events.length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" gutterBottom>
                    Sample Events:
                  </Typography>
                  <List dense>
                    {testResults.sample_events.map((event: any, index: number) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={event.event_type}
                          secondary={`${format(new Date(event.timestamp), 'MMM dd, HH:mm')} - ${event.actor_name}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTestDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditAlertConfig;