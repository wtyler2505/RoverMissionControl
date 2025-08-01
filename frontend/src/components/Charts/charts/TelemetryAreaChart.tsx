import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { BaseChart } from '../base/BaseChart';
import { ChartProps } from '../../../types/chart.types';

export interface TelemetryAreaData {
  timestamp: number;
  values: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface TelemetryAreaChartProps extends ChartProps {
  data: TelemetryAreaData[];
  series: string[];
  stacked?: boolean;
  interpolation?: 'linear' | 'monotone' | 'step' | 'basis' | 'cardinal';
  showPoints?: boolean;
  pointRadius?: number;
  fillOpacity?: number;
  showGrid?: boolean;
  colorScale?: d3.ScaleOrdinal<string, string>;
  thresholds?: Record<string, { value: number; color: string; label?: string }[]>;
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  enableBrush?: boolean;
  onBrushEnd?: (selection: [number, number] | null) => void;
  onPointHover?: (data: { timestamp: number; series: string; value: number } | null) => void;
  onAreaClick?: (series: string) => void;
}

export const TelemetryAreaChart: React.FC<TelemetryAreaChartProps> = ({
  data,
  series,
  stacked = false,
  interpolation = 'monotone',
  showPoints = false,
  pointRadius = 3,
  fillOpacity = 0.7,
  showGrid = true,
  colorScale,
  thresholds = {},
  showLegend = true,
  legendPosition = 'right',
  enableBrush = false,
  onBrushEnd,
  onPointHover,
  onAreaClick,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const brushRef = useRef<d3.BrushBehavior<unknown>>();

  const defaultColorScale = useMemo(() => {
    return d3.scaleOrdinal(d3.schemeCategory10).domain(series);
  }, [series]);

  const actualColorScale = colorScale || defaultColorScale;

  // Process data for stacking if needed
  const processedData = useMemo(() => {
    if (!stacked) {
      return data;
    }

    // Create stack generator
    const stack = d3.stack<TelemetryAreaData>()
      .keys(series)
      .value((d, key) => d.values[key] || 0)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    return stack(data);
  }, [data, series, stacked]);

  const renderChart = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const legendWidth = showLegend && (legendPosition === 'left' || legendPosition === 'right') ? 120 : 0;
    const legendHeight = showLegend && (legendPosition === 'top' || legendPosition === 'bottom') ? 40 : 0;

    const margin = {
      top: 20 + (legendPosition === 'top' ? legendHeight : 0),
      right: 20 + (legendPosition === 'right' ? legendWidth : 0),
      bottom: 60 + (legendPosition === 'bottom' ? legendHeight : 0),
      left: 60 + (legendPosition === 'left' ? legendWidth : 0)
    };

    const width = (baseProps.width || 600) - margin.left - margin.right;
    const height = (baseProps.height || 400) - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    // Add defs for gradients and patterns
    const defs = svg.append('defs');

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.timestamp) as [number, number])
      .range([0, width]);

    let yScale: d3.ScaleLinear<number, number>;
    
