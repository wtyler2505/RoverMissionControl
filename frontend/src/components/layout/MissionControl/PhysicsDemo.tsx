/**
 * PhysicsDemo Component
 * 
 * Demonstration of the rover physics system with various test scenarios.
 * This component can be used to test and showcase the physics implementation.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { Box, Paper, Typography, Button, ButtonGroup, FormControlLabel, Switch } from '@mui/material';
import RoverVisualization3D from './RoverVisualization3D';
import { RoverPhysicsState } from './RoverPhysics';

export const PhysicsDemo: React.FC = () => {
  const [enablePhysics, setEnablePhysics] = useState(true);
  const [showPhysicsControls, setShowPhysicsControls] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [physicsState, setPhysicsState] = useState<RoverPhysicsState | null>(null);
  
  // Demo rover data for non-physics mode
  const [roverData] = useState({
    position: { x: 0, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    speed: 0,
    battery: 85,
    signalStrength: 92,
    status: 'idle' as const
  });
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Control Bar */}
      <Paper sx={{ p: 2, zIndex: 1000 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Typography variant="h6">Rover Physics Demo</Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={enablePhysics}
                onChange={(e) => setEnablePhysics(e.target.checked)}
              />
            }
            label="Enable Physics"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showPhysicsControls}
                onChange={(e) => setShowPhysicsControls(e.target.checked)}
                disabled={!enablePhysics}
              />
            }
            label="Show Physics Controls"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={showStats}
                onChange={(e) => setShowStats(e.target.checked)}
              />
            }
            label="Show Stats"
          />
          
          {physicsState && (
            <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
              <Typography variant="body2">
                Speed: {physicsState.speed.toFixed(1)} m/s
              </Typography>
              <Typography variant="body2">
                Position: ({physicsState.position.x.toFixed(1)}, 
                {physicsState.position.y.toFixed(1)}, 
                {physicsState.position.z.toFixed(1)})
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
      
      {/* 3D Visualization */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <RoverVisualization3D
          roverData={!enablePhysics ? roverData : undefined}
          enablePhysics={enablePhysics}
          showPhysicsControls={showPhysicsControls}
          showStats={showStats}
          enableKeyboardControls={true}
          cameraConfig={{
            position: [20, 15, 20],
            fov: 60
          }}
          lightingConfig={{
            ambientIntensity: 0.4,
            directionalIntensity: 1,
            enableShadows: true
          }}
          onPhysicsUpdate={setPhysicsState}
        />
      </Box>
    </Box>
  );
};

export default PhysicsDemo;