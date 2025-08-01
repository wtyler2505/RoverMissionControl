/**
 * TelemetryPanel Component - Real-time sensor data display
 * Mission-critical telemetry interface for rover monitoring
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PanelProps } from '../../../types/grid';
import './PanelStyles.css';

interface TelemetryData {
  timestamp: number;
  sensors: {
    temperature: number;
    humidity: number;
    pressure: number;
    battery: {
      voltage: number;
      current: number;
      percentage: number;
    };
    position: {
      x: number;
      y: number;
      z: number;
    };
    orientation: {
      roll: number;
      pitch: number;
      yaw: number;
    };
    wheels: {
      fl: { rpm: number; temp: number; current: number };
      fr: { rpm: number; temp: number; current: number };
      rl: { rpm: number; temp: number; current: number };
      rr: { rpm: number; temp: number; current: number };
    };
  };
  status: 'nominal' | 'warning' | 'critical' | 'offline';
}

interface TelemetryPanelProps extends PanelProps {
  data?: TelemetryData;
  updateInterval?: number;
  showGraphs?: boolean;
  compactMode?: boolean;
}

// Mock data generator for demonstration
const generateMockTelemetry = (): TelemetryData => ({
  timestamp: Date.now(),
  sensors: {
    temperature: 22 + Math.random() * 8 - 4,
    humidity: 45 + Math.random() * 20 - 10,
    pressure: 1013 + Math.random() * 50 - 25,
    battery: {
      voltage: 48 + Math.random() * 4 - 2,
      current: 2.5 + Math.random() * 1 - 0.5,
      percentage: 85 + Math.random() * 10 - 5
    },
    position: {
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      z: Math.random() * 10
    },
    orientation: {
      roll: Math.random() * 20 - 10,
      pitch: Math.random() * 20 - 10,
      yaw: Math.random() * 360
    },
    wheels: {
      fl: { rpm: Math.random() * 200, temp: 35 + Math.random() * 10, current: 1 + Math.random() },
      fr: { rpm: Math.random() * 200, temp: 35 + Math.random() * 10, current: 1 + Math.random() },
      rl: { rpm: Math.random() * 200, temp: 35 + Math.random() * 10, current: 1 + Math.random() },
      rr: { rpm: Math.random() * 200, temp: 35 + Math.random() * 10, current: 1 + Math.random() }
    }
  },
  status: Math.random() > 0.9 ? 'warning' : Math.random() > 0.95 ? 'critical' : 'nominal'
});

// Telemetry display components
const TelemetryGauge: React.FC<{
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  size?: 'small' | 'medium' | 'large';
}> = ({ 
  label, 
  value, 
  unit, 
  min, 
  max, 
  warningThreshold, 
  criticalThreshold, 
  size = 'medium' 
}) => {
  const percentage = ((value - min) / (max - min)) * 100;
  const angle = (percentage / 100) * 180 - 90;
  
  const status = useMemo(() => {
    if (criticalThreshold && (value >= criticalThreshold || value <= min + (max - min) * 0.1)) {
      return 'critical';
    }
    if (warningThreshold && (value >= warningThreshold || value <= min + (max - min) * 0.2)) {
      return 'warning';
    }
    return 'normal';
  }, [value, min, max, warningThreshold, criticalThreshold]);

  const sizeClass = `gauge-${size}`;
  const statusClass = `gauge-${status}`;

  return (
    <div className={`telemetry-gauge ${sizeClass} ${statusClass}`}>
      <div className="gauge-label">{label}</div>
      <div className="gauge-container">
        <svg viewBox="0 0 100 60" className="gauge-svg">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="var(--gauge-track-color)"
            strokeWidth="6"
            fill="none"
          />
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="var(--gauge-fill-color)"
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${percentage * 1.26} 126`}
            strokeLinecap="round"
          />
          <g transform={`translate(50, 50) rotate(${angle})`}>
            <line 
              x1="0" 
              y1="0" 
              x2="0" 
              y2="-32" 
              stroke="var(--gauge-needle-color)" 
              strokeWidth="2" 
              strokeLinecap="round"
            />
            <circle cx="0" cy="0" r="3" fill="var(--gauge-needle-color)" />
          </g>
        </svg>
        <div className="gauge-value">
          <span className="value">{value.toFixed(1)}</span>
          <span className="unit">{unit}</span>
        </div>
      </div>
    </div>
  );
};

const DataGrid: React.FC<{
  data: Record<string, { value: number | string; unit?: string; status?: string }>;
  columns?: number;
}> = ({ data, columns = 2 }) => {
  return (
    <div className={`data-grid cols-${columns}`}>
      {Object.entries(data).map(([key, item]) => (
        <div key={key} className={`data-item ${item.status ? `status-${item.status}` : ''}`}>
          <div className="data-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
          <div className="data-value">
            <span className="value">{typeof item.value === 'number' ? item.value.toFixed(2) : item.value}</span>
            {item.unit && <span className="unit">{item.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
};

const MiniChart: React.FC<{
  data: number[];
  color: string;
  height?: number;
}> = ({ data, color, height = 40 }) => {
  const points = useMemo(() => {
    const width = 100;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    return data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
  }, [data, height]);

  return (
    <div className="mini-chart">
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.1"/>
          </linearGradient>
        </defs>
        <polygon
          points={`0,${height} ${points} 100,${height}`}
          fill="url(#chartGradient)"
        />
      </svg>
    </div>
  );
};

const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  id,
  data: externalData,
  config = {},
  updateInterval = 1000,
  showGraphs = true,
  compactMode = false,
  theme,
  isMinimized
}) => {
  const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [dataHistory, setDataHistory] = useState<number[][]>([[], [], [], []]); // For mini charts

  // Update telemetry data
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const updateData = () => {
      const newData = externalData || generateMockTelemetry();
      setTelemetryData(newData);
      setLastUpdate(Date.now());
      setConnectionStatus('connected');

      // Update data history for charts
      if (showGraphs) {
        setDataHistory(prev => {
          const newHistory = [...prev];
          newHistory[0] = [...newHistory[0].slice(-19), newData.sensors.temperature];
          newHistory[1] = [...newHistory[1].slice(-19), newData.sensors.battery.percentage];
          newHistory[2] = [...newHistory[2].slice(-19), newData.sensors.pressure];
          newHistory[3] = [...newHistory[3].slice(-19), (newData.sensors.wheels.fl.rpm + newData.sensors.wheels.fr.rpm + newData.sensors.wheels.rl.rpm + newData.sensors.wheels.rr.rpm) / 4];
          return newHistory;
        });
      }
    };

    // Initial load
    updateData();

    // Set up interval
    intervalId = setInterval(updateData, updateInterval);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [externalData, updateInterval, showGraphs]);

  // Connection timeout check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Date.now() - lastUpdate > updateInterval * 3) {
        setConnectionStatus('disconnected');
      }
    }, updateInterval * 3);

    return () => clearTimeout(timeoutId);
  }, [lastUpdate, updateInterval]);

  const formatTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'critical': return 'var(--color-error-main)';
      case 'warning': return 'var(--color-warning-main)';
      case 'nominal': return 'var(--color-success-main)';
      default: return 'var(--color-text-secondary)';
    }
  }, []);

  if (isMinimized) {
    return (
      <div className="telemetry-panel-minimized">
        <div className="minimized-status">
          <div className={`status-indicator ${telemetryData?.status || 'offline'}`} />
          <span>Telemetry: {telemetryData?.status || 'Offline'}</span>
          <span className="last-update">
            {lastUpdate ? formatTimestamp(lastUpdate) : 'No data'}
          </span>
        </div>
      </div>
    );
  }

  if (!telemetryData) {
    return (
      <div className="telemetry-panel-loading">
        <div className="loading-spinner" />
        <span>Loading telemetry data...</span>
      </div>
    );
  }

  const { sensors, status, timestamp } = telemetryData;

  return (
    <div className={`telemetry-panel ${compactMode ? 'compact' : ''}`}>
      {/* Header */}
      <div className="panel-status-header">
        <div className="status-section">
          <div className={`connection-indicator ${connectionStatus}`} />
          <span className="connection-status">{connectionStatus}</span>
          <div className={`system-status ${status}`} style={{ color: getStatusColor(status) }}>
            {status.toUpperCase()}
          </div>
        </div>
        <div className="timestamp">
          Last update: {formatTimestamp(timestamp)}
        </div>
      </div>

      {/* Main content */}
      <div className="telemetry-content">
        {/* Primary gauges */}
        <div className="gauge-section">
          <TelemetryGauge
            label="Temperature"
            value={sensors.temperature}
            unit="°C"
            min={-10}
            max={50}
            warningThreshold={35}
            criticalThreshold={45}
            size={compactMode ? 'small' : 'medium'}
          />
          <TelemetryGauge
            label="Battery"
            value={sensors.battery.percentage}
            unit="%"
            min={0}
            max={100}
            warningThreshold={30}
            criticalThreshold={15}
            size={compactMode ? 'small' : 'medium'}
          />
          <TelemetryGauge
            label="Pressure"
            value={sensors.pressure}
            unit="hPa"
            min={980}
            max={1050}
            warningThreshold={990}
            criticalThreshold={985}
            size={compactMode ? 'small' : 'medium'}
          />
        </div>

        {/* Data grids */}
        {!compactMode && (
          <>
            {/* Position & Orientation */}
            <div className="data-section">
              <h4>Position & Orientation</h4>
              <DataGrid
                data={{
                  'X Position': { value: sensors.position.x, unit: 'm' },
                  'Y Position': { value: sensors.position.y, unit: 'm' },
                  'Z Position': { value: sensors.position.z, unit: 'm' },
                  'Roll': { value: sensors.orientation.roll, unit: '°' },
                  'Pitch': { value: sensors.orientation.pitch, unit: '°' },
                  'Yaw': { value: sensors.orientation.yaw, unit: '°' }
                }}
                columns={3}
              />
            </div>

            {/* Wheel Data */}
            <div className="data-section">
              <h4>Wheel Status</h4>
              <div className="wheel-grid">
                {Object.entries(sensors.wheels).map(([wheel, data]) => (
                  <div key={wheel} className="wheel-item">
                    <div className="wheel-label">{wheel.toUpperCase()}</div>
                    <div className="wheel-data">
                      <div className="wheel-metric">
                        <span className="label">RPM</span>
                        <span className="value">{data.rpm.toFixed(0)}</span>
                      </div>
                      <div className="wheel-metric">
                        <span className="label">Temp</span>
                        <span className="value">{data.temp.toFixed(1)}°C</span>
                      </div>
                      <div className="wheel-metric">
                        <span className="label">Current</span>
                        <span className="value">{data.current.toFixed(2)}A</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini charts */}
            {showGraphs && dataHistory[0].length > 1 && (
              <div className="charts-section">
                <h4>Trends</h4>
                <div className="mini-charts">
                  <div className="chart-item">
                    <div className="chart-label">Temperature</div>
                    <MiniChart data={dataHistory[0]} color="var(--color-warning-main)" />
                  </div>
                  <div className="chart-item">
                    <div className="chart-label">Battery</div>
                    <MiniChart data={dataHistory[1]} color="var(--color-success-main)" />
                  </div>
                  <div className="chart-item">
                    <div className="chart-label">Pressure</div>
                    <MiniChart data={dataHistory[2]} color="var(--color-info-main)" />
                  </div>
                  <div className="chart-item">
                    <div className="chart-label">Avg Wheel RPM</div>
                    <MiniChart data={dataHistory[3]} color="var(--color-primary-main)" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TelemetryPanel;