import React, { useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Tooltip,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Grid,
} from '@mui/material';
import {
  ViewList as ListIcon,
  AccountTree as TreeIcon,
  Timeline as TimelineIcon,
  PieChart as ChartIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  CenterFocusStrong as FitIcon,
  Fullscreen as FullscreenIcon,
} from '@mui/icons-material';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

interface Command {
  id: string;
  type: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  dependencies: string[];
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface BatchProgressVisualizationProps {
  commands: Command[];
  currentCommandId?: string;
  viewMode?: 'list' | 'tree' | 'timeline' | 'sankey';
  onCommandClick?: (commandId: string) => void;
  height?: number;
}

const BatchProgressVisualization: React.FC<BatchProgressVisualizationProps> = ({
  commands,
  currentCommandId,
  viewMode = 'tree',
  onCommandClick,
  height = 400,
}) => {
  const theme = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedView, setSelectedView] = React.useState(viewMode);
  const [zoom, setZoom] = React.useState(1);
  const [colorBy, setColorBy] = React.useState<'status' | 'type' | 'progress'>('status');

  // Color scales
  const statusColors = useMemo(() => ({
    pending: theme.palette.grey[400],
    executing: theme.palette.info.main,
    completed: theme.palette.success.main,
    failed: theme.palette.error.main,
    cancelled: theme.palette.warning.main,
  }), [theme]);

  const typeColors = useMemo(() => {
    const types = [...new Set(commands.map(c => c.type))];
    const scale = d3.scaleOrdinal(d3.schemeCategory10);
    return Object.fromEntries(types.map(t => [t, scale(t)]));
  }, [commands]);

