/**
 * BackpressureHandler
 * 
 * Sophisticated backpressure management for high-frequency telemetry streams with:
 * - Multiple backpressure strategies (drop, buffer, sample, conflate)
 * - Adaptive strategy switching based on system load
 * - Memory-aware buffering with spill-to-disk capability
 * - Priority-based message handling
 * - Circuit breaker pattern for overload protection
 */

import { 
  Observable, 
  Subject, 
  BehaviorSubject,
  ReplaySubject,
  asyncScheduler,
  queueScheduler,
  merge,
  EMPTY,
  timer
} from 'rxjs';
import {
  scan,
  map,
  filter,
  switchMap,
  catchError,
  tap,
  share,
  bufferWhen,
  throttleTime,
  sampleTime,
  takeUntil,
  withLatestFrom,
  delay,
  retryWhen,
  concatMap
} from 'rxjs/operators';

export interface BackpressureConfig {
  strategy: BackpressureStrategy;
  bufferSize: number;
  highWaterMark: number;
  lowWaterMark: number;
  priorityLevels: number;
  adaptiveThresholds: {
    cpu: number;
    memory: number;
    latency: number;
  };
  spillToDisk: boolean;
  circuitBreaker: {
    enabled: boolean;
    threshold: number;
    timeout: number;
    halfOpenAttempts: number;
  };
}

export type BackpressureStrategy = 
  | 'drop-oldest'
  | 'drop-newest' 
  | 'drop-priority'
  | 'buffer'
  | 'buffer-sliding'
  | 'sample'
  | 'conflate'
  | 'adaptive';

export interface PrioritizedMessage<T> {
  data: T;
  priority: number;
  timestamp: number;
  attempt?: number;
  metadata?: Record<string, any>;
}

export interface BackpressureMetrics {
  strategy: BackpressureStrategy;
  bufferSize: number;
  droppedMessages: number;
  processedMessages: number;
  avgLatency: number;
  memoryPressure: number;
  cpuPressure: number;
  circuitState: 'closed' | 'open' | 'half-open';
}

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  eventLoopDelay: number;
}

export class BackpressureHandler<T = any> {
  private config: BackpressureConfig;
  private metrics$ = new BehaviorSubject<BackpressureMetrics>({
    strategy: 'adaptive',
    bufferSize: 0,
    droppedMessages: 0,
    processedMessages: 0,
    avgLatency: 0,
    memoryPressure: 0,
    cpuPressure: 0,
    circuitState: 'closed'
  });

  private systemMetrics$ = new BehaviorSubject<SystemMetrics>({
    cpuUsage: 0,
    memoryUsage: 0,
    eventLoopDelay: 0
  });

  private buffer: PrioritizedMessage<T>[] = [];
  private priorityQueues: Map<number, PrioritizedMessage<T>[]> = new Map();
  private spillBuffer: any[] = []; // Simplified disk spill buffer
  
  private circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  private circuitFailures = 0;
  private halfOpenAttempts = 0;
  private circuitTimer: any;

  private destroy$ = new Subject<void>();
  private processedCount = 0;
  private droppedCount = 0;
  private latencyBuffer: number[] = [];

  constructor(config: Partial<BackpressureConfig> = {}) {
    this.config = {
      strategy: 'adaptive',
      bufferSize: 10000,
      highWaterMark: 8000,
      lowWaterMark: 2000,
      priorityLevels: 3,
      adaptiveThresholds: {
        cpu: 80,
        memory: 85,
        latency: 100
      },
      spillToDisk: false,
      circuitBreaker: {
        enabled: true,
        threshold: 5,
        timeout: 30000,
        halfOpenAttempts: 3
      },
      ...config
    };

    this.initializePriorityQueues();
    this.startSystemMonitoring();
  }

  /**
   * Initialize priority queues
   */
  private initializePriorityQueues(): void {
    for (let i = 0; i < this.config.priorityLevels; i++) {
      this.priorityQueues.set(i, []);
    }
  }

  /**
   * Apply backpressure handling to stream
   */
  public handle(source$: Observable<T>, priorityFn?: (data: T) => number): Observable<T> {
    return source$.pipe(
      // Convert to prioritized messages
      map(data => this.createPrioritizedMessage(data, priorityFn)),
      
      // Apply circuit breaker
      this.applyCircuitBreaker(),
      
      // Apply backpressure strategy
      this.applyBackpressureStrategy(),
      
      // Extract data
      map(msg => msg.data),
      
      // Track metrics
      tap(() => this.updateMetrics()),
      
      // Share subscription
      share(),
      
      // Complete on destroy
      takeUntil(this.destroy$)
    );
  }

