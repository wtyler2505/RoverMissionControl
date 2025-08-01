/**
 * Data Export Component
 * User interface for GDPR data export requests with security verification
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Download as DownloadIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  FileDownload as FileDownloadIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DataExportService, DataExportRequest, DataExportScope } from '../../services/privacy/DataExportService';

interface DataExportComponentProps {
  exportService: DataExportService;
  onExportComplete?: (exportId: string) => void;
  onError?: (error: string) => void;
}

interface ExportFormData {
  includeAlerts: boolean;
  includeConsents: boolean;
  includeRetentionData: boolean;
  includeAuditLogs: boolean;
  includeMetadata: boolean;
  includeDeviceData: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
  alertPriorities: string[];
  consentCategories: string[];
}

const ALERT_PRIORITIES = ['critical', 'high', 'medium', 'low', 'info'];
const CONSENT_CATEGORIES = [
  'alerts_storage',
  'alerts_critical',
  'alert_response_times',
  'location_telemetry',
  'sensor_telemetry',
  'user_preferences',
  'usage_analytics',
  'performance_monitoring',
  'diagnostic_crash_reports',
  'cross_device_sync'
];

export const DataExportComponent: React.FC<DataExportComponentProps> = ({
  exportService,
  onExportComplete,
  onError
}) => {
  const [formData, setFormData] = useState<ExportFormData>({
    includeAlerts: true,
    includeConsents: true,
    includeRetentionData: false,
    includeAuditLogs: false,
    includeMetadata: true,
    includeDeviceData: false,
    dateFrom: null,
    dateTo: null,
    alertPriorities: [],
    consentCategories: []
  });

  const [currentRequest, setCurrentRequest] = useState<DataExportRequest | null>(null);
  const [exportHistory, setExportHistory] = useState<DataExportRequest[]>([]);
  const [verificationDialog, setVerificationDialog] = useState(false);
  const [verificationPassword, setVerificationPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Configure Export', 'Security Verification', 'Processing', 'Download'];

  useEffect(() => {
    loadExportHistory();
  }, []);

  useEffect(() => {
    if (currentRequest && currentRequest.status === 'processing') {
      const interval = setInterval(() => {
        checkExportStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentRequest]);

  const loadExportHistory = async () => {
    try {
      const history = await exportService.getUserExportHistory(10);
      setExportHistory(history);
    } catch (error) {
      console.error('Failed to load export history:', error);
    }
  };

  const checkExportStatus = async () => {
    if (!currentRequest) return;

    try {
      const status = await exportService.getExportStatus(currentRequest.id);
      if (status) {
        setCurrentRequest(status);
        
        if (status.status === 'completed') {
          setActiveStep(3);
          if (onExportComplete) {
            onExportComplete(status.id);
          }
        } else if (status.status === 'failed') {
          setError(status.errorMessage || 'Export failed');
          setActiveStep(0);
        }
      }
    } catch (error) {
      console.error('Failed to check export status:', error);
    }
  };

  const handleFormChange = (field: keyof ExportFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayFieldChange = (field: 'alertPriorities' | 'consentCategories', value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }));
  };

  const validateForm = (): string | null => {
    const { includeAlerts, includeConsents, includeRetentionData, includeAuditLogs, includeMetadata, includeDeviceData } = formData;
    
    if (!includeAlerts && !includeConsents && !includeRetentionData && !includeAuditLogs && !includeMetadata && !includeDeviceData) {
      return 'Please select at least one data category to export';
    }

    if (formData.dateFrom && formData.dateTo && formData.dateFrom > formData.dateTo) {
      return 'Start date must be before end date';
    }

    return null;
  };

  const handleRequestExport = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const scope: DataExportScope = {
        includeAlerts: formData.includeAlerts,
        includeConsents: formData.includeConsents,
        includeRetentionData: formData.includeRetentionData,
        includeAuditLogs: formData.includeAuditLogs,
        includeMetadata: formData.includeMetadata,
        includeDeviceData: formData.includeDeviceData,
        dateRange: formData.dateFrom && formData.dateTo ? {
          from: formData.dateFrom,
          to: formData.dateTo
        } : undefined,
        alertPriorities: formData.alertPriorities.length > 0 ? formData.alertPriorities : undefined,
        consentCategories: formData.consentCategories.length > 0 ? formData.consentCategories : undefined
      };

      const result = await exportService.requestDataExport(scope, 'user', 'user_request');
      setCurrentRequest(result.request);
      
      if (result.request.verificationRequired) {
        setActiveStep(1);
        setVerificationDialog(true);
      } else {
        setActiveStep(2);
      }

      await loadExportHistory();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to request export');
      if (onError) {
        onError(error instanceof Error ? error.message : 'Failed to request export');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    if (!currentRequest || !verificationPassword) {
      setError('Please enter your password for verification');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const verified = await exportService.verifyExportRequest(currentRequest.id, {
        method: 'password',
        credential: verificationPassword
      });

      if (verified) {
        setVerificationDialog(false);
        setVerificationPassword('');
        setActiveStep(2);
        
        // Start polling for status updates
        setTimeout(checkExportStatus, 1000);
      } else {
        setError('Invalid password. Please try again.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentRequest || !currentRequest.securityKey) return;

    try {
      setLoading(true);
      const blob = await exportService.downloadExport(currentRequest.id, currentRequest.securityKey);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${currentRequest.id}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelExport = async () => {
    if (!currentRequest) return;

    try {
      await exportService.cancelExportRequest(currentRequest.id);
      setCurrentRequest(null);
      setActiveStep(0);
      await loadExportHistory();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to cancel export');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: DataExportRequest['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      case 'pending': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: DataExportRequest['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'failed': return <WarningIcon />;
      case 'processing': return <ScheduleIcon />;
      case 'pending': return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DownloadIcon />
        Data Export
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Export your personal data in a machine-readable format. This includes alerts, consent preferences, 
        and other data associated with your account. All exports are secured and require verification.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Progress Stepper */}
      {currentRequest && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stepper activeStep={activeStep} sx={{ mb: 2 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {currentRequest.status === 'processing' && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress variant="determinate" value={currentRequest.progress} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Progress: {currentRequest.progress}%
                </Typography>
              </Box>
            )}

            {currentRequest.status === 'completed' && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <CheckCircleIcon color="success" />
                <Typography variant="body1">
                  Export completed successfully. File size: {formatFileSize(currentRequest.fileSize || 0)}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleDownload}
                  disabled={loading}
                >
                  Download
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={() => setCurrentRequest(null)}
                >
                  Close
                </Button>
              </Box>
            )}

            {currentRequest.status === 'failed' && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <WarningIcon color="error" />
                <Typography variant="body1" color="error">
                  Export failed: {currentRequest.errorMessage}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => setCurrentRequest(null)}
                >
                  Close
                </Button>
              </Box>
            )}

            {(currentRequest.status === 'pending' || currentRequest.status === 'processing') && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleCancelExport}
                  disabled={loading}
                >
                  Cancel Export
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export Configuration Form */}
      {!currentRequest && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configure Data Export
            </Typography>

            {/* Data Categories */}
            <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
              Data Categories
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includeAlerts}
                    onChange={(e) => handleFormChange('includeAlerts', e.target.checked)}
                  />
                }
                label="Alert Data (messages, timestamps, acknowledgments)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includeConsents}
                    onChange={(e) => handleFormChange('includeConsents', e.target.checked)}
                  />
                }
                label="Consent Preferences (privacy settings, consent history)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includeMetadata}
                    onChange={(e) => handleFormChange('includeMetadata', e.target.checked)}
                  />
                }
                label="Account Metadata (user ID, device information)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includeRetentionData}
                    onChange={(e) => handleFormChange('includeRetentionData', e.target.checked)}
                  />
                }
                label="Data Retention Information (retention policies, audit logs)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includeDeviceData}
                    onChange={(e) => handleFormChange('includeDeviceData', e.target.checked)}
                  />
                }
                label="Device Data (device registrations, sync history)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.includeAuditLogs}
                    onChange={(e) => handleFormChange('includeAuditLogs', e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    Audit Logs (system access logs)
                    <Tooltip title="May include sensitive system information">
                      <InfoIcon fontSize="small" color="info" />
                    </Tooltip>
                  </Box>
                }
              />
            </FormGroup>

            {/* Date Range Filter */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Date Range Filter (Optional)</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <DatePicker
                    label="From Date"
                    value={formData.dateFrom}
                    onChange={(date) => handleFormChange('dateFrom', date)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="To Date"
                    value={formData.dateTo}
                    onChange={(date) => handleFormChange('dateTo', date)}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Alert Priority Filter */}
            {formData.includeAlerts && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Alert Priority Filter (Optional)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormGroup row>
                    {ALERT_PRIORITIES.map((priority) => (
                      <FormControlLabel
                        key={priority}
                        control={
                          <Checkbox
                            checked={formData.alertPriorities.includes(priority)}
                            onChange={(e) => handleArrayFieldChange('alertPriorities', priority, e.target.checked)}
                          />
                        }
                        label={priority.charAt(0).toUpperCase() + priority.slice(1)}
                      />
                    ))}
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Consent Category Filter */}
            {formData.includeConsents && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Consent Category Filter (Optional)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormGroup>
                    {CONSENT_CATEGORIES.map((category) => (
                      <FormControlLabel
                        key={category}
                        control={
                          <Checkbox
                            checked={formData.consentCategories.includes(category)}
                            onChange={(e) => handleArrayFieldChange('consentCategories', category, e.target.checked)}
                          />
                        }
                        label={category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      />
                    ))}
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<SecurityIcon />}
                onClick={handleRequestExport}
                disabled={loading}
                size="large"
              >
                Request Secure Export
              </Button>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Security Notice:</strong> You will need to verify your identity before the export begins. 
                Export files are encrypted and will expire after 7 days for security.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Export History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            Export History
          </Typography>

          {exportHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No previous exports found.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Request Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Data Scope</TableCell>
                    <TableCell>File Size</TableCell>
                    <TableCell>Expires</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {exportHistory.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(request.status)}
                          label={request.status.replace('_', ' ').toUpperCase()}
                          color={getStatusColor(request.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {request.scope.includeAlerts && <Chip label="Alerts" size="small" />}
                          {request.scope.includeConsents && <Chip label="Consents" size="small" />}
                          {request.scope.includeMetadata && <Chip label="Metadata" size="small" />}
                          {request.scope.includeRetentionData && <Chip label="Retention" size="small" />}
                          {request.scope.includeDeviceData && <Chip label="Devices" size="small" />}
                          {request.scope.includeAuditLogs && <Chip label="Audit Logs" size="small" />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {request.fileSize ? formatFileSize(request.fileSize) : '-'}
                      </TableCell>
                      <TableCell>
                        {request.expiresAt ? new Date(request.expiresAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {request.status === 'completed' && request.securityKey && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setCurrentRequest(request);
                              setActiveStep(3);
                            }}
                            title="Download"
                          >
                            <FileDownloadIcon />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Verification Dialog */}
      <Dialog open={verificationDialog} onClose={() => setVerificationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VerifiedIcon />
          Security Verification Required
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            For security purposes, please verify your identity before proceeding with the data export.
          </Typography>
          <TextField
            fullWidth
            type="password"
            label="Password"
            value={verificationPassword}
            onChange={(e) => setVerificationPassword(e.target.value)}
            margin="normal"
            helperText="Enter your account password to verify your identity"
          />
          <Alert severity="info" sx={{ mt: 2 }}>
            This verification ensures that only you can access your personal data export.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleVerification}
            disabled={loading || !verificationPassword}
          >
            Verify & Proceed
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};