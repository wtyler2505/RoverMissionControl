import { useState, useEffect, useCallback, useRef } from 'react';
import {
  performanceMonitor,
  PerformanceMetrics,
  PerformanceAlert,
  AdaptiveQualitySettings,
  PerformanceReport,
  PerformanceThresholds
} from '../services/performance/PerformanceMonitor';

interface UsePerformanceMonitoringOptions {
  autoStart?: boolean;
  thresholds?: Partial<PerformanceThresholds>;
  onAlert?: (alert: PerformanceAlert) => void;
  onQualityChange?: (settings: AdaptiveQualitySettings) => void;
}

interface PerformanceMonitoringState {
  metrics: PerformanceMetrics | null;
  alerts: PerformanceAlert[];
  qualitySettings: AdaptiveQualitySettings;
  isMonitoring: boolean;
  history: PerformanceMetrics[];
}

interface PerformanceMonitoringControls {
  startMonitoring: () => void;
  stopMonitoring: () => void;
  clearAlerts: () => void;
  clearHistory: () => void;
  generateReport: (duration?: number) => PerformanceReport | null;
  exportReport: (format?: 'json' | 'csv') => string | null;
  setThresholds: (thresholds: Partial<PerformanceThresholds>) => void;
  recordTelemetryData: (processingTime: number) => void;
  startRender: () => void;
  endRender: () => void;
  updateWorkerMetrics: (metrics: Partial<{ taskQueueSize: number; avgProcessingTime: number; errorRate: number; throughput: number }>) => void;
}

/**
 * Custom hook for performance monitoring with telemetry UI
 * Provides comprehensive performance tracking and adaptive quality controls
 */
export const usePerformanceMonitoring = (
  options: UsePerformanceMonitoringOptions = {}
): [PerformanceMonitoringState, PerformanceMonitoringControls] => {
  const {
    autoStart = false,
    thresholds,
    onAlert,
    onQualityChange
  } = options;

  // State management
  const [state, setState] = useState<PerformanceMonitoringState>({
    metrics: null,
    alerts: [],
    qualitySettings: performanceMonitor.getQualitySettings(),
    isMonitoring: false,
    history: []
  });

  // Refs for performance optimization
  const alertTimeoutRef = useRef<NodeJS.Timeout>();
  const metricsHistoryRef = useRef<PerformanceMetrics[]>([]);

  // Initialize performance thresholds
  useEffect(() => {
    if (thresholds) {
      performanceMonitor.setThresholds(thresholds);
    }
  }, [thresholds]);

  // Auto-start monitoring
  useEffect(() => {
    if (autoStart) {
      performanceMonitor.startMonitoring();
      setState(prev => ({ ...prev, isMonitoring: true }));
    }

    return () => {
      if (autoStart) {
        performanceMonitor.stopMonitoring();
      }
    };
  }, [autoStart]);

  // Event handlers
  useEffect(() => {
    const handleMetricsUpdate = (metrics: PerformanceMetrics) => {
      // Update history with sliding window
      metricsHistoryRef.current = [...metricsHistoryRef.current.slice(-299), metrics]; // Keep last 300 entries
      
      setState(prev => ({
        ...prev,
        metrics,
        history: metricsHistoryRef.current
      }));
    };

    const handleAlert = (alert: PerformanceAlert) => {
      setState(prev => ({
        ...prev,
        alerts: [...prev.alerts.slice(-19), alert] // Keep last 20 alerts
      }));

      // Call user-provided alert handler
      if (onAlert) {
        onAlert(alert);
      }

      // Auto-clear alert after 30 seconds
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      
      alertTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          alerts: prev.alerts.filter(a => a.timestamp !== alert.timestamp)
        }));
      }, 30000);
    };

    const handleQualityChange = (settings: AdaptiveQualitySettings) => {
      setState(prev => ({
        ...prev,
        qualitySettings: settings
      }));

      // Call user-provided quality change handler
      if (onQualityChange) {
        onQualityChange(settings);
      }
    };

    const handleMonitoringStarted = () => {
      setState(prev => ({ ...prev, isMonitoring: true }));
    };

    const handleMonitoringStopped = () => {
      setState(prev => ({ ...prev, isMonitoring: false }));
    };

    const handleMetricsCleared = () => {
      metricsHistoryRef.current = [];
      setState(prev => ({
        ...prev,
        history: [],
        metrics: null
      }));
    };

    // Subscribe to events
    performanceMonitor.on('metricsUpdated', handleMetricsUpdate);
    performanceMonitor.on('performanceAlert', handleAlert);
    performanceMonitor.on('qualitySettingsChanged', handleQualityChange);
    performanceMonitor.on('monitoringStarted', handleMonitoringStarted);
    performanceMonitor.on('monitoringStopped', handleMonitoringStopped);
    performanceMonitor.on('metricsCleared', handleMetricsCleared);

    // Initialize state
    const currentMetrics = performanceMonitor.getCurrentMetrics();
    const currentHistory = performanceMonitor.getMetricsHistory();
    
    if (currentMetrics) {
      setState(prev => ({
        ...prev,
        metrics: currentMetrics,
        history: currentHistory
      }));
    }
    
    metricsHistoryRef.current = currentHistory;

    // Cleanup
    return () => {
      performanceMonitor.off('metricsUpdated', handleMetricsUpdate);
      performanceMonitor.off('performanceAlert', handleAlert);
      performanceMonitor.off('qualitySettingsChanged', handleQualityChange);
      performanceMonitor.off('monitoringStarted', handleMonitoringStarted);
      performanceMonitor.off('monitoringStopped', handleMonitoringStopped);
      performanceMonitor.off('metricsCleared', handleMetricsCleared);
      
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, [onAlert, onQualityChange]);

  // Control functions
  const startMonitoring = useCallback(() => {
    performanceMonitor.startMonitoring();
  }, []);

  const stopMonitoring = useCallback(() => {
    performanceMonitor.stopMonitoring();
  }, []);

  const clearAlerts = useCallback(() => {
    setState(prev => ({ ...prev, alerts: [] }));
  }, []);

  const clearHistory = useCallback(() => {
    performanceMonitor.clearMetrics();
  }, []);

  const generateReport = useCallback((duration = 60000): PerformanceReport | null => {
    try {
      return performanceMonitor.generateReport(duration);
    } catch (error) {
      console.error('Failed to generate performance report:', error);
      return null;
    }
  }, []);

  const exportReport = useCallback((format: 'json' | 'csv' = 'json'): string | null => {
    try {
      return performanceMonitor.exportReport(format);
    } catch (error) {
      console.error('Failed to export performance report:', error);
      return null;
    }
  }, []);

  const setThresholds = useCallback((newThresholds: Partial<PerformanceThresholds>) => {
    performanceMonitor.setThresholds(newThresholds);
  }, []);

  const recordTelemetryData = useCallback((processingTime: number) => {
    performanceMonitor.recordTelemetryData(processingTime);
  }, []);

  const startRender = useCallback(() => {
    performanceMonitor.startRender();
  }, []);

  const endRender = useCallback(() => {
    performanceMonitor.endRender();
  }, []);

  const updateWorkerMetrics = useCallback((metrics: Partial<{
    taskQueueSize: number;
    avgProcessingTime: number;
    errorRate: number;
    throughput: number;
  }>) => {
    performanceMonitor.updateWorkerMetrics(metrics);
  }, []);

  // Return state and controls
  return [
    state,
    {
      startMonitoring,
      stopMonitoring,
      clearAlerts,
      clearHistory,
      generateReport,
      exportReport,
      setThresholds,
      recordTelemetryData,
      startRender,
      endRender,
      updateWorkerMetrics
    }
  ];
};

