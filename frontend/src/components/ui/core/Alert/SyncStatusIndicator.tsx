/**
 * Sync Status Indicator
 * Component for displaying alert synchronization status and health
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { transitionStyles, focusStyles } from '../utils';
import { BaseComponentProps } from '../types';
import { SyncStatus } from '../../../../services/synchronization/AlertSyncService';

export interface SyncStatusIndicatorProps extends BaseComponentProps {
  syncStatus: SyncStatus;
  onRetrySync?: () => void;
  onShowDetails?: () => void;
  showDetails?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  size?: 'small' | 'medium' | 'large';
}

// Animation keyframes
const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div<{ 
  theme: Theme;
  position: SyncStatusIndicatorProps['position'];
  size: SyncStatusIndicatorProps['size'];
}>`
  ${({ position }) => {
    if (position === 'inline') {
      return css`
        display: inline-flex;
        align-items: center;
        gap: 8px;
      `;
    }
    
    const positions = {
      'top-right': css`
        position: fixed;
        top: 20px;
        right: 20px;
      `,
      'top-left': css`
        position: fixed;
        top: 20px;
        left: 20px;
      `,
      'bottom-right': css`
        position: fixed;
        bottom: 20px;
        right: 20px;
      `,
      'bottom-left': css`
        position: fixed;
        bottom: 20px;
        left: 20px;
      `,
    };
    
    return css`
      ${positions[position!]}
      z-index: 1000;
    `;
  }}
  
  ${({ size }) => {
    const sizes = {
      small: css`
        font-size: 12px;
        gap: 6px;
      `,
      medium: css`
        font-size: 14px;
        gap: 8px;
      `,
      large: css`
        font-size: 16px;
        gap: 10px;
      `,
    };
    
    return sizes[size!];
  }}
`;

const StatusBadge = styled.button<{ 
  theme: Theme;
  status: 'synced' | 'syncing' | 'error' | 'offline';
  interactive: boolean;
  size: SyncStatusIndicatorProps['size'];
}>`
  display: flex;
  align-items: center;
  gap: ${({ theme, size }) => size === 'small' ? theme.spacing[1] : theme.spacing[2]};
  padding: ${({ theme, size }) => {
    switch (size) {
      case 'small': return `${theme.spacing[1]} ${theme.spacing[2]}`;
      case 'large': return `${theme.spacing[3]} ${theme.spacing[4]}`;
      default: return `${theme.spacing[2]} ${theme.spacing[3]}`;
    }
  }};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  border: 1px solid;
  font-size: inherit;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: ${({ interactive }) => interactive ? 'pointer' : 'default'};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'border-color', 'color', 'box-shadow'])}
  ${({ theme, interactive }) => interactive && focusStyles(theme)}
  
  ${({ theme, status }) => {
    const statusStyles = {
      synced: css`
        background: ${theme.colors.success}22;
        border-color: ${theme.colors.success};
        color: ${theme.colors.success};
        
        &:hover {
          background: ${theme.colors.success}33;
        }
      `,
      syncing: css`
        background: ${theme.colors.primary}22;
        border-color: ${theme.colors.primary};
        color: ${theme.colors.primary};
        
        &:hover {
          background: ${theme.colors.primary}33;
        }
      `,
      error: css`
        background: ${theme.colors.error}22;
        border-color: ${theme.colors.error};
        color: ${theme.colors.error};
        
        &:hover {
          background: ${theme.colors.error}33;
        }
        
        animation: ${pulse} 2s infinite;
      `,
      offline: css`
        background: ${theme.colors.gray[200]};
        border-color: ${theme.colors.gray[400]};
        color: ${theme.colors.gray[600]};
        
        &:hover {
          background: ${theme.colors.gray[300]};
        }
        
        opacity: 0.7;
      `,
    };
    
    return statusStyles[status];
  }}
`;

const StatusIcon = styled.div<{ 
  theme: Theme;
  status: 'synced' | 'syncing' | 'error' | 'offline';
  size: SyncStatusIndicatorProps['size'];
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ size }) => {
    switch (size) {
      case 'small': return '14px';
      case 'large': return '20px';
      default: return '16px';
    }
  }};
  height: ${({ size }) => {
    switch (size) {
      case 'small': return '14px';
      case 'large': return '20px';
      default: return '16px';
    }
  }};
  
  ${({ status }) => status === 'syncing' && css`
    animation: ${spin} 1s linear infinite;
  `}
`;

const StatusText = styled.span<{ theme: Theme }>`
  font-size: inherit;
  white-space: nowrap;
`;

const DetailsPanel = styled.div<{ 
  theme: Theme;
  isVisible: boolean;
  position: SyncStatusIndicatorProps['position'];
}>`
  position: ${({ position }) => position === 'inline' ? 'relative' : 'absolute'};
  ${({ position }) => {
    if (position === 'inline') return '';
    
    const positionStyles = {
      'top-right': 'top: 100%; right: 0;',
      'top-left': 'top: 100%; left: 0;',
      'bottom-right': 'bottom: 100%; right: 0;',
      'bottom-left': 'bottom: 100%; left: 0;',
    };
    
    return positionStyles[position!];
  }}
  
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.boxShadow.xl};
  padding: ${({ theme }) => theme.spacing[4]};
  min-width: 280px;
  margin-top: ${({ theme }) => theme.spacing[2]};
  z-index: 1001;
  
  /* Glass effect */
  backdrop-filter: blur(16px);
  background: ${({ theme }) => `${theme.colors.surface}f0`};
  
  opacity: ${({ isVisible }) => isVisible ? 1 : 0};
  visibility: ${({ isVisible }) => isVisible ? 'visible' : 'hidden'};
  transform: ${({ isVisible }) => isVisible ? 'translateY(0)' : 'translateY(-10px)'};
  
  ${({ theme }) => transitionStyles(theme, ['opacity', 'visibility', 'transform'])}
  
  ${({ isVisible }) => isVisible && css`
    animation: ${slideIn} 0.2s ease-out;
  `}
