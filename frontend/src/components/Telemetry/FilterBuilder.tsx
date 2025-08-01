import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  IconButton,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Alert,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Slider,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,
  Tune as TuneIcon,
  Timeline as TimelineIcon,
  ShowChart as ShowChartIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

// Filter types and interfaces
export interface FilterCondition {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'between' | 'in';
  value: any;
  value2?: any; // For 'between' operator
  enabled: boolean;
}

export interface FilterGroup {
  id: string;
  name: string;
  logicalOperator: 'AND' | 'OR';
  conditions: FilterCondition[];
  enabled: boolean;
}

export interface AdvancedFilter {
  id: string;
  name: string;
  description?: string;
  groups: FilterGroup[];
  timeFilter?: {
    enabled: boolean;
    startTime?: Date;
    endTime?: Date;
    relativePeriod?: {
      value: number;
      unit: 'seconds' | 'minutes' | 'hours' | 'days';
    };
  };
  samplingFilter?: {
    enabled: boolean;
    method: 'decimation' | 'averaging' | 'min' | 'max';
    factor: number;
  };
  statisticalFilter?: {
    enabled: boolean;
    removeOutliers: boolean;
    outlierMethod: 'zscore' | 'iqr';
    threshold: number;
    smoothing?: {
      enabled: boolean;
      method: 'moving_average' | 'exponential' | 'savgol';
      windowSize: number;
    };
  };
  frequencyFilter?: {
    enabled: boolean;
    type: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
    cutoffFreq?: number;
    lowCutoff?: number;
    highCutoff?: number;
    sampleRate: number;
  };
  created: Date;
  modified: Date;
}

export interface FilterTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  filter: Partial<AdvancedFilter>;
}

// Pre-defined filter templates
const FILTER_TEMPLATES: FilterTemplate[] = [
  {
    id: 'basic-range',
    name: 'Value Range Filter',
    description: 'Filter data within a specific value range',
    category: 'Basic',
    filter: {
      groups: [{
        id: 'range-group',
        name: 'Range',
        logicalOperator: 'AND',
        conditions: [{
          id: 'min-condition',
          field: 'value',
          operator: 'gte',
          value: 0,
          enabled: true
        }, {
          id: 'max-condition',
          field: 'value',
          operator: 'lte',
          value: 100,
          enabled: true
        }],
        enabled: true
      }]
    }
  },
  {
    id: 'time-window',
    name: 'Time Window Filter',
    description: 'Filter data within a specific time period',
    category: 'Time',
    filter: {
      timeFilter: {
        enabled: true,
        relativePeriod: {
          value: 1,
          unit: 'hours'
        }
      }
    }
  },
  {
    id: 'anomaly-removal',
    name: 'Anomaly Removal',
    description: 'Remove statistical outliers from data',
    category: 'Statistical',
    filter: {
      statisticalFilter: {
        enabled: true,
        removeOutliers: true,
        outlierMethod: 'zscore',
        threshold: 3
      }
    }
  },
  {
    id: 'noise-reduction',
    name: 'Noise Reduction',
    description: 'Apply low-pass filter to reduce high-frequency noise',
    category: 'Signal Processing',
    filter: {
      frequencyFilter: {
        enabled: true,
        type: 'lowpass',
        cutoffFreq: 10,
        sampleRate: 100
      }
    }
  },
  {
    id: 'data-decimation',
    name: 'Data Decimation',
    description: 'Reduce data points by sampling every Nth point',
    category: 'Sampling',
    filter: {
      samplingFilter: {
        enabled: true,
        method: 'decimation',
        factor: 10
      }
    }
  }
];

