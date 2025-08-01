/**
 * PDFFormatter - Export telemetry data to PDF format
 * Creates professional reports with charts, tables, and structured layouts using jsPDF
 */

import { 
  DataFormatter, 
  ExportConfig, 
  ExportFormat,
  ExportFormatOptions,
  FormatterData 
} from '../types/ExportTypes';

// Import jsPDF (would need to be installed: npm install jspdf)
declare const jsPDF: any;

/**
 * PDF page layout configuration
 */
interface PDFLayout {
  pageWidth: number;
  pageHeight: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  contentWidth: number;
  contentHeight: number;
}

/**
 * PDF section configuration
 */
interface PDFSection {
  title: string;
  type: 'summary' | 'table' | 'chart' | 'text';
  data: any;
  options?: any;
}

/**
 * PDF data formatter implementation
 */
export class PDFFormatter implements DataFormatter {
  public readonly format: ExportFormat = 'pdf';
  public readonly mimeTypes: string[] = ['application/pdf'];
  public readonly extension: string = 'pdf';

  private doc: any;
  private currentY: number = 0;
  private layout: PDFLayout;
  private pageNumber: number = 1;

  /**
   * Format data as PDF
   */
  public async format(
    data: FormatterData,
    config: ExportConfig,
    progressCallback?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const pdfOptions = config.formatOptions.pdf || this.getDefaultPDFOptions();
    progressCallback?.(0.1);

    // Initialize PDF document
    this.initializePDF(pdfOptions);
    
    progressCallback?.(0.2);

    // Generate PDF content
    await this.generatePDFContent(data, config, pdfOptions, progressCallback);

    progressCallback?.(0.95);

    // Generate final PDF buffer
    const pdfBuffer = this.doc.output('arraybuffer');
    
    progressCallback?.(1.0);

    return pdfBuffer;
  }

  /**
   * Validate PDF-specific configuration
   */
  public validateConfig(config: ExportConfig): string[] {
    const errors: string[] = [];
    const pdfOptions = config.formatOptions.pdf;

    if (pdfOptions) {
      // Validate orientation
      if (pdfOptions.orientation && !['portrait', 'landscape'].includes(pdfOptions.orientation)) {
        errors.push('Invalid PDF orientation. Must be portrait or landscape');
      }

      // Validate page size
      if (pdfOptions.pageSize && !['A4', 'Letter', 'Legal'].includes(pdfOptions.pageSize)) {
        errors.push('Invalid PDF page size. Must be A4, Letter, or Legal');
      }

      // Validate title length
      if (pdfOptions.title && pdfOptions.title.length > 100) {
        errors.push('PDF title must be 100 characters or less');
      }
    }

    return errors;
  }

  /**
   * Get default PDF options
   */
  public getDefaultOptions(): Partial<ExportFormatOptions> {
    return {
      pdf: this.getDefaultPDFOptions()
    };
  }

  /**
   * Initialize PDF document
   */
  private initializePDF(options: NonNullable<ExportFormatOptions['pdf']>): void {
    // Initialize jsPDF with specified options
    this.doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: options.pageSize?.toLowerCase() || 'a4'
    });

    // Calculate layout dimensions
    const pageSize = this.doc.internal.pageSize;
    this.layout = {
      pageWidth: pageSize.getWidth(),
      pageHeight: pageSize.getHeight(),
      margins: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      },
      contentWidth: 0,
      contentHeight: 0
    };

    // Calculate content area
    this.layout.contentWidth = this.layout.pageWidth - this.layout.margins.left - this.layout.margins.right;
    this.layout.contentHeight = this.layout.pageHeight - this.layout.margins.top - this.layout.margins.bottom;

    // Set initial position
    this.currentY = this.layout.margins.top;
  }

  /**
   * Generate PDF content
   */
  private async generatePDFContent(
    data: FormatterData,
    config: ExportConfig,
    options: NonNullable<ExportFormatOptions['pdf']>,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    let currentProgress = 0.2;

    // Add cover page if requested
    if (options.includeCoverPage) {
      this.addCoverPage(data, options);
      this.addNewPage();
      currentProgress = 0.3;
      progressCallback?.(currentProgress);
    }

    // Add table of contents
    this.addTableOfContents(data, config);
    this.addNewPage();
    currentProgress = 0.35;
    progressCallback?.(currentProgress);

    // Add executive summary
    this.addExecutiveSummary(data);
    currentProgress = 0.4;
    progressCallback?.(currentProgress);

    // Add stream data overview
    if (data.streams.length > 0) {
      this.addStreamDataSection(data.streams);
      currentProgress = 0.5;
      progressCallback?.(currentProgress);
    }

    // Add analysis results if requested
    if (config.includeAnalysis && data.analysisResults.length > 0) {
      this.addAnalysisSection(data.analysisResults);
      currentProgress = 0.65;
      progressCallback?.(currentProgress);
    }

    // Add correlation analysis if requested
    if (config.includeCorrelations && data.correlations.length > 0) {
      this.addCorrelationSection(data.correlations);
      currentProgress = 0.8;
      progressCallback?.(currentProgress);
    }

    // Add metadata appendix
    this.addMetadataSection(data.metadata);
    currentProgress = 0.9;
    progressCallback?.(currentProgress);

    // Add page numbers and headers/footers
    this.finalizeDocument(options);
  }

  /**
   * Add cover page
   */
  private addCoverPage(data: FormatterData, options: NonNullable<ExportFormatOptions['pdf']>): void {
    const centerX = this.layout.pageWidth / 2;
    
    // Title
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    const title = options.title || 'Telemetry Data Export Report';
    this.doc.text(title, centerX, 60, { align: 'center' });

    // Subtitle
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text('Comprehensive Analysis Report', centerX, 80, { align: 'center' });

    // Report metadata
    this.doc.setFontSize(12);
    const metadata = [
      `Generated: ${data.metadata.generatedAt.toLocaleString()}`,
      `Streams: ${data.metadata.streamStats.totalStreams}`,
      `Data Points: ${data.metadata.streamStats.totalDataPoints.toLocaleString()}`,
      `Time Range: ${data.metadata.timeRange ? 
        `${data.metadata.timeRange.start.toLocaleDateString()} - ${data.metadata.timeRange.end.toLocaleDateString()}` : 
        'All available data'}`
    ];

    let yPos = 120;
    for (const line of metadata) {
      this.doc.text(line, centerX, yPos, { align: 'center' });
      yPos += 10;
    }

    // Author
    if (options.author) {
      this.doc.setFontSize(10);
      this.doc.text(`Author: ${options.author}`, centerX, this.layout.pageHeight - 40, { align: 'center' });
    }
  }

  /**
   * Add table of contents
   */
  private addTableOfContents(data: FormatterData, config: ExportConfig): void {
    this.addSectionHeader('Table of Contents');

    const contents = [
      'Executive Summary',
      'Stream Data Overview',
    ];

    if (config.includeAnalysis) {
      contents.push('Statistical Analysis');
    }

    if (config.includeCorrelations) {
      contents.push('Correlation Analysis');
    }

    contents.push('Metadata and Configuration');

    let yPos = this.currentY + 10;
    this.doc.setFontSize(11);

    for (let i = 0; i < contents.length; i++) {
      this.doc.text(`${i + 1}. ${contents[i]}`, this.layout.margins.left, yPos);
      yPos += 8;
    }

    this.currentY = yPos + 10;
  }

  /**
   * Add executive summary
   */
  private addExecutiveSummary(data: FormatterData): void {
    this.addSectionHeader('Executive Summary');

    const summary = this.generateExecutiveSummary(data);
    
    this.doc.setFontSize(11);
    const lines = this.doc.splitTextToSize(summary, this.layout.contentWidth);
    
    for (const line of lines) {
      this.checkPageBreak(8);
      this.doc.text(line, this.layout.margins.left, this.currentY);
      this.currentY += 6;
    }

    this.currentY += 10;
  }

  /**
   * Add stream data section
   */
  private addStreamDataSection(streams: FormatterData['streams']): void {
    this.addSectionHeader('Stream Data Overview');

    // Create summary table
    const tableHeaders = ['Stream ID', 'Name', 'Data Points', 'Sample Rate', 'Unit'];
    const tableData = streams.map(stream => [
      stream.id,
      stream.name,
      stream.data.length.toString(),
      `${stream.sampleRate} Hz`,
      stream.unit || 'N/A'
    ]);

    this.addTable(tableHeaders, tableData, 'Stream Summary');

    // Add detailed statistics for each stream
    for (const stream of streams) {
      this.checkPageBreak(60);
      
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Stream: ${stream.name} (${stream.id})`, this.layout.margins.left, this.currentY);
      this.currentY += 10;

      // Calculate basic statistics
      const values = stream.data.filter(val => !isNaN(val));
      if (values.length > 0) {
        const stats = this.calculateStreamStatistics(values);
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        
        const statsText = [
          `Mean: ${stats.mean.toFixed(3)}`,
          `Min: ${stats.min.toFixed(3)}`,
          `Max: ${stats.max.toFixed(3)}`,
          `Std Dev: ${stats.stdDev.toFixed(3)}`
        ];

        let xPos = this.layout.margins.left;
        for (const stat of statsText) {
          this.doc.text(stat, xPos, this.currentY);
          xPos += 40;
        }
        this.currentY += 8;
      }

      this.currentY += 5;
    }
  }

  /**
   * Add analysis section
   */
  private addAnalysisSection(analysisResults: FormatterData['analysisResults']): void {
    this.addSectionHeader('Statistical Analysis');

    for (const analysis of analysisResults) {
      this.checkPageBreak(80);
      
      // Stream header
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Analysis: ${analysis.streamName}`, this.layout.margins.left, this.currentY);
      this.currentY += 12;

      // Statistics table
      const statsHeaders = ['Metric', 'Value'];
      const statsData = [
        ['Mean', analysis.summary.statistics.mean.toFixed(3)],
        ['Median', analysis.summary.statistics.median.toFixed(3)],
        ['Standard Deviation', analysis.summary.statistics.standardDeviation.toFixed(3)],
        ['Min', analysis.summary.statistics.min.toFixed(3)],
        ['Max', analysis.summary.statistics.max.toFixed(3)],
        ['Count', analysis.summary.statistics.count.toString()]
      ];

      this.addTable(statsHeaders, statsData, null, 80);

      // Anomalies summary
      if (analysis.anomalies.length > 0) {
        this.currentY += 5;
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`Anomalies Detected: ${analysis.anomalies.length}`, this.layout.margins.left, this.currentY);
        this.currentY += 8;

        // Show top 5 anomalies
        const topAnomalies = analysis.anomalies
          .slice(0, 5)
          .map(anomaly => [
            anomaly.timestamp.toLocaleString(),
            anomaly.value.toFixed(3),
            anomaly.type,
            anomaly.severity.toFixed(1)
          ]);

        if (topAnomalies.length > 0) {
          const anomalyHeaders = ['Timestamp', 'Value', 'Type', 'Severity'];
          this.addTable(anomalyHeaders, topAnomalies, 'Top Anomalies');
        }
      }

      this.currentY += 10;
    }
  }

  /**
   * Add correlation section
   */
  private addCorrelationSection(correlations: FormatterData['correlations']): void {
    this.addSectionHeader('Correlation Analysis');

    // Create correlation summary table
    const corrHeaders = ['Stream Pair', 'Pearson', 'Spearman', 'Significance', 'Sample Size'];
    const corrData = correlations.map(corr => [
      `${corr.streamName1} ↔ ${corr.streamName2}`,
      corr.pearson.coefficient.toFixed(3),
      corr.spearman.coefficient.toFixed(3),
      corr.pearson.significance,
      corr.pearson.sampleSize.toString()
    ]);

    this.addTable(corrHeaders, corrData, 'Correlation Matrix');

    // Add significant correlations details
    const significantCorrelations = correlations.filter(corr => 
      Math.abs(corr.pearson.coefficient) >= 0.5
    );

    if (significantCorrelations.length > 0) {
      this.currentY += 10;
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Significant Correlations (|r| ≥ 0.5)', this.layout.margins.left, this.currentY);
      this.currentY += 10;

      for (const corr of significantCorrelations) {
        this.checkPageBreak(25);
        
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        
        const description = `${corr.streamName1} and ${corr.streamName2}: ` +
                          `Pearson r = ${corr.pearson.coefficient.toFixed(3)} ` +
                          `(${corr.pearson.significance}), ` +
                          `Max cross-correlation: ${corr.crossCorrelation.maxCorrelation.toFixed(3)} ` +
                          `at lag ${corr.crossCorrelation.maxLag}`;

        const lines = this.doc.splitTextToSize(description, this.layout.contentWidth);
        for (const line of lines) {
          this.doc.text(line, this.layout.margins.left, this.currentY);
          this.currentY += 5;
        }
        this.currentY += 3;
      }
    }
  }

  /**
   * Add metadata section
   */
  private addMetadataSection(metadata: FormatterData['metadata']): void {
    this.addSectionHeader('Metadata and Configuration');

    const metadataInfo = [
      ['Export Generated', metadata.generatedAt.toLocaleString()],
      ['Total Streams', metadata.streamStats.totalStreams.toString()],
      ['Total Data Points', metadata.streamStats.totalDataPoints.toLocaleString()],
      ['Sample Rate Range', `${metadata.streamStats.sampleRateRange[0]}-${metadata.streamStats.sampleRateRange[1]} Hz`],
      ['Units Present', metadata.streamStats.units.join(', ') || 'None specified'],
      ['Export Format', metadata.config.format.toUpperCase()],
      ['Include Analysis', metadata.config.includeAnalysis ? 'Yes' : 'No'],
      ['Include Correlations', metadata.config.includeCorrelations ? 'Yes' : 'No']
    ];

    if (metadata.timeRange) {
      metadataInfo.push(
        ['Time Range Start', metadata.timeRange.start.toLocaleString()],
        ['Time Range End', metadata.timeRange.end.toLocaleString()]
      );
    }

    this.addTable(['Property', 'Value'], metadataInfo, 'Export Configuration');
  }

  /**
   * Add section header
   */
  private addSectionHeader(title: string): void {
    this.checkPageBreak(20);
    
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.layout.margins.left, this.currentY);
    
    // Add underline
    const textWidth = this.doc.getTextWidth(title);
    this.doc.line(
      this.layout.margins.left, 
      this.currentY + 2, 
      this.layout.margins.left + textWidth, 
      this.currentY + 2
    );
    
    this.currentY += 15;
  }

  /**
   * Add table to PDF
   */
  private addTable(
    headers: string[], 
    data: string[][], 
    title?: string | null, 
    maxWidth?: number
  ): void {
    if (title) {
      this.checkPageBreak(15);
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(title, this.layout.margins.left, this.currentY);
      this.currentY += 10;
    }

    const tableWidth = maxWidth || this.layout.contentWidth;
    const colWidth = tableWidth / headers.length;
    const rowHeight = 8;

    // Check if table fits on current page
    const tableHeight = (data.length + 1) * rowHeight;
    this.checkPageBreak(tableHeight + 10);

    // Draw headers
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'bold');
    
    let xPos = this.layout.margins.left;
    for (const header of headers) {
      this.doc.text(header, xPos + 2, this.currentY);
      this.doc.rect(xPos, this.currentY - 5, colWidth, rowHeight);
      xPos += colWidth;
    }
    this.currentY += rowHeight;

    // Draw data rows
    this.doc.setFont('helvetica', 'normal');
    
    for (const row of data) {
      xPos = this.layout.margins.left;
      for (const cell of row) {
        const cellText = cell.length > 20 ? cell.substring(0, 17) + '...' : cell;
        this.doc.text(cellText, xPos + 2, this.currentY);
        this.doc.rect(xPos, this.currentY - 5, colWidth, rowHeight);
        xPos += colWidth;
      }
      this.currentY += rowHeight;
    }

    this.currentY += 5;
  }

  /**
   * Check if page break is needed
   */
  private checkPageBreak(requiredSpace: number): void {
    if (this.currentY + requiredSpace > this.layout.pageHeight - this.layout.margins.bottom) {
      this.addNewPage();
    }
  }

  /**
   * Add new page
   */
  private addNewPage(): void {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = this.layout.margins.top;
  }

  /**
   * Finalize document with headers/footers
   */
  private finalizeDocument(options: NonNullable<ExportFormatOptions['pdf']>): void {
    const totalPages = this.pageNumber;

    // Add headers and footers to all pages
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      
      // Header
      if (options.header) {
        this.doc.setFontSize(8);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(options.header, this.layout.margins.left, 10);
      }

      // Footer
      this.doc.setFontSize(8);
      const footer = options.footer || 'Telemetry Data Export Report';
      const pageText = `Page ${i} of ${totalPages}`;
      
      this.doc.text(footer, this.layout.margins.left, this.layout.pageHeight - 10);
      this.doc.text(pageText, this.layout.pageWidth - this.layout.margins.right, this.layout.pageHeight - 10, { align: 'right' });
    }
  }

  /**
   * Generate executive summary text
   */
  private generateExecutiveSummary(data: FormatterData): string {
    const { streams, metadata } = data;
    
    let summary = `This report presents a comprehensive analysis of ${metadata.streamStats.totalStreams} telemetry streams `;
    summary += `containing ${metadata.streamStats.totalDataPoints.toLocaleString()} total data points. `;
    
    if (metadata.timeRange) {
      const duration = Math.round((metadata.timeRange.end.getTime() - metadata.timeRange.start.getTime()) / (1000 * 60 * 60 * 24));
      summary += `The data spans ${duration} days from ${metadata.timeRange.start.toLocaleDateString()} `;
      summary += `to ${metadata.timeRange.end.toLocaleDateString()}. `;
    }

    if (metadata.streamStats.units.length > 0) {
      summary += `Measurements include data in the following units: ${metadata.streamStats.units.join(', ')}. `;
    }

    summary += `Sample rates range from ${metadata.streamStats.sampleRateRange[0]} Hz `;
    summary += `to ${metadata.streamStats.sampleRateRange[1]} Hz across all streams.`;

    return summary;
  }

  /**
   * Calculate basic stream statistics
   */
  private calculateStreamStatistics(values: number[]): {
    mean: number;
    min: number;
    max: number;
    stdDev: number;
  } {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { mean, min, max, stdDev };
  }

  /**
   * Get default PDF options
   */
  private getDefaultPDFOptions(): NonNullable<ExportFormatOptions['pdf']> {
    return {
      orientation: 'portrait',
      pageSize: 'A4',
      includeCharts: false, // Charts would require additional implementation
      includeCoverPage: true,
      title: 'Telemetry Data Export Report',
      author: 'RoverMissionControl',
      header: 'Telemetry Analysis Report',
      footer: 'Generated by RoverMissionControl'
    };
  }
}

export default PDFFormatter;