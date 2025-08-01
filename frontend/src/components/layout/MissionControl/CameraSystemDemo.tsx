/**
 * CameraSystemDemo Component
 * 
 * Demonstration of the integrated camera system with all features.
 * Shows how to use CameraSystem, CameraController, and CameraControlPanel
 * together in a complete implementation.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Environment, Stats } from '@react-three/drei';
import * as THREE from 'three';
import styled from '@emotion/styled';
import { message } from 'antd';

// Import camera components
import CameraSystem, { CameraMode, CameraConfig, CameraSystemRef } from './CameraSystem';
import CameraController, { CameraPath, Easings } from './CameraController';
import CameraControlPanel from './CameraControlPanel';

// Import rover components
import { LODRoverModel } from './DetailedRoverModel';

// Styled components
const DemoContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100vh;
  background: #000;
`;

const CanvasContainer = styled.div`
  flex: 1;
  position: relative;
`;

const ControlsContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 10;
`;

const InfoOverlay = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px;
  border-radius: 8px;
  font-family: monospace;
  font-size: 12px;
  max-width: 300px;
`;

const PiPContainer = styled.div<{ position: string; enabled: boolean }>`
  position: absolute;
  width: 320px;
  height: 180px;
  background: #000;
  border: 2px solid #fff;
  border-radius: 8px;
  overflow: hidden;
  display: ${props => props.enabled ? 'block' : 'none'};
  ${props => {
    switch (props.position) {
      case 'top-left':
        return 'top: 20px; left: 20px;';
      case 'top-right':
        return 'top: 20px; right: 370px;';
      case 'bottom-left':
        return 'bottom: 20px; left: 20px;';
      case 'bottom-right':
        return 'bottom: 20px; right: 370px;';
      default:
        return 'bottom: 20px; right: 370px;';
    }
  }}
`;

const KeyboardHint = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
`;

// Demo rover component with movement
const DemoRover: React.FC<{ onPositionUpdate?: (position: THREE.Vector3) => void }> = ({ onPositionUpdate }) => {
  const roverRef = useRef<THREE.Group>(null);
  const [cameraDistance, setCameraDistance] = useState(30);
  
  // Animate rover movement in a figure-8 pattern
  React.useEffect(() => {
    const animate = () => {
      if (roverRef.current) {
        const time = Date.now() * 0.0005;
        const x = Math.sin(time) * 20;
        const z = Math.sin(time * 2) * 10;
        
        roverRef.current.position.x = x;
        roverRef.current.position.z = z;
        roverRef.current.rotation.y = Math.atan2(
          Math.cos(time) * 20,
          Math.cos(time * 2) * 20
        );
        
        if (onPositionUpdate) {
          onPositionUpdate(roverRef.current.position);
        }
      }
      requestAnimationFrame(animate);
    };
    
    animate();
  }, [onPositionUpdate]);
  
  return (
    <group ref={roverRef}>
      <LODRoverModel
        cameraDistance={cameraDistance}
        castShadow
        receiveShadow
        materials={{
          body: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#8B7355'),
            metalness: 0.7,
            roughness: 0.3,
          }),
        }}
      />
      {/* Headlight */}
      <spotLight
        position={[0, 2, 2]}
        angle={0.3}
        penumbra={0.5}
        intensity={2}
        castShadow
        color="#ffeecc"
      />
    </group>
  );
};

// Sample terrain with obstacles
const DemoTerrain: React.FC = () => {
  return (
    <>
      <Grid 
        args={[100, 100]} 
        cellSize={2} 
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
      
      {/* Obstacles for collision detection demo */}
      <mesh position={[10, 2, 0]} castShadow>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#ff6b6b" />
      </mesh>
      
      <mesh position={[-10, 3, -10]} castShadow>
        <sphereGeometry args={[3, 32, 32]} />
        <meshStandardMaterial color="#4ecdc4" />
      </mesh>
      
      <mesh position={[0, 1.5, 15]} castShadow>
        <coneGeometry args={[2, 3, 8]} />
        <meshStandardMaterial color="#45b7d1" />
      </mesh>
    </>
  );
};

