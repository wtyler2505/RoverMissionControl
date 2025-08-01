#!/usr/bin/env node
/**
 * Coverage Consolidation Tool
 * 
 * Combines coverage reports from multiple sources (Jest, pytest, Playwright)
 * and generates a unified coverage report with quality gates.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || './test-artifacts';
const COVERAGE_THRESHOLD = parseInt(process.env.COVERAGE_THRESHOLD || '80');

class CoverageConsolidator {
  constructor() {
    this.coverageData = {
      frontend: {
        lines: { covered: 0, total: 0, pct: 0 },
        functions: { covered: 0, total: 0, pct: 0 },
        branches: { covered: 0, total: 0, pct: 0 },
        statements: { covered: 0, total: 0, pct: 0 },
        files: []
      },
      backend: {
        lines: { covered: 0, total: 0, pct: 0 },
        functions: { covered: 0, total: 0, pct: 0 },
        branches: { covered: 0, total: 0, pct: 0 },
        statements: { covered: 0, total: 0, pct: 0 },
        files: []
      },
      e2e: {
        lines: { covered: 0, total: 0, pct: 0 },
        files: []
      },
      overall: {
        lines: { covered: 0, total: 0, pct: 0 },
        functions: { covered: 0, total: 0, pct: 0 },
        branches: { covered: 0, total: 0, pct: 0 },
        statements: { covered: 0, total: 0, pct: 0 }
      },
      qualityGates: {
        passed: false,
        threshold: COVERAGE_THRESHOLD,
        failures: []
      }
    };
  }

  /**
   * Main execution method
   */
  async consolidate() {
    try {
      console.log('📊 Starting coverage consolidation...');
      
      console.log('🔍 Processing frontend coverage...');
      await this.processFrontendCoverage();
      
      console.log('🐍 Processing backend coverage...');
      await this.processBackendCoverage();
      
      console.log('🎭 Processing E2E coverage...');
      await this.processE2ECoverage();
      
      console.log('🧮 Calculating consolidated metrics...');
      this.calculateConsolidatedMetrics();
      
      console.log('🚧 Evaluating quality gates...');
      this.evaluateQualityGates();
      
      console.log('📝 Generating coverage reports...');
      await this.generateReports();
      
      console.log('✅ Coverage consolidation complete!');
      
      // Exit with error if quality gates failed
      if (!this.coverageData.qualityGates.passed) {
        console.error('❌ Coverage quality gates failed');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error consolidating coverage:', error);
      process.exit(1);
    }
  }

  /**
   * Process Jest frontend coverage reports
   */
  async processFrontendCoverage() {
    const frontendResults = this.findFiles('test-results-frontend-*');
    
    for (const resultDir of frontendResults) {
      const coverageFile = path.join(resultDir, 'coverage', 'coverage-summary.json');
      const lcovFile = path.join(resultDir, 'coverage', 'lcov.info');
      
      if (fs.existsSync(coverageFile)) {
        const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
        
        // Extract total coverage metrics
        if (coverage.total) {
          this.coverageData.frontend.lines = coverage.total.lines;
          this.coverageData.frontend.functions = coverage.total.functions;
          this.coverageData.frontend.branches = coverage.total.branches;
          this.coverageData.frontend.statements = coverage.total.statements;
        }
        
        // Extract file-level coverage
        Object.entries(coverage).forEach(([filePath, fileCoverage]) => {
          if (filePath !== 'total' && fileCoverage.lines) {
            this.coverageData.frontend.files.push({
              path: this.normalizePath(filePath),
              lines: fileCoverage.lines,
              functions: fileCoverage.functions,
              branches: fileCoverage.branches,
              statements: fileCoverage.statements
            });
          }
        });
        
        console.log(`📊 Frontend coverage: ${this.coverageData.frontend.lines.pct}%`);
      }
    }
  }

  /**
   * Process pytest backend coverage reports
   */
  async processBackendCoverage() {
    const backendResults = this.findFiles('test-results-backend-*');
    
    for (const resultDir of backendResults) {
      const coverageXmlFile = path.join(resultDir, 'coverage.xml');
      const coverageHtmlDir = path.join(resultDir, 'htmlcov');
      
      if (fs.existsSync(coverageXmlFile)) {
        const coverageXml = fs.readFileSync(coverageXmlFile, 'utf8');
        
        // Parse XML coverage report
        const coverage = this.parseXMLCoverage(coverageXml);
        this.coverageData.backend = coverage;
        
        console.log(`🐍 Backend coverage: ${this.coverageData.backend.lines.pct}%`);
      }
      
      // Process HTML coverage report for file details
      if (fs.existsSync(coverageHtmlDir)) {
        const indexFile = path.join(coverageHtmlDir, 'index.html');
        if (fs.existsSync(indexFile)) {
          const fileDetails = this.parseHTMLCoverageIndex(fs.readFileSync(indexFile, 'utf8'));
          this.coverageData.backend.files = fileDetails;
        }
      }
    }
  }

  /**
   * Process E2E coverage (if available from Playwright)
   */
  async processE2ECoverage() {
    const e2eResults = this.findFiles('e2e-results-*');
    
    // Playwright can collect coverage with proper configuration
    for (const resultDir of e2eResults) {
      const coverageDir = path.join(resultDir, 'coverage');
      
      if (fs.existsSync(coverageDir)) {
        const coverageFiles = fs.readdirSync(coverageDir)
          .filter(f => f.endsWith('.json'))
          .map(f => path.join(coverageDir, f));
        
        for (const coverageFile of coverageFiles) {
          try {
            const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
            // Process Playwright coverage data (V8 format)
            this.processV8Coverage(coverage);
          } catch (error) {
            console.warn(`⚠️ Could not parse E2E coverage: ${coverageFile}`);
          }
        }
      }
    }
  }

  /**
   * Calculate consolidated coverage metrics
   */
  calculateConsolidatedMetrics() {
    const frontend = this.coverageData.frontend;
    const backend = this.coverageData.backend;
    
    // Weighted average based on codebase size
    const frontendWeight = frontend.lines.total || 0;
    const backendWeight = backend.lines.total || 0;
    const totalWeight = frontendWeight + backendWeight;
    
    if (totalWeight > 0) {
      // Calculate weighted averages
      this.coverageData.overall.lines.covered = frontend.lines.covered + backend.lines.covered;
      this.coverageData.overall.lines.total = frontend.lines.total + backend.lines.total;
      this.coverageData.overall.lines.pct = Math.round(
        (this.coverageData.overall.lines.covered / this.coverageData.overall.lines.total) * 100
      );
      
      this.coverageData.overall.functions.covered = frontend.functions.covered + backend.functions.covered;
      this.coverageData.overall.functions.total = frontend.functions.total + backend.functions.total;
      this.coverageData.overall.functions.pct = Math.round(
        (this.coverageData.overall.functions.covered / this.coverageData.overall.functions.total) * 100
      );
      
      this.coverageData.overall.branches.covered = frontend.branches.covered + backend.branches.covered;
      this.coverageData.overall.branches.total = frontend.branches.total + backend.branches.total;
      this.coverageData.overall.branches.pct = Math.round(
        (this.coverageData.overall.branches.covered / this.coverageData.overall.branches.total) * 100
      );
      
      this.coverageData.overall.statements.covered = frontend.statements.covered + backend.statements.covered;
      this.coverageData.overall.statements.total = frontend.statements.total + backend.statements.total;
      this.coverageData.overall.statements.pct = Math.round(
        (this.coverageData.overall.statements.covered / this.coverageData.overall.statements.total) * 100
      );
    }
    
    console.log(`📊 Overall coverage: ${this.coverageData.overall.lines.pct}%`);
  }

  /**
   * Evaluate coverage quality gates
   */
  evaluateQualityGates() {
    const { overall, qualityGates } = this.coverageData;
    const failures = [];
    
    // Line coverage threshold
    if (overall.lines.pct < qualityGates.threshold) {
      failures.push({
        metric: 'lines',
        actual: overall.lines.pct,
        expected: qualityGates.threshold,
        message: `Line coverage ${overall.lines.pct}% is below threshold ${qualityGates.threshold}%`
      });
    }
    
    // Function coverage threshold (slightly lower)
    const functionThreshold = Math.max(qualityGates.threshold - 10, 60);
    if (overall.functions.pct < functionThreshold) {
      failures.push({
        metric: 'functions',
        actual: overall.functions.pct,
        expected: functionThreshold,
        message: `Function coverage ${overall.functions.pct}% is below threshold ${functionThreshold}%`
      });
    }
    
    // Branch coverage threshold (slightly lower)
    const branchThreshold = Math.max(qualityGates.threshold - 15, 50);
    if (overall.branches.pct < branchThreshold) {
      failures.push({
        metric: 'branches',
        actual: overall.branches.pct,
        expected: branchThreshold,
        message: `Branch coverage ${overall.branches.pct}% is below threshold ${branchThreshold}%`
      });
    }
    
    // Check for critical files with low coverage
    const criticalFiles = this.identifyCriticalFiles();
    const lowCoverageFiles = criticalFiles.filter(file => 
      file.lines.pct < qualityGates.threshold
    );
    
    if (lowCoverageFiles.length > 0) {
      failures.push({
        metric: 'critical-files',
        actual: lowCoverageFiles.length,
        expected: 0,
        message: `${lowCoverageFiles.length} critical files have coverage below ${qualityGates.threshold}%`,
        files: lowCoverageFiles.map(f => ({ path: f.path, coverage: f.lines.pct }))
      });
    }
    
    qualityGates.failures = failures;
    qualityGates.passed = failures.length === 0;
    
    if (qualityGates.passed) {
      console.log('✅ All coverage quality gates passed');
    } else {
      console.log('❌ Coverage quality gates failed:');
      failures.forEach(failure => {
        console.log(`  - ${failure.message}`);
      });
    }
  }

  /**
   * Generate coverage reports
   */
  async generateReports() {
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync(path.join(ARTIFACTS_PATH, 'coverage-report.html'), htmlReport);
    
    // Generate JSON summary
    fs.writeFileSync(
      path.join(ARTIFACTS_PATH, 'coverage-summary.json'),
      JSON.stringify(this.coverageData, null, 2)
    );
    
    // Generate badge data
    const badgeData = this.generateBadgeData();
    fs.writeFileSync(
      path.join(ARTIFACTS_PATH, 'coverage-badge.json'),
      JSON.stringify(badgeData, null, 2)
    );
    
    // Generate lcov.info for external tools
    const lcovData = this.generateLcovData();
    fs.writeFileSync(path.join(ARTIFACTS_PATH, 'lcov.info'), lcovData);
    
    console.log('📊 Coverage reports generated:');
    console.log('  - coverage-report.html (detailed HTML report)');
    console.log('  - coverage-summary.json (machine-readable summary)');
    console.log('  - coverage-badge.json (shield/badge data)');
    console.log('  - lcov.info (lcov format for external tools)');
  }

  /**
   * Parse XML coverage report (pytest-cov format)
   */
  parseXMLCoverage(xml) {
    const coverage = {
      lines: { covered: 0, total: 0, pct: 0 },
      functions: { covered: 0, total: 0, pct: 0 },
      branches: { covered: 0, total: 0, pct: 0 },
      statements: { covered: 0, total: 0, pct: 0 },
      files: []
    };
    
    // Parse line rate (overall coverage)
    const lineRateMatch = xml.match(/line-rate="([^"]+)"/);
    if (lineRateMatch) {
      coverage.lines.pct = Math.round(parseFloat(lineRateMatch[1]) * 100);
    }
    
    // Parse branch rate
    const branchRateMatch = xml.match(/branch-rate="([^"]+)"/);
    if (branchRateMatch) {
      coverage.branches.pct = Math.round(parseFloat(branchRateMatch[1]) * 100);
    }
    
    // Parse individual files
    const fileRegex = /<class[^>]+filename="([^"]+)"[^>]*line-rate="([^"]+)"[^>]*branch-rate="([^"]+)"/g;
    let match;
    
    while ((match = fileRegex.exec(xml)) !== null) {
      const [, filename, lineRate, branchRate] = match;
      coverage.files.push({
        path: this.normalizePath(filename),
        lines: { pct: Math.round(parseFloat(lineRate) * 100) },
        branches: { pct: Math.round(parseFloat(branchRate) * 100) }
      });
    }
    
    return coverage;
  }

  /**
   * Process V8 coverage data from Playwright
   */
  processV8Coverage(v8Coverage) {
    // V8 coverage format processing
    // This is a simplified implementation
    if (Array.isArray(v8Coverage)) {
      v8Coverage.forEach(scriptCoverage => {
        if (scriptCoverage.url && scriptCoverage.functions) {
          const lineCoverage = this.calculateLineCoverageFromV8(scriptCoverage);
          this.coverageData.e2e.files.push({
            path: this.normalizePath(scriptCoverage.url),
            lines: lineCoverage
          });
        }
      });
    }
  }

  /**
   * Calculate line coverage from V8 function coverage data
   */
  calculateLineCoverageFromV8(scriptCoverage) {
    // Simplified V8 coverage calculation
    let totalRanges = 0;
    let coveredRanges = 0;
    
    scriptCoverage.functions.forEach(func => {
      func.ranges.forEach(range => {
        totalRanges++;
        if (range.count > 0) {
          coveredRanges++;
        }
      });
    });
    
    return {
      covered: coveredRanges,
      total: totalRanges,
      pct: totalRanges > 0 ? Math.round((coveredRanges / totalRanges) * 100) : 0
    };
  }

  /**
   * Identify critical files that require high coverage
   */
  identifyCriticalFiles() {
    const allFiles = [
      ...this.coverageData.frontend.files,
      ...this.coverageData.backend.files
    ];
    
    // Define patterns for critical files
    const criticalPatterns = [
      /\/(auth|security|payment|billing)\//,
      /\/(api|routes|controllers)\//,
      /\/(models|schemas)\//,
      /\/(validation|sanitization)\//,
      /\/(encryption|crypto)\//,
      /utils\/security/,
      /config\/auth/
    ];
    
    return allFiles.filter(file => 
      criticalPatterns.some(pattern => pattern.test(file.path))
    );
  }

  /**
   * Generate HTML coverage report
   */
  generateHTMLReport() {
    const { overall, frontend, backend, qualityGates } = this.coverageData;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coverage Report - Rover Mission Control</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2.5em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .progress-bar { width: 100%; height: 8px; background: #e1e4e8; border-radius: 4px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .good { color: #28a745; background: #28a745; }
        .warn { color: #ffc107; background: #ffc107; }
        .poor { color: #dc3545; background: #dc3545; }
        .section { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e1e4e8; }
        th { background: #f6f8fa; font-weight: 600; }
        .file-path { font-family: monospace; font-size: 0.9em; }
        .quality-gate-pass { color: #28a745; }
        .quality-gate-fail { color: #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Coverage Report</h1>
            <p>Generated on ${new Date().toISOString()}</p>
            <div class="quality-gates">
                <h3>Quality Gates: <span class="${qualityGates.passed ? 'quality-gate-pass' : 'quality-gate-fail'}">
                    ${qualityGates.passed ? '✅ PASSED' : '❌ FAILED'}
                </span></h3>
                ${qualityGates.failures.length > 0 ? `
                <ul>
                    ${qualityGates.failures.map(f => `<li>${f.message}</li>`).join('')}
                </ul>
                ` : ''}
            </div>
        </div>
        
        <div class="section">
            <h2>📈 Overall Coverage</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value ${this.getCoverageClass(overall.lines.pct)}">${overall.lines.pct}%</div>
                    <div class="metric-label">Lines</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getCoverageClass(overall.lines.pct)}" 
                             style="width: ${overall.lines.pct}%"></div>
                    </div>
                    <small>${overall.lines.covered} / ${overall.lines.total}</small>
                </div>
                <div class="metric-card">
                    <div class="metric-value ${this.getCoverageClass(overall.functions.pct)}">${overall.functions.pct}%</div>
                    <div class="metric-label">Functions</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getCoverageClass(overall.functions.pct)}" 
                             style="width: ${overall.functions.pct}%"></div>
                    </div>
                    <small>${overall.functions.covered} / ${overall.functions.total}</small>
                </div>
                <div class="metric-card">
                    <div class="metric-value ${this.getCoverageClass(overall.branches.pct)}">${overall.branches.pct}%</div>
                    <div class="metric-label">Branches</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getCoverageClass(overall.branches.pct)}" 
                             style="width: ${overall.branches.pct}%"></div>
                    </div>
                    <small>${overall.branches.covered} / ${overall.branches.total}</small>
                </div>
                <div class="metric-card">
                    <div class="metric-value ${this.getCoverageClass(overall.statements.pct)}">${overall.statements.pct}%</div>
                    <div class="metric-label">Statements</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getCoverageClass(overall.statements.pct)}" 
                             style="width: ${overall.statements.pct}%"></div>
                    </div>
                    <small>${overall.statements.covered} / ${overall.statements.total}</small>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Component Breakdown</h2>
            <div class="metrics-grid">
                <div class="metric-card">
                    <h3>Frontend (React/TypeScript)</h3>
                    <div class="metric-value ${this.getCoverageClass(frontend.lines.pct)}">${frontend.lines.pct}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getCoverageClass(frontend.lines.pct)}" 
                             style="width: ${frontend.lines.pct}%"></div>
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Backend (Python/FastAPI)</h3>  
                    <div class="metric-value ${this.getCoverageClass(backend.lines.pct)}">${backend.lines.pct}%</div>
                    <div class="progress-bar">
                        <div class="progress-fill ${this.getCoverageClass(backend.lines.pct)}" 
                             style="width: ${backend.lines.pct}%"></div>
                    </div>
                </div>
            </div>
        </div>
        
        ${this.generateFileDetailsHTML()}
    </div>
</body>
</html>`;
  }

  /**
   * Generate badge data for README shields
   */
  generateBadgeData() {
    const { overall } = this.coverageData;
    
    return {
      schemaVersion: 1,
      label: 'coverage',
      message: `${overall.lines.pct}%`,
      color: this.getBadgeColor(overall.lines.pct),
      namedLogo: 'codecov',
      logoColor: 'white'
    };
  }

  /**
   * Generate lcov.info format for external tools
   */
  generateLcovData() {
    const lcovLines = [];
    
    // Combine all file data
    const allFiles = [
      ...this.coverageData.frontend.files,
      ...this.coverageData.backend.files
    ];
    
    allFiles.forEach(file => {
      lcovLines.push(`SF:${file.path}`);
      
      if (file.functions) {
        lcovLines.push(`FNF:${file.functions.total}`);
        lcovLines.push(`FNH:${file.functions.covered}`);
      }
      
      if (file.lines) {
        lcovLines.push(`LF:${file.lines.total}`);
        lcovLines.push(`LH:${file.lines.covered}`);
      }
      
      if (file.branches) {
        lcovLines.push(`BRF:${file.branches.total}`);
        lcovLines.push(`BRH:${file.branches.covered}`);
      }
      
      lcovLines.push('end_of_record');
    });
    
    return lcovLines.join('\n');
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

  normalizePath(filePath) {
    return filePath.replace(/\\/g, '/').replace(/^.*\/(?:frontend|backend)\//, '');
  }

  getCoverageClass(percentage) {
    if (percentage >= 80) return 'good';
    if (percentage >= 60) return 'warn';
    return 'poor';
  }

  getBadgeColor(percentage) {
    if (percentage >= 80) return 'green';
    if (percentage >= 60) return 'yellow';
    return 'red';
  }

  generateFileDetailsHTML() {
    const criticalFiles = this.identifyCriticalFiles();
    const lowCoverageFiles = [...this.coverageData.frontend.files, ...this.coverageData.backend.files]
      .filter(file => file.lines && file.lines.pct < COVERAGE_THRESHOLD)
      .sort((a, b) => a.lines.pct - b.lines.pct);
    
    return `
        <div class="section">
            <h2>🚨 Files Requiring Attention</h2>
            ${lowCoverageFiles.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>File</th>
                        <th>Lines</th>
                        <th>Functions</th>
                        <th>Branches</th>
                        <th>Critical</th>
                    </tr>
                </thead>
                <tbody>
                    ${lowCoverageFiles.slice(0, 20).map(file => `
                    <tr>
                        <td class="file-path">${file.path}</td>
                        <td class="${this.getCoverageClass(file.lines.pct)}">${file.lines.pct}%</td>
                        <td class="${this.getCoverageClass(file.functions?.pct || 0)}">${file.functions?.pct || 'N/A'}%</td>
                        <td class="${this.getCoverageClass(file.branches?.pct || 0)}">${file.branches?.pct || 'N/A'}%</td>
                        <td>${criticalFiles.some(cf => cf.path === file.path) ? '🔥' : ''}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p>✅ All files meet coverage thresholds!</p>'}
        </div>
    `;
  }

  parseHTMLCoverageIndex(html) {
    // Simplified HTML parsing for coverage index
    // In production, you might want to use a proper HTML parser
    const files = [];
    const tableRowRegex = /<tr[^>]*>.*?<td[^>]*><a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>.*?<td[^>]*>([^<]+)<\/td>.*?<\/tr>/gs;
    let match;
    
    while ((match = tableRowRegex.exec(html)) !== null) {
      const [, href, fileName, coverage] = match;
      const coverageMatch = coverage.match(/(\d+)%/);
      
      if (coverageMatch) {
        files.push({
          path: this.normalizePath(fileName),
          lines: { pct: parseInt(coverageMatch[1]) }
        });
      }
    }
    
    return files;
  }
}

// Execute if run directly
if (require.main === module) {
  const consolidator = new CoverageConsolidator();
  consolidator.consolidate().catch(error => {
    console.error('Failed to consolidate coverage:', error);
    process.exit(1);
  });
}

module.exports = CoverageConsolidator;