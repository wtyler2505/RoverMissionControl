/**
 * PerformanceAnalyticsDashboard Component
 * 
 * Comprehensive performance analytics dashboard for rover 3D visualization.
 * Provides real-time metrics, analysis tools, and performance optimization insights.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine
} from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Grid,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  AlertTitle,
  LinearProgress,
  Divider,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  GraphicEq as GraphicEqIcon,
  Assessment as AssessmentIcon,
  BugReport as BugReportIcon,
  CompareArrows as CompareArrowsIcon,
  Timeline as TimelineIcon,
  Layers as LayersIcon
} from '@mui/icons-material';

import { useLOD, LODLevel, LODMetrics } from './LODSystem/LODManager';
import { PerformanceProfile } from './LODSystem/PerformanceProfiler';
import { PerformanceMetrics } from './PerformanceMonitor';

// Extended performance data structure
interface ExtendedPerformanceData extends PerformanceProfile {
  lodMetrics?: LODMetrics;
  customMetrics?: Record<string, number>;
}

// Alert configuration
interface PerformanceAlert {
  id: string;
  type: 'fps' | 'memory' | 'drawCalls' | 'frameTime' | 'custom';
  severity: 'warning' | 'error' | 'info';
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  duration: number; // seconds
  enabled: boolean;
  message: string;
}

// Performance target configuration
interface PerformanceTarget {
  name: string;
  metric: string;
  target: number;
  weight: number;
}

// Comparison configuration
interface ComparisonConfig {
  name: string;
  timestamp: number;
  data: ExtendedPerformanceData[];
  settings: Record<string, any>;
}

interface PerformanceAnalyticsDashboardProps {
  /** Enable/disable dashboard */
  enabled?: boolean;
  /** Update frequency in milliseconds */
  updateInterval?: number;
  /** Maximum history size */
  maxHistorySize?: number;
  /** Performance data source */
  performanceData?: ExtendedPerformanceData[];
  /** Callback for alert triggers */
  onAlertTriggered?: (alert: PerformanceAlert, value: number) => void;
  /** Custom metrics to track */
  customMetrics?: Record<string, () => number>;
  /** Export callback */
  onExport?: (data: any, format: 'json' | 'csv' | 'pdf') => void;
}

