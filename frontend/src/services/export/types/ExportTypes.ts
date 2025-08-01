/**
 * Export Types - Type definitions for telemetry data export functionality
 */

import { TelemetryStream, AnalysisReport } from '../../telemetry/TelemetryAnalyzer';
import { CorrelationMatrixEntry } from '../../telemetry/CorrelationAnalyzer';

/**
 * Supported export formats
 */
export type ExportFormat = 'csv' | 'json' | 'pdf' | 'xlsx' | 'png' | 'svg';

/**
 * Export data sources
 */
export type ExportDataSource = 
  | 'raw-telemetry'
  | 'analysis-results' 
  | 'correlation-matrix'
  | 'historical-data'
  | 'custom-query';

/**
 * Export time range configuration
 */
export interface ExportTimeRange {
  /** Start timestamp */
  start: Date;
  /** End timestamp */
  end: Date;
  /** Time zone for timestamps */
  timezone?: string;
}

/**
 * Stream selection for export
 */
export interface StreamSelection {
  /** Stream IDs to include */
  streamIds: string[];
  /** Whether to include all streams */
  includeAll: boolean;
  /** Filters to apply to streams */
  filters?: {
    /** Minimum sample rate */
    minSampleRate?: number;
    /** Maximum sample rate */
    maxSampleRate?: number;
    /** Units to include */
    units?: string[];
    /** Metadata filters */
    metadata?: Record<string, any>;
  };
}

/**
 * Export configuration options
 */
export interface ExportConfig {
  /** Export format */
  format: ExportFormat;
  /** Data source */
  dataSource: ExportDataSource;
  /** Selected streams */
  streams: StreamSelection;
  /** Time range (optional for non-time-based data) */
  timeRange?: ExportTimeRange;
  /** Include metadata */
  includeMetadata: boolean;
  /** Include analysis results */
  includeAnalysis: boolean;
  /** Include correlation data */
  includeCorrelations: boolean;
  /** Format-specific options */
  formatOptions: ExportFormatOptions;
  /** Output filename (without extension) */
  filename: string;
  /** Custom template (for PDF/reports) */
  templateId?: string;
}

/**
 * Format-specific export options
 */
export interface ExportFormatOptions {
  /** CSV options */
  csv?: {
    /** Field separator */
    delimiter: ',' | ';' | '\t';
    /** Include headers */
    includeHeaders: boolean;
    /** Quote all fields */
    quoteAll: boolean;
    /** Date format */
    dateFormat: string;
    /** Number precision */
    precision?: number;
  };
  
  /** JSON options */
  json?: {
    /** Pretty print with indentation */
    prettyPrint: boolean;
    /** Include schema information */
    includeSchema: boolean;
    /** Compression */
    compress: boolean;
  };
  
  /** PDF options */
  pdf?: {
    /** Page orientation */
    orientation: 'portrait' | 'landscape';
    /** Page size */
    pageSize: 'A4' | 'Letter' | 'Legal';
    /** Include charts/graphs */
    includeCharts: boolean;
    /** Include cover page */
    includeCoverPage: boolean;
    /** Report title */
    title?: string;
    /** Author name */
    author?: string;
    /** Custom header */
    header?: string;
    /** Custom footer */
    footer?: string;
  };
  
  /** Excel options */
  xlsx?: {
    /** Include charts */
    includeCharts: boolean;
    /** Include pivot tables */
    includePivotTables: boolean;
    /** Create separate sheets for different data types */
    separateSheets: boolean;
    /** Apply formatting */
    applyFormatting: boolean;
    /** Password protection */
    password?: string;
  };
  
  /** Image options */
  image?: {
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
    /** Background color */
    backgroundColor: string;
    /** Image quality (for JPEG) */
    quality: number;
    /** Include title */
    includeTitle: boolean;
  };
}

/**
 * Export progress information
 */
export interface ExportProgress {
  /** Current phase of export */
  phase: 'preparing' | 'fetching' | 'processing' | 'formatting' | 'finalizing' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current operation description */
  currentOperation: string;
  /** Number of items processed */
  itemsProcessed: number;
  /** Total items to process */
  totalItems: number;
  /** Start time */
  startTime: Date;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Any error that occurred */
  error?: Error;
}

/**
 * Export result information
 */
