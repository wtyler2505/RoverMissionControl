/**
 * KinematicsDemo Component
 * 
 * Demonstrates the kinematics and articulation system for the rover.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import { Button } from '../../ui/core';
import { KinematicsSystem, ROVER_JOINTS, ROVER_CHAINS } from './KinematicsSystem';
import { KinematicsControlPanel } from './KinematicsControlPanel';
import { DetailedRoverModel } from './DetailedRoverModel';
import type { Joint, IKTarget } from './KinematicsSystem';

export const KinematicsDemo: React.FC = () => {
  const [showKinematics, setShowKinematics] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [debugKinematics, setDebugKinematics] = useState(true);
  const [joints, setJoints] = useState<Joint[]>(ROVER_JOINTS);
  const [ikTargets, setIkTargets] = useState<IKTarget[]>([]);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const kinematicsRef = useRef<any>();

  // Handle joint updates from kinematics system
  const handleJointUpdate = useCallback((updatedJoints: Joint[]) => {
    setJoints(updatedJoints);
  }, []);

  // Handle joint change from control panel
  const handleJointChange = useCallback((jointId: string, angle?: number, distance?: number) => {
    const solver = kinematicsRef.current?.userData?.solver;
    if (solver) {
      solver.setJointTarget(jointId, angle, distance);
    }
  }, []);

  // Handle IK target
  const handleIKTargetSet = useCallback((target: IKTarget) => {
    setIkTargets([target]); // Replace with new target
  }, []);

  // Handle animation
  const handleAnimationPlay = useCallback((clipId: string) => {
    const playAnimation = kinematicsRef.current?.userData?.playAnimation;
    if (playAnimation) {
      playAnimation(clipId);
      setCurrentAnimation(clipId);
    }
  }, []);

  const handleAnimationStop = useCallback(() => {
    const stopAnimation = kinematicsRef.current?.userData?.stopAnimation;
    if (stopAnimation) {
      stopAnimation();
      setCurrentAnimation(null);
    }
  }, []);

  // Convert joint data to animation state for rover model
  const getAnimationState = () => {
    const armBase = joints.find(j => j.id === 'arm_base');
    const mastPan = joints.find(j => j.id === 'mast_pan');
    const mastTilt = joints.find(j => j.id === 'mast_tilt');
    const antennaBase = joints.find(j => j.id === 'antenna_base');

    return {
      wheelRotation: 0,
      steeringAngle: 0,
      armRotation: armBase?.currentAngle || 0,
      mastPan: mastPan?.currentAngle || 0,
      mastTilt: mastTilt?.currentAngle || 0,
      antennaRotation: antennaBase?.currentAngle || 0
    };
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          shadows
          camera={{ position: [5, 5, 5], fov: 60 }}
          style={{ background: '#000' }}
        >
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          
          <Grid
            args={[20, 20]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#6f6f6f"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#9d4b4b"
            fadeDistance={30}
            fadeStrength={1}
            infiniteGrid
          />
          
          <OrbitControls enablePan enableZoom enableRotate />
          
          {/* Rover Model */}
          <DetailedRoverModel
            position={[0, 0, 0]}
            scale={1}
            lod={0}
            debug={false}
            animationState={getAnimationState()}
          />
          
          {/* Kinematics System */}
          {showKinematics && (
            <group ref={kinematicsRef}>
              <KinematicsSystem
                joints={ROVER_JOINTS}
                chains={ROVER_CHAINS}
                targets={ikTargets}
                debug={debugKinematics}
                onJointUpdate={handleJointUpdate}
              />
            </group>
          )}
          
          {showStats && <Stats />}
        </Canvas>
        
        {/* Controls overlay */}
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          display: 'flex',
          gap: 10
        }}>
          <Button
            onClick={() => setShowKinematics(!showKinematics)}
            variant={showKinematics ? 'default' : 'outline'}
            size="sm"
          >
            Kinematics
          </Button>
          <Button
            onClick={() => setShowControls(!showControls)}
            variant={showControls ? 'default' : 'outline'}
            size="sm"
          >
            Controls
          </Button>
          <Button
            onClick={() => setShowStats(!showStats)}
            variant={showStats ? 'default' : 'outline'}
            size="sm"
          >
            Stats
          </Button>
          <Button
            onClick={() => setDebugKinematics(!debugKinematics)}
            variant={debugKinematics ? 'default' : 'outline'}
            size="sm"
          >
            Debug Joints
          </Button>
        </div>
      </div>
      
      {/* Control Panel */}
      {showControls && (
        <div style={{ 
          width: 400, 
          overflowY: 'auto',
          borderLeft: '1px solid #333',
          background: '#1a1a1a'
        }}>
          <KinematicsControlPanel
            joints={joints}
            onJointChange={handleJointChange}
            onIKTargetSet={handleIKTargetSet}
            onAnimationPlay={handleAnimationPlay}
            onAnimationStop={handleAnimationStop}
            currentAnimation={currentAnimation}
            animationTime={kinematicsRef.current?.userData?.animationTime}
            debug={debugKinematics}
            onDebugToggle={setDebugKinematics}
          />
        </div>
      )}
    </div>
  );
};

export default KinematicsDemo;