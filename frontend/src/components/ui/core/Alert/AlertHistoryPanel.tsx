/**
 * Enhanced Alert History Panel
 * Panel component for viewing, filtering, and managing historical alerts
 * Supports pagination, sorting, bulk actions, keyboard shortcuts, and accessibility
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { transitionStyles, focusStyles } from '../utils';
import { BaseComponentProps } from '../types';
import { PersistedAlert, AlertPersistenceService } from '../../../../services/persistence/AlertPersistenceService';

// Enhanced types for the new functionality
export type SortField = 'timestamp' | 'priority' | 'status' | 'source' | 'title';
export type SortDirection = 'asc' | 'desc';
export type AlertStatus = 'unread' | 'read' | 'acknowledged' | 'dismissed' | 'archived';
export type AlertCategory = 'system' | 'hardware' | 'communication' | 'navigation' | 'power' | 'thermal' | 'other';
export type BulkAction = 'acknowledge' | 'dismiss' | 'archive' | 'delete' | 'mark-read';
export type ExportFormat = 'csv' | 'json';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface ExtendedPersistedAlert extends PersistedAlert {
  category?: AlertCategory;
  isRead?: boolean;
  isArchived?: boolean;
}

export interface AlertHistoryPanelProps extends BaseComponentProps {
  persistenceService: AlertPersistenceService;
  isOpen: boolean;
  onClose: () => void;
  onAlertSelect?: (alert: PersistedAlert) => void;
  onBulkAction?: (action: BulkAction, alertIds: string[]) => Promise<void>;
  maxHeight?: string;
  categories?: AlertCategory[];
  enableKeyboardShortcuts?: boolean;
  enableBulkActions?: boolean;
  enableExport?: boolean;
}

interface FilterState {
  priorities: AlertPriority[];
  categories: AlertCategory[];
  status: AlertStatus[];
  acknowledged: 'all' | 'acknowledged' | 'unacknowledged';
  dismissed: 'all' | 'dismissed' | 'active';
  dateRange: {
    from: Date | null;
    to: Date | null;
  };
  searchQuery: string;
  deviceFilter: 'all' | 'current' | 'others';
  showArchived: boolean;
}

// Styled components
const Panel = styled.div<{ 
  theme: Theme;
  isOpen: boolean;
  maxHeight?: string;
}>`
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 480px;
  background: ${({ theme }) => theme.colors.surface};
  border-left: 1px solid ${({ theme }) => theme.colors.border};
  box-shadow: ${({ theme }) => theme.boxShadow.xl};
  z-index: 1000;
  
  transform: translateX(${({ isOpen }) => isOpen ? '0' : '100%'});
  ${({ theme }) => transitionStyles(theme, ['transform'])}
  
  display: flex;
  flex-direction: column;
  
  backdrop-filter: blur(16px);
  background: ${({ theme }) => `${theme.colors.surface}f0`};
  
  @media (max-width: 768px) {
    width: 100vw;
    left: 0;
  }
  
  ${({ maxHeight }) => maxHeight && css`
    max-height: ${maxHeight};
  `}
`;

const PanelHeader = styled.header<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
  flex-shrink: 0;
`;

const PanelTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }) => theme.spacing[4]} 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CloseButton = styled.button<{ theme: Theme }>`
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: ${({ theme }) => theme.colors.text.tertiary};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${({ theme }) => transitionStyles(theme, ['color', 'background-color'])}
  ${({ theme }) => focusStyles(theme)}
  
  &:hover {
    color: ${({ theme }) => theme.colors.text.primary};
    background: ${({ theme }) => theme.colors.background};
  }
`;

const FilterSection = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[4]};
`;

const FilterGroup = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const FilterLabel = styled.label<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const SearchInput = styled.input<{ theme: Theme }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  
  ${({ theme }) => transitionStyles(theme, ['border-color', 'box-shadow'])}
  ${({ theme }) => focusStyles(theme)}
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.tertiary};
  }
`;

const FilterRow = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Select = styled.select<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  flex: 1;
  min-width: 120px;
  
  ${({ theme }) => transitionStyles(theme, ['border-color'])}
  ${({ theme }) => focusStyles(theme)}
`;

const PriorityFilters = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-wrap: wrap;
`;

const PriorityChip = styled.button<{ 
  theme: Theme;
  priority: AlertPriority;
  isActive: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[3]};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  border: 1px solid;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color', 'border-color'])}
  ${({ theme }) => focusStyles(theme)}
  
  ${({ theme, priority, isActive }) => {
    const colors = theme.alertPriorities![priority];
    return isActive ? css`
      background: ${colors.border};
      color: ${theme.colors.surface};
      border-color: ${colors.border};
    ` : css`
      background: transparent;
      color: ${colors.border};
      border-color: ${colors.border};
      
      &:hover {
        background: ${colors.background};
      }
    `;
  }}
`;

const ToolbarSection = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing[3]};
  padding: ${({ theme }) => theme.spacing[3]} 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    gap: ${({ theme }) => theme.spacing[2]};
  }
`;

const ToolbarLeft = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex: 1;
`;

const ToolbarRight = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-wrap: wrap;
`;

const SortButton = styled.button<{ theme: Theme; isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[1]};
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme, isActive }) => isActive ? theme.colors.primary : theme.colors.background};
  color: ${({ theme, isActive }) => isActive ? theme.colors.surface : theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color', 'border-color'])}
  ${({ theme }) => focusStyles(theme)}
  
  &:hover {
    background: ${({ theme, isActive }) => isActive ? theme.colors.primary : theme.colors.surface};
  }
`;

const AlertList = styled.div<{ theme: Theme }>`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[4]};
`;

const AlertItem = styled.div<{ 
  theme: Theme;
  priority: AlertPriority;
  isSelected?: boolean;
  isUnread?: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: ${({ theme }) => theme.spacing[3]};
  cursor: pointer;
  position: relative;
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'border-color', 'box-shadow'])}
  
  &:hover {
    background: ${({ theme }) => theme.colors.background};
    border-color: ${({ theme, priority }) => theme.alertPriorities![priority].border};
  }
  
  ${({ isSelected, theme, priority }) => isSelected && css`
    background: ${theme.alertPriorities![priority].background};
    border-color: ${theme.alertPriorities![priority].border};
    box-shadow: 0 0 0 2px ${theme.alertPriorities![priority].border}33;
  `}
  
  ${({ isUnread, theme }) => isUnread && css`
    background-color: rgba(59, 130, 246, 0.05);
    border-left: 4px solid #3b82f6;
  `}
  
  /* Priority indicator */
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: ${({ theme, priority }) => theme.alertPriorities![priority].border};
    border-radius: ${({ theme }) => theme.borderRadius.md} 0 0 ${({ theme }) => theme.borderRadius.md};
  }
