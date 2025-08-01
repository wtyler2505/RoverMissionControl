/**
 * Accessible Consent Dialog Component
 * WCAG 2.1 AA compliant consent dialog with focus management and screen reader support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useTheme } from '@emotion/react';
import { Modal } from '../ui/core/Modal';
import { Button } from '../ui/core/Button';
import { Toggle } from '../ui/core/Toggle';
import { Checkbox } from '../ui/core/Checkbox';
import { useFocusManagement } from '../../contexts/FocusManagementContext';
import { 
  ConsentCategory, 
  ConsentConfiguration,
  consentManager 
} from '../../services/privacy/ConsentManager';

interface AccessibleConsentDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Function to call when dialog should close */
  onClose: () => void;
  /** Function to call when consents are updated */
  onConsentUpdate?: (consents: Record<ConsentCategory, boolean>) => void;
  /** Specific categories to show (if not provided, shows all) */
  categories?: ConsentCategory[];
  /** Dialog title */
  title?: string;
  /** Dialog description */
  description?: string;
  /** Whether this is an initial consent dialog */
  isInitialConsent?: boolean;
  /** Whether to use verbose descriptions for screen readers */
  verboseMode?: boolean;
  /** High contrast mode */
  highContrastMode?: boolean;
  /** Custom CSS class */
  className?: string;
}

const DialogContent = styled.div<{ highContrast?: boolean }>`
  max-height: 70vh;
  overflow-y: auto;
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 1px solid ${theme.colors.text.primary};
    border-radius: ${theme.borderRadius.md};
    padding: 1rem;
  `}
`;

const IntroSection = styled.div`
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const DialogTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 1rem 0;
  line-height: 1.3;
`;

const DialogDescription = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const ConsentList = styled.div<{ highContrast?: boolean }>`
  margin-bottom: 2rem;
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 1px solid ${theme.colors.text.secondary};
    border-radius: ${theme.borderRadius.md};
    padding: 1rem;
  `}
`;

const ConsentItem = styled.div<{ required?: boolean; highContrast?: boolean }>`
  padding: 1.5rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: ${props => props.theme.borderRadius.md};
  margin-bottom: 1rem;
  background: ${props => props.theme.colors.background.secondary};
  
  &:last-child {
    margin-bottom: 0;
  }
  
  &:focus-within {
    border-color: ${props => props.theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${props => props.theme.colors.primary.main}20;
  }
  
  ${({ required, theme }) => required && css`
    background: ${theme.colors.warning.light}10;
    border-left: 3px solid ${theme.colors.warning.main};
    
    &::before {
      content: 'Required';
      display: inline-block;
      background: ${theme.colors.warning.main};
      color: ${theme.colors.warning.contrastText};
      padding: 0.25rem 0.5rem;
      border-radius: ${theme.borderRadius.sm};
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 0.75rem;
    }
  `}
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 2px solid ${theme.colors.text.primary};
    
    &:focus-within {
      border-color: ${theme.colors.primary.main};
      border-width: 3px;
    }
  `}
`;

const ConsentHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  gap: 1rem;
`;

const ConsentName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
  flex: 1;
  line-height: 1.3;
`;

const ConsentDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.5;
  margin: 0 0 1rem 0;
`;

const ConsentDetails = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
`;

const DetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const DetailLabel = styled.span`
  font-weight: 600;
`;

const ConsentControl = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const ControlLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  align-items: center;
  padding-top: 1.5rem;
  border-top: 1px solid ${props => props.theme.colors.border.secondary};
`;

const SelectAllSection = styled.div<{ highContrast?: boolean }>`
  margin-bottom: 2rem;
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: ${props => props.theme.borderRadius.md};
  
  ${({ highContrast, theme }) => highContrast && css`
    border: 2px solid ${theme.colors.text.secondary};
  `}
`;

const SelectAllControl = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SelectAllLabel = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  cursor: pointer;
`;

const LiveRegion = styled.div`
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
`;

const ErrorMessage = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.error.light};
  border: 2px solid ${props => props.theme.colors.error.main};
  border-radius: ${props => props.theme.borderRadius.md};
  color: ${props => props.theme.colors.error.dark};
  margin-bottom: 1rem;
  font-weight: 500;
  
  &::before {
    content: '⚠ ';
    font-weight: bold;
    margin-right: 0.5rem;
  }
`;

