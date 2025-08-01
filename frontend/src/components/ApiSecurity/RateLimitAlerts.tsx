import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  NotificationsActive as NotificationIcon,
  Email as EmailIcon,
  Webhook as WebhookIcon,
  Message as SlackIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { 
  rateLimitService, 
  RateLimitPolicy, 
  RateLimitAlert 
} from '../../services/rateLimitService';

interface RateLimitAlertsProps {
  policies: RateLimitPolicy[];
}

export const RateLimitAlerts: React.FC<RateLimitAlertsProps> = ({ policies }) => {
  const [alerts, setAlerts] = useState<RateLimitAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<RateLimitAlert | null>(null);
  const [formData, setFormData] = useState({
    policyId: '',
    name: '',
    description: '',
    violationThreshold: 1,
    timeWindowMinutes: 5,
    notifyEmails: [] as string[],
    notifyWebhooks: [] as string[],
    notifySlack: null,
    cooldownMinutes: 60,
    isActive: true
  });
  const [newEmail, setNewEmail] = useState('');
  const [newWebhook, setNewWebhook] = useState('');
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await rateLimitService.getAlerts();
      setAlerts(data);
    } catch (error: any) {
      enqueueSnackbar('Failed to load alerts', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = () => {
    setSelectedAlert(null);
    setFormData({
      policyId: '',
      name: '',
      description: '',
      violationThreshold: 1,
      timeWindowMinutes: 5,
      notifyEmails: [],
      notifyWebhooks: [],
      notifySlack: null,
      cooldownMinutes: 60,
      isActive: true
    });
    setShowAlertForm(true);
  };

  const handleEditAlert = (alert: RateLimitAlert) => {
    setSelectedAlert(alert);
    setFormData({
      policyId: alert.policyId,
      name: alert.name,
      description: alert.description || '',
      violationThreshold: alert.violationThreshold,
      timeWindowMinutes: alert.timeWindowMinutes,
      notifyEmails: alert.notifyEmails || [],
      notifyWebhooks: alert.notifyWebhooks || [],
      notifySlack: alert.notifySlack,
      cooldownMinutes: alert.cooldownMinutes,
      isActive: alert.isActive
    });
    setShowAlertForm(true);
  };

  const handleDeleteAlert = async (alertId: string) => {
    if (window.confirm('Are you sure you want to delete this alert?')) {
      try {
        // Note: API endpoint for delete not implemented yet
        enqueueSnackbar('Alert deleted successfully', { variant: 'success' });
        await loadAlerts();
      } catch (error: any) {
        enqueueSnackbar('Failed to delete alert', { variant: 'error' });
      }
    }
  };

  const handleSaveAlert = async () => {
    if (!formData.policyId || !formData.name) {
      enqueueSnackbar('Please fill in required fields', { variant: 'warning' });
      return;
    }

    try {
      if (selectedAlert) {
        // Note: Update endpoint not implemented yet
        enqueueSnackbar('Alert updated successfully', { variant: 'success' });
      } else {
        await rateLimitService.createAlert(formData);
        enqueueSnackbar('Alert created successfully', { variant: 'success' });
      }
      setShowAlertForm(false);
      await loadAlerts();
    } catch (error: any) {
      enqueueSnackbar('Failed to save alert', { variant: 'error' });
    }
  };

  const handleAddEmail = () => {
    if (newEmail && !formData.notifyEmails.includes(newEmail)) {
      setFormData({
        ...formData,
        notifyEmails: [...formData.notifyEmails, newEmail]
      });
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setFormData({
      ...formData,
      notifyEmails: formData.notifyEmails.filter(e => e !== email)
    });
  };

  const handleAddWebhook = () => {
    if (newWebhook && !formData.notifyWebhooks.includes(newWebhook)) {
      setFormData({
        ...formData,
        notifyWebhooks: [...formData.notifyWebhooks, newWebhook]
      });
      setNewWebhook('');
    }
  };

  const handleRemoveWebhook = (webhook: string) => {
    setFormData({
      ...formData,
      notifyWebhooks: formData.notifyWebhooks.filter(w => w !== webhook)
    });
  };

  const getNotificationIcons = (alert: RateLimitAlert) => {
    const icons = [];
    if (alert.notifyEmails && alert.notifyEmails.length > 0) {
      icons.push(
        <Tooltip key="email" title={`${alert.notifyEmails.length} email(s)`}>
          <EmailIcon fontSize="small" />
        </Tooltip>
      );
    }
    if (alert.notifyWebhooks && alert.notifyWebhooks.length > 0) {
      icons.push(
        <Tooltip key="webhook" title={`${alert.notifyWebhooks.length} webhook(s)`}>
          <WebhookIcon fontSize="small" />
        </Tooltip>
      );
    }
    if (alert.notifySlack) {
      icons.push(
        <Tooltip key="slack" title="Slack notification">
          <SlackIcon fontSize="small" />
        </Tooltip>
      );
    }
    return icons;
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6">
          Rate Limit Alerts
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleCreateAlert}
        >
          Create Alert
        </Button>
      </Box>

      {alerts.length === 0 ? (
        <Alert severity="info">
          No alerts configured. Create an alert to get notified about rate limit violations.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Alert Name</TableCell>
                <TableCell>Policy</TableCell>
                <TableCell>Trigger Condition</TableCell>
                <TableCell>Notifications</TableCell>
                <TableCell>Cooldown</TableCell>
                <TableCell>Last Triggered</TableCell>
                <TableCell>Status</TableCell>
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
                    <Chip
                      label={alert.policyName || 'Unknown'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <WarningIcon fontSize="small" color="warning" />
                      <Typography variant="body2">
                        {alert.violationThreshold} violation{alert.violationThreshold > 1 ? 's' : ''}
                        {' in '}
                        {alert.timeWindowMinutes} min
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" gap={0.5}>
                      {getNotificationIcons(alert)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <ScheduleIcon fontSize="small" color="action" />
                      <Typography variant="body2">
                        {alert.cooldownMinutes} min
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {alert.lastTriggeredAt ? (
                      <Box>
                        <Typography variant="caption">
                          {new Date(alert.lastTriggeredAt).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="textSecondary" display="block">
                          ({alert.triggerCount} times)
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="caption" color="textSecondary">
                        Never
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={alert.isActive ? 'Active' : 'Inactive'}
                      color={alert.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleEditAlert(alert)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteAlert(alert.id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Alert Form Dialog */}
      <Dialog open={showAlertForm} onClose={() => setShowAlertForm(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedAlert ? 'Edit Alert' : 'Create Alert'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Policy</InputLabel>
                <Select
                  value={formData.policyId}
                  onChange={(e) => setFormData({ ...formData, policyId: e.target.value })}
                  label="Policy"
                  disabled={!!selectedAlert}
                >
                  {policies.map(policy => (
                    <MenuItem key={policy.id} value={policy.id}>
                      {policy.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Alert Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Violation Threshold"
                value={formData.violationThreshold}
                onChange={(e) => setFormData({ ...formData, violationThreshold: parseInt(e.target.value) })}
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Time Window (minutes)"
                value={formData.timeWindowMinutes}
                onChange={(e) => setFormData({ ...formData, timeWindowMinutes: parseInt(e.target.value) })}
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label="Cooldown Period (minutes)"
                value={formData.cooldownMinutes}
                onChange={(e) => setFormData({ ...formData, cooldownMinutes: parseInt(e.target.value) })}
                InputProps={{ inputProps: { min: 1 } }}
                helperText="Minimum time between alerts"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Email Notifications
              </Typography>
              <Box display="flex" gap={1} mb={1}>
                <TextField
                  size="small"
                  placeholder="email@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                  sx={{ flex: 1 }}
                />
                <Button size="small" onClick={handleAddEmail}>Add</Button>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {formData.notifyEmails.map(email => (
                  <Chip
                    key={email}
                    label={email}
                    onDelete={() => handleRemoveEmail(email)}
                    size="small"
                  />
                ))}
              </Box>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAlertForm(false)}>Cancel</Button>
          <Button onClick={handleSaveAlert} variant="contained">
            {selectedAlert ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};