/**
 * Command History Filters Component
 * Advanced filtering UI for command history
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  IconButton,
  Collapse,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  SelectChangeEvent,
  Autocomplete,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  CommandHistoryFilter,
  CommandHistory
} from '../../types/command-history.types';
import {
  CommandType,
  CommandPriority,
  CommandStatus,
  getPriorityName
} from '../../../../shared/types/command-queue.types';

interface CommandHistoryFiltersProps {
  filters: CommandHistoryFilter;
  onFiltersChange: (filters: CommandHistoryFilter) => void;
  onSearch: () => void;
  onClear: () => void;
  availableCommandTypes: string[];
  availableErrorCodes: string[];
  availableUsers: string[];
  availableTags: string[];
}

export const CommandHistoryFilters: React.FC<CommandHistoryFiltersProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  onClear,
  availableCommandTypes,
  availableErrorCodes,
  availableUsers,
  availableTags
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  // Calculate active filters count
  useEffect(() => {
    let count = 0;
    if (filters.startTime || filters.endTime) count++;
    if (filters.commandTypes?.length) count++;
    if (filters.priorities?.length) count++;
    if (filters.statuses?.length) count++;
    if (filters.userIds?.length) count++;
    if (filters.onlyErrors) count++;
    if (filters.errorCodes?.length) count++;
    if (filters.tags?.length) count++;
    if (filters.minExecutionTimeMs || filters.maxExecutionTimeMs) count++;
    setActiveFiltersCount(count);
  }, [filters]);

  // Handler functions
  const handleTextFieldChange = useCallback((field: keyof CommandHistoryFilter) => 
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        [field]: event.target.value
      });
    }, [filters, onFiltersChange]
  );

  const handleMultiSelectChange = useCallback((field: keyof CommandHistoryFilter) => 
    (event: SelectChangeEvent<string[]>) => {
      const value = event.target.value;
      onFiltersChange({
        ...filters,
        [field]: typeof value === 'string' ? value.split(',') : value
      });
    }, [filters, onFiltersChange]
  );

  const handleDateChange = useCallback((field: 'startTime' | 'endTime') => 
    (value: Date | null) => {
      onFiltersChange({
        ...filters,
        [field]: value || undefined
      });
    }, [filters, onFiltersChange]
  );

  const handleExecutionTimeChange = useCallback((field: 'minExecutionTimeMs' | 'maxExecutionTimeMs') =>
    (_: Event, value: number | number[]) => {
      onFiltersChange({
        ...filters,
        [field]: value as number
      });
    }, [filters, onFiltersChange]
  );

  const handleClearAll = useCallback(() => {
    onClear();
    setExpanded(false);
  }, [onClear]);

  // Quick filter presets
  const applyPreset = useCallback((preset: string) => {
    const now = new Date();
    const presets: Record<string, Partial<CommandHistoryFilter>> = {
      'last-hour': {
        startTime: new Date(now.getTime() - 60 * 60 * 1000),
        endTime: now
      },
      'last-24h': {
        startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        endTime: now
      },
      'last-week': {
        startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endTime: now
      },
      'errors-only': {
        onlyErrors: true,
        statuses: [CommandStatus.FAILED, CommandStatus.TIMEOUT]
      },
      'high-priority': {
        priorities: [CommandPriority.EMERGENCY, CommandPriority.HIGH]
      },
      'slow-commands': {
        minExecutionTimeMs: 5000
      }
    };

    if (presets[preset]) {
      onFiltersChange({
        ...filters,
        ...presets[preset]
      });
    }
  }, [filters, onFiltersChange]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper elevation={0} sx={{ mb: 2 }}>
        {/* Main search bar */}
        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search commands by ID, type, error code, or tags..."
            value={filters.searchText || ''}
            onChange={handleTextFieldChange('searchText')}
            onKeyPress={(e) => e.key === 'Enter' && onSearch()}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
            }}
          />
          
          <Badge badgeContent={activeFiltersCount} color="primary">
            <Tooltip title={expanded ? "Hide filters" : "Show filters"}>
              <IconButton onClick={() => setExpanded(!expanded)}>
                {expanded ? <ExpandLessIcon /> : <FilterIcon />}
              </IconButton>
            </Tooltip>
          </Badge>

          <Button
            variant="contained"
            onClick={onSearch}
            startIcon={<SearchIcon />}
          >
            Search
          </Button>

          {activeFiltersCount > 0 && (
            <Button
              variant="outlined"
              onClick={handleClearAll}
              startIcon={<ClearIcon />}
            >
              Clear
            </Button>
          )}
        </Box>

        {/* Quick presets */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" sx={{ mr: 1, alignSelf: 'center' }}>
            Quick filters:
          </Typography>
          <Chip 
            label="Last Hour" 
            size="small" 
            onClick={() => applyPreset('last-hour')}
            variant="outlined"
          />
          <Chip 
            label="Last 24 Hours" 
            size="small" 
            onClick={() => applyPreset('last-24h')}
            variant="outlined"
          />
          <Chip 
            label="Last Week" 
            size="small" 
            onClick={() => applyPreset('last-week')}
            variant="outlined"
          />
          <Chip 
            label="Errors Only" 
            size="small" 
            onClick={() => applyPreset('errors-only')}
            variant="outlined"
            color="error"
          />
          <Chip 
            label="High Priority" 
            size="small" 
            onClick={() => applyPreset('high-priority')}
            variant="outlined"
            color="warning"
          />
          <Chip 
            label="Slow Commands" 
            size="small" 
            onClick={() => applyPreset('slow-commands')}
            variant="outlined"
          />
        </Box>

        {/* Advanced filters */}
        <Collapse in={expanded}>
          <Box sx={{ p: 2, pt: 0, borderTop: 1, borderColor: 'divider' }}>
            <Grid container spacing={2}>
              {/* Time range */}
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="Start Time"
                  value={filters.startTime || null}
                  onChange={handleDateChange('startTime')}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DateTimePicker
                  label="End Time"
                  value={filters.endTime || null}
                  onChange={handleDateChange('endTime')}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>

              {/* Command types */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Command Types</InputLabel>
                  <Select
                    multiple
                    value={filters.commandTypes || []}
                    onChange={handleMultiSelectChange('commandTypes')}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {availableCommandTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        {type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Priorities */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priorities</InputLabel>
                  <Select
                    multiple
                    value={filters.priorities?.map(String) || []}
                    onChange={(e) => {
                      const values = e.target.value as string[];
                      onFiltersChange({
                        ...filters,
                        priorities: values.map(Number) as CommandPriority[]
                      });
                    }}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip 
                            key={value} 
                            label={getPriorityName(Number(value) as CommandPriority)} 
                            size="small" 
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {[
                      CommandPriority.EMERGENCY,
                      CommandPriority.HIGH,
                      CommandPriority.NORMAL,
                      CommandPriority.LOW
                    ].map((priority) => (
                      <MenuItem key={priority} value={priority}>
                        {getPriorityName(priority)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Statuses */}
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Statuses</InputLabel>
                  <Select
                    multiple
                    value={filters.statuses || []}
                    onChange={handleMultiSelectChange('statuses')}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {Object.values(CommandStatus).map((status) => (
                      <MenuItem key={status} value={status}>
                        {status}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Error codes */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={availableErrorCodes}
                  value={filters.errorCodes || []}
                  onChange={(_, value) => {
                    onFiltersChange({
                      ...filters,
                      errorCodes: value
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Error Codes" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                />
              </Grid>

              {/* Users */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={availableUsers}
                  value={filters.userIds || []}
                  onChange={(_, value) => {
                    onFiltersChange({
                      ...filters,
                      userIds: value
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Users" />
                  )}
                />
              </Grid>

              {/* Tags */}
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  freeSolo
                  options={availableTags}
                  value={filters.tags || []}
                  onChange={(_, value) => {
                    onFiltersChange({
                      ...filters,
                      tags: value
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Tags" />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        variant="outlined"
                        label={option}
                        size="small"
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                />
              </Grid>

              {/* Execution time range */}
              <Grid item xs={12}>
                <Typography gutterBottom>
                  Execution Time Range (ms)
                </Typography>
                <Box sx={{ px: 2 }}>
                  <Slider
                    value={[
                      filters.minExecutionTimeMs || 0,
                      filters.maxExecutionTimeMs || 60000
                    ]}
                    onChange={(_, value) => {
                      const [min, max] = value as number[];
                      onFiltersChange({
                        ...filters,
                        minExecutionTimeMs: min > 0 ? min : undefined,
                        maxExecutionTimeMs: max < 60000 ? max : undefined
                      });
                    }}
                    valueLabelDisplay="auto"
                    min={0}
                    max={60000}
                    step={100}
                    marks={[
                      { value: 0, label: '0ms' },
                      { value: 15000, label: '15s' },
                      { value: 30000, label: '30s' },
                      { value: 60000, label: '60s' }
                    ]}
                  />
                </Box>
              </Grid>

              {/* Error toggle */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={filters.onlyErrors || false}
                      onChange={(e) => {
                        onFiltersChange({
                          ...filters,
                          onlyErrors: e.target.checked
                        });
                      }}
                    />
                  }
                  label="Show only failed commands"
                />
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>
    </LocalizationProvider>
  );
};