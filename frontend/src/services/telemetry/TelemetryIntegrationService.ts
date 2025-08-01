/**
 * TelemetryIntegrationService - Orchestrates all telemetry services for seamless integration
 * This service ensures all telemetry components work together harmoniously
 */

import { EventEmitter } from 'events';
import { TelemetryAnalyzer } from './TelemetryAnalyzer';
import { CorrelationAnalyzer } from './CorrelationAnalyzer';
import { AdvancedTrendAnalyzer } from './trend/AdvancedTrendAnalyzer';
import { DriftDetector } from './trend/DriftDetector';
import { PredictionEngine } from './trend/PredictionEngine';
import { HistoricalDataManager } from './HistoricalDataManager';
import { ExportService } from '../export/ExportService';
import { ChartExportService } from '../export/ChartExportService';
import { DashboardExportService } from '../export/DashboardExportService';
import { StreamingDataBuffer } from '../streaming/StreamingDataBuffer';
import { AnnotationService } from '../AnnotationService';
import { DashboardTemplateValidator } from '../validation/DashboardTemplateValidator';
import { DashboardTemplateEngine } from './DashboardTemplateEngine';

// Types
import { TelemetryStream, TelemetryDataPoint } from '../../types/telemetry';
import { ChartAnnotation } from '../../types/annotations';
import { DashboardTemplate } from '../../types/dashboardTemplates';
import { StreamConfig } from '../../types/streaming';
import { ExportFormat } from '../export/types/ExportTypes';

/**
 * Integration configuration
 */
export interface IntegrationConfig {
  enableRealTimeAnalysis?: boolean;
  enablePredictions?: boolean;
  enableAnnotations?: boolean;
  enableExport?: boolean;
  enableTemplates?: boolean;
  bufferSize?: number;
  analysisInterval?: number;
  predictionHorizon?: number;
  correlationThreshold?: number;
}

/**
 * Integration status
 */
