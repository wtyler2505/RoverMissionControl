import React from 'react';
import { Panel } from '../shared';

const AIAssistant = ({
  // AI Assistant props
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
}) => {
  return (
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
};

export default AIAssistant;