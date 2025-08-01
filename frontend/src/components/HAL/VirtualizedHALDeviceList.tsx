/**
 * VirtualizedHALDeviceList
 * High-performance virtualized version of HALDeviceList
 * Optimized for handling hundreds of devices with grid and list layouts
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Badge,
  Tooltip,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Search,
  FilterList,
  ViewModule,
  ViewList,
  Refresh,
  Download,
  Clear,
  DeviceHub,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
} from '@mui/icons-material';
import { HALStatusCard } from './HALStatusCard';
import { useHALContext } from './HALContext';
import { HALDevice } from './types';
import VirtualizedList, { VirtualizedListItem, VirtualizedListRef } from '../virtualization/VirtualizedList';

// Enhanced types for virtualized devices
interface VirtualizedDeviceItem extends VirtualizedListItem {
  device: HALDevice;
  height: number;
}

interface SortOption {
  field: keyof HALDevice | 'health' | 'lastActivity';
  label: string;
  direction: 'asc' | 'desc';
}

export const VirtualizedHALDeviceList: React.FC = () => {
  const theme = useTheme();
  const {
    devices,
    filter,
    setFilter,
    clearFilter,
    isLoading,
    isRefreshing,
    refreshDevices,
    connectDevice,
    disconnectDevice,
    removeDevice,
    runDiagnostics,
    checkFirmwareUpdates,
    firmwareProgress,
    permissions,
  } = useHALContext();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<SortOption>({
    field: 'name',
    label: 'Name',
    direction: 'asc',
  });
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const virtualListRef = useRef<VirtualizedListRef>(null);

  // Get unique values for filters
  const availableProtocols = useMemo(
    () => [...new Set(devices.map(d => d.protocol))],
    [devices]
  );
  const availableTypes = useMemo(
    () => [...new Set(devices.map(d => d.type))],
    [devices]
  );
  const availableStatuses = useMemo(
    () => [...new Set(devices.map(d => d.status))],
    [devices]
  );

  // Apply filters and sorting with performance optimizations
  const filteredDevices = useMemo(() => {
    let filtered = [...devices];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        d =>
          d.name.toLowerCase().includes(term) ||
          d.type.toLowerCase().includes(term) ||
          d.protocol.toLowerCase().includes(term) ||
          d.address?.toLowerCase().includes(term) ||
          d.id.toLowerCase().includes(term)
      );
    }

    // Protocol filter
    if (selectedProtocols.length > 0) {
      filtered = filtered.filter(d => selectedProtocols.includes(d.protocol));
    }

    // Type filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(d => selectedTypes.includes(d.type));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter(d => selectedStatuses.includes(d.status));
    }

    // Sorting with performance optimizations
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy.field) {
        case 'health':
          aValue = a.health.status;
          bValue = b.health.status;
          break;
        case 'lastActivity':
          aValue = new Date(a.lastSeen).getTime();
          bValue = new Date(b.lastSeen).getTime();
          break;
        default:
          aValue = a[sortBy.field];
          bValue = b[sortBy.field];
      }

      if (aValue === bValue) return 0;
      
      const result = aValue < bValue ? -1 : 1;
      return sortBy.direction === 'asc' ? result : -result;
    });

    return filtered;
  }, [devices, searchTerm, selectedProtocols, selectedTypes, selectedStatuses, sortBy]);

  // Convert devices to virtualized list items
  const virtualizedItems: VirtualizedDeviceItem[] = useMemo(() => {
    const itemHeight = viewMode === 'grid' ? 280 : 120; // Different heights for grid vs list
    const itemsPerRow = viewMode === 'grid' ? 3 : 1; // Grid has multiple items per row

    return filteredDevices.map((device, index) => ({
      id: device.id,
      device,
      height: itemHeight,
      data: device,
    }));
  }, [filteredDevices, viewMode]);

  // Group devices by status for summary
  const deviceSummary = useMemo(() => {
    return {
      total: devices.length,
      connected: devices.filter(d => d.status === 'connected').length,
      disconnected: devices.filter(d => d.status === 'disconnected').length,
      error: devices.filter(d => d.status === 'error').length,
      updating: devices.filter(d => d.status === 'updating').length,
      simulated: devices.filter(d => d.isSimulated).length,
    };
  }, [devices]);

  // Event handlers
  const handleSortChange = useCallback((field: SortOption['field'], label: string) => {
    setSortBy(prev => ({
      field,
      label,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const handleApplyFilters = useCallback(() => {
    setFilter({
      protocols: selectedProtocols,
      types: selectedTypes,
      statuses: selectedStatuses,
      search: searchTerm,
    });
  }, [selectedProtocols, selectedTypes, selectedStatuses, searchTerm, setFilter]);

  const handleClearFilters = useCallback(() => {
    setSelectedProtocols([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSearchTerm('');
    clearFilter();
  }, [clearFilter]);

  const handleExport = useCallback(() => {
    // Export filtered devices
    const exportData = filteredDevices.map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      protocol: device.protocol,
      status: device.status,
      address: device.address,
      port: device.port,
      firmwareVersion: device.firmwareVersion,
      health: device.health.status,
      lastSeen: device.lastSeen,
      isSimulated: device.isSimulated,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hal-devices-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredDevices]);

  // Optimized device item renderer for virtualization
  const renderDeviceItem = useCallback(({ index, style, data, isVisible }: any) => {
    const item = data as VirtualizedDeviceItem;
    const device = item.device;
    
    // Only render visible items for optimal performance
    if (!isVisible) {
      return <div style={style} />;
    }

    return (
      <div style={style}>
        <Box sx={{ p: 1 }}>
          <HALStatusCard
            device={device}
            onConnect={() => connectDevice(device.id)}
            onDisconnect={() => disconnectDevice(device.id)}
            onRunDiagnostics={() => runDiagnostics(device.id)}
            onCheckFirmware={() => checkFirmwareUpdates(device.id)}
            onRemove={() => removeDevice(device.id)}
            firmwareProgress={firmwareProgress[device.id]}
            compact={viewMode === 'list'}
          />
        </Box>
      </div>
    );
  }, [
    viewMode,
    connectDevice,
    disconnectDevice,
    runDiagnostics,
    checkFirmwareUpdates,
    removeDevice,
    firmwareProgress,
  ]);

  // Grid-specific renderer for better layout control
  const renderGridItems = useCallback(({ index, style, data, isVisible }: any) => {
    if (!isVisible) {
      return <div style={style} />;
    }

    const itemsPerRow = 3;
    const startIndex = index * itemsPerRow;
    const rowItems = virtualizedItems.slice(startIndex, startIndex + itemsPerRow);

    return (
      <div style={style}>
        <Box sx={{ display: 'flex', gap: 2, p: 1 }}>
          {rowItems.map((item) => (
            <Box key={item.id} sx={{ flex: 1, minWidth: 0 }}>
              <HALStatusCard
                device={item.device}
                onConnect={() => connectDevice(item.device.id)}
                onDisconnect={() => disconnectDevice(item.device.id)}
                onRunDiagnostics={() => runDiagnostics(item.device.id)}
                onCheckFirmware={() => checkFirmwareUpdates(item.device.id)}
                onRemove={() => removeDevice(item.device.id)}
                firmwareProgress={firmwareProgress[item.device.id]}
                compact={false}
              />
            </Box>
          ))}
          {/* Fill empty slots for consistent layout */}
          {Array.from({ length: itemsPerRow - rowItems.length }).map((_, emptyIndex) => (
            <Box key={`empty-${emptyIndex}`} sx={{ flex: 1, minWidth: 0 }} />
          ))}
        </Box>
      </div>
    );
  }, [virtualizedItems, connectDevice, disconnectDevice, runDiagnostics, checkFirmwareUpdates, removeDevice, firmwareProgress]);

  const hasActiveFilters = selectedProtocols.length > 0 || selectedTypes.length > 0 || 
    selectedStatuses.length > 0 || searchTerm !== '';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Hardware Devices (Virtualized)
          <Typography variant="caption" display="block" color="textSecondary">
            Showing {filteredDevices.length} of {devices.length} devices
          </Typography>
        </Typography>

        {/* Summary Stats */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<DeviceHub />}
            label={`Total: ${deviceSummary.total}`}
            variant="outlined"
          />
          <Chip
            icon={<CheckCircle sx={{ color: theme.palette.success.main }} />}
            label={`Connected: ${deviceSummary.connected}`}
            sx={{
              borderColor: theme.palette.success.main,
              color: theme.palette.success.main,
            }}
            variant="outlined"
          />
          {deviceSummary.error > 0 && (
            <Chip
              icon={<ErrorIcon sx={{ color: theme.palette.error.main }} />}
              label={`Errors: ${deviceSummary.error}`}
              sx={{
                borderColor: theme.palette.error.main,
                color: theme.palette.error.main,
              }}
              variant="outlined"
            />
          )}
          {deviceSummary.updating > 0 && (
            <Chip
              icon={<Info sx={{ color: theme.palette.info.main }} />}
              label={`Updating: ${deviceSummary.updating}`}
              sx={{
                borderColor: theme.palette.info.main,
                color: theme.palette.info.main,
              }}
              variant="outlined"
            />
          )}
          {deviceSummary.simulated > 0 && (
            <Chip
              icon={<Warning sx={{ color: theme.palette.warning.main }} />}
              label={`Simulated: ${deviceSummary.simulated}`}
              sx={{
                borderColor: theme.palette.warning.main,
                color: theme.palette.warning.main,
              }}
              variant="outlined"
            />
          )}
        </Box>
      </Box>

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <TextField
            placeholder="Search devices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, minWidth: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <Clear />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Sort */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              value={sortBy.field}
              label="Sort by"
              onChange={(e) => {
                const field = e.target.value as SortOption['field'];
                const label = field.charAt(0).toUpperCase() + field.slice(1);
                handleSortChange(field, label);
              }}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="type">Type</MenuItem>
              <MenuItem value="protocol">Protocol</MenuItem>
              <MenuItem value="status">Status</MenuItem>
              <MenuItem value="health">Health</MenuItem>
              <MenuItem value="lastActivity">Last Activity</MenuItem>
            </Select>
          </FormControl>

          {/* View Mode */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="grid">
              <ViewModule />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewList />
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ flexGrow: 1 }} />

          {/* Actions */}
          <Tooltip title="Apply filters">
            <Button
              variant="outlined"
              onClick={handleApplyFilters}
              startIcon={<FilterList />}
            >
              Apply
            </Button>
          </Tooltip>

          <Tooltip title="Clear filters">
            <Button
              variant="outlined"
              onClick={handleClearFilters}
              startIcon={<Clear />}
              disabled={!hasActiveFilters}
            >
              Clear
            </Button>
          </Tooltip>

          <Tooltip title="Refresh">
            <IconButton onClick={refreshDevices} disabled={isRefreshing}>
              <Refresh className={isRefreshing ? 'rotating' : ''} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Export">
            <IconButton onClick={handleExport}>
              <Download />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Virtualized Device List/Grid */}
      {filteredDevices.length === 0 ? (
        <Alert severity="info">
          No devices found matching the current filters.
        </Alert>
      ) : (
        <Paper sx={{ height: 600, overflow: 'hidden' }}>
          <VirtualizedList
            ref={virtualListRef}
            items={viewMode === 'grid' 
              ? Array.from({ length: Math.ceil(virtualizedItems.length / 3) }, (_, index) => ({
                  id: `row-${index}`,
                  height: 280,
                  data: index,
                }))
              : virtualizedItems
            }
            itemHeight={viewMode === 'grid' ? 280 : 120}
            height={600}
            renderItem={viewMode === 'grid' ? renderGridItems : renderDeviceItem}
            loading={isLoading}
            emptyMessage="No devices found"
            loadingMessage="Loading devices..."
            overscanCount={3}
            ariaLabel="Device list"
            itemRole={viewMode === 'grid' ? 'row' : 'listitem'}
          />
        </Paper>
      )}

      {/* Performance metrics for development */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'fixed',
            top: 100,
            left: 16,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: 1,
            borderRadius: 1,
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <div>Total Devices: {devices.length}</div>
          <div>Filtered: {filteredDevices.length}</div>
          <div>View Mode: {viewMode}</div>
          <div>Rendered: ~{Math.min(10, filteredDevices.length)} items</div>
        </Box>
      )}

      <style jsx global>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};

export default VirtualizedHALDeviceList;