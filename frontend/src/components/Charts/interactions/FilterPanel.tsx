/**
 * Filter Panel for dynamic chart filtering
 * Provides time range, channel, value, and anomaly filtering
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import { FilterConfig, FilterState } from './types';
import { 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Slider, 
  Switch, 
  FormControlLabel,
  IconButton,
  Collapse,
  Button,
  ButtonGroup,
  Chip,
  Box,
  Typography,
  Tooltip
} from '@mui/material';
import { 
  FilterList as FilterIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  RestoreOutlined as RestoreIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Styled components
const FilterContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  min-width: 320px;
  max-width: 400px;
  z-index: 1000;
  backdrop-filter: blur(10px);
  
  @media (prefers-color-scheme: dark) {
    background: rgba(42, 42, 42, 0.95);
    border-color: #444;
  }
`;

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  cursor: pointer;
  user-select: none;
  
  @media (prefers-color-scheme: dark) {
    border-color: #444;
  }
`;

const FilterContent = styled.div`
  padding: 16px;
  max-height: 600px;
  overflow-y: auto;
`;

const FilterSection = styled.div`
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FilterActions = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #e0e0e0;
  
  @media (prefers-color-scheme: dark) {
    border-color: #444;
  }
`;

const PresetButton = styled(Button)`
  text-transform: none;
  font-size: 12px;
`;

interface FilterPanelProps extends FilterConfig {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  enabled = true,
  timeRangePresets = [],
  channelOptions = [],
  onFilterChange,
  persistState = true,
  filters: initialFilters
}) => {
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [savedFilters, setSavedFilters] = useState<FilterState[]>([]);

  // Default time range presets
  const defaultPresets = [
    { label: 'Last 5 minutes', getValue: () => [new Date(Date.now() - 5 * 60 * 1000), new Date()] as [Date, Date] },
    { label: 'Last 15 minutes', getValue: () => [new Date(Date.now() - 15 * 60 * 1000), new Date()] as [Date, Date] },
    { label: 'Last hour', getValue: () => [new Date(Date.now() - 60 * 60 * 1000), new Date()] as [Date, Date] },
    { label: 'Last 24 hours', getValue: () => [new Date(Date.now() - 24 * 60 * 60 * 1000), new Date()] as [Date, Date] },
    { label: 'Last 7 days', getValue: () => [new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()] as [Date, Date] }
  ];

  const presets = timeRangePresets.length > 0 ? timeRangePresets : defaultPresets;

  /**
   * Load saved filters from localStorage
   */
  useEffect(() => {
    if (persistState) {
      const saved = localStorage.getItem('chart-filters');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSavedFilters(parsed);
        } catch (error) {
          console.error('Failed to load saved filters:', error);
        }
      }
    }
  }, [persistState]);

  /**
   * Save filters to localStorage
   */
  const saveFilters = useCallback(() => {
    if (persistState) {
      const newSaved = [...savedFilters, { ...filters, savedAt: new Date().toISOString() }];
      setSavedFilters(newSaved.slice(-5)); // Keep last 5
      localStorage.setItem('chart-filters', JSON.stringify(newSaved));
    }
  }, [filters, savedFilters, persistState]);

  /**
   * Update filters and notify parent
   */
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilterChange(updated);
  }, [filters, onFilterChange]);

  /**
   * Clear all filters
   */
  const clearFilters = useCallback(() => {
    const cleared: FilterState = {};
    setFilters(cleared);
    onFilterChange(cleared);
  }, [onFilterChange]);

  /**
   * Apply time range preset
   */
  const applyPreset = useCallback((preset: typeof presets[0]) => {
    const timeRange = preset.getValue();
    updateFilters({ timeRange });
  }, [updateFilters]);

  /**
   * Handle time range change
   */
  const handleTimeRangeChange = useCallback((field: 'start' | 'end', value: Date | null) => {
    if (!value) return;
    
    const newTimeRange: [Date, Date] = [...(filters.timeRange || [new Date(), new Date()])] as [Date, Date];
    newTimeRange[field === 'start' ? 0 : 1] = value;
    
    updateFilters({ timeRange: newTimeRange });
  }, [filters.timeRange, updateFilters]);

  /**
   * Handle channel selection
   */
  const handleChannelChange = useCallback((event: any) => {
    const value = event.target.value as string[];
    updateFilters({ channels: value.length > 0 ? value : undefined });
  }, [updateFilters]);

  /**
   * Handle value range change
   */
  const handleValueRangeChange = useCallback((event: any, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      updateFilters({ valueRange: newValue as [number, number] });
    }
  }, [updateFilters]);

  /**
   * Handle anomaly filter toggle
   */
  const handleAnomalyToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    updateFilters({ anomaliesOnly: event.target.checked || undefined });
  }, [updateFilters]);

  /**
   * Handle threshold filter change
   */
  const handleThresholdFilterChange = useCallback((type: 'above' | 'below' | 'between', value: string) => {
    const values = value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    
    if (values.length > 0) {
      updateFilters({
        thresholdFilter: { type, values }
      });
    } else {
      updateFilters({ thresholdFilter: undefined });
    }
  }, [updateFilters]);

  /**
   * Get active filter count
   */
  const getActiveFilterCount = (): number => {
    let count = 0;
    if (filters.timeRange) count++;
    if (filters.channels && filters.channels.length > 0) count++;
    if (filters.valueRange) count++;
    if (filters.anomaliesOnly) count++;
    if (filters.thresholdFilter) count++;
    return count;
  };

  if (!enabled) return null;

  const activeCount = getActiveFilterCount();

  return (
    <FilterContainer>
      <FilterHeader onClick={() => setExpanded(!expanded)}>
        <Box display="flex" alignItems="center" gap={1}>
          <FilterIcon />
          <Typography variant="subtitle1">Filters</Typography>
          {activeCount > 0 && (
            <Chip 
              label={activeCount} 
              size="small" 
              color="primary"
              sx={{ height: 20, fontSize: 12 }}
            />
          )}
        </Box>
        <IconButton size="small">
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </FilterHeader>

      <Collapse in={expanded}>
        <FilterContent>
          {/* Time Range Section */}
          <FilterSection>
            <Typography variant="subtitle2" gutterBottom>
              Time Range
            </Typography>
            
            <ButtonGroup size="small" fullWidth sx={{ mb: 2 }}>
              {presets.slice(0, 3).map((preset, index) => (
                <PresetButton
                  key={index}
                  onClick={() => applyPreset(preset)}
                  variant={
                    filters.timeRange &&
                    preset.getValue()[0].getTime() === filters.timeRange[0].getTime() &&
                    preset.getValue()[1].getTime() === filters.timeRange[1].getTime()
                      ? 'contained'
                      : 'outlined'
                  }
                >
                  {preset.label}
                </PresetButton>
              ))}
            </ButtonGroup>

            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <Box display="flex" gap={1} flexDirection="column">
                <DateTimePicker
                  label="Start"
                  value={filters.timeRange?.[0] || null}
                  onChange={(value) => handleTimeRangeChange('start', value)}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
                <DateTimePicker
                  label="End"
                  value={filters.timeRange?.[1] || null}
                  onChange={(value) => handleTimeRangeChange('end', value)}
                  slotProps={{
                    textField: { size: 'small', fullWidth: true }
                  }}
                />
              </Box>
            </LocalizationProvider>
          </FilterSection>

          {/* Channel Selection */}
          {channelOptions.length > 0 && (
            <FilterSection>
              <FormControl fullWidth size="small">
                <InputLabel>Channels</InputLabel>
                <Select
                  multiple
                  value={filters.channels || []}
                  onChange={handleChannelChange}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {channelOptions.map((channel) => (
                    <MenuItem key={channel} value={channel}>
                      {channel}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </FilterSection>
          )}

          {/* Value Range */}
          <FilterSection>
            <Typography variant="subtitle2" gutterBottom>
              Value Range
            </Typography>
            <Box px={1}>
              <Slider
                value={filters.valueRange || [-100, 100]}
                onChange={handleValueRangeChange}
                valueLabelDisplay="auto"
                min={-100}
                max={100}
                marks={[
                  { value: -100, label: '-100' },
                  { value: 0, label: '0' },
                  { value: 100, label: '100' }
                ]}
              />
            </Box>
          </FilterSection>

          {/* Anomaly Filter */}
          <FilterSection>
            <FormControlLabel
              control={
                <Switch
                  checked={filters.anomaliesOnly || false}
                  onChange={handleAnomalyToggle}
                />
              }
              label="Show Anomalies Only"
            />
          </FilterSection>

          {/* Threshold Filter */}
          <FilterSection>
            <Typography variant="subtitle2" gutterBottom>
              Threshold Filter
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.thresholdFilter?.type || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleThresholdFilterChange(
                      e.target.value as 'above' | 'below' | 'between',
                      filters.thresholdFilter?.values.join(', ') || ''
                    );
                  }
                }}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="above">Above</MenuItem>
                <MenuItem value="below">Below</MenuItem>
                <MenuItem value="between">Between</MenuItem>
              </Select>
            </FormControl>
            
            {filters.thresholdFilter && (
              <TextField
                size="small"
                fullWidth
                label={filters.thresholdFilter.type === 'between' ? 'Values (comma-separated)' : 'Value'}
                value={filters.thresholdFilter.values.join(', ')}
                onChange={(e) => handleThresholdFilterChange(filters.thresholdFilter!.type, e.target.value)}
                placeholder={filters.thresholdFilter.type === 'between' ? '10, 20' : '10'}
              />
            )}
          </FilterSection>
        </FilterContent>

        <FilterActions>
          <Box display="flex" gap={1}>
            <Tooltip title="Save current filters">
              <IconButton size="small" onClick={saveFilters}>
                <SaveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Load saved filters">
              <IconButton 
                size="small" 
                disabled={savedFilters.length === 0}
                onClick={() => {
                  if (savedFilters.length > 0) {
                    const latest = savedFilters[savedFilters.length - 1];
                    setFilters(latest);
                    onFilterChange(latest);
                  }
                }}
              >
                <RestoreIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Button
            size="small"
            startIcon={<ClearIcon />}
            onClick={clearFilters}
            disabled={activeCount === 0}
          >
            Clear All
          </Button>
        </FilterActions>
      </Collapse>
    </FilterContainer>
  );
};