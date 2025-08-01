/**
 * RoverModelDemo Component
 * 
 * Demo scene for testing the DetailedRoverModel with different LOD levels
 * and animation states.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import { DetailedRoverModel, RoverAnimationState } from './DetailedRoverModel';

export const RoverModelDemo: React.FC = () => {
  const [lod, setLod] = useState(0);
  const [debug, setDebug] = useState(false);
  const [animateWheels, setAnimateWheels] = useState(false);
  const animationRef = useRef<RoverAnimationState>({
    wheelRotations: [0, 0, 0, 0, 0, 0],
    steeringAngles: [0, 0, 0, 0, 0, 0],
    armJoints: {
      shoulder: 0,
      elbow: 0,
      wrist: 0,
      turret: 0,
    },
    mastCamera: {
      pan: 0,
      tilt: 0,
    },
    antenna: {
      pan: 0,
      tilt: 0,
    },
  });

  // Update animation
  React.useEffect(() => {
    if (animateWheels) {
      const interval = setInterval(() => {
        animationRef.current.wheelRotations = animationRef.current.wheelRotations!.map(
          rot => rot + 0.1
        );
      }, 50);
      return () => clearInterval(interval);
    }
  }, [animateWheels]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: 20,
        borderRadius: 8,
        fontFamily: 'Arial, sans-serif',
        zIndex: 1000,
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Rover Model Demo</h3>
        
        <div style={{ marginBottom: 10 }}>
          <label>LOD Level: </label>
          <select 
            value={lod} 
            onChange={(e) => setLod(Number(e.target.value))}
            style={{ marginLeft: 10 }}
          >
            <option value={0}>High (0)</option>
            <option value={1}>Medium (1)</option>
            <option value={2}>Low (2)</option>
          </select>
        </div>
        
        <div style={{ marginBottom: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={debug}
              onChange={(e) => setDebug(e.target.checked)}
            />
            {' '}Show Debug
          </label>
        </div>
        
        <div style={{ marginBottom: 10 }}>
          <label>
            <input
              type="checkbox"
              checked={animateWheels}
              onChange={(e) => setAnimateWheels(e.target.checked)}
            />
            {' '}Animate Wheels
          </label>
        </div>
        
        <div style={{ marginTop: 15 }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Animation Controls</h4>
          
          <div style={{ marginBottom: 5 }}>
            <label style={{ display: 'inline-block', width: 100 }}>Steering:</label>
            <input
              type="range"
              min="-30"
              max="30"
              value={animationRef.current.steeringAngles![0] * 180 / Math.PI}
              onChange={(e) => {
                const angle = Number(e.target.value) * Math.PI / 180;
                animationRef.current.steeringAngles = [angle, angle, 0, 0, 0, 0];
              }}
              style={{ width: 150 }}
            />
          </div>
          
          <div style={{ marginBottom: 5 }}>
            <label style={{ display: 'inline-block', width: 100 }}>Mast Pan:</label>
            <input
              type="range"
              min="-180"
              max="180"
              value={animationRef.current.mastCamera!.pan * 180 / Math.PI}
              onChange={(e) => {
                animationRef.current.mastCamera!.pan = Number(e.target.value) * Math.PI / 180;
              }}
              style={{ width: 150 }}
            />
          </div>
          
          <div style={{ marginBottom: 5 }}>
            <label style={{ display: 'inline-block', width: 100 }}>Antenna Pan:</label>
            <input
              type="range"
              min="-90"
              max="90"
              value={animationRef.current.antenna!.pan * 180 / Math.PI}
              onChange={(e) => {
                animationRef.current.antenna!.pan = Number(e.target.value) * Math.PI / 180;
              }}
              style={{ width: 150 }}
            />
          </div>
        </div>
      </div>
      
      {/* 3D Scene */}
      <Canvas
        shadows
        camera={{ position: [10, 10, 10], fov: 50 }}
        style={{ background: '#1a1a1a' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        
        {/* Grid */}
        <Grid
          args={[50, 50]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#6f6f6f"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={50}
          fadeStrength={1}
        />
        
        {/* Rover Model */}
        <DetailedRoverModel
          position={[0, 0, 0]}
          lod={lod}
          debug={debug}
          animationState={animationRef.current}
          castShadow
          receiveShadow
        />
        
        {/* Camera Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
        />
        
        {/* Performance Stats */}
        <Stats />
      </Canvas>
    </div>
  );
};

export default RoverModelDemo;