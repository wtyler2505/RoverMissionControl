# Animation System Performance Optimization Guide

## Overview

This guide details the performance optimization strategies for the rover animation system, ensuring smooth 60 FPS visualization even with complex animations and multiple animated components.

## Performance Targets

- **Frame Rate**: Maintain 60 FPS with up to 10 concurrent animations
- **Memory Usage**: < 100MB for animation data
- **CPU Usage**: < 30% on average hardware
- **GPU Usage**: < 50% with full effects enabled
- **Latency**: < 16ms per frame update

## Optimization Strategies

### 1. Animation Instancing

For scenarios with multiple similar animations (e.g., wheel rotations, dust particles).

```typescript
// Animation instancing implementation
export class AnimationInstancer {
  private instanceBuffer: THREE.InstancedBufferAttribute;
  private instanceMatrices: Float32Array;
  private maxInstances: number;
  
  constructor(maxInstances: number = 1000) {
    this.maxInstances = maxInstances;
    this.instanceMatrices = new Float32Array(maxInstances * 16);
    this.instanceBuffer = new THREE.InstancedBufferAttribute(this.instanceMatrices, 16);
  }
  
  updateInstance(index: number, animation: Animation, time: number): void {
    const pose = animation.evaluate(time);
    const matrix = new THREE.Matrix4();
    
    matrix.compose(pose.position, pose.rotation, pose.scale);
    matrix.toArray(this.instanceMatrices, index * 16);
    
    this.instanceBuffer.needsUpdate = true;
  }
  
  // GPU-accelerated update using compute shader
  updateInstancesGPU(animations: Animation[], time: number): void {
    const computeShader = `
      uniform float time;
      uniform sampler2D animationData;
      
      void main() {
        uint index = gl_GlobalInvocationID.x;
        vec4 animData = texture(animationData, vec2(float(index) / 1024.0, 0.0));
        
        // Compute animation pose
        float t = mod(time * animData.x, animData.y); // speed and duration
        float angle = t * 6.28318; // Full rotation
        
        // Build transformation matrix
        mat4 transform = mat4(
          cos(angle), -sin(angle), 0.0, 0.0,
          sin(angle), cos(angle), 0.0, 0.0,
          0.0, 0.0, 1.0, 0.0,
          animData.z, animData.w, 0.0, 1.0
        );
        
        // Write to instance buffer
        instanceMatrices[index] = transform;
      }
    `;
    
    // Execute compute shader
    this.computeRenderer.compute(computeShader, this.maxInstances);
  }
}
```

### 2. Level of Detail (LOD) System

Reduce animation complexity based on distance and importance.

```typescript
export class AnimationLODManager {
  private lodConfigs: LODConfig[] = [
    { distance: 0, quality: 1.0, updateRate: 60 },    // Full quality
    { distance: 50, quality: 0.5, updateRate: 30 },   // Half quality
    { distance: 100, quality: 0.25, updateRate: 15 }, // Quarter quality
    { distance: 200, quality: 0, updateRate: 0 }      // Static
  ];
  
  getLODLevel(object: THREE.Object3D, camera: THREE.Camera): number {
    const distance = object.position.distanceTo(camera.position);
    const screenSize = this.calculateScreenSize(object, camera, distance);
    const importance = this.getObjectImportance(object);
    
    // Combine distance, screen size, and importance
    const score = (1 / distance) * screenSize * importance;
    
    if (score > 0.5) return 0;      // Full detail
    if (score > 0.2) return 1;      // Reduced
    if (score > 0.05) return 2;     // Simple
    return 3;                        // Static
  }
  
  applyLOD(animation: Animation, lodLevel: number): Animation {
    const config = this.lodConfigs[lodLevel];
    
    switch (lodLevel) {
      case 0: // Full quality
        return animation;
        
      case 1: // Reduced keyframes
        return new ReducedAnimation(animation, {
          keyframeReduction: 0.5,
          disableSubtleMotions: true
        });
        
      case 2: // Simple interpolation
        return new SimpleAnimation(animation, {
          useLinearInterpolation: true,
          disableSecondaryMotions: true,
          updateRate: config.updateRate
        });
        
      case 3: // Static pose
        return new StaticPose(animation.getRestPose());
    }
  }
  
  // Adaptive LOD based on performance
  adaptiveLOD(frameTime: number, targetFrameTime: number = 16.67): void {
    if (frameTime > targetFrameTime * 1.2) {
      // Reduce quality
      this.lodConfigs.forEach(config => {
        config.quality *= 0.9;
        config.updateRate = Math.max(15, config.updateRate * 0.9);
      });
    } else if (frameTime < targetFrameTime * 0.8) {
      // Increase quality
      this.lodConfigs.forEach(config => {
        config.quality = Math.min(1.0, config.quality * 1.1);
        config.updateRate = Math.min(60, config.updateRate * 1.1);
      });
    }
  }
}
```

