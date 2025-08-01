/**
 * LineChart Component Tests
 * Comprehensive test suite for LineChart including unit, integration, performance, and accessibility tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import * as d3 from 'd3';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { TimeSeriesDataPoint } from '../types';
import { lightTheme } from '../../../theme/themes';

// Mock performance hooks
jest.mock('../../../hooks/usePerformanceMonitoring', () => ({
  useComponentPerformanceTracking: () => ({
    startTracking: jest.fn(),
    endTracking: jest.fn()
  })
}));

// Mock D3 zoom behavior
const mockZoom = {
  scaleExtent: jest.fn().mockReturnThis(),
  translateExtent: jest.fn().mockReturnThis(),
  on: jest.fn().mockReturnThis()
};

jest.mock('d3', () => ({
  ...jest.requireActual('d3'),
  zoom: jest.fn(() => mockZoom)
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

// Test data
const mockTimeSeriesData: TimeSeriesDataPoint[] = [
  { time: new Date('2024-01-01T10:00:00Z'), value: 10 },
  { time: new Date('2024-01-01T10:01:00Z'), value: 15 },
  { time: new Date('2024-01-01T10:02:00Z'), value: 8 },
  { time: new Date('2024-01-01T10:03:00Z'), value: 20 },
  { time: new Date('2024-01-01T10:04:00Z'), value: 12 }
];

const mockDataWithCategories: TimeSeriesDataPoint[] = [
  { time: new Date('2024-01-01T10:00:00Z'), value: 10, category: 'normal' },
  { time: new Date('2024-01-01T10:01:00Z'), value: 15, category: 'warning' },
  { time: new Date('2024-01-01T10:02:00Z'), value: 8, category: 'normal' },
  { time: new Date('2024-01-01T10:03:00Z'), value: 25, category: 'critical' },
  { time: new Date('2024-01-01T10:04:00Z'), value: 12, category: 'normal' }
];

const mockLargeDataset: TimeSeriesDataPoint[] = Array.from({ length: 10000 }, (_, i) => ({
  time: new Date(Date.now() + i * 1000),
  value: Math.sin(i / 100) * 50 + 50 + Math.random() * 10
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <ChartThemeProvider theme={lightTheme}>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

describe('LineChart Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing with minimal props', () => {
      render(
        <TestWrapper>
          <LineChart data={mockTimeSeriesData} />
        </TestWrapper>
      );
      
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders with custom dimensions', () => {
      const dimensions = {
        width: 600,
        height: 300,
        margin: { top: 10, right: 20, bottom: 30, left: 40 }
      };

      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData} 
            dimensions={dimensions}
          />
        </TestWrapper>
      );
      
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('width', '600');
      expect(svg).toHaveAttribute('height', '300');
    });

    it('renders with custom aria label', () => {
      const ariaLabel = 'Telemetry temperature chart';
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            ariaLabel={ariaLabel}
          />
        </TestWrapper>
      );
      
      expect(screen.getByLabelText(ariaLabel)).toBeInTheDocument();
    });

    it('handles empty data gracefully', () => {
      render(
        <TestWrapper>
          <LineChart data={[]} />
        </TestWrapper>
      );
      
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('Data Visualization', () => {
    it('creates correct number of data points when showPoints is enabled', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const points = svg.querySelectorAll('.point');
        expect(points).toHaveLength(mockTimeSeriesData.length);
      });
    });

    it('does not render points when showPoints is false', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={false}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const points = svg.querySelectorAll('.point');
        expect(points).toHaveLength(0);
      });
    });

    it('renders area when showArea is enabled', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showArea={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const area = svg.querySelector('.area');
        expect(area).toBeInTheDocument();
      });
    });

    it('applies correct colors for different categories', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockDataWithCategories}
            showPoints={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const points = svg.querySelectorAll('.point');
        
        // Check that points have different fill colors based on category
        const criticalPoint = Array.from(points).find((point, index) => 
          mockDataWithCategories[index]?.category === 'critical'
        );
        expect(criticalPoint).toHaveAttribute('fill', expect.stringContaining('error'));
      });
    });
  });

  describe('Interactivity', () => {
    it('calls onDataPointClick when a point is clicked', async () => {
      const onDataPointClick = jest.fn();
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={true}
            onDataPointClick={onDataPointClick}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const firstPoint = svg.querySelector('.point');
        if (firstPoint) {
          fireEvent.click(firstPoint);
          expect(onDataPointClick).toHaveBeenCalledWith(
            mockTimeSeriesData[0],
            expect.any(Object)
          );
        }
      });
    });

    it('shows tooltip on point hover', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={true}
            tooltip={{ enabled: true }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const firstPoint = svg.querySelector('.point');
        if (firstPoint) {
          fireEvent.mouseEnter(firstPoint);
          
          // Check that tooltip becomes visible
          const tooltip = document.querySelector('[style*="opacity: 1"]');
          expect(tooltip).toBeInTheDocument();
        }
      });
    });

    it('calls onChartClick when chart area is clicked', async () => {
      const onChartClick = jest.fn();
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            onChartClick={onChartClick}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        fireEvent.click(svg);
        expect(onChartClick).toHaveBeenCalled();
      });
    });
  });

  describe('Zoom and Pan', () => {
    it('sets up zoom behavior when enableZoom is true', () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            enableZoom={true}
          />
        </TestWrapper>
      );
      
      expect(d3.zoom).toHaveBeenCalled();
      expect(mockZoom.scaleExtent).toHaveBeenCalledWith([0.5, 10]);
    });

    it('calls onZoom callback when zoom event occurs', async () => {
      const onZoom = jest.fn();
      const mockTransform = { k: 2, x: 10, y: 0 };
      
      // Mock the zoom event
      mockZoom.on.mockImplementation((event, callback) => {
        if (event === 'zoom') {
          setTimeout(() => callback({ transform: mockTransform }), 0);
        }
        return mockZoom;
      });
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            enableZoom={true}
            onZoom={onZoom}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(onZoom).toHaveBeenCalledWith(mockTransform);
      });
    });
  });

  describe('Animation', () => {
    it('applies animation when enabled', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            animation={{ enabled: true, duration: 500 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const line = svg.querySelector('.line');
        expect(line).toHaveAttribute('stroke-dasharray');
        expect(line).toHaveAttribute('stroke-dashoffset');
      });
    });

    it('skips animation when disabled', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            animation={{ enabled: false }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const line = svg.querySelector('.line');
        expect(line).not.toHaveAttribute('stroke-dasharray');
      });
    });
  });

  describe('Axes and Grid', () => {
    it('renders x-axis with custom label', async () => {
      const xAxisLabel = 'Time (UTC)';
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            xAxis={{ label: xAxisLabel }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const label = svg.querySelector('.x-axis-label');
        expect(label).toHaveTextContent(xAxisLabel);
      });
    });

    it('renders y-axis with custom label', async () => {
      const yAxisLabel = 'Temperature (°C)';
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            yAxis={{ label: yAxisLabel }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const label = svg.querySelector('.y-axis-label');
        expect(label).toHaveTextContent(yAxisLabel);
      });
    });

    it('renders grid lines by default', async () => {
      render(
        <TestWrapper>
          <LineChart data={mockTimeSeriesData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const xGrid = svg.querySelector('.grid-x');
        const yGrid = svg.querySelector('.grid-y');
        expect(xGrid).toBeInTheDocument();
        expect(yGrid).toBeInTheDocument();
      });
    });

    it('hides grid lines when disabled', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            xAxis={{ gridLines: false }}
            yAxis={{ gridLines: false }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const xGrid = svg.querySelector('.grid-x');
        const yGrid = svg.querySelector('.grid-y');
        expect(xGrid).not.toBeInTheDocument();
        expect(yGrid).not.toBeInTheDocument();
      });
    });
  });

  describe('Thresholds', () => {
    const mockThresholds = [
      { value: 15, label: 'Warning', color: '#ff9800', style: 'dashed' as const },
      { value: 20, label: 'Critical', color: '#f44336', style: 'solid' as const }
    ];

    it('renders threshold lines', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            thresholds={mockThresholds}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const thresholds = svg.querySelectorAll('.threshold');
        expect(thresholds).toHaveLength(mockThresholds.length);
      });
    });

    it('applies correct colors and styles to threshold lines', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            thresholds={mockThresholds}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const firstThresholdLine = svg.querySelector('.threshold-0 line');
        expect(firstThresholdLine).toHaveAttribute('stroke', mockThresholds[0].color);
        expect(firstThresholdLine).toHaveAttribute('stroke-dasharray', '5,5');
      });
    });
  });

  describe('Performance', () => {
    it('handles large datasets efficiently', async () => {
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockLargeDataset}
            performanceMode={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const renderTime = performance.now() - startTime;
        // Should render within reasonable time (less than 1 second)
        expect(renderTime).toBeLessThan(1000);
      });
    });

    it('calls onRender callback with performance metrics', async () => {
      const onRender = jest.fn();
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            onRender={onRender}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(onRender).toHaveBeenCalledWith(expect.any(Number));
      });
    });
  });

  describe('Responsive Behavior', () => {
    it('responds to container size changes', async () => {
      const { rerender } = render(
        <TestWrapper>
          <div style={{ width: 400 }}>
            <LineChart data={mockTimeSeriesData} responsive={true} />
          </div>
        </TestWrapper>
      );
      
      // Simulate container resize
      rerender(
        <TestWrapper>
          <div style={{ width: 800 }}>
            <LineChart data={mockTimeSeriesData} responsive={true} />
          </div>
        </TestWrapper>
      );
      
      // ResizeObserver should be set up
      expect(global.ResizeObserver).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            ariaLabel="Temperature over time chart"
          />
        </TestWrapper>
      );
      
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).toHaveAttribute('aria-label', 'Temperature over time chart');
    });

    it('supports keyboard navigation for interactive elements', async () => {
      const onDataPointClick = jest.fn();
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={true}
            onDataPointClick={onDataPointClick}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const firstPoint = svg.querySelector('.point');
        
        if (firstPoint) {
          // Simulate keyboard interaction
          fireEvent.keyDown(firstPoint, { key: 'Enter' });
          fireEvent.keyDown(firstPoint, { key: ' ' });
          
          // Points should be focusable
          expect(firstPoint).toHaveStyle('cursor: pointer');
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('handles invalid data gracefully', () => {
      const invalidData = [
        { time: new Date('invalid'), value: NaN },
        { time: null as any, value: undefined as any }
      ];
      
      expect(() => {
        render(
          <TestWrapper>
            <LineChart data={invalidData} />
          </TestWrapper>
        );
      }).not.toThrow();
    });

    it('handles missing required props gracefully', () => {
      expect(() => {
        render(
          <TestWrapper>
            <LineChart data={null as any} />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Interpolation Methods', () => {
    const interpolationMethods = ['linear', 'monotone', 'step', 'basis', 'cardinal'] as const;
    
    interpolationMethods.forEach(method => {
      it(`renders correctly with ${method} interpolation`, async () => {
        render(
          <TestWrapper>
            <LineChart 
              data={mockTimeSeriesData}
              interpolation={method}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          const svg = screen.getByRole('img');
          const line = svg.querySelector('.line');
          expect(line).toBeInTheDocument();
        });
      });
    });
  });

  describe('Memory Management', () => {
    it('cleans up resources on unmount', () => {
      const { unmount } = render(
        <TestWrapper>
          <LineChart data={mockTimeSeriesData} />
        </TestWrapper>
      );
      
      unmount();
      
      // Verify cleanup (ResizeObserver disconnect, etc.)
      expect(global.ResizeObserver.prototype.disconnect).toHaveBeenCalled();
    });
  });
});
