/**
 * LagAnalysisChart - Visualization for cross-correlation lag analysis
 * Shows correlation coefficients at different time lags between two streams
 */

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Slider,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip,
  Chip,
  useTheme
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Download as DownloadIcon,
  CenterFocusStrong as CenterIcon
} from '@mui/icons-material';
import { CrossCorrelationResult } from '../../services/telemetry/CorrelationAnalyzer';

/**
 * Lag analysis chart props
 */
export interface LagAnalysisChartProps {
  /** Cross-correlation results */
  crossCorrelation: CrossCorrelationResult;
  /** Stream names for display */
  streamName1: string;
  streamName2: string;
  /** Chart width in pixels */
  width?: number;
  /** Chart height in pixels */
  height?: number;
  /** Show grid lines */
  showGrid?: boolean;
  /** Show significant lags as markers */
  showSignificantLags?: boolean;
  /** Significance threshold for highlighting */
  significanceThreshold?: number;
  /** Show zero lag line */
  showZeroLine?: boolean;
  /** Interactive zoom and pan */
  interactive?: boolean;
  /** Callback when lag is selected */
  onLagSelect?: (lag: number, coefficient: number) => void;
}

/**
 * Chart zoom and pan state
 */
interface ViewState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zoom: number;
}

/**
 * Get color based on correlation strength
 */
const getCorrelationColor = (coefficient: number, threshold: number): string => {
  const abs = Math.abs(coefficient);
  if (abs >= 0.7) return coefficient > 0 ? '#d73027' : '#4575b4';
  if (abs >= threshold) return coefficient > 0 ? '#f46d43' : '#74add1';
  return '#999999';
};

/**
 * Lag analysis visualization component
 */
