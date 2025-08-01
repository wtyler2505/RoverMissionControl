/**
 * LOD System Export Module
 * 
 * Central export point for all LOD optimization components and utilities.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

// Core LOD Management
export { 
  LODProvider, 
  useLOD, 
  LODLevel,
  type LODConfig,
  type LODMetrics,
  type PerformanceTargets
} from './LODManager';

// Geometry Optimization
export { 
  GeometryOptimizer,
  OcclusionCuller,
  type SimplificationOptions,
  type InstancedRenderingConfig,
  type MeshOptimizationResult
} from './GeometryOptimizer';

// Performance Profiling
export {
  usePerformanceProfiler,
  PerformanceDashboard,
  PerformanceBenchmark,
  type PerformanceProfile,
  type BenchmarkScenario,
  type PerformanceTestResult
} from './PerformanceProfiler';

// UI Components
export {
  LODControlPanel,
  LODIndicator
} from './LODControlPanel';

// LOD-aware Components
export { LODRoverModel } from './LODRoverModel';
export { LODTerrain } from './LODTerrain';
export { LODEffects } from './LODEffects';

// Utility Functions
export * from './LODUtils';