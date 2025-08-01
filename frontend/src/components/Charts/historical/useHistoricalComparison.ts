/**
 * useHistoricalComparison Hook
 * React hook for managing historical data comparison state and operations
 * Provides comprehensive data management, caching, and performance optimization
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  UseHistoricalComparisonOptions,
  UseHistoricalComparisonReturn,
  ComparisonMode,
  ComparisonDataset,
  ComparisonStatistics,
  HistoricalPeriod,
  HistoricalDataPoint,
  AlignmentConfig,
  LoadingState,
  HistoricalDataService
} from './types';

// Cache implementation for historical data
class HistoricalDataCache {
  private cache = new Map<string, {
    data: HistoricalDataPoint[];
    timestamp: number;
    ttl: number;
  }>();
  
  private maxSize: number;
  private defaultTtl: number;

  constructor(maxSize = 100, defaultTtl = 300000) { // 5 minutes default TTL
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtl;
  }

  set(key: string, data: HistoricalDataPoint[], ttl?: number): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTtl
    });
  }

  get(key: string): HistoricalDataPoint[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }

  getMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.data.length * 64; // Approximate bytes per data point
    }
    return totalSize;
  }
}

// Statistics calculator for comparison data
class StatisticsCalculator {
  static calculateDatasetStatistics(data: HistoricalDataPoint[]): any {
    if (data.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stddev: 0,
        variance: 0,
        percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
      };
    }

    const values = data.map(d => d.value).sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const mean = values.reduce((sum, val) => sum + val, 0) / count;
    const median = count % 2 === 0 
      ? (values[count / 2 - 1] + values[count / 2]) / 2
      : values[Math.floor(count / 2)];

    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const stddev = Math.sqrt(variance);

    const percentiles = {
      p25: this.percentile(values, 0.25),
      p50: median,
      p75: this.percentile(values, 0.75),
      p90: this.percentile(values, 0.90),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };

    return {
      count,
      min,
      max,
      mean,
      median,
      stddev,
      variance,
      percentiles
    };
  }

  static percentile(sortedArray: number[], p: number): number {
    const index = p * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  static calculateCorrelation(data1: HistoricalDataPoint[], data2: HistoricalDataPoint[]): number {
    if (data1.length === 0 || data2.length === 0) return 0;

    const minLength = Math.min(data1.length, data2.length);
    const values1 = data1.slice(0, minLength).map(d => d.value);
    const values2 = data2.slice(0, minLength).map(d => d.value);

    const mean1 = values1.reduce((a, b) => a + b) / values1.length;
    const mean2 = values2.reduce((a, b) => a + b) / values2.length;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < minLength; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;

      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }
}

// Default data service implementation
class DefaultHistoricalDataService implements HistoricalDataService {
  async queryHistoricalData(
    dataSourceId: string,
    timeRange: any,
    resolution: number,
    options = {}
  ): Promise<HistoricalDataPoint[]> {
    // Mock implementation - replace with actual API calls
    const { maxPoints = 10000 } = options;
    const points: HistoricalDataPoint[] = [];
    
    const startTime = timeRange.start.getTime();
    const endTime = timeRange.end.getTime();
    const interval = Math.max(1000, (endTime - startTime) / Math.min(maxPoints, resolution));
    
    for (let time = startTime; time < endTime; time += interval) {
      points.push({
        time: new Date(time),
        value: Math.random() * 100 + Math.sin(time / 10000) * 20,
        category: 'historical',
        historicalPeriod: dataSourceId,
        originalTimestamp: new Date(time),
        alignedTimestamp: new Date(time),
        metadata: {
          dataQuality: Math.random() * 0.2 + 0.8,
          interpolated: false
        }
      });
    }
    
    return points;
  }

  async getAvailablePeriods(dataSourceId: string): Promise<HistoricalPeriod[]> {
    // Mock implementation
    const now = new Date();
    const periods: HistoricalPeriod[] = [];
    
    for (let i = 1; i <= 5; i++) {
      const startTime = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const endTime = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
      
      periods.push({
        id: `period-${i}`,
        label: `${i} week${i > 1 ? 's' : ''} ago`,
        startTime,
        endTime,
        color: `hsl(${i * 60}, 70%, 50%)`,
        visible: i <= 2,
        dataSourceId
      });
    }
    
    return periods;
  }

  async calculateStatistics(data: HistoricalDataPoint[], metrics: any[]): Promise<any> {
    return StatisticsCalculator.calculateDatasetStatistics(data);
  }

  async alignTimeRanges(datasets: ComparisonDataset[], alignment: AlignmentConfig): Promise<ComparisonDataset[]> {
    return datasets.map(dataset => ({
      ...dataset,
      data: dataset.data.map(point => ({
        ...point,
        alignedTimestamp: this.applyAlignment(point.originalTimestamp, alignment, dataset.period)
      }))
    }));
  }

  async exportData(datasets: ComparisonDataset[], format: string, options = {}): Promise<Blob> {
    const data = {
      datasets: datasets.map(d => ({
        id: d.id,
        label: d.label,
        data: d.data.map(p => ({
          timestamp: p.time.toISOString(),
          value: p.value,
          aligned: p.alignedTimestamp.toISOString()
        }))
      })),
      exportTime: new Date().toISOString(),
      format,
      options
    };

    const content = format === 'csv' ? this.convertToCSV(data) : JSON.stringify(data, null, 2);
    return new Blob([content], { 
      type: format === 'csv' ? 'text/csv' : 'application/json' 
    });
  }

  private applyAlignment(timestamp: Date, alignment: AlignmentConfig, period: HistoricalPeriod): Date {
    switch (alignment.mode) {
      case 'relative':
        const referenceTime = alignment.referencePoint || period.startTime;
        const offset = timestamp.getTime() - period.startTime.getTime();
        return new Date(referenceTime.getTime() + offset);
      
      case 'phase':
        const phaseOffset = alignment.phaseOffset || 0;
        return new Date(timestamp.getTime() + phaseOffset);
      
      default:
        return timestamp;
    }
  }

  private convertToCSV(data: any): string {
    // Simple CSV conversion
    const headers = ['dataset', 'timestamp', 'value', 'aligned_timestamp'];
    const rows = [headers.join(',')];
    
    data.datasets.forEach((dataset: any) => {
      dataset.data.forEach((point: any) => {
        rows.push([
          dataset.id,
          point.timestamp,
          point.value,
          point.aligned
        ].join(','));
      });
    });
    
    return rows.join('\n');
  }
}

export const useHistoricalComparison = (
  options: UseHistoricalComparisonOptions
): UseHistoricalComparisonReturn => {
  // State management
  const [currentMode, setCurrentMode] = useState<ComparisonMode>(
    options.defaultMode || 'overlay'
  );
  const [datasets, setDatasets] = useState<ComparisonDataset[]>([]);
  const [statistics, setStatistics] = useState<ComparisonStatistics | null>(null);
  const [loadingStates, setLoadingStates] = useState<Record<string, LoadingState>>({});
  const [alignment, setAlignment] = useState<AlignmentConfig>(
    options.defaultAlignment || { mode: 'absolute' }
  );

  // Refs for persistent data
  const cacheRef = useRef<HistoricalDataCache>();
  const dataServiceRef = useRef<HistoricalDataService>(
    options.dataService || new DefaultHistoricalDataService()
  );
  const loadingAbortControllers = useRef<Map<string, AbortController>>(new Map());

  // Initialize cache
  useEffect(() => {
    if (options.caching?.enabled) {
      cacheRef.current = new HistoricalDataCache(
        options.caching.maxCacheSize,
        options.caching.ttl
      );
    }
  }, [options.caching]);

  // Set mode with validation
  const setMode = useCallback((mode: ComparisonMode) => {
    setCurrentMode(mode);
  }, []);

  // Add historical period
  const addHistoricalPeriod = useCallback(async (period: HistoricalPeriod) => {
    const cacheKey = `${period.dataSourceId}-${period.id}`;
    
    // Check cache first
    let data: HistoricalDataPoint[] | null = null;
    if (cacheRef.current) {
      data = cacheRef.current.get(cacheKey);
    }

    // Set initial loading state
    setLoadingStates(prev => ({
      ...prev,
      [period.id]: {
        phase: 'overview',
        progress: 0,
        dataPointsLoaded: 0,
        totalDataPoints: 1000, // Estimate
        loadingStartTime: new Date()
      }
    }));

    if (!data) {
      try {
        // Create abort controller for this request
        const abortController = new AbortController();
        loadingAbortControllers.current.set(period.id, abortController);

        // Progressive loading phases
        const phases = ['overview', 'details', 'full-resolution'] as const;
        const resolutions = [100, 500, 1000];
        
        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];
          const resolution = resolutions[i];
          
          // Update loading state
          setLoadingStates(prev => ({
            ...prev,
            [period.id]: {
              ...prev[period.id],
              phase,
              progress: (i / phases.length) * 100
            }
          }));

          // Load data for this phase
          const phaseData = await dataServiceRef.current.queryHistoricalData(
            period.dataSourceId || 'default',
            { start: period.startTime, end: period.endTime },
            resolution
          );

          // Merge with existing data if not first phase
          data = i === 0 ? phaseData : [...(data || []), ...phaseData];

          // Update progress
          setLoadingStates(prev => ({
            ...prev,
            [period.id]: {
              ...prev[period.id],
              progress: ((i + 1) / phases.length) * 100,
              dataPointsLoaded: data?.length || 0
            }
          }));

          // Small delay between phases for UX
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Cache the result
        if (cacheRef.current && data) {
          cacheRef.current.set(cacheKey, data);
        }

        // Mark as complete
        setLoadingStates(prev => ({
          ...prev,
          [period.id]: {
            ...prev[period.id],
            phase: 'complete',
            progress: 100
          }
        }));

      } catch (error) {
        console.error('Failed to load historical data:', error);
        
        setLoadingStates(prev => ({
          ...prev,
          [period.id]: {
            ...prev[period.id],
            phase: 'error',
            error: error as Error
          }
        }));
        
        return;
      } finally {
        loadingAbortControllers.current.delete(period.id);
      }
    }

    if (data) {
      // Calculate statistics
      const stats = await dataServiceRef.current.calculateStatistics(data, []);
      
      // Create dataset
      const dataset: ComparisonDataset = {
        id: period.id,
        label: period.label,
        data,
        period,
        statistics: stats,
        loadingState: {
          phase: 'complete',
          progress: 100,
          dataPointsLoaded: data.length,
          totalDataPoints: data.length
        }
      };

      setDatasets(prev => [...prev.filter(d => d.id !== period.id), dataset]);
    }
  }, []);

  // Remove historical period
  const removeHistoricalPeriod = useCallback((periodId: string) => {
    // Cancel any ongoing loading
    const abortController = loadingAbortControllers.current.get(periodId);
    if (abortController) {
      abortController.abort();
      loadingAbortControllers.current.delete(periodId);
    }

    setDatasets(prev => prev.filter(d => d.id !== periodId));
    setLoadingStates(prev => {
      const newState = { ...prev };
      delete newState[periodId];
      return newState;
    });
  }, []);

  // Update alignment
  const updateAlignment = useCallback(async (newAlignment: AlignmentConfig) => {
    setAlignment(newAlignment);
    
    if (datasets.length > 0) {
      try {
        const alignedDatasets = await dataServiceRef.current.alignTimeRanges(datasets, newAlignment);
        setDatasets(alignedDatasets);
      } catch (error) {
        console.error('Failed to update alignment:', error);
      }
    }
  }, [datasets]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    // Clear cache
    if (cacheRef.current) {
      cacheRef.current.clear();
    }

    // Reload all datasets
    const periodsToReload = datasets.map(d => d.period);
    setDatasets([]);
    
    for (const period of periodsToReload) {
      await addHistoricalPeriod(period);
    }
  }, [datasets, addHistoricalPeriod]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (cacheRef.current) {
      cacheRef.current.clear();
    }
  }, []);

  // Export comparison
  const exportComparison = useCallback(async (format: 'csv' | 'json' | 'png' | 'svg') => {
    if (format === 'png' || format === 'svg') {
      // TODO: Implement chart export
      console.warn('Chart export not yet implemented');
      return;
    }

    try {
      const blob = await dataServiceRef.current.exportData(datasets, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `historical-comparison.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export comparison:', error);
    }
  }, [datasets]);

  // Calculate differences
  const calculateDifferences = useCallback((): ComparisonDataset => {
    if (datasets.length === 0) {
      return {
        id: 'differences',
        label: 'Differences',
        data: [],
        period: {
          id: 'diff',
          label: 'Differences',
          startTime: new Date(),
          endTime: new Date(),
          color: '#f44336',
          visible: true
        },
        statistics: StatisticsCalculator.calculateDatasetStatistics([]),
        loadingState: { phase: 'complete', progress: 100, dataPointsLoaded: 0, totalDataPoints: 0 }
      };
    }

    // Calculate differences between first dataset and others
    const baseDataset = datasets[0];
    const differences: HistoricalDataPoint[] = [];

    datasets.slice(1).forEach(dataset => {
      const minLength = Math.min(baseDataset.data.length, dataset.data.length);
      
      for (let i = 0; i < minLength; i++) {
        const diff = baseDataset.data[i].value - dataset.data[i].value;
        differences.push({
          time: baseDataset.data[i].time,
          value: diff,
          category: 'difference',
          historicalPeriod: 'difference',
          originalTimestamp: baseDataset.data[i].originalTimestamp,
          alignedTimestamp: baseDataset.data[i].alignedTimestamp,
          metadata: {
            baseValue: baseDataset.data[i].value,
            compareValue: dataset.data[i].value,
            relativeDifference: diff / Math.abs(dataset.data[i].value) * 100
          }
        });
      }
    });

    return {
      id: 'differences',
      label: 'Differences',
      data: differences,
      period: {
        id: 'diff',
        label: 'Differences',
        startTime: baseDataset.period.startTime,
        endTime: baseDataset.period.endTime,
        color: '#f44336',
        visible: true
      },
      statistics: StatisticsCalculator.calculateDatasetStatistics(differences),
      loadingState: { phase: 'complete', progress: 100, dataPointsLoaded: differences.length, totalDataPoints: differences.length }
    };
  }, [datasets]);

  // Get memory usage
  const getMemoryUsage = useCallback((): number => {
    if (!cacheRef.current) return 0;
    return cacheRef.current.getMemoryUsage() / (1024 * 1024); // Convert to MB
  }, []);

  // Calculate comprehensive statistics
  const comprehensiveStatistics = useMemo((): ComparisonStatistics | null => {
    if (datasets.length === 0) return null;

    const current = datasets[0]?.statistics;
    if (!current) return null;

    const historical: Record<string, any> = {};
    const correlations: Record<string, number> = {};
    const differences: Record<string, any> = {};
    const confidenceIntervals: Record<string, any> = {};

    datasets.slice(1).forEach(dataset => {
      historical[dataset.id] = dataset.statistics;
      
      // Calculate correlation
      correlations[dataset.id] = StatisticsCalculator.calculateCorrelation(
        datasets[0].data,
        dataset.data
      );

      // Calculate differences
      differences[dataset.id] = {
        absolute: {
          mean: Math.abs(current.mean - dataset.statistics.mean),
          stddev: Math.abs(current.stddev - dataset.statistics.stddev)
        },
        relative: {
          mean: ((current.mean - dataset.statistics.mean) / Math.abs(dataset.statistics.mean)) * 100,
          stddev: ((current.stddev - dataset.statistics.stddev) / Math.abs(dataset.statistics.stddev)) * 100
        }
      };

      // Calculate confidence intervals (simplified)
      const stderr = dataset.statistics.stddev / Math.sqrt(dataset.statistics.count);
      const margin = 1.96 * stderr; // 95% confidence
      confidenceIntervals[dataset.id] = {
        lower: dataset.statistics.mean - margin,
        upper: dataset.statistics.mean + margin,
        confidence: 0.95
      };
    });

    return {
      current,
      historical,
      correlations,
      differences,
      confidenceIntervals
    };
  }, [datasets]);

  // Update statistics when datasets change
  useEffect(() => {
    setStatistics(comprehensiveStatistics);
  }, [comprehensiveStatistics]);

  return {
    // State
    currentMode,
    datasets,
    statistics,
    loadingStates,
    alignment,

    // Actions
    setMode,
    addHistoricalPeriod,
    removeHistoricalPeriod,
    updateAlignment,
    refreshData,
    clearCache,

    // Utilities
    exportComparison,
    calculateDifferences,
    getMemoryUsage
  };
};

export default useHistoricalComparison;