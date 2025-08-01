import React, { useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Line } from 'react-chartjs-2';
import FocusableJoystick from '../ui/FocusableJoystick';
import FocusableGauge from '../ui/FocusableGauge';
import FocusableEmergencyControls from '../ui/FocusableEmergencyControls';
import { Panel } from '../shared';
import RoverModelOptimized from '../shared/RoverModel.optimized';
import TelemetryGaugeOptimized from '../shared/TelemetryGauge.optimized';
import { accessibility } from '../../utils/accessibility';
import logger from '../../utils/simpleLogger';

/**
 * Optimized Dashboard Component with comprehensive memoization
 * Performance optimizations:
 * - Memoized chart data processing and options
 * - Cached expensive calculations
 * - Optimized event handlers with useCallback
 * - Selective component updates
 * - Memoized Canvas camera settings
 * - Reduced prop drilling through context
 */
const DashboardOptimized = React.memo(({
  // Rover 3D props
  roverPosition,
  roverRotation,
  telemetry,
  emergencyStop,
  panelStates,
  togglePanel,
  
  // Telemetry chart props
  chartData,
  chartOptions,
  telemetryHistory,
  isRecording,
  
  // Control props
  handleEmergencyStop,
  BACKEND_URL,
  gamepad,
  controlInput,
  setControlInput,
  sendControlCommand,
  announceToScreenReader,
  toggleRecording,
  exportData
}) => {
  
  // Memoize Canvas camera configuration to prevent recreation
  const cameraConfig = useMemo(() => ({
    position: [5, 5, 5],
    fov: 75,
    near: 0.1,
    far: 1000
  }), []);
  
  // Memoize lighting setup to prevent recreation
  const lightingSetup = useMemo(() => ({
    ambient: { intensity: 0.6 },
    point: { position: [10, 10, 10], intensity: 1 },
    spot: { position: [0, 10, 0], angle: 0.3, penumbra: 0.1 }
  }), []);
  
  // Memoize rover wheel speeds calculation
  const roverWheelSpeeds = useMemo(() => ({
    ...(telemetry?.wheels || { fl: 0, fr: 0, rl: 0, rr: 0 }),
    emergency_stop: emergencyStop,
    fl_fault: telemetry?.motor_faults?.fl,
    fr_fault: telemetry?.motor_faults?.fr,
    rl_fault: telemetry?.motor_faults?.rl,
    rr_fault: telemetry?.motor_faults?.rr
  }), [
    telemetry?.wheels?.fl, telemetry?.wheels?.fr, 
    telemetry?.wheels?.rl, telemetry?.wheels?.rr,
    emergencyStop,
    telemetry?.motor_faults?.fl, telemetry?.motor_faults?.fr,
    telemetry?.motor_faults?.rl, telemetry?.motor_faults?.rr
  ]);
  
  // Memoize chart accessibility description
  const chartAccessibilityInfo = useMemo(() => ({
    description: accessibility.describeChart(chartData, 'line'),
    dataTable: accessibility.generateDataTable(chartData),
    liveUpdate: telemetryHistory.length > 0 && isRecording 
      ? `Chart updated with ${telemetryHistory.length} data points recorded`
      : null
  }), [chartData, telemetryHistory.length, isRecording]);
  
  // Memoize gamepad connection status for accessibility
  const gamepadStatus = useMemo(() => ({
    connected: gamepad?.connected || false,
    label: gamepad?.connected 
      ? 'Gamepad controller connected and ready'
      : 'Gamepad controller not connected',
    displayText: gamepad?.connected ? 'Connected' : 'Disconnected',
    className: gamepad?.connected ? 'active' : 'inactive'
  }), [gamepad?.connected]);
  
  // Memoize speed control value for accessibility
  const speedControlInfo = useMemo(() => ({
    percentage: Math.round((controlInput?.speed || 0) * 100),
    valueText: `${Math.round((controlInput?.speed || 0) * 100)} percent speed`
  }), [controlInput?.speed]);
  
  // Memoize telemetry gauge values to prevent unnecessary calculations
  const gaugeValues = useMemo(() => ({
    motorBattery: telemetry?.battery?.motor?.percentage || 0,
    logicBattery: telemetry?.battery?.logic?.percentage || 0,
    temperature: telemetry?.temp || 0,
    latency: telemetry?.latency || 0
  }), [
    telemetry?.battery?.motor?.percentage,
    telemetry?.battery?.logic?.percentage,
    telemetry?.temp,
    telemetry?.latency
  ]);
  
  // Optimized event handlers with useCallback
  const handleJoystickMove = useCallback((forward, turn) => {
    if (emergencyStop) return;
    
    setControlInput(prev => ({ ...prev, forward, turn }));
    sendControlCommand(forward, turn, controlInput?.speed || 0.5);
  }, [emergencyStop, setControlInput, sendControlCommand, controlInput?.speed]);
  
  const handleSpeedChange = useCallback((newSpeed) => {
    setControlInput(prev => ({ ...prev, speed: newSpeed }));
    
    // Announce speed changes to screen readers
    const announcement = `Speed set to ${Math.round(newSpeed * 100)} percent`;
    announceToScreenReader(announcement);
    
    // Log speed control for accessibility analytics
    logger.logUserAction('speed_control', {
      source: 'slider',
      speed: newSpeed,
      percentage: Math.round(newSpeed * 100)
    });
  }, [setControlInput, announceToScreenReader]);
  
  const handleSpeedKeyDown = useCallback((e) => {
    if (emergencyStop) return;
    
    let newSpeed = controlInput?.speed || 0.5;
    let handled = false;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        e.preventDefault();
        newSpeed = Math.min(1, newSpeed + 0.1);
        handled = true;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        e.preventDefault();
        newSpeed = Math.max(0, newSpeed - 0.1);
        handled = true;
        break;
      case 'PageUp':
        e.preventDefault();
        newSpeed = Math.min(1, newSpeed + 0.2);
        handled = true;
        break;
      case 'PageDown':
        e.preventDefault();
        newSpeed = Math.max(0, newSpeed - 0.2);
        handled = true;
        break;
      case 'Home':
        e.preventDefault();
        newSpeed = 1;
        handled = true;
        break;
      case 'End':
        e.preventDefault();
        newSpeed = 0;
        handled = true;
        break;
    }
    
    if (handled) {
      handleSpeedChange(newSpeed);
      
      logger.logUserAction('speed_control', {
        source: 'keyboard',
        key: e.key,
        speed: newSpeed,
        percentage: Math.round(newSpeed * 100)
      });
    }
  }, [emergencyStop, controlInput?.speed, handleSpeedChange]);
  
  const handleResumeOperation = useCallback(() => {
    fetch(`${BACKEND_URL}/api/rover/resume`, { method: 'POST' })
      .catch(error => console.error('Failed to resume operation:', error));
  }, [BACKEND_URL]);
  
  const handleExportCSV = useCallback(() => {
    exportData('csv');
  }, [exportData]);
  
  const handleExportJSON = useCallback(() => {
    exportData('json');
  }, [exportData]);
  
  // Memoized panel toggle handlers to prevent recreation
  const panelToggleHandlers = useMemo(() => ({
    rover3d: () => togglePanel('rover3d'),
    telemetryChart: () => togglePanel('telemetryChart'),
    control: () => togglePanel('control'),
    gauges: () => togglePanel('gauges')
  }), [togglePanel]);
  
  return (
    <article className="dashboard-workspace" aria-labelledby="dashboard-heading">
      <header className="module-header">
        <h2 id="dashboard-heading" className="sr-only">Operations Dashboard</h2>
      </header>
      
      <div className="dashboard-grid" role="region" aria-label="Dashboard panels">
        {/* Enhanced 3D Rover Visualization */}
        <Panel 
          title="🚀 ROVER 3D VISUALIZATION" 
          className="rover-3d-panel"
          isMinimized={panelStates?.rover3d}
          onToggleMinimize={panelToggleHandlers.rover3d}
        >
          <div className="rover-3d-container">
            <Canvas camera={cameraConfig}>
              <ambientLight intensity={lightingSetup.ambient.intensity} />
              <pointLight 
                position={lightingSetup.point.position} 
                intensity={lightingSetup.point.intensity} 
              />
              <spotLight 
                position={lightingSetup.spot.position} 
                angle={lightingSetup.spot.angle} 
                penumbra={lightingSetup.spot.penumbra} 
              />
              <RoverModelOptimized
                position={roverPosition?.current}
                rotation={roverRotation?.current}
                wheelSpeeds={roverWheelSpeeds}
              />
              <Grid infiniteGrid />
              <OrbitControls />
            </Canvas>
          </div>
        </Panel>

        {/* Enhanced Telemetry Charts */}
        <Panel 
          title="📊 REAL-TIME TELEMETRY" 
          className="telemetry-chart-panel"
          isMinimized={panelStates?.telemetryChart}
          onToggleMinimize={panelToggleHandlers.telemetryChart}
        >
          <div className="chart-container" role="img" aria-labelledby="chart-title" aria-describedby="chart-description">
            <div id="chart-title" className="sr-only">Real-time rover wheel RPM telemetry chart</div>
            <div id="chart-description" className="sr-only">
              {chartAccessibilityInfo.description}
            </div>
            
            <Line 
              data={chartData} 
              options={chartOptions}
              aria-label="Interactive chart showing rover wheel RPM over time"
            />
            
            {/* Alternative text representation for screen readers */}
            <div className="chart-data-table sr-only">
              <h4>Chart data in table format:</h4>
              <div dangerouslySetInnerHTML={{ 
                __html: chartAccessibilityInfo.dataTable 
              }} />
            </div>
            
            {/* Live region for chart updates */}
            <div 
              className="sr-only" 
              aria-live="polite" 
              aria-atomic="false"
              role="status"
            >
              {chartAccessibilityInfo.liveUpdate}
            </div>
          </div>
        </Panel>

        {/* Enhanced Control Panel */}
        <Panel 
          title="🎮 ROVER CONTROL" 
          className="control-panel"
          isMinimized={panelStates?.control}
          onToggleMinimize={panelToggleHandlers.control}
        >
          <div className="control-content">
            <div id="emergency-controls">
              <FocusableEmergencyControls
                emergencyStop={emergencyStop}
                onEmergencyStop={handleEmergencyStop}
                onResume={handleResumeOperation}
                testId="emergency-controls"
              />
            </div>

            <div className="control-modes" role="status" aria-label="Control input methods">
              <div className="control-mode">
                <span 
                  className={`control-indicator ${gamepadStatus.className}`}
                  role="status"
                  aria-live="polite"
                  aria-label={gamepadStatus.label}
                >
                  🎮 Gamepad: {gamepadStatus.displayText}
                </span>
              </div>
              <div className="control-mode">
                <span 
                  className="control-indicator active"
                  role="status"
                  aria-label="Keyboard controls active - use WASD or arrow keys to move"
                >
                  ⌨️ Keyboard: WASD / Arrow Keys
                </span>
              </div>
              <div className="control-mode">
                <span 
                  className="control-indicator active"
                  role="status"
                  aria-label="Mouse virtual joystick active - click and drag to control movement"
                >
                  🖱️ Mouse: Virtual Joystick
                </span>
              </div>
            </div>

            <div id="rover-controls" className="joystick-container">
              <FocusableJoystick
                forward={controlInput?.forward || 0}
                turn={controlInput?.turn || 0}
                disabled={emergencyStop}
                onMove={handleJoystickMove}
                size={150}
                testId="rover-joystick"
              />
            </div>

            <div className="speed-control">
              <label htmlFor="speed-slider">Speed: {speedControlInfo.percentage}%</label>
              <input
                id="speed-slider"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={controlInput?.speed || 0.5}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                onKeyDown={handleSpeedKeyDown}
                className="speed-slider"
                disabled={emergencyStop}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={speedControlInfo.percentage}
                aria-valuetext={speedControlInfo.valueText}
                title="Use arrow keys, Page Up/Down, Home/End for precise control"
              />
            </div>

            <div className="data-recording">
              <button 
                onClick={toggleRecording}
                aria-label={isRecording ? 'Stop recording telemetry data' : 'Start recording telemetry data'}
                aria-pressed={isRecording}
              >
                {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
              </button>
              <button 
                onClick={handleExportCSV} 
                disabled={!telemetryHistory || telemetryHistory.length === 0}
                aria-label={`Export recorded data as CSV file${(!telemetryHistory || telemetryHistory.length === 0) ? ' - no data recorded' : ` - ${telemetryHistory.length} data points`}`}
              >
                Export CSV
              </button>
              <button 
                onClick={handleExportJSON} 
                disabled={!telemetryHistory || telemetryHistory.length === 0}
                aria-label={`Export recorded data as JSON file${(!telemetryHistory || telemetryHistory.length === 0) ? ' - no data recorded' : ` - ${telemetryHistory.length} data points`}`}
              >
                Export JSON
              </button>
            </div>
          </div>
        </Panel>

        {/* Enhanced Telemetry Gauges */}
        <Panel 
          title="📊 TELEMETRY GAUGES" 
          className="gauges-panel"
          isMinimized={panelStates?.gauges}
          onToggleMinimize={panelToggleHandlers.gauges}
        >
          <div className="gauges-grid">
            <TelemetryGaugeOptimized
              value={gaugeValues.motorBattery}
              min={0}
              max={100}
              unit="%"
              label="Motor Battery"
              type="battery"
              threshold={2} // 2% change threshold
            />
            <TelemetryGaugeOptimized
              value={gaugeValues.logicBattery}
              min={0}
              max={100}
              unit="%"
              label="Logic Battery"
              type="battery"
              threshold={2}
            />
            <TelemetryGaugeOptimized
              value={gaugeValues.temperature}
              min={0}
              max={100}
              unit="°C"
              label="Temperature"
              type="temperature"
              threshold={1} // 1°C change threshold
            />
            <TelemetryGaugeOptimized
              value={gaugeValues.latency}
              min={0}
              max={200}
              unit="ms"
              label="Latency"
              type="latency"
              threshold={5} // 5ms change threshold
            />
          </div>
        </Panel>
      </div>
    </article>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for optimal re-rendering
  // Only re-render if significant props have changed
  
  // Check emergency stop status
  if (prevProps.emergencyStop !== nextProps.emergencyStop) {
    return false;
  }
  
  // Check panel states
  if (JSON.stringify(prevProps.panelStates) !== JSON.stringify(nextProps.panelStates)) {
    return false;
  }
  
  // Check telemetry for significant changes
  const prevTelemetry = prevProps.telemetry || {};
  const nextTelemetry = nextProps.telemetry || {};
  
  // Battery levels - 2% threshold
  const batteryChanged = 
    Math.abs((prevTelemetry.battery?.motor?.percentage || 0) - (nextTelemetry.battery?.motor?.percentage || 0)) > 2 ||
    Math.abs((prevTelemetry.battery?.logic?.percentage || 0) - (nextTelemetry.battery?.logic?.percentage || 0)) > 2;
  
  // Temperature - 1°C threshold
  const tempChanged = Math.abs((prevTelemetry.temp || 0) - (nextTelemetry.temp || 0)) > 1;
  
  // Latency - 5ms threshold
  const latencyChanged = Math.abs((prevTelemetry.latency || 0) - (nextTelemetry.latency || 0)) > 5;
  
  // Wheel speeds - 1 RPM threshold
  const wheelSpeedChanged = ['fl', 'fr', 'rl', 'rr'].some(wheel => 
    Math.abs((prevTelemetry.wheels?.[wheel] || 0) - (nextTelemetry.wheels?.[wheel] || 0)) > 1
  );
  
  // Control input changes
  const controlChanged = 
    Math.abs((prevProps.controlInput?.forward || 0) - (nextProps.controlInput?.forward || 0)) > 0.01 ||
    Math.abs((prevProps.controlInput?.turn || 0) - (nextProps.controlInput?.turn || 0)) > 0.01 ||
    Math.abs((prevProps.controlInput?.speed || 0) - (nextProps.controlInput?.speed || 0)) > 0.01;
  
  // Gamepad connection status
  const gamepadChanged = prevProps.gamepad?.connected !== nextProps.gamepad?.connected;
  
  // Recording status
  const recordingChanged = prevProps.isRecording !== nextProps.isRecording;
  
  // Chart data length (for performance)
  const chartDataChanged = 
    prevProps.telemetryHistory?.length !== nextProps.telemetryHistory?.length;
  
  // Return true if nothing significant changed (prevents re-render)
  return !batteryChanged && !tempChanged && !latencyChanged && !wheelSpeedChanged && 
         !controlChanged && !gamepadChanged && !recordingChanged && !chartDataChanged;
});

// Display name for debugging
DashboardOptimized.displayName = 'DashboardOptimized';

export default DashboardOptimized;