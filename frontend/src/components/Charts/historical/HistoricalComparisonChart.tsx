/**
 * HistoricalComparisonChart Component
 * Advanced chart component for comparing current telemetry data with historical baselines
 * Supports overlay, side-by-side, difference, and statistical visualization modes
 */

import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Box, Typography, Paper, Alert, CircularProgress } from '@mui/material';
import { BaseChart } from '../base/BaseChart';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

import {
  HistoricalComparisonChartProps,
  ComparisonMode,
  ComparisonDataset,
  HistoricalDataPoint,
  ComparisonStatistics,
  AlignmentConfig,
  LoadingState,
  DEFAULT_COMPARISON_COLORS
} from './types';

// Extended state interface for comparison functionality
interface ComparisonChartState {
  currentMode: ComparisonMode;
  datasets: ComparisonDataset[];
  statistics: ComparisonStatistics | null;
  alignment: AlignmentConfig;
  isCalculatingStatistics: boolean;
  memoryUsage: number;
  renderingMode: 'overview' | 'detailed';
  zoomState: {
    x: [Date, Date];
    y: [number, number];
  } | null;
}

export class HistoricalComparisonChart extends BaseChart<HistoricalComparisonChartProps> {
  private comparisonState: ComparisonChartState;
  private statisticsWorker: Worker | null = null;
  private renderCache: Map<string, any> = new Map();
  private memoryMonitor: any = null;
  
  // D3 scales for different modes
  private xScales: Map<string, d3.ScaleTime<number, number>> = new Map();
  private yScales: Map<string, d3.ScaleLinear<number, number>> = new Map();
  private colorScale: d3.ScaleOrdinal<string, string> | null = null;
  
  // Chart elements
  private chartGroups: Map<string, d3.Selection<SVGGElement, unknown, null, undefined>> = new Map();
  private legendGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  private tooltipDiv: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null = null;

  constructor(props: HistoricalComparisonChartProps) {
    super(props);
    
    this.comparisonState = {
      currentMode: props.mode,
      datasets: props.datasets || [],
      statistics: null,
      alignment: props.alignment,
      isCalculatingStatistics: false,
      memoryUsage: 0,
      renderingMode: 'overview',
      zoomState: null
    };
    
    this.state = {
      ...this.state,
      ...this.comparisonState
    };
  }

  componentDidMount() {
    super.componentDidMount();
    this.initializeComparison();
    this.startMemoryMonitoring();
    this.calculateStatistics();
  }

  componentDidUpdate(prevProps: HistoricalComparisonChartProps) {
    super.componentDidUpdate(prevProps);
    
    if (prevProps.mode !== this.props.mode) {
      this.handleModeChange(this.props.mode);
    }
    
    if (prevProps.datasets !== this.props.datasets) {
      this.updateDatasets(this.props.datasets);
    }
    
    if (prevProps.alignment !== this.props.alignment) {
      this.updateAlignment(this.props.alignment);
    }
  }

  componentWillUnmount() {
    super.cleanup();
    this.cleanupComparison();
  }

  /**
   * Initialize comparison functionality
   */
  private initializeComparison() {
    // Initialize Web Worker for statistical calculations
    if (typeof Worker !== 'undefined') {
      try {
        this.statisticsWorker = new Worker('/workers/statisticsWorker.js');
        this.statisticsWorker.onmessage = this.handleWorkerMessage.bind(this);
        this.statisticsWorker.onerror = (error) => {
          console.warn('Statistics worker error:', error);
          this.statisticsWorker = null;
        };
      } catch (error) {
        console.warn('Failed to initialize statistics worker:', error);
      }
    }
    
    // Initialize tooltip
    this.tooltipDiv = d3.select('body')
      .append('div')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');
    
    // Initialize color scale
    this.colorScale = d3.scaleOrdinal<string, string>()
      .domain(['current', ...this.props.datasets.map(d => d.id)])
      .range([
        DEFAULT_COMPARISON_COLORS.current,
        ...DEFAULT_COMPARISON_COLORS.historical
      ]);
  }

  /**
   * Handle mode changes
   */
  private handleModeChange(newMode: ComparisonMode) {
    this.setState({ currentMode: newMode } as Partial<ComparisonChartState>);
    this.clearRenderCache();
    this.updateChart({ transition: true, duration: 500 });
    this.props.onModeChange?.(newMode);
  }

  /**
   * Update datasets with new data
   */
  private updateDatasets(newDatasets: ComparisonDataset[]) {
    this.setState({ datasets: newDatasets } as Partial<ComparisonChartState>);
    this.clearRenderCache();
    this.calculateStatistics();
    this.updateChart({ transition: true, duration: 300 });
  }

  /**
   * Update alignment configuration
   */
  private updateAlignment(newAlignment: AlignmentConfig) {
    this.setState({ alignment: newAlignment } as Partial<ComparisonChartState>);
    this.alignDatasets();
    this.updateChart({ transition: true, duration: 400 });
    this.props.onAlignmentChange?.(newAlignment);
  }

  /**
   * Align datasets based on alignment configuration
   */
  private async alignDatasets() {
    const { alignment } = this.state as ComparisonChartState;
    const { datasets } = this.props;
    
    if (!datasets || datasets.length === 0) return;
    
    try {
      const alignedDatasets = await this.performAlignment(datasets, alignment);
      this.setState({ datasets: alignedDatasets } as Partial<ComparisonChartState>);
    } catch (error) {
      console.error('Failed to align datasets:', error);
    }
  }

  /**
   * Perform dataset alignment
   */
  private async performAlignment(
    datasets: ComparisonDataset[],
    alignment: AlignmentConfig
  ): Promise<ComparisonDataset[]> {
    return datasets.map(dataset => {
      const alignedData = dataset.data.map(point => {
        let alignedTimestamp: Date;
        
        switch (alignment.mode) {
          case 'absolute':
            alignedTimestamp = point.time;
            break;
            
          case 'relative':
            const referenceTime = alignment.referencePoint || dataset.period.startTime;
            const offset = point.time.getTime() - dataset.period.startTime.getTime();
            alignedTimestamp = new Date(referenceTime.getTime() + offset);
            break;
            
          case 'phase':
            const phaseOffset = alignment.phaseOffset || 0;
            alignedTimestamp = new Date(point.time.getTime() + phaseOffset);
            break;
            
          default:
            alignedTimestamp = point.time;
        }
        
        return {
          ...point,
          alignedTimestamp,
          originalTimestamp: point.time
        } as HistoricalDataPoint;
      });
      
      return {
        ...dataset,
        data: alignedData
      };
    });
  }

  /**
   * Calculate statistics for comparison
   */
  private async calculateStatistics() {
    if (this.props.datasets.length === 0) return;
    
    this.setState({ isCalculatingStatistics: true } as Partial<ComparisonChartState>);
    
    try {
      const statistics = await this.computeComparisonStatistics();
      this.setState({ 
        statistics,
        isCalculatingStatistics: false 
      } as Partial<ComparisonChartState>);
      
      this.props.onStatisticsUpdate?.(statistics);
    } catch (error) {
      console.error('Failed to calculate statistics:', error);
      this.setState({ isCalculatingStatistics: false } as Partial<ComparisonChartState>);
    }
  }

