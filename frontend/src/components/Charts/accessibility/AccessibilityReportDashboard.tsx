/**
 * Accessibility Report Dashboard
 * Interactive dashboard for monitoring accessibility compliance of telemetry components
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Alert,
  Button,
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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Badge
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Accessibility as AccessibilityIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

import { AccessibilityReport, AccessibilityTestResult } from './AccessibilityCIIntegration';
import { ROVER_TELEMETRY_TEST_SUITES } from './RoverTelemetryAccessibilityTests';

export interface AccessibilityReportDashboardProps {
  reports: AccessibilityReport[];
  onRunTests?: () => Promise<void>;
  onExportReport?: (report: AccessibilityReport, format: string) => void;
  loading?: boolean;
}

interface TrendData {
  date: string;
  overallScore: number;
  violations: number;
  wcagAACompliance: number;
  criticalViolations: number;
}

interface ComponentScore {
  component: string;
  score: number;
  violations: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

const AccessibilityReportDashboard: React.FC<AccessibilityReportDashboardProps> = ({
  reports,
  onRunTests,
  onExportReport,
  loading = false
}) => {
  const theme = useTheme();
  const [selectedReport, setSelectedReport] = useState<AccessibilityReport | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<any>(null);

  // Get the latest report
  const latestReport = useMemo(() => {
    return reports.length > 0 ? reports[reports.length - 1] : null;
  }, [reports]);

  // Calculate trend data
  const trendData = useMemo((): TrendData[] => {
    const now = new Date();
    const cutoffDate = new Date();
    
    switch (selectedTimeRange) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      default:
        cutoffDate.setFullYear(2000); // Include all data
    }

    return reports
      .filter(report => new Date(report.testRun.timestamp) >= cutoffDate)
      .map(report => ({
        date: new Date(report.testRun.timestamp).toLocaleDateString(),
        overallScore: report.summary.overallScore,
        violations: report.summary.totalViolations,
        wcagAACompliance: report.summary.wcagAACompliance,
        criticalViolations: report.summary.criticalViolations
      }));
  }, [reports, selectedTimeRange]);

  // Calculate component scores
  const componentScores = useMemo((): ComponentScore[] => {
    if (!latestReport) return [];

    return latestReport.results.map(result => {
      const score = result.summary.passCount > 0 ? 
        Math.round((result.summary.passCount / (result.summary.passCount + result.summary.violationCount)) * 100) : 0;
      
      let status: ComponentScore['status'] = 'excellent';
      if (score < 60) status = 'critical';
      else if (score < 80) status = 'warning';
      else if (score < 95) status = 'good';

      return {
        component: result.url.split('/').pop() || 'Unknown',
        score,
        violations: result.summary.violationCount,
        status
      };
    });
  }, [latestReport]);

  // Violation severity distribution
  const violationDistribution = useMemo(() => {
    if (!latestReport) return [];

    const distribution = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    
    latestReport.results.forEach(result => {
      result.violations.forEach(violation => {
        distribution[violation.impact as keyof typeof distribution]++;
      });
    });

    return [
      { name: 'Critical', value: distribution.critical, color: theme.palette.error.main },
      { name: 'Serious', value: distribution.serious, color: theme.palette.error.light },
      { name: 'Moderate', value: distribution.moderate, color: theme.palette.warning.main },
      { name: 'Minor', value: distribution.minor, color: theme.palette.info.main }
    ].filter(item => item.value > 0);
  }, [latestReport, theme]);

  const handleExportReport = useCallback((format: 'json' | 'html' | 'csv') => {
    if (selectedReport && onExportReport) {
      onExportReport(selectedReport, format);
    }
  }, [selectedReport, onExportReport]);

  const getScoreColor = (score: number) => {
    if (score >= 95) return theme.palette.success.main;
    if (score >= 80) return theme.palette.info.main;
    if (score >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent': return <CheckCircleIcon color="success" />;
      case 'good': return <CheckCircleIcon color="info" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'critical': return <ErrorIcon color="error" />;
      default: return <InfoIcon />;
    }
  };

  const renderOverviewCards = () => (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <AccessibilityIcon sx={{ fontSize: 40, color: theme.palette.primary.main, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold" color={latestReport?.passed ? 'success.main' : 'error.main'}>
              {latestReport?.summary.overallScore || 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Overall Score
            </Typography>
            <LinearProgress
              variant="determinate"
              value={latestReport?.summary.overallScore || 0}
              sx={{
                mt: 1,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: getScoreColor(latestReport?.summary.overallScore || 0)
                }
              }}
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <ErrorIcon sx={{ fontSize: 40, color: theme.palette.error.main, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold" color="error.main">
              {latestReport?.summary.totalViolations || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Violations
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              {latestReport?.summary.criticalViolations || 0} critical
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 40, color: theme.palette.success.main, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold" color="success.main">
              {latestReport?.summary.wcagAACompliance || 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              WCAG AA Compliance
            </Typography>
            <LinearProgress
              variant="determinate"
              value={latestReport?.summary.wcagAACompliance || 0}
              color="success"
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <AssessmentIcon sx={{ fontSize: 40, color: theme.palette.info.main, mb: 1 }} />
            <Typography variant="h4" fontWeight="bold">
              {reports.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Test Runs
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Last run: {latestReport ? new Date(latestReport.testRun.timestamp).toLocaleString() : 'Never'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderTrendChart = () => (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Accessibility Trends</Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={selectedTimeRange}
              label="Time Range"
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="all">All time</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="overallScore"
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                name="Overall Score (%)"
              />
              <Line
                type="monotone"
                dataKey="wcagAACompliance"
                stroke={theme.palette.success.main}
                strokeWidth={2}
                name="WCAG AA Compliance (%)"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No trend data available for selected time range
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderComponentScores = () => (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Component Accessibility Scores
        </Typography>
        
        {componentScores.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={componentScores}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="component" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="score" fill={theme.palette.primary.main} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No component data available
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Component Status Summary
          </Typography>
          <Grid container spacing={2}>
            {componentScores.map((component, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Card variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getStatusIcon(component.status)}
                      <Typography variant="body2" fontWeight="medium">
                        {component.component}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" sx={{ color: getScoreColor(component.score) }}>
                        {component.score}%
                      </Typography>
                      {component.violations > 0 && (
                        <Typography variant="caption" color="error">
                          {component.violations} violations
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </CardContent>
    </Card>
  );

  const renderViolationDistribution = () => (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Violation Severity Distribution
        </Typography>
        
        {violationDistribution.length > 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={violationDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                >
                  {violationDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            
            <Box>
              {violationDistribution.map((item, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      backgroundColor: item.color,
                      borderRadius: '50%'
                    }}
                  />
                  <Typography variant="body2">
                    {item.name}: {item.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" color="success.main" sx={{ textAlign: 'center', py: 4 }}>
            🎉 No accessibility violations found!
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderRecentReports = () => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Recent Test Reports</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={onRunTests}
              disabled={loading}
              size="small"
            >
              Run Tests
            </Button>
            {selectedReport && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => setShowDetails(true)}
                size="small"
              >
                Export
              </Button>
            )}
          </Box>
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Overall Score</TableCell>
                <TableCell>Violations</TableCell>
                <TableCell>WCAG AA</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.slice(-10).reverse().map((report, index) => (
                <TableRow key={index} hover>
                  <TableCell>
                    {new Date(report.testRun.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: getScoreColor(report.summary.overallScore) }}>
                        {report.summary.overallScore}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={report.summary.overallScore}
                        sx={{
                          width: 60,
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getScoreColor(report.summary.overallScore)
                          }
                        }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Badge badgeContent={report.summary.criticalViolations} color="error">
                      <Typography variant="body2">
                        {report.summary.totalViolations}
                      </Typography>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {report.summary.wcagAACompliance}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={report.passed ? <CheckCircleIcon /> : <ErrorIcon />}
                      label={report.passed ? 'PASS' : 'FAIL'}
                      color={report.passed ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => {
                        setSelectedReport(report);
                        setShowDetails(true);
                      }}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {reports.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No test reports available. Run your first accessibility test to get started.
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const renderDetailsDialog = () => (
    <Dialog
      open={showDetails}
      onClose={() => setShowDetails(false)}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>
        Test Report Details
        {selectedReport && (
          <Typography variant="subtitle2" color="text.secondary">
            {new Date(selectedReport.testRun.timestamp).toLocaleString()}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {selectedReport && (
          <Box>
            {/* Export buttons */}
            <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportReport('json')}
                size="small"
              >
                Export JSON
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportReport('html')}
                size="small"
              >
                Export HTML
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => handleExportReport('csv')}
                size="small"
              >
                Export CSV
              </Button>
            </Box>

            {/* Detailed results */}
            {selectedReport.results.map((result, index) => (
              <Accordion key={index} sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mr: 2 }}>
                    <Typography variant="h6">
                      {result.url}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={`${result.summary.violationCount} violations`}
                        color={result.summary.violationCount === 0 ? 'success' : 'error'}
                        size="small"
                      />
                      <Chip
                        label={`${result.summary.passCount} passed`}
                        color="success"
                        size="small"
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {result.violations.length > 0 ? (
                    <List>
                      {result.violations.map((violation, vIndex) => (
                        <ListItem key={vIndex} divider>
                          <ListItemIcon>
                            <ErrorIcon color={violation.impact === 'critical' ? 'error' : 'warning'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={violation.help}
                            secondary={
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  {violation.description}
                                </Typography>
                                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                  <Chip label={violation.impact} size="small" />
                                  <Chip label={violation.id} size="small" variant="outlined" />
                                  <Chip label={`${violation.nodes.length} nodes`} size="small" variant="outlined" />
                                </Box>
                                {violation.tags && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                    Tags: {violation.tags.join(', ')}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Alert severity="success">
                      ✅ No accessibility violations found for this component!
                    </Alert>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowDetails(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          🚀 Rover Telemetry Accessibility Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Chip
            icon={<TimelineIcon />}
            label={`${reports.length} test runs`}
            variant="outlined"
          />
          {latestReport && (
            <Chip
              icon={latestReport.passed ? <CheckCircleIcon /> : <ErrorIcon />}
              label={latestReport.passed ? 'COMPLIANT' : 'NON-COMPLIANT'}
              color={latestReport.passed ? 'success' : 'error'}
            />
          )}
        </Box>
      </Box>

      {loading && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography>Running accessibility tests...</Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}

      {renderOverviewCards()}
      {renderTrendChart()}
      {renderComponentScores()}
      {renderViolationDistribution()}
      {renderRecentReports()}
      {renderDetailsDialog()}
    </Box>
  );
};

export default AccessibilityReportDashboard;