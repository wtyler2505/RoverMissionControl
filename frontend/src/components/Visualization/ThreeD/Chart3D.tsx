/**
 * Chart3D Component
 * High-level 3D visualization component with full API
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Box, Paper, IconButton, Tooltip, CircularProgress } from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  PhotoCamera as ScreenshotIcon,
  Refresh as ResetIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';

import Scene3D from './Scene3D';
import {
  Chart3DProps,
  Chart3DConfig,
  Chart3DAPI,
  TrajectoryData,
  ScatterData3D,
  TerrainData,
  Annotation3D,
  DataPoint3D,
  ExportConfig,
} from './types';

// Default configuration
const DEFAULT_CONFIG: Chart3DConfig = {
  camera: {
    position: new THREE.Vector3(50, 50, 50),
    lookAt: new THREE.Vector3(0, 0, 0),
    fov: 75,
    near: 0.1,
    far: 1000,
    type: 'perspective'
  },
  lighting: {
    ambient: {
      color: '#ffffff',
      intensity: 0.5
    },
    directional: [
      {
        position: new THREE.Vector3(10, 10, 5),
        color: '#ffffff',
        intensity: 1,
        castShadow: true
      }
    ]
  },
  axis: {
    show: true,
    labels: {
      x: 'X',
      y: 'Y',
      z: 'Z'
    },
    grid: {
      xy: true,
      color: '#666666',
      opacity: 0.5
    }
  },
  animation: {
    enabled: false,
    speed: 1,
    loop: true,
    autoRotate: false,
    rotationSpeed: 1
  },
  interaction: {
    enableZoom: true,
    enablePan: true,
    enableRotate: true,
    enableSelection: true,
    enableTooltips: true,
    mouseSpeed: 1,
    touchSpeed: 1
  },
  performance: {
    maxPoints: 100000,
    decimation: true,
    lod: true,
    antialiasing: true,
    shadowQuality: 'medium',
    pixelRatio: window.devicePixelRatio
  },
  background: '#000000'
};

/**
 * Main Chart3D component
 */
