/**
 * Enhanced Enterprise Annotation System Type Definitions
 * Enterprise-grade annotation types with versioning, permissions, and collaboration
 */

import { BaseAnnotation, ChartAnnotation } from './annotations';

// Enhanced annotation with enterprise features
export interface EnhancedAnnotation extends ChartAnnotation {
  // Versioning
  version: number;
  versionHistory?: AnnotationVersion[];
  
  // Extended metadata
  updatedBy: string;
  
  // Permissions
  permissions?: AnnotationPermission;
  
  // Collaboration
  locked?: boolean;
  lockedBy?: string;
  lockedAt?: number;
  
  // Audit
  auditTrail?: AnnotationAuditEntry[];
  
  // Additional metadata
  metadata?: Record<string, any>;
  attachments?: AnnotationAttachment[];
}

// Version history tracking
export interface AnnotationVersion {
  version: number;
  timestamp: number;
  userId: string;
  userName: string;
  changes: AnnotationChange[];
  comment?: string;
}

export interface AnnotationChange {
  field: string;
  oldValue: any;
  newValue: any;
}

// Permission system
export interface AnnotationPermission {
  owner: string;
  public: boolean;
  roles: {
    [roleId: string]: AnnotationRolePermission;
  };
  users: {
    [userId: string]: AnnotationUserPermission;
  };
}

export interface AnnotationRolePermission {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export interface AnnotationUserPermission extends AnnotationRolePermission {
  expiresAt?: number;
}

// Audit trail
export interface AnnotationAuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: AnnotationAuditAction;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type AnnotationAuditAction = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'locked'
  | 'unlocked'
  | 'shared'
  | 'permission_changed'
  | 'exported'
  | 'imported';

// Collaboration state
export interface CollaborationState {
  activeUsers: CollaborationUser[];
  cursors: CollaborationCursor[];
  selections: CollaborationSelection[];
}

export interface CollaborationUser {
  userId: string;
  userName: string;
  color: string;
  isActive: boolean;
  lastActivity: number;
  status?: 'editing' | 'viewing' | 'idle';
}

export interface CollaborationCursor {
  userId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface CollaborationSelection {
  userId: string;
  annotationId: string;
  timestamp: number;
}

// Attachments
export interface AnnotationAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  uploadedAt: number;
  uploadedBy: string;
}

// Enhanced search and filter
export interface EnhancedAnnotationSearchParams {
  query?: string;
  chartId?: string;
  telemetryStreamId?: string;
  userId?: string;
  tags?: string[];
  category?: string;
  severity?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  includeDeleted?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'severity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeVersionHistory?: boolean;
  includeAuditTrail?: boolean;
}

// Export formats
export type AnnotationExportFormat = 'json' | 'csv' | 'pdf' | 'xlsx';

export interface EnhancedAnnotationExportOptions {
  format: AnnotationExportFormat;
  includeHistory?: boolean;
  includeAuditTrail?: boolean;
  includeAttachments?: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
  annotations?: string[];
}

// Import options
export interface AnnotationImportOptions {
  format: 'json' | 'csv';
  mergeStrategy: 'replace' | 'merge' | 'skip';
  validatePermissions?: boolean;
  assignToUser?: string;
}

// Conflict resolution
export interface AnnotationConflict {
  id: string;
  annotationId: string;
  type: 'version' | 'permission' | 'lock';
  localVersion: EnhancedAnnotation;
  remoteVersion: EnhancedAnnotation;
  timestamp: number;
  resolution?: 'local' | 'remote' | 'merge';
}

// Store state
export interface AnnotationStoreState {
  annotations: Map<string, EnhancedAnnotation>;
  versionCache: Map<string, AnnotationVersion[]>;
  permissionCache: Map<string, AnnotationPermission>;
  conflicts: AnnotationConflict[];
  collaborationState: CollaborationState;
  searchResults: string[];
  isLoading: boolean;
  error: string | null;
  optimisticUpdates: Map<string, EnhancedAnnotation>;
}

// WebSocket event types for real-time updates
export interface EnhancedAnnotationEvent {
  type: AnnotationEventType;
  annotationId: string;
  userId: string;
  timestamp: number;
  data?: any;
}

export type AnnotationEventType =
  | 'annotation.created'
  | 'annotation.updated'
  | 'annotation.deleted'
  | 'annotation.locked'
  | 'annotation.unlocked'
  | 'user.joined'
  | 'user.left'
  | 'cursor.moved'
  | 'selection.changed'
  | 'version.created'
  | 'permission.changed';

// Enhanced component props
export interface EnhancedAnnotationLayerProps {
  chartId: string;
  telemetryStreamId?: string;
  annotations: EnhancedAnnotation[];
  currentUserId: string;
  currentUserName: string;
  onAnnotationChange: (action: AnnotationAuditAction, annotation: EnhancedAnnotation) => void;
  onConflict?: (conflict: AnnotationConflict) => void;
  collaborationEnabled?: boolean;
  permissions?: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canShare: boolean;
    canExport: boolean;
  };
  onWebSocketEvent?: (event: EnhancedAnnotationEvent) => void;
}

// Notification types
export interface AnnotationNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  annotationId?: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

// Bulk operations
export interface BulkAnnotationOperation {
  type: 'update' | 'delete' | 'export' | 'permission';
  annotationIds: string[];
  data?: any;
  options?: any;
}

// Analytics data
export interface AnnotationAnalytics {
  totalAnnotations: number;
  annotationsByType: Record<string, number>;
  annotationsByUser: Record<string, number>;
  annotationsByDate: Array<{ date: string; count: number }>;
  averageVersionsPerAnnotation: number;
  collaborationMetrics: {
    activeUsers: number;
    totalEdits: number;
    averageEditTime: number;
  };
}