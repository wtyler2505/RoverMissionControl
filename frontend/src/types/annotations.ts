/**
 * Annotation Types and Interfaces
 * Shared definitions for chart and timeline annotations
 */

import { AnnotationType } from '../components/Telemetry/TimelineAnnotations';

/**
 * Base annotation interface
 */
export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  title: string;
  description?: string;
  color?: string;
  streamId?: string;
  tags?: string[];
  createdBy?: string;
  createdAt?: number;
  updatedAt?: number;
  version?: number;
}

/**
 * Chart annotation anchoring types
 */
export enum AnchorType {
  POINT = 'point',        // Single data point
  VERTICAL = 'vertical',  // Vertical line at x value
  HORIZONTAL = 'horizontal', // Horizontal line at y value
  REGION = 'region',      // Rectangle region
  TEXT = 'text',          // Floating text
  CALLOUT = 'callout'     // Connected callout
}

/**
 * Connector styles for callout annotations
 */
export enum ConnectorStyle {
  STRAIGHT = 'straight',
  CURVED = 'curved',
  ELBOW = 'elbow',
  NONE = 'none'
}

/**
 * Chart annotation interface
 */
export interface ChartAnnotation extends BaseAnnotation {
  // Positioning
  x: number;              // X-axis value
  y?: number;             // Y-axis value (optional for vertical lines)
  x2?: number;            // End X for regions
  y2?: number;            // End Y for regions
  
  // Anchoring
  anchorType: AnchorType;
  seriesId?: string;      // Which data series (if applicable)
  dataPointIndex?: number; // Specific data point (if applicable)
  
  // Styling
  connectorStyle?: ConnectorStyle;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  opacity?: number;
  dashArray?: string;
  
  // Collaboration
  isPrivate?: boolean;    // Private to creator
  mentions?: string[];    // Mentioned users
  replies?: AnnotationReply[];
  
  // Persistence
  isDraft?: boolean;      // Not yet saved
  syncStatus?: 'local' | 'syncing' | 'synced' | 'error';
}

/**
 * Annotation reply for collaboration
 */
export interface AnnotationReply {
  id: string;
  text: string;
  createdBy: string;
  createdAt: number;
  mentions?: string[];
}

/**
 * Annotation filter options
 */
export interface AnnotationFilter {
  types?: AnnotationType[];
  tags?: string[];
  creators?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  searchText?: string;
  includePrivate?: boolean;
}

/**
 * Annotation service events
 */
export enum AnnotationEvent {
  CREATED = 'annotation:created',
  UPDATED = 'annotation:updated',
  DELETED = 'annotation:deleted',
  REPLY_ADDED = 'annotation:reply_added',
  BATCH_UPDATE = 'annotation:batch_update'
}

/**
 * Annotation WebSocket message
 */
export interface AnnotationMessage {
  event: AnnotationEvent;
  data: {
    annotation?: ChartAnnotation;
    annotations?: ChartAnnotation[];
    annotationId?: string;
    reply?: AnnotationReply;
    userId: string;
    timestamp: number;
  };
}

/**
 * Annotation export format
 */
export interface AnnotationExport {
  version: string;
  exportDate: number;
  annotations: ChartAnnotation[];
  metadata: {
    chartType?: string;
    dataSource?: string;
    timeRange?: {
      start: number;
      end: number;
    };
    exportedBy: string;
  };
}

/**
 * Annotation template for quick creation
 */
export interface AnnotationTemplate {
  id: string;
  name: string;
  description?: string;
  type: AnnotationType;
  anchorType: AnchorType;
  defaultTitle: string;
  defaultTags?: string[];
  style?: Partial<ChartAnnotation>;
}

/**
 * Default annotation templates
 */
export const DEFAULT_TEMPLATES: AnnotationTemplate[] = [
  {
    id: 'anomaly',
    name: 'Anomaly Marker',
    type: AnnotationType.WARNING,
    anchorType: AnchorType.POINT,
    defaultTitle: 'Anomaly Detected',
    defaultTags: ['anomaly', 'investigation'],
    style: {
      connectorStyle: ConnectorStyle.CURVED,
      fontSize: 12,
      fontWeight: 'bold'
    }
  },
  {
    id: 'milestone',
    name: 'Milestone',
    type: AnnotationType.SUCCESS,
    anchorType: AnchorType.VERTICAL,
    defaultTitle: 'Milestone Reached',
    defaultTags: ['milestone'],
    style: {
      dashArray: '5,5',
      opacity: 0.8
    }
  },
  {
    id: 'maintenance',
    name: 'Maintenance Window',
    type: AnnotationType.INFO,
    anchorType: AnchorType.REGION,
    defaultTitle: 'Maintenance Period',
    defaultTags: ['maintenance', 'scheduled'],
    style: {
      opacity: 0.2
    }
  },
  {
    id: 'threshold',
    name: 'Threshold Line',
    type: AnnotationType.ERROR,
    anchorType: AnchorType.HORIZONTAL,
    defaultTitle: 'Critical Threshold',
    defaultTags: ['threshold', 'limit'],
    style: {
      dashArray: '10,5',
      fontWeight: 'bold'
    }
  }
];

/**
 * Annotation permissions
 */
export interface AnnotationPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canReply: boolean;
  canViewPrivate: boolean;
  canExport: boolean;
}

/**
 * Helper to check if annotation is editable by user
 */
export function isAnnotationEditable(
  annotation: ChartAnnotation,
  userId: string,
  permissions: AnnotationPermissions
): boolean {
  if (!permissions.canEdit) return false;
  if (annotation.createdBy === userId) return true;
  if (annotation.isPrivate) return false;
  return permissions.canEdit;
}