import React, { createContext, useContext, useMemo, useCallback, useRef, useState } from 'react';

/**
 * Performance Context
 * Provides optimized state management and memoization utilities
 * Prevents cascading re-renders through intelligent value memoization
 */

const PerformanceContext = createContext(null);

/**
 * Performance metrics tracking
 */
class PerformanceTracker {
  constructor() {
    this.metrics = new Map();
    this.renderCounts = new Map();
    this.lastUpdateTimes = new Map();
  }
  
  trackRender(componentName) {
    const current = this.renderCounts.get(componentName) || 0;
    this.renderCounts.set(componentName, current + 1);
    this.lastUpdateTimes.set(componentName, performance.now());
  }
  
  trackMetric(name, value, timestamp = performance.now()) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name);
    values.push({ value, timestamp });
    
    // Keep only last 100 values
    if (values.length > 100) {
      values.shift();
    }
  }
  
  getMetrics(name) {
    return this.metrics.get(name) || [];
  }
  
  getRenderCount(componentName) {
    return this.renderCounts.get(componentName) || 0;
  }
  
  getLastUpdateTime(componentName) {
    return this.lastUpdateTimes.get(componentName) || 0;
  }
  
  getStats() {
    return {
      totalComponents: this.renderCounts.size,
      totalRenders: Array.from(this.renderCounts.values()).reduce((sum, count) => sum + count, 0),
      averageRenders: Array.from(this.renderCounts.values()).reduce((sum, count) => sum + count, 0) / Math.max(1, this.renderCounts.size),
      componentStats: Array.from(this.renderCounts.entries()).map(([name, count]) => ({
        name,
        renders: count,
        lastUpdate: this.lastUpdateTimes.get(name)
      }))
    };
  }
}

/**
 * Memoization utilities
 */
const memoizationCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

function generateMemoKey(fn, args) {
  return `${fn.name}_${JSON.stringify(args)}`;
}

function memoize(fn, keyGenerator = generateMemoKey) {
  return function memoizedFunction(...args) {
    const key = keyGenerator(fn, args);
    const cached = memoizationCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
      return cached.value;
    }
    
    const result = fn.apply(this, args);
    
    // Implement LRU eviction
    if (memoizationCache.size >= CACHE_MAX_SIZE) {
      const firstKey = memoizationCache.keys().next().value;
      memoizationCache.delete(firstKey);
    }
    
    memoizationCache.set(key, {
      value: result,
      timestamp: Date.now()
    });
    
    return result;
  };
}

/**
 * Performance Context Provider
 */
