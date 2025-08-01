/**
 * Confirmation Configuration Manager
 * 
 * Manages dynamic confirmation requirements based on system state
 * and operational context following IEC 61508 safety standards.
 * 
 * @module ConfirmationConfigManager
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Switch,
  TextField,
  Button,
  Chip,
  Stack,
  Alert,
  AlertTitle,
  Divider,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Security as SecurityIcon,
  Info as InfoIcon,
  Save as SaveIcon,
  Restore as RestoreIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from '@mui/icons-material';
import {
  ConfirmationMethod,
  SecurityLevel,
  SystemState,
  ConfirmationConfig,
} from './EmergencyStopConfirmation';

// Preset configurations for different scenarios
const PRESET_CONFIGS: Record<string, Partial<ConfirmationConfig>> = {
  minimal: {
    method: ConfirmationMethod.DOUBLE_TAP,
    securityLevel: SecurityLevel.LOW,
    doubleTapTimeout: 1000,
    holdDuration: 1000,
    gestureComplexity: 1,
    requireTwoPerson: false,
    allowBypass: true,
  },
  standard: {
    method: ConfirmationMethod.HOLD_TO_CONFIRM,
    securityLevel: SecurityLevel.MEDIUM,
    doubleTapTimeout: 500,
    holdDuration: 2000,
    gestureComplexity: 3,
    requireTwoPerson: false,
    allowBypass: true,
  },
  enhanced: {
    method: ConfirmationMethod.GESTURE,
    securityLevel: SecurityLevel.HIGH,
    doubleTapTimeout: 300,
    holdDuration: 3000,
    gestureComplexity: 4,
    requireTwoPerson: false,
    allowBypass: false,
  },
  critical: {
    method: ConfirmationMethod.TWO_PERSON,
    securityLevel: SecurityLevel.CRITICAL,
    doubleTapTimeout: 300,
    holdDuration: 3000,
    gestureComplexity: 5,
    requireTwoPerson: true,
    allowBypass: false,
  },
};

// State-based configuration rules
const STATE_BASED_RULES: Record<SystemState, Partial<ConfirmationConfig>> = {
  [SystemState.NORMAL]: {
    securityLevel: SecurityLevel.MEDIUM,
    allowBypass: false,
  },
  [SystemState.MAINTENANCE]: {
    securityLevel: SecurityLevel.LOW,
    allowBypass: true,
  },
  [SystemState.TESTING]: {
    securityLevel: SecurityLevel.LOW,
    allowBypass: true,
  },
  [SystemState.EMERGENCY]: {
    method: ConfirmationMethod.DOUBLE_TAP,
    doubleTapTimeout: 1000,
    allowBypass: true,
  },
  [SystemState.CRITICAL_FAILURE]: {
    method: ConfirmationMethod.NONE,
    allowBypass: true,
  },
};

interface ConfirmationConfigManagerProps {
  currentConfig: ConfirmationConfig;
  systemState: SystemState;
  onConfigChange: (config: ConfirmationConfig) => void;
  isLocked?: boolean;
  onLockToggle?: (locked: boolean) => void;
}

const ConfirmationConfigManager: React.FC<ConfirmationConfigManagerProps> = ({
  currentConfig,
  systemState,
  onConfigChange,
  isLocked = false,
  onLockToggle,
}) => {
  const theme = useTheme();
  const [localConfig, setLocalConfig] = useState<ConfirmationConfig>(currentConfig);
  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [bypassCode, setBypassCode] = useState(currentConfig.bypassCode || '');
  const [showBypassCode, setShowBypassCode] = useState(false);

  // Apply state-based rules automatically
  useEffect(() => {
    if (STATE_BASED_RULES[systemState]) {
      const stateRules = STATE_BASED_RULES[systemState];
      setLocalConfig(prev => ({
        ...prev,
        ...stateRules,
      }));
    }
  }, [systemState]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: string) => {
    if (preset === 'custom' || !PRESET_CONFIGS[preset]) return;
    
    const presetConfig = PRESET_CONFIGS[preset];
    setLocalConfig(prev => ({
      ...prev,
      ...presetConfig,
    }));
    setSelectedPreset(preset);
  }, []);

  // Handle individual config changes
  const handleConfigChange = useCallback((key: keyof ConfirmationConfig, value: any) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: value,
    }));
    setSelectedPreset('custom');
  }, []);

  // Save configuration
  const handleSave = useCallback(() => {
    const finalConfig = {
      ...localConfig,
      bypassCode: bypassCode || undefined,
    };
    onConfigChange(finalConfig);
  }, [localConfig, bypassCode, onConfigChange]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setLocalConfig(currentConfig);
    setBypassCode(currentConfig.bypassCode || '');
    setSelectedPreset('custom');
  }, [currentConfig]);

  // Get security level color
  const getSecurityLevelColor = (level: SecurityLevel) => {
    switch (level) {
      case SecurityLevel.LOW:
        return 'success';
      case SecurityLevel.MEDIUM:
        return 'warning';
      case SecurityLevel.HIGH:
        return 'error';
      case SecurityLevel.CRITICAL:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader
        avatar={<SettingsIcon />}
        title="Emergency Stop Confirmation Settings"
        subheader={`Current System State: ${systemState}`}
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title={isLocked ? 'Unlock settings' : 'Lock settings'}>
              <IconButton
                onClick={() => onLockToggle?.(!isLocked)}
                color={isLocked ? 'error' : 'default'}
              >
                {isLocked ? <LockIcon /> : <LockOpenIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      
      <CardContent>
        <Grid container spacing={3}>
          {/* Preset Selection */}
          <Grid item xs={12}>
            <FormControl component="fieldset" disabled={isLocked}>
              <FormLabel component="legend">Configuration Preset</FormLabel>
              <RadioGroup
                row
                value={selectedPreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
              >
                <FormControlLabel value="minimal" control={<Radio />} label="Minimal" />
                <FormControlLabel value="standard" control={<Radio />} label="Standard" />
                <FormControlLabel value="enhanced" control={<Radio />} label="Enhanced" />
                <FormControlLabel value="critical" control={<Radio />} label="Critical" />
                <FormControlLabel value="custom" control={<Radio />} label="Custom" />
              </RadioGroup>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Confirmation Method */}
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset" disabled={isLocked}>
              <FormLabel component="legend">Confirmation Method</FormLabel>
              <RadioGroup
                value={localConfig.method}
                onChange={(e) => handleConfigChange('method', e.target.value)}
              >
                <FormControlLabel
                  value={ConfirmationMethod.NONE}
                  control={<Radio />}
                  label="None (Immediate)"
                  disabled={localConfig.securityLevel !== SecurityLevel.LOW}
                />
                <FormControlLabel
                  value={ConfirmationMethod.DOUBLE_TAP}
                  control={<Radio />}
                  label="Double Tap"
                />
                <FormControlLabel
                  value={ConfirmationMethod.HOLD_TO_CONFIRM}
                  control={<Radio />}
                  label="Hold to Confirm"
                />
                <FormControlLabel
                  value={ConfirmationMethod.GESTURE}
                  control={<Radio />}
                  label="Gesture Pattern"
                />
                <FormControlLabel
                  value={ConfirmationMethod.TWO_PERSON}
                  control={<Radio />}
                  label="Two-Person Authorization"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Security Level */}
          <Grid item xs={12} md={6}>
            <FormControl component="fieldset" disabled={isLocked}>
              <FormLabel component="legend">Security Level</FormLabel>
              <RadioGroup
                value={localConfig.securityLevel}
                onChange={(e) => handleConfigChange('securityLevel', e.target.value)}
              >
                {Object.values(SecurityLevel).map((level) => (
                  <FormControlLabel
                    key={level}
                    value={level}
                    control={<Radio />}
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography>{level}</Typography>
                        <Chip
                          size="small"
                          color={getSecurityLevelColor(level) as any}
                          label={level}
                        />
                      </Stack>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Method-specific settings */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Method-Specific Settings
            </Typography>
            
            {/* Double Tap Settings */}
            {(localConfig.method === ConfirmationMethod.DOUBLE_TAP ||
              localConfig.method === ConfirmationMethod.COMBINED) && (
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Double Tap Timeout: {localConfig.doubleTapTimeout}ms
                </Typography>
                <Slider
                  value={localConfig.doubleTapTimeout}
                  onChange={(_, value) => handleConfigChange('doubleTapTimeout', value)}
                  min={200}
                  max={2000}
                  step={100}
                  marks
                  disabled={isLocked}
                  valueLabelDisplay="auto"
                />
              </Box>
            )}

            {/* Hold Settings */}
            {(localConfig.method === ConfirmationMethod.HOLD_TO_CONFIRM ||
              localConfig.method === ConfirmationMethod.COMBINED) && (
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Hold Duration: {localConfig.holdDuration / 1000}s
                </Typography>
                <Slider
                  value={localConfig.holdDuration}
                  onChange={(_, value) => handleConfigChange('holdDuration', value)}
                  min={500}
                  max={5000}
                  step={500}
                  marks
                  disabled={isLocked}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value / 1000}s`}
                />
              </Box>
            )}

            {/* Gesture Settings */}
            {(localConfig.method === ConfirmationMethod.GESTURE ||
              localConfig.method === ConfirmationMethod.COMBINED) && (
              <Box sx={{ mb: 3 }}>
                <Typography gutterBottom>
                  Gesture Complexity: {localConfig.gestureComplexity}/5
                </Typography>
                <Slider
                  value={localConfig.gestureComplexity}
                  onChange={(_, value) => handleConfigChange('gestureComplexity', value)}
                  min={1}
                  max={5}
                  step={1}
                  marks
                  disabled={isLocked}
                  valueLabelDisplay="auto"
                />
              </Box>
            )}
          </Grid>

          {/* Additional Options */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Additional Options
            </Typography>
            
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.requireTwoPerson}
                    onChange={(e) => handleConfigChange('requireTwoPerson', e.target.checked)}
                    disabled={isLocked || localConfig.method === ConfirmationMethod.TWO_PERSON}
                  />
                }
                label="Require Two-Person Authorization"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.allowBypass}
                    onChange={(e) => handleConfigChange('allowBypass', e.target.checked)}
                    disabled={isLocked}
                  />
                }
                label="Allow Emergency Bypass"
              />
              
              {localConfig.allowBypass && (
                <Box sx={{ ml: 4 }}>
                  <TextField
                    label="Bypass Code"
                    type={showBypassCode ? 'text' : 'password'}
                    value={bypassCode}
                    onChange={(e) => setBypassCode(e.target.value)}
                    disabled={isLocked}
                    fullWidth
                    margin="dense"
                    InputProps={{
                      endAdornment: (
                        <IconButton
                          onClick={() => setShowBypassCode(!showBypassCode)}
                          edge="end"
                        >
                          <InfoIcon />
                        </IconButton>
                      ),
                    }}
                    helperText="Required for emergency bypass activation"
                  />
                </Box>
              )}
              
              <FormControlLabel
                control={
                  <Switch
                    checked={localConfig.auditingEnabled}
                    onChange={(e) => handleConfigChange('auditingEnabled', e.target.checked)}
                    disabled={isLocked}
                  />
                }
                label="Enable Audit Logging"
              />
            </Stack>
          </Grid>

          {/* System State Override Alert */}
          {STATE_BASED_RULES[systemState] && (
            <Grid item xs={12}>
              <Alert severity="info">
                <AlertTitle>System State Override Active</AlertTitle>
                Some settings are automatically adjusted based on the current system state: {systemState}
              </Alert>
            </Grid>
          )}

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                startIcon={<RestoreIcon />}
                onClick={handleReset}
                disabled={isLocked}
              >
                Reset
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={isLocked}
              >
                Save Configuration
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ConfirmationConfigManager;