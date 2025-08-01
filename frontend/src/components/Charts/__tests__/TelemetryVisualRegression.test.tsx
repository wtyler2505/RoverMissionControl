/**
 * Telemetry Chart Visual Regression Tests
 * Tests for chart appearance consistency, visual styling, and rendering accuracy
 */

import React, { useState } from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
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
  ChartDimensions,
  ThemeConfig 
} from '../types';
import { lightTheme, darkTheme, highContrastTheme } from '../../../theme/themes';

// Visual comparison utilities
interface VisualSnapshot {
  width: number;
  height: number;
  elements: ElementSnapshot[];
  styles: ComputedStyles;
  timestamp: number;
}

interface ElementSnapshot {
  tag: string;
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  bounds: DOMRect;
  children?: ElementSnapshot[];
}

interface ComputedStyles {
  colors: string[];
  fonts: string[];
  spacing: number[];
  borders: string[];
}

class VisualRegressionTester {
  private snapshots: Map<string, VisualSnapshot> = new Map();
  
  captureSnapshot(element: Element, label: string): VisualSnapshot {
    const snapshot: VisualSnapshot = {
      width: element.clientWidth,
      height: element.clientHeight,
      elements: this.captureElementTree(element),
      styles: this.extractStyles(element),
      timestamp: Date.now()
    };
    
    this.snapshots.set(label, snapshot);
    return snapshot;
  }
  
  private captureElementTree(element: Element): ElementSnapshot[] {
    const children = Array.from(element.children);
    
    return children.map(child => ({
      tag: child.tagName.toLowerCase(),
      attributes: this.getElementAttributes(child),
      computedStyles: this.getComputedStyles(child),
      bounds: child.getBoundingClientRect(),
      children: child.children.length > 0 ? this.captureElementTree(child) : undefined
    }));
  }
  
  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    Array.from(element.attributes).forEach(attr => {
      attrs[attr.name] = attr.value;
    });
    return attrs;
  }
  
  private getComputedStyles(element: Element): Record<string, string> {
    const computed = window.getComputedStyle(element);
    const relevantStyles = [
      'color', 'backgroundColor', 'fontSize', 'fontFamily', 'fontWeight',
      'width', 'height', 'margin', 'padding', 'border', 'borderRadius',
      'opacity', 'transform', 'position', 'zIndex'
    ];
    
    const styles: Record<string, string> = {};
    relevantStyles.forEach(prop => {
      styles[prop] = computed.getPropertyValue(prop);
    });
    
    return styles;
  }
  
  private extractStyles(element: Element): ComputedStyles {
    const allElements = [element, ...this.getAllDescendants(element)];
    
    const colors = new Set<string>();
    const fonts = new Set<string>();
    const spacing = new Set<number>();
    const borders = new Set<string>();
    
    allElements.forEach(el => {
      const computed = window.getComputedStyle(el);
      
      // Extract colors
      if (computed.color && computed.color !== 'rgba(0, 0, 0, 0)') {
        colors.add(computed.color);
      }
      if (computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
        colors.add(computed.backgroundColor);
      }
      
      // Extract fonts
      if (computed.fontFamily) {
        fonts.add(computed.fontFamily);
      }
      
      // Extract spacing
      ['margin', 'padding'].forEach(prop => {
        const value = computed.getPropertyValue(prop);
        if (value && value !== '0px') {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) spacing.add(numValue);
        }
      });
      
      // Extract borders
      if (computed.border && computed.border !== 'none') {
        borders.add(computed.border);
      }
    });
    
    return {
      colors: Array.from(colors),
      fonts: Array.from(fonts),
      spacing: Array.from(spacing),
      borders: Array.from(borders)
    };
  }
  
  private getAllDescendants(element: Element): Element[] {
    const descendants: Element[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      if (node !== element) {
        descendants.push(node as Element);
      }
    }
    
    return descendants;
  }
  
  compareSnapshots(label1: string, label2: string, tolerance = 0.05): VisualDiff {
    const snapshot1 = this.snapshots.get(label1);
    const snapshot2 = this.snapshots.get(label2);
    
    if (!snapshot1 || !snapshot2) {
      throw new Error(`Snapshots not found: ${label1}, ${label2}`);
    }
    
    return this.calculateDiff(snapshot1, snapshot2, tolerance);
  }
  
  private calculateDiff(snap1: VisualSnapshot, snap2: VisualSnapshot, tolerance: number): VisualDiff {
    const diff: VisualDiff = {
      dimensionsDiff: this.compareDimensions(snap1, snap2),
      colorsDiff: this.compareColors(snap1.styles.colors, snap2.styles.colors),
      fontsDiff: this.compareFonts(snap1.styles.fonts, snap2.styles.fonts),
      layoutDiff: this.compareLayout(snap1.elements, snap2.elements),
      similarityScore: 0,
      isMatch: false,
      tolerance
    };
    
    // Calculate overall similarity score
    const dimensionScore = diff.dimensionsDiff.widthDiff === 0 && diff.dimensionsDiff.heightDiff === 0 ? 1 : 0.8;
    const colorScore = diff.colorsDiff.added.length === 0 && diff.colorsDiff.removed.length === 0 ? 1 : 0.7;
    const fontScore = diff.fontsDiff.added.length === 0 && diff.fontsDiff.removed.length === 0 ? 1 : 0.9;
    const layoutScore = diff.layoutDiff.positionChanges.length === 0 ? 1 : 0.6;
    
    diff.similarityScore = (dimensionScore + colorScore + fontScore + layoutScore) / 4;
    diff.isMatch = diff.similarityScore >= (1 - tolerance);
    
    return diff;
  }
  
  private compareDimensions(snap1: VisualSnapshot, snap2: VisualSnapshot) {
    return {
      widthDiff: Math.abs(snap1.width - snap2.width),
      heightDiff: Math.abs(snap1.height - snap2.height)
    };
  }
  
  private compareColors(colors1: string[], colors2: string[]) {
    const set1 = new Set(colors1);
    const set2 = new Set(colors2);
    
    return {
      added: colors2.filter(c => !set1.has(c)),
      removed: colors1.filter(c => !set2.has(c)),
      common: colors1.filter(c => set2.has(c))
    };
  }
  
  private compareFonts(fonts1: string[], fonts2: string[]) {
    const set1 = new Set(fonts1);
    const set2 = new Set(fonts2);
    
    return {
      added: fonts2.filter(f => !set1.has(f)),
      removed: fonts1.filter(f => !set2.has(f)),
      common: fonts1.filter(f => set2.has(f))
    };
  }
  
  private compareLayout(elements1: ElementSnapshot[], elements2: ElementSnapshot[]) {
    const positionChanges: LayoutChange[] = [];
    
    // Simple comparison based on element count and positions
    if (elements1.length !== elements2.length) {
      positionChanges.push({
        type: 'count',
        expected: elements1.length,
        actual: elements2.length
      });
    }
    
    return { positionChanges };
  }
  
  getSnapshot(label: string): VisualSnapshot | undefined {
    return this.snapshots.get(label);
  }
  
  clear(): void {
    this.snapshots.clear();
  }
}

