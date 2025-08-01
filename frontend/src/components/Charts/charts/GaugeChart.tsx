/**
 * GaugeChart Component
 * Real-time metric visualization with threshold indicators
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';
import { GaugeChartProps, GaugeDataPoint, ChartDimensions } from '../types';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

const DEFAULT_START_ANGLE = -Math.PI * 0.75;
const DEFAULT_END_ANGLE = Math.PI * 0.75;
const DEFAULT_INNER_RADIUS_RATIO = 0.6;
const DEFAULT_OUTER_RADIUS_RATIO = 0.9;
const DEFAULT_NEEDLE_WIDTH = 6;

export const GaugeChart: React.FC<GaugeChartProps> = ({
  data,
  dimensions: propDimensions,
  className,
  ariaLabel = 'Gauge chart visualization',
  animation = { enabled: true, duration: 1000 },
  startAngle = DEFAULT_START_ANGLE,
  endAngle = DEFAULT_END_ANGLE,
  innerRadius: innerRadiusRatio = DEFAULT_INNER_RADIUS_RATIO,
  outerRadius: outerRadiusRatio = DEFAULT_OUTER_RADIUS_RATIO,
  needleWidth = DEFAULT_NEEDLE_WIDTH,
  showLabels = true,
  showTicks = true,
  tickCount = 10,
  colorScale: customColorScale,
  onDataPointClick,
  onHover,
  onLeave,
  onRender
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('GaugeChart');
  
  // Previous value for animation
  const previousValueRef = useRef<number>(data.min);

  /**
   * Calculate gauge dimensions
   */
  const calculateGaugeDimensions = useCallback((dimensions: ChartDimensions) => {
    const { width, height, margin } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;
    const innerRadius = radius * innerRadiusRatio;
    const outerRadius = radius * outerRadiusRatio;
    
    return {
      innerWidth,
      innerHeight,
      radius,
      innerRadius,
      outerRadius,
      centerX: innerWidth / 2,
      centerY: innerHeight / 2
    };
  }, [innerRadiusRatio, outerRadiusRatio]);

  /**
   * Create color scale
   */
  const createColorScale = useCallback(() => {
    if (customColorScale) {
      return d3.scaleLinear<string>()
        .domain(d3.range(data.min, data.max, (data.max - data.min) / (customColorScale.length - 1)).concat(data.max))
        .range(customColorScale);
    }

    // Default color scale based on thresholds
    const domain: number[] = [data.min];
    const range: string[] = [theme.colors.success];

    if (data.thresholds) {
      data.thresholds.forEach(threshold => {
        domain.push(threshold.value);
        range.push(threshold.color);
      });
    } else {
      // Default thresholds
      const mid = (data.min + data.max) / 2;
      const high = data.min + (data.max - data.min) * 0.75;
      
      domain.push(mid, high, data.max);
      range.push(theme.colors.warning, theme.colors.error, theme.colors.emergency);
    }

    return d3.scaleLinear<string>()
      .domain(domain)
      .range(range);
  }, [data, customColorScale, theme]);

  /**
   * Create angle scale
   */
  const createAngleScale = useCallback(() => {
    return d3.scaleLinear()
      .domain([data.min, data.max])
      .range([startAngle, endAngle])
      .clamp(true);
  }, [data.min, data.max, startAngle, endAngle]);

  /**
   * Render gauge
   */
  const renderGauge = useCallback((dimensions: ChartDimensions) => {
    if (!svgRef.current) return;

    startTracking();
    const renderStartTime = performance.now();

    const svg = d3.select(svgRef.current);
    const { width, height, margin } = dimensions;
    const { innerWidth, innerHeight, innerRadius, outerRadius, centerX, centerY } = calculateGaugeDimensions(dimensions);
    
    const colorScale = createColorScale();
    const angleScale = createAngleScale();

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
      .attr('transform', `translate(${margin.left + centerX},${margin.top + centerY})`);

    // Create arc generator
    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle);

    // Create background arc
    g.append('path')
      .datum({ endAngle })
      .attr('class', 'gauge-background')
      .attr('d', arc as any)
      .style('fill', theme.background.paper)
      .style('stroke', theme.grid.color)
      .style('stroke-width', 1);

    // Create colored segments
    const numSegments = customColorScale ? customColorScale.length : 20;
    const segmentAngle = (endAngle - startAngle) / numSegments;
    
    const segments = g.selectAll('.gauge-segment')
      .data(d3.range(numSegments))
      .enter()
      .append('path')
      .attr('class', 'gauge-segment')
      .attr('d', (d) => {
        const segmentStartAngle = startAngle + (d * segmentAngle);
        const segmentEndAngle = segmentStartAngle + segmentAngle;
        return arc({
          startAngle: segmentStartAngle,
          endAngle: segmentEndAngle
        } as any) || '';
      })
      .style('fill', (d) => {
        const value = data.min + (d / numSegments) * (data.max - data.min);
        return colorScale(value);
      })
      .style('stroke', theme.background.paper)
      .style('stroke-width', 0.5)
      .style('opacity', 0.8);

    // Add ticks
    if (showTicks) {
      const tickValues = d3.range(data.min, data.max + 1, (data.max - data.min) / tickCount);
      
      const ticks = g.selectAll('.gauge-tick')
        .data(tickValues)
        .enter()
        .append('g')
        .attr('class', 'gauge-tick')
        .attr('transform', d => `rotate(${angleScale(d) * 180 / Math.PI})`);

      ticks.append('line')
        .attr('x1', outerRadius - 10)
        .attr('x2', outerRadius)
        .attr('y1', 0)
        .attr('y2', 0)
        .style('stroke', theme.axis.color)
        .style('stroke-width', 2);

      if (showLabels) {
        ticks.append('text')
          .attr('x', outerRadius - 15)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .attr('text-anchor', 'end')
          .style('font-size', theme.text.fontSize.tick)
          .style('font-family', theme.text.fontFamily)
          .style('fill', theme.text.secondary)
          .text(d => d3.format('.0f')(d))
          .attr('transform', d => {
            const angle = angleScale(d);
            return `rotate(${-angle * 180 / Math.PI})`;
          });
      }
    }

    // Add threshold markers
    if (data.thresholds) {
      const thresholdMarkers = g.selectAll('.gauge-threshold')
        .data(data.thresholds)
        .enter()
        .append('g')
        .attr('class', 'gauge-threshold')
        .attr('transform', d => `rotate(${angleScale(d.value) * 180 / Math.PI})`);

      thresholdMarkers.append('line')
        .attr('x1', innerRadius - 5)
        .attr('x2', outerRadius + 5)
        .attr('y1', 0)
        .attr('y2', 0)
        .style('stroke', d => d.color)
        .style('stroke-width', 3)
        .style('stroke-dasharray', '5,3');

      if (showLabels) {
        thresholdMarkers.append('text')
          .attr('x', outerRadius + 10)
          .attr('y', 0)
          .attr('dy', '0.35em')
          .style('font-size', theme.text.fontSize.label)
          .style('font-family', theme.text.fontFamily)
          .style('fill', d => d.color)
          .style('font-weight', 'bold')
          .text(d => d.label)
          .attr('transform', d => {
            const angle = angleScale(d.value);
            return `rotate(${-angle * 180 / Math.PI})`;
          });
      }
    }

    // Create needle
    const needleLength = outerRadius + 15;
    const needleRadius = needleWidth / 2;
    
    const needle = g.append('g')
      .attr('class', 'gauge-needle')
      .style('cursor', onDataPointClick ? 'pointer' : 'default');

    // Needle path
    const needlePath = needle.append('path')
      .attr('d', `
        M ${-needleRadius} 0
        L 0 ${-needleLength}
        L ${needleRadius} 0
        L ${needleRadius} ${needleLength * 0.2}
        L ${-needleRadius} ${needleLength * 0.2}
        Z
      `)
      .style('fill', theme.text.primary)
      .style('stroke', theme.background.paper)
      .style('stroke-width', 1);

    // Needle center circle
    needle.append('circle')
      .attr('r', needleRadius * 2)
      .style('fill', theme.text.primary)
      .style('stroke', theme.background.paper)
      .style('stroke-width', 2);

    // Animate needle to current value
    const currentAngle = angleScale(data.value);
    const previousAngle = angleScale(previousValueRef.current);
    
    if (animation.enabled) {
      needle
        .attr('transform', `rotate(${previousAngle * 180 / Math.PI})`)
        .transition()
        .duration(animation.duration)
        .ease(d3.easeCubicInOut)
        .attr('transform', `rotate(${currentAngle * 180 / Math.PI})`);
    } else {
      needle.attr('transform', `rotate(${currentAngle * 180 / Math.PI})`);
    }

    // Update previous value
    previousValueRef.current = data.value;

    // Value display
    const valueDisplay = g.append('g')
      .attr('class', 'gauge-value');

    valueDisplay.append('text')
      .attr('y', innerRadius * 0.3)
      .attr('text-anchor', 'middle')
      .style('font-size', theme.text.fontSize.title * 2)
      .style('font-family', theme.text.fontFamily)
      .style('font-weight', 'bold')
      .style('fill', colorScale(data.value))
      .text('0');

    // Animate value
    if (animation.enabled) {
      valueDisplay.select('text')
        .transition()
        .duration(animation.duration)
        .tween('text', function() {
          const interpolate = d3.interpolate(previousValueRef.current, data.value);
          return function(t) {
            this.textContent = d3.format('.1f')(interpolate(t));
          };
        });
    } else {
      valueDisplay.select('text').text(d3.format('.1f')(data.value));
    }

    // Min/Max labels
    if (showLabels) {
      // Min label
      g.append('text')
        .attr('x', Math.cos(startAngle) * (outerRadius + 20))
        .attr('y', Math.sin(startAngle) * (outerRadius + 20))
        .attr('text-anchor', 'middle')
        .style('font-size', theme.text.fontSize.label)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.text.secondary)
        .text(data.min);

      // Max label
      g.append('text')
        .attr('x', Math.cos(endAngle) * (outerRadius + 20))
        .attr('y', Math.sin(endAngle) * (outerRadius + 20))
        .attr('text-anchor', 'middle')
        .style('font-size', theme.text.fontSize.label)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.text.secondary)
        .text(data.max);
    }

    // Interactions
    needle
      .on('click', (event) => {
        event.stopPropagation();
        onDataPointClick?.(data, event);
      })
      .on('mouseenter', (event) => {
        needle.select('path')
          .transition()
          .duration(100)
          .style('fill', theme.colors.primary[2]);
        
        onHover?.(data, event);
      })
      .on('mouseleave', (event) => {
        needle.select('path')
          .transition()
          .duration(100)
          .style('fill', theme.text.primary);
        
        onLeave?.(event);
      });

    const renderTime = performance.now() - renderStartTime;
    endTracking();
    onRender?.(renderTime);
  }, [
    data, theme, ariaLabel, animation, startAngle, endAngle,
    needleWidth, showLabels, showTicks, tickCount,
    calculateGaugeDimensions, createColorScale, createAngleScale,
    startTracking, endTracking, onDataPointClick, onHover, onLeave, onRender
  ]);

  // Render with responsive container
  const chartContent = useCallback((dimensions: ChartDimensions) => (
    <Box position="relative" width={dimensions.width} height={dimensions.height}>
      <svg ref={svgRef} />
    </Box>
  ), []);

  // Effect to render chart when data or dimensions change
  useEffect(() => {
    if (propDimensions) {
      renderGauge(propDimensions);
    }
  }, [propDimensions, data, renderGauge]);

  if (propDimensions) {
    return chartContent(propDimensions);
  }

  return (
    <ResponsiveContainer className={className} aspectRatio={1.5} minHeight={200}>
      {(dimensions) => {
        // Render chart when dimensions are available
        setTimeout(() => renderGauge(dimensions), 0);
        return chartContent(dimensions);
      }}
    </ResponsiveContainer>
  );
};

export default GaugeChart;