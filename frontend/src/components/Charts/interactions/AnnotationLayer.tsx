/**
 * Annotation Layer for interactive chart annotations
 * Supports point, line, rect, text, and arrow annotations
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { AnnotationConfig, Annotation } from './types';
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
  Box
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Circle as PointIcon,
  Timeline as LineIcon,
  CropSquare as RectIcon,
  TextFields as TextIcon,
  TrendingFlat as ArrowIcon
} from '@mui/icons-material';

// Styled components
const AnnotationToolbar = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  @media (prefers-color-scheme: dark) {
    background: rgba(42, 42, 42, 0.9);
    border-color: #444;
  }
`;

interface AnnotationLayerProps {
  svg: SVGSVGElement;
  container: SVGGElement;
  annotations: Annotation[];
  scales: {
    xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
  };
  dimensions: { width: number; height: number; margin: any };
  config: AnnotationConfig;
  onAnnotationChange: (action: 'add' | 'edit' | 'delete', annotation: Annotation) => void;
}

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  svg,
  container,
  annotations,
  scales,
  dimensions,
  config,
  onAnnotationChange
}) => {
  const [mode, setMode] = useState<Annotation['type'] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editText, setEditText] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; annotation: Annotation } | null>(null);
  
  const annotationGroup = useRef<SVGGElement | null>(null);
  const tempAnnotation = useRef<SVGElement | null>(null);

  /**
   * Initialize annotation layer
   */
  useEffect(() => {
    if (!config.enabled) return;

    const g = d3.select(container);
    
    // Create annotation group if it doesn't exist
    let group = g.select('.annotation-layer');
    if (group.empty()) {
      group = g.append('g')
        .attr('class', 'annotation-layer')
        .style('pointer-events', mode ? 'all' : 'none');
    }
    
    annotationGroup.current = group.node() as SVGGElement;

    // Setup event handlers when in drawing mode
    if (mode) {
      const svgSelection = d3.select(svg);
      
      svgSelection
        .style('cursor', 'crosshair')
        .on('mousedown.annotation', handleMouseDown)
        .on('mousemove.annotation', handleMouseMove)
        .on('mouseup.annotation', handleMouseUp)
        .on('contextmenu.annotation', (event) => event.preventDefault());
    } else {
      const svgSelection = d3.select(svg);
      svgSelection
        .style('cursor', 'default')
        .on('mousedown.annotation', null)
        .on('mousemove.annotation', null)
        .on('mouseup.annotation', null)
        .on('contextmenu.annotation', null);
    }

    return () => {
      const svgSelection = d3.select(svg);
      svgSelection
        .on('mousedown.annotation', null)
        .on('mousemove.annotation', null)
        .on('mouseup.annotation', null)
        .on('contextmenu.annotation', null);
    };
  }, [config.enabled, mode, svg, container]);

  /**
   * Render annotations
   */
  useEffect(() => {
    if (!annotationGroup.current) return;

    const g = d3.select(annotationGroup.current);
    
    // Clear existing annotations
    g.selectAll('.annotation').remove();

    // Render each annotation
    annotations.forEach(annotation => {
      const annotationElement = g.append('g')
        .attr('class', 'annotation')
        .attr('data-annotation-id', annotation.id)
        .style('cursor', annotation.editable ? 'move' : 'default');

      renderAnnotation(annotationElement, annotation);

      // Add interaction handlers
      if (annotation.editable || config.onEdit || config.onDelete) {
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
          });

        // Draggable support
        if (annotation.draggable) {
          const drag = d3.drag()
            .on('start', handleDragStart)
            .on('drag', (event) => handleDrag(event, annotation))
            .on('end', handleDragEnd);

          annotationElement.call(drag as any);
        }
      }
    });
  }, [annotations, annotationGroup.current, scales]);

  /**
   * Handle mouse down for drawing
   */
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!mode || !annotationGroup.current) return;

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
  }, [mode]);

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
  }, [isDrawing, mode, drawingStart]);

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

    // Create new annotation
    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      type: mode,
      x: drawingStart.x,
      y: drawingStart.y,
      editable: true,
      draggable: true,
      style: {
        fill: '#2196f3',
        stroke: '#2196f3',
        strokeWidth: 2
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
        setEditDialogOpen(true);
        setIsDrawing(false);
        setDrawingStart(null);
        return;
    }

    // Add annotation
    onAnnotationChange('add', newAnnotation);
    
    // Reset drawing state
    setIsDrawing(false);
    setDrawingStart(null);
    setMode(null);
  }, [isDrawing, mode, drawingStart, onAnnotationChange]);

  /**
   * Render individual annotation
   */
  const renderAnnotation = (g: d3.Selection<SVGGElement, unknown, null, undefined>, annotation: Annotation) => {
    const { type, x, y, x2, y2, text, style = {} } = annotation;

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
        const line = g.append('line')
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
        g.append('text')
          .attr('x', x)
          .attr('y', y)
          .text(text || '')
          .style('fill', style.fill || '#333')
          .style('font-size', style.fontSize || '14px')
          .style('font-weight', style.fontWeight)
          .style('text-anchor', style.textAnchor || 'start');
        break;
    }

    // Add hover effect
    g.on('mouseenter', function() {
        d3.select(this).style('opacity', 0.8);
      })
      .on('mouseleave', function() {
        d3.select(this).style('opacity', 1);
      });
  };

  /**
   * Handle drag start
   */
  const handleDragStart = (event: any) => {
    d3.select(event.sourceEvent.currentTarget).style('cursor', 'grabbing');
  };

  /**
   * Handle drag
   */
  const handleDrag = (event: any, annotation: Annotation) => {
    const dx = event.dx;
    const dy = event.dy;

    const updated: Annotation = {
      ...annotation,
      x: annotation.x + dx,
      y: annotation.y + dy
    };

    if (annotation.x2 !== undefined) {
      updated.x2 = annotation.x2 + dx;
    }
    if (annotation.y2 !== undefined) {
      updated.y2 = annotation.y2 + dy;
    }

    onAnnotationChange('edit', updated);
  };

  /**
   * Handle drag end
   */
  const handleDragEnd = (event: any) => {
    d3.select(event.sourceEvent.currentTarget).style('cursor', 'move');
  };

  /**
   * Handle edit dialog save
   */
  const handleEditSave = () => {
    if (selectedAnnotation) {
      const updated: Annotation = {
        ...selectedAnnotation,
        text: editText
      };
      
      onAnnotationChange(
        annotations.find(a => a.id === selectedAnnotation.id) ? 'edit' : 'add',
        updated
      );
    }
    
    setEditDialogOpen(false);
    setSelectedAnnotation(null);
    setEditText('');
  };

  /**
   * Handle delete annotation
   */
  const handleDelete = (annotation: Annotation) => {
    onAnnotationChange('delete', annotation);
    setContextMenu(null);
  };

  return (
    <>
      {/* Annotation Toolbar */}
      {config.toolbar !== false && (
        <AnnotationToolbar>
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
        </AnnotationToolbar>
      )}

      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenu)}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined
        }
      >
        {config.onEdit && (
          <MenuItem onClick={() => {
            if (contextMenu) {
              setSelectedAnnotation(contextMenu.annotation);
              setEditText(contextMenu.annotation.text || '');
              setEditDialogOpen(true);
              setContextMenu(null);
            }
          }}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {config.onDelete && (
          <MenuItem onClick={() => {
            if (contextMenu) {
              handleDelete(contextMenu.annotation);
            }
          }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedAnnotation && annotations.find(a => a.id === selectedAnnotation.id) 
            ? 'Edit Annotation' 
            : 'Add Annotation'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Annotation Text"
            fullWidth
            multiline
            rows={3}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};