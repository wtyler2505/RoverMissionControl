/**
 * Emergency Stop Audit Trail Component
 * 
 * Provides comprehensive audit logging and visualization for all
 * emergency stop confirmation actions following safety standards.
 * 
 * @module EmergencyStopAuditTrail
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  Paper,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  useTheme,
  alpha,
} from '@mui/material';
import {
  History as HistoryIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import {
  AuditEvent,
  AuditEventType,
  ConfirmationMethod,
  SecurityLevel,
  SystemState,
} from './EmergencyStopConfirmation';

interface EmergencyStopAuditTrailProps {
  events: AuditEvent[];
  onExport?: (events: AuditEvent[]) => void;
  maxEvents?: number;
}

interface FilterState {
  searchTerm: string;
  eventType: AuditEventType | 'ALL';
  method: ConfirmationMethod | 'ALL';
  systemState: SystemState | 'ALL';
  securityLevel: SecurityLevel | 'ALL';
  dateFrom: string;
  dateTo: string;
  successOnly: boolean;
}

const EmergencyStopAuditTrail: React.FC<EmergencyStopAuditTrailProps> = ({
  events,
  onExport,
  maxEvents = 1000,
}) => {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    eventType: 'ALL',
    method: 'ALL',
    systemState: 'ALL',
    securityLevel: 'ALL',
    dateFrom: '',
    dateTo: '',
    successOnly: false,
  });

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          event.id.toLowerCase().includes(searchLower) ||
          event.userId?.toLowerCase().includes(searchLower) ||
          event.secondaryUserId?.toLowerCase().includes(searchLower) ||
          event.details?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Event type filter
      if (filters.eventType !== 'ALL' && event.type !== filters.eventType) {
        return false;
      }

      // Method filter
      if (filters.method !== 'ALL' && event.method !== filters.method) {
        return false;
      }

      // System state filter
      if (filters.systemState !== 'ALL' && event.systemState !== filters.systemState) {
        return false;
      }

      // Security level filter
      if (filters.securityLevel !== 'ALL' && event.securityLevel !== filters.securityLevel) {
        return false;
      }

      // Date range filter
      const eventDate = new Date(event.timestamp).getTime();
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom).getTime();
        if (eventDate < fromDate) return false;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo).getTime();
        if (eventDate > toDate) return false;
      }

      // Success filter
      if (filters.successOnly && !event.success) {
        return false;
      }

      return true;
    }).slice(0, maxEvents);
  }, [events, filters, maxEvents]);

  // Get event type icon
  const getEventTypeIcon = (type: AuditEventType) => {
    switch (type) {
      case AuditEventType.CONFIRMATION_COMPLETED:
        return <CheckCircleIcon fontSize="small" color="success" />;
      case AuditEventType.CONFIRMATION_FAILED:
        return <CancelIcon fontSize="small" color="error" />;
      case AuditEventType.CONFIRMATION_CANCELLED:
        return <CancelIcon fontSize="small" color="warning" />;
      case AuditEventType.BYPASS_ACTIVATED:
        return <SpeedIcon fontSize="small" color="warning" />;
      case AuditEventType.TWO_PERSON_AUTH_INITIATED:
      case AuditEventType.TWO_PERSON_AUTH_COMPLETED:
        return <GroupIcon fontSize="small" color="info" />;
      default:
        return <HistoryIcon fontSize="small" />;
    }
  };

  // Get method color
  const getMethodColor = (method: ConfirmationMethod) => {
    switch (method) {
      case ConfirmationMethod.NONE:
        return 'default';
      case ConfirmationMethod.DOUBLE_TAP:
        return 'primary';
      case ConfirmationMethod.HOLD_TO_CONFIRM:
        return 'secondary';
      case ConfirmationMethod.GESTURE:
        return 'info';
      case ConfirmationMethod.TWO_PERSON:
        return 'warning';
      default:
        return 'default';
    }
  };

  // Get security level color
  const getSecurityLevelColor = (level: SecurityLevel) => {
    switch (level) {
      case SecurityLevel.LOW:
        return 'success';
      case SecurityLevel.MEDIUM:
        return 'warning';
      case SecurityLevel.HIGH:
      case SecurityLevel.CRITICAL:
        return 'error';
      default:
        return 'default';
    }
  };

  // Handle export
  const handleExport = () => {
    if (onExport) {
      onExport(filteredEvents);
    } else {
      // Default CSV export
      const csv = [
        ['ID', 'Timestamp', 'Type', 'Method', 'User ID', 'Secondary User', 'System State', 'Security Level', 'Success', 'Details'].join(','),
        ...filteredEvents.map(event => [
          event.id,
          new Date(event.timestamp).toISOString(),
          event.type,
          event.method,
          event.userId || '',
          event.secondaryUserId || '',
          event.systemState,
          event.securityLevel,
          event.success.toString(),
          `"${event.details || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `emergency_stop_audit_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Reset filters
  const handleResetFilters = () => {
    setFilters({
      searchTerm: '',
      eventType: 'ALL',
      method: 'ALL',
      systemState: 'ALL',
      securityLevel: 'ALL',
      dateFrom: '',
      dateTo: '',
      successOnly: false,
    });
  };

  return (
    <Card>
      <CardHeader
        avatar={<HistoryIcon />}
        title="Emergency Stop Audit Trail"
        subheader={`${filteredEvents.length} events (${events.length} total)`}
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Toggle filters">
              <IconButton onClick={() => setShowFilters(!showFilters)}>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export data">
              <IconButton onClick={handleExport}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <CardContent>
        {/* Search Bar */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by ID, user, or details..."
          value={filters.searchTerm}
          onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Filters */}
        {showFilters && (
          <Paper sx={{ p: 2, mb: 2, backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Event Type</InputLabel>
                  <Select
                    value={filters.eventType}
                    label="Event Type"
                    onChange={(e) => setFilters({ ...filters, eventType: e.target.value as any })}
                  >
                    <MenuItem value="ALL">All Types</MenuItem>
                    {Object.values(AuditEventType).map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Method</InputLabel>
                  <Select
                    value={filters.method}
                    label="Method"
                    onChange={(e) => setFilters({ ...filters, method: e.target.value as any })}
                  >
                    <MenuItem value="ALL">All Methods</MenuItem>
                    {Object.values(ConfirmationMethod).map((method) => (
                      <MenuItem key={method} value={method}>{method}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>System State</InputLabel>
                  <Select
                    value={filters.systemState}
                    label="System State"
                    onChange={(e) => setFilters({ ...filters, systemState: e.target.value as any })}
                  >
                    <MenuItem value="ALL">All States</MenuItem>
                    {Object.values(SystemState).map((state) => (
                      <MenuItem key={state} value={state}>{state}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Security Level</InputLabel>
                  <Select
                    value={filters.securityLevel}
                    label="Security Level"
                    onChange={(e) => setFilters({ ...filters, securityLevel: e.target.value as any })}
                  >
                    <MenuItem value="ALL">All Levels</MenuItem>
                    {Object.values(SecurityLevel).map((level) => (
                      <MenuItem key={level} value={level}>{level}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="datetime-local"
                  label="From Date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="datetime-local"
                  label="To Date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleResetFilters}
                  sx={{ height: '40px' }}
                >
                  Reset Filters
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Events Table */}
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Event</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>User</TableCell>
                <TableCell>System State</TableCell>
                <TableCell>Security</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEvents
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((event) => (
                  <TableRow
                    key={event.id}
                    hover
                    sx={{
                      backgroundColor: event.success
                        ? 'inherit'
                        : alpha(theme.palette.error.main, 0.05),
                    }}
                  >
                    <TableCell>
                      <Typography variant="caption">
                        {new Date(event.timestamp).toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {getEventTypeIcon(event.type)}
                        <Typography variant="caption">
                          {event.type.replace(/_/g, ' ')}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={event.method}
                        color={getMethodColor(event.method) as any}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <PersonIcon fontSize="small" sx={{ opacity: 0.6 }} />
                        <Typography variant="caption">{event.userId}</Typography>
                        {event.secondaryUserId && (
                          <>
                            <Typography variant="caption" sx={{ mx: 0.5 }}>+</Typography>
                            <Typography variant="caption">{event.secondaryUserId}</Typography>
                          </>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={event.systemState}
                        color={event.systemState === SystemState.EMERGENCY ? 'error' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={event.securityLevel}
                        color={getSecurityLevelColor(event.securityLevel) as any}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={event.success ? 'Success' : 'Failed'}
                        color={event.success ? 'success' : 'error'}
                        icon={event.success ? <CheckCircleIcon /> : <CancelIcon />}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View details">
                        <IconButton
                          size="small"
                          onClick={() => setSelectedEvent(event)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          rowsPerPageOptions={[5, 10, 25, 50]}
          component="div"
          count={filteredEvents.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </CardContent>

      {/* Event Details Dialog */}
      <Dialog
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedEvent && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={1} alignItems="center">
                {getEventTypeIcon(selectedEvent.type)}
                <Typography>Event Details</Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Event ID</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {selectedEvent.id}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                  <Typography variant="body2">
                    {new Date(selectedEvent.timestamp).toLocaleString()}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Event Type</Typography>
                  <Typography variant="body2">
                    {selectedEvent.type.replace(/_/g, ' ')}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Confirmation Method</Typography>
                  <Chip
                    label={selectedEvent.method}
                    color={getMethodColor(selectedEvent.method) as any}
                    size="small"
                  />
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Users</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={selectedEvent.userId}
                      icon={<PersonIcon />}
                      size="small"
                      variant="outlined"
                    />
                    {selectedEvent.secondaryUserId && (
                      <Chip
                        label={selectedEvent.secondaryUserId}
                        icon={<PersonIcon />}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">System Context</Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={selectedEvent.systemState}
                      size="small"
                      color={selectedEvent.systemState === SystemState.EMERGENCY ? 'error' : 'default'}
                    />
                    <Chip
                      label={selectedEvent.securityLevel}
                      size="small"
                      color={getSecurityLevelColor(selectedEvent.securityLevel) as any}
                    />
                  </Stack>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Result</Typography>
                  <Alert severity={selectedEvent.success ? 'success' : 'error'} sx={{ mt: 0.5 }}>
                    {selectedEvent.success ? 'Operation Successful' : 'Operation Failed'}
                  </Alert>
                </Box>

                {selectedEvent.details && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Details</Typography>
                    <Paper sx={{ p: 1.5, backgroundColor: alpha(theme.palette.grey[500], 0.1) }}>
                      <Typography variant="body2">{selectedEvent.details}</Typography>
                    </Paper>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedEvent(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Card>
  );
};

export default EmergencyStopAuditTrail;