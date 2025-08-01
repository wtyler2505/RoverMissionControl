/**
 * RoverVisualization3D with LOD Integration
 * 
 * Enhanced version of RoverVisualization3D that integrates the comprehensive
 * LOD optimization system for improved performance and scalability.
 * 
 * @author Mission Control Team
 * @version 2.0.0
 */

import React, { useRef, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Grid, 
  Stats,
  Environment,
  Html,
  KeyboardControls
} from '@react-three/drei';
import * as THREE from 'three';

// Import LOD system components
import { 
  LODProvider, 
  LODRoverModel, 
  LODTerrain, 
  LODEffects,
  LODIndicator,
  useLOD,
  LODLevel
} from './LODSystem';

// Import existing components
import { PerformanceHUD, usePerformanceLogger } from './PerformanceMonitor';
import { EnergyShield, SignalVisualizer } from './ShaderEffects';
import RoverPhysics, { RoverPhysicsRef } from './RoverPhysics';
import { PhysicsConfig, defaultPhysicsConfig } from './PhysicsConfig';
import PhysicsControlPanel from './PhysicsControlPanel';

// Types
export interface RoverVisualization3DLODProps {
  /** Current rover position and telemetry data */
  roverData?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    speed: number;
    battery: number;
    signalStrength: number;
    status: 'idle' | 'moving' | 'charging' | 'error';
    wheelRotations?: number[];
    steeringAngles?: number[];
  };
  /** Historical positions for trajectory */
  trajectoryData?: Array<{
    timestamp: number;
    x: number;
    y: number;
    z: number;
    heading: number;
  }>;
  /** Terrain heightmap data */
  terrainData?: {
    heightMap: number[][];
    width: number;
    height: number;
    textureUrl?: string;
  };
  /** Show performance stats */
  showStats?: boolean;
  /** Enable post-processing effects */
  enableEffects?: boolean;
  /** Enable physics simulation */
  enablePhysics?: boolean;
  /** Show physics control panel */
  showPhysicsControls?: boolean;
  /** Physics configuration */
  physicsConfig?: PhysicsConfig;
  /** Enable keyboard controls */
  enableKeyboardControls?: boolean;
  /** LOD quality preset */
  lodPreset?: 'ultra' | 'high' | 'medium' | 'low' | 'adaptive';
  /** Performance targets */
  performanceTargets?: {
    targetFPS?: number;
    minFPS?: number;
    maxMemoryMB?: number;
    maxDrawCalls?: number;
  };
  /** Show LOD debug info */
  debugLOD?: boolean;
  /** Enable LOD indicators */
  showLODIndicator?: boolean;
  /** Callback for performance metrics */
  onPerformanceUpdate?: (metrics: any) => void;
}

// Keyboard control map
const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
  { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
  { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
  { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
  { name: 'boost', keys: ['Shift'] },
  { name: 'brake', keys: [' '] }
];

/**
 * Loading component
 */
function LoadingFallback() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ 
        color: 'white', 
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px',
        background: 'rgba(0,0,0,0.8)',
        borderRadius: '8px'
      }}>
        <div>Loading 3D Scene...</div>
        <div style={{ marginTop: '10px' }}>{progress.toFixed(0)}%</div>
      </div>
    </Html>
  );
}

/**
 * Enhanced 3D Scene with LOD
 */
