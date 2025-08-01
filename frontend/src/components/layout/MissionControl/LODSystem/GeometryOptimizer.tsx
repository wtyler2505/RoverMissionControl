/**
 * GeometryOptimizer Component
 * 
 * Handles mesh simplification, instancing, and geometry optimization strategies.
 * Implements progressive mesh decimation and automatic instancing detection.
 * 
 * @author Mission Control Team
 * @version 1.0.0
 */

import * as THREE from 'three';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

export interface SimplificationOptions {
  targetRatio: number;
  preserveTexture?: boolean;
  preserveNormals?: boolean;
  maxError?: number;
}

export interface InstancedRenderingConfig {
  maxInstances: number;
  frustumCulled: boolean;
  sortByDistance: boolean;
}

export interface MeshOptimizationResult {
  original: {
    vertices: number;
    faces: number;
    drawCalls: number;
  };
  optimized: {
    vertices: number;
    faces: number;
    drawCalls: number;
  };
  reductionRatio: number;
  techniques: string[];
}

/**
 * GeometryOptimizer class for mesh optimization operations
 */
export class GeometryOptimizer {
  private simplifyModifier: SimplifyModifier;
  private instancedMeshCache: Map<string, THREE.InstancedMesh>;
  private geometryCache: Map<string, THREE.BufferGeometry>;
  
  constructor() {
    this.simplifyModifier = new SimplifyModifier();
    this.instancedMeshCache = new Map();
    this.geometryCache = new Map();
  }
  
  /**
   * Simplify mesh geometry using edge collapse decimation
   */
  simplifyGeometry(
    geometry: THREE.BufferGeometry,
    options: SimplificationOptions
  ): THREE.BufferGeometry {
    const { targetRatio, preserveTexture = true, preserveNormals = true } = options;
    
    // Clone geometry to avoid modifying original
    const simplifiedGeometry = geometry.clone();
    
    // Calculate target vertex count
    const positionAttribute = simplifiedGeometry.getAttribute('position');
    const originalVertexCount = positionAttribute.count;
    const targetVertexCount = Math.floor(originalVertexCount * targetRatio);
    
    // Apply simplification
    const simplified = this.simplifyModifier.modify(simplifiedGeometry, targetVertexCount);
    
    // Preserve UV coordinates if requested
    if (preserveTexture && geometry.hasAttribute('uv')) {
      this.preserveUVMapping(geometry, simplified);
    }
    
    // Recalculate normals if requested
    if (preserveNormals) {
      simplified.computeVertexNormals();
    }
    
    return simplified;
  }
  
  /**
   * Create LOD levels for a mesh
   */
  createLODLevels(
    mesh: THREE.Mesh,
    lodDistances: number[],
    simplificationRatios: number[]
  ): THREE.LOD {
    const lod = new THREE.LOD();
    
    // Add original mesh as LOD 0
    lod.addLevel(mesh, lodDistances[0] || 0);
    
    // Create simplified versions for other LOD levels
    for (let i = 1; i < lodDistances.length; i++) {
      const ratio = simplificationRatios[i] || 0.5;
      const simplifiedGeometry = this.simplifyGeometry(mesh.geometry as THREE.BufferGeometry, {
        targetRatio: ratio,
        preserveTexture: true,
        preserveNormals: true
      });
      
      const lodMesh = new THREE.Mesh(simplifiedGeometry, mesh.material);
      lodMesh.castShadow = mesh.castShadow;
      lodMesh.receiveShadow = mesh.receiveShadow;
      
      lod.addLevel(lodMesh, lodDistances[i]);
    }
    
    // Copy transform from original mesh
    lod.position.copy(mesh.position);
    lod.rotation.copy(mesh.rotation);
    lod.scale.copy(mesh.scale);
    
    return lod;
  }
  
