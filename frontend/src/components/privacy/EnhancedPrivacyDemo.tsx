/**
 * Enhanced Privacy Demo Component
 * Demonstrates all the enhanced consent management features
 */

import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { EnhancedConsentSettings } from './EnhancedConsentSettings';
import { ContextualConsentDialog } from './ContextualConsentDialog';
import { ConsentReviewReminder } from './ConsentReviewReminder';
import { usePrivacyConsent } from '../../hooks/usePrivacyConsent';
import { consentVersioningService } from '../../services/privacy/ConsentVersioningService';
import { ConsentCategory } from '../../services/privacy/ConsentManager';
import { Button } from '../ui/core/Button';
import { Card } from '../ui/core/Card';

const Container = styled.div`
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
  font-size: 1.25rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  max-width: 800px;
  margin: 0 auto;
`;

const DemoControls = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const ControlCard = styled(Card)`
  padding: 2rem;
`;

const ControlTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const ControlDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin-bottom: 1.5rem;
`;

const ControlActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const StatusSection = styled.div`
  margin-bottom: 3rem;
`;

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
`;

const StatusCard = styled.div`
  padding: 1.5rem;
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  text-align: center;
`;

const StatusValue = styled.div`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
  margin-bottom: 0.5rem;
`;

const StatusLabel = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const StatusIndicator = styled.div<{ status: 'good' | 'warning' | 'error' }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => {
    switch (props.status) {
      case 'good': return props.theme.colors.status.success;
      case 'warning': return props.theme.colors.status.warning;
      case 'error': return props.theme.colors.status.error;
      default: return props.theme.colors.border.secondary;
    }
  }};
  margin: 0 auto 0.5rem;
`;

const FeatureSection = styled.div`
  margin-bottom: 3rem;
`;

const SectionHeader = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const SectionDescription = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
`;

interface EnhancedPrivacyDemoProps {
  className?: string;
}

