/**
 * Alert Container Component
 * Manages the display of queued alerts with priority-based positioning
 */

import React, { useEffect, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useAlertStore } from '../../../../stores/alertStore';
import { PriorityAlert } from './PriorityAlert';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { TransitionGroup, CSSTransition } from 'react-transition-group';

interface AlertContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxVisible?: number;
  groupSimilar?: boolean;
  className?: string;
}

const positionStyles = {
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
  'top-center': css`
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
  `,
  'bottom-center': css`
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
  `,
};

const Container = styled.div<{
  theme: Theme;
  position: AlertContainerProps['position'];
}>`
  position: fixed;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  max-width: 420px;
  width: 100%;
  pointer-events: none;
  z-index: 9999;
  
  ${({ position }) => positionStyles[position || 'top-right']}
  
  /* Allow pointer events only on alerts */
  & > * {
    pointer-events: auto;
  }
  
  @media (max-width: 640px) {
    max-width: calc(100vw - 40px);
    
    ${({ position }) => position?.includes('center') && css`
      transform: translateX(-50%);
    `}
  }
`;

const AlertWrapper = styled.div<{ theme: Theme }>`
  width: 100%;
  
  /* Transition styles */
  &.alert-enter {
    opacity: 0;
    transform: translateY(-20px);
  }
  
  &.alert-enter-active {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 300ms ease-out, transform 300ms ease-out;
  }
  
  &.alert-exit {
    opacity: 1;
    transform: translateY(0);
  }
  
  &.alert-exit-active {
    opacity: 0;
    transform: translateX(100%);
    transition: opacity 200ms ease-in, transform 200ms ease-in;
  }
`;

const GroupIndicator = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-top: ${({ theme }) => theme.spacing[1]};
  padding-left: ${({ theme }) => theme.spacing[10]};
`;

const OverflowIndicator = styled.div<{ theme: Theme; priority: AlertPriority }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme, priority }) => theme.alertPriorities![priority].background};
  border: 1px solid ${({ theme, priority }) => theme.alertPriorities![priority].border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  text-align: center;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme, priority }) => theme.alertPriorities![priority].text};
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${({ theme, priority }) => theme.alertPriorities![priority].hover};
  }
`;