// Points of interest for auto-focus demo
const PointsOfInterest: React.FC = () => {
  const points = [
    { position: [10, 2, 0], color: '#ff6b6b', name: 'Red Cube' },
    { position: [-10, 3, -10], color: '#4ecdc4', name: 'Cyan Sphere' },
    { position: [0, 1.5, 15], color: '#45b7d1', name: 'Blue Cone' },
  ];
  
  return (
    <>
      {points.map((poi, index) => (
        <group key={index} position={poi.position as [number, number, number]}>
          {/* Marker */}
          <mesh position={[0, 5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 10, 8]} />
            <meshBasicMaterial color={poi.color} opacity={0.5} transparent />
          </mesh>
          {/* Label */}
          <sprite position={[0, 8, 0]}>
            <spriteMaterial color="white" />
          </sprite>
        </group>
      ))}
    </>
  );
};

/**
 * Main CameraSystemDemo Component
 */
export const CameraSystemDemo: React.FC = () => {
  // Refs
  const cameraSystemRef = useRef<CameraSystemRef>(null);
  const roverRef = useRef<THREE.Object3D>(null);
  
  // State
  const [currentMode, setCurrentMode] = useState<CameraMode>('orbit');
  const [cameraConfig, setCameraConfig] = useState<Partial<CameraConfig>>({});
  const [roverPosition, setRoverPosition] = useState<THREE.Vector3>(new THREE.Vector3());
  const [pipEnabled, setPipEnabled] = useState(false);
  const [pipPosition, setPipPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');
  const [savedPresets, setSavedPresets] = useState<Array<{ id: string; name: string; config: Partial<CameraConfig> }>>([]);
  const [savedPaths, setSavedPaths] = useState<CameraPath[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedPositions, setRecordedPositions] = useState<THREE.Vector3[]>([]);
  
  // Points of interest for auto-focus
  const pointsOfInterest = [
    { id: 'poi-1', position: new THREE.Vector3(10, 2, 0), priority: 1, radius: 5 },
    { id: 'poi-2', position: new THREE.Vector3(-10, 3, -10), priority: 0.8, radius: 5 },
    { id: 'poi-3', position: new THREE.Vector3(0, 1.5, 15), priority: 0.6, radius: 5 },
  ];
  
  // Cinematic paths
  const cinematicPaths: CameraPath[] = [
    {
      id: 'orbit-showcase',
      name: 'Orbit Showcase',
      points: [
        { position: new THREE.Vector3(30, 20, 30), duration: 3000 },
        { position: new THREE.Vector3(-30, 25, 30), duration: 3000 },
        { position: new THREE.Vector3(-30, 20, -30), duration: 3000 },
        { position: new THREE.Vector3(30, 25, -30), duration: 3000 },
        { position: new THREE.Vector3(30, 20, 30), duration: 3000 },
      ],
      loop: true,
      smoothing: 0.8,
    },
    {
      id: 'dramatic-reveal',
      name: 'Dramatic Reveal',
      points: [
        { position: new THREE.Vector3(0, 1, 5), fov: 120, duration: 2000 },
        { position: new THREE.Vector3(0, 10, 20), fov: 90, duration: 2000 },
        { position: new THREE.Vector3(20, 30, 40), fov: 60, duration: 3000 },
      ],
      loop: false,
      smoothing: 0.9,
    },
  ];
  
  // Handlers
  const handleModeChange = useCallback((mode: CameraMode) => {
    setCurrentMode(mode);
    message.info(`Switched to ${mode} camera`);
  }, []);
  
  const handleSettingsChange = useCallback((settings: Partial<CameraConfig>) => {
    setCameraConfig(settings);
  }, []);
  
  const handlePresetSave = useCallback((name: string, config: Partial<CameraConfig>) => {
    const newPreset = {
      id: `preset-${Date.now()}`,
      name,
      config,
    };
    setSavedPresets(prev => [...prev, newPreset]);
  }, []);
  
  const handlePresetLoad = useCallback((id: string) => {
    const preset = savedPresets.find(p => p.id === id);
    if (preset && cameraSystemRef.current) {
      // Apply preset configuration
      setCameraConfig(preset.config);
      if (preset.config.mode) {
        setCurrentMode(preset.config.mode);
      }
      message.success(`Loaded preset: ${preset.name}`);
    }
  }, [savedPresets]);
  
  const handlePresetDelete = useCallback((id: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== id));
    message.success('Preset deleted');
  }, []);
  
  const handlePathRecordStart = useCallback(() => {
    setIsRecording(true);
    setRecordedPositions([]);
  }, []);
  
  const handlePathRecordStop = useCallback((): CameraPath => {
    setIsRecording(false);
    const path: CameraPath = {
      id: `path-${Date.now()}`,
      name: `Recorded Path ${savedPaths.length + 1}`,
      points: recordedPositions.map((pos, index) => ({
        position: pos,
        duration: 100,
      })),
      loop: false,
      smoothing: 0.5,
    };
    setSavedPaths(prev => [...prev, path]);
    return path;
  }, [recordedPositions, savedPaths.length]);
  
  const handlePathPlay = useCallback((pathId: string) => {
    // Path playback is handled by CameraController
  }, []);
  
  const handlePathDelete = useCallback((pathId: string) => {
    setSavedPaths(prev => prev.filter(p => p.id !== pathId));
    message.success('Path deleted');
  }, []);
  
  const handleCameraChange = useCallback((config: CameraConfig) => {
    // Track camera changes for recording
    if (isRecording && config.position) {
      setRecordedPositions(prev => [...prev, new THREE.Vector3(...config.position)]);
    }
  }, [isRecording]);
  
  const handleCollision = useCallback((point: THREE.Vector3) => {
    message.warning('Camera collision detected!');
  }, []);
  
  const handleFocusChange = useCallback((targetId: string | null) => {
    if (targetId) {
      const poi = pointsOfInterest.find(p => p.id === targetId);
      if (poi) {
        message.info(`Auto-focusing on point of interest`);
      }
    }
  }, [pointsOfInterest]);
  
  return (
    <DemoContainer>
      <CanvasContainer>
        <Canvas
          shadows
          camera={{ position: [30, 30, 30], fov: 75 }}
          onCreated={(state) => {
            state.gl.shadowMap.enabled = true;
            state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
          }}
        >
          {/* Camera System */}
          <CameraSystem
            ref={cameraSystemRef}
            mode={currentMode}
            target={roverRef}
            enableShake={true}
            shakeConfig={{
              intensity: 1,
              decay: true,
              decayRate: 0.05,
            }}
            enableCollision={true}
            pointsOfInterest={pointsOfInterest}
            onCameraChange={handleCameraChange}
            cinematicPaths={[...cinematicPaths, ...savedPaths]}
          />
          
          {/* Camera Controller */}
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
            pointsOfInterest={pointsOfInterest}
            paths={[...cinematicPaths, ...savedPaths]}
            onCollision={handleCollision}
            onFocusChange={handleFocusChange}
          />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[50, 50, 25]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          
          {/* Environment */}
          <Environment preset="sunset" background />
          
          {/* Demo Content */}
          <DemoRover onPositionUpdate={setRoverPosition} />
          <DemoTerrain />
          <PointsOfInterest />
          
          {/* Performance Stats */}
          <Stats />
        </Canvas>
        
        {/* Controls */}
        <ControlsContainer>
          <CameraControlPanel
            cameraSystemRef={cameraSystemRef}
            currentMode={currentMode}
            presets={savedPresets}
            savedPaths={savedPaths}
            enableSplitScreen={true}
            enablePiP={true}
            onModeChange={handleModeChange}
            onSettingsChange={handleSettingsChange}
            onPresetSave={handlePresetSave}
            onPresetLoad={handlePresetLoad}
            onPresetDelete={handlePresetDelete}
            onPathRecordStart={handlePathRecordStart}
            onPathRecordStop={handlePathRecordStop}
            onPathPlay={handlePathPlay}
            onPathDelete={handlePathDelete}
          />
        </ControlsContainer>
        
        {/* Info Overlay */}
        <InfoOverlay>
          <div>Camera Mode: <strong>{currentMode}</strong></div>
          <div>Rover Position: ({roverPosition.x.toFixed(1)}, {roverPosition.y.toFixed(1)}, {roverPosition.z.toFixed(1)})</div>
          <div>FOV: {cameraConfig.fov || 75}°</div>
          {isRecording && <div style={{ color: '#ff6b6b' }}>🔴 Recording Path...</div>}
        </InfoOverlay>
        
        {/* Keyboard Hints */}
        <KeyboardHint>
          <div><strong>Camera Shortcuts:</strong></div>
          <div>1-6: Switch camera modes</div>
          <div>Space: Trigger shake effect</div>
          <div>R: Start/stop recording</div>
          <div>P: Toggle auto-play</div>
          <div>F: Toggle fullscreen</div>
        </KeyboardHint>
        
        {/* Picture-in-Picture */}
        <PiPContainer position={pipPosition} enabled={pipEnabled}>
          <Canvas
            camera={{ position: [10, 10, 10], fov: 90 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} />
            <DemoRover />
            <Grid args={[50, 50]} />
          </Canvas>
        </PiPContainer>
      </CanvasContainer>
    </DemoContainer>
  );
};

export default CameraSystemDemo;