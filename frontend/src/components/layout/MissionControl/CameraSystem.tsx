/**
 * CameraSystem Component
 * 
 * Provides multiple camera modes and viewing options for the rover visualization.
 * Supports orbit, first-person, chase, overhead, and cinematic camera modes.
 * 
 * Features:
 * - Multiple camera modes with smooth transitions
 * - Split-screen support for multi-view setups
 * - Camera state management and persistence
 * - Integration with React Three Fiber
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useEffect, useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  PerspectiveCamera, 
  OrthographicCamera,
  CameraShake,
  useBounds,
  CameraControls
} from '@react-three/drei';
import * as THREE from 'three';
import { Vector3, Euler, MathUtils } from 'three';

// Types
export type CameraMode = 'orbit' | 'firstPerson' | 'chase' | 'overhead' | 'cinematic' | 'custom';

export interface CameraConfig {
  mode: CameraMode;
  position: [number, number, number];
  rotation: [number, number, number];
  fov: number;
  near: number;
  far: number;
  enableDamping: boolean;
  dampingFactor: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
}

export interface CameraSystemProps {
  /** Current camera mode */
  mode?: CameraMode;
  /** Target object to follow (for chase/first-person modes) */
  target?: React.RefObject<THREE.Object3D>;
  /** Enable split-screen mode */
  splitScreen?: boolean;
  /** Split-screen configuration */
  splitConfig?: {
    mode: 'horizontal' | 'vertical' | 'quad';
    cameras: CameraMode[];
  };
  /** Enable camera shake effects */
  enableShake?: boolean;
  /** Camera shake configuration */
  shakeConfig?: {
    intensity?: number;
    decay?: boolean;
    decayRate?: number;
  };
  /** Enable collision detection */
  enableCollision?: boolean;
  /** Points of interest for auto-focus */
  pointsOfInterest?: Array<{
    name: string;
    position: [number, number, number];
    priority: number;
  }>;
  /** Callback when camera changes */
  onCameraChange?: (config: CameraConfig) => void;
  /** Enable cinematic paths */
  cinematicPaths?: Array<{
    name: string;
    points: Array<[number, number, number]>;
    duration: number;
    easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  }>;
}

export interface CameraSystemRef {
  /** Switch to a specific camera mode */
  switchCamera: (mode: CameraMode) => void;
  /** Focus on a point of interest */
  focusOn: (position: [number, number, number], duration?: number) => void;
  /** Start a cinematic sequence */
  startCinematic: (pathName: string) => void;
  /** Stop current cinematic */
  stopCinematic: () => void;
  /** Get current camera configuration */
  getCameraConfig: () => CameraConfig;
  /** Set custom camera position */
  setCustomPosition: (position: [number, number, number]) => void;
  /** Trigger camera shake */
  shake: (intensity?: number, duration?: number) => void;
}

// Camera mode configurations
const CAMERA_CONFIGS: Record<CameraMode, Partial<CameraConfig>> = {
  orbit: {
    position: [30, 30, 30],
    fov: 75,
    enableDamping: true,
    dampingFactor: 0.05,
    minDistance: 5,
    maxDistance: 200,
    maxPolarAngle: Math.PI * 0.48,
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
  },
  firstPerson: {
    position: [0, 2, 0], // Relative to rover
    fov: 90,
    near: 0.1,
    far: 500,
    enableDamping: true,
    dampingFactor: 0.1,
    enablePan: false,
    enableZoom: false,
    enableRotate: true,
  },
  chase: {
    position: [-10, 8, 0], // Behind and above rover
    fov: 60,
    enableDamping: true,
    dampingFactor: 0.08,
    minDistance: 10,
    maxDistance: 50,
    enablePan: false,
    enableZoom: true,
    enableRotate: true,
  },
  overhead: {
    position: [0, 50, 0],
    fov: 50,
    near: 1,
    far: 200,
    enableDamping: true,
    dampingFactor: 0.05,
    minDistance: 20,
    maxDistance: 100,
    enablePan: true,
    enableZoom: true,
    enableRotate: false,
  },
  cinematic: {
    position: [20, 15, 20],
    fov: 45,
    enableDamping: true,
    dampingFactor: 0.02,
    enablePan: false,
    enableZoom: false,
    enableRotate: false,
  },
  custom: {
    position: [30, 30, 30],
    fov: 75,
    enableDamping: true,
    dampingFactor: 0.05,
    enablePan: true,
    enableZoom: true,
    enableRotate: true,
  },
};

// Easing functions for smooth transitions
const easingFunctions = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

/**
 * Individual camera component
 */
