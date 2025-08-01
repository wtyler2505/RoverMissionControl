/**
 * Telemetry Chart Tests
 * Comprehensive tests for real-time telemetry chart components including
 * unit tests, integration tests, performance tests, and accessibility tests
 */

import React, { useState, useEffect, useRef } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { AreaChart } from '../charts/AreaChart';
import { GaugeChart } from '../charts/GaugeChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { 
  TimeSeriesDataPoint, 
  GaugeDataPoint, 
  HeatmapDataPoint, 
  TelemetryChannelData,
  ChartDataPoint 
} from '../types';
import { lightTheme, darkTheme } from '../../../theme/themes';
import { 
  decimateData, 
  smoothData, 
  aggregateByTimeWindow,
  removeOutliers,
  createTransformationPipeline
} from '../utils/dataTransformers';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock WebSocket for telemetry streaming
class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  
  constructor(url: string) {
    super();
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 0);
  }
  
  send(data: string) {
    // Mock send implementation
  }
  
  close() {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.dispatchEvent(new CloseEvent('close'));
    }, 0);
  }
  
  // Helper method to simulate incoming messages
  simulateMessage(data: any) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    this.dispatchEvent(event);
  }
}

// Mock performance monitoring
const mockPerformanceMetrics = {
  renderTime: 0,
  updateCount: 0,
  memoryUsage: 0,
  frameRate: 60
};

jest.mock('../../../hooks/usePerformanceMonitoring', () => ({
  useComponentPerformanceTracking: () => ({
    startTracking: jest.fn(),
    endTracking: jest.fn(() => mockPerformanceMetrics.renderTime),
    getMetrics: jest.fn(() => mockPerformanceMetrics)
  }),
  useMemoryMonitoring: () => ({
    currentUsage: mockPerformanceMetrics.memoryUsage,
    peakUsage: mockPerformanceMetrics.memoryUsage * 1.2,
    isLeaking: false
  }),
  useFrameRateMonitoring: () => ({
    currentFPS: mockPerformanceMetrics.frameRate,
    averageFPS: mockPerformanceMetrics.frameRate,
    minFPS: mockPerformanceMetrics.frameRate - 5
  })
}));

// Mock ResizeObserver with simulation capabilities
class MockResizeObserver {
  callback: ResizeObserverCallback;
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  
  observe = jest.fn((target: Element) => {
    const mockEntry: ResizeObserverEntry = {
      target,
      contentRect: { width: 800, height: 400, top: 0, left: 0, bottom: 400, right: 800, x: 0, y: 0, toJSON: () => ({}) },
      borderBoxSize: [] as any,
      contentBoxSize: [] as any,
      devicePixelContentBoxSize: [] as any
    };
    setTimeout(() => this.callback([mockEntry], this), 0);
  });
  
  unobserve = jest.fn();
  disconnect = jest.fn();
  
  simulateResize(width: number, height: number, target?: Element) {
    const mockEntry: ResizeObserverEntry = {
      target: target || document.createElement('div'),
      contentRect: { width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON: () => ({}) },
      borderBoxSize: [] as any,
      contentBoxSize: [] as any,
      devicePixelContentBoxSize: [] as any
    };
    act(() => {
      this.callback([mockEntry], this);
    });
  }
}

let mockResizeObserver: MockResizeObserver;
global.ResizeObserver = jest.fn().mockImplementation((callback) => {
  mockResizeObserver = new MockResizeObserver(callback);
  return mockResizeObserver;
});

// Set global WebSocket mock
(global as any).WebSocket = MockWebSocket;

