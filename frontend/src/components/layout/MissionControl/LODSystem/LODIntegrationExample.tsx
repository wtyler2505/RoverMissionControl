/**
 * LOD Integration Example
 * 
 * Demonstrates how to integrate the LOD system with the existing RoverVisualization3D
 * component and other 3D elements in the Mission Control interface.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Stats, KeyboardControls } from '@react-three/drei';
import { 
  LODProvider, 
  LODRoverModel, 
  LODTerrain, 
  LODEffects, 
  LODControlPanel, 
  LODIndicator,
  usePerformanceProfiler,
  PerformanceDashboard
} from './index';
import { Box, IconButton, Drawer } from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

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
 * Enhanced Rover Visualization Scene with LOD
 */
function LODScene({ 
  roverData,
  enablePhysics = true,
  showTerrain = true,
  showEffects = true 
}: {
  roverData?: any;
  enablePhysics?: boolean;
  showTerrain?: boolean;
  showEffects?: boolean;
}) {
  // Performance profiler hook
  const profiler = usePerformanceProfiler({
    sampleRate: 30,
    historySize: 300
  });
  
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      
      {/* Main directional light (sun) */}
      <directionalLight
        position={[50, 50, 25]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      {/* LOD-aware rover model */}
      <LODRoverModel
        position={roverData?.position || [0, 0.5, 0]}
        rotation={roverData?.rotation || [0, 0, 0]}
        autoLOD={true}
        debugLOD={false}
        castShadow
        receiveShadow
        animationState={{
          wheelRotations: roverData?.wheelRotations,
          steeringAngles: roverData?.steeringAngles
        }}
      />
      
      {/* LOD terrain */}
      {showTerrain && (
        <LODTerrain
          size={{ width: 200, depth: 200 }}
          maxHeight={5}
          chunkSize={20}
          maxViewDistance={150}
        />
      )}
      
      {/* LOD effects */}
      {showEffects && (
        <LODEffects
          particles={true}
          glow={true}
          atmosphere={true}
          dust={true}
          baseParticleCount={2000}
          color="#00ff88"
          intensity={0.8}
        />
      )}
      
      {/* Grid helper */}
      <Grid 
        args={[200, 20]} 
        cellColor="#444444" 
        sectionColor="#666666"
        fadeDistance={100}
        fadeStrength={1}
        followCamera={false}
      />
      
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
      />
    </>
  );
}

/**
 * Main LOD Integration Example Component
 */
export function LODIntegrationExample() {
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [performanceProfiles, setPerformanceProfiles] = useState<any[]>([]);
  
  // Mock rover data - in real implementation this would come from telemetry
  const [roverData] = useState({
    position: { x: 0, y: 0.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    speed: 0,
    battery: 85,
    signalStrength: 92,
    status: 'idle' as const
  });
  
  // Handle metrics update from LOD system
  const handleMetricsUpdate = useCallback((metrics: any) => {
    // Store metrics for performance dashboard
    setPerformanceProfiles(prev => {
      const newProfiles = [...prev, metrics];
      if (newProfiles.length > 300) {
        newProfiles.shift();
      }
      return newProfiles;
    });
  }, []);
  
  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Main 3D Canvas */}
      <KeyboardControls map={keyboardMap}>
        <Canvas
          shadows
          camera={{ 
            position: [10, 8, 10], 
            fov: 60,
            near: 0.1,
            far: 1000
          }}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false
          }}
        >
          <LODProvider
            initialPreset="adaptive"
            performanceTargets={{
              targetFPS: 60,
              minFPS: 30,
              maxMemoryMB: 512,
              maxDrawCalls: 1000,
              gpuUtilizationTarget: 0.8
            }}
            onMetricsUpdate={handleMetricsUpdate}
          >
            <LODScene 
              roverData={roverData}
              enablePhysics={true}
              showTerrain={true}
              showEffects={true}
            />
            
            {/* Performance stats overlay */}
            {showStats && <Stats />}
          </LODProvider>
        </Canvas>
      </KeyboardControls>
      
      {/* LOD Performance Indicator */}
      <LODIndicator />
      
      {/* Settings Button */}
      <IconButton
        sx={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }
        }}
        onClick={() => setShowControls(!showControls)}
      >
        <SettingsIcon />
      </IconButton>
      
      {/* LOD Control Panel Drawer */}
      <Drawer
        anchor="right"
        open={showControls}
        onClose={() => setShowControls(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 400,
            backgroundColor: 'rgba(18, 18, 18, 0.95)',
            backdropFilter: 'blur(10px)'
          }
        }}
      >
        <LODControlPanel 
          onClose={() => setShowControls(false)}
          showBenchmarks={true}
          showAnalytics={true}
        />
      </Drawer>
    </Box>
  );
}

/**
 * Integration with existing RoverVisualization3D component
 * 
 * To integrate LOD into the existing component, wrap it with LODProvider:
 */
export function EnhancedRoverVisualization3D(props: any) {
  return (
    <LODProvider
      initialPreset="adaptive"
      performanceTargets={{
        targetFPS: 60,
        minFPS: 30,
        maxMemoryMB: 512
      }}
    >
      {/* Replace DetailedRoverModel with LODRoverModel */}
      <LODRoverModel
        {...props}
        autoLOD={true}
        lodDistances={[0, 30, 60, 120, 250]}
      />
      
      {/* Add LOD effects */}
      <LODEffects
        particles={props.showParticles}
        intensity={props.effectIntensity || 1.0}
      />
      
      {/* Add performance indicator */}
      <LODIndicator />
    </LODProvider>
  );
}

/**
 * Usage Example in MainVisualizationPanel
 * 
 * ```tsx
 * import { LODProvider, LODIndicator } from './LODSystem';
 * import { EnhancedRoverVisualization3D } from './LODSystem/LODIntegrationExample';
 * 
 * function MainVisualizationPanel() {
 *   return (
 *     <Canvas>
 *       <LODProvider initialPreset="adaptive">
 *         <EnhancedRoverVisualization3D 
 *           roverData={telemetryData}
 *           showEffects={true}
 *         />
 *       </LODProvider>
 *     </Canvas>
 *   );
 * }
 * ```
 */

export default LODIntegrationExample;