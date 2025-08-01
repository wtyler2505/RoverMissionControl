/**
 * Connection Status Widget
 * Real-time display of WebSocket connection health and signal strength
 */

import React from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Badge } from '../../../../ui/core/Badge';
import { Tooltip } from '../../../../ui/core/Tooltip';
import { Theme } from '../../../../../theme/themes';
import { useTheme } from '@emotion/react';
import { ConnectionStatusData, StatusWidgetProps, SignalStrength, formatLatency } from '../types';
import { ConnectionState } from '../../../../../services/websocket/types';

const ConnectionContainer = styled.div<{ theme: Theme; connected: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  cursor: pointer;
  
  ${({ connected, theme }) => connected ? css`
    background-color: ${theme.colors.success.main}20;
    border: 1px solid ${theme.colors.success.main}40;
    
    &:hover {
      background-color: ${theme.colors.success.main}30;
    }
  ` : css`
    background-color: ${theme.colors.error.main}20;
    border: 1px solid ${theme.colors.error.main}40;
    
    &:hover {
      background-color: ${theme.colors.error.main}30;
    }
  `}
  
  @media (prefers-contrast: high) {
    border-width: 2px;
  }
`;

const SignalIcon = styled.div<{ 
  theme: Theme; 
  strength: SignalStrength; 
  connected: boolean;
  compact?: boolean;
}>`
  display: flex;
  align-items: flex-end;
  gap: 1px;
  width: ${({ compact }) => compact ? '16px' : '20px'};
  height: ${({ compact }) => compact ? '12px' : '16px'};
`;

const SignalBar = styled.div<{ 
  theme: Theme; 
  height: number; 
  active: boolean; 
  connected: boolean;
}>`
  width: 3px;
  background-color: ${({ active, connected, theme }) => {
    if (!connected) return theme.colors.error.main;
    if (active) return theme.colors.success.main;
    return theme.colors.neutral[400];
  }};
  border-radius: 1px;
  transition: ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  
  @media (prefers-contrast: high) {
    width: 4px;
  }
`;

const StatusText = styled.span<{ theme: Theme; compact?: boolean }>`
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
`;

const StatusInfo = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const MetricRow = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const getConnectionBadgeVariant = (state: ConnectionState) => {
  switch (state) {
    case ConnectionState.CONNECTED:
    case ConnectionState.AUTHENTICATED:
      return 'success';
    case ConnectionState.CONNECTING:
    case ConnectionState.RECONNECTING:
      return 'warning';
    case ConnectionState.ERROR:
    case ConnectionState.DISCONNECTED:
      return 'error';
    default:
      return 'neutral';
  }
};

const getConnectionDisplayText = (state: ConnectionState) => {
  switch (state) {
    case ConnectionState.CONNECTED:
      return 'Connected';
    case ConnectionState.AUTHENTICATED:
      return 'Authenticated';
    case ConnectionState.CONNECTING:
      return 'Connecting...';
    case ConnectionState.RECONNECTING:
      return 'Reconnecting...';
    case ConnectionState.DISCONNECTED:
      return 'Disconnected';
    case ConnectionState.ERROR:
      return 'Error';
    case ConnectionState.IDLE:
      return 'Idle';
    case ConnectionState.ACTIVE:
      return 'Active';
    default:
      return 'Unknown';
  }
};

const getSignalBars = (strength: SignalStrength): boolean[] => {
  switch (strength) {
    case 'excellent':
      return [true, true, true, true, true];
    case 'good':
      return [true, true, true, true, false];
    case 'fair':
      return [true, true, true, false, false];
    case 'poor':
      return [true, true, false, false, false];
    case 'none':
      return [false, false, false, false, false];
    default:
      return [false, false, false, false, false];
  }
};

const renderSignalIcon = (strength: SignalStrength, connected: boolean, compact?: boolean, theme?: Theme) => {
  const bars = getSignalBars(strength);
  const heights = compact ? [4, 6, 8, 10, 12] : [6, 8, 10, 12, 16];
  
  return (
    <SignalIcon strength={strength} connected={connected} compact={compact} theme={theme!}>
      {bars.map((active, index) => (
        <SignalBar
          key={index}
          theme={theme!}
          height={heights[index]}
          active={active}
          connected={connected}
          style={{ height: heights[index] }}
        />
      ))}
    </SignalIcon>
  );
};

export const ConnectionStatus: React.FC<StatusWidgetProps> = ({ 
  data: connectionData, 
  config, 
  compact, 
  onClick,
  'data-testid': testId 
}) => {
  const theme = useTheme() as Theme;
  const data = connectionData as ConnectionStatusData;
  
  if (!data) {
    return (
      <ConnectionContainer theme={theme} connected={false} data-testid={testId}>
        <div style={{ color: theme.colors.text.disabled }}>No Data</div>
      </ConnectionContainer>
    );
  }

  const tooltipContent = (
    <StatusInfo theme={theme}>
      <div>
        <strong>Connection Status</strong>
      </div>
      <MetricRow theme={theme}>
        <span>State:</span>
        <Badge variant={getConnectionBadgeVariant(data.state)}>
          {getConnectionDisplayText(data.state)}
        </Badge>
      </MetricRow>
      <MetricRow theme={theme}>
        <span>Latency:</span>
        <span>{formatLatency(data.latency)}</span>
      </MetricRow>
      <MetricRow theme={theme}>
        <span>Signal:</span>
        <span style={{ textTransform: 'capitalize' }}>{data.signalStrength}</span>
      </MetricRow>
      {data.reconnectAttempts > 0 && (
        <MetricRow theme={theme}>
          <span>Reconnects:</span>
          <span>{data.reconnectAttempts}</span>
        </MetricRow>
      )}
      {data.error && (
        <MetricRow theme={theme}>
          <span>Error:</span>
          <span style={{ color: theme.colors.error.main, maxWidth: '200px', wordBreak: 'break-word' }}>
            {data.error}
          </span>
        </MetricRow>
      )}
      <MetricRow theme={theme}>
        <span>Messages:</span>
        <span>↑{data.metrics.messagesSent} ↓{data.metrics.messagesReceived}</span>
      </MetricRow>
      <MetricRow theme={theme}>
        <span>Uptime:</span>
        <span>{Math.floor(data.metrics.uptime / 60)}m</span>
      </MetricRow>
      {data.lastConnected && (
        <MetricRow theme={theme}>
          <span>Last Connected:</span>
          <span>{new Date(data.lastConnected).toLocaleTimeString()}</span>
        </MetricRow>
      )}
    </StatusInfo>
  );

  return (
    <Tooltip content={tooltipContent} position="bottom-start" maxWidth={300}>
      <ConnectionContainer 
        theme={theme} 
        connected={data.isConnected}
        onClick={onClick}
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={`Connection status: ${getConnectionDisplayText(data.state)}, Signal: ${data.signalStrength}, Latency: ${formatLatency(data.latency)}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        {renderSignalIcon(data.signalStrength, data.isConnected, compact, theme)}
        {!compact && (
          <StatusText theme={theme} compact={compact}>
            {getConnectionDisplayText(data.state)}
          </StatusText>
        )}
        {!compact && data.latency > 0 && (
          <StatusText theme={theme} compact={compact} style={{ 
            fontSize: theme.typography.fontSize.xs,
            color: data.latency > 1000 ? theme.colors.warning.main : theme.colors.text.secondary
          }}>
            {formatLatency(data.latency)}
          </StatusText>
        )}
      </ConnectionContainer>
    </Tooltip>
  );
};

ConnectionStatus.displayName = 'ConnectionStatus';