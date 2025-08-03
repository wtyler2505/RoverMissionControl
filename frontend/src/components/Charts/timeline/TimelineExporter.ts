import * as d3 from 'd3';
import { saveAs } from 'file-saver';
import { GanttTask, MissionEvent, TimelineAnnotation, TimelineExportConfig } from './types';

/**
 * TimelineExporter - Export timeline data in various formats
 */
export class TimelineExporter {
  /**
   * Export timeline to PNG image
   */
  static async exportToPNG(
    svgElement: SVGSVGElement,
    config: {
      filename?: string;
      resolution?: number;
      backgroundColor?: string;
    } = {}
  ): Promise<void> {
    const {
      filename = `timeline-${new Date().toISOString().split('T')[0]}.png`,
      resolution = 2, // 2x resolution for retina displays
      backgroundColor = '#ffffff'
    } = config;

    try {
      // Clone SVG to avoid modifying original
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Get dimensions
      const bbox = svgElement.getBBox();
      const width = bbox.width || parseInt(svgElement.getAttribute('width') || '1200');
      const height = bbox.height || parseInt(svgElement.getAttribute('height') || '600');
      
      // Create canvas
      const canvas = document.createElement('canvas');
      canvas.width = width * resolution;
      canvas.height = height * resolution;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      
      // Set background
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Scale for resolution
      ctx.scale(resolution, resolution);
      
      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      // Draw to canvas
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        
        // Convert to blob and save
        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, filename);
          }
        }, 'image/png');
      };
      
      img.src = url;
    } catch (error) {
      console.error('Error exporting to PNG:', error);
      throw error;
    }
  }

  /**
   * Export timeline to SVG
   */
  static exportToSVG(
    svgElement: SVGSVGElement,
    config: {
      filename?: string;
      includeStyles?: boolean;
    } = {}
  ): void {
    const {
      filename = `timeline-${new Date().toISOString().split('T')[0]}.svg`,
      includeStyles = true
    } = config;

    try {
      // Clone SVG
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Add styles if requested
      if (includeStyles) {
        const styleElement = document.createElement('style');
        styleElement.textContent = this.extractStyles();
        clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);
      }
      
      // Add XML declaration
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgWithDeclaration = `<?xml version="1.0" encoding="UTF-8"?>\n${svgData}`;
      
      // Create blob and save
      const blob = new Blob([svgWithDeclaration], { type: 'image/svg+xml;charset=utf-8' });
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error exporting to SVG:', error);
      throw error;
    }
  }

  /**
   * Export timeline data to JSON
   */
  static exportToJSON(
    data: {
      tasks: GanttTask[];
      events?: MissionEvent[];
      annotations?: TimelineAnnotation[];
      metadata?: Record<string, any>;
    },
    config: {
      filename?: string;
      pretty?: boolean;
    } = {}
  ): void {
    const {
      filename = `timeline-data-${new Date().toISOString().split('T')[0]}.json`,
      pretty = true
    } = config;

    try {
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        metadata: data.metadata || {},
        tasks: data.tasks.map(task => ({
          ...task,
          startDate: task.startDate.toISOString(),
          endDate: task.endDate.toISOString()
        })),
        events: data.events?.map(event => ({
          ...event,
          timestamp: event.timestamp.toISOString()
        })) || [],
        annotations: data.annotations?.map(annotation => ({
          ...annotation,
          startTime: annotation.startTime.toISOString(),
          endTime: annotation.endTime?.toISOString(),
          createdAt: annotation.createdAt.toISOString()
        })) || [],
        statistics: this.calculateStatistics(data.tasks)
      };
      
      const jsonString = pretty 
        ? JSON.stringify(exportData, null, 2)
        : JSON.stringify(exportData);
      
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      throw error;
    }
  }

  /**
   * Export timeline to CSV
   */
  static exportToCSV(
    tasks: GanttTask[],
    config: {
      filename?: string;
      delimiter?: string;
      includeHeaders?: boolean;
      dateFormat?: (date: Date) => string;
    } = {}
  ): void {
    const {
      filename = `timeline-tasks-${new Date().toISOString().split('T')[0]}.csv`,
      delimiter = ',',
      includeHeaders = true,
      dateFormat = (date) => date.toISOString().split('T')[0]
    } = config;

    try {
      const headers = [
        'ID',
        'Name',
        'Start Date',
        'End Date',
        'Duration (days)',
        'Progress (%)',
        'Status',
        'Priority',
        'Category',
        'Dependencies',
        'Resource'
      ];
      
      const rows = tasks.map(task => {
        const duration = Math.ceil(
          (task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        return [
          task.id,
          `"${task.name.replace(/"/g, '""')}"`, // Escape quotes
          dateFormat(task.startDate),
          dateFormat(task.endDate),
          duration.toString(),
          (task.progress || 0).toString(),
          task.status || '',
          task.priority || '',
          task.category || '',
          (task.dependencies || []).join(';'),
          task.resourceId || ''
        ];
      });
      
      let csvContent = '';
      
      if (includeHeaders) {
        csvContent += headers.join(delimiter) + '\n';
      }
      
      csvContent += rows.map(row => row.join(delimiter)).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  }

  /**
   * Export timeline to PDF (using HTML template)
   */
  static async exportToPDF(
    data: {
      tasks: GanttTask[];
      events?: MissionEvent[];
      annotations?: TimelineAnnotation[];
      svgElement?: SVGSVGElement;
      title?: string;
      description?: string;
    },
    config: {
      filename?: string;
      paperSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
      orientation?: 'portrait' | 'landscape';
      includeChart?: boolean;
      includeTable?: boolean;
      includeStatistics?: boolean;
    } = {}
  ): Promise<void> {
    const {
      filename = `timeline-report-${new Date().toISOString().split('T')[0]}.pdf`,
      paperSize = 'A4',
      orientation = 'landscape',
      includeChart = true,
      includeTable = true,
      includeStatistics = true
    } = config;

    try {
      // Create HTML content
      const html = this.generatePDFHTML(data, {
        paperSize,
        orientation,
        includeChart,
        includeTable,
        includeStatistics
      });
      
      // Open print dialog (browser will handle PDF generation)
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Failed to open print window');
      }
      
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Trigger print after content loads
      printWindow.onload = () => {
        printWindow.print();
      };
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  }

  /**
   * Export to Microsoft Project XML format
   */
  static exportToMSProject(
    tasks: GanttTask[],
    config: {
      filename?: string;
      projectName?: string;
      projectStart?: Date;
    } = {}
  ): void {
    const {
      filename = `timeline-project-${new Date().toISOString().split('T')[0]}.xml`,
      projectName = 'Timeline Project',
      projectStart = new Date()
    } = config;

    try {
      const xml = this.generateMSProjectXML(tasks, projectName, projectStart);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      saveAs(blob, filename);
    } catch (error) {
      console.error('Error exporting to MS Project:', error);
      throw error;
    }
  }

  /**
   * Generate shareable link
   */
  static generateShareableLink(
    data: {
      tasks: GanttTask[];
      events?: MissionEvent[];
      config?: Record<string, any>;
    }
  ): string {
    try {
      // Compress data
      const compressedData = this.compressData(data);
      
      // Encode for URL
      const encoded = btoa(compressedData);
      
      // Generate link (would need actual implementation)
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/timeline/shared?data=${encoded}`;
      
      return shareUrl;
    } catch (error) {
      console.error('Error generating shareable link:', error);
      throw error;
    }
  }

  /**
   * Helper: Extract styles from document
   */
  private static extractStyles(): string {
    const styles: string[] = [];
    
    // Extract all stylesheets
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        if (sheet.cssRules) {
          Array.from(sheet.cssRules).forEach(rule => {
            styles.push(rule.cssText);
          });
        }
      } catch (e) {
        // Cross-origin stylesheets will throw
        console.warn('Could not access stylesheet:', e);
      }
    });
    
    return styles.join('\n');
  }

  /**
   * Helper: Calculate statistics
   */
  private static calculateStatistics(tasks: GanttTask[]) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
    const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
    
    const durations = tasks.map(t => 
      (t.endDate.getTime() - t.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    const avgProgress = tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / totalTasks;
    
    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      blockedTasks,
      completionRate: (completedTasks / totalTasks * 100).toFixed(1) + '%',
      avgDuration: avgDuration.toFixed(1) + ' days',
      minDuration: minDuration.toFixed(1) + ' days',
      maxDuration: maxDuration.toFixed(1) + ' days',
      avgProgress: avgProgress.toFixed(1) + '%'
    };
  }

  /**
   * Helper: Generate PDF HTML
   */
  private static generatePDFHTML(
    data: any,
    config: any
  ): string {
    const stats = this.calculateStatistics(data.tasks);
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title || 'Timeline Report'}</title>
  <style>
    @page {
      size: ${config.paperSize} ${config.orientation};
      margin: 20mm;
    }
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #f4f4f4;
      font-weight: bold;
    }
    .statistics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .stat-box {
      padding: 10px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    .stat-value {
      font-size: 18px;
      font-weight: bold;
      color: #2c3e50;
    }
    @media print {
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <h1>${data.title || 'Timeline Report'}</h1>
  ${data.description ? `<p>${data.description}</p>` : ''}
  
  ${config.includeStatistics ? `
  <h2>Statistics</h2>
  <div class="statistics">
    <div class="stat-box">
      <div class="stat-label">Total Tasks</div>
      <div class="stat-value">${stats.totalTasks}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Completed</div>
      <div class="stat-value">${stats.completedTasks}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Completion Rate</div>
      <div class="stat-value">${stats.completionRate}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Average Duration</div>
      <div class="stat-value">${stats.avgDuration}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Average Progress</div>
      <div class="stat-value">${stats.avgProgress}</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Blocked Tasks</div>
      <div class="stat-value">${stats.blockedTasks}</div>
    </div>
  </div>
  ` : ''}
  
  ${config.includeTable ? `
  <h2>Task Details</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Start Date</th>
        <th>End Date</th>
        <th>Duration</th>
        <th>Progress</th>
        <th>Status</th>
        <th>Priority</th>
      </tr>
    </thead>
    <tbody>
      ${data.tasks.map((task: GanttTask) => `
      <tr>
        <td>${task.id}</td>
        <td>${task.name}</td>
        <td>${task.startDate.toLocaleDateString()}</td>
        <td>${task.endDate.toLocaleDateString()}</td>
        <td>${Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24))} days</td>
        <td>${task.progress || 0}%</td>
        <td>${task.status || '-'}</td>
        <td>${task.priority || '-'}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  
  ${data.events && data.events.length > 0 ? `
  <h2>Events</h2>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Type</th>
        <th>Title</th>
        <th>Severity</th>
      </tr>
    </thead>
    <tbody>
      ${data.events.map((event: MissionEvent) => `
      <tr>
        <td>${event.timestamp.toLocaleString()}</td>
        <td>${event.type}</td>
        <td>${event.title}</td>
        <td>${event.severity || '-'}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Helper: Generate MS Project XML
   */
  private static generateMSProjectXML(
    tasks: GanttTask[],
    projectName: string,
    projectStart: Date
  ): string {
    // Simplified MS Project XML structure
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>${projectName}</Name>
  <StartDate>${projectStart.toISOString()}</StartDate>
  <Tasks>
    ${tasks.map((task, index) => `
    <Task>
      <UID>${index + 1}</UID>
      <ID>${index + 1}</ID>
      <Name>${task.name}</Name>
      <Start>${task.startDate.toISOString()}</Start>
      <Finish>${task.endDate.toISOString()}</Finish>
      <Duration>PT${Math.ceil((task.endDate.getTime() - task.startDate.getTime()) / (1000 * 60 * 60))}H</Duration>
      <PercentComplete>${task.progress || 0}</PercentComplete>
      <Priority>${task.priority === 'critical' ? 1000 : task.priority === 'high' ? 800 : task.priority === 'medium' ? 500 : 200}</Priority>
      ${task.dependencies ? `
      <PredecessorLink>
        ${task.dependencies.map(dep => {
          const depIndex = tasks.findIndex(t => t.id === dep);
          return depIndex >= 0 ? `<PredecessorUID>${depIndex + 1}</PredecessorUID>` : '';
        }).join('')}
      </PredecessorLink>
      ` : ''}
    </Task>
    `).join('')}
  </Tasks>
</Project>`;
  }

  /**
   * Helper: Compress data for sharing
   */
  private static compressData(data: any): string {
    // Simple JSON stringification (could use actual compression library)
    return JSON.stringify(data);
  }
}