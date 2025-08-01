/**
 * Chart Data Management Hooks
 * Provides hooks for handling chart data with real-time updates and transformations
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TimeSeriesDataPoint, ChartDataPoint } from '../types';
import { 
  decimateData, 
  smoothData, 
  removeOutliers, 
  aggregateByTimeWindow,
  createTransformationPipeline,
  TransformationStep
} from '../utils/dataTransformers';

/**
 * Hook for managing time-series chart data with real-time updates
 */
export const useTimeSeriesData = (
  maxPoints = 1000,
  windowSize = 60000, // 1 minute window
  transformations: TransformationStep<TimeSeriesDataPoint>[] = []
) => {
  const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const transformationPipeline = useMemo(
    () => createTransformationPipeline(transformations),
    [transformations]
  );

  /**
   * Add new data points
   */
  const addDataPoints = useCallback((newPoints: TimeSeriesDataPoint[]) => {
    setData(prevData => {
      let combined = [...prevData, ...newPoints]
        .sort((a, b) => a.time.getTime() - b.time.getTime());
      
      // Apply transformations
      combined = transformationPipeline.apply(combined);
      
      // Limit data points for performance
      if (combined.length > maxPoints) {
        combined = decimateData(combined, maxPoints, true);
      }
      
      return combined;
    });
  }, [maxPoints, transformationPipeline]);

  /**
   * Add single data point
   */
  const addDataPoint = useCallback((point: TimeSeriesDataPoint) => {
    addDataPoints([point]);
  }, [addDataPoints]);

  /**
   * Clear all data
   */
  const clearData = useCallback(() => {
    setData([]);
    setError(null);
  }, []);

  /**
   * Update transformation pipeline
   */
  const updateTransformations = useCallback((newTransformations: TransformationStep<TimeSeriesDataPoint>[]) => {
    setData(prevData => {
      const newPipeline = createTransformationPipeline(newTransformations);
      return newPipeline.apply(prevData);
    });
  }, []);

  /**
   * Aggregate data by time windows
   */
  const aggregateData = useCallback((
    aggregationWindow: number = windowSize,
    method: 'mean' | 'sum' | 'min' | 'max' | 'count' = 'mean'
  ) => {
    return aggregateByTimeWindow(data, aggregationWindow, method);
  }, [data, windowSize]);

  /**
   * Get data statistics
   */
  const getStatistics = useCallback(() => {
    if (data.length === 0) return null;

    const values = data.map(d => d.value);
    const times = data.map(d => d.time.getTime());
    
    return {
      count: data.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
      timeRange: {
        start: new Date(Math.min(...times)),
        end: new Date(Math.max(...times)),
        duration: Math.max(...times) - Math.min(...times)
      },
      categories: [...new Set(data.map(d => d.category).filter(Boolean))]
    };
  }, [data]);

  return {
    data,
    isLoading,
    error,
    setData,
    setIsLoading,
    setError,
    addDataPoint,
    addDataPoints,
    clearData,
    updateTransformations,
    aggregateData,
    getStatistics
  };
};

/**
 * Hook for managing real-time data streams
 */