  /**
   * Detect and create instanced meshes from repeated geometry
   */
  createInstancedMesh(
    meshes: THREE.Mesh[],
    config: InstancedRenderingConfig
  ): THREE.InstancedMesh | null {
    if (meshes.length < 2) return null;
    
    // Check if all meshes share the same geometry and material
    const referenceGeometry = meshes[0].geometry;
    const referenceMaterial = meshes[0].material;
    
    const canInstance = meshes.every(mesh => 
      mesh.geometry === referenceGeometry && 
      mesh.material === referenceMaterial
    );
    
    if (!canInstance) return null;
    
    // Create instanced mesh
    const instancedMesh = new THREE.InstancedMesh(
      referenceGeometry,
      referenceMaterial,
      Math.min(meshes.length, config.maxInstances)
    );
    
    // Set instance matrices
    const matrix = new THREE.Matrix4();
    meshes.forEach((mesh, index) => {
      if (index < config.maxInstances) {
        mesh.updateMatrix();
        instancedMesh.setMatrixAt(index, mesh.matrix);
      }
    });
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.frustumCulled = config.frustumCulled;
    
    return instancedMesh;
  }
  
  /**
   * Merge static geometries to reduce draw calls
   */
  mergeStaticGeometries(
    meshes: THREE.Mesh[],
    materialGroups?: boolean
  ): THREE.Mesh {
    const geometriesToMerge: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    
    meshes.forEach(mesh => {
      // Apply mesh transformation to geometry
      const geometry = mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      geometriesToMerge.push(geometry);
      
      // Collect materials
      if (materialGroups && !materials.includes(mesh.material as THREE.Material)) {
        materials.push(mesh.material as THREE.Material);
      }
    });
    
    // Merge geometries
    const mergedGeometry = mergeGeometries(geometriesToMerge, materialGroups);
    
    // Create merged mesh
    const mergedMesh = new THREE.Mesh(
      mergedGeometry,
      materialGroups ? materials : meshes[0].material
    );
    
    return mergedMesh;
  }
  
