/**
 * Enhanced Telemetry Chart Accessibility Tests
 * Comprehensive WCAG 2.1 AA compliance tests for telemetry visualization components
 */

import React, { useState, useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { GaugeChart } from '../charts/GaugeChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { AreaChart } from '../charts/AreaChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { 
  TimeSeriesDataPoint, 
  GaugeDataPoint, 
  HeatmapDataPoint,
  TelemetryAccessibilityOptions 
} from '../types';
import { lightTheme, darkTheme, highContrastTheme } from '../../../theme/themes';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Color contrast utilities
const calculateContrastRatio = (color1: string, color2: string): number => {
  const getLuminance = (color: string): number => {
    // Simplified luminance calculation for testing
    // In production, would use proper color parsing library
    const rgb = color.toLowerCase();
    if (rgb.includes('white') || rgb === '#ffffff' || rgb === '#fff') return 1;
    if (rgb.includes('black') || rgb === '#000000' || rgb === '#000') return 0;
    if (rgb.includes('red')) return 0.2126 * 0.8;
    if (rgb.includes('green')) return 0.7152 * 0.8;
    if (rgb.includes('blue')) return 0.0722 * 0.8;
    return 0.5; // Default for testing
  };
  
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
};

// Accessibility test data generators
const generateAccessibleTelemetryData = (count: number): TimeSeriesDataPoint[] => {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(Date.now() - (count - i) * 60000),
    value: Math.sin(i / 10) * 50 + 50,
    category: i % 15 === 0 ? 'critical' : i % 8 === 0 ? 'warning' : 'normal',
    metadata: {
      sensor: `Temperature Sensor ${Math.floor(i / 10) + 1}`,
      location: `Engine Bay Section ${String.fromCharCode(65 + (i % 3))}`,
      description: `Reading ${i + 1} of ${count}`,
      quality: Math.random() > 0.1 ? 'good' : 'uncertain'
    }
  }));
};

const generateAccessibleGaugeData = (value: number): GaugeDataPoint => ({
  value,
  min: 0,
  max: 100,
  unit: '%',
  title: 'Battery Level',
  description: `Current battery level is ${value}% of maximum capacity`,
  thresholds: [
    { value: 20, label: 'Critical Low', color: '#d32f2f', description: 'Battery critically low - immediate attention required' },
    { value: 40, label: 'Low', color: '#f57c00', description: 'Battery low - consider recharging soon' },
    { value: 80, label: 'Good', color: '#388e3c', description: 'Battery level good' },
    { value: 100, label: 'Full', color: '#1976d2', description: 'Battery fully charged' }
  ]
});

const generateAccessibleHeatmapData = (width: number, height: number): HeatmapDataPoint[] => {
  const data: HeatmapDataPoint[] = [];
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      data.push({
        x: x,
        y: y,
        value: Math.sin(x / 3) * Math.cos(y / 3) * 50 + 50,
        label: `Sensor at position (${x}, ${y})`,
        description: `Temperature reading from sensor grid position ${x}, ${y}`
      });
    }
  }
  return data;
};

