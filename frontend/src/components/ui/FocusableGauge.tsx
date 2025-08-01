/**
 * FocusableGauge Component
 * A telemetry gauge with comprehensive keyboard navigation and screen reader support
 * Supports WCAG 2.1 AA accessibility requirements
 */

import React, { useRef, useEffect, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { useFocusManagement } from '../../contexts/FocusManagementContext';
import { interactiveFocusStyles } from '../../theme/focusStyles';
import { Theme } from '../../theme/themes';

interface FocusableGaugeProps {
  /**
   * Current value
   */
  value: number;
  /**
   * Minimum value
   */
  min: number;
  /**
   * Maximum value
   */
  max: number;
  /**
   * Unit of measurement
   */
  unit: string;
  /**
   * Label for the gauge
   */
  label: string;
  /**
   * Type determines color coding
   */
  type?: 'normal' | 'battery' | 'temperature' | 'latency' | 'pressure' | 'speed';
  /**
   * Size of the gauge
   */
  size?: number;
  /**
   * Whether the gauge is focusable
   */
  focusable?: boolean;
  /**
   * Test ID for testing
   */
  testId?: string;
  /**
   * Additional CSS class
   */
  className?: string;
  /**
   * Callback when gauge is focused (for detailed info)
   */
  onFocus?: () => void;
  /**
   * Custom thresholds for status
   */
  thresholds?: {
    good: number;
    warning: number;
    critical: number;
  };
}

const GaugeContainer = styled.div<{
  theme: Theme;
  size: number;
  focusable: boolean;
}>`
  position: relative;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size * 0.6}px; // Semi-circle
  cursor: ${({ focusable }) => focusable ? 'pointer' : 'default'};
  
  ${({ focusable, theme }) => focusable && css`
    ${interactiveFocusStyles(theme, 'gauge')}
    
    &:hover {
      transform: scale(1.02);
      transition: transform 0.2s ease;
    }
  `}
  
  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`;

const GaugeLabel = styled.h3<{
  theme: Theme;
}>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  text-align: center;
`;

const GaugeSvg = styled.svg<{
  theme: Theme;
}>`
  width: 100%;
  height: 100%;
  overflow: visible;
`;

const GaugeValue = styled.div<{
  theme: Theme;
  status: string;
}>`
  position: absolute;
  bottom: 20%;
  left: 50%;
  transform: translateX(-50%);
  text-align: center;
  
  .value {
    font-size: 1.2em;
    font-weight: 600;
    color: ${({ theme, status }) => {
      switch (status) {
        case 'good': return theme.colors.success.main;
        case 'warning': return theme.colors.warning.main;
        case 'critical': return theme.colors.error.main;
        default: return theme.colors.text.primary;
      }
    }};
  }
  
  .unit {
    font-size: 0.8em;
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-left: 2px;
  }
`;

const StatusIndicator = styled.div<{
  theme: Theme;
  status: string;
}>`
  position: absolute;
  top: -5px;
  right: -5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.colors.background.paper};
  background-color: ${({ theme, status }) => {
    switch (status) {
      case 'good': return theme.colors.success.main;
      case 'warning': return theme.colors.warning.main;
      case 'critical': return theme.colors.error.main;
      default: return theme.colors.text.disabled;
    }
  }};
  
  ${({ status }) => status === 'critical' && css`
    animation: criticalPulse 1s infinite;
  `}
  
  @keyframes criticalPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none !important;
  }
`;

const DetailedInfo = styled.div<{
  theme: Theme;
  visible: boolean;
}>`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  background: ${({ theme }) => theme.colors.background.tooltip};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  white-space: nowrap;
  opacity: ${({ visible }) => visible ? 1 : 0};
  visibility: ${({ visible }) => visible ? 'visible' : 'hidden'};
  transition: opacity 0.2s ease, visibility 0.2s ease;
  z-index: 10;
  box-shadow: ${({ theme }) => theme.shadows.md};
  
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid ${({ theme }) => theme.colors.background.tooltip};
  }
