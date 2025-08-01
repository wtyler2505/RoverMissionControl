#!/usr/bin/env node

/**
 * Service Worker Validation Script
 * Validates security configuration and deployment readiness
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const PUBLIC_DIR = path.join(FRONTEND_DIR, 'public');
const SW_PATH = path.join(PUBLIC_DIR, 'sw.js');
const SW_VERSION_PATH = path.join(PUBLIC_DIR, 'sw-version.json');

/**
 * Validation results tracking
 */
const results = {
  errors: [],
  warnings: [],
  info: [],
  passed: 0,
  failed: 0
};

/**
 * Log validation result
 */
function logResult(type, message, details = null) {
  results[type].push({ message, details });
  if (type === 'errors') results.failed++;
  else if (type === 'info') results.passed++;
  
  const emoji = type === 'errors' ? '❌' : type === 'warnings' ? '⚠️' : '✅';
  console.log(`${emoji} ${message}`);
  if (details) {
    console.log(`   ${JSON.stringify(details, null, 2)}`);
  }
}

/**
 * Validate service worker file exists and is valid
 */
function validateServiceWorkerFile() {
  console.log('\n🔍 Validating Service Worker file...');
  
  if (!fs.existsSync(SW_PATH)) {
    logResult('errors', 'Service Worker file not found', { path: SW_PATH });
    return false;
  }
  
  const swContent = fs.readFileSync(SW_PATH, 'utf8');
  
  // Check for required security features
  const requiredFeatures = [
    'validateRequest',
    'validateResponse', 
    'reportSecurityIncident',
    'SECURITY_CONFIG',
    'addSecurityResponseHeaders',
    'manageCacheSize'
  ];
  
  requiredFeatures.forEach(feature => {
    if (swContent.includes(feature)) {
      logResult('info', `Security feature present: ${feature}`);
    } else {
      logResult('errors', `Missing security feature: ${feature}`);
    }
  });
  
  // Check for security anti-patterns
  const antiPatterns = [
    { pattern: /eval\s*\(/, message: 'Service Worker contains eval() - security risk' },
    { pattern: /innerHTML\s*=/, message: 'Service Worker uses innerHTML - potential XSS risk' },
    { pattern: /document\.write/, message: 'Service Worker uses document.write - security risk' },
    { pattern: /\*\s*as\s+src/, message: 'Wildcard import detected - potential security issue' }
  ];
  
  antiPatterns.forEach(({ pattern, message }) => {
    if (pattern.test(swContent)) {
      logResult('warnings', message);
    }
  });
  
  // Check for version information
  if (swContent.includes('CACHE_VERSION')) {
    logResult('info', 'Service Worker version management present');
  } else {
    logResult('warnings', 'Service Worker missing version management');
  }
  
  // Check file size
  const fileSizeKB = Math.round(fs.statSync(SW_PATH).size / 1024);
  if (fileSizeKB > 100) {
    logResult('warnings', `Service Worker file is large: ${fileSizeKB}KB`, {
      recommendation: 'Consider splitting into modules for better performance'
    });
  } else {
    logResult('info', `Service Worker file size: ${fileSizeKB}KB`);
  }
  
  return true;
}

/**
 * Validate service worker version file
 */
function validateVersionFile() {
  console.log('\n🔍 Validating Service Worker version file...');
  
  if (!fs.existsSync(SW_VERSION_PATH)) {
    logResult('warnings', 'Service Worker version file not found', { 
      path: SW_VERSION_PATH,
      impact: 'Update notifications may not work properly'
    });
    return false;
  }
  
  try {
    const versionData = JSON.parse(fs.readFileSync(SW_VERSION_PATH, 'utf8'));
    
    const requiredFields = ['version', 'features', 'securityFeatures', 'timestamp'];
    requiredFields.forEach(field => {
      if (versionData[field]) {
        logResult('info', `Version file contains: ${field}`);
      } else {
        logResult('warnings', `Version file missing: ${field}`);
      }
    });
    
    // Validate version format
    if (versionData.version && /^\d+\.\d+\.\d+$/.test(versionData.version)) {
      logResult('info', `Valid version format: ${versionData.version}`);
    } else {
      logResult('warnings', 'Invalid version format - should be semver (x.y.z)');
    }
    
    return true;
  } catch (error) {
    logResult('errors', 'Invalid JSON in version file', { error: error.message });
    return false;
  }
}

/**
 * Validate caching configuration
 */
function validateCachingConfig() {
  console.log('\n🔍 Validating caching configuration...');
  
  const swContent = fs.readFileSync(SW_PATH, 'utf8');
  
  // Check for cache naming conventions
  const cacheNamePattern = /CACHE_NAME\s*=\s*[`'"']([^`'"']+)[`'"']/;
  const match = swContent.match(cacheNamePattern);
  
  if (match) {
    const cacheName = match[1];
    if (cacheName.includes('v') || cacheName.includes('version')) {
      logResult('info', `Cache versioning implemented: ${cacheName}`);
    } else {
      logResult('warnings', 'Cache name should include version for proper invalidation');
    }
  }
  
  // Check for cache size management
  if (swContent.includes('manageCacheSize')) {
    logResult('info', 'Cache size management implemented');
  } else {
    logResult('warnings', 'No cache size management detected');
  }
  
  // Check for cache expiration
  if (swContent.includes('CACHE_EXPIRATION') || 
      swContent.includes('static: 24 * 60 * 60 * 1000') ||
      swContent.includes('dynamic: 60 * 60 * 1000')) {
    logResult('info', 'Cache expiration policies implemented');
  } else {
    logResult('warnings', 'No cache expiration policies detected');
  }
}

/**
 * Validate security headers configuration
 */
function validateSecurityHeaders() {
  console.log('\n🔍 Validating security headers...');
  
  const securityHeadersPath = path.join(FRONTEND_DIR, 'src', 'utils', 'securityHeaders.js');
  
  if (!fs.existsSync(securityHeadersPath)) {
    logResult('warnings', 'Security headers configuration not found');
    return false;
  }
  
  const headerContent = fs.readFileSync(securityHeadersPath, 'utf8');
  
  // Check for required security headers
  const requiredHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'X-XSS-Protection',
    'Strict-Transport-Security'
  ];
  
  requiredHeaders.forEach(header => {
    if (headerContent.includes(header)) {
      logResult('info', `Security header configured: ${header}`);
    } else {
      logResult('warnings', `Missing security header: ${header}`);
    }
  });
  
  // Check CSP configuration
  if (headerContent.includes('CSP_CONFIG')) {
    logResult('info', 'Content Security Policy configuration present');
  } else {
    logResult('errors', 'Content Security Policy configuration missing');
  }
  
  return true;
}

/**
 * Generate integrity hashes for static assets
 */
function generateIntegrityHashes() {
  console.log('\n🔍 Generating integrity hashes for static assets...');
  
  const staticAssets = [
    'index.html',
    'manifest.json',
    'sw-version.json'
  ];
  
  const hashes = {};
  
  staticAssets.forEach(asset => {
    const assetPath = path.join(PUBLIC_DIR, asset);
    if (fs.existsSync(assetPath)) {
      const content = fs.readFileSync(assetPath);
      const hash = crypto.createHash('sha256').update(content).digest('base64');
      hashes[asset] = `sha256-${hash}`;
      logResult('info', `Generated integrity hash for ${asset}`);
    }
  });
  
  return hashes;
}

/**
 * Validate deployment readiness
 */
function validateDeploymentReadiness() {
  console.log('\n🔍 Validating deployment readiness...');
  
  const checklist = [
    {
      name: 'HTTPS requirement',
      check: () => process.env.NODE_ENV !== 'production' || process.env.HTTPS === 'true',
      message: 'Service Worker requires HTTPS in production',
      critical: false // Not critical in development
    },
    {
      name: 'Cache versioning',
      check: () => {
        const swContent = fs.readFileSync(SW_PATH, 'utf8');
        return swContent.includes('CACHE_VERSION');
      },
      message: 'Cache versioning is essential for updates',
      critical: false
    },
    {
      name: 'Error handling',
      check: () => {
        const swContent = fs.readFileSync(SW_PATH, 'utf8');
        return swContent.includes('addEventListener(\'error\'') && 
               swContent.includes('addEventListener(\'unhandledrejection\'');
      },
      message: 'Error handling improves reliability',
      critical: false
    },
    {
      name: 'Security monitoring',
      check: () => {
        const swContent = fs.readFileSync(SW_PATH, 'utf8');
        return swContent.includes('reportSecurityIncident');
      },
      message: 'Security monitoring is required for production',
      critical: true
    }
  ];
  
  checklist.forEach(({ name, check, message, critical }) => {
    if (check()) {
      logResult('info', `✓ ${name}: Passed`);
    } else {
      logResult(critical ? 'errors' : 'warnings', `✗ ${name}: ${message}`);
    }
  });
}

/**
 * Generate validation report
 */
function generateReport() {
  console.log('\n📊 Validation Report Summary:');
  console.log(`   Passed: ${results.passed}`);
  console.log(`   Failed: ${results.failed}`);
  console.log(`   Warnings: ${results.warnings.length}`);
  
  const reportPath = path.join(__dirname, '..', 'service-worker-validation-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: results.passed,
      failed: results.failed,
      warnings: results.warnings.length,
      score: Math.round((results.passed / (results.passed + results.failed)) * 100) || 0
    },
    results: results,
    recommendations: generateRecommendations()
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  // Exit with error if critical issues found
  if (results.failed > 0) {
    console.log('\n❌ Service Worker validation failed - please fix critical issues before deployment');
    process.exit(1);
  } else {
    console.log('\n✅ Service Worker validation passed - ready for deployment');
  }
}

/**
 * Generate recommendations based on results
 */
function generateRecommendations() {
  const recommendations = [];
  
  if (results.errors.length > 0) {
    recommendations.push({
      priority: 'High',
      category: 'Security',
      issue: 'Critical security features missing',
      action: 'Implement all required security features before deployment'
    });
  }
  
  if (results.warnings.length > 3) {
    recommendations.push({
      priority: 'Medium',
      category: 'Configuration',
      issue: 'Multiple configuration warnings',
      action: 'Review and address configuration warnings for optimal performance'
    });
  }
  
  recommendations.push({
    priority: 'Low',
    category: 'Monitoring',
    issue: 'Set up monitoring',
    action: 'Configure monitoring and alerting for service worker incidents'
  });
  
  return recommendations;
}

/**
 * Main validation function
 */
function main() {
  console.log('🚀 Service Worker Security & Performance Validation');
  console.log('='.repeat(50));
  
  validateServiceWorkerFile();
  validateVersionFile();
  validateCachingConfig();
  validateSecurityHeaders();
  generateIntegrityHashes();
  validateDeploymentReadiness();
  generateReport();
}

// Run validation
if (require.main === module) {
  main();
}

module.exports = {
  validateServiceWorkerFile,
  validateVersionFile,
  validateCachingConfig,
  validateSecurityHeaders,
  generateIntegrityHashes,
  validateDeploymentReadiness
};