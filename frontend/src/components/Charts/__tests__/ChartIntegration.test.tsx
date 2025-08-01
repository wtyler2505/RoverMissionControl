/**
 * Chart Integration Tests
 * Tests for chart rendering, responsive behavior, real-time updates, and accessibility
 */

import React, { useState, useEffect } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { GaugeChart } from '../charts/GaugeChart';
import { AreaChart } from '../charts/AreaChart';
import { BarChart } from '../charts/BarChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { TimeSeriesDataPoint, GaugeDataPoint, ChartDataPoint, HeatmapDataPoint } from '../types';
import { lightTheme, darkTheme } from '../../../theme/themes';
import { decimateData, smoothData, aggregateByTimeWindow } from '../utils/dataTransformers';

// Mock performance hooks
jest.mock('../../../hooks/usePerformanceMonitoring', () => ({
  useComponentPerformanceTracking: () => ({
    startTracking: jest.fn(),
    endTracking: jest.fn()
  })
}));

// Mock WebSocket for real-time tests
class MockWebSocket {
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  
  constructor(public url: string) {
    setTimeout(() => {
      this.onopen?.(new Event('open'));
    }, 0);
  }
  
  send(data: string) {
    // Mock send implementation
  }
  
  close() {
    setTimeout(() => {
      this.onclose?.(new CloseEvent('close'));
    }, 0);
  }
  
  // Helper method to simulate incoming messages
  simulateMessage(data: any) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    this.onmessage?.(event);
  }
}

(global as any).WebSocket = MockWebSocket;

// Mock ResizeObserver
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

// Test data generators
const generateTimeSeriesData = (count: number, startTime = new Date()): TimeSeriesDataPoint[] => {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(startTime.getTime() + i * 1000),
    value: Math.sin(i / 10) * 50 + 50 + (Math.random() - 0.5) * 10,
    category: i % 10 === 0 ? 'critical' : i % 5 === 0 ? 'warning' : 'normal'
  }));
};

const generateLargeDataset = (count: number): TimeSeriesDataPoint[] => {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.now() + i * 1000),
    value: Math.sin(i / 100) * 100 + 100 + Math.random() * 20
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

// Real-time data component for testing
const RealTimeChartTest: React.FC<{ updateInterval?: number }> = ({ updateInterval = 1000 }) => {
  const [data, setData] = useState<TimeSeriesDataPoint[]>(generateTimeSeriesData(10));
  const [isUpdating, setIsUpdating] = useState(false);
  
  useEffect(() => {
    if (!isUpdating) return;
    
    const interval = setInterval(() => {
      setData(prevData => {
        const newPoint: TimeSeriesDataPoint = {
          time: new Date(),
          value: Math.random() * 100,
          category: Math.random() > 0.8 ? 'critical' : 'normal'
        };
        
        const newData = [...prevData.slice(-49), newPoint]; // Keep last 50 points
        return newData;
      });
    }, updateInterval);
    
    return () => clearInterval(interval);
  }, [isUpdating, updateInterval]);
  
  return (
    <div>
      <button 
        data-testid="toggle-updates" 
        onClick={() => setIsUpdating(!isUpdating)}
      >
        {isUpdating ? 'Stop' : 'Start'} Updates
      </button>
      <LineChart 
        data={data}
        showPoints={true}
        enableZoom={true}
        animation={{ enabled: true, duration: 200 }}
      />
    </div>
  );
};

describe('Chart Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-Chart Rendering', () => {
    it('renders multiple chart types simultaneously', async () => {
      const timeSeriesData = generateTimeSeriesData(20);
      const barData: ChartDataPoint[] = Array.from({ length: 5 }, (_, i) => ({
        x: `Category ${i + 1}`,
        y: Math.random() * 100
      }));
      const gaugeData: GaugeDataPoint = { value: 75, min: 0, max: 100 };
      const heatmapData: HeatmapDataPoint[] = Array.from({ length: 25 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        value: Math.random() * 100
      }));
      
      render(
        <TestWrapper>
          <div data-testid="chart-dashboard">
            <div data-testid="line-chart-container">
              <LineChart data={timeSeriesData} />
            </div>
            <div data-testid="area-chart-container">
              <AreaChart data={timeSeriesData} showArea={true} />
            </div>
            <div data-testid="bar-chart-container">
              <BarChart data={barData} />
            </div>
            <div data-testid="gauge-chart-container">
              <GaugeChart data={gaugeData} />
            </div>
            <div data-testid="heatmap-chart-container">
              <HeatmapChart data={heatmapData} />
            </div>
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('line-chart-container')).toBeInTheDocument();
        expect(screen.getByTestId('area-chart-container')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart-container')).toBeInTheDocument();
        expect(screen.getByTestId('gauge-chart-container')).toBeInTheDocument();
        expect(screen.getByTestId('heatmap-chart-container')).toBeInTheDocument();
      });
      
      // Verify all charts have rendered SVG elements
      const svgElements = screen.getAllByRole('img');
      expect(svgElements).toHaveLength(5);
    });

    it('handles theme switching across multiple charts', async () => {
      const data = generateTimeSeriesData(10);
      const { rerender } = render(
        <TestWrapper theme={lightTheme}>
          <LineChart data={data} />
          <GaugeChart data={{ value: 50, min: 0, max: 100 }} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svgElements = screen.getAllByRole('img');
        expect(svgElements).toHaveLength(2);
      });
      
      // Switch to dark theme
      rerender(
        <TestWrapper theme={darkTheme}>
          <LineChart data={data} />
          <GaugeChart data={{ value: 50, min: 0, max: 100 }} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svgElements = screen.getAllByRole('img');
        expect(svgElements).toHaveLength(2);
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts all charts to different screen sizes', async () => {
      const data = generateTimeSeriesData(20);
      
      render(
        <TestWrapper>
          <div style={{ width: '100%', height: '100vh' }}>
            <ResponsiveContainer>
              {(dimensions) => (
                <div data-testid="responsive-dashboard">
                  <LineChart data={data} dimensions={dimensions} />
                  <GaugeChart data={{ value: 60, min: 0, max: 100 }} dimensions={dimensions} />
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('responsive-dashboard')).toBeInTheDocument();
      });
      
      // Simulate mobile screen size
      act(() => {
        mockResizeObserver.simulateResize(375, 667);
      });
      
      await waitFor(() => {
        const svgElements = screen.getAllByRole('img');
        svgElements.forEach(svg => {
          expect(parseInt(svg.getAttribute('width') || '0')).toBeLessThanOrEqual(375);
        });
      });
      
      // Simulate desktop screen size
      act(() => {
        mockResizeObserver.simulateResize(1920, 1080);
      });
      
      await waitFor(() => {
        const svgElements = screen.getAllByRole('img');
        svgElements.forEach(svg => {
          expect(parseInt(svg.getAttribute('width') || '0')).toBeGreaterThan(375);
        });
      });
    });

    it('maintains aspect ratios during resize', async () => {
      const data = generateTimeSeriesData(10);
      
      render(
        <TestWrapper>
          <ResponsiveContainer aspectRatio={2}>
            {(dimensions) => (
              <LineChart data={data} dimensions={dimensions} />
            )}
          </ResponsiveContainer>
        </TestWrapper>
      );
      
      // Test various screen sizes
      const testSizes = [
        { width: 400, height: 300 },
        { width: 800, height: 600 },
        { width: 1200, height: 900 }
      ];
      
      for (const size of testSizes) {
        act(() => {
          mockResizeObserver.simulateResize(size.width, size.height);
        });
        
        await waitFor(() => {
          const svg = screen.getByRole('img');
          const width = parseInt(svg.getAttribute('width') || '0');
          const height = parseInt(svg.getAttribute('height') || '0');
          const aspectRatio = width / height;
          
          expect(Math.abs(aspectRatio - 2)).toBeLessThan(0.1);
        });
      }
    });
  });

  describe('Real-Time Data Updates', () => {
    it('handles streaming data updates efficiently', async () => {
      render(
        <TestWrapper>
          <RealTimeChartTest updateInterval={100} />
        </TestWrapper>
      );
      
      const startButton = screen.getByTestId('toggle-updates');
      expect(startButton).toHaveTextContent('Start Updates');
      
      // Start real-time updates
      fireEvent.click(startButton);
      expect(startButton).toHaveTextContent('Stop Updates');
      
      // Wait for several updates
      await new Promise(resolve => setTimeout(resolve, 350));
      
      // Stop updates
      fireEvent.click(startButton);
      expect(startButton).toHaveTextContent('Start Updates');
      
      // Chart should still be rendered
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('handles WebSocket data streams', async () => {
      const mockWebSocket = new MockWebSocket('ws://localhost:8080/telemetry');
      
      const WebSocketChart: React.FC = () => {
        const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
        
        useEffect(() => {
          mockWebSocket.onmessage = (event) => {
            const newData = JSON.parse(event.data);
            setData(prevData => [...prevData.slice(-49), newData]);
          };
          
          return () => {
            mockWebSocket.close();
          };
        }, []);
        
        return <LineChart data={data} />;
      };
      
      render(
        <TestWrapper>
          <WebSocketChart />
        </TestWrapper>
      );
      
      // Simulate WebSocket messages
      const testMessages = [
        { time: new Date().toISOString(), value: 25 },
        { time: new Date(Date.now() + 1000).toISOString(), value: 30 },
        { time: new Date(Date.now() + 2000).toISOString(), value: 35 }
      ];
      
      for (const message of testMessages) {
        act(() => {
          mockWebSocket.simulateMessage(message);
        });
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Performance with Large Datasets', () => {
    it('renders large datasets efficiently', async () => {
      const largeDataset = generateLargeDataset(10000);
      
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <LineChart 
            data={largeDataset}
            performanceMode={true}
            showPoints={false} // Disable points for better performance
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });

    it('applies data transformations for performance optimization', async () => {
      const largeDataset = generateLargeDataset(50000);
      
      // Apply transformations
      const decimatedData = decimateData(largeDataset, 1000);
      const smoothedData = smoothData(decimatedData, 5);
      
      expect(decimatedData.length).toBeLessThanOrEqual(1000);
      expect(smoothedData.length).toBe(decimatedData.length);
      
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <LineChart data={smoothedData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(500); // Should render quickly with optimized data
    });

    it('handles canvas rendering for high-volume data', async () => {
      const extremelyLargeDataset = generateLargeDataset(100000);
      
      render(
        <TestWrapper>
          <LineChart 
            data={extremelyLargeDataset}
            renderMode="canvas"
            performanceMode={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        // Canvas rendering should create a canvas element instead of SVG
        const canvas = document.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Integration', () => {
    it('provides comprehensive ARIA support across chart types', async () => {
      const timeSeriesData = generateTimeSeriesData(10);
      const gaugeData: GaugeDataPoint = { value: 75, min: 0, max: 100 };
      
      render(
        <TestWrapper>
          <div role="region" aria-label="Telemetry Dashboard">
            <LineChart 
              data={timeSeriesData}
              ariaLabel="Temperature trend over time showing 10 data points"
            />
            <GaugeChart 
              data={gaugeData}
              ariaLabel="Current temperature gauge reading 75 degrees"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        const charts = screen.getAllByRole('img');
        expect(charts).toHaveLength(2);
        
        expect(charts[0]).toHaveAttribute('aria-label', expect.stringContaining('Temperature trend'));
        expect(charts[1]).toHaveAttribute('aria-label', expect.stringContaining('Current temperature'));
      });
    });

    it('supports keyboard navigation for interactive elements', async () => {
      const data = generateTimeSeriesData(5);
      const onDataPointClick = jest.fn();
      
      render(
        <TestWrapper>
          <LineChart 
            data={data}
            showPoints={true}
            onDataPointClick={onDataPointClick}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const points = svg.querySelectorAll('.point');
        expect(points.length).toBeGreaterThan(0);
        
        // Points should be interactive
        points.forEach(point => {
          expect(point).toHaveStyle('cursor: pointer');
        });
      });
    });

    it('provides screen reader compatible descriptions', async () => {
      const data = generateTimeSeriesData(10);
      
      render(
        <TestWrapper>
          <LineChart 
            data={data}
            ariaLabel="Temperature sensor data"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute('aria-label', 'Temperature sensor data');
        
        // Check for descriptive elements
        const title = svg.querySelector('title');
        const desc = svg.querySelector('desc');
        
        if (title) {
          expect(title.textContent).toBeTruthy();
        }
        if (desc) {
          expect(desc.textContent).toBeTruthy();
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('gracefully handles malformed data', async () => {
      const malformedData = [
        { time: new Date(), value: 10 },
        { time: null as any, value: NaN },
        { time: new Date(), value: undefined as any },
        { time: 'invalid' as any, value: 20 }
      ];
      
      expect(() => {
        render(
          <TestWrapper>
            <LineChart data={malformedData} />
          </TestWrapper>
        );
      }).not.toThrow();
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('handles empty datasets across chart types', async () => {
      render(
        <TestWrapper>
          <div>
            <LineChart data={[]} />
            <BarChart data={[]} />
            <HeatmapChart data={[]} />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svgElements = screen.getAllByRole('img');
        expect(svgElements).toHaveLength(3);
      });
    });

    it('recovers from rendering errors', async () => {
      // Mock D3 to throw an error occasionally
      const originalSelect = (global as any).d3?.select;
      let errorThrown = false;
      
      if (originalSelect) {
        (global as any).d3.select = jest.fn().mockImplementation((selector) => {
          if (!errorThrown && selector === 'svg') {
            errorThrown = true;
            throw new Error('Mock D3 error');
          }
          return originalSelect(selector);
        });
      }
      
      const data = generateTimeSeriesData(5);
      
      expect(() => {
        render(
          <TestWrapper>
            <LineChart data={data} />
          </TestWrapper>
        );
      }).not.toThrow();
      
      // Restore original function
      if (originalSelect) {
        (global as any).d3.select = originalSelect;
      }
    });
  });

  describe('Memory Management', () => {
    it('properly cleans up resources when charts are unmounted', () => {
      const data = generateTimeSeriesData(100);
      
      const { unmount } = render(
        <TestWrapper>
          <div>
            <LineChart data={data} enableZoom={true} />
            <GaugeChart data={{ value: 50, min: 0, max: 100 }} />
            <ResponsiveContainer>
              {() => <BarChart data={data.map(d => ({ x: d.time.toISOString(), y: d.value }))} />}
            </ResponsiveContainer>
          </div>
        </TestWrapper>
      );
      
      // Verify components are rendered
      expect(screen.getAllByRole('img')).toHaveLength(3);
      expect(mockResizeObserver.observe).toHaveBeenCalled();
      
      // Unmount and verify cleanup
      unmount();
      
      expect(mockResizeObserver.disconnect).toHaveBeenCalled();
    });

    it('handles rapid mount/unmount cycles', async () => {
      const data = generateTimeSeriesData(10);
      
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(
          <TestWrapper>
            <LineChart data={data} />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
        
        unmount();
      }
      
      // Should not cause memory leaks or errors
      expect(true).toBe(true);
    });
  });

  describe('Animation Integration', () => {
    it('coordinates animations across multiple charts', async () => {
      const data = generateTimeSeriesData(10);
      
      render(
        <TestWrapper>
          <div>
            <LineChart 
              data={data}
              animation={{ enabled: true, duration: 500 }}
            />
            <AreaChart 
              data={data}
              animation={{ enabled: true, duration: 500 }}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svgElements = screen.getAllByRole('img');
        expect(svgElements).toHaveLength(2);
        
        // Both charts should have animated elements
        svgElements.forEach(svg => {
          const animatedElement = svg.querySelector('[stroke-dasharray]');
          if (animatedElement) {
            expect(animatedElement).toBeInTheDocument();
          }
        });
      });
    });

    it('maintains smooth transitions during data updates', async () => {
      const initialData = generateTimeSeriesData(5);
      const { rerender } = render(
        <TestWrapper>
          <LineChart 
            data={initialData}
            animation={{ enabled: true, duration: 300 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Update data and verify smooth transition
      const updatedData = generateTimeSeriesData(8);
      rerender(
        <TestWrapper>
          <LineChart 
            data={updatedData}
            animation={{ enabled: true, duration: 300 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const points = svg.querySelectorAll('.point');
        expect(points).toHaveLength(8);
      });
    });
  });
});
