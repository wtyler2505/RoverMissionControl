/**
 * Performance Monitoring Example
 * 
 * Complete example demonstrating the integration of all performance monitoring tools
 * with the rover 3D visualization system.
 */

import React, { useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, Grid, Environment } from '@react-three/drei';
import { Box, Button, ButtonGroup, Typography, Paper, Stack } from '@mui/material';
import { PlayArrow, Stop, Assessment, BugReport } from '@mui/icons-material';

// Import performance components
import { LODManager } from './LODManager';
import { LODRoverModel } from './LODRoverModel';
import { LODTerrain } from './LODTerrain';
import { LODEffects } from './LODEffects';
import { PerformanceProfiler } from './PerformanceProfiler';
import { PerformanceHUD } from './PerformanceHUD';
import { LODControlPanel } from './LODControlPanel';

// Import test utilities
import { PerformanceTestRunner, createPerformanceTest } from './__tests__/performance/performanceTestUtils';
import { createStressTestScenarios, StressTestScenario } from './__tests__/performance/stressTestScenarios';

interface SceneProps {
  scenario?: StressTestScenario;
  onMetricsUpdate?: (metrics: any) => void;
}

const Scene: React.FC<SceneProps> = ({ scenario, onMetricsUpdate }) => {
  const [entities, setEntities] = useState<any[]>([]);
  
  React.useEffect(() => {
    if (scenario) {
      // Setup scenario entities
      const sceneEntities = scenario.setup({} as any);
      setEntities(sceneEntities);
      
      // Start update loop
      const updateLoop = () => {
        scenario.update(entities, 16); // Assume 60 FPS
        requestAnimationFrame(updateLoop);
      };
      updateLoop();
    }
  }, [scenario]);
  
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      
      {/* Environment */}
      <Environment preset="sunset" />
      
      {/* Grid */}
      <Grid args={[200, 200]} cellSize={5} cellThickness={0.5} />
      
      {/* LOD Terrain */}
      <LODTerrain />
      
      {/* Rover Models */}
      <LODRoverModel position={[0, 0, 0]} animated />
      
      {/* Dynamic entities from scenario */}
      {entities.map((entity, index) => (
        <LODRoverModel
          key={entity.id}
          position={entity.position}
          rotation={entity.rotation}
          scale={entity.scale}
          animated={entity.animated}
        />
      ))}
      
      {/* Effects */}
      <LODEffects />
      
      {/* Performance Profiler */}
      <PerformanceProfiler
        enabled
        onProfileUpdate={onMetricsUpdate}
      />
    </>
  );
};

