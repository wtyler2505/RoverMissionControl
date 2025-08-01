/**
 * Accessible Privacy Controls Component
 * Fully WCAG 2.1 AA compliant privacy interface with comprehensive accessibility features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
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
import { useFocusManagement } from '../../contexts/FocusManagementContext';

interface AccessiblePrivacyControlsProps {
  className?: string;
  onConsentChange?: (category: ConsentCategory, granted: boolean) => void;
  onExportData?: () => void;
  onDeleteData?: () => void;
  /** Whether to show detailed explanations for screen readers */
  verboseMode?: boolean;
  /** High contrast mode for low vision users */
  highContrastMode?: boolean;
}

const Container = styled.div<{ highContrast?: boolean }>`
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  
  ${({ highContrast, theme }) => highContrast && css`
    background: ${theme.colors.background.paper};
    border: 2px solid ${theme.colors.text.primary};
    border-radius: ${theme.borderRadius.lg};
  `}
  
  /* Ensure proper focus management */
  &:focus {
    outline: none;
  }
`;

const Header = styled.header`
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.75rem;
  line-height: 1.3;
  
  /* Ensure proper heading hierarchy */
  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary.main};
    outline-offset: 4px;
  }
`;

const Subtitle = styled.p`
  font-size: 1.125rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const Section = styled.section`
  margin-bottom: 3rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1.5rem;
  line-height: 1.3;
  
  &:focus {
    outline: 2px solid ${props => props.theme.colors.primary.main};
    outline-offset: 4px;
  }
`;

const ConsentList = styled.ul<{ highContrast?: boolean }>`
  list-style: none;
  padding: 0;
  margin: 0;
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 1px solid ${theme.colors.text.primary};
    border-radius: ${theme.borderRadius.md};
  `}
`;

const ConsentItem = styled.li<{ required?: boolean; highContrast?: boolean }>`
  padding: 2rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.lg};
  margin-bottom: 1.5rem;
  background: ${props => props.theme.colors.background.secondary};
  position: relative;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  /* Enhanced focus styling for keyboard navigation */
  &:focus-within {
    border-color: ${props => props.theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary.main}20;
  }
  
  /* High contrast mode adjustments */
  ${({ highContrast, theme }) => highContrast && css`
    border: 2px solid ${theme.colors.text.primary};
    background: ${theme.colors.background.paper};
    
    &:focus-within {
      border-color: ${theme.colors.primary.main};
      border-width: 3px;
    }
  `}
  
  /* Required consent styling */
  ${({ required, theme }) => required && css`
    background: ${theme.colors.background.tertiary};
    border-left: 4px solid ${theme.colors.warning.main};
    
    &::before {
      content: 'Required';
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: ${theme.colors.warning.main};
      color: ${theme.colors.warning.contrastText};
      padding: 0.25rem 0.75rem;
      border-radius: ${theme.borderRadius.sm};
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `}
  
  /* Hover state for better interaction feedback */
  &:hover {
    border-color: ${props => props.theme.colors.border.primary};
    transform: translateY(-1px);
    box-shadow: ${props => props.theme.shadows.md};
    transition: all 0.2s ease-in-out;
  }
  
  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
      transition: none;
    }
  }
`;

const ConsentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const ConsentName = styled.h3`
  font-size: 1.25rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
  flex: 1;
  line-height: 1.3;
`;

const ConsentDescription = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
`;

const ConsentDetails = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: ${props => props.theme.borderRadius.md};
`;

const DetailItem = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
`;

const DetailLabel = styled.span`
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  display: block;
  margin-bottom: 0.25rem;
`;

const ConsentControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const ToggleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const ToggleLabel = styled.label`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
  user-select: none;
`;

const StatusIndicator = styled.div<{ granted: boolean; required?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  
  color: ${({ granted, required, theme }) => {
    if (required) return theme.colors.warning.main;
    return granted ? theme.colors.success.main : theme.colors.text.secondary;
  }};
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }
`;

// Live region for announcements
const LiveRegion = styled.div`
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;

const ActionSection = styled.section<{ highContrast?: boolean }>`
  padding: 2rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: ${props => props.theme.borderRadius.lg};
  margin-top: 3rem;
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 2px solid ${theme.colors.text.primary};
    background: ${theme.colors.background.secondary};
  `}
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
`;

const ActionCard = styled.div<{ highContrast?: boolean }>`
  padding: 2rem;
  background: ${props => props.theme.colors.background.primary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.lg};
  
  &:focus-within {
    border-color: ${props => props.theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.main}20;
  }
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 2px solid ${theme.colors.text.primary};
    
    &:focus-within {
      border-color: ${theme.colors.primary.main};
      border-width: 3px;
    }
  `}
