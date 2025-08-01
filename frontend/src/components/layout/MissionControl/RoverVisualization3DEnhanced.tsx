/**
 * RoverVisualization3DEnhanced Component
 * 
 * Enhanced version of RoverVisualization3D that integrates the advanced camera system.
 * This shows how to upgrade the existing visualization with the new camera features.
 * 
 * @author Mission Control Team
 * @version 2.0.0
 */

import React, { useRef, useEffect, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  Grid, 
  Stats,
  Environment,
  useProgress,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';
import styled from '@emotion/styled';

// Import camera system components
import CameraSystem, { CameraMode, CameraSystemRef } from './CameraSystem';
import CameraController from './CameraController';
import CameraControlPanel from './CameraControlPanel';

// Import existing components
import { PerformanceHUD, usePerformanceLogger } from './PerformanceMonitor';
import { EnergyShield, SignalVisualizer } from './ShaderEffects';
import RoverPhysics, { RoverPhysicsRef, RoverControls, RoverPhysicsState } from './RoverPhysics';
import { PhysicsConfig, defaultPhysicsConfig } from './PhysicsConfig';
import PhysicsControlPanel from './PhysicsControlPanel';
import { DetailedRoverModel, LODRoverModel } from './DetailedRoverModel';

// Styled components
const VisualizationContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
`;

const CameraControlsOverlay = styled.div<{ position: 'left' | 'right' }>`
  position: absolute;
  top: 20px;
  ${props => props.position}: 20px;
  z-index: 100;
`;

const StatusOverlay = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 15px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  pointer-events: none;
`;

const CameraModeIndicator = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  transition: opacity 0.3s ease;
`;

// Types
export interface RoverVisualization3DEnhancedProps {
  /** Current rover position and telemetry data */
  roverData?: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    speed: number;
    battery: number;
    signalStrength: number;
    status: 'idle' | 'moving' | 'charging' | 'error';
  };
  /** Show camera controls */
  showCameraControls?: boolean;
  /** Camera control panel position */
  cameraControlsPosition?: 'left' | 'right';
  /** Enable advanced camera features */
  enableAdvancedCamera?: boolean;
  /** Enable cinematic mode */
  enableCinematicMode?: boolean;
  /** Points of interest for camera focus */
  pointsOfInterest?: Array<{
    id: string;
    name: string;
    position: [number, number, number];
    type: 'sample' | 'hazard' | 'waypoint' | 'target';
  }>;
  /** Show performance stats */
  showStats?: boolean;
  /** Enable physics simulation */
  enablePhysics?: boolean;
  /** Show physics controls */
  showPhysicsControls?: boolean;
  /** Physics configuration */
  physicsConfig?: PhysicsConfig;
  /** Callback when camera mode changes */
  onCameraModeChange?: (mode: CameraMode) => void;
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
        <div>Loading Enhanced 3D Scene...</div>
        <div style={{ marginTop: '8px' }}>{progress.toFixed(0)}%</div>
      </div>
    </Html>
  );
}

/**
 * Scene component that includes performance logging
 */
function Scene({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'development') {
    usePerformanceLogger();
  }
  return <>{children}</>;
}

/**
 * Enhanced Rover Model with camera target
 */
const EnhancedRoverModel: React.FC<{
  roverData?: RoverVisualization3DEnhancedProps['roverData'];
  targetRef?: React.RefObject<THREE.Object3D>;
}> = ({ roverData, targetRef }) => {
  const groupRef = useRef<THREE.Group>(null);
  const [cameraDistance, setCameraDistance] = useState(30);
  
  useEffect(() => {
    if (groupRef.current && roverData) {
      groupRef.current.position.set(
        roverData.position.x,
        roverData.position.y,
        roverData.position.z
      );
      
      groupRef.current.rotation.set(
        roverData.rotation.x,
        roverData.rotation.y,
        roverData.rotation.z
      );
    }
  }, [roverData]);
  
  useFrame(({ camera }) => {
    if (groupRef.current) {
      const distance = camera.position.distanceTo(groupRef.current.position);
      setCameraDistance(distance);
    }
  });
  
  return (
    <group ref={targetRef || groupRef}>
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
      
      {/* Signal indicator */}
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
};

/**
 * Points of Interest Visualization
 */
const PointsOfInterestMarkers: React.FC<{
  points?: RoverVisualization3DEnhancedProps['pointsOfInterest'];
}> = ({ points = [] }) => {
  const markerColors = {
    sample: '#4ecdc4',
    hazard: '#ff6b6b',
    waypoint: '#45b7d1',
    target: '#f7b731',
  };
  
  return (
    <>
      {points.map((poi) => (
        <group key={poi.id} position={poi.position}>
          {/* Marker pole */}
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
            <meshStandardMaterial 
              color={markerColors[poi.type]} 
              emissive={markerColors[poi.type]}
              emissiveIntensity={0.3}
            />
          </mesh>
          
          {/* Marker flag */}
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[1, 0.8, 0.1]} />
            <meshStandardMaterial 
              color={markerColors[poi.type]}
              emissive={markerColors[poi.type]}
              emissiveIntensity={0.5}
            />
          </mesh>
          
          {/* Ground indicator */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.5, 2, 32]} />
            <meshBasicMaterial 
              color={markerColors[poi.type]}
              opacity={0.3}
              transparent
            />
          </mesh>
        </group>
      ))}
    </>
  );
};

/**
 * Main Enhanced RoverVisualization3D Component
 */
export const RoverVisualization3DEnhanced: React.FC<RoverVisualization3DEnhancedProps> = ({
  roverData,
  showCameraControls = true,
  cameraControlsPosition = 'right',
  enableAdvancedCamera = true,
  enableCinematicMode = true,
  pointsOfInterest = [],
  showStats = false,
  enablePhysics = false,
  showPhysicsControls = false,
  physicsConfig = defaultPhysicsConfig,
  onCameraModeChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraSystemRef = useRef<CameraSystemRef>(null);
  const roverTargetRef = useRef<THREE.Object3D>(null);
  
  const [currentCameraMode, setCurrentCameraMode] = useState<CameraMode>('orbit');
  const [showCameraModeIndicator, setShowCameraModeIndicator] = useState(false);
  const [savedPresets, setSavedPresets] = useState<Array<any>>([]);
  const [savedPaths, setSavedPaths] = useState<Array<any>>([]);
  
  // Convert points of interest to camera system format
  const cameraPointsOfInterest = pointsOfInterest.map(poi => ({
    id: poi.id,
    position: new THREE.Vector3(...poi.position),
    priority: poi.type === 'target' ? 1 : poi.type === 'hazard' ? 0.8 : 0.5,
    radius: 5,
  }));
  
  // Predefined cinematic paths
  const cinematicPaths = enableCinematicMode ? [
    {
      id: 'mission-overview',
      name: 'Mission Overview',
      points: [
        { position: new THREE.Vector3(40, 30, 40), duration: 3000 },
        { position: new THREE.Vector3(-40, 35, 40), duration: 3000 },
        { position: new THREE.Vector3(-40, 30, -40), duration: 3000 },
        { position: new THREE.Vector3(40, 35, -40), duration: 3000 },
      ],
      loop: true,
      smoothing: 0.8,
    },
    {
      id: 'rover-inspection',
      name: 'Rover Inspection',
      points: [
        { position: new THREE.Vector3(5, 2, 5), fov: 60, duration: 2000 },
        { position: new THREE.Vector3(-5, 3, 5), fov: 50, duration: 2000 },
        { position: new THREE.Vector3(-5, 2, -5), fov: 60, duration: 2000 },
        { position: new THREE.Vector3(5, 3, -5), fov: 50, duration: 2000 },
      ],
      loop: true,
      smoothing: 0.9,
    },
  ] : [];
  
  // Handle camera mode change
  const handleCameraModeChange = useCallback((mode: CameraMode) => {
    setCurrentCameraMode(mode);
    setShowCameraModeIndicator(true);
    setTimeout(() => setShowCameraModeIndicator(false), 2000);
    
    if (onCameraModeChange) {
      onCameraModeChange(mode);
    }
  }, [onCameraModeChange]);
  
  // Keyboard shortcuts for camera modes
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!enableAdvancedCamera) return;
      
      switch (e.key) {
        case '1':
          handleCameraModeChange('orbit');
          break;
        case '2':
          handleCameraModeChange('firstPerson');
          break;
        case '3':
          handleCameraModeChange('chase');
          break;
        case '4':
          handleCameraModeChange('overhead');
          break;
        case '5':
          handleCameraModeChange('cinematic');
          break;
        case ' ':
          // Trigger camera shake
          if (e.shiftKey && cameraSystemRef.current) {
            cameraSystemRef.current.shake(1, 500);
          }
          break;
      }
    };
    
    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [enableAdvancedCamera, handleCameraModeChange]);
  
  return (
    <VisualizationContainer ref={containerRef}>
      <Canvas
        shadows
        dpr={window.devicePixelRatio}
        style={{ background: '#000000' }}
        onCreated={(state) => {
          state.gl.shadowMap.enabled = true;
          state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
          state.gl.toneMapping = THREE.ACESFilmicToneMapping;
          state.gl.toneMappingExposure = 1.2;
        }}
      >
        <Suspense fallback={<Loader />}>
          <Scene>
            {/* Enhanced Camera System */}
            {enableAdvancedCamera ? (
              <>
                <CameraSystem
                  ref={cameraSystemRef}
                  mode={currentCameraMode}
                  target={roverTargetRef}
                  enableShake={true}
                  shakeConfig={{
                    intensity: 1,
                    decay: true,
                    decayRate: 0.05,
                  }}
                  enableCollision={true}
                  pointsOfInterest={cameraPointsOfInterest}
                  cinematicPaths={cinematicPaths}
                />
                
                <CameraController
                  enableTransitions={true}
                  collisionConfig={{
                    enabled: true,
                    offset: 2,
                  }}
                  autoFocusConfig={{
                    enabled: true,
                    speed: 0.05,
                    threshold: 30,
                    priorityWeights: {
                      distance: 0.5,
                      priority: 0.3,
                      visibility: 0.2,
                    },
                  }}
                  pointsOfInterest={cameraPointsOfInterest}
                  paths={[...cinematicPaths, ...savedPaths]}
                />
              </>
            ) : (
              // Fallback to simple camera
              <CameraSystem
                mode="orbit"
                enableShake={false}
                enableCollision={false}
              />
            )}
            
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[50, 50, 25]}
              intensity={1}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-left={-50}
              shadow-camera-right={50}
              shadow-camera-top={50}
              shadow-camera-bottom={-50}
            />
            <directionalLight
              position={[-30, 20, -40]}
              intensity={0.3}
              color="#b0d0ff"
            />
            
            {/* Environment */}
            <Environment preset="sunset" background={false} />
            
            {/* Terrain */}
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
            
            {/* Rover model */}
            {enablePhysics ? (
              <RoverPhysics
                config={physicsConfig}
                position={roverData ? [roverData.position.x, roverData.position.y, roverData.position.z] : undefined}
                rotation={roverData ? [roverData.rotation.x, roverData.rotation.y, roverData.rotation.z] : undefined}
                debug={showStats}
              />
            ) : (
              <EnhancedRoverModel roverData={roverData} targetRef={roverTargetRef} />
            )}
            
            {/* Points of Interest */}
            <PointsOfInterestMarkers points={pointsOfInterest} />
            
            {/* Shader effects */}
            {roverData && (
              <>
                {roverData.battery < 30 && (
                  <EnergyShield 
                    position={[roverData.position.x, roverData.position.y, roverData.position.z]}
                    color="#ff0000"
                    opacity={0.6}
                    pulseSpeed={4}
                  />
                )}
                
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
            
            {/* Performance stats */}
            {showStats && <Stats showPanel={0} className="stats-panel" />}
          </Scene>
        </Suspense>
      </Canvas>
      
      {/* Camera Controls Panel */}
      {showCameraControls && enableAdvancedCamera && (
        <CameraControlsOverlay position={cameraControlsPosition}>
          <CameraControlPanel
            cameraSystemRef={cameraSystemRef}
            currentMode={currentCameraMode}
            presets={savedPresets}
            savedPaths={savedPaths}
            enableSplitScreen={true}
            enablePiP={true}
            onModeChange={handleCameraModeChange}
            onPresetSave={(name, config) => {
              setSavedPresets(prev => [...prev, { id: Date.now().toString(), name, config }]);
            }}
            onPresetLoad={(id) => {
              const preset = savedPresets.find(p => p.id === id);
              if (preset && preset.config.mode) {
                handleCameraModeChange(preset.config.mode);
              }
            }}
            onPresetDelete={(id) => {
              setSavedPresets(prev => prev.filter(p => p.id !== id));
            }}
            onPathRecordStart={() => {
              // Start recording implementation
            }}
            onPathRecordStop={() => {
              // Stop recording and save path
              const newPath = {
                id: Date.now().toString(),
                name: `Path ${savedPaths.length + 1}`,
                points: [],
                loop: false,
                smoothing: 0.5,
              };
              setSavedPaths(prev => [...prev, newPath]);
              return newPath;
            }}
            onPathPlay={(pathId) => {
              // Play path implementation
            }}
            onPathDelete={(pathId) => {
              setSavedPaths(prev => prev.filter(p => p.id !== pathId));
            }}
          />
        </CameraControlsOverlay>
      )}
      
      {/* Physics Control Panel */}
      {showPhysicsControls && enablePhysics && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: cameraControlsPosition === 'right' ? 20 : undefined,
            right: cameraControlsPosition === 'left' ? 20 : undefined,
            width: 350,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}
        >
          <PhysicsControlPanel
            config={physicsConfig}
            onConfigChange={() => {}}
            onReset={() => {}}
          />
        </div>
      )}
      
      {/* Status Overlay */}
      {roverData && (
        <StatusOverlay>
          <div>Status: <span style={{ color: getStatusColor(roverData.status) }}>
            {roverData.status.toUpperCase()}
          </span></div>
          <div>Speed: {roverData.speed.toFixed(1)} m/s</div>
          <div>Battery: {roverData.battery}%</div>
          <div>Signal: {roverData.signalStrength}%</div>
          <div>Position: ({roverData.position.x.toFixed(1)}, 
            {roverData.position.y.toFixed(1)}, 
            {roverData.position.z.toFixed(1)})</div>
          <div>Camera: <strong>{currentCameraMode}</strong></div>
        </StatusOverlay>
      )}
      
      {/* Camera Mode Indicator */}
      {showCameraModeIndicator && (
        <CameraModeIndicator>
          Camera: {currentCameraMode.charAt(0).toUpperCase() + currentCameraMode.slice(1)}
        </CameraModeIndicator>
      )}
      
      {/* Performance HUD */}
      {showStats && <PerformanceHUD position="top-left" />}
    </VisualizationContainer>
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

export default RoverVisualization3DEnhanced;