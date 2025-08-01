import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { BaseChart } from '../base/BaseChart';
import { ChartProps } from '../../../types/chart.types';

export interface TelemetryHeatmapData {
  x: number;
  y: number;
  value: number;
  timestamp?: number;
}

export interface TelemetryHeatmapChartProps extends ChartProps {
  data: TelemetryHeatmapData[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  valueDomain?: [number, number];
  colorScheme?: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'cividis' | 'turbo' | 'cool' | 'warm';
  cellSize?: number;
  showGrid?: boolean;
  interpolate?: boolean;
  showColorBar?: boolean;
  onCellHover?: (data: TelemetryHeatmapData | null) => void;
  onCellClick?: (data: TelemetryHeatmapData) => void;
}

export const TelemetryHeatmapChart: React.FC<TelemetryHeatmapChartProps> = ({
  data,
  xDomain,
  yDomain,
  valueDomain,
  colorScheme = 'viridis',
  cellSize = 10,
  showGrid = true,
  interpolate = false,
  showColorBar = true,
  onCellHover,
  onCellClick,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const colorBarRef = useRef<SVGGElement>(null);

  const colorScale = useMemo(() => {
    const domain = valueDomain || d3.extent(data, d => d.value) as [number, number];
    
    const colorInterpolator = {
      viridis: d3.interpolateViridis,
      plasma: d3.interpolatePlasma,
      inferno: d3.interpolateInferno,
      magma: d3.interpolateMagma,
      cividis: d3.interpolateCividis,
      turbo: d3.interpolateTurbo,
      cool: d3.interpolateCool,
      warm: d3.interpolateWarm,
    }[colorScheme];

    return d3.scaleSequential(colorInterpolator).domain(domain);
  }, [data, valueDomain, colorScheme]);

  const renderChart = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const margin = { top: 20, right: showColorBar ? 80 : 20, bottom: 40, left: 60 };
    const width = (baseProps.width || 600) - margin.left - margin.right;
    const height = (baseProps.height || 400) - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Calculate domains
    const xExtent = xDomain || d3.extent(data, d => d.x) as [number, number];
    const yExtent = yDomain || d3.extent(data, d => d.y) as [number, number];

    // Create scales
    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(10);

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
      .attr('y', height + 35)
      .text('X Axis');

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .text('Y Axis');

    if (interpolate) {
      // Create interpolated heatmap using contours
      const contours = d3.contours()
        .size([Math.ceil(width / cellSize), Math.ceil(height / cellSize)])
        .thresholds(20)
        .smooth(true);

      // Create grid data for interpolation
      const gridData = [];
      for (let i = 0; i < Math.ceil(width / cellSize); i++) {
        for (let j = 0; j < Math.ceil(height / cellSize); j++) {
          const x = xScale.invert(i * cellSize);
          const y = yScale.invert(j * cellSize);
          
          // Find nearest data point
          let minDist = Infinity;
          let nearestValue = 0;
          
          data.forEach(d => {
            const dist = Math.sqrt(Math.pow(d.x - x, 2) + Math.pow(d.y - y, 2));
            if (dist < minDist) {
              minDist = dist;
              nearestValue = d.value;
            }
          });
          
          gridData.push(nearestValue);
        }
      }

      const contourData = contours(gridData);

      g.append('g')
        .attr('class', 'contours')
        .selectAll('path')
        .data(contourData)
        .enter()
        .append('path')
        .attr('d', d3.geoPath(d3.geoIdentity().scale(cellSize)))
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', 'none')
        .attr('opacity', 0.8);
    } else {
      // Create discrete cells
      const cells = g.append('g')
        .attr('class', 'cells')
        .selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => xScale(d.x) - cellSize / 2)
        .attr('y', d => yScale(d.y) - cellSize / 2)
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('fill', d => colorScale(d.value))
        .attr('stroke', showGrid ? '#ccc' : 'none')
        .attr('stroke-width', showGrid ? 0.5 : 0)
        .attr('opacity', 0.9)
        .on('mouseover', function(event, d) {
          d3.select(this)
            .attr('stroke', '#000')
            .attr('stroke-width', 2);
          
          if (onCellHover) {
            onCellHover(d);
          }

          // Show tooltip
          const tooltip = d3.select('body')
            .append('div')
            .attr('class', 'telemetry-heatmap-tooltip')
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
            <div>X: ${d.x.toFixed(2)}</div>
            <div>Y: ${d.y.toFixed(2)}</div>
            <div>Value: ${d.value.toFixed(2)}</div>
          `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .attr('stroke', showGrid ? '#ccc' : 'none')
            .attr('stroke-width', showGrid ? 0.5 : 0);
          
          if (onCellHover) {
            onCellHover(null);
          }

          d3.select('.telemetry-heatmap-tooltip').remove();
        })
        .on('click', function(event, d) {
          if (onCellClick) {
            onCellClick(d);
          }
        });

      // Animate cells on initial render
      cells
        .attr('opacity', 0)
        .transition()
        .duration(500)
        .delay((d, i) => i * 2)
        .attr('opacity', 0.9);
    }

    // Add color bar
    if (showColorBar) {
      const colorBarWidth = 20;
      const colorBarHeight = height;
      const colorBarMargin = 20;

      const colorBarG = svg.append('g')
        .attr('class', 'color-bar')
        .attr('transform', `translate(${width + margin.left + colorBarMargin},${margin.top})`);

      // Create gradient
      const gradientId = `heatmap-gradient-${Date.now()}`;
      const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '0%')
        .attr('y2', '0%');

      const nStops = 10;
      const colorDomain = colorScale.domain();
      const colorRange = d3.range(0, 1 + 1/nStops, 1/nStops);

      colorRange.forEach((t, i) => {
        gradient.append('stop')
          .attr('offset', `${t * 100}%`)
          .attr('stop-color', colorScale(colorDomain[0] + t * (colorDomain[1] - colorDomain[0])));
      });

      colorBarG.append('rect')
        .attr('width', colorBarWidth)
        .attr('height', colorBarHeight)
        .attr('fill', `url(#${gradientId})`);

      // Add color bar scale
      const colorBarScale = d3.scaleLinear()
        .domain(colorScale.domain())
        .range([colorBarHeight, 0]);

      const colorBarAxis = d3.axisRight(colorBarScale)
        .ticks(5);

      colorBarG.append('g')
        .attr('transform', `translate(${colorBarWidth}, 0)`)
        .call(colorBarAxis);
    }
  };

  useEffect(() => {
    if (svgRef.current && data.length > 0) {
      const svg = d3.select(svgRef.current);
      renderChart(svg);
    }
  }, [data, baseProps.width, baseProps.height, colorScheme, cellSize, showGrid, interpolate, showColorBar]);

  return (
    <BaseChart {...baseProps} className="telemetry-heatmap-chart">
      <svg
        ref={svgRef}
        width={baseProps.width || 600}
        height={baseProps.height || 400}
        style={{ width: '100%', height: '100%' }}
      />
    </BaseChart>
  );
};