export const AccessibleConsentDialog: React.FC<AccessibleConsentDialogProps> = ({
  open,
  onClose,
  onConsentUpdate,
  categories,
  title = 'Privacy Preferences',
  description = 'Please review and configure your privacy preferences below.',
  isInitialConsent = false,
  verboseMode = false,
  highContrastMode = false,
  className
}) => {
  const theme = useTheme();
  const { routerFocus } = useFocusManagement();
  const dialogRef = useRef<HTMLDivElement>(null);
  
  // State
  const [configurations, setConfigurations] = useState<ConsentConfiguration[]>([]);
  const [consents, setConsents] = useState<Record<ConsentCategory, boolean>>({} as any);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');
  
  // Accessibility announcements
  const announceToScreenReader = useCallback((message: string) => {
    setAnnouncement(message);
    routerFocus.announceToScreenReader(message);
    setTimeout(() => setAnnouncement(''), 1000);
  }, [routerFocus]);

  // Load configurations when dialog opens
  useEffect(() => {
    if (!open) return;
    
    const loadConfigurations = async () => {
      try {
        setLoading(true);
        announceToScreenReader('Loading privacy preferences...');
        
        await consentManager.initialize();
        
        const allConfigs = consentManager.getAllConsentConfigurations();
        const filteredConfigs = categories 
          ? allConfigs.filter(config => categories.includes(config.category))
          : allConfigs;
        
        const currentConsents = await consentManager.getAllConsents();
        
        setConfigurations(filteredConfigs);
        setConsents(currentConsents);
        setError(null);
        
        announceToScreenReader(`Privacy preferences loaded. ${filteredConfigs.length} categories available for configuration.`);
        
      } catch (err) {
        console.error('Failed to load consent configurations:', err);
        const errorMsg = 'Failed to load privacy preferences. Please try again.';
        setError(errorMsg);
        announceToScreenReader(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    loadConfigurations();
  }, [open, categories, announceToScreenReader]);

  // Handle individual consent change
  const handleConsentChange = useCallback((category: ConsentCategory, granted: boolean) => {
    const config = configurations.find(c => c.category === category);
    
    if (config?.required) {
      announceToScreenReader('This permission is required and cannot be changed.');
      return;
    }
    
    setConsents(prev => ({
      ...prev,
      [category]: granted
    }));
    
    const status = granted ? 'enabled' : 'disabled';
    announceToScreenReader(`${config?.name || category} ${status}.`);
  }, [configurations, announceToScreenReader]);

  // Handle select all toggle
  const handleSelectAll = useCallback((selectAll: boolean) => {
    const updatedConsents = { ...consents };
    let changedCount = 0;
    
    configurations.forEach(config => {
      if (!config.required) {
        const wasChanged = updatedConsents[config.category] !== selectAll;
        updatedConsents[config.category] = selectAll;
        if (wasChanged) changedCount++;
      }
    });
    
    setConsents(updatedConsents);
    
    if (changedCount > 0) {
      const action = selectAll ? 'enabled' : 'disabled';
      announceToScreenReader(`${changedCount} optional permissions ${action}.`);
    }
  }, [consents, configurations, announceToScreenReader]);

  // Handle save and close
  const handleSave = useCallback(async () => {
    try {
      announceToScreenReader('Saving privacy preferences...');
      
      // Update all consents
      await Promise.all(
        Object.entries(consents).map(([category, granted]) =>
          consentManager.updateConsent(category as ConsentCategory, granted)
        )
      );
      
      onConsentUpdate?.(consents);
      announceToScreenReader('Privacy preferences saved successfully.');
      onClose();
      
    } catch (err) {
      console.error('Failed to save consents:', err);
      const errorMsg = 'Failed to save privacy preferences. Please try again.';
      setError(errorMsg);
      announceToScreenReader(errorMsg);
    }
  }, [consents, onConsentUpdate, onClose, announceToScreenReader]);

  // Calculate select all state
  const optionalConfigs = configurations.filter(config => !config.required);
  const optionalConsents = optionalConfigs.map(config => consents[config.category] || false);
  const allOptionalSelected = optionalConsents.length > 0 && optionalConsents.every(Boolean);
  const someOptionalSelected = optionalConsents.some(Boolean);

  // Format retention period
  const formatRetentionPeriod = (days?: number): string => {
    if (days === undefined) return 'Not specified';
    if (days === -1) return 'Indefinite';
    if (days === 0) return 'Session only';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.round(days / 30)} months`;
    return `${Math.round(days / 365)} years`;
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="large"
      title={title}
      showCloseButton={!isInitialConsent}
      closeOnBackdropClick={!isInitialConsent}
      closeOnEsc={!isInitialConsent}
      className={className}
      testId="accessible-consent-dialog"
    >
      <DialogContent highContrast={highContrastMode} ref={dialogRef}>
        {/* Live region for announcements */}
        <LiveRegion role="alert" aria-live="assertive" aria-atomic="true">
          {announcement}
        </LiveRegion>
        
        <IntroSection>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
            {verboseMode && ' Use Tab to navigate between options and Space or Enter to toggle switches.'}
          </DialogDescription>
        </IntroSection>

        {error && (
          <ErrorMessage role="alert">
            {error}
          </ErrorMessage>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Loading privacy preferences...</p>
          </div>
        ) : (
          <>
            {/* Select all section for optional consents */}
            {optionalConfigs.length > 0 && (
              <SelectAllSection highContrast={highContrastMode}>
                <SelectAllControl>
                  <Checkbox
                    id="select-all-optional"
                    checked={allOptionalSelected}
                    indeterminate={someOptionalSelected && !allOptionalSelected}
                    onChange={(checked) => handleSelectAll(checked)}
                    aria-describedby="select-all-description"
                  />
                  <SelectAllLabel htmlFor="select-all-optional">
                    {allOptionalSelected 
                      ? 'Disable all optional permissions' 
                      : 'Enable all optional permissions'
                    }
                  </SelectAllLabel>
                </SelectAllControl>
                <p 
                  id="select-all-description" 
                  style={{ 
                    margin: '0.5rem 0 0 0', 
                    fontSize: '0.75rem', 
                    color: theme.colors.text.secondary 
                  }}
                >
                  This affects {optionalConfigs.length} optional permissions. Required permissions cannot be changed.
                </p>
              </SelectAllSection>
            )}

            {/* Consent configurations */}
            <ConsentList highContrast={highContrastMode}>
              {configurations.map((config) => (
                <ConsentItem 
                  key={config.category}
                  required={config.required}
                  highContrast={highContrastMode}
                  role="group"
                  aria-labelledby={`dialog-consent-${config.category}-name`}
                  aria-describedby={`dialog-consent-${config.category}-description`}
                >
                  <ConsentHeader>
                    <ConsentName id={`dialog-consent-${config.category}-name`}>
                      {config.name}
                    </ConsentName>
                  </ConsentHeader>
                  
                  <ConsentDescription id={`dialog-consent-${config.category}-description`}>
                    {config.description}
                    {verboseMode && config.required && ' This permission is required for the application to function properly.'}
                  </ConsentDescription>
                  
                  <ConsentDetails>
                    <DetailItem>
                      <DetailLabel>Legal Basis:</DetailLabel>
                      <span>{config.legalBasis.replace('_', ' ')}</span>
                    </DetailItem>
                    <DetailItem>
                      <DetailLabel>Retention:</DetailLabel>
                      <span>{formatRetentionPeriod(config.dataRetentionDays)}</span>
                    </DetailItem>
                    {config.thirdParties && config.thirdParties.length > 0 && (
                      <DetailItem>
                        <DetailLabel>Third Parties:</DetailLabel>
                        <span>{config.thirdParties.join(', ')}</span>
                      </DetailItem>
                    )}
                  </ConsentDetails>
                  
                  <ConsentControl>
                    <ControlLabel htmlFor={`dialog-toggle-${config.category}`}>
                      {config.required ? 'Required for operation' : 'Enable data collection'}
                    </ControlLabel>
                    
                    <Toggle
                      id={`dialog-toggle-${config.category}`}
                      checked={consents[config.category] || false}
                      onChange={(checked) => handleConsentChange(config.category, checked)}
                      disabled={config.required}
                      aria-describedby={`dialog-consent-${config.category}-description`}
                      aria-label={`${config.name} data collection`}
                      size="medium"
                    />
                  </ConsentControl>
                </ConsentItem>
              ))}
            </ConsentList>
          </>
        )}

        <ButtonGroup>
          {!isInitialConsent && (
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={loading}
            aria-label={isInitialConsent ? 'Save preferences and continue' : 'Save privacy preferences'}
          >
            {isInitialConsent ? 'Save & Continue' : 'Save Preferences'}
          </Button>
        </ButtonGroup>
      </DialogContent>
    </Modal>
  );
};