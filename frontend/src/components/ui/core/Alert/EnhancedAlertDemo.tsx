/**
 * Enhanced Alert System Demo
 * Demonstrates the comprehensive grouping and dismissal system capabilities
 */

import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { Button } from '../Button/Button';
import { Select } from '../Select/Select';
import { Input } from '../Input/Input';
import { Checkbox } from '../Checkbox/Checkbox';
import { Badge } from '../Badge/Badge';
import { useAlertStore } from '../../../../stores/alertStore';
import { EnhancedAlertContainer } from './EnhancedAlertContainer';

const DemoContainer = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  max-width: 1200px;
  margin: 0 auto;
`;

const DemoSection = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[8]};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const SectionDescription = styled.p<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const ControlPanel = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const ControlGroup = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const ControlLabel = styled.label<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const ButtonGroup = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const StatusPanel = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const StatusGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
`;

const StatusItem = styled.div<{ theme: Theme }>`
  text-align: center;
`;

const StatusValue = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const StatusLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FeatureList = styled.ul<{ theme: Theme }>`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing[2]};
`;

const FeatureItem = styled.li<{ theme: Theme }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`;

const FeatureIcon = styled.span<{ theme: Theme }>`
  color: ${({ theme }) => theme.colors.success.main};
  font-weight: bold;
  flex-shrink: 0;
`;

const FeatureText = styled.span<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
`;

// Demo data generators
const DEMO_SOURCES = ['system', 'hardware', 'network', 'security', 'user', 'external'];
const DEMO_MESSAGES = [
  'Connection timeout detected',
  'Memory usage exceeding threshold',
  'Authentication failed',
  'Sensor reading anomaly',
  'Database connection lost',
  'Cache invalidation required',
  'Performance degradation detected',
  'Security scan completed',
  'Backup process failed',
  'Configuration update needed',
];

const DEMO_TITLES = [
  'System Alert',
  'Hardware Warning',
  'Network Issue',
  'Security Notice',
  'Performance Alert',
  'Configuration Change',
  'Maintenance Required',
  'Update Available',
  'Error Occurred',
  'Status Change',
];