export const PerformanceProvider = ({ children, enableTracking = true }) => {
  const trackerRef = useRef(new PerformanceTracker());
  const [performanceData, setPerformanceData] = useState({
    renderOptimizations: 0,
    preventedRenders: 0,
    cacheHits: 0,
    cacheMisses: 0
  });
  
  // Memoized context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => {
    const tracker = trackerRef.current;
    
    return {
      // Performance tracking
      trackRender: enableTracking ? (componentName) => {
        tracker.trackRender(componentName);
      } : () => {},
      
      trackMetric: enableTracking ? (name, value, timestamp) => {
        tracker.trackMetric(name, value, timestamp);
      } : () => {},
      
      // Memoization utilities
      memoize,
      
      // Optimized state selectors to prevent cascading updates
      createSelector: (selectFn, equalityFn = Object.is) => {
        let lastResult;
        let lastArgs;
        
        return (...args) => {
          if (!lastArgs || !args.every((arg, index) => equalityFn(arg, lastArgs[index]))) {
            lastResult = selectFn(...args);
            lastArgs = args;
          }
          return lastResult;
        };
      },
      
      // Shallow equality checker for props
      shallowEqual: (obj1, obj2) => {
        if (obj1 === obj2) return true;
        
        if (!obj1 || !obj2) return false;
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        return keys1.every(key => obj1[key] === obj2[key]);
      },
      
      // Deep equality checker with depth limit
      deepEqual: (obj1, obj2, maxDepth = 3) => {
        if (maxDepth <= 0) return obj1 === obj2;
        
        if (obj1 === obj2) return true;
        
        if (!obj1 || !obj2 || typeof obj1 !== 'object' || typeof obj2 !== 'object') {
          return false;
        }
        
        const keys1 = Object.keys(obj1);
        const keys2 = Object.keys(obj2);
        
        if (keys1.length !== keys2.length) return false;
        
        return keys1.every(key => 
          contextValue.deepEqual(obj1[key], obj2[key], maxDepth - 1)
        );
      },
      
      // Performance statistics
      getPerformanceStats: () => tracker.getStats(),
      getPerformanceData: () => performanceData,
      
      // Cache management
      clearMemoCache: () => {
        memoizationCache.clear();
        setPerformanceData(prev => ({ ...prev, cacheHits: 0, cacheMisses: 0 }));
      },
      
      getCacheStats: () => ({
        size: memoizationCache.size,
        maxSize: CACHE_MAX_SIZE,
        hitRate: performanceData.cacheHits / Math.max(1, performanceData.cacheHits + performanceData.cacheMisses)
      }),
      
      // Component optimization helpers
      shouldComponentUpdate: (prevProps, nextProps, customCompare) => {
        if (customCompare) {
          return !customCompare(prevProps, nextProps);
        }
        
        return !contextValue.shallowEqual(prevProps, nextProps);
      },
      
      // Batch state updates
      batchUpdates: (updateFn) => {
        React.unstable_batchedUpdates(updateFn);
      },
      
      // Debounced callback creator
      createDebouncedCallback: (callback, delay = 100) => {
        let timeoutId;
        
        return (...args) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => callback(...args), delay);
        };
      },
      
      // Throttled callback creator
      createThrottledCallback: (callback, delay = 100) => {
        let lastCall = 0;
        
        return (...args) => {
          const now = performance.now();
          if (now - lastCall >= delay) {
            lastCall = now;
            return callback(...args);
          }
        };
      }
    };
  }, [enableTracking, performanceData]);
  
  // Performance monitoring effect
  React.useEffect(() => {
    if (!enableTracking) return;
    
    const interval = setInterval(() => {
      const stats = trackerRef.current.getStats();
      setPerformanceData(prev => ({
        ...prev,
        renderOptimizations: stats.totalRenders,
        preventedRenders: Math.max(0, prev.preventedRenders) // Estimated prevented renders
      }));
    }, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, [enableTracking]);
  
  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
};

/**
 * Hook to use performance context
 */
export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  
  return context;
};

/**
 * HOC for automatic render tracking
 */
export const withPerformanceTracking = (WrappedComponent, componentName) => {
  const TrackedComponent = React.forwardRef((props, ref) => {
    const { trackRender } = usePerformance();
    
    React.useEffect(() => {
      trackRender(componentName || WrappedComponent.name || 'UnknownComponent');
    });
    
    return <WrappedComponent {...props} ref={ref} />;
  });
  
  TrackedComponent.displayName = `withPerformanceTracking(${componentName || WrappedComponent.name || 'Component'})`;
  
  return TrackedComponent;
};

/**
 * Hook for optimized state management
 */
export const useOptimizedState = (initialState, equalityFn) => {
  const [state, setState] = useState(initialState);
  const { createSelector } = usePerformance();
  
  const optimizedSetState = useCallback((newState) => {
    setState(prevState => {
      const nextState = typeof newState === 'function' ? newState(prevState) : newState;
      
      // Use custom equality function or shallow comparison
      const areEqual = equalityFn ? equalityFn(prevState, nextState) : 
                      prevState === nextState;
      
      return areEqual ? prevState : nextState;
    });
  }, [equalityFn]);
  
  return [state, optimizedSetState];
};

/**
 * Hook for memoized computations with dependencies
 */
export const useStableMemo = (factory, deps, equalityFn) => {
  const { shallowEqual } = usePerformance();
  const prevDepsRef = useRef(deps);
  const memoizedValueRef = useRef();
  
  const areDepsSame = equalityFn ? 
    equalityFn(prevDepsRef.current, deps) :
    shallowEqual(prevDepsRef.current, deps);
  
  if (!areDepsSame || memoizedValueRef.current === undefined) {
    memoizedValueRef.current = factory();
    prevDepsRef.current = deps;
  }
  
  return memoizedValueRef.current;
};

/**
 * Hook for stable callback references
 */
export const useStableCallback = (callback, deps, equalityFn) => {
  const { shallowEqual } = usePerformance();
  const prevDepsRef = useRef(deps);
  const callbackRef = useRef(callback);
  
  const areDepsSame = equalityFn ? 
    equalityFn(prevDepsRef.current, deps) :
    shallowEqual(prevDepsRef.current, deps);
  
  if (!areDepsSame) {
    callbackRef.current = callback;
    prevDepsRef.current = deps;
  }
  
  return useCallback((...args) => callbackRef.current(...args), []);
};

export default PerformanceContext;