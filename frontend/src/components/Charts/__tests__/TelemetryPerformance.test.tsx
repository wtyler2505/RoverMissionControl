/**
 * Telemetry Chart Performance Benchmarking Tests
 * Comprehensive performance tests for high-frequency telemetry data visualization
 */

import React, { useState, useEffect, useRef } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { AreaChart } from '../charts/AreaChart';
import { GaugeChart } from '../charts/GaugeChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { TimeSeriesDataPoint, GaugeDataPoint } from '../types';
import { lightTheme } from '../../../theme/themes';
import { 
  decimateData, 
  smoothData, 
  aggregateByTimeWindow,
  createTransformationPipeline
} from '../utils/dataTransformers';

// Performance monitoring utilities
class PerformanceBenchmark {
  private measurements: Map<string, number[]> = new Map();
  private memoryBaseline: number = 0;
  private frameRateMonitor: FrameRateMonitor | null = null;
  
  startMeasurement(label: string): () => number {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    return () => {
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const duration = endTime - startTime;
      const memoryDelta = endMemory - startMemory;
      
      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      this.measurements.get(label)!.push(duration);
      
      return duration;
    };
  }
  
  getStatistics(label: string) {
    const measurements = this.measurements.get(label) || [];
    if (measurements.length === 0) return null;
    
    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
  
  startFrameRateMonitoring(): FrameRateMonitor {
    this.frameRateMonitor = new FrameRateMonitor();
    return this.frameRateMonitor;
  }
  
  stopFrameRateMonitoring(): FrameRateData | null {
    if (this.frameRateMonitor) {
      const data = this.frameRateMonitor.stop();
      this.frameRateMonitor = null;
      return data;
    }
    return null;
  }
  
  setMemoryBaseline() {
    this.memoryBaseline = (performance as any).memory?.usedJSHeapSize || 0;
  }
  
  getMemoryUsage() {
    const current = (performance as any).memory?.usedJSHeapSize || 0;
    return {
      current: current / 1024 / 1024, // MB
      baseline: this.memoryBaseline / 1024 / 1024, // MB
      delta: (current - this.memoryBaseline) / 1024 / 1024 // MB
    };
  }
  
  reset() {
    this.measurements.clear();
    this.memoryBaseline = 0;
    this.frameRateMonitor = null;
  }
}

interface FrameRateData {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  frameCount: number;
  droppedFrames: number;
}

class FrameRateMonitor {
  private frames: number[] = [];
  private lastTime: number = performance.now();
  private animationId: number | null = null;
  private isRunning: boolean = true;
  
  constructor() {
    this.tick();
  }
  
  private tick = () => {
    if (!this.isRunning) return;
    
    const now = performance.now();
    const delta = now - this.lastTime;
    const fps = 1000 / delta;
    
    this.frames.push(fps);
    this.lastTime = now;
    
    this.animationId = requestAnimationFrame(this.tick);
  };
  
  stop(): FrameRateData {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.frames.length === 0) {
      return {
        averageFPS: 0,
        minFPS: 0,
        maxFPS: 0,
        frameCount: 0,
        droppedFrames: 0
      };
    }
    
    const averageFPS = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    const minFPS = Math.min(...this.frames);
    const maxFPS = Math.max(...this.frames);
    const droppedFrames = this.frames.filter(fps => fps < 30).length;
    
    return {
      averageFPS,
      minFPS,
      maxFPS,
      frameCount: this.frames.length,
      droppedFrames
    };
  }
}

// High-performance data generators
const generateHighFrequencyData = (
  count: number, 
  frequency: number = 60, // Hz
  complexity: number = 1
): TimeSeriesDataPoint[] => {
  return Array.from({ length: count }, (_, i) => {
    const time = new Date(Date.now() - (count - i) * (1000 / frequency));
    const baseValue = Math.sin(i / (50 * complexity)) * 50 + 50;
    const noise = (Math.random() - 0.5) * 10 * complexity;
    const spike = i % (100 * complexity) === 0 ? Math.random() * 50 : 0;
    
    return {
      time,
      value: Math.max(0, baseValue + noise + spike),
      category: spike > 30 ? 'critical' : spike > 15 ? 'warning' : 'normal',
      metadata: {
        sensor: `sensor_${i % 10}`,
        quality: Math.random() > 0.1 ? 'good' : 'uncertain'
      }
    };
  });
};

