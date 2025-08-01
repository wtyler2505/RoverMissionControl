/**
 * RealTimeUpdateManager
 * 
 * High-performance manager for real-time chart updates with:
 * - Virtual DOM diffing for D3.js optimizations
 * - Intelligent batching and frame scheduling
 * - Backpressure handling for high-frequency streams
 * - Memory-efficient circular buffers
 * - Performance monitoring and adaptive quality
 */

import { select, Selection } from 'd3';
import { Subject, BehaviorSubject, Observable, animationFrameScheduler, asyncScheduler } from 'rxjs';
import { 
  throttleTime, 
  debounceTime, 
  buffer, 
  filter, 
  map, 
  scan,
  observeOn,
  tap,
  switchMap,
  withLatestFrom
} from 'rxjs/operators';

export interface UpdateFrame {
  id: string;
  timestamp: number;
  updates: ChartUpdate[];
  priority: 'immediate' | 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
}

export interface ChartUpdate {
  chartId: string;
  type: 'data' | 'style' | 'scale' | 'annotation';
  operation: 'add' | 'update' | 'remove';
  target: string; // CSS selector or D3 selection path
  data?: any;
  transition?: TransitionConfig;
}

export interface TransitionConfig {
  duration: number;
  easing?: string;
  delay?: number;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  updateLatency: number;
  memoryUsage: number;
  dataPointsPerSecond: number;
}

export interface BackpressureConfig {
  strategy: 'drop' | 'sample' | 'throttle' | 'buffer';
  threshold: number;
  bufferSize?: number;
  sampleRate?: number;
}

export interface UpdateManagerConfig {
  targetFPS: number;
  maxBufferSize: number;
  enableVirtualDOM: boolean;
  enableBatching: boolean;
  batchWindow: number;
  backpressure: BackpressureConfig;
  performanceMonitoring: boolean;
  adaptiveQuality: boolean;
}

