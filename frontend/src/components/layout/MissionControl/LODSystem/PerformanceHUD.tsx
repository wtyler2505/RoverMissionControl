/**
 * PerformanceHUD Component
 * 
 * Real-time performance monitoring HUD for 3D visualization.
 * Displays FPS, frame time, memory usage, and performance graphs.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { Box, Typography, LinearProgress, Chip, IconButton, Collapse } from '@mui/material';
import { ExpandMore, ExpandLess, Warning, CheckCircle } from '@mui/icons-material';
import styled from '@emotion/styled';

// Styled components
const HUDContainer = styled(Box)`
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 12px;
  min-width: 300px;
  max-width: 400px;
  color: white;
  font-family: 'Roboto Mono', monospace;
  backdrop-filter: blur(10px);
  z-index: 1000;
  user-select: none;
`;

const MetricRow = styled(Box)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 8px 0;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  &:last-child {
    border-bottom: none;
  }
`;

const MetricLabel = styled(Typography)`
  font-size: 12px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const MetricValue = styled(Typography)<{ warning?: boolean; critical?: boolean }>`
  font-size: 14px;
  font-weight: bold;
  color: ${props => 
    props.critical ? '#ff5252' : 
    props.warning ? '#ffab00' : 
    '#4caf50'
  };
`;

const GraphContainer = styled(Box)`
  height: 60px;
  margin: 10px 0;
  opacity: 0.9;
`;

const StatusChip = styled(Chip)<{ status: 'good' | 'warning' | 'critical' }>`
  background-color: ${props => 
    props.status === 'critical' ? '#ff5252' : 
    props.status === 'warning' ? '#ffab00' : 
    '#4caf50'
  };
  color: white;
  font-size: 10px;
  height: 20px;
`;

// Performance data point
interface PerformanceDataPoint {
  timestamp: number;
  fps: number;
  frameTime: number;
  memory: number;
  drawCalls: number;
  triangles: number;
  gpu: number;
}

// Performance thresholds
const THRESHOLDS = {
  fps: { good: 55, warning: 30, critical: 20 },
  frameTime: { good: 18, warning: 33, critical: 50 },
  memory: { good: 200, warning: 400, critical: 600 },
  drawCalls: { good: 100, warning: 200, critical: 500 },
  triangles: { good: 100000, warning: 500000, critical: 1000000 }
};

interface PerformanceHUDProps {
  enabled?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  expanded?: boolean;
  historySize?: number;
  updateInterval?: number;
  showGraphs?: boolean;
  showWarnings?: boolean;
  onPerformanceIssue?: (issue: string) => void;
}

export const PerformanceHUD: React.FC<PerformanceHUDProps> = ({
  enabled = true,
  position = 'top-right',
  expanded: initialExpanded = false,
  historySize = 60,
  updateInterval = 100,
  showGraphs = true,
  showWarnings = true,
  onPerformanceIssue
}) => {
  const { gl, scene } = useThree();
  const [expanded, setExpanded] = useState(initialExpanded);
  const [performanceData, setPerformanceData] = useState<PerformanceDataPoint[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceDataPoint>({
    timestamp: 0,
    fps: 60,
    frameTime: 16.67,
    memory: 0,
    drawCalls: 0,
    triangles: 0,
    gpu: 0
  });
  
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const lastUpdateTime = useRef(performance.now());
  const frameTimes = useRef<number[]>([]);
  
  // Calculate performance status
  const getStatus = (metric: string, value: number): 'good' | 'warning' | 'critical' => {
    const threshold = THRESHOLDS[metric as keyof typeof THRESHOLDS];
    if (!threshold) return 'good';
    
    if (metric === 'fps') {
      if (value >= threshold.good) return 'good';
      if (value >= threshold.warning) return 'warning';
      return 'critical';
    } else {
      if (value <= threshold.good) return 'good';
      if (value <= threshold.warning) return 'warning';
      return 'critical';
    }
  };
  
  // Update performance metrics
  useFrame(() => {
    if (!enabled) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime.current;
    lastTime.current = currentTime;
    
    frameCount.current++;
    frameTimes.current.push(deltaTime);
    
    // Keep only recent frame times
    if (frameTimes.current.length > 60) {
      frameTimes.current.shift();
    }
    
    // Update metrics at specified interval
    if (currentTime - lastUpdateTime.current >= updateInterval) {
      lastUpdateTime.current = currentTime;
      
      // Calculate FPS and frame time
      const avgFrameTime = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length;
      const fps = 1000 / avgFrameTime;
      
      // Get render info
      const info = gl.info;
      const drawCalls = info.render.calls;
      const triangles = info.render.triangles;
      
      // Get memory info (if available)
      const memory = (performance as any).memory 
        ? (performance as any).memory.usedJSHeapSize / 1048576 
        : 0;
      
      const newMetrics: PerformanceDataPoint = {
        timestamp: currentTime,
        fps: Math.round(fps),
        frameTime: parseFloat(avgFrameTime.toFixed(2)),
        memory: Math.round(memory),
        drawCalls,
        triangles,
        gpu: 0 // Would need WebGL extension for real GPU usage
      };
      
      setCurrentMetrics(newMetrics);
      
      // Update history
      setPerformanceData(prev => {
        const newData = [...prev, newMetrics];
        if (newData.length > historySize) {
          newData.shift();
        }
        return newData;
      });
      
      // Check for performance issues
      if (showWarnings && onPerformanceIssue) {
        if (fps < THRESHOLDS.fps.critical) {
          onPerformanceIssue(`Critical: FPS dropped to ${Math.round(fps)}`);
        } else if (memory > THRESHOLDS.memory.critical) {
          onPerformanceIssue(`Critical: Memory usage at ${Math.round(memory)}MB`);
        }
      }
      
      // Reset frame counter
      frameCount.current = 0;
    }
  });
  
  if (!enabled) return null;
  
  // Position styles
  const positionStyles = {
    'top-left': { top: 10, left: 10, right: 'auto', bottom: 'auto' },
    'top-right': { top: 10, right: 10, left: 'auto', bottom: 'auto' },
    'bottom-left': { bottom: 10, left: 10, top: 'auto', right: 'auto' },
    'bottom-right': { bottom: 10, right: 10, top: 'auto', left: 'auto' }
  };
  
  return (
    <HUDContainer sx={positionStyles[position]}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h6" fontSize={14} fontWeight="bold">
          Performance Monitor
        </Typography>
        <Box display="flex" gap={1} alignItems="center">
          <StatusChip 
            size="small"
            label={getStatus('fps', currentMetrics.fps).toUpperCase()}
            status={getStatus('fps', currentMetrics.fps)}
          />
          <IconButton 
            size="small" 
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'white', padding: '2px' }}
          >
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
      </Box>
      
      {/* Basic Metrics - Always Visible */}
      <MetricRow>
        <MetricLabel>FPS</MetricLabel>
        <MetricValue 
          warning={getStatus('fps', currentMetrics.fps) === 'warning'}
          critical={getStatus('fps', currentMetrics.fps) === 'critical'}
        >
          {currentMetrics.fps}
        </MetricValue>
      </MetricRow>
      
      <MetricRow>
        <MetricLabel>Frame Time</MetricLabel>
        <MetricValue 
          warning={getStatus('frameTime', currentMetrics.frameTime) === 'warning'}
          critical={getStatus('frameTime', currentMetrics.frameTime) === 'critical'}
        >
          {currentMetrics.frameTime}ms
        </MetricValue>
      </MetricRow>
      
      {/* Expanded Metrics */}
      <Collapse in={expanded}>
        <Box mt={1}>
          <MetricRow>
            <MetricLabel>Memory</MetricLabel>
            <MetricValue 
              warning={getStatus('memory', currentMetrics.memory) === 'warning'}
              critical={getStatus('memory', currentMetrics.memory) === 'critical'}
            >
              {currentMetrics.memory}MB
            </MetricValue>
          </MetricRow>
          
          <MetricRow>
            <MetricLabel>Draw Calls</MetricLabel>
            <MetricValue 
              warning={getStatus('drawCalls', currentMetrics.drawCalls) === 'warning'}
              critical={getStatus('drawCalls', currentMetrics.drawCalls) === 'critical'}
            >
              {currentMetrics.drawCalls}
            </MetricValue>
          </MetricRow>
          
          <MetricRow>
            <MetricLabel>Triangles</MetricLabel>
            <MetricValue 
              warning={getStatus('triangles', currentMetrics.triangles) === 'warning'}
              critical={getStatus('triangles', currentMetrics.triangles) === 'critical'}
            >
              {(currentMetrics.triangles / 1000).toFixed(1)}K
            </MetricValue>
          </MetricRow>
          
          {/* Performance Graphs */}
          {showGraphs && performanceData.length > 1 && (
            <Box mt={2}>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                FPS History
              </Typography>
              <GraphContainer>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <YAxis hide domain={[0, 80]} />
                    <Line 
                      type="monotone" 
                      dataKey="fps" 
                      stroke="#4caf50" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </GraphContainer>
              
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                Frame Time History
              </Typography>
              <GraphContainer>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <YAxis hide domain={[0, 50]} />
                    <Line 
                      type="monotone" 
                      dataKey="frameTime" 
                      stroke="#ff9800" 
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </GraphContainer>
            </Box>
          )}
          
          {/* Performance Tips */}
          {showWarnings && (
            <Box mt={2} p={1} bgcolor="rgba(255, 152, 0, 0.1)" borderRadius={1}>
              <Typography variant="caption" display="flex" alignItems="center" gap={0.5}>
                <Warning fontSize="small" />
                {currentMetrics.fps < THRESHOLDS.fps.warning && 'Consider reducing quality settings'}
                {currentMetrics.memory > THRESHOLDS.memory.warning && 'High memory usage detected'}
                {currentMetrics.drawCalls > THRESHOLDS.drawCalls.warning && 'Too many draw calls'}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </HUDContainer>
  );
};

// Export HUD with performance context
export const PerformanceHUDWithContext: React.FC<PerformanceHUDProps> = (props) => {
  return (
    <Html>
      <PerformanceHUD {...props} />
    </Html>
  );
};