const generateMassiveDataset = (pointCount: number): TimeSeriesDataPoint[] => {
  const data: TimeSeriesDataPoint[] = [];
  const startTime = Date.now() - pointCount * 1000;
  
  for (let i = 0; i < pointCount; i++) {
    data.push({
      time: new Date(startTime + i * 1000),
      value: Math.sin(i / 100) * 100 + 100 + (Math.random() - 0.5) * 20,
      category: i % 100 === 0 ? 'critical' : i % 50 === 0 ? 'warning' : 'normal'
    });
  }
  
  return data;
};

// Performance test components
const HighFrequencyChart: React.FC<{
  updateRate: number; // Hz
  dataPoints: number;
  onPerformanceUpdate?: (fps: number, renderTime: number) => void;
}> = ({ updateRate, dataPoints, onPerformanceUpdate }) => {
  const [data, setData] = useState<TimeSeriesDataPoint[]>(
    generateHighFrequencyData(dataPoints, updateRate)
  );
  const frameCountRef = useRef(0);
  const lastUpdateRef = useRef(performance.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      const startTime = performance.now();
      
      setData(prevData => {
        const newPoint: TimeSeriesDataPoint = {
          time: new Date(),
          value: Math.sin(Date.now() / 1000) * 50 + 50 + (Math.random() - 0.5) * 10,
          category: Math.random() > 0.9 ? 'critical' : 'normal'
        };
        
        const newData = [...prevData.slice(-(dataPoints - 1)), newPoint];
        
        // Calculate performance metrics
        const renderTime = performance.now() - startTime;
        const now = performance.now();
        const timeDelta = now - lastUpdateRef.current;
        const fps = timeDelta > 0 ? 1000 / timeDelta : 0;
        
        frameCountRef.current++;
        lastUpdateRef.current = now;
        
        onPerformanceUpdate?.(fps, renderTime);
        
        return newData;
      });
    }, 1000 / updateRate);
    
    return () => clearInterval(interval);
  }, [updateRate, dataPoints, onPerformanceUpdate]);
  
  return (
    <div data-testid="high-frequency-chart">
      <LineChart 
        data={data}
        performanceMode={true}
        renderMode="canvas"
        showPoints={false}
        animation={{ enabled: false }}
      />
      <div data-testid="frame-count">{frameCountRef.current}</div>
    </div>
  );
};

