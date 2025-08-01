/**
 * Accessibility Compliance Dashboard
 * Comprehensive monitoring and reporting for chart accessibility
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Visibility as VisibilityIcon,
  VolumeUp as VolumeUpIcon,
  Keyboard as KeyboardIcon,
  Palette as PaletteIcon,
  Assessment as AssessmentIcon,
  GetApp as DownloadIcon,
  Refresh as RefreshIcon,
  Help as HelpIcon
} from '@mui/icons-material';

import AccessibilityAuditor, { AccessibilityAuditResult } from './AccessibilityAuditor';
import AccessibilityTestRunner from './AccessibilityTestRunner';
import ColorContrastAnalyzer, { ContrastResult, ColorPalette } from './ColorContrastAnalyzer';

interface AccessibilityDashboardProps {
  chartElements: HTMLElement[];
  chartTypes: string[];
  onRecommendationApply?: (recommendation: string, chartId: string) => void;
  onExportReport?: (format: 'json' | 'html' | 'csv') => void;
}

interface ComplianceScore {
  overall: number;
  colorContrast: number;
  keyboardNavigation: number;
  screenReader: number;
  wcagCompliance: number;
}

interface ComplianceIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'color-contrast' | 'keyboard' | 'aria' | 'focus' | 'motion';
  description: string;
  recommendation: string;
  wcagCriterion: string;
  affectedElements: number;
  chartId?: string;
}

const AccessibilityDashboard: React.FC<AccessibilityDashboardProps> = ({
  chartElements,
  chartTypes,
  onRecommendationApply,
  onExportReport
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [auditResults, setAuditResults] = useState<AccessibilityAuditResult[]>([]);
  const [complianceScore, setComplianceScore] = useState<ComplianceScore>({
    overall: 0,
    colorContrast: 0,
    keyboardNavigation: 0,
    screenReader: 0,
    wcagCompliance: 0
  });
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [selectedChart, setSelectedChart] = useState<HTMLElement | null>(null);
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [colorAnalysis, setColorAnalysis] = useState<Map<string, ContrastResult[]>>(new Map());

  const auditorRef = useRef(new AccessibilityAuditor());

  useEffect(() => {
    if (chartElements.length > 0) {
      runComprehensiveAudit();
    }
  }, [chartElements]);

  const runComprehensiveAudit = async () => {
    setIsRunningAudit(true);
    
    try {
      const results: AccessibilityAuditResult[] = [];
      const allIssues: ComplianceIssue[] = [];
      const colorResults = new Map<string, ContrastResult[]>();
      
      for (let i = 0; i < chartElements.length; i++) {
        const element = chartElements[i];
        const chartType = chartTypes[i] || 'Unknown';
        const chartId = element.id || `chart-${i}`;
        
        // Run accessibility audit
        const auditResult = await auditorRef.current.auditChart(element, chartType);
        results.push(auditResult);
        
        // Analyze color contrast
        const contrastResults = analyzeChartColors(element);
        colorResults.set(chartId, contrastResults);
        
        // Convert audit results to issues
        const chartIssues = convertAuditToIssues(auditResult, chartId);
        allIssues.push(...chartIssues);
      }
      
      setAuditResults(results);
      setIssues(allIssues);
      setColorAnalysis(colorResults);
      
      // Calculate overall compliance score
      const scores = calculateComplianceScores(results, allIssues);
      setComplianceScore(scores);
      
    } catch (error) {
      console.error('Audit failed:', error);
    } finally {
      setIsRunningAudit(false);
    }
  };

  const analyzeChartColors = (element: HTMLElement): ContrastResult[] => {
    const results: ContrastResult[] = [];
    const backgroundColor = getElementBackgroundColor(element);
    
    // Find all colored elements in the chart
    const coloredElements = element.querySelectorAll('[fill], [stroke], [color], .colored');
    
    coloredElements.forEach(el => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      
      const fill = htmlEl.getAttribute('fill') || style.fill;
      const stroke = htmlEl.getAttribute('stroke') || style.stroke;
      const color = style.color;
      
      [fill, stroke, color].forEach(colorValue => {
        if (colorValue && colorValue !== 'none' && colorValue !== 'transparent') {
          const result = ColorContrastAnalyzer.analyzeContrast(colorValue, backgroundColor);
          if (!result.passes.normalAA) {
            results.push(result);
          }
        }
      });
    });
    
    return results;
  };

  const convertAuditToIssues = (auditResult: AccessibilityAuditResult, chartId: string): ComplianceIssue[] => {
    const issues: ComplianceIssue[] = [];
    
    // Convert violations to issues
    auditResult.violations.forEach(violation => {
      issues.push({
        id: `${chartId}-${violation.id}`,
        severity: violation.impact as any,
        category: categorizeViolation(violation.id),
        description: violation.description,
        recommendation: `Fix ${violation.id}: ${violation.description}`,
        wcagCriterion: getWCAGCriterion(violation.id),
        affectedElements: violation.nodes.length,
        chartId
      });
    });
    
    // Convert test failures to issues
    auditResult.colorContrastTests.forEach(test => {
      if (!test.passes) {
        issues.push({
          id: `${chartId}-contrast-${Date.now()}`,
          severity: 'high',
          category: 'color-contrast',
          description: `Color contrast ratio ${test.ratio.toFixed(2)} below WCAG ${test.level} requirement`,
          recommendation: `Adjust colors to meet ${test.size === 'large' ? '3:1' : '4.5:1'} contrast ratio`,
          wcagCriterion: '1.4.3',
          affectedElements: 1,
          chartId
        });
      }
    });
    
    auditResult.keyboardTests.forEach(test => {
      if (!test.passes) {
        issues.push({
          id: `${chartId}-keyboard-${Date.now()}`,
          severity: 'critical',
          category: 'keyboard',
          description: `Element ${test.element} lacks keyboard accessibility`,
          recommendation: 'Add tabindex, aria-label, and keyboard event handlers',
          wcagCriterion: '2.1.1',
          affectedElements: 1,
          chartId
        });
      }
    });
    
    auditResult.ariaTests.forEach(test => {
      if (!test.passes) {
        issues.push({
          id: `${chartId}-aria-${Date.now()}`,
          severity: 'high',
          category: 'aria',
          description: `Element ${test.element} has ARIA implementation issues`,
          recommendation: 'Add proper ARIA roles, labels, and descriptions',
          wcagCriterion: '4.1.2',
          affectedElements: 1,
          chartId
        });
      }
    });
    
    return issues;
  };

  const calculateComplianceScores = (
    results: AccessibilityAuditResult[], 
    issues: ComplianceIssue[]
  ): ComplianceScore => {
    if (results.length === 0) {
      return { overall: 0, colorContrast: 0, keyboardNavigation: 0, screenReader: 0, wcagCompliance: 0 };
    }
    
    const avgOverall = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    
    const colorIssues = issues.filter(i => i.category === 'color-contrast');
    const keyboardIssues = issues.filter(i => i.category === 'keyboard');
    const ariaIssues = issues.filter(i => i.category === 'aria');
    
    const colorScore = Math.max(0, 100 - (colorIssues.length * 10));
    const keyboardScore = Math.max(0, 100 - (keyboardIssues.length * 15));
    const screenReaderScore = Math.max(0, 100 - (ariaIssues.length * 12));
    
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const wcagScore = Math.max(0, 100 - (criticalIssues * 20));
    
    return {
      overall: Math.round(avgOverall),
      colorContrast: Math.round(colorScore),
      keyboardNavigation: Math.round(keyboardScore),
      screenReader: Math.round(screenReaderScore),
      wcagCompliance: Math.round(wcagScore)
    };
  };

  const getScoreColor = (score: number): 'success' | 'warning' | 'error' => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <ErrorIcon color="error" />;
      case 'high': return <ErrorIcon color="warning" />;
      case 'medium': return <WarningIcon color="warning" />;
      case 'low': return <InfoIcon color="info" />;
      default: return <InfoIcon />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'color-contrast': return <PaletteIcon />;
      case 'keyboard': return <KeyboardIcon />;
      case 'aria': return <VolumeUpIcon />;
      case 'focus': return <VisibilityIcon />;
      default: return <InfoIcon />;
    }
  };

  const handleApplyRecommendation = (issue: ComplianceIssue) => {
    if (onRecommendationApply && issue.chartId) {
      onRecommendationApply(issue.recommendation, issue.chartId);
    }
  };

  const handleExportReport = (format: 'json' | 'html' | 'csv') => {
    if (onExportReport) {
      onExportReport(format);
    } else if (auditResults.length > 0) {
      // Export the first audit result as example
      auditorRef.current.exportResults(auditResults[0], format);
    }
  };

  const renderOverviewTab = () => (
    <Grid container spacing={3}>
      {/* Overall Score Card */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Overall Accessibility Score
            </Typography>
            <Box display="flex" alignItems="center" mb={2}>
              <Typography variant="h2" color={getScoreColor(complianceScore.overall)}>
                {complianceScore.overall}
              </Typography>
              <Typography variant="h4" color="text.secondary" ml={1}>
                /100
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={complianceScore.overall}
              color={getScoreColor(complianceScore.overall)}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Quick Stats */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Compliance Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Charts Audited
                </Typography>
                <Typography variant="h6">
                  {auditResults.length}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Total Issues
                </Typography>
                <Typography variant="h6">
                  {issues.length}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  Critical Issues
                </Typography>
                <Typography variant="h6" color="error">
                  {issues.filter(i => i.severity === 'critical').length}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">
                  WCAG Compliant
                </Typography>
                <Typography variant="h6" color={getScoreColor(complianceScore.wcagCompliance)}>
                  {complianceScore.wcagCompliance}%
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Category Scores */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Category Breakdown
            </Typography>
            <Grid container spacing={2}>
              {[
                { label: 'Color Contrast', score: complianceScore.colorContrast, icon: <PaletteIcon /> },
                { label: 'Keyboard Navigation', score: complianceScore.keyboardNavigation, icon: <KeyboardIcon /> },
                { label: 'Screen Reader', score: complianceScore.screenReader, icon: <VolumeUpIcon /> },
                { label: 'WCAG Compliance', score: complianceScore.wcagCompliance, icon: <AssessmentIcon /> }
              ].map((category) => (
                <Grid item xs={12} sm={6} md={3} key={category.label}>
                  <Box textAlign="center">
                    <Box mb={1}>
                      {category.icon}
                    </Box>
                    <Typography variant="h6" color={getScoreColor(category.score)}>
                      {category.score}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {category.label}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={category.score}
                      color={getScoreColor(category.score)}
                      sx={{ mt: 1, height: 4, borderRadius: 2 }}
                    />
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Issues */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Critical Issues Requiring Attention
            </Typography>
            {issues.filter(i => i.severity === 'critical' || i.severity === 'high').slice(0, 5).map((issue) => (
              <Alert
                key={issue.id}
                severity={issue.severity === 'critical' ? 'error' : 'warning'}
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => handleApplyRecommendation(issue)}
                  >
                    Fix
                  </Button>
                }
                sx={{ mb: 1 }}
              >
                <AlertTitle>{issue.description}</AlertTitle>
                {issue.recommendation}
              </Alert>
            ))}
            {issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0 && (
              <Typography color="text.secondary">
                No critical issues found. Great job!
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderIssuesTab = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Severity</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>WCAG Criterion</TableCell>
            <TableCell>Affected Elements</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {issues.map((issue) => (
            <TableRow key={issue.id}>
              <TableCell>
                <Chip
                  icon={getSeverityIcon(issue.severity)}
                  label={issue.severity}
                  color={issue.severity === 'critical' ? 'error' : 
                         issue.severity === 'high' ? 'warning' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell>
                <Box display="flex" alignItems="center">
                  {getCategoryIcon(issue.category)}
                  <Typography variant="body2" ml={1}>
                    {issue.category}
                  </Typography>
                </Box>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {issue.description}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {issue.recommendation}
                </Typography>
              </TableCell>
              <TableCell>
                <Chip label={issue.wcagCriterion} size="small" variant="outlined" />
              </TableCell>
              <TableCell>{issue.affectedElements}</TableCell>
              <TableCell>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleApplyRecommendation(issue)}
                >
                  Apply Fix
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderColorAnalysisTab = () => (
    <Grid container spacing={3}>
      {Array.from(colorAnalysis.entries()).map(([chartId, results]) => (
        <Grid item xs={12} key={chartId}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Color Contrast Analysis - {chartId}
              </Typography>
              {results.length === 0 ? (
                <Typography color="success.main">
                  All colors meet WCAG AA contrast requirements
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Foreground</TableCell>
                        <TableCell>Background</TableCell>
                        <TableCell>Ratio</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Recommendation</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((result, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Box
                                width={20}
                                height={20}
                                bgcolor={result.foreground}
                                mr={1}
                                border="1px solid #ccc"
                              />
                              {result.hex.foreground}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center">
                              <Box
                                width={20}
                                height={20}
                                bgcolor={result.background}
                                mr={1}
                                border="1px solid #ccc"
                              />
                              {result.hex.background}
                            </Box>
                          </TableCell>
                          <TableCell>{result.ratio.toFixed(2)}:1</TableCell>
                          <TableCell>
                            <Chip
                              label={result.level}
                              color={result.level === 'fail' ? 'error' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              Increase contrast ratio to at least 4.5:1
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  const renderTestingTab = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Accessibility Testing Tools
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Run comprehensive accessibility tests on your charts
            </Typography>
            
            <Box display="flex" gap={2} mb={3}>
              <Button
                variant="contained"
                startIcon={<AssessmentIcon />}
                onClick={() => setShowTestRunner(true)}
              >
                Run Test Suite
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={runComprehensiveAudit}
                disabled={isRunningAudit}
              >
                {isRunningAudit ? 'Running...' : 'Re-run Audit'}
              </Button>
            </Box>

            {isRunningAudit && (
              <Box mb={2}>
                <Typography variant="body2" gutterBottom>
                  Running accessibility audit...
                </Typography>
                <LinearProgress />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Manual Testing Checklist
            </Typography>
            <List>
              {[
                'Test navigation with Tab key only',
                'Test screen reader compatibility (NVDA, JAWS, VoiceOver)',
                'Verify chart functionality at 200% zoom level',
                'Test in high contrast mode',
                'Verify keyboard shortcuts work correctly',
                'Test with different color vision simulations'
              ].map((item, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    <InfoIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Accessibility Compliance Dashboard
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Export report">
            <IconButton onClick={() => handleExportReport('html')}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Help">
            <IconButton onClick={() => setShowHelpDialog(true)}>
              <HelpIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Box mb={3}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab
            label={
              <Badge badgeContent={issues.filter(i => i.severity === 'critical').length} color="error">
                Overview
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={issues.length} color="error">
                Issues
              </Badge>
            }
          />
          <Tab label="Color Analysis" />
          <Tab label="Testing" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 && renderOverviewTab()}
      {activeTab === 1 && renderIssuesTab()}
      {activeTab === 2 && renderColorAnalysisTab()}
      {activeTab === 3 && renderTestingTab()}

      {/* Test Runner Dialog */}
      <Dialog
        open={showTestRunner}
        onClose={() => setShowTestRunner(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Accessibility Test Runner</DialogTitle>
        <DialogContent>
          <AccessibilityTestRunner
            targetElement={selectedChart || chartElements[0]}
            chartType={chartTypes[0] || 'Chart'}
            onTestComplete={() => setShowTestRunner(false)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTestRunner(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onClose={() => setShowHelpDialog(false)}>
        <DialogTitle>Accessibility Compliance Help</DialogTitle>
        <DialogContent>
          <Typography variant="h6" gutterBottom>
            WCAG 2.1 AA Compliance
          </Typography>
          <Typography variant="body2" paragraph>
            This dashboard helps ensure your charts meet Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards.
          </Typography>
          
          <Typography variant="h6" gutterBottom>
            Key Areas
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><PaletteIcon /></ListItemIcon>
              <ListItemText
                primary="Color Contrast"
                secondary="Text must have 4.5:1 contrast ratio (3:1 for large text)"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><KeyboardIcon /></ListItemIcon>
              <ListItemText
                primary="Keyboard Navigation"
                secondary="All functionality must be available via keyboard"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><VolumeUpIcon /></ListItemIcon>
              <ListItemText
                primary="Screen Reader Support"
                secondary="Proper ARIA labels and semantic markup required"
              />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHelpDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// Helper functions
function getElementBackgroundColor(element: HTMLElement): string {
  let el: HTMLElement | null = element;
  
  while (el && el !== document.body) {
    const style = window.getComputedStyle(el);
    const bgColor = style.backgroundColor;
    
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      return bgColor;
    }
    
    el = el.parentElement;
  }
  
  return '#ffffff';
}

function categorizeViolation(violationId: string): ComplianceIssue['category'] {
  if (violationId.includes('color') || violationId.includes('contrast')) return 'color-contrast';
  if (violationId.includes('keyboard') || violationId.includes('tabindex')) return 'keyboard';
  if (violationId.includes('aria') || violationId.includes('label')) return 'aria';
  if (violationId.includes('focus')) return 'focus';
  return 'aria';
}

function getWCAGCriterion(violationId: string): string {
  const criterionMap: Record<string, string> = {
    'color-contrast': '1.4.3',
    'keyboard': '2.1.1',
    'aria-label': '4.1.2',
    'focus-order': '2.4.3',
    'heading-order': '1.3.1'
  };
  
  return criterionMap[violationId] || '4.1.2';
}

export default AccessibilityDashboard;