/**
 * CorrelationMatrix - Interactive correlation heatmap visualization
 * Displays correlation coefficients between telemetry streams with interactive tooltips
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  IconButton,
  Menu,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Slider,
  Chip,
  useTheme
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { CorrelationMatrixEntry } from '../../services/telemetry/CorrelationAnalyzer';

/**
 * Color scheme for correlation values
 */
const CORRELATION_COLORS = {
  strongPositive: '#d73027',    // Red for strong positive correlation
  moderatePositive: '#f46d43',  // Orange for moderate positive
  weakPositive: '#fdae61',      // Light orange for weak positive
  noCorrelation: '#ffffbf',     // Yellow for no correlation
  weakNegative: '#abd9e9',      // Light blue for weak negative
  moderateNegative: '#74add1', // Blue for moderate negative
  strongNegative: '#4575b4'     // Dark blue for strong negative correlation
};

/**
 * Correlation matrix visualization props
 */
export interface CorrelationMatrixProps {
  /** Correlation data entries */
  correlations: CorrelationMatrixEntry[];
  /** Available stream names for matrix display */
  streamNames: string[];
  /** Currently selected correlation method */
  method?: 'pearson' | 'spearman';
  /** Matrix cell size in pixels */
  cellSize?: number;
  /** Show values in cells */
  showValues?: boolean;
  /** Show only significant correlations */
  significantOnly?: boolean;
  /** Significance threshold */
  significanceThreshold?: number;
  /** Enable interactive tooltips */
  interactive?: boolean;
  /** Callback when cell is clicked */
  onCellClick?: (streamId1: string, streamId2: string, correlation: number) => void;
  /** Callback when method changes */
  onMethodChange?: (method: 'pearson' | 'spearman') => void;
  /** Custom color scheme */
  colorScheme?: Partial<typeof CORRELATION_COLORS>;
}

/**
 * Matrix cell tooltip data
 */
interface CellTooltipData {
  streamName1: string;
  streamName2: string;
  pearson: number;
  spearman: number;
  significance1: string;
  significance2: string;
  maxCrossCorr: number;
  maxLag: number;
  sampleSize: number;
  lastUpdated: Date;
}

/**
 * Get color for correlation coefficient
 */
const getCorrelationColor = (
  coefficient: number, 
  colorScheme: typeof CORRELATION_COLORS = CORRELATION_COLORS
): string => {
  const abs = Math.abs(coefficient);
  
  if (abs >= 0.7) {
    return coefficient > 0 ? colorScheme.strongPositive : colorScheme.strongNegative;
  } else if (abs >= 0.4) {
    return coefficient > 0 ? colorScheme.moderatePositive : colorScheme.moderateNegative;
  } else if (abs >= 0.2) {
    return coefficient > 0 ? colorScheme.weakPositive : colorScheme.weakNegative;
  } else {
    return colorScheme.noCorrelation;
  }
};

/**
 * Custom tooltip component for correlation details
 */
const CorrelationTooltip: React.FC<{ 
  data: CellTooltipData;
  children: React.ReactElement;
}> = ({ data, children }) => {
  const theme = useTheme();
  
  const tooltipContent = (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        {data.streamName1} ↔ {data.streamName2}
      </Typography>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
        <Typography variant="body2">
          <strong>Pearson:</strong> {data.pearson.toFixed(3)}
        </Typography>
        <Typography variant="body2">
          <strong>Spearman:</strong> {data.spearman.toFixed(3)}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
        <Typography variant="body2">
          <strong>P-Significance:</strong> {data.significance1}
        </Typography>
        <Typography variant="body2">
          <strong>S-Significance:</strong> {data.significance2}
        </Typography>
      </Box>
      
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <strong>Max Cross-Corr:</strong> {data.maxCrossCorr.toFixed(3)} (lag: {data.maxLag})
      </Typography>
      
      <Typography variant="body2" sx={{ mb: 0.5 }}>
        <strong>Sample Size:</strong> {data.sampleSize}
      </Typography>
      
      <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
        Updated: {data.lastUpdated.toLocaleString()}
      </Typography>
    </Box>
  );

  return (
    <Tooltip 
      title={tooltipContent}
      placement="top"
      componentsProps={{
        tooltip: {
          sx: {
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow: theme.shadows[4],
            maxWidth: 320
          }
        }
      }}
    >
      {children}
    </Tooltip>
  );
};

/**
 * Correlation matrix heatmap component
 */
