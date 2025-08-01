/**
 * Optimized entry point for bundle analysis
 * Uses selective imports to minimize bundle size
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Optimized Chart.js imports
import { ChartJS, Line, chartDefaults } from './utils/chartsOptimized';

// Optimized Three.js imports  
import { Scene, PerspectiveCamera, BoxGeometry, MeshStandardMaterial, Mesh, AmbientLight, PointLight } from './utils/threeOptimized';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// Optimized Material-UI imports
import {
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Box,
  ThemeProvider,
  createOptimizedTheme,
  PlayArrow,
  Settings
} from './utils/muiOptimized';

// Monaco Editor (lazy loaded)
const Editor = React.lazy(() => import('@monaco-editor/react'));

// Selective D3 imports
import { select, scaleLinear, axisBottom, axisLeft } from './utils/chartsOptimized';

// Essential utilities only
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// React Router (essential only)
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Socket.IO (lightweight usage)
import io from 'socket.io-client';

// Simple 3D scene component
const OptimizedScene = () => {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
};

// Optimized analysis app
const OptimizedAnalysisApp = () => {
  const theme = createOptimizedTheme();
  
  React.useEffect(() => {
    // Minimal socket connection
    const socket = io('ws://localhost:8001', { autoConnect: false });
    const uuid = uuidv4();
    
    // Minimal axios setup
    axios.defaults.baseURL = 'http://localhost:8000';
    axios.defaults.timeout = 5000;
    
    console.log('Optimized analysis app loaded', { uuid });
    
    return () => socket.disconnect();
  }, []);

  const chartData = {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{
      label: 'Optimized Chart',
      data: [1, 2, 3],
      borderColor: '#1976d2',
      backgroundColor: 'rgba(25, 118, 210, 0.1)',
    }]
  };

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Box sx={{ padding: 2 }}>
          <Typography variant="h4" gutterBottom>
            Optimized Bundle Analysis
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 300 }}>
                <Typography variant="h6" gutterBottom>
                  <PlayArrow sx={{ mr: 1 }} />
                  Optimized Chart.js
                </Typography>
                <Box sx={{ height: 200 }}>
                  <Line data={chartData} options={chartDefaults} />
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 300 }}>
                <Typography variant="h6" gutterBottom>
                  <Settings sx={{ mr: 1 }} />
                  Optimized Three.js
                </Typography>
                <Box sx={{ height: 200 }}>
                  <Canvas>
                    <OrbitControls enableZoom={false} />
                    <OptimizedScene />
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                  </Canvas>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Paper sx={{ p: 2, height: 250 }}>
                <Typography variant="h6" gutterBottom>
                  Lazy-loaded Monaco Editor
                </Typography>
                <Box sx={{ height: 180, border: '1px solid #ccc' }}>
                  <React.Suspense fallback={<div>Loading editor...</div>}>
                    <Editor
                      height="100%"
                      defaultLanguage="javascript"
                      defaultValue="// Optimized bundle analysis"
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14
                      }}
                    />
                  </React.Suspense>
                </Box>
              </Paper>
            </Grid>
          </Grid>
          
          <Routes>
            <Route path="/" element={
              <Box sx={{ mt: 2 }}>
                <Typography variant="body1">
                  Bundle optimization complete! Check the network tab to see reduced sizes.
                </Typography>
              </Box>
            } />
          </Routes>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<OptimizedAnalysisApp />);