/**
 * Optimized Components Index
 * Centralized export for all performance-optimized components
 * Task 46.4: Comprehensive memoization and state caching implementation
 */

// Optimized shared components
export { default as RoverModelOptimized } from '../shared/RoverModel.optimized';
export { default as TelemetryGaugeOptimized } from '../shared/TelemetryGauge.optimized';

// Optimized modules
export { default as DashboardOptimized } from '../modules/Dashboard.optimized';

// Performance utilities
export {
  useOptimizedChartData,
  useOptimizedChartOptions,
  useChartAnimationFrame,
  useDebouncedChartUpdate,
  clearChartDataCache,
  getChartCacheStats
} from '../../utils/chartDataOptimizer';

// API caching
export {
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
} from '../../services/apiCache';

// Performance context
export {
  PerformanceProvider,
  usePerformance,
  withPerformanceTracking,
  useOptimizedState,
  useStableMemo,
  useStableCallback
} from '../../contexts/PerformanceContext';

// Performance testing
export {
  PerformanceTestSuite,
  createPerformanceTest,
  benchmarkComponent,
  benchmarkMemoization,
  withRenderTracking,
  MemoryMonitor,
  FrameRateMonitor,
  MemoizationTester
} from '../../utils/performanceTester';

/**
 * Performance optimization guidelines and best practices
 */
export const PERFORMANCE_GUIDELINES = {
  // Target performance metrics (Task 46.4 requirements)
  targets: {
    renderTime: 16, // ms - 60fps target
    uiResponseTime: 100, // ms - UI interactions
    reRenderReduction: 70, // % - reduced unnecessary re-renders
    fps3D: 60, // fps - 3D rendering target
    cacheHitRate: 0.85, // 85% cache hit rate target
    memoryGrowthLimit: 10 * 1024 * 1024 // 10MB memory growth limit
  },
  
  // Memoization strategies
  strategies: {
    // React.memo for component memoization
    componentMemo: {
      description: 'Use React.memo for functional components with custom comparison',
      example: 'React.memo(Component, (prevProps, nextProps) => shallowEqual(prevProps, nextProps))'
    },
    
    // useMemo for expensive calculations
    expensiveCalculations: {
      description: 'Use useMemo for expensive computations, data transformations, and object creation',
      example: 'useMemo(() => expensiveCalculation(data), [data])'
    },
    
    // useCallback for event handlers
    eventHandlers: {
      description: 'Use useCallback for event handlers to prevent child re-renders',
      example: 'useCallback((value) => handleChange(value), [handleChange])'
    },
    
    // Context value memoization
    contextOptimization: {
      description: 'Memoize context values to prevent cascading updates',
      example: 'useMemo(() => ({ value, handler }), [value, handler])'
    }
  },
  
  // Implementation checklist
  checklist: [
    'Apply React.memo to heavy components (3D rover, charts, telemetry)',
    'Memoize expensive calculations (3D transforms, data processing)',
    'Use useCallback for event handlers',
    'Optimize context values with useMemo',
    'Implement API result caching',
    'Cache chart data processing',
    'Use shallow comparison for props',
    'Implement virtualization for large lists',
    'Debounce high-frequency updates',
    'Monitor and test performance metrics'
  ],
  
  // Common performance pitfalls
  pitfalls: [
    'Creating objects/arrays in render (use useMemo)',
    'Anonymous functions as props (use useCallback)',
    'Not memoizing context values',
    'Over-memoization of cheap operations',
    'Ignoring custom comparison functions',
    'Not testing memoization effectiveness',
    'Missing dependency arrays',
    'Premature optimization without profiling'
  ]
};

/**
 * Performance monitoring configuration
 */
export const PERFORMANCE_CONFIG = {
  // Monitoring settings
  monitoring: {
    enabled: process.env.NODE_ENV === 'development',
    trackRenders: true,
    trackMemory: true,
    trackFrameRate: true,
    trackCacheStats: true,
    reportInterval: 5000 // 5 seconds
  },
  
  // Cache configuration
  cache: {
    maxSize: 500,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    telemetryTTL: 1000, // 1 second for real-time data
    configTTL: 10 * 60 * 1000, // 10 minutes for config
    staticTTL: 60 * 60 * 1000 // 1 hour for static resources
  },
  
  // Chart optimization settings
  charts: {
    maxDataPoints: 100,
    decimationFactor: 1,
    enableSmoothing: false,
    smoothingWindow: 3,
    animationDuration: 300,
    hidePointsThreshold: 50 // Hide points when more than 50 data points
  },
  
  // 3D rendering optimization
  threeDRendering: {
    enableLOD: true,
    lodDistances: [10, 25, 50],
    enableFrustumCulling: true,
    shadowMapSize: 1024,
    maxLights: 3
  }
};

/**
 * Utility function to apply all optimizations to the main App
 */
export function withAllOptimizations(App) {
  // Wrap with performance tracking
  const TrackedApp = withPerformanceTracking(App, 'MainApp');
  
  // Wrap with performance context
  return function OptimizedApp(props) {
    return (
      <PerformanceProvider enableTracking={PERFORMANCE_CONFIG.monitoring.enabled}>
        <TrackedApp {...props} />
      </PerformanceProvider>
    );
  };
}

/**
 * Development-only performance debugging utilities
 */
export const DEV_UTILS = process.env.NODE_ENV === 'development' ? {
  // Log render cycles
  logRenders: (componentName) => {
    if (typeof window !== 'undefined') {
      window.renderCounts = window.renderCounts || {};
      window.renderCounts[componentName] = (window.renderCounts[componentName] || 0) + 1;
      console.log(`[RENDER] ${componentName}: ${window.renderCounts[componentName]}`);
    }
  },
  
  // Monitor prop changes
  useWhyDidYouUpdate: (name, props) => {
    const previous = React.useRef();
    
    React.useEffect(() => {
      if (previous.current) {
        const allKeys = Object.keys({ ...previous.current, ...props });
        const changedProps = {};
        
        allKeys.forEach(key => {
          if (previous.current[key] !== props[key]) {
            changedProps[key] = {
              from: previous.current[key],
              to: props[key]
            };
          }
        });
        
        if (Object.keys(changedProps).length) {
          console.log(`[WHY-UPDATE] ${name}:`, changedProps);
        }
      }
      
      previous.current = props;
    });
  },
  
  // Performance profiler
  useProfiler: (id) => {
    return {
      onRender: (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
        console.log(`[PROFILER] ${id} (${phase}):`, {
          actualDuration,
          baseDuration,
          startTime,
          commitTime
        });
      }
    };
  }
} : {};

export default {
  PERFORMANCE_GUIDELINES,
  PERFORMANCE_CONFIG,
  withAllOptimizations,
  DEV_UTILS
};