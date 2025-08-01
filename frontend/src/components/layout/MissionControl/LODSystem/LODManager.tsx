/**
 * LODManager Component
 * 
 * Central management system for Level of Detail (LOD) optimization.
 * Handles adaptive LOD switching, performance monitoring, and resource management.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PerformanceMetrics } from '../PerformanceMonitor';

// LOD levels for different systems
export enum LODLevel {
  ULTRA = 0,
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
  MINIMAL = 4
}

// LOD configuration for different components
export interface LODConfig {
  models: {
    level: LODLevel;
    distances: number[];
    polyCountTargets: number[];
  };
  physics: {
    level: LODLevel;
    updateRates: number[];
    simplificationFactors: number[];
  };
  animations: {
    level: LODLevel;
    frameRates: number[];
    boneCountLimits: number[];
  };
  effects: {
    level: LODLevel;
    particleLimits: number[];
    shaderComplexity: string[];
  };
  terrain: {
    level: LODLevel;
    chunkSizes: number[];
    textureResolutions: number[];
  };
}

// Performance targets
export interface PerformanceTargets {
  targetFPS: number;
  minFPS: number;
  maxMemoryMB: number;
  maxDrawCalls: number;
  gpuUtilizationTarget: number;
}

// LOD metrics for monitoring
export interface LODMetrics extends PerformanceMetrics {
  currentLOD: {
    models: LODLevel;
    physics: LODLevel;
    animations: LODLevel;
    effects: LODLevel;
    terrain: LODLevel;
  };
  objectCounts: {
    total: number;
    visible: number;
    culled: number;
    instanced: number;
  };
  memoryUsage: {
    totalMB: number;
    texturesMB: number;
    geometryMB: number;
    buffersMB: number;
  };
  adaptiveMetrics: {
    lastAdjustment: number;
    adjustmentCount: number;
    stabilityScore: number;
  };
}

// Context for LOD system
interface LODContextValue {
  config: LODConfig;
  metrics: LODMetrics;
  targets: PerformanceTargets;
  setQualityPreset: (preset: 'ultra' | 'high' | 'medium' | 'low' | 'adaptive') => void;
  setComponentLOD: (component: keyof LODConfig, level: LODLevel) => void;
  getRecommendedLOD: (distance: number, screenSize: number) => LODLevel;
  registerObject: (object: THREE.Object3D, metadata?: any) => void;
  unregisterObject: (object: THREE.Object3D) => void;
}

const LODContext = createContext<LODContextValue | null>(null);

export function useLOD() {
  const context = useContext(LODContext);
  if (!context) {
    throw new Error('useLOD must be used within LODProvider');
  }
  return context;
}

// Default configurations for different quality presets
const QUALITY_PRESETS: Record<string, LODConfig> = {
  ultra: {
    models: {
      level: LODLevel.ULTRA,
      distances: [0, 25, 50, 100, 200],
      polyCountTargets: [100000, 50000, 20000, 5000, 1000]
    },
    physics: {
      level: LODLevel.ULTRA,
      updateRates: [60, 30, 15, 10, 5],
      simplificationFactors: [1.0, 0.8, 0.5, 0.3, 0.1]
    },
    animations: {
      level: LODLevel.ULTRA,
      frameRates: [60, 30, 20, 15, 10],
      boneCountLimits: [50, 30, 20, 10, 5]
    },
    effects: {
      level: LODLevel.ULTRA,
      particleLimits: [10000, 5000, 2000, 500, 100],
      shaderComplexity: ['complex', 'standard', 'simple', 'basic', 'minimal']
    },
    terrain: {
      level: LODLevel.ULTRA,
      chunkSizes: [64, 128, 256, 512, 1024],
      textureResolutions: [4096, 2048, 1024, 512, 256]
    }
  },
  high: {
    models: {
      level: LODLevel.HIGH,
      distances: [0, 30, 60, 120, 250],
      polyCountTargets: [50000, 25000, 10000, 2500, 500]
    },
    physics: {
      level: LODLevel.HIGH,
      updateRates: [30, 20, 10, 5, 2],
      simplificationFactors: [0.8, 0.6, 0.4, 0.2, 0.1]
    },
    animations: {
      level: LODLevel.HIGH,
      frameRates: [30, 20, 15, 10, 5],
      boneCountLimits: [30, 20, 15, 8, 4]
    },
    effects: {
      level: LODLevel.HIGH,
      particleLimits: [5000, 2500, 1000, 250, 50],
      shaderComplexity: ['standard', 'simple', 'basic', 'minimal', 'minimal']
    },
    terrain: {
      level: LODLevel.HIGH,
      chunkSizes: [128, 256, 512, 1024, 2048],
      textureResolutions: [2048, 1024, 512, 256, 128]
    }
  },
  medium: {
    models: {
      level: LODLevel.MEDIUM,
      distances: [0, 40, 80, 160, 320],
      polyCountTargets: [25000, 12500, 5000, 1250, 250]
    },
    physics: {
      level: LODLevel.MEDIUM,
      updateRates: [20, 15, 8, 4, 1],
      simplificationFactors: [0.6, 0.4, 0.3, 0.15, 0.05]
    },
    animations: {
      level: LODLevel.MEDIUM,
      frameRates: [20, 15, 10, 5, 2],
      boneCountLimits: [20, 15, 10, 5, 2]
    },
    effects: {
      level: LODLevel.MEDIUM,
      particleLimits: [2500, 1250, 500, 125, 25],
      shaderComplexity: ['simple', 'basic', 'minimal', 'minimal', 'minimal']
    },
    terrain: {
      level: LODLevel.MEDIUM,
      chunkSizes: [256, 512, 1024, 2048, 4096],
      textureResolutions: [1024, 512, 256, 128, 64]
    }
  },
  low: {
    models: {
      level: LODLevel.LOW,
      distances: [0, 50, 100, 200, 400],
      polyCountTargets: [10000, 5000, 2000, 500, 100]
    },
    physics: {
      level: LODLevel.LOW,
      updateRates: [15, 10, 5, 2, 1],
      simplificationFactors: [0.4, 0.3, 0.2, 0.1, 0.05]
    },
    animations: {
      level: LODLevel.LOW,
      frameRates: [15, 10, 5, 2, 1],
      boneCountLimits: [10, 8, 5, 2, 1]
    },
    effects: {
      level: LODLevel.LOW,
      particleLimits: [1000, 500, 200, 50, 10],
      shaderComplexity: ['basic', 'minimal', 'minimal', 'minimal', 'minimal']
    },
    terrain: {
      level: LODLevel.LOW,
      chunkSizes: [512, 1024, 2048, 4096, 8192],
      textureResolutions: [512, 256, 128, 64, 32]
    }
  }
};

interface LODProviderProps {
  children: React.ReactNode;
  initialPreset?: 'ultra' | 'high' | 'medium' | 'low' | 'adaptive';
  performanceTargets?: Partial<PerformanceTargets>;
  onMetricsUpdate?: (metrics: LODMetrics) => void;
}

export function LODProvider({
  children,
  initialPreset = 'adaptive',
  performanceTargets,
  onMetricsUpdate
}: LODProviderProps) {
  const { scene, camera, gl } = useThree();
  
  // State
  const [qualityPreset, setQualityPresetState] = useState(initialPreset);
  const [config, setConfig] = useState<LODConfig>(
    initialPreset === 'adaptive' ? QUALITY_PRESETS.medium : QUALITY_PRESETS[initialPreset]
  );
  
  // Performance targets with defaults
  const targets: PerformanceTargets = {
    targetFPS: 60,
    minFPS: 30,
    maxMemoryMB: 512,
    maxDrawCalls: 1000,
    gpuUtilizationTarget: 0.8,
    ...performanceTargets
  };
  
  // Metrics tracking
  const metricsRef = useRef<LODMetrics>({
    fps: 0,
    frameTime: 0,
    memory: { geometries: 0, textures: 0, programs: 0 },
    render: { calls: 0, triangles: 0, points: 0, lines: 0 },
    currentLOD: {
      models: config.models.level,
      physics: config.physics.level,
      animations: config.animations.level,
      effects: config.effects.level,
      terrain: config.terrain.level
    },
    objectCounts: { total: 0, visible: 0, culled: 0, instanced: 0 },
    memoryUsage: { totalMB: 0, texturesMB: 0, geometryMB: 0, buffersMB: 0 },
    adaptiveMetrics: { lastAdjustment: Date.now(), adjustmentCount: 0, stabilityScore: 1.0 }
  });
  
  // Object registry for LOD management
  const objectRegistry = useRef(new Map<THREE.Object3D, any>());
  
  // Performance history for adaptive adjustment
  const performanceHistory = useRef<number[]>([]);
  const adaptiveAdjustmentCooldown = useRef(0);
  
  // Register/unregister objects
  const registerObject = useCallback((object: THREE.Object3D, metadata?: any) => {
    objectRegistry.current.set(object, metadata || {});
  }, []);
  
  const unregisterObject = useCallback((object: THREE.Object3D) => {
    objectRegistry.current.delete(object);
  }, []);
  
  // Get recommended LOD based on distance and screen size
  const getRecommendedLOD = useCallback((distance: number, screenSize: number): LODLevel => {
    const { distances } = config.models;
    
    // Find appropriate LOD based on distance
    let lodLevel = LODLevel.MINIMAL;
    for (let i = 0; i < distances.length; i++) {
      if (distance <= distances[i]) {
        lodLevel = i as LODLevel;
        break;
      }
    }
    
    // Adjust based on screen size (object importance)
    if (screenSize > 0.5) {
      lodLevel = Math.max(LODLevel.ULTRA, lodLevel - 1) as LODLevel;
    } else if (screenSize < 0.1) {
      lodLevel = Math.min(LODLevel.MINIMAL, lodLevel + 1) as LODLevel;
    }
    
    return lodLevel;
  }, [config.models]);
  
  // Set component-specific LOD
  const setComponentLOD = useCallback((component: keyof LODConfig, level: LODLevel) => {
    setConfig(prev => ({
      ...prev,
      [component]: {
        ...prev[component],
        level
      }
    }));
  }, []);
  
  // Set quality preset
  const setQualityPreset = useCallback((preset: 'ultra' | 'high' | 'medium' | 'low' | 'adaptive') => {
    setQualityPresetState(preset);
    if (preset !== 'adaptive') {
      setConfig(QUALITY_PRESETS[preset]);
    }
  }, []);
  
  // Adaptive LOD adjustment based on performance
  const adjustLODAdaptively = useCallback(() => {
    if (qualityPreset !== 'adaptive' || adaptiveAdjustmentCooldown.current > 0) {
      return;
    }
    
    const avgFPS = performanceHistory.current.reduce((a, b) => a + b, 0) / performanceHistory.current.length;
    const currentMetrics = metricsRef.current;
    
    // Check if adjustment is needed
    let needsAdjustment = false;
    let adjustmentDirection = 0; // -1 for lower quality, 1 for higher quality
    
    if (avgFPS < targets.minFPS) {
      needsAdjustment = true;
      adjustmentDirection = -1;
    } else if (avgFPS > targets.targetFPS * 1.1 && currentMetrics.memoryUsage.totalMB < targets.maxMemoryMB * 0.7) {
      needsAdjustment = true;
      adjustmentDirection = 1;
    }
    
    if (needsAdjustment) {
      // Adjust each component based on its impact
      const newConfig = { ...config };
      
      // Models have the highest impact on performance
      if (adjustmentDirection < 0 && newConfig.models.level < LODLevel.MINIMAL) {
        newConfig.models.level++;
      } else if (adjustmentDirection > 0 && newConfig.models.level > LODLevel.ULTRA) {
        newConfig.models.level--;
      }
      
      // Physics second highest impact
      if (adjustmentDirection < 0 && newConfig.physics.level < LODLevel.MINIMAL) {
        newConfig.physics.level++;
      } else if (adjustmentDirection > 0 && newConfig.physics.level > LODLevel.HIGH) {
        newConfig.physics.level--;
      }
      
      // Effects and animations
      if (adjustmentDirection < 0) {
        if (newConfig.effects.level < LODLevel.MINIMAL) newConfig.effects.level++;
        if (newConfig.animations.level < LODLevel.MINIMAL) newConfig.animations.level++;
      } else if (adjustmentDirection > 0) {
        if (newConfig.effects.level > LODLevel.HIGH) newConfig.effects.level--;
        if (newConfig.animations.level > LODLevel.HIGH) newConfig.animations.level--;
      }
      
      setConfig(newConfig);
      
      // Update metrics
      metricsRef.current.adaptiveMetrics.lastAdjustment = Date.now();
      metricsRef.current.adaptiveMetrics.adjustmentCount++;
      
      // Set cooldown to prevent rapid adjustments
      adaptiveAdjustmentCooldown.current = 180; // 3 seconds at 60 FPS
    }
  }, [qualityPreset, config, targets]);
  
  // Main update loop
  useFrame((state, delta) => {
    // Update cooldown
    if (adaptiveAdjustmentCooldown.current > 0) {
      adaptiveAdjustmentCooldown.current--;
    }
    
    // Calculate current metrics
    const info = gl.info;
    const currentFPS = 1 / delta;
    
    // Update performance history
    performanceHistory.current.push(currentFPS);
    if (performanceHistory.current.length > 300) { // Keep last 5 seconds at 60 FPS
      performanceHistory.current.shift();
    }
    
    // Count objects and visibility
    let totalObjects = 0;
    let visibleObjects = 0;
    let culledObjects = 0;
    let instancedObjects = 0;
    
    scene.traverse((object) => {
      if (object.type === 'Mesh' || object.type === 'SkinnedMesh') {
        totalObjects++;
        if (object.visible) {
          visibleObjects++;
          // Check if object is in frustum
          const frustum = new THREE.Frustum();
          frustum.setFromProjectionMatrix(
            new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
          );
          if (object.isMesh && !frustum.intersectsObject(object)) {
            culledObjects++;
          }
        }
        // Check for instanced rendering
        if ((object as THREE.InstancedMesh).isInstancedMesh) {
          instancedObjects++;
        }
      }
    });
    
    // Estimate memory usage
    const textureMemory = info.memory.textures * 0.5; // Rough estimate MB per texture
    const geometryMemory = info.memory.geometries * 0.1; // Rough estimate MB per geometry
    const totalMemory = textureMemory + geometryMemory;
    
    // Calculate stability score (0-1, higher is more stable)
    const fpsVariance = Math.abs(currentFPS - targets.targetFPS) / targets.targetFPS;
    const stabilityScore = Math.max(0, 1 - fpsVariance);
    
    // Update metrics
    metricsRef.current = {
      fps: Math.round(currentFPS),
      frameTime: delta * 1000,
      memory: {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length || 0
      },
      render: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        points: info.render.points,
        lines: info.render.lines
      },
      currentLOD: {
        models: config.models.level,
        physics: config.physics.level,
        animations: config.animations.level,
        effects: config.effects.level,
        terrain: config.terrain.level
      },
      objectCounts: {
        total: totalObjects,
        visible: visibleObjects,
        culled: culledObjects,
        instanced: instancedObjects
      },
      memoryUsage: {
        totalMB: totalMemory,
        texturesMB: textureMemory,
        geometryMB: geometryMemory,
        buffersMB: 0 // Would need WebGL extension to get accurate buffer memory
      },
      adaptiveMetrics: {
        ...metricsRef.current.adaptiveMetrics,
        stabilityScore
      }
    };
    
    // Reset render info
    info.reset();
    
    // Trigger adaptive adjustment periodically
    if (state.clock.elapsedTime % 1 < delta) { // Every second
      adjustLODAdaptively();
    }
    
    // Notify metrics update
    if (onMetricsUpdate) {
      onMetricsUpdate(metricsRef.current);
    }
  });
  
  const contextValue: LODContextValue = {
    config,
    metrics: metricsRef.current,
    targets,
    setQualityPreset,
    setComponentLOD,
    getRecommendedLOD,
    registerObject,
    unregisterObject
  };
  
  return (
    <LODContext.Provider value={contextValue}>
      {children}
    </LODContext.Provider>
  );
}

export default LODProvider;