  /**
   * Optimize texture atlasing for multiple meshes
   */
  createTextureAtlas(
    meshes: THREE.Mesh[],
    atlasSize: number = 4096
  ): { atlas: THREE.Texture; uvMappings: Map<THREE.Mesh, THREE.Vector4> } {
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d')!;
    
    const uvMappings = new Map<THREE.Mesh, THREE.Vector4>();
    const packer = new TexturePacker(atlasSize, atlasSize);
    
    // Pack textures into atlas
    meshes.forEach(mesh => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material.map) {
        const texture = material.map;
        const image = texture.image;
        
        if (image && image.width && image.height) {
          const rect = packer.pack(image.width, image.height);
          if (rect) {
            // Draw texture to atlas
            ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
            
            // Store UV mapping
            uvMappings.set(mesh, new THREE.Vector4(
              rect.x / atlasSize,
              rect.y / atlasSize,
              rect.width / atlasSize,
              rect.height / atlasSize
            ));
            
            // Update mesh UVs
            this.remapUVs(mesh.geometry as THREE.BufferGeometry, uvMappings.get(mesh)!);
          }
        }
      }
    });
    
    // Create atlas texture
    const atlasTexture = new THREE.CanvasTexture(canvas);
    atlasTexture.needsUpdate = true;
    
    return { atlas: atlasTexture, uvMappings };
  }
  
  /**
   * Implement occlusion culling for a scene
   */
  setupOcclusionCulling(
    scene: THREE.Scene,
    camera: THREE.Camera,
    cellSize: number = 10
  ): OcclusionCuller {
    return new OcclusionCuller(scene, camera, cellSize);
  }
  
  /**
   * Analyze mesh optimization potential
   */
  analyzeMesh(mesh: THREE.Mesh): MeshOptimizationResult {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.getAttribute('position');
    const originalVertices = positionAttribute ? positionAttribute.count : 0;
    const originalFaces = geometry.index ? geometry.index.count / 3 : originalVertices / 3;
    
    const techniques: string[] = [];
    let optimizedVertices = originalVertices;
    let optimizedFaces = originalFaces;
    let optimizedDrawCalls = 1;
    
    // Check for optimization opportunities
    if (originalVertices > 10000) {
      techniques.push('Mesh simplification recommended');
      optimizedVertices = Math.floor(originalVertices * 0.5);
      optimizedFaces = Math.floor(originalFaces * 0.5);
    }
    
    if (!geometry.index) {
      techniques.push('Indexing can reduce vertex count');
      optimizedVertices = Math.floor(originalVertices * 0.6);
    }
    
    if (geometry.hasAttribute('normal') && geometry.hasAttribute('uv')) {
      techniques.push('Vertex compression possible');
    }
    
    const reductionRatio = 1 - (optimizedVertices / originalVertices);
    
    return {
      original: {
        vertices: originalVertices,
        faces: originalFaces,
        drawCalls: 1
      },
      optimized: {
        vertices: optimizedVertices,
        faces: optimizedFaces,
        drawCalls: optimizedDrawCalls
      },
      reductionRatio,
      techniques
    };
  }
  
  /**
   * Preserve UV mapping during simplification
   */
  private preserveUVMapping(
    original: THREE.BufferGeometry,
    simplified: THREE.BufferGeometry
  ): void {
    if (!original.hasAttribute('uv') || !simplified.hasAttribute('position')) {
      return;
    }
    
    const originalUVs = original.getAttribute('uv');
    const simplifiedPositions = simplified.getAttribute('position');
    const simplifiedUVs = new THREE.BufferAttribute(
      new Float32Array(simplifiedPositions.count * 2),
      2
    );
    
    // Simple nearest-neighbor UV mapping
    for (let i = 0; i < simplifiedPositions.count; i++) {
      const pos = new THREE.Vector3().fromBufferAttribute(simplifiedPositions, i);
      let closestIndex = 0;
      let closestDistance = Infinity;
      
      // Find closest original vertex
      const originalPositions = original.getAttribute('position');
      for (let j = 0; j < originalPositions.count; j++) {
        const origPos = new THREE.Vector3().fromBufferAttribute(originalPositions, j);
        const distance = pos.distanceTo(origPos);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = j;
        }
      }
      
      // Copy UV from closest vertex
      simplifiedUVs.setXY(
        i,
        originalUVs.getX(closestIndex),
        originalUVs.getY(closestIndex)
      );
    }
    
    simplified.setAttribute('uv', simplifiedUVs);
  }
  
  /**
   * Remap UVs for texture atlas
   */
  private remapUVs(geometry: THREE.BufferGeometry, mapping: THREE.Vector4): void {
    const uvAttribute = geometry.getAttribute('uv');
    if (!uvAttribute) return;
    
    const uvs = uvAttribute.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i] = uvs[i] * mapping.z + mapping.x;
      uvs[i + 1] = uvs[i + 1] * mapping.w + mapping.y;
    }
    
    uvAttribute.needsUpdate = true;
  }
  
  /**
   * Clear optimization caches
   */
  clearCaches(): void {
    this.instancedMeshCache.clear();
    this.geometryCache.clear();
  }
}

/**
 * Simple texture packer for atlas creation
 */
