import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Text } from '@react-three/drei';
import { Line } from 'react-chartjs-2';
import Editor from '@monaco-editor/react';
import Draggable from 'react-draggable';
import { ResizableBox } from 'react-resizable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import './App.css';
import 'react-resizable/css/styles.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// 3D Rover Model Component
function RoverModel({ position, rotation, wheelSpeeds }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Rover Body */}
      <Box args={[2, 0.3, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#333333" />
      </Box>
      
      {/* Wheels */}
      {[
        [-0.8, -0.2, 0.4, wheelSpeeds.fl],  // Front Left
        [0.8, -0.2, 0.4, wheelSpeeds.fr],   // Front Right
        [-0.8, -0.2, -0.4, wheelSpeeds.rl], // Rear Left
        [0.8, -0.2, -0.4, wheelSpeeds.rr]   // Rear Right
      ].map(([x, y, z, speed], index) => (
        <group key={index} position={[x, y, z]}>
          <Box args={[0.1, 0.3, 0.3]} rotation={[0, 0, speed * 0.01]}>
            <meshStandardMaterial color="#222222" />
          </Box>
        </group>
      ))}
      
      {/* Direction indicator */}
      <Box args={[0.3, 0.1, 0.1]} position={[1, 0.2, 0]}>
        <meshStandardMaterial color="#00ff00" />
      </Box>
    </group>
  );
}

// Draggable Panel Component
function DraggablePanel({ title, children, defaultPosition, defaultSize, className = "" }) {
  const [size, setSize] = useState(defaultSize);
  
  return (
    <Draggable
      defaultPosition={defaultPosition}
      handle=".panel-header"
      bounds="parent"
    >
      <div className={`draggable-panel ${className}`}>
        <ResizableBox
          width={size.width}
          height={size.height}
          onResize={(e, data) => setSize({ width: data.size.width, height: data.size.height })}
          minConstraints={[300, 200]}
          maxConstraints={[800, 600]}
        >
          <div className="panel-content">
            <div className="panel-header">
              <h3 className="panel-title">{title}</h3>
              <div className="panel-controls">
                <button className="panel-btn minimize">−</button>
                <button className="panel-btn close">×</button>
              </div>
            </div>
            <div className="panel-body" style={{ height: size.height - 40 }}>
              {children}
            </div>
          </div>
        </ResizableBox>
      </div>
    </Draggable>
  );
}