export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  correlations,
  streamNames,
  method = 'pearson',
  cellSize = 50,
  showValues = true,
  significantOnly = false,
  significanceThreshold = 0.3,
  interactive = true,
  onCellClick,
  onMethodChange,
  colorScheme = CORRELATION_COLORS
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [localMethod, setLocalMethod] = useState<'pearson' | 'spearman'>(method);
  const [zoom, setZoom] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Create correlation lookup map
  const correlationMap = useMemo(() => {
    const map = new Map<string, CorrelationMatrixEntry>();
    correlations.forEach(entry => {
      const key1 = `${entry.streamId1}:${entry.streamId2}`;
      const key2 = `${entry.streamId2}:${entry.streamId1}`;
      map.set(key1, entry);
      map.set(key2, entry);
    });
    return map;
  }, [correlations]);

  // Create matrix data
  const matrixData = useMemo(() => {
    const matrix: Array<Array<{ 
      correlation: number; 
      tooltip: CellTooltipData | null;
      significant: boolean;
    }>> = [];

    streamNames.forEach((streamName1, i) => {
      matrix[i] = [];
      streamNames.forEach((streamName2, j) => {
        if (i === j) {
          // Diagonal - perfect self-correlation
          matrix[i][j] = {
            correlation: 1,
            tooltip: null,
            significant: true
          };
        } else {
          const key = `${streamName1}:${streamName2}`;
          const entry = correlationMap.get(key);
          
          if (entry) {
            const correlation = localMethod === 'pearson' 
              ? entry.pearson.coefficient 
              : entry.spearman.coefficient;
            
            const significant = Math.abs(correlation) >= significanceThreshold;
            
            matrix[i][j] = {
              correlation: significantOnly && !significant ? 0 : correlation,
              tooltip: {
                streamName1: entry.streamName1,
                streamName2: entry.streamName2,
                pearson: entry.pearson.coefficient,
                spearman: entry.spearman.coefficient,
                significance1: entry.pearson.significance,
                significance2: entry.spearman.significance,
                maxCrossCorr: entry.crossCorrelation.maxCorrelation,
                maxLag: entry.crossCorrelation.maxLag,
                sampleSize: entry.pearson.sampleSize,
                lastUpdated: entry.lastUpdated
              },
              significant
            };
          } else {
            matrix[i][j] = {
              correlation: 0,
              tooltip: null,
              significant: false
            };
          }
        }
      });
    });

    return matrix;
  }, [streamNames, correlationMap, localMethod, significantOnly, significanceThreshold]);

  // Draw matrix on canvas for better performance
  const drawMatrix = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !matrixData.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaledCellSize = cellSize * zoom;
    const matrixSize = streamNames.length;
    
    canvas.width = matrixSize * scaledCellSize;
    canvas.height = matrixSize * scaledCellSize;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw cells
    matrixData.forEach((row, i) => {
      row.forEach((cell, j) => {
        const x = j * scaledCellSize;
        const y = i * scaledCellSize;
        
        // Fill cell with correlation color
        ctx.fillStyle = getCorrelationColor(cell.correlation, colorScheme);
        ctx.fillRect(x, y, scaledCellSize, scaledCellSize);
        
        // Add border
        ctx.strokeStyle = theme.palette.divider;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, scaledCellSize, scaledCellSize);
        
        // Add text if enabled and cell is large enough
        if (showValues && scaledCellSize > 30) {
          ctx.fillStyle = Math.abs(cell.correlation) > 0.5 
            ? theme.palette.common.white 
            : theme.palette.common.black;
          ctx.font = `${Math.min(scaledCellSize / 4, 12) * zoom}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const text = cell.correlation === 1 ? '1.0' : cell.correlation.toFixed(2);
          ctx.fillText(
            text,
            x + scaledCellSize / 2,
            y + scaledCellSize / 2
          );
        }
        
        // Highlight hovered cell
        if (hoveredCell && hoveredCell.row === i && hoveredCell.col === j) {
          ctx.strokeStyle = theme.palette.primary.main;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, scaledCellSize, scaledCellSize);
        }
      });
    });
  }, [matrixData, cellSize, zoom, showValues, theme, hoveredCell, streamNames.length, colorScheme]);

  // Redraw when dependencies change
  useEffect(() => {
    drawMatrix();
  }, [drawMatrix]);

  // Handle method change
  const handleMethodChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newMethod: 'pearson' | 'spearman') => {
      if (newMethod && newMethod !== localMethod) {
        setLocalMethod(newMethod);
        onMethodChange?.(newMethod);
      }
    },
    [localMethod, onMethodChange]
  );

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onCellClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const scaledCellSize = cellSize * zoom;
      const col = Math.floor(x / scaledCellSize);
      const row = Math.floor(y / scaledCellSize);
      
      if (row >= 0 && row < streamNames.length && col >= 0 && col < streamNames.length) {
        const streamId1 = streamNames[row];
        const streamId2 = streamNames[col];
        const correlation = matrixData[row]?.[col]?.correlation || 0;
        
        onCellClick(streamId1, streamId2, correlation);
      }
    },
    [onCellClick, cellSize, zoom, streamNames, matrixData]
  );

  // Handle canvas mouse move for hover effects
  const handleCanvasMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!interactive) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      const scaledCellSize = cellSize * zoom;
      const col = Math.floor(x / scaledCellSize);
      const row = Math.floor(y / scaledCellSize);
      
      if (row >= 0 && row < streamNames.length && col >= 0 && col < streamNames.length) {
        setHoveredCell({ row, col });
      } else {
        setHoveredCell(null);
      }
    },
    [interactive, cellSize, zoom, streamNames.length]
  );

  // Export matrix data
  const handleExport = useCallback(() => {
    const data = {
      method: localMethod,
      streamNames,
      matrix: matrixData.map(row => row.map(cell => cell.correlation)),
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `correlation-matrix-${localMethod}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [localMethod, streamNames, matrixData]);

  if (!streamNames.length) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No streams available for correlation analysis
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header Controls */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2 
      }}>
        <Typography variant="h6">
          Correlation Matrix ({streamNames.length}×{streamNames.length})
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Method Toggle */}
          <ToggleButtonGroup
            value={localMethod}
            exclusive
            onChange={handleMethodChange}
            size="small"
          >
            <ToggleButton value="pearson">Pearson</ToggleButton>
            <ToggleButton value="spearman">Spearman</ToggleButton>
          </ToggleButtonGroup>

          {/* Zoom Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton 
              size="small" 
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              disabled={zoom <= 0.5}
            >
              <ZoomOutIcon />
            </IconButton>
            <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              disabled={zoom >= 2}
            >
              <ZoomInIcon />
            </IconButton>
          </Box>

          {/* Action Buttons */}
          <IconButton size="small" onClick={handleExport}>
            <DownloadIcon />
          </IconButton>
          
          <IconButton 
            size="small" 
            onClick={(e) => {
              setSettingsAnchor(e.currentTarget);
              setSettingsOpen(true);
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Statistics */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip 
          label={`Strong: ${matrixData.flat().filter(c => Math.abs(c.correlation) >= 0.7 && c.correlation !== 1).length}`}
          color="error" 
          variant="outlined" 
          size="small"
        />
        <Chip 
          label={`Moderate: ${matrixData.flat().filter(c => Math.abs(c.correlation) >= 0.4 && Math.abs(c.correlation) < 0.7).length}`}
          color="warning" 
          variant="outlined" 
          size="small"
        />
        <Chip 
          label={`Weak: ${matrixData.flat().filter(c => Math.abs(c.correlation) >= 0.2 && Math.abs(c.correlation) < 0.4).length}`}
          color="info" 
          variant="outlined" 
          size="small"
        />
      </Box>

      {/* Matrix Canvas */}
      <Box sx={{ 
        display: 'flex', 
        overflow: 'auto',
        maxHeight: '600px',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1
      }}>
        {/* Y-axis labels */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          minWidth: 120,
          bgcolor: theme.palette.background.default
        }}>
          {streamNames.map((name, i) => (
            <Box
              key={name}
              sx={{
                height: cellSize * zoom,
                display: 'flex',
                alignItems: 'center',
                px: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
                fontSize: Math.min(12, cellSize * zoom / 4),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              <Tooltip title={name}>
                <Typography variant="caption" noWrap>
                  {name}
                </Typography>
              </Tooltip>
            </Box>
          ))}
        </Box>

        {/* Matrix and X-axis labels */}
        <Box>
          {/* X-axis labels */}
          <Box sx={{ 
            display: 'flex',
            height: 40,
            bgcolor: theme.palette.background.default,
            borderBottom: `1px solid ${theme.palette.divider}`
          }}>
            {streamNames.map((name, j) => (
              <Box
                key={name}
                sx={{
                  width: cellSize * zoom,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 0.5,
                  transform: 'rotate(-45deg)',
                  fontSize: Math.min(10, cellSize * zoom / 5),
                  overflow: 'hidden'
                }}
              >
                <Tooltip title={name}>
                  <Typography variant="caption" noWrap>
                    {name.slice(0, 8)}
                  </Typography>
                </Tooltip>
              </Box>
            ))}
          </Box>

          {/* Matrix Canvas */}
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={() => setHoveredCell(null)}
            style={{ 
              cursor: interactive ? 'pointer' : 'default',
              display: 'block'
            }}
          />
        </Box>
      </Box>

      {/* Color Legend */}
      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" sx={{ mr: 1 }}>
          Correlation Strength:
        </Typography>
        {[
          { label: 'Strong (+)', color: colorScheme.strongPositive },
          { label: 'Moderate (+)', color: colorScheme.moderatePositive },
          { label: 'Weak (+)', color: colorScheme.weakPositive },
          { label: 'None', color: colorScheme.noCorrelation },
          { label: 'Weak (-)', color: colorScheme.weakNegative },
          { label: 'Moderate (-)', color: colorScheme.moderateNegative },
          { label: 'Strong (-)', color: colorScheme.strongNegative }
        ].map(({ label, color }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              bgcolor: color, 
              border: `1px solid ${theme.palette.divider}` 
            }} />
            <Typography variant="caption">{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <Box sx={{ p: 2, minWidth: 200 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showValues}
                onChange={(e) => setSettingsOpen(false)} // This would need proper state management
              />
            }
            label="Show Values"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={significantOnly}
                onChange={(e) => setSettingsOpen(false)} // This would need proper state management
              />
            }
            label="Significant Only"
          />
          
          <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
            Significance Threshold
          </Typography>
          <Slider
            value={significanceThreshold}
            min={0.1}
            max={0.9}
            step={0.1}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => value.toFixed(1)}
            onChange={() => {}} // This would need proper state management
          />
        </Box>
      </Menu>
    </Paper>
  );
};

export default CorrelationMatrix;