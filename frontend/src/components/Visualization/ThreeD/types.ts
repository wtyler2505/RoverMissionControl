/**
 * 3D Visualization Types
 * Type definitions for Three.js-based 3D visualization components
 */

import { Vector3 } from 'three';

/**
 * Point in 3D space with optional metadata
 */
export interface DataPoint3D {
  x: number;
  y: number;
  z: number;
  timestamp?: number;
  value?: number;
  label?: string;
  color?: string;
  metadata?: Record<string, any>;
}

/**
 * 3D trajectory data
 */
export interface TrajectoryData {
  id: string;
  name: string;
  points: DataPoint3D[];
  color?: string;
  lineWidth?: number;
  showPoints?: boolean;
  showLine?: boolean;
  interpolation?: 'linear' | 'spline' | 'step';
}

/**
 * Terrain/surface data
 */
export interface TerrainData {
  id: string;
  name: string;
  width: number;
  height: number;
  heightMap: number[][];
  colorMap?: string[][];
  scale?: Vector3;
  wireframe?: boolean;
}

/**
 * 3D scatter plot data
 */
export interface ScatterData3D {
  id: string;
  name: string;
  points: DataPoint3D[];
  pointSize?: number;
  pointShape?: 'sphere' | 'cube' | 'cone' | 'cylinder';
  colorScale?: ColorScale;
}

/**
 * Color scale for data mapping
 */
export interface ColorScale {
  type: 'continuous' | 'discrete';
  domain: [number, number];
  range: string[];
  interpolate?: boolean;
}

/**
 * Camera configuration
 */
export interface CameraConfig {
  position?: Vector3;
  lookAt?: Vector3;
  fov?: number;
  near?: number;
  far?: number;
  type?: 'perspective' | 'orthographic';
}

/**
 * Lighting configuration
 */
export interface LightingConfig {
  ambient?: {
    color: string;
    intensity: number;
  };
  directional?: Array<{
    position: Vector3;
    color: string;
    intensity: number;
    castShadow?: boolean;
  }>;
  point?: Array<{
    position: Vector3;
    color: string;
    intensity: number;
    distance?: number;
    decay?: number;
  }>;
}

/**
 * Axis configuration
 */
export interface AxisConfig {
  show: boolean;
  labels?: {
    x?: string;
    y?: string;
    z?: string;
  };
  ranges?: {
    x?: [number, number];
    y?: [number, number];
    z?: [number, number];
  };
  grid?: {
    xy?: boolean;
    xz?: boolean;
    yz?: boolean;
    color?: string;
    opacity?: number;
  };
  ticks?: {
    x?: number;
    y?: number;
    z?: number;
  };
}

/**
 * Animation configuration
 */
export interface AnimationConfig {
  enabled: boolean;
  speed: number;
  loop: boolean;
  autoRotate?: boolean;
  rotationSpeed?: number;
  followPath?: boolean;
  trailLength?: number;
}

/**
 * Interaction configuration
 */
export interface InteractionConfig {
  enableZoom: boolean;
  enablePan: boolean;
  enableRotate: boolean;
  enableSelection: boolean;
  enableTooltips: boolean;
  mouseSpeed: number;
  touchSpeed: number;
  minDistance?: number;
  maxDistance?: number;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  format: 'png' | 'jpg' | 'svg' | 'gltf' | 'obj';
  quality?: number;
  width?: number;
  height?: number;
  preserveViewport?: boolean;
}

/**
 * Performance configuration
 */
export interface PerformanceConfig {
  maxPoints: number;
  decimation: boolean;
  lod: boolean;
  antialiasing: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'none';
  pixelRatio?: number;
}

/**
 * Annotation in 3D space
 */
export interface Annotation3D {
  id: string;
  position: Vector3;
  text: string;
  style?: {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontFamily?: string;
    padding?: number;
    borderRadius?: number;
    arrow?: boolean;
  };
  visible?: boolean;
  alwaysOnTop?: boolean;
}

/**
 * 3D chart configuration
 */
export interface Chart3DConfig {
  camera: CameraConfig;
  lighting: LightingConfig;
  axis: AxisConfig;
  animation: AnimationConfig;
  interaction: InteractionConfig;
  performance: PerformanceConfig;
  background?: string;
  fog?: {
    color: string;
    near: number;
    far: number;
  };
}

/**
 * 3D chart props
 */
export interface Chart3DProps {
  width: number;
  height: number;
  config?: Partial<Chart3DConfig>;
  onReady?: (api: Chart3DAPI) => void;
  onError?: (error: Error) => void;
  className?: string;
}

/**
 * 3D chart API for external control
 */
export interface Chart3DAPI {
  // Data management
  addTrajectory(data: TrajectoryData): void;
  updateTrajectory(id: string, data: Partial<TrajectoryData>): void;
  removeTrajectory(id: string): void;
  
  addScatterData(data: ScatterData3D): void;
  updateScatterData(id: string, data: Partial<ScatterData3D>): void;
  removeScatterData(id: string): void;
  
  addTerrain(data: TerrainData): void;
  updateTerrain(id: string, data: Partial<TerrainData>): void;
  removeTerrain(id: string): void;
  
  // Annotations
  addAnnotation(annotation: Annotation3D): void;
  updateAnnotation(id: string, annotation: Partial<Annotation3D>): void;
  removeAnnotation(id: string): void;
  
  // Camera control
  setCameraPosition(position: Vector3): void;
  setCameraLookAt(target: Vector3): void;
  resetCamera(): void;
  fitToData(): void;
  
  // Animation control
  play(): void;
  pause(): void;
  reset(): void;
  setAnimationTime(time: number): void;
  
  // Export
  exportImage(config?: Partial<ExportConfig>): Promise<Blob>;
  exportModel(format: 'gltf' | 'obj'): Promise<Blob>;
  
  // Utilities
  getDataBounds(): { min: Vector3; max: Vector3 };
  pick(x: number, y: number): DataPoint3D | null;
  highlightPoint(point: DataPoint3D): void;
  clearHighlights(): void;
}