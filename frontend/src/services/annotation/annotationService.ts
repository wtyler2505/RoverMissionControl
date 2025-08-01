/**
 * Annotation Service
 * Handles API communication for the enterprise annotation system
 */

import axios, { AxiosInstance } from 'axios';
import {
  EnhancedAnnotation,
  AnnotationVersion,
  AnnotationPermission,
  EnhancedAnnotationSearchParams,
  AnnotationExportFormat,
  EnhancedAnnotationExportOptions,
  AnnotationImportOptions,
  AnnotationAnalytics,
  BulkAnnotationOperation
} from '../../types/enterprise-annotations';

// API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
const API_TIMEOUT = 30000; // 30 seconds

class AnnotationService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/annotations`,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for authentication
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new annotation
   */
  async createAnnotation(annotation: Omit<EnhancedAnnotation, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<EnhancedAnnotation> {
    const response = await this.api.post('/', annotation);
    return response.data;
  }

  /**
   * Get annotation by ID
   */
  async getAnnotation(id: string, includeHistory = false): Promise<EnhancedAnnotation> {
    const response = await this.api.get(`/${id}`, {
      params: { includeHistory }
    });
    return response.data;
  }

  /**
   * Update annotation
   */
  async updateAnnotation(id: string, updates: Partial<EnhancedAnnotation>, comment?: string): Promise<EnhancedAnnotation> {
    const response = await this.api.put(`/${id}`, {
      ...updates,
      updateComment: comment
    });
    return response.data;
  }

  /**
   * Delete annotation
   */
  async deleteAnnotation(id: string, permanent = false): Promise<void> {
    await this.api.delete(`/${id}`, {
      params: { permanent }
    });
  }

  /**
   * Restore deleted annotation
   */
  async restoreAnnotation(id: string): Promise<EnhancedAnnotation> {
    const response = await this.api.post(`/${id}/restore`);
    return response.data;
  }

  /**
   * Search annotations
   */
  async searchAnnotations(params: EnhancedAnnotationSearchParams): Promise<{
    annotations: EnhancedAnnotation[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const response = await this.api.get('/search', { params });
    return response.data;
  }

  /**
   * Get annotations by chart ID
   */
  async getAnnotationsByChart(chartId: string, includeDeleted = false): Promise<EnhancedAnnotation[]> {
    const response = await this.api.get(`/chart/${chartId}`, {
      params: { includeDeleted }
    });
    return response.data;
  }

  /**
   * Get version history
   */
  async getVersionHistory(annotationId: string): Promise<AnnotationVersion[]> {
    const response = await this.api.get(`/${annotationId}/versions`);
    return response.data;
  }

  /**
   * Revert to specific version
   */
  async revertToVersion(annotationId: string, version: number): Promise<EnhancedAnnotation> {
    const response = await this.api.post(`/${annotationId}/revert`, { version });
    return response.data;
  }

  /**
   * Get annotation permissions
   */
  async getPermissions(annotationId: string): Promise<AnnotationPermission> {
    const response = await this.api.get(`/${annotationId}/permissions`);
    return response.data;
  }

  /**
   * Update annotation permissions
   */
  async updatePermissions(annotationId: string, permissions: AnnotationPermission): Promise<AnnotationPermission> {
    const response = await this.api.put(`/${annotationId}/permissions`, permissions);
    return response.data;
  }

  /**
   * Share annotation with users
   */
  async shareAnnotation(
    annotationId: string,
    users: Array<{ userId: string; permissions: string[] }>,
    message?: string
  ): Promise<void> {
    await this.api.post(`/${annotationId}/share`, {
      users,
      message
    });
  }

  /**
   * Lock annotation for editing
   */
  async lockAnnotation(annotationId: string): Promise<{ lockId: string; expiresAt: number }> {
    const response = await this.api.post(`/${annotationId}/lock`);
    return response.data;
  }

  /**
   * Unlock annotation
   */
  async unlockAnnotation(annotationId: string, lockId: string): Promise<void> {
    await this.api.delete(`/${annotationId}/lock`, {
      data: { lockId }
    });
  }

  /**
   * Check if annotation is locked
   */
  async checkLock(annotationId: string): Promise<{
    isLocked: boolean;
    lockedBy?: string;
    expiresAt?: number;
  }> {
    const response = await this.api.get(`/${annotationId}/lock`);
    return response.data;
  }

  /**
   * Export annotations
   */
  async exportAnnotations(options: EnhancedAnnotationExportOptions): Promise<Blob> {
    const response = await this.api.post('/export', options, {
      responseType: 'blob'
    });
    return response.data;
  }

  /**
   * Import annotations
   */
  async importAnnotations(
    file: File,
    options: AnnotationImportOptions
  ): Promise<{
    imported: number;
    updated: number;
    skipped: number;
    errors: Array<{ annotationId: string; error: string }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));

    const response = await this.api.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }

  /**
   * Bulk operations
   */
  async bulkOperation(operation: BulkAnnotationOperation): Promise<{
    success: string[];
    failed: Array<{ id: string; error: string }>;
  }> {
    const response = await this.api.post('/bulk', operation);
    return response.data;
  }

  /**
   * Get annotation analytics
   */
  async getAnalytics(
    chartId?: string,
    dateRange?: { start: number; end: number }
  ): Promise<AnnotationAnalytics> {
    const response = await this.api.get('/analytics', {
      params: { chartId, ...dateRange }
    });
    return response.data;
  }

  /**
   * Subscribe to real-time updates via WebSocket
   */
  subscribeToUpdates(
    chartId: string,
    onUpdate: (event: any) => void
  ): () => void {
    // WebSocket connection for real-time updates
    const ws = new WebSocket(`${API_BASE_URL.replace('http', 'ws')}/annotations/subscribe/${chartId}`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Return cleanup function
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }

  /**
   * Get suggested tags
   */
  async getSuggestedTags(query: string, limit = 10): Promise<string[]> {
    const response = await this.api.get('/tags/suggestions', {
      params: { query, limit }
    });
    return response.data;
  }

  /**
   * Get popular tags
   */
  async getPopularTags(chartId?: string, limit = 20): Promise<Array<{ tag: string; count: number }>> {
    const response = await this.api.get('/tags/popular', {
      params: { chartId, limit }
    });
    return response.data;
  }

  /**
   * Validate annotation data
   */
  async validateAnnotation(annotation: Partial<EnhancedAnnotation>): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
  }> {
    const response = await this.api.post('/validate', annotation);
    return response.data;
  }

  /**
   * Get annotation templates
   */
  async getTemplates(type?: string): Promise<Array<{
    id: string;
    name: string;
    description: string;
    type: string;
    template: Partial<EnhancedAnnotation>;
  }>> {
    const response = await this.api.get('/templates', {
      params: { type }
    });
    return response.data;
  }

  /**
   * Create annotation from template
   */
  async createFromTemplate(
    templateId: string,
    overrides: Partial<EnhancedAnnotation>
  ): Promise<EnhancedAnnotation> {
    const response = await this.api.post('/from-template', {
      templateId,
      overrides
    });
    return response.data;
  }

  /**
   * Get user's recent annotations
   */
  async getRecentAnnotations(
    userId: string,
    limit = 10
  ): Promise<EnhancedAnnotation[]> {
    const response = await this.api.get(`/user/${userId}/recent`, {
      params: { limit }
    });
    return response.data;
  }

  /**
   * Get annotation activity feed
   */
  async getActivityFeed(
    chartId?: string,
    limit = 50
  ): Promise<Array<{
    id: string;
    type: string;
    annotationId: string;
    userId: string;
    userName: string;
    timestamp: number;
    details: any;
  }>> {
    const response = await this.api.get('/activity', {
      params: { chartId, limit }
    });
    return response.data;
  }

  /**
   * Batch create annotations
   */
  async batchCreate(
    annotations: Array<Omit<EnhancedAnnotation, 'id' | 'version' | 'createdAt' | 'updatedAt'>>
  ): Promise<{
    created: EnhancedAnnotation[];
    failed: Array<{ index: number; error: string }>;
  }> {
    const response = await this.api.post('/batch', { annotations });
    return response.data;
  }

  /**
   * Get annotation conflicts
   */
  async getConflicts(chartId: string): Promise<Array<{
    id: string;
    type: 'version' | 'permission' | 'lock';
    annotationId: string;
    details: any;
  }>> {
    const response = await this.api.get(`/chart/${chartId}/conflicts`);
    return response.data;
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: Partial<EnhancedAnnotation>
  ): Promise<void> {
    await this.api.post(`/conflicts/${conflictId}/resolve`, {
      resolution,
      mergedData
    });
  }
}

// Export singleton instance
export default new AnnotationService();