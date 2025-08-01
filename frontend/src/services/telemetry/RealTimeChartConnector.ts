/**
 * RealTimeChartConnector
 * 
 * Integration layer that connects real-time data streams to chart components
 * with all performance optimizations and stream processing capabilities.
 * This is the main entry point for enabling real-time updates in charts.
 */

import { Observable, Subject, BehaviorSubject, merge, combineLatest } from 'rxjs';
import { map, filter, takeUntil, share, distinctUntilChanged } from 'rxjs/operators';
import { DataBindingLayer, TelemetryDataPoint, ChartDataAdapter } from './DataBindingLayer';
import { RealTimeUpdateManager, UpdateFrame, ChartUpdate } from './RealTimeUpdateManager';
import { StreamProcessor, StreamConfig, ProcessedDataPoint } from './StreamProcessor';
import { BackpressureHandler, BackpressureConfig } from './BackpressureHandler';
import { ChartPerformanceOptimizer, PerformanceConfig } from './ChartPerformanceOptimizer';

export interface RealTimeChartConfig {
  chartId: string;
  dataSourceId: string;
  channels: string[];
  updateStrategy: 'immediate' | 'batched' | 'adaptive';
  streamProcessing?: StreamConfig;
  backpressure?: Partial<BackpressureConfig>;
  performance?: Partial<PerformanceConfig>;
  visualization?: {
    maxDataPoints?: number;
    timeWindow?: number; // seconds
    aggregation?: 'none' | 'average' | 'min' | 'max';
    smoothing?: boolean;
    interpolation?: 'linear' | 'step' | 'basis' | 'cardinal';
  };
}

export interface ChartConnection {
  id: string;
  config: RealTimeChartConfig;
  disconnect: () => void;
  pause: () => void;
  resume: () => void;
  getMetrics: () => ChartConnectionMetrics;
}

export interface ChartConnectionMetrics {
  dataRate: number;
  latency: number;
  droppedFrames: number;
  bufferSize: number;
  isBackpressured: boolean;
  fps: number;
}

export class RealTimeChartConnector {
  private dataBindingLayer: DataBindingLayer;
  private updateManager: RealTimeUpdateManager;
  private performanceOptimizer: ChartPerformanceOptimizer;
  
  private connections = new Map<string, ChartConnectionInternal>();
  private destroy$ = new Subject<void>();
  
  constructor(
    dataBindingLayer: DataBindingLayer,
    globalPerformanceConfig?: Partial<PerformanceConfig>
  ) {
    this.dataBindingLayer = dataBindingLayer;
    this.updateManager = new RealTimeUpdateManager({
      targetFPS: 60,
      enableVirtualDOM: true,
      enableBatching: true,
      adaptiveQuality: true
    });
    this.performanceOptimizer = new ChartPerformanceOptimizer(globalPerformanceConfig);
    
    this.setupGlobalOptimizations();
  }
  
