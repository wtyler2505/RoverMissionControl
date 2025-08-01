/**
 * ChartPerformanceOptimizer
 * 
 * Advanced performance optimization for real-time charts with:
 * - FPS monitoring and adaptive quality adjustment
 * - Render budget management
 * - GPU acceleration detection and utilization
 * - Memory pooling for data structures
 * - Intelligent decimation and LOD (Level of Detail)
 * - WebWorker offloading for heavy computations
 */

import { BehaviorSubject, Observable, interval, animationFrameScheduler } from 'rxjs';
import { map, scan, takeUntil, throttleTime, withLatestFrom } from 'rxjs/operators';
import { Subject } from 'rxjs';

export interface PerformanceConfig {
  targetFPS: number;
  minFPS: number;
  enableGPU: boolean;
  enableWorkers: boolean;
  memoryLimit: number; // MB
  adaptiveQuality: boolean;
  profileMode: boolean;
}

export interface RenderBudget {
  frameTime: number; // ms
  dataPoints: number;
  animations: boolean;
  transitions: boolean;
  antialiasing: boolean;
  shadows: boolean;
  complexity: 'low' | 'medium' | 'high' | 'ultra';
}

export interface PerformanceProfile {
  fps: number;
  frameTime: number;
  jank: number;
  gpuTime: number;
  cpuTime: number;
  memoryUsage: number;
  drawCalls: number;
  dataPointsRendered: number;
  droppedFrames: number;
}

export interface OptimizationSuggestion {
  type: 'quality' | 'data' | 'rendering' | 'memory';
  action: string;
  impact: 'low' | 'medium' | 'high';
  autoApply: boolean;
}

export class ChartPerformanceOptimizer {
  private config: PerformanceConfig;
  private performanceProfile$ = new BehaviorSubject<PerformanceProfile>({
    fps: 60,
    frameTime: 16.67,
    jank: 0,
    gpuTime: 0,
    cpuTime: 0,
    memoryUsage: 0,
    drawCalls: 0,
    dataPointsRendered: 0,
    droppedFrames: 0
  });

  private renderBudget$ = new BehaviorSubject<RenderBudget>({
    frameTime: 16.67,
    dataPoints: 1000,
    animations: true,
    transitions: true,
    antialiasing: true,
    shadows: false,
    complexity: 'high'
  });

  private suggestions$ = new BehaviorSubject<OptimizationSuggestion[]>([]);
  private destroy$ = new Subject<void>();

  // Performance tracking
  private frameCount = 0;
  private lastFrameTime = 0;
  private frameTimeBuffer: number[] = [];
  private jankThreshold = 50; // ms
  private droppedFrames = 0;

  // Memory pooling
  private objectPools = new Map<string, any[]>();
  private poolSizes = new Map<string, number>();

  // GPU detection
  private gpuTier: 'low' | 'medium' | 'high' = 'medium';
  private hasWebGL2 = false;
  private maxTextureSize = 4096;

