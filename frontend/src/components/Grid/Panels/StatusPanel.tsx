/**
 * StatusPanel Component - System health and status monitoring
 * Mission-critical status interface for rover system monitoring
 */

import React, { useState, useEffect, useMemo } from 'react';
import { PanelProps } from '../../../types/grid';
import './PanelStyles.css';

interface SystemStatus {
  overall: 'healthy' | 'warning' | 'critical' | 'offline';
  subsystems: {
    power: {
      status: 'healthy' | 'warning' | 'critical';
      batteryLevel: number;
      powerConsumption: number;
      estimatedRuntime: number;
    };
    communication: {
      status: 'healthy' | 'warning' | 'critical';
      signalStrength: number;
      latency: number;
      packetsLost: number;
    };
    navigation: {
      status: 'healthy' | 'warning' | 'critical';
      gpsAccuracy: number;
      compassCalibration: number;
      obstacleDetection: boolean;
    };
    mobility: {
      status: 'healthy' | 'warning' | 'critical';
      wheelHealth: Record<string, number>;
      motorTemperatures: Record<string, number>;
      terrainGrip: number;
    };
    sensors: {
      status: 'healthy' | 'warning' | 'critical';
      activeSensors: number;
      totalSensors: number;
      dataQuality: number;
    };
    thermal: {
      status: 'healthy' | 'warning' | 'critical';
      coreTemperature: number;
      ambientTemperature: number;
      coolingEfficiency: number;
    };
  };
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: number;
    acknowledged: boolean;
  }>;
  uptime: number;
  lastHealthCheck: number;
}

interface StatusPanelProps extends PanelProps {
  systemStatus?: SystemStatus;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showAlerts?: boolean;
  compactMode?: boolean;
}

// Status indicator component
const StatusIndicator: React.FC<{
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}> = ({ status, size = 'medium', showLabel = false }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'healthy': return '#4CAF50';
      case 'warning': return '#FF9800';
      case 'critical': return '#F44336';
      case 'offline': return '#9E9E9E';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'healthy': return 'Healthy';
      case 'warning': return 'Warning';
      case 'critical': return 'Critical';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <div className={`status-indicator ${size}`}>
      <div 
        className={`status-dot ${status}`}
        style={{ backgroundColor: getStatusColor() }}
      />
      {showLabel && <span className="status-label">{getStatusText()}</span>}
    </div>
  );
};

