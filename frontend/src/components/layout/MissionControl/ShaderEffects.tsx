/**
 * ShaderEffects Component
 * 
 * Demonstrates custom shader integration for rover visualization
 * Provides reusable shader-based effects for the 3D scene
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { 
  energyShieldShader, 
  terrainScanShader, 
  signalStrengthShader,
  holographicShader,
  createShaderMaterial,
  updateShaderUniforms
} from './shaders/RoverShaders';

interface EnergyShieldProps {
  position?: [number, number, number];
  scale?: number;
  color?: THREE.Color | string;
  opacity?: number;
  pulseSpeed?: number;
}

/**
 * Energy Shield Effect Component
 */
export function EnergyShield({ 
  position = [0, 0, 0], 
  scale = 1,
  color = '#00ffff',
  opacity = 0.5,
  pulseSpeed = 2
}: EnergyShieldProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const mat = createShaderMaterial(energyShieldShader);
    mat.uniforms.color.value = new THREE.Color(color);
    mat.uniforms.opacity.value = opacity;
    mat.uniforms.pulseSpeed.value = pulseSpeed;
    return mat;
  }, [color, opacity, pulseSpeed]);

  useFrame((state, delta) => {
    if (material) {
      updateShaderUniforms(material, delta);
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={scale}>
      <sphereGeometry args={[3, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

interface TerrainScannerProps {
  scanOrigin?: [number, number, number];
  scanRadius?: number;
  scanSpeed?: number;
  scanColor?: THREE.Color | string;
}

/**
 * Terrain Scanner Effect Component
 */
export function TerrainScanner({
  scanOrigin = [0, 0, 0],
  scanRadius = 50,
  scanSpeed = 10,
  scanColor = '#00ff88'
}: TerrainScannerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const mat = createShaderMaterial(terrainScanShader);
    mat.uniforms.scanOrigin.value = new THREE.Vector3(...scanOrigin);
    mat.uniforms.scanRadius.value = scanRadius;
    mat.uniforms.scanSpeed.value = scanSpeed;
    mat.uniforms.scanColor.value = new THREE.Color(scanColor);
    return mat;
  }, [scanOrigin, scanRadius, scanSpeed, scanColor]);

  useFrame((state, delta) => {
    if (material) {
      updateShaderUniforms(material, delta);
      // Update scan origin to follow rover if needed
      // material.uniforms.scanOrigin.value = roverPosition;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[100, 100, 100, 100]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

interface SignalVisualizerProps {
  position?: [number, number, number];
  signalStrength: number; // 0 to 1
  size?: number;
}

/**
 * Signal Strength Visualizer Component
 */
export function SignalVisualizer({
  position = [0, 5, 0],
  signalStrength,
  size = 5
}: SignalVisualizerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const mat = createShaderMaterial(signalStrengthShader);
    return mat;
  }, []);

  useFrame((state, delta) => {
    if (material) {
      updateShaderUniforms(material, delta);
      material.uniforms.signalStrength.value = signalStrength;
    }
    
    // Make it face the camera
    if (meshRef.current) {
      meshRef.current.lookAt(state.camera.position);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[size, size]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

interface HolographicPanelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  color?: THREE.Color | string;
  glitchIntensity?: number;
}

/**
 * Holographic UI Panel Component
 */
export function HolographicPanel({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 10,
  height = 6,
  color = '#00ccff',
  glitchIntensity = 0.02
}: HolographicPanelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const mat = createShaderMaterial(holographicShader);
    mat.uniforms.color.value = new THREE.Color(color);
    mat.uniforms.glitchIntensity.value = glitchIntensity;
    return mat;
  }, [color, glitchIntensity]);

  useFrame((state, delta) => {
    if (material) {
      updateShaderUniforms(material, delta);
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * Combined shader effects demo
 */
export function ShaderEffectsDemo() {
  return (
    <group>
      {/* Energy shield around rover */}
      <EnergyShield position={[0, 0, 0]} opacity={0.3} />
      
      {/* Terrain scanning effect */}
      <TerrainScanner scanSpeed={5} />
      
      {/* Signal strength indicator */}
      <SignalVisualizer position={[0, 8, 0]} signalStrength={0.85} />
      
      {/* Holographic info panels */}
      <HolographicPanel 
        position={[15, 5, 0]} 
        rotation={[0, -Math.PI / 4, 0]}
        width={8}
        height={5}
      />
    </group>
  );
}

export default ShaderEffectsDemo;