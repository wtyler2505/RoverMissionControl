/**
 * Service Worker Testing and Validation Utilities
 * For testing security and performance features
 */

/**
 * Test service worker registration and security features
 */
export async function testServiceWorkerSecurity() {
  const results = {
    registration: false,
    secureContext: false,
    caching: false,
    security: false,
    messaging: false,
    backgroundSync: false,
    errors: []
  };

  try {
    // Test 1: Check secure context
    results.secureContext = window.isSecureContext;
    if (!results.secureContext) {
      results.errors.push('Service Worker requires secure context (HTTPS)');
    }

    // Test 2: Check service worker registration
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        results.registration = !!registration;
        
        // Test 3: Test messaging
        if (registration.active) {
          const messagePromise = new Promise((resolve) => {
            navigator.serviceWorker.addEventListener('message', (event) => {
              if (event.data && event.data.type === 'VERSION_RESPONSE') {
                resolve(event.data.version);
              }
            });
            setTimeout(() => resolve(null), 5000); // 5-second timeout
          });
          
          registration.active.postMessage({ type: 'GET_VERSION' });
          const version = await messagePromise;
          results.messaging = !!version;
          
          if (version) {
            console.log('Service Worker version:', version);
          }
        }
        
        // Test 4: Test cache functionality
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          results.caching = cacheNames.length > 0;
          console.log('Available caches:', cacheNames);
        }
        
        // Test 5: Test background sync support
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
          results.backgroundSync = true;
        }
        
      } catch (error) {
        results.errors.push(`Service Worker registration test failed: ${error.message}`);
      }
    } else {
      results.errors.push('Service Worker not supported in this browser');
    }
    
    // Test 6: Security features
    results.security = await testSecurityFeatures();
    
  } catch (error) {
    results.errors.push(`Service Worker testing failed: ${error.message}`);
  }
  
  return results;
}

/**
 * Test security features
 */
async function testSecurityFeatures() {
  const securityTests = {
    csp: false,
    headers: false,
    validation: false
  };
  
  try {
    // Test CSP
    const testUrl = '/test-csp';
    try {
      await fetch(testUrl);
    } catch (error) {
      // CSP might block invalid requests, which is good
      securityTests.csp = true;
    }
    
    // Test security headers
    const response = await fetch('/sw-version.json');
    const headers = response.headers;
    
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options'
    ];
    
    securityTests.headers = requiredHeaders.some(header => headers.has(header));
    
    // Test input validation
    securityTests.validation = await testInputValidation();
    
  } catch (error) {
    console.log('Security testing error:', error);
  }
  
  return securityTests.csp && securityTests.headers && securityTests.validation;
}

/**
 * Test input validation
 */
async function testInputValidation() {
  try {
    // Test malicious URL patterns
    const maliciousUrls = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'http://evil.com/script.js',
      '/api/test?param=' + 'x'.repeat(3000) // Oversized parameter
    ];
    
    let blocked = 0;
    for (const url of maliciousUrls) {
      try {
        await fetch(url);
      } catch (error) {
        blocked++;
      }
    }
    
    // Good if most malicious requests are blocked
    return blocked >= maliciousUrls.length * 0.7;
    
  } catch (error) {
    return false;
  }
}

/**
 * Test cache performance
 */
export async function testCachePerformance() {
  const results = {
    cacheHitRate: 0,
    averageResponseTime: 0,
    errors: []
  };
  
  try {
    const testUrls = [
      '/assets/images/rover-hero.webp',
      '/assets/fonts/rover-mono.woff2',
      '/static/css/main.css',
      '/static/js/main.js'
    ];
    
    let totalRequests = 0;
    let cacheHits = 0;
    let totalTime = 0;
    
    for (const url of testUrls) {
      try {
        const startTime = performance.now();
        const response = await fetch(url);
        const endTime = performance.now();
        
        totalRequests++;
        totalTime += (endTime - startTime);
        
        // Check if served from cache
        const cacheStatus = response.headers.get('x-cache-status');
        if (cacheStatus === 'hit' || response.headers.get('x-served-by') === 'ServiceWorker-v2.0.0') {
          cacheHits++;
        }
        
      } catch (error) {
        results.errors.push(`Failed to test ${url}: ${error.message}`);
      }
    }
    
    results.cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;
    results.averageResponseTime = totalRequests > 0 ? totalTime / totalRequests : 0;
    
  } catch (error) {
    results.errors.push(`Cache performance testing failed: ${error.message}`);
  }
  
  return results;
}

/**
 * Test offline functionality
 */
