/**
 * LOD System Utilities
 * 
 * Helper functions for LOD calculations, optimizations, and performance analysis.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import * as THREE from 'three';
import { LODLevel } from './LODManager';

/**
 * Calculate the appropriate LOD level based on multiple factors
 */
export function calculateLODLevel(params: {
  distance: number;
  screenCoverage: number;
  importance: 'critical' | 'high' | 'medium' | 'low';
  performanceScore: number;
  lodDistances: number[];
}): LODLevel {
  const { distance, screenCoverage, importance, performanceScore, lodDistances } = params;
  
  // Base LOD from distance
  let baseLOD = LODLevel.MINIMAL;
  for (let i = 0; i < lodDistances.length; i++) {
    if (distance <= lodDistances[i]) {
      baseLOD = i as LODLevel;
      break;
    }
  }
  
  // Adjust for screen coverage
  if (screenCoverage > 0.5) {
    baseLOD = Math.max(LODLevel.ULTRA, baseLOD - 1) as LODLevel;
  } else if (screenCoverage < 0.05) {
    baseLOD = Math.min(LODLevel.MINIMAL, baseLOD + 1) as LODLevel;
  }
  
  // Adjust for importance
  const importanceModifier = {
    critical: -1,
    high: 0,
    medium: 1,
    low: 2
  };
  baseLOD = Math.max(LODLevel.ULTRA, Math.min(LODLevel.MINIMAL, 
    baseLOD + importanceModifier[importance])) as LODLevel;
  
  // Adjust for performance
  if (performanceScore < 30) {
    baseLOD = Math.min(LODLevel.MINIMAL, baseLOD + 2) as LODLevel;
  } else if (performanceScore < 60) {
    baseLOD = Math.min(LODLevel.MINIMAL, baseLOD + 1) as LODLevel;
  }
  
  return baseLOD;
}

/**
 * Calculate screen-space error for LOD switching
 */
export function calculateScreenSpaceError(
  object: THREE.Object3D,
  camera: THREE.Camera,
  viewportSize: { width: number; height: number }
): number {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Project bounding sphere to screen
  const radius = size.length() / 2;
  const distance = camera.position.distanceTo(center);
  
  // Calculate pixel size
  const fov = (camera as THREE.PerspectiveCamera).fov || 75;
  const pixelSize = (2 * Math.tan((fov * Math.PI) / 360) * distance) / viewportSize.height;
  const screenRadius = radius / pixelSize;
  
  // Error metric: ratio of object size to pixel size
  return screenRadius;
}

/**
 * Estimate memory usage of a Three.js object
 */
export function estimateMemoryUsage(object: THREE.Object3D): {
  geometryMB: number;
  textureMB: number;
  totalMB: number;
} {
  let geometryBytes = 0;
  let textureBytes = 0;
  
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      
      // Estimate geometry memory
      if (mesh.geometry) {
        const geometry = mesh.geometry;
        const attributes = geometry.attributes;
        
        for (const name in attributes) {
          const attribute = attributes[name];
          const bytes = attribute.array.length * attribute.array.BYTES_PER_ELEMENT;
          geometryBytes += bytes;
        }
        
        if (geometry.index) {
          geometryBytes += geometry.index.array.length * geometry.index.array.BYTES_PER_ELEMENT;
        }
      }
      
      // Estimate texture memory
      if (mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        materials.forEach(material => {
          const textureProperties = [
            'map', 'normalMap', 'roughnessMap', 'metalnessMap', 
            'aoMap', 'emissiveMap', 'bumpMap', 'displacementMap'
          ];
          
          textureProperties.forEach(prop => {
            const texture = (material as any)[prop] as THREE.Texture;
            if (texture && texture.image) {
              const { width = 0, height = 0 } = texture.image;
              // Assume 4 bytes per pixel (RGBA)
              textureBytes += width * height * 4;
            }
          });
        });
      }
    }
  });
  
  return {
    geometryMB: geometryBytes / (1024 * 1024),
    textureMB: textureBytes / (1024 * 1024),
    totalMB: (geometryBytes + textureBytes) / (1024 * 1024)
  };
}

