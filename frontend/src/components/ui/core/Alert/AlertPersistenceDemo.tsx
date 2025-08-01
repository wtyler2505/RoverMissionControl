/**
 * Alert Persistence Demo
 * Comprehensive demo component showing all alert persistence features
 */

import React, { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { transitionStyles, focusStyles } from '../utils';
import { BaseComponentProps } from '../types';
import { useAlertStore } from '../../../../stores/alertStore';
import { PriorityAlert } from './PriorityAlert';
import { AlertAcknowledgmentModal } from './AlertAcknowledgmentModal';
import { AlertHistoryPanel } from './AlertHistoryPanel';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { AlertContainer } from './AlertContainer';

export interface AlertPersistenceDemoProps extends BaseComponentProps {
  currentUser?: string;
}

const DemoContainer = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  max-width: 1200px;
  margin: 0 auto;
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
`;

const DemoDescription = styled.p<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0;
  max-width: 600px;
  margin: 0 auto;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const ControlPanel = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${({ theme }) => theme.spacing[6]};
  margin-bottom: ${({ theme }) => theme.spacing[8]};
`;

const ControlGroup = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing[6]};
`;

const ControlGroupTitle = styled.h3<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
`;

const ButtonGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
`;

const DemoButton = styled.button<{ 
  theme: Theme;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
}>`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  border: 1px solid;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color', 'border-color'])}
  ${({ theme }) => focusStyles(theme)}
  
  ${({ theme, variant = 'primary' }) => {
    const variants = {
      primary: css`
        background: ${theme.colors.primary};
        color: ${theme.colors.surface};
        border-color: ${theme.colors.primary};
        
        &:hover {
          background: ${theme.colors.primaryHover};
        }
      `,
      secondary: css`
        background: ${theme.colors.surface};
        color: ${theme.colors.text.primary};
        border-color: ${theme.colors.border};
        
        &:hover {
          background: ${theme.colors.background};
        }
      `,
      success: css`
        background: ${theme.colors.success};
        color: ${theme.colors.surface};
        border-color: ${theme.colors.success};
        
        &:hover {
          background: ${theme.colors.successHover || theme.colors.success};
        }
      `,
      warning: css`
        background: ${theme.colors.warning};
        color: ${theme.colors.surface};
        border-color: ${theme.colors.warning};
        
        &:hover {
          background: ${theme.colors.warningHover || theme.colors.warning};
        }
      `,
      error: css`
        background: ${theme.colors.error};
        color: ${theme.colors.surface};
        border-color: ${theme.colors.error};
        
        &:hover {
          background: ${theme.colors.errorHover || theme.colors.error};
        }
      `,
    };
    
    return variants[variant];
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const StatsGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
`;

const StatCard = styled.div<{ theme: Theme }>`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing[4]};
  text-align: center;
`;

const StatValue = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const StatLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const AlertShowcase = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[8]};
`;

const ShowcaseTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
`;

const ALERT_TEMPLATES = {
  critical: {
    title: 'Critical System Failure',
    message: 'Rover communication lost. Immediate intervention required.',
    priority: 'critical' as AlertPriority,
  },
  high: {
    title: 'High Priority Warning',
    message: 'Battery level critically low. Return to charging station recommended.',
    priority: 'high' as AlertPriority,
  },
  medium: {
    title: 'Navigation Alert',
    message: 'Obstacle detected in planned path. Route recalculation in progress.',
    priority: 'medium' as AlertPriority,
  },
  low: {
    title: 'Status Update',
    message: 'Mission waypoint reached successfully. Proceeding to next objective.',
    priority: 'low' as AlertPriority,
  },
  info: {
    title: 'Information',
    message: 'Telemetry data collection completed. 1,247 data points recorded.',
    priority: 'info' as AlertPriority,
  },
};

export const AlertPersistenceDemo: React.FC<AlertPersistenceDemoProps> = ({
  currentUser = 'Demo User',
  testId,
  className
}) => {
  const {
    alerts,
    persistedAlerts,
    syncStatus,
    acknowledgeModalAlert,
    historyPanelOpen,
    persistenceInitialized,
    addAlert,
    acknowledgeAlert,
    openAcknowledgeModal,
    closeAcknowledgeModal,
    openHistoryPanel,
    closeHistoryPanel,
    initializePersistence,
    loadPersistedAlerts,
    retryCrossTabSync,
    _persistenceService
  } = useAlertStore();

  const [stats, setStats] = useState({
    totalAlerts: 0,
    pendingSync: 0,
    conflicts: 0,
    lastSync: null as Date | null,
  });

  // Initialize persistence on mount
  useEffect(() => {
    if (!persistenceInitialized) {
      initializePersistence();
    }
  }, [persistenceInitialized, initializePersistence]);

  // Update stats periodically
  useEffect(() => {
    const updateStats = async () => {
      if (_persistenceService) {
        try {
          const syncStats = await _persistenceService.getSyncStats();
          setStats(syncStats);
        } catch (error) {
          console.error('Failed to update stats:', error);
        }
      }
    };

    updateStats();
    const interval = setInterval(updateStats, 5000);
    return () => clearInterval(interval);
  }, [_persistenceService]);

  const createAlert = async (template: keyof typeof ALERT_TEMPLATES) => {
    const alertTemplate = ALERT_TEMPLATES[template];
    await addAlert({
      ...alertTemplate,
      timestamp: new Date(),
      persistent: ['critical', 'high'].includes(alertTemplate.priority),
      source: 'demo',
    });
  };

  const handleAcknowledge = async (alertId: string, acknowledgedBy: string, reason?: string) => {
    try {
      await acknowledgeAlert(alertId, acknowledgedBy, reason);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleManualAck = (alert: any) => {
    if (_persistenceService) {
      const persistedAlert = persistedAlerts.find(p => p.id === alert.id);
      if (persistedAlert) {
        openAcknowledgeModal(persistedAlert);
      }
    }
  };

  return (
    <DemoContainer className={className} data-testid={testId}>
      <DemoHeader>
        <DemoTitle>Alert Persistence System Demo</DemoTitle>
        <DemoDescription>
          Experience the comprehensive alert persistence system with IndexedDB storage, 
          cross-tab synchronization, acknowledgment workflows, and historical tracking.
        </DemoDescription>
      </DemoHeader>

      {/* Sync Status Indicator */}
      <SyncStatusIndicator
        syncStatus={syncStatus}
        onRetrySync={retryCrossTabSync}
        position="top-right"
        size="medium"
      />

      {/* Control Panel */}
      <ControlPanel>
        <ControlGroup>
          <ControlGroupTitle>Create Test Alerts</ControlGroupTitle>
          <ButtonGrid>
            <DemoButton
              variant="error"
              onClick={() => createAlert('critical')}
            >
              Critical
            </DemoButton>
            <DemoButton
              variant="warning"
              onClick={() => createAlert('high')}
            >
              High Priority
            </DemoButton>
            <DemoButton
              variant="primary"
              onClick={() => createAlert('medium')}
            >
              Medium
            </DemoButton>
            <DemoButton
              variant="success"
              onClick={() => createAlert('low')}
            >
              Low Priority
            </DemoButton>
            <DemoButton
              variant="secondary"
              onClick={() => createAlert('info')}
            >
              Info
            </DemoButton>
          </ButtonGrid>
        </ControlGroup>

        <ControlGroup>
          <ControlGroupTitle>Persistence Actions</ControlGroupTitle>
          <ButtonGrid>
            <DemoButton
              variant="primary"
              onClick={openHistoryPanel}
            >
              View History
            </DemoButton>
            <DemoButton
              variant="secondary"
              onClick={() => loadPersistedAlerts()}
            >
              Reload Alerts
            </DemoButton>
            <DemoButton
              variant="secondary"
              onClick={retryCrossTabSync}
            >
              Retry Sync
            </DemoButton>
          </ButtonGrid>
        </ControlGroup>

        <ControlGroup>
          <ControlGroupTitle>Sync Statistics</ControlGroupTitle>
          <StatsGrid>
            <StatCard>
              <StatValue>{stats.totalAlerts}</StatValue>
              <StatLabel>Total Alerts</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{stats.pendingSync}</StatValue>
              <StatLabel>Pending Sync</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{stats.conflicts}</StatValue>
              <StatLabel>Conflicts</StatLabel>
            </StatCard>
            <StatCard>
              <StatValue>{syncStatus.connectedTabs}</StatValue>
              <StatLabel>Connected Tabs</StatLabel>
            </StatCard>
          </StatsGrid>
        </ControlGroup>
      </ControlPanel>

      {/* Alert Showcase */}  
      <AlertShowcase>
        <ShowcaseTitle>Live Alert Display</ShowcaseTitle>
        <AlertContainer maxAlerts={10} />
      </AlertShowcase>

      {/* Individual Alert Examples */}
      <AlertShowcase>
        <ShowcaseTitle>Acknowledgment Examples</ShowcaseTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PriorityAlert
            priority="critical"
            title="Critical Alert Example"
            message="This alert requires acknowledgment and cannot be dismissed without proper acknowledgment."
            requiresAcknowledgment={true}
            onAcknowledge={() => handleManualAck({ id: 'demo-critical', priority: 'critical' })}
            timestamp={new Date()}
          />
          
          <PriorityAlert
            priority="high"
            title="Acknowledged Alert Example"
            message="This alert has been acknowledged and shows acknowledgment details."
            requiresAcknowledgment={true}
            acknowledged={true}
            acknowledgedBy="Demo User"
            acknowledgedAt={new Date(Date.now() - 300000)} // 5 minutes ago
            timestamp={new Date(Date.now() - 600000)} // 10 minutes ago
          />
          
          <PriorityAlert
            priority="medium"
            title="Standard Alert Example"
            message="This is a regular alert that can be dismissed normally without acknowledgment."
            closable={true}
            onClose={() => console.log('Alert closed')}
            timestamp={new Date()}
          />
        </div>
      </AlertShowcase>

      {/* Modals and Panels */}
      <AlertAcknowledgmentModal
        alert={acknowledgeModalAlert}
        isOpen={!!acknowledgeModalAlert}
        onAcknowledge={handleAcknowledge}
        onCancel={closeAcknowledgeModal}
        onClose={closeAcknowledgeModal}
        requireReason={acknowledgeModalAlert?.priority === 'critical'}
        currentUser={currentUser}
      />

      <AlertHistoryPanel
        persistenceService={_persistenceService}
        isOpen={historyPanelOpen}
        onClose={closeHistoryPanel}
        onAlertSelect={(alert) => console.log('Selected alert:', alert)}
      />
    </DemoContainer>
  );
};