export const EnhancedPrivacyDemo: React.FC<EnhancedPrivacyDemoProps> = ({
  className
}) => {
  const theme = useTheme();
  const privacy = usePrivacyConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [showContextualDialog, setShowContextualDialog] = useState(false);
  const [contextualConsent, setContextualConsent] = useState<{
    required: ConsentCategory[];
    optional: ConsentCategory[];
    alreadyGranted: ConsentCategory[];
  }>({ required: [], optional: [], alreadyGranted: [] });

  // Demo contextual consent scenarios
  const demoScenarios = [
    {
      name: 'Rover Telemetry Analysis',
      icon: '🤖',
      reason: 'Enable advanced telemetry analysis to optimize rover performance and predict maintenance needs.',
      benefits: [
        'Real-time performance optimization',
        'Predictive maintenance alerts',
        'Improved mission success rates',
        'Historical performance tracking'
      ],
      consequences: 'Without telemetry data, performance optimization and maintenance predictions will be limited.',
      categories: ['location_telemetry', 'sensor_telemetry', 'performance_detailed'] as ConsentCategory[]
    },
    {
      name: 'Emergency Response System',
      icon: '🚨',
      reason: 'Activate enhanced emergency response features for critical mission situations.',
      benefits: [
        'Faster emergency response times',
        'Automatic backup system activation',
        'Enhanced safety monitoring',
        'Emergency contact notifications'
      ],
      consequences: 'Emergency response features will operate with basic functionality only.',
      categories: ['alerts_critical', 'diagnostic_crash_reports'] as ConsentCategory[]
    },
    {
      name: 'Multi-Device Mission Control',
      icon: '📱',
      reason: 'Sync your mission data across multiple devices for seamless control room operations.',
      benefits: [
        'Access data from any device',
        'Real-time synchronization',
        'Backup of critical settings',
        'Team collaboration features'
      ],
      consequences: 'Data will only be available on the current device.',
      categories: ['cross_device_sync', 'user_customization'] as ConsentCategory[]
    }
  ];

  // Handle demo contextual consent
  const handleDemoContextualConsent = useCallback(async (scenario: typeof demoScenarios[0]) => {
    try {
      const result = await privacy.requestContextualConsent(scenario.categories, {
        featureName: scenario.name,
        reason: scenario.reason,
        benefits: scenario.benefits,
        consequences: scenario.consequences
      });
      
      setContextualConsent(result);
      setShowContextualDialog(true);
    } catch (error) {
      console.error('Failed to request contextual consent:', error);
    }
  }, [privacy]);

  // Handle policy update simulation
  const handleSimulatePolicyUpdate = useCallback(async (updateType: 'minor' | 'major' | 'gdpr') => {
    try {
      const updates = {
        minor: consentVersioningService.constructor.COMMON_UPDATES.SECURITY_ENHANCEMENT,
        major: consentVersioningService.constructor.COMMON_UPDATES.THIRD_PARTY_INTEGRATION,
        gdpr: consentVersioningService.constructor.COMMON_UPDATES.GDPR_COMPLIANCE
      };

      const update = updates[updateType];
      await consentVersioningService.createPolicyVersion(
        update.version,
        update.changes
      );

      // Refresh privacy state
      await privacy.refresh();
      
      alert(`Policy update ${update.version} created! Check for review notifications.`);
    } catch (error) {
      console.error('Failed to simulate policy update:', error);
    }
  }, [privacy]);

  // Get status indicators
  const getReviewStatus = () => {
    if (privacy.reviewOverdue) return 'error';
    if (privacy.needsReview) return 'warning';
    return 'good';
  };

  const getPolicyStatus = () => {
    if (privacy.policyUpdatesAvailable) return 'warning';
    return 'good';
  };

  return (
    <Container className={className}>
      <Header>
        <Title>Enhanced Consent Management System</Title>
        <Subtitle>
          A comprehensive GDPR-compliant privacy management system with granular controls, 
          consent history tracking, contextual requests, and automated policy versioning.
        </Subtitle>
      </Header>

      {/* Status Overview */}
      <StatusSection>
        <SectionHeader>
          <SectionTitle>Privacy Status Overview</SectionTitle>
          <SectionDescription>
            Real-time overview of your privacy settings and compliance status
          </SectionDescription>
        </SectionHeader>
        
        <StatusGrid>
          <StatusCard>
            <StatusIndicator status={getReviewStatus()} />
            <StatusValue>
              {privacy.needsReview ? (privacy.reviewOverdue ? 'Overdue' : 'Due') : 'Current'}
            </StatusValue>
            <StatusLabel>Review Status</StatusLabel>
          </StatusCard>
          
          <StatusCard>
            <StatusIndicator status={getPolicyStatus()} />
            <StatusValue>
              {privacy.policyUpdatesAvailable ? 'Updates' : 'Current'}
            </StatusValue>
            <StatusLabel>Policy Status</StatusLabel>
          </StatusCard>
          
          <StatusCard>
            <StatusValue>{privacy.statistics?.categoriesWithConsent || 0}</StatusValue>
            <StatusLabel>Permissions Enabled</StatusLabel>
          </StatusCard>
          
          <StatusCard>
            <StatusValue>{privacy.statistics?.totalChanges || 0}</StatusValue>
            <StatusLabel>Total Changes</StatusLabel>
          </StatusCard>
          
          <StatusCard>
            <StatusValue>
              {privacy.daysOverdue > 0 ? `${privacy.daysOverdue}d` : '0'}
            </StatusValue>
            <StatusLabel>Days Overdue</StatusLabel>
          </StatusCard>
        </StatusGrid>
      </StatusSection>

      {/* Demo Controls */}
      <FeatureSection>
        <SectionHeader>
          <SectionTitle>Interactive Demos</SectionTitle>
          <SectionDescription>
            Try out the enhanced consent management features with these interactive demonstrations
          </SectionDescription>
        </SectionHeader>
        
        <DemoControls>
          {/* Granular Settings */}
          <ControlCard>
            <ControlTitle>Enhanced Privacy Settings</ControlTitle>
            <ControlDescription>
              Explore the comprehensive privacy settings interface with detailed explanations, 
              granular controls, consent history, and analytics dashboard.
            </ControlDescription>
            <ControlActions>
              <Button
                variant="primary"
                onClick={() => setShowSettings(true)}
              >
                Open Enhanced Settings
              </Button>
            </ControlActions>
          </ControlCard>

          {/* Contextual Consent */}
          <ControlCard>
            <ControlTitle>Contextual Consent Requests</ControlTitle>
            <ControlDescription>
              Experience how new features request additional permissions with detailed 
              explanations and user-friendly consent dialogs.
            </ControlDescription>
            <ControlActions>
              {demoScenarios.map(scenario => (
                <Button
                  key={scenario.name}
                  variant="secondary"
                  size="small"
                  onClick={() => handleDemoContextualConsent(scenario)}
                >
                  {scenario.icon} {scenario.name}
                </Button>
              ))}
            </ControlActions>
          </ControlCard>

          {/* Policy Updates */}
          <ControlCard>
            <ControlTitle>Policy Version Management</ControlTitle>
            <ControlDescription>
              Simulate privacy policy updates and see how users are notified 
              and guided through consent renewal processes.
            </ControlDescription>
            <ControlActions>
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleSimulatePolicyUpdate('minor')}
              >
                Minor Security Update
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleSimulatePolicyUpdate('major')}
              >
                Third-Party Integration
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => handleSimulatePolicyUpdate('gdpr')}
              >
                GDPR Compliance Update
              </Button>
            </ControlActions>
          </ControlCard>

          {/* Review System */}
          <ControlCard>
            <ControlTitle>Consent Review System</ControlTitle>
            <ControlDescription>
              Test the periodic review reminders and see how users are guided 
              through reviewing and updating their privacy preferences.
            </ControlDescription>
            <ControlActions>
              <Button
                variant="secondary"
                onClick={privacy.completeReview}
                disabled={!privacy.needsReview}
              >
                {privacy.needsReview ? 'Complete Review' : 'Review Up to Date'}
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={() => privacy.checkPolicyUpdates()}
              >
                Check for Updates
              </Button>
            </ControlActions>
          </ControlCard>
        </DemoControls>
      </FeatureSection>

      {/* Enhanced Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{
            backgroundColor: theme.colors.background.primary,
            borderRadius: '8px',
            maxWidth: '95vw',
            maxHeight: '95vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                zIndex: 1001,
                color: theme.colors.text.secondary
              }}
            >
              ✕
            </button>
            <EnhancedConsentSettings
              onConsentChange={(category, granted) => {
                console.log(`Consent changed: ${category} = ${granted}`);
              }}
              showHistoryByDefault={false}
              enableContextualRequests={true}
            />
          </div>
        </div>
      )}

      {/* Contextual Consent Dialog */}
      <ContextualConsentDialog
        isOpen={showContextualDialog}
        onClose={() => setShowContextualDialog(false)}
        onComplete={(consents) => {
          console.log('Contextual consent completed:', consents);
          setShowContextualDialog(false);
          privacy.refresh();
        }}
        context={{
          featureName: 'Demo Feature',
          reason: 'This is a demonstration of contextual consent.',
          benefits: ['Enhanced functionality', 'Better user experience'],
          consequences: 'Feature will operate with limited functionality.',
          icon: '🚀'
        }}
        requiredCategories={contextualConsent.required}
        optionalCategories={contextualConsent.optional}
        alreadyGrantedCategories={contextualConsent.alreadyGranted}
      />

      {/* Review Reminder Component */}
      <ConsentReviewReminder
        onOpenSettings={() => setShowSettings(true)}
        onComplete={() => {
          console.log('Review completed via reminder');
          privacy.refresh();
        }}
        checkInterval={10000} // Check every 10 seconds for demo
      />

      {/* Feature Highlights */}
      <FeatureSection>
        <SectionHeader>
          <SectionTitle>Key Features</SectionTitle>
          <SectionDescription>
            This enhanced consent management system provides comprehensive GDPR compliance 
            with user-friendly interfaces and transparent data handling.
          </SectionDescription>
        </SectionHeader>

        <DemoControls>
          <ControlCard>
            <ControlTitle>🎯 Granular Consent Categories</ControlTitle>
            <ControlDescription>
              More detailed consent categories including specific alert types, 
              telemetry data collection, and feature-specific permissions with 
              clear explanations of data usage and benefits.
            </ControlDescription>
          </ControlCard>

          <ControlCard>
            <ControlTitle>📊 Comprehensive Consent History</ControlTitle>
            <ControlDescription>
              Complete audit trail of all consent changes with timestamps, 
              reasons for changes, IP addresses (where legally required), 
              and policy versions for full GDPR compliance.
            </ControlDescription>
          </ControlCard>

          <ControlCard>
            <ControlTitle>🔄 Periodic Review System</ControlTitle>
            <ControlDescription>
              Automated reminders for users to review their privacy settings 
              with customizable frequencies and gentle notification systems 
              that respect user preferences.
            </ControlDescription>
          </ControlCard>

          <ControlCard>
            <ControlTitle>📝 Policy Version Management</ControlTitle>
            <ControlDescription>
              Sophisticated privacy policy versioning with change tracking, 
              user notification systems, and guided consent renewal processes 
              for policy updates.
            </ControlDescription>
          </ControlCard>

          <ControlCard>
            <ControlTitle>🎨 Contextual Consent Requests</ControlTitle>
            <ControlDescription>
              Smart consent requests that appear when users try to use features 
              requiring additional permissions, with clear explanations of 
              benefits and consequences.
            </ControlDescription>
          </ControlCard>

          <ControlCard>
            <ControlTitle>📈 Privacy Analytics Dashboard</ControlTitle>
            <ControlDescription>
              User-facing analytics showing consent patterns, change history, 
              and privacy preference insights to help users understand their 
              data sharing decisions.
            </ControlDescription>
          </ControlCard>
        </DemoControls>
      </FeatureSection>
    </Container>
  );
};