/**
 * AnimationSystemDemo Component
 * 
 * Demonstration of the complete animation system with timeline editor.
 * Shows integration with rover visualization and kinematics.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
  Alert,
  Button,
  Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PlayArrow, Animation as AnimationIcon } from '@mui/icons-material';

// Import animation components
import AnimationSystem, { AnimationSystemRef, ROVER_PRESET_ANIMATIONS } from './AnimationSystem';
import AnimationControlPanel from './AnimationControlPanel';
import KinematicsSystem, { ROVER_JOINTS, ROVER_CHAINS, Joint } from './KinematicsSystem';
import DetailedRoverModel from './DetailedRoverModel';

// ========== Demo Component ==========

export const AnimationSystemDemo: React.FC = () => {
  const theme = useTheme();
  const animationSystemRef = useRef<AnimationSystemRef>(null);
  const [joints, setJoints] = useState<Joint[]>(ROVER_JOINTS);
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null);
  const [animationResults, setAnimationResults] = useState<any[]>([]);

  // Handle animation updates
  const handleAnimationUpdate = useCallback((results: any[]) => {
    setAnimationResults(results);

    // Apply animation results to joints
    results.forEach(result => {
      if (result.type === 'joint') {
        setJoints(prevJoints => {
          return prevJoints.map(joint => {
            if (joint.id === result.targetId) {
              const updatedJoint = { ...joint };
              
              // Apply animation value based on blend mode
              if (result.blendMode === 'override') {
                updatedJoint.targetAngle = result.value;
              } else if (result.blendMode === 'additive') {
                updatedJoint.targetAngle = (joint.currentAngle || 0) + result.value * result.weight;
              }
              
              return updatedJoint;
            }
            return joint;
          });
        });
      }
    });
  }, []);

  // Handle joint updates from kinematics
  const handleJointUpdate = useCallback((updatedJoints: Joint[]) => {
    setJoints(updatedJoints);
  }, []);

  // Play default animation on mount
  useEffect(() => {
    if (animationSystemRef.current && ROVER_PRESET_ANIMATIONS.length > 0) {
      // Add all preset animations to the system
      ROVER_PRESET_ANIMATIONS.forEach(clip => {
        animationSystemRef.current!.addClip(clip);
      });

      // Play the arm deployment animation
      setTimeout(() => {
        animationSystemRef.current!.play('arm_deployment');
        setSelectedAnimation('arm_deployment');
      }, 1000);
    }
  }, []);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Header */}
      <Paper elevation={2} sx={{ p: 2, zIndex: 1 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AnimationIcon color="primary" fontSize="large" />
          <Typography variant="h5" fontWeight="bold">
            Animation System Demo
          </Typography>
          <Chip
            label="Rover Animation & Timeline Editor"
            color="primary"
            variant="outlined"
          />
        </Stack>
      </Paper>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 3D Visualization */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Canvas
            camera={{ position: [5, 5, 5], fov: 50 }}
            shadows
          >
            <ambientLight intensity={0.4} />
            <directionalLight
              position={[10, 10, 10]}
              intensity={1}
              castShadow
              shadow-mapSize={[2048, 2048]}
            />

            <Environment preset="sunset" />
            
            {/* Grid */}
            <Grid
              args={[20, 20]}
              cellSize={1}
              cellThickness={0.5}
              cellColor={theme.palette.divider}
              sectionSize={5}
              sectionThickness={1}
              sectionColor={theme.palette.primary.dark}
              fadeDistance={50}
              fadeStrength={1}
              followCamera={false}
            />

            {/* Rover Model */}
            <DetailedRoverModel
              position={[0, 0.5, 0]}
              animationState={joints.reduce((acc, joint) => ({
                ...acc,
                [joint.id]: joint.currentAngle
              }), {})}
              showDebug={false}
            />

            {/* Animation System */}
            <AnimationSystem
              ref={animationSystemRef}
              clips={ROVER_PRESET_ANIMATIONS}
              onAnimationUpdate={handleAnimationUpdate}
              debug={false}
            />

            {/* Kinematics System */}
            <KinematicsSystem
              joints={joints}
              chains={ROVER_CHAINS}
              onJointUpdate={handleJointUpdate}
              debug={false}
            />

            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              maxDistance={20}
              minDistance={2}
            />
          </Canvas>

          {/* Animation Info Overlay */}
          <Paper
            elevation={3}
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              p: 2,
              maxWidth: 300,
              bgcolor: 'background.paper',
              opacity: 0.95
            }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Animation Status
            </Typography>
            <Divider sx={{ my: 1 }} />
            {selectedAnimation ? (
              <Stack spacing={1}>
                <Typography variant="body2">
                  <strong>Current:</strong> {selectedAnimation}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {animationResults.length} active tracks
                </Typography>
                {animationResults.slice(0, 3).map((result, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={`${result.targetId}: ${result.value.toFixed(2)}`}
                    variant="outlined"
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No animation playing
              </Typography>
            )}
          </Paper>

          {/* Instructions */}
          <Alert
            severity="info"
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              right: 16,
              maxWidth: 500
            }}
          >
            <Typography variant="body2">
              <strong>Instructions:</strong> Use the Animation Control Panel to browse and play animations.
              Switch to the Timeline tab to edit keyframes. The Layers tab allows animation blending.
            </Typography>
          </Alert>
        </Box>

        {/* Animation Control Panel */}
        <Paper
          elevation={3}
          sx={{
            width: 400,
            display: 'flex',
            flexDirection: 'column',
            borderLeft: 1,
            borderColor: 'divider'
          }}
        >
          <AnimationControlPanel
            animationSystemRef={animationSystemRef}
            onAnimationSelect={(clip) => {
              setSelectedAnimation(clip.id);
              if (animationSystemRef.current) {
                animationSystemRef.current.play(clip.id);
              }
            }}
            height="100%"
          />
        </Paper>
      </Box>

      {/* Quick Actions */}
      <Paper elevation={2} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} justifyContent="center">
          {ROVER_PRESET_ANIMATIONS.map(clip => (
            <Button
              key={clip.id}
              variant={selectedAnimation === clip.id ? 'contained' : 'outlined'}
              startIcon={<PlayArrow />}
              onClick={() => {
                if (animationSystemRef.current) {
                  animationSystemRef.current.play(clip.id);
                  setSelectedAnimation(clip.id);
                }
              }}
              size="small"
            >
              {clip.name}
            </Button>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
};

export default AnimationSystemDemo;