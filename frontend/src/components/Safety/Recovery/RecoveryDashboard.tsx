/**
 * Recovery Dashboard
 * 
 * Central dashboard for emergency stop recovery operations.
 * Provides system status overview, recovery session management,
 * and entry point to the recovery wizard.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondary,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Emergency as EmergencyIcon,
  PlayArrow as StartIcon,
  History as HistoryIcon,
  Assessment as ReportIcon,
  Settings as ConfigIcon,
  Person as OperatorIcon,
  Timer as TimerIcon,
  CheckCircle as HealthyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Help as UnknownIcon,
  Build as RepairIcon,
  Timeline as AuditIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import {
  EmergencyStopCause,
  SystemComponent,
  ComponentStatus,
  RecoverySessionStatus,
  RecoverySession,
} from '../../../types/recovery';
import { useEmergencyRecovery } from '../../../hooks/useEmergencyRecovery';
import EmergencyStopRecoveryWizard from './EmergencyStopRecoveryWizard';

interface RecoveryDashboardProps {
  onNavigateToAudit?: () => void;
  onNavigateToConfig?: () => void;
  onNavigateToReports?: () => void;
}

const RecoveryDashboard: React.FC<RecoveryDashboardProps> = ({
  onNavigateToAudit,
  onNavigateToConfig,
  onNavigateToReports,
}) => {
  const theme = useTheme();
  const {
    context,
    session,
    isLoading,
    error,
    startRecovery,
    executeStep,
    skipStep,
    requestRollback,
    abortSession,
    refreshSystemStatus,
    canStartRecovery,
    getStepProgress,
    getEstimatedTimeRemaining,
  } = useEmergencyRecovery();

  const [showStartDialog, setShowStartDialog] = useState(false);
  const [operatorId, setOperatorId] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [selectedCause, setSelectedCause] = useState<EmergencyStopCause>(EmergencyStopCause.MANUAL_ACTIVATION);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  // Auto-refresh system status
  useEffect(() => {
    const interval = setInterval(() => {
      refreshSystemStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [refreshSystemStatus]);

  // Show wizard when session starts
  useEffect(() => {
    if (session && session.status === RecoverySessionStatus.IN_PROGRESS) {
      setShowWizard(true);
    } else {
      setShowWizard(false);
    }
  }, [session]);

  // Get component status icon
  const getComponentStatusIcon = (status: ComponentStatus) => {
    const iconProps = { fontSize: 'small' as const };
    
    switch (status) {
      case ComponentStatus.HEALTHY:
        return <HealthyIcon color="success" {...iconProps} />;
      case ComponentStatus.WARNING:
        return <WarningIcon color="warning" {...iconProps} />;
      case ComponentStatus.ERROR:
        return <ErrorIcon color="error" {...iconProps} />;
      case ComponentStatus.OFFLINE:
        return <ErrorIcon color="disabled" {...iconProps} />;
      default:
        return <UnknownIcon color="action" {...iconProps} />;
    }
  };

  // Get component status color
  const getComponentStatusColor = (status: ComponentStatus) => {
    switch (status) {
      case ComponentStatus.HEALTHY:
        return theme.palette.success.main;
      case ComponentStatus.WARNING:
        return theme.palette.warning.main;
      case ComponentStatus.ERROR:
        return theme.palette.error.main;
      case ComponentStatus.OFFLINE:
        return theme.palette.grey[500];
      default:
        return theme.palette.grey[400];
    }
  };

  // Format duration
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Handle start recovery
  const handleStartRecovery = async () => {
    if (!operatorId || !operatorName) return;

    try {
      await startRecovery(operatorId, operatorName, selectedCause, selectedTemplate || undefined);
      setShowStartDialog(false);
      setOperatorId('');
      setOperatorName('');
    } catch (err) {
      console.error('Failed to start recovery:', err);
    }
  };

  // Handle wizard callbacks
  const handleStepComplete = async (stepId: string, result: any, data?: any) => {
    await executeStep(stepId);
  };

  const handleStepFailed = async (stepId: string, error: string) => {
    console.error('Step failed:', stepId, error);
  };

  const handleStepSkipped = async (stepId: string, reason: string) => {
    await skipStep(stepId, reason);
  };

  const handleSessionComplete = async (completedSession: RecoverySession) => {
    setShowWizard(false);
  };

  const handleSessionAborted = async (reason: string) => {
    await abortSession(reason);
    setShowWizard(false);
  };

  const handleRollbackRequested = async (stepId: string, reason: string) => {
    await requestRollback(stepId, reason);
  };

  const handleAuditEvent = async (entry: any) => {
    console.log('Audit event:', entry);
  };

  if (showWizard && session) {
    return (
      <EmergencyStopRecoveryWizard
        session={session}
        configuration={context.configuration}
        onStepComplete={handleStepComplete}
        onStepFailed={handleStepFailed}
        onStepSkipped={handleStepSkipped}
        onSessionComplete={handleSessionComplete}
        onSessionAborted={handleSessionAborted}
        onRollbackRequested={handleRollbackRequested}
        onAuditEvent={handleAuditEvent}
      />
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <DashboardIcon fontSize="large" color="primary" />
          <Typography variant="h4">
            Emergency Recovery Dashboard
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh System Status">
            <IconButton onClick={refreshSystemStatus} disabled={isLoading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          
          {onNavigateToAudit && (
            <Button
              startIcon={<AuditIcon />}
              onClick={onNavigateToAudit}
              variant="outlined"
            >
              Audit Log
            </Button>
          )}
          
          {onNavigateToReports && (
            <Button
              startIcon={<ReportIcon />}
              onClick={onNavigateToReports}
              variant="outlined"
            >
              Reports
            </Button>
          )}
          
          {onNavigateToConfig && (
            <Button
              startIcon={<ConfigIcon />}
              onClick={onNavigateToConfig}
              variant="outlined"
            >
              Configuration
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Recovery Error</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Emergency Stop Status */}
      <Card sx={{ mb: 3, border: context.emergencyStopStatus.isActive ? `3px solid ${theme.palette.error.main}` : 'none' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <EmergencyIcon 
                fontSize="large" 
                color={context.emergencyStopStatus.isActive ? 'error' : 'disabled'}
              />
              <Box>
                <Typography variant="h6">
                  Emergency Stop Status
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {context.emergencyStopStatus.isActive ? 'ACTIVE' : 'INACTIVE'} | 
                  Cause: {context.emergencyStopStatus.cause.replace('_', ' ')} | 
                  Since: {context.emergencyStopStatus.triggerTime.toLocaleString()}
                </Typography>
              </Box>
            </Box>
            
            <Chip
              label={context.emergencyStopStatus.isActive ? 'EMERGENCY ACTIVE' : 'SYSTEM NORMAL'}
              color={context.emergencyStopStatus.isActive ? 'error' : 'success'}
              size="large"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* System Status Overview */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Component Status
              </Typography>
              
              <Grid container spacing={2}>
                {Object.entries(context.systemStatus).map(([component, status]) => (
                  <Grid item xs={12} sm={6} md={4} key={component}>
                    <Paper
                      sx={{
                        p: 2,
                        border: `2px solid ${getComponentStatusColor(status)}`,
                        borderRadius: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        {getComponentStatusIcon(status)}
                        <Typography variant="subtitle2" fontWeight="medium">
                          {component.replace('_', ' ').toUpperCase()}
                        </Typography>
                      </Box>
                      
                      <Chip
                        label={status.toUpperCase()}
                        size="small"
                        color={
                          status === ComponentStatus.HEALTHY ? 'success' :
                          status === ComponentStatus.WARNING ? 'warning' :
                          status === ComponentStatus.ERROR ? 'error' :
                          'default'
                        }
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Recovery Controls */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recovery Control
              </Typography>
              
              {/* Current Session Status */}
              {session ? (
                <Box sx={{ mb: 2 }}>
                  <Alert 
                    severity={
                      session.status === RecoverySessionStatus.IN_PROGRESS ? 'info' :
                      session.status === RecoverySessionStatus.COMPLETED ? 'success' :
                      session.status === RecoverySessionStatus.FAILED ? 'error' :
                      'warning'
                    }
                  >
                    <AlertTitle>Recovery Session Active</AlertTitle>
                    <Typography variant="body2">
                      Session ID: {session.id}
                    </Typography>
                    <Typography variant="body2">
                      Operator: {session.operatorName}
                    </Typography>
                    <Typography variant="body2">
                      Status: {session.status.toUpperCase()}
                    </Typography>
                    <Typography variant="body2">
                      Progress: {session.completedSteps}/{session.totalSteps} steps
                    </Typography>
                  </Alert>

                  <LinearProgress
                    variant="determinate"
                    value={getStepProgress()}
                    sx={{ mt: 1, height: 8, borderRadius: 4 }}
                  />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption">
                      {Math.round(getStepProgress())}% complete
                    </Typography>
                    <Typography variant="caption">
                      ~{formatDuration(getEstimatedTimeRemaining())} remaining
                    </Typography>
                  </Box>
                  
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<DashboardIcon />}
                    onClick={() => setShowWizard(true)}
                    sx={{ mt: 2 }}
                    disabled={session.status !== RecoverySessionStatus.IN_PROGRESS}
                  >
                    Open Recovery Wizard
                  </Button>
                </Box>
              ) : (
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    No active recovery session
                  </Typography>
                  
                  <Button
                    fullWidth
                    variant="contained"
                    color="error"
                    size="large"
                    startIcon={<StartIcon />}
                    onClick={() => setShowStartDialog(true)}
                    disabled={!canStartRecovery || isLoading}
                    sx={{ mt: 2 }}
                  >
                    {isLoading ? 'Starting...' : 'Start Recovery'}
                  </Button>
                  
                  {!context.emergencyStopStatus.isActive && (
                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                      Emergency stop must be active to begin recovery
                    </Typography>
                  )}
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Quick Actions */}
              <Typography variant="subtitle2" gutterBottom>
                Quick Actions
              </Typography>
              
              <List dense>
                <ListItem button disabled={!session}>
                  <ListItemIcon>
                    <HistoryIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="View Session History" />
                </ListItem>
                
                <ListItem button disabled={!session}>
                  <ListItemIcon>
                    <RepairIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="System Diagnostics" />
                </ListItem>
                
                <ListItem button onClick={onNavigateToAudit}>
                  <ListItemIcon>
                    <AuditIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="Audit Trail" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Sessions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Recovery Sessions
              </Typography>
              
              <Typography variant="body2" color="textSecondary">
                No recent sessions to display
              </Typography>
              
              {/* This would show a table of recent sessions */}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Start Recovery Dialog */}
      <Dialog
        open={showStartDialog}
        onClose={() => setShowStartDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StartIcon color="error" />
            <Typography variant="h6">Start Emergency Recovery</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="warning">
              <AlertTitle>Safety Notice</AlertTitle>
              Only authorized personnel should initiate emergency recovery procedures.
              Ensure all safety protocols are followed.
            </Alert>
            
            <TextField
              label="Operator ID"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              required
              fullWidth
              placeholder="Enter your operator ID"
            />
            
            <TextField
              label="Operator Name"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              required
              fullWidth
              placeholder="Enter your full name"
            />
            
            <FormControl fullWidth>
              <InputLabel>Emergency Stop Cause</InputLabel>
              <Select
                value={selectedCause}
                onChange={(e) => setSelectedCause(e.target.value as EmergencyStopCause)}
                label="Emergency Stop Cause"
              >
                {Object.values(EmergencyStopCause).map(cause => (
                  <MenuItem key={cause} value={cause}>
                    {cause.replace('_', ' ').toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <FormControl fullWidth>
              <InputLabel>Recovery Template (Optional)</InputLabel>
              <Select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                label="Recovery Template (Optional)"
              >
                <MenuItem value="">Auto-Select Template</MenuItem>
                <MenuItem value="standard_recovery">Standard Recovery</MenuItem>
                <MenuItem value="hardware_fault_recovery">Hardware Fault Recovery</MenuItem>
                <MenuItem value="communication_loss_recovery">Communication Loss Recovery</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowStartDialog(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStartRecovery}
            variant="contained"
            color="error"
            disabled={!operatorId || !operatorName || isLoading}
            startIcon={<StartIcon />}
          >
            {isLoading ? 'Starting...' : 'Start Recovery'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RecoveryDashboard;