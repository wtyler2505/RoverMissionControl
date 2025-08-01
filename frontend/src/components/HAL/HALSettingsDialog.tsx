import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  IconButton,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Paper,
  InputAdornment,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close,
  Settings,
  DeviceHub,
  Notifications,
  Security,
  Storage,
  Speed,
  ExpandMore,
  Info,
  RestartAlt,
  Save,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useHALContext } from './HALContext';
import { HALSettings } from './types';

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
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

interface HALSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const HALSettingsDialog: React.FC<HALSettingsDialogProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const { settings, updateSettings, resetSettings, permissions } = useHALContext();
  
  const [activeTab, setActiveTab] = useState(0);
  const [localSettings, setLocalSettings] = useState<HALSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  useEffect(() => {
    // Check if settings have changed
    setHasChanges(JSON.stringify(localSettings) !== JSON.stringify(settings));
  }, [localSettings, settings]);

  const handleSettingChange = (path: string, value: any) => {
    setLocalSettings(prev => {
      const updated = { ...prev };
      const pathParts = path.split('.');
      let current: any = updated;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]];
      }
      
      current[pathParts[pathParts.length - 1]] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      await updateSettings(localSettings);
      setHasChanges(false);
    } catch (error) {
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetSettings();
      setLocalSettings(settings);
      setShowResetConfirm(false);
      setHasChanges(false);
    } catch (error) {
      setSaveError('Failed to reset settings.');
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      // Show confirmation dialog
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        setLocalSettings(settings);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const logLevels = ['trace', 'debug', 'info', 'warning', 'error'];
  const protocols = ['serial', 'i2c', 'spi', 'can', 'ethernet', 'usb', 'bluetooth', 'wifi'];
  const exportFormats = ['json', 'csv', 'excel'];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Settings />
            <Typography variant="h6">HAL Settings</Typography>
            {hasChanges && (
              <Chip
                label="Unsaved Changes"
                size="small"
                color="warning"
                icon={<Warning />}
              />
            )}
          </Box>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flexGrow: 1, overflow: 'auto' }}>
        {saveError && (
          <Alert severity="error" onClose={() => setSaveError(null)} sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="General" />
          <Tab label="Discovery" />
          <Tab label="Communication" />
          <Tab label="Notifications" />
          <Tab label="Export" />
          <Tab label="Advanced" />
        </Tabs>

        {/* General Settings */}
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.enableSimulation}
                    onChange={(e) => handleSettingChange('enableSimulation', e.target.checked)}
                    disabled={!permissions.canChangeSettings}
                  />
                }
                label="Enable Simulation Mode"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                Allow the system to run in simulation mode for testing without physical hardware
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Default Protocol</InputLabel>
                <Select
                  value={localSettings.defaultProtocol}
                  onChange={(e) => handleSettingChange('defaultProtocol', e.target.value)}
                  disabled={!permissions.canChangeSettings}
                >
                  {protocols.map(protocol => (
                    <MenuItem key={protocol} value={protocol}>
                      {protocol.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={localSettings.logLevel}
                  onChange={(e) => handleSettingChange('logLevel', e.target.value)}
                  disabled={!permissions.canChangeSettings}
                >
                  {logLevels.map(level => (
                    <MenuItem key={level} value={level}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                        {level === 'trace' && (
                          <Chip label="Most Verbose" size="small" />
                        )}
                        {level === 'error' && (
                          <Chip label="Least Verbose" size="small" />
                        )}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1 }}>
                Controls the verbosity of system logs
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Discovery Settings */}
        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.autoDiscovery}
                    onChange={(e) => handleSettingChange('autoDiscovery', e.target.checked)}
                    disabled={!permissions.canChangeSettings}
                  />
                }
                label="Auto Discovery"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                Automatically scan for new devices at regular intervals
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography gutterBottom>
                Discovery Interval: {localSettings.discoveryInterval} seconds
              </Typography>
              <Slider
                value={localSettings.discoveryInterval}
                onChange={(_, value) => handleSettingChange('discoveryInterval', value)}
                min={5}
                max={300}
                step={5}
                marks={[
                  { value: 5, label: '5s' },
                  { value: 60, label: '1m' },
                  { value: 180, label: '3m' },
                  { value: 300, label: '5m' },
                ]}
                disabled={!permissions.canChangeSettings || !localSettings.autoDiscovery}
              />
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info color="info" />
                  <Typography variant="body2">
                    Discovery scans all available protocols for new devices. Frequent scans may impact performance.
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Communication Settings */}
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Connection Timeout (ms)"
                value={localSettings.connectionTimeout}
                onChange={(e) => handleSettingChange('connectionTimeout', parseInt(e.target.value))}
                disabled={!permissions.canChangeSettings}
                InputProps={{
                  inputProps: { min: 100, max: 30000, step: 100 }
                }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Retry Attempts"
                value={localSettings.retryAttempts}
                onChange={(e) => handleSettingChange('retryAttempts', parseInt(e.target.value))}
                disabled={!permissions.canChangeSettings}
                InputProps={{
                  inputProps: { min: 0, max: 10 }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Protocol-Specific Settings
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                Protocol-specific settings can be configured when adding or editing individual devices.
              </Alert>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Notification Settings */}
        <TabPanel value={activeTab} index={3}>
          <List>
            <ListItem>
              <ListItemText
                primary="Device Connection"
                secondary="Notify when devices connect or disconnect"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={localSettings.notifications.deviceConnection}
                  onChange={(e) => handleSettingChange('notifications.deviceConnection', e.target.checked)}
                  disabled={!permissions.canChangeSettings}
                />
              </ListItemSecondaryAction>
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Firmware Updates"
                secondary="Notify when firmware updates are available"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={localSettings.notifications.firmwareUpdates}
                  onChange={(e) => handleSettingChange('notifications.firmwareUpdates', e.target.checked)}
                  disabled={!permissions.canChangeSettings}
                />
              </ListItemSecondaryAction>
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Errors"
                secondary="Notify when errors occur in the system"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={localSettings.notifications.errors}
                  onChange={(e) => handleSettingChange('notifications.errors', e.target.checked)}
                  disabled={!permissions.canChangeSettings}
                />
              </ListItemSecondaryAction>
            </ListItem>

            <ListItem>
              <ListItemText
                primary="Diagnostics"
                secondary="Notify when diagnostic tests complete or fail"
              />
              <ListItemSecondaryAction>
                <Switch
                  checked={localSettings.notifications.diagnostics}
                  onChange={(e) => handleSettingChange('notifications.diagnostics', e.target.checked)}
                  disabled={!permissions.canChangeSettings}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </TabPanel>

        {/* Export Settings */}
        <TabPanel value={activeTab} index={4}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Default Export Format</InputLabel>
                <Select
                  value={localSettings.export.format}
                  onChange={(e) => handleSettingChange('export.format', e.target.value)}
                  disabled={!permissions.canChangeSettings}
                >
                  {exportFormats.map(format => (
                    <MenuItem key={format} value={format}>
                      {format.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.export.includeRawData}
                    onChange={(e) => handleSettingChange('export.includeRawData', e.target.checked)}
                    disabled={!permissions.canChangeSettings}
                  />
                }
                label="Include Raw Data"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                Include unprocessed raw data in exports (increases file size)
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localSettings.export.compression}
                    onChange={(e) => handleSettingChange('export.compression', e.target.checked)}
                    disabled={!permissions.canChangeSettings}
                  />
                }
                label="Enable Compression"
              />
              <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                Compress exported files to reduce size (may increase processing time)
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Advanced Settings */}
        <TabPanel value={activeTab} index={5}>
          <Box sx={{ mb: 3 }}>
            <Alert severity="warning">
              Advanced settings can significantly impact system behavior. Change with caution.
            </Alert>
          </Box>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Performance Tuning</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Adjust these settings to optimize performance for your hardware
                  </Typography>
                </Grid>
                {/* Add performance-related settings here */}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>Security</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Configure security-related settings for device communication
                  </Typography>
                </Grid>
                {/* Add security-related settings here */}
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 4 }}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<RestartAlt />}
              onClick={() => setShowResetConfirm(true)}
              disabled={!permissions.canChangeSettings}
            >
              Reset to Defaults
            </Button>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!hasChanges || isSaving || !permissions.canChangeSettings}
          startIcon={isSaving ? null : <Save />}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
      >
        <DialogTitle>Reset Settings to Defaults?</DialogTitle>
        <DialogContent>
          <Typography>
            This will reset all HAL settings to their default values. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResetConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleReset}
          >
            Reset Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default HALSettingsDialog;