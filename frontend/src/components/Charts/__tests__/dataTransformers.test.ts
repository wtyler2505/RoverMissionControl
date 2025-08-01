/**
 * Data Transformers Tests
 * Comprehensive test suite for chart data transformation utilities
 */

import {
  binData,
  decimateData,
  smoothData,
  removeOutliers,
  aggregateByTimeWindow,
  convertToHeatmapData,
  pivotData,
  interpolateMissingValues,
  calculateCorrelationMatrix,
  createTransformationPipeline,
  commonPipelines
} from '../utils/dataTransformers';
import { TimeSeriesDataPoint } from '../types';

// Test data
const mockTimeSeriesData: TimeSeriesDataPoint[] = [
  { time: new Date('2024-01-01T10:00:00Z'), value: 10 },
  { time: new Date('2024-01-01T10:01:00Z'), value: 15 },
  { time: new Date('2024-01-01T10:02:00Z'), value: 8 },
  { time: new Date('2024-01-01T10:03:00Z'), value: 20 },
  { time: new Date('2024-01-01T10:04:00Z'), value: 12 },
  { time: new Date('2024-01-01T10:05:00Z'), value: 18 },
  { time: new Date('2024-01-01T10:06:00Z'), value: 25 },
  { time: new Date('2024-01-01T10:07:00Z'), value: 5 },
  { time: new Date('2024-01-01T10:08:00Z'), value: 30 },
  { time: new Date('2024-01-01T10:09:00Z'), value: 22 }
];

const mockDataWithOutliers: TimeSeriesDataPoint[] = [
  { time: new Date('2024-01-01T10:00:00Z'), value: 10 },
  { time: new Date('2024-01-01T10:01:00Z'), value: 12 },
  { time: new Date('2024-01-01T10:02:00Z'), value: 11 },
  { time: new Date('2024-01-01T10:03:00Z'), value: 100 }, // outlier
  { time: new Date('2024-01-01T10:04:00Z'), value: 9 },
  { time: new Date('2024-01-01T10:05:00Z'), value: 13 },
  { time: new Date('2024-01-01T10:06:00Z'), value: -50 }, // outlier
  { time: new Date('2024-01-01T10:07:00Z'), value: 14 },
  { time: new Date('2024-01-01T10:08:00Z'), value: 12 },
  { time: new Date('2024-01-01T10:09:00Z'), value: 10 }
];

const mockNumericalData = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
  { value: 4 },
  { value: 5 },
  { value: 6 },
  { value: 7 },
  { value: 8 },
  { value: 9 },
  { value: 10 }
];

const mockLargeDataset: TimeSeriesDataPoint[] = Array.from({ length: 1000 }, (_, i) => ({
  time: new Date(Date.now() + i * 1000),
  value: Math.sin(i / 100) * 50 + 50 + (Math.random() - 0.5) * 10
}));