const CameraInstance: React.FC<{
  config: CameraConfig;
  target?: React.RefObject<THREE.Object3D>;
  isActive: boolean;
  onUpdate?: (position: THREE.Vector3, rotation: THREE.Euler) => void;
}> = ({ config, target, isActive, onUpdate }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const controlsRef = useRef<CameraControls>(null);
  const { camera: activeCamera, set } = useThree();
  
  // Update active camera when this camera becomes active
  useEffect(() => {
    if (isActive && cameraRef.current && cameraRef.current !== activeCamera) {
      set({ camera: cameraRef.current });
    }
  }, [isActive, activeCamera, set]);
  
  // Update camera based on mode and target
  useFrame((state, delta) => {
    if (!cameraRef.current || !isActive) return;
    
    const camera = cameraRef.current;
    
    // Handle target-following modes
    if (target?.current) {
      const targetPosition = target.current.position;
      const targetRotation = target.current.rotation;
      
      switch (config.mode) {
        case 'firstPerson':
          // Position camera at rover's "head" position
          camera.position.copy(targetPosition);
          camera.position.y += config.position[1]; // Add height offset
          
          // Match rover's rotation
          camera.rotation.copy(targetRotation);
          break;
          
        case 'chase':
          // Follow behind the rover
          const chaseOffset = new Vector3(...config.position);
          chaseOffset.applyEuler(targetRotation);
          camera.position.lerp(
            targetPosition.clone().add(chaseOffset),
            config.dampingFactor
          );
          
          // Look at rover
          camera.lookAt(targetPosition);
          break;
          
        case 'overhead':
          // Stay directly above the rover
          camera.position.x = MathUtils.lerp(
            camera.position.x,
            targetPosition.x,
            config.dampingFactor
          );
          camera.position.z = MathUtils.lerp(
            camera.position.z,
            targetPosition.z,
            config.dampingFactor
          );
          
          // Look down at rover
          camera.lookAt(targetPosition);
          break;
      }
    }
    
    // Auto-rotate for cinematic mode
    if (config.mode === 'cinematic' && config.autoRotate) {
      const rotateSpeed = config.autoRotateSpeed || 0.5;
      camera.position.x = Math.cos(state.clock.elapsedTime * rotateSpeed) * 30;
      camera.position.z = Math.sin(state.clock.elapsedTime * rotateSpeed) * 30;
      camera.lookAt(0, 0, 0);
    }
    
    // Report camera updates
    if (onUpdate) {
      onUpdate(camera.position, camera.rotation);
    }
  });
  
  // Use appropriate camera based on mode
  if (config.mode === 'overhead' && config.fov === 0) {
    // Orthographic camera for true top-down view
    return (
      <OrthographicCamera
        ref={cameraRef as any}
        makeDefault={isActive}
        position={config.position}
        zoom={40}
        near={config.near}
        far={config.far}
      />
    );
  }
  
  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault={isActive}
        position={config.position}
        rotation={config.rotation}
        fov={config.fov}
        near={config.near}
        far={config.far}
      />
      {isActive && config.mode === 'orbit' && (
        <CameraControls
          ref={controlsRef}
          camera={cameraRef.current!}
          enabled={isActive}
          enableDamping={config.enableDamping}
          dampingFactor={config.dampingFactor}
          minDistance={config.minDistance}
          maxDistance={config.maxDistance}
          minPolarAngle={config.minPolarAngle}
          maxPolarAngle={config.maxPolarAngle}
          enablePan={config.enablePan}
          enableZoom={config.enableZoom}
          enableRotate={config.enableRotate}
        />
      )}
    </>
  );
};

/**
 * Main CameraSystem component
 */
