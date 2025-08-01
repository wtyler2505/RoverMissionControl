/**
 * ExportService - Core orchestrator for telemetry data export operations
 * Coordinates multiple data sources and formats for comprehensive export functionality
 */

import { EventEmitter } from 'events';
import { 
  ExportConfig, 
  ExportJob, 
  ExportResult, 
  ExportProgress, 
  ExportServiceEvents,
  DataFormatter,
  FormatterData,
  ExportFormat,
  StreamSelection,
  ExportTimeRange
} from './types/ExportTypes';
import { TelemetryAnalyzer, TelemetryStream, AnalysisReport } from '../telemetry/TelemetryAnalyzer';
import { CorrelationAnalyzer, CorrelationMatrixEntry } from '../telemetry/CorrelationAnalyzer';
import { HistoricalDataManager } from '../telemetry/HistoricalDataManager';

/**
 * Export service configuration
 */
export interface ExportServiceConfig {
  /** Maximum concurrent export jobs */
  maxConcurrentJobs: number;
  /** Default timeout for export jobs (ms) */
  defaultTimeout: number;
  /** Maximum export file size (bytes) */
  maxFileSize: number;
  /** Enable export job persistence */
  persistJobs: boolean;
  /** Temporary file cleanup interval (ms) */
  cleanupInterval: number;
}

/**
 * Default export service configuration
 */
const DEFAULT_CONFIG: ExportServiceConfig = {
  maxConcurrentJobs: 3,
  defaultTimeout: 300000, // 5 minutes
  maxFileSize: 100 * 1024 * 1024, // 100MB
  persistJobs: true,
  cleanupInterval: 60000 // 1 minute
};

/**
 * Core export service class
 */
