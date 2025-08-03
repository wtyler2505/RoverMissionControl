import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  Chip,
  Stack,
  Button,
  TextField,
  Slider,
  IconButton,
  Tooltip,
  Badge,
  Divider,
  useTheme,
  SelectChangeEvent,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Save as SaveIcon,
  RestartAlt as ResetIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Schedule as ScheduleIcon,
  Flag as FlagIcon,
  Category as CategoryIcon,
  Person as PersonIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { GanttTask, MissionEvent } from './types';

export interface TimelineFilter {
  // Task filters
  taskStatuses: Set<string>;
  taskPriorities: Set<string>;
  taskCategories: Set<string>;
  taskResources: Set<string>;
  taskDateRange: {
    start: Date | null;
    end: Date | null;
  };
  taskProgressRange: [number, number];
  showOnlyCriticalPath: boolean;
  showOnlyOverdue: boolean;
  showOnlyMilestones: boolean;
  
  // Event filters
  eventTypes: Set<string>;
  eventSeverities: Set<string>;
  eventDateRange: {
    start: Date | null;
    end: Date | null;
  };
  
  // General filters
  searchText: string;
  hideCompleted: boolean;
  hideEmpty: boolean;
  
  // Custom filter function
  customFilter?: (task: GanttTask, event?: MissionEvent) => boolean;
}

