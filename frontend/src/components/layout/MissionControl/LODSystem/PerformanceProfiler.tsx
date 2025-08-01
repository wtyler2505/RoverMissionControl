/**
 * PerformanceProfiler Component
 * 
 * Advanced performance profiling and analytics system for 3D visualization.
 * Provides detailed metrics, bottleneck detection, and optimization recommendations.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@mui/material';
import { Alert, AlertDescription } from '@mui/material';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@mui/material';

// Performance profile data structure
export interface PerformanceProfile {
  timestamp: number;
  frameTime: number;
  fps: number;
  cpu: {
    jsTime: number;
    physicsTime: number;
    animationTime: number;
    renderPrepTime: number;
  };
  gpu: {
    drawTime: number;
    shaderTime: number;
    textureTime: number;
    bandwidth: number;
  };
  memory: {
    jsHeap: number;
    gpuMemory: number;
    textureMemory: number;
    bufferMemory: number;
  };
  rendering: {
    drawCalls: number;
    triangles: number;
    vertices: number;
    programs: number;
    textures: number;
    instances: number;
  };
  bottleneck: 'cpu' | 'gpu' | 'memory' | 'bandwidth' | 'none';
  recommendations: string[];
}

// Benchmark scenario configuration
export interface BenchmarkScenario {
  name: string;
  description: string;
  duration: number;
  setup: () => void;
  update: (time: number) => void;
  teardown: () => void;
  targetMetrics: {
    minFPS: number;
    maxFrameTime: number;
    maxMemoryMB: number;
  };
}

// Performance test result
export interface PerformanceTestResult {
  scenario: string;
  passed: boolean;
  averageFPS: number;
  minFPS: number;
  maxFrameTime: number;
  memoryPeak: number;
  bottlenecks: string[];
  recommendations: string[];
  profile: PerformanceProfile[];
}

interface PerformanceProfilerProps {
  enabled?: boolean;
  sampleRate?: number;
  historySize?: number;
  onProfileUpdate?: (profile: PerformanceProfile) => void;
  onTestComplete?: (result: PerformanceTestResult) => void;
}

/**
 * Performance Profiler Hook
 */