export const CameraSystem = forwardRef<CameraSystemRef, CameraSystemProps>(({
  mode = 'orbit',
  target,
  splitScreen = false,
  splitConfig,
  enableShake = false,
  shakeConfig,
  enableCollision = false,
  pointsOfInterest = [],
  onCameraChange,
  cinematicPaths = [],
}, ref) => {
  const [currentMode, setCurrentMode] = useState<CameraMode>(mode);
  const [cameraConfigs, setCameraConfigs] = useState<Record<string, CameraConfig>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cinematicProgress, setCinematicProgress] = useState(0);
  const [activeCinematic, setActiveCinematic] = useState<string | null>(null);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const transitionStartRef = useRef<{
    from: CameraConfig;
    to: CameraConfig;
    startTime: number;
    duration: number;
  } | null>(null);
  
  // Initialize camera configurations
  useEffect(() => {
    const configs: Record<string, CameraConfig> = {};
    
    if (splitScreen && splitConfig) {
      splitConfig.cameras.forEach((cameraMode, index) => {
        configs[`camera-${index}`] = {
          mode: cameraMode,
          ...CAMERA_CONFIGS[cameraMode],
          near: 0.1,
          far: 1000,
        } as CameraConfig;
      });
    } else {
      configs.main = {
        mode: currentMode,
        ...CAMERA_CONFIGS[currentMode],
        near: 0.1,
        far: 1000,
      } as CameraConfig;
    }
    
    setCameraConfigs(configs);
  }, [currentMode, splitScreen, splitConfig]);
  
  // Handle camera transitions
  const transitionToCamera = (newMode: CameraMode, duration: number = 1000) => {
    setIsTransitioning(true);
    const currentConfig = cameraConfigs.main;
    const targetConfig = {
      mode: newMode,
      ...CAMERA_CONFIGS[newMode],
      near: 0.1,
      far: 1000,
    } as CameraConfig;
    
    transitionStartRef.current = {
      from: currentConfig,
      to: targetConfig,
      startTime: Date.now(),
      duration,
    };
    
    setTimeout(() => {
      setCurrentMode(newMode);
      setIsTransitioning(false);
      transitionStartRef.current = null;
    }, duration);
  };
  
  // Handle cinematic paths
  const startCinematicPath = (pathName: string) => {
    const path = cinematicPaths.find(p => p.name === pathName);
    if (!path) return;
    
    setActiveCinematic(pathName);
    setCinematicProgress(0);
  };
  
  // Update cinematic progress
  useFrame((state, delta) => {
    if (activeCinematic) {
      const path = cinematicPaths.find(p => p.name === activeCinematic);
      if (!path) return;
      
      setCinematicProgress(prev => {
        const next = prev + (delta * 1000) / path.duration;
        if (next >= 1) {
          setActiveCinematic(null);
          return 0;
        }
        return next;
      });
    }
    
    // Handle shake decay
    if (shakeIntensity > 0 && shakeConfig?.decay) {
      setShakeIntensity(prev => Math.max(0, prev - (shakeConfig.decayRate || 0.01)));
    }
  });
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    switchCamera: (newMode: CameraMode) => {
      transitionToCamera(newMode);
    },
    focusOn: (position: [number, number, number], duration: number = 1000) => {
      // Implementation for smooth focus transition
      console.log('Focusing on:', position);
    },
    startCinematic: (pathName: string) => {
      startCinematicPath(pathName);
    },
    stopCinematic: () => {
      setActiveCinematic(null);
      setCinematicProgress(0);
    },
    getCameraConfig: () => {
      return cameraConfigs.main || ({} as CameraConfig);
    },
    setCustomPosition: (position: [number, number, number]) => {
      setCameraConfigs(prev => ({
        ...prev,
        main: {
          ...prev.main,
          position,
          mode: 'custom',
        },
      }));
    },
    shake: (intensity: number = 1, duration: number = 500) => {
      setShakeIntensity(intensity);
      if (!shakeConfig?.decay) {
        setTimeout(() => setShakeIntensity(0), duration);
      }
    },
  }), [cameraConfigs, shakeConfig]);
  
  // Handle mode changes from props
  useEffect(() => {
    if (mode !== currentMode && !isTransitioning) {
      transitionToCamera(mode);
    }
  }, [mode, currentMode, isTransitioning]);
  
  // Render split-screen cameras
  if (splitScreen && splitConfig) {
    return (
      <>
        {Object.entries(cameraConfigs).map(([key, config], index) => (
          <CameraInstance
            key={key}
            config={config}
            target={target}
            isActive={true} // All cameras active in split-screen
            onUpdate={(position, rotation) => {
              if (onCameraChange) {
                onCameraChange({ ...config, position: position.toArray() as [number, number, number] });
              }
            }}
          />
        ))}
        {enableShake && shakeIntensity > 0 && (
          <CameraShake
            intensity={shakeIntensity * (shakeConfig?.intensity || 1)}
            decay={shakeConfig?.decay}
            decayRate={shakeConfig?.decayRate}
          />
        )}
      </>
    );
  }
  
  // Render single camera
  return (
    <>
      <CameraInstance
        config={cameraConfigs.main || {} as CameraConfig}
        target={target}
        isActive={true}
        onUpdate={(position, rotation) => {
          if (onCameraChange) {
            onCameraChange({ 
              ...cameraConfigs.main, 
              position: position.toArray() as [number, number, number],
              rotation: rotation.toArray() as [number, number, number],
            });
          }
        }}
      />
      {enableShake && shakeIntensity > 0 && (
        <CameraShake
          intensity={shakeIntensity * (shakeConfig?.intensity || 1)}
          decay={shakeConfig?.decay}
          decayRate={shakeConfig?.decayRate}
        />
      )}
    </>
  );
});

CameraSystem.displayName = 'CameraSystem';

export default CameraSystem;