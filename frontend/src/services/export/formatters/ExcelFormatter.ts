/**
 * ExcelFormatter - Export telemetry data to Excel format
 * Creates comprehensive workbooks with multiple sheets, charts, and formatting using ExcelJS
 */

import { 
  DataFormatter, 
  ExportConfig, 
  ExportFormat,
  ExportFormatOptions,
  FormatterData 
} from '../types/ExportTypes';

// Import ExcelJS (would need to be installed: npm install exceljs)
declare const ExcelJS: any;

/**
 * Excel workbook structure
 */
interface ExcelWorkbookStructure {
  metadata: any;
  streams: any;
  analysis: any;
  correlations: any;
  summary: any;
}

/**
 * Excel data formatter implementation
 */
export class ExcelFormatter implements DataFormatter {
  public readonly format: ExportFormat = 'xlsx';
  public readonly mimeTypes: string[] = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  public readonly extension: string = 'xlsx';

  private workbook: any;

  /**
   * Format data as Excel
   */
  public async format(
    data: FormatterData,
    config: ExportConfig,
    progressCallback?: (progress: number) => void
  ): Promise<ArrayBuffer> {
    const excelOptions = config.formatOptions.xlsx || this.getDefaultExcelOptions();
    progressCallback?.(0.1);

    // Initialize workbook
    this.workbook = new ExcelJS.Workbook();
    this.setupWorkbookProperties(data, config);
    
    progressCallback?.(0.2);

    // Create worksheets based on configuration
    await this.createWorksheets(data, config, excelOptions, progressCallback);

    progressCallback?.(0.9);

    // Generate buffer
    const buffer = await this.workbook.xlsx.writeBuffer();
    
    progressCallback?.(1.0);

    return buffer;
  }

  /**
   * Validate Excel-specific configuration
   */
  public validateConfig(config: ExportConfig): string[] {
    const errors: string[] = [];
    const excelOptions = config.formatOptions.xlsx;

    if (excelOptions) {
      // Validate password
      if (excelOptions.password && excelOptions.password.length < 4) {
        errors.push('Excel password must be at least 4 characters long');
      }
    }

    return errors;
  }

  /**
   * Get default Excel options
   */
  public getDefaultOptions(): Partial<ExportFormatOptions> {
    return {
      xlsx: this.getDefaultExcelOptions()
    };
  }

  /**
   * Setup workbook properties
   */
  private setupWorkbookProperties(data: FormatterData, config: ExportConfig): void {
    this.workbook.creator = 'RoverMissionControl';
    this.workbook.lastModifiedBy = 'Export Service';
    this.workbook.created = data.metadata.generatedAt;
    this.workbook.modified = data.metadata.generatedAt;
    this.workbook.lastPrinted = data.metadata.generatedAt;

    // Set document properties
    this.workbook.title = config.filename;
    this.workbook.subject = 'Telemetry Data Export';
    this.workbook.keywords = 'telemetry,data,analysis,export';
    this.workbook.category = 'Data Analysis';
    this.workbook.description = `Export of ${data.streams.length} telemetry streams with ${data.metadata.streamStats.totalDataPoints} data points`;
  }

