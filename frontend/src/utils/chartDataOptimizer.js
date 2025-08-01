/**
 * Chart Data Optimizer
 * Provides memoization and caching utilities for chart data processing
 * Reduces expensive calculations and prevents unnecessary re-renders
 */

import { useMemo, useRef, useCallback } from 'react';

// Cache for processed chart data
const chartDataCache = new Map();
const cacheMaxSize = 100;
const cacheExpiry = 5 * 60 * 1000; // 5 minutes

/**
 * Generate cache key for chart data
 */
function generateCacheKey(data, options = {}) {
  const dataHash = JSON.stringify({
    length: data?.length || 0,
    lastItem: data?.[data.length - 1],
    firstItem: data?.[0],
    ...options
  });
  
  return btoa(dataHash).slice(0, 16);
}

/**
 * Get cached data if valid
 */
function getCachedData(key) {
  const cached = chartDataCache.get(key);
  if (cached && Date.now() - cached.timestamp < cacheExpiry) {
    return cached.data;
  }
  return null;
}

/**
 * Cache processed data
 */
function setCachedData(key, data) {
  // Implement LRU cache eviction
  if (chartDataCache.size >= cacheMaxSize) {
    const firstKey = chartDataCache.keys().next().value;
    chartDataCache.delete(firstKey);
  }
  
  chartDataCache.set(key, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Optimized hook for processing telemetry chart data
 */
export function useOptimizedChartData(telemetryHistory, options = {}) {
  const {
    maxDataPoints = 20,
    decimationFactor = 1,
    enableSmoothing = false,
    smoothingWindow = 3
  } = options;
  
  return useMemo(() => {
    if (!telemetryHistory || telemetryHistory.length === 0) {
      return {
        labels: [],
        datasets: [
          {
            label: 'Front Left',
            data: [],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.1,
          },
          {
            label: 'Front Right',
            data: [],
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.1,
          },
          {
            label: 'Rear Left',
            data: [],
            borderColor: 'rgb(255, 205, 86)',
            backgroundColor: 'rgba(255, 205, 86, 0.2)',
            tension: 0.1,
          },
          {
            label: 'Rear Right',
            data: [],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1,
          },
        ],
      };
    }
    
    // Generate cache key
    const cacheKey = generateCacheKey(telemetryHistory, { 
      maxDataPoints, 
      decimationFactor, 
      enableSmoothing,
      smoothingWindow 
    });
    
    // Check cache first
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    // Process data
    let processedData = telemetryHistory.slice(-maxDataPoints);
    
    // Apply decimation if needed
    if (decimationFactor > 1) {
      processedData = processedData.filter((_, index) => index % decimationFactor === 0);
    }
    
    // Apply smoothing if enabled
    if (enableSmoothing && smoothingWindow > 1) {
      processedData = applySmoothingToData(processedData, smoothingWindow);
    }
    
    const result = {
      labels: processedData.map((_, i) => i.toString()),
      datasets: [
        {
          label: 'Front Left',
          data: processedData.map(t => t?.wheels?.fl || 0),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          tension: 0.1,
          pointRadius: processedData.length > 50 ? 0 : 2, // Hide points for large datasets
          pointHoverRadius: 4,
        },
        {
          label: 'Front Right',
          data: processedData.map(t => t?.wheels?.fr || 0),
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          tension: 0.1,
          pointRadius: processedData.length > 50 ? 0 : 2,
          pointHoverRadius: 4,
        },
        {
          label: 'Rear Left',
          data: processedData.map(t => t?.wheels?.rl || 0),
          borderColor: 'rgb(255, 205, 86)',
          backgroundColor: 'rgba(255, 205, 86, 0.2)',
          tension: 0.1,
          pointRadius: processedData.length > 50 ? 0 : 2,
          pointHoverRadius: 4,
        },
        {
          label: 'Rear Right',
          data: processedData.map(t => t?.wheels?.rr || 0),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          pointRadius: processedData.length > 50 ? 0 : 2,
          pointHoverRadius: 4,
        },
      ],
    };
    
    // Cache the result
    setCachedData(cacheKey, result);
    
    return result;
  }, [telemetryHistory, maxDataPoints, decimationFactor, enableSmoothing, smoothingWindow]);
}

/**
 * Optimized hook for chart options with performance considerations
 */
export function useOptimizedChartOptions(options = {}) {
  const {
    showLegend = true,
    showTooltips = true,
    enableAnimation = true,
    maxTicks = 10,
    yAxisMax = 150
  } = options;
  
  return useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: enableAnimation ? {
      duration: 300,
      easing: 'easeInOutQuart'
    } : false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: showLegend,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 10,
          font: {
            size: 11
          }
        }
      },
      title: {
        display: true,
        text: 'Wheel RPM Telemetry',
        font: {
          size: 14,
          weight: 'bold'
        }
      },
      tooltip: {
        enabled: showTooltips,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: true,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} RPM`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time Points',
          font: {
            size: 12
          }
        },
        ticks: {
          maxTicksLimit: maxTicks,
          font: {
            size: 10
          }
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        display: true,
        beginAtZero: true,
        max: yAxisMax,
        title: {
          display: true,
          text: 'RPM',
          font: {
            size: 12
          }
        },
        ticks: {
          maxTicksLimit: 8,
          font: {
            size: 10
          },
          callback: function(value) {
            return value.toFixed(0);
          }
        },
        grid: {
          display: true,
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
    },
    elements: {
      line: {
        borderWidth: 2,
        fill: false
      },
      point: {
        radius: 2,
        hoverRadius: 4,
        borderWidth: 1
      }
    },
    // Performance optimizations
    parsing: false, // Disable data parsing for better performance
    normalized: true, // Use normalized data coordinates
    spanGaps: true, // Connect lines across null data points
    // Accessibility
    accessibility: {
      enabled: true,
      description: 'Real-time telemetry chart showing wheel RPM data for all four rover wheels over time'
    }
  }), [showLegend, showTooltips, enableAnimation, maxTicks, yAxisMax]);
}

/**
 * Apply smoothing to telemetry data using moving average
 */
function applySmoothingToData(data, windowSize) {
  if (windowSize <= 1) return data;
  
  return data.map((item, index) => {
    if (!item?.wheels) return item;
    
    const start = Math.max(0, index - Math.floor(windowSize / 2));
    const end = Math.min(data.length, start + windowSize);
    const window = data.slice(start, end);
    
    const smoothedWheels = {
      fl: calculateAverage(window, 'wheels.fl'),
      fr: calculateAverage(window, 'wheels.fr'),
      rl: calculateAverage(window, 'wheels.rl'),
      rr: calculateAverage(window, 'wheels.rr')
    };
    
    return {
      ...item,
      wheels: smoothedWheels
    };
  });
}

/**
 * Calculate average value from data window
 */
function calculateAverage(window, path) {
  const values = window
    .map(item => getNestedValue(item, path))
    .filter(val => typeof val === 'number' && !isNaN(val));
  
  if (values.length === 0) return 0;
  
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Hook for managing chart animation frames
 */
export function useChartAnimationFrame(callback, dependencies) {
  const frameRef = useRef(null);
  const callbackRef = useRef(callback);
  
  // Update callback ref when callback changes
  callbackRef.current = callback;
  
  const startAnimation = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    
    const animate = (timestamp) => {
      callbackRef.current(timestamp);
      frameRef.current = requestAnimationFrame(animate);
    };
    
    frameRef.current = requestAnimationFrame(animate);
  }, []);
  
  const stopAnimation = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);
  
  return { startAnimation, stopAnimation };
}

/**
 * Hook for debounced chart updates
 */
export function useDebouncedChartUpdate(updateFunction, delay = 100) {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      updateFunction(...args);
    }, delay);
  }, [updateFunction, delay]);
}

/**
 * Clear all chart data caches
 */
export function clearChartDataCache() {
  chartDataCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getChartCacheStats() {
  return {
    size: chartDataCache.size,
    maxSize: cacheMaxSize,
    keys: Array.from(chartDataCache.keys())
  };
}