/**
 * Initial Consent Dialog
 * GDPR-compliant first-time user experience for collecting consent
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  ConsentManager, 
  ConsentCategory, 
  ConsentConfiguration,
  consentManager 
} from '../../services/privacy/ConsentManager';
import { Modal } from '../ui/core/Modal';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';
import { Card } from '../ui/core/Card';

interface InitialConsentDialogProps {
  isOpen: boolean;
  onConsentComplete: (consents: Record<ConsentCategory, boolean>) => void;
  onClose?: () => void;
}

const DialogContent = styled.div`
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const Introduction = styled.div`
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 8px;
  border-left: 4px solid ${props => props.theme.colors.primary};
`;

const IntroText = styled.p`
  font-size: 0.875rem;
  line-height: 1.6;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
`;

const ConsentSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const ConsentGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const GroupTitle = styled.h3`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
`;

const ConsentItem = styled.div<{ required?: boolean }>`
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 6px;
  margin-bottom: 0.75rem;
  background: ${props => props.theme.colors.background.secondary};
  opacity: ${props => props.required ? 0.8 : 1};
`;

const ConsentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
`;

const ConsentName = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  flex: 1;
`;

const RequiredBadge = styled.span`
  background: ${props => props.theme.colors.status.warning};
  color: ${props => props.theme.colors.text.primary};
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 500;
  margin-left: 0.5rem;
`;

const ConsentDescription = styled.p`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.4;
  margin: 0 0 0.75rem 0;
`;

const ConsentToggle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ToggleLabel = styled.label`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
`;

const Actions = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  border-top: 1px solid ${props => props.theme.colors.border.secondary};
`;

const Summary = styled.div`
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 6px;
`;

const SummaryTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.5rem 0;
`;

const SummaryText = styled.p`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
  line-height: 1.4;
`;

const ErrorMessage = styled.div`
  padding: 0.75rem;
  background: ${props => props.theme.colors.status.error}20;
  border: 1px solid ${props => props.theme.colors.status.error};
  border-radius: 4px;
  color: ${props => props.theme.colors.status.error};
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid ${props => props.theme.colors.border.secondary};
  border-radius: 50%;
  border-top-color: ${props => props.theme.colors.primary};
  animation: spin 1s ease-in-out infinite;
  margin-right: 0.5rem;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

export const InitialConsentDialog: React.FC<InitialConsentDialogProps> = ({
  isOpen,
  onConsentComplete,
  onClose
}) => {
  const theme = useTheme();
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({} as any);
  const [configurations, setConfigurations] = useState<ConsentConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group configurations by type for better organization
  const essentialConfigs = configurations.filter(config => config.required);
  const functionalConfigs = configurations.filter(config => 
    !config.required && ['alerts_storage', 'user_preferences', 'cross_device_sync'].includes(config.category)
  );
  const analyticsConfigs = configurations.filter(config => 
    !config.required && ['usage_analytics', 'performance_monitoring', 'diagnostic_data'].includes(config.category)
  );

  // Load initial data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);
        await consentManager.initialize();
        
        const [currentConsents, configs] = await Promise.all([
          consentManager.getAllConsents(),
          Promise.resolve(consentManager.getAllConsentConfigurations())
        ]);
        
        setConsents(currentConsents);
        setConfigurations(configs);
        setError(null);
      } catch (err) {
        console.error('Failed to load consent data:', err);
        setError('Failed to load consent options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Handle consent toggle
  const handleConsentToggle = useCallback((category: ConsentCategory, granted: boolean) => {
    const config = configurations.find(c => c.category === category);
    
    // Don't allow toggling required consents
    if (config?.required) {
      return;
    }

    setConsents(prev => ({
      ...prev,
      [category]: granted
    }));
  }, [configurations]);

  // Handle accept all
  const handleAcceptAll = useCallback(() => {
    const allConsents: Record<ConsentCategory, boolean> = {} as any;
    
    configurations.forEach(config => {
      allConsents[config.category] = true;
    });
    
    setConsents(allConsents);
  }, [configurations]);

  // Handle essential only
  const handleEssentialOnly = useCallback(() => {
    const essentialConsents: Record<ConsentCategory, boolean> = {} as any;
    
    configurations.forEach(config => {
      essentialConsents[config.category] = config.required || config.defaultValue;
    });
    
    setConsents(essentialConsents);
  }, [configurations]);

  // Handle save and continue
  const handleSaveAndContinue = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Save all consent preferences
      const consentUpdates = Object.entries(consents).map(([category, granted]) => ({
        category: category as ConsentCategory,
        granted
      }));
      
      await consentManager.updateMultipleConsents(consentUpdates, 'initial');
      
      // Notify parent component
      onConsentComplete(consents);
      
    } catch (err) {
      console.error('Failed to save consent preferences:', err);
      setError('Failed to save your privacy preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [consents, onConsentComplete]);

  // Count consents
  const totalOptional = configurations.filter(c => !c.required).length;
  const acceptedOptional = Object.entries(consents)
    .filter(([category, granted]) => {
      const config = configurations.find(c => c.category === category);
      return config && !config.required && granted;
    }).length;

  if (loading) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Privacy Settings"
        size="large"
        closeOnOverlayClick={false}
        closeOnEscapeKey={false}
      >
        <DialogContent>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <LoadingSpinner />
            <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
              Loading privacy options...
            </p>
          </div>
        </DialogContent>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Welcome to Rover Mission Control"
      size="large"
      closeOnOverlayClick={false}
      closeOnEscapeKey={false}
    >
      <DialogContent>
        <Header>
          <Title>Privacy & Data Collection</Title>
          <Subtitle>
            We respect your privacy. Please review and customize your data collection preferences.
          </Subtitle>
        </Header>

        <Introduction>
          <IntroText>
            <strong>Your data, your choice.</strong> We only collect data that helps improve your experience 
            or is required for the application to function. You can change these preferences at any time 
            in your privacy settings.
          </IntroText>
        </Introduction>

        {error && <ErrorMessage role="alert">{error}</ErrorMessage>}

        <ConsentSection>
          {/* Essential Permissions */}
          <ConsentGroup>
            <GroupTitle>Essential (Required)</GroupTitle>
            {essentialConfigs.map(config => (
              <ConsentItem key={config.category} required={config.required}>
                <ConsentHeader>
                  <ConsentName>{config.name}</ConsentName>
                  <RequiredBadge>Required</RequiredBadge>
                </ConsentHeader>
                <ConsentDescription>{config.description}</ConsentDescription>
                <ConsentToggle>
                  <ToggleLabel>Required for operation</ToggleLabel>
                  <Toggle
                    checked={true}
                    disabled={true}
                    onChange={() => {}}
                    aria-label={`${config.name} (required)`}
                  />
                </ConsentToggle>
              </ConsentItem>
            ))}
          </ConsentGroup>

          {/* Functional Permissions */}
          {functionalConfigs.length > 0 && (
            <ConsentGroup>
              <GroupTitle>Functional (Optional)</GroupTitle>
              {functionalConfigs.map(config => (
                <ConsentItem key={config.category}>
                  <ConsentHeader>
                    <ConsentName>{config.name}</ConsentName>
                  </ConsentHeader>
                  <ConsentDescription>{config.description}</ConsentDescription>
                  <ConsentToggle>
                    <ToggleLabel htmlFor={`initial-consent-${config.category}`}>
                      Enable this feature
                    </ToggleLabel>
                    <Toggle
                      id={`initial-consent-${config.category}`}
                      checked={consents[config.category] || false}
                      onChange={(checked) => handleConsentToggle(config.category, checked)}
                      aria-describedby={`${config.category}-description`}
                    />
                  </ConsentToggle>
                </ConsentItem>
              ))}
            </ConsentGroup>
          )}

          {/* Analytics Permissions */}
          {analyticsConfigs.length > 0 && (
            <ConsentGroup>
              <GroupTitle>Analytics & Improvement (Optional)</GroupTitle>
              {analyticsConfigs.map(config => (
                <ConsentItem key={config.category}>
                  <ConsentHeader>
                    <ConsentName>{config.name}</ConsentName>
                  </ConsentHeader>
                  <ConsentDescription>{config.description}</ConsentDescription>
                  <ConsentToggle>
                    <ToggleLabel htmlFor={`initial-consent-${config.category}`}>
                      Allow data collection
                    </ToggleLabel>
                    <Toggle
                      id={`initial-consent-${config.category}`}
                      checked={consents[config.category] || false}
                      onChange={(checked) => handleConsentToggle(config.category, checked)}
                      aria-describedby={`${config.category}-description`}
                    />
                  </ConsentToggle>
                </ConsentItem>
              ))}
            </ConsentGroup>
          )}
        </ConsentSection>

        {/* Summary */}
        <Summary>
          <SummaryTitle>Your Privacy Choices</SummaryTitle>
          <SummaryText>
            You have accepted {acceptedOptional} of {totalOptional} optional data collection permissions. 
            You can review and change these settings at any time in your privacy preferences.
          </SummaryText>
        </Summary>

        {/* Quick Actions */}
        <Actions>
          <Button
            variant="secondary"
            onClick={handleEssentialOnly}
            disabled={saving}
          >
            Essential Only
          </Button>
          <Button
            variant="secondary"
            onClick={handleAcceptAll}
            disabled={saving}
          >
            Accept All
          </Button>
          <Button
            variant="primary"
            onClick={handleSaveAndContinue}
            disabled={saving}
          >
            {saving ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </Button>
        </Actions>
      </DialogContent>
    </Modal>
  );
};