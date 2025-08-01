/**
 * Alert Undo Manager Component
 * Provides undo functionality for alert dismissals with clear feedback
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { Button } from '../../Button/Button';
import { Modal } from '../../Modal/Modal';
import { Badge } from '../../Badge/Badge';
import { Tooltip } from '../../Tooltip/Tooltip';
import { 
  DismissalType, 
  EnhancedAlertGroupingManager 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';

export interface AlertUndoManagerProps {
  groupingManager: EnhancedAlertGroupingManager;
  onUndo?: (actionId: string) => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'top-center';
  maxVisible?: number;
  className?: string;
}

interface UndoToast {
  id: string;
  type: DismissalType;
  timestamp: Date;
  description: string;
  canUndo: boolean;
  expiresAt?: Date;
  isExpiring?: boolean;
}

const slideUp = keyframes`
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

const slideDown = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(100%);
    opacity: 0;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

const UndoContainer = styled.div<{ 
  theme: Theme; 
  position: AlertUndoManagerProps['position'];
}>`
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  max-width: 400px;
  width: auto;
  pointer-events: none;
  z-index: ${({ theme }) => theme.zIndex?.tooltip || 1200};
  
  ${({ position }) => {
    const positions = {
      'bottom-right': css`
        bottom: 20px;
        right: 20px;
        align-items: flex-end;
      `,
      'bottom-left': css`
        bottom: 20px;
        left: 20px;
        align-items: flex-start;
      `,
      'bottom-center': css`
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        align-items: center;
      `,
      'top-right': css`
        top: 20px;
        right: 20px;
        align-items: flex-end;
      `,
      'top-left': css`
        top: 20px;
        left: 20px;
        align-items: flex-start;
      `,
      'top-center': css`
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        align-items: center;
      `,
    };
    return positions[position || 'bottom-right'];
  }}
  
  @media (max-width: 640px) {
    max-width: calc(100vw - 40px);
    
    ${({ position }) => position?.includes('center') && css`
      transform: translateX(-50%);
    `}
  }
`;

const UndoToastCard = styled.div<{ 
  theme: Theme; 
  isExpiring?: boolean;
  canUndo: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  pointer-events: auto;
  min-width: 300px;
  max-width: 400px;
  
  animation: ${slideUp} 0.3s ease-out;
  
  ${({ theme, isExpiring }) => isExpiring && css`
    animation: ${pulse} 1s ease-in-out infinite;
    border-color: ${theme.colors.warning.main};
    background-color: ${theme.colors.warning.main}05;
  `}
  
  ${({ canUndo }) => !canUndo && css`
    opacity: 0.6;
  `}
  
  &.toast-exit {
    animation: ${slideDown} 0.2s ease-in;
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const ToastContent = styled.div<{ theme: Theme }>`
  flex: 1;
  min-width: 0;
  margin-right: ${({ theme }) => theme.spacing[3]};
`;

const ToastTitle = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const ToastDescription = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const ToastActions = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

const UndoButton = styled(Button)<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[3]};
  min-height: auto;
`;

const CloseButton = styled.button<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  transition: all 0.2s ease;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.divider};
    color: ${({ theme }) => theme.colors.text.primary};
  }
  
  &:focus {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }
`;

const ExpirationTimer = styled.div<{ theme: Theme; progress: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background-color: ${({ theme }) => theme.colors.warning.main};
  width: ${({ progress }) => `${progress}%`};
  transition: width 1s linear;
  border-radius: 0 0 ${({ theme }) => theme.borderRadius.md} ${({ theme }) => theme.borderRadius.md};
`;

const HistoryButton = styled(Button)<{ theme: Theme }>`
  position: absolute;
  bottom: 20px;
  right: 20px;
  z-index: ${({ theme }) => theme.zIndex?.fab || 1300};
`;

const HistoryModal = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  max-width: 600px;
  max-height: 70vh;
  overflow-y: auto;
`;

const HistoryTitle = styled.h2<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const HistoryList = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const HistoryItem = styled.div<{ theme: Theme; canUndo: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.background.paper};
  opacity: ${({ canUndo }) => canUndo ? 1 : 0.6};
`;

const HistoryItemContent = styled.div<{ theme: Theme }>`
  flex: 1;
  min-width: 0;
`;

const HistoryItemTitle = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const HistoryItemMeta = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

export const AlertUndoManager: React.FC<AlertUndoManagerProps> = ({
  groupingManager,
  onUndo,
  position = 'bottom-right',
  maxVisible = 3,
  className,
}) => {
  const [undoToasts, setUndoToasts] = useState<UndoToast[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [undoHistory, setUndoHistory] = useState<any[]>([]);

  // Update undo toasts from grouping manager
  useEffect(() => {
    const updateToasts = () => {
      const actions = groupingManager.getUndoableActions();
      const toasts: UndoToast[] = actions
        .slice(0, maxVisible)
        .map(action => ({
          id: action.id,
          type: action.type,
          timestamp: action.timestamp,
          description: action.description,
          canUndo: action.canUndo,
          expiresAt: action.canUndo ? new Date(action.timestamp.getTime() + 300000) : undefined, // 5 minutes
        }));
      
      setUndoToasts(toasts);
      setUndoHistory(actions);
    };

    // Initial load
    updateToasts();

    // Set up periodic updates to handle expiration
    const interval = setInterval(updateToasts, 1000);
    return () => clearInterval(interval);
  }, [groupingManager, maxVisible]);

  // Calculate expiration progress
  const getExpirationProgress = useCallback((toast: UndoToast): number => {
    if (!toast.expiresAt || !toast.canUndo) return 0;
    
    const totalTime = 300000; // 5 minutes
    const remainingTime = toast.expiresAt.getTime() - Date.now();
    const progress = Math.max(0, (remainingTime / totalTime) * 100);
    
    return progress;
  }, []);

  // Check if toast is expiring soon (less than 30 seconds)
  const isToastExpiring = useCallback((toast: UndoToast): boolean => {
    if (!toast.expiresAt || !toast.canUndo) return false;
    const remainingTime = toast.expiresAt.getTime() - Date.now();
    return remainingTime < 30000 && remainingTime > 0;
  }, []);

  const handleUndo = useCallback(async (actionId: string) => {
    try {
      const success = await groupingManager.undoDismissal(actionId);
      if (success) {
        onUndo?.(actionId);
        // Remove the toast
        setUndoToasts(prev => prev.filter(toast => toast.id !== actionId));
      }
    } catch (error) {
      console.error('Failed to undo dismissal:', error);
    }
  }, [groupingManager, onUndo]);

  const handleDismissToast = useCallback((toastId: string) => {
    setUndoToasts(prev => prev.filter(toast => toast.id !== toastId));
  }, []);

  const formatTimestamp = useCallback((timestamp: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  }, []);

  const getTypeColor = useCallback((type: DismissalType): 'info' | 'warning' | 'error' | 'success' => {
    const colors = {
      manual: 'info' as const,
      bulk: 'warning' as const,
      conditional: 'error' as const,
      timed: 'success' as const,
      'auto-priority': 'info' as const,
    };
    return colors[type] || 'info';
  }, []);

  const getTypeLabel = useCallback((type: DismissalType): string => {
    const labels = {
      manual: 'Manual',
      bulk: 'Bulk',
      conditional: 'Conditional',
      timed: 'Scheduled',
      'auto-priority': 'Auto',
    };
    return labels[type] || type;
  }, []);

  if (undoToasts.length === 0 && undoHistory.length === 0) {
    return null;
  }

  return (
    <>
      {/* Undo Toasts */}
      <UndoContainer position={position} className={className}>
        {undoToasts.map(toast => (
          <UndoToastCard
            key={toast.id}
            canUndo={toast.canUndo}
            isExpiring={isToastExpiring(toast)}
          >
            <ToastContent>
              <ToastTitle>{toast.description}</ToastTitle>
              <ToastDescription>
                <Badge variant={getTypeColor(toast.type)} size="small">
                  {getTypeLabel(toast.type)}
                </Badge>
                <span style={{ marginLeft: '8px' }}>
                  {formatTimestamp(toast.timestamp)}
                </span>
              </ToastDescription>
            </ToastContent>
            
            <ToastActions>
              {toast.canUndo && (
                <Tooltip content="Undo this dismissal">
                  <UndoButton
                    variant="primary"
                    size="small"
                    onClick={() => handleUndo(toast.id)}
                  >
                    Undo
                  </UndoButton>
                </Tooltip>
              )}
              
              <Tooltip content="Dismiss notification">
                <CloseButton
                  onClick={() => handleDismissToast(toast.id)}
                  aria-label="Dismiss notification"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path fillRule="evenodd" d="M6 12A6 6 0 106 0a6 6 0 000 12zM4.293 4.293a1 1 0 011.414 0L6 4.586l.293-.293a1 1 0 111.414 1.414L7.414 6l.293.293a1 1 0 01-1.414 1.414L6 7.414l-.293.293a1 1 0 01-1.414-1.414L4.586 6l-.293-.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </CloseButton>
              </Tooltip>
            </ToastActions>
            
            {toast.canUndo && toast.expiresAt && (
              <ExpirationTimer progress={getExpirationProgress(toast)} />
            )}
          </UndoToastCard>
        ))}
      </UndoContainer>

      {/* History Button */}
      {undoHistory.length > maxVisible && (
        <Tooltip content="View undo history">
          <HistoryButton
            variant="secondary"
            size="small"
            onClick={() => setShowHistory(true)}
          >
            History ({undoHistory.length})
          </HistoryButton>
        </Tooltip>
      )}

      {/* History Modal */}
      <Modal isOpen={showHistory} onClose={() => setShowHistory(false)} size="medium">
        <HistoryModal>
          <HistoryTitle>Dismissal History</HistoryTitle>
          
          {undoHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
              No dismissal history available
            </div>
          ) : (
            <HistoryList>
              {undoHistory.map(action => (
                <HistoryItem key={action.id} canUndo={action.canUndo}>
                  <HistoryItemContent>
                    <HistoryItemTitle>{action.description}</HistoryItemTitle>
                    <HistoryItemMeta>
                      <Badge variant={getTypeColor(action.type)} size="small">
                        {getTypeLabel(action.type)}
                      </Badge>
                      <span>{formatTimestamp(action.timestamp)}</span>
                      {!action.canUndo && (
                        <span style={{ color: '#999' }}>Expired</span>
                      )}
                    </HistoryItemMeta>
                  </HistoryItemContent>
                  
                  {action.canUndo && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => {
                        handleUndo(action.id);
                        setShowHistory(false);
                      }}
                    >
                      Undo
                    </Button>
                  )}
                </HistoryItem>
              ))}
            </HistoryList>
          )}
        </HistoryModal>
      </Modal>
    </>
  );
};

export default AlertUndoManager;