`;

const ActionTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.75rem 0;
  line-height: 1.3;
`;

const ActionDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin: 0 0 1.5rem 0;
`;

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid ${props => props.theme.colors.border.secondary};
  border-radius: 50%;
  border-top-color: ${props => props.theme.colors.primary.main};
  animation: spin 1s ease-in-out infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    &::after {
      content: '⟳';
      color: ${props => props.theme.colors.primary.main};
    }
  }
`;

const ErrorAlert = styled.div`
  padding: 1.5rem;
  background: ${props => props.theme.colors.error.light};
  border: 2px solid ${props => props.theme.colors.error.main};
  border-radius: ${props => props.theme.borderRadius.md};
  color: ${props => props.theme.colors.error.dark};
  margin: 1.5rem 0;
  font-weight: 500;
  
  &::before {
    content: '⚠ ';
    font-weight: bold;
    margin-right: 0.5rem;
  }
`;

const SuccessAlert = styled.div`
  padding: 1.5rem;
  background: ${props => props.theme.colors.success.light};
  border: 2px solid ${props => props.theme.colors.success.main};
  border-radius: ${props => props.theme.borderRadius.md};
  color: ${props => props.theme.colors.success.dark};
  margin: 1.5rem 0;
  font-weight: 500;
  
  &::before {
    content: '✓ ';
    font-weight: bold;
    margin-right: 0.5rem;
  }
`;

