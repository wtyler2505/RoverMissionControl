/**
 * VirtualizedAlertHistoryPanel
 * High-performance virtualized version of AlertHistoryPanel
 * Optimized for handling thousands of alerts with smooth scrolling
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../theme/themes';
import { AlertPriority } from '../../../../theme/alertPriorities';
import { transitionStyles, focusStyles } from '../utils';
import { BaseComponentProps } from '../types';
import { PersistedAlert, AlertPersistenceService } from '../../../../services/persistence/AlertPersistenceService';
import VirtualizedList, { VirtualizedListItem, VirtualizedListRef } from '../../../virtualization/VirtualizedList';

// Enhanced types for virtualized alerts
export type SortField = 'timestamp' | 'priority' | 'status' | 'source' | 'title';
export type SortDirection = 'asc' | 'desc';
export type AlertStatus = 'unread' | 'read' | 'acknowledged' | 'dismissed' | 'archived';
export type AlertCategory = 'system' | 'hardware' | 'communication' | 'navigation' | 'power' | 'thermal' | 'other';

interface VirtualizedAlertItem extends VirtualizedListItem {
  alert: ExtendedPersistedAlert;
  height: number;
}

interface ExtendedPersistedAlert extends PersistedAlert {
  category?: AlertCategory;
  isRead?: boolean;
  isArchived?: boolean;
}

export interface VirtualizedAlertHistoryPanelProps extends BaseComponentProps {
  persistenceService: AlertPersistenceService;
  isOpen: boolean;
  onClose: () => void;
  onAlertSelect?: (alert: PersistedAlert) => void;
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
  searchQuery: string;
  showArchived: boolean;
}

// Styled components (reuse from original with performance optimizations)
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
  margin-bottom: ${({ theme }) => theme.spacing[4]};
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

// Optimized Alert Item Component for virtualization
const VirtualizedAlertItem = styled.div<{ 
  theme: Theme;
  priority: AlertPriority;
  isSelected?: boolean;
  isUnread?: boolean;
}>`
  padding: ${({ theme }) => theme.spacing[4]};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin: ${({ theme }) => theme.spacing[1]} 0;
  cursor: pointer;
  position: relative;
  background: ${({ theme }) => theme.colors.surface};
  
  /* Performance optimization: use transform instead of changing layout properties */
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ theme }) => theme.boxShadow.md};
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

const AlertItemMessage = styled.p<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
  
  /* Truncate long messages for performance */
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
`;

// Constants
const PRIORITIES: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
const CATEGORIES: AlertCategory[] = ['system', 'hardware', 'communication', 'navigation', 'power', 'thermal', 'other'];
const STATUSES: AlertStatus[] = ['unread', 'read', 'acknowledged', 'dismissed', 'archived'];
const ITEM_HEIGHT = 120; // Fixed height for optimal virtualization performance

export const VirtualizedAlertHistoryPanel: React.FC<VirtualizedAlertHistoryPanelProps> = ({
  persistenceService,
  isOpen,
  onClose,
  onAlertSelect,
  maxHeight,
  categories = CATEGORIES,
  testId,
  className
}) => {
  const [alerts, setAlerts] = useState<ExtendedPersistedAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ExtendedPersistedAlert | null>(null);
  const virtualListRef = useRef<VirtualizedListRef>(null);
  
  const [filters, setFilters] = useState<FilterState>({
    priorities: [...PRIORITIES],
    categories: [...categories],
    status: ['unread', 'read', 'acknowledged'],
    searchQuery: '',
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

  // Load alerts with enhanced filtering and virtualization preparation
  const loadAlerts = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const filterOptions = {
        priority: filters.priorities.length === PRIORITIES.length ? undefined : filters.priorities,
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
          const alertStatus = getAlertStatus({ 
            ...alert, 
            category: getAlertCategory(alert), 
            isRead: alert.metadata?.isRead || false, 
            isArchived: alert.metadata?.archived || false 
          });
          if (!filters.status.includes(alertStatus)) return false;
        }
        
        // Archived filter
        if (!filters.showArchived && alert.metadata?.archived) {
          return false;
        }
        
        return true;
      });
      
      // Sort by timestamp (newest first) for optimal UX
      results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Enhance alerts with additional properties
      const enhancedAlerts: ExtendedPersistedAlert[] = results.map(alert => ({
        ...alert,
        category: getAlertCategory(alert),
        isRead: alert.metadata?.isRead || false,
        isArchived: alert.metadata?.archived || false
      }));

      setAlerts(enhancedAlerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, persistenceService, categories, getAlertCategory, getAlertStatus]);

  // Load alerts when filters change or panel opens
  useEffect(() => {
    if (isOpen) {
      loadAlerts();
    }
  }, [isOpen, loadAlerts]);

  // Convert alerts to virtualized list items
  const virtualizedItems: VirtualizedAlertItem[] = useMemo(() => {
    return alerts.map((alert, index) => ({
      id: alert.id,
      alert,
      height: ITEM_HEIGHT,
      data: alert,
    }));
  }, [alerts]);

  // Enhanced filter handlers
  const togglePriorityFilter = useCallback((priority: AlertPriority) => {
    setFilters(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority]
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

  // Virtualized item renderer with performance optimizations
  const renderAlertItem = useCallback(({ index, style, data, isVisible }: any) => {
    const item = data as VirtualizedAlertItem;
    const alert = item.alert;
    const alertStatus = getAlertStatus(alert);
    
    // Only render visible items to maintain performance
    if (!isVisible) {
      return <div style={style} />;
    }
    
    return (
      <div style={style}>
        <VirtualizedAlertItem
          priority={alert.priority}
          isSelected={selectedAlert?.id === alert.id}
          isUnread={!alert.isRead}
          onClick={() => handleAlertSelect(alert)}
          role="listitem"
          aria-label={`Alert: ${alert.title || 'Untitled'} - ${alert.priority} priority`}
          style={{
            opacity: alertStatus === 'archived' ? 0.6 : 1,
            height: ITEM_HEIGHT - 8, // Account for margins
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
          </AlertItemHeader>

          <AlertItemMessage>{alert.message}</AlertItemMessage>

          <AlertItemMeta>
            <span>{formatTimestamp(alert.timestamp)}</span>
            <span>Source: {alert.source}</span>
            <span>Status: {alertStatus}</span>
          </AlertItemMeta>
        </VirtualizedAlertItem>
      </div>
    );
  }, [selectedAlert, getAlertStatus, handleAlertSelect, formatTimestamp]);

  if (!isOpen) {
    return null;
  }

  return (
    <Panel
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
          Alert History (Virtualized)
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
          <SearchInput
            type="text"
            placeholder="Search alerts by title, message, or source..."
            value={filters.searchQuery}
            onChange={(e) => {
              setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
            }}
            aria-label="Search alerts"
          />

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
                {priority}
              </PriorityChip>
            ))}
          </PriorityFilters>
        </FilterSection>
      </PanelHeader>

      {/* Virtualized Alert List */}
      <VirtualizedList
        ref={virtualListRef}
        items={virtualizedItems}
        itemHeight={ITEM_HEIGHT}
        height={window.innerHeight - 300} // Adjust based on header height
        renderItem={renderAlertItem}
        loading={isLoading}
        emptyMessage="No alerts found matching the current filters"
        loadingMessage="Loading alerts..."
        overscanCount={3}
        ariaLabel="Alert list"
        itemRole="listitem"
      />
    </Panel>
  );
};

export default VirtualizedAlertHistoryPanel;