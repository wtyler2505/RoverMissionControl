import React, { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  IconButton,
  Tooltip,
  Button,
  useTheme,
  alpha
} from '@mui/material';
import {
  CompareArrows as CompareIcon,
  Layers as LayersIcon,
  Timeline as TimelineIcon,
  Difference as DifferenceIcon,
  Merge as MergeIcon,
  SwapHoriz as SwapIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import * as d3 from 'd3';
import { GanttTask, MissionEvent } from './types';
import { TimelineChart } from './TimelineChart';
import { TimelineDataProcessor } from './TimelineDataProcessor';

export interface TimelineDataset {
  id: string;
  label: string;
  tasks: GanttTask[];
  events?: MissionEvent[];
  color?: string;
  visible?: boolean;
  opacity?: number;
}

export interface ComparisonMetrics {
  durationDifference: number;
  taskCountDifference: number;
  completionRateDifference: number;
  criticalPathDifference: number;
  resourceUtilizationDifference: number;
  addedTasks: GanttTask[];
  removedTasks: GanttTask[];
  modifiedTasks: Array<{
    task: GanttTask;
    changes: string[];
  }>;
}

export interface TimelineComparisonProps {
  datasets: TimelineDataset[];
  comparisonMode?: 'overlay' | 'side-by-side' | 'difference' | 'merged';
  baselineIndex?: number;
  onDatasetToggle?: (datasetId: string, visible: boolean) => void;
  onOpacityChange?: (datasetId: string, opacity: number) => void;
  onComparisonModeChange?: (mode: string) => void;
  showMetrics?: boolean;
  showLegend?: boolean;
  enableAlignment?: boolean;
  alignmentMode?: 'start' | 'end' | 'milestone' | 'average';
  width?: number;
  height?: number;
}

export const TimelineComparison: React.FC<TimelineComparisonProps> = ({
  datasets,
  comparisonMode = 'overlay',
  baselineIndex = 0,
  onDatasetToggle,
  onOpacityChange,
  onComparisonModeChange,
  showMetrics = true,
  showLegend = true,
  enableAlignment = true,
  alignmentMode = 'start',
  width = 1400,
  height = 800
}) => {
  const theme = useTheme();
  const processor = useMemo(() => new TimelineDataProcessor(), []);
  const [selectedBaseline, setSelectedBaseline] = useState(baselineIndex);
  const [selectedComparison, setSelectedComparison] = useState(1);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  const [alignTimelines, setAlignTimelines] = useState(enableAlignment);
  const [currentAlignmentMode, setCurrentAlignmentMode] = useState(alignmentMode);

  // Calculate comparison metrics
  const metrics = useMemo((): ComparisonMetrics | null => {
    if (datasets.length < 2) return null;
    
    const baseline = datasets[selectedBaseline];
    const comparison = datasets[selectedComparison];
    
    if (!baseline || !comparison) return null;

    // Calculate various metrics
    const baselineStats = processor.calculateStatistics(baseline.tasks);
    const comparisonStats = processor.calculateStatistics(comparison.tasks);
    
    // Find task differences
    const baselineTaskIds = new Set(baseline.tasks.map(t => t.id));
    const comparisonTaskIds = new Set(comparison.tasks.map(t => t.id));
    
    const addedTasks = comparison.tasks.filter(t => !baselineTaskIds.has(t.id));
    const removedTasks = baseline.tasks.filter(t => !comparisonTaskIds.has(t.id));
    
    const modifiedTasks: Array<{ task: GanttTask; changes: string[] }> = [];
    
    baseline.tasks.forEach(baseTask => {
      const compTask = comparison.tasks.find(t => t.id === baseTask.id);
      if (compTask) {
        const changes: string[] = [];
        
        if (baseTask.startDate.getTime() !== compTask.startDate.getTime()) {
          changes.push('Start date changed');
        }
        if (baseTask.endDate.getTime() !== compTask.endDate.getTime()) {
          changes.push('End date changed');
        }
        if (baseTask.status !== compTask.status) {
          changes.push(`Status: ${baseTask.status} → ${compTask.status}`);
        }
        if (baseTask.progress !== compTask.progress) {
          changes.push(`Progress: ${baseTask.progress}% → ${compTask.progress}%`);
        }
        
        if (changes.length > 0) {
          modifiedTasks.push({ task: compTask, changes });
        }
      }
    });

    return {
      durationDifference: comparisonStats.averageTaskDuration - baselineStats.averageTaskDuration,
      taskCountDifference: comparison.tasks.length - baseline.tasks.length,
      completionRateDifference: 
        (comparisonStats.completedTasks / comparison.tasks.length * 100) -
        (baselineStats.completedTasks / baseline.tasks.length * 100),
      criticalPathDifference: comparisonStats.criticalPathLength - baselineStats.criticalPathLength,
      resourceUtilizationDifference: 0, // Would need resource data
      addedTasks,
      removedTasks,
      modifiedTasks
    };
  }, [datasets, selectedBaseline, selectedComparison, processor]);

  // Align timelines based on mode
  const alignedDatasets = useMemo(() => {
    if (!alignTimelines || datasets.length < 2) return datasets;
    
    const baseline = datasets[selectedBaseline];
    if (!baseline) return datasets;
    
    return datasets.map((dataset, index) => {
      if (index === selectedBaseline) return dataset;
      
      let offset = 0;
      
      switch (currentAlignmentMode) {
        case 'start': {
          const baselineStart = Math.min(...baseline.tasks.map(t => t.startDate.getTime()));
          const datasetStart = Math.min(...dataset.tasks.map(t => t.startDate.getTime()));
          offset = baselineStart - datasetStart;
          break;
        }
        case 'end': {
          const baselineEnd = Math.max(...baseline.tasks.map(t => t.endDate.getTime()));
          const datasetEnd = Math.max(...dataset.tasks.map(t => t.endDate.getTime()));
          offset = baselineEnd - datasetEnd;
          break;
        }
        case 'milestone': {
          // Align by first milestone event
          const baselineMilestone = baseline.events?.find(e => e.type === 'milestone');
          const datasetMilestone = dataset.events?.find(e => e.type === 'milestone');
          if (baselineMilestone && datasetMilestone) {
            offset = baselineMilestone.timestamp.getTime() - datasetMilestone.timestamp.getTime();
          }
          break;
        }
        case 'average': {
          const baselineAvg = baseline.tasks.reduce((sum, t) => 
            sum + (t.startDate.getTime() + t.endDate.getTime()) / 2, 0) / baseline.tasks.length;
          const datasetAvg = dataset.tasks.reduce((sum, t) => 
            sum + (t.startDate.getTime() + t.endDate.getTime()) / 2, 0) / dataset.tasks.length;
          offset = baselineAvg - datasetAvg;
          break;
        }
      }
      
      if (offset === 0) return dataset;
      
      // Apply offset to all dates
      return {
        ...dataset,
        tasks: dataset.tasks.map(task => ({
          ...task,
          startDate: new Date(task.startDate.getTime() + offset),
          endDate: new Date(task.endDate.getTime() + offset)
        })),
        events: dataset.events?.map(event => ({
          ...event,
          timestamp: new Date(event.timestamp.getTime() + offset)
        }))
      };
    });
  }, [datasets, alignTimelines, currentAlignmentMode, selectedBaseline]);

  // Generate difference visualization data
  const differenceData = useMemo(() => {
    if (comparisonMode !== 'difference' || !metrics) return null;
    
    const differences: GanttTask[] = [];
    
    // Add removed tasks (shown in red)
    metrics.removedTasks.forEach(task => {
      differences.push({
        ...task,
        id: `removed-${task.id}`,
        status: 'cancelled' as const,
        metadata: { ...task.metadata, differenceType: 'removed' }
      });
    });
    
    // Add added tasks (shown in green)
    metrics.addedTasks.forEach(task => {
      differences.push({
        ...task,
        id: `added-${task.id}`,
        status: 'completed' as const,
        metadata: { ...task.metadata, differenceType: 'added' }
      });
    });
    
    // Add modified tasks (shown in yellow)
    metrics.modifiedTasks.forEach(({ task, changes }) => {
      differences.push({
        ...task,
        id: `modified-${task.id}`,
        status: 'in-progress' as const,
        metadata: { ...task.metadata, differenceType: 'modified', changes }
      });
    });
    
    return differences;
  }, [comparisonMode, metrics]);

  // Render based on comparison mode
  const renderComparison = () => {
    switch (comparisonMode) {
      case 'overlay':
        return (
          <Box sx={{ position: 'relative', width, height }}>
            {alignedDatasets.map((dataset, index) => (
              <Box
                key={dataset.id}
                sx={{
                  position: index === 0 ? 'relative' : 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: dataset.opacity || (index === 0 ? 1 : 0.6),
                  display: dataset.visible !== false ? 'block' : 'none',
                  pointerEvents: index === alignedDatasets.length - 1 ? 'auto' : 'none'
                }}
              >
                <TimelineChart
                  tasks={dataset.tasks}
                  events={dataset.events}
                  startDate={new Date(Math.min(...alignedDatasets.flatMap(d => 
                    d.tasks.map(t => t.startDate.getTime()))))}
                  endDate={new Date(Math.max(...alignedDatasets.flatMap(d => 
                    d.tasks.map(t => t.endDate.getTime()))))}
                  width={width}
                  height={height}
                  theme={{
                    primaryColor: dataset.color || theme.palette.primary.main
                  }}
                />
              </Box>
            ))}
          </Box>
        );
      
      case 'side-by-side':
        const splitWidth = width / Math.min(alignedDatasets.length, 2);
        return (
          <Stack direction="row" spacing={2}>
            {alignedDatasets.slice(0, 2).map((dataset) => (
              <Box key={dataset.id} sx={{ width: splitWidth }}>
                <Typography variant="subtitle1" align="center" gutterBottom>
                  {dataset.label}
                </Typography>
                <TimelineChart
                  tasks={dataset.tasks}
                  events={dataset.events}
                  startDate={new Date(Math.min(...dataset.tasks.map(t => t.startDate.getTime())))}
                  endDate={new Date(Math.max(...dataset.tasks.map(t => t.endDate.getTime())))}
                  width={splitWidth}
                  height={height - 40}
                  theme={{
                    primaryColor: dataset.color || theme.palette.primary.main
                  }}
                />
              </Box>
            ))}
          </Stack>
        );
      
      case 'difference':
        if (!differenceData) return null;
        return (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Differences: {datasets[selectedBaseline]?.label} vs {datasets[selectedComparison]?.label}
            </Typography>
            <TimelineChart
              tasks={showDifferencesOnly ? differenceData : [
                ...alignedDatasets[selectedBaseline].tasks,
                ...differenceData
              ]}
              events={alignedDatasets[selectedBaseline].events}
              startDate={new Date(Math.min(...alignedDatasets.flatMap(d => 
                d.tasks.map(t => t.startDate.getTime()))))}
              endDate={new Date(Math.max(...alignedDatasets.flatMap(d => 
                d.tasks.map(t => t.endDate.getTime()))))}
              width={width}
              height={height}
            />
          </Box>
        );
      
      case 'merged':
        const mergedTasks = alignedDatasets.flatMap((dataset, index) => 
          dataset.tasks.map(task => ({
            ...task,
            id: `${dataset.id}-${task.id}`,
            name: `[${dataset.label}] ${task.name}`,
            category: dataset.label
          }))
        );
        
        return (
          <TimelineChart
            tasks={mergedTasks}
            events={alignedDatasets.flatMap(d => d.events || [])}
            startDate={new Date(Math.min(...mergedTasks.map(t => t.startDate.getTime())))}
            endDate={new Date(Math.max(...mergedTasks.map(t => t.endDate.getTime())))}
            width={width}
            height={height}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      {/* Controls */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <CompareIcon />
        <Typography variant="h6" sx={{ flexGrow: 0 }}>
          Timeline Comparison
        </Typography>
        
        <ToggleButtonGroup
          value={comparisonMode}
          exclusive
          onChange={(e, value) => value && onComparisonModeChange?.(value)}
          size="small"
        >
          <ToggleButton value="overlay">
            <Tooltip title="Overlay">
              <LayersIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="side-by-side">
            <Tooltip title="Side by Side">
              <TimelineIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="difference">
            <Tooltip title="Differences">
              <DifferenceIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="merged">
            <Tooltip title="Merged">
              <MergeIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        
        <Box sx={{ flexGrow: 1 }} />
        
        {enableAlignment && (
          <>
            <FormControlLabel
              control={
                <Switch
                  checked={alignTimelines}
                  onChange={(e) => setAlignTimelines(e.target.checked)}
                  size="small"
                />
              }
              label="Align"
            />
            
            {alignTimelines && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={currentAlignmentMode}
                  onChange={(e) => setCurrentAlignmentMode(e.target.value as any)}
                >
                  <MenuItem value="start">Start</MenuItem>
                  <MenuItem value="end">End</MenuItem>
                  <MenuItem value="milestone">Milestone</MenuItem>
                  <MenuItem value="average">Average</MenuItem>
                </Select>
              </FormControl>
            )}
          </>
        )}
      </Stack>
      
      {/* Dataset Selection for Difference Mode */}
      {comparisonMode === 'difference' && (
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Baseline</InputLabel>
            <Select
              value={selectedBaseline}
              onChange={(e) => setSelectedBaseline(e.target.value as number)}
              label="Baseline"
            >
              {datasets.map((d, i) => (
                <MenuItem key={d.id} value={i}>{d.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Typography sx={{ alignSelf: 'center' }}>vs</Typography>
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Comparison</InputLabel>
            <Select
              value={selectedComparison}
              onChange={(e) => setSelectedComparison(e.target.value as number)}
              label="Comparison"
            >
              {datasets.map((d, i) => (
                <MenuItem key={d.id} value={i} disabled={i === selectedBaseline}>
                  {d.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControlLabel
            control={
              <Switch
                checked={showDifferencesOnly}
                onChange={(e) => setShowDifferencesOnly(e.target.checked)}
                size="small"
              />
            }
            label="Differences Only"
          />
        </Stack>
      )}
      
      {/* Legend */}
      {showLegend && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap">
          {datasets.map((dataset, index) => (
            <Chip
              key={dataset.id}
              label={dataset.label}
              sx={{
                backgroundColor: alpha(dataset.color || theme.palette.primary.main, 0.2),
                borderColor: dataset.color || theme.palette.primary.main,
                borderWidth: 2,
                borderStyle: 'solid',
                opacity: dataset.visible === false ? 0.5 : 1
              }}
              onDelete={onDatasetToggle ? () => onDatasetToggle(dataset.id, !dataset.visible) : undefined}
              deleteIcon={dataset.visible === false ? <VisibilityOffIcon /> : <VisibilityIcon />}
            />
          ))}
        </Stack>
      )}
      
      {/* Metrics Panel */}
      {showMetrics && metrics && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Comparison Metrics
          </Typography>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            <Box>
              <Typography variant="caption" color="text.secondary">
                Task Count Δ
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {metrics.taskCountDifference > 0 ? '+' : ''}{metrics.taskCountDifference}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Avg Duration Δ
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {metrics.durationDifference > 0 ? '+' : ''}{Math.round(metrics.durationDifference)} days
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Completion Rate Δ
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {metrics.completionRateDifference > 0 ? '+' : ''}
                {metrics.completionRateDifference.toFixed(1)}%
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Modified Tasks
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {metrics.modifiedTasks.length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Added Tasks
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="success.main">
                +{metrics.addedTasks.length}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Removed Tasks
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="error.main">
                -{metrics.removedTasks.length}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      )}
      
      {/* Visualization */}
      <Box sx={{ position: 'relative' }}>
        {renderComparison()}
      </Box>
      
      {/* Opacity Controls for Overlay Mode */}
      {comparisonMode === 'overlay' && onOpacityChange && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Layer Opacity
          </Typography>
          {datasets.map((dataset, index) => (
            <Stack key={dataset.id} direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>
                {dataset.label}
              </Typography>
              <Slider
                value={dataset.opacity || 1}
                onChange={(e, value) => onOpacityChange(dataset.id, value as number)}
                min={0}
                max={1}
                step={0.1}
                valueLabelDisplay="auto"
                sx={{ flexGrow: 1 }}
              />
            </Stack>
          ))}
        </Box>
      )}
    </Paper>
  );
};