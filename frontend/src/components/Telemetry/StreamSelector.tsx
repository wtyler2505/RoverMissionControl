import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Chip,
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Menu,
  MenuItem,
  Badge,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Search,
  ExpandMore,
  Sensors,
  Memory,
  BatteryFull,
  Thermostat,
  Speed,
  Navigation,
  SignalCellularAlt,
  FilterList,
  Sort,
  ViewList,
  ViewModule,
  Info,
  Warning,
  Error as ErrorIcon,
  CheckCircle,
  RadioButtonChecked,
  RadioButtonUnchecked,
  Category,
  Timeline,
  AutoGraph,
} from '@mui/icons-material';
import { useTelemetryManager } from './TelemetryProvider';
import { TelemetryStreamConfig, TelemetryDataType } from '../../services/websocket/TelemetryManager';
import { ChartTemplate, chartTemplates, getTemplateByCategory } from './ChartTemplates';

interface StreamSelectorProps {
  onAddChart: (streamIds: string[], template?: ChartTemplate) => void;
  maxCharts?: number;
  currentChartCount?: number;
  enableTemplates?: boolean;
  onStreamSelect?: (streamId: string) => void;
  selectedStreams?: Set<string>;
  multiSelect?: boolean;
}

interface StreamCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  streams: TelemetryStreamConfig[];
}

interface StreamHealth {
  status: 'good' | 'warning' | 'error' | 'offline';
  latency: number;
  dataRate: number;
  lastUpdate: number;
}

const StreamSelector: React.FC<StreamSelectorProps> = ({
  onAddChart,
  maxCharts = 12,
  currentChartCount = 0,
  enableTemplates = true,
  onStreamSelect,
  selectedStreams = new Set(),
  multiSelect = true,
}) => {
  const telemetryManager = useTelemetryManager();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStreamIds, setSelectedStreamIds] = useState<Set<string>>(selectedStreams);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'dataRate' | 'status'>('name');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']));
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);
  const [streamHealth, setStreamHealth] = useState<Map<string, StreamHealth>>(new Map());
  const [loading, setLoading] = useState(false);

  // Get available streams from telemetry manager
  const availableStreams = useMemo(() => {
    if (!telemetryManager) return [];
    
    const streams = telemetryManager.getAvailableStreams();
    return streams.map(streamId => telemetryManager.getStreamConfig(streamId)).filter(Boolean);
  }, [telemetryManager]);

  // Categorize streams
  const categorizedStreams = useMemo(() => {
    const categories: Map<string, StreamCategory> = new Map();
    
    // Define categories with icons
    const categoryDefinitions = [
      { id: 'sensors', name: 'Sensors', icon: <Sensors /> },
      { id: 'power', name: 'Power & Battery', icon: <BatteryFull /> },
      { id: 'thermal', name: 'Thermal', icon: <Thermostat /> },
      { id: 'motion', name: 'Motion & Position', icon: <Navigation /> },
      { id: 'communication', name: 'Communication', icon: <SignalCellularAlt /> },
      { id: 'system', name: 'System', icon: <Memory /> },
      { id: 'other', name: 'Other', icon: <Category /> },
    ];

    // Initialize categories
    categoryDefinitions.forEach(def => {
      categories.set(def.id, { ...def, streams: [] });
    });

    // Categorize streams based on their metadata or name patterns
    availableStreams.forEach(stream => {
      let categoryId = 'other';
      
      // Determine category based on stream metadata or naming convention
      if (stream.metadata?.category) {
        categoryId = stream.metadata.category;
      } else if (stream.name.toLowerCase().includes('temp') || 
                 stream.name.toLowerCase().includes('thermal')) {
        categoryId = 'thermal';
      } else if (stream.name.toLowerCase().includes('batt') || 
                 stream.name.toLowerCase().includes('power') ||
                 stream.name.toLowerCase().includes('volt') ||
                 stream.name.toLowerCase().includes('current')) {
        categoryId = 'power';
      } else if (stream.name.toLowerCase().includes('pos') || 
                 stream.name.toLowerCase().includes('vel') ||
                 stream.name.toLowerCase().includes('accel') ||
                 stream.name.toLowerCase().includes('gyro')) {
        categoryId = 'motion';
      } else if (stream.name.toLowerCase().includes('sensor')) {
        categoryId = 'sensors';
      } else if (stream.name.toLowerCase().includes('comm') || 
                 stream.name.toLowerCase().includes('signal') ||
                 stream.name.toLowerCase().includes('rssi')) {
        categoryId = 'communication';
      } else if (stream.name.toLowerCase().includes('cpu') || 
                 stream.name.toLowerCase().includes('mem') ||
                 stream.name.toLowerCase().includes('disk')) {
        categoryId = 'system';
      }

      const category = categories.get(categoryId) || categories.get('other')!;
      category.streams.push(stream);
    });

    return Array.from(categories.values()).filter(cat => cat.streams.length > 0);
  }, [availableStreams]);

  // Filter and sort streams
  const filteredStreams = useMemo(() => {
    let streams = filterCategory === 'all' 
      ? availableStreams 
      : categorizedStreams.find(cat => cat.id === filterCategory)?.streams || [];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      streams = streams.filter(stream => 
        stream.name.toLowerCase().includes(query) ||
        stream.streamId.toLowerCase().includes(query) ||
        stream.metadata?.description?.toLowerCase().includes(query)
      );
    }

    // Apply active filter
    if (showOnlyActive) {
      streams = streams.filter(stream => {
        const health = streamHealth.get(stream.streamId);
        return health && health.status !== 'offline';
      });
    }

    // Sort streams
    streams.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return (a.metadata?.category || 'other').localeCompare(b.metadata?.category || 'other');
        case 'dataRate':
          const rateA = streamHealth.get(a.streamId)?.dataRate || 0;
          const rateB = streamHealth.get(b.streamId)?.dataRate || 0;
          return rateB - rateA;
        case 'status':
          const statusOrder = { good: 0, warning: 1, error: 2, offline: 3 };
          const statusA = streamHealth.get(a.streamId)?.status || 'offline';
          const statusB = streamHealth.get(b.streamId)?.status || 'offline';
          return statusOrder[statusA] - statusOrder[statusB];
        default:
          return 0;
      }
    });

    return streams;
  }, [availableStreams, categorizedStreams, filterCategory, searchQuery, showOnlyActive, sortBy, streamHealth]);

  // Update stream health periodically
  useEffect(() => {
    if (!telemetryManager) return;

    const updateHealth = () => {
      const health = new Map<string, StreamHealth>();
      
      availableStreams.forEach(stream => {
        const stats = telemetryManager.getStreamStats(stream.streamId);
        const now = Date.now();
        const timeSinceUpdate = now - (stats?.lastUpdate || 0);
        
        let status: StreamHealth['status'] = 'offline';
        if (timeSinceUpdate < 1000) {
          status = 'good';
        } else if (timeSinceUpdate < 5000) {
          status = 'warning';
        } else if (timeSinceUpdate < 30000) {
          status = 'error';
        }

        health.set(stream.streamId, {
          status,
          latency: Math.random() * 100, // Would need actual latency measurement
          dataRate: stats?.averageRate || 0,
          lastUpdate: stats?.lastUpdate || 0,
        });
      });

      setStreamHealth(health);
    };

    updateHealth();
    const interval = setInterval(updateHealth, 1000);
    
    return () => clearInterval(interval);
  }, [telemetryManager, availableStreams]);

  // Handle stream selection
  const handleStreamToggle = useCallback((streamId: string) => {
    if (multiSelect) {
      setSelectedStreamIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(streamId)) {
          newSet.delete(streamId);
        } else {
          newSet.add(streamId);
        }
        return newSet;
      });
    } else {
      setSelectedStreamIds(new Set([streamId]));
      if (onStreamSelect) {
        onStreamSelect(streamId);
      }
    }
  }, [multiSelect, onStreamSelect]);

  // Handle adding chart with selected streams
  const handleAddChart = useCallback((template?: ChartTemplate) => {
    if (selectedStreamIds.size === 0) return;
    
    onAddChart(Array.from(selectedStreamIds), template);
    setSelectedStreamIds(new Set());
  }, [selectedStreamIds, onAddChart]);

  // Handle category expansion
  const handleCategoryToggle = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // Get status icon and color
  const getStatusIcon = (status: StreamHealth['status']) => {
    switch (status) {
      case 'good':
        return <CheckCircle color="success" fontSize="small" />;
      case 'warning':
        return <Warning color="warning" fontSize="small" />;
      case 'error':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'offline':
        return <RadioButtonUnchecked color="disabled" fontSize="small" />;
    }
  };

  // Render stream item
  const renderStreamItem = (stream: TelemetryStreamConfig) => {
    const health = streamHealth.get(stream.streamId);
    const isSelected = selectedStreamIds.has(stream.streamId);
    
    return (
      <ListItem key={stream.streamId} disablePadding>
        <ListItemButton
          selected={isSelected}
          onClick={() => handleStreamToggle(stream.streamId)}
          disabled={currentChartCount >= maxCharts && !isSelected}
        >
          <ListItemIcon>
            {getStatusIcon(health?.status || 'offline')}
          </ListItemIcon>
          <ListItemText
            primary={stream.name}
            secondary={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  {stream.streamId}
                </Typography>
                {stream.units && (
                  <Chip label={stream.units} size="small" variant="outlined" />
                )}
                {health && health.dataRate > 0 && (
                  <Chip 
                    label={`${health.dataRate.toFixed(1)} Hz`} 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                )}
              </Stack>
            }
          />
          {stream.metadata?.description && (
            <ListItemSecondaryAction>
              <Tooltip title={stream.metadata.description}>
                <IconButton edge="end" size="small">
                  <Info />
                </IconButton>
              </Tooltip>
            </ListItemSecondaryAction>
          )}
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Telemetry Streams
      </Typography>

      {/* Search and Filter Controls */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search streams..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search />
            </InputAdornment>
          ),
        }}
        sx={{ mb: 2 }}
      />

      {/* View and Sort Controls */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="list">
            <ViewList />
          </ToggleButton>
          <ToggleButton value="grid">
            <ViewModule />
          </ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortBy}
            label="Sort By"
            onChange={(e: SelectChangeEvent) => setSortBy(e.target.value as any)}
          >
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="category">Category</MenuItem>
            <MenuItem value="dataRate">Data Rate</MenuItem>
            <MenuItem value="status">Status</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={filterCategory}
            label="Category"
            onChange={(e: SelectChangeEvent) => setFilterCategory(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            {categorizedStreams.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <FormControlLabel
        control={
          <Switch
            checked={showOnlyActive}
            onChange={(e) => setShowOnlyActive(e.target.checked)}
          />
        }
        label="Show only active streams"
        sx={{ mb: 2 }}
      />

      {/* Stream List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredStreams.length === 0 ? (
          <Alert severity="info">
            No streams found matching your criteria
          </Alert>
        ) : viewMode === 'list' ? (
          <List>
            {filterCategory === 'all' ? (
              categorizedStreams.map(category => (
                <Accordion
                  key={category.id}
                  expanded={expandedCategories.has(category.id)}
                  onChange={() => handleCategoryToggle(category.id)}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {category.icon}
                      <Typography>{category.name}</Typography>
                      <Chip label={category.streams.length} size="small" />
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <List disablePadding>
                      {category.streams
                        .filter(stream => 
                          !searchQuery || 
                          stream.name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map(stream => renderStreamItem(stream))}
                    </List>
                  </AccordionDetails>
                </Accordion>
              ))
            ) : (
              <List>
                {filteredStreams.map(stream => renderStreamItem(stream))}
              </List>
            )}
          </List>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
            {filteredStreams.map(stream => {
              const health = streamHealth.get(stream.streamId);
              const isSelected = selectedStreamIds.has(stream.streamId);
              
              return (
                <Paper
                  key={stream.streamId}
                  variant="outlined"
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'action.selected' : 'transparent',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                  onClick={() => handleStreamToggle(stream.streamId)}
                >
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      {getStatusIcon(health?.status || 'offline')}
                      <Typography variant="subtitle2" noWrap>
                        {stream.name}
                      </Typography>
                    </Stack>
                    {health && health.dataRate > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {health.dataRate.toFixed(1)} Hz
                      </Typography>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Action Buttons */}
      <Stack spacing={1}>
        {selectedStreamIds.size > 0 && (
          <Alert severity="info" sx={{ mb: 1 }}>
            {selectedStreamIds.size} stream{selectedStreamIds.size > 1 ? 's' : ''} selected
          </Alert>
        )}
        
        <Button
          fullWidth
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleAddChart()}
          disabled={selectedStreamIds.size === 0 || currentChartCount >= maxCharts}
        >
          Add Chart ({currentChartCount}/{maxCharts})
        </Button>

        {enableTemplates && selectedStreamIds.size > 0 && (
          <Button
            fullWidth
            variant="outlined"
            startIcon={<AutoGraph />}
            onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
          >
            Add with Template
          </Button>
        )}
      </Stack>

      {/* Template Menu */}
      <Menu
        anchorEl={templateMenuAnchor}
        open={Boolean(templateMenuAnchor)}
        onClose={() => setTemplateMenuAnchor(null)}
      >
        {chartTemplates.map(template => (
          <MenuItem
            key={template.id}
            onClick={() => {
              handleAddChart(template);
              setTemplateMenuAnchor(null);
            }}
          >
            <ListItemIcon>{template.icon}</ListItemIcon>
            <ListItemText
              primary={template.name}
              secondary={template.description}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Status Summary */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Total Streams: {availableStreams.length} | 
          Active: {Array.from(streamHealth.values()).filter(h => h.status === 'good').length} | 
          Warning: {Array.from(streamHealth.values()).filter(h => h.status === 'warning').length} | 
          Error: {Array.from(streamHealth.values()).filter(h => h.status === 'error').length}
        </Typography>
      </Box>
    </Box>
  );
};

export default StreamSelector;