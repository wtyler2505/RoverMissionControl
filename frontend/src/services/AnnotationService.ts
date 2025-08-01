/**
 * AnnotationService - Manages chart annotations with persistence and real-time sync
 */

import { EventEmitter } from 'events';
import {
  ChartAnnotation,
  AnnotationEvent,
  AnnotationMessage,
  AnnotationFilter,
  AnnotationExport,
  AnnotationReply,
  AnnotationPermissions
} from '../types/annotations';

/**
 * Annotation service configuration
 */
export interface AnnotationServiceConfig {
  apiEndpoint?: string;
  wsEndpoint?: string;
  userId: string;
  permissions: AnnotationPermissions;
  enableRealTimeSync?: boolean;
  localStorageKey?: string;
  maxLocalAnnotations?: number;
}

/**
 * Annotation storage interface
 */
interface AnnotationStorage {
  annotations: Map<string, ChartAnnotation>;
  lastSync: number;
  pendingSync: Set<string>;
}

/**
 * AnnotationService class
 */
export class AnnotationService extends EventEmitter {
  private config: AnnotationServiceConfig;
  private storage: AnnotationStorage;
  private ws: WebSocket | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  
  constructor(config: AnnotationServiceConfig) {
    super();
    this.config = {
      localStorageKey: 'chart_annotations',
      maxLocalAnnotations: 1000,
      enableRealTimeSync: true,
      ...config
    };
    
    this.storage = {
      annotations: new Map(),
      lastSync: 0,
      pendingSync: new Set()
    };
    
    this.initialize();
  }
  
  /**
   * Initialize service
   */
  private async initialize(): Promise<void> {
    // Load from local storage
    this.loadLocalAnnotations();
    
    // Connect WebSocket if enabled
    if (this.config.enableRealTimeSync && this.config.wsEndpoint) {
      this.connectWebSocket();
    }
    
    // Sync with backend
    if (this.config.apiEndpoint) {
      await this.syncAnnotations();
    }
    
    // Start periodic sync
    this.startPeriodicSync();
  }
  
  /**
   * Load annotations from local storage
   */
  private loadLocalAnnotations(): void {
    try {
      const stored = localStorage.getItem(this.config.localStorageKey!);
      if (stored) {
        const data = JSON.parse(stored) as {
          annotations: [string, ChartAnnotation][];
          lastSync: number;
        };
        
        this.storage.annotations = new Map(data.annotations);
        this.storage.lastSync = data.lastSync;
        
        // Clean up old drafts
        const now = Date.now();
        for (const [id, annotation] of this.storage.annotations) {
          if (annotation.isDraft && now - annotation.createdAt! > 86400000) { // 24 hours
            this.storage.annotations.delete(id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load local annotations:', error);
    }
  }
  
  /**
   * Save annotations to local storage
   */
  private saveLocalAnnotations(): void {
    try {
      // Limit number of annotations
      if (this.storage.annotations.size > this.config.maxLocalAnnotations!) {
        const sortedAnnotations = Array.from(this.storage.annotations.entries())
          .sort((a, b) => (b[1].updatedAt || b[1].createdAt || 0) - (a[1].updatedAt || a[1].createdAt || 0));
        
        this.storage.annotations = new Map(
          sortedAnnotations.slice(0, this.config.maxLocalAnnotations!)
        );
      }
      
      const data = {
        annotations: Array.from(this.storage.annotations.entries()),
        lastSync: this.storage.lastSync
      };
      
      localStorage.setItem(this.config.localStorageKey!, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save local annotations:', error);
    }
  }
  
  /**
   * Connect to WebSocket for real-time sync
   */
  private connectWebSocket(): void {
    if (!this.config.wsEndpoint) return;
    
    try {
      this.ws = new WebSocket(this.config.wsEndpoint);
      
      this.ws.onopen = () => {
        console.log('Annotation WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Subscribe to annotation updates
        this.ws!.send(JSON.stringify({
          type: 'subscribe',
          channel: 'annotations',
          userId: this.config.userId
        }));
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as AnnotationMessage;
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('Annotation WebSocket error:', error);
        this.emit('error', error);
      };
      
      this.ws.onclose = () => {
        console.log('Annotation WebSocket disconnected');
        this.emit('disconnected');
        this.scheduleReconnect();
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle WebSocket message
   */
  private handleWebSocketMessage(message: AnnotationMessage): void {
    // Ignore messages from self
    if (message.data.userId === this.config.userId) return;
    
    switch (message.event) {
      case AnnotationEvent.CREATED:
      case AnnotationEvent.UPDATED:
        if (message.data.annotation) {
          this.storage.annotations.set(message.data.annotation.id, message.data.annotation);
          this.emit(message.event, message.data.annotation);
        }
        break;
        
      case AnnotationEvent.DELETED:
        if (message.data.annotationId) {
          this.storage.annotations.delete(message.data.annotationId);
          this.emit(message.event, message.data.annotationId);
        }
        break;
        
      case AnnotationEvent.REPLY_ADDED:
        if (message.data.annotationId && message.data.reply) {
          const annotation = this.storage.annotations.get(message.data.annotationId);
          if (annotation) {
            annotation.replies = [...(annotation.replies || []), message.data.reply];
            this.emit(message.event, annotation, message.data.reply);
          }
        }
        break;
        
      case AnnotationEvent.BATCH_UPDATE:
        if (message.data.annotations) {
          for (const annotation of message.data.annotations) {
            this.storage.annotations.set(annotation.id, annotation);
          }
          this.emit(message.event, message.data.annotations);
        }
        break;
    }
    
    this.saveLocalAnnotations();
  }
  
  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, delay);
  }
  
  /**
   * Start periodic sync
   */
  private startPeriodicSync(): void {
    if (!this.config.apiEndpoint) return;
    
    this.syncTimer = setInterval(() => {
      this.syncAnnotations();
    }, 60000); // Sync every minute
  }
  
  /**
   * Sync annotations with backend
   */
  private async syncAnnotations(): Promise<void> {
    if (!this.config.apiEndpoint) return;
    
    try {
      // Get pending annotations
      const pendingAnnotations = Array.from(this.storage.pendingSync)
        .map(id => this.storage.annotations.get(id))
        .filter(Boolean) as ChartAnnotation[];
      
      if (pendingAnnotations.length > 0) {
        // Upload pending annotations
        const response = await fetch(`${this.config.apiEndpoint}/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': this.config.userId
          },
          body: JSON.stringify({ annotations: pendingAnnotations })
        });
        
        if (response.ok) {
          const result = await response.json();
          
          // Update with server response
          for (const annotation of result.annotations) {
            this.storage.annotations.set(annotation.id, annotation);
            this.storage.pendingSync.delete(annotation.id);
          }
        }
      }
      
      // Fetch updates since last sync
      const response = await fetch(
        `${this.config.apiEndpoint}?since=${this.storage.lastSync}&userId=${this.config.userId}`,
        {
          headers: {
            'X-User-Id': this.config.userId
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        
        // Merge remote annotations
        for (const annotation of result.annotations) {
          const existing = this.storage.annotations.get(annotation.id);
          
          // Resolve conflicts (server wins for now)
          if (!existing || existing.version! < annotation.version!) {
            this.storage.annotations.set(annotation.id, annotation);
          }
        }
        
        this.storage.lastSync = result.timestamp;
        this.emit('synced', result.annotations.length);
      }
      
      this.saveLocalAnnotations();
    } catch (error) {
      console.error('Failed to sync annotations:', error);
      this.emit('sync_error', error);
    }
  }
  
  /**
   * Create new annotation
   */
  async createAnnotation(annotation: Omit<ChartAnnotation, 'id' | 'createdAt' | 'createdBy'>): Promise<ChartAnnotation> {
    if (!this.config.permissions.canCreate) {
      throw new Error('Permission denied: Cannot create annotations');
    }
    
    const newAnnotation: ChartAnnotation = {
      ...annotation,
      id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      createdBy: this.config.userId,
      version: 1,
      syncStatus: 'local'
    };
    
    this.storage.annotations.set(newAnnotation.id, newAnnotation);
    this.storage.pendingSync.add(newAnnotation.id);
    
    // Emit local event
    this.emit(AnnotationEvent.CREATED, newAnnotation);
    
    // Send to WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: AnnotationEvent.CREATED,
        data: {
          annotation: newAnnotation,
          userId: this.config.userId,
          timestamp: Date.now()
        }
      } as AnnotationMessage));
    }
    
    // Save locally
    this.saveLocalAnnotations();
    
    // Sync with backend
    if (this.config.apiEndpoint) {
      this.syncAnnotations();
    }
    
    return newAnnotation;
  }
  
  /**
   * Update annotation
   */
  async updateAnnotation(id: string, updates: Partial<ChartAnnotation>): Promise<ChartAnnotation> {
    const annotation = this.storage.annotations.get(id);
    if (!annotation) {
      throw new Error('Annotation not found');
    }
    
    // Check permissions
    if (!this.config.permissions.canEdit) {
      throw new Error('Permission denied: Cannot edit annotations');
    }
    
    if (annotation.createdBy !== this.config.userId && annotation.isPrivate) {
      throw new Error('Permission denied: Cannot edit private annotation');
    }
    
    const updatedAnnotation: ChartAnnotation = {
      ...annotation,
      ...updates,
      id: annotation.id, // Preserve ID
      createdAt: annotation.createdAt, // Preserve creation time
      createdBy: annotation.createdBy, // Preserve creator
      updatedAt: Date.now(),
      version: (annotation.version || 0) + 1,
      syncStatus: 'local'
    };
    
    this.storage.annotations.set(id, updatedAnnotation);
    this.storage.pendingSync.add(id);
    
    // Emit local event
    this.emit(AnnotationEvent.UPDATED, updatedAnnotation);
    
    // Send to WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: AnnotationEvent.UPDATED,
        data: {
          annotation: updatedAnnotation,
          userId: this.config.userId,
          timestamp: Date.now()
        }
      } as AnnotationMessage));
    }
    
    // Save locally
    this.saveLocalAnnotations();
    
    // Sync with backend
    if (this.config.apiEndpoint) {
      this.syncAnnotations();
    }
    
    return updatedAnnotation;
  }
  
  /**
   * Delete annotation
   */
  async deleteAnnotation(id: string): Promise<void> {
    const annotation = this.storage.annotations.get(id);
    if (!annotation) return;
    
    // Check permissions
    if (!this.config.permissions.canDelete) {
      throw new Error('Permission denied: Cannot delete annotations');
    }
    
    if (annotation.createdBy !== this.config.userId) {
      throw new Error('Permission denied: Can only delete own annotations');
    }
    
    this.storage.annotations.delete(id);
    this.storage.pendingSync.delete(id);
    
    // Emit local event
    this.emit(AnnotationEvent.DELETED, id);
    
    // Send to WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: AnnotationEvent.DELETED,
        data: {
          annotationId: id,
          userId: this.config.userId,
          timestamp: Date.now()
        }
      } as AnnotationMessage));
    }
    
    // Save locally
    this.saveLocalAnnotations();
    
    // Delete from backend
    if (this.config.apiEndpoint) {
      try {
        await fetch(`${this.config.apiEndpoint}/${id}`, {
          method: 'DELETE',
          headers: {
            'X-User-Id': this.config.userId
          }
        });
      } catch (error) {
        console.error('Failed to delete annotation from backend:', error);
      }
    }
  }
  
  /**
   * Add reply to annotation
   */
  async addReply(annotationId: string, text: string, mentions?: string[]): Promise<AnnotationReply> {
    if (!this.config.permissions.canReply) {
      throw new Error('Permission denied: Cannot reply to annotations');
    }
    
    const annotation = this.storage.annotations.get(annotationId);
    if (!annotation) {
      throw new Error('Annotation not found');
    }
    
    const reply: AnnotationReply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      createdBy: this.config.userId,
      createdAt: Date.now(),
      mentions
    };
    
    annotation.replies = [...(annotation.replies || []), reply];
    annotation.updatedAt = Date.now();
    annotation.version = (annotation.version || 0) + 1;
    
    this.storage.pendingSync.add(annotationId);
    
    // Emit local event
    this.emit(AnnotationEvent.REPLY_ADDED, annotation, reply);
    
    // Send to WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: AnnotationEvent.REPLY_ADDED,
        data: {
          annotationId,
          reply,
          userId: this.config.userId,
          timestamp: Date.now()
        }
      } as AnnotationMessage));
    }
    
    // Save locally
    this.saveLocalAnnotations();
    
    // Sync with backend
    if (this.config.apiEndpoint) {
      this.syncAnnotations();
    }
    
    return reply;
  }
  
  /**
   * Get annotations with optional filter
   */
  getAnnotations(filter?: AnnotationFilter): ChartAnnotation[] {
    let annotations = Array.from(this.storage.annotations.values());
    
    if (filter) {
      // Filter by types
      if (filter.types?.length) {
        annotations = annotations.filter(a => filter.types!.includes(a.type));
      }
      
      // Filter by tags
      if (filter.tags?.length) {
        annotations = annotations.filter(a => 
          a.tags?.some(tag => filter.tags!.includes(tag))
        );
      }
      
      // Filter by creators
      if (filter.creators?.length) {
        annotations = annotations.filter(a => 
          filter.creators!.includes(a.createdBy!)
        );
      }
      
      // Filter by date range
      if (filter.dateRange) {
        annotations = annotations.filter(a => {
          const date = a.createdAt || 0;
          return date >= filter.dateRange!.start && date <= filter.dateRange!.end;
        });
      }
      
      // Filter by search text
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        annotations = annotations.filter(a =>
          a.title.toLowerCase().includes(searchLower) ||
          a.description?.toLowerCase().includes(searchLower) ||
          a.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      
      // Filter private annotations
      if (!filter.includePrivate) {
        annotations = annotations.filter(a => 
          !a.isPrivate || a.createdBy === this.config.userId
        );
      }
    }
    
    // Sort by creation date (newest first)
    return annotations.sort((a, b) => 
      (b.createdAt || 0) - (a.createdAt || 0)
    );
  }
  
  /**
   * Get annotation by ID
   */
  getAnnotation(id: string): ChartAnnotation | undefined {
    return this.storage.annotations.get(id);
  }
  
  /**
   * Export annotations
   */
  exportAnnotations(filter?: AnnotationFilter): AnnotationExport {
    if (!this.config.permissions.canExport) {
      throw new Error('Permission denied: Cannot export annotations');
    }
    
    const annotations = this.getAnnotations(filter);
    
    return {
      version: '1.0',
      exportDate: Date.now(),
      annotations,
      metadata: {
        exportedBy: this.config.userId
      }
    };
  }
  
  /**
   * Import annotations
   */
  async importAnnotations(data: AnnotationExport): Promise<number> {
    if (!this.config.permissions.canCreate) {
      throw new Error('Permission denied: Cannot import annotations');
    }
    
    let imported = 0;
    
    for (const annotation of data.annotations) {
      try {
        // Create new annotation with new ID
        await this.createAnnotation({
          ...annotation,
          title: `[Imported] ${annotation.title}`,
          tags: [...(annotation.tags || []), 'imported']
        });
        imported++;
      } catch (error) {
        console.error('Failed to import annotation:', error);
      }
    }
    
    return imported;
  }
  
  /**
   * Clear all local annotations
   */
  clearLocal(): void {
    this.storage.annotations.clear();
    this.storage.pendingSync.clear();
    this.storage.lastSync = 0;
    this.saveLocalAnnotations();
    this.emit('cleared');
  }
  
  /**
   * Destroy service
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
let annotationService: AnnotationService | null = null;

export function getAnnotationService(config?: AnnotationServiceConfig): AnnotationService {
  if (!annotationService && config) {
    annotationService = new AnnotationService(config);
  }
  
  if (!annotationService) {
    throw new Error('AnnotationService not initialized');
  }
  
  return annotationService;
}

export function destroyAnnotationService(): void {
  if (annotationService) {
    annotationService.destroy();
    annotationService = null;
  }
}