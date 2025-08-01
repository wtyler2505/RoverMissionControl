import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../theme/themes';
import { useTheme } from '@emotion/react';
import { Card } from '../../ui/core/Card/Card';
import { Badge } from '../../ui/core/Badge/Badge';
import { Button } from '../../ui/core/Button/Button';

// Types
export interface TelemetryData {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  status: 'normal' | 'warning' | 'critical';
  timestamp: Date;
}

export interface SystemStatusItem {
  id: string;
  system: string;
  status: 'online' | 'offline' | 'warning' | 'critical';
  message?: string;
  alerts?: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  disabled?: boolean;
}

interface TelemetrySidebarProps {
  /**
   * Whether the sidebar is initially collapsed
   * @default false
   */
  defaultCollapsed?: boolean;
  /**
   * Callback when collapse state changes
   */
  onCollapseChange?: (collapsed: boolean) => void;
  /**
   * System status data
   */
  systemStatus?: SystemStatusItem[];
  /**
   * Real-time telemetry data
   */
  telemetryData?: TelemetryData[];
  /**
   * Quick action buttons
   */
  quickActions?: QuickAction[];
  /**
   * Whether to persist state in localStorage
   * @default true
   */
  persistState?: boolean;
  /**
   * Width of the expanded sidebar
   * @default 320
   */
  expandedWidth?: number;
  /**
   * Width of the collapsed sidebar
   * @default 64
   */
  collapsedWidth?: number;
  /**
   * Test ID for component
   */
  testId?: string;
  /**
   * Additional CSS class
   */
  className?: string;
}

// Storage key for state persistence
const STORAGE_KEY = 'rover-telemetry-sidebar-collapsed';

// Styled components
const SidebarContainer = styled.aside<{
  theme: Theme;
  collapsed: boolean;
  expandedWidth: number;
  collapsedWidth: number;
}>`
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: ${({ collapsed, expandedWidth, collapsedWidth }) => 
    collapsed ? `${collapsedWidth}px` : `${expandedWidth}px`};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-left: 1px solid ${({ theme }) => theme.colors.divider};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: width ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  overflow: hidden;

  @media (max-width: 768px) {
    width: ${({ collapsed }) => collapsed ? '0px' : '100vw'};
    border-left: none;
    box-shadow: ${({ collapsed, theme }) => collapsed ? 'none' : theme.shadows.xl};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const SidebarHeader = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  min-height: 64px;

  ${({ collapsed }) => collapsed && css`
    justify-content: center;
    padding: ${({ theme }) => theme.spacing[2]};
  `}
`;

const SidebarTitle = styled.h2<{
  theme: Theme;
  collapsed: boolean;
}>`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  opacity: ${({ collapsed }) => collapsed ? 0 : 1};
  transform: ${({ collapsed }) => collapsed ? 'translateX(-20px)' : 'translateX(0)'};
  transition: opacity ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease},
              transform ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
`;

const CollapseButton = styled.button<{
  theme: Theme;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.text.secondary};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: color ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease},
              background-color ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};

  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.background.default};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }

  svg {
    width: 20px;
    height: 20px;
    transition: transform ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  }

  @media (prefers-reduced-motion: reduce) {
    svg {
      transition: none;
    }
  }
`;

const SidebarContent = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${({ collapsed, theme }) => collapsed ? theme.spacing[1] : theme.spacing[4]};
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background.default};
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.divider};
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.text.secondary};
  }
`;

