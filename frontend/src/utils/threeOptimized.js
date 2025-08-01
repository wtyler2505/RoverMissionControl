/**
 * Optimized Three.js imports for tree shaking
 * Reduces bundle size by importing only necessary Three.js components
 */

// Core Three.js (minimal required)
export {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Vector3,
  Euler,
  Matrix4
} from 'three';

// Geometry (only what we use)
export {
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry
} from 'three';

// Materials (essential only)
export {
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshPhongMaterial
} from 'three';

// Lights (commonly used)
export {
  AmbientLight,
  DirectionalLight,
  PointLight
} from 'three';

// Objects
export {
  Mesh,
  Group,
  Line,
  Points
} from 'three';

// Loaders (minimal set)
export {
  TextureLoader,
  ObjectLoader
} from 'three';

// Controls (we'll import separately to allow tree shaking)
// Note: OrbitControls should be imported from @react-three/drei instead

// Math utilities (commonly used)
export {
  MathUtils,
  Clock
} from 'three';

// Constants
export * from 'three/src/constants.js';

// Re-export optimized THREE object for compatibility
import * as THREE from 'three';

// Create minimal THREE object with only used components
export const ThreeOptimized = {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  Vector3,
  Euler,
  Matrix4,
  BoxGeometry,
  PlaneGeometry,
  SphereGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshPhongMaterial,
  AmbientLight,
  DirectionalLight,
  PointLight,
  Mesh,
  Group,
  Line,
  Points,
  TextureLoader,
  ObjectLoader,
  MathUtils,
  Clock
} = THREE;