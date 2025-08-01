import React, { useState, useEffect } from 'react';
import { PerformanceIntegration, usePerformanceContext } from './PerformanceIntegration';
import { useTelemetryPerformanceTracking } from '../../hooks/usePerformanceMonitoring';
import './PerformanceExample.css';

/**
 * Example component demonstrating performance monitoring integration
 */
const TelemetrySimulator: React.FC = () => {
  const { trackDataProcessing, updateWorkerMetrics } = usePerformanceContext();
  const [data, setData] = useState<number[]>([]);
  const [processing, setProcessing] = useState(false);

  // Simulate heavy telemetry data processing
  const simulateDataProcessing = async () => {
    setProcessing(true);
    
    try {
      const result = await trackDataProcessing(
        async () => {
          // Simulate heavy computation
          const newData = Array.from({ length: 1000 }, (_, i) => Math.random() * 100);
          
          // Artificial processing delay
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Simulate some data transformation
          return newData.map((value, index) => value * Math.sin(index / 10));
        },
        {
          dataSize: 1000,
          operationType: 'telemetry-processing',
          priority: 'high'
        }
      );
      
      setData(result);
      
      // Update worker metrics simulation
      updateWorkerMetrics({
        taskQueueSize: Math.floor(Math.random() * 10),
        avgProcessingTime: 45 + Math.random() * 20,
        errorRate: Math.random() * 0.05,
        throughput: 50 + Math.random() * 30
      });
      
    } catch (error) {
      console.error('Processing failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  // Simulate continuous data stream
  useEffect(() => {
    const interval = setInterval(() => {
      if (!processing) {
        simulateDataProcessing();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [processing]);

  return (
    <div className="telemetry-simulator">
      <h3>Telemetry Data Simulator</h3>
      <div className="simulator-controls">
        <button 
          onClick={simulateDataProcessing} 
          disabled={processing}
          className="process-button"
        >
          {processing ? 'Processing...' : 'Process Data'}
        </button>
        <div className="data-info">
          Data Points: {data.length}
        </div>
      </div>
      
      {/* Simple data visualization */}
      <div className="data-visualization">
        <svg width="400" height="200" className="data-chart">
          <rect width="400" height="200" fill="#f8f9fa" stroke="#dee2e6" />
          {data.slice(0, 100).map((value, index) => (
            <circle
              key={index}
              cx={index * 4}
              cy={100 - value}
              r="2"
              fill="#007bff"
              opacity="0.7"
            />
          ))}
        </svg>
      </div>
    </div>
  );
};

/**
 * Example showing how to use the performance monitoring system
 */
const PerformanceExample: React.FC = () => {
  const [showOverlay, setShowOverlay] = useState(true);

  return (
    <div className="performance-example">
      <header className="example-header">
        <h2>Performance Monitoring Example</h2>
        <div className="example-controls">
          <label>
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => setShowOverlay(e.target.checked)}
            />
            Show Performance Overlay
          </label>
        </div>
      </header>

      <PerformanceIntegration
        componentName="PerformanceExample"
        enableOverlay={showOverlay}
        overlayPosition="top-right"
        overlayTheme="dark"
        autoOptimize={true}
        onPerformanceDegraded={(metrics) => {
          console.warn('Performance degraded:', metrics);
        }}
      >
        <div className="example-content">
          <TelemetrySimulator />
          
          <div className="example-info">
            <h4>Performance Monitoring Features:</h4>
            <ul>
              <li>Real-time FPS monitoring</li>
              <li>Memory usage tracking</li>
              <li>Telemetry processing time measurement</li>
              <li>Adaptive quality adjustments</li>
              <li>Performance alerts and recommendations</li>
              <li>WebWorker metrics simulation</li>
            </ul>
            
            <h4>Try This:</h4>
            <ol>
              <li>Watch the performance overlay (top-right corner)</li>
              <li>Click "Process Data" multiple times rapidly</li>
              <li>Observe FPS and processing time changes</li>
              <li>Toggle the overlay with Ctrl+Shift+P</li>
              <li>Check browser developer tools for performance logs</li>
            </ol>
          </div>
        </div>
      </PerformanceIntegration>
    </div>
  );
};

export default PerformanceExample;