const SectionContainer = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  margin-bottom: ${({ theme }) => theme.spacing[4]};

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionHeader = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing[3]};
  opacity: ${({ collapsed }) => collapsed ? 0 : 1};
  transition: opacity ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};

  h3 {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    color: ${({ theme }) => theme.colors.text.primary};
    margin: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StatusList = styled.ul<{
  theme: Theme;
}>`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const StatusItem = styled.li<{
  theme: Theme;
  status: 'online' | 'offline' | 'warning' | 'critical';
  collapsed: boolean;
}>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
  transition: background-color ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};

  &:hover {
    background-color: ${({ theme }) => theme.colors.background.elevated};
  }

  ${({ collapsed }) => collapsed && css`
    justify-content: center;
    padding: ${({ theme }) => theme.spacing[1]};
  `}
`;

const StatusIndicator = styled.div<{
  theme: Theme;
  status: 'online' | 'offline' | 'warning' | 'critical';
}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;

  ${({ status, theme }) => {
    const colors = {
      online: theme.colors.success.main,
      offline: theme.colors.text.disabled,
      warning: theme.colors.warning.main,
      critical: theme.colors.error.main,
    };
    return css`
      background-color: ${colors[status]};
      box-shadow: 0 0 0 2px ${colors[status]}33;
    `;
  }}
`;

const StatusText = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  flex: 1;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
  opacity: ${({ collapsed }) => collapsed ? 0 : 1};
  transform: ${({ collapsed }) => collapsed ? 'translateX(-10px)' : 'translateX(0)'};
  transition: opacity ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease},
              transform ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};

  .system-name {
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
    margin-bottom: ${({ theme }) => theme.spacing[1]};
  }

  .system-message {
    color: ${({ theme }) => theme.colors.text.secondary};
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    transform: none;
  }
`;

const TelemetryGrid = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  display: grid;
  grid-template-columns: ${({ collapsed }) => collapsed ? '1fr' : 'repeat(auto-fit, minmax(120px, 1fr))'};
  gap: ${({ theme }) => theme.spacing[2]};
`;

const TelemetryCard = styled.div<{
  theme: Theme;
  status: 'normal' | 'warning' | 'critical';
  collapsed: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border-left: 3px solid ${({ status, theme }) => {
    const colors = {
      normal: theme.colors.success.main,
      warning: theme.colors.warning.main,
      critical: theme.colors.error.main,
    };
    return colors[status];
  }};
  transition: background-color ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};

  &:hover {
    background-color: ${({ theme }) => theme.colors.background.default};
  }

  ${({ collapsed }) => collapsed && css`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: ${({ theme }) => theme.spacing[1]};
    border-left: none;
    border: 2px solid ${({ status, theme }) => {
      const colors = {
        normal: theme.colors.success.main,
        warning: theme.colors.warning.main,
        critical: theme.colors.error.main,
      };
      return colors[status];
    }};
  `}
`;

const TelemetryLabel = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
  opacity: ${({ collapsed }) => collapsed ? 0 : 1};
  transition: opacity ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const TelemetryValue = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  font-size: ${({ collapsed, theme }) => collapsed ? theme.typography.fontSize.xs : theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: 1.2;

  .unit {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.regular};
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-left: ${({ theme }) => theme.spacing[1]};
  }
`;

const QuickActionsGrid = styled.div<{
  theme: Theme;
  collapsed: boolean;
}>`
  display: grid;
  grid-template-columns: ${({ collapsed }) => collapsed ? '1fr' : 'repeat(auto-fit, minmax(80px, 1fr))'};
  gap: ${({ theme }) => theme.spacing[2]};
`;

const QuickActionButton = styled.button<{
  theme: Theme;
  collapsed: boolean;
}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[3]};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text.primary};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.duration.fast} ${({ theme }) => theme.transitions.timing.ease};
  min-height: ${({ collapsed }) => collapsed ? '40px' : '60px'};

  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.colors.primary.main};
    color: ${({ theme }) => theme.colors.primary.contrast};
    border-color: ${({ theme }) => theme.colors.primary.main};
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary.main};
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: ${({ collapsed }) => collapsed ? '16px' : '20px'};
    height: ${({ collapsed }) => collapsed ? '16px' : '20px'};
    margin-bottom: ${({ collapsed, theme }) => collapsed ? '0' : theme.spacing[1]};
  }

  span {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    opacity: ${({ collapsed }) => collapsed ? 0 : 1};
    transition: opacity ${({ theme }) => theme.transitions.duration.base} ${({ theme }) => theme.transitions.timing.ease};
  }

  @media (prefers-reduced-motion: reduce) {
    transform: none !important;
    transition: none;
    
    span {
      transition: none;
    }
  }
`;

// Icons
const ChevronIcon: React.FC<{ direction: 'left' | 'right' }> = ({ direction }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: direction === 'left' ? 'rotate(0deg)' : 'rotate(180deg)',
    }}
  >
    <polyline points="15,18 9,12 15,6" />
  </svg>
);

const ActivityIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const SettingsIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

const DefaultSystemStatus: SystemStatusItem[] = [
  {
    id: 'power',
    system: 'Power Systems',
    status: 'online',
    message: 'Battery: 87%, Solar: Active',
  },
  {
    id: 'communication',
    system: 'Communication',
    status: 'online',
    message: 'Signal: Strong, Latency: 2.3s',
  },
  {
    id: 'navigation',
    system: 'Navigation',
    status: 'warning',
    message: 'GPS accuracy reduced',
    alerts: 1,
  },
  {
    id: 'instruments',
    system: 'Science Instruments',
    status: 'online',
    message: 'All instruments operational',
  },
];

const DefaultTelemetryData: TelemetryData[] = [
  {
    id: 'temp',
    label: 'Temperature',
    value: 23.5,
    unit: '°C',
    status: 'normal',
    timestamp: new Date(),
  },
  {
    id: 'battery',
    label: 'Battery',
    value: 87,
    unit: '%',
    status: 'normal',
    timestamp: new Date(),
  },
  {
    id: 'signal',
    label: 'Signal',
    value: -45,
    unit: 'dBm',
    status: 'normal',
    timestamp: new Date(),
  },
  {
    id: 'speed',
    label: 'Speed',
    value: 0.8,
    unit: 'm/s',
    status: 'normal',
    timestamp: new Date(),
  },
];

/**
 * TelemetrySidebar component provides a collapsible sidebar with real-time
 * telemetry data, system status, and quick actions for rover mission control.
 */