function App() {
  // Core State
  const [activeModule, setActiveModule] = useState('dashboard');
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Control State
  const [controlInput, setControlInput] = useState({
    forward: 0,
    turn: 0,
    speed: 0.8
  });
  
  // AI Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  
  // Arduino IDE State
  const [arduinoCode, setArduinoCode] = useState(`// Arduino Rover Control Code
#include <ArduinoJson.h>

// Pin definitions
const int MOTOR_FL_PWM = 2;
const int MOTOR_FR_PWM = 3;
const int MOTOR_RL_PWM = 9;
const int MOTOR_RR_PWM = 10;

// Hall sensor interrupts
volatile unsigned long wheelPulses[4] = {0, 0, 0, 0};

void setup() {
  Serial1.begin(115200);  // NodeMCU communication
  
  // Configure PWM pins
  pinMode(MOTOR_FL_PWM, OUTPUT);
  pinMode(MOTOR_FR_PWM, OUTPUT);
  pinMode(MOTOR_RL_PWM, OUTPUT);
  pinMode(MOTOR_RR_PWM, OUTPUT);
  
  // Setup hall sensor interrupts
  attachInterrupt(digitalPinToInterrupt(18), hallFL, RISING);
  attachInterrupt(digitalPinToInterrupt(19), hallFR, RISING);
  attachInterrupt(digitalPinToInterrupt(20), hallRL, RISING);
  attachInterrupt(digitalPinToInterrupt(21), hallRR, RISING);
}

void loop() {
  if (Serial1.available()) {
    String jsonString = Serial1.readStringUntil('\\n');
    parseCommand(jsonString);
  }
  
  // Send telemetry every 100ms
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry > 100) {
    sendTelemetry();
    lastTelemetry = millis();
  }
}

// Hall sensor interrupt handlers
void hallFL() { wheelPulses[0]++; }
void hallFR() { wheelPulses[1]++; }
void hallRL() { wheelPulses[2]++; }
void hallRR() { wheelPulses[3]++; }

void parseCommand(String jsonStr) {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, jsonStr);
  
  if (doc["cmd"] == "move") {
    float forward = doc["forward"];
    float turn = doc["turn"];
    float speed = doc["speed"];
    
    // Calculate individual wheel speeds
    float leftSpeed = (forward - turn) * speed * 255;
    float rightSpeed = (forward + turn) * speed * 255;
    
    // Apply PWM values
    analogWrite(MOTOR_FL_PWM, constrain(leftSpeed, 0, 255));
    analogWrite(MOTOR_RL_PWM, constrain(leftSpeed, 0, 255));
    analogWrite(MOTOR_FR_PWM, constrain(rightSpeed, 0, 255));
    analogWrite(MOTOR_RR_PWM, constrain(rightSpeed, 0, 255));
  }
}

void sendTelemetry() {
  DynamicJsonDocument doc(1024);
  doc["type"] = "telemetry";
  
  JsonObject wheels = doc.createNestedObject("wheels");
  wheels["fl"]["rpm"] = calculateRPM(0);
  wheels["fl"]["pulses"] = wheelPulses[0];
  // ... more telemetry data
  
  String output;
  serializeJson(doc, output);
  Serial1.println(output);
}`);
  
  const [serialMonitor, setSerialMonitor] = useState('');
  const [compilationOutput, setCompilationOutput] = useState('');
  const [selectedPort, setSelectedPort] = useState('/dev/ttyUSB0');
  const [availablePorts, setAvailablePorts] = useState(['/dev/ttyUSB0', '/dev/ttyUSB1', 'COM3', 'COM4']);
  
  // Project Management State
  const [projectTasks, setProjectTasks] = useState([
    { id: 1, title: 'Implement motor control PWM', status: 'done', priority: 'high' },
    { id: 2, title: 'Add hall sensor interrupts', status: 'done', priority: 'medium' },
    { id: 3, title: 'Implement emergency stop', status: 'in-progress', priority: 'high' },
    { id: 4, title: 'Add battery monitoring', status: 'todo', priority: 'medium' },
    { id: 5, title: 'Implement PID control', status: 'todo', priority: 'low' },
  ]);
  
  // Configuration State  
  const [config, setConfig] = useState({
    motorPWMFrequency: 1000,
    hallSensorPPR: 23,
    maxSpeed: 255,
    emergencyStopPin: 22,
    batteryVoltagePin: "A0",
    temperatureSensorPin: "A1",
    pid: { kp: 1.0, ki: 0.1, kd: 0.05 }
  });

  const websocket = useRef(null);
  const joystickRef = useRef(null);
  const isDragging = useRef(false);
  const roverPosition = useRef([0, 0, 0]);
  const roverRotation = useRef([0, 0, 0]);

  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + '/api/ws/telemetry';
    websocket.current = new WebSocket(wsUrl);
    
    websocket.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };
    
    websocket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setTelemetry(data);
      setEmergencyStop(data.emergency_stop || false);
      
      // Update telemetry history for charts
      if (isRecording) {
        setTelemetryHistory(prev => [...prev.slice(-100), {
          ...data,
          timestamp: Date.now()
        }]);
      }
      
      // Update 3D rover position (mock physics)
      if (data.control) {
        const speed = data.control.speed || 0;
        const forward = data.control.forward || 0;
        const turn = data.control.turn || 0;
        
        roverPosition.current[0] += forward * speed * 0.1;
        roverPosition.current[2] += turn * speed * 0.05;
        roverRotation.current[1] += turn * speed * 0.1;
      }
    };
    
    websocket.current.onclose = () => {
      setIsConnected(false);
      setTimeout(connectWebSocket, 3000);
    };
  };

  // Control Functions
  const sendControlCommand = async (forward, turn, speed) => {
    try {
      await fetch(`${BACKEND_URL}/api/rover/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forward, turn, speed }),
      });
    } catch (error) {
      console.error('Control error:', error);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/rover/emergency-stop`, { method: 'POST' });
    } catch (error) {
      console.error('Emergency stop error:', error);
    }
  };

  // Arduino IDE Functions
  const compileArduinoCode = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/arduino/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: arduinoCode, board: 'arduino:avr:mega' }),
      });
      const result = await response.json();
      setCompilationOutput(result.output);
    } catch (error) {
      setCompilationOutput(`Compilation error: ${error.message}`);
    }
  };

  const uploadArduinoCode = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/arduino/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: arduinoCode, port: selectedPort, board: 'arduino:avr:mega' }),
      });
      const result = await response.json();
      setCompilationOutput(result.output);
    } catch (error) {
      setCompilationOutput(`Upload error: ${error.message}`);
    }
  };

  const connectSerialMonitor = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/arduino/serial/${selectedPort}`, {
        method: 'GET',
      });
      const result = await response.json();
      setSerialMonitor(result.data);
    } catch (error) {
      setSerialMonitor(`Serial error: ${error.message}`);
    }
  };

  // AI Chat Function
  const sendChatMessage = async () => {
    if (!chatInput.trim() || isAITyping) return;
    
    const userMessage = chatInput.trim();
    const contextData = {
      currentCode: arduinoCode,
      telemetry: telemetry,
      serialOutput: serialMonitor,
      compilationOutput: compilationOutput
    };
    
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsAITyping(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          context: contextData
        }),
      });
      
      const data = await response.json();
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response,
        actions: data.actions // Code insertions, file creations, etc.
      }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
    }
    
    setIsAITyping(false);
  };

  // Data Recording
  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTelemetryHistory([]);
    }
  };

  const exportData = async (format) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/data/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: telemetryHistory, format }),
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rover_data_${Date.now()}.${format}`;
      a.click();
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Chart data preparation
  const chartData = {
    labels: telemetryHistory.map((_, i) => i),
    datasets: [
      {
        label: 'FL RPM',
        data: telemetryHistory.map(t => t.wheels?.fl?.rpm || 0),
        borderColor: '#3b82f6',
        fill: false,
      },
      {
        label: 'FR RPM',
        data: telemetryHistory.map(t => t.wheels?.fr?.rpm || 0),
        borderColor: '#10b981',
        fill: false,
      },
      {
        label: 'RL RPM',
        data: telemetryHistory.map(t => t.wheels?.rl?.rpm || 0),
        borderColor: '#f59e0b',
        fill: false,
      },
      {
        label: 'RR RPM',
        data: telemetryHistory.map(t => t.wheels?.rr?.rpm || 0),
        borderColor: '#ef4444',
        fill: false,
      },
    ],
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <div className="dashboard-workspace">
            {/* Real-time 3D Visualization */}
            <DraggablePanel 
              title="🚀 ROVER 3D VISUALIZATION" 
              defaultPosition={{ x: 20, y: 60 }}
              defaultSize={{ width: 500, height: 400 }}
            >
              <div style={{ width: '100%', height: '100%' }}>
                <Canvas camera={{ position: [5, 5, 5] }}>
                  <ambientLight intensity={0.5} />
                  <pointLight position={[10, 10, 10]} />
                  <RoverModel 
                    position={roverPosition.current}
                    rotation={roverRotation.current}
                    wheelSpeeds={telemetry?.wheels || { fl: 0, fr: 0, rl: 0, rr: 0 }}
                  />
                  <Grid infiniteGrid />
                  <OrbitControls />
                </Canvas>
              </div>
            </DraggablePanel>

            {/* Telemetry Charts */}
            <DraggablePanel 
              title="📊 REAL-TIME TELEMETRY" 
              defaultPosition={{ x: 540, y: 60 }}
              defaultSize={{ width: 600, height: 300 }}
            >
              <div style={{ width: '100%', height: '100%', padding: '10px' }}>
                <Line data={chartData} options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true } }
                }} />
              </div>
            </DraggablePanel>

            {/* Control Panel */}
            <DraggablePanel 
              title="🎮 ROVER CONTROL" 
              defaultPosition={{ x: 20, y: 480 }}
              defaultSize={{ width: 400, height: 350 }}
            >
              <div className="control-content">
                <button 
                  className={`emergency-stop ${emergencyStop ? 'active' : ''}`}
                  onClick={handleEmergencyStop}
                >
                  {emergencyStop ? 'STOPPED' : 'EMERGENCY STOP'}
                </button>

                <div className="joystick-container">
                  <div ref={joystickRef} className="joystick">
                    <div 
                      className="joystick-knob"
                      style={{
                        transform: `translate(${controlInput.turn * 40}px, ${-controlInput.forward * 40}px)`
                      }}
                    />
                  </div>
                </div>

                <div className="speed-control">
                  <label>Speed: {Math.round(controlInput.speed * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={controlInput.speed}
                    onChange={(e) => setControlInput(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                    disabled={emergencyStop}
                  />
                </div>

                <div className="data-recording">
                  <button onClick={toggleRecording}>
                    {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
                  </button>
                  <button onClick={() => exportData('csv')}>Export CSV</button>
                  <button onClick={() => exportData('json')}>Export JSON</button>
                </div>
              </div>
            </DraggablePanel>

            {/* Status Panel */}
            <DraggablePanel 
              title="📋 SYSTEM STATUS" 
              defaultPosition={{ x: 440, y: 480 }}
              defaultSize={{ width: 350, height: 250 }}
            >
              <div className="status-grid">
                <div className="status-row">
                  <span>Connection:</span>
                  <span className={isConnected ? 'status-good' : 'status-bad'}>
                    {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                  </span>
                </div>
                <div className="status-row">
                  <span>Motor Battery:</span>
                  <span>{telemetry?.battery?.motor || '0.0'}V</span>
                </div>
                <div className="status-row">
                  <span>Logic Battery:</span>
                  <span>{telemetry?.battery?.logic || '0.0'}V</span>
                </div>
                <div className="status-row">
                  <span>Temperature:</span>
                  <span className={telemetry?.temp > 70 ? 'status-warning' : ''}>
                    {telemetry?.temp || '0.0'}°C
                  </span>
                </div>
                <div className="status-row">
                  <span>Uptime:</span>
                  <span>{telemetry?.uptime ? Math.floor(telemetry.uptime / 1000) : 0}s</span>
                </div>
              </div>
            </DraggablePanel>
          </div>
        );

      case 'ide':
        return (
          <div className="ide-workspace">
            {/* Code Editor */}
            <DraggablePanel 
              title="💻 ARDUINO IDE" 
              defaultPosition={{ x: 20, y: 60 }}
              defaultSize={{ width: 700, height: 500 }}
            >
              <div style={{ width: '100%', height: '100%' }}>
                <div className="editor-toolbar">
                  <button onClick={compileArduinoCode} className="toolbar-btn compile">
                    🔨 Compile
                  </button>
                  <button onClick={uploadArduinoCode} className="toolbar-btn upload">
                    📤 Upload
                  </button>
                  <select 
                    value={selectedPort} 
                    onChange={(e) => setSelectedPort(e.target.value)}
                    className="port-select"
                  >
                    {availablePorts.map(port => (
                      <option key={port} value={port}>{port}</option>
                    ))}
                  </select>
                  <button onClick={connectSerialMonitor} className="toolbar-btn serial">
                    📺 Serial Monitor
                  </button>
                </div>
                
                <Editor
                  height="400px"
                  defaultLanguage="cpp"
                  theme="vs-dark"
                  value={arduinoCode}
                  onChange={(value) => setArduinoCode(value)}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                  }}
                />
              </div>
            </DraggablePanel>

            {/* Serial Monitor */}
            <DraggablePanel 
              title="📺 SERIAL MONITOR" 
              defaultPosition={{ x: 740, y: 60 }}
              defaultSize={{ width: 400, height: 300 }}
            >
              <div className="serial-monitor">
                <div className="serial-controls">
                  <button onClick={connectSerialMonitor}>Connect</button>
                  <button onClick={() => setSerialMonitor('')}>Clear</button>
                </div>
                <textarea
                  className="serial-output"
                  value={serialMonitor}
                  readOnly
                  placeholder="Serial output will appear here..."
                />
              </div>
            </DraggablePanel>

            {/* Compilation Output */}
            <DraggablePanel 
              title="🔨 COMPILATION OUTPUT" 
              defaultPosition={{ x: 740, y: 380 }}
              defaultSize={{ width: 400, height: 200 }}
            >
              <div className="compilation-output">
                <textarea
                  value={compilationOutput}
                  readOnly
                  placeholder="Compilation results will appear here..."
                />
              </div>
            </DraggablePanel>
          </div>
        );

      case 'project':
        return (
          <div className="project-workspace">
            {/* Kanban Board */}
            <DraggablePanel 
              title="📋 PROJECT KANBAN" 
              defaultPosition={{ x: 20, y: 60 }}
              defaultSize={{ width: 800, height: 400 }}
            >
              <div className="kanban-board">
                {['todo', 'in-progress', 'done'].map(status => (
                  <div key={status} className="kanban-column">
                    <h4 className="column-header">{status.toUpperCase()}</h4>
                    <div className="task-list">
                      {projectTasks.filter(task => task.status === status).map(task => (
                        <div key={task.id} className={`task-card priority-${task.priority}`}>
                          <div className="task-title">{task.title}</div>
                          <div className="task-meta">
                            <span className={`priority priority-${task.priority}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DraggablePanel>

            {/* Component Inventory */}
            <DraggablePanel 
              title="📦 COMPONENT INVENTORY" 
              defaultPosition={{ x: 20, y: 480 }}
              defaultSize={{ width: 400, height: 250 }}
            >
              <div className="inventory-list">
                <div className="inventory-item">
                  <span>Arduino Mega 2560</span>
                  <span className="quantity">1x ✅</span>
                </div>
                <div className="inventory-item">
                  <span>NodeMCU Amica</span>
                  <span className="quantity">1x ✅</span>
                </div>
                <div className="inventory-item">
                  <span>RioRand BLDC Controllers</span>
                  <span className="quantity">4x ✅</span>
                </div>
                <div className="inventory-item">
                  <span>Hoverboard Wheels</span>
                  <span className="quantity">4x ✅</span>
                </div>
                <div className="inventory-item">
                  <span>36V Battery</span>
                  <span className="quantity">1x ⚠️</span>
                </div>
                <div className="inventory-item">
                  <span>25.2V Battery</span>
                  <span className="quantity">1x ❌</span>
                </div>
              </div>
            </DraggablePanel>
          </div>
        );

      case 'config':
        return (
          <div className="config-workspace">
            {/* Hardware Configuration */}
            <DraggablePanel 
              title="⚙️ HARDWARE CONFIGURATION" 
              defaultPosition={{ x: 20, y: 60 }}
              defaultSize={{ width: 600, height: 500 }}
            >
              <div className="config-form">
                <div className="config-section">
                  <h4>Motor Control</h4>
                  <label>
                    PWM Frequency (Hz):
                    <input
                      type="number"
                      value={config.motorPWMFrequency}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        motorPWMFrequency: parseInt(e.target.value)
                      }))}
                    />
                  </label>
                  <label>
                    Max Speed (0-255):
                    <input
                      type="number"
                      value={config.maxSpeed}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        maxSpeed: parseInt(e.target.value)
                      }))}
                    />
                  </label>
                </div>
                
                <div className="config-section">
                  <h4>Sensors</h4>
                  <label>
                    Hall Sensor PPR:
                    <input
                      type="number"
                      value={config.hallSensorPPR}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        hallSensorPPR: parseInt(e.target.value)
                      }))}
                    />
                  </label>
                  <label>
                    Battery Voltage Pin:
                    <input
                      type="text"
                      value={config.batteryVoltagePin}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        batteryVoltagePin: e.target.value
                      }))}
                    />
                  </label>
                </div>

                <div className="config-section">
                  <h4>PID Controller</h4>
                  <label>
                    Kp: <input
                      type="number"
                      step="0.1"
                      value={config.pid.kp}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pid: { ...prev.pid, kp: parseFloat(e.target.value) }
                      }))}
                    />
                  </label>
                  <label>
                    Ki: <input
                      type="number"
                      step="0.01"
                      value={config.pid.ki}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pid: { ...prev.pid, ki: parseFloat(e.target.value) }
                      }))}
                    />
                  </label>
                  <label>
                    Kd: <input
                      type="number"
                      step="0.01"
                      value={config.pid.kd}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        pid: { ...prev.pid, kd: parseFloat(e.target.value) }
                      }))}
                    />
                  </label>
                </div>
                
                <div className="config-actions">
                  <button className="config-btn save">💾 Save Configuration</button>
                  <button className="config-btn load">📁 Load Configuration</button>
                  <button className="config-btn export">📤 Export Config</button>
                </div>
              </div>
            </DraggablePanel>

            {/* Pin Mapping */}
            <DraggablePanel 
              title="🔌 PIN MAPPING" 
              defaultPosition={{ x: 640, y: 60 }}
              defaultSize={{ width: 400, height: 400 }}
            >
              <div className="pin-mapping">
                <div className="pin-group">
                  <h5>Motor PWM Pins</h5>
                  <div>FL Motor: Pin 2</div>
                  <div>FR Motor: Pin 3</div>
                  <div>RL Motor: Pin 9</div>
                  <div>RR Motor: Pin 10</div>
                </div>
                <div className="pin-group">
                  <h5>Hall Sensor Pins</h5>
                  <div>FL Sensor: Pin 18 (INT3)</div>
                  <div>FR Sensor: Pin 19 (INT2)</div>
                  <div>RL Sensor: Pin 20 (INT1)</div>
                  <div>RR Sensor: Pin 21 (INT0)</div>
                </div>
                <div className="pin-group">
                  <h5>Communication</h5>
                  <div>NodeMCU: Serial1 (Pins 18-19)</div>
                  <div>I2C: Pins 20-21</div>
                </div>
              </div>
            </DraggablePanel>
          </div>
        );

      case 'ai':
        return (
          <div className="ai-workspace">
            <DraggablePanel 
              title="🤖 AI COMMAND CENTER" 
              defaultPosition={{ x: 20, y: 60 }}
              defaultSize={{ width: 800, height: 600 }}
            >
              <div className="ai-chat-container">
                <div className="context-panel">
                  <h5>Current Context</h5>
                  <div className="context-items">
                    <div className="context-item">
                      📄 Arduino Code ({arduinoCode.split('\n').length} lines)
                    </div>
                    <div className="context-item">
                      📊 Live Telemetry ({telemetry ? 'Active' : 'Inactive'})
                    </div>
                    <div className="context-item">
                      🖥️ Serial Output ({serialMonitor.split('\n').length} lines)
                    </div>
                  </div>
                </div>
                
                <div className="chat-messages">
                  {chatMessages.length === 0 && (
                    <div className="welcome-message">
                      🤖 <strong>AI Development Assistant Ready!</strong>
                      <br/><br/>
                      I have full context of your rover project including:
                      <br/>• Current Arduino code
                      <br/>• Real-time telemetry data
                      <br/>• Serial monitor output
                      <br/>• Hardware configuration
                      <br/><br/>
                      Ask me anything about rover development, debugging, optimization, or new features!
                    </div>
                  )}
                  
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`chat-message ${message.role}`}>
                      <div className="message-content">{message.content}</div>
                      {message.actions && (
                        <div className="message-actions">
                          {message.actions.map((action, i) => (
                            <button key={i} className="action-btn">
                              {action.type}: {action.description}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isAITyping && (
                    <div className="chat-message assistant typing">
                      <div className="typing-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="chat-input-container">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask about rover development, debugging, optimization..."
                    className="ai-chat-input"
                  />
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || isAITyping}>
                    Send
                  </button>
                </div>
              </div>
            </DraggablePanel>
          </div>
        );

      default:
        return <div>Select a module from the sidebar</div>;
    }
  };

  return (
    <div className="app">
      {/* Main Header */}
      <header className="main-header">
        <div className="header-left">
          <h1 className="app-title">🚀 ROVER DEVELOPMENT PLATFORM</h1>
          <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot"></span>
            {isConnected ? 'MISSION CONTROL ONLINE' : 'OFFLINE'}
          </div>
        </div>
        <div className="header-right">
          <div className="header-stats">
            <div className="stat">
              <span className="stat-label">Uptime:</span>
              <span className="stat-value">{telemetry?.uptime ? Math.floor(telemetry.uptime / 1000) : 0}s</span>
            </div>
            <div className="stat">
              <span className="stat-label">Temp:</span>
              <span className={`stat-value ${telemetry?.temp > 70 ? 'warning' : ''}`}>
                {telemetry?.temp?.toFixed(1) || '0.0'}°C
              </span>
            </div>
          </div>
          {emergencyStop && (
            <button className="resume-btn" onClick={() => fetch(`${BACKEND_URL}/api/rover/resume`, {method: 'POST'})}>
              RESUME ROVER
            </button>
          )}
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar Navigation */}
        <nav className="sidebar">
          <div className="nav-section">
            <h3>MISSION CONTROL</h3>
            <button 
              className={`nav-btn ${activeModule === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveModule('dashboard')}
            >
              📊 Operations Dashboard
            </button>
            <button 
              className={`nav-btn ${activeModule === 'ide' ? 'active' : ''}`}
              onClick={() => setActiveModule('ide')}
            >
              💻 Arduino IDE
            </button>
            <button 
              className={`nav-btn ${activeModule === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveModule('ai')}
            >
              🤖 AI Assistant
            </button>
          </div>

          <div className="nav-section">
            <h3>PROJECT TOOLS</h3>
            <button 
              className={`nav-btn ${activeModule === 'project' ? 'active' : ''}`}
              onClick={() => setActiveModule('project')}
            >
              📋 Project Management
            </button>
            <button 
              className={`nav-btn ${activeModule === 'config' ? 'active' : ''}`}
              onClick={() => setActiveModule('config')}
            >
              ⚙️ Configuration
            </button>
            <button className="nav-btn">
              📚 Knowledge Base
            </button>
            <button className="nav-btn">
              🧪 Testing Suite
            </button>
          </div>

          <div className="nav-section">
            <h3>SYSTEM</h3>
            <button className="nav-btn">
              📈 Analytics
            </button>
            <button className="nav-btn">
              📖 Documentation
            </button>
            <button className="nav-btn">
              🔧 Communication Hub
            </button>
          </div>

          <div className="sidebar-footer">
            <div className="rover-status-mini">
              <div className="mini-stat">
                <span>Motor:</span>
                <span className={`battery-level ${(telemetry?.battery?.motor || 0) < 35 ? 'low' : ''}`}>
                  {telemetry?.battery?.motor?.toFixed(1) || '0.0'}V
                </span>
              </div>
              <div className="mini-stat">
                <span>Logic:</span>
                <span className={`battery-level ${(telemetry?.battery?.logic || 0) < 22 ? 'low' : ''}`}>
                  {telemetry?.battery?.logic?.toFixed(1) || '0.0'}V
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Workspace */}
        <main className="workspace">
          {renderModule()}
        </main>
      </div>
    </div>
  );
}

export default App;