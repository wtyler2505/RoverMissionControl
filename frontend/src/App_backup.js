import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
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
import './accessibility-enhancements.css';
import logger, { useLogger, setupAxiosLogging } from './utils/logger';
import { accessibility } from './utils/accessibility';
import ErrorBoundary from './components/ErrorBoundary';
import { FocusManagementProvider } from './contexts/FocusManagementContext';
import { D3Demo } from './components/D3Test';
import FocusableJoystick from './components/ui/FocusableJoystick';
import FocusableGauge from './components/ui/FocusableGauge';
import FocusableEmergencyControls from './components/ui/FocusableEmergencyControls';

// Lazy-loaded modules for code splitting
import { 
  Dashboard, 
  IDE, 
  Project, 
  Knowledge, 
  AIAssistant, 
  D3Demo 
} from './components/modules';

// Loading skeletons
import {
  DashboardSkeleton,
  IDESkeleton,
  AIAssistantSkeleton,
  ProjectSkeleton,
  KnowledgeSkeleton,
  GenericSkeleton
} from './components/loading';

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

// Enhanced Telemetry Gauge Component with comprehensive ARIA support
function TelemetryGauge({ value, min, max, unit, label, type = "normal" }) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const angle = (percentage / 100) * 180 - 90;
  
  let colorClass = "gauge-normal";
  let statusText = "normal";
  
  if (type === "battery") {
    if (percentage > 60) {
      colorClass = "gauge-good";
      statusText = "good";
    } else if (percentage > 30) {
      colorClass = "gauge-warning";
      statusText = "low";
    } else {
      colorClass = "gauge-critical";
      statusText = "critical";
    }
  } else if (type === "temperature") {
    if (percentage < 70) {
      colorClass = "gauge-good";
      statusText = "normal";
    } else if (percentage < 85) {
      colorClass = "gauge-warning";
      statusText = "elevated";
    } else {
      colorClass = "gauge-critical";
      statusText = "overheating";
    }
  } else if (type === "latency") {
    if (percentage < 50) {
      colorClass = "gauge-good";
      statusText = "excellent";
    } else if (percentage < 75) {
      colorClass = "gauge-warning";
      statusText = "moderate";
    } else {
      colorClass = "gauge-critical";
      statusText = "high";
    }
  }

  // Generate comprehensive description for screen readers
  const gaugeId = `gauge-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const descriptionId = `${gaugeId}-description`;
  
  useEffect(() => {
    // Update dynamic description for screen readers
    const description = accessibility.generateControlLabel(
      `${label} gauge`, 
      { value, min, max, status: statusText },
      { unit, precision: 1 }
    ) + `. Reading indicates ${statusText} levels.`;
    
    accessibility.setDescription(gaugeId, description);
    
    return () => {
      accessibility.removeDescription(gaugeId);
    };
  }, [value, min, max, unit, label, statusText, gaugeId]);
  
  return (
    <div 
      className={`telemetry-gauge ${colorClass}`}
      role="meter"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${accessibility.formatValue(value, unit)} out of ${accessibility.formatValue(max, unit)} - ${statusText} level`}
      aria-label={`${label} gauge`}
      aria-describedby={descriptionId}
      tabIndex={0}
    >
      <div className="gauge-label" id={`gauge-label-${gaugeId}`}>
        {label}
        <span className="sr-only"> - {statusText} level</span>
      </div>
      <div className="gauge-container">
        <svg 
          viewBox="0 0 100 60" 
          className="gauge-svg"
          aria-hidden="true"
          role="img"
          aria-labelledby={`gauge-label-${gaugeId}`}
        >
          <title>{`${label} gauge showing ${accessibility.formatValue(value, unit)} - ${statusText}`}</title>
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
        <div className="gauge-value" aria-hidden="true">
          {typeof value === 'number' ? value.toFixed(1) : value}
          <span className="gauge-unit">{unit}</span>
        </div>
      </div>
      
      {/* Status indicator for screen readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {label} status: {statusText}
      </div>
    </div>
  );
}

// Semantic Panel Component - Uses proper HTML5 sectioning
function Panel({ title, children, className = "", isMinimized = false, onToggleMinimize }) {
  return (
    /* 
      Using section element for each panel as they represent distinct 
      content sections with their own headings
    */
    <section className={`panel ${className} ${isMinimized ? 'minimized' : ''}`} aria-labelledby={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <header className="panel-header">
        <h3 className="panel-title" id={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>{title}</h3>
        <div className="panel-controls">
          <button 
            className="panel-btn minimize" 
            onClick={onToggleMinimize}
            title={isMinimized ? "Maximize" : "Minimize"}
            aria-label={`${isMinimized ? "Maximize" : "Minimize"} ${title} panel`}
            aria-expanded={!isMinimized}
          >
            {isMinimized ? '+' : '−'}
          </button>
        </div>
      </header>
      {!isMinimized && (
        <div className="panel-body" role="region" aria-labelledby={`panel-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {children}
        </div>
      )}
    </section>
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
  const logger = useLogger();
  
  // Initialize logging
  useEffect(() => {
    logger.info('Rover Development Platform initialized', {
      version: '2.0',
      environment: process.env.NODE_ENV
    });
    
    // Log performance metrics
    if (window.performance && window.performance.timing) {
      const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
      logger.logPerformance('page_load', { load_time_ms: loadTime });
    }
  }, []);
  
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
    knowledge: false,
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

  // Initialize knowledge base data
  useEffect(() => {
    loadKnowledgeData();
  }, []);

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
      logger.info('WebSocket connected', { url: wsUrl });
      logger.logWebSocketEvent('connected', { url: wsUrl });
      
      // Announce connection status to screen readers
      accessibility.announceStatus('Mission control connection established');
      
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
      
      // Log telemetry data
      logger.logTelemetry(data.type || 'general', data);
      
      setTelemetry(data);
      setEmergencyStop(data.emergency_stop || false);
      
      // Announce telemetry updates to screen readers
      accessibility.announceTelemetry(data);
      
      // Log emergency stop events
      if (data.emergency_stop) {
        logger.warn('Emergency stop activated', { telemetry: data });
      }
      
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
    
    websocket.current.onclose = (event) => {
      setIsConnected(false);
      logger.warn('WebSocket disconnected', { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean 
      });
      logger.logWebSocketEvent('disconnected', { code: event.code });
      
      // Announce disconnection to screen readers
      accessibility.announceAssertive('Mission control connection lost - attempting to reconnect');
      
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      setTimeout(connectWebSocket, 3000);
    };
    
    websocket.current.onerror = (error) => {
      logger.error('WebSocket error', { error: error.toString() });
      logger.logWebSocketEvent('error', { error: error.toString() });
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
    logger.logUserAction('emergency_stop', { source: 'button' });
    
    // Immediate announcement for screen readers
    accessibility.announceAlert('Emergency stop activated - all rover movement halted immediately');
    
    try {
      const startTime = performance.now();
      await fetch(`${BACKEND_URL}/api/rover/emergency-stop`, { method: 'POST' });
      const duration = performance.now() - startTime;
      
      logger.info('Emergency stop executed', { duration_ms: duration });
      setControlInput({ forward: 0, turn: 0, speed: 0 });
      
      // Success confirmation
      accessibility.announceStatus('Emergency stop command sent successfully');
    } catch (error) {
      logger.error('Emergency stop error', { error: error.message });
      
      // Error announcement
      accessibility.announceAlert('Emergency stop command failed - check connection and try again');
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

  // Joystick keyboard controls for accessibility
  const handleJoystickKeyDown = (e) => {
    if (emergencyStop) return;
    
    const increment = 0.1; // 10% increment for precise control
    let newForward = controlInput.forward;
    let newTurn = controlInput.turn;
    let changed = false;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        e.stopPropagation();
        newForward = Math.min(1, controlInput.forward + increment);
        changed = true;
        break;
        
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        e.stopPropagation();
        newForward = Math.max(-1, controlInput.forward - increment);
        changed = true;
        break;
        
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        e.stopPropagation();
        newTurn = Math.max(-1, controlInput.turn - increment);
        changed = true;
        break;
        
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        e.stopPropagation();
        newTurn = Math.min(1, controlInput.turn + increment);
        changed = true;
        break;
        
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        // Center the joystick
        newForward = 0;
        newTurn = 0;
        changed = true;
        break;
        
      default:
        // Allow other keys to propagate
        return;
    }
    
    if (changed) {
      setControlInput(prev => ({ ...prev, forward: newForward, turn: newTurn }));
      sendControlCommand(newForward, newTurn, controlInput.speed);
      
      // Announce changes to screen readers
      const forwardPercent = Math.round(newForward * 100);
      const turnPercent = Math.round(newTurn * 100);
      const announcement = `Joystick control: Forward ${forwardPercent}%, Turn ${turnPercent}%`;
      announceToScreenReader(announcement);
      
      // Log keyboard control for accessibility analytics
      logger.logUserAction('joystick_keyboard_control', {
        source: 'keyboard',
        key: e.key,
        forward: newForward,
        turn: newTurn,
        increment
      });
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [emergencyStop, controlInput.speed]);

  // Enhanced keyboard controls with global emergency stop and module navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Global emergency stop - works even when rover is stopped
      if (e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleEmergencyStop();
        
        // Provide immediate visual feedback
        const emergencyBtn = document.querySelector('.emergency-stop');
        if (emergencyBtn) {
          emergencyBtn.classList.add('keyboard-activated');
          setTimeout(() => emergencyBtn.classList.remove('keyboard-activated'), 200);
        }
        
        // Log the keyboard activation for accessibility analytics
        logger.logUserAction('emergency_stop', { source: 'keyboard', key: e.key });
        return;
      }
      
      // Module navigation shortcuts (Alt+1-5)
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const moduleMap = {
          '1': 'dashboard',
          '2': 'ide', 
          '3': 'ai',
          '4': 'project',
          '5': 'knowledge'
        };
        
        if (moduleMap[e.key]) {
          e.preventDefault();
          e.stopPropagation();
          setActiveModule(moduleMap[e.key]);
          
          // Announce module change for screen readers
          const announcement = `Switched to ${moduleMap[e.key]} module`;
          announceToScreenReader(announcement);
          
          // Log module navigation for accessibility analytics
          logger.logUserAction('module_navigation', { 
            source: 'keyboard', 
            from: activeModule, 
            to: moduleMap[e.key],
            shortcut: `Alt+${e.key}`
          });
          return;
        }
      }
      
      // Show keyboard help (? key)
      if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        showKeyboardHelp();
        return;
      }
      
      // Don't process movement controls if emergency stop is active
      if (emergencyStop) return;
      
      // Skip if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
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
        default:
          return;
      }
      
      e.preventDefault();
      setControlInput(prev => ({ ...prev, forward, turn }));
      sendControlCommand(forward, turn, controlInput.speed);
    };

    const handleKeyUp = (e) => {
      // Skip if user is typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        setControlInput(prev => ({ ...prev, forward: 0, turn: 0 }));
        sendControlCommand(0, 0, controlInput.speed);
      }
    };

    // Use capture phase to ensure we get the event first for emergency stop
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
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
      accessibility.announceStatus('Starting Arduino code compilation');
      
      const response = await fetch(`${BACKEND_URL}/api/arduino/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: arduinoCode, board: 'arduino:avr:mega' }),
      });
      const result = await response.json();
      setCompilationOutput(result.output);
      
      // Show errors in Monaco editor and announce results
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
        
        // Announce compilation errors
        accessibility.announceAssertive(`Compilation failed with ${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`);
      } else if (editorRef.current) {
        monaco.editor.setModelMarkers(editorRef.current.getModel(), 'compilation', []);
        
        // Announce successful compilation
        accessibility.announceStatus('Code compiled successfully - no errors found');
      }
      
    } catch (error) {
      setCompilationOutput(`Compilation error: ${error.message}`);
      accessibility.announceAlert(`Compilation system error: ${error.message}`);
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

  // Knowledge Base functions
  const loadKnowledgeData = async () => {
    try {
      // Load parts
      const partsResponse = await fetch(`${BACKEND_URL}/api/knowledge/parts`);
      const partsData = await partsResponse.json();
      setParts(partsData.parts || []);

      // Load categories
      const categoriesResponse = await fetch(`${BACKEND_URL}/api/knowledge/categories`);
      const categoriesData = await categoriesResponse.json();
      setCategories(categoriesData.categories || []);

      // Load documents
      const docsResponse = await fetch(`${BACKEND_URL}/api/knowledge/documents`);
      const docsData = await docsResponse.json();
      setDocuments(docsData.documents || []);
    } catch (error) {
      console.error('Error loading knowledge base data:', error);
    }
  };

  const searchKnowledgeBase = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching knowledge base:', error);
    }
  };

  const calculateOhmsLaw = async (values) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/knowledge/calculators/ohms-law`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      setCalculatorResults(prev => ({ ...prev, ohmsLaw: result }));
    } catch (error) {
      console.error('Error calculating Ohm\'s law:', error);
    }
  };

  const calculateVoltageDivider = async (values) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/knowledge/calculators/voltage-divider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      setCalculatorResults(prev => ({ ...prev, voltageDivider: result }));
    } catch (error) {
      console.error('Error calculating voltage divider:', error);
    }
  };

  const calculateBatteryLife = async (values) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/knowledge/calculators/battery-capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      setCalculatorResults(prev => ({ ...prev, batteryLife: result }));
    } catch (error) {
      console.error('Error calculating battery life:', error);
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

  // Screen reader announcement function
  const announceToScreenReader = (message) => {
    // Create or update the announcement element
    let announcer = document.getElementById('keyboard-announcer');
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'keyboard-announcer';
      announcer.className = 'sr-only';
      announcer.setAttribute('role', 'status');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    
    // Clear and set new message
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 100);
  };

  // Keyboard help system
  const showKeyboardHelp = () => {
    const helpContent = `
      Rover Mission Control - Keyboard Shortcuts:
      
      NAVIGATION:
      • Alt+1: Dashboard Module
      • Alt+2: Arduino IDE Module  
      • Alt+3: AI Assistant Module
      • Alt+4: Project Management Module
      • Alt+5: Knowledge Base Module
      • Tab: Navigate between interactive elements
      • Shift+Tab: Navigate backwards
      
      SKIP LINKS (press Tab on page load):
      • Skip to main content
      • Skip to navigation
      • Skip to rover controls
      • Skip to emergency controls
      
      ROVER CONTROL:
      • W or ↑: Move forward
      • S or ↓: Move backward
      • A or ←: Turn left
      • D or →: Turn right
      • Space or Escape: Emergency stop
      
      JOYSTICK CONTROL (when focused):
      • Arrow keys / WASD: Adjust direction (10% increments)
      • Enter or Space: Center joystick
      
      SPEED CONTROL (when focused):
      • ↑ or →: Increase speed (10%)
      • ↓ or ←: Decrease speed (10%)
      • Page Up: Increase speed (20%)
      • Page Down: Decrease speed (20%)
      • Home: Set minimum speed (0%)
      • End: Set maximum speed (100%)
      
      AI ASSISTANT:
      • Ctrl+Shift+E: Explain selected code
      • Ctrl+Shift+O: Optimize selected code
      • Ctrl+Shift+T: Generate test for selected code
      
      GENERAL:
      • ?: Show this help
      • Escape: Close dialogs/help
    `;
    
    // Create modal for keyboard help
    const modal = document.createElement('div');
    modal.className = 'keyboard-help-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'keyboard-help-title');
    modal.setAttribute('aria-modal', 'true');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
      background: var(--bg-panel);
      border: 2px solid var(--accent-blue);
      border-radius: 12px;
      padding: 2rem;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      color: var(--text-primary);
      box-shadow: var(--shadow-large);
    `;
    
    const title = document.createElement('h2');
    title.id = 'keyboard-help-title';
    title.textContent = 'Keyboard Shortcuts';
    title.style.cssText = `
      color: var(--accent-blue);
      margin-bottom: 1rem;
      font-size: 1.5rem;
    `;
    
    const helpText = document.createElement('pre');
    helpText.textContent = helpContent.trim();
    helpText.style.cssText = `
      font-family: inherit;
      white-space: pre-wrap;
      line-height: 1.6;
      margin-bottom: 1rem;
    `;
    
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close (Escape)';
    closeButton.style.cssText = `
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      font-size: 1rem;
    `;
    
    const closeModal = () => {
      modal.remove();
      document.removeEventListener('keydown', handleHelpKeydown);
    };
    
    const handleHelpKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };
    
    closeButton.addEventListener('click', closeModal);
    document.addEventListener('keydown', handleHelpKeydown);
    
    content.appendChild(title);
    content.appendChild(helpText);
    content.appendChild(closeButton);
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Focus the close button for keyboard accessibility
    closeButton.focus();
    
    // Announce help opened
    announceToScreenReader('Keyboard shortcuts help opened. Press Escape to close.');
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
      },
      // Enhanced accessibility plugin configuration
      accessibility: {
        enabled: true,
        description: () => accessibility.describeChart(chartData, 'line'),
        announceNewData: true
      }
    },
    scales: {
      x: {
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: {
          display: true,
          text: 'Time (seconds)',
          color: '#ffffff'
        }
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#ffffff' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        title: {
          display: true,
          text: 'RPM (Revolutions per minute)',
          color: '#ffffff'
        }
      }
    },
    // Accessibility configuration for Chart.js
    accessibility: {
      enabled: true,
      description: 'Real-time telemetry chart showing wheel RPM data for all four rover wheels over time'
    }
  };

  const renderModule = () => {
    // Get the appropriate props for each module
    const getModuleProps = () => {
      switch (activeModule) {
        case 'dashboard':
          return {
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
          };
        
        case 'ide':
          return {
            arduinoCode,
            setArduinoCode,
            editorRef,
            compileArduinoCode,
            uploadArduinoCode,
            connectSerialMonitor,
            selectedPort,
            setSelectedPort,
            availablePorts,
            libraries,
            installedLibraries,
            searchLibraries,
            installLibrary,
            serialMonitor,
            setSerialMonitor,
            compilationOutput,
            panelStates,
            togglePanel
          };
        
        case 'ai':
          return {
            arduinoCode,
            telemetry,
            emergencyStop,
            serialMonitor,
            gamepad,
            compilationOutput,
            chatMessages,
            isAITyping,
            isStreaming,
            chatInput,
            setChatInput,
            sendChatMessage,
            panelStates,
            togglePanel
          };
        
        case 'project':
          return {
            projectTasks,
            panelStates,
            togglePanel
          };
        
        case 'knowledge':
          return {
            knowledgeModule,
            setKnowledgeModule,
            searchQuery,
            setSearchQuery,
            categories,
            parts,
            selectedPart,
            setSelectedPart,
            documents,
            selectedDocument,
            setSelectedDocument,
            searchResults,
            calculatorResults,
            panelStates,
            togglePanel
          };
        
        default:
          return {};
      }
    };

    switch (activeModule) {
      case 'd3demo':
        return (
          <Suspense fallback={<GenericSkeleton title="Loading D3 Demo..." />}>
            <D3Demo />
          </Suspense>
        );
        
      case 'dashboard':
        return (
          <Suspense fallback={<DashboardSkeleton />}>
            <Dashboard {...getModuleProps()} />
          </Suspense>
        );
      
      case 'ide':
        return (
          <Suspense fallback={<IDESkeleton />}>
            <IDE {...getModuleProps()} />
          </Suspense>
        );
        
      case 'ai':
        return (
          <Suspense fallback={<AIAssistantSkeleton />}>
            <AIAssistant {...getModuleProps()} />
          </Suspense>
        );
        
      case 'project':
        return (
          <Suspense fallback={<ProjectSkeleton />}>
            <Project {...getModuleProps()} />
          </Suspense>
        );
        
      case 'knowledge':
        return (
          <Suspense fallback={<KnowledgeSkeleton />}>
            <Knowledge {...getModuleProps()} />
          </Suspense>
        );

      default:
        return (
          <article className="welcome-workspace" aria-labelledby="welcome-heading">
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
                            newSpeed = 0;
                            handled = true;
                            break;
                          case 'End':
                            e.preventDefault();
                            newSpeed = 1;
                            handled = true;
                            break;
                        }
                        
                        if (handled) {
                          setControlInput(prev => ({ ...prev, speed: newSpeed }));
                          
                          // Announce speed changes to screen readers
                          const announcement = `Speed adjusted to ${Math.round(newSpeed * 100)} percent`;
                          announceToScreenReader(announcement);
                          
                          // Log keyboard speed control
                          logger.logUserAction('speed_control', {
                            source: 'keyboard',
                            key: e.key,
                            speed: newSpeed,
                            percentage: Math.round(newSpeed * 100)
                          });
                        }
                      }}
                      disabled={emergencyStop}
                      aria-label={`Rover speed control - currently ${Math.round(controlInput.speed * 100)} percent`}
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

      case 'ide':
        return (
          /* 
            IDE Module - Arduino development environment
            Uses article element for self-contained development workspace
          */
          <article className="ide-workspace" aria-labelledby="ide-heading">
            <header className="module-header">
              <h2 id="ide-heading" className="sr-only">Arduino IDE</h2>
            </header>
            <div className="ide-grid" role="region" aria-label="IDE panels">
              {/* Enhanced Code Editor */}
              <Panel 
                title="💻 ARDUINO IDE" 
                className="arduino-panel"
                isMinimized={panelStates.arduino}
                onToggleMinimize={() => togglePanel('arduino')}
              >
                <div className="editor-container">
                  <div className="editor-toolbar">
                    <button 
                      onClick={compileArduinoCode} 
                      className="toolbar-btn compile"
                      aria-label="Compile Arduino code - check for syntax errors and build"
                    >
                      🔨 Compile
                    </button>
                    <button 
                      onClick={uploadArduinoCode} 
                      className="toolbar-btn upload"
                      aria-label="Upload compiled code to Arduino board"
                    >
                      📤 Upload
                    </button>
                    <select 
                      value={selectedPort} 
                      onChange={(e) => setSelectedPort(e.target.value)}
                      className="port-select"
                      aria-label={`Select Arduino communication port - currently ${selectedPort || 'none selected'}`}
                    >
                      {availablePorts.map(port => (
                        <option key={port.device} value={port.device}>
                          {port.device} - {port.description}
                        </option>
                      ))}
                    </select>
                    <button 
                      onClick={connectSerialMonitor} 
                      className="toolbar-btn serial"
                      aria-label="Open serial monitor to view Arduino output and communication"
                    >
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
                              aria-label={`Install ${lib.name} library version ${lib.latest.version}`}
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
          </article>
        );

      case 'project':
        return (
          /* 
            Project Module - Project management and tracking
            Uses article element for self-contained project workspace
          */
          <article className="project-workspace" aria-labelledby="project-heading">
            <header className="module-header">
              <h2 id="project-heading" className="sr-only">Project Management</h2>
            </header>
            <div className="project-grid" role="region" aria-label="Project management panels">
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
          </article>
        );

      case 'knowledge':
        return (
          /* 
            Knowledge Module - Documentation and parts database
            Uses article element for self-contained knowledge workspace
          */
          <article className="knowledge-workspace" aria-labelledby="knowledge-heading">
            <header className="module-header">
              <h2 id="knowledge-heading" className="sr-only">Knowledge Base</h2>
            </header>
            <div className="knowledge-grid" role="region" aria-label="Knowledge base panels">
              <Panel 
                title="📚 KNOWLEDGE BASE" 
                className="knowledge-panel"
                isMinimized={panelStates.knowledge}
                onToggleMinimize={() => togglePanel('knowledge')}
              >
                {/* 
                  Knowledge Base Navigation - Uses nav element for tab navigation
                  Uses role="tablist" for proper accessibility semantics
                */}
                <nav className="knowledge-nav" role="tablist" aria-label="Knowledge base sections">
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'parts' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('parts')}
                    role="tab"
                    aria-selected={knowledgeModule === 'parts'}
                    aria-controls="knowledge-content"
                  >
                    🔧 Parts Database
                  </button>
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'docs' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('docs')}
                    role="tab"
                    aria-selected={knowledgeModule === 'docs'}
                    aria-controls="knowledge-content"
                  >
                    📖 Documentation
                  </button>
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'search' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('search')}
                    role="tab"
                    aria-selected={knowledgeModule === 'search'}
                    aria-controls="knowledge-content"
                  >
                    🔍 Search
                  </button>
                  <button 
                    className={`knowledge-tab ${knowledgeModule === 'calculators' ? 'active' : ''}`}
                    onClick={() => setKnowledgeModule('calculators')}
                    role="tab"
                    aria-selected={knowledgeModule === 'calculators'}
                    aria-controls="knowledge-content"
                  >
                    🧮 Calculators
                  </button>
                </nav>

                <div className="knowledge-content" id="knowledge-content" role="tabpanel" aria-labelledby={`knowledge-tab-${knowledgeModule}`}>
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
                            <div className="part-specs">
                              {part.specifications && typeof part.specifications === 'object' 
                                ? Object.entries(part.specifications).map(([key, value]) => (
                                    <span key={key} className="part-spec">
                                      {key}: {value}
                                    </span>
                                  ))
                                : part.specifications}
                            </div>
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
          </article>
        );

      case 'ai':
        return (
          /* 
            AI Module - AI assistant and command center
            Uses article element for self-contained AI workspace
          */
          <article className="ai-workspace" aria-labelledby="ai-heading">
            <header className="module-header">
              <h2 id="ai-heading" className="sr-only">AI Assistant</h2>
            </header>
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
          </article>
        );

      default:
        return (
          <article className="welcome-workspace" aria-labelledby="welcome-heading">
            <header className="module-header">
              <h2 id="welcome-heading">Welcome</h2>
            </header>
            <section className="welcome-content">
              <p>Select a module from the sidebar to get started.</p>
            </section>
          </article>
        );
    }
  };

  return (
    <FocusManagementProvider
      options={{
        enabled: true,
        defaultTrapOptions: {
          initialFocus: 'first-focusable',
          restoreFocus: true,
          allowOutsideClick: false,
        },
        routerFocusOptions: {
          announceRouteChanges: true,
          focusTarget: 'main-content',
        },
        dynamicFocusOptions: {
          announceChanges: true,
          throttleDelay: 100,
        },
      }}
    >
      <ErrorBoundary>
        {/* 
          Semantic HTML5 Structure:
          - <div> with app class maintains styling compatibility
          - Proper heading hierarchy established with h1 as main title
          - header/nav/main structure provides clear document outline
          - ARIA landmarks implicit in semantic elements
        */}
        <div className="app">
        {/* Skip Links for keyboard navigation accessibility */}
        <div className="skip-links" aria-label="Skip navigation">
          <a 
            href="#main-content" 
            className="skip-link"
            onFocus={(e) => e.target.classList.add('focused')}
            onBlur={(e) => e.target.classList.remove('focused')}
          >
            Skip to main content
          </a>
          <a 
            href="#navigation" 
            className="skip-link"
            onFocus={(e) => e.target.classList.add('focused')}
            onBlur={(e) => e.target.classList.remove('focused')}
          >
            Skip to navigation
          </a>
          <a 
            href="#rover-controls" 
            className="skip-link"
            onFocus={(e) => e.target.classList.add('focused')}
            onBlur={(e) => e.target.classList.remove('focused')}
          >
            Skip to rover controls
          </a>
          <a 
            href="#emergency-controls" 
            className="skip-link"
            onFocus={(e) => e.target.classList.add('focused')}
            onBlur={(e) => e.target.classList.remove('focused')}
          >
            Skip to emergency controls
          </a>
        </div>
        
        {/* 
          Application Header - Contains main title, system status, and controls
          Uses h1 for main application title (only one per page)
        */}
        <header className="main-header" role="banner">
          <div className="header-left">
            <h1 className="app-title">🚀 ROVER DEVELOPMENT PLATFORM v2.0</h1>
            <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`} role="status" aria-live="polite">
              <span className="status-dot" aria-hidden="true"></span>
              {isConnected ? 'MISSION CONTROL ONLINE' : 'OFFLINE'}
            </div>
          </div>
          <aside className="header-right" aria-label="System status and controls">
            {/* System metrics displayed as a data list for semantic meaning */}
            <dl className="header-stats" aria-label="System metrics">
              <div className="stat">
                <dt className="stat-label">Uptime:</dt>
                <dd className="stat-value">{telemetry?.uptime ? Math.floor(telemetry.uptime / 1000) : 0}s</dd>
              </div>
              <div className="stat">
                <dt className="stat-label">Temp:</dt>
                <dd className={`stat-value ${telemetry?.temp > 70 ? 'warning' : ''}`}>
                  {telemetry?.temp?.toFixed(1) || '0.0'}°C
                </dd>
              </div>
              <div className="stat">
                <dt className="stat-label">Latency:</dt>
                <dd className={`stat-value ${telemetry?.latency > 100 ? 'warning' : ''}`}>
                  {telemetry?.latency?.toFixed(0) || '0'}ms
                </dd>
              </div>
              {gamepad.connected && (
                <div className="stat gamepad-stat">
                  <dt className="stat-label">🎮 Gamepad:</dt>
                  <dd className="stat-value">Ready</dd>
                </div>
              )}
            </dl>
            {emergencyStop && (
              <button 
                className="resume-btn" 
                onClick={() => fetch(`${BACKEND_URL}/api/rover/resume`, {method: 'POST'})}
                aria-label="Resume rover operations"
              >
                RESUME ROVER
              </button>
            )}
          </aside>
        </header>

        {/* Main application layout container */}
        <div className="main-layout">
          {/* 
            Primary Navigation - Main application navigation
            Uses semantic nav element with proper heading hierarchy
            Organized into logical sections with h2 headings
          */}
          <nav id="navigation" className="sidebar" role="navigation" aria-label="Main navigation">
            <section className="nav-section">
              <h2>MISSION CONTROL</h2>
              <ul role="list">
                <li>
                  <button 
                    className={`nav-btn ${activeModule === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveModule('dashboard')}
                    aria-current={activeModule === 'dashboard' ? 'page' : undefined}
                  >
                    📊 Operations Dashboard
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeModule === 'ide' ? 'active' : ''}`}
                    onClick={() => setActiveModule('ide')}
                    aria-current={activeModule === 'ide' ? 'page' : undefined}
                  >
                    💻 Arduino IDE
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeModule === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveModule('ai')}
                    aria-current={activeModule === 'ai' ? 'page' : undefined}
                  >
                    🤖 AI Assistant
                  </button>
                </li>
              </ul>
            </section>

            <section className="nav-section">
              <h2>PROJECT TOOLS</h2>
              <ul role="list">
                <li>
                  <button 
                    className={`nav-btn ${activeModule === 'project' ? 'active' : ''}`}
                    onClick={() => setActiveModule('project')}
                    aria-current={activeModule === 'project' ? 'page' : undefined}
                  >
                    📋 Project Management
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeModule === 'knowledge' ? 'active' : ''}`}
                    onClick={() => setActiveModule('knowledge')}
                    aria-current={activeModule === 'knowledge' ? 'page' : undefined}
                  >
                    📚 Knowledge Base
                  </button>
                </li>
                <li>
                  <button className="nav-btn">
                    🧪 Testing Suite
                  </button>
                </li>
              </ul>
            </section>

            <section className="nav-section">
              <h2>SYSTEM</h2>
              <ul role="list">
                <li>
                  <button className="nav-btn">
                    📈 Analytics
                  </button>
                </li>
                <li>
                  <button className="nav-btn">
                    📖 Documentation
                  </button>
                </li>
                <li>
                  <button className="nav-btn">
                    🔧 Communication Hub
                  </button>
                </li>
                <li>
                  <button 
                    className={`nav-btn ${activeModule === 'd3demo' ? 'active' : ''}`}
                    onClick={() => setActiveModule('d3demo')}
                    aria-current={activeModule === 'd3demo' ? 'page' : undefined}
                  >
                    📊 D3.js Demo
                  </button>
                </li>
              </ul>
            </section>

            {/* 
              Footer section in sidebar - Contains system status summary
              Uses aside for supplementary content
            */}
            <aside className="sidebar-footer" aria-label="System status summary">
              <section className="rover-status-mini">
                <h3 className="sr-only">System Alerts</h3>
                <div className="system-alerts" role="log" aria-live="polite">
                  {telemetry?.alerts?.slice(-3).map((alert, index) => (
                    <div key={index} className={`mini-alert alert-${alert.level}`} role="alert">
                      {alert.message}
                    </div>
                  ))}
                </div>
                <dl className="system-status" aria-label="Battery status">
                  <div className="mini-stat">
                    <dt>Motor:</dt>
                    <dd className={`battery-level ${(telemetry?.battery?.motor?.percentage || 0) < 30 ? 'low' : ''}`}>
                      {telemetry?.battery?.motor?.percentage?.toFixed(0) || '0'}%
                    </dd>
                  </div>
                  <div className="mini-stat">
                    <dt>Logic:</dt>
                    <dd className={`battery-level ${(telemetry?.battery?.logic?.percentage || 0) < 30 ? 'low' : ''}`}>
                      {telemetry?.battery?.logic?.percentage?.toFixed(0) || '0'}%
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </nav>

          {/* 
            Main Content Area - Contains the active module content
            This is the primary content of the page
          */}
          <main id="main-content" className="workspace" role="main" aria-label="Application workspace">
            {renderModule()}
          </main>
        </div>
      </div>
    </ErrorBoundary>
    </FocusManagementProvider>
  );
}

export default App;