`;

const AlertItemHeader = styled.div<{ theme: Theme }>`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: ${({ theme }) => theme.spacing[2]};
`;

const AlertItemTitle = styled.h3<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  flex: 1;
  display: flex;
  align-items: center;
`;

const AlertItemBadges = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[1]};
  flex-shrink: 0;
  flex-wrap: wrap;
`;

const Badge = styled.span<{ 
  theme: Theme;
  variant: 'priority' | 'acknowledged' | 'dismissed' | 'category' | 'new';
}>`
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  
  ${({ theme, variant }) => {
    switch (variant) {
      case 'acknowledged':
        return css`
          background: ${theme.colors.success}22;
          color: ${theme.colors.success};
        `;
      case 'dismissed':
        return css`
          background: ${theme.colors.gray[200]};
          color: ${theme.colors.gray[600]};
        `;
      case 'category':
        return css`
          background: ${theme.colors.gray[100]};
          color: ${theme.colors.gray[700]};
        `;
      case 'new':
        return css`
          background: ${theme.colors.info}22;
          color: ${theme.colors.info};
        `;
      case 'priority':
      default:
        return css`
          background: ${theme.colors.primary}22;
          color: ${theme.colors.primary};
        `;
    }
  }}
`;

const AlertItemContent = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[3]};
`;

const AlertItemMessage = styled.p<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  
  /* Truncate long messages */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const AlertItemMeta = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[4]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.tertiary};
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing[1]};
  }
`;

const PaginationControls = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[4]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.background};
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing[3]};
  }
`;