interface FilterBuilderProps {
  onFilterChange?: (filter: AdvancedFilter) => void;
  onSaveFilter?: (filter: AdvancedFilter) => void;
  onLoadFilter?: (filterId: string) => void;
  availableFields?: Array<{ name: string; type: string; description?: string }>;
  initialFilter?: Partial<AdvancedFilter>;
  savedFilters?: AdvancedFilter[];
  className?: string;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({
  onFilterChange,
  onSaveFilter,
  onLoadFilter,
  availableFields = [
    { name: 'value', type: 'number', description: 'Data value' },
    { name: 'timestamp', type: 'datetime', description: 'Time of measurement' },
    { name: 'quality', type: 'number', description: 'Data quality score' },
    { name: 'source', type: 'string', description: 'Data source' },
  ],
  initialFilter,
  savedFilters = [],
  className = ''
}) => {
  const [filter, setFilter] = useState<AdvancedFilter>(() => ({
    id: `filter-${Date.now()}`,
    name: 'New Filter',
    description: '',
    groups: [{
      id: `group-${Date.now()}`,
      name: 'Filter Group 1',
      logicalOperator: 'AND',
      conditions: [],
      enabled: true
    }],
    timeFilter: {
      enabled: false,
    },
    samplingFilter: {
      enabled: false,
      method: 'decimation',
      factor: 2,
    },
    statisticalFilter: {
      enabled: false,
      removeOutliers: false,
      outlierMethod: 'zscore',
      threshold: 3,
    },
    frequencyFilter: {
      enabled: false,
      type: 'lowpass',
      cutoffFreq: 10,
      sampleRate: 100,
    },
    created: new Date(),
    modified: new Date(),
    ...initialFilter
  }));

  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [expanded, setExpanded] = useState<string>('basic-filters');

  useEffect(() => {
    onFilterChange?.(filter);
  }, [filter, onFilterChange]);

  const handleFilterChange = useCallback((updates: Partial<AdvancedFilter>) => {
    setFilter(prev => ({
      ...prev,
      ...updates,
      modified: new Date()
    }));
  }, []);

  const addFilterGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      id: `group-${Date.now()}`,
      name: `Filter Group ${filter.groups.length + 1}`,
      logicalOperator: 'AND',
      conditions: [],
      enabled: true
    };

