/**
 * Bundle Size Budgets and Monitoring
 * Defines size limits and alerts for different bundle chunks
 */

// Bundle size budgets (in KB)
export const BUNDLE_BUDGETS = {
  // Main application code
  main: {
    warning: 50,  // 50KB
    error: 100    // 100KB
  },
  
  // Vendor chunks
  'react-vendor': {
    warning: 150,  // 150KB
    error: 250     // 250KB
  },
  
  'threejs-vendor': {
    warning: 400,  // 400KB (reduced from current 747KB)
    error: 600     // 600KB
  },
  
  'charts-vendor': {
    warning: 100,  // 100KB (reduced from current 140KB)
    error: 180     // 180KB
  },
  
  'mui-vendor': {
    warning: 120,  // 120KB (current 92KB is good)
    error: 150     // 150KB
  },
  
  'monaco-vendor': {
    warning: 500,  // 500KB (Monaco is inherently large)
    error: 800     // 800KB
  },
  
  // Total bundle size
  total: {
    warning: 1200, // 1.2MB
    error: 1800    // 1.8MB
  }
};

// Performance budget checker
export class BundleBudgetChecker {
  constructor(budgets = BUNDLE_BUDGETS) {
    this.budgets = budgets;
    this.violations = [];
  }

  checkBudgets(stats) {
    this.violations = [];
    const assets = stats.toJson().assets;
    
    let totalSize = 0;
    const chunkSizes = {};
    
    // Calculate sizes
    assets.forEach(asset => {
      if (asset.name.endsWith('.js')) {
        totalSize += asset.size;
        
        // Extract chunk name from filename
        const chunkName = this.extractChunkName(asset.name);
        if (chunkName) {
          chunkSizes[chunkName] = (chunkSizes[chunkName] || 0) + asset.size;
        }
      }
    });
    
    // Check individual chunk budgets
    Object.entries(chunkSizes).forEach(([chunkName, size]) => {
      const sizeKB = Math.round(size / 1024);
      const budget = this.budgets[chunkName];
      
      if (budget) {
        if (sizeKB > budget.error) {
          this.violations.push({
            type: 'error',
            chunk: chunkName,
            size: sizeKB,
            limit: budget.error,
            message: `${chunkName} size (${sizeKB}KB) exceeds error limit (${budget.error}KB)`
          });
        } else if (sizeKB > budget.warning) {
          this.violations.push({
            type: 'warning',
            chunk: chunkName,
            size: sizeKB,
            limit: budget.warning,
            message: `${chunkName} size (${sizeKB}KB) exceeds warning limit (${budget.warning}KB)`
          });
        }
      }
    });
    
    // Check total budget
    const totalSizeKB = Math.round(totalSize / 1024);
    const totalBudget = this.budgets.total;
    
    if (totalSizeKB > totalBudget.error) {
      this.violations.push({
        type: 'error',
        chunk: 'total',
        size: totalSizeKB,
        limit: totalBudget.error,
        message: `Total bundle size (${totalSizeKB}KB) exceeds error limit (${totalBudget.error}KB)`
      });
    } else if (totalSizeKB > totalBudget.warning) {
      this.violations.push({
        type: 'warning',
        chunk: 'total',
        size: totalSizeKB,
        limit: totalBudget.warning,
        message: `Total bundle size (${totalSizeKB}KB) exceeds warning limit (${totalBudget.warning}KB)`
      });
    }
    
    return {
      passed: this.violations.filter(v => v.type === 'error').length === 0,
      violations: this.violations,
      chunkSizes,
      totalSize: totalSizeKB
    };
  }
  
  extractChunkName(filename) {
    // Extract chunk name from webpack filename
    // e.g., "threejs-vendor.abc123.js" -> "threejs-vendor"
    const match = filename.match(/^([^.]+)\./);
    return match ? match[1] : null;
  }
  
  reportViolations() {
    if (this.violations.length === 0) {
      console.log('✅ All bundle size budgets passed!');
      return;
    }
    
    console.log('\n📊 Bundle Size Budget Report:');
    console.log('==============================');
    
    const errors = this.violations.filter(v => v.type === 'error');
    const warnings = this.violations.filter(v => v.type === 'warning');
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS:');
      errors.forEach(violation => {
        console.log(`  ${violation.message}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(violation => {
        console.log(`  ${violation.message}`);
      });
    }
    
    console.log('\n💡 Optimization suggestions:');
    if (errors.some(e => e.chunk === 'threejs-vendor')) {
      console.log('  - Use selective Three.js imports to reduce threejs-vendor chunk');
    }
    if (errors.some(e => e.chunk === 'charts-vendor')) {
      console.log('  - Configure Chart.js for tree shaking with selective imports');
    }
    if (errors.some(e => e.chunk === 'total')) {
      console.log('  - Consider lazy loading non-critical components');
      console.log('  - Review and remove unused dependencies');
    }
  }
}

// Webpack plugin for bundle budget checking
export class BundleBudgetPlugin {
  constructor(options = {}) {
    this.budgets = options.budgets || BUNDLE_BUDGETS;
    this.failOnError = options.failOnError !== false;
  }
  
  apply(compiler) {
    compiler.hooks.afterEmit.tap('BundleBudgetPlugin', (compilation) => {
      const checker = new BundleBudgetChecker(this.budgets);
      const result = checker.checkBudgets(compilation.getStats());
      
      checker.reportViolations();
      
      if (!result.passed && this.failOnError) {
        compilation.errors.push(new Error('Bundle size budget exceeded'));
      }
    });
  }
}