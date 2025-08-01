/**
 * BaseChart Component
 * Abstract base component for all D3.js charts in the mission control system
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@mui/material/styles';
import { Box, CircularProgress, Typography } from '@mui/material';
import { 
  BaseChartProps, 
  ChartDimensions, 
  ChartState,
  ExportConfig,
  ChartUpdateConfig
} from '../types';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';
import { Theme } from '../../../theme/themes';

// Default dimensions
const DEFAULT_DIMENSIONS: ChartDimensions = {
  width: 800,
  height: 400,
  margin: {
    top: 20,
    right: 80,
    bottom: 50,
    left: 70
  }
};

// Default animation config
const DEFAULT_ANIMATION = {
  enabled: true,
  duration: 300,
  easing: 'ease-in-out' as const
};

// Default tooltip config
const DEFAULT_TOOLTIP = {
  enabled: true,
  position: 'auto' as const,
  offset: { x: 10, y: 10 }
};

export abstract class BaseChart<P extends BaseChartProps = BaseChartProps> extends React.Component<P, ChartState> {
  protected svgRef = React.createRef<SVGSVGElement>();
  protected canvasRef = React.createRef<HTMLCanvasElement>();
  protected containerRef = React.createRef<HTMLDivElement>();
  protected tooltipRef = React.createRef<HTMLDivElement>();
  
  protected svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  protected canvas: CanvasRenderingContext2D | null = null;
  protected scales: Record<string, any> = {};
  protected resizeObserver: ResizeObserver | null = null;
  
  // Performance tracking
  protected renderStartTime = 0;
  protected frameId: number | null = null;

  constructor(props: P) {
    super(props);
    
    this.state = {
      isLoading: true,
      error: null,
      zoomTransform: null,
      selection: null,
      hoveredData: null,
      dimensions: this.calculateDimensions()
    };
  }

  componentDidMount() {
    this.initializeChart();
    this.setupResizeObserver();
    this.setState({ isLoading: false });
  }

  componentDidUpdate(prevProps: P) {
    if (this.shouldUpdateChart(prevProps)) {
      this.updateChart();
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  /**
   * Calculate chart dimensions based on props and container
   */
  protected calculateDimensions(): ChartDimensions {
    const { dimensions } = this.props;
    return {
      ...DEFAULT_DIMENSIONS,
      ...dimensions,
      margin: {
        ...DEFAULT_DIMENSIONS.margin,
        ...dimensions?.margin
      }
    };
  }

  /**
   * Initialize the chart (setup SVG/Canvas, scales, etc.)
   */
  protected initializeChart() {
    try {
      this.renderStartTime = performance.now();
      
      if (this.props.renderMode === 'canvas') {
        this.initializeCanvas();
      } else {
        this.initializeSVG();
      }
      
      this.createScales();
      this.renderChart();
      
      if (this.props.enableZoom) {
        this.setupZoom();
      }
      
      if (this.props.tooltip?.enabled !== false) {
        this.setupTooltip();
      }
      
      const renderTime = performance.now() - this.renderStartTime;
      this.props.onRender?.(renderTime);
    } catch (error) {
      console.error('Chart initialization error:', error);
      this.setState({ error: error as Error });
      this.props.onError?.(error as Error);
    }
  }

  /**
   * Initialize SVG element
   */
  protected initializeSVG() {
    if (!this.svgRef.current) return;
    
    const { dimensions } = this.state;
    const { width, height, margin } = dimensions;
    
    // Clear previous content
    d3.select(this.svgRef.current).selectAll('*').remove();
    
    this.svg = d3.select(this.svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', this.props.ariaLabel || 'Data visualization chart');
    
    // Create main group with margins
    this.svg.append('g')
      .attr('class', 'chart-container')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add definitions for gradients, patterns, etc.
    this.svg.append('defs').attr('class', 'chart-defs');
  }

  /**
   * Initialize Canvas element
   */
  protected initializeCanvas() {
    if (!this.canvasRef.current) return;
    
    const { dimensions } = this.state;
    const { width, height } = dimensions;
    
    const canvas = this.canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Set canvas dimensions
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    // Scale for retina displays
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    this.canvas = ctx;
  }

  /**
   * Setup resize observer for responsive behavior
   */
  protected setupResizeObserver() {
    if (!this.props.responsive || !this.containerRef.current) return;
    
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        
        if (width > 0) {
          const newDimensions = {
            ...this.state.dimensions,
            width: Math.floor(width)
          };
          
          this.setState({ dimensions: newDimensions }, () => {
            this.updateChart({ transition: false, duration: 0 });
          });
        }
      }
    });
    
    this.resizeObserver.observe(this.containerRef.current);
  }

  /**
   * Setup zoom behavior
   */
  protected setupZoom() {
    if (!this.svg || !this.props.enableZoom) return;
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on('zoom', (event) => {
        this.setState({ zoomTransform: event.transform });
        this.props.onZoom?.(event.transform);
        this.applyZoom(event.transform);
      });
    
    this.svg.call(zoom as any);
  }

  /**
   * Setup tooltip
   */
  protected setupTooltip() {
    if (!this.tooltipRef.current) return;
    
    // Style tooltip
    const tooltip = d3.select(this.tooltipRef.current)
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px 12px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('z-index', 1000);
  }

  /**
   * Show tooltip
   */
  protected showTooltip(content: string, event: MouseEvent) {
    if (!this.tooltipRef.current || this.props.tooltip?.enabled === false) return;
    
    const tooltip = d3.select(this.tooltipRef.current);
    const { offset = DEFAULT_TOOLTIP.offset } = this.props.tooltip || {};
    
    tooltip
      .html(content)
      .style('opacity', 1)
      .style('left', `${event.pageX + offset.x}px`)
      .style('top', `${event.pageY + offset.y}px`);
  }

  /**
   * Hide tooltip
   */
  protected hideTooltip() {
    if (!this.tooltipRef.current) return;
    
    d3.select(this.tooltipRef.current)
      .style('opacity', 0);
  }

  /**
   * Export chart
   */
  protected async exportChart(config: ExportConfig): Promise<void> {
    const { format, filename = `chart-${Date.now()}`, quality = 1 } = config;
    
    try {
      switch (format) {
        case 'svg':
          await this.exportSVG(filename);
          break;
        case 'png':
          await this.exportPNG(filename, quality);
          break;
        case 'csv':
          await this.exportCSV(filename);
          break;
        case 'json':
          await this.exportJSON(filename);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  }

  /**
   * Export as SVG
   */
  protected async exportSVG(filename: string) {
    if (!this.svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(this.svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.svg`;
    link.click();
    
    URL.revokeObjectURL(url);
  }

  /**
   * Export as PNG
   */
  protected async exportPNG(filename: string, quality: number) {
    if (!this.svgRef.current && !this.canvasRef.current) return;
    
    if (this.canvasRef.current) {
      // Direct canvas export
      this.canvasRef.current.toBlob((blob) => {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.png`;
        link.click();
        
        URL.revokeObjectURL(url);
      }, 'image/png', quality);
    } else if (this.svgRef.current) {
      // Convert SVG to canvas then export
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const { width, height } = this.state.dimensions;
      canvas.width = width;
      canvas.height = height;
      
      const svgData = new XMLSerializer().serializeToString(this.svgRef.current);
      const img = new Image();
      
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (!blob) return;
          
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.png`;
          link.click();
          
          URL.revokeObjectURL(url);
        }, 'image/png', quality);
      };
      
      img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
    }
  }

  /**
   * Export data as CSV
   */
  protected abstract exportCSV(filename: string): Promise<void>;

  /**
   * Export data as JSON
   */
  protected abstract exportJSON(filename: string): Promise<void>;

  /**
   * Create D3 scales
   */
  protected abstract createScales(): void;

  /**
   * Render the chart
   */
  protected abstract renderChart(): void;

  /**
   * Update the chart with new data or dimensions
   */
  protected abstract updateChart(config?: ChartUpdateConfig): void;

  /**
   * Apply zoom transform
   */
  protected abstract applyZoom(transform: any): void;

  /**
   * Check if chart should update
   */
  protected shouldUpdateChart(prevProps: P): boolean {
    return (
      prevProps.data !== this.props.data ||
      JSON.stringify(prevProps.dimensions) !== JSON.stringify(this.props.dimensions) ||
      prevProps.theme !== this.props.theme
    );
  }

  /**
   * Cleanup resources
   */
  protected cleanup() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    
    // Clear D3 selections
    if (this.svg) {
      this.svg.selectAll('*').remove();
    }
    
    // Clear canvas
    if (this.canvas && this.canvasRef.current) {
      this.canvas.clearRect(0, 0, this.canvasRef.current.width, this.canvasRef.current.height);
    }
  }

  render() {
    const { dimensions, isLoading, error } = this.state;
    const { className, renderMode = 'svg' } = this.props;
    
    if (error) {
      return (
        <Box className={className} display="flex" alignItems="center" justifyContent="center" height={dimensions.height}>
          <Typography color="error">Error rendering chart: {error.message}</Typography>
        </Box>
      );
    }
    
    if (isLoading) {
      return (
        <Box className={className} display="flex" alignItems="center" justifyContent="center" height={dimensions.height}>
          <CircularProgress />
        </Box>
      );
    }
    
    return (
      <Box ref={this.containerRef} className={className} position="relative">
        {renderMode === 'svg' ? (
          <svg ref={this.svgRef} />
        ) : (
          <canvas ref={this.canvasRef} />
        )}
        <div ref={this.tooltipRef} />
      </Box>
    );
  }
}

/**
 * Base Chart Hook Component
 * Functional component wrapper for charts using hooks
 */
export const BaseChartFC: React.FC<BaseChartProps & { chartType: string }> = (props) => {
  const muiTheme = useTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking(`Chart-${props.chartType}`);
  
  useEffect(() => {
    startTracking();
    return endTracking;
  }, [props.data, startTracking, endTracking]);
  
  // This is a placeholder - actual chart components will extend this
  return (
    <Box>
      <Typography>Base Chart Component</Typography>
    </Box>
  );
};

export default BaseChart;