  const progressColor = useMemo(() => 
    d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 100]),
    []
  );

  // Get color for a command
  const getCommandColor = (command: Command) => {
    switch (colorBy) {
      case 'status':
        return statusColors[command.status];
      case 'type':
        return typeColors[command.type];
      case 'progress':
        return progressColor(command.progress);
      default:
        return theme.palette.primary.main;
    }
  };

  // Tree view
  useEffect(() => {
    if (selectedView !== 'tree' || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 800;
    const nodeRadius = 20;
    const nodeSpacing = 100;
    const levelSpacing = 150;

    // Build hierarchy
    const nodes = commands.map(cmd => ({
      id: cmd.id,
      data: cmd,
      dependencies: cmd.dependencies,
    }));

    // Calculate levels using topological sort
    const levels: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // Initialize in-degrees
    nodes.forEach(node => {
      inDegree.set(node.id, node.dependencies.length);
    });

    // Find nodes with no dependencies
    let currentLevel = nodes
      .filter(node => node.dependencies.length === 0)
      .map(node => node.id);

    while (currentLevel.length > 0) {
      levels.push(currentLevel);
      currentLevel.forEach(id => visited.add(id));

      const nextLevel: string[] = [];
      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          const remainingDeps = node.dependencies.filter(dep => !visited.has(dep));
          if (remainingDeps.length === 0) {
            nextLevel.push(node.id);
          }
        }
      });
      currentLevel = nextLevel;
    }

    // Position nodes
    const nodePositions = new Map<string, { x: number; y: number }>();
    levels.forEach((level, levelIndex) => {
      const levelWidth = level.length * nodeSpacing;
      const startX = (width - levelWidth) / 2;
      
      level.forEach((nodeId, nodeIndex) => {
        nodePositions.set(nodeId, {
          x: startX + nodeIndex * nodeSpacing + nodeSpacing / 2,
          y: levelIndex * levelSpacing + 50,
        });
      });
    });

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const g = svg.append('g');

    // Draw edges
    const edges = g.append('g')
      .attr('class', 'edges');

    nodes.forEach(node => {
      const targetPos = nodePositions.get(node.id);
      if (!targetPos) return;

      node.dependencies.forEach(depId => {
        const sourcePos = nodePositions.get(depId);
        if (!sourcePos) return;

        edges.append('line')
          .attr('x1', sourcePos.x)
          .attr('y1', sourcePos.y)
          .attr('x2', targetPos.x)
          .attr('y2', targetPos.y)
          .attr('stroke', theme.palette.divider)
          .attr('stroke-width', 2)
          .attr('marker-end', 'url(#arrowhead)');
      });
    });

    // Add arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', nodeRadius + 10)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 10)
      .attr('markerHeight', 10)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', theme.palette.divider);

    // Draw nodes
    const nodeGroups = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('transform', d => {
        const pos = nodePositions.get(d.id);
        return pos ? `translate(${pos.x},${pos.y})` : '';
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (onCommandClick) {
          onCommandClick(d.id);
        }
      });

    // Node circles
    nodeGroups.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', d => getCommandColor(d.data))
      .attr('stroke', d => d.id === currentCommandId ? theme.palette.primary.main : 'none')
      .attr('stroke-width', 3);

    // Progress indicator
    nodeGroups.append('path')
      .attr('d', d => {
        const angle = (d.data.progress / 100) * 2 * Math.PI - Math.PI / 2;
        const x = nodeRadius * Math.cos(angle);
        const y = nodeRadius * Math.sin(angle);
        return `M 0,${-nodeRadius} A ${nodeRadius},${nodeRadius} 0 ${d.data.progress > 50 ? 1 : 0},1 ${x},${y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', theme.palette.background.paper)
      .attr('stroke-width', 3)
      .attr('opacity', 0.8);

    // Node labels
    nodeGroups.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', theme.palette.background.paper)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .text(d => d.id.substring(0, 3));

    // Tooltips
    nodeGroups.append('title')
      .text(d => `${d.data.type}\nStatus: ${d.data.status}\nProgress: ${d.data.progress}%`);

  }, [selectedView, commands, currentCommandId, theme, colorBy, getCommandColor, onCommandClick]);

  // Timeline view
  useEffect(() => {
    if (selectedView !== 'timeline' || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 800;
    const margin = { top: 20, right: 20, bottom: 40, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate time domain
    const startTimes = commands
      .filter(c => c.startTime)
      .map(c => c.startTime!);
    const endTimes = commands
      .filter(c => c.endTime)
      .map(c => c.endTime!);

    if (startTimes.length === 0) return;

    const minTime = Math.min(...startTimes);
    const maxTime = Math.max(...endTimes, Date.now());

    // Scales
    const xScale = d3.scaleLinear()
      .domain([minTime, maxTime])
      .range([0, innerWidth]);

    const yScale = d3.scaleBand()
      .domain(commands.map(c => c.id))
      .range([0, innerHeight])
      .padding(0.1);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X-axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale)
        .tickFormat(d => {
          const elapsed = (d as number) - minTime;
          const seconds = Math.floor(elapsed / 1000);
          const minutes = Math.floor(seconds / 60);
          return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
        }));

    // Y-axis
    g.append('g')
      .call(d3.axisLeft(yScale));

    // Bars
    const bars = g.selectAll('.bar')
      .data(commands)
      .enter()
      .append('g')
      .attr('class', 'bar');

    // Background bar (total time)
    bars.append('rect')
      .attr('x', d => d.startTime ? xScale(d.startTime) : 0)
      .attr('y', d => yScale(d.id)!)
      .attr('width', d => {
        if (!d.startTime) return 0;
        const end = d.endTime || Date.now();
        return xScale(end) - xScale(d.startTime);
      })
      .attr('height', yScale.bandwidth())
      .attr('fill', theme.palette.action.hover)
      .attr('rx', 4);

    // Progress bar
    bars.append('rect')
      .attr('x', d => d.startTime ? xScale(d.startTime) : 0)
      .attr('y', d => yScale(d.id)!)
      .attr('width', d => {
        if (!d.startTime) return 0;
        const end = d.endTime || Date.now();
        const totalWidth = xScale(end) - xScale(d.startTime);
        return totalWidth * (d.progress / 100);
      })
      .attr('height', yScale.bandwidth())
      .attr('fill', d => getCommandColor(d))
      .attr('rx', 4);

    // Labels
    bars.append('text')
      .attr('x', d => {
        if (!d.startTime) return 0;
        const end = d.endTime || Date.now();
        return xScale(d.startTime) + (xScale(end) - xScale(d.startTime)) / 2;
      })
      .attr('y', d => yScale(d.id)! + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', theme.palette.text.primary)
      .attr('font-size', '12px')
      .text(d => `${d.progress}%`);

  }, [selectedView, commands, theme, height, colorBy, getCommandColor]);

  // Sankey diagram view
  useEffect(() => {
    if (selectedView !== 'sankey' || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current?.clientWidth || 800;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Prepare data for sankey
    const statusGroups = ['pending', 'executing', 'completed', 'failed', 'cancelled'];
    const nodes: any[] = [];
    const links: any[] = [];

    // Create nodes for each status
    statusGroups.forEach((status, index) => {
      nodes.push({
        id: status,
        name: status.charAt(0).toUpperCase() + status.slice(1),
        x: (index / (statusGroups.length - 1)) * innerWidth,
        y: innerHeight / 2,
      });
    });

    // Create links based on command transitions
    const statusCounts: Record<string, number> = {};
    commands.forEach(cmd => {
      statusCounts[cmd.status] = (statusCounts[cmd.status] || 0) + 1;
    });

    // For demonstration, create flows between statuses
    const flows = [
      { source: 'pending', target: 'executing', value: statusCounts.executing || 0 },
      { source: 'executing', target: 'completed', value: statusCounts.completed || 0 },
      { source: 'executing', target: 'failed', value: statusCounts.failed || 0 },
      { source: 'pending', target: 'cancelled', value: statusCounts.cancelled || 0 },
    ];

    flows.forEach(flow => {
      if (flow.value > 0) {
        links.push({
          source: nodes.findIndex(n => n.id === flow.source),
          target: nodes.findIndex(n => n.id === flow.target),
          value: flow.value,
        });
      }
    });

    // Create sankey generator
    const sankeyGenerator = sankey()
      .nodeWidth(30)
      .nodePadding(40)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    });

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Draw links
    g.append('g')
      .selectAll('path')
      .data(sankeyLinks)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', theme.palette.primary.main)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', (d: any) => Math.max(1, d.width));

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(sankeyNodes)
      .enter()
      .append('g');

    node.append('rect')
      .attr('x', (d: any) => d.x0)
      .attr('y', (d: any) => d.y0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('fill', (d: any) => statusColors[d.id] || theme.palette.grey[500])
      .attr('rx', 4);

    node.append('text')
      .attr('x', (d: any) => (d.x0 + d.x1) / 2)
      .attr('y', (d: any) => (d.y0 + d.y1) / 2)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', theme.palette.background.paper)
      .attr('font-weight', 'bold')
      .text((d: any) => d.name);

    // Add counts
    node.append('text')
      .attr('x', (d: any) => (d.x0 + d.x1) / 2)
      .attr('y', (d: any) => (d.y0 + d.y1) / 2 + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.palette.background.paper)
      .attr('font-size', '12px')
      .text((d: any) => statusCounts[d.id] || 0);

  }, [selectedView, commands, theme, height, statusColors]);

  // List view
  const renderListView = () => (
    <Box sx={{ height, overflow: 'auto' }}>
      {commands.map((cmd) => (
        <Paper
          key={cmd.id}
          sx={{
            p: 2,
            mb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'pointer',
            border: cmd.id === currentCommandId ? 2 : 0,
            borderColor: 'primary.main',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
          onClick={() => onCommandClick?.(cmd.id)}
        >
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: getCommandColor(cmd),
            }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle2">{cmd.id}</Typography>
            <Typography variant="body2" color="text.secondary">
              {cmd.type}
            </Typography>
          </Box>
          <Box sx={{ minWidth: 100 }}>
            <Typography variant="body2" color="text.secondary">
              Progress: {cmd.progress}%
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: 4,
                bgcolor: 'action.hover',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${cmd.progress}%`,
                  height: '100%',
                  bgcolor: getCommandColor(cmd),
                  transition: 'width 0.3s',
                }}
              />
            </Box>
          </Box>
          <Chip
            label={cmd.status}
            size="small"
            sx={{
              bgcolor: getCommandColor(cmd),
              color: 'white',
            }}
          />
        </Paper>
      ))}
    </Box>
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6">Batch Progress Visualization</Typography>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Color By</InputLabel>
            <Select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as any)}
            >
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="type">Type</MenuItem>
              <MenuItem value="progress">Progress</MenuItem>
            </Select>
          </FormControl>
          <ToggleButtonGroup
            value={selectedView}
            exclusive
            onChange={(_, value) => value && setSelectedView(value)}
            size="small"
          >
            <ToggleButton value="list">
              <Tooltip title="List View">
                <ListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="tree">
              <Tooltip title="Tree View">
                <TreeIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="timeline">
              <Tooltip title="Timeline View">
                <TimelineIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="sankey">
              <Tooltip title="Flow View">
                <ChartIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      <Box ref={containerRef} sx={{ position: 'relative' }}>
        {selectedView === 'list' ? (
          renderListView()
        ) : (
          <>
            <svg
              ref={svgRef}
              width="100%"
              height={height}
              style={{ border: `1px solid ${theme.palette.divider}` }}
            />
            {selectedView === 'tree' && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  display: 'flex',
                  gap: 1,
                }}
              >
                <IconButton
                  size="small"
                  onClick={() => {
                    const svg = d3.select(svgRef.current);
                    const g = svg.select('g');
                    const currentTransform = d3.zoomTransform(svg.node() as any);
                    const newScale = currentTransform.k * 1.2;
                    svg.transition()
                      .duration(300)
                      .call(
                        d3.zoom<SVGSVGElement, unknown>().transform as any,
                        d3.zoomIdentity
                          .translate(currentTransform.x, currentTransform.y)
                          .scale(newScale)
                      );
                  }}
                >
                  <ZoomInIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    const svg = d3.select(svgRef.current);
                    const currentTransform = d3.zoomTransform(svg.node() as any);
                    const newScale = currentTransform.k / 1.2;
                    svg.transition()
                      .duration(300)
                      .call(
                        d3.zoom<SVGSVGElement, unknown>().transform as any,
                        d3.zoomIdentity
                          .translate(currentTransform.x, currentTransform.y)
                          .scale(newScale)
                      );
                  }}
                >
                  <ZoomOutIcon />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    const svg = d3.select(svgRef.current);
                    svg.transition()
                      .duration(300)
                      .call(
                        d3.zoom<SVGSVGElement, unknown>().transform as any,
                        d3.zoomIdentity
                      );
                  }}
                >
                  <FitIcon />
                </IconButton>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Legend */}
      <Box mt={2} display="flex" gap={2} flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">
          Legend:
        </Typography>
        {colorBy === 'status' && Object.entries(statusColors).map(([status, color]) => (
          <Box key={status} display="flex" alignItems="center" gap={0.5}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: color,
              }}
            />
            <Typography variant="caption">{status}</Typography>
          </Box>
        ))}
        {colorBy === 'progress' && (
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 100,
                height: 12,
                background: `linear-gradient(to right, ${progressColor(0)}, ${progressColor(50)}, ${progressColor(100)})`,
                borderRadius: 1,
              }}
            />
            <Typography variant="caption">0% - 100%</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default BatchProgressVisualization;