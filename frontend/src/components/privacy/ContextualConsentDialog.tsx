/**
 * Contextual Consent Dialog
 * Appears when new features require additional permissions
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  ConsentCategory, 
  ConsentConfiguration,
  consentManager 
} from '../../services/privacy/ConsentManager';
import { Modal } from '../ui/core/Modal';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';

interface ContextualConsentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (grants: Record<ConsentCategory, boolean>) => void;
  context: {
    featureName: string;
    reason: string;
    benefits: string[];
    consequences?: string;
    icon?: string;
  };
  requiredCategories: ConsentCategory[];
  optionalCategories: ConsentCategory[];
  alreadyGrantedCategories: ConsentCategory[];
}

const DialogContent = styled.div`
  max-width: 500px;
  max-height: 70vh;
  overflow-y: auto;
`;

const FeatureHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const FeatureIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const FeatureTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const FeatureDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const Section = styled.div`
  margin-bottom: 1.5rem;
`;

const SectionTitle = styled.h2`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
`;

const BenefitsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const BenefitItem = styled.li`
  padding: 0.5rem 0;
  color: ${props => props.theme.colors.text.secondary};
  font-size: 0.875rem;
  
  &:before {
    content: '✓';
    color: ${props => props.theme.colors.status.success};
    font-weight: bold;
    margin-right: 0.5rem;
  }
`;

const ConsentItem = styled.div<{ required?: boolean; granted?: boolean }>`
  padding: 1rem;
  border: 1px solid ${props => {
    if (props.granted) return props.theme.colors.status.success;
    if (props.required) return props.theme.colors.status.warning;
    return props.theme.colors.border.secondary;
  }};
  border-radius: 6px;
  margin-bottom: 0.75rem;
  background: ${props => {
    if (props.granted) return `${props.theme.colors.status.success}10`;
    return props.theme.colors.background.secondary;
  }};
  opacity: ${props => props.granted ? 0.8 : 1};
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

const StatusBadge = styled.span<{ variant: 'required' | 'optional' | 'granted' }>`
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 500;
  margin-left: 0.5rem;
  background: ${props => {
    switch (props.variant) {
      case 'required': return props.theme.colors.status.warning;
      case 'optional': return props.theme.colors.primary;
      case 'granted': return props.theme.colors.status.success;
      default: return props.theme.colors.border.secondary;
    }
  }};
  color: ${props => props.theme.colors.text.primary};
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

const ConsequenceWarning = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.warning}20;
  border: 1px solid ${props => props.theme.colors.status.warning};
  border-radius: 6px;
  margin-bottom: 1.5rem;
`;

const WarningTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.status.warning};
  margin: 0 0 0.5rem 0;
`;

const WarningText = styled.p`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
  line-height: 1.4;
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

const ErrorMessage = styled.div`
  padding: 0.75rem;
  background: ${props => props.theme.colors.status.error}20;
  border: 1px solid ${props => props.theme.colors.status.error};
  border-radius: 4px;
  color: ${props => props.theme.colors.status.error};
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

export const ContextualConsentDialog: React.FC<ContextualConsentDialogProps> = ({
  isOpen,
  onClose,
  onComplete,
  context,
  requiredCategories,
  optionalCategories,
  alreadyGrantedCategories
}) => {
  const theme = useTheme();
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({});
  const [configurations, setConfigurations] = useState<ConsentConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with already granted permissions
  useEffect(() => {
    if (!isOpen) return;

    const initializeConsents = async () => {
      try {
        setLoading(true);
        await consentManager.initialize();
        
        const configs = consentManager.getAllConsentConfigurations();
        setConfigurations(configs);

        // Set initial consent state
        const initialConsents: Record<ConsentCategory, boolean> = {};
        
        // Already granted permissions are true and disabled
        alreadyGrantedCategories.forEach(category => {
          initialConsents[category] = true;
        });

        // Required permissions default to true (user must grant)
        requiredCategories.forEach(category => {
          if (!alreadyGrantedCategories.includes(category)) {
            initialConsents[category] = true;
          }
        });

        // Optional permissions default to false (user can choose)
        optionalCategories.forEach(category => {
          if (!alreadyGrantedCategories.includes(category)) {
            initialConsents[category] = false;
          }
        });

        setConsents(initialConsents);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize contextual consent:', err);
        setError('Failed to load consent options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeConsents();
  }, [isOpen, requiredCategories, optionalCategories, alreadyGrantedCategories]);

  // Handle consent toggle
  const handleConsentToggle = useCallback((category: ConsentCategory, granted: boolean) => {
    // Don't allow toggling required consents or already granted ones
    if (requiredCategories.includes(category) || alreadyGrantedCategories.includes(category)) {
      return;
    }

    setConsents(prev => ({
      ...prev,
      [category]: granted
    }));
  }, [requiredCategories, alreadyGrantedCategories]);

  // Handle allow all optional
  const handleAllowAll = useCallback(() => {
    const newConsents = { ...consents };
    optionalCategories.forEach(category => {
      if (!alreadyGrantedCategories.includes(category)) {
        newConsents[category] = true;
      }
    });
    setConsents(newConsents);
  }, [consents, optionalCategories, alreadyGrantedCategories]);

  // Handle deny all optional
  const handleDenyAll = useCallback(() => {
    const newConsents = { ...consents };
    optionalCategories.forEach(category => {
      if (!alreadyGrantedCategories.includes(category)) {
        newConsents[category] = false;
      }
    });
    setConsents(newConsents);
  }, [consents, optionalCategories, alreadyGrantedCategories]);

  // Handle save and continue
  const handleSaveAndContinue = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);

      // Check that all required permissions are granted
      const missingRequired = requiredCategories.filter(category => 
        !alreadyGrantedCategories.includes(category) && !consents[category]
      );

      if (missingRequired.length > 0) {
        setError('All required permissions must be granted to use this feature.');
        return;
      }

      // Save new consent preferences
      const consentUpdates = Object.entries(consents)
        .filter(([category]) => !alreadyGrantedCategories.includes(category as ConsentCategory))
        .map(([category, granted]) => ({
          category: category as ConsentCategory,
          granted,
          reasonForChange: `Contextual consent for feature: ${context.featureName}`
        }));

      if (consentUpdates.length > 0) {
        await consentManager.updateMultipleConsents(consentUpdates, 'contextual');
      }

      // Notify parent component
      onComplete(consents);

    } catch (err) {
      console.error('Failed to save contextual consent:', err);
      setError('Failed to save your preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [consents, requiredCategories, alreadyGrantedCategories, context.featureName, onComplete]);

  // Get configuration for category
  const getConfig = (category: ConsentCategory) => 
    configurations.find(c => c.category === category);

  // Count selections
  const optionalGranted = optionalCategories.filter(cat => 
    !alreadyGrantedCategories.includes(cat) && consents[cat]
  ).length;
  const totalOptional = optionalCategories.filter(cat => 
    !alreadyGrantedCategories.includes(cat)
  ).length;

  if (loading) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Feature Permissions"
        size="medium"
        closeOnOverlayClick={false}
        closeOnEscapeKey={false}
      >
        <DialogContent>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <LoadingSpinner />
            <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
              Loading permission options...
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
      title="Feature Permissions Required"
      size="medium"
      closeOnOverlayClick={false}
      closeOnEscapeKey={false}
    >
      <DialogContent>
        <FeatureHeader>
          {context.icon && <FeatureIcon>{context.icon}</FeatureIcon>}
          <FeatureTitle>{context.featureName}</FeatureTitle>
          <FeatureDescription>{context.reason}</FeatureDescription>
        </FeatureHeader>

        {error && <ErrorMessage role="alert">{error}</ErrorMessage>}

        {/* Benefits */}
        <Section>
          <SectionTitle>This feature will provide:</SectionTitle>
          <BenefitsList>
            {context.benefits.map((benefit, index) => (
              <BenefitItem key={index}>{benefit}</BenefitItem>
            ))}
          </BenefitsList>
        </Section>

        {/* Consequences Warning */}
        {context.consequences && (
          <ConsequenceWarning>
            <WarningTitle>If you decline:</WarningTitle>
            <WarningText>{context.consequences}</WarningText>
          </ConsequenceWarning>
        )}

        {/* Already Granted Permissions */}
        {alreadyGrantedCategories.length > 0 && (
          <Section>
            <SectionTitle>Already Granted:</SectionTitle>
            {alreadyGrantedCategories.map(category => {
              const config = getConfig(category);
              return (
                <ConsentItem key={category} granted>
                  <ConsentHeader>
                    <ConsentName>{config?.name || category}</ConsentName>
                    <StatusBadge variant="granted">Granted</StatusBadge>
                  </ConsentHeader>
                  <ConsentDescription>{config?.description}</ConsentDescription>
                </ConsentItem>
              );
            })}
          </Section>
        )}

        {/* Required Permissions */}
        {requiredCategories.filter(cat => !alreadyGrantedCategories.includes(cat)).length > 0 && (
          <Section>
            <SectionTitle>Required Permissions:</SectionTitle>
            {requiredCategories
              .filter(cat => !alreadyGrantedCategories.includes(cat))
              .map(category => {
                const config = getConfig(category);
                return (
                  <ConsentItem key={category} required>
                    <ConsentHeader>
                      <ConsentName>{config?.name || category}</ConsentName>
                      <StatusBadge variant="required">Required</StatusBadge>
                    </ConsentHeader>
                    <ConsentDescription>{config?.description}</ConsentDescription>
                    <ConsentToggle>
                      <ToggleLabel>Required for this feature</ToggleLabel>
                      <Toggle
                        checked={true}
                        disabled={true}
                        onChange={() => {}}
                        aria-label={`${config?.name} (required)`}
                      />
                    </ConsentToggle>
                  </ConsentItem>
                );
              })}
          </Section>
        )}

        {/* Optional Permissions */}
        {optionalCategories.filter(cat => !alreadyGrantedCategories.includes(cat)).length > 0 && (
          <Section>
            <SectionTitle>Optional Permissions:</SectionTitle>
            {optionalCategories
              .filter(cat => !alreadyGrantedCategories.includes(cat))
              .map(category => {
                const config = getConfig(category);
                return (
                  <ConsentItem key={category}>
                    <ConsentHeader>
                      <ConsentName>{config?.name || category}</ConsentName>
                      <StatusBadge variant="optional">Optional</StatusBadge>
                    </ConsentHeader>
                    <ConsentDescription>{config?.description}</ConsentDescription>
                    <ConsentToggle>
                      <ToggleLabel htmlFor={`contextual-consent-${category}`}>
                        Enable this permission
                      </ToggleLabel>
                      <Toggle
                        id={`contextual-consent-${category}`}
                        checked={consents[category] || false}
                        onChange={(checked) => handleConsentToggle(category, checked)}
                        disabled={saving}
                        aria-describedby={`${category}-description`}
                      />
                    </ConsentToggle>
                  </ConsentItem>
                );
              })}
          </Section>
        )}

        {/* Summary */}
        <Summary>
          <SummaryTitle>Your Choices</SummaryTitle>
          <SummaryText>
            You have selected {optionalGranted} of {totalOptional} optional permissions.
            {requiredCategories.length > 0 && ` ${requiredCategories.length} required permission${requiredCategories.length !== 1 ? 's' : ''} will be automatically granted.`}
          </SummaryText>
        </Summary>

        {/* Quick Actions for Optional Permissions */}
        {totalOptional > 0 && (
          <Actions>
            <Button
              variant="secondary"
              size="small"
              onClick={handleDenyAll}
              disabled={saving}
            >
              Deny All Optional
            </Button>
            <Button
              variant="secondary"
              size="small"
              onClick={handleAllowAll}
              disabled={saving}
            >
              Allow All Optional
            </Button>
          </Actions>
        )}

        {/* Main Actions */}
        <Actions>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
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
              'Enable Feature'
            )}
          </Button>
        </Actions>
      </DialogContent>
    </Modal>
  );
};