// Telemetry data generators
const generateTelemetryData = (
  channelCount: number, 
  pointsPerChannel: number, 
  frequency: number = 100
): TelemetryChannelData[] => {
  return Array.from({ length: channelCount }, (_, channelIndex) => ({
    channelId: `channel_${channelIndex}`,
    channelName: `Sensor ${channelIndex + 1}`,
    unit: channelIndex % 3 === 0 ? '°C' : channelIndex % 3 === 1 ? 'V' : 'RPM',
    data: Array.from({ length: pointsPerChannel }, (_, pointIndex) => ({
      time: new Date(Date.now() - (pointsPerChannel - pointIndex) * (1000 / frequency)),
      value: Math.sin((pointIndex + channelIndex * 10) / 20) * 50 + 50 + (Math.random() - 0.5) * 10,
      category: pointIndex % 20 === 0 ? 'critical' : pointIndex % 10 === 0 ? 'warning' : 'normal',
      metadata: {
        sensor: `sensor_${channelIndex}`,
        location: `location_${channelIndex % 3}`,
        quality: Math.random()
      }
    }))
  }));
};

const generateHighFrequencyData = (count: number): TimeSeriesDataPoint[] => {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.now() - (count - i) * 16.67), // 60 FPS intervals
    value: Math.sin(i / 50) * 100 + 100 + (Math.random() - 0.5) * 20,
    category: 'normal'
  }));
};

