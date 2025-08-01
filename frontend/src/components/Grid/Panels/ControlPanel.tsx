/**
 * ControlPanel Component - Rover control interface
 * Mission-critical control interface for rover operation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PanelProps } from '../../../types/grid';
import './PanelStyles.css';

interface ControlState {
  forward: number;
  turn: number;
  speed: number;
  emergencyStop: boolean;
  autonomousMode: boolean;
  headlights: boolean;
  cameraTilt: number;
  cameraPan: number;
}

interface ControlPanelProps extends PanelProps {
  onControlChange?: (control: ControlState) => void;
  maxSpeed?: number;
  enableJoystick?: boolean;
  showAdvancedControls?: boolean;
  emergencyStopEnabled?: boolean;
}

// Virtual joystick component
const VirtualJoystick: React.FC<{
  onMove: (x: number, y: number) => void;
  disabled?: boolean;
  size?: number;
}> = ({ onMove, disabled = false, size = 120 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;
    setIsDragging(true);
    updatePosition(clientX, clientY);
  }, [disabled]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || disabled) return;
    updatePosition(clientX, clientY);
  }, [isDragging, disabled]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  }, [onMove]);

  const updatePosition = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current) return;

    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const maxRadius = (size / 2) - 20;
    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > maxRadius) {
      deltaX = (deltaX / distance) * maxRadius;
      deltaY = (deltaY / distance) * maxRadius;
    }
    
    const normalizedX = deltaX / maxRadius;
    const normalizedY = -deltaY / maxRadius; // Invert Y axis
    
    setPosition({ x: deltaX, y: deltaY });
    onMove(normalizedX, normalizedY);
  }, [size, onMove]);

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
  }, [handleMove]);

  const handleMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, [handleMove]);

  const handleTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return (
    <div className="virtual-joystick-container">
      <div
        ref={joystickRef}
        className={`virtual-joystick ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        role="slider"
        aria-label="Movement joystick"
        tabIndex={disabled ? -1 : 0}
      >
        <div className="joystick-background">
          <div className="joystick-center-dot" />
          <div className="joystick-ring" />
        </div>
        <div
          className="joystick-handle"
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`
          }}
        />
      </div>
      <div className="joystick-label">Movement</div>
    </div>
  );
};

// Control slider component
const ControlSlider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  vertical?: boolean;
}> = ({ 
  label, 
  value, 
  min, 
  max, 
  step = 0.1, 
  unit = '', 
  onChange, 
  disabled = false,
  vertical = false 
}) => {
  return (
    <div className={`control-slider ${vertical ? 'vertical' : 'horizontal'} ${disabled ? 'disabled' : ''}`}>
      <div className="slider-header">
        <label className="slider-label">{label}</label>
        <span className="slider-value">
          {value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="slider-container">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="slider-input"
          aria-label={`${label} control`}
        />
        <div className="slider-track">
          <div 
            className="slider-fill"
            style={{ 
              [vertical ? 'height' : 'width']: `${((value - min) / (max - min)) * 100}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Emergency stop button
const EmergencyStopButton: React.FC<{
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ active, onClick, disabled = false }) => {
  return (
    <button
      className={`emergency-stop-btn ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={active ? "Resume operation" : "Emergency stop"}
      role="button"
    >
      <div className="emergency-stop-icon">
        {active ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        )}
      </div>
      <span className="emergency-stop-text">
        {active ? 'RESUME' : 'E-STOP'}
      </span>
    </button>
  );
};

const ControlPanel: React.FC<ControlPanelProps> = ({
  id,
  config = {},
  onControlChange,
  maxSpeed = 2.0,
  enableJoystick = true,
  showAdvancedControls = true,
  emergencyStopEnabled = true,
  isMinimized
}) => {
  const [controlState, setControlState] = useState<ControlState>({
    forward: 0,
    turn: 0,
    speed: 0.8,
    emergencyStop: false,
    autonomousMode: false,
    headlights: false,
    cameraTilt: 0,
    cameraPan: 0
  });

  const [isConnected, setIsConnected] = useState(true);
  const [lastCommand, setLastCommand] = useState<number>(0);
  
  // Update control state and notify parent
  const updateControl = useCallback((updates: Partial<ControlState>) => {
    setControlState(prev => {
      const newState = { ...prev, ...updates };
      onControlChange?.(newState);
      setLastCommand(Date.now());
      return newState;
    });
  }, [onControlChange]);

  // Joystick movement handler
  const handleJoystickMove = useCallback((x: number, y: number) => {
    if (controlState.emergencyStop) return;
    updateControl({ turn: x, forward: y });
  }, [controlState.emergencyStop, updateControl]);

  // Emergency stop handler
  const handleEmergencyStop = useCallback(() => {
    const newStopState = !controlState.emergencyStop;
    updateControl({
      emergencyStop: newStopState,
      forward: newStopState ? 0 : controlState.forward,
      turn: newStopState ? 0 : controlState.turn
    });
  }, [controlState.emergencyStop, controlState.forward, controlState.turn, updateControl]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (controlState.emergencyStop || !isConnected) return;

      let forward = controlState.forward;
      let turn = controlState.turn;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          forward = Math.min(1, forward + 0.1);
          break;
        case 's':
        case 'arrowdown':
          forward = Math.max(-1, forward - 0.1);
          break;
        case 'a':
        case 'arrowleft':
          turn = Math.max(-1, turn - 0.1);
          break;
        case 'd':
        case 'arrowright':
          turn = Math.min(1, turn + 0.1);
          break;
        case ' ':
        case 'escape':
          e.preventDefault();
          handleEmergencyStop();
          return;
        case 'l':
          updateControl({ headlights: !controlState.headlights });
          return;
        default:
          return;
      }

      e.preventDefault();
      updateControl({ forward, turn });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        updateControl({ forward: 0, turn: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controlState, isConnected, handleEmergencyStop, updateControl]);

  if (isMinimized) {
    return (
      <div className="control-panel-minimized">
        <div className="control-status">
          <div className={`status-indicator ${controlState.emergencyStop ? 'stopped' : 'active'}`} />
          <span>Control: {controlState.emergencyStop ? 'E-STOP' : 'Active'}</span>
          <span className="speed-indicator">Speed: {(controlState.speed * maxSpeed).toFixed(1)}m/s</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`control-panel ${controlState.emergencyStop ? 'emergency-stopped' : ''}`}>
      {/* Connection status */}
      <div className="control-header">
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <div className="status-dot" />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="last-command">
          Last: {lastCommand ? new Date(lastCommand).toLocaleTimeString() : 'Never'}
        </div>
      </div>

      {/* Emergency stop */}
      {emergencyStopEnabled && (
        <div className="emergency-section">
          <EmergencyStopButton
            active={controlState.emergencyStop}
            onClick={handleEmergencyStop}
            disabled={!isConnected}
          />
        </div>
      )}

      {/* Main controls */}
      <div className="main-controls">
        {/* Virtual joystick */}
        {enableJoystick && (
          <VirtualJoystick
            onMove={handleJoystickMove}
            disabled={controlState.emergencyStop || !isConnected}
            size={120}
          />
        )}

        {/* Manual controls */}
        <div className="manual-controls">
          <ControlSlider
            label="Forward/Backward"
            value={controlState.forward}
            min={-1}
            max={1}
            onChange={(value) => updateControl({ forward: value })}
            disabled={controlState.emergencyStop || !isConnected}
          />
          <ControlSlider
            label="Turn Left/Right"
            value={controlState.turn}
            min={-1}
            max={1}
            onChange={(value) => updateControl({ turn: value })}
            disabled={controlState.emergencyStop || !isConnected}
          />
          <ControlSlider
            label="Speed Limit"
            value={controlState.speed}
            min={0}
            max={1}
            unit={` (${(controlState.speed * maxSpeed).toFixed(1)}m/s)`}
            onChange={(value) => updateControl({ speed: value })}
            disabled={controlState.emergencyStop || !isConnected}
          />
        </div>
      </div>

      {/* Advanced controls */}
      {showAdvancedControls && (
        <div className="advanced-controls">
          <div className="control-section">
            <h4>Camera Control</h4>
            <div className="camera-controls">
              <ControlSlider
                label="Pan"
                value={controlState.cameraPan}
                min={-90}
                max={90}
                unit="°"
                onChange={(value) => updateControl({ cameraPan: value })}
                disabled={controlState.emergencyStop || !isConnected}
              />
              <ControlSlider
                label="Tilt"
                value={controlState.cameraTilt}
                min={-45}
                max={45}
                unit="°"
                onChange={(value) => updateControl({ cameraTilt: value })}
                disabled={controlState.emergencyStop || !isConnected}
                vertical
              />
            </div>
          </div>

          <div className="control-section">
            <h4>System Controls</h4>
            <div className="toggle-controls">
              <label className="toggle-control">
                <input
                  type="checkbox"
                  checked={controlState.headlights}
                  onChange={(e) => updateControl({ headlights: e.target.checked })}
                  disabled={controlState.emergencyStop || !isConnected}
                />
                <span className="toggle-slider" />
                <span className="toggle-label">Headlights</span>
              </label>
              <label className="toggle-control">
                <input
                  type="checkbox"
                  checked={controlState.autonomousMode}
                  onChange={(e) => updateControl({ autonomousMode: e.target.checked })}
                  disabled={controlState.emergencyStop || !isConnected}
                />
                <span className="toggle-slider" />
                <span className="toggle-label">Autonomous Mode</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Control help */}
      <div className="control-help">
        <details>
          <summary>Keyboard Controls</summary>
          <div className="help-content">
            <div className="help-item">
              <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>Arrow Keys</kbd> - Movement
            </div>
            <div className="help-item">
              <kbd>Space</kbd> or <kbd>Esc</kbd> - Emergency Stop
            </div>
            <div className="help-item">
              <kbd>L</kbd> - Toggle Headlights
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default ControlPanel;