class TexturePacker {
  private width: number;
  private height: number;
  private spaces: Array<{ x: number; y: number; width: number; height: number }>;
  
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.spaces = [{ x: 0, y: 0, width, height }];
  }
  
  pack(width: number, height: number): { x: number; y: number; width: number; height: number } | null {
    // Find best fitting space
    let bestSpace = null;
    let bestSpaceIndex = -1;
    let bestFit = Infinity;
    
    for (let i = 0; i < this.spaces.length; i++) {
      const space = this.spaces[i];
      if (width <= space.width && height <= space.height) {
        const leftoverX = space.width - width;
        const leftoverY = space.height - height;
        const fit = Math.min(leftoverX, leftoverY);
        
        if (fit < bestFit) {
          bestFit = fit;
          bestSpace = space;
          bestSpaceIndex = i;
        }
      }
    }
    
    if (!bestSpace) return null;
    
    // Remove the used space
    this.spaces.splice(bestSpaceIndex, 1);
    
    // Add remaining spaces
    const rightSpace = {
      x: bestSpace.x + width,
      y: bestSpace.y,
      width: bestSpace.width - width,
      height: height
    };
    
    const bottomSpace = {
      x: bestSpace.x,
      y: bestSpace.y + height,
      width: bestSpace.width,
      height: bestSpace.height - height
    };
    
    if (rightSpace.width > 0 && rightSpace.height > 0) {
      this.spaces.push(rightSpace);
    }
    
    if (bottomSpace.width > 0 && bottomSpace.height > 0) {
      this.spaces.push(bottomSpace);
    }
    
    return {
      x: bestSpace.x,
      y: bestSpace.y,
      width,
      height
    };
  }
}

/**
 * Occlusion culling system
 */
export class OcclusionCuller {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private cellSize: number;
  private spatialGrid: Map<string, THREE.Object3D[]>;
  private occluders: THREE.Mesh[];
  private raycaster: THREE.Raycaster;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, cellSize: number) {
    this.scene = scene;
    this.camera = camera;
    this.cellSize = cellSize;
    this.spatialGrid = new Map();
    this.occluders = [];
    this.raycaster = new THREE.Raycaster();
    
    this.buildSpatialGrid();
  }
  
  private buildSpatialGrid(): void {
    this.spatialGrid.clear();
    
    this.scene.traverse((object) => {
      if (object.type === 'Mesh') {
        const mesh = object as THREE.Mesh;
        const position = mesh.position;
        const key = this.getGridKey(position);
        
        if (!this.spatialGrid.has(key)) {
          this.spatialGrid.set(key, []);
        }
        
        this.spatialGrid.get(key)!.push(mesh);
        
        // Identify large occluders
        const geometry = mesh.geometry;
        if (geometry.boundingBox) {
          geometry.computeBoundingBox();
          const size = geometry.boundingBox!.getSize(new THREE.Vector3());
          if (size.length() > this.cellSize * 2) {
            this.occluders.push(mesh);
          }
        }
      }
    });
  }
  
  private getGridKey(position: THREE.Vector3): string {
    const x = Math.floor(position.x / this.cellSize);
    const y = Math.floor(position.y / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${y},${z}`;
  }
  
  performCulling(): Set<THREE.Object3D> {
    const visible = new Set<THREE.Object3D>();
    const frustum = new THREE.Frustum();
    const cameraMatrix = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(cameraMatrix);
    
    // First pass: frustum culling
    this.scene.traverse((object) => {
      if (object.type === 'Mesh') {
        const mesh = object as THREE.Mesh;
        if (frustum.intersectsObject(mesh)) {
          visible.add(mesh);
        }
      }
    });
    
    // Second pass: occlusion culling
    const toRemove: THREE.Object3D[] = [];
    visible.forEach((object) => {
      if (this.isOccluded(object as THREE.Mesh)) {
        toRemove.push(object);
      }
    });
    
    toRemove.forEach(object => visible.delete(object));
    
    return visible;
  }
  
  private isOccluded(mesh: THREE.Mesh): boolean {
    // Skip if no occluders
    if (this.occluders.length === 0) return false;
    
    // Cast ray from camera to object
    const direction = new THREE.Vector3();
    direction.subVectors(mesh.position, this.camera.position).normalize();
    
    this.raycaster.set(this.camera.position, direction);
    this.raycaster.far = mesh.position.distanceTo(this.camera.position);
    
    // Check intersections with occluders
    const intersects = this.raycaster.intersectObjects(this.occluders);
    
    // Object is occluded if any occluder is hit before reaching the object
    return intersects.length > 0 && intersects[0].distance < this.raycaster.far;
  }
  
  update(): void {
    // Rebuild spatial grid periodically or when scene changes
    this.buildSpatialGrid();
  }
}

export default GeometryOptimizer;