const MultiChannelDashboard: React.FC<{
  channelCount: number;
  pointsPerChannel: number;
  updateInterval: number;
}> = ({ channelCount, pointsPerChannel, updateInterval }) => {
  const [channels, setChannels] = useState(() =>
    Array.from({ length: channelCount }, (_, i) => ({
      id: `channel_${i}`,
      name: `Sensor ${i + 1}`,
      data: generateHighFrequencyData(pointsPerChannel, 10)
    }))
  );
  
  useEffect(() => {
    const interval = setInterval(() => {
      setChannels(prevChannels =>
        prevChannels.map(channel => ({
          ...channel,
          data: [
            ...channel.data.slice(-(pointsPerChannel - 1)),
            {
              time: new Date(),
              value: Math.random() * 100,
              category: 'normal' as const
            }
          ]
        }))
      );
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [pointsPerChannel, updateInterval]);
  
  return (
    <div data-testid="multi-channel-dashboard">
      <div data-testid="channel-count">{channelCount}</div>
      <div data-testid="charts-grid">
        {channels.map((channel, index) => (
          <div key={channel.id} data-testid={`channel-${index}`}>
            <LineChart 
              data={channel.data}
              title={channel.name}
              performanceMode={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <ChartThemeProvider theme={lightTheme}>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

describe('Telemetry Chart Performance Benchmarks', () => {
  const benchmark = new PerformanceBenchmark();
  
  beforeEach(() => {
    jest.clearAllMocks();
    benchmark.reset();
    benchmark.setMemoryBaseline();
  });

  describe('High-Frequency Data Stream Performance', () => {
    it('maintains 60+ FPS with 60Hz data updates', async () => {
      const performanceData: { fps: number; renderTime: number }[] = [];
      
      const handlePerformanceUpdate = (fps: number, renderTime: number) => {
        performanceData.push({ fps, renderTime });
      };
      
      render(
        <TestWrapper>
          <HighFrequencyChart 
            updateRate={60}
            dataPoints={100}
            onPerformanceUpdate={handlePerformanceUpdate}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('high-frequency-chart')).toBeInTheDocument();
      });
      
      // Let it run for 2 seconds to collect performance data
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const avgFPS = performanceData.reduce((sum, data) => sum + data.fps, 0) / performanceData.length;
      const avgRenderTime = performanceData.reduce((sum, data) => sum + data.renderTime, 0) / performanceData.length;
      
      expect(avgFPS).toBeGreaterThan(50); // Allow some tolerance
      expect(avgRenderTime).toBeLessThan(16.67); // Should render faster than 60 FPS frame time
      expect(performanceData.length).toBeGreaterThan(100); // Should have many updates
    });

    it('handles 120Hz updates for high-precision sensors', async () => {
      const performanceData: { fps: number; renderTime: number }[] = [];
      
      render(
        <TestWrapper>
          <HighFrequencyChart 
            updateRate={120}
            dataPoints={200}
            onPerformanceUpdate={(fps, renderTime) => {
              performanceData.push({ fps, renderTime });
            }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('high-frequency-chart')).toBeInTheDocument();
      });
      
      // Monitor for 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const avgFPS = performanceData.reduce((sum, data) => sum + data.fps, 0) / performanceData.length;
      const maxRenderTime = Math.max(...performanceData.map(data => data.renderTime));
      
      expect(avgFPS).toBeGreaterThan(30); // Should maintain reasonable FPS
      expect(maxRenderTime).toBeLessThan(33); // Should not block for more than 30 FPS
    });

    it('optimizes performance with canvas rendering for high-volume data', async () => {
      const largeDataset = generateMassiveDataset(50000);
      const optimizedData = decimateData(largeDataset, 2000, true);
      
      const endMeasurement = benchmark.startMeasurement('canvas-render-large');
      
      render(
        <TestWrapper>
          <LineChart 
            data={optimizedData}
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
      
      const renderTime = endMeasurement();
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
      
      const memoryUsage = benchmark.getMemoryUsage();
      expect(memoryUsage.delta).toBeLessThan(50); // Should not use more than 50MB additional memory
    });

    it('maintains frame rate consistency under load', async () => {
      const frameRateMonitor = benchmark.startFrameRateMonitoring();
      
      render(
        <TestWrapper>
          <HighFrequencyChart 
            updateRate={60}
            dataPoints={500}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('high-frequency-chart')).toBeInTheDocument();
      });
      
      // Run under load for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const frameData = benchmark.stopFrameRateMonitoring();
      
      expect(frameData!.averageFPS).toBeGreaterThan(45);
      expect(frameData!.minFPS).toBeGreaterThan(20);
      expect(frameData!.droppedFrames / frameData!.frameCount).toBeLessThan(0.1); // Less than 10% dropped frames
    });
  });

  describe('Large Dataset Processing Performance', () => {
    it('processes 100,000+ data points efficiently', async () => {
      const massiveDataset = generateMassiveDataset(100000);
      
      const endMeasurement = benchmark.startMeasurement('massive-dataset-processing');
      
      // Apply data transformation pipeline
      const pipeline = createTransformationPipeline([
        {
          name: 'decimation',
          transform: (data: TimeSeriesDataPoint[]) => decimateData(data, 5000, true)
        },
        {
          name: 'smoothing',
          transform: (data: TimeSeriesDataPoint[]) => smoothData(data, 10, 'exponential')
        },
        {
          name: 'aggregation',
          transform: (data: TimeSeriesDataPoint[]) => aggregateByTimeWindow(data, 60000, 'mean')
        }
      ]);
      
      const processedData = pipeline.apply(massiveDataset);
      const processingTime = endMeasurement();
      
      expect(processingTime).toBeLessThan(2000); // Should process within 2 seconds
      expect(processedData.length).toBeLessThan(massiveDataset.length);
      expect(processedData.length).toBeGreaterThan(0);
      
      // Render the processed data
      const renderStart = benchmark.startMeasurement('massive-dataset-render');
      
      render(
        <TestWrapper>
          <LineChart 
            data={processedData}
            performanceMode={true}
            renderMode="canvas"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const canvas = document.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
      });
      
      const renderTime = renderStart();
      expect(renderTime).toBeLessThan(1000);
    });

    it('optimizes memory usage with data streaming', async () => {
      const initialMemory = benchmark.getMemoryUsage();
      
      const TestComponent: React.FC = () => {
        const [iteration, setIteration] = useState(0);
        const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
        
        useEffect(() => {
          const interval = setInterval(() => {
            setIteration(prev => prev + 1);
            setData(prevData => {
              // Simulate continuous data stream with buffer management
              const newPoints = generateHighFrequencyData(50, 60);
              const combinedData = [...prevData, ...newPoints];
              return combinedData.slice(-1000); // Keep only last 1000 points
            });
          }, 100);
          
          return () => clearInterval(interval);
        }, []);
        
        return (
          <div data-testid={`iteration-${iteration}`}>
            <LineChart 
              data={data}
              performanceMode={true}
              renderMode="canvas"
            />
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      
      // Let it run for multiple iterations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const finalMemory = benchmark.getMemoryUsage();
      const memoryGrowth = finalMemory.delta;
      
      expect(memoryGrowth).toBeLessThan(100); // Should not grow more than 100MB
    });

    it('handles data aggregation for time-series analysis', async () => {
      const timeSeriesData = generateMassiveDataset(50000);
      
      const aggregationTests = [
        { window: 60000, method: 'mean' as const },
        { window: 300000, method: 'max' as const },
        { window: 900000, method: 'min' as const }
      ];
      
      for (const test of aggregationTests) {
        const endMeasurement = benchmark.startMeasurement(`aggregation-${test.window}-${test.method}`);
        
        const aggregated = aggregateByTimeWindow(timeSeriesData, test.window, test.method);
        
        const processingTime = endMeasurement();
        
        expect(processingTime).toBeLessThan(500);
        expect(aggregated.length).toBeLessThan(timeSeriesData.length);
        expect(aggregated.length).toBeGreaterThan(0);
      }
      
      const stats = benchmark.getStatistics('aggregation-60000-mean');
      expect(stats!.mean).toBeLessThan(500);
    });
  });

  describe('Multi-Channel Load Testing', () => {
    it('handles 50+ simultaneous telemetry channels', async () => {
      const channelCount = 50;
      const pointsPerChannel = 100;
      
      const endMeasurement = benchmark.startMeasurement('multi-channel-50');
      
      render(
        <TestWrapper>
          <MultiChannelDashboard 
            channelCount={channelCount}
            pointsPerChannel={pointsPerChannel}
            updateInterval={200}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('multi-channel-dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('channel-count')).toHaveTextContent('50');
      });
      
      const initialRenderTime = endMeasurement();
      expect(initialRenderTime).toBeLessThan(5000); // Should render within 5 seconds
      
      // Let it run with updates for a while
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const memoryUsage = benchmark.getMemoryUsage();
      expect(memoryUsage.delta).toBeLessThan(200); // Should not use excessive memory
    });

    it('scales to 100+ channels with virtualization', async () => {
      const channelCount = 100;
      
      const endMeasurement = benchmark.startMeasurement('multi-channel-100');
      
      render(
        <TestWrapper>
          <div data-testid="massive-dashboard">
            <MultiChannelDashboard 
              channelCount={channelCount}
              pointsPerChannel={50}
              updateInterval={500}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('massive-dashboard')).toBeInTheDocument();
      }, { timeout: 10000 });
      
      const renderTime = endMeasurement();
      expect(renderTime).toBeLessThan(10000); // Should handle even with high load
      
      const memoryUsage = benchmark.getMemoryUsage();
      expect(memoryUsage.delta).toBeLessThan(500); // Reasonable memory usage for 100 channels
    });

    it('maintains responsiveness during channel updates', async () => {
      const performanceMetrics: number[] = [];
      
      const TestComponent: React.FC = () => {
        const [updateCount, setUpdateCount] = useState(0);
        
        useEffect(() => {
          const interval = setInterval(() => {
            const updateStart = performance.now();
            
            setUpdateCount(prev => prev + 1);
            
            // Measure update time
            setTimeout(() => {
              const updateTime = performance.now() - updateStart;
              performanceMetrics.push(updateTime);
            }, 0);
          }, 100);
          
          return () => clearInterval(interval);
        }, []);
        
        return (
          <div data-testid={`update-${updateCount}`}>
            <MultiChannelDashboard 
              channelCount={20}
              pointsPerChannel={100}
              updateInterval={100}
            />
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('update-0')).toBeInTheDocument();
      });
      
      // Let it run for several updates
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const avgUpdateTime = performanceMetrics.reduce((a, b) => a + b, 0) / performanceMetrics.length;
      const maxUpdateTime = Math.max(...performanceMetrics);
      
      expect(avgUpdateTime).toBeLessThan(16.67); // Should update faster than 60 FPS
      expect(maxUpdateTime).toBeLessThan(50); // No single update should block for too long
      expect(performanceMetrics.length).toBeGreaterThan(15); // Should have many updates
    });
  });

  describe('Memory Leak Detection', () => {
    it('prevents memory leaks during continuous operation', async () => {
      const TestComponent: React.FC = () => {
        const [cycle, setCycle] = useState(0);
        
        useEffect(() => {
          const interval = setInterval(() => {
            setCycle(prev => prev + 1);
          }, 200);
          
          return () => clearInterval(interval);
        }, []);
        
        // Create and destroy charts repeatedly
        const data = generateHighFrequencyData(100, 60);
        
        return (
          <div data-testid={`cycle-${cycle}`}>
            {cycle % 2 === 0 ? (
              <LineChart 
                data={data}
                performanceMode={true}
                key={`chart-${cycle}`}
              />
            ) : (
              <div>No chart</div>
            )}
          </div>
        );
      };
      
      const initialMemory = benchmark.getMemoryUsage();
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      
      // Let it cycle through many create/destroy operations
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Force garbage collection if available
      if (typeof (global as any).gc === 'function') {
        (global as any).gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = benchmark.getMemoryUsage();
      const memoryGrowth = finalMemory.delta;
      
      expect(memoryGrowth).toBeLessThan(50); // Should not have significant memory growth
    });

    it('cleans up WebSocket connections properly', async () => {
      // Mock WebSocket for this test
      const createdConnections: any[] = [];
      const closedConnections: any[] = [];
      
      const MockWebSocket = class extends EventTarget {
        constructor(url: string) {
          super();
          createdConnections.push(this);
          setTimeout(() => this.dispatchEvent(new Event('open')), 0);
        }
        
        close() {
          closedConnections.push(this);
          setTimeout(() => this.dispatchEvent(new CloseEvent('close')), 0);
        }
        
        send() {}
      };
      
      (global as any).WebSocket = MockWebSocket;
      
      const TestComponent: React.FC = () => {
        const [connections, setConnections] = useState<any[]>([]);
        
        useEffect(() => {
          const interval = setInterval(() => {
            setConnections(prev => {
              // Create new connection
              const ws = new (global as any).WebSocket('ws://test');
              const newConns = [...prev, ws];
              
              // Close old connections
              if (newConns.length > 5) {
                const toClose = newConns.shift();
                toClose?.close();
              }
              
              return newConns;
            });
          }, 100);
          
          return () => {
            clearInterval(interval);
            // Clean up all connections
            setConnections(prev => {
              prev.forEach(ws => ws.close());
              return [];
            });
          };
        }, []);
        
        return <div data-testid="connection-test">{connections.length}</div>;
      };
      
      const { unmount } = render(<TestComponent />);
      
      // Let it create and clean up connections
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      unmount();
      
      // Allow cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(closedConnections.length).toBeGreaterThan(0);
      expect(closedConnections.length).toBe(createdConnections.length);
    });
  });

  describe('Stress Testing', () => {
    it('survives extreme data loads without crashing', async () => {
      const extremeDataset = generateMassiveDataset(500000);
      const chunks = [];
      
      // Split into manageable chunks
      for (let i = 0; i < extremeDataset.length; i += 10000) {
        chunks.push(extremeDataset.slice(i, i + 10000));
      }
      
      expect(() => {
        render(
          <TestWrapper>
            <div data-testid="stress-test">
              {chunks.slice(0, 5).map((chunk, index) => {
                const optimizedChunk = decimateData(chunk, 500, true);
                return (
                  <LineChart 
                    key={index}
                    data={optimizedChunk}
                    performanceMode={true}
                    renderMode="canvas"
                  />
                );
              })}
            </div>
          </TestWrapper>
        );
      }).not.toThrow();
      
      await waitFor(() => {
        expect(screen.getByTestId('stress-test')).toBeInTheDocument();
      });
    });

    it('handles rapid component mount/unmount cycles', async () => {
      const TestComponent: React.FC = () => {
        const [mounted, setMounted] = useState(true);
        const [cycle, setCycle] = useState(0);
        
        useEffect(() => {
          const interval = setInterval(() => {
            setMounted(prev => !prev);
            setCycle(prev => prev + 1);
          }, 50); // Very rapid cycling
          
          return () => clearInterval(interval);
        }, []);
        
        const data = generateHighFrequencyData(50, 60);
        
        return (
          <div data-testid={`mount-cycle-${cycle}`}>
            {mounted && (
              <LineChart 
                data={data}
                performanceMode={true}
                key={cycle}
              />
            )}
          </div>
        );
      };
      
      expect(() => {
        render(
          <TestWrapper>
            <TestComponent />
          </TestWrapper>
        );
      }).not.toThrow();
      
      // Let it cycle rapidly for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Should still be responsive
      await waitFor(() => {
        const cycleElement = screen.getByTestId((content, element) => 
          content.startsWith('mount-cycle-')
        );
        expect(cycleElement).toBeInTheDocument();
      });
    });

    it('maintains performance under simultaneous stress', async () => {
      const StressComponent: React.FC = () => {
        const [iteration, setIteration] = useState(0);
        
        useEffect(() => {
          const interval = setInterval(() => {
            setIteration(prev => prev + 1);
          }, 100);
          
          return () => clearInterval(interval);
        }, []);
        
        const stressData = generateHighFrequencyData(200, 100);
        
        return (
          <div data-testid={`stress-${iteration}`}>
            <MultiChannelDashboard 
              channelCount={25}
              pointsPerChannel={100}
              updateInterval={50}
            />
            <HighFrequencyChart 
              updateRate={60}
              dataPoints={300}
            />
            <LineChart 
              data={stressData}
              performanceMode={true}
              renderMode="canvas"
            />
          </div>
        );
      };
      
      const endMeasurement = benchmark.startMeasurement('simultaneous-stress');
      
      render(
        <TestWrapper>
          <StressComponent />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('stress-0')).toBeInTheDocument();
      });
      
      // Run under extreme stress for 3 seconds
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const stressTime = endMeasurement();
      expect(stressTime).toBeLessThan(10000); // Should survive without excessive delay
      
      const memoryUsage = benchmark.getMemoryUsage();
      expect(memoryUsage.delta).toBeLessThan(300); // Should not consume excessive memory
    });
  });

  describe('Performance Regression Detection', () => {
    it('maintains consistent rendering performance', async () => {
      const data = generateHighFrequencyData(1000, 60);
      const renderTimes: number[] = [];
      
      // Perform multiple render tests
      for (let i = 0; i < 10; i++) {
        const endMeasurement = benchmark.startMeasurement(`render-${i}`);
        
        const { unmount } = render(
          <TestWrapper>
            <LineChart 
              data={data}
              performanceMode={true}
              key={i}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
        
        const renderTime = endMeasurement();
        renderTimes.push(renderTime);
        
        unmount();
      }
      
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const maxRenderTime = Math.max(...renderTimes);
      const variance = renderTimes.reduce((sum, time) => sum + Math.pow(time - avgRenderTime, 2), 0) / renderTimes.length;
      const stdDev = Math.sqrt(variance);
      
      expect(avgRenderTime).toBeLessThan(500);
      expect(maxRenderTime).toBeLessThan(1000);
      expect(stdDev / avgRenderTime).toBeLessThan(0.5); // Coefficient of variation should be low
    });

    it('detects performance degradation patterns', async () => {
      const baselineData = generateHighFrequencyData(500, 60);
      const complexData = generateHighFrequencyData(500, 60, 5); // 5x complexity
      
      // Baseline performance
      const baselineEnd = benchmark.startMeasurement('baseline');
      render(
        <TestWrapper>
          <LineChart data={baselineData} performanceMode={true} />
        </TestWrapper>
      );
      await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument());
      const baselineTime = baselineEnd();
      
      screen.debug();
      
      // Complex data performance
      const complexEnd = benchmark.startMeasurement('complex');
      render(
        <TestWrapper>
          <LineChart data={complexData} performanceMode={true} />
        </TestWrapper>
      );
      await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
      const complexTime = complexEnd();
      
      // Performance should scale reasonably with complexity
      const performanceRatio = complexTime / baselineTime;
      expect(performanceRatio).toBeLessThan(10); // Should not be more than 10x slower
    });
  });
});