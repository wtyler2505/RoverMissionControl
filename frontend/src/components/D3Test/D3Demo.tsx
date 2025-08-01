import React from 'react';
import { Container, Grid, Typography, Box, Paper } from '@mui/material';
import { D3TestComponent } from './index';
import { D3RealTimeChart } from './index';

const D3Demo: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h3" gutterBottom>
          D3.js Integration Demo
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This page demonstrates D3.js v7.x integration with React 19 and TypeScript for the RoverMissionControl project.
          D3.js provides powerful data visualization capabilities for mission-critical telemetry and control systems.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper elevation={3}>
            <D3TestComponent />
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper elevation={3}>
            <D3RealTimeChart />
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              D3.js Features Available:
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Data Visualization
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Line charts, bar charts, scatter plots<br/>
                  • Area charts and streamgraphs<br/>
                  • Pie charts and donut charts<br/>
                  • Heat maps and treemaps
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Real-time Updates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Live data streaming<br/>
                  • Smooth transitions<br/>
                  • Dynamic scaling<br/>
                  • Performance optimization
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" gutterBottom>
                  Interactivity
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Tooltips and hover effects<br/>
                  • Zoom and pan capabilities<br/>
                  • Brush selection<br/>
                  • Click and drag interactions
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Integration Notes:
            </Typography>
            <Typography variant="body2" component="div">
              <ul>
                <li>D3.js v7.x is fully compatible with React 19</li>
                <li>TypeScript definitions are installed (@types/d3)</li>
                <li>Use React refs to access DOM elements for D3 manipulation</li>
                <li>Clean up D3 selections in useEffect cleanup functions</li>
                <li>Consider using React.memo for performance optimization</li>
                <li>Implement proper error boundaries for mission-critical visualizations</li>
              </ul>
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default D3Demo;