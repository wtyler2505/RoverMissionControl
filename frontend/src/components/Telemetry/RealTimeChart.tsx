import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { throttle, debounce } from 'lodash';

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
  maxDataPoints?: number;
  updateInterval?: number; // milliseconds
}

interface RealTimeChartProps {
  series: DataSeries[];
  yAxes?: YAxis[];
  options?: Partial<ChartOptions>;
  width: number;
  height: number;
  onPerformanceMetrics?: (metrics: PerformanceMetrics) => void;
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
  maxDataPoints: 10000,
  updateInterval: 16, // ~60 FPS
};

const RealTimeChart: React.FC<RealTimeChartProps> = ({
  series,
  yAxes = [],
  options = {},
  width,
  height,
  onPerformanceMetrics,
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

  const [transform, setTransform] = useState<Transform>({
    offsetX: 0,
    offsetY: 0,
    scaleX: 1,
    scaleY: 1,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);

  const chartOptions = useMemo(() => ({ ...defaultOptions, ...options }), [options]);

  // Memoized y-axis mapping
  const yAxisMap = useMemo(() => {
    const map = new Map<string, YAxis>();
    yAxes.forEach(axis => map.set(axis.id, axis));
    return map;
  }, [yAxes]);

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

  // Main render function
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

    // Set up drawing area (leave space for axes)
    const margin = { top: 20, right: 80, bottom: 40, left: 80 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

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

    // Copy to main canvas
    ctx.drawImage(offscreenCanvas, 0, 0);

    // Update performance metrics
    const renderEndTime = performance.now();
    if (renderEndTime - renderStartTime > chartOptions.updateInterval!) {
      droppedFramesRef.current++;
    }

    updatePerformanceMetrics();
  }, [series, yAxisMap, chartOptions, width, height, transform, calculateAxisBounds, updatePerformanceMetrics]);

  // Draw grid lines
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

  // Calculate appropriate time step for grid
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

  // Draw data series
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

  // Decimate data for performance
  const decimateData = (data: DataPoint[], targetWidth: number): DataPoint[] => {
    if (data.length <= targetWidth * 2) return data;

    const bucketSize = Math.ceil(data.length / targetWidth);
    const decimated: DataPoint[] = [];

    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize);
      if (bucket.length === 0) continue;

      // Use LTTB algorithm (Largest Triangle Three Buckets) for better decimation
      if (i === 0 || i + bucketSize >= data.length) {
        decimated.push(bucket[0]);
      } else {
        const prev = decimated[decimated.length - 1];
        const next = data[Math.min(i + bucketSize, data.length - 1)];
        
        let maxArea = 0;
        let maxPoint = bucket[0];

        bucket.forEach(point => {
          const area = Math.abs(
            (prev.timestamp - next.timestamp) * (point.value - prev.value) -
            (prev.timestamp - point.timestamp) * (next.value - prev.value)
          );
          if (area > maxArea) {
            maxArea = area;
            maxPoint = point;
          }
        });

        decimated.push(maxPoint);
      }
    }

    return decimated;
  };

  // Draw line chart
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

    data.forEach((point, index) => {
      const x = ((point.timestamp - startTime) / (endTime - startTime)) * width;
      const y = height - ((point.value - bounds.min) / (bounds.max - bounds.min)) * height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else if (chartOptions.smoothing) {
        const prevPoint = data[index - 1];
        const prevX = ((prevPoint.timestamp - startTime) / (endTime - startTime)) * width;
        const prevY = height - ((prevPoint.value - bounds.min) / (bounds.max - bounds.min)) * height;
        
        const cp1x = prevX + (x - prevX) * 0.3;
        const cp1y = prevY;
        const cp2x = x - (x - prevX) * 0.3;
        const cp2y = y;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  };

  // Draw scatter plot
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
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Draw area chart
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

    // Start from bottom left
    const firstX = ((data[0].timestamp - startTime) / (endTime - startTime)) * width;
    ctx.moveTo(firstX, height);

    // Draw top line
    data.forEach((point, index) => {
      const x = ((point.timestamp - startTime) / (endTime - startTime)) * width;
      const y = height - ((point.value - bounds.min) / (bounds.max - bounds.min)) * height;

      if (index === 0) {
        ctx.lineTo(x, y);
      } else if (chartOptions.smoothing) {
        const prevPoint = data[index - 1];
        const prevX = ((prevPoint.timestamp - startTime) / (endTime - startTime)) * width;
        const prevY = height - ((prevPoint.value - bounds.min) / (bounds.max - bounds.min)) * height;
        
        const cp1x = prevX + (x - prevX) * 0.3;
        const cp1y = prevY;
        const cp2x = x - (x - prevX) * 0.3;
        const cp2y = y;
        
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Close path
    const lastX = ((data[data.length - 1].timestamp - startTime) / (endTime - startTime)) * width;
    ctx.lineTo(lastX, height);
    ctx.closePath();

    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  };

  // Draw axes and labels
  const drawAxes = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    width: number,
    height: number,
    margin: { top: number; right: number; bottom: number; left: number },
    startTime: number,
    endTime: number
  ) => {
    ctx.fillStyle = chartOptions.textColor!;
    ctx.font = `${chartOptions.fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Draw time labels
    const timeStep = calculateTimeStep(endTime - startTime);
    const firstLine = Math.ceil(startTime / timeStep) * timeStep;
    
    for (let time = firstLine; time <= endTime; time += timeStep) {
      const x = margin.left + ((time - startTime) / (endTime - startTime)) * (width - margin.left - margin.right);
      const date = new Date(time);
      const label = formatTimeLabel(date, timeStep);
      ctx.fillText(label, x, height - margin.bottom + 5);
    }

    // Draw Y axes
    yAxes.forEach(axis => {
      const bounds = calculateAxisBounds(series.filter(s => (s.yAxisId || 'default') === axis.id), axis);
      const x = axis.position === 'left' ? margin.left - 10 : width - margin.right + 10;
      
      ctx.textAlign = axis.position === 'left' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = axis.color || chartOptions.textColor!;

      // Draw axis labels
      const steps = 5;
      for (let i = 0; i <= steps; i++) {
        const value = bounds.min + (bounds.max - bounds.min) * (i / steps);
        const y = height - margin.bottom - (i / steps) * (height - margin.top - margin.bottom);
        ctx.fillText(value.toFixed(2), x, y);
      }

      // Draw axis title
      ctx.save();
      ctx.translate(axis.position === 'left' ? 20 : width - 20, height / 2);
      ctx.rotate(axis.position === 'left' ? -Math.PI / 2 : Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(axis.label, 0, 0);
      ctx.restore();
    });
  };

  // Format time label based on range
  const formatTimeLabel = (date: Date, step: number): string => {
    if (step < 1000) {
      return date.toLocaleTimeString() + '.' + date.getMilliseconds();
    } else if (step < 60000) {
      return date.toLocaleTimeString();
    } else if (step < 3600000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    }
  };

  // Animation loop
  const animate = useCallback(() => {
    render();
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [render]);

  // Handle mouse/touch events
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!chartOptions.enableZoom) return;
    e.preventDefault();

    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    
    setTransform(prev => ({
      ...prev,
      scaleX: Math.max(0.1, Math.min(10, prev.scaleX * scaleFactor)),
      scaleY: Math.max(0.1, Math.min(10, prev.scaleY * scaleFactor)),
    }));
  }, [chartOptions.enableZoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!chartOptions.enablePan) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [chartOptions.enablePan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !chartOptions.enablePan) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setTransform(prev => ({
      ...prev,
      offsetX: prev.offsetX + dx / prev.scaleX,
      offsetY: prev.offsetY + dy / prev.scaleY,
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, chartOptions.enablePan]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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
      
      const scaleFactor = newDistance / pinchDistance;
      
      setTransform(prev => ({
        ...prev,
        scaleX: Math.max(0.1, Math.min(10, prev.scaleX * scaleFactor)),
        scaleY: Math.max(0.1, Math.min(10, prev.scaleY * scaleFactor)),
      }));
      
      setPinchDistance(newDistance);
    } else if (e.touches.length === 1 && isDragging && chartOptions.enablePan) {
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;

      setTransform(prev => ({
        ...prev,
        offsetX: prev.offsetX + dx / prev.scaleX,
        offsetY: prev.offsetY + dy / prev.scaleY,
      }));

      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [pinchDistance, isDragging, dragStart, chartOptions.enableZoom, chartOptions.enablePan]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setPinchDistance(null);
  }, []);

  // Throttled render for performance
  const throttledRender = useMemo(
    () => throttle(render, chartOptions.updateInterval!),
    [render, chartOptions.updateInterval]
  );

  // Start animation loop
  useEffect(() => {
    if (!lastRenderTimeRef.current) {
      lastRenderTimeRef.current = performance.now();
    }
    animate();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [animate]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    if (!canvas || !offscreenCanvas) return;

    canvas.width = width;
    canvas.height = height;
    
    if ('width' in offscreenCanvas) {
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
    }
  }, [width, height]);

  // Add wheel event listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ 
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
};

export default React.memo(RealTimeChart);