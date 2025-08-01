import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  IconButton,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Collapse,
  Typography,
  Tooltip,
  CircularProgress,
  Alert,
  Grid,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  TableRows as TableIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowUp as ArrowUpIcon,
  Info as InfoIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { Timeline, TimelineItem, TimelineSeparator, TimelineDot, TimelineConnector, TimelineContent } from '@mui/lab';
import auditService, { getSeverityColor } from '../../../services/auditService';
import { AuditLog, AuditCategory, AuditSeverity, AuditSearchParams } from '../../../types/audit';

interface TimelineGrouping {
  timestamp: string;
  logs: AuditLog[];
}

const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  
  // Search parameters
  const [searchParams, setSearchParams] = useState<AuditSearchParams>({
    page: 1,
    page_size: 25,
    sort_by: 'timestamp',
    sort_order: 'desc'
  });
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<AuditCategory[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<AuditSeverity[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  const categories = Object.values(AuditCategory);
  const severities = Object.values(AuditSeverity);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params: AuditSearchParams = {
        ...searchParams,
        search_text: searchText || undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        severities: selectedSeverities.length > 0 ? selectedSeverities : undefined,
        start_date: dateRange.start ? dateRange.start.toISOString() : undefined,
        end_date: dateRange.end ? dateRange.end.toISOString() : undefined
      };
      
      const response = await auditService.searchLogs(params);
      setLogs(response.logs);
      setTotalCount(response.total);
    } catch (err) {
      setError('Failed to load audit logs');
      console.error('Audit logs error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchParams, searchText, selectedCategories, selectedSeverities, dateRange]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
    setSearchParams(prev => ({ ...prev, page: newPage + 1 }));
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
    setSearchParams(prev => ({ ...prev, page: 1, page_size: newRowsPerPage }));
  };

  const handleSearch = () => {
    setPage(0);
    setSearchParams(prev => ({ ...prev, page: 1 }));
  };

  const handleRowExpand = (logId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const handleExport = async () => {
    try {
      const params: AuditSearchParams = {
        search_text: searchText || undefined,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        severities: selectedSeverities.length > 0 ? selectedSeverities : undefined,
        start_date: dateRange.start ? dateRange.start.toISOString() : undefined,
        end_date: dateRange.end ? dateRange.end.toISOString() : undefined
      };
      
      const exportData = await auditService.createExport('csv', params);
      const blob = await auditService.downloadExport(exportData.id);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Group logs by time for timeline view
  const groupLogsByTime = (): TimelineGrouping[] => {
    const groups: { [key: string]: AuditLog[] } = {};
    
    logs.forEach(log => {
      const key = format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(log);
    });
    
    return Object.entries(groups)
      .map(([timestamp, logs]) => ({ timestamp, logs }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const renderTableView = () => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Timestamp</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Event Type</TableCell>
            <TableCell>Severity</TableCell>
            <TableCell>Actor</TableCell>
            <TableCell>Target</TableCell>
            <TableCell>Result</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((log) => (
            <React.Fragment key={log.id}>
              <TableRow hover>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => handleRowExpand(log.id)}
                  >
                    {expandedRows.has(log.id) ? <ArrowUpIcon /> : <ArrowDownIcon />}
                  </IconButton>
                </TableCell>
                <TableCell>{format(new Date(log.timestamp), 'MMM dd, HH:mm:ss')}</TableCell>
                <TableCell>
                  <Chip
                    label={log.category.replace(/_/g, ' ')}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{log.event_type}</TableCell>
                <TableCell>
                  <Chip
                    label={log.severity}
                    size="small"
                    style={{
                      backgroundColor: getSeverityColor(log.severity),
                      color: 'white'
                    }}
                  />
                </TableCell>
                <TableCell>{log.actor_name}</TableCell>
                <TableCell>{log.target_name || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={log.result}
                    size="small"
                    color={log.result === 'success' ? 'success' : log.result === 'failure' ? 'error' : 'warning'}
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton size="small">
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={9}>
                  <Collapse in={expandedRows.has(log.id)} timeout="auto" unmountOnExit>
                    <Box sx={{ margin: 1 }}>
                      <Typography variant="h6" gutterBottom component="div">
                        Details
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2">Action</Typography>
                          <Typography variant="body2" color="textSecondary" paragraph>
                            {log.action}
                          </Typography>
                          
                          {log.error_message && (
                            <>
                              <Typography variant="subtitle2">Error</Typography>
                              <Typography variant="body2" color="error" paragraph>
                                {log.error_message}
                              </Typography>
                            </>
                          )}
                          
                          <Typography variant="subtitle2">Request Details</Typography>
                          <Typography variant="body2" color="textSecondary">
                            IP: {log.actor_ip}<br />
                            Session: {log.session_id || 'N/A'}<br />
                            User Agent: {log.user_agent || 'N/A'}
                          </Typography>
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          {log.before_snapshot && (
                            <>
                              <Typography variant="subtitle2">Before</Typography>
                              <Box sx={{ backgroundColor: '#f5f5f5', p: 1, borderRadius: 1, mb: 1 }}>
                                <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                                  {JSON.stringify(log.before_snapshot, null, 2)}
                                </pre>
                              </Box>
                            </>
                          )}
                          
                          {log.after_snapshot && (
                            <>
                              <Typography variant="subtitle2">After</Typography>
                              <Box sx={{ backgroundColor: '#f5f5f5', p: 1, borderRadius: 1 }}>
                                <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                                  {JSON.stringify(log.after_snapshot, null, 2)}
                                </pre>
                              </Box>
                            </>
                          )}
                        </Grid>
                      </Grid>
                      
                      {log.tags.length > 0 && (
                        <Box mt={2}>
                          <Typography variant="subtitle2">Tags</Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                            {log.tags.map(tag => (
                              <Chip key={tag} label={tag} size="small" variant="outlined" />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderTimelineView = () => {
    const groupedLogs = groupLogsByTime();
    
    return (
      <Timeline position="alternate">
        {groupedLogs.map((group, index) => (
          <TimelineItem key={group.timestamp}>
            <TimelineSeparator>
              <TimelineDot color="primary" />
              {index < groupedLogs.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="subtitle2" color="textSecondary">
                {format(new Date(group.timestamp), 'MMM dd, yyyy HH:mm')}
              </Typography>
              {group.logs.map(log => (
                <Paper key={log.id} sx={{ p: 2, mt: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Box display="flex" gap={1} alignItems="center">
                      <Chip
                        label={log.severity}
                        size="small"
                        style={{
                          backgroundColor: getSeverityColor(log.severity),
                          color: 'white'
                        }}
                      />
                      <Chip
                        label={log.category.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Chip
                      label={log.result}
                      size="small"
                      color={log.result === 'success' ? 'success' : 'error'}
                    />
                  </Box>
                  <Typography variant="body2" fontWeight="medium">
                    {log.event_type}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {log.actor_name} → {log.target_name || 'System'}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {log.action}
                  </Typography>
                </Paper>
              ))}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Search and Filter Bar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search logs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </Button>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, value) => value && setViewMode(value)}
                size="small"
              >
                <ToggleButton value="table">
                  <TableIcon />
                </ToggleButton>
                <ToggleButton value="timeline">
                  <TimelineIcon />
                </ToggleButton>
              </ToggleButtonGroup>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExport}
              >
                Export
              </Button>
            </Box>
          </Grid>
        </Grid>
        
        <Collapse in={showFilters}>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Categories</InputLabel>
                <Select
                  multiple
                  value={selectedCategories}
                  onChange={(e) => setSelectedCategories(e.target.value as AuditCategory[])}
                  input={<OutlinedInput label="Categories" />}
                  renderValue={(selected) => selected.length + ' selected'}
                >
                  {categories.map((category) => (
                    <MenuItem key={category} value={category}>
                      <Checkbox checked={selectedCategories.indexOf(category) > -1} />
                      <ListItemText primary={category.replace(/_/g, ' ')} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Severities</InputLabel>
                <Select
                  multiple
                  value={selectedSeverities}
                  onChange={(e) => setSelectedSeverities(e.target.value as AuditSeverity[])}
                  input={<OutlinedInput label="Severities" />}
                  renderValue={(selected) => selected.length + ' selected'}
                >
                  {severities.map((severity) => (
                    <MenuItem key={severity} value={severity}>
                      <Checkbox checked={selectedSeverities.indexOf(severity) > -1} />
                      <ListItemText primary={severity} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Start Date"
                  value={dateRange.start}
                  onChange={(date) => setDateRange(prev => ({ ...prev, start: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="End Date"
                  value={dateRange.end}
                  onChange={(date) => setDateRange(prev => ({ ...prev, end: date }))}
                  slotProps={{ textField: { fullWidth: true } }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </Collapse>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Paper>
        {viewMode === 'table' ? renderTableView() : renderTimelineView()}
        
        {viewMode === 'table' && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={totalCount}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </Paper>
    </Box>
  );
};

export default AuditLogViewer;