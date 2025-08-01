import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';

interface TelemetryPoint {
  time: Date;
  value: number;
  category: 'normal' | 'warning' | 'critical';
}

const D3RealTimeChart: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate random telemetry data
  const generateDataPoint = useCallback((): TelemetryPoint => {
    const value = Math.random() * 100;
    let category: 'normal' | 'warning' | 'critical' = 'normal';
    
    if (value > 80) category = 'critical';
    else if (value > 60) category = 'warning';

    return {
      time: new Date(),
      value,
      category,
    };
  }, []);

  // Start/stop data streaming
  const toggleStreaming = useCallback(() => {
    if (isStreaming) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      intervalRef.current = setInterval(() => {
        setData((prevData) => {
          const newData = [...prevData, generateDataPoint()];
          // Keep only last 50 points
          return newData.slice(-50);
        });
      }, 1000);
    }
    setIsStreaming(!isStreaming);
  }, [isStreaming, generateDataPoint]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove();

    // Set dimensions and margins
    const margin = { top: 20, right: 80, bottom: 50, left: 70 };
    const width = 800 - margin.left - margin.right;
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
      .scaleTime()
      .domain(d3.extent(data, (d) => d.time) as [Date, Date])
      .range([0, width]);

    const yScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Create color scale
    const colorScale = d3
      .scaleOrdinal<string>()
      .domain(['normal', 'warning', 'critical'])
      .range(['#4caf50', '#ff9800', '#f44336']);

    // Create line generator
    const line = d3
      .line<TelemetryPoint>()
      .x((d) => xScale(d.time))
      .y((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add gradient definitions
    const defs = svg.append('defs');
    
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'area-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0)
      .attr('y1', yScale(0))
      .attr('x2', 0)
      .attr('y2', yScale(100));

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#2196f3')
      .attr('stop-opacity', 0.1);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#2196f3')
      .attr('stop-opacity', 0.5);

    // Create area generator
    const area = d3
      .area<TelemetryPoint>()
      .x((d) => xScale(d.time))
      .y0(height)
      .y1((d) => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M:%S')))
      .append('text')
      .attr('x', width / 2)
      .attr('y', 40)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .text('Time');

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50)
      .attr('x', -height / 2)
      .attr('fill', 'black')
      .style('text-anchor', 'middle')
      .text('Telemetry Value');

    // Add grid lines
    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickSize(-height)
          .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-width)
          .tickFormat(() => '')
      )
      .style('stroke-dasharray', '3,3')
      .style('opacity', 0.3);

    // Add the area
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#area-gradient)')
      .attr('d', area);

    // Add the line
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2196f3')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots with color based on category
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d) => xScale(d.time))
      .attr('cy', (d) => yScale(d.value))
      .attr('r', 4)
      .attr('fill', (d) => colorScale(d.category))
      .attr('stroke', 'white')
      .attr('stroke-width', 1);

    // Add threshold lines
    const thresholds = [
      { value: 80, label: 'Critical', color: '#f44336' },
      { value: 60, label: 'Warning', color: '#ff9800' },
    ];

    thresholds.forEach((threshold) => {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', yScale(threshold.value))
        .attr('y2', yScale(threshold.value))
        .attr('stroke', threshold.color)
        .attr('stroke-dasharray', '5,5')
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', width + 5)
        .attr('y', yScale(threshold.value) + 4)
        .attr('fill', threshold.color)
        .style('font-size', '12px')
        .text(threshold.label);
    });

    // Add title
    svg
      .append('text')
      .attr('x', (width + margin.left + margin.right) / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text('Real-Time Telemetry Monitor');

    // Add legend
    const legend = svg
      .append('g')
      .attr('transform', `translate(${width + margin.left + 10}, ${margin.top})`);

    const legendData = [
      { category: 'normal', label: 'Normal' },
      { category: 'warning', label: 'Warning' },
      { category: 'critical', label: 'Critical' },
    ];

    legend
      .selectAll('.legend-item')
      .data(legendData)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 20})`)
      .each(function (d) {
        const item = d3.select(this);
        
        item
          .append('circle')
          .attr('r', 5)
          .attr('fill', colorScale(d.category));

        item
          .append('text')
          .attr('x', 10)
          .attr('y', 4)
          .style('font-size', '12px')
          .text(d.label);
      });

  }, [data]);

  // Initialize with some data
  useEffect(() => {
    const initialData: TelemetryPoint[] = [];
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      initialData.push({
        time: new Date(now.getTime() - (10 - i) * 1000),
        value: Math.random() * 100,
        category: 'normal',
      });
    }
    setData(initialData);
  }, []);

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <div>
            <Typography variant="h5" gutterBottom>
              D3.js Real-Time Telemetry Chart
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Mission-critical telemetry visualization with threshold monitoring
            </Typography>
          </div>
          <Button
            variant="contained"
            color={isStreaming ? 'secondary' : 'primary'}
            onClick={toggleStreaming}
          >
            {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
          </Button>
        </Box>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <svg ref={svgRef}></svg>
        </div>
        <Typography variant="caption" display="block" style={{ marginTop: 20 }}>
          Using D3.js v{d3.version} with React {React.version}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default D3RealTimeChart;