function LODScene({ 
  roverData,
  trajectoryData,
  terrainData,
  enableEffects,
  enablePhysics,
  physicsConfig,
  debugLOD
}: RoverVisualization3DLODProps) {
  const physicsRef = useRef<RoverPhysicsRef>(null);
  const lod = useLOD();
  
  // Physics state
  const [physicsState, setPhysicsState] = useState<any>(null);
  
  // Update physics state
  useFrame(() => {
    if (enablePhysics && physicsRef.current) {
      const state = physicsRef.current.getState();
      setPhysicsState(state);
    }
  });
  
  // Adaptive lighting based on LOD
  const lightingQuality = lod.config.effects.level;
  
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={lightingQuality <= LODLevel.MEDIUM ? 0.4 : 0.3} />
      
      {/* Main directional light (sun) */}
      <directionalLight
        position={[50, 50, 25]}
        intensity={1}
        castShadow={lightingQuality <= LODLevel.HIGH}
        shadow-mapSize={lightingQuality === LODLevel.ULTRA ? [4096, 4096] : [2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
      />
      
      {/* Secondary fill light */}
      {lightingQuality <= LODLevel.HIGH && (
        <directionalLight
          position={[-30, 20, -30]}
          intensity={0.3}
          color="#88ccff"
        />
      )}
      
      {/* Environment lighting for high quality */}
      {lightingQuality === LODLevel.ULTRA && (
        <Environment preset="sunset" background={false} />
      )}
      
      {/* Rover with physics or static */}
      {enablePhysics ? (
        <RoverPhysics
          ref={physicsRef}
          config={physicsConfig || defaultPhysicsConfig}
          initialPosition={roverData?.position ? 
            [roverData.position.x, roverData.position.y, roverData.position.z] : 
            [0, 1, 0]
          }
          debug={debugLOD}
        />
      ) : (
        <LODRoverModel
          position={roverData?.position ? 
            [roverData.position.x, roverData.position.y, roverData.position.z] : 
            [0, 0.5, 0]
          }
          rotation={roverData?.rotation ? 
            [roverData.rotation.x, roverData.rotation.y, roverData.rotation.z] : 
            [0, 0, 0]
          }
          autoLOD={true}
          debugLOD={debugLOD}
          animationState={{
            wheelRotations: roverData?.wheelRotations,
            steeringAngles: roverData?.steeringAngles
          }}
        />
      )}
      
      {/* Terrain with LOD */}
      {terrainData ? (
        <LODTerrain
          heightMap={terrainData.heightMap}
          size={{ width: terrainData.width, depth: terrainData.height }}
          maxHeight={10}
          chunkSize={32}
          maxViewDistance={200}
        />
      ) : (
        <LODTerrain
          size={{ width: 200, depth: 200 }}
          maxHeight={5}
          chunkSize={25}
          maxViewDistance={150}
        />
      )}
      
      {/* LOD Effects */}
      {enableEffects && (
        <LODEffects
          particles={true}
          glow={roverData?.status === 'charging'}
          atmosphere={true}
          dust={roverData?.speed ? roverData.speed > 0.5 : false}
          baseParticleCount={2000}
          color={roverData?.status === 'error' ? '#ff0000' : '#00ff88'}
          intensity={roverData?.battery ? roverData.battery / 100 : 1}
        />
      )}
      
      {/* Trajectory visualization */}
      {trajectoryData && trajectoryData.length > 1 && (
        <TrajectoryPath data={trajectoryData} />
      )}
      
      {/* Shader effects based on rover state */}
      {roverData && (
        <>
          {roverData.battery < 30 && physicsState && (
            <EnergyShield 
              position={physicsState.position}
              radius={2}
              color="#ff0000"
              intensity={0.5 + Math.sin(Date.now() * 0.01) * 0.5}
            />
          )}
          
          {roverData.signalStrength < 50 && (
            <SignalVisualizer
              position={roverData.position}
              strength={roverData.signalStrength}
              maxRadius={20}
            />
          )}
        </>
      )}
      
      {/* Performance logger */}
      <PerformanceLogger />
    </>
  );
}

/**
 * Trajectory path visualization
 */
function TrajectoryPath({ data }: { data: any[] }) {
  const lod = useLOD();
  
  // Simplify trajectory based on LOD
  const simplifiedData = React.useMemo(() => {
    const step = Math.max(1, Math.floor(data.length / (100 / (lod.config.models.level + 1))));
    return data.filter((_, index) => index % step === 0);
  }, [data, lod.config.models.level]);
  
  const points = React.useMemo(() => {
    return simplifiedData.map(pos => new THREE.Vector3(pos.x, 0.1, pos.z));
  }, [simplifiedData]);
  
  const geometry = React.useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);
  
  return (
    <line geometry={geometry}>
      <lineBasicMaterial 
        color="#00ff00" 
        opacity={0.6} 
        transparent 
        linewidth={1}
      />
    </line>
  );
}

/**
 * Performance logger component
 */
function PerformanceLogger() {
  const lod = useLOD();
  usePerformanceLogger(16.67); // 60 FPS target
  
  useFrame(() => {
    // Log critical performance issues
    if (lod.metrics.fps < lod.targets.minFPS) {
      console.warn(`Low FPS detected: ${lod.metrics.fps}`);
    }
  });
  
  return null;
}

/**
 * Main RoverVisualization3D Component with LOD
 */
export function RoverVisualization3DLOD({
  roverData,
  trajectoryData,
  terrainData,
  showStats = false,
  enableEffects = true,
  enablePhysics = false,
  showPhysicsControls = false,
  physicsConfig,
  enableKeyboardControls = true,
  lodPreset = 'adaptive',
  performanceTargets = {},
  debugLOD = false,
  showLODIndicator = true,
  onPerformanceUpdate
}: RoverVisualization3DLODProps) {
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(showPhysicsControls);
  
  // Performance targets with defaults
  const targets = {
    targetFPS: 60,
    minFPS: 30,
    maxMemoryMB: 512,
    maxDrawCalls: 1000,
    ...performanceTargets
  };
  
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <KeyboardControls map={enableKeyboardControls ? keyboardMap : []}>
        <Canvas
          shadows={lodPreset !== 'low'}
          camera={{
            position: [15, 10, 15],
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          gl={{
            antialias: lodPreset === 'ultra' || lodPreset === 'high',
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
          }}
          dpr={[1, lodPreset === 'ultra' ? 2 : 1]} // Pixel ratio based on quality
        >
          <LODProvider
            initialPreset={lodPreset}
            performanceTargets={targets}
            onMetricsUpdate={onPerformanceUpdate}
          >
            <Suspense fallback={<LoadingFallback />}>
              <LODScene
                roverData={roverData}
                trajectoryData={trajectoryData}
                terrainData={terrainData}
                enableEffects={enableEffects}
                enablePhysics={enablePhysics}
                physicsConfig={physicsConfig}
                debugLOD={debugLOD}
              />
            </Suspense>
            
            {/* Camera controls */}
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              zoomSpeed={0.5}
              panSpeed={0.5}
              rotateSpeed={0.5}
              minDistance={5}
              maxDistance={200}
              minPolarAngle={0.1}
              maxPolarAngle={Math.PI * 0.45}
              makeDefault
            />
            
            {/* Performance HUD */}
            {showStats && <PerformanceHUD position="top-left" />}
            
            {/* Three.js Stats */}
            {showStats && <Stats showPanel={0} className="stats-panel" />}
          </LODProvider>
        </Canvas>
      </KeyboardControls>
      
      {/* LOD Indicator overlay */}
      {showLODIndicator && <LODIndicator />}
      
      {/* Physics control panel */}
      {enablePhysics && showPhysicsPanel && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 100
        }}>
          <PhysicsControlPanel
            config={physicsConfig || defaultPhysicsConfig}
            onConfigChange={() => {}}
            onClose={() => setShowPhysicsPanel(false)}
          />
        </div>
      )}
    </div>
  );
}

export default RoverVisualization3DLOD;