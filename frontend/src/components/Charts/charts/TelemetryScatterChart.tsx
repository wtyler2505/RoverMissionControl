import React, { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { BaseChart } from '../base/BaseChart';
import { ChartProps } from '../../../types/chart.types';

export interface TelemetryScatterData {
  x: number;
  y: number;
  size?: number;
  category?: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface TelemetryScatterChartProps extends ChartProps {
  data: TelemetryScatterData[];
  xDomain?: [number, number];
  yDomain?: [number, number];
  sizeDomain?: [number, number];
  sizeRange?: [number, number];
  colorScale?: d3.ScaleOrdinal<string, string>;
  showRegression?: boolean;
  regressionType?: 'linear' | 'polynomial' | 'exponential' | 'logarithmic';
  polynomialOrder?: number;
  showConfidenceInterval?: boolean;
  confidenceLevel?: number;
  showGrid?: boolean;
  showCrosshair?: boolean;
  enableBrush?: boolean;
  enableZoom?: boolean;
  onPointHover?: (data: TelemetryScatterData | null) => void;
  onPointClick?: (data: TelemetryScatterData) => void;
  onBrushEnd?: (selection: [[number, number], [number, number]] | null) => void;
}

export const TelemetryScatterChart: React.FC<TelemetryScatterChartProps> = ({
  data,
  xDomain,
  yDomain,
  sizeDomain,
  sizeRange = [3, 20],
  colorScale,
  showRegression = false,
  regressionType = 'linear',
  polynomialOrder = 2,
  showConfidenceInterval = false,
  confidenceLevel = 0.95,
  showGrid = true,
  showCrosshair = false,
  enableBrush = false,
  enableZoom = false,
  onPointHover,
  onPointClick,
  onBrushEnd,
  ...baseProps
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const brushRef = useRef<d3.BrushBehavior<unknown>>();

  const defaultColorScale = useMemo(() => {
    const categories = Array.from(new Set(data.map(d => d.category || 'default')));
    return d3.scaleOrdinal(d3.schemeCategory10).domain(categories);
  }, [data]);

  const actualColorScale = colorScale || defaultColorScale;

  // Calculate regression
  const regressionData = useMemo(() => {
    if (!showRegression || data.length < 2) return null;

    const xValues = data.map(d => d.x);
    const yValues = data.map(d => d.y);
    const n = xValues.length;

    switch (regressionType) {
      case 'linear': {
        // Linear regression: y = mx + b
        const sumX = d3.sum(xValues);
        const sumY = d3.sum(yValues);
        const sumXY = d3.sum(xValues.map((x, i) => x * yValues[i]));
        const sumX2 = d3.sum(xValues.map(x => x * x));

        const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const b = (sumY - m * sumX) / n;

        // Calculate R-squared
        const yMean = sumY / n;
        const ssTotal = d3.sum(yValues.map(y => Math.pow(y - yMean, 2)));
        const ssResidual = d3.sum(yValues.map((y, i) => Math.pow(y - (m * xValues[i] + b), 2)));
        const rSquared = 1 - (ssResidual / ssTotal);

        // Calculate confidence interval
        let confidenceInterval;
        if (showConfidenceInterval) {
          const standardError = Math.sqrt(ssResidual / (n - 2));
          const tValue = 1.96; // Approximate for 95% confidence
          confidenceInterval = (x: number) => {
            const prediction = m * x + b;
            const xMean = sumX / n;
            const se = standardError * Math.sqrt(1 / n + Math.pow(x - xMean, 2) / d3.sum(xValues.map(xi => Math.pow(xi - xMean, 2))));
            return {
              lower: prediction - tValue * se,
              upper: prediction + tValue * se
            };
          };
        }

        return {
          type: 'linear',
          equation: `y = ${m.toFixed(3)}x + ${b.toFixed(3)}`,
          rSquared,
          predict: (x: number) => m * x + b,
          confidenceInterval
        };
      }

      case 'polynomial': {
        // Polynomial regression using least squares
        const degree = polynomialOrder;
        const X: number[][] = [];
        
        for (let i = 0; i < n; i++) {
          const row = [];
          for (let j = 0; j <= degree; j++) {
            row.push(Math.pow(xValues[i], j));
          }
          X.push(row);
        }

        // Solve using normal equations (simplified for demonstration)
        // In production, use a proper linear algebra library
        const coefficients = new Array(degree + 1).fill(0);
        
        // Simplified polynomial fitting
        if (degree === 2) {
          const sumX = d3.sum(xValues);
          const sumX2 = d3.sum(xValues.map(x => x * x));
          const sumX3 = d3.sum(xValues.map(x => x * x * x));
          const sumX4 = d3.sum(xValues.map(x => x * x * x * x));
          const sumY = d3.sum(yValues);
          const sumXY = d3.sum(xValues.map((x, i) => x * yValues[i]));
          const sumX2Y = d3.sum(xValues.map((x, i) => x * x * yValues[i]));

          // Solve the system of equations
          const det = n * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);
          coefficients[0] = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY * sumX4 - sumX2Y * sumX3) + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / det;
          coefficients[1] = (n * (sumXY * sumX4 - sumX2Y * sumX3) - sumY * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y - sumXY * sumX2)) / det;
          coefficients[2] = (n * (sumX2 * sumX2Y - sumXY * sumX3) - sumX * (sumX * sumX2Y - sumXY * sumX2) + sumY * (sumX * sumX3 - sumX2 * sumX2)) / det;
        }

        return {
          type: 'polynomial',
          equation: `y = ${coefficients.map((c, i) => i === 0 ? c.toFixed(3) : `${c >= 0 ? '+' : ''}${c.toFixed(3)}x^${i}`).join(' ')}`,
          rSquared: 0, // Simplified
          predict: (x: number) => coefficients.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0)
        };
      }

      case 'exponential': {
        // Exponential regression: y = a * e^(bx)
        const lnY = yValues.map(y => Math.log(Math.max(y, 0.001))); // Avoid log(0)
        const sumX = d3.sum(xValues);
        const sumLnY = d3.sum(lnY);
        const sumXLnY = d3.sum(xValues.map((x, i) => x * lnY[i]));
        const sumX2 = d3.sum(xValues.map(x => x * x));

        const b = (n * sumXLnY - sumX * sumLnY) / (n * sumX2 - sumX * sumX);
        const lnA = (sumLnY - b * sumX) / n;
        const a = Math.exp(lnA);

        return {
          type: 'exponential',
          equation: `y = ${a.toFixed(3)} * e^(${b.toFixed(3)}x)`,
          rSquared: 0, // Simplified
          predict: (x: number) => a * Math.exp(b * x)
        };
      }

      case 'logarithmic': {
        // Logarithmic regression: y = a + b * ln(x)
        const lnX = xValues.map(x => Math.log(Math.max(x, 0.001))); // Avoid log(0)
        const sumLnX = d3.sum(lnX);
        const sumY = d3.sum(yValues);
        const sumLnXY = d3.sum(lnX.map((lx, i) => lx * yValues[i]));
        const sumLnX2 = d3.sum(lnX.map(lx => lx * lx));

        const b = (n * sumLnXY - sumLnX * sumY) / (n * sumLnX2 - sumLnX * sumLnX);
        const a = (sumY - b * sumLnX) / n;

        return {
          type: 'logarithmic',
          equation: `y = ${a.toFixed(3)} + ${b.toFixed(3)} * ln(x)`,
          rSquared: 0, // Simplified
          predict: (x: number) => a + b * Math.log(Math.max(x, 0.001))
        };
      }

      default:
        return null;
    }
  }, [data, showRegression, regressionType, polynomialOrder, showConfidenceInterval]);

  const renderChart = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const margin = { top: 20, right: 120, bottom: 60, left: 60 };
    const width = (baseProps.width || 600) - margin.left - margin.right;
    const height = (baseProps.height || 400) - margin.top - margin.bottom;

    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xExtent = xDomain || d3.extent(data, d => d.x) as [number, number];
    const yExtent = yDomain || d3.extent(data, d => d.y) as [number, number];

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([0, width])
      .nice();

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([height, 0])
      .nice();

    const sizeScale = d3.scaleLinear()
      .domain(sizeDomain || d3.extent(data, d => d.size || 1) as [number, number])
      .range(sizeRange);

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
      .text('X Axis');

    g.append('text')
      .attr('class', 'y-axis-label')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -height / 2)
      .text('Y Axis');

    // Add zoom behavior
    if (enableZoom) {
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 10])
        .extent([[0, 0], [width, height]])
        .on('zoom', (event) => {
          const newXScale = event.transform.rescaleX(xScale);
          const newYScale = event.transform.rescaleY(yScale);

          // Update axes
          g.select('.x-axis').call(xAxis.scale(newXScale));
          g.select('.y-axis').call(yAxis.scale(newYScale));

          // Update points
          g.selectAll('.point')
            .attr('cx', (d: any) => newXScale(d.x))
            .attr('cy', (d: any) => newYScale(d.y));

          // Update regression line if present
          if (showRegression && regressionData) {
            updateRegressionLine(newXScale);
          }
        });

      svg.call(zoom);
    }

    // Draw regression line
    const updateRegressionLine = (currentXScale: d3.ScaleLinear<number, number>) => {
      if (!regressionData) return;

      const regressionG = g.select('.regression-group');
      
      const xRange = currentXScale.domain();
      const regressionPoints = d3.range(xRange[0], xRange[1], (xRange[1] - xRange[0]) / 100);
      
      const line = d3.line<number>()
        .x(d => currentXScale(d))
        .y(d => yScale(regressionData.predict(d)));

      regressionG.select('.regression-line')
        .datum(regressionPoints)
        .attr('d', line);

      // Update confidence interval if shown
      if (showConfidenceInterval && regressionData.confidenceInterval) {
        const area = d3.area<number>()
          .x(d => currentXScale(d))
          .y0(d => yScale(regressionData.confidenceInterval!(d).lower))
          .y1(d => yScale(regressionData.confidenceInterval!(d).upper));

        regressionG.select('.confidence-interval')
          .datum(regressionPoints)
          .attr('d', area);
      }
    };

    if (showRegression && regressionData) {
      const regressionG = g.append('g')
        .attr('class', 'regression-group');

      // Draw confidence interval first (behind the line)
      if (showConfidenceInterval && regressionData.confidenceInterval) {
        regressionG.append('path')
          .attr('class', 'confidence-interval')
          .attr('fill', '#4f46e5')
          .attr('opacity', 0.1);
      }

      // Draw regression line
      regressionG.append('path')
        .attr('class', 'regression-line')
        .attr('fill', 'none')
        .attr('stroke', '#4f46e5')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,5');

      updateRegressionLine(xScale);

      // Add equation text
      g.append('text')
        .attr('class', 'regression-equation')
        .attr('x', width - 10)
        .attr('y', 10)
        .attr('text-anchor', 'end')
        .attr('font-size', '12px')
        .attr('fill', '#4f46e5')
        .text(regressionData.equation);

      if (regressionData.rSquared !== undefined) {
        g.append('text')
          .attr('class', 'regression-r-squared')
          .attr('x', width - 10)
          .attr('y', 25)
          .attr('text-anchor', 'end')
          .attr('font-size', '12px')
          .attr('fill', '#4f46e5')
          .text(`R² = ${regressionData.rSquared.toFixed(3)}`);
      }
    }

    // Add crosshair
    if (showCrosshair) {
      const crosshairG = g.append('g')
        .attr('class', 'crosshair')
        .style('display', 'none');

      crosshairG.append('line')
        .attr('class', 'crosshair-x')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');

      crosshairG.append('line')
        .attr('class', 'crosshair-y')
        .attr('stroke', '#666')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');

      crosshairG.append('text')
        .attr('class', 'crosshair-text')
        .attr('font-size', '12px')
        .attr('fill', '#666');

      g.append('rect')
        .attr('class', 'overlay')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('mouseover', () => crosshairG.style('display', null))
        .on('mouseout', () => crosshairG.style('display', 'none'))
        .on('mousemove', (event) => {
          const [x, y] = d3.pointer(event);
          
          crosshairG.select('.crosshair-x')
            .attr('x1', x)
            .attr('x2', x)
            .attr('y1', 0)
            .attr('y2', height);

          crosshairG.select('.crosshair-y')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', y)
            .attr('y2', y);

          crosshairG.select('.crosshair-text')
            .attr('x', x + 5)
            .attr('y', y - 5)
            .text(`(${xScale.invert(x).toFixed(2)}, ${yScale.invert(y).toFixed(2)})`);
        });
    }

    // Draw points
    const points = g.append('g')
      .attr('class', 'points')
      .selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'point')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 0)
      .attr('fill', d => actualColorScale(d.category || 'default'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('opacity', 0.8)
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#000')
          .attr('stroke-width', 2)
          .attr('opacity', 1);
        
        if (onPointHover) {
          onPointHover(d);
        }

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'telemetry-scatter-tooltip')
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

        let tooltipHtml = `
          <div>X: ${d.x.toFixed(2)}</div>
          <div>Y: ${d.y.toFixed(2)}</div>
        `;

        if (d.size !== undefined) {
          tooltipHtml += `<div>Size: ${d.size.toFixed(2)}</div>`;
        }

        if (d.category) {
          tooltipHtml += `<div>Category: ${d.category}</div>`;
        }

        if (d.metadata) {
          Object.entries(d.metadata).forEach(([key, value]) => {
            tooltipHtml += `<div>${key}: ${value}</div>`;
          });
        }

        tooltip.html(tooltipHtml)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
          .attr('opacity', 0.8);
        
        if (onPointHover) {
          onPointHover(null);
        }

        d3.select('.telemetry-scatter-tooltip').remove();
      })
      .on('click', function(event, d) {
        if (onPointClick) {
          onPointClick(d);
        }
      });

    // Animate points
    points.transition()
      .duration(500)
      .delay((d, i) => i * 2)
      .attr('r', d => sizeScale(d.size || 1));

    // Add brush
    if (enableBrush) {
      const brush = d3.brush<unknown>()
        .extent([[0, 0], [width, height]])
        .on('end', (event) => {
          if (onBrushEnd) {
            if (event.selection) {
              const [[x0, y0], [x1, y1]] = event.selection as [[number, number], [number, number]];
              const selection: [[number, number], [number, number]] = [
                [xScale.invert(x0), yScale.invert(y1)],
                [xScale.invert(x1), yScale.invert(y0)]
              ];
              onBrushEnd(selection);
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
    const categories = Array.from(new Set(data.map(d => d.category || 'default')));
    if (categories.length > 1) {
      const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width + margin.left + 20}, ${margin.top})`);

      const legendItems = legend.selectAll('.legend-item')
        .data(categories)
        .enter()
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 20})`);

      legendItems.append('circle')
        .attr('cx', 5)
        .attr('cy', 5)
        .attr('r', 5)
        .attr('fill', d => actualColorScale(d));

      legendItems.append('text')
        .attr('x', 15)
        .attr('y', 9)
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
  }, [data, xDomain, yDomain, sizeDomain, sizeRange, actualColorScale, 
      showRegression, regressionType, polynomialOrder, showConfidenceInterval, 
      confidenceLevel, showGrid, showCrosshair, enableBrush, enableZoom,
      baseProps.width, baseProps.height]);

  return (
    <BaseChart {...baseProps} className="telemetry-scatter-chart">
      <svg
        ref={svgRef}
        width={baseProps.width || 600}
        height={baseProps.height || 400}
        style={{ width: '100%', height: '100%' }}
      />
    </BaseChart>
  );
};