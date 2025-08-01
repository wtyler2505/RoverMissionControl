/**
 * Alert Dismissal Controls Component
 * Provides comprehensive dismissal options with priority-specific behaviors
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { Button } from '../../Button/Button';
import { Modal } from '../../Modal/Modal';
import { Input } from '../../Input/Input';
import { Select } from '../../Select/Select';
import { Checkbox } from '../../Checkbox/Checkbox';
import { Tooltip } from '../../Tooltip/Tooltip';
import { Badge } from '../../Badge/Badge';
import { 
  DismissalType, 
  DismissalBehavior, 
  EnhancedAlertGroupingManager 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';

export interface AlertDismissalControlsProps {
  alertId: string;
  groupingManager: EnhancedAlertGroupingManager;
  onDismiss: (alertId: string, type: DismissalType, options?: {
    reason?: string;
    user?: string;
    scheduleMs?: number;
  }) => Promise<boolean>;
  onBulkDismiss?: (alertIds: string[], type: DismissalType, options?: any) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

interface DismissalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: DismissalType, options: any) => void;
  dismissalFeedback: ReturnType<EnhancedAlertGroupingManager['getDismissalFeedback']>;
  alertId: string;
}

const ControlsContainer = styled.div<{ theme: Theme; compact?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme, compact }) => compact ? theme.spacing[2] : theme.spacing[3]};
  flex-wrap: wrap;
`;

const DismissalButton = styled(Button)<{ 
  theme: Theme; 
  behavior: DismissalBehavior;
}>`
  ${({ theme, behavior }) => {
    const behaviorStyles = {
      persistent: css`
        background-color: ${theme.colors.error.main};
        color: ${theme.colors.error.contrastText};
        &:hover {
          background-color: ${theme.colors.error.dark};
        }
      `,
      sticky: css`
        background-color: ${theme.colors.warning.main};
        color: ${theme.colors.warning.contrastText};
        &:hover {
          background-color: ${theme.colors.warning.dark};
        }
      `,
      blocking: css`
        background-color: ${theme.colors.info.main};
        color: ${theme.colors.info.contrastText};
        &:hover {
          background-color: ${theme.colors.info.dark};
        }
      `,
      'auto-hide': css`
        background-color: ${theme.colors.success.main};
        color: ${theme.colors.success.contrastText};
        &:hover {
          background-color: ${theme.colors.success.dark};
        }
      `,
      timeout: css`
        background-color: ${theme.colors.primary.main};
        color: ${theme.colors.primary.contrastText};
        &:hover {
          background-color: ${theme.colors.primary.dark};
        }
      `,
    };
    
    return behaviorStyles[behavior] || behaviorStyles['auto-hide'];
  }}
`;

const RequirementBadge = styled(Badge)`
  font-size: 0.75rem;
  padding: 2px 6px;
`;

const TimeoutIndicator = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const ModalContent = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  max-width: 500px;
`;

const ModalSection = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ModalTitle = styled.h3<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[3]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const ModalDescription = styled.p<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const DismissalTypeGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const DismissalTypeCard = styled.div<{ 
  theme: Theme; 
  selected: boolean;
  disabled?: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  border: 2px solid ${({ theme, selected }) => 
    selected ? theme.colors.primary.main : theme.colors.divider
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s ease;
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  
  ${({ theme, selected, disabled }) => !disabled && css`
    &:hover {
      border-color: ${selected ? theme.colors.primary.dark : theme.colors.primary.light};
      background-color: ${theme.colors.background.elevated};
    }
  `}
  
  ${({ theme, selected }) => selected && css`
    background-color: ${theme.colors.primary.main}10;
  `}
`;

const TypeTitle = styled.h4<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const TypeDescription = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const OptionsForm = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const FormRow = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  align-items: flex-end;
`;

const ModalActions = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-top: ${({ theme }) => theme.spacing[6]};
`;

const DISMISSAL_TYPES = [
  {
    type: 'manual' as DismissalType,
    title: 'Manual Dismissal',
    description: 'Dismiss immediately with optional reason',
    icon: '👆',
  },
  {
    type: 'timed' as DismissalType,
    title: 'Timed Dismissal',
    description: 'Schedule dismissal after a specific duration',
    icon: '⏰',
  },
  {
    type: 'conditional' as DismissalType,
    title: 'Conditional Dismissal',
    description: 'Dismiss when specific conditions are met',
    icon: '🔧',
  },
];

const DismissalModal: React.FC<DismissalModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  dismissalFeedback,
  alertId,
}) => {
  const [selectedType, setSelectedType] = useState<DismissalType>('manual');
  const [reason, setReason] = useState('');
  const [scheduleMinutes, setScheduleMinutes] = useState(5);
  const [requireConfirmation, setRequireConfirmation] = useState(false);

  const handleConfirm = useCallback(() => {
    const options: any = {
      reason: reason.trim() || undefined,
    };

    if (selectedType === 'timed') {
      options.scheduleMs = scheduleMinutes * 60 * 1000;
    }

    if (requireConfirmation) {
      options.requireConfirmation = true;
    }

    onConfirm(selectedType, options);
    onClose();
  }, [selectedType, reason, scheduleMinutes, requireConfirmation, onConfirm, onClose]);

  if (!dismissalFeedback) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="medium">
      <ModalContent>
        <ModalTitle>Dismiss Alert</ModalTitle>
        <ModalDescription>
          Choose how you want to dismiss this alert. The behavior depends on the alert priority.
        </ModalDescription>

        {!dismissalFeedback.canDismiss && (
          <RequirementBadge variant="error">
            {dismissalFeedback.reason}
          </RequirementBadge>
        )}

        <ModalSection>
          <DismissalTypeGrid>
            {DISMISSAL_TYPES.map(({ type, title, description, icon }) => (
              <DismissalTypeCard
                key={type}
                selected={selectedType === type}
                disabled={!dismissalFeedback.canDismiss && type !== 'manual'}
                onClick={() => dismissalFeedback.canDismiss && setSelectedType(type)}
              >
                <TypeTitle>
                  {icon} {title}
                </TypeTitle>
                <TypeDescription>{description}</TypeDescription>
              </DismissalTypeCard>
            ))}
          </DismissalTypeGrid>
        </ModalSection>

        <ModalSection>
          <OptionsForm>
            <Input
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you dismissing this alert?"
              maxLength={200}
            />

            {selectedType === 'timed' && (
              <FormRow>
                <Input
                  label="Schedule (minutes)"
                  type="number"
                  value={scheduleMinutes}
                  onChange={(e) => setScheduleMinutes(parseInt(e.target.value) || 5)}
                  min={1}
                  max={1440}
                />
                <span>minutes from now</span>
              </FormRow>
            )}

            {dismissalFeedback.requiresAcknowledgment && (
              <Checkbox
                label="I acknowledge this alert has been reviewed"
                checked={requireConfirmation}
                onChange={setRequireConfirmation}
                required
              />
            )}
          </OptionsForm>
        </ModalSection>

        <ModalActions>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={
              !dismissalFeedback.canDismiss ||
              (dismissalFeedback.requiresAcknowledgment && !requireConfirmation)
            }
          >
            Dismiss Alert
          </Button>
        </ModalActions>
      </ModalContent>
    </Modal>
  );
};

export const AlertDismissalControls: React.FC<AlertDismissalControlsProps> = ({
  alertId,
  groupingManager,
  onDismiss,
  onBulkDismiss,
  disabled = false,
  compact = false,
  className,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dismissalFeedback, setDismissalFeedback] = useState<ReturnType<EnhancedAlertGroupingManager['getDismissalFeedback']>>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoTimeout, setAutoTimeout] = useState<NodeJS.Timeout | null>(null);

  // Get dismissal feedback
  useEffect(() => {
    const feedback = groupingManager.getDismissalFeedback(alertId);
    setDismissalFeedback(feedback);

    // Set up auto-timeout if applicable
    if (feedback?.timeoutMs && feedback.behavior === 'timeout') {
      const timer = setTimeout(() => {
        handleQuickDismiss('auto-priority');
      }, feedback.timeoutMs);
      setAutoTimeout(timer);
    }

    return () => {
      if (autoTimeout) {
        clearTimeout(autoTimeout);
      }
    };
  }, [alertId, groupingManager]);

  const handleQuickDismiss = useCallback(async (type: DismissalType = 'manual') => {
    if (!dismissalFeedback?.canDismiss && type !== 'auto-priority') return;
    
    setIsProcessing(true);
    try {
      await onDismiss(alertId, type);
    } finally {
      setIsProcessing(false);
    }
  }, [alertId, onDismiss, dismissalFeedback]);

  const handleAdvancedDismiss = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleModalConfirm = useCallback(async (type: DismissalType, options: any) => {
    setIsProcessing(true);
    try {
      await onDismiss(alertId, type, options);
    } finally {
      setIsProcessing(false);
    }
  }, [alertId, onDismiss]);

  if (!dismissalFeedback) return null;

  const getBehaviorLabel = (behavior: DismissalBehavior): string => {
    const labels = {
      persistent: 'Requires Acknowledgment',
      sticky: 'Stays Until Dismissed',
      blocking: 'Must Be Handled',
      'auto-hide': 'Auto-Hide After View',
      timeout: 'Auto-Timeout',
    };
    return labels[behavior];
  };

  const getBehaviorColor = (behavior: DismissalBehavior): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
    const colors = {
      persistent: 'error' as const,
      sticky: 'warning' as const,
      blocking: 'info' as const,
      'auto-hide': 'success' as const,
      timeout: 'neutral' as const,
    };
    return colors[behavior];
  };

  return (
    <ControlsContainer compact={compact} className={className}>
      {/* Behavior indicator */}
      <RequirementBadge variant={getBehaviorColor(dismissalFeedback.behavior)}>
        {getBehaviorLabel(dismissalFeedback.behavior)}
      </RequirementBadge>

      {/* Auto-timeout indicator */}
      {dismissalFeedback.timeoutMs && (
        <TimeoutIndicator>
          ⏰ Auto-dismiss in {Math.ceil(dismissalFeedback.timeoutMs / 1000)}s
        </TimeoutIndicator>
      )}

      {/* Quick dismiss button */}
      {dismissalFeedback.canDismiss && (
        <Tooltip 
          content={
            dismissalFeedback.requiresAcknowledgment 
              ? "Quick dismiss (requires acknowledgment)"
              : "Quick dismiss"
          }
        >
          <DismissalButton
            variant="ghost"
            size={compact ? "small" : "medium"}
            behavior={dismissalFeedback.behavior}
            onClick={() => handleQuickDismiss()}
            disabled={disabled || isProcessing}
            loading={isProcessing}
          >
            {compact ? '×' : 'Dismiss'}
          </DismissalButton>
        </Tooltip>
      )}

      {/* Advanced dismiss button */}
      <Tooltip content="Advanced dismissal options">
        <Button
          variant="ghost"
          size={compact ? "small" : "medium"}
          onClick={handleAdvancedDismiss}
          disabled={disabled}
        >
          {compact ? '⚙' : 'Options'}
        </Button>
      </Tooltip>

      {/* Dismissal modal */}
      <DismissalModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        dismissalFeedback={dismissalFeedback}
        alertId={alertId}
      />
    </ControlsContainer>
  );
};

export default AlertDismissalControls;