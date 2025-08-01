/**
 * CameraController Component
 * 
 * Manages camera transitions, effects, and advanced camera behaviors.
 * Provides smooth interpolation between camera states and handles
 * collision detection, auto-focus, and cinematic sequences.
 * 
 * Features:
 * - Smooth camera transitions with easing
 * - Camera collision detection
 * - Auto-focus on points of interest
 * - Camera path recording and playback
 * - Camera shake and effects management
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Vector3, Quaternion, MathUtils } from 'three';

// Types
export interface CameraTransition {
  from: {
    position: Vector3;
    rotation: Quaternion;
    fov: number;
  };
  to: {
    position: Vector3;
    rotation: Quaternion;
    fov: number;
  };
  duration: number;
  easing: (t: number) => number;
  onComplete?: () => void;
}

export interface CameraPath {
  id: string;
  name: string;
  points: Array<{
    position: Vector3;
    lookAt?: Vector3;
    fov?: number;
    duration: number;
  }>;
  loop: boolean;
  smoothing: number; // 0-1, how much to smooth the path
}

export interface CollisionConfig {
  enabled: boolean;
  offset: number; // Distance to maintain from objects
  raycasterConfig?: {
    near: number;
    far: number;
  };
  layers?: number[]; // Which layers to check for collisions
}

export interface AutoFocusConfig {
  enabled: boolean;
  speed: number; // How fast to focus (0-1)
  threshold: number; // Distance threshold to trigger focus
  priorityWeights: {
    distance: number;
    priority: number;
    visibility: number;
  };
}

export interface CameraControllerProps {
  /** Current camera reference */
  camera?: THREE.Camera;
  /** Enable smooth transitions */
  enableTransitions?: boolean;
  /** Collision detection configuration */
  collisionConfig?: CollisionConfig;
  /** Auto-focus configuration */
  autoFocusConfig?: AutoFocusConfig;
  /** Points of interest for auto-focus */
  pointsOfInterest?: Array<{
    id: string;
    position: Vector3;
    priority: number;
    radius: number;
  }>;
  /** Camera paths for cinematics */
  paths?: CameraPath[];
  /** Current active path */
  activePath?: string;
  /** Callback when transition completes */
  onTransitionComplete?: () => void;
  /** Callback when collision detected */
  onCollision?: (point: Vector3) => void;
  /** Callback when auto-focus target changes */
  onFocusChange?: (targetId: string | null) => void;
}

// Easing functions
export const Easings = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (--t) * t * t + 1,
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  elasticOut: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
      ? 1
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounceOut: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
};

// Catmull-Rom spline for smooth camera paths
function catmullRom(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number): Vector3 {
  const v0 = p2.clone().sub(p0).multiplyScalar(0.5);
  const v1 = p3.clone().sub(p1).multiplyScalar(0.5);
  const t2 = t * t;
  const t3 = t * t2;
  
  return new Vector3().addScaledVector(p1, 1)
    .addScaledVector(v0, t)
    .addScaledVector(p0.clone().multiplyScalar(3).sub(p1.clone().multiplyScalar(3)).add(v1).sub(v0), t2)
    .addScaledVector(p0.clone().multiplyScalar(-2).add(p1.clone().multiplyScalar(2)).sub(v0).sub(v1), t3);
}

/**
 * CameraController Component
 */