// Subsystem status card
const SubsystemCard: React.FC<{
  title: string;
  status: 'healthy' | 'warning' | 'critical';
  metrics: Array<{ label: string; value: string | number; unit?: string; status?: string }>;
  compact?: boolean;
}> = ({ title, status, metrics, compact = false }) => {
  return (
    <div className={`subsystem-card ${status} ${compact ? 'compact' : ''}`}>
      <div className="subsystem-header">
        <h4 className="subsystem-title">{title}</h4>
        <StatusIndicator status={status} size={compact ? 'small' : 'medium'} />
      </div>
      <div className="subsystem-metrics">
        {metrics.map((metric, index) => (
          <div key={index} className={`metric-item ${metric.status || ''}`}>
            <span className="metric-label">{metric.label}</span>
            <span className="metric-value">
              {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
              {metric.unit && <span className="metric-unit">{metric.unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Alert item component
const AlertItem: React.FC<{
  alert: SystemStatus['alerts'][0];
  onAcknowledge: (id: string) => void;
  compact?: boolean;
}> = ({ alert, onAcknowledge, compact = false }) => {
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getSeverityIcon = () => {
    switch (alert.severity) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  return (
    <div className={`alert-item ${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''} ${compact ? 'compact' : ''}`}>
      <div className="alert-content">
        <div className="alert-header">
          <span className="alert-icon">{getSeverityIcon()}</span>
          <span className="alert-time">{formatTime(alert.timestamp)}</span>
          {!alert.acknowledged && (
            <button
              className="acknowledge-btn"
              onClick={() => onAcknowledge(alert.id)}
              title="Acknowledge alert"
            >
              ✓
            </button>
          )}
        </div>
        <div className="alert-message">{alert.message}</div>
      </div>
    </div>
  );
};

// Mock data generator
const generateMockStatus = (): SystemStatus => {
  const now = Date.now();
  const batteryLevel = 75 + Math.random() * 20;
  const signalStrength = 80 + Math.random() * 15;
  
  const getRandomStatus = (healthyProb = 0.7, warningProb = 0.2) => {
    const rand = Math.random();
    if (rand < healthyProb) return 'healthy';
    if (rand < healthyProb + warningProb) return 'warning';
    return 'critical';
  };

  return {
    overall: getRandomStatus(0.6, 0.3) as 'healthy' | 'warning' | 'critical',
    subsystems: {
      power: {
        status: batteryLevel < 20 ? 'critical' : batteryLevel < 40 ? 'warning' : 'healthy',
        batteryLevel,
        powerConsumption: 45 + Math.random() * 20,
        estimatedRuntime: (batteryLevel / 100) * 8 + Math.random() * 2
      },
      communication: {
        status: signalStrength < 30 ? 'critical' : signalStrength < 60 ? 'warning' : 'healthy',
        signalStrength,
        latency: 50 + Math.random() * 100,
        packetsLost: Math.floor(Math.random() * 5)
      },
      navigation: {
        status: getRandomStatus(),
        gpsAccuracy: 2 + Math.random() * 8,
        compassCalibration: 95 + Math.random() * 5,
        obstacleDetection: Math.random() > 0.1
      },
      mobility: {
        status: getRandomStatus(),
        wheelHealth: {
          FL: 85 + Math.random() * 15,
          FR: 85 + Math.random() * 15,
          RL: 85 + Math.random() * 15,
          RR: 85 + Math.random() * 15
        },
        motorTemperatures: {
          FL: 35 + Math.random() * 15,
          FR: 35 + Math.random() * 15,
          RL: 35 + Math.random() * 15,
          RR: 35 + Math.random() * 15
        },
        terrainGrip: 70 + Math.random() * 25
      },
      sensors: {
        status: getRandomStatus(),
        activeSensors: 12 + Math.floor(Math.random() * 3),
        totalSensors: 15,
        dataQuality: 85 + Math.random() * 15
      },
      thermal: {
        status: getRandomStatus(),
        coreTemperature: 45 + Math.random() * 20,
        ambientTemperature: 22 + Math.random() * 8,
        coolingEfficiency: 80 + Math.random() * 20
      }
    },
    alerts: [
      {
        id: '1',
        severity: 'warning',
        message: 'Battery level below 25%',
        timestamp: now - 120000,
        acknowledged: false
      },
      {
        id: '2',
        severity: 'info',
        message: 'GPS accuracy improved to 2.1m',
        timestamp: now - 300000,
        acknowledged: true
      },
      {
        id: '3',
        severity: 'critical',
        message: 'Communication latency exceeding acceptable limits',
        timestamp: now - 60000,
        acknowledged: false
      }
    ].filter(() => Math.random() > 0.3),
    uptime: Math.floor(Math.random() * 86400000), // Random uptime up to 24 hours
    lastHealthCheck: now - Math.floor(Math.random() * 30000)
  };
};

const StatusPanel: React.FC<StatusPanelProps> = ({
  id,
  config = {},
  systemStatus,
  autoRefresh = true,
  refreshInterval = 5000,
  showAlerts = true,
  compactMode = false,
  isMinimized
}) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [alertsToShow, setAlertsToShow] = useState<SystemStatus['alerts']>([]);
  
  // Update status data
  useEffect(() => {
    const updateStatus = () => {
      const newStatus = systemStatus || generateMockStatus();
      setStatus(newStatus);
      setAlertsToShow(newStatus.alerts.filter(alert => !alert.acknowledged));
    };

    updateStatus();
    
    if (autoRefresh) {
      const interval = setInterval(updateStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [systemStatus, autoRefresh, refreshInterval]);

  const acknowledgeAlert = (alertId: string) => {
    if (!status) return;
    
    const updatedStatus = {
      ...status,
      alerts: status.alerts.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    };
    
    setStatus(updatedStatus);
    setAlertsToShow(updatedStatus.alerts.filter(alert => !alert.acknowledged));
  };

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const formatLastCheck = (timestamp: number) => {
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    const minutesAgo = Math.floor(secondsAgo / 60);
    return `${minutesAgo}m ago`;
  };

  if (isMinimized) {
    return (
      <div className="status-panel-minimized">
        <div className="overall-status">
          <StatusIndicator 
            status={status?.overall || 'offline'} 
            size="medium" 
            showLabel 
          />
          <span className="uptime">
            Uptime: {status ? formatUptime(status.uptime) : 'N/A'}
          </span>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="status-panel-loading">
        <div className="loading-spinner" />
        <span>Loading system status...</span>
      </div>
    );
  }

  return (
    <div className={`status-panel ${compactMode ? 'compact' : ''}`}>
      {/* Overall status header */}
      <div className="status-header">
        <div className="overall-status">
          <StatusIndicator 
            status={status.overall} 
            size="large" 
            showLabel 
          />
          <div className="status-summary">
            <div className="system-name">Rover System Status</div>
            <div className="status-details">
              <span>Uptime: {formatUptime(status.uptime)}</span>
              <span>Last Check: {formatLastCheck(status.lastHealthCheck)}</span>
            </div>
          </div>
        </div>
        {alertsToShow.length > 0 && (
          <div className="alert-count">
            <span className="alert-badge">{alertsToShow.length}</span>
            <span>Active Alerts</span>
          </div>
        )}
      </div>

      {/* Subsystem statuses */}
      <div className="subsystems-grid">
        <SubsystemCard
          title="Power"
          status={status.subsystems.power.status}
          metrics={[
            { label: 'Battery', value: status.subsystems.power.batteryLevel, unit: '%' },
            { label: 'Consumption', value: status.subsystems.power.powerConsumption, unit: 'W' },
            { label: 'Runtime', value: status.subsystems.power.estimatedRuntime, unit: 'h' }
          ]}
          compact={compactMode}
        />
        
        <SubsystemCard
          title="Communication"
          status={status.subsystems.communication.status}
          metrics={[
            { label: 'Signal', value: status.subsystems.communication.signalStrength, unit: '%' },
            { label: 'Latency', value: status.subsystems.communication.latency, unit: 'ms' },
            { label: 'Lost Packets', value: status.subsystems.communication.packetsLost }
          ]}
          compact={compactMode}
        />

        <SubsystemCard
          title="Navigation"
          status={status.subsystems.navigation.status}
          metrics={[
            { label: 'GPS Accuracy', value: status.subsystems.navigation.gpsAccuracy, unit: 'm' },
            { label: 'Compass Cal.', value: status.subsystems.navigation.compassCalibration, unit: '%' },
            { label: 'Obstacle Det.', value: status.subsystems.navigation.obstacleDetection ? 'Active' : 'Inactive' }
          ]}
          compact={compactMode}
        />

        <SubsystemCard
          title="Mobility"
          status={status.subsystems.mobility.status}
          metrics={[
            { label: 'Avg Wheel Health', value: Object.values(status.subsystems.mobility.wheelHealth).reduce((a, b) => a + b, 0) / 4, unit: '%' },
            { label: 'Avg Motor Temp', value: Object.values(status.subsystems.mobility.motorTemperatures).reduce((a, b) => a + b, 0) / 4, unit: '°C' },
            { label: 'Terrain Grip', value: status.subsystems.mobility.terrainGrip, unit: '%' }
          ]}
          compact={compactMode}
        />

        <SubsystemCard
          title="Sensors"
          status={status.subsystems.sensors.status}
          metrics={[
            { label: 'Active', value: `${status.subsystems.sensors.activeSensors}/${status.subsystems.sensors.totalSensors}` },
            { label: 'Data Quality', value: status.subsystems.sensors.dataQuality, unit: '%' }
          ]}
          compact={compactMode}
        />

        <SubsystemCard
          title="Thermal"
          status={status.subsystems.thermal.status}
          metrics={[
            { label: 'Core Temp', value: status.subsystems.thermal.coreTemperature, unit: '°C' },
            { label: 'Ambient', value: status.subsystems.thermal.ambientTemperature, unit: '°C' },
            { label: 'Cooling Eff.', value: status.subsystems.thermal.coolingEfficiency, unit: '%' }
          ]}
          compact={compactMode}
        />
      </div>

      {/* Active alerts */}
      {showAlerts && alertsToShow.length > 0 && (
        <div className="alerts-section">
          <h4 className="alerts-title">Active Alerts</h4>
          <div className="alerts-list">
            {alertsToShow.map(alert => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onAcknowledge={acknowledgeAlert}
                compact={compactMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusPanel;