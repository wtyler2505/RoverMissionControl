/**
 * Policy Update Notification Component
 * Displays notifications for privacy policy updates requiring user acknowledgment
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { 
  PrivacyPolicy, 
  AcknowledgmentStatus,
  privacyPolicyService 
} from '../../services/privacy/PrivacyPolicyService';
import { Modal } from '../ui/core/Modal';
import { Button } from '../ui/core/Button';
import { Card } from '../ui/core/Card';

interface PolicyUpdateNotificationProps {
  userId: string;
  language?: string;
  onAcknowledgment?: (policyId: string) => void;
  onDismiss?: () => void;
  className?: string;
  checkInterval?: number; // Check for updates every N milliseconds
}

const NotificationBanner = styled.div<{ isVisible: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: ${props => props.theme.colors.status.warning};
  color: ${props => props.theme.colors.text.primary};
  padding: 1rem 2rem;
  transform: translateY(${props => props.isVisible ? '0' : '-100%'});
  transition: transform 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const BannerContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
`;

const BannerMessage = styled.div`
  flex: 1;
`;

const BannerTitle = styled.div`
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
`;

const BannerSubtext = styled.div`
  font-size: 0.875rem;
  opacity: 0.9;
`;

const BannerActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

const BannerButton = styled(Button)`
  white-space: nowrap;
`;

const ModalHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const ModalIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const ModalSubtitle = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
`;

const PolicySummary = styled(Card)`
  margin-bottom: 2rem;
  padding: 1.5rem;
`;

const SummaryTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const SummaryContent = styled.div`
  font-size: 0.875rem;
  line-height: 1.6;
  color: ${props => props.theme.colors.text.secondary};
  margin-bottom: 1rem;
`;

const PolicyMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
`;

const MetaLabel = styled.span`
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
`;

const MetaValue = styled.span`
  color: ${props => props.theme.colors.text.secondary};
`;

const VersionBadge = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => props.theme.colors.primary}20;
  color: ${props => props.theme.colors.primary};
`;

const UrgencyBadge = styled.span<{ level: 'low' | 'medium' | 'high' }>`
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    const colors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444'
    };
    return colors[props.level] + '20';
  }};
  color: ${props => {
    const colors = {
      low: '#10B981',
      medium: '#F59E0B',
      high: '#EF4444'
    };
    return colors[props.level];
  }};
`;

const KeyChanges = styled.div`
  margin-bottom: 2rem;
`;

const ChangesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const ChangeItem = styled.li`
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 8px;
  margin-bottom: 1rem;
  background: ${props => props.theme.colors.background.secondary};
`;

const ChangeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
`;

const ChangeSection = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
`;

const ChangeDescription = styled.div`
  font-size: 0.875rem;
  line-height: 1.5;
  color: ${props => props.theme.colors.text.secondary};
`;

const ConsentRequired = styled.div`
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: ${props => props.theme.colors.status.warning}20;
  border: 1px solid ${props => props.theme.colors.status.warning};
  border-radius: 4px;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.status.warning};
`;

const ActionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-top: 2rem;
  border-top: 1px solid ${props => props.theme.colors.border.secondary};
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
`;

const ActionDescription = styled.p`
  text-align: center;
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
`;

const GracePeriodWarning = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.status.error}20;
  border: 1px solid ${props => props.theme.colors.status.error};
  border-radius: 8px;
  margin-bottom: 2rem;
`;

const WarningTitle = styled.div`
  font-weight: 600;
  color: ${props => props.theme.colors.status.error};
  margin-bottom: 0.5rem;
`;

const WarningText = styled.div`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.status.error};
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

export const PolicyUpdateNotification: React.FC<PolicyUpdateNotificationProps> = ({
  userId,
  language = 'en',
  onAcknowledgment,
  onDismiss,
  className,
  checkInterval = 300000 // 5 minutes
}) => {
  const theme = useTheme();
  const [acknowledgmentStatus, setAcknowledgmentStatus] = useState<AcknowledgmentStatus | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check acknowledgment status
  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await privacyPolicyService.checkAcknowledgmentStatus(userId, language);
      setAcknowledgmentStatus(status);
      
      if (status.required) {
        setShowBanner(true);
        
        // Show modal immediately if grace period expired
        if (status.grace_period_expired) {
          setShowModal(true);
        }
      } else {
        setShowBanner(false);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Failed to check acknowledgment status:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, language]);

  // Initial check and periodic updates
  useEffect(() => {
    checkStatus();
    
    if (checkInterval > 0) {
      const interval = setInterval(checkStatus, checkInterval);
      return () => clearInterval(interval);
    }
  }, [checkStatus, checkInterval]);

  // Handle acknowledgment
  const handleAcknowledge = useCallback(async () => {
    if (!acknowledgmentStatus?.policy) return;

    try {
      setAcknowledging(true);
      
      const success = await privacyPolicyService.acknowledgePolicy(
        acknowledgmentStatus.policy.id,
        'modal',
        userId
      );
      
      if (success) {
        setShowBanner(false);
        setShowModal(false);
        onAcknowledgment?.(acknowledgmentStatus.policy.id);
        
        // Refresh status
        await checkStatus();
        
        // Announce to screen readers
        privacyPolicyService.announceToScreenReader(
          'Privacy policy acknowledged successfully'
        );
      }
    } catch (error) {
      console.error('Failed to acknowledge policy:', error);
    } finally {
      setAcknowledging(false);
    }
  }, [acknowledgmentStatus, userId, onAcknowledgment, checkStatus]);

  // Handle banner dismiss (temporary)
  const handleBannerDismiss = useCallback(() => {
    setShowBanner(false);
    onDismiss?.();
    
    // Show banner again after 1 hour if still required
    setTimeout(() => {
      checkStatus();
    }, 3600000);
  }, [onDismiss, checkStatus]);

  // Handle modal view
  const handleViewDetails = useCallback(() => {
    setShowModal(true);
  }, []);

  // Don't render if no notification needed
  if (loading || !acknowledgmentStatus?.required) {
    return null;
  }

  const policy = acknowledgmentStatus.policy!;
  const isUrgent = acknowledgmentStatus.grace_period_expired;
  const daysOverdue = acknowledgmentStatus.days_since_effective || 0;

  return (
    <div className={className}>
      {/* Banner Notification */}
      <NotificationBanner isVisible={showBanner} role="banner" aria-live="polite">
        <BannerContent>
          <BannerMessage>
            <BannerTitle>
              {isUrgent ? '🚨 Action Required' : '📋 Privacy Policy Update'}
            </BannerTitle>
            <BannerSubtext>
              {isUrgent 
                ? `Privacy policy acknowledgment is ${daysOverdue - 30} days overdue`
                : 'Our privacy policy has been updated and requires your acknowledgment'
              }
            </BannerSubtext>
          </BannerMessage>
          
          <BannerActions>
            <BannerButton
              variant="secondary"
              size="small"
              onClick={handleViewDetails}
            >
              View Changes
            </BannerButton>
            {!isUrgent && (
              <BannerButton
                variant="secondary"
                size="small"
                onClick={handleBannerDismiss}
                aria-label="Dismiss notification temporarily"
              >
                ✕
              </BannerButton>
            )}
          </BannerActions>
        </BannerContent>
      </NotificationBanner>

      {/* Detailed Modal */}
      <Modal
        isOpen={showModal}
        onClose={isUrgent ? undefined : () => setShowModal(false)}
        title="Privacy Policy Update"
        maxWidth="700px"
        closeOnEscape={!isUrgent}
        closeOnOverlayClick={!isUrgent}
      >
        <div>
          <ModalHeader>
            <ModalIcon>{isUrgent ? '🚨' : '📋'}</ModalIcon>
            <ModalTitle>
              {isUrgent ? 'Immediate Action Required' : 'Privacy Policy Updated'}
            </ModalTitle>
            <ModalSubtitle>
              {isUrgent 
                ? 'Your acknowledgment is overdue and required to continue using the system'
                : 'Please review the changes and acknowledge the updated policy'
              }
            </ModalSubtitle>
          </ModalHeader>

          {isUrgent && (
            <GracePeriodWarning>
              <WarningTitle>Grace Period Expired</WarningTitle>
              <WarningText>
                The 30-day grace period for acknowledging this privacy policy update has expired. 
                You must acknowledge the policy to continue using the system.
              </WarningText>
            </GracePeriodWarning>
          )}

          <PolicySummary>
            <SummaryTitle>Policy Update Summary</SummaryTitle>
            
            <PolicyMeta>
              <MetaItem>
                <MetaLabel>Version:</MetaLabel>
                <MetaValue>
                  <VersionBadge>{policy.version}</VersionBadge>
                </MetaValue>
              </MetaItem>
              
              <MetaItem>
                <MetaLabel>Effective Date:</MetaLabel>
                <MetaValue>
                  {privacyPolicyService.formatDate(policy.effective_date)}
                </MetaValue>
              </MetaItem>
              
              <MetaItem>
                <MetaLabel>Days Since Effective:</MetaLabel>
                <MetaValue>
                  <UrgencyBadge level={daysOverdue > 30 ? 'high' : daysOverdue > 7 ? 'medium' : 'low'}>
                    {daysOverdue} days
                  </UrgencyBadge>
                </MetaValue>
              </MetaItem>
            </PolicyMeta>

            {policy.plain_language_summary && (
              <SummaryContent>
                <strong>Summary:</strong> {policy.plain_language_summary}
              </SummaryContent>
            )}
          </PolicySummary>

          {policy.changes && policy.changes.length > 0 && (
            <KeyChanges>
              <SummaryTitle>Key Changes</SummaryTitle>
              <ChangesList>
                {policy.changes.slice(0, 5).map((change, index) => (
                  <ChangeItem key={index}>
                    <ChangeHeader>
                      <ChangeSection>
                        {change.section_key || 'General Policy'}
                      </ChangeSection>
                      <UrgencyBadge level={change.impact_level as 'low' | 'medium' | 'high'}>
                        {change.impact_level} impact
                      </UrgencyBadge>
                    </ChangeHeader>
                    
                    <ChangeDescription>
                      {change.plain_language_description || change.change_description}
                    </ChangeDescription>
                    
                    {change.requires_consent && (
                      <ConsentRequired>
                        ⚠️ This change affects how we collect or use your data and requires your consent.
                      </ConsentRequired>
                    )}
                  </ChangeItem>
                ))}
                
                {policy.changes.length > 5 && (
                  <div style={{ 
                    textAlign: 'center', 
                    color: theme.colors.text.secondary,
                    fontStyle: 'italic',
                    marginTop: '1rem'
                  }}>
                    ... and {policy.changes.length - 5} more changes
                  </div>
                )}
              </ChangesList>
            </KeyChanges>
          )}

          <ActionSection>
            <ActionDescription>
              By clicking "I Acknowledge", you confirm that you have read and understood 
              the privacy policy changes. This acknowledgment is required to continue 
              using the rover mission control system.
            </ActionDescription>
            
            <ActionButtons>
              <Button
                variant="secondary"
                onClick={() => {
                  // Open full policy in new tab/modal
                  window.open(`/privacy/policy/${policy.id}`, '_blank');
                }}
              >
                Read Full Policy
              </Button>
              
              <Button
                variant="primary"
                size="large"
                onClick={handleAcknowledge}
                disabled={acknowledging}
              >
                {acknowledging ? <LoadingSpinner /> : 'I Acknowledge'}
              </Button>
            </ActionButtons>

            {!isUrgent && (
              <div style={{ textAlign: 'center' }}>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => setShowModal(false)}
                >
                  I'll review this later
                </Button>
              </div>
            )}
          </ActionSection>
        </div>
      </Modal>
    </div>
  );
};