export const PerformanceMonitoringExample: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<StressTestScenario | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [showHUD, setShowHUD] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [performanceIssues, setPerformanceIssues] = useState<string[]>([]);
  
  const scenarios = createStressTestScenarios();
  const testRunner = new PerformanceTestRunner();
  
  // Handle performance issues
  const handlePerformanceIssue = useCallback((issue: string) => {
    setPerformanceIssues(prev => [...prev, `${new Date().toLocaleTimeString()}: ${issue}`]);
  }, []);
  
  // Run automated test
  const runAutomatedTest = async (scenarioIndex: number) => {
    const scenario = scenarios[scenarioIndex];
    setIsRunning(true);
    setCurrentScenario(scenario);
    
    // Create performance test
    const test = createPerformanceTest(
      scenario.name,
      async () => {
        // Test setup
        console.log(`Starting test: ${scenario.name}`);
      },
      async (measurement) => {
        // Test execution
        await new Promise(resolve => setTimeout(resolve, 5000));
      },
      async () => {
        // Test cleanup
        console.log(`Completed test: ${scenario.name}`);
      },
      {
        duration: 10000,
        targetFPS: 30
      }
    );
    
    try {
      const result = await test();
      setTestResults(prev => [...prev, { scenario: scenario.name, ...result }]);
    } catch (error) {
      console.error('Test failed:', error);
    } finally {
      setIsRunning(false);
      setCurrentScenario(null);
    }
  };
  
  // Run all tests
  const runAllTests = async () => {
    for (let i = 0; i < scenarios.length; i++) {
      await runAutomatedTest(i);
    }
  };
  
  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Control Bar */}
      <Paper sx={{ p: 2, zIndex: 10 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h6">Performance Monitoring Demo</Typography>
          
          <ButtonGroup variant="contained" size="small">
            <Button
              startIcon={<PlayArrow />}
              onClick={() => runAutomatedTest(0)}
              disabled={isRunning}
            >
              Run Test
            </Button>
            <Button
              startIcon={<Assessment />}
              onClick={runAllTests}
              disabled={isRunning}
            >
              Run All Tests
            </Button>
            <Button
              startIcon={<Stop />}
              onClick={() => setIsRunning(false)}
              disabled={!isRunning}
            >
              Stop
            </Button>
          </ButtonGroup>
          
          <ButtonGroup variant="outlined" size="small">
            <Button onClick={() => setShowHUD(!showHUD)}>
              {showHUD ? 'Hide' : 'Show'} HUD
            </Button>
            <Button onClick={() => setShowStats(!showStats)}>
              {showStats ? 'Hide' : 'Show'} Stats
            </Button>
          </ButtonGroup>
          
          {isRunning && (
            <Typography variant="body2" color="primary">
              Running: {currentScenario?.name}
            </Typography>
          )}
        </Stack>
      </Paper>
      
      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* 3D Visualization */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Canvas
            camera={{ position: [50, 50, 50], fov: 60 }}
            shadows
            performance={{ min: 0.5 }}
          >
            <LODManager adaptiveMode targetFPS={60}>
              <Scene 
                scenario={currentScenario || undefined}
                onMetricsUpdate={(metrics) => {
                  // Handle metrics updates
                }}
              />
              <OrbitControls enableDamping dampingFactor={0.05} />
            </LODManager>
            
            {/* Three.js Stats */}
            {showStats && <Stats showPanel={0} />}
          </Canvas>
          
          {/* Performance HUD Overlay */}
          {showHUD && (
            <PerformanceHUD
              enabled
              position="top-right"
              expanded={true}
              showGraphs={true}
              showWarnings={true}
              onPerformanceIssue={handlePerformanceIssue}
            />
          )}
        </Box>
        
        {/* Control Panel */}
        <Paper sx={{ width: 350, p: 2, overflow: 'auto' }}>
          <Stack spacing={2}>
            <LODControlPanel />
            
            {/* Test Scenarios */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Test Scenarios
              </Typography>
              <Stack spacing={1}>
                {scenarios.map((scenario, index) => (
                  <Button
                    key={scenario.name}
                    variant="outlined"
                    size="small"
                    fullWidth
                    onClick={() => runAutomatedTest(index)}
                    disabled={isRunning}
                  >
                    {scenario.name}
                  </Button>
                ))}
              </Stack>
            </Box>
            
            {/* Test Results */}
            {testResults.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Test Results
                </Typography>
                {testResults.map((result, index) => (
                  <Paper key={index} sx={{ p: 1, mb: 1 }}>
                    <Typography variant="subtitle2">{result.scenario}</Typography>
                    <Typography variant="body2">
                      FPS: {result.fps?.average?.toFixed(1)} | 
                      Frame Time: {result.frameTime?.average?.toFixed(1)}ms | 
                      Memory: {result.memory?.peak?.toFixed(1)}MB
                    </Typography>
                  </Paper>
                ))}
              </Box>
            )}
            
            {/* Performance Issues */}
            {performanceIssues.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  <BugReport sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Performance Issues
                </Typography>
                <Paper sx={{ p: 1, maxHeight: 200, overflow: 'auto' }}>
                  {performanceIssues.map((issue, index) => (
                    <Typography key={index} variant="body2" color="error">
                      {issue}
                    </Typography>
                  ))}
                </Paper>
              </Box>
            )}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

// Export example usage
export default function PerformanceMonitoringExamplePage() {
  return <PerformanceMonitoringExample />;
}