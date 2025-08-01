/**
 * LODTerrain Component
 * 
 * Terrain rendering with dynamic LOD based on camera distance and performance.
 * Implements chunk-based terrain with variable resolution.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useLOD } from './LODManager';

export interface LODTerrainProps {
  /** Terrain heightmap data */
  heightMap?: number[][];
  /** Terrain dimensions in world units */
  size?: { width: number; depth: number };
  /** Maximum terrain height */
  maxHeight?: number;
  /** Terrain texture */
  texture?: THREE.Texture;
  /** Enable wireframe for debugging */
  wireframe?: boolean;
  /** Chunk size for terrain tiles */
  chunkSize?: number;
  /** Maximum view distance */
  maxViewDistance?: number;
}

interface TerrainChunk {
  mesh: THREE.Mesh;
  position: THREE.Vector2;
  lodLevel: number;
  lastUpdate: number;
}

/**
 * Generate terrain geometry from heightmap
 */
function generateTerrainGeometry(
  heightMap: number[][],
  size: { width: number; depth: number },
  maxHeight: number,
  resolution: number
): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(
    size.width,
    size.depth,
    resolution - 1,
    resolution - 1
  );
  
  const positions = geometry.attributes.position;
  
  // Apply height values
  for (let i = 0; i < positions.count; i++) {
    const x = i % resolution;
    const z = Math.floor(i / resolution);
    
    // Sample heightmap with interpolation
    const u = x / (resolution - 1);
    const v = z / (resolution - 1);
    
    const heightX = u * (heightMap.length - 1);
    const heightZ = v * (heightMap[0].length - 1);
    
    const x0 = Math.floor(heightX);
    const z0 = Math.floor(heightZ);
    const x1 = Math.min(x0 + 1, heightMap.length - 1);
    const z1 = Math.min(z0 + 1, heightMap[0].length - 1);
    
    const fx = heightX - x0;
    const fz = heightZ - z0;
    
    // Bilinear interpolation
    const h00 = heightMap[x0][z0];
    const h10 = heightMap[x1][z0];
    const h01 = heightMap[x0][z1];
    const h11 = heightMap[x1][z1];
    
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    const height = h0 * (1 - fz) + h1 * fz;
    
    positions.setY(i, height * maxHeight);
  }
  
  // Recalculate normals
  geometry.computeVertexNormals();
  
  // Rotate to face up
  geometry.rotateX(-Math.PI / 2);
  
  return geometry;
}

/**
 * LOD Terrain Component
 */
