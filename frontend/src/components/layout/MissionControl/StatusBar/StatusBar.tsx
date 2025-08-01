/**
 * Mission Control Status Bar
 * Fixed position status bar displaying real-time system feedback
 * Configurable widgets with live WebSocket updates
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { useTheme } from '@emotion/react';
import { 
  StatusBarProps, 
  StatusBarData, 
  StatusBarConfiguration, 
  StatusBarContextValue,
  StatusUpdateEvent,
  DEFAULT_CONFIGURATION,
  NotificationData,
  SystemHealthData,
  ConnectionStatusData,
  CommandQueueData,
  MissionData,
  PowerStatusData
} from './types';

// Widget Components
import { ConnectionStatus } from './widgets/ConnectionStatus';
import { SystemHealth } from './widgets/SystemHealth';
import { MissionStatus } from './widgets/MissionStatus';
import { CommandQueue } from './widgets/CommandQueue';
import { NotificationCenter } from './widgets/NotificationCenter';

const StatusBarContainer = styled.div<{ 
  theme: Theme; 
  position: 'top' | 'bottom'; 
  compact: boolean;
  emergencyMode: boolean;
}>`
  position: fixed;
  ${({ position }) => position === 'top' ? 'top: 0' : 'bottom: 0'};
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.zIndex?.fixed || 1030};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-${({ position }) => position === 'top' ? 'bottom' : 'top'}: 1px solid ${({ theme }) => theme.colors.divider};
  backdrop-filter: blur(8px);
  transition: ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  
  ${({ compact, theme }) => compact ? css`
    height: 40px;
    padding: 0 ${theme.spacing[3]};
  ` : css`
    height: 60px;
    padding: 0 ${theme.spacing[4]};
  `}
  
  ${({ emergencyMode, theme }) => emergencyMode && css`
    background-color: ${theme.colors.emergency}10;
    border-color: ${theme.colors.emergency}40;
    box-shadow: 0 0 20px ${theme.colors.emergency}20;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, 
        ${theme.colors.emergency} 0%, 
        transparent 50%, 
        ${theme.colors.emergency} 100%);
      animation: emergencyGlow 2s ease-in-out infinite alternate;
    }
    
    @keyframes emergencyGlow {
      0% { opacity: 0.3; }
      100% { opacity: 1; }
    }
    
    @media (prefers-reduced-motion: reduce) {
      &::before {
        animation: none;
        opacity: 0.7;
      }
    }
  `}
  
  @media (prefers-contrast: high) {
    border-width: 2px;
    backdrop-filter: none;
    background-color: ${({ theme }) => theme.colors.background.paper};
  }
  
  @media (max-width: 768px) {
    padding: 0 ${({ theme }) => theme.spacing[2]};
  }
`;

const StatusBarContent = styled.div<{ theme: Theme; compact: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  max-width: 1920px;
  margin: 0 auto;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const WidgetSection = styled.div<{ theme: Theme; alignment: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  
  ${({ alignment }) => {
    switch (alignment) {
      case 'left':
        return css`
          flex: 0 0 auto;
          justify-content: flex-start;
        `;
      case 'center':
        return css`
          flex: 1 1 auto;
          justify-content: center;
        `;
      case 'right':
        return css`
          flex: 0 0 auto;
          justify-content: flex-end;
        `;
    }
  }}
  
  @media (max-width: 768px) {
    gap: ${({ theme }) => theme.spacing[1]};
    
    ${({ alignment }) => alignment === 'center' && css`
      display: none;
    `}
  }
`;

const TimestampDisplay = styled.div<{ theme: Theme; compact?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  white-space: nowrap;
  user-select: none;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const EmergencyBanner = styled.div<{ theme: Theme }>`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: ${({ theme }) => theme.colors.emergency};
  color: ${({ theme }) => theme.colors.text.contrast};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[4]}`};
  text-align: center;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  z-index: ${({ theme }) => theme.zIndex?.notification || 1080};
  animation: slideDown 0.3s ease-out;
  
  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

// Default data for development/fallback
const createDefaultData = (): StatusBarData => ({
  systemHealth: {
    cpu: { usage: 45, status: 'healthy' },
    memory: { used: 4 * 1024 * 1024 * 1024, total: 16 * 1024 * 1024 * 1024, percentage: 25, status: 'healthy' },
    network: { latency: 50, bandwidth: 1000000, packetsLost: 0, status: 'healthy', signalStrength: 'good' },
    overall: 'healthy',
    lastUpdated: Date.now(),
    uptime: 3600
  } as SystemHealthData,
  connection: {
    state: 'connected' as any,
    isConnected: true,
    signalStrength: 'good',
    latency: 50,
    reconnectAttempts: 0,
    metrics: {
      connectionCount: 1,
      reconnectionCount: 0,
      messagesReceived: 1250,
      messagesSent: 890,
      bytesReceived: 2 * 1024 * 1024,
      bytesSent: 1.5 * 1024 * 1024,
      averageLatency: 45,
      currentLatency: 50,
      lastHeartbeat: Date.now() - 5000,
      uptime: 3600,
      errorCount: 0,
      queuedMessages: 0
    }
  } as ConnectionStatusData,
  commandQueue: {
    length: 3,
    processing: false,
    successCount: 1250,
    errorCount: 12,
    avgProcessingTime: 150,
    status: 'normal'
  } as CommandQueueData,
  mission: {
    status: 'active',
    name: 'Mars Surface Survey Alpha',
    startTime: Date.now() - 7200000, // 2 hours ago
    elapsedTime: 7200, // 2 hours in seconds
    estimatedDuration: 14400, // 4 hours
    progress: 50,
    waypoints: {
      total: 12,
      completed: 6,
      current: 'Geological Sample Site 7'
    }
  } as MissionData,
  power: {
    battery: {
      level: 85,
      voltage: 48.2,
      current: 12.5,
      temperature: 35,
      charging: false,
      timeRemaining: 240,
      status: 'healthy'
    },
    overall: 'healthy',
    powerConsumption: 250,
    estimatedRuntime: 340
  } as PowerStatusData,
  notifications: [],
  timestamp: Date.now()
});

// Status Bar Context
const StatusBarContext = createContext<StatusBarContextValue | null>(null);

export const useStatusBar = () => {
  const context = useContext(StatusBarContext);
  if (!context) {
    throw new Error('useStatusBar must be used within a StatusBarProvider');
  }
  return context;
};

// Status Bar Provider Component
export const StatusBarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<StatusBarData>(createDefaultData);
  const [config, setConfig] = useState<StatusBarConfiguration>(DEFAULT_CONFIGURATION);
  const [subscribers, setSubscribers] = useState<Set<(event: StatusUpdateEvent) => void>>(new Set());

  const updateData = useCallback((updates: Partial<StatusBarData>) => {
    setData(prevData => {
      const newData = { ...prevData, ...updates, timestamp: Date.now() };
      
      // Notify subscribers of data changes
      subscribers.forEach(callback => {
        Object.keys(updates).forEach(key => {
          callback({
            type: key as any,
            data: updates[key as keyof StatusBarData],
            timestamp: Date.now()
          });
        });
      });
      
      return newData;
    });
  }, [subscribers]);

  const updateConfig = useCallback((updates: Partial<StatusBarConfiguration>) => {
    setConfig(prevConfig => ({ ...prevConfig, ...updates }));
  }, []);

  const addNotification = useCallback((notification: Omit<NotificationData, 'id' | 'timestamp'>) => {
    const newNotification: NotificationData = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    
    updateData({
      notifications: [...data.notifications, newNotification]
    });
  }, [data.notifications, updateData]);

  const removeNotification = useCallback((id: string) => {
    updateData({
      notifications: data.notifications.filter(n => n.id !== id)
    });
  }, [data.notifications, updateData]);

  const clearNotifications = useCallback(() => {
    updateData({ notifications: [] });
  }, [updateData]);

  const toggleWidget = useCallback((widgetId: string) => {
    updateConfig({
      widgets: config.widgets.map(widget =>
        widget.id === widgetId ? { ...widget, visible: !widget.visible } : widget
      )
    });
  }, [config.widgets, updateConfig]);

  const reorderWidgets = useCallback((widgetIds: string[]) => {
    const reorderedWidgets = widgetIds.map((id, index) => {
      const widget = config.widgets.find(w => w.id === id);
      return widget ? { ...widget, order: index + 1 } : null;
    }).filter(Boolean) as any[];
    
    updateConfig({ widgets: reorderedWidgets });
  }, [config.widgets, updateConfig]);

  const resetToDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIGURATION);
  }, []);

  const exportConfig = useCallback(() => {
    return JSON.stringify(config, null, 2);
  }, [config]);

  const importConfig = useCallback((configString: string): boolean => {
    try {
      const importedConfig = JSON.parse(configString);
      setConfig(importedConfig);
      return true;
    } catch {
      return false;
    }
  }, []);

  const subscribe = useCallback((callback: (event: StatusUpdateEvent) => void) => {
    setSubscribers(prev => new Set([...prev, callback]));
    return () => {
      setSubscribers(prev => {
        const newSet = new Set(prev);
        newSet.delete(callback);
        return newSet;
      });
    };
  }, []);

  const contextValue: StatusBarContextValue = useMemo(() => ({
    data,
    config,
    updateData,
    updateConfig,
    addNotification,
    removeNotification,
    clearNotifications,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    exportConfig,
    importConfig,
    subscribe
  }), [
    data,
    config,
    updateData,
    updateConfig,
    addNotification,
    removeNotification,
    clearNotifications,
    toggleWidget,
    reorderWidgets,
    resetToDefaults,
    exportConfig,
    importConfig,
    subscribe
  ]);

  return (
    <StatusBarContext.Provider value={contextValue}>
      {children}
    </StatusBarContext.Provider>
  );
};

// Main Status Bar Component
export const StatusBar: React.FC<StatusBarProps> = ({
  data: externalData,
  config: externalConfig,
  onConfigChange,
  onNotificationAction,
  onStatusClick,
  onEmergencyToggle,
  className,
  'data-testid': testId
}) => {
  const theme = useTheme() as Theme;
  const context = useContext(StatusBarContext);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Use external data/config if provided, otherwise use context
  const data = externalData || context?.data || createDefaultData();
  const config = externalConfig || context?.config || DEFAULT_CONFIGURATION;

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle config changes
  useEffect(() => {
    if (externalConfig) {
      onConfigChange?.(externalConfig);
    }
  }, [externalConfig, onConfigChange]);

  const visibleWidgets = useMemo(() => {
    return config.widgets
      .filter(widget => widget.visible)
      .sort((a, b) => a.order - b.order);
  }, [config.widgets]);

  const renderWidget = (widget: any) => {
    const widgetProps = {
      config,
      compact: config.compact,
      onClick: () => onStatusClick?.(widget.id),
      'data-testid': `${testId}-${widget.id}`
    };

    switch (widget.id) {
      case 'connection':
        return (
          <ConnectionStatus
            key={widget.id}
            data={data.connection}
            {...widgetProps}
          />
        );
      case 'system-health':
        return (
          <SystemHealth
            key={widget.id}
            data={data.systemHealth}
            {...widgetProps}
          />
        );
      case 'mission':
        return (
          <MissionStatus
            key={widget.id}
            data={data.mission}
            {...widgetProps}
          />
        );
      case 'command-queue':
        return (
          <CommandQueue
            key={widget.id}
            data={data.commandQueue}
            {...widgetProps}
          />
        );
      case 'notifications':
        return (
          <NotificationCenter
            key={widget.id}
            data={data.notifications}
            onNotificationAction={onNotificationAction}
            onClearNotifications={context?.clearNotifications}
            onRemoveNotification={context?.removeNotification}
            {...widgetProps}
          />
        );
      case 'time':
        return (
          <TimestampDisplay
            key={widget.id}
            theme={theme}
            compact={config.compact}
          >
            {currentTime.toLocaleTimeString()}
          </TimestampDisplay>
        );
      default:
        return null;
    }
  };

  // Split widgets into sections
  const leftWidgets = visibleWidgets.filter(w => ['connection', 'system-health'].includes(w.id));
  const centerWidgets = visibleWidgets.filter(w => ['mission', 'command-queue'].includes(w.id));
  const rightWidgets = visibleWidgets.filter(w => ['notifications', 'time'].includes(w.id));

  return (
    <>
      <StatusBarContainer
        theme={theme}
        position={config.position}
        compact={config.compact}
        emergencyMode={config.emergencyMode}
        className={className}
        data-testid={testId}
        role="banner"
        aria-label="Mission Control Status Bar"
      >
        <StatusBarContent theme={theme} compact={config.compact}>
          <WidgetSection theme={theme} alignment="left">
            {leftWidgets.map(renderWidget)}
          </WidgetSection>
          
          <WidgetSection theme={theme} alignment="center">
            {centerWidgets.map(renderWidget)}
          </WidgetSection>
          
          <WidgetSection theme={theme} alignment="right">
            {rightWidgets.map(renderWidget)}
          </WidgetSection>
        </StatusBarContent>
      </StatusBarContainer>
      
      {config.emergencyMode && (
        <EmergencyBanner theme={theme}>
          🚨 EMERGENCY MODE ACTIVE - All non-critical systems may be affected
        </EmergencyBanner>
      )}
    </>
  );
};

StatusBar.displayName = 'StatusBar';

// Export both the component and provider for easy usage
export { StatusBarProvider };
export default StatusBar;