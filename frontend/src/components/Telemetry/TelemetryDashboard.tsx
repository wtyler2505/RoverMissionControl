import React, { useEffect, useState, useRef, useCallback } from 'react';
import RealTimeChart, { DataSeries, YAxis, ChartOptions, PerformanceMetrics } from './RealTimeChart';
import { useRealTimeData } from './useRealTimeData';
import { useTelemetryManager } from '../../services/telemetry/TelemetryContext';

interface TelemetryDashboardProps {
  streams?: string[];
  updateRate?: number;
  timeWindow?: number;
  height?: number;
}

const CHART_COLORS = [
  '#00ff00', // Green
  '#ff0000', // Red
  '#0080ff', // Blue
  '#ffff00', // Yellow
  '#ff00ff', // Magenta
  '#00ffff', // Cyan
  '#ff8000', // Orange
  '#8000ff', // Purple
];

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  streams = [],
  updateRate = 100, // 100 Hz default
  timeWindow = 60000, // 60 seconds
  height = 400,
}) => {
  const telemetryManager = useTelemetryManager();
  const dataManager = useRealTimeData({
    maxDataPoints: Math.max(10000, timeWindow / (1000 / updateRate)),
    decimationFactor: updateRate > 100 ? Math.floor(updateRate / 100) : 1,
    smoothingWindow: 3,
  });

  const [series, setSeries] = useState<DataSeries[]>([]);
  const [yAxes, setYAxes] = useState<YAxis[]>([]);
  const [chartWidth, setChartWidth] = useState(800);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    renderTime: 0,
    dataPoints: 0,
    droppedFrames: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const subscriptionsRef = useRef<string[]>([]);

  // Chart options
  const chartOptions: Partial<ChartOptions> = {
    timeWindow,
    gridColor: '#333',
    backgroundColor: '#000',
    textColor: '#ccc',
    fontSize: 11,
    showGrid: true,
    showLabels: true,
    smoothing: true,
    enableZoom: true,
    enablePan: true,
    updateInterval: 1000 / 60, // Target 60 FPS
  };

  // Initialize telemetry subscriptions
  useEffect(() => {
    if (!telemetryManager) return;

    const newSeries: DataSeries[] = [];
    const newAxes: YAxis[] = [];
    const axisMap = new Map<string, string>();

    streams.forEach((streamId, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      const metadata = telemetryManager.getStreamMetadata(streamId);
      
      // Determine axis assignment based on units
      let axisId = 'default';
      if (metadata?.units) {
        if (!axisMap.has(metadata.units)) {
          axisId = `axis-${axisMap.size}`;
          axisMap.set(metadata.units, axisId);
          
          newAxes.push({
            id: axisId,
            label: metadata.units,
            position: axisMap.size % 2 === 0 ? 'left' : 'right',
            color,
            autoScale: true,
          });
        } else {
          axisId = axisMap.get(metadata.units)!;
        }
      }

      newSeries.push({
        id: streamId,
        name: metadata?.name || streamId,
        data: [],
        color,
        type: 'line',
        lineWidth: 2,
        yAxisId: axisId,
      });

      // Subscribe to telemetry stream
      const unsubscribe = telemetryManager.subscribe(streamId, (data) => {
        if (typeof data.value === 'number') {
          dataManager.addDataPoint(streamId, data.value, data.timestamp);
        }
      });

      subscriptionsRef.current.push(unsubscribe);
    });

    // Add default axis if no custom axes
    if (newAxes.length === 0) {
      newAxes.push({
        id: 'default',
        label: 'Value',
        position: 'left',
        autoScale: true,
      });
    }

    setSeries(newSeries);
    setYAxes(newAxes);

    return () => {
      subscriptionsRef.current.forEach(unsub => unsub());
      subscriptionsRef.current = [];
    };
  }, [streams, telemetryManager, dataManager]);

  // Update series data
  useEffect(() => {
    const updateInterval = setInterval(() => {
      setSeries(prev => prev.map(s => ({
        ...s,
        data: dataManager.getSeries(s.id),
      })));
    }, chartOptions.updateInterval);

    return () => clearInterval(updateInterval);
  }, [dataManager, chartOptions.updateInterval]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setChartWidth(containerRef.current.offsetWidth);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, []);

  // Generate simulated data for testing
  const startSimulation = useCallback(() => {
    let time = Date.now();
    const interval = setInterval(() => {
      time = Date.now();
      
      streams.forEach((streamId, index) => {
        // Generate different waveforms for each stream
        const baseFreq = 0.5 + index * 0.2;
        const value = Math.sin(time * 0.001 * baseFreq) * 50 + 
                     Math.sin(time * 0.003 * baseFreq) * 20 +
                     Math.random() * 10 - 5 + 50;
        
        dataManager.addDataPoint(streamId, value, time);
      });
    }, 1000 / updateRate);

    return () => clearInterval(interval);
  }, [streams, updateRate, dataManager]);

  // Export data
  const exportData = useCallback(() => {
    const allData = dataManager.getAllSeries();
    const exportObj: any = {};

    allData.forEach((data, seriesId) => {
      exportObj[seriesId] = {
        metadata: telemetryManager?.getStreamMetadata(seriesId),
        statistics: dataManager.getStatistics(seriesId),
        data: data.slice(-1000), // Export last 1000 points
      };
    });

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dataManager, telemetryManager]);

  return (
    <div className="telemetry-dashboard" style={{ width: '100%', backgroundColor: '#111' }}>
      <div className="dashboard-header" style={{ padding: '10px', color: '#ccc' }}>
        <h3>Telemetry Dashboard</h3>
        <div className="performance-metrics" style={{ fontSize: '12px', marginTop: '5px' }}>
          <span>FPS: {performanceMetrics.fps}</span>
          <span style={{ marginLeft: '20px' }}>Render Time: {performanceMetrics.renderTime.toFixed(2)}ms</span>
          <span style={{ marginLeft: '20px' }}>Data Points: {performanceMetrics.dataPoints}</span>
          <span style={{ marginLeft: '20px' }}>Dropped Frames: {performanceMetrics.droppedFrames}</span>
        </div>
        <div className="controls" style={{ marginTop: '10px' }}>
          <button onClick={startSimulation} style={{ marginRight: '10px' }}>
            Start Simulation
          </button>
          <button onClick={() => dataManager.clearData()} style={{ marginRight: '10px' }}>
            Clear Data
          </button>
          <button onClick={exportData}>
            Export Data
          </button>
        </div>
      </div>
      
      <div ref={containerRef} style={{ width: '100%' }}>
        <RealTimeChart
          series={series}
          yAxes={yAxes}
          options={chartOptions}
          width={chartWidth}
          height={height}
          onPerformanceMetrics={setPerformanceMetrics}
        />
      </div>

      <div className="stream-stats" style={{ padding: '10px', color: '#ccc' }}>
        {streams.map(streamId => {
          const stats = dataManager.getStatistics(streamId);
          const metadata = telemetryManager?.getStreamMetadata(streamId);
          return (
            <div key={streamId} style={{ marginBottom: '10px', fontSize: '12px' }}>
              <strong>{metadata?.name || streamId}:</strong>
              {stats && (
                <span style={{ marginLeft: '10px' }}>
                  Last: {stats.lastValue.toFixed(2)} |
                  Min: {stats.min.toFixed(2)} |
                  Max: {stats.max.toFixed(2)} |
                  Mean: {stats.mean.toFixed(2)} |
                  Rate: {stats.dataRate.toFixed(1)} Hz
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TelemetryDashboard;