export function LODTerrain({
  heightMap,
  size = { width: 100, depth: 100 },
  maxHeight = 10,
  texture,
  wireframe = false,
  chunkSize = 32,
  maxViewDistance = 500
}: LODTerrainProps) {
  const { camera } = useThree();
  const lod = useLOD();
  const chunksRef = useRef<Map<string, TerrainChunk>>(new Map());
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate default heightmap if not provided
  const terrainHeightMap = useMemo(() => {
    if (heightMap) return heightMap;
    
    // Generate simple noise-based heightmap
    const resolution = 128;
    const map: number[][] = [];
    
    for (let x = 0; x < resolution; x++) {
      map[x] = [];
      for (let z = 0; z < resolution; z++) {
        // Simple sine wave pattern
        const height = 
          Math.sin(x * 0.1) * 0.3 +
          Math.sin(z * 0.1) * 0.3 +
          Math.sin(x * 0.05 + z * 0.05) * 0.4;
        map[x][z] = (height + 1) * 0.5; // Normalize to 0-1
      }
    }
    
    return map;
  }, [heightMap]);
  
  // Material with LOD-based settings
  const materials = useMemo(() => {
    const baseMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      wireframe: wireframe,
      side: THREE.DoubleSide
    });
    
    return [
      baseMaterial.clone(), // LOD 0 - Full quality
      new THREE.MeshStandardMaterial({ // LOD 1
        map: texture,
        wireframe: wireframe,
        side: THREE.DoubleSide,
        flatShading: true
      }),
      new THREE.MeshBasicMaterial({ // LOD 2
        map: texture,
        wireframe: wireframe,
        side: THREE.DoubleSide
      }),
      new THREE.MeshBasicMaterial({ // LOD 3+
        color: 0x8B7355,
        wireframe: wireframe,
        side: THREE.DoubleSide
      })
    ];
  }, [texture, wireframe]);
  
  // Get chunk key from position
  const getChunkKey = (x: number, z: number): string => {
    return `${Math.floor(x / chunkSize)},${Math.floor(z / chunkSize)}`;
  };
  
  // Create or update chunk
  const createChunk = (chunkX: number, chunkZ: number, lodLevel: number): TerrainChunk => {
    const key = `${chunkX},${chunkZ}`;
    const existing = chunksRef.current.get(key);
    
    // Determine resolution based on LOD
    const resolutions = lod.config.terrain.chunkSizes;
    const resolution = resolutions[Math.min(lodLevel, resolutions.length - 1)];
    
    // Extract heightmap section for this chunk
    const chunkHeightMap: number[][] = [];
    const startX = chunkX * chunkSize;
    const startZ = chunkZ * chunkSize;
    
    for (let x = 0; x < resolution; x++) {
      chunkHeightMap[x] = [];
      for (let z = 0; z < resolution; z++) {
        const globalX = startX + (x / (resolution - 1)) * chunkSize;
        const globalZ = startZ + (z / (resolution - 1)) * chunkSize;
        
        const mapX = Math.floor((globalX / size.width) * terrainHeightMap.length);
        const mapZ = Math.floor((globalZ / size.depth) * terrainHeightMap[0].length);
        
        if (mapX >= 0 && mapX < terrainHeightMap.length && 
            mapZ >= 0 && mapZ < terrainHeightMap[0].length) {
          chunkHeightMap[x][z] = terrainHeightMap[mapX][mapZ];
        } else {
          chunkHeightMap[x][z] = 0;
        }
      }
    }
    
    // Generate geometry
    const geometry = generateTerrainGeometry(
      chunkHeightMap,
      { width: chunkSize, depth: chunkSize },
      maxHeight,
      resolution
    );
    
    // Create or update mesh
    let mesh: THREE.Mesh;
    if (existing) {
      // Update existing mesh
      existing.mesh.geometry.dispose();
      existing.mesh.geometry = geometry;
      existing.mesh.material = materials[Math.min(lodLevel, materials.length - 1)];
      mesh = existing.mesh;
    } else {
      // Create new mesh
      mesh = new THREE.Mesh(
        geometry,
        materials[Math.min(lodLevel, materials.length - 1)]
      );
      mesh.position.set(
        chunkX * chunkSize + chunkSize / 2 - size.width / 2,
        0,
        chunkZ * chunkSize + chunkSize / 2 - size.depth / 2
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      if (groupRef.current) {
        groupRef.current.add(mesh);
      }
    }
    
    const chunk: TerrainChunk = {
      mesh,
      position: new THREE.Vector2(chunkX, chunkZ),
      lodLevel,
      lastUpdate: Date.now()
    };
    
    chunksRef.current.set(key, chunk);
    return chunk;
  };
  
  // Update terrain chunks based on camera position
  useFrame(() => {
    if (!groupRef.current) return;
    
    const cameraWorldPos = camera.position.clone();
    const terrainLocalPos = groupRef.current.worldToLocal(cameraWorldPos);
    
    // Determine which chunks should be visible
    const centerChunkX = Math.floor((terrainLocalPos.x + size.width / 2) / chunkSize);
    const centerChunkZ = Math.floor((terrainLocalPos.z + size.depth / 2) / chunkSize);
    
    const viewRadius = Math.ceil(maxViewDistance / chunkSize);
    const visibleChunks = new Set<string>();
    
    // Check all potentially visible chunks
    for (let dx = -viewRadius; dx <= viewRadius; dx++) {
      for (let dz = -viewRadius; dz <= viewRadius; dz++) {
        const chunkX = centerChunkX + dx;
        const chunkZ = centerChunkZ + dz;
        
        // Check if chunk is within terrain bounds
        if (chunkX < 0 || chunkX >= Math.ceil(size.width / chunkSize) ||
            chunkZ < 0 || chunkZ >= Math.ceil(size.depth / chunkSize)) {
          continue;
        }
        
        // Calculate distance to chunk center
        const chunkCenterX = chunkX * chunkSize + chunkSize / 2 - size.width / 2;
        const chunkCenterZ = chunkZ * chunkSize + chunkSize / 2 - size.depth / 2;
        const distance = Math.sqrt(
          Math.pow(terrainLocalPos.x - chunkCenterX, 2) +
          Math.pow(terrainLocalPos.z - chunkCenterZ, 2)
        );
        
        if (distance <= maxViewDistance) {
          const key = `${chunkX},${chunkZ}`;
          visibleChunks.add(key);
          
          // Determine LOD level based on distance
          const normalizedDistance = distance / maxViewDistance;
          const lodLevel = Math.floor(normalizedDistance * lod.config.terrain.level);
          
          // Create or update chunk
          const chunk = chunksRef.current.get(key);
          if (!chunk) {
            createChunk(chunkX, chunkZ, lodLevel);
          } else if (chunk.lodLevel !== lodLevel) {
            // Update LOD if changed
            createChunk(chunkX, chunkZ, lodLevel);
          }
        }
      }
    }
    
    // Remove chunks that are no longer visible
    chunksRef.current.forEach((chunk, key) => {
      if (!visibleChunks.has(key)) {
        if (groupRef.current) {
          groupRef.current.remove(chunk.mesh);
        }
        chunk.mesh.geometry.dispose();
        chunksRef.current.delete(key);
      }
    });
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chunksRef.current.forEach(chunk => {
        chunk.mesh.geometry.dispose();
      });
      chunksRef.current.clear();
      
      materials.forEach(material => material.dispose());
    };
  }, [materials]);
  
  // Register with LOD system
  useEffect(() => {
    if (!groupRef.current) return;
    
    lod.registerObject(groupRef.current, {
      type: 'terrain',
      importance: 'medium'
    });
    
    return () => {
      if (groupRef.current) {
        lod.unregisterObject(groupRef.current);
      }
    };
  }, [lod]);
  
  return <group ref={groupRef} />;
}

export default LODTerrain;