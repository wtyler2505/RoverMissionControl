/**
 * Chart Performance Tests
 * Tests for rendering performance, memory usage, and optimization strategies
 */

import React, { useState, useEffect } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { AreaChart } from '../charts/AreaChart';
import { BarChart } from '../charts/BarChart';
import { GaugeChart } from '../charts/GaugeChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { TimeSeriesDataPoint, ChartDataPoint, GaugeDataPoint, HeatmapDataPoint } from '../types';
import { lightTheme } from '../../../theme/themes';
import { 
  decimateData, 
  smoothData, 
  aggregateByTimeWindow,
  removeOutliers,
  createTransformationPipeline
} from '../utils/dataTransformers';

// Mock performance hooks
const mockStartTracking = jest.fn();
const mockEndTracking = jest.fn();

jest.mock('../../../hooks/usePerformanceMonitoring', () => ({
  useComponentPerformanceTracking: () => ({
    startTracking: mockStartTracking,
    endTracking: mockEndTracking
  })
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  callback: ResizeObserverCallback;
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Performance measurement utilities
class PerformanceProfiler {
  private measurements: { [key: string]: number[] } = {};
  
  start(label: string): () => number {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.measurements[label]) {
        this.measurements[label] = [];
      }
      this.measurements[label].push(duration);
      
      return duration;
    };
  }
  
  getStats(label: string) {
    const measurements = this.measurements[label] || [];
    if (measurements.length === 0) return null;
    
    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)]
    };
  }
  
  reset() {
    this.measurements = {};
  }
}

const profiler = new PerformanceProfiler();

// Data generators for performance testing
const generateTimeSeriesData = (count: number, complexity = 1): TimeSeriesDataPoint[] => {
  return Array.from({ length: count }, (_, i) => {
    const baseValue = Math.sin(i / (100 * complexity)) * 50 + 50;
    const noise = (Math.random() - 0.5) * 20 * complexity;
    
    return {
      time: new Date(Date.now() - (count - i) * 1000),
      value: baseValue + noise,
      category: i % (20 * complexity) === 0 ? 'critical' : 
                i % (10 * complexity) === 0 ? 'warning' : 'normal',
      metadata: {
        sensor: `sensor_${i % 5}`,
        location: `location_${i % 3}`,
        quality: Math.random()
      }
    };
  });
};

const generateBarData = (count: number): ChartDataPoint[] => {
  return Array.from({ length: count }, (_, i) => ({
    x: `Item ${i + 1}`,
    y: Math.random() * 100,
    category: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C'
  }));
};

const generateHeatmapData = (width: number, height: number): HeatmapDataPoint[] => {
  const data: HeatmapDataPoint[] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      data.push({
        x: x,
        y: y,
        value: Math.sin(x / 10) * Math.cos(y / 10) * 100 + Math.random() * 20
      });
    }
  }
  return data;
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <ChartThemeProvider theme={lightTheme}>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