export const useRealTimeData = <T extends { time: Date }>(
  streamSource: () => Promise<T[]> | T[],
  interval = 1000,
  maxHistory = 1000
) => {
  const [data, setData] = useState<T[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  const streamingRef = useRef(false);

  /**
   * Start streaming data
   */
  const startStreaming = useCallback(async () => {
    if (streamingRef.current) return;
    
    streamingRef.current = true;
    setIsStreaming(true);
    setError(null);

    const fetchData = async () => {
      if (!streamingRef.current) return;
      
      try {
        const newData = await streamSource();
        const dataArray = Array.isArray(newData) ? newData : [newData];
        
        setData(prevData => {
          const combined = [...prevData, ...dataArray]
            .sort((a, b) => a.time.getTime() - b.time.getTime())
            .slice(-maxHistory); // Keep only recent data
          
          return combined;
        });
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching real-time data:', err);
      }
    };

    // Initial fetch
    await fetchData();

    // Set up interval
    intervalRef.current = setInterval(fetchData, interval);
  }, [streamSource, interval, maxHistory]);

  /**
   * Stop streaming data
   */
  const stopStreaming = useCallback(() => {
    streamingRef.current = false;
    setIsStreaming(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  /**
   * Toggle streaming
   */
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    data,
    isStreaming,
    error,
    startStreaming,
    stopStreaming,
    toggleStreaming,
    clearData: () => setData([])
  };
};

/**
 * Hook for handling data filtering and searching
 */
export const useDataFilter = <T extends Record<string, any>>(initialData: T[] = []) => {
  const [data, setData] = useState<T[]>(initialData);
  const [filteredData, setFilteredData] = useState<T[]>(initialData);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T;
    direction: 'asc' | 'desc';
  } | null>(null);

  /**
   * Apply all filters
   */
  const applyFilters = useCallback(() => {
    let result = [...data];

    // Apply field filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        result = result.filter(item => {
          const itemValue = item[key];
          
          if (typeof value === 'string' && typeof itemValue === 'string') {
            return itemValue.toLowerCase().includes(value.toLowerCase());
          } else if (typeof value === 'number') {
            return itemValue === value;
          } else if (Array.isArray(value)) {
            return value.includes(itemValue);
          } else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
            return itemValue >= value.min && itemValue <= value.max;
          }
          
          return itemValue === value;
        });
      }
    });

    // Apply search term
    if (searchTerm) {
      result = result.filter(item =>
        Object.values(item).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    setFilteredData(result);
  }, [data, filters, searchTerm, sortConfig]);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  /**
   * Update a specific filter
   */
  const updateFilter = useCallback((key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * Remove a specific filter
   */
  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchTerm('');
    setSortConfig(null);
  }, []);

  /**
   * Update sort configuration
   */
  const updateSort = useCallback((key: keyof T, direction?: 'asc' | 'desc') => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        // Toggle direction or clear if same key
        const newDirection = direction || (prev.direction === 'asc' ? 'desc' : 'asc');
        return { key, direction: newDirection };
      }
      return { key, direction: direction || 'asc' };
    });
  }, []);

  return {
    data,
    filteredData,
    filters,
    searchTerm,
    sortConfig,
    setData,
    setSearchTerm,
    updateFilter,
    removeFilter,
    clearFilters,
    updateSort,
    totalCount: data.length,
    filteredCount: filteredData.length
  };
};

/**
 * Hook for managing chart data with caching
 */
export const useCachedChartData = <T>(
  dataFetcher: () => Promise<T>,
  cacheKey: string,
  refreshInterval?: number
) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const cacheRef = useRef<Map<string, { data: T; timestamp: number }>>(new Map());
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  /**
   * Fetch data with caching
   */
  const fetchData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check cache first
      const cached = cacheRef.current.get(cacheKey);
      const cacheAge = cached ? Date.now() - cached.timestamp : Infinity;
      const cacheValid = cached && cacheAge < (refreshInterval || 300000); // 5 minutes default

      if (!forceRefresh && cacheValid) {
        setData(cached.data);
        setLastUpdated(new Date(cached.timestamp));
        setIsLoading(false);
        return cached.data;
      }

      // Fetch new data
      const newData = await dataFetcher();
      
      // Update cache
      cacheRef.current.set(cacheKey, {
        data: newData,
        timestamp: Date.now()
      });

      setData(newData);
      setLastUpdated(new Date());
      
      return newData;
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching chart data:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [dataFetcher, cacheKey, refreshInterval]);

  /**
   * Setup automatic refresh
   */
  useEffect(() => {
    if (refreshInterval && refreshInterval > 0) {
      const setupRefresh = () => {
        refreshTimeoutRef.current = setTimeout(() => {
          fetchData();
          setupRefresh(); // Setup next refresh
        }, refreshInterval);
      };
      
      setupRefresh();
    }

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchData, refreshInterval]);

  /**
   * Initial data fetch
   */
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Manual refresh
   */
  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  /**
   * Clear cache
   */
  const clearCache = useCallback(() => {
    cacheRef.current.delete(cacheKey);
  }, [cacheKey]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    refresh,
    clearCache
  };
};

/**
 * Hook for managing data export functionality
 */
export const useDataExport = <T>() => {
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Export data as CSV
   */
  const exportCSV = useCallback(async (
    data: T[],
    filename = 'chart-data.csv',
    columns?: (keyof T)[]
  ) => {
    setIsExporting(true);
    
    try {
      // Determine columns
      const cols = columns || (data.length > 0 ? Object.keys(data[0]) as (keyof T)[] : []);
      
      // Create CSV content
      const headers = cols.map(col => String(col)).join(',');
      const rows = data.map(row => 
        cols.map(col => {
          const value = row[col];
          // Escape commas and quotes
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
      );
      
      const csvContent = [headers, ...rows].join('\n');
      
      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  /**
   * Export data as JSON
   */
  const exportJSON = useCallback(async (
    data: T[],
    filename = 'chart-data.json',
    pretty = true
  ) => {
    setIsExporting(true);
    
    try {
      const jsonContent = JSON.stringify(data, null, pretty ? 2 : 0);
      
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    exportCSV,
    exportJSON
  };
};