    handleFilterChange({
      groups: [...filter.groups, newGroup]
    });
  }, [filter.groups, handleFilterChange]);

  const removeFilterGroup = useCallback((groupId: string) => {
    if (filter.groups.length <= 1) return; // Keep at least one group

    handleFilterChange({
      groups: filter.groups.filter(g => g.id !== groupId)
    });
  }, [filter.groups, handleFilterChange]);

  const updateFilterGroup = useCallback((groupId: string, updates: Partial<FilterGroup>) => {
    handleFilterChange({
      groups: filter.groups.map(g => 
        g.id === groupId ? { ...g, ...updates } : g
      )
    });
  }, [filter.groups, handleFilterChange]);

  const addCondition = useCallback((groupId: string) => {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
      field: availableFields[0]?.name || 'value',
      operator: 'eq',
      value: '',
      enabled: true
    };

    const updatedGroups = filter.groups.map(g => 
      g.id === groupId 
        ? { ...g, conditions: [...g.conditions, newCondition] }
        : g
    );

    handleFilterChange({ groups: updatedGroups });
  }, [filter.groups, availableFields, handleFilterChange]);

  const removeCondition = useCallback((groupId: string, conditionId: string) => {
    const updatedGroups = filter.groups.map(g => 
      g.id === groupId 
        ? { ...g, conditions: g.conditions.filter(c => c.id !== conditionId) }
        : g
    );

    handleFilterChange({ groups: updatedGroups });
  }, [filter.groups, handleFilterChange]);

  const updateCondition = useCallback((groupId: string, conditionId: string, updates: Partial<FilterCondition>) => {
    const updatedGroups = filter.groups.map(g => 
      g.id === groupId 
        ? {
            ...g, 
            conditions: g.conditions.map(c => 
              c.id === conditionId ? { ...c, ...updates } : c
            )
          }
        : g
    );

    handleFilterChange({ groups: updatedGroups });
  }, [filter.groups, handleFilterChange]);

  const applyTemplate = useCallback((template: FilterTemplate) => {
    const templateFilter = {
      ...filter,
      ...template.filter,
      name: template.name,
      description: template.description,
      id: `filter-${Date.now()}`,
      created: new Date(),
      modified: new Date()
    };

    setFilter(templateFilter);
    setShowTemplates(false);
  }, [filter]);

  const handleSave = useCallback(() => {
    onSaveFilter?.(filter);
    setShowSaveDialog(false);
  }, [filter, onSaveFilter]);

  const renderCondition = (groupId: string, condition: FilterCondition) => (
    <Card key={condition.id} variant="outlined" sx={{ mb: 1 }}>
      <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={1}>
            <Switch
              checked={condition.enabled}
              onChange={(e) => updateCondition(groupId, condition.id, { enabled: e.target.checked })}
              size="small"
            />
          </Grid>
          
          <Grid item xs={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Field</InputLabel>
              <Select
                value={condition.field}
                onChange={(e) => updateCondition(groupId, condition.id, { field: e.target.value })}
                label="Field"
              >
                {availableFields.map(field => (
                  <MenuItem key={field.name} value={field.name}>
                    {field.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Operator</InputLabel>
              <Select
                value={condition.operator}
                onChange={(e) => updateCondition(groupId, condition.id, { operator: e.target.value as any })}
                label="Operator"
              >
                <MenuItem value="eq">Equals</MenuItem>
                <MenuItem value="ne">Not Equals</MenuItem>
                <MenuItem value="gt">Greater Than</MenuItem>
                <MenuItem value="gte">Greater or Equal</MenuItem>
                <MenuItem value="lt">Less Than</MenuItem>
                <MenuItem value="lte">Less or Equal</MenuItem>
                <MenuItem value="contains">Contains</MenuItem>
                <MenuItem value="between">Between</MenuItem>
                <MenuItem value="in">In List</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={condition.operator === 'between' ? 2 : 4}>
            <TextField
              fullWidth
              size="small"
              label="Value"
              value={condition.value}
              onChange={(e) => updateCondition(groupId, condition.id, { value: e.target.value })}
            />
          </Grid>

          {condition.operator === 'between' && (
            <Grid item xs={2}>
              <TextField
                fullWidth
                size="small"
                label="To"
                value={condition.value2 || ''}
                onChange={(e) => updateCondition(groupId, condition.id, { value2: e.target.value })}
              />
            </Grid>
          )}

          <Grid item xs={1}>
            <IconButton
              size="small"
              color="error"
              onClick={() => removeCondition(groupId, condition.id)}
            >
              <DeleteIcon />
            </IconButton>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const renderFilterGroup = (group: FilterGroup, index: number) => (
    <Card key={group.id} sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Switch
              checked={group.enabled}
              onChange={(e) => updateFilterGroup(group.id, { enabled: e.target.checked })}
            />
            <TextField
              size="small"
              value={group.name}
              onChange={(e) => updateFilterGroup(group.id, { name: e.target.value })}
              sx={{ minWidth: 200 }}
            />
            
            {index > 0 && (
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <InputLabel>Logic</InputLabel>
                <Select
                  value={group.logicalOperator}
                  onChange={(e) => updateFilterGroup(group.id, { logicalOperator: e.target.value as 'AND' | 'OR' })}
                  label="Logic"
                >
                  <MenuItem value="AND">AND</MenuItem>
                  <MenuItem value="OR">OR</MenuItem>
                </Select>
              </FormControl>
            )}
          </Box>

          <Box>
            <Button
              startIcon={<AddIcon />}
              onClick={() => addCondition(group.id)}
              size="small"
              variant="outlined"
              sx={{ mr: 1 }}
            >
              Add Condition
            </Button>
            
            {filter.groups.length > 1 && (
              <IconButton
                color="error"
                onClick={() => removeFilterGroup(group.id)}
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Box>

        <Box>
          {group.conditions.map(condition => renderCondition(group.id, condition))}
          
          {group.conditions.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No conditions in this group. Click "Add Condition" to add filters.
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box className={className}>
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <FilterListIcon />
            <Typography variant="h6">Filter Builder</Typography>
          </Box>
          
          <Box display="flex" gap={1}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => setShowTemplates(true)}
              variant="outlined"
              size="small"
            >
              Templates
            </Button>
            
            <Button
              startIcon={<SaveIcon />}
              onClick={() => setShowSaveDialog(true)}
              variant="contained"
              size="small"
            >
              Save
            </Button>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Filter Name"
              value={filter.name}
              onChange={(e) => handleFilterChange({ name: e.target.value })}
              size="small"
            />
          </Grid>
          
          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Description"
              value={filter.description || ''}
              onChange={(e) => handleFilterChange({ description: e.target.value })}
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Basic Filters */}
      <Accordion expanded={expanded === 'basic-filters'} onChange={() => setExpanded(expanded === 'basic-filters' ? '' : 'basic-filters')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FilterListIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Basic Filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {filter.groups.map((group, index) => renderFilterGroup(group, index))}
          
          <Button
            startIcon={<AddIcon />}
            onClick={addFilterGroup}
            variant="outlined"
            fullWidth
            sx={{ mt: 2 }}
          >
            Add Filter Group
          </Button>
        </AccordionDetails>
      </Accordion>

      {/* Time Filters */}
      <Accordion expanded={expanded === 'time-filters'} onChange={() => setExpanded(expanded === 'time-filters' ? '' : 'time-filters')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TimelineIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Time Filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={filter.timeFilter?.enabled || false}
                onChange={(e) => handleFilterChange({
                  timeFilter: { ...filter.timeFilter, enabled: e.target.checked }
                })}
              />
            }
            label="Enable Time Filtering"
            sx={{ mb: 2 }}
          />

          {filter.timeFilter?.enabled && (
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Period</InputLabel>
                  <Select
                    value={filter.timeFilter?.relativePeriod?.value || 1}
                    onChange={(e) => handleFilterChange({
                      timeFilter: {
                        ...filter.timeFilter,
                        relativePeriod: {
                          ...filter.timeFilter?.relativePeriod,
                          value: Number(e.target.value)
                        }
                      }
                    })}
                    label="Period"
                  >
                    {[1, 5, 15, 30, 60].map(val => (
                      <MenuItem key={val} value={val}>{val}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={filter.timeFilter?.relativePeriod?.unit || 'minutes'}
                    onChange={(e) => handleFilterChange({
                      timeFilter: {
                        ...filter.timeFilter,
                        relativePeriod: {
                          ...filter.timeFilter?.relativePeriod,
                          unit: e.target.value as any
                        }
                      }
                    })}
                    label="Unit"
                  >
                    <MenuItem value="seconds">Seconds</MenuItem>
                    <MenuItem value="minutes">Minutes</MenuItem>
                    <MenuItem value="hours">Hours</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Statistical Filters */}
      <Accordion expanded={expanded === 'statistical-filters'} onChange={() => setExpanded(expanded === 'statistical-filters' ? '' : 'statistical-filters')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TuneIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Statistical Filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={filter.statisticalFilter?.enabled || false}
                onChange={(e) => handleFilterChange({
                  statisticalFilter: { ...filter.statisticalFilter, enabled: e.target.checked }
                })}
              />
            }
            label="Enable Statistical Filtering"
            sx={{ mb: 2 }}
          />

          {filter.statisticalFilter?.enabled && (
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={filter.statisticalFilter?.removeOutliers || false}
                    onChange={(e) => handleFilterChange({
                      statisticalFilter: {
                        ...filter.statisticalFilter,
                        removeOutliers: e.target.checked
                      }
                    })}
                  />
                }
                label="Remove Outliers"
                sx={{ mb: 2 }}
              />

              {filter.statisticalFilter?.removeOutliers && (
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Method</InputLabel>
                      <Select
                        value={filter.statisticalFilter?.outlierMethod || 'zscore'}
                        onChange={(e) => handleFilterChange({
                          statisticalFilter: {
                            ...filter.statisticalFilter,
                            outlierMethod: e.target.value as any
                          }
                        })}
                        label="Method"
                      >
                        <MenuItem value="zscore">Z-Score</MenuItem>
                        <MenuItem value="iqr">Interquartile Range</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Threshold"
                      type="number"
                      value={filter.statisticalFilter?.threshold || 3}
                      onChange={(e) => handleFilterChange({
                        statisticalFilter: {
                          ...filter.statisticalFilter,
                          threshold: Number(e.target.value)
                        }
                      })}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Frequency Filters */}
      <Accordion expanded={expanded === 'frequency-filters'} onChange={() => setExpanded(expanded === 'frequency-filters' ? '' : 'frequency-filters')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <ShowChartIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Frequency Filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={filter.frequencyFilter?.enabled || false}
                onChange={(e) => handleFilterChange({
                  frequencyFilter: { ...filter.frequencyFilter, enabled: e.target.checked }
                })}
              />
            }
            label="Enable Frequency Filtering"
            sx={{ mb: 2 }}
          />

          {filter.frequencyFilter?.enabled && (
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Filter Type</InputLabel>
                  <Select
                    value={filter.frequencyFilter?.type || 'lowpass'}
                    onChange={(e) => handleFilterChange({
                      frequencyFilter: {
                        ...filter.frequencyFilter,
                        type: e.target.value as any
                      }
                    })}
                    label="Filter Type"
                  >
                    <MenuItem value="lowpass">Low Pass</MenuItem>
                    <MenuItem value="highpass">High Pass</MenuItem>
                    <MenuItem value="bandpass">Band Pass</MenuItem>
                    <MenuItem value="notch">Notch</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Cutoff Frequency (Hz)"
                  type="number"
                  value={filter.frequencyFilter?.cutoffFreq || 10}
                  onChange={(e) => handleFilterChange({
                    frequencyFilter: {
                      ...filter.frequencyFilter,
                      cutoffFreq: Number(e.target.value)
                    }
                  })}
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Sample Rate (Hz)"
                  type="number"
                  value={filter.frequencyFilter?.sampleRate || 100}
                  onChange={(e) => handleFilterChange({
                    frequencyFilter: {
                      ...filter.frequencyFilter,
                      sampleRate: Number(e.target.value)
                    }
                  })}
                />
              </Grid>
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Sampling Filters */}
      <Accordion expanded={expanded === 'sampling-filters'} onChange={() => setExpanded(expanded === 'sampling-filters' ? '' : 'sampling-filters')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SettingsIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Sampling Filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <FormControlLabel
            control={
              <Switch
                checked={filter.samplingFilter?.enabled || false}
                onChange={(e) => handleFilterChange({
                  samplingFilter: { ...filter.samplingFilter, enabled: e.target.checked }
                })}
              />
            }
            label="Enable Sampling Filter"
            sx={{ mb: 2 }}
          />

          {filter.samplingFilter?.enabled && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Method</InputLabel>
                  <Select
                    value={filter.samplingFilter?.method || 'decimation'}
                    onChange={(e) => handleFilterChange({
                      samplingFilter: {
                        ...filter.samplingFilter,
                        method: e.target.value as any
                      }
                    })}
                    label="Method"
                  >
                    <MenuItem value="decimation">Decimation</MenuItem>
                    <MenuItem value="averaging">Averaging</MenuItem>
                    <MenuItem value="min">Minimum</MenuItem>
                    <MenuItem value="max">Maximum</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Factor"
                  type="number"
                  value={filter.samplingFilter?.factor || 2}
                  onChange={(e) => handleFilterChange({
                    samplingFilter: {
                      ...filter.samplingFilter,
                      factor: Number(e.target.value)
                    }
                  })}
                />
              </Grid>
            </Grid>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Filter Templates Dialog */}
      <Dialog
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Filter Templates</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {Object.entries(
              FILTER_TEMPLATES.reduce((acc, template) => {
                if (!acc[template.category]) acc[template.category] = [];
                acc[template.category].push(template);
                return acc;
              }, {} as Record<string, FilterTemplate[]>)
            ).map(([category, templates]) => (
              <Grid item xs={12} key={category}>
                <Typography variant="h6" sx={{ mb: 1 }}>{category}</Typography>
                <List dense>
                  {templates.map(template => (
                    <ListItem
                      key={template.id}
                      button
                      onClick={() => applyTemplate(template)}
                    >
                      <ListItemIcon>
                        <FilterListIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary={template.name}
                        secondary={template.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowTemplates(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Save Filter Dialog */}
      <Dialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save Filter</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Filter Name"
            value={filter.name}
            onChange={(e) => handleFilterChange({ name: e.target.value })}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={3}
            value={filter.description || ''}
            onChange={(e) => handleFilterChange({ description: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FilterBuilder;