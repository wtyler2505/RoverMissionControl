/**
 * RealTimeStreamChart - High-performance streaming chart component
 * Optimized for real-time telemetry visualization with WebGL acceleration
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography, IconButton, Tooltip, Stack, Chip, alpha } from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  FiberManualRecord,
  Warning,
  Error as ErrorIcon,
  Speed,
  Timeline,
  SignalCellularAlt
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { StreamingDataBuffer } from '../../services/streaming/StreamingDataBuffer';
import {
  StreamVisualizationState,
  StreamRenderConfig,
  StreamPerformanceStats,
  StreamingIndicatorStatus,
  StreamingBufferConfig,
  StreamInteractionEvent
} from '../../types/streaming';
import { TelemetryDataPoint } from '../../services/websocket/TelemetryManager';

/**
 * Props for RealTimeStreamChart
 */
export interface RealTimeStreamChartProps {
  streamId: string;
  streamName: string;
  bufferConfig: StreamingBufferConfig;
  renderConfig: StreamRenderConfig;
  height?: number;
  showStats?: boolean;
  showIndicators?: boolean;
  onInteraction?: (event: StreamInteractionEvent) => void;
  onStatusChange?: (status: StreamingIndicatorStatus) => void;
}

/**
 * Styled components
 */
const ChartContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  boxShadow: theme.shadows[1]
}));

const Canvas = styled('canvas')(({ theme }) => ({
  display: 'block',
  width: '100%',
  height: '100%',
  cursor: 'crosshair'
}));

const OverlayContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: theme.spacing(1),
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto'
  }
}));

const StatsOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(1),
  right: theme.spacing(1),
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.75rem',
  fontFamily: 'monospace'
}));

const StatusIndicator = styled(Box)<{ $status: string }>(({ theme, $status }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: theme.spacing(0.25, 0.75),
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: 
    $status === 'active' ? alpha(theme.palette.success.main, 0.1) :
    $status === 'paused' ? alpha(theme.palette.warning.main, 0.1) :
    $status === 'error' ? alpha(theme.palette.error.main, 0.1) :
    alpha(theme.palette.grey[500], 0.1),
  color:
    $status === 'active' ? theme.palette.success.main :
    $status === 'paused' ? theme.palette.warning.main :
    $status === 'error' ? theme.palette.error.main :
    theme.palette.grey[500],
  '& .MuiSvgIcon-root': {
    fontSize: '1rem',
    marginRight: theme.spacing(0.5)
  }
}));

/**
 * WebGL shader sources
 */
const VERTEX_SHADER = `
  attribute vec2 position;
  uniform mat4 transform;
  uniform float pointSize;
  
  void main() {
    gl_Position = transform * vec4(position, 0.0, 1.0);
    gl_PointSize = pointSize;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform vec4 color;
  uniform float opacity;
  uniform bool useGlow;
  
  void main() {
    if (useGlow) {
      float dist = length(gl_PointCoord - vec2(0.5));
      float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
      gl_FragColor = vec4(color.rgb, color.a * alpha * opacity);
    } else {
      gl_FragColor = vec4(color.rgb, color.a * opacity);
    }
  }
`;

/**
 * WebGL renderer for streaming data
 */
class StreamRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private positionBuffer: WebGLBuffer;
  private attributes: {
    position: number;
  };
  private uniforms: {
    transform: WebGLUniformLocation;
    color: WebGLUniformLocation;
    opacity: WebGLUniformLocation;
    pointSize: WebGLUniformLocation;
    useGlow: WebGLUniformLocation;
  };
  private transform = new Float32Array(16);
  
  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    });
    
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    
    this.gl = gl;
    this.program = this.createProgram();
    this.positionBuffer = gl.createBuffer()!;
    
    // Get attribute and uniform locations
    this.attributes = {
      position: gl.getAttribLocation(this.program, 'position')
    };
    
    this.uniforms = {
      transform: gl.getUniformLocation(this.program, 'transform')!,
      color: gl.getUniformLocation(this.program, 'color')!,
      opacity: gl.getUniformLocation(this.program, 'opacity')!,
      pointSize: gl.getUniformLocation(this.program, 'pointSize')!,
      useGlow: gl.getUniformLocation(this.program, 'useGlow')!
    };
    
    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Initialize transform matrix (identity)
    this.setIdentityMatrix();
  }
  
  render(
    data: TelemetryDataPoint[],
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    config: StreamRenderConfig
  ): void {
    const gl = this.gl;
    
    // Clear
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    if (data.length === 0) return;
    
    // Convert data to vertices
    const vertices = new Float32Array(data.length * 2);
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const x = (point.timestamp - bounds.minX) / (bounds.maxX - bounds.minX) * 2 - 1;
      const y = (point.value - bounds.minY) / (bounds.maxY - bounds.minY) * 2 - 1;
      vertices[i * 2] = x;
      vertices[i * 2 + 1] = y;
    }
    
    // Upload vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    
    // Use program
    gl.useProgram(this.program);
    
    // Set attributes
    gl.enableVertexAttribArray(this.attributes.position);
    gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 0, 0);
    
    // Set uniforms
    gl.uniformMatrix4fv(this.uniforms.transform, false, this.transform);
    const color = this.hexToRgb(config.color);
    gl.uniform4f(this.uniforms.color, color.r, color.g, color.b, 1.0);
    gl.uniform1f(this.uniforms.opacity, config.opacity || 1.0);
    gl.uniform1f(this.uniforms.pointSize, config.pointRadius || 2.0);
    gl.uniform1i(this.uniforms.useGlow, config.glowEffect ? 1 : 0);
    
    // Draw line strip
    gl.lineWidth(config.lineWidth);
    gl.drawArrays(gl.LINE_STRIP, 0, data.length);
    
    // Draw points if enabled
    if (config.showPoints) {
      gl.drawArrays(gl.POINTS, 0, data.length);
    }
  }
  
  resize(width: number, height: number): void {
    this.gl.viewport(0, 0, width, height);
  }
  
  destroy(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteBuffer(this.positionBuffer);
  }
  
  private createProgram(): WebGLProgram {
    const gl = this.gl;
    
    const vertexShader = this.createShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Failed to link program: ' + gl.getProgramInfoLog(program));
    }
    
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    return program;
  }
  
  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Failed to compile shader: ' + gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }
  
  private setIdentityMatrix(): void {
    this.transform.fill(0);
    this.transform[0] = 1;
    this.transform[5] = 1;
    this.transform[10] = 1;
    this.transform[15] = 1;
  }
  
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
  }
}

/**
 * RealTimeStreamChart component
 */
