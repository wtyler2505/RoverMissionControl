/**
 * Emergency Stop Demo Component
 * 
 * Demonstrates the integrated emergency stop system with all
 * confirmation methods and safety features.
 * 
 * @module EmergencyStopDemo
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Alert,
  AlertTitle,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import EmergencyStopButton from './EmergencyStopButton';
import ConfirmationConfigManager from './ConfirmationConfigManager';
import EmergencyStopAuditTrail from './EmergencyStopAuditTrail';
import {
  SystemState,
  ConfirmationConfig,
  AuditEvent,
  ConfirmationMethod,
  SecurityLevel,
} from './EmergencyStopConfirmation';

const EmergencyStopDemo: React.FC = () => {
  const theme = useTheme();
  const [isEmergencyStopped, setIsEmergencyStopped] = useState(false);
  const [systemState, setSystemState] = useState<SystemState>(SystemState.NORMAL);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [configLocked, setConfigLocked] = useState(false);
  const [confirmationConfig, setConfirmationConfig] = useState<ConfirmationConfig>({
    method: ConfirmationMethod.HOLD_TO_CONFIRM,
    securityLevel: SecurityLevel.MEDIUM,
    doubleTapTimeout: 500,
    holdDuration: 2000,
    gestureComplexity: 3,
    requireTwoPerson: false,
    allowBypass: true,
    bypassCode: 'EMERGENCY123',
    auditingEnabled: true,
  });

  // Handle emergency stop activation
  const handleActivate = useCallback(async () => {
    console.log('Emergency stop activated!');
    setIsEmergencyStopped(true);
    
    // Simulate system response
    setTimeout(() => {
      // In real implementation, this would be triggered by system feedback
      console.log('All systems halted');
    }, 100);
  }, []);

  // Handle emergency stop deactivation
  const handleDeactivate = useCallback(async () => {
    console.log('Emergency stop cleared!');
    setIsEmergencyStopped(false);
    
    // Simulate system recovery
    setTimeout(() => {
      console.log('Systems resuming normal operation');
    }, 500);
  }, []);

  // Handle audit events
  const handleAuditEvent = useCallback((event: AuditEvent) => {
    setAuditEvents((prev) => [event, ...prev]);
    console.log('Audit event:', event);
  }, []);

  // Get system state color
  const getSystemStateColor = (state: SystemState) => {
    switch (state) {
      case SystemState.NORMAL:
        return 'success';
      case SystemState.MAINTENANCE:
        return 'info';
      case SystemState.TESTING:
        return 'warning';
      case SystemState.EMERGENCY:
      case SystemState.CRITICAL_FAILURE:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          <DashboardIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Emergency Stop System Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Demonstrates advanced confirmation workflows for safety-critical operations
        </Typography>
      </Box>

      {/* System Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="h6">System Status:</Typography>
              <Chip
                label={isEmergencyStopped ? 'EMERGENCY STOPPED' : 'OPERATIONAL'}
                color={isEmergencyStopped ? 'error' : 'success'}
                icon={isEmergencyStopped ? <WarningIcon /> : undefined}
              />
            </Stack>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>System State</InputLabel>
              <Select
                value={systemState}
                label="System State"
                onChange={(e) => setSystemState(e.target.value as SystemState)}
              >
                {Object.values(SystemState).map((state) => (
                  <MenuItem key={state} value={state}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        label={state}
                        color={getSystemStateColor(state) as any}
                      />
                      <Typography>{state}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Typography variant="body2" color="text.secondary">
              Current Method: <strong>{confirmationConfig.method}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Security Level: <strong>{confirmationConfig.securityLevel}</strong>
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Emergency state alert */}
      {systemState === SystemState.EMERGENCY && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <AlertTitle>Emergency State Active</AlertTitle>
          Confirmation requirements are reduced for faster response
        </Alert>
      )}

      {systemState === SystemState.CRITICAL_FAILURE && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Critical System Failure</AlertTitle>
          Emergency bypass is available - confirmation may be skipped
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Configuration Panel */}
        <Grid item xs={12} lg={6}>
          <ConfirmationConfigManager
            currentConfig={confirmationConfig}
            systemState={systemState}
            onConfigChange={setConfirmationConfig}
            isLocked={configLocked}
            onLockToggle={setConfigLocked}
          />
        </Grid>

        {/* Emergency Stop Button Demo */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Emergency Stop Control
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 400,
                position: 'relative',
                backgroundColor: alpha(
                  isEmergencyStopped ? theme.palette.error.main : theme.palette.background.default,
                  0.05
                ),
                borderRadius: 2,
                border: `2px dashed ${alpha(theme.palette.divider, 0.3)}`,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Click the button below to test the confirmation system
              </Typography>
              
              <EmergencyStopButton
                isActivated={isEmergencyStopped}
                onActivate={handleActivate}
                onDeactivate={handleDeactivate}
                systemState={systemState}
                confirmationConfig={confirmationConfig}
                userId="demo-user"
                onAuditEvent={handleAuditEvent}
                fixed={false}
              />
              
              <Typography variant="caption" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
                Keyboard shortcuts: Ctrl+Shift+Space or Shift+Escape
              </Typography>
            </Box>
            
            {/* Configuration hints */}
            <Stack spacing={1} sx={{ mt: 3 }}>
              {confirmationConfig.method === ConfirmationMethod.DOUBLE_TAP && (
                <Alert severity="info">
                  Double-tap the button within {confirmationConfig.doubleTapTimeout}ms
                </Alert>
              )}
              
              {confirmationConfig.method === ConfirmationMethod.HOLD_TO_CONFIRM && (
                <Alert severity="info">
                  Hold the button for {confirmationConfig.holdDuration / 1000} seconds
                </Alert>
              )}
              
              {confirmationConfig.method === ConfirmationMethod.GESTURE && (
                <Alert severity="info">
                  Draw a complex pattern (complexity: {confirmationConfig.gestureComplexity}/5)
                </Alert>
              )}
              
              {confirmationConfig.method === ConfirmationMethod.TWO_PERSON && (
                <Alert severity="warning">
                  Requires authorization from two operators
                </Alert>
              )}
              
              {confirmationConfig.allowBypass && systemState === SystemState.CRITICAL_FAILURE && (
                <Alert severity="error">
                  Emergency bypass available with code: {confirmationConfig.bypassCode}
                </Alert>
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Audit Trail */}
        <Grid item xs={12}>
          <EmergencyStopAuditTrail
            events={auditEvents}
            onExport={(events) => {
              console.log('Exporting events:', events);
            }}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

export default EmergencyStopDemo;