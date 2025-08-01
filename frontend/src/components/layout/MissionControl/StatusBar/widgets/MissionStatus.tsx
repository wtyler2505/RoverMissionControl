/**
 * Mission Status Widget
 * Real-time display of mission progress, timer, and status
 */

import React from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Badge } from '../../../../ui/core/Badge';
import { Tooltip } from '../../../../ui/core/Tooltip';
import { Theme } from '../../../../../theme/themes';
import { useTheme } from '@emotion/react';
import { MissionData, StatusWidgetProps, MissionStatus, formatDuration } from '../types';

const MissionContainer = styled.div<{ theme: Theme; status: MissionStatus }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => `${theme.spacing[2]} ${theme.spacing[3]}`};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  cursor: pointer;
  min-width: 120px;
  
  ${({ status, theme }) => {
    switch (status) {
      case 'active':
        return css`
          background-color: ${theme.colors.success.main}20;
          border: 1px solid ${theme.colors.success.main}40;
          &:hover { background-color: ${theme.colors.success.main}30; }
        `;
      case 'paused':
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
      case 'complete':
        return css`
          background-color: ${theme.colors.info.main}20;
          border: 1px solid ${theme.colors.info.main}40;
          &:hover { background-color: ${theme.colors.info.main}30; }
        `;
      case 'standby':
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

const MissionIcon = styled.div<{ theme: Theme; status: MissionStatus; emergency?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background-color: ${({ status, theme, emergency }) => {
    if (emergency) return theme.colors.emergency;
    switch (status) {
      case 'active':
        return theme.colors.success.main;
      case 'paused':
        return theme.colors.warning.main;
      case 'error':
        return theme.colors.error.main;
      case 'complete':
        return theme.colors.info.main;
      case 'standby':
        return theme.colors.neutral[600];
      default:
        return theme.colors.neutral[400];
    }
  }};
  color: ${({ theme }) => theme.colors.text.contrast};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  
  ${({ emergency }) => emergency && css`
    animation: emergencyPulse 1s infinite;
    
    @keyframes emergencyPulse {
      0%, 100% { 
        box-shadow: 0 0 0 0 rgba(255, 23, 68, 0.7);
        transform: scale(1);
      }
      50% { 
        box-shadow: 0 0 0 8px rgba(255, 23, 68, 0);
        transform: scale(1.05);
      }
    }
    
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }
  `}
`;

const MissionInfo = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
  flex: 1;
`;

const MissionName = styled.span<{ theme: Theme; compact?: boolean }>`
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
`;

const MissionTimer = styled.span<{ theme: Theme; compact?: boolean }>`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme, compact }) => compact ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const ProgressBar = styled.div<{ theme: Theme }>`
  width: 100%;
  height: 3px;
  background-color: ${({ theme }) => theme.colors.neutral[200]};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;
  margin-top: ${({ theme }) => theme.spacing[1]};
`;

const ProgressFill = styled.div<{ theme: Theme; percentage: number; status: MissionStatus }>`
  height: 100%;
  width: ${({ percentage }) => Math.min(percentage, 100)}%;
  background-color: ${({ status, theme }) => {
    switch (status) {
      case 'active':
        return theme.colors.success.main;
      case 'paused':
        return theme.colors.warning.main;
      case 'error':
        return theme.colors.error.main;
      case 'complete':
        return theme.colors.info.main;
      default:
        return theme.colors.neutral[400];
    }
  }};
  transition: width 0.3s ease-in-out;
`;

const DetailGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-top: ${({ theme }) => theme.spacing[2]};
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
`;

const EmergencyIndicator = styled.div<{ theme: Theme; level: string }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: ${({ theme }) => `${theme.spacing[1]} ${theme.spacing[2]}`};
  background-color: ${({ level, theme }) => {
    switch (level) {
      case 'advisory':
        return theme.colors.info.main;
      case 'warning':
        return theme.colors.warning.main;
      case 'alert':
        return theme.colors.error.main;
      case 'emergency':
        return theme.colors.emergency;
      default:
        return theme.colors.neutral[400];
    }
  }}20;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-top: ${({ theme }) => theme.spacing[2]};
`;

const getMissionBadgeVariant = (status: MissionStatus) => {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'error':
      return 'error';
    case 'complete':
      return 'info';
    case 'standby':
      return 'neutral';
    default:
      return 'neutral';
  }
};

const getMissionDisplayText = (status: MissionStatus) => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'error':
      return 'Error';
    case 'complete':
      return 'Complete';
    case 'standby':
      return 'Standby';
    default:
      return 'Unknown';
  }
};

const getMissionIcon = (status: MissionStatus): string => {
  switch (status) {
    case 'active':
      return '▶';
    case 'paused':
      return '⏸';
    case 'error':
      return '⚠';
    case 'complete':
      return '✓';
    case 'standby':
      return '⏹';
    default:
      return '?';
  }
};

const formatEstimate = (seconds: number): string => {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}min`;
  } else if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h`;
  } else {
    return `${Math.round(seconds / 86400)}d`;
  }
};

export const MissionStatus: React.FC<StatusWidgetProps> = ({ 
  data: missionData, 
  config, 
  compact, 
  onClick,
  'data-testid': testId 
}) => {
  const theme = useTheme() as Theme;
  const data = missionData as MissionData;
  
  if (!data) {
    return (
      <MissionContainer theme={theme} status="standby" data-testid={testId}>
        <div style={{ color: theme.colors.text.disabled }}>No Mission</div>
      </MissionContainer>
    );
  }

  const isEmergency = data.emergencyLevel && data.emergencyLevel !== 'none';
  const hasProgress = typeof data.progress === 'number';
  const startTime = new Date(data.startTime);
  const estimatedEndTime = data.estimatedDuration 
    ? new Date(data.startTime + data.estimatedDuration * 1000)
    : null;

  const tooltipContent = (
    <div style={{ width: '300px' }}>
      <div style={{ marginBottom: theme.spacing[3] }}>
        <strong>{data.name}</strong>
      </div>
      
      <DetailGrid theme={theme}>
        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Status</DetailLabel>
          <DetailValue theme={theme}>
            <Badge variant={getMissionBadgeVariant(data.status)}>
              {getMissionDisplayText(data.status)}
            </Badge>
          </DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Elapsed Time</DetailLabel>
          <DetailValue theme={theme}>{formatDuration(data.elapsedTime)}</DetailValue>
        </DetailItem>

        <DetailItem theme={theme}>
          <DetailLabel theme={theme}>Start Time</DetailLabel>
          <DetailValue theme={theme}>
            {startTime.toLocaleDateString()} {startTime.toLocaleTimeString()}
          </DetailValue>
        </DetailItem>

        {data.estimatedDuration && (
          <DetailItem theme={theme}>
            <DetailLabel theme={theme}>Est. Duration</DetailLabel>
            <DetailValue theme={theme}>
              {formatEstimate(data.estimatedDuration)}
            </DetailValue>
          </DetailItem>
        )}

        {estimatedEndTime && (
          <DetailItem theme={theme}>
            <DetailLabel theme={theme}>Est. Completion</DetailLabel>
            <DetailValue theme={theme}>
              {estimatedEndTime.toLocaleTimeString()}
            </DetailValue>
          </DetailItem>
        )}

        {data.waypoints && (
          <DetailItem theme={theme}>
            <DetailLabel theme={theme}>Waypoints</DetailLabel>
            <DetailValue theme={theme}>
              {data.waypoints.completed} / {data.waypoints.total}
              {data.waypoints.current && (
                <div style={{ 
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.secondary,
                  marginTop: theme.spacing[1]
                }}>
                  Current: {data.waypoints.current}
                </div>
              )}
            </DetailValue>
          </DetailItem>
        )}
      </DetailGrid>

      {hasProgress && (
        <div style={{ marginTop: theme.spacing[3] }}>
          <DetailLabel theme={theme}>Progress: {data.progress!.toFixed(1)}%</DetailLabel>
          <ProgressBar theme={theme}>
            <ProgressFill 
              theme={theme} 
              percentage={data.progress!} 
              status={data.status} 
            />
          </ProgressBar>
        </div>
      )}

      {isEmergency && (
        <EmergencyIndicator theme={theme} level={data.emergencyLevel!}>
          <Badge variant="error" size="sm">
            {data.emergencyLevel!.toUpperCase()}
          </Badge>
          <span style={{ 
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.primary
          }}>
            Emergency protocols active
          </span>
        </EmergencyIndicator>
      )}
    </div>
  );

  return (
    <Tooltip content={tooltipContent} position="bottom-start" maxWidth={330}>
      <MissionContainer 
        theme={theme} 
        status={data.status}
        onClick={onClick}
        data-testid={testId}
        role="button"
        tabIndex={0}
        aria-label={`Mission ${data.name}: ${getMissionDisplayText(data.status)}, Elapsed: ${formatDuration(data.elapsedTime)}${hasProgress ? `, Progress: ${data.progress!.toFixed(1)}%` : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <MissionIcon 
          theme={theme} 
          status={data.status} 
          emergency={isEmergency}
        >
          {getMissionIcon(data.status)}
        </MissionIcon>
        
        {!compact && (
          <MissionInfo theme={theme}>
            <MissionName theme={theme} compact={compact}>
              {data.name}
            </MissionName>
            <MissionTimer theme={theme} compact={compact}>
              {formatDuration(data.elapsedTime)}
            </MissionTimer>
            {hasProgress && (
              <ProgressBar theme={theme}>
                <ProgressFill 
                  theme={theme} 
                  percentage={data.progress!} 
                  status={data.status} 
                />
              </ProgressBar>
            )}
          </MissionInfo>
        )}
        
        {compact && (
          <MissionTimer theme={theme} compact={compact}>
            {formatDuration(data.elapsedTime)}
          </MissionTimer>
        )}
      </MissionContainer>
    </Tooltip>
  );
};

MissionStatus.displayName = 'MissionStatus';