export function usePerformanceProfiler({
  sampleRate = 60,
  historySize = 300
}: {
  sampleRate?: number;
  historySize?: number;
} = {}) {
  const { gl, scene } = useThree();
  const profileHistory = useRef<PerformanceProfile[]>([]);
  const frameCount = useRef(0);
  const lastSampleTime = useRef(performance.now());
  const cpuTimers = useRef({
    jsStart: 0,
    physicsStart: 0,
    animationStart: 0,
    renderPrepStart: 0
  });
  
  // GPU timing extension
  const gpuTimer = useRef<WebGLQuery | null>(null);
  const gpuTimingAvailable = useRef(false);
  
  useEffect(() => {
    // Check for GPU timing support
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (ext) {
      gpuTimingAvailable.current = true;
      gpuTimer.current = gl.createQuery()!;
    }
  }, [gl]);
  
  const startCPUTimer = useCallback((timer: keyof typeof cpuTimers.current) => {
    cpuTimers.current[timer] = performance.now();
  }, []);
  
  const endCPUTimer = useCallback((timer: keyof typeof cpuTimers.current): number => {
    return performance.now() - cpuTimers.current[timer];
  }, []);
  
  const detectBottleneck = useCallback((profile: PerformanceProfile): 'cpu' | 'gpu' | 'memory' | 'bandwidth' | 'none' => {
    const totalCPUTime = profile.cpu.jsTime + profile.cpu.physicsTime + profile.cpu.animationTime + profile.cpu.renderPrepTime;
    const gpuTime = profile.gpu.drawTime;
    
    // Thresholds
    const targetFrameTime = 16.67; // 60 FPS
    
    if (profile.frameTime > targetFrameTime * 1.5) {
      if (totalCPUTime > targetFrameTime * 0.8) {
        return 'cpu';
      } else if (gpuTime > targetFrameTime * 0.8) {
        return 'gpu';
      } else if (profile.memory.jsHeap > 500 || profile.memory.gpuMemory > 1000) {
        return 'memory';
      } else if (profile.gpu.bandwidth > 1000) {
        return 'bandwidth';
      }
    }
    
    return 'none';
  }, []);
  
  const generateRecommendations = useCallback((profile: PerformanceProfile): string[] => {
    const recommendations: string[] = [];
    
    // FPS recommendations
    if (profile.fps < 30) {
      recommendations.push('Critical: FPS below 30. Consider reducing quality settings.');
    } else if (profile.fps < 50) {
      recommendations.push('Warning: FPS below target. Enable adaptive quality.');
    }
    
    // Draw call recommendations
    if (profile.rendering.drawCalls > 1000) {
      recommendations.push('High draw calls detected. Consider batching or instancing.');
    }
    
    // Triangle count recommendations
    if (profile.rendering.triangles > 1000000) {
      recommendations.push('High triangle count. Enable LOD for distant objects.');
    }
    
    // Memory recommendations
    if (profile.memory.textureMemory > 500) {
      recommendations.push('High texture memory usage. Consider texture compression or atlasing.');
    }
    
    if (profile.memory.jsHeap > 400) {
      recommendations.push('High JavaScript heap usage. Check for memory leaks.');
    }
    
    // Shader recommendations
    if (profile.rendering.programs > 50) {
      recommendations.push('Many shader programs active. Consider shader consolidation.');
    }
    
    // CPU bottleneck recommendations
    if (profile.bottleneck === 'cpu') {
      if (profile.cpu.physicsTime > 5) {
        recommendations.push('Physics taking significant CPU time. Reduce physics complexity.');
      }
      if (profile.cpu.animationTime > 5) {
        recommendations.push('Animation updates consuming CPU. Optimize animation system.');
      }
    }
    
    // GPU bottleneck recommendations
    if (profile.bottleneck === 'gpu') {
      if (profile.gpu.shaderTime > 8) {
        recommendations.push('Complex shaders detected. Simplify shader calculations.');
      }
      recommendations.push('GPU bound. Reduce resolution or enable GPU optimizations.');
    }
    
    return recommendations;
  }, []);
  
  const captureProfile = useCallback((): PerformanceProfile => {
    const now = performance.now();
    const deltaTime = now - lastSampleTime.current;
    const fps = Math.round(1000 / (deltaTime / sampleRate));
    
    // Get WebGL info
    const info = gl.info;
    
    // Memory estimation
    const jsHeap = performance.memory ? 
      (performance.memory.usedJSHeapSize / 1048576) : 0;
    
    // Count scene objects
    let instanceCount = 0;
    scene.traverse((obj) => {
      if ((obj as THREE.InstancedMesh).isInstancedMesh) {
        instanceCount += (obj as THREE.InstancedMesh).count;
      }
    });
    
    const profile: PerformanceProfile = {
      timestamp: now,
      frameTime: deltaTime / sampleRate,
      fps,
      cpu: {
        jsTime: 0, // Would be set by timing functions
        physicsTime: 0,
        animationTime: 0,
        renderPrepTime: 0
      },
      gpu: {
        drawTime: 0, // Would be set by GPU timer
        shaderTime: 0,
        textureTime: 0,
        bandwidth: 0
      },
      memory: {
        jsHeap,
        gpuMemory: (info.memory.geometries + info.memory.textures) * 0.5, // Rough estimate
        textureMemory: info.memory.textures * 0.5,
        bufferMemory: info.memory.geometries * 0.1
      },
      rendering: {
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        vertices: info.render.triangles * 3, // Approximate
        programs: info.programs?.length || 0,
        textures: info.memory.textures,
        instances: instanceCount
      },
      bottleneck: 'none',
      recommendations: []
    };
    
    // Detect bottleneck and generate recommendations
    profile.bottleneck = detectBottleneck(profile);
    profile.recommendations = generateRecommendations(profile);
    
    return profile;
  }, [gl, scene, sampleRate, detectBottleneck, generateRecommendations]);
  
  const profile = useCallback(() => {
    frameCount.current++;
    
    if (frameCount.current % sampleRate === 0) {
      const profile = captureProfile();
      
      // Add to history
      profileHistory.current.push(profile);
      if (profileHistory.current.length > historySize) {
        profileHistory.current.shift();
      }
      
      lastSampleTime.current = performance.now();
      
      // Reset WebGL info
      gl.info.reset();
      
      return profile;
    }
    
    return null;
  }, [captureProfile, sampleRate, historySize, gl]);
  
  return {
    profile,
    profileHistory: profileHistory.current,
    startCPUTimer,
    endCPUTimer
  };
}

