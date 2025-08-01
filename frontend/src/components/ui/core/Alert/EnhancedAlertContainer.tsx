/**
 * Enhanced Alert Container Component
 * Integrates comprehensive grouping and dismissal system with priority-specific behaviors
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useAlertStore } from '../../../../stores/alertStore';
import { PriorityAlert } from './PriorityAlert';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { Button } from '../Button/Button';
import { Badge } from '../Badge/Badge';
import { Tooltip } from '../Tooltip/Tooltip';
import { 
  EnhancedAlertGroupingManager,
  AlertGroupCriteria,
  DismissalType 
} from '../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import AlertDismissalControls from './components/AlertDismissalControls';
import BulkDismissalManager from './components/BulkDismissalManager';
import AlertUndoManager from './components/AlertUndoManager';

interface EnhancedAlertContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxVisible?: number;
  groupingCriteria?: AlertGroupCriteria;
  enableBulkActions?: boolean;
  enableUndo?: boolean;
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
  position: EnhancedAlertContainerProps['position'];
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
  position: relative;
  
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

const GroupedAlertCard = styled.div<{ theme: Theme; priority: AlertPriority }>`
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme, priority }) => theme.alertPriorities![priority].border};
  border-left: 4px solid ${({ theme, priority }) => theme.alertPriorities![priority].icon};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: ${({ theme }) => theme.shadows.md};
  overflow: hidden;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: ${({ theme }) => theme.shadows.lg};
    transform: translateY(-1px);
  }
`;

const GroupHeader = styled.div<{ theme: Theme; priority: AlertPriority }>`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme, priority }) => theme.alertPriorities![priority].background};
  border-bottom: 1px solid ${({ theme, priority }) => theme.alertPriorities![priority].border};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const GroupTitle = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const GroupMeta = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const GroupContent = styled.div<{ theme: Theme; expanded: boolean }>`
  ${({ expanded }) => !expanded && css`
    display: none;
  `}
`;

const GroupSummary = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

const GroupedAlert = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  
  &:last-child {
    border-bottom: none;
  }
`;

const GroupActions = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[3]} ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ExpandButton = styled(Button)<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  min-height: auto;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
`;

const BulkActions = styled.div<{ theme: Theme; visible: boolean }>`
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  display: ${({ visible }) => visible ? 'flex' : 'none'};
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  z-index: 10000;
`;

const BulkActionButton = styled(Button)<{ theme: Theme }>`
  border-radius: 50%;
  width: 48px;
  height: 48px;
  padding: 0;
  box-shadow: ${({ theme }) => theme.shadows.lg};
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

export const EnhancedAlertContainer: React.FC<EnhancedAlertContainerProps> = ({
  position = 'top-right',
  maxVisible = 5,
  groupingCriteria = {},
  enableBulkActions = true,
  enableUndo = true,
  className,
}) => {
  const { alerts, removeAlert, dismissAlert, queueStatus } = useAlertStore();
  const nodeRefs = useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
  
  // Enhanced grouping manager
  const [groupingManager] = useState(() => new EnhancedAlertGroupingManager({
    groupingCriteria,
    maxGroups: 10,
    undoHistorySize: 50,
  }));
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());

  // Analyze and group alerts
  const alertGroups = useMemo(() => {
    return groupingManager.analyzeAndGroup(alerts);
  }, [alerts, groupingManager]);

  const visibleGroups = useMemo(() => {
    return groupingManager.getVisibleGroups().slice(0, maxVisible);
  }, [groupingManager, maxVisible]);

  const overflowCount = alertGroups.size - maxVisible;
  const hasOverflow = overflowCount > 0;

  // Get or create ref for an alert/group
  const getNodeRef = useCallback((id: string) => {
    if (!nodeRefs.current.has(id)) {
      nodeRefs.current.set(id, React.createRef<HTMLDivElement>());
    }
    return nodeRefs.current.get(id)!;
  }, []);

  // Clean up refs when alerts are removed
  useEffect(() => {
    const currentIds = new Set([...alertGroups.keys(), ...alerts.map(a => a.id)]);
    nodeRefs.current.forEach((_, id) => {
      if (!currentIds.has(id)) {
        nodeRefs.current.delete(id);
      }
    });
  }, [alertGroups, alerts]);

  // Handle individual alert dismissal
  const handleAlertDismiss = useCallback(async (
    alertId: string, 
    type: DismissalType = 'manual',
    options?: any
  ): Promise<boolean> => {
    try {
      const success = await groupingManager.dismissAlert(alertId, type, options);
      if (success) {
        // Also update the store
        dismissAlert(alertId);
      }
      return success;
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
      return false;
    }
  }, [groupingManager, dismissAlert]);

  // Handle bulk dismissal
  const handleBulkDismiss = useCallback(async (
    items: { alertIds?: string[]; groupIds?: string[] },
    type: DismissalType,
    options?: any
  ) => {
    return await groupingManager.bulkDismiss(items, type, options);
  }, [groupingManager]);

  // Handle group expansion
  const handleGroupToggle = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  // Handle bulk selection
  const handleBulkSelect = useCallback((id: string) => {
    setSelectedForBulk(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Determine highest priority of overflow alerts
  const overflowPriority = useMemo(() => {
    if (!hasOverflow) return 'info' as AlertPriority;
    
    const allGroups = Array.from(alertGroups.values());
    const overflowGroups = allGroups.slice(maxVisible);
    const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
    
    for (const priority of priorities) {
      if (overflowGroups.some(g => g.commonPriority === priority || 
          g.alerts.some(a => a.priority === priority))) {
        return priority;
      }
    }
    
    return 'info' as AlertPriority;
  }, [alertGroups, maxVisible, hasOverflow]);

  const renderGroupedAlert = useCallback((group: any) => {
    const isExpanded = expandedGroups.has(group.id);
    const primaryAlert = group.primaryAlert;
    const groupCount = group.alerts.length;
    
    return (
      <GroupedAlertCard priority={primaryAlert.priority}>
        <GroupHeader priority={primaryAlert.priority}>
          <GroupTitle>
            <span>{primaryAlert.data?.title || primaryAlert.data?.message}</span>
            <Badge variant="neutral" size="small">
              {groupCount} alerts
            </Badge>
          </GroupTitle>
          <GroupMeta>
            <Badge 
              variant={primaryAlert.priority === 'critical' ? 'error' : 
                     primaryAlert.priority === 'high' ? 'warning' : 'info'}
              size="small"
            >
              {primaryAlert.priority}
            </Badge>
            <ExpandButton
              variant="ghost"
              size="small"
              onClick={() => handleGroupToggle(group.id)}
            >
              {isExpanded ? '▼' : '▶'} {isExpanded ? 'Collapse' : 'Expand'}
            </ExpandButton>
          </GroupMeta>
        </GroupHeader>

        {!isExpanded && (
          <GroupSummary>
            {group.groupingCriteria.join(', ')} • 
            Latest: {group.lastUpdated.toLocaleTimeString()}
          </GroupSummary>
        )}

        <GroupContent expanded={isExpanded}>
          {group.alerts.map((alert: any) => (
            <GroupedAlert key={alert.id}>
              <PriorityAlert
                priority={alert.priority}
                title={alert.data?.title}
                message={alert.data?.message || ''}
                closable={alert.data?.closable !== false}
                onClose={() => handleAlertDismiss(alert.id)}
                timestamp={alert.timestamp}
                persistent={alert.data?.persistent}
                compact
                action={
                  alert.data?.action ? (
                    <button onClick={alert.data.action.handler}>
                      {alert.data.action.label}
                    </button>
                  ) : undefined
                }
              />
            </GroupedAlert>
          ))}
        </GroupContent>

        <GroupActions>
          <AlertDismissalControls
            alertId={group.primaryAlert.id}
            groupingManager={groupingManager}
            onDismiss={handleAlertDismiss}
            compact
          />
          
          {enableBulkActions && (
            <Button
              variant="ghost"
              size="small"
              onClick={() => handleBulkSelect(group.id)}
            >
              {selectedForBulk.has(group.id) ? 'Deselect' : 'Select'}
            </Button>
          )}
        </GroupActions>
      </GroupedAlertCard>
    );
  }, [
    expandedGroups,
    handleGroupToggle,
    handleAlertDismiss,
    groupingManager,
    enableBulkActions,
    selectedForBulk,
    handleBulkSelect
  ]);

  const renderSingleAlert = useCallback((alert: any) => {
    return (
      <div style={{ position: 'relative' }}>
        <PriorityAlert
          priority={alert.priority}
          title={alert.data?.title}
          message={alert.data?.message || ''}
          closable={alert.data?.closable !== false}
          onClose={() => handleAlertDismiss(alert.id)}
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
        <AlertDismissalControls
          alertId={alert.id}
          groupingManager={groupingManager}
          onDismiss={handleAlertDismiss}
        />
      </div>
    );
  }, [handleAlertDismiss, groupingManager]);

  return (
    <>
      <Container position={position} className={className}>
        <TransitionGroup component={null}>
          {/* Render visible groups */}
          {visibleGroups.map(group => {
            const nodeRef = getNodeRef(group.id);
            return (
              <CSSTransition
                key={group.id}
                nodeRef={nodeRef}
                timeout={300}
                classNames="alert"
              >
                <AlertWrapper ref={nodeRef}>
                  {group.alerts.length > 1 ? 
                    renderGroupedAlert(group) : 
                    renderSingleAlert(group.alerts[0])
                  }
                </AlertWrapper>
              </CSSTransition>
            );
          })}

          {/* Render ungrouped alerts */}
          {alerts
            .filter(alert => !Array.from(alertGroups.values())
              .some(group => group.alerts.some(a => a.id === alert.id)))
            .slice(0, maxVisible - visibleGroups.length)
            .map(alert => {
              const nodeRef = getNodeRef(alert.id);
              return (
                <CSSTransition
                  key={alert.id}
                  nodeRef={nodeRef}
                  timeout={300}
                  classNames="alert"
                >
                  <AlertWrapper ref={nodeRef}>
                    {renderSingleAlert(alert)}
                  </AlertWrapper>
                </CSSTransition>
              );
            })}
        </TransitionGroup>
        
        {/* Overflow indicator */}
        {hasOverflow && (
          <OverflowIndicator 
            priority={overflowPriority} 
            onClick={() => setShowBulkManager(true)}
          >
            +{overflowCount} more {overflowCount === 1 ? 'alert' : 'alerts'}
          </OverflowIndicator>
        )}
      </Container>

      {/* Bulk Actions */}
      {enableBulkActions && selectedForBulk.size > 0 && (
        <BulkActions visible={selectedForBulk.size > 0}>
          <Tooltip content="Manage selected items">
            <BulkActionButton
              variant="primary"
              onClick={() => setShowBulkManager(true)}
            >
              {selectedForBulk.size}
            </BulkActionButton>
          </Tooltip>
        </BulkActions>
      )}

      {/* Bulk Dismissal Manager */}
      {showBulkManager && (
        <BulkDismissalManager
          groupingManager={groupingManager}
          availableAlerts={alerts}
          availableGroups={Array.from(alertGroups.values())}
          onBulkDismiss={handleBulkDismiss}
          onClose={() => setShowBulkManager(false)}
        />
      )}

      {/* Undo Manager */}
      {enableUndo && (
        <AlertUndoManager
          groupingManager={groupingManager}
          position={position.includes('bottom') ? 'bottom-left' : 'top-left'}
          onUndo={(actionId) => {
            console.log('Undo action:', actionId);
            // Additional undo handling if needed
          }}
        />
      )}
    </>
  );
};

export default EnhancedAlertContainer;