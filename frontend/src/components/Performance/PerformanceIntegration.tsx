import React, { useEffect, useCallback, useRef } from 'react';
import { useTelemetryPerformanceTracking, usePerformanceMonitoring } from '../../hooks/usePerformanceMonitoring';
import { PerformanceOverlay } from './PerformanceOverlay';
import './PerformanceIntegration.css';

interface PerformanceIntegrationProps {
  children: React.ReactNode;
  componentName?: string;
  enableOverlay?: boolean;
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  overlayTheme?: 'dark' | 'light';
  autoOptimize?: boolean;
  onPerformanceDegraded?: (metrics: any) => void;
}

/**
 * Performance Integration Component
 * Wraps telemetry components with automatic performance monitoring and optimization
 */
export const PerformanceIntegration: React.FC<PerformanceIntegrationProps> = ({
  children,
  componentName = 'TelemetryComponent',
  enableOverlay = false,
  overlayPosition = 'top-right',
  overlayTheme = 'dark',
  autoOptimize = true,
  onPerformanceDegraded
}) => {
  const {
    metrics,
    alerts,
    qualitySettings,
    controls,
    trackDataProcessing
  } = useTelemetryPerformanceTracking();

  const [showOverlay, setShowOverlay] = React.useState(enableOverlay);
  const performanceDegradedRef = useRef(false);
  const lastOptimizationRef = useRef(0);

  // Monitor for performance degradation
  useEffect(() => {
    if (!metrics) return;

    const isDegraded = metrics.fps < 30 || 
                      metrics.memoryUsage.usagePercentage > 80 || 
                      metrics.telemetryProcessingTime > 10;

    if (isDegraded && !performanceDegradedRef.current) {
      performanceDegradedRef.current = true;
      onPerformanceDegraded?.(metrics);

      // Auto-optimize if enabled and not optimized recently
      const now = Date.now();
      if (autoOptimize && (now - lastOptimizationRef.current) > 5000) {
        lastOptimizationRef.current = now;
        applyPerformanceOptimizations();
      }
    } else if (!isDegraded) {
      performanceDegradedRef.current = false;
    }
  }, [metrics, autoOptimize, onPerformanceDegraded]);

  // Apply automatic performance optimizations
  const applyPerformanceOptimizations = useCallback(() => {
    if (!metrics) return;

    console.log(`[${componentName}] Applying performance optimizations:`, {
      fps: metrics.fps,
      memory: metrics.memoryUsage.usagePercentage,
      processing: metrics.telemetryProcessingTime
    });

    // Force garbage collection if available
    if (window.gc && metrics.memoryUsage.usagePercentage > 80) {
      try {
        window.gc();
      } catch (error) {
        console.warn('Manual garbage collection failed:', error);
      }
    }

    // Emit optimization event for components to respond to
    window.dispatchEvent(new CustomEvent('performance-optimize', {
      detail: {
        component: componentName,
        metrics,
        qualitySettings
      }
    }));
  }, [metrics, qualitySettings, componentName]);

  // Enhanced data processing wrapper
  const enhancedTrackDataProcessing = useCallback(async <T>(
    operation: () => Promise<T> | T,
    metadata?: { 
      dataSize?: number; 
      operationType?: string;
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<T> => {
    // Apply throttling for low priority operations if performance is degraded
    if (performanceDegradedRef.current && metadata?.priority === 'low') {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return trackDataProcessing(operation, metadata);
  }, [trackDataProcessing]);

  // Keyboard shortcut to toggle overlay
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + P to toggle performance overlay
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        setShowOverlay(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Performance context for children
  const performanceContext = React.useMemo(() => ({
    metrics,
    alerts,
    qualitySettings,
    isMonitoring: controls ? true : false,
    trackDataProcessing: enhancedTrackDataProcessing,
    startRender: controls.startRender,
    endRender: controls.endRender,
    updateWorkerMetrics: controls.updateWorkerMetrics,
    generateReport: controls.generateReport,
    exportReport: controls.exportReport
  }), [
    metrics, 
    alerts, 
    qualitySettings, 
    controls, 
    enhancedTrackDataProcessing
  ]);

  return (
    <PerformanceContext.Provider value={performanceContext}>
      {children}
      
      {showOverlay && (
        <PerformanceOverlay
          position={overlayPosition}
          theme={overlayTheme}
          showAdvanced={true}
          onClose={() => setShowOverlay(false)}
        />
      )}
      
      {/* Performance optimization indicators */}
      {performanceDegradedRef.current && autoOptimize && (
        <div className="performance-optimization-indicator">
          ⚡ Optimizing performance...
        </div>
      )}
    </PerformanceContext.Provider>
  );
};

// Performance Context for child components
interface PerformanceContextType {
  metrics: any;
  alerts: any[];
  qualitySettings: any;
  isMonitoring: boolean;
  trackDataProcessing: <T>(
    operation: () => Promise<T> | T,
    metadata?: { dataSize?: number; operationType?: string; priority?: 'high' | 'normal' | 'low' }
  ) => Promise<T>;
  startRender: () => void;
  endRender: () => void;
  updateWorkerMetrics: (metrics: any) => void;
  generateReport: (duration?: number) => any;
  exportReport: (format?: 'json' | 'csv') => string | null;
}

const PerformanceContext = React.createContext<PerformanceContextType | null>(null);

/**
 * Hook to access performance context in child components
 */
export const usePerformanceContext = () => {
  const context = React.useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformanceContext must be used within PerformanceIntegration');
  }
  return context;
};

/**
 * Higher-Order Component for automatic performance tracking
 */
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    componentName?: string;
    enableOverlay?: boolean;
    trackRenders?: boolean;
    autoOptimize?: boolean;
  } = {}
) {
  const {
    componentName = Component.displayName || Component.name || 'UnknownComponent',
    enableOverlay = false,
    trackRenders = true,
    autoOptimize = true
  } = options;

  const WrappedComponent = React.forwardRef<any, P>((props, ref) => {
    const renderStartTimeRef = useRef<number>(0);
    const [performanceState, performanceControls] = usePerformanceMonitoring({
      autoStart: true
    });

    // Track renders if enabled
    useEffect(() => {
      if (!trackRenders) return;

      const startRender = () => {
        renderStartTimeRef.current = performance.now();
        performanceControls.startRender();
      };

      const endRender = () => {
        if (renderStartTimeRef.current > 0) {
          const renderTime = performance.now() - renderStartTimeRef.current;
          performanceControls.endRender();
          performanceControls.recordTelemetryData(renderTime);
          renderStartTimeRef.current = 0;
        }
      };

      startRender();
      return endRender;
    });

    return (
      <PerformanceIntegration
        componentName={componentName}
        enableOverlay={enableOverlay}
        autoOptimize={autoOptimize}
        onPerformanceDegraded={(metrics) => {
          console.warn(`Performance degradation detected in ${componentName}:`, metrics);
        }}
      >
        <Component {...props} ref={ref} />
      </PerformanceIntegration>
    );
  });

  WrappedComponent.displayName = `withPerformanceTracking(${componentName})`;
  
  return WrappedComponent;
}

export default PerformanceIntegration;