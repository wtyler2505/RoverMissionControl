/**
 * LineChart Component
 * Time-series visualization for telemetry data with real-time updates
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';
import { LineChartProps, TimeSeriesDataPoint, ChartDimensions } from '../types';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

const DEFAULT_ANIMATION_DURATION = 300;
const DEFAULT_STROKE_WIDTH = 2;
const ZOOM_EXTENT: [number, number] = [0.5, 10];

export const LineChart: React.FC<LineChartProps> = ({
  data,
  dimensions: propDimensions,
  className,
  ariaLabel = 'Line chart visualization',
  animation = { enabled: true, duration: DEFAULT_ANIMATION_DURATION },
  tooltip = { enabled: true },
  legend = { enabled: true, position: 'top', orientation: 'horizontal' },
  xAxis = {},
  yAxis = {},
  interpolation = 'monotone',
  showPoints = true,
  showArea = false,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  enableZoom = false,
  enablePan = false,
  thresholds = [],
  onDataPointClick,
  onChartClick,
  onZoom,
  onPan,
  onHover,
  onLeave,
  onRender
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('LineChart');
  
  // Track zoom state
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const currentTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  /**
   * Get D3 curve interpolation function
   */
  const getCurveFunction = useCallback(() => {
    const curves = {
      linear: d3.curveLinear,
      monotone: d3.curveMonotoneX,
      step: d3.curveStep,
      basis: d3.curveBasis,
      cardinal: d3.curveCardinal
    };
    return curves[interpolation] || d3.curveLinear;
  }, [interpolation]);

  /**
   * Create scales
   */
  const createScales = useCallback((dimensions: ChartDimensions, domain?: { x: [Date, Date]; y: [number, number] }) => {
    const { width, height, margin } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // X Scale (time)
    const xScale = d3.scaleTime()
      .domain(domain?.x || d3.extent(data, d => d.time) as [Date, Date])
      .range([0, innerWidth])
      .nice();

    // Y Scale (values)
    const yExtent = domain?.y || d3.extent(data, d => d.value) as [number, number];
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
    
    const yScale = d3.scaleLinear()
      .domain([
        Math.min(yExtent[0] - yPadding, ...thresholds.map(t => t.value)),
        Math.max(yExtent[1] + yPadding, ...thresholds.map(t => t.value))
      ])
      .range([innerHeight, 0])
      .nice();

    return { xScale, yScale, innerWidth, innerHeight };
  }, [data, thresholds]);

  /**
   * Render chart
   */
  const renderChart = useCallback((dimensions: ChartDimensions) => {
    if (!svgRef.current || data.length === 0) return;

    startTracking();
    const renderStartTime = performance.now();

    const svg = d3.select(svgRef.current);
    const { width, height, margin } = dimensions;
    const { xScale, yScale, innerWidth, innerHeight } = createScales(dimensions);

    // Clear previous content
    svg.selectAll('*').remove();

    // Set SVG dimensions
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', ariaLabel);

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add clip path for zoom/pan
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'chart-clip')
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight);

    // Grid lines
    if (xAxis.gridLines !== false) {
      g.append('g')
        .attr('class', 'grid grid-x')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3.axisBottom(xScale)
            .tickSize(-innerHeight)
            .tickFormat(() => '')
        )
        .style('stroke-dasharray', theme.grid.dashArray)
        .style('stroke', theme.grid.color)
        .style('stroke-width', theme.grid.strokeWidth)
        .style('opacity', theme.grid.opacity);
    }

    if (yAxis.gridLines !== false) {
      g.append('g')
        .attr('class', 'grid grid-y')
        .call(
          d3.axisLeft(yScale)
            .tickSize(-innerWidth)
            .tickFormat(() => '')
        )
        .style('stroke-dasharray', theme.grid.dashArray)
        .style('stroke', theme.grid.color)
        .style('stroke-width', theme.grid.strokeWidth)
        .style('opacity', theme.grid.opacity);
    }

    // Create chart content group with clip path
    const chartContent = g.append('g')
      .attr('class', 'chart-content')
      .attr('clip-path', 'url(#chart-clip)');

    // Threshold lines
    thresholds.forEach((threshold, index) => {
      const thresholdGroup = chartContent.append('g')
        .attr('class', `threshold threshold-${index}`);

      thresholdGroup.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(threshold.value))
        .attr('y2', yScale(threshold.value))
        .attr('stroke', threshold.color)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', threshold.style === 'dashed' ? '5,5' : threshold.style === 'dotted' ? '2,2' : null)
        .attr('opacity', 0.7);

      thresholdGroup.append('text')
        .attr('x', innerWidth + 5)
        .attr('y', yScale(threshold.value) + 4)
        .attr('fill', threshold.color)
        .style('font-size', theme.text.fontSize.label)
        .style('font-family', theme.text.fontFamily)
        .text(threshold.label);
    });

    // Line generator
    const line = d3.line<TimeSeriesDataPoint>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.value))
      .curve(getCurveFunction());

    // Area generator (if enabled)
    const area = d3.area<TimeSeriesDataPoint>()
      .x(d => xScale(d.time))
      .y0(innerHeight)
      .y1(d => yScale(d.value))
      .curve(getCurveFunction());

    // Add gradient for area
    if (showArea) {
      const gradient = svg.select('defs')
        .append('linearGradient')
        .attr('id', 'area-gradient')
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', 0)
        .attr('y1', yScale(yScale.domain()[1]))
        .attr('x2', 0)
        .attr('y2', yScale(yScale.domain()[0]));

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', theme.colors.primary[2])
        .attr('stop-opacity', 0.1);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', theme.colors.primary[2])
        .attr('stop-opacity', 0.5);

      // Draw area
      chartContent.append('path')
        .datum(data)
        .attr('class', 'area')
        .attr('fill', 'url(#area-gradient)')
        .attr('d', area)
        .style('opacity', 0)
        .transition()
        .duration(animation.enabled ? animation.duration : 0)
        .style('opacity', 1);
    }

    // Draw line
    const path = chartContent.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', theme.colors.primary[2])
      .attr('stroke-width', strokeWidth)
      .attr('d', line);

    // Animate line drawing
    if (animation.enabled) {
      const totalLength = path.node()?.getTotalLength() || 0;
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(animation.duration)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);
    }

    // Draw points
    if (showPoints) {
      const points = chartContent.selectAll('.point')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => xScale(d.time))
        .attr('cy', d => yScale(d.value))
        .attr('r', 0)
        .attr('fill', d => {
          if (d.category === 'critical') return theme.colors.error;
          if (d.category === 'warning') return theme.colors.warning;
          return theme.colors.primary[2];
        })
        .attr('stroke', theme.background.paper)
        .attr('stroke-width', 2)
        .style('cursor', onDataPointClick ? 'pointer' : 'default');

      // Animate points
      points.transition()
        .duration(animation.enabled ? animation.duration : 0)
        .delay((d, i) => animation.enabled ? (i * animation.duration) / data.length : 0)
        .attr('r', 4);

      // Point interactions
      points
        .on('click', (event, d) => {
          event.stopPropagation();
          onDataPointClick?.(d, event);
        })
        .on('mouseenter', (event, d) => {
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr('r', 6);
          
          showTooltip(d, event);
          onHover?.(d, event);
        })
        .on('mouseleave', (event) => {
          d3.select(event.currentTarget)
            .transition()
            .duration(100)
            .attr('r', 4);
          
          hideTooltip();
          onLeave?.(event);
        });
    }

    // X Axis
    const xAxisGroup = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale)
          .tickFormat(xAxis.tickFormat || d3.timeFormat('%H:%M:%S'))
          .ticks(xAxis.tickCount || 6)
      );

    xAxisGroup.selectAll('text')
      .style('font-size', theme.axis.fontSize)
      .style('font-family', theme.text.fontFamily)
      .style('fill', theme.axis.color);

    xAxisGroup.selectAll('line, path')
      .style('stroke', theme.axis.color)
      .style('stroke-width', theme.axis.strokeWidth);

    // X Axis label
    if (xAxis.label) {
      g.append('text')
        .attr('class', 'x-axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + margin.bottom - 5)
        .style('text-anchor', 'middle')
        .style('font-size', theme.text.fontSize.label)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.text.primary)
        .text(xAxis.label);
    }

    // Y Axis
    const yAxisGroup = g.append('g')
      .attr('class', 'y-axis')
      .call(
        d3.axisLeft(yScale)
          .tickFormat(yAxis.tickFormat || d3.format('.1f'))
          .ticks(yAxis.tickCount || 5)
      );

    yAxisGroup.selectAll('text')
      .style('font-size', theme.axis.fontSize)
      .style('font-family', theme.text.fontFamily)
      .style('fill', theme.axis.color);

    yAxisGroup.selectAll('line, path')
      .style('stroke', theme.axis.color)
      .style('stroke-width', theme.axis.strokeWidth);

    // Y Axis label
    if (yAxis.label) {
      g.append('text')
        .attr('class', 'y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -margin.left + 15)
        .style('text-anchor', 'middle')
        .style('font-size', theme.text.fontSize.label)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.text.primary)
        .text(yAxis.label);
    }

    // Setup zoom/pan
    if (enableZoom || enablePan) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent(enableZoom ? ZOOM_EXTENT : [1, 1])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
          const transform = event.transform;
          currentTransformRef.current = transform;

          // Update scales
          const newXScale = transform.rescaleX(xScale);
          const newYScale = enableZoom ? transform.rescaleY(yScale) : yScale;

          // Update line
          chartContent.select('.line')
            .attr('d', line.x(d => newXScale(d.time)).y(d => newYScale(d.value)));

          // Update area
          if (showArea) {
            chartContent.select('.area')
              .attr('d', area.x(d => newXScale(d.time)).y1(d => newYScale(d.value)));
          }

          // Update points
          if (showPoints) {
            chartContent.selectAll('.point')
              .attr('cx', (d: any) => newXScale(d.time))
              .attr('cy', (d: any) => newYScale(d.value));
          }

          // Update axes
          xAxisGroup.call(
            d3.axisBottom(newXScale)
              .tickFormat(xAxis.tickFormat || d3.timeFormat('%H:%M:%S'))
              .ticks(xAxis.tickCount || 6)
          );

          if (enableZoom) {
            yAxisGroup.call(
              d3.axisLeft(newYScale)
                .tickFormat(yAxis.tickFormat || d3.format('.1f'))
                .ticks(yAxis.tickCount || 5)
            );
          }

          // Update threshold lines
          thresholds.forEach((threshold, index) => {
            chartContent.select(`.threshold-${index} line`)
              .attr('y1', newYScale(threshold.value))
              .attr('y2', newYScale(threshold.value));
          });

          // Callbacks
          if (enableZoom) onZoom?.(transform);
          if (enablePan) onPan?.(transform);
        });

      svg.call(zoom);
      zoomRef.current = zoom;

      // Apply current transform
      if (currentTransformRef.current && !currentTransformRef.current.k) {
        svg.call(zoom.transform, currentTransformRef.current);
      }
    }

    // Chart click handler
    svg.on('click', (event) => {
      if (event.target === svg.node()) {
        onChartClick?.(event);
      }
    });

    const renderTime = performance.now() - renderStartTime;
    endTracking();
    onRender?.(renderTime);
  }, [
    data, theme, ariaLabel, animation, xAxis, yAxis, interpolation,
    showPoints, showArea, strokeWidth, enableZoom, enablePan, thresholds,
    getCurveFunction, createScales, startTracking, endTracking,
    onDataPointClick, onChartClick, onZoom, onPan, onHover, onLeave, onRender
  ]);

  /**
   * Show tooltip
   */
  const showTooltip = useCallback((dataPoint: TimeSeriesDataPoint, event: MouseEvent) => {
    if (!tooltipRef.current || !tooltip.enabled) return;

    const formatTime = d3.timeFormat('%H:%M:%S');
    const formatValue = d3.format('.2f');
    
    const content = tooltip.format ? tooltip.format(dataPoint) : `
      <div style="padding: 4px;">
        <div style="font-weight: bold;">Time: ${formatTime(dataPoint.time)}</div>
        <div>Value: ${formatValue(dataPoint.value)}</div>
        ${dataPoint.category ? `<div>Status: ${dataPoint.category}</div>` : ''}
      </div>
    `;

    const tooltipEl = d3.select(tooltipRef.current);
    tooltipEl
      .html(content)
      .style('opacity', 1)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`);
  }, [tooltip]);

  /**
   * Hide tooltip
   */
  const hideTooltip = useCallback(() => {
    if (!tooltipRef.current) return;
    
    d3.select(tooltipRef.current)
      .style('opacity', 0);
  }, []);

  // Render with responsive container
  const chartContent = useCallback((dimensions: ChartDimensions) => (
    <Box position="relative" width={dimensions.width} height={dimensions.height}>
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          opacity: 0,
          background: theme.background.tooltip,
          color: theme.text.contrast,
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: theme.text.fontSize.tooltip,
          fontFamily: theme.text.fontFamily,
          boxShadow: theme.effects.shadow,
          zIndex: 1000,
          transition: 'opacity 200ms'
        }}
      />
    </Box>
  ), [theme]);

  // Effect to render chart when data or dimensions change
  useEffect(() => {
    if (propDimensions) {
      renderChart(propDimensions);
    }
  }, [propDimensions, renderChart]);

  if (propDimensions) {
    return chartContent(propDimensions);
  }

  return (
    <ResponsiveContainer className={className} aspectRatio={2}>
      {(dimensions) => {
        // Render chart when dimensions are available
        setTimeout(() => renderChart(dimensions), 0);
        return chartContent(dimensions);
      }}
    </ResponsiveContainer>
  );
};

export default LineChart;