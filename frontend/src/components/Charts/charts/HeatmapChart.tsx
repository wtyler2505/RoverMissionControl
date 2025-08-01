/**
 * HeatmapChart Component
 * 2D data visualization for sensor arrays and correlation matrices
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';
import { HeatmapChartProps, HeatmapDataPoint, ChartDimensions } from '../types';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

const DEFAULT_CELL_PADDING = 2;
const DEFAULT_CELL_RADIUS = 2;

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  data,
  dimensions: propDimensions,
  className,
  ariaLabel = 'Heatmap chart visualization',
  animation = { enabled: true, duration: 300 },
  tooltip = { enabled: true },
  xAxis = {},
  yAxis = {},
  colorScale: customColorScale,
  cellPadding = DEFAULT_CELL_PADDING,
  cellRadius = DEFAULT_CELL_RADIUS,
  showValues = false,
  valueFormat = d3.format('.2f'),
  onDataPointClick,
  onChartClick,
  onHover,
  onLeave,
  onRender
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('HeatmapChart');

  /**
   * Extract unique x and y values
   */
  const getUniqueValues = useCallback(() => {
    const xValues = [...new Set(data.map(d => d.x))].sort();
    const yValues = [...new Set(data.map(d => d.y))].sort();
    return { xValues, yValues };
  }, [data]);

  /**
   * Create scales
   */
  const createScales = useCallback((dimensions: ChartDimensions) => {
    const { width, height, margin } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const { xValues, yValues } = getUniqueValues();

    // X Scale
    const xScale = d3.scaleBand()
      .domain(xAxis.domain as string[] || xValues.map(String))
      .range([0, innerWidth])
      .padding(cellPadding / 100);

    // Y Scale
    const yScale = d3.scaleBand()
      .domain(yAxis.domain as string[] || yValues.map(String))
      .range([0, innerHeight])
      .padding(cellPadding / 100);

    // Value extent
    const valueExtent = d3.extent(data, d => d.value) as [number, number];

    // Color Scale
    let colorScale: d3.ScaleSequential<string>;
    
    if (customColorScale && customColorScale.length > 0) {
      // Use custom color scale
      if (customColorScale.length === 1) {
        colorScale = d3.scaleSequential()
          .domain(valueExtent)
          .interpolator(() => customColorScale[0]);
      } else {
        const interpolator = d3.interpolateRgbBasis(customColorScale);
        colorScale = d3.scaleSequential()
          .domain(valueExtent)
          .interpolator(interpolator);
      }
    } else {
      // Use theme-based color scale
      colorScale = d3.scaleSequential()
        .domain(valueExtent)
        .interpolator(d3.interpolateRgbBasis(theme.colors.sequential));
    }

    return { xScale, yScale, colorScale, innerWidth, innerHeight, valueExtent };
  }, [data, xAxis.domain, yAxis.domain, cellPadding, customColorScale, theme, getUniqueValues]);

  /**
   * Render heatmap
   */
  const renderHeatmap = useCallback((dimensions: ChartDimensions) => {
    if (!svgRef.current || data.length === 0) return;

    startTracking();
    const renderStartTime = performance.now();

    const svg = d3.select(svgRef.current);
    const { width, height, margin } = dimensions;
    const { xScale, yScale, colorScale, innerWidth, innerHeight } = createScales(dimensions);

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

    // Create cells
    const cells = g.selectAll('.heatmap-cell')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'heatmap-cell');

    // Cell rectangles
    const rects = cells.append('rect')
      .attr('x', d => xScale(String(d.x)) || 0)
      .attr('y', d => yScale(String(d.y)) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('rx', cellRadius)
      .attr('ry', cellRadius)
      .style('fill', theme.background.paper)
      .style('stroke', theme.background.default)
      .style('stroke-width', 1)
      .style('cursor', onDataPointClick ? 'pointer' : 'default');

    // Animate cell colors
    if (animation.enabled) {
      rects
        .transition()
        .duration(animation.duration)
        .delay((d, i) => (i / data.length) * animation.duration * 0.5)
        .style('fill', d => colorScale(d.value));
    } else {
      rects.style('fill', d => colorScale(d.value));
    }

    // Add values if enabled
    if (showValues) {
      const texts = cells.append('text')
        .attr('x', d => (xScale(String(d.x)) || 0) + xScale.bandwidth() / 2)
        .attr('y', d => (yScale(String(d.y)) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .style('font-size', theme.text.fontSize.tick)
        .style('font-family', theme.text.fontFamily)
        .style('fill', d => {
          // Choose text color based on background brightness
          const bgColor = d3.rgb(colorScale(d.value));
          const brightness = (bgColor.r * 299 + bgColor.g * 587 + bgColor.b * 114) / 1000;
          return brightness > 128 ? theme.text.primary : theme.text.contrast;
        })
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .text(d => valueFormat(d.value));

      if (animation.enabled) {
        texts
          .transition()
          .duration(animation.duration)
          .delay((d, i) => (i / data.length) * animation.duration * 0.5 + animation.duration * 0.5)
          .style('opacity', 1);
      } else {
        texts.style('opacity', 1);
      }
    }

    // Cell interactions
    cells
      .on('click', (event, d) => {
        event.stopPropagation();
        onDataPointClick?.(d, event);
      })
      .on('mouseenter', function(event, d) {
        // Highlight cell
        d3.select(this).select('rect')
          .transition()
          .duration(100)
          .style('stroke', theme.text.primary)
          .style('stroke-width', 2)
          .style('filter', theme.states.hover.filter);

        showTooltip(d, event);
        onHover?.(d, event);
      })
      .on('mouseleave', function(event) {
        // Remove highlight
        d3.select(this).select('rect')
          .transition()
          .duration(100)
          .style('stroke', theme.background.default)
          .style('stroke-width', 1)
          .style('filter', null);

        hideTooltip();
        onLeave?.(event);
      });

    // X Axis
    const xAxisGroup = g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3.axisBottom(xScale)
          .tickFormat(xAxis.tickFormat || (d => String(d)))
      );

    xAxisGroup.selectAll('text')
      .style('font-size', theme.axis.fontSize)
      .style('font-family', theme.text.fontFamily)
      .style('fill', theme.axis.color)
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em');

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
          .tickFormat(yAxis.tickFormat || (d => String(d)))
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

    // Color legend
    const legendWidth = 200;
    const legendHeight = 20;
    const legendMargin = 20;

    const legendGroup = svg.append('g')
      .attr('class', 'color-legend')
      .attr('transform', `translate(${width - legendWidth - legendMargin}, ${legendMargin})`);

    // Create gradient for legend
    const gradientId = 'heatmap-gradient';
    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    // Add gradient stops
    const numStops = 10;
    const valueRange = colorScale.domain();
    
    for (let i = 0; i <= numStops; i++) {
      const offset = i / numStops;
      const value = valueRange[0] + offset * (valueRange[1] - valueRange[0]);
      
      gradient.append('stop')
        .attr('offset', `${offset * 100}%`)
        .attr('stop-color', colorScale(value));
    }

    // Legend rectangle
    legendGroup.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', `url(#${gradientId})`)
      .style('stroke', theme.grid.color)
      .style('stroke-width', 1);

    // Legend scale
    const legendScale = d3.scaleLinear()
      .domain(valueRange)
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(valueFormat);

    legendGroup.append('g')
      .attr('transform', `translate(0,${legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', theme.text.fontSize.tick)
      .style('font-family', theme.text.fontFamily)
      .style('fill', theme.text.secondary);

    legendGroup.selectAll('line, path')
      .style('stroke', theme.axis.color)
      .style('stroke-width', theme.axis.strokeWidth);

    // Legend title
    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .style('font-size', theme.text.fontSize.label)
      .style('font-family', theme.text.fontFamily)
      .style('fill', theme.text.primary)
      .text('Value');

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
    data, theme, ariaLabel, animation, xAxis, yAxis,
    cellRadius, showValues, valueFormat,
    createScales, startTracking, endTracking,
    onDataPointClick, onChartClick, onHover, onLeave, onRender
  ]);

  /**
   * Show tooltip
   */
  const showTooltip = useCallback((dataPoint: HeatmapDataPoint, event: MouseEvent) => {
    if (!tooltipRef.current || !tooltip.enabled) return;

    const content = tooltip.format ? tooltip.format(dataPoint) : `
      <div style="padding: 4px;">
        <div><strong>${dataPoint.label || `${dataPoint.x}, ${dataPoint.y}`}</strong></div>
        <div>Value: ${valueFormat(dataPoint.value)}</div>
      </div>
    `;

    const tooltipEl = d3.select(tooltipRef.current);
    tooltipEl
      .html(content)
      .style('opacity', 1)
      .style('left', `${event.pageX + 10}px`)
      .style('top', `${event.pageY - 10}px`);
  }, [tooltip, valueFormat]);

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
      renderHeatmap(propDimensions);
    }
  }, [propDimensions, renderHeatmap]);

  if (propDimensions) {
    return chartContent(propDimensions);
  }

  return (
    <ResponsiveContainer className={className} aspectRatio={1.5}>
      {(dimensions) => {
        // Render chart when dimensions are available
        setTimeout(() => renderHeatmap(dimensions), 0);
        return chartContent(dimensions);
      }}
    </ResponsiveContainer>
  );
};

export default HeatmapChart;