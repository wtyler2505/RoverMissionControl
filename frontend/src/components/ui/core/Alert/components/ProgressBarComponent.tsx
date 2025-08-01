/**
 * ProgressBarComponent
 * Configurable progress indicator with multiple variants and accessibility features
 */

import React, { useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { ProgressContent, RichContentConfig } from '../types/RichContentTypes';

interface ProgressBarComponentProps {
  content: ProgressContent;
  config: RichContentConfig;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onInteraction?: (action: string, data?: any) => void;
}

// Animations
const indeterminateAnimation = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const circularRotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const ProgressContainer = styled.div<{ 
  theme: Theme;
  variant: ProgressContent['variant'];
  size: ProgressContent['size'];
  constraints?: ProgressContent['constraints'];
}>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  
  /* Apply constraints */
  ${({ constraints }) => constraints && css`
    max-width: ${constraints.maxWidth || '100%'};
    max-height: ${constraints.maxHeight || 'none'};
    
    /* Mobile responsive */
    @media (max-width: 768px) {
      ${constraints.mobile?.maxWidth && css`
        max-width: ${constraints.mobile.maxWidth};
      `}
      ${constraints.mobile?.maxHeight && css`
        max-height: ${constraints.mobile.maxHeight};
      `}
      ${constraints.mobile?.hide && css`
        display: none;
      `}
    }
  `}
  
  /* Size-based spacing */
  ${({ size, theme }) => {
    switch (size) {
      case 'small':
        return css`
          gap: ${theme.spacing[1]};
        `;
      case 'large':
        return css`
          gap: ${theme.spacing[3]};
        `;
      default:
        return css`
          gap: ${theme.spacing[2]};
        `;
    }
  }}
`;

const ProgressHeader = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const ProgressLabel = styled.div<{ 
  theme: Theme; 
  size: ProgressContent['size'];
}>`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  flex: 1;
  
  ${({ size, theme }) => {
    switch (size) {
      case 'small':
        return css`
          font-size: ${theme.typography.fontSize.xs};
        `;
      case 'large':
        return css`
          font-size: ${theme.typography.fontSize.base};
        `;
      default:
        return css`
          font-size: ${theme.typography.fontSize.sm};
        `;
    }
  }}
`;

const ProgressValue = styled.div<{ 
  theme: Theme; 
  size: ProgressContent['size'];
}>`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
  white-space: nowrap;
  
  ${({ size, theme }) => {
    switch (size) {
      case 'small':
        return css`
          font-size: ${theme.typography.fontSize.xs};
        `;
      case 'large':
        return css`
          font-size: ${theme.typography.fontSize.base};
        `;
      default:
        return css`
          font-size: ${theme.typography.fontSize.sm};
        `;
    }
  }}
`;

// Linear Progress Bar
const LinearProgressTrack = styled.div<{ 
  theme: Theme; 
  size: ProgressContent['size'];
}>`
  position: relative;
  width: 100%;
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  overflow: hidden;
  
  ${({ size, theme }) => {
    switch (size) {
      case 'small':
        return css`
          height: 4px;
        `;
      case 'large':
        return css`
          height: 12px;
        `;
      default:
        return css`
          height: 8px;
        `;
    }
  }}
  
  /* High contrast mode */
  @media (prefers-contrast: high) {
    border: 1px solid ${({ theme }) => theme.colors.text.primary};
  }
`;

const LinearProgressBar = styled.div<{ 
  theme: Theme; 
  color: ProgressContent['color'];
  value: number;
  indeterminate: boolean;
}>`
  height: 100%;
  border-radius: inherit;
  transition: width 0.3s ease;
  
  ${({ theme, color = 'primary' }) => {
    const colorMap = {
      primary: theme.colors.primary.main,
      secondary: theme.colors.secondary.main,
      success: theme.colors.success.main,
      warning: theme.colors.warning.main,
      error: theme.colors.error.main
    };
    
    return css`
      background-color: ${colorMap[color]};
    `;
  }}
  
  /* Determinate progress */
  ${({ value, indeterminate }) => !indeterminate && css`
    width: ${Math.min(Math.max(value, 0), 100)}%;
  `}
  
  /* Indeterminate progress */
  ${({ indeterminate }) => indeterminate && css`
    width: 30%;
    animation: ${indeterminateAnimation} 2s linear infinite;
  `}
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
    animation: none;
    
    ${({ indeterminate }) => indeterminate && css`
      width: 100%;
      opacity: 0.6;
    `}
  }
`;

const LinearProgressBuffer = styled.div<{ 
  theme: Theme; 
  color: ProgressContent['color'];
  buffer: number;
}>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: inherit;
  opacity: 0.3;
  transition: width 0.3s ease;
  
  ${({ theme, color = 'primary' }) => {
    const colorMap = {
      primary: theme.colors.primary.main,
      secondary: theme.colors.secondary.main,
      success: theme.colors.success.main,
      warning: theme.colors.warning.main,
      error: theme.colors.error.main
    };
    
    return css`
      background-color: ${colorMap[color]};
      width: ${Math.min(Math.max(buffer, 0), 100)}%;
    `;
  }}
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Circular Progress
const CircularProgressContainer = styled.div<{ 
  theme: Theme; 
  size: ProgressContent['size'];
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  ${({ size }) => {
    switch (size) {
      case 'small':
        return css`
          width: 32px;
          height: 32px;
        `;
      case 'large':
        return css`
          width: 64px;
          height: 64px;
        `;
      default:
        return css`
          width: 48px;
          height: 48px;
        `;
    }
  }}
`;