describe('Data Transformers', () => {
  describe('binData', () => {
    it('creates correct number of bins', () => {
      const result = binData(mockNumericalData, 5);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('assigns data points to correct bins', () => {
      const result = binData(mockNumericalData, 3);
      
      result.forEach(bin => {
        expect(bin.x0).toBeDefined();
        expect(bin.x1).toBeDefined();
        expect(bin.count).toBe(bin.data.length);
        expect(bin.x0).toBeLessThanOrEqual(bin.x1);
      });
    });

    it('handles empty data', () => {
      const result = binData([], 5);
      expect(result).toHaveLength(0);
    });

    it('respects custom domain', () => {
      const domain: [number, number] = [0, 20];
      const result = binData(mockNumericalData, 4, domain);
      
      if (result.length > 0) {
        expect(result[0].x0).toBeGreaterThanOrEqual(domain[0]);
        expect(result[result.length - 1].x1).toBeLessThanOrEqual(domain[1]);
      }
    });

    it('handles single value data', () => {
      const singleValueData = [{ value: 5 }, { value: 5 }, { value: 5 }];
      const result = binData(singleValueData, 3);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('decimateData', () => {
    it('reduces data points to specified maximum', () => {
      const maxPoints = 5;
      const result = decimateData(mockTimeSeriesData, maxPoints);
      expect(result.length).toBeLessThanOrEqual(maxPoints);
    });

    it('preserves extremes when option is enabled', () => {
      const result = decimateData(mockTimeSeriesData, 5, true);
      
      // Should include first and last points
      expect(result[0]).toEqual(mockTimeSeriesData[0]);
      expect(result[result.length - 1]).toEqual(mockTimeSeriesData[mockTimeSeriesData.length - 1]);
    });

    it('returns original data when under limit', () => {
      const result = decimateData(mockTimeSeriesData, 20);
      expect(result).toHaveLength(mockTimeSeriesData.length);
    });

    it('maintains time ordering', () => {
      const result = decimateData(mockTimeSeriesData, 5);
      
      for (let i = 1; i < result.length; i++) {
        expect(result[i].time.getTime()).toBeGreaterThanOrEqual(result[i - 1].time.getTime());
      }
    });

    it('handles large datasets efficiently', () => {
      const startTime = performance.now();
      const result = decimateData(mockLargeDataset, 100);
      const endTime = performance.now();
      
      expect(result.length).toBeLessThanOrEqual(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('smoothData', () => {
    it('applies simple moving average', () => {
      const result = smoothData(mockNumericalData, 3, 'simple');
      expect(result).toHaveLength(mockNumericalData.length);
      
      // Values should be smoothed
      expect(result[0].value).toBe(mockNumericalData[0].value);
      expect(result[result.length - 1].value).toBe(mockNumericalData[mockNumericalData.length - 1].value);
    });

    it('applies exponential moving average', () => {
      const result = smoothData(mockNumericalData, 3, 'exponential');
      expect(result).toHaveLength(mockNumericalData.length);
      
      // First value should remain unchanged
      expect(result[0].value).toBe(mockNumericalData[0].value);
    });

    it('applies gaussian smoothing', () => {
      const result = smoothData(mockNumericalData, 3, 'gaussian');
      expect(result).toHaveLength(mockNumericalData.length);
      
      // Values should be between original min and max
      const originalValues = mockNumericalData.map(d => d.value);
      const smoothedValues = result.map(d => d.value);
      
      smoothedValues.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(Math.min(...originalValues));
        expect(value).toBeLessThanOrEqual(Math.max(...originalValues));
      });
    });

    it('handles data smaller than window size', () => {
      const smallData = [{ value: 1 }, { value: 2 }];
      const result = smoothData(smallData, 5);
      expect(result).toEqual(smallData);
    });

    it('reduces noise in data', () => {
      const noisyData = Array.from({ length: 20 }, (_, i) => ({
        value: Math.sin(i / 5) + (Math.random() - 0.5) * 0.5
      }));
      
      const smoothed = smoothData(noisyData, 5, 'simple');
      
      // Calculate variance before and after smoothing
      const originalVariance = noisyData.reduce((sum, d, i, arr) => {
        const mean = arr.reduce((s, x) => s + x.value, 0) / arr.length;
        return sum + Math.pow(d.value - mean, 2);
      }, 0) / noisyData.length;
      
      const smoothedVariance = smoothed.reduce((sum, d, i, arr) => {
        const mean = arr.reduce((s, x) => s + x.value, 0) / arr.length;
        return sum + Math.pow(d.value - mean, 2);
      }, 0) / smoothed.length;
      
      expect(smoothedVariance).toBeLessThan(originalVariance);
    });
  });

  describe('removeOutliers', () => {
    it('identifies outliers using IQR method', () => {
      const result = removeOutliers(mockDataWithOutliers, 'iqr', 1.5);
      
      expect(result.outliers.length).toBeGreaterThan(0);
      expect(result.cleaned.length).toBeLessThan(mockDataWithOutliers.length);
      expect(result.cleaned.length + result.outliers.length).toBe(mockDataWithOutliers.length);
    });

    it('identifies outliers using z-score method', () => {
      const result = removeOutliers(mockDataWithOutliers, 'zscore', 2);
      
      expect(result.outliers.length).toBeGreaterThan(0);
      expect(result.cleaned.length).toBeLessThan(mockDataWithOutliers.length);
    });

    it('identifies outliers using modified z-score method', () => {
      const result = removeOutliers(mockDataWithOutliers, 'modified-zscore', 3.5);
      
      expect(result.outliers).toBeDefined();
      expect(result.cleaned).toBeDefined();
    });

    it('handles data without outliers', () => {
      const cleanData = [
        { value: 10 }, { value: 11 }, { value: 12 }, { value: 13 }, { value: 14 }
      ];
      
      const result = removeOutliers(cleanData, 'iqr');
      expect(result.outliers).toHaveLength(0);
      expect(result.cleaned).toHaveLength(cleanData.length);
    });

    it('respects threshold parameter', () => {
      const strictResult = removeOutliers(mockDataWithOutliers, 'iqr', 1.0);
      const lenientResult = removeOutliers(mockDataWithOutliers, 'iqr', 3.0);
      
      expect(strictResult.outliers.length).toBeGreaterThanOrEqual(lenientResult.outliers.length);
    });
  });

  describe('aggregateByTimeWindow', () => {
    it('aggregates data by time windows', () => {
      const windowSize = 2 * 60 * 1000; // 2 minutes
      const result = aggregateByTimeWindow(mockTimeSeriesData, windowSize, 'mean');
      
      expect(result.length).toBeLessThan(mockTimeSeriesData.length);
      
      result.forEach(point => {
        expect(point.time).toBeInstanceOf(Date);
        expect(typeof point.value).toBe('number');
        expect(point.metadata).toBeDefined();
        expect(point.metadata?.dataPoints).toBeGreaterThan(0);
      });
    });

    it('applies different aggregation methods', () => {
      const windowSize = 5 * 60 * 1000; // 5 minutes
      
      const meanResult = aggregateByTimeWindow(mockTimeSeriesData, windowSize, 'mean');
      const sumResult = aggregateByTimeWindow(mockTimeSeriesData, windowSize, 'sum');
      const minResult = aggregateByTimeWindow(mockTimeSeriesData, windowSize, 'min');
      const maxResult = aggregateByTimeWindow(mockTimeSeriesData, windowSize, 'max');
      const countResult = aggregateByTimeWindow(mockTimeSeriesData, windowSize, 'count');
      
      expect(meanResult.length).toBeGreaterThan(0);
      expect(sumResult.length).toBeGreaterThan(0);
      expect(minResult.length).toBeGreaterThan(0);
      expect(maxResult.length).toBeGreaterThan(0);
      expect(countResult.length).toBeGreaterThan(0);
      
      // Sum should be greater than or equal to mean
      if (meanResult.length > 0 && sumResult.length > 0) {
        expect(sumResult[0].value).toBeGreaterThanOrEqual(meanResult[0].value);
      }
    });

    it('handles empty data', () => {
      const result = aggregateByTimeWindow([], 60000);
      expect(result).toHaveLength(0);
    });

    it('preserves metadata', () => {
      const dataWithMetadata = mockTimeSeriesData.map(d => ({
        ...d,
        metadata: { source: 'sensor1' }
      }));
      
      const result = aggregateByTimeWindow(dataWithMetadata, 2 * 60 * 1000, 'mean');
      
      result.forEach(point => {
        expect(point.metadata).toBeDefined();
        expect(point.metadata?.windowStart).toBeInstanceOf(Date);
        expect(point.metadata?.windowEnd).toBeInstanceOf(Date);
      });
    });
  });

  describe('convertToHeatmapData', () => {
    it('converts data to heatmap format', () => {
      const inputData = [
        { x: 'A', y: 'X', value: 10 },
        { x: 'B', y: 'Y', value: 20 },
        { x: 'C', y: 'Z', value: 30 }
      ];
      
      const result = convertToHeatmapData(inputData);
      
      expect(result).toHaveLength(inputData.length);
      result.forEach((point, index) => {
        expect(point.x).toBe(inputData[index].x);
        expect(point.y).toBe(inputData[index].y);
        expect(point.value).toBe(inputData[index].value);
        expect(point.label).toBeDefined();
      });
    });

    it('generates default labels', () => {
      const inputData = [{ x: 'A', y: 'X', value: 10 }];
      const result = convertToHeatmapData(inputData);
      
      expect(result[0].label).toBe('A, X');
    });

    it('preserves custom labels', () => {
      const inputData = [{ x: 'A', y: 'X', value: 10, label: 'Custom Label' }];
      const result = convertToHeatmapData(inputData);
      
      expect(result[0].label).toBe('Custom Label');
    });
  });

  describe('pivotData', () => {
    const mockPivotData = [
      { row: 'Product A', column: 'Q1', value: 100 },
      { row: 'Product A', column: 'Q2', value: 150 },
      { row: 'Product B', column: 'Q1', value: 80 },
      { row: 'Product B', column: 'Q2', value: 120 },
      { row: 'Product A', column: 'Q1', value: 50 } // duplicate for aggregation
    ];

    it('pivots data correctly', () => {
      const result = pivotData(mockPivotData, 'sum');
      
      expect(result.length).toBeGreaterThan(0);
      result.forEach(point => {
        expect(point.x).toBeDefined();
        expect(point.y).toBeDefined();
        expect(typeof point.value).toBe('number');
      });
    });

    it('applies aggregation methods correctly', () => {
      const sumResult = pivotData(mockPivotData, 'sum');
      const meanResult = pivotData(mockPivotData, 'mean');
      const countResult = pivotData(mockPivotData, 'count');
      
      // Find Product A, Q1 values
      const sumValue = sumResult.find(d => d.x === 'Q1' && d.y === 'Product A')?.value;
      const meanValue = meanResult.find(d => d.x === 'Q1' && d.y === 'Product A')?.value;
      const countValue = countResult.find(d => d.x === 'Q1' && d.y === 'Product A')?.value;
      
      expect(sumValue).toBe(150); // 100 + 50
      expect(meanValue).toBe(75);  // (100 + 50) / 2
      expect(countValue).toBe(2);  // 2 records
    });
  });

  describe('interpolateMissingValues', () => {
    const sparseData: TimeSeriesDataPoint[] = [
      { time: new Date('2024-01-01T10:00:00Z'), value: 10 },
      { time: new Date('2024-01-01T10:05:00Z'), value: 20 }, // 5-minute gap
      { time: new Date('2024-01-01T10:06:00Z'), value: 15 }
    ];

    it('interpolates missing values with linear method', () => {
      const result = interpolateMissingValues(sparseData, 'linear');
      
      expect(result.length).toBeGreaterThan(sparseData.length);
      
      // Check interpolated points
      const interpolatedPoints = result.filter(d => d.metadata?.interpolated);
      expect(interpolatedPoints.length).toBeGreaterThan(0);
      
      interpolatedPoints.forEach(point => {
        expect(point.metadata?.method).toBe('linear');
        expect(point.metadata?.originalPoints).toHaveLength(2);
      });
    });

    it('interpolates with step method', () => {
      const result = interpolateMissingValues(sparseData, 'step');
      const interpolatedPoints = result.filter(d => d.metadata?.interpolated);
      
      if (interpolatedPoints.length > 0) {
        expect(interpolatedPoints[0].metadata?.method).toBe('step');
      }
    });

    it('interpolates with spline method', () => {
      const result = interpolateMissingValues(sparseData, 'spline');
      const interpolatedPoints = result.filter(d => d.metadata?.interpolated);
      
      if (interpolatedPoints.length > 0) {
        expect(interpolatedPoints[0].metadata?.method).toBe('spline');
      }
    });

    it('maintains temporal ordering', () => {
      const result = interpolateMissingValues(sparseData, 'linear');
      
      for (let i = 1; i < result.length; i++) {
        expect(result[i].time.getTime()).toBeGreaterThan(result[i - 1].time.getTime());
      }
    });

    it('handles small datasets', () => {
      const smallData = [{ time: new Date(), value: 10 }];
      const result = interpolateMissingValues(smallData, 'linear');
      expect(result).toEqual(smallData);
    });
  });

  describe('calculateCorrelationMatrix', () => {
    const mockCorrelationData = [
      { temp: 20, humidity: 60, pressure: 1013 },
      { temp: 25, humidity: 55, pressure: 1015 },
      { temp: 22, humidity: 65, pressure: 1010 },
      { temp: 18, humidity: 70, pressure: 1008 },
      { temp: 28, humidity: 50, pressure: 1020 }
    ];

    it('calculates correlation matrix correctly', () => {
      const variables = ['temp', 'humidity', 'pressure'];
      const result = calculateCorrelationMatrix(mockCorrelationData, variables);
      
      expect(result.length).toBe(variables.length * variables.length);
      
      // Self-correlations should be 1
      variables.forEach(variable => {
        const selfCorr = result.find(d => d.x === variable && d.y === variable);
        expect(selfCorr?.value).toBe(1);
      });
    });

    it('produces symmetric correlation matrix', () => {
      const variables = ['temp', 'humidity'];
      const result = calculateCorrelationMatrix(mockCorrelationData, variables);
      
      const corrAB = result.find(d => d.x === 'temp' && d.y === 'humidity')?.value;
      const corrBA = result.find(d => d.x === 'humidity' && d.y === 'temp')?.value;
      
      expect(corrAB).toBe(corrBA);
    });

    it('handles missing data', () => {
      const incompleteData = [
        { temp: 20, humidity: 60 },
        { temp: 25 }, // missing humidity
        { humidity: 55 } // missing temp
      ];
      
      const result = calculateCorrelationMatrix(incompleteData, ['temp', 'humidity']);
      expect(result.length).toBe(4);
    });

    it('produces correlation values in valid range', () => {
      const variables = ['temp', 'humidity', 'pressure'];
      const result = calculateCorrelationMatrix(mockCorrelationData, variables);
      
      result.forEach(point => {
        expect(point.value).toBeGreaterThanOrEqual(-1);
        expect(point.value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('createTransformationPipeline', () => {
    it('creates a pipeline with multiple steps', () => {
      const steps = [
        {
          name: 'double',
          transform: (data: { value: number }[]) => data.map(d => ({ ...d, value: d.value * 2 }))
        },
        {
          name: 'add10',
          transform: (data: { value: number }[]) => data.map(d => ({ ...d, value: d.value + 10 }))
        }
      ];
      
      const pipeline = createTransformationPipeline(steps);
      const testData = [{ value: 5 }];
      const result = pipeline.apply(testData);
      
      expect(result[0].value).toBe(20); // (5 * 2) + 10
    });

    it('handles transformation errors gracefully', () => {
      const steps = [
        {
          name: 'good',
          transform: (data: { value: number }[]) => data.map(d => ({ ...d, value: d.value * 2 }))
        },
        {
          name: 'bad',
          transform: () => { throw new Error('Transform error'); }
        },
        {
          name: 'good2',
          transform: (data: { value: number }[]) => data.map(d => ({ ...d, value: d.value + 1 }))
        }
      ];
      
      const pipeline = createTransformationPipeline(steps);
      const testData = [{ value: 5 }];
      
      // Should not crash and should continue with remaining steps
      expect(() => pipeline.apply(testData)).not.toThrow();
      const result = pipeline.apply(testData);
      expect(result[0].value).toBe(11); // 5 * 2 + 1 (bad step skipped)
    });

    it('allows adding and removing steps', () => {
      const pipeline = createTransformationPipeline([]);
      
      pipeline.addStep({
        name: 'multiply',
        transform: (data: { value: number }[]) => data.map(d => ({ ...d, value: d.value * 3 }))
      });
      
      expect(pipeline.steps).toHaveLength(1);
      
      pipeline.removeStep('multiply');
      expect(pipeline.steps).toHaveLength(0);
    });
  });

  describe('commonPipelines', () => {
    it('telemetrySmoothing pipeline works correctly', () => {
      const result = commonPipelines.telemetrySmoothing.apply(mockDataWithOutliers);
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(mockDataWithOutliers.length);
      
      // Should have fewer extreme values after outlier removal and smoothing
      const originalMax = Math.max(...mockDataWithOutliers.map(d => d.value));
      const processedMax = Math.max(...result.map(d => d.value));
      expect(processedMax).toBeLessThan(originalMax);
    });

    it('performanceOptimization pipeline reduces data size', () => {
      const result = commonPipelines.performanceOptimization.apply(mockLargeDataset);
      
      expect(result.length).toBeLessThan(mockLargeDataset.length);
      expect(result.length).toBeLessThanOrEqual(1000); // decimation limit
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles null and undefined values', () => {
      const badData = [
        { value: null as any },
        { value: undefined as any },
        { value: NaN },
        { value: 5 }
      ];
      
      expect(() => binData(badData, 3)).not.toThrow();
      expect(() => smoothData(badData, 3)).not.toThrow();
      expect(() => removeOutliers(badData)).not.toThrow();
    });

    it('handles extremely large numbers', () => {
      const largeNumberData = [
        { value: Number.MAX_SAFE_INTEGER },
        { value: -Number.MAX_SAFE_INTEGER },
        { value: 0 }
      ];
      
      expect(() => binData(largeNumberData, 3)).not.toThrow();
      expect(() => removeOutliers(largeNumberData)).not.toThrow();
    });

    it('handles single data point', () => {
      const singlePoint = [{ value: 42 }];
      
      const binResult = binData(singlePoint, 3);
      const smoothResult = smoothData(singlePoint, 3);
      const outlierResult = removeOutliers(singlePoint);
      
      expect(binResult.length).toBeGreaterThanOrEqual(0);
      expect(smoothResult).toEqual(singlePoint);
      expect(outlierResult.cleaned).toEqual(singlePoint);
      expect(outlierResult.outliers).toHaveLength(0);
    });

    it('handles identical values', () => {
      const identicalData = Array(10).fill({ value: 5 });
      
      expect(() => binData(identicalData, 3)).not.toThrow();
      expect(() => smoothData(identicalData, 3)).not.toThrow();
      expect(() => removeOutliers(identicalData)).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('handles large datasets efficiently', () => {
      const veryLargeDataset = Array.from({ length: 100000 }, (_, i) => ({ value: i }));
      
      const startTime = performance.now();
      
      binData(veryLargeDataset, 100);
      smoothData(veryLargeDataset, 10);
      removeOutliers(veryLargeDataset);
      
      const endTime = performance.now();
      
      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('transformation pipeline is efficient', () => {
      const largeTimeSeriesData = Array.from({ length: 10000 }, (_, i) => ({
        time: new Date(Date.now() + i * 1000),
        value: Math.random() * 100
      }));
      
      const startTime = performance.now();
      const result = commonPipelines.telemetrySmoothing.apply(largeTimeSeriesData);
      const endTime = performance.now();
      
      expect(result.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
    });
  });
});