export const AlertContainer: React.FC<AlertContainerProps> = ({
  position = 'top-right',
  maxVisible = 5,
  groupSimilar = true,
  className,
}) => {
  const { alerts, removeAlert, dismissAlert, queueStatus } = useAlertStore();
  const nodeRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());

  // Get or create ref for an alert
  const getNodeRef = (id: string) => {
    if (!nodeRefs.current.has(id)) {
      nodeRefs.current.set(id, React.createRef<HTMLDivElement>());
    }
    return nodeRefs.current.get(id)!;
  };

  // Clean up refs when alerts are removed
  useEffect(() => {
    const alertIds = new Set(alerts.map(a => a.id));
    nodeRefs.current.forEach((_, id) => {
      if (!alertIds.has(id)) {
        nodeRefs.current.delete(id);
      }
    });
  }, [alerts]);

  // Group alerts if enabled
  const displayAlerts = React.useMemo(() => {
    if (!groupSimilar) return alerts;

    const grouped = new Map<string, typeof alerts[0][]>();
    const ungrouped: typeof alerts[0][] = [];

    alerts.forEach(alert => {
      if (alert.groupId) {
        const group = grouped.get(alert.groupId) || [];
        group.push(alert);
        grouped.set(alert.groupId, group);
      } else {
        ungrouped.push(alert);
      }
    });

    // Combine grouped (showing only first of each group) and ungrouped
    const result: typeof alerts[0][] = [];
    grouped.forEach(group => {
      if (group.length > 0) {
        result.push({
          ...group[0],
          groupCount: group.length,
        });
      }
    });

    return [...result, ...ungrouped];
  }, [alerts, groupSimilar]);

  // Limit visible alerts
  const visibleAlerts = displayAlerts.slice(0, maxVisible);
  const overflowCount = displayAlerts.length - maxVisible;
  const hasOverflow = overflowCount > 0;

  // Determine highest priority of overflow alerts
  const overflowPriority = React.useMemo(() => {
    if (!hasOverflow) return 'info' as AlertPriority;
    
    const overflowAlerts = displayAlerts.slice(maxVisible);
    const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
    
    for (const priority of priorities) {
      if (overflowAlerts.some(a => a.priority === priority)) {
        return priority;
      }
    }
    
    return 'info' as AlertPriority;
  }, [displayAlerts, maxVisible, hasOverflow]);

  const handleAlertClose = (id: string) => {
    const alert = alerts.find(a => a.id === id);
    if (alert?.data?.persistent) {
      dismissAlert(id);
    } else {
      removeAlert(id);
    }
  };

  const handleShowMore = () => {
    // This would typically open a modal or expand the view
    console.log('Show more alerts');
  };

  return (
    <Container position={position} className={className}>
      <TransitionGroup component={null}>
        {visibleAlerts.map(alert => {
          const nodeRef = getNodeRef(alert.id);
          return (
            <CSSTransition
              key={alert.id}
              nodeRef={nodeRef}
              timeout={300}
              classNames="alert"
            >
              <AlertWrapper ref={nodeRef}>
                <PriorityAlert
                  priority={alert.priority}
                  title={alert.data?.title}
                  message={alert.data?.message || ''}
                  closable={alert.data?.closable !== false}
                  onClose={() => handleAlertClose(alert.id)}
                  timestamp={alert.timestamp}
                  persistent={alert.data?.persistent}
                  action={
                    alert.data?.action ? (
                      <button onClick={alert.data.action.handler}>
                        {alert.data.action.label}
                      </button>
                    ) : undefined
                  }
                />
                {alert.groupCount && alert.groupCount > 1 && (
                  <GroupIndicator>
                    And {alert.groupCount - 1} similar {alert.groupCount - 1 === 1 ? 'alert' : 'alerts'}
                  </GroupIndicator>
                )}
              </AlertWrapper>
            </CSSTransition>
          );
        })}
      </TransitionGroup>
      
      {hasOverflow && (
        <OverflowIndicator priority={overflowPriority} onClick={handleShowMore}>
          {overflowCount} more {overflowCount === 1 ? 'alert' : 'alerts'}
        </OverflowIndicator>
      )}
    </Container>
  );
};

// Status bar component for showing queue status
const StatusBarContainer = styled.div<{ theme: Theme }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 32px;
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  display: flex;
  align-items: center;
  padding: 0 ${({ theme }) => theme.spacing[4]};
  gap: ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  z-index: 9998;
`;

const StatusItem = styled.div<{ theme: Theme; priority?: AlertPriority }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  
  ${({ theme, priority }) => priority && css`
    color: ${theme.alertPriorities![priority].text};
  `}
`;

const StatusDot = styled.span<{ theme: Theme; priority: AlertPriority }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${({ theme, priority }) => theme.alertPriorities![priority].icon};
`;

export const AlertStatusBar: React.FC = () => {
  const queueStatus = useAlertStore(state => state.queueStatus);
  
  if (queueStatus.total === 0) return null;
  
  return (
    <StatusBarContainer>
      <StatusItem>
        Total: {queueStatus.total}
      </StatusItem>
      
      {(['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[]).map(priority => {
        const count = queueStatus.byPriority[priority];
        if (count === 0) return null;
        
        return (
          <StatusItem key={priority} priority={priority}>
            <StatusDot priority={priority} />
            {priority}: {count}
          </StatusItem>
        );
      })}
      
      {queueStatus.grouped > 0 && (
        <StatusItem>
          Grouped: {queueStatus.grouped}
        </StatusItem>
      )}
    </StatusBarContainer>
  );
};