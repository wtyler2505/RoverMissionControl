import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Grid,
  Divider,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { JsonViewer } from '@textea/json-viewer';
import auditService, { getSeverityColor, getComplianceColor } from '../../../services/auditService';
import { AuditLog } from '../../../types/audit';

interface AuditDetailsProps {
  logId: string;
  onBack?: () => void;
}

const AuditDetails: React.FC<AuditDetailsProps> = ({ logId, onBack }) => {
  const [log, setLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);

  useEffect(() => {
    fetchLogDetails();
  }, [logId]);

  const fetchLogDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditService.getLogById(logId);
      setLog(data);
    } catch (err) {
      setError('Failed to load audit log details');
      console.error('Audit log details error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    if (!log) return;
    
    try {
      setVerifying(true);
      const result = await auditService.verifyLogIntegrity(log.id);
      setVerificationResult(result);
      setShowVerificationDialog(true);
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleExportLog = async () => {
    if (!log) return;
    
    try {
      const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${log.id}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !log) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error || 'Log not found'}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          {onBack && (
            <IconButton onClick={onBack}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h5">
            Audit Log Details
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={verifying ? <CircularProgress size={16} /> : <VerifiedIcon />}
            onClick={handleVerifyIntegrity}
            disabled={verifying}
          >
            Verify Integrity
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportLog}
          >
            Export
          </Button>
        </Box>
      </Box>

      {/* Main Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Box display="flex" gap={2} alignItems="center" mb={2}>
              <Typography variant="h6">
                {log.event_type}
              </Typography>
              <Chip
                label={log.severity}
                size="small"
                style={{
                  backgroundColor: getSeverityColor(log.severity),
                  color: 'white'
                }}
              />
              <Chip
                label={log.category.replace(/_/g, ' ')}
                size="small"
                variant="outlined"
              />
              <Chip
                label={log.result}
                size="small"
                color={log.result === 'success' ? 'success' : log.result === 'failure' ? 'error' : 'warning'}
                icon={log.result === 'success' ? <CheckCircleIcon /> : <CancelIcon />}
              />
            </Box>
            <Typography variant="body1" color="textSecondary">
              {log.action}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom color="textSecondary">
              <TimelineIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              Timestamp
            </Typography>
            <Typography variant="body1" gutterBottom>
              {format(new Date(log.timestamp), 'PPpp')}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={1}>
              <Typography variant="caption" color="textSecondary">
                ID: {log.id}
              </Typography>
              <IconButton size="small" onClick={() => handleCopyToClipboard(log.id)}>
                <CopyIcon fontSize="small" />
              </IconButton>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom color="textSecondary">
              <PersonIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              Actor
            </Typography>
            <Typography variant="body1">
              {log.actor_name} ({log.actor_role})
            </Typography>
            <Typography variant="body2" color="textSecondary">
              ID: {log.actor_id}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              IP: {log.actor_ip}
            </Typography>
          </Grid>

          {log.target_id && (
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                <StorageIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                Target
              </Typography>
              <Typography variant="body1">
                {log.target_name || 'N/A'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Type: {log.target_type || 'N/A'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                ID: {log.target_id}
              </Typography>
            </Grid>
          )}

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom color="textSecondary">
              <ComputerIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
              Request Context
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Session: {log.session_id || 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Request: {log.request_id || 'N/A'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              User Agent: {log.user_agent || 'N/A'}
            </Typography>
          </Grid>
        </Grid>

        {log.error_message && (
          <>
            <Divider sx={{ my: 3 }} />
            <Alert severity="error" icon={<WarningIcon />}>
              <Typography variant="subtitle2" gutterBottom>
                Error Details
              </Typography>
              <Typography variant="body2">
                {log.error_message}
              </Typography>
            </Alert>
          </>
        )}
      </Paper>

      {/* Data Changes */}
      {(log.before_snapshot || log.after_snapshot) && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Data Changes</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {log.before_snapshot && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom color="textSecondary">
                        Before
                      </Typography>
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        <JsonViewer
                          value={log.before_snapshot}
                          theme="dark"
                          displayDataTypes={false}
                          displaySize={false}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
              
              {log.after_snapshot && (
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom color="textSecondary">
                        After
                      </Typography>
                      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                        <JsonViewer
                          value={log.after_snapshot}
                          theme="dark"
                          displayDataTypes={false}
                          displaySize={false}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Metadata */}
      {log.metadata && Object.keys(log.metadata).length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Metadata</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
              <JsonViewer
                value={log.metadata}
                theme="dark"
                displayDataTypes={false}
                displaySize={false}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Compliance and Security */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Compliance & Security</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Compliance Frameworks
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {log.compliance_flags.length > 0 ? (
                  log.compliance_flags.map(framework => (
                    <Chip
                      key={framework}
                      label={framework.toUpperCase().replace(/_/g, ' ')}
                      size="small"
                      style={{
                        backgroundColor: getComplianceColor(framework),
                        color: 'white'
                      }}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No compliance flags
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Tags
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {log.tags.length > 0 ? (
                  log.tags.map(tag => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    No tags
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom color="textSecondary">
                Integrity Information
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    {log.checksum ? <LockIcon color="success" /> : <LockOpenIcon color="disabled" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Checksum"
                    secondary={log.checksum || 'Not available'}
                  />
                  {log.checksum && (
                    <IconButton size="small" onClick={() => handleCopyToClipboard(log.checksum!)}>
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    {log.signature ? <LockIcon color="success" /> : <LockOpenIcon color="disabled" />}
                  </ListItemIcon>
                  <ListItemText
                    primary="Digital Signature"
                    secondary={log.signature ? 'Present' : 'Not available'}
                  />
                </ListItem>
              </List>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Verification Dialog */}
      <Dialog open={showVerificationDialog} onClose={() => setShowVerificationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Integrity Verification Result
        </DialogTitle>
        <DialogContent>
          {verificationResult && (
            <List>
              <ListItem>
                <ListItemIcon>
                  {verificationResult.valid ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
                </ListItemIcon>
                <ListItemText
                  primary="Overall Status"
                  secondary={verificationResult.valid ? 'Valid' : 'Invalid'}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  {verificationResult.checksum_match ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
                </ListItemIcon>
                <ListItemText
                  primary="Checksum"
                  secondary={verificationResult.checksum_match ? 'Matches' : 'Does not match'}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  {verificationResult.signature_valid ? <CheckCircleIcon color="success" /> : <CancelIcon color="error" />}
                </ListItemIcon>
                <ListItemText
                  primary="Digital Signature"
                  secondary={verificationResult.signature_valid ? 'Valid' : 'Invalid'}
                />
              </ListItem>
              {verificationResult.issues && verificationResult.issues.length > 0 && (
                <ListItem>
                  <ListItemText
                    primary="Issues Found"
                    secondary={
                      <List dense>
                        {verificationResult.issues.map((issue: string, index: number) => (
                          <ListItem key={index}>
                            <Typography variant="body2" color="error">
                              • {issue}
                            </Typography>
                          </ListItem>
                        ))}
                      </List>
                    }
                  />
                </ListItem>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVerificationDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditDetails;