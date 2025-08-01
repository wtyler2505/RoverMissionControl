import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { throttle, debounce } from 'lodash';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip, IconButton, Stack } from '@mui/material';
import {
  PanTool as PanIcon,
  Brush as BrushIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material';

export interface DataPoint {
  timestamp: number;
  value: number;
}

export interface DataSeries {
  id: string;
  name: string;
  data: DataPoint[];
  color: string;
  type: 'line' | 'scatter' | 'area';
  lineWidth?: number;
  pointRadius?: number;
  opacity?: number;
  yAxisId?: string;
}

export interface YAxis {
  id: string;
  label: string;
  min?: number;
  max?: number;
  position: 'left' | 'right';
  color?: string;
  autoScale?: boolean;
}

export interface ChartOptions {
  timeWindow: number; // milliseconds
  gridColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  showGrid?: boolean;
  showLabels?: boolean;
  smoothing?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableBrush?: boolean;
  maxDataPoints?: number;
  updateInterval?: number; // milliseconds
  brushStyle?: {
    color: string;
    opacity: number;
    borderColor: string;
    borderWidth: number;
  };
}

export interface TimeRange {
  start: number;
  end: number;
}

interface EnhancedRealTimeChartProps {
  series: DataSeries[];
  yAxes?: YAxis[];
  options?: Partial<ChartOptions>;
  width: number;
  height: number;
  onPerformanceMetrics?: (metrics: PerformanceMetrics) => void;
  onBrushSelect?: (timeRange: TimeRange) => void;
  onRangeReset?: () => void;
}

interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  dataPoints: number;
  droppedFrames: number;
}

