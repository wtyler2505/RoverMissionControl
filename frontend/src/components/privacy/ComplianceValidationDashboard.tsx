/**
 * Comprehensive Compliance Validation Dashboard
 * Provides real-time compliance monitoring, reporting, and validation for privacy officers
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  AlertTitle,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Tabs,
  Tab,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Assessment as AssessmentIcon,
  Schedule as ScheduleIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  NotificationImportant as AlertIcon
} from '@mui/icons-material';
import { format, parseISO, differenceInDays } from 'date-fns';

// Types
interface ComplianceCheckResult {
  check_type: string;
  check_name: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'pending_review';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  details: Record<string, any>;
  recommendations: string[];
  evidence: string[];
  last_checked: string;
  next_check_due?: string;
  remediation_required: boolean;
  remediation_deadline?: string;
}

interface ComplianceReport {
  report_id: string;
  generated_at: string;
  report_period_start: string;
  report_period_end: string;
  framework: string;
  overall_score: number;
  overall_status: string;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  warning_checks: number;
  critical_issues: number;
  high_risk_issues: number;
  medium_risk_issues: number;
  low_risk_issues: number;
  check_results: ComplianceCheckResult[];
  recommendations: string[];
  remediation_timeline: Record<string, string>;
  next_audit_due: string;
}

interface DashboardData {
  last_audit_date?: string;
  overall_compliance_score: number;
  overall_status: string;
  critical_issues: number;
  high_risk_issues: number;
  medium_risk_issues: number;
  low_risk_issues: number;
  next_audit_due?: string;
  privacy_requests_last_30_days: number;
  average_response_time_hours: number;
  compliance_trends: Array<{ date: string; score: number; status: string }>;
  recent_activities: Array<{ date: string; activity: string; type: string }>;
}

interface PrivacyRequestMetrics {
  total_requests: number;
  completed_requests: number;
  pending_requests: number;
  in_progress_requests: number;
  rejected_requests: number;
  completion_rate: number;
  average_response_time_hours: number;
  response_times_within_30_days: number;
  requests_by_type: Record<string, number>;
  requests_by_complexity: Record<string, number>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`compliance-tabpanel-${index}`}
    aria-labelledby={`compliance-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const ComplianceValidationDashboard: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [currentReport, setCurrentReport] = useState<ComplianceReport | null>(null);
  const [privacyMetrics, setPrivacyMetrics] = useState<PrivacyRequestMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState('gdpr');
  const [reportFormat, setReportFormat] = useState('json');
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // API functions
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/compliance/dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setDashboardData(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPrivacyMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/compliance/privacy-requests/metrics');
      if (!response.ok) throw new Error('Failed to fetch privacy metrics');
      const data = await response.json();
      setPrivacyMetrics(data);
    } catch (err) {
      console.error('Failed to fetch privacy metrics:', err);
    }
  }, []);

  const runComplianceAudit = async () => {
    try {
      setAuditLoading(true);
      setError(null);
      
      const response = await fetch(`/api/compliance/audit/run?framework=${selectedFramework}`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to run compliance audit');
      
      const report = await response.json();
      setCurrentReport(report);
      
      // Refresh dashboard data
      await fetchDashboardData();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit failed');
    } finally {
      setAuditLoading(false);
    }
  };

  const downloadReport = async (reportId: string, format: string) => {
    try {
      const response = await fetch(`/api/compliance/reports/download/${reportId}?format=${format}`);
      if (!response.ok) throw new Error('Failed to download report');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance_report_${reportId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  // Status helpers
  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' => {
    switch (status.toLowerCase()) {
      case 'compliant': return 'success';
      case 'partial': return 'warning';
      case 'non_compliant': return 'error';
      default: return 'info';
    }
  };

  const getRiskColor = (risk: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (risk.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': case 'critical': return 'error';
      default: return 'default';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  // Effects
  useEffect(() => {
    fetchDashboardData();
    fetchPrivacyMetrics();
  }, [fetchDashboardData, fetchPrivacyMetrics]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchPrivacyMetrics();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchDashboardData, fetchPrivacyMetrics]);

  // Render helpers
  const renderOverviewCards = () => (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="h6">
                  Compliance Score
                </Typography>
                <Typography variant="h4" style={{ color: getScoreColor(dashboardData?.overall_compliance_score || 0) }}>
                  {dashboardData?.overall_compliance_score?.toFixed(1) || '0.0'}%
                </Typography>
              </Box>
              <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
            <LinearProgress
              variant="determinate"
              value={dashboardData?.overall_compliance_score || 0}
              sx={{ mt: 1 }}
              color={dashboardData?.overall_compliance_score >= 80 ? 'success' : 
                     dashboardData?.overall_compliance_score >= 60 ? 'warning' : 'error'}
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="h6">
                  Critical Issues
                </Typography>
                <Typography variant="h4" color="error">
                  {dashboardData?.critical_issues || 0}
                </Typography>
              </Box>
              <ErrorIcon color="error" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="h6">
                  Privacy Requests
                </Typography>
                <Typography variant="h4">
                  {dashboardData?.privacy_requests_last_30_days || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Last 30 days
                </Typography>
              </Box>
              <AssignmentIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography color="textSecondary" gutterBottom variant="h6">
                  Avg Response Time
                </Typography>
                <Typography variant="h4">
                  {Math.round(dashboardData?.average_response_time_hours || 0)}h
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Target: &lt; 720h (30 days)
                </Typography>
              </Box>
              <ScheduleIcon color="primary" sx={{ fontSize: 40 }} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderComplianceStatus = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Compliance Status Overview</Typography>
          <Box>
            <Chip
              label={dashboardData?.overall_status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
              color={getStatusColor(dashboardData?.overall_status || '')}
              variant="filled"
              sx={{ mr: 1 }}
            />
            <Tooltip title="Refresh Dashboard">
              <IconButton onClick={fetchDashboardData} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {dashboardData?.last_audit_date && (
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Last audit: {format(parseISO(dashboardData.last_audit_date), 'PPpp')}
          </Typography>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Risk Distribution</Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Chip
                  label={`Critical: ${dashboardData?.critical_issues || 0}`}
                  color="error"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`High: ${dashboardData?.high_risk_issues || 0}`}
                  color="error"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`Medium: ${dashboardData?.medium_risk_issues || 0}`}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`Low: ${dashboardData?.low_risk_issues || 0}`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>Next Actions</Typography>
              {dashboardData?.next_audit_due && (
                <Typography variant="body2">
                  Next audit due: {format(parseISO(dashboardData.next_audit_due), 'PPP')}
                  {differenceInDays(parseISO(dashboardData.next_audit_due), new Date()) <= 7 && (
                    <Chip label="Due Soon" color="warning" size="small" sx={{ ml: 1 }} />
                  )}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderAuditControls = () => (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>Compliance Audit Controls</Typography>
        
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Framework</InputLabel>
              <Select
                value={selectedFramework}
                onChange={(e) => setSelectedFramework(e.target.value)}
                label="Framework"
              >
                <MenuItem value="gdpr">GDPR</MenuItem>
                <MenuItem value="ccpa">CCPA</MenuItem>
                <MenuItem value="hipaa">HIPAA</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Button
              variant="contained"
              onClick={runComplianceAudit}
              disabled={auditLoading}
              startIcon={auditLoading ? <CircularProgress size={20} /> : <SecurityIcon />}
              fullWidth
            >
              {auditLoading ? 'Running Audit...' : 'Run Compliance Audit'}
            </Button>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Button
              variant="outlined"
              onClick={() => setReportDialog(true)}
              startIcon={<AssessmentIcon />}
              fullWidth
              disabled={!currentReport}
            >
              Generate Report
            </Button>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderComplianceResults = () => {
    if (!currentReport) {
      return (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Compliance Check Results</Typography>
            <Typography color="textSecondary">
              No recent audit results available. Run a compliance audit to see detailed results.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Latest Audit Results - {currentReport.framework.toUpperCase()}
          </Typography>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Generated: {format(parseISO(currentReport.generated_at), 'PPpp')}
          </Typography>

          <Box sx={{ mt: 2 }}>
            {currentReport.check_results.map((check, index) => (
              <Accordion key={index}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" width="100%">
                    <Box display="flex" alignItems="center" flex={1}>
                      {check.status === 'compliant' ? (
                        <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                      ) : check.status === 'partial' ? (
                        <WarningIcon color="warning" sx={{ mr: 1 }} />
                      ) : (
                        <ErrorIcon color="error" sx={{ mr: 1 }} />
                      )}
                      <Typography>{check.check_name}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip
                        label={`${check.score.toFixed(0)}%`}
                        color={getStatusColor(check.status)}
                        size="small"
                      />
                      <Chip
                        label={check.risk_level.toUpperCase()}
                        color={getRiskColor(check.risk_level)}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Evidence</Typography>
                      <List dense>
                        {check.evidence.map((evidence, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <CheckCircleIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={evidence} />
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>Recommendations</Typography>
                      <List dense>
                        {check.recommendations.map((rec, idx) => (
                          <ListItem key={idx}>
                            <ListItemIcon>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText primary={rec} />
                          </ListItem>
                        ))}
                      </List>
                    </Grid>
                  </Grid>
                  
                  {check.remediation_required && check.remediation_deadline && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <AlertTitle>Remediation Required</AlertTitle>
                      Deadline: {format(parseISO(check.remediation_deadline), 'PPP')}
                    </Alert>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderPrivacyMetrics = () => {
    if (!privacyMetrics) return null;

    return (
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Privacy Request Overview</Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="h4">{privacyMetrics.total_requests}</Typography>
                  <Typography color="textSecondary">Total Requests</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h4" color="success.main">
                    {(privacyMetrics.completion_rate * 100).toFixed(1)}%
                  </Typography>
                  <Typography color="textSecondary">Completion Rate</Typography>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Request Status</Typography>
                <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                  <Chip label={`Completed: ${privacyMetrics.completed_requests}`} color="success" size="small" />
                  <Chip label={`In Progress: ${privacyMetrics.in_progress_requests}`} color="info" size="small" />
                  <Chip label={`Pending: ${privacyMetrics.pending_requests}`} color="warning" size="small" />
                  <Chip label={`Rejected: ${privacyMetrics.rejected_requests}`} color="error" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Request Types</Typography>
              
              <List>
                {Object.entries(privacyMetrics.requests_by_type).map(([type, count]) => (
                  <ListItem key={type}>
                    <ListItemText 
                      primary={type.charAt(0).toUpperCase() + type.slice(1)}
                      secondary={`${count} requests`}
                    />
                    <Badge badgeContent={count} color="primary" />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Compliance Validation Dashboard
      </Typography>
      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Monitor GDPR compliance status, run audits, and manage privacy requests.
        Last updated: {format(lastRefresh, 'PPpp')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {dashboardData && renderOverviewCards()}
          {dashboardData && renderComplianceStatus()}
          
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Audit & Results" />
            <Tab label="Privacy Requests" />
            <Tab label="Reports & Downloads" />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            {renderAuditControls()}
            {renderComplianceResults()}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {renderPrivacyMetrics()}
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Reports & Downloads</Typography>
                <Typography color="textSecondary">
                  Generate and download compliance reports in various formats.
                </Typography>
                {currentReport && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2">Available Report:</Typography>
                    <Box display="flex" gap={1} mt={1}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => downloadReport(currentReport.report_id, 'json')}
                      >
                        JSON
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => downloadReport(currentReport.report_id, 'html')}
                      >
                        HTML
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => downloadReport(currentReport.report_id, 'csv')}
                      >
                        CSV
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </TabPanel>
        </>
      )}

      {/* Report Generation Dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Compliance Report</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={reportFormat}
                  onChange={(e) => setReportFormat(e.target.value)}
                  label="Format"
                >
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="html">HTML</MenuItem>
                  <MenuItem value="csv">CSV</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              if (currentReport) {
                downloadReport(currentReport.report_id, reportFormat);
              }
              setReportDialog(false);
            }}
            variant="contained"
            disabled={!currentReport}
          >
            Download Report
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComplianceValidationDashboard;