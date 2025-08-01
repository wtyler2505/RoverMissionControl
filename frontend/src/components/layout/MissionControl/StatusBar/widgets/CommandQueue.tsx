/**
 * Command Queue Widget
 * Real-time display of command queue status and processing metrics
 */

import React from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Badge } from '../../../../ui/core/Badge';
import { Tooltip } from '../../../../ui/core/Tooltip';
import { Theme } from '../../../../../theme/themes';
import { useTheme } from '@emotion/react';
import { CommandQueueData, StatusWidgetProps, StatusLevel } from '../types';

const QueueContainer = styled.div<{ theme: Theme; status: StatusLevel }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  cursor: pointer;
  
  ${({ status, theme }) => {
    switch (status) {
      case 'normal':
        return css`
          background-color: ${theme.colors.success.main}20;
          border: 1px solid ${theme.colors.success.main}40;
          &:hover { background-color: ${theme.colors.success.main}30; }
        `;
      case 'warning':
        return css`
          background-color: ${theme.colors.warning.main}20;
          border: 1px solid ${theme.colors.warning.main}40;
          &:hover { background-color: ${theme.colors.warning.main}30; }
        `;
      case 'error':
        return css`
          background-color: ${theme.colors.error.main}20;
          border: 1px solid ${theme.colors.error.main}40;
          &:hover { background-color: ${theme.colors.error.main}30; }
        `;
      case 'critical':
        return css`
          background-color: ${theme.colors.emergency}20;
          border: 1px solid ${theme.colors.emergency}40;
          &:hover { background-color: ${theme.colors.emergency}30; }
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

const QueueIcon = styled.div<{ theme: Theme; processing: boolean; compact?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ compact }) => compact ? '16px' : '20px'};
  height: ${({ compact }) => compact ? '16px' : '20px'};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background-color: ${({ theme }) => theme.colors.command};
  color: ${({ theme }) => theme.colors.text.contrast};
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  
  ${({ processing }) => processing && css`
    animation: processing 1.5s infinite;
    
    @keyframes processing {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `}
`;

const QueueMetrics = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const QueueCount = styled.div<{ theme: Theme; compact?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const CountValue = styled.span<{ theme: Theme; compact?: boolean }>`
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.sm : theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const CountLabel = styled.span<{ theme: Theme; compact?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
`;

const ProcessingIndicator = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: ${({ theme }) => `${theme.spacing[1]} ${theme.spacing[2]}`};
  background-color: ${({ theme }) => theme.colors.info.main}20;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`;

const ProcessingDot = styled.div<{ theme: Theme }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.colors.info.main};
  animation: pulse 1s infinite;
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }
`;

const DetailGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${({ theme }) => theme.spacing[3]};
`;

const DetailItem = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const DetailLabel = styled.span<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.wide};
`;

const DetailValue = styled.span<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
`;

const getStatusBadgeVariant = (status: StatusLevel) => {
  switch (status) {
    case 'normal':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'critical':
      return 'error';
    default:
      return 'neutral';
  }
};

const getStatusDisplayText = (status: StatusLevel) => {
  switch (status) {
    case 'normal':
      return 'Normal';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
    case 'critical':
      return 'Critical';
    default:
      return 'Unknown';
  }
};

const formatProcessingTime = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }
};

const calculateThroughput = (successCount: number, elapsedTime: number): string => {
  if (elapsedTime === 0) return '0/min';
  const throughputPerSecond = successCount / (elapsedTime / 1000);
  const throughputPerMinute = throughputPerSecond * 60;
  return `${throughputPerMinute.toFixed(1)}/min`;
};

export const CommandQueue: React.FC<StatusWidgetProps> = ({ 
  data: queueData, 
  config, 
  compact, 
  onClick,
  'data-testid': testId 
}) => {
  const theme = useTheme() as Theme;
  const data = queueData as CommandQueueData;
  
  if (!data) {
    return (
      <QueueContainer theme={theme} status="normal" data-testid={testId}>
        <div style={{ color: theme.colors.text.disabled }}>No Queue Data</div>
      </QueueContainer>
    );
  }

  const totalCommands = data.successCount + data.errorCount;
  const successRate = totalCommands > 0 ? (data.successCount / totalCommands) * 100 : 100;
  const elapsedTime = data.lastProcessed ? Date.now() - data.lastProcessed : 0;

  const tooltipContent = (
    <div style={{ width: '320px' }}>
      <div style={{ marginBottom: theme.spacing[3] }}>
        <strong>Command Queue Status</strong>
      </div>
      
      <DetailGrid theme={theme}>
        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Queue Status</DetailLabel>
          <DetailValue theme={theme}>
            <Badge variant={getStatusBadgeVariant(data.status)}>
              {getStatusDisplayText(data.status)}
            </Badge>
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Queue Length</DetailLabel>
          <DetailValue theme={theme}>
            {data.length} command{data.length !== 1 ? 's' : ''}
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Processing</DetailLabel>
          <DetailValue theme={theme}>
            {data.processing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing[1] }}>
                <ProcessingDot theme={theme} />
                <span style={{ color: theme.colors.info.main }}>Active</span>
              </div>
            ) : (
              <span style={{ color: theme.colors.text.secondary }}>Idle</span>
            )}
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Success Rate</DetailLabel>
          <DetailValue theme={theme} style={{ 
            color: successRate >= 95 ? theme.colors.success.main : 
                   successRate >= 85 ? theme.colors.warning.main : theme.colors.error.main 
          }}>
            {successRate.toFixed(1)}%
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Commands Sent</DetailLabel>
          <DetailValue theme={theme}>
            {data.successCount} successful
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Errors</DetailLabel>
          <DetailValue theme={theme} style={{ 
            color: data.errorCount > 0 ? theme.colors.error.main : theme.colors.text.primary 
          }}>
            {data.errorCount} failed
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Avg Processing</DetailLabel>
          <DetailValue theme={theme}>
            {formatProcessingTime(data.avgProcessingTime)}
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Throughput</DetailLabel>
          <DetailValue theme={theme}>
            {calculateThroughput(data.successCount, elapsedTime)}
          </DetailValue>
        </DetailItem>
      </DetailGrid>

      {data.processingCommand && (
        <div style={{ 
          marginTop: theme.spacing[3],
          padding: theme.spacing[2],
          backgroundColor: theme.colors.info.main + '20',
          borderRadius: theme.borderRadius.sm,
          fontSize: theme.typography.fontSize.xs
        }}>
          <DetailLabel theme={theme}>Currently Processing:</DetailLabel>
          <div style={{ 
            marginTop: theme.spacing[1],
            fontFamily: theme.typography.fontFamily.mono,
            color: theme.colors.text.primary
          }}>
            {data.processingCommand}
          </div>
        </div>
      )}

      {data.lastProcessed && (
        <div style={{ 
          marginTop: theme.spacing[3],
          paddingTop: theme.spacing[2],
          borderTop: `1px solid ${theme.colors.divider}`,
          fontSize: theme.typography.fontSize.xs,
          color: theme.colors.text.secondary
        }}>
          Last processed: {new Date(data.lastProcessed).toLocaleTimeString()}
        </div>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="bottom-start" maxWidth={350}>
      <QueueContainer 
        theme={theme} 
        status={data.status}
        onClick={onClick}
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={`Command queue: ${data.length} commands, ${getStatusDisplayText(data.status)} status, ${data.processing ? 'processing' : 'idle'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <QueueIcon theme={theme} processing={data.processing} compact={compact}>
          {data.processing ? '⚡' : '📋'}
        </QueueIcon>
        
        {!compact && (
          <QueueMetrics theme={theme}>
            <QueueCount theme={theme} compact={compact}>
              <CountValue theme={theme} compact={compact}>
                {data.length}
              </CountValue>
              <CountLabel theme={theme} compact={compact}>
                Queue
              </CountLabel>
            </QueueCount>
            
            {data.processing && data.processingCommand && (
              <ProcessingIndicator theme={theme}>
                <ProcessingDot theme={theme} />
                <span style={{ 
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.secondary,
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {data.processingCommand}
                </span>
              </ProcessingIndicator>
            )}
          </QueueMetrics>
        )}
        
        {compact && (
          <CountValue theme={theme} compact={compact}>
            {data.length}
          </CountValue>
        )}
      </QueueContainer>
    </Tooltip>
  );
};

CommandQueue.displayName = 'CommandQueue';