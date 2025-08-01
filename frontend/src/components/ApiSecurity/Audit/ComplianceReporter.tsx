import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Download as DownloadIcon,
  Send as SendIcon,
  DateRange as DateRangeIcon,
  Description as DescriptionIcon,
  AttachFile as AttachFileIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import auditService, { getComplianceColor } from '../../../services/auditService';
import { ComplianceFramework, ComplianceReport } from '../../../types/audit';

const frameworkDescriptions: Record<ComplianceFramework, string> = {
  [ComplianceFramework.SOX]: 'Sarbanes-Oxley Act - Financial reporting and internal controls',
  [ComplianceFramework.PCI_DSS]: 'Payment Card Industry Data Security Standard',
  [ComplianceFramework.GDPR]: 'General Data Protection Regulation - EU privacy law',
  [ComplianceFramework.HIPAA]: 'Health Insurance Portability and Accountability Act',
  [ComplianceFramework.ISO_27001]: 'Information Security Management System standard',
  [ComplianceFramework.CCPA]: 'California Consumer Privacy Act'
};

const ComplianceReporter: React.FC = () => {
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ComplianceReport | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Generate report form state
  const [generateForm, setGenerateForm] = useState({
    framework: ComplianceFramework.SOX,
    startDate: startOfMonth(subMonths(new Date(), 1)),
    endDate: endOfMonth(subMonths(new Date(), 1))
  });

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditService.getComplianceReports();
      setReports(data);
    } catch (err) {
      setError('Failed to load compliance reports');
      console.error('Compliance reports error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const report = await auditService.generateComplianceReport(
        generateForm.framework,
        generateForm.startDate.toISOString(),
        generateForm.endDate.toISOString()
      );
      setReports(prev => [report, ...prev]);
      setShowGenerateDialog(false);
      setGenerateForm({
        framework: ComplianceFramework.SOX,
        startDate: startOfMonth(subMonths(new Date(), 1)),
        endDate: endOfMonth(subMonths(new Date(), 1))
      });
    } catch (err) {
      console.error('Generate report error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const blob = await auditService.downloadComplianceReport(reportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleSubmitReport = async (reportId: string) => {
    try {
      await auditService.submitComplianceReport(reportId);
      await fetchReports(); // Refresh to get updated status
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleViewDetails = (report: ComplianceReport) => {
    setSelectedReport(report);
    setShowDetailsDialog(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'warning';
      case 'final': return 'primary';
      case 'submitted': return 'success';
      default: return 'default';
    }
  };

  const getComplianceStatus = (report: ComplianceReport) => {
    const issues = [
      ...report.retention_compliance.issues,
      report.access_controls.unauthorized_attempts > 0 ? 'Unauthorized access attempts detected' : '',
      report.data_integrity.tampered_records > 0 ? 'Data integrity issues found' : ''
    ].filter(Boolean);

    return {
      isCompliant: issues.length === 0,
      issueCount: issues.length
    };
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Compliance Reports
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<AssessmentIcon />}
            onClick={() => setShowGenerateDialog(true)}
          >
            Generate Report
          </Button>
          <IconButton onClick={fetchReports}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Reports Grid */}
      <Grid container spacing={3}>
        {reports.map((report) => {
          const { isCompliant, issueCount } = getComplianceStatus(report);
          
          return (
            <Grid item xs={12} md={6} lg={4} key={report.id}>
              <Card>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Chip
                      label={report.framework.toUpperCase().replace(/_/g, ' ')}
                      style={{
                        backgroundColor: getComplianceColor(report.framework),
                        color: 'white'
                      }}
                    />
                    <Chip
                      label={report.status}
                      color={getStatusColor(report.status) as any}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="h6" gutterBottom>
                    {format(new Date(report.report_period_start), 'MMM yyyy')}
                  </Typography>
                  
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    {format(new Date(report.report_period_start), 'PP')} - {format(new Date(report.report_period_end), 'PP')}
                  </Typography>
                  
                  <Box my={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">
                        Compliance Status
                      </Typography>
                      {isCompliant ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label="Compliant"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<WarningIcon />}
                          label={`${issueCount} Issues`}
                          color="warning"
                          size="small"
                        />
                      )}
                    </Box>
                    
                    <Box mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        Total Events: {report.total_events.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Generated: {format(new Date(report.generated_at), 'PP')}
                    </Typography>
                    <br />
                    <Typography variant="caption" color="textSecondary">
                      By: {report.generated_by}
                    </Typography>
                  </Box>
                </CardContent>
                
                <CardActions>
                  <Button size="small" onClick={() => handleViewDetails(report)}>
                    View Details
                  </Button>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleDownloadReport(report.id)}
                  >
                    Download
                  </Button>
                  {report.status === 'final' && (
                    <Button
                      size="small"
                      startIcon={<SendIcon />}
                      onClick={() => handleSubmitReport(report.id)}
                      color="primary"
                    >
                      Submit
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Generate Report Dialog */}
      <Dialog open={showGenerateDialog} onClose={() => setShowGenerateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Compliance Report</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Compliance Framework</InputLabel>
                <Select
                  value={generateForm.framework}
                  onChange={(e) => setGenerateForm(prev => ({ ...prev, framework: e.target.value as ComplianceFramework }))}
                  label="Compliance Framework"
                >
                  {Object.entries(frameworkDescriptions).map(([framework, description]) => (
                    <MenuItem key={framework} value={framework}>
                      <Box>
                        <Typography variant="body1">
                          {framework.toUpperCase().replace(/_/g, ' ')}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={generateForm.startDate}
                  onChange={(date) => date && setGenerateForm(prev => ({ ...prev, startDate: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="End Date"
                  value={generateForm.endDate}
                  onChange={(date) => date && setGenerateForm(prev => ({ ...prev, endDate: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info" icon={<InfoIcon />}>
                This will analyze all audit logs within the specified date range and generate a comprehensive compliance report for {generateForm.framework.toUpperCase().replace(/_/g, ' ')}.
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            disabled={generating}
            startIcon={generating && <CircularProgress size={16} />}
          >
            Generate Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Details Dialog */}
      <Dialog open={showDetailsDialog} onClose={() => setShowDetailsDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Report Details
          {selectedReport && (
            <Chip
              label={selectedReport.framework.toUpperCase().replace(/_/g, ' ')}
              style={{
                backgroundColor: getComplianceColor(selectedReport.framework),
                color: 'white',
                marginLeft: 16
              }}
            />
          )}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Report Period</Typography>
                  <Typography variant="body1">
                    {format(new Date(selectedReport.report_period_start), 'PP')} - {format(new Date(selectedReport.report_period_end), 'PP')}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                  <Chip
                    label={selectedReport.status}
                    color={getStatusColor(selectedReport.status) as any}
                    size="small"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Event Summary</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Category</TableCell>
                          <TableCell align="right">Count</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(selectedReport.events_by_category).map(([category, count]) => (
                          <TableRow key={category}>
                            <TableCell>{category.replace(/_/g, ' ')}</TableCell>
                            <TableCell align="right">{count.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell><strong>Total</strong></TableCell>
                          <TableCell align="right"><strong>{selectedReport.total_events.toLocaleString()}</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>Compliance Status</Typography>
                  
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        {selectedReport.retention_compliance.compliant ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText
                        primary="Retention Compliance"
                        secondary={selectedReport.retention_compliance.compliant ? 'All retention policies met' : selectedReport.retention_compliance.issues.join(', ')}
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemIcon>
                        {selectedReport.access_controls.unauthorized_attempts === 0 ? <CheckCircleIcon color="success" /> : <WarningIcon color="warning" />}
                      </ListItemIcon>
                      <ListItemText
                        primary="Access Controls"
                        secondary={`${selectedReport.access_controls.unauthorized_attempts} unauthorized access attempts`}
                      />
                    </ListItem>
                    
                    <ListItem>
                      <ListItemIcon>
                        {selectedReport.data_integrity.tampered_records === 0 ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
                      </ListItemIcon>
                      <ListItemText
                        primary="Data Integrity"
                        secondary={`${selectedReport.data_integrity.tampered_records} tampered records detected`}
                      />
                    </ListItem>
                  </List>
                </Grid>
                
                {selectedReport.recommendations.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>Recommendations</Typography>
                    <List>
                      {selectedReport.recommendations.map((rec, index) => (
                        <ListItem key={index}>
                          <ListItemText primary={`${index + 1}. ${rec}`} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                )}
                
                {selectedReport.attachments.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>Attachments</Typography>
                    <List>
                      {selectedReport.attachments.map((attachment, index) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <AttachFileIcon />
                          </ListItemIcon>
                          <ListItemText
                            primary={attachment.name}
                            secondary={attachment.type}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailsDialog(false)}>Close</Button>
          {selectedReport && (
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={() => handleDownloadReport(selectedReport.id)}
            >
              Download Full Report
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComplianceReporter;