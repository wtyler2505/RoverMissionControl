import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Button,
  Tooltip,
  Divider,
  Alert,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  DeviceHub,
  PowerOff,
  SystemUpdate,
  BugReport,
  Error as ErrorIcon,
  Warning,
  Info,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Search,
  FilterList,
  Clear,
  Refresh,
  Download,
  Send,
  GetApp,
  Timeline,
  NetworkCheck,
  Storage,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { HALActivity } from './types';
import { useHALContext } from './HALContext';

interface ActivityGroup {
  date: string;
  activities: HALActivity[];
}

const getActivityIcon = (type: HALActivity['type']) => {
  switch (type) {
    case 'device_connected':
      return <DeviceHub sx={{ color: 'success.main' }} />;
    case 'device_disconnected':
      return <PowerOff sx={{ color: 'text.disabled' }} />;
    case 'firmware_update':
      return <SystemUpdate sx={{ color: 'info.main' }} />;
    case 'diagnostic_run':
      return <BugReport sx={{ color: 'warning.main' }} />;
    case 'error':
      return <ErrorIcon sx={{ color: 'error.main' }} />;
    case 'warning':
      return <Warning sx={{ color: 'warning.main' }} />;
    case 'command_sent':
      return <Send sx={{ color: 'primary.main' }} />;
    case 'data_received':
      return <GetApp sx={{ color: 'primary.main' }} />;
    default:
      return <Info sx={{ color: 'info.main' }} />;
  }
};

const getSeverityColor = (severity: HALActivity['severity']) => {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'success':
      return 'success';
    default:
      return 'default';
  }
};

export const HALActivityFeed: React.FC = () => {
  const theme = useTheme();
  const { activities, devices, isRefreshing, refreshDevices } = useHALContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);

  // Get unique values for filters
  const activityTypes = useMemo(
    () => [...new Set(activities.map(a => a.type))],
    [activities]
  );
  const severityLevels = useMemo(
    () => [...new Set(activities.map(a => a.severity))],
    [activities]
  );

  // Filter activities
  const filteredActivities = useMemo(() => {
    let filtered = [...activities];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        a =>
          a.message.toLowerCase().includes(term) ||
          a.deviceName?.toLowerCase().includes(term) ||
          a.type.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(a => selectedTypes.includes(a.type));
    }

    // Severity filter
    if (selectedSeverities.length > 0) {
      filtered = filtered.filter(a => selectedSeverities.includes(a.severity));
    }

    // Device filter
    if (selectedDevices.length > 0) {
      filtered = filtered.filter(a => a.deviceId && selectedDevices.includes(a.deviceId));
    }

    return filtered;
  }, [activities, searchTerm, selectedTypes, selectedSeverities, selectedDevices]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: ActivityGroup[] = [];
    const groupMap = new Map<string, HALActivity[]>();

    filteredActivities.forEach(activity => {
      const date = new Date(activity.timestamp);
      const dateKey = date.toDateString();
      
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, []);
      }
      groupMap.get(dateKey)!.push(activity);
    });

    groupMap.forEach((activities, date) => {
      groups.push({ date, activities });
    });

    // Sort groups by date (newest first)
    groups.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Set first group as expanded by default
    if (groups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set([groups[0].date]));
    }

    return groups;
  }, [filteredActivities]);

  const toggleGroup = (date: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const toggleDetails = (activityId: string) => {
    setShowDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(activityId)) {
        newSet.delete(activityId);
      } else {
        newSet.add(activityId);
      }
      return newSet;
    });
  };

  const handleExport = () => {
    const exportData = filteredActivities.map(activity => ({
      timestamp: activity.timestamp,
      type: activity.type,
      severity: activity.severity,
      message: activity.message,
      deviceId: activity.deviceId,
      deviceName: activity.deviceName,
      details: activity.details,
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hal-activities-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveFilters = selectedTypes.length > 0 || selectedSeverities.length > 0 || 
    selectedDevices.length > 0 || searchTerm !== '';

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Activity Feed
      </Typography>

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <TextField
            placeholder="Search activities..."
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
          <Button
            variant="outlined"
            startIcon={<FilterList />}
            onClick={(e) => setFilterMenuAnchor(e.currentTarget)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
          >
            Filters {hasActiveFilters && `(${selectedTypes.length + selectedSeverities.length + selectedDevices.length})`}
          </Button>

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
            {selectedTypes.map(type => (
              <Chip
                key={type}
                label={type.replace('_', ' ')}
                size="small"
                onDelete={() => setSelectedTypes(prev => prev.filter(t => t !== type))}
              />
            ))}
            {selectedSeverities.map(severity => (
              <Chip
                key={severity}
                label={severity}
                size="small"
                color={getSeverityColor(severity as HALActivity['severity'])}
                onDelete={() => setSelectedSeverities(prev => prev.filter(s => s !== severity))}
              />
            ))}
            {selectedDevices.map(deviceId => {
              const device = devices.find(d => d.id === deviceId);
              return (
                <Chip
                  key={deviceId}
                  label={device?.name || deviceId}
                  size="small"
                  onDelete={() => setSelectedDevices(prev => prev.filter(d => d !== deviceId))}
                />
              );
            })}
            <Button
              size="small"
              onClick={() => {
                setSelectedTypes([]);
                setSelectedSeverities([]);
                setSelectedDevices([]);
                setSearchTerm('');
              }}
            >
              Clear all
            </Button>
          </Box>
        )}
      </Paper>

      {/* Activity List */}
      {groupedActivities.length === 0 ? (
        <Alert severity="info">
          No activities found matching the current filters.
        </Alert>
      ) : (
        <Box>
          {groupedActivities.map(group => (
            <Paper key={group.date} sx={{ mb: 2 }}>
              {/* Date Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  },
                }}
                onClick={() => toggleGroup(group.date)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6">{getDateLabel(group.date)}</Typography>
                  <Chip label={group.activities.length} size="small" />
                </Box>
                <IconButton size="small">
                  {expandedGroups.has(group.date) ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>

              {/* Activities */}
              <Collapse in={expandedGroups.has(group.date)}>
                <List disablePadding>
                  {group.activities.map((activity, index) => (
                    <React.Fragment key={activity.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        sx={{
                          '&:hover': {
                            bgcolor: alpha(theme.palette.action.hover, 0.05),
                          },
                        }}
                      >
                        <ListItemIcon>
                          <Avatar
                            sx={{
                              bgcolor: alpha(
                                theme.palette[getSeverityColor(activity.severity)].main,
                                0.1
                              ),
                              width: 40,
                              height: 40,
                            }}
                          >
                            {getActivityIcon(activity.type)}
                          </Avatar>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">{activity.message}</Typography>
                              {activity.deviceName && (
                                <Chip
                                  label={activity.deviceName}
                                  size="small"
                                  variant="outlined"
                                  icon={<DeviceHub />}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" color="text.secondary">
                                {formatDistanceToNow(new Date(activity.timestamp), {
                                  addSuffix: true,
                                })}
                                {' • '}
                                {new Date(activity.timestamp).toLocaleTimeString()}
                              </Typography>
                              {activity.details && showDetails.has(activity.id) && (
                                <Box
                                  sx={{
                                    mt: 1,
                                    p: 1,
                                    bgcolor: alpha(theme.palette.background.default, 0.5),
                                    borderRadius: 1,
                                  }}
                                >
                                  <Typography
                                    variant="caption"
                                    component="pre"
                                    sx={{ fontFamily: 'monospace' }}
                                  >
                                    {JSON.stringify(activity.details, null, 2)}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          }
                        />
                        {activity.details && (
                          <IconButton
                            size="small"
                            onClick={() => toggleDetails(activity.id)}
                          >
                            {showDetails.has(activity.id) ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        )}
                      </ListItem>
                    </React.Fragment>
                  ))}
                </List>
              </Collapse>
            </Paper>
          ))}
        </Box>
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
          Filter Activities
        </Typography>

        {/* Activity Type Filter */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Activity Types</InputLabel>
          <Select
            multiple
            value={selectedTypes}
            onChange={(e) => setSelectedTypes(e.target.value as string[])}
            size="small"
          >
            {activityTypes.map(type => (
              <MenuItem key={type} value={type}>
                {type.replace(/_/g, ' ').charAt(0).toUpperCase() + type.replace(/_/g, ' ').slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Severity Filter */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Severity</InputLabel>
          <Select
            multiple
            value={selectedSeverities}
            onChange={(e) => setSelectedSeverities(e.target.value as string[])}
            size="small"
          >
            {severityLevels.map(severity => (
              <MenuItem key={severity} value={severity}>
                <Chip
                  label={severity}
                  size="small"
                  color={getSeverityColor(severity as HALActivity['severity'])}
                />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Device Filter */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Devices</InputLabel>
          <Select
            multiple
            value={selectedDevices}
            onChange={(e) => setSelectedDevices(e.target.value as string[])}
            size="small"
          >
            {devices.map(device => (
              <MenuItem key={device.id} value={device.id}>
                {device.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setFilterMenuAnchor(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => setFilterMenuAnchor(null)}
          >
            Apply
          </Button>
        </Box>
      </Menu>

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

export default HALActivityFeed;