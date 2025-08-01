/**
 * API Caching Service
 * Provides intelligent caching for API requests with different strategies
 * Reduces network requests and improves application responsiveness
 */

// Cache storage
const apiCache = new Map();
const requestCache = new Map(); // For in-flight request deduplication
const cacheStats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  errors: 0
};

// Configuration
const DEFAULT_CONFIG = {
  maxSize: 500,
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxAge: 30 * 60 * 1000, // 30 minutes absolute max
  staleWhileRevalidate: 2 * 60 * 1000, // 2 minutes stale tolerance
  retryAttempts: 3,
  retryDelay: 1000
};

let config = { ...DEFAULT_CONFIG };

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(data, ttl = config.defaultTTL) {
    this.data = data;
    this.timestamp = Date.now();
    this.ttl = ttl;
    this.accessCount = 0;
    this.lastAccessed = Date.now();
  }
  
  isExpired() {
    return Date.now() - this.timestamp > this.ttl;
  }
  
  isStale() {
    return Date.now() - this.timestamp > config.staleWhileRevalidate;
  }
  
  access() {
    this.accessCount++;
    this.lastAccessed = Date.now();
    return this.data;
  }
}

/**
 * Generate cache key from request parameters
 */
function generateCacheKey(url, options = {}) {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  const headers = options.headers ? JSON.stringify(options.headers) : '';
  
  return `${method}:${url}:${body}:${headers}`;
}

/**
 * LRU cache eviction
 */
function evictLRU() {
  if (apiCache.size <= config.maxSize) return;
  
  // Find least recently used entry
  let oldestKey = null;
  let oldestTime = Date.now();
  
  for (const [key, entry] of apiCache.entries()) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    apiCache.delete(oldestKey);
    cacheStats.evictions++;
  }
}

/**
 * Cache cleanup - remove expired entries
 */
function cleanup() {
  const now = Date.now();
  
  for (const [key, entry] of apiCache.entries()) {
    if (now - entry.timestamp > config.maxAge) {
      apiCache.delete(key);
      cacheStats.evictions++;
    }
  }
}

/**
 * Enhanced fetch with caching
 */
export async function cachedFetch(url, options = {}) {
  const cacheKey = generateCacheKey(url, options);
  const method = options.method || 'GET';
  
  // Only cache GET requests by default
  const shouldCache = options.cache !== false && method === 'GET';
  
  // Check cache first
  if (shouldCache) {
    const cached = apiCache.get(cacheKey);
    
    if (cached && !cached.isExpired()) {
      cacheStats.hits++;
      
      // Return cached data immediately, but revalidate in background if stale
      if (cached.isStale() && options.staleWhileRevalidate !== false) {
        // Background revalidation
        revalidateInBackground(url, options, cacheKey);
      }
      
      return Promise.resolve(cached.access());
    }
  }
  
  // Check for in-flight request to prevent duplicate requests
  const inFlightKey = `${method}:${url}`;
  if (requestCache.has(inFlightKey)) {
    return requestCache.get(inFlightKey);
  }
  
  // Make the request
  const requestPromise = performRequest(url, options, cacheKey, shouldCache);
  
  // Store in-flight request
  requestCache.set(inFlightKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up in-flight request
    requestCache.delete(inFlightKey);
  }
}

/**
 * Perform the actual HTTP request with retries
 */
