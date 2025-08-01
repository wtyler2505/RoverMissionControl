import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { Line } from 'react-chartjs-2';
import FocusableJoystick from '../ui/FocusableJoystick';
import FocusableGauge from '../ui/FocusableGauge';
import FocusableEmergencyControls from '../ui/FocusableEmergencyControls';
import { Panel, RoverModel } from '../shared';
import { accessibility } from '../../utils/accessibility';
import logger from '../../utils/simpleLogger';

const Dashboard = ({
  // Rover 3D props
  RoverModel,
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
          isMinimized={panelStates.rover3d}
          onToggleMinimize={() => togglePanel('rover3d')}
        >
          <div className="rover-3d-container">
            <Canvas camera={{ position: [5, 5, 5] }}>
              <ambientLight intensity={0.6} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <spotLight position={[0, 10, 0]} angle={0.3} penumbra={0.1} />
              <RoverModel 
                position={roverPosition.current}
                rotation={roverRotation.current}
                wheelSpeeds={{
                  ...(telemetry?.wheels || { fl: 0, fr: 0, rl: 0, rr: 0 }),
                  emergency_stop: emergencyStop,
                  fl_fault: telemetry?.motor_faults?.fl,
                  fr_fault: telemetry?.motor_faults?.fr,
                  rl_fault: telemetry?.motor_faults?.rl,
                  rr_fault: telemetry?.motor_faults?.rr
                }}
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
          isMinimized={panelStates.telemetryChart}
          onToggleMinimize={() => togglePanel('telemetryChart')}
        >
          <div className="chart-container" role="img" aria-labelledby="chart-title" aria-describedby="chart-description">
            <div id="chart-title" className="sr-only">Real-time rover wheel RPM telemetry chart</div>
            <div id="chart-description" className="sr-only">
              {accessibility.describeChart(chartData, 'line')}
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
                __html: accessibility.generateDataTable(chartData) 
              }} />
            </div>
            
            {/* Live region for chart updates */}
            <div 
              className="sr-only" 
              aria-live="polite" 
              aria-atomic="false"
              role="status"
            >
              {telemetryHistory.length > 0 && isRecording && 
                `Chart updated with ${telemetryHistory.length} data points recorded`
              }
            </div>
          </div>
        </Panel>

        {/* Enhanced Control Panel */}
        <Panel 
          title="🎮 ROVER CONTROL" 
          className="control-panel"
          isMinimized={panelStates.control}
          onToggleMinimize={() => togglePanel('control')}
        >
          <div className="control-content">
            <div id="emergency-controls">
              <FocusableEmergencyControls
                emergencyStop={emergencyStop}
                onEmergencyStop={handleEmergencyStop}
                onResume={() => fetch(`${BACKEND_URL}/api/rover/resume`, {method: 'POST'})}
                testId="emergency-controls"
              />
            </div>

            <div className="control-modes" role="status" aria-label="Control input methods">
              <div className="control-mode">
                <span 
                  className={`control-indicator ${gamepad.connected ? 'active' : 'inactive'}`}
                  role="status"
                  aria-live="polite"
                  aria-label={`Gamepad controller ${gamepad.connected ? 'connected and ready' : 'not connected'}`}
                >
                  🎮 Gamepad: {gamepad.connected ? 'Connected' : 'Disconnected'}
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
                forward={controlInput.forward}
                turn={controlInput.turn}
                disabled={emergencyStop}
                onMove={(forward, turn) => {
                  setControlInput(prev => ({ ...prev, forward, turn }));
                  sendControlCommand(forward, turn, controlInput.speed);
                }}
                size={150}
                testId="rover-joystick"
              />
            </div>

            <div className="speed-control">
              <label htmlFor="speed-slider">Speed: {Math.round(controlInput.speed * 100)}%</label>
              <input
                id="speed-slider"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={controlInput.speed}
                onChange={(e) => {
                  const newSpeed = parseFloat(e.target.value);
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
                }}
                onKeyDown={(e) => {
                  if (emergencyStop) return;
                  
                  let newSpeed = controlInput.speed;
                  let handled = false;
                  
                  switch (e.key) {
                    case 'ArrowUp':
                    case 'ArrowRight':
                      e.preventDefault();
                      newSpeed = Math.min(1, controlInput.speed + 0.1);
                      handled = true;
                      break;
                    case 'ArrowDown':
                    case 'ArrowLeft':
                      e.preventDefault();
                      newSpeed = Math.max(0, controlInput.speed - 0.1);
                      handled = true;
                      break;
                    case 'PageUp':
                      e.preventDefault();
                      newSpeed = Math.min(1, controlInput.speed + 0.2);
                      handled = true;
                      break;
                    case 'PageDown':
                      e.preventDefault();
                      newSpeed = Math.max(0, controlInput.speed - 0.2);
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
                    setControlInput(prev => ({ ...prev, speed: newSpeed }));
                    const announcement = `Speed set to ${Math.round(newSpeed * 100)} percent`;
                    announceToScreenReader(announcement);
                    
                    logger.logUserAction('speed_control', {
                      source: 'keyboard',
                      key: e.key,
                      speed: newSpeed,
                      percentage: Math.round(newSpeed * 100)
                    });
                  }
                }}
                className="speed-slider"
                disabled={emergencyStop}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(controlInput.speed * 100)}
                aria-valuetext={`${Math.round(controlInput.speed * 100)} percent speed`}
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
                onClick={() => exportData('csv')} 
                disabled={telemetryHistory.length === 0}
                aria-label={`Export recorded data as CSV file${telemetryHistory.length === 0 ? ' - no data recorded' : ` - ${telemetryHistory.length} data points`}`}
              >
                Export CSV
              </button>
              <button 
                onClick={() => exportData('json')} 
                disabled={telemetryHistory.length === 0}
                aria-label={`Export recorded data as JSON file${telemetryHistory.length === 0 ? ' - no data recorded' : ` - ${telemetryHistory.length} data points`}`}
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
          isMinimized={panelStates.gauges}
          onToggleMinimize={() => togglePanel('gauges')}
        >
          <div className="gauges-grid">
            <FocusableGauge
              value={telemetry?.battery?.motor?.percentage || 0}
              min={0}
              max={100}
              unit="%"
              label="Motor Battery"
              type="battery"
              testId="gauge-motor-battery"
            />
            <FocusableGauge
              value={telemetry?.battery?.logic?.percentage || 0}
              min={0}
              max={100}
              unit="%"
              label="Logic Battery"
              type="battery"
              testId="gauge-logic-battery"
            />
            <FocusableGauge
              value={telemetry?.temp || 0}
              min={0}
              max={100}
              unit="°C"
              label="Temperature"
              type="temperature"
              testId="gauge-temperature"
            />
            <FocusableGauge
              value={telemetry?.latency || 0}
              min={0}
              max={200}
              unit="ms"
              label="Latency"
              type="latency"
              testId="gauge-latency"
            />
          </div>
        </Panel>
      </div>
    </article>
  );
};

export default Dashboard;