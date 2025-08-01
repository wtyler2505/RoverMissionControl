/**
 * Privacy Demo Component
 * Demonstrates all privacy and compliance features
 */

import React, { useState } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  PrivacyProvider, 
  PrivacySettings, 
  usePrivacyContext,
  ConditionalPrivacy,
  PrivacyStatus
} from './index';
import { Button } from '../ui/core/Button';
import { Card } from '../ui/core/Card';
import { usePrivacyAwareAlertStore } from '../../stores/privacyAwareAlertStore';
import { AlertPriority } from '../../theme/alertPriorities';

const DemoContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 3rem;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
`;

const DemoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const DemoCard = styled(Card)`
  padding: 2rem;
`;

const DemoTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const DemoDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin-bottom: 1.5rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const StatusDisplay = styled.div`
  background: ${props => props.theme.colors.background.tertiary};
  padding: 1rem;
  border-radius: 6px;
  margin: 1rem 0;
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
`;

const PrivacyDemoContent: React.FC = () => {
  const theme = useTheme();
  const privacy = usePrivacyContext();
  const alertStore = usePrivacyAwareAlertStore();
  const [demoStatus, setDemoStatus] = useState<string>('Ready to demonstrate privacy features');

  // Demo: Add different types of alerts
  const addDemoAlert = async (priority: AlertPriority) => {
    try {
      const alertId = await alertStore.addAlertSafe({
        message: `This is a ${priority} priority alert for privacy testing`,
        priority,
        title: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Alert`,
        closable: true,
        persistent: priority === 'critical',
        source: 'privacy-demo'
      });
      
      setDemoStatus(`Added ${priority} alert with ID: ${alertId}`);
    } catch (error) {
      setDemoStatus(`Failed to add ${priority} alert: ${error}`);
    }
  };

  // Demo: Test privacy consent
  const testPrivacyConsent = async (category: any, granted: boolean) => {
    try {
      await privacy.updateConsent(category, granted);
      setDemoStatus(`Updated consent for ${category}: ${granted}`);
    } catch (error) {
      setDemoStatus(`Failed to update consent: ${error}`);
    }
  };

  // Demo: Export data
  const testDataExport = async () => {
    try {
      await alertStore.exportPrivacyData();
      setDemoStatus('Privacy data exported successfully');
    } catch (error) {
      setDemoStatus(`Failed to export data: ${error}`);
    }
  };

  // Demo: Delete data
  const testDataDeletion = async () => {
    try {
      await alertStore.deletePrivacyData();
      setDemoStatus('Privacy data deleted successfully');
    } catch (error) {
      setDemoStatus(`Failed to delete data: ${error}`);
    }
  };

  return (
    <DemoContainer>
      <Header>
        <Title>Privacy & Compliance Demo</Title>
        <Subtitle>
          Interactive demonstration of GDPR-compliant privacy features in the 
          Rover Mission Control alert system.
        </Subtitle>
      </Header>

      {/* Privacy Status */}
      <DemoCard>
        <DemoTitle>Privacy Status</DemoTitle>
        <PrivacyStatus showDetails={true} />
        
        <StatusDisplay>
          Status: {demoStatus}
        </StatusDisplay>
      </DemoCard>

      <DemoGrid>
        {/* Alert Testing */}
        <DemoCard>
          <DemoTitle>Alert Privacy Testing</DemoTitle>
          <DemoDescription>
            Test how alerts behave with different privacy consent settings. 
            Critical alerts may still be shown for safety even without storage consent.
          </DemoDescription>
          
          <ButtonGroup>
            <Button 
              size="small" 
              variant="danger"
              onClick={() => addDemoAlert('critical')}
            >
              Add Critical Alert
            </Button>
            <Button 
              size="small" 
              variant="warning"
              onClick={() => addDemoAlert('high')}
            >
              Add High Alert
            </Button>
            <Button 
              size="small" 
              variant="secondary"
              onClick={() => addDemoAlert('medium')}
            >
              Add Medium Alert
            </Button>
            <Button 
              size="small" 
              variant="primary"
              onClick={() => addDemoAlert('info')}
            >
              Add Info Alert
            </Button>
          </ButtonGroup>

          <ConditionalPrivacy
            requiredConsents={['alerts_storage']}
            fallback={
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem',
                background: theme.colors.status.warning + '20',
                borderRadius: '4px',
                fontSize: '0.875rem'
              }}>
                Alert storage is disabled. Only temporary alerts will be shown.
              </div>
            }
          >
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem',
              background: theme.colors.status.success + '20',
              borderRadius: '4px',
              fontSize: '0.875rem'
            }}>
              Alert storage is enabled. Alerts will be persisted.
            </div>
          </ConditionalPrivacy>
        </DemoCard>

        {/* Consent Management */}
        <DemoCard>
          <DemoTitle>Consent Management</DemoTitle>
          <DemoDescription>
            Test privacy consent changes and see how they affect data collection.
          </DemoDescription>
          
          <ButtonGroup>
            <Button 
              size="small" 
              onClick={() => testPrivacyConsent('alerts_storage', true)}
            >
              Enable Alert Storage
            </Button>
            <Button 
              size="small" 
              variant="secondary"
              onClick={() => testPrivacyConsent('alerts_storage', false)}
            >
              Disable Alert Storage
            </Button>
            <Button 
              size="small" 
              onClick={() => testPrivacyConsent('usage_analytics', !privacy.hasConsent('usage_analytics'))}
            >
              Toggle Analytics
            </Button>
            <Button 
              size="small" 
              onClick={() => testPrivacyConsent('cross_device_sync', !privacy.hasConsent('cross_device_sync'))}
            >
              Toggle Sync
            </Button>
          </ButtonGroup>
        </DemoCard>

        {/* Data Rights */}
        <DemoCard>
          <DemoTitle>Data Rights (GDPR)</DemoTitle>
          <DemoDescription>
            Exercise your data rights: export your data or request deletion 
            as required by GDPR regulations.
          </DemoDescription>
          
          <ButtonGroup>
            <Button 
              size="small" 
              variant="primary"
              onClick={testDataExport}
            >
              Export My Data
            </Button>
            <Button 
              size="small" 
              variant="danger"
              onClick={testDataDeletion}
            >
              Delete My Data
            </Button>
            <Button 
              size="small" 
              variant="secondary"
              onClick={() => privacy.withdrawAllConsent()}
            >
              Withdraw All Consent
            </Button>
          </ButtonGroup>
        </DemoCard>

        {/* Analytics Consent Demo */}
        <DemoCard>
          <DemoTitle>Analytics Consent</DemoTitle>
          <DemoDescription>
            This section is only visible when analytics consent is granted.
          </DemoDescription>
          
          <ConditionalPrivacy
            requiredConsents={['usage_analytics']}
            fallback={
              <div style={{ 
                padding: '1rem',
                background: theme.colors.background.tertiary,
                borderRadius: '4px',
                textAlign: 'center',
                color: theme.colors.text.secondary,
                fontStyle: 'italic'
              }}>
                Analytics features are disabled. Grant analytics consent to see usage data.
              </div>
            }
          >
            <div style={{ 
              padding: '1rem',
              background: theme.colors.status.success + '20',
              borderRadius: '4px'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text.primary }}>
                Analytics Dashboard
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                This would show usage analytics, performance metrics, and other 
                data collection features that require user consent.
              </p>
            </div>
          </ConditionalPrivacy>
        </DemoCard>

        {/* Cross-Device Sync Demo */}
        <DemoCard>
          <DemoTitle>Cross-Device Sync</DemoTitle>
          <DemoDescription>
            Features that sync data across devices require explicit consent.
          </DemoDescription>
          
          <ConditionalPrivacy
            requiredConsents={['cross_device_sync']}
            fallback={
              <div style={{ 
                padding: '1rem',
                background: theme.colors.background.tertiary,
                borderRadius: '4px',
                textAlign: 'center',
                color: theme.colors.text.secondary,
                fontStyle: 'italic'
              }}>
                Cross-device sync is disabled. Your data stays on this device only.
              </div>
            }
          >
            <div style={{ 
              padding: '1rem',
              background: theme.colors.primary + '20',
              borderRadius: '4px'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text.primary }}>
                Sync Status: Active
              </h3>
              <p style={{ margin: 0, fontSize: '0.875rem', color: theme.colors.text.secondary }}>
                Your alerts and preferences are being synchronized across all your devices.
              </p>
            </div>
          </ConditionalPrivacy>
        </DemoCard>

        {/* Privacy Settings Panel */}
        <DemoCard style={{ gridColumn: '1 / -1' }}>
          <DemoTitle>Full Privacy Settings</DemoTitle>
          <DemoDescription>
            Complete privacy control panel with all available options.
          </DemoDescription>
          
          <PrivacySettings 
            onConsentChange={(category, granted) => {
              setDemoStatus(`Consent changed: ${category} = ${granted}`);
            }}
            onExportData={() => {
              setDemoStatus('Data export requested from privacy settings');
            }}
            onDeleteData={() => {
              setDemoStatus('Data deletion requested from privacy settings');
            }}
          />
        </DemoCard>
      </DemoGrid>
    </DemoContainer>
  );
};

export const PrivacyDemo: React.FC = () => {
  return (
    <PrivacyProvider
      autoShowInitialConsent={false} // Disable for demo
      onInitialConsentComplete={(consents) => {
        console.log('Demo: Initial consent completed:', consents);
      }}
      onConsentChange={(category, granted) => {
        console.log('Demo: Consent changed:', category, granted);
      }}
    >
      <PrivacyDemoContent />
    </PrivacyProvider>
  );
};