export const LagAnalysisChart: React.FC<LagAnalysisChartProps> = ({
  crossCorrelation,
  streamName1,
  streamName2,
  width = 800,
  height = 400,
  showGrid = true,
  showSignificantLags = true,
  significanceThreshold = 0.3,
  showZeroLine = true,
  interactive = true,
  onLagSelect
}) => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewState, setViewState] = useState<ViewState>(() => {
    const { lags, coefficients } = crossCorrelation;
    return {
      xMin: Math.min(...lags),
      xMax: Math.max(...lags),
      yMin: Math.min(-1, Math.min(...coefficients) - 0.1),
      yMax: Math.max(1, Math.max(...coefficients) + 0.1),
      zoom: 1
    };
  });
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [hoveredPoint, setHoveredPoint] = useState<{ lag: number; coefficient: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Chart dimensions with margins
  const margin = { top: 40, right: 60, bottom: 60, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Scale functions
  const xScale = useCallback((lag: number) => {
    return margin.left + ((lag - viewState.xMin) / (viewState.xMax - viewState.xMin)) * chartWidth;
  }, [viewState, chartWidth, margin.left]);

  const yScale = useCallback((coefficient: number) => {
    return margin.top + chartHeight - ((coefficient - viewState.yMin) / (viewState.yMax - viewState.yMin)) * chartHeight;
  }, [viewState, chartHeight, margin.top]);

  // Inverse scale functions for mouse interactions
  const xInverse = useCallback((pixelX: number) => {
    return viewState.xMin + ((pixelX - margin.left) / chartWidth) * (viewState.xMax - viewState.xMin);
  }, [viewState, chartWidth, margin.left]);

  const yInverse = useCallback((pixelY: number) => {
    return viewState.yMin + ((chartHeight - (pixelY - margin.top)) / chartHeight) * (viewState.yMax - viewState.yMin);
  }, [viewState, chartHeight, margin.top]);

  // Draw the chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.palette.background.paper;
    ctx.fillRect(0, 0, width, height);

    const { lags, coefficients, significantLags } = crossCorrelation;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = theme.palette.divider;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      // Vertical grid lines
      const xStep = Math.max(1, Math.round((viewState.xMax - viewState.xMin) / 10));
      for (let lag = Math.ceil(viewState.xMin / xStep) * xStep; lag <= viewState.xMax; lag += xStep) {
        const x = xScale(lag);
        ctx.beginPath();
        ctx.moveTo(x, margin.top);
        ctx.lineTo(x, height - margin.bottom);
        ctx.stroke();
      }

      // Horizontal grid lines
      const yStep = 0.2;
      for (let coeff = Math.ceil(viewState.yMin / yStep) * yStep; coeff <= viewState.yMax; coeff += yStep) {
        const y = yScale(coeff);
        ctx.beginPath();
        ctx.moveTo(margin.left, y);
        ctx.lineTo(width - margin.right, y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    }

    // Draw zero line
    if (showZeroLine) {
      ctx.strokeStyle = theme.palette.text.primary;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const zeroY = yScale(0);
      ctx.beginPath();
      ctx.moveTo(margin.left, zeroY);
      ctx.lineTo(width - margin.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw correlation data
    if (chartType === 'line') {
      // Line chart
      ctx.strokeStyle = theme.palette.primary.main;
      ctx.lineWidth = 2;
      ctx.beginPath();

      let firstPoint = true;
      for (let i = 0; i < lags.length; i++) {
        const lag = lags[i];
        const coefficient = coefficients[i];
        
        if (lag >= viewState.xMin && lag <= viewState.xMax) {
          const x = xScale(lag);
          const y = yScale(coefficient);
          
          if (firstPoint) {
            ctx.moveTo(x, y);
            firstPoint = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // Draw points
      for (let i = 0; i < lags.length; i++) {
        const lag = lags[i];
        const coefficient = coefficients[i];
        
        if (lag >= viewState.xMin && lag <= viewState.xMax) {
          const x = xScale(lag);
          const y = yScale(coefficient);
          const isSignificant = Math.abs(coefficient) >= significanceThreshold;
          
          ctx.fillStyle = getCorrelationColor(coefficient, significanceThreshold);
          ctx.beginPath();
          ctx.arc(x, y, isSignificant ? 5 : 3, 0, 2 * Math.PI);
          ctx.fill();
          
          // Highlight hovered point
          if (hoveredPoint && hoveredPoint.lag === lag) {
            ctx.strokeStyle = theme.palette.secondary.main;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, 2 * Math.PI);
            ctx.stroke();
          }
        }
      }
    } else {
      // Bar chart
      const barWidth = Math.max(2, chartWidth / lags.length * 0.8);
      
      for (let i = 0; i < lags.length; i++) {
        const lag = lags[i];
        const coefficient = coefficients[i];
        
        if (lag >= viewState.xMin && lag <= viewState.xMax) {
          const x = xScale(lag) - barWidth / 2;
          const zeroY = yScale(0);
          const y = yScale(coefficient);
          const barHeight = Math.abs(zeroY - y);
          
          ctx.fillStyle = getCorrelationColor(coefficient, significanceThreshold);
          ctx.fillRect(x, Math.min(y, zeroY), barWidth, barHeight);
          
          // Highlight hovered bar
          if (hoveredPoint && hoveredPoint.lag === lag) {
            ctx.strokeStyle = theme.palette.secondary.main;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, Math.min(y, zeroY), barWidth, barHeight);
          }
        }
      }
    }

    // Highlight significant lags
    if (showSignificantLags) {
      significantLags.forEach(({ lag, coefficient }, index) => {
        if (lag >= viewState.xMin && lag <= viewState.xMax) {
          const x = xScale(lag);
          const y = yScale(coefficient);
          
          // Draw marker
          ctx.fillStyle = theme.palette.warning.main;
          ctx.strokeStyle = theme.palette.warning.dark;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x - 8, y - 12);
          ctx.lineTo(x, y - 3);
          ctx.lineTo(x + 8, y - 12);
          ctx.lineTo(x, y - 21);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          
          // Add rank number
          ctx.fillStyle = theme.palette.warning.contrastText;
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((index + 1).toString(), x, y - 14);
        }
      });
    }

    // Draw axes
    ctx.strokeStyle = theme.palette.text.primary;
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();

    // Draw axis labels and ticks
    ctx.fillStyle = theme.palette.text.primary;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    // X-axis labels
    const xLabelStep = Math.max(1, Math.round((viewState.xMax - viewState.xMin) / 8));
    for (let lag = Math.ceil(viewState.xMin / xLabelStep) * xLabelStep; lag <= viewState.xMax; lag += xLabelStep) {
      const x = xScale(lag);
      ctx.fillText(lag.toString(), x, height - margin.bottom + 20);
      
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(x, height - margin.bottom);
      ctx.lineTo(x, height - margin.bottom + 5);
      ctx.stroke();
    }
    
    // Y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yLabelStep = 0.2;
    for (let coeff = Math.ceil(viewState.yMin / yLabelStep) * yLabelStep; coeff <= viewState.yMax; coeff += yLabelStep) {
      const y = yScale(coeff);
      ctx.fillText(coeff.toFixed(1), margin.left - 10, y);
      
      // Tick mark
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, y);
      ctx.lineTo(margin.left, y);
      ctx.stroke();
    }

    // Draw axis titles
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lag (samples)', width / 2, height - 15);
    
    ctx.save();
    ctx.translate(15, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Correlation Coefficient', 0, 0);
    ctx.restore();

  }, [
    width, height, theme, viewState, crossCorrelation, chartType, 
    showGrid, showZeroLine, showSignificantLags, significanceThreshold,
    hoveredPoint, xScale, yScale, chartWidth, chartHeight, margin
  ]);

  // Redraw when dependencies change
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Handle mouse interactions
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (isDragging) {
      // Pan the chart
      const deltaX = mouseX - lastMousePos.x;
      const deltaY = mouseY - lastMousePos.y;
      
      const xRange = viewState.xMax - viewState.xMin;
      const yRange = viewState.yMax - viewState.yMin;
      
      const xDelta = -(deltaX / chartWidth) * xRange;
      const yDelta = (deltaY / chartHeight) * yRange;
      
      setViewState(prev => ({
        ...prev,
        xMin: prev.xMin + xDelta,
        xMax: prev.xMax + xDelta,
        yMin: prev.yMin + yDelta,
        yMax: prev.yMax + yDelta
      }));
      
      setLastMousePos({ x: mouseX, y: mouseY });
    } else {
      // Find nearest data point for hover
      const lagAtMouse = xInverse(mouseX);
      const { lags, coefficients } = crossCorrelation;
      
      let nearestIndex = -1;
      let minDistance = Infinity;
      
      for (let i = 0; i < lags.length; i++) {
        const distance = Math.abs(lags[i] - lagAtMouse);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }
      
      if (nearestIndex >= 0 && minDistance < (viewState.xMax - viewState.xMin) * 0.05) {
        setHoveredPoint({
          lag: lags[nearestIndex],
          coefficient: coefficients[nearestIndex]
        });
      } else {
        setHoveredPoint(null);
      }
    }
  }, [interactive, isDragging, lastMousePos, viewState, chartWidth, chartHeight, crossCorrelation, xInverse]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    setIsDragging(true);
    setLastMousePos({ x: mouseX, y: mouseY });
  }, [interactive]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onLagSelect || !hoveredPoint) return;
    onLagSelect(hoveredPoint.lag, hoveredPoint.coefficient);
  }, [onLagSelect, hoveredPoint]);

  // Zoom functions
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const factor = direction === 'in' ? 0.8 : 1.25;
    const centerX = (viewState.xMin + viewState.xMax) / 2;
    const centerY = (viewState.yMin + viewState.yMax) / 2;
    const xRange = (viewState.xMax - viewState.xMin) * factor;
    const yRange = (viewState.yMax - viewState.yMin) * factor;
    
    setViewState(prev => ({
      ...prev,
      xMin: centerX - xRange / 2,
      xMax: centerX + xRange / 2,
      yMin: centerY - yRange / 2,
      yMax: centerY + yRange / 2,
      zoom: prev.zoom * (direction === 'in' ? 1.25 : 0.8)
    }));
  }, [viewState]);

  // Reset view
  const handleResetView = useCallback(() => {
    const { lags, coefficients } = crossCorrelation;
    setViewState({
      xMin: Math.min(...lags),
      xMax: Math.max(...lags),
      yMin: Math.min(-1, Math.min(...coefficients) - 0.1),
      yMax: Math.max(1, Math.max(...coefficients) + 0.1),
      zoom: 1
    });
  }, [crossCorrelation]);

  // Export chart
  const handleExport = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(blob => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lag-analysis-${streamName1}-${streamName2}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }, [streamName1, streamName2]);

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">
            Cross-Correlation Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {streamName1} ↔ {streamName2}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Chart Type Toggle */}
          <ToggleButtonGroup
            value={chartType}
            exclusive
            onChange={(_, newType) => newType && setChartType(newType)}
            size="small"
          >
            <ToggleButton value="line">Line</ToggleButton>
            <ToggleButton value="bar">Bar</ToggleButton>
          </ToggleButtonGroup>

          {/* Controls */}
          <IconButton size="small" onClick={() => handleZoom('in')}>
            <ZoomInIcon />
          </IconButton>
          <IconButton size="small" onClick={() => handleZoom('out')}>
            <ZoomOutIcon />
          </IconButton>
          <IconButton size="small" onClick={handleResetView}>
            <CenterIcon />
          </IconButton>
          <IconButton size="small" onClick={handleExport}>
            <DownloadIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Statistics */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Chip 
          label={`Max: ${crossCorrelation.maxCorrelation.toFixed(3)} @ lag ${crossCorrelation.maxLag}`}
          color="primary" 
          variant="outlined" 
          size="small"
        />
        <Chip 
          label={`Significant lags: ${crossCorrelation.significantLags.length}`}
          color="warning" 
          variant="outlined" 
          size="small"
        />
      </Box>

      {/* Options */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControlLabel
          control={<Checkbox checked={showGrid} onChange={(e) => {}} />}
          label="Grid"
        />
        <FormControlLabel
          control={<Checkbox checked={showZeroLine} onChange={(e) => {}} />}
          label="Zero Line"
        />
        <FormControlLabel
          control={<Checkbox checked={showSignificantLags} onChange={(e) => {}} />}
          label="Significant Lags"
        />
        
        <Box sx={{ minWidth: 200 }}>
          <Typography variant="caption">Significance Threshold</Typography>
          <Slider
            value={significanceThreshold}
            min={0.1}
            max={0.9}
            step={0.1}
            valueLabelDisplay="auto"
            size="small"
            onChange={() => {}} // Would need proper state management
          />
        </Box>
      </Box>

      {/* Chart Canvas */}
      <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setHoveredPoint(null);
            setIsDragging(false);
          }}
          onClick={handleClick}
          style={{ 
            cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
            display: 'block'
          }}
        />
      </Box>

      {/* Hovered Point Info */}
      {hoveredPoint && (
        <Box sx={{ mt: 1, p: 1, bgcolor: theme.palette.background.default, borderRadius: 1 }}>
          <Typography variant="caption">
            Lag: {hoveredPoint.lag}, Correlation: {hoveredPoint.coefficient.toFixed(4)}
          </Typography>
        </Box>
      )}

      {/* Significant Lags Table */}
      {crossCorrelation.significantLags.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Top Significant Lags
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {crossCorrelation.significantLags.slice(0, 5).map(({ lag, coefficient }, index) => (
              <Chip
                key={lag}
                label={`${index + 1}. Lag ${lag}: ${coefficient.toFixed(3)}`}
                variant="outlined"
                size="small"
                color={Math.abs(coefficient) >= 0.7 ? 'error' : 'warning'}
                onClick={() => onLagSelect?.(lag, coefficient)}
                clickable={!!onLagSelect}
              />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default LagAnalysisChart;