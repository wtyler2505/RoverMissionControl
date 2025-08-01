/**
 * System Health Widget
 * Real-time display of CPU, memory, network, and overall system status
 */

import React from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Badge } from '../../../../ui/core/Badge';
import { Tooltip } from '../../../../ui/core/Tooltip';
import { Theme } from '../../../../../theme/themes';
import { useTheme } from '@emotion/react';
import { SystemHealthData, StatusWidgetProps, HealthStatus, formatBytes } from '../types';

const HealthContainer = styled.div<{ theme: Theme; status: HealthStatus }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  cursor: pointer;
  
  ${({ status, theme }) => {
    switch (status) {
      case 'healthy':
        return css`
          background-color: ${theme.colors.success.main}20;
          border: 1px solid ${theme.colors.success.main}40;
          &:hover { background-color: ${theme.colors.success.main}30; }
        `;
      case 'degraded':
        return css`
          background-color: ${theme.colors.warning.main}20;
          border: 1px solid ${theme.colors.warning.main}40;
          &:hover { background-color: ${theme.colors.warning.main}30; }
        `;
      case 'critical':
        return css`
          background-color: ${theme.colors.error.main}20;
          border: 1px solid ${theme.colors.error.main}40;
          &:hover { background-color: ${theme.colors.error.main}30; }
        `;
      case 'offline':
        return css`
          background-color: ${theme.colors.neutral[600]}20;
          border: 1px solid ${theme.colors.neutral[600]}40;
          &:hover { background-color: ${theme.colors.neutral[600]}30; }
        `;
      default:
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

const HealthIndicator = styled.div<{ theme: Theme; status: HealthStatus; compact?: boolean }>`
  width: ${({ compact }) => compact ? '8px' : '12px'};
  height: ${({ compact }) => compact ? '8px' : '12px'};
  border-radius: 50%;
  background-color: ${({ status, theme }) => {
    switch (status) {
      case 'healthy':
        return theme.colors.success.main;
      case 'degraded':
        return theme.colors.warning.main;
      case 'critical':
        return theme.colors.error.main;
      case 'offline':
        return theme.colors.neutral[600];
      default:
        return theme.colors.neutral[400];
    }
  }};
  box-shadow: 0 0 6px ${({ status, theme }) => {
    switch (status) {
      case 'healthy':
        return theme.colors.success.main;
      case 'degraded':
        return theme.colors.warning.main;
      case 'critical':
        return theme.colors.error.main;
      default:
        return 'transparent';
    }
  }}40;
  
  ${({ status }) => status === 'critical' && css`
    animation: pulse 2s infinite;
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `}
`;

const StatusText = styled.span<{ theme: Theme; compact?: boolean }>`
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
`;

const MetricGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
  width: 100%;
`;

const MetricCard = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const MetricHeader = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
`;

const MetricValue = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const MetricSubtext = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const ProgressBar = styled.div<{ theme: Theme }>`
  width: 100%;
  height: 4px;
  background-color: ${({ theme }) => theme.colors.neutral[200]};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;
`;

const ProgressFill = styled.div<{ theme: Theme; percentage: number; status: HealthStatus }>`
  height: 100%;
  width: ${({ percentage }) => Math.min(percentage, 100)}%;
  background-color: ${({ status, theme }) => {
    switch (status) {
      case 'healthy':
        return theme.colors.success.main;
      case 'degraded':
        return theme.colors.warning.main;
      case 'critical':
        return theme.colors.error.main;
      default:
        return theme.colors.info.main;
    }
  }};
  transition: width 0.3s ease-in-out;
`;

const getHealthBadgeVariant = (status: HealthStatus) => {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'critical':
      return 'error';
    case 'offline':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const getHealthDisplayText = (status: HealthStatus) => {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'critical':
      return 'Critical';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
};

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const formatTemperature = (celsius: number): string => {
  return `${celsius.toFixed(1)}°C`;
};

export const SystemHealth: React.FC<StatusWidgetProps> = ({ 
  data: healthData, 
  config, 
  compact, 
  onClick,
  'data-testid': testId 
}) => {
  const theme = useTheme() as Theme;
  const data = healthData as SystemHealthData;
  
  if (!data) {
    return (
      <HealthContainer theme={theme} status="offline" data-testid={testId}>
        <div style={{ color: theme.colors.text.disabled }}>No Data</div>
      </HealthContainer>
    );
  }

  const tooltipContent = (
    <div style={{ width: '350px' }}>
      <div style={{ marginBottom: theme.spacing[3] }}>
        <strong>System Health Overview</strong>
      </div>
      
      <MetricGrid theme={theme}>
        <MetricCard theme={theme}>
          <MetricHeader theme={theme}>
            <span>CPU</span>
            <Badge variant={getHealthBadgeVariant(data.cpu.status)} size="sm">
              {getHealthDisplayText(data.cpu.status)}
            </Badge>
          </MetricHeader>
          <MetricValue theme={theme}>{data.cpu.usage.toFixed(1)}%</MetricValue>
          <ProgressBar theme={theme}>
            <ProgressFill 
              theme={theme} 
              percentage={data.cpu.usage} 
              status={data.cpu.status} 
            />
          </ProgressBar>
          {data.cpu.temperature && (
            <MetricSubtext theme={theme}>
              Temp: {formatTemperature(data.cpu.temperature)}
            </MetricSubtext>
          )}
        </MetricCard>

        <MetricCard theme={theme}>
          <MetricHeader theme={theme}>
            <span>Memory</span>
            <Badge variant={getHealthBadgeVariant(data.memory.status)} size="sm">
              {getHealthDisplayText(data.memory.status)}
            </Badge>
          </MetricHeader>
          <MetricValue theme={theme}>{data.memory.percentage.toFixed(1)}%</MetricValue>
          <ProgressBar theme={theme}>
            <ProgressFill 
              theme={theme} 
              percentage={data.memory.percentage} 
              status={data.memory.status} 
            />
          </ProgressBar>
          <MetricSubtext theme={theme}>
            {formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}
          </MetricSubtext>
        </MetricCard>

        <MetricCard theme={theme}>
          <MetricHeader theme={theme}>
            <span>Network</span>
            <Badge variant={getHealthBadgeVariant(data.network.status)} size="sm">
              {getHealthDisplayText(data.network.status)}
            </Badge>
          </MetricHeader>
          <MetricValue theme={theme}>{data.network.latency}ms</MetricValue>
          <MetricSubtext theme={theme}>
            {formatBytes(data.network.bandwidth)}/s
          </MetricSubtext>
          {data.network.packetsLost > 0 && (
            <MetricSubtext theme={theme} style={{ color: theme.colors.warning.main }}>
              {data.network.packetsLost} packets lost
            </MetricSubtext>
          )}
        </MetricCard>

        {data.disk && (
          <MetricCard theme={theme}>
            <MetricHeader theme={theme}>
              <span>Storage</span>
              <Badge variant={getHealthBadgeVariant(data.disk.status)} size="sm">
                {getHealthDisplayText(data.disk.status)}
              </Badge>
            </MetricHeader>
            <MetricValue theme={theme}>{data.disk.percentage.toFixed(1)}%</MetricValue>
            <ProgressBar theme={theme}>
              <ProgressFill 
                theme={theme} 
                percentage={data.disk.percentage} 
                status={data.disk.status} 
              />
            </ProgressBar>
            <MetricSubtext theme={theme}>
              {formatBytes(data.disk.used)} / {formatBytes(data.disk.total)}
            </MetricSubtext>
          </MetricCard>
        )}
      </MetricGrid>

      <div style={{ 
        marginTop: theme.spacing[3], 
        paddingTop: theme.spacing[3], 
        borderTop: `1px solid ${theme.colors.divider}`,
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: theme.typography.fontSize.xs,
        color: theme.colors.text.secondary
      }}>
        <span>Uptime: {formatUptime(data.uptime)}</span>
        <span>Updated: {new Date(data.lastUpdated).toLocaleTimeString()}</span>
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="bottom-start" maxWidth={380}>
      <HealthContainer 
        theme={theme} 
        status={data.overall}
        onClick={onClick}
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={`System health: ${getHealthDisplayText(data.overall)}, CPU: ${data.cpu.usage.toFixed(1)}%, Memory: ${data.memory.percentage.toFixed(1)}%`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <HealthIndicator theme={theme} status={data.overall} compact={compact} />
        {!compact && (
          <>
            <StatusText theme={theme} compact={compact}>
              {getHealthDisplayText(data.overall)}
            </StatusText>
            <StatusText theme={theme} compact={compact} style={{ 
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary
            }}>
              CPU: {data.cpu.usage.toFixed(0)}%
            </StatusText>
            <StatusText theme={theme} compact={compact} style={{ 
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary
            }}>
              MEM: {data.memory.percentage.toFixed(0)}%
            </StatusText>
          </>
        )}
      </HealthContainer>
    </Tooltip>
  );
};

SystemHealth.displayName = 'SystemHealth';