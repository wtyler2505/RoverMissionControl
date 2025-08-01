/**
 * VisualizationPanel Component - 3D visualization and charts
 * Mission-critical visualization interface for rover monitoring
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PanelProps } from '../../../types/grid';
import './PanelStyles.css';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface RoverState {
  position: Point3D;
  orientation: Point3D; // roll, pitch, yaw
  path: Point3D[];
  obstacles: Point3D[];
  targetWaypoint?: Point3D;
}

interface ChartData {
  timestamp: number;
  value: number;
}

interface VisualizationPanelProps extends PanelProps {
  roverState?: RoverState;
  chartData?: Record<string, ChartData[]>;
  viewMode?: '3d' | 'chart' | 'map';
  showGrid?: boolean;
  showPath?: boolean;
  showObstacles?: boolean;
}

// Simple 3D renderer using Canvas
const Simple3DRenderer: React.FC<{
  roverState: RoverState;
  width: number;
  height: number;
  showGrid: boolean;
  showPath: boolean;
  showObstacles: boolean;
}> = ({ roverState, width, height, showGrid, showPath, showObstacles }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: -30, y: 45 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });

  // Simple 3D to 2D projection
  const project3D = (point: Point3D, width: number, height: number) => {
    const { x, y, z } = point;
    const { x: rotX, y: rotY } = rotation;
    
    // Apply rotation
    const cosRotX = Math.cos(rotX * Math.PI / 180);
    const sinRotX = Math.sin(rotX * Math.PI / 180);
    const cosRotY = Math.cos(rotY * Math.PI / 180);
    const sinRotY = Math.sin(rotY * Math.PI / 180);
    
    const rotatedX = x * cosRotY - z * sinRotY;
    const rotatedZ = x * sinRotY + z * cosRotY;
    const rotatedY = y * cosRotX - rotatedZ * sinRotX;
    
    // Project to 2D
    const scale = zoom * 200;
    const projectedX = width / 2 + rotatedX * scale;
    const projectedY = height / 2 - rotatedY * scale;
    
    return { x: projectedX, y: projectedY };
  };

  // Draw the 3D scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
      ctx.lineWidth = 1;
      
      for (let i = -10; i <= 10; i += 2) {
        // Grid lines along X axis
        const start = project3D({ x: i, y: 0, z: -10 }, width, height);
        const end = project3D({ x: i, y: 0, z: 10 }, width, height);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        
        // Grid lines along Z axis
        const start2 = project3D({ x: -10, y: 0, z: i }, width, height);
        const end2 = project3D({ x: 10, y: 0, z: i }, width, height);
        ctx.beginPath();
        ctx.moveTo(start2.x, start2.y);
        ctx.lineTo(end2.x, end2.y);
        ctx.stroke();
      }
    }

    // Draw path
    if (showPath && roverState.path.length > 1) {
      ctx.strokeStyle = '#4CAF50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const firstPoint = project3D(roverState.path[0], width, height);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < roverState.path.length; i++) {
        const point = project3D(roverState.path[i], width, height);
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Draw obstacles
    if (showObstacles && roverState.obstacles.length > 0) {
      ctx.fillStyle = '#F44336';
      roverState.obstacles.forEach(obstacle => {
        const point = project3D(obstacle, width, height);
        ctx.beginPath();
        ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw target waypoint
    if (roverState.targetWaypoint) {
      const target = project3D(roverState.targetWaypoint, width, height);
      ctx.strokeStyle = '#FF9800';
      ctx.fillStyle = '#FF9800';
      ctx.lineWidth = 2;
      
      // Draw crosshair
      ctx.beginPath();
      ctx.moveTo(target.x - 10, target.y);
      ctx.lineTo(target.x + 10, target.y);
      ctx.moveTo(target.x, target.y - 10);
      ctx.lineTo(target.x, target.y + 10);
      ctx.stroke();
      
      // Draw center dot
      ctx.beginPath();
      ctx.arc(target.x, target.y, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw rover
    const roverPos = project3D(roverState.position, width, height);
    const { roll, pitch, yaw } = roverState.orientation;
    
    ctx.save();
    ctx.translate(roverPos.x, roverPos.y);
    ctx.rotate(yaw * Math.PI / 180);
    
    // Rover body
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(-15, -10, 30, 20);
    
    // Direction indicator
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(25, -5);
    ctx.lineTo(25, 5);
    ctx.closePath();
    ctx.fill();
    
    // Wheels
    ctx.fillStyle = '#424242';
    ctx.fillRect(-18, -12, 6, 4);
    ctx.fillRect(-18, 8, 6, 4);
    ctx.fillRect(12, -12, 6, 4);
    ctx.fillRect(12, 8, 6, 4);
    
    ctx.restore();

    // Draw coordinate axes
    const origin = project3D({ x: 0, y: 0, z: 0 }, width, height);
    const xAxis = project3D({ x: 2, y: 0, z: 0 }, width, height);
    const yAxis = project3D({ x: 0, y: 2, z: 0 }, width, height);
    const zAxis = project3D({ x: 0, y: 0, z: 2 }, width, height);
    
    // X axis (red)
    ctx.strokeStyle = '#F44336';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(xAxis.x, xAxis.y);
    ctx.stroke();
    
    // Y axis (green)
    ctx.strokeStyle = '#4CAF50';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(yAxis.x, yAxis.y);
    ctx.stroke();
    
    // Z axis (blue)
    ctx.strokeStyle = '#2196F3';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(zAxis.x, zAxis.y);
    ctx.stroke();

  }, [roverState, width, height, rotation, zoom, showGrid, showPath, showObstacles]);

  // Mouse interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;
    
    setRotation(prev => ({
      x: Math.max(-90, Math.min(90, prev.x + deltaY * 0.5)),
      y: prev.y + deltaX * 0.5
    }));
    
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.1, Math.min(3, prev - e.deltaY * 0.001)));
  };

  return (
    <div className="simple-3d-renderer">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />
      <div className="renderer-info">
        <div>Rotation: X{rotation.x.toFixed(0)}° Y{rotation.y.toFixed(0)}°</div>
        <div>Zoom: {(zoom * 100).toFixed(0)}%</div>
      </div>
    </div>
  );
};

// Simple line chart component
const SimpleChart: React.FC<{
  data: ChartData[];
  color: string;
  label: string;
  width: number;
  height: number;
  unit?: string;
}> = ({ data, color, label, width, height, unit = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find data bounds
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Draw grid
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i / 4) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    // Draw data line
    if (data.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = padding + (1 - (point.value - minValue) / valueRange) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();

      // Fill area under curve
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = color;
      ctx.lineTo(width - padding, height - padding);
      ctx.lineTo(padding, height - padding);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${label} (${unit})`, padding, padding - 10);
    
    // Y-axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const value = minValue + (i / 4) * valueRange;
      const y = height - padding - (i / 4) * chartHeight;
      ctx.fillText(value.toFixed(1), padding - 5, y + 4);
    }

  }, [data, color, label, width, height, unit]);

  return <canvas ref={canvasRef} className="simple-chart" />;
};

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({
  id,
  config = {},
  roverState,
  chartData,
  viewMode = '3d',
  showGrid = true,
  showPath = true,
  showObstacles = true,
  isMinimized
}) => {
  const [currentViewMode, setCurrentViewMode] = useState(viewMode);
  const [selectedChart, setSelectedChart] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Mock data for demonstration
  const mockRoverState: RoverState = useMemo(() => roverState || {
    position: { x: 2, y: 0, z: 1 },
    orientation: { roll: 0, pitch: 5, yaw: 45 },
    path: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0.5 },
      { x: 2, y: 0, z: 1 },
      { x: 3, y: 0, z: 1.2 },
      { x: 4, y: 0, z: 1.5 }
    ],
    obstacles: [
      { x: 3, y: 0, z: 2 },
      { x: -2, y: 0, z: 3 },
      { x: 1, y: 0, z: -2 }
    ],
    targetWaypoint: { x: 5, y: 0, z: 2 }
  }, [roverState]);

  const mockChartData = useMemo(() => chartData || {
    speed: Array.from({ length: 50 }, (_, i) => ({
      timestamp: Date.now() - (50 - i) * 1000,
      value: Math.sin(i * 0.1) * 0.5 + 1 + Math.random() * 0.2
    })),
    battery: Array.from({ length: 50 }, (_, i) => ({
      timestamp: Date.now() - (50 - i) * 1000,
      value: 100 - i * 0.5 + Math.random() * 2
    })),
    temperature: Array.from({ length: 50 }, (_, i) => ({
      timestamp: Date.now() - (50 - i) * 1000,
      value: 25 + Math.sin(i * 0.05) * 5 + Math.random() * 1
    }))
  }, [chartData]);

  // Update dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width - 20,
          height: rect.height - 80 // Account for controls
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  if (isMinimized) {
    return (
      <div className="visualization-panel-minimized">
        <div className="mini-3d-view">
          <Simple3DRenderer
            roverState={mockRoverState}
            width={100}
            height={60}
            showGrid={false}
            showPath={true}
            showObstacles={false}
          />
        </div>
        <div className="position-info">
          Position: ({mockRoverState.position.x.toFixed(1)}, {mockRoverState.position.y.toFixed(1)}, {mockRoverState.position.z.toFixed(1)})
        </div>
      </div>
    );
  }

  return (
    <div className="visualization-panel" ref={containerRef}>
      {/* View mode controls */}
      <div className="view-controls">
        <div className="view-mode-tabs">
          <button
            className={`view-tab ${currentViewMode === '3d' ? 'active' : ''}`}
            onClick={() => setCurrentViewMode('3d')}
          >
            3D View
          </button>
          <button
            className={`view-tab ${currentViewMode === 'chart' ? 'active' : ''}`}
            onClick={() => setCurrentViewMode('chart')}
          >
            Charts
          </button>
          <button
            className={`view-tab ${currentViewMode === 'map' ? 'active' : ''}`}
            onClick={() => setCurrentViewMode('map')}
          >
            Map
          </button>
        </div>

        {currentViewMode === '3d' && (
          <div className="view-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid?.(e.target.checked)}
              />
              Grid
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showPath}
                onChange={(e) => setShowPath?.(e.target.checked)}
              />
              Path
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showObstacles}
                onChange={(e) => setShowObstacles?.(e.target.checked)}
              />
              Obstacles
            </label>
          </div>
        )}

        {currentViewMode === 'chart' && (
          <div className="chart-selector">
            <select
              value={selectedChart}
              onChange={(e) => setSelectedChart(e.target.value)}
            >
              <option value="">Select chart...</option>
              {Object.keys(mockChartData).map(key => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Visualization content */}
      <div className="visualization-content">
        {currentViewMode === '3d' && (
          <Simple3DRenderer
            roverState={mockRoverState}
            width={dimensions.width}
            height={dimensions.height}
            showGrid={showGrid}
            showPath={showPath}
            showObstacles={showObstacles}
          />
        )}

        {currentViewMode === 'chart' && (
          <div className="charts-container">
            {selectedChart && mockChartData[selectedChart] ? (
              <SimpleChart
                data={mockChartData[selectedChart]}
                color={
                  selectedChart === 'speed' ? '#2196F3' :
                  selectedChart === 'battery' ? '#4CAF50' :
                  selectedChart === 'temperature' ? '#FF9800' : '#9C27B0'
                }
                label={selectedChart.charAt(0).toUpperCase() + selectedChart.slice(1)}
                width={dimensions.width}
                height={dimensions.height}
                unit={
                  selectedChart === 'speed' ? 'm/s' :
                  selectedChart === 'battery' ? '%' :
                  selectedChart === 'temperature' ? '°C' : ''
                }
              />
            ) : (
              <div className="chart-placeholder">
                <div className="placeholder-content">
                  <div className="placeholder-icon">📊</div>
                  <div>Select a chart from the dropdown above</div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentViewMode === 'map' && (
          <div className="map-container">
            <div className="map-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-icon">🗺️</div>
                <div>Map view will be available when GPS data is connected</div>
                <div className="map-info">
                  <div>Current Position: ({mockRoverState.position.x.toFixed(2)}, {mockRoverState.position.z.toFixed(2)})</div>
                  <div>Heading: {mockRoverState.orientation.yaw.toFixed(1)}°</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status info */}
      <div className="visualization-status">
        <div className="status-item">
          <span className="label">Position:</span>
          <span className="value">
            ({mockRoverState.position.x.toFixed(2)}, {mockRoverState.position.y.toFixed(2)}, {mockRoverState.position.z.toFixed(2)})
          </span>
        </div>
        <div className="status-item">
          <span className="label">Orientation:</span>
          <span className="value">
            R{mockRoverState.orientation.roll.toFixed(1)}° 
            P{mockRoverState.orientation.pitch.toFixed(1)}° 
            Y{mockRoverState.orientation.yaw.toFixed(1)}°
          </span>
        </div>
        <div className="status-item">
          <span className="label">Waypoints:</span>
          <span className="value">{mockRoverState.path.length}</span>
        </div>
      </div>
    </div>
  );
};

export default VisualizationPanel;