/**
 * Performance Dashboard Component
 */
export function PerformanceDashboard({ 
  profiles,
  testResults 
}: {
  profiles: PerformanceProfile[];
  testResults?: PerformanceTestResult[];
}) {
  const [selectedTab, setSelectedTab] = useState('realtime');
  
  // Prepare chart data
  const chartData = profiles.slice(-60).map((profile, index) => ({
    time: index,
    fps: profile.fps,
    frameTime: profile.frameTime,
    drawCalls: profile.rendering.drawCalls,
    triangles: profile.rendering.triangles / 1000,
    memory: profile.memory.jsHeap
  }));
  
  // Calculate averages
  const averages = profiles.length > 0 ? {
    fps: profiles.reduce((sum, p) => sum + p.fps, 0) / profiles.length,
    frameTime: profiles.reduce((sum, p) => sum + p.frameTime, 0) / profiles.length,
    drawCalls: profiles.reduce((sum, p) => sum + p.rendering.drawCalls, 0) / profiles.length,
    triangles: profiles.reduce((sum, p) => sum + p.rendering.triangles, 0) / profiles.length
  } : { fps: 0, frameTime: 0, drawCalls: 0, triangles: 0 };
  
  // Bottleneck distribution
  const bottleneckCounts = profiles.reduce((acc, p) => {
    acc[p.bottleneck] = (acc[p.bottleneck] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const bottleneckData = Object.entries(bottleneckCounts).map(([name, value]) => ({
    name,
    value,
    percentage: (value / profiles.length * 100).toFixed(1)
  }));
  
  // Latest recommendations
  const latestRecommendations = profiles[profiles.length - 1]?.recommendations || [];
  
  return (
    <div className="performance-dashboard" style={{ width: '100%', height: '100%', padding: '16px' }}>
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
        </TabsList>
        
        <TabsContent value="realtime">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* FPS Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Frame Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="fps" stroke="#00ff00" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="frameTime" stroke="#ff0000" strokeWidth={2} dot={false} yAxisId="right" />
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ marginTop: '8px' }}>
                  <span>Average FPS: {averages.fps.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>
            
            {/* Draw Calls Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Rendering Load</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="drawCalls" stackId="1" stroke="#8884d8" fill="#8884d8" />
                    <Area type="monotone" dataKey="triangles" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{ marginTop: '8px' }}>
                  <span>Avg Draw Calls: {averages.drawCalls.toFixed(0)}</span>
                  <span style={{ marginLeft: '16px' }}>Avg Triangles: {(averages.triangles / 1000).toFixed(1)}k</span>
                </div>
              </CardContent>
            </Card>
            
            {/* Bottleneck Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Bottleneck Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {bottleneckData.map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '80px' }}>{item.name}:</span>
                      <div style={{ 
                        flex: 1, 
                        height: '20px', 
                        backgroundColor: '#e0e0e0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${item.percentage}%`,
                          height: '100%',
                          backgroundColor: item.name === 'none' ? '#4caf50' : '#ff9800',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                      <span style={{ marginLeft: '8px', width: '50px' }}>{item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                {latestRecommendations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {latestRecommendations.map((rec, index) => (
                      <Alert key={index} severity={rec.includes('Critical') ? 'error' : 'warning'}>
                        <AlertDescription>{rec}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <Alert severity="success">
                    <AlertDescription>Performance is optimal. No recommendations.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="analysis">
          {/* Detailed analysis views */}
          <div>
            <h3>Performance Analysis</h3>
            {/* Add detailed analysis components here */}
          </div>
        </TabsContent>
        
        <TabsContent value="benchmarks">
          {/* Benchmark test results */}
          <div>
            <h3>Benchmark Results</h3>
            {testResults && testResults.map((result, index) => (
              <Card key={index} style={{ marginBottom: '16px' }}>
                <CardHeader>
                  <CardTitle>{result.scenario}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div>Status: {result.passed ? 'PASSED' : 'FAILED'}</div>
                  <div>Average FPS: {result.averageFPS.toFixed(1)}</div>
                  <div>Min FPS: {result.minFPS.toFixed(1)}</div>
                  <div>Max Frame Time: {result.maxFrameTime.toFixed(2)}ms</div>
                  <div>Memory Peak: {result.memoryPeak.toFixed(1)}MB</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Automated Performance Testing
 */
export class PerformanceBenchmark {
  private scenarios: Map<string, BenchmarkScenario>;
  
  constructor() {
    this.scenarios = new Map();
    this.initializeScenarios();
  }
  
  private initializeScenarios(): void {
    // Scenario 1: Static scene complexity
    this.scenarios.set('static-complexity', {
      name: 'Static Scene Complexity',
      description: 'Tests rendering performance with increasing object count',
      duration: 10000,
      setup: () => {
        // Add many static objects
      },
      update: (time: number) => {
        // No updates for static test
      },
      teardown: () => {
        // Clean up objects
      },
      targetMetrics: {
        minFPS: 30,
        maxFrameTime: 33.33,
        maxMemoryMB: 500
      }
    });
    
    // Scenario 2: Animation stress test
    this.scenarios.set('animation-stress', {
      name: 'Animation Stress Test',
      description: 'Tests performance with many animated objects',
      duration: 10000,
      setup: () => {
        // Add animated objects
      },
      update: (time: number) => {
        // Update animations
      },
      teardown: () => {
        // Clean up
      },
      targetMetrics: {
        minFPS: 30,
        maxFrameTime: 33.33,
        maxMemoryMB: 600
      }
    });
    
    // Scenario 3: Physics simulation
    this.scenarios.set('physics-stress', {
      name: 'Physics Stress Test',
      description: 'Tests physics engine performance',
      duration: 10000,
      setup: () => {
        // Setup physics bodies
      },
      update: (time: number) => {
        // Physics updates
      },
      teardown: () => {
        // Clean up physics
      },
      targetMetrics: {
        minFPS: 30,
        maxFrameTime: 33.33,
        maxMemoryMB: 700
      }
    });
  }
  
  async runScenario(
    scenarioName: string,
    profiler: ReturnType<typeof usePerformanceProfiler>
  ): Promise<PerformanceTestResult> {
    const scenario = this.scenarios.get(scenarioName);
    if (!scenario) {
      throw new Error(`Unknown scenario: ${scenarioName}`);
    }
    
    const profiles: PerformanceProfile[] = [];
    const startTime = performance.now();
    
    // Setup scenario
    scenario.setup();
    
    // Run test
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const elapsed = performance.now() - startTime;
        
        if (elapsed >= scenario.duration) {
          clearInterval(interval);
          
          // Teardown
          scenario.teardown();
          
          // Analyze results
          const result = this.analyzeResults(scenario, profiles);
          resolve(result);
        } else {
          // Update scenario
          scenario.update(elapsed);
          
          // Capture profile
          const profile = profiler.profile();
          if (profile) {
            profiles.push(profile);
          }
        }
      }, 16); // 60 FPS
    });
  }
  
  private analyzeResults(
    scenario: BenchmarkScenario,
    profiles: PerformanceProfile[]
  ): PerformanceTestResult {
    const fpsSamples = profiles.map(p => p.fps);
    const frameTimeSamples = profiles.map(p => p.frameTime);
    const memorySamples = profiles.map(p => p.memory.jsHeap + p.memory.gpuMemory);
    
    const averageFPS = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    const minFPS = Math.min(...fpsSamples);
    const maxFrameTime = Math.max(...frameTimeSamples);
    const memoryPeak = Math.max(...memorySamples);
    
    const passed = 
      minFPS >= scenario.targetMetrics.minFPS &&
      maxFrameTime <= scenario.targetMetrics.maxFrameTime &&
      memoryPeak <= scenario.targetMetrics.maxMemoryMB;
    
    const bottlenecks = [...new Set(profiles.map(p => p.bottleneck))].filter(b => b !== 'none');
    const recommendations = [...new Set(profiles.flatMap(p => p.recommendations))];
    
    return {
      scenario: scenario.name,
      passed,
      averageFPS,
      minFPS,
      maxFrameTime,
      memoryPeak,
      bottlenecks,
      recommendations,
      profile: profiles
    };
  }
  
  async runAllScenarios(
    profiler: ReturnType<typeof usePerformanceProfiler>
  ): Promise<PerformanceTestResult[]> {
    const results: PerformanceTestResult[] = [];
    
    for (const [name, _] of this.scenarios) {
      const result = await this.runScenario(name, profiler);
      results.push(result);
    }
    
    return results;
  }
}

export default PerformanceProfiler;