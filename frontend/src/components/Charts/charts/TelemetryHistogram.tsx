import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { BaseChart } from '../base/BaseChart';
import { ChartProps } from '../../../types/chart.types';

export interface TelemetryHistogramData {
  value: number;
  timestamp?: number;
  category?: string;
}

export interface TelemetryHistogramChartProps extends ChartProps {
  data: TelemetryHistogramData[];
  bins?: number;
  domain?: [number, number];
  showNormalDistribution?: boolean;
  showOutliers?: boolean;
  outlierThreshold?: number;
  color?: string;
  highlightRange?: [number, number];
  showStatistics?: boolean;
  onBarHover?: (bin: d3.Bin<TelemetryHistogramData, number> | null) => void;
  onBarClick?: (bin: d3.Bin<TelemetryHistogramData, number>) => void;
}

export const TelemetryHistogram: React.FC<TelemetryHistogramChartProps> = ({
  data,
  bins = 20,
  domain,
  showNormalDistribution = false,
  showOutliers = true,
  outlierThreshold = 1.5,
  color = '#4f46e5',
  highlightRange,
  showStatistics = true,
  onBarHover,
  onBarClick,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const statistics = useMemo(() => {
    const values = data.map(d => d.value).sort((a, b) => a - b);
    const n = values.length;
    
    if (n === 0) return null;

    const mean = d3.mean(values) || 0;
    const median = d3.median(values) || 0;
    const q1 = d3.quantile(values, 0.25) || 0;
    const q3 = d3.quantile(values, 0.75) || 0;
    const iqr = q3 - q1;
    const stdDev = d3.deviation(values) || 0;
    const min = values[0];
    const max = values[n - 1];

    // Calculate outlier bounds
    const lowerBound = q1 - outlierThreshold * iqr;
    const upperBound = q3 + outlierThreshold * iqr;

    const outliers = values.filter(v => v < lowerBound || v > upperBound);

    return {
      mean,
      median,
      q1,
      q3,
      iqr,
      stdDev,
      min,
      max,
      lowerBound,
      upperBound,
      outliers,
      count: n
    };
  }, [data, outlierThreshold]);

  const renderChart = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const margin = { top: 20, right: showStatistics ? 150 : 20, bottom: 60, left: 60 };
    const width = (baseProps.width || 600) - margin.left - margin.right;
    const height = (baseProps.height || 400) - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    if (!statistics) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xDomain = domain || [statistics.min, statistics.max];
    const xScale = d3.scaleLinear()
      .domain(xDomain)
      .range([0, width])
      .nice();

    // Create bins
    const histogram = d3.histogram<TelemetryHistogramData, number>()
      .value(d => d.value)
      .domain(xScale.domain() as [number, number])
      .thresholds(xScale.ticks(bins));

    const histogramBins = histogram(data);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(histogramBins, d => d.length) || 0])
      .range([height, 0]);

    // Create axes
    const xAxis = d3.axisBottom(xScale);
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
      .text('Value');

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .text('Frequency');

    // Draw bars
    const bars = g.append('g')
      .attr('class', 'bars')
      .selectAll('rect')
      .data(histogramBins)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.x0 || 0))
      .attr('y', height)
      .attr('width', d => xScale(d.x1 || 0) - xScale(d.x0 || 0) - 1)
      .attr('height', 0)
      .attr('fill', d => {
        if (highlightRange) {
          const binCenter = ((d.x0 || 0) + (d.x1 || 0)) / 2;
          return binCenter >= highlightRange[0] && binCenter <= highlightRange[1] 
            ? '#ef4444' 
            : color;
        }
        return color;
      })
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke', '#000')
          .attr('stroke-width', 2);
        
        if (onBarHover) {
          onBarHover(d);
        }

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'telemetry-histogram-tooltip')
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
          <div>Range: ${(d.x0 || 0).toFixed(2)} - ${(d.x1 || 0).toFixed(2)}</div>
          <div>Count: ${d.length}</div>
          <div>Percentage: ${((d.length / data.length) * 100).toFixed(1)}%</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('opacity', 0.8)
          .attr('stroke', 'none');
        
        if (onBarHover) {
          onBarHover(null);
        }

        d3.select('.telemetry-histogram-tooltip').remove();
      })
      .on('click', function(event, d) {
        if (onBarClick) {
          onBarClick(d);
        }
      });

    // Animate bars
    bars.transition()
      .duration(500)
      .attr('y', d => yScale(d.length))
      .attr('height', d => height - yScale(d.length));

    // Draw normal distribution curve if requested
    if (showNormalDistribution && statistics.stdDev > 0) {
      const normalData = d3.range(xScale.domain()[0], xScale.domain()[1], (xScale.domain()[1] - xScale.domain()[0]) / 100);
      
      const normal = (x: number) => {
        const z = (x - statistics.mean) / statistics.stdDev;
        return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
      };

      const normalScale = d3.scaleLinear()
        .domain([0, d3.max(normalData, normal) || 1])
        .range([height, 0]);

      const line = d3.line<number>()
        .x(d => xScale(d))
        .y(d => normalScale(normal(d)))
        .curve(d3.curveBasis);

      g.append('path')
        .datum(normalData)
        .attr('class', 'normal-distribution')
        .attr('fill', 'none')
        .attr('stroke', '#ef4444')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5')
        .attr('d', line)
        .attr('opacity', 0)
        .transition()
        .duration(1000)
        .attr('opacity', 0.8);
    }

    // Mark outliers
    if (showOutliers && statistics.outliers.length > 0) {
      const outlierG = g.append('g')
        .attr('class', 'outliers');

      // Draw outlier regions
      if (statistics.lowerBound > xScale.domain()[0]) {
        outlierG.append('rect')
          .attr('x', xScale(xScale.domain()[0]))
          .attr('y', 0)
          .attr('width', xScale(statistics.lowerBound) - xScale(xScale.domain()[0]))
          .attr('height', height)
          .attr('fill', '#ef4444')
          .attr('opacity', 0.1);
      }

      if (statistics.upperBound < xScale.domain()[1]) {
        outlierG.append('rect')
          .attr('x', xScale(statistics.upperBound))
          .attr('y', 0)
          .attr('width', xScale(xScale.domain()[1]) - xScale(statistics.upperBound))
          .attr('height', height)
          .attr('fill', '#ef4444')
          .attr('opacity', 0.1);
      }

      // Mark individual outliers
      const outlierData = data.filter(d => 
        d.value < statistics.lowerBound || d.value > statistics.upperBound
      );

      outlierG.selectAll('circle')
        .data(outlierData)
        .enter()
        .append('circle')
        .attr('cx', d => xScale(d.value))
        .attr('cy', height - 5)
        .attr('r', 3)
        .attr('fill', '#ef4444')
        .attr('opacity', 0.8);
    }

    // Draw statistics lines
    const statsG = g.append('g')
      .attr('class', 'statistics-lines');

    // Mean line
    statsG.append('line')
      .attr('x1', xScale(statistics.mean))
      .attr('y1', 0)
      .attr('x2', xScale(statistics.mean))
      .attr('y2', height)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,5')
      .attr('opacity', 0.8);

    // Median line
    statsG.append('line')
      .attr('x1', xScale(statistics.median))
      .attr('y1', 0)
      .attr('x2', xScale(statistics.median))
      .attr('y2', height)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0.8);

    // Statistics panel
    if (showStatistics) {
      const statsPanel = svg.append('g')
        .attr('class', 'statistics-panel')
        .attr('transform', `translate(${width + margin.left + 20}, ${margin.top})`);

      const statItems = [
        { label: 'Count:', value: statistics.count },
        { label: 'Mean:', value: statistics.mean.toFixed(2) },
        { label: 'Median:', value: statistics.median.toFixed(2) },
        { label: 'Std Dev:', value: statistics.stdDev.toFixed(2) },
        { label: 'Min:', value: statistics.min.toFixed(2) },
        { label: 'Max:', value: statistics.max.toFixed(2) },
        { label: 'Q1:', value: statistics.q1.toFixed(2) },
        { label: 'Q3:', value: statistics.q3.toFixed(2) },
        { label: 'IQR:', value: statistics.iqr.toFixed(2) },
        { label: 'Outliers:', value: statistics.outliers.length }
      ];

      statsPanel.selectAll('text')
        .data(statItems)
        .enter()
        .append('text')
        .attr('x', 0)
        .attr('y', (d, i) => i * 20)
        .attr('font-size', '12px')
        .attr('fill', '#666')
        .text(d => `${d.label} ${d.value}`);

      // Add legend for lines
      const legend = statsPanel.append('g')
        .attr('transform', `translate(0, ${statItems.length * 20 + 20})`);

      legend.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 20)
        .attr('y2', 0)
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      legend.append('text')
        .attr('x', 25)
        .attr('y', 5)
        .attr('font-size', '12px')
        .attr('fill', '#666')
        .text('Mean');

      legend.append('line')
        .attr('x1', 0)
        .attr('y1', 20)
        .attr('x2', 20)
        .attr('y2', 20)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '3,3');

      legend.append('text')
        .attr('x', 25)
        .attr('y', 25)
        .attr('font-size', '12px')
        .attr('fill', '#666')
        .text('Median');
    }
  };

  useEffect(() => {
    if (svgRef.current && data.length > 0) {
      const svg = d3.select(svgRef.current);
      renderChart(svg);
    }
  }, [data, bins, domain, showNormalDistribution, showOutliers, outlierThreshold, 
      color, highlightRange, showStatistics, baseProps.width, baseProps.height]);

  return (
    <BaseChart {...baseProps} className="telemetry-histogram-chart">
      <svg
        ref={svgRef}
        width={baseProps.width || 600}
        height={baseProps.height || 400}
        style={{ width: '100%', height: '100%' }}
      />
    </BaseChart>
  );
};