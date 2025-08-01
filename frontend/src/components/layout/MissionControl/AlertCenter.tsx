/**
 * Alert Center Component
 * Centralized notification center for Mission Control system
 * 
 * Features:
 * - Alert aggregation with filtering and prioritization
 * - Support for different alert types (Critical, Warning, Info, Success)
 * - Bulk actions (Mark all read, Clear all, Export)
 * - Alert history with timestamps and resolution tracking
 * - Role-based visibility and action permissions
 * - Real-time alert streaming integration
 * - Badge count integration
 * - WCAG 2.1 AA accessibility with screen reader support
 */

import React, { 
  useState, 
  useCallback, 
  useMemo, 
  useRef, 
  useEffect,
  forwardRef,
  useImperativeHandle
} from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { Alert } from '../../ui/core/Alert/Alert';
import { Badge } from '../../ui/core/Badge/Badge';
import { Button } from '../../ui/core/Button/Button';
import { Modal } from '../../ui/core/Modal/Modal';
import { Input } from '../../ui/core/Input/Input';
import { Select } from '../../ui/core/Select/Select';
import { Checkbox } from '../../ui/core/Checkbox/Checkbox';
import { Tooltip } from '../../ui/core/Tooltip/Tooltip';
import { Theme } from '../../../theme/themes';
import { 
  transitionStyles, 
  focusStyles, 
  generateId, 
  formatBytes, 
  debounce 
} from '../../ui/core/utils';

// Types and Interfaces
export type AlertSeverity = 'critical' | 'warning' | 'info' | 'success';
export type AlertCategory = 'system' | 'mission' | 'hardware' | 'communication' | 'safety';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'archived';
export type AlertPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface AlertData {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  priority: AlertPriority;
  status: AlertStatus;
  timestamp: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  source: string;
  tags: string[];
  metadata?: Record<string, any>;
  dismissible: boolean;
  autoDismissMs?: number;
  escalationRules?: EscalationRule[];
  relatedAlerts?: string[];
}

export interface EscalationRule {
  id: string;
  threshold: number; // minutes
  action: 'notify' | 'escalate' | 'forward';
  target: string;
  enabled: boolean;
}

export interface AlertFilter {
  severity?: AlertSeverity[];
  category?: AlertCategory[];
  status?: AlertStatus[];
  priority?: AlertPriority[];
  search?: string;
  dateRange?: [Date, Date];
  source?: string[];
  tags?: string[];
}

export interface UserRole {
  id: string;
  name: string;
  permissions: {
    viewAlerts: boolean;
    acknowledgeAlerts: boolean;
    resolveAlerts: boolean;
    deleteAlerts: boolean;
    exportAlerts: boolean;
    bulkActions: boolean;
    manageFilters: boolean;
  };
}

export interface AlertCenterProps {
  alerts: AlertData[];
  userRole: UserRole;
  isOpen: boolean;
  onClose: () => void;
  onAlertAcknowledge?: (alertId: string) => void;
  onAlertResolve?: (alertId: string, notes?: string) => void;
  onAlertDelete?: (alertId: string) => void;
  onBulkAcknowledge?: (alertIds: string[]) => void;
  onBulkResolve?: (alertIds: string[]) => void;
  onBulkDelete?: (alertIds: string[]) => void;
  onExport?: (alerts: AlertData[], format: 'json' | 'csv' | 'pdf') => void;
  onRealTimeToggle?: (enabled: boolean) => void;
  realTimeEnabled?: boolean;
  maxHistorySize?: number;
  className?: string;
  testId?: string;
}

export interface AlertCenterRef {
  addAlert: (alert: Omit<AlertData, 'id' | 'timestamp'>) => void;
  updateAlert: (alertId: string, updates: Partial<AlertData>) => void;
  removeAlert: (alertId: string) => void;
  clearAll: () => void;
  getActiveCount: () => number;
  exportAlerts: (format: 'json' | 'csv' | 'pdf') => void;
}