export const AccessiblePrivacyControls: React.FC<AccessiblePrivacyControlsProps> = ({
  className,
  onConsentChange,
  onExportData,
  onDeleteData,
  verboseMode = false,
  highContrastMode = false
}) => {
  const theme = useTheme();
  const { routerFocus, dynamicFocus } = useFocusManagement();
  
  // Component state
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({} as any);
  const [configurations, setConfigurations] = useState<ConsentConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Accessibility state
  const [announcement, setAnnouncement] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Live region for screen reader announcements
  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncement(message);
    routerFocus.announceToScreenReader(message);
    
    // Clear announcement after a delay
    setTimeout(() => setAnnouncement(''), 1000);
  }, [routerFocus]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        announceToScreenReader('Loading privacy settings...');
        
        await consentManager.initialize();
        
        const [currentConsents, configs] = await Promise.all([
          consentManager.getAllConsents(),
          Promise.resolve(consentManager.getAllConsentConfigurations())
        ]);
        
        setConsents(currentConsents);
        setConfigurations(configs);
        setError(null);
        
        announceToScreenReader(`Privacy settings loaded. ${configs.length} privacy categories available.`);
        
      } catch (err) {
        console.error('Failed to load privacy settings:', err);
        const errorMessage = 'Failed to load privacy settings. Please try again.';
        setError(errorMessage);
        announceToScreenReader(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [announceToScreenReader]);

  // Handle consent toggle with accessibility feedback
  const handleConsentToggle = useCallback(async (category: ConsentCategory, granted: boolean) => {
    const config = configurations.find(c => c.category === category);
    
    // Don't allow toggling required consents
    if (config?.required) {
      announceToScreenReader('This permission is required and cannot be changed.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const actionMessage = granted ? 'enabling' : 'disabling';
      announceToScreenReader(`${actionMessage} ${config?.name || category} data collection...`);
      
      await consentManager.updateConsent(category, granted);
      
      // Update local state
      setConsents(prev => ({
        ...prev,
        [category]: granted
      }));
      
      // Call callback if provided
      onConsentChange?.(category, granted);
      
      const successMsg = `Privacy preference updated. ${config?.name || category} data collection is now ${granted ? 'enabled' : 'disabled'}.`;
      setSuccessMessage(successMsg);
      announceToScreenReader(successMsg);
      
      setTimeout(() => setSuccessMessage(null), 5000);
      
    } catch (err) {
      console.error('Failed to update consent:', err);
      const errorMsg = 'Failed to update privacy preference. Please try again.';
      setError(errorMsg);
      announceToScreenReader(errorMsg);
    } finally {
      setSaving(false);
    }
  }, [configurations, onConsentChange, announceToScreenReader]);

  // Handle data export with accessibility feedback
  const handleExportData = useCallback(async () => {
    try {
      setExporting(true);
      setError(null);
      
      announceToScreenReader('Preparing your privacy data for export...');
      
      const exportData = await consentManager.exportConsentData();
      
      // Create downloadable file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `privacy-data-export-${new Date().toISOString().split('T')[0]}.json`;
      
      // Announce download
      link.setAttribute('aria-label', 'Download privacy data export file');
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onExportData?.();
      
      const successMsg = 'Your privacy data has been exported successfully. The download should begin automatically.';
      setSuccessMessage(successMsg);
      announceToScreenReader(successMsg);
      
      setTimeout(() => setSuccessMessage(null), 5000);
      
    } catch (err) {
      console.error('Failed to export data:', err);
      const errorMsg = 'Failed to export your data. Please try again.';
      setError(errorMsg);
      announceToScreenReader(errorMsg);
    } finally {
      setExporting(false);
    }
  }, [onExportData, announceToScreenReader]);

  // Handle data deletion with accessibility feedback
  const handleDeleteData = useCallback(async () => {
    try {
      setError(null);
      
      announceToScreenReader('Withdrawing all non-essential data permissions...');
      
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
      
      const successMsg = 'All non-essential data permissions have been withdrawn successfully.';
      setSuccessMessage(successMsg);
      announceToScreenReader(successMsg);
      
      setTimeout(() => setSuccessMessage(null), 5000);
      
    } catch (err) {
      console.error('Failed to delete data:', err);
      const errorMsg = 'Failed to withdraw data permissions. Please try again.';
      setError(errorMsg);
      announceToScreenReader(errorMsg);
    }
  }, [consents, configurations, onDeleteData, announceToScreenReader]);

  // Format retention period for screen readers
  const formatRetentionPeriod = (days?: number): string => {
    if (days === undefined) return 'Not specified';
    if (days === -1) return 'Stored indefinitely';
    if (days === 0) return 'Session only';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  };

  // Get status text for screen readers
  const getStatusText = (config: ConsentConfiguration): string => {
    const isGranted = consents[config.category] || false;
    if (config.required) {
      return 'Required - always enabled';
    }
    return isGranted ? 'Enabled' : 'Disabled';
  };

  if (loading) {
    return (
      <Container 
        ref={containerRef}
        className={className}
        highContrast={highContrastMode}
        role="main"
        aria-label="Privacy settings"
      >
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <LoadingSpinner aria-label="Loading" />
          <p style={{ marginTop: '1rem', color: theme.colors.text.secondary }}>
            Loading privacy settings...
          </p>
          <LiveRegion role="status" aria-live="polite">
            {announcement}
          </LiveRegion>
        </div>
      </Container>
    );
  }

  return (
    <Container 
      ref={containerRef}
      className={className}
      highContrast={highContrastMode}
      role="main"
      aria-label="Privacy settings"
    >
      <Header>
        <Title tabIndex={0}>Privacy Settings</Title>
        <Subtitle>
          Manage your privacy preferences and data collection settings. You have complete control over 
          what information is collected and how it's used. {verboseMode && '(Use Tab key to navigate between controls)'}
        </Subtitle>
      </Header>

      {/* Live region for screen reader announcements */}
      <LiveRegion role="alert" aria-live="assertive" aria-atomic="true">
        {announcement}
      </LiveRegion>

      {error && (
        <ErrorAlert role="alert" aria-live="assertive">
          {error}
        </ErrorAlert>
      )}
      
      {successMessage && (
        <SuccessAlert role="alert" aria-live="polite">
          {successMessage}
        </SuccessAlert>
      )}

      <Section>
        <SectionTitle tabIndex={0}>Data Collection Preferences</SectionTitle>
        <p style={{ marginBottom: '2rem', color: theme.colors.text.secondary }}>
          Configure which types of data the system can collect. Required permissions are necessary 
          for basic functionality and cannot be disabled.
        </p>
        
        <ConsentList highContrast={highContrastMode}>
          {configurations.map((config, index) => (
            <ConsentItem 
              key={config.category} 
              required={config.required}
              highContrast={highContrastMode}
              role="group"
              aria-labelledby={`consent-${config.category}-name`}
              aria-describedby={`consent-${config.category}-description`}
            >
              <ConsentHeader>
                <ConsentName id={`consent-${config.category}-name`}>
                  {config.name}
                </ConsentName>
                <StatusIndicator 
                  granted={consents[config.category] || false}
                  required={config.required}
                  aria-label={`Status: ${getStatusText(config)}`}
                >
                  {getStatusText(config)}
                </StatusIndicator>
              </ConsentHeader>
              
              <ConsentDescription id={`consent-${config.category}-description`}>
                {config.description}
                {verboseMode && config.required && ' This permission is required for the application to function properly.'}
              </ConsentDescription>
              
              <ConsentDetails>
                <DetailItem>
                  <DetailLabel>Legal Basis:</DetailLabel>
                  {config.legalBasis.replace('_', ' ')}
                </DetailItem>
                <DetailItem>
                  <DetailLabel>Data Retention:</DetailLabel>
                  {formatRetentionPeriod(config.dataRetentionDays)}
                </DetailItem>
                {config.thirdParties && config.thirdParties.length > 0 && (
                  <DetailItem>
                    <DetailLabel>Third Party Sharing:</DetailLabel>
                    {config.thirdParties.join(', ')}
                  </DetailItem>
                )}
              </ConsentDetails>
              
              <ConsentControls>
                <ToggleContainer>
                  <ToggleLabel htmlFor={`consent-toggle-${config.category}`}>
                    {config.required ? 'Required for operation' : 'Enable data collection'}
                  </ToggleLabel>
                </ToggleContainer>
                
                <Toggle
                  id={`consent-toggle-${config.category}`}
                  checked={consents[config.category] || false}
                  onChange={(checked) => handleConsentToggle(config.category, checked)}
                  disabled={config.required || saving}
                  aria-describedby={`consent-${config.category}-description`}
                  aria-label={`${config.name} data collection`}
                  size="large"
                />
              </ConsentControls>
            </ConsentItem>
          ))}
        </ConsentList>
      </Section>

      <ActionSection highContrast={highContrastMode}>
        <SectionTitle tabIndex={0}>Data Rights</SectionTitle>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '2rem' }}>
          Exercise your rights under data protection laws. These actions allow you to access, 
          export, or delete your personal data.
        </p>
        
        <ActionGrid>
          <ActionCard highContrast={highContrastMode}>
            <ActionTitle>Export Your Data</ActionTitle>
            <ActionDescription>
              Download a complete copy of all your privacy preferences and consent history 
              in machine-readable JSON format.
            </ActionDescription>
            <Button
              variant="secondary"
              size="medium"
              onClick={handleExportData}
              disabled={exporting}
              aria-describedby="export-data-description"
              aria-label={exporting ? 'Exporting data, please wait' : 'Export your privacy data'}
            >
              {exporting ? (
                <>
                  <LoadingSpinner aria-hidden="true" />
                  <span style={{ marginLeft: '0.5rem' }}>Exporting...</span>
                </>
              ) : (
                'Export Data'
              )}
            </Button>
          </ActionCard>
          
          <ActionCard highContrast={highContrastMode}>
            <ActionTitle>Withdraw Non-Essential Permissions</ActionTitle>
            <ActionDescription>
              Withdraw consent for all non-essential data collection. Required permissions 
              cannot be withdrawn as they're necessary for basic application functionality.
            </ActionDescription>
            <Button
              variant="danger"
              size="medium"
              onClick={() => setShowDeleteConfirm(true)}
              aria-describedby="withdraw-permissions-description"
              aria-label="Withdraw all non-essential data permissions"
            >
              Withdraw Permissions
            </Button>
          </ActionCard>
          
          <ActionCard highContrast={highContrastMode}>
            <ActionTitle>Privacy Policy</ActionTitle>
            <ActionDescription>
              Read our complete privacy policy to understand how we collect, use, and protect 
              your personal information.
            </ActionDescription>
            <Button
              variant="secondary"
              size="medium"
              onClick={() => {
                announceToScreenReader('Opening privacy policy...');
                // This would typically open a privacy policy modal or page
                console.log('Open privacy policy');
              }}
              aria-label="View complete privacy policy"
            >
              View Policy
            </Button>
          </ActionCard>
        </ActionGrid>
      </ActionSection>

      {/* Accessible Confirmation Modal */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Withdraw Non-Essential Permissions"
        size="medium"
        variant="confirmation"
        confirmText="Withdraw Permissions"
        cancelText="Keep Current Settings"
        onConfirm={handleDeleteData}
        onCancel={() => setShowDeleteConfirm(false)}
        danger={true}
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-description"
      >
        <div>
          <p id="delete-confirmation-description" style={{ marginBottom: '1.5rem', fontSize: '1rem' }}>
            This action will withdraw your consent for all non-essential data collection. 
            Essential permissions required for application functionality will remain active and cannot be withdrawn.
          </p>
          
          <p style={{ marginBottom: '1.5rem', color: theme.colors.text.secondary, fontSize: '0.875rem' }}>
            The following permissions will be withdrawn:
          </p>
          
          <ul style={{ 
            marginBottom: '1.5rem', 
            color: theme.colors.text.secondary,
            paddingLeft: '1.5rem',
            fontSize: '0.875rem'
          }}>
            {configurations
              .filter(config => !config.required && consents[config.category])
              .map(config => (
                <li key={config.category} style={{ marginBottom: '0.5rem' }}>
                  {config.name}
                </li>
              ))
            }
          </ul>
          
          {configurations.filter(config => !config.required && consents[config.category]).length === 0 && (
            <p style={{ 
              color: theme.colors.text.secondary, 
              fontStyle: 'italic',
              fontSize: '0.875rem'
            }}>
              No non-essential permissions are currently granted.
            </p>
          )}
        </div>
      </Modal>
    </Container>
  );
};