export const EnhancedAlertDemo: React.FC = () => {
  const { addAlert, clearAlerts, queueStatus } = useAlertStore();
  
  // Demo state
  const [alertPriority, setAlertPriority] = useState<AlertPriority>('medium');
  const [alertCount, setAlertCount] = useState(1);
  const [enableGrouping, setEnableGrouping] = useState(true);
  const [groupBySource, setGroupBySource] = useState(true);
  const [groupByPriority, setGroupByPriority] = useState(false);
  const [groupByTitle, setGroupByTitle] = useState(true);
  const [enableBulkActions, setEnableBulkActions] = useState(true);
  const [enableUndo, setEnableUndo] = useState(true);
  const [containerPosition, setContainerPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('top-right');

  // Generate demo alert
  const generateDemoAlert = useCallback((priority: AlertPriority) => {
    const source = DEMO_SOURCES[Math.floor(Math.random() * DEMO_SOURCES.length)];
    const message = DEMO_MESSAGES[Math.floor(Math.random() * DEMO_MESSAGES.length)];
    const title = DEMO_TITLES[Math.floor(Math.random() * DEMO_TITLES.length)];
    
    return {
      title,
      message,
      priority,
      closable: true,
      persistent: priority === 'critical',
      source,
      metadata: {
        category: source,
        timestamp: new Date().toISOString(),
        demoGenerated: true,
      },
      // Add grouping hints for similar alerts
      groupId: groupBySource ? `source-${source}` : undefined,
    };
  }, [groupBySource]);

  // Add demo alerts
  const handleAddAlerts = useCallback(() => {
    for (let i = 0; i < alertCount; i++) {
      setTimeout(() => {
        addAlert(generateDemoAlert(alertPriority));
      }, i * 100); // Stagger alerts slightly
    }
  }, [alertCount, alertPriority, addAlert, generateDemoAlert]);

  // Add grouped alerts (same source/priority)
  const handleAddGroupedAlerts = useCallback(() => {
    const source = 'system';
    const baseMessage = 'Sensor reading anomaly detected';
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        addAlert({
          title: 'System Alert',
          message: `${baseMessage} (Sensor ${i + 1})`,
          priority: alertPriority,
          closable: true,
          source,
          groupId: 'sensor-group',
          metadata: {
            sensorId: i + 1,
            category: 'hardware',
            grouped: true,
          },
        });
      }, i * 200);
    }
  }, [alertPriority, addAlert]);

  // Add priority demonstration
  const handleDemonstratePriorities = useCallback(() => {
    const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
    
    priorities.forEach((priority, index) => {
      setTimeout(() => {
        addAlert({
          title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Alert`,
          message: `This demonstrates ${priority} priority dismissal behavior`,
          priority,
          closable: priority !== 'critical',
          persistent: priority === 'critical',
          source: 'demo',
          metadata: {
            priorityDemo: true,
            expectedBehavior: getPriorityBehaviorDescription(priority),
          },
        });
      }, index * 300);
    });
  }, [addAlert]);

  const getPriorityBehaviorDescription = (priority: AlertPriority): string => {
    const behaviors = {
      critical: 'Persistent until acknowledged',
      high: 'Stays visible until acknowledged',
      medium: 'Auto-dismisses after viewing',
      low: 'Auto-dismisses after timeout',
      info: 'Visible only in alert center',
    };
    return behaviors[priority];
  };

  const getPriorityColor = (priority: AlertPriority): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
    const colors = {
      critical: 'error' as const,
      high: 'warning' as const,
      medium: 'info' as const,
      low: 'success' as const,
      info: 'neutral' as const,
    };
    return colors[priority];
  };

  // Get grouping criteria
  const groupingCriteria = {
    sourceSimilarity: groupBySource,
    priorityGrouping: groupByPriority,
    titleSimilarity: groupByTitle ? 0.7 : undefined,
    timingWindow: 30000, // 30 seconds
    metadataKeys: ['category'],
  };

  return (
    <DemoContainer>
      <DemoSection>
        <SectionTitle>Enhanced Alert System Demo</SectionTitle>
        <SectionDescription>
          This demo showcases the comprehensive alert grouping and dismissal system with priority-specific behaviors, 
          bulk operations, and undo functionality. The system automatically groups related alerts and provides 
          different dismissal options based on alert priority.
        </SectionDescription>

        {/* Features Overview */}
        <FeatureList>
          <FeatureItem>
            <FeatureIcon>✓</FeatureIcon>
            <FeatureText>Smart alert grouping by source, priority, and content similarity</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>✓</FeatureIcon>
            <FeatureText>Priority-specific dismissal behaviors (persistent, sticky, timeout)</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>✓</FeatureIcon>
            <FeatureText>Multiple dismissal options (manual, timed, bulk, conditional)</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>✓</FeatureIcon>
            <FeatureText>Bulk dismissal manager with advanced filtering</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>✓</FeatureIcon>
            <FeatureText>Undo functionality with configurable time windows</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <FeatureIcon>✓</FeatureIcon>
            <FeatureText>Clear feedback on dismissal actions and blocking reasons</FeatureText>
          </FeatureItem>
        </FeatureList>
      </DemoSection>

      {/* Control Panel */}
      <DemoSection>
        <SectionTitle>Control Panel</SectionTitle>
        <ControlPanel>
          <ControlGroup>
            <ControlLabel>Alert Priority</ControlLabel>
            <Select
              value={alertPriority}
              onChange={(value) => setAlertPriority(value as AlertPriority)}
              options={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
                { value: 'info', label: 'Info' },
              ]}
            />
          </ControlGroup>

          <ControlGroup>
            <ControlLabel>Number of Alerts</ControlLabel>
            <Input
              type="number"
              value={alertCount}
              onChange={(e) => setAlertCount(parseInt(e.target.value) || 1)}
              min={1}
              max={20}
            />
          </ControlGroup>

          <ControlGroup>
            <ControlLabel>Container Position</ControlLabel>
            <Select
              value={containerPosition}
              onChange={(value) => setContainerPosition(value as any)}
              options={[
                { value: 'top-right', label: 'Top Right' },
                { value: 'top-left', label: 'Top Left' },
                { value: 'bottom-right', label: 'Bottom Right' },
                { value: 'bottom-left', label: 'Bottom Left' },
              ]}
            />
          </ControlGroup>

          <ControlGroup>
            <ControlLabel>Grouping Options</ControlLabel>
            <Checkbox
              label="Enable grouping"
              checked={enableGrouping}
              onChange={setEnableGrouping}
            />
            <Checkbox
              label="Group by source"
              checked={groupBySource}
              onChange={setGroupBySource}
              disabled={!enableGrouping}
            />
            <Checkbox
              label="Group by priority"
              checked={groupByPriority}
              onChange={setGroupByPriority}
              disabled={!enableGrouping}
            />
            <Checkbox
              label="Group by title similarity"
              checked={groupByTitle}
              onChange={setGroupByTitle}
              disabled={!enableGrouping}
            />
          </ControlGroup>

          <ControlGroup>
            <ControlLabel>Features</ControlLabel>
            <Checkbox
              label="Enable bulk actions"
              checked={enableBulkActions}
              onChange={setEnableBulkActions}
            />
            <Checkbox
              label="Enable undo"
              checked={enableUndo}
              onChange={setEnableUndo}
            />
          </ControlGroup>
        </ControlPanel>

        {/* Action Buttons */}
        <ButtonGroup>
          <Button variant="primary" onClick={handleAddAlerts}>
            Add {alertCount} Alert{alertCount !== 1 ? 's' : ''}
          </Button>
          <Button variant="secondary" onClick={handleAddGroupedAlerts}>
            Add Grouped Alerts
          </Button>
          <Button variant="info" onClick={handleDemonstratePriorities}>
            Demo All Priorities
          </Button>
          <Button variant="warning" onClick={() => clearAlerts()}>
            Clear All Alerts
          </Button>
        </ButtonGroup>
      </DemoSection>

      {/* Status Panel */}
      <DemoSection>
        <SectionTitle>System Status</SectionTitle>
        <StatusPanel>
          <StatusGrid>
            <StatusItem>
              <StatusValue>{queueStatus.total}</StatusValue>
              <StatusLabel>Total Alerts</StatusLabel>
            </StatusItem>
            <StatusItem>
              <StatusValue>{queueStatus.processed}</StatusValue>
              <StatusLabel>Processed</StatusLabel>
            </StatusItem>
            <StatusItem>
              <StatusValue>{queueStatus.grouped}</StatusValue>
              <StatusLabel>Grouped</StatusLabel>
            </StatusItem>
            <StatusItem>
              <StatusValue>
                {Object.entries(queueStatus.byPriority)
                  .filter(([_, count]) => count > 0)
                  .map(([priority, count]) => (
                    <Badge
                      key={priority}
                      variant={getPriorityColor(priority as AlertPriority)}
                      size="small"
                      style={{ margin: '0 2px' }}
                    >
                      {priority}: {count}
                    </Badge>
                  ))}
              </StatusValue>
              <StatusLabel>By Priority</StatusLabel>
            </StatusItem>
          </StatusGrid>
        </StatusPanel>
      </DemoSection>

      {/* Priority Behavior Reference */}
      <DemoSection>
        <SectionTitle>Priority Dismissal Behaviors</SectionTitle>
        <FeatureList>
          <FeatureItem>
            <Badge variant="error" size="small">Critical</Badge>
            <FeatureText>Persistent until acknowledged - cannot be auto-dismissed</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <Badge variant="warning" size="small">High</Badge>
            <FeatureText>Stays visible until acknowledged - requires explicit action</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <Badge variant="info" size="small">Medium</Badge>
            <FeatureText>Auto-dismisses after viewing for 3+ seconds</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <Badge variant="success" size="small">Low</Badge>
            <FeatureText>Auto-dismisses after 1 minute timeout</FeatureText>
          </FeatureItem>
          <FeatureItem>
            <Badge variant="neutral" size="small">Info</Badge>
            <FeatureText>Auto-dismisses after 15 seconds, visible only in alert center</FeatureText>
          </FeatureItem>
        </FeatureList>
      </DemoSection>

      {/* Enhanced Alert Container */}
      <EnhancedAlertContainer
        position={containerPosition}
        maxVisible={5}
        groupingCriteria={enableGrouping ? groupingCriteria : {}}
        enableBulkActions={enableBulkActions}
        enableUndo={enableUndo}
      />
    </DemoContainer>
  );
};

export default EnhancedAlertDemo;