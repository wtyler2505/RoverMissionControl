/**
 * Privacy Management Component
 * Main dashboard for GDPR compliance features including consent, data export, and deletion
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tab,
  Tabs,
  Alert,
  Chip,
  Button,
  LinearProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Privacy as PrivacyIcon,
  Shield as ShieldIcon,
  Download as DownloadIcon,
  DeleteForever as DeleteForeverIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Settings as SettingsIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';

import { PrivacySettings } from './PrivacySettings';
import { DataExportComponent } from './DataExportComponent';
import { DataDeletionComponent } from './DataDeletionComponent';

import { ConsentManager, consentManager } from '../../services/privacy/ConsentManager';
import { DataExportService } from '../../services/privacy/DataExportService';
import { DataDeletionService } from '../../services/privacy/DataDeletionService';
import { RetentionService, retentionService } from '../../services/retention/RetentionService';
import { AlertPersistenceService } from '../../services/persistence/AlertPersistenceService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`privacy-tabpanel-${index}`}
      aria-labelledby={`privacy-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface PrivacyManagementComponentProps {
  userId?: string;
}

export const PrivacyManagementComponent: React.FC<PrivacyManagementComponentProps> = ({
  userId = 'anonymous'
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [privacyStatus, setPrivacyStatus] = useState({
    consentCompliance: 0,
    dataRetention: 0,
    exportRequests: 0,
    deletionRequests: 0,
    lastReview: null as Date | null,
    nextReview: null as Date | null,
    pendingActions: [] as string[]
  });

  // Initialize services
  const [exportService] = useState(() => {
    const alertPersistence = new AlertPersistenceService();
    return new DataExportService(consentManager, alertPersistence, retentionService, userId);
  });

  const [deletionService] = useState(() => {
    const alertPersistence = new AlertPersistenceService();
    return new DataDeletionService(consentManager, alertPersistence, retentionService, userId);
  });

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      setLoading(true);
      
      // Initialize all services
      await consentManager.initialize();
      await exportService.initialize();
      await deletionService.initialize();
      
      // Load privacy status
      await loadPrivacyStatus();
      
      // Check for pending actions
      await checkPendingActions();
      
    } catch (error) {
      console.error('Failed to initialize privacy services:', error);
      setError('Failed to load privacy management features');
    } finally {
      setLoading(false);
    }
  };

  const loadPrivacyStatus = async () => {
    try {
      // Get consent statistics
      const consentStats = await consentManager.getConsentStatistics();
      const consentRecord = await consentManager.getCurrentConsentRecord();
      
      // Get export history
      const exportHistory = await exportService.getUserExportHistory(5);
      const activeExports = exportHistory.filter(req => req.status === 'processing').length;
      
      // Get deletion history
      const deletionHistory = await deletionService.getUserDeletionHistory(5);
      const activeDeletions = deletionHistory.filter(req => req.status === 'processing').length;
      
      // Calculate compliance score
      const totalCategories = consentManager.getAllConsentConfigurations().length;
      const consentCompliance = Math.round((consentStats.categoriesWithConsent / totalCategories) * 100);
      
      setPrivacyStatus({
        consentCompliance,
        dataRetention: 85, // This would be calculated from retention service
        exportRequests: activeExports,
        deletionRequests: activeDeletions,
        lastReview: consentRecord?.lastReviewDate || null,
        nextReview: consentRecord?.nextReviewDate || null,
        pendingActions: []
      });
      
    } catch (error) {
      console.error('Failed to load privacy status:', error);
    }
  };

  const checkPendingActions = async () => {
    try {
      const pendingActions: string[] = [];
      
      // Check if consent review is due
      const reviewStatus = await consentManager.isConsentReviewDue();
      if (reviewStatus.isDue) {
        pendingActions.push(`Consent review overdue by ${reviewStatus.daysOverdue} days`);
      }
      
      // Check for policy changes
      const policyChanges = await consentManager.getPolicyChangesSinceLastConsent();
      if (policyChanges.hasChanges && policyChanges.requiresNewConsent) {
        pendingActions.push('Privacy policy updated - consent review required');
      }
      
      // Check for expired exports
      const exportHistory = await exportService.getUserExportHistory(10);
      const expiredExports = exportHistory.filter(req => 
        req.expiresAt && new Date() > req.expiresAt && req.status === 'completed'
      ).length;
      
      if (expiredExports > 0) {
        pendingActions.push(`${expiredExports} export downloads have expired`);
      }
      
      setPrivacyStatus(prev => ({ ...prev, pendingActions }));
      
    } catch (error) {
      console.error('Failed to check pending actions:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleExportComplete = async (exportId: string) => {
    await loadPrivacyStatus();
    // Could show success notification here
  };

  const handleDeletionComplete = async (requestId: string) => {
    await loadPrivacyStatus();
    // Could show success notification here
  };

  const handleError = (error: string) => {
    setError(error);
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getComplianceLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Attention';
    return 'Poor';
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Loading Privacy Management...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PrivacyIcon />
        Privacy Management Dashboard
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Manage your privacy settings, consent preferences, and exercise your data rights 
        in compliance with GDPR and other privacy regulations.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Privacy Status Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <ShieldIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Consent Compliance
              </Typography>
              <Typography variant="h4" color={`${getComplianceColor(privacyStatus.consentCompliance)}.main`}>
                {privacyStatus.consentCompliance}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {getComplianceLabel(privacyStatus.consentCompliance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssessmentIcon sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Data Retention
              </Typography>
              <Typography variant="h4" color="info.main">
                {privacyStatus.dataRetention}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Policies Applied
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <DownloadIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Active Exports
              </Typography>
              <Typography variant="h4" color="success.main">
                {privacyStatus.exportRequests}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                In Progress
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <DeleteForeverIcon sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                Active Deletions
              </Typography>
              <Typography variant="h4" color="warning.main">
                {privacyStatus.deletionRequests}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                In Progress
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pending Actions */}
      {privacyStatus.pendingActions.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Pending Actions Required:
          </Typography>
          <List dense>
            {privacyStatus.pendingActions.map((action, index) => (
              <ListItem key={index} sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <WarningIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={action} />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      {/* Consent Review Status */}
      {(privacyStatus.lastReview || privacyStatus.nextReview) && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ScheduleIcon />
              Consent Review Schedule
            </Typography>
            <Grid container spacing={2}>
              {privacyStatus.lastReview && (
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Last Review:
                  </Typography>
                  <Typography variant="body1">
                    {privacyStatus.lastReview.toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
              {privacyStatus.nextReview && (
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Next Review Due:
                  </Typography>
                  <Typography variant="body1">
                    {privacyStatus.nextReview.toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider'
          }}
        >
          <Tab 
            label="Privacy Settings" 
            icon={<SettingsIcon />}
            iconPosition="start"
          />
          <Tab 
            label="Data Export" 
            icon={<DownloadIcon />}
            iconPosition="start"
          />
          <Tab 
            label="Data Deletion" 
            icon={<DeleteForeverIcon />}
            iconPosition="start"
          />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <PrivacySettings 
            consentManager={consentManager}
            onConsentUpdate={loadPrivacyStatus}
            onError={handleError}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <DataExportComponent
            exportService={exportService}
            onExportComplete={handleExportComplete}
            onError={handleError}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <DataDeletionComponent
            deletionService={deletionService}
            onDeletionComplete={handleDeletionComplete}
            onError={handleError}
          />
        </TabPanel>
      </Paper>

      {/* Help and Legal Information */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Privacy Rights
          </Typography>
          <Typography variant="body2" paragraph>
            Under GDPR and other privacy laws, you have the following rights regarding your personal data:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText 
                primary="Right to be informed" 
                secondary="You have the right to know how your data is being used"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText 
                primary="Right of access" 
                secondary="You can request a copy of your personal data"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText 
                primary="Right to rectification" 
                secondary="You can request corrections to inaccurate data"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText 
                primary="Right to erasure" 
                secondary="You can request deletion of your personal data"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText 
                primary="Right to data portability" 
                secondary="You can request your data in a machine-readable format"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
              <ListItemText 
                primary="Right to object" 
                secondary="You can object to processing of your data"
              />
            </ListItem>
          </List>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="body2" color="text.secondary">
            If you have questions about your privacy rights or need assistance with these features, 
            please contact our privacy team. All requests are processed within the timeframes 
            required by applicable privacy laws.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};