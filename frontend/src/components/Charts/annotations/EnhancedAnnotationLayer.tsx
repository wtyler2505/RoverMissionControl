/**
 * Enhanced Annotation Layer Component
 * Enterprise-grade annotation system with versioning, permissions, and collaboration
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import styled from 'styled-components';
import { 
  IconButton, 
  Tooltip, 
  Menu, 
  MenuItem, 
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Box,
  Chip,
  Badge,
  Avatar,
  Typography,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  AvatarGroup
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Circle as PointIcon,
  Timeline as LineIcon,
  CropSquare as RectIcon,
  TextFields as TextIcon,
  TrendingFlat as ArrowIcon,
  History as HistoryIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  People as PeopleIcon,
  Warning as WarningIcon,
  CloudSync as SyncIcon,
  CloudOff as OfflineIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import useAnnotationStore from '../../../stores/annotationStore';
import { 
  EnhancedAnnotation, 
  EnhancedAnnotationLayerProps,
  AnnotationConflict,
  CollaborationUser,
  CollaborationCursor
} from '../../../types/enterprise-annotations';
import { AnnotationType } from '../interactions/types';
import VersionHistoryDialog from './VersionHistoryDialog';
import PermissionManagerDialog from './PermissionManagerDialog';
import ConflictResolutionDialog from './ConflictResolutionDialog';
import CollaborationCursors from './CollaborationCursors';

// Styled components
const AnnotationToolbar = styled(motion.div)`
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  
  @media (prefers-color-scheme: dark) {
    background: rgba(42, 42, 42, 0.95);
    border-color: #444;
  }
`;

const CollaborationIndicator = styled(Box)`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  padding: 0 8px;
`;

const VersionBadge = styled(Badge)`
  .MuiBadge-badge {
    background: #1976d2;
    color: white;
    font-size: 10px;
  }
`;

const LockIndicator = styled(motion.div)`
  position: absolute;
  top: -20px;
  right: -20px;
  background: #ff9800;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const ConflictAlert = styled(Alert)`
  position: fixed;
  bottom: 20px;
  right: 20px;
  max-width: 400px;
  z-index: 1000;
`;

export const EnhancedAnnotationLayer: React.FC<EnhancedAnnotationLayerProps> = ({
  chartId,
  telemetryStreamId,
  annotations,
  currentUserId,
  currentUserName,
  onAnnotationChange,
  onConflict,
  collaborationEnabled = true,
  permissions = {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canShare: true,
    canExport: true
  },
  onWebSocketEvent
}) => {
  // Store hooks
  const {
    collaborationState,
    conflicts,
    isLoading,
    error,
    addOptimisticUpdate,
    updateAnnotation,
    lockAnnotation,
    unlockAnnotation,
    canUserEdit,
    canUserDelete,
    handleWebSocketEvent
  } = useAnnotationStore();

  // Local state
  const [mode, setMode] = useState<AnnotationType | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<EnhancedAnnotation | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; annotation: EnhancedAnnotation } | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [permissionManagerOpen, setPermissionManagerOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [activeConflict, setActiveConflict] = useState<AnnotationConflict | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });

  const annotationGroup = useRef<SVGGElement | null>(null);
  const tempAnnotation = useRef<SVGElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<SVGGElement | null>(null);

  // Filter annotations for current chart
  const chartAnnotations = useMemo(() => 
    annotations.filter(a => a.chartId === chartId),
    [annotations, chartId]
  );

  // Active users in this chart
  const activeUsers = useMemo(() => 
    collaborationState.activeUsers.filter(u => u.userId !== currentUserId),
    [collaborationState.activeUsers, currentUserId]
  );

  /**
   * Handle WebSocket events
   */
  useEffect(() => {
    if (onWebSocketEvent) {
      const unsubscribe = useAnnotationStore.subscribe(
        state => state,
        () => {
          // Handle real-time updates
        }
      );
      return unsubscribe;
    }
  }, [onWebSocketEvent]);

  /**
   * Handle conflicts
   */
  useEffect(() => {
    if (conflicts.length > 0 && !conflictDialogOpen) {
      const latestConflict = conflicts[conflicts.length - 1];
      setActiveConflict(latestConflict);
      setConflictDialogOpen(true);
      
      if (onConflict) {
        onConflict(latestConflict);
      }
    }
  }, [conflicts, conflictDialogOpen, onConflict]);

  /**
   * Initialize annotation layer
   */
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const g = d3.select(containerRef.current);
    
    // Create annotation group if it doesn't exist
    let group = g.select('.enhanced-annotation-layer');
    if (group.empty()) {
      group = g.append('g')
        .attr('class', 'enhanced-annotation-layer')
        .style('pointer-events', mode ? 'all' : 'none');
    }
    
    annotationGroup.current = group.node() as SVGGElement;

    // Setup event handlers when in drawing mode
    if (mode && permissions.canCreate) {
      const svgSelection = d3.select(svgRef.current);
      
      svgSelection
        .style('cursor', 'crosshair')
        .on('mousedown.annotation', handleMouseDown)
        .on('mousemove.annotation', handleMouseMove)
        .on('mouseup.annotation', handleMouseUp)
        .on('contextmenu.annotation', (event) => event.preventDefault());
    } else {
      const svgSelection = d3.select(svgRef.current);
      svgSelection
        .style('cursor', 'default')
        .on('mousedown.annotation', null)
        .on('mousemove.annotation', null)
        .on('mouseup.annotation', null)
        .on('contextmenu.annotation', null);
    }

    return () => {
      if (svgRef.current) {
        const svgSelection = d3.select(svgRef.current);
        svgSelection
          .on('mousedown.annotation', null)
          .on('mousemove.annotation', null)
          .on('mouseup.annotation', null)
          .on('contextmenu.annotation', null);
      }
    };
  }, [mode, permissions.canCreate]);

  /**
   * Render annotations with enhanced features
   */
  useEffect(() => {
    if (!annotationGroup.current) return;

    const g = d3.select(annotationGroup.current);
    
    // Clear existing annotations
    g.selectAll('.enhanced-annotation').remove();

    // Render each annotation
    chartAnnotations.forEach(annotation => {
      const annotationElement = g.append('g')
        .attr('class', 'enhanced-annotation')
        .attr('data-annotation-id', annotation.id)
        .style('cursor', canUserEdit(annotation.id, currentUserId) ? 'move' : 'default')
        .style('opacity', annotation.locked && annotation.lockedBy !== currentUserId ? 0.6 : 1);

      renderEnhancedAnnotation(annotationElement, annotation);

      // Add interaction handlers
      annotationElement
        .on('contextmenu', (event) => {
          event.preventDefault();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            annotation
          });
        })
        .on('click', () => {
          setSelectedAnnotation(annotation);
          
          // Notify collaboration system
          if (collaborationEnabled) {
            handleWebSocketEvent({
              type: 'selection.changed',
              annotationId: annotation.id,
              userId: currentUserId,
              timestamp: Date.now(),
              data: {
                selection: {
                  userId: currentUserId,
                  annotationId: annotation.id,
                  timestamp: Date.now()
                }
              }
            });
          }
        });

      // Draggable support with lock checking
      if (annotation.draggable && canUserEdit(annotation.id, currentUserId)) {
        const drag = d3.drag()
          .on('start', (event) => handleDragStart(event, annotation))
          .on('drag', (event) => handleDrag(event, annotation))
          .on('end', (event) => handleDragEnd(event, annotation));

        annotationElement.call(drag as any);
      }

      // Add lock indicator
      if (annotation.locked && annotation.lockedBy !== currentUserId) {
        const lockedUser = collaborationState.activeUsers.find(u => u.userId === annotation.lockedBy);
        annotationElement.append('g')
          .attr('class', 'lock-indicator')
          .attr('transform', `translate(${annotation.x + 10}, ${annotation.y - 10})`)
          .append('text')
          .text(`🔒 ${lockedUser?.userName || annotation.lockedBy}`)
          .style('font-size', '10px')
          .style('fill', '#ff9800');
      }

      // Add version indicator
      if (annotation.version > 1) {
        annotationElement.append('circle')
          .attr('cx', annotation.x + 15)
          .attr('cy', annotation.y - 15)
          .attr('r', 8)
          .style('fill', '#1976d2')
          .style('stroke', 'white')
          .style('stroke-width', 2);
        
        annotationElement.append('text')
          .attr('x', annotation.x + 15)
          .attr('y', annotation.y - 11)
          .text(annotation.version)
          .style('fill', 'white')
          .style('font-size', '10px')
          .style('text-anchor', 'middle')
          .style('dominant-baseline', 'middle');
      }
    });
  }, [chartAnnotations, currentUserId, collaborationEnabled, collaborationState.activeUsers]);

  /**
   * Enhanced annotation rendering
   */
  const renderEnhancedAnnotation = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>, 
    annotation: EnhancedAnnotation
  ) => {
    const { type, x, y, x2, y2, text, title, style = {} } = annotation;

    // Base annotation rendering (reuse existing logic)
    switch (type) {
      case 'point':
        g.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', style.radius || 6)
          .style('fill', style.fill || '#2196f3')
          .style('stroke', style.stroke || '#fff')
          .style('stroke-width', style.strokeWidth || 2);
        break;
        
      case 'line':
        g.append('line')
          .attr('x1', x)
          .attr('y1', y)
          .attr('x2', x2 || x)
          .attr('y2', y2 || y)
          .style('stroke', style.stroke || '#2196f3')
          .style('stroke-width', style.strokeWidth || 2)
          .style('stroke-dasharray', style.strokeDasharray);
        break;
        
      case 'arrow':
        g.append('line')
          .attr('x1', x)
          .attr('y1', y)
          .attr('x2', x2 || x)
          .attr('y2', y2 || y)
          .style('stroke', style.stroke || '#2196f3')
          .style('stroke-width', style.strokeWidth || 2);
        
        // Add arrowhead
        const angle = Math.atan2((y2 || y) - y, (x2 || x) - x);
        const arrowSize = 10;
        
        g.append('path')
          .attr('d', `M ${x2 || x} ${y2 || y} 
                      L ${(x2 || x) - arrowSize * Math.cos(angle - Math.PI / 6)} ${(y2 || y) - arrowSize * Math.sin(angle - Math.PI / 6)}
                      L ${(x2 || x) - arrowSize * Math.cos(angle + Math.PI / 6)} ${(y2 || y) - arrowSize * Math.sin(angle + Math.PI / 6)}
                      Z`)
          .style('fill', style.stroke || '#2196f3');
        break;
        
      case 'rect':
        const rectX = Math.min(x, x2 || x);
        const rectY = Math.min(y, y2 || y);
        const rectWidth = Math.abs((x2 || x) - x);
        const rectHeight = Math.abs((y2 || y) - y);
        
        g.append('rect')
          .attr('x', rectX)
          .attr('y', rectY)
          .attr('width', rectWidth)
          .attr('height', rectHeight)
          .style('fill', style.fill || '#2196f3')
          .style('fill-opacity', style.fillOpacity || 0.2)
          .style('stroke', style.stroke || '#2196f3')
          .style('stroke-width', style.strokeWidth || 2);
        break;
        
      case 'text':
        const textGroup = g.append('g');
        
        // Add background for better readability
        if (title) {
          const titleText = textGroup.append('text')
            .attr('x', x)
            .attr('y', y - 5)
            .text(title)
            .style('fill', style.fill || '#333')
            .style('font-size', '12px')
            .style('font-weight', 'bold')
            .style('text-anchor', style.textAnchor || 'start');
            
          const bbox = (titleText.node() as SVGTextElement).getBBox();
          textGroup.insert('rect', 'text')
            .attr('x', bbox.x - 4)
            .attr('y', bbox.y - 2)
            .attr('width', bbox.width + 8)
            .attr('height', bbox.height + 4)
            .style('fill', 'white')
            .style('fill-opacity', 0.8)
            .style('stroke', style.stroke || '#2196f3')
            .style('stroke-width', 1)
            .style('rx', 4);
        }
        
        if (text) {
          textGroup.append('text')
            .attr('x', x)
            .attr('y', y + (title ? 10 : 0))
            .text(text)
            .style('fill', style.fill || '#666')
            .style('font-size', style.fontSize || '11px')
            .style('text-anchor', style.textAnchor || 'start');
        }
        break;
    }

    // Add severity indicator
    if (annotation.severity) {
      const severityColors = {
        info: '#2196f3',
        warning: '#ff9800',
        critical: '#f44336',
        success: '#4caf50'
      };
      
      g.append('circle')
        .attr('cx', x - 10)
        .attr('cy', y - 10)
        .attr('r', 4)
        .style('fill', severityColors[annotation.severity])
        .style('stroke', 'white')
        .style('stroke-width', 1);
    }

    // Add hover effect
    g.on('mouseenter', function() {
        d3.select(this).style('opacity', 0.8);
      })
      .on('mouseleave', function() {
        d3.select(this).style('opacity', annotation.locked && annotation.lockedBy !== currentUserId ? 0.6 : 1);
      });
  };

  /**
   * Handle drag start with locking
   */
  const handleDragStart = (event: any, annotation: EnhancedAnnotation) => {
    if (!annotation.locked || annotation.lockedBy === currentUserId) {
      // Lock annotation for editing
      lockAnnotation(annotation.id, currentUserId, currentUserName);
      d3.select(event.sourceEvent.currentTarget).style('cursor', 'grabbing');
      
      // Notify via WebSocket
      if (collaborationEnabled) {
        handleWebSocketEvent({
          type: 'annotation.locked',
          annotationId: annotation.id,
          userId: currentUserId,
          timestamp: Date.now(),
          data: { userName: currentUserName }
        });
      }
    }
  };

  /**
   * Handle drag with optimistic updates
   */
  const handleDrag = (event: any, annotation: EnhancedAnnotation) => {
    if (annotation.locked && annotation.lockedBy !== currentUserId) return;

    const dx = event.dx;
    const dy = event.dy;

    const updated: EnhancedAnnotation = {
      ...annotation,
      x: annotation.x + dx,
      y: annotation.y + dy,
      updatedAt: Date.now(),
      updatedBy: currentUserId
    };

    if (annotation.x2 !== undefined) {
      updated.x2 = annotation.x2 + dx;
    }
    if (annotation.y2 !== undefined) {
      updated.y2 = annotation.y2 + dy;
    }

    // Optimistic update
    updateAnnotation(annotation.id, updated);
  };

  /**
   * Handle drag end with unlock
   */
  const handleDragEnd = (event: any, annotation: EnhancedAnnotation) => {
    d3.select(event.sourceEvent.currentTarget).style('cursor', 'move');
    
    // Unlock annotation
    unlockAnnotation(annotation.id);
    
    // Notify via WebSocket
    if (collaborationEnabled) {
      handleWebSocketEvent({
        type: 'annotation.unlocked',
        annotationId: annotation.id,
        userId: currentUserId,
        timestamp: Date.now()
      });
    }
    
    // Persist changes
    onAnnotationChange('updated', annotation);
  };

  /**
   * Handle mouse down for drawing
   */
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!mode || !annotationGroup.current || !permissions.canCreate) return;

    const [x, y] = d3.pointer(event, annotationGroup.current);
    setIsDrawing(true);
    setDrawingStart({ x, y });

    // Create temporary annotation element
    const g = d3.select(annotationGroup.current);
    
    switch (mode) {
      case 'point':
        tempAnnotation.current = g.append('circle')
          .attr('class', 'temp-annotation')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', 6)
          .style('fill', '#2196f3')
          .style('opacity', 0.6)
          .node();
        break;
        
      case 'line':
      case 'arrow':
        tempAnnotation.current = g.append('line')
          .attr('class', 'temp-annotation')
          .attr('x1', x)
          .attr('y1', y)
          .attr('x2', x)
          .attr('y2', y)
          .style('stroke', '#2196f3')
          .style('stroke-width', 2)
          .style('opacity', 0.6)
          .node();
        break;
        
      case 'rect':
        tempAnnotation.current = g.append('rect')
          .attr('class', 'temp-annotation')
          .attr('x', x)
          .attr('y', y)
          .attr('width', 0)
          .attr('height', 0)
          .style('fill', '#2196f3')
          .style('fill-opacity', 0.2)
          .style('stroke', '#2196f3')
          .style('stroke-width', 2)
          .node();
        break;
        
      case 'text':
        tempAnnotation.current = g.append('text')
          .attr('class', 'temp-annotation')
          .attr('x', x)
          .attr('y', y)
          .text('Click to add text...')
          .style('fill', '#2196f3')
          .style('font-size', '14px')
          .node();
        break;
    }
  }, [mode, permissions.canCreate]);

  /**
   * Handle mouse move for drawing
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDrawing || !tempAnnotation.current || !drawingStart || !annotationGroup.current) return;

    const [x, y] = d3.pointer(event, annotationGroup.current);
    const element = d3.select(tempAnnotation.current);

    switch (mode) {
      case 'line':
      case 'arrow':
        element
          .attr('x2', x)
          .attr('y2', y);
        break;
        
      case 'rect':
        const width = Math.abs(x - drawingStart.x);
        const height = Math.abs(y - drawingStart.y);
        const rectX = Math.min(x, drawingStart.x);
        const rectY = Math.min(y, drawingStart.y);
        
        element
          .attr('x', rectX)
          .attr('y', rectY)
          .attr('width', width)
          .attr('height', height);
        break;
    }

    // Update cursor position for collaboration
    if (collaborationEnabled) {
      handleWebSocketEvent({
        type: 'cursor.moved',
        annotationId: '',
        userId: currentUserId,
        timestamp: Date.now(),
        data: {
          cursor: {
            userId: currentUserId,
            x,
            y,
            timestamp: Date.now()
          }
        }
      });
    }
  }, [isDrawing, mode, drawingStart, collaborationEnabled, currentUserId]);

  /**
   * Handle mouse up for drawing
   */
  const handleMouseUp = useCallback((event: MouseEvent) => {
    if (!isDrawing || !mode || !drawingStart || !annotationGroup.current) return;

    const [x, y] = d3.pointer(event, annotationGroup.current);
    
    // Remove temporary annotation
    if (tempAnnotation.current) {
      d3.select(tempAnnotation.current).remove();
      tempAnnotation.current = null;
    }

    // Create new enhanced annotation
    const newAnnotation: EnhancedAnnotation = {
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: mode,
      chartId,
      telemetryStreamId,
      x: drawingStart.x,
      y: drawingStart.y,
      editable: true,
      draggable: true,
      style: {
        fill: '#2196f3',
        stroke: '#2196f3',
        strokeWidth: 2
      },
      version: 1,
      createdAt: Date.now(),
      createdBy: currentUserId,
      updatedAt: Date.now(),
      updatedBy: currentUserId,
      permissions: {
        owner: currentUserId,
        public: false,
        roles: {},
        users: {
          [currentUserId]: {
            canView: true,
            canEdit: true,
            canDelete: true,
            canShare: true
          }
        }
      }
    };

    // Set additional properties based on type
    switch (mode) {
      case 'line':
      case 'arrow':
        newAnnotation.x2 = x;
        newAnnotation.y2 = y;
        break;
        
      case 'rect':
        newAnnotation.x2 = x;
        newAnnotation.y2 = y;
        break;
        
      case 'text':
        setSelectedAnnotation(newAnnotation);
        setEditText('');
        setEditTitle('');
        setEditTags([]);
        setEditDialogOpen(true);
        setIsDrawing(false);
        setDrawingStart(null);
        return;
    }

    // Add annotation with optimistic update
    addOptimisticUpdate(newAnnotation);
    onAnnotationChange('created', newAnnotation);
    
    // Reset drawing state
    setIsDrawing(false);
    setDrawingStart(null);
    setMode(null);
    
    // Show success message
    setSnackbar({
      open: true,
      message: 'Annotation created successfully',
      severity: 'success'
    });
  }, [isDrawing, mode, drawingStart, chartId, telemetryStreamId, currentUserId, onAnnotationChange]);

  /**
   * Handle edit dialog save
   */
  const handleEditSave = () => {
    if (selectedAnnotation) {
      const updated: EnhancedAnnotation = {
        ...selectedAnnotation,
        text: editText,
        title: editTitle,
        tags: editTags,
        updatedAt: Date.now(),
        updatedBy: currentUserId,
        version: selectedAnnotation.version + 1
      };
      
      // Lock annotation during edit
      lockAnnotation(selectedAnnotation.id, currentUserId, currentUserName);
      
      // Update with optimistic update
      updateAnnotation(selectedAnnotation.id, updated);
      
      // Persist changes
      onAnnotationChange(
        chartAnnotations.find(a => a.id === selectedAnnotation.id) ? 'updated' : 'created',
        updated
      );
      
      // Unlock after save
      unlockAnnotation(selectedAnnotation.id);
    }
    
    setEditDialogOpen(false);
    setSelectedAnnotation(null);
    setEditText('');
    setEditTitle('');
    setEditTags([]);
  };

  /**
   * Handle delete annotation
   */
  const handleDelete = (annotation: EnhancedAnnotation) => {
    if (canUserDelete(annotation.id, currentUserId)) {
      onAnnotationChange('deleted', annotation);
      setContextMenu(null);
      
      setSnackbar({
        open: true,
        message: 'Annotation deleted successfully',
        severity: 'success'
      });
    } else {
      setSnackbar({
        open: true,
        message: 'You do not have permission to delete this annotation',
        severity: 'error'
      });
    }
  };

  return (
    <>
      {/* Reference to SVG and container */}
      <g ref={containerRef} />
      
      {/* Collaboration Cursors */}
      {collaborationEnabled && (
        <CollaborationCursors
          cursors={collaborationState.cursors}
          users={collaborationState.activeUsers}
          currentUserId={currentUserId}
        />
      )}

      {/* Enhanced Annotation Toolbar */}
      <AnimatePresence>
        {permissions.canCreate && (
          <AnnotationToolbar
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ToggleButtonGroup
              size="small"
              value={mode}
              exclusive
              onChange={(_, value) => setMode(value)}
            >
              <ToggleButton value="point">
                <Tooltip title="Add point annotation">
                  <PointIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="line">
                <Tooltip title="Add line annotation">
                  <LineIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="arrow">
                <Tooltip title="Add arrow annotation">
                  <ArrowIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="rect">
                <Tooltip title="Add rectangle annotation">
                  <RectIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="text">
                <Tooltip title="Add text annotation">
                  <TextIcon fontSize="small" />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem />

            {/* Collaboration Indicator */}
            {collaborationEnabled && (
              <CollaborationIndicator>
                <Tooltip title="Active collaborators">
                  <AvatarGroup max={3} spacing="small">
                    {activeUsers.map(user => (
                      <Avatar
                        key={user.userId}
                        sx={{ 
                          width: 24, 
                          height: 24, 
                          bgcolor: user.color,
                          fontSize: 12
                        }}
                      >
                        {user.userName.charAt(0).toUpperCase()}
                      </Avatar>
                    ))}
                  </AvatarGroup>
                </Tooltip>
                
                {/* Sync Status */}
                <Tooltip title={isLoading ? "Syncing..." : "Synced"}>
                  <IconButton size="small">
                    {isLoading ? (
                      <CircularProgress size={16} />
                    ) : error ? (
                      <OfflineIcon fontSize="small" color="error" />
                    ) : (
                      <SyncIcon fontSize="small" color="success" />
                    )}
                  </IconButton>
                </Tooltip>
              </CollaborationIndicator>
            )}
          </AnnotationToolbar>
        )}
      </AnimatePresence>

      {/* Enhanced Context Menu */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined
        }
      >
        {contextMenu && canUserEdit(contextMenu.annotation.id, currentUserId) && (
          <MenuItem onClick={() => {
            setSelectedAnnotation(contextMenu.annotation);
            setEditText(contextMenu.annotation.text || '');
            setEditTitle(contextMenu.annotation.title || '');
            setEditTags(contextMenu.annotation.tags || []);
            setEditDialogOpen(true);
            setContextMenu(null);
          }}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        
        {contextMenu && (
          <MenuItem onClick={() => {
            setSelectedAnnotation(contextMenu.annotation);
            setVersionHistoryOpen(true);
            setContextMenu(null);
          }}>
            <VersionBadge badgeContent={contextMenu.annotation.version}>
              <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
            </VersionBadge>
            Version History
          </MenuItem>
        )}
        
        {contextMenu && permissions.canShare && (
          <MenuItem onClick={() => {
            setSelectedAnnotation(contextMenu.annotation);
            setPermissionManagerOpen(true);
            setContextMenu(null);
          }}>
            <PeopleIcon fontSize="small" sx={{ mr: 1 }} />
            Manage Permissions
          </MenuItem>
        )}
        
        <Divider />
        
        {contextMenu && canUserDelete(contextMenu.annotation.id, currentUserId) && (
          <MenuItem onClick={() => {
            handleDelete(contextMenu.annotation);
          }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} color="error" />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Enhanced Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedAnnotation && chartAnnotations.find(a => a.id === selectedAnnotation.id) 
            ? 'Edit Annotation' 
            : 'Add Annotation'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Tags
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {editTags.map((tag, index) => (
                  <Chip
                    key={index}
                    label={tag}
                    size="small"
                    onDelete={() => setEditTags(editTags.filter((_, i) => i !== index))}
                  />
                ))}
                <TextField
                  size="small"
                  placeholder="Add tag..."
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.target as HTMLInputElement;
                      if (input.value.trim()) {
                        setEditTags([...editTags, input.value.trim()]);
                        input.value = '';
                      }
                    }
                  }}
                />
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Version History Dialog */}
      {selectedAnnotation && (
        <VersionHistoryDialog
          open={versionHistoryOpen}
          onClose={() => setVersionHistoryOpen(false)}
          annotation={selectedAnnotation}
          onRevert={(version) => {
            // Handle version revert
            setVersionHistoryOpen(false);
          }}
        />
      )}

      {/* Permission Manager Dialog */}
      {selectedAnnotation && (
        <PermissionManagerDialog
          open={permissionManagerOpen}
          onClose={() => setPermissionManagerOpen(false)}
          annotation={selectedAnnotation}
          currentUserId={currentUserId}
          onUpdate={(permissions) => {
            // Handle permission update
            setPermissionManagerOpen(false);
          }}
        />
      )}

      {/* Conflict Resolution Dialog */}
      {activeConflict && (
        <ConflictResolutionDialog
          open={conflictDialogOpen}
          onClose={() => setConflictDialogOpen(false)}
          conflict={activeConflict}
          onResolve={(resolution) => {
            // Handle conflict resolution
            setConflictDialogOpen(false);
            setActiveConflict(null);
          }}
        />
      )}

      {/* Conflict Alert */}
      {conflicts.length > 0 && !conflictDialogOpen && (
        <ConflictAlert 
          severity="warning"
          action={
            <Button 
              size="small" 
              onClick={() => {
                setActiveConflict(conflicts[0]);
                setConflictDialogOpen(true);
              }}
            >
              Resolve
            </Button>
          }
        >
          <Typography variant="body2">
            {conflicts.length} annotation conflict{conflicts.length > 1 ? 's' : ''} detected
          </Typography>
        </ConflictAlert>
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};