/**
 * usePerformanceAnalytics Hook
 * 
 * Custom hook for integrating performance analytics into components
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  ExtendedPerformanceMetrics, 
  PerformanceAlert, 
  TriggeredAlert,
  BottleneckAnalysis,
  OptimizationRecommendation,
  MetricStatistics,
  PerformanceSnapshot,
  BenchmarkScenario,
  BenchmarkResult,
  PerformanceReport,
  UsePerformanceAnalyticsReturn,
  PerformanceAnalyticsConfig
} from '../types/performanceAnalytics';
import { useLOD } from '../components/layout/MissionControl/LODSystem/LODManager';

interface UsePerformanceAnalyticsOptions {
  enabled?: boolean;
  sampleRate?: number;
  historySize?: number;
  alerts?: PerformanceAlert[];
  customMetrics?: Record<string, () => number>;
  onAlertTriggered?: (alert: PerformanceAlert, value: number) => void;
}

/**
 * Performance analytics hook for Three.js applications
 */
export function usePerformanceAnalytics({
  enabled = true,
  sampleRate = 60, // Sample every 60 frames
  historySize = 600, // 10 minutes at 60fps
  alerts = [],
  customMetrics = {},
  onAlertTriggered
}: UsePerformanceAnalyticsOptions = {}): UsePerformanceAnalyticsReturn {
  const { gl, scene, camera } = useThree();
  const { metrics: lodMetrics } = useLOD();
  
  // State
  const [history, setHistory] = useState<ExtendedPerformanceMetrics[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Set<string>>(new Set());
  const [alertHistory, setAlertHistory] = useState<TriggeredAlert[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalysis[]>([]);
  const [recommendations, setRecommendations] = useState<OptimizationRecommendation[]>([]);
  
  // Refs
  const frameCount = useRef(0);
  const lastSampleTime = useRef(performance.now());
  const alertTimers = useRef<Map<string, number>>(new Map());
  const cpuTimer = useRef<{ start: number; breakdown: Record<string, number> }>({ 
    start: 0, 
    breakdown: {} 
  });
  
  // GPU timing extension
  const gpuTimer = useRef<WebGLQuery | null>(null);
  const gpuTimerAvailable = useRef(false);
  
  // Initialize GPU timer
  useEffect(() => {
    if (!gl || !enabled) return;
    
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (ext) {
      gpuTimerAvailable.current = true;
      // GPU timer would be initialized here if available
    }
  }, [gl, enabled]);
  
  // Performance sampling in render loop
  useFrame(() => {
    if (!enabled) return;
    
    frameCount.current++;
    
    // Start CPU timing
    const frameStart = performance.now();
    
    if (frameCount.current % sampleRate === 0) {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastSampleTime.current;
      const fps = Math.round((sampleRate * 1000) / deltaTime);
      const frameTime = deltaTime / sampleRate;
      
      // Get renderer info
      const info = gl.info;
      
      // Calculate memory usage (approximate)
      const textureMemory = info.memory.textures * 0.5; // Rough estimate MB
      const geometryMemory = info.memory.geometries * 0.1; // Rough estimate MB
      
      // Create metrics object
      const metrics: ExtendedPerformanceMetrics = {
        timestamp: currentTime,
        frameTime,
        fps,
        cpu: {
          jsTime: frameTime * 0.3, // Placeholder - would measure actual
          physicsTime: frameTime * 0.2,
          animationTime: frameTime * 0.1,
          renderPrepTime: frameTime * 0.2,
          otherTime: frameTime * 0.2
        },
        gpu: {
          drawTime: frameTime * 0.5, // Placeholder
          shaderTime: frameTime * 0.2,
          textureTime: frameTime * 0.1,
          bandwidth: 100, // Placeholder MB/s
          utilization: 50 // Placeholder %
        },
        memory: {
          jsHeap: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0,
          gpuMemory: textureMemory + geometryMemory,
          textureMemory,
          bufferMemory: geometryMemory,
          totalSystem: performance.memory ? performance.memory.totalJSHeapSize / 1048576 : 0
        },
        rendering: {
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          vertices: info.render.triangles * 3, // Approximate
          programs: info.programs?.length || 0,
          textures: info.memory.textures,
          instances: countInstances(scene),
          culledObjects: lodMetrics?.objectCounts.culled || 0
        },
        bottleneck: 'none',
        recommendations: [],
        lodMetrics,
        customMetrics: Object.entries(customMetrics).reduce((acc, [key, fn]) => {
          try {
            acc[key] = fn();
          } catch (e) {
            acc[key] = 0;
          }
          return acc;
        }, {} as Record<string, number>)
      };
      
      // Analyze bottlenecks
      const bottleneckAnalysis = analyzeBottlenecks(metrics);
      metrics.bottleneck = bottleneckAnalysis.type;
      metrics.recommendations = bottleneckAnalysis.recommendations;
      
      // Update history
      setHistory(prev => {
        const updated = [...prev, metrics];
        return updated.slice(-historySize);
      });
      
      // Check alerts
      checkAlerts(metrics);
      
      // Update bottleneck history
      if (bottleneckAnalysis.type !== 'none') {
        setBottlenecks(prev => [...prev.slice(-50), {
          timestamp: currentTime,
          type: bottleneckAnalysis.type,
          severity: bottleneckAnalysis.severity,
          component: bottleneckAnalysis.component,
          impact: bottleneckAnalysis.impact,
          details: bottleneckAnalysis.details
        }]);
      }
      
      // Reset render info
      info.reset();
      lastSampleTime.current = currentTime;
    }
  });
  
  // Alert checking
  const checkAlerts = useCallback((metrics: ExtendedPerformanceMetrics) => {
    alerts.forEach(alert => {
      if (!alert.enabled) return;
      
      let value: number | undefined;
      
      switch (alert.type) {
        case 'fps':
          value = metrics.fps;
          break;
        case 'memory':
          value = metrics.memory.jsHeap + metrics.memory.gpuMemory;
          break;
        case 'drawCalls':
          value = metrics.rendering.drawCalls;
          break;
        case 'frameTime':
          value = metrics.frameTime;
          break;
        case 'gpu':
          value = metrics.gpu.utilization || 0;
          break;
        case 'custom':
          value = alert.customMetric ? metrics.customMetrics?.[alert.customMetric] : undefined;
          break;
      }
      
      if (value === undefined) return;
      
      const triggered = checkAlertCondition(alert, value);
      
      if (triggered) {
        const currentDuration = (alertTimers.current.get(alert.id) || 0) + (sampleRate / 60);
        alertTimers.current.set(alert.id, currentDuration);
        
        if (currentDuration >= alert.duration && !activeAlerts.has(alert.id)) {
          setActiveAlerts(prev => new Set(prev).add(alert.id));
          setAlertHistory(prev => [...prev, {
            alertId: alert.id,
            timestamp: Date.now(),
            value,
            duration: currentDuration,
            resolved: false
          }]);
          onAlertTriggered?.(alert, value);
        }
      } else {
        alertTimers.current.delete(alert.id);
        if (activeAlerts.has(alert.id)) {
          setActiveAlerts(prev => {
            const next = new Set(prev);
            next.delete(alert.id);
            return next;
          });
          setAlertHistory(prev => prev.map(a => 
            a.alertId === alert.id && !a.resolved 
              ? { ...a, resolved: true }
              : a
          ));
        }
      }
    });
  }, [alerts, sampleRate, activeAlerts, onAlertTriggered]);
  
  // Calculate statistics
  const statistics = useMemo(() => {
    if (history.length === 0) return {};
    
    const metrics = ['fps', 'frameTime', 'drawCalls', 'memory'] as const;
    const stats: Record<string, MetricStatistics> = {};
    
    metrics.forEach(metric => {
      const values = history.map(h => {
        switch (metric) {
          case 'fps': return h.fps;
          case 'frameTime': return h.frameTime;
          case 'drawCalls': return h.rendering.drawCalls;
          case 'memory': return h.memory.jsHeap + h.memory.gpuMemory;
          default: return 0;
        }
      });
      
      stats[metric] = calculateStatistics(values);
    });
    
    return stats;
  }, [history]);
  
  // Action handlers
  const captureSnapshot = useCallback((name?: string): PerformanceSnapshot => {
    const snapshot: PerformanceSnapshot = {
      id: `snapshot-${Date.now()}`,
      name: name || `Snapshot ${new Date().toLocaleTimeString()}`,
      timestamp: Date.now(),
      data: [...history],
      settings: {
        lodConfig: lodMetrics
      },
      metadata: {
        browser: navigator.userAgent,
        resolution: `${window.innerWidth}x${window.innerHeight}`
      }
    };
    
    return snapshot;
  }, [history, lodMetrics]);
  
  const runBenchmark = useCallback(async (scenarioId: string): Promise<BenchmarkResult> => {
    // Placeholder implementation
    const result: BenchmarkResult = {
      scenarioId,
      timestamp: Date.now(),
      passed: true,
      score: 85,
      metrics: {
        averageFPS: 58,
        minFPS: 45,
        maxFPS: 60,
        frameTimeP95: 18.5,
        frameTimeP99: 22.1,
        memoryPeak: 512,
        drawCallsPeak: 120
      },
      failures: [],
      profile: []
    };
    
    return result;
  }, []);
  
  const exportReport = useCallback((format: 'json' | 'csv' | 'pdf') => {
    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      duration: history.length * (sampleRate / 60),
      statistics,
      history: history.slice(-300), // Last 5 minutes
      alerts: {
        configured: alerts,
        triggered: alertHistory
      },
      targets: [],
      score: calculatePerformanceScore(statistics),
      bottlenecks: bottlenecks.slice(-20),
      recommendations: generateRecommendations(history, bottlenecks)
    };
    
    // Export logic based on format
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `performance-report-${Date.now()}.json`);
    }
    // CSV and PDF export would be implemented here
  }, [history, statistics, alerts, alertHistory, bottlenecks, sampleRate]);
  
  const clearHistory = useCallback(() => {
    setHistory([]);
    setBottlenecks([]);
    setAlertHistory([]);
    setActiveAlerts(new Set());
    alertTimers.current.clear();
  }, []);
  
  const updateConfig = useCallback((config: Partial<PerformanceAnalyticsConfig>) => {
    // Configuration update logic would go here
  }, []);
  
  return {
    metrics: history[history.length - 1] || null,
    history,
    statistics,
    alerts: {
      active: activeAlerts,
      history: alertHistory
    },
    bottlenecks,
    recommendations,
    actions: {
      captureSnapshot,
      runBenchmark,
      exportReport,
      clearHistory,
      updateConfig
    }
  };
}

// Helper functions
function countInstances(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) {
      count += object.count;
    }
  });
  return count;
}

function checkAlertCondition(alert: PerformanceAlert, value: number): boolean {
  switch (alert.condition) {
    case 'above':
      return value > alert.threshold;
    case 'below':
      return value < alert.threshold;
    case 'equals':
      return Math.abs(value - alert.threshold) < 0.01;
    case 'between':
      return value >= alert.threshold && value <= (alert.thresholdMax || alert.threshold);
    default:
      return false;
  }
}

function analyzeBottlenecks(metrics: ExtendedPerformanceMetrics): {
  type: ExtendedPerformanceMetrics['bottleneck'];
  severity: BottleneckAnalysis['severity'];
  component: string;
  impact: number;
  details: string;
  recommendations: string[];
} {
  const analysis = {
    type: 'none' as ExtendedPerformanceMetrics['bottleneck'],
    severity: 'low' as BottleneckAnalysis['severity'],
    component: 'system',
    impact: 0,
    details: '',
    recommendations: [] as string[]
  };
  
  // FPS-based analysis
  if (metrics.fps < 30) {
    analysis.severity = 'high';
    
    // Check GPU bottleneck
    if (metrics.gpu.drawTime > metrics.frameTime * 0.7) {
      analysis.type = 'gpu';
      analysis.component = 'rendering';
      analysis.impact = 80;
      analysis.details = 'GPU is taking >70% of frame time';
      analysis.recommendations.push(
        'Reduce polygon count or use LOD system',
        'Simplify shaders or reduce shader effects',
        'Enable GPU instancing for repeated objects'
      );
    }
    // Check CPU bottleneck
    else if (metrics.cpu.jsTime > metrics.frameTime * 0.5) {
      analysis.type = 'cpu';
      analysis.component = 'javascript';
      analysis.impact = 70;
      analysis.details = 'JavaScript execution is taking >50% of frame time';
      analysis.recommendations.push(
        'Optimize JavaScript calculations',
        'Use Web Workers for heavy computations',
        'Reduce update frequency for non-critical systems'
      );
    }
    // Check memory pressure
    else if (metrics.memory.jsHeap > 1024) {
      analysis.type = 'memory';
      analysis.component = 'heap';
      analysis.impact = 60;
      analysis.details = 'High memory usage detected';
      analysis.recommendations.push(
        'Dispose unused geometries and textures',
        'Implement object pooling',
        'Reduce texture resolutions'
      );
    }
  }
  
  // Draw call analysis
  if (metrics.rendering.drawCalls > 200) {
    if (analysis.type === 'none') {
      analysis.type = 'gpu';
      analysis.severity = 'medium';
    }
    analysis.recommendations.push(
      'Batch similar objects using instancing',
      'Merge static geometries',
      'Use texture atlases to reduce material switches'
    );
  }
  
  return analysis;
}

function calculateStatistics(values: number[]): MetricStatistics {
  if (values.length === 0) {
    return {
      average: 0,
      min: 0,
      max: 0,
      median: 0,
      stdDev: 0,
      percentile95: 0,
      percentile99: 0,
      current: 0,
      trend: 'stable'
    };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const average = sum / values.length;
  
  // Standard deviation
  const squaredDiffs = values.map(v => Math.pow(v - average, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  // Percentiles
  const p95Index = Math.floor(values.length * 0.95);
  const p99Index = Math.floor(values.length * 0.99);
  
  // Trend analysis (simple linear regression on last 10% of data)
  const recentValues = values.slice(-Math.max(10, Math.floor(values.length * 0.1)));
  const trend = analyzeTrend(recentValues);
  
  return {
    average,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    stdDev,
    percentile95: sorted[p95Index] || sorted[sorted.length - 1],
    percentile99: sorted[p99Index] || sorted[sorted.length - 1],
    current: values[values.length - 1],
    trend
  };
}

function analyzeTrend(values: number[]): 'improving' | 'stable' | 'degrading' {
  if (values.length < 3) return 'stable';
  
  // Simple linear regression
  const n = values.length;
  const sumX = values.reduce((sum, _, i) => sum + i, 0);
  const sumY = values.reduce((sum, v) => sum + v, 0);
  const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
  const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const slopePercent = (slope / (sumY / n)) * 100;
  
  if (Math.abs(slopePercent) < 5) return 'stable';
  return slope > 0 ? 'degrading' : 'improving';
}

function generateRecommendations(
  history: ExtendedPerformanceMetrics[],
  bottlenecks: BottleneckAnalysis[]
): OptimizationRecommendation[] {
  const recommendations: OptimizationRecommendation[] = [];
  
  // Analyze recent history
  const recent = history.slice(-60); // Last minute
  if (recent.length === 0) return recommendations;
  
  const avgFPS = recent.reduce((sum, m) => sum + m.fps, 0) / recent.length;
  const avgDrawCalls = recent.reduce((sum, m) => sum + m.rendering.drawCalls, 0) / recent.length;
  const avgMemory = recent.reduce((sum, m) => sum + m.memory.jsHeap + m.memory.gpuMemory, 0) / recent.length;
  
  // FPS recommendations
  if (avgFPS < 50) {
    recommendations.push({
      priority: 'high',
      category: 'rendering',
      title: 'Enable Aggressive LOD',
      description: 'Current FPS is below optimal. Enable more aggressive LOD settings.',
      expectedImprovement: {
        metric: 'fps',
        current: avgFPS,
        potential: avgFPS * 1.3,
        unit: 'fps'
      },
      implementation: [
        'Reduce LOD distances by 25%',
        'Lower polygon count targets for each LOD level',
        'Enable frustum culling for all objects'
      ],
      effort: 'low'
    });
  }
  
  // Draw call recommendations
  if (avgDrawCalls > 150) {
    recommendations.push({
      priority: 'medium',
      category: 'rendering',
      title: 'Implement Instanced Rendering',
      description: 'High draw call count detected. Use instancing for repeated objects.',
      expectedImprovement: {
        metric: 'drawCalls',
        current: avgDrawCalls,
        potential: avgDrawCalls * 0.4,
        unit: 'calls'
      },
      implementation: [
        'Convert repeated meshes to InstancedMesh',
        'Batch similar materials',
        'Use texture atlases'
      ],
      effort: 'medium'
    });
  }
  
  // Memory recommendations
  if (avgMemory > 512) {
    recommendations.push({
      priority: 'medium',
      category: 'memory',
      title: 'Optimize Texture Memory',
      description: 'High memory usage detected. Compress and optimize textures.',
      expectedImprovement: {
        metric: 'memory',
        current: avgMemory,
        potential: avgMemory * 0.7,
        unit: 'MB'
      },
      implementation: [
        'Use compressed texture formats (DXT, ETC2)',
        'Implement texture streaming for large textures',
        'Reduce texture resolution for distant objects'
      ],
      effort: 'medium'
    });
  }
  
  return recommendations;
}

function calculatePerformanceScore(statistics: Record<string, MetricStatistics>): number {
  let score = 100;
  
  // FPS scoring (40% weight)
  const fpsStat = statistics.fps;
  if (fpsStat) {
    if (fpsStat.average < 60) score -= (60 - fpsStat.average) * 0.4;
    if (fpsStat.min < 30) score -= (30 - fpsStat.min) * 0.2;
  }
  
  // Frame time scoring (30% weight)
  const frameTimeStat = statistics.frameTime;
  if (frameTimeStat) {
    if (frameTimeStat.average > 16.67) score -= (frameTimeStat.average - 16.67) * 2;
    if (frameTimeStat.percentile95 > 33.33) score -= 10;
  }
  
  // Draw calls scoring (20% weight)
  const drawCallsStat = statistics.drawCalls;
  if (drawCallsStat) {
    if (drawCallsStat.average > 100) score -= (drawCallsStat.average - 100) * 0.1;
  }
  
  // Memory scoring (10% weight)
  const memoryStat = statistics.memory;
  if (memoryStat) {
    if (memoryStat.average > 512) score -= (memoryStat.average - 512) * 0.02;
  }
  
  return Math.max(0, Math.min(100, score));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export additional utilities
export { calculateStatistics, analyzeBottlenecks, generateRecommendations };

// Re-export types
export type { ExtendedPerformanceMetrics, PerformanceAlert, MetricStatistics };