`;

export const FocusableGauge: React.FC<FocusableGaugeProps> = ({
  value,
  min,
  max,
  unit,
  label,
  type = 'normal',
  size = 120,
  focusable = true,
  testId,
  className,
  onFocus,
  thresholds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showDetails, setShowDetails] = React.useState(false);
  const { focusVisible, routerFocus } = useFocusManagement();

  // Calculate percentage and status
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const angle = (percentage / 100) * 180 - 90; // -90 to 90 degrees
  
  // Determine status based on type and thresholds
  const getStatus = useCallback(() => {
    if (thresholds) {
      if (percentage >= thresholds.good) return 'good';
      if (percentage >= thresholds.warning) return 'warning';
      return 'critical';
    }
    
    // Default thresholds by type
    switch (type) {
      case 'battery':
        if (percentage > 60) return 'good';
        if (percentage > 30) return 'warning';
        return 'critical';
        
      case 'temperature':
        if (percentage < 70) return 'good';
        if (percentage < 85) return 'warning';
        return 'critical';
        
      case 'latency':
        if (percentage < 50) return 'good';
        if (percentage < 75) return 'warning';
        return 'critical';
        
      case 'pressure':
        if (percentage > 80 && percentage < 95) return 'good';
        if (percentage > 60) return 'warning';
        return 'critical';
        
      default:
        if (percentage > 75) return 'good';
        if (percentage > 50) return 'warning';
        return 'critical';
    }
  }, [percentage, type, thresholds]);

  const status = getStatus();
  
  // Generate gauge color
  const getGaugeColor = (status: string, theme: Theme) => {
    switch (status) {
      case 'good': return theme.colors.success.main;
      case 'warning': return theme.colors.warning.main;
      case 'critical': return theme.colors.error.main;
      default: return theme.colors.primary.main;
    }
  };

  // Handle focus events
  const handleFocus = useCallback(() => {
    setShowDetails(true);
    if (onFocus) {
      onFocus();
    }
    
    // Announce detailed information to screen readers
    const announcement = `${label} gauge: ${value.toFixed(1)} ${unit} out of ${max} ${unit}. Status: ${status}. ${Math.round(percentage)}% of maximum.`;
    routerFocus.announceToScreenReader(announcement);
  }, [label, value, unit, max, status, percentage, onFocus, routerFocus]);

  const handleBlur = useCallback(() => {
    setShowDetails(false);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleFocus();
        break;
        
      case 'Escape':
        e.preventDefault();
        setShowDetails(false);
        break;
    }
  }, [handleFocus]);

  // Generate comprehensive description for screen readers
  const generateDescription = useCallback(() => {
    const trend = percentage > 50 ? 'high' : percentage > 25 ? 'moderate' : 'low';
    return `${label} reading indicates ${status} levels at ${trend} range. Current value: ${value.toFixed(1)} ${unit}.`;
  }, [label, status, value, unit, percentage]);

  const radius = (size - 20) / 2;
  const circumference = Math.PI * radius;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

  return (
    <GaugeContainer
      ref={containerRef}
      size={size}
      focusable={focusable}
      className={className}
      tabIndex={focusable ? 0 : -1}
      role="meter"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value.toFixed(1)} ${unit} - ${status} level`}
      aria-label={`${label} gauge`}
      aria-describedby={`${testId}-description`}
      data-testid={testId}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...(focusable ? focusVisible.getFocusVisibleProps() : {})}
    >
      <GaugeLabel>{label}</GaugeLabel>
      
      <GaugeSvg viewBox={`0 0 ${size} ${size * 0.6}`} aria-hidden="true">
        {/* Background arc */}
        <path
          d={`M 10 ${size * 0.5} A ${radius} ${radius} 0 0 1 ${size - 10} ${size * 0.5}`}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          opacity="0.2"
        />
        
        {/* Value arc */}
        <path
          d={`M 10 ${size * 0.5} A ${radius} ${radius} 0 0 1 ${size - 10} ${size * 0.5}`}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeDasharray={strokeDasharray}
          style={{ color: getGaugeColor(status, {} as Theme) }}
          strokeLinecap="round"
        />
        
        {/* Needle */}
        <g transform={`translate(${size / 2}, ${size * 0.5}) rotate(${angle})`}>
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={-radius + 10}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="0" r="3" fill="white" />
        </g>
      </GaugeSvg>
      
      <GaugeValue status={status}>
        <span className="value">{typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span className="unit">{unit}</span>
      </GaugeValue>
      
      <StatusIndicator status={status} />
      
      {focusable && (
        <DetailedInfo visible={showDetails}>
          Status: {status.charAt(0).toUpperCase() + status.slice(1)} •{' '}
          Range: {min}-{max} {unit} •{' '}
          {Math.round(percentage)}% of maximum
        </DetailedInfo>
      )}
      
      {/* Hidden description for screen readers */}
      <div id={`${testId}-description`} className="sr-only">
        {generateDescription()}
      </div>
      
      {/* Status announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {status === 'critical' ? `Critical ${label} level detected` : ''}
      </div>
    </GaugeContainer>
  );
};

export default FocusableGauge;