/**
 * Calculate optimal texture resolution based on distance and screen size
 */
export function calculateOptimalTextureResolution(params: {
  baseResolution: number;
  distance: number;
  maxDistance: number;
  screenCoverage: number;
  performanceScore: number;
}): number {
  const { baseResolution, distance, maxDistance, screenCoverage, performanceScore } = params;
  
  // Distance-based reduction
  const distanceFactor = 1 - (distance / maxDistance);
  
  // Screen coverage factor
  const coverageFactor = Math.min(1, screenCoverage * 2);
  
  // Performance factor
  const performanceFactor = performanceScore / 100;
  
  // Calculate optimal resolution
  const factor = distanceFactor * coverageFactor * performanceFactor;
  const optimalResolution = Math.pow(2, Math.floor(Math.log2(baseResolution * factor)));
  
  // Clamp to reasonable values
  return Math.max(64, Math.min(baseResolution, optimalResolution));
}

/**
 * Group objects by material for batching
 */
export function groupObjectsByMaterial(
  objects: THREE.Mesh[]
): Map<THREE.Material, THREE.Mesh[]> {
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  
  objects.forEach(mesh => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    
    materials.forEach(material => {
      if (!groups.has(material)) {
        groups.set(material, []);
      }
      groups.get(material)!.push(mesh);
    });
  });
  
  return groups;
}

/**
 * Check if objects can be instanced
 */
export function canInstance(meshes: THREE.Mesh[]): boolean {
  if (meshes.length < 2) return false;
  
  const referenceGeometry = meshes[0].geometry;
  const referenceMaterial = meshes[0].material;
  
  return meshes.every(mesh => 
    mesh.geometry === referenceGeometry && 
    mesh.material === referenceMaterial
  );
}

/**
 * Calculate frustum culling statistics
 */
export function calculateCullingStats(
  scene: THREE.Scene,
  camera: THREE.Camera
): {
  total: number;
  visible: number;
  culled: number;
  percentage: number;
} {
  const frustum = new THREE.Frustum();
  const matrix = new THREE.Matrix4().multiplyMatrices(
    camera.projectionMatrix,
    camera.matrixWorldInverse
  );
  frustum.setFromProjectionMatrix(matrix);
  
  let total = 0;
  let visible = 0;
  
  scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      total++;
      if (frustum.intersectsObject(object)) {
        visible++;
      }
    }
  });
  
  const culled = total - visible;
  const percentage = total > 0 ? (culled / total) * 100 : 0;
  
  return { total, visible, culled, percentage };
}

/**
 * Performance score calculation
 */
export function calculatePerformanceScore(metrics: {
  fps: number;
  targetFPS: number;
  frameTime: number;
  memoryUsage: number;
  maxMemory: number;
  drawCalls: number;
  maxDrawCalls: number;
}): number {
  const {
    fps, targetFPS, frameTime, memoryUsage, 
    maxMemory, drawCalls, maxDrawCalls
  } = metrics;
  
  // FPS score (40% weight)
  const fpsScore = Math.min(100, (fps / targetFPS) * 100) * 0.4;
  
  // Frame time consistency (20% weight)
  const targetFrameTime = 1000 / targetFPS;
  const frameTimeScore = Math.max(0, 100 - ((frameTime - targetFrameTime) / targetFrameTime) * 100) * 0.2;
  
  // Memory score (20% weight)
  const memoryScore = Math.max(0, 100 - (memoryUsage / maxMemory) * 100) * 0.2;
  
  // Draw call score (20% weight)
  const drawCallScore = Math.max(0, 100 - (drawCalls / maxDrawCalls) * 100) * 0.2;
  
  return Math.round(fpsScore + frameTimeScore + memoryScore + drawCallScore);
}

/**
 * LOD transition easing functions
 */
export const LODTransitions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  smoothStep: (t: number) => t * t * (3.0 - 2.0 * t)
};

/**
 * Interpolate between LOD levels for smooth transitions
 */
export function interpolateLOD(
  fromLOD: LODLevel,
  toLOD: LODLevel,
  t: number,
  easing: keyof typeof LODTransitions = 'smoothStep'
): number {
  const easedT = LODTransitions[easing](Math.max(0, Math.min(1, t)));
  return fromLOD + (toLOD - fromLOD) * easedT;
}

/**
 * Generate LOD chain for progressive loading
 */
export function generateLODChain(params: {
  maxLOD: LODLevel;
  minLOD: LODLevel;
  distances: number[];
  qualityFactors?: number[];
}): Array<{ level: LODLevel; distance: number; quality: number }> {
  const { maxLOD, minLOD, distances, qualityFactors = [1, 0.5, 0.25, 0.125, 0.0625] } = params;
  
  const chain: Array<{ level: LODLevel; distance: number; quality: number }> = [];
  
  for (let level = maxLOD; level <= minLOD; level++) {
    chain.push({
      level: level as LODLevel,
      distance: distances[level] || distances[distances.length - 1],
      quality: qualityFactors[level] || qualityFactors[qualityFactors.length - 1]
    });
  }
  
  return chain;
}

/**
 * Adaptive quality heuristics
 */
export class AdaptiveQualityHeuristics {
  private history: number[] = [];
  private readonly historySize: number;
  private readonly smoothingFactor: number;
  
  constructor(historySize = 60, smoothingFactor = 0.1) {
    this.historySize = historySize;
    this.smoothingFactor = smoothingFactor;
  }
  
  addSample(fps: number): void {
    this.history.push(fps);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
  }
  
  getSmoothedFPS(): number {
    if (this.history.length === 0) return 60;
    
    // Exponential moving average
    let ema = this.history[0];
    for (let i = 1; i < this.history.length; i++) {
      ema = ema * (1 - this.smoothingFactor) + this.history[i] * this.smoothingFactor;
    }
    
    return ema;
  }
  
  getTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.history.length < 10) return 'stable';
    
    const recent = this.history.slice(-10);
    const older = this.history.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const difference = recentAvg - olderAvg;
    
    if (difference > 5) return 'improving';
    if (difference < -5) return 'degrading';
    return 'stable';
  }
  
  getStability(): number {
    if (this.history.length < 2) return 1;
    
    // Calculate standard deviation
    const mean = this.history.reduce((a, b) => a + b, 0) / this.history.length;
    const variance = this.history.reduce((sum, fps) => sum + Math.pow(fps - mean, 2), 0) / this.history.length;
    const stdDev = Math.sqrt(variance);
    
    // Normalize (lower is more stable)
    return Math.max(0, 1 - stdDev / mean);
  }
  
  shouldAdjustQuality(targetFPS: number, threshold = 0.9): { 
    adjust: boolean; 
    direction: 'increase' | 'decrease' | 'none' 
  } {
    const smoothedFPS = this.getSmoothedFPS();
    const trend = this.getTrend();
    const stability = this.getStability();
    
    // Don't adjust if unstable
    if (stability < 0.7) {
      return { adjust: false, direction: 'none' };
    }
    
    // Check if we need to decrease quality
    if (smoothedFPS < targetFPS * threshold) {
      return { adjust: true, direction: 'decrease' };
    }
    
    // Check if we can increase quality
    if (smoothedFPS > targetFPS * 1.2 && trend !== 'degrading') {
      return { adjust: true, direction: 'increase' };
    }
    
    return { adjust: false, direction: 'none' };
  }
}

export default {
  calculateLODLevel,
  calculateScreenSpaceError,
  estimateMemoryUsage,
  calculateOptimalTextureResolution,
  groupObjectsByMaterial,
  canInstance,
  calculateCullingStats,
  calculatePerformanceScore,
  LODTransitions,
  interpolateLOD,
  generateLODChain,
  AdaptiveQualityHeuristics
};