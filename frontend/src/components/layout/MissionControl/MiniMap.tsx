/**
 * MiniMap Component for Mission Control
 * Interactive mini-map for spatial navigation and overview
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Button,
  Typography,
  Stack,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  FormControlLabel,
  Switch,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  ButtonGroup,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Badge,
  useTheme,
  alpha,
  Zoom,
  Fade,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  ZoomOutMap,
  CenterFocusStrong,
  MyLocation,
  Layers,
  Satellite,
  Terrain,
  GridOn,
  GridOff,
  Visibility,
  VisibilityOff,
  Navigation,
  Refresh,
  Settings,
  Fullscreen,
  FullscreenExit,
  PinDrop,
  Flag,
  Warning,
  Science,
  RadioButtonUnchecked,
  FiberManualRecord,
  Timeline,
  Route,
  Place,
  LocationOn,
  Explore,
  Straighten,
} from '@mui/icons-material';

// Types and interfaces
export interface Position {
  x: number; // meters or grid units
  y: number; // meters or grid units
  z?: number; // elevation
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MiniMapLayer {
  id: string;
  name: string;
  type: 'base' | 'overlay' | 'data';
  visible: boolean;
  opacity: number;
  zIndex: number;
  data: any; // Layer-specific data
}

export interface PointOfInterest {
  id: string;
  type: 'waypoint' | 'hazard' | 'sample' | 'landmark' | 'target' | 'obstacle';
  position: Position;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  size?: number;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export interface PathPoint {
  position: Position;
  timestamp: number;
  speed?: number;
  heading?: number;
  confidence?: number;
}

export interface MiniMapViewport {
  center: Position;
  zoom: number;
  rotation: number; // degrees
  bounds: BoundingBox;
}

export interface MiniMapProps {
  // Core data
  roverPosition: Position;
  roverHeading?: number;
  path?: PathPoint[];
  pointsOfInterest?: PointOfInterest[];
  layers?: MiniMapLayer[];
  
  // View configuration
  width?: number | string;
  height?: number | string;
  viewport?: MiniMapViewport;
  defaultZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  
  // Display options
  showGrid?: boolean;
  showScale?: boolean;
  showCompass?: boolean;
  showCoordinates?: boolean;
  showPath?: boolean;
  showTrail?: boolean;
  pathLength?: number; // Number of points to show in trail
  
  // Interaction
  interactive?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotation?: boolean;
  centerOnRover?: boolean;
  trackRover?: boolean;
  
  // Styling
  backgroundColor?: string;
  gridColor?: string;
  pathColor?: string;
  roverColor?: string;
  trailColor?: string;
  
  // Event handlers
  onViewportChange?: (viewport: MiniMapViewport) => void;
  onRoverClick?: (position: Position) => void;
  onPathClick?: (point: PathPoint, index: number) => void;
  onPOIClick?: (poi: PointOfInterest) => void;
  onPOIDoubleClick?: (poi: PointOfInterest) => void;
  onMapClick?: (position: Position) => void;
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  
  // Configuration
  className?: string;
  'data-testid'?: string;
}

const DEFAULT_VIEWPORT: MiniMapViewport = {
  center: { x: 0, y: 0 },
  zoom: 1,
  rotation: 0,
  bounds: { minX: -100, maxX: 100, minY: -100, maxY: 100 },
};

const POI_ICONS = {
  waypoint: <PinDrop />,
  hazard: <Warning />,
  sample: <Science />,
  landmark: <Flag />,
  target: <LocationOn />,
  obstacle: <RadioButtonUnchecked />,
};

const POI_COLORS = {
  waypoint: '#2196f3',
  hazard: '#f44336',
  sample: '#4caf50',
  landmark: '#9c27b0',
  target: '#ff9800',
  obstacle: '#607d8b',
};

export const MiniMap: React.FC<MiniMapProps> = ({
  roverPosition,
  roverHeading = 0,
  path = [],
  pointsOfInterest = [],
  layers = [],
  width = '100%',
  height = 300,
  viewport = DEFAULT_VIEWPORT,
  defaultZoom = 1,
  minZoom = 0.1,
  maxZoom = 10,
  showGrid = true,
  showScale = true,
  showCompass = true,
  showCoordinates = true,
  showPath = true,
  showTrail = true,
  pathLength = 100,
  interactive = true,
  enablePan = true,
  enableZoom = true,
  enableRotation = false,
  centerOnRover = false,
  trackRover = false,
  backgroundColor = '#f5f5f5',
  gridColor = '#e0e0e0',
  pathColor = '#2196f3',
  roverColor = '#f44336',
  trailColor = '#90caf9',
  onViewportChange,
  onRoverClick,
  onPathClick,
  onPOIClick,
  onPOIDoubleClick,
  onMapClick,
  onLayerToggle,
  className,
  'data-testid': testId,
}) => {
  const theme = useTheme();
  const mapRef = useRef<HTMLDivElement>(null);
  const [currentViewport, setCurrentViewport] = useState<MiniMapViewport>(viewport);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewportStart, setViewportStart] = useState<Position>({ x: 0, y: 0 });
  const [hoveredPOI, setHoveredPOI] = useState<string | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<string | null>(null);
  
  // Menu state
  const [layersMenuAnchor, setLayersMenuAnchor] = useState<HTMLElement | null>(null);
  const [viewMenuAnchor, setViewMenuAnchor] = useState<HTMLElement | null>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<HTMLElement | null>(null);
  
  // View state
  const [currentLayers, setCurrentLayers] = useState(layers);
  const [viewMode, setViewMode] = useState<'satellite' | 'terrain' | 'grid'>('terrain');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Calculate map dimensions and scale
  const mapDimensions = useMemo(() => {
    if (!mapRef.current) return { width: 400, height: 300 };
    return {
      width: mapRef.current.clientWidth,
      height: mapRef.current.clientHeight,
    };
  }, [mapRef.current?.clientWidth, mapRef.current?.clientHeight]);

  // Calculate pixel scale (pixels per meter)
  const pixelScale = useMemo(() => {
    const viewWidth = currentViewport.bounds.maxX - currentViewport.bounds.minX;
    const viewHeight = currentViewport.bounds.maxY - currentViewport.bounds.minY;
    const scaleX = mapDimensions.width / viewWidth;
    const scaleY = mapDimensions.height / viewHeight;
    return Math.min(scaleX, scaleY) * currentViewport.zoom;
  }, [currentViewport, mapDimensions]);

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback((worldPos: Position): { x: number; y: number } => {
    const centerX = mapDimensions.width / 2;
    const centerY = mapDimensions.height / 2;
    
    // Translate relative to viewport center
    const dx = worldPos.x - currentViewport.center.x;
    const dy = worldPos.y - currentViewport.center.y;
    
    // Apply rotation if enabled
    let x = dx;
    let y = dy;
    if (currentViewport.rotation !== 0) {
      const cos = Math.cos((currentViewport.rotation * Math.PI) / 180);
      const sin = Math.sin((currentViewport.rotation * Math.PI) / 180);
      x = dx * cos - dy * sin;
      y = dx * sin + dy * cos;
    }
    
    // Scale and translate to screen coordinates
    return {
      x: centerX + x * pixelScale,
      y: centerY - y * pixelScale, // Flip Y axis
    };
  }, [currentViewport, mapDimensions, pixelScale]);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback((screenPos: { x: number; y: number }): Position => {
    const centerX = mapDimensions.width / 2;
    const centerY = mapDimensions.height / 2;
    
    // Convert from screen to relative coordinates
    const dx = (screenPos.x - centerX) / pixelScale;
    const dy = -(screenPos.y - centerY) / pixelScale; // Flip Y axis
    
    // Apply inverse rotation if enabled
    let x = dx;
    let y = dy;
    if (currentViewport.rotation !== 0) {
      const cos = Math.cos((-currentViewport.rotation * Math.PI) / 180);
      const sin = Math.sin((-currentViewport.rotation * Math.PI) / 180);
      x = dx * cos - dy * sin;
      y = dx * sin + dy * cos;
    }
    
    // Translate to world coordinates
    return {
      x: currentViewport.center.x + x,
      y: currentViewport.center.y + y,
    };
  }, [currentViewport, mapDimensions, pixelScale]);

  // Handle zoom
  const handleZoom = useCallback((delta: number, center?: Position) => {
    const zoomCenter = center || currentViewport.center;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, currentViewport.zoom * (1 + delta)));
    
    const newViewport = {
      ...currentViewport,
      zoom: newZoom,
      center: zoomCenter,
    };
    
    setCurrentViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [currentViewport, minZoom, maxZoom, onViewportChange]);

  // Handle pan
  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    const worldDeltaX = -deltaX / pixelScale;
    const worldDeltaY = deltaY / pixelScale;
    
    const newCenter = {
      x: currentViewport.center.x + worldDeltaX,
      y: currentViewport.center.y + worldDeltaY,
    };
    
    const newViewport = {
      ...currentViewport,
      center: newCenter,
    };
    
    setCurrentViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [currentViewport, pixelScale, onViewportChange]);

  // Center on rover
  const centerOnRoverHandler = useCallback(() => {
    const newViewport = {
      ...currentViewport,
      center: roverPosition,
    };
    
    setCurrentViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [currentViewport, roverPosition, onViewportChange]);

  // Auto-center on rover when tracking is enabled
  useEffect(() => {
    if (trackRover || centerOnRover) {
      centerOnRoverHandler();
    }
  }, [trackRover, centerOnRover, roverPosition, centerOnRoverHandler]);

  // Handle mouse events
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!interactive || !enablePan) return;
    
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    setViewportStart(currentViewport.center);
  }, [interactive, enablePan, currentViewport.center]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    handlePan(deltaX, deltaY);
  }, [isDragging, dragStart, handlePan]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    if (!interactive || !enableZoom) return;
    
    event.preventDefault();
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    
    const worldPos = screenToWorld(mousePos);
    const delta = -event.deltaY * 0.001;
    
    handleZoom(delta, worldPos);
  }, [interactive, enableZoom, screenToWorld, handleZoom]);

  // Handle map click
  const handleMapClick = useCallback((event: React.MouseEvent) => {
    if (isDragging) return;
    
    const rect = mapRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    
    const worldPos = screenToWorld(mousePos);
    onMapClick?.(worldPos);
  }, [isDragging, screenToWorld, onMapClick]);

  // Layer management
  const toggleLayer = useCallback((layerId: string) => {
    setCurrentLayers(prev => 
      prev.map(layer => 
        layer.id === layerId 
          ? { ...layer, visible: !layer.visible }
          : layer
      )
    );
    
    const layer = currentLayers.find(l => l.id === layerId);
    if (layer) {
      onLayerToggle?.(layerId, !layer.visible);
    }
  }, [currentLayers, onLayerToggle]);

  // Filter path points for trail
  const trailPoints = useMemo(() => {
    if (!showTrail || !path.length) return [];
    return path.slice(-pathLength);
  }, [showTrail, path, pathLength]);

  // Generate grid lines
  const gridLines = useMemo(() => {
    if (!showGrid) return [];
    
    const lines = [];
    const bounds = currentViewport.bounds;
    const step = Math.max(1, Math.floor((bounds.maxX - bounds.minX) / 20));
    
    // Vertical lines
    for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
      const start = worldToScreen({ x, y: bounds.minY });
      const end = worldToScreen({ x, y: bounds.maxY });
      lines.push({
        key: `v-${x}`,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      });
    }
    
    // Horizontal lines
    for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
      const start = worldToScreen({ x: bounds.minX, y });
      const end = worldToScreen({ x: bounds.maxX, y });
      lines.push({
        key: `h-${y}`,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      });
    }
    
    return lines;
  }, [showGrid, currentViewport.bounds, worldToScreen]);

  return (
    <Paper
      className={className}
      data-testid={testId}
      elevation={2}
      sx={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header with controls */}
      <Box
        sx={{
          p: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 40,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {/* View mode toggle */}
          <ToggleButtonGroup
            size="small"
            value={viewMode}
            exclusive
            onChange={(e, value) => value && setViewMode(value)}
          >
            <ToggleButton value="satellite">
              <Satellite fontSize="small" />
            </ToggleButton>
            <ToggleButton value="terrain">
              <Terrain fontSize="small" />
            </ToggleButton>
            <ToggleButton value="grid">
              <GridOn fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Zoom controls */}
          <ButtonGroup size="small" variant="outlined">
            <IconButton onClick={() => handleZoom(0.2)}>
              <ZoomIn fontSize="small" />
            </IconButton>
            <IconButton onClick={() => handleZoom(-0.2)}>
              <ZoomOut fontSize="small" />
            </IconButton>
            <IconButton onClick={() => handleZoom(-currentViewport.zoom + 1)}>
              <ZoomOutMap fontSize="small" />
            </IconButton>
          </ButtonGroup>

          {/* Center on rover */}
          <Tooltip title="Center on rover">
            <IconButton size="small" onClick={centerOnRoverHandler}>
              <MyLocation fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Track rover toggle */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={trackRover}
                onChange={(e) => {
                  // This would need to be handled by parent component
                  // onTrackRoverChange?.(e.target.checked);
                }}
              />
            }
            label="Track"
            sx={{ ml: 1, '& .MuiFormControlLabel-label': { fontSize: '0.75rem' } }}
          />
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0.5}>
          {/* Layers */}
          <IconButton
            size="small"
            onClick={(e) => setLayersMenuAnchor(e.currentTarget)}
          >
            <Badge badgeContent={currentLayers.filter(l => l.visible).length} color="primary">
              <Layers fontSize="small" />
            </Badge>
          </IconButton>

          {/* Settings */}
          <IconButton
            size="small"
            onClick={(e) => setSettingsMenuAnchor(e.currentTarget)}
          >
            <Settings fontSize="small" />
          </IconButton>

          {/* Fullscreen toggle */}
          <IconButton
            size="small"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>

      {/* Main map area */}
      <Box
        ref={mapRef}
        sx={{
          position: 'relative',
          flexGrow: 1,
          backgroundColor,
          cursor: isDragging ? 'grabbing' : interactive ? 'grab' : 'default',
          overflow: 'hidden',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleMapClick}
      >
        {/* SVG overlay for vector graphics */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* Grid lines */}
          {gridLines.map((line) => (
            <line
              key={line.key}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={gridColor}
              strokeWidth={0.5}
              opacity={0.5}
            />
          ))}

          {/* Path/trail */}
          {showPath && trailPoints.length > 1 && (
            <polyline
              points={trailPoints
                .map(point => {
                  const screen = worldToScreen(point.position);
                  return `${screen.x},${screen.y}`;
                })
                .join(' ')}
              fill="none"
              stroke={trailColor}
              strokeWidth={2}
              opacity={0.7}
            />
          )}

          {/* Full path if available */}
          {showPath && path.length > 1 && (
            <polyline
              points={path
                .map(point => {
                  const screen = worldToScreen(point.position);
                  return `${screen.x},${screen.y}`;
                })
                .join(' ')}
              fill="none"
              stroke={pathColor}
              strokeWidth={1}
              opacity={0.4}
              strokeDasharray="5,5"
            />
          )}
        </svg>

        {/* Points of Interest */}
        {pointsOfInterest.map((poi) => {
          const screen = worldToScreen(poi.position);
          const isHovered = hoveredPOI === poi.id;
          const isSelected = selectedPOI === poi.id;
          const size = (poi.size || 8) * (isHovered ? 1.2 : 1);
          
          return (
            <Tooltip
              key={poi.id}
              title={
                <Box>
                  <Typography variant="subtitle2">{poi.label}</Typography>
                  <Typography variant="caption">
                    {poi.type} • ({poi.position.x.toFixed(1)}, {poi.position.y.toFixed(1)})
                  </Typography>
                  {poi.description && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {poi.description}
                    </Typography>
                  )}
                </Box>
              }
            >
              <Box
                sx={{
                  position: 'absolute',
                  left: screen.x - size / 2,
                  top: screen.y - size / 2,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: poi.color || POI_COLORS[poi.type] || theme.palette.primary.main,
                  border: isSelected ? `2px solid ${theme.palette.secondary.main}` : '1px solid white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 1,
                  transition: 'all 0.2s ease',
                  zIndex: isSelected ? 10 : isHovered ? 9 : 8,
                  '&:hover': {
                    transform: 'scale(1.2)',
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPOI(poi.id);
                  onPOIClick?.(poi);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onPOIDoubleClick?.(poi);
                }}
                onMouseEnter={() => setHoveredPOI(poi.id)}
                onMouseLeave={() => setHoveredPOI(null)}
              >
                {React.cloneElement(POI_ICONS[poi.type] || POI_ICONS.waypoint, {
                  style: { fontSize: size * 0.6, color: 'white' },
                })}
              </Box>
            </Tooltip>
          );
        })}

        {/* Rover position and heading */}
        <Box
          sx={{
            position: 'absolute',
            left: worldToScreen(roverPosition).x - 8,
            top: worldToScreen(roverPosition).y - 8,
            width: 16,
            height: 16,
            cursor: 'pointer',
            zIndex: 15,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRoverClick?.(roverPosition);
          }}
        >
          {/* Rover body */}
          <Box
            sx={{
              width: '100%',
              height: '100%',
              backgroundColor: roverColor,
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: 2,
              transform: `rotate(${roverHeading || 0}deg)`,
              transition: 'transform 0.3s ease',
            }}
          />
          
          {/* Heading indicator */}
          {roverHeading !== undefined && (
            <Box
              sx={{
                position: 'absolute',
                top: -4,
                left: '50%',
                width: 2,
                height: 8,
                backgroundColor: 'white',
                transform: `translateX(-50%) rotate(${roverHeading}deg)`,
                transformOrigin: 'bottom center',
              }}
            />
          )}
        </Box>

        {/* Compass */}
        {showCompass && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 60,
              height: 60,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              border: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 1,
            }}
          >
            <Navigation
              sx={{
                transform: `rotate(${-currentViewport.rotation}deg)`,
                color: 'primary.main',
              }}
            />
          </Box>
        )}

        {/* Scale indicator */}
        {showScale && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              boxShadow: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              1:{Math.round(1 / currentViewport.zoom)}
            </Typography>
            <Box
              sx={{
                width: 50,
                height: 2,
                backgroundColor: 'text.primary',
                mt: 0.5,
              }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
              {Math.round(50 / pixelScale)}m
            </Typography>
          </Box>
        )}

        {/* Coordinates display */}
        {showCoordinates && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              backgroundColor: alpha(theme.palette.background.paper, 0.9),
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              boxShadow: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              Rover: ({roverPosition.x.toFixed(1)}, {roverPosition.y.toFixed(1)})
            </Typography>
            <br />
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              View: ({currentViewport.center.x.toFixed(1)}, {currentViewport.center.y.toFixed(1)})
            </Typography>
          </Box>
        )}
      </Box>

      {/* Layers menu */}
      <Menu
        anchorEl={layersMenuAnchor}
        open={Boolean(layersMenuAnchor)}
        onClose={() => setLayersMenuAnchor(null)}
      >
        {currentLayers.map((layer) => (
          <MenuItem key={layer.id} onClick={() => toggleLayer(layer.id)}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ width: '100%' }}>
              <IconButton size="small">
                {layer.visible ? <Visibility /> : <VisibilityOff />}
              </IconButton>
              <Typography>{layer.name}</Typography>
              <Box sx={{ flexGrow: 1 }} />
              <Slider
                size="small"
                value={layer.opacity}
                min={0}
                max={1}
                step={0.1}
                sx={{ width: 60 }}
                onClick={(e) => e.stopPropagation()}
                onChange={(e, value) => {
                  setCurrentLayers(prev =>
                    prev.map(l =>
                      l.id === layer.id ? { ...l, opacity: value as number } : l
                    )
                  );
                }}
              />
            </Stack>
          </MenuItem>
        ))}
      </Menu>

      {/* Settings menu */}
      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={() => setSettingsMenuAnchor(null)}
      >
        <MenuItem>
          <FormControlLabel
            control={<Switch checked={showGrid} />}
            label="Show Grid"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={<Switch checked={showScale} />}
            label="Show Scale"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={<Switch checked={showCompass} />}
            label="Show Compass"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={<Switch checked={showCoordinates} />}
            label="Show Coordinates"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={<Switch checked={showPath} />}
            label="Show Path"
          />
        </MenuItem>
        <MenuItem>
          <FormControlLabel
            control={<Switch checked={showTrail} />}
            label="Show Trail"
          />
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default MiniMap;