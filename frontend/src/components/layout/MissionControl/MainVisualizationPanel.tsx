/**
 * MainVisualizationPanel Component
 * 
 * Primary 3D visualization panel for the Mission Control Center that occupies 60% of screen
 * in desktop view. Provides mission-critical 3D visualization, mapping, and data views
 * with enterprise-grade accessibility and performance features.
 * 
 * Features:
 * - Three.js integration placeholder for 3D rover visualization
 * - Drag-and-drop interactions for enhanced UX
 * - Context menu with panel options (fullscreen, settings, export)
 * - WCAG 2.1 AA accessibility compliance
 * - Multiple visualization modes (3D, Map, Data)
 * - Responsive behavior across different screen sizes
 * - Integration with existing Grid system
 * - Proper ARIA labels and landmarks
 * - Keyboard navigation support
 * 
 * @author Mission Control UI Team
 * @version 1.0.0
 */

import React, { 
  useState, 
  useEffect, 
  useRef, 
  useCallback, 
  useMemo,
  KeyboardEvent,
  MouseEvent,
  DragEvent
} from 'react';
import { Button, Card, Select, Tooltip } from '../../ui/core';
import { useTheme } from '../../../theme/ThemeProvider';
import { PanelProps } from '../../../types/grid';
import RoverVisualization3D from './RoverVisualization3D';

// ========== TypeScript Interfaces ==========

/**
 * Supported visualization modes for the main panel
 */
export type VisualizationMode = '3d' | 'map' | 'data';

/**
 * Three.js placeholder container configuration
 */
export interface ThreeJSConfig {
  enableOrbitControls: boolean;
  enableGrid: boolean;
  enableAxes: boolean;
  backgroundColor: string;
  cameraPosition: [number, number, number];
  fieldOfView: number;
}

/**
 * Context menu item configuration
 */
export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  action: () => void;
  submenu?: ContextMenuItem[];
}

/**
 * Drag and drop interaction configuration
 */
export interface DragDropConfig {
  enableDragToReposition: boolean;
  enableDropZones: boolean;
  dragThreshold: number;
  snapToGrid: boolean;
}

/**
 * Props for the MainVisualizationPanel component
 */
