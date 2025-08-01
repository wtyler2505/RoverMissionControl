import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Divider,
  Paper,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Badge,
  Slider,
  InputAdornment,
  Autocomplete,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Copy as CopyIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Merge as MergeIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  PlayArrow as TestIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Types
export interface ThresholdDefinition {
  id: string;
  name: string;
  description?: string;
  metricId: string;
  metricName: string;
  type: 'static' | 'dynamic_percentile' | 'dynamic_stddev' | 'conditional' | 'time_based' | 'rate_of_change';
  severity: 'info' | 'warning' | 'error' | 'critical';
  enabled: boolean;
  
  // Static threshold config
  value?: number;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'in_range' | 'out_of_range';
  lowerBound?: number;
  upperBound?: number;
  
  // Dynamic threshold config
  baselineWindow?: { value: number; unit: 'minutes' | 'hours' | 'days' };
  evaluationMethod?: 'percentile' | 'stddev' | 'moving_avg';
  percentile?: number;
  stddevMultiplier?: number;
  smoothingFactor?: number;
  minDataPoints?: number;
  
  // Conditional config
  conditionMetric?: string;
  conditionOperator?: 'gt' | 'lt' | 'eq';
  conditionValue?: number;
  
  // General settings
  hysteresis?: number;
  consecutiveViolations?: number;
  debounceTime?: { value: number; unit: 'seconds' | 'minutes' };
  
  // Metadata
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface ThresholdTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  thresholdType: string;
  config: any;
  requiredVariables: string[];
  optionalVariables: string[];
  isSystem: boolean;
  tags: string[];
}

interface ThresholdManagerProps {
  metricId?: string;
  metricName?: string;
  thresholds: ThresholdDefinition[];
  templates: ThresholdTemplate[];
  availableMetrics: Array<{ id: string; name: string; unit?: string }>;
  onThresholdCreate: (threshold: Partial<ThresholdDefinition>) => Promise<ThresholdDefinition>;
  onThresholdUpdate: (id: string, updates: Partial<ThresholdDefinition>) => Promise<ThresholdDefinition>;
  onThresholdDelete: (id: string) => Promise<void>;
  onThresholdTest: (id: string, testValue?: number) => Promise<any>;
  onTemplateApply: (templateId: string, variables: Record<string, any>) => Promise<any>;
  onBulkOperation: (operation: string, thresholdIds: string[], updates?: any) => Promise<any>;
  onImportExport: (action: 'import' | 'export', data?: any) => Promise<any>;
}

const SEVERITY_COLORS = {
  info: '#2196f3',
  warning: '#ff9800',
  error: '#f44336',
  critical: '#9c27b0'
};

const SEVERITY_ICONS = {
  info: <InfoIcon />,
  warning: <WarningIcon />,
  error: <ErrorIcon />,
  critical: <ErrorIcon />
};

const THRESHOLD_TYPE_ICONS = {
  static: <TimelineIcon />,
  dynamic_percentile: <TrendingUpIcon />,
  dynamic_stddev: <TrendingUpIcon />,
  conditional: <MergeIcon />,
  time_based: <ScheduleIcon />,
  rate_of_change: <TrendingUpIcon />
};