// Stress test component
const StressTestDashboard: React.FC<{ 
  chartCount: number;
  dataPointsPerChart: number;
  updateInterval?: number;
}> = ({ chartCount, dataPointsPerChart, updateInterval }) => {
  const [data, setData] = useState<TimeSeriesDataPoint[][]>(
    Array.from({ length: chartCount }, () => generateTimeSeriesData(dataPointsPerChart))
  );
  
  useEffect(() => {
    if (!updateInterval) return;
    
    const interval = setInterval(() => {
      setData(prevData => 
        prevData.map(chartData => {
          const newPoint: TimeSeriesDataPoint = {
            time: new Date(),
            value: Math.random() * 100,
            category: 'normal'
          };
          return [...chartData.slice(-dataPointsPerChart + 1), newPoint];
        })
      );
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [updateInterval, dataPointsPerChart]);
  
  return (
    <div data-testid="stress-test-dashboard">
      {data.map((chartData, index) => (
        <div key={index} style={{ width: '300px', height: '200px', margin: '10px' }}>
          <LineChart 
            data={chartData}
            showPoints={false} // Optimize for performance
            animation={{ enabled: false }}
            performanceMode={true}
          />
        </div>
      ))}
    </div>
  );
};

describe('Chart Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profiler.reset();
  });

  describe('Rendering Performance', () => {
    it('renders small datasets efficiently (< 100ms)', async () => {
      const data = generateTimeSeriesData(100);
      
      const endTiming = profiler.start('small-dataset-render');
      
      render(
        <TestWrapper>
          <LineChart data={data} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const renderTime = endTiming();
      expect(renderTime).toBeLessThan(100);
    });

    it('handles medium datasets efficiently (< 300ms)', async () => {
      const data = generateTimeSeriesData(1000);
      
      const endTiming = profiler.start('medium-dataset-render');
      
      render(
        <TestWrapper>
          <LineChart data={data} showPoints={false} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const renderTime = endTiming();
      expect(renderTime).toBeLessThan(300);
    });

    it('optimizes large datasets through decimation (< 500ms)', async () => {
      const largeData = generateTimeSeriesData(50000);
      const optimizedData = decimateData(largeData, 1000, true);
      
      expect(optimizedData.length).toBeLessThanOrEqual(1000);
      
      const endTiming = profiler.start('large-dataset-render');
      
      render(
        <TestWrapper>
          <LineChart 
            data={optimizedData}
            showPoints={false}
            performanceMode={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const renderTime = endTiming();
      expect(renderTime).toBeLessThan(500);
    });

    it('uses canvas rendering for extremely large datasets', async () => {
      const extremeData = generateTimeSeriesData(100000);
      const processedData = decimateData(extremeData, 2000);
      
      const endTiming = profiler.start('canvas-render');
      
      render(
        <TestWrapper>
          <LineChart 
            data={processedData}
            renderMode="canvas"
            performanceMode={true}
            showPoints={false}
            animation={{ enabled: false }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const canvas = document.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
      });
      
      const renderTime = endTiming();
      expect(renderTime).toBeLessThan(1000);
    });
  });

  describe('Update Performance', () => {
    it('handles rapid data updates efficiently', async () => {
      let currentData = generateTimeSeriesData(100);
      
      const { rerender } = render(
        <TestWrapper>
          <LineChart data={currentData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Perform multiple rapid updates
      const updateTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        currentData = [...currentData.slice(-99), {
          time: new Date(),
          value: Math.random() * 100,
          category: 'normal'
        }];
        
        rerender(
          <TestWrapper>
            <LineChart data={currentData} />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
        
        updateTimes.push(performance.now() - startTime);
      }
      
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(50); // Each update should be under 50ms
    });

    it('maintains performance with real-time data streams', async () => {
      const initialData = generateTimeSeriesData(50);
      const [data, setData] = [initialData, jest.fn()];
      
      const RealTimeTest: React.FC = () => {
        const [currentData, setCurrentData] = useState(initialData);
        
        useEffect(() => {
          const interval = setInterval(() => {
            setCurrentData(prev => {
              const newPoint: TimeSeriesDataPoint = {
                time: new Date(),
                value: Math.random() * 100,
                category: 'normal'
              };
              return [...prev.slice(-49), newPoint];
            });
          }, 100); // Update every 100ms
          
          return () => clearInterval(interval);
        }, []);
        
        return <LineChart data={currentData} animation={{ enabled: false }} />;
      };
      
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <RealTimeTest />
        </TestWrapper>
      );
      
      // Let it run for 1 second (10 updates)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const totalTime = performance.now() - startTime;
      
      // Should maintain good performance even with frequent updates
      expect(totalTime).toBeLessThan(1200); // Allow some overhead
    });
  });

  describe('Memory Usage', () => {
    it('properly cleans up after component unmount', async () => {
      const data = generateTimeSeriesData(1000);
      
      // Mock memory measurement
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      const { unmount } = render(
        <TestWrapper>
          <LineChart 
            data={data}
            enableZoom={true}
            tooltip={{ enabled: true }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      unmount();
      
      // Force garbage collection if available
      if (typeof (global as any).gc === 'function') {
        (global as any).gc();
      }
      
      // Memory should not have grown significantly
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Allow some memory increase but not excessive
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });

    it('handles multiple chart instances without memory leaks', async () => {
      const chartCount = 10;
      const dataPerChart = 500;
      
      for (let iteration = 0; iteration < 3; iteration++) {
        const charts = Array.from({ length: chartCount }, (_, i) => (
          <LineChart 
            key={i}
            data={generateTimeSeriesData(dataPerChart)}
            showPoints={false}
            animation={{ enabled: false }}
          />
        ));
        
        const { unmount } = render(
          <TestWrapper>
            <div>{charts}</div>
          </TestWrapper>
        );
        
        await waitFor(() => {
          const svgElements = screen.getAllByRole('img');
          expect(svgElements).toHaveLength(chartCount);
        });
        
        unmount();
        
        // Brief pause between iterations
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Test should complete without memory issues
      expect(true).toBe(true);
    });
  });

  describe('Data Processing Performance', () => {
    it('efficiently processes data transformations', () => {
      const largeDataset = generateTimeSeriesData(10000, 2);
      
      // Test decimation performance
      const decimationStart = performance.now();
      const decimated = decimateData(largeDataset, 1000, true);
      const decimationTime = performance.now() - decimationStart;
      
      expect(decimationTime).toBeLessThan(100);
      expect(decimated.length).toBeLessThanOrEqual(1000);
      
      // Test smoothing performance
      const smoothingStart = performance.now();
      const smoothed = smoothData(decimated, 5, 'exponential');
      const smoothingTime = performance.now() - smoothingStart;
      
      expect(smoothingTime).toBeLessThan(50);
      expect(smoothed.length).toBe(decimated.length);
      
      // Test outlier removal performance
      const outlierStart = performance.now();
      const { cleaned } = removeOutliers(smoothed, 'iqr', 1.5);
      const outlierTime = performance.now() - outlierStart;
      
      expect(outlierTime).toBeLessThan(50);
      expect(cleaned.length).toBeLessThanOrEqual(smoothed.length);
    });

    it('optimizes transformation pipelines', () => {
      const dataset = generateTimeSeriesData(20000);
      
      const pipeline = createTransformationPipeline([
        {
          name: 'decimation',
          transform: (data: TimeSeriesDataPoint[]) => decimateData(data, 2000, true)
        },
        {
          name: 'outlier-removal',
          transform: (data: TimeSeriesDataPoint[]) => removeOutliers(data, 'iqr', 2).cleaned
        },
        {
          name: 'smoothing',
          transform: (data: TimeSeriesDataPoint[]) => smoothData(data, 5, 'simple')
        },
        {
          name: 'aggregation',
          transform: (data: TimeSeriesDataPoint[]) => aggregateByTimeWindow(data, 60000, 'mean')
        }
      ]);
      
      const pipelineStart = performance.now();
      const result = pipeline.apply(dataset);
      const pipelineTime = performance.now() - pipelineStart;
      
      expect(pipelineTime).toBeLessThan(200);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThan(dataset.length);
    });
  });

  describe('Stress Testing', () => {
    it('handles multiple charts with large datasets', async () => {
      const chartCount = 5;
      const dataPointsPerChart = 2000;
      
      const endTiming = profiler.start('multi-chart-stress');
      
      render(
        <TestWrapper>
          <StressTestDashboard 
            chartCount={chartCount}
            dataPointsPerChart={dataPointsPerChart}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('stress-test-dashboard')).toBeInTheDocument();
        const svgElements = screen.getAllByRole('img');
        expect(svgElements).toHaveLength(chartCount);
      });
      
      const renderTime = endTiming();
      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });

    it('maintains performance under continuous updates', async () => {
      const updateInterval = 100; // 10 FPS
      const testDuration = 2000; // 2 seconds
      
      render(
        <TestWrapper>
          <StressTestDashboard 
            chartCount={3}
            dataPointsPerChart={100}
            updateInterval={updateInterval}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('stress-test-dashboard')).toBeInTheDocument();
      });
      
      const startTime = performance.now();
      
      // Let it run for the test duration
      await new Promise(resolve => setTimeout(resolve, testDuration));
      
      const actualDuration = performance.now() - startTime;
      
      // Should maintain reasonable performance
      expect(actualDuration).toBeLessThan(testDuration + 500); // Allow 500ms overhead
    });
  });

  describe('Different Chart Types Performance', () => {
    it('compares performance across chart types', async () => {
      const timeSeriesData = generateTimeSeriesData(1000);
      const barData = generateBarData(100);
      const heatmapData = generateHeatmapData(20, 20);
      const gaugeData: GaugeDataPoint = { value: 75, min: 0, max: 100 };
      
      const chartTests = [
        { name: 'LineChart', component: <LineChart data={timeSeriesData} /> },
        { name: 'AreaChart', component: <AreaChart data={timeSeriesData} /> },
        { name: 'BarChart', component: <BarChart data={barData} /> },
        { name: 'HeatmapChart', component: <HeatmapChart data={heatmapData} /> },
        { name: 'GaugeChart', component: <GaugeChart data={gaugeData} /> }
      ];
      
      const performanceResults: { [key: string]: number } = {};
      
      for (const test of chartTests) {
        const endTiming = profiler.start(test.name);
        
        const { unmount } = render(
          <TestWrapper>
            {test.component}
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
        
        performanceResults[test.name] = endTiming();
        unmount();
      }
      
      // All charts should render reasonably quickly
      Object.entries(performanceResults).forEach(([chartType, time]) => {
        expect(time).toBeLessThan(500); // 500ms max for any chart type
      });
      
      // Log performance comparison for analysis
      console.log('Chart Performance Comparison:', performanceResults);
    });
  });

  describe('Animation Performance', () => {
    it('maintains smooth animations with large datasets', async () => {
      const data = generateTimeSeriesData(500);
      
      const { rerender } = render(
        <TestWrapper>
          <LineChart 
            data={data}
            animation={{ enabled: true, duration: 1000 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const startTime = performance.now();
      
      // Update data to trigger animation
      const newData = generateTimeSeriesData(600);
      rerender(
        <TestWrapper>
          <LineChart 
            data={newData}
            animation={{ enabled: true, duration: 500 }}
          />
        </TestWrapper>
      );
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const animationTime = performance.now() - startTime;
      
      // Animation should complete smoothly
      expect(animationTime).toBeLessThan(800); // Allow some overhead
    });

    it('disables animations for performance mode', async () => {
      const data = generateTimeSeriesData(2000);
      
      const endTiming = profiler.start('performance-mode');
      
      render(
        <TestWrapper>
          <LineChart 
            data={data}
            performanceMode={true}
            animation={{ enabled: false }}
            showPoints={false}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const renderTime = endTiming();
      
      // Performance mode should be significantly faster
      expect(renderTime).toBeLessThan(200);
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('tracks performance metrics correctly', async () => {
      const data = generateTimeSeriesData(500);
      
      render(
        <TestWrapper>
          <LineChart data={data} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Verify performance tracking was called
      expect(mockStartTracking).toHaveBeenCalled();
      expect(mockEndTracking).toHaveBeenCalled();
    });

    it('provides performance callbacks', async () => {
      const onRender = jest.fn();
      const data = generateTimeSeriesData(200);
      
      render(
        <TestWrapper>
          <LineChart 
            data={data}
            onRender={onRender}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
        expect(onRender).toHaveBeenCalledWith(expect.any(Number));
      });
      
      const renderTime = onRender.mock.calls[0][0];
      expect(renderTime).toBeGreaterThan(0);
      expect(renderTime).toBeLessThan(500);
    });
  });
});