export interface ExportResult {
  /** Export job ID */
  id: string;
  /** Export configuration used */
  config: ExportConfig;
  /** Success status */
  success: boolean;
  /** Generated file information */
  file?: {
    /** Filename with extension */
    filename: string;
    /** File size in bytes */
    size: number;
    /** MIME type */
    mimeType: string;
    /** Download URL */
    downloadUrl: string;
    /** File buffer (for immediate download) */
    buffer?: ArrayBuffer;
  };
  /** Export statistics */
  stats: {
    /** Number of streams exported */
    streamsExported: number;
    /** Number of data points exported */
    dataPointsExported: number;
    /** Time range covered */
    timeRange?: ExportTimeRange;
    /** Processing time in milliseconds */
    processingTime: number;
    /** Generated at timestamp */
    generatedAt: Date;
  };
  /** Any errors or warnings */
  errors?: string[];
  warnings?: string[];
}

/**
 * Export job queue item
 */
export interface ExportJob {
  /** Unique job ID */
  id: string;
  /** Export configuration */
  config: ExportConfig;
  /** Job status */
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  /** Progress information */
  progress: ExportProgress;
  /** Result (when completed) */
  result?: ExportResult;
  /** Created timestamp */
  createdAt: Date;
  /** Updated timestamp */
  updatedAt: Date;
  /** User ID (if applicable) */
  userId?: string;
}

/**
 * Export service events
 */
export interface ExportServiceEvents {
  /** Export job started */
  'export-started': { job: ExportJob };
  /** Export progress updated */
  'export-progress': { job: ExportJob; progress: ExportProgress };
  /** Export completed successfully */
  'export-completed': { job: ExportJob; result: ExportResult };
  /** Export failed */
  'export-failed': { job: ExportJob; error: Error };
  /** Export cancelled */
  'export-cancelled': { job: ExportJob };
}

/**
 * Data formatter interface
 */
export interface DataFormatter {
  /** Format name */
  readonly format: ExportFormat;
  /** Supported MIME types */
  readonly mimeTypes: string[];
  /** File extension */
  readonly extension: string;
  
  /**
   * Format data according to the export configuration
   */
  format(
    data: FormatterData, 
    config: ExportConfig,
    progressCallback?: (progress: number) => void
  ): Promise<ArrayBuffer>;
  
  /**
   * Validate export configuration for this formatter
   */
  validateConfig(config: ExportConfig): string[];
  
  /**
   * Get default format options
   */
  getDefaultOptions(): Partial<ExportFormatOptions>;
}

/**
 * Data structure passed to formatters
 */
export interface FormatterData {
  /** Raw telemetry streams */
  streams: TelemetryStream[];
  /** Analysis results */
  analysisResults: AnalysisReport[];
  /** Correlation data */
  correlations: CorrelationMatrixEntry[];
  /** Export metadata */
  metadata: {
    /** Export configuration */
    config: ExportConfig;
    /** Generation timestamp */
    generatedAt: Date;
    /** Data time range */
    timeRange?: ExportTimeRange;
    /** Stream statistics */
    streamStats: {
      totalStreams: number;
      totalDataPoints: number;
      sampleRateRange: [number, number];
      units: string[];
    };
  };
}

/**
 * Report template definition
 */
export interface ReportTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Supported formats */
  supportedFormats: ExportFormat[];
  /** Template configuration */
  config: {
    /** Sections to include */
    sections: ReportSection[];
    /** Style settings */
    style: {
      /** Font family */
      fontFamily: string;
      /** Font size */
      fontSize: number;
      /** Color scheme */
      colors: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
      };
    };
  };
}

/**
 * Report section configuration
 */
export interface ReportSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section type */
  type: 'summary' | 'data-table' | 'chart' | 'correlation-matrix' | 'analysis' | 'custom';
  /** Include in export */
  enabled: boolean;
  /** Section-specific configuration */
  config: Record<string, any>;
  /** Display order */
  order: number;
}

/**
 * Scheduled export configuration
 */
export interface ScheduledExport {
  /** Schedule ID */
  id: string;
  /** Schedule name */
  name: string;
  /** Export configuration */
  exportConfig: ExportConfig;
  /** Schedule frequency */
  schedule: {
    /** Type of schedule */
    type: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom';
    /** Start date/time */
    startDate: Date;
    /** End date/time (optional) */
    endDate?: Date;
    /** Custom cron expression (for custom type) */
    cronExpression?: string;
    /** Timezone for schedule */
    timezone: string;
  };
  /** Delivery options */
  delivery: {
    /** Delivery method */
    method: 'download' | 'email' | 'api' | 'storage';
    /** Method-specific configuration */
    config: Record<string, any>;
  };
  /** Active status */
  active: boolean;
  /** Last execution */
  lastExecution?: {
    /** Execution timestamp */
    timestamp: Date;
    /** Success status */
    success: boolean;
    /** Error message (if failed) */
    error?: string;
  };
  /** Next execution */
  nextExecution?: Date;
}