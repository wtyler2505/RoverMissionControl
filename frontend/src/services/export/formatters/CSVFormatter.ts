/**
 * CSVFormatter - Export telemetry data to CSV format
 * Supports various CSV configuration options and data structuring
 */

import { 
  DataFormatter, 
  ExportConfig, 
  ExportFormat,
  ExportFormatOptions,
  FormatterData 
} from '../types/ExportTypes';

/**
 * CSV data formatter implementation
 */
export class CSVFormatter implements DataFormatter {
  public readonly format: ExportFormat = 'csv';
  public readonly mimeTypes: string[] = ['text/csv', 'application/csv'];
  public readonly extension: string = 'csv';

  /**
   * Format data as CSV
   */
  public async format(
    data: FormatterData,
    config: ExportConfig,
    progressCallback?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const csvOptions = config.formatOptions.csv || this.getDefaultCSVOptions();
    progressCallback?.(0.1);

    // Determine CSV structure based on data
    const csvContent = this.generateCSVContent(data, csvOptions, progressCallback);
    
    progressCallback?.(1.0);
    
    // Convert to ArrayBuffer
    const encoder = new TextEncoder();
    return encoder.encode(csvContent).buffer;
  }

  /**
   * Validate CSV-specific configuration
   */
  public validateConfig(config: ExportConfig): string[] {
    const errors: string[] = [];
    const csvOptions = config.formatOptions.csv;

    if (csvOptions) {
      // Validate delimiter
      if (csvOptions.delimiter && ![',' , ';', '\t'].includes(csvOptions.delimiter)) {
        errors.push('Invalid CSV delimiter. Must be comma, semicolon, or tab');
      }

      // Validate date format
      if (csvOptions.dateFormat && !this.isValidDateFormat(csvOptions.dateFormat)) {
        errors.push('Invalid date format specification');
      }

      // Validate precision
      if (csvOptions.precision !== undefined && (csvOptions.precision < 0 || csvOptions.precision > 15)) {
        errors.push('Number precision must be between 0 and 15');
      }
    }

    return errors;
  }

  /**
   * Get default CSV options
   */
  public getDefaultOptions(): Partial<ExportFormatOptions> {
    return {
      csv: this.getDefaultCSVOptions()
    };
  }

  /**
   * Generate CSV content from formatter data
   */
  private generateCSVContent(
    data: FormatterData,
    options: NonNullable<ExportFormatOptions['csv']>,
    progressCallback?: (progress: number) => void
  ): string {
    const { streams, analysisResults, correlations, metadata } = data;
    const { delimiter, includeHeaders, quoteAll, dateFormat, precision } = options;
    
    let csvContent = '';
    let currentProgress = 0.1;

    // Create metadata section if requested
    if (metadata.config.includeMetadata) {
      csvContent += this.generateMetadataSection(metadata, delimiter, quoteAll);
      csvContent += '\n';
      currentProgress = 0.2;
      progressCallback?.(currentProgress);
    }

    // Generate stream data section
    if (streams.length > 0) {
      csvContent += this.generateStreamDataSection(
        streams, 
        delimiter, 
        includeHeaders, 
        quoteAll, 
        dateFormat, 
        precision,
        (progress) => {
          const sectionProgress = 0.2 + (progress * 0.5);
          progressCallback?.(sectionProgress);
        }
      );
      csvContent += '\n';
      currentProgress = 0.7;
    }

    // Generate analysis results section
    if (analysisResults.length > 0 && metadata.config.includeAnalysis) {
      csvContent += this.generateAnalysisSection(
        analysisResults, 
        delimiter, 
        includeHeaders, 
        quoteAll, 
        precision
      );
      csvContent += '\n';
      currentProgress = 0.85;
      progressCallback?.(currentProgress);
    }

    // Generate correlation matrix section
    if (correlations.length > 0 && metadata.config.includeCorrelations) {
      csvContent += this.generateCorrelationSection(
        correlations, 
        delimiter, 
        includeHeaders, 
        quoteAll, 
        precision
      );
      currentProgress = 0.95;
      progressCallback?.(currentProgress);
    }

    return csvContent.trim();
  }

  /**
   * Generate metadata section
   */
  private generateMetadataSection(
    metadata: FormatterData['metadata'],
    delimiter: string,
    quoteAll: boolean
  ): string {
    const lines: string[] = [];
    
    lines.push('# Export Metadata');
    lines.push(this.formatCSVRow(['Generated At', this.formatValue(metadata.generatedAt.toISOString(), quoteAll)], delimiter));
    lines.push(this.formatCSVRow(['Total Streams', this.formatValue(metadata.streamStats.totalStreams, quoteAll)], delimiter));
    lines.push(this.formatCSVRow(['Total Data Points', this.formatValue(metadata.streamStats.totalDataPoints, quoteAll)], delimiter));
    
    if (metadata.timeRange) {
      lines.push(this.formatCSVRow(['Time Range Start', this.formatValue(metadata.timeRange.start.toISOString(), quoteAll)], delimiter));
      lines.push(this.formatCSVRow(['Time Range End', this.formatValue(metadata.timeRange.end.toISOString(), quoteAll)], delimiter));
    }
    
    lines.push(this.formatCSVRow(['Sample Rate Range', this.formatValue(`${metadata.streamStats.sampleRateRange[0]}-${metadata.streamStats.sampleRateRange[1]} Hz`, quoteAll)], delimiter));
    lines.push(this.formatCSVRow(['Units', this.formatValue(metadata.streamStats.units.join(', '), quoteAll)], delimiter));
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate stream data section
   */
  private generateStreamDataSection(
    streams: FormatterData['streams'],
    delimiter: string,
    includeHeaders: boolean,
    quoteAll: boolean,
    dateFormat: string,
    precision?: number,
    progressCallback?: (progress: number) => void
  ): string {
    const lines: string[] = [];
    
    lines.push('# Stream Data');
    
    if (includeHeaders) {
      const headers = ['Timestamp', 'Stream ID', 'Stream Name', 'Value', 'Unit'];
      lines.push(this.formatCSVRow(headers.map(h => this.formatValue(h, quoteAll)), delimiter));
    }

    let totalDataPoints = streams.reduce((sum, stream) => sum + stream.data.length, 0);
    let processedDataPoints = 0;

    for (const stream of streams) {
      for (let i = 0; i < stream.data.length; i++) {
        const timestamp = stream.timestamps[i] || new Date();
        const value = stream.data[i];
        
        const row = [
          this.formatTimestamp(timestamp, dateFormat, quoteAll),
          this.formatValue(stream.id, quoteAll),
          this.formatValue(stream.name, quoteAll),
          this.formatNumber(value, precision, quoteAll),
          this.formatValue(stream.unit || '', quoteAll)
        ];
        
        lines.push(this.formatCSVRow(row, delimiter));
        
        processedDataPoints++;
        if (progressCallback && processedDataPoints % 100 === 0) {
          progressCallback(processedDataPoints / totalDataPoints);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate analysis results section
   */
  private generateAnalysisSection(
    analysisResults: FormatterData['analysisResults'],
    delimiter: string,
    includeHeaders: boolean,
    quoteAll: boolean,
    precision?: number
  ): string {
    const lines: string[] = [];
    
    lines.push('# Analysis Results');
    
    if (includeHeaders) {
      const headers = [
        'Stream ID', 'Stream Name', 'Mean', 'Median', 'Std Dev', 
        'Min', 'Max', 'Anomalies Count', 'Trend Direction'
      ];
      lines.push(this.formatCSVRow(headers.map(h => this.formatValue(h, quoteAll)), delimiter));
    }

    for (const analysis of analysisResults) {
      const stats = analysis.summary.statistics;
      const row = [
        this.formatValue(analysis.streamId, quoteAll),
        this.formatValue(analysis.streamName, quoteAll),
        this.formatNumber(stats.mean, precision, quoteAll),
        this.formatNumber(stats.median, precision, quoteAll),
        this.formatNumber(stats.standardDeviation, precision, quoteAll),
        this.formatNumber(stats.min, precision, quoteAll),
        this.formatNumber(stats.max, precision, quoteAll),
        this.formatValue(analysis.anomalies.length.toString(), quoteAll),
        this.formatValue(analysis.trends.direction, quoteAll)
      ];
      
      lines.push(this.formatCSVRow(row, delimiter));
    }

    return lines.join('\n');
  }

  /**
   * Generate correlation matrix section
   */
  private generateCorrelationSection(
    correlations: FormatterData['correlations'],
    delimiter: string,
    includeHeaders: boolean,
    quoteAll: boolean,
    precision?: number
  ): string {
    const lines: string[] = [];
    
    lines.push('# Correlation Matrix');
    
    if (includeHeaders) {
      const headers = [
        'Stream 1 ID', 'Stream 1 Name', 'Stream 2 ID', 'Stream 2 Name',
        'Pearson Coefficient', 'Spearman Coefficient', 'P-Value',
        'Significance', 'Sample Size'
      ];
      lines.push(this.formatCSVRow(headers.map(h => this.formatValue(h, quoteAll)), delimiter));
    }

    for (const correlation of correlations) {
      const row = [
        this.formatValue(correlation.streamId1, quoteAll),
        this.formatValue(correlation.streamName1, quoteAll),
        this.formatValue(correlation.streamId2, quoteAll),
        this.formatValue(correlation.streamName2, quoteAll),
        this.formatNumber(correlation.pearson.coefficient, precision, quoteAll),
        this.formatNumber(correlation.spearman.coefficient, precision, quoteAll),
        this.formatNumber(correlation.pearson.pValue, precision, quoteAll),
        this.formatValue(correlation.pearson.significance, quoteAll),
        this.formatValue(correlation.pearson.sampleSize.toString(), quoteAll)
      ];
      
      lines.push(this.formatCSVRow(row, delimiter));
    }

    return lines.join('\n');
  }

  /**
   * Format CSV row
   */
  private formatCSVRow(values: string[], delimiter: string): string {
    return values.join(delimiter);
  }

  /**
   * Format value with proper quoting
   */
  private formatValue(value: any, quoteAll: boolean): string {
    const strValue = String(value);
    
    if (quoteAll || this.needsQuoting(strValue)) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    
    return strValue;
  }

  /**
   * Format number with specified precision
   */
  private formatNumber(value: any, precision?: number, quoteAll?: boolean): string {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return this.formatValue('', quoteAll || false);
    }
    
    const numValue = Number(value);
    const formatted = precision !== undefined ? numValue.toFixed(precision) : numValue.toString();
    
    return this.formatValue(formatted, quoteAll || false);
  }

  /**
   * Format timestamp according to specified format
   */
  private formatTimestamp(date: Date, format: string, quoteAll: boolean): string {
    let formatted: string;
    
    switch (format.toLowerCase()) {
      case 'iso':
        formatted = date.toISOString();
        break;
      case 'unix':
        formatted = Math.floor(date.getTime() / 1000).toString();
        break;
      case 'excel':
        formatted = date.toISOString().replace('T', ' ').replace('Z', '');
        break;
      default:
        // Custom format or default to ISO
        formatted = date.toISOString();
        break;
    }
    
    return this.formatValue(formatted, quoteAll);
  }

  /**
   * Check if value needs quoting
   */
  private needsQuoting(value: string): boolean {
    return value.includes(',') || 
           value.includes(';') || 
           value.includes('\t') || 
           value.includes('"') || 
           value.includes('\n') || 
           value.includes('\r') || 
           value.trim() !== value;
  }

  /**
   * Get default CSV options
   */
  private getDefaultCSVOptions(): NonNullable<ExportFormatOptions['csv']> {
    return {
      delimiter: ',',
      includeHeaders: true,
      quoteAll: false,
      dateFormat: 'iso',
      precision: 6
    };
  }

  /**
   * Validate date format string
   */
  private isValidDateFormat(format: string): boolean {
    const validFormats = ['iso', 'unix', 'excel'];
    return validFormats.includes(format.toLowerCase());
  }
}

export default CSVFormatter;