export const TelemetrySidebar: React.FC<TelemetrySidebarProps> = ({
  defaultCollapsed = false,
  onCollapseChange,
  systemStatus = DefaultSystemStatus,
  telemetryData = DefaultTelemetryData,
  quickActions = [],
  persistState = true,
  expandedWidth = 320,
  collapsedWidth = 64,
  testId = 'telemetry-sidebar',
  className,
}) => {
  const theme = useTheme() as Theme;
  const sidebarRef = useRef<HTMLElement>(null);
  
  // Initialize collapsed state from localStorage or prop
  const [collapsed, setCollapsed] = useState(() => {
    if (!persistState) return defaultCollapsed;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored !== null ? JSON.parse(stored) : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  // Handle collapse state changes
  const handleCollapseToggle = useCallback(() => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    
    if (persistState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newCollapsed));
      } catch {
        // Ignore localStorage errors
      }
    }
    
    onCollapseChange?.(newCollapsed);
  }, [collapsed, persistState, onCollapseChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target && sidebarRef.current?.contains(event.target as Node)) {
        switch (event.key) {
          case 'Escape':
            if (!collapsed) {
              handleCollapseToggle();
            }
            break;
          case 'Enter':
          case ' ':
            if (event.target === sidebarRef.current) {
              event.preventDefault();
              handleCollapseToggle();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, handleCollapseToggle]);

  // Calculate total alerts
  const totalAlerts = systemStatus.reduce((sum, item) => sum + (item.alerts || 0), 0);

  return (
    <SidebarContainer
      ref={sidebarRef}
      collapsed={collapsed}
      expandedWidth={expandedWidth}
      collapsedWidth={collapsedWidth}
      className={className}
      data-testid={testId}
      role="complementary"
      aria-label="Telemetry sidebar"
      aria-expanded={!collapsed}
    >
      <SidebarHeader collapsed={collapsed}>
        {!collapsed && (
          <SidebarTitle collapsed={collapsed}>
            Telemetry
            {totalAlerts > 0 && (
              <Badge
                variant="error"
                style={{ marginLeft: theme.spacing[2] }}
                testId={`${testId}-alerts-badge`}
              >
                {totalAlerts}
              </Badge>
            )}
          </SidebarTitle>
        )}
        <CollapseButton
          onClick={handleCollapseToggle}
          aria-label={collapsed ? 'Expand telemetry sidebar' : 'Collapse telemetry sidebar'}
          data-testid={`${testId}-collapse-button`}
        >
          <ChevronIcon direction={collapsed ? 'left' : 'right'} />
        </CollapseButton>
      </SidebarHeader>

      <SidebarContent collapsed={collapsed}>
        {/* System Status Section */}
        <SectionContainer collapsed={collapsed}>
          {!collapsed && (
            <SectionHeader collapsed={collapsed}>
              <h3>System Status</h3>
              {totalAlerts > 0 && (
                <Badge variant="error" dot testId={`${testId}-system-alert`} />
              )}
            </SectionHeader>
          )}
          <StatusList>
            {systemStatus.map((status) => (
              <StatusItem
                key={status.id}
                status={status.status}
                collapsed={collapsed}
                data-testid={`${testId}-status-${status.id}`}
              >
                <StatusIndicator status={status.status} />
                <StatusText collapsed={collapsed}>
                  <div className="system-name">{status.system}</div>
                  {status.message && (
                    <div className="system-message">{status.message}</div>
                  )}
                </StatusText>
                {status.alerts && status.alerts > 0 && !collapsed && (
                  <Badge variant="error" size="small">
                    {status.alerts}
                  </Badge>
                )}
              </StatusItem>
            ))}
          </StatusList>
        </SectionContainer>

        {/* Telemetry Data Section */}
        <SectionContainer collapsed={collapsed}>
          {!collapsed && (
            <SectionHeader collapsed={collapsed}>
              <h3>Telemetry Data</h3>
            </SectionHeader>
          )}
          <TelemetryGrid collapsed={collapsed}>
            {telemetryData.map((data) => (
              <TelemetryCard
                key={data.id}
                status={data.status}
                collapsed={collapsed}
                data-testid={`${testId}-telemetry-${data.id}`}
                title={collapsed ? `${data.label}: ${data.value}${data.unit || ''}` : undefined}
              >
                <TelemetryLabel collapsed={collapsed}>
                  {data.label}
                </TelemetryLabel>
                <TelemetryValue collapsed={collapsed}>
                  {data.value}
                  {data.unit && <span className="unit">{data.unit}</span>}
                </TelemetryValue>
              </TelemetryCard>
            ))}
          </TelemetryGrid>
        </SectionContainer>

        {/* Quick Actions Section */}
        {quickActions.length > 0 && (
          <SectionContainer collapsed={collapsed}>
            {!collapsed && (
              <SectionHeader collapsed={collapsed}>
                <h3>Quick Actions</h3>
              </SectionHeader>
            )}
            <QuickActionsGrid collapsed={collapsed}>
              {quickActions.map((action) => (
                <QuickActionButton
                  key={action.id}
                  collapsed={collapsed}
                  onClick={action.action}
                  disabled={action.disabled}
                  data-testid={`${testId}-action-${action.id}`}
                  title={collapsed ? action.label : undefined}
                >
                  {action.icon}
                  <span>{action.label}</span>
                </QuickActionButton>
              ))}
            </QuickActionsGrid>
          </SectionContainer>
        )}

        {/* Settings Section */}
        <SectionContainer collapsed={collapsed}>
          {!collapsed && (
            <SectionHeader collapsed={collapsed}>
              <h3>Settings</h3>
            </SectionHeader>
          )}
          <QuickActionsGrid collapsed={collapsed}>
            <QuickActionButton
              collapsed={collapsed}
              onClick={() => console.log('Settings clicked')}
              data-testid={`${testId}-settings`}
              title={collapsed ? 'Settings' : undefined}
            >
              <SettingsIcon />
              <span>Settings</span>
            </QuickActionButton>
          </QuickActionsGrid>
        </SectionContainer>
      </SidebarContent>
    </SidebarContainer>
  );
};

export default TelemetrySidebar;