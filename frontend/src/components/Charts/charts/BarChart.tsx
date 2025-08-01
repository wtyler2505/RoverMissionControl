/**
 * BarChart Component
 * Categorical data visualization with grouping and stacking support
 */

import React, { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { Box } from '@mui/material';
import { BarChartProps, ChartDataPoint, ChartDimensions } from '../types';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { useChartTheme } from '../base/ChartThemeProvider';
import { useComponentPerformanceTracking } from '../../../hooks/usePerformanceMonitoring';

const DEFAULT_ANIMATION_DURATION = 300;
const DEFAULT_BAR_PADDING = 0.1;
const DEFAULT_CORNER_RADIUS = 4;

export const BarChart: React.FC<BarChartProps> = ({
  data,
  dimensions: propDimensions,
  className,
  ariaLabel = 'Bar chart visualization',
  animation = { enabled: true, duration: DEFAULT_ANIMATION_DURATION },
  tooltip = { enabled: true },
  legend = { enabled: true, position: 'top', orientation: 'horizontal' },
  xAxis = {},
  yAxis = {},
  orientation = 'vertical',
  grouped = false,
  stacked = false,
  barPadding = DEFAULT_BAR_PADDING,
  cornerRadius = DEFAULT_CORNER_RADIUS,
  onDataPointClick,
  onChartClick,
  onHover,
  onLeave,
  onRender
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const theme = useChartTheme();
  const { startTracking, endTracking } = useComponentPerformanceTracking('BarChart');

  /**
   * Process data for grouping or stacking
   */
  const processData = useCallback(() => {
    if (stacked) {
      // Group data by x value and stack by category
      const groupedData = d3.group(data, d => d.x);
      const categories = [...new Set(data.map(d => d.category || 'default'))];
      
      const stackData = Array.from(groupedData, ([x, values]) => {
        const point: any = { x };
        let cumulative = 0;
        
        categories.forEach(category => {
          const value = values.find(v => (v.category || 'default') === category)?.y || 0;
          point[category] = value;
          point[`${category}_start`] = cumulative;
          point[`${category}_end`] = cumulative + value;
          cumulative += value;
        });
        
        return point;
      });
      
      return { stackData, categories, type: 'stacked' };
    } else if (grouped) {
      // Group data by x value
      const groupedData = d3.group(data, d => d.x);
      const categories = [...new Set(data.map(d => d.category || 'default'))];
      
      return { 
        groupedData: Array.from(groupedData), 
        categories, 
        type: 'grouped' 
      };
    } else {
      // Simple bar chart
      return { data, type: 'simple' };
    }
  }, [data, stacked, grouped]);

  /**
   * Create scales
   */
  const createScales = useCallback((dimensions: ChartDimensions) => {
    const { width, height, margin } = dimensions;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const processedData = processData();

    let xScale: d3.ScaleBand<string> | d3.ScaleLinear<number, number>;
    let yScale: d3.ScaleBand<string> | d3.ScaleLinear<number, number>;
    let colorScale: d3.ScaleOrdinal<string, string>;

    if (orientation === 'vertical') {
      // X Scale (categorical)
      const xDomain = xAxis.domain as string[] || [...new Set(data.map(d => String(d.x)))];
      xScale = d3.scaleBand()
        .domain(xDomain)
        .range([0, innerWidth])
        .padding(barPadding);

      // Y Scale (numerical)
      let yExtent: [number, number];
      if (stacked && processedData.type === 'stacked') {
        yExtent = [0, d3.max(processedData.stackData, (d: any) => {
          return d3.sum(processedData.categories, cat => d[cat] || 0);
        }) || 0];
      } else {
        yExtent = yAxis.domain as [number, number] || [0, d3.max(data, d => d.y) || 0];
      }
      
      yScale = d3.scaleLinear()
        .domain(yExtent)
        .range([innerHeight, 0])
        .nice();
    } else {
      // Horizontal orientation
      // Y Scale (categorical)
      const yDomain = yAxis.domain as string[] || [...new Set(data.map(d => String(d.x)))];
      yScale = d3.scaleBand()
        .domain(yDomain)
        .range([innerHeight, 0])
        .padding(barPadding);

      // X Scale (numerical)
      let xExtent: [number, number];
      if (stacked && processedData.type === 'stacked') {
        xExtent = [0, d3.max(processedData.stackData, (d: any) => {
          return d3.sum(processedData.categories, cat => d[cat] || 0);
        }) || 0];
      } else {
        xExtent = xAxis.domain as [number, number] || [0, d3.max(data, d => d.y) || 0];
      }
      
      xScale = d3.scaleLinear()
        .domain(xExtent)
        .range([0, innerWidth])
        .nice();
    }

    // Color scale
    if (processedData.type !== 'simple') {
      colorScale = d3.scaleOrdinal<string>()
        .domain(processedData.categories)
        .range(theme.colors.categorical);
    } else {
      colorScale = d3.scaleOrdinal<string>()
        .domain(['default'])
        .range([theme.colors.primary[2]]);
    }

    return { xScale, yScale, colorScale, innerWidth, innerHeight };
  }, [data, processData, orientation, xAxis.domain, yAxis.domain, barPadding, stacked, theme]);

  /**
   * Render chart
   */
  const renderChart = useCallback((dimensions: ChartDimensions) => {
    if (!svgRef.current || data.length === 0) return;

    startTracking();
    const renderStartTime = performance.now();

    const svg = d3.select(svgRef.current);
    const { width, height, margin } = dimensions;
    const { xScale, yScale, colorScale, innerWidth, innerHeight } = createScales(dimensions);
    const processedData = processData();

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

    // Grid lines
    if (orientation === 'vertical') {
      if (yAxis.gridLines !== false) {
        g.append('g')
          .attr('class', 'grid grid-y')
          .call(
            d3.axisLeft(yScale as d3.ScaleLinear<number, number>)
              .tickSize(-innerWidth)
              .tickFormat(() => '')
          )
          .style('stroke-dasharray', theme.grid.dashArray)
          .style('stroke', theme.grid.color)
          .style('stroke-width', theme.grid.strokeWidth)
          .style('opacity', theme.grid.opacity);
      }
    } else {
      if (xAxis.gridLines !== false) {
        g.append('g')
          .attr('class', 'grid grid-x')
          .attr('transform', `translate(0,${innerHeight})`)
          .call(
            d3.axisBottom(xScale as d3.ScaleLinear<number, number>)
              .tickSize(-innerHeight)
              .tickFormat(() => '')
          )
          .style('stroke-dasharray', theme.grid.dashArray)
          .style('stroke', theme.grid.color)
          .style('stroke-width', theme.grid.strokeWidth)
          .style('opacity', theme.grid.opacity);
      }
    }

    // Render bars based on type
    if (processedData.type === 'stacked') {
      // Stacked bars
      const { stackData, categories } = processedData;
      
      const barGroups = g.selectAll('.bar-group')
        .data(stackData)
        .enter()
        .append('g')
        .attr('class', 'bar-group');

      categories.forEach((category, categoryIndex) => {
        const bars = barGroups.append('rect')
          .attr('class', `bar bar-${category}`)
          .style('fill', colorScale(category))
          .style('stroke', theme.background.paper)
          .style('stroke-width', 1)
          .style('cursor', onDataPointClick ? 'pointer' : 'default');

        if (orientation === 'vertical') {
          bars
            .attr('x', (d: any) => (xScale as d3.ScaleBand<string>)(String(d.x)) || 0)
            .attr('width', (xScale as d3.ScaleBand<string>).bandwidth())
            .attr('y', innerHeight)
            .attr('height', 0)
            .attr('rx', cornerRadius)
            .attr('ry', cornerRadius);

          // Animation
          if (animation.enabled) {
            bars
              .transition()
              .duration(animation.duration)
              .delay(categoryIndex * 50)
              .attr('y', (d: any) => (yScale as d3.ScaleLinear<number, number>)(d[`${category}_end`]))
              .attr('height', (d: any) => {
                const startY = (yScale as d3.ScaleLinear<number, number>)(d[`${category}_start`]);
                const endY = (yScale as d3.ScaleLinear<number, number>)(d[`${category}_end`]);
                return startY - endY;
              });
          } else {
            bars
              .attr('y', (d: any) => (yScale as d3.ScaleLinear<number, number>)(d[`${category}_end`]))
              .attr('height', (d: any) => {
                const startY = (yScale as d3.ScaleLinear<number, number>)(d[`${category}_start`]);
                const endY = (yScale as d3.ScaleLinear<number, number>)(d[`${category}_end`]);
                return startY - endY;
              });
          }
        } else {
          // Horizontal orientation
          bars
            .attr('y', (d: any) => (yScale as d3.ScaleBand<string>)(String(d.x)) || 0)
            .attr('height', (yScale as d3.ScaleBand<string>).bandwidth())
            .attr('x', 0)
            .attr('width', 0)
            .attr('rx', cornerRadius)
            .attr('ry', cornerRadius);

          // Animation
          if (animation.enabled) {
            bars
              .transition()
              .duration(animation.duration)
              .delay(categoryIndex * 50)
              .attr('x', (d: any) => (xScale as d3.ScaleLinear<number, number>)(d[`${category}_start`]))
              .attr('width', (d: any) => {
                const startX = (xScale as d3.ScaleLinear<number, number>)(d[`${category}_start`]);
                const endX = (xScale as d3.ScaleLinear<number, number>)(d[`${category}_end`]);
                return endX - startX;
              });
          } else {
            bars
              .attr('x', (d: any) => (xScale as d3.ScaleLinear<number, number>)(d[`${category}_start`]))
              .attr('width', (d: any) => {
                const startX = (xScale as d3.ScaleLinear<number, number>)(d[`${category}_start`]);
                const endX = (xScale as d3.ScaleLinear<number, number>)(d[`${category}_end`]);
                return endX - startX;
              });
          }
        }

        // Bar interactions
        bars
          .on('click', (event, d: any) => {
            event.stopPropagation();
            const originalData = data.find(item => 
              String(item.x) === String(d.x) && (item.category || 'default') === category
            );
            if (originalData) {
              onDataPointClick?.(originalData, event);
            }
          })
          .on('mouseenter', function(event, d: any) {
            d3.select(this)
              .transition()
              .duration(100)
              .style('fill', d3.color(colorScale(category))?.brighter(0.2)?.toString() || colorScale(category));
            
            const originalData = data.find(item => 
              String(item.x) === String(d.x) && (item.category || 'default') === category
            );
            if (originalData) {
              showTooltip(originalData, event);
              onHover?.(originalData, event);
            }
          })
          .on('mouseleave', function(event, d: any) {
            d3.select(this)
              .transition()
              .duration(100)
              .style('fill', colorScale(category));
            
            hideTooltip();
            onLeave?.(event);
          });
      });
    } else if (processedData.type === 'grouped') {
      // Grouped bars
      const { groupedData, categories } = processedData;
      const subScale = d3.scaleBand()
        .domain(categories)
        .range([0, (orientation === 'vertical' ? (xScale as d3.ScaleBand<string>) : (yScale as d3.ScaleBand<string>)).bandwidth()])
        .padding(0.05);

      const barGroups = g.selectAll('.bar-group')
        .data(groupedData)
        .enter()
        .append('g')
        .attr('class', 'bar-group');

      barGroups.each(function([x, values]) {
        const group = d3.select(this);
        
        const bars = group.selectAll('.bar')
          .data(values)
          .enter()
          .append('rect')
          .attr('class', 'bar')
          .style('fill', d => colorScale(d.category || 'default'))
          .style('stroke', theme.background.paper)
          .style('stroke-width', 1)
          .style('cursor', onDataPointClick ? 'pointer' : 'default')
          .attr('rx', cornerRadius)
          .attr('ry', cornerRadius);

        if (orientation === 'vertical') {
          bars
            .attr('x', d => ((xScale as d3.ScaleBand<string>)(String(x)) || 0) + subScale(d.category || 'default')!)
            .attr('width', subScale.bandwidth())
            .attr('y', innerHeight)
            .attr('height', 0);

          // Animation
          if (animation.enabled) {
            bars
              .transition()
              .duration(animation.duration)
              .delay((d, i) => i * 50)
              .attr('y', d => (yScale as d3.ScaleLinear<number, number>)(d.y))
              .attr('height', d => innerHeight - (yScale as d3.ScaleLinear<number, number>)(d.y));
          } else {
            bars
              .attr('y', d => (yScale as d3.ScaleLinear<number, number>)(d.y))
              .attr('height', d => innerHeight - (yScale as d3.ScaleLinear<number, number>)(d.y));
          }
        } else {
          // Horizontal orientation
          bars
            .attr('y', d => ((yScale as d3.ScaleBand<string>)(String(x)) || 0) + subScale(d.category || 'default')!)
            .attr('height', subScale.bandwidth())
            .attr('x', 0)
            .attr('width', 0);

          // Animation
          if (animation.enabled) {
            bars
              .transition()
              .duration(animation.duration)
              .delay((d, i) => i * 50)
              .attr('width', d => (xScale as d3.ScaleLinear<number, number>)(d.y));
          } else {
            bars
              .attr('width', d => (xScale as d3.ScaleLinear<number, number>)(d.y));
          }
        }

        // Bar interactions
        bars
          .on('click', (event, d) => {
            event.stopPropagation();
            onDataPointClick?.(d, event);
          })
          .on('mouseenter', function(event, d) {
            d3.select(this)
              .transition()
              .duration(100)
              .style('fill', d3.color(colorScale(d.category || 'default'))?.brighter(0.2)?.toString() || colorScale(d.category || 'default'));
            
            showTooltip(d, event);
            onHover?.(d, event);
          })
          .on('mouseleave', function(event, d) {
            d3.select(this)
              .transition()
              .duration(100)
              .style('fill', colorScale(d.category || 'default'));
            
            hideTooltip();
            onLeave?.(event);
          });
      });
    } else {
      // Simple bars
      const bars = g.selectAll('.bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .style('fill', colorScale('default'))
        .style('stroke', theme.background.paper)
        .style('stroke-width', 1)
        .style('cursor', onDataPointClick ? 'pointer' : 'default')
        .attr('rx', cornerRadius)
        .attr('ry', cornerRadius);

      if (orientation === 'vertical') {
        bars
          .attr('x', d => (xScale as d3.ScaleBand<string>)(String(d.x)) || 0)
          .attr('width', (xScale as d3.ScaleBand<string>).bandwidth())
          .attr('y', innerHeight)
          .attr('height', 0);

        // Animation
        if (animation.enabled) {
          bars
            .transition()
            .duration(animation.duration)
            .delay((d, i) => i * 20)
            .attr('y', d => (yScale as d3.ScaleLinear<number, number>)(d.y))
            .attr('height', d => innerHeight - (yScale as d3.ScaleLinear<number, number>)(d.y));
        } else {
          bars
            .attr('y', d => (yScale as d3.ScaleLinear<number, number>)(d.y))
            .attr('height', d => innerHeight - (yScale as d3.ScaleLinear<number, number>)(d.y));
        }
      } else {
        // Horizontal orientation
        bars
          .attr('y', d => (yScale as d3.ScaleBand<string>)(String(d.x)) || 0)
          .attr('height', (yScale as d3.ScaleBand<string>).bandwidth())
          .attr('x', 0)
          .attr('width', 0);

        // Animation
        if (animation.enabled) {
          bars
            .transition()
            .duration(animation.duration)
            .delay((d, i) => i * 20)
            .attr('width', d => (xScale as d3.ScaleLinear<number, number>)(d.y));
        } else {
          bars
            .attr('width', d => (xScale as d3.ScaleLinear<number, number>)(d.y));
        }
      }

      // Bar interactions
      bars
        .on('click', (event, d) => {
          event.stopPropagation();
          onDataPointClick?.(d, event);
        })
        .on('mouseenter', function(event, d) {
          d3.select(this)
            .transition()
            .duration(100)
            .style('fill', d3.color(colorScale('default'))?.brighter(0.2)?.toString() || colorScale('default'));
          
          showTooltip(d, event);
          onHover?.(d, event);
        })
        .on('mouseleave', function(event, d) {
          d3.select(this)
            .transition()
            .duration(100)
            .style('fill', colorScale('default'));
          
          hideTooltip();
          onLeave?.(event);
        });
    }

    // Axes
    if (orientation === 'vertical') {
      // X Axis
      const xAxisGroup = g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3.axisBottom(xScale as d3.ScaleBand<string>)
            .tickFormat(xAxis.tickFormat || (d => String(d)))
        );

      xAxisGroup.selectAll('text')
        .style('font-size', theme.axis.fontSize)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.axis.color);

      xAxisGroup.selectAll('line, path')
        .style('stroke', theme.axis.color)
        .style('stroke-width', theme.axis.strokeWidth);

      // Y Axis
      const yAxisGroup = g.append('g')
        .attr('class', 'y-axis')
        .call(
          d3.axisLeft(yScale as d3.ScaleLinear<number, number>)
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
    } else {
      // Horizontal orientation - swap axes
      // X Axis
      const xAxisGroup = g.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(
          d3.axisBottom(xScale as d3.ScaleLinear<number, number>)
            .tickFormat(xAxis.tickFormat || d3.format('.1f'))
            .ticks(xAxis.tickCount || 5)
        );

      xAxisGroup.selectAll('text')
        .style('font-size', theme.axis.fontSize)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.axis.color);

      xAxisGroup.selectAll('line, path')
        .style('stroke', theme.axis.color)
        .style('stroke-width', theme.axis.strokeWidth);

      // Y Axis
      const yAxisGroup = g.append('g')
        .attr('class', 'y-axis')
        .call(
          d3.axisLeft(yScale as d3.ScaleBand<string>)
            .tickFormat(yAxis.tickFormat || (d => String(d)))
        );

      yAxisGroup.selectAll('text')
        .style('font-size', theme.axis.fontSize)
        .style('font-family', theme.text.fontFamily)
        .style('fill', theme.axis.color);

      yAxisGroup.selectAll('line, path')
        .style('stroke', theme.axis.color)
        .style('stroke-width', theme.axis.strokeWidth);
    }

    // Axis labels
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
    data, theme, ariaLabel, animation, xAxis, yAxis, orientation,
    grouped, stacked, barPadding, cornerRadius, processData, createScales,
    startTracking, endTracking, onDataPointClick, onChartClick,
    onHover, onLeave, onRender
  ]);

  /**
   * Show tooltip
   */
  const showTooltip = useCallback((dataPoint: ChartDataPoint, event: MouseEvent) => {
    if (!tooltipRef.current || !tooltip.enabled) return;

    const content = tooltip.format ? tooltip.format(dataPoint) : `
      <div style="padding: 4px;">
        <div><strong>${dataPoint.x}</strong></div>
        <div>Value: ${typeof dataPoint.y === 'number' ? dataPoint.y.toFixed(2) : dataPoint.y}</div>
        ${dataPoint.category ? `<div>Category: ${dataPoint.category}</div>` : ''}
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
    <ResponsiveContainer className={className} aspectRatio={orientation === 'vertical' ? 1.5 : 1.2}>
      {(dimensions) => {
        // Render chart when dimensions are available
        setTimeout(() => renderChart(dimensions), 0);
        return chartContent(dimensions);
      }}
    </ResponsiveContainer>
  );
};

export default BarChart;