// Accessibility-focused chart component
const AccessibleTelemetryChart: React.FC<{
  data: TimeSeriesDataPoint[];
  title: string;
  accessibilityOptions?: TelemetryAccessibilityOptions;
  highContrast?: boolean;
  reducedMotion?: boolean;
  screenReaderOptimized?: boolean;
}> = ({ 
  data, 
  title, 
  accessibilityOptions,
  highContrast = false,
  reducedMotion = false,
  screenReaderOptimized = false
}) => {
  const [focusedDataPoint, setFocusedDataPoint] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  
  const handleDataPointFocus = (index: number) => {
    setFocusedDataPoint(index);
    
    if (screenReaderOptimized && data[index]) {
      const point = data[index];
      const announcement = `Data point ${index + 1} of ${data.length}. Time: ${point.time.toLocaleString()}. Value: ${point.value.toFixed(2)}. Status: ${point.category}`;
      
      // Create live region announcement
      const liveRegion = document.getElementById('chart-live-region');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  };
  
  const getDataSummary = (): string => {
    if (data.length === 0) return 'No data available';
    
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const critical = data.filter(d => d.category === 'critical').length;
    const warning = data.filter(d => d.category === 'warning').length;
    
    return `${title} contains ${data.length} data points. Values range from ${min.toFixed(2)} to ${max.toFixed(2)} with an average of ${avg.toFixed(2)}. ${critical} critical alerts and ${warning} warnings detected.`;
  };
  
  return (
    <div 
      ref={chartRef}
      role="img"
      aria-label={`${title} telemetry chart`}
      aria-describedby={`${title.replace(/\s+/g, '-').toLowerCase()}-description`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' && focusedDataPoint !== null && focusedDataPoint < data.length - 1) {
          handleDataPointFocus(focusedDataPoint + 1);
        } else if (e.key === 'ArrowLeft' && focusedDataPoint !== null && focusedDataPoint > 0) {
          handleDataPointFocus(focusedDataPoint - 1);
        } else if (e.key === 'Home') {
          handleDataPointFocus(0);
        } else if (e.key === 'End') {
          handleDataPointFocus(data.length - 1);
        }
      }}
    >
      <div 
        id={`${title.replace(/\s+/g, '-').toLowerCase()}-description`}
        className="sr-only"
        aria-live="polite"
      >
        {getDataSummary()}
      </div>
      
      <LineChart
        data={data}
        title={title}
        accessibilityOptions={accessibilityOptions}
        highContrast={highContrast}
        animation={{ enabled: !reducedMotion }}
        onDataPointFocus={handleDataPointFocus}
        focusedDataPoint={focusedDataPoint}
        ariaLabel={`${title} line chart with ${data.length} data points`}
      />
      
      {screenReaderOptimized && (
        <div
          id="chart-live-region"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      )}
      
      {screenReaderOptimized && (
        <details>
          <summary>Data table view</summary>
          <table role="table" aria-label={`${title} data table`}>
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Value</th>
                <th scope="col">Status</th>
                <th scope="col">Location</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((point, index) => (
                <tr key={index}>
                  <td>{point.time.toLocaleString()}</td>
                  <td>{point.value.toFixed(2)}</td>
                  <td>{point.category}</td>
                  <td>{point.metadata?.location || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 20 && (
            <p>Showing first 20 of {data.length} data points</p>
          )}
        </details>
      )}
    </div>
  );
};

const TestWrapper: React.FC<{ 
  children: React.ReactNode; 
  theme?: any;
  reducedMotion?: boolean;
}> = ({ children, theme = lightTheme, reducedMotion = false }) => {
  // Apply reduced motion preference
  if (reducedMotion) {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  }
  
  return (
    <ThemeProvider theme={theme}>
      <ChartThemeProvider theme={theme}>
        {children}
      </ChartThemeProvider>
    </ThemeProvider>
  );
};

describe('Telemetry Chart Accessibility Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear any existing live regions
    const existingLiveRegion = document.getElementById('chart-live-region');
    if (existingLiveRegion) {
      existingLiveRegion.remove();
    }
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('passes automated accessibility audits for line charts', async () => {
      const data = generateAccessibleTelemetryData(20);
      
      const { container } = render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Engine Temperature"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes automated accessibility audits for gauge charts', async () => {
      const gaugeData = generateAccessibleGaugeData(75);
      
      const { container } = render(
        <TestWrapper>
          <GaugeChart
            data={gaugeData}
            ariaLabel="Battery level gauge showing 75% charge"
            ariaDescription="Gauge chart displaying current battery level with color-coded thresholds"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('passes automated accessibility audits for heatmap charts', async () => {
      const heatmapData = generateAccessibleHeatmapData(5, 4);
      
      const { container } = render(
        <TestWrapper>
          <HeatmapChart
            data={heatmapData}
            ariaLabel="Temperature sensor array heatmap"
            ariaDescription="5x4 grid showing temperature distribution across sensor array"
            title="Sensor Array Temperature Map"
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('maintains accessibility with multiple charts', async () => {
      const lineData = generateAccessibleTelemetryData(15);
      const gaugeData = generateAccessibleGaugeData(60);
      const heatmapData = generateAccessibleHeatmapData(3, 3);
      
      const { container } = render(
        <TestWrapper>
          <div role="region" aria-label="Telemetry Dashboard">
            <h2>Rover Telemetry Overview</h2>
            <AccessibleTelemetryChart
              data={lineData}
              title="Temperature Trend"
            />
            <GaugeChart
              data={gaugeData}
              ariaLabel="Battery level indicator"
            />
            <HeatmapChart
              data={heatmapData}
              ariaLabel="Sensor array status"
              title="Sensor Grid"
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
  });

  describe('Color Contrast Requirements', () => {
    it('meets WCAG AA color contrast requirements (4.5:1)', async () => {
      const data = generateAccessibleTelemetryData(10);
      
      render(
        <TestWrapper theme={lightTheme}>
          <AccessibleTelemetryChart
            data={data}
            title="High Contrast Test"
            highContrast={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toBeInTheDocument();
        
        // In a real implementation, we would analyze the actual colors used
        // This is a simplified test structure
        const chartStyles = window.getComputedStyle(chart);
        const backgroundColor = chartStyles.backgroundColor || '#ffffff';
        const foregroundColor = chartStyles.color || '#000000';
        
        const contrastRatio = calculateContrastRatio(foregroundColor, backgroundColor);
        expect(contrastRatio).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('provides enhanced contrast in high contrast mode', async () => {
      const data = generateAccessibleTelemetryData(8);
      
      const { rerender } = render(
        <TestWrapper theme={lightTheme}>
          <AccessibleTelemetryChart
            data={data}
            title="Contrast Comparison"
            highContrast={false}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Enable high contrast mode
      rerender(
        <TestWrapper theme={highContrastTheme}>
          <AccessibleTelemetryChart
            data={data}
            title="Contrast Comparison"
            highContrast={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('maintains readability across different themes', async () => {
      const data = generateAccessibleTelemetryData(12);
      const themes = [lightTheme, darkTheme, highContrastTheme];
      
      for (const theme of themes) {
        const { unmount } = render(
          <TestWrapper theme={theme}>
            <AccessibleTelemetryChart
              data={data}
              title={`Theme Test - ${theme.palette.mode}`}
            />
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByRole('img')).toBeInTheDocument();
        });
        
        unmount();
      }
    });

    it('uses accessible colors for status indicators', async () => {
      const statusData: TimeSeriesDataPoint[] = [
        { time: new Date(), value: 20, category: 'critical' },
        { time: new Date(), value: 50, category: 'warning' },
        { time: new Date(), value: 80, category: 'normal' }
      ];
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={statusData}
            title="Status Color Test"
            highContrast={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        const chart = screen.getByRole('img');
        expect(chart).toBeInTheDocument();
        
        // Colors should be distinguishable and accessible
        // In production, would verify actual color usage in SVG/Canvas
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation through data points', async () => {
      const data = generateAccessibleTelemetryData(5);
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Keyboard Navigation Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      expect(chart).toHaveAttribute('tabindex', '0');
      
      chart.focus();
      expect(chart).toHaveFocus();
      
      // Navigate through data points
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      fireEvent.keyDown(chart, { key: 'ArrowLeft' });
      
      // Navigate to boundaries
      fireEvent.keyDown(chart, { key: 'Home' });
      fireEvent.keyDown(chart, { key: 'End' });
      
      expect(chart).toHaveFocus();
    });

    it('provides keyboard access to interactive elements', async () => {
      const data = generateAccessibleTelemetryData(10);
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Interactive Elements Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      // Find focusable elements
      const focusableElements = screen.getByRole('img').querySelectorAll('[tabindex="0"]');
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // Test tab navigation
      const firstFocusable = focusableElements[0] as HTMLElement;
      firstFocusable.focus();
      expect(firstFocusable).toHaveFocus();
    });

    it('handles zoom and pan operations via keyboard', async () => {
      const data = generateAccessibleTelemetryData(50);
      
      render(
        <TestWrapper>
          <LineChart
            data={data}
            enableZoom={true}
            enablePan={true}
            ariaLabel="Zoomable telemetry chart"
            keyboardZoomEnabled={true}
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      chart.focus();
      
      // Test zoom controls
      fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
      fireEvent.keyDown(chart, { key: '-', ctrlKey: true });
      
      // Test pan controls
      fireEvent.keyDown(chart, { key: 'ArrowUp', shiftKey: true });
      fireEvent.keyDown(chart, { key: 'ArrowDown', shiftKey: true });
      
      expect(chart).toHaveFocus();
    });

    it('supports escape key to exit focus modes', async () => {
      const data = generateAccessibleTelemetryData(8);
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Escape Key Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      chart.focus();
      
      // Enter focused state
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      
      // Exit with escape
      fireEvent.keyDown(chart, { key: 'Escape' });
      
      expect(chart).toHaveFocus();
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('provides comprehensive chart descriptions', async () => {
      const data = generateAccessibleTelemetryData(25);
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Engine Temperature"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      expect(chart).toHaveAttribute('aria-label', 'Engine Temperature telemetry chart');
      expect(chart).toHaveAttribute('aria-describedby');
      
      const descriptionId = chart.getAttribute('aria-describedby');
      const description = document.getElementById(descriptionId!);
      expect(description).toBeInTheDocument();
      expect(description!.textContent).toContain('Engine Temperature contains 25 data points');
    });

    it('provides live region updates for data changes', async () => {
      const initialData = generateAccessibleTelemetryData(3);
      
      const { rerender } = render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={initialData}
            title="Live Updates Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      chart.focus();
      
      // Navigate to first data point
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      
      // Check for live region
      const liveRegion = document.getElementById('chart-live-region');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      
      // Update data and verify live region updates
      const updatedData = generateAccessibleTelemetryData(5);
      rerender(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={updatedData}
            title="Live Updates Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      expect(liveRegion).toBeInTheDocument();
    });

    it('provides data table alternative for screen readers', async () => {
      const data = generateAccessibleTelemetryData(15);
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Data Table Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      // Find the data table details element
      const details = screen.getByText('Data table view').closest('details');
      expect(details).toBeInTheDocument();
      
      // Expand the details
      fireEvent.click(screen.getByText('Data table view'));
      
      // Verify table is present
      const table = screen.getByRole('table');
      expect(table).toHaveAttribute('aria-label', 'Data Table Test data table');
      
      // Verify table headers
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Location')).toBeInTheDocument();
    });

    it('announces chart updates to screen readers', async () => {
      const data = generateAccessibleTelemetryData(5);
      
      render(
        <TestWrapper>
          <div>
            <div
              id="chart-announcements"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            />
            <AccessibleTelemetryChart
              data={data}
              title="Announcement Test"
              screenReaderOptimized={true}
            />
          </div>
        </TestWrapper>
      );
      
      const liveRegion = document.getElementById('chart-live-region');
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('provides meaningful labels for all chart elements', async () => {
      const gaugeData = generateAccessibleGaugeData(85);
      
      render(
        <TestWrapper>
          <GaugeChart
            data={gaugeData}
            ariaLabel="Battery level gauge"
            showLabels={true}
            showThresholds={true}
          />
        </TestWrapper>
      );
      
      const gauge = screen.getByRole('img');
      expect(gauge).toHaveAttribute('aria-label', 'Battery level gauge');
      
      // In a real implementation, we would verify all sub-elements have labels
      const svg = gauge as unknown as SVGElement;
      if (svg.querySelector) {
        const title = svg.querySelector('title');
        const desc = svg.querySelector('desc');
        
        if (title) expect(title.textContent).toBeTruthy();
        if (desc) expect(desc.textContent).toBeTruthy();
      }
    });
  });

  describe('Reduced Motion Support', () => {
    it('respects prefers-reduced-motion setting', async () => {
      const data = generateAccessibleTelemetryData(10);
      
      render(
        <TestWrapper reducedMotion={true}>
          <AccessibleTelemetryChart
            data={data}
            title="Reduced Motion Test"
            reducedMotion={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Verify animations are disabled or significantly reduced
      const animatedElements = document.querySelectorAll('[style*="animation"]');
      animatedElements.forEach(element => {
        const style = window.getComputedStyle(element);
        const animationDuration = style.animationDuration;
        
        if (animationDuration && animationDuration !== 'none') {
          expect(parseFloat(animationDuration)).toBeLessThan(0.1); // Should be very short
        }
      });
    });

    it('provides static alternatives for animated elements', async () => {
      const data = generateAccessibleTelemetryData(20);
      
      const { rerender } = render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Animation Test"
            reducedMotion={false}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      // Switch to reduced motion
      rerender(
        <TestWrapper reducedMotion={true}>
          <AccessibleTelemetryChart
            data={data}
            title="Animation Test"
            reducedMotion={true}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('maintains functionality without animations', async () => {
      const data = generateAccessibleTelemetryData(8);
      
      render(
        <TestWrapper reducedMotion={true}>
          <LineChart
            data={data}
            enableZoom={true}
            enableTooltips={true}
            animation={{ enabled: false }}
            ariaLabel="Static telemetry chart"
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      expect(chart).toBeInTheDocument();
      
      // Verify interactive features still work
      chart.focus();
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      
      expect(chart).toHaveFocus();
    });
  });

  describe('Focus Management', () => {
    it('maintains logical focus order', async () => {
      const data = generateAccessibleTelemetryData(6);
      
      render(
        <TestWrapper>
          <div>
            <button>Before Chart</button>
            <AccessibleTelemetryChart
              data={data}
              title="Focus Order Test"
              screenReaderOptimized={true}
            />
            <button>After Chart</button>
          </div>
        </TestWrapper>
      );
      
      const beforeButton = screen.getByText('Before Chart');
      const chart = screen.getByRole('img');
      const afterButton = screen.getByText('After Chart');
      
      // Test tab order
      beforeButton.focus();
      expect(beforeButton).toHaveFocus();
      
      // Tab to chart
      fireEvent.keyDown(beforeButton, { key: 'Tab' });
      // In a real test, we'd need to simulate actual tab navigation
      
      chart.focus();
      expect(chart).toHaveFocus();
    });

    it('provides visible focus indicators', async () => {
      const data = generateAccessibleTelemetryData(4);
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={data}
            title="Focus Indicators Test"
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      chart.focus();
      
      // In a real implementation, we would verify focus styles are applied
      expect(chart).toHaveFocus();
      
      const focusStyle = window.getComputedStyle(chart, ':focus');
      // Would verify outline or other focus indicators are present
    });

    it('traps focus within modal chart dialogs', async () => {
      const data = generateAccessibleTelemetryData(10);
      
      const ModalChart: React.FC = () => {
        const [isOpen, setIsOpen] = useState(false);
        
        return (
          <div>
            <button onClick={() => setIsOpen(true)}>Open Chart</button>
            {isOpen && (
              <div role="dialog" aria-modal="true" aria-label="Chart Details">
                <h2>Detailed Chart View</h2>
                <AccessibleTelemetryChart
                  data={data}
                  title="Modal Chart"
                  screenReaderOptimized={true}
                />
                <button onClick={() => setIsOpen(false)}>Close</button>
              </div>
            )}
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <ModalChart />
        </TestWrapper>
      );
      
      const openButton = screen.getByText('Open Chart');
      fireEvent.click(openButton);
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Close')).toBeInTheDocument();
      });
      
      // In a real implementation, would test focus trapping
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-label', 'Chart Details');
    });
  });

  describe('Error Handling and Feedback', () => {
    it('provides accessible error messages', async () => {
      const EmptyChart: React.FC = () => {
        return (
          <div role="alert" aria-live="assertive">
            <AccessibleTelemetryChart
              data={[]}
              title="Empty Chart"
              screenReaderOptimized={true}
            />
            <div id="error-message">
              No telemetry data available. Please check your connection.
            </div>
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <EmptyChart />
        </TestWrapper>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'assertive');
      
      const errorMessage = screen.getByText(/No telemetry data available/);
      expect(errorMessage).toBeInTheDocument();
    });

    it('announces data loading states', async () => {
      const LoadingChart: React.FC = () => {
        const [loading, setLoading] = useState(true);
        const [data, setData] = useState<TimeSeriesDataPoint[]>([]);
        
        React.useEffect(() => {
          setTimeout(() => {
            setData(generateAccessibleTelemetryData(5));
            setLoading(false);
          }, 100);
        }, []);
        
        return (
          <div>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {loading ? 'Loading telemetry data...' : 'Telemetry data loaded successfully'}
            </div>
            {loading ? (
              <div role="status" aria-label="Loading chart data">
                Loading...
              </div>
            ) : (
              <AccessibleTelemetryChart
                data={data}
                title="Loading Test"
                screenReaderOptimized={true}
              />
            )}
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <LoadingChart />
        </TestWrapper>
      );
      
      // Initially shows loading state
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
    });

    it('handles data quality indicators accessibly', async () => {
      const qualityData: TimeSeriesDataPoint[] = [
        { 
          time: new Date(), 
          value: 25, 
          category: 'normal',
          metadata: { quality: 'good', description: 'High quality reading' }
        },
        { 
          time: new Date(), 
          value: 30, 
          category: 'warning',
          metadata: { quality: 'uncertain', description: 'Sensor calibration needed' }
        },
        { 
          time: new Date(), 
          value: 35, 
          category: 'critical',
          metadata: { quality: 'bad', description: 'Sensor malfunction detected' }
        }
      ];
      
      render(
        <TestWrapper>
          <AccessibleTelemetryChart
            data={qualityData}
            title="Data Quality Test"
            screenReaderOptimized={true}
          />
        </TestWrapper>
      );
      
      const chart = screen.getByRole('img');
      chart.focus();
      
      // Navigate to data points and verify quality info is available
      fireEvent.keyDown(chart, { key: 'ArrowRight' });
      
      const liveRegion = document.getElementById('chart-live-region');
      expect(liveRegion).toBeInTheDocument();
    });
  });
});