async function performRequest(url, options, cacheKey, shouldCache) {
  let lastError;
  
  for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Clone response for caching since response body can only be read once
      const responseClone = shouldCache ? response.clone() : null;
      const data = await response.json();
      
      // Cache successful responses
      if (shouldCache && responseClone) {
        const ttl = getTTLFromResponse(responseClone, options.ttl);
        const entry = new CacheEntry(data, ttl);
        
        apiCache.set(cacheKey, entry);
        evictLRU();
        cacheStats.misses++;
      }
      
      return data;
      
    } catch (error) {
      lastError = error;
      cacheStats.errors++;
      
      // Don't retry on client errors (4xx)
      if (error.message.includes('HTTP 4')) {
        break;
      }
      
      // Wait before retry
      if (attempt < config.retryAttempts - 1) {
        await new Promise(resolve => 
          setTimeout(resolve, config.retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }
  
  throw lastError;
}

/**
 * Background revalidation for stale-while-revalidate
 */
async function revalidateInBackground(url, options, cacheKey) {
  try {
    const fresh = await performRequest(url, options, cacheKey, true);
    // Fresh data is already cached in performRequest
  } catch (error) {
    // Silent failure for background revalidation
    console.warn('Background revalidation failed:', error);
  }
}

/**
 * Extract TTL from response headers
 */
function getTTLFromResponse(response, customTTL) {
  if (customTTL) return customTTL;
  
  // Check Cache-Control header
  const cacheControl = response.headers.get('cache-control');
  if (cacheControl) {
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch) {
      return parseInt(maxAgeMatch[1]) * 1000; // Convert to milliseconds
    }
  }
  
  // Check Expires header
  const expires = response.headers.get('expires');
  if (expires) {
    const expiresTime = new Date(expires).getTime();
    const now = Date.now();
    if (expiresTime > now) {
      return expiresTime - now;
    }
  }
  
  return config.defaultTTL;
}

/**
 * Specialized caches for different data types
 */

// Telemetry data cache - short TTL, high frequency
export async function getCachedTelemetry(url, options = {}) {
  return cachedFetch(url, {
    ...options,
    ttl: 1000, // 1 second TTL for real-time data
    staleWhileRevalidate: true
  });
}

// Configuration data cache - long TTL, infrequent updates
export async function getCachedConfig(url, options = {}) {
  return cachedFetch(url, {
    ...options,
    ttl: 10 * 60 * 1000, // 10 minutes TTL
    staleWhileRevalidate: true
  });
}

// Device/hardware data cache - medium TTL
export async function getCachedDeviceData(url, options = {}) {
  return cachedFetch(url, {
    ...options,
    ttl: 30 * 1000, // 30 seconds TTL
    staleWhileRevalidate: true
  });
}

// Static resources cache - very long TTL
export async function getCachedStaticData(url, options = {}) {
  return cachedFetch(url, {
    ...options,
    ttl: 60 * 60 * 1000, // 1 hour TTL
    staleWhileRevalidate: false
  });
}

/**
 * Cache management functions
 */

// Invalidate specific cache entries
export function invalidateCache(pattern) {
  const keysToDelete = [];
  
  for (const key of apiCache.keys()) {
    if (pattern instanceof RegExp ? pattern.test(key) : key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => apiCache.delete(key));
  return keysToDelete.length;
}

// Clear all cache
export function clearCache() {
  const size = apiCache.size;
  apiCache.clear();
  requestCache.clear();
  return size;
}

// Get cache statistics
export function getCacheStats() {
  const hitRate = cacheStats.hits / Math.max(1, cacheStats.hits + cacheStats.misses);
  
  return {
    size: apiCache.size,
    maxSize: config.maxSize,
    hits: cacheStats.hits,
    misses: cacheStats.misses,
    evictions: cacheStats.evictions,
    errors: cacheStats.errors,
    hitRate: Math.round(hitRate * 100) / 100,
    inFlightRequests: requestCache.size
  };
}

// Configure cache settings
export function configureCache(newConfig) {
  config = { ...config, ...newConfig };
}

// Prefetch data
export async function prefetch(url, options = {}) {
  try {
    await cachedFetch(url, { ...options, prefetch: true });
  } catch (error) {
    // Silent failure for prefetch
    console.warn('Prefetch failed:', error);
  }
}

// Batch prefetch
export async function batchPrefetch(requests) {
  const promises = requests.map(({ url, options }) => prefetch(url, options));
  await Promise.allSettled(promises);
}

/**
 * React hooks for cached API calls
 */
export function useCachedApi(url, options = {}) {
  const [state, setState] = React.useState({
    data: null,
    loading: true,
    error: null
  });
  
  const { shallowEqual } = useContext(PerformanceContext) || { shallowEqual: (a, b) => a === b };
  const prevOptionsRef = React.useRef(options);
  
  // Only refetch if options changed significantly
  const optionsChanged = !shallowEqual(prevOptionsRef.current, options);
  
  React.useEffect(() => {
    if (optionsChanged) {
      prevOptionsRef.current = options;
    }
    
    let isCancelled = false;
    
    cachedFetch(url, options)
      .then(data => {
        if (!isCancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch(error => {
        if (!isCancelled) {
          setState({ data: null, loading: false, error });
        }
      });
    
    return () => {
      isCancelled = true;
    };
  }, [url, optionsChanged]);
  
  return state;
}

// Periodic cleanup
setInterval(cleanup, 5 * 60 * 1000); // Every 5 minutes

export default {
  cachedFetch,
  getCachedTelemetry,
  getCachedConfig,
  getCachedDeviceData,
  getCachedStaticData,
  invalidateCache,
  clearCache,
  getCacheStats,
  configureCache,
  prefetch,
  batchPrefetch,
  useCachedApi
};