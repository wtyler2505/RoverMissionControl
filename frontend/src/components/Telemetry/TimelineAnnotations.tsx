/**
 * TimelineAnnotations - Event markers and annotations for timeline visualization
 * Supports adding, editing, and displaying annotations on the playback timeline
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Box,
  Tooltip,
  IconButton,
  Popover,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Chip,
  Stack,
  Divider,
  alpha
} from '@mui/material';
import {
  Flag,
  Error,
  Warning,
  Info,
  CheckCircle,
  Add,
  Edit,
  Delete,
  Close,
  Event,
  Label,
  Bookmark
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

/**
 * Annotation types
 */
export enum AnnotationType {
  MARKER = 'marker',
  EVENT = 'event',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  SUCCESS = 'success',
  BOOKMARK = 'bookmark'
}

/**
 * Timeline annotation
 */
export interface TimelineAnnotation {
  id: string;
  timestamp: number;
  type: AnnotationType;
  title: string;
  description?: string;
  color?: string;
  streamId?: string;
  tags?: string[];
  createdBy?: string;
  createdAt?: number;
}

/**
 * Props for TimelineAnnotations
 */
export interface TimelineAnnotationsProps {
  annotations: TimelineAnnotation[];
  startTime: number;
  endTime: number;
  currentTime: number;
  onAnnotationClick?: (annotationId: string) => void;
  onAnnotationAdd?: (annotation: TimelineAnnotation) => void;
  onAnnotationUpdate?: (annotation: TimelineAnnotation) => void;
  onAnnotationDelete?: (id: string) => void;
  zoomLevel?: number;
  height?: number;
  editable?: boolean;
}

/**
 * Styled components
 */
const AnnotationsContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  overflow: 'hidden'
}));

const AnnotationMarker = styled(Box)<{ $type: AnnotationType; $active?: boolean }>(
  ({ theme, $type, $active }) => {
    const getColor = () => {
      switch ($type) {
        case AnnotationType.ERROR: return theme.palette.error.main;
        case AnnotationType.WARNING: return theme.palette.warning.main;
        case AnnotationType.INFO: return theme.palette.info.main;
        case AnnotationType.SUCCESS: return theme.palette.success.main;
        case AnnotationType.BOOKMARK: return theme.palette.secondary.main;
        default: return theme.palette.primary.main;
      }
    };

    const color = getColor();

    return {
      position: 'absolute',
      top: 0,
      width: 2,
      height: '100%',
      background: color,
      pointerEvents: 'auto',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      zIndex: $active ? 10 : 1,
      
      '&::before': {
        content: '""',
        position: 'absolute',
        top: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `8px solid ${color}`
      },
      
      '&:hover': {
        width: 4,
        boxShadow: `0 0 8px ${alpha(color, 0.5)}`,
        zIndex: 11
      }
    };
  }
);

const AnnotationTooltipContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1),
  maxWidth: 300
}));

const AddAnnotationButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  pointerEvents: 'auto',
  opacity: 0,
  transition: 'opacity 0.2s ease',
  
  '&:hover': {
    background: theme.palette.action.hover
  }
}));

const TimelineOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
  
  '&:hover': {
    [`& ${AddAnnotationButton}`]: {
      opacity: 1
    }
  }
}));

/**
 * Get icon for annotation type
 */
const getAnnotationIcon = (type: AnnotationType) => {
  switch (type) {
    case AnnotationType.ERROR: return <Error fontSize="small" />;
    case AnnotationType.WARNING: return <Warning fontSize="small" />;
    case AnnotationType.INFO: return <Info fontSize="small" />;
    case AnnotationType.SUCCESS: return <CheckCircle fontSize="small" />;
    case AnnotationType.EVENT: return <Event fontSize="small" />;
    case AnnotationType.BOOKMARK: return <Bookmark fontSize="small" />;
    default: return <Flag fontSize="small" />;
  }
};

/**
 * Annotation editor dialog
 */