  // Web Worker pool
  private workerPool: Worker[] = [];
  private workerTasks = new Map<number, (result: any) => void>();
  private nextWorkerId = 0;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      targetFPS: 60,
      minFPS: 30,
      enableGPU: true,
      enableWorkers: true,
      memoryLimit: 512, // MB
      adaptiveQuality: true,
      profileMode: false,
      ...config
    };

    this.detectGPUCapabilities();
    this.initializeWorkerPool();
    this.startPerformanceMonitoring();
  }

  /**
   * Detect GPU capabilities
   */
  private detectGPUCapabilities(): void {
    if (!this.config.enableGPU) return;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (gl) {
        this.hasWebGL2 = !!canvas.getContext('webgl2');
        
        // Get GPU info
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          
          // Classify GPU tier based on renderer string
          this.gpuTier = this.classifyGPU(renderer);
        }
        
        // Get capabilities
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        
        // Cleanup
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) loseContext.loseContext();
      }
    } catch (error) {
      console.warn('GPU detection failed:', error);
      this.config.enableGPU = false;
    }
  }

  /**
   * Classify GPU tier based on renderer string
   */
  private classifyGPU(renderer: string): 'low' | 'medium' | 'high' {
    const lowEndGPUs = ['Intel HD', 'Intel UHD', 'Mali', 'Adreno'];
    const highEndGPUs = ['RTX', 'GTX 10', 'GTX 16', 'GTX 20', 'GTX 30', 'RX 6', 'RX 7'];
    
    const rendererLower = renderer.toLowerCase();
    
    if (highEndGPUs.some(gpu => rendererLower.includes(gpu.toLowerCase()))) {
      return 'high';
    }
    
    if (lowEndGPUs.some(gpu => rendererLower.includes(gpu.toLowerCase()))) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Initialize Web Worker pool
   */
  private initializeWorkerPool(): void {
    if (!this.config.enableWorkers || typeof Worker === 'undefined') return;

    const workerCount = navigator.hardwareConcurrency || 4;
    
    for (let i = 0; i < Math.min(workerCount, 4); i++) {
      try {
        const worker = new Worker(
          new URL('./workers/ChartDataProcessor.worker.ts', import.meta.url)
        );
        
        worker.onmessage = (e) => {
          const { id, result } = e.data;
          const callback = this.workerTasks.get(id);
          if (callback) {
            callback(result);
            this.workerTasks.delete(id);
          }
        };
        
        this.workerPool.push(worker);
      } catch (error) {
        console.warn('Worker initialization failed:', error);
        this.config.enableWorkers = false;
        break;
      }
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Main performance loop
    const measurePerformance = (timestamp: number) => {
      if (this.lastFrameTime) {
        const frameTime = timestamp - this.lastFrameTime;
        this.frameTimeBuffer.push(frameTime);
        
        if (this.frameTimeBuffer.length > 60) {
          this.frameTimeBuffer.shift();
        }
        
        // Detect jank
        if (frameTime > this.jankThreshold) {
          this.droppedFrames++;
        }
        
        this.frameCount++;
      }
      
      this.lastFrameTime = timestamp;
      
      if (!this.destroy$.closed) {
        requestAnimationFrame(measurePerformance);
      }
    };
    
    requestAnimationFrame(measurePerformance);

    // Update metrics periodically
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updatePerformanceProfile();
        this.generateOptimizationSuggestions();
        
        if (this.config.adaptiveQuality) {
          this.adjustRenderBudget();
        }
      });
  }

  /**
   * Update performance profile
   */
  private updatePerformanceProfile(): void {
    const avgFrameTime = this.frameTimeBuffer.length > 0
      ? this.frameTimeBuffer.reduce((a, b) => a + b) / this.frameTimeBuffer.length
      : 16.67;
    
    const fps = 1000 / avgFrameTime;
    const jank = this.frameTimeBuffer.filter(ft => ft > this.jankThreshold).length;
    
    // Estimate CPU/GPU split (simplified)
    const gpuTime = this.config.enableGPU ? avgFrameTime * 0.6 : 0;
    const cpuTime = avgFrameTime - gpuTime;
    
    // Get memory usage
    const memoryUsage = this.getMemoryUsage();
    
    this.performanceProfile$.next({
      fps: Math.round(fps),
      frameTime: avgFrameTime,
      jank,
      gpuTime,
      cpuTime,
      memoryUsage,
      drawCalls: this.estimateDrawCalls(),
      dataPointsRendered: this.getCurrentDataPoints(),
      droppedFrames: this.droppedFrames
    });
    
    // Reset counters
    this.frameCount = 0;
    this.droppedFrames = 0;
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return (memory.usedJSHeapSize / 1048576); // Convert to MB
    }
    return 0;
  }

  /**
   * Estimate draw calls based on render budget
   */
  private estimateDrawCalls(): number {
    const budget = this.renderBudget$.value;
    let calls = 1; // Base canvas clear
    
    calls += Math.ceil(budget.dataPoints / 1000); // Data batching
    calls += budget.animations ? 2 : 0; // Animation layers
    calls += budget.antialiasing ? 1 : 0; // AA pass
    calls += budget.shadows ? 1 : 0; // Shadow pass
    
    return calls;
  }

  /**
   * Get current data points being rendered
   */
  private getCurrentDataPoints(): number {
    return this.renderBudget$.value.dataPoints;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(): void {
    const suggestions: OptimizationSuggestion[] = [];
    const profile = this.performanceProfile$.value;
    const budget = this.renderBudget$.value;
    
    // FPS-based suggestions
    if (profile.fps < this.config.minFPS) {
      if (budget.dataPoints > 500) {
        suggestions.push({
          type: 'data',
          action: 'Reduce data points to improve performance',
          impact: 'high',
          autoApply: true
        });
      }
      
      if (budget.animations) {
        suggestions.push({
          type: 'rendering',
          action: 'Disable animations for better performance',
          impact: 'medium',
          autoApply: true
        });
      }
      
      if (budget.antialiasing) {
        suggestions.push({
          type: 'quality',
          action: 'Disable antialiasing to improve FPS',
          impact: 'low',
          autoApply: true
        });
      }
    }
    
    // Memory-based suggestions
    if (profile.memoryUsage > this.config.memoryLimit * 0.8) {
      suggestions.push({
        type: 'memory',
        action: 'Clear old data to free memory',
        impact: 'high',
        autoApply: true
      });
    }
    
    // Jank-based suggestions
    if (profile.jank > 5) {
      suggestions.push({
        type: 'rendering',
        action: 'Enable frame skipping to reduce jank',
        impact: 'medium',
        autoApply: false
      });
    }
    
    this.suggestions$.next(suggestions);
  }

  /**
   * Adjust render budget based on performance
   */
  private adjustRenderBudget(): void {
    const profile = this.performanceProfile$.value;
    const currentBudget = this.renderBudget$.value;
    const targetFrameTime = 1000 / this.config.targetFPS;
    
    let newBudget = { ...currentBudget };
    
    // Adjust based on FPS
    if (profile.fps < this.config.minFPS) {
      // Reduce quality
      if (newBudget.complexity === 'ultra') {
        newBudget.complexity = 'high';
      } else if (newBudget.complexity === 'high') {
        newBudget.complexity = 'medium';
        newBudget.shadows = false;
      } else if (newBudget.complexity === 'medium') {
        newBudget.complexity = 'low';
        newBudget.antialiasing = false;
        newBudget.transitions = false;
      } else {
        newBudget.animations = false;
        newBudget.dataPoints = Math.max(100, Math.floor(newBudget.dataPoints * 0.7));
      }
    } else if (profile.fps > this.config.targetFPS * 0.95 && profile.frameTime < targetFrameTime * 0.8) {
      // Increase quality
      if (newBudget.complexity === 'low') {
        newBudget.complexity = 'medium';
        newBudget.transitions = true;
      } else if (newBudget.complexity === 'medium') {
        newBudget.complexity = 'high';
        newBudget.antialiasing = true;
        newBudget.animations = true;
      } else if (newBudget.complexity === 'high' && this.gpuTier === 'high') {
        newBudget.complexity = 'ultra';
        newBudget.shadows = true;
        newBudget.dataPoints = Math.min(10000, Math.floor(newBudget.dataPoints * 1.2));
      }
    }
    
    // Apply GPU-specific optimizations
    if (this.config.enableGPU) {
      switch (this.gpuTier) {
        case 'low':
          newBudget.dataPoints = Math.min(newBudget.dataPoints, 500);
          newBudget.shadows = false;
          break;
        case 'medium':
          newBudget.dataPoints = Math.min(newBudget.dataPoints, 2000);
          break;
        case 'high':
          // No restrictions
          break;
      }
    }
    
    this.renderBudget$.next(newBudget);
  }

  /**
   * Create object pool for efficient memory management
   */
  public createObjectPool<T>(
    name: string, 
    factory: () => T, 
    reset: (obj: T) => void,
    initialSize: number = 100
  ): ObjectPool<T> {
    const pool: T[] = [];
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      pool.push(factory());
    }
    
    this.objectPools.set(name, pool);
    this.poolSizes.set(name, initialSize);
    
    return {
      get: () => {
        if (pool.length > 0) {
          return pool.pop()!;
        }
        return factory();
      },
      release: (obj: T) => {
        reset(obj);
        if (pool.length < initialSize * 2) {
          pool.push(obj);
        }
      },
      clear: () => {
        pool.length = 0;
      },
      size: () => pool.length
    };
  }

  /**
   * Decimate data for performance
   */
  public decimateData<T>(
    data: T[], 
    targetPoints: number,
    extractValue: (item: T) => number
  ): T[] {
    if (data.length <= targetPoints) return data;
    
    const ratio = data.length / targetPoints;
    const decimated: T[] = [];
    
    if (ratio < 2) {
      // Simple nth-point decimation
      const step = Math.floor(ratio);
      for (let i = 0; i < data.length; i += step) {
        decimated.push(data[i]);
      }
    } else {
      // Largest triangle three buckets algorithm
      decimated.push(data[0]); // Always include first point
      
      const bucketSize = (data.length - 2) / (targetPoints - 2);
      
      for (let i = 0; i < targetPoints - 2; i++) {
        const bucketStart = Math.floor((i) * bucketSize) + 1;
        const bucketEnd = Math.floor((i + 1) * bucketSize) + 1;
        
        let maxArea = -1;
        let maxAreaPoint = data[bucketStart];
        
        for (let j = bucketStart; j < bucketEnd && j < data.length; j++) {
          const area = Math.abs(
            (j - (i * bucketSize)) * extractValue(data[j]) +
            ((i + 2) * bucketSize - j) * extractValue(data[i * Math.floor(bucketSize)])
          );
          
          if (area > maxArea) {
            maxArea = area;
            maxAreaPoint = data[j];
          }
        }
        
        decimated.push(maxAreaPoint);
      }
      
      decimated.push(data[data.length - 1]); // Always include last point
    }
    
    return decimated;
  }

  /**
   * Offload heavy computation to Web Worker
   */
  public async offloadToWorker<T, R>(
    task: string,
    data: T
  ): Promise<R> {
    if (!this.config.enableWorkers || this.workerPool.length === 0) {
      throw new Error('Workers not available');
    }
    
    return new Promise((resolve, reject) => {
      const id = this.nextWorkerId++;
      const worker = this.workerPool[id % this.workerPool.length];
      
      this.workerTasks.set(id, resolve);
      
      worker.postMessage({ id, task, data });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.workerTasks.has(id)) {
          this.workerTasks.delete(id);
          reject(new Error('Worker task timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Get current performance profile
   */
  public getPerformanceProfile(): Observable<PerformanceProfile> {
    return this.performanceProfile$.asObservable();
  }

  /**
   * Get current render budget
   */
  public getRenderBudget(): Observable<RenderBudget> {
    return this.renderBudget$.asObservable();
  }

  /**
   * Get optimization suggestions
   */
  public getOptimizationSuggestions(): Observable<OptimizationSuggestion[]> {
    return this.suggestions$.asObservable();
  }

  /**
   * Apply optimization suggestion
   */
  public applySuggestion(suggestion: OptimizationSuggestion): void {
    const budget = { ...this.renderBudget$.value };
    
    switch (suggestion.type) {
      case 'quality':
        if (suggestion.action.includes('antialiasing')) {
          budget.antialiasing = false;
        }
        if (suggestion.action.includes('shadows')) {
          budget.shadows = false;
        }
        break;
        
      case 'data':
        if (suggestion.action.includes('data points')) {
          budget.dataPoints = Math.floor(budget.dataPoints * 0.5);
        }
        break;
        
      case 'rendering':
        if (suggestion.action.includes('animations')) {
          budget.animations = false;
        }
        if (suggestion.action.includes('transitions')) {
          budget.transitions = false;
        }
        break;
    }
    
    this.renderBudget$.next(budget);
  }

  /**
   * Enable profiling mode
   */
  public enableProfiling(): void {
    this.config.profileMode = true;
    console.log('Performance profiling enabled');
  }

  /**
   * Disable profiling mode
   */
  public disableProfiling(): void {
    this.config.profileMode = false;
  }

  /**
   * Export performance report
   */
  public exportPerformanceReport(): PerformanceReport {
    const profile = this.performanceProfile$.value;
    const budget = this.renderBudget$.value;
    
    return {
      timestamp: Date.now(),
      profile,
      budget,
      gpuInfo: {
        tier: this.gpuTier,
        hasWebGL2: this.hasWebGL2,
        maxTextureSize: this.maxTextureSize
      },
      suggestions: this.suggestions$.value,
      memoryPools: Array.from(this.poolSizes.entries()).map(([name, size]) => ({
        name,
        size,
        used: size - (this.objectPools.get(name)?.length || 0)
      }))
    };
  }

  /**
   * Destroy the optimizer
   */
  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Terminate workers
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
    
    // Clear pools
    this.objectPools.clear();
    this.poolSizes.clear();
    
    // Complete subjects
    this.performanceProfile$.complete();
    this.renderBudget$.complete();
    this.suggestions$.complete();
  }
}

// Type definitions
export interface ObjectPool<T> {
  get: () => T;
  release: (obj: T) => void;
  clear: () => void;
  size: () => number;
}

export interface PerformanceReport {
  timestamp: number;
  profile: PerformanceProfile;
  budget: RenderBudget;
  gpuInfo: {
    tier: 'low' | 'medium' | 'high';
    hasWebGL2: boolean;
    maxTextureSize: number;
  };
  suggestions: OptimizationSuggestion[];
  memoryPools: Array<{
    name: string;
    size: number;
    used: number;
  }>;
}

export default ChartPerformanceOptimizer;