interface Transform {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

interface BrushSelection {
  startX: number;
  endX: number;
  active: boolean;
  startTime?: number;
  endTime?: number;
}

interface TransformHistory {
  past: Transform[];
  current: Transform;
  future: Transform[];
}

const defaultOptions: ChartOptions = {
  timeWindow: 60000, // 60 seconds
  gridColor: '#333',
  backgroundColor: '#000',
  textColor: '#ccc',
  fontSize: 12,
  showGrid: true,
  showLabels: true,
  smoothing: true,
  enableZoom: true,
  enablePan: true,
  enableBrush: true,
  maxDataPoints: 10000,
  updateInterval: 16, // ~60 FPS
  brushStyle: {
    color: '#4287f5',
    opacity: 0.3,
    borderColor: '#4287f5',
    borderWidth: 2,
  }
};

const EnhancedRealTimeChart: React.FC<EnhancedRealTimeChartProps> = ({
  series,
  yAxes = [],
  options = {},
  width,
  height,
  onPerformanceMetrics,
  onBrushSelect,
  onRangeReset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastRenderTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const droppedFramesRef = useRef<number>(0);
  const performanceMetricsRef = useRef<PerformanceMetrics>({
    fps: 0,
    renderTime: 0,
    dataPoints: 0,
    droppedFrames: 0,
  });

  // Enhanced state
  const [interactionMode, setInteractionMode] = useState<'pan' | 'brush'>('pan');
  const [brushSelection, setBrushSelection] = useState<BrushSelection>({
    startX: 0,
    endX: 0,
    active: false,
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange | null>(null);
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [crosshairPos, setCrosshairPos] = useState({ x: 0, y: 0 });

  // Transform with history
  const [transformHistory, setTransformHistory] = useState<TransformHistory>({
    past: [],
    current: { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
    future: [],
  });

  const transform = transformHistory.current;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);

  const chartOptions = useMemo(() => ({ ...defaultOptions, ...options }), [options]);
  const margin = { top: 40, right: 80, bottom: 60, left: 80 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Memoized y-axis mapping
  const yAxisMap = useMemo(() => {
    const map = new Map<string, YAxis>();
    yAxes.forEach(axis => map.set(axis.id, axis));
    return map;
  }, [yAxes]);

  // Update transform with history
  const updateTransform = useCallback((newTransform: Transform) => {
    setTransformHistory(prev => ({
      past: [...prev.past, prev.current].slice(-20), // Keep last 20 states
      current: newTransform,
      future: [],
    }));
  }, []);

  // Undo/Redo functions
  const canUndo = transformHistory.past.length > 0;
  const canRedo = transformHistory.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;
    setTransformHistory(prev => {
      const newPast = [...prev.past];
      const newCurrent = newPast.pop()!;
      return {
        past: newPast,
        current: newCurrent,
        future: [prev.current, ...prev.future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    setTransformHistory(prev => {
      const newFuture = [...prev.future];
      const newCurrent = newFuture.shift()!;
      return {
        past: [...prev.past, prev.current],
        current: newCurrent,
        future: newFuture,
      };
    });
  }, [canRedo]);

  const resetTransform = useCallback(() => {
    updateTransform({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 });
    setSelectedTimeRange(null);
    setBrushSelection({ startX: 0, endX: 0, active: false });
    if (onRangeReset) onRangeReset();
  }, [updateTransform, onRangeReset]);

  // Calculate axis bounds
  const calculateAxisBounds = useCallback((seriesData: DataSeries[], axis: YAxis) => {
    if (!axis.autoScale) {
      return { min: axis.min ?? 0, max: axis.max ?? 100 };
    }

    let min = Infinity;
    let max = -Infinity;

    seriesData
      .filter(s => (s.yAxisId || 'default') === axis.id)
      .forEach(s => {
        s.data.forEach(point => {
          min = Math.min(min, point.value);
          max = Math.max(max, point.value);
        });
      });

    if (min === Infinity) {
      min = 0;
      max = 100;
    }

    const padding = (max - min) * 0.1;
    return { min: min - padding, max: max + padding };
  }, []);

  // Convert pixel coordinates to time
  const pixelToTime = useCallback((x: number, startTime: number, endTime: number) => {
    const normalizedX = (x - margin.left) / transform.scaleX - transform.offsetX;
    const ratio = normalizedX / chartWidth;
    return startTime + ratio * (endTime - startTime);
  }, [chartWidth, margin.left, transform]);

  // Initialize offscreen canvas
  useEffect(() => {
    if (typeof window !== 'undefined' && 'OffscreenCanvas' in window) {
      offscreenCanvasRef.current = new OffscreenCanvas(width, height);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      offscreenCanvasRef.current = canvas;
    }
  }, [width, height]);

  // Performance monitoring
  const updatePerformanceMetrics = useCallback(() => {
    const now = performance.now();
    const deltaTime = now - lastRenderTimeRef.current;
    
    if (deltaTime > 1000) {
      const fps = (frameCountRef.current * 1000) / deltaTime;
      const dataPoints = series.reduce((sum, s) => sum + s.data.length, 0);
      
      performanceMetricsRef.current = {
        fps: Math.round(fps),
        renderTime: deltaTime / frameCountRef.current,
        dataPoints,
        droppedFrames: droppedFramesRef.current,
      };

      if (onPerformanceMetrics) {
        onPerformanceMetrics(performanceMetricsRef.current);
      }

      frameCountRef.current = 0;
      droppedFramesRef.current = 0;
      lastRenderTimeRef.current = now;
    }

    frameCountRef.current++;
  }, [series, onPerformanceMetrics]);

  // LTTB (Largest Triangle Three Buckets) decimation
  const decimateData = (data: DataPoint[], targetPoints: number): DataPoint[] => {
    if (data.length <= targetPoints) return data;

    const bucketSize = (data.length - 2) / (targetPoints - 2);
    const decimated: DataPoint[] = [data[0]];

    let a = 0;
    for (let i = 0; i < targetPoints - 2; i++) {
      const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
      const avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
      const avgRangeLength = avgRangeEnd - avgRangeStart;

      let avgX = 0;
      let avgY = 0;
      for (let j = avgRangeStart; j < avgRangeEnd && j < data.length; j++) {
        avgX += data[j].timestamp;
        avgY += data[j].value;
      }
      avgX /= avgRangeLength;
      avgY /= avgRangeLength;

      const rangeStart = Math.floor((i + 0) * bucketSize) + 1;
      const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

      const pointA = data[a];
      let maxArea = -1;
      let nextA = rangeStart;

      for (let j = rangeStart; j < rangeEnd && j < data.length; j++) {
        const area = Math.abs(
          (pointA.timestamp - avgX) * (data[j].value - pointA.value) -
          (pointA.timestamp - data[j].timestamp) * (avgY - pointA.value)
        ) * 0.5;

        if (area > maxArea) {
          maxArea = area;
          nextA = j;
        }
      }

      decimated.push(data[nextA]);
      a = nextA;
    }

    decimated.push(data[data.length - 1]);
    return decimated;
  };

  // Draw brush selection
  const drawBrushSelection = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ) => {
    if (!brushSelection.active && !selectedTimeRange) return;

    ctx.save();
    ctx.translate(margin.left, margin.top);

    if (brushSelection.active) {
      // Draw active selection
      const x = Math.min(brushSelection.startX, brushSelection.endX);
      const width = Math.abs(brushSelection.endX - brushSelection.startX);

      ctx.fillStyle = chartOptions.brushStyle!.color;
      ctx.globalAlpha = chartOptions.brushStyle!.opacity;
      ctx.fillRect(x - margin.left, 0, width, chartHeight);

      ctx.strokeStyle = chartOptions.brushStyle!.borderColor;
      ctx.lineWidth = chartOptions.brushStyle!.borderWidth;
      ctx.globalAlpha = 1;
      ctx.strokeRect(x - margin.left, 0, width, chartHeight);
    } else if (selectedTimeRange) {
      // Draw saved selection
      const now = Date.now();
      const startTime = now - chartOptions.timeWindow;
      const startX = ((selectedTimeRange.start - startTime) / (now - startTime)) * chartWidth;
      const endX = ((selectedTimeRange.end - startTime) / (now - startTime)) * chartWidth;

      ctx.fillStyle = chartOptions.brushStyle!.color;
      ctx.globalAlpha = chartOptions.brushStyle!.opacity * 0.5;
      ctx.fillRect(startX, 0, endX - startX, chartHeight);
    }

    ctx.restore();
  };

  // Draw crosshair
  const drawCrosshair = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ) => {
    if (!showCrosshair) return;

    ctx.save();
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(crosshairPos.x, margin.top);
    ctx.lineTo(crosshairPos.x, height - margin.bottom);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(margin.left, crosshairPos.y);
    ctx.lineTo(width - margin.right, crosshairPos.y);
    ctx.stroke();

    // Time label
    const now = Date.now();
    const startTime = now - chartOptions.timeWindow;
    const time = pixelToTime(crosshairPos.x, startTime, now);
    const timeStr = new Date(time).toLocaleTimeString();

    ctx.fillStyle = chartOptions.backgroundColor!;
    ctx.fillRect(crosshairPos.x - 40, height - margin.bottom + 5, 80, 20);
    ctx.fillStyle = chartOptions.textColor!;
    ctx.font = `${chartOptions.fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(timeStr, crosshairPos.x, height - margin.bottom + 18);

    ctx.restore();
  };

  // Main render function (rest of the original render logic)
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!canvas || !offscreenCanvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const offscreenCtx = offscreenCanvas.getContext('2d', { alpha: false });
    if (!ctx || !offscreenCtx) return;

    const renderStartTime = performance.now();

    // Clear canvas
    offscreenCtx.fillStyle = chartOptions.backgroundColor!;
    offscreenCtx.fillRect(0, 0, width, height);

    // Calculate time range
    const now = Date.now();
    const startTime = now - chartOptions.timeWindow;

    // Apply transform
    offscreenCtx.save();
    offscreenCtx.translate(margin.left, margin.top);
    offscreenCtx.scale(transform.scaleX, transform.scaleY);
    offscreenCtx.translate(transform.offsetX, transform.offsetY);

    // Draw grid
    if (chartOptions.showGrid) {
      drawGrid(offscreenCtx, chartWidth, chartHeight, startTime, now);
    }

    // Clip to chart area
    offscreenCtx.beginPath();
    offscreenCtx.rect(0, 0, chartWidth, chartHeight);
    offscreenCtx.clip();

    // Draw each series
    series.forEach(s => {
      const axis = yAxisMap.get(s.yAxisId || 'default') || {
        id: 'default',
        position: 'left',
        autoScale: true,
      } as YAxis;

      const bounds = calculateAxisBounds([s], axis);
      drawSeries(offscreenCtx, s, chartWidth, chartHeight, startTime, now, bounds);
    });

    offscreenCtx.restore();

    // Draw axes and labels
    if (chartOptions.showLabels) {
      drawAxes(offscreenCtx, width, height, margin, startTime, now);
    }

    // Draw brush selection
    drawBrushSelection(offscreenCtx);

    // Draw crosshair
    drawCrosshair(offscreenCtx);

    // Copy to main canvas
    ctx.drawImage(offscreenCanvas, 0, 0);

    // Update performance metrics
    const renderEndTime = performance.now();
    if (renderEndTime - renderStartTime > chartOptions.updateInterval!) {
      droppedFramesRef.current++;
    }

    updatePerformanceMetrics();
  }, [series, yAxisMap, chartOptions, width, height, transform, calculateAxisBounds, 
      updatePerformanceMetrics, brushSelection, selectedTimeRange, showCrosshair, 
      crosshairPos, margin, chartWidth, chartHeight, pixelToTime]);

  // Draw functions (grid, series, axes) - same as original
  const drawGrid = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    startTime: number,
    endTime: number
  ) => {
    ctx.strokeStyle = chartOptions.gridColor!;
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    // Vertical grid lines (time)
    const timeStep = calculateTimeStep(endTime - startTime);
    const firstLine = Math.ceil(startTime / timeStep) * timeStep;
    
    for (let time = firstLine; time <= endTime; time += timeStep) {
      const x = ((time - startTime) / (endTime - startTime)) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const ySteps = 10;
    for (let i = 0; i <= ySteps; i++) {
      const y = (i / ySteps) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  };

  const calculateTimeStep = (range: number): number => {
    const steps = [
      1, 2, 5, 10, 20, 50, 100, 200, 500,
      1000, 2000, 5000, 10000, 20000, 60000,
      120000, 300000, 600000, 1800000, 3600000
    ];

    const targetSteps = 10;
    const idealStep = range / targetSteps;
    
    return steps.find(step => step >= idealStep) || steps[steps.length - 1];
  };

  const drawSeries = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    series: DataSeries,
    width: number,
    height: number,
    startTime: number,
    endTime: number,
    bounds: { min: number; max: number }
  ) => {
    if (series.data.length === 0) return;

    ctx.strokeStyle = series.color;
    ctx.fillStyle = series.color;
    ctx.lineWidth = series.lineWidth || 2;
    ctx.globalAlpha = series.opacity || 1;

    // Filter visible data points
    const visibleData = series.data.filter(
      point => point.timestamp >= startTime && point.timestamp <= endTime
    );

    if (visibleData.length === 0) return;

    // Decimate data if too many points
    const decimatedData = decimateData(visibleData, width);

    // Draw based on type
    switch (series.type) {
      case 'line':
        drawLine(ctx, decimatedData, width, height, startTime, endTime, bounds);
        break;
      case 'scatter':
        drawScatter(ctx, decimatedData, width, height, startTime, endTime, bounds, series.pointRadius || 3);
        break;
      case 'area':
        drawArea(ctx, decimatedData, width, height, startTime, endTime, bounds);
        break;
    }

    ctx.globalAlpha = 1;
  };

  const drawLine = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    data: DataPoint[],
    width: number,
    height: number,
    startTime: number,
    endTime: number,
    bounds: { min: number; max: number }
  ) => {
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = ((point.timestamp - startTime) / (endTime - startTime)) * width;
      const y = height - ((point.value - bounds.min) / (bounds.max - bounds.min)) * height;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };

  const drawScatter = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    data: DataPoint[],
    width: number,
    height: number,
    startTime: number,
    endTime: number,
    bounds: { min: number; max: number },
    radius: number
  ) => {
    data.forEach(point => {
      const x = ((point.timestamp - startTime) / (endTime - startTime)) * width;
      const y = height - ((point.value - bounds.min) / (bounds.max - bounds.min)) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const drawArea = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    data: DataPoint[],
    width: number,
    height: number,
    startTime: number,
    endTime: number,
    bounds: { min: number; max: number }
  ) => {
    ctx.beginPath();
    data.forEach((point, i) => {
      const x = ((point.timestamp - startTime) / (endTime - startTime)) * width;
      const y = height - ((point.value - bounds.min) / (bounds.max - bounds.min)) * height;
      
      if (i === 0) {
        ctx.moveTo(x, height);
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    const lastX = ((data[data.length - 1].timestamp - startTime) / (endTime - startTime)) * width;
    ctx.lineTo(lastX, height);
    ctx.closePath();
    
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  };

  const drawAxes = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number },
    startTime: number,
    endTime: number
  ) => {
    ctx.strokeStyle = chartOptions.textColor!;
    ctx.fillStyle = chartOptions.textColor!;
    ctx.font = `${chartOptions.fontSize}px Arial`;
    ctx.lineWidth = 1;

    // Draw axes lines
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Draw time labels
    const timeStep = calculateTimeStep(endTime - startTime);
    const firstLabel = Math.ceil(startTime / timeStep) * timeStep;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    for (let time = firstLabel; time <= endTime; time += timeStep) {
      const x = margin.left + ((time - startTime) / (endTime - startTime)) * (width - margin.left - margin.right);
      const timeStr = new Date(time).toLocaleTimeString();
      ctx.fillText(timeStr, x, height - margin.bottom + 5);
    }

    // Draw y-axis labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const ySteps = 10;
    for (let i = 0; i <= ySteps; i++) {
      const y = margin.top + (i / ySteps) * (height - margin.top - margin.bottom);
      const value = (1 - i / ySteps) * 100;
      ctx.fillText(value.toFixed(0), margin.left - 10, y);
    }
  };

  // Mouse event handlers with brush support
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (interactionMode === 'brush' && chartOptions.enableBrush) {
      setBrushSelection({
        startX: x,
        endX: x,
        active: true,
      });
    } else if (interactionMode === 'pan' && chartOptions.enablePan) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [interactionMode, chartOptions.enableBrush, chartOptions.enablePan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update crosshair
    setCrosshairPos({ x, y });

    if (brushSelection.active && interactionMode === 'brush') {
      setBrushSelection(prev => ({
        ...prev,
        endX: x,
      }));
    } else if (isDragging && interactionMode === 'pan' && chartOptions.enablePan) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;

      updateTransform({
        ...transform,
        offsetX: transform.offsetX + dx / transform.scaleX,
        offsetY: transform.offsetY + dy / transform.scaleY,
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [brushSelection.active, interactionMode, isDragging, dragStart, 
      chartOptions.enablePan, transform, updateTransform]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (brushSelection.active && interactionMode === 'brush') {
      const now = Date.now();
      const startTime = now - chartOptions.timeWindow;
      
      const startTimeSelected = pixelToTime(
        Math.min(brushSelection.startX, brushSelection.endX),
        startTime,
        now
      );
      const endTimeSelected = pixelToTime(
        Math.max(brushSelection.startX, brushSelection.endX),
        startTime,
        now
      );

      if (Math.abs(endTimeSelected - startTimeSelected) > 100) { // Minimum 100ms selection
        const timeRange = { start: startTimeSelected, end: endTimeSelected };
        setSelectedTimeRange(timeRange);
        if (onBrushSelect) {
          onBrushSelect(timeRange);
        }
      }

      setBrushSelection({ startX: 0, endX: 0, active: false });
    }
    
    setIsDragging(false);
  }, [brushSelection, interactionMode, chartOptions.timeWindow, pixelToTime, onBrushSelect]);

  const handleMouseEnter = useCallback(() => {
    setShowCrosshair(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowCrosshair(false);
    handleMouseUp(null as any);
  }, [handleMouseUp]);

  // Wheel handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!chartOptions.enableZoom) return;
    e.preventDefault();
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    updateTransform({
      ...transform,
      scaleX: Math.max(0.1, Math.min(10, transform.scaleX * scaleFactor)),
      scaleY: Math.max(0.1, Math.min(10, transform.scaleY * scaleFactor)),
    });
  }, [chartOptions.enableZoom, transform, updateTransform]);

  // Touch handlers (same as original)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && chartOptions.enableZoom) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setPinchDistance(distance);
    } else if (e.touches.length === 1 && chartOptions.enablePan) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [chartOptions.enableZoom, chartOptions.enablePan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchDistance !== null && chartOptions.enableZoom) {
      const newDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const scale = newDistance / pinchDistance;
      updateTransform({
        ...transform,
        scaleX: Math.max(0.1, Math.min(10, transform.scaleX * scale)),
        scaleY: Math.max(0.1, Math.min(10, transform.scaleY * scale)),
      });
      
      setPinchDistance(newDistance);
    } else if (e.touches.length === 1 && isDragging && chartOptions.enablePan) {
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;

      updateTransform({
        ...transform,
        offsetX: transform.offsetX + dx / transform.scaleX,
        offsetY: transform.offsetY + dy / transform.scaleY,
      });

      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [pinchDistance, isDragging, dragStart, chartOptions.enableZoom, 
      chartOptions.enablePan, transform, updateTransform]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setPinchDistance(null);
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Quick zoom functions
  const zoomIn = useCallback(() => {
    updateTransform({
      ...transform,
      scaleX: Math.min(10, transform.scaleX * 1.2),
      scaleY: Math.min(10, transform.scaleY * 1.2),
    });
  }, [transform, updateTransform]);

  const zoomOut = useCallback(() => {
    updateTransform({
      ...transform,
      scaleX: Math.max(0.1, transform.scaleX * 0.8),
      scaleY: Math.max(0.1, transform.scaleY * 0.8),
    });
  }, [transform, updateTransform]);

  return (
    <Box sx={{ position: 'relative', width, height }}>
      {/* Controls */}
      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 1,
          padding: 0.5,
        }}
      >
        <ToggleButtonGroup
          value={interactionMode}
          exclusive
          onChange={(_, newMode) => newMode && setInteractionMode(newMode)}
          size="small"
        >
          <ToggleButton value="pan" aria-label="pan mode">
            <Tooltip title="Pan Mode">
              <PanIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="brush" aria-label="brush mode">
            <Tooltip title="Brush Selection Mode">
              <BrushIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <IconButton size="small" onClick={zoomIn} disabled={transform.scaleX >= 10}>
          <ZoomInIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={zoomOut} disabled={transform.scaleX <= 0.1}>
          <ZoomOutIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={resetTransform}>
          <ResetIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={undo} disabled={!canUndo}>
          <UndoIcon fontSize="small" />
        </IconButton>

        <IconButton size="small" onClick={redo} disabled={!canRedo}>
          <RedoIcon fontSize="small" />
        </IconButton>
      </Stack>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ 
          cursor: interactionMode === 'brush' ? 'crosshair' : 
                  isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </Box>
  );
};

export default React.memo(EnhancedRealTimeChart);