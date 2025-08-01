/**
 * JSONFormatter - Export telemetry data to JSON format
 * Supports structured JSON output with optional compression and schema information
 */

import { 
  DataFormatter, 
  ExportConfig, 
  ExportFormat,
  ExportFormatOptions,
  FormatterData 
} from '../types/ExportTypes';

/**
 * JSON export structure
 */
interface JSONExportStructure {
  metadata: {
    version: string;
    generatedAt: string;
    exportConfig: ExportConfig;
    timeRange?: {
      start: string;
      end: string;
      timezone?: string;
    };
    statistics: {
      totalStreams: number;
      totalDataPoints: number;
      sampleRateRange: [number, number];
      units: string[];
    };
    schema?: JSONSchema;
  };
  streams: JSONStreamData[];
  analysis?: JSONAnalysisData[];
  correlations?: JSONCorrelationData[];
}

/**
 * JSON schema definition
 */
interface JSONSchema {
  version: string;
  description: string;
  properties: Record<string, any>;
}

/**
 * JSON stream data structure
 */
interface JSONStreamData {
  id: string;
  name: string;
  unit?: string;
  sampleRate: number;
  metadata?: Record<string, any>;
  data: Array<{
    timestamp: string;
    value: number;
  }>;
  statistics?: {
    count: number;
    mean: number;
    min: number;
    max: number;
    standardDeviation: number;
  };
}

/**
 * JSON analysis data structure
 */
interface JSONAnalysisData {
  streamId: string;
  streamName: string;
  summary: {
    statistics: {
      mean: number;
      median: number;
      standardDeviation: number;
      min: number;
      max: number;
      count: number;
    };
    trends: {
      direction: string;
      slope: number;
      confidence: number;
    };
    frequency: {
      dominantFrequency: number;
      peaks: Array<{ frequency: number; magnitude: number }>;
    };
  };
  anomalies: Array<{
    timestamp: string;
    value: number;
    type: string;
    severity: number;
    description: string;
  }>;
}

/**
 * JSON correlation data structure
 */
interface JSONCorrelationData {
  streamPair: {
    stream1: { id: string; name: string };
    stream2: { id: string; name: string };
  };
  correlations: {
    pearson: {
      coefficient: number;
      pValue?: number;
      significance: string;
      sampleSize: number;
    };
    spearman: {
      coefficient: number;
      significance: string;
      sampleSize: number;
    };
  };
  crossCorrelation: {
    maxCorrelation: number;
    maxLag: number;
    significantLags: Array<{
      lag: number;
      coefficient: number;
    }>;
  };
  lastUpdated: string;
}

/**
 * JSON data formatter implementation
 */
export class JSONFormatter implements DataFormatter {
  public readonly format: ExportFormat = 'json';
  public readonly mimeTypes: string[] = ['application/json', 'text/json'];
  public readonly extension: string = 'json';

  /**
   * Format data as JSON
   */
  public async format(
    data: FormatterData,
    config: ExportConfig,
    progressCallback?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const jsonOptions = config.formatOptions.json || this.getDefaultJSONOptions();
    progressCallback?.(0.1);

    // Build JSON structure
    const jsonStructure = await this.buildJSONStructure(data, config, jsonOptions, progressCallback);
    
    progressCallback?.(0.9);

    // Serialize to JSON string
    const jsonString = jsonOptions.prettyPrint 
      ? JSON.stringify(jsonStructure, null, 2)
      : JSON.stringify(jsonStructure);

    progressCallback?.(1.0);

    // Convert to ArrayBuffer
    const encoder = new TextEncoder();
    let buffer = encoder.encode(jsonString).buffer;

    // Apply compression if requested
    if (jsonOptions.compress) {
      buffer = await this.compressData(buffer);
    }

    return buffer;
  }

  /**
   * Validate JSON-specific configuration
   */
  public validateConfig(config: ExportConfig): string[] {
    const errors: string[] = [];
    // JSON format has minimal validation requirements
    // All options have sensible defaults
    return errors;
  }

  /**
   * Get default JSON options
   */
  public getDefaultOptions(): Partial<ExportFormatOptions> {
    return {
      json: this.getDefaultJSONOptions()
    };
  }

  /**
   * Build the complete JSON structure
   */
  private async buildJSONStructure(
    data: FormatterData,
    config: ExportConfig,
    options: NonNullable<ExportFormatOptions['json']>,
    progressCallback?: (progress: number) => void
  ): Promise<JSONExportStructure> {
    const { streams, analysisResults, correlations, metadata } = data;
    
    let currentProgress = 0.1;
    progressCallback?.(currentProgress);

    // Build metadata section
    const jsonMetadata: JSONExportStructure['metadata'] = {
      version: '1.0.0',
      generatedAt: metadata.generatedAt.toISOString(),
      exportConfig: config,
      statistics: {
        totalStreams: metadata.streamStats.totalStreams,
        totalDataPoints: metadata.streamStats.totalDataPoints,
        sampleRateRange: metadata.streamStats.sampleRateRange,
        units: metadata.streamStats.units
      }
    };

    // Add time range if present
    if (metadata.timeRange) {
      jsonMetadata.timeRange = {
        start: metadata.timeRange.start.toISOString(),
        end: metadata.timeRange.end.toISOString(),
        timezone: metadata.timeRange.timezone
      };
    }

    // Add schema if requested
    if (options.includeSchema) {
      jsonMetadata.schema = this.generateJSONSchema();
    }

    currentProgress = 0.2;
    progressCallback?.(currentProgress);

    // Build streams section
    const jsonStreams: JSONStreamData[] = [];
    for (let i = 0; i < streams.length; i++) {
      const stream = streams[i];
      jsonStreams.push(this.convertStreamToJSON(stream));
      
      currentProgress = 0.2 + ((i + 1) / streams.length) * 0.4;
      progressCallback?.(currentProgress);
    }

    currentProgress = 0.6;
    progressCallback?.(currentProgress);

    // Build analysis section if requested
    let jsonAnalysis: JSONAnalysisData[] | undefined;
    if (config.includeAnalysis && analysisResults.length > 0) {
      jsonAnalysis = [];
      for (let i = 0; i < analysisResults.length; i++) {
        const analysis = analysisResults[i];
        jsonAnalysis.push(this.convertAnalysisToJSON(analysis));
        
        currentProgress = 0.6 + ((i + 1) / analysisResults.length) * 0.15;
        progressCallback?.(currentProgress);
      }
    }

    currentProgress = 0.75;
    progressCallback?.(currentProgress);

    // Build correlations section if requested
    let jsonCorrelations: JSONCorrelationData[] | undefined;
    if (config.includeCorrelations && correlations.length > 0) {
      jsonCorrelations = [];
      for (let i = 0; i < correlations.length; i++) {
        const correlation = correlations[i];
        jsonCorrelations.push(this.convertCorrelationToJSON(correlation));
        
        currentProgress = 0.75 + ((i + 1) / correlations.length) * 0.15;
        progressCallback?.(currentProgress);
      }
    }

    // Assemble final structure
    const structure: JSONExportStructure = {
      metadata: jsonMetadata,
      streams: jsonStreams
    };

    if (jsonAnalysis) {
      structure.analysis = jsonAnalysis;
    }

    if (jsonCorrelations) {
      structure.correlations = jsonCorrelations;
    }

    return structure;
  }

  /**
   * Convert stream to JSON format
   */
  private convertStreamToJSON(stream: FormatterData['streams'][0]): JSONStreamData {
    const jsonStream: JSONStreamData = {
      id: stream.id,
      name: stream.name,
      sampleRate: stream.sampleRate,
      data: []
    };

    // Add optional fields
    if (stream.unit) {
      jsonStream.unit = stream.unit;
    }

    if (stream.metadata) {
      jsonStream.metadata = stream.metadata;
    }

    // Convert data points
    for (let i = 0; i < stream.data.length; i++) {
      const timestamp = stream.timestamps[i] || new Date();
      const value = stream.data[i];
      
      jsonStream.data.push({
        timestamp: timestamp.toISOString(),
        value: value
      });
    }

    // Calculate and add statistics
    if (jsonStream.data.length > 0) {
      const values = jsonStream.data.map(d => d.value);
      jsonStream.statistics = {
        count: values.length,
        mean: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        standardDeviation: this.calculateStandardDeviation(values)
      };
    }

    return jsonStream;
  }

