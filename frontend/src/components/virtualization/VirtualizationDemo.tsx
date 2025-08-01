/**
 * VirtualizationDemo Component
 * Comprehensive demonstration of virtualization capabilities
 * Shows performance improvements and feature comparisons
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  useTheme,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Visibility as VisibilityIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { VirtualizedList, VirtualizedTable, VirtualizationUtils, VIRTUALIZATION_CONSTANTS } from './index';
import type { VirtualizedListRef, TableColumn, VirtualizedTableRow } from './index';

// Generate test data
const generateTestData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    name: `Test Item ${index + 1}`,
    description: `This is a sample description for item ${index + 1}. It contains some text to demonstrate how virtualization handles variable content lengths. ${Math.random() > 0.5 ? 'This item has extra content to show variable heights.' : ''}`,
    category: ['System', 'Hardware', 'Network', 'Power', 'Thermal'][index % 5],
    status: ['Active', 'Inactive', 'Error', 'Warning'][index % 4],
    value: Math.floor(Math.random() * 1000),
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
    priority: ['High', 'Medium', 'Low'][index % 3],
  }));
};

// Performance monitoring
const usePerformanceMonitor = () => {
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    memoryUsage: 0,
    visibleItems: 0,
    totalItems: 0,
  });

  const updateMetrics = useCallback((data: Partial<typeof metrics>) => {
    setMetrics(prev => ({ ...prev, ...data }));
  }, []);

  return { metrics, updateMetrics };
};

export const VirtualizationDemo: React.FC = () => {
  const theme = useTheme();
  const virtualizedListRef = useRef<VirtualizedListRef>(null);
  const { metrics, updateMetrics } = usePerformanceMonitor();
  
  // Demo state
  const [itemCount, setItemCount] = useState(1000);
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'grid'>('list');
  const [itemHeight, setItemHeight] = useState(80);
  const [enableVirtualization, setEnableVirtualization] = useState(true);
  const [variableHeight, setVariableHeight] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  // Generate test data
  const testData = useMemo(() => generateTestData(itemCount), [itemCount]);

  // Convert to virtualized list items
  const virtualizedItems = useMemo(() => {
    return testData.map((item, index) => ({
      id: item.id,
      height: variableHeight ? VirtualizationUtils.calculateItemHeight(item.description, 400) : itemHeight,
      data: item,
    }));
  }, [testData, itemHeight, variableHeight]);

  // Table columns configuration
  const tableColumns: TableColumn[] = useMemo(() => [
    {
      id: 'name',
      label: 'Name',
      width: 200,
      sortable: true,
      sticky: 'left',
    },
    {
      id: 'category',
      label: 'Category',
      width: 120,
      sortable: true,
      render: (value) => <Chip label={value} size="small" variant="outlined" />,
    },
    {
      id: 'status',
      label: 'Status',
      width: 100,
      sortable: true,
      render: (value) => (
        <Chip 
          label={value} 
          size="small" 
          color={value === 'Active' ? 'success' : value === 'Error' ? 'error' : 'default'}
        />
      ),
    },
    {
      id: 'value',
      label: 'Value',
      width: 100,
      align: 'right',
      sortable: true,
    },
    {
      id: 'priority',
      label: 'Priority',
      width: 100,
      sortable: true,
      render: (value) => (
        <Chip 
          label={value} 
          size="small" 
          color={value === 'High' ? 'error' : value === 'Medium' ? 'warning' : 'default'}
        />
      ),
    },
    {
      id: 'description',
      label: 'Description',
      width: 300,
      render: (value) => (
        <Typography variant="body2" noWrap title={value}>
          {value}
        </Typography>
      ),
    },
  ], []);

  // Convert to table rows
  const tableRows: VirtualizedTableRow[] = useMemo(() => {
    return testData.map((item) => ({
      id: item.id,
      data: item,
      height: 52,
    }));
  }, [testData]);

  // List item renderer
  const renderListItem = useCallback(({ index, style, data, isVisible }: any) => {
    const item = data.data;
    
    if (!isVisible && enableVirtualization) {
      return <div style={style} />;
    }

    return (
      <div style={style}>
        <Card sx={{ m: 1, height: style.height - 16 }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="h6" component="div" noWrap>
                {item.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={item.category} size="small" variant="outlined" />
                <Chip 
                  label={item.status} 
                  size="small" 
                  color={item.status === 'Active' ? 'success' : item.status === 'Error' ? 'error' : 'default'}
                />
              </Box>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {item.description}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption">
                Value: {item.value}
              </Typography>
              <Chip 
                label={item.priority} 
                size="small" 
                color={item.priority === 'High' ? 'error' : item.priority === 'Medium' ? 'warning' : 'default'}
              />
            </Box>
          </CardContent>
        </Card>
      </div>
    );
  }, [enableVirtualization]);

  // Performance metrics calculation
  const performanceMetrics = useMemo(() => {
    const shouldVirtualize = VirtualizationUtils.shouldVirtualize(itemCount, itemHeight);
    const estimatedMemory = VirtualizationUtils.estimateMemoryUsage(itemCount, 10, itemHeight);
    const optimalOverscan = VirtualizationUtils.getOptimalOverscan(itemCount);
    
    return {
      shouldVirtualize,
      estimatedMemory,
      optimalOverscan,
      virtualizedSavings: ((itemCount - 10) / itemCount * 100).toFixed(1),
    };
  }, [itemCount, itemHeight]);

  // Handle view mode changes
  const handleViewModeChange = (mode: 'list' | 'table' | 'grid') => {
    setViewMode(mode);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Virtualization Performance Demo
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This demo showcases the performance benefits of virtualization with large datasets. 
        Monitor the metrics below to see memory savings and rendering performance.
      </Alert>

      {/* Controls */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Demo Controls
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Item Count: {itemCount}</Typography>
              <Slider
                value={itemCount}
                onChange={(_, value) => setItemCount(value as number)}
                min={10}
                max={50000}
                step={100}
                marks={[
                  { value: 100, label: '100' },
                  { value: 1000, label: '1K' },
                  { value: 10000, label: '10K' },
                  { value: 50000, label: '50K' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>
            
            <Box sx={{ mb: 2 }}>
              <Typography gutterBottom>Item Height: {itemHeight}px</Typography>
              <Slider
                value={itemHeight}
                onChange={(_, value) => setItemHeight(value as number)}
                min={40}
                max={200}
                step={10}
                valueLabelDisplay="auto"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <ButtonGroup variant="outlined">
                <Button 
                  variant={viewMode === 'list' ? 'contained' : 'outlined'}
                  onClick={() => handleViewModeChange('list')}
                >
                  List
                </Button>
                <Button 
                  variant={viewMode === 'table' ? 'contained' : 'outlined'}
                  onClick={() => handleViewModeChange('table')}
                >
                  Table
                </Button>
                <Button 
                  variant={viewMode === 'grid' ? 'contained' : 'outlined'}
                  onClick={() => handleViewModeChange('grid')}
                >
                  Grid
                </Button>
              </ButtonGroup>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={enableVirtualization}
                    onChange={(e) => setEnableVirtualization(e.target.checked)}
                  />
                }
                label="Enable Virtualization"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={variableHeight}
                    onChange={(e) => setVariableHeight(e.target.checked)}
                  />
                }
                label="Variable Item Heights"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={showMetrics}
                    onChange={(e) => setShowMetrics(e.target.checked)}
                  />
                }
                label="Show Performance Metrics"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Performance Metrics */}
      {showMetrics && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Performance Metrics
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <SpeedIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Performance</Typography>
                  </Box>
                  <Typography variant="h6">
                    {performanceMetrics.virtualizedSavings}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    DOM nodes saved
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <MemoryIcon color="secondary" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Memory</Typography>
                  </Box>
                  <Typography variant="h6">
                    ~{Math.floor(itemCount * 0.1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Rendered items
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <VisibilityIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Optimization</Typography>
                  </Box>
                  <Typography variant="h6">
                    {performanceMetrics.shouldVirtualize ? 'ON' : 'OFF'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Recommended
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TimeIcon color="warning" sx={{ mr: 1 }} />
                    <Typography variant="subtitle2">Overscan</Typography>
                  </Box>
                  <Typography variant="h6">
                    {performanceMetrics.optimalOverscan}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Buffer items
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          
          <Alert severity="success" sx={{ mt: 2 }}>
            {performanceMetrics.estimatedMemory}
          </Alert>
        </Paper>
      )}

      {/* Virtualized Content */}
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">
            {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View
            {enableVirtualization && <Chip label="Virtualized" size="small" color="success" sx={{ ml: 1 }} />}
          </Typography>
        </Box>
        
        {viewMode === 'list' && (
          <VirtualizedList
            ref={virtualizedListRef}
            items={virtualizedItems}
            itemHeight={variableHeight ? undefined : itemHeight}
            height={600}
            renderItem={renderListItem}
            loading={false}
            overscanCount={performanceMetrics.optimalOverscan}
            itemSize={variableHeight ? 'variable' : 'fixed'}
            estimatedItemSize={itemHeight}
            ariaLabel="Demo list"
          />
        )}
        
        {viewMode === 'table' && (
          <VirtualizedTable
            columns={tableColumns}
            rows={tableRows}
            height={600}
            rowHeight={52}
            headerHeight={56}
            selectable
            stickyHeader
            striped
            ariaLabel="Demo table"
          />
        )}
        
        {viewMode === 'grid' && (
          <VirtualizedList
            items={virtualizedItems}
            itemHeight={itemHeight}
            height={600}
            renderItem={renderListItem}
            isGrid
            columnCount={3}
            columnWidth={320}
            overscanCount={performanceMetrics.optimalOverscan}
            ariaLabel="Demo grid"
          />
        )}
      </Paper>

      {/* Usage Instructions */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Usage Guidelines
        </Typography>
        
        <Box component="ul" sx={{ pl: 2 }}>
          <Typography component="li" sx={{ mb: 1 }}>
            <strong>Use virtualization when:</strong> You have more than {VIRTUALIZATION_CONSTANTS.MAX_SAFE_ITEMS_WITHOUT_VIRTUALIZATION} items
          </Typography>
          <Typography component="li" sx={{ mb: 1 }}>
            <strong>List height:</strong> For variable heights, provide estimatedItemSize
          </Typography>
          <Typography component="li" sx={{ mb: 1 }}>
            <strong>Accessibility:</strong> All ARIA attributes and keyboard navigation are preserved
          </Typography>
          <Typography component="li" sx={{ mb: 1 }}>
            <strong>Performance:</strong> Monitor rendered items vs total items ratio
          </Typography>
          <Typography component="li">
            <strong>Memory:</strong> Expect 90%+ reduction in DOM nodes for large lists
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default VirtualizationDemo;