/**
 * Security Headers Configuration for Rover Mission Control
 * Implements Content Security Policy and other security headers
 */

/**
 * Content Security Policy Configuration
 * Strict CSP for production security
 */
export const CSP_CONFIG = {
  // Development CSP (more permissive for debugging)
  development: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for React dev tools
      "'unsafe-eval'", // Required for dev builds
      'localhost:*',
      '127.0.0.1:*'
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for styled-components
      'fonts.googleapis.com'
    ],
    'font-src': [
      "'self'",
      'fonts.gstatic.com',
      'data:'
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'localhost:*',
      '127.0.0.1:*'
    ],
    'connect-src': [
      "'self'",
      'ws://localhost:*',
      'ws://127.0.0.1:*',
      'http://localhost:*',
      'http://127.0.0.1:*',
      'https://localhost:*',
      'https://127.0.0.1:*'
    ],
    'media-src': ["'self'", 'blob:', 'data:'],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"]
  },

  // Production CSP (strict security)
  production: {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      // Hash-based CSP for inline scripts (generate these during build)
      "'sha256-REPLACE_WITH_ACTUAL_HASH'"
    ],
    'style-src': [
      "'self'",
      // Nonce-based CSP for styles
      "'nonce-REPLACE_WITH_NONCE'",
      'fonts.googleapis.com'
    ],
    'font-src': [
      "'self'",
      'fonts.gstatic.com'
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:'
    ],
    'connect-src': [
      "'self'",
      'wss://api.rover-mission.com',
      'https://api.rover-mission.com'
    ],
    'media-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'self'"],
    'child-src': ["'none'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': [],
    'block-all-mixed-content': []
  }
};

/**
 * Security Headers Configuration
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS Protection (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer Policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy (formerly Feature Policy)
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()'
  ].join(', '),
  
  // Cross-Origin Policies
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  
  // HSTS (for HTTPS environments)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

/**
 * Generate CSP header string
 */
export function generateCSP(environment = 'development', nonce = null) {
  const config = CSP_CONFIG[environment] || CSP_CONFIG.development;
  
  const directives = Object.entries(config).map(([directive, sources]) => {
    if (sources.length === 0) {
      return directive;
    }
    
    // Replace nonce placeholder if provided
    const processedSources = sources.map(source => {
      if (nonce && source.includes('REPLACE_WITH_NONCE')) {
        return source.replace('REPLACE_WITH_NONCE', nonce);
      }
      return source;
    });
    
    return `${directive} ${processedSources.join(' ')}`;
  });
  
  return directives.join('; ');
}

/**
 * Generate security headers object
 */
export function generateSecurityHeaders(environment = 'development', options = {}) {
  const headers = { ...SECURITY_HEADERS };
  
  // Add CSP header
  headers['Content-Security-Policy'] = generateCSP(environment, options.nonce);
  
  // Add reporting endpoint if available
  if (options.reportUri) {
    headers['Content-Security-Policy'] += `; report-uri ${options.reportUri}`;
  }
  
  // Remove HSTS in development
  if (environment === 'development') {
    delete headers['Strict-Transport-Security'];
  }
  
  return headers;
}

/**
 * Validate CSP compliance for resources
 */
export function validateCSPCompliance(resourceUrl, resourceType, environment = 'development') {
  const config = CSP_CONFIG[environment];
  const url = new URL(resourceUrl);
  
  // Determine appropriate CSP directive
  let directive;
  switch (resourceType) {
    case 'script':
      directive = 'script-src';
      break;
    case 'style':
      directive = 'style-src';
      break;
    case 'image':
      directive = 'img-src';
      break;
    case 'font':
      directive = 'font-src';
      break;
    case 'xhr':
    case 'fetch':
      directive = 'connect-src';
      break;
    default:
      directive = 'default-src';
  }
  
  const allowedSources = config[directive] || config['default-src'];
  
  // Check if resource URL matches allowed sources
  return allowedSources.some(source => {
    if (source === "'self'") {
      return url.origin === window.location.origin;
    }
    if (source === "'unsafe-inline'" || source === "'unsafe-eval'") {
      return true; // These are special keywords
    }
    if (source.startsWith("'sha256-") || source.startsWith("'nonce-")) {
      return true; // Hash or nonce-based, validated separately
    }
    if (source === 'data:' || source === 'blob:') {
      return url.protocol === source;
    }
    if (source.includes('*')) {
      const pattern = source.replace('*', '.*');
      return new RegExp(pattern).test(url.hostname);
    }
    return url.hostname === source || url.origin === source;
  });
}

/**
 * Report CSP violations
 */
export function setupCSPViolationReporting() {
  document.addEventListener('securitypolicyviolation', (event) => {
    const violation = {
      documentURI: event.documentURI,
      referrer: event.referrer,
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      effectiveDirective: event.effectiveDirective,
      originalPolicy: event.originalPolicy,
      disposition: event.disposition,
      statusCode: event.statusCode,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };
    
    console.error('CSP Violation:', violation);
    
    // Send to service worker for logging
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CSP_VIOLATION',
        violation
      });
    }
    
    // Send to analytics/monitoring service
    if (window.reportCSPViolation) {
      window.reportCSPViolation(violation);
    }
  });
}

/**
 * Security header validation for responses
 */
export function validateSecurityHeaders(response) {
  const headers = response.headers;
  const issues = [];
  
  // Check for required security headers
  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Content-Security-Policy'
  ];
  
  requiredHeaders.forEach(header => {
    if (!headers.get(header)) {
      issues.push(`Missing security header: ${header}`);
    }
  });
  
  // Validate CSP header
  const csp = headers.get('Content-Security-Policy');
  if (csp) {
    if (csp.includes("'unsafe-eval'") && process.env.NODE_ENV === 'production') {
      issues.push('CSP contains unsafe-eval in production');
    }
    if (csp.includes("'unsafe-inline'") && process.env.NODE_ENV === 'production') {
      issues.push('CSP contains unsafe-inline in production');
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Initialize security monitoring
 */
export function initializeSecurityMonitoring() {
  // Set up CSP violation reporting
  setupCSPViolationReporting();
  
  // Monitor for insecure content
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          checkElementSecurity(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('🔒 Security monitoring initialized');
}

/**
 * Check element for security issues
 */
function checkElementSecurity(element) {
  // Check for inline event handlers
  const inlineEvents = [
    'onclick', 'onload', 'onerror', 'onmouseover', 'onkeydown'
  ];
  
  inlineEvents.forEach(event => {
    if (element.hasAttribute(event)) {
      console.warn('Security Warning: Inline event handler detected:', event, element);
    }
  });
  
  // Check for javascript: URLs
  const links = element.querySelectorAll('a[href], area[href]');
  links.forEach(link => {
    if (link.href.startsWith('javascript:')) {
      console.warn('Security Warning: javascript: URL detected:', link);
    }
  });
  
  // Check for external scripts without integrity
  const scripts = element.querySelectorAll('script[src]');
  scripts.forEach(script => {
    const src = new URL(script.src);
    if (src.origin !== window.location.origin && !script.hasAttribute('integrity')) {
      console.warn('Security Warning: External script without integrity check:', script.src);
    }
  });
}

// Export default configuration
export default {
  CSP_CONFIG,
  SECURITY_HEADERS,
  generateCSP,
  generateSecurityHeaders,
  validateCSPCompliance,
  setupCSPViolationReporting,
  validateSecurityHeaders,
  initializeSecurityMonitoring
};