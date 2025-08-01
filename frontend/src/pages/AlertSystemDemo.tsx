/**
 * Alert System Demo Page
 * Showcases the complete Priority-based Alert System with WebSocket integration
 */

import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { Theme } from '../theme/themes';
import { useTheme } from '../theme/ThemeProvider';
import { AlertContainer, AlertStatusBar } from '../components/ui/core/Alert/AlertContainer';
import { useAlertStore, alertCreators } from '../stores/alertStore';
import { AlertPriority } from '../theme/alertPriorities';

const PageContainer = styled.div<{ theme: Theme }>`
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background.default};
  color: ${({ theme }) => theme.colors.text.primary};
  padding-bottom: 40px; /* Space for status bar */
`;

const Header = styled.header<{ theme: Theme }>`
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[6]};
`;

const Title = styled.h1<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin: 0;
`;

const Content = styled.main<{ theme: Theme }>`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing[6]};
`;

const Section = styled.section<{ theme: Theme }>`
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing[6]};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

const SectionTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const ControlGroup = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const Button = styled.button<{ theme: Theme; variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${({ theme, variant = 'primary' }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${theme.colors.primary.main};
          color: ${theme.colors.primary.contrast};
          &:hover {
            background-color: ${theme.colors.primary.dark};
          }
        `;
      case 'secondary':
        return `
          background-color: ${theme.colors.secondary.main};
          color: ${theme.colors.secondary.contrast};
          &:hover {
            background-color: ${theme.colors.secondary.dark};
          }
        `;
      case 'danger':
        return `
          background-color: ${theme.colors.error.main};
          color: ${theme.colors.error.contrast};
          &:hover {
            background-color: ${theme.colors.error.dark};
          }
        `;
    }
  }}
`;

const Select = styled.select<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme }) => theme.colors.background.default};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const Label = styled.label<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const Checkbox = styled.input<{ theme: Theme }>`
  width: 16px;
  height: 16px;
`;

const Grid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
`;

const Card = styled.div<{ theme: Theme }>`
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
`;

const CardTitle = styled.h3<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`;

const Stat = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary.main};
`;

const StatLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

export const AlertSystemDemo: React.FC = () => {
  const { currentTheme, setTheme } = useTheme();
  const { addAlert, clearAlerts, queueStatus, updateConfig } = useAlertStore();
  
  const [alertPosition, setAlertPosition] = useState<any>('top-right');
  const [maxVisible, setMaxVisible] = useState(5);
  const [selectedPriority, setSelectedPriority] = useState<AlertPriority>('medium');
  const [customMessage, setCustomMessage] = useState('');
  const [simulationRunning, setSimulationRunning] = useState(false);

  // Simulation scenarios
  const runMissionSimulation = () => {
    setSimulationRunning(true);
    const events = [
      { delay: 0, ...alertCreators.info('Mission sequence initiated') },
      { delay: 1000, ...alertCreators.success('All systems nominal') },
      { delay: 2000, ...alertCreators.info('Telemetry link established') },
      { delay: 3000, ...alertCreators.warning('Solar panel efficiency at 82%') },
      { delay: 4000, ...alertCreators.info('Navigation system online') },
      { delay: 5000, ...alertCreators.error('Communication latency detected') },
      { delay: 6000, ...alertCreators.critical('Obstacle detected - Emergency stop activated!') },
      { delay: 8000, ...alertCreators.success('Obstacle avoided successfully') },
      { delay: 9000, ...alertCreators.info('Mission resumed') },
    ];

    events.forEach(({ delay, ...alert }) => {
      setTimeout(() => addAlert(alert), delay);
    });

    setTimeout(() => setSimulationRunning(false), 10000);
  };

  const runStressTest = () => {
    const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
    const messages = [
      'System resource usage spike detected',
      'Temperature anomaly in module',
      'Network packet loss observed',
      'Backup system activated',
      'Diagnostic scan completed',
    ];

    for (let i = 0; i < 50; i++) {
      setTimeout(() => {
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const message = messages[Math.floor(Math.random() * messages.length)] + ` #${i + 1}`;
        addAlert({ priority, message });
      }, i * 100);
    }
  };

  const addCustomAlert = () => {
    if (!customMessage.trim()) return;
    
    addAlert({
      priority: selectedPriority,
      message: customMessage,
      title: `Custom ${selectedPriority} Alert`,
      closable: true,
    });
    
    setCustomMessage('');
  };

  // Theme scenarios
  const themes = [
    { value: 'default', label: 'Default (Light)' },
    { value: 'dark', label: 'Dark Mode' },
    { value: 'highContrast', label: 'High Contrast' },
    { value: 'missionCritical', label: 'Mission Critical' },
  ];

  const positions = [
    { value: 'top-right', label: 'Top Right' },
    { value: 'top-left', label: 'Top Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'top-center', label: 'Top Center' },
    { value: 'bottom-center', label: 'Bottom Center' },
  ];

  return (
    <PageContainer>
      <Header>
        <Title>Alert System Demo</Title>
      </Header>

      <Content>
        <Section>
          <SectionTitle>System Configuration</SectionTitle>
          
          <ControlGroup>
            <Label>
              Theme:
              <Select value={currentTheme} onChange={(e) => setTheme(e.target.value as any)}>
                {themes.map(theme => (
                  <option key={theme.value} value={theme.value}>
                    {theme.label}
                  </option>
                ))}
              </Select>
            </Label>

            <Label>
              Position:
              <Select value={alertPosition} onChange={(e) => setAlertPosition(e.target.value)}>
                {positions.map(pos => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </Select>
            </Label>

            <Label>
              Max Visible:
              <Select value={maxVisible} onChange={(e) => setMaxVisible(Number(e.target.value))}>
                {[3, 5, 10, 20].map(num => (
                  <option key={num} value={num}>{num} alerts</option>
                ))}
              </Select>
            </Label>
          </ControlGroup>
        </Section>

        <Section>
          <SectionTitle>Alert Controls</SectionTitle>
          
          <ControlGroup>
            <Button onClick={() => addAlert(alertCreators.critical('System critical failure detected'))}>
              Add Critical
            </Button>
            <Button onClick={() => addAlert(alertCreators.error('Operation failed'))}>
              Add Error
            </Button>
            <Button onClick={() => addAlert(alertCreators.warning('Resource usage high'))}>
              Add Warning
            </Button>
            <Button onClick={() => addAlert(alertCreators.success('Operation completed'))}>
              Add Success
            </Button>
            <Button onClick={() => addAlert(alertCreators.info('System update available'))}>
              Add Info
            </Button>
            <Button variant="danger" onClick={() => clearAlerts()}>
              Clear All
            </Button>
          </ControlGroup>

          <ControlGroup>
            <Select 
              value={selectedPriority} 
              onChange={(e) => setSelectedPriority(e.target.value as AlertPriority)}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </Select>
            <input
              type="text"
              placeholder="Custom alert message..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCustomAlert()}
              style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <Button onClick={addCustomAlert}>Add Custom</Button>
          </ControlGroup>
        </Section>

        <Section>
          <SectionTitle>Simulation Scenarios</SectionTitle>
          
          <ControlGroup>
            <Button 
              onClick={runMissionSimulation} 
              disabled={simulationRunning}
            >
              {simulationRunning ? 'Running...' : 'Run Mission Simulation'}
            </Button>
            <Button onClick={runStressTest}>
              Run Stress Test (50 alerts)
            </Button>
            <Button onClick={() => {
              for (let i = 0; i < 5; i++) {
                addAlert({
                  priority: 'medium',
                  message: `Grouped notification ${i + 1}`,
                  groupId: 'group-1',
                });
              }
            }}>
              Add Grouped Alerts
            </Button>
          </ControlGroup>
        </Section>

        <Section>
          <SectionTitle>Queue Statistics</SectionTitle>
          
          <Grid>
            <Card>
              <CardTitle>Total Alerts</CardTitle>
              <Stat>{queueStatus.total}</Stat>
              <StatLabel>in queue</StatLabel>
            </Card>
            
            <Card>
              <CardTitle>Critical</CardTitle>
              <Stat>{queueStatus.byPriority.critical}</Stat>
              <StatLabel>alerts</StatLabel>
            </Card>
            
            <Card>
              <CardTitle>High Priority</CardTitle>
              <Stat>{queueStatus.byPriority.high}</Stat>
              <StatLabel>alerts</StatLabel>
            </Card>
            
            <Card>
              <CardTitle>Grouped</CardTitle>
              <Stat>{queueStatus.grouped}</Stat>
              <StatLabel>groups</StatLabel>
            </Card>
          </Grid>
        </Section>
      </Content>

      {/* Alert Container */}
      <AlertContainer 
        position={alertPosition} 
        maxVisible={maxVisible}
        groupSimilar={true}
      />
      
      {/* Status Bar */}
      <AlertStatusBar />
    </PageContainer>
  );
};