/**
 * Bulk Dismissal Manager Component
 * Provides comprehensive bulk dismissal operations with filtering and feedback
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../../../../theme/themes';
import { AlertPriority } from '../../../../../theme/alertPriorities';
import { Button } from '../../Button/Button';
import { Modal } from '../../Modal/Modal';
import { Input } from '../../Input/Input';
import { Select } from '../../Select/Select';
import { Checkbox } from '../../Checkbox/Checkbox';
import { Badge } from '../../Badge/Badge';
import { Tooltip } from '../../Tooltip/Tooltip';
import { 
  DismissalType, 
  AlertGroup,
  EnhancedAlertGroupingManager 
} from '../../../../../utils/alertQueue/EnhancedAlertGroupingManager';
import { ProcessedAlert } from '../../../../../utils/alertQueue/AlertQueueManager';

export interface BulkDismissalManagerProps {
  groupingManager: EnhancedAlertGroupingManager;
  availableAlerts: ProcessedAlert[];
  availableGroups: AlertGroup[];
  onBulkDismiss: (items: { alertIds?: string[]; groupIds?: string[] }, type: DismissalType, options?: any) => Promise<{ successful: string[]; failed: string[] }>;
  onClose: () => void;
  className?: string;
}

interface BulkCriteria {
  priority?: AlertPriority[];
  sourcePattern?: string;
  ageThreshold?: number; // hours
  groupSize?: number;
  includeGroups?: boolean;
  customFilter?: string;
}

interface SelectionSummary {
  totalItems: number;
  alertCount: number;
  groupCount: number;
  priorityBreakdown: Record<AlertPriority, number>;
  canDismissAll: boolean;
  blockedCount: number;
}

const ManagerContainer = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  height: 600px;
  max-height: 80vh;
`;

const ManagerHeader = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[6]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.elevated};
`;

const ManagerTitle = styled.h2<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

const ManagerDescription = styled.p<{ theme: Theme }>`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const ManagerContent = styled.div<{ theme: Theme }>`
  display: flex;
  flex: 1;
  overflow: hidden;
`;

const FilterPanel = styled.div<{ theme: Theme }>`
  width: 300px;
  padding: ${({ theme }) => theme.spacing[4]};
  border-right: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.default};
  overflow-y: auto;
`;

const SelectionPanel = styled.div<{ theme: Theme }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const FilterSection = styled.div<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[4]};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FilterLabel = styled.h3<{ theme: Theme }>`
  margin: 0 0 ${({ theme }) => theme.spacing[2]} 0;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FilterGroup = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const SelectionHeader = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.elevated};
`;

const SelectionSummaryCard = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const SummaryGrid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[3]};
`;

const SummaryItem = styled.div<{ theme: Theme }>`
  text-align: center;
`;

const SummaryValue = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const SummaryLabel = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PriorityBreakdown = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[2]};
  flex-wrap: wrap;
`;

const SelectionList = styled.div<{ theme: Theme }>`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[4]};
`;

const SelectionItem = styled.div<{ theme: Theme; selected: boolean }>`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[2]};
  border: 1px solid ${({ theme, selected }) => 
    selected ? theme.colors.primary.main : theme.colors.divider
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme, selected }) => 
    selected ? `${theme.colors.primary.main}10` : theme.colors.background.paper
  };
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.light};
    background-color: ${({ theme }) => theme.colors.background.elevated};
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const ItemCheckbox = styled(Checkbox)`
  margin-right: 12px;
`;

const ItemContent = styled.div<{ theme: Theme }>`
  flex: 1;
  min-width: 0;
`;

const ItemTitle = styled.div<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ItemMeta = styled.div<{ theme: Theme }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

const ManagerActions = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  background-color: ${({ theme }) => theme.colors.background.elevated};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ActionGroup = styled.div<{ theme: Theme }>`
  display: flex;
  gap: ${({ theme }) => theme.spacing[3]};
  align-items: center;
`;

const DismissalTypeSelect = styled(Select)`
  min-width: 150px;
`;

const PresetFilters = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const PresetButton = styled(Button)<{ theme: Theme }>`
  justify-content: flex-start;
  text-align: left;
`;

const PRESET_FILTERS = [
  {
    id: 'all-low-priority',
    label: 'All Low Priority',
    description: 'Info and low priority alerts',
    criteria: { priority: ['info', 'low'] as AlertPriority[] },
  },
  {
    id: 'old-alerts',
    label: 'Old Alerts (>1h)',
    description: 'Alerts older than 1 hour',
    criteria: { ageThreshold: 1 },
  },
  {
    id: 'large-groups',
    label: 'Large Groups (5+)',
    description: 'Groups with 5 or more alerts',
    criteria: { groupSize: 5, includeGroups: true },
  },
  {
    id: 'system-alerts',
    label: 'System Alerts',
    description: 'Alerts from system sources',
    criteria: { sourcePattern: 'system' },
  },
];

const DISMISSAL_TYPE_OPTIONS = [
  { value: 'bulk', label: 'Bulk Dismiss' },
  { value: 'conditional', label: 'Conditional' },
  { value: 'timed', label: 'Scheduled' },
];

export const BulkDismissalManager: React.FC<BulkDismissalManagerProps> = ({
  groupingManager,
  availableAlerts,
  availableGroups,
  onBulkDismiss,
  onClose,
  className,
}) => {
  const [criteria, setCriteria] = useState<BulkCriteria>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<DismissalType>('bulk');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ successful: string[]; failed: string[] } | null>(null);

  // Apply filters to get matching items
  const filteredItems = useMemo(() => {
    const items: Array<{ type: 'alert' | 'group'; id: string; data: ProcessedAlert | AlertGroup }> = [];
    
    // Add alerts
    availableAlerts.forEach(alert => {
      let matches = true;
      
      if (criteria.priority?.length && !criteria.priority.includes(alert.priority)) {
        matches = false;
      }
      
      if (criteria.sourcePattern && alert.data?.source) {
        const pattern = new RegExp(criteria.sourcePattern, 'i');
        if (!pattern.test(alert.data.source)) {
          matches = false;
        }
      }
      
      if (criteria.ageThreshold) {
        const ageHours = (Date.now() - alert.timestamp.getTime()) / (1000 * 60 * 60);
        if (ageHours < criteria.ageThreshold) {
          matches = false;
        }
      }
      
      if (matches) {
        items.push({ type: 'alert', id: alert.id, data: alert });
      }
    });
    
    // Add groups if enabled
    if (criteria.includeGroups) {
      availableGroups.forEach(group => {
        let matches = true;
        
        if (criteria.groupSize && group.alerts.length < criteria.groupSize) {
          matches = false;
        }
        
        if (criteria.priority?.length) {
          const hasMatchingPriority = group.alerts.some(alert => 
            criteria.priority!.includes(alert.priority)
          );
          if (!hasMatchingPriority) {
            matches = false;
          }
        }
        
        if (matches) {
          items.push({ type: 'group', id: group.id, data: group });
        }
      });
    }
    
    return items;
  }, [availableAlerts, availableGroups, criteria]);

  // Calculate selection summary
  const selectionSummary = useMemo((): SelectionSummary => {
    const selectedAlerts: ProcessedAlert[] = [];
    const selectedGroups: AlertGroup[] = [];
    
    filteredItems.forEach(item => {
      if (selectedItems.has(item.id)) {
        if (item.type === 'alert') {
          selectedAlerts.push(item.data as ProcessedAlert);
        } else {
          selectedGroups.push(item.data as AlertGroup);
          // Include alerts from selected groups
          (item.data as AlertGroup).alerts.forEach(alert => {
            selectedAlerts.push(alert);
          });
        }
      }
    });
    
    const priorityBreakdown: Record<AlertPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    
    let blockedCount = 0;
    selectedAlerts.forEach(alert => {
      priorityBreakdown[alert.priority]++;
      
      const feedback = groupingManager.getDismissalFeedback(alert.id);
      if (feedback && !feedback.canDismiss) {
        blockedCount++;
      }
    });
    
    return {
      totalItems: selectedItems.size,
      alertCount: selectedAlerts.length,
      groupCount: selectedGroups.length,
      priorityBreakdown,
      canDismissAll: blockedCount === 0,
      blockedCount,
    };
  }, [selectedItems, filteredItems, groupingManager]);

  const handlePresetFilter = useCallback((preset: typeof PRESET_FILTERS[0]) => {
    setCriteria(preset.criteria);
    setSelectedItems(new Set()); // Clear selection
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  }, [selectedItems.size, filteredItems]);

  const handleItemToggle = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleBulkDismiss = useCallback(async () => {
    if (selectedItems.size === 0) return;
    
    setIsProcessing(true);
    try {
      const alertIds: string[] = [];
      const groupIds: string[] = [];
      
      filteredItems.forEach(item => {
        if (selectedItems.has(item.id)) {
          if (item.type === 'alert') {
            alertIds.push(item.id);
          } else {
            groupIds.push(item.id);
          }
        }
      });
      
      const result = await onBulkDismiss(
        { alertIds: alertIds.length > 0 ? alertIds : undefined, groupIds: groupIds.length > 0 ? groupIds : undefined },
        selectedType,
        { reason: reason.trim() || undefined }
      );
      
      setLastResult(result);
      
      // Clear selection of successful items
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        result.successful.forEach(id => newSet.delete(id));
        return newSet;
      });
      
    } finally {
      setIsProcessing(false);
    }
  }, [selectedItems, filteredItems, onBulkDismiss, selectedType, reason]);

  const getPriorityColor = (priority: AlertPriority): 'error' | 'warning' | 'info' | 'success' | 'neutral' => {
    const colors = {
      critical: 'error' as const,
      high: 'warning' as const,
      medium: 'info' as const,
      low: 'success' as const,
      info: 'neutral' as const,
    };
    return colors[priority];
  };

  return (
    <Modal isOpen onClose={onClose} size="large" className={className}>
      <ManagerContainer>
        <ManagerHeader>
          <ManagerTitle>Bulk Dismissal Manager</ManagerTitle>
          <ManagerDescription>
            Select alerts and groups to dismiss in bulk. Use filters to narrow down your selection.
          </ManagerDescription>
        </ManagerHeader>

        <ManagerContent>
          {/* Filter Panel */}
          <FilterPanel>
            <FilterSection>
              <FilterLabel>Quick Filters</FilterLabel>
              <PresetFilters>
                {PRESET_FILTERS.map(preset => (
                  <PresetButton
                    key={preset.id}
                    variant="ghost"
                    size="small"
                    onClick={() => handlePresetFilter(preset)}
                  >
                    <div>
                      <div>{preset.label}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {preset.description}
                      </div>
                    </div>
                  </PresetButton>
                ))}
              </PresetFilters>
            </FilterSection>

            <FilterSection>
              <FilterLabel>Priority</FilterLabel>
              <FilterGroup>
                <Select
                  placeholder="Select priorities"
                  options={[
                    { value: 'critical', label: 'Critical' },
                    { value: 'high', label: 'High' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'low', label: 'Low' },
                    { value: 'info', label: 'Info' },
                  ]}
                  multiple
                  value={criteria.priority || []}
                  onChange={(value) => setCriteria(prev => ({ 
                    ...prev, 
                    priority: value as AlertPriority[] 
                  }))}
                />
              </FilterGroup>
            </FilterSection>

            <FilterSection>
              <FilterLabel>Source Pattern</FilterLabel>
              <FilterGroup>
                <Input
                  placeholder="e.g., system, hardware"
                  value={criteria.sourcePattern || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    sourcePattern: e.target.value || undefined 
                  }))}
                />
              </FilterGroup>
            </FilterSection>

            <FilterSection>
              <FilterLabel>Age Threshold</FilterLabel>
              <FilterGroup>
                <Input
                  type="number"
                  placeholder="Hours"
                  min={0}
                  value={criteria.ageThreshold || ''}
                  onChange={(e) => setCriteria(prev => ({ 
                    ...prev, 
                    ageThreshold: parseInt(e.target.value) || undefined 
                  }))}
                />
              </FilterGroup>
            </FilterSection>

            <FilterSection>
              <FilterLabel>Group Options</FilterLabel>
              <FilterGroup>
                <Checkbox
                  label="Include groups"
                  checked={criteria.includeGroups || false}
                  onChange={(checked) => setCriteria(prev => ({ 
                    ...prev, 
                    includeGroups: checked 
                  }))}
                />
                {criteria.includeGroups && (
                  <Input
                    type="number"
                    placeholder="Min group size"
                    min={1}
                    value={criteria.groupSize || ''}
                    onChange={(e) => setCriteria(prev => ({ 
                      ...prev, 
                      groupSize: parseInt(e.target.value) || undefined 
                    }))}
                  />
                )}
              </FilterGroup>
            </FilterSection>
          </FilterPanel>

          {/* Selection Panel */}
          <SelectionPanel>
            <SelectionHeader>
              <SelectionSummaryCard>
                <SummaryGrid>
                  <SummaryItem>
                    <SummaryValue>{selectionSummary.totalItems}</SummaryValue>
                    <SummaryLabel>Selected</SummaryLabel>
                  </SummaryItem>
                  <SummaryItem>
                    <SummaryValue>{selectionSummary.alertCount}</SummaryValue>
                    <SummaryLabel>Alerts</SummaryLabel>
                  </SummaryItem>
                  <SummaryItem>
                    <SummaryValue>{selectionSummary.groupCount}</SummaryValue>
                    <SummaryLabel>Groups</SummaryLabel>
                  </SummaryItem>
                  <SummaryItem>
                    <SummaryValue>{selectionSummary.blockedCount}</SummaryValue>
                    <SummaryLabel>Blocked</SummaryLabel>
                  </SummaryItem>
                </SummaryGrid>

                <PriorityBreakdown>
                  {Object.entries(selectionSummary.priorityBreakdown).map(([priority, count]) => (
                    count > 0 && (
                      <Badge
                        key={priority}
                        variant={getPriorityColor(priority as AlertPriority)}
                        size="small"
                      >
                        {priority}: {count}
                      </Badge>
                    )
                  ))}
                </PriorityBreakdown>
              </SelectionSummaryCard>

              <ActionGroup>
                <span>{filteredItems.length} items match criteria</span>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={handleSelectAll}
                >
                  {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </ActionGroup>
            </SelectionHeader>

            <SelectionList>
              {filteredItems.map(item => {
                const isSelected = selectedItems.has(item.id);
                const isGroup = item.type === 'group';
                const data = item.data;
                
                return (
                  <SelectionItem
                    key={item.id}
                    selected={isSelected}
                    onClick={() => handleItemToggle(item.id)}
                  >
                    <ItemCheckbox
                      checked={isSelected}
                      onChange={() => handleItemToggle(item.id)}
                    />
                    <ItemContent>
                      <ItemTitle>
                        {isGroup 
                          ? `Group: ${(data as AlertGroup).groupKey} (${(data as AlertGroup).alerts.length} alerts)`
                          : (data as ProcessedAlert).data?.title || (data as ProcessedAlert).data?.message
                        }
                      </ItemTitle>
                      <ItemMeta>
                        <Badge
                          variant={getPriorityColor(
                            isGroup 
                              ? (data as AlertGroup).commonPriority || 'info'
                              : (data as ProcessedAlert).priority
                          )}
                          size="small"
                        >
                          {isGroup 
                            ? (data as AlertGroup).commonPriority || 'mixed'
                            : (data as ProcessedAlert).priority
                          }
                        </Badge>
                        <span>
                          {isGroup 
                            ? (data as AlertGroup).createdAt.toLocaleTimeString()
                            : (data as ProcessedAlert).timestamp.toLocaleTimeString()
                          }
                        </span>
                        {isGroup && (
                          <span>{(data as AlertGroup).alerts.length} alerts</span>
                        )}
                      </ItemMeta>
                    </ItemContent>
                  </SelectionItem>
                );
              })}
              
              {filteredItems.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                  No items match the current criteria
                </div>
              )}
            </SelectionList>
          </SelectionPanel>
        </ManagerContent>

        <ManagerActions>
          <ActionGroup>
            <DismissalTypeSelect
              value={selectedType}
              onChange={(value) => setSelectedType(value as DismissalType)}
              options={DISMISSAL_TYPE_OPTIONS}
            />
            <Input
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ minWidth: '200px' }}
            />
          </ActionGroup>

          <ActionGroup>
            {lastResult && (
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                Last: {lastResult.successful.length} successful, {lastResult.failed.length} failed
              </div>
            )}
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={handleBulkDismiss}
              disabled={selectedItems.size === 0 || isProcessing}
              loading={isProcessing}
            >
              Dismiss Selected ({selectedItems.size})
            </Button>
          </ActionGroup>
        </ManagerActions>
      </ManagerContainer>
    </Modal>
  );
};

export default BulkDismissalManager;