### 3. Animation Caching and Precomputation

```typescript
export class AnimationCache {
  private cache: Map<string, CachedAnimation> = new Map();
  private memoryLimit: number = 100 * 1024 * 1024; // 100MB
  private currentMemoryUsage: number = 0;
  
  // Precompute animation at different sample rates
  precompute(animation: Animation): CachedAnimation {
    const cached: CachedAnimation = {
      id: animation.id,
      duration: animation.duration,
      frames: new Map(),
      gpuBuffer: null
    };
    
    // Sample at different rates for different LODs
    const sampleRates = [60, 30, 15, 5]; // FPS
    
    for (const rate of sampleRates) {
      const frameCount = Math.ceil(animation.duration * rate);
      const frames: AnimationFrame[] = [];
      
      for (let i = 0; i < frameCount; i++) {
        const time = (i / frameCount) * animation.duration;
        frames.push(animation.evaluate(time));
      }
      
      cached.frames.set(rate, frames);
    }
    
    // Create GPU buffer for fastest access
    cached.gpuBuffer = this.createGPUBuffer(cached);
    
    this.cache.set(animation.id, cached);
    this.currentMemoryUsage += this.estimateMemoryUsage(cached);
    
    // Evict old entries if over limit
    this.evictIfNeeded();
    
    return cached;
  }
  
  // Evaluate cached animation with interpolation
  evaluate(animationId: string, time: number, sampleRate: number = 60): AnimationFrame {
    const cached = this.cache.get(animationId);
    if (!cached) return null;
    
    const frames = cached.frames.get(sampleRate) || cached.frames.get(60);
    if (!frames) return null;
    
    const normalizedTime = (time % cached.duration) / cached.duration;
    const frameIndex = normalizedTime * (frames.length - 1);
    const lowerIndex = Math.floor(frameIndex);
    const upperIndex = Math.ceil(frameIndex);
    const t = frameIndex - lowerIndex;
    
    if (lowerIndex === upperIndex) {
      return frames[lowerIndex];
    }
    
    // Interpolate between frames
    return this.interpolateFrames(frames[lowerIndex], frames[upperIndex], t);
  }
  
  // LRU eviction
  private evictIfNeeded(): void {
    while (this.currentMemoryUsage > this.memoryLimit && this.cache.size > 0) {
      const oldest = this.findOldestEntry();
      if (oldest) {
        this.currentMemoryUsage -= this.estimateMemoryUsage(oldest[1]);
        this.cache.delete(oldest[0]);
      }
    }
  }
}
```

### 4. Batching and Culling

```typescript
export class AnimationBatcher {
  private batchSize: number = 100;
  private frustumCuller: FrustumCuller;
  
  // Batch similar animations together
  batchAnimations(animations: AnimationInstance[]): AnimationBatch[] {
    const batches: Map<string, AnimationBatch> = new Map();
    
    for (const anim of animations) {
      const key = this.getBatchKey(anim);
      
      if (!batches.has(key)) {
        batches.set(key, {
          key,
          animations: [],
          sharedData: this.extractSharedData(anim)
        });
      }
      
      const batch = batches.get(key)!;
      if (batch.animations.length < this.batchSize) {
        batch.animations.push(anim);
      }
    }
    
    return Array.from(batches.values());
  }
  
  // Frustum culling
  cullAnimations(
    animations: AnimationInstance[], 
    camera: THREE.Camera
  ): AnimationInstance[] {
    const frustum = new THREE.Frustum();
    const matrix = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(matrix);
    
    return animations.filter(anim => {
      const bounds = anim.getBoundingSphere();
      return frustum.intersectsSphere(bounds);
    });
  }
  
  // Occlusion culling using GPU queries
  async occlusionCull(
    animations: AnimationInstance[],
    renderer: THREE.WebGLRenderer
  ): Promise<AnimationInstance[]> {
    const queries = animations.map(anim => ({
      animation: anim,
      query: renderer.createQuery()
    }));
    
    // Render bounding boxes with occlusion queries
    for (const { animation, query } of queries) {
      renderer.beginQuery(query);
      this.renderBoundingBox(animation.getBoundingBox(), renderer);
      renderer.endQuery();
    }
    
    // Wait for results
    const results = await Promise.all(
      queries.map(({ query }) => renderer.getQueryResult(query))
    );
    
    // Filter visible animations
    return queries
      .filter((_, index) => results[index] > 0)
      .map(({ animation }) => animation);
  }
}
```

