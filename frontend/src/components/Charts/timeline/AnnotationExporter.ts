/**
 * AnnotationExporter - Export Utilities for Timeline Annotations
 * 
 * Provides comprehensive export functionality including:
 * - JSON export with full metadata
 * - CSV export for spreadsheet analysis
 * - PDF report generation
 * - Filtering and customization options
 * - Batch export capabilities
 */

import { format } from 'date-fns';
import { TimelineAnnotation, AnnotationFilter } from './TimelineAnnotations';

// Export configuration types
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeReplies?: boolean;
  includeAttachments?: boolean;
  includeVersionHistory?: boolean;
  includeMentions?: boolean;
  includeReactions?: boolean;
  dateFormat?: string;
  filters?: AnnotationFilter;
  customFields?: string[];
  groupBy?: 'category' | 'author' | 'date' | 'none';
  sortBy?: 'timestamp' | 'author' | 'category' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface ExportResult {
  success: boolean;
  data?: string | Blob;
  filename: string;
  mimeType: string;
  error?: string;
}

/**
 * AnnotationExporter Class
 * Main class for handling annotation exports in various formats
 */
export class AnnotationExporter {
  private readonly defaultOptions: Partial<ExportOptions> = {
    includeReplies: true,
    includeAttachments: true,
    includeVersionHistory: false,
    includeMentions: true,
    includeReactions: true,
    dateFormat: 'yyyy-MM-dd HH:mm:ss',
    groupBy: 'none',
    sortBy: 'timestamp',
    sortOrder: 'asc'
  };

  /**
   * Export annotations to specified format
   */
  async exportAnnotations(
    annotations: TimelineAnnotation[],
    options: ExportOptions
  ): Promise<ExportResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    
    try {
      // Filter annotations
      const filteredAnnotations = this.filterAnnotations(annotations, mergedOptions.filters);
      
      // Sort annotations
      const sortedAnnotations = this.sortAnnotations(filteredAnnotations, mergedOptions);
      
      // Group annotations if needed
      const groupedAnnotations = this.groupAnnotations(sortedAnnotations, mergedOptions.groupBy);
      
      // Export based on format
      switch (mergedOptions.format) {
        case 'json':
          return this.exportToJSON(groupedAnnotations, mergedOptions);
        case 'csv':
          return this.exportToCSV(sortedAnnotations, mergedOptions);
        case 'pdf':
          return this.exportToPDF(groupedAnnotations, mergedOptions);
        default:
          throw new Error(`Unsupported export format: ${mergedOptions.format}`);
      }
    } catch (error) {
      return {
        success: false,
        filename: '',
        mimeType: '',
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  /**
   * Filter annotations based on criteria
   */
  private filterAnnotations(
    annotations: TimelineAnnotation[],
    filters?: AnnotationFilter
  ): TimelineAnnotation[] {
    if (!filters) return annotations;

    return annotations.filter(annotation => {
      // Author filter
      if (filters.authors?.length && !filters.authors.includes(annotation.author.id)) {
        return false;
      }
      
      // Category filter
      if (filters.categories?.length && !filters.categories.includes(annotation.category.id)) {
        return false;
      }
      
      // Date range filter
      if (filters.dateRange) {
        const annotationDate = annotation.timestamp;
        if (annotationDate < filters.dateRange.start || annotationDate > filters.dateRange.end) {
          return false;
        }
      }
      
      // Visibility filter
      if (filters.visibility?.length && !filters.visibility.includes(annotation.visibility)) {
        return false;
      }
      
      // Status filter
      if (filters.status?.length && !filters.status.includes(annotation.status)) {
        return false;
      }
      
      // Tags filter
      if (filters.tags?.length) {
        const hasMatchingTag = filters.tags.some(tag => 
          annotation.tags.some(annotationTag => 
            annotationTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasMatchingTag) return false;
      }
      
      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchableContent = [
          annotation.content,
          annotation.author.name,
          annotation.category.name,
          ...annotation.tags
        ].join(' ').toLowerCase();
        
        if (!searchableContent.includes(query)) return false;
      }
      
      return true;
    });
  }

  /**
   * Sort annotations
   */
  private sortAnnotations(
    annotations: TimelineAnnotation[],
    options: Partial<ExportOptions>
  ): TimelineAnnotation[] {
    const { sortBy = 'timestamp', sortOrder = 'asc' } = options;
    
    return [...annotations].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'timestamp':
          comparison = a.timestamp.getTime() - b.timestamp.getTime();
          break;
        case 'author':
          comparison = a.author.name.localeCompare(b.author.name);
          break;
        case 'category':
          comparison = a.category.name.localeCompare(b.category.name);
          break;
        case 'priority':
          const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Group annotations
   */
  private groupAnnotations(
    annotations: TimelineAnnotation[],
    groupBy?: 'category' | 'author' | 'date' | 'none'
  ): Record<string, TimelineAnnotation[]> {
    if (!groupBy || groupBy === 'none') {
      return { all: annotations };
    }
    
    const groups: Record<string, TimelineAnnotation[]> = {};
    
    annotations.forEach(annotation => {
      let groupKey: string;
      
      switch (groupBy) {
        case 'category':
          groupKey = annotation.category.name;
          break;
        case 'author':
          groupKey = annotation.author.name;
          break;
        case 'date':
          groupKey = format(annotation.timestamp, 'yyyy-MM-dd');
          break;
        default:
          groupKey = 'all';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(annotation);
    });
    
    return groups;
  }

  /**
   * Export to JSON format
   */
  private async exportToJSON(
    groupedAnnotations: Record<string, TimelineAnnotation[]>,
    options: Partial<ExportOptions>
  ): Promise<ExportResult> {
    const exportData = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        format: 'json',
        totalAnnotations: Object.values(groupedAnnotations).flat().length,
        options: {
          includeReplies: options.includeReplies,
          includeAttachments: options.includeAttachments,
          includeVersionHistory: options.includeVersionHistory,
          includeMentions: options.includeMentions,
          includeReactions: options.includeReactions
        }
      },
      groups: Object.keys(groupedAnnotations).length > 1 ? groupedAnnotations : undefined,
      annotations: Object.keys(groupedAnnotations).length === 1 ? Object.values(groupedAnnotations)[0] : undefined
    };

    // Clean up annotations based on options
    const processAnnotation = (annotation: TimelineAnnotation) => {
      const processed: any = { ...annotation };
      
      if (!options.includeReplies) {
        delete processed.replies;
      } else if (processed.replies) {
        processed.replies = processed.replies.map(processAnnotation);
      }
      
      if (!options.includeAttachments) {
        delete processed.attachments;
      }
      
      if (!options.includeVersionHistory) {
        delete processed.history;
      }
      
      if (!options.includeMentions) {
        delete processed.mentions;
      }
      
      if (!options.includeReactions) {
        delete processed.reactions;
      }
      
      return processed;
    };

    // Process all annotations
    if (exportData.annotations) {
      exportData.annotations = exportData.annotations.map(processAnnotation);
    }
    
    if (exportData.groups) {
      Object.keys(exportData.groups).forEach(groupKey => {
        exportData.groups![groupKey] = exportData.groups![groupKey].map(processAnnotation);
      });
    }

    const jsonString = JSON.stringify(exportData, null, 2);
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    
    return {
      success: true,
      data: jsonString,
      filename: `timeline-annotations_${timestamp}.json`,
      mimeType: 'application/json'
    };
  }

  /**
   * Export to CSV format
   */
  private async exportToCSV(
    annotations: TimelineAnnotation[],
    options: Partial<ExportOptions>
  ): Promise<ExportResult> {
    const { dateFormat = 'yyyy-MM-dd HH:mm:ss' } = options;
    
    // Define CSV headers
    const headers = [
      'ID',
      'Timestamp',
      'Author',
      'Author Role',
      'Category',
      'Content',
      'Tags',
      'Visibility',
      'Priority',
      'Status',
      'Reply Count',
      'Attachment Count',
      'Mention Count',
      'Reaction Count',
      'Version',
      'Created At',
      'Updated At'
    ];

    // Add optional headers
    if (options.includeAttachments) {
      headers.push('Attachments');
    }
    
    if (options.includeMentions) {
      headers.push('Mentions');
    }
    
    if (options.includeReactions) {
      headers.push('Reactions');
    }

    // Generate CSV rows
    const rows = annotations.map(annotation => {
      const row = [
        annotation.id,
        format(annotation.timestamp, dateFormat),
        annotation.author.name,
        annotation.author.role,
        annotation.category.name,
        `"${annotation.content.replace(/"/g, '""')}"`, // Escape quotes
        annotation.tags.join('; '),
        annotation.visibility,
        annotation.priority,
        annotation.status,
        annotation.replies.length.toString(),
        annotation.attachments.length.toString(),
        annotation.mentions.length.toString(),
        annotation.reactions.reduce((sum, r) => sum + r.count, 0).toString(),
        annotation.version.toString(),
        format(annotation.createdAt, dateFormat),
        format(annotation.updatedAt, dateFormat)
      ];

      // Add optional columns
      if (options.includeAttachments) {
        row.push(annotation.attachments.map(a => a.name).join('; '));
      }
      
      if (options.includeMentions) {
        row.push(annotation.mentions.join('; '));
      }
      
      if (options.includeReactions) {
        row.push(annotation.reactions.map(r => `${r.emoji}:${r.count}`).join('; '));
      }

      return row;
    });

    // Flatten replies if included
    if (options.includeReplies) {
      annotations.forEach(annotation => {
        annotation.replies.forEach(reply => {
          const replyRow = [
            reply.id,
            format(reply.timestamp, dateFormat),
            reply.author.name,
            reply.author.role,
            reply.category.name,
            `"${reply.content.replace(/"/g, '""')}"`,
            reply.tags.join('; '),
            reply.visibility,
            reply.priority,
            reply.status,
            '0', // Replies don't have replies
            reply.attachments.length.toString(),
            reply.mentions.length.toString(),
            reply.reactions.reduce((sum, r) => sum + r.count, 0).toString(),
            reply.version.toString(),
            format(reply.createdAt, dateFormat),
            format(reply.updatedAt, dateFormat)
          ];

          if (options.includeAttachments) {
            replyRow.push(reply.attachments.map(a => a.name).join('; '));
          }
          
          if (options.includeMentions) {
            replyRow.push(reply.mentions.join('; '));
          }
          
          if (options.includeReactions) {
            replyRow.push(reply.reactions.map(r => `${r.emoji}:${r.count}`).join('; '));
          }

          rows.push(replyRow);
        });
      });
    }

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    
    return {
      success: true,
      data: csvContent,
      filename: `timeline-annotations_${timestamp}.csv`,
      mimeType: 'text/csv'
    };
  }

  /**
   * Export to PDF format (simplified - would need a PDF library in practice)
   */
  private async exportToPDF(
    groupedAnnotations: Record<string, TimelineAnnotation[]>,
    options: Partial<ExportOptions>
  ): Promise<ExportResult> {
    // This is a simplified implementation
    // In practice, you would use a library like jsPDF or Puppeteer
    
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const totalAnnotations = Object.values(groupedAnnotations).flat().length;
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Timeline Annotations Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .annotation { border: 1px solid #ddd; margin: 20px 0; padding: 15px; border-radius: 5px; }
          .annotation-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .author { font-weight: bold; color: #2196F3; }
          .category { background: #f5f5f5; padding: 2px 8px; border-radius: 3px; font-size: 12px; }
          .content { margin: 10px 0; line-height: 1.6; }
          .meta { font-size: 12px; color: #666; margin-top: 10px; }
          .replies { margin-left: 20px; border-left: 2px solid #eee; padding-left: 15px; }
          .group-header { color: #333; border-bottom: 1px solid #ddd; padding: 10px 0; margin: 20px 0 10px 0; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Timeline Annotations Report</h1>
          <p>Generated on ${format(new Date(), 'MMMM dd, yyyy at HH:mm')}</p>
          <p>Total Annotations: ${totalAnnotations}</p>
        </div>
    `;

    // Add grouped content
    Object.entries(groupedAnnotations).forEach(([groupName, annotations]) => {
      if (Object.keys(groupedAnnotations).length > 1) {
        htmlContent += `<h2 class="group-header">${groupName} (${annotations.length} annotations)</h2>`;
      }

      annotations.forEach(annotation => {
        htmlContent += `
          <div class="annotation">
            <div class="annotation-header">
              <div>
                <span class="author">${annotation.author.name}</span>
                <span class="category">${annotation.category.name}</span>
              </div>
              <div>${format(annotation.timestamp, options.dateFormat || 'MMM dd, yyyy HH:mm')}</div>
            </div>
            <div class="content">${annotation.content}</div>
            <div class="meta">
              Priority: ${annotation.priority} | Visibility: ${annotation.visibility} | Status: ${annotation.status}
              ${annotation.tags.length ? ` | Tags: ${annotation.tags.join(', ')}` : ''}
            </div>
        `;

        // Add replies if included
        if (options.includeReplies && annotation.replies.length > 0) {
          htmlContent += '<div class="replies">';
          annotation.replies.forEach(reply => {
            htmlContent += `
              <div class="annotation">
                <div class="annotation-header">
                  <div>
                    <span class="author">${reply.author.name}</span>
                    <small>(Reply)</small>
                  </div>
                  <div>${format(reply.timestamp, options.dateFormat || 'MMM dd, yyyy HH:mm')}</div>
                </div>
                <div class="content">${reply.content}</div>
              </div>
            `;
          });
          htmlContent += '</div>';
        }

        htmlContent += '</div>';
      });
    });

    htmlContent += `
      </body>
      </html>
    `;

    // In a real implementation, you would convert this HTML to PDF
    // For now, return the HTML content
    return {
      success: true,
      data: htmlContent,
      filename: `timeline-annotations_${timestamp}.html`, // Would be .pdf in real implementation
      mimeType: 'text/html' // Would be 'application/pdf' in real implementation
    };
  }

  /**
   * Download the exported data
   */
  static downloadExport(result: ExportResult): void {
    if (!result.success || !result.data) {
      console.error('Export failed:', result.error);
      return;
    }

    const blob = result.data instanceof Blob 
      ? result.data 
      : new Blob([result.data], { type: result.mimeType });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Get export statistics
   */
  static getExportStats(annotations: TimelineAnnotation[]): {
    total: number;
    byCategory: Record<string, number>;
    byAuthor: Record<string, number>;
    byStatus: Record<string, number>;
    withReplies: number;
    withAttachments: number;
  } {
    const stats = {
      total: annotations.length,
      byCategory: {} as Record<string, number>,
      byAuthor: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      withReplies: 0,
      withAttachments: 0
    };

    annotations.forEach(annotation => {
      // Count by category
      const categoryName = annotation.category.name;
      stats.byCategory[categoryName] = (stats.byCategory[categoryName] || 0) + 1;

      // Count by author
      const authorName = annotation.author.name;
      stats.byAuthor[authorName] = (stats.byAuthor[authorName] || 0) + 1;

      // Count by status
      stats.byStatus[annotation.status] = (stats.byStatus[annotation.status] || 0) + 1;

      // Count special cases
      if (annotation.replies.length > 0) {
        stats.withReplies++;
      }
      if (annotation.attachments.length > 0) {
        stats.withAttachments++;
      }
    });

    return stats;
  }
}

// Export convenience functions
export const exportAnnotationsToJSON = (
  annotations: TimelineAnnotation[],
  options?: Partial<ExportOptions>
) => {
  const exporter = new AnnotationExporter();
  return exporter.exportAnnotations(annotations, { format: 'json', ...options });
};

export const exportAnnotationsToCSV = (
  annotations: TimelineAnnotation[],
  options?: Partial<ExportOptions>
) => {
  const exporter = new AnnotationExporter();
  return exporter.exportAnnotations(annotations, { format: 'csv', ...options });
};

export const exportAnnotationsToPDF = (
  annotations: TimelineAnnotation[],
  options?: Partial<ExportOptions>
) => {
  const exporter = new AnnotationExporter();
  return exporter.exportAnnotations(annotations, { format: 'pdf', ...options });
};

export default AnnotationExporter;