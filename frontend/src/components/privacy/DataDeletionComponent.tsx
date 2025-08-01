/**
 * Data Deletion Component
 * User interface for GDPR data deletion requests with security verification and preview
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
  Paper,
  Divider,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel
} from '@mui/material';
import {
  DeleteForever as DeleteForeverIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  Receipt as ReceiptIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon,
  Preview as PreviewIcon,
  Gavel as GavelIcon,
  Shield as ShieldIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { 
  DataDeletionService, 
  DataDeletionRequest, 
  DataDeletionScope, 
  DeletionPreview,
  DeletionReceipt 
} from '../../services/privacy/DataDeletionService';

interface DataDeletionComponentProps {
  deletionService: DataDeletionService;
  onDeletionComplete?: (requestId: string) => void;
  onError?: (error: string) => void;
}

interface DeletionFormData {
  deletionType: 'specific_alerts' | 'category_data' | 'complete_erasure' | 'consent_withdrawal';
  deleteAlerts: boolean;
  deleteConsents: boolean;
  deleteRetentionData: boolean;
  deleteAuditLogs: boolean;
  deleteDeviceData: boolean;
  deleteAllUserData: boolean;
  specificAlertIds: string;
  alertPriorities: string[];
  acknowledgedOnly: boolean;
  dismissedOnly: boolean;
  dateFrom: Date | null;
  dateTo: Date | null;
  consentCategories: string[];
  preserveRequired: boolean;
  cascade: boolean;
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

export const DataDeletionComponent: React.FC<DataDeletionComponentProps> = ({
  deletionService,
  onDeletionComplete,
  onError
}) => {
  const [formData, setFormData] = useState<DeletionFormData>({
    deletionType: 'specific_alerts',
    deleteAlerts: false,
    deleteConsents: false,
    deleteRetentionData: false,
    deleteAuditLogs: false,
    deleteDeviceData: false,
    deleteAllUserData: false,
    specificAlertIds: '',
    alertPriorities: [],
    acknowledgedOnly: false,
    dismissedOnly: false,
    dateFrom: null,
    dateTo: null,
    consentCategories: [],
    preserveRequired: true,
    cascade: false
  });

  const [currentRequest, setCurrentRequest] = useState<DataDeletionRequest | null>(null);
  const [deletionHistory, setDeletionHistory] = useState<DataDeletionRequest[]>([]);
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [verificationDialog, setVerificationDialog] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState(false);
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<DeletionReceipt | null>(null);
  const [verificationPassword, setVerificationPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const steps = ['Configure Deletion', 'Preview & Confirm', 'Security Verification', 'Processing', 'Complete'];

  useEffect(() => {
    loadDeletionHistory();
  }, []);

  useEffect(() => {
    if (currentRequest && currentRequest.status === 'processing') {
      const interval = setInterval(() => {
        checkDeletionStatus();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentRequest]);

  const loadDeletionHistory = async () => {
    try {
      const history = await deletionService.getUserDeletionHistory(10);
      setDeletionHistory(history);
    } catch (error) {
      console.error('Failed to load deletion history:', error);
    }
  };

  const checkDeletionStatus = async () => {
    if (!currentRequest) return;

    try {
      const status = await deletionService.getDeletionStatus(currentRequest.id);
      if (status) {
        setCurrentRequest(status);
        
        if (status.status === 'completed') {
          setActiveStep(4);
          if (onDeletionComplete) {
            onDeletionComplete(status.id);
          }
        } else if (status.status === 'failed') {
          setError(status.errorMessage || 'Deletion failed');
          setActiveStep(0);
        }
      }
    } catch (error) {
      console.error('Failed to check deletion status:', error);
    }
  };

  const handleFormChange = (field: keyof DeletionFormData, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-configure based on deletion type
      if (field === 'deletionType') {
        switch (value) {
          case 'complete_erasure':
            newData.deleteAllUserData = true;
            newData.deleteAlerts = true;
            newData.deleteConsents = true;
            newData.deleteRetentionData = true;
            newData.deleteDeviceData = true;
            newData.cascade = true;
            break;
          case 'consent_withdrawal':
            newData.deleteConsents = true;
            newData.deleteAlerts = false;
            newData.deleteRetentionData = false;
            newData.deleteDeviceData = false;
            newData.cascade = false;
            break;
          case 'category_data':
            newData.deleteAllUserData = false;
            newData.cascade = false;
            break;
          case 'specific_alerts':
            newData.deleteAlerts = true;
            newData.deleteConsents = false;
            newData.deleteRetentionData = false;
            newData.deleteDeviceData = false;
            newData.cascade = false;
            break;
        }
      }
      
      return newData;
    });
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
    const { deleteAlerts, deleteConsents, deleteRetentionData, deleteAuditLogs, deleteDeviceData, deleteAllUserData } = formData;
    
    if (!deleteAlerts && !deleteConsents && !deleteRetentionData && !deleteAuditLogs && !deleteDeviceData && !deleteAllUserData) {
      return 'Please select at least one data category to delete';
    }

    if (formData.dateFrom && formData.dateTo && formData.dateFrom > formData.dateTo) {
      return 'Start date must be before end date';
    }

    if (formData.deletionType === 'specific_alerts' && !formData.specificAlertIds.trim() && formData.alertPriorities.length === 0) {
      return 'Please specify alert IDs or select priorities for specific alert deletion';
    }

    return null;
  };

  const handleGeneratePreview = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const scope: DataDeletionScope = buildDeletionScope();
      const requestResult = await deletionService.requestDataDeletion(
        scope,
        'user',
        formData.deletionType,
        'user_request',
        formData.cascade
      );

      setCurrentRequest(requestResult.request);
      setPreview(requestResult.preview);
      setActiveStep(1);
      setConfirmationDialog(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  };

  const buildDeletionScope = (): DataDeletionScope => {
    const scope: DataDeletionScope = {
      deleteAlerts: formData.deleteAlerts,
      deleteConsents: formData.deleteConsents,
      deleteRetentionData: formData.deleteRetentionData,
      deleteAuditLogs: formData.deleteAuditLogs,
      deleteDeviceData: formData.deleteDeviceData,
      deleteAllUserData: formData.deleteAllUserData,
      preserveRequired: formData.preserveRequired
    };

    if (formData.specificAlertIds.trim()) {
      scope.specificAlertIds = formData.specificAlertIds.split(',').map(id => id.trim());
    }

    if (formData.alertPriorities.length > 0 || formData.acknowledgedOnly || formData.dismissedOnly || formData.dateFrom || formData.dateTo) {
      scope.alertCriteria = {
        priorities: formData.alertPriorities.length > 0 ? formData.alertPriorities : undefined,
        acknowledgedOnly: formData.acknowledgedOnly,
        dismissedOnly: formData.dismissedOnly,
        dateRange: formData.dateFrom && formData.dateTo ? {
          from: formData.dateFrom,
          to: formData.dateTo
        } : undefined
      };
    }

    if (formData.consentCategories.length > 0) {
      scope.consentCategories = formData.consentCategories;
    }

    return scope;
  };

  const handleConfirmDeletion = () => {
    setConfirmationDialog(false);
    if (currentRequest?.verificationRequired) {
      setActiveStep(2);
      setVerificationDialog(true);
    } else {
      setActiveStep(3);
      // Start processing immediately if no verification needed
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

      const verified = await deletionService.verifyDeletionRequest(currentRequest.id, {
        method: 'password',
        credential: verificationPassword,
        confirmationCode: confirmationCode || undefined
      });

      if (verified) {
        setVerificationDialog(false);
        setVerificationPassword('');
        setConfirmationCode('');
        setActiveStep(3);
        
        // Start polling for status updates
        setTimeout(checkDeletionStatus, 1000);
      } else {
        setError('Invalid password or confirmation code. Please try again.');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    if (!currentRequest) return;

    try {
      await deletionService.cancelDeletionRequest(currentRequest.id);
      setCurrentRequest(null);
      setPreview(null);
      setActiveStep(0);
      await loadDeletionHistory();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to cancel deletion');
    }
  };

  const handleViewReceipt = async (receiptId: string) => {
    try {
      const receipt = await deletionService.getDeletionReceipt(receiptId);
      if (receipt) {
        setSelectedReceipt(receipt);
        setReceiptDialog(true);
      }
    } catch (error) {
      setError('Failed to load deletion receipt');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: DataDeletionRequest['status']) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      case 'pending': return 'warning';
      case 'verification_required': return 'warning';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: DataDeletionRequest['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleIcon />;
      case 'failed': return <WarningIcon />;
      case 'processing': return <Schedule Icon />;
      case 'pending': case 'verification_required': return <InfoIcon />;
      default: return <InfoIcon />;
    }
  };

  const getDeletionTypeLabel = (type: DataDeletionRequest['deletionType']) => {
    switch (type) {
      case 'specific_alerts': return 'Specific Alerts';
      case 'category_data': return 'Category Data';
      case 'complete_erasure': return 'Complete Erasure';
      case 'consent_withdrawal': return 'Consent Withdrawal';
      default: return type;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeleteForeverIcon />
        Data Deletion
      </Typography>

      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
          ⚠️ Warning: Data deletion is permanent and cannot be undone
        </Typography>
        <Typography variant="body2">
          Please carefully review what will be deleted before proceeding. Some data may be retained 
          for legal or safety requirements.
        </Typography>
      </Alert>

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
              <Box sx={{ mt: 2 }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                  <Typography variant="body1">
                    Data deletion completed successfully. A deletion receipt has been generated for your records.
                  </Typography>
                </Alert>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {currentRequest.receipt && (
                    <Button
                      variant="contained"
                      startIcon={<ReceiptIcon />}
                      onClick={() => handleViewReceipt(currentRequest.receipt!.receiptId)}
                    >
                      View Receipt
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={() => setCurrentRequest(null)}
                  >
                    Close
                  </Button>
                </Box>
              </Box>
            )}

            {currentRequest.status === 'failed' && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <WarningIcon color="error" />
                <Typography variant="body1" color="error">
                  Deletion failed: {currentRequest.errorMessage}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => setCurrentRequest(null)}
                >
                  Close
                </Button>
              </Box>
            )}

            {(currentRequest.status === 'pending' || currentRequest.status === 'verification_required' || currentRequest.status === 'processing') && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CancelIcon />}
                  onClick={handleCancelDeletion}
                  disabled={loading}
                >
                  Cancel Deletion
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deletion Configuration Form */}
      {!currentRequest && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Configure Data Deletion
            </Typography>

            {/* Deletion Type */}
            <FormControl component="fieldset" sx={{ mt: 2, mb: 3 }}>
              <FormLabel component="legend">Deletion Type</FormLabel>
              <RadioGroup
                value={formData.deletionType}
                onChange={(e) => handleFormChange('deletionType', e.target.value)}
              >
                <FormControlLabel
                  value="specific_alerts"
                  control={<Radio />}
                  label="Delete Specific Alerts (by ID or criteria)"
                />
                <FormControlLabel
                  value="category_data"
                  control={<Radio />}
                  label="Delete Data by Category (alerts, consents, etc.)"
                />
                <FormControlLabel
                  value="consent_withdrawal"
                  control={<Radio />}
                  label="Withdraw Consent (remove consent-based data)"
                />
                <FormControlLabel
                  value="complete_erasure"
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      Complete Data Erasure (Right to be Forgotten)
                      <Tooltip title="This will delete ALL your data permanently">
                        <WarningIcon fontSize="small" color="warning" />
                      </Tooltip>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>

            {/* Data Categories (for category_data and complete_erasure) */}
            {(formData.deletionType === 'category_data' || formData.deletionType === 'complete_erasure') && (
              <>
                <Typography variant="subtitle1" sx={{ mt: 3, mb: 2 }}>
                  Data Categories to Delete
                </Typography>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deleteAlerts}
                        onChange={(e) => handleFormChange('deleteAlerts', e.target.checked)}
                        disabled={formData.deletionType === 'complete_erasure'}
                      />
                    }
                    label="Alert Data (messages, timestamps, acknowledgments)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deleteConsents}
                        onChange={(e) => handleFormChange('deleteConsents', e.target.checked)}
                        disabled={formData.deletionType === 'complete_erasure'}
                      />
                    }
                    label="Consent Preferences (privacy settings, consent history)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deleteDeviceData}
                        onChange={(e) => handleFormChange('deleteDeviceData', e.target.checked)}
                        disabled={formData.deletionType === 'complete_erasure'}
                      />
                    }
                    label="Device Data (device registrations, sync history)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deleteRetentionData}
                        onChange={(e) => handleFormChange('deleteRetentionData', e.target.checked)}
                        disabled={formData.deletionType === 'complete_erasure'}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Data Retention Information
                        <Tooltip title="May be required for legal compliance">
                          <InfoIcon fontSize="small" color="info" />
                        </Tooltip>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.deleteAuditLogs}
                        onChange={(e) => handleFormChange('deleteAuditLogs', e.target.checked)}
                        disabled={formData.deletionType === 'complete_erasure'}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Audit Logs (system access logs)
                        <Tooltip title="Usually cannot be deleted for compliance reasons">
                          <GavelIcon fontSize="small" color="warning" />
                        </Tooltip>
                      </Box>
                    }
                  />
                </FormGroup>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.preserveRequired}
                      onChange={(e) => handleFormChange('preserveRequired', e.target.checked)}
                    />
                  }
                  label="Preserve legally required data (recommended)"
                  sx={{ mt: 2 }}
                />
              </>
            )}

            {/* Specific Alert Configuration */}
            {formData.deletionType === 'specific_alerts' && (
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Alert Selection Criteria</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TextField
                    fullWidth
                    label="Specific Alert IDs (comma-separated)"
                    value={formData.specificAlertIds}
                    onChange={(e) => handleFormChange('specificAlertIds', e.target.value)}
                    placeholder="alert-123, alert-456, alert-789"
                    sx={{ mb: 2 }}
                  />

                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Or select by priority:
                  </Typography>
                  <FormGroup row sx={{ mb: 2 }}>
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

                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.acknowledgedOnly}
                          onChange={(e) => handleFormChange('acknowledgedOnly', e.target.checked)}
                        />
                      }
                      label="Only acknowledged alerts"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.dismissedOnly}
                          onChange={(e) => handleFormChange('dismissedOnly', e.target.checked)}
                        />
                      }
                      label="Only dismissed alerts"
                    />
                  </FormGroup>
                </AccordionDetails>
              </Accordion>
            )}

            {/* Consent Category Selection */}
            {(formData.deletionType === 'consent_withdrawal' || formData.deleteConsents) && (
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Consent Categories to Remove</Typography>
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

            {/* Advanced Options */}
            <Accordion sx={{ mt: 3 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Advanced Options</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.cascade}
                      onChange={(e) => handleFormChange('cascade', e.target.checked)}
                    />
                  }
                  label="Cascade deletion to related data"
                />
                <Typography variant="caption" display="block" color="text.secondary">
                  Also delete related data that references the selected items
                </Typography>
              </AccordionDetails>
            </Accordion>

            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={handleGeneratePreview}
                disabled={loading}
                size="large"
              >
                Preview Deletion
              </Button>
            </Box>

            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Important:</strong> You will see a detailed preview of what will be deleted 
                before any data is actually removed. Security verification is required for all deletions.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Deletion History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HistoryIcon />
            Deletion History
          </Typography>

          {deletionHistory.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No previous deletion requests found.
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Request Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Data Deleted</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deletionHistory.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getDeletionTypeLabel(request.deletionType)}
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
                          {request.scope.deleteAlerts && <Chip label="Alerts" size="small" />}
                          {request.scope.deleteConsents && <Chip label="Consents" size="small" />}
                          {request.scope.deleteDeviceData && <Chip label="Devices" size="small" />}
                          {request.scope.deleteRetentionData && <Chip label="Retention" size="small" />}
                          {request.scope.deleteAuditLogs && <Chip label="Audit Logs" size="small" />}
                          {request.scope.deleteAllUserData && <Chip label="All Data" color="error" size="small" />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {request.status === 'completed' && request.receipt && (
                          <IconButton
                            size="small"
                            onClick={() => handleViewReceipt(request.receipt!.receiptId)}
                            title="View Receipt"
                          >
                            <ReceiptIcon />
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

      {/* Confirmation Dialog */}
      <Dialog open={confirmationDialog} onClose={() => setConfirmationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PreviewIcon />
          Deletion Preview & Confirmation
        </DialogTitle>
        <DialogContent>
          {preview && (
            <Box>
              {/* Warnings */}
              {preview.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Warnings:</Typography>
                  <List dense>
                    {preview.warnings.map((warning, index) => (
                      <ListItem key={index}>
                        <ListItemIcon><WarningIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary={warning} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {/* Legal Restrictions */}
              {preview.legalRestrictions.length > 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Legal Restrictions:</Typography>
                  <List dense>
                    {preview.legalRestrictions.map((restriction, index) => (
                      <ListItem key={index}>
                        <ListItemIcon><GavelIcon fontSize="small" /></ListItemIcon>
                        <ListItemText primary={restriction} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {/* Deletion Summary */}
              <Typography variant="h6" gutterBottom>What will be deleted:</Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data Type</TableCell>
                      <TableCell align="right">To Delete</TableCell>
                      <TableCell align="right">To Retain</TableCell>
                      <TableCell>Retention Reasons</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Alerts</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.alerts.count}</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.alerts.retainedCount}</TableCell>
                      <TableCell>{preview.estimatedDeletion.alerts.retentionReasons.join(', ') || 'None'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Consents</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.consents.count}</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.consents.retainedCount}</TableCell>
                      <TableCell>{preview.estimatedDeletion.consents.retentionReasons.join(', ') || 'None'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Audit Logs</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.auditLogs.count}</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.auditLogs.retainedCount}</TableCell>
                      <TableCell>{preview.estimatedDeletion.auditLogs.retentionReasons.join(', ') || 'None'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Devices</TableCell>
                      <TableCell align="right">{preview.estimatedDeletion.devices.count}</TableCell>
                      <TableCell align="right">0</TableCell>
                      <TableCell>None</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {currentRequest?.confirmationCode && (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Confirmation Code:</strong> {currentRequest.confirmationCode}
                  </Typography>
                  <Typography variant="caption">
                    You will need this code for verification.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeletion}
            startIcon={<DeleteForeverIcon />}
          >
            Confirm Deletion
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verification Dialog */}
      <Dialog open={verificationDialog} onClose={() => setVerificationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VerifiedIcon />
          Security Verification Required
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph>
            For security purposes, please verify your identity before proceeding with data deletion.
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
          {currentRequest?.confirmationCode && (
            <TextField
              fullWidth
              label="Confirmation Code"
              value={confirmationCode}
              onChange={(e) => setConfirmationCode(e.target.value)}
              margin="normal"
              helperText={`Enter the confirmation code: ${currentRequest.confirmationCode}`}
            />
          )}
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Warning:</strong> This verification will permanently delete the selected data. 
              This action cannot be undone.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationDialog(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleVerification}
            disabled={loading || !verificationPassword}
          >
            Verify & Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialog} onClose={() => setReceiptDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon />
          Deletion Receipt
        </DialogTitle>
        <DialogContent>
          {selectedReceipt && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Receipt ID: {selectedReceipt.receiptId}
              </Typography>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle1" gutterBottom>Summary:</Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Total Records Deleted" 
                    secondary={selectedReceipt.summary.totalRecordsDeleted}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Alerts Deleted" 
                    secondary={selectedReceipt.summary.alertsDeleted}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Consents Deleted" 
                    secondary={selectedReceipt.summary.consentsDeleted}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Devices Deleted" 
                    secondary={selectedReceipt.summary.devicesDeleted}
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>Legal Compliance:</Typography>
              <Typography variant="body2">
                Legal Basis: {selectedReceipt.legalCompliance.basis}
              </Typography>
              <Typography variant="body2">
                Data Subject Rights Exercised: {selectedReceipt.legalCompliance.dataSubjectRights.join(', ')}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>Verification:</Typography>
              <Typography variant="body2">
                Method: {selectedReceipt.verification.method}
              </Typography>
              <Typography variant="body2">
                Timestamp: {new Date(selectedReceipt.verification.timestamp).toLocaleString()}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="caption" color="text.secondary">
                Integrity Checksum: {selectedReceipt.integrity.checksum}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};