  /**
   * Compute comparison statistics
   */
  private async computeComparisonStatistics(): Promise<ComparisonStatistics> {
    const { currentData, datasets } = this.props;
    
    // Calculate statistics for current data
    const currentStats = this.calculateDatasetStatistics(
      currentData.map(d => ({ ...d, historicalPeriod: 'current', originalTimestamp: d.time, alignedTimestamp: d.time }))
    );
    
    // Calculate statistics for historical datasets
    const historicalStats: Record<string, any> = {};
    const correlations: Record<string, number> = {};
    const differences: Record<string, any> = {};
    
    for (const dataset of datasets) {
      const stats = this.calculateDatasetStatistics(dataset.data);
      historicalStats[dataset.id] = stats;
      
      // Calculate correlation with current data
      correlations[dataset.id] = this.calculateCorrelation(currentData, dataset.data);
      
      // Calculate differences
      differences[dataset.id] = {
        absolute: this.calculateAbsoluteDifference(currentStats, stats),
        relative: this.calculateRelativeDifference(currentStats, stats)
      };
    }
    
    // Calculate confidence intervals
    const confidenceIntervals: Record<string, any> = {};
    for (const dataset of datasets) {
      confidenceIntervals[dataset.id] = this.calculateConfidenceInterval(dataset.data);
    }
    
    return {
      current: currentStats,
      historical: historicalStats,
      correlations,
      differences,
      confidenceIntervals
    };
  }