const CircularProgressSvg = styled.svg<{ 
  indeterminate: boolean;
}>`
  transform: rotate(-90deg);
  
  ${({ indeterminate }) => indeterminate && css`
    animation: ${circularRotate} 2s linear infinite;
  `}
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CircularProgressTrack = styled.circle<{ theme: Theme }>`
  fill: none;
  stroke: ${({ theme }) => theme.colors.background.elevated};
  stroke-width: 4;
`;

const CircularProgressBar = styled.circle<{ 
  theme: Theme; 
  color: ProgressContent['color'];
  progress: number;
  indeterminate: boolean;
}>`
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
  
  ${({ theme, color = 'primary' }) => {
    const colorMap = {
      primary: theme.colors.primary.main,
      secondary: theme.colors.secondary.main,
      success: theme.colors.success.main,
      warning: theme.colors.warning.main,
      error: theme.colors.error.main
    };
    
    return css`
      stroke: ${colorMap[color]};
    `;
  }}
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const CircularProgressLabel = styled.div<{ 
  theme: Theme; 
  size: ProgressContent['size'];
}>`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  
  ${({ size, theme }) => {
    switch (size) {
      case 'small':
        return css`
          font-size: ${theme.typography.fontSize.xs};
        `;
      case 'large':
        return css`
          font-size: ${theme.typography.fontSize.sm};
        `;
      default:
        return css`
          font-size: ${theme.typography.fontSize.xs};
        `;
    }
  }}
`;

export const ProgressBarComponent: React.FC<ProgressBarComponentProps> = ({
  content,
  config,
  onLoad,
  onError,
  onInteraction
}) => {
  // Validate progress value
  const progressValue = useMemo(() => {
    const max = content.max || 100;
    const value = Math.min(Math.max(content.value, 0), max);
    return (value / max) * 100;
  }, [content.value, content.max]);

  const bufferValue = useMemo(() => {
    if (content.buffer === undefined) return undefined;
    const max = content.max || 100;
    const buffer = Math.min(Math.max(content.buffer, 0), max);
    return (buffer / max) * 100;
  }, [content.buffer, content.max]);

  // Validate configuration
  useEffect(() => {
    if (content.value < 0 || content.value > (content.max || 100)) {
      onError?.(new Error(`Progress value ${content.value} is out of range`));
    }
  }, [content.value, content.max, onError]);

  // Load callback
  useEffect(() => {
    onLoad?.();
  }, [onLoad]);

  // Handle click interaction
  const handleClick = () => {
    onInteraction?.('progress-click', {
      value: content.value,
      max: content.max || 100,
      percentage: progressValue
    });
  };

  // Format value display
  const formatValue = () => {
    if (content.indeterminate) return '';
    
    if (content.showPercentage) {
      return `${Math.round(progressValue)}%`;
    }
    
    if (content.showValue) {
      return `${content.value}${content.max ? `/${content.max}` : ''}`;
    }
    
    return '';
  };

  // Render circular progress
  const renderCircularProgress = () => {
    const size = content.size === 'small' ? 32 : content.size === 'large' ? 64 : 48;
    const radius = (size - 8) / 2; // Subtract stroke width
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = content.indeterminate 
      ? circumference * 0.25 
      : circumference - (progressValue / 100) * circumference;

    return (
      <CircularProgressContainer size={content.size}>
        <CircularProgressSvg
          width={size}
          height={size}
          indeterminate={Boolean(content.indeterminate)}
        >
          <CircularProgressTrack
            cx={size / 2}
            cy={size / 2}
            r={radius}
          />
          <CircularProgressBar
            cx={size / 2}
            cy={size / 2}
            r={radius}
            color={content.color}
            progress={progressValue}
            indeterminate={Boolean(content.indeterminate)}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset
            }}
          />
        </CircularProgressSvg>
        
        {(content.showPercentage || content.showValue) && (
          <CircularProgressLabel size={content.size}>
            {formatValue()}
          </CircularProgressLabel>
        )}
      </CircularProgressContainer>
    );
  };

  // Render linear progress
  const renderLinearProgress = () => (
    <LinearProgressTrack size={content.size}>
      {/* Buffer bar (behind main progress) */}
      {bufferValue !== undefined && (
        <LinearProgressBuffer
          color={content.color}
          buffer={bufferValue}
        />
      )}
      
      {/* Main progress bar */}
      <LinearProgressBar
        color={content.color}
        value={progressValue}
        indeterminate={Boolean(content.indeterminate)}
      />
    </LinearProgressTrack>
  );

  return (
    <ProgressContainer
      variant={content.variant}
      size={content.size}
      constraints={content.constraints}
      onClick={handleClick}
      className={content.className}
      data-testid={content.testId || `progress-${content.id}`}
      role="progressbar"
      aria-label={content.ariaLabel || content.label}
      aria-describedby={content.ariaDescription}
      aria-valuenow={content.indeterminate ? undefined : content.value}
      aria-valuemin={0}
      aria-valuemax={content.max || 100}
      aria-valuetext={content.indeterminate ? 'Loading...' : formatValue()}
    >
      {/* Header with label and value */}
      {(content.label || content.showPercentage || content.showValue) && (
        <ProgressHeader>
          {content.label && (
            <ProgressLabel size={content.size}>
              {content.label}
            </ProgressLabel>
          )}
          
          {(content.showPercentage || content.showValue) && content.variant !== 'circular' && (
            <ProgressValue size={content.size}>
              {formatValue()}
            </ProgressValue>
          )}
        </ProgressHeader>
      )}
      
      {/* Progress indicator */}
      {content.variant === 'circular' 
        ? renderCircularProgress()
        : renderLinearProgress()
      }
    </ProgressContainer>
  );
};