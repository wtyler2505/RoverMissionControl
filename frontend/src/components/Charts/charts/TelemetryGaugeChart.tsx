/**
 * TelemetryGaugeChart Component
 * Advanced gauge visualization for critical telemetry metrics with:
 * - Multiple value ranges with color coding
 * - Smooth animations and transitions
 * - Alert states and threshold warnings
 * - Real-time value updates
 * - Interactive tooltips
 * - Performance optimization for 60+ FPS
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Box, Typography } from '@mui/material';
import { BaseChart } from '../base/BaseChart';
import { GaugeChartProps, GaugeDataPoint, ChartDimensions, ChartUpdateConfig } from '../types';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

// Extended interface for telemetry-specific gauge features
export interface TelemetryGaugeChartProps extends Omit<GaugeChartProps, 'data'> {
  // Data sources
  value: number;
  min?: number;
  max?: number;
  
  // Real-time streaming
  streamId?: string;
  webSocketUrl?: string;
  smoothingWindow?: number;
  updateInterval?: number;
  
  // Gauge appearance
  startAngle?: number;
  endAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  needleWidth?: number;
  needleLength?: number;
  
  // Range configuration
  ranges?: Array<{
    min: number;
    max: number;
    color: string;
    label: string;
    alertLevel?: 'normal' | 'warning' | 'critical' | 'danger';
  }>;
  
  // Thresholds and alerts
  thresholds?: Array<{
    value: number;
    label: string;
    color: string;
    alertLevel: 'warning' | 'critical' | 'danger';
    showIndicator?: boolean;
  }>;
  
  // Display options
  showValue?: boolean;
  showLabel?: boolean;
  showTicks?: boolean;
  showRangeLabels?: boolean;
  tickCount?: number;
  valueFormat?: (value: number) => string;
  
  // Animations
  animationDuration?: number;
  enablePulse?: boolean;
  pulseOnAlert?: boolean;
  
  // Performance
  renderMode?: 'svg' | 'canvas';
  levelOfDetail?: boolean;
  
  // Event handlers
  onAlertStateChange?: (alertLevel: 'normal' | 'warning' | 'critical' | 'danger') => void;
  onThresholdCrossed?: (threshold: any, direction: 'above' | 'below') => void;
  onValueChange?: (value: number, previousValue: number) => void;
}

// Internal state for gauge management
interface TelemetryGaugeState {
  currentValue: number;
  previousValue: number;
  targetValue: number;
  alertLevel: 'normal' | 'warning' | 'critical' | 'danger';
  isAnimating: boolean;
  lastUpdate: number;
  smoothedValues: number[];
}

export class TelemetryGaugeChart extends BaseChart<TelemetryGaugeChartProps> {
  private webSocket: WebSocket | null = null;
  private animationFrameId: number | null = null;
  private needleGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private valueText: d3.Selection<SVGTextElement, unknown, null, undefined> | null = null;
  
  // Gauge geometry
  private centerX = 0;
  private centerY = 0;
  private radius = 0;
  
  // Animation state
  private animationStartTime = 0;
  private animationStartValue = 0;
  private animationTargetValue = 0;
  
  // Scales
  private angleScale: d3.ScaleLinear<number, number> | null = null;
  
  constructor(props: TelemetryGaugeChartProps) {
    super(props);
    
    this.state = {
      ...this.state,
      currentValue: props.value || 0,
      previousValue: 0,
      targetValue: props.value || 0,
      alertLevel: 'normal',
      isAnimating: false,
      lastUpdate: Date.now(),
      smoothedValues: []
    } as TelemetryGaugeState;
  }

  componentDidMount() {
    super.componentDidMount();
    this.initializeStreaming();
    this.calculateGaugeGeometry();
  }

  componentDidUpdate(prevProps: TelemetryGaugeChartProps) {
    if (prevProps.value !== this.props.value) {
      this.updateValue(this.props.value);
    }
    
    super.componentDidUpdate(prevProps);
  }

  componentWillUnmount() {
    super.cleanup();
    this.cleanupStreaming();
  }

  /**
   * Initialize streaming connection if configured
   */
  private initializeStreaming() {
    const { webSocketUrl, streamId } = this.props;
    
    if (webSocketUrl && streamId) {
      this.connectWebSocket(webSocketUrl, streamId);
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private connectWebSocket(url: string, streamId: string) {
    try {
      this.webSocket = new WebSocket(url);
      
      this.webSocket.onopen = () => {
        console.log(`Connected to gauge stream: ${streamId}`);
        
        // Subscribe to specific stream
        this.webSocket?.send(JSON.stringify({
          type: 'subscribe',
          streamId: streamId
        }));
      };
      
      this.webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'data' && message.streamId === streamId) {
            this.updateValue(message.data.value);
          }
        } catch (error) {
          console.error('Error parsing gauge WebSocket message:', error);
        }
      };
      
      this.webSocket.onclose = () => {
        console.log('Gauge WebSocket connection closed');
        // Attempt reconnection
        setTimeout(() => {
          if (this.props.webSocketUrl) {
            this.connectWebSocket(this.props.webSocketUrl, streamId!);
          }
        }, 5000);
      };
      
    } catch (error) {
      console.error('Failed to connect gauge WebSocket:', error);
      this.props.onError?.(error as Error);
    }
  }

  /**
   * Calculate gauge geometry based on dimensions
   */
  private calculateGaugeGeometry() {
    const { dimensions } = this.state;
    const { width, height, margin } = dimensions;
    
    const availableWidth = width - margin.left - margin.right;
    const availableHeight = height - margin.top - margin.bottom;
    
    this.centerX = availableWidth / 2;
    this.centerY = availableHeight * 0.75; // Position gauge in lower portion
    this.radius = Math.min(availableWidth, availableHeight) * 0.35;
  }

  /**
   * Update gauge value with smooth animation
   */
  private updateValue(newValue: number) {
    const { smoothingWindow = 5, animationDuration = 500 } = this.props;
    const currentState = this.state as TelemetryGaugeState;
    
    // Apply smoothing if enabled
    let smoothedValue = newValue;
    if (smoothingWindow > 0) {
      const smoothedValues = [...currentState.smoothedValues, newValue].slice(-smoothingWindow);
      smoothedValue = smoothedValues.reduce((a, b) => a + b) / smoothedValues.length;
      
      this.setState({
        smoothedValues
      } as Partial<TelemetryGaugeState>);
    }
    
    // Check for alert level changes
    const newAlertLevel = this.calculateAlertLevel(smoothedValue);
    if (newAlertLevel !== currentState.alertLevel) {
      this.props.onAlertStateChange?.(newAlertLevel);
    }
    
    // Check for threshold crossings
    this.checkThresholds(smoothedValue, currentState.currentValue);
    
    // Update state
    this.setState({
      previousValue: currentState.currentValue,
      targetValue: smoothedValue,
      alertLevel: newAlertLevel,
      lastUpdate: Date.now()
    } as Partial<TelemetryGaugeState>);
    
    // Start animation
    this.animateToValue(smoothedValue, animationDuration);
    
    // Notify value change
    this.props.onValueChange?.(smoothedValue, currentState.currentValue);
  }

  /**
   * Calculate alert level based on ranges and thresholds
   */
  private calculateAlertLevel(value: number): 'normal' | 'warning' | 'critical' | 'danger' {
    const { ranges = [], thresholds = [] } = this.props;
    
    // Check thresholds first (highest priority)
    for (const threshold of thresholds.sort((a, b) => b.value - a.value)) {
      if (value >= threshold.value) {
        return threshold.alertLevel;
      }
    }
    
    // Check ranges
    for (const range of ranges) {
      if (value >= range.min && value <= range.max && range.alertLevel) {
        return range.alertLevel;
      }
    }
    
    return 'normal';
  }

  /**
   * Check for threshold crossings
   */
  private checkThresholds(newValue: number, previousValue: number) {
    const { thresholds = [], onThresholdCrossed } = this.props;
    
    thresholds.forEach(threshold => {
      const crossedUp = previousValue < threshold.value && newValue >= threshold.value;
      const crossedDown = previousValue > threshold.value && newValue <= threshold.value;
      
      if (crossedUp) {
        onThresholdCrossed?.(threshold, 'above');
      } else if (crossedDown) {
        onThresholdCrossed?.(threshold, 'below');
      }
    });
  }

  /**
   * Animate gauge needle to new value
   */
  private animateToValue(targetValue: number, duration: number) {
    const currentState = this.state as TelemetryGaugeState;
    
    this.animationStartTime = Date.now();
    this.animationStartValue = currentState.currentValue;
    this.animationTargetValue = targetValue;
    
    this.setState({ isAnimating: true } as Partial<TelemetryGaugeState>);
    
    const animate = () => {
      const elapsed = Date.now() - this.animationStartTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      
      const currentValue = this.animationStartValue + 
        (this.animationTargetValue - this.animationStartValue) * easeProgress;
      
      this.setState({ currentValue } as Partial<TelemetryGaugeState>);
      
      // Update needle position
      this.updateNeedle(currentValue);
      
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.setState({ 
          isAnimating: false,
          currentValue: this.animationTargetValue 
        } as Partial<TelemetryGaugeState>);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Create D3 scales
   */
  protected createScales() {
    const { min = 0, max = 100, startAngle = -90, endAngle = 90 } = this.props;
    
    // Convert angles to radians
    const startRadians = (startAngle * Math.PI) / 180;
    const endRadians = (endAngle * Math.PI) / 180;
    
    this.angleScale = d3.scaleLinear()
      .domain([min, max])
      .range([startRadians, endRadians])
      .clamp(true);
  }

  /**
   * Render the gauge chart
   */
  protected renderChart() {
    if (!this.svg) return;
    
    const renderStartTime = performance.now();
    const { dimensions } = this.state;
    const { width, height, margin } = dimensions;
    
    this.calculateGaugeGeometry();
    this.createScales();
    
    // Clear previous content
    this.svg.selectAll('*').remove();
    
    // Setup SVG
    this.svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', this.props.ariaLabel || 'Telemetry gauge chart');
    
    // Create main group
    const g = this.svg.append('g')
      .attr('transform', `translate(${margin.left + this.centerX},${margin.top + this.centerY})`);
    
    // Render gauge components
    this.renderRanges(g);
    this.renderTicks(g);
    this.renderThresholds(g);
    this.renderNeedle(g);
    this.renderCenterDot(g);
    this.renderValue(g);
    this.renderLabels(g);
    
    const renderTime = performance.now() - renderStartTime;
    this.props.onRender?.(renderTime);
  }

  /**
   * Render colored ranges on the gauge
   */
  private renderRanges(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    const { ranges = [], innerRadius = 0.7, outerRadius = 0.9 } = this.props;
    
    if (ranges.length === 0) return;
    
    const arc = d3.arc<any>()
      .innerRadius(this.radius * innerRadius)
      .outerRadius(this.radius * outerRadius)
      .startAngle(d => this.angleScale!(d.min))
      .endAngle(d => this.angleScale!(d.max));
    
    const rangeGroups = g.selectAll('.range')
      .data(ranges)
      .enter()
      .append('g')
      .attr('class', 'range');
    
    rangeGroups.append('path')
      .attr('d', arc)
      .attr('fill', d => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('opacity', 0.8);
    
    // Add range labels if enabled
    if (this.props.showRangeLabels) {
      rangeGroups.append('text')
        .attr('transform', d => {
          const angle = this.angleScale!((d.min + d.max) / 2);
          const labelRadius = this.radius * (innerRadius + outerRadius) / 2;
          const x = Math.cos(angle) * labelRadius;
          const y = Math.sin(angle) * labelRadius;
          return `translate(${x},${y})`;
        })
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('fill', '#fff')
        .text(d => d.label);
    }
  }

  /**
   * Render tick marks on the gauge
   */
  private renderTicks(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    if (!this.props.showTicks) return;
    
    const { min = 0, max = 100, tickCount = 5 } = this.props;
    const tickValues = d3.range(min, max + (max - min) / tickCount, (max - min) / tickCount);
    
    const tickGroup = g.append('g').attr('class', 'ticks');
    
    tickValues.forEach(value => {
      const angle = this.angleScale!(value);
      const tickLength = this.radius * 0.1;
      const innerRadius = this.radius * 0.85;
      
      const x1 = Math.cos(angle) * innerRadius;
      const y1 = Math.sin(angle) * innerRadius;
      const x2 = Math.cos(angle) * (innerRadius + tickLength);
      const y2 = Math.sin(angle) * (innerRadius + tickLength);
      
      // Tick line
      tickGroup.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', '#666')
        .attr('stroke-width', 2);
      
      // Tick label
      const labelRadius = innerRadius + tickLength + 15;
      const labelX = Math.cos(angle) * labelRadius;
      const labelY = Math.sin(angle) * labelRadius;
      
      tickGroup.append('text')
        .attr('x', labelX)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text(this.props.valueFormat ? this.props.valueFormat(value) : value.toString());
    });
  }

  /**
   * Render threshold indicators
   */
  private renderThresholds(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    const { thresholds = [] } = this.props;
    
    thresholds.forEach(threshold => {
      if (!threshold.showIndicator) return;
      
      const angle = this.angleScale!(threshold.value);
      const indicatorRadius = this.radius * 0.95;
      
      const x = Math.cos(angle) * indicatorRadius;
      const y = Math.sin(angle) * indicatorRadius;
      
      g.append('circle')
        .attr('cx', x)
        .attr('cy', y)
        .attr('r', 4)
        .attr('fill', threshold.color)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);
    });
  }

  /**
   * Render gauge needle
   */
  private renderNeedle(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    const { needleWidth = 4, needleLength = 0.8 } = this.props;
    const currentState = this.state as TelemetryGaugeState;
    
    this.needleGroup = g.append('g').attr('class', 'needle');
    
    const needleRadius = this.radius * needleLength;
    const angle = this.angleScale!(currentState.currentValue);
    
    // Needle path
    const needlePath = `
      M 0,-${needleWidth/2}
      L ${needleRadius},-${needleWidth/4}
      L ${needleRadius},${needleWidth/4}
      L 0,${needleWidth/2}
      Z
    `;
    
    this.needleGroup.append('path')
      .attr('d', needlePath)
      .attr('fill', this.getNeedleColor())
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .attr('transform', `rotate(${(angle * 180) / Math.PI})`);
  }

  /**
   * Update needle position
   */
  private updateNeedle(value: number) {
    if (!this.needleGroup || !this.angleScale) return;
    
    const angle = this.angleScale(value);
    
    this.needleGroup.select('path')
      .attr('transform', `rotate(${(angle * 180) / Math.PI})`)
      .attr('fill', this.getNeedleColor());
  }

  /**
   * Get needle color based on alert level
   */
  private getNeedleColor(): string {
    const { alertLevel } = this.state as TelemetryGaugeState;
    
    switch (alertLevel) {
      case 'warning': return '#ff9800';
      case 'critical': return '#f44336';
      case 'danger': return '#d32f2f';
      default: return '#333';
    }
  }

  /**
   * Render center dot
   */
  private renderCenterDot(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 8)
      .attr('fill', '#333')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);
  }

  /**
   * Render current value display
   */
  private renderValue(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    if (!this.props.showValue) return;
    
    const currentState = this.state as TelemetryGaugeState;
    const { valueFormat } = this.props;
    
    this.valueText = g.append('text')
      .attr('x', 0)
      .attr('y', this.radius * 0.3)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '24px')
      .style('font-weight', 'bold')
      .style('fill', this.getNeedleColor())
      .text(valueFormat ? valueFormat(currentState.currentValue) : currentState.currentValue.toFixed(1));
  }

  /**
   * Render labels
   */
  private renderLabels(g: d3.Selection<SVGGElement, unknown, null, undefined>) {
    if (!this.props.showLabel) return;
    
    // Main label
    g.append('text')
      .attr('x', 0)
      .attr('y', -this.radius * 0.2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(this.props.ariaLabel || 'Gauge');
    
    // Alert level indicator
    const { alertLevel } = this.state as TelemetryGaugeState;
    if (alertLevel !== 'normal') {
      g.append('text')
        .attr('x', 0)
        .attr('y', this.radius * 0.5)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', this.getNeedleColor())
        .text(alertLevel.toUpperCase());
    }
  }

  /**
   * Update chart with new configuration
   */
  protected updateChart(config: ChartUpdateConfig = { transition: true, duration: 300 }) {
    this.renderChart();
  }

  /**
   * Apply zoom transform (not applicable for gauge)
   */
  protected applyZoom(transform: any) {
    // Gauges don't typically support zoom
  }

  /**
   * Export gauge data as CSV
   */
  protected async exportCSV(filename: string): Promise<void> {
    const currentState = this.state as TelemetryGaugeState;
    const { min = 0, max = 100 } = this.props;
    
    const csvContent = [
      'metric,value,min,max,alert_level,timestamp',
      `gauge,${currentState.currentValue},${min},${max},${currentState.alertLevel},${new Date().toISOString()}`
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Export gauge data as JSON
   */
  protected async exportJSON(filename: string): Promise<void> {
    const currentState = this.state as TelemetryGaugeState;
    const { min = 0, max = 100, ranges = [], thresholds = [] } = this.props;
    
    const exportData = {
      metadata: {
        type: 'gauge',
        exportTime: new Date().toISOString(),
        min,
        max
      },
      currentValue: currentState.currentValue,
      alertLevel: currentState.alertLevel,
      ranges,
      thresholds,
      history: currentState.smoothedValues
    };
    
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Cleanup streaming resources
   */
  private cleanupStreaming() {
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}

/**
 * Functional component wrapper for the TelemetryGaugeChart
 */
export const TelemetryGaugeChartFC: React.FC<TelemetryGaugeChartProps> = (props) => {
  const chartRef = useRef<TelemetryGaugeChart>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('TelemetryGaugeChart');
  const [alertState, setAlertState] = useState<'normal' | 'warning' | 'critical' | 'danger'>('normal');
  
  useEffect(() => {
    startTracking();
    return endTracking;
  }, [startTracking, endTracking]);
  
  const handleAlertStateChange = useCallback((alertLevel: 'normal' | 'warning' | 'critical' | 'danger') => {
    setAlertState(alertLevel);
    props.onAlertStateChange?.(alertLevel);
  }, [props]);
  
  return (
    <Box 
      position="relative"
      className={`gauge-container ${alertState !== 'normal' ? `alert-${alertState}` : ''}`}
    >
      <TelemetryGaugeChart
        ref={chartRef}
        theme={theme}
        {...props}
        onAlertStateChange={handleAlertStateChange}
      />
      
      {/* Alert indicator */}
      {alertState !== 'normal' && props.pulseOnAlert && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          border={`2px solid ${
            alertState === 'warning' ? '#ff9800' :
            alertState === 'critical' ? '#f44336' : '#d32f2f'
          }`}
          borderRadius={1}
          sx={{
            animation: 'pulse 2s infinite',
            pointerEvents: 'none'
          }}
        />
      )}
      
      {/* Performance indicator for canvas mode */}
      {props.renderMode === 'canvas' && (
        <Box
          position="absolute"
          top={8}
          right={8}
          bgcolor="rgba(0,0,0,0.7)"
          color="white"
          p={0.5}
          borderRadius={1}
          fontSize="0.7rem"
        >
          <Typography variant="caption">
            {alertState.toUpperCase()}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TelemetryGaugeChart;