### 5. Multi-threading with Web Workers

```typescript
// Animation worker for parallel processing
// File: animationWorker.ts
self.addEventListener('message', (event) => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'EVALUATE_ANIMATION':
      const result = evaluateAnimation(data.animation, data.time);
      self.postMessage({ type: 'ANIMATION_RESULT', data: result });
      break;
      
    case 'BATCH_PROCESS':
      const results = data.animations.map((anim: any) => 
        evaluateAnimation(anim, data.time)
      );
      self.postMessage({ type: 'BATCH_RESULT', data: results });
      break;
  }
});

// Main thread animation distributor
export class AnimationDistributor {
  private workers: Worker[] = [];
  private workerPool: WorkerPool;
  
  constructor(workerCount: number = navigator.hardwareConcurrency || 4) {
    for (let i = 0; i < workerCount; i++) {
      this.workers.push(new Worker('/animationWorker.js'));
    }
    
    this.workerPool = new WorkerPool(this.workers);
  }
  
  async evaluateAnimations(
    animations: Animation[],
    time: number
  ): Promise<AnimationFrame[]> {
    // Distribute animations across workers
    const chunks = this.chunkAnimations(animations, this.workers.length);
    
    const promises = chunks.map((chunk, index) => 
      this.workerPool.execute(index, {
        type: 'BATCH_PROCESS',
        data: { animations: chunk, time }
      })
    );
    
    const results = await Promise.all(promises);
    return results.flat();
  }
  
  private chunkAnimations(animations: Animation[], chunkCount: number): Animation[][] {
    const chunkSize = Math.ceil(animations.length / chunkCount);
    const chunks: Animation[][] = [];
    
    for (let i = 0; i < animations.length; i += chunkSize) {
      chunks.push(animations.slice(i, i + chunkSize));
    }
    
    return chunks;
  }
}
```

### 6. Memory Optimization

```typescript
export class AnimationMemoryManager {
  private pools: Map<string, ObjectPool> = new Map();
  
  // Object pooling for animation data
  getAnimationFrame(): AnimationFrame {
    const pool = this.getPool('AnimationFrame');
    return pool.acquire() || new AnimationFrame();
  }
  
  releaseAnimationFrame(frame: AnimationFrame): void {
    frame.reset();
    this.getPool('AnimationFrame').release(frame);
  }
  
  // Shared geometry and materials
  private sharedResources = new Map<string, THREE.BufferGeometry | THREE.Material>();
  
  getSharedGeometry(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
    if (!this.sharedResources.has(key)) {
      this.sharedResources.set(key, factory());
    }
    return this.sharedResources.get(key) as THREE.BufferGeometry;
  }
  
  // Texture atlasing for animation sprites
  createTextureAtlas(textures: THREE.Texture[]): TextureAtlas {
    const atlasSize = 2048;
    const atlas = new TextureAtlas(atlasSize, atlasSize);
    
    for (const texture of textures) {
      atlas.addTexture(texture);
    }
    
    atlas.generate();
    return atlas;
  }
  
  // Memory usage monitoring
  getMemoryStats(): MemoryStats {
    return {
      animations: this.calculateAnimationMemory(),
      geometries: this.calculateGeometryMemory(),
      textures: this.calculateTextureMemory(),
      total: performance.memory?.usedJSHeapSize || 0
    };
  }
}
```

### 7. Shader-based Animation

```glsl
// Vertex shader for GPU animation
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute vec4 skinWeight;
attribute vec4 skinIndex;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 bindMatrix;
uniform mat4 bindMatrixInverse;
uniform sampler2D boneTexture;
uniform int boneTextureSize;

mat4 getBoneMatrix(float i) {
  float j = i * 4.0;
  float x = mod(j, float(boneTextureSize));
  float y = floor(j / float(boneTextureSize));
  
  float dx = 1.0 / float(boneTextureSize);
  float dy = 1.0 / float(boneTextureSize);
  
  y = dy * (y + 0.5);
  
  vec4 v1 = texture2D(boneTexture, vec2(dx * (x + 0.5), y));
  vec4 v2 = texture2D(boneTexture, vec2(dx * (x + 1.5), y));
  vec4 v3 = texture2D(boneTexture, vec2(dx * (x + 2.5), y));
  vec4 v4 = texture2D(boneTexture, vec2(dx * (x + 3.5), y));
  
  return mat4(v1, v2, v3, v4);
}

void main() {
  mat4 boneMatX = getBoneMatrix(skinIndex.x);
  mat4 boneMatY = getBoneMatrix(skinIndex.y);
  mat4 boneMatZ = getBoneMatrix(skinIndex.z);
  mat4 boneMatW = getBoneMatrix(skinIndex.w);
  
  vec4 skinVertex = bindMatrix * vec4(position, 1.0);
  
  vec4 skinned = vec4(0.0);
  skinned += boneMatX * skinVertex * skinWeight.x;
  skinned += boneMatY * skinVertex * skinWeight.y;
  skinned += boneMatZ * skinVertex * skinWeight.z;
  skinned += boneMatW * skinVertex * skinWeight.w;
  
  vec4 transformed = bindMatrixInverse * skinned;
  
  gl_Position = projectionMatrix * modelViewMatrix * transformed;
}
```

