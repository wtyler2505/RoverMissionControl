import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import * as d3 from 'd3';
import { Box, useTheme } from '@mui/material';
import { BaseChart } from '../base/BaseChart';
import { ResponsiveContainer } from '../base/ResponsiveContainer';
import { useChartInteractions } from '../interactions/useChartInteractions';
import { usePerformanceTracking } from '../../../hooks/usePerformanceTracking';
import { 
  TimelineChartProps, 
  GanttTask, 
  MissionEvent,
  TimelineInteractionState,
  LevelOfDetail 
} from './types';

/**
 * TimelineChart - Advanced Mission Timeline Visualization
 * Combines Gantt chart functionality with event markers and playback controls
 */
export const TimelineChart: React.FC<TimelineChartProps> = ({
  tasks,
  events = [],
  annotations = [],
  startDate,
  endDate,
  currentTime,
  playbackSpeed = 1,
  isPlaying = false,
  onTimeChange,
  onPlaybackToggle,
  showDependencies = true,
  showProgress = true,
  showEvents = true,
  showAnnotations = true,
  showGrid = true,
  showToday = true,
  onTaskClick,
  onTaskDrag,
  onEventClick,
  onAnnotationAdd,
  onTimeRangeChange,
  comparisonData,
  zoomLevel = 1,
  minZoom = 0.1,
  maxZoom = 50,
  taskFilter,
  eventFilter,
  enableExport = true,
  exportFormats = ['png', 'svg', 'json'],
  width = 1200,
  height = 600,
  margin = { top: 40, right: 40, bottom: 60, left: 200 },
  theme: customTheme,
  ...baseChartProps
}) => {
  const muiTheme = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Performance tracking
  const { startTracking, endTracking } = usePerformanceTracking('TimelineChart');
  
  // Interaction state
  const [interactionState, setInteractionState] = useState<TimelineInteractionState>({
    selectedTaskIds: new Set(),
    hoveredTaskId: null,
    hoveredEventId: null,
    isDragging: false,
    draggedTaskId: null,
    zoomTransform: { x: 0, y: 0, k: 1 },
    playbackState: isPlaying ? 'playing' : 'paused',
    currentTime: currentTime || new Date()
  });

  // Calculate dimensions
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Filtered data based on props
  const filteredTasks = useMemo(() => {
    return taskFilter ? tasks.filter(taskFilter) : tasks;
  }, [tasks, taskFilter]);

  const filteredEvents = useMemo(() => {
    return eventFilter ? events.filter(eventFilter) : events;
  }, [events, eventFilter]);

  // Level of detail based on zoom
  const levelOfDetail = useMemo((): LevelOfDetail => {
    const zoomScale = interactionState.zoomTransform.k;
    if (zoomScale < 0.5) {
      return {
        level: 'overview',
        showSubtasks: false,
        showEvents: false,
        showAnnotations: false,
        showDependencies: false,
        timeGranularity: 'month'
      };
    } else if (zoomScale < 2) {
      return {
        level: 'summary',
        showSubtasks: false,
        showEvents: true,
        showAnnotations: false,
        showDependencies: true,
        timeGranularity: 'week'
      };
    } else if (zoomScale < 5) {
      return {
        level: 'detailed',
        showSubtasks: true,
        showEvents: true,
        showAnnotations: true,
        showDependencies: true,
        timeGranularity: 'day'
      };
    } else {
      return {
        level: 'granular',
        showSubtasks: true,
        showEvents: true,
        showAnnotations: true,
        showDependencies: true,
        timeGranularity: 'hour'
      };
    }
  }, [interactionState.zoomTransform.k]);

  // Create scales
  const xScale = useMemo(() => {
    return d3.scaleTime()
      .domain([startDate, endDate])
      .range([0, innerWidth]);
  }, [startDate, endDate, innerWidth]);

  const yScale = useMemo(() => {
    return d3.scaleBand()
      .domain(filteredTasks.map(t => t.id))
      .range([0, innerHeight])
      .padding(0.2);
  }, [filteredTasks, innerHeight]);

  // Color scales
  const statusColorScale = useMemo(() => {
    return d3.scaleOrdinal<string>()
      .domain(['pending', 'in-progress', 'completed', 'blocked', 'cancelled'])
      .range([
        muiTheme.palette.grey[400],
        muiTheme.palette.info.main,
        muiTheme.palette.success.main,
        muiTheme.palette.error.main,
        muiTheme.palette.warning.main
      ]);
  }, [muiTheme]);

  const priorityColorScale = useMemo(() => {
    return d3.scaleOrdinal<string>()
      .domain(['low', 'medium', 'high', 'critical'])
      .range([
        muiTheme.palette.info.light,
        muiTheme.palette.warning.light,
        muiTheme.palette.warning.main,
        muiTheme.palette.error.main
      ]);
  }, [muiTheme]);

  // Initialize D3 chart
  const initializeChart = useCallback(() => {
    if (!svgRef.current) return;
    
    startTracking();
    
    const svg = d3.select(svgRef.current);
    
    // Clear previous content
    svg.selectAll('*').remove();
    
    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add grid if enabled
    if (showGrid) {
      const gridGroup = g.append('g').attr('class', 'grid');
      
      // Vertical grid lines (time)
      const timeGrid = d3.axisBottom(xScale)
        .tickSize(innerHeight)
        .tickFormat(() => '')
        .ticks(d3.timeWeek.every(1));
      
      gridGroup.append('g')
        .attr('class', 'grid-x')
        .call(timeGrid)
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
      
      // Horizontal grid lines
      const taskGrid = d3.axisLeft(yScale)
        .tickSize(-innerWidth)
        .tickFormat(() => '');
      
      gridGroup.append('g')
        .attr('class', 'grid-y')
        .call(taskGrid)
        .style('stroke-dasharray', '2,2')
        .style('opacity', 0.3);
    }
    
    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(d3.timeDay.every(1))
      .tickFormat(d3.timeFormat('%b %d'));
    
    const yAxis = d3.axisLeft(yScale);
    
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    
    g.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);
    
    // Task bars group
    const tasksGroup = g.append('g').attr('class', 'tasks');
    
    // Render tasks
    const taskBars = tasksGroup.selectAll('.task-bar')
      .data(filteredTasks)
      .enter()
      .append('g')
      .attr('class', 'task-group');
    
    // Main task bar
    taskBars.append('rect')
      .attr('class', 'task-bar')
      .attr('x', d => xScale(d.startDate))
      .attr('y', d => yScale(d.id) || 0)
      .attr('width', d => Math.max(0, xScale(d.endDate) - xScale(d.startDate)))
      .attr('height', yScale.bandwidth())
      .attr('fill', d => statusColorScale(d.status || 'pending'))
      .attr('stroke', d => priorityColorScale(d.priority || 'medium'))
      .attr('stroke-width', 2)
      .attr('rx', 4)
      .attr('ry', 4)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onTaskClick?.(d);
        
        // Toggle selection
        const newSelection = new Set(interactionState.selectedTaskIds);
        if (newSelection.has(d.id)) {
          newSelection.delete(d.id);
        } else {
          newSelection.add(d.id);
        }
        setInteractionState(prev => ({
          ...prev,
          selectedTaskIds: newSelection
        }));
      })
      .on('mouseenter', (event, d) => {
        setInteractionState(prev => ({
          ...prev,
          hoveredTaskId: d.id
        }));
      })
      .on('mouseleave', () => {
        setInteractionState(prev => ({
          ...prev,
          hoveredTaskId: null
        }));
      });
    
    // Progress bar if enabled
    if (showProgress) {
      taskBars.append('rect')
        .attr('class', 'task-progress')
        .attr('x', d => xScale(d.startDate))
        .attr('y', d => (yScale(d.id) || 0) + yScale.bandwidth() * 0.3)
        .attr('width', d => {
          const totalWidth = xScale(d.endDate) - xScale(d.startDate);
          return Math.max(0, totalWidth * ((d.progress || 0) / 100));
        })
        .attr('height', yScale.bandwidth() * 0.4)
        .attr('fill', d => d3.color(statusColorScale(d.status || 'pending'))?.brighter(0.5)?.toString() || '')
        .attr('rx', 2)
        .attr('ry', 2)
        .style('pointer-events', 'none');
    }
    
    // Task labels
    taskBars.append('text')
      .attr('class', 'task-label')
      .attr('x', d => xScale(d.startDate) + 5)
      .attr('y', d => (yScale(d.id) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .text(d => d.name)
      .style('fill', muiTheme.palette.text.primary)
      .style('font-size', '12px')
      .style('pointer-events', 'none');
    
    // Dependencies
    if (showDependencies && levelOfDetail.showDependencies) {
      const dependenciesGroup = g.append('g').attr('class', 'dependencies');
      
      filteredTasks.forEach(task => {
        if (task.dependencies) {
          task.dependencies.forEach(depId => {
            const depTask = filteredTasks.find(t => t.id === depId);
            if (depTask) {
              const line = d3.line<[number, number]>()
                .x(d => d[0])
                .y(d => d[1])
                .curve(d3.curveBasis);
              
              const startX = xScale(depTask.endDate);
              const startY = (yScale(depTask.id) || 0) + yScale.bandwidth() / 2;
              const endX = xScale(task.startDate);
              const endY = (yScale(task.id) || 0) + yScale.bandwidth() / 2;
              
              dependenciesGroup.append('path')
                .attr('class', 'dependency-line')
                .attr('d', line([[startX, startY], [(startX + endX) / 2, startY], [(startX + endX) / 2, endY], [endX, endY]]))
                .attr('fill', 'none')
                .attr('stroke', muiTheme.palette.grey[500])
                .attr('stroke-width', 1)
                .attr('stroke-dasharray', '3,3')
                .style('opacity', 0.6);
              
              // Arrow marker
              dependenciesGroup.append('polygon')
                .attr('points', `${endX},${endY - 3} ${endX - 6},${endY} ${endX},${endY + 3}`)
                .attr('fill', muiTheme.palette.grey[500])
                .style('opacity', 0.6);
            }
          });
        }
      });
    }
    
    // Events
    if (showEvents && levelOfDetail.showEvents && filteredEvents.length > 0) {
      const eventsGroup = g.append('g').attr('class', 'events');
      
      const eventMarkers = eventsGroup.selectAll('.event-marker')
        .data(filteredEvents)
        .enter()
        .append('g')
        .attr('class', 'event-marker')
        .attr('transform', d => `translate(${xScale(d.timestamp)},0)`);
      
      // Event line
      eventMarkers.append('line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', d => {
          const severityColors = {
            info: muiTheme.palette.info.main,
            warning: muiTheme.palette.warning.main,
            error: muiTheme.palette.error.main,
            critical: muiTheme.palette.error.dark
          };
          return severityColors[d.severity || 'info'];
        })
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', d => d.type === 'milestone' ? 'none' : '5,5')
        .style('opacity', 0.7);
      
      // Event icon
      const eventIcons = {
        milestone: '◆',
        alert: '⚠',
        command: '►',
        telemetry: '📊',
        annotation: '💬'
      };
      
      eventMarkers.append('text')
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .text(d => eventIcons[d.type])
        .style('font-size', '16px')
        .style('cursor', 'pointer')
        .on('click', (event, d) => {
          event.stopPropagation();
          onEventClick?.(d);
        })
        .on('mouseenter', (event, d) => {
          setInteractionState(prev => ({
            ...prev,
            hoveredEventId: d.id
          }));
        })
        .on('mouseleave', () => {
          setInteractionState(prev => ({
            ...prev,
            hoveredEventId: null
          }));
        });
    }
    
    // Current time indicator
    if (showToday || currentTime) {
      const timeToShow = currentTime || new Date();
      if (timeToShow >= startDate && timeToShow <= endDate) {
        const currentTimeGroup = g.append('g').attr('class', 'current-time');
        
        currentTimeGroup.append('line')
          .attr('x1', xScale(timeToShow))
          .attr('x2', xScale(timeToShow))
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', muiTheme.palette.error.main)
          .attr('stroke-width', 2);
        
        currentTimeGroup.append('text')
          .attr('x', xScale(timeToShow))
          .attr('y', -5)
          .attr('text-anchor', 'middle')
          .text(d3.timeFormat('%H:%M')(timeToShow))
          .style('fill', muiTheme.palette.error.main)
          .style('font-size', '12px')
          .style('font-weight', 'bold');
      }
    }
    
    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .extent([[0, 0], [width, height]])
      .on('zoom', (event) => {
        const { transform } = event;
        setInteractionState(prev => ({
          ...prev,
          zoomTransform: { x: transform.x, y: transform.y, k: transform.k }
        }));
        
        // Update scales
        const newXScale = transform.rescaleX(xScale);
        
        // Update x-axis
        g.select('.x-axis').call(d3.axisBottom(newXScale).tickFormat(d3.timeFormat('%b %d')));
        
        // Update task positions
        g.selectAll('.task-bar')
          .attr('x', (d: any) => newXScale(d.startDate))
          .attr('width', (d: any) => Math.max(0, newXScale(d.endDate) - newXScale(d.startDate)));
        
        g.selectAll('.task-progress')
          .attr('x', (d: any) => newXScale(d.startDate))
          .attr('width', (d: any) => {
            const totalWidth = newXScale(d.endDate) - newXScale(d.startDate);
            return Math.max(0, totalWidth * ((d.progress || 0) / 100));
          });
        
        g.selectAll('.task-label')
          .attr('x', (d: any) => newXScale(d.startDate) + 5);
        
        // Update events
        g.selectAll('.event-marker')
          .attr('transform', (d: any) => `translate(${newXScale(d.timestamp)},0)`);
        
        // Update current time
        if (currentTime) {
          g.select('.current-time line')
            .attr('x1', newXScale(currentTime))
            .attr('x2', newXScale(currentTime));
          
          g.select('.current-time text')
            .attr('x', newXScale(currentTime));
        }
        
        // Notify parent of range change
        if (onTimeRangeChange) {
          const newDomain = newXScale.domain();
          onTimeRangeChange(newDomain[0], newDomain[1]);
        }
      });
    
    svg.call(zoom);
    
    // Setup drag behavior for tasks
    if (onTaskDrag) {
      const drag = d3.drag<SVGRectElement, GanttTask>()
        .on('start', function(event, d) {
          d3.select(this).raise().classed('dragging', true);
          setInteractionState(prev => ({
            ...prev,
            isDragging: true,
            draggedTaskId: d.id
          }));
        })
        .on('drag', function(event, d) {
          const newStartDate = xScale.invert(event.x);
          const duration = d.endDate.getTime() - d.startDate.getTime();
          const newEndDate = new Date(newStartDate.getTime() + duration);
          
          d3.select(this)
            .attr('x', xScale(newStartDate))
            .attr('width', xScale(newEndDate) - xScale(newStartDate));
        })
        .on('end', function(event, d) {
          d3.select(this).classed('dragging', false);
          
          const newStartDate = xScale.invert(event.x);
          const duration = d.endDate.getTime() - d.startDate.getTime();
          const newEndDate = new Date(newStartDate.getTime() + duration);
          
          onTaskDrag(d, newStartDate, newEndDate);
          
          setInteractionState(prev => ({
            ...prev,
            isDragging: false,
            draggedTaskId: null
          }));
        });
      
      tasksGroup.selectAll('.task-bar').call(drag);
    }
    
    endTracking();
  }, [
    filteredTasks,
    filteredEvents,
    xScale,
    yScale,
    statusColorScale,
    priorityColorScale,
    innerWidth,
    innerHeight,
    margin,
    showGrid,
    showProgress,
    showDependencies,
    showEvents,
    showToday,
    currentTime,
    levelOfDetail,
    muiTheme,
    minZoom,
    maxZoom,
    onTaskClick,
    onTaskDrag,
    onEventClick,
    onTimeRangeChange,
    startTracking,
    endTracking,
    interactionState.selectedTaskIds
  ]);

  // Initialize chart on mount and data changes
  useEffect(() => {
    initializeChart();
  }, [initializeChart]);

  // Playback animation
  useEffect(() => {
    if (!isPlaying || !onTimeChange) return;
    
    const interval = setInterval(() => {
      setInteractionState(prev => {
        const newTime = new Date(prev.currentTime.getTime() + (1000 * playbackSpeed));
        
        if (newTime > endDate) {
          onPlaybackToggle?.();
          return prev;
        }
        
        onTimeChange(newTime);
        return {
          ...prev,
          currentTime: newTime
        };
      });
    }, 100); // Update every 100ms for smooth animation
    
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, endDate, onTimeChange, onPlaybackToggle]);

  return (
    <ResponsiveContainer width={width} height={height}>
      <Box ref={containerRef} sx={{ position: 'relative', width: '100%', height: '100%' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            backgroundColor: muiTheme.palette.background.paper,
            borderRadius: muiTheme.shape.borderRadius
          }}
        />
        
        {/* Canvas overlay for high-performance rendering when needed */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            display: 'none' // Hidden by default, enabled for large datasets
          }}
        />
      </Box>
    </ResponsiveContainer>
  );
};