  /**
   * Create all worksheets
   */
  private async createWorksheets(
    data: FormatterData,
    config: ExportConfig,
    options: NonNullable<ExportFormatOptions['xlsx']>,
    progressCallback?: (progress: number) => void
  ): Promise<void> {
    let currentProgress = 0.2;
    const progressIncrement = 0.7 / (options.separateSheets ? 5 : 1);

    // Create summary worksheet
    this.createSummaryWorksheet(data, config);
    currentProgress += progressIncrement;
    progressCallback?.(currentProgress);

    // Create stream data worksheet(s)
    if (options.separateSheets) {
      // Separate sheets for different data types
      this.createStreamDataWorksheet(data.streams);
      currentProgress += progressIncrement;
      progressCallback?.(currentProgress);

      if (config.includeAnalysis && data.analysisResults.length > 0) {
        this.createAnalysisWorksheet(data.analysisResults);
        currentProgress += progressIncrement;
        progressCallback?.(currentProgress);
      }

      if (config.includeCorrelations && data.correlations.length > 0) {
        this.createCorrelationWorksheet(data.correlations);
        currentProgress += progressIncrement;
        progressCallback?.(currentProgress);
      }

      this.createMetadataWorksheet(data.metadata);
    } else {
      // All data in one sheet
      this.createCombinedDataWorksheet(data, config);
      currentProgress += progressIncrement * 3;
      progressCallback?.(currentProgress);
    }

    // Apply formatting if requested
    if (options.applyFormatting) {
      this.applyWorkbookFormatting();
    }

    // Add password protection if specified
    if (options.password) {
      this.workbook.protect(options.password);
    }
  }

  /**
   * Create summary worksheet
   */
  private createSummaryWorksheet(data: FormatterData, config: ExportConfig): void {
    const worksheet = this.workbook.addWorksheet('Summary');
    
    // Set column widths
    worksheet.columns = [
      { header: 'Property', key: 'property', width: 25 },
      { header: 'Value', key: 'value', width: 35 },
      { header: 'Details', key: 'details', width: 40 }
    ];

    // Add header with styling
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3FF' }
    };

    // Add summary data
    const summaryData = [
      {
        property: 'Export Generated',
        value: data.metadata.generatedAt.toLocaleString(),
        details: 'Timestamp of export generation'
      },
      {
        property: 'Total Streams',
        value: data.metadata.streamStats.totalStreams,
        details: 'Number of telemetry streams included'
      },
      {
        property: 'Total Data Points',
        value: data.metadata.streamStats.totalDataPoints,
        details: 'Sum of all data points across streams'
      },
      {
        property: 'Sample Rate Range',
        value: `${data.metadata.streamStats.sampleRateRange[0]} - ${data.metadata.streamStats.sampleRateRange[1]} Hz`,
        details: 'Minimum and maximum sample rates'
      },
      {
        property: 'Units Present',
        value: data.metadata.streamStats.units.join(', ') || 'None specified',
        details: 'All measurement units found in streams'
      },
      {
        property: 'Analysis Included',
        value: config.includeAnalysis ? 'Yes' : 'No',
        details: 'Whether statistical analysis is included'
      },
      {
        property: 'Correlations Included',
        value: config.includeCorrelations ? 'Yes' : 'No',
        details: 'Whether correlation analysis is included'
      }
    ];

    // Add time range if present
    if (data.metadata.timeRange) {
      summaryData.push(
        {
          property: 'Time Range Start',
          value: data.metadata.timeRange.start.toLocaleString(),
          details: 'Start of data time range'
        },
        {
          property: 'Time Range End',
          value: data.metadata.timeRange.end.toLocaleString(),
          details: 'End of data time range'
        }
      );
    }

    // Add data to worksheet
    worksheet.addRows(summaryData);