export interface MainVisualizationPanelProps extends PanelProps {
  /** Current visualization mode */
  mode?: VisualizationMode;
  /** Callback when mode changes */
  onModeChange?: (mode: VisualizationMode) => void;
  /** Three.js configuration */
  threeJSConfig?: Partial<ThreeJSConfig>;
  /** Drag and drop configuration */
  dragDropConfig?: Partial<DragDropConfig>;
  /** Custom context menu items */
  customContextMenuItems?: ContextMenuItem[];
  /** Whether panel is in fullscreen mode */
  isFullscreen?: boolean;
  /** Callback for fullscreen toggle */
  onFullscreenToggle?: () => void;
  /** Loading state */
  isLoading?: boolean;
  /** Error state */
  error?: string;
  /** Data for visualization */
  visualizationData?: any;
  /** Custom CSS class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Responsive breakpoints for panel sizing
 */
const RESPONSIVE_BREAKPOINTS = {
  desktop: 1200,
  tablet: 768,
  mobile: 480
} as const;

/**
 * Default Three.js configuration
 */
const DEFAULT_THREEJS_CONFIG: ThreeJSConfig = {
  enableOrbitControls: true,
  enableGrid: true,
  enableAxes: true,
  backgroundColor: '#1a1a1a',
  cameraPosition: [10, 10, 10],
  fieldOfView: 75
};

/**
 * Default drag and drop configuration
 */
const DEFAULT_DRAGDROP_CONFIG: DragDropConfig = {
  enableDragToReposition: true,
  enableDropZones: true,
  dragThreshold: 5,
  snapToGrid: false
};

// ========== Main Component ==========

/**
 * MainVisualizationPanel - Primary 3D visualization panel for Mission Control
 * 
 * This component serves as the central visualization hub for rover operations,
 * providing multiple view modes and enterprise-grade features for mission-critical
 * operations.
 */
export const MainVisualizationPanel: React.FC<MainVisualizationPanelProps> = ({
  id,
  mode = '3d',
  onModeChange,
  threeJSConfig = {},
  dragDropConfig = {},
  customContextMenuItems = [],
  isFullscreen = false,
  onFullscreenToggle,
  isLoading = false,
  error,
  visualizationData,
  className = '',
  testId = 'main-visualization-panel',
  isMinimized = false,
  onMinimize,
  onMaximize,
  onClose,
  onSettings,
  theme,
  config = {},
  layout,
  gridRef
}) => {
  // ========== State Management ==========
  const [currentMode, setCurrentMode] = useState<VisualizationMode>(mode);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  const [screenSize, setScreenSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  // ========== Refs ==========
  const panelRef = useRef<HTMLDivElement>(null);
  const threeJSContainerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // ========== Hooks ==========
  const currentTheme = useTheme();

  // ========== Computed Values ==========
  const mergedThreeJSConfig = useMemo(() => ({
    ...DEFAULT_THREEJS_CONFIG,
    ...threeJSConfig
  }), [threeJSConfig]);

  const mergedDragDropConfig = useMemo(() => ({
    ...DEFAULT_DRAGDROP_CONFIG,
    ...dragDropConfig
  }), [dragDropConfig]);

  // ========== Screen Size Detection ==========
  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      if (width >= RESPONSIVE_BREAKPOINTS.desktop) {
        setScreenSize('desktop');
      } else if (width >= RESPONSIVE_BREAKPOINTS.tablet) {
        setScreenSize('tablet');
      } else {
        setScreenSize('mobile');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  // ========== Context Menu Items ==========
  const defaultContextMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      id: 'fullscreen',
      label: isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen',
      icon: '⛶',
      shortcut: 'F11',
      action: () => {
        onFullscreenToggle?.();
        setContextMenuVisible(false);
      }
    },
    {
      id: 'separator-1',
      label: '---',
      action: () => {}
    },
    {
      id: 'settings',
      label: 'Panel Settings',
      icon: '⚙️',
      shortcut: 'Ctrl+,',
      action: () => {
        onSettings?.();
        setContextMenuVisible(false);
      }
    },
    {
      id: 'export',
      label: 'Export View',
      icon: '💾',
      submenu: [
        {
          id: 'export-image',
          label: 'Export as Image',
          action: () => {
            // TODO: Implement image export
            console.log('Export as image');
            setContextMenuVisible(false);
          }
        },
        {
          id: 'export-data',
          label: 'Export Data',
          action: () => {
            // TODO: Implement data export
            console.log('Export data');
            setContextMenuVisible(false);
          }
        }
      ],
      action: () => {}
    },
    {
      id: 'separator-2',
      label: '---',
      action: () => {}
    },
    {
      id: 'reset',
      label: 'Reset View',
      icon: '🔄',
      shortcut: 'Ctrl+R',
      action: () => {
        // TODO: Implement view reset
        console.log('Reset view');
        setContextMenuVisible(false);
      }
    }
  ], [isFullscreen, onFullscreenToggle, onSettings]);

  const contextMenuItems = useMemo(() => [
    ...defaultContextMenuItems,
    ...customContextMenuItems
  ], [defaultContextMenuItems, customContextMenuItems]);

  // ========== Event Handlers ==========

  /**
   * Handle mode change from UI controls
   */
  const handleModeChange = useCallback((newMode: VisualizationMode) => {
    setCurrentMode(newMode);
    onModeChange?.(newMode);
    
    // Announce change to screen readers
    const announcement = `Visualization mode changed to ${newMode}`;
    const ariaLiveRegion = document.getElementById('aria-announcements');
    if (ariaLiveRegion) {
      ariaLiveRegion.textContent = announcement;
    }
  }, [onModeChange]);

