import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
  Badge,
} from '@mui/material';
import {
  Security as SecurityIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Assessment as AssessmentIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Assignment as TaskIcon,
  ExpandMore as ExpandMoreIcon,
  Description as ReportIcon,
  Gavel as ComplianceIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';

import { VersioningService } from '../../../services/versioningService';
import {
  ComplianceStatus,
  ComplianceState,
  ComplianceRequirement,
  RequirementStatus,
  ComplianceViolation,
  ViolationSeverity,
  ViolationStatus,
  RemediationAction,
  ActionPriority,
  ActionStatus,
} from '../../../types/versioning';

const ComplianceMonitor: React.FC = () => {
  const [complianceData, setComplianceData] = useState<ComplianceStatus[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFramework, setSelectedFramework] = useState<string>('');
  
  // Dialog states
  const [reportOpen, setReportOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [violationsOpen, setViolationsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  
  const [selectedCompliance, setSelectedCompliance] = useState<ComplianceStatus | null>(null);
  const [reportFormat, setReportFormat] = useState<string>('pdf');
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadComplianceData = async (framework?: string) => {
    try {
      setLoading(true);
      const response = await VersioningService.getComplianceStatus(framework);
      if (response.success) {
        setComplianceData(response.data);
      } else {
        setError(response.message || 'Failed to load compliance data');
      }
    } catch (err) {
      console.error('Error loading compliance data:', err);
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const loadFrameworks = async () => {
    try {
      const response = await VersioningService.getComplianceFrameworks();
      if (response.success) {
        setFrameworks(response.data);
      }
    } catch (err) {
      console.error('Error loading frameworks:', err);
    }
  };

  useEffect(() => {
    loadFrameworks();
    loadComplianceData();
  }, []);

  const handleFrameworkChange = (framework: string) => {
    setSelectedFramework(framework);
    loadComplianceData(framework || undefined);
  };

  const handleGenerateReport = async () => {
    if (!selectedCompliance) return;

    try {
      setGeneratingReport(true);
      const response = await VersioningService.generateComplianceReport(
        selectedCompliance.framework,
        reportFormat
      );
      
      if (response.success) {
        // Create download link
        const blob = new Blob([response.data], {
          type: reportFormat === 'pdf' ? 'application/pdf' : 'text/html',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compliance-report-${selectedCompliance.framework}.${reportFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setReportOpen(false);
      } else {
        setError(response.message || 'Failed to generate report');
      }
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const getComplianceColor = (state: ComplianceState) => {
    switch (state) {
      case ComplianceState.COMPLIANT:
        return 'success';
      case ComplianceState.NON_COMPLIANT:
        return 'error';
      case ComplianceState.PARTIAL_COMPLIANCE:
        return 'warning';
      case ComplianceState.REMEDIATION_IN_PROGRESS:
        return 'info';
      case ComplianceState.ASSESSMENT_PENDING:
        return 'default';
      default:
        return 'default';
    }
  };

  const getComplianceIcon = (state: ComplianceState) => {
    switch (state) {
      case ComplianceState.COMPLIANT:
        return <CheckIcon color="success" />;
      case ComplianceState.NON_COMPLIANT:
        return <ErrorIcon color="error" />;
      case ComplianceState.PARTIAL_COMPLIANCE:
        return <WarningIcon color="warning" />;
      case ComplianceState.REMEDIATION_IN_PROGRESS:
        return <TrendIcon color="info" />;
      case ComplianceState.ASSESSMENT_PENDING:
        return <ScheduleIcon color="disabled" />;
      default:
        return <SecurityIcon color="disabled" />;
    }
  };

  const getRequirementColor = (status: RequirementStatus) => {
    switch (status) {
      case RequirementStatus.MET:
        return 'success';
      case RequirementStatus.NOT_MET:
        return 'error';
      case RequirementStatus.PARTIALLY_MET:
        return 'warning';
      case RequirementStatus.PENDING_REVIEW:
        return 'info';
      case RequirementStatus.NOT_APPLICABLE:
        return 'default';
      default:
        return 'default';
    }
  };

  const getViolationColor = (severity: ViolationSeverity) => {
    switch (severity) {
      case ViolationSeverity.CRITICAL:
        return 'error';
      case ViolationSeverity.HIGH:
        return 'warning';
      case ViolationSeverity.MEDIUM:
        return 'info';
      case ViolationSeverity.LOW:
        return 'default';
      default:
        return 'default';
    }
  };

  const getActionColor = (priority: ActionPriority) => {
    switch (priority) {
      case ActionPriority.URGENT:
        return 'error';
      case ActionPriority.HIGH:
        return 'warning';
      case ActionPriority.MEDIUM:
        return 'info';
      case ActionPriority.LOW:
        return 'default';
      default:
        return 'default';
    }
  };

  const calculateOverallScore = (): number => {
    if (complianceData.length === 0) return 0;
    const totalScore = complianceData.reduce((sum, compliance) => sum + compliance.score, 0);
    return totalScore / complianceData.length;
  };

  const getTotalViolations = (): number => {
    return complianceData.reduce((sum, compliance) => sum + compliance.violations.length, 0);
  };

  const getOpenActions = (): number => {
    return complianceData.reduce((sum, compliance) => 
      sum + compliance.remediationActions.filter(action => 
        action.status !== ActionStatus.COMPLETED && action.status !== ActionStatus.CANCELLED
      ).length, 0
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Compliance Monitoring</Typography>
        <Box>
          <FormControl size="small" sx={{ minWidth: 200, mr: 2 }}>
            <InputLabel>Framework Filter</InputLabel>
            <Select
              value={selectedFramework}
              onChange={(e) => handleFrameworkChange(e.target.value)}
              label="Framework Filter"
            >
              <MenuItem value="">All Frameworks</MenuItem>
              {frameworks.map((framework) => (
                <MenuItem key={framework} value={framework}>
                  {framework}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadComplianceData(selectedFramework || undefined)}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Overall Statistics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Overall Score
                  </Typography>
                  <Typography variant="h6">
                    {calculateOverallScore().toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckIcon color="success" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Frameworks
                  </Typography>
                  <Typography variant="h6">
                    {complianceData.filter(c => c.status === ComplianceState.COMPLIANT).length}/
                    {complianceData.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ErrorIcon color="error" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Violations
                  </Typography>
                  <Typography variant="h6">
                    {getTotalViolations()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TaskIcon color="warning" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Open Actions
                  </Typography>
                  <Typography variant="h6">
                    {getOpenActions()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Compliance Status Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {complianceData.map((compliance) => (
            <Grid item xs={12} md={6} lg={4} key={compliance.framework}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <ComplianceIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h6" component="div">
                        {compliance.framework}
                      </Typography>
                    </Box>
                    <Chip
                      icon={getComplianceIcon(compliance.status)}
                      label={compliance.status.replace('_', ' ').toUpperCase()}
                      color={getComplianceColor(compliance.status)}
                      size="small"
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" color="textSecondary">
                        Compliance Score
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {compliance.score.toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={compliance.score}
                      sx={{ height: 8, borderRadius: 4 }}
                      color={compliance.score >= 80 ? 'success' : compliance.score >= 60 ? 'warning' : 'error'}
                    />
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Last Assessment: {new Date(compliance.lastAssessment).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Next Assessment: {new Date(compliance.nextAssessment).toLocaleDateString()}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Requirements Status:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip
                        label={`${compliance.requirements.filter(r => r.status === RequirementStatus.MET).length} Met`}
                        color="success"
                        size="small"
                      />
                      <Chip
                        label={`${compliance.requirements.filter(r => r.status === RequirementStatus.NOT_MET).length} Not Met`}
                        color="error"
                        size="small"
                      />
                      {compliance.requirements.filter(r => r.status === RequirementStatus.PARTIALLY_MET).length > 0 && (
                        <Chip
                          label={`${compliance.requirements.filter(r => r.status === RequirementStatus.PARTIALLY_MET).length} Partial`}
                          color="warning"
                          size="small"
                        />
                      )}
                    </Box>
                  </Box>

                  {compliance.violations.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {compliance.violations.length} violation(s) need attention
                    </Alert>
                  )}

                  {compliance.remediationActions.filter(a => 
                    a.status !== ActionStatus.COMPLETED && a.status !== ActionStatus.CANCELLED
                  ).length > 0 && (
                    <Alert severity="info">
                      {compliance.remediationActions.filter(a => 
                        a.status !== ActionStatus.COMPLETED && a.status !== ActionStatus.CANCELLED
                      ).length} pending action(s)
                    </Alert>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<AssessmentIcon />}
                    onClick={() => {
                      setSelectedCompliance(compliance);
                      setDetailsOpen(true);
                    }}
                  >
                    Details
                  </Button>
                  
                  {compliance.violations.length > 0 && (
                    <Button
                      size="small"
                      startIcon={<ErrorIcon />}
                      onClick={() => {
                        setSelectedCompliance(compliance);
                        setViolationsOpen(true);
                      }}
                      color="error"
                    >
                      Violations
                    </Button>
                  )}
                  
                  <Button
                    size="small"
                    startIcon={<ReportIcon />}
                    onClick={() => {
                      setSelectedCompliance(compliance);
                      setReportOpen(true);
                    }}
                  >
                    Report
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Generate Report Dialog */}
      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Compliance Report</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Generate a compliance report for {selectedCompliance?.framework}
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Report Format</InputLabel>
            <Select
              value={reportFormat}
              onChange={(e) => setReportFormat(e.target.value)}
              label="Report Format"
            >
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="html">HTML</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)}>Cancel</Button>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            disabled={generatingReport}
            startIcon={generatingReport ? <CircularProgress size={16} /> : <DownloadIcon />}
          >
            {generatingReport ? 'Generating...' : 'Generate Report'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compliance Details Dialog */}
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Compliance Details - {selectedCompliance?.framework}</DialogTitle>
        <DialogContent dividers>
          {selectedCompliance && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Requirements Status
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Requirement</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Last Checked</TableCell>
                          <TableCell>Automated</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedCompliance.requirements.map((requirement) => (
                          <TableRow key={requirement.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {requirement.name}
                              </Typography>
                              <Typography variant="caption" color="textSecondary">
                                {requirement.description}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={requirement.status.replace('_', ' ').toUpperCase()}
                                color={getRequirementColor(requirement.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {new Date(requirement.lastChecked).toLocaleDateString()}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={requirement.automatedCheck ? 'Yes' : 'No'}
                                color={requirement.automatedCheck ? 'success' : 'default'}
                                size="small"
                                variant="outlined"
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {selectedCompliance.remediationActions.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="h6" gutterBottom>
                      Remediation Actions
                    </Typography>
                    <List>
                      {selectedCompliance.remediationActions.map((action) => (
                        <ListItem key={action.id}>
                          <ListItemIcon>
                            <Badge
                              color={getActionColor(action.priority)}
                              variant="dot"
                            >
                              <TaskIcon />
                            </Badge>
                          </ListItemIcon>
                          <ListItemText
                            primary={action.title}
                            secondary={
                              <Box>
                                <Typography variant="body2" color="textSecondary">
                                  {action.description}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                  <Chip
                                    label={action.priority.toUpperCase()}
                                    color={getActionColor(action.priority)}
                                    size="small"
                                  />
                                  <Chip
                                    label={action.status.replace('_', ' ').toUpperCase()}
                                    size="small"
                                    variant="outlined"
                                  />
                                  <Typography variant="caption" color="textSecondary">
                                    Due: {new Date(action.dueDate).toLocaleDateString()}
                                  </Typography>
                                </Box>
                              </Box>
                            }
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
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Violations Dialog */}
      <Dialog open={violationsOpen} onClose={() => setViolationsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Compliance Violations - {selectedCompliance?.framework}</DialogTitle>
        <DialogContent dividers>
          {selectedCompliance && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Requirement</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Detected</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedCompliance.violations.map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {violation.requirement}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={violation.severity.toUpperCase()}
                          color={getViolationColor(violation.severity)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {violation.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={violation.status.replace('_', ' ').toUpperCase()}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(violation.detectedAt).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViolationsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComplianceMonitor;