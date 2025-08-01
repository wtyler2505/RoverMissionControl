/**
 * Data Transformation Utilities
 * Provides functions for processing and transforming chart data
 */

import * as d3 from 'd3';
import { TimeSeriesDataPoint, ChartDataPoint, HeatmapDataPoint } from '../types';

/**
 * Data binning for histogram-style visualizations
 */
export const binData = <T extends { value: number }>(
  data: T[],
  binCount = 10,
  domain?: [number, number]
): Array<{ x0: number; x1: number; data: T[]; count: number }> => {
  const values = data.map(d => d.value);
  const extent = domain || (d3.extent(values) as [number, number]);
  
  if (!extent[0] && extent[0] !== 0) return [];
  
  const bins = d3.bin<T, number>()
    .domain(extent)
    .thresholds(binCount)
    .value(d => d.value);
  
  return bins(data).map(bin => ({
    x0: bin.x0 || 0,
    x1: bin.x1 || 0,
    data: bin,
    count: bin.length
  }));
};

/**
 * Data decimation for performance optimization
 * Reduces data points while preserving shape and extremes
 */
export const decimateData = <T extends { time: Date; value: number }>(
  data: T[],
  maxPoints: number,
  preserveExtremes = true
): T[] => {
  if (data.length <= maxPoints) return data;
  
  const sorted = [...data].sort((a, b) => a.time.getTime() - b.time.getTime());
  const step = Math.ceil(data.length / maxPoints);
  const decimated: T[] = [];
  
  if (preserveExtremes) {
    // Always include first and last points
    decimated.push(sorted[0]);
    
    // Find local extremes in each segment
    for (let i = step; i < sorted.length - step; i += step) {
      const segment = sorted.slice(Math.max(0, i - step), Math.min(sorted.length, i + step));
      const min = segment.reduce((a, b) => a.value < b.value ? a : b);
      const max = segment.reduce((a, b) => a.value > b.value ? a : b);
      
      if (!decimated.includes(min)) decimated.push(min);
      if (!decimated.includes(max) && max !== min) decimated.push(max);
    }
    
    decimated.push(sorted[sorted.length - 1]);
  } else {
    // Simple uniform sampling
    for (let i = 0; i < sorted.length; i += step) {
      decimated.push(sorted[i]);
    }
  }
  
  return decimated.sort((a, b) => a.time.getTime() - b.time.getTime());
};

/**
 * Data smoothing using moving averages
 */
export const smoothData = <T extends { value: number }>(
  data: T[],
  windowSize = 5,
  method: 'simple' | 'exponential' | 'gaussian' = 'simple'
): T[] => {
  if (data.length < windowSize) return data;
  
  const smoothed: T[] = [];
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < data.length; i++) {
    let smoothedValue: number;
    
    switch (method) {
      case 'exponential':
        smoothedValue = exponentialMovingAverage(data, i, windowSize);
        break;
      case 'gaussian':
        smoothedValue = gaussianSmooth(data, i, windowSize);
        break;
      default:
        smoothedValue = simpleMovingAverage(data, i, windowSize);
    }
    
    smoothed.push({
      ...data[i],
      value: smoothedValue
    });
  }
  
  return smoothed;
};

/**
 * Simple moving average
 */
const simpleMovingAverage = <T extends { value: number }>(
  data: T[],
  index: number,
  windowSize: number
): number => {
  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(0, index - halfWindow);
  const end = Math.min(data.length, index + halfWindow + 1);
  
  const sum = data.slice(start, end).reduce((acc, d) => acc + d.value, 0);
  return sum / (end - start);
};

/**
 * Exponential moving average
 */
const exponentialMovingAverage = <T extends { value: number }>(
  data: T[],
  index: number,
  windowSize: number
): number => {
  const alpha = 2 / (windowSize + 1);
  
  if (index === 0) return data[0].value;
  
  const prevEMA = exponentialMovingAverage(data, index - 1, windowSize);
  return alpha * data[index].value + (1 - alpha) * prevEMA;
};

/**
 * Gaussian smoothing
 */
const gaussianSmooth = <T extends { value: number }>(
  data: T[],
  index: number,
  windowSize: number
): number => {
  const sigma = windowSize / 3;
  const halfWindow = Math.floor(windowSize / 2);
  
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (let i = Math.max(0, index - halfWindow); i <= Math.min(data.length - 1, index + halfWindow); i++) {
    const distance = Math.abs(i - index);
    const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
    
    weightedSum += data[i].value * weight;
    totalWeight += weight;
  }
  
  return weightedSum / totalWeight;
};

/**
 * Outlier detection and removal
 */
export const removeOutliers = <T extends { value: number }>(
  data: T[],
  method: 'iqr' | 'zscore' | 'modified-zscore' = 'iqr',
  threshold = 1.5
): { cleaned: T[]; outliers: T[] } => {
  const values = data.map(d => d.value);
  const outlierIndices: Set<number> = new Set();
  
  switch (method) {
    case 'iqr':
      outlierIndices.clear();
      const q1 = d3.quantile(values.sort((a, b) => a - b), 0.25) || 0;
      const q3 = d3.quantile(values.sort((a, b) => a - b), 0.75) || 0;
      const iqr = q3 - q1;
      const lowerBound = q1 - threshold * iqr;
      const upperBound = q3 + threshold * iqr;
      
      data.forEach((d, i) => {
        if (d.value < lowerBound || d.value > upperBound) {
          outlierIndices.add(i);
        }
      });
      break;
      
    case 'zscore':
      const mean = d3.mean(values) || 0;
      const std = d3.deviation(values) || 1;
      
      data.forEach((d, i) => {
        const zscore = Math.abs((d.value - mean) / std);
        if (zscore > threshold) {
          outlierIndices.add(i);
        }
      });
      break;
      
    case 'modified-zscore':
      const median = d3.median(values) || 0;
      const mad = d3.median(values.map(v => Math.abs(v - median))) || 1;
      
      data.forEach((d, i) => {
        const modifiedZScore = 0.6745 * (d.value - median) / mad;
        if (Math.abs(modifiedZScore) > threshold) {
          outlierIndices.add(i);
        }
      });
      break;
  }
  
  const cleaned = data.filter((_, i) => !outlierIndices.has(i));
  const outliers = data.filter((_, i) => outlierIndices.has(i));
  
  return { cleaned, outliers };
};

/**
 * Data aggregation by time windows
 */
export const aggregateByTimeWindow = (
  data: TimeSeriesDataPoint[],
  windowSize: number, // in milliseconds
  aggregationMethod: 'mean' | 'sum' | 'min' | 'max' | 'count' = 'mean'
): TimeSeriesDataPoint[] => {
  if (data.length === 0) return [];
  
  const sorted = [...data].sort((a, b) => a.time.getTime() - b.time.getTime());
  const aggregated: TimeSeriesDataPoint[] = [];
  
  const firstTime = sorted[0].time.getTime();
  const lastTime = sorted[sorted.length - 1].time.getTime();
  
  for (let windowStart = firstTime; windowStart <= lastTime; windowStart += windowSize) {
    const windowEnd = windowStart + windowSize;
    const windowData = sorted.filter(d => 
      d.time.getTime() >= windowStart && d.time.getTime() < windowEnd
    );
    
    if (windowData.length === 0) continue;
    
    let aggregatedValue: number;
    const values = windowData.map(d => d.value);
    
    switch (aggregationMethod) {
      case 'sum':
        aggregatedValue = d3.sum(values);
        break;
      case 'min':
        aggregatedValue = d3.min(values) || 0;
        break;
      case 'max':
        aggregatedValue = d3.max(values) || 0;
        break;
      case 'count':
        aggregatedValue = values.length;
        break;
      default:
        aggregatedValue = d3.mean(values) || 0;
    }
    
    // Determine category based on majority
    const categories = windowData.map(d => d.category).filter(Boolean);
    const categoryCount = d3.rollup(categories, v => v.length, d => d);
    const dominantCategory = [...categoryCount.entries()].reduce((a, b) => 
      a[1] > b[1] ? a : b
    )?.[0];
    
    aggregated.push({
      time: new Date(windowStart + windowSize / 2), // Middle of window
      value: aggregatedValue,
      category: dominantCategory as any,
      metadata: {
        windowStart: new Date(windowStart),
        windowEnd: new Date(windowEnd),
        dataPoints: windowData.length,
        originalData: windowData
      }
    });
  }
  
  return aggregated;
};

/**
 * Convert data to different chart formats
 */
export const convertToHeatmapData = (
  data: Array<{ x: string | number; y: string | number; value: number; label?: string }>
): HeatmapDataPoint[] => {
  return data.map(d => ({
    x: d.x,
    y: d.y,
    value: d.value,
    label: d.label || `${d.x}, ${d.y}`
  }));
};

/**
 * Pivot data for different visualizations
 */
export const pivotData = (
  data: Array<{ row: string; column: string; value: number }>,
  aggregationMethod: 'sum' | 'mean' | 'count' = 'sum'
): Array<{ x: string; y: string; value: number }> => {
  const grouped = d3.rollup(data, 
    values => {
      const nums = values.map(v => v.value);
      switch (aggregationMethod) {
        case 'mean':
          return d3.mean(nums) || 0;
        case 'count':
          return nums.length;
        default:
          return d3.sum(nums);
      }
    },
    d => d.row,
    d => d.column
  );
  
  const result: Array<{ x: string; y: string; value: number }> = [];
  
  grouped.forEach((columns, row) => {
    columns.forEach((value, column) => {
      result.push({ x: column, y: row, value });
    });
  });
  
  return result;
};

/**
 * Data interpolation for missing values
 */
export const interpolateMissingValues = (
  data: TimeSeriesDataPoint[],
  method: 'linear' | 'step' | 'spline' = 'linear'
): TimeSeriesDataPoint[] => {
  if (data.length < 2) return data;
  
  const sorted = [...data].sort((a, b) => a.time.getTime() - b.time.getTime());
  const result: TimeSeriesDataPoint[] = [];
  
  for (let i = 0; i < sorted.length - 1; i++) {
    result.push(sorted[i]);
    
    const current = sorted[i];
    const next = sorted[i + 1];
    const timeDiff = next.time.getTime() - current.time.getTime();
    
    // If there's a significant gap, interpolate
    if (timeDiff > 60000) { // More than 1 minute gap
      const steps = Math.floor(timeDiff / 30000); // 30-second intervals
      
      for (let step = 1; step < steps && step < 10; step++) { // Limit interpolated points
        const ratio = step / steps;
        const interpolatedTime = new Date(current.time.getTime() + ratio * timeDiff);
        
        let interpolatedValue: number;
        
        switch (method) {
          case 'step':
            interpolatedValue = current.value;
            break;
          case 'spline':
            // Simple cubic interpolation (would need more points for true spline)
            interpolatedValue = current.value + (next.value - current.value) * Math.pow(ratio, 2) * (3 - 2 * ratio);
            break;
          default:
            interpolatedValue = current.value + (next.value - current.value) * ratio;
        }
        
        result.push({
          time: interpolatedTime,
          value: interpolatedValue,
          category: current.category,
          metadata: {
            interpolated: true,
            method,
            originalPoints: [current, next]
          }
        });
      }
    }
  }
  
  result.push(sorted[sorted.length - 1]);
  return result;
};

/**
 * Calculate correlation matrix
 */
export const calculateCorrelationMatrix = (
  data: Array<Record<string, number>>,
  variables: string[]
): Array<{ x: string; y: string; value: number }> => {
  const result: Array<{ x: string; y: string; value: number }> = [];
  
  for (let i = 0; i < variables.length; i++) {
    for (let j = 0; j < variables.length; j++) {
      const var1 = variables[i];
      const var2 = variables[j];
      
      if (i === j) {
        // Perfect correlation with self
        result.push({ x: var1, y: var2, value: 1 });
        continue;
      }
      
      const values1 = data.map(d => d[var1]).filter(v => v !== undefined && !isNaN(v));
      const values2 = data.map(d => d[var2]).filter(v => v !== undefined && !isNaN(v));
      
      if (values1.length !== values2.length || values1.length < 2) {
        result.push({ x: var1, y: var2, value: 0 });
        continue;
      }
      
      const mean1 = d3.mean(values1) || 0;
      const mean2 = d3.mean(values2) || 0;
      
      let numerator = 0;
      let sum1Sq = 0;
      let sum2Sq = 0;
      
      for (let k = 0; k < values1.length; k++) {
        const diff1 = values1[k] - mean1;
        const diff2 = values2[k] - mean2;
        
        numerator += diff1 * diff2;
        sum1Sq += diff1 * diff1;
        sum2Sq += diff2 * diff2;
      }
      
      const denominator = Math.sqrt(sum1Sq * sum2Sq);
      const correlation = denominator === 0 ? 0 : numerator / denominator;
      
      result.push({ x: var1, y: var2, value: correlation });
    }
  }
  
  return result;
};

/**
 * Create transformation pipeline
 */
export interface TransformationStep<T = any> {
  name: string;
  transform: (data: T[]) => T[];
  params?: Record<string, any>;
}

export const createTransformationPipeline = <T = any>(
  steps: TransformationStep<T>[]
) => ({
  steps,
  apply: (data: T[]): T[] => {
    return steps.reduce((currentData, step) => {
      try {
        return step.transform(currentData);
      } catch (error) {
        console.warn(`Transformation step "${step.name}" failed:`, error);
        return currentData;
      }
    }, data);
  },
  addStep: (step: TransformationStep<T>) => {
    steps.push(step);
  },
  removeStep: (name: string) => {
    const index = steps.findIndex(step => step.name === name);
    if (index >= 0) {
      steps.splice(index, 1);
    }
  }
});

// Export common transformation pipelines
export const commonPipelines = {
  telemetrySmoothing: createTransformationPipeline<TimeSeriesDataPoint>([
    {
      name: 'removeOutliers',
      transform: (data) => removeOutliers(data, 'iqr', 2).cleaned
    },
    {
      name: 'smoothing',
      transform: (data) => smoothData(data, 5, 'exponential')
    },
    {
      name: 'interpolation',
      transform: (data) => interpolateMissingValues(data, 'linear')
    }
  ]),
  
  performanceOptimization: createTransformationPipeline<TimeSeriesDataPoint>([
    {
      name: 'decimation',
      transform: (data) => decimateData(data, 1000, true)
    },
    {
      name: 'aggregation',
      transform: (data) => aggregateByTimeWindow(data, 60000, 'mean') // 1-minute windows
    }
  ])
};