    // Add borders and formatting
    this.applyWorksheetBorders(worksheet, summaryData.length + 1);
  }

  /**
   * Create stream data worksheet
   */
  private createStreamDataWorksheet(streams: FormatterData['streams']): void {
    const worksheet = this.workbook.addWorksheet('Stream Data');

    // Set column headers
    const headers = ['Timestamp', 'Stream ID', 'Stream Name', 'Value', 'Unit', 'Sample Rate'];
    worksheet.columns = headers.map((header, index) => ({
      header,
      key: header.toLowerCase().replace(' ', '_'),
      width: index === 0 ? 20 : index === 2 ? 25 : 15
    }));

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCCFFCC' }
    };

    // Add data rows
    let rowIndex = 2;
    for (const stream of streams) {
      for (let i = 0; i < stream.data.length; i++) {
        const row = worksheet.getRow(rowIndex);
        row.values = [
          stream.timestamps[i] || new Date(),
          stream.id,
          stream.name,
          stream.data[i],
          stream.unit || '',
          stream.sampleRate
        ];

        // Format timestamp column
        row.getCell(1).numFmt = 'yyyy-mm-dd hh:mm:ss';
        
        // Format value column with appropriate precision
        if (typeof stream.data[i] === 'number') {
          row.getCell(4).numFmt = '0.000';
        }

        rowIndex++;
      }
    }

    // Apply borders
    this.applyWorksheetBorders(worksheet, rowIndex - 1);

    // Add auto filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `F${rowIndex - 1}`
    };

    // Freeze panes
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  /**
   * Create analysis worksheet
   */
  private createAnalysisWorksheet(analysisResults: FormatterData['analysisResults']): void {
    const worksheet = this.workbook.addWorksheet('Analysis');

    // Set column headers
    worksheet.columns = [
      { header: 'Stream ID', key: 'streamId', width: 15 },
      { header: 'Stream Name', key: 'streamName', width: 25 },
      { header: 'Mean', key: 'mean', width: 12 },
      { header: 'Median', key: 'median', width: 12 },
      { header: 'Std Dev', key: 'stdDev', width: 12 },
      { header: 'Min', key: 'min', width: 12 },
      { header: 'Max', key: 'max', width: 12 },
      { header: 'Count', key: 'count', width: 10 },
      { header: 'Anomalies', key: 'anomalies', width: 12 },
      { header: 'Trend Direction', key: 'trendDirection', width: 15 }
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCC99' }
    };

    // Add analysis data
    const analysisData = analysisResults.map(analysis => ({
      streamId: analysis.streamId,
      streamName: analysis.streamName,
      mean: analysis.summary.statistics.mean,
      median: analysis.summary.statistics.median,
      stdDev: analysis.summary.statistics.standardDeviation,
      min: analysis.summary.statistics.min,
      max: analysis.summary.statistics.max,
      count: analysis.summary.statistics.count,
      anomalies: analysis.anomalies.length,
      trendDirection: analysis.trends.direction
    }));

    worksheet.addRows(analysisData);

    // Format numeric columns
    for (let col = 3; col <= 8; col++) {
      const column = worksheet.getColumn(col);
      column.numFmt = '0.000';
    }

    // Apply borders
    this.applyWorksheetBorders(worksheet, analysisData.length + 1);

    // Add conditional formatting for anomalies
    worksheet.addConditionalFormatting({
      ref: `I2:I${analysisData.length + 1}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: [0],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFFCCCC' }
            }
          }
        }
      ]
    });

    // Add auto filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `J${analysisData.length + 1}`
    };
  }

  /**
   * Create correlation worksheet
   */
  private createCorrelationWorksheet(correlations: FormatterData['correlations']): void {
    const worksheet = this.workbook.addWorksheet('Correlations');

    // Set column headers
    worksheet.columns = [
      { header: 'Stream 1 ID', key: 'stream1Id', width: 15 },
      { header: 'Stream 1 Name', key: 'stream1Name', width: 25 },
      { header: 'Stream 2 ID', key: 'stream2Id', width: 15 },
      { header: 'Stream 2 Name', key: 'stream2Name', width: 25 },
      { header: 'Pearson Coefficient', key: 'pearson', width: 18 },
      { header: 'Spearman Coefficient', key: 'spearman', width: 18 },
      { header: 'P-Value', key: 'pValue', width: 12 },
      { header: 'Significance', key: 'significance', width: 15 },
      { header: 'Sample Size', key: 'sampleSize', width: 12 },
      { header: 'Max Cross-Corr', key: 'maxCrossCorr', width: 15 },
      { header: 'Max Lag', key: 'maxLag', width: 10 }
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCCCCFF' }
    };

    // Add correlation data
    const correlationData = correlations.map(corr => ({
      stream1Id: corr.streamId1,
      stream1Name: corr.streamName1,
      stream2Id: corr.streamId2,
      stream2Name: corr.streamName2,
      pearson: corr.pearson.coefficient,
      spearman: corr.spearman.coefficient,
      pValue: corr.pearson.pValue || null,
      significance: corr.pearson.significance,
      sampleSize: corr.pearson.sampleSize,
      maxCrossCorr: corr.crossCorrelation.maxCorrelation,
      maxLag: corr.crossCorrelation.maxLag
    }));

    worksheet.addRows(correlationData);

    // Format numeric columns
    for (const colIndex of [5, 6, 7, 10]) {
      const column = worksheet.getColumn(colIndex);
      column.numFmt = '0.000';
    }

    // Apply borders
    this.applyWorksheetBorders(worksheet, correlationData.length + 1);

    // Add conditional formatting for strong correlations
    worksheet.addConditionalFormatting({
      ref: `E2:F${correlationData.length + 1}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThanOrEqual',
          formulae: [0.7],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FF90EE90' }
            },
            font: { bold: true }
          }
        },
        {
          type: 'cellIs',
          operator: 'lessThanOrEqual',
          formulae: [-0.7],
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFF6B6B' }
            },
            font: { bold: true }
          }
        }
      ]
    });

    // Add auto filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `K${correlationData.length + 1}`
    };
  }

  /**
   * Create metadata worksheet
   */
  private createMetadataWorksheet(metadata: FormatterData['metadata']): void {
    const worksheet = this.workbook.addWorksheet('Metadata');

    // Set column widths
    worksheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Property', key: 'property', width: 25 },
      { header: 'Value', key: 'value', width: 35 }
    ];

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCCFF' }
    };

    // Build metadata rows
    const metadataRows = [
      { category: 'Export', property: 'Generated At', value: metadata.generatedAt.toISOString() },
      { category: 'Export', property: 'Configuration Format', value: metadata.config.format },
      { category: 'Export', property: 'Include Analysis', value: metadata.config.includeAnalysis ? 'Yes' : 'No' },
      { category: 'Export', property: 'Include Correlations', value: metadata.config.includeCorrelations ? 'Yes' : 'No' },
      { category: 'Data', property: 'Total Streams', value: metadata.streamStats.totalStreams },
      { category: 'Data', property: 'Total Data Points', value: metadata.streamStats.totalDataPoints },
      { category: 'Data', property: 'Sample Rate Min', value: metadata.streamStats.sampleRateRange[0] + ' Hz' },
      { category: 'Data', property: 'Sample Rate Max', value: metadata.streamStats.sampleRateRange[1] + ' Hz' },
      { category: 'Data', property: 'Units', value: metadata.streamStats.units.join(', ') || 'None' }
    ];

    // Add time range if present
    if (metadata.timeRange) {
      metadataRows.push(
        { category: 'Time Range', property: 'Start', value: metadata.timeRange.start.toISOString() },
        { category: 'Time Range', property: 'End', value: metadata.timeRange.end.toISOString() }
      );

      if (metadata.timeRange.timezone) {
        metadataRows.push({ category: 'Time Range', property: 'Timezone', value: metadata.timeRange.timezone });
      }
    }

    worksheet.addRows(metadataRows);

    // Apply borders
    this.applyWorksheetBorders(worksheet, metadataRows.length + 1);

    // Group rows by category
    let currentCategory = '';
    let groupStart = 2;
    
    for (let i = 0; i < metadataRows.length; i++) {
      const row = metadataRows[i];
      if (row.category !== currentCategory) {
        if (currentCategory !== '') {
          worksheet.getRows(groupStart, i + 1 - groupStart)?.forEach(r => {
            if (r) r.outlineLevel = 1;
          });
        }
        currentCategory = row.category;
        groupStart = i + 2;
      }
    }
    
    // Group remaining rows
    if (currentCategory !== '') {
      worksheet.getRows(groupStart, metadataRows.length + 2 - groupStart)?.forEach(r => {
        if (r) r.outlineLevel = 1;
      });
    }
  }

  /**
   * Create combined data worksheet (when separateSheets is false)
   */
  private createCombinedDataWorksheet(data: FormatterData, config: ExportConfig): void {
    const worksheet = this.workbook.addWorksheet('All Data');

    let currentRow = 1;

    // Add summary section
    worksheet.getCell(currentRow, 1).value = 'EXPORT SUMMARY';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
    currentRow += 2;

    const summaryData = [
      ['Generated', data.metadata.generatedAt.toLocaleString()],
      ['Total Streams', data.metadata.streamStats.totalStreams],
      ['Total Data Points', data.metadata.streamStats.totalDataPoints],
      ['Include Analysis', config.includeAnalysis ? 'Yes' : 'No'],
      ['Include Correlations', config.includeCorrelations ? 'Yes' : 'No']
    ];

    for (const [key, value] of summaryData) {
      worksheet.getCell(currentRow, 1).value = key;
      worksheet.getCell(currentRow, 2).value = value;
      currentRow++;
    }

    currentRow += 2;

    // Add stream data section
    worksheet.getCell(currentRow, 1).value = 'STREAM DATA';
    worksheet.getCell(currentRow, 1).font = { bold: true, size: 14 };
    currentRow += 2;

    const streamHeaders = ['Timestamp', 'Stream ID', 'Stream Name', 'Value', 'Unit'];
    for (let i = 0; i < streamHeaders.length; i++) {
      const cell = worksheet.getCell(currentRow, i + 1);
      cell.value = streamHeaders[i];
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFCCFFCC' }
      };
    }
    currentRow++;

    // Add stream data
    for (const stream of data.streams) {
      for (let i = 0; i < Math.min(stream.data.length, 1000); i++) { // Limit to first 1000 points
        worksheet.getCell(currentRow, 1).value = stream.timestamps[i] || new Date();
        worksheet.getCell(currentRow, 2).value = stream.id;
        worksheet.getCell(currentRow, 3).value = stream.name;
        worksheet.getCell(currentRow, 4).value = stream.data[i];
        worksheet.getCell(currentRow, 5).value = stream.unit || '';
        
        // Format timestamp
        worksheet.getCell(currentRow, 1).numFmt = 'yyyy-mm-dd hh:mm:ss';
        
        currentRow++;
      }
    }

    // Set column widths
    worksheet.getColumn(1).width = 20; // Timestamp
    worksheet.getColumn(2).width = 15; // Stream ID
    worksheet.getColumn(3).width = 25; // Stream Name
    worksheet.getColumn(4).width = 12; // Value
    worksheet.getColumn(5).width = 10; // Unit
  }

  /**
   * Apply worksheet borders
   */
  private applyWorksheetBorders(worksheet: any, rowCount: number): void {
    const range = worksheet.getCell(1, 1).address + ':' + worksheet.getCell(rowCount, worksheet.columns.length).address;
    
    worksheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber <= rowCount) {
        row.eachCell((cell: any) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });
  }

  /**
   * Apply workbook-wide formatting
   */
  private applyWorkbookFormatting(): void {
    this.workbook.eachSheet((worksheet: any) => {
      // Set default font
      worksheet.eachRow((row: any) => {
        row.eachCell((cell: any) => {
          if (!cell.font) {
            cell.font = { name: 'Calibri', size: 10 };
          }
        });
      });

      // Auto-fit columns (approximate)
      worksheet.columns.forEach((column: any) => {
        if (!column.width) {
          column.width = 15; // Default width
        }
      });
    });
  }

  /**
   * Get default Excel options
   */
  private getDefaultExcelOptions(): NonNullable<ExportFormatOptions['xlsx']> {
    return {
      includeCharts: false, // Charts would require additional implementation
      includePivotTables: false, // Pivot tables would require additional implementation
      separateSheets: true,
      applyFormatting: true
    };
  }
}

export default ExcelFormatter;