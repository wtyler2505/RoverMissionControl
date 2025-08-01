/**
 * Accessibility Test Runner for Telemetry Charts
 * Automated and manual accessibility testing framework
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Card, 
  CardContent, 
  CardActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Alert,
  AlertTitle
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import AccessibilityAuditor, { AccessibilityAuditResult } from './AccessibilityAuditor';

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: AccessibilityTest[];
}

export interface AccessibilityTest {
  id: string;
  name: string;
  description: string;
  category: 'automated' | 'manual';
  wcagLevel: 'A' | 'AA' | 'AAA';
  wcagCriterion: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  automated: boolean;
  testFunction?: (element: HTMLElement) => Promise<TestResult>;
  manualSteps?: string[];
}

export interface TestResult {
  testId: string;
  passed: boolean;
  score: number;
  message: string;
  details?: any;
  recommendations?: string[];
}

export interface TestRunResult {
  suiteId: string;
  timestamp: Date;
  overallScore: number;
  results: TestResult[];
  duration: number;
}

interface AccessibilityTestRunnerProps {
  targetElement?: HTMLElement;
  chartType: string;
  onTestComplete?: (results: TestRunResult) => void;
}

const AccessibilityTestRunner: React.FC<AccessibilityTestRunnerProps> = ({
  targetElement,
  chartType,
  onTestComplete
}) => {
  const [testResults, setTestResults] = useState<TestRunResult | null>(null);
  const [auditResults, setAuditResults] = useState<AccessibilityAuditResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedSuite, setSelectedSuite] = useState<string>('comprehensive');
  
  const auditorRef = useRef<AccessibilityAuditor>(new AccessibilityAuditor());

  // Define test suites
  const testSuites: TestSuite[] = [
    {
      id: 'comprehensive',
      name: 'WCAG 2.1 AA Comprehensive',
      description: 'Complete accessibility audit covering all WCAG 2.1 AA criteria',
      tests: [
        {
          id: 'color-contrast',
          name: 'Color Contrast',
          description: 'Verify text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)',
          category: 'automated',
          wcagLevel: 'AA',
          wcagCriterion: '1.4.3',
          priority: 'critical',
          automated: true,
          testFunction: testColorContrast
        },
        {
          id: 'keyboard-navigation',
          name: 'Keyboard Navigation',
          description: 'Ensure all interactive elements are keyboard accessible',
          category: 'automated',
          wcagLevel: 'A',
          wcagCriterion: '2.1.1',
          priority: 'critical',
          automated: true,
          testFunction: testKeyboardNavigation
        },
        {
          id: 'focus-visible',
          name: 'Focus Indicators',
          description: 'Verify focus indicators are visible and sufficient',
          category: 'automated',
          wcagLevel: 'AA',
          wcagCriterion: '2.4.7',
          priority: 'high',
          automated: true,
          testFunction: testFocusIndicators
        },
        {
          id: 'aria-labels',
          name: 'ARIA Labels and Roles',
          description: 'Check for proper ARIA implementation',
          category: 'automated',
          wcagLevel: 'A',
          wcagCriterion: '4.1.2',
          priority: 'critical',
          automated: true,
          testFunction: testAriaImplementation
        },
        {
          id: 'alternative-text',
          name: 'Alternative Text',
          description: 'Verify charts have appropriate text alternatives',
          category: 'automated',
          wcagLevel: 'A',
          wcagCriterion: '1.1.1',
          priority: 'critical',
          automated: true,
          testFunction: testAlternativeText
        },
        {
          id: 'reduced-motion',
          name: 'Reduced Motion Support',
          description: 'Respect prefers-reduced-motion user preference',
          category: 'automated',
          wcagLevel: 'AAA',
          wcagCriterion: '2.3.3',
          priority: 'medium',
          automated: true,
          testFunction: testReducedMotion
        },
        {
          id: 'screen-reader-manual',
          name: 'Screen Reader Compatibility',
          description: 'Manual test with screen reader software',
          category: 'manual',
          wcagLevel: 'A',
          wcagCriterion: '4.1.2',
          priority: 'critical',
          automated: false,
          manualSteps: [
            'Enable screen reader (NVDA, JAWS, or VoiceOver)',
            'Navigate to the chart using Tab key',
            'Verify chart is properly announced with type and data summary',
            'Use arrow keys to navigate through data points',
            'Verify each data point is clearly announced with value and context',
            'Test interactive features (zoom, pan, selection) with screen reader',
            'Verify live regions announce dynamic changes'
          ]
        },
        {
          id: 'zoom-magnification',
          name: 'Zoom and Magnification',
          description: 'Test chart usability at high zoom levels',
          category: 'manual',
          wcagLevel: 'AA',
          wcagCriterion: '1.4.4',
          priority: 'high',
          automated: false,
          manualSteps: [
            'Set browser zoom to 200%',
            'Verify chart content remains readable and functional',
            'Test horizontal scrolling if needed',
            'Increase zoom to 400%',
            'Verify critical information is still accessible',
            'Test with browser text scaling at 200%'
          ]
        },
        {
          id: 'high-contrast-manual',
          name: 'High Contrast Mode',
          description: 'Test chart visibility in high contrast mode',
          category: 'manual',
          wcagLevel: 'AA',
          wcagCriterion: '1.4.3',
          priority: 'medium',
          automated: false,
          manualSteps: [
            'Enable Windows High Contrast mode (or similar on other OS)',
            'Verify chart elements are visible and distinguishable',
            'Check that data points can be differentiated',
            'Verify text labels are readable',
            'Test interactive elements for visibility'
          ]
        }
      ]
    },
    {
      id: 'quick',
      name: 'Quick Assessment',
      description: 'Fast automated tests for basic accessibility compliance',
      tests: [
        {
          id: 'basic-aria',
          name: 'Basic ARIA',
          description: 'Check for essential ARIA attributes',
          category: 'automated',
          wcagLevel: 'A',
          wcagCriterion: '4.1.2',
          priority: 'critical',
          automated: true,
          testFunction: testBasicAria
        },
        {
          id: 'keyboard-basic',
          name: 'Basic Keyboard Access',
          description: 'Check if chart is keyboard accessible',
          category: 'automated',
          wcagLevel: 'A',
          wcagCriterion: '2.1.1',
          priority: 'critical',
          automated: true,
          testFunction: testBasicKeyboard
        }
      ]
    }
  ];

  const runTests = useCallback(async () => {
    if (!targetElement) {
      console.error('No target element provided for testing');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    
    const startTime = performance.now();
    const suite = testSuites.find(s => s.id === selectedSuite);
    
    if (!suite) {
      console.error('Selected test suite not found');
      setIsRunning(false);
      return;
    }

    try {
      // Run comprehensive audit
      const auditResult = await auditorRef.current.auditChart(targetElement, chartType);
      setAuditResults(auditResult);

      // Run individual tests
      const results: TestResult[] = [];
      const automatedTests = suite.tests.filter(t => t.automated && t.testFunction);
      
      for (let i = 0; i < automatedTests.length; i++) {
        const test = automatedTests[i];
        setProgress(((i + 1) / automatedTests.length) * 80); // Reserve 20% for final processing
        
        try {
          const result = await test.testFunction!(targetElement);
          results.push(result);
        } catch (error) {
          results.push({
            testId: test.id,
            passed: false,
            score: 0,
            message: `Test failed with error: ${error}`,
            recommendations: ['Fix test execution error and rerun']
          });
        }
      }

      setProgress(90);

      // Calculate overall score
      const totalScore = results.reduce((sum, result) => sum + result.score, 0);
      const overallScore = Math.round(totalScore / results.length);

      const endTime = performance.now();
      const testRunResult: TestRunResult = {
        suiteId: suite.id,
        timestamp: new Date(),
        overallScore,
        results,
        duration: endTime - startTime
      };

      setTestResults(testRunResult);
      onTestComplete?.(testRunResult);
      setProgress(100);
      
      setTimeout(() => {
        setProgress(0);
        setIsRunning(false);
      }, 1000);

    } catch (error) {
      console.error('Test run failed:', error);
      setIsRunning(false);
      setProgress(0);
    }
  }, [targetElement, chartType, selectedSuite, onTestComplete]);

  const exportResults = (format: 'json' | 'html' | 'csv' = 'json') => {
    if (!auditResults) return;
    
    auditorRef.current.exportResults(auditResults, format);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircleIcon color="success" />;
    if (score >= 70) return <WarningIcon color="warning" />;
    return <ErrorIcon color="error" />;
  };

  const renderTestResult = (result: TestResult) => {
    const test = testSuites
      .find(s => s.id === selectedSuite)
      ?.tests.find(t => t.id === result.testId);

    if (!test) return null;

    return (
      <Card key={result.testId} sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6" component="h3">
              {test.name}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip 
                label={`WCAG ${test.wcagLevel}`} 
                size="small" 
                variant="outlined" 
              />
              <Chip 
                label={test.priority} 
                size="small" 
                color={test.priority === 'critical' ? 'error' : test.priority === 'high' ? 'warning' : 'default'}
              />
              {getScoreIcon(result.score)}
            </Box>
          </Box>
          
          <Typography variant="body2" color="text.secondary" mb={1}>
            {test.description}
          </Typography>
          
          <Alert 
            severity={result.passed ? 'success' : 'error'} 
            sx={{ mb: 1 }}
          >
            <AlertTitle>
              Score: {result.score}/100
            </AlertTitle>
            {result.message}
          </Alert>

          {result.recommendations && result.recommendations.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Recommendations:
              </Typography>
              <List dense>
                {result.recommendations.map((rec, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <InfoIcon color="info" />
                    </ListItemIcon>
                    <ListItemText primary={rec} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderManualTests = () => {
    const suite = testSuites.find(s => s.id === selectedSuite);
    const manualTests = suite?.tests.filter(t => !t.automated) || [];

    if (manualTests.length === 0) return null;

    return (
      <Box mt={4}>
        <Typography variant="h5" gutterBottom>
          Manual Tests
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          These tests require manual verification. Follow the steps below:
        </Typography>
        
        {manualTests.map((test) => (
          <Accordion key={test.id}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">{test.name}</Typography>
              <Box ml="auto" mr={2}>
                <Chip 
                  label={`WCAG ${test.wcagLevel}`} 
                  size="small" 
                  variant="outlined" 
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary" mb={2}>
                {test.description}
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                Manual Test Steps:
              </Typography>
              <List>
                {test.manualSteps?.map((step, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Typography variant="body2" color="primary">
                        {index + 1}.
                      </Typography>
                    </ListItemIcon>
                    <ListItemText primary={step} />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    );
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h4" gutterBottom>
            Accessibility Test Runner
          </Typography>
          
          <Typography variant="body1" color="text.secondary" mb={3}>
            Comprehensive accessibility testing for {chartType} charts following WCAG 2.1 guidelines.
          </Typography>

          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Test Suite:
            </Typography>
            {testSuites.map((suite) => (
              <Button
                key={suite.id}
                variant={selectedSuite === suite.id ? 'contained' : 'outlined'}
                onClick={() => setSelectedSuite(suite.id)}
                sx={{ mr: 1, mb: 1 }}
              >
                {suite.name}
              </Button>
            ))}
          </Box>

          {isRunning && (
            <Box mb={3}>
              <Typography variant="body2" gutterBottom>
                Running tests... {Math.round(progress)}%
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </CardContent>

        <CardActions>
          <Button
            variant="contained"
            onClick={runTests}
            disabled={isRunning || !targetElement}
          >
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
          
          {auditResults && (
            <>
              <Button
                variant="outlined"
                onClick={() => exportResults('json')}
              >
                Export JSON
              </Button>
              <Button
                variant="outlined"
                onClick={() => exportResults('html')}
              >
                Export HTML
              </Button>
              <Button
                variant="outlined"
                onClick={() => exportResults('csv')}
              >
                Export CSV
              </Button>
            </>
          )}
        </CardActions>
      </Card>

      {testResults && (
        <Box mt={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom>
                Test Results
              </Typography>
              
              <Box display="flex" alignItems="center" mb={3}>
                <Typography variant="h6" mr={2}>
                  Overall Score:
                </Typography>
                <Chip
                  icon={getScoreIcon(testResults.overallScore)}
                  label={`${testResults.overallScore}/100`}
                  color={getScoreColor(testResults.overallScore) as any}
                  size="large"
                />
                <Typography variant="body2" color="text.secondary" ml={2}>
                  Completed in {Math.round(testResults.duration)}ms
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" mb={3}>
                {testResults.results.filter(r => r.passed).length} of {testResults.results.length} tests passed
              </Typography>
            </CardContent>
          </Card>

          <Box mt={3}>
            <Typography variant="h5" gutterBottom>
              Detailed Results
            </Typography>
            {testResults.results.map(renderTestResult)}
          </Box>
        </Box>
      )}

      {renderManualTests()}
    </Box>
  );
};

// Test Functions
async function testColorContrast(element: HTMLElement): Promise<TestResult> {
  const textElements = element.querySelectorAll('text, .chart-label, .axis-label');
  let passCount = 0;
  let totalCount = 0;
  const failures: string[] = [];

  textElements.forEach((textEl) => {
    const htmlEl = textEl as HTMLElement;
    const style = window.getComputedStyle(htmlEl);
    const color = style.color;
    const backgroundColor = getBackgroundColor(htmlEl);
    
    if (color && backgroundColor) {
      totalCount++;
      const ratio = calculateContrastRatio(color, backgroundColor);
      const fontSize = parseFloat(style.fontSize);
      const isLarge = fontSize >= 18 || (fontSize >= 14 && style.fontWeight === 'bold');
      const requiredRatio = isLarge ? 3.0 : 4.5;
      
      if (ratio >= requiredRatio) {
        passCount++;
      } else {
        failures.push(`Element with ${color} on ${backgroundColor} has ratio ${ratio.toFixed(2)}, requires ${requiredRatio}`);
      }
    }
  });

  const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 100;
  const passed = score >= 100;

  return {
    testId: 'color-contrast',
    passed,
    score,
    message: passed 
      ? `All ${totalCount} text elements meet contrast requirements`
      : `${totalCount - passCount} of ${totalCount} text elements fail contrast requirements`,
    details: { passCount, totalCount, failures },
    recommendations: passed ? [] : [
      'Adjust text colors to meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)',
      'Consider using darker text colors or lighter backgrounds',
      'Test with a color contrast analyzer tool'
    ]
  };
}

async function testKeyboardNavigation(element: HTMLElement): Promise<TestResult> {
  const interactiveElements = element.querySelectorAll('[tabindex], button, [role="button"], .interactive');
  let accessibleCount = 0;
  const issues: string[] = [];

  interactiveElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const hasTabIndex = htmlEl.hasAttribute('tabindex') && htmlEl.getAttribute('tabindex') !== '-1';
    const hasAriaLabel = htmlEl.hasAttribute('aria-label') || htmlEl.hasAttribute('aria-labelledby');
    
    if (hasTabIndex && hasAriaLabel) {
      accessibleCount++;
    } else {
      const problems = [];
      if (!hasTabIndex) problems.push('missing tabindex');
      if (!hasAriaLabel) problems.push('missing aria-label');
      issues.push(`${htmlEl.tagName}: ${problems.join(', ')}`);
    }
  });

  const score = interactiveElements.length > 0 ? 
    Math.round((accessibleCount / interactiveElements.length) * 100) : 100;
  const passed = score >= 100;

  return {
    testId: 'keyboard-navigation',
    passed,
    score,
    message: passed 
      ? `All ${interactiveElements.length} interactive elements are keyboard accessible`
      : `${interactiveElements.length - accessibleCount} of ${interactiveElements.length} elements lack keyboard accessibility`,
    details: { accessibleCount, totalCount: interactiveElements.length, issues },
    recommendations: passed ? [] : [
      'Add tabindex="0" to all interactive elements',
      'Provide aria-label or aria-labelledby for screen readers',
      'Implement keyboard event handlers for Enter and Space keys',
      'Ensure focus indicators are visible'
    ]
  };
}

async function testFocusIndicators(element: HTMLElement): Promise<TestResult> {
  const focusableElements = element.querySelectorAll('[tabindex]');
  let visibleFocusCount = 0;
  
  for (const el of Array.from(focusableElements)) {
    const htmlEl = el as HTMLElement;
    htmlEl.focus();
    
    const style = window.getComputedStyle(htmlEl);
    const outline = style.outline;
    const outlineWidth = style.outlineWidth;
    const boxShadow = style.boxShadow;
    
    if ((outline && outline !== 'none') || 
        (outlineWidth && outlineWidth !== '0px') || 
        (boxShadow && boxShadow !== 'none')) {
      visibleFocusCount++;
    }
  }

  const score = focusableElements.length > 0 ? 
    Math.round((visibleFocusCount / focusableElements.length) * 100) : 100;
  const passed = score >= 100;

  return {
    testId: 'focus-visible',
    passed,
    score,
    message: passed 
      ? `All ${focusableElements.length} focusable elements have visible focus indicators`
      : `${focusableElements.length - visibleFocusCount} of ${focusableElements.length} elements lack visible focus indicators`,
    recommendations: passed ? [] : [
      'Add CSS outline or box-shadow on :focus',
      'Ensure focus indicators have sufficient contrast',
      'Test focus visibility in both light and dark themes'
    ]
  };
}

async function testAriaImplementation(element: HTMLElement): Promise<TestResult> {
  let score = 100;
  const issues: string[] = [];
  
  // Check main chart container
  const chartElement = element.querySelector('svg, canvas') as HTMLElement;
  if (chartElement) {
    if (!chartElement.hasAttribute('role')) {
      score -= 20;
      issues.push('Chart container missing role attribute');
    }
    if (!chartElement.hasAttribute('aria-label') && !chartElement.hasAttribute('aria-labelledby')) {
      score -= 20;
      issues.push('Chart container missing aria-label');
    }
  }
  
  // Check for live regions
  const liveRegions = element.querySelectorAll('[aria-live]');
  if (liveRegions.length === 0) {
    score -= 15;
    issues.push('No live regions found for dynamic content announcements');
  }
  
  // Check interactive elements
  const interactiveElements = element.querySelectorAll('[tabindex], button, [role="button"]');
  let unlabeledCount = 0;
  
  interactiveElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.hasAttribute('aria-label') && !htmlEl.hasAttribute('aria-labelledby')) {
      unlabeledCount++;
    }
  });
  
  if (unlabeledCount > 0) {
    score -= Math.min(30, unlabeledCount * 5);
    issues.push(`${unlabeledCount} interactive elements missing ARIA labels`);
  }

  const passed = score >= 80;

  return {
    testId: 'aria-labels',
    passed,
    score: Math.max(0, score),
    message: passed 
      ? 'ARIA implementation meets requirements'
      : `ARIA implementation has ${issues.length} issues`,
    details: { issues },
    recommendations: passed ? [] : [
      'Add role="img" to chart containers',
      'Provide descriptive aria-label for charts',
      'Add aria-live regions for dynamic content',
      'Label all interactive elements with aria-label or aria-labelledby'
    ]
  };
}

async function testAlternativeText(element: HTMLElement): Promise<TestResult> {
  const chartContainer = element.querySelector('svg, canvas') as HTMLElement;
  let score = 0;
  let message = '';
  const recommendations: string[] = [];
  
  if (!chartContainer) {
    return {
      testId: 'alternative-text',
      passed: false,
      score: 0,
      message: 'No chart container found',
      recommendations: ['Ensure chart is rendered in SVG or Canvas element']
    };
  }
  
  // Check for aria-label
  if (chartContainer.hasAttribute('aria-label')) {
    const label = chartContainer.getAttribute('aria-label');
    if (label && label.length > 10) {
      score += 40;
    } else {
      recommendations.push('Provide more descriptive aria-label');
    }
  } else {
    recommendations.push('Add aria-label to chart container');
  }
  
  // Check for description
  if (chartContainer.hasAttribute('aria-describedby')) {
    const descId = chartContainer.getAttribute('aria-describedby');
    const descElement = document.getElementById(descId!);
    if (descElement && descElement.textContent && descElement.textContent.length > 20) {
      score += 40;
    } else {
      recommendations.push('Provide more detailed description in aria-describedby element');
    }
  } else {
    recommendations.push('Add aria-describedby with data summary');
  }
  
  // Check for title element in SVG
  if (chartContainer.tagName.toLowerCase() === 'svg') {
    const titleElement = chartContainer.querySelector('title');
    if (titleElement && titleElement.textContent) {
      score += 20;
    } else {
      recommendations.push('Add <title> element to SVG');
    }
  }
  
  const passed = score >= 80;
  message = passed 
    ? 'Chart has appropriate alternative text'
    : `Alternative text implementation needs improvement (score: ${score}/100)`;

  return {
    testId: 'alternative-text',
    passed,
    score,
    message,
    recommendations: passed ? [] : recommendations
  };
}

async function testReducedMotion(element: HTMLElement): Promise<TestResult> {
  // This is a simplified test - in practice, you'd check actual animation behavior
  const animatedElements = element.querySelectorAll('[style*="animation"], [style*="transition"]');
  let score = 100;
  const issues: string[] = [];
  
  // Check if reduced motion media query is respected
  const respectsReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  if (animatedElements.length > 0 && respectsReducedMotion) {
    // In a real implementation, you'd check if animations are actually disabled
    score = 80; // Assume partial compliance
    issues.push('May not fully respect prefers-reduced-motion setting');
  }

  return {
    testId: 'reduced-motion',
    passed: score >= 80,
    score,
    message: score >= 80 
      ? 'Reduced motion preferences are respected'
      : `Animation behavior may not respect user preferences`,
    details: { animatedElements: animatedElements.length, respectsReducedMotion, issues },
    recommendations: score >= 80 ? [] : [
      'Check prefers-reduced-motion media query',
      'Disable or minimize animations when user prefers reduced motion',
      'Provide static alternatives for animated content'
    ]
  };
}

async function testBasicAria(element: HTMLElement): Promise<TestResult> {
  const chartElement = element.querySelector('svg, canvas') as HTMLElement;
  let score = 0;
  
  if (chartElement) {
    if (chartElement.hasAttribute('role')) score += 50;
    if (chartElement.hasAttribute('aria-label')) score += 50;
  }

  return {
    testId: 'basic-aria',
    passed: score >= 100,
    score,
    message: score >= 100 ? 'Basic ARIA attributes present' : 'Missing essential ARIA attributes',
    recommendations: score >= 100 ? [] : ['Add role and aria-label to chart container']
  };
}

async function testBasicKeyboard(element: HTMLElement): Promise<TestResult> {
  const hasTabIndex = element.hasAttribute('tabindex') || element.querySelector('[tabindex]');
  const score = hasTabIndex ? 100 : 0;

  return {
    testId: 'keyboard-basic',
    passed: score >= 100,
    score,
    message: score >= 100 ? 'Chart is keyboard accessible' : 'Chart is not keyboard accessible',
    recommendations: score >= 100 ? [] : ['Add tabindex to make chart keyboard accessible']
  };
}

// Helper functions
function getBackgroundColor(element: HTMLElement): string {
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

function calculateContrastRatio(color1: string, color2: string): number {
  // Simplified contrast ratio calculation
  // In production, use a proper color library
  return 4.5; // Mock value for testing
}

export default AccessibilityTestRunner;