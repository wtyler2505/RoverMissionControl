/**
 * Scene3D Component
 * Core 3D visualization scene using React Three Fiber
 */

import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Grid, 
  PerspectiveCamera,
  Line,
  Points,
  Point,
  Text,
  Html,
  useTexture,
  Environment,
  Stats
} from '@react-three/drei';
import * as THREE from 'three';
import { 
  Chart3DConfig, 
  TrajectoryData, 
  ScatterData3D,
  TerrainData,
  Annotation3D,
  DataPoint3D,
  Chart3DAPI
} from './types';

interface Scene3DProps {
  config: Chart3DConfig;
  trajectories: TrajectoryData[];
  scatterData: ScatterData3D[];
  terrain: TerrainData[];
  annotations: Annotation3D[];
  onReady: (api: Chart3DAPI) => void;
  onPointClick?: (point: DataPoint3D) => void;
  onPointHover?: (point: DataPoint3D | null) => void;
}

/**
 * Trajectory visualization component
 */
const Trajectory: React.FC<{ data: TrajectoryData; config: Chart3DConfig }> = ({ data, config }) => {
  const points = useMemo(() => {
    return data.points.map(p => new THREE.Vector3(p.x, p.y, p.z));
  }, [data.points]);

  const lineGeometry = useMemo(() => {
    if (data.interpolation === 'spline' && points.length > 2) {
      const curve = new THREE.CatmullRomCurve3(points);
      const curvePoints = curve.getPoints(points.length * 10);
      return new THREE.BufferGeometry().setFromPoints(curvePoints);
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points, data.interpolation]);

  const pointsGeometry = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);
    
    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
      
      const color = new THREE.Color(data.points[i].color || data.color || '#ffffff');
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  }, [points, data]);

  return (
    <group>
      {data.showLine !== false && (
        <line geometry={lineGeometry}>
          <lineBasicMaterial 
            color={data.color || '#00ff00'} 
            linewidth={data.lineWidth || 2}
          />
        </line>
      )}
      
      {data.showPoints !== false && (
        <points geometry={pointsGeometry}>
          <pointsMaterial 
            size={5} 
            vertexColors
            sizeAttenuation={true}
          />
        </points>
      )}
    </group>
  );
};

/**
 * 3D scatter plot component
 */
const Scatter3D: React.FC<{ data: ScatterData3D; config: Chart3DConfig }> = ({ data, config }) => {
  const positions = useMemo(() => {
    const pos = new Float32Array(data.points.length * 3);
    data.points.forEach((point, i) => {
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
    });
    return pos;
  }, [data.points]);

  const colors = useMemo(() => {
    const cols = new Float32Array(data.points.length * 3);
    data.points.forEach((point, i) => {
      const color = new THREE.Color(point.color || '#ffffff');
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    });
    return cols;
  }, [data.points]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={data.pointSize || 5}
        vertexColors
        sizeAttenuation={true}
      />
    </points>
  );
};

/**
 * Terrain mesh component
 */
const TerrainMesh: React.FC<{ data: TerrainData; config: Chart3DConfig }> = ({ data, config }) => {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      data.width,
      data.height,
      data.heightMap.length - 1,
      data.heightMap[0].length - 1
    );

    const positions = geo.attributes.position;
    for (let i = 0; i < data.heightMap.length; i++) {
      for (let j = 0; j < data.heightMap[i].length; j++) {
        const index = i * data.heightMap[i].length + j;
        positions.setZ(index, data.heightMap[i][j]);
      }
    }

    geo.computeVertexNormals();
    return geo;
  }, [data]);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial 
        color="#8b7355"
        wireframe={data.wireframe}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

/**
 * 3D annotation component
 */
const Annotation3DComponent: React.FC<{ annotation: Annotation3D }> = ({ annotation }) => {
  const style = annotation.style || {};
  
  return (
    <Html
      position={[annotation.position.x, annotation.position.y, annotation.position.z]}
      distanceFactor={10}
      occlude={!annotation.alwaysOnTop}
      style={{
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          color: style.color || 'white',
          backgroundColor: style.backgroundColor || 'rgba(0, 0, 0, 0.8)',
          padding: style.padding || 8,
          borderRadius: style.borderRadius || 4,
          fontSize: style.fontSize || 12,
          fontFamily: style.fontFamily || 'Arial',
          whiteSpace: 'nowrap'
        }}
      >
        {annotation.text}
      </div>
    </Html>
  );
};

/**
 * Axis helper component
 */
const AxisHelper: React.FC<{ config: Chart3DConfig }> = ({ config }) => {
  const { axis } = config;
  
  if (!axis.show) return null;

  return (
    <>
      {/* Grid planes */}
      {axis.grid?.xy && (
        <Grid
          position={[0, 0, 0]}
          args={[100, 100]}
          cellSize={1}
          cellColor={axis.grid.color || '#666666'}
          sectionSize={10}
          sectionColor={axis.grid.color || '#666666'}
          fadeDistance={100}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      )}
      
      {/* Axis lines */}
      <axesHelper args={[50]} />
      
      {/* Axis labels */}
      {axis.labels && (
        <>
          <Text
            position={[55, 0, 0]}
            fontSize={2}
            color="red"
          >
            {axis.labels.x || 'X'}
          </Text>
          <Text
            position={[0, 55, 0]}
            fontSize={2}
            color="green"
          >
            {axis.labels.y || 'Y'}
          </Text>
          <Text
            position={[0, 0, 55]}
            fontSize={2}
            color="blue"
          >
            {axis.labels.z || 'Z'}
          </Text>
        </>
      )}
    </>
  );
};

/**
 * Camera controller component
 */
const CameraController: React.FC<{ config: Chart3DConfig }> = ({ config }) => {
  const { camera, interaction } = config;
  const { camera: threeCamera } = useThree();
  
  useEffect(() => {
    if (camera.position) {
      threeCamera.position.set(camera.position.x, camera.position.y, camera.position.z);
    }
    if (camera.lookAt) {
      threeCamera.lookAt(camera.lookAt.x, camera.lookAt.y, camera.lookAt.z);
    }
  }, [camera, threeCamera]);

  return (
    <OrbitControls
      enableZoom={interaction.enableZoom}
      enablePan={interaction.enablePan}
      enableRotate={interaction.enableRotate}
      zoomSpeed={interaction.mouseSpeed}
      panSpeed={interaction.mouseSpeed}
      rotateSpeed={interaction.mouseSpeed}
      minDistance={interaction.minDistance}
      maxDistance={interaction.maxDistance}
      autoRotate={config.animation.autoRotate}
      autoRotateSpeed={config.animation.rotationSpeed || 1}
    />
  );
};

/**
 * Main Scene3D component
 */
export const Scene3D: React.FC<Scene3DProps> = ({
  config,
  trajectories,
  scatterData,
  terrain,
  annotations,
  onReady,
  onPointClick,
  onPointHover
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint3D | null>(null);

  // Initialize API
  useEffect(() => {
    const api: Chart3DAPI = {
      addTrajectory: () => {},
      updateTrajectory: () => {},
      removeTrajectory: () => {},
      addScatterData: () => {},
      updateScatterData: () => {},
      removeScatterData: () => {},
      addTerrain: () => {},
      updateTerrain: () => {},
      removeTerrain: () => {},
      addAnnotation: () => {},
      updateAnnotation: () => {},
      removeAnnotation: () => {},
      setCameraPosition: () => {},
      setCameraLookAt: () => {},
      resetCamera: () => {},
      fitToData: () => {},
      play: () => {},
      pause: () => {},
      reset: () => {},
      setAnimationTime: () => {},
      exportImage: async () => new Blob(),
      exportModel: async () => new Blob(),
      getDataBounds: () => ({ min: new THREE.Vector3(), max: new THREE.Vector3() }),
      pick: () => null,
      highlightPoint: () => {},
      clearHighlights: () => {}
    };
    
    onReady(api);
  }, [onReady]);

  const handlePointerMove = useCallback((event: any) => {
    // Implement raycasting for hover detection
    if (onPointHover) {
      // Simplified - would need proper raycasting implementation
      onPointHover(hoveredPoint);
    }
  }, [hoveredPoint, onPointHover]);

  const handleClick = useCallback((event: any) => {
    // Implement raycasting for click detection
    if (onPointClick && hoveredPoint) {
      onPointClick(hoveredPoint);
    }
  }, [hoveredPoint, onPointClick]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{
          fov: config.camera.fov || 75,
          near: config.camera.near || 0.1,
          far: config.camera.far || 1000,
          position: [50, 50, 50]
        }}
        onPointerMove={handlePointerMove}
        onClick={handleClick}
        shadows={config.performance.shadowQuality !== 'none'}
        dpr={config.performance.pixelRatio || window.devicePixelRatio}
      >
        {/* Lighting */}
        <ambientLight 
          intensity={config.lighting.ambient?.intensity || 0.5}
          color={config.lighting.ambient?.color || 'white'}
        />
        
        {config.lighting.directional?.map((light, i) => (
          <directionalLight
            key={i}
            position={[light.position.x, light.position.y, light.position.z]}
            intensity={light.intensity}
            color={light.color}
            castShadow={light.castShadow}
          />
        ))}

        {/* Fog */}
        {config.fog && (
          <fog attach="fog" args={[config.fog.color, config.fog.near, config.fog.far]} />
        )}

        {/* Camera controls */}
        <CameraController config={config} />

        {/* Axis helper */}
        <AxisHelper config={config} />

        {/* Trajectories */}
        {trajectories.map(trajectory => (
          <Trajectory key={trajectory.id} data={trajectory} config={config} />
        ))}

        {/* Scatter plots */}
        {scatterData.map(scatter => (
          <Scatter3D key={scatter.id} data={scatter} config={config} />
        ))}

        {/* Terrain */}
        {terrain.map(terrainData => (
          <TerrainMesh key={terrainData.id} data={terrainData} config={config} />
        ))}

        {/* Annotations */}
        {annotations.map(annotation => (
          <Annotation3DComponent key={annotation.id} annotation={annotation} />
        ))}

        {/* Performance stats */}
        {process.env.NODE_ENV === 'development' && <Stats />}
      </Canvas>
    </div>
  );
};

export default Scene3D;