  /**
   * Connect a chart to real-time data stream
   */
  public connectChart(config: RealTimeChartConfig): ChartConnection {
    const connectionId = `${config.chartId}-${Date.now()}`;
    
    // Create stream processor
    const streamProcessor = new StreamProcessor<TelemetryDataPoint>(config.streamProcessing);
    
    // Create backpressure handler
    const backpressureHandler = new BackpressureHandler<ProcessedDataPoint<TelemetryDataPoint>>({
      strategy: 'adaptive',
      bufferSize: config.visualization?.maxDataPoints || 10000,
      ...config.backpressure
    });
    
    // Get data source
    const dataSource = this.dataBindingLayer.getDataSource(config.dataSourceId);
    if (!dataSource) {
      throw new Error(`Data source ${config.dataSourceId} not found`);
    }
    
    // Subscribe to channels
    config.channels.forEach(channel => {
      dataSource.subscribeToChannel(channel);
    });
    
    // Create data pipeline
    const dataPipeline = this.createDataPipeline(
      dataSource.data$,
      config,
      streamProcessor,
      backpressureHandler
    );
    
    // Create chart adapter
    const chartAdapter = this.createChartAdapter(config);
    
    // Subscribe to processed data
    const subscription = dataPipeline.subscribe(update => {
      this.updateManager.scheduleUpdate(update);
    });
    
    // Store connection
    const connection: ChartConnectionInternal = {
      id: connectionId,
      config,
      subscription,
      streamProcessor,
      backpressureHandler,
      isPaused: false,
      metrics: {
        dataRate: 0,
        latency: 0,
        droppedFrames: 0,
        bufferSize: 0,
        isBackpressured: false,
        fps: 60
      }
    };
    
    this.connections.set(connectionId, connection);
    
    // Start metrics collection
    this.startMetricsCollection(connection);
    
    return {
      id: connectionId,
      config,
      disconnect: () => this.disconnectChart(connectionId),
      pause: () => this.pauseChart(connectionId),
      resume: () => this.resumeChart(connectionId),
      getMetrics: () => this.getChartMetrics(connectionId)
    };
  }
  
  /**
   * Create data processing pipeline
   */
  private createDataPipeline(
    source$: Observable<TelemetryDataPoint>,
    config: RealTimeChartConfig,
    streamProcessor: StreamProcessor<TelemetryDataPoint>,
    backpressureHandler: BackpressureHandler<ProcessedDataPoint<TelemetryDataPoint>>
  ): Observable<UpdateFrame> {
    // Filter by channels
    const filtered$ = source$.pipe(
      filter(data => config.channels.includes(data.channel))
    );
    
    // Process stream
    const processed$ = streamProcessor.process(filtered$);
    
    // Apply backpressure
    const managed$ = backpressureHandler.handle(
      processed$,
      data => this.calculateDataPriority(data.data)
    );
    
    // Apply visualization transformations
    const visualized$ = this.applyVisualizationTransforms(managed$, config);
    
    // Convert to update frames
    return visualized$.pipe(
      map(data => this.createUpdateFrame(data, config)),
      filter(frame => frame.updates.length > 0),
      share()
    );
  }
  
  /**
   * Calculate data priority for backpressure handling
   */
  private calculateDataPriority(data: TelemetryDataPoint): number {
    // Higher priority for:
    // - Recent data (lower latency)
    // - Anomalous values
    // - Critical channels
    
    const now = Date.now();
    const age = now - data.timestamp;
    const agePriority = Math.max(0, 1 - age / 1000); // 0-1 based on age
    
    // Check for anomalies
    const isAnomaly = data.metadata?.anomaly || false;
    const anomalyPriority = isAnomaly ? 2 : 1;
    
    // Check for critical channels
    const criticalChannels = ['temperature', 'battery', 'error'];
    const isCritical = criticalChannels.some(c => data.channel.includes(c));
    const criticalPriority = isCritical ? 1.5 : 1;
    
    return agePriority * anomalyPriority * criticalPriority;
  }
  
  /**
   * Apply visualization-specific transformations
   */
  private applyVisualizationTransforms(
    source$: Observable<ProcessedDataPoint<TelemetryDataPoint>>,
    config: RealTimeChartConfig
  ): Observable<ProcessedDataPoint<TelemetryDataPoint>> {
    const { visualization = {} } = config;
    
    let pipeline = source$;
    
    // Apply time window
    if (visualization.timeWindow) {
      const windowMs = visualization.timeWindow * 1000;
      pipeline = pipeline.pipe(
        filter(point => Date.now() - point.timestamp < windowMs)
      );
    }
    
    // Apply data point limit
    if (visualization.maxDataPoints) {
      // This would be handled by the chart itself with decimation
      // Here we just mark for decimation
      pipeline = pipeline.pipe(
        map(point => ({
          ...point,
          metadata: {
            ...point.metadata,
            requiresDecimation: true,
            targetPoints: visualization.maxDataPoints
          }
        }))
      );
    }
    
    return pipeline;
  }
  
