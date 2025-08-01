#!/usr/bin/env node
/**
 * Comprehensive Test Report Generator
 * 
 * Aggregates test results from all testing tools and generates
 * consolidated reports for CI/CD pipeline and PR comments.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || './test-artifacts';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;

class TestReportGenerator {
  constructor() {
    this.results = {
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        coverage: {
          frontend: 0,
          backend: 0,
          overall: 0
        },
        performance: {
          lighthouse: 0,
          bundleSize: 0,
          loadTime: 0
        },
        accessibility: {
          score: 0,
          violations: 0
        },
        visual: {
          snapshots: 0,
          changes: 0
        },
        security: {
          vulnerabilities: 0,
          highSeverity: 0
        }
      },
      details: {
        unit: [],
        integration: [],
        e2e: [],
        visual: [],
        accessibility: [],
        performance: [],
        security: []
      },
      timeline: []
    };
    
    this.startTime = new Date();
  }

  /**
   * Main execution method
   */
  async generate() {
    try {
      console.log('🔍 Scanning test artifacts...');
      await this.scanArtifacts();
      
      console.log('📊 Processing unit test results...');
      await this.processUnitTests();
      
      console.log('🎭 Processing E2E test results...');
      await this.processE2ETests();
      
      console.log('👁️ Processing visual test results...');
      await this.processVisualTests();
      
      console.log('♿ Processing accessibility test results...');
      await this.processAccessibilityTests();
      
      console.log('⚡ Processing performance test results...');
      await this.processPerformanceTests();
      
      console.log('🔒 Processing security test results...');
      await this.processSecurityTests();
      
      console.log('📈 Calculating summary metrics...');
      this.calculateSummary();
      
      console.log('📝 Generating reports...');
      await this.generateReports();
      
      console.log('✅ Test report generation complete!');
      
    } catch (error) {
      console.error('❌ Error generating test report:', error);
      process.exit(1);
    }
  }

  /**
   * Scan available test artifacts
   */
  async scanArtifacts() {
    if (!fs.existsSync(ARTIFACTS_PATH)) {
      console.warn('⚠️ No test artifacts found');
      return;
    }

    const artifacts = fs.readdirSync(ARTIFACTS_PATH);
    console.log(`📁 Found ${artifacts.length} artifact directories:`, artifacts);
  }

  /**
   * Process unit and integration test results
   */
  async processUnitTests() {
    // Process Jest frontend results
    const frontendResults = this.findFiles('test-results-frontend-*');
    for (const resultDir of frontendResults) {
      const coverageFile = path.join(resultDir, 'coverage', 'coverage-summary.json');
      const testResultsFile = path.join(resultDir, 'test-results.json');
      
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        this.results.summary.coverage.frontend = coverage.total.lines.pct;
        
        this.results.details.unit.push({
          type: 'frontend',
          coverage: coverage.total,
          timestamp: new Date().toISOString()
        });
      }
      
      if (fs.existsSync(testResultsFile)) {
        const testResults = JSON.parse(fs.readFileSync(testResultsFile, 'utf8'));
        this.results.summary.total += testResults.numTotalTests;
        this.results.summary.passed += testResults.numPassedTests;
        this.results.summary.failed += testResults.numFailedTests;
      }
    }

    // Process pytest backend results
    const backendResults = this.findFiles('test-results-backend-*');
    for (const resultDir of backendResults) {
      const coverageFile = path.join(resultDir, 'coverage.xml');
      const pytestFile = path.join(resultDir, 'pytest-report.xml');
      
      if (fs.existsSync(coverageFile)) {
        // Parse XML coverage report
        const coverageXml = fs.readFileSync(coverageFile, 'utf8');
        const coverageMatch = coverageXml.match(/line-rate="([^"]+)"/);
        if (coverageMatch) {
          this.results.summary.coverage.backend = Math.round(parseFloat(coverageMatch[1]) * 100);
        }
      }
      
      if (fs.existsSync(pytestFile)) {
        // Parse pytest XML results
        const pytestXml = fs.readFileSync(pytestFile, 'utf8');
        const testsMatch = pytestXml.match(/tests="(\d+)"/);
        const failuresMatch = pytestXml.match(/failures="(\d+)"/);
        const errorsMatch = pytestXml.match(/errors="(\d+)"/);
        const skippedMatch = pytestXml.match(/skipped="(\d+)"/);
        
        if (testsMatch) {
          const total = parseInt(testsMatch[1]);
          const failures = parseInt(failuresMatch?.[1] || '0');
          const errors = parseInt(errorsMatch?.[1] || '0');
          const skipped = parseInt(skippedMatch?.[1] || '0');
          const passed = total - failures - errors - skipped;
          
          this.results.summary.total += total;
          this.results.summary.passed += passed;
          this.results.summary.failed += failures + errors;
          this.results.summary.skipped += skipped;
        }
      }
    }
  }

  /**
   * Process E2E test results from Playwright
   */
  async processE2ETests() {
    const e2eResults = this.findFiles('e2e-results-*');
    
    for (const resultDir of e2eResults) {
      const resultsFile = path.join(resultDir, 'test-results', 'results.json');
      
      if (fs.existsSync(resultsFile)) {
        const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
        
        // Extract test statistics
        const stats = results.stats || {};
        this.results.summary.total += stats.expected || 0;
        this.results.summary.passed += stats.passed || 0;
        this.results.summary.failed += stats.failed || 0;
        this.results.summary.skipped += stats.skipped || 0;
        
        // Store detailed results
        this.results.details.e2e.push({
          project: this.extractProjectName(resultDir),
          stats: stats,
          duration: results.duration,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  /**
   * Process visual regression test results
   */
  async processVisualTests() {
    const visualResults = this.findFiles('visual-test-results');
    
    if (visualResults.length > 0) {
      const resultDir = visualResults[0];
      
      // Check Jest image snapshots
      const jestSnapshotsDir = path.join(resultDir, 'frontend', '__visual_tests__');
      if (fs.existsSync(jestSnapshotsDir)) {
        const snapshots = this.countFiles(jestSnapshotsDir, '.png');
        this.results.summary.visual.snapshots += snapshots;
      }
      
      // Check Playwright visual results
      const playwrightReportFile = path.join(resultDir, 'playwright-report', 'results.json');
      if (fs.existsSync(playwrightReportFile)) {
        const results = JSON.parse(fs.readFileSync(playwrightReportFile, 'utf8'));
        
        // Count visual comparison results
        const visualTests = results.suites?.flatMap(suite => 
          suite.tests?.filter(test => test.title.includes('visual') || test.title.includes('screenshot'))
        ) || [];
        
        this.results.summary.visual.snapshots += visualTests.length;
        this.results.summary.visual.changes += visualTests.filter(test => 
          test.results?.[0]?.status === 'failed'
        ).length;
      }
    }
  }

  /**
   * Process accessibility test results
   */
  async processAccessibilityTests() {
    const a11yResults = this.findFiles('accessibility-results');
    
    if (a11yResults.length > 0) {
      const resultDir = a11yResults[0];
      
      // Process Lighthouse accessibility scores
      const lighthouseDir = path.join(resultDir, '.lighthouseci');
      if (fs.existsSync(lighthouseDir)) {
        const reportFiles = fs.readdirSync(lighthouseDir).filter(f => f.endsWith('.json'));
        
        let totalScore = 0;
        let reportCount = 0;
        
        for (const reportFile of reportFiles) {
          try {
            const report = JSON.parse(fs.readFileSync(path.join(lighthouseDir, reportFile), 'utf8'));
            if (report.categories?.accessibility) {
              totalScore += report.categories.accessibility.score * 100;
              reportCount++;
            }
          } catch (error) {
            console.warn(`⚠️ Could not parse Lighthouse report: ${reportFile}`);
          }
        }
        
        if (reportCount > 0) {
          this.results.summary.accessibility.score = Math.round(totalScore / reportCount);
        }
      }
      
      // Process axe-core results
      const axeResultsFile = path.join(resultDir, 'axe-results.json');
      if (fs.existsSync(axeResultsFile)) {
        try {
          const axeResults = JSON.parse(fs.readFileSync(axeResultsFile, 'utf8'));
          this.results.summary.accessibility.violations = axeResults.violations?.length || 0;
        } catch (error) {
          console.warn('⚠️ Could not parse axe-core results');
        }
      }
    }
  }

  /**
   * Process performance test results
   */
  async processPerformanceTests() {
    const perfResults = this.findFiles('performance-results');
    
    if (perfResults.length > 0) {
      const resultDir = perfResults[0];
      
      // Process Lighthouse performance scores
      const lighthouseDir = path.join(resultDir, '.lighthouseci');
      if (fs.existsSync(lighthouseDir)) {
        const reportFiles = fs.readdirSync(lighthouseDir).filter(f => f.endsWith('.json'));
        
        let totalScore = 0;
        let totalFCP = 0;
        let reportCount = 0;
        
        for (const reportFile of reportFiles) {
          try {
            const report = JSON.parse(fs.readFileSync(path.join(reportFile), 'utf8'));
            
            if (report.categories?.performance) {
              totalScore += report.categories.performance.score * 100;
            }
            
            if (report.audits?.['first-contentful-paint']) {
              totalFCP += report.audits['first-contentful-paint'].numericValue;
            }
            
            reportCount++;
          } catch (error) {
            console.warn(`⚠️ Could not parse Lighthouse performance report: ${reportFile}`);
          }
        }
        
        if (reportCount > 0) {
          this.results.summary.performance.lighthouse = Math.round(totalScore / reportCount);
          this.results.summary.performance.loadTime = Math.round(totalFCP / reportCount);
        }
      }
      
      // Process bundle analysis
      const bundleFile = path.join(resultDir, 'frontend', 'bundle-analysis.json');
      if (fs.existsSync(bundleFile)) {
        try {
          const bundleAnalysis = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
          // Extract bundle size information
          this.results.summary.performance.bundleSize = bundleAnalysis.totalSize || 0;
        } catch (error) {
          console.warn('⚠️ Could not parse bundle analysis');
        }
      }
    }
  }

  /**
   * Process security test results
   */
  async processSecurityTests() {
    // Security results would be processed from SARIF files, audit outputs, etc.
    // This is a simplified implementation
    
    try {
      // Check for npm audit results
      const npmAuditCmd = 'npm audit --json --production';
      const npmAuditResult = JSON.parse(execSync(npmAuditCmd, { encoding: 'utf8', stdio: 'pipe' }));
      
      this.results.summary.security.vulnerabilities = npmAuditResult.metadata?.total || 0;
      this.results.summary.security.highSeverity = 
        (npmAuditResult.metadata?.high || 0) + (npmAuditResult.metadata?.critical || 0);
    } catch (error) {
      console.warn('⚠️ Could not get npm audit results');
    }
  }

  /**
   * Calculate overall summary metrics
   */
  calculateSummary() {
    // Calculate overall coverage
    const frontendCov = this.results.summary.coverage.frontend;
    const backendCov = this.results.summary.coverage.backend;
    
    if (frontendCov > 0 && backendCov > 0) {
      this.results.summary.coverage.overall = Math.round((frontendCov + backendCov) / 2);
    } else if (frontendCov > 0) {
      this.results.summary.coverage.overall = frontendCov;
    } else if (backendCov > 0) {
      this.results.summary.coverage.overall = backendCov;
    }
    
    // Calculate test success rate
    const total = this.results.summary.total;
    const passed = this.results.summary.passed;
    this.results.summary.successRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    // Calculate duration
    this.results.summary.duration = new Date() - this.startTime;
  }

  /**
   * Generate comprehensive reports
   */
  async generateReports() {
    // Generate Markdown report for PR comments
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync(path.join(ARTIFACTS_PATH, 'consolidated-report.md'), markdownReport);
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync(path.join(ARTIFACTS_PATH, 'test-report.html'), htmlReport);
    
    // Generate JSON summary
    fs.writeFileSync(
      path.join(ARTIFACTS_PATH, 'test-summary.json'), 
      JSON.stringify(this.results, null, 2)
    );
    
    console.log('📊 Reports generated:');
    console.log('  - consolidated-report.md (for PR comments)');
    console.log('  - test-report.html (detailed HTML report)');
    console.log('  - test-summary.json (machine-readable summary)');
  }

  /**
   * Generate Markdown report for GitHub PR comments
   */
  generateMarkdownReport() {
    const { summary } = this.results;
    const successRate = summary.successRate;
    const successIcon = successRate >= 90 ? '✅' : successRate >= 70 ? '⚠️' : '❌';
    
    return `## ${successIcon} Test Results Summary

### 📊 Overall Metrics
| Metric | Value | Status |
|--------|-------|--------|
| **Test Success Rate** | ${successRate}% (${summary.passed}/${summary.total}) | ${this.getStatusIcon(successRate, 90, 70)} |
| **Code Coverage** | ${summary.coverage.overall}% | ${this.getStatusIcon(summary.coverage.overall, 80, 60)} |
| **Performance Score** | ${summary.performance.lighthouse}% | ${this.getStatusIcon(summary.performance.lighthouse, 90, 70)} |
| **Accessibility Score** | ${summary.accessibility.score}% | ${this.getStatusIcon(summary.accessibility.score, 95, 85)} |
| **Security Issues** | ${summary.security.vulnerabilities} (${summary.security.highSeverity} high) | ${summary.security.highSeverity === 0 ? '✅' : '❌'} |

### 🔍 Test Breakdown
| Test Type | Passed | Failed | Skipped | Coverage |
|-----------|--------|--------|---------|----------|
| **Frontend Unit** | ${this.getTestStats('unit', 'frontend').passed} | ${this.getTestStats('unit', 'frontend').failed} | ${this.getTestStats('unit', 'frontend').skipped} | ${summary.coverage.frontend}% |
| **Backend Unit** | ${this.getTestStats('unit', 'backend').passed} | ${this.getTestStats('unit', 'backend').failed} | ${this.getTestStats('unit', 'backend').skipped} | ${summary.coverage.backend}% |
| **E2E Tests** | ${this.getTestStats('e2e').passed} | ${this.getTestStats('e2e').failed} | ${this.getTestStats('e2e').skipped} | - |
| **Visual Tests** | ${summary.visual.snapshots - summary.visual.changes} | ${summary.visual.changes} | 0 | - |
| **Accessibility** | ${summary.accessibility.violations === 0 ? '✅' : '❌'} | ${summary.accessibility.violations} violations | - | ${summary.accessibility.score}% |

### ⚡ Performance Metrics
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| **Lighthouse Score** | ${summary.performance.lighthouse}% | ≥90% | ${this.getStatusIcon(summary.performance.lighthouse, 90, 70)} |
| **Load Time (FCP)** | ${summary.performance.loadTime}ms | ≤2000ms | ${summary.performance.loadTime <= 2000 ? '✅' : '⚠️'} |
| **Bundle Size** | ${this.formatBytes(summary.performance.bundleSize)} | ≤5MB | ${summary.performance.bundleSize <= 5242880 ? '✅' : '⚠️'} |

### 🔒 Security Status
${summary.security.highSeverity === 0 ? 
  '✅ No high-severity vulnerabilities found' : 
  `❌ ${summary.security.highSeverity} high-severity vulnerabilities require attention`}

### 📊 Visual Changes
${summary.visual.changes === 0 ? 
  '✅ No visual regressions detected' : 
  `⚠️ ${summary.visual.changes} visual changes detected - please review`}

---
*Report generated on ${new Date().toISOString()} | Duration: ${Math.round(summary.duration / 1000)}s*

${this.generateActionableItems()}`;
  }

  /**
   * Generate HTML report for detailed viewing
   */
  generateHTMLReport() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rover Mission Control - Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 3px solid #0366d6; padding-bottom: 20px; margin-bottom: 30px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #28a745; }
        .metric-card.warning { border-left-color: #ffc107; }
        .metric-card.error { border-left-color: #dc3545; }
        .metric-value { font-size: 2em; font-weight: bold; color: #0366d6; }
        .metric-label { color: #586069; margin-top: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e1e4e8; }
        th { background: #f6f8fa; font-weight: 600; }
        .status-pass { color: #28a745; }
        .status-fail { color: #dc3545; }
        .status-warn { color: #ffc107; }
        .timeline { margin: 20px 0; }
        .timeline-item { margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Rover Mission Control - Test Report</h1>
            <p>Generated on ${new Date().toISOString()}</p>
        </div>
        
        <div class="metric-grid">
            <div class="metric-card ${this.getCardClass(this.results.summary.successRate, 90, 70)}">
                <div class="metric-value">${this.results.summary.successRate}%</div>
                <div class="metric-label">Test Success Rate</div>
            </div>
            <div class="metric-card ${this.getCardClass(this.results.summary.coverage.overall, 80, 60)}">
                <div class="metric-value">${this.results.summary.coverage.overall}%</div>
                <div class="metric-label">Code Coverage</div>
            </div>
            <div class="metric-card ${this.getCardClass(this.results.summary.performance.lighthouse, 90, 70)}">
                <div class="metric-value">${this.results.summary.performance.lighthouse}%</div>
                <div class="metric-label">Performance Score</div>
            </div>
            <div class="metric-card ${this.getCardClass(this.results.summary.accessibility.score, 95, 85)}">
                <div class="metric-value">${this.results.summary.accessibility.score}%</div>
                <div class="metric-label">Accessibility Score</div>
            </div>
        </div>
        
        ${this.generateDetailedHTMLSections()}
    </div>
</body>
</html>`;
  }

  /**
   * Utility methods
   */
  findFiles(pattern) {
    if (!fs.existsSync(ARTIFACTS_PATH)) return [];
    
    return fs.readdirSync(ARTIFACTS_PATH)
      .filter(name => name.includes(pattern.replace('*', '')))
      .map(name => path.join(ARTIFACTS_PATH, name))
      .filter(fullPath => fs.statSync(fullPath).isDirectory());
  }

  countFiles(dir, extension) {
    if (!fs.existsSync(dir)) return 0;
    
    return fs.readdirSync(dir, { recursive: true })
      .filter(file => file.endsWith(extension)).length;
  }

  extractProjectName(path) {
    const match = path.match(/e2e-results-([^-]+)/);
    return match ? match[1] : 'unknown';
  }

  getStatusIcon(value, goodThreshold, warnThreshold) {
    if (value >= goodThreshold) return '✅';
    if (value >= warnThreshold) return '⚠️';
    return '❌';
  }

  getCardClass(value, goodThreshold, warnThreshold) {
    if (value >= goodThreshold) return '';
    if (value >= warnThreshold) return 'warning';
    return 'error';
  }

  getTestStats(type, subtype = null) {
    const details = this.results.details[type] || [];
    const filtered = subtype ? details.filter(d => d.type === subtype) : details;
    
    return {
      passed: filtered.reduce((sum, d) => sum + (d.passed || 0), 0),
      failed: filtered.reduce((sum, d) => sum + (d.failed || 0), 0),
      skipped: filtered.reduce((sum, d) => sum + (d.skipped || 0), 0)
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateActionableItems() {
    const items = [];
    const { summary } = this.results;
    
    if (summary.coverage.overall < 80) {
      items.push('🎯 **Action Required**: Increase test coverage to meet 80% threshold');
    }
    
    if (summary.accessibility.violations > 0) {
      items.push('♿ **Action Required**: Fix accessibility violations for WCAG compliance');
    }
    
    if (summary.security.highSeverity > 0) {
      items.push('🔒 **Action Required**: Address high-severity security vulnerabilities');
    }
    
    if (summary.performance.lighthouse < 90) {
      items.push('⚡ **Action Required**: Optimize performance to meet Lighthouse threshold');
    }
    
    if (summary.visual.changes > 0) {
      items.push('👁️ **Review Required**: Visual changes detected - verify intentional');
    }
    
    if (items.length === 0) {
      return '### 🎉 All Checks Passed!\nNo action items - ready for deployment!';
    }
    
    return '### 📋 Action Items\n' + items.map(item => `- ${item}`).join('\n');
  }

  generateDetailedHTMLSections() {
    // Generate detailed HTML sections for each test type
    return `
        <h2>📊 Detailed Results</h2>
        <!-- Detailed sections would go here -->
        <p>See JSON summary for complete details.</p>
    `;
  }
}

// Execute if run directly
if (require.main === module) {
  const generator = new TestReportGenerator();
  generator.generate().catch(error => {
    console.error('Failed to generate test report:', error);
    process.exit(1);
  });
}

module.exports = TestReportGenerator;