export const RealTimeStreamChart: React.FC<RealTimeStreamChartProps> = ({
  streamId,
  streamName,
  bufferConfig,
  renderConfig,
  height = 300,
  showStats = true,
  showIndicators = true,
  onInteraction,
  onStatusChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<StreamRenderer | null>(null);
  const animationRef = useRef<number>();
  const bufferRef = useRef<StreamingDataBuffer>();
  const statsRef = useRef<StreamPerformanceStats>({
    fps: 0,
    renderTime: 0,
    dataRate: 0,
    droppedFrames: 0,
    bufferUtilization: 0,
    latency: 0
  });
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [status, setStatus] = useState<StreamingIndicatorStatus>({
    streamId,
    status: 'active',
    dataRate: 0,
    latency: 0,
    quality: 1,
    bufferHealth: 1,
    alerts: []
  });
  
  // Initialize buffer
  useEffect(() => {
    bufferRef.current = new StreamingDataBuffer(bufferConfig);
  }, [bufferConfig]);
  
  // Initialize WebGL renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    
    try {
      rendererRef.current = new StreamRenderer(canvasRef.current);
    } catch (error) {
      console.error('Failed to initialize WebGL renderer:', error);
      setStatus(prev => ({
        ...prev,
        status: 'error',
        alerts: [{
          id: 'webgl-init',
          streamId,
          type: 'connection',
          severity: 'error',
          message: 'WebGL initialization failed',
          timestamp: Date.now()
        }]
      }));
    }
    
    return () => {
      rendererRef.current?.destroy();
    };
  }, [streamId]);
  
  // Render loop
  const render = useCallback(() => {
    if (!rendererRef.current || !bufferRef.current || !canvasRef.current) return;
    
    const startTime = performance.now();
    
    // Get data from buffer
    const data = bufferRef.current.getAll();
    
    if (data.length > 0) {
      // Calculate bounds
      const now = Date.now();
      const minX = now - bufferConfig.windowSize;
      const maxX = now;
      
      let minY = Infinity;
      let maxY = -Infinity;
      
      for (const point of data) {
        if (typeof point.value === 'number') {
          minY = Math.min(minY, point.value);
          maxY = Math.max(maxY, point.value);
        }
      }
      
      // Add padding
      const padding = (maxY - minY) * 0.1;
      minY -= padding;
      maxY += padding;
      
      // Render
      rendererRef.current.render(data, { minX, maxX, minY, maxY }, renderConfig);
    }
    
    // Update performance stats
    const renderTime = performance.now() - startTime;
    statsRef.current.renderTime = statsRef.current.renderTime * 0.9 + renderTime * 0.1;
    statsRef.current.fps = 1000 / (16.67); // Assuming 60 FPS target
    statsRef.current.bufferUtilization = bufferRef.current.getStatistics().utilization;
    
    // Continue animation
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(render);
    }
  }, [bufferConfig.windowSize, renderConfig, isPlaying]);
  
  // Start/stop animation
  useEffect(() => {
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(render);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, render]);
  
  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !rendererRef.current) return;
      
      const rect = canvasRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width * window.devicePixelRatio;
      canvasRef.current.height = rect.height * window.devicePixelRatio;
      
      rendererRef.current.resize(canvasRef.current.width, canvasRef.current.height);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Add test data for demo
  useEffect(() => {
    if (!bufferRef.current) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const value = Math.sin(now / 1000) * 50 + Math.random() * 10 + 50;
      
      bufferRef.current.push({
        timestamp: now,
        value,
        quality: 0.95 + Math.random() * 0.05
      });
      
      // Update data rate
      statsRef.current.dataRate = 1000 / bufferConfig.updateInterval;
    }, bufferConfig.updateInterval);
    
    return () => clearInterval(interval);
  }, [bufferConfig.updateInterval]);
  
  // Update status
  useEffect(() => {
    const interval = setInterval(() => {
      const newStatus: StreamingIndicatorStatus = {
        streamId,
        status: isPlaying ? 'active' : 'paused',
        dataRate: statsRef.current.dataRate,
        latency: statsRef.current.latency,
        quality: 0.95 + Math.random() * 0.05,
        bufferHealth: statsRef.current.bufferUtilization < 0.9 ? 1 : 0.5,
        alerts: []
      };
      
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [streamId, isPlaying, onStatusChange]);
  
  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  };
  
  const handleStop = () => {
    setIsPlaying(false);
    bufferRef.current?.clear();
  };
  
  return (
    <ChartContainer sx={{ height }}>
      <Canvas ref={canvasRef} />
      
      <OverlayContainer>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" fontWeight="bold">
              {streamName}
            </Typography>
            
            {showIndicators && (
              <>
                <StatusIndicator $status={status.status}>
                  {status.status === 'active' && <FiberManualRecord />}
                  {status.status === 'paused' && <Pause />}
                  {status.status === 'error' && <ErrorIcon />}
                  {status.status}
                </StatusIndicator>
                
                <Chip
                  size="small"
                  icon={<Speed />}
                  label={`${status.dataRate.toFixed(0)} Hz`}
                  variant="outlined"
                />
                
                <Chip
                  size="small"
                  icon={<Timeline />}
                  label={`${status.latency.toFixed(0)} ms`}
                  variant="outlined"
                />
                
                <Chip
                  size="small"
                  icon={<SignalCellularAlt />}
                  label={`${(status.quality * 100).toFixed(0)}%`}
                  variant="outlined"
                  color={status.quality > 0.9 ? 'success' : status.quality > 0.7 ? 'warning' : 'error'}
                />
              </>
            )}
          </Stack>
          
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
              <IconButton size="small" onClick={handlePlayPause}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Stop">
              <IconButton size="small" onClick={handleStop}>
                <Stop />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </OverlayContainer>
      
      {showStats && (
        <StatsOverlay>
          <div>FPS: {statsRef.current.fps.toFixed(0)}</div>
          <div>Render: {statsRef.current.renderTime.toFixed(1)}ms</div>
          <div>Buffer: {(statsRef.current.bufferUtilization * 100).toFixed(0)}%</div>
          <div>Points: {bufferRef.current?.size || 0}</div>
        </StatsOverlay>
      )}
    </ChartContainer>
  );
};

export default RealTimeStreamChart;