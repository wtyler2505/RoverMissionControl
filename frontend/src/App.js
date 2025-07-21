import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Box, Text } from '@react-three/drei';
import { Line } from 'react-chartjs-2';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
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

// Enhanced 3D Rover Model with realistic animations
function RoverModel({ position, rotation, wheelSpeeds }) {
  const wheelsRef = useRef([]);
  
  useEffect(() => {
    // Animate wheels based on RPM
    const animateWheels = () => {
      if (wheelsRef.current) {
        Object.entries(wheelSpeeds).forEach(([wheel, rpm], index) => {
          if (wheelsRef.current[index]) {
            wheelsRef.current[index].rotation.x += (rpm || 0) * 0.01;
          }
        });
      }
      requestAnimationFrame(animateWheels);
    };
    animateWheels();
  }, [wheelSpeeds]);

  return (
    <group position={position} rotation={rotation}>
      {/* Rover Body */}
      <Box args={[2, 0.3, 1]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#333333" />
      </Box>
      
      {/* Wheels with fault indication */}
      {[
        [-0.8, -0.2, 0.4, 'fl'],  // Front Left
        [0.8, -0.2, 0.4, 'fr'],   // Front Right
        [-0.8, -0.2, -0.4, 'rl'], // Rear Left
        [0.8, -0.2, -0.4, 'rr']   // Rear Right
      ].map(([x, y, z, wheel], index) => {
        const isFaulted = wheelSpeeds[wheel + '_fault'] || false;
        return (
          <group key={wheel} position={[x, y, z]}>
            <Box 
              args={[0.1, 0.3, 0.3]} 
              ref={el => wheelsRef.current[index] = el}
            >
              <meshStandardMaterial color={isFaulted ? "#ff4444" : "#222222"} />
            </Box>
            {/* Fault indicator */}
            {isFaulted && (
              <Box args={[0.05, 0.05, 0.05]} position={[0, 0.2, 0]}>
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.3} />
              </Box>
            )}
          </group>
        );
      })}
      
      {/* Direction indicator */}
      <Box args={[0.3, 0.1, 0.1]} position={[1, 0.2, 0]}>
        <meshStandardMaterial color="#00ff00" />
      </Box>
      
      {/* Status indicators */}
      <Text
        position={[0, 0.5, 0]}
        fontSize={0.1}
        color={wheelSpeeds.emergency_stop ? "#ff0000" : "#00ff00"}
        anchorX="center"
        anchorY="middle"
      >
        {wheelSpeeds.emergency_stop ? "EMERGENCY STOP" : "OPERATIONAL"}
      </Text>
    </group>
  );
}