export const CameraController: React.FC<CameraControllerProps> = ({
  camera,
  enableTransitions = true,
  collisionConfig = { enabled: false, offset: 1 },
  autoFocusConfig = { enabled: false, speed: 0.1, threshold: 50, priorityWeights: { distance: 0.5, priority: 0.3, visibility: 0.2 } },
  pointsOfInterest = [],
  paths = [],
  activePath,
  onTransitionComplete,
  onCollision,
  onFocusChange,
}) => {
  const { scene, raycaster } = useThree();
  const [currentTransition, setCurrentTransition] = useState<CameraTransition | null>(null);
  const [currentFocusTarget, setCurrentFocusTarget] = useState<string | null>(null);
  const [pathProgress, setPathProgress] = useState(0);
  const [recordedPath, setRecordedPath] = useState<Vector3[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  const transitionStartTime = useRef<number>(0);
  const lastCollisionCheck = useRef<number>(0);
  const pathStartTime = useRef<number>(0);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  
  // Get default camera if not provided
  const activeCamera = camera || useThree((state) => state.camera);
  
  // Smooth transition between camera states
  const transitionTo = useCallback((
    targetPosition: Vector3,
    targetRotation?: Quaternion,
    targetFov?: number,
    duration: number = 1000,
    easing: (t: number) => number = Easings.easeInOutQuad
  ) => {
    if (!enableTransitions || !activeCamera) {
      // Instant transition
      activeCamera.position.copy(targetPosition);
      if (targetRotation) {
        activeCamera.quaternion.copy(targetRotation);
      }
      if (targetFov && activeCamera instanceof THREE.PerspectiveCamera) {
        activeCamera.fov = targetFov;
        activeCamera.updateProjectionMatrix();
      }
      return;
    }
    
    const transition: CameraTransition = {
      from: {
        position: activeCamera.position.clone(),
        rotation: activeCamera.quaternion.clone(),
        fov: activeCamera instanceof THREE.PerspectiveCamera ? activeCamera.fov : 75,
      },
      to: {
        position: targetPosition.clone(),
        rotation: targetRotation || activeCamera.quaternion.clone(),
        fov: targetFov || (activeCamera instanceof THREE.PerspectiveCamera ? activeCamera.fov : 75),
      },
      duration,
      easing,
      onComplete: onTransitionComplete,
    };
    
    setCurrentTransition(transition);
    transitionStartTime.current = Date.now();
  }, [activeCamera, enableTransitions, onTransitionComplete]);
  
  // Collision detection
  const checkCollisions = useCallback((position: Vector3, direction: Vector3): Vector3 | null => {
    if (!collisionConfig.enabled || !scene) return null;
    
    const origin = position.clone();
    const normalizedDirection = direction.clone().normalize();
    
    raycaster.set(origin, normalizedDirection);
    raycaster.near = collisionConfig.raycasterConfig?.near || 0.1;
    raycaster.far = collisionConfig.raycasterConfig?.far || collisionConfig.offset * 2;
    
    // Filter objects by layers if specified
    const objects = collisionConfig.layers
      ? scene.children.filter(obj => collisionConfig.layers!.some(layer => obj.layers.test(new THREE.Layers().set(layer))))
      : scene.children;
    
    const intersects = raycaster.intersectObjects(objects, true);
    
    if (intersects.length > 0 && intersects[0].distance < collisionConfig.offset) {
      const collision = intersects[0];
      if (onCollision) {
        onCollision(collision.point);
      }
      
      // Calculate adjusted position
      const adjustment = normalizedDirection.multiplyScalar(-(collisionConfig.offset - collision.distance));
      return position.clone().add(adjustment);
    }
    
    return null;
  }, [collisionConfig, scene, raycaster, onCollision]);
  
  // Auto-focus on points of interest
  const updateAutoFocus = useCallback(() => {
    if (!autoFocusConfig.enabled || pointsOfInterest.length === 0 || !activeCamera) return;
    
    const cameraPosition = activeCamera.position;
    let bestTarget: typeof pointsOfInterest[0] | null = null;
    let bestScore = -Infinity;
    
    for (const poi of pointsOfInterest) {
      const distance = cameraPosition.distanceTo(poi.position);
      
      // Skip if outside threshold
      if (distance > autoFocusConfig.threshold) continue;
      
      // Calculate visibility (simple frustum check)
      const direction = poi.position.clone().sub(cameraPosition).normalize();
      const cameraDirection = new Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion);
      const dotProduct = direction.dot(cameraDirection);
      const visibility = Math.max(0, dotProduct);
      
      // Calculate weighted score
      const normalizedDistance = 1 - (distance / autoFocusConfig.threshold);
      const score = 
        normalizedDistance * autoFocusConfig.priorityWeights.distance +
        poi.priority * autoFocusConfig.priorityWeights.priority +
        visibility * autoFocusConfig.priorityWeights.visibility;
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = poi;
      }
    }
    
    if (bestTarget && bestTarget.id !== currentFocusTarget) {
      setCurrentFocusTarget(bestTarget.id);
      if (onFocusChange) {
        onFocusChange(bestTarget.id);
      }
    } else if (!bestTarget && currentFocusTarget) {
      setCurrentFocusTarget(null);
      if (onFocusChange) {
        onFocusChange(null);
      }
    }
  }, [autoFocusConfig, pointsOfInterest, activeCamera, currentFocusTarget, onFocusChange]);
  
  // Start recording camera path
  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordedPath([]);
    
    recordingInterval.current = setInterval(() => {
      if (activeCamera) {
        setRecordedPath(prev => [...prev, activeCamera.position.clone()]);
      }
    }, 100); // Record position every 100ms
  }, [activeCamera]);
  
  // Stop recording and return the path
  const stopRecording = useCallback((): CameraPath => {
    setIsRecording(false);
    
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
    
    const path: CameraPath = {
      id: `recorded-${Date.now()}`,
      name: 'Recorded Path',
      points: recordedPath.map((pos, index) => ({
        position: pos,
        duration: 100, // Default duration between points
      })),
      loop: false,
      smoothing: 0.5,
    };
    
    setRecordedPath([]);
    return path;
  }, [recordedPath]);
  
  // Play camera path
  const playPath = useCallback((pathId: string) => {
    const path = paths.find(p => p.id === pathId);
    if (!path || path.points.length < 2) return;
    
    setPathProgress(0);
    pathStartTime.current = Date.now();
  }, [paths]);
  
  // Update transitions and effects
  useFrame((state, delta) => {
    if (!activeCamera) return;
    
    // Handle transitions
    if (currentTransition) {
      const elapsed = Date.now() - transitionStartTime.current;
      const progress = Math.min(elapsed / currentTransition.duration, 1);
      const easedProgress = currentTransition.easing(progress);
      
      // Interpolate position
      activeCamera.position.lerpVectors(
        currentTransition.from.position,
        currentTransition.to.position,
        easedProgress
      );
      
      // Interpolate rotation
      activeCamera.quaternion.slerpQuaternions(
        currentTransition.from.rotation,
        currentTransition.to.rotation,
        easedProgress
      );
      
      // Interpolate FOV
      if (activeCamera instanceof THREE.PerspectiveCamera) {
        activeCamera.fov = MathUtils.lerp(
          currentTransition.from.fov,
          currentTransition.to.fov,
          easedProgress
        );
        activeCamera.updateProjectionMatrix();
      }
      
      if (progress >= 1) {
        setCurrentTransition(null);
        if (currentTransition.onComplete) {
          currentTransition.onComplete();
        }
      }
    }
    
    // Handle collision detection
    if (collisionConfig.enabled && Date.now() - lastCollisionCheck.current > 50) {
      lastCollisionCheck.current = Date.now();
      
      const velocity = new Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion);
      const adjustedPosition = checkCollisions(activeCamera.position, velocity);
      
      if (adjustedPosition) {
        activeCamera.position.copy(adjustedPosition);
      }
    }
    
    // Handle auto-focus
    if (autoFocusConfig.enabled && currentFocusTarget) {
      const target = pointsOfInterest.find(poi => poi.id === currentFocusTarget);
      if (target) {
        const targetDirection = target.position.clone().sub(activeCamera.position).normalize();
        const currentDirection = new Vector3(0, 0, -1).applyQuaternion(activeCamera.quaternion);
        
        // Smoothly rotate towards target
        const newDirection = currentDirection.lerp(targetDirection, autoFocusConfig.speed * delta * 60);
        const lookAtPoint = activeCamera.position.clone().add(newDirection);
        activeCamera.lookAt(lookAtPoint);
      }
    }
    
    // Handle path playback
    if (activePath) {
      const path = paths.find(p => p.id === activePath);
      if (path && path.points.length > 1) {
        const totalDuration = path.points.reduce((sum, point) => sum + point.duration, 0);
        const elapsed = Date.now() - pathStartTime.current;
        let progress = elapsed / totalDuration;
        
        if (path.loop) {
          progress = progress % 1;
        } else {
          progress = Math.min(progress, 1);
        }
        
        setPathProgress(progress);
        
        // Find current segment
        let accumulatedTime = 0;
        let segmentIndex = 0;
        let segmentProgress = 0;
        
        for (let i = 0; i < path.points.length - 1; i++) {
          const segmentDuration = path.points[i].duration;
          if (accumulatedTime + segmentDuration > elapsed) {
            segmentIndex = i;
            segmentProgress = (elapsed - accumulatedTime) / segmentDuration;
            break;
          }
          accumulatedTime += segmentDuration;
        }
        
        // Interpolate position along path
        if (path.smoothing > 0 && path.points.length > 3) {
          // Use Catmull-Rom spline for smooth interpolation
          const p0 = path.points[Math.max(0, segmentIndex - 1)].position;
          const p1 = path.points[segmentIndex].position;
          const p2 = path.points[Math.min(path.points.length - 1, segmentIndex + 1)].position;
          const p3 = path.points[Math.min(path.points.length - 1, segmentIndex + 2)].position;
          
          const smoothedPosition = catmullRom(p0, p1, p2, p3, segmentProgress);
          const lerpedPosition = activeCamera.position.clone().lerp(smoothedPosition, path.smoothing);
          activeCamera.position.copy(lerpedPosition);
        } else {
          // Linear interpolation
          const from = path.points[segmentIndex].position;
          const to = path.points[Math.min(path.points.length - 1, segmentIndex + 1)].position;
          activeCamera.position.lerpVectors(from, to, segmentProgress);
        }
        
        // Handle lookAt if specified
        const currentPoint = path.points[segmentIndex];
        if (currentPoint.lookAt) {
          activeCamera.lookAt(currentPoint.lookAt);
        }
        
        // Update FOV if specified
        if (currentPoint.fov && activeCamera instanceof THREE.PerspectiveCamera) {
          activeCamera.fov = MathUtils.lerp(activeCamera.fov, currentPoint.fov, 0.1);
          activeCamera.updateProjectionMatrix();
        }
      }
    }
    
    // Update auto-focus periodically
    updateAutoFocus();
  });
  
  // Public API via context or props callback
  useEffect(() => {
    // Expose controller methods if needed
    const controller = {
      transitionTo,
      startRecording,
      stopRecording,
      playPath,
      isRecording,
      recordedPath,
      pathProgress,
    };
    
    // Could expose via context or callback
  }, [transitionTo, startRecording, stopRecording, playPath, isRecording, recordedPath, pathProgress]);
  
  return null; // This component doesn't render anything
};

export default CameraController;