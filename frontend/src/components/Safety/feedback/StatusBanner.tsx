/**
 * Status Banner Component
 * 
 * Real-time status banner with progressive disclosure and color coding.
 * Provides at-a-glance system status with expandable details.
 * 
 * @component
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Fade,
  Stack,
  Chip,
  LinearProgress,
  Button,
  Divider,
  Grid,
  Tooltip,
  Badge,
  useTheme,
  alpha,
  Portal,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';

// Types
export enum SystemStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
  EMERGENCY = 'emergency',
}

export interface StatusMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  status: SystemStatus;
  trend?: 'up' | 'down' | 'stable';
  threshold?: {
    warning: number;
    error: number;
    critical: number;
  };
  history?: Array<{
    timestamp: Date;
    value: number;
  }>;
}

export interface StatusSection {
  id: string;
  title: string;
  status: SystemStatus;
  metrics: StatusMetric[];
  expandable?: boolean;
  actions?: StatusAction[];
}

export interface StatusAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  handler: () => void;
  disabled?: boolean;
}

export interface StatusBannerProps {
  /**
   * Current system status sections
   */
  sections: StatusSection[];
  /**
   * Position of the banner
   */
  position?: 'top' | 'bottom';
  /**
   * Whether the banner is collapsible
   */
  collapsible?: boolean;
  /**
   * Initial collapsed state
   */
  initialCollapsed?: boolean;
  /**
   * Whether to show animations
   */
  animate?: boolean;
  /**
   * Update interval in milliseconds
   */
  updateInterval?: number;
  /**
   * Callback when a section is expanded/collapsed
   */
  onSectionToggle?: (sectionId: string, expanded: boolean) => void;
  /**
   * Callback when the banner is closed
   */
  onClose?: () => void;
}

// Status Colors
const getStatusColor = (status: SystemStatus, theme: any): string => {
  switch (status) {
    case SystemStatus.NORMAL:
      return theme.palette.success.main;
    case SystemStatus.WARNING:
      return theme.palette.warning.main;
    case SystemStatus.ERROR:
      return theme.palette.error.main;
    case SystemStatus.CRITICAL:
      return theme.palette.error.dark;
    case SystemStatus.EMERGENCY:
      return '#ff0000';
    default:
      return theme.palette.grey[500];
  }
};

// Status Icons
const getStatusIcon = (status: SystemStatus): React.ReactNode => {
  switch (status) {
    case SystemStatus.NORMAL:
      return <CheckCircleIcon />;
    case SystemStatus.WARNING:
      return <WarningIcon />;
    case SystemStatus.ERROR:
    case SystemStatus.CRITICAL:
    case SystemStatus.EMERGENCY:
      return <ErrorIcon />;
    default:
      return <InfoIcon />;
  }
};

