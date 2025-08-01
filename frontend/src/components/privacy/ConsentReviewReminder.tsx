/**
 * Consent Review Reminder Component
 * Shows periodic reminders to review privacy settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { useTheme } from '@emotion/react';
import { consentManager } from '../../services/privacy/ConsentManager';
import { consentVersioningService, PolicyUpdateNotification } from '../../services/privacy/ConsentVersioningService';
import { Button } from '../ui/core/Button';
import { Modal } from '../ui/core/Modal';

interface ConsentReviewReminderProps {
  onOpenSettings: () => void;
  onComplete: () => void;
  checkInterval?: number; // Check every N milliseconds (default: 1 hour)
}

const ReminderBanner = styled.div<{ type: 'info' | 'warning' | 'urgent' }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  padding: 1rem;
  background: ${props => {
    switch (props.type) {
      case 'urgent': return props.theme.colors.status.error;
      case 'warning': return props.theme.colors.status.warning;
      default: return props.theme.colors.primary;
    }
  }};
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  animation: slideDown 0.3s ease-out;

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

const BannerContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
`;

const BannerText = styled.div`
  flex: 1;
`;

const BannerTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
`;

const BannerDescription = styled.p`
  font-size: 0.875rem;
  margin: 0;
  opacity: 0.9;
`;

const BannerActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
`;

const ModalContent = styled.div`
  max-width: 600px;
`;

const ReviewHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid ${props => props.theme.colors.border.secondary};
`;

const ReviewIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
`;

const ReviewTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 0.5rem;
`;

const ReviewSubtitle = styled.p`
  font-size: 1rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const ReviewSection = styled.div`
  margin-bottom: 2rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin-bottom: 1rem;
`;

const ReviewItem = styled.div`
  padding: 1rem;
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 6px;
  margin-bottom: 0.75rem;
  background: ${props => props.theme.colors.background.secondary};
`;

const ReviewItemHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const ReviewItemTitle = styled.h3`
  font-size: 1rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0;
`;

const ReviewItemDate = styled.span`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.tertiary};
`;

const ReviewItemDescription = styled.p`
  font-size: 0.875rem;
  color: ${props => props.theme.colors.text.secondary};
  line-height: 1.4;
  margin: 0;
`;

const ChangesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0.75rem 0 0 0;
`;

const ChangeItem = styled.li<{ type: 'added' | 'modified' | 'removed' }>`
  padding: 0.25rem 0;
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  
  &:before {
    content: ${props => {
      switch (props.type) {
        case 'added': return '"+ "';
        case 'removed': return '"- "';
        default: return '"~ "';
      }
    }};
    font-weight: bold;
    color: ${props => {
      switch (props.type) {
        case 'added': return props.theme.colors.status.success;
        case 'removed': return props.theme.colors.status.error;
        default: return props.theme.colors.status.warning;
      }
    }};
  }
`;

const StatCard = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.background.tertiary};
  border-radius: 6px;
  text-align: center;
  margin-bottom: 1rem;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.primary};
`;

const StatLabel = styled.div`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin-top: 0.25rem;
`;

const Actions = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1.5rem;
  border-top: 1px solid ${props => props.theme.colors.border.secondary};
`;

const QuickActions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
`;

const QuickActionCard = styled.div`
  padding: 1rem;
  background: ${props => props.theme.colors.background.secondary};
  border: 1px solid ${props => props.theme.colors.border.secondary};
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.theme.colors.primary};
    background: ${props => props.theme.colors.background.tertiary};
  }
`;

const QuickActionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 500;
  color: ${props => props.theme.colors.text.primary};
  margin: 0 0 0.5rem 0;
`;

const QuickActionDescription = styled.p`
  font-size: 0.75rem;
  color: ${props => props.theme.colors.text.secondary};
  margin: 0;
  line-height: 1.4;
`;

interface ReviewData {
  isDue: boolean;
  daysOverdue: number;
  scheduledDate: Date | null;
  reviewType: string | null;
  statistics: any;
  policyUpdates: PolicyUpdateNotification[];
  lastReviewDate?: Date;
}

export const ConsentReviewReminder: React.FC<ConsentReviewReminderProps> = ({
  onOpenSettings,
  onComplete,
  checkInterval = 60 * 60 * 1000 // 1 hour
}) => {
  const theme = useTheme();
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [bannerType, setBannerType] = useState<'info' | 'warning' | 'urgent'>('info');
  const [dismissed, setDismissed] = useState(false);

  // Check if review is needed
  const checkReviewStatus = useCallback(async () => {
    try {
      if (dismissed) return;

      const [reviewStatus, statistics, policyHistory] = await Promise.all([
        consentManager.isConsentReviewDue(),
        consentManager.getConsentStatistics(),
        consentVersioningService.checkUserPolicyStatus(consentManager.userId)
      ]);

      const policyUpdates = consentVersioningService.getPendingNotifications(consentManager.userId);

      const data: ReviewData = {
        isDue: reviewStatus.isDue || policyHistory.needsReview,
        daysOverdue: Math.max(reviewStatus.daysOverdue, policyHistory.daysOverdue),
        scheduledDate: reviewStatus.scheduledDate,
        reviewType: reviewStatus.reviewType,
        statistics,
        policyUpdates
      };

      setReviewData(data);

      if (data.isDue) {
        // Determine urgency
        if (data.daysOverdue > 30 || policyHistory.requiresNewConsent) {
          setBannerType('urgent');
        } else if (data.daysOverdue > 7) {
          setBannerType('warning');
        } else {
          setBannerType('info');
        }

        setShowBanner(true);
      } else {
        setShowBanner(false);
      }

    } catch (error) {
      console.error('Failed to check consent review status:', error);
    }
  }, [dismissed]);

  // Set up periodic checking
  useEffect(() => {
    checkReviewStatus();
    const interval = setInterval(checkReviewStatus, checkInterval);
    return () => clearInterval(interval);
  }, [checkReviewStatus, checkInterval]);

  // Handle dismiss banner
  const handleDismissBanner = useCallback(() => {
    setShowBanner(false);
    setDismissed(true);
    
    // Re-enable checking after 24 hours
    setTimeout(() => {
      setDismissed(false);
    }, 24 * 60 * 60 * 1000);
  }, []);

  // Handle complete review
  const handleCompleteReview = useCallback(async () => {
    try {
      await consentManager.completeConsentReview();
      
      // Mark policy notifications as acknowledged
      if (reviewData?.policyUpdates) {
        for (const notification of reviewData.policyUpdates) {
          await consentVersioningService.acknowledgeNotification(notification.id);
        }
      }

      setShowBanner(false);
      setShowModal(false);
      setDismissed(true);
      onComplete();

      // Schedule next check
      setTimeout(() => {
        setDismissed(false);
      }, 24 * 60 * 60 * 1000);
      
    } catch (error) {
      console.error('Failed to complete review:', error);
    }
  }, [reviewData, onComplete]);

  // Format date
  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString();
  };

  // Get banner message
  const getBannerMessage = () => {
    if (!reviewData) return { title: '', description: '' };

    if (reviewData.policyUpdates.length > 0) {
      return {
        title: 'Privacy Policy Updated',
        description: `We've updated our privacy policy. Please review the changes and update your consent preferences.`
      };
    }

    if (reviewData.daysOverdue > 0) {
      return {
        title: 'Privacy Review Overdue',
        description: `Your privacy settings review is ${reviewData.daysOverdue} days overdue. Please take a moment to review your preferences.`
      };
    }

    return {
      title: 'Privacy Review Due',
      description: 'It\'s time to review your privacy settings to ensure they still meet your needs.'
    };
  };

  const bannerMessage = getBannerMessage();

  return (
    <>
      {/* Banner Notification */}
      {showBanner && reviewData && (
        <ReminderBanner type={bannerType}>
          <BannerContent>
            <BannerText>
              <BannerTitle>{bannerMessage.title}</BannerTitle>
              <BannerDescription>{bannerMessage.description}</BannerDescription>
            </BannerText>
            <BannerActions>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setShowModal(true)}
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white'
                }}
              >
                Review Now
              </Button>
              <Button
                variant="secondary"
                size="small"
                onClick={onOpenSettings}
                style={{ 
                  backgroundColor: 'white',
                  color: theme.colors.text.primary
                }}
              >
                Open Settings
              </Button>
              <button
                onClick={handleDismissBanner}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  fontSize: '1.25rem',
                  opacity: 0.7
                }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </BannerActions>
          </BannerContent>
        </ReminderBanner>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Privacy Settings Review"
        size="large"
      >
        <ModalContent>
          <ReviewHeader>
            <ReviewIcon>🔒</ReviewIcon>
            <ReviewTitle>Privacy Settings Review</ReviewTitle>
            <ReviewSubtitle>
              Let's make sure your privacy preferences are up to date and still meet your needs.
            </ReviewSubtitle>
          </ReviewHeader>

          {reviewData && (
            <>
              {/* Statistics */}
              <ReviewSection>
                <SectionTitle>Current Status</SectionTitle>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
                  gap: '1rem' 
                }}>
                  <StatCard>
                    <StatValue>{reviewData.statistics?.categoriesWithConsent || 0}</StatValue>
                    <StatLabel>Permissions Enabled</StatLabel>
                  </StatCard>
                  <StatCard>
                    <StatValue>{reviewData.statistics?.totalChanges || 0}</StatValue>
                    <StatLabel>Total Changes Made</StatLabel>
                  </StatCard>
                  <StatCard>
                    <StatValue>
                      {reviewData.statistics?.lastChanged 
                        ? formatDate(reviewData.statistics.lastChanged)
                        : 'Never'
                      }
                    </StatValue>
                    <StatLabel>Last Updated</StatLabel>
                  </StatCard>
                </div>
              </ReviewSection>

              {/* Policy Updates */}
              {reviewData.policyUpdates.length > 0 && (
                <ReviewSection>
                  <SectionTitle>Privacy Policy Updates</SectionTitle>
                  {reviewData.policyUpdates.map(notification => (
                    <ReviewItem key={notification.id}>
                      <ReviewItemHeader>
                        <ReviewItemTitle>Version {notification.policyVersion}</ReviewItemTitle>
                        <ReviewItemDate>{formatDate(notification.notificationDate)}</ReviewItemDate>
                      </ReviewItemHeader>
                      <ReviewItemDescription>
                        This update requires your review and acknowledgment of privacy policy changes.
                      </ReviewItemDescription>
                    </ReviewItem>
                  ))}
                </ReviewSection>
              )}

              {/* Quick Actions */}
              <ReviewSection>
                <SectionTitle>Quick Actions</SectionTitle>
                <QuickActions>
                  <QuickActionCard onClick={onOpenSettings}>
                    <QuickActionTitle>Review All Settings</QuickActionTitle>
                    <QuickActionDescription>
                      Go through all privacy categories and update your preferences
                    </QuickActionDescription>
                  </QuickActionCard>
                  
                  <QuickActionCard onClick={handleCompleteReview}>
                    <QuickActionTitle>Confirm Current Settings</QuickActionTitle>
                    <QuickActionDescription>
                      Keep all current settings and mark review as complete
                    </QuickActionDescription>
                  </QuickActionCard>
                </QuickActions>
              </ReviewSection>

              {/* Review Information */}
              <ReviewSection>
                <ReviewItem>
                  <ReviewItemTitle>Why do we ask for periodic reviews?</ReviewItemTitle>
                  <ReviewItemDescription>
                    Regular privacy reviews ensure your consent preferences remain current and 
                    reflect your actual privacy needs. This is part of our commitment to 
                    transparent data handling and your rights under privacy regulations.
                  </ReviewItemDescription>
                </ReviewItem>
              </ReviewSection>

              {/* Actions */}
              <Actions>
                <Button
                  variant="secondary"
                  onClick={() => setShowModal(false)}
                >
                  Remind Me Later
                </Button>
                <Button
                  variant="secondary"
                  onClick={onOpenSettings}
                >
                  Open Full Settings
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCompleteReview}
                >
                  Complete Review
                </Button>
              </Actions>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};