  /**
   * Create prioritized message
   */
  private createPrioritizedMessage(data: T, priorityFn?: (data: T) => number): PrioritizedMessage<T> {
    return {
      data,
      priority: priorityFn ? priorityFn(data) : 1,
      timestamp: Date.now(),
      attempt: 0
    };
  }

  /**
   * Apply circuit breaker pattern
   */
  private applyCircuitBreaker() {
    return (source$: Observable<PrioritizedMessage<T>>) => {
      if (!this.config.circuitBreaker.enabled) return source$;

      return source$.pipe(
        concatMap(msg => {
          switch (this.circuitState) {
            case 'closed':
              return this.processInClosedState(msg);
              
            case 'open':
              this.droppedCount++;
              return EMPTY;
              
            case 'half-open':
              return this.processInHalfOpenState(msg);
              
            default:
              return [msg];
          }
        })
      );
    };
  }

  /**
   * Process message in closed circuit state
   */
  private processInClosedState(msg: PrioritizedMessage<T>): Observable<PrioritizedMessage<T>> {
    const latency = Date.now() - msg.timestamp;
    
    if (latency > this.config.adaptiveThresholds.latency) {
      this.circuitFailures++;
      
      if (this.circuitFailures >= this.config.circuitBreaker.threshold) {
        this.openCircuit();
        return EMPTY;
      }
    } else {
      this.circuitFailures = Math.max(0, this.circuitFailures - 1);
    }
    
    return [msg];
  }

  /**
   * Process message in half-open circuit state
   */
  private processInHalfOpenState(msg: PrioritizedMessage<T>): Observable<PrioritizedMessage<T>> {
    this.halfOpenAttempts++;
    
    const latency = Date.now() - msg.timestamp;
    
    if (latency > this.config.adaptiveThresholds.latency) {
      // Failed attempt, reopen circuit
      this.openCircuit();
      return EMPTY;
    }
    
    if (this.halfOpenAttempts >= this.config.circuitBreaker.halfOpenAttempts) {
      // Successful attempts, close circuit
      this.closeCircuit();
    }
    
    return [msg];
  }

  /**
   * Open circuit breaker
   */
  private openCircuit(): void {
    this.circuitState = 'open';
    this.halfOpenAttempts = 0;
    
    // Schedule transition to half-open
    this.circuitTimer = setTimeout(() => {
      this.circuitState = 'half-open';
      this.halfOpenAttempts = 0;
    }, this.config.circuitBreaker.timeout);
    
    this.updateMetrics();
  }

  /**
   * Close circuit breaker
   */
  private closeCircuit(): void {
    this.circuitState = 'closed';
    this.circuitFailures = 0;
    this.halfOpenAttempts = 0;
    
    if (this.circuitTimer) {
      clearTimeout(this.circuitTimer);
      this.circuitTimer = null;
    }
    
    this.updateMetrics();
  }

  /**
   * Apply backpressure strategy
   */
  private applyBackpressureStrategy() {
    return (source$: Observable<PrioritizedMessage<T>>) => {
      const strategy = this.config.strategy === 'adaptive' 
        ? this.selectAdaptiveStrategy() 
        : this.config.strategy;

      switch (strategy) {
        case 'drop-oldest':
          return this.applyDropOldest(source$);
          
        case 'drop-newest':
          return this.applyDropNewest(source$);
          
        case 'drop-priority':
          return this.applyDropPriority(source$);
          
        case 'buffer':
          return this.applyBuffer(source$);
          
        case 'buffer-sliding':
          return this.applyBufferSliding(source$);
          
        case 'sample':
          return this.applySample(source$);
          
        case 'conflate':
          return this.applyConflate(source$);
          
        default:
          return source$;
      }
    };
  }

  /**
   * Select adaptive strategy based on system metrics
   */
  private selectAdaptiveStrategy(): BackpressureStrategy {
    const metrics = this.systemMetrics$.value;
    const { cpu, memory, latency } = this.config.adaptiveThresholds;

    // Critical memory pressure - drop aggressively
    if (metrics.memoryUsage > memory) {
      return 'drop-priority';
    }

    // High CPU - sample to reduce load
    if (metrics.cpuUsage > cpu) {
      return 'sample';
    }

    // High latency - conflate to catch up
    if (metrics.eventLoopDelay > latency) {
      return 'conflate';
    }

    // Moderate load - use sliding buffer
    if (metrics.memoryUsage > memory * 0.7 || metrics.cpuUsage > cpu * 0.7) {
      return 'buffer-sliding';
    }

    // Normal conditions - buffer everything
    return 'buffer';
  }