export class ExportService extends EventEmitter<ExportServiceEvents> {
  private config: ExportServiceConfig;
  private formatters: Map<ExportFormat, DataFormatter> = new Map();
  private jobs: Map<string, ExportJob> = new Map();
  private activeJobs: Set<string> = new Set();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private telemetryAnalyzer: TelemetryAnalyzer,
    private correlationAnalyzer: CorrelationAnalyzer,
    private historicalDataManager: HistoricalDataManager,
    config: Partial<ExportServiceConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupCleanupTimer();
  }

  /**
   * Register a data formatter
   */
  public registerFormatter(formatter: DataFormatter): void {
    this.formatters.set(formatter.format, formatter);
  }

  /**
   * Get all registered formatters
   */
  public getFormatters(): DataFormatter[] {
    return Array.from(this.formatters.values());
  }

  /**
   * Get supported export formats
   */
  public getSupportedFormats(): ExportFormat[] {
    return Array.from(this.formatters.keys());
  }

  /**
   * Create a new export job
   */
  public async createExport(config: ExportConfig): Promise<string> {
    // Validate configuration
    const validationErrors = this.validateExportConfig(config);
    if (validationErrors.length > 0) {
      throw new Error(`Export configuration validation failed: ${validationErrors.join(', ')}`);
    }

    // Check if we can start the job immediately
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      throw new Error(`Maximum concurrent jobs (${this.config.maxConcurrentJobs}) exceeded`);
    }

    // Create job
    const jobId = this.generateJobId();
    const job: ExportJob = {
      id: jobId,
      config,
      status: 'queued',
      progress: {
        phase: 'preparing',
        percentage: 0,
        currentOperation: 'Initializing export job',
        itemsProcessed: 0,
        totalItems: 0,
        startTime: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.emit('export-started', { job });

    // Start processing asynchronously
    this.processExportJob(jobId).catch(error => {
      this.handleJobError(jobId, error);
    });

    return jobId;
  }

  /**
   * Get export job status
   */
  public getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all export jobs
   */
  public getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel an export job
   */
  public cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    job.status = 'cancelled';
    job.updatedAt = new Date();
    this.activeJobs.delete(jobId);
    this.emit('export-cancelled', { job });
    return true;
  }

  /**
   * Clear completed and failed jobs
   */
  public clearCompletedJobs(): number {
    let cleared = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(jobId);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Destroy the service and cleanup resources
   */
  public destroy(): void {
    // Cancel all active jobs
    for (const jobId of this.activeJobs) {
      this.cancelJob(jobId);
    }

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    // Clear all jobs
    this.jobs.clear();
    this.activeJobs.clear();

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Process an export job
   */
  private async processExportJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      this.activeJobs.add(jobId);
      job.status = 'processing';
      job.updatedAt = new Date();

      // Update progress
      this.updateJobProgress(jobId, {
        phase: 'fetching',
        percentage: 10,
        currentOperation: 'Fetching telemetry data'
      });

      // Fetch data based on configuration
      const formatterData = await this.fetchExportData(job.config, jobId);

      // Update progress
      this.updateJobProgress(jobId, {
        phase: 'processing',
        percentage: 60,
        currentOperation: 'Processing data'
      });

      // Get formatter
      const formatter = this.formatters.get(job.config.format);
      if (!formatter) {
        throw new Error(`Formatter not found for format: ${job.config.format}`);
      }

      // Update progress
      this.updateJobProgress(jobId, {
        phase: 'formatting',
        percentage: 80,
        currentOperation: `Formatting as ${job.config.format.toUpperCase()}`
      });

      // Format data
      const buffer = await formatter.format(
        formatterData,
        job.config,
        (progress) => {
          this.updateJobProgress(jobId, {
            percentage: 80 + (progress * 0.15) // 80% -> 95%
          });
        }
      );

      // Update progress
      this.updateJobProgress(jobId, {
        phase: 'finalizing',
        percentage: 95,
        currentOperation: 'Finalizing export'
      });

      // Create result
      const result: ExportResult = {
        id: jobId,
        config: job.config,
        success: true,
        file: {
          filename: `${job.config.filename}.${formatter.extension}`,
          size: buffer.byteLength,
          mimeType: formatter.mimeTypes[0],
          downloadUrl: this.createDownloadUrl(buffer, formatter.mimeTypes[0]),
          buffer
        },
        stats: {
          streamsExported: formatterData.streams.length,
          dataPointsExported: formatterData.streams.reduce((total, stream) => total + stream.data.length, 0),
          timeRange: formatterData.metadata.timeRange,
          processingTime: Date.now() - job.progress.startTime.getTime(),
          generatedAt: new Date()
        }
      };

      // Complete job
      job.status = 'completed';
      job.result = result;
      job.progress.phase = 'complete';
      job.progress.percentage = 100;
      job.progress.currentOperation = 'Export completed successfully';
      job.updatedAt = new Date();

      this.activeJobs.delete(jobId);
      this.emit('export-completed', { job, result });

    } catch (error) {
      this.handleJobError(jobId, error as Error);
    }
  }

  /**
   * Fetch data for export based on configuration
   */
  private async fetchExportData(config: ExportConfig, jobId: string): Promise<FormatterData> {
    const streams: TelemetryStream[] = [];
    const analysisResults: AnalysisReport[] = [];
    const correlations: CorrelationMatrixEntry[] = [];

    // Update progress
    this.updateJobProgress(jobId, {
      currentOperation: 'Fetching stream data'
    });

    // Fetch streams based on selection
    const selectedStreams = await this.getSelectedStreams(config.streams);
    
    for (let i = 0; i < selectedStreams.length; i++) {
      const stream = selectedStreams[i];
      streams.push(stream);
      
      // Update progress
      this.updateJobProgress(jobId, {
        percentage: 10 + (i / selectedStreams.length) * 20,
        itemsProcessed: i + 1,
        totalItems: selectedStreams.length,
        currentOperation: `Processing stream: ${stream.name}`
      });
    }

    // Fetch analysis results if requested
    if (config.includeAnalysis) {
      this.updateJobProgress(jobId, {
        percentage: 35,
        currentOperation: 'Fetching analysis results'
      });

      for (const stream of streams) {
        const analysis = this.telemetryAnalyzer.getStreamAnalysis(stream.id);
        if (analysis) {
          analysisResults.push(analysis);
        }
      }
    }

    // Fetch correlations if requested
    if (config.includeCorrelations) {
      this.updateJobProgress(jobId, {
        percentage: 45,
        currentOperation: 'Fetching correlation data'
      });

      const correlationMatrix = this.correlationAnalyzer.calculateCorrelationMatrix();
      correlations.push(...correlationMatrix.values());
    }

    // Calculate statistics
    const dataPointsCount = streams.reduce((total, stream) => total + stream.data.length, 0);
    const sampleRates = streams.map(s => s.sampleRate).filter(rate => rate > 0);
    const units = Array.from(new Set(streams.map(s => s.unit).filter(Boolean) as string[]));

    return {
      streams,
      analysisResults,
      correlations,
      metadata: {
        config,
        generatedAt: new Date(),
        timeRange: config.timeRange,
        streamStats: {
          totalStreams: streams.length,
          totalDataPoints: dataPointsCount,
          sampleRateRange: sampleRates.length > 0 ? [Math.min(...sampleRates), Math.max(...sampleRates)] : [0, 0],
          units
        }
      }
    };
  }

  /**
   * Get selected streams based on selection criteria
   */
  private async getSelectedStreams(selection: StreamSelection): Promise<TelemetryStream[]> {
    if (selection.includeAll) {
      return this.telemetryAnalyzer.getAllStreams();
    }

    const allStreams = this.telemetryAnalyzer.getAllStreams();
    return allStreams.filter(stream => {
      // Check if stream ID is selected
      if (!selection.streamIds.includes(stream.id)) {
        return false;
      }

      // Apply filters if specified
      if (selection.filters) {
        const { minSampleRate, maxSampleRate, units, metadata } = selection.filters;
        
        if (minSampleRate && stream.sampleRate < minSampleRate) return false;
        if (maxSampleRate && stream.sampleRate > maxSampleRate) return false;
        if (units && stream.unit && !units.includes(stream.unit)) return false;
        
        // Check metadata filters
        if (metadata) {
          for (const [key, value] of Object.entries(metadata)) {
            if (!stream.metadata || stream.metadata[key] !== value) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }

  /**
   * Validate export configuration
   */
  private validateExportConfig(config: ExportConfig): string[] {
    const errors: string[] = [];

    // Check format support
    if (!this.formatters.has(config.format)) {
      errors.push(`Unsupported format: ${config.format}`);
    } else {
      // Validate format-specific options
      const formatter = this.formatters.get(config.format)!;
      const formatErrors = formatter.validateConfig(config);
      errors.push(...formatErrors);
    }

    // Validate stream selection
    if (!config.streams.includeAll && config.streams.streamIds.length === 0) {
      errors.push('No streams selected for export');
    }

    // Validate time range
    if (config.timeRange) {
      if (config.timeRange.start >= config.timeRange.end) {
        errors.push('Invalid time range: start must be before end');
      }
    }

    // Validate filename
    if (!config.filename || config.filename.trim() === '') {
      errors.push('Filename is required');
    }

    return errors;
  }

  /**
   * Handle job error
   */
  private handleJobError(jobId: string, error: Error): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.progress.phase = 'error';
    job.progress.error = error;
    job.updatedAt = new Date();
    
    this.activeJobs.delete(jobId);
    this.emit('export-failed', { job, error });
  }

  /**
   * Update job progress
   */
  private updateJobProgress(jobId: string, updates: Partial<ExportProgress>): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    Object.assign(job.progress, updates);
    job.updatedAt = new Date();
    
    // Calculate estimated completion if we have progress
    if (updates.percentage && updates.percentage > 0 && updates.percentage < 100) {
      const elapsed = Date.now() - job.progress.startTime.getTime();
      const estimatedTotal = (elapsed / updates.percentage) * 100;
      job.progress.estimatedCompletion = new Date(job.progress.startTime.getTime() + estimatedTotal);
    }

    this.emit('export-progress', { job, progress: job.progress });
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create download URL for exported data
   */
  private createDownloadUrl(buffer: ArrayBuffer, mimeType: string): string {
    const blob = new Blob([buffer], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Setup cleanup timer for old jobs
   */
  private setupCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, this.config.cleanupInterval);
  }

  /**
   * Clean up old completed/failed jobs
   */
  private cleanupOldJobs(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.updatedAt.getTime() < cutoffTime
      ) {
        // Clean up download URL if it exists
        if (job.result?.file?.downloadUrl) {
          try {
            URL.revokeObjectURL(job.result.file.downloadUrl);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
        
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`ExportService: Cleaned up ${cleaned} old jobs`);
    }
  }
}

export default ExportService;