export interface TimelineFilterPanelProps {
  tasks: GanttTask[];
  events?: MissionEvent[];
  filter: TimelineFilter;
  onFilterChange: (filter: TimelineFilter) => void;
  onSaveFilter?: (name: string, filter: TimelineFilter) => void;
  savedFilters?: Array<{ name: string; filter: TimelineFilter }>;
  onLoadFilter?: (filter: TimelineFilter) => void;
  position?: 'left' | 'right' | 'top' | 'bottom';
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TimelineFilterPanel: React.FC<TimelineFilterPanelProps> = ({
  tasks,
  events = [],
  filter,
  onFilterChange,
  onSaveFilter,
  savedFilters = [],
  onLoadFilter,
  position = 'left',
  collapsed = false,
  onToggleCollapse
}) => {
  const theme = useTheme();
  const [filterName, setFilterName] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['status', 'priority'])
  );

  // Extract unique values from data
  const uniqueValues = useMemo(() => {
    const statuses = new Set<string>();
    const priorities = new Set<string>();
    const categories = new Set<string>();
    const resources = new Set<string>();
    
    tasks.forEach(task => {
      if (task.status) statuses.add(task.status);
      if (task.priority) priorities.add(task.priority);
      if (task.category) categories.add(task.category);
      if (task.resourceId) resources.add(task.resourceId);
    });
    
    const eventTypes = new Set<string>();
    const eventSeverities = new Set<string>();
    
    events.forEach(event => {
      eventTypes.add(event.type);
      if (event.severity) eventSeverities.add(event.severity);
    });
    
    return {
      statuses: Array.from(statuses),
      priorities: Array.from(priorities),
      categories: Array.from(categories),
      resources: Array.from(resources),
      eventTypes: Array.from(eventTypes),
      eventSeverities: Array.from(eventSeverities)
    };
  }, [tasks, events]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.taskStatuses.size > 0) count += filter.taskStatuses.size;
    if (filter.taskPriorities.size > 0) count += filter.taskPriorities.size;
    if (filter.taskCategories.size > 0) count += filter.taskCategories.size;
    if (filter.taskResources.size > 0) count += filter.taskResources.size;
    if (filter.taskDateRange.start || filter.taskDateRange.end) count++;
    if (filter.taskProgressRange[0] > 0 || filter.taskProgressRange[1] < 100) count++;
    if (filter.showOnlyCriticalPath) count++;
    if (filter.showOnlyOverdue) count++;
    if (filter.showOnlyMilestones) count++;
    if (filter.eventTypes.size > 0) count += filter.eventTypes.size;
    if (filter.eventSeverities.size > 0) count += filter.eventSeverities.size;
    if (filter.searchText) count++;
    if (filter.hideCompleted) count++;
    return count;
  }, [filter]);

  const handleSectionToggle = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleCheckboxChange = (
    category: 'taskStatuses' | 'taskPriorities' | 'taskCategories' | 'taskResources' | 'eventTypes' | 'eventSeverities',
    value: string,
    checked: boolean
  ) => {
    const newSet = new Set(filter[category]);
    if (checked) {
      newSet.add(value);
    } else {
      newSet.delete(value);
    }
    onFilterChange({
      ...filter,
      [category]: newSet
    });
  };

  const handleProgressRangeChange = (event: Event, newValue: number | number[]) => {
    onFilterChange({
      ...filter,
      taskProgressRange: newValue as [number, number]
    });
  };

  const handleDateChange = (
    category: 'taskDateRange' | 'eventDateRange',
    field: 'start' | 'end',
    date: Date | null
  ) => {
    onFilterChange({
      ...filter,
      [category]: {
        ...filter[category],
        [field]: date
      }
    });
  };

  const handleBooleanFilterChange = (
    field: 'showOnlyCriticalPath' | 'showOnlyOverdue' | 'showOnlyMilestones' | 'hideCompleted' | 'hideEmpty',
    value: boolean
  ) => {
    onFilterChange({
      ...filter,
      [field]: value
    });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filter,
      searchText: event.target.value
    });
  };

  const handleClearFilters = () => {
    onFilterChange({
      taskStatuses: new Set(),
      taskPriorities: new Set(),
      taskCategories: new Set(),
      taskResources: new Set(),
      taskDateRange: { start: null, end: null },
      taskProgressRange: [0, 100],
      showOnlyCriticalPath: false,
      showOnlyOverdue: false,
      showOnlyMilestones: false,
      eventTypes: new Set(),
      eventSeverities: new Set(),
      eventDateRange: { start: null, end: null },
      searchText: '',
      hideCompleted: false,
      hideEmpty: false
    });
  };

  const handleSaveFilter = () => {
    if (filterName && onSaveFilter) {
      onSaveFilter(filterName, filter);
      setFilterName('');
    }
  };

  const handleLoadFilter = (savedFilter: TimelineFilter) => {
    if (onLoadFilter) {
      onLoadFilter(savedFilter);
    }
  };

  if (collapsed) {
    return (
      <Box
        sx={{
          position: 'fixed',
          [position]: 0,
          top: position === 'left' || position === 'right' ? '50%' : undefined,
          left: position === 'top' || position === 'bottom' ? '50%' : undefined,
          transform: 
            position === 'left' || position === 'right' 
              ? 'translateY(-50%)' 
              : 'translateX(-50%)',
          zIndex: theme.zIndex.drawer
        }}
      >
        <Tooltip title="Show Filters">
          <IconButton
            onClick={onToggleCollapse}
            sx={{
              backgroundColor: theme.palette.background.paper,
              boxShadow: theme.shadows[3],
              '&:hover': {
                backgroundColor: theme.palette.action.hover
              }
            }}
          >
            <Badge badgeContent={activeFilterCount} color="primary">
              <FilterListIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Paper
      elevation={3}
      sx={{
        width: position === 'left' || position === 'right' ? 320 : '100%',
        height: position === 'top' || position === 'bottom' ? 'auto' : '100%',
        maxHeight: position === 'top' || position === 'bottom' ? 400 : '100%',
        overflow: 'auto',
        p: 2
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <FilterListIcon sx={{ mr: 1 }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Timeline Filters
        </Typography>
        <Badge badgeContent={activeFilterCount} color="primary" sx={{ mr: 1 }}>
          <Box />
        </Badge>
        {onToggleCollapse && (
          <IconButton size="small" onClick={onToggleCollapse}>
            <VisibilityOffIcon />
          </IconButton>
        )}
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        size="small"
        placeholder="Search tasks and events..."
        value={filter.searchText}
        onChange={handleSearchChange}
        sx={{ mb: 2 }}
        InputProps={{
          endAdornment: filter.searchText && (
            <IconButton
              size="small"
              onClick={() => onFilterChange({ ...filter, searchText: '' })}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          )
        }}
      />

      {/* Quick Filters */}
      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Chip
          label="Critical Path"
          color={filter.showOnlyCriticalPath ? 'primary' : 'default'}
          onClick={() => handleBooleanFilterChange('showOnlyCriticalPath', !filter.showOnlyCriticalPath)}
          size="small"
        />
        <Chip
          label="Overdue"
          color={filter.showOnlyOverdue ? 'error' : 'default'}
          onClick={() => handleBooleanFilterChange('showOnlyOverdue', !filter.showOnlyOverdue)}
          size="small"
        />
        <Chip
          label="Milestones"
          color={filter.showOnlyMilestones ? 'primary' : 'default'}
          onClick={() => handleBooleanFilterChange('showOnlyMilestones', !filter.showOnlyMilestones)}
          icon={<FlagIcon />}
          size="small"
        />
        <Chip
          label="Hide Completed"
          color={filter.hideCompleted ? 'primary' : 'default'}
          onClick={() => handleBooleanFilterChange('hideCompleted', !filter.hideCompleted)}
          size="small"
        />
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Task Filters */}
      <Accordion 
        expanded={expandedSections.has('status')}
        onChange={() => handleSectionToggle('status')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Task Status</Typography>
          {filter.taskStatuses.size > 0 && (
            <Chip
              label={filter.taskStatuses.size}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {uniqueValues.statuses.map(status => (
              <FormControlLabel
                key={status}
                control={
                  <Checkbox
                    checked={filter.taskStatuses.has(status)}
                    onChange={(e) => handleCheckboxChange('taskStatuses', status, e.target.checked)}
                    size="small"
                  />
                }
                label={status}
              />
            ))}
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedSections.has('priority')}
        onChange={() => handleSectionToggle('priority')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Priority</Typography>
          {filter.taskPriorities.size > 0 && (
            <Chip
              label={filter.taskPriorities.size}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <FormGroup>
            {uniqueValues.priorities.map(priority => (
              <FormControlLabel
                key={priority}
                control={
                  <Checkbox
                    checked={filter.taskPriorities.has(priority)}
                    onChange={(e) => handleCheckboxChange('taskPriorities', priority, e.target.checked)}
                    size="small"
                  />
                }
                label={priority}
              />
            ))}
          </FormGroup>
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedSections.has('progress')}
        onChange={() => handleSectionToggle('progress')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Progress Range</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 2 }}>
            <Slider
              value={filter.taskProgressRange}
              onChange={handleProgressRangeChange}
              valueLabelDisplay="auto"
              min={0}
              max={100}
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' }
              ]}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedSections.has('dates')}
        onChange={() => handleSectionToggle('dates')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Date Range</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={2}>
              <DatePicker
                label="Start Date"
                value={filter.taskDateRange.start}
                onChange={(date) => handleDateChange('taskDateRange', 'start', date)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
              <DatePicker
                label="End Date"
                value={filter.taskDateRange.end}
                onChange={(date) => handleDateChange('taskDateRange', 'end', date)}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Stack>
          </LocalizationProvider>
        </AccordionDetails>
      </Accordion>

      {/* Event Filters */}
      {events.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Event Filters
          </Typography>
          
          <Accordion
            expanded={expandedSections.has('eventTypes')}
            onChange={() => handleSectionToggle('eventTypes')}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Event Types</Typography>
              {filter.eventTypes.size > 0 && (
                <Chip
                  label={filter.eventTypes.size}
                  size="small"
                  color="primary"
                  sx={{ ml: 1 }}
                />
              )}
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                {uniqueValues.eventTypes.map(type => (
                  <FormControlLabel
                    key={type}
                    control={
                      <Checkbox
                        checked={filter.eventTypes.has(type)}
                        onChange={(e) => handleCheckboxChange('eventTypes', type, e.target.checked)}
                        size="small"
                      />
                    }
                    label={type}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
        </>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Saved Filters
          </Typography>
          <Select
            fullWidth
            size="small"
            value=""
            onChange={(e) => {
              const selected = savedFilters.find(f => f.name === e.target.value);
              if (selected) handleLoadFilter(selected.filter);
            }}
            displayEmpty
          >
            <MenuItem value="">
              <em>Load saved filter...</em>
            </MenuItem>
            {savedFilters.map(sf => (
              <MenuItem key={sf.name} value={sf.name}>
                {sf.name}
              </MenuItem>
            ))}
          </Select>
        </Box>
      )}

      {/* Save Current Filter */}
      {onSaveFilter && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              placeholder="Filter name..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              onClick={handleSaveFilter}
              disabled={!filterName}
            >
              Save
            </Button>
          </Stack>
        </Box>
      )}

      {/* Action Buttons */}
      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button
          variant="outlined"
          size="small"
          startIcon={<ResetIcon />}
          onClick={handleClearFilters}
          disabled={activeFilterCount === 0}
        >
          Clear All
        </Button>
      </Stack>
    </Paper>
  );
};