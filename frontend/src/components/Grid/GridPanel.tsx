/**
 * GridPanel Component - Individual panel within the grid system
 * Handles panel rendering, controls, and interactions
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { PanelInstance, PanelProps } from '../../types/grid';
import { Theme } from '../../theme/themes';
import './GridPanel.css';

// Panel control icons (using simple SVG for no external dependencies)
const MinimizeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const MaximizeIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  </svg>
);

const RestoreIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <path d="M9 9h6v6"/>
  </svg>
);

const CloseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const SettingsIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 1v6m0 8v6m11-6h-6m-8 0H1"/>
  </svg>
);

const DragIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="12" r="1"/>
    <circle cx="9" cy="5" r="1"/>
    <circle cx="9" cy="19" r="1"/>
    <circle cx="15" cy="12" r="1"/>
    <circle cx="15" cy="5" r="1"/>
    <circle cx="15" cy="19" r="1"/>
  </svg>
);

export interface GridPanelProps {
  panel: PanelInstance;
  theme: Theme;
  onRemove?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onSettings?: () => void;
  enableAnimations?: boolean;
  showControls?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const GridPanel: React.FC<GridPanelProps> = ({
  panel,
  theme,
  onRemove,
  onMinimize,
  onMaximize,
  onSettings,
  enableAnimations = true,
  showControls = true,
  className = '',
  children
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Enhanced panel type mapping for better UX
  const panelTypeConfig = useMemo(() => {
    const configs = {
      telemetry: {
        icon: '📡',
        color: theme.colors.telemetry,
        bgColor: `${theme.colors.telemetry}10`,
        borderColor: theme.colors.telemetry,
        description: 'Real-time sensor data and metrics'
      },
      control: {
        icon: '🎮',
        color: theme.colors.command,
        bgColor: `${theme.colors.command}10`,
        borderColor: theme.colors.command,
        description: 'Rover control interface'
      },
      visualization: {
        icon: '📊',
        color: theme.colors.info.main,
        bgColor: `${theme.colors.info.main}10`,
        borderColor: theme.colors.info.main,
        description: '3D visualization and charts'
      },
      status: {
        icon: '🔍',
        color: theme.colors.success.main,
        bgColor: `${theme.colors.success.main}10`,
        borderColor: theme.colors.success.main,
        description: 'System health and status'
      },
      communication: {
        icon: '💬',
        color: theme.colors.secondary.main,
        bgColor: `${theme.colors.secondary.main}10`,
        borderColor: theme.colors.secondary.main,
        description: 'Mission logs and communication'
      },
      custom: {
        icon: '⚙️',
        color: theme.colors.text.secondary,
        bgColor: `${theme.colors.text.secondary}10`,
        borderColor: theme.colors.text.secondary,
        description: 'Custom panel'
      }
    };

    return configs[panel.panelId as keyof typeof configs] || configs.custom;
  }, [panel.panelId, theme]);

  // Handle panel interactions
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setIsControlsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTimeout(() => setIsControlsVisible(false), 200); // Delay to allow clicking controls
  }, []);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (e.target === panelRef.current) {
          e.preventDefault();
          setIsControlsVisible(!isControlsVisible);
        }
        break;
      case 'Escape':
        setIsControlsVisible(false);
        break;
      case 'Delete':
      case 'Backspace':
        if (e.ctrlKey) {
          e.preventDefault();
          onRemove?.();
        }
        break;
      case 'm':
        if (e.ctrlKey) {
          e.preventDefault();
          onMinimize?.();
        }
        break;
      case 'f':
        if (e.ctrlKey) {
          e.preventDefault();
          onMaximize?.();
        }
        break;
    }
  }, [isControlsVisible, onRemove, onMinimize, onMaximize]);

  // Panel styles based on state and theme
  const panelStyles = useMemo(() => ({
    '--panel-bg-color': panel.isMinimized 
      ? theme.colors.background.elevated 
      : panelTypeConfig.bgColor,
    '--panel-border-color': panelTypeConfig.borderColor,
    '--panel-accent-color': panelTypeConfig.color,
    '--panel-text-color': theme.colors.text.primary,
    '--panel-text-secondary': theme.colors.text.secondary,
    '--panel-shadow': theme.shadows.base,
    '--panel-border-radius': theme.borderRadius.base,
    opacity: panel.isVisible ? 1 : 0.6,
    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
    transition: enableAnimations ? theme.transitions.standard : 'none',
    zIndex: isDragging ? 1000 : panel.isMaximized ? 999 : 1
  }), [
    panel.isMinimized, 
    panel.isVisible, 
    panel.isMaximized,
    isDragging, 
    enableAnimations, 
    theme, 
    panelTypeConfig
  ]);

  return (
    <div
      ref={panelRef}
      className={`
        grid-panel 
        ${className}
        ${panel.isMinimized ? 'minimized' : ''}
        ${panel.isMaximized ? 'maximized' : ''}
        ${isDragging ? 'dragging' : ''}
        ${isHovered ? 'hovered' : ''}
        panel-type-${panel.panelId}
      `}
      style={panelStyles as React.CSSProperties}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="region"
      aria-label={`${panel.customTitle || panel.panelId} panel`}
      aria-describedby={`panel-desc-${panel.id}`}
      data-testid={`grid-panel-${panel.id}`}
      data-panel-type={panel.panelId}
      data-panel-id={panel.id}
    >
      {/* Panel Header */}
      <div className="panel-header">
        {/* Drag Handle */}
        <div 
          className="panel-drag-handle"
          onMouseDown={handleDragStart}
          onMouseUp={handleDragEnd}
          title="Drag to move panel"
          aria-label="Drag handle for panel"
          role="button"
          tabIndex={0}
        >
          <DragIcon size={14} />
        </div>

        {/* Panel Info */}
        <div className="panel-info">
          <div className="panel-icon" aria-hidden="true">
            {panelTypeConfig.icon}
          </div>
          <div className="panel-title-container">
            <h3 className="panel-title">
              {panel.customTitle || panel.panelId}
            </h3>
            {panel.layout && (
              <div className="panel-size-info" aria-label="Panel dimensions">
                {panel.layout.w}×{panel.layout.h}
              </div>
            )}
          </div>
        </div>

        {/* Panel Controls */}
        {showControls && (
          <div 
            className={`panel-controls ${isControlsVisible ? 'visible' : ''}`}
            role="toolbar"
            aria-label="Panel controls"
          >
            {onSettings && (
              <button
                className="panel-control-btn settings"
                onClick={onSettings}
                title="Panel settings"
                aria-label="Open panel settings"
                type="button"
              >
                <SettingsIcon size={14} />
              </button>
            )}
            
            {onMinimize && (
              <button
                className="panel-control-btn minimize"
                onClick={onMinimize}
                title={panel.isMinimized ? "Restore panel" : "Minimize panel"}
                aria-label={panel.isMinimized ? "Restore panel" : "Minimize panel"}
                type="button"
              >
                <MinimizeIcon size={14} />
              </button>
            )}
            
            {onMaximize && (
              <button
                className="panel-control-btn maximize"
                onClick={onMaximize}
                title={panel.isMaximized ? "Restore panel" : "Maximize panel"}
                aria-label={panel.isMaximized ? "Restore panel" : "Maximize panel"}
                type="button"
              >
                {panel.isMaximized ? <RestoreIcon size={14} /> : <MaximizeIcon size={14} />}
              </button>
            )}
            
            {onRemove && (
              <button
                className="panel-control-btn remove"
                onClick={onRemove}
                title="Remove panel"
                aria-label="Remove panel"
                type="button"
              >
                <CloseIcon size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Panel Content */}
      {!panel.isMinimized && (
        <div className="panel-content" role="main">
          <div 
            id={`panel-desc-${panel.id}`}
            className="sr-only"
          >
            {panelTypeConfig.description}
          </div>
          
          {children || (
            <div className="panel-placeholder">
              <div className="placeholder-content">
                <div className="placeholder-icon">
                  {panelTypeConfig.icon}
                </div>
                <div className="placeholder-text">
                  <h4>{panel.customTitle || panel.panelId}</h4>
                  <p>{panelTypeConfig.description}</p>
                </div>
                <div className="placeholder-info">
                  <small>
                    Position: ({panel.layout.x}, {panel.layout.y}) | 
                    Size: {panel.layout.w}×{panel.layout.h}
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resize Handles (for visual feedback) */}
      <div className="resize-handles" aria-hidden="true">
        <div className="resize-handle resize-handle-se"></div>
        <div className="resize-handle resize-handle-sw"></div>
        <div className="resize-handle resize-handle-ne"></div>
        <div className="resize-handle resize-handle-nw"></div>
      </div>

      {/* Loading/Error States */}
      {panel.config?.isLoading && (
        <div className="panel-overlay loading" role="status" aria-label="Loading panel content">
          <div className="loading-spinner"></div>
          <span>Loading...</span>
        </div>
      )}

      {panel.config?.hasError && (
        <div className="panel-overlay error" role="alert" aria-label="Panel error">
          <div className="error-icon">⚠️</div>
          <span>Error loading panel</span>
        </div>
      )}
    </div>
  );
};

export default GridPanel;