    if (stacked) {
      const maxValue = d3.max(data, d => 
        d3.sum(series, s => d.values[s] || 0)
      ) || 0;
      yScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1])
        .range([height, 0]);
    } else {
      const maxValue = d3.max(data, d => 
        d3.max(series, s => d.values[s] || 0)
      ) || 0;
      yScale = d3.scaleLinear()
        .domain([0, maxValue * 1.1])
        .range([height, 0]);
    }

    // Add grid
    if (showGrid) {
      const xGrid = d3.axisBottom(xScale)
        .tickSize(-height)
        .tickFormat(() => '');

      const yGrid = d3.axisLeft(yScale)
        .tickSize(-width)
        .tickFormat(() => '');

      g.append('g')
        .attr('class', 'grid x-grid')
        .attr('transform', `translate(0,${height})`)
        .call(xGrid)
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);

      g.append('g')
        .attr('class', 'grid y-grid')
        .call(yGrid)
        .style('stroke-dasharray', '3,3')
        .style('opacity', 0.3);
    }

    // Create axes
    const xAxis = d3.axisBottom(xScale)
      .tickFormat(d => d3.timeFormat('%H:%M:%S')(new Date(d as number)));

    const yAxis = d3.axisLeft(yScale);

    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);

    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);

    // Add axis labels
    g.append('text')
      .attr('class', 'x-axis-label')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + 40)
      .text('Time');

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .text('Value');

    // Create area generator
    const curveType = {
      linear: d3.curveLinear,
      monotone: d3.curveMonotoneX,
      step: d3.curveStep,
      basis: d3.curveBasis,
      cardinal: d3.curveCardinal
    }[interpolation];

    // Draw threshold areas
    Object.entries(thresholds).forEach(([seriesName, seriesThresholds]) => {
      if (!series.includes(seriesName)) return;

      seriesThresholds.forEach((threshold, i) => {
        const gradientId = `threshold-gradient-${seriesName}-${i}-${Date.now()}`;
        
        const gradient = defs.append('linearGradient')
          .attr('id', gradientId)
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');

        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', threshold.color)
          .attr('stop-opacity', 0.3);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', threshold.color)
          .attr('stop-opacity', 0.1);

        g.append('rect')
          .attr('class', `threshold-area threshold-${seriesName}`)
          .attr('x', 0)
          .attr('y', yScale(threshold.value))
          .attr('width', width)
          .attr('height', Math.max(0, height - yScale(threshold.value)))
          .attr('fill', `url(#${gradientId})`);

        // Add threshold line
        g.append('line')
          .attr('class', `threshold-line threshold-${seriesName}`)
          .attr('x1', 0)
          .attr('x2', width)
          .attr('y1', yScale(threshold.value))
          .attr('y2', yScale(threshold.value))
          .attr('stroke', threshold.color)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5');

        // Add threshold label
        if (threshold.label) {
          g.append('text')
            .attr('class', `threshold-label threshold-${seriesName}`)
            .attr('x', width - 5)
            .attr('y', yScale(threshold.value) - 5)
            .attr('text-anchor', 'end')
            .attr('font-size', '12px')
            .attr('fill', threshold.color)
            .text(threshold.label);
        }
      });
    });

    if (stacked) {
      // Draw stacked areas
      const area = d3.area<d3.SeriesPoint<TelemetryAreaData>>()
        .x(d => xScale(d.data.timestamp))
        .y0(d => yScale(d[0]))
        .y1(d => yScale(d[1]))
        .curve(curveType);

      const areas = g.append('g')
        .attr('class', 'areas')
        .selectAll('path')
        .data(processedData as d3.Series<TelemetryAreaData, string>[])
        .enter()
        .append('path')
        .attr('class', d => `area area-${d.key}`)
        .attr('d', area)
        .attr('fill', d => actualColorScale(d.key))
        .attr('opacity', 0)
        .on('click', function(event, d) {
          if (onAreaClick) {
            onAreaClick(d.key);
          }
        });

      // Animate areas
      areas.transition()
        .duration(1000)
        .attr('opacity', fillOpacity);

      // Add hover effects
      areas.on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1);
        
        // Highlight corresponding legend item
        d3.selectAll(`.legend-item-${d.key}`)
          .style('font-weight', 'bold');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('opacity', fillOpacity);
        
        d3.selectAll(`.legend-item-${d.key}`)
          .style('font-weight', 'normal');
      });

    } else {
      // Draw individual areas
      series.forEach((seriesName, idx) => {
        const seriesData = data.map(d => ({
          timestamp: d.timestamp,
          value: d.values[seriesName] || 0,
          metadata: d.metadata
        }));

        const area = d3.area<typeof seriesData[0]>()
          .x(d => xScale(d.timestamp))
          .y0(height)
          .y1(d => yScale(d.value))
          .curve(curveType);

        const line = d3.line<typeof seriesData[0]>()
          .x(d => xScale(d.timestamp))
          .y(d => yScale(d.value))
          .curve(curveType);

        // Create gradient for area fill
        const gradientId = `area-gradient-${seriesName}-${Date.now()}`;
        const gradient = defs.append('linearGradient')
          .attr('id', gradientId)
          .attr('x1', '0%')
          .attr('y1', '0%')
          .attr('x2', '0%')
          .attr('y2', '100%');

        const color = actualColorScale(seriesName);
        gradient.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', color)
          .attr('stop-opacity', fillOpacity);

        gradient.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', color)
          .attr('stop-opacity', fillOpacity * 0.3);

        // Draw area
        const areaPath = g.append('path')
          .datum(seriesData)
          .attr('class', `area area-${seriesName}`)
          .attr('d', area)
          .attr('fill', `url(#${gradientId})`)
          .attr('opacity', 0)
          .on('click', function() {
            if (onAreaClick) {
              onAreaClick(seriesName);
            }
          });

        // Draw line
        const linePath = g.append('path')
          .datum(seriesData)
          .attr('class', `line line-${seriesName}`)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('opacity', 0);

        // Animate area and line
        areaPath.transition()
          .duration(1000)
          .delay(idx * 100)
          .attr('opacity', 1);

        linePath.transition()
          .duration(1000)
          .delay(idx * 100)
          .attr('opacity', 1);

        // Add points if requested
        if (showPoints) {
          const points = g.append('g')
            .attr('class', `points points-${seriesName}`)
            .selectAll('circle')
            .data(seriesData)
            .enter()
            .append('circle')
            .attr('cx', d => xScale(d.timestamp))
            .attr('cy', d => yScale(d.value))
            .attr('r', 0)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .on('mouseover', function(event, d) {
              d3.select(this)
                .attr('r', pointRadius * 1.5)
                .attr('stroke-width', 2);

              if (onPointHover) {
                onPointHover({
                  timestamp: d.timestamp,
                  series: seriesName,
                  value: d.value
                });
              }

              // Show tooltip
              const tooltip = d3.select('body')
                .append('div')
                .attr('class', 'telemetry-area-tooltip')
                .style('position', 'absolute')
                .style('background', 'rgba(0, 0, 0, 0.8)')
                .style('color', 'white')
                .style('padding', '8px')
                .style('border-radius', '4px')
                .style('font-size', '12px')
                .style('pointer-events', 'none')
                .style('opacity', 0);

              tooltip.transition()
                .duration(200)
                .style('opacity', 1);

              tooltip.html(`
                <div>${seriesName}</div>
                <div>Time: ${d3.timeFormat('%H:%M:%S')(new Date(d.timestamp))}</div>
                <div>Value: ${d.value.toFixed(2)}</div>
              `)
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px');
            })
            .on('mouseout', function() {
              d3.select(this)
                .attr('r', pointRadius)
                .attr('stroke-width', 1);

              if (onPointHover) {
                onPointHover(null);
              }

              d3.select('.telemetry-area-tooltip').remove();
            });

          // Animate points
          points.transition()
            .duration(1000)
            .delay((d, i) => idx * 100 + i * 5)
            .attr('r', pointRadius);
        }
      });
    }

    // Add brush
    if (enableBrush) {
      const brush = d3.brushX<unknown>()
        .extent([[0, 0], [width, height]])
        .on('end', (event) => {
          if (onBrushEnd) {
            if (event.selection) {
              const [x0, x1] = event.selection as [number, number];
              onBrushEnd([xScale.invert(x0).getTime(), xScale.invert(x1).getTime()]);
            } else {
              onBrushEnd(null);
            }
          }
        });

      brushRef.current = brush;

      g.append('g')
        .attr('class', 'brush')
        .call(brush);
    }

    // Add legend
    if (showLegend) {
      let legendG: d3.Selection<SVGGElement, unknown, null, undefined>;
      
      switch (legendPosition) {
        case 'top':
          legendG = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${margin.left}, 10)`);
          break;
        case 'bottom':
          legendG = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${margin.left}, ${height + margin.top + 40})`);
          break;
        case 'left':
          legendG = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(10, ${margin.top})`);
          break;
        case 'right':
        default:
          legendG = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + margin.left + 20}, ${margin.top})`);
          break;
      }

      const isHorizontal = legendPosition === 'top' || legendPosition === 'bottom';
      
      const legendItems = legendG.selectAll('.legend-item')
        .data(series)
        .enter()
        .append('g')
        .attr('class', d => `legend-item legend-item-${d}`)
        .attr('transform', (d, i) => 
          isHorizontal 
            ? `translate(${i * 120}, 0)`
            : `translate(0, ${i * 20})`
        )
        .style('cursor', 'pointer')
        .on('click', function(event, d) {
          // Toggle series visibility
          const isHidden = d3.select(`.area-${d}`).style('display') === 'none';
          
          d3.selectAll(`.area-${d}, .line-${d}, .points-${d}`)
            .style('display', isHidden ? null : 'none');
          
          d3.select(this)
            .style('opacity', isHidden ? 1 : 0.5);
        });

      legendItems.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', d => actualColorScale(d));

      legendItems.append('text')
        .attr('x', 20)
        .attr('y', 12)
        .attr('font-size', '12px')
        .attr('fill', '#666')
        .text(d => d);
    }
  };

  useEffect(() => {
    if (svgRef.current && data.length > 0) {
      const svg = d3.select(svgRef.current);
      renderChart(svg);
    }
  }, [data, series, stacked, interpolation, showPoints, pointRadius, 
      fillOpacity, showGrid, actualColorScale, thresholds, showLegend, 
      legendPosition, enableBrush, baseProps.width, baseProps.height]);

  return (
    <BaseChart {...baseProps} className="telemetry-area-chart">
      <svg
        ref={svgRef}
        width={baseProps.width || 600}
        height={baseProps.height || 400}
        style={{ width: '100%', height: '100%' }}
      />
    </BaseChart>
  );
};