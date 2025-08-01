/**
 * RoverVisualization3D Component
 * 
 * Integrates the Three.js rover visualization into the MainVisualizationPanel.
 * This component bridges the existing Three.js implementation with the Mission Control layout.
 * 
 * Features:
 * - Real-time 3D rover visualization with React Three Fiber
 * - Camera and lighting configuration
 * - Responsive canvas rendering
 * - Performance monitoring integration
 * - Advanced camera controls (OrbitControls)
 * - Shader support for advanced effects
 * - Integration with telemetry data
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Grid, 
  Stats,
  Environment,
  useProgress,
  Html,
  KeyboardControls
} from '@react-three/drei';
import * as THREE from 'three';
// Optional: Postprocessing effects (uncomment when @react-three/postprocessing is installed)
// import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';

// Import performance monitoring
import { PerformanceHUD, usePerformanceLogger } from './PerformanceMonitor';

// Import shader effects
import { EnergyShield, SignalVisualizer } from './ShaderEffects';

// Import physics components
import RoverPhysics, { RoverPhysicsRef, RoverControls, RoverPhysicsState } from './RoverPhysics';
import { PhysicsConfig, defaultPhysicsConfig } from './PhysicsConfig';
import PhysicsControlPanel from './PhysicsControlPanel';
import { DetailedRoverModel, LODRoverModel } from './DetailedRoverModel';

// Import existing visualization components
// import RoverTrajectory3D from '../../Visualization/ThreeD/RoverTrajectory3D';

// RoverPosition type definition (from ThreeD/types.ts)
interface RoverPosition {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  battery: number;
  signalStrength: number;
  status: 'idle' | 'moving' | 'charging' | 'error';
}

// Types
export interface RoverVisualization3DProps {
  /** Current rover position and telemetry data */
  roverData?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    speed: number;
    battery: number;
    signalStrength: number;
    status: 'idle' | 'moving' | 'charging' | 'error';
  };
  /** Historical positions for trajectory */
  trajectoryData?: RoverPosition[];
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
  /** Camera configuration */
  cameraConfig?: {
    position?: [number, number, number];
    fov?: number;
    near?: number;
    far?: number;
  };
  /** Lighting configuration */
  lightingConfig?: {
    ambientIntensity?: number;
    directionalIntensity?: number;
    enableShadows?: boolean;
  };
  /** Callback when 3D scene is ready */
  onSceneReady?: (scene: THREE.Scene) => void;
  /** Callback when physics state updates */
  onPhysicsUpdate?: (state: RoverPhysicsState) => void;
}

/**
 * Loading component
 */
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ 
        color: 'white', 
        fontSize: '14px',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center'
      }}>
        <div>Loading 3D Scene...</div>
        <div style={{ marginTop: '8px' }}>{progress.toFixed(0)}%</div>
      </div>
    </Html>
  );
}

/**
 * Scene component that includes performance logging
 */
function Scene({ children }: { children: React.ReactNode }) {
  // Enable performance logging in development
  if (process.env.NODE_ENV === 'development') {
    usePerformanceLogger();
  }
  
  return <>{children}</>;
}

/**
 * Keyboard control handler for rover
 */
function useRoverControls(): RoverControls {
  const [controls, setControls] = useState<RoverControls>({
    forward: 0,
    turn: 0,
    brake: false,
    boost: false
  });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          setControls(c => ({ ...c, forward: 1 }));
          break;
        case 's':
        case 'arrowdown':
          setControls(c => ({ ...c, forward: -1 }));
          break;
        case 'a':
        case 'arrowleft':
          setControls(c => ({ ...c, turn: -1 }));
          break;
        case 'd':
        case 'arrowright':
          setControls(c => ({ ...c, turn: 1 }));
          break;
        case ' ':
          setControls(c => ({ ...c, brake: true }));
          break;
        case 'shift':
          setControls(c => ({ ...c, boost: true }));
          break;
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
        case 's':
        case 'arrowup':
        case 'arrowdown':
          setControls(c => ({ ...c, forward: 0 }));
          break;
        case 'a':
        case 'd':
        case 'arrowleft':
        case 'arrowright':
          setControls(c => ({ ...c, turn: 0 }));
          break;
        case ' ':
          setControls(c => ({ ...c, brake: false }));
          break;
        case 'shift':
          setControls(c => ({ ...c, boost: false }));
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  return controls;
}

