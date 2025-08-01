/**
 * Notification Center Widget
 * Display and management of system notifications and alerts
 */

import React, { useState } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Badge } from '../../../../ui/core/Badge';
import { Tooltip } from '../../../../ui/core/Tooltip';
import { Button } from '../../../../ui/core/Button';
import { Theme } from '../../../../../theme/themes';
import { useTheme } from '@emotion/react';
import { NotificationData, StatusWidgetProps } from '../types';

const NotificationContainer = styled.div<{ theme: Theme; hasNotifications: boolean; hasErrors: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  cursor: pointer;
  position: relative;
  
  ${({ hasNotifications, hasErrors, theme }) => {
    if (hasErrors) {
      return css`
        background-color: ${theme.colors.error.main}20;
        border: 1px solid ${theme.colors.error.main}40;
        &:hover { background-color: ${theme.colors.error.main}30; }
      `;
    } else if (hasNotifications) {
      return css`
        background-color: ${theme.colors.info.main}20;
        border: 1px solid ${theme.colors.info.main}40;
        &:hover { background-color: ${theme.colors.info.main}30; }
      `;
    } else {
      return css`
        background-color: ${theme.colors.neutral[100]};
        border: 1px solid ${theme.colors.neutral[300]};
        &:hover { background-color: ${theme.colors.neutral[200]}; }
      `;
    }
  }}
  
  @media (prefers-contrast: high) {
    border-width: 2px;
  }
`;

const NotificationIcon = styled.div<{ theme: Theme; hasNotifications: boolean; hasErrors: boolean; compact?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ compact }) => compact ? '18px' : '24px'};
  height: ${({ compact }) => compact ? '18px' : '24px'};
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.sm : theme.typography.fontSize.lg};
  color: ${({ hasNotifications, hasErrors, theme }) => {
    if (hasErrors) return theme.colors.error.main;
    if (hasNotifications) return theme.colors.info.main;
    return theme.colors.text.secondary;
  }};
  
  ${({ hasErrors }) => hasErrors && css`
    animation: shake 0.5s ease-in-out infinite alternate;
    
    @keyframes shake {
      0% { transform: translateX(-2px); }
      100% { transform: translateX(2px); }
    }
    
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `}
`;

const NotificationCount = styled.div<{ theme: Theme; compact?: boolean }>`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: ${({ compact }) => compact ? '16px' : '20px'};
  height: ${({ compact }) => compact ? '16px' : '20px'};
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.error.main};
  color: ${({ theme }) => theme.colors.text.contrast};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border: 2px solid ${({ theme }) => theme.colors.background.paper};
`;

const NotificationText = styled.span<{ theme: Theme; compact?: boolean }>`
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
`;

const NotificationList = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  max-height: 400px;
  overflow-y: auto;
  width: 320px;
`;

const NotificationItem = styled.div<{ theme: Theme; type: 'info' | 'success' | 'warning' | 'error' }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border-left: 4px solid ${({ type, theme }) => {
    switch (type) {
      case 'success':
        return theme.colors.success.main;
      case 'warning':
        return theme.colors.warning.main;
      case 'error':
        return theme.colors.error.main;
      case 'info':
      default:
        return theme.colors.info.main;
    }
  }};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  
  ${({ type, theme }) => type === 'error' && css`
    box-shadow: 0 0 12px ${theme.colors.error.main}20;
  `}
`;

const NotificationHeader = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const NotificationTitle = styled.h4<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const NotificationMessage = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.normal};
`;

const NotificationMeta = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-top: ${({ theme }) => theme.spacing[1]};
`;

const NotificationActions = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  margin-top: ${({ theme }) => theme.spacing[2]};
`;

const EmptyState = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[6]};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-align: center;
`;

const ClearAllButton = styled(Button)<{ theme: Theme }>`
  margin-top: ${({ theme }) => theme.spacing[2]};
  align-self: flex-end;
`;

const getNotificationIcon = (hasNotifications: boolean, hasErrors: boolean): string => {
  if (hasErrors) return '🚨';
  if (hasNotifications) return '🔔';
  return '🔕';
};

const getTypeIcon = (type: 'info' | 'success' | 'warning' | 'error'): string => {
  switch (type) {
    case 'success':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    case 'info':
    default:
      return 'ℹ️';
  }
};

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
};

const getSourceBadgeVariant = (source?: string) => {
  switch (source) {
    case 'system':
      return 'info';
    case 'mission':
      return 'primary';
    case 'hardware':
      return 'warning';
    case 'user':
      return 'secondary';
    default:
      return 'neutral';
  }
};