  /**
   * Drop oldest messages when buffer is full
   */
  private applyDropOldest(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    return source$.pipe(
      scan((buffer, msg) => {
        if (buffer.length >= this.config.bufferSize) {
          buffer.shift(); // Remove oldest
          this.droppedCount++;
        }
        buffer.push(msg);
        return buffer;
      }, [] as PrioritizedMessage<T>[]),
      switchMap(buffer => {
        if (buffer.length > 0) {
          const msg = buffer.shift()!;
          return [msg];
        }
        return EMPTY;
      })
    );
  }

  /**
   * Drop newest messages when buffer is full
   */
  private applyDropNewest(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    return source$.pipe(
      scan((buffer, msg) => {
        if (buffer.length < this.config.bufferSize) {
          buffer.push(msg);
        } else {
          this.droppedCount++;
        }
        return buffer;
      }, [] as PrioritizedMessage<T>[]),
      switchMap(buffer => {
        if (buffer.length > 0) {
          const msg = buffer.shift()!;
          return [msg];
        }
        return EMPTY;
      })
    );
  }

  /**
   * Drop lowest priority messages
   */
  private applyDropPriority(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    return source$.pipe(
      scan((buffer, msg) => {
        buffer.push(msg);
        
        if (buffer.length > this.config.bufferSize) {
          // Sort by priority (ascending) and remove lowest
          buffer.sort((a, b) => a.priority - b.priority);
          const dropped = buffer.shift()!;
          this.droppedCount++;
          
          // Re-sort by timestamp for processing order
          buffer.sort((a, b) => a.timestamp - b.timestamp);
        }
        
        return buffer;
      }, [] as PrioritizedMessage<T>[]),
      switchMap(buffer => {
        if (buffer.length > 0 && buffer.length >= this.config.lowWaterMark) {
          const batch = buffer.splice(0, Math.min(10, buffer.length));
          return batch;
        }
        return EMPTY;
      })
    );
  }

  /**
   * Buffer messages up to limit
   */
  private applyBuffer(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    return source$.pipe(
      bufferWhen(() => 
        merge(
          timer(100), // Time window
          source$.pipe(
            scan((count) => count + 1, 0),
            filter(count => count >= 100) // Count window
          )
        )
      ),
      switchMap(buffer => {
        if (this.buffer.length + buffer.length > this.config.bufferSize) {
          // Handle overflow
          if (this.config.spillToDisk) {
            this.spillToDisk(buffer);
          } else {
            const overflow = (this.buffer.length + buffer.length) - this.config.bufferSize;
            this.droppedCount += overflow;
            buffer = buffer.slice(0, buffer.length - overflow);
          }
        }
        
        this.buffer.push(...buffer);
        
        // Process when above low water mark
        if (this.buffer.length >= this.config.lowWaterMark) {
          const batch = this.buffer.splice(0, Math.min(100, this.buffer.length));
          return batch;
        }
        
        return EMPTY;
      })
    );
  }

  /**
   * Sliding window buffer
   */
  private applyBufferSliding(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    const windowSize = Math.floor(this.config.bufferSize / 2);
    
    return source$.pipe(
      scan((window, msg) => {
        window.push(msg);
        if (window.length > windowSize) {
          const dropped = window.shift()!;
          this.droppedCount++;
        }
        return window;
      }, [] as PrioritizedMessage<T>[]),
      switchMap(window => {
        if (window.length > 0) {
          const msg = window[0];
          return [msg];
        }
        return EMPTY;
      })
    );
  }

  /**
   * Sample messages at regular intervals
   */
  private applySample(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    // Adaptive sampling rate based on load
    const sampleRate = this.calculateAdaptiveSampleRate();
    
    return source$.pipe(
      sampleTime(sampleRate),
      tap(() => {
        // Track dropped messages (approximate)
        const expectedMessages = 1000 / sampleRate;
        this.droppedCount += Math.max(0, expectedMessages - 1);
      })
    );
  }

  /**
   * Conflate messages (keep only latest)
   */
  private applyConflate(source$: Observable<PrioritizedMessage<T>>): Observable<PrioritizedMessage<T>> {
    return source$.pipe(
      scan((acc, msg) => {
        if (acc.buffer.has(msg.data)) {
          // Update existing message
          acc.buffer.set(msg.data, msg);
        } else {
          acc.buffer.set(msg.data, msg);
        }
        
        acc.latest = msg;
        return acc;
      }, { buffer: new Map<T, PrioritizedMessage<T>>(), latest: null as PrioritizedMessage<T> | null }),
      throttleTime(10), // Process every 10ms
      map(acc => acc.latest!),
      filter(msg => msg !== null)
    );
  }