  /**
   * Calculate statistics for a dataset
   */
  private calculateDatasetStatistics(data: HistoricalDataPoint[]): any {
    if (data.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stddev: 0,
        variance: 0,
        percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 }
      };
    }
    
    const values = data.map(d => d.value).sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const mean = values.reduce((sum, val) => sum + val, 0) / count;
    const median = count % 2 === 0 
      ? (values[count / 2 - 1] + values[count / 2]) / 2
      : values[Math.floor(count / 2)];
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const stddev = Math.sqrt(variance);
    
    const percentiles = {
      p25: this.percentile(values, 0.25),
      p50: median,
      p75: this.percentile(values, 0.75),
      p90: this.percentile(values, 0.90),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
    
    return {
      count,
      min,
      max,
      mean,
      median,
      stddev,
      variance,
      percentiles
    };
  }

  /**
   * Calculate percentile value
   */
  private percentile(sortedArray: number[], p: number): number {
    const index = p * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate correlation between datasets
   */
  private calculateCorrelation(current: any[], historical: HistoricalDataPoint[]): number {
    // Simplified correlation calculation
    // In production, this would be more sophisticated with proper time alignment
    if (current.length === 0 || historical.length === 0) return 0;
    
    const minLength = Math.min(current.length, historical.length);
    const currentValues = current.slice(0, minLength).map(d => d.value);
    const historicalValues = historical.slice(0, minLength).map(d => d.value);
    
    const meanCurrent = currentValues.reduce((a, b) => a + b) / currentValues.length;
    const meanHistorical = historicalValues.reduce((a, b) => a + b) / historicalValues.length;
    
    let numerator = 0;
    let sumCurrentSq = 0;
    let sumHistoricalSq = 0;
    
    for (let i = 0; i < minLength; i++) {
      const currentDiff = currentValues[i] - meanCurrent;
      const historicalDiff = historicalValues[i] - meanHistorical;
      
      numerator += currentDiff * historicalDiff;
      sumCurrentSq += currentDiff * currentDiff;
      sumHistoricalSq += historicalDiff * historicalDiff;
    }
    
    const denominator = Math.sqrt(sumCurrentSq * sumHistoricalSq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate absolute difference between statistics
   */
  private calculateAbsoluteDifference(current: any, historical: any): any {
    return {
      count: Math.abs(current.count - historical.count),
      min: Math.abs(current.min - historical.min),
      max: Math.abs(current.max - historical.max),
      mean: Math.abs(current.mean - historical.mean),
      median: Math.abs(current.median - historical.median),
      stddev: Math.abs(current.stddev - historical.stddev),
      variance: Math.abs(current.variance - historical.variance)
    };
  }

  /**
   * Calculate relative difference between statistics
   */
  private calculateRelativeDifference(current: any, historical: any): any {
    const safeDivide = (a: number, b: number) => b === 0 ? 0 : (a - b) / Math.abs(b);
    
    return {
      count: safeDivide(current.count, historical.count),
      min: safeDivide(current.min, historical.min),
      max: safeDivide(current.max, historical.max),
      mean: safeDivide(current.mean, historical.mean),
      median: safeDivide(current.median, historical.median),
      stddev: safeDivide(current.stddev, historical.stddev),
      variance: safeDivide(current.variance, historical.variance)
    };
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(data: HistoricalDataPoint[]): any {
    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b) / values.length;
    const stddev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const stderr = stddev / Math.sqrt(values.length);
    
    // 95% confidence interval (z = 1.96)
    const margin = 1.96 * stderr;
    
    return {
      lower: mean - margin,
      upper: mean + margin,
      confidence: 0.95
    };
  }

  /**
   * Create scales for different visualization modes
   */
  protected createScales() {
    const { dimensions } = this.state;
    const { width, height, margin } = dimensions;
    const { currentMode } = this.state as ComparisonChartState;
    
    this.xScales.clear();
    this.yScales.clear();
    
    switch (currentMode) {
      case 'overlay':
        this.createOverlayScales(width, height, margin);
        break;
      case 'side-by-side':
        this.createSideBySideScales(width, height, margin);
        break;
      case 'difference':
        this.createDifferenceScales(width, height, margin);
        break;
      case 'statistical':
        this.createStatisticalScales(width, height, margin);
        break;
    }
  }

  /**
   * Create scales for overlay mode
   */
  private createOverlayScales(width: number, height: number, margin: any) {
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    // Combine all data for domain calculation
    const allData = [
      ...this.props.currentData,
      ...this.props.datasets.flatMap(d => d.data)
    ];
    
    if (allData.length === 0) return;
    
    // Time scale
    const timeExtent = d3.extent(allData, d => d.time || d.alignedTimestamp) as [Date, Date];
    const xScale = d3.scaleTime()
      .domain(timeExtent)
      .range([0, innerWidth])
      .nice();
    
    // Value scale
    const valueExtent = d3.extent(allData, d => d.value) as [number, number];
    const padding = (valueExtent[1] - valueExtent[0]) * 0.1;
    const yScale = d3.scaleLinear()
      .domain([valueExtent[0] - padding, valueExtent[1] + padding])
      .range([innerHeight, 0])
      .nice();
    
    this.xScales.set('main', xScale);
    this.yScales.set('main', yScale);
  }

  /**
   * Create scales for side-by-side mode
   */
  private createSideBySideScales(width: number, height: number, margin: any) {
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const datasetsCount = this.props.datasets.length + 1; // +1 for current data
    const chartWidth = innerWidth / datasetsCount;
    
    // Current data scale
    const currentTimeExtent = d3.extent(this.props.currentData, d => d.time) as [Date, Date];
    const currentValueExtent = d3.extent(this.props.currentData, d => d.value) as [number, number];
    
    if (currentTimeExtent[0] && currentValueExtent[0] !== undefined) {
      this.xScales.set('current', d3.scaleTime()
        .domain(currentTimeExtent)
        .range([0, chartWidth])
        .nice());
      
      this.yScales.set('current', d3.scaleLinear()
        .domain(currentValueExtent)
        .range([innerHeight, 0])
        .nice());
    }
    
    // Historical data scales
    this.props.datasets.forEach((dataset, index) => {
      const timeExtent = d3.extent(dataset.data, d => d.alignedTimestamp) as [Date, Date];
      const valueExtent = d3.extent(dataset.data, d => d.value) as [number, number];
      
      if (timeExtent[0] && valueExtent[0] !== undefined) {
        this.xScales.set(dataset.id, d3.scaleTime()
          .domain(timeExtent)
          .range([(index + 1) * chartWidth, (index + 2) * chartWidth])
          .nice());
        
        this.yScales.set(dataset.id, d3.scaleLinear()
          .domain(valueExtent)
          .range([innerHeight, 0])
          .nice());
      }
    });
  }

  /**
   * Create scales for difference mode
   */
  private createDifferenceScales(width: number, height: number, margin: any) {
    // Similar to overlay but focuses on difference data
    this.createOverlayScales(width, height, margin);
  }

  /**
   * Create scales for statistical mode
   */
  private createStatisticalScales(width: number, height: number, margin: any) {
    // Statistical visualization scales (box plots, violin plots, etc.)
    this.createOverlayScales(width, height, margin);
  }

  /**
   * Render the comparison chart
   */
  protected renderChart() {
    if (!this.svg) return;
    
    const { currentMode } = this.state as ComparisonChartState;
    const renderStartTime = performance.now();
    
    // Clear previous content
    this.svg.selectAll('*').remove();
    this.chartGroups.clear();
    
    // Setup SVG
    const { dimensions } = this.state;
    const { width, height } = dimensions;
    
    this.svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', this.props.ariaLabel || 'Historical comparison chart');
    
    // Render based on mode
    switch (currentMode) {
      case 'overlay':
        this.renderOverlayMode();
        break;
      case 'side-by-side':
        this.renderSideBySideMode();
        break;
      case 'difference':
        this.renderDifferenceMode();
        break;
      case 'statistical':
        this.renderStatisticalMode();
        break;
    }
    
    // Render legend if enabled
    if (this.props.showLegend) {
      this.renderLegend();
    }
    
    const renderTime = performance.now() - renderStartTime;
    this.props.events?.onRender?.(renderTime);
  }

  /**
   * Render overlay mode
   */
  private renderOverlayMode() {
    const { margin } = this.state.dimensions;
    const xScale = this.xScales.get('main');
    const yScale = this.yScales.get('main');
    
    if (!xScale || !yScale) return;
    
    // Main group
    const g = this.svg!.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Render current data
    this.renderCurrentDataLine(g, xScale, yScale, 'current');
    
    // Render historical datasets
    this.props.datasets.forEach((dataset, index) => {
      if (dataset.period.visible) {
        this.renderHistoricalDataLine(g, dataset, xScale, yScale, index);
      }
    });
    
    // Render confidence bands if enabled
    if (this.props.visualization.showConfidenceBands) {
      this.renderConfidenceBands(g, xScale, yScale);
    }
    
    // Render axes
    this.renderAxes(g, xScale, yScale);
  }

  /**
   * Render side-by-side mode
   */
  private renderSideBySideMode() {
    const { margin } = this.state.dimensions;
    
    // Render current data chart
    const currentXScale = this.xScales.get('current');
    const currentYScale = this.yScales.get('current');
    
    if (currentXScale && currentYScale) {
      const currentGroup = this.svg!.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
      
      this.renderCurrentDataLine(currentGroup, currentXScale, currentYScale, 'current');
      this.renderAxes(currentGroup, currentXScale, currentYScale, 'Current Data');
    }
    
    // Render historical data charts
    this.props.datasets.forEach((dataset, index) => {
      const xScale = this.xScales.get(dataset.id);
      const yScale = this.yScales.get(dataset.id);
      
      if (xScale && yScale && dataset.period.visible) {
        const group = this.svg!.append('g')
          .attr('transform', `translate(${margin.left},${margin.top})`);
        
        this.renderHistoricalDataLine(group, dataset, xScale, yScale, index);
        this.renderAxes(group, xScale, yScale, dataset.label);
      }
    });
  }

  /**
   * Render difference mode
   */
  private renderDifferenceMode() {
    // Calculate and render difference between current and historical data
    const { margin } = this.state.dimensions;
    const xScale = this.xScales.get('main');
    const yScale = this.yScales.get('main');
    
    if (!xScale || !yScale) return;
    
    const g = this.svg!.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Calculate and render differences
    this.props.datasets.forEach((dataset, index) => {
      if (dataset.period.visible) {
        const differenceData = this.calculateDifferenceData(this.props.currentData, dataset.data);
        this.renderDifferenceArea(g, differenceData, xScale, yScale, index);
      }
    });
    
    // Render zero line
    g.append('line')
      .attr('x1', 0)
      .attr('x2', xScale.range()[1])
      .attr('y1', yScale(0))
      .attr('y2', yScale(0))
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');
    
    this.renderAxes(g, xScale, yScale);
  }

  /**
   * Render statistical mode
   */
  private renderStatisticalMode() {
    // Render statistical visualizations (box plots, etc.)
    const { margin } = this.state.dimensions;
    const { statistics } = this.state as ComparisonChartState;
    
    if (!statistics) return;
    
    const g = this.svg!.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Render statistical comparisons
    this.renderStatisticalComparison(g, statistics);
  }

  /**
   * Render current data line
   */
  private renderCurrentDataLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    id: string
  ) {
    const line = d3.line<any>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);
    
    g.append('path')
      .datum(this.props.currentData)
      .attr('class', `line line-${id}`)
      .attr('fill', 'none')
      .attr('stroke', DEFAULT_COMPARISON_COLORS.current)
      .attr('stroke-width', 2)
      .attr('d', line);
  }

  /**
   * Render historical data line
   */
  private renderHistoricalDataLine(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    dataset: ComparisonDataset,
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    index: number
  ) {
    const line = d3.line<HistoricalDataPoint>()
      .x(d => xScale(d.alignedTimestamp))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);
    
    g.append('path')
      .datum(dataset.data)
      .attr('class', `line line-${dataset.id}`)
      .attr('fill', 'none')
      .attr('stroke', dataset.period.color)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', this.getStrokeDashArray(dataset.period.strokeStyle))
      .attr('opacity', dataset.period.opacity || 0.8)
      .attr('d', line);
  }

  /**
   * Calculate difference data between current and historical
   */
  private calculateDifferenceData(current: any[], historical: HistoricalDataPoint[]): any[] {
    // Simplified difference calculation
    // In production, this would involve proper time alignment and interpolation
    const differences: any[] = [];
    
    const minLength = Math.min(current.length, historical.length);
    for (let i = 0; i < minLength; i++) {
      differences.push({
        time: current[i].time,
        value: current[i].value - historical[i].value
      });
    }
    
    return differences;
  }

  /**
   * Render difference area
   */
  private renderDifferenceArea(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: any[],
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    index: number
  ) {
    const area = d3.area<any>()
      .x(d => xScale(d.time))
      .y0(yScale(0))
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX);
    
    const colors = DEFAULT_COMPARISON_COLORS.difference;
    
    g.append('path')
      .datum(data)
      .attr('class', `difference-area difference-${index}`)
      .attr('fill', data[0]?.value >= 0 ? colors.positive : colors.negative)
      .attr('opacity', 0.5)
      .attr('d', area);
  }

  /**
   * Render confidence bands
   */
  private renderConfidenceBands(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>
  ) {
    // Implement confidence band rendering
    // This would calculate and render confidence intervals
  }

  /**
   * Render statistical comparison
   */
  private renderStatisticalComparison(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    statistics: ComparisonStatistics
  ) {
    // Implement statistical visualization
    // Box plots, violin plots, etc.
  }

  /**
   * Render axes
   */
  private renderAxes(
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    xScale: d3.ScaleTime<number, number>,
    yScale: d3.ScaleLinear<number, number>,
    title?: string
  ) {
    const { dimensions } = this.state;
    const { margin } = dimensions;
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;
    
    // X Axis
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M')));
    
    // Y Axis
    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale));
    
    // Title
    if (title) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .text(title);
    }
  }

  /**
   * Render legend
   */
  private renderLegend() {
    // Implement legend rendering
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
   * Handle worker messages
   */
  private handleWorkerMessage(event: MessageEvent) {
    const { type, data, error } = event.data;
    
    if (error) {
      console.error('Worker error:', error);
      return;
    }
    
    switch (type) {
      case 'statistics':
        this.setState({ 
          statistics: data,
          isCalculatingStatistics: false 
        } as Partial<ComparisonChartState>);
        break;
    }
  }

  /**
   * Clear render cache
   */
  private clearRenderCache() {
    this.renderCache.clear();
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring() {
    this.memoryMonitor = setInterval(() => {
      const usage = this.calculateMemoryUsage();
      this.setState({ memoryUsage: usage } as Partial<ComparisonChartState>);
      
      if (usage > this.props.progressiveLoading.memoryThreshold) {
        this.props.events?.onMemoryThresholdExceeded?.(usage, this.props.progressiveLoading.memoryThreshold);
      }
    }, 5000);
  }

  /**
   * Calculate memory usage
   */
  private calculateMemoryUsage(): number {
    // Simplified memory usage calculation
    let totalPoints = this.props.currentData.length;
    totalPoints += this.props.datasets.reduce((sum, dataset) => sum + dataset.data.length, 0);
    
    // Estimate memory usage (rough calculation)
    return totalPoints * 64 / (1024 * 1024); // Convert to MB
  }

  /**
   * Cleanup comparison resources
   */
  private cleanupComparison() {
    if (this.statisticsWorker) {
      this.statisticsWorker.terminate();
      this.statisticsWorker = null;
    }
    
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor);
      this.memoryMonitor = null;
    }
    
    if (this.tooltipDiv) {
      this.tooltipDiv.remove();
      this.tooltipDiv = null;
    }
    
    this.renderCache.clear();
    this.chartGroups.clear();
    this.xScales.clear();
    this.yScales.clear();
  }

  /**
   * Update chart with new configuration
   */
  protected updateChart(config = { transition: true, duration: 300 }) {
    this.createScales();
    this.renderChart();
  }

  /**
   * Apply zoom transform
   */
  protected applyZoom(transform: any) {
    // Implement zoom behavior for comparison chart
  }

  /**
   * Export chart as CSV
   */
  protected async exportCSV(filename: string): Promise<void> {
    // Implement CSV export
  }

  /**
   * Export chart as JSON
   */
  protected async exportJSON(filename: string): Promise<void> {
    // Implement JSON export
  }
}

/**
 * Functional component wrapper
 */
export const HistoricalComparisonChartFC: React.FC<HistoricalComparisonChartProps> = (props) => {
  const chartRef = useRef<HistoricalComparisonChart>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('HistoricalComparisonChart');
  
  useEffect(() => {
    startTracking();
    return endTracking;
  }, [startTracking, endTracking]);
  
  const isLoading = props.datasets.some(d => d.loadingState.phase !== 'complete');
  const hasError = props.datasets.some(d => d.loadingState.phase === 'error');
  
  return (
    <Box position="relative">
      {/* Loading indicator */}
      {isLoading && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bgcolor="rgba(255, 255, 255, 0.8)"
          zIndex={1}
        >
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ ml: 2 }}>
            Loading historical data...
          </Typography>
        </Box>
      )}
      
      {/* Error indicator */}
      {hasError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load some historical data. Chart may be incomplete.
        </Alert>
      )}
      
      {/* Main chart */}
      <HistoricalComparisonChart
        ref={chartRef}
        theme={theme}
        {...props}
      />
      
      {/* Performance indicator */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          position="absolute"
          bottom={8}
          right={8}
          bgcolor="rgba(0,0,0,0.7)"
          color="white"
          p={1}
          borderRadius={1}
          fontSize="0.75rem"
        >
          <Typography variant="caption">
            Memory: {Math.round((chartRef.current?.state as any)?.memoryUsage || 0)}MB
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HistoricalComparisonChart;