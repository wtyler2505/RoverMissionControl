/**
 * Accessibility CI/CD Integration
 * Automated accessibility testing pipeline for rover telemetry components
 */

import { AxePuppeteer } from '@axe-core/puppeteer';
import puppeteer, { Browser, Page } from 'puppeteer';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface AccessibilityCIConfig {
  baseUrl: string;
  outputDir: string;
  testRoutes: string[];
  axeConfig: {
    tags: string[];
    rules: Record<string, any>;
  };
  thresholds: {
    violations: number;
    wcagAA: number;
    wcagAAA: number;
  };
  reporting: {
    formats: ('json' | 'html' | 'csv' | 'junit')[];
    includeScreenshots: boolean;
    includeFullResults: boolean;
  };
  browser: {
    headless: boolean;
    viewport: { width: number; height: number };
  };
}

export interface AccessibilityTestResult {
  url: string;
  timestamp: Date;
  violations: any[];
  passes: any[];
  incomplete: any[];
  inapplicable: any[];
  summary: {
    violationCount: number;
    passCount: number;
    incompleteCount: number;
    wcagAAViolations: number;
    wcagAAAViolations: number;
  };
  screenshot?: string;
}

export interface AccessibilityReport {
  testRun: {
    id: string;
    timestamp: Date;
    config: AccessibilityCIConfig;
    duration: number;
  };
  results: AccessibilityTestResult[];
  summary: {
    totalViolations: number;
    totalPasses: number;
    totalIncomplete: number;
    criticalViolations: number;
    wcagAACompliance: number;
    wcagAAACompliance: number;
    overallScore: number;
  };
  passed: boolean;
}

export class AccessibilityCIRunner {
  private browser: Browser | null = null;
  private config: AccessibilityCIConfig;

  constructor(config: AccessibilityCIConfig) {
    this.config = config;
  }

