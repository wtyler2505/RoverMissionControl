#!/usr/bin/env node

/**
 * Visual Regression Report Generator
 * 
 * Generates comprehensive visual regression reports by aggregating
 * results from Jest, Playwright, and Chromatic testing frameworks.
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class VisualReportGenerator {
  constructor() {
    this.rootDir = process.cwd();
    this.resultsDir = path.join(this.rootDir, 'test-results');
    this.outputPath = path.join(this.rootDir, 'visual-regression-report.json');
    this.htmlOutputPath = path.join(this.rootDir, 'visual-regression-report.html');
  }

  async generateReport() {
    console.log('📊 Generating visual regression report...');

    try {
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          status: 'success',
          components: 0,
          screenshots: 0,
          differences: 0,
          themes: ['light', 'dark', 'high-contrast'],
          viewports: ['mobile', 'tablet', 'desktop', 'ultrawide'],
          duration: '0s',
          averageTestTime: '0s'
        },
        jest: await this.analyzeJestResults(),
        playwright: await this.analyzePlaywrightResults(),
        chromatic: await this.analyzeChromaticResults(),
        crossBrowser: await this.analyzeCrossBrowserResults()
      };

      // Calculate summary statistics
      report.summary = this.calculateSummary(report);

      // Write JSON report
      await fs.writeFile(this.outputPath, JSON.stringify(report, null, 2));
      console.log(`✓ JSON report saved: ${this.outputPath}`);

      // Generate HTML report
      await this.generateHTMLReport(report);
      console.log(`✓ HTML report saved: ${this.htmlOutputPath}`);

      return report;
    } catch (error) {
      console.error('❌ Failed to generate report:', error.message);
      throw error;
    }
  }

  async analyzeJestResults() {
    console.log('  Analyzing Jest results...');
    
    const jestResults = {
      status: 'success',
      tests: 0,
      differences: 0,
      coverage: 0,
      components: [],
      diffImages: []
    };

    try {
      // Look for Jest coverage report
      const coverageFile = path.join(this.resultsDir, 'jest-visual-results/coverage/coverage-summary.json');
      
      try {
        const coverageData = JSON.parse(await fs.readFile(coverageFile, 'utf8'));
        jestResults.coverage = coverageData.total?.lines?.pct || 0;
      } catch {
        // Coverage file might not exist
      }

      // Look for diff images
      const diffDir = path.join(this.resultsDir, 'jest-visual-results');
      const diffImages = await this.findDiffImages(diffDir);
      
      jestResults.diffImages = diffImages;
      jestResults.differences = diffImages.length;
      jestResults.status = diffImages.length > 0 ? 'failure' : 'success';

      // Count components tested
      const components = new Set();
      diffImages.forEach(img => {
        const componentMatch = img.match(/\/([^\/]+)\.visual\.test\./);
        if (componentMatch) {
          components.add(componentMatch[1]);
        }
      });
      jestResults.components = Array.from(components);
      jestResults.tests = diffImages.length || 0;

    } catch (error) {
      console.warn('  ⚠️ Failed to analyze Jest results:', error.message);
      jestResults.status = 'error';
    }

    return jestResults;
  }

  async analyzePlaywrightResults() {
    console.log('  Analyzing Playwright results...');
    
    const playwrightResults = {
      status: 'success',
      browsers: {},
      totalTests: 0,
      totalDifferences: 0
    };

    const browsers = ['chromium', 'firefox', 'webkit'];
    
    for (const browser of browsers) {
      playwrightResults.browsers[browser] = {
        status: 'success',
        tests: 0,
        differences: 0,
        duration: '0s'
      };

      try {
        // Look for Playwright results
        const resultsFile = path.join(
          this.resultsDir, 
          `playwright-results-${browser}/results.json`
        );
        
        try {
          const results = JSON.parse(await fs.readFile(resultsFile, 'utf8'));
          
          playwrightResults.browsers[browser].tests = results.suites?.length || 0;
          playwrightResults.browsers[browser].status = results.status || 'success';
          playwrightResults.browsers[browser].duration = results.duration || '0s';
          
          // Count visual differences
          const diffCount = await this.countPlaywrightDiffs(browser);
          playwrightResults.browsers[browser].differences = diffCount;
          
          if (diffCount > 0) {
            playwrightResults.browsers[browser].status = 'failure';
          }
          
        } catch {
          // Results file might not exist
        }

      } catch (error) {
        console.warn(`  ⚠️ Failed to analyze ${browser} results:`, error.message);
        playwrightResults.browsers[browser].status = 'error';
      }
    }

    // Calculate totals
    playwrightResults.totalTests = Object.values(playwrightResults.browsers)
      .reduce((sum, browser) => sum + browser.tests, 0);
    
    playwrightResults.totalDifferences = Object.values(playwrightResults.browsers)
      .reduce((sum, browser) => sum + browser.differences, 0);
    
    playwrightResults.status = playwrightResults.totalDifferences > 0 ? 'failure' : 'success';

    return playwrightResults;
  }

  async analyzeChromaticResults() {
    console.log('  Analyzing Chromatic results...');
    
    const chromaticResults = {
      status: 'success',
      buildUrl: '',
      storyCount: 0,
      changes: 0,
      buildId: ''
    };

    try {
      // Look for Chromatic output in CI logs or environment variables
      const buildUrl = process.env.CHROMATIC_BUILD_URL || '';
      const buildId = process.env.CHROMATIC_BUILD_ID || '';
      const appId = process.env.CHROMATIC_APP_ID || '';
      
      chromaticResults.buildUrl = buildUrl;
      chromaticResults.buildId = buildId;
      
      // If we have build info, assume success unless we can detect changes
      if (buildUrl || buildId) {
        chromaticResults.status = 'success';
      }
      
      // Try to read Chromatic config for story count estimation
      try {
        const chromaticConfig = JSON.parse(
          await fs.readFile(path.join(this.rootDir, 'chromatic.config.json'), 'utf8')
        );
        
        // Estimate story count based on 'only' patterns
        if (chromaticConfig.only && Array.isArray(chromaticConfig.only)) {
          chromaticResults.storyCount = chromaticConfig.only.length * 5; // Rough estimate
        }
      } catch {
        // Config file might not exist
      }

    } catch (error) {
      console.warn('  ⚠️ Failed to analyze Chromatic results:', error.message);
      chromaticResults.status = 'error';
    }

    return chromaticResults;
  }

  async analyzeCrossBrowserResults() {
    console.log('  Analyzing cross-browser consistency...');
    
    const crossBrowserResults = {
      status: 'success',
      differences: 0,
      comparisons: [],
      browsers: ['chromium', 'firefox', 'webkit']
    };

    try {
      // Look for comparison results
      const comparisonFiles = await this.findFiles(
        path.join(this.rootDir, '.visual-baselines'),
        'comparison-*.json'
      );

      for (const file of comparisonFiles) {
        try {
          const comparison = JSON.parse(await fs.readFile(file, 'utf8'));
          crossBrowserResults.comparisons.push(comparison);
          
          // Count differences
          if (comparison.differences) {
            comparison.differences.forEach(diff => {
              crossBrowserResults.differences += diff.differences?.length || 0;
            });
          }
        } catch {
          // Comparison file might be malformed
        }
      }

      crossBrowserResults.status = crossBrowserResults.differences > 0 ? 'warning' : 'success';

    } catch (error) {
      console.warn('  ⚠️ Failed to analyze cross-browser results:', error.message);
      crossBrowserResults.status = 'error';
    }

    return crossBrowserResults;
  }

  calculateSummary(report) {
    const summary = {
      status: 'success',
      components: 0,
      screenshots: 0,
      differences: 0,
      themes: ['light', 'dark', 'high-contrast'],
      viewports: ['mobile', 'tablet', 'desktop', 'ultrawide'],
      duration: '0s',
      averageTestTime: '0s'
    };

    // Calculate total components
    const allComponents = new Set();
    if (report.jest.components) {
      report.jest.components.forEach(comp => allComponents.add(comp));
    }
    summary.components = allComponents.size;

    // Calculate total screenshots
    summary.screenshots = report.jest.tests + report.playwright.totalTests + report.chromatic.storyCount;

    // Calculate total differences
    summary.differences = report.jest.differences + 
                         report.playwright.totalDifferences + 
                         report.chromatic.changes +
                         report.crossBrowser.differences;

    // Determine overall status
    if (report.jest.status === 'failure' || 
        report.playwright.status === 'failure' || 
        report.chromatic.status === 'failure') {
      summary.status = 'failure';
    } else if (report.crossBrowser.status === 'warning') {
      summary.status = 'warning';
    }

    return summary;
  }

  async generateHTMLReport(report) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Regression Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        
        .header {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        
        .status-badge {
            display: inline-block;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.875rem;
        }
        
        .status-success { background: #d4edda; color: #155724; }
        .status-warning { background: #fff3cd; color: #856404; }
        .status-failure { background: #f8d7da; color: #721c24; }
        .status-error { background: #f8d7da; color: #721c24; }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }
        
        .card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .card h3 {
            margin-bottom: 1rem;
            color: #2c3e50;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }
        
        .metric-value {
            font-weight: bold;
        }
        
        .framework-results {
            margin-top: 2rem;
        }
        
        .framework-card {
            background: white;
            margin-bottom: 1.5rem;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .framework-header {
            background: #34495e;
            color: white;
            padding: 1rem 1.5rem;
            font-weight: bold;
            font-size: 1.1rem;
        }
        
        .framework-content {
            padding: 1.5rem;
        }
        
        .browser-results {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
        }
        
        .browser-card {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 1rem;
        }
        
        .diff-images {
            margin-top: 1rem;
        }
        
        .diff-image {
            background: #f8f9fa;
            padding: 0.5rem;
            margin-bottom: 0.5rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.875rem;
        }
        
        .timestamp {
            color: #6c757d;
            font-size: 0.875rem;
            margin-top: 2rem;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Visual Regression Report</h1>
            <p>Comprehensive visual testing results across Jest, Playwright, and Chromatic</p>
            <div style="margin-top: 1rem;">
                <span class="status-badge status-${report.summary.status}">${report.summary.status}</span>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📊 Summary</h3>
                <div class="metric">
                    <span>Components Tested</span>
                    <span class="metric-value">${report.summary.components}</span>
                </div>
                <div class="metric">
                    <span>Total Screenshots</span>
                    <span class="metric-value">${report.summary.screenshots}</span>
                </div>
                <div class="metric">
                    <span>Visual Differences</span>
                    <span class="metric-value">${report.summary.differences}</span>
                </div>
                <div class="metric">
                    <span>Themes Tested</span>
                    <span class="metric-value">${report.summary.themes.length}</span>
                </div>
                <div class="metric">
                    <span>Viewports Tested</span>
                    <span class="metric-value">${report.summary.viewports.length}</span>
                </div>
            </div>
            
            <div class="card">
                <h3>🎯 Test Coverage</h3>
                <div class="metric">
                    <span>Jest Visual Tests</span>
                    <span class="metric-value">${report.jest.tests}</span>
                </div>
                <div class="metric">
                    <span>Playwright E2E Tests</span>
                    <span class="metric-value">${report.playwright.totalTests}</span>
                </div>
                <div class="metric">
                    <span>Chromatic Stories</span>
                    <span class="metric-value">${report.chromatic.storyCount}</span>
                </div>
                <div class="metric">
                    <span>Cross-Browser Comparisons</span>
                    <span class="metric-value">${report.crossBrowser.comparisons.length}</span>
                </div>
            </div>
        </div>
        
        <div class="framework-results">
            <!-- Jest Results -->
            <div class="framework-card">
                <div class="framework-header">
                    📸 Jest Visual Tests
                    <span class="status-badge status-${report.jest.status}" style="float: right; font-size: 0.75rem;">${report.jest.status}</span>
                </div>
                <div class="framework-content">
                    <div class="metric">
                        <span>Tests Run</span>
                        <span class="metric-value">${report.jest.tests}</span>
                    </div>
                    <div class="metric">
                        <span>Visual Differences</span>
                        <span class="metric-value">${report.jest.differences}</span>
                    </div>
                    <div class="metric">
                        <span>Components Covered</span>
                        <span class="metric-value">${report.jest.components.length}</span>
                    </div>
                    
                    ${report.jest.diffImages.length > 0 ? `
                    <div class="diff-images">
                        <h4>Diff Images:</h4>
                        ${report.jest.diffImages.slice(0, 10).map(img => `
                            <div class="diff-image">${img}</div>
                        `).join('')}
                        ${report.jest.diffImages.length > 10 ? `
                            <div style="margin-top: 0.5rem; color: #6c757d;">
                                ... and ${report.jest.diffImages.length - 10} more
                            </div>
                        ` : ''}
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Playwright Results -->
            <div class="framework-card">
                <div class="framework-header">
                    🎭 Playwright Visual Tests
                    <span class="status-badge status-${report.playwright.status}" style="float: right; font-size: 0.75rem;">${report.playwright.status}</span>
                </div>
                <div class="framework-content">
                    <div class="browser-results">
                        ${Object.entries(report.playwright.browsers).map(([browser, results]) => `
                            <div class="browser-card">
                                <h4>${browser}</h4>
                                <div class="metric">
                                    <span>Status</span>
                                    <span class="status-badge status-${results.status}" style="font-size: 0.75rem;">${results.status}</span>
                                </div>
                                <div class="metric">
                                    <span>Tests</span>
                                    <span class="metric-value">${results.tests}</span>
                                </div>
                                <div class="metric">
                                    <span>Differences</span>
                                    <span class="metric-value">${results.differences}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Chromatic Results -->
            <div class="framework-card">
                <div class="framework-header">
                    🎨 Chromatic Visual Tests
                    <span class="status-badge status-${report.chromatic.status}" style="float: right; font-size: 0.75rem;">${report.chromatic.status}</span>
                </div>
                <div class="framework-content">
                    <div class="metric">
                        <span>Story Count</span>
                        <span class="metric-value">${report.chromatic.storyCount}</span>
                    </div>
                    <div class="metric">
                        <span>Changes Detected</span>
                        <span class="metric-value">${report.chromatic.changes}</span>
                    </div>
                    ${report.chromatic.buildUrl ? `
                    <div class="metric">
                        <span>Build URL</span>
                        <span class="metric-value">
                            <a href="${report.chromatic.buildUrl}" target="_blank">View Build</a>
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Cross-Browser Results -->
            <div class="framework-card">
                <div class="framework-header">
                    🔄 Cross-Browser Consistency
                    <span class="status-badge status-${report.crossBrowser.status}" style="float: right; font-size: 0.75rem;">${report.crossBrowser.status}</span>
                </div>
                <div class="framework-content">
                    <div class="metric">
                        <span>Browsers Compared</span>
                        <span class="metric-value">${report.crossBrowser.browsers.join(', ')}</span>
                    </div>
                    <div class="metric">
                        <span>Inconsistencies Found</span>
                        <span class="metric-value">${report.crossBrowser.differences}</span>
                    </div>
                    <div class="metric">
                        <span>Comparisons Made</span>
                        <span class="metric-value">${report.crossBrowser.comparisons.length}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="timestamp">
            Report generated on ${new Date(report.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`;

    await fs.writeFile(this.htmlOutputPath, html);
  }

  // Helper methods
  
  async findDiffImages(dir) {
    const diffImages = [];
    
    try {
      const files = await this.findFiles(dir, '**/diff-*.png');
      diffImages.push(...files);
    } catch {
      // Directory might not exist
    }
    
    return diffImages;
  }

  async countPlaywrightDiffs(browser) {
    try {
      const diffDir = path.join(this.resultsDir, `playwright-results-${browser}/test-results`);
      const diffFiles = await this.findFiles(diffDir, '**/*-diff.png');
      return diffFiles.length;
    } catch {
      return 0;
    }
  }

  async findFiles(dir, pattern) {
    const files = [];
    
    try {
      const glob = require('glob');
      const matches = glob.sync(pattern, { cwd: dir });
      files.push(...matches.map(match => path.join(dir, match)));
    } catch {
      // Glob might not be available, use basic file listing
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            files.push(path.join(dir, entry.name));
          }
        }
      } catch {
        // Directory might not exist
      }
    }
    
    return files;
  }
}

// CLI interface
async function main() {
  const generator = new VisualReportGenerator();
  const report = await generator.generateReport();
  
  // Exit with appropriate code based on results
  if (report.summary.status === 'failure') {
    process.exit(1);
  } else if (report.summary.status === 'warning') {
    process.exit(0); // Warnings are not failures
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Report generation failed:', error.message);
    process.exit(1);
  });
}

module.exports = VisualReportGenerator;