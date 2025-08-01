/**
 * PerformanceMonitor Component
 * 
 * Comprehensive performance monitoring for Three.js visualization
 * Tracks FPS, memory usage, draw calls, and render times
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memory: {
    geometries: number;
    textures: number;
    programs: number;
  };
  render: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
  };
}

interface PerformanceMonitorProps {
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
  sampleRate?: number; // How often to update metrics (in frames)
}

export function PerformanceMonitor({ 
  onMetricsUpdate, 
  sampleRate = 60 
}: PerformanceMonitorProps) {
  const { gl } = useThree();
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const metrics = useRef<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memory: {
      geometries: 0,
      textures: 0,
      programs: 0
    },
    render: {
      calls: 0,
      triangles: 0,
      points: 0,
      lines: 0
    }
  });

  useFrame(() => {
    frameCount.current++;

    if (frameCount.current % sampleRate === 0) {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime.current;
      const fps = Math.round((sampleRate * 1000) / deltaTime);
      const frameTime = deltaTime / sampleRate;

      // Get renderer info
      const info = gl.info;
      
      metrics.current = {
        fps,
        frameTime,
        memory: {
          geometries: info.memory.geometries,
          textures: info.memory.textures,
          programs: info.programs?.length || 0
        },
        render: {
          calls: info.render.calls,
          triangles: info.render.triangles,
          points: info.render.points,
          lines: info.render.lines
        }
      };

      // Reset render info for next sample
      info.reset();
      
      // Update callback
      if (onMetricsUpdate) {
        onMetricsUpdate(metrics.current);
      }

      lastTime.current = currentTime;
    }
  });

  return null;
}

/**
 * Performance HUD Component
 * Displays performance metrics as an overlay
 */
export function PerformanceHUD({ position = 'top-right' }: { position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memory: { geometries: 0, textures: 0, programs: 0 },
    render: { calls: 0, triangles: 0, points: 0, lines: 0 }
  });

  const positionStyles = {
    'top-left': { top: 10, left: 10 },
    'top-right': { top: 10, right: 10 },
    'bottom-left': { bottom: 10, left: 10 },
    'bottom-right': { bottom: 10, right: 10 }
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return '#00ff00';
    if (fps >= 30) return '#ffff00';
    return '#ff0000';
  };

  return (
    <>
      <PerformanceMonitor onMetricsUpdate={setMetrics} sampleRate={30} />
      <div
        style={{
          position: 'absolute',
          ...positionStyles[position],
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '11px',
          lineHeight: '1.4',
          pointerEvents: 'none',
          zIndex: 1000,
          minWidth: '150px'
        }}
      >
        <div style={{ color: getFPSColor(metrics.fps), fontWeight: 'bold' }}>
          FPS: {metrics.fps}
        </div>
        <div>Frame: {metrics.frameTime.toFixed(2)}ms</div>
        <div style={{ marginTop: '4px', borderTop: '1px solid #444', paddingTop: '4px' }}>
          <div>Calls: {metrics.render.calls}</div>
          <div>Tris: {(metrics.render.triangles / 1000).toFixed(1)}k</div>
        </div>
        <div style={{ marginTop: '4px', borderTop: '1px solid #444', paddingTop: '4px' }}>
          <div>Geom: {metrics.memory.geometries}</div>
          <div>Tex: {metrics.memory.textures}</div>
          <div>Prog: {metrics.memory.programs}</div>
        </div>
      </div>
    </>
  );
}

/**
 * Performance logger for development
 */
export function usePerformanceLogger(threshold = 16.67) { // 60 FPS threshold
  const slowFrames = useRef(0);
  const totalFrames = useRef(0);

  useFrame((state, delta) => {
    totalFrames.current++;
    
    const frameTime = delta * 1000; // Convert to ms
    if (frameTime > threshold) {
      slowFrames.current++;
      
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Slow frame detected: ${frameTime.toFixed(2)}ms (target: ${threshold}ms)`);
      }
    }

    // Log performance summary every 5 seconds
    if (totalFrames.current % 300 === 0 && process.env.NODE_ENV === 'development') {
      const slowPercentage = (slowFrames.current / totalFrames.current) * 100;
      console.log(`Performance Summary: ${slowPercentage.toFixed(1)}% slow frames (${slowFrames.current}/${totalFrames.current})`);
    }
  });
}

export default PerformanceMonitor;