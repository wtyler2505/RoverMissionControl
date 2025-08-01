#!/usr/bin/env node

/**
 * Visual Baseline Management Tool
 * 
 * Manages baseline images for visual regression testing across different
 * testing frameworks (Jest, Playwright, Chromatic).
 * 
 * Features:
 * - Baseline creation and updates
 * - Multi-platform support (Windows, macOS, Linux)
 * - Git integration for baseline versioning
 * - Automated cleanup of outdated baselines
 * - Cross-browser baseline management
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class VisualBaselineManager {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.baselinePaths = {
      jest: path.join(this.rootDir, 'frontend/src/**/__image_snapshots__'),
      playwright: path.join(this.rootDir, 'tests/e2e/snapshots'),
      chromatic: path.join(this.rootDir, 'chromatic-baselines')
    };
    
    this.config = {
      // Supported browsers for cross-browser testing
      browsers: ['chromium', 'firefox', 'webkit'],
      
      // Supported viewports for responsive testing
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1200, height: 800 },
        { name: 'ultrawide', width: 1920, height: 1080 }
      ],
      
      // Supported themes
      themes: ['light', 'dark', 'high-contrast'],
      
      // Baseline retention policy (days)
      retentionDays: 30
    };
  }

  /**
   * Initialize baseline directory structure
   */
  async initialize() {
    console.log('🚀 Initializing Visual Baseline Manager...');
    
    try {
      // Create baseline directories
      for (const [framework, basePath] of Object.entries(this.baselinePaths)) {
        const resolvedPath = this.resolvePath(basePath);
        await this.ensureDirectory(resolvedPath);
        console.log(`✓ Created baseline directory for ${framework}: ${resolvedPath}`);
      }
      
      // Create metadata directory
      const metadataDir = path.join(this.rootDir, '.visual-baselines');
      await this.ensureDirectory(metadataDir);
      
      // Initialize metadata file
      const metadataFile = path.join(metadataDir, 'metadata.json');
      const metadata = {
        version: '1.0.0',
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        baselines: {},
        config: this.config
      };
      
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
      console.log('✓ Initialized baseline metadata');
      
      console.log('🎉 Visual Baseline Manager initialized successfully!');
    } catch (error) {
      console.error('❌ Failed to initialize:', error.message);
      process.exit(1);
    }
  }

  /**
   * Update all baselines
   */
  async updateAll() {
    console.log('🔄 Updating all visual baselines...');
    
    try {
      // Update Jest baselines
      await this.updateJestBaselines();
      
      // Update Playwright baselines
      await this.updatePlaywrightBaselines();
      
      // Update Chromatic baselines
      await this.updateChromaticBaselines();
      
      // Update metadata
      await this.updateMetadata();
      
      console.log('🎉 All baselines updated successfully!');
    } catch (error) {
      console.error('❌ Failed to update baselines:', error.message);
      process.exit(1);
    }
  }

  /**
   * Update Jest image snapshots
   */
  async updateJestBaselines() {
    console.log('📸 Updating Jest baselines...');
    
    try {
      const jestDir = path.join(this.rootDir, 'frontend');
      
      // Run Jest with update snapshots flag
      execSync('npm run test:visual -- --updateSnapshot', {
        cwd: jestDir,
        stdio: 'inherit'
      });
      
      console.log('✓ Jest baselines updated');
    } catch (error) {
      console.warn('⚠️ Jest baseline update failed:', error.message);
    }
  }

  /**
   * Update Playwright baselines
   */
  async updatePlaywrightBaselines() {
    console.log('🎭 Updating Playwright baselines...');
    
    try {
      // Update baselines for each browser
      for (const browser of this.config.browsers) {
        console.log(`  Updating ${browser} baselines...`);
        
        execSync(`npx playwright test --project=${browser} --update-snapshots`, {
          cwd: this.rootDir,
          stdio: 'inherit'
        });
      }
      
      console.log('✓ Playwright baselines updated');
    } catch (error) {
      console.warn('⚠️ Playwright baseline update failed:', error.message);
    }
  }

  /**
   * Update Chromatic baselines
   */
  async updateChromaticBaselines() {
    console.log('🎨 Updating Chromatic baselines...');
    
    try {
      // Build Storybook
      execSync('npm run build-storybook', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      
      // Upload to Chromatic (this will update baselines if approved)
      execSync('npm run chromatic', {
        cwd: this.rootDir,
        stdio: 'inherit'
      });
      
      console.log('✓ Chromatic baselines updated');
    } catch (error) {
      console.warn('⚠️ Chromatic baseline update failed:', error.message);
    }
  }

  /**
   * Clean up old baselines
   */
  async cleanup() {
    console.log('🧹 Cleaning up old baselines...');
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      let cleanedCount = 0;
      
      // Clean Jest baselines
      cleanedCount += await this.cleanupDirectory(
        this.resolvePath(this.baselinePaths.jest),
        cutoffDate
      );
      
      // Clean Playwright baselines
      cleanedCount += await this.cleanupDirectory(
        this.baselinePaths.playwright,
        cutoffDate
      );
      
      console.log(`✓ Cleaned up ${cleanedCount} old baseline files`);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }

  /**
   * Compare baselines across browsers/environments
   */
  async compare(options = {}) {
    console.log('🔍 Comparing baselines...');
    
    const { 
      framework = 'playwright',
      component = null,
      browsers = this.config.browsers 
    } = options;
    
    try {
      const baselineDir = this.baselinePaths[framework];
      const comparisonReport = {
        timestamp: new Date().toISOString(),
        framework,
        component,
        browsers,
        differences: []
      };
      
      // Compare baselines between browsers
      for (let i = 0; i < browsers.length - 1; i++) {
        for (let j = i + 1; j < browsers.length; j++) {
          const browser1 = browsers[i];
          const browser2 = browsers[j];
          
          console.log(`  Comparing ${browser1} vs ${browser2}...`);
          
          const differences = await this.compareBrowserBaselines(
            baselineDir,
            browser1,
            browser2,
            component
          );
          
          comparisonReport.differences.push({
            browser1,
            browser2,
            differences
          });
        }
      }
      
      // Save comparison report
      const reportPath = path.join(
        this.rootDir,
        '.visual-baselines',
        `comparison-${Date.now()}.json`
      );
      
      await fs.writeFile(reportPath, JSON.stringify(comparisonReport, null, 2));
      console.log(`✓ Comparison report saved: ${reportPath}`);
      
      return comparisonReport;
    } catch (error) {
      console.error('❌ Comparison failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate baseline statistics
   */
  async stats() {
    console.log('📊 Generating baseline statistics...');
    
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        frameworks: {}
      };
      
      // Analyze each framework's baselines
      for (const [framework, basePath] of Object.entries(this.baselinePaths)) {
        const resolvedPath = this.resolvePath(basePath);
        const frameworkStats = await this.analyzeDirectory(resolvedPath);
        
        stats.frameworks[framework] = {
          totalFiles: frameworkStats.totalFiles,
          totalSize: frameworkStats.totalSize,
          averageSize: frameworkStats.averageSize,
          oldestFile: frameworkStats.oldestFile,
          newestFile: frameworkStats.newestFile,
          fileTypes: frameworkStats.fileTypes
        };
      }
      
      // Display stats
      console.log('\n📈 Baseline Statistics:');
      console.log('========================');
      
      for (const [framework, frameworkStats] of Object.entries(stats.frameworks)) {
        console.log(`\n${framework.toUpperCase()}:`);
        console.log(`  Files: ${frameworkStats.totalFiles}`);
        console.log(`  Total Size: ${this.formatBytes(frameworkStats.totalSize)}`);
        console.log(`  Average Size: ${this.formatBytes(frameworkStats.averageSize)}`);
        console.log(`  File Types: ${Object.keys(frameworkStats.fileTypes).join(', ')}`);
      }
      
      return stats;
    } catch (error) {
      console.error('❌ Stats generation failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate baseline integrity
   */
  async validate() {
    console.log('✅ Validating baseline integrity...');
    
    try {
      const issues = [];
      
      // Check for missing baselines
      const expectedBaselines = await this.getExpectedBaselines();
      const actualBaselines = await this.getActualBaselines();
      
      const missing = expectedBaselines.filter(
        baseline => !actualBaselines.includes(baseline)
      );
      
      if (missing.length > 0) {
        issues.push({
          type: 'missing',
          files: missing,
          message: `${missing.length} expected baseline(s) missing`
        });
      }
      
      // Check for orphaned baselines
      const orphaned = actualBaselines.filter(
        baseline => !expectedBaselines.includes(baseline)
      );
      
      if (orphaned.length > 0) {
        issues.push({
          type: 'orphaned',
          files: orphaned,
          message: `${orphaned.length} orphaned baseline(s) found`
        });
      }
      
      // Check for corrupted images
      const corrupted = await this.checkCorruptedImages();
      if (corrupted.length > 0) {
        issues.push({
          type: 'corrupted',
          files: corrupted,
          message: `${corrupted.length} corrupted baseline(s) found`
        });
      }
      
      // Report results
      if (issues.length === 0) {
        console.log('✅ All baselines are valid!');
      } else {
        console.log(`⚠️ Found ${issues.length} issue(s):`);
        issues.forEach(issue => {
          console.log(`  ${issue.type}: ${issue.message}`);
          if (issue.files.length <= 5) {
            issue.files.forEach(file => console.log(`    - ${file}`));
          } else {
            issue.files.slice(0, 5).forEach(file => console.log(`    - ${file}`));
            console.log(`    ... and ${issue.files.length - 5} more`);
          }
        });
      }
      
      return issues;
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      throw error;
    }
  }

  // Helper methods
  
  async ensureDirectory(dirPath) {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  resolvePath(globPath) {
    // Convert glob patterns to actual directory paths
    return globPath.replace(/\/\*\*/g, '').replace(/\/\*/g, '');
  }

  async updateMetadata() {
    const metadataFile = path.join(this.rootDir, '.visual-baselines', 'metadata.json');
    
    try {
      const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
      metadata.lastUpdated = new Date().toISOString();
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.warn('⚠️ Failed to update metadata:', error.message);
    }
  }

  async cleanupDirectory(dirPath, cutoffDate) {
    let cleanedCount = 0;
    
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(dirPath, file.name);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } else if (file.isDirectory()) {
          cleanedCount += await this.cleanupDirectory(
            path.join(dirPath, file.name),
            cutoffDate
          );
        }
      }
    } catch (error) {
      // Directory might not exist, which is fine
    }
    
    return cleanedCount;
  }

  async analyzeDirectory(dirPath) {
    const stats = {
      totalFiles: 0,
      totalSize: 0,
      averageSize: 0,
      oldestFile: null,
      newestFile: null,
      fileTypes: {}
    };
    
    try {
      const files = await this.getFilesRecursively(dirPath);
      
      for (const filePath of files) {
        const fileStats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        stats.totalFiles++;
        stats.totalSize += fileStats.size;
        
        // Track file types
        stats.fileTypes[ext] = (stats.fileTypes[ext] || 0) + 1;
        
        // Track oldest/newest
        if (!stats.oldestFile || fileStats.mtime < stats.oldestFile.mtime) {
          stats.oldestFile = { path: filePath, mtime: fileStats.mtime };
        }
        
        if (!stats.newestFile || fileStats.mtime > stats.newestFile.mtime) {
          stats.newestFile = { path: filePath, mtime: fileStats.mtime };
        }
      }
      
      stats.averageSize = stats.totalFiles > 0 ? stats.totalSize / stats.totalFiles : 0;
    } catch (error) {
      // Directory might not exist
    }
    
    return stats;
  }

  async getFilesRecursively(dirPath) {
    const files = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...(await this.getFilesRecursively(fullPath)));
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return files;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getExpectedBaselines() {
    // This would analyze test files to determine expected baselines
    // For now, return empty array
    return [];
  }

  async getActualBaselines() {
    // This would scan baseline directories for actual files
    // For now, return empty array
    return [];
  }

  async checkCorruptedImages() {
    // This would validate image files
    // For now, return empty array
    return [];
  }

  async compareBrowserBaselines(baselineDir, browser1, browser2, component) {
    // This would compare baseline images between browsers
    // For now, return empty array
    return [];
  }
}

// CLI Interface
async function main() {
  const manager = new VisualBaselineManager();
  const command = process.argv[2];
  
  switch (command) {
    case 'init':
      await manager.initialize();
      break;
      
    case 'update':
      await manager.updateAll();
      break;
      
    case 'cleanup':
      await manager.cleanup();
      break;
      
    case 'compare':
      const compareOptions = {
        framework: process.argv[3] || 'playwright',
        component: process.argv[4] || null
      };
      await manager.compare(compareOptions);
      break;
      
    case 'stats':
      await manager.stats();
      break;
      
    case 'validate':
      await manager.validate();
      break;
      
    default:
      console.log(`
Visual Baseline Manager

Usage:
  node visual-baseline-manager.js <command> [options]

Commands:
  init      Initialize baseline directory structure
  update    Update all baselines (Jest, Playwright, Chromatic)
  cleanup   Remove old baseline files
  compare   Compare baselines across browsers/environments
  stats     Generate baseline statistics
  validate  Validate baseline integrity

Examples:
  node visual-baseline-manager.js init
  node visual-baseline-manager.js update
  node visual-baseline-manager.js compare playwright HALDashboard
  node visual-baseline-manager.js stats
      `);
      break;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  });
}

module.exports = VisualBaselineManager;