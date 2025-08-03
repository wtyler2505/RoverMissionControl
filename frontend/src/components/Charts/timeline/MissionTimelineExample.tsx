import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  ButtonGroup,
  Tab,
  Tabs,
  useTheme,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  FilterList as FilterIcon,
  Compare as CompareIcon,
  GetApp as ExportIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  Share as ShareIcon
} from '@mui/icons-material';

import { TimelineChart } from './TimelineChart';
import { TimelinePlaybackControls } from './TimelinePlaybackControls';
import { TimelineAnnotations } from './TimelineAnnotations';
import { TimelineFilterPanel, TimelineFilter } from './TimelineFilterPanel';
import { TimelineComparison, TimelineDataset } from './TimelineComparison';
import { TimelineExporter } from './TimelineExporter';
import { TimelineDataProcessor } from './TimelineDataProcessor';
import { GanttTask, MissionEvent, TimelineAnnotation } from './types';

/**
 * MissionTimelineExample - Complete example demonstrating all timeline features
 * This represents a Mars rover mission timeline with various phases and events
 */
export const MissionTimelineExample: React.FC = () => {
  const theme = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date('2024-03-15T10:00:00'));
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Mission start and end dates
  const missionStart = new Date('2024-01-01T00:00:00');
  const missionEnd = new Date('2024-12-31T23:59:59');
  
  // Sample mission tasks
  const missionTasks: GanttTask[] = [
    // Mission Planning Phase
    {
      id: 'mp-1',
      name: 'Mission Planning',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-15'),
      progress: 100,
      status: 'completed',
      priority: 'high',
      category: 'Planning',
      dependencies: []
    },
    {
      id: 'mp-2',
      name: 'Route Optimization',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-02-01'),
      progress: 100,
      status: 'completed',
      priority: 'high',
      category: 'Planning',
      dependencies: ['mp-1']
    },
    
    // Pre-Launch Phase
    {
      id: 'pl-1',
      name: 'System Checks',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-28'),
      progress: 100,
      status: 'completed',
      priority: 'critical',
      category: 'Pre-Launch',
      dependencies: ['mp-2']
    },
    {
      id: 'pl-2',
      name: 'Communication Setup',
      startDate: new Date('2024-02-15'),
      endDate: new Date('2024-03-01'),
      progress: 100,
      status: 'completed',
      priority: 'high',
      category: 'Pre-Launch',
      dependencies: ['pl-1']
    },
    
    // Launch & Transit
    {
      id: 'lt-1',
      name: 'Launch Window',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-03-05'),
      progress: 100,
      status: 'completed',
      priority: 'critical',
      category: 'Launch',
      dependencies: ['pl-2']
    },
    {
      id: 'lt-2',
      name: 'Transit to Mars',
      startDate: new Date('2024-03-05'),
      endDate: new Date('2024-06-01'),
      progress: 45,
      status: 'in-progress',
      priority: 'critical',
      category: 'Transit',
      dependencies: ['lt-1']
    },
    
    // Landing & Deployment
    {
      id: 'ld-1',
      name: 'Entry, Descent & Landing',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-02'),
      progress: 0,
      status: 'pending',
      priority: 'critical',
      category: 'Landing',
      dependencies: ['lt-2']
    },
    {
      id: 'ld-2',
      name: 'Rover Deployment',
      startDate: new Date('2024-06-02'),
      endDate: new Date('2024-06-05'),
      progress: 0,
      status: 'pending',
      priority: 'critical',
      category: 'Deployment',
      dependencies: ['ld-1']
    },
    
    // Science Operations
    {
      id: 'so-1',
      name: 'Initial Site Survey',
      startDate: new Date('2024-06-05'),
      endDate: new Date('2024-06-20'),
      progress: 0,
      status: 'pending',
      priority: 'high',
      category: 'Science',
      dependencies: ['ld-2']
    },
    {
      id: 'so-2',
      name: 'Sample Collection Campaign 1',
      startDate: new Date('2024-06-20'),
      endDate: new Date('2024-07-31'),
      progress: 0,
      status: 'pending',
      priority: 'high',
      category: 'Science',
      dependencies: ['so-1']
    },
    {
      id: 'so-3',
      name: 'Traverse to Site B',
      startDate: new Date('2024-08-01'),
      endDate: new Date('2024-08-15'),
      progress: 0,
      status: 'pending',
      priority: 'medium',
      category: 'Navigation',
      dependencies: ['so-2']
    },
    {
      id: 'so-4',
      name: 'Sample Collection Campaign 2',
      startDate: new Date('2024-08-15'),
      endDate: new Date('2024-09-30'),
      progress: 0,
      status: 'pending',
      priority: 'high',
      category: 'Science',
      dependencies: ['so-3']
    },
    {
      id: 'so-5',
      name: 'Winter Operations',
      startDate: new Date('2024-10-01'),
      endDate: new Date('2024-12-31'),
      progress: 0,
      status: 'pending',
      priority: 'medium',
      category: 'Operations',
      dependencies: ['so-4']
    }
  ];
  
  // Sample mission events
  const missionEvents: MissionEvent[] = [
    {
      id: 'event-1',
      timestamp: new Date('2024-01-01T00:00:00'),
      type: 'milestone',
      title: 'Mission Start',
      severity: 'info'
    },
    {
      id: 'event-2',
      timestamp: new Date('2024-03-01T10:00:00'),
      type: 'milestone',
      title: 'Launch Window Opens',
      severity: 'info'
    },
    {
      id: 'event-3',
      timestamp: new Date('2024-03-05T14:30:00'),
      type: 'command',
      title: 'Launch Sequence Initiated',
      severity: 'critical'
    },
    {
      id: 'event-4',
      timestamp: new Date('2024-03-15T10:00:00'),
      type: 'telemetry',
      title: 'Current Position Update',
      severity: 'info',
      description: 'Spacecraft on nominal trajectory'
    },
    {
      id: 'event-5',
      timestamp: new Date('2024-04-01T00:00:00'),
      type: 'alert',
      title: 'Solar Panel Anomaly',
      severity: 'warning',
      description: 'Reduced power generation detected'
    },
    {
      id: 'event-6',
      timestamp: new Date('2024-06-01T08:00:00'),
      type: 'milestone',
      title: 'Mars Approach',
      severity: 'critical'
    },
    {
      id: 'event-7',
      timestamp: new Date('2024-06-02T12:00:00'),
      type: 'milestone',
      title: 'Landing Success',
      severity: 'info'
    }
  ];
  
  // Sample annotations
  const [annotations, setAnnotations] = useState<TimelineAnnotation[]>([
    {
      id: 'ann-1',
      startTime: new Date('2024-03-01'),
      endTime: new Date('2024-03-05'),
      text: 'Critical launch window - all systems must be GO',
      author: 'Mission Director',
      createdAt: new Date('2024-01-15'),
      color: '#ff9800'
    },
    {
      id: 'ann-2',
      startTime: new Date('2024-04-01'),
      text: 'Solar panel issue needs investigation',
      author: 'Engineering Team',
      createdAt: new Date('2024-04-01'),
      color: '#f44336'
    }
  ]);
  
  // Filter state
  const [filter, setFilter] = useState<TimelineFilter>({
    taskStatuses: new Set(),
    taskPriorities: new Set(),
    taskCategories: new Set(),
    taskResources: new Set(),
    taskDateRange: { start: null, end: null },
    taskProgressRange: [0, 100],
    showOnlyCriticalPath: false,
    showOnlyOverdue: false,
    showOnlyMilestones: false,
    eventTypes: new Set(),
    eventSeverities: new Set(),
    eventDateRange: { start: null, end: null },
    searchText: '',
    hideCompleted: false,
    hideEmpty: false
  });
  
  // Comparison datasets
  const comparisonDatasets: TimelineDataset[] = [
    {
      id: 'planned',
      label: 'Planned Schedule',
      tasks: missionTasks,
      events: missionEvents,
      color: theme.palette.primary.main,
      visible: true,
      opacity: 1
    },
    {
      id: 'actual',
      label: 'Actual Progress',
      tasks: missionTasks.map(task => ({
        ...task,
        // Simulate some delays
        startDate: new Date(task.startDate.getTime() + (Math.random() * 5 * 24 * 60 * 60 * 1000)),
        endDate: new Date(task.endDate.getTime() + (Math.random() * 10 * 24 * 60 * 60 * 1000))
      })),
      events: missionEvents,
      color: theme.palette.secondary.main,
      visible: true,
      opacity: 0.7
    }
  ];
  
  // Handlers
  const handleExport = useCallback(async (format: string) => {
    setExportMenuAnchor(null);
    
    switch (format) {
      case 'png':
        if (svgRef.current) {
          await TimelineExporter.exportToPNG(svgRef.current, {
            filename: `mars-mission-timeline-${new Date().toISOString().split('T')[0]}.png`
          });
        }
        break;
      case 'svg':
        if (svgRef.current) {
          TimelineExporter.exportToSVG(svgRef.current, {
            filename: `mars-mission-timeline-${new Date().toISOString().split('T')[0]}.svg`
          });
        }
        break;
      case 'json':
        TimelineExporter.exportToJSON({
          tasks: missionTasks,
          events: missionEvents,
          annotations,
          metadata: {
            mission: 'Mars Rover Mission 2024',
            exportDate: new Date().toISOString()
          }
        });
        break;
      case 'csv':
        TimelineExporter.exportToCSV(missionTasks);
        break;
      case 'pdf':
        await TimelineExporter.exportToPDF({
          tasks: missionTasks,
          events: missionEvents,
          annotations,
          title: 'Mars Rover Mission Timeline',
          description: 'Complete mission timeline from planning to operations'
        });
        break;
    }
  }, [missionTasks, missionEvents, annotations]);
  
  const handleShare = useCallback(() => {
    const shareUrl = TimelineExporter.generateShareableLink({
      tasks: missionTasks,
      events: missionEvents
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareUrl);
    console.log('Share URL copied:', shareUrl);
  }, [missionTasks, missionEvents]);
  
  const handleAnnotationAdd = useCallback((annotation: Omit<TimelineAnnotation, 'id' | 'createdAt'>) => {
    const newAnnotation: TimelineAnnotation = {
      ...annotation,
      id: `ann-${Date.now()}`,
      createdAt: new Date()
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);
  
  // Data processor for statistics
  const processor = new TimelineDataProcessor();
  const statistics = processor.calculateStatistics(missionTasks);
  const criticalPath = processor.calculateCriticalPath(missionTasks);
  
  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TimelineIcon color="primary" />
          <Typography variant="h5" sx={{ flexGrow: 0 }}>
            Mars Rover Mission Timeline
          </Typography>
          
          <Box sx={{ flexGrow: 1 }} />
          
          <ButtonGroup variant="outlined" size="small">
            <Button
              startIcon={<FilterIcon />}
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            >
              Filters
            </Button>
            <Button
              startIcon={<ExportIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            >
              Export
            </Button>
            <Button
              startIcon={<ShareIcon />}
              onClick={handleShare}
            >
              Share
            </Button>
            <Button startIcon={<FullscreenIcon />}>
              Fullscreen
            </Button>
          </ButtonGroup>
        </Stack>
      </Paper>
      
      {/* Tabs */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Timeline View" />
          <Tab label="Comparison" />
          <Tab label="Statistics" />
        </Tabs>
      </Paper>
      
      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* Filter Panel Drawer */}
        <Drawer
          anchor="left"
          open={filterPanelOpen}
          onClose={() => setFilterPanelOpen(false)}
          variant="persistent"
          sx={{
            '& .MuiDrawer-paper': {
              position: 'relative',
              width: 320
            }
          }}
        >
          <TimelineFilterPanel
            tasks={missionTasks}
            events={missionEvents}
            filter={filter}
            onFilterChange={setFilter}
            onToggleCollapse={() => setFilterPanelOpen(false)}
          />
        </Drawer>
        
        {/* Timeline Content */}
        <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
          {activeTab === 0 && (
            <Stack spacing={2}>
              {/* Playback Controls */}
              <Paper elevation={1} sx={{ p: 2 }}>
                <TimelinePlaybackControls
                  startTime={missionStart}
                  endTime={missionEnd}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onStop={() => {
                    setIsPlaying(false);
                    setCurrentTime(missionStart);
                  }}
                  onTimeChange={setCurrentTime}
                  onSpeedChange={setPlaybackSpeed}
                  enableKeyboardShortcuts={true}
                  showMiniTimeline={true}
                  timelineTasks={missionTasks}
                />
              </Paper>
              
              {/* Main Timeline Chart */}
              <Paper elevation={2} sx={{ p: 2, position: 'relative' }}>
                <TimelineChart
                  tasks={missionTasks}
                  events={missionEvents}
                  annotations={annotations}
                  startDate={missionStart}
                  endDate={missionEnd}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  onTimeChange={setCurrentTime}
                  onPlaybackToggle={() => setIsPlaying(!isPlaying)}
                  showDependencies={true}
                  showProgress={true}
                  showEvents={true}
                  showAnnotations={true}
                  onAnnotationAdd={handleAnnotationAdd}
                  width={1400}
                  height={600}
                />
                
                {/* Annotations Overlay */}
                <TimelineAnnotations
                  annotations={annotations}
                  onAnnotationAdd={handleAnnotationAdd}
                  onAnnotationEdit={(id, updates) => {
                    setAnnotations(prev => prev.map(a => 
                      a.id === id ? { ...a, ...updates } : a
                    ));
                  }}
                  onAnnotationDelete={(id) => {
                    setAnnotations(prev => prev.filter(a => a.id !== id));
                  }}
                  timeScale={d3.scaleTime()
                    .domain([missionStart, missionEnd])
                    .range([0, 1400])}
                  height={600}
                />
              </Paper>
            </Stack>
          )}
          
          {activeTab === 1 && (
            <TimelineComparison
              datasets={comparisonDatasets}
              comparisonMode="overlay"
              showMetrics={true}
              showLegend={true}
              enableAlignment={true}
              width={1400}
              height={700}
            />
          )}
          
          {activeTab === 2 && (
            <Paper elevation={1} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Mission Statistics
              </Typography>
              
              <Stack spacing={3}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Overall Progress
                  </Typography>
                  <Stack direction="row" spacing={4}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Total Tasks
                      </Typography>
                      <Typography variant="h4">
                        {statistics.totalTasks}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Completed
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {statistics.completedTasks}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        In Progress
                      </Typography>
                      <Typography variant="h4" color="info.main">
                        {missionTasks.filter(t => t.status === 'in-progress').length}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Completion Rate
                      </Typography>
                      <Typography variant="h4">
                        {((statistics.completedTasks / statistics.totalTasks) * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Critical Path
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    The following tasks are on the critical path and directly impact the mission end date:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {criticalPath.map(taskId => {
                      const task = missionTasks.find(t => t.id === taskId);
                      return task ? (
                        <Chip
                          key={task.id}
                          label={task.name}
                          color="error"
                          variant="outlined"
                        />
                      ) : null;
                    })}
                  </Stack>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Resource Utilization
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {Object.entries(statistics.resourceUtilization).map(([resource, utilization]) => (
                      <Box key={resource}>
                        <Typography variant="caption">{resource}</Typography>
                        <Typography variant="body2">{(utilization * 100).toFixed(1)}%</Typography>
                      </Box>
                    ))}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}
        </Box>
      </Box>
      
      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('png')}>Export as PNG</MenuItem>
        <MenuItem onClick={() => handleExport('svg')}>Export as SVG</MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
        <Divider />
        <MenuItem onClick={() => handleExport('json')}>Export as JSON</MenuItem>
        <MenuItem onClick={() => handleExport('csv')}>Export as CSV</MenuItem>
      </Menu>
    </Box>
  );
};