interface NotificationCenterProps extends StatusWidgetProps {
  data: NotificationData[];
  onNotificationAction?: (notificationId: string, actionIndex: number) => void;
  onClearNotifications?: () => void;
  onRemoveNotification?: (notificationId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  data: notifications = [], 
  config, 
  compact, 
  onClick,
  onNotificationAction,
  onClearNotifications,
  onRemoveNotification,
  'data-testid': testId 
}) => {
  const theme = useTheme() as Theme;
  const [isOpen, setIsOpen] = useState(false);
  
  const hasNotifications = notifications.length > 0;
  const hasErrors = notifications.some(n => n.type === 'error');
  const errorCount = notifications.filter(n => n.type === 'error').length;
  const sortedNotifications = [...notifications].sort((a, b) => b.timestamp - a.timestamp);

  const handleAction = (notificationId: string, actionIndex: number) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification?.actions?.[actionIndex]) {
      notification.actions[actionIndex].action();
      onNotificationAction?.(notificationId, actionIndex);
    }
  };

  const handleRemove = (notificationId: string) => {
    onRemoveNotification?.(notificationId);
  };

  const handleClearAll = () => {
    onClearNotifications?.();
    setIsOpen(false);
  };

  const tooltipContent = hasNotifications ? (
    <div>
      <div style={{ marginBottom: theme.spacing[2] }}>
        <strong>Recent Notifications</strong>
      </div>
      
      <NotificationList theme={theme}>
        {sortedNotifications.slice(0, 5).map((notification) => (
          <NotificationItem key={notification.id} theme={theme} type={notification.type}>
            <NotificationHeader theme={theme}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1] }}>
                <span>{getTypeIcon(notification.type)}</span>
                <NotificationTitle theme={theme}>
                  {notification.title}
                </NotificationTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(notification.id);
                }}
                style={{ padding: theme.spacing[1] }}
              >
                ×
              </Button>
            </NotificationHeader>
            
            <NotificationMessage theme={theme}>
              {notification.message}
            </NotificationMessage>
            
            <NotificationMeta theme={theme}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[2] }}>
                {notification.source && (
                  <Badge variant={getSourceBadgeVariant(notification.source)} size="sm">
                    {notification.source}
                  </Badge>
                )}
                <span>{formatRelativeTime(notification.timestamp)}</span>
              </div>
            </NotificationMeta>
            
            {notification.actions && notification.actions.length > 0 && (
              <NotificationActions theme={theme}>
                {notification.actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.primary ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(notification.id, index);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </NotificationActions>
            )}
          </NotificationItem>
        ))}
      </NotificationList>
      
      {notifications.length > 5 && (
        <div style={{ 
          textAlign: 'center', 
          padding: theme.spacing[2],
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.secondary
        }}>
          +{notifications.length - 5} more notifications
        </div>
      )}

      <ClearAllButton
        theme={theme}
        variant="tertiary"
        size="sm"
        onClick={handleClearAll}
      >
        Clear All
      </ClearAllButton>
    </div>
  ) : (
    <EmptyState theme={theme}>
      <div style={{ fontSize: '2rem', marginBottom: theme.spacing[2] }}>🔕</div>
      <div>No notifications</div>
    </EmptyState>
  );

  return (
    <Tooltip 
      content={tooltipContent} 
      position="bottom-end" 
      maxWidth={350}
      trigger="manual"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <NotificationContainer 
        theme={theme} 
        hasNotifications={hasNotifications}
        hasErrors={hasErrors}
        onClick={() => {
          setIsOpen(!isOpen);
          onClick?.();
        }}
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={`Notifications: ${notifications.length} total${errorCount > 0 ? `, ${errorCount} errors` : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
            onClick?.();
          }
        }}
      >
        <NotificationIcon 
          theme={theme} 
          hasNotifications={hasNotifications}
          hasErrors={hasErrors}
          compact={compact}
        >
          {getNotificationIcon(hasNotifications, hasErrors)}
        </NotificationIcon>
        
        {hasNotifications && (
          <NotificationCount theme={theme} compact={compact}>
            {notifications.length > 99 ? '99+' : notifications.length}
          </NotificationCount>
        )}
        
        {!compact && (
          <NotificationText theme={theme} compact={compact}>
            {hasNotifications 
              ? `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`
              : 'No notifications'
            }
          </NotificationText>
        )}
      </NotificationContainer>
    </Tooltip>
  );
};

NotificationCenter.displayName = 'NotificationCenter';