  async runTests(): Promise<AccessibilityReport> {
    const startTime = Date.now();
    const testRunId = `accessibility-test-${Date.now()}`;
    
    console.log(`Starting accessibility test run: ${testRunId}`);
    
    try {
      await this.setupBrowser();
      const results = await this.runTestSuite();
      const report = this.generateReport(testRunId, results, Date.now() - startTime);
      
      await this.generateReports(report);
      await this.cleanup();
      
      console.log(`Accessibility test completed. Overall score: ${report.summary.overallScore}%`);
      
      return report;
    } catch (error) {
      console.error('Accessibility test run failed:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async setupBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.config.browser.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--remote-debugging-port=9222'
      ]
    });
  }

  private async runTestSuite(): Promise<AccessibilityTestResult[]> {
    if (!this.browser) throw new Error('Browser not initialized');

    const results: AccessibilityTestResult[] = [];
    
    for (const route of this.config.testRoutes) {
      console.log(`Testing route: ${route}`);
      const result = await this.testRoute(route);
      results.push(result);
    }
    
    return results;
  }

  private async testRoute(route: string): Promise<AccessibilityTestResult> {
    if (!this.browser) throw new Error('Browser not initialized');

    const page = await this.browser.newPage();
    
    try {
      await page.setViewport(this.config.browser.viewport);
      
      const url = `${this.config.baseUrl}${route}`;
      console.log(`Navigating to: ${url}`);
      
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      // Wait for telemetry components to load
      await page.waitForSelector('[data-testid="telemetry-dashboard"], .telemetry-component', { timeout: 10000 })
        .catch(() => console.warn('Telemetry components not found, continuing with test'));
      
      // Allow time for real-time data to populate
      await page.waitForTimeout(2000);
      
      // Run axe accessibility tests
      const axeResults = await new AxePuppeteer(page)
        .withTags(this.config.axeConfig.tags)
        .configure(this.config.axeConfig.rules)
        .analyze();
      
      // Take screenshot if enabled
      let screenshot: string | undefined;
      if (this.config.reporting.includeScreenshots) {
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        screenshot = screenshotBuffer.toString('base64');
      }
      
      // Process results
      const result: AccessibilityTestResult = {
        url,
        timestamp: new Date(),
        violations: axeResults.violations,
        passes: axeResults.passes,
        incomplete: axeResults.incomplete,
        inapplicable: axeResults.inapplicable,
        summary: {
          violationCount: axeResults.violations.length,
          passCount: axeResults.passes.length,
          incompleteCount: axeResults.incomplete.length,
          wcagAAViolations: axeResults.violations.filter(v => 
            v.tags.includes('wcag2a') || v.tags.includes('wcag2aa')
          ).length,
          wcagAAAViolations: axeResults.violations.filter(v => 
            v.tags.includes('wcag2aaa')
          ).length
        },
        screenshot
      };
      
      console.log(`Route ${route}: ${result.summary.violationCount} violations, ${result.summary.passCount} passes`);
      
      return result;
      
    } finally {
      await page.close();
    }
  }

  private generateReport(testRunId: string, results: AccessibilityTestResult[], duration: number): AccessibilityReport {
    const summary = results.reduce((acc, result) => ({
      totalViolations: acc.totalViolations + result.summary.violationCount,
      totalPasses: acc.totalPasses + result.summary.passCount,
      totalIncomplete: acc.totalIncomplete + result.summary.incompleteCount,
      criticalViolations: acc.criticalViolations + result.violations.filter(v => 
        v.impact === 'critical' || v.impact === 'serious'
      ).length,
      wcagAACompliance: acc.wcagAACompliance + (result.summary.wcagAAViolations === 0 ? 1 : 0),
      wcagAAACompliance: acc.wcagAAACompliance + (result.summary.wcagAAAViolations === 0 ? 1 : 0)
    }), {
      totalViolations: 0,
      totalPasses: 0,
      totalIncomplete: 0,
      criticalViolations: 0,
      wcagAACompliance: 0,
      wcagAAACompliance: 0,
      overallScore: 0
    });

    // Calculate overall score
    const totalTests = summary.totalViolations + summary.totalPasses;
    summary.overallScore = totalTests > 0 ? Math.round((summary.totalPasses / totalTests) * 100) : 0;

    // Calculate compliance percentages
    summary.wcagAACompliance = Math.round((summary.wcagAACompliance / results.length) * 100);
    summary.wcagAAACompliance = Math.round((summary.wcagAAACompliance / results.length) * 100);

    const passed = this.evaluateTestResults(summary);

    return {
      testRun: {
        id: testRunId,
        timestamp: new Date(),
        config: this.config,
        duration
      },
      results,
      summary,
      passed
    };
  }

  private evaluateTestResults(summary: any): boolean {
    if (summary.criticalViolations > this.config.thresholds.violations) {
      console.log(`FAIL: ${summary.criticalViolations} critical violations exceed threshold of ${this.config.thresholds.violations}`);
      return false;
    }
    
    if (summary.wcagAACompliance < this.config.thresholds.wcagAA) {
      console.log(`FAIL: WCAG AA compliance ${summary.wcagAACompliance}% below threshold of ${this.config.thresholds.wcagAA}%`);
      return false;
    }
    
    if (summary.wcagAAACompliance < this.config.thresholds.wcagAAA) {
      console.log(`FAIL: WCAG AAA compliance ${summary.wcagAAACompliance}% below threshold of ${this.config.thresholds.wcagAAA}%`);
      return false;
    }
    
    return true;
  }

  private async generateReports(report: AccessibilityReport): Promise<void> {
    if (!existsSync(this.config.outputDir)) {
      mkdirSync(this.config.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    for (const format of this.config.reporting.formats) {
      const filename = `accessibility-report-${timestamp}.${format}`;
      const filepath = join(this.config.outputDir, filename);
      
      switch (format) {
        case 'json':
          await this.generateJSONReport(report, filepath);
          break;
        case 'html':
          await this.generateHTMLReport(report, filepath);
          break;
        case 'csv':
          await this.generateCSVReport(report, filepath);
          break;
        case 'junit':
          await this.generateJUnitReport(report, filepath);
          break;
      }
      
      console.log(`Generated ${format.toUpperCase()} report: ${filepath}`);
    }
  }

  private async generateJSONReport(report: AccessibilityReport, filepath: string): Promise<void> {
    const reportData = this.config.reporting.includeFullResults ? report : {
      testRun: report.testRun,
      summary: report.summary,
      passed: report.passed,
      results: report.results.map(r => ({
        url: r.url,
        timestamp: r.timestamp,
        summary: r.summary,
        violationSummary: r.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          tags: v.tags,
          nodes: v.nodes.length
        }))
      }))
    };
    
    writeFileSync(filepath, JSON.stringify(reportData, null, 2));
  }

  private async generateHTMLReport(report: AccessibilityReport, filepath: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rover Telemetry Accessibility Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid #2196F3; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1976D2; margin: 0; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e9ecef; }
        .metric-value { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #6c757d; font-size: 0.9em; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .warning { color: #ffc107; }
        .results { margin-top: 30px; }
        .result { background: white; border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
        .result-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #dee2e6; }
        .result-body { padding: 15px; }
        .violation { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; margin-bottom: 10px; }
        .violation-title { font-weight: bold; color: #721c24; margin-bottom: 5px; }
        .violation-description { color: #721c24; font-size: 0.9em; }
        .violation-impact { float: right; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; color: white; }
        .impact-critical { background: #dc3545; }
        .impact-serious { background: #fd7e14; }
        .impact-moderate { background: #ffc107; color: #000; }
        .impact-minor { background: #6c757d; }
        .passes { color: #28a745; font-weight: bold; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Rover Telemetry Accessibility Report</h1>
            <p class="timestamp">Generated: ${report.testRun.timestamp.toISOString()}</p>
            <p>Test Run ID: ${report.testRun.id}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value ${report.passed ? 'passed' : 'failed'}">${report.passed ? 'PASS' : 'FAIL'}</div>
                <div class="metric-label">Overall Result</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.overallScore}%</div>
                <div class="metric-label">Overall Score</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.totalViolations === 0 ? 'passed' : 'failed'}">${report.summary.totalViolations}</div>
                <div class="metric-label">Total Violations</div>
            </div>
            <div class="metric">
                <div class="metric-value ${report.summary.criticalViolations === 0 ? 'passed' : 'failed'}">${report.summary.criticalViolations}</div>
                <div class="metric-label">Critical Violations</div>
            </div>
            <div class="metric">
                <div class="metric-value passed">${report.summary.totalPasses}</div>
                <div class="metric-label">Passed Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.wcagAACompliance}%</div>
                <div class="metric-label">WCAG AA Compliance</div>
            </div>
        </div>

        <div class="results">
            <h2>Test Results by Route</h2>
            ${report.results.map(result => `
                <div class="result">
                    <div class="result-header">
                        <h3>${result.url}</h3>
                        <p class="timestamp">${result.timestamp.toISOString()}</p>
                        <p>
                            <span class="passes">${result.summary.passCount} passed</span> | 
                            <span class="${result.summary.violationCount > 0 ? 'failed' : 'passed'}">${result.summary.violationCount} violations</span> |
                            <span class="warning">${result.summary.incompleteCount} incomplete</span>
                        </p>
                    </div>
                    <div class="result-body">
                        ${result.violations.length > 0 ? `
                            <h4>Violations:</h4>
                            ${result.violations.map(violation => `
                                <div class="violation">
                                    <div class="violation-title">
                                        ${violation.help}
                                        <span class="violation-impact impact-${violation.impact}">${violation.impact}</span>
                                    </div>
                                    <div class="violation-description">${violation.description}</div>
                                    <div style="margin-top: 5px;">
                                        <small>Rule: ${violation.id} | Nodes affected: ${violation.nodes.length}</small>
                                        <br><small>Tags: ${violation.tags.join(', ')}</small>
                                    </div>
                                </div>
                            `).join('')}
                        ` : '<p class="passes">✅ No violations found!</p>'}
                        
                        ${result.screenshot ? `
                            <h4>Screenshot:</h4>
                            <img src="data:image/png;base64,${result.screenshot}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px;">
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; text-align: center;">
            <p>Generated by Rover Mission Control Accessibility CI</p>
            <p>Test Duration: ${(report.testRun.duration / 1000).toFixed(2)} seconds</p>
        </div>
    </div>
</body>
</html>`;
    
    writeFileSync(filepath, html);
  }

  private async generateCSVReport(report: AccessibilityReport, filepath: string): Promise<void> {
    const headers = ['URL', 'Timestamp', 'Violations', 'Passed', 'Incomplete', 'Critical Violations', 'WCAG AA Violations'];
    const rows = report.results.map(result => [
      result.url,
      result.timestamp.toISOString(),
      result.summary.violationCount.toString(),
      result.summary.passCount.toString(),
      result.summary.incompleteCount.toString(),
      result.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length.toString(),
      result.summary.wcagAAViolations.toString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    writeFileSync(filepath, csv);
  }

  private async generateJUnitReport(report: AccessibilityReport, filepath: string): Promise<void> {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Accessibility Tests" tests="${report.results.length}" failures="${report.results.filter(r => r.summary.violationCount > 0).length}" errors="0" time="${(report.testRun.duration / 1000).toFixed(3)}">
  ${report.results.map(result => `
  <testcase classname="AccessibilityTest" name="${result.url}" time="0">
    ${result.summary.violationCount > 0 ? `
    <failure message="${result.summary.violationCount} accessibility violations">
      ${result.violations.map(v => `${v.id}: ${v.description} (${v.impact})`).join('\n      ')}
    </failure>` : ''}
  </testcase>`).join('')}
</testsuite>`;
    
    writeFileSync(filepath, xml);
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Default configuration for rover telemetry testing
export const DEFAULT_ROVER_ACCESSIBILITY_CONFIG: AccessibilityCIConfig = {
  baseUrl: 'http://localhost:3000',
  outputDir: './accessibility-reports',
  testRoutes: [
    '/',
    '/telemetry',
    '/telemetry/battery',
    '/telemetry/temperature',
    '/telemetry/speed',
    '/telemetry/dashboard',
    '/telemetry/alerts'
  ],
  axeConfig: {
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'aria-labels': { enabled: true },
      'focus-visible': { enabled: true },
      'live-regions': { enabled: true }
    }
  },
  thresholds: {
    violations: 0, // No critical violations allowed for mission-critical systems
    wcagAA: 95,   // 95% WCAG AA compliance required
    wcagAAA: 80   // 80% WCAG AAA compliance target
  },
  reporting: {
    formats: ['json', 'html', 'junit'],
    includeScreenshots: true,
    includeFullResults: true
  },
  browser: {
    headless: true,
    viewport: { width: 1920, height: 1080 }
  }
};

// CLI script for running accessibility tests
export async function runAccessibilityCI(customConfig?: Partial<AccessibilityCIConfig>): Promise<void> {
  const config = { ...DEFAULT_ROVER_ACCESSIBILITY_CONFIG, ...customConfig };
  const runner = new AccessibilityCIRunner(config);
  
  try {
    const report = await runner.runTests();
    
    if (!report.passed) {
      console.error('❌ Accessibility tests failed!');
      console.error(`Critical violations: ${report.summary.criticalViolations}`);
      console.error(`WCAG AA compliance: ${report.summary.wcagAACompliance}%`);
      process.exit(1);
    } else {
      console.log('✅ All accessibility tests passed!');
      console.log(`Overall score: ${report.summary.overallScore}%`);
      console.log(`WCAG AA compliance: ${report.summary.wcagAACompliance}%`);
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Accessibility test execution failed:', error);
    process.exit(1);
  }
}

// Export for use in package.json scripts
if (require.main === module) {
  runAccessibilityCI();
}