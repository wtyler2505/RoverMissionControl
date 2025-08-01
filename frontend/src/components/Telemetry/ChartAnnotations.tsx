/**
 * ChartAnnotations - Annotation layer for charts
 * Renders and manages annotations on data visualization charts
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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
  Switch,
  FormControlLabel,
  alpha,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Close,
  CalloutOutlined,
  VerticalAlignCenter,
  HorizontalRule,
  CropSquare,
  TextFields,
  Timeline,
  Visibility,
  VisibilityOff,
  Download,
  Upload,
  FilterList
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { AnnotationType } from './TimelineAnnotations';
import {
  ChartAnnotation,
  AnchorType,
  ConnectorStyle,
  AnnotationFilter,
  DEFAULT_TEMPLATES
} from '../../types/annotations';
import { getAnnotationService } from '../../services/AnnotationService';

/**
 * Props for ChartAnnotations
 */
export interface ChartAnnotationsProps {
  chartRef: React.RefObject<HTMLCanvasElement>;
  annotations: ChartAnnotation[];
  xScale: (value: number) => number;
  yScale: (value: number) => number;
  xDomain: [number, number];
  yDomain: [number, number];
  onAnnotationClick?: (annotation: ChartAnnotation) => void;
  onAnnotationAdd?: (annotation: ChartAnnotation) => void;
  onAnnotationUpdate?: (annotation: ChartAnnotation) => void;
  onAnnotationDelete?: (id: string) => void;
  editable?: boolean;
  filter?: AnnotationFilter;
  selectedSeriesId?: string;
  height: number;
  width: number;
}

/**
 * Styled components
 */
const AnnotationLayer = styled('svg')({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  overflow: 'visible'
});

const AnnotationGroup = styled('g')<{ $active?: boolean }>(({ $active }) => ({
  cursor: 'pointer',
  pointerEvents: 'auto',
  opacity: $active ? 1 : 0.8,
  transition: 'opacity 0.2s ease',
  
  '&:hover': {
    opacity: 1
  }
}));

const AnnotationText = styled('text')(({ theme }) => ({
  fill: theme.palette.text.primary,
  fontSize: 12,
  userSelect: 'none'
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  display: 'flex',
  gap: theme.spacing(0.5),
  background: alpha(theme.palette.background.paper, 0.9),
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(0.5),
  backdropFilter: 'blur(10px)',
  boxShadow: theme.shadows[2]
}));

/**
 * Annotation editor component
 */
