/**
 * AlertDashboard Component
 * Comprehensive overview of all active alerts with filtering, search, and management capabilities
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Badge,
  Avatar,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  LinearProgress,
  CircularProgress,
  Switch,
  FormControlLabel,
  InputAdornment,
  Menu,
  ListItemButton
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Notifications as NotificationsIcon,
  NotificationsOff as NotificationsOffIcon,
  VolumeOff as SilenceIcon,
  Group as GroupIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  ExpandMore as ExpandMoreIcon,
  MoreVert as MoreVertIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { 
  AlertDashboardProps, 
  AlertInstance, 
  AlertFilter,
  ThresholdDefinition,
  AlertStatistics 
} from '../types/threshold-types';

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

const STATUS_COLORS = {
  active: '#f44336',
  acknowledged: '#ff9800',
  resolved: '#4caf50'
};

export const AlertDashboard: React.FC<AlertDashboardProps> = ({
  alerts,
  thresholds,
  onAlertAcknowledge,
  onAlertResolve,
  onAlertSilence,
  onBulkOperation,
  onFilterChange,
  refreshInterval = 30000,
  className
}) => {
  const theme = useTheme();
  
  // State management
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<'table' | 'timeline' | 'cards'>('table');
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [bulkOperation, setBulkOperation] = useState<string>('');
  const [selectedAlert, setSelectedAlert] = useState<AlertInstance | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [silenceDialogOpen, setSilenceDialogOpen] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState<number>(1);
  const [silenceUnit, setSilenceUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filter, setFilter] = useState<AlertFilter>({
    severity: 'all',
    status: 'all',
    searchText: ''
  });
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortBy, setSortBy] = useState<keyof AlertInstance>('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // UI state
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !refreshInterval) return;
    
    const interval = setInterval(() => {
      // Trigger refresh through parent component
      onFilterChange?.(filter);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, filter, onFilterChange]);
  
  // Filter and sort alerts
  const filteredAlerts = useMemo(() => {
    let filtered = alerts.filter(alert => {
      // Severity filter
      if (filter.severity !== 'all' && alert.severity !== filter.severity) {
        return false;
      }
      
      // Status filter
      if (filter.status !== 'all') {
        if (filter.status === 'active' && (alert.acknowledged || alert.resolved)) {
          return false;
        }
        if (filter.status === 'acknowledged' && (!alert.acknowledged || alert.resolved)) {
          return false;
        }
        if (filter.status === 'resolved' && !alert.resolved) {
          return false;
        }
      }
      
      // Time range filter
      if (filter.timeRange) {
        if (alert.timestamp < filter.timeRange.start || alert.timestamp > filter.timeRange.end) {
          return false;
        }
      }
      
      // Metric filter
      if (filter.metricIds && filter.metricIds.length > 0) {
        const threshold = thresholds.find(t => t.id === alert.thresholdId);
        if (!threshold || !filter.metricIds.includes(threshold.metricId)) {
          return false;
        }
      }
      
      // Threshold filter
      if (filter.thresholdIds && filter.thresholdIds.length > 0) {
        if (!filter.thresholdIds.includes(alert.thresholdId)) {
          return false;
        }
      }
      
      // Search text filter
      if (filter.searchText) {
        const searchText = filter.searchText.toLowerCase();
        const threshold = thresholds.find(t => t.id === alert.thresholdId);
        if (!alert.message.toLowerCase().includes(searchText) &&
            !alert.severity.toLowerCase().includes(searchText) &&
            !threshold?.name.toLowerCase().includes(searchText) &&
            !threshold?.metricName.toLowerCase().includes(searchText)) {
          return false;
        }
      }
      
      return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = a.timestamp.getTime();
          bValue = b.timestamp.getTime();
          break;
        case 'severity':
          const severityOrder = { info: 1, warning: 2, error: 3, critical: 4 };
          aValue = severityOrder[a.severity];
          bValue = severityOrder[b.severity];
          break;
        case 'value':
          aValue = a.value;
          bValue = b.value;
          break;
        case 'message':
          aValue = a.message.toLowerCase();
          bValue = b.message.toLowerCase();
          break;
        default:
          aValue = a.timestamp.getTime();
          bValue = b.timestamp.getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
    
    return filtered;
  }, [alerts, filter, thresholds, sortBy, sortOrder]);
  
  // Calculate statistics
  const statistics: AlertStatistics = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter(a => !a.acknowledged && !a.resolved).length;
    const acknowledged = alerts.filter(a => a.acknowledged && !a.resolved).length;
    const resolved = alerts.filter(a => a.resolved).length;
    
    const bySeverity = alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byMetric = alerts.reduce((acc, alert) => {
      const threshold = thresholds.find(t => t.id === alert.thresholdId);
      if (threshold) {
        acc[threshold.metricName] = (acc[threshold.metricName] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate resolution time for resolved alerts
    const resolvedAlerts = alerts.filter(a => a.resolved && a.resolvedAt);
    const averageResolutionTime = resolvedAlerts.length > 0 ? 
      resolvedAlerts.reduce((sum, alert) => {
        const resolutionTime = alert.resolvedAt!.getTime() - alert.timestamp.getTime();
        return sum + resolutionTime;
      }, 0) / resolvedAlerts.length : 0;
    
    // Calculate escalation rate (alerts that went from warning to critical)
    const escalatedAlerts = alerts.filter(a => a.escalationLevel > 0);
    const escalationRate = total > 0 ? (escalatedAlerts.length / total) * 100 : 0;
    
    // Generate time-based trends (last 24 hours)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentAlerts = alerts.filter(a => a.timestamp >= oneDayAgo);
    
    const byTimeRange = [];
    for (let i = 0; i < 24; i++) {
      const hourStart = new Date(oneDayAgo.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      const hourAlerts = recentAlerts.filter(a => a.timestamp >= hourStart && a.timestamp < hourEnd);
      
      const severityCounts = hourAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      for (const [severity, count] of Object.entries(severityCounts)) {
        byTimeRange.push({
          timestamp: hourStart,
          count,
          severity
        });
      }
    }
    
    return {
      total,
      active,
      acknowledged,
      resolved,
      bySeverity,
      byMetric,
      byTimeRange,
      averageResolutionTime,
      escalationRate
    };
  }, [alerts, thresholds]);
  
  // Handle operations
  const handleFilterChange = useCallback((newFilter: Partial<AlertFilter>) => {
    const updatedFilter = { ...filter, ...newFilter };
    setFilter(updatedFilter);
    onFilterChange?.(updatedFilter);
  }, [filter, onFilterChange]);
  
  const handleAlertAction = useCallback(async (
    alertId: string, 
    action: 'acknowledge' | 'resolve' | 'silence',
    comment?: string,
    duration?: number
  ) => {
    setLoading(true);
    try {
      switch (action) {
        case 'acknowledge':
          await onAlertAcknowledge(alertId, comment);
          setSnackbar({
            open: true,
            message: 'Alert acknowledged successfully',
            severity: 'success'
          });
          break;
        case 'resolve':
          await onAlertResolve(alertId, comment);
          setSnackbar({
            open: true,
            message: 'Alert resolved successfully',
            severity: 'success'
          });
          break;
        case 'silence':
          if (duration) {
            await onAlertSilence(alertId, duration);
            setSnackbar({
              open: true,
              message: `Alert silenced for ${duration} minutes`,
              severity: 'success'
            });
          }
          break;
      }
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Failed to ${action} alert: ${error}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [onAlertAcknowledge, onAlertResolve, onAlertSilence]);
  
  const handleBulkAction = useCallback(async () => {
    if (!bulkOperation || selectedAlerts.size === 0) return;
    
    setLoading(true);
    try {
      const alertIds = Array.from(selectedAlerts);
      await onBulkOperation(bulkOperation, alertIds);
      
      setSnackbar({
        open: true,
        message: `Bulk ${bulkOperation} completed for ${alertIds.length} alerts`,
        severity: 'success'
      });
      
      setSelectedAlerts(new Set());
      setBulkOperation('');
    } catch (error) {
      setSnackbar({
        open: true,
        message: `Bulk operation failed: ${error}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [bulkOperation, selectedAlerts, onBulkOperation]);
  
  // Format timestamp
  const formatTimestamp = useCallback((timestamp: Date) => {
    return timestamp.toLocaleString();
  }, []);
  
  // Format duration
  const formatDuration = useCallback((milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);
  
  // Get alert status
  const getAlertStatus = useCallback((alert: AlertInstance) => {
    if (alert.resolved) return 'resolved';
    if (alert.acknowledged) return 'acknowledged';
    return 'active';
  }, []);
  
  // Render statistics cards
  const renderStatistics = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="primary">
              {statistics.total}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Total Alerts
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="error.main">
              {statistics.active}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Active Alerts
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="warning.main">
              {statistics.acknowledged}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Acknowledged
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} sm={6} md={3}>
        <Card>
          <CardContent sx={{ textAlign: 'center' }}>
            <Typography variant="h4" color="success.main">
              {statistics.resolved}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Resolved
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="By Severity" />
          <CardContent>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(statistics.bySeverity).map(([severity, count]) => (
                <Chip
                  key={severity}
                  icon={SEVERITY_ICONS[severity as keyof typeof SEVERITY_ICONS]}
                  label={`${severity.toUpperCase()}: ${count}`}
                  color={severity === 'critical' || severity === 'error' ? 'error' : 
                         severity === 'warning' ? 'warning' : 'info'}
                  size="small"
                />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
      
      <Grid item xs={12} md={6}>
        <Card>
          <CardHeader title="Performance Metrics" />
          <CardContent>
            <Typography variant="body2" gutterBottom>
              <strong>Average Resolution Time:</strong> {formatDuration(statistics.averageResolutionTime)}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Escalation Rate:</strong> {statistics.escalationRate.toFixed(1)}%
            </Typography>
            <Typography variant="body2">
              <strong>Most Active Metric:</strong> {
                Object.entries(statistics.byMetric).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'
              }
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
  
  // Render filters
  const renderFilters = () => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Search alerts..."
              value={filter.searchText || ''}
              onChange={(e) => handleFilterChange({ searchText: e.target.value })}
              size="small"
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Severity</InputLabel>
              <Select
                value={filter.severity || 'all'}
                onChange={(e) => handleFilterChange({ severity: e.target.value as any })}
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
                value={filter.status || 'all'}
                onChange={(e) => handleFilterChange({ status: e.target.value as any })}
                label="Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="acknowledged">Acknowledged</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Bulk Action</InputLabel>
              <Select
                value={bulkOperation}
                onChange={(e) => setBulkOperation(e.target.value)}
                label="Bulk Action"
                disabled={selectedAlerts.size === 0}
              >
                <MenuItem value="acknowledge">Acknowledge</MenuItem>
                <MenuItem value="resolve">Resolve</MenuItem>
                <MenuItem value="silence">Silence</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Box display="flex" gap={1} alignItems="center">
              <Button
                onClick={handleBulkAction}
                disabled={!bulkOperation || selectedAlerts.size === 0 || loading}
                variant="outlined"
                size="small"
              >
                Apply to {selectedAlerts.size} selected
              </Button>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    size="small"
                  />
                }
                label="Auto-refresh"
              />
              
              <IconButton
                onClick={() => onFilterChange?.(filter)}
                disabled={loading}
                size="small"
              >
                <RefreshIcon />
              </IconButton>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
  
  // Render alert table
  const renderAlertTable = () => {
    const paginatedAlerts = filteredAlerts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    
    return (
      <Card>
        {loading && <LinearProgress />}
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedAlerts.size > 0 && selectedAlerts.size < filteredAlerts.length}
                    checked={filteredAlerts.length > 0 && selectedAlerts.size === filteredAlerts.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAlerts(new Set(filteredAlerts.map(a => a.id)));
                      } else {
                        setSelectedAlerts(new Set());
                      }
                    }}
                  />
                </TableCell>
                
                <TableCell>Status</TableCell>
                
                <TableCell sortDirection={sortBy === 'severity' ? sortOrder : false}>
                  <TableSortLabel
                    active={sortBy === 'severity'}
                    direction={sortBy === 'severity' ? sortOrder : 'asc'}
                    onClick={() => {
                      if (sortBy === 'severity') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('severity');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    Severity
                  </TableSortLabel>
                </TableCell>
                
                <TableCell>Message</TableCell>
                
                <TableCell>Metric</TableCell>
                
                <TableCell sortDirection={sortBy === 'value' ? sortOrder : false}>
                  <TableSortLabel
                    active={sortBy === 'value'}
                    direction={sortBy === 'value' ? sortOrder : 'asc'}
                    onClick={() => {
                      if (sortBy === 'value') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('value');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    Value
                  </TableSortLabel>
                </TableCell>
                
                <TableCell sortDirection={sortBy === 'timestamp' ? sortOrder : false}>
                  <TableSortLabel
                    active={sortBy === 'timestamp'}
                    direction={sortBy === 'timestamp' ? sortOrder : 'asc'}
                    onClick={() => {
                      if (sortBy === 'timestamp') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy('timestamp');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    Time
                  </TableSortLabel>
                </TableCell>
                
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            
            <TableBody>
              {paginatedAlerts.map((alert) => {
                const threshold = thresholds.find(t => t.id === alert.thresholdId);
                const status = getAlertStatus(alert);
                
                return (
                  <TableRow
                    key={alert.id}
                    selected={selectedAlerts.has(alert.id)}
                    sx={{
                      backgroundColor: alert.severity === 'critical' && status === 'active' ? 
                        alpha(SEVERITY_COLORS.critical, 0.05) : 'inherit'
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedAlerts.has(alert.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedAlerts);
                          if (e.target.checked) {
                            newSelected.add(alert.id);
                          } else {
                            newSelected.delete(alert.id);
                          }
                          setSelectedAlerts(newSelected);
                        }}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Chip
                        label={status.toUpperCase()}
                        color={status === 'active' ? 'error' : 
                               status === 'acknowledged' ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <div style={{ color: SEVERITY_COLORS[alert.severity] }}>
                          {SEVERITY_ICONS[alert.severity]}
                        </div>
                        <Typography variant="body2" fontWeight="bold">
                          {alert.severity.toUpperCase()}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {alert.message}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {threshold?.metricName || 'Unknown'}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {alert.value.toFixed(2)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Typography variant="body2">
                        {formatTimestamp(alert.timestamp)}
                      </Typography>
                    </TableCell>
                    
                    <TableCell>
                      <Box display="flex" gap={0.5}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedAlert(alert);
                              setDetailDialogOpen(true);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        
                        {!alert.acknowledged && (
                          <Tooltip title="Acknowledge">
                            <IconButton
                              size="small"
                              onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                              color="success"
                              disabled={loading}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {!alert.resolved && (
                          <Tooltip title="Resolve">
                            <IconButton
                              size="small"
                              onClick={() => handleAlertAction(alert.id, 'resolve')}
                              color="error"
                              disabled={loading}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        {status === 'active' && (
                          <Tooltip title="Silence">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setSelectedAlert(alert);
                                setSilenceDialogOpen(true);
                              }}
                              disabled={loading}
                            >
                              <SilenceIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredAlerts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Card>
    );
  };
  
  // Render timeline view
  const renderTimelineView = () => (
    <Card>
      <CardContent>
        <Timeline>
          {filteredAlerts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((alert, index) => {
            const threshold = thresholds.find(t => t.id === alert.thresholdId);
            const status = getAlertStatus(alert);
            
            return (
              <TimelineItem key={alert.id}>
                <TimelineSeparator>
                  <TimelineDot 
                    color={status === 'active' ? 'error' : 
                           status === 'acknowledged' ? 'warning' : 'success'}
                  >
                    {SEVERITY_ICONS[alert.severity]}
                  </TimelineDot>
                  {index < filteredAlerts.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                
                <TimelineContent>
                  <Paper sx={{ p: 2, mb: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="h6">
                          {alert.message}
                        </Typography>
                        <Chip
                          label={alert.severity.toUpperCase()}
                          color={alert.severity === 'critical' || alert.severity === 'error' ? 'error' : 
                                 alert.severity === 'warning' ? 'warning' : 'info'}
                          size="small"
                        />
                        <Chip
                          label={status.toUpperCase()}
                          color={status === 'active' ? 'error' : 
                                 status === 'acknowledged' ? 'warning' : 'success'}
                          size="small"
                        />
                      </Box>
                      
                      <Typography variant="caption" color="textSecondary">
                        {formatTimestamp(alert.timestamp)}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      <strong>Metric:</strong> {threshold?.metricName || 'Unknown'} • 
                      <strong> Value:</strong> {alert.value.toFixed(2)}
                    </Typography>
                    
                    {alert.acknowledgedAt && (
                      <Typography variant="caption" color="success.main" display="block">
                        Acknowledged at {formatTimestamp(alert.acknowledgedAt)}
                        {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                      </Typography>
                    )}
                    
                    {alert.resolvedAt && (
                      <Typography variant="caption" color="success.main" display="block">
                        Resolved at {formatTimestamp(alert.resolvedAt)}
                        {alert.resolvedBy && ` by ${alert.resolvedBy}`}
                      </Typography>
                    )}
                    
                    <Box display="flex" gap={1} mt={2}>
                      {!alert.acknowledged && (
                        <Button
                          size="small"
                          startIcon={<CheckCircleIcon />}
                          onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                          disabled={loading}
                        >
                          Acknowledge
                        </Button>
                      )}
                      
                      {!alert.resolved && (
                        <Button
                          size="small"
                          startIcon={<CancelIcon />}
                          onClick={() => handleAlertAction(alert.id, 'resolve')}
                          color="error"
                          disabled={loading}
                        >
                          Resolve
                        </Button>
                      )}
                    </Box>
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            );
          })}
        </Timeline>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50]}
          component="div"
          count={filteredAlerts.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </CardContent>
    </Card>
  );
  
  return (
    <Box className={className}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" component="h1">
          Alert Dashboard
        </Typography>
        
        <Box display="flex" gap={1}>
          <Tooltip title="View Mode">
            <IconButton
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              size="small"
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
          
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
          >
            <MenuItem 
              onClick={() => {
                setViewMode('table');
                setMenuAnchor(null);
              }}
              selected={viewMode === 'table'}
            >
              Table View
            </MenuItem>
            <MenuItem 
              onClick={() => {
                setViewMode('timeline');
                setMenuAnchor(null);
              }}
              selected={viewMode === 'timeline'}
            >
              Timeline View
            </MenuItem>
          </Menu>
        </Box>
      </Box>
      
      {/* Statistics */}
      {renderStatistics()}
      
      {/* Filters */}
      {renderFilters()}
      
      {/* Content based on view mode */}
      {viewMode === 'table' && renderAlertTable()}
      {viewMode === 'timeline' && renderTimelineView()}
      
      {/* Detail Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedAlert && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={2}>
                <div style={{ color: SEVERITY_COLORS[selectedAlert.severity] }}>
                  {SEVERITY_ICONS[selectedAlert.severity]}
                </div>
                <Typography variant="h6">
                  {selectedAlert.severity.toUpperCase()} Alert Details
                </Typography>
                <Chip
                  label={getAlertStatus(selectedAlert).toUpperCase()}
                  color={getAlertStatus(selectedAlert) === 'active' ? 'error' : 
                         getAlertStatus(selectedAlert) === 'acknowledged' ? 'warning' : 'success'}
                  size="small"
                />
                <IconButton
                  onClick={() => setDetailDialogOpen(false)}
                  sx={{ ml: 'auto' }}
                  size="small"
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body1" gutterBottom>
                    <strong>Message:</strong> {selectedAlert.message}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Timestamp:</strong> {formatTimestamp(selectedAlert.timestamp)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Value:</strong> {selectedAlert.value.toFixed(2)}
                    {selectedAlert.expectedValue && (
                      <> (Expected: {selectedAlert.expectedValue.toFixed(2)})</>
                    )}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Threshold ID:</strong> {selectedAlert.thresholdId}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    <strong>Escalation Level:</strong> {selectedAlert.escalationLevel}
                  </Typography>
                </Grid>
                
                {selectedAlert.acknowledgedAt && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      <strong>Acknowledged:</strong> {formatTimestamp(selectedAlert.acknowledgedAt)}
                      {selectedAlert.acknowledgedBy && ` by ${selectedAlert.acknowledgedBy}`}
                    </Typography>
                  </Grid>
                )}
                
                {selectedAlert.resolvedAt && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      <strong>Resolved:</strong> {formatTimestamp(selectedAlert.resolvedAt)}
                      {selectedAlert.resolvedBy && ` by ${selectedAlert.resolvedBy}`}
                    </Typography>
                  </Grid>
                )}
                
                {selectedAlert.metadata && Object.keys(selectedAlert.metadata).length > 0 && (
                  <Grid item xs={12}>
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Additional Metadata</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                          {JSON.stringify(selectedAlert.metadata, null, 2)}
                        </pre>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}
              </Grid>
            </DialogContent>
            
            <DialogActions>
              <Button onClick={() => setDetailDialogOpen(false)}>
                Close
              </Button>
              
              {!selectedAlert.acknowledged && (
                <Button
                  onClick={() => {
                    handleAlertAction(selectedAlert.id, 'acknowledge');
                    setDetailDialogOpen(false);
                  }}
                  startIcon={<CheckCircleIcon />}
                  color="success"
                  variant="contained"
                  disabled={loading}
                >
                  Acknowledge
                </Button>
              )}
              
              {!selectedAlert.resolved && (
                <Button
                  onClick={() => {
                    handleAlertAction(selectedAlert.id, 'resolve');
                    setDetailDialogOpen(false);
                  }}
                  startIcon={<CancelIcon />}
                  color="error"
                  variant="contained"
                  disabled={loading}
                >
                  Resolve
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Silence Dialog */}
      <Dialog
        open={silenceDialogOpen}
        onClose={() => setSilenceDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Silence Alert
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="textSecondary" paragraph>
            How long would you like to silence this alert?
          </Typography>
          
          <Box display="flex" gap={2} alignItems="center">
            <TextField
              label="Duration"
              type="number"
              value={silenceDuration}
              onChange={(e) => setSilenceDuration(Number(e.target.value))}
              size="small"
              sx={{ width: 120 }}
            />
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Unit</InputLabel>
              <Select
                value={silenceUnit}
                onChange={(e) => setSilenceUnit(e.target.value as any)}
                label="Unit"
              >
                <MenuItem value="minutes">Minutes</MenuItem>
                <MenuItem value="hours">Hours</MenuItem>
                <MenuItem value="days">Days</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setSilenceDialogOpen(false)}>
            Cancel
          </Button>
          
          <Button
            onClick={() => {
              if (selectedAlert) {
                const durationInMinutes = silenceUnit === 'minutes' ? silenceDuration :
                                        silenceUnit === 'hours' ? silenceDuration * 60 :
                                        silenceDuration * 60 * 24;
                handleAlertAction(selectedAlert.id, 'silence', undefined, durationInMinutes);
              }
              setSilenceDialogOpen(false);
            }}
            startIcon={<SilenceIcon />}
            variant="contained"
            disabled={loading}
          >
            Silence
          </Button>
        </DialogActions>
      </Dialog>
      
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

export default AlertDashboard;