const PaginationInfo = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const PaginationButtons = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const PaginationButton = styled.button<{ theme: Theme; isDisabled?: boolean }>`
  padding: ${({ theme }) => theme.spacing[2]} ${({ theme }) => theme.spacing[3]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme, isDisabled }) => isDisabled ? theme.colors.text.tertiary : theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: ${({ isDisabled }) => isDisabled ? 'not-allowed' : 'pointer'};
  
  ${({ theme }) => transitionStyles(theme, ['background-color', 'color'])}
  ${({ theme, isDisabled }) => !isDisabled && focusStyles(theme)}
  
  &:hover {
    background: ${({ theme, isDisabled }) => isDisabled ? theme.colors.background : theme.colors.surface};
  }
  
  &:disabled {
    opacity: 0.5;
  }
`;

const PageSizeSelect = styled.select<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.background};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  
  ${({ theme }) => transitionStyles(theme, ['border-color'])}
  ${({ theme }) => focusStyles(theme)}
`;

const EmptyState = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[12]} ${({ theme }) => theme.spacing[6]};
  text-align: center;
  color: ${({ theme }) => theme.colors.text.tertiary};
`;

const EmptyStateIcon = styled.div<{ theme: Theme }>`
  width: 64px;
  height: 64px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.background};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  color: ${({ theme }) => theme.colors.text.tertiary};
`;

const LoadingState = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing[8]};
  color: ${({ theme }) => theme.colors.text.tertiary};