/**
 * Rover 3D Model Component (non-physics version)
 */
function Rover3DModel({ roverData }: { roverData?: RoverVisualization3DProps['roverData'] }) {
  const groupRef = useRef<THREE.Group>(null);
  const [cameraDistance, setCameraDistance] = useState(30);
  
  useEffect(() => {
    if (groupRef.current && roverData) {
      // Update rover position
      groupRef.current.position.set(
        roverData.position.x,
        roverData.position.y,
        roverData.position.z
      );
      
      // Update rover rotation
      groupRef.current.rotation.set(
        roverData.rotation.x,
        roverData.rotation.y,
        roverData.rotation.z
      );
    }
  }, [roverData]);
  
  // Calculate camera distance for LOD
  useFrame(({ camera }) => {
    if (groupRef.current) {
      const distance = camera.position.distanceTo(groupRef.current.position);
      setCameraDistance(distance);
    }
  });
  
  // Use LOD-aware rover model
  return (
    <group ref={groupRef}>
      <LODRoverModel
        cameraDistance={cameraDistance}
        castShadow
        receiveShadow
        materials={{
          body: new THREE.MeshStandardMaterial({
            color: roverData?.status === 'error' ? new THREE.Color('#ff0000') : new THREE.Color('#8B7355'),
            metalness: 0.7,
            roughness: 0.3,
          }),
        }}
      />
      
      {/* Signal indicator above rover */}
      {roverData && (
        <mesh position={[0, 3, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial 
            color={roverData.signalStrength > 70 ? '#00ff00' : 
                   roverData.signalStrength > 30 ? '#ffff00' : '#ff0000'}
            emissive={roverData.signalStrength > 70 ? '#00ff00' : 
                      roverData.signalStrength > 30 ? '#ffff00' : '#ff0000'}
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Terrain Component
 */
function Terrain({ terrainData }: { terrainData?: RoverVisualization3DProps['terrainData'] }) {
  if (!terrainData) {
    // Default grid terrain
    return (
      <Grid 
        args={[100, 100]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor='#6f6f6f' 
        sectionSize={10} 
        sectionThickness={1} 
        sectionColor='#9d4b4b' 
        fadeDistance={100} 
        fadeStrength={1} 
        followCamera={false} 
        infiniteGrid 
      />
    );
  }
  
  // TODO: Implement actual terrain mesh from heightmap
  return null;
}

/**
 * Scene lighting setup
 */
function Lighting({ config }: { config?: RoverVisualization3DProps['lightingConfig'] }) {
  const ambientIntensity = config?.ambientIntensity ?? 0.4;
  const directionalIntensity = config?.directionalIntensity ?? 1;
  const enableShadows = config?.enableShadows ?? true;
  
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight
        position={[50, 50, 25]}
        intensity={directionalIntensity}
        castShadow={enableShadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={0.1}
        shadow-camera-far={200}
      />
      <directionalLight
        position={[-30, 20, -40]}
        intensity={directionalIntensity * 0.3}
        color="#b0d0ff"
      />
    </>
  );
}

/**
 * Main RoverVisualization3D Component
 */
export const RoverVisualization3D: React.FC<RoverVisualization3DProps> = ({
  roverData,
  trajectoryData,
  terrainData,
  showStats = false,
  enableEffects = true,
  enablePhysics = false,
  showPhysicsControls = false,
  physicsConfig = defaultPhysicsConfig,
  enableKeyboardControls = true,
  cameraConfig = {},
  lightingConfig = {},
  onSceneReady,
  onPhysicsUpdate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [currentPhysicsConfig, setCurrentPhysicsConfig] = useState(physicsConfig);
  const roverPhysicsRef = useRef<RoverPhysicsRef>(null);
  const roverControls = useRoverControls();
  const [physicsState, setPhysicsState] = useState<RoverPhysicsState | null>(null);
  
  // Handle responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    // Use ResizeObserver for more accurate updates
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);
  
  // Handle scene ready callback
  const handleCreated = useCallback((state: any) => {
    if (onSceneReady) {
      onSceneReady(state.scene);
    }
    
    // Configure renderer
    state.gl.shadowMap.enabled = lightingConfig.enableShadows ?? true;
    state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    state.gl.toneMapping = THREE.ACESFilmicToneMapping;
    state.gl.toneMappingExposure = 1.2;
  }, [lightingConfig.enableShadows, onSceneReady]);
  
  // Default camera configuration
  const cameraPosition: [number, number, number] = cameraConfig.position || [30, 30, 30];
  const cameraFov = cameraConfig.fov || 75;
  const cameraNear = cameraConfig.near || 0.1;
  const cameraFar = cameraConfig.far || 1000;
  
  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%', position: 'relative' }}
      role="img"
      aria-label="3D visualization of Mars rover"
    >
      <Canvas
        shadows
        dpr={window.devicePixelRatio}
        onCreated={handleCreated}
        style={{ background: '#000000' }}
        performance={{
          min: 0.5, // Minimum quality when performance is poor
          max: 1.0, // Maximum quality
          debounce: 200 // Debounce resize in ms
        }}
      >
        <Suspense fallback={<Loader />}>
          <Scene>
          {/* Camera */}
          <PerspectiveCamera
            makeDefault
            position={cameraPosition}
            fov={cameraFov}
            near={cameraNear}
            far={cameraFar}
          />
          
          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            zoomSpeed={0.8}
            panSpeed={0.5}
            rotateSpeed={0.5}
            minDistance={5}
            maxDistance={200}
            maxPolarAngle={Math.PI * 0.48}
          />
          
          {/* Lighting */}
          <Lighting config={lightingConfig} />
          
          {/* Environment (for reflections) */}
          <Environment preset="sunset" background={false} />
          
          {/* Terrain */}
          <Terrain terrainData={terrainData} />
          
          {/* Rover model - use physics or simple based on enablePhysics */}
          {enablePhysics ? (
            <RoverPhysics
              ref={roverPhysicsRef}
              config={currentPhysicsConfig}
              position={roverData ? [roverData.position.x, roverData.position.y, roverData.position.z] : undefined}
              rotation={roverData ? [roverData.rotation.x, roverData.rotation.y, roverData.rotation.z] : undefined}
              controls={enableKeyboardControls ? roverControls : undefined}
              onPhysicsUpdate={(state) => {
                setPhysicsState(state);
                if (onPhysicsUpdate) {
                  onPhysicsUpdate(state);
                }
              }}
              debug={showStats}
            />
          ) : (
            <Rover3DModel roverData={roverData} />
          )}
          
          {/* Shader effects */}
          {roverData && (
            <>
              {/* Energy shield effect when battery is low */}
              {roverData.battery < 30 && (
                <EnergyShield 
                  position={[roverData.position.x, roverData.position.y, roverData.position.z]}
                  color="#ff0000"
                  opacity={0.6}
                  pulseSpeed={4}
                />
              )}
              
              {/* Signal strength visualizer */}
              <SignalVisualizer
                position={[
                  roverData.position.x, 
                  roverData.position.y + 5, 
                  roverData.position.z
                ]}
                signalStrength={roverData.signalStrength / 100}
                size={3}
              />
            </>
          )}
          
          {/* Trajectory visualization */}
          {trajectoryData && trajectoryData.length > 0 && (
            <group>
              {/* Simple trajectory line */}
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={trajectoryData.length}
                    array={new Float32Array(
                      trajectoryData.flatMap(p => [p.x, p.y, p.z])
                    )}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color="#00ff00" linewidth={2} />
              </line>
            </group>
          )}
          
          {/* Post-processing effects (uncomment when @react-three/postprocessing is installed) */}
          {/* {enableEffects && (
            <EffectComposer>
              <Bloom 
                luminanceThreshold={0.8} 
                luminanceSmoothing={0.9} 
                intensity={0.5} 
              />
              <DepthOfField 
                focusDistance={0.01} 
                focalLength={0.05} 
                bokehScale={2} 
              />
            </EffectComposer>
          )} */}
          
          {/* Performance stats */}
          {showStats && <Stats showPanel={0} className="stats-panel" />}
          </Scene>
        </Suspense>
      </Canvas>
      
      {/* Enhanced performance HUD */}
      {showStats && <PerformanceHUD position="top-left" />}
      
      {/* Physics Control Panel */}
      {showPhysicsControls && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 350,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}
        >
          <PhysicsControlPanel
            config={currentPhysicsConfig}
            onConfigChange={setCurrentPhysicsConfig}
            onReset={() => {
              setCurrentPhysicsConfig(defaultPhysicsConfig);
              if (roverPhysicsRef.current) {
                roverPhysicsRef.current.reset();
              }
            }}
          />
        </div>
      )}
      
      {/* HUD overlay for rover status */}
      {(roverData || physicsState) && (
        <div 
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 15px',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: '12px',
            pointerEvents: 'none'
          }}
          aria-live="polite"
          aria-label="Rover status"
        >
          {physicsState ? (
            <>
              <div>Speed: {physicsState.speed.toFixed(1)} m/s</div>
              <div>Position: ({physicsState.position.x.toFixed(1)}, 
                {physicsState.position.y.toFixed(1)}, 
                {physicsState.position.z.toFixed(1)})</div>
              <div>Heading: {(physicsState.heading * 180 / Math.PI).toFixed(0)}°</div>
              <div>Ground Contacts: {physicsState.groundContacts.filter(c => c).length}/6</div>
            </>
          ) : roverData ? (
            <>
              <div>Status: <span style={{ color: getStatusColor(roverData.status) }}>
                {roverData.status.toUpperCase()}
              </span></div>
              <div>Speed: {roverData.speed.toFixed(1)} m/s</div>
              <div>Battery: {roverData.battery}%</div>
              <div>Signal: {roverData.signalStrength}%</div>
              <div>Position: ({roverData.position.x.toFixed(1)}, 
                {roverData.position.y.toFixed(1)}, 
                {roverData.position.z.toFixed(1)})</div>
            </>
          ) : null}
        </div>
      )}
      
      {/* Keyboard controls help */}
      {enablePhysics && enableKeyboardControls && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '10px 15px',
            borderRadius: 4,
            fontFamily: 'monospace',
            fontSize: '11px',
            pointerEvents: 'none'
          }}
        >
          <div style={{ marginBottom: 4, fontWeight: 'bold' }}>Controls:</div>
          <div>W/↑ - Forward</div>
          <div>S/↓ - Backward</div>
          <div>A/← - Turn Left</div>
          <div>D/→ - Turn Right</div>
          <div>Space - Brake</div>
          <div>Shift - Boost</div>
        </div>
      )}
    </div>
  );
};

// Helper function to get status color
function getStatusColor(status: string): string {
  switch (status) {
    case 'idle': return '#ffeb3b';
    case 'moving': return '#4caf50';
    case 'charging': return '#2196f3';
    case 'error': return '#f44336';
    default: return '#9e9e9e';
  }
}

export default RoverVisualization3D;