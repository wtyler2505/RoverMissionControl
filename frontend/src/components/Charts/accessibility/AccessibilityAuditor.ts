/**
 * Accessibility Auditor for Telemetry Charts
 * Comprehensive WCAG 2.1 AA compliance auditing system
 */

import { AxeResults, Result, ImpactValue, TagValue } from 'axe-core';

export interface AccessibilityViolation {
  id: string;
  description: string;
  impact: ImpactValue;
  tags: TagValue[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary?: string;
  }>;
  helpUrl: string;
}

export interface ColorContrastTest {
  foreground: string;
  background: string;
  ratio: number;
  level: 'AA' | 'AAA';
  size: 'normal' | 'large';
  passes: boolean;
}

export interface KeyboardNavigationTest {
  element: string;
  hasTabIndex: boolean;
  hasFocusHandler: boolean;
  hasKeyDownHandler: boolean;
  hasAriaLabel: boolean;
  passes: boolean;
}

export interface AccessibilityAuditResult {
  chartType: string;
  chartId: string;
  timestamp: Date;
  overallScore: number;
  violations: AccessibilityViolation[];
  colorContrastTests: ColorContrastTest[];
  keyboardTests: KeyboardNavigationTest[];
  ariaTests: AriaTest[];
  recommendations: string[];
}

export interface AriaTest {
  element: string;
  hasRole: boolean;
  hasLabel: boolean;
  hasDescription: boolean;
  hasLiveRegion: boolean;
  passes: boolean;
}

export class AccessibilityAuditor {
  private axe: any;
  
  constructor() {
    // Dynamically import axe-core to avoid SSR issues
    this.initializeAxe();
  }

  private async initializeAxe() {
    try {
      const axeCore = await import('axe-core');
      this.axe = axeCore.default || axeCore;
    } catch (error) {
      console.warn('Failed to load axe-core:', error);
    }
  }

  /**
   * Perform comprehensive accessibility audit on a chart container
   */
  async auditChart(containerElement: HTMLElement, chartType: string): Promise<AccessibilityAuditResult> {
    const chartId = containerElement.id || `chart-${Date.now()}`;
    const timestamp = new Date();
    
    // Run axe-core audit
    const axeResults = await this.runAxeAudit(containerElement);
    
    // Run custom tests
    const colorContrastTests = this.testColorContrast(containerElement);
    const keyboardTests = this.testKeyboardNavigation(containerElement);
    const ariaTests = this.testAriaCompliance(containerElement);
    
    // Calculate overall score
    const overallScore = this.calculateOverallScore(axeResults, colorContrastTests, keyboardTests, ariaTests);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(axeResults, colorContrastTests, keyboardTests, ariaTests);
    
    return {
      chartType,
      chartId,
      timestamp,
      overallScore,
      violations: this.processAxeViolations(axeResults.violations),
      colorContrastTests,
      keyboardTests,
      ariaTests,
      recommendations
    };
  }

  /**
   * Run axe-core accessibility audit
   */
  private async runAxeAudit(element: HTMLElement): Promise<AxeResults> {
    if (!this.axe) {
      await this.initializeAxe();
    }

    if (!this.axe) {
      throw new Error('axe-core not available');
    }

    const config = {
      rules: {
        // Enable all WCAG 2.1 AA rules
        'color-contrast': { enabled: true },
        'keyboard-navigation': { enabled: true },
        'aria-allowed-attr': { enabled: true },
        'aria-required-attr': { enabled: true },
        'aria-valid-attr': { enabled: true },
        'aria-valid-attr-value': { enabled: true },
        'button-name': { enabled: true },
        'focus-order-semantics': { enabled: true },
        'image-alt': { enabled: true },
        'label': { enabled: true },
        'link-name': { enabled: true },
        'tabindex': { enabled: true }
      },
      tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
    };

    try {
      return await this.axe.run(element, config);
    } catch (error) {
      console.error('Axe audit failed:', error);
      return {
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
        timestamp: new Date().toISOString(),
        url: window.location.href
      } as AxeResults;
    }
  }

  /**
   * Test color contrast ratios
   */
  private testColorContrast(element: HTMLElement): ColorContrastTest[] {
    const tests: ColorContrastTest[] = [];
    
    // Find all text elements and test their contrast
    const textElements = element.querySelectorAll('text, .chart-label, .axis-label, .legend-text');
    
    textElements.forEach((textEl) => {
      const htmlEl = textEl as HTMLElement;
      const computedStyle = window.getComputedStyle(htmlEl);
      const foreground = computedStyle.color;
      const background = this.getBackgroundColor(htmlEl);
      
      if (foreground && background) {
        const ratio = this.calculateContrastRatio(foreground, background);
        const fontSize = parseFloat(computedStyle.fontSize);
        const fontWeight = computedStyle.fontWeight;
        const isLarge = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
        
        tests.push({
          foreground,
          background,
          ratio,
          level: 'AA',
          size: isLarge ? 'large' : 'normal',
          passes: isLarge ? ratio >= 3.0 : ratio >= 4.5
        });
      }
    });
    
    return tests;
  }