// Animation keyframes
const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
`;

// Styled Components
const AlertCenterOverlay = styled.div<{ theme: Theme; isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-left: 1px solid ${({ theme }) => theme.colors.divider};
  box-shadow: ${({ theme }) => theme.shadows.xl};
  z-index: ${({ theme }) => theme.zIndex?.modalBackdrop || 1000};
  display: flex;
  flex-direction: column;
  
  transform: ${({ isOpen }) => isOpen ? 'translateX(0)' : 'translateX(100%)'};
  ${({ theme }) => transitionStyles(theme, ['transform'])}
  
  animation: ${({ isOpen }) => isOpen ? slideInRight : 'none'} 
             ${({ theme }) => theme.transitions.duration.slow} 
             ${({ theme }) => theme.transitions.timing.ease};
  
  @media (max-width: 768px) {
    width: 100%;
    border-left: none;
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }
`;

const AlertCenterHeader = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[6]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.elevated};
`;

const AlertCenterTitle = styled.h2<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const AlertBadge = styled(Badge)<{ severity: AlertSeverity }>`
  ${({ severity }) => severity === 'critical' && css`
    animation: ${pulse} 2s infinite;
  `}
`;

const FilterSection = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.default};
`;

const FilterRow = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[3]};
  flex-wrap: wrap;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const BulkActionsBar = styled.div<{ 
  theme: Theme; 
  visible: boolean; 
  hasPermissions: boolean;
}>`
  display: ${({ visible, hasPermissions }) => visible && hasPermissions ? 'flex' : 'none'};
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.primary.main}10;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  gap: ${({ theme }) => theme.spacing[3]};
  
  animation: ${slideInRight} ${({ theme }) => theme.transitions.duration.base} ease;
`;

const AlertList = styled.div<{ theme: Theme }>`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  
  /* Custom scrollbar for better UX */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.colors.background.default};
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.divider};
    border-radius: ${({ theme }) => theme.borderRadius.full};
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: ${({ theme }) => theme.colors.text.secondary};
  }
`;

const AlertItem = styled.div<{ 
  theme: Theme; 
  severity: AlertSeverity;
  status: AlertStatus;
  isSelected: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  border-left: 4px solid ${({ theme, severity }) => {
    const severityColors = {
      critical: theme.colors.error.main,
      warning: theme.colors.warning.main,
      info: theme.colors.info.main,
      success: theme.colors.success.main,
    };
    return severityColors[severity];
  }};
  
  background-color: ${({ theme, status, isSelected }) => {
    if (isSelected) return `${theme.colors.primary.main}15`;
    if (status === 'active') return theme.colors.background.paper;
    return `${theme.colors.background.default}80`;
  }};
  
  opacity: ${({ status }) => status === 'archived' ? 0.6 : 1};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'opacity'])}
  
  &:hover {
    background-color: ${({ theme, isSelected }) => 
      isSelected 
        ? `${theme.colors.primary.main}25` 
        : `${theme.colors.background.default}60`
    };
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  ${({ severity, status }) => 
    severity === 'critical' && status === 'active' && css`
      animation: ${shake} 3s ease-in-out infinite;
      animation-delay: ${Math.random() * 2}s;
    `
  }
  
  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const AlertItemHeader = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`;

const AlertItemTitle = styled.h3<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  line-height: ${({ theme }) => theme.typography.lineHeight.tight};
`;

const AlertItemMeta = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-shrink: 0;
`;

const AlertItemMessage = styled.p<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[3]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const AlertItemFooter = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const AlertItemActions = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const AlertItemTimestamp = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.disabled};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const EmptyState = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[8]};
  text-align: center;
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const EmptyStateIcon = styled.div<{ theme: Theme }>`
  width: 64px;
  height: 64px;
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  opacity: 0.5;
  
  svg {
    width: 100%;
    height: 100%;
  }
`;

const SeverityIcon = styled.div<{ severity: AlertSeverity; theme: Theme }>`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.background.paper};
  font-size: 12px;
  font-weight: bold;
  
  background-color: ${({ theme, severity }) => {
    const severityColors = {
      critical: theme.colors.error.main,
      warning: theme.colors.warning.main,
      info: theme.colors.info.main,
      success: theme.colors.success.main,
    };
    return severityColors[severity];
  }};
`;

const CategoryTag = styled.span<{ theme: Theme; category: AlertCategory }>`
  padding: ${({ theme }) => `${theme.spacing[1]} ${theme.spacing[2]}`};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.5px;
  
  background-color: ${({ theme, category }) => {
    const categoryColors = {
      system: theme.colors.info.main,
      mission: theme.colors.primary.main,
      hardware: theme.colors.success.main,
      communication: theme.colors.warning.main,
      safety: theme.colors.error.main,
    };
    return `${categoryColors[category]}20`;
  }};
  
  color: ${({ theme, category }) => {
    const categoryColors = {
      system: theme.colors.info.dark,
      mission: theme.colors.primary.dark,
      hardware: theme.colors.success.dark,
      communication: theme.colors.warning.dark,
      safety: theme.colors.error.dark,
    };
    return categoryColors[category];
  }};
