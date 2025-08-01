/**
 * ProgressiveDataLoader Component
 * Advanced component for progressive loading of large historical datasets
 * Features overview → details → full resolution loading with memory management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Divider
} from '@mui/material';
import {
  CloudDownload as DownloadIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Timeline as ProgressIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

import {
  ProgressiveDataLoaderProps,
  LoadingState,
  ProgressiveLoadingConfig
} from './types';

// Phase configuration for different loading phases
const PHASE_CONFIG: Record<LoadingState['phase'], {
  label: string;
  description: string;
  color: string;
  icon: React.ElementType;
}> = {
  idle: {
    label: 'Idle',
    description: 'Ready to load data',
    color: '#9e9e9e',
    icon: InfoIcon
  },
  overview: {
    label: 'Overview',
    description: 'Loading overview data for initial visualization',
    color: '#2196f3',
    icon: DownloadIcon
  },
  details: {
    label: 'Details',
    description: 'Loading detailed data for better resolution',
    color: '#ff9800',
    icon: ProgressIcon
  },
  'full-resolution': {
    label: 'Full Resolution',
    description: 'Loading complete high-resolution dataset',
    color: '#4caf50',
    icon: SpeedIcon
  },
  complete: {
    label: 'Complete',
    description: 'All data loaded successfully',
    color: '#4caf50',
    icon: SuccessIcon
  },
  error: {
    label: 'Error',
    description: 'An error occurred during loading',
    color: '#f44336',
    icon: ErrorIcon
  }
};

// Memory usage severity levels
const getMemoryUsageSeverity = (usage: number, threshold: number): {
  level: 'low' | 'medium' | 'high' | 'critical';
  color: string;
  message: string;
} => {
  const ratio = usage / threshold;
  
  if (ratio < 0.5) {
    return { level: 'low', color: '#4caf50', message: 'Memory usage is optimal' };
  } else if (ratio < 0.75) {
    return { level: 'medium', color: '#ff9800', message: 'Moderate memory usage' };
  } else if (ratio < 0.9) {
    return { level: 'high', color: '#f44336', message: 'High memory usage - consider reducing data resolution' };
  } else {
    return { level: 'critical', color: '#d32f2f', message: 'Critical memory usage - loading may be throttled' };
  }
};

export const ProgressiveDataLoader: React.FC<ProgressiveDataLoaderProps> = ({
  loadingStates,
  config,
  onConfigChange,
  onLoadingPhaseChange,
  showMemoryUsage = true,
  showPerformanceMetrics = true,
  compactView = false
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['status']));
  const [isPaused, setIsPaused] = useState(false);
  const [memoryUsage, setMemoryUsage] = useState(0);
  const [performanceStats, setPerformanceStats] = useState({
    loadSpeed: 0,
    totalDataPoints: 0,
    averageLoadTime: 0
  });

  // Calculate overall loading progress
  const overallProgress = useMemo(() => {
    const states = Object.values(loadingStates);
    if (states.length === 0) return 0;

    const totalProgress = states.reduce((sum, state) => sum + state.progress, 0);
    return totalProgress / states.length;
  }, [loadingStates]);

  // Get current loading phase
  const currentPhase = useMemo(() => {
    const states = Object.values(loadingStates);
    if (states.length === 0) return 'idle';

    // Priority order for phases
    const phaseOrder: LoadingState['phase'][] = ['error', 'full-resolution', 'details', 'overview', 'complete', 'idle'];
    
    for (const phase of phaseOrder) {
      if (states.some(state => state.phase === phase)) {
        return phase;
      }
    }
    
    return 'idle';
  }, [loadingStates]);

  // Calculate memory usage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate memory usage calculation
      const totalDataPoints = Object.values(loadingStates)
        .reduce((sum, state) => sum + state.dataPointsLoaded, 0);
      
      // Rough estimate: 64 bytes per data point
      const estimatedUsage = (totalDataPoints * 64) / (1024 * 1024); // MB
      setMemoryUsage(estimatedUsage);
      
      // Update performance stats
      setPerformanceStats(prev => ({
        ...prev,
        totalDataPoints,
        loadSpeed: totalDataPoints / Math.max(1, Date.now() - (Date.now() - 10000)) * 1000 // points/sec
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [loadingStates]);

  // Handle configuration changes
  const handleConfigChange = useCallback((updates: Partial<ProgressiveLoadingConfig>) => {
    onConfigChange({ ...config, ...updates });
  }, [config, onConfigChange]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Render loading progress for individual datasets
  const renderDatasetProgress = (datasetId: string, state: LoadingState) => {
    const phaseConfig = PHASE_CONFIG[state.phase];
    const IconComponent = phaseConfig.icon;
    
    return (
      <Card key={datasetId} sx={{ mb: 1 }}>
        <CardContent sx={{ py: compactView ? 1 : 2, '&:last-child': { pb: compactView ? 1 : 2 } }}>
          <Box display="flex" alignItems="center" justifyContent="between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <IconComponent sx={{ color: phaseConfig.color, fontSize: 16 }} />
              <Typography variant={compactView ? 'caption' : 'body2'} fontWeight={600}>
                {datasetId}
              </Typography>
              <Chip
                label={phaseConfig.label}
                size="small"
                sx={{
                  backgroundColor: `${phaseConfig.color}20`,
                  color: phaseConfig.color,
                  fontSize: '0.7rem',
                  height: 20
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {state.dataPointsLoaded.toLocaleString()} / {state.totalDataPoints.toLocaleString()}
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={state.progress}
            sx={{
              height: compactView ? 4 : 6,
              borderRadius: 3,
              backgroundColor: `${phaseConfig.color}20`,
              '& .MuiLinearProgress-bar': {
                backgroundColor: phaseConfig.color,
                borderRadius: 3
              }
            }}
          />

          {!compactView && (
            <Box display="flex" justifyContent="space-between" mt={1}>
              <Typography variant="caption" color="text.secondary">
                {phaseConfig.description}
              </Typography>
              {state.estimatedTimeRemaining && (
                <Typography variant="caption" color="text.secondary">
                  ETA: {Math.round(state.estimatedTimeRemaining / 1000)}s
                </Typography>
              )}
            </Box>
          )}

          {state.error && (
            <Alert severity="error" sx={{ mt: 1 }}>
              <Typography variant="caption">
                {state.error.message}
              </Typography>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render memory usage indicator
  const renderMemoryUsage = () => {
    if (!showMemoryUsage) return null;

    const severity = getMemoryUsageSeverity(memoryUsage, config.memoryThreshold);
    
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <MemoryIcon sx={{ color: severity.color, fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Memory Usage
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight={600} color={severity.color}>
              {memoryUsage.toFixed(1)} MB / {config.memoryThreshold} MB
            </Typography>
          </Box>

          <LinearProgress
            variant="determinate"
            value={(memoryUsage / config.memoryThreshold) * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: `${severity.color}20`,
              '& .MuiLinearProgress-bar': {
                backgroundColor: severity.color,
                borderRadius: 3
              }
            }}
          />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {severity.message}
          </Typography>
        </CardContent>
      </Card>
    );
  };

  // Render performance metrics
  const renderPerformanceMetrics = () => {
    if (!showPerformanceMetrics) return null;

    return (
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
              <SpeedIcon sx={{ color: '#2196f3', fontSize: 24, mb: 0.5 }} />
              <Typography variant="h6" fontWeight={600}>
                {performanceStats.loadSpeed.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                points/sec
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
              <ProgressIcon sx={{ color: '#4caf50', fontSize: 24, mb: 0.5 }} />
              <Typography variant="h6" fontWeight={600}>
                {performanceStats.totalDataPoints.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                data points
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={4}>
          <Card>
            <CardContent sx={{ py: 1.5, textAlign: 'center' }}>
              <DownloadIcon sx={{ color: '#ff9800', fontSize: 24, mb: 0.5 }} />
              <Typography variant="h6" fontweight={600}>
                {Math.round(overallProgress)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                complete
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  // Render loading controls
  const renderLoadingControls = () => (
    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={2}>
      <Tooltip title={isPaused ? 'Resume loading' : 'Pause loading'}>
        <IconButton
          onClick={() => {
            setIsPaused(!isPaused);
            onLoadingPhaseChange(isPaused ? 'overview' : 'idle');
          }}
          color="primary"
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Stop loading">
        <IconButton
          onClick={() => onLoadingPhaseChange('idle')}
          color="error"
        >
          <StopIcon />
        </IconButton>
      </Tooltip>
      
      <Tooltip title="Restart loading">
        <IconButton
          onClick={() => onLoadingPhaseChange('overview')}
          color="success"
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );

  // Render configuration panel
  const renderConfigurationPanel = () => (
    <Accordion
      expanded={expandedSections.has('config')}
      onChange={() => toggleSection('config')}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box display="flex" alignItems="center" gap={1}>
          <SettingsIcon sx={{ fontSize: 20 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Loading Configuration
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableProgressive}
                  onChange={(e) => handleConfigChange({ enableProgressive: e.target.checked })}
                />
              }
              label="Enable Progressive Loading"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Chunk Size: {config.chunkSize.toLocaleString()}
            </Typography>
            <Slider
              value={config.chunkSize}
              onChange={(_, value) => handleConfigChange({ chunkSize: value as number })}
              min={1000}
              max={50000}
              step={1000}
              marks={[
                { value: 1000, label: '1K' },
                { value: 25000, label: '25K' },
                { value: 50000, label: '50K' }
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${(value / 1000).toFixed(0)}K`}
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="subtitle2" gutterBottom>
              Memory Threshold: {config.memoryThreshold} MB
            </Typography>
            <Slider
              value={config.memoryThreshold}
              onChange={(_, value) => handleConfigChange({ memoryThreshold: value as number })}
              min={50}
              max={1000}
              step={50}
              marks={[
                { value: 50, label: '50MB' },
                { value: 500, label: '500MB' },
                { value: 1000, label: '1GB' }
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}MB`}
            />
          </Grid>
          
          <Grid item xs={6}>
            <Typography variant="subtitle2" gutterBottom>
              Max Concurrent Requests
            </Typography>
            <Slider
              value={config.maxConcurrentRequests}
              onChange={(_, value) => handleConfigChange({ maxConcurrentRequests: value as number })}
              min={1}
              max={10}
              step={1}
              marks
              valueLabelDisplay="auto"
            />
          </Grid>
          
          <Grid item xs={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.adaptiveLoading}
                  onChange={(e) => handleConfigChange({ adaptiveLoading: e.target.checked })}
                />
              }
              label="Adaptive Loading"
            />
          </Grid>
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Paper sx={{ p: compactView ? 1 : 2 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant={compactView ? 'subtitle1' : 'h6'} fontWeight={600}>
          Progressive Data Loader
        </Typography>
        <Chip
          label={PHASE_CONFIG[currentPhase].label}
          color={currentPhase === 'error' ? 'error' : currentPhase === 'complete' ? 'success' : 'primary'}
          size="small"
        />
      </Box>

      {/* Overall progress */}
      {!compactView && (
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              Overall Progress
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {Math.round(overallProgress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: `${PHASE_CONFIG[currentPhase].color}20`,
              '& .MuiLinearProgress-bar': {
                backgroundColor: PHASE_CONFIG[currentPhase].color,
                borderRadius: 4
              }
            }}
          />
        </Box>
      )}

      {/* Loading controls */}
      {renderLoadingControls()}

      {/* Memory usage */}
      {renderMemoryUsage()}

      {/* Performance metrics */}
      {renderPerformanceMetrics()}

      {/* Individual dataset progress */}
      <Accordion
        expanded={expandedSections.has('status')}
        onChange={() => toggleSection('status')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight={600}>
            Dataset Loading Status ({Object.keys(loadingStates).length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {Object.entries(loadingStates).map(([datasetId, state]) =>
            renderDatasetProgress(datasetId, state)
          )}
        </AccordionDetails>
      </Accordion>

      {/* Configuration */}
      {renderConfigurationPanel()}

      {/* Memory warning */}
      {memoryUsage > config.memoryThreshold * 0.8 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            High memory usage detected. Consider reducing data resolution or clearing cache.
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};

// Compact version for sidebar or small spaces
export const CompactProgressiveDataLoader: React.FC<ProgressiveDataLoaderProps> = (props) => (
  <ProgressiveDataLoader {...props} compactView showMemoryUsage={false} showPerformanceMetrics={false} />
);

export default ProgressiveDataLoader;