// Enhanced Telemetry Gauge Component
function TelemetryGauge({ value, min, max, unit, label, type = "normal" }) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const angle = (percentage / 100) * 180 - 90;
  
  let colorClass = "gauge-normal";
  if (type === "battery") {
    colorClass = percentage > 60 ? "gauge-good" : percentage > 30 ? "gauge-warning" : "gauge-critical";
  } else if (type === "temperature") {
    colorClass = percentage < 70 ? "gauge-good" : percentage < 85 ? "gauge-warning" : "gauge-critical";
  }
  
  return (
    <div className={`telemetry-gauge ${colorClass}`}>
      <div className="gauge-label">{label}</div>
      <div className="gauge-container">
        <svg viewBox="0 0 100 60" className="gauge-svg">
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="#333"
            strokeWidth="8"
            fill="none"
          />
          {/* Value arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${percentage * 1.26} 126`}
            className="gauge-arc"
          />
          {/* Needle */}
          <g transform={`translate(50, 50) rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-35" stroke="#fff" strokeWidth="2" />
            <circle cx="0" cy="0" r="3" fill="#fff" />
          </g>
        </svg>
        <div className="gauge-value">
          {typeof value === 'number' ? value.toFixed(1) : value}
          <span className="gauge-unit">{unit}</span>
        </div>
      </div>
    </div>
  );
}

// Static Panel Component
function Panel({ title, children, className = "", isMinimized = false, onToggleMinimize }) {
  return (
    <div className={`panel ${className} ${isMinimized ? 'minimized' : ''}`}>
      <div className="panel-header">
        <h3 className="panel-title">{title}</h3>
        <div className="panel-controls">
          <button 
            className="panel-btn minimize" 
            onClick={onToggleMinimize}
            title={isMinimized ? "Maximize" : "Minimize"}
          >
            {isMinimized ? '+' : '−'}
          </button>
        </div>
      </div>
      {!isMinimized && (
        <div className="panel-body">
          {children}
        </div>
      )}
    </div>
  );
}

// Gamepad Input Hook
function useGamepad() {
  const [gamepadState, setGamepadState] = useState({
    connected: false,
    axes: [0, 0, 0, 0],
    buttons: []
  });
  
  useEffect(() => {
    let animationFrame;
    
    const updateGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gamepad = gamepads[0];
      
      if (gamepad) {
        setGamepadState({
          connected: true,
          axes: [...gamepad.axes],
          buttons: [...gamepad.buttons.map(b => b.pressed)]
        });
      } else {
        setGamepadState(prev => ({ ...prev, connected: false }));
      }
      
      animationFrame = requestAnimationFrame(updateGamepad);
    };
    
    updateGamepad();
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, []);
  
  return gamepadState;
}

// Input Smoothing Hook
function useSmoothedInput(input, smoothFactor = 0.3) {
  const [smoothed, setSmoothed] = useState(0);
  
  useEffect(() => {
    setSmoothed(prev => prev + (input - prev) * smoothFactor);
  }, [input, smoothFactor]);
  
  return smoothed;
}

function App() {
  // Core State
  const [activeModule, setActiveModule] = useState('dashboard');
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Panel minimize states
  const [panelStates, setPanelStates] = useState({
    rover3d: false,
    telemetryChart: false,
    control: false,
    status: false,
    arduino: false,
    serial: false,
    compilation: false,
    kanban: false,
    inventory: false,
    config: false,
    pinmap: false,
    ai: false,
    libraries: false,
    gauges: false
  });
  
  // Enhanced Control State with input smoothing
  const [controlInput, setControlInput] = useState({
    forward: 0,
    turn: 0,
    speed: 0.8
  });
  
  // Gamepad support
  const gamepad = useGamepad();
  const smoothedForward = useSmoothedInput(controlInput.forward);
  const smoothedTurn = useSmoothedInput(controlInput.turn);
  
  // AI Chat State with streaming
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Arduino IDE State
  const [arduinoCode, setArduinoCode] = useState(`// Enhanced Arduino Rover Control Code
#include <ArduinoJson.h>

// Pin definitions
const int MOTOR_FL_PWM = 2;
const int MOTOR_FR_PWM = 3;
const int MOTOR_RL_PWM = 9;
const int MOTOR_RR_PWM = 10;

// Hall sensor interrupts
volatile unsigned long wheelPulses[4] = {0, 0, 0, 0};

// Safety and watchdog
const int EMERGENCY_STOP_PIN = 22;
const unsigned long WATCHDOG_TIMEOUT = 500; // 500ms
unsigned long lastHeartbeat = 0;
bool emergencyStop = false;

void setup() {
  Serial1.begin(115200);  // NodeMCU communication
  
  // Configure PWM pins
  pinMode(MOTOR_FL_PWM, OUTPUT);
  pinMode(MOTOR_FR_PWM, OUTPUT);
  pinMode(MOTOR_RL_PWM, OUTPUT);
  pinMode(MOTOR_RR_PWM, OUTPUT);
  
  // Emergency stop pin
  pinMode(EMERGENCY_STOP_PIN, INPUT_PULLUP);
  
  // Setup hall sensor interrupts
  attachInterrupt(digitalPinToInterrupt(18), hallFL, RISING);
  attachInterrupt(digitalPinToInterrupt(19), hallFR, RISING);
  attachInterrupt(digitalPinToInterrupt(20), hallRL, RISING);
  attachInterrupt(digitalPinToInterrupt(21), hallRR, RISING);
  
  // Initialize
  lastHeartbeat = millis();
}

void loop() {
  // Check watchdog timer
  if (millis() - lastHeartbeat > WATCHDOG_TIMEOUT) {
    emergencyStop = true;
    stopAllMotors();
  }
  
  // Check physical emergency stop
  if (digitalRead(EMERGENCY_STOP_PIN) == LOW) {
    emergencyStop = true;
    stopAllMotors();
  }
  
  // Handle serial communication
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
  DeserializationError error = deserializeJson(doc, jsonStr);
  
  if (error) return;
  
  // Handle heartbeat
  if (doc["type"] == "heartbeat") {
    lastHeartbeat = millis();
    return;
  }
  
  // Handle movement commands
  if (doc["cmd"] == "move" && !emergencyStop) {
    float forward = constrain(doc["forward"], -1.0, 1.0);
    float turn = constrain(doc["turn"], -1.0, 1.0);
    float speed = constrain(doc["speed"], 0.0, 1.0);
    
    // Calculate individual wheel speeds with differential steering
    float leftSpeed = (forward - turn) * speed * 255;
    float rightSpeed = (forward + turn) * speed * 255;
    
    // Apply PWM values with safety limits
    analogWrite(MOTOR_FL_PWM, constrain(abs(leftSpeed), 0, 255));
    analogWrite(MOTOR_RL_PWM, constrain(abs(leftSpeed), 0, 255));
    analogWrite(MOTOR_FR_PWM, constrain(abs(rightSpeed), 0, 255));
    analogWrite(MOTOR_RR_PWM, constrain(abs(rightSpeed), 0, 255));
    
    lastHeartbeat = millis(); // Reset watchdog on valid command
  }
  
  // Handle emergency stop
  if (doc["cmd"] == "emergency_stop") {
    emergencyStop = true;
    stopAllMotors();
  }
  
  // Handle resume
  if (doc["cmd"] == "resume") {
    emergencyStop = false;
    lastHeartbeat = millis();
  }
}

void stopAllMotors() {
  analogWrite(MOTOR_FL_PWM, 0);
  analogWrite(MOTOR_FR_PWM, 0);
  analogWrite(MOTOR_RL_PWM, 0);
  analogWrite(MOTOR_RR_PWM, 0);
}

void sendTelemetry() {
  DynamicJsonDocument doc(1024);
  doc["type"] = "telemetry";
  doc["timestamp"] = millis();
  doc["emergency_stop"] = emergencyStop;
  
  // Wheel data
  JsonObject wheels = doc.createNestedObject("wheels");
  wheels["fl"]["rpm"] = calculateRPM(0);
  wheels["fl"]["pulses"] = wheelPulses[0];
  wheels["fr"]["rpm"] = calculateRPM(1);
  wheels["fr"]["pulses"] = wheelPulses[1];
  wheels["rl"]["rpm"] = calculateRPM(2);
  wheels["rl"]["pulses"] = wheelPulses[2];
  wheels["rr"]["rpm"] = calculateRPM(3);
  wheels["rr"]["pulses"] = wheelPulses[3];
  
  // Battery monitoring
  JsonObject battery = doc.createNestedObject("battery");
  battery["motor"] = analogRead(A0) * (42.0 / 1023.0); // Voltage divider
  battery["logic"] = analogRead(A1) * (25.2 / 1023.0);
  
  // Temperature
  doc["temp"] = analogRead(A2) * (100.0 / 1023.0); // Example temp sensor
  
  String output;
  serializeJson(doc, output);
  Serial1.println(output);
}

int calculateRPM(int wheelIndex) {
  static unsigned long lastTime[4] = {0, 0, 0, 0};
  static unsigned long lastPulses[4] = {0, 0, 0, 0};
  
  unsigned long currentTime = millis();
  unsigned long currentPulses = wheelPulses[wheelIndex];
  
  if (currentTime - lastTime[wheelIndex] >= 100) { // Calculate every 100ms
    unsigned long deltaTime = currentTime - lastTime[wheelIndex];
    unsigned long deltaPulses = currentPulses - lastPulses[wheelIndex];
    
    // RPM = (pulses / time) * (60000 / pulses_per_rev)
    int rpm = (deltaPulses * 60000) / (deltaTime * 23); // 23 pulses per revolution
    
    lastTime[wheelIndex] = currentTime;
    lastPulses[wheelIndex] = currentPulses;
    
    return rpm;
  }
  
  return 0; // Return 0 if not enough time has passed
}`);
  
  const [serialMonitor, setSerialMonitor] = useState('');
  const [compilationOutput, setCompilationOutput] = useState('');
  const [selectedPort, setSelectedPort] = useState('/dev/ttyUSB0');
  const [availablePorts, setAvailablePorts] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [installedLibraries, setInstalledLibraries] = useState([]);
  
  // Editor ref for Monaco actions
  const editorRef = useRef(null);
  
  // Project Management State
  const [projectTasks, setProjectTasks] = useState([
    { id: 1, title: 'Implement watchdog timer safety', status: 'done', priority: 'high' },
    { id: 2, title: 'Add gamepad controller support', status: 'done', priority: 'high' },
    { id: 3, title: 'Enhance telemetry with gauges', status: 'done', priority: 'medium' },
    { id: 4, title: 'Add library manager', status: 'done', priority: 'medium' },
    { id: 5, title: 'Implement AI code actions', status: 'done', priority: 'high' },
    { id: 6, title: 'Add PID motor control', status: 'todo', priority: 'medium' },
    { id: 7, title: 'Implement path planning', status: 'todo', priority: 'low' },
  ]);
  
  // Knowledge Base state
  const [knowledgeModule, setKnowledgeModule] = useState('parts'); // 'parts', 'docs', 'search', 'calculators'
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [calculatorResults, setCalculatorResults] = useState({});

  const websocket = useRef(null);
  const joystickRef = useRef(null);
  const isDragging = useRef(false);
  const roverPosition = useRef([0, 0, 0]);
  const roverRotation = useRef([0, 0, 0]);
  const heartbeatInterval = useRef(null);

  // WebSocket connection with heartbeat
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    const wsUrl = BACKEND_URL.replace('http', 'ws') + '/api/ws/telemetry';
    websocket.current = new WebSocket(wsUrl);
    
    websocket.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
      
      // Start heartbeat
      heartbeatInterval.current = setInterval(() => {
        if (websocket.current?.readyState === WebSocket.OPEN) {
          websocket.current.send(JSON.stringify({ type: 'heartbeat' }));
        }
      }, 100); // Send heartbeat every 100ms
    };
    
    websocket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'heartbeat_ack') {
        // Heartbeat acknowledged
        return;
      }
      
      setTelemetry(data);
      setEmergencyStop(data.emergency_stop || false);
      
      // Update telemetry history for charts
      if (isRecording) {
        setTelemetryHistory(prev => [...prev.slice(-100), {
          ...data,
          timestamp: Date.now()
        }]);
      }
      
      // Update 3D rover position (enhanced physics)
      if (data.control) {
        const speed = data.control.speed_multiplier || 0;
        const forward = data.control.forward || 0;
        const turn = data.control.turn || 0;
        
        roverPosition.current[0] += forward * speed * 0.1;
        roverPosition.current[2] += turn * speed * 0.05;
        roverRotation.current[1] += turn * speed * 0.1;
      }
    };
    
    websocket.current.onclose = () => {
      setIsConnected(false);
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      setTimeout(connectWebSocket, 3000);
    };
  };

  // Gamepad control handling
  useEffect(() => {
    if (gamepad.connected && !emergencyStop) {
      const forward = -gamepad.axes[1]; // Left stick Y (inverted)
      const turn = gamepad.axes[0];     // Left stick X
      
      // Deadzone handling
      const deadzone = 0.1;
      const processedForward = Math.abs(forward) > deadzone ? forward : 0;
      const processedTurn = Math.abs(turn) > deadzone ? turn : 0;
      
      if (Math.abs(processedForward) > 0.05 || Math.abs(processedTurn) > 0.05) {
        setControlInput(prev => ({ 
          ...prev, 
          forward: processedForward, 
          turn: processedTurn 
        }));
        sendControlCommand(processedForward, processedTurn, controlInput.speed);
      }
      
      // Emergency stop with gamepad button
      if (gamepad.buttons[8] || gamepad.buttons[9]) { // Start/Select buttons
        handleEmergencyStop();
      }
    }
  }, [gamepad, emergencyStop, controlInput.speed]);

  // Enhanced control functions
  const sendControlCommand = useCallback(async (forward, turn, speed) => {
    try {
      // Send via WebSocket for lower latency
      if (websocket.current?.readyState === WebSocket.OPEN) {
        websocket.current.send(JSON.stringify({
          type: 'control',
          forward,
          turn,
          speed
        }));
      } else {
        // Fallback to HTTP
        await fetch(`${BACKEND_URL}/api/rover/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ forward, turn, speed }),
        });
      }
    } catch (error) {
      console.error('Control error:', error);
    }
  }, []);

  const handleEmergencyStop = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/rover/emergency-stop`, { method: 'POST' });
      setControlInput({ forward: 0, turn: 0, speed: 0 });
    } catch (error) {
      console.error('Emergency stop error:', error);
    }
  };

  // Joystick handling with smooth input
  const handleJoystickMove = (clientX, clientY) => {
    if (!joystickRef.current) return;
    
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const maxRadius = rect.width / 2 - 10;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let normalizedX = deltaX / maxRadius;
    let normalizedY = deltaY / maxRadius;
    
    if (distance > maxRadius) {
      normalizedX = (deltaX / distance) * 1;
      normalizedY = (deltaY / distance) * 1;
    }
    
    const forward = -normalizedY; // Invert Y axis
    const turn = normalizedX;
    
    setControlInput(prev => ({ ...prev, forward, turn }));
    sendControlCommand(forward, turn, controlInput.speed);
  };

  const handleMouseDown = (e) => {
    if (emergencyStop) return;
    isDragging.current = true;
    handleJoystickMove(e.clientX, e.clientY);
  };

  const handleMouseMove = (e) => {
    if (isDragging.current && !emergencyStop) {
      handleJoystickMove(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setControlInput(prev => ({ ...prev, forward: 0, turn: 0 }));
    sendControlCommand(0, 0, controlInput.speed);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [emergencyStop, controlInput.speed]);

  // Keyboard controls with emergency stop
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (emergencyStop) return;
      
      let forward = 0;
      let turn = 0;
      
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          forward = 0.8;
          break;
        case 's':
        case 'arrowdown':
          forward = -0.8;
          break;
        case 'a':
        case 'arrowleft':
          turn = -0.8;
          break;
        case 'd':
        case 'arrowright':
          turn = 0.8;
          break;
        case ' ':
        case 'escape':
          e.preventDefault();
          handleEmergencyStop();
          return;
        default:
          return;
      }
      
      e.preventDefault();
      setControlInput(prev => ({ ...prev, forward, turn }));
      sendControlCommand(forward, turn, controlInput.speed);
    };

    const handleKeyUp = (e) => {
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        setControlInput(prev => ({ ...prev, forward: 0, turn: 0 }));
        sendControlCommand(0, 0, controlInput.speed);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [emergencyStop, controlInput.speed]);

  // Load available serial ports
  useEffect(() => {
    const loadPorts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/arduino/ports`);
        const data = await response.json();
        setAvailablePorts(data.ports || []);
      } catch (error) {
        console.error('Error loading ports:', error);
      }
    };
    
    loadPorts();
  }, []);

  // Load installed libraries
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/arduino/libraries`);
        const data = await response.json();
        setInstalledLibraries(data.libraries || []);
      } catch (error) {
        console.error('Error loading libraries:', error);
      }
    };
    
    loadLibraries();
  }, []);

  // Monaco Editor Actions
  useEffect(() => {
    if (editorRef.current) {
      const editor = editorRef.current;
      
      // Add custom Arduino language support
      monaco.languages.register({ id: 'arduino' });
      monaco.languages.setMonarchTokensProvider('arduino', {
        tokenizer: {
          root: [
            [/\b(setup|loop|pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|Serial|String)\b/, 'keyword.arduino'],
            [/\b(int|float|boolean|char|byte|void|const|volatile)\b/, 'keyword.type'],
            [/\b(HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP)\b/, 'keyword.constant'],
            [/\b(if|else|for|while|do|switch|case|break|continue|return)\b/, 'keyword.control'],
            [/\/\/.*$/, 'comment'],
            [/\/\*[\s\S]*?\*\//, 'comment'],
            [/".*?"/, 'string'],
            [/\b\d+\b/, 'number']
          ]
        }
      });
      
      // Add code actions
      editor.addAction({
        id: 'explain-code',
        label: 'Explain Code with AI',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE],
        contextMenuGroupId: 'ai-actions',
        run: async (ed) => {
          const selection = ed.getSelection();
          const selectedText = ed.getModel().getValueInRange(selection);
          if (selectedText) {
            await explainCode(selectedText);
          }
        }
      });
      
      editor.addAction({
        id: 'optimize-code',
        label: 'Optimize Code with AI',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO],
        contextMenuGroupId: 'ai-actions',
        run: async (ed) => {
          const selection = ed.getSelection();
          const selectedText = ed.getModel().getValueInRange(selection);
          if (selectedText) {
            await optimizeCode(selectedText, selection);
          }
        }
      });
      
      editor.addAction({
        id: 'generate-test',
        label: 'Generate Test Code',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyT],
        contextMenuGroupId: 'ai-actions',
        run: async (ed) => {
          const selection = ed.getSelection();
          const selectedText = ed.getModel().getValueInRange(selection);
          if (selectedText) {
            await generateTest(selectedText);
          }
        }
      });
    }
  }, [editorRef.current]);

  // AI Code Actions
  const explainCode = async (code) => {
    const message = `Please explain this Arduino code in detail:\n\`\`\`cpp\n${code}\n\`\`\``;
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    await sendChatMessage(message, true);
  };

  const optimizeCode = async (code, selection) => {
    const message = `Please optimize this Arduino code for better performance and readability:\n\`\`\`cpp\n${code}\n\`\`\``;
    setChatMessages(prev => [...prev, { role: 'user', content: `Optimize: ${code}` }]);
    
    const optimizedCode = await sendChatMessage(message, true);
    
    // If we get back code, offer to replace
    if (optimizedCode.includes('```cpp') && editorRef.current) {
      const confirmed = window.confirm('Apply optimized code to editor?');
      if (confirmed) {
        const match = optimizedCode.match(/```cpp\n([\s\S]*?)\n```/);
        if (match) {
          editorRef.current.getModel().pushEditOperations([], [{
            range: selection,
            text: match[1]
          }], null);
        }
      }
    }
  };

  const generateTest = async (code) => {
    const message = `Generate test code for this Arduino function:\n\`\`\`cpp\n${code}\n\`\`\``;
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    await sendChatMessage(message, true);
  };

  // Arduino IDE Functions
  const compileArduinoCode = async () => {
    try {
      setCompilationOutput('Compiling...');
      const response = await fetch(`${BACKEND_URL}/api/arduino/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: arduinoCode, board: 'arduino:avr:mega' }),
      });
      const result = await response.json();
      setCompilationOutput(result.output);
      
      // Show errors in Monaco editor
      if (result.errors && result.errors.length > 0 && editorRef.current) {
        const markers = result.errors.map((error, index) => ({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
          message: error,
          severity: monaco.MarkerSeverity.Error
        }));
        monaco.editor.setModelMarkers(editorRef.current.getModel(), 'compilation', markers);
      } else if (editorRef.current) {
        monaco.editor.setModelMarkers(editorRef.current.getModel(), 'compilation', []);
      }
      
    } catch (error) {
      setCompilationOutput(`Compilation error: ${error.message}`);
    }
  };

  const uploadArduinoCode = async () => {
    try {
      setCompilationOutput('Uploading...');
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
      const response = await fetch(`${BACKEND_URL}/api/arduino/serial/${selectedPort}`);
      const result = await response.json();
      setSerialMonitor(result.data);
    } catch (error) {
      setSerialMonitor(`Serial error: ${error.message}`);
    }
  };

  // Library manager functions
  const searchLibraries = async (query) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/arduino/libraries/search?q=${query}`);
      const data = await response.json();
      setLibraries(data.libraries || []);
    } catch (error) {
      console.error('Error searching libraries:', error);
    }
  };

  const installLibrary = async (libraryName) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/arduino/libraries/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ library: libraryName }),
      });
      const result = await response.json();
      
      if (result.success) {
        // Reload installed libraries
        const libResponse = await fetch(`${BACKEND_URL}/api/arduino/libraries`);
        const libData = await libResponse.json();
        setInstalledLibraries(libData.libraries || []);
      }
      
      alert(result.success ? `Installed ${libraryName}` : `Failed to install ${libraryName}`);
    } catch (error) {
      alert(`Error installing library: ${error.message}`);
    }
  };

  // Enhanced AI Chat with streaming
  const sendChatMessage = async (messageOverride = null, skipUI = false) => {
    const message = messageOverride || chatInput.trim();
    if (!message || isAITyping) return;
    
    const contextData = {
      currentCode: arduinoCode,
      telemetry: telemetry,
      serialOutput: serialMonitor,
      compilationOutput: compilationOutput,
      gamepadConnected: gamepad.connected,
      emergencyStop: emergencyStop,
      recentErrors: compilationOutput.split('\n').filter(line => line.toLowerCase().includes('error'))
    };
    
    if (!skipUI) {
      setChatMessages(prev => [...prev, { role: 'user', content: message }]);
      setChatInput('');
    }
    
    setIsAITyping(true);
    setIsStreaming(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: message,
          context: contextData,
          stream: false
        }),
      });
      
      const data = await response.json();
      
      if (!skipUI) {
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response,
          timestamp: data.timestamp
        }]);
      }
      
      return data.response;
    } catch (error) {
      if (!skipUI) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message}` }]);
      }
      return `Error: ${error.message}`;
    }
    
    setIsAITyping(false);
    setIsStreaming(false);
  };

  // Panel toggle function
  const togglePanel = (panelId) => {
    setPanelStates(prev => ({ ...prev, [panelId]: !prev[panelId] }));
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

  // Enhanced chart data with multiple metrics
  const chartData = {
    labels: telemetryHistory.map((_, i) => i),
    datasets: [
      {
        label: 'FL RPM',
        data: telemetryHistory.map(t => t.wheels?.fl?.rpm || 0),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: false,
        tension: 0.2,
      },
      {
        label: 'FR RPM', 
        data: telemetryHistory.map(t => t.wheels?.fr?.rpm || 0),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: false,
        tension: 0.2,
      },
      {
        label: 'RL RPM',
        data: telemetryHistory.map(t => t.wheels?.rl?.rpm || 0),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        tension: 0.2,
      },
      {
        label: 'RR RPM',
        data: telemetryHistory.map(t => t.wheels?.rr?.rpm || 0),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        tension: 0.2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#ffffff'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return (
          <div className="dashboard-workspace">
            <div className="dashboard-grid">
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
                <div className="chart-container">
                  <Line data={chartData} options={chartOptions} />
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
                  <button 
                    className={`emergency-stop ${emergencyStop ? 'active' : ''}`}
                    onClick={handleEmergencyStop}
                  >
                    {emergencyStop ? 'STOPPED' : 'EMERGENCY STOP'}
                  </button>

                  <div className="control-modes">
                    <div className="control-mode">
                      <span className={`control-indicator ${gamepad.connected ? 'active' : 'inactive'}`}>
                        🎮 Gamepad: {gamepad.connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="control-mode">
                      <span className="control-indicator active">
                        ⌨️ Keyboard: WASD / Arrow Keys
                      </span>
                    </div>
                    <div className="control-mode">
                      <span className="control-indicator active">
                        🖱️ Mouse: Virtual Joystick
                      </span>
                    </div>
                  </div>

                  <div className="joystick-container">
                    <div ref={joystickRef} className="joystick" onMouseDown={handleMouseDown}>
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
                    <button onClick={() => exportData('csv')} disabled={telemetryHistory.length === 0}>
                      Export CSV
                    </button>
                    <button onClick={() => exportData('json')} disabled={telemetryHistory.length === 0}>
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
                  <TelemetryGauge
                    value={telemetry?.battery?.motor?.percentage || 0}
                    min={0}
                    max={100}
                    unit="%"
                    label="Motor Battery"
                    type="battery"
                  />
                  <TelemetryGauge
                    value={telemetry?.battery?.logic?.percentage || 0}
                    min={0}
                    max={100}
                    unit="%"
                    label="Logic Battery"
                    type="battery"
                  />
                  <TelemetryGauge
                    value={telemetry?.temp || 0}
                    min={0}
                    max={100}
                    unit="°C"
                    label="Temperature"
                    type="temperature"
                  />
                  <TelemetryGauge
                    value={telemetry?.latency || 0}
                    min={0}
                    max={200}
                    unit="ms"
                    label="Latency"
                    type="latency"
                  />
                </div>
              </Panel>
            </div>
          </div>
        );

      case 'ide':
        return (
          <div className="ide-workspace">
            <div className="ide-grid">
              {/* Enhanced Code Editor */}
              <Panel 
                title="💻 ARDUINO IDE" 
                className="arduino-panel"
                isMinimized={panelStates.arduino}
                onToggleMinimize={() => togglePanel('arduino')}
              >
                <div className="editor-container">
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
                        <option key={port.device} value={port.device}>
                          {port.device} - {port.description}
                        </option>
                      ))}
                    </select>
                    <button onClick={connectSerialMonitor} className="toolbar-btn serial">
                      📺 Serial Monitor
                    </button>
                    <div className="toolbar-spacer"></div>
                    <div className="ai-hint">
                      💡 Select code + Ctrl+Shift+E to explain, Ctrl+Shift+O to optimize
                    </div>
                  </div>
                  
                  <Editor
                    height="450px"
                    language="arduino"
                    theme="vs-dark"
                    value={arduinoCode}
                    onChange={(value) => setArduinoCode(value)}
                    onMount={(editor) => { editorRef.current = editor; }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      contextmenu: true,
                      selectOnLineNumbers: true,
                      scrollBeyondLastLine: false,
                      folding: true,
                      lineNumbers: 'on',
                      matchBrackets: 'always',
                      autoIndent: 'full'
                    }}
                  />
                </div>
              </Panel>

              {/* Library Manager */}
              <Panel 
                title="📚 LIBRARY MANAGER" 
                className="libraries-panel"
                isMinimized={panelStates.libraries}
                onToggleMinimize={() => togglePanel('libraries')}
              >
                <div className="library-manager">
                  <div className="library-search">
                    <input
                      type="text"
                      placeholder="Search Arduino libraries..."
                      onChange={(e) => searchLibraries(e.target.value)}
                    />
                  </div>
                  <div className="library-sections">
                    <div className="library-section">
                      <h4>Installed Libraries</h4>
                      <div className="library-list">
                        {installedLibraries.map((lib, index) => (
                          <div key={index} className="library-item installed">
                            <span className="library-name">{lib.name}</span>
                            <span className="library-version">v{lib.version}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="library-section">
                      <h4>Available Libraries</h4>
                      <div className="library-list">
                        {libraries.slice(0, 10).map((lib, index) => (
                          <div key={index} className="library-item">
                            <span className="library-name">{lib.name}</span>
                            <span className="library-version">v{lib.latest.version}</span>
                            <button 
                              className="install-btn"
                              onClick={() => installLibrary(lib.name)}
                            >
                              Install
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              {/* Enhanced Serial Monitor */}
              <Panel 
                title="📺 SERIAL MONITOR" 
                className="serial-panel"
                isMinimized={panelStates.serial}
                onToggleMinimize={() => togglePanel('serial')}
              >
                <div className="serial-monitor">
                  <div className="serial-controls">
                    <button onClick={connectSerialMonitor}>Connect</button>
                    <button onClick={() => setSerialMonitor('')}>Clear</button>
                    <span className="serial-status">
                      Port: {selectedPort}
                    </span>
                  </div>
                  <textarea
                    className="serial-output"
                    value={serialMonitor}
                    readOnly
                    placeholder="Serial output with JSON parsing will appear here..."
                  />
                </div>
              </Panel>

              {/* Compilation Output */}
              <Panel 
                title="🔨 COMPILATION OUTPUT" 
                className="compilation-panel"
                isMinimized={panelStates.compilation}
                onToggleMinimize={() => togglePanel('compilation')}
              >
                <div className="compilation-output">
                  <textarea
                    value={compilationOutput}
                    readOnly
                    placeholder="Compilation results will appear here..."
                  />
                </div>
              </Panel>
            </div>
          </div>
        );

      case 'project':
        return (
          <div className="project-workspace">
            <div className="project-grid">
              <Panel 
                title="📋 PROJECT KANBAN" 
                className="kanban-panel"
                isMinimized={panelStates.kanban}
                onToggleMinimize={() => togglePanel('kanban')}
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
              </Panel>

              <Panel 
                title="📦 COMPONENT INVENTORY" 
                className="inventory-panel"
                isMinimized={panelStates.inventory}
                onToggleMinimize={() => togglePanel('inventory')}
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
              </Panel>
            </div>
          </div>
        );

      case 'knowledge':
        return (
          <div className="knowledge-workspace">
            <div className="knowledge-grid">
              <Panel 
                title="📚 KNOWLEDGE BASE" 
                className="knowledge-panel"
                isMinimized={panelStates.knowledge}
                onToggleMinimize={() => togglePanel('knowledge')}
              >
                <div className="knowledge-nav">
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'parts' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('parts')}
                  >
                    🔧 Parts Database
                  </button>
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'docs' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('docs')}
                  >
                    📖 Documentation
                  </button>
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'search' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('search')}
                  >
                    🔍 Search
                  </button>
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'calculators' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('calculators')}
                  >
                    🧮 Calculators
                  </button>
                </div>

                <div className="knowledge-content">
                  {knowledgeModule === 'parts' && (
                    <div className="parts-database">
                      <div className="parts-search">
                        <input
                          type="text"
                          placeholder="Search parts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <div className="parts-categories">
                        {categories.map((category, index) => (
                          <div key={index} className="category-item">
                            {category.name} ({category.count} parts)
                          </div>
                        ))}
                      </div>
                      <div className="parts-list">
                        {parts.map((part, index) => (
                          <div 
                            key={index} 
                            className={`part-item ${selectedPart?.id === part.id ? 'selected' : ''}`}
                            onClick={() => setSelectedPart(part)}
                          >
                            <div className="part-name">{part.name}</div>
                            <div className="part-specs">{part.specifications}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {knowledgeModule === 'docs' && (
                    <div className="documentation">
                      <div className="docs-list">
                        {documents.map((doc, index) => (
                          <div 
                            key={index} 
                            className={`doc-item ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
                            onClick={() => setSelectedDocument(doc)}
                          >
                            <div className="doc-title">{doc.title}</div>
                            <div className="doc-type">{doc.type}</div>
                          </div>
                        ))}
                      </div>
                      {selectedDocument && (
                        <div className="doc-viewer">
                          <h3>{selectedDocument.title}</h3>
                          <div className="doc-content">{selectedDocument.content}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {knowledgeModule === 'search' && (
                    <div className="knowledge-search">
                      <div className="search-input">
                        <input
                          type="text"
                          placeholder="Search knowledge base..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button>Search</button>
                      </div>
                      <div className="search-results">
                        {searchResults.map((result, index) => (
                          <div key={index} className="search-result">
                            <div className="result-title">{result.title}</div>
                            <div className="result-snippet">{result.snippet}</div>
                            <div className="result-type">{result.type}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {knowledgeModule === 'calculators' && (
                    <div className="calculators">
                      <div className="calculator-grid">
                        <div className="calculator-item">
                          <h4>Ohm's Law Calculator</h4>
                          <div className="calc-inputs">
                            <input type="number" placeholder="Voltage (V)" />
                            <input type="number" placeholder="Current (A)" />
                            <input type="number" placeholder="Resistance (Ω)" />
                          </div>
                          <button>Calculate</button>
                        </div>
                        <div className="calculator-item">
                          <h4>Power Calculator</h4>
                          <div className="calc-inputs">
                            <input type="number" placeholder="Voltage (V)" />
                            <input type="number" placeholder="Current (A)" />
                          </div>
                          <button>Calculate</button>
                        </div>
                        <div className="calculator-item">
                          <h4>Battery Life Calculator</h4>
                          <div className="calc-inputs">
                            <input type="number" placeholder="Capacity (mAh)" />
                            <input type="number" placeholder="Load (mA)" />
                          </div>
                          <button>Calculate</button>
                        </div>
                      </div>
                      <div className="calculator-results">
                        {Object.entries(calculatorResults).map(([key, value]) => (
                          <div key={key} className="calc-result">
                            {key}: {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="ai-workspace">
            <Panel 
              title="🤖 AI COMMAND CENTER" 
              className="ai-panel"
              isMinimized={panelStates.ai}
              onToggleMinimize={() => togglePanel('ai')}
            >
              <div className="ai-chat-container">
                <div className="context-panel">
                  <h5>📊 Current Context</h5>
                  <div className="context-items">
                    <div className="context-item">
                      📄 Arduino Code ({arduinoCode.split('\n').length} lines)
                    </div>
                    <div className="context-item">
                      📊 Live Telemetry ({telemetry ? 'Active' : 'Inactive'}) - {emergencyStop ? 'EMERGENCY STOP' : 'Normal'}
                    </div>
                    <div className="context-item">
                      🖥️ Serial Output ({serialMonitor.split('\n').length} lines)
                    </div>
                    <div className="context-item">
                      🎮 Gamepad ({gamepad.connected ? 'Connected' : 'Disconnected'})
                    </div>
                    <div className="context-item">
                      🔧 Compilation ({compilationOutput ? 'Available' : 'None'})
                    </div>
                  </div>
                </div>
                
                <div className="ai-features">
                  <h5>🚀 Code Actions (Select code in editor)</h5>
                  <div className="ai-shortcuts">
                    <kbd>Ctrl+Shift+E</kbd> Explain Code
                    <kbd>Ctrl+Shift+O</kbd> Optimize Code
                    <kbd>Ctrl+Shift+T</kbd> Generate Test
                  </div>
                </div>
                
                <div className="chat-messages">
                  {chatMessages.length === 0 && (
                    <div className="welcome-message">
                      🤖 <strong>Enhanced AI Development Assistant Ready!</strong>
                      <br/><br/>
                      I have full context of your rover project including:
                      <br/>• Current Arduino code with syntax awareness
                      <br/>• Real-time telemetry data and system status
                      <br/>• Serial monitor output with JSON parsing
                      <br/>• Compilation errors and warnings
                      <br/>• Hardware configuration and pin mappings
                      <br/>• Gamepad connection status
                      <br/>• Emergency stop and safety systems
                      <br/><br/>
                      💡 <strong>Try these commands:</strong>
                      <br/>• "Analyze the current wheel RPM imbalance"
                      <br/>• "Optimize the motor control algorithm"
                      <br/>• "Debug the emergency stop system"
                      <br/>• "Generate PID tuning code"
                      <br/><br/>
                      Or select code in the editor and use keyboard shortcuts for instant AI assistance!
                    </div>
                  )}
                  
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`chat-message ${message.role}`}>
                      <div className="message-content">
                        {message.content}
                      </div>
                      {message.timestamp && (
                        <div className="message-timestamp">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isAITyping && (
                    <div className="chat-message assistant typing">
                      <div className="typing-dots">
                        <span></span><span></span><span></span>
                      </div>
                      {isStreaming && <span className="streaming-indicator">Streaming...</span>}
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
                    disabled={isAITyping}
                  />
                  <button 
                    onClick={() => sendChatMessage()} 
                    disabled={!chatInput.trim() || isAITyping}
                    className="chat-send"
                  >
                    {isAITyping ? 'Thinking...' : 'Send'}
                  </button>
                </div>
              </div>
            </Panel>
          </div>
        );

      default:
        return <div>Select a module from the sidebar</div>;
    }
  };

  return (
    <div className="app">
      {/* Enhanced Header */}
      <header className="main-header">
        <div className="header-left">
          <h1 className="app-title">🚀 ROVER DEVELOPMENT PLATFORM v2.0</h1>
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
            <div className="stat">
              <span className="stat-label">Latency:</span>
              <span className={`stat-value ${telemetry?.latency > 100 ? 'warning' : ''}`}>
                {telemetry?.latency?.toFixed(0) || '0'}ms
              </span>
            </div>
            {gamepad.connected && (
              <div className="stat gamepad-stat">
                <span className="stat-label">🎮 Gamepad:</span>
                <span className="stat-value">Ready</span>
              </div>
            )}
          </div>
          {emergencyStop && (
            <button className="resume-btn" onClick={() => fetch(`${BACKEND_URL}/api/rover/resume`, {method: 'POST'})}>
              RESUME ROVER
            </button>
          )}
        </div>
      </header>

      <div className="main-layout">
        {/* Enhanced Sidebar Navigation */}
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
              <div className="system-alerts">
                {telemetry?.alerts?.slice(-3).map((alert, index) => (
                  <div key={index} className={`mini-alert alert-${alert.level}`}>
                    {alert.message}
                  </div>
                ))}
              </div>
              <div className="mini-stat">
                <span>Motor:</span>
                <span className={`battery-level ${(telemetry?.battery?.motor?.percentage || 0) < 30 ? 'low' : ''}`}>
                  {telemetry?.battery?.motor?.percentage?.toFixed(0) || '0'}%
                </span>
              </div>
              <div className="mini-stat">
                <span>Logic:</span>
                <span className={`battery-level ${(telemetry?.battery?.logic?.percentage || 0) < 30 ? 'low' : ''}`}>
                  {telemetry?.battery?.logic?.percentage?.toFixed(0) || '0'}%
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