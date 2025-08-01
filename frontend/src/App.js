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
import logger, { useLogger, setupAxiosLogging } from './utils/simpleLogger';
import { accessibility } from './utils/accessibility';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { FocusManagementProvider } from './contexts/FocusManagementContext.tsx';
import FocusableJoystick from './components/ui/FocusableJoystick.tsx';
import FocusableGauge from './components/ui/FocusableGauge.tsx';
import FocusableEmergencyControls from './components/ui/FocusableEmergencyControls.tsx';

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

// Shared components
import { RoverModel, TelemetryGauge, Panel } from './components/shared';

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

function useGamepad() {
  const [gamepad, setGamepad] = useState({ connected: false, axes: [], buttons: [] });
  
  useEffect(() => {
    const updateGamepad = () => {
      const gamepads = navigator.getGamepads();
      const gp = gamepads[0];
      
      if (gp) {
        setGamepad({
          connected: true,
          axes: Array.from(gp.axes),
          buttons: Array.from(gp.buttons).map(btn => btn.pressed)
        });
      } else {
        setGamepad({ connected: false, axes: [], buttons: [] });
      }
    };
    
    const interval = setInterval(updateGamepad, 100);
    
    window.addEventListener('gamepadconnected', updateGamepad);
    window.addEventListener('gamepaddisconnected', updateGamepad);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('gamepadconnected', updateGamepad);
      window.removeEventListener('gamepaddisconnected', updateGamepad);
    };
  }, []);
  
  return gamepad;
}

function useSmoothedInput(input, smoothFactor = 0.3) {
  const [smoothedValue, setSmoothedValue] = useState(input);
  
  useEffect(() => {
    setSmoothedValue(prev => prev * smoothFactor + input * (1 - smoothFactor));
  }, [input, smoothFactor]);
  
  return smoothedValue;
}

function App() {
  // State management
  const [activeModule, setActiveModule] = useState('dashboard');
  const [telemetry, setTelemetry] = useState(null);
  const [telemetryHistory, setTelemetryHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  
  // Panel states
  const [panelStates, setPanelStates] = useState({
    rover3d: false,
    telemetryChart: false,
    control: false,
    gauges: false,
    arduino: false,
    libraries: false,
    serial: false,
    compilation: false,
    ai: false,
    kanban: false,
    inventory: false,
    knowledge: false,
  });
  
  // Control input state
  const [controlInput, setControlInput] = useState({
    forward: 0,
    turn: 0,
    speed: 0.5,
  });
  
  // Smooth control inputs
  const smoothedForward = useSmoothedInput(controlInput.forward);
  const smoothedTurn = useSmoothedInput(controlInput.turn);
  
  // Arduino IDE state
  const [arduinoCode, setArduinoCode] = useState(`
// Enhanced Rover Control System with Real-time Telemetry
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WebSocketsClient.h>

// Motor Control Pins
#define MOTOR_FL_PWM 2
#define MOTOR_FL_DIR 3
#define MOTOR_FR_PWM 4
#define MOTOR_FR_DIR 5
#define MOTOR_RL_PWM 6
#define MOTOR_RL_DIR 7
#define MOTOR_RR_PWM 8
#define MOTOR_RR_DIR 9

// Emergency Stop Pin
#define EMERGENCY_STOP_PIN 10

// WebSocket and WiFi setup
WebSocketsClient webSocket;
bool emergencyStop = false;

void setup() {
  Serial.begin(115200);
  
  // Initialize motor pins
  pinMode(MOTOR_FL_PWM, OUTPUT);
  pinMode(MOTOR_FL_DIR, OUTPUT);
  pinMode(MOTOR_FR_PWM, OUTPUT);
  pinMode(MOTOR_FR_DIR, OUTPUT);
  pinMode(MOTOR_RL_PWM, OUTPUT);
  pinMode(MOTOR_RL_DIR, OUTPUT);
  pinMode(MOTOR_RR_PWM, OUTPUT);
  pinMode(MOTOR_RR_DIR, OUTPUT);
  
  // Emergency stop button
  pinMode(EMERGENCY_STOP_PIN, INPUT_PULLUP);
  
  // Connect to WiFi
  WiFi.begin("Your_WiFi_SSID", "Your_WiFi_Password");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  // Initialize WebSocket
  webSocket.begin("192.168.1.100", 8001, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void loop() {
  webSocket.loop();
  
  // Check emergency stop
  if (digitalRead(EMERGENCY_STOP_PIN) == LOW) {
    emergencyStop = true;
    stopAllMotors();
  }
  
  // Handle incoming commands
  if (Serial.available()) {
    String command = Serial.readStringUntil('\\n');
    handleCommand(command);
  }
  
  // Send telemetry every 100ms
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry > 100) {
    sendTelemetry();
    lastTelemetry = millis();
  }
}

void handleCommand(String command) {
  DynamicJsonDocument doc(1024);
  deserializeJson(doc, command);
  
  if (emergencyStop && doc["type"] != "resume") {
    return; // Ignore all commands except resume during emergency stop
  }
  
  if (doc["type"] == "control") {
    float forward = constrain(doc["forward"], -1.0, 1.0);
    float turn = constrain(doc["turn"], -1.0, 1.0);
    float speed = constrain(doc["speed"], 0.0, 1.0);
    
    // Calculate individual wheel speeds with differential steering
    float leftSpeed = (forward + turn) * speed * 255;
    float rightSpeed = (forward - turn) * speed * 255;
    
    // Apply to motors
    analogWrite(MOTOR_FL_PWM, constrain(abs(leftSpeed), 0, 255));
    analogWrite(MOTOR_RL_PWM, constrain(abs(leftSpeed), 0, 255));
    analogWrite(MOTOR_FR_PWM, constrain(abs(rightSpeed), 0, 255));
    analogWrite(MOTOR_RR_PWM, constrain(abs(rightSpeed), 0, 255));
    
    // Set direction
    digitalWrite(MOTOR_FL_DIR, leftSpeed >= 0 ? HIGH : LOW);
    digitalWrite(MOTOR_RL_DIR, leftSpeed >= 0 ? HIGH : LOW);
    digitalWrite(MOTOR_FR_DIR, rightSpeed >= 0 ? HIGH : LOW);
    digitalWrite(MOTOR_RR_DIR, rightSpeed >= 0 ? HIGH : LOW);
  }
  else if (doc["type"] == "emergency_stop") {
    emergencyStop = true;
    stopAllMotors();
  }
  else if (doc["type"] == "resume") {
    emergencyStop = false;
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
  
  // Battery voltages (simulated - replace with actual readings)
  doc["battery"]["motor"]["voltage"] = 36.2;
  doc["battery"]["motor"]["percentage"] = 85;
  doc["battery"]["logic"]["voltage"] = 24.8;
  doc["battery"]["logic"]["percentage"] = 92;
  
  // Temperature (simulated)
  doc["temp"] = 45.3;
  
  // Simulated wheel RPMs
  doc["wheels"]["fl"] = random(0, 100);
  doc["wheels"]["fr"] = random(0, 100);
  doc["wheels"]["rl"] = random(0, 100);
  doc["wheels"]["rr"] = random(0, 100);
  
  String output;
  serializeJson(doc, output);
  Serial.println(output);
  
  // Send via WebSocket if connected
  if (webSocket.isConnected()) {
    webSocket.sendTXT(output);
  }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected");
      break;
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected");
      break;
    case WStype_TEXT:
      handleCommand((char*)payload);
      break;
  }
}
  `);
  
  // Additional state variables for different modules
  const [selectedPort, setSelectedPort] = useState('');
  const [availablePorts, setAvailablePorts] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [installedLibraries, setInstalledLibraries] = useState([]);
  const [serialMonitor, setSerialMonitor] = useState('');
  const [compilationOutput, setCompilationOutput] = useState('');
  
  // AI Assistant state
  const [chatMessages, setChatMessages] = useState([]);
  const [isAITyping, setIsAITyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatInput, setChatInput] = useState('');
  
  // Project state
  const [projectTasks, setProjectTasks] = useState([]);
  
  // Knowledge base state
  const [knowledgeModule, setKnowledgeModule] = useState('parts');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [calculatorResults, setCalculatorResults] = useState({});
  
  // Refs
  const editorRef = useRef(null);
  const roverPosition = useRef([0, 0, 0]);
  const roverRotation = useRef([0, 0, 0]);
  
  // Hooks
  const gamepad = useGamepad();
  
  // Chart data
  const chartData = {
    labels: telemetryHistory.slice(-20).map((_, i) => i.toString()),
    datasets: [
      {
        label: 'Front Left',
        data: telemetryHistory.slice(-20).map(t => t?.wheels?.fl || 0),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1,
      },
      {
        label: 'Front Right',
        data: telemetryHistory.slice(-20).map(t => t?.wheels?.fr || 0),
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.1,
      },
      {
        label: 'Rear Left',
        data: telemetryHistory.slice(-20).map(t => t?.wheels?.rl || 0),
        borderColor: 'rgb(255, 205, 86)',
        backgroundColor: 'rgba(255, 205, 86, 0.2)',
        tension: 0.1,
      },
      {
        label: 'Rear Right',
        data: telemetryHistory.slice(-20).map(t => t?.wheels?.rr || 0),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Wheel RPM Telemetry',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 150,
      },
    },
    accessibility: {
      enabled: true,
      description: 'Real-time telemetry chart showing wheel RPM data for all four rover wheels over time'
    }
  };
  
  // Event handlers
  const togglePanel = (panelName) => {
    setPanelStates(prev => ({ ...prev, [panelName]: !prev[panelName] }));
  };
  
  const handleEmergencyStop = () => {
    setEmergencyStop(true);
    fetch(`${BACKEND_URL}/api/rover/emergency-stop`, { method: 'POST' });
  };
  
  const sendControlCommand = (forward, turn, speed) => {
    const command = { forward, turn, speed };
    fetch(`${BACKEND_URL}/api/rover/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
  };
  
  const announceToScreenReader = (message) => {
    // Implementation for screen reader announcements
  };
  
  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };
  
  const exportData = (format) => {
    // Implementation for data export
  };
  
  const compileArduinoCode = () => {
    // Implementation for Arduino compilation
  };
  
  const uploadArduinoCode = () => {
    // Implementation for Arduino upload
  };
  
  const connectSerialMonitor = () => {
    // Implementation for serial monitor connection
  };
  
  const searchLibraries = (query) => {
    // Implementation for library search
  };
  
  const installLibrary = (libraryName) => {
    // Implementation for library installation
  };
  
  const sendChatMessage = () => {
    // Implementation for AI chat
  };

  // Render module with lazy loading
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
          
          {/* Application Header */}
          <header className="main-header" role="banner">
            <div className="header-left">
              <h1 className="app-title">🚀 ROVER DEVELOPMENT PLATFORM v2.0</h1>
              <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`} role="status" aria-live="polite">
                <span className="status-dot" aria-hidden="true"></span>
                {isConnected ? 'MISSION CONTROL ONLINE' : 'OFFLINE'}
              </div>
            </div>
            <aside className="header-right" aria-label="System status and controls">
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
                    <dd className="stat-value">Connected</dd>
                  </div>
                )}
              </dl>
            </aside>
          </header>

          <div className="app-body">
            {/* Primary Navigation - Main application navigation */}
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
                </ul>
              </section>

              <section className="nav-section">
                <h2>DEVELOPMENT</h2>
                <ul role="list">
                  <li>
                    <button 
                      className={`nav-btn ${activeModule === 'd3demo' ? 'active' : ''}`}
                      onClick={() => setActiveModule('d3demo')}
                      aria-current={activeModule === 'd3demo' ? 'page' : undefined}
                    >
                      📈 D3 Demo
                    </button>
                  </li>
                </ul>
              </section>
            </nav>

            {/* Main Content Area with lazy-loaded modules */}
            <main id="main-content" className="main-content" role="main" tabIndex="-1">
              {renderModule()}
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </FocusManagementProvider>
  );
}

export default App;