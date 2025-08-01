/**
 * QuickToolbar Demo Integration
 * 
 * Demonstrates integration of QuickToolbar with Mission Control system
 * Shows real-world usage patterns and integration examples
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { Theme } from '../../../theme/themes';
import { QuickToolbar, ToolAction, RoverContext, ToolbarPreferences } from './QuickToolbar';
import { CommandBar } from './CommandBar';
import { Card } from '../../ui/core/Card/Card';
import { Button } from '../../ui/core/Button/Button';
import { Toggle } from '../../ui/core/Toggle/Toggle';
import { Badge } from '../../ui/core/Badge/Badge';

// ============================================================================
// Demo Container
// ============================================================================

const DemoContainer = styled.div<{ theme: Theme }>`
  position: relative;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, 
    ${({ theme }) => theme.colors.background.default}, 
    ${({ theme }) => theme.colors.background.paper}
  );
  overflow: hidden;
`;

const DemoContent = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  display: grid;
  grid-template-columns: 1fr 350px;
  gap: ${({ theme }) => theme.spacing[6]};
  height: 100%;
`;

const MainArea = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const ControlPanel = styled(Card)<{ theme: Theme }>`
  height: fit-content;
  position: sticky;
  top: ${({ theme }) => theme.spacing[6]};
`;

const StatusGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
`;

const StatusCard = styled(Card)<{ theme: Theme }>`
  text-align: center;
  padding: ${({ theme }) => theme.spacing[4]};
`;

const StatusValue = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary.main};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`;

const StatusLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const LogContainer = styled.div<{ theme: Theme }>`
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const LogEntry = styled.div<{ theme: Theme; level: 'info' | 'success' | 'warning' | 'error' }>`
  padding: ${({ theme }) => theme.spacing[1]} 0;
  color: ${({ theme, level }) => {
    switch (level) {
      case 'success': return theme.colors.success.main;
      case 'warning': return theme.colors.warning.main;
      case 'error': return theme.colors.error.main;
      default: return theme.colors.text.primary;
    }
  }};
  
  &:before {
    content: '[${new Date().toLocaleTimeString()}] ';
    color: ${({ theme }) => theme.colors.text.secondary};
  }
`;

// ============================================================================
// Demo Hooks and State
// ============================================================================

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

const useDemoState = () => {
  const [roverContext, setRoverContext] = useState<RoverContext>({
    isConnected: true,
    currentState: 'operational',
    capabilities: ['navigation', 'sampling', 'imaging', 'communication', 'thermal_imaging'],
    batteryLevel: 85,
    location: { x: 100, y: 200, z: 50 },
    isEmergency: false,
    activeCommands: [],
    permissions: ['navigate', 'sample', 'image', 'diagnostics', 'emergency_stop']
  });

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      timestamp: new Date(),
      level: 'info',
      message: 'Mission Control System initialized'
    }
  ]);

  const [preferences, setPreferences] = useState<ToolbarPreferences>();

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev.slice(-19), {
      timestamp: new Date(),
      level,
      message
    }]);
  }, []);

  const updateRoverContext = useCallback((updates: Partial<RoverContext>) => {
    setRoverContext(prev => ({ ...prev, ...updates }));
    addLog('info', `Rover context updated: ${Object.keys(updates).join(', ')}`);
  }, [addLog]);

  return {
    roverContext,
    updateRoverContext,
    logs,
    addLog,
    preferences,
    setPreferences
  };
};

// ============================================================================
// Custom Tools for Demo
// ============================================================================

const createDemoTools = (addLog: (level: LogEntry['level'], message: string) => void): ToolAction[] => [
  {
    id: 'demo-emergency-stop',
    name: 'Emergency Stop',
    category: 'safety',
    description: 'Immediately halt all rover operations',
    icon: '🛑',
    shortcut: 'Ctrl+Shift+X',
    state: 'enabled',
    confirmationRequired: true,
    dangerLevel: 'critical',
    onExecute: async () => {
      addLog('error', '🛑 EMERGENCY STOP ACTIVATED');
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog('warning', 'All systems halted - manual recovery required');
    }
  },
  {
    id: 'demo-home',
    name: 'Return Home',
    category: 'navigation',
    description: 'Navigate rover back to home position',
    icon: '🏠',
    shortcut: 'Ctrl+H',
    state: 'enabled',
    contextRequirements: ['navigation'],
    onExecute: async () => {
      addLog('info', '🏠 Initiating return to home position');
      await new Promise(resolve => setTimeout(resolve, 2000));
      addLog('success', 'Navigation to home position completed');
    },
    isVisible: (context) => context.isConnected && !context.isEmergency
  },
  {
    id: 'demo-sample',
    name: 'Collect Sample',
    category: 'sampling',
    description: 'Activate sample collection mechanism',
    icon: '🧪',
    shortcut: 'Ctrl+S',
    state: 'enabled',
    contextRequirements: ['sampling'],
    onExecute: async () => {
      addLog('info', '🧪 Sample collection initiated');
      await new Promise(resolve => setTimeout(resolve, 3000));
      addLog('success', 'Sample collected and stored successfully');
    },
    isVisible: (context) => context.capabilities.includes('sampling')
  },
  {
    id: 'demo-camera',
    name: 'Capture Image',
    category: 'system',
    description: 'Take photo with rover camera',
    icon: '📷',
    shortcut: 'Ctrl+C',
    state: 'enabled',
    onExecute: async () => {
      addLog('info', '📷 Capturing image...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      addLog('success', 'Image captured and transmitted');
    }
  },
  {
    id: 'demo-thermal',
    name: 'Thermal Scan',
    category: 'diagnostic',
    description: 'Perform thermal imaging scan',
    icon: '🌡️',
    shortcut: 'Ctrl+T',
    state: 'enabled',
    contextRequirements: ['thermal_imaging'],
    onExecute: async () => {
      addLog('info', '🌡️ Thermal scan in progress...');
      await new Promise(resolve => setTimeout(resolve, 2500));
      addLog('success', 'Thermal scan completed - temperature data acquired');
    },
    isVisible: (context) => context.capabilities.includes('thermal_imaging')
  },
  {
    id: 'demo-status',
    name: 'System Status',
    category: 'diagnostic',
    description: 'Generate comprehensive system report',
    icon: '📊',
    shortcut: 'Ctrl+R',
    state: 'enabled',
    onExecute: async () => {
      addLog('info', '📊 Generating system status report...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog('success', 'System status report generated');
    }
  },
  {
    id: 'demo-communication',
    name: 'Send Message',
    category: 'communication',
    description: 'Send message to mission control',
    icon: '📡',
    shortcut: 'Ctrl+M',
    state: 'enabled',
    onExecute: async () => {
      addLog('info', '📡 Transmitting message to mission control...');
      await new Promise(resolve => setTimeout(resolve, 1800));
      addLog('success', 'Message transmitted successfully');
    }
  }
];

// ============================================================================
// Main Demo Component
// ============================================================================

export const QuickToolbarDemo: React.FC = () => {
  const { roverContext, updateRoverContext, logs, addLog, preferences, setPreferences } = useDemoState();
  const demoTools = createDemoTools(addLog);

  // Tool execution handler
  const handleToolExecute = useCallback(async (tool: ToolAction) => {
    addLog('info', `Executing tool: ${tool.name}`);
    
    // Add to active commands
    updateRoverContext({
      activeCommands: [...roverContext.activeCommands, tool.id]
    });

    try {
      await tool.onExecute();
    } catch (error) {
      addLog('error', `Tool execution failed: ${error}`);
    } finally {
      // Remove from active commands
      updateRoverContext({
        activeCommands: roverContext.activeCommands.filter(id => id !== tool.id)
      });
    }
  }, [roverContext.activeCommands, updateRoverContext, addLog]);

  // Command bar integration
  const handleCommandBarIntegration = useCallback((command: string) => {
    addLog('info', `CommandBar integration: ${command}`);
  }, [addLog]);

  // Simulate rover state changes
  const simulateEmergency = useCallback(() => {
    updateRoverContext({
      isEmergency: true,
      currentState: 'emergency',
      batteryLevel: Math.max(roverContext.batteryLevel - 20, 0)
    });
    addLog('error', '🚨 EMERGENCY STATE ACTIVATED');
  }, [roverContext.batteryLevel, updateRoverContext, addLog]);

  const simulateDisconnection = useCallback(() => {
    updateRoverContext({
      isConnected: false,
      currentState: 'disconnected',
      activeCommands: []
    });
    addLog('error', '🔴 Connection lost');
  }, [updateRoverContext, addLog]);

  const simulateReconnection = useCallback(() => {
    updateRoverContext({
      isConnected: true,
      isEmergency: false,
      currentState: 'operational',
      batteryLevel: Math.min(roverContext.batteryLevel + 10, 100)
    });
    addLog('success', '🟢 Connection restored');
  }, [roverContext.batteryLevel, updateRoverContext, addLog]);

  const simulateLowBattery = useCallback(() => {
    updateRoverContext({
      batteryLevel: 15,
      currentState: 'low-power'
    });
    addLog('warning', '🔋 Low battery warning');
  }, [updateRoverContext, addLog]);

  return (
    <DemoContainer>
      <DemoContent>
        <MainArea>
          {/* Status Overview */}
          <StatusGrid>
            <StatusCard>
              <StatusValue style={{ color: roverContext.isConnected ? '#10b981' : '#ef4444' }}>
                {roverContext.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </StatusValue>
              <StatusLabel>Connection Status</StatusLabel>
            </StatusCard>
            
            <StatusCard>
              <StatusValue>{roverContext.batteryLevel}%</StatusValue>
              <StatusLabel>Battery Level</StatusLabel>
            </StatusCard>
            
            <StatusCard>
              <StatusValue>{roverContext.activeCommands.length}</StatusValue>
              <StatusLabel>Active Commands</StatusLabel>
            </StatusCard>
            
            <StatusCard>
              <StatusValue style={{ color: roverContext.isEmergency ? '#ef4444' : '#10b981' }}>
                {roverContext.isEmergency ? 'EMERGENCY' : 'NORMAL'}
              </StatusValue>
              <StatusLabel>System State</StatusLabel>
            </StatusCard>
          </StatusGrid>

          {/* System Log */}
          <Card header="System Log">
            <LogContainer>
              {logs.map((log, index) => (
                <LogEntry key={index} level={log.level}>
                  {log.message}
                </LogEntry>
              ))}
            </LogContainer>
          </Card>
        </MainArea>

        {/* Control Panel */}
        <ControlPanel header="Demo Controls">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h4>Rover State Simulation</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button
                  variant="danger"
                  size="small"
                  onClick={simulateEmergency}
                  disabled={roverContext.isEmergency}
                >
                  Simulate Emergency
                </Button>
                
                <Button
                  variant="secondary"
                  size="small"
                  onClick={simulateDisconnection}
                  disabled={!roverContext.isConnected}
                >
                  Simulate Disconnection
                </Button>
                
                <Button
                  variant="primary"
                  size="small"
                  onClick={simulateReconnection}
                  disabled={roverContext.isConnected && !roverContext.isEmergency}
                >
                  Restore Connection
                </Button>
                
                <Button
                  variant="secondary"
                  size="small"
                  onClick={simulateLowBattery}
                  disabled={roverContext.batteryLevel <= 20}
                >
                  Simulate Low Battery
                </Button>
              </div>
            </div>

            <div>
              <h4>Rover Capabilities</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {roverContext.capabilities.map(capability => (
                  <Badge key={capability} variant="info" size="small">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4>Active Commands</h4>
              {roverContext.activeCommands.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {roverContext.activeCommands.map(command => (
                    <Badge key={command} variant="warning" size="small">
                      {command}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                  No active commands
                </div>
              )}
            </div>

            <div>
              <h4>Toolbar Info</h4>
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                • Drag tools to reorder<br/>
                • Click gear icon to customize<br/>
                • Use keyboard shortcuts<br/>
                • Tools adapt to rover state
              </div>
            </div>
          </div>
        </ControlPanel>
      </DemoContent>

      {/* QuickToolbar */}
      <QuickToolbar
        roverContext={roverContext}
        tools={demoTools}
        onToolExecute={handleToolExecute}
        onPreferencesChange={setPreferences}
        onCommandBarIntegration={handleCommandBarIntegration}
        testId="demo-quick-toolbar"
      />
    </DemoContainer>
  );
};

export default QuickToolbarDemo;