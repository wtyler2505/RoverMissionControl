/**
 * Mission Control Layout - Main Container Component
 * Comprehensive CSS Grid-based layout system with presets, keyboard navigation, and accessibility
 */

import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { styled, css } from '@emotion/react';
import { useMissionControl } from './MissionControlContext';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useTheme } from '../../../theme/ThemeProvider';
import { MissionControlLayoutProps, LayoutPreset } from './types';
import { Breakpoint } from '../../../types/grid';

// Import all Mission Control components
import { MainVisualizationPanel, VisualizationMode } from './MainVisualizationPanel';
import { TelemetrySidebar, TelemetryData, SystemStatusItem, QuickAction } from './TelemetrySidebar';
import { CommandBar } from './CommandBar';
import { StatusBar, StatusBarProvider } from './StatusBar';
import { AlertCenter } from './AlertCenter';
import { Timeline, TimelineEvent, TimelineFilter } from './Timeline';
import { MiniMap, Position, PointOfInterest } from './MiniMap';
import { QuickToolbar, ToolAction } from './QuickToolbar';

// Styled components
const LayoutContainer = styled.div<{
  preset: LayoutPreset;
  isTransitioning: boolean;
  animationsEnabled: boolean;
  highContrast: boolean;
}>`
  display: grid;
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  
  /* CSS Grid template is set dynamically via style prop */
  gap: 8px;
  padding: 8px;
  
  /* Smooth transitions between layouts */
  ${({ isTransitioning, animationsEnabled }) =>
    isTransitioning && animationsEnabled &&
    css`
      * {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
    `}
  
  /* High contrast mode */
  ${({ highContrast, theme }) =>
    highContrast &&
    css`
      filter: contrast(1.5);
      
      * {
        border-color: ${theme.colors.text} !important;
      }
    `}
  
  /* Focus management */
  &:focus-within {
    outline: none;
  }
  
  /* Responsive behavior */
  @media (max-width: 1366px) {
    gap: 6px;
    padding: 6px;
  }
  
  @media (max-width: 1024px) {
    gap: 4px;
    padding: 4px;
  }
  
  @media (max-width: 768px) {
    gap: 2px;
    padding: 2px;
  }
`;

const LayoutArea = styled.div<{
  gridArea: string;
  isVisible: boolean;
  isCollapsible: boolean;
  priority: number;
  minWidth?: string;
  minHeight?: string;
  animationsEnabled: boolean;
}>`
  grid-area: ${({ gridArea }) => gridArea};
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  
  /* Visibility and collapsing */
  ${({ isVisible, animationsEnabled }) =>
    !isVisible &&
    css`
      display: none;
      
      ${animationsEnabled &&
      css`
        animation: areaCollapse 0.2s ease-out;
      `}
    `}
  
  /* Minimum dimensions */
  ${({ minWidth }) => minWidth && css`min-width: ${minWidth};`}
  ${({ minHeight }) => minHeight && css`min-height: ${minHeight};`}
  
  /* Focus management */
  &:focus-within {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary}20;
  }
  
  /* Responsive priority-based hiding */
  @media (max-width: 1366px) {
    ${({ priority }) =>
      priority > 3 &&
      css`
        display: none;
      `}
  }
  
  @media (max-width: 1024px) {
    ${({ priority }) =>
      priority > 2 &&
      css`
        display: none;
      `}
  }
  
  @media (max-width: 768px) {
    ${({ priority }) =>
      priority > 1 &&
      css`
        display: none;
      `}
  }
`;

const LayoutPresetSelector = styled.div`
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1000;
  display: flex;
  gap: 8px;
  
  button {
    padding: 8px 16px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.2s ease;
    
    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      border-color: ${({ theme }) => theme.colors.primary};
    }
    
    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 2px;
    }
    
    &.active {
      background: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.primaryText};
      border-color: ${({ theme }) => theme.colors.primary};
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
`;

const AccessibilityAnnouncer = styled.div`
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
`;

// Animation keyframes
const globalStyles = css`
  @keyframes areaCollapse {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.95);
    }
  }
  
  @keyframes areaExpand {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

/**
 * Main Mission Control Layout Component
 */
export const MissionControlLayout: React.FC<MissionControlLayoutProps> = ({
  initialPreset = 'operations',
  customPresets = [],
  onPresetChange,
  onPanelFocus,
  onLayoutEvent,
  className = '',
  'data-testid': dataTestId = 'mission-control-layout',
  children
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('lg');
  
  const {
    state,
    configurations,
    setPreset,
    toggleArea,
    focusPanel,
    announceToScreenReader
  } = useMissionControl();

  // Component state management - integrated with MissionControl context
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('3d');
  const [telemetryCollapsed, setTelemetryCollapsed] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<[Date, Date]>([
    new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    new Date()
  ]);

  // Real-time data state (in real app, this would come from WebSocket/API)
  const [realTimeData, setRealTimeData] = useState({
    roverPosition: { x: 125.5, y: 87.3 },
    batteryLevel: 87,
    signalStrength: 95,
    systemHealth: 'normal' as 'normal' | 'warning' | 'critical',
    isConnected: true,
    lastUpdate: new Date()
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        ...prev,
        batteryLevel: Math.max(0, prev.batteryLevel - Math.random() * 0.1),
        signalStrength: Math.max(0, Math.min(100, prev.signalStrength + (Math.random() - 0.5) * 5)),
        roverPosition: {
          x: prev.roverPosition.x + (Math.random() - 0.5) * 2,
          y: prev.roverPosition.y + (Math.random() - 0.5) * 2
        },
        lastUpdate: new Date()
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Integration with layout context for component focusing
  const handleComponentInteraction = useCallback((componentId: string, interactionType: 'focus' | 'click' | 'keyboard') => {
    handlePanelFocus(componentId, interactionType === 'keyboard' ? 'keyboard' : 'mouse');
    
    // Emit layout event
    onLayoutEvent?.({
      type: 'panel-focus',
      payload: { componentId, interactionType },
      timestamp: Date.now(),
      source: 'user'
    });
  }, [handlePanelFocus, onLayoutEvent]);

  // Generate telemetry data from real-time state
  const telemetryData: TelemetryData[] = useMemo(() => [
    { 
      id: '1', 
      label: 'Battery Level', 
      value: Math.round(realTimeData.batteryLevel), 
      unit: '%', 
      status: realTimeData.batteryLevel > 50 ? 'normal' : realTimeData.batteryLevel > 20 ? 'warning' : 'critical', 
      timestamp: realTimeData.lastUpdate 
    },
    { 
      id: '2', 
      label: 'Signal Strength', 
      value: Math.round(realTimeData.signalStrength), 
      unit: '%', 
      status: realTimeData.signalStrength > 70 ? 'normal' : realTimeData.signalStrength > 30 ? 'warning' : 'critical', 
      timestamp: realTimeData.lastUpdate 
    },
    { id: '3', label: 'Temperature', value: 23.5, unit: '°C', status: 'warning', timestamp: realTimeData.lastUpdate },
    { id: '4', label: 'Position X', value: realTimeData.roverPosition.x.toFixed(1), unit: 'm', status: 'normal', timestamp: realTimeData.lastUpdate },
    { id: '5', label: 'Position Y', value: realTimeData.roverPosition.y.toFixed(1), unit: 'm', status: 'normal', timestamp: realTimeData.lastUpdate }
  ], [realTimeData]);

  const systemStatus: SystemStatusItem[] = useMemo(() => [
    { 
      id: '1', 
      system: 'Navigation', 
      status: 'online', 
      message: `Position: ${realTimeData.roverPosition.x.toFixed(1)}, ${realTimeData.roverPosition.y.toFixed(1)}` 
    },
    { 
      id: '2', 
      system: 'Communications', 
      status: realTimeData.isConnected ? 'online' : 'offline', 
      message: `Signal: ${Math.round(realTimeData.signalStrength)}%` 
    },
    { 
      id: '3', 
      system: 'Power', 
      status: realTimeData.batteryLevel > 50 ? 'online' : realTimeData.batteryLevel > 20 ? 'warning' : 'critical', 
      message: `Battery: ${Math.round(realTimeData.batteryLevel)}%`, 
      alerts: realTimeData.batteryLevel < 50 ? 1 : 0 
    },
    { id: '4', system: 'Sensors', status: 'online', message: '12 sensors active' }
  ], [realTimeData]);

  const mockTimelineEvents: TimelineEvent[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      title: 'Mission Start',
      description: 'Rover mission commenced',
      category: 'mission',
      importance: 'high',
      data: {}
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
      title: 'Sample Collection',
      description: 'Soil sample collected at waypoint Alpha',
      category: 'science',
      importance: 'medium',
      data: { sampleId: 'ALPHA_001' }
    }
  ];

  const pointsOfInterest: PointOfInterest[] = useMemo(() => [
    { id: '1', position: { x: 100, y: 100 }, label: 'Landing Site', type: 'landmark' },
    { id: '2', position: { x: 150, y: 90 }, label: 'Sample Alpha', type: 'sample' },
    { id: '3', position: { x: 200, y: 120 }, label: 'Hazard Zone', type: 'hazard' }
  ], []);

  const mockQuickActions: QuickAction[] = [
    {
      id: '1',
      label: 'Emergency Stop',
      icon: <span>🛑</span>,
      action: () => console.log('Emergency stop activated')
    },
    {
      id: '2',
      label: 'Take Photo',
      icon: <span>📷</span>,
      action: () => console.log('Photo captured')
    }
  ];

  const mockToolActions: ToolAction[] = [
    {
      id: 'move',
      label: 'Move Rover',
      icon: <span>🚀</span>,
      category: 'navigation',
      action: () => console.log('Move tool activated'),
      isActive: false,
      state: 'enabled'
    },
    {
      id: 'sample',
      label: 'Collect Sample',
      icon: <span>🧪</span>,
      category: 'science',
      action: () => console.log('Sample collection activated'),
      isActive: false,
      state: 'enabled'
    }
  ];

  // Initialize keyboard shortcuts
  useKeyboardShortcuts({
    enabled: state.preferences.keyboardNavigation,
    globalShortcuts: true
  });

  const currentConfig = configurations[state.currentPreset];

  // Responsive breakpoint detection
  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= 1920) setCurrentBreakpoint('lg');
      else if (width >= 1366) setCurrentBreakpoint('md');
      else if (width >= 1024) setCurrentBreakpoint('sm');
      else if (width >= 768) setCurrentBreakpoint('xs');
      else setCurrentBreakpoint('xxs');
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  // Get responsive grid template for current breakpoint
  const gridTemplate = useMemo(() => {
    const responsive = currentConfig.responsive[currentBreakpoint];
    return responsive || currentConfig.gridTemplate;
  }, [currentConfig, currentBreakpoint]);

  // Get visible areas for current breakpoint
  const visibleAreas = useMemo(() => {
    const responsive = currentConfig.responsive[currentBreakpoint];
    const hiddenAreas = responsive?.hiddenAreas || [];
    
    return currentConfig.areas.filter(area => 
      state.activeAreas.includes(area.id) && 
      !hiddenAreas.includes(area.id)
    );
  }, [currentConfig, currentBreakpoint, state.activeAreas]);

  // Handle preset change
  const handlePresetChange = useCallback(async (preset: LayoutPreset) => {
    await setPreset(preset);
    onPresetChange?.(preset);
    
    // Emit layout event
    onLayoutEvent?.({
      type: 'preset-change',
      payload: { from: state.currentPreset, to: preset },
      timestamp: Date.now(),
      source: 'user'
    });
  }, [setPreset, onPresetChange, onLayoutEvent, state.currentPreset]);

  // Handle area toggle
  const handleAreaToggle = useCallback((areaId: string) => {
    toggleArea(areaId);
    
    onLayoutEvent?.({
      type: state.activeAreas.includes(areaId) ? 'area-collapse' : 'area-expand',
      payload: { areaId },
      timestamp: Date.now(),
      source: 'user'
    });
  }, [toggleArea, state.activeAreas, onLayoutEvent]);

  // Handle panel focus
  const handlePanelFocus = useCallback((panelId: string, source: 'keyboard' | 'mouse' | 'programmatic') => {
    const area = currentConfig.areas.find(a => a.defaultPanels.includes(panelId));
    if (!area) return;

    focusPanel(panelId, source);
    
    onPanelFocus?.({
      panelId,
      areaId: area.id,
      timestamp: Date.now(),
      interactionType: source
    });
  }, [currentConfig, focusPanel, onPanelFocus]);

  // Render preset selector
  const renderPresetSelector = () => (
    <LayoutPresetSelector>
      {(['operations', 'analysis', 'emergency', 'maintenance'] as LayoutPreset[]).map((preset) => (
        <button
          key={preset}
          className={preset === state.currentPreset ? 'active' : ''}
          onClick={() => handlePresetChange(preset)}
          disabled={state.isTransitioning}
          title={`Switch to ${configurations[preset].name} layout (F${['operations', 'analysis', 'emergency', 'maintenance'].indexOf(preset) + 1})`}
          aria-label={`Switch to ${configurations[preset].name} layout`}
        >
          {configurations[preset].name}
        </button>
      ))}
    </LayoutPresetSelector>
  );

  // Render specific Mission Control components based on area
  const renderComponent = (area: any) => {
    const componentProps = {
      key: area.id,
      style: { 
        width: '100%', 
        height: '100%',
        position: 'relative' as const
      },
      'data-testid': `${area.id}-component`
    };

    switch (area.id) {
      case 'main-3d':
        return (
          <MainVisualizationPanel
            {...componentProps}
            mode={visualizationMode}
            onModeChange={(mode) => {
              setVisualizationMode(mode);
              handleComponentInteraction('main-3d', 'click');
            }}
            enableDragDrop={true}
            enableThreeJS={true}
            onPanelAction={(action) => {
              console.log('Panel action:', action);
              handleComponentInteraction('main-3d', 'click');
            }}
            className="main-visualization-panel"
            onFocus={() => handleComponentInteraction('main-3d', 'focus')}
          />
        );

      case 'sidebar':
        return (
          <TelemetrySidebar
            {...componentProps}
            defaultCollapsed={telemetryCollapsed}
            onCollapseChange={(collapsed) => {
              setTelemetryCollapsed(collapsed);
              handleComponentInteraction('sidebar', 'click');
            }}
            telemetryData={telemetryData}
            systemStatus={systemStatus}
            quickActions={mockQuickActions}
            className="telemetry-sidebar"
            onFocus={() => handleComponentInteraction('sidebar', 'focus')}
          />
        );

      case 'telemetry':
        return (
          <TelemetrySidebar
            {...componentProps}
            defaultCollapsed={false}
            telemetryData={telemetryData}
            systemStatus={systemStatus}
            showQuickActions={false}
            className="telemetry-panel"
            onFocus={() => handleComponentInteraction('telemetry', 'focus')}
          />
        );

      case 'timeline':
        return (
          <Timeline
            {...componentProps}
            events={mockTimelineEvents}
            timeRange={selectedTimeRange}
            onTimeRangeChange={(range) => {
              setSelectedTimeRange(range);
              handleComponentInteraction('timeline', 'click');
            }}
            onPlaybackControl={(action) => {
              console.log('Playback:', action);
              handleComponentInteraction('timeline', 'click');
            }}
            enableAnnotations={true}
            className="timeline-panel"
            onFocus={() => handleComponentInteraction('timeline', 'focus')}
          />
        );

      case 'status':
        return (
          <div {...componentProps} className="status-area">
            <MiniMap
              roverPosition={realTimeData.roverPosition}
              pointsOfInterest={pointsOfInterest}
              onPositionClick={(pos) => {
                console.log('Map clicked:', pos);
                handleComponentInteraction('status', 'click');
              }}
              viewMode="satellite"
              showCompass={true}
              className="minimap-component"
              style={{ height: '50%' }}
              onFocus={() => handleComponentInteraction('status', 'focus')}
            />
            <div style={{ height: '50%', padding: '8px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>System Status</h3>
              {systemStatus.map(status => (
                <div key={status.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
                onClick={() => handleComponentInteraction('status', 'click')}
                >
                  <span>{status.system}</span>
                  <span style={{ 
                    color: status.status === 'online' ? '#10b981' : 
                          status.status === 'warning' ? '#f59e0b' : '#ef4444'
                  }}>
                    {status.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'tools':
      case 'diagnostics':
        return (
          <QuickToolbar
            {...componentProps}
            actions={mockToolActions}
            layout="grid"
            onActionExecute={(action) => console.log('Tool executed:', action)}
            className="quick-toolbar"
          />
        );

      case 'charts':
      case 'hardware':
      case 'firmware':
        return (
          <div {...componentProps} className={`${area.id}-panel`}>
            <div style={{ padding: '16px', height: '100%' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                {area.name}
              </h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                height: 'calc(100% - 40px)'
              }}>
                {mockTelemetryData.map(data => (
                  <div key={data.id} style={{
                    padding: '12px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '8px',
                    background: '#f9f9f9'
                  }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>{data.label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0' }}>
                      {data.value}{data.unit}
                    </div>
                    <div style={{ 
                      fontSize: '11px',
                      color: data.status === 'normal' ? '#10b981' : 
                            data.status === 'warning' ? '#f59e0b' : '#ef4444'
                    }}>
                      {data.status.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'alerts':
        return (
          <AlertCenter
            {...componentProps}
            className="alert-center"
          />
        );

      case 'data':
      case 'logs':
      case 'comms':
        return (
          <div {...componentProps} className={`${area.id}-panel`}>
            <div style={{ padding: '16px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
                {area.name}
              </h3>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {area.description || `${area.name} panel content will be displayed here.`}
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div {...componentProps} className={`${area.id}-panel default-panel`}>
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>{area.name}</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
                Component for {area.name} will be rendered here
              </p>
            </div>
          </div>
        );
    }
  };

  // Render layout areas with specific components
  const renderAreas = () => {
    return visibleAreas.map((area) => (
      <LayoutArea
        key={area.id}
        gridArea={area.gridArea}
        isVisible={state.activeAreas.includes(area.id)}
        isCollapsible={area.isCollapsible || false}
        priority={area.priority}
        minWidth={area.minWidth}
        minHeight={area.minHeight}
        animationsEnabled={state.preferences.animationsEnabled}
        role="region"
        aria-label={area.name}
        aria-describedby={`${area.id}-description`}
        tabIndex={-1}
        onFocus={() => {
          if (area.defaultPanels.length > 0) {
            handlePanelFocus(area.defaultPanels[0], 'keyboard');
          }
        }}
      >
        {/* Hidden description for screen readers */}
        <div id={`${area.id}-description`} className="sr-only">
          {`${area.name} area containing ${area.defaultPanels.join(', ')} panels`}
        </div>
        
        {/* Area header with collapse toggle */}
        {area.isCollapsible && (
          <div style={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            zIndex: 10 
          }}>
            <button
              onClick={() => handleAreaToggle(area.id)}
              aria-label={`${state.activeAreas.includes(area.id) ? 'Collapse' : 'Expand'} ${area.name} area`}
              style={{
                padding: '4px 8px',
                border: `1px solid ${theme.theme.colors.border}`,
                background: theme.theme.colors.surface,
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {state.activeAreas.includes(area.id) ? '−' : '+'}
            </button>
          </div>
        )}
        
        {/* Render the specific component for this area */}
        {renderComponent(area)}
      </LayoutArea>
    ));
  };

  return (
    <StatusBarProvider
      defaultConfiguration={{
        position: 'top',
        compact: currentBreakpoint === 'xs' || currentBreakpoint === 'xxs',
        emergencyMode: state.currentPreset === 'emergency',
        enabledWidgets: ['connection', 'system-health', 'mission', 'command-queue', 'notifications']
      }}
    >
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        {/* Fixed Status Bar */}
        <StatusBar 
          position="top"
          onStatusUpdate={(event) => console.log('Status update:', event)}
          className="mission-control-statusbar"
        />

        {/* Main Layout Container */}
        <LayoutContainer
          ref={containerRef}
          preset={state.currentPreset}
          isTransitioning={state.isTransitioning}
          animationsEnabled={state.preferences.animationsEnabled}
          highContrast={state.preferences.highContrast}
          className={`mission-control-layout ${className}`}
          data-testid={dataTestId}
          data-preset={state.currentPreset}
          data-breakpoint={currentBreakpoint}
          role="application"
          aria-label="Mission Control Center"
          aria-describedby="layout-description"
          style={{
            gridTemplateAreas: gridTemplate.areas,
            gridTemplateColumns: gridTemplate.columns,
            gridTemplateRows: gridTemplate.rows,
            paddingTop: '60px', // Account for status bar
            paddingBottom: '80px', // Account for command bar
            height: 'calc(100vh - 140px)' // Total height minus bars
          }}
          tabIndex={0}
          onKeyDown={(e) => {
            // Handle emergency shortcuts
            if (e.key === 'F3' || (e.ctrlKey && e.key === 'e')) {
              e.preventDefault();
              handlePresetChange('emergency');
              
              announceToScreenReader({
                message: 'Emergency layout activated',
                priority: 'high',
                type: 'alert'
              });
            }
          }}
        >
          {/* Hidden description for screen readers */}
          <div id="layout-description" className="sr-only">
            {`Mission Control Center in ${currentConfig.name} layout. ${currentConfig.description}. Use F1-F4 to switch layouts, Ctrl+1-9 to focus panels, Alt+1-9 to toggle areas.`}
          </div>

          {/* Accessibility announcer */}
          <AccessibilityAnnouncer
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="accessibility-announcer"
          />

          {/* Preset selector */}
          {renderPresetSelector()}

          {/* Layout areas */}
          {renderAreas()}

          {/* Custom children */}
          {children}

          {/* Global styles */}
          <style>{globalStyles}</style>
        </LayoutContainer>

        {/* Fixed Command Bar */}
        <CommandBar
          connectionStatus={{
            isConnected: realTimeData.isConnected,
            signalStrength: realTimeData.signalStrength,
            latency: 45,
            lastUpdate: realTimeData.lastUpdate
          }}
          queueStatus={{
            pending: 2,
            executing: 1,
            completed: 15,
            failed: 0
          }}
          onExecuteCommand={async (command, params) => {
            console.log('Executing command:', command, params);
            handleComponentInteraction('command-bar', 'click');
            
            // Simulate command execution
            announceToScreenReader({
              message: `Command ${command} executed`,
              priority: 'medium',
              type: 'status'
            });
          }}
          onConfirmCommand={async (command, params) => {
            console.log('Confirming command:', command, params);
            handleComponentInteraction('command-bar', 'click');
            return confirm(`Execute ${command.name}?`);
          }}
          className="mission-control-commandbar"
        />
      </div>
    </StatusBarProvider>
  );
};

// Export with display name
MissionControlLayout.displayName = 'MissionControlLayout';

export default MissionControlLayout;