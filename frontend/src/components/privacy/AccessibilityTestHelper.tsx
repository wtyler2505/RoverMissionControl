/**
 * Accessibility Test Helper Component
 * Provides tools and utilities for testing privacy components with assistive technologies
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useTheme } from '@emotion/react';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';
import { useFocusManagement } from '../../contexts/FocusManagementContext';

interface AccessibilityTestHelperProps {
  /** Component to test */
  children: React.ReactNode;
  /** Test mode label */
  testLabel?: string;
  /** Whether to show test controls */
  showControls?: boolean;
  /** Callback for test results */
  onTestResult?: (result: AccessibilityTestResult) => void;
}

interface AccessibilityTestResult {
  timestamp: string;
  testType: string;
  passed: boolean;
  issues: AccessibilityIssue[];
  recommendations: string[];
}

interface AccessibilityIssue {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  description: string;
  element?: string;
  recommendation: string;
}

const TestContainer = styled.div<{ testMode?: boolean }>`
  position: relative;
  
  ${({ testMode, theme }) => testMode && css`
    border: 3px dashed ${theme.colors.primary.main};
    border-radius: ${theme.borderRadius.lg};
    padding: 1rem;
    background: ${theme.colors.primary.light}10;
    
    &::before {
      content: 'ACCESSIBILITY TEST MODE';
      position: absolute;
      top: -12px;
      left: 1rem;
      background: ${theme.colors.primary.main};
      color: ${theme.colors.primary.contrastText};
      padding: 0.25rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: ${theme.borderRadius.sm};
      z-index: 10;
    }
  `}
`;

const TestControls = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background: ${props => props.theme.colors.background.paper};
  border: 2px solid ${props => props.theme.colors.border.primary};
  border-radius: ${props => props.theme.borderRadius.lg};
  padding: 1.5rem;
  box-shadow: ${props => props.theme.shadows.xl};
  z-index: 1000;
  min-width: 300px;
  max-height: 80vh;
  overflow-y: auto;
`;

const TestControlsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const TestControlsTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.text.secondary};
  cursor: pointer;
  padding: 0.25rem;
  border-radius: ${props => props.theme.borderRadius.sm};
  
  &:hover {
    background: ${props => props.theme.colors.background.secondary};
    color: ${props => props.theme.colors.text.primary};
  }
  
  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

const TestSection = styled.div`
  margin-bottom: 1.5rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const TestSectionTitle = styled.h4`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TestOption = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const TestOptionLabel = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
  flex: 1;
`;

const TestResults = styled.div`
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.md};
  padding: 1rem;
  margin-top: 1rem;
`;

const TestResultsTitle = styled.h5`
  font-size: 0.875rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.75rem 0;
`;

const TestIssue = styled.div<{ severity: 'error' | 'warning' | 'info' }>`
  padding: 0.75rem;
  border-radius: ${props => props.theme.borderRadius.sm};
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  
  ${({ severity, theme }) => {
    const colors = {
      error: {
        bg: theme.colors.error.light,
        border: theme.colors.error.main,
        text: theme.colors.error.dark
      },
      warning: {
        bg: theme.colors.warning.light,
        border: theme.colors.warning.main,
        text: theme.colors.warning.dark
      },
      info: {
        bg: theme.colors.info.light,
        border: theme.colors.info.main,
        text: theme.colors.info.dark
      }
    };
    
    return css`
      background: ${colors[severity].bg};
      border-left: 3px solid ${colors[severity].border};
      color: ${colors[severity].text};
    `;
  }}
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const KeyboardInstructions = styled.div`
  background: ${props => props.theme.colors.background.tertiary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.md};
  padding: 1rem;
  margin-top: 1rem;
