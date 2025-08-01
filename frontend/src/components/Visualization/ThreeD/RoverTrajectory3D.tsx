/**
 * RoverTrajectory3D Component
 * Specialized 3D visualization for rover trajectory and terrain
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Button,
  Divider,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Terrain as TerrainIcon,
  Speed as SpeedIcon,
  Battery5Bar as BatteryIcon,
  WifiTethering as SignalIcon,
  LocationOn as LocationIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import * as THREE from 'three';

import Chart3D from './Chart3D';
import { Chart3DAPI, TrajectoryData, TerrainData, Annotation3D, DataPoint3D } from './types';

interface RoverPosition {
  timestamp: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  battery: number;
  signalStrength: number;
  status: 'idle' | 'moving' | 'charging' | 'error';
}

interface RoverTrajectory3DProps {
  positions: RoverPosition[];
  terrain?: {
    heightMap: number[][];
    width: number;
    height: number;
    textureUrl?: string;
  };
  waypoints?: Array<{
    id: string;
    name: string;
    position: { x: number; y: number; z: number };
    type: 'start' | 'end' | 'waypoint' | 'charging' | 'science';
  }>;
  obstacles?: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    radius: number;
    type: 'rock' | 'crater' | 'slope';
  }>;
  onTimeChange?: (timestamp: number) => void;
  className?: string;
}

/**
 * Get color based on rover status
 */
const getStatusColor = (status: RoverPosition['status']): string => {
  switch (status) {
    case 'idle': return '#ffeb3b';
    case 'moving': return '#4caf50';
    case 'charging': return '#2196f3';
    case 'error': return '#f44336';
    default: return '#9e9e9e';
  }
};

/**
 * Get color gradient based on value
 */
const getGradientColor = (value: number, min: number, max: number): string => {
  const normalized = (value - min) / (max - min);
  const hue = (1 - normalized) * 120; // Red to green
  return `hsl(${hue}, 100%, 50%)`;
};

/**
 * RoverTrajectory3D Component
 */