// Metric Visualization Component
const MetricDisplay: React.FC<{
  metric: StatusMetric;
  compact?: boolean;
}> = ({ metric, compact = false }) => {
  const theme = useTheme();
  const statusColor = getStatusColor(metric.status, theme);

  const getTrendIcon = () => {
    if (!metric.trend) return null;
    
    const style = { 
      fontSize: 14,
      color: metric.trend === 'up' ? theme.palette.success.main : 
             metric.trend === 'down' ? theme.palette.error.main : 
             theme.palette.text.secondary
    };
    
    if (metric.trend === 'up') return '↑';
    if (metric.trend === 'down') return '↓';
    return '→';
  };

  if (compact) {
    return (
      <Tooltip
        title={
          <Box>
            <Typography variant="body2">{metric.label}</Typography>
            <Typography variant="h6">
              {metric.value} {metric.unit}
            </Typography>
            {metric.trend && (
              <Typography variant="caption" color="textSecondary">
                Trend: {metric.trend}
              </Typography>
            )}
          </Box>
        }
      >
        <Chip
          label={`${metric.value}${metric.unit || ''}`}
          size="small"
          sx={{
            backgroundColor: alpha(statusColor, 0.1),
            color: statusColor,
            fontWeight: 'medium',
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="textSecondary">
        {metric.label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
        <Typography 
          variant="h6" 
          sx={{ 
            color: statusColor,
            fontWeight: 'medium',
          }}
        >
          {metric.value}
        </Typography>
        {metric.unit && (
          <Typography variant="body2" color="textSecondary">
            {metric.unit}
          </Typography>
        )}
        {metric.trend && (
          <Typography
            component="span"
            sx={{
              ml: 0.5,
              fontSize: 16,
              color: metric.trend === 'up' ? theme.palette.success.main : 
                     metric.trend === 'down' ? theme.palette.error.main : 
                     theme.palette.text.secondary,
            }}
          >
            {getTrendIcon()}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// Section Component
const StatusSectionComponent: React.FC<{
  section: StatusSection;
  expanded: boolean;
  onToggle: () => void;
  onAction?: (actionId: string) => void;
}> = ({ section, expanded, onToggle, onAction }) => {
  const theme = useTheme();
  const statusColor = getStatusColor(section.status, theme);

  // Calculate overall metrics summary
  const metricsSummary = useMemo(() => {
    const statusCounts = section.metrics.reduce((acc, metric) => {
      acc[metric.status] = (acc[metric.status] || 0) + 1;
      return acc;
    }, {} as Record<SystemStatus, number>);

    return Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .sort(([a], [b]) => {
        const order = [SystemStatus.EMERGENCY, SystemStatus.CRITICAL, SystemStatus.ERROR, SystemStatus.WARNING, SystemStatus.NORMAL];
        return order.indexOf(a as SystemStatus) - order.indexOf(b as SystemStatus);
      });
  }, [section.metrics]);

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        border: `1px solid ${alpha(statusColor, 0.3)}`,
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          backgroundColor: alpha(statusColor, 0.05),
          borderBottom: expanded ? `1px solid ${theme.palette.divider}` : 'none',
          cursor: section.expandable ? 'pointer' : 'default',
        }}
        onClick={section.expandable ? onToggle : undefined}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ color: statusColor }}>
            {getStatusIcon(section.status)}
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
              {section.title}
            </Typography>
            
            {/* Metrics Summary */}
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              {metricsSummary.map(([status, count]) => (
                <Chip
                  key={status}
                  label={`${count} ${status}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.75rem',
                    backgroundColor: alpha(getStatusColor(status as SystemStatus, theme), 0.1),
                    color: getStatusColor(status as SystemStatus, theme),
                  }}
                />
              ))}
            </Stack>
          </Box>

          {/* Quick Metrics */}
          <Stack direction="row" spacing={1}>
            {section.metrics.slice(0, 3).map(metric => (
              <MetricDisplay key={metric.id} metric={metric} compact />
            ))}
          </Stack>

          {/* Actions */}
          {section.actions && section.actions.length > 0 && (
            <Stack direction="row" spacing={0.5}>
              {section.actions.map(action => (
                <Tooltip key={action.id} title={action.label}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction?.(action.id);
                      action.handler();
                    }}
                    disabled={action.disabled}
                  >
                    {action.icon || <MoreIcon />}
                  </IconButton>
                </Tooltip>
              ))}
            </Stack>
          )}

          {section.expandable && (
            <IconButton size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Stack>
      </Box>

      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2}>
            {section.metrics.map(metric => (
              <Grid item xs={12} sm={6} md={3} key={metric.id}>
                <MetricDisplay metric={metric} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </Paper>
  );
};

// Main Component
export const StatusBanner: React.FC<StatusBannerProps> = ({
  sections,
  position = 'top',
  collapsible = true,
  initialCollapsed = false,
  animate = true,
  updateInterval = 1000,
  onSectionToggle,
  onClose,
}) => {
  const theme = useTheme();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const updateTimerRef = useRef<NodeJS.Timeout>();

  // Calculate overall system status
  const overallStatus = useMemo(() => {
    const statuses = sections.map(s => s.status);
    if (statuses.includes(SystemStatus.EMERGENCY)) return SystemStatus.EMERGENCY;
    if (statuses.includes(SystemStatus.CRITICAL)) return SystemStatus.CRITICAL;
    if (statuses.includes(SystemStatus.ERROR)) return SystemStatus.ERROR;
    if (statuses.includes(SystemStatus.WARNING)) return SystemStatus.WARNING;
    return SystemStatus.NORMAL;
  }, [sections]);

  const overallStatusColor = getStatusColor(overallStatus, theme);

  // Update timer
  useEffect(() => {
    if (updateInterval > 0) {
      updateTimerRef.current = setInterval(() => {
        setLastUpdate(new Date());
      }, updateInterval);
    }

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, [updateInterval]);

  // Toggle section expansion
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      onSectionToggle?.(sectionId, next.has(sectionId));
      return next;
    });
  };

  // Banner position styles
  const positionStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      position: 'fixed',
      left: 0,
      right: 0,
      zIndex: theme.zIndex.appBar + 10,
    };

    if (position === 'top') {
      styles.top = 0;
    } else {
      styles.bottom = 0;
    }

    return styles;
  }, [position, theme.zIndex.appBar]);

  return (
    <Portal>
      <Fade in={!collapsed} timeout={animate ? 300 : 0}>
        <Box sx={positionStyles}>
          <Paper
            elevation={4}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
              borderRadius: 0,
              borderBottom: position === 'top' ? `3px solid ${overallStatusColor}` : 'none',
              borderTop: position === 'bottom' ? `3px solid ${overallStatusColor}` : 'none',
            }}
          >
            {/* Header Bar */}
            <Box
              sx={{
                px: 3,
                py: 1,
                backgroundColor: alpha(overallStatusColor, 0.1),
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ color: overallStatusColor }}>
                {getStatusIcon(overallStatus)}
              </Box>
              
              <Typography variant="h6" sx={{ flex: 1 }}>
                System Status
              </Typography>

              <Stack direction="row" spacing={2} alignItems="center">
                <Typography variant="caption" color="textSecondary">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </Typography>

                {overallStatus === SystemStatus.EMERGENCY && (
                  <Chip
                    label="EMERGENCY"
                    color="error"
                    size="small"
                    sx={{
                      animation: 'pulse 1s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%': { opacity: 1 },
                        '50%': { opacity: 0.7 },
                        '100%': { opacity: 1 },
                      },
                    }}
                  />
                )}

                <IconButton
                  size="small"
                  onClick={() => setLastUpdate(new Date())}
                  title="Refresh"
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>

                {collapsible && (
                  <IconButton
                    size="small"
                    onClick={() => setCollapsed(true)}
                    title="Minimize"
                  >
                    <ExpandLessIcon fontSize="small" />
                  </IconButton>
                )}

                {onClose && (
                  <IconButton
                    size="small"
                    onClick={onClose}
                    title="Close"
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            </Box>

            {/* Sections */}
            <Box sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
              <Stack spacing={2}>
                {sections.map(section => (
                  <StatusSectionComponent
                    key={section.id}
                    section={section}
                    expanded={expandedSections.has(section.id)}
                    onToggle={() => toggleSection(section.id)}
                  />
                ))}
              </Stack>
            </Box>

            {/* Progress Indicator */}
            {overallStatus !== SystemStatus.NORMAL && animate && (
              <LinearProgress
                variant="indeterminate"
                sx={{
                  height: 2,
                  backgroundColor: alpha(overallStatusColor, 0.2),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: overallStatusColor,
                  },
                }}
              />
            )}
          </Paper>
        </Box>
      </Fade>

      {/* Collapsed State */}
      {collapsible && (
        <Fade in={collapsed} timeout={animate ? 300 : 0}>
          <Box
            sx={{
              ...positionStyles,
              display: collapsed ? 'block' : 'none',
            }}
          >
            <Paper
              elevation={2}
              sx={{
                px: 2,
                py: 0.5,
                backgroundColor: alpha(overallStatusColor, 0.9),
                color: theme.palette.getContrastText(overallStatusColor),
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                borderRadius: 0,
              }}
              onClick={() => setCollapsed(false)}
            >
              {getStatusIcon(overallStatus)}
              <Typography variant="body2" sx={{ flex: 1 }}>
                System Status: {overallStatus.toUpperCase()}
              </Typography>
              <IconButton
                size="small"
                sx={{ color: 'inherit' }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Paper>
          </Box>
        </Fade>
      )}
    </Portal>
  );
};

export default StatusBanner;