/**
 * ChartExportService - Service for exporting individual charts in various formats
 * Supports PNG, SVG, PDF export with configurable options
 */

import { ExportFormat } from '../../types/export';

/**
 * Chart export options
 */
export interface ChartExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'data';
  quality?: number; // 0-1 for JPEG quality
  resolution?: number; // DPI for image export
  width?: number;
  height?: number;
  background?: string;
  includeAnnotations?: boolean;
  includeTitle?: boolean;
  includeLegend?: boolean;
  dataRange?: 'visible' | 'all';
  filename?: string;
  metadata?: {
    title?: string;
    description?: string;
    timestamp?: Date;
    author?: string;
    tags?: string[];
  };
}

/**
 * Chart data export format
 */
export interface ChartDataExport {
  metadata: {
    chartType: string;
    exportDate: Date;
    dataRange: {
      start: Date;
      end: Date;
    };
    series: string[];
  };
  data: Array<{
    timestamp: number;
    [key: string]: number | string | null;
  }>;
  annotations?: Array<{
    id: string;
    timestamp: number;
    text: string;
    type: string;
  }>;
}

/**
 * Service for exporting charts
 */
export class ChartExportService {
  private static instance: ChartExportService;

  private constructor() {}

  static getInstance(): ChartExportService {
    if (!ChartExportService.instance) {
      ChartExportService.instance = new ChartExportService();
    }
    return ChartExportService.instance;
  }

  /**
   * Export chart as image (PNG/SVG)
   */
  async exportAsImage(
    canvas: HTMLCanvasElement | SVGElement,
    options: ChartExportOptions
  ): Promise<Blob> {
    if (options.format === 'svg' && canvas instanceof SVGElement) {
      return this.exportSVG(canvas, options);
    }

    if (canvas instanceof HTMLCanvasElement) {
      return this.exportCanvas(canvas, options);
    }

    throw new Error('Invalid element type for image export');
  }

  /**
   * Export canvas as PNG
   */
  private async exportCanvas(
    canvas: HTMLCanvasElement,
    options: ChartExportOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // Create a new canvas with desired dimensions
      const exportCanvas = document.createElement('canvas');
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Set dimensions
      const scale = options.resolution ? options.resolution / 96 : 1;
      exportCanvas.width = (options.width || canvas.width) * scale;
      exportCanvas.height = (options.height || canvas.height) * scale;

      // Apply scaling for high DPI
      ctx.scale(scale, scale);

      // Draw background if specified
      if (options.background) {
        ctx.fillStyle = options.background;
        ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      }

      // Draw the original canvas
      ctx.drawImage(
        canvas,
        0,
        0,
        options.width || canvas.width,
        options.height || canvas.height
      );

      // Convert to blob
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        options.quality ? 'image/jpeg' : 'image/png',
        options.quality
      );
    });
  }

  /**
   * Export SVG
   */
  private async exportSVG(
    svg: SVGElement,
    options: ChartExportOptions
  ): Promise<Blob> {
    // Clone the SVG to avoid modifying the original
    const clonedSvg = svg.cloneNode(true) as SVGElement;

    // Set dimensions if specified
    if (options.width) {
      clonedSvg.setAttribute('width', options.width.toString());
    }
    if (options.height) {
      clonedSvg.setAttribute('height', options.height.toString());
    }

    // Add background if specified
    if (options.background) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', options.background);
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    }

    // Serialize to string
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);

    // Create blob
    return new Blob([svgString], { type: 'image/svg+xml' });
  }

  /**
   * Export chart as PDF
   */
  async exportAsPDF(
    element: HTMLCanvasElement | SVGElement,
    options: ChartExportOptions
  ): Promise<Blob> {
    // Dynamic import to avoid loading jsPDF unless needed
    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF({
      orientation: (options.width || 800) > (options.height || 600) ? 'landscape' : 'portrait',
      unit: 'px',
      format: [options.width || 800, options.height || 600]
    });

    // Add metadata
    if (options.metadata) {
      pdf.setProperties({
        title: options.metadata.title || 'Chart Export',
        subject: options.metadata.description || '',
        author: options.metadata.author || 'Rover Mission Control',
        keywords: options.metadata.tags?.join(', ') || '',
        creator: 'Rover Mission Control'
      });
    }

    // Add title if requested
    if (options.includeTitle && options.metadata?.title) {
      pdf.setFontSize(16);
      pdf.text(options.metadata.title, 40, 40);
    }

    // Convert element to image data
    if (element instanceof HTMLCanvasElement) {
      const imgData = element.toDataURL('image/png');
      const imgWidth = options.width || element.width;
      const imgHeight = options.height || element.height;
      const y = options.includeTitle ? 60 : 20;
      
      pdf.addImage(imgData, 'PNG', 20, y, imgWidth - 40, imgHeight - y - 20);
    } else if (element instanceof SVGElement) {
      // For SVG, we need to convert to canvas first
      const canvas = await this.svgToCanvas(element, options);
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = options.width || canvas.width;
      const imgHeight = options.height || canvas.height;
      const y = options.includeTitle ? 60 : 20;
      
      pdf.addImage(imgData, 'PNG', 20, y, imgWidth - 40, imgHeight - y - 20);
    }

    // Add timestamp
    const timestamp = new Date().toLocaleString();
    pdf.setFontSize(10);
    pdf.text(`Generated: ${timestamp}`, 40, pdf.internal.pageSize.height - 20);

    // Generate blob
    return pdf.output('blob');
  }

  /**
   * Convert SVG to Canvas
   */
  private async svgToCanvas(
    svg: SVGElement,
    options: ChartExportOptions
  ): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Set canvas dimensions
      canvas.width = options.width || parseInt(svg.getAttribute('width') || '800');
      canvas.height = options.height || parseInt(svg.getAttribute('height') || '600');

      // Create image from SVG
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG as image'));
      };

      img.src = url;
    });
  }

  /**
   * Export chart data
   */
  async exportData(
    data: ChartDataExport,
    format: 'json' | 'csv'
  ): Promise<Blob> {
    if (format === 'json') {
      const jsonString = JSON.stringify(data, null, 2);
      return new Blob([jsonString], { type: 'application/json' });
    }

    // CSV export
    const rows: string[][] = [];
    
    // Header row
    const headers = ['Timestamp', ...data.metadata.series];
    rows.push(headers);

    // Data rows
    data.data.forEach(point => {
      const row = [
        new Date(point.timestamp).toISOString(),
        ...data.metadata.series.map(series => 
          point[series]?.toString() || ''
        )
      ];
      rows.push(row);
    });

    // Convert to CSV string
    const csvContent = rows
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
  }

  /**
   * Download file
   */
  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate filename
   */
  generateFilename(
    baseName: string,
    format: string,
    timestamp: boolean = true
  ): string {
    const cleanName = baseName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const dateStr = timestamp ? `-${Date.now()}` : '';
    return `${cleanName}${dateStr}.${format}`;
  }
}

export const chartExportService = ChartExportService.getInstance();