  /**
   * Handle context menu display
   */
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuVisible(true);
  }, []);

  /**
   * Handle drag start
   */
  const handleDragStart = useCallback((event: DragEvent) => {
    if (!mergedDragDropConfig.enableDragToReposition) return;
    
    setIsDragging(true);
    setDragStartPosition({ x: event.clientX, y: event.clientY });
    
    // Set drag data for accessibility
    event.dataTransfer.setData('text/plain', 'visualization-panel');
    event.dataTransfer.effectAllowed = 'move';
  }, [mergedDragDropConfig.enableDragToReposition]);

  /**
   * Handle drag end
   */
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'F11':
        event.preventDefault();
        onFullscreenToggle?.();
        break;
      case 'Escape':
        if (contextMenuVisible) {
          setContextMenuVisible(false);
        } else if (isFullscreen) {
          onFullscreenToggle?.();
        }
        break;
      case '1':
        if (event.ctrlKey) {
          event.preventDefault();
          handleModeChange('3d');
        }
        break;
      case '2':
        if (event.ctrlKey) {
          event.preventDefault();
          handleModeChange('map');
        }
        break;
      case '3':
        if (event.ctrlKey) {
          event.preventDefault();
          handleModeChange('data');
        }
        break;
      case 'r':
        if (event.ctrlKey) {
          event.preventDefault();
          // TODO: Reset view
          console.log('Reset view via keyboard');
        }
        break;
    }
  }, [contextMenuVisible, isFullscreen, onFullscreenToggle, handleModeChange]);

  // ========== Effects ==========

  /**
   * Handle clicks outside context menu to close it
   */
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuVisible(false);
      }
    };

    if (contextMenuVisible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuVisible]);

  /**
   * Handle Three.js container resize
   */
  useEffect(() => {
    if (currentMode === '3d' && threeJSContainerRef.current) {
      // The RoverVisualization3D component handles its own resizing
      // This effect is kept for potential future use
    }
  }, [currentMode]);

  // ========== Render Helpers ==========

  /**
   * Render mode selection controls
   */
  const renderModeControls = () => (
    <div 
      className="visualization-mode-controls"
      role="tablist"
      aria-label="Visualization mode selection"
    >
      {(['3d', 'map', 'data'] as const).map((modeOption) => (
        <Button
          key={modeOption}
          variant={currentMode === modeOption ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => handleModeChange(modeOption)}
          role="tab"
          aria-selected={currentMode === modeOption}
          aria-controls={`${id}-${modeOption}-panel`}
          id={`${id}-${modeOption}-tab`}
          className="mode-control-button"
        >
          {modeOption.toUpperCase()}
        </Button>
      ))}
    </div>
  );

  /**
   * Render context menu
   */
  const renderContextMenu = () => {
    if (!contextMenuVisible) return null;

    return (
      <div
        ref={contextMenuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          left: contextMenuPosition.x,
          top: contextMenuPosition.y,
          zIndex: 1000
        }}
        role="menu"
        aria-label="Visualization panel options"
      >
        <Card className="context-menu-card">
          {contextMenuItems.map((item) => {
            if (item.label === '---') {
              return <div key={item.id} className="context-menu-separator" role="separator" />;
            }

            return (
              <button
                key={item.id}
                className="context-menu-item"
                onClick={item.action}
                disabled={item.disabled}
                role="menuitem"
                aria-label={item.label}
              >
                {item.icon && <span className="context-menu-icon">{item.icon}</span>}
                <span className="context-menu-label">{item.label}</span>
                {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
              </button>
            );
          })}
        </Card>
      </div>
    );
  };

  /**
   * Render Three.js visualization container
   */
  const renderThreeJSContainer = () => {
    // Mock rover data for demonstration
    const mockRoverData = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      speed: 2.5,
      battery: 85,
      signalStrength: 92,
      status: 'moving' as const
    };
    
    // Mock trajectory data
    const mockTrajectoryData = Array.from({ length: 50 }, (_, i) => ({
      timestamp: Date.now() - (50 - i) * 1000,
      x: Math.sin(i * 0.1) * 10,
      y: 0,
      z: i * 0.5 - 25,
      heading: i * 0.1,
      speed: 2 + Math.random(),
      battery: 100 - i * 0.3,
      signalStrength: 95 - Math.random() * 10,
      status: 'moving' as const
    }));
    
    return (
      <div
        ref={threeJSContainerRef}
        className="threejs-container"
        style={{
          width: '100%',
          height: '100%',
          position: 'relative'
        }}
      >
        <RoverVisualization3D
          roverData={mockRoverData}
          trajectoryData={mockTrajectoryData}
          showStats={process.env.NODE_ENV === 'development'}
          enableEffects={true}
          cameraConfig={{
            position: mergedThreeJSConfig.cameraPosition,
            fov: mergedThreeJSConfig.fieldOfView,
            near: 0.1,
            far: 1000
          }}
          lightingConfig={{
            ambientIntensity: 0.4,
            directionalIntensity: 1,
            enableShadows: true
          }}
          onSceneReady={(scene) => {
            console.log('3D scene ready', scene);
          }}
        />
      </div>
    );
  };

  /**
   * Render content based on current mode
   */
  const renderVisualizationContent = () => {
    if (isLoading) {
      return (
        <div className="loading-container" role="status" aria-label="Loading visualization">
          <div className="loading-spinner" />
          <div>Loading visualization...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container" role="alert" aria-label="Visualization error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">{error}</div>
          <Button onClick={() => window.location.reload()} size="sm">
            Retry
          </Button>
        </div>
      );
    }

    switch (currentMode) {
      case '3d':
        return renderThreeJSContainer();
      case 'map':
        return (
          <div className="map-container" role="img" aria-label="Map view of rover location">
            <div className="map-placeholder">
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                <div>Map Visualization</div>
                <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>
                  Geographic mapping integration ready
                </div>
              </div>
            </div>
          </div>
        );
      case 'data':
        return (
          <div className="data-container" role="region" aria-label="Data visualization charts">
            <div className="data-placeholder">
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
                <div>Data Visualization</div>
                <div style={{ fontSize: '14px', opacity: 0.7, marginTop: '8px' }}>
                  Charts and metrics dashboard ready
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // ========== Minimized State ==========
  if (isMinimized) {
    return (
      <div 
        className={`main-visualization-panel minimized ${className}`}
        data-testid={`${testId}-minimized`}
      >
        <div className="minimized-content">
          <span className="minimized-icon">🚀</span>
          <span className="minimized-label">3D Viz</span>
        </div>
      </div>
    );
  }

  // ========== Main Render ==========
  return (
    <>
      {/* ARIA live region for announcements */}
      <div 
        id="aria-announcements" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      />

      <div
        ref={panelRef}
        className={`main-visualization-panel ${isFullscreen ? 'fullscreen' : ''} ${isDragging ? 'dragging' : ''} ${className}`}
        data-testid={testId}
        role="main"
        aria-label="Main visualization panel"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        draggable={mergedDragDropConfig.enableDragToReposition}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        style={{
          width: screenSize === 'desktop' ? '60%' : '100%',
          height: isFullscreen ? '100vh' : 'auto',
          minHeight: '400px'
        }}
      >
        {/* Panel Header */}
        <div className="panel-header" role="banner">
          <div className="panel-title-section">
            <h2 className="panel-title">Mission Visualization</h2>
            <div className="panel-subtitle">
              Real-time 3D rover visualization and mission data
            </div>
          </div>
          
          {renderModeControls()}
          
          <div className="panel-actions">
            <Tooltip content="Panel settings">
              <Button
                variant="ghost"
                size="sm"
                onClick={onSettings}
                aria-label="Open panel settings"
              >
                ⚙️
              </Button>
            </Tooltip>
            
            <Tooltip content={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}>
              <Button
                variant="ghost"
                size="sm"
                onClick={onFullscreenToggle}
                aria-label={isFullscreen ? "Exit fullscreen mode" : "Enter fullscreen mode"}
              >
                {isFullscreen ? '⛶' : '⛶'}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Main Content Area */}
        <div 
          className="panel-content"
          role="tabpanel"
          aria-labelledby={`${id}-${currentMode}-tab`}
          id={`${id}-${currentMode}-panel`}
        >
          {renderVisualizationContent()}
        </div>

        {/* Status Bar */}
        <div className="panel-status-bar" role="complementary">
          <div className="status-item">
            <span className="status-label">Mode:</span>
            <span className="status-value">{currentMode.toUpperCase()}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Screen:</span>
            <span className="status-value">{screenSize}</span>
          </div>
          {visualizationData && (
            <div className="status-item">
              <span className="status-label">Data Points:</span>
              <span className="status-value">{Object.keys(visualizationData).length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {renderContextMenu()}
    </>
  );
};

export default MainVisualizationPanel;