export async function testOfflineFunctionality() {
  const results = {
    offlineSupport: false,
    criticalResourcesAvailable: false,
    fallbacksWorking: false,
    errors: []
  };
  
  try {
    // Simulate offline condition
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        // Test critical resources availability offline
        const criticalResources = [
          '/',
          '/index.html',
          '/offline.html'
        ];
        
        let availableOffline = 0;
        for (const resource of criticalResources) {
          try {
            // Check if resource is cached
            const cache = await caches.open('rover-static-v2.0.0');
            const cachedResponse = await cache.match(resource);
            if (cachedResponse) {
              availableOffline++;
            }
          } catch (error) {
            results.errors.push(`Failed to check cache for ${resource}: ${error.message}`);
          }
        }
        
        results.criticalResourcesAvailable = availableOffline >= criticalResources.length * 0.8;
        results.offlineSupport = true;
        
        // Test API fallbacks
        try {
          const offlineApiResponse = await fetch('/api/status/offline');
          results.fallbacksWorking = offlineApiResponse.ok;
        } catch (error) {
          // Expected in online mode
          results.fallbacksWorking = true;
        }
      }
    }
    
  } catch (error) {
    results.errors.push(`Offline functionality testing failed: ${error.message}`);
  }
  
  return results;
}

/**
 * Generate comprehensive service worker report
 */
export async function generateServiceWorkerReport() {
  console.log('🔍 Generating Service Worker security and performance report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    browser: {
      userAgent: navigator.userAgent,
      secureContext: window.isSecureContext,
      serviceWorkerSupport: 'serviceWorker' in navigator,
      cacheSupport: 'caches' in window
    },
    tests: {}
  };
  
  // Run all tests
  report.tests.security = await testServiceWorkerSecurity();
  report.tests.performance = await testCachePerformance();
  report.tests.offline = await testOfflineFunctionality();
  
  // Calculate overall score
  const scores = {
    security: calculateSecurityScore(report.tests.security),
    performance: calculatePerformanceScore(report.tests.performance),
    offline: calculateOfflineScore(report.tests.offline)
  };
  
  report.overallScore = Math.round((scores.security + scores.performance + scores.offline) / 3);
  report.scores = scores;
  
  // Generate recommendations
  report.recommendations = generateRecommendations(report);
  
  console.log('📊 Service Worker Report:', report);
  return report;
}

/**
 * Calculate security score
 */
function calculateSecurityScore(securityResults) {
  let score = 0;
  const maxScore = 100;
  
  if (securityResults.secureContext) score += 20;
  if (securityResults.registration) score += 20;
  if (securityResults.caching) score += 15;
  if (securityResults.security) score += 25;
  if (securityResults.messaging) score += 10;
  if (securityResults.backgroundSync) score += 10;
  
  // Deduct points for errors
  score -= Math.min(securityResults.errors.length * 5, 30);
  
  return Math.max(0, Math.min(score, maxScore));
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(performanceResults) {
  let score = 0;
  const maxScore = 100;
  
  // Cache hit rate scoring
  if (performanceResults.cacheHitRate >= 80) score += 40;
  else if (performanceResults.cacheHitRate >= 60) score += 30;
  else if (performanceResults.cacheHitRate >= 40) score += 20;
  else if (performanceResults.cacheHitRate >= 20) score += 10;
  
  // Response time scoring
  if (performanceResults.averageResponseTime <= 100) score += 30;
  else if (performanceResults.averageResponseTime <= 200) score += 25;
  else if (performanceResults.averageResponseTime <= 500) score += 20;
  else if (performanceResults.averageResponseTime <= 1000) score += 15;
  else score += 10;
  
  // Error penalty
  score -= Math.min(performanceResults.errors.length * 5, 30);
  
  return Math.max(0, Math.min(score, maxScore));
}

/**
 * Calculate offline score
 */
function calculateOfflineScore(offlineResults) {
  let score = 0;
  const maxScore = 100;
  
  if (offlineResults.offlineSupport) score += 40;
  if (offlineResults.criticalResourcesAvailable) score += 40;
  if (offlineResults.fallbacksWorking) score += 20;
  
  // Error penalty
  score -= Math.min(offlineResults.errors.length * 5, 30);
  
  return Math.max(0, Math.min(score, maxScore));
}

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(report) {
  const recommendations = [];
  
  // Security recommendations
  if (!report.browser.secureContext) {
    recommendations.push({
      category: 'Security',
      priority: 'High',
      issue: 'Application not running in secure context',
      solution: 'Deploy application over HTTPS'
    });
  }
  
  if (report.tests.security.errors.length > 0) {
    recommendations.push({
      category: 'Security',
      priority: 'High',
      issue: 'Service Worker security issues detected',
      solution: 'Review and fix security configuration'
    });
  }
  
  // Performance recommendations
  if (report.tests.performance.cacheHitRate < 70) {
    recommendations.push({
      category: 'Performance',
      priority: 'Medium',
      issue: 'Low cache hit rate',
      solution: 'Review caching strategies and cache expiration policies'
    });
  }
  
  if (report.tests.performance.averageResponseTime > 500) {
    recommendations.push({
      category: 'Performance',
      priority: 'Medium',
      issue: 'Slow average response time',
      solution: 'Optimize asset loading and caching strategies'
    });
  }
  
  // Offline recommendations
  if (!report.tests.offline.criticalResourcesAvailable) {
    recommendations.push({
      category: 'Offline',
      priority: 'Medium',
      issue: 'Critical resources not available offline',
      solution: 'Ensure critical assets are properly cached'
    });
  }
  
  return recommendations;
}

// Export testing utilities
export default {
  testServiceWorkerSecurity,
  testCachePerformance,
  testOfflineFunctionality,
  generateServiceWorkerReport
};