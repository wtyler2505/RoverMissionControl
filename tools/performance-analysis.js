#!/usr/bin/env node
/**
 * Performance Analysis Tool
 * 
 * Analyzes performance metrics from Lighthouse, Playwright, and bundle analysis
 * to generate comprehensive performance reports and detect regressions.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ARTIFACTS_PATH = process.env.ARTIFACTS_PATH || './test-artifacts';
const PERFORMANCE_BUDGET = parseInt(process.env.PERFORMANCE_BUDGET || '3000');

class PerformanceAnalyzer {
  constructor() {
    this.metrics = {
      lighthouse: {
        desktop: [],
        mobile: []
      },
      playwright: {
        loadTimes: [],
        renderTimes: [],
        interactionTimes: []
      },
      bundles: {
        total: 0,
        javascript: 0,
        css: 0,
        images: 0,
        fonts: 0,
        other: 0,
        breakdown: []
      },
      vitals: {
        fcp: { values: [], median: 0, p95: 0 },
        lcp: { values: [], median: 0, p95: 0 },
        cls: { values: [], median: 0, p95: 0 },
        fid: { values: [], median: 0, p95: 0 },
        ttfb: { values: [], median: 0, p95: 0 }
      },
      summary: {
        overallScore: 0,
        budgetStatus: 'unknown',
        regressions: [],
        improvements: [],
        recommendations: []
      },
      historical: {
        trend: 'stable',
        changePercent: 0,
        previousScore: null
      }
    };
    
    this.thresholds = {
      fcp: { good: 1800, poor: 3000 },
      lcp: { good: 2500, poor: 4000 },
      cls: { good: 0.1, poor: 0.25 },
      fid: { good: 100, poor: 300 },
      ttfb: { good: 800, poor: 1800 },
      lighthouse: { good: 90, poor: 50 },
      bundleSize: { good: 3145728, poor: 5242880 } // 3MB good, 5MB poor
    };
  }

  /**
   * Main execution method
   */
  async analyze() {
    try {
      console.log('⚡ Starting performance analysis...');
      
      console.log('💡 Processing Lighthouse reports...');
      await this.processLighthouseReports();
      
      console.log('🎭 Processing Playwright performance tests...');
      await this.processPlaywrightPerformance();
      
      console.log('📦 Analyzing bundle sizes...');
      await this.analyzeBundles();
      
      console.log('📊 Calculating Web Vitals...');
      this.calculateWebVitals();
      
      console.log('📈 Detecting performance trends...');
      await this.detectTrends();
      
      console.log('🔍 Generating recommendations...');
      this.generateRecommendations();
      
      console.log('📝 Creating performance reports...');
      await this.generateReports();
      
      console.log('✅ Performance analysis complete!');
      
      // Exit with error if critical performance issues found
      if (this.metrics.summary.regressions.some(r => r.severity === 'critical')) {
        console.error('❌ Critical performance regressions detected');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Error analyzing performance:', error);
      process.exit(1);
    }
  }

  /**
   * Process Lighthouse performance reports
   */
  async processLighthouseReports() {
    const performanceResults = this.findFiles('performance-results');
    
    if (performanceResults.length === 0) {
      console.warn('⚠️ No performance results found');
      return;
    }
    
    const resultDir = performanceResults[0];
    const lighthouseDir = path.join(resultDir, '.lighthouseci');
    
    if (!fs.existsSync(lighthouseDir)) {
      console.warn('⚠️ No Lighthouse results found');
      return;
    }
    
    const reportFiles = fs.readdirSync(lighthouseDir)
      .filter(f => f.endsWith('.json'))
      .map(f => path.join(lighthouseDir, f));
    
    for (const reportFile of reportFiles) {
      try {
        const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
        const formFactor = report.configSettings?.formFactor || 'desktop';
        
        const metrics = this.extractLighthouseMetrics(report);
        
        if (formFactor === 'mobile') {
          this.metrics.lighthouse.mobile.push(metrics);
        } else {
          this.metrics.lighthouse.desktop.push(metrics);
        }
        
        // Collect Web Vitals
        this.collectWebVitals(report);
        
      } catch (error) {
        console.warn(`⚠️ Could not parse Lighthouse report: ${reportFile}`);
      }
    }
    
    console.log(`📊 Processed ${reportFiles.length} Lighthouse reports`);
  }

  /**
   * Extract key metrics from Lighthouse report
   */
  extractLighthouseMetrics(report) {
    const audits = report.audits || {};
    const categories = report.categories || {};
    
    return {
      url: report.finalUrl || report.requestedUrl,
      timestamp: report.fetchTime,
      performanceScore: Math.round((categories.performance?.score || 0) * 100),
      metrics: {
        fcp: audits['first-contentful-paint']?.numericValue || 0,
        lcp: audits['largest-contentful-paint']?.numericValue || 0,
        cls: audits['cumulative-layout-shift']?.numericValue || 0,
        tbt: audits['total-blocking-time']?.numericValue || 0,
        tti: audits['interactive']?.numericValue || 0,
        si: audits['speed-index']?.numericValue || 0,
        ttfb: audits['server-response-time']?.numericValue || 0
      },
      opportunities: this.extractOptimizationOpportunities(audits),
      diagnostics: this.extractDiagnostics(audits)
    };
  }

  /**
   * Extract optimization opportunities from Lighthouse
   */
  extractOptimizationOpportunities(audits) {
    const opportunities = [];
    
    const opportunityAudits = [
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'offscreen-images',
      'render-blocking-resources',
      'unminified-css',
      'unminified-javascript',
      'efficient-animated-content',
      'legacy-javascript'
    ];
    
    opportunityAudits.forEach(auditId => {
      const audit = audits[auditId];
      if (audit && audit.score !== null && audit.score < 1) {
        opportunities.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          potential: audit.details?.overallSavingsMs || 0,
          bytes: audit.details?.overallSavingsBytes || 0
        });
      }
    });
    
    return opportunities.sort((a, b) => b.potential - a.potential);
  }

  /**
   * Extract diagnostics from Lighthouse
   */
  extractDiagnostics(audits) {
    const diagnostics = [];
    
    const diagnosticAudits = [
      'main-thread-tasks',
      'bootup-time',
      'uses-long-cache-ttl',
      'total-byte-weight',
      'dom-size',
      'critical-request-chains'
    ];
    
    diagnosticAudits.forEach(auditId => {
      const audit = audits[auditId];
      if (audit && audit.score !== null && audit.score < 1) {
        diagnostics.push({
          id: auditId,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          displayValue: audit.displayValue
        });
      }
    });
    
    return diagnostics;
  }

  /**
   * Collect Web Vitals data
   */
  collectWebVitals(report) {
    const audits = report.audits || {};
    
    if (audits['first-contentful-paint']) {
      this.metrics.vitals.fcp.values.push(audits['first-contentful-paint'].numericValue);
    }
    
    if (audits['largest-contentful-paint']) {
      this.metrics.vitals.lcp.values.push(audits['largest-contentful-paint'].numericValue);
    }
    
    if (audits['cumulative-layout-shift']) {
      this.metrics.vitals.cls.values.push(audits['cumulative-layout-shift'].numericValue);
    }
    
    if (audits['max-potential-fid']) {
      this.metrics.vitals.fid.values.push(audits['max-potential-fid'].numericValue);
    }
    
    if (audits['server-response-time']) {
      this.metrics.vitals.ttfb.values.push(audits['server-response-time'].numericValue);
    }
  }

  /**
   * Process Playwright performance test results
   */
  async processPlaywrightPerformance() {
    const e2eResults = this.findFiles('e2e-results-*');
    
    for (const resultDir of e2eResults) {
      if (resultDir.includes('performance')) {
        const resultsFile = path.join(resultDir, 'test-results', 'results.json');
        
        if (fs.existsSync(resultsFile)) {
          const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
          
          // Extract performance timing data from Playwright tests
          this.extractPlaywrightTimings(results);
        }
      }
    }
  }

  /**
   * Extract performance timings from Playwright results
   */
  extractPlaywrightTimings(results) {
    const suites = results.suites || [];
    
    suites.forEach(suite => {
      if (suite.tests) {
        suite.tests.forEach(test => {
          if (test.results) {
            test.results.forEach(result => {
              if (result.attachments) {
                result.attachments.forEach(attachment => {
                  if (attachment.name === 'performance-metrics') {
                    try {
                      const metrics = JSON.parse(attachment.body);
                      this.processPlaywrightMetrics(metrics);
                    } catch (error) {
                      console.warn('⚠️ Could not parse Playwright performance metrics');
                    }
                  }
                });
              }
            });
          }
        });
      }
    });
  }

  /**
   * Process individual Playwright performance metrics
   */
  processPlaywrightMetrics(metrics) {
    if (metrics.loadTime) {
      this.metrics.playwright.loadTimes.push(metrics.loadTime);
    }
    
    if (metrics.renderTime) {
      this.metrics.playwright.renderTimes.push(metrics.renderTime);
    }
    
    if (metrics.interactionTime) {
      this.metrics.playwright.interactionTimes.push(metrics.interactionTime);
    }
  }

  /**
   * Analyze bundle sizes and composition
   */
  async analyzeBundles() {
    const performanceResults = this.findFiles('performance-results');
    
    if (performanceResults.length === 0) return;
    
    const resultDir = performanceResults[0];
    const bundleFile = path.join(resultDir, 'frontend', 'bundle-analysis.json');
    
    if (fs.existsSync(bundleFile)) {
      try {
        const bundleData = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
        this.processBundleAnalysis(bundleData);
      } catch (error) {
        console.warn('⚠️ Could not parse bundle analysis');
      }
    }
    
    // Also check build directory for actual files
    const buildDir = path.join('frontend', 'build', 'static');
    if (fs.existsSync(buildDir)) {
      this.analyzeBuildDirectory(buildDir);
    }
  }

  /**
   * Process webpack bundle analysis data
   */
  processBundleAnalysis(bundleData) {
    if (bundleData.assets) {
      bundleData.assets.forEach(asset => {
        const size = asset.size || 0;
        this.metrics.bundles.total += size;
        
        if (asset.name.endsWith('.js')) {
          this.metrics.bundles.javascript += size;
        } else if (asset.name.endsWith('.css')) {
          this.metrics.bundles.css += size;
        } else if (asset.name.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
          this.metrics.bundles.images += size;
        } else if (asset.name.match(/\.(woff|woff2|ttf|eot)$/)) {
          this.metrics.bundles.fonts += size;
        } else {
          this.metrics.bundles.other += size;
        }
        
        this.metrics.bundles.breakdown.push({
          name: asset.name,
          size: size,
          type: this.getAssetType(asset.name)
        });
      });
    }
  }

  /**
   * Analyze build directory directly
   */
  analyzeBuildDirectory(buildDir) {
    const analyzeDir = (dir, prefix = '') => {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          analyzeDir(fullPath, path.join(prefix, item));
        } else {
          const size = stat.size;
          const relativePath = path.join(prefix, item);
          
          this.metrics.bundles.breakdown.push({
            name: relativePath,
            size: size,
            type: this.getAssetType(item)
          });
        }
      });
    };
    
    analyzeDir(buildDir);
    
    // Calculate totals
    this.metrics.bundles.breakdown.forEach(asset => {
      this.metrics.bundles.total += asset.size;
      
      switch (asset.type) {
        case 'javascript':
          this.metrics.bundles.javascript += asset.size;
          break;
        case 'css':
          this.metrics.bundles.css += asset.size;
          break;
        case 'image':
          this.metrics.bundles.images += asset.size;
          break;
        case 'font':
          this.metrics.bundles.fonts += asset.size;
          break;
        default:
          this.metrics.bundles.other += asset.size;
      }
    });
  }

  /**
   * Get asset type from filename
   */
  getAssetType(filename) {
    if (filename.match(/\.js$/)) return 'javascript';
    if (filename.match(/\.css$/)) return 'css';
    if (filename.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (filename.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    return 'other';
  }

  /**
   * Calculate Web Vitals statistics
   */
  calculateWebVitals() {
    Object.keys(this.metrics.vitals).forEach(vital => {
      const values = this.metrics.vitals[vital].values;
      
      if (values.length > 0) {
        values.sort((a, b) => a - b);
        
        this.metrics.vitals[vital].median = this.calculatePercentile(values, 50);
        this.metrics.vitals[vital].p95 = this.calculatePercentile(values, 95);
        this.metrics.vitals[vital].min = Math.min(...values);
        this.metrics.vitals[vital].max = Math.max(...values);
        this.metrics.vitals[vital].average = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });
  }

  /**
   * Calculate percentile value
   */
  calculatePercentile(sortedValues, percentile) {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index % 1;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Detect performance trends and regressions
   */
  async detectTrends() {
    // Load historical data if available
    const historyFile = path.join(ARTIFACTS_PATH, 'performance-history.json');
    let history = [];
    
    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      } catch (error) {
        console.warn('⚠️ Could not load performance history');
      }
    }
    
    // Calculate current overall score
    const desktopScores = this.metrics.lighthouse.desktop.map(r => r.performanceScore);
    const mobileScores = this.metrics.lighthouse.mobile.map(r => r.performanceScore);
    const allScores = [...desktopScores, ...mobileScores];
    
    if (allScores.length > 0) {
      this.metrics.summary.overallScore = Math.round(
        allScores.reduce((a, b) => a + b, 0) / allScores.length
      );
    }
    
    // Compare with previous results
    if (history.length > 0) {
      const previousScore = history[history.length - 1].overallScore;
      this.metrics.historical.previousScore = previousScore;
      
      const change = this.metrics.summary.overallScore - previousScore;
      this.metrics.historical.changePercent = Math.round((change / previousScore) * 100);
      
      if (Math.abs(change) <= 2) {
        this.metrics.historical.trend = 'stable';
      } else if (change > 0) {
        this.metrics.historical.trend = 'improving';
      } else {
        this.metrics.historical.trend = 'declining';
      }
      
      // Detect significant regressions
      if (change < -5) {
        this.metrics.summary.regressions.push({
          type: 'overall-performance',
          severity: 'critical',
          current: this.metrics.summary.overallScore,
          previous: previousScore,
          change: change,
          message: `Overall performance score decreased by ${Math.abs(change)} points`
        });
      } else if (change < -2) {
        this.metrics.summary.regressions.push({
          type: 'overall-performance',
          severity: 'warning',
          current: this.metrics.summary.overallScore,
          previous: previousScore,
          change: change,
          message: `Overall performance score decreased by ${Math.abs(change)} points`
        });
      }
    }
    
    // Check bundle size budget
    if (this.metrics.bundles.total > 0) {
      if (this.metrics.bundles.total > this.thresholds.bundleSize.poor) {
        this.metrics.summary.budgetStatus = 'exceeded';
        this.metrics.summary.regressions.push({
          type: 'bundle-size',
          severity: 'critical',
          current: this.metrics.bundles.total,
          threshold: this.thresholds.bundleSize.poor,
          message: `Bundle size (${this.formatBytes(this.metrics.bundles.total)}) exceeds budget`
        });
      } else if (this.metrics.bundles.total > this.thresholds.bundleSize.good) {
        this.metrics.summary.budgetStatus = 'warning';
      } else {
        this.metrics.summary.budgetStatus = 'good';
      }
    }
    
    // Save current results to history
    history.push({
      timestamp: new Date().toISOString(),
      overallScore: this.metrics.summary.overallScore,
      bundleSize: this.metrics.bundles.total,
      vitals: {
        fcp: this.metrics.vitals.fcp.median,
        lcp: this.metrics.vitals.lcp.median,
        cls: this.metrics.vitals.cls.median
      }
    });
    
    // Keep only last 30 entries
    if (history.length > 30) {
      history = history.slice(-30);
    }
    
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    // Bundle size recommendations
    if (this.metrics.bundles.total > this.thresholds.bundleSize.good) {
      const largestAssets = this.metrics.bundles.breakdown
        .sort((a, b) => b.size - a.size)
        .slice(0, 5);
      
      recommendations.push({
        category: 'Bundle Optimization',
        priority: 'high',
        title: 'Reduce bundle size',
        description: `Bundle size is ${this.formatBytes(this.metrics.bundles.total)}. Consider code splitting and tree shaking.`,
        actions: [
          'Implement code splitting for routes',
          'Remove unused dependencies',
          'Enable tree shaking for dead code elimination',
          `Optimize largest assets: ${largestAssets.map(a => a.name).join(', ')}`
        ]
      });
    }
    
    // Web Vitals recommendations
    if (this.metrics.vitals.lcp.median > this.thresholds.lcp.poor) {
      recommendations.push({
        category: 'Core Web Vitals',
        priority: 'high',
        title: 'Improve Largest Contentful Paint (LCP)',
        description: `LCP is ${Math.round(this.metrics.vitals.lcp.median)}ms (target: <${this.thresholds.lcp.good}ms)`,
        actions: [
          'Optimize largest content element',
          'Preload key resources',
          'Minimize render-blocking resources',
          'Use efficient image formats'
        ]
      });
    }
    
    if (this.metrics.vitals.cls.median > this.thresholds.cls.poor) {
      recommendations.push({
        category: 'Core Web Vitals',
        priority: 'high',
        title: 'Reduce Cumulative Layout Shift (CLS)',
        description: `CLS is ${this.metrics.vitals.cls.median.toFixed(3)} (target: <${this.thresholds.cls.good})`,
        actions: [
          'Add size attributes to images and videos',
          'Reserve space for ads and embeds',
          'Use CSS aspect-ratio or size containers',
          'Avoid inserting content above existing content'
        ]
      });
    }
    
    // Lighthouse opportunities
    const allOpportunities = [
      ...this.metrics.lighthouse.desktop.flatMap(r => r.opportunities),
      ...this.metrics.lighthouse.mobile.flatMap(r => r.opportunities)
    ];
    
    // Group opportunities by type and sort by potential savings
    const opportunityGroups = {};
    allOpportunities.forEach(opp => {
      if (!opportunityGroups[opp.id]) {
        opportunityGroups[opp.id] = {
          ...opp,
          totalPotential: 0,
          count: 0
        };
      }
      opportunityGroups[opp.id].totalPotential += opp.potential;
      opportunityGroups[opp.id].count++;
    });
    
    const topOpportunities = Object.values(opportunityGroups)
      .sort((a, b) => b.totalPotential - a.totalPotential)
      .slice(0, 3);
    
    topOpportunities.forEach(opp => {
      if (opp.totalPotential > 500) { // More than 500ms potential savings
        recommendations.push({
          category: 'Optimization',
          priority: opp.totalPotential > 2000 ? 'high' : 'medium',
          title: opp.title,
          description: `${opp.description} Potential savings: ${Math.round(opp.totalPotential)}ms`,
          actions: this.getOptimizationActions(opp.id)
        });
      }
    });
    
    this.metrics.summary.recommendations = recommendations;
  }

  /**
   * Get specific optimization actions for Lighthouse opportunities
   */
  getOptimizationActions(opportunityId) {
    const actions = {
      'unused-css-rules': [
        'Remove unused CSS rules with PurgeCSS or similar',
        'Split CSS by page/component',
        'Use critical CSS loading'
      ],
      'unused-javascript': [
        'Implement code splitting',
        'Remove unused libraries and functions',
        'Use dynamic imports for conditional code'
      ],
      'render-blocking-resources': [
        'Defer non-critical CSS',
        'Inline critical CSS',
        'Use async/defer for JavaScript'
      ],
      'modern-image-formats': [
        'Convert images to WebP format',
        'Use AVIF for even better compression',
        'Implement responsive images with srcset'
      ],
      'offscreen-images': [
        'Implement lazy loading for images',
        'Use Intersection Observer API',
        'Consider progressive image loading'
      ]
    };
    
    return actions[opportunityId] || ['Refer to Lighthouse documentation for specific guidance'];
  }

  /**
   * Generate comprehensive performance reports
   */
  async generateReports() {
    // Generate JSON summary
    fs.writeFileSync(
      path.join(ARTIFACTS_PATH, 'performance-summary.json'),
      JSON.stringify(this.metrics, null, 2)
    );
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync(path.join(ARTIFACTS_PATH, 'performance-report.html'), htmlReport);
    
    // Generate Markdown report for PR comments
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync(path.join(ARTIFACTS_PATH, 'performance-report.md'), markdownReport);
    
    console.log('📊 Performance reports generated:');
    console.log('  - performance-summary.json (machine-readable data)');
    console.log('  - performance-report.html (detailed HTML report)');
    console.log('  - performance-report.md (PR comment format)');
  }

  /**
   * Generate Markdown report for GitHub PR comments
   */
  generateMarkdownReport() {
    const { summary, vitals, bundles, historical } = this.metrics;
    
    const trendIcon = {
      'improving': '📈',
      'declining': '📉',
      'stable': '➡️'
    }[historical.trend] || '❓';
    
    return `## ⚡ Performance Analysis Report

### 📊 Overall Score: ${summary.overallScore}/100 ${this.getScoreIcon(summary.overallScore)}

${historical.previousScore ? `
**Trend:** ${trendIcon} ${historical.trend} (${historical.changePercent > 0 ? '+' : ''}${historical.changePercent}% vs previous)
` : ''}

### 🎯 Core Web Vitals
| Metric | Value | Status | Threshold |
|--------|-------|--------|-----------|
| **First Contentful Paint** | ${Math.round(vitals.fcp.median)}ms | ${this.getVitalStatus('fcp', vitals.fcp.median)} | ≤${this.thresholds.fcp.good}ms |
| **Largest Contentful Paint** | ${Math.round(vitals.lcp.median)}ms | ${this.getVitalStatus('lcp', vitals.lcp.median)} | ≤${this.thresholds.lcp.good}ms |
| **Cumulative Layout Shift** | ${vitals.cls.median.toFixed(3)} | ${this.getVitalStatus('cls', vitals.cls.median)} | ≤${this.thresholds.cls.good} |
| **First Input Delay** | ${Math.round(vitals.fid.median)}ms | ${this.getVitalStatus('fid', vitals.fid.median)} | ≤${this.thresholds.fid.good}ms |

### 📦 Bundle Analysis
| Asset Type | Size | Percentage |
|------------|------|------------|
| **JavaScript** | ${this.formatBytes(bundles.javascript)} | ${Math.round((bundles.javascript / bundles.total) * 100)}% |
| **CSS** | ${this.formatBytes(bundles.css)} | ${Math.round((bundles.css / bundles.total) * 100)}% |
| **Images** | ${this.formatBytes(bundles.images)} | ${Math.round((bundles.images / bundles.total) * 100)}% |
| **Fonts** | ${this.formatBytes(bundles.fonts)} | ${Math.round((bundles.fonts / bundles.total) * 100)}% |
| **Other** | ${this.formatBytes(bundles.other)} | ${Math.round((bundles.other / bundles.total) * 100)}% |
| **Total** | ${this.formatBytes(bundles.total)} | ${this.getBudgetStatus()} |

### 🚨 Issues Found
${summary.regressions.length > 0 ? 
  summary.regressions.map(r => `- **${r.severity.toUpperCase()}**: ${r.message}`).join('\n') :
  '✅ No performance regressions detected'
}

### 💡 Top Recommendations
${summary.recommendations.slice(0, 3).map(rec => 
  `**${rec.title}** (${rec.priority} priority)\n${rec.description}\n${rec.actions.map(action => `- ${action}`).join('\n')}`
).join('\n\n')}

---
*Analysis completed on ${new Date().toISOString()}*`;
  }

  /**
   * Generate detailed HTML report
   */
  generateHTMLReport() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Analysis - Rover Mission Control</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .score-circle { width: 120px; height: 120px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
        .score-text { font-size: 2.5em; font-weight: bold; color: white; }
        .good { background: #0cce6b; }
        .average { background: #ffa400; }
        .poor { background: #ff5a00; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section { background: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e1e4e8; }
        th { background: #f6f8fa; font-weight: 600; }
        .status-good { color: #28a745; }
        .status-average { color: #ffc107; }
        .status-poor { color: #dc3545; }
        .recommendation { background: #f8f9fa; padding: 15px; border-left: 4px solid #0366d6; margin: 10px 0; border-radius: 4px; }
        .priority-high { border-left-color: #dc3545; }
        .priority-medium { border-left-color: #ffc107; }
        .priority-low { border-left-color: #28a745; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ Performance Analysis Report</h1>
            <div class="score-circle ${this.getScoreClass(this.metrics.summary.overallScore)}">
                <div class="score-text">${this.metrics.summary.overallScore}</div>
            </div>
            <p style="text-align: center;">Generated on ${new Date().toISOString()}</p>
        </div>
        
        ${this.generateVitalsSection()}
        ${this.generateBundleSection()}
        ${this.generateRecommendationsSection()}
    </div>
</body>
</html>`;
  }

  /**
   * Generate Web Vitals section for HTML report
   */
  generateVitalsSection() {
    return `
        <div class="section">
            <h2>🎯 Core Web Vitals</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <h3>First Contentful Paint</h3>
                    <div class="score-text ${this.getVitalClass('fcp', this.metrics.vitals.fcp.median)}">
                        ${Math.round(this.metrics.vitals.fcp.median)}ms
                    </div>
                    <p>Target: ≤${this.thresholds.fcp.good}ms</p>
                </div>
                <div class="metric-card">
                    <h3>Largest Contentful Paint</h3>
                    <div class="score-text ${this.getVitalClass('lcp', this.metrics.vitals.lcp.median)}">
                        ${Math.round(this.metrics.vitals.lcp.median)}ms
                    </div>
                    <p>Target: ≤${this.thresholds.lcp.good}ms</p>
                </div>
                <div class="metric-card">
                    <h3>Cumulative Layout Shift</h3>
                    <div class="score-text ${this.getVitalClass('cls', this.metrics.vitals.cls.median)}">
                        ${this.metrics.vitals.cls.median.toFixed(3)}
                    </div>
                    <p>Target: ≤${this.thresholds.cls.good}</p>
                </div>
                <div class="metric-card">
                    <h3>First Input Delay</h3>
                    <div class="score-text ${this.getVitalClass('fid', this.metrics.vitals.fid.median)}">
                        ${Math.round(this.metrics.vitals.fid.median)}ms
                    </div>
                    <p>Target: ≤${this.thresholds.fid.good}ms</p>
                </div>
            </div>
        </div>
    `;
  }

  /**
   * Generate bundle analysis section for HTML report
   */
  generateBundleSection() {
    const largestAssets = this.metrics.bundles.breakdown
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    return `
        <div class="section">
            <h2>📦 Bundle Analysis</h2>
            
            <div class="metric-grid">
                <div class="metric-card">
                    <h3>Total Size</h3>
                    <div class="score-text ${this.getBundleClass()}">
                        ${this.formatBytes(this.metrics.bundles.total)}
                    </div>
                    <p>Budget: ${this.formatBytes(this.thresholds.bundleSize.good)}</p>
                </div>
                <div class="metric-card">
                    <h3>JavaScript</h3>
                    <div class="score-text">
                        ${this.formatBytes(this.metrics.bundles.javascript)}
                    </div>
                    <p>${Math.round((this.metrics.bundles.javascript / this.metrics.bundles.total) * 100)}% of total</p>
                </div>
                <div class="metric-card">
                    <h3>CSS</h3>
                    <div class="score-text">
                        ${this.formatBytes(this.metrics.bundles.css)}
                    </div>
                    <p>${Math.round((this.metrics.bundles.css / this.metrics.bundles.total) * 100)}% of total</p>
                </div>
                <div class="metric-card">
                    <h3>Assets</h3>
                    <div class="score-text">
                        ${this.formatBytes(this.metrics.bundles.images + this.metrics.bundles.fonts + this.metrics.bundles.other)}
                    </div>
                    <p>Images, fonts, other</p>
                </div>
            </div>
            
            <h3>Largest Assets</h3>
            <table>
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${largestAssets.map(asset => `
                    <tr>
                        <td style="font-family: monospace; font-size: 0.9em;">${asset.name}</td>
                        <td>${asset.type}</td>
                        <td>${this.formatBytes(asset.size)}</td>
                        <td>${Math.round((asset.size / this.metrics.bundles.total) * 100)}%</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
  }

  /**
   * Generate recommendations section for HTML report
   */
  generateRecommendationsSection() {
    return `
        <div class="section">
            <h2>💡 Performance Recommendations</h2>
            ${this.metrics.summary.recommendations.map(rec => `
            <div class="recommendation priority-${rec.priority}">
                <h3>${rec.title} (${rec.priority} priority)</h3>
                <p>${rec.description}</p>
                <ul>
                    ${rec.actions.map(action => `<li>${action}</li>`).join('')}
                </ul>
            </div>
            `).join('')}
        </div>
    `;
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

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getScoreIcon(score) {
    if (score >= 90) return '🟢';
    if (score >= 50) return '🟡';
    return '🔴';
  }

  getScoreClass(score) {
    if (score >= 90) return 'good';
    if (score >= 50) return 'average';
    return 'poor';
  }

  getVitalStatus(vital, value) {
    const thresholds = this.thresholds[vital];
    if (value <= thresholds.good) return '✅ Good';
    if (value <= thresholds.poor) return '⚠️ Needs Improvement';
    return '❌ Poor';
  }

  getVitalClass(vital, value) {
    const thresholds = this.thresholds[vital];
    if (value <= thresholds.good) return 'status-good';
    if (value <= thresholds.poor) return 'status-average';
    return 'status-poor';
  }

  getBudgetStatus() {
    switch (this.metrics.summary.budgetStatus) {
      case 'good': return '✅ Within Budget';
      case 'warning': return '⚠️ Near Limit';
      case 'exceeded': return '❌ Over Budget';
      default: return '❓ Unknown';
    }
  }

  getBundleClass() {
    switch (this.metrics.summary.budgetStatus) {
      case 'good': return 'status-good';
      case 'warning': return 'status-average';
      case 'exceeded': return 'status-poor';
      default: return '';
    }
  }
}

// Execute if run directly
if (require.main === module) {
  const analyzer = new PerformanceAnalyzer();
  analyzer.analyze().catch(error => {
    console.error('Failed to analyze performance:', error);
    process.exit(1);
  });
}

module.exports = PerformanceAnalyzer;