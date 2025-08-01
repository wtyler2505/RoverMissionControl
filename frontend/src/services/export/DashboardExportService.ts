/**
 * DashboardExportService - Service for exporting complete dashboards
 * Supports configuration export, visual snapshots, and template generation
 */

import { DashboardConfig } from '../../types/dashboard';
import { DashboardTemplate } from '../../types/dashboardTemplates';
import { ChartExportService, ChartExportOptions } from './ChartExportService';

/**
 * Dashboard export options
 */
export interface DashboardExportOptions {
  format: 'config' | 'pdf' | 'image' | 'template';
  includeData?: boolean;
  includeAnnotations?: boolean;
  includeLayout?: boolean;
  includeStyles?: boolean;
  combineCharts?: boolean; // For image/PDF export
  quality?: number;
  resolution?: number;
  pageSize?: 'A4' | 'Letter' | 'Custom';
  orientation?: 'portrait' | 'landscape';
  filename?: string;
  metadata?: {
    title?: string;
    description?: string;
    author?: string;
    timestamp?: Date;
    version?: string;
  };
}

/**
 * Dashboard export result
 */
export interface DashboardExportResult {
  blob: Blob;
  filename: string;
  format: string;
  size: number;
  metadata: Record<string, any>;
}

/**
 * Service for exporting dashboards
 */
export class DashboardExportService {
  private static instance: DashboardExportService;
  private chartExportService: ChartExportService;

  private constructor() {
    this.chartExportService = ChartExportService.getInstance();
  }

  static getInstance(): DashboardExportService {
    if (!DashboardExportService.instance) {
      DashboardExportService.instance = new DashboardExportService();
    }
    return DashboardExportService.instance;
  }

  /**
   * Export dashboard configuration
   */
  async exportConfiguration(
    config: DashboardConfig,
    options: DashboardExportOptions
  ): Promise<DashboardExportResult> {
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      metadata: options.metadata || {},
      configuration: {
        layout: options.includeLayout !== false ? config.layout : undefined,
        panels: config.panels.map(panel => ({
          ...panel,
          data: options.includeData ? panel.data : undefined,
          annotations: options.includeAnnotations ? panel.annotations : undefined
        })),
        theme: options.includeStyles ? config.theme : undefined,
        settings: config.settings
      }
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const filename = options.filename || 
      this.generateFilename('dashboard-config', 'json');

    return {
      blob,
      filename,
      format: 'json',
      size: blob.size,
      metadata: exportData.metadata
    };
  }

  /**
   * Export dashboard as template
   */
  async exportAsTemplate(
    config: DashboardConfig,
    templateInfo: Partial<DashboardTemplate>,
    options: DashboardExportOptions
  ): Promise<DashboardExportResult> {
    const template: DashboardTemplate = {
      id: `template-${Date.now()}`,
      name: templateInfo.name || 'Custom Template',
      description: templateInfo.description || 'Exported dashboard template',
      category: templateInfo.category || 'custom',
      author: options.metadata?.author || 'Unknown',
      version: options.metadata?.version || '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      thumbnail: templateInfo.thumbnail || '',
      panels: config.panels.map(panel => ({
        id: panel.id,
        type: panel.type,
        title: panel.title,
        position: panel.position,
        size: panel.size,
        config: panel.config,
        dataStreams: panel.dataStreams || []
      })),
      features: {
        realTimeData: true,
        historicalAnalysis: true,
        alerting: config.panels.some(p => p.type === 'alerts'),
        export: true,
        collaboration: false,
        annotations: options.includeAnnotations || false,
        customization: true
      },
      requiredStreams: this.extractRequiredStreams(config),
      recommendedMissionPhases: templateInfo.recommendedMissionPhases,
      defaultTimeRange: config.settings?.defaultTimeRange || '1h',
      refreshInterval: config.settings?.refreshInterval || 5000,
      validationRules: templateInfo.validationRules || []
    };

    const jsonString = JSON.stringify(template, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const filename = options.filename || 
      this.generateFilename(template.name, 'template.json');

    return {
      blob,
      filename,
      format: 'json',
      size: blob.size,
      metadata: {
        templateId: template.id,
        name: template.name,
        category: template.category
      }
    };
  }

  /**
   * Export dashboard as PDF
   */
  async exportAsPDF(
    dashboardElement: HTMLElement,
    charts: Map<string, HTMLCanvasElement | SVGElement>,
    options: DashboardExportOptions
  ): Promise<DashboardExportResult> {
    // Dynamic import to avoid loading jsPDF unless needed
    const { jsPDF } = await import('jspdf');

    // Configure page size
    const pageConfig = this.getPageConfig(options);
    const pdf = new jsPDF({
      orientation: options.orientation || 'landscape',
      unit: 'mm',
      format: pageConfig.format
    });

    // Add metadata
    pdf.setProperties({
      title: options.metadata?.title || 'Dashboard Export',
      subject: options.metadata?.description || '',
      author: options.metadata?.author || 'Rover Mission Control',
      creator: 'Rover Mission Control'
    });

    // Add title page
    if (options.metadata?.title) {
      pdf.setFontSize(24);
      pdf.text(options.metadata.title, pageConfig.margin, 40);
      
      if (options.metadata.description) {
        pdf.setFontSize(12);
        pdf.text(options.metadata.description, pageConfig.margin, 60);
      }

      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageConfig.margin, 80);
      
      pdf.addPage();
    }

    // Export each chart
    let currentPage = options.metadata?.title ? 2 : 1;
    const chartArray = Array.from(charts.entries());
    
    for (let i = 0; i < chartArray.length; i++) {
      const [chartId, chartElement] = chartArray[i];
      
      // Convert chart to image
      const chartOptions: ChartExportOptions = {
        format: 'png',
        quality: options.quality || 0.95,
        resolution: options.resolution || 150,
        includeAnnotations: options.includeAnnotations
      };

      const imageBlob = await this.chartExportService.exportAsImage(
        chartElement,
        chartOptions
      );

      // Convert blob to data URL
      const imageDataUrl = await this.blobToDataURL(imageBlob);

      // Calculate image dimensions to fit page
      const imgDimensions = this.calculateImageDimensions(
        chartElement,
        pageConfig
      );

      // Add image to PDF
      pdf.addImage(
        imageDataUrl,
        'PNG',
        pageConfig.margin,
        pageConfig.margin,
        imgDimensions.width,
        imgDimensions.height
      );

      // Add chart title
      pdf.setFontSize(12);
      pdf.text(
        `Chart ${i + 1}: ${chartId}`,
        pageConfig.margin,
        pageConfig.margin + imgDimensions.height + 10
      );

      // Add new page if not last chart
      if (i < chartArray.length - 1) {
        pdf.addPage();
        currentPage++;
      }
    }

    // Add footer to each page
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageConfig.width - pageConfig.margin - 30,
        pageConfig.height - pageConfig.margin
      );
    }

    const blob = pdf.output('blob');
    const filename = options.filename || 
      this.generateFilename('dashboard', 'pdf');

    return {
      blob,
      filename,
      format: 'pdf',
      size: blob.size,
      metadata: {
        pageCount,
        charts: chartArray.length
      }
    };
  }

  /**
   * Export dashboard as composite image
   */
  async exportAsImage(
    dashboardElement: HTMLElement,
    charts: Map<string, HTMLCanvasElement | SVGElement>,
    options: DashboardExportOptions
  ): Promise<DashboardExportResult> {
    if (!options.combineCharts) {
      // Export dashboard screenshot using html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(dashboardElement, {
        scale: options.resolution ? options.resolution / 96 : 2,
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob'));
          },
          'image/png',
          options.quality || 0.95
        );
      });

      const filename = options.filename || 
        this.generateFilename('dashboard', 'png');

      return {
        blob,
        filename,
        format: 'png',
        size: blob.size,
        metadata: {
          width: canvas.width,
          height: canvas.height
        }
      };
    }

    // Create composite image of all charts
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Calculate grid layout
    const chartCount = charts.size;
    const cols = Math.ceil(Math.sqrt(chartCount));
    const rows = Math.ceil(chartCount / cols);
    const chartWidth = 800;
    const chartHeight = 600;
    const padding = 20;

    canvas.width = cols * (chartWidth + padding) + padding;
    canvas.height = rows * (chartHeight + padding) + padding;

    // Fill background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each chart
    let index = 0;
    for (const [chartId, chartElement] of charts) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * (chartWidth + padding);
      const y = padding + row * (chartHeight + padding);

      if (chartElement instanceof HTMLCanvasElement) {
        ctx.drawImage(chartElement, x, y, chartWidth, chartHeight);
      } else {
        // For SVG, convert to canvas first
        const svgCanvas = await this.chartExportService['svgToCanvas'](
          chartElement,
          { width: chartWidth, height: chartHeight }
        );
        ctx.drawImage(svgCanvas, x, y, chartWidth, chartHeight);
      }

      // Add chart label
      ctx.fillStyle = '#333333';
      ctx.font = '14px Arial';
      ctx.fillText(chartId, x, y - 5);

      index++;
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/png',
        options.quality || 0.95
      );
    });

    const filename = options.filename || 
      this.generateFilename('dashboard-composite', 'png');

    return {
      blob,
      filename,
      format: 'png',
      size: blob.size,
      metadata: {
        width: canvas.width,
        height: canvas.height,
        charts: chartCount,
        layout: `${cols}x${rows}`
      }
    };
  }

  /**
   * Extract required streams from dashboard config
   */
  private extractRequiredStreams(config: DashboardConfig): string[] {
    const streams = new Set<string>();
    
    config.panels.forEach(panel => {
      if (panel.dataStreams) {
        panel.dataStreams.forEach(stream => streams.add(stream));
      }
      
      // Extract from panel config if present
      if (panel.config?.streams) {
        if (Array.isArray(panel.config.streams)) {
          panel.config.streams.forEach((s: string) => streams.add(s));
        }
      }
    });

    return Array.from(streams);
  }

  /**
   * Get page configuration for PDF
   */
  private getPageConfig(options: DashboardExportOptions) {
    const configs = {
      A4: { format: 'a4', width: 210, height: 297, margin: 15 },
      Letter: { format: 'letter', width: 216, height: 279, margin: 15 },
      Custom: { format: [297, 210], width: 297, height: 210, margin: 20 }
    };

    const pageSize = options.pageSize || 'A4';
    const config = configs[pageSize];

    // Adjust for orientation
    if (options.orientation === 'landscape' && pageSize !== 'Custom') {
      [config.width, config.height] = [config.height, config.width];
    }

    return config;
  }

  /**
   * Calculate image dimensions to fit page
   */
  private calculateImageDimensions(
    element: HTMLCanvasElement | SVGElement,
    pageConfig: any
  ) {
    const maxWidth = pageConfig.width - 2 * pageConfig.margin;
    const maxHeight = pageConfig.height - 2 * pageConfig.margin - 30; // Leave space for title

    let width = element instanceof HTMLCanvasElement ? element.width : 
      parseInt(element.getAttribute('width') || '800');
    let height = element instanceof HTMLCanvasElement ? element.height :
      parseInt(element.getAttribute('height') || '600');

    // Convert pixels to mm (assuming 96 DPI)
    width = width * 0.264583;
    height = height * 0.264583;

    // Scale to fit
    if (width > maxWidth || height > maxHeight) {
      const scale = Math.min(maxWidth / width, maxHeight / height);
      width *= scale;
      height *= scale;
    }

    return { width, height };
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generate filename
   */
  private generateFilename(baseName: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${baseName}-${timestamp}.${extension}`;
  }
}

export const dashboardExportService = DashboardExportService.getInstance();