const AnnotationEditor: React.FC<{
  annotation?: TimelineAnnotation;
  timestamp: number;
  onSave: (annotation: Omit<TimelineAnnotation, 'id'>) => void;
  onClose: () => void;
}> = ({ annotation, timestamp, onSave, onClose }) => {
  const [type, setType] = useState<AnnotationType>(annotation?.type || AnnotationType.MARKER);
  const [title, setTitle] = useState(annotation?.title || '');
  const [description, setDescription] = useState(annotation?.description || '');
  const [tags, setTags] = useState(annotation?.tags?.join(', ') || '');

  const handleSave = () => {
    if (!title.trim()) return;

    onSave({
      timestamp: annotation?.timestamp || timestamp,
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      createdAt: annotation?.createdAt || Date.now()
    });
  };

  return (
    <Box sx={{ p: 2, minWidth: 300 }}>
      <Typography variant="h6" gutterBottom>
        {annotation ? 'Edit Annotation' : 'Add Annotation'}
      </Typography>

      <Stack spacing={2}>
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as AnnotationType)}
            label="Type"
          >
            <MenuItem value={AnnotationType.MARKER}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Flag fontSize="small" />
                <span>Marker</span>
              </Stack>
            </MenuItem>
            <MenuItem value={AnnotationType.EVENT}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Event fontSize="small" />
                <span>Event</span>
              </Stack>
            </MenuItem>
            <MenuItem value={AnnotationType.ERROR}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Error fontSize="small" color="error" />
                <span>Error</span>
              </Stack>
            </MenuItem>
            <MenuItem value={AnnotationType.WARNING}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Warning fontSize="small" color="warning" />
                <span>Warning</span>
              </Stack>
            </MenuItem>
            <MenuItem value={AnnotationType.INFO}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Info fontSize="small" color="info" />
                <span>Info</span>
              </Stack>
            </MenuItem>
            <MenuItem value={AnnotationType.SUCCESS}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircle fontSize="small" color="success" />
                <span>Success</span>
              </Stack>
            </MenuItem>
            <MenuItem value={AnnotationType.BOOKMARK}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Bookmark fontSize="small" color="secondary" />
                <span>Bookmark</span>
              </Stack>
            </MenuItem>
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          required
          autoFocus
        />

        <TextField
          size="small"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          multiline
          rows={2}
        />

        <TextField
          size="small"
          label="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          fullWidth
          placeholder="tag1, tag2, tag3"
        />

        <Typography variant="caption" color="text.secondary">
          Time: {new Date(annotation?.timestamp || timestamp).toLocaleTimeString()}
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button onClick={onClose} size="small">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            size="small"
            disabled={!title.trim()}
          >
            Save
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

/**
 * TimelineAnnotations component
 */
