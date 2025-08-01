import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Typography,
  Box,
  Grid,
  Slider,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  InputAdornment
} from '@mui/material';
import { DiscoveryConfig } from '../../services/discoveryService';

interface DiscoverySettingsDialogProps {
  open: boolean;
  config: DiscoveryConfig | null;
  onClose: () => void;
  onSave: (config: DiscoveryConfig) => void;
}

export const DiscoverySettingsDialog: React.FC<DiscoverySettingsDialogProps> = ({
  open,
  config,
  onClose,
  onSave
}) => {
  const [settings, setSettings] = useState<DiscoveryConfig>({
    auto_discovery_interval: 30,
    probe_timeout: 5,
    max_retries: 3,
    enable_passive_discovery: true,
    enable_broadcast: true
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setSettings(config);
      setHasChanges(false);
    }
  }, [config]);

  const handleChange = (key: keyof DiscoveryConfig, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(settings);
    setHasChanges(false);
    onClose();
  };

  const handleReset = () => {
    if (config) {
      setSettings(config);
      setHasChanges(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Discovery Settings</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {hasChanges && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You have unsaved changes
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Timing Settings */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Timing Configuration
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography gutterBottom>
                      Auto Discovery Interval
                    </Typography>
                    <Slider
                      value={settings.auto_discovery_interval || 30}
                      onChange={(e, value) => handleChange('auto_discovery_interval', value)}
                      min={10}
                      max={300}
                      step={10}
                      marks={[
                        { value: 10, label: '10s' },
                        { value: 60, label: '1m' },
                        { value: 120, label: '2m' },
                        { value: 300, label: '5m' }
                      ]}
                      valueLabelDisplay="on"
                      valueLabelFormat={(value) => `${value}s`}
                    />
                    <Typography variant="body2" color="text.secondary">
                      How often to run automatic discovery scans
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Probe Timeout"
                      type="number"
                      value={settings.probe_timeout}
                      onChange={(e) => handleChange('probe_timeout', parseFloat(e.target.value))}
                      InputProps={{
                        endAdornment: <InputAdornment position="end">seconds</InputAdornment>,
                        inputProps: { min: 0.5, max: 30, step: 0.5 }
                      }}
                      helperText="Timeout for device probe operations"
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Max Retries"
                      type="number"
                      value={settings.max_retries}
                      onChange={(e) => handleChange('max_retries', parseInt(e.target.value))}
                      InputProps={{
                        inputProps: { min: 0, max: 10 }
                      }}
                      helperText="Maximum retry attempts for failed operations"
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Divider />
            </Grid>

            {/* Discovery Methods */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Discovery Methods
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Passive Discovery"
                      secondary="Listen for device announcements and broadcasts"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.enable_passive_discovery || false}
                        onChange={(e) => handleChange('enable_passive_discovery', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Broadcast Discovery"
                      secondary="Send broadcast messages to discover devices"
                    />
                    <ListItemSecondaryAction>
                      <Switch
                        checked={settings.enable_broadcast || false}
                        onChange={(e) => handleChange('enable_broadcast', e.target.checked)}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Paper>
            </Grid>

            {/* Performance Tips */}
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Performance Tips
                </Typography>
                <Typography variant="body2">
                  • Lower discovery intervals provide faster device detection but use more resources
                  <br />
                  • Increase probe timeout for slower or remote devices
                  <br />
                  • Disable broadcast discovery if you're only using wired connections
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset} disabled={!hasChanges}>
          Reset
        </Button>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!hasChanges}>
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};