const AnnotationEditor: React.FC<{
  annotation?: ChartAnnotation;
  x: number;
  y: number;
  onSave: (annotation: Partial<ChartAnnotation>) => void;
  onClose: () => void;
}> = ({ annotation, x, y, onSave, onClose }) => {
  const [type, setType] = useState<AnnotationType>(annotation?.type || AnnotationType.MARKER);
  const [anchorType, setAnchorType] = useState<AnchorType>(annotation?.anchorType || AnchorType.POINT);
  const [title, setTitle] = useState(annotation?.title || '');
  const [description, setDescription] = useState(annotation?.description || '');
  const [tags, setTags] = useState(annotation?.tags?.join(', ') || '');
  const [isPrivate, setIsPrivate] = useState(annotation?.isPrivate || false);
  const [connectorStyle, setConnectorStyle] = useState<ConnectorStyle>(
    annotation?.connectorStyle || ConnectorStyle.CURVED
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const handleTemplateSelect = (templateId: string) => {
    const template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setType(template.type);
      setAnchorType(template.anchorType);
      setTitle(template.defaultTitle);
      setTags(template.defaultTags?.join(', ') || '');
      if (template.style?.connectorStyle) {
        setConnectorStyle(template.style.connectorStyle);
      }
      setSelectedTemplate(templateId);
    }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const annotationData: Partial<ChartAnnotation> = {
      x,
      y,
      type,
      anchorType,
      title: title.trim(),
      description: description.trim() || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      isPrivate,
      connectorStyle: anchorType === AnchorType.CALLOUT ? connectorStyle : undefined
    };

    onSave(annotationData);
  };

  return (
    <Box sx={{ p: 2, minWidth: 350 }}>
      <Typography variant="h6" gutterBottom>
        {annotation ? 'Edit Annotation' : 'Add Annotation'}
      </Typography>

      <Stack spacing={2}>
        {!annotation && (
          <FormControl size="small" fullWidth>
            <InputLabel>Template</InputLabel>
            <Select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              label="Template"
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {DEFAULT_TEMPLATES.map(template => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Stack direction="row" spacing={1}>
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as AnnotationType)}
              label="Type"
            >
              {Object.values(AnnotationType).map(t => (
                <MenuItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>Anchor</InputLabel>
            <Select
              value={anchorType}
              onChange={(e) => setAnchorType(e.target.value as AnchorType)}
              label="Anchor"
            >
              <MenuItem value={AnchorType.POINT}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Timeline fontSize="small" />
                  <span>Point</span>
                </Stack>
              </MenuItem>
              <MenuItem value={AnchorType.VERTICAL}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <VerticalAlignCenter fontSize="small" />
                  <span>Vertical Line</span>
                </Stack>
              </MenuItem>
              <MenuItem value={AnchorType.HORIZONTAL}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HorizontalRule fontSize="small" />
                  <span>Horizontal Line</span>
                </Stack>
              </MenuItem>
              <MenuItem value={AnchorType.REGION}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CropSquare fontSize="small" />
                  <span>Region</span>
                </Stack>
              </MenuItem>
              <MenuItem value={AnchorType.TEXT}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextFields fontSize="small" />
                  <span>Text</span>
                </Stack>
              </MenuItem>
              <MenuItem value={AnchorType.CALLOUT}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalloutOutlined fontSize="small" />
                  <span>Callout</span>
                </Stack>
              </MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {anchorType === AnchorType.CALLOUT && (
          <FormControl size="small" fullWidth>
            <InputLabel>Connector Style</InputLabel>
            <Select
              value={connectorStyle}
              onChange={(e) => setConnectorStyle(e.target.value as ConnectorStyle)}
              label="Connector Style"
            >
              <MenuItem value={ConnectorStyle.STRAIGHT}>Straight</MenuItem>
              <MenuItem value={ConnectorStyle.CURVED}>Curved</MenuItem>
              <MenuItem value={ConnectorStyle.ELBOW}>Elbow</MenuItem>
            </Select>
          </FormControl>
        )}

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

        <FormControlLabel
          control={
            <Switch
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              size="small"
            />
          }
          label="Private (only visible to you)"
        />

        <Typography variant="caption" color="text.secondary">
          Position: ({x.toFixed(2)}, {y.toFixed(2)})
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
 * ChartAnnotations component
 */
export const ChartAnnotations: React.FC<ChartAnnotationsProps> = ({
  chartRef,
  annotations,
  xScale,
  yScale,
  xDomain,
  yDomain,
  onAnnotationClick,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  editable = true,
  filter,
  selectedSeriesId,
  height,
  width
}) => {
  const [hoveredAnnotation, setHoveredAnnotation] = useState<string | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [editorAnchor, setEditorAnchor] = useState<{
    element: HTMLElement;
    annotation?: ChartAnnotation;
    x: number;
    y: number;
  } | null>(null);
  const [annotationMode, setAnnotationMode] = useState<AnchorType | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter annotations
  const visibleAnnotations = useMemo(() => {
    if (!showAnnotations) return [];
    
    let filtered = annotations;
    
    // Apply custom filter
    if (filter) {
      const service = getAnnotationService();
      filtered = service.getAnnotations(filter);
    }
    
    // Filter by series if specified
    if (selectedSeriesId) {
      filtered = filtered.filter(a => !a.seriesId || a.seriesId === selectedSeriesId);
    }
    
    // Filter by visible range
    return filtered.filter(a => {
      if (a.anchorType === AnchorType.HORIZONTAL) {
        return a.y! >= yDomain[0] && a.y! <= yDomain[1];
      } else if (a.anchorType === AnchorType.VERTICAL) {
        return a.x >= xDomain[0] && a.x <= xDomain[1];
      } else if (a.anchorType === AnchorType.REGION) {
        return !(a.x2! < xDomain[0] || a.x > xDomain[1] || 
                 a.y2! < yDomain[0] || a.y! > yDomain[1]);
      } else {
        return a.x >= xDomain[0] && a.x <= xDomain[1] &&
               (!a.y || (a.y >= yDomain[0] && a.y <= yDomain[1]));
      }
    });
  }, [annotations, showAnnotations, filter, selectedSeriesId, xDomain, yDomain]);

  // Handle chart click for adding annotations
  useEffect(() => {
    if (!editable || !annotationMode || !chartRef.current) return;

    const handleChartClick = (event: MouseEvent) => {
      const rect = chartRef.current!.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Convert to data coordinates
      const dataX = xScale.invert ? xScale.invert(x) : x;
      const dataY = yScale.invert ? yScale.invert(y) : y;

      setEditorAnchor({
        element: event.target as HTMLElement,
        x: dataX,
        y: dataY
      });
    };

    chartRef.current.addEventListener('click', handleChartClick);
    chartRef.current.style.cursor = 'crosshair';

    return () => {
      if (chartRef.current) {
        chartRef.current.removeEventListener('click', handleChartClick);
        chartRef.current.style.cursor = 'default';
      }
    };
  }, [editable, annotationMode, chartRef, xScale, yScale]);

  // Render annotation based on type
  const renderAnnotation = (annotation: ChartAnnotation) => {
    const x = xScale(annotation.x);
    const y = annotation.y !== undefined ? yScale(annotation.y) : height / 2;

    const getColor = () => {
      switch (annotation.type) {
        case AnnotationType.ERROR: return '#f44336';
        case AnnotationType.WARNING: return '#ff9800';
        case AnnotationType.INFO: return '#2196f3';
        case AnnotationType.SUCCESS: return '#4caf50';
        case AnnotationType.BOOKMARK: return '#9c27b0';
        default: return '#1976d2';
      }
    };

    const color = annotation.color || getColor();
    const isActive = hoveredAnnotation === annotation.id || selectedAnnotation === annotation.id;

    switch (annotation.anchorType) {
      case AnchorType.VERTICAL:
        return (
          <g>
            <line
              x1={x}
              y1={0}
              x2={x}
              y2={height}
              stroke={color}
              strokeWidth={isActive ? 2 : 1}
              strokeDasharray={annotation.dashArray || '5,5'}
              opacity={annotation.opacity || 0.7}
            />
            <AnnotationText
              x={x + 5}
              y={15}
              fontSize={annotation.fontSize || 12}
              fontWeight={annotation.fontWeight || 'normal'}
              fill={color}
            >
              {annotation.title}
            </AnnotationText>
          </g>
        );

      case AnchorType.HORIZONTAL:
        return (
          <g>
            <line
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={color}
              strokeWidth={isActive ? 2 : 1}
              strokeDasharray={annotation.dashArray || '5,5'}
              opacity={annotation.opacity || 0.7}
            />
            <AnnotationText
              x={5}
              y={y - 5}
              fontSize={annotation.fontSize || 12}
              fontWeight={annotation.fontWeight || 'normal'}
              fill={color}
            >
              {annotation.title}
            </AnnotationText>
          </g>
        );

      case AnchorType.REGION:
        const x2 = annotation.x2 !== undefined ? xScale(annotation.x2) : x + 50;
        const y2 = annotation.y2 !== undefined ? yScale(annotation.y2) : y + 50;
        return (
          <g>
            <rect
              x={Math.min(x, x2)}
              y={Math.min(y, y2)}
              width={Math.abs(x2 - x)}
              height={Math.abs(y2 - y)}
              fill={color}
              opacity={annotation.opacity || 0.2}
              stroke={color}
              strokeWidth={isActive ? 2 : 1}
            />
            <AnnotationText
              x={Math.min(x, x2) + 5}
              y={Math.min(y, y2) + 15}
              fontSize={annotation.fontSize || 12}
              fontWeight={annotation.fontWeight || 'normal'}
              fill={color}
            >
              {annotation.title}
            </AnnotationText>
          </g>
        );

      case AnchorType.TEXT:
        return (
          <AnnotationText
            x={x}
            y={y}
            fontSize={annotation.fontSize || 14}
            fontWeight={annotation.fontWeight || 'normal'}
            fill={color}
            textAnchor="middle"
          >
            {annotation.title}
          </AnnotationText>
        );

      case AnchorType.CALLOUT:
        const labelX = x + 50;
        const labelY = y - 30;
        
        let path = '';
        switch (annotation.connectorStyle) {
          case ConnectorStyle.STRAIGHT:
            path = `M ${x} ${y} L ${labelX} ${labelY}`;
            break;
          case ConnectorStyle.ELBOW:
            path = `M ${x} ${y} L ${x} ${labelY} L ${labelX} ${labelY}`;
            break;
          case ConnectorStyle.CURVED:
          default:
            const cx = (x + labelX) / 2;
            path = `M ${x} ${y} Q ${cx} ${y} ${labelX} ${labelY}`;
            break;
        }
        
        return (
          <g>
            <circle
              cx={x}
              cy={y}
              r={4}
              fill={color}
              stroke="white"
              strokeWidth={2}
            />
            <path
              d={path}
              stroke={color}
              strokeWidth={isActive ? 2 : 1}
              fill="none"
              opacity={annotation.opacity || 0.7}
            />
            <rect
              x={labelX - 5}
              y={labelY - 12}
              width={annotation.title.length * 7 + 10}
              height={20}
              fill="white"
              stroke={color}
              strokeWidth={1}
              rx={3}
            />
            <AnnotationText
              x={labelX}
              y={labelY}
              fontSize={annotation.fontSize || 12}
              fontWeight={annotation.fontWeight || 'normal'}
              fill={color}
            >
              {annotation.title}
            </AnnotationText>
          </g>
        );

      case AnchorType.POINT:
      default:
        return (
          <g>
            <circle
              cx={x}
              cy={y}
              r={6}
              fill={color}
              stroke="white"
              strokeWidth={2}
              opacity={annotation.opacity || 0.9}
            />
            <AnnotationText
              x={x + 10}
              y={y - 10}
              fontSize={annotation.fontSize || 12}
              fontWeight={annotation.fontWeight || 'normal'}
              fill={color}
            >
              {annotation.title}
            </AnnotationText>
          </g>
        );
    }
  };

  // Handle annotation interaction
  const handleAnnotationClick = (annotation: ChartAnnotation, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (editable && event.shiftKey) {
      setEditorAnchor({
        element: event.currentTarget as HTMLElement,
        annotation,
        x: annotation.x,
        y: annotation.y || 0
      });
    } else {
      setSelectedAnnotation(annotation.id);
      onAnnotationClick?.(annotation);
    }
  };

  // Handle save
  const handleSave = (annotationData: Partial<ChartAnnotation>) => {
    if (editorAnchor?.annotation) {
      onAnnotationUpdate?.({
        ...editorAnchor.annotation,
        ...annotationData
      });
    } else {
      onAnnotationAdd?.({
        id: `ann_${Date.now()}`,
        ...annotationData,
        anchorType: annotationData.anchorType || AnchorType.POINT,
        createdAt: Date.now(),
        syncStatus: 'local'
      } as ChartAnnotation);
    }
    
    setEditorAnchor(null);
    setAnnotationMode(null);
  };

  // Handle export
  const handleExport = () => {
    const service = getAnnotationService();
    const exportData = service.exportAnnotations(filter);
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotations_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    setMenuAnchor(null);
  };

  // Handle import
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const service = getAnnotationService();
      const imported = await service.importAnnotations(data);
      
      console.log(`Imported ${imported} annotations`);
      setMenuAnchor(null);
    } catch (error) {
      console.error('Failed to import annotations:', error);
    }
  };

  return (
    <>
      <AnnotationLayer
        ref={svgRef}
        width={width}
        height={height}
        style={{ pointerEvents: showAnnotations ? 'none' : 'none' }}
      >
        {visibleAnnotations.map(annotation => (
          <AnnotationGroup
            key={annotation.id}
            $active={hoveredAnnotation === annotation.id || selectedAnnotation === annotation.id}
            onClick={(e) => handleAnnotationClick(annotation, e)}
            onMouseEnter={() => setHoveredAnnotation(annotation.id)}
            onMouseLeave={() => setHoveredAnnotation(null)}
          >
            <Tooltip
              title={
                <Box>
                  <Typography variant="subtitle2">{annotation.title}</Typography>
                  {annotation.description && (
                    <Typography variant="caption" display="block">
                      {annotation.description}
                    </Typography>
                  )}
                  {annotation.tags && annotation.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} mt={0.5}>
                      {annotation.tags.map(tag => (
                        <Chip key={tag} label={tag} size="small" />
                      ))}
                    </Stack>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                    {new Date(annotation.createdAt || 0).toLocaleString()}
                  </Typography>
                  {editable && (
                    <Typography variant="caption" display="block" mt={1}>
                      Shift+Click to edit
                    </Typography>
                  )}
                </Box>
              }
              placement="top"
              arrow
            >
              <g>{renderAnnotation(annotation)}</g>
            </Tooltip>
          </AnnotationGroup>
        ))}
      </AnnotationLayer>

      {editable && (
        <ToolbarContainer>
          <IconButton
            size="small"
            onClick={() => setShowAnnotations(!showAnnotations)}
            title={showAnnotations ? 'Hide annotations' : 'Show annotations'}
          >
            {showAnnotations ? <Visibility /> : <VisibilityOff />}
          </IconButton>
          
          <Divider orientation="vertical" flexItem />
          
          <IconButton
            size="small"
            onClick={() => setAnnotationMode(AnchorType.POINT)}
            color={annotationMode === AnchorType.POINT ? 'primary' : 'default'}
            title="Add point annotation"
          >
            <Timeline />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={() => setAnnotationMode(AnchorType.VERTICAL)}
            color={annotationMode === AnchorType.VERTICAL ? 'primary' : 'default'}
            title="Add vertical line"
          >
            <VerticalAlignCenter />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={() => setAnnotationMode(AnchorType.HORIZONTAL)}
            color={annotationMode === AnchorType.HORIZONTAL ? 'primary' : 'default'}
            title="Add horizontal line"
          >
            <HorizontalRule />
          </IconButton>
          
          <IconButton
            size="small"
            onClick={() => setAnnotationMode(AnchorType.CALLOUT)}
            color={annotationMode === AnchorType.CALLOUT ? 'primary' : 'default'}
            title="Add callout"
          >
            <CalloutOutlined />
          </IconButton>
          
          <Divider orientation="vertical" flexItem />
          
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            title="More options"
          >
            <FilterList />
          </IconButton>
        </ToolbarContainer>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleExport}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export Annotations</ListItemText>
        </MenuItem>
        <MenuItem component="label">
          <ListItemIcon>
            <Upload fontSize="small" />
          </ListItemIcon>
          <ListItemText>Import Annotations</ListItemText>
          <input
            type="file"
            accept=".json"
            hidden
            onChange={handleImport}
          />
        </MenuItem>
      </Menu>

      <Popover
        open={Boolean(editorAnchor)}
        anchorEl={editorAnchor?.element}
        onClose={() => {
          setEditorAnchor(null);
          setAnnotationMode(null);
        }}
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
            x={editorAnchor.x}
            y={editorAnchor.y}
            onSave={handleSave}
            onClose={() => {
              setEditorAnchor(null);
              setAnnotationMode(null);
            }}
          />
        )}
      </Popover>
    </>
  );
};

export default ChartAnnotations;