export const TimelineAnnotations: React.FC<TimelineAnnotationsProps> = ({
  annotations,
  startTime,
  endTime,
  currentTime,
  onAnnotationClick,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  zoomLevel = 1,
  height = 60,
  editable = true
}) => {
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [editorAnchor, setEditorAnchor] = useState<{
    element: HTMLElement;
    annotation?: TimelineAnnotation;
    timestamp?: number;
  } | null>(null);
  const [addButtonPosition, setAddButtonPosition] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate annotation positions
  const annotationPositions = useMemo(() => {
    const duration = endTime - startTime;
    return annotations.map(annotation => ({
      annotation,
      position: ((annotation.timestamp - startTime) / duration) * 100 * zoomLevel
    }));
  }, [annotations, startTime, endTime, zoomLevel]);

  // Handle timeline hover for add button
  const handleTimelineHover = useCallback((event: React.MouseEvent) => {
    if (!editable || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const timestamp = startTime + (endTime - startTime) * percentage;

    setAddButtonPosition(x);
  }, [editable, startTime, endTime]);

  // Handle add annotation
  const handleAddClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || addButtonPosition === null) return;

    const rect = containerRef.current.getBoundingClientRect();
    const percentage = addButtonPosition / rect.width;
    const timestamp = startTime + (endTime - startTime) * percentage;

    setEditorAnchor({
      element: event.currentTarget as HTMLElement,
      timestamp
    });
  }, [addButtonPosition, startTime, endTime]);

  // Handle annotation click
  const handleAnnotationClick = useCallback((annotation: TimelineAnnotation, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (editable && event.shiftKey) {
      setEditorAnchor({
        element: event.currentTarget as HTMLElement,
        annotation
      });
    } else {
      onAnnotationClick?.(annotation.id);
    }
  }, [editable, onAnnotationClick]);

  // Handle save
  const handleSave = useCallback((annotationData: Omit<TimelineAnnotation, 'id'>) => {
    if (editorAnchor?.annotation) {
      onAnnotationUpdate?.({
        ...editorAnchor.annotation,
        ...annotationData
      });
    } else {
      onAnnotationAdd?.({
        id: `annotation-${Date.now()}`,
        ...annotationData
      } as TimelineAnnotation);
    }
    setEditorAnchor(null);
  }, [editorAnchor, onAnnotationAdd, onAnnotationUpdate]);

  // Handle delete
  const handleDelete = useCallback((annotation: TimelineAnnotation, event: React.MouseEvent) => {
    event.stopPropagation();
    onAnnotationDelete?.(annotation.id);
  }, [onAnnotationDelete]);

  return (
    <TimelineOverlay ref={containerRef} onMouseMove={handleTimelineHover}>
      <AnnotationsContainer>
        {annotationPositions.map(({ annotation, position }) => (
          <Tooltip
            key={annotation.id}
            title={
              <AnnotationTooltipContent>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getAnnotationIcon(annotation.type)}
                    <Typography variant="subtitle2">{annotation.title}</Typography>
                  </Stack>
                  
                  {annotation.description && (
                    <Typography variant="caption" color="text.secondary">
                      {annotation.description}
                    </Typography>
                  )}
                  
                  <Typography variant="caption" color="text.secondary">
                    {new Date(annotation.timestamp).toLocaleTimeString()}
                  </Typography>
                  
                  {annotation.tags && annotation.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5}>
                      {annotation.tags.map(tag => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Stack>
                  )}
                  
                  {editable && (
                    <>
                      <Divider />
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          startIcon={<Edit />}
                          onClick={(e) => handleAnnotationClick(annotation, e)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<Delete />}
                          onClick={(e) => handleDelete(annotation, e)}
                        >
                          Delete
                        </Button>
                      </Stack>
                    </>
                  )}
                </Stack>
              </AnnotationTooltipContent>
            }
            placement="top"
            arrow
          >
            <AnnotationMarker
              $type={annotation.type}
              $active={hoveredAnnotation === annotation.id}
              style={{ left: `${position}%` }}
              onClick={(e) => handleAnnotationClick(annotation, e)}
              onMouseEnter={() => setHoveredAnnotation(annotation.id)}
              onMouseLeave={() => setHoveredAnnotation(null)}
            />
          </Tooltip>
        ))}

        {editable && addButtonPosition !== null && (
          <AddAnnotationButton
            size="small"
            style={{ left: addButtonPosition }}
            onClick={handleAddClick}
          >
            <Add fontSize="small" />
          </AddAnnotationButton>
        )}
      </AnnotationsContainer>

      <Popover
        open={Boolean(editorAnchor)}
        anchorEl={editorAnchor?.element}
        onClose={() => setEditorAnchor(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center'
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
      >
        {editorAnchor && (
          <AnnotationEditor
            annotation={editorAnchor.annotation}
            timestamp={editorAnchor.timestamp || editorAnchor.annotation?.timestamp || currentTime}
            onSave={handleSave}
            onClose={() => setEditorAnchor(null)}
          />
        )}
      </Popover>
    </TimelineOverlay>
  );
};

export default TimelineAnnotations;