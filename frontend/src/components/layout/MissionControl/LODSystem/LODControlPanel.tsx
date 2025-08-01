/**
 * LODControlPanel Component
 * 
 * User interface for controlling LOD settings and viewing performance metrics.
 * Provides real-time control over quality settings and optimization parameters.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  IconButton,
  Tooltip,
  Alert,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Visibility as VisibilityIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useLOD, LODLevel } from './LODManager';
import { PerformanceDashboard, PerformanceBenchmark, PerformanceTestResult } from './PerformanceProfiler';
import { GeometryOptimizer, MeshOptimizationResult } from './GeometryOptimizer';

interface LODControlPanelProps {
  onClose?: () => void;
  showBenchmarks?: boolean;
  showAnalytics?: boolean;
}

/**
 * Main LOD Control Panel Component
 */
export function LODControlPanel({
  onClose,
  showBenchmarks = true,
  showAnalytics = true
}: LODControlPanelProps) {
  const lod = useLOD();
  const [activeTab, setActiveTab] = useState<'settings' | 'performance' | 'optimization'>('settings');
  const [benchmarkRunning, setBenchmarkRunning] = useState(false);
  const [benchmarkResults, setBenchmarkResults] = useState<PerformanceTestResult[]>([]);
  const [optimizationStats, setOptimizationStats] = useState<MeshOptimizationResult[]>([]);
  
  const geometryOptimizer = React.useRef(new GeometryOptimizer());
  const performanceBenchmark = React.useRef(new PerformanceBenchmark());
  
  // Quality preset options
  const qualityPresets = [
    { value: 'ultra', label: 'Ultra', description: 'Maximum quality, no compromises' },
    { value: 'high', label: 'High', description: 'High quality with minor optimizations' },
    { value: 'medium', label: 'Medium', description: 'Balanced quality and performance' },
    { value: 'low', label: 'Low', description: 'Performance focused, reduced quality' },
    { value: 'adaptive', label: 'Adaptive', description: 'Automatically adjust based on performance' }
  ];
  
  // Component LOD labels
  const lodLevelLabels = ['Ultra', 'High', 'Medium', 'Low', 'Minimal'];
  
  // Handle quality preset change
  const handlePresetChange = (preset: string) => {
    lod.setQualityPreset(preset as any);
  };
  
  // Handle component LOD change
  const handleComponentLODChange = (component: string, level: number) => {
    lod.setComponentLOD(component as any, level as LODLevel);
  };
  
  // Run performance benchmark
  const runBenchmark = async () => {
    setBenchmarkRunning(true);
    try {
      // This would integrate with the actual profiler hook
      // const results = await performanceBenchmark.current.runAllScenarios(profiler);
      // setBenchmarkResults(results);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setBenchmarkRunning(false);
    }
  };
  
  // Calculate performance score
  const calculatePerformanceScore = (): number => {
    const metrics = lod.metrics;
    const targets = lod.targets;
    
    const fpsScore = Math.min(100, (metrics.fps / targets.targetFPS) * 100);
    const memoryScore = Math.max(0, 100 - (metrics.memoryUsage.totalMB / targets.maxMemoryMB) * 100);
    const drawCallScore = Math.max(0, 100 - (metrics.render.calls / targets.maxDrawCalls) * 100);
    
    return Math.round((fpsScore + memoryScore + drawCallScore) / 3);
  };
  
  const performanceScore = calculatePerformanceScore();
  const performanceColor = performanceScore > 80 ? '#4caf50' : performanceScore > 50 ? '#ff9800' : '#f44336';
  
  return (
    <Card sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            LOD Optimization Control
          </Typography>
          {onClose && (
            <IconButton onClick={onClose} size="small">
              <SettingsIcon />
            </IconButton>
          )}
        </Box>
        
        {/* Performance Score Overview */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Overall Performance Score
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={performanceScore}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: performanceColor
                  }
                }}
              />
            </Box>
            <Typography variant="h6" sx={{ color: performanceColor }}>
              {performanceScore}%
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              icon={<SpeedIcon />}
              label={`${lod.metrics.fps} FPS`}
              size="small"
              color={lod.metrics.fps >= lod.targets.targetFPS ? 'success' : 'warning'}
            />
            <Chip
              icon={<MemoryIcon />}
              label={`${lod.metrics.memoryUsage.totalMB.toFixed(0)} MB`}
              size="small"
              color={lod.metrics.memoryUsage.totalMB <= lod.targets.maxMemoryMB ? 'success' : 'warning'}
            />
            <Chip
              icon={<VisibilityIcon />}
              label={`${lod.metrics.render.calls} Draw Calls`}
              size="small"
              color={lod.metrics.render.calls <= lod.targets.maxDrawCalls ? 'success' : 'warning'}
            />
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Tab Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant={activeTab === 'settings' ? 'contained' : 'text'}
              onClick={() => setActiveTab('settings')}
              startIcon={<SettingsIcon />}
            >
              Settings
            </Button>
            <Button
              variant={activeTab === 'performance' ? 'contained' : 'text'}
              onClick={() => setActiveTab('performance')}
              startIcon={<TimelineIcon />}
            >
              Performance
            </Button>
            <Button
              variant={activeTab === 'optimization' ? 'contained' : 'text'}
              onClick={() => setActiveTab('optimization')}
              startIcon={<AssessmentIcon />}
            >
              Optimization
            </Button>
          </Box>
        </Box>
        
        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <Box>
            {/* Quality Preset */}
            <Box sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Quality Preset</InputLabel>
                <Select
                  value={lod.config.models.level === LODLevel.ULTRA ? 'ultra' : 
                         lod.config.models.level === LODLevel.HIGH ? 'high' :
                         lod.config.models.level === LODLevel.MEDIUM ? 'medium' :
                         lod.config.models.level === LODLevel.LOW ? 'low' : 'adaptive'}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  label="Quality Preset"
                >
                  {qualityPresets.map(preset => (
                    <MenuItem key={preset.value} value={preset.value}>
                      <Box>
                        <Typography>{preset.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {preset.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            {/* Component-specific LOD Controls */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Component LOD Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {/* Models LOD */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>3D Models</Typography>
                    <Slider
                      value={lod.config.models.level}
                      onChange={(_, value) => handleComponentLODChange('models', value as number)}
                      min={0}
                      max={4}
                      marks={lodLevelLabels.map((label, index) => ({ value: index, label }))}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => lodLevelLabels[value]}
                    />
                  </Grid>
                  
                  {/* Physics LOD */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>Physics Simulation</Typography>
                    <Slider
                      value={lod.config.physics.level}
                      onChange={(_, value) => handleComponentLODChange('physics', value as number)}
                      min={0}
                      max={4}
                      marks={lodLevelLabels.map((label, index) => ({ value: index, label }))}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => lodLevelLabels[value]}
                    />
                  </Grid>
                  
                  {/* Animations LOD */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>Animations</Typography>
                    <Slider
                      value={lod.config.animations.level}
                      onChange={(_, value) => handleComponentLODChange('animations', value as number)}
                      min={0}
                      max={4}
                      marks={lodLevelLabels.map((label, index) => ({ value: index, label }))}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => lodLevelLabels[value]}
                    />
                  </Grid>
                  
                  {/* Effects LOD */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>Visual Effects</Typography>
                    <Slider
                      value={lod.config.effects.level}
                      onChange={(_, value) => handleComponentLODChange('effects', value as number)}
                      min={0}
                      max={4}
                      marks={lodLevelLabels.map((label, index) => ({ value: index, label }))}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => lodLevelLabels[value]}
                    />
                  </Grid>
                  
                  {/* Terrain LOD */}
                  <Grid item xs={12}>
                    <Typography gutterBottom>Terrain</Typography>
                    <Slider
                      value={lod.config.terrain.level}
                      onChange={(_, value) => handleComponentLODChange('terrain', value as number)}
                      min={0}
                      max={4}
                      marks={lodLevelLabels.map((label, index) => ({ value: index, label }))}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => lodLevelLabels[value]}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
            
            {/* Performance Targets */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Performance Targets</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption">Target FPS</Typography>
                    <Typography variant="h6">{lod.targets.targetFPS}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption">Min FPS</Typography>
                    <Typography variant="h6">{lod.targets.minFPS}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption">Max Memory (MB)</Typography>
                    <Typography variant="h6">{lod.targets.maxMemoryMB}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption">Max Draw Calls</Typography>
                    <Typography variant="h6">{lod.targets.maxDrawCalls}</Typography>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
        
        {/* Performance Tab */}
        {activeTab === 'performance' && showAnalytics && (
          <Box>
            <PerformanceDashboard 
              profiles={[]} // Would be connected to actual profile data
              testResults={benchmarkResults}
            />
          </Box>
        )}
        
        {/* Optimization Tab */}
        {activeTab === 'optimization' && (
          <Box>
            {/* Current Optimization Status */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Current Optimizations</Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2">
                  • {lod.metrics.objectCounts.culled} objects culled
                </Typography>
                <Typography variant="body2">
                  • {lod.metrics.objectCounts.instanced} instanced objects
                </Typography>
                <Typography variant="body2">
                  • Adaptive quality: {lod.metrics.adaptiveMetrics.adjustmentCount} adjustments
                </Typography>
              </Box>
            </Alert>
            
            {/* Optimization Controls */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Frustum Culling"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Occlusion Culling"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Automatic Instancing"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Texture Atlasing"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch defaultChecked />}
                  label="Geometry Merging"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={<Switch />}
                  label="GPU Compute"
                />
              </Grid>
            </Grid>
            
            {/* Benchmark Controls */}
            {showBenchmarks && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Performance Benchmarks
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={benchmarkRunning ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={runBenchmark}
                    disabled={benchmarkRunning}
                  >
                    {benchmarkRunning ? 'Running...' : 'Run Benchmarks'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => setBenchmarkResults([])}
                    disabled={benchmarkRunning}
                  >
                    Clear Results
                  </Button>
                </Box>
                
                {benchmarkResults.length > 0 && (
                  <Box>
                    {benchmarkResults.map((result, index) => (
                      <Alert
                        key={index}
                        severity={result.passed ? 'success' : 'error'}
                        sx={{ mb: 1 }}
                      >
                        <Typography variant="subtitle2">{result.scenario}</Typography>
                        <Typography variant="body2">
                          Avg FPS: {result.averageFPS.toFixed(1)} | 
                          Min FPS: {result.minFPS.toFixed(1)} | 
                          Memory: {result.memoryPeak.toFixed(0)}MB
                        </Typography>
                      </Alert>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Floating LOD indicator widget
 */
export function LODIndicator() {
  const lod = useLOD();
  const [expanded, setExpanded] = useState(false);
  
  const performanceColor = lod.metrics.fps >= lod.targets.targetFPS ? '#4caf50' : 
                           lod.metrics.fps >= lod.targets.minFPS ? '#ff9800' : '#f44336';
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 1,
        padding: 1,
        minWidth: expanded ? 200 : 120,
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: performanceColor
          }}
        />
        <Typography variant="caption" sx={{ color: 'white' }}>
          {lod.metrics.fps} FPS
        </Typography>
        {expanded && (
          <Typography variant="caption" sx={{ color: 'white' }}>
            | LOD: {['U', 'H', 'M', 'L', 'X'][lod.config.models.level]}
          </Typography>
        )}
      </Box>
      
      {expanded && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            Draw Calls: {lod.metrics.render.calls}
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            Triangles: {(lod.metrics.render.triangles / 1000).toFixed(1)}k
          </Typography>
          <Typography variant="caption" sx={{ color: 'white', display: 'block' }}>
            Memory: {lod.metrics.memoryUsage.totalMB.toFixed(0)}MB
          </Typography>
          {lod.metrics.bottleneck !== 'none' && (
            <Typography variant="caption" sx={{ color: '#ff9800', display: 'block', mt: 0.5 }}>
              Bottleneck: {lod.metrics.bottleneck}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

export default LODControlPanel;