### 8. Performance Monitoring

```typescript
export class AnimationPerformanceMonitor {
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    animationUpdateTime: 0,
    renderTime: 0,
    activeAnimations: 0,
    culledAnimations: 0,
    cachedHits: 0,
    cacheMisses: 0
  };
  
  private frameHistory: number[] = [];
  private maxHistorySize: number = 60;
  
  beginFrame(): void {
    this.frameStartTime = performance.now();
  }
  
  endFrame(): void {
    const frameTime = performance.now() - this.frameStartTime;
    this.frameHistory.push(frameTime);
    
    if (this.frameHistory.length > this.maxHistorySize) {
      this.frameHistory.shift();
    }
    
    this.updateMetrics();
  }
  
  private updateMetrics(): void {
    const avgFrameTime = this.frameHistory.reduce((a, b) => a + b) / this.frameHistory.length;
    
    this.metrics.frameTime = avgFrameTime;
    this.metrics.fps = 1000 / avgFrameTime;
    
    // Adaptive quality adjustment
    if (this.metrics.fps < 30) {
      this.emitPerformanceWarning('LOW_FPS');
      this.suggestOptimizations();
    }
  }
  
  private suggestOptimizations(): Optimization[] {
    const suggestions: Optimization[] = [];
    
    if (this.metrics.activeAnimations > 20) {
      suggestions.push({
        type: 'REDUCE_ANIMATIONS',
        priority: 'high',
        description: 'Too many active animations. Consider LOD or culling.'
      });
    }
    
    if (this.metrics.cacheMisses > this.metrics.cachedHits) {
      suggestions.push({
        type: 'INCREASE_CACHE',
        priority: 'medium',
        description: 'High cache miss rate. Increase cache size or precompute animations.'
      });
    }
    
    if (this.metrics.animationUpdateTime > 8) {
      suggestions.push({
        type: 'USE_GPU_ANIMATION',
        priority: 'high',
        description: 'CPU animation taking too long. Consider GPU-based animation.'
      });
    }
    
    return suggestions;
  }
}
```

## Best Practices

### 1. Animation Pooling
- Reuse animation instances instead of creating new ones
- Pool common animations like wheel rotations
- Clear references when animations complete

### 2. Texture and Material Optimization
- Use texture atlases for animation sprites
- Share materials between animated objects
- Compress textures appropriately

### 3. Update Frequency
- Not all animations need 60 FPS updates
- Background animations can run at 15-30 FPS
- Use frame skipping for distant objects

### 4. Batch Processing
- Group similar animations together
- Use instanced rendering for repeated animations
- Minimize state changes between draws

### 5. Memory Management
- Monitor memory usage continuously
- Implement aggressive caching with eviction
- Use typed arrays for better performance

## Performance Benchmarks

| Scenario | Target FPS | Max Animations | Memory Budget |
|----------|------------|----------------|---------------|
| Desktop High-End | 60 | 50 | 200MB |
| Desktop Mid-Range | 60 | 25 | 100MB |
| Laptop | 30-60 | 15 | 75MB |
| Mobile/Tablet | 30 | 10 | 50MB |

## Profiling Tools

```typescript
// Animation profiler integration
export function profileAnimation(animation: Animation): ProfileReport {
  const profiler = new AnimationProfiler();
  
  profiler.start();
  
  // Profile evaluation performance
  for (let t = 0; t < animation.duration; t += 0.016) {
    profiler.mark('evaluate_start');
    animation.evaluate(t);
    profiler.mark('evaluate_end');
  }
  
  // Profile memory usage
  profiler.measureMemory();
  
  // Generate report
  return profiler.generateReport();
}
```

This performance optimization guide ensures the animation system maintains high performance across various hardware configurations while providing smooth, responsive animations for the rover visualization.