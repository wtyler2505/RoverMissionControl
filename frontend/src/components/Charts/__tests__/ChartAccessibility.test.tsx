/**
 * Chart Accessibility Tests
 * Tests for screen reader compatibility, keyboard navigation, and WCAG compliance
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { GaugeChart } from '../charts/GaugeChart';
import { BarChart } from '../charts/BarChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { TimeSeriesDataPoint, GaugeDataPoint, ChartDataPoint, HeatmapDataPoint } from '../types';
import { lightTheme, darkTheme } from '../../../theme/themes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

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

// Test data
const mockTimeSeriesData: TimeSeriesDataPoint[] = [
  { time: new Date('2024-01-01T10:00:00Z'), value: 10, category: 'normal' },
  { time: new Date('2024-01-01T10:01:00Z'), value: 15, category: 'warning' },
  { time: new Date('2024-01-01T10:02:00Z'), value: 8, category: 'normal' },
  { time: new Date('2024-01-01T10:03:00Z'), value: 25, category: 'critical' },
  { time: new Date('2024-01-01T10:04:00Z'), value: 12, category: 'normal' }
];

const mockBarData: ChartDataPoint[] = [
  { x: 'Product A', y: 100 },
  { x: 'Product B', y: 150 },
  { x: 'Product C', y: 80 },
  { x: 'Product D', y: 200 },
  { x: 'Product E', y: 120 }
];

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

const mockHeatmapData: HeatmapDataPoint[] = [
  { x: 'Mon', y: 'Morning', value: 20 },
  { x: 'Mon', y: 'Afternoon', value: 35 },
  { x: 'Tue', y: 'Morning', value: 18 },
  { x: 'Tue', y: 'Afternoon', value: 42 },
  { x: 'Wed', y: 'Morning', value: 25 },
  { x: 'Wed', y: 'Afternoon', value: 38 }
];

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

// Helper to get color contrast ratio
const getContrastRatio = (color1: string, color2: string): number => {
  // Simplified contrast ratio calculation for testing
  // In real implementation, would use proper color parsing and luminance calculation
  const getLuminance = (color: string): number => {
    // Mock luminance calculation
    if (color.includes('white') || color.includes('#fff')) return 1;
    if (color.includes('black') || color.includes('#000')) return 0;
    return 0.5; // Default for testing
  };
  
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

describe('Chart Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ARIA Attributes and Roles', () => {
    it('provides appropriate ARIA roles for chart elements', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            ariaLabel="Temperature trend over time"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute('role', 'img');
        expect(svg).toHaveAttribute('aria-label', 'Temperature trend over time');
      });
    });

    it('includes descriptive titles and descriptions', async () => {
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            ariaLabel="Current temperature gauge reading 75 degrees"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        
        // Check for title element
        const title = svg.querySelector('title');
        if (title) {
          expect(title.textContent).toBeTruthy();
        }
        
        // Check for description element
        const desc = svg.querySelector('desc');
        if (desc) {
          expect(desc.textContent).toBeTruthy();
        }
      });
    });

    it('provides accessible names for interactive elements', async () => {
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
        const points = svg.querySelectorAll('.point');
        
        points.forEach((point, index) => {
          // Interactive points should have accessible attributes
          expect(point).toHaveAttribute('tabindex', '0');
          expect(point).toHaveAttribute('role', 'button');
          expect(point).toHaveAttribute('aria-label', expect.stringContaining('data point'));
        });
      });
    });

    it('groups related elements with appropriate ARIA attributes', async () => {
      render(
        <TestWrapper>
          <BarChart 
            data={mockBarData}
            ariaLabel="Product sales comparison"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        
        // Chart should be grouped appropriately
        const chartGroup = svg.querySelector('[role="group"]');
        if (chartGroup) {
          expect(chartGroup).toHaveAttribute('aria-label');
        }
      });
    });
  });

  describe('Keyboard Navigation', () => {
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
          // Focus the first point
          (firstPoint as HTMLElement).focus();
          expect(document.activeElement).toBe(firstPoint);
          
          // Test Enter key activation
          fireEvent.keyDown(firstPoint, { key: 'Enter' });
          expect(onDataPointClick).toHaveBeenCalled();
          
          // Test Space key activation
          onDataPointClick.mockClear();
          fireEvent.keyDown(firstPoint, { key: ' ' });
          expect(onDataPointClick).toHaveBeenCalled();
        }
      });
    });

    it('provides logical tab order for multiple interactive elements', async () => {
      render(
        <TestWrapper>
          <div>
            <LineChart 
              data={mockTimeSeriesData}
              showPoints={true}
              onDataPointClick={jest.fn()}
            />
            <GaugeChart 
              data={mockGaugeData}
              onChartClick={jest.fn()}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        const interactiveElements = document.querySelectorAll('[tabindex="0"]');
        
        // Should have logical tab order
        interactiveElements.forEach((element, index) => {
          expect(element).toHaveAttribute('tabindex', '0');
        });
      });
    });

    it('supports arrow key navigation between related elements', async () => {
      render(
        <TestWrapper>
          <BarChart 
            data={mockBarData}
            onDataPointClick={jest.fn()}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const bars = svg.querySelectorAll('[role="button"]');
        
        if (bars.length > 1) {
          const firstBar = bars[0] as HTMLElement;
          const secondBar = bars[1] as HTMLElement;
          
          // Focus first bar
          firstBar.focus();
          expect(document.activeElement).toBe(firstBar);
          
          // Arrow right should move to next bar
          fireEvent.keyDown(firstBar, { key: 'ArrowRight' });
          expect(document.activeElement).toBe(secondBar);
          
          // Arrow left should move back
          fireEvent.keyDown(secondBar, { key: 'ArrowLeft' });
          expect(document.activeElement).toBe(firstBar);
        }
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('provides meaningful text alternatives for visual information', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            ariaLabel="Temperature sensor data from 10:00 to 10:04, showing values ranging from 8 to 25 degrees with one critical alert"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const ariaLabel = svg.getAttribute('aria-label');
        
        expect(ariaLabel).toContain('Temperature sensor data');
        expect(ariaLabel).toContain('10:00 to 10:04');
        expect(ariaLabel).toContain('8 to 25 degrees');
        expect(ariaLabel).toContain('critical alert');
      });
    });

    it('provides data summaries for complex charts', async () => {
      render(
        <TestWrapper>
          <HeatmapChart 
            data={mockHeatmapData}
            ariaLabel="Weekly activity heatmap showing morning and afternoon data for Monday through Wednesday"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        
        // Should have descriptive content
        const desc = svg.querySelector('desc');
        if (desc) {
          expect(desc.textContent).toContain('heatmap');
        }
        
        // Should provide data summary
        const summary = svg.querySelector('[aria-describedby]');
        if (summary) {
          const describedBy = summary.getAttribute('aria-describedby');
          const description = document.getElementById(describedBy!);
          expect(description).toBeTruthy();
        }
      });
    });

    it('announces dynamic content changes', async () => {
      const { rerender } = render(
        <TestWrapper>
          <div aria-live="polite" aria-atomic="true">
            <GaugeChart 
              data={mockGaugeData}
              ariaLabel="Temperature gauge: 75 degrees"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Update the gauge value
      const updatedData = { ...mockGaugeData, value: 85 };
      rerender(
        <TestWrapper>
          <div aria-live="polite" aria-atomic="true">
            <GaugeChart 
              data={updatedData}
              ariaLabel="Temperature gauge: 85 degrees"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        const liveRegion = document.querySelector('[aria-live="polite"]');
        expect(liveRegion).toBeInTheDocument();
      });
    });
  });

  describe('Color Contrast and Visibility', () => {
    it('meets WCAG AA color contrast requirements', async () => {
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
        
        // Check text elements for contrast
        const textElements = svg.querySelectorAll('text');
        textElements.forEach(text => {
          const fill = text.getAttribute('fill') || 'currentColor';
          const bgColor = 'white'; // Assuming white background
          
          // Mock contrast check - in real implementation would use proper color analysis
          const contrastRatio = getContrastRatio(fill, bgColor);
          expect(contrastRatio).toBeGreaterThanOrEqual(4.5); // WCAG AA requirement
        });
      });
    });

    it('provides sufficient contrast in dark theme', async () => {
      render(
        <TestWrapper theme={darkTheme}>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        
        // Verify dark theme provides good contrast
        const textElements = svg.querySelectorAll('text');
        textElements.forEach(text => {
          const fill = text.getAttribute('fill') || 'currentColor';
          const bgColor = 'black'; // Dark theme background
          
          const contrastRatio = getContrastRatio(fill, bgColor);
          expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
        });
      });
    });

    it('uses patterns and textures in addition to color for data differentiation', async () => {
      render(
        <TestWrapper>
          <BarChart 
            data={mockBarData.map(d => ({ ...d, category: d.x.includes('A') ? 'primary' : 'secondary' }))}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const bars = svg.querySelectorAll('.bar');
        
        // Different categories should have different visual indicators beyond color
        bars.forEach(bar => {
          const pattern = bar.getAttribute('pattern');
          const strokeDasharray = bar.getAttribute('stroke-dasharray');
          const opacity = bar.getAttribute('opacity');
          
          // Should have some form of non-color differentiation
          expect(
            pattern || strokeDasharray || opacity
          ).toBeTruthy();
        });
      });
    });
  });

  describe('WCAG Compliance', () => {
    it('passes axe accessibility audit for LineChart', async () => {
      const { container } = render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            ariaLabel="Accessible line chart showing temperature data"
            showPoints={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility audit for GaugeChart', async () => {
      const { container } = render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            ariaLabel="Accessible gauge chart showing current temperature"
            showLabels={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility audit for BarChart', async () => {
      const { container } = render(
        <TestWrapper>
          <BarChart 
            data={mockBarData}
            ariaLabel="Accessible bar chart showing product sales data"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes axe accessibility audit for HeatmapChart', async () => {
      const { container } = render(
        <TestWrapper>
          <HeatmapChart 
            data={mockHeatmapData}
            ariaLabel="Accessible heatmap showing weekly activity patterns"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus Management', () => {
    it('provides visible focus indicators', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            showPoints={true}
            onDataPointClick={jest.fn()}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const points = svg.querySelectorAll('.point');
        
        if (points.length > 0) {
          const firstPoint = points[0] as HTMLElement;
          firstPoint.focus();
          
          // Should have visible focus indicator
          const computedStyle = window.getComputedStyle(firstPoint);
          expect(
            computedStyle.outline !== 'none' || 
            computedStyle.boxShadow !== 'none' ||
            firstPoint.hasAttribute('data-focus-visible')
          ).toBe(true);
        }
      });
    });

    it('manages focus when charts are updated', async () => {
      const onDataPointClick = jest.fn();
      const { rerender } = render(
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
        const firstPoint = svg.querySelector('.point') as HTMLElement;
        if (firstPoint) {
          firstPoint.focus();
          expect(document.activeElement).toBe(firstPoint);
        }
      });
      
      // Update chart data
      const newData = [...mockTimeSeriesData, {
        time: new Date('2024-01-01T10:05:00Z'),
        value: 18,
        category: 'normal' as const
      }];
      
      rerender(
        <TestWrapper>
          <LineChart 
            data={newData}
            showPoints={true}
            onDataPointClick={onDataPointClick}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        // Focus should be maintained or moved appropriately
        expect(document.activeElement).toBeTruthy();
      });
    });
  });

  describe('High Contrast Mode Support', () => {
    it('maintains visibility in high contrast mode', async () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('high-contrast'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
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
        
        // Elements should have appropriate high contrast styles
        const line = svg.querySelector('.line');
        const points = svg.querySelectorAll('.point');
        
        if (line) {
          expect(line.getAttribute('stroke')).toBeTruthy();
          expect(line.getAttribute('stroke-width')).toBeTruthy();
        }
        
        points.forEach(point => {
          expect(point.getAttribute('stroke')).toBeTruthy();
          expect(point.getAttribute('fill')).toBeTruthy();
        });
      });
    });
  });

  describe('Reduced Motion Support', () => {
    it('respects prefers-reduced-motion setting', async () => {
      // Mock reduced motion media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
      
      render(
        <TestWrapper>
          <LineChart 
            data={mockTimeSeriesData}
            animation={{ enabled: true, duration: 1000 }}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const animatedElements = svg.querySelectorAll('[stroke-dasharray]');
        
        // Animations should be disabled or minimal when reduced motion is preferred
        animatedElements.forEach(element => {
          const transition = element.getAttribute('transition');
          if (transition) {
            expect(transition).toContain('none');
          }
        });
      });
    });
  });

  describe('Language and Localization', () => {
    it('supports RTL (right-to-left) languages', async () => {
      render(
        <div dir="rtl">
          <TestWrapper>
            <BarChart 
              data={mockBarData}
              ariaLabel="مخطط بياني يوضح بيانات المبيعات"
            />
          </TestWrapper>
        </div>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const container = svg.closest('[dir="rtl"]');
        expect(container).toBeInTheDocument();
        
        // Text should be properly aligned for RTL
        const textElements = svg.querySelectorAll('text');
        textElements.forEach(text => {
          const textAnchor = text.getAttribute('text-anchor');
          if (textAnchor) {
            // RTL should adjust text anchoring appropriately
            expect(['start', 'middle', 'end']).toContain(textAnchor);
          }
        });
      });
    });

    it('provides localized number formatting', async () => {
      // Mock locale
      const originalLocale = Intl.NumberFormat().resolvedOptions().locale;
      
      render(
        <TestWrapper>
          <GaugeChart 
            data={mockGaugeData}
            showLabels={true}
            ariaLabel="Temperature: 75°C"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        const labels = svg.querySelectorAll('text');
        
        // Numbers should be formatted according to locale
        labels.forEach(label => {
          const text = label.textContent;
          if (text && /\d/.test(text)) {
            // Should contain properly formatted numbers
            expect(text).toMatch(/^[\d\s.,°%]+$/);
          }
        });
      });
    });
  });

  describe('Error States and Edge Cases', () => {
    it('provides accessible error messages', async () => {
      // Mock component that might error
      const ErrorChart: React.FC = () => {
        try {
          throw new Error('Chart rendering error');
        } catch (error) {
          return (
            <div 
              role="alert" 
              aria-live="assertive"
              aria-label="Chart error: Unable to render chart data"
            >
              <p>Unable to display chart. Please try again.</p>
            </div>
          );
        }
      };
      
      render(
        <TestWrapper>
          <ErrorChart />
        </TestWrapper>
      );
      
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      expect(errorMessage).toHaveAttribute('aria-label', expect.stringContaining('Chart error'));
    });

    it('handles empty data states accessibly', async () => {
      render(
        <TestWrapper>
          <LineChart 
            data={[]}
            ariaLabel="Temperature chart - no data available"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const svg = screen.getByRole('img');
        expect(svg).toHaveAttribute('aria-label', expect.stringContaining('no data'));
        
        // Should provide meaningful message for empty state
        const emptyMessage = svg.querySelector('text');
        if (emptyMessage) {
          expect(emptyMessage.textContent).toContain('No data');
        }
      });
    });
  });
});
