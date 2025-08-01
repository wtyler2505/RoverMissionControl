/**
 * AreaChart Component
 * Range and threshold visualization with gradient fills
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';
import { AreaChartProps, TimeSeriesDataPoint, ChartDimensions } from '../types';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

const DEFAULT_ANIMATION_DURATION = 300;
const DEFAULT_OPACITY = 0.7;
const ZOOM_EXTENT: [number, number] = [0.5, 10];

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  dimensions: propDimensions,
  className,
  ariaLabel = 'Area chart visualization',
  animation = { enabled: true, duration: DEFAULT_ANIMATION_DURATION },
  tooltip = { enabled: true },
  legend = { enabled: true, position: 'top', orientation: 'horizontal' },
  xAxis = {},
  yAxis = {},
  interpolation = 'monotone',
  opacity = DEFAULT_OPACITY,
  gradient = true,
  stackedAreas = false,
  strokeWidth = 2,
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
  const { startTracking, endTracking } = useComponentPerformanceTracking('AreaChart');
  
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
   * Group data by category for stacked areas
   */
  const groupDataByCategory = useCallback(() => {
    if (!stackedAreas) return [{ key: 'default', values: data }];

    const grouped = d3.group(data, d => d.category || 'default');
    return Array.from(grouped, ([key, values]) => ({ key, values }));
  }, [data, stackedAreas]);

  /**
   * Create stack generator for stacked areas
   */
  const createStackGenerator = useCallback(() => {
    if (!stackedAreas) return null;

    const categories = [...new Set(data.map(d => d.category || 'default'))];
    const timePoints = [...new Set(data.map(d => d.time.getTime()))].sort();
    
    // Transform data for stacking
    const stackData = timePoints.map(time => {
      const point: any = { time: new Date(time) };
      categories.forEach(category => {
        const dataPoint = data.find(d => 
          d.time.getTime() === time && (d.category || 'default') === category
        );
        point[category] = dataPoint ? dataPoint.value : 0;
      });
      return point;
    });

    const stack = d3.stack<any>()
      .keys(categories)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    return { stack: stack(stackData), categories, stackData };
  }, [data, stackedAreas]);

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
    let yExtent: [number, number];
    
    if (stackedAreas) {
      const stackResult = createStackGenerator();
      if (stackResult) {
        yExtent = [0, d3.max(stackResult.stack.flat(), d => d[1]) || 0];
      } else {
        yExtent = d3.extent(data, d => d.value) as [number, number];
      }
    } else {
      yExtent = domain?.y || [0, d3.max(data, d => d.value) || 0];
    }

    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
    
    const yScale = d3.scaleLinear()
      .domain([
        Math.min(yExtent[0] - yPadding, ...thresholds.map(t => t.value)),
        Math.max(yExtent[1] + yPadding, ...thresholds.map(t => t.value))
      ])
      .range([innerHeight, 0])
      .nice();

    return { xScale, yScale, innerWidth, innerHeight };
  }, [data, thresholds, stackedAreas, createStackGenerator]);

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

    // Create definitions for gradients
    const defs = svg.append('defs');

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add clip path for zoom/pan
    defs.append('clipPath')
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

    if (stackedAreas) {
      // Render stacked areas
      const stackResult = createStackGenerator();
      if (stackResult) {
        const { stack, categories } = stackResult;
        const colorScale = d3.scaleOrdinal<string>()
          .domain(categories)
          .range(theme.colors.categorical);

        // Area generator for stacked data
        const area = d3.area<any>()
          .x((d: any) => xScale(d.data.time))
          .y0((d: any) => yScale(d[0]))
          .y1((d: any) => yScale(d[1]))
          .curve(getCurveFunction());

        // Create gradients for each category
        categories.forEach((category, index) => {
          if (gradient) {
            const gradientId = `area-gradient-${index}`;
            const gradientDef = defs.append('linearGradient')
              .attr('id', gradientId)
              .attr('gradientUnits', 'userSpaceOnUse')
              .attr('x1', 0)
              .attr('y1', yScale(yScale.domain()[1]))
              .attr('x2', 0)
              .attr('y2', yScale(yScale.domain()[0]));

            gradientDef.append('stop')
              .attr('offset', '0%')
              .attr('stop-color', colorScale(category))
              .attr('stop-opacity', 0.1);

            gradientDef.append('stop')
              .attr('offset', '100%')
              .attr('stop-color', colorScale(category))
              .attr('stop-opacity', opacity);
          }
        });

        // Draw stacked areas
        const areas = chartContent.selectAll('.stacked-area')
          .data(stack)
          .enter()
          .append('g')
          .attr('class', 'stacked-area');

        const paths = areas.append('path')
          .attr('d', area)
          .style('fill', (d, i) => gradient ? `url(#area-gradient-${i})` : colorScale(categories[i]))
          .style('opacity', gradient ? 1 : opacity)
          .style('stroke', (d, i) => colorScale(categories[i]))
          .style('stroke-width', strokeWidth);

        // Animation
        if (animation.enabled) {
          paths
            .style('opacity', 0)
            .transition()
            .duration(animation.duration)
            .delay((d, i) => i * 100)
            .style('opacity', gradient ? 1 : opacity);
        }

        // Area interactions
        areas
          .style('cursor', onDataPointClick ? 'pointer' : 'default')
          .on('click', (event, d) => {
            event.stopPropagation();
            // Find the data point closest to the click
            const [mouseX] = d3.pointer(event, chartContent.node());
            const timeValue = xScale.invert(mouseX);
            const closestPoint = data.find(point => 
              Math.abs(point.time.getTime() - timeValue.getTime()) === 
              Math.min(...data.map(p => Math.abs(p.time.getTime() - timeValue.getTime())))
            );
            if (closestPoint) {
              onDataPointClick?.(closestPoint, event);
            }
          })
          .on('mouseenter', function(event, d) {
            d3.select(this).select('path')
              .transition()
              .duration(100)
              .style('opacity', Math.min(1, (gradient ? 1 : opacity) + 0.2));
            
            onHover?.(d, event);
          })
          .on('mouseleave', function(event) {
            d3.select(this).select('path')
              .transition()
              .duration(100)
              .style('opacity', gradient ? 1 : opacity);
            
            onLeave?.(event);
          });
      }
    } else {
      // Render single area
      const area = d3.area<TimeSeriesDataPoint>()
        .x(d => xScale(d.time))
        .y0(innerHeight)
        .y1(d => yScale(d.value))
        .curve(getCurveFunction());

      // Create gradient
      if (gradient) {
        const gradientId = 'single-area-gradient';
        const gradientDef = defs.append('linearGradient')
          .attr('id', gradientId)
          .attr('gradientUnits', 'userSpaceOnUse')
          .attr('x1', 0)
          .attr('y1', yScale(yScale.domain()[1]))
          .attr('x2', 0)
          .attr('y2', yScale(yScale.domain()[0]));

        gradientDef.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', theme.colors.primary[2])
          .attr('stop-opacity', 0.1);

        gradientDef.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', theme.colors.primary[2])
          .attr('stop-opacity', opacity);
      }

      // Draw area
      const path = chartContent.append('path')
        .datum(data)
        .attr('class', 'area')
        .attr('fill', gradient ? 'url(#single-area-gradient)' : theme.colors.primary[2])
        .attr('opacity', gradient ? 1 : opacity)
        .attr('stroke', theme.colors.primary[2])
        .attr('stroke-width', strokeWidth)
        .attr('d', area)
        .style('cursor', onDataPointClick ? 'pointer' : 'default');

      // Animation
      if (animation.enabled) {
        path
          .style('opacity', 0)
          .transition()
          .duration(animation.duration)
          .style('opacity', gradient ? 1 : opacity);
      }

      // Area interactions
      path
        .on('click', (event) => {
          event.stopPropagation();
          const [mouseX] = d3.pointer(event, chartContent.node());
          const timeValue = xScale.invert(mouseX);
          const closestPoint = data.find(point => 
            Math.abs(point.time.getTime() - timeValue.getTime()) === 
            Math.min(...data.map(p => Math.abs(p.time.getTime() - timeValue.getTime())))
          );
          if (closestPoint) {
            onDataPointClick?.(closestPoint, event);
          }
        })
        .on('mouseenter', function(event) {
          d3.select(this)
            .transition()
            .duration(100)
            .style('opacity', Math.min(1, (gradient ? 1 : opacity) + 0.2));
          
          onHover?.(event, event);
        })
        .on('mouseleave', function(event) {
          d3.select(this)
            .transition()
            .duration(100)
            .style('opacity', gradient ? 1 : opacity);
          
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

    // Setup zoom/pan (similar to LineChart)
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

          // Update areas (implementation would depend on whether stacked or single)
          // ... (similar to LineChart zoom implementation)

          // Callbacks
          if (enableZoom) onZoom?.(transform);
          if (enablePan) onPan?.(transform);
        });

      svg.call(zoom);
      zoomRef.current = zoom;
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
    opacity, gradient, stackedAreas, strokeWidth, enableZoom, enablePan, 
    thresholds, getCurveFunction, groupDataByCategory, createStackGenerator,
    createScales, startTracking, endTracking, onDataPointClick, onChartClick,
    onZoom, onPan, onHover, onLeave, onRender
  ]);

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

export default AreaChart;