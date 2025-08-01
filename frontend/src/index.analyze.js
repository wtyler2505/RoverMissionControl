/**
 * Simplified entry point for bundle analysis
 * Imports all major dependencies to analyze bundle composition
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Chart.js and visualization (optimized imports)
import { ChartJS, Line, chartDefaults } from './utils/chartsOptimized';

// Three.js (optimized imports)
import { Scene, PerspectiveCamera, BoxGeometry, MeshStandardMaterial, Mesh } from './utils/threeOptimized';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';

// Monaco Editor
import Editor from '@monaco-editor/react';

// Material-UI (optimized imports)
import {
  Button,
  TextField,
  Grid as MuiGrid,
  Paper,
  Typography,
  ThemeProvider,
  createOptimizedTheme
} from './utils/muiOptimized';

// D3 (selective imports)
import { select, scaleLinear, axisBottom } from 'd3';

// Socket.IO
import io from 'socket.io-client';

// React Router
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Other large dependencies
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import DOMPurify from 'dompurify';

// ChartJS is already configured in chartsOptimized

// Simple component to trigger all imports
const AnalysisApp = () => {
  const theme = createOptimizedTheme();
  
  // Use various dependencies to ensure they're included
  React.useEffect(() => {
    const socket = io('ws://localhost:8001');
    const uuid = uuidv4();
    const clean = DOMPurify.sanitize('<div>test</div>');
    
    // Chart data
    const chartData = {
      labels: ['Jan', 'Feb', 'Mar'],
      datasets: [{
        label: 'Test',
        data: [1, 2, 3],
        borderColor: 'blue'
      }]
    };
    
    // D3 usage
    select('body').append('div');
    
    // Axios usage
    axios.defaults.baseURL = 'http://localhost:8000';
    
    console.log('Analysis app loaded', { uuid, clean, chartData });
    
    return () => socket.disconnect();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <div style={{ padding: 20 }}>
          <Typography variant="h4">Bundle Analysis App</Typography>
          
          <MuiGrid container spacing={2}>
            <MuiGrid item xs={12} md={6}>
              <Paper style={{ padding: 16, height: 300 }}>
                <Typography variant="h6">Chart.js</Typography>
                <Line 
                  data={{
                    labels: ['A', 'B', 'C'],
                    datasets: [{
                      label: 'Test',
                      data: [1, 2, 3],
                      borderColor: 'blue'
                    }]
                  }} 
                  options={chartDefaults}
                />
              </Paper>
            </MuiGrid>
            
            <MuiGrid item xs={12} md={6}>
              <Paper style={{ padding: 16, height: 300 }}>
                <Typography variant="h6">Three.js</Typography>
                <Canvas>
                  <OrbitControls />
                  <Grid />
                  <mesh>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="orange" />
                  </mesh>
                  <ambientLight intensity={0.5} />
                  <pointLight position={[10, 10, 10]} />
                </Canvas>
              </Paper>
            </MuiGrid>
            
            <MuiGrid item xs={12}>
              <Paper style={{ padding: 16, height: 200 }}>
                <Typography variant="h6">Monaco Editor</Typography>
                <Editor
                  height="150px"
                  defaultLanguage="javascript"
                  defaultValue="// Bundle analysis test"
                />
              </Paper>
            </MuiGrid>
          </MuiGrid>
          
          <Routes>
            <Route path="/" element={<div>Analysis Route</div>} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
};

// Create root and render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AnalysisApp />);