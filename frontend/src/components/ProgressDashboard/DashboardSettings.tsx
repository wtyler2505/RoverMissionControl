/**
 * Dashboard Settings Component
 * 
 * Allows configuration of progress tracking and dashboard preferences
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  Divider,
  FormGroup,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Close as CloseIcon
} from '@mui/icons-material';
import { ProgressTrackingConfig } from '../../types/progress-tracking.types';

interface DashboardSettingsProps {
  onClose: () => void;
  onConfigUpdate: (config: Partial<ProgressTrackingConfig>) => void;
}

export const DashboardSettings: React.FC<DashboardSettingsProps> = ({
  onClose,
  onConfigUpdate
}) => {
  const [config, setConfig] = useState<Partial<ProgressTrackingConfig>>({
    enableGranularTracking: true,
    trackingGranularity: 'high',
    updateInterval: 100,
    enableNotifications: true,
    notificationThreshold: {
      error: true,
      warning: true,
      info: false,
      success: true
    },
    enablePerformanceMetrics: true,
    enableAlerts: true,
    alertCheckInterval: 5000,
    enableHistory: true,
    enableReplay: true,
    replaySpeed: 1
  });

  const handleSave = () => {
    onConfigUpdate(config);
  };

  return (
    <Box sx={{ width: 350, p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Dashboard Settings
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* General Settings */}
      <Typography variant="subtitle2" gutterBottom>
        General
      </Typography>
      <FormGroup sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={config.enableGranularTracking}
              onChange={(e) => setConfig({ ...config, enableGranularTracking: e.target.checked })}
            />
          }
          label="Enable Granular Tracking"
        />
        
        <FormControl size="small" sx={{ mt: 2 }}>
          <InputLabel>Tracking Granularity</InputLabel>
          <Select
            value={config.trackingGranularity}
            onChange={(e) => setConfig({ ...config, trackingGranularity: e.target.value as any })}
            label="Tracking Granularity"
          >
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Medium</MenuItem>
            <MenuItem value="high">High</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Update Interval: {config.updateInterval}ms
          </Typography>
          <Slider
            value={config.updateInterval}
            onChange={(_, value) => setConfig({ ...config, updateInterval: value as number })}
            min={50}
            max={1000}
            step={50}
            marks
            valueLabelDisplay="auto"
          />
        </Box>
      </FormGroup>

      <Divider sx={{ my: 2 }} />

      {/* Notifications */}
      <Typography variant="subtitle2" gutterBottom>
        Notifications
      </Typography>
      <FormGroup sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={config.enableNotifications}
              onChange={(e) => setConfig({ ...config, enableNotifications: e.target.checked })}
            />
          }
          label="Enable Notifications"
        />
        
        {config.enableNotifications && (
          <Box sx={{ ml: 3, mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.notificationThreshold?.error}
                  onChange={(e) => setConfig({
                    ...config,
                    notificationThreshold: {
                      ...config.notificationThreshold!,
                      error: e.target.checked
                    }
                  })}
                />
              }
              label="Error Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.notificationThreshold?.warning}
                  onChange={(e) => setConfig({
                    ...config,
                    notificationThreshold: {
                      ...config.notificationThreshold!,
                      warning: e.target.checked
                    }
                  })}
                />
              }
              label="Warning Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.notificationThreshold?.info}
                  onChange={(e) => setConfig({
                    ...config,
                    notificationThreshold: {
                      ...config.notificationThreshold!,
                      info: e.target.checked
                    }
                  })}
                />
              }
              label="Info Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={config.notificationThreshold?.success}
                  onChange={(e) => setConfig({
                    ...config,
                    notificationThreshold: {
                      ...config.notificationThreshold!,
                      success: e.target.checked
                    }
                  })}
                />
              }
              label="Success Notifications"
            />
          </Box>
        )}
      </FormGroup>

      <Divider sx={{ my: 2 }} />

      {/* Performance & Alerts */}
      <Typography variant="subtitle2" gutterBottom>
        Performance & Alerts
      </Typography>
      <FormGroup sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={config.enablePerformanceMetrics}
              onChange={(e) => setConfig({ ...config, enablePerformanceMetrics: e.target.checked })}
            />
          }
          label="Enable Performance Metrics"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={config.enableAlerts}
              onChange={(e) => setConfig({ ...config, enableAlerts: e.target.checked })}
            />
          }
          label="Enable Alerts"
        />
        
        {config.enableAlerts && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Alert Check Interval: {config.alertCheckInterval}ms
            </Typography>
            <Slider
              value={config.alertCheckInterval}
              onChange={(_, value) => setConfig({ ...config, alertCheckInterval: value as number })}
              min={1000}
              max={30000}
              step={1000}
              marks
              valueLabelDisplay="auto"
            />
          </Box>
        )}
      </FormGroup>

      <Divider sx={{ my: 2 }} />

      {/* History & Replay */}
      <Typography variant="subtitle2" gutterBottom>
        History & Replay
      </Typography>
      <FormGroup sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={config.enableHistory}
              onChange={(e) => setConfig({ ...config, enableHistory: e.target.checked })}
            />
          }
          label="Enable History"
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={config.enableReplay}
              onChange={(e) => setConfig({ ...config, enableReplay: e.target.checked })}
            />
          }
          label="Enable Replay"
        />
        
        {config.enableReplay && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Replay Speed: {config.replaySpeed}x
            </Typography>
            <Slider
              value={config.replaySpeed}
              onChange={(_, value) => setConfig({ ...config, replaySpeed: value as number })}
              min={0.5}
              max={5}
              step={0.5}
              marks
              valueLabelDisplay="auto"
            />
          </Box>
        )}
      </FormGroup>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave}>
          Save Settings
        </Button>
      </Box>
    </Box>
  );
};