interface VisualDiff {
  dimensionsDiff: { widthDiff: number; heightDiff: number };
  colorsDiff: { added: string[]; removed: string[]; common: string[] };
  fontsDiff: { added: string[]; removed: string[]; common: string[] };
  layoutDiff: { positionChanges: LayoutChange[] };
  similarityScore: number;
  isMatch: boolean;
  tolerance: number;
}

interface LayoutChange {
  type: 'position' | 'size' | 'count';
  expected: any;
  actual: any;
}

// Test data generators for visual consistency
const generateConsistentData = (seed: number): TimeSeriesDataPoint[] => {
  const data: TimeSeriesDataPoint[] = [];
  for (let i = 0; i < 20; i++) {
    data.push({
      time: new Date(Date.now() + i * 60000),
      value: Math.sin((i + seed) / 5) * 30 + 50,
      category: i % 8 === 0 ? 'critical' : i % 4 === 0 ? 'warning' : 'normal'
    });
  }
  return data;
};

const generateConsistentGaugeData = (value: number): GaugeDataPoint => ({
  value,
  min: 0,
  max: 100,
  thresholds: [
    { value: 25, label: 'Low', color: '#ff5722' },
    { value: 50, label: 'Medium', color: '#ff9800' },
    { value: 75, label: 'High', color: '#4caf50' }
  ]
});

const generateConsistentHeatmapData = (): HeatmapDataPoint[] => {
  const data: HeatmapDataPoint[] = [];
  for (let x = 0; x < 5; x++) {
    for (let y = 0; y < 4; y++) {
      data.push({
        x,
        y,
        value: (x + 1) * (y + 1) * 10 + Math.sin(x + y) * 5
      });
    }
  }
  return data;
};

const TestWrapper: React.FC<{ 
  children: React.ReactNode; 
  theme?: any;
  dimensions?: ChartDimensions;
}> = ({ children, theme = lightTheme, dimensions }) => (
  <ThemeProvider theme={theme}>
    <ChartThemeProvider theme={theme}>
      <div style={dimensions ? { width: dimensions.width, height: dimensions.height } : undefined}>
        {children}
      </div>
    </ChartThemeProvider>
  </ThemeProvider>
);

describe('Telemetry Chart Visual Regression Tests', () => {
  const visualTester = new VisualRegressionTester();
  
  beforeEach(() => {
    jest.clearAllMocks();
    visualTester.clear();
  });

  describe('Chart Appearance Consistency', () => {
    it('maintains consistent line chart appearance across renders', async () => {
      const data = generateConsistentData(1);
      
      // Render first instance
      const { unmount: unmount1 } = render(
        <TestWrapper dimensions={{ width: 800, height: 400 }}>
          <div data-testid="chart-container-1">
            <LineChart 
              data={data}
              title="Consistency Test"
              showPoints={true}
              gridLines={true}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-container-1')).toBeInTheDocument();
      });
      
      const container1 = screen.getByTestId('chart-container-1');
      visualTester.captureSnapshot(container1, 'line-chart-render-1');
      
      unmount1();
      
      // Render second instance with identical props
      const { unmount: unmount2 } = render(
        <TestWrapper dimensions={{ width: 800, height: 400 }}>
          <div data-testid="chart-container-2">
            <LineChart 
              data={data}
              title="Consistency Test"
              showPoints={true}
              gridLines={true}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('chart-container-2')).toBeInTheDocument();
      });
      
      const container2 = screen.getByTestId('chart-container-2');
      visualTester.captureSnapshot(container2, 'line-chart-render-2');
      
      const diff = visualTester.compareSnapshots('line-chart-render-1', 'line-chart-render-2', 0.02);
      
      expect(diff.isMatch).toBe(true);
      expect(diff.similarityScore).toBeGreaterThan(0.98);
      expect(diff.dimensionsDiff.widthDiff).toBeLessThan(5);
      expect(diff.dimensionsDiff.heightDiff).toBeLessThan(5);
      
      unmount2();
    });

    it('maintains consistent gauge chart appearance', async () => {
      const gaugeData = generateConsistentGaugeData(65);
      
      const { rerender } = render(
        <TestWrapper dimensions={{ width: 300, height: 300 }}>
          <div data-testid="gauge-container">
            <GaugeChart 
              data={gaugeData}
              title="Battery Level"
              showValue={true}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('gauge-container')).toBeInTheDocument();
      });
      
      const container = screen.getByTestId('gauge-container');
      visualTester.captureSnapshot(container, 'gauge-initial');
      
      // Re-render with same props
      rerender(
        <TestWrapper dimensions={{ width: 300, height: 300 }}>
          <div data-testid="gauge-container">
            <GaugeChart 
              data={gaugeData}
              title="Battery Level"
              showValue={true}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('gauge-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(container, 'gauge-rerender');
      
      const diff = visualTester.compareSnapshots('gauge-initial', 'gauge-rerender', 0.01);
      expect(diff.isMatch).toBe(true);
      expect(diff.colorsDiff.added.length).toBe(0);
      expect(diff.colorsDiff.removed.length).toBe(0);
    });

    it('maintains consistent heatmap appearance', async () => {
      const heatmapData = generateConsistentHeatmapData();
      
      const TestComponent: React.FC = () => (
        <TestWrapper dimensions={{ width: 500, height: 400 }}>
          <div data-testid="heatmap-container">
            <HeatmapChart 
              data={heatmapData}
              title="Sensor Grid"
              colorScale="viridis"
            />
          </div>
        </TestWrapper>
      );
      
      const { unmount: unmount1 } = render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('heatmap-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('heatmap-container'), 'heatmap-1');
      unmount1();
      
      const { unmount: unmount2 } = render(<TestComponent />);
      
      await waitFor(() => {
        expect(screen.getByTestId('heatmap-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('heatmap-container'), 'heatmap-2');
      
      const diff = visualTester.compareSnapshots('heatmap-1', 'heatmap-2', 0.03);
      expect(diff.isMatch).toBe(true);
      expect(diff.similarityScore).toBeGreaterThan(0.97);
      
      unmount2();
    });
  });

  describe('Theme Consistency', () => {
    it('applies light theme consistently', async () => {
      const data = generateConsistentData(2);
      
      render(
        <TestWrapper theme={lightTheme}>
          <div data-testid="light-theme-container">
            <LineChart data={data} title="Light Theme Test" />
            <GaugeChart data={generateConsistentGaugeData(45)} />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('light-theme-container')).toBeInTheDocument();
      });
      
      const container = screen.getByTestId('light-theme-container');
      visualTester.captureSnapshot(container, 'light-theme');
      
      const snapshot = visualTester.getSnapshot('light-theme')!;
      
      // Verify light theme characteristics
      expect(snapshot.styles.colors.some(color => 
        color.includes('rgb(255, 255, 255)') || color.includes('#ffffff')
      )).toBe(true); // Should have white background
      
      expect(snapshot.styles.colors.some(color => 
        color.includes('rgb(0, 0, 0)') || color.includes('#000')
      )).toBe(true); // Should have dark text
    });

    it('applies dark theme consistently', async () => {
      const data = generateConsistentData(3);
      
      render(
        <TestWrapper theme={darkTheme}>
          <div data-testid="dark-theme-container">
            <LineChart data={data} title="Dark Theme Test" />
            <GaugeChart data={generateConsistentGaugeData(75)} />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('dark-theme-container')).toBeInTheDocument();
      });
      
      const container = screen.getByTestId('dark-theme-container');
      visualTester.captureSnapshot(container, 'dark-theme');
      
      const snapshot = visualTester.getSnapshot('dark-theme')!;
      
      // Verify dark theme characteristics
      expect(snapshot.styles.colors.some(color => 
        color.includes('rgb(18, 18, 18)') || color.includes('#121212')
      )).toBe(true); // Should have dark background
      
      expect(snapshot.styles.colors.some(color => 
        color.includes('rgb(255, 255, 255)') || color.includes('#fff')
      )).toBe(true); // Should have light text
    });

    it('applies high contrast theme consistently', async () => {
      const data = generateConsistentData(4);
      
      render(
        <TestWrapper theme={highContrastTheme}>
          <div data-testid="high-contrast-container">
            <LineChart data={data} title="High Contrast Test" />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('high-contrast-container')).toBeInTheDocument();
      });
      
      const container = screen.getByTestId('high-contrast-container');
      visualTester.captureSnapshot(container, 'high-contrast');
      
      const snapshot = visualTester.getSnapshot('high-contrast')!;
      
      // High contrast should have fewer, more distinct colors
      expect(snapshot.styles.colors.length).toBeLessThan(10);
    });

    it('maintains theme consistency across chart types', async () => {
      const lineData = generateConsistentData(5);
      const gaugeData = generateConsistentGaugeData(80);
      const heatmapData = generateConsistentHeatmapData();
      
      const themes = [
        { theme: lightTheme, name: 'light' },
        { theme: darkTheme, name: 'dark' },
        { theme: highContrastTheme, name: 'high-contrast' }
      ];
      
      for (const { theme, name } of themes) {
        const { unmount } = render(
          <TestWrapper theme={theme}>
            <div data-testid={`${name}-multi-chart`}>
              <LineChart data={lineData} title="Line Chart" />
              <GaugeChart data={gaugeData} title="Gauge Chart" />
              <HeatmapChart data={heatmapData} title="Heatmap Chart" />
            </div>
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByTestId(`${name}-multi-chart`)).toBeInTheDocument();
        });
        
        const container = screen.getByTestId(`${name}-multi-chart`);
        visualTester.captureSnapshot(container, `${name}-multi-chart`);
        
        unmount();
      }
      
      // Verify each theme produces consistent styling
      const lightSnapshot = visualTester.getSnapshot('light-multi-chart')!;
      const darkSnapshot = visualTester.getSnapshot('dark-multi-chart')!;
      const hcSnapshot = visualTester.getSnapshot('high-contrast-multi-chart')!;
      
      expect(lightSnapshot.styles.colors).not.toEqual(darkSnapshot.styles.colors);
      expect(lightSnapshot.styles.colors).not.toEqual(hcSnapshot.styles.colors);
      expect(darkSnapshot.styles.colors).not.toEqual(hcSnapshot.styles.colors);
    });
  });

  describe('Responsive Layout Consistency', () => {
    it('maintains proportions across different container sizes', async () => {
      const data = generateConsistentData(6);
      const sizes = [
        { width: 400, height: 300, name: 'small' },
        { width: 800, height: 600, name: 'medium' },
        { width: 1200, height: 900, name: 'large' }
      ];
      
      for (const size of sizes) {
        const { unmount } = render(
          <TestWrapper dimensions={size}>
            <div data-testid={`responsive-${size.name}`}>
              <ResponsiveContainer>
                {(dimensions) => (
                  <LineChart 
                    data={data}
                    dimensions={dimensions}
                    title="Responsive Test"
                  />
                )}
              </ResponsiveContainer>
            </div>
          </TestWrapper>
        );
        
        await waitFor(() => {
          expect(screen.getByTestId(`responsive-${size.name}`)).toBeInTheDocument();
        });
        
        const container = screen.getByTestId(`responsive-${size.name}`);
        visualTester.captureSnapshot(container, `responsive-${size.name}`);
        
        // Verify dimensions match expected size
        const snapshot = visualTester.getSnapshot(`responsive-${size.name}`)!;
        expect(Math.abs(snapshot.width - size.width)).toBeLessThan(20);
        expect(Math.abs(snapshot.height - size.height)).toBeLessThan(20);
        
        unmount();
      }
      
      // Verify aspect ratios are maintained
      const smallSnapshot = visualTester.getSnapshot('responsive-small')!;
      const mediumSnapshot = visualTester.getSnapshot('responsive-medium')!;
      const largeSnapshot = visualTester.getSnapshot('responsive-large')!;
      
      const smallRatio = smallSnapshot.width / smallSnapshot.height;
      const mediumRatio = mediumSnapshot.width / mediumSnapshot.height;
      const largeRatio = largeSnapshot.width / largeSnapshot.height;
      
      expect(Math.abs(smallRatio - mediumRatio)).toBeLessThan(0.1);
      expect(Math.abs(mediumRatio - largeRatio)).toBeLessThan(0.1);
    });

    it('maintains chart element scaling', async () => {
      const data = generateConsistentData(7);
      
      // Render at different sizes
      const { rerender } = render(
        <TestWrapper dimensions={{ width: 400, height: 300 }}>
          <div data-testid="scaling-container">
            <LineChart 
              data={data}
              showPoints={true}
              title="Scaling Test"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('scaling-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('scaling-container'), 'small-scale');
      
      // Resize to larger
      rerender(
        <TestWrapper dimensions={{ width: 800, height: 600 }}>
          <div data-testid="scaling-container">
            <LineChart 
              data={data}
              showPoints={true}
              title="Scaling Test"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('scaling-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('scaling-container'), 'large-scale');
      
      const smallSnapshot = visualTester.getSnapshot('small-scale')!;
      const largeSnapshot = visualTester.getSnapshot('large-scale')!;
      
      // Elements should scale proportionally
      const scaleRatio = largeSnapshot.width / smallSnapshot.width;
      expect(scaleRatio).toBeCloseTo(2, 1); // Should be approximately 2x
    });
  });

  describe('Data-Driven Visual Changes', () => {
    it('updates appearance consistently with data changes', async () => {
      const initialData = generateConsistentData(8);
      
      const TestComponent: React.FC = () => {
        const [data, setData] = useState(initialData);
        const [updateCount, setUpdateCount] = useState(0);
        
        React.useEffect(() => {
          if (updateCount < 3) {
            setTimeout(() => {
              setData(generateConsistentData(8 + updateCount));
              setUpdateCount(prev => prev + 1);
            }, 100);
          }
        }, [updateCount]);
        
        return (
          <div data-testid={`data-update-${updateCount}`}>
            <LineChart 
              data={data}
              title="Data Updates"
              animation={{ enabled: false }}
            />
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );
      
      // Capture initial state
      await waitFor(() => {
        expect(screen.getByTestId('data-update-0')).toBeInTheDocument();
      });
      visualTester.captureSnapshot(screen.getByTestId('data-update-0'), 'data-0');
      
      // Wait for updates
      await waitFor(() => {
        expect(screen.getByTestId('data-update-1')).toBeInTheDocument();
      });
      visualTester.captureSnapshot(screen.getByTestId('data-update-1'), 'data-1');
      
      await waitFor(() => {
        expect(screen.getByTestId('data-update-2')).toBeInTheDocument();
      });
      visualTester.captureSnapshot(screen.getByTestId('data-update-2'), 'data-2');
      
      // Verify visual changes are appropriate
      const diff01 = visualTester.compareSnapshots('data-0', 'data-1', 0.3);
      const diff12 = visualTester.compareSnapshots('data-1', 'data-2', 0.3);
      
      // Some visual difference expected due to data change
      expect(diff01.similarityScore).toBeLessThan(1);
      expect(diff01.similarityScore).toBeGreaterThan(0.7);
      
      expect(diff12.similarityScore).toBeLessThan(1);
      expect(diff12.similarityScore).toBeGreaterThan(0.7);
    });

    it('maintains visual consistency with threshold changes', async () => {
      const baseGaugeData = generateConsistentGaugeData(50);
      
      const { rerender } = render(
        <TestWrapper>
          <div data-testid="threshold-container">
            <GaugeChart 
              data={baseGaugeData}
              title="Threshold Test"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('threshold-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('threshold-container'), 'threshold-base');
      
      // Update with different thresholds
      const modifiedGaugeData = {
        ...baseGaugeData,
        thresholds: [
          { value: 20, label: 'Critical', color: '#f44336' },
          { value: 60, label: 'Warning', color: '#ff9800' },
          { value: 90, label: 'Good', color: '#4caf50' }
        ]
      };
      
      rerender(
        <TestWrapper>
          <div data-testid="threshold-container">
            <GaugeChart 
              data={modifiedGaugeData}
              title="Threshold Test"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('threshold-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('threshold-container'), 'threshold-modified');
      
      const diff = visualTester.compareSnapshots('threshold-base', 'threshold-modified', 0.2);
      
      // Should have visual differences in colors but maintain structure
      expect(diff.colorsDiff.added.length + diff.colorsDiff.removed.length).toBeGreaterThan(0);
      expect(diff.dimensionsDiff.widthDiff).toBeLessThan(5);
      expect(diff.dimensionsDiff.heightDiff).toBeLessThan(5);
    });
  });

  describe('Animation and Transition Consistency', () => {
    it('produces consistent end states after animations', async () => {
      const data = generateConsistentData(9);
      
      const AnimatedChart: React.FC = () => {
        const [isAnimated, setIsAnimated] = useState(false);
        
        React.useEffect(() => {
          setTimeout(() => setIsAnimated(true), 50);
        }, []);
        
        return (
          <div data-testid="animation-container">
            <LineChart 
              data={data}
              title="Animation Test"
              animation={{ 
                enabled: isAnimated, 
                duration: 100 // Short for testing
              }}
            />
          </div>
        );
      };
      
      render(
        <TestWrapper>
          <AnimatedChart />
        </TestWrapper>
      );
      
      // Wait for animation to complete
      await waitFor(() => {
        expect(screen.getByTestId('animation-container')).toBeInTheDocument();
      });
      
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for animation
      
      visualTester.captureSnapshot(screen.getByTestId('animation-container'), 'animated-end');
      
      // Compare with non-animated version
      const { unmount } = render(
        <TestWrapper>
          <div data-testid="static-container">
            <LineChart 
              data={data}
              title="Animation Test"
              animation={{ enabled: false }}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('static-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('static-container'), 'static-version');
      
      const diff = visualTester.compareSnapshots('animated-end', 'static-version', 0.05);
      expect(diff.isMatch).toBe(true); // End state should match static version
      
      unmount();
    });

    it('maintains visual consistency across animation states', async () => {
      const data = generateConsistentData(10);
      
      const { rerender } = render(
        <TestWrapper>
          <div data-testid="transition-container">
            <LineChart 
              data={data}
              title="Transition Test"
              animation={{ enabled: true, duration: 1000 }}
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('transition-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('transition-container'), 'transition-start');
      
      // Update data to trigger transition
      const newData = generateConsistentData(11);
      
      rerender(
        <TestWrapper>
          <div data-testid="transition-container">
            <LineChart 
              data={newData}
              title="Transition Test"
              animation={{ enabled: true, duration: 100 }}
            />
          </div>
        </TestWrapper>
      );
      
      // Wait for transition to complete
      await new Promise(resolve => setTimeout(resolve, 150));
      
      await waitFor(() => {
        expect(screen.getByTestId('transition-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('transition-container'), 'transition-end');
      
      const diff = visualTester.compareSnapshots('transition-start', 'transition-end', 0.3);
      
      // Should have some visual differences but maintain overall structure
      expect(diff.dimensionsDiff.widthDiff).toBeLessThan(10);
      expect(diff.dimensionsDiff.heightDiff).toBeLessThan(10);
      expect(diff.fontsDiff.added.length + diff.fontsDiff.removed.length).toBe(0);
    });
  });

  describe('Cross-Browser Visual Consistency', () => {
    it('handles different rendering modes consistently', async () => {
      const data = generateConsistentData(12);
      
      // Test SVG rendering
      const { unmount: unmountSvg } = render(
        <TestWrapper>
          <div data-testid="svg-render">
            <LineChart 
              data={data}
              renderMode="svg"
              title="SVG Render"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('svg-render')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('svg-render'), 'svg-render');
      unmountSvg();
      
      // Test Canvas rendering
      const { unmount: unmountCanvas } = render(
        <TestWrapper>
          <div data-testid="canvas-render">
            <LineChart 
              data={data}
              renderMode="canvas"
              title="Canvas Render"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('canvas-render')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('canvas-render'), 'canvas-render');
      unmountCanvas();
      
      // Both should have similar overall structure
      const diff = visualTester.compareSnapshots('svg-render', 'canvas-render', 0.2);
      expect(diff.dimensionsDiff.widthDiff).toBeLessThan(20);
      expect(diff.dimensionsDiff.heightDiff).toBeLessThan(20);
    });

    it('maintains font rendering consistency', async () => {
      const data = generateConsistentData(13);
      
      render(
        <TestWrapper>
          <div data-testid="font-container">
            <LineChart 
              data={data}
              title="Font Consistency Test"
              fontSize={14}
              fontFamily="Arial, sans-serif"
            />
          </div>
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('font-container')).toBeInTheDocument();
      });
      
      const container = screen.getByTestId('font-container');
      visualTester.captureSnapshot(container, 'font-test');
      
      const snapshot = visualTester.getSnapshot('font-test')!;
      
      // Verify font families are applied consistently
      expect(snapshot.styles.fonts.some(font => 
        font.includes('Arial') || font.includes('sans-serif')
      )).toBe(true);
    });
  });

  describe('Error State Visual Consistency', () => {
    it('renders error states consistently', async () => {
      const ErrorChart: React.FC = () => (
        <div data-testid="error-container">
          <LineChart 
            data={[]}
            title="Empty Data Test"
            showEmptyState={true}
          />
        </div>
      );
      
      const { unmount: unmount1 } = render(
        <TestWrapper>
          <ErrorChart />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('error-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('error-container'), 'error-1');
      unmount1();
      
      const { unmount: unmount2 } = render(
        <TestWrapper>
          <ErrorChart />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('error-container')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('error-container'), 'error-2');
      
      const diff = visualTester.compareSnapshots('error-1', 'error-2', 0.01);
      expect(diff.isMatch).toBe(true);
      expect(diff.similarityScore).toBeGreaterThan(0.99);
      
      unmount2();
    });

    it('handles loading states consistently', async () => {
      const LoadingChart: React.FC = () => {
        const [loading, setLoading] = useState(true);
        
        React.useEffect(() => {
          setTimeout(() => setLoading(false), 100);
        }, []);
        
        return (
          <div data-testid="loading-container">
            {loading ? (
              <div className="loading-placeholder">Loading chart...</div>
            ) : (
              <LineChart 
                data={generateConsistentData(14)}
                title="Loaded Chart"
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
      
      // Capture loading state
      expect(screen.getByText('Loading chart...')).toBeInTheDocument();
      visualTester.captureSnapshot(screen.getByTestId('loading-container'), 'loading-state');
      
      // Wait for loaded state
      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument();
      });
      
      visualTester.captureSnapshot(screen.getByTestId('loading-container'), 'loaded-state');
      
      const loadingSnapshot = visualTester.getSnapshot('loading-state')!;
      const loadedSnapshot = visualTester.getSnapshot('loaded-state')!;
      
      // Should be visually different
      expect(loadingSnapshot.width).toBeGreaterThan(0);
      expect(loadedSnapshot.width).toBeGreaterThan(0);
      expect(loadingSnapshot.elements.length).not.toBe(loadedSnapshot.elements.length);
    });
  });
});