  /**
   * Convert analysis result to JSON format
   */
  private convertAnalysisToJSON(analysis: FormatterData['analysisResults'][0]): JSONAnalysisData {
    const jsonAnalysis: JSONAnalysisData = {
      streamId: analysis.streamId,
      streamName: analysis.streamName,
      summary: {
        statistics: {
          mean: analysis.summary.statistics.mean,
          median: analysis.summary.statistics.median,
          standardDeviation: analysis.summary.statistics.standardDeviation,
          min: analysis.summary.statistics.min,
          max: analysis.summary.statistics.max,
          count: analysis.summary.statistics.count
        },
        trends: {
          direction: analysis.trends.direction,
          slope: analysis.trends.slope || 0,
          confidence: analysis.trends.confidence || 0
        },
        frequency: {
          dominantFrequency: analysis.frequency.dominantFrequency,
          peaks: analysis.frequency.peaks.map(peak => ({
            frequency: peak.frequency,
            magnitude: peak.magnitude
          }))
        }
      },
      anomalies: analysis.anomalies.map(anomaly => ({
        timestamp: anomaly.timestamp.toISOString(),
        value: anomaly.value,
        type: anomaly.type,
        severity: anomaly.severity,
        description: anomaly.description || `${anomaly.type} anomaly detected`
      }))
    };

    return jsonAnalysis;
  }

  /**
   * Convert correlation data to JSON format
   */
  private convertCorrelationToJSON(correlation: FormatterData['correlations'][0]): JSONCorrelationData {
    const jsonCorrelation: JSONCorrelationData = {
      streamPair: {
        stream1: {
          id: correlation.streamId1,
          name: correlation.streamName1
        },
        stream2: {
          id: correlation.streamId2,
          name: correlation.streamName2
        }
      },
      correlations: {
        pearson: {
          coefficient: correlation.pearson.coefficient,
          pValue: correlation.pearson.pValue,
          significance: correlation.pearson.significance,
          sampleSize: correlation.pearson.sampleSize
        },
        spearman: {
          coefficient: correlation.spearman.coefficient,
          significance: correlation.spearman.significance,
          sampleSize: correlation.spearman.sampleSize
        }
      },
      crossCorrelation: {
        maxCorrelation: correlation.crossCorrelation.maxCorrelation,
        maxLag: correlation.crossCorrelation.maxLag,
        significantLags: correlation.crossCorrelation.significantLags.map(lag => ({
          lag: lag.lag,
          coefficient: lag.coefficient
        }))
      },
      lastUpdated: correlation.lastUpdated.toISOString()
    };

    return jsonCorrelation;
  }

  /**
   * Generate JSON schema definition
   */
  private generateJSONSchema(): JSONSchema {
    return {
      version: '1.0.0',
      description: 'Telemetry Data Export JSON Schema',
      properties: {
        metadata: {
          type: 'object',
          description: 'Export metadata and configuration',
          properties: {
            version: { type: 'string' },
            generatedAt: { type: 'string', format: 'date-time' },
            exportConfig: { type: 'object' },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' },
                timezone: { type: 'string' }
              }
            },
            statistics: {
              type: 'object',
              properties: {
                totalStreams: { type: 'number' },
                totalDataPoints: { type: 'number' },
                sampleRateRange: { type: 'array', items: { type: 'number' } },
                units: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        },
        streams: {
          type: 'array',
          description: 'Telemetry stream data',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              unit: { type: 'string' },
              sampleRate: { type: 'number' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string', format: 'date-time' },
                    value: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        analysis: {
          type: 'array',
          description: 'Analysis results for streams',
          items: {
            type: 'object',
            properties: {
              streamId: { type: 'string' },
              streamName: { type: 'string' },
              summary: { type: 'object' },
              anomalies: { type: 'array' }
            }
          }
        },
        correlations: {
          type: 'array',
          description: 'Correlation analysis between streams',
          items: {
            type: 'object',
            properties: {
              streamPair: { type: 'object' },
              correlations: { type: 'object' },
              crossCorrelation: { type: 'object' }
            }
          }
        }
      }
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Compress data using built-in compression
   */
  private async compressData(buffer: ArrayBuffer): Promise<ArrayBuffer> {
    // Note: This is a placeholder for compression
    // In a real implementation, you might use libraries like pako for gzip compression
    // For now, we'll return the original buffer
    console.warn('JSON compression requested but not implemented. Returning uncompressed data.');
    return buffer;
  }

  /**
   * Get default JSON options
   */
  private getDefaultJSONOptions(): NonNullable<ExportFormatOptions['json']> {
    return {
      prettyPrint: true,
      includeSchema: false,
      compress: false
    };
  }
}

export default JSONFormatter;