  /**
   * Calculate adaptive sample rate
   */
  private calculateAdaptiveSampleRate(): number {
    const metrics = this.systemMetrics$.value;
    const baseRate = 100; // Base 100ms
    
    // Increase sample interval under load
    const cpuFactor = Math.max(1, metrics.cpuUsage / 50);
    const memoryFactor = Math.max(1, metrics.memoryUsage / 50);
    const latencyFactor = Math.max(1, metrics.eventLoopDelay / 50);
    
    return baseRate * Math.max(cpuFactor, memoryFactor, latencyFactor);
  }

  /**
   * Spill buffer to disk (simplified implementation)
   */
  private spillToDisk(messages: PrioritizedMessage<T>[]): void {
    // In a real implementation, this would write to IndexedDB or a file
    this.spillBuffer.push(...messages);
    
    // Limit spill buffer size
    if (this.spillBuffer.length > this.config.bufferSize * 2) {
      const overflow = this.spillBuffer.length - this.config.bufferSize * 2;
      this.spillBuffer.splice(0, overflow);
      this.droppedCount += overflow;
    }
  }

  /**
   * Recover messages from disk spill
   */
  private recoverFromDisk(): PrioritizedMessage<T>[] {
    if (this.spillBuffer.length === 0) return [];
    
    const recovered = this.spillBuffer.splice(0, Math.min(100, this.spillBuffer.length));
    return recovered;
  }

  /**
   * Start system monitoring
   */
  private startSystemMonitoring(): void {
    // Monitor system metrics
    timer(0, 1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateSystemMetrics();
      });
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    // Simplified metrics - in production, use proper OS metrics
    const used = process.memoryUsage();
    const total = require('os').totalmem();
    
    this.systemMetrics$.next({
      cpuUsage: this.estimateCPUUsage(),
      memoryUsage: (used.heapUsed / total) * 100,
      eventLoopDelay: this.measureEventLoopDelay()
    });
  }

  /**
   * Estimate CPU usage (simplified)
   */
  private estimateCPUUsage(): number {
    // In production, use proper CPU metrics
    const loadAvg = require('os').loadavg()[0];
    const cpuCount = require('os').cpus().length;
    return Math.min(100, (loadAvg / cpuCount) * 100);
  }

  /**
   * Measure event loop delay
   */
  private measureEventLoopDelay(): number {
    const start = Date.now();
    setImmediate(() => {
      const delay = Date.now() - start;
      this.latencyBuffer.push(delay);
      if (this.latencyBuffer.length > 100) {
        this.latencyBuffer.shift();
      }
    });
    
    return this.latencyBuffer.length > 0
      ? this.latencyBuffer.reduce((a, b) => a + b) / this.latencyBuffer.length
      : 0;
  }

  /**
   * Update backpressure metrics
   */
  private updateMetrics(): void {
    const avgLatency = this.latencyBuffer.length > 0
      ? this.latencyBuffer.reduce((a, b) => a + b) / this.latencyBuffer.length
      : 0;

    this.metrics$.next({
      strategy: this.config.strategy,
      bufferSize: this.buffer.length + Array.from(this.priorityQueues.values())
        .reduce((sum, queue) => sum + queue.length, 0),
      droppedMessages: this.droppedCount,
      processedMessages: this.processedCount,
      avgLatency,
      memoryPressure: this.systemMetrics$.value.memoryUsage,
      cpuPressure: this.systemMetrics$.value.cpuUsage,
      circuitState: this.circuitState
    });
  }

  /**
   * Get current metrics
   */
  public getMetrics(): Observable<BackpressureMetrics> {
    return this.metrics$.asObservable();
  }

  /**
   * Get system metrics
   */
  public getSystemMetrics(): Observable<SystemMetrics> {
    return this.systemMetrics$.asObservable();
  }

  /**
   * Manually trigger strategy change
   */
  public setStrategy(strategy: BackpressureStrategy): void {
    this.config.strategy = strategy;
    this.updateMetrics();
  }

  /**
   * Clear buffers
   */
  public clearBuffers(): void {
    this.buffer = [];
    this.priorityQueues.forEach(queue => queue.length = 0);
    this.spillBuffer = [];
    this.droppedCount = 0;
    this.processedCount = 0;
    this.updateMetrics();
  }

  /**
   * Destroy handler
   */
  public destroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.metrics$.complete();
    this.systemMetrics$.complete();
    
    if (this.circuitTimer) {
      clearTimeout(this.circuitTimer);
    }
    
    this.clearBuffers();
  }
}