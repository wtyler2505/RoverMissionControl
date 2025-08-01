import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

// Lazy-loaded route components for SSR compatibility
const Dashboard = React.lazy(() => import('./routes/Dashboard'));
const IDE = React.lazy(() => import('./routes/IDE'));
const AIAssistant = React.lazy(() => import('./routes/AIAssistant'));
const Project = React.lazy(() => import('./routes/Project'));
const Knowledge = React.lazy(() => import('./routes/Knowledge'));
const D3Demo = React.lazy(() => import('./routes/D3Demo'));

// Loading skeletons for SSR
import {
  DashboardSkeleton,
  IDESkeleton,
  AIAssistantSkeleton,
  ProjectSkeleton,
  KnowledgeSkeleton,
  GenericSkeleton
} from './components/loading';

// SSR-compatible component wrapper
const SSRWrapper = ({ children, fallback }) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  );
};

// NoSSR component for client-only components
const NoSSR = ({ children, fallback = null }) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback;
  }

  return children;
};

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

// Custom hook for gamepad with SSR safety
function useGamepad() {
  const [gamepad, setGamepad] = useState({ connected: false, axes: [], buttons: [] });
  
  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;
    
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

// Navigation component with active route detection
const Navigation = () => {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;
  
  const NavButton = ({ to, children, ...props }) => (
    <li>
      <button 
        className={`nav-btn ${isActive(to) ? 'active' : ''}`}
        onClick={() => window.history.pushState({}, '', to)}
        aria-current={isActive(to) ? 'page' : undefined}
        {...props}
      >
        {children}
      </button>
    </li>
  );
  
  return (
    <nav id="navigation" className="sidebar" role="navigation" aria-label="Main navigation">
      <section className="nav-section">
        <h2>MISSION CONTROL</h2>
        <ul role="list">
          <NavButton to="/dashboard">📊 Operations Dashboard</NavButton>
          <NavButton to="/ide">💻 Arduino IDE</NavButton>
          <NavButton to="/ai">🤖 AI Assistant</NavButton>
        </ul>
      </section>

      <section className="nav-section">
        <h2>PROJECT TOOLS</h2>
        <ul role="list">
          <NavButton to="/project">📋 Project Management</NavButton>
          <NavButton to="/knowledge">📚 Knowledge Base</NavButton>
        </ul>
      </section>

      <section className="nav-section">
        <h2>DEVELOPMENT</h2>
        <ul role="list">
          <NavButton to="/d3demo">📈 D3 Demo</NavButton>
        </ul>
      </section>
    </nav>
  );
};

// Header component with SSR-safe status indicators
const Header = ({ telemetry, isConnected, gamepad }) => (
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
        <NoSSR>
          {gamepad.connected && (
            <div className="stat gamepad-stat">
              <dt className="stat-label">🎮 Gamepad:</dt>
              <dd className="stat-value">Connected</dd>
            </div>
          )}
        </NoSSR>
      </dl>
    </aside>
  </header>
);

// Main App component with Router
function App({ initialData = {}, ssrRoute = '/' }) {
  // Initialize state with SSR data if available
  const [telemetry, setTelemetry] = useState(initialData.telemetry || null);
  const [telemetryHistory, setTelemetryHistory] = useState(initialData.telemetryHistory || []);
  const [isConnected, setIsConnected] = useState(initialData.isConnected || false);
  const [isRecording, setIsRecording] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  
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
  
  // WebSocket connection management (SSR-safe)
  useEffect(() => {
    // Only establish WebSocket connection on client-side
    if (typeof window === 'undefined') return;
    
    const connectWebSocket = () => {
      console.log('🔌 Initializing WebSocket connection...');
      
      try {
        // This would be replaced with actual Socket.IO connection
        // For now, simulate the connection establishment
        setTimeout(() => {
          setIsConnected(true);
          console.log('✅ WebSocket connected');
        }, 1000);
        
        // Simulate telemetry data
        const interval = setInterval(() => {
          const mockTelemetry = {
            timestamp: Date.now(),
            temp: 45 + Math.random() * 10,
            battery: {
              motor: { voltage: 36.2, percentage: 85 },
              logic: { voltage: 24.8, percentage: 92 }
            },
            wheels: {
              fl: Math.floor(Math.random() * 100),
              fr: Math.floor(Math.random() * 100),
              rl: Math.floor(Math.random() * 100),
              rr: Math.floor(Math.random() * 100)
            }
          };
          
          setTelemetry(mockTelemetry);
          setTelemetryHistory(prev => [...prev.slice(-19), mockTelemetry]);
        }, 1000);
        
        return () => {
          clearInterval(interval);
          setIsConnected(false);
        };
        
      } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
        setIsConnected(false);
      }
    };
    
    // Listen for custom connect event from hydration
    const handleConnectEvent = (event) => {
      setTimeout(connectWebSocket, event.detail?.delay || 0);
    };
    
    window.addEventListener('app:connect-websocket', handleConnectEvent);
    
    // Auto-connect after a short delay if not coming from SSR
    if (!ssrRoute || ssrRoute === '/') {
      setTimeout(connectWebSocket, 2000);
    }
    
    return () => {
      window.removeEventListener('app:connect-websocket', handleConnectEvent);
    };
  }, [ssrRoute]);
  
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

  // Common props for all routes
  const commonProps = {
    // Global state
    telemetry,
    setTelemetry,
    telemetryHistory,
    setTelemetryHistory,
    isConnected,
    setIsConnected,
    isRecording,
    setIsRecording,
    emergencyStop,
    setEmergencyStop,
    
    // Control state
    controlInput,
    setControlInput,
    smoothedForward,
    smoothedTurn,
    
    // Arduino state
    arduinoCode,
    setArduinoCode,
    editorRef,
    selectedPort,
    setSelectedPort,
    availablePorts,
    setAvailablePorts,
    libraries,
    setLibraries,
    installedLibraries,
    setInstalledLibraries,
    serialMonitor,
    setSerialMonitor,
    compilationOutput,
    setCompilationOutput,
    
    // AI state
    chatMessages,
    setChatMessages,
    isAITyping,
    setIsAITyping,
    isStreaming,
    setIsStreaming,
    chatInput,
    setChatInput,
    
    // Project state
    projectTasks,
    setProjectTasks,
    
    // Knowledge state
    knowledgeModule,
    setKnowledgeModule,
    searchQuery,
    setSearchQuery,
    categories,
    setCategories,
    parts,
    setParts,
    selectedPart,
    setSelectedPart,
    documents,
    setDocuments,
    selectedDocument,
    setSelectedDocument,
    searchResults,
    setSearchResults,
    calculatorResults,
    setCalculatorResults,
    
    // Chart data
    chartData,
    chartOptions,
    
    // Refs
    roverPosition,
    roverRotation,
    
    // Hooks
    gamepad,
    
    // Handlers
    handleEmergencyStop,
    sendControlCommand,
    announceToScreenReader,
    toggleRecording,
    exportData,
    compileArduinoCode,
    uploadArduinoCode,
    connectSerialMonitor,
    searchLibraries,
    installLibrary,
    sendChatMessage,
    
    // Constants
    BACKEND_URL,
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
        <Router>
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
            <Header telemetry={telemetry} isConnected={isConnected} gamepad={gamepad} />

            <div className="app-body">
              {/* Primary Navigation */}
              <Navigation />

              {/* Main Content Area with Routes */}
              <main id="main-content" className="main-content" role="main" tabIndex="-1">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  <Route 
                    path="/dashboard" 
                    element={
                      <SSRWrapper fallback={<DashboardSkeleton />}>
                        <Dashboard {...commonProps} />
                      </SSRWrapper>
                    } 
                  />
                  
                  <Route 
                    path="/ide" 
                    element={
                      <SSRWrapper fallback={<IDESkeleton />}>
                        <IDE {...commonProps} />
                      </SSRWrapper>
                    } 
                  />
                  
                  <Route 
                    path="/ai" 
                    element={
                      <SSRWrapper fallback={<AIAssistantSkeleton />}>
                        <AIAssistant {...commonProps} />
                      </SSRWrapper>
                    } 
                  />
                  
                  <Route 
                    path="/project" 
                    element={
                      <SSRWrapper fallback={<ProjectSkeleton />}>
                        <Project {...commonProps} />
                      </SSRWrapper>
                    } 
                  />
                  
                  <Route 
                    path="/knowledge" 
                    element={
                      <SSRWrapper fallback={<KnowledgeSkeleton />}>
                        <Knowledge {...commonProps} />
                      </SSRWrapper>
                    } 
                  />
                  
                  <Route 
                    path="/d3demo" 
                    element={
                      <SSRWrapper fallback={<GenericSkeleton title="Loading D3 Demo..." />}>
                        <D3Demo {...commonProps} />
                      </SSRWrapper>
                    } 
                  />
                  
                  {/* Fallback route */}
                  <Route 
                    path="*" 
                    element={
                      <article className="welcome-workspace" aria-labelledby="welcome-heading">
                        <header className="module-header">
                          <h2 id="welcome-heading">Page Not Found</h2>
                        </header>
                        <section className="welcome-content">
                          <p>The requested page was not found. Please select a module from the sidebar.</p>
                        </section>
                      </article>
                    } 
                  />
                </Routes>
              </main>
            </div>
          </div>
        </Router>
      </ErrorBoundary>
    </FocusManagementProvider>
  );
}

export default App;