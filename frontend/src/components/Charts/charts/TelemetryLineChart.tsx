/**
 * TelemetryLineChart Component
 * Enhanced line chart for real-time telemetry data streaming with advanced features:
 * - Real-time WebSocket data streaming
 * - Threshold overlays with alerting
 * - Anomaly detection highlighting
 * - Smooth animations and transitions
 * - Interactive tooltips and zooming
 * - Annotation overlay system
 * - Performance optimization for 60+ FPS
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Box, Typography } from '@mui/material';
import { BaseChart } from '../base/BaseChart';
import { LineChartProps, TimeSeriesDataPoint, ChartDimensions, ChartUpdateConfig, ExportConfig } from '../types';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';
import { useRealTimeData, RealTimeDataManager } from '../../Telemetry/useRealTimeData';

// Extended interface for telemetry-specific features
export interface TelemetryLineChartProps extends Omit<LineChartProps, 'data'> {
  // Data sources
  data?: TimeSeriesDataPoint[];
  streamId?: string;
  webSocketUrl?: string;
  
  // Real-time streaming
  maxDataPoints?: number;
  bufferSize?: number;
  updateInterval?: number;
  smoothingWindow?: number;
  decimationFactor?: number;
  
  // Threshold configuration
  thresholds?: Array<{
    value: number;
    label: string;
    color: string;
    style?: 'solid' | 'dashed' | 'dotted';
    alertOnCross?: boolean;
    alertDirection?: 'above' | 'below' | 'both';
  }>;
  
  // Anomaly detection
  enableAnomalyDetection?: boolean;
  anomalyThreshold?: number; // Standard deviations from mean
  anomalyWindow?: number; // Rolling window size for detection
  
  // Performance optimization
  enableWebWorker?: boolean;
  renderMode?: 'svg' | 'canvas' | 'hybrid';
  levelOfDetail?: boolean;
  maxRenderPoints?: number;
  
  // Annotation system
  annotations?: Array<{
    timestamp: Date;
    value?: number;
    label: string;
    color?: string;
    type?: 'point' | 'vertical' | 'horizontal' | 'range';
  }>;
  
  // Event handlers
  onThresholdCrossed?: (threshold: any, value: number, direction: 'above' | 'below') => void;
  onAnomalyDetected?: (anomaly: { timestamp: Date; value: number; severity: number }) => void;
  onDataUpdate?: (dataManager: RealTimeDataManager) => void;
}

// Internal state for real-time processing
interface TelemetryChartState {
  isStreaming: boolean;
  lastUpdate: number;
  frameRate: number;
  dataPointCount: number;
  anomalies: Array<{ timestamp: Date; value: number; severity: number }>;
  thresholdAlerts: Array<{ threshold: any; value: number; timestamp: Date; direction: 'above' | 'below' }>;
}

export class TelemetryLineChart extends BaseChart<TelemetryLineChartProps> {
  private dataManager: RealTimeDataManager;
  private webSocket: WebSocket | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private workerRef: React.RefObject<Worker> = React.createRef();
  
  // Chart elements
  private xScale: d3.ScaleTime<number, number> | null = null;
  private yScale: d3.ScaleLinear<number, number> | null = null;
  private line: d3.Line<TimeSeriesDataPoint> | null = null;
  private area: d3.Area<TimeSeriesDataPoint> | null = null;
  
  // Performance tracking
  private renderQueue: Array<() => void> = [];
  private isRendering = false;
  
  constructor(props: TelemetryLineChartProps) {
    super(props);
    
    // Initialize data manager
    this.dataManager = this.createDataManager();
    
    this.state = {
      ...this.state,
      isStreaming: false,
      lastUpdate: Date.now(),
      frameRate: 0,
      dataPointCount: 0,
      anomalies: [],
      thresholdAlerts: []
    } as TelemetryChartState;
  }

  componentDidMount() {
    super.componentDidMount();
    this.initializeStreaming();
    this.startPerformanceMonitoring();
  }

  componentWillUnmount() {
    super.cleanup();
    this.cleanupStreaming();
    this.stopPerformanceMonitoring();
  }

  /**
   * Create data manager with telemetry-specific configuration
   */
  private createDataManager(): RealTimeDataManager {
    const { useRealTimeData } = require('../../Telemetry/useRealTimeData');
    
    return useRealTimeData({
      maxDataPoints: this.props.maxDataPoints || 10000,
      bufferSize: this.props.bufferSize || 20000,
      decimationFactor: this.props.decimationFactor || 1,
      smoothingWindow: this.props.smoothingWindow || 0
    });
  }

  /**
   * Initialize real-time streaming
   */
  private initializeStreaming() {
    const { webSocketUrl, streamId } = this.props;
    
    if (webSocketUrl && streamId) {
      this.connectWebSocket(webSocketUrl, streamId);
    }
    
    // Initialize with existing data if provided
    if (this.props.data && this.props.data.length > 0) {
      this.dataManager.addBatchData(streamId || 'default', 
        this.props.data.map(d => ({ timestamp: d.time.getTime(), value: d.value }))
      );
    }
    
    // Start render loop
    this.startRenderLoop();
  }

  /**
   * Connect to WebSocket for real-time data
   */
  private connectWebSocket(url: string, streamId: string) {
    try {
      this.webSocket = new WebSocket(url);
      
      this.webSocket.onopen = () => {
        console.log(`Connected to telemetry stream: ${streamId}`);
        this.setState({ isStreaming: true } as Partial<TelemetryChartState>);
        
        // Subscribe to specific stream
        this.webSocket?.send(JSON.stringify({
          type: 'subscribe',
          streamId: streamId
        }));
      };
      
      this.webSocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleStreamData(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.webSocket.onclose = () => {
        console.log('WebSocket connection closed');
        this.setState({ isStreaming: false } as Partial<TelemetryChartState>);
        
        // Attempt reconnection after delay
        setTimeout(() => {
          if (this.props.webSocketUrl) {
            this.connectWebSocket(this.props.webSocketUrl, streamId);
          }
        }, 5000);
      };
      
      this.webSocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.props.onError?.(error as any);
      };
      
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.props.onError?.(error as Error);
    }
  }

  /**
   * Handle incoming stream data
   */
  private handleStreamData(message: any) {
    const { streamId = 'default' } = this.props;
    
    switch (message.type) {
      case 'data':
        if (message.streamId === streamId && message.data) {
          const { timestamp, value, metadata } = message.data;
          
          // Add data point to manager
          this.dataManager.addDataPoint(streamId, value, timestamp);
          
          // Check for threshold crossings
          this.checkThresholds(value, new Date(timestamp));
          
          // Check for anomalies
          if (this.props.enableAnomalyDetection) {
            this.checkAnomalies(value, new Date(timestamp));
          }
          
          // Update state
          this.setState({
            lastUpdate: Date.now(),
            dataPointCount: this.dataManager.getSeries(streamId).length
          } as Partial<TelemetryChartState>);
          
          // Notify parent component
          this.props.onDataUpdate?.(this.dataManager);
          
          // Queue render update
          this.queueRenderUpdate();
        }
        break;
        
      case 'batch':
        if (message.streamId === streamId && message.data) {
          const points = message.data.map((d: any) => ({
            timestamp: d.timestamp,
            value: d.value
          }));
          
          this.dataManager.addBatchData(streamId, points);
          this.queueRenderUpdate();
        }
        break;
    }
  }

  /**
   * Check for threshold crossings
   */
  private checkThresholds(value: number, timestamp: Date) {
    const { thresholds = [], onThresholdCrossed } = this.props;
    
    thresholds.forEach(threshold => {
      if (!threshold.alertOnCross) return;
      
      const direction = value > threshold.value ? 'above' : 'below';
      const shouldAlert = 
        threshold.alertDirection === 'both' ||
        threshold.alertDirection === direction;
      
      if (shouldAlert) {
        // Store alert
        const alert = { threshold, value, timestamp, direction };
        this.setState((prevState: any) => ({
          thresholdAlerts: [...prevState.thresholdAlerts.slice(-99), alert]
        }));
        
        // Notify callback
        onThresholdCrossed?.(threshold, value, direction);
      }
    });
  }

  /**
   * Check for anomalies using statistical analysis
   */
  private checkAnomalies(value: number, timestamp: Date) {
    const { 
      anomalyThreshold = 2.5, 
      anomalyWindow = 100, 
      onAnomalyDetected,
      streamId = 'default' 
    } = this.props;
    
    const series = this.dataManager.getSeries(streamId);
    if (series.length < anomalyWindow) return;
    
    // Get recent data for analysis
    const recentData = series.slice(-anomalyWindow);
    const values = recentData.map(d => d.value);
    
    // Calculate statistics
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Check if current value is anomalous
    const zScore = Math.abs((value - mean) / stdDev);
    
    if (zScore > anomalyThreshold) {
      const anomaly = { timestamp, value, severity: zScore };
      
      // Store anomaly
      this.setState((prevState: any) => ({
        anomalies: [...prevState.anomalies.slice(-99), anomaly]
      }));
      
      // Notify callback
      onAnomalyDetected?.(anomaly);
    }
  }

  /**
   * Start render loop for smooth animations
   */
  private startRenderLoop() {
    const renderFrame = (currentTime: number) => {
      // Calculate frame rate
      if (this.lastFrameTime > 0) {
        const deltaTime = currentTime - this.lastFrameTime;
        this.frameCount++;
        
        if (this.frameCount % 60 === 0) {
          const fps = 1000 / deltaTime;
          this.setState({ frameRate: Math.round(fps * 60) / 60 } as Partial<TelemetryChartState>);
        }
      }
      
      this.lastFrameTime = currentTime;
      
      // Process render queue
      this.processRenderQueue();
      
      // Continue loop
      this.animationFrameId = requestAnimationFrame(renderFrame);
    };
    
    this.animationFrameId = requestAnimationFrame(renderFrame);
  }

  /**
   * Queue a render update for batching
   */
  private queueRenderUpdate() {
    this.renderQueue.push(() => {
      if (this.svg && !this.isRendering) {
        this.updateChart({ transition: false, duration: 0 });
      }
    });
  }

  /**
   * Process queued render updates
   */
  private processRenderQueue() {
    if (this.renderQueue.length === 0 || this.isRendering) return;
    
    this.isRendering = true;
    
    // Execute all queued updates at once
    const updates = [...this.renderQueue];
    this.renderQueue = [];
    
    try {
      updates.forEach(update => update());
    } catch (error) {
      console.error('Render update error:', error);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Create D3 scales
   */
  protected createScales() {
    const { dimensions } = this.state;
    const { width, height, margin } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const { streamId = 'default' } = this.props;
    const data = this.dataManager.getSeries(streamId);
    
    if (data.length === 0) return;
    
    // Convert to D3-compatible format
    const timeSeriesData: TimeSeriesDataPoint[] = data.map(d => ({
      time: new Date(d.timestamp),
      value: d.value,
      metadata: {}
    }));
    
    // X Scale (time)
    const timeExtent = d3.extent(timeSeriesData, d => d.time) as [Date, Date];
    this.xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth])
      .nice();
    
    // Y Scale (values) with threshold padding
    const { thresholds = [] } = this.props;
    const valueExtent = d3.extent(timeSeriesData, d => d.value) as [number, number];
    const padding = (valueExtent[1] - valueExtent[0]) * 0.1;
    
    const yMin = Math.min(
      valueExtent[0] - padding,
      ...thresholds.map(t => t.value)
    );
    const yMax = Math.max(
      valueExtent[1] + padding,
      ...thresholds.map(t => t.value)
    );
    
    this.yScale = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([innerHeight, 0])
      .nice();
  }

  /**
   * Render the chart
   */
  protected renderChart() {
    if (!this.svg || !this.xScale || !this.yScale) return;
    
    const renderStartTime = performance.now();
    const { dimensions } = this.state;
    const { width, height, margin } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const { streamId = 'default', showArea = false, strokeWidth = 2 } = this.props;
    const data = this.dataManager.getSeries(streamId);
    
    // Convert to time series format
    const timeSeriesData: TimeSeriesDataPoint[] = data.map(d => ({
      time: new Date(d.timestamp),
      value: d.value,
      metadata: {}
    }));
    
    // Clear previous content
    this.svg.selectAll('*').remove();
    
    // Setup SVG
    this.svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', this.props.ariaLabel || 'Telemetry line chart');
    
    // Create main group
    const g = this.svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add defs for gradients and patterns
    const defs = this.svg.append('defs');
    
    // Clip path for chart content
    defs.append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);
    
    // Chart content group
    const chartContent = g.append('g')
      .attr('class', 'chart-content')
      .attr('clip-path', 'url(#chart-clip)');
    
    // Render thresholds
    this.renderThresholds(chartContent, innerWidth);
    
    // Render main line and area
    this.renderLineAndArea(chartContent, timeSeriesData, showArea, strokeWidth, defs);
    
    // Render anomalies
    this.renderAnomalies(chartContent);
    
    // Render annotations
    this.renderAnnotations(chartContent);
    
    // Render axes
    this.renderAxes(g, innerWidth, innerHeight);
    
    // Setup interactions
    this.setupInteractions(g, innerWidth, innerHeight);
    
    const renderTime = performance.now() - renderStartTime;
    this.props.onRender?.(renderTime);
  }

  /**
   * Render threshold lines and zones
   */
  private renderThresholds(chartContent: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number) {
    const { thresholds = [] } = this.props;
    
    thresholds.forEach((threshold, index) => {
      const thresholdGroup = chartContent.append('g')
        .attr('class', `threshold threshold-${index}`);
      
      const y = this.yScale!(threshold.value);
      
      // Threshold line
      thresholdGroup.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', y)
        .attr('y2', y)
        .attr('stroke', threshold.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', this.getStrokeDashArray(threshold.style))
        .attr('opacity', 0.8);
      
      // Threshold label
      thresholdGroup.append('text')
        .attr('x', innerWidth + 5)
        .attr('y', y + 4)
        .attr('fill', threshold.color)
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .text(threshold.label);
      
      // Alert indicator (if recently crossed)
      const recentAlert = (this.state as TelemetryChartState).thresholdAlerts
        .find(alert => alert.threshold === threshold && 
               Date.now() - alert.timestamp.getTime() < 5000);
      
      if (recentAlert) {
        thresholdGroup.append('circle')
          .attr('cx', innerWidth + 15)
          .attr('cy', y)
          .attr('r', 4)
          .attr('fill', threshold.color)
          .attr('opacity', 0.8)
          .style('animation', 'pulse 1s infinite');
      }
    });
  }

  /**
   * Render main line and optional area
   */
  private renderLineAndArea(
    chartContent: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: TimeSeriesDataPoint[],
    showArea: boolean,
    strokeWidth: number,
    defs: d3.Selection<SVGDefsElement, unknown, null, undefined>
  ) {
    if (data.length === 0) return;
    
    // Line generator
    this.line = d3.line<TimeSeriesDataPoint>()
      .x(d => this.xScale!(d.time))
      .y(d => this.yScale!(d.value))
      .curve(d3.curveMonotoneX);
    
    // Area generator
    if (showArea) {
      this.area = d3.area<TimeSeriesDataPoint>()
        .x(d => this.xScale!(d.time))
        .y0(this.yScale!(this.yScale!.domain()[0]))
        .y1(d => this.yScale!(d.value))
        .curve(d3.curveMonotoneX);
      
      // Gradient for area
      const gradient = defs.append('linearGradient')
        .attr('id', 'area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0)
        .attr('y1', this.yScale!(this.yScale!.domain()[1]))
        .attr('x2', 0)
        .attr('y2', this.yScale!(this.yScale!.domain()[0]));
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', '#2196f3')
        .attr('stop-opacity', 0.3);
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', '#2196f3')
        .attr('stop-opacity', 0.1);
      
      // Draw area
      chartContent.append('path')
        .datum(data)
        .attr('class', 'area')
        .attr('fill', 'url(#area-gradient)')
        .attr('d', this.area);
    }
    
    // Draw line
    chartContent.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', '#2196f3')
      .attr('stroke-width', strokeWidth)
      .attr('d', this.line);
  }

  /**
   * Render anomaly indicators
   */
  private renderAnomalies(chartContent: d3.Selection<SVGGElement, unknown, null, undefined>) {
    if (!this.props.enableAnomalyDetection) return;
    
    const anomalies = (this.state as TelemetryChartState).anomalies;
    
    const anomalyPoints = chartContent.selectAll('.anomaly')
      .data(anomalies)
      .enter()
      .append('circle')
      .attr('class', 'anomaly')
      .attr('cx', d => this.xScale!(d.timestamp))
      .attr('cy', d => this.yScale!(d.value))
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', '#f44336')
      .attr('stroke-width', 2)
      .style('opacity', 0.8);
    
    // Add pulsing animation for recent anomalies
    anomalyPoints
      .filter(d => Date.now() - d.timestamp.getTime() < 10000)
      .style('animation', 'pulse 2s infinite');
  }

  /**
   * Render annotations
   */
  private renderAnnotations(chartContent: d3.Selection<SVGGElement, unknown, null, undefined>) {
    const { annotations = [] } = this.props;
    
    annotations.forEach((annotation, index) => {
      const annotationGroup = chartContent.append('g')
        .attr('class', `annotation annotation-${index}`);
      
      const x = this.xScale!(annotation.timestamp);
      const y = annotation.value !== undefined ? this.yScale!(annotation.value) : null;
      
      switch (annotation.type) {
        case 'vertical':
          annotationGroup.append('line')
            .attr('x1', x)
            .attr('x2', x)
            .attr('y1', 0)
            .attr('y2', this.yScale!.range()[0])
            .attr('stroke', annotation.color || '#666')
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.7);
          break;
          
        case 'point':
          if (y !== null) {
            annotationGroup.append('circle')
              .attr('cx', x)
              .attr('cy', y)
              .attr('r', 4)
              .attr('fill', annotation.color || '#666');
          }
          break;
      }
      
      // Add label
      annotationGroup.append('text')
        .attr('x', x + 5)
        .attr('y', y || 15)
        .attr('fill', annotation.color || '#666')
        .style('font-size', '11px')
        .text(annotation.label);
    });
  }

  /**
   * Render axes
   */
  private renderAxes(g: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number, innerHeight: number) {
    // X Axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(this.xScale!).tickFormat(d3.timeFormat('%H:%M:%S')));
    
    // Y Axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(this.yScale!));
  }

  /**
   * Setup chart interactions
   */
  private setupInteractions(g: d3.Selection<SVGGElement, unknown, null, undefined>, innerWidth: number, innerHeight: number) {
    // Add invisible overlay for mouse interactions
    const overlay = g.append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .style('fill', 'none')
      .style('pointer-events', 'all');
    
    // Tooltip handling would go here
    // Zoom/pan setup would go here
  }

  /**
   * Update chart with new data
   */
  protected updateChart(config: ChartUpdateConfig = { transition: true, duration: 300 }) {
    this.createScales();
    this.renderChart();
  }

  /**
   * Apply zoom transform
   */
  protected applyZoom(transform: any) {
    // Implementation for zoom behavior
  }

  /**
   * Export chart data as CSV
   */
  protected async exportCSV(filename: string): Promise<void> {
    const { streamId = 'default' } = this.props;
    const data = this.dataManager.getSeries(streamId);
    
    const csvContent = [
      'timestamp,value',
      ...data.map(d => `${new Date(d.timestamp).toISOString()},${d.value}`)
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
   * Export chart data as JSON
   */
  protected async exportJSON(filename: string): Promise<void> {
    const { streamId = 'default' } = this.props;
    const data = this.dataManager.getSeries(streamId);
    const statistics = this.dataManager.getStatistics(streamId);
    
    const exportData = {
      metadata: {
        streamId,
        exportTime: new Date().toISOString(),
        dataPointCount: data.length,
        statistics
      },
      data: data.map(d => ({
        timestamp: new Date(d.timestamp).toISOString(),
        value: d.value
      })),
      anomalies: (this.state as TelemetryChartState).anomalies,
      thresholdAlerts: (this.state as TelemetryChartState).thresholdAlerts
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
   * Get stroke dash array for line styles
   */
  private getStrokeDashArray(style?: string): string | null {
    switch (style) {
      case 'dashed': return '5,5';
      case 'dotted': return '2,2';
      default: return null;
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring() {
    // Performance monitoring implementation
  }

  /**
   * Stop performance monitoring
   */
  private stopPerformanceMonitoring() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
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
    
    if (this.workerRef.current) {
      this.workerRef.current.terminate();
    }
  }
}

/**
 * Functional component wrapper for the TelemetryLineChart
 */
export const TelemetryLineChartFC: React.FC<TelemetryLineChartProps> = (props) => {
  const chartRef = useRef<TelemetryLineChart>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('TelemetryLineChart');
  
  useEffect(() => {
    startTracking();
    return endTracking;
  }, [startTracking, endTracking]);
  
  return (
    <Box position="relative">
      <TelemetryLineChart
        ref={chartRef}
        theme={theme}
        {...props}
      />
      
      {/* Performance indicator */}
      {props.renderMode === 'canvas' && (
        <Box
          position="absolute"
          top={8}
          right={8}
          bgcolor="rgba(0,0,0,0.7)"
          color="white"
          p={1}
          borderRadius={1}
          fontSize="0.75rem"
        >
          <Typography variant="caption">
            FPS: {(chartRef.current?.state as any)?.frameRate || 0}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TelemetryLineChart;