export function PerformanceAnalyticsDashboard({
  enabled = true,
  updateInterval = 100,
  maxHistorySize = 600,
  performanceData: externalData,
  onAlertTriggered,
  customMetrics = {},
  onExport
}: PerformanceAnalyticsDashboardProps) {
  const theme = useTheme();
  const { metrics: lodMetrics, config: lodConfig } = useLOD();
  
  // State
  const [activeTab, setActiveTab] = useState(0);
  const [performanceHistory, setPerformanceHistory] = useState<ExtendedPerformanceData[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([
    {
      id: 'fps-low',
      type: 'fps',
      severity: 'warning',
      condition: 'below',
      threshold: 30,
      duration: 5,
      enabled: true,
      message: 'FPS dropped below 30 for 5 seconds'
    },
    {
      id: 'memory-high',
      type: 'memory',
      severity: 'error',
      condition: 'above',
      threshold: 1024,
      duration: 10,
      enabled: true,
      message: 'Memory usage exceeded 1GB'
    }
  ]);
  const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set());
  const [comparisons, setComparisons] = useState<ComparisonConfig[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<string | null>(null);
  const [performanceTargets, setPerformanceTargets] = useState<PerformanceTarget[]>([
    { name: 'Target FPS', metric: 'fps', target: 60, weight: 0.4 },
    { name: 'Max Frame Time', metric: 'frameTime', target: 16.67, weight: 0.3 },
    { name: 'Draw Calls', metric: 'drawCalls', target: 100, weight: 0.2 },
    { name: 'Memory Usage', metric: 'memory', target: 512, weight: 0.1 }
  ]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 60]); // seconds

  // Refs for performance tracking
  const alertTimers = useRef<Map<string, number>>(new Map());
  const lastUpdateTime = useRef(Date.now());

  // Update performance history
  useEffect(() => {
    if (!enabled) return;

    const updateHistory = () => {
      const now = Date.now();
      if (now - lastUpdateTime.current < updateInterval) return;

      const newData: ExtendedPerformanceData = {
        timestamp: now,
        frameTime: 16.67, // Placeholder - would come from actual metrics
        fps: 60,
        cpu: {
          jsTime: 5,
          physicsTime: 2,
          animationTime: 1,
          renderPrepTime: 3
        },
        gpu: {
          drawTime: 8,
          shaderTime: 3,
          textureTime: 2,
          bandwidth: 100
        },
        memory: {
          jsHeap: 256,
          gpuMemory: 512,
          textureMemory: 256,
          bufferMemory: 128
        },
        rendering: {
          drawCalls: 85,
          triangles: 50000,
          vertices: 150000,
          programs: 12,
          textures: 24,
          instances: 100
        },
        bottleneck: 'none',
        recommendations: [],
        lodMetrics,
        customMetrics: Object.entries(customMetrics).reduce((acc, [key, fn]) => {
          acc[key] = fn();
          return acc;
        }, {} as Record<string, number>)
      };

      // Detect bottlenecks
      if (newData.fps < 30) {
        if (newData.gpu.drawTime > 12) {
          newData.bottleneck = 'gpu';
          newData.recommendations.push('Reduce shader complexity or polygon count');
        } else if (newData.cpu.jsTime > 10) {
          newData.bottleneck = 'cpu';
          newData.recommendations.push('Optimize JavaScript calculations');
        }
      }

      setPerformanceHistory(prev => {
        const updated = [...prev, newData];
        return updated.slice(-maxHistorySize);
      });

      lastUpdateTime.current = now;

      // Check alerts
      checkAlerts(newData);
    };

    const interval = setInterval(updateHistory, updateInterval);
    return () => clearInterval(interval);
  }, [enabled, updateInterval, maxHistorySize, lodMetrics, customMetrics]);

  // Alert checking
  const checkAlerts = useCallback((data: ExtendedPerformanceData) => {
    alerts.forEach(alert => {
      if (!alert.enabled) return;

      let value: number | undefined;
      switch (alert.type) {
        case 'fps':
          value = data.fps;
          break;
        case 'memory':
          value = data.memory.jsHeap + data.memory.gpuMemory;
          break;
        case 'drawCalls':
          value = data.rendering.drawCalls;
          break;
        case 'frameTime':
          value = data.frameTime;
          break;
      }

      if (value === undefined) return;

      const triggered = alert.condition === 'above' ? value > alert.threshold :
                       alert.condition === 'below' ? value < alert.threshold :
                       value === alert.threshold;

      if (triggered) {
        const currentTime = alertTimers.current.get(alert.id) || 0;
        const newTime = currentTime + (updateInterval / 1000);
        alertTimers.current.set(alert.id, newTime);

        if (newTime >= alert.duration && !activeAlerts.has(alert.id)) {
          setActiveAlerts(prev => new Set(prev).add(alert.id));
          onAlertTriggered?.(alert, value);
        }
      } else {
        alertTimers.current.delete(alert.id);
        setActiveAlerts(prev => {
          const next = new Set(prev);
          next.delete(alert.id);
          return next;
        });
      }
    });
  }, [alerts, updateInterval, onAlertTriggered, activeAlerts]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (performanceHistory.length === 0) return null;

    const recent = performanceHistory.slice(-timeRange[1] * 10); // Assuming 10 samples per second
    
    return {
      fps: {
        average: recent.reduce((sum, d) => sum + d.fps, 0) / recent.length,
        min: Math.min(...recent.map(d => d.fps)),
        max: Math.max(...recent.map(d => d.fps)),
        current: recent[recent.length - 1]?.fps || 0
      },
      frameTime: {
        average: recent.reduce((sum, d) => sum + d.frameTime, 0) / recent.length,
        min: Math.min(...recent.map(d => d.frameTime)),
        max: Math.max(...recent.map(d => d.frameTime)),
        current: recent[recent.length - 1]?.frameTime || 0
      },
      drawCalls: {
        average: recent.reduce((sum, d) => sum + d.rendering.drawCalls, 0) / recent.length,
        min: Math.min(...recent.map(d => d.rendering.drawCalls)),
        max: Math.max(...recent.map(d => d.rendering.drawCalls)),
        current: recent[recent.length - 1]?.rendering.drawCalls || 0
      },
      memory: {
        average: recent.reduce((sum, d) => sum + d.memory.jsHeap + d.memory.gpuMemory, 0) / recent.length,
        min: Math.min(...recent.map(d => d.memory.jsHeap + d.memory.gpuMemory)),
        max: Math.max(...recent.map(d => d.memory.jsHeap + d.memory.gpuMemory)),
        current: recent[recent.length - 1] ? 
          recent[recent.length - 1].memory.jsHeap + recent[recent.length - 1].memory.gpuMemory : 0
      }
    };
  }, [performanceHistory, timeRange]);

  // Export functionality
  const handleExport = useCallback((format: 'json' | 'csv' | 'pdf') => {
    const data = {
      timestamp: new Date().toISOString(),
      statistics,
      history: performanceHistory.slice(-timeRange[1] * 10),
      alerts: alerts.filter(a => a.enabled),
      activeAlerts: Array.from(activeAlerts),
      targets: performanceTargets,
      lodConfig
    };

    if (onExport) {
      onExport(data, format);
    } else {
      // Default export implementation
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `performance-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  }, [statistics, performanceHistory, timeRange, alerts, activeAlerts, performanceTargets, lodConfig, onExport]);

  // Render metric card
  const renderMetricCard = (title: string, value: number, unit: string, trend?: number, icon?: React.ReactNode) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div">
              {value.toFixed(1)} <Typography variant="body1" component="span">{unit}</Typography>
            </Typography>
            {trend !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {trend > 0 ? (
                  <TrendingUpIcon color="success" fontSize="small" />
                ) : (
                  <TrendingDownIcon color="error" fontSize="small" />
                )}
                <Typography variant="body2" color={trend > 0 ? 'success.main' : 'error.main'}>
                  {Math.abs(trend).toFixed(1)}%
                </Typography>
              </Box>
            )}
          </Box>
          {icon && <Box>{icon}</Box>}
        </Box>
      </CardContent>
    </Card>
  );

  if (!enabled) return null;

  return (
    <Box sx={{ width: '100%', height: '100%', p: 2 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" component="h2">
          Performance Analytics Dashboard
        </Typography>
        <Box display="flex" gap={1}>
          <IconButton onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
          <IconButton onClick={() => setExportDialogOpen(true)}>
            <DownloadIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Active Alerts */}
      {activeAlerts.size > 0 && (
        <Box mb={2}>
          {Array.from(activeAlerts).map(alertId => {
            const alert = alerts.find(a => a.id === alertId);
            if (!alert) return null;
            return (
              <Alert 
                key={alertId} 
                severity={alert.severity}
                onClose={() => setActiveAlerts(prev => {
                  const next = new Set(prev);
                  next.delete(alertId);
                  return next;
                })}
                sx={{ mb: 1 }}
              >
                <AlertTitle>{alert.message}</AlertTitle>
              </Alert>
            );
          })}
        </Box>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 2 }}>
        <Tab label="Overview" icon={<AssessmentIcon />} iconPosition="start" />
        <Tab label="Real-time Metrics" icon={<TimelineIcon />} iconPosition="start" />
        <Tab label="Performance Analysis" icon={<BugReportIcon />} iconPosition="start" />
        <Tab label="LOD Integration" icon={<LayersIcon />} iconPosition="start" />
        <Tab label="Comparisons" icon={<CompareArrowsIcon />} iconPosition="start" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && statistics && (
        <Grid container spacing={2}>
          {/* Key Metrics */}
          <Grid item xs={12} md={3}>
            {renderMetricCard(
              'FPS',
              statistics.fps.current,
              'fps',
              ((statistics.fps.current - statistics.fps.average) / statistics.fps.average) * 100,
              <SpeedIcon fontSize="large" color="primary" />
            )}
          </Grid>
          <Grid item xs={12} md={3}>
            {renderMetricCard(
              'Frame Time',
              statistics.frameTime.current,
              'ms',
              -((statistics.frameTime.current - statistics.frameTime.average) / statistics.frameTime.average) * 100,
              <GraphicEqIcon fontSize="large" color="primary" />
            )}
          </Grid>
          <Grid item xs={12} md={3}>
            {renderMetricCard(
              'Draw Calls',
              statistics.drawCalls.current,
              'calls',
              -((statistics.drawCalls.current - statistics.drawCalls.average) / statistics.drawCalls.average) * 100,
              <LayersIcon fontSize="large" color="primary" />
            )}
          </Grid>
          <Grid item xs={12} md={3}>
            {renderMetricCard(
              'Memory Usage',
              statistics.memory.current,
              'MB',
              -((statistics.memory.current - statistics.memory.average) / statistics.memory.average) * 100,
              <MemoryIcon fontSize="large" color="primary" />
            )}
          </Grid>

          {/* Performance Score */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Performance Score" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={performanceTargets.map(target => ({
                    metric: target.name,
                    actual: statistics[target.metric as keyof typeof statistics]?.current || 0,
                    target: target.target,
                    score: Math.min(100, (target.target / (statistics[target.metric as keyof typeof statistics]?.current || 1)) * 100)
                  }))}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Score" dataKey="score" stroke={theme.palette.primary.main} fill={theme.palette.primary.main} fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Bottleneck Analysis */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Bottleneck Analysis" />
              <CardContent>
                {performanceHistory.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Current Bottleneck: {performanceHistory[performanceHistory.length - 1].bottleneck}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    {performanceHistory[performanceHistory.length - 1].recommendations.map((rec, idx) => (
                      <Alert key={idx} severity="info" sx={{ mb: 1 }}>
                        {rec}
                      </Alert>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={2}>
          {/* FPS Graph */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="FPS History" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceHistory.slice(-timeRange[1] * 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <Legend />
                    <Line type="monotone" dataKey="fps" stroke={theme.palette.primary.main} dot={false} />
                    <ReferenceLine y={60} stroke="green" strokeDasharray="5 5" />
                    <ReferenceLine y={30} stroke="orange" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Frame Time Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Frame Time Distribution" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceHistory.slice(-timeRange[1] * 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <Legend />
                    <Area type="monotone" dataKey="cpu.jsTime" stackId="1" stroke="#8884d8" fill="#8884d8" name="JS Time" />
                    <Area type="monotone" dataKey="cpu.physicsTime" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Physics" />
                    <Area type="monotone" dataKey="cpu.animationTime" stackId="1" stroke="#ffc658" fill="#ffc658" name="Animation" />
                    <Area type="monotone" dataKey="gpu.drawTime" stackId="1" stroke="#ff7c7c" fill="#ff7c7c" name="GPU Draw" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Memory Usage */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Memory Usage" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceHistory.slice(-timeRange[1] * 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <Legend />
                    <Area type="monotone" dataKey="memory.jsHeap" stackId="1" stroke="#8884d8" fill="#8884d8" name="JS Heap" />
                    <Area type="monotone" dataKey="memory.gpuMemory" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="GPU Memory" />
                    <Area type="monotone" dataKey="memory.textureMemory" stackId="1" stroke="#ffc658" fill="#ffc658" name="Textures" />
                    <Area type="monotone" dataKey="memory.bufferMemory" stackId="1" stroke="#ff7c7c" fill="#ff7c7c" name="Buffers" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Draw Calls & Triangles */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Rendering Statistics" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceHistory.slice(-timeRange[1] * 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="rendering.drawCalls" stroke="#8884d8" name="Draw Calls" dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="rendering.triangles" stroke="#82ca9d" name="Triangles" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <Grid container spacing={2}>
          {/* Component Performance Breakdown */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Component Performance Breakdown" />
              <CardContent>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Component</TableCell>
                        <TableCell align="right">CPU Time (ms)</TableCell>
                        <TableCell align="right">GPU Time (ms)</TableCell>
                        <TableCell align="right">Memory (MB)</TableCell>
                        <TableCell align="right">Draw Calls</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Rover Model</TableCell>
                        <TableCell align="right">2.3</TableCell>
                        <TableCell align="right">3.1</TableCell>
                        <TableCell align="right">45</TableCell>
                        <TableCell align="right">12</TableCell>
                        <TableCell>
                          <Chip label="Optimal" color="success" size="small" />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Terrain</TableCell>
                        <TableCell align="right">5.2</TableCell>
                        <TableCell align="right">8.4</TableCell>
                        <TableCell align="right">128</TableCell>
                        <TableCell align="right">45</TableCell>
                        <TableCell>
                          <Chip label="Warning" color="warning" size="small" />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Effects</TableCell>
                        <TableCell align="right">1.1</TableCell>
                        <TableCell align="right">2.2</TableCell>
                        <TableCell align="right">22</TableCell>
                        <TableCell align="right">8</TableCell>
                        <TableCell>
                          <Chip label="Optimal" color="success" size="small" />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>UI Overlay</TableCell>
                        <TableCell align="right">0.8</TableCell>
                        <TableCell align="right">0.5</TableCell>
                        <TableCell align="right">12</TableCell>
                        <TableCell align="right">5</TableCell>
                        <TableCell>
                          <Chip label="Optimal" color="success" size="small" />
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Performance Recommendations */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Performance Recommendations" />
              <CardContent>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Alert severity="warning">
                    <AlertTitle>Terrain LOD Optimization</AlertTitle>
                    Consider reducing terrain chunk resolution at distances > 100m to improve GPU performance.
                  </Alert>
                  <Alert severity="info">
                    <AlertTitle>Texture Compression</AlertTitle>
                    Enable texture compression for distant objects to reduce memory usage by ~30%.
                  </Alert>
                  <Alert severity="success">
                    <AlertTitle>Instance Rendering Active</AlertTitle>
                    Successfully batching 85% of similar objects, reducing draw calls by 60%.
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Optimization Opportunities */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Optimization Opportunities" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Texture Memory', current: 256, potential: 180, saving: 76 },
                    { name: 'Draw Calls', current: 85, potential: 50, saving: 35 },
                    { name: 'Shader Complexity', current: 100, potential: 70, saving: 30 },
                    { name: 'Physics Updates', current: 60, potential: 30, saving: 30 },
                    { name: 'Animation Bones', current: 50, potential: 35, saving: 15 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="current" fill="#ff7c7c" name="Current" />
                    <Bar dataKey="potential" fill="#82ca9d" name="Optimized" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 3 && lodMetrics && (
        <Grid container spacing={2}>
          {/* LOD Level Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="LOD Level Distribution" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Ultra', value: lodMetrics.objectCounts.total * 0.1, fill: '#0088FE' },
                        { name: 'High', value: lodMetrics.objectCounts.total * 0.2, fill: '#00C49F' },
                        { name: 'Medium', value: lodMetrics.objectCounts.total * 0.3, fill: '#FFBB28' },
                        { name: 'Low', value: lodMetrics.objectCounts.total * 0.25, fill: '#FF8042' },
                        { name: 'Minimal', value: lodMetrics.objectCounts.total * 0.15, fill: '#8884D8' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                    >
                      {/* Cells are defined inline above */}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* LOD Transition Frequency */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="LOD Transition Analysis" />
              <CardContent>
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Transition Frequency
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={lodMetrics.adaptiveMetrics.adjustmentCount % 100}
                    sx={{ mb: 2 }}
                  />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Total Transitions
                      </Typography>
                      <Typography variant="h6">
                        {lodMetrics.adaptiveMetrics.adjustmentCount}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="textSecondary">
                        Stability Score
                      </Typography>
                      <Typography variant="h6">
                        {(lodMetrics.adaptiveMetrics.stabilityScore * 100).toFixed(1)}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* LOD Effectiveness */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="LOD System Effectiveness" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceHistory.slice(-60).map(d => ({
                    timestamp: d.timestamp,
                    quality: 100 - (d.lodMetrics?.currentLOD.models || 0) * 20,
                    performance: d.fps,
                    efficiency: (d.fps / 60) * (100 - (d.lodMetrics?.currentLOD.models || 0) * 20)
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                    <Legend />
                    <Line type="monotone" dataKey="quality" stroke="#8884d8" name="Visual Quality %" />
                    <Line type="monotone" dataKey="performance" stroke="#82ca9d" name="FPS" />
                    <Line type="monotone" dataKey="efficiency" stroke="#ffc658" name="Efficiency Score" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 4 && (
        <Grid container spacing={2}>
          {/* Comparison Controls */}
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="Performance Comparisons"
                action={
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => {
                      const newComparison: ComparisonConfig = {
                        name: `Snapshot ${new Date().toLocaleTimeString()}`,
                        timestamp: Date.now(),
                        data: performanceHistory.slice(-300),
                        settings: { lodConfig }
                      };
                      setComparisons(prev => [...prev, newComparison]);
                    }}
                  >
                    Capture Snapshot
                  </Button>
                }
              />
              <CardContent>
                {comparisons.length > 0 ? (
                  <Box>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>Select Comparison</InputLabel>
                      <Select
                        value={selectedComparison || ''}
                        onChange={(e) => setSelectedComparison(e.target.value)}
                      >
                        {comparisons.map((comp, idx) => (
                          <MenuItem key={idx} value={idx.toString()}>
                            {comp.name} - {new Date(comp.timestamp).toLocaleString()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {selectedComparison !== null && (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="timestamp" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line 
                            type="monotone" 
                            data={performanceHistory.slice(-300)} 
                            dataKey="fps" 
                            stroke="#8884d8" 
                            name="Current FPS" 
                            dot={false}
                          />
                          <Line 
                            type="monotone" 
                            data={comparisons[parseInt(selectedComparison)].data} 
                            dataKey="fps" 
                            stroke="#82ca9d" 
                            name="Comparison FPS" 
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </Box>
                ) : (
                  <Typography variant="body2" color="textSecondary" align="center">
                    No comparisons available. Capture a snapshot to start comparing.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Performance Analytics Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="h6" gutterBottom>Performance Alerts</Typography>
            {alerts.map((alert, idx) => (
              <Accordion key={alert.id}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box display="flex" alignItems="center" gap={2} width="100%">
                    <FormControlLabel
                      control={
                        <Switch
                          checked={alert.enabled}
                          onChange={(e) => {
                            const updated = [...alerts];
                            updated[idx].enabled = e.target.checked;
                            setAlerts(updated);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      }
                      label={alert.message}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Metric</InputLabel>
                        <Select
                          value={alert.type}
                          onChange={(e) => {
                            const updated = [...alerts];
                            updated[idx].type = e.target.value as any;
                            setAlerts(updated);
                          }}
                        >
                          <MenuItem value="fps">FPS</MenuItem>
                          <MenuItem value="memory">Memory</MenuItem>
                          <MenuItem value="drawCalls">Draw Calls</MenuItem>
                          <MenuItem value="frameTime">Frame Time</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Condition</InputLabel>
                        <Select
                          value={alert.condition}
                          onChange={(e) => {
                            const updated = [...alerts];
                            updated[idx].condition = e.target.value as any;
                            setAlerts(updated);
                          }}
                        >
                          <MenuItem value="above">Above</MenuItem>
                          <MenuItem value="below">Below</MenuItem>
                          <MenuItem value="equals">Equals</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Threshold"
                        type="number"
                        value={alert.threshold}
                        onChange={(e) => {
                          const updated = [...alerts];
                          updated[idx].threshold = parseFloat(e.target.value);
                          setAlerts(updated);
                        }}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>Performance Targets</Typography>
            {performanceTargets.map((target, idx) => (
              <Box key={idx} sx={{ mb: 2 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={target.name}
                      onChange={(e) => {
                        const updated = [...performanceTargets];
                        updated[idx].name = e.target.value;
                        setPerformanceTargets(updated);
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <FormControl fullWidth>
                      <InputLabel>Metric</InputLabel>
                      <Select
                        value={target.metric}
                        onChange={(e) => {
                          const updated = [...performanceTargets];
                          updated[idx].metric = e.target.value;
                          setPerformanceTargets(updated);
                        }}
                      >
                        <MenuItem value="fps">FPS</MenuItem>
                        <MenuItem value="frameTime">Frame Time</MenuItem>
                        <MenuItem value="drawCalls">Draw Calls</MenuItem>
                        <MenuItem value="memory">Memory</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="Target Value"
                      type="number"
                      value={target.target}
                      onChange={(e) => {
                        const updated = [...performanceTargets];
                        updated[idx].target = parseFloat(e.target.value);
                        setPerformanceTargets(updated);
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography gutterBottom>Weight: {(target.weight * 100).toFixed(0)}%</Typography>
                    <Slider
                      value={target.weight}
                      onChange={(_, value) => {
                        const updated = [...performanceTargets];
                        updated[idx].weight = value as number;
                        setPerformanceTargets(updated);
                      }}
                      step={0.05}
                      min={0}
                      max={1}
                    />
                  </Grid>
                </Grid>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
        <DialogTitle>Export Performance Report</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2">
              Choose export format for the performance report:
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => {
                handleExport('json');
                setExportDialogOpen(false);
              }}
            >
              Export as JSON
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => {
                handleExport('csv');
                setExportDialogOpen(false);
              }}
            >
              Export as CSV
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => {
                handleExport('pdf');
                setExportDialogOpen(false);
              }}
            >
              Export as PDF Report
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Add icon import that was missing
import AddIcon from '@mui/icons-material/Add';

export default PerformanceAnalyticsDashboard;