/**
 * Hook for component-level performance tracking
 * Automatically tracks render performance for the component using this hook
 */
export const useComponentPerformanceTracking = (componentName: string) => {
  const renderStartTimeRef = useRef<number>(0);
  const [performanceState, performanceControls] = usePerformanceMonitoring();

  const startTracking = useCallback(() => {
    renderStartTimeRef.current = performance.now();
    performanceControls.startRender();
  }, [performanceControls]);

  const endTracking = useCallback(() => {
    if (renderStartTimeRef.current > 0) {
      const renderTime = performance.now() - renderStartTimeRef.current;
      performanceControls.endRender();
      performanceControls.recordTelemetryData(renderTime);
      renderStartTimeRef.current = 0;
    }
  }, [performanceControls]);

  // Track component mount/unmount
  useEffect(() => {
    startTracking();
    return endTracking;
  }, [startTracking, endTracking]);

  return {
    ...performanceState,
    controls: performanceControls,
    startTracking,
    endTracking
  };
};

/**
 * Hook for telemetry-specific performance monitoring
 * Provides specialized tracking for telemetry data processing
 */
export const useTelemetryPerformanceTracking = () => {
  const [performanceState, performanceControls] = usePerformanceMonitoring({
    autoStart: true,
    thresholds: {
      minThroughput: 50, // Lower threshold for telemetry
      maxProcessingTime: 10 // Higher tolerance for telemetry processing
    }
  });

  const trackDataProcessing = useCallback(async <T>(
    operation: () => Promise<T> | T,
    metadata?: { dataSize?: number; operationType?: string }
  ): Promise<T> => {
    const startTime = performance.now();
    
    try {
      const result = await operation();
      const processingTime = performance.now() - startTime;
      
      performanceControls.recordTelemetryData(processingTime);
      
      // Update worker metrics if metadata provided
      if (metadata?.dataSize) {
        const throughput = metadata.dataSize / (processingTime / 1000); // items per second
        performanceControls.updateWorkerMetrics({
          throughput,
          avgProcessingTime: processingTime
        });
      }
      
      return result;
    } catch (error) {
      const processingTime = performance.now() - startTime;
      performanceControls.recordTelemetryData(processingTime);
      
      // Update error rate
      performanceControls.updateWorkerMetrics({
        errorRate: 0.1 // Increment error rate
      });
      
      throw error;
    }
  }, [performanceControls]);

  const trackBatchProcessing = useCallback(async <T>(
    batchOperation: () => Promise<T[]> | T[],
    batchSize: number
  ): Promise<T[]> => {
    return trackDataProcessing(batchOperation, {
      dataSize: batchSize,
      operationType: 'batch'
    });
  }, [trackDataProcessing]);

  return {
    ...performanceState,
    controls: performanceControls,
    trackDataProcessing,
    trackBatchProcessing
  };
};

export default usePerformanceMonitoring;