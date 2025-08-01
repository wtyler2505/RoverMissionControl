/**
 * LODRoverModel Component
 * 
 * Enhanced rover model with automatic LOD switching based on camera distance,
 * screen size, and performance metrics.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DetailedRoverModel, DetailedRoverModelProps } from '../DetailedRoverModel';
import { useLOD, LODLevel } from './LODManager';

export interface LODRoverModelProps extends Omit<DetailedRoverModelProps, 'lod'> {
  /** Force specific LOD level (overrides automatic switching) */
  forceLOD?: LODLevel;
  /** Enable automatic LOD switching */
  autoLOD?: boolean;
  /** Custom LOD distance thresholds */
  lodDistances?: number[];
  /** Minimum screen coverage for high detail (0-1) */
  minScreenCoverage?: number;
  /** Enable debug visualization */
  debugLOD?: boolean;
}

/**
 * Calculate screen space coverage of an object
 */
function calculateScreenCoverage(
  object: THREE.Object3D,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer
): number {
  // Get bounding box
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  
  // Calculate distance to camera
  const distance = camera.position.distanceTo(center);
  
  // Approximate screen coverage based on object size and distance
  const fov = (camera as THREE.PerspectiveCamera).fov || 75;
  const aspectRatio = renderer.domElement.width / renderer.domElement.height;
  const vFov = (fov * Math.PI) / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspectRatio);
  
  // Calculate angular size
  const angularSize = 2 * Math.atan(size.length() / (2 * distance));
  const screenCoverage = Math.min(1, angularSize / Math.min(vFov, hFov));
  
  return screenCoverage;
}

/**
 * LOD-aware Rover Model with automatic quality switching
 */
export function LODRoverModel({
  forceLOD,
  autoLOD = true,
  lodDistances,
  minScreenCoverage = 0.1,
  debugLOD = false,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  ...props
}: LODRoverModelProps) {
  const { camera, gl } = useThree();
  const lod = useLOD();
  const groupRef = useRef<THREE.Group>(null);
  const currentLODRef = useRef<LODLevel>(LODLevel.HIGH);
  const debugTextRef = useRef<THREE.Sprite | null>(null);
  
  // Use custom distances or get from LOD config
  const distances = useMemo(() => {
    return lodDistances || lod.config.models.distances;
  }, [lodDistances, lod.config.models.distances]);
  
  // Create debug visualization
  useEffect(() => {
    if (!debugLOD || !groupRef.current) return;
    
    // Create debug sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 3;
    
    groupRef.current.add(sprite);
    debugTextRef.current = sprite;
    
    return () => {
      if (debugTextRef.current && groupRef.current) {
        groupRef.current.remove(debugTextRef.current);
        texture.dispose();
        spriteMaterial.dispose();
      }
    };
  }, [debugLOD]);
  
  // Update debug text
  const updateDebugText = (lodLevel: LODLevel, distance: number, coverage: number) => {
    if (!debugTextRef.current || !debugLOD) return;
    
    const canvas = debugTextRef.current.material.map.image as HTMLCanvasElement;
    const context = canvas.getContext('2d')!;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white';
    context.font = '20px Arial';
    context.fillText(`LOD: ${LODLevel[lodLevel]}`, 10, 25);
    context.fillText(`Dist: ${distance.toFixed(1)}m`, 10, 45);
    context.fillText(`Coverage: ${(coverage * 100).toFixed(1)}%`, 120, 45);
    
    debugTextRef.current.material.map.needsUpdate = true;
  };
  
  // LOD selection logic
  useFrame(() => {
    if (!groupRef.current || !autoLOD) return;
    
    // Calculate distance from camera
    const worldPosition = new THREE.Vector3();
    groupRef.current.getWorldPosition(worldPosition);
    const distance = camera.position.distanceTo(worldPosition);
    
    // Calculate screen coverage
    const screenCoverage = calculateScreenCoverage(groupRef.current, camera, gl);
    
    // Determine LOD level
    let targetLOD: LODLevel;
    
    if (forceLOD !== undefined) {
      targetLOD = forceLOD;
    } else {
      // Get recommended LOD from manager
      targetLOD = lod.getRecommendedLOD(distance, screenCoverage);
      
      // Apply performance-based adjustments
      if (lod.metrics.fps < lod.targets.minFPS) {
        // Reduce quality if performance is poor
        targetLOD = Math.min(LODLevel.MINIMAL, targetLOD + 1) as LODLevel;
      }
      
      // Apply screen coverage threshold
      if (screenCoverage < minScreenCoverage && targetLOD < LODLevel.LOW) {
        targetLOD = LODLevel.LOW;
      }
    }
    
    // Update LOD if changed
    if (targetLOD !== currentLODRef.current) {
      currentLODRef.current = targetLOD;
    }
    
    // Update debug visualization
    updateDebugText(currentLODRef.current, distance, screenCoverage);
  });
  
  // Register with LOD system
  useEffect(() => {
    if (!groupRef.current) return;
    
    lod.registerObject(groupRef.current, {
      type: 'rover',
      importance: 'high',
      dynamicLOD: autoLOD
    });
    
    return () => {
      if (groupRef.current) {
        lod.unregisterObject(groupRef.current);
      }
    };
  }, [lod, autoLOD]);
  
  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      <DetailedRoverModel
        {...props}
        lod={currentLODRef.current}
      />
      
      {/* Debug bounding box */}
      {debugLOD && (
        <box3Helper args={[new THREE.Box3(), 'yellow']} />
      )}
    </group>
  );
}

/**
 * Multiple LOD Rover Model using Three.js LOD
 */
export function MultiLODRoverModel(props: LODRoverModelProps) {
  const lodRef = useRef<THREE.LOD>(null);
  const lod = useLOD();
  
  const distances = props.lodDistances || lod.config.models.distances;
  
  useEffect(() => {
    if (!lodRef.current) return;
    
    // Register LOD object
    lod.registerObject(lodRef.current, {
      type: 'rover-multi-lod',
      importance: 'high'
    });
    
    return () => {
      if (lodRef.current) {
        lod.unregisterObject(lodRef.current);
      }
    };
  }, [lod]);
  
  return (
    <lod ref={lodRef}>
      {/* Ultra detail */}
      <DetailedRoverModel {...props} lod={LODLevel.ULTRA} />
      
      {/* High detail at 25m */}
      <DetailedRoverModel {...props} lod={LODLevel.HIGH} distance={distances[1]} />
      
      {/* Medium detail at 50m */}
      <DetailedRoverModel {...props} lod={LODLevel.MEDIUM} distance={distances[2]} />
      
      {/* Low detail at 100m */}
      <DetailedRoverModel {...props} lod={LODLevel.LOW} distance={distances[3]} />
      
      {/* Minimal detail at 200m */}
      <DetailedRoverModel {...props} lod={LODLevel.MINIMAL} distance={distances[4]} />
    </lod>
  );
}

export default LODRoverModel;