export class RealTimeUpdateManager {
  private config: UpdateManagerConfig;
  private updateQueue = new Subject<UpdateFrame>();
  private performanceMetrics = new BehaviorSubject<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    droppedFrames: 0,
    updateLatency: 0,
    memoryUsage: 0,
    dataPointsPerSecond: 0
  });

  private frameScheduler = animationFrameScheduler;
  private asyncScheduler = asyncScheduler;
  private lastFrameTime = 0;
  private frameCount = 0;
  private droppedFrames = 0;
  private updateCount = 0;
  private lastMetricsUpdate = Date.now();

  // Virtual DOM cache for D3 selections
  private virtualDOM = new Map<string, VirtualNode>();
  private selectionCache = new Map<string, Selection<any, any, any, any>>();

  // Backpressure handling
  private backpressureThreshold = 1000;
  private isBackpressured = new BehaviorSubject<boolean>(false);

  constructor(config: Partial<UpdateManagerConfig> = {}) {
    this.config = {
      targetFPS: 60,
      maxBufferSize: 10000,
      enableVirtualDOM: true,
      enableBatching: true,
      batchWindow: 16, // ~60fps
      backpressure: {
        strategy: 'throttle',
        threshold: 1000,
        bufferSize: 5000,
        sampleRate: 0.5
      },
      performanceMonitoring: true,
      adaptiveQuality: true,
      ...config
    };

    this.initializeUpdatePipeline();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize the update processing pipeline with optimizations
   */
  private initializeUpdatePipeline(): void {
    const frameTime = 1000 / this.config.targetFPS;

    // Main update pipeline with batching and scheduling
    this.updateQueue.pipe(
      // Apply backpressure strategy
      this.applyBackpressure(),
      
      // Batch updates within frame window
      this.config.enableBatching
        ? buffer(this.updateQueue.pipe(throttleTime(this.config.batchWindow)))
        : map(update => [update]),
      
      // Filter empty batches
      filter(batch => batch.length > 0),
      
      // Schedule on animation frame for smooth updates
      observeOn(this.frameScheduler),
      
      // Process updates
      tap(batch => this.processBatch(batch))
    ).subscribe();
  }

  /**
   * Apply backpressure handling based on configuration
   */
  private applyBackpressure() {
    return (source: Observable<UpdateFrame>) => {
      const { strategy, threshold, bufferSize, sampleRate } = this.config.backpressure;

      switch (strategy) {
        case 'drop':
          return source.pipe(
            withLatestFrom(this.isBackpressured),
            filter(([_, backpressured]) => !backpressured),
            map(([update]) => update)
          );

        case 'sample':
          return source.pipe(
            withLatestFrom(this.isBackpressured),
            filter(([_, backpressured]) => !backpressured || Math.random() < (sampleRate || 0.5)),
            map(([update]) => update)
          );

        case 'throttle':
          return source.pipe(
            throttleTime(frameTime => {
              const metrics = this.performanceMetrics.value;
              return metrics.fps < 30 ? frameTime * 2 : frameTime;
            })
          );

        case 'buffer':
          return source.pipe(
            scan((buffer, update) => {
              if (buffer.length < (bufferSize || 5000)) {
                return [...buffer, update];
              }
              // Drop oldest when buffer is full
              return [...buffer.slice(1), update];
            }, [] as UpdateFrame[]),
            switchMap(buffer => {
              if (buffer.length > threshold) {
                this.isBackpressured.next(true);
                // Process in chunks
                return this.processBufferInChunks(buffer);
              }
              this.isBackpressured.next(false);
              return [buffer[buffer.length - 1]];
            })
          );

        default:
          return source;
      }
    };
  }

  /**
   * Process buffered updates in chunks to avoid blocking
   */
  private async processBufferInChunks(buffer: UpdateFrame[]): Promise<UpdateFrame> {
    const chunkSize = 100;
    const chunks = [];
    
    for (let i = 0; i < buffer.length; i += chunkSize) {
      chunks.push(buffer.slice(i, i + chunkSize));
    }

    // Process chunks with micro-tasks to avoid blocking
    for (const chunk of chunks) {
      await new Promise(resolve => this.asyncScheduler.schedule(resolve));
      this.processBatch(chunk);
    }

    return buffer[buffer.length - 1];
  }

  /**
   * Process a batch of updates efficiently
   */
  private processBatch(batch: UpdateFrame[]): void {
    const startTime = performance.now();

    // Group updates by chart for efficient processing
    const updatesByChart = new Map<string, ChartUpdate[]>();
    
    for (const frame of batch) {
      for (const update of frame.updates) {
        if (!updatesByChart.has(update.chartId)) {
          updatesByChart.set(update.chartId, []);
        }
        updatesByChart.get(update.chartId)!.push(update);
      }
    }

    // Apply updates per chart
    updatesByChart.forEach((updates, chartId) => {
      this.applyChartUpdates(chartId, updates);
    });

    // Update metrics
    const frameTime = performance.now() - startTime;
    this.updatePerformanceMetrics(frameTime, batch.length);
  }

  /**
   * Apply updates to a specific chart with virtual DOM diffing
   */
  private applyChartUpdates(chartId: string, updates: ChartUpdate[]): void {
    // Group updates by type for efficient processing
    const updatesByType = this.groupUpdatesByType(updates);

    // Apply data updates first (most common)
    if (updatesByType.data) {
      this.applyDataUpdates(chartId, updatesByType.data);
    }

    // Apply scale updates
    if (updatesByType.scale) {
      this.applyScaleUpdates(chartId, updatesByType.scale);
    }

    // Apply style updates
    if (updatesByType.style) {
      this.applyStyleUpdates(chartId, updatesByType.style);
    }

    // Apply annotations last
    if (updatesByType.annotation) {
      this.applyAnnotationUpdates(chartId, updatesByType.annotation);
    }
  }

  /**
   * Group updates by type for batch processing
   */
  private groupUpdatesByType(updates: ChartUpdate[]): Record<string, ChartUpdate[]> {
    return updates.reduce((acc, update) => {
      if (!acc[update.type]) {
        acc[update.type] = [];
      }
      acc[update.type].push(update);
      return acc;
    }, {} as Record<string, ChartUpdate[]>);
  }

  /**
   * Apply data updates with virtual DOM diffing
   */
  private applyDataUpdates(chartId: string, updates: ChartUpdate[]): void {
    const selection = this.getOrCreateSelection(chartId);
    
    // Batch data binding for efficiency
    const dataToAdd: any[] = [];
    const dataToUpdate = new Map<string, any>();
    const dataToRemove = new Set<string>();

    for (const update of updates) {
      switch (update.operation) {
        case 'add':
          dataToAdd.push(update.data);
          break;
        case 'update':
          dataToUpdate.set(update.target, update.data);
          break;
        case 'remove':
          dataToRemove.add(update.target);
          break;
      }
    }

    // Apply updates using D3's data join pattern
    if (this.config.enableVirtualDOM) {
      this.applyVirtualDOMDiff(selection, dataToAdd, dataToUpdate, dataToRemove);
    } else {
      this.applyDirectUpdates(selection, dataToAdd, dataToUpdate, dataToRemove);
    }
  }

  /**
   * Apply updates using virtual DOM diffing for performance
   */
  private applyVirtualDOMDiff(
    selection: Selection<any, any, any, any>,
    dataToAdd: any[],
    dataToUpdate: Map<string, any>,
    dataToRemove: Set<string>
  ): void {
    // Get current virtual DOM state
    const vdom = this.getVirtualDOM(selection.node());
    
    // Calculate minimal set of DOM operations
    const operations = this.calculateDOMOperations(vdom, dataToAdd, dataToUpdate, dataToRemove);
    
    // Apply operations in optimal order
    this.executeDOMOperations(selection, operations);
    
    // Update virtual DOM cache
    this.updateVirtualDOM(selection.node(), operations);
  }

  /**
   * Calculate minimal DOM operations needed
   */
  private calculateDOMOperations(
    vdom: VirtualNode,
    dataToAdd: any[],
    dataToUpdate: Map<string, any>,
    dataToRemove: Set<string>
  ): DOMOperation[] {
    const operations: DOMOperation[] = [];

    // Remove operations first (to free up memory)
    dataToRemove.forEach(id => {
      operations.push({
        type: 'remove',
        target: id,
        priority: 1
      });
    });

    // Update operations (modify existing elements)
    dataToUpdate.forEach((data, id) => {
      const existing = vdom.children.get(id);
      if (existing && this.hasChanged(existing.data, data)) {
        operations.push({
          type: 'update',
          target: id,
          data,
          priority: 2
        });
      }
    });

    // Add operations last
    dataToAdd.forEach(data => {
      operations.push({
        type: 'add',
        data,
        priority: 3
      });
    });

    // Sort by priority for optimal execution
    return operations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if data has actually changed
   */
  private hasChanged(oldData: any, newData: any): boolean {
    // Fast path for primitives
    if (typeof oldData !== 'object' || typeof newData !== 'object') {
      return oldData !== newData;
    }

    // Deep comparison for objects (optimized for common telemetry data)
    if (oldData.value !== newData.value || oldData.timestamp !== newData.timestamp) {
      return true;
    }

    // Additional property checks if needed
    return JSON.stringify(oldData) !== JSON.stringify(newData);
  }

  /**
   * Execute DOM operations efficiently
   */
  private executeDOMOperations(
    selection: Selection<any, any, any, any>,
    operations: DOMOperation[]
  ): void {
    // Batch similar operations
    const removeOps = operations.filter(op => op.type === 'remove');
    const updateOps = operations.filter(op => op.type === 'update');
    const addOps = operations.filter(op => op.type === 'add');

    // Execute in batches
    if (removeOps.length > 0) {
      selection.selectAll(removeOps.map(op => `[data-id="${op.target}"]`).join(', '))
        .remove();
    }

    if (updateOps.length > 0) {
      updateOps.forEach(op => {
        selection.select(`[data-id="${op.target}"]`)
          .datum(op.data)
          .call(this.updateElement.bind(this));
      });
    }

    if (addOps.length > 0) {
      const enter = selection.selectAll('.data-point')
        .data(addOps.map(op => op.data))
        .enter()
        .append('circle')
        .attr('class', 'data-point')
        .call(this.enterElement.bind(this));
    }
  }

  /**
   * Update element attributes efficiently
   */
  private updateElement(selection: Selection<any, any, any, any>): void {
    selection
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r || 3);
  }

  /**
   * Initialize new elements
   */
  private enterElement(selection: Selection<any, any, any, any>): void {
    selection
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 0)
      .transition()
      .duration(200)
      .attr('r', d => d.r || 3);
  }

  /**
   * Apply scale updates efficiently
   */
  private applyScaleUpdates(chartId: string, updates: ChartUpdate[]): void {
    // Implementation for scale updates
    const selection = this.getOrCreateSelection(chartId);
    
    updates.forEach(update => {
      if (update.data && update.data.scale) {
        // Update axes
        selection.select('.x-axis')
          .transition()
          .duration(update.transition?.duration || 250)
          .call(update.data.scale.x);

        selection.select('.y-axis')
          .transition()
          .duration(update.transition?.duration || 250)
          .call(update.data.scale.y);
      }
    });
  }

  /**
   * Apply style updates efficiently
   */
  private applyStyleUpdates(chartId: string, updates: ChartUpdate[]): void {
    const selection = this.getOrCreateSelection(chartId);
    
    updates.forEach(update => {
      const targetSelection = selection.select(update.target);
      if (!targetSelection.empty() && update.data) {
        Object.entries(update.data).forEach(([key, value]) => {
          targetSelection.style(key, value);
        });
      }
    });
  }

  /**
   * Apply annotation updates
   */
  private applyAnnotationUpdates(chartId: string, updates: ChartUpdate[]): void {
    const selection = this.getOrCreateSelection(chartId);
    
    updates.forEach(update => {
      switch (update.operation) {
        case 'add':
          this.addAnnotation(selection, update.data);
          break;
        case 'update':
          this.updateAnnotation(selection, update.target, update.data);
          break;
        case 'remove':
          this.removeAnnotation(selection, update.target);
          break;
      }
    });
  }

  /**
   * Add annotation to chart
   */
  private addAnnotation(selection: Selection<any, any, any, any>, data: any): void {
    const annotation = selection.append('g')
      .attr('class', 'annotation')
      .attr('data-id', data.id);

    // Add annotation elements based on type
    if (data.type === 'line') {
      annotation.append('line')
        .attr('x1', data.x1)
        .attr('y1', data.y1)
        .attr('x2', data.x2)
        .attr('y2', data.y2)
        .style('stroke', data.color || '#666')
        .style('stroke-dasharray', data.dashArray || '0');
    } else if (data.type === 'text') {
      annotation.append('text')
        .attr('x', data.x)
        .attr('y', data.y)
        .text(data.text)
        .style('fill', data.color || '#666');
    }
  }

  /**
   * Update existing annotation
   */
  private updateAnnotation(selection: Selection<any, any, any, any>, id: string, data: any): void {
    const annotation = selection.select(`[data-id="${id}"]`);
    if (!annotation.empty()) {
      // Update based on annotation type
      if (data.type === 'line') {
        annotation.select('line')
          .transition()
          .duration(200)
          .attr('x1', data.x1)
          .attr('y1', data.y1)
          .attr('x2', data.x2)
          .attr('y2', data.y2);
      }
    }
  }

  /**
   * Remove annotation
   */
  private removeAnnotation(selection: Selection<any, any, any, any>, id: string): void {
    selection.select(`[data-id="${id}"]`)
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Get or create D3 selection for chart
   */
  private getOrCreateSelection(chartId: string): Selection<any, any, any, any> {
    if (!this.selectionCache.has(chartId)) {
      const selection = select(`#${chartId}`);
      this.selectionCache.set(chartId, selection);
    }
    return this.selectionCache.get(chartId)!;
  }

  /**
   * Get virtual DOM for element
   */
  private getVirtualDOM(element: Element): VirtualNode {
    const id = element.id;
    if (!this.virtualDOM.has(id)) {
      this.virtualDOM.set(id, this.createVirtualNode(element));
    }
    return this.virtualDOM.get(id)!;
  }

  /**
   * Create virtual node from DOM element
   */
  private createVirtualNode(element: Element): VirtualNode {
    const node: VirtualNode = {
      id: element.id,
      tagName: element.tagName,
      attributes: new Map(),
      children: new Map(),
      data: null
    };

    // Copy attributes
    Array.from(element.attributes).forEach(attr => {
      node.attributes.set(attr.name, attr.value);
    });

    // Process children
    Array.from(element.children).forEach(child => {
      if (child.id) {
        node.children.set(child.id, this.createVirtualNode(child));
      }
    });

    return node;
  }

  /**
   * Update virtual DOM after operations
   */
  private updateVirtualDOM(element: Element, operations: DOMOperation[]): void {
    const vdom = this.getVirtualDOM(element);
    
    operations.forEach(op => {
      switch (op.type) {
        case 'add':
          // Add to virtual DOM
          const newNode = {
            id: op.data.id || `node-${Date.now()}`,
            tagName: 'circle',
            attributes: new Map(),
            children: new Map(),
            data: op.data
          };
          vdom.children.set(newNode.id, newNode);
          break;
          
        case 'update':
          // Update in virtual DOM
          const existing = vdom.children.get(op.target);
          if (existing) {
            existing.data = op.data;
          }
          break;
          
        case 'remove':
          // Remove from virtual DOM
          vdom.children.delete(op.target);
          break;
      }
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    if (!this.config.performanceMonitoring) return;

    // Monitor frame rate
    const measureFrame = () => {
      const now = performance.now();
      if (this.lastFrameTime) {
        const deltaTime = now - this.lastFrameTime;
        this.frameCount++;

        // Update metrics every second
        if (now - this.lastMetricsUpdate > 1000) {
          const fps = (this.frameCount * 1000) / (now - this.lastMetricsUpdate);
          const avgFrameTime = (now - this.lastMetricsUpdate) / this.frameCount;
          
          this.performanceMetrics.next({
            ...this.performanceMetrics.value,
            fps: Math.round(fps),
            frameTime: avgFrameTime,
            droppedFrames: this.droppedFrames,
            dataPointsPerSecond: this.updateCount
          });

          // Reset counters
          this.frameCount = 0;
          this.droppedFrames = 0;
          this.updateCount = 0;
          this.lastMetricsUpdate = now;

          // Adaptive quality adjustments
          if (this.config.adaptiveQuality) {
            this.adjustQualityBasedOnPerformance(fps);
          }
        }
      }
      this.lastFrameTime = now;
      requestAnimationFrame(measureFrame);
    };

    requestAnimationFrame(measureFrame);

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.performanceMetrics.next({
          ...this.performanceMetrics.value,
          memoryUsage: memory.usedJSHeapSize / memory.totalJSHeapSize
        });
      }, 5000);
    }
  }

  /**
   * Adjust rendering quality based on performance
   */
  private adjustQualityBasedOnPerformance(fps: number): void {
    if (fps < 30) {
      // Reduce quality for better performance
      this.config.batchWindow = Math.min(this.config.batchWindow * 1.5, 100);
      this.config.backpressure.threshold = Math.max(this.config.backpressure.threshold * 0.8, 500);
    } else if (fps > 55) {
      // Increase quality if performance is good
      this.config.batchWindow = Math.max(this.config.batchWindow * 0.9, 16);
      this.config.backpressure.threshold = Math.min(this.config.backpressure.threshold * 1.1, 2000);
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(frameTime: number, updateCount: number): void {
    this.updateCount += updateCount;
    
    // Check for dropped frames
    if (frameTime > 1000 / this.config.targetFPS * 1.5) {
      this.droppedFrames++;
    }
  }

  /**
   * Schedule an update
   */
  public scheduleUpdate(update: UpdateFrame): void {
    this.updateQueue.next(update);
  }

  /**
   * Batch multiple updates
   */
  public batchUpdates(updates: ChartUpdate[], priority: UpdateFrame['priority'] = 'normal'): void {
    this.scheduleUpdate({
      id: `batch-${Date.now()}`,
      timestamp: Date.now(),
      updates,
      priority
    });
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): Observable<PerformanceMetrics> {
    return this.performanceMetrics.asObservable();
  }

  /**
   * Check if system is backpressured
   */
  public isSystemBackpressured(): Observable<boolean> {
    return this.isBackpressured.asObservable();
  }

  /**
   * Clear all caches and reset state
   */
  public clear(): void {
    this.virtualDOM.clear();
    this.selectionCache.clear();
    this.updateCount = 0;
    this.droppedFrames = 0;
    this.frameCount = 0;
  }

  /**
   * Destroy the update manager
   */
  public destroy(): void {
    this.updateQueue.complete();
    this.performanceMetrics.complete();
    this.isBackpressured.complete();
    this.clear();
  }
}

// Type definitions
interface VirtualNode {
  id: string;
  tagName: string;
  attributes: Map<string, string>;
  children: Map<string, VirtualNode>;
  data: any;
}

interface DOMOperation {
  type: 'add' | 'update' | 'remove';
  target?: string;
  data?: any;
  priority: number;
}

export default RealTimeUpdateManager;