export const Chart3D: React.FC<Chart3DProps> = ({
  width,
  height,
  config: userConfig,
  onReady,
  onError,
  className
}) => {
  // State
  const [trajectories, setTrajectories] = useState<Map<string, TrajectoryData>>(new Map());
  const [scatterData, setScatterData] = useState<Map<string, ScatterData3D>>(new Map());
  const [terrain, setTerrain] = useState<Map<string, TerrainData>>(new Map());
  const [annotations, setAnnotations] = useState<Map<string, Annotation3D>>(new Map());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint3D | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<DataPoint3D | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const apiRef = useRef<Chart3DAPI | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Merge configurations
  const config = useMemo(() => {
    return {
      ...DEFAULT_CONFIG,
      ...userConfig,
      camera: { ...DEFAULT_CONFIG.camera, ...userConfig?.camera },
      lighting: { ...DEFAULT_CONFIG.lighting, ...userConfig?.lighting },
      axis: { ...DEFAULT_CONFIG.axis, ...userConfig?.axis },
      animation: { ...DEFAULT_CONFIG.animation, ...userConfig?.animation },
      interaction: { ...DEFAULT_CONFIG.interaction, ...userConfig?.interaction },
      performance: { ...DEFAULT_CONFIG.performance, ...userConfig?.performance }
    };
  }, [userConfig]);

  // API implementation
  const api: Chart3DAPI = useMemo(() => ({
    // Trajectory management
    addTrajectory: (data: TrajectoryData) => {
      setTrajectories(prev => new Map(prev).set(data.id, data));
    },
    
    updateTrajectory: (id: string, data: Partial<TrajectoryData>) => {
      setTrajectories(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, ...data });
        }
        return newMap;
      });
    },
    
    removeTrajectory: (id: string) => {
      setTrajectories(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    },

    // Scatter data management
    addScatterData: (data: ScatterData3D) => {
      setScatterData(prev => new Map(prev).set(data.id, data));
    },
    
    updateScatterData: (id: string, data: Partial<ScatterData3D>) => {
      setScatterData(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, ...data });
        }
        return newMap;
      });
    },
    
    removeScatterData: (id: string) => {
      setScatterData(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    },

    // Terrain management
    addTerrain: (data: TerrainData) => {
      setTerrain(prev => new Map(prev).set(data.id, data));
    },
    
    updateTerrain: (id: string, data: Partial<TerrainData>) => {
      setTerrain(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, ...data });
        }
        return newMap;
      });
    },
    
    removeTerrain: (id: string) => {
      setTerrain(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    },

    // Annotation management
    addAnnotation: (annotation: Annotation3D) => {
      setAnnotations(prev => new Map(prev).set(annotation.id, annotation));
    },
    
    updateAnnotation: (id: string, annotation: Partial<Annotation3D>) => {
      setAnnotations(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, ...annotation });
        }
        return newMap;
      });
    },
    
    removeAnnotation: (id: string) => {
      setAnnotations(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
    },

    // Camera control
    setCameraPosition: (position: THREE.Vector3) => {
      if (sceneRef.current) {
        sceneRef.current.setCameraPosition(position);
      }
    },
    
    setCameraLookAt: (target: THREE.Vector3) => {
      if (sceneRef.current) {
        sceneRef.current.setCameraLookAt(target);
      }
    },
    
    resetCamera: () => {
      if (sceneRef.current) {
        sceneRef.current.resetCamera();
      }
    },
    
    fitToData: () => {
      if (sceneRef.current) {
        sceneRef.current.fitToData();
      }
    },

    // Animation control
    play: () => {
      setIsPlaying(true);
    },
    
    pause: () => {
      setIsPlaying(false);
    },
    
    reset: () => {
      setIsPlaying(false);
      animationFrameRef.current = 0;
    },
    
    setAnimationTime: (time: number) => {
      animationFrameRef.current = time;
    },

    // Export functionality
    exportImage: async (exportConfig?: Partial<ExportConfig>) => {
      const cfg = { format: 'png', quality: 0.95, ...exportConfig };
      
      if (sceneRef.current) {
        const canvas = sceneRef.current.getCanvas();
        return new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to export image'));
            },
            `image/${cfg.format}`,
            cfg.quality
          );
        });
      }
      
      throw new Error('Scene not ready');
    },
    
    exportModel: async (format: 'gltf' | 'obj') => {
      if (!sceneRef.current) throw new Error('Scene not ready');
      
      const scene = sceneRef.current.getScene();
      
      if (format === 'gltf') {
        const exporter = new GLTFExporter();
        return new Promise<Blob>((resolve, reject) => {
          exporter.parse(
            scene,
            (gltf) => {
              const blob = new Blob([JSON.stringify(gltf)], { type: 'application/json' });
              resolve(blob);
            },
            { binary: false },
            (error) => reject(error)
          );
        });
      } else {
        const exporter = new OBJExporter();
        const obj = exporter.parse(scene);
        return new Blob([obj], { type: 'text/plain' });
      }
    },

    // Utility functions
    getDataBounds: () => {
      const bounds = new THREE.Box3();
      
      // Calculate bounds from all data
      trajectories.forEach(trajectory => {
        trajectory.points.forEach(point => {
          bounds.expandByPoint(new THREE.Vector3(point.x, point.y, point.z));
        });
      });
      
      scatterData.forEach(scatter => {
        scatter.points.forEach(point => {
          bounds.expandByPoint(new THREE.Vector3(point.x, point.y, point.z));
        });
      });
      
      return {
        min: bounds.min,
        max: bounds.max
      };
    },
    
    pick: (x: number, y: number) => {
      // Implement raycasting pick
      return null;
    },
    
    highlightPoint: (point: DataPoint3D) => {
      setSelectedPoint(point);
    },
    
    clearHighlights: () => {
      setSelectedPoint(null);
    }
  }), [trajectories, scatterData, terrain, annotations]);

  // Store API reference
  useEffect(() => {
    apiRef.current = api;
    if (onReady) {
      onReady(api);
    }
  }, [api, onReady]);

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle screenshot
  const takeScreenshot = useCallback(async () => {
    try {
      const blob = await api.exportImage({ format: 'png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chart3d-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (onError) onError(error as Error);
    }
  }, [api, onError]);

  // Animation loop
  useEffect(() => {
    let animationId: number;
    
    if (isPlaying && config.animation.enabled) {
      const animate = () => {
        animationFrameRef.current += config.animation.speed;
        
        // Update animation state
        // This would trigger trajectory animations, etc.
        
        if (config.animation.loop && animationFrameRef.current > 100) {
          animationFrameRef.current = 0;
        }
        
        animationId = requestAnimationFrame(animate);
      };
      
      animationId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isPlaying, config.animation]);

  // Handle scene ready
  const handleSceneReady = useCallback((sceneApi: any) => {
    sceneRef.current = sceneApi;
  }, []);

  // Convert state maps to arrays
  const trajectoriesArray = useMemo(() => Array.from(trajectories.values()), [trajectories]);
  const scatterArray = useMemo(() => Array.from(scatterData.values()), [scatterData]);
  const terrainArray = useMemo(() => Array.from(terrain.values()), [terrain]);
  const annotationsArray = useMemo(() => 
    showAnnotations ? Array.from(annotations.values()) : [], 
    [annotations, showAnnotations]
  );

  return (
    <Paper
      ref={containerRef}
      className={className}
      sx={{
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: config.background
      }}
    >
      {/* Loading indicator */}
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* Controls toolbar */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          gap: 1,
          zIndex: 100,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 1,
          padding: 0.5
        }}
      >
        {config.animation.enabled && (
          <>
            <Tooltip title={isPlaying ? "Pause" : "Play"}>
              <IconButton
                size="small"
                onClick={() => isPlaying ? api.pause() : api.play()}
                sx={{ color: 'white' }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Reset">
              <IconButton
                size="small"
                onClick={() => api.reset()}
                sx={{ color: 'white' }}
              >
                <ResetIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
        
        <Tooltip title="Reset Camera">
          <IconButton
            size="small"
            onClick={() => api.resetCamera()}
            sx={{ color: 'white' }}
          >
            <ResetIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title={showAnnotations ? "Hide Annotations" : "Show Annotations"}>
          <IconButton
            size="small"
            onClick={() => setShowAnnotations(!showAnnotations)}
            sx={{ color: 'white' }}
          >
            {showAnnotations ? <VisibilityIcon /> : <VisibilityOffIcon />}
          </IconButton>
        </Tooltip>
        
        <Tooltip title="Screenshot">
          <IconButton
            size="small"
            onClick={takeScreenshot}
            sx={{ color: 'white' }}
          >
            <ScreenshotIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          <IconButton
            size="small"
            onClick={toggleFullscreen}
            sx={{ color: 'white' }}
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Hover tooltip */}
      {hoveredPoint && config.interaction.enableTooltips && (
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            bottom: 16,
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: 1,
            borderRadius: 1,
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 100
          }}
        >
          {hoveredPoint.label || `(${hoveredPoint.x.toFixed(2)}, ${hoveredPoint.y.toFixed(2)}, ${hoveredPoint.z.toFixed(2)})`}
          {hoveredPoint.value !== undefined && ` - Value: ${hoveredPoint.value.toFixed(2)}`}
        </Box>
      )}

      {/* 3D Scene */}
      <Scene3D
        config={config}
        trajectories={trajectoriesArray}
        scatterData={scatterArray}
        terrain={terrainArray}
        annotations={annotationsArray}
        onReady={handleSceneReady}
        onPointClick={setSelectedPoint}
        onPointHover={setHoveredPoint}
      />
    </Paper>
  );
};

export default Chart3D;