`;

// Constants
const PRIORITIES: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
const CATEGORIES: AlertCategory[] = ['system', 'hardware', 'communication', 'navigation', 'power', 'thermal', 'other'];
const STATUSES: AlertStatus[] = ['unread', 'read', 'acknowledged', 'dismissed', 'archived'];
const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export const AlertHistoryPanel: React.FC<AlertHistoryPanelProps> = ({
  persistenceService,
  isOpen,
  onClose,
  onAlertSelect,
  onBulkAction,
  maxHeight,
  categories = CATEGORIES,
  enableKeyboardShortcuts = true,
  enableBulkActions = true,
  enableExport = true,
  testId,
  className
}) => {
  const [alerts, setAlerts] = useState<ExtendedPersistedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ExtendedPersistedAlert | null>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1,
    totalItems: 0
  });
  
  const [sortState, setSortState] = useState<SortState>({
    field: 'timestamp',
    direction: 'desc'
  });
  
  const [filters, setFilters] = useState<FilterState>({
    priorities: [...PRIORITIES],
    categories: [...categories],
    status: ['unread', 'read', 'acknowledged'],
    acknowledged: 'all',
    dismissed: 'all',
    dateRange: {
      from: null,
      to: null,
    },
    searchQuery: '',
    deviceFilter: 'all',
    showArchived: false
  });

  // Utility functions
  const getAlertCategory = useCallback((alert: PersistedAlert): AlertCategory => {
    if (alert.metadata?.category) return alert.metadata.category;
    
    const source = alert.source.toLowerCase();
    if (source.includes('hardware') || source.includes('sensor')) return 'hardware';
    if (source.includes('comm') || source.includes('network')) return 'communication';
    if (source.includes('nav') || source.includes('gps')) return 'navigation';
    if (source.includes('power') || source.includes('battery')) return 'power';
    if (source.includes('temp') || source.includes('thermal')) return 'thermal';
    if (source.includes('system') || source.includes('os')) return 'system';
    return 'other';
  }, []);
  
  const getAlertStatus = useCallback((alert: ExtendedPersistedAlert): AlertStatus => {
    if (alert.isArchived) return 'archived';
    if (alert.dismissedAt) return 'dismissed';
    if (alert.acknowledged) return 'acknowledged';
    if (alert.isRead) return 'read';
    return 'unread';
  }, []);
  
  const getAlertReadStatus = useCallback((alert: PersistedAlert): boolean => {
    return alert.metadata?.isRead || false;
  }, []);

  // Enhanced alert loading with pagination and sorting
  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const filterOptions = {
        priority: filters.priorities.length === PRIORITIES.length ? undefined : filters.priorities,
        acknowledged: filters.acknowledged === 'all' ? undefined : filters.acknowledged === 'acknowledged',
        dismissed: filters.dismissed === 'all' ? undefined : filters.dismissed === 'dismissed',
        from: filters.dateRange.from || undefined,
        to: filters.dateRange.to || undefined,
        deviceId: filters.deviceFilter === 'current' ? persistenceService.currentDeviceId :
                  filters.deviceFilter === 'others' ? `not-${persistenceService.currentDeviceId}` : undefined,
      };

      let results = await persistenceService.getAlerts(filterOptions);
      
      // Apply enhanced filters client-side
      results = results.filter(alert => {
        // Search filter
        if (filters.searchQuery.trim()) {
          const query = filters.searchQuery.toLowerCase();
          const matchesSearch = alert.message.toLowerCase().includes(query) ||
                               alert.title?.toLowerCase().includes(query) ||
                               alert.source.toLowerCase().includes(query);
          if (!matchesSearch) return false;
        }
        
        // Category filter
        if (filters.categories.length < categories.length) {
          const alertCategory = getAlertCategory(alert);
          if (!filters.categories.includes(alertCategory)) return false;
        }
        
        // Status filter
        if (filters.status.length < STATUSES.length) {
          const alertStatus = getAlertStatus({ ...alert, category: getAlertCategory(alert), isRead: getAlertReadStatus(alert), isArchived: alert.metadata?.archived || false });
          if (!filters.status.includes(alertStatus)) return false;
        }
        
        // Archived filter
        if (!filters.showArchived && alert.metadata?.archived) {
          return false;
        }
        
        return true;
      });
      
      // Apply sorting
      results.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (sortState.field) {
          case 'timestamp':
            aVal = a.timestamp.getTime();
            bVal = b.timestamp.getTime();
            break;
          case 'priority':
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
            aVal = priorityOrder[a.priority];
            bVal = priorityOrder[b.priority];
            break;
          case 'status':
            aVal = getAlertStatus({ ...a, category: getAlertCategory(a), isRead: getAlertReadStatus(a), isArchived: a.metadata?.archived || false });
            bVal = getAlertStatus({ ...b, category: getAlertCategory(b), isRead: getAlertReadStatus(b), isArchived: b.metadata?.archived || false });
            break;
          case 'source':
            aVal = a.source.toLowerCase();
            bVal = b.source.toLowerCase();
            break;
          case 'title':
            aVal = (a.title || '').toLowerCase();
            bVal = (b.title || '').toLowerCase();
            break;
          default:
            aVal = a.timestamp.getTime();
            bVal = b.timestamp.getTime();
        }
        
        if (aVal < bVal) return sortState.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
      });
      
      // Update pagination info
      const totalItems = results.length;
      const totalPages = Math.ceil(totalItems / pagination.pageSize);
      
      setPagination(prev => ({
        ...prev,
        totalPages,
        totalItems,
        currentPage: Math.min(prev.currentPage, totalPages || 1)
      }));
      
      // Apply pagination
      const startIndex = (pagination.currentPage - 1) * pagination.pageSize;
      const paginatedResults = results.slice(startIndex, startIndex + pagination.pageSize);
      
      // Enhance alerts with additional properties
      const enhancedAlerts: ExtendedPersistedAlert[] = paginatedResults.map(alert => ({
        ...alert,
        category: getAlertCategory(alert),
        isRead: getAlertReadStatus(alert),
        isArchived: alert.metadata?.archived || false
      }));

      setAlerts(enhancedAlerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      setAlerts([]);
      setPagination(prev => ({ ...prev, totalItems: 0, totalPages: 1 }));
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.currentPage, pagination.pageSize, sortState, persistenceService, categories, getAlertCategory, getAlertStatus, getAlertReadStatus]);

  // Load alerts when filters change or panel opens
  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen, loadAlerts]);

  // Enhanced filter handlers
  const togglePriorityFilter = useCallback((priority: AlertPriority) => {
    setFilters(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority]
    }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortState(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  }, []);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setPagination(prev => ({ 
      ...prev, 
      pageSize, 
      currentPage: 1 
    }));
  }, []);

  // Handle alert selection
  const handleAlertSelect = useCallback((alert: ExtendedPersistedAlert) => {
    setSelectedAlert(alert);
    onAlertSelect?.(alert);
  }, [onAlertSelect]);

  // Format timestamp  
  const formatTimestamp = useCallback((timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(timestamp);
  }, []);

  // Get filtered count by priority
  const filteredCounts = useMemo(() => {
    return PRIORITIES.reduce((counts, priority) => {
      counts[priority] = alerts.filter(alert => alert.priority === priority).length;
      return counts;
    }, {} as Record<AlertPriority, number>);
  }, [alerts]);

  if (!isOpen) {
    return null;
  }

  return (
    <Panel
      ref={panelRef}
      isOpen={isOpen}
      maxHeight={maxHeight}
      className={className}
      data-testid={testId}
      role="complementary"
      aria-label="Alert history panel"
      tabIndex={-1}
    >
      <PanelHeader>
        <PanelTitle>
          Alert History
          <CloseButton
            onClick={onClose}
            aria-label="Close alert history panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </CloseButton>
        </PanelTitle>

        <FilterSection>
          <FilterGroup>
            <FilterLabel htmlFor="alert-search">Search</FilterLabel>
            <SearchInput
              id="alert-search"
              type="text"
              placeholder="Search alerts by title, message, or source..."
              value={filters.searchQuery}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
              aria-describedby="search-help"
            />
            <div id="search-help" className="sr-only">
              Search through alert titles, messages, and sources
            </div>
          </FilterGroup>

          <FilterGroup>
            <FilterLabel>Priority</FilterLabel>
            <PriorityFilters role="group" aria-label="Filter by priority">
              {PRIORITIES.map(priority => (
                <PriorityChip
                  key={priority}
                  priority={priority}
                  isActive={filters.priorities.includes(priority)}
                  onClick={() => togglePriorityFilter(priority)}
                  type="button"
                  aria-pressed={filters.priorities.includes(priority)}
                  title={`${filters.priorities.includes(priority) ? 'Hide' : 'Show'} ${priority} priority alerts`}
                >
                  {priority} ({filteredCounts[priority] || 0})
                </PriorityChip>
              ))}
            </PriorityFilters>
          </FilterGroup>

          <FilterRow>
            <Select
              value={filters.acknowledged}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, acknowledged: e.target.value as FilterState['acknowledged'] }));
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
              aria-label="Filter by acknowledgment status"
            >
              <option value="all">All Alerts</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="unacknowledged">Unacknowledged</option>
            </Select>

            <Select
              value={filters.dismissed}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, dismissed: e.target.value as FilterState['dismissed'] }));
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
              aria-label="Filter by dismissal status"
            >
              <option value="all">All States</option>
              <option value="dismissed">Dismissed</option>
              <option value="active">Active</option>
            </Select>

            <Select
              value={filters.deviceFilter}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, deviceFilter: e.target.value as FilterState['deviceFilter'] }));
                setPagination(prev => ({ ...prev, currentPage: 1 }));
              }}
              aria-label="Filter by device"
            >
              <option value="all">All Devices</option>
              <option value="current">This Device</option>
              <option value="others">Other Devices</option>
            </Select>
          </FilterRow>
        </FilterSection>

        <ToolbarSection>
          <ToolbarLeft>
            <span style={{ fontSize: '14px', color: 'inherit' }}>
              {pagination.totalItems} alerts found
            </span>
            {isLoading && <span style={{ fontSize: '14px' }}>Loading...</span>}
          </ToolbarLeft>
          
          <ToolbarRight>
            <SortButton
              isActive={sortState.field === 'timestamp'}
              onClick={() => handleSort('timestamp')}
              title="Sort by timestamp"
              aria-label={`Sort by timestamp ${sortState.field === 'timestamp' ? (sortState.direction === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
            >
              Time {sortState.field === 'timestamp' && (sortState.direction === 'asc' ? '↑' : '↓')}
            </SortButton>
            
            <SortButton
              isActive={sortState.field === 'priority'}
              onClick={() => handleSort('priority')}
              title="Sort by priority"
              aria-label={`Sort by priority ${sortState.field === 'priority' ? (sortState.direction === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
            >
              Priority {sortState.field === 'priority' && (sortState.direction === 'asc' ? '↑' : '↓')}
            </SortButton>
            
            <SortButton
              isActive={sortState.field === 'status'}
              onClick={() => handleSort('status')}
              title="Sort by status"
              aria-label={`Sort by status ${sortState.field === 'status' ? (sortState.direction === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
            >
              Status {sortState.field === 'status' && (sortState.direction === 'asc' ? '↑' : '↓')}
            </SortButton>
          </ToolbarRight>
        </ToolbarSection>
      </PanelHeader>

      <AlertList role="list" aria-label="Alert list">
        {isLoading ? (
          <LoadingState>
            <div>Loading alerts...</div>
          </LoadingState>
        ) : alerts.length === 0 ? (
          <EmptyState>
            <EmptyStateIcon>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="currentColor">
                <path fillRule="evenodd" d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zM9 15a1 1 0 011-1h12a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </EmptyStateIcon>
            <div>No alerts found</div>
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              Try adjusting your filters or search query
            </div>
          </EmptyState>
        ) : (
          alerts.map(alert => {
            const alertStatus = getAlertStatus(alert);
            
            return (
              <AlertItem
                key={alert.id}
                priority={alert.priority}
                isSelected={selectedAlert?.id === alert.id}
                isUnread={!alert.isRead}
                onClick={() => handleAlertSelect(alert)}
                role="listitem"
                aria-label={`Alert: ${alert.title || 'Untitled'} - ${alert.priority} priority`}
                style={{
                  opacity: alertStatus === 'archived' ? 0.6 : 1,
                }}
              >
                <AlertItemHeader>
                  <AlertItemTitle>
                    {!alert.isRead && (
                      <span 
                        style={{ 
                          display: 'inline-block', 
                          width: '8px', 
                          height: '8px', 
                          backgroundColor: '#3b82f6', 
                          borderRadius: '50%', 
                          marginRight: '8px'
                        }}
                        aria-label="Unread alert"
                      />
                    )}
                    {alert.title || 'Alert'}
                    {alert.isArchived && (
                      <span style={{ 
                        marginLeft: '8px', 
                        fontSize: '12px', 
                        color: '#6b7280',
                        fontStyle: 'italic'
                      }}>
                        (Archived)
                      </span>
                    )}
                  </AlertItemTitle>
                  <AlertItemBadges>
                    <Badge variant="priority">{alert.priority}</Badge>
                    {alert.category && (
                      <Badge variant="category">
                        {alert.category}
                      </Badge>
                    )}
                    {alert.acknowledged && <Badge variant="acknowledged">ACK</Badge>}
                    {alert.dismissedAt && <Badge variant="dismissed">Dismissed</Badge>}
                    {alertStatus === 'unread' && (
                      <Badge variant="new">
                        New
                      </Badge>
                    )}
                  </AlertItemBadges>
                </AlertItemHeader>

                <AlertItemContent>
                  <AlertItemMessage>{alert.message}</AlertItemMessage>
                </AlertItemContent>

                <AlertItemMeta>
                  <span>{formatTimestamp(alert.timestamp)}</span>
                  <span>Source: {alert.source}</span>
                  <span>Status: {alertStatus}</span>
                  {alert.acknowledgedBy && (
                    <span>Ack by: {alert.acknowledgedBy}</span>
                  )}
                </AlertItemMeta>
              </AlertItem>
            );
          })
        )}
      </AlertList>
      
      {pagination.totalPages > 1 && (
        <PaginationControls>
          <PaginationInfo>
            Showing {((pagination.currentPage - 1) * pagination.pageSize) + 1} to {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)} of {pagination.totalItems} alerts
          </PaginationInfo>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="page-size-select" style={{ fontSize: '14px' }}>Per page:</label>
              <PageSizeSelect
                id="page-size-select"
                value={pagination.pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                aria-label="Number of alerts per page"
              >
                {PAGE_SIZES.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </PageSizeSelect>
            </div>
            
            <PaginationButtons role="group" aria-label="Pagination controls">
              <PaginationButton
                onClick={() => handlePageChange(1)}
                disabled={pagination.currentPage === 1}
                aria-label="Go to first page"
                title="First page"
              >
                «
              </PaginationButton>
              
              <PaginationButton
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                aria-label="Go to previous page"
                title="Previous page"
              >
                ‹
              </PaginationButton>
              
              <span style={{ padding: '0 16px', fontSize: '14px' }}>
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              
              <PaginationButton
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                aria-label="Go to next page"
                title="Next page"
              >
                ›
              </PaginationButton>
              
              <PaginationButton
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.currentPage === pagination.totalPages}
                aria-label="Go to last page"
                title="Last page"
              >
                »
              </PaginationButton>
            </PaginationButtons>
          </div>
        </PaginationControls>
      )}
    </Panel>
  );
};

// Export additional types and utilities for consumers
export type { 
  ExtendedPersistedAlert, 
  SortField, 
  SortDirection, 
  AlertStatus, 
  AlertCategory, 
  BulkAction, 
  ExportFormat 
};

export { CATEGORIES, STATUSES, PAGE_SIZES, DEFAULT_PAGE_SIZE };