export interface IntegrationStatus {
  services: {
    telemetryAnalyzer: boolean;
    correlationAnalyzer: boolean;
    trendAnalyzer: boolean;
    driftDetector: boolean;
    predictionEngine: boolean;
    exportService: boolean;
    annotationService: boolean;
    templateEngine: boolean;
  };
  streams: {
    active: number;
    total: number;
    health: Record<string, 'healthy' | 'degraded' | 'offline'>;
  };
  performance: {
    analysisLatency: number;
    predictionAccuracy: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

/**
 * Service events
 */
export interface IntegrationEvents {
  'status:changed': (status: IntegrationStatus) => void;
  'analysis:complete': (results: any) => void;
  'prediction:generated': (predictions: any) => void;
  'correlation:found': (correlation: any) => void;
  'drift:detected': (drift: any) => void;
  'annotation:added': (annotation: ChartAnnotation) => void;
  'export:complete': (result: any) => void;
  'template:applied': (template: DashboardTemplate) => void;
  'error': (error: Error) => void;
}

/**
 * Telemetry Integration Service
 */
export class TelemetryIntegrationService extends EventEmitter {
  private static instance: TelemetryIntegrationService;
  
  // Core services
  private telemetryAnalyzer: TelemetryAnalyzer;
  private correlationAnalyzer: CorrelationAnalyzer;
  private trendAnalyzer: AdvancedTrendAnalyzer;
  private driftDetector: DriftDetector;
  private predictionEngine: PredictionEngine;
  private historicalDataManager: HistoricalDataManager;
  private exportService: ExportService;
  private chartExportService: ChartExportService;
  private dashboardExportService: DashboardExportService;
  private annotationService: AnnotationService;
  private templateValidator: DashboardTemplateValidator;
  private templateEngine: DashboardTemplateEngine;
  
  // Stream management
  private streamBuffers: Map<string, StreamingDataBuffer> = new Map();
  private activeStreams: Map<string, TelemetryStream> = new Map();
  
  // Configuration
  private config: Required<IntegrationConfig>;
  
  // Analysis intervals
  private analysisIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  // Performance metrics
  private performanceMetrics = {
    analysisCount: 0,
    totalAnalysisTime: 0,
    predictionCount: 0,
    totalPredictionTime: 0
  };

  private constructor(config: IntegrationConfig = {}) {
    super();
    
    this.config = {
      enableRealTimeAnalysis: true,
      enablePredictions: true,
      enableAnnotations: true,
      enableExport: true,
      enableTemplates: true,
      bufferSize: 10000,
      analysisInterval: 1000,
      predictionHorizon: 100,
      correlationThreshold: 0.7,
      ...config
    };
    
    // Initialize services
    this.initializeServices();
    
    // Set up service connections
    this.connectServices();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: IntegrationConfig): TelemetryIntegrationService {
    if (!TelemetryIntegrationService.instance) {
      TelemetryIntegrationService.instance = new TelemetryIntegrationService(config);
    }
    return TelemetryIntegrationService.instance;
  }

  /**
   * Initialize all services
   */
  private initializeServices(): void {
    // Core analysis services
    this.telemetryAnalyzer = new TelemetryAnalyzer();
    this.correlationAnalyzer = new CorrelationAnalyzer();
    this.historicalDataManager = new HistoricalDataManager();
    
    // Advanced analysis services
    this.trendAnalyzer = new AdvancedTrendAnalyzer({
      enableARIMA: true,
      enableNonLinear: true,
      enableChangePoint: true,
      enableDecomposition: true
    });
    
    this.driftDetector = new DriftDetector({
      methods: ['adwin', 'page-hinkley', 'ddm', 'eddm', 'cusum', 'ewma'],
      warningThreshold: 0.05,
      driftThreshold: 0.01
    });
    
    this.predictionEngine = new PredictionEngine({
      models: ['exponential', 'holt-winters', 'arima', 'trend'],
      horizonSteps: this.config.predictionHorizon,
      updateThreshold: 0.1
    });
    
    // Export services
    this.exportService = new ExportService(
      this.telemetryAnalyzer,
      this.correlationAnalyzer,
      this.historicalDataManager
    );
    this.chartExportService = ChartExportService.getInstance();
    this.dashboardExportService = DashboardExportService.getInstance();
    
    // Annotation service
    this.annotationService = AnnotationService.getInstance();
    
    // Template services
    this.templateValidator = new DashboardTemplateValidator();
    this.templateEngine = new DashboardTemplateEngine();
  }

  /**
   * Connect services together
   */
  private connectServices(): void {
    // Forward telemetry analyzer events
    this.telemetryAnalyzer.on('analysis:complete', (results) => {
      this.emit('analysis:complete', results);
      
      // Trigger correlation analysis if significant changes
      if (results.statistics && this.config.enableRealTimeAnalysis) {
        this.checkForCorrelations();
      }
    });
    
    // Forward correlation events
    this.correlationAnalyzer.on('correlation:found', (correlation) => {
      if (Math.abs(correlation.coefficient) >= this.config.correlationThreshold) {
        this.emit('correlation:found', correlation);
      }
    });
    
    // Forward trend analysis events
    this.trendAnalyzer.on('trend:detected', (trend) => {
      this.emit('analysis:complete', { type: 'trend', data: trend });
      
      // Update prediction models
      if (this.config.enablePredictions) {
        this.updatePredictionModels(trend.streamId);
      }
    });
    
    // Forward drift detection events
    this.driftDetector.on('drift:detected', (drift) => {
      this.emit('drift:detected', drift);
      
      // Re-train models on drift
      if (drift.severity === 'high' && this.config.enablePredictions) {
        this.retrainModels(drift.streamId);
      }
    });
    
    // Forward prediction events
    this.predictionEngine.on('prediction:generated', (prediction) => {
      this.emit('prediction:generated', prediction);
    });
    
    // Forward annotation events
    this.annotationService.on('annotation:added', (annotation) => {
      this.emit('annotation:added', annotation);
    });
    
    // Forward export events
    this.exportService.on('export:complete', (result) => {
      this.emit('export:complete', result);
    });
  }

  /**
   * Add telemetry stream
   */
  public addStream(stream: TelemetryStream, config?: StreamConfig): void {
    // Create buffer for stream
    const buffer = new StreamingDataBuffer({
      capacity: config?.bufferCapacity || this.config.bufferSize,
      windowSize: config?.windowSize || 1000,
      updateInterval: config?.updateInterval || 100
    });
    
    this.streamBuffers.set(stream.id, buffer);
    this.activeStreams.set(stream.id, stream);
    
    // Start real-time analysis if enabled
    if (this.config.enableRealTimeAnalysis) {
      this.startStreamAnalysis(stream.id);
    }
    
    // Initialize drift detection
    if (this.config.enablePredictions) {
      this.driftDetector.reset(stream.id);
    }
    
    this.emitStatusUpdate();
  }

  /**
   * Remove telemetry stream
   */
  public removeStream(streamId: string): void {
    // Stop analysis
    this.stopStreamAnalysis(streamId);
    
    // Clean up resources
    this.streamBuffers.delete(streamId);
    this.activeStreams.delete(streamId);
    
    this.emitStatusUpdate();
  }

  /**
   * Add data point to stream
   */
  public addDataPoint(streamId: string, dataPoint: TelemetryDataPoint): void {
    const buffer = this.streamBuffers.get(streamId);
    if (!buffer) {
      console.warn(`Stream ${streamId} not found`);
      return;
    }
    
    // Add to buffer
    buffer.push(dataPoint);
    
    // Check for drift
    if (this.config.enablePredictions) {
      this.driftDetector.update(dataPoint.value, streamId);
    }
  }

  /**
   * Start stream analysis
   */
  private startStreamAnalysis(streamId: string): void {
    const interval = setInterval(() => {
      this.analyzeStream(streamId);
    }, this.config.analysisInterval);
    
    this.analysisIntervals.set(streamId, interval);
  }

  /**
   * Stop stream analysis
   */
  private stopStreamAnalysis(streamId: string): void {
    const interval = this.analysisIntervals.get(streamId);
    if (interval) {
      clearInterval(interval);
      this.analysisIntervals.delete(streamId);
    }
  }

  /**
   * Analyze stream
   */
  private async analyzeStream(streamId: string): Promise<void> {
    const buffer = this.streamBuffers.get(streamId);
    if (!buffer) return;
    
    const startTime = performance.now();
    
    try {
      // Get recent data
      const data = buffer.getWindow();
      if (data.length < 10) return; // Need minimum data
      
      // Basic analysis
      const analysis = await this.telemetryAnalyzer.analyzeData(data);
      
      // Trend analysis
      if (data.length >= 50) {
        const trendResult = await this.trendAnalyzer.analyze(data, streamId);
        analysis.trend = trendResult;
      }
      
      // Update metrics
      const analysisTime = performance.now() - startTime;
      this.performanceMetrics.analysisCount++;
      this.performanceMetrics.totalAnalysisTime += analysisTime;
      
      // Emit results
      this.emit('analysis:complete', {
        streamId,
        timestamp: Date.now(),
        analysis,
        latency: analysisTime
      });
      
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Check for correlations between streams
   */
  private async checkForCorrelations(): Promise<void> {
    const streamIds = Array.from(this.activeStreams.keys());
    if (streamIds.length < 2) return;
    
    // Get data from all streams
    const streamData: Record<string, any[]> = {};
    for (const streamId of streamIds) {
      const buffer = this.streamBuffers.get(streamId);
      if (buffer) {
        streamData[streamId] = buffer.getWindow();
      }
    }
    
    // Analyze correlations
    const correlations = await this.correlationAnalyzer.analyzeCorrelations(streamData);
    
    // Filter significant correlations
    const significant = correlations.filter(
      c => Math.abs(c.coefficient) >= this.config.correlationThreshold
    );
    
    significant.forEach(correlation => {
      this.emit('correlation:found', correlation);
    });
  }

  /**
   * Update prediction models for a stream
   */
  private async updatePredictionModels(streamId: string): Promise<void> {
    const buffer = this.streamBuffers.get(streamId);
    if (!buffer) return;
    
    const startTime = performance.now();
    
    try {
      const data = buffer.getAll();
      await this.predictionEngine.updateModels(data, streamId);
      
      // Generate predictions
      const predictions = await this.predictionEngine.predict(
        streamId,
        this.config.predictionHorizon
      );
      
      // Update metrics
      const predictionTime = performance.now() - startTime;
      this.performanceMetrics.predictionCount++;
      this.performanceMetrics.totalPredictionTime += predictionTime;
      
      // Emit predictions
      this.emit('prediction:generated', {
        streamId,
        predictions,
        latency: predictionTime
      });
      
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Retrain models after drift detection
   */
  private async retrainModels(streamId: string): Promise<void> {
    const buffer = this.streamBuffers.get(streamId);
    if (!buffer) return;
    
    // Get recent data (post-drift)
    const recentData = buffer.getWindow();
    
    // Reset and retrain
    await this.predictionEngine.resetModels(streamId);
    await this.predictionEngine.updateModels(recentData, streamId);
    
    // Also update trend analyzer
    await this.trendAnalyzer.reset(streamId);
  }

  /**
   * Apply dashboard template
   */
  public async applyTemplate(template: DashboardTemplate): Promise<void> {
    // Validate template
    const validation = await this.templateValidator.validate(template);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }
    
    // Apply template
    const dashboard = await this.templateEngine.instantiate(template);
    
    // Initialize required streams
    for (const streamId of template.requiredStreams) {
      if (!this.activeStreams.has(streamId)) {
        // Create placeholder stream
        this.addStream({
          id: streamId,
          name: streamId,
          type: 'telemetry'
        });
      }
    }
    
    this.emit('template:applied', template);
  }

  /**
   * Export data
   */
  public async exportData(
    streamIds: string[],
    format: ExportFormat,
    options?: any
  ): Promise<any> {
    const exportData: Record<string, any[]> = {};
    
    // Gather data from streams
    for (const streamId of streamIds) {
      const buffer = this.streamBuffers.get(streamId);
      if (buffer) {
        exportData[streamId] = buffer.getAll();
      }
    }
    
    // Perform export
    const result = await this.exportService.export({
      format,
      dataSource: 'telemetry-integration',
      streams: { streamIds },
      data: exportData,
      ...options
    });
    
    return result;
  }

  /**
   * Get integration status
   */
  public getStatus(): IntegrationStatus {
    const avgAnalysisLatency = this.performanceMetrics.analysisCount > 0
      ? this.performanceMetrics.totalAnalysisTime / this.performanceMetrics.analysisCount
      : 0;
      
    const avgPredictionLatency = this.performanceMetrics.predictionCount > 0
      ? this.performanceMetrics.totalPredictionTime / this.performanceMetrics.predictionCount
      : 0;
    
    return {
      services: {
        telemetryAnalyzer: true,
        correlationAnalyzer: true,
        trendAnalyzer: true,
        driftDetector: true,
        predictionEngine: true,
        exportService: true,
        annotationService: true,
        templateEngine: true
      },
      streams: {
        active: this.activeStreams.size,
        total: this.activeStreams.size,
        health: Object.fromEntries(
          Array.from(this.activeStreams.entries()).map(([id]) => [
            id,
            this.streamBuffers.get(id)?.getStatistics().dataRate > 0 ? 'healthy' : 'offline'
          ])
        )
      },
      performance: {
        analysisLatency: avgAnalysisLatency,
        predictionAccuracy: 0.95, // Placeholder
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cpuUsage: avgAnalysisLatency > 100 ? 0.8 : 0.3 // Rough estimate
      }
    };
  }

  /**
   * Emit status update
   */
  private emitStatusUpdate(): void {
    this.emit('status:changed', this.getStatus());
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Stop all analysis intervals
    this.analysisIntervals.forEach(interval => clearInterval(interval));
    this.analysisIntervals.clear();
    
    // Clear buffers
    this.streamBuffers.clear();
    this.activeStreams.clear();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export singleton instance
export const telemetryIntegration = TelemetryIntegrationService.getInstance();