  /**
   * Test keyboard navigation support
   */
  private testKeyboardNavigation(element: HTMLElement): KeyboardNavigationTest[] {
    const tests: KeyboardNavigationTest[] = [];
    
    // Find all interactive elements
    const interactiveElements = element.querySelectorAll(
      'button, [role="button"], [tabindex], .interactive, .clickable, .point, .bar, .segment'
    );
    
    interactiveElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const tagName = htmlEl.tagName.toLowerCase();
      
      tests.push({
        element: `${tagName}${htmlEl.className ? '.' + htmlEl.className : ''}`,
        hasTabIndex: htmlEl.hasAttribute('tabindex') && htmlEl.getAttribute('tabindex') !== '-1',
        hasFocusHandler: this.hasEventListener(htmlEl, 'focus') || this.hasEventListener(htmlEl, 'focusin'),
        hasKeyDownHandler: this.hasEventListener(htmlEl, 'keydown') || this.hasEventListener(htmlEl, 'keypress'),
        hasAriaLabel: htmlEl.hasAttribute('aria-label') || htmlEl.hasAttribute('aria-labelledby'),
        passes: this.isKeyboardAccessible(htmlEl)
      });
    });
    
    return tests;
  }

  /**
   * Test ARIA compliance
   */
  private testAriaCompliance(element: HTMLElement): AriaTest[] {
    const tests: AriaTest[] = [];
    
    // Test main chart container
    const chartContainer = element.querySelector('svg, canvas, .chart-container') as HTMLElement;
    if (chartContainer) {
      tests.push({
        element: 'chart-container',
        hasRole: chartContainer.hasAttribute('role'),
        hasLabel: chartContainer.hasAttribute('aria-label') || chartContainer.hasAttribute('aria-labelledby'),
        hasDescription: chartContainer.hasAttribute('aria-describedby'),
        hasLiveRegion: !!element.querySelector('[aria-live]'),
        passes: this.isAriaCompliant(chartContainer)
      });
    }
    
    // Test interactive elements
    const interactiveElements = element.querySelectorAll('[role], [aria-label], [aria-labelledby]');
    interactiveElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      tests.push({
        element: htmlEl.tagName.toLowerCase(),
        hasRole: htmlEl.hasAttribute('role'),
        hasLabel: htmlEl.hasAttribute('aria-label') || htmlEl.hasAttribute('aria-labelledby'),
        hasDescription: htmlEl.hasAttribute('aria-describedby'),
        hasLiveRegion: htmlEl.hasAttribute('aria-live'),
        passes: this.isAriaCompliant(htmlEl)
      });
    });
    
    return tests;
  }

  /**
   * Calculate overall accessibility score (0-100)
   */
  private calculateOverallScore(
    axeResults: AxeResults,
    colorTests: ColorContrastTest[],
    keyboardTests: KeyboardNavigationTest[],
    ariaTests: AriaTest[]
  ): number {
    let score = 100;
    
    // Deduct points for axe violations
    axeResults.violations.forEach((violation) => {
      const deduction = violation.impact === 'critical' ? 25 : 
                       violation.impact === 'serious' ? 15 :
                       violation.impact === 'moderate' ? 10 : 5;
      score -= deduction;
    });
    
    // Deduct points for failed color contrast tests
    const failedColorTests = colorTests.filter(test => !test.passes);
    score -= failedColorTests.length * 5;
    
    // Deduct points for failed keyboard tests
    const failedKeyboardTests = keyboardTests.filter(test => !test.passes);
    score -= failedKeyboardTests.length * 10;
    
    // Deduct points for failed ARIA tests
    const failedAriaTests = ariaTests.filter(test => !test.passes);
    score -= failedAriaTests.length * 8;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate accessibility recommendations
   */
  private generateRecommendations(
    axeResults: AxeResults,
    colorTests: ColorContrastTest[],
    keyboardTests: KeyboardNavigationTest[],
    ariaTests: AriaTest[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Axe violations recommendations
    axeResults.violations.forEach((violation) => {
      recommendations.push(`Fix ${violation.id}: ${violation.description}`);
    });
    
    // Color contrast recommendations
    const failedColorTests = colorTests.filter(test => !test.passes);
    if (failedColorTests.length > 0) {
      recommendations.push(
        `Improve color contrast for ${failedColorTests.length} text elements. ` +
        `Minimum ratio required: ${failedColorTests[0].size === 'large' ? '3:1' : '4.5:1'} for WCAG AA compliance.`
      );
    }
    
    // Keyboard navigation recommendations
    const failedKeyboardTests = keyboardTests.filter(test => !test.passes);
    if (failedKeyboardTests.length > 0) {
      recommendations.push(
        `Add keyboard navigation support to ${failedKeyboardTests.length} interactive elements. ` +
        `Ensure all interactive elements have tabindex, focus handlers, and keyboard event handlers.`
      );
    }
    
    // ARIA recommendations
    const failedAriaTests = ariaTests.filter(test => !test.passes);
    if (failedAriaTests.length > 0) {
      recommendations.push(
        `Improve ARIA implementation for ${failedAriaTests.length} elements. ` +
        `Add proper roles, labels, and descriptions for screen reader compatibility.`
      );
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Accessibility compliance is excellent! Continue monitoring for regressions.');
    } else {
      recommendations.push('Consider implementing automated accessibility testing in your CI/CD pipeline.');
      recommendations.push('Regularly test with actual screen readers and keyboard-only navigation.');
    }
    
    return recommendations;
  }

  /**
   * Process axe violations into our format
   */
  private processAxeViolations(violations: Result[]): AccessibilityViolation[] {
    return violations.map((violation) => ({
      id: violation.id,
      description: violation.description,
      impact: violation.impact!,
      tags: violation.tags,
      nodes: violation.nodes.map((node) => ({
        html: node.html,
        target: node.target,
        failureSummary: node.failureSummary
      })),
      helpUrl: violation.helpUrl
    }));
  }

  /**
   * Get effective background color of an element
   */
  private getBackgroundColor(element: HTMLElement): string {
    let el: HTMLElement | null = element;
    
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      const bgColor = style.backgroundColor;
      
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
        return bgColor;
      }
      
      el = el.parentElement;
    }
    
    return '#ffffff'; // Default to white
  }

  /**
   * Calculate color contrast ratio
   */
  private calculateContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.parseColor(color1);
    const rgb2 = this.parseColor(color2);
    
    const l1 = this.getLuminance(rgb1);
    const l2 = this.getLuminance(rgb2);
    
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Parse CSS color to RGB values
   */
  private parseColor(color: string): { r: number; g: number; b: number } {
    // Create a temporary element to let the browser parse the color
    const div = document.createElement('div');
    div.style.color = color;
    document.body.appendChild(div);
    
    const computedColor = window.getComputedStyle(div).color;
    document.body.removeChild(div);
    
    // Extract RGB values
    const match = computedColor.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0]),
        g: parseInt(match[1]),
        b: parseInt(match[2])
      };
    }
    
    return { r: 0, g: 0, b: 0 }; // Default to black
  }

  /**
   * Calculate relative luminance
   */
  private getLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Check if element has event listener (simplified check)
   */
  private hasEventListener(element: HTMLElement, eventType: string): boolean {
    // Check for inline event handlers
    const inlineHandler = element.getAttribute(`on${eventType}`);
    if (inlineHandler) return true;
    
    // Check for React event handlers (simplified)
    const reactEvents = (element as any)._reactInternalFiber?.memoizedProps;
    if (reactEvents && reactEvents[`on${eventType.charAt(0).toUpperCase() + eventType.slice(1)}`]) {
      return true;
    }
    
    // Note: Can't reliably detect addEventListener listeners without instrumenting
    // This is a limitation of this approach
    return false;
  }

  /**
   * Check if element is keyboard accessible
   */
  private isKeyboardAccessible(element: HTMLElement): boolean {
    const hasTabIndex = element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1';
    const hasAriaLabel = element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby');
    const hasRole = element.hasAttribute('role');
    
    // For interactive elements, we need tab index and proper labeling
    return hasTabIndex && hasAriaLabel && (hasRole || this.isNativelyFocusable(element));
  }

  /**
   * Check if element is natively focusable
   */
  private isNativelyFocusable(element: HTMLElement): boolean {
    const focusableTags = ['button', 'input', 'select', 'textarea', 'a'];
    return focusableTags.includes(element.tagName.toLowerCase());
  }

  /**
   * Check if element is ARIA compliant
   */
  private isAriaCompliant(element: HTMLElement): boolean {
    const hasRole = element.hasAttribute('role');
    const hasLabel = element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby');
    
    // For SVG/Canvas chart containers
    if (element.tagName.toLowerCase() === 'svg' || element.tagName.toLowerCase() === 'canvas') {
      return hasRole && hasLabel;
    }
    
    // For interactive elements
    if (element.hasAttribute('tabindex') || element.getAttribute('role') === 'button') {
      return hasLabel;
    }
    
    return true; // Non-interactive elements don't need ARIA
  }

  /**
   * Export audit results to various formats
   */
  async exportResults(results: AccessibilityAuditResult, format: 'json' | 'csv' | 'html' = 'json'): Promise<void> {
    const timestamp = results.timestamp.toISOString().split('T')[0];
    const filename = `accessibility-audit-${results.chartType}-${timestamp}`;
    
    switch (format) {
      case 'json':
        this.downloadJson(results, `${filename}.json`);
        break;
      case 'csv':
        this.downloadCsv(results, `${filename}.csv`);
        break;
      case 'html':
        this.downloadHtml(results, `${filename}.html`);
        break;
    }
  }

  private downloadJson(data: any, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, filename);
  }

  private downloadCsv(results: AccessibilityAuditResult, filename: string): void {
    const csvData = [
      ['Test Type', 'Element', 'Status', 'Details'],
      ...results.violations.map(v => ['Violation', v.id, 'Failed', v.description]),
      ...results.colorContrastTests.map(t => ['Color Contrast', t.foreground, t.passes ? 'Passed' : 'Failed', `Ratio: ${t.ratio.toFixed(2)}`]),
      ...results.keyboardTests.map(t => ['Keyboard Nav', t.element, t.passes ? 'Passed' : 'Failed', 'Interactive element']),
      ...results.ariaTests.map(t => ['ARIA', t.element, t.passes ? 'Passed' : 'Failed', 'Screen reader support'])
    ];
    
    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    this.downloadBlob(blob, filename);
  }

  private downloadHtml(results: AccessibilityAuditResult, filename: string): void {
    const html = this.generateHtmlReport(results);
    const blob = new Blob([html], { type: 'text/html' });
    this.downloadBlob(blob, filename);
  }

  private generateHtmlReport(results: AccessibilityAuditResult): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Audit Report - ${results.chartType}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .score { font-size: 2em; font-weight: bold; color: ${results.overallScore >= 80 ? '#4caf50' : results.overallScore >= 60 ? '#ff9800' : '#f44336'}; }
        .section { margin-bottom: 30px; }
        .violation { background: #ffebee; padding: 10px; margin: 10px 0; border-left: 4px solid #f44336; }
        .test-item { padding: 5px 0; border-bottom: 1px solid #eee; }
        .pass { color: #4caf50; }
        .fail { color: #f44336; }
        .recommendations { background: #e3f2fd; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Audit Report</h1>
        <p><strong>Chart Type:</strong> ${results.chartType}</p>
        <p><strong>Date:</strong> ${results.timestamp.toLocaleString()}</p>
        <p class="score">Overall Score: ${results.overallScore}/100</p>
    </div>
    
    <div class="section">
        <h2>Violations (${results.violations.length})</h2>
        ${results.violations.map(v => `
            <div class="violation">
                <h3>${v.id}</h3>
                <p>${v.description}</p>
                <p><strong>Impact:</strong> ${v.impact}</p>
                <p><strong>Help:</strong> <a href="${v.helpUrl}" target="_blank">Learn more</a></p>
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>Color Contrast Tests</h2>
        ${results.colorContrastTests.map(t => `
            <div class="test-item">
                <span class="${t.passes ? 'pass' : 'fail'}">${t.passes ? '✓' : '✗'}</span>
                Contrast ratio: ${t.ratio.toFixed(2)} (${t.foreground} on ${t.background})
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>Keyboard Navigation Tests</h2>
        ${results.keyboardTests.map(t => `
            <div class="test-item">
                <span class="${t.passes ? 'pass' : 'fail'}">${t.passes ? '✓' : '✗'}</span>
                ${t.element}
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>ARIA Tests</h2>
        ${results.ariaTests.map(t => `
            <div class="test-item">
                <span class="${t.passes ? 'pass' : 'fail'}">${t.passes ? '✓' : '✗'}</span>
                ${t.element}
            </div>
        `).join('')}
    </div>
    
    <div class="section">
        <h2>Recommendations</h2>
        <div class="recommendations">
            ${results.recommendations.map(r => `<p>• ${r}</p>`).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export default AccessibilityAuditor;