`;

const DetailRow = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[2]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const DetailLabel = styled.span<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const DetailValue = styled.span<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
`;

const ActionButton = styled.button<{ theme: Theme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  margin-top: ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.surface};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  
  ${({ theme }) => transitionStyles(theme, ['background-color'])}
  ${({ theme }) => focusStyles(theme)}
  
  &:hover {
    background: ${({ theme }) => theme.colors.primaryHover};
  }
  
  &:disabled {
    background: ${({ theme }) => theme.colors.gray[300]};
    color: ${({ theme }) => theme.colors.gray[500]};
    cursor: not-allowed;
  }
`;

const getStatusInfo = (status: SyncStatus) => {
  if (!status.isLeader && status.connectedTabs === 0) {
    return {
      status: 'offline' as const,
      text: 'Offline',
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zM7 6a1 1 0 112 0v2a1 1 0 11-2 0V6zM8 11a1 1 0 100-2 1 1 0 000 2z"/>
        </svg>
      ),
    };
  }
  
  if (status.syncInProgress) {
    return {
      status: 'syncing' as const,
      text: 'Syncing',
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3a5 5 0 014.546 2.914.5.5 0 01-.908.412A4 4 0 104 8a.5.5 0 01-1 0 5 5 0 015-6z"/>
        </svg>
      ),
    };
  }
  
  if (status.conflictCount > 0) {
    return {
      status: 'error' as const,
      text: `${status.conflictCount} conflicts`,
      icon: (
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path fillRule="evenodd" d="M8.982 1.566a1.13 1.13 0 00-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 01-1.1 0L7.1 5.995A.905.905 0 018 5zm.002 6a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"/>
        </svg>
      ),
    };
  }
  
  return {
    status: 'synced' as const,
    text: status.isLeader ? 'Leader' : 'Synced',
    icon: (
      <svg viewBox="0 0 16 16" fill="currentColor">
        <path fillRule="evenodd" d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" clipRule="evenodd"/>
      </svg>
    ),
  };
};

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  syncStatus,
  onRetrySync,
  onShowDetails,
  showDetails = false,
  position = 'top-right',
  size = 'medium',
  testId,
  className
}) => {
  const [detailsVisible, setDetailsVisible] = useState(showDetails);
  const statusInfo = getStatusInfo(syncStatus);

  const handleBadgeClick = useCallback(() => {
    if (onShowDetails) {
      onShowDetails();
    } else {
      setDetailsVisible(!detailsVisible);
    }
  }, [onShowDetails, detailsVisible]);

  const handleRetrySync = useCallback(() => {
    onRetrySync?.();
    setDetailsVisible(false);
  }, [onRetrySync]);

  // Format timestamp
  const formatLastSync = useCallback((date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);
  }, []);

  // Handle click outside to close details
  useEffect(() => {
    if (!detailsVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-sync-status-indicator]')) {
        setDetailsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [detailsVisible]);

  return (
    <Container
      position={position}
      size={size}
      className={className}
      data-testid={testId}
      data-sync-status-indicator
    >
      <StatusBadge
        status={statusInfo.status}
        interactive={!!(onShowDetails || !showDetails)}
        size={size}
        onClick={handleBadgeClick}
        aria-label={`Sync status: ${statusInfo.text}`}
        aria-expanded={detailsVisible}
        aria-haspopup="true"
      >
        <StatusIcon
          status={statusInfo.status}
          size={size}
          aria-hidden="true"
        >
          {statusInfo.icon}
        </StatusIcon>
        <StatusText>{statusInfo.text}</StatusText>
      </StatusBadge>

      <DetailsPanel
        isVisible={detailsVisible}
        position={position}
        role="tooltip"
        aria-label="Sync status details"
      >
        <DetailRow>
          <DetailLabel>Status</DetailLabel>
          <DetailValue>{statusInfo.text}</DetailValue>
        </DetailRow>
        
        <DetailRow>
          <DetailLabel>Role</DetailLabel>
          <DetailValue>{syncStatus.isLeader ? 'Leader Tab' : 'Follower Tab'}</DetailValue>
        </DetailRow>
        
        <DetailRow>
          <DetailLabel>Connected Tabs</DetailLabel>
          <DetailValue>{syncStatus.connectedTabs}</DetailValue>
        </DetailRow>
        
        <DetailRow>
          <DetailLabel>Last Sync</DetailLabel>
          <DetailValue>{formatLastSync(syncStatus.lastSync)}</DetailValue>
        </DetailRow>
        
        {syncStatus.conflictCount > 0 && (
          <DetailRow>
            <DetailLabel>Conflicts</DetailLabel>
            <DetailValue style={{ color: 'var(--color-error)' }}>
              {syncStatus.conflictCount}
            </DetailValue>
          </DetailRow>
        )}
        
        {onRetrySync && (statusInfo.status === 'error' || statusInfo.status === 'offline') && (
          <ActionButton
            onClick={handleRetrySync}
            disabled={syncStatus.syncInProgress}
          >
            {syncStatus.syncInProgress ? 'Retrying...' : 'Retry Sync'}
          </ActionButton>
        )}
      </DetailsPanel>
    </Container>
  );
};