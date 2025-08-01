import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, Typography } from '@mui/material';

interface DataPoint {
  x: number;
  y: number;
}

const D3TestComponent: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Sample data
    const data: DataPoint[] = [
      { x: 0, y: 20 },
      { x: 50, y: 35 },
      { x: 100, y: 15 },
      { x: 150, y: 40 },
      { x: 200, y: 25 },
      { x: 250, y: 30 },
      { x: 300, y: 45 },
    ];

    // Set dimensions and margins
    const margin = { top: 20, right: 30, bottom: 40, left: 50 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.x) || 0])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.y) || 0])
      .range([height, 0]);

    // Create line generator
    const line = d3
      .line<DataPoint>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .curve(d3.curveMonotoneX);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .append('text')
      .attr('x', width / 2)
      .attr('y', 35)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .text('X Axis');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -35)
      .attr('x', -height / 2)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .text('Y Axis');

    // Add the line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2196f3')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => xScale(d.x))
      .attr('cy', (d) => yScale(d.y))
      .attr('r', 4)
      .attr('fill', '#2196f3')
      .on('mouseover', function (event, d) {
        // Add tooltip on hover
        const tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'd3-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '5px 10px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0);

        tooltip
          .html(`X: ${d.x}<br>Y: ${d.y}`)
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);

        d3.select(this).attr('r', 6);
      })
      .on('mouseout', function () {
        d3.selectAll('.d3-tooltip').remove();
        d3.select(this).attr('r', 4);
      });

    // Add title
    svg
      .append('text')
      .attr('x', (width + margin.left + margin.right) / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('D3.js Test Chart - Line Chart with Interactive Points');

  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" gutterBottom>
          D3.js v7 Test Component
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          This component demonstrates D3.js v7 integration with React 19 and TypeScript.
          Hover over the points to see tooltips.
        </Typography>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
          <svg ref={svgRef}></svg>
        </div>
        <Typography variant="caption" display="block" style={{ marginTop: 20 }}>
          D3 Version: {d3.version}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default D3TestComponent;