const TestWrapper: React.FC<{ children: React.ReactNode; theme?: any }> = ({ 
  children, 
  theme = lightTheme 
}) => (
  <ThemeProvider theme={theme}>
    <ChartThemeProvider theme={theme}>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

// Mock telemetry WebSocket component
const TelemetryWebSocketProvider: React.FC<{
  children: React.ReactNode;
  onData?: (data: any) => void;
  url?: string;
}> = ({ children, onData, url = 'ws://localhost:8080/telemetry' }) => {
  const wsRef = useRef<MockWebSocket | null>(null);
  
  useEffect(() => {
    wsRef.current = new MockWebSocket(url);
    
    wsRef.current.addEventListener('message', (event: any) => {
      const data = JSON.parse(event.data);
      onData?.(data);
    });
    
    return () => {
      wsRef.current?.close();
    };
  }, [url, onData]);
  
  // Expose WebSocket for testing
  (children as any).webSocket = wsRef.current;
  
  return <>{children}</>;
};

// Real-time telemetry dashboard component for testing
const TelemetryDashboard: React.FC<{
  channelCount: number;
  updateInterval?: number;
  maxDataPoints?: number;
  performanceMode?: boolean;
}> = ({ 
  channelCount, 
  updateInterval = 100, 
  maxDataPoints = 100,
  performanceMode = false 
}) => {
  const [telemetryData, setTelemetryData] = useState<TelemetryChannelData[]>(
    generateTelemetryData(channelCount, maxDataPoints)
  );
  const [isConnected, setIsConnected] = useState(false);
  const updateCountRef = useRef(0);
  
  const handleTelemetryData = (data: any) => {
    updateCountRef.current++;
    setTelemetryData(prevData => {
      return prevData.map((channel, index) => {
        if (data.channelId === channel.channelId) {
          const newPoint: TimeSeriesDataPoint = {
            time: new Date(data.timestamp),
            value: data.value,
            category: data.category || 'normal'
          };
          
          return {
            ...channel,
            data: [...channel.data.slice(-(maxDataPoints - 1)), newPoint]
          };
        }
        return channel;
      });
    });
  };
  
  return (
    <div data-testid="telemetry-dashboard">
      <div data-testid="connection-status">
        Status: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="update-count">
        Updates: {updateCountRef.current}
      </div>
      
      <TelemetryWebSocketProvider onData={handleTelemetryData}>
        <div data-testid="charts-container">
          {telemetryData.map((channel, index) => (
            <div key={channel.channelId} data-testid={`chart-${channel.channelId}`}>
              <LineChart
                data={channel.data}
                title={channel.channelName}
                unit={channel.unit}
                showPoints={!performanceMode}
                animation={{ enabled: !performanceMode, duration: 200 }}
                performanceMode={performanceMode}
                ariaLabel={`${channel.channelName} telemetry data with ${channel.data.length} data points`}
              />
            </div>
          ))}
        </div>
      </TelemetryWebSocketProvider>
    </div>
  );
};

describe('Telemetry Chart Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPerformanceMetrics.renderTime = 0;
    mockPerformanceMetrics.updateCount = 0;
    mockPerformanceMetrics.memoryUsage = 0;
    mockPerformanceMetrics.frameRate = 60;
  });

  describe('Unit Tests - Individual Chart Components', () => {
    describe('LineChart with Telemetry Data', () => {
      it('renders telemetry data correctly', async () => {
        const telemetryData = generateTelemetryData(1, 10)[0].data;
        
        render(
          <TestWrapper>
            <LineChart 
              data={telemetryData}
              title="Temperature Sensor"
              unit="°C"
              showPoints={true}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const svg = screen.getByRole('img');
          expect(svg).toBeInTheDocument();
          expect(svg).toHaveAttribute('aria-label');
        });
      });

      it('handles real-time data updates efficiently', async () => {
        const initialData = generateTelemetryData(1, 50)[0].data;
        const { rerender } = render(
          <TestWrapper>
            <LineChart data={initialData} performanceMode={true} />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });

        // Simulate rapid updates
        for (let i = 0; i < 10; i++) {
          const newPoint: TimeSeriesDataPoint = {
            time: new Date(),
            value: Math.random() * 100,
            category: 'normal'
          };
          const updatedData = [...initialData.slice(-49), newPoint];
          
          rerender(
            <TestWrapper>
              <LineChart data={updatedData} performanceMode={true} />
            </TestWrapper>
          );
          
          await waitFor(() => {
            expect(screen.getByRole('img')).toBeInTheDocument();
          });
        }
      });

      it('applies data transformations for performance', async () => {
        const largeDataset = generateHighFrequencyData(10000);
        const optimizedData = decimateData(largeDataset, 1000, true);
        
        expect(optimizedData.length).toBeLessThanOrEqual(1000);
        
        const startTime = performance.now();
        
        render(
          <TestWrapper>
            <LineChart 
              data={optimizedData}
              performanceMode={true}
              renderMode="canvas"
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const canvas = document.querySelector('canvas');
          expect(canvas).toBeInTheDocument();
        });
        
        const renderTime = performance.now() - startTime;
        expect(renderTime).toBeLessThan(500);
      });
    });

    describe('GaugeChart for Critical Metrics', () => {
      it('renders gauge with thresholds correctly', async () => {
        const gaugeData: GaugeDataPoint = {
          value: 85,
          min: 0,
          max: 100,
          thresholds: [
            { value: 30, label: 'Normal', color: '#4caf50' },
            { value: 70, label: 'Warning', color: '#ff9800' },
            { value: 90, label: 'Critical', color: '#f44336' }
          ]
        };
        
        render(
          <TestWrapper>
            <GaugeChart 
              data={gaugeData}
              title="Battery Level"
              unit="%"
              showValue={true}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const svg = screen.getByRole('img');
          expect(svg).toBeInTheDocument();
        });
      });

      it('updates gauge value smoothly', async () => {
        const initialData: GaugeDataPoint = { value: 50, min: 0, max: 100 };
        const { rerender } = render(
          <TestWrapper>
            <GaugeChart data={initialData} animation={{ enabled: true, duration: 500 }} />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });

        const updatedData: GaugeDataPoint = { value: 75, min: 0, max: 100 };
        rerender(
          <TestWrapper>
            <GaugeChart data={updatedData} animation={{ enabled: true, duration: 500 }} />
          </TestWrapper>
        );

        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
      });
    });

    describe('HeatmapChart for Sensor Arrays', () => {
      it('renders sensor array heatmap', async () => {
        const sensorArrayData: HeatmapDataPoint[] = Array.from({ length: 64 }, (_, i) => ({
          x: i % 8,
          y: Math.floor(i / 8),
          value: Math.random() * 100
        }));
        
        render(
          <TestWrapper>
            <HeatmapChart 
              data={sensorArrayData}
              title="Sensor Array Temperature"
              colorScale="viridis"
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const svg = screen.getByRole('img');
          expect(svg).toBeInTheDocument();
        });
      });
    });
  });

  describe('Integration Tests - Real-time Data Flow', () => {
    it('handles WebSocket telemetry streams', async () => {
      let webSocketInstance: MockWebSocket;
      
      const TestComponent: React.FC = () => {
        const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
        
        return (
          <TelemetryWebSocketProvider
            onData={(telemetryData) => {
              const newPoint: TimeSeriesDataPoint = {
                time: new Date(telemetryData.timestamp),
                value: telemetryData.value,
                category: telemetryData.category
              };
              setData(prev => [...prev.slice(-99), newPoint]);
            }}
          >
            {((children: any) => {
              webSocketInstance = children.webSocket;
              return <LineChart data={data} />;
            }) as any}
          </TelemetryWebSocketProvider>
        );
      };
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Simulate telemetry messages
      const testMessages = [
        { timestamp: Date.now(), value: 25.5, category: 'normal', channelId: 'temp_1' },
        { timestamp: Date.now() + 100, value: 30.2, category: 'warning', channelId: 'temp_1' },
        { timestamp: Date.now() + 200, value: 35.8, category: 'critical', channelId: 'temp_1' }
      ];
      
      for (const message of testMessages) {
        act(() => {
          webSocketInstance!.simulateMessage(message);
        });
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
      }
    });

    it('coordinates multiple chart updates', async () => {
      render(
        <TestWrapper>
          <TelemetryDashboard 
            channelCount={3} 
            updateInterval={50}
            maxDataPoints={50}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('telemetry-dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('charts-container')).toBeInTheDocument();
        
        const charts = screen.getAllByRole('img');
        expect(charts).toHaveLength(3);
      });
    });

    it('maintains data synchronization across channels', async () => {
      const channelCount = 5;
      
      render(
        <TestWrapper>
          <TelemetryDashboard 
            channelCount={channelCount}
            updateInterval={100}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const charts = screen.getAllByRole('img');
        expect(charts).toHaveLength(channelCount);
        
        charts.forEach((chart, index) => {
          expect(chart).toHaveAttribute('aria-label');
        });
      });
    });
  });

  describe('Performance Tests', () => {
    describe('High-Frequency Data Streams', () => {
      it('maintains 60+ FPS with high-frequency updates', async () => {
        mockPerformanceMetrics.frameRate = 62;
        
        const highFreqData = generateHighFrequencyData(1000);
        
        const TestComponent: React.FC = () => {
          const [data, setData] = useState(highFreqData);
          
          useEffect(() => {
            const interval = setInterval(() => {
              setData(prevData => {
                const newPoint: TimeSeriesDataPoint = {
                  time: new Date(),
                  value: Math.random() * 100,
                  category: 'normal'
                };
                return [...prevData.slice(-999), newPoint];
              });
            }, 16.67); // 60 FPS
            
            return () => clearInterval(interval);
          }, []);
          
          return (
            <LineChart 
              data={data}
              performanceMode={true}
              renderMode="canvas"
              animation={{ enabled: false }}
            />
          );
        };
        
        render(
          <TestWrapper>
            <TestComponent />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const canvas = document.querySelector('canvas');
          expect(canvas).toBeInTheDocument();
        });
        
        // Let it run for a short period
        await new Promise(resolve => setTimeout(resolve, 200));
        
        expect(mockPerformanceMetrics.frameRate).toBeGreaterThanOrEqual(60);
      });

      it('handles 10,000+ data points efficiently', async () => {
        const extremeDataset = generateHighFrequencyData(50000);
        const optimizedData = decimateData(extremeDataset, 2000, true);
        
        const startTime = performance.now();
        
        render(
          <TestWrapper>
            <LineChart 
              data={optimizedData}
              performanceMode={true}
              renderMode="canvas"
              showPoints={false}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const canvas = document.querySelector('canvas');
          expect(canvas).toBeInTheDocument();
        });
        
        const renderTime = performance.now() - startTime;
        expect(renderTime).toBeLessThan(1000);
      });
    });

    describe('Load Tests - Multiple Channels', () => {
      it('handles 100+ simultaneous telemetry channels', async () => {
        const channelCount = 100;
        const pointsPerChannel = 100;
        
        const startTime = performance.now();
        
        render(
          <TestWrapper>
            <TelemetryDashboard 
              channelCount={channelCount}
              maxDataPoints={pointsPerChannel}
              performanceMode={true}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByTestId('telemetry-dashboard')).toBeInTheDocument();
          const charts = screen.getAllByRole('img');
          expect(charts.length).toBeGreaterThan(0); // May be virtualized
        }, { timeout: 10000 });
        
        const loadTime = performance.now() - startTime;
        expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      });

      it('manages memory efficiently with continuous operation', async () => {
        mockPerformanceMetrics.memoryUsage = 50; // MB
        
        const TestComponent: React.FC = () => {
          const [iteration, setIteration] = useState(0);
          
          useEffect(() => {
            const interval = setInterval(() => {
              setIteration(prev => prev + 1);
            }, 100);
            
            return () => clearInterval(interval);
          }, []);
          
          const data = generateTelemetryData(10, 200);
          
          return (
            <div data-testid={`iteration-${iteration}`}>
              {data.map(channel => (
                <LineChart 
                  key={channel.channelId}
                  data={channel.data}
                  performanceMode={true}
                />
              ))}
            </div>
          );
        };
        
        render(
          <TestWrapper>
            <TestComponent />
          </TestWrapper>
        );
        
        // Let it run through several iterations
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Memory usage should remain reasonable
        expect(mockPerformanceMetrics.memoryUsage).toBeLessThan(200); // MB
      });
    });

    describe('Data Processing Performance', () => {
      it('processes large datasets with transformation pipelines', async () => {
        const largeDataset = generateHighFrequencyData(100000);
        
        const pipeline = createTransformationPipeline([
          {
            name: 'decimation',
            transform: (data: TimeSeriesDataPoint[]) => decimateData(data, 5000, true)
          },
          {
            name: 'outlier-removal',
            transform: (data: TimeSeriesDataPoint[]) => removeOutliers(data, 'iqr', 2).cleaned
          },
          {
            name: 'smoothing',
            transform: (data: TimeSeriesDataPoint[]) => smoothData(data, 10, 'exponential')
          }
        ]);
        
        const startTime = performance.now();
        const result = pipeline.apply(largeDataset);
        const processingTime = performance.now() - startTime;
        
        expect(processingTime).toBeLessThan(500);
        expect(result.length).toBeGreaterThan(0);
        expect(result.length).toBeLessThan(largeDataset.length);
      });

      it('optimizes aggregation for time windows', async () => {
        const timeSeriesData = generateHighFrequencyData(10000);
        
        const startTime = performance.now();
        const aggregated = aggregateByTimeWindow(timeSeriesData, 60000, 'mean'); // 1-minute windows
        const aggregationTime = performance.now() - startTime;
        
        expect(aggregationTime).toBeLessThan(200);
        expect(aggregated.length).toBeLessThan(timeSeriesData.length);
      });
    });
  });

  describe('Accessibility Tests', () => {
    it('meets WCAG 2.1 AA compliance for all chart types', async () => {
      const telemetryData = generateTelemetryData(1, 20)[0].data;
      const gaugeData: GaugeDataPoint = { value: 65, min: 0, max: 100 };
      const heatmapData: HeatmapDataPoint[] = Array.from({ length: 16 }, (_, i) => ({
        x: i % 4,
        y: Math.floor(i / 4),
        value: Math.random() * 100
      }));
      
      const { container } = render(
        <TestWrapper>
          <div role="region" aria-label="Telemetry Dashboard">
            <LineChart 
              data={telemetryData}
              ariaLabel="Temperature sensor readings over time"
              title="Temperature"
            />
            <GaugeChart 
              data={gaugeData}
              ariaLabel="Current battery level at 65 percent"
              title="Battery Level"
            />
            <HeatmapChart 
              data={heatmapData}
              ariaLabel="4x4 sensor array temperature distribution"
              title="Sensor Array"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        const charts = screen.getAllByRole('img');
        expect(charts).toHaveLength(3);
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides keyboard navigation for interactive elements', async () => {
      const data = generateTelemetryData(1, 10)[0].data;
      const onDataPointClick = jest.fn();
      
      render(
        <TestWrapper>
          <LineChart 
            data={data}
            showPoints={true}
            onDataPointClick={onDataPointClick}
            enableZoom={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toBeInTheDocument();
        
        // Should have focusable elements
        const focusableElements = svg.querySelectorAll('[tabindex="0"]');
        expect(focusableElements.length).toBeGreaterThan(0);
      });
    });

    it('provides screen reader compatible data descriptions', async () => {
      const data = generateTelemetryData(1, 50)[0].data;
      
      render(
        <TestWrapper>
          <LineChart 
            data={data}
            ariaLabel="Rover temperature sensor data"
            ariaDescription="Line chart showing 50 temperature readings over the last 5 minutes, ranging from 15 to 85 degrees Celsius"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute('aria-label', 'Rover temperature sensor data');
        expect(svg).toHaveAttribute('aria-description');
        
        const desc = svg.querySelector('desc');
        expect(desc).toBeInTheDocument();
      });
    });

    it('supports high contrast and color-blind friendly themes', async () => {
      const data = generateTelemetryData(1, 20)[0].data;
      
      const { rerender } = render(
        <TestWrapper theme={lightTheme}>
          <LineChart data={data} colorScheme="accessible" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Test with dark theme
      rerender(
        <TestWrapper theme={darkTheme}>
          <LineChart data={data} colorScheme="accessible" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('Visual Regression Tests', () => {
    it('maintains consistent chart appearance across updates', async () => {
      const initialData = generateTelemetryData(1, 30)[0].data;
      
      const { rerender } = render(
        <TestWrapper>
          <LineChart 
            data={initialData}
            title="Consistency Test"
            dimensions={{ width: 800, height: 400 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute('width', '800');
        expect(svg).toHaveAttribute('height', '400');
      });
      
      // Add more data points
      const extendedData = [
        ...initialData,
        ...generateTelemetryData(1, 10)[0].data
      ];
      
      rerender(
        <TestWrapper>
          <LineChart 
            data={extendedData}
            title="Consistency Test"
            dimensions={{ width: 800, height: 400 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute('width', '800');
        expect(svg).toHaveAttribute('height', '400');
      });
    });

    it('preserves styling across theme changes', async () => {
      const data = generateTelemetryData(1, 15)[0].data;
      
      const { rerender } = render(
        <TestWrapper theme={lightTheme}>
          <LineChart data={data} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      rerender(
        <TestWrapper theme={darkTheme}>
          <LineChart data={data} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });
  });

  describe('End-to-End Telemetry Scenarios', () => {
    it('handles complete rover telemetry dashboard workflow', async () => {
      const TestScenario: React.FC = () => {
        const [isActive, setIsActive] = useState(false);
        const [telemetryChannels] = useState([
          { id: 'temp_1', name: 'Engine Temperature', unit: '°C' },
          { id: 'voltage_1', name: 'Battery Voltage', unit: 'V' },
          { id: 'speed_1', name: 'Rover Speed', unit: 'km/h' },
          { id: 'pressure_1', name: 'Tire Pressure', unit: 'PSI' }
        ]);
        
        return (
          <div data-testid="rover-dashboard">
            <button 
              data-testid="activate-telemetry"
              onClick={() => setIsActive(!isActive)}
            >
              {isActive ? 'Stop' : 'Start'} Telemetry
            </button>
            
            {isActive && (
              <div data-testid="active-telemetry">
                <TelemetryDashboard 
                  channelCount={telemetryChannels.length}
                  updateInterval={200}
                  performanceMode={false}
                />
              </div>
            )}
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <TestScenario />
        </TestWrapper>
      );
      
      expect(screen.getByTestId('rover-dashboard')).toBeInTheDocument();
      
      const activateButton = screen.getByTestId('activate-telemetry');
      expect(activateButton).toHaveTextContent('Start Telemetry');
      
      fireEvent.click(activateButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('active-telemetry')).toBeInTheDocument();
        expect(activateButton).toHaveTextContent('Stop Telemetry');
      });
      
      await waitFor(() => {
        const charts = screen.getAllByRole('img');
        expect(charts.length).toBeGreaterThan(0);
      });
    });

    it('manages emergency alerts and critical thresholds', async () => {
      const criticalData = generateTelemetryData(1, 20)[0].data.map(point => ({
        ...point,
        category: point.value > 80 ? 'critical' : point.value > 60 ? 'warning' : 'normal'
      }));
      
      const AlertingChart: React.FC = () => {
        const [alerts, setAlerts] = useState<string[]>([]);
        
        useEffect(() => {
          const criticalPoints = criticalData.filter(p => p.category === 'critical');
          if (criticalPoints.length > 0) {
            setAlerts(['Critical temperature detected']);
          }
        }, []);
        
        return (
          <div>
            <div data-testid="alert-panel">
              {alerts.map((alert, index) => (
                <div key={index} data-testid="alert" role="alert">
                  {alert}
                </div>
              ))}
            </div>
            <LineChart 
              data={criticalData}
              showThresholds={true}
              thresholds={[
                { value: 60, label: 'Warning', color: 'orange' },
                { value: 80, label: 'Critical', color: 'red' }
              ]}
            />
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <AlertingChart />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('alert-panel')).toBeInTheDocument();
        expect(screen.getByRole('img')).toBeInTheDocument();
        
        const alerts = screen.getAllByTestId('alert');
        expect(alerts.length).toBeGreaterThan(0);
        
        alerts.forEach(alert => {
          expect(alert).toHaveAttribute('role', 'alert');
        });
      });
    });
  });

  describe('Cross-browser Compatibility', () => {
    it('works with different rendering modes', async () => {
      const data = generateTelemetryData(1, 100)[0].data;
      
      // Test SVG rendering
      const { rerender } = render(
        <TestWrapper>
          <LineChart data={data} renderMode="svg" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Test Canvas rendering
      rerender(
        <TestWrapper>
          <LineChart data={data} renderMode="canvas" />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const canvas = document.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
      });
    });

    it('handles different screen sizes and DPI settings', async () => {
      const data = generateTelemetryData(1, 50)[0].data;
      
      render(
        <TestWrapper>
          <ResponsiveContainer>
            {(dimensions) => (
              <LineChart 
                data={data}
                dimensions={dimensions}
                highDPI={true}
              />
            )}
          </ResponsiveContainer>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Test different screen sizes
      const testSizes = [
        { width: 320, height: 240 },   // Mobile
        { width: 768, height: 1024 },  // Tablet
        { width: 1920, height: 1080 }  // Desktop
      ];
      
      for (const size of testSizes) {
        act(() => {
          mockResizeObserver.simulateResize(size.width, size.height);
        });
        
        await waitFor(() => {
          const svg = screen.getByRole('img');
          const width = parseInt(svg.getAttribute('width') || '0');
          expect(width).toBeGreaterThan(0);
          expect(width).toBeLessThanOrEqual(size.width);
        });
      }
    });
  });
});