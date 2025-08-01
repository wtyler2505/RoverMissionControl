/**
 * Emergency Recovery Integration Component
 * 
 * Main integration component that brings together all recovery functionality.
 * Provides the complete emergency stop recovery system with proper routing,
 * state management, and safety protocols.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Badge,
  Alert,
  AlertTitle,
  Backdrop,
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Timeline as AuditIcon,
  Assessment as ReportsIcon,
  Settings as ConfigIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import RecoveryDashboard from './RecoveryDashboard';
import EmergencyStopRecoveryWizard from './EmergencyStopRecoveryWizard';
import { useEmergencyRecovery } from '../../../hooks/useEmergencyRecovery';
import {
  RecoveryConfiguration,
  EmergencyStopCause,
  SystemComponent,
  ComponentStatus,
} from '../../../types/recovery';

interface EmergencyRecoveryIntegrationProps {
  /** Custom recovery configuration */
  configuration?: Partial<RecoveryConfiguration>;
  /** Whether to enable real-time updates */
  enableRealTimeUpdates?: boolean;
  /** Custom styling */
  sx?: any;
  /** Callback when navigation is requested */
  onNavigate?: (route: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recovery-tabpanel-${index}`}
      aria-labelledby={`recovery-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const EmergencyRecoveryIntegration: React.FC<EmergencyRecoveryIntegrationProps> = ({
  configuration = {},
  enableRealTimeUpdates = true,
  sx,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

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
  } = useEmergencyRecovery({
    configuration,
    enableRealTimeUpdates,
  });

  // Initialize system
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        setIsInitializing(true);
        
        // Refresh system status on startup
        await refreshSystemStatus();
        
        // Simulate initialization delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setInitializationError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize recovery system';
        setInitializationError(errorMessage);
        console.error('Recovery system initialization error:', err);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeSystem();
  }, [refreshSystemStatus]);

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Navigate to external routes
  const handleNavigateToAudit = () => {
    if (onNavigate) {
      onNavigate('/recovery/audit');
    } else {
      setActiveTab(1); // Default to audit tab
    }
  };

  const handleNavigateToReports = () => {
    if (onNavigate) {
      onNavigate('/recovery/reports');
    } else {
      setActiveTab(2); // Default to reports tab
    }
  };

  const handleNavigateToConfig = () => {
    if (onNavigate) {
      onNavigate('/recovery/config');
    } else {
      setActiveTab(3); // Default to config tab
    }
  };

  // Get system health indicator count
  const getSystemHealthIndicators = () => {
    const componentStatuses = Object.values(context.systemStatus);
    return {
      errors: componentStatuses.filter(status => status === ComponentStatus.ERROR).length,
      warnings: componentStatuses.filter(status => status === ComponentStatus.WARNING).length,
      unknown: componentStatuses.filter(status => status === ComponentStatus.UNKNOWN).length,
    };
  };

  // Get audit log indicator count (placeholder)
  const getAuditIndicators = () => {
    // In a real implementation, this would come from audit log
    return {
      recent: session?.audit_log.length || 0,
      unread: 0,
    };
  };

  if (isInitializing) {
    return (
      <Backdrop open sx={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <Box sx={{ textAlign: 'center', color: 'white' }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6">
            Initializing Recovery System...
          </Typography>
          <Typography variant="body2" color="grey.300">
            Please wait while safety systems are verified
          </Typography>
        </Box>
      </Backdrop>
    );
  }

  if (initializationError) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto', ...sx }}>
        <Alert severity="error">
          <AlertTitle>Recovery System Initialization Failed</AlertTitle>
          {initializationError}
          <br />
          <br />
          Please check system connections and try refreshing the page.
          If the problem persists, contact system administrators immediately.
        </Alert>
      </Box>
    );
  }

  const healthIndicators = getSystemHealthIndicators();
  const auditIndicators = getAuditIndicators();

  return (
    <Box sx={{ width: '100%', ...sx }}>
      {/* System-wide error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Recovery System Error</AlertTitle>
          {error}
        </Alert>
      )}

      {/* Emergency status banner */}
      {context.emergencyStopStatus.isActive && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
            border: '2px solid',
            borderColor: 'error.main',
            backgroundColor: 'error.light',
            '& .MuiAlert-message': {
              width: '100%',
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <AlertTitle>🚨 EMERGENCY STOP ACTIVE</AlertTitle>
              <Typography variant="body2">
                Cause: {context.emergencyStopStatus.cause.replace('_', ' ').toUpperCase()} | 
                Activated: {context.emergencyStopStatus.triggerTime.toLocaleString()}
              </Typography>
            </Box>
            
            {session && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" fontWeight="bold">
                  Recovery Session: {session.status.toUpperCase()}
                </Typography>
                <Typography variant="caption">
                  Progress: {session.completedSteps}/{session.totalSteps} steps
                </Typography>
              </Box>
            )}
          </Box>
        </Alert>
      )}

      {/* Tab Navigation */}
      <Paper sx={{ mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="recovery system tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab
            icon={<DashboardIcon />}
            label="Dashboard"
            id="recovery-tab-0"
            aria-controls="recovery-tabpanel-0"
          />
          
          <Tab
            icon={
              <Badge
                badgeContent={auditIndicators.unread}
                color="error"
                invisible={auditIndicators.unread === 0}
              >
                <Badge
                  badgeContent={auditIndicators.recent}
                  color="info"
                  invisible={auditIndicators.recent === 0}
                >
                  <AuditIcon />
                </Badge>
              </Badge>
            }
            label="Audit Log"
            id="recovery-tab-1"
            aria-controls="recovery-tabpanel-1"
          />
          
          <Tab
            icon={<ReportsIcon />}
            label="Reports"
            id="recovery-tab-2"
            aria-controls="recovery-tabpanel-2"
          />
          
          <Tab
            icon={
              <Badge
                badgeContent={healthIndicators.errors + healthIndicators.warnings}
                color="warning"
                invisible={healthIndicators.errors + healthIndicators.warnings === 0}
              >
                <ConfigIcon />
              </Badge>
            }
            label="Configuration"
            id="recovery-tab-3"
            aria-controls="recovery-tabpanel-3"
          />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <TabPanel value={activeTab} index={0}>
        <RecoveryDashboard
          onNavigateToAudit={handleNavigateToAudit}
          onNavigateToConfig={handleNavigateToConfig}
          onNavigateToReports={handleNavigateToReports}
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Recovery Audit Log
          </Typography>
          
          {session ? (
            <Box>
              <Typography variant="body1" gutterBottom>
                Audit entries for session: {session.id}
              </Typography>
              
              {session.audit_log.length > 0 ? (
                <Box sx={{ mt: 2 }}>
                  {session.audit_log.map((entry, index) => (
                    <Paper key={entry.id} sx={{ p: 2, mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="subtitle2">
                            {entry.action.replace('_', ' ').toUpperCase()}
                          </Typography>
                          <Typography variant="body2">
                            {entry.message}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {entry.operator_name} - {entry.timestamp.toLocaleString()}
                          </Typography>
                        </Box>
                        
                        <Badge
                          color={
                            entry.result === 'success' ? 'success' :
                            entry.result === 'warning' ? 'warning' :
                            'error'
                          }
                          variant="dot"
                        />
                      </Box>
                    </Paper>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">
                  No audit entries yet
                </Typography>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="textSecondary">
              No active recovery session - audit log not available
            </Typography>
          )}
        </Box>
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Recovery Reports
          </Typography>
          
          <Alert severity="info">
            <AlertTitle>Reports Feature</AlertTitle>
            Recovery reports and analytics will be displayed here.
            This includes session history, performance metrics, and compliance documentation.
          </Alert>
        </Box>
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Recovery Configuration
          </Typography>
          
          <Alert severity="info">
            <AlertTitle>Configuration Feature</AlertTitle>
            Recovery system configuration will be displayed here.
            This includes safety parameters, templates, and system settings.
          </Alert>
          
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Current Configuration
            </Typography>
            
            <Paper sx={{ p: 2 }}>
              <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                {JSON.stringify(context.configuration, null, 2)}
              </pre>
            </Paper>
          </Box>
        </Box>
      </TabPanel>

      {/* Loading overlay for operations */}
      <Backdrop
        open={isLoading}
        sx={{ 
          zIndex: 1300,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      >
        <Box sx={{ textAlign: 'center', color: 'white' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6">
            Processing Recovery Operation...
          </Typography>
        </Box>
      </Backdrop>
    </Box>
  );
};

export default EmergencyRecoveryIntegration;