export const RoverTrajectory3D: React.FC<RoverTrajectory3DProps> = ({
  positions,
  terrain,
  waypoints = [],
  obstacles = [],
  onTimeChange,
  className
}) => {
  const [chart3D, setChart3D] = useState<Chart3DAPI | null>(null);
  const [viewMode, setViewMode] = useState<'trajectory' | 'speed' | 'battery' | 'signal'>('trajectory');
  const [showTerrain, setShowTerrain] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showObstacles, setShowObstacles] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [trailLength, setTrailLength] = useState(100);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedPosition, setSelectedPosition] = useState<RoverPosition | null>(null);

  // Animation
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Calculate bounds
  const bounds = React.useMemo(() => {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    
    positions.forEach(pos => {
      min.x = Math.min(min.x, pos.x);
      min.y = Math.min(min.y, pos.y);
      min.z = Math.min(min.z, pos.z);
      max.x = Math.max(max.x, pos.x);
      max.y = Math.max(max.y, pos.y);
      max.z = Math.max(max.z, pos.z);
    });
    
    return { min, max };
  }, [positions]);

  // Update trajectory visualization
  useEffect(() => {
    if (!chart3D || positions.length === 0) return;

    // Clear existing data
    chart3D.removeTrajectory('rover-path');
    chart3D.removeScatterData('rover-positions');

    // Prepare trajectory data based on view mode
    const trajectoryPoints: DataPoint3D[] = positions.map(pos => {
      let color = '#ffffff';
      let value = 0;

      switch (viewMode) {
        case 'trajectory':
          color = getStatusColor(pos.status);
          break;
        case 'speed':
          color = getGradientColor(pos.speed, 0, 10); // Assuming max speed 10 m/s
          value = pos.speed;
          break;
        case 'battery':
          color = getGradientColor(pos.battery, 0, 100);
          value = pos.battery;
          break;
        case 'signal':
          color = getGradientColor(pos.signalStrength, 0, 100);
          value = pos.signalStrength;
          break;
      }

      return {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        timestamp: pos.timestamp,
        value,
        color,
        label: `Time: ${new Date(pos.timestamp).toLocaleTimeString()}`,
        metadata: pos
      };
    });

    // Add trajectory
    if (showTrail) {
      const startIdx = Math.max(0, Math.floor(currentTime) - trailLength);
      const endIdx = Math.min(positions.length, Math.floor(currentTime) + 1);
      
      chart3D.addTrajectory({
        id: 'rover-path',
        name: 'Rover Trajectory',
        points: trajectoryPoints.slice(startIdx, endIdx),
        color: '#00ff00',
        lineWidth: 3,
        showLine: true,
        showPoints: false,
        interpolation: 'spline'
      });
    }

    // Add current position
    if (currentTime < positions.length) {
      const currentPos = trajectoryPoints[Math.floor(currentTime)];
      chart3D.addScatterData({
        id: 'rover-positions',
        name: 'Current Position',
        points: [currentPos],
        pointSize: 10,
        pointShape: 'sphere'
      });
    }
  }, [chart3D, positions, viewMode, showTrail, trailLength, currentTime]);

  // Update terrain
  useEffect(() => {
    if (!chart3D || !terrain) return;

    if (showTerrain) {
      chart3D.addTerrain({
        id: 'mars-terrain',
        name: 'Mars Terrain',
        width: terrain.width,
        height: terrain.height,
        heightMap: terrain.heightMap,
        scale: new THREE.Vector3(1, 0.1, 1), // Scale down height
        wireframe: false
      });
    } else {
      chart3D.removeTerrain('mars-terrain');
    }
  }, [chart3D, terrain, showTerrain]);

  // Update waypoints
  useEffect(() => {
    if (!chart3D) return;

    // Clear existing waypoints
    waypoints.forEach(wp => {
      chart3D.removeAnnotation(`waypoint-${wp.id}`);
      chart3D.removeScatterData(`waypoint-marker-${wp.id}`);
    });

    if (showWaypoints) {
      waypoints.forEach(wp => {
        // Add marker
        chart3D.addScatterData({
          id: `waypoint-marker-${wp.id}`,
          name: wp.name,
          points: [{
            x: wp.position.x,
            y: wp.position.y,
            z: wp.position.z,
            color: wp.type === 'start' ? '#00ff00' :
                   wp.type === 'end' ? '#ff0000' :
                   wp.type === 'charging' ? '#2196f3' :
                   wp.type === 'science' ? '#ff9800' : '#ffffff'
          }],
          pointSize: 15,
          pointShape: wp.type === 'charging' ? 'cylinder' : 'sphere'
        });

        // Add label
        chart3D.addAnnotation({
          id: `waypoint-${wp.id}`,
          position: new THREE.Vector3(wp.position.x, wp.position.y + 5, wp.position.z),
          text: wp.name,
          style: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            fontSize: 14,
            padding: 8
          }
        });
      });
    }
  }, [chart3D, waypoints, showWaypoints]);

  // Update obstacles
  useEffect(() => {
    if (!chart3D) return;

    // Clear existing obstacles
    obstacles.forEach(obs => {
      chart3D.removeScatterData(`obstacle-${obs.id}`);
    });

    if (showObstacles) {
      obstacles.forEach(obs => {
        // Generate points for obstacle visualization
        const points: DataPoint3D[] = [];
        const numPoints = 20;
        
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          points.push({
            x: obs.position.x + Math.cos(angle) * obs.radius,
            y: obs.position.y,
            z: obs.position.z + Math.sin(angle) * obs.radius,
            color: obs.type === 'rock' ? '#8b4513' :
                   obs.type === 'crater' ? '#444444' : '#ff5722'
          });
        }

        chart3D.addScatterData({
          id: `obstacle-${obs.id}`,
          name: `Obstacle: ${obs.type}`,
          points,
          pointSize: 5
        });
      });
    }
  }, [chart3D, obstacles, showObstacles]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !positions.length) return;

    const animate = (timestamp: number) => {
      const deltaTime = timestamp - lastUpdateRef.current;
      lastUpdateRef.current = timestamp;

      setCurrentTime(prev => {
        const next = prev + (deltaTime * 0.001 * playbackSpeed);
        if (next >= positions.length) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    lastUpdateRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, positions.length]);

  // Handle time change
  useEffect(() => {
    if (onTimeChange && currentTime < positions.length) {
      const pos = positions[Math.floor(currentTime)];
      onTimeChange(pos.timestamp);
      setSelectedPosition(pos);
    }
  }, [currentTime, positions, onTimeChange]);

  // Handle chart ready
  const handleChartReady = useCallback((api: Chart3DAPI) => {
    setChart3D(api);
    
    // Set initial camera position
    const center = {
      x: (bounds.min.x + bounds.max.x) / 2,
      y: (bounds.min.y + bounds.max.y) / 2,
      z: (bounds.min.z + bounds.max.z) / 2
    };
    
    const distance = Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z
    ) * 2;
    
    api.setCameraPosition(new THREE.Vector3(
      center.x + distance,
      center.y + distance,
      center.z + distance
    ));
    
    api.setCameraLookAt(new THREE.Vector3(center.x, center.y, center.z));
  }, [bounds]);

  // Export trajectory
  const exportTrajectory = useCallback(async () => {
    if (!chart3D) return;
    
    try {
      const blob = await chart3D.exportModel('gltf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rover-trajectory-${Date.now()}.gltf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [chart3D]);

  return (
    <Box className={className} sx={{ display: 'flex', gap: 2, height: '100%' }}>
      {/* 3D Visualization */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Chart3D
          width="100%"
          height="100%"
          config={{
            axis: {
              show: true,
              labels: {
                x: 'East (m)',
                y: 'Elevation (m)',
                z: 'North (m)'
              }
            },
            background: '#1a1a1a'
          }}
          onReady={handleChartReady}
        />

        {/* Playback controls */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 2,
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <IconButton
            onClick={() => setIsPlaying(!isPlaying)}
            sx={{ color: 'white' }}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </IconButton>

          <Slider
            value={currentTime}
            onChange={(_, value) => setCurrentTime(value as number)}
            max={positions.length - 1}
            sx={{ width: 200, color: 'white' }}
          />

          <Typography variant="caption" sx={{ color: 'white', minWidth: 100 }}>
            {currentTime < positions.length && 
              new Date(positions[Math.floor(currentTime)].timestamp).toLocaleTimeString()
            }
          </Typography>

          <Select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            size="small"
            sx={{ 
              color: 'white',
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
              minWidth: 80
            }}
          >
            <MenuItem value={0.5}>0.5x</MenuItem>
            <MenuItem value={1}>1x</MenuItem>
            <MenuItem value={2}>2x</MenuItem>
            <MenuItem value={5}>5x</MenuItem>
            <MenuItem value={10}>10x</MenuItem>
          </Select>
        </Box>
      </Box>

      {/* Controls Panel */}
      <Card sx={{ width: 320, overflow: 'auto' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Rover Trajectory 3D
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* View Mode */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>View Mode</InputLabel>
            <Select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              label="View Mode"
            >
              <MenuItem value="trajectory">Status Trajectory</MenuItem>
              <MenuItem value="speed">Speed Heatmap</MenuItem>
              <MenuItem value="battery">Battery Level</MenuItem>
              <MenuItem value="signal">Signal Strength</MenuItem>
            </Select>
          </FormControl>

          {/* Display Options */}
          <Typography variant="subtitle2" gutterBottom>
            Display Options
          </Typography>
          
          <Stack spacing={1} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showTerrain}
                  onChange={(e) => setShowTerrain(e.target.checked)}
                />
              }
              label="Show Terrain"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showWaypoints}
                  onChange={(e) => setShowWaypoints(e.target.checked)}
                />
              }
              label="Show Waypoints"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showObstacles}
                  onChange={(e) => setShowObstacles(e.target.checked)}
                />
              }
              label="Show Obstacles"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={showTrail}
                  onChange={(e) => setShowTrail(e.target.checked)}
                />
              }
              label="Show Trail"
            />
          </Stack>

          {/* Trail Length */}
          {showTrail && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Trail Length: {trailLength} points
              </Typography>
              <Slider
                value={trailLength}
                onChange={(_, value) => setTrailLength(value as number)}
                min={10}
                max={500}
                step={10}
              />
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Current Position Info */}
          {selectedPosition && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Current Position
              </Typography>
              
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LocationIcon fontSize="small" />
                  <Typography variant="body2">
                    ({selectedPosition.x.toFixed(1)}, {selectedPosition.y.toFixed(1)}, {selectedPosition.z.toFixed(1)}) m
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SpeedIcon fontSize="small" />
                  <Typography variant="body2">
                    {selectedPosition.speed.toFixed(1)} m/s
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BatteryIcon fontSize="small" />
                  <Typography variant="body2">
                    {selectedPosition.battery.toFixed(0)}%
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SignalIcon fontSize="small" />
                  <Typography variant="body2">
                    {selectedPosition.signalStrength.toFixed(0)}%
                  </Typography>
                </Box>
                
                <Chip
                  label={selectedPosition.status.toUpperCase()}
                  color={
                    selectedPosition.status === 'moving' ? 'success' :
                    selectedPosition.status === 'charging' ? 'info' :
                    selectedPosition.status === 'error' ? 'error' : 'default'
                  }
                  size="small"
                />
              </Stack>
            </>
          )}

          {/* Export */}
          <Button
            fullWidth
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={exportTrajectory}
          >
            Export 3D Model
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RoverTrajectory3D;