`;

const InstructionsList = styled.ul`
  margin: 0.5rem 0 0 0;
  padding-left: 1.5rem;
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const LiveRegion = styled.div`
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;

export const AccessibilityTestHelper: React.FC<AccessibilityTestHelperProps> = ({
  children,
  testLabel = 'Privacy Component',
  showControls = false,
  onTestResult
}) => {
  const theme = useTheme();
  const { routerFocus, utils } = useFocusManagement();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Test state
  const [controlsVisible, setControlsVisible] = useState(showControls);
  const [testMode, setTestMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [keyboardOnly, setKeyboardOnly] = useState(false);
  const [screenReaderMode, setScreenReaderMode] = useState(false);
  const [testResults, setTestResults] = useState<AccessibilityTestResult | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  // Announce changes to screen readers
  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncement(message);
    routerFocus.announceToScreenReader(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, [routerFocus]);

  // Toggle test mode
  const toggleTestMode = useCallback(() => {
    const newTestMode = !testMode;
    setTestMode(newTestMode);
    
    if (newTestMode) {
      announceToScreenReader(`${testLabel} accessibility test mode enabled. Use the test controls to modify the interface.`);
    } else {
      announceToScreenReader(`${testLabel} accessibility test mode disabled.`);
    }
  }, [testMode, testLabel, announceToScreenReader]);

  // Apply high contrast styles
  useEffect(() => {
    if (highContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
      announceToScreenReader('High contrast mode enabled.');
    } else {
      document.documentElement.removeAttribute('data-high-contrast');
      announceToScreenReader('High contrast mode disabled.');
    }
    
    return () => {
      document.documentElement.removeAttribute('data-high-contrast');
    };
  }, [highContrast, announceToScreenReader]);

  // Handle keyboard-only mode
  useEffect(() => {
    if (keyboardOnly) {
      document.documentElement.setAttribute('data-keyboard-only', 'true');
      document.addEventListener('mousedown', preventMouseInteraction);
      announceToScreenReader('Keyboard-only mode enabled. Mouse interactions are disabled.');
    } else {
      document.documentElement.removeAttribute('data-keyboard-only');
      document.removeEventListener('mousedown', preventMouseInteraction);
      announceToScreenReader('Keyboard-only mode disabled.');
    }
    
    return () => {
      document.removeEventListener('mousedown', preventMouseInteraction);
      document.documentElement.removeAttribute('data-keyboard-only');
    };
  }, [keyboardOnly, announceToScreenReader]);

  // Prevent mouse interactions in keyboard-only mode
  const preventMouseInteraction = useCallback((e: MouseEvent) => {
    if (keyboardOnly && e.target !== e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      announceToScreenReader('Mouse interaction blocked. Use keyboard navigation instead.');
    }
  }, [keyboardOnly, announceToScreenReader]);

  // Run accessibility tests
  const runAccessibilityTest = useCallback(() => {
    if (!containerRef.current) return;
    
    const issues: AccessibilityIssue[] = [];
    const recommendations: string[] = [];
    
    // Test 1: Check for proper heading structure
    const headings = containerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      
      if (index === 0 && level !== 1 && level !== 2) {
        issues.push({
          severity: 'warning',
          rule: 'heading-hierarchy',
          description: 'First heading should be h1 or h2',
          element: heading.tagName.toLowerCase(),
          recommendation: 'Use h1 or h2 for the main heading'
        });
      }
      
      if (level > previousLevel + 1) {
        issues.push({
          severity: 'error',
          rule: 'heading-hierarchy',
          description: `Heading level jumps from h${previousLevel} to h${level}`,
          element: heading.tagName.toLowerCase(),
          recommendation: 'Use consecutive heading levels'
        });
      }
      
      previousLevel = level;
    });

    // Test 2: Check for missing alt text on images
    const images = containerRef.current.querySelectorAll('img');
    images.forEach(img => {
      if (!img.hasAttribute('alt')) {
        issues.push({
          severity: 'error',
          rule: 'img-alt',
          description: 'Image missing alt attribute',
          element: 'img',
          recommendation: 'Add descriptive alt text or alt="" for decorative images'
        });
      }
    });

    // Test 3: Check for proper form labels
    const inputs = containerRef.current.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (id) {
        const label = containerRef.current?.querySelector(`label[for="${id}"]`);
        if (!label && !ariaLabel && !ariaLabelledBy) {
          issues.push({
            severity: 'error',
            rule: 'form-label',
            description: 'Form control missing label',
            element: input.tagName.toLowerCase(),
            recommendation: 'Associate with a label element or add aria-label'
          });
        }
      }
    });

    // Test 4: Check for keyboard accessibility
    const focusableElements = utils.getFocusableElements(containerRef.current);
    if (focusableElements.length === 0) {
      issues.push({
        severity: 'warning',
        rule: 'keyboard-navigation',
        description: 'No focusable elements found',
        recommendation: 'Ensure interactive elements are keyboard accessible'
      });
    }

    // Test 5: Check for ARIA attributes
    const ariaElements = containerRef.current.querySelectorAll('[role], [aria-label], [aria-labelledby], [aria-describedby]');
    if (ariaElements.length === 0) {
      recommendations.push('Consider adding ARIA attributes for better screen reader support');
    }

    // Test 6: Check color contrast (basic check)
    const elements = containerRef.current.querySelectorAll('*');
    let hasLowContrast = false;
    
    elements.forEach(element => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // This is a simplified check - in real testing, you'd use a proper contrast analyzer
      if (color && backgroundColor && color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        // Placeholder for contrast checking logic
        // In production, use a library like color-contrast-analyzer
      }
    });

    // Compile results
    const result: AccessibilityTestResult = {
      timestamp: new Date().toISOString(),
      testType: 'automated-scan',
      passed: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      recommendations: [
        ...recommendations,
        'Test with actual screen readers (NVDA, JAWS, VoiceOver)',
        'Verify keyboard navigation works without mouse',
        'Test with different zoom levels (up to 200%)',
        'Validate color contrast with proper tools',
        'Test with users who have disabilities'
      ]
    };
    
    setTestResults(result);
    onTestResult?.(result);
    
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    
    announceToScreenReader(
      `Accessibility test completed. Found ${errorCount} errors and ${warningCount} warnings.`
    );
  }, [utils, onTestResult, announceToScreenReader]);

  return (
    <TestContainer ref={containerRef} testMode={testMode}>
      {/* Live region for announcements */}
      <LiveRegion role="alert" aria-live="assertive" aria-atomic="true">
        {announcement}
      </LiveRegion>
      
      {/* Test activation button */}
      {!controlsVisible && (
        <Button
          variant="secondary"
          size="small"
          onClick={() => setControlsVisible(true)}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 999
          }}
          aria-label="Open accessibility test controls"
        >
          A11y Test
        </Button>
      )}

      {/* Test controls panel */}
      {controlsVisible && (
        <TestControls role="dialog" aria-label="Accessibility test controls">
          <TestControlsHeader>
            <TestControlsTitle>Accessibility Testing</TestControlsTitle>
            <CloseButton
              onClick={() => setControlsVisible(false)}
              aria-label="Close accessibility test controls"
            >
              ✕
            </CloseButton>
          </TestControlsHeader>

          <TestSection>
            <TestSectionTitle>Test Modes</TestSectionTitle>
            
            <TestOption>
              <TestOptionLabel htmlFor="test-mode-toggle">
                Test Mode
              </TestOptionLabel>
              <Toggle
                id="test-mode-toggle"
                checked={testMode}
                onChange={toggleTestMode}
                size="small"
              />
            </TestOption>
            
            <TestOption>
              <TestOptionLabel htmlFor="high-contrast-toggle">
                High Contrast
              </TestOptionLabel>
              <Toggle
                id="high-contrast-toggle"
                checked={highContrast}
                onChange={setHighContrast}
                size="small"
              />
            </TestOption>
            
            <TestOption>
              <TestOptionLabel htmlFor="keyboard-only-toggle">
                Keyboard Only
              </TestOptionLabel>
              <Toggle
                id="keyboard-only-toggle"
                checked={keyboardOnly}
                onChange={setKeyboardOnly}
                size="small"
              />
            </TestOption>
            
            <TestOption>
              <TestOptionLabel htmlFor="screen-reader-toggle">
                Screen Reader Mode
              </TestOptionLabel>
              <Toggle
                id="screen-reader-toggle"
                checked={screenReaderMode}
                onChange={setScreenReaderMode}
                size="small"
              />
            </TestOption>
          </TestSection>

          <TestSection>
            <TestSectionTitle>Actions</TestSectionTitle>
            <Button
              variant="primary"
              size="small"
              onClick={runAccessibilityTest}
              style={{ width: '100%', marginBottom: '0.75rem' }}
            >
              Run A11y Test
            </Button>
          </TestSection>

          {/* Keyboard instructions */}
          <KeyboardInstructions>
            <TestSectionTitle>Keyboard Testing</TestSectionTitle>
            <InstructionsList>
              <li>Tab: Navigate forward</li>
              <li>Shift+Tab: Navigate backward</li>
              <li>Enter/Space: Activate buttons</li>
              <li>Arrow keys: Navigate lists/menus</li>
              <li>Escape: Close dialogs</li>
            </InstructionsList>
          </KeyboardInstructions>

          {/* Test results */}
          {testResults && (
            <TestResults>
              <TestResultsTitle>
                Test Results ({testResults.passed ? 'PASSED' : 'FAILED'})
              </TestResultsTitle>
              
              {testResults.issues.map((issue, index) => (
                <TestIssue key={index} severity={issue.severity}>
                  <strong>{issue.rule}:</strong> {issue.description}
                  <br />
                  <em>Fix: {issue.recommendation}</em>
                </TestIssue>
              ))}
              
              {testResults.issues.length === 0 && (
                <div style={{ color: theme.colors.success.main, fontSize: '0.875rem' }}>
                  No accessibility issues found in automated scan.
                </div>
              )}
            </TestResults>
          )}
        </TestControls>
      )}

      {/* Component being tested */}
      {children}
    </TestContainer>
  );
};