`;

const CloseButton = styled.button<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.secondary};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color'])}
  ${({ theme }) => focusStyles(theme)}
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.divider};
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

// Helper functions
const getSeverityIcon = (severity: AlertSeverity) => {
  const icons = {
    critical: '!',
    warning: '⚠',
    info: 'i',
    success: '✓',
  };
  return icons[severity];
};

const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
};

const exportToCSV = (alerts: AlertData[]): string => {
  const headers = [
    'ID', 'Title', 'Message', 'Severity', 'Category', 'Priority', 
    'Status', 'Timestamp', 'Source', 'Tags'
  ];
  
  const rows = alerts.map(alert => [
    alert.id,
    alert.title.replace(/"/g, '""'),
    alert.message.replace(/"/g, '""'),
    alert.severity,
    alert.category,
    alert.priority,
    alert.status,
    alert.timestamp.toISOString(),
    alert.source,
    alert.tags.join(';')
  ]);
  
  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
};

// Main Component
export const AlertCenter = forwardRef<AlertCenterRef, AlertCenterProps>(
  ({
    alerts,
    userRole,
    isOpen,
    onClose,
    onAlertAcknowledge,
    onAlertResolve,
    onAlertDelete,
    onBulkAcknowledge,
    onBulkResolve,
    onBulkDelete,
    onExport,
    onRealTimeToggle,
    realTimeEnabled = true,
    maxHistorySize = 1000,
    className,
    testId,
  }, ref) => {
    // State
    const [filter, setFilter] = useState<AlertFilter>({});
    const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'timestamp' | 'severity' | 'priority'>('timestamp');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [showResolved, setShowResolved] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Refs
    const searchInputRef = useRef<HTMLInputElement>(null);
    const alertListRef = useRef<HTMLDivElement>(null);
    
    // Generate component ID
    const componentId = useMemo(() => generateId('alert-center'), []);
    
    // Debounced search
    const debouncedSearch = useMemo(
      () => debounce((query: string) => {
        setFilter(prev => ({ ...prev, search: query || undefined }));
      }, 300),
      []
    );
    
    useEffect(() => {
      debouncedSearch(searchQuery);
    }, [searchQuery, debouncedSearch]);
    
    // Filter and sort alerts
    const filteredAlerts = useMemo(() => {
      let filtered = alerts.slice(0, maxHistorySize);
      
      // Status filter
      if (!showResolved) {
        filtered = filtered.filter(alert => alert.status !== 'resolved' && alert.status !== 'archived');
      }
      
      // Apply filters
      if (filter.severity?.length) {
        filtered = filtered.filter(alert => filter.severity!.includes(alert.severity));
      }
      
      if (filter.category?.length) {
        filtered = filtered.filter(alert => filter.category!.includes(alert.category));
      }
      
      if (filter.status?.length) {
        filtered = filtered.filter(alert => filter.status!.includes(alert.status));
      }
      
      if (filter.priority?.length) {
        filtered = filtered.filter(alert => filter.priority!.includes(alert.priority));
      }
      
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(alert => 
          alert.title.toLowerCase().includes(searchLower) ||
          alert.message.toLowerCase().includes(searchLower) ||
          alert.source.toLowerCase().includes(searchLower) ||
          alert.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      
      if (filter.source?.length) {
        filtered = filtered.filter(alert => filter.source!.includes(alert.source));
      }
      
      if (filter.tags?.length) {
        filtered = filtered.filter(alert => 
          filter.tags!.some(tag => alert.tags.includes(tag))
        );
      }
      
      if (filter.dateRange) {
        const [start, end] = filter.dateRange;
        filtered = filtered.filter(alert => 
          alert.timestamp >= start && alert.timestamp <= end
        );
      }
      
      // Sort
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (sortBy) {
          case 'timestamp':
            comparison = a.timestamp.getTime() - b.timestamp.getTime();
            break;
          case 'severity':
            const severityOrder = { critical: 0, warning: 1, info: 2, success: 3 };
            comparison = severityOrder[a.severity] - severityOrder[b.severity];
            break;
          case 'priority':
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
            break;
        }
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
      
      return filtered;
    }, [alerts, filter, showResolved, sortBy, sortOrder, maxHistorySize]);
    
    // Alert counts
    const alertCounts = useMemo(() => {
      const counts = { total: 0, active: 0, critical: 0, acknowledged: 0 };
      
      alerts.forEach(alert => {
        counts.total++;
        if (alert.status === 'active') {
          counts.active++;
          if (alert.severity === 'critical') counts.critical++;
        }
        if (alert.status === 'acknowledged') counts.acknowledged++;
      });
      
      return counts;
    }, [alerts]);
    
    // Event handlers
    const handleSelectAll = useCallback(() => {
      if (selectedAlerts.size === filteredAlerts.length) {
        setSelectedAlerts(new Set());
      } else {
        setSelectedAlerts(new Set(filteredAlerts.map(alert => alert.id)));
      }
    }, [selectedAlerts.size, filteredAlerts]);
    
    const handleSelectAlert = useCallback((alertId: string) => {
      setSelectedAlerts(prev => {
        const newSet = new Set(prev);
        if (newSet.has(alertId)) {
          newSet.delete(alertId);
        } else {
          newSet.add(alertId);
        }
        return newSet;
      });
    }, []);
    
    const handleBulkAcknowledge = useCallback(() => {
      if (selectedAlerts.size > 0 && onBulkAcknowledge) {
        onBulkAcknowledge(Array.from(selectedAlerts));
        setSelectedAlerts(new Set());
      }
    }, [selectedAlerts, onBulkAcknowledge]);
    
    const handleBulkResolve = useCallback(() => {
      if (selectedAlerts.size > 0 && onBulkResolve) {
        onBulkResolve(Array.from(selectedAlerts));
        setSelectedAlerts(new Set());
      }
    }, [selectedAlerts, onBulkResolve]);
    
    const handleBulkDelete = useCallback(() => {
      if (selectedAlerts.size > 0 && onBulkDelete) {
        onBulkDelete(Array.from(selectedAlerts));
        setSelectedAlerts(new Set());
      }
    }, [selectedAlerts, onBulkDelete]);
    
    const handleExport = useCallback(async (format: 'json' | 'csv' | 'pdf') => {
      setIsExporting(true);
      
      try {
        const alertsToExport = selectedAlerts.size > 0 
          ? filteredAlerts.filter(alert => selectedAlerts.has(alert.id))
          : filteredAlerts;
        
        if (onExport) {
          await onExport(alertsToExport, format);
        } else {
          // Default export handling
          if (format === 'csv') {
            const csvData = exportToCSV(alertsToExport);
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `alerts-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          } else if (format === 'json') {
            const jsonData = JSON.stringify(alertsToExport, null, 2);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `alerts-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }
        
        // Clear selection after export
        setSelectedAlerts(new Set());
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setIsExporting(false);
      }
    }, [filteredAlerts, selectedAlerts, onExport]);
    
    // Keyboard navigation
    useEffect(() => {
      if (!isOpen) return;
      
      const handleKeyDown = (e: KeyboardEvent) => {
        // Focus search on Ctrl+F or Cmd+F
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
        
        // Select all on Ctrl+A or Cmd+A
        if ((e.ctrlKey || e.metaKey) && e.key === 'a' && userRole.permissions.bulkActions) {
          e.preventDefault();
          handleSelectAll();
        }
        
        // Close on Escape
        if (e.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleSelectAll, onClose, userRole.permissions.bulkActions]);
    
    // Auto-dismiss alerts
    useEffect(() => {
      const timers: NodeJS.Timeout[] = [];
      
      alerts.forEach(alert => {
        if (alert.autoDismissMs && alert.status === 'active') {
          const timer = setTimeout(() => {
            if (onAlertAcknowledge) {
              onAlertAcknowledge(alert.id);
            }
          }, alert.autoDismissMs);
          timers.push(timer);
        }
      });
      
      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }, [alerts, onAlertAcknowledge]);
    
    // Imperative handle for ref
    useImperativeHandle(ref, () => ({
      addAlert: (alertData) => {
        // This would typically be handled by parent component
        console.log('Adding alert:', alertData);
      },
      updateAlert: (alertId, updates) => {
        // This would typically be handled by parent component
        console.log('Updating alert:', alertId, updates);
      },
      removeAlert: (alertId) => {
        if (onAlertDelete) {
          onAlertDelete(alertId);
        }
      },
      clearAll: () => {
        const allIds = alerts.map(alert => alert.id);
        if (onBulkDelete) {
          onBulkDelete(allIds);
        }
      },
      getActiveCount: () => alertCounts.active,
      exportAlerts: (format) => {
        handleExport(format);
      }
    }), [alerts, alertCounts.active, onAlertDelete, onBulkDelete, handleExport]);
    
    if (!isOpen) return null;
    
    return (
      <AlertCenterOverlay
        isOpen={isOpen}
        className={className}
        data-testid={testId}
        role="dialog"
        aria-labelledby={`${componentId}-title`}
        aria-modal="true"
      >
        {/* Header */}
        <AlertCenterHeader>
          <AlertCenterTitle id={`${componentId}-title`}>
            <span>Alert Center</span>
            {alertCounts.active > 0 && (
              <AlertBadge 
                variant="error" 
                severity={alertCounts.critical > 0 ? 'critical' : 'warning'}
              >
                {alertCounts.active}
              </AlertBadge>
            )}
          </AlertCenterTitle>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onRealTimeToggle && (
              <Tooltip content={`${realTimeEnabled ? 'Disable' : 'Enable'} real-time updates`}>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => onRealTimeToggle(!realTimeEnabled)}
                  aria-label={`${realTimeEnabled ? 'Disable' : 'Enable'} real-time updates`}
                >
                  {realTimeEnabled ? '⏸' : '▶'}
                </Button>
              </Tooltip>
            )}
            
            <CloseButton
              onClick={onClose}
              aria-label="Close alert center"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </CloseButton>
          </div>
        </AlertCenterHeader>
        
        {/* Filters */}
        <FilterSection>
          <FilterRow>
            <Input
              ref={searchInputRef}
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M10.5 3.5a6 6 0 11-12 0 6 6 0 0112 0zm-1.06 6.94a7 7 0 111.414-1.414l3.296 3.296a1 1 0 01-1.414 1.414l-3.296-3.296z" clipRule="evenodd" />
                </svg>
              }
              clearable
              onClear={() => setSearchQuery('')}
              aria-label="Search alerts"
            />
            
            <Select
              placeholder="Severity"
              options={[
                { value: 'critical', label: 'Critical' },
                { value: 'warning', label: 'Warning' },
                { value: 'info', label: 'Info' },
                { value: 'success', label: 'Success' },
              ]}
              multiple
              value={filter.severity || []}
              onChange={(value) => setFilter(prev => ({ 
                ...prev, 
                severity: value as AlertSeverity[] 
              }))}
              aria-label="Filter by severity"
            />
            
            <Select
              placeholder="Category"
              options={[
                { value: 'system', label: 'System' },
                { value: 'mission', label: 'Mission' },
                { value: 'hardware', label: 'Hardware' },
                { value: 'communication', label: 'Communication' },
                { value: 'safety', label: 'Safety' },
              ]}
              multiple
              value={filter.category || []}
              onChange={(value) => setFilter(prev => ({ 
                ...prev, 
                category: value as AlertCategory[] 
              }))}
              aria-label="Filter by category"
            />
          </FilterRow>
          
          <FilterRow>
            <Select
              placeholder="Sort by"
              options={[
                { value: 'timestamp', label: 'Time' },
                { value: 'severity', label: 'Severity' },
                { value: 'priority', label: 'Priority' },
              ]}
              value={sortBy}
              onChange={(value) => setSortBy(value as typeof sortBy)}
              aria-label="Sort alerts by"
            />
            
            <Button
              variant="ghost"
              size="small"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
            
            <Checkbox
              label="Show resolved"
              checked={showResolved}
              onChange={(checked) => setShowResolved(checked)}
            />
          </FilterRow>
        </FilterSection>
        
        {/* Bulk Actions */}
        <BulkActionsBar 
          visible={selectedAlerts.size > 0} 
          hasPermissions={userRole.permissions.bulkActions}
        >
          <span>{selectedAlerts.size} selected</span>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {userRole.permissions.acknowledgeAlerts && (
              <Button 
                variant="ghost" 
                size="small" 
                onClick={handleBulkAcknowledge}
                disabled={!onBulkAcknowledge}
              >
                Acknowledge
              </Button>
            )}
            
            {userRole.permissions.resolveAlerts && (
              <Button 
                variant="ghost" 
                size="small" 
                onClick={handleBulkResolve}
                disabled={!onBulkResolve}
              >
                Resolve
              </Button>
            )}
            
            {userRole.permissions.exportAlerts && (
              <Button 
                variant="ghost" 
                size="small" 
                onClick={() => handleExport('csv')}
                loading={isExporting}
                disabled={!onExport}
              >
                Export
              </Button>
            )}
            
            {userRole.permissions.deleteAlerts && (
              <Button 
                variant="danger" 
                size="small" 
                onClick={handleBulkDelete}
                disabled={!onBulkDelete}
              >
                Delete
              </Button>
            )}
          </div>
        </BulkActionsBar>
        
        {/* Alert List */}
        <AlertList ref={alertListRef}>
          {filteredAlerts.length === 0 ? (
            <EmptyState>
              <EmptyStateIcon>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </EmptyStateIcon>
              <h3>No alerts found</h3>
              <p>
                {alerts.length === 0 
                  ? "All systems operating normally"
                  : "No alerts match your current filters"
                }
              </p>
            </EmptyState>
          ) : (
            filteredAlerts.map(alert => (
              <AlertItem
                key={alert.id}
                severity={alert.severity}
                status={alert.status}
                isSelected={selectedAlerts.has(alert.id)}
              >
                <AlertItemHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    {userRole.permissions.bulkActions && (
                      <Checkbox
                        checked={selectedAlerts.has(alert.id)}
                        onChange={() => handleSelectAlert(alert.id)}
                        aria-label={`Select alert: ${alert.title}`}
                      />
                    )}
                    
                    <SeverityIcon severity={alert.severity}>
                      {getSeverityIcon(alert.severity)}
                    </SeverityIcon>
                    
                    <AlertItemTitle>
                      {alert.title}
                    </AlertItemTitle>
                  </div>
                  
                  <AlertItemMeta>
                    <CategoryTag category={alert.category}>
                      {alert.category}
                    </CategoryTag>
                    
                    <Badge 
                      variant={
                        alert.priority === 'urgent' ? 'error' :
                        alert.priority === 'high' ? 'warning' :
                        alert.priority === 'medium' ? 'info' : 'neutral'
                      }
                      size="small"
                    >
                      {alert.priority}
                    </Badge>
                  </AlertItemMeta>
                </AlertItemHeader>
                
                <AlertItemMessage>
                  {alert.message}
                </AlertItemMessage>
                
                <AlertItemFooter>
                  <AlertItemTimestamp>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path fillRule="evenodd" d="M6 12A6 6 0 106 0a6 6 0 000 12zM6.5 3a.5.5 0 00-1 0v3a.5.5 0 00.146.354l2 2a.5.5 0 00.708-.708L6.5 5.793V3z" clipRule="evenodd" />
                    </svg>
                    {formatRelativeTime(alert.timestamp)}
                    {alert.acknowledgedAt && (
                      <span> • Ack by {alert.acknowledgedBy}</span>
                    )}
                    {alert.resolvedAt && (
                      <span> • Resolved by {alert.resolvedBy}</span>
                    )}
                  </AlertItemTimestamp>
                  
                  <AlertItemActions>
                    {alert.status === 'active' && userRole.permissions.acknowledgeAlerts && onAlertAcknowledge && (
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => onAlertAcknowledge(alert.id)}
                        aria-label={`Acknowledge alert: ${alert.title}`}
                      >
                        Ack
                      </Button>
                    )}
                    
                    {alert.status !== 'resolved' && userRole.permissions.resolveAlerts && onAlertResolve && (
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => onAlertResolve(alert.id)}
                        aria-label={`Resolve alert: ${alert.title}`}
                      >
                        Resolve
                      </Button>
                    )}
                    
                    {alert.dismissible && userRole.permissions.deleteAlerts && onAlertDelete && (
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => onAlertDelete(alert.id)}
                        aria-label={`Delete alert: ${alert.title}`}
                      >
                        ×
                      </Button>
                    )}
                  </AlertItemActions>
                </AlertItemFooter>
              </AlertItem>
            ))
          )}
        </AlertList>
      </AlertCenterOverlay>
    );
  }
);

AlertCenter.displayName = 'AlertCenter';

export default AlertCenter;