  /**
   * Create update frame for chart
   */
  private createUpdateFrame(
    data: ProcessedDataPoint<TelemetryDataPoint>,
    config: RealTimeChartConfig
  ): UpdateFrame {
    const updates: ChartUpdate[] = [];
    
    // Create data update
    updates.push({
      chartId: config.chartId,
      type: 'data',
      operation: 'add',
      target: `.data-${data.data.channel}`,
      data: {
        x: data.timestamp,
        y: typeof data.data.value === 'number' ? data.data.value : 0,
        ...data.data.metadata
      },
      transition: config.visualization?.smoothing ? {
        duration: 100,
        easing: 'linear'
      } : undefined
    });
    
    // Add scale update if needed
    if (this.shouldUpdateScale(data, config)) {
      updates.push({
        chartId: config.chartId,
        type: 'scale',
        operation: 'update',
        target: '.axis',
        data: {
          // Scale data would be calculated by the chart
          autoScale: true
        }
      });
    }
    
    // Add annotation for anomalies
    if (data.metadata && (data.metadata as any).anomalyScore) {
      updates.push({
        chartId: config.chartId,
        type: 'annotation',
        operation: 'add',
        target: '.anomalies',
        data: {
          id: `anomaly-${data.timestamp}`,
          type: 'circle',
          x: data.timestamp,
          y: typeof data.data.value === 'number' ? data.data.value : 0,
          r: 5,
          color: '#ff0000',
          opacity: 0.7
        }
      });
    }
    
    return {
      id: `frame-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      updates,
      priority: this.determineFramePriority(data, config),
      metadata: {
        channel: data.data.channel,
        latency: Date.now() - data.timestamp
      }
    };
  }
  
  /**
   * Determine if scale update is needed
   */
  private shouldUpdateScale(
    data: ProcessedDataPoint<TelemetryDataPoint>,
    config: RealTimeChartConfig
  ): boolean {
    // Simple heuristic - in production, track min/max values
    return Math.random() < 0.05; // Update scale 5% of the time
  }
  
  /**
   * Determine frame priority
   */
  private determineFramePriority(
    data: ProcessedDataPoint<TelemetryDataPoint>,
    config: RealTimeChartConfig
  ): UpdateFrame['priority'] {
    if ((data.metadata as any).anomalyScore) return 'immediate';
    if (data.data.channel.includes('error')) return 'high';
    if (config.updateStrategy === 'immediate') return 'high';
    return 'normal';
  }
  
  /**
   * Create chart adapter
   */
  private createChartAdapter(config: RealTimeChartConfig): ChartDataAdapter {
    return {
      channel: config.channels[0], // Primary channel
      transform: (data: TelemetryDataPoint) => {
        // Transform based on visualization config
        const { visualization = {} } = config;
        
        let value = typeof data.value === 'number' ? data.value : 0;
        
        // Apply aggregation if specified
        if (visualization.aggregation && visualization.aggregation !== 'none') {
          // This would aggregate with previous values
          // For now, just pass through
          value = value;
        }
        
        return {
          x: data.timestamp,
          y: value,
          metadata: data.metadata
        };
      },
      formatOptions: {
        interpolation: config.visualization?.interpolation || 'linear'
      }
    };
  }
  
  /**
   * Setup global optimizations
   */
  private setupGlobalOptimizations(): void {
    // Monitor global performance
    this.performanceOptimizer.getPerformanceProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe(profile => {
        // Adjust all connections based on global performance
        if (profile.fps < 30) {
          this.applyEmergencyOptimizations();
        }
      });
    
    // Monitor render budget
    this.performanceOptimizer.getRenderBudget()
      .pipe(
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this.destroy$)
      )
      .subscribe(budget => {
        // Update all chart render settings
        this.updateAllChartBudgets(budget);
      });
  }
  
  /**
   * Apply emergency optimizations when performance is critical
   */
  private applyEmergencyOptimizations(): void {
    this.connections.forEach(connection => {
      // Increase backpressure
      connection.backpressureHandler.setStrategy('drop-priority');
      
      // Reduce update rate
      if (connection.config.streamProcessing) {
        connection.config.streamProcessing.throttle = {
          strategy: 'time',
          windowMs: 100
        };
      }
    });
  }
  
  /**
   * Update all chart render budgets
   */
  private updateAllChartBudgets(budget: any): void {
    const updates: ChartUpdate[] = [];
    
    this.connections.forEach(connection => {
      updates.push({
        chartId: connection.config.chartId,
        type: 'style',
        operation: 'update',
        target: '.chart-container',
        data: {
          animations: budget.animations,
          transitions: budget.transitions,
          antialiasing: budget.antialiasing
        }
      });
    });
    
    if (updates.length > 0) {
      this.updateManager.batchUpdates(updates, 'low');
    }
  }
  
  /**
   * Start metrics collection for a connection
   */
  private startMetricsCollection(connection: ChartConnectionInternal): void {
    // Combine various metric sources
    combineLatest([
      connection.streamProcessor.getMetrics(),
      connection.backpressureHandler.getMetrics(),
      this.updateManager.getPerformanceMetrics()
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([streamMetrics, backpressureMetrics, performanceMetrics]) => {
        connection.metrics = {
          dataRate: streamMetrics.outputRate,
          latency: streamMetrics.averageLatency,
          droppedFrames: performanceMetrics.droppedFrames,
          bufferSize: backpressureMetrics.bufferSize,
          isBackpressured: backpressureMetrics.circuitState !== 'closed',
          fps: performanceMetrics.fps
        };
      });
  }
  
  /**
   * Disconnect a chart
   */
  private disconnectChart(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Unsubscribe from data
    connection.subscription.unsubscribe();
    
    // Cleanup processors
    connection.streamProcessor.destroy();
    connection.backpressureHandler.destroy();
    
    // Remove connection
    this.connections.delete(connectionId);
  }
  
  /**
   * Pause a chart connection
   */
  private pauseChart(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.isPaused = true;
    // Implementation would pause the subscription
  }
  
  /**
   * Resume a chart connection
   */
  private resumeChart(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.isPaused = false;
    // Implementation would resume the subscription
  }
  
  /**
   * Get metrics for a chart
   */
  private getChartMetrics(connectionId: string): ChartConnectionMetrics {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return {
        dataRate: 0,
        latency: 0,
        droppedFrames: 0,
        bufferSize: 0,
        isBackpressured: false,
        fps: 0
      };
    }
    
    return connection.metrics;
  }
  
  /**
   * Get all active connections
   */
  public getActiveConnections(): ChartConnection[] {
    return Array.from(this.connections.values()).map(conn => ({
      id: conn.id,
      config: conn.config,
      disconnect: () => this.disconnectChart(conn.id),
      pause: () => this.pauseChart(conn.id),
      resume: () => this.resumeChart(conn.id),
      getMetrics: () => this.getChartMetrics(conn.id)
    }));
  }
  
  /**
   * Destroy the connector
   */
  public destroy(): void {
    // Disconnect all charts
    this.connections.forEach((_, id) => this.disconnectChart(id));
    
    // Cleanup managers
    this.updateManager.destroy();
    this.performanceOptimizer.destroy();
    
    // Complete subjects
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Internal connection type
interface ChartConnectionInternal {
  id: string;
  config: RealTimeChartConfig;
  subscription: any;
  streamProcessor: StreamProcessor<TelemetryDataPoint>;
  backpressureHandler: BackpressureHandler<ProcessedDataPoint<TelemetryDataPoint>>;
  isPaused: boolean;
  metrics: ChartConnectionMetrics;
}

export default RealTimeChartConnector;