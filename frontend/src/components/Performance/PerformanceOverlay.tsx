import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  performanceMonitor,
  PerformanceMetrics,
  PerformanceAlert,
  AdaptiveQualitySettings
} from '../../services/performance/PerformanceMonitor';
import './PerformanceOverlay.css';

interface PerformanceOverlayProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  minimized?: boolean;
  showAdvanced?: boolean;
  theme?: 'dark' | 'light';
  onClose?: () => void;
}

export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  position = 'top-right',
  minimized = false,
  showAdvanced = false,
  theme = 'dark',
  onClose
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [qualitySettings, setQualitySettings] = useState<AdaptiveQualitySettings | null>(null);
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [showDetails, setShowDetails] = useState(showAdvanced);
  const [history, setHistory] = useState<PerformanceMetrics[]>([]);

  // Subscribe to performance updates
  useEffect(() => {
    const handleMetricsUpdate = (newMetrics: PerformanceMetrics) => {
      setMetrics(newMetrics);
      setHistory(prev => [...prev.slice(-59), newMetrics]); // Keep last 60 seconds
    };

    const handleAlert = (alert: PerformanceAlert) => {
      setAlerts(prev => [...prev.slice(-9), alert]); // Keep last 10 alerts
    };

    const handleQualityChange = (settings: AdaptiveQualitySettings) => {
      setQualitySettings(settings);
    };

    performanceMonitor.on('metricsUpdated', handleMetricsUpdate);
    performanceMonitor.on('performanceAlert', handleAlert);
    performanceMonitor.on('qualitySettingsChanged', handleQualityChange);

    // Initial data
    setMetrics(performanceMonitor.getCurrentMetrics());
    setQualitySettings(performanceMonitor.getQualitySettings());
    setHistory(performanceMonitor.getMetricsHistory());

    return () => {
      performanceMonitor.off('metricsUpdated', handleMetricsUpdate);
      performanceMonitor.off('performanceAlert', handleAlert);
      performanceMonitor.off('qualitySettingsChanged', handleQualityChange);
    };
  }, []);

  // Format bytes for display
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Get status color based on value and thresholds
  const getStatusColor = useCallback((value: number, type: 'fps' | 'memory' | 'processing'): string => {
    switch (type) {
      case 'fps':
        if (value >= 45) return '#4ade80'; // green
        if (value >= 30) return '#fbbf24'; // yellow
        return '#f87171'; // red
      case 'memory':
        if (value <= 50) return '#4ade80';
        if (value <= 80) return '#fbbf24';
        return '#f87171';
      case 'processing':
        if (value <= 5) return '#4ade80';
        if (value <= 10) return '#fbbf24';
        return '#f87171';
      default:
        return '#6b7280';
    }
  }, []);

  // Calculate trend for metrics
  const calculateTrend = useCallback((metricType: keyof PerformanceMetrics): 'up' | 'down' | 'stable' => {
    if (history.length < 10) return 'stable';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    let recentAvg: number, olderAvg: number;
    
    if (metricType === 'memoryUsage') {
      recentAvg = recent.reduce((sum, m) => sum + (m.memoryUsage as any).usagePercentage, 0) / recent.length;
      olderAvg = older.reduce((sum, m) => sum + (m.memoryUsage as any).usagePercentage, 0) / older.length;
    } else {
      recentAvg = recent.reduce((sum, m) => sum + (m[metricType] as number), 0) / recent.length;
      olderAvg = older.reduce((sum, m) => sum + (m[metricType] as number), 0) / older.length;
    }
    
    const diff = Math.abs(recentAvg - olderAvg);
    if (diff < 0.1) return 'stable';
    
    return recentAvg > olderAvg ? 'up' : 'down';
  }, [history]);

  // Mini chart component for trends
  const MiniChart: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 60;
      const y = 20 - ((value - min) / range) * 20;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg width="60" height="20" className="performance-mini-chart">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1"
          opacity="0.8"
        />
      </svg>
    );
  };

  // Alert severity icon
  const AlertIcon: React.FC<{ severity: 'warning' | 'critical' }> = ({ severity }) => (
    <span className={`alert-icon alert-${severity}`}>
      {severity === 'critical' ? '⚠️' : '⚡'}
    </span>
  );

  // Export report handler
  const handleExportReport = useCallback(() => {
    try {
      const report = performanceMonitor.exportReport('json');
      const blob = new Blob([report], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-report-${new Date().toISOString().slice(0, 19)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  }, []);

  // Render minimized view
  if (isMinimized) {
    return (
      <div className={`performance-overlay performance-overlay--minimized performance-overlay--${position} performance-overlay--${theme}`}>
        <div className="performance-overlay__header" onClick={() => setIsMinimized(false)}>
          <div className="performance-status">
            {metrics && (
              <>
                <span style={{ color: getStatusColor(metrics.fps, 'fps') }}>
                  {metrics.fps}fps
                </span>
                <span style={{ color: getStatusColor(metrics.memoryUsage.usagePercentage, 'memory') }}>
                  {metrics.memoryUsage.usagePercentage.toFixed(0)}%
                </span>
                {alerts.length > 0 && (
                  <span className="alert-indicator">{alerts.length}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className={`performance-overlay performance-overlay--${position} performance-overlay--${theme}`}>
      <div className="performance-overlay__header">
        <h3>Performance Monitor</h3>
        <div className="performance-overlay__controls">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="control-button"
            title="Toggle Details"
          >
            📊
          </button>
          <button
            onClick={handleExportReport}
            className="control-button"
            title="Export Report"
          >
            💾
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="control-button"
            title="Minimize"
          >
            ➖
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="control-button"
              title="Close"
            >
              ✖️
            </button>
          )}
        </div>
      </div>

      <div className="performance-overlay__content">
        {metrics && (
          <>
            {/* Primary Metrics */}
            <div className="metrics-section">
              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-label">FPS</span>
                  <span className={`trend-indicator trend-${calculateTrend('fps')}`}>
                    {calculateTrend('fps') === 'up' ? '↗' : calculateTrend('fps') === 'down' ? '↘' : '→'}
                  </span>
                </div>
                <div className="metric-value" style={{ color: getStatusColor(metrics.fps, 'fps') }}>
                  {metrics.fps}
                </div>
                <div className="metric-chart">
                  <MiniChart 
                    data={history.slice(-20).map(h => h.fps)} 
                    color={getStatusColor(metrics.fps, 'fps')} 
                  />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-label">Memory</span>
                  <span className={`trend-indicator trend-${calculateTrend('memoryUsage')}`}>
                    {calculateTrend('memoryUsage') === 'up' ? '↗' : calculateTrend('memoryUsage') === 'down' ? '↘' : '→'}
                  </span>
                </div>
                <div className="metric-value" style={{ color: getStatusColor(metrics.memoryUsage.usagePercentage, 'memory') }}>
                  {metrics.memoryUsage.usagePercentage.toFixed(1)}%
                </div>
                <div className="metric-sub">
                  {formatBytes(metrics.memoryUsage.usedJSHeapSize)}
                </div>
                <div className="metric-chart">
                  <MiniChart 
                    data={history.slice(-20).map(h => h.memoryUsage.usagePercentage)} 
                    color={getStatusColor(metrics.memoryUsage.usagePercentage, 'memory')} 
                  />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-label">Processing</span>
                  <span className={`trend-indicator trend-${calculateTrend('telemetryProcessingTime')}`}>
                    {calculateTrend('telemetryProcessingTime') === 'up' ? '↗' : calculateTrend('telemetryProcessingTime') === 'down' ? '↘' : '→'}
                  </span>
                </div>
                <div className="metric-value" style={{ color: getStatusColor(metrics.telemetryProcessingTime, 'processing') }}>
                  {metrics.telemetryProcessingTime.toFixed(1)}ms
                </div>
                <div className="metric-chart">
                  <MiniChart 
                    data={history.slice(-20).map(h => h.telemetryProcessingTime)} 
                    color={getStatusColor(metrics.telemetryProcessingTime, 'processing')} 
                  />
                </div>
              </div>
            </div>

            {/* Advanced Details */}
            {showDetails && (
              <>
                <div className="metrics-section metrics-section--advanced">
                  <h4>Detailed Metrics</h4>
                  
                  <div className="metric-row">
                    <span className="metric-label">Frame Drops:</span>
                    <span className="metric-value">{metrics.frameDrops}</span>
                  </div>
                  
                  <div className="metric-row">
                    <span className="metric-label">Render Time:</span>
                    <span className="metric-value">{metrics.renderTime.toFixed(2)}ms</span>
                  </div>
                  
                  <div className="metric-row">
                    <span className="metric-label">Throughput:</span>
                    <span className="metric-value">{metrics.telemetryThroughput} msg/s</span>
                  </div>
                  
                  <div className="metric-row">
                    <span className="metric-label">Worker Queue:</span>
                    <span className="metric-value">{metrics.webWorkerPerformance.taskQueueSize}</span>
                  </div>
                  
                  <div className="metric-row">
                    <span className="metric-label">Worker Errors:</span>
                    <span className="metric-value">{(metrics.webWorkerPerformance.errorRate * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Quality Settings */}
                {qualitySettings && (
                  <div className="metrics-section">
                    <h4>Adaptive Quality</h4>
                    <div className="quality-settings">
                      <div className="quality-row">
                        <span className="quality-label">Resolution:</span>
                        <span className={`quality-value quality-${qualitySettings.chartResolution}`}>
                          {qualitySettings.chartResolution.toUpperCase()}
                        </span>
                      </div>
                      <div className="quality-row">
                        <span className="quality-label">Update Rate:</span>
                        <span className="quality-value">{qualitySettings.updateFrequency}Hz</span>
                      </div>
                      <div className="quality-row">
                        <span className="quality-label">Data Points:</span>
                        <span className="quality-value">{qualitySettings.maxDataPoints}</span>
                      </div>
                      <div className="quality-row">
                        <span className="quality-label">Animations:</span>
                        <span className={`quality-value ${qualitySettings.enableAnimations ? 'enabled' : 'disabled'}`}>
                          {qualitySettings.enableAnimations ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <div className="quality-row">
                        <span className="quality-label">Effects:</span>
                        <span className={`quality-value ${qualitySettings.enableEffects ? 'enabled' : 'disabled'}`}>
                          {qualitySettings.enableEffects ? 'ON' : 'OFF'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="metrics-section alerts-section">
                <h4>Performance Alerts</h4>
                <div className="alerts-list">
                  {alerts.slice(-5).map((alert, index) => (
                    <div key={index} className={`alert alert--${alert.severity}`}>
                      <AlertIcon severity={alert.severity} />
                      <span className="alert-message">{alert.message}</span>
                      <span className="alert-time">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!metrics && (
          <div className="no-data">
            <p>No performance data available</p>
            <p className="no-data-sub">Start monitoring to see metrics</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceOverlay;