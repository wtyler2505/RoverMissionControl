import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  // Rover state
  const [telemetry, setTelemetry] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [emergencyStop, setEmergencyStop] = useState(false);
  
  // AI Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  
  // Control state
  const [controlInput, setControlInput] = useState({
    forward: 0,
    turn: 0,
    speed: 0.8
  });
  
  const websocket = useRef(null);
  const joystickRef = useRef(null);
  const isDragging = useRef(false);

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
    };
    
    websocket.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    websocket.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  // Send control command to rover
  const sendControlCommand = async (forward, turn, speed) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rover/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forward, turn, speed }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to send control command');
      }
    } catch (error) {
      console.error('Control error:', error);
    }
  };

  // Emergency stop
  const handleEmergencyStop = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rover/emergency-stop`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setEmergencyStop(true);
        setControlInput({ forward: 0, turn: 0, speed: 0 });
      }
    } catch (error) {
      console.error('Emergency stop error:', error);
    }
  };

  // Resume rover
  const handleResumeRover = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/rover/resume`, {
        method: 'POST',
      });
      
      if (response.ok) {
        setEmergencyStop(false);
      }
    } catch (error) {
      console.error('Resume error:', error);
    }
  };

  // Virtual joystick handlers
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
    sendControlCommand(forward, turn, prev.speed);
  };

  // Mouse events for joystick
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

  // Keyboard controls
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
          e.preventDefault();
          handleEmergencyStop();
          return;
        default:
          return;
      }
      
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
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [emergencyStop, controlInput.speed]);

  // AI Chat
  const sendChatMessage = async () => {
    if (!chatInput.trim() || isAITyping) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setIsAITyping(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.detail}` }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Connection error: ${error.message}` }]);
    }
    
    setIsAITyping(false);
  };

  const formatRPM = (rpm) => rpm?.toFixed(0) || '0';
  const formatVoltage = (voltage) => voltage?.toFixed(1) || '0.0';

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">🚀 ROVER MISSION CONTROL</h1>
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              <div className="status-dot"></div>
              {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </div>
          </div>
          <div className="header-right">
            <div className="system-time">
              {new Date().toLocaleTimeString()}
            </div>
            {emergencyStop && (
              <button 
                className="resume-btn"
                onClick={handleResumeRover}
              >
                RESUME
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="main-content">
        {/* Left Panel - Telemetry */}
        <div className="left-panel">
          <div className="panel">
            <h2 className="panel-title">WHEEL TELEMETRY</h2>
            <div className="wheel-grid">
              {telemetry?.wheels && Object.entries(telemetry.wheels).map(([wheel, data]) => (
                <div key={wheel} className="wheel-display">
                  <div className="wheel-label">{wheel.toUpperCase()}</div>
                  <div className="wheel-rpm">{formatRPM(data.rpm)}</div>
                  <div className="wheel-unit">RPM</div>
                  <div className="wheel-pulses">Pulses: {data.pulses?.toLocaleString() || '0'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">POWER SYSTEMS</h2>
            <div className="battery-grid">
              <div className="battery-display">
                <div className="battery-label">MOTOR BATTERY</div>
                <div className="battery-voltage">{formatVoltage(telemetry?.battery?.motor)}V</div>
                <div className="battery-bar">
                  <div 
                    className="battery-fill"
                    style={{ width: `${Math.max(0, Math.min(100, ((telemetry?.battery?.motor || 0) - 32) / (42 - 32) * 100))}%` }}
                  ></div>
                </div>
              </div>
              <div className="battery-display">
                <div className="battery-label">LOGIC BATTERY</div>
                <div className="battery-voltage">{formatVoltage(telemetry?.battery?.logic)}V</div>
                <div className="battery-bar">
                  <div 
                    className="battery-fill"
                    style={{ width: `${Math.max(0, Math.min(100, ((telemetry?.battery?.logic || 0) - 21) / (25.2 - 21) * 100))}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2 className="panel-title">SYSTEM STATUS</h2>
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Temperature:</span>
                <span className={`status-value ${(telemetry?.temp || 0) > 70 ? 'warning' : ''}`}>
                  {telemetry?.temp?.toFixed(1) || '0.0'}°C
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Uptime:</span>
                <span className="status-value">
                  {telemetry?.uptime ? Math.floor(telemetry.uptime / 1000) : 0}s
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Emergency:</span>
                <span className={`status-value ${emergencyStop ? 'error' : 'success'}`}>
                  {emergencyStop ? 'STOPPED' : 'NORMAL'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Panel - Control */}
        <div className="center-panel">
          <div className="panel control-panel">
            <h2 className="panel-title">ROVER CONTROL</h2>
            
            {/* Emergency Stop */}
            <button 
              className="emergency-stop"
              onClick={handleEmergencyStop}
              disabled={emergencyStop}
            >
              EMERGENCY STOP
            </button>

            {/* Virtual Joystick */}
            <div className="joystick-container">
              <div 
                ref={joystickRef}
                className="joystick"
                onMouseDown={handleMouseDown}
              >
                <div 
                  className="joystick-knob"
                  style={{
                    transform: `translate(${controlInput.turn * 40}px, ${-controlInput.forward * 40}px)`
                  }}
                ></div>
              </div>
              <div className="joystick-label">Virtual Joystick</div>
            </div>

            {/* Speed Control */}
            <div className="speed-control">
              <label className="speed-label">Speed: {Math.round(controlInput.speed * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={controlInput.speed}
                onChange={(e) => setControlInput(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
                className="speed-slider"
                disabled={emergencyStop}
              />
            </div>

            {/* Control Instructions */}
            <div className="control-instructions">
              <div className="instruction-title">CONTROLS</div>
              <div className="instruction">• WASD or Arrow Keys</div>
              <div className="instruction">• Mouse/Touch Joystick</div>
              <div className="instruction">• SPACE = Emergency Stop</div>
            </div>
          </div>
        </div>

        {/* Right Panel - AI Assistant */}
        <div className="right-panel">
          <div className="panel ai-panel">
            <h2 className="panel-title">🤖 AI ASSISTANT</h2>
            
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.length === 0 && (
                  <div className="welcome-message">
                    👋 Hi! I'm your rover development assistant. Ask me anything about:
                    <br />• Arduino code optimization
                    <br />• Motor controller tuning
                    <br />• Hardware troubleshooting
                    <br />• Protocol debugging
                  </div>
                )}
                {chatMessages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`chat-message ${message.role}`}
                  >
                    <div className="message-content">
                      {message.content}
                    </div>
                  </div>
                ))}
                {isAITyping && (
                  <div className="chat-message assistant">
                    <div className="message-content typing">
                      <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
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
                  placeholder="Ask about rover development..."
                  className="chat-input"
                  disabled={isAITyping}
                />
                <button 
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || isAITyping}
                  className="chat-send"
                >
                  SEND
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;