/**
 * Comprehensive Alert System Demonstration
 * Showcases the complete integrated alert grouping and dismissal system
 * with all WCAG 2.1 AA accessibility features and 4-theme support
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { Button } from '../Button/Button';
import { Select } from '../Select/Select';
import { Input } from '../Input/Input';
import { Checkbox } from '../Checkbox/Checkbox';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { useTheme } from '@emotion/react';
import { EnhancedAlertContainer } from './EnhancedAlertContainer';
import AlertDismissalControls from './components/AlertDismissalControls';
import BulkDismissalManager from './components/BulkDismissalManager';
import AlertUndoManager from './components/AlertUndoManager';
import { 
  EnhancedAlertGroupingManager,
  DismissalType,
  AlertGroupCriteria 
} from '../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { useAlertStore } from '../../../../stores/alertStore';

// Demo configuration interfaces
interface DemoSettings {
  theme: 'default' | 'dark' | 'highContrast' | 'missionCritical';
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxVisible: number;
  enableBulkActions: boolean;
  enableUndo: boolean;
  enableGrouping: boolean;
  autoGenerate: boolean;
  generationInterval: number; // seconds
}

interface AlertTemplate {
  id: string;
  title: string;
  message: string;
  priority: AlertPriority;
  category: string;
  source: string;
}

const DemoContainer = styled.div<{ theme: Theme }>`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background.default};
  padding: ${({ theme }) => theme.spacing[6]};
  color: ${({ theme }) => theme.colors.text.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily};
`;

const DemoHeader = styled.header<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[8]};
  text-align: center;
`;

const DemoTitle = styled.h1<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const DemoDescription = styled.p<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.text.secondary};
  max-width: 800px;
  margin: 0 auto;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const DemoContent = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: ${({ theme }) => theme.spacing[8]};
  max-width: 1400px;
  margin: 0 auto;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing[6]};
  }
`;

const ControlPanel = styled.section<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing[6]};
  height: fit-content;
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

const PanelSection = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[6]};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  border-bottom: 2px solid ${({ theme }) => theme.colors.primary.main};
  padding-bottom: ${({ theme }) => theme.spacing[2]};
`;

const ControlGrid = styled.div<{ theme: Theme }>`
  display: grid;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const ControlRow = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const ButtonGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
`;

const DemoArea = styled.main<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing[6]};
  min-height: 600px;
  position: relative;
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

const DemoAreaTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
`;

const SystemStatus = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[4]};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
  flex-wrap: wrap;
`;

const StatusCard = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
  flex: 1;
  min-width: 150px;
  text-align: center;
`;

const StatusValue = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary.main};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const StatusLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FeatureShowcase = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
`;

const FeatureCard = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
`;

const FeatureTitle = styled.h4<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
`;

const FeatureDescription = styled.p<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0 0 ${({ theme }) => theme.spacing[3]} 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

// Pre-defined alert templates for demonstration
const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: 'rover-battery-low',
    title: 'Battery Level Critical',
    message: 'Rover battery at 5%. Immediate charging required.',
    priority: 'critical',
    category: 'power',
    source: 'battery-monitor'
  },
  {
    id: 'comms-disruption',
    title: 'Communication Disruption',
    message: 'Signal strength degraded. Attempting reconnection.',
    priority: 'high',
    category: 'communication',
    source: 'radio-system'
  },
  {
    id: 'sensor-calibration',
    title: 'Sensor Calibration Required',
    message: 'Temperature sensor drift detected. Recalibration needed.',
    priority: 'medium',
    category: 'sensors',
    source: 'environmental-monitor'
  },
  {
    id: 'system-health',
    title: 'System Health Check',
    message: 'Routine system diagnostics completed successfully.',
    priority: 'low',
    category: 'maintenance',
    source: 'health-monitor'
  },
  {
    id: 'data-backup',
    title: 'Data Backup Complete',
    message: 'Daily telemetry backup completed. 2.3GB transferred.',
    priority: 'info',
    category: 'data',
    source: 'backup-service'
  },
  {
    id: 'nav-obstacle',
    title: 'Navigation Obstacle',
    message: 'Large rock detected in path. Initiating avoidance maneuver.',
    priority: 'high',
    category: 'navigation',
    source: 'vision-system'
  },
  {
    id: 'motor-overheating',
    title: 'Motor Temperature High',
    message: 'Drive motor exceeding optimal temperature range.',
    priority: 'medium',
    category: 'hardware',
    source: 'thermal-monitor'
  },
  {
    id: 'scientific-sample',
    title: 'Sample Collection Complete',
    message: 'Rock sample #47 collected and stored for analysis.',
    priority: 'info',
    category: 'science',
    source: 'sample-arm'
  }
];

export const AlertSystemDemo: React.FC = () => {
  const theme = useTheme() as Theme;
  const alertStore = useAlertStore();
  const [groupingManager] = useState(() => new EnhancedAlertGroupingManager());
  
  // Demo settings state
  const [settings, setSettings] = useState<DemoSettings>({
    theme: 'default',
    position: 'top-right',
    maxVisible: 5,
    enableBulkActions: true,
    enableUndo: true,
    enableGrouping: true,
    autoGenerate: false,
    generationInterval: 3
  });
  
  // System state
  const [alertCount, setAlertCount] = useState(0);
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [autoGenerateTimer, setAutoGenerateTimer] = useState<NodeJS.Timer | null>(null);
  
  // Statistics
  const [stats, setStats] = useState({
    totalGenerated: 0,
    totalDismissed: 0,
    activeGroups: 0,
    undoableActions: 0
  });

  // Generate random alert based on templates
  const generateRandomAlert = useCallback(() => {
    const template = ALERT_TEMPLATES[Math.floor(Math.random() * ALERT_TEMPLATES.length)];
    const timestamp = new Date().toLocaleTimeString();
    
    const alert = {
      id: `${template.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'alert' as const,
      priority: template.priority,
      timestamp: new Date(),
      data: {
        title: template.title,
        message: `${template.message} (${timestamp})`,
        category: template.category,
        source: template.source,
        persistent: template.priority === 'critical',
        actions: template.priority === 'critical' ? [
          { 
            label: 'Acknowledge', 
            variant: 'primary' as const,
            handler: () => console.log('Alert acknowledged') 
          },
          { 
            label: 'View Details', 
            variant: 'secondary' as const,
            handler: () => console.log('Viewing details') 
          }
        ] : undefined
      }
    };
    
    alertStore.addAlert(alert);
    setAlertCount(prev => prev + 1);
    setStats(prev => ({ ...prev, totalGenerated: prev.totalGenerated + 1 }));
  }, [alertStore]);

  // Generate multiple alerts for bulk testing
  const generateBulkAlerts = useCallback((count: number) => {
    for (let i = 0; i < count; i++) {
      setTimeout(() => generateRandomAlert(), i * 200); // Stagger generation
    }
  }, [generateRandomAlert]);

  // Clear all alerts
  const clearAllAlerts = useCallback(() => {
    alertStore.clearAll();
    setAlertCount(0);
  }, [alertStore]);

  // Handle auto-generation toggle
  useEffect(() => {
    if (settings.autoGenerate) {
      const timer = setInterval(() => {
        generateRandomAlert();
      }, settings.generationInterval * 1000);
      setAutoGenerateTimer(timer);
    } else {
      if (autoGenerateTimer) {
        clearInterval(autoGenerateTimer);
        setAutoGenerateTimer(null);
      }
    }
    
    return () => {
      if (autoGenerateTimer) {
        clearInterval(autoGenerateTimer);
      }
    };
  }, [settings.autoGenerate, settings.generationInterval, generateRandomAlert, autoGenerateTimer]);

  // Update statistics periodically
  useEffect(() => {
    const updateStats = () => {
      const groups = groupingManager.getActiveGroups();
      const undoableActions = groupingManager.getUndoableActions();
      
      setStats(prev => ({
        ...prev,
        activeGroups: groups.length,
        undoableActions: undoableActions.length
      }));
    };
    
    updateStats();
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [groupingManager]);

  // Grouping criteria for demonstration
  const groupingCriteria: AlertGroupCriteria = {
    bySource: settings.enableGrouping,
    byCategory: settings.enableGrouping,
    similarityThreshold: 0.7,
    maxGroupSize: 10,
    groupingWindow: 30000, // 30 seconds
  };

  return (
    <DemoContainer>
      <DemoHeader>
        <DemoTitle>Alert System Demonstration</DemoTitle>
        <DemoDescription>
          Interactive demonstration of the comprehensive alert grouping and dismissal system 
          with priority-specific behaviors, bulk operations, undo functionality, and full 
          WCAG 2.1 AA accessibility compliance across all 4 theme variants.
        </DemoDescription>
      </DemoHeader>

      <DemoContent>
        {/* Control Panel */}
        <ControlPanel role="complementary" aria-label="Demo Controls">
          <PanelSection>
            <SectionTitle>System Configuration</SectionTitle>
            <ControlGrid>
              <ControlRow>
                <label htmlFor="theme-select">Theme</label>
                <Select
                  id="theme-select"
                  value={settings.theme}
                  onChange={(value) => setSettings(prev => ({ ...prev, theme: value as any }))}
                  options={[
                    { value: 'default', label: 'Default Light' },
                    { value: 'dark', label: 'Dark Mode' },
                    { value: 'highContrast', label: 'High Contrast' },
                    { value: 'missionCritical', label: 'Mission Critical' }
                  ]}
                  aria-label="Select theme"
                />
              </ControlRow>

              <ControlRow>
                <label htmlFor="position-select">Alert Position</label>
                <Select
                  id="position-select"
                  value={settings.position}
                  onChange={(value) => setSettings(prev => ({ ...prev, position: value as any }))}
                  options={[
                    { value: 'top-right', label: 'Top Right' },
                    { value: 'top-left', label: 'Top Left' },
                    { value: 'top-center', label: 'Top Center' },
                    { value: 'bottom-right', label: 'Bottom Right' },
                    { value: 'bottom-left', label: 'Bottom Left' },
                    { value: 'bottom-center', label: 'Bottom Center' }
                  ]}
                  aria-label="Select alert position"
                />
              </ControlRow>

              <ControlRow>
                <label htmlFor="max-visible">Max Visible Alerts</label>
                <Input
                  id="max-visible"
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxVisible}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    maxVisible: parseInt(e.target.value) || 5 
                  }))}
                  aria-label="Maximum visible alerts"
                />
              </ControlRow>
            </ControlGrid>
          </PanelSection>

          <PanelSection>
            <SectionTitle>Feature Toggles</SectionTitle>
            <ControlGrid>
              <Checkbox
                label="Enable Bulk Actions"
                checked={settings.enableBulkActions}
                onChange={(checked) => setSettings(prev => ({ ...prev, enableBulkActions: checked }))}
                aria-describedby="bulk-actions-desc"
              />
              <div id="bulk-actions-desc" style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                Allow selection and bulk dismissal of multiple alerts
              </div>

              <Checkbox
                label="Enable Undo Functionality"
                checked={settings.enableUndo}
                onChange={(checked) => setSettings(prev => ({ ...prev, enableUndo: checked }))}
                aria-describedby="undo-desc"
              />
              <div id="undo-desc" style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                Show undo toasts for dismissed alerts
              </div>

              <Checkbox
                label="Enable Smart Grouping"
                checked={settings.enableGrouping}
                onChange={(checked) => setSettings(prev => ({ ...prev, enableGrouping: checked }))}
                aria-describedby="grouping-desc"
              />
              <div id="grouping-desc" style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                Group similar alerts by source and category
              </div>

              <Checkbox
                label="Auto-Generate Alerts"
                checked={settings.autoGenerate}
                onChange={(checked) => setSettings(prev => ({ ...prev, autoGenerate: checked }))}
                aria-describedby="auto-gen-desc"
              />
              <div id="auto-gen-desc" style={{ fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                Automatically generate test alerts
              </div>

              {settings.autoGenerate && (
                <ControlRow>
                  <label htmlFor="generation-interval">Generation Interval (seconds)</label>
                  <Input
                    id="generation-interval"
                    type="number"
                    min={1}
                    max={30}
                    value={settings.generationInterval}
                    onChange={(e) => setSettings(prev => ({ 
                      ...prev, 
                      generationInterval: parseInt(e.target.value) || 3 
                    }))}
                    aria-label="Auto-generation interval"
                  />
                </ControlRow>
              )}
            </ControlGrid>
          </PanelSection>

          <PanelSection>
            <SectionTitle>Alert Generation</SectionTitle>
            <ButtonGrid>
              <Tooltip content="Generate a single random alert">
                <Button
                  variant="primary"
                  size="small"
                  onClick={generateRandomAlert}
                  aria-label="Generate single alert"
                >
                  Single Alert
                </Button>
              </Tooltip>

              <Tooltip content="Generate 5 alerts quickly for testing">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => generateBulkAlerts(5)}
                  aria-label="Generate 5 alerts"
                >
                  5 Alerts
                </Button>
              </Tooltip>

              <Tooltip content="Generate 10 alerts for bulk testing">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => generateBulkAlerts(10)}
                  aria-label="Generate 10 alerts"
                >
                  10 Alerts
                </Button>
              </Tooltip>

              <Tooltip content="Clear all active alerts">
                <Button
                  variant="danger"
                  size="small"
                  onClick={clearAllAlerts}
                  aria-label="Clear all alerts"
                >
                  Clear All
                </Button>
              </Tooltip>
            </ButtonGrid>
          </PanelSection>

          <PanelSection>
            <SectionTitle>Bulk Operations</SectionTitle>
            <ButtonGrid>
              <Tooltip content="Open bulk dismissal manager">
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setShowBulkManager(true)}
                  disabled={!settings.enableBulkActions}
                  aria-label="Open bulk dismissal manager"
                >
                  Bulk Manager
                </Button>
              </Tooltip>
            </ButtonGrid>
          </PanelSection>
        </ControlPanel>

        {/* Demo Area */}
        <DemoArea role="main" aria-label="Alert System Demo Area">
          <DemoAreaTitle>Live Alert System</DemoAreaTitle>
          
          {/* System Statistics */}
          <SystemStatus role="region" aria-label="System Statistics">
            <StatusCard>
              <StatusValue>{stats.totalGenerated}</StatusValue>
              <StatusLabel>Generated</StatusLabel>
            </StatusCard>
            <StatusCard>
              <StatusValue>{alertCount}</StatusValue>
              <StatusLabel>Active</StatusLabel>
            </StatusCard>
            <StatusCard>
              <StatusValue>{stats.activeGroups}</StatusValue>
              <StatusLabel>Groups</StatusLabel>
            </StatusCard>
            <StatusCard>
              <StatusValue>{stats.undoableActions}</StatusValue>
              <StatusLabel>Undoable</StatusLabel>
            </StatusCard>
          </SystemStatus>

          {/* Feature Showcase */}
          <FeatureShowcase>
            <FeatureCard>
              <FeatureTitle>🎯 Priority-Specific Dismissal</FeatureTitle>
              <FeatureDescription>
                Critical alerts require acknowledgment, while lower priority alerts 
                can be dismissed quickly. Different behaviors for each priority level.
              </FeatureDescription>
              <Badge variant="info" size="small">WCAG AA Compliant</Badge>
            </FeatureCard>

            <FeatureCard>
              <FeatureTitle>🔄 Smart Grouping</FeatureTitle>
              <FeatureDescription>
                Automatically groups similar alerts by source, category, and content 
                similarity to reduce clutter and improve readability.
              </FeatureDescription>
              <Badge variant="success" size="small">Configurable</Badge>
            </FeatureCard>

            <FeatureCard>
              <FeatureTitle>📦 Bulk Operations</FeatureTitle>
              <FeatureDescription>
                Select multiple alerts or entire groups for bulk dismissal with 
                advanced filtering and safety confirmations.
              </FeatureDescription>
              <Badge variant="warning" size="small">Enterprise Ready</Badge>
            </FeatureCard>

            <FeatureCard>
              <FeatureTitle>↩️ Undo Functionality</FeatureTitle>
              <FeatureDescription>
                Toast notifications for dismissed alerts with time-limited undo 
                capability and comprehensive history tracking.
              </FeatureDescription>
              <Badge variant="error" size="small">5min Window</Badge>
            </FeatureCard>
          </FeatureShowcase>

          <div style={{ marginTop: theme.spacing[6], textAlign: 'center', color: theme.colors.text.secondary }}>
            Generate alerts using the controls on the left to see the system in action.
            Try different priorities, enable grouping, and test bulk operations.
          </div>
        </DemoArea>
      </DemoContent>

      {/* Enhanced Alert Container */}
      <EnhancedAlertContainer
        position={settings.position}
        maxVisible={settings.maxVisible}
        groupingCriteria={settings.enableGrouping ? groupingCriteria : undefined}
        enableBulkActions={settings.enableBulkActions}
        enableUndo={settings.enableUndo}
      />

      {/* Bulk Dismissal Manager Modal */}
      {showBulkManager && settings.enableBulkActions && (
        <BulkDismissalManager
          groupingManager={groupingManager}
          availableAlerts={alertStore.alerts}
          availableGroups={groupingManager.getActiveGroups()}
          onBulkDismiss={async (items, type, options) => {
            // Handle bulk dismissal
            const successful: string[] = [];
            const failed: string[] = [];
            
            if (items.alertIds) {
              items.alertIds.forEach(id => {
                try {
                  alertStore.removeAlert(id);
                  successful.push(id);
                } catch (error) {
                  failed.push(id);
                }
              });
            }
            
            if (items.groupIds) {
              items.groupIds.forEach(groupId => {
                const group = groupingManager.getActiveGroups().find(g => g.id === groupId);
                if (group) {
                  group.alerts.forEach(alert => {
                    try {
                      alertStore.removeAlert(alert.id);
                      successful.push(alert.id);
                    } catch (error) {
                      failed.push(alert.id);
                    }
                  });
                }
              });
            }
            
            setStats(prev => ({ ...prev, totalDismissed: prev.totalDismissed + successful.length }));
            return { successful, failed };
          }}
          onClose={() => setShowBulkManager(false)}
        />
      )}

      {/* Undo Manager */}
      {settings.enableUndo && (
        <AlertUndoManager
          groupingManager={groupingManager}
          position={settings.position}
          onUndo={(actionId) => {
            console.log('Undo action:', actionId);
            // Handle undo logic here
          }}
        />
      )}
    </DemoContainer>
  );
};

export default AlertSystemDemo;