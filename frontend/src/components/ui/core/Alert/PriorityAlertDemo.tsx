import React, { useState } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '../../../../theme/ThemeProvider';
import { PriorityAlert, AlertPriority } from './index';
import { Theme } from '../../../../theme/themes';

const DemoContainer = styled.div<{ theme: Theme }>`
  max-width: 800px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing[8]};
  background-color: ${({ theme }) => theme.colors.background.default};
  min-height: 100vh;
`;

const Header = styled.h1<{ theme: Theme }>`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[8]};
  font-size: ${({ theme }) => theme.typography.fontSize['3xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
`;

const Section = styled.section<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[8]};
`;

const SectionTitle = styled.h2<{ theme: Theme }>`
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

const Controls = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[4]};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
  padding: ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  flex-wrap: wrap;
`;

const Button = styled.button<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.primary.main};
  color: ${({ theme }) => theme.colors.primary.contrast};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.primary.dark};
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

const Select = styled.select<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[2]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const AlertWrapper = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const ThemeInfo = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

interface Alert {
  id: string;
  priority: AlertPriority;
  title: string;
  message: string;
  timestamp: Date;
  persistent?: boolean;
}

export const PriorityAlertDemo: React.FC = () => {
  const { currentTheme, setTheme } = useTheme();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [nextPriority, setNextPriority] = useState<AlertPriority>('medium');

  const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];

  const addAlert = (priority: AlertPriority, persistent = false) => {
    const messages = {
      critical: 'System failure detected! Immediate action required.',
      high: 'Resource usage exceeding threshold. Investigation needed.',
      medium: 'New update available. Consider installing at your convenience.',
      low: 'Routine maintenance scheduled for next week.',
      info: 'System metrics collected successfully.',
    };

    const titles = {
      critical: 'Critical System Alert',
      high: 'High Priority Warning',
      medium: 'Medium Priority Notice',
      low: 'Low Priority Update',
      info: 'Information',
    };

    const newAlert: Alert = {
      id: Date.now().toString(),
      priority,
      title: titles[priority],
      message: messages[priority],
      timestamp: new Date(),
      persistent,
    };

    setAlerts(prev => [...prev, newAlert]);
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const addSampleSet = () => {
    priorities.forEach((priority, index) => {
      setTimeout(() => {
        addAlert(priority);
      }, index * 300);
    });
  };

  return (
    <DemoContainer>
      <Header>Priority Alert System Demo</Header>

      <ThemeInfo>
        Current Theme: <strong>{currentTheme}</strong>
      </ThemeInfo>

      <Controls>
        <Select 
          value={currentTheme} 
          onChange={(e) => setTheme(e.target.value as any)}
        >
          <option value="default">Default (Light)</option>
          <option value="dark">Dark</option>
          <option value="highContrast">High Contrast</option>
          <option value="missionCritical">Mission Critical</option>
        </Select>

        <Select 
          value={nextPriority} 
          onChange={(e) => setNextPriority(e.target.value as AlertPriority)}
        >
          {priorities.map(p => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)} Priority
            </option>
          ))}
        </Select>

        <Button onClick={() => addAlert(nextPriority)}>
          Add Alert
        </Button>

        <Button onClick={() => addAlert(nextPriority, true)}>
          Add Persistent Alert
        </Button>

        <Button onClick={addSampleSet}>
          Add Sample Set
        </Button>

        <Button onClick={clearAllAlerts}>
          Clear All
        </Button>
      </Controls>

      <Section>
        <SectionTitle>Active Alerts ({alerts.length})</SectionTitle>
        
        {alerts.map(alert => (
          <AlertWrapper key={alert.id}>
            <PriorityAlert
              priority={alert.priority}
              title={alert.title}
              message={alert.message}
              timestamp={alert.timestamp}
              closable
              persistent={alert.persistent}
              onClose={() => removeAlert(alert.id)}
              action={
                alert.priority === 'critical' || alert.priority === 'high' ? (
                  <Button>Take Action</Button>
                ) : undefined
              }
            />
          </AlertWrapper>
        ))}
        
        {alerts.length === 0 && (
          <AlertWrapper>
            <PriorityAlert
              priority="info"
              message="No active alerts. Use the controls above to add alerts and test theme integration."
            />
          </AlertWrapper>
        )}
      </Section>

      <Section>
        <SectionTitle>All Priority Levels</SectionTitle>
        
        {priorities.map(priority => (
          <AlertWrapper key={priority}>
            <PriorityAlert
              priority={priority}
              title={`${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority Example`}
              message={`This is an example of a ${priority} priority alert in the ${currentTheme} theme.`}
              closable
              onClose={() => {}}
            />
          </AlertWrapper>
        ))}
      </Section>
    </DemoContainer>
  );
};