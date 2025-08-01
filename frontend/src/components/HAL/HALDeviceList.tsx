import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
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
  Fab,
  Zoom,
  Menu,
  Checkbox,
  ListItemText,
  Button,
  Badge,
  Tooltip,
  Skeleton,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search,
  FilterList,
  ViewModule,
  ViewList,
  Add,
  Refresh,
  Download,
  Sort,
  Clear,
  DeviceHub,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
} from '@mui/icons-material';
import { HALStatusCard } from './HALStatusCard';
import { useHALContext } from './HALContext';
import { HALDevice, HALFilter } from './types';

interface SortOption {
  field: keyof HALDevice | 'health' | 'lastActivity';
  label: string;
  direction: 'asc' | 'desc';
}

export const HALDeviceList: React.FC = () => {
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
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProtocols, setSelectedProtocols] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Apply filters and sorting
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

    // Sorting
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

  // Group devices by status for summary
  const deviceSummary = useMemo(() => {
    const summary = {
      total: devices.length,
      connected: devices.filter(d => d.status === 'connected').length,
      disconnected: devices.filter(d => d.status === 'disconnected').length,
      error: devices.filter(d => d.status === 'error').length,
      updating: devices.filter(d => d.status === 'updating').length,
      simulated: devices.filter(d => d.isSimulated).length,
    };
    return summary;
  }, [devices]);

  const handleSortChange = (field: SortOption['field'], label: string) => {
    setSortBy(prev => ({
      field,
      label,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleApplyFilters = () => {
    setFilter({
      protocols: selectedProtocols,
      types: selectedTypes,
      statuses: selectedStatuses,
      search: searchTerm,
    });
    setFilterMenuAnchor(null);
  };

  const handleClearFilters = () => {
    setSelectedProtocols([]);
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSearchTerm('');
    clearFilter();
  };

  const handleExport = () => {
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
  };

  const hasActiveFilters = selectedProtocols.length > 0 || selectedTypes.length > 0 || 
    selectedStatuses.length > 0 || searchTerm !== '';

  if (isLoading) {
    return (
      <Box>
        <Grid container spacing={2}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Hardware Devices
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

          {/* Filter Button */}
          <Badge
            badgeContent={
              selectedProtocols.length + selectedTypes.length + selectedStatuses.length
            }
            color="primary"
          >
            <Button
              variant="outlined"
              startIcon={<FilterList />}
              onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            >
              Filters
            </Button>
          </Badge>

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

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Active filters:
            </Typography>
            {selectedProtocols.map(protocol => (
              <Chip
                key={protocol}
                label={protocol.toUpperCase()}
                size="small"
                onDelete={() => setSelectedProtocols(prev => prev.filter(p => p !== protocol))}
              />
            ))}
            {selectedTypes.map(type => (
              <Chip
                key={type}
                label={type}
                size="small"
                onDelete={() => setSelectedTypes(prev => prev.filter(t => t !== type))}
              />
            ))}
            {selectedStatuses.map(status => (
              <Chip
                key={status}
                label={status}
                size="small"
                onDelete={() => setSelectedStatuses(prev => prev.filter(s => s !== status))}
              />
            ))}
            <Button size="small" onClick={handleClearFilters}>
              Clear all
            </Button>
          </Box>
        )}
      </Paper>

      {/* Device List/Grid */}
      {filteredDevices.length === 0 ? (
        <Alert severity="info">
          No devices found matching the current filters.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredDevices.map(device => (
            <Grid
              item
              xs={12}
              sm={viewMode === 'grid' ? 6 : 12}
              md={viewMode === 'grid' ? 4 : 12}
              key={device.id}
            >
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
            </Grid>
          ))}
        </Grid>
      )}

      {/* Filter Menu */}
      <Menu
        anchorEl={filterMenuAnchor}
        open={Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        PaperProps={{
          sx: { width: 300, p: 2 },
        }}
      >
        <Typography variant="h6" gutterBottom>
          Filter Devices
        </Typography>

        {/* Protocol Filter */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Protocols</InputLabel>
          <Select
            multiple
            value={selectedProtocols}
            onChange={(e) => setSelectedProtocols(e.target.value as string[])}
            renderValue={(selected) => selected.join(', ')}
          >
            {availableProtocols.map(protocol => (
              <MenuItem key={protocol} value={protocol}>
                <Checkbox checked={selectedProtocols.includes(protocol)} />
                <ListItemText primary={protocol.toUpperCase()} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Type Filter */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Types</InputLabel>
          <Select
            multiple
            value={selectedTypes}
            onChange={(e) => setSelectedTypes(e.target.value as string[])}
            renderValue={(selected) => selected.join(', ')}
          >
            {availableTypes.map(type => (
              <MenuItem key={type} value={type}>
                <Checkbox checked={selectedTypes.includes(type)} />
                <ListItemText primary={type.charAt(0).toUpperCase() + type.slice(1)} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Status Filter */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Status</InputLabel>
          <Select
            multiple
            value={selectedStatuses}
            onChange={(e) => setSelectedStatuses(e.target.value as string[])}
            renderValue={(selected) => selected.join(', ')}
          >
            {availableStatuses.map(status => (
              <MenuItem key={status} value={status}>
                <Checkbox checked={selectedStatuses.includes(status)} />
                <ListItemText primary={status.charAt(0).toUpperCase() + status.slice(1)} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setFilterMenuAnchor(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleApplyFilters}>
            Apply
          </Button>
        </Box>
      </Menu>

      {/* FAB for adding device */}
      {permissions.canManageDevices && (
        <Zoom in>
          <Fab
            color="primary"
            sx={{
              position: 'fixed',
              bottom: 24,
              right: 24,
            }}
            onClick={() => console.log('Add device')}
          >
            <Add />
          </Fab>
        </Zoom>
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

export default HALDeviceList;