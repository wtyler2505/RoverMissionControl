/**
 * Accessibility Report Generator
 * 
 * Consolidates results from all accessibility testing tools into a comprehensive report
 * Provides WCAG 2.1 AA compliance assessment and recommendations
 */

const fs = require('fs');
const path = require('path');

class AccessibilityReportGenerator {
  constructor(options = {}) {
    this.options = {
      reportDir: options.reportDir || './reports/accessibility',
      inputDirs: {
        jest: './frontend/coverage',
        playwright: './playwright-report',
        lighthouse: './.lighthouseci',
        axe: './axe-results.json',
        screenReader: './reports/screen-reader',
        colorContrast: './reports/color-contrast'
      },
      ...options
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.options.reportDir)) {
      fs.mkdirSync(this.options.reportDir, { recursive: true });
    }
  }

  async generateComprehensiveReport() {
    console.log('Generating comprehensive accessibility report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      metadata: {
        wcagVersion: '2.1',
        complianceLevel: 'AA',
        testingTools: ['jest-axe', 'playwright', 'lighthouse', 'axe-core', 'screen-reader-sim', 'color-contrast'],
        environment: process.env.NODE_ENV || 'development'
      },
      summary: {
        overallScore: 0,
        criticalIssues: 0,
        seriousIssues: 0,
        moderateIssues: 0,
        minorIssues: 0,
        passedChecks: 0,
        totalChecks: 0,
        compliancePercentage: 0
      },
      results: {},
      recommendations: [],
      wcagCriteria: this.getWCAGCriteria()
    };

    // Collect results from all testing tools
    report.results.jest = await this.collectJestResults();
    report.results.playwright = await this.collectPlaywrightResults();
    report.results.lighthouse = await this.collectLighthouseResults();
    report.results.axe = await this.collectAxeResults();
    report.results.screenReader = await this.collectScreenReaderResults();
    report.results.colorContrast = await this.collectColorContrastResults();

    // Calculate overall summary
    this.calculateSummary(report);
    
    // Generate recommendations
    this.generateRecommendations(report);
    
    // Generate reports in multiple formats
    await this.saveReports(report);
    
    console.log(`Accessibility report generated in ${this.options.reportDir}`);
    return report;
  }

  async collectJestResults() {
    const results = {
      available: false,
      summary: { tests: 0, passed: 0, failed: 0, coverage: 0 },
      violations: []
    };

    try {
      // Look for Jest test results
      const testResultsPath = path.join(this.options.inputDirs.jest, 'lcov-report', 'index.html');
      if (fs.existsSync(testResultsPath)) {
        results.available = true;
        
        // Try to find accessibility test results
        const coveragePath = path.join(this.options.inputDirs.jest, 'coverage-summary.json');
        if (fs.existsSync(coveragePath)) {
          const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
          results.summary.coverage = coverage.total?.lines?.pct || 0;
        }
      }
    } catch (error) {
      console.warn('Could not collect Jest results:', error.message);
    }

    return results;
  }

  async collectPlaywrightResults() {
    const results = {
      available: false,
      summary: { tests: 0, passed: 0, failed: 0 },
      violations: []
    };

    try {
      const reportPath = path.join(this.options.inputDirs.playwright, 'report.html');
      if (fs.existsSync(reportPath)) {
        results.available = true;
        // Parse Playwright results if available
        // This would require parsing the HTML report or JSON results
      }
    } catch (error) {
      console.warn('Could not collect Playwright results:', error.message);
    }

    return results;
  }

  async collectLighthouseResults() {
    const results = {
      available: false,
      accessibilityScore: 0,
      violations: [],
      audits: {}
    };

    try {
      const manifestPath = path.join(this.options.inputDirs.lighthouse, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        if (manifest.length > 0) {
          const latestRun = manifest[manifest.length - 1];
          const reportPath = path.join(this.options.inputDirs.lighthouse, latestRun.htmlPath);
          
          if (fs.existsSync(reportPath.replace('.html', '.json'))) {
            const reportData = JSON.parse(fs.readFileSync(reportPath.replace('.html', '.json'), 'utf8'));
            
            results.available = true;
            results.accessibilityScore = reportData.categories?.accessibility?.score * 100 || 0;
            
            // Extract accessibility audit results
            Object.entries(reportData.audits || {}).forEach(([key, audit]) => {
              if (key.includes('aria-') || key.includes('color-contrast') || key.includes('heading-order')) {
                results.audits[key] = {
                  score: audit.score,
                  title: audit.title,
                  description: audit.description,
                  details: audit.details
                };
                
                if (audit.score < 1) {
                  results.violations.push({
                    rule: key,
                    impact: audit.score < 0.5 ? 'serious' : 'moderate',
                    description: audit.description,
                    help: audit.title
                  });
                }
              }
            });
          }
        }
      }
    } catch (error) {
      console.warn('Could not collect Lighthouse results:', error.message);
    }

    return results;
  }

  async collectAxeResults() {
    const results = {
      available: false,
      violations: [],
      passes: [],
      incomplete: []
    };

    try {
      if (fs.existsSync(this.options.inputDirs.axe)) {
        const axeData = JSON.parse(fs.readFileSync(this.options.inputDirs.axe, 'utf8'));
        
        results.available = true;
        results.violations = (axeData.violations || []).map(v => ({
          rule: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodeCount: v.nodes?.length || 0,
          tags: v.tags
        }));
        
        results.passes = (axeData.passes || []).map(p => ({
          rule: p.id,
          description: p.description,
          nodeCount: p.nodes?.length || 0
        }));
        
        results.incomplete = (axeData.incomplete || []).map(i => ({
          rule: i.id,
          description: i.description,
          nodeCount: i.nodes?.length || 0
        }));
      }
    } catch (error) {
      console.warn('Could not collect Axe results:', error.message);
    }

    return results;
  }

  async collectScreenReaderResults() {
    const results = {
      available: false,
      summary: {},
      issues: []
    };

    try {
      const reportPath = path.join(this.options.inputDirs.screenReader, 'screen-reader-report.json');
      if (fs.existsSync(reportPath)) {
        // Screen reader results would be collected here
        results.available = true;
      }
    } catch (error) {
      console.warn('Could not collect screen reader results:', error.message);
    }

    return results;
  }

  async collectColorContrastResults() {
    const results = {
      available: false,
      overallPassRate: 0,
      violations: [],
      summary: {}
    };

    try {
      const reportPath = path.join(this.options.inputDirs.colorContrast, 'color-contrast-report.json');
      if (fs.existsSync(reportPath)) {
        const contrastData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        
        results.available = true;
        results.overallPassRate = contrastData.summary?.overallResults?.passRate || 0;
        results.violations = contrastData.reports?.flatMap(r => r.results?.violations || []) || [];
        results.summary = contrastData.summary?.overallResults || {};
      }
    } catch (error) {
      console.warn('Could not collect color contrast results:', error.message);
    }

    return results;
  }

  calculateSummary(report) {
    let totalChecks = 0;
    let passedChecks = 0;
    let criticalIssues = 0;
    let seriousIssues = 0;
    let moderateIssues = 0;
    let minorIssues = 0;

    // Count Axe results
    if (report.results.axe.available) {
      totalChecks += report.results.axe.violations.length + report.results.axe.passes.length;
      passedChecks += report.results.axe.passes.length;
      
      report.results.axe.violations.forEach(v => {
        switch (v.impact) {
          case 'critical':
            criticalIssues++;
            break;
          case 'serious':
            seriousIssues++;
            break;
          case 'moderate':
            moderateIssues++;
            break;
          case 'minor':
            minorIssues++;
            break;
        }
      });
    }

    // Count Lighthouse results
    if (report.results.lighthouse.available) {
      const lighthouseAudits = Object.values(report.results.lighthouse.audits);
      totalChecks += lighthouseAudits.length;
      passedChecks += lighthouseAudits.filter(a => a.score === 1).length;
      
      report.results.lighthouse.violations.forEach(v => {
        if (v.impact === 'serious') {
          seriousIssues++;
        } else {
          moderateIssues++;
        }
      });
    }

    // Count color contrast results
    if (report.results.colorContrast.available) {
      const contrastViolations = report.results.colorContrast.violations;
      totalChecks += report.results.colorContrast.summary.totalTextElements || 0;
      passedChecks += (report.results.colorContrast.summary.totalTextElements || 0) - contrastViolations.length;
      
      contrastViolations.forEach(v => {
        if (v.contrast < 3.0) {
          criticalIssues++;
        } else if (v.contrast < 4.5) {
          seriousIssues++;
        } else {
          moderateIssues++;
        }
      });
    }

    // Calculate overall score (weighted)
    const lighthouseWeight = 0.3;
    const axeWeight = 0.4;
    const contrastWeight = 0.3;
    
    let overallScore = 0;
    let weightSum = 0;
    
    if (report.results.lighthouse.available) {
      overallScore += report.results.lighthouse.accessibilityScore * lighthouseWeight;
      weightSum += lighthouseWeight;
    }
    
    if (report.results.axe.available && totalChecks > 0) {
      const axeScore = (passedChecks / totalChecks) * 100;
      overallScore += axeScore * axeWeight;
      weightSum += axeWeight;
    }
    
    if (report.results.colorContrast.available) {
      overallScore += report.results.colorContrast.overallPassRate * contrastWeight;
      weightSum += contrastWeight;
    }
    
    if (weightSum > 0) {
      overallScore = overallScore / weightSum;
    }

    // Update summary
    report.summary = {
      overallScore: Math.round(overallScore),
      criticalIssues,
      seriousIssues,
      moderateIssues,
      minorIssues,
      passedChecks,
      totalChecks,
      compliancePercentage: totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100
    };
  }

  generateRecommendations(report) {
    const recommendations = [];

    // Critical issues recommendations
    if (report.summary.criticalIssues > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'WCAG 2.1 Level A',
        title: 'Fix Critical Accessibility Violations',
        description: `${report.summary.criticalIssues} critical accessibility issues must be addressed immediately.`,
        impact: 'These issues prevent users with disabilities from accessing key functionality.',
        effort: 'High',
        wcagCriteria: ['1.1.1', '1.3.1', '1.4.3', '2.1.1', '4.1.2']
      });
    }

    // Color contrast recommendations
    if (report.results.colorContrast.available && report.results.colorContrast.violations.length > 0) {
      const contrastViolations = report.results.colorContrast.violations.length;
      recommendations.push({
        priority: contrastViolations > 10 ? 'high' : 'medium',
        category: 'Color Contrast',
        title: 'Improve Color Contrast Ratios',
        description: `${contrastViolations} elements fail WCAG color contrast requirements.`,
        impact: 'Users with visual impairments may not be able to read text content.',
        effort: 'Medium',
        wcagCriteria: ['1.4.3', '1.4.6'],
        actions: [
          'Review color palette for sufficient contrast ratios',
          'Use online contrast checkers during design phase',
          'Implement automated contrast testing in CI/CD pipeline'
        ]
      });
    }

    // Keyboard navigation recommendations
    if (report.results.axe.available) {
      const keyboardIssues = report.results.axe.violations.filter(v => 
        v.tags.includes('keyboard') || v.rule.includes('tabindex') || v.rule.includes('focus')
      );
      
      if (keyboardIssues.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'Keyboard Navigation',
          title: 'Enhance Keyboard Accessibility',
          description: `${keyboardIssues.length} keyboard navigation issues found.`,
          impact: 'Users who rely on keyboard navigation cannot access all functionality.',
          effort: 'Medium',
          wcagCriteria: ['2.1.1', '2.1.2', '2.4.3', '2.4.7'],
          actions: [
            'Ensure all interactive elements are keyboard accessible',
            'Implement proper focus management in modal dialogs',
            'Add skip links for navigation',
            'Test with keyboard-only navigation'
          ]
        });
      }
    }

    // Screen reader recommendations
    if (report.results.axe.available) {
      const ariaIssues = report.results.axe.violations.filter(v => 
        v.rule.includes('aria-') || v.tags.includes('aria')
      );
      
      if (ariaIssues.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'Screen Reader Support',
          title: 'Improve ARIA Implementation',
          description: `${ariaIssues.length} ARIA-related issues found.`,
          impact: 'Screen reader users may not understand page structure and functionality.',
          effort: 'Medium',
          wcagCriteria: ['1.3.1', '4.1.2'],
          actions: [
            'Add proper ARIA labels to interactive elements',
            'Implement ARIA live regions for dynamic content',
            'Ensure semantic HTML is used correctly',
            'Test with actual screen readers'
          ]
        });
      }
    }

    // Form accessibility recommendations
    if (report.results.axe.available) {
      const formIssues = report.results.axe.violations.filter(v => 
        v.rule.includes('label') || v.rule.includes('form')
      );
      
      if (formIssues.length > 0) {
        recommendations.push({
          priority: 'medium',
          category: 'Form Accessibility',
          title: 'Improve Form Labeling',
          description: `${formIssues.length} form accessibility issues found.`,
          impact: 'Users may not understand form field purposes or requirements.',
          effort: 'Low',
          wcagCriteria: ['1.3.1', '3.3.2'],
          actions: [
            'Associate labels with form controls',
            'Add required field indicators',
            'Provide clear error messages',
            'Group related form fields with fieldsets'
          ]
        });
      }
    }

    // General improvements
    if (report.summary.overallScore < 95) {
      recommendations.push({
        priority: 'medium',
        category: 'General Improvements',
        title: 'Establish Accessibility Testing Process',
        description: 'Implement systematic accessibility testing in development workflow.',
        impact: 'Prevents future accessibility issues and ensures consistent compliance.',
        effort: 'High',
        wcagCriteria: ['All'],
        actions: [
          'Add accessibility linting to IDE and build process',
          'Conduct regular accessibility audits',
          'Train development team on accessibility best practices',
          'Include accessibility criteria in definition of done'
        ]
      });
    }

    report.recommendations = recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  getWCAGCriteria() {
    return {
      'Level A': {
        '1.1.1': 'Non-text Content',
        '1.2.1': 'Audio-only and Video-only (Prerecorded)',
        '1.2.2': 'Captions (Prerecorded)',
        '1.2.3': 'Audio Description or Media Alternative (Prerecorded)',
        '1.3.1': 'Info and Relationships',
        '1.3.2': 'Meaningful Sequence',
        '1.3.3': 'Sensory Characteristics',
        '1.4.1': 'Use of Color',
        '1.4.2': 'Audio Control',
        '2.1.1': 'Keyboard',
        '2.1.2': 'No Keyboard Trap',
        '2.1.4': 'Character Key Shortcuts',
        '2.2.1': 'Timing Adjustable',
        '2.2.2': 'Pause, Stop, Hide',
        '2.3.1': 'Three Flashes or Below Threshold',
        '2.4.1': 'Bypass Blocks',
        '2.4.2': 'Page Titled',
        '2.4.3': 'Focus Order',
        '2.4.4': 'Link Purpose (In Context)',
        '2.5.1': 'Pointer Gestures',
        '2.5.2': 'Pointer Cancellation',
        '2.5.3': 'Label in Name',
        '2.5.4': 'Motion Actuation',
        '3.1.1': 'Language of Page',
        '3.2.1': 'On Focus',
        '3.2.2': 'On Input',
        '3.3.1': 'Error Identification',
        '3.3.2': 'Labels or Instructions',
        '4.1.1': 'Parsing',
        '4.1.2': 'Name, Role, Value'
      },
      'Level AA': {
        '1.2.4': 'Captions (Live)',
        '1.2.5': 'Audio Description (Prerecorded)',
        '1.3.4': 'Orientation',
        '1.3.5': 'Identify Input Purpose',
        '1.4.3': 'Contrast (Minimum)',
        '1.4.4': 'Resize text',
        '1.4.5': 'Images of Text',
        '1.4.10': 'Reflow',
        '1.4.11': 'Non-text Contrast',
        '1.4.12': 'Text Spacing',
        '1.4.13': 'Content on Hover or Focus',
        '2.4.5': 'Multiple Ways',
        '2.4.6': 'Headings and Labels',
        '2.4.7': 'Focus Visible',
        '2.4.11': 'Focus Not Obscured (Minimum)',
        '3.1.2': 'Language of Parts',
        '3.2.3': 'Consistent Navigation',
        '3.2.4': 'Consistent Identification',
        '3.3.3': 'Error Suggestion',
        '3.3.4': 'Error Prevention (Legal, Financial, Data)'
      }
    };
  }

  async saveReports(report) {
    // Save JSON report
    const jsonPath = path.join(this.options.reportDir, 'accessibility-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Generate and save HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(this.options.reportDir, 'accessibility-report.html');
    fs.writeFileSync(htmlPath, htmlReport);

    // Generate and save CSV summary
    const csvReport = this.generateCsvReport(report);
    const csvPath = path.join(this.options.reportDir, 'accessibility-summary.csv');
    fs.writeFileSync(csvPath, csvReport);

    console.log(`Reports saved to:`);
    console.log(`- JSON: ${jsonPath}`);
    console.log(`- HTML: ${htmlPath}`);
    console.log(`- CSV: ${csvPath}`);
  }

  generateHtmlReport(report) {
    const getScoreColor = (score) => {
      if (score >= 95) return '#28a745';
      if (score >= 80) return '#ffc107';
      return '#dc3545';
    };

    const getPriorityColor = (priority) => {
      switch (priority) {
        case 'critical': return '#dc3545';
        case 'high': return '#fd7e14';
        case 'medium': return '#ffc107';
        case 'low': return '#6c757d';
        default: return '#6c757d';
      }
    };

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Accessibility Compliance Report - WCAG 2.1 AA</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .score-card { display: inline-block; text-align: center; margin: 0 20px; }
        .score-number { font-size: 3em; font-weight: bold; margin: 0; }
        .score-label { font-size: 0.9em; color: #6c757d; margin-top: 5px; }
        .section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .priority-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-size: 0.8em; font-weight: bold; text-transform: uppercase; }
        .recommendation { border-left: 4px solid #007bff; padding: 15px; margin: 10px 0; background: #f8f9fa; }
        .recommendation h4 { margin: 0 0 10px 0; }
        .recommendation .actions { margin-top: 10px; }
        .recommendation .actions li { margin: 5px 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; margin: 0; }
        .stat-label { font-size: 0.9em; color: #6c757d; }
        .tool-results { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .tool-card { border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; }
        .tool-available { border-left: 4px solid #28a745; }
        .tool-unavailable { border-left: 4px solid #dc3545; }
        .wcag-criteria { font-size: 0.8em; color: #6c757d; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background: #f8f9fa; font-weight: 600; }
        .violation-item { background: #ffe6e6; padding: 10px; margin: 5px 0; border-left: 4px solid #dc3545; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Accessibility Compliance Report</h1>
          <p><strong>WCAG 2.1 Level AA Compliance Assessment</strong></p>
          <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div class="score-card">
              <div class="score-number" style="color: ${getScoreColor(report.summary.overallScore)}">
                ${report.summary.overallScore}
              </div>
              <div class="score-label">Overall Score</div>
            </div>
            
            <div class="score-card">
              <div class="score-number" style="color: ${getScoreColor(report.summary.compliancePercentage)}">
                ${report.summary.compliancePercentage}%
              </div>
              <div class="score-label">Compliance Rate</div>
            </div>
            
            <div class="score-card">
              <div class="score-number" style="color: ${report.summary.criticalIssues > 0 ? '#dc3545' : '#28a745'}">
                ${report.summary.criticalIssues + report.summary.seriousIssues}
              </div>
              <div class="score-label">High Priority Issues</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Executive Summary</h2>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number" style="color: #dc3545;">${report.summary.criticalIssues}</div>
              <div class="stat-label">Critical Issues</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" style="color: #fd7e14;">${report.summary.seriousIssues}</div>
              <div class="stat-label">Serious Issues</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" style="color: #ffc107;">${report.summary.moderateIssues}</div>
              <div class="stat-label">Moderate Issues</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" style="color: #6c757d;">${report.summary.minorIssues}</div>
              <div class="stat-label">Minor Issues</div>
            </div>
            <div class="stat-card">
              <div class="stat-number" style="color: #28a745;">${report.summary.passedChecks}</div>
              <div class="stat-label">Passed Checks</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">${report.summary.totalChecks}</div>
              <div class="stat-label">Total Checks</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Testing Tools Results</h2>
          <div class="tool-results">
            <div class="tool-card ${report.results.axe.available ? 'tool-available' : 'tool-unavailable'}">
              <h4>Axe-Core Accessibility Testing</h4>
              ${report.results.axe.available ? `
                <p><strong>Violations:</strong> ${report.results.axe.violations.length}</p>
                <p><strong>Passed:</strong> ${report.results.axe.passes.length}</p>
                <p><strong>Status:</strong> ✅ Available</p>
              ` : '<p><strong>Status:</strong> ❌ No results found</p>'}
            </div>
            
            <div class="tool-card ${report.results.lighthouse.available ? 'tool-available' : 'tool-unavailable'}">
              <h4>Lighthouse Accessibility Audit</h4>
              ${report.results.lighthouse.available ? `
                <p><strong>Score:</strong> ${report.results.lighthouse.accessibilityScore}/100</p>
                <p><strong>Violations:</strong> ${report.results.lighthouse.violations.length}</p>
                <p><strong>Status:</strong> ✅ Available</p>
              ` : '<p><strong>Status:</strong> ❌ No results found</p>'}
            </div>
            
            <div class="tool-card ${report.results.colorContrast.available ? 'tool-available' : 'tool-unavailable'}">
              <h4>Color Contrast Analysis</h4>
              ${report.results.colorContrast.available ? `
                <p><strong>Pass Rate:</strong> ${report.results.colorContrast.overallPassRate}%</p>
                <p><strong>Violations:</strong> ${report.results.colorContrast.violations.length}</p>
                <p><strong>Status:</strong> ✅ Available</p>
              ` : '<p><strong>Status:</strong> ❌ No results found</p>'}
            </div>
            
            <div class="tool-card ${report.results.jest.available ? 'tool-available' : 'tool-unavailable'}">
              <h4>Jest Unit Tests</h4>
              ${report.results.jest.available ? `
                <p><strong>Coverage:</strong> ${report.results.jest.summary.coverage}%</p>
                <p><strong>Status:</strong> ✅ Available</p>
              ` : '<p><strong>Status:</strong> ❌ No results found</p>'}
            </div>
            
            <div class="tool-card ${report.results.playwright.available ? 'tool-available' : 'tool-unavailable'}">
              <h4>Playwright E2E Tests</h4>
              ${report.results.playwright.available ? `
                <p><strong>Tests:</strong> ${report.results.playwright.summary.tests}</p>
                <p><strong>Status:</strong> ✅ Available</p>
              ` : '<p><strong>Status:</strong> ❌ No results found</p>'}
            </div>
            
            <div class="tool-card ${report.results.screenReader.available ? 'tool-available' : 'tool-unavailable'}">
              <h4>Screen Reader Testing</h4>
              ${report.results.screenReader.available ? `
                <p><strong>Status:</strong> ✅ Available</p>
              ` : '<p><strong>Status:</strong> ❌ No results found</p>'}
            </div>
          </div>
        </div>

        ${report.recommendations.length > 0 ? `
        <div class="section">
          <h2>Recommendations</h2>
          ${report.recommendations.map(rec => `
            <div class="recommendation">
              <h4>
                <span class="priority-badge" style="background-color: ${getPriorityColor(rec.priority)}">
                  ${rec.priority}
                </span>
                ${rec.title}
              </h4>
              <p><strong>Category:</strong> ${rec.category}</p>
              <p><strong>Description:</strong> ${rec.description}</p>
              <p><strong>Impact:</strong> ${rec.impact}</p>
              <p><strong>Effort:</strong> ${rec.effort}</p>
              <p class="wcag-criteria"><strong>WCAG Criteria:</strong> ${rec.wcagCriteria.join(', ')}</p>
              ${rec.actions ? `
                <div class="actions">
                  <strong>Recommended Actions:</strong>
                  <ul>
                    ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${report.results.axe.available && report.results.axe.violations.length > 0 ? `
        <div class="section">
          <h2>Detailed Violations</h2>
          <h3>Axe-Core Violations</h3>
          ${report.results.axe.violations.map(v => `
            <div class="violation-item">
              <h4>${v.rule} (${v.impact})</h4>
              <p>${v.description}</p>
              <p><strong>Help:</strong> ${v.help}</p>
              <p><strong>Affected Elements:</strong> ${v.nodeCount}</p>
              <p><strong>Tags:</strong> ${v.tags.join(', ')}</p>
              ${v.helpUrl ? `<p><a href="${v.helpUrl}" target="_blank">More Information</a></p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="section">
          <h2>WCAG 2.1 Criteria Coverage</h2>
          <p>This assessment covers the following WCAG 2.1 success criteria:</p>
          
          <h3>Level A Criteria</h3>
          <table>
            <tr><th>Criterion</th><th>Title</th></tr>
            ${Object.entries(report.wcagCriteria['Level A']).map(([num, title]) => `
              <tr><td>${num}</td><td>${title}</td></tr>
            `).join('')}
          </table>
          
          <h3>Level AA Criteria</h3>
          <table>
            <tr><th>Criterion</th><th>Title</th></tr>
            ${Object.entries(report.wcagCriteria['Level AA']).map(([num, title]) => `
              <tr><td>${num}</td><td>${title}</td></tr>
            `).join('')}
          </table>
        </div>

        <div class="section">
          <h2>Next Steps</h2>
          <ol>
            <li><strong>Address Critical Issues:</strong> Fix all critical accessibility violations immediately</li>
            <li><strong>Implement Recommendations:</strong> Follow the prioritized recommendations above</li>
            <li><strong>Automated Testing:</strong> Integrate accessibility testing into your CI/CD pipeline</li>
            <li><strong>Manual Testing:</strong> Conduct regular manual testing with assistive technologies</li>
            <li><strong>User Testing:</strong> Include users with disabilities in your testing process</li>
            <li><strong>Training:</strong> Provide accessibility training for your development team</li>
            <li><strong>Regular Audits:</strong> Schedule regular accessibility audits to maintain compliance</li>
          </ol>
        </div>

        <div class="section">
          <p><small>
            <strong>Report Information:</strong><br>
            Generated by: Rover Mission Control Accessibility Testing Suite<br>
            Timestamp: ${report.timestamp}<br>
            WCAG Version: ${report.metadata.wcagVersion}<br>
            Compliance Level: ${report.metadata.complianceLevel}<br>
            Testing Tools: ${report.metadata.testingTools.join(', ')}
          </small></p>
        </div>
      </div>
    </body>
    </html>`;
  }

  generateCsvReport(report) {
    let csv = 'Category,Issue,Priority,Impact,Effort,WCAG Criteria,Description\n';
    
    report.recommendations.forEach(rec => {
      const row = [
        rec.category,
        rec.title,
        rec.priority,
        rec.impact.replace(/,/g, ';'),
        rec.effort,
        rec.wcagCriteria.join(';'),
        rec.description.replace(/,/g, ';')
      ].map(field => `"${field}"`).join(',');
      
      csv += row + '\n';
    });
    
    return csv;
  }
}

// Main execution function
async function generateAccessibilityReport() {
  const generator = new AccessibilityReportGenerator();
  
  try {
    const report = await generator.generateComprehensiveReport();
    
    console.log('\n=== Accessibility Report Summary ===');
    console.log(`Overall Score: ${report.summary.overallScore}/100`);
    console.log(`Compliance Rate: ${report.summary.compliancePercentage}%`);
    console.log(`Critical Issues: ${report.summary.criticalIssues}`);
    console.log(`Serious Issues: ${report.summary.seriousIssues}`);
    console.log(`Total Recommendations: ${report.recommendations.length}`);
    
    if (report.summary.criticalIssues > 0) {
      console.log('\n❌ Critical accessibility issues found - immediate action required');
      process.exit(1);
    } else if (report.summary.overallScore < 80) {
      console.log('\n⚠️ Accessibility score below threshold - improvements needed');
      process.exit(1);
    } else {
      console.log('\n✅ Accessibility report generated successfully');
    }
    
  } catch (error) {
    console.error('Failed to generate accessibility report:', error);
    process.exit(1);
  }
}

// Export for use as module or run directly
if (require.main === module) {
  generateAccessibilityReport().catch(console.error);
}

module.exports = { AccessibilityReportGenerator };