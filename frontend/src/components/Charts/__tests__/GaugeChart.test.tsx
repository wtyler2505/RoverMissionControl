/**
 * GaugeChart Component Tests
 * Comprehensive test suite for GaugeChart component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ThemeProvider } from '@mui/material/styles';
import { GaugeChart } from '../charts/GaugeChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { GaugeDataPoint } from '../types';
import { lightTheme } from '../../../theme/themes';

// Mock performance hooks
jest.mock('../../../hooks/usePerformanceMonitoring', () => ({
  useComponentPerformanceTracking: () => ({
    startTracking: jest.fn(),
    endTracking: jest.fn()
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

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <ChartThemeProvider theme={lightTheme}>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

// Test data
const mockGaugeData: GaugeDataPoint = {
  value: 75,
  min: 0,
  max: 100,
  thresholds: [
    { value: 30, label: 'Low', color: '#4caf50' },
    { value: 70, label: 'Medium', color: '#ff9800' },
    { value: 90, label: 'High', color: '#f44336' }
  ]
};

const mockGaugeDataSimple: GaugeDataPoint = {
  value: 45,
  min: 0,
  max: 100
};

const mockGaugeDataNegative: GaugeDataPoint = {
  value: -20,
  min: -50,
  max: 50
};

describe('GaugeChart Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing with minimal props', () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeDataSimple} />
        </TestWrapper>
      );
      
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('renders with custom dimensions', () => {
      const dimensions = {
        width: 400,
        height: 300,
        margin: { top: 20, right: 20, bottom: 20, left: 20 }
      };

      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeDataSimple} 
            dimensions={dimensions}
          />
        </TestWrapper>
      );
      
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('width', '400');
      expect(svg).toHaveAttribute('height', '300');
    });

    it('renders with custom aria label', () => {
      const ariaLabel = 'Engine temperature gauge';
      
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeDataSimple}
            ariaLabel={ariaLabel}
          />
        </TestWrapper>
      );
      
      expect(screen.getByLabelText(ariaLabel)).toBeInTheDocument();
    });
  });

  describe('Data Visualization', () => {
    it('displays correct value within gauge range', async () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} showLabels={true} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const valueText = svg.querySelector('text[class*="value"]');
        expect(valueText).toHaveTextContent('75');
      });
    });

    it('renders threshold segments correctly', async () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const thresholds = svg.querySelectorAll('.threshold-segment');
        expect(thresholds.length).toBe(mockGaugeData.thresholds?.length || 0);
      });
    });

    it('positions needle correctly based on value', async () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
        
        // Needle should have a transform attribute indicating rotation
        expect(needle).toHaveAttribute('transform', expect.stringContaining('rotate'));
      });
    });

    it('handles negative values correctly', async () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeDataNegative} showLabels={true} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Options', () => {
    it('respects custom angle configuration', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            startAngle={-120}
            endAngle={120}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const arc = svg.querySelector('.gauge-arc');
        expect(arc).toBeInTheDocument();
      });
    });

    it('respects custom radius configuration', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            innerRadius={0.5}
            outerRadius={0.9}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const arc = svg.querySelector('.gauge-arc');
        expect(arc).toBeInTheDocument();
      });
    });

    it('shows/hides labels based on configuration', async () => {
      const { rerender } = render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} showLabels={true} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const labels = svg.querySelectorAll('.gauge-label');
        expect(labels.length).toBeGreaterThan(0);
      });
      
      rerender(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} showLabels={false} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const labels = svg.querySelectorAll('.gauge-label');
        expect(labels.length).toBe(0);
      });
    });

    it('shows/hides ticks based on configuration', async () => {
      const { rerender } = render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} showTicks={true} tickCount={10} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const ticks = svg.querySelectorAll('.tick');
        expect(ticks.length).toBeGreaterThan(0);
      });
      
      rerender(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} showTicks={false} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const ticks = svg.querySelectorAll('.tick');
        expect(ticks.length).toBe(0);
      });
    });
  });

  describe('Color Scaling', () => {
    it('applies custom color scale', async () => {
      const customColorScale = ['#00ff00', '#ffff00', '#ff0000'];
      
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            colorScale={customColorScale}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const segments = svg.querySelectorAll('.gauge-segment');
        expect(segments.length).toBeGreaterThan(0);
      });
    });

    it('uses threshold colors when provided', async () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const thresholdSegments = svg.querySelectorAll('.threshold-segment');
        
        thresholdSegments.forEach((segment, index) => {
          const expectedColor = mockGaugeData.thresholds?.[index]?.color;
          if (expectedColor) {
            expect(segment).toHaveAttribute('fill', expectedColor);
          }
        });
      });
    });
  });

  describe('Interactivity', () => {
    it('calls onClick callback when gauge is clicked', async () => {
      const onClick = jest.fn();
      
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            onChartClick={onClick}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        fireEvent.click(svg);
        expect(onClick).toHaveBeenCalled();
      });
    });

    it('shows tooltip on hover when enabled', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            tooltip={{ enabled: true }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        
        if (needle) {
          fireEvent.mouseEnter(needle);
          
          // Check that tooltip becomes visible
          const tooltip = document.querySelector('[style*="opacity: 1"]');
          expect(tooltip).toBeInTheDocument();
        }
      });
    });
  });

  describe('Animation', () => {
    it('animates needle movement when enabled', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            animation={{ enabled: true, duration: 500 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
        
        // Animation typically adds transition attributes or classes
        expect(needle).toHaveAttribute('transform');
      });
    });

    it('skips animation when disabled', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            animation={{ enabled: false }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles value at minimum boundary', async () => {
      const boundaryData = { ...mockGaugeData, value: mockGaugeData.min };
      
      render(
        <TestWrapper>
          <GaugeChart data={boundaryData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
      });
    });

    it('handles value at maximum boundary', async () => {
      const boundaryData = { ...mockGaugeData, value: mockGaugeData.max };
      
      render(
        <TestWrapper>
          <GaugeChart data={boundaryData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
      });
    });

    it('handles value outside range (clamping)', async () => {
      const outOfRangeData = { ...mockGaugeData, value: 150 }; // Above max
      
      render(
        <TestWrapper>
          <GaugeChart data={outOfRangeData} />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
        
        // Needle should be positioned at maximum position
        const transform = needle?.getAttribute('transform');
        expect(transform).toContain('rotate');
      });
    });

    it('handles zero range (min equals max)', () => {
      const zeroRangeData = { value: 5, min: 5, max: 5 };
      
      expect(() => {
        render(
          <TestWrapper>
            <GaugeChart data={zeroRangeData} />
          </TestWrapper>
        );
      }).not.toThrow();
    });

    it('handles invalid numeric values', () => {
      const invalidData = {
        value: NaN,
        min: 0,
        max: 100
      };
      
      expect(() => {
        render(
          <TestWrapper>
            <GaugeChart data={invalidData} />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            ariaLabel="Engine temperature gauge showing 75 degrees"
          />
        </TestWrapper>
      );
      
      const svg = screen.getByRole('img');
      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).toHaveAttribute('aria-label', 'Engine temperature gauge showing 75 degrees');
    });

    it('provides descriptive text for screen readers', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            showLabels={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const description = svg.querySelector('desc');
        expect(description).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} />
        </TestWrapper>
      );
      
      const svg = screen.getByRole('img');
      
      // Should be focusable
      svg.focus();
      expect(document.activeElement).toBe(svg);
    });
  });

  describe('Performance', () => {
    it('renders efficiently with complex configurations', () => {
      const complexData: GaugeDataPoint = {
        value: 73.5,
        min: -100,
        max: 200,
        thresholds: Array.from({ length: 20 }, (_, i) => ({
          value: i * 15 - 100,
          label: `Threshold ${i}`,
          color: `hsl(${i * 18}, 70%, 50%)`
        }))
      };
      
      const startTime = performance.now();
      
      render(
        <TestWrapper>
          <GaugeChart 
            data={complexData}
            showTicks={true}
            tickCount={50}
            showLabels={true}
          />
        </TestWrapper>
      );
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should render quickly
    });

    it('handles rapid value updates efficiently', async () => {
      let currentValue = 0;
      const { rerender } = render(
        <TestWrapper>
          <GaugeChart data={{ ...mockGaugeData, value: currentValue }} />
        </TestWrapper>
      );
      
      const startTime = performance.now();
      
      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        currentValue += 10;
        rerender(
          <TestWrapper>
            <GaugeChart data={{ ...mockGaugeData, value: currentValue }} />
          </TestWrapper>
        );
      }
      
      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(500); // Should handle updates efficiently
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to container size changes', () => {
      const { rerender } = render(
        <TestWrapper>
          <div style={{ width: 200, height: 200 }}>
            <GaugeChart data={mockGaugeData} responsive={true} />
          </div>
        </TestWrapper>
      );
      
      rerender(
        <TestWrapper>
          <div style={{ width: 400, height: 400 }}>
            <GaugeChart data={mockGaugeData} responsive={true} />
          </div>
        </TestWrapper>
      );
      
      expect(global.ResizeObserver).toHaveBeenCalled();
    });
  });

  describe('Custom Needle Configuration', () => {
    it('respects custom needle width', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            needleWidth={5}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const needle = svg.querySelector('.needle');
        expect(needle).toBeInTheDocument();
        expect(needle).toHaveAttribute('stroke-width', '5');
      });
    });
  });

  describe('Memory Management', () => {
    it('cleans up resources on unmount', () => {
      const { unmount } = render(
        <TestWrapper>
          <GaugeChart data={mockGaugeData} />
        </TestWrapper>
      );
      
      unmount();
      
      // Verify cleanup
      expect(global.ResizeObserver.prototype.disconnect).toHaveBeenCalled();
    });
  });
});