export const ThresholdManager: React.FC<ThresholdManagerProps> = ({
  metricId,
  metricName,
  thresholds,
  templates,
  availableMetrics,
  onThresholdCreate,
  onThresholdUpdate,
  onThresholdDelete,
  onThresholdTest,
  onTemplateApply,
  onBulkOperation,
  onImportExport
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [editingThreshold, setEditingThreshold] = useState<Partial<ThresholdDefinition> | null>(null);
  const [showThresholdDialog, setShowThresholdDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ThresholdTemplate | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({});
  const [selectedThresholds, setSelectedThresholds] = useState<Set<string>>(new Set());
  const [bulkOperation, setBulkOperation] = useState<string>('');
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<string>('all');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Filtered thresholds
  const filteredThresholds = useMemo(() => {
    return thresholds.filter(threshold => {
      // Text filter
      if (filterText) {
        const searchText = filterText.toLowerCase();
        if (!threshold.name.toLowerCase().includes(searchText) &&
            !threshold.description?.toLowerCase().includes(searchText) &&
            !threshold.metricName.toLowerCase().includes(searchText)) {
          return false;
        }
      }
      
      // Type filter
      if (filterType !== 'all' && threshold.type !== filterType) {
        return false;
      }
      
      // Severity filter
      if (filterSeverity !== 'all' && threshold.severity !== filterSeverity) {
        return false;
      }
      
      // Enabled filter
      if (filterEnabled === 'enabled' && !threshold.enabled) {
        return false;
      }
      if (filterEnabled === 'disabled' && threshold.enabled) {
        return false;
      }
      
      return true;
    });
  }, [thresholds, filterText, filterType, filterSeverity, filterEnabled]);
  
  // Statistics
  const stats = useMemo(() => {
    const total = thresholds.length;
    const enabled = thresholds.filter(t => t.enabled).length;
    const byType = thresholds.reduce((acc, t) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const bySeverity = thresholds.reduce((acc, t) => {
      acc[t.severity] = (acc[t.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return { total, enabled, byType, bySeverity };
  }, [thresholds]);
  
  // Create new threshold
  const createNewThreshold = useCallback((): Partial<ThresholdDefinition> => ({
    name: 'New Threshold',
    description: '',
    metricId: metricId || availableMetrics[0]?.id || '',
    metricName: metricName || availableMetrics[0]?.name || '',
    type: 'static',
    severity: 'warning',
    enabled: true,
    operator: 'gt',
    value: 100,
    consecutiveViolations: 1,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }), [metricId, metricName, availableMetrics]);
  
  // Handle threshold save
  const handleSaveThreshold = useCallback(async () => {
    if (!editingThreshold) return;
    
    try {
      if (editingThreshold.id) {
        // Update existing
        await onThresholdUpdate(editingThreshold.id, editingThreshold);
        setSnackbar({
          open: true,
          message: 'Threshold updated successfully',
          severity: 'success'
        });
      } else {
        // Create new
        await onThresholdCreate(editingThreshold);
        setSnackbar({
          open: true,
          message: 'Threshold created successfully',
          severity: 'success'
        });
      }
      
      setShowThresholdDialog(false);
      setEditingThreshold(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to save threshold: ${error}`,
        severity: 'error'
      });
    }
  }, [editingThreshold, onThresholdCreate, onThresholdUpdate]);
  
  // Handle threshold delete
  const handleDeleteThreshold = useCallback(async (thresholdId: string) => {
    try {
      await onThresholdDelete(thresholdId);
      setSnackbar({
        open: true,
        message: 'Threshold deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to delete threshold: ${error}`,
        severity: 'error'
      });
    }
  }, [onThresholdDelete]);
  
  // Handle threshold test
  const handleTestThreshold = useCallback(async (thresholdId: string) => {
    try {
      const result = await onThresholdTest(thresholdId);
      setSnackbar({
        open: true,
        message: `Test completed: ${result.alertTriggered ? 'Alert triggered' : 'No alert'}`,
        severity: result.alertTriggered ? 'warning' : 'success'
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Test failed: ${error}`,
        severity: 'error'
      });
    }
  }, [onThresholdTest]);
  
  // Handle template apply
  const handleApplyTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    
    try {
      const result = await onTemplateApply(selectedTemplate.id, templateVariables);
      setSnackbar({
        open: true,
        message: `Template applied: Created threshold "${result.threshold.name}"`,
        severity: 'success'
      });
      setShowTemplateDialog(false);
      setSelectedTemplate(null);
      setTemplateVariables({});
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to apply template: ${error}`,
        severity: 'error'
      });
    }
  }, [selectedTemplate, templateVariables, onTemplateApply]);
  
  // Handle bulk operations
  const handleBulkOperation = useCallback(async () => {
    if (!bulkOperation || selectedThresholds.size === 0) return;
    
    try {
      const thresholdIds = Array.from(selectedThresholds);
      const result = await onBulkOperation(bulkOperation, thresholdIds);
      
      setSnackbar({
        open: true,
        message: `Bulk operation completed: ${result.success} succeeded, ${result.failed} failed`,
        severity: result.failed > 0 ? 'warning' : 'success'
      });
      
      setSelectedThresholds(new Set());
      setBulkOperation('');
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Bulk operation failed: ${error}`,
        severity: 'error'
      });
    }
  }, [bulkOperation, selectedThresholds, onBulkOperation]);
  
  // Render threshold form
  const renderThresholdForm = () => {
    if (!editingThreshold) return null;
    
    return (
      <Dialog
        open={showThresholdDialog}
        onClose={() => setShowThresholdDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingThreshold.id ? 'Edit Threshold' : 'Create Threshold'}
        </DialogTitle>
        
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Basic Information */}
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Threshold Name"
                value={editingThreshold.name || ''}
                onChange={(e) => setEditingThreshold(prev => prev ? {...prev, name: e.target.value} : null)}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={availableMetrics}
                getOptionLabel={(option) => option.name}
                value={availableMetrics.find(m => m.id === editingThreshold.metricId) || null}
                onChange={(_, value) => {
                  setEditingThreshold(prev => prev ? {
                    ...prev,
                    metricId: value?.id || '',
                    metricName: value?.name || ''
                  } : null);
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Metric" />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={editingThreshold.description || ''}
                onChange={(e) => setEditingThreshold(prev => prev ? {...prev, description: e.target.value} : null)}
                multiline
                rows={2}
              />
            </Grid>
            
            {/* Threshold Configuration */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Threshold Type</InputLabel>
                <Select
                  value={editingThreshold.type || 'static'}
                  onChange={(e) => setEditingThreshold(prev => prev ? {...prev, type: e.target.value as any} : null)}
                  label="Threshold Type"
                >
                  <MenuItem value="static">Static Value</MenuItem>
                  <MenuItem value="dynamic_percentile">Dynamic Percentile</MenuItem>
                  <MenuItem value="dynamic_stddev">Dynamic Standard Deviation</MenuItem>
                  <MenuItem value="conditional">Conditional</MenuItem>
                  <MenuItem value="time_based">Time-based</MenuItem>
                  <MenuItem value="rate_of_change">Rate of Change</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={editingThreshold.severity || 'warning'}
                  onChange={(e) => setEditingThreshold(prev => prev ? {...prev, severity: e.target.value as any} : null)}
                  label="Severity"
                >
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Static Threshold Configuration */}
            {editingThreshold.type === 'static' && (
              <>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Operator</InputLabel>
                    <Select
                      value={editingThreshold.operator || 'gt'}
                      onChange={(e) => setEditingThreshold(prev => prev ? {...prev, operator: e.target.value as any} : null)}
                      label="Operator"
                    >
                      <MenuItem value="gt">Greater Than</MenuItem>
                      <MenuItem value="gte">Greater Than or Equal</MenuItem>
                      <MenuItem value="lt">Less Than</MenuItem>
                      <MenuItem value="lte">Less Than or Equal</MenuItem>
                      <MenuItem value="eq">Equal To</MenuItem>
                      <MenuItem value="neq">Not Equal To</MenuItem>
                      <MenuItem value="in_range">In Range</MenuItem>
                      <MenuItem value="out_of_range">Out of Range</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Threshold Value"
                    type="number"
                    value={editingThreshold.value || ''}
                    onChange={(e) => setEditingThreshold(prev => prev ? {...prev, value: Number(e.target.value)} : null)}
                  />
                </Grid>
                
                {(editingThreshold.operator === 'in_range' || editingThreshold.operator === 'out_of_range') && (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Lower Bound"
                        type="number"
                        value={editingThreshold.lowerBound || ''}
                        onChange={(e) => setEditingThreshold(prev => prev ? {...prev, lowerBound: Number(e.target.value)} : null)}
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Upper Bound"
                        type="number"
                        value={editingThreshold.upperBound || ''}
                        onChange={(e) => setEditingThreshold(prev => prev ? {...prev, upperBound: Number(e.target.value)} : null)}
                      />
                    </Grid>
                  </>
                )}
              </>
            )}
            
            {/* Dynamic Threshold Configuration */}
            {(editingThreshold.type?.startsWith('dynamic_') || editingThreshold.type === 'rate_of_change') && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Baseline Window"
                    type="number"
                    value={editingThreshold.baselineWindow?.value || 24}
                    onChange={(e) => setEditingThreshold(prev => prev ? {
                      ...prev,
                      baselineWindow: { value: Number(e.target.value), unit: 'hours' }
                    } : null)}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">hours</InputAdornment>
                    }}
                  />
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Min Data Points"
                    type="number"
                    value={editingThreshold.minDataPoints || 10}
                    onChange={(e) => setEditingThreshold(prev => prev ? {...prev, minDataPoints: Number(e.target.value)} : null)}
                  />
                </Grid>
                
                {editingThreshold.type === 'dynamic_percentile' && (
                  <Grid item xs={12} md={6}>
                    <Box>
                      <Typography gutterBottom>Percentile: {editingThreshold.percentile || 95}%</Typography>
                      <Slider
                        value={editingThreshold.percentile || 95}
                        onChange={(_, value) => setEditingThreshold(prev => prev ? {...prev, percentile: value as number} : null)}
                        min={50}
                        max={99}
                        step={1}
                        marks={[
                          { value: 50, label: '50%' },
                          { value: 95, label: '95%' },
                          { value: 99, label: '99%' }
                        ]}
                      />
                    </Box>
                  </Grid>
                )}
                
                {editingThreshold.type === 'dynamic_stddev' && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Standard Deviation Multiplier"
                      type="number"
                      step="0.1"
                      value={editingThreshold.stddevMultiplier || 2}
                      onChange={(e) => setEditingThreshold(prev => prev ? {...prev, stddevMultiplier: Number(e.target.value)} : null)}
                    />
                  </Grid>
                )}
              </>
            )}
            
            {/* Advanced Settings */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Advanced Settings</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Hysteresis"
                        type="number"
                        value={editingThreshold.hysteresis || ''}
                        onChange={(e) => setEditingThreshold(prev => prev ? {...prev, hysteresis: Number(e.target.value)} : null)}
                        helperText="Prevents flapping by requiring value to exceed threshold by this amount"
                      />
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Consecutive Violations"
                        type="number"
                        value={editingThreshold.consecutiveViolations || 1}
                        onChange={(e) => setEditingThreshold(prev => prev ? {...prev, consecutiveViolations: Number(e.target.value)} : null)}
                        helperText="Number of consecutive violations required to trigger alert"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
            
            {/* Tags */}
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={editingThreshold.tags || []}
                onChange={(_, value) => setEditingThreshold(prev => prev ? {...prev, tags: value} : null)}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    placeholder="Add tags..."
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowThresholdDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveThreshold} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  // Render template dialog
  const renderTemplateDialog = () => {
    if (!selectedTemplate) return null;
    
    return (
      <Dialog
        open={showTemplateDialog}
        onClose={() => setShowTemplateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Apply Template: {selectedTemplate.name}</DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            {selectedTemplate.description}
          </Typography>
          
          <Grid container spacing={2}>
            {selectedTemplate.requiredVariables.map(variable => (
              <Grid item xs={12} key={variable}>
                <TextField
                  fullWidth
                  label={variable.replace('_', ' ').toUpperCase()}
                  value={templateVariables[variable] || ''}
                  onChange={(e) => setTemplateVariables(prev => ({
                    ...prev,
                    [variable]: e.target.value
                  }))}
                  required
                />
              </Grid>
            ))}
            
            {selectedTemplate.optionalVariables.map(variable => (
              <Grid item xs={12} key={variable}>
                <TextField
                  fullWidth
                  label={`${variable.replace('_', ' ').toUpperCase()} (Optional)`}
                  value={templateVariables[variable] || ''}
                  onChange={(e) => setTemplateVariables(prev => ({
                    ...prev,
                    [variable]: e.target.value
                  }))}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setShowTemplateDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleApplyTemplate}
            variant="contained"
            disabled={selectedTemplate.requiredVariables.some(v => !templateVariables[v])}
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>
    );
  };
  
  return (
    <Box>
      {/* Header with Statistics */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h5" component="h2">
              Threshold Manager
            </Typography>
            
            <Box display="flex" gap={1}>
              <Button
                startIcon={<UploadIcon />}
                onClick={() => onImportExport('import')}
                variant="outlined"
                size="small"
              >
                Import
              </Button>
              
              <Button
                startIcon={<DownloadIcon />}
                onClick={() => onImportExport('export')}
                variant="outlined"
                size="small"
              >
                Export
              </Button>
              
              <Button
                startIcon={<AddIcon />}
                onClick={() => {
                  setEditingThreshold(createNewThreshold());
                  setShowThresholdDialog(true);
                }}
                variant="contained"
                size="small"
              >
                Add Threshold
              </Button>
            </Box>
          </Box>
          
          {/* Statistics */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {stats.total}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Thresholds
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="success.main">
                  {stats.enabled}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Enabled
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="warning.main">
                  {stats.bySeverity.warning || 0}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Warning Level
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h4" color="error.main">
                  {(stats.bySeverity.error || 0) + (stats.bySeverity.critical || 0)}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Error/Critical
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab 
            label="Thresholds" 
            icon={<Badge badgeContent={stats.total} color="primary">
              <TimelineIcon />
            </Badge>} 
          />
          <Tab 
            label="Templates" 
            icon={<Badge badgeContent={templates.length} color="secondary">
              <SettingsIcon />
            </Badge>} 
          />
        </Tabs>
      </Box>
      
      {/* Thresholds Tab */}
      {tabValue === 0 && (
        <>
          {/* Filters and Bulk Operations */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Search"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    size="small"
                  />
                </Grid>
                
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      label="Type"
                    >
                      <MenuItem value="all">All Types</MenuItem>
                      <MenuItem value="static">Static</MenuItem>
                      <MenuItem value="dynamic_percentile">Dynamic Percentile</MenuItem>
                      <MenuItem value="dynamic_stddev">Dynamic StdDev</MenuItem>
                      <MenuItem value="conditional">Conditional</MenuItem>
                      <MenuItem value="time_based">Time-based</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      label="Severity"
                    >
                      <MenuItem value="all">All Severities</MenuItem>
                      <MenuItem value="info">Info</MenuItem>
                      <MenuItem value="warning">Warning</MenuItem>
                      <MenuItem value="error">Error</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterEnabled}
                      onChange={(e) => setFilterEnabled(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="enabled">Enabled</MenuItem>
                      <MenuItem value="disabled">Disabled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Box display="flex" gap={1}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Bulk Action</InputLabel>
                      <Select
                        value={bulkOperation}
                        onChange={(e) => setBulkOperation(e.target.value)}
                        label="Bulk Action"
                        disabled={selectedThresholds.size === 0}
                      >
                        <MenuItem value="enable">Enable</MenuItem>
                        <MenuItem value="disable">Disable</MenuItem>
                        <MenuItem value="delete">Delete</MenuItem>
                      </Select>
                    </FormControl>
                    
                    <Button
                      onClick={handleBulkOperation}
                      disabled={!bulkOperation || selectedThresholds.size === 0}
                      variant="outlined"
                      size="small"
                    >
                      Apply ({selectedThresholds.size})
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
          
          {/* Thresholds List */}
          <Grid container spacing={2}>
            {filteredThresholds.map(threshold => (
              <Grid item xs={12} key={threshold.id}>
                <Card 
                  variant={threshold.enabled ? "elevation" : "outlined"}
                  sx={{
                    borderLeft: `4px solid ${SEVERITY_COLORS[threshold.severity]}`,
                    opacity: threshold.enabled ? 1 : 0.7
                  }}
                >
                  <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                      <Box display="flex" alignItems="center" gap={2} flex={1}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={selectedThresholds.has(threshold.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedThresholds);
                                if (e.target.checked) {
                                  newSelected.add(threshold.id);
                                } else {
                                  newSelected.delete(threshold.id);
                                }
                                setSelectedThresholds(newSelected);
                              }}
                              size="small"
                            />
                          }
                          label=""
                        />
                        
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="h6">{threshold.name}</Typography>
                            
                            <Chip
                              icon={THRESHOLD_TYPE_ICONS[threshold.type]}
                              label={threshold.type.replace('_', ' ')}
                              size="small"
                              variant="outlined"
                            />
                            
                            <Chip
                              icon={SEVERITY_ICONS[threshold.severity]}
                              label={threshold.severity.toUpperCase()}
                              color={
                                threshold.severity === 'critical' ? 'error' : 
                                threshold.severity === 'error' ? 'error' :
                                threshold.severity === 'warning' ? 'warning' : 'info'
                              }
                              size="small"
                            />
                            
                            {!threshold.enabled && (
                              <Chip
                                icon={<VisibilityOffIcon />}
                                label="DISABLED"
                                color="default"
                                size="small"
                              />
                            )}
                          </Box>
                          
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {threshold.metricName} • {threshold.operator} {threshold.value}
                          </Typography>
                          
                          {threshold.description && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              {threshold.description}
                            </Typography>
                          )}
                          
                          {threshold.tags.length > 0 && (
                            <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
                              {threshold.tags.map(tag => (
                                <Chip
                                  key={tag}
                                  label={tag}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Box>
                      
                      <Box display="flex" gap={1}>
                        <Tooltip title="Test Threshold">
                          <IconButton
                            size="small"
                            onClick={() => handleTestThreshold(threshold.id)}
                            color="primary"
                          >
                            <TestIcon />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Edit Threshold">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEditingThreshold(threshold);
                              setShowThresholdDialog(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Copy Threshold">
                          <IconButton
                            size="small"
                            onClick={() => {
                              const copied = { ...threshold };
                              delete copied.id;
                              copied.name = `${copied.name} (Copy)`;
                              setEditingThreshold(copied);
                              setShowThresholdDialog(true);
                            }}
                          >
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                        
                        <Tooltip title="Delete Threshold">
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteThreshold(threshold.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            
            {filteredThresholds.length === 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  No thresholds match the current filters. 
                  {thresholds.length === 0 && ' Click "Add Threshold" to create your first threshold.'}
                </Alert>
              </Grid>
            )}
          </Grid>
        </>
      )}
      
      {/* Templates Tab */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          {templates.map(template => (
            <Grid item xs={12} md={6} lg={4} key={template.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: 4
                  }
                }}
                onClick={() => {
                  setSelectedTemplate(template);
                  setTemplateVariables({});
                  setShowTemplateDialog(true);
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="h6" component="h3">
                      {template.name}
                    </Typography>
                    
                    {template.isSystem && (
                      <Chip
                        label="System"
                        color="primary"
                        size="small"
                      />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {template.description}
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Chip
                      label={template.category}
                      size="small"
                      variant="outlined"
                    />
                    
                    <Chip
                      icon={THRESHOLD_TYPE_ICONS[template.thresholdType as keyof typeof THRESHOLD_TYPE_ICONS]}
                      label={template.thresholdType.replace('_', ' ')}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  
                  {template.tags.length > 0 && (
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {template.tags.slice(0, 3).map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {template.tags.length > 3 && (
                        <Chip
                          label={`+${template.tags.length - 3}`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
          
          {templates.length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">
                No templates available. Templates provide pre-configured threshold settings for common monitoring scenarios.
              </Alert>
            </Grid>
          )}
        </Grid>
      )}
      
      {/* Dialogs */}
      {renderThresholdForm()}
      {renderTemplateDialog()}
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ThresholdManager;