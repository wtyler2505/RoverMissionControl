/**
 * Privacy Settings Component
 * Provides a comprehensive interface for managing user privacy preferences and consent
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
import { Card } from '../ui/core/Card';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';
import { Modal } from '../ui/core/Modal';

interface PrivacySettingsProps {
  className?: string;
  onConsentChange?: (category: ConsentCategory, granted: boolean) => void;
  onExportData?: () => void;
  onDeleteData?: () => void;
}

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
`;

const Header = styled.div`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const ConsentItem = styled.div<{ required?: boolean }>`
  padding: 1.5rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  margin-bottom: 1rem;
  background: ${props => props.theme.colors.background.secondary};
  opacity: ${props => props.required ? 0.7 : 1};
  
  &:hover {
    border-color: ${props => props.theme.colors.border.primary};
  }
`;

const ConsentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
`;

const ConsentName = styled.h3`
  font-size: 1.125rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
  flex: 1;
`;

const RequiredBadge = styled.span`
  background: ${props => props.theme.colors.status.warning};
  color: ${props => props.theme.colors.text.primary};
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  margin-left: 1rem;
`;

const ConsentDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin: 0 0 0.75rem 0;
`;

const ConsentDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const DetailItem = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
`;

const DetailLabel = styled.span`
  font-weight: 500;
`;

const ConsentToggle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ToggleLabel = styled.label`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
`;

const ActionSection = styled.div`
  padding: 2rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 8px;
  margin-top: 2rem;
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
`;

const ActionCard = styled.div`
  padding: 1.5rem;
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
`;

const ActionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.5rem 0;
`;

const ActionDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.4;
  margin: 0 0 1rem 0;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid ${props => props.theme.colors.border.secondary};
  border-radius: 50%;
  border-top-color: ${props => props.theme.colors.primary};
  animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.error}20;
  border: 1px solid ${props => props.theme.colors.status.error};
  border-radius: 4px;
  color: ${props => props.theme.colors.status.error};
  margin: 1rem 0;
`;

const SuccessMessage = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.success}20;
  border: 1px solid ${props => props.theme.colors.status.success};
  border-radius: 4px;
  color: ${props => props.theme.colors.status.success};
  margin: 1rem 0;
`;

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  className,
  onConsentChange,
  onExportData,
  onDeleteData
}) => {
  const theme = useTheme();
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({} as any);
  const [configurations, setConfigurations] = useState<ConsentConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load initial data
  useEffect(() => {
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
        console.error('Failed to load privacy settings:', err);
        setError('Failed to load privacy settings. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle consent toggle
  const handleConsentToggle = useCallback(async (category: ConsentCategory, granted: boolean) => {
    const config = configurations.find(c => c.category === category);
    
    // Don't allow toggling required consents
    if (config?.required) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await consentManager.updateConsent(category, granted);
      
      // Update local state
      setConsents(prev => ({
        ...prev,
        [category]: granted
      }));
      
      // Call callback if provided
      onConsentChange?.(category, granted);
      
      setSuccessMessage('Privacy preferences updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err) {
      console.error('Failed to update consent:', err);
      setError('Failed to update privacy preference. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [configurations, onConsentChange]);

  // Handle data export
  const handleExportData = useCallback(async () => {
    try {
      setExporting(true);
      setError(null);
      
      const exportData = await consentManager.exportConsentData();
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `privacy-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onExportData?.();
      setSuccessMessage('Your privacy data has been exported successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err) {
      console.error('Failed to export data:', err);
      setError('Failed to export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [onExportData]);

  // Handle data deletion
  const handleDeleteData = useCallback(async () => {
    try {
      setError(null);
      
      // Withdraw all non-required consents first
      await consentManager.withdrawAllConsent();
      
      // Update local state
      const updatedConsents = { ...consents };
      configurations.forEach(config => {
        if (!config.required) {
          updatedConsents[config.category] = false;
        }
      });
      setConsents(updatedConsents);
      
      onDeleteData?.();
      setShowDeleteConfirm(false);
      setSuccessMessage('All non-essential data permissions have been withdrawn.');
      setTimeout(() => setSuccessMessage(null), 3000);
      
    } catch (err) {
      console.error('Failed to delete data:', err);
      setError('Failed to withdraw data permissions. Please try again.');
    }
  }, [consents, configurations, onDeleteData]);

  // Format retention period
  const formatRetentionPeriod = (days?: number): string => {
    if (days === undefined) return 'Not specified';
    if (days === -1) return 'Indefinite';
    if (days === 0) return 'Session only';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  };

  if (loading) {
    return (
      <Container className={className}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <LoadingSpinner />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading privacy settings...
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container className={className}>
      <Header>
        <Title>Privacy Settings</Title>
        <Subtitle>
          Manage your privacy preferences and data collection settings. You have control over 
          what information is collected and how it's used.
        </Subtitle>
      </Header>

      {error && <ErrorMessage role="alert">{error}</ErrorMessage>}
      {successMessage && <SuccessMessage role="alert">{successMessage}</SuccessMessage>}

      <Section>
        <SectionTitle>Data Collection Preferences</SectionTitle>
        
        {configurations.map(config => (
          <ConsentItem key={config.category} required={config.required}>
            <ConsentHeader>
              <ConsentName>{config.name}</ConsentName>
              {config.required && <RequiredBadge>Required</RequiredBadge>}
            </ConsentHeader>
            
            <ConsentDescription>{config.description}</ConsentDescription>
            
            <ConsentDetails>
              <DetailItem>
                <DetailLabel>Legal Basis:</DetailLabel> {config.legalBasis.replace('_', ' ')}
              </DetailItem>
              <DetailItem>
                <DetailLabel>Retention:</DetailLabel> {formatRetentionPeriod(config.dataRetentionDays)}
              </DetailItem>
              {config.thirdParties && config.thirdParties.length > 0 && (
                <DetailItem>
                  <DetailLabel>Third Parties:</DetailLabel> {config.thirdParties.join(', ')}
                </DetailItem>
              )}
            </ConsentDetails>
            
            <ConsentToggle>
              <ToggleLabel htmlFor={`consent-${config.category}`}>
                {config.required ? 'Required for operation' : 'Enable data collection'}
              </ToggleLabel>
              
              <Toggle
                id={`consent-${config.category}`}
                checked={consents[config.category] || false}
                onChange={(checked) => handleConsentToggle(config.category, checked)}
                disabled={config.required || saving}
                aria-describedby={`consent-${config.category}-description`}
              />
            </ConsentToggle>
          </ConsentItem>
        ))}
      </Section>

      <ActionSection>
        <SectionTitle>Data Rights</SectionTitle>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
          Exercise your rights under data protection laws. These actions allow you to access, 
          export, or delete your personal data.
        </p>
        
        <ActionGrid>
          <ActionCard>
            <ActionTitle>Export Your Data</ActionTitle>
            <ActionDescription>
              Download a copy of all your privacy preferences and consent history in JSON format.
            </ActionDescription>
            <Button
              variant="secondary"
              size="small"
              onClick={handleExportData}
              disabled={exporting}
              aria-describedby="export-data-description"
            >
              {exporting ? <LoadingSpinner /> : 'Export Data'}
            </Button>
          </ActionCard>
          
          <ActionCard>
            <ActionTitle>Withdraw Non-Essential Permissions</ActionTitle>
            <ActionDescription>
              Withdraw consent for all non-essential data collection. Required permissions 
              cannot be withdrawn as they're necessary for app functionality.
            </ActionDescription>
            <Button
              variant="danger"
              size="small"
              onClick={() => setShowDeleteConfirm(true)}
              aria-describedby="withdraw-permissions-description"
            >
              Withdraw Permissions
            </Button>
          </ActionCard>
          
          <ActionCard>
            <ActionTitle>Privacy Policy</ActionTitle>
            <ActionDescription>
              Read our complete privacy policy to understand how we collect, use, and protect your data.
            </ActionDescription>
            <Button
              variant="secondary"
              size="small"
              onClick={() => {
                // This would typically open a privacy policy modal or page
                console.log('Open privacy policy');
              }}
            >
              View Policy
            </Button>
          </ActionCard>
        </ActionGrid>
      </ActionSection>

      {/* Confirmation Modal for Data Deletion */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Withdraw Non-Essential Permissions"
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
      >
        <div>
          <p id="delete-confirmation-description" style={{ marginBottom: '1.5rem' }}>
            This will withdraw your consent for all non-essential data collection. 
            Essential permissions required for app functionality cannot be withdrawn.
          </p>
          
          <p style={{ marginBottom: '1.5rem', color: theme.colors.text.secondary }}>
            The following permissions will be withdrawn:
          </p>
          
          <ul style={{ marginBottom: '1.5rem', color: theme.colors.text.secondary }}>
            {configurations
              .filter(config => !config.required && consents[config.category])
              .map(config => (
                <li key={config.category}>{config.name}</li>
              ))
            }
          </ul>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteData}
            >
              Withdraw Permissions
            </Button>
          </div>
        </div>
      </Modal>
    </Container>
  );
};