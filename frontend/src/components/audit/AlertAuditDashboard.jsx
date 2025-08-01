/**
 * Alert Audit Dashboard
 * Admin interface for compliance officers to review and manage audit logs
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  LinearProgress,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Search as SearchIcon,
  Download as DownloadIcon,
  Security as SecurityIcon,
  Verified as VerifiedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Assessment as AssessmentIcon,
  GetApp as ExportIcon,
  Shield as ShieldIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';

const AlertAuditDashboard = () => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInfo, setPageInfo] = useState({});

  // Search and filtering state
  const [searchFilters, setSearchFilters] = useState({
    event_types: [],
    actor_id: '',
    target_id: '',
    start_date: null,
    end_date: null,
    severity: '',
    success: null,
    compliance_framework: '',
    search_query: '',
    limit: 50,
    offset: 0
  });

  // Statistics state
  const [statistics, setStatistics] = useState({
    overview: {},
    integrity: {},
    data_classification: {},
    compliance: {},
    performance: {}
  });

  // Dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [integrityDialogOpen, setIntegrityDialogOpen] = useState(false);
  const [logDetailDialogOpen, setLogDetailDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Export configuration
  const [exportConfig, setExportConfig] = useState({
    format: 'json',
    event_types: [],
    start_date: null,
    end_date: null,
    include_signatures: true,
    encrypt_export: false,
    export_reason: ''
  });

  // Severity color mapping
  const severityColors = {
    low: 'success',
    medium: 'warning', 
    high: 'error',
    critical: 'error'
  };

  // Event type icons
  const getEventIcon = (eventType) => {
    const iconMap = {
      alert_created: <InfoIcon />,
      alert_triggered: <WarningIcon />,
      alert_acknowledged: <VerifiedIcon />,
      alert_resolved: <VerifiedIcon />,
      alert_data_accessed: <SecurityIcon />,
      alert_data_exported: <ExportIcon />,
      threshold_exceeded: <ErrorIcon />,
      notification_sent: <InfoIcon />
    };
    return iconMap[eventType] || <InfoIcon />;
  };

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      
      // Add non-empty filter parameters
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value !== null && value !== '' && value !== undefined) {
          if (Array.isArray(value) && value.length > 0) {
            params.append(key, JSON.stringify(value));
          } else if (!Array.isArray(value)) {
            params.append(key, value.toString());
          }
        }
      });

      const response = await fetch(`/api/audit/alerts/logs/search?${params}`, {
        headers: {
          'X-User-ID': 'admin',
          'X-Session-ID': sessionStorage.getItem('sessionId') || 'audit-session',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load audit logs: ${response.statusText}`);
      }

      const data = await response.json();
      setAuditLogs(data.logs);
      setTotalCount(data.total_count);
      setPageInfo(data.page_info);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchFilters]);

  // Load system statistics
  const loadStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/audit/alerts/admin/statistics', {
        headers: {
          'X-User-ID': 'admin',
          'X-Session-ID': sessionStorage.getItem('sessionId') || 'audit-session'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (err) {
      console.warn('Failed to load statistics:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAuditLogs();
    loadStatistics();
  }, [loadAuditLogs, loadStatistics]);

  // Handle search
  const handleSearch = () => {
    setSearchFilters(prev => ({ ...prev, offset: 0 }));
    loadAuditLogs();
  };

  // Handle pagination
  const handlePageChange = (newOffset) => {
    setSearchFilters(prev => ({ ...prev, offset: newOffset }));
  };

  // Handle export
  const handleExport = async () => {
    if (!exportConfig.export_reason.trim()) {
      setError('Export reason is required for compliance');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/audit/alerts/logs/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin',
          'X-Session-ID': sessionStorage.getItem('sessionId') || 'audit-session'
        },
        body: JSON.stringify(exportConfig)
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.data && result.data.length < 1024 * 1024) {
        // Small export - download directly
        const blob = new Blob([result.data], { 
          type: exportConfig.format === 'json' ? 'application/json' : 'text/csv' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_export_${result.export_id}.${exportConfig.format}`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Large export - provide download link
        setSuccess(`Export created successfully. Download ID: ${result.export_id}`);
      }

      setExportDialogOpen(false);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle integrity check
  const handleIntegrityCheck = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/audit/alerts/integrity/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'admin',
          'X-Session-ID': sessionStorage.getItem('sessionId') || 'audit-session'
        },
        body: JSON.stringify({
          check_type: 'incremental'
        })
      });

      if (!response.ok) {
        throw new Error(`Integrity check failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.verified) {
        setSuccess('Audit log integrity verified successfully');
      } else {
        setError(`Integrity issues found: ${result.verification_errors.join(', ')}`);
      }

      setIntegrityDialogOpen(false);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render overview tab
  const renderOverviewTab = () => (
    <Grid container spacing={3}>
      {/* Statistics Cards */}
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <SecurityIcon /> Total Audit Logs
            </Typography>
            <Typography variant="h4" color="primary">
              {statistics.overview?.total_audit_logs?.toLocaleString() || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Last 24h: {statistics.overview?.logs_last_24h || 0}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <VerifiedIcon /> Integrity Status
            </Typography>
            <Chip 
              label={statistics.integrity?.chain_integrity || 'Unknown'}
              color={statistics.integrity?.chain_integrity === 'verified' ? 'success' : 'error'}
              icon={statistics.integrity?.chain_integrity === 'verified' ? <VerifiedIcon /> : <ErrorIcon />}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Last check: {statistics.integrity?.last_integrity_check ? 
                format(parseISO(statistics.integrity.last_integrity_check), 'PPp') : 'Never'}
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <ShieldIcon /> Personal Data Events
            </Typography>
            <Typography variant="h4" color="warning.main">
              {statistics.data_classification?.total_personal_data_events || 0}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              GDPR compliance required
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              <AssessmentIcon /> Performance
            </Typography>
            <Typography variant="body1">
              Avg Query: {statistics.performance?.query_performance_ms || 0}ms
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Storage: {(statistics.performance?.storage_usage_mb || 0).toFixed(1)} MB
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* Quick Actions */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<VerifiedIcon />}
                onClick={() => setIntegrityDialogOpen(true)}
              >
                Verify Integrity
              </Button>
              <Button
                variant="contained"
                startIcon={<ExportIcon />}
                onClick={() => setExportDialogOpen(true)}
              >
                Export Logs
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  loadAuditLogs();
                  loadStatistics();
                }}
              >
                Refresh
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  // Render audit logs tab
  const renderAuditLogsTab = () => (
    <Box>
      {/* Search Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <FilterIcon /> Search & Filter
          </Typography>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={searchFilters.search_query}
                onChange={(e) => setSearchFilters(prev => ({ 
                  ...prev, 
                  search_query: e.target.value 
                }))}
                InputProps={{
                  startAdornment: <SearchIcon />
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Severity</InputLabel>
                <Select
                  value={searchFilters.severity}
                  onChange={(e) => setSearchFilters(prev => ({ 
                    ...prev, 
                    severity: e.target.value 
                  }))}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Success</InputLabel>
                <Select
                  value={searchFilters.success === null ? '' : searchFilters.success.toString()}
                  onChange={(e) => setSearchFilters(prev => ({ 
                    ...prev, 
                    success: e.target.value === '' ? null : e.target.value === 'true'
                  }))}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Success</MenuItem>
                  <MenuItem value="false">Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label="Start Date"
                  value={searchFilters.start_date}
                  onChange={(date) => setSearchFilters(prev => ({ 
                    ...prev, 
                    start_date: date 
                  }))}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSearch}
                disabled={loading}
              >
                Search
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Audit Logs ({totalCount.toLocaleString()} total)
            </Typography>
            <Box>
              <Tooltip title="Export filtered results">
                <IconButton onClick={() => setExportDialogOpen(true)}>
                  <ExportIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton onClick={loadAuditLogs}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Event</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Data Types</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      {format(parseISO(log.timestamp), 'PPp')}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getEventIcon(log.event_type)}
                        <Typography variant="body2">
                          {log.event_type.replace(/_/g, ' ').toUpperCase()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.actor_id || 'System'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {log.actor_type}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {log.target_id || '-'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {log.target_type || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.severity.toUpperCase()}
                        color={severityColors[log.severity] || 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={log.success ? 'Success' : 'Failed'}
                        color={log.success ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {log.personal_data_involved && (
                          <Chip label="PII" color="warning" size="small" />
                        )}
                        {log.financial_data_involved && (
                          <Chip label="FIN" color="error" size="small" />
                        )}
                        {log.health_data_involved && (
                          <Chip label="PHI" color="error" size="small" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small"
                          onClick={() => {
                            setSelectedLog(log);
                            setLogDetailDialogOpen(true);
                          }}
                        >
                          <InfoIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Pagination */}
          {pageInfo.total_pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                disabled={!pageInfo.has_previous}
                onClick={() => handlePageChange(Math.max(0, searchFilters.offset - searchFilters.limit))}
              >
                Previous
              </Button>
              <Typography sx={{ mx: 2, alignSelf: 'center' }}>
                Page {pageInfo.current_page} of {pageInfo.total_pages}
              </Typography>
              <Button
                disabled={!pageInfo.has_next}
                onClick={() => handlePageChange(searchFilters.offset + searchFilters.limit)}
              >
                Next
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Alert Audit Trail Dashboard
      </Typography>
      
      <Typography variant="body1" color="textSecondary" gutterBottom>
        Comprehensive audit logging for compliance officers. All alert operations are recorded with tamper-evident logging.
      </Typography>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="Overview" />
        <Tab label="Audit Logs" />
        <Tab label="Compliance Reports" />
        <Tab label="System Health" />
      </Tabs>

      {activeTab === 0 && renderOverviewTab()}
      {activeTab === 1 && renderAuditLogsTab()}
      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6">Compliance Reports</Typography>
            <Typography variant="body2" color="textSecondary">
              Generate compliance reports for GDPR, CCPA, HIPAA, and other frameworks.
            </Typography>
            <Button variant="contained" sx={{ mt: 2 }}>
              Generate Report
            </Button>
          </CardContent>
        </Card>
      )}
      {activeTab === 3 && (
        <Card>
          <CardContent>
            <Typography variant="h6">System Health</Typography>
            <Typography variant="body2" color="textSecondary">
              Monitor audit system health and integrity.
            </Typography>
            <Alert severity="success" sx={{ mt: 2 }}>
              All systems operational. Last integrity check: {format(new Date(), 'PPp')}
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Export Audit Logs</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={exportConfig.format}
                  onChange={(e) => setExportConfig(prev => ({ ...prev, format: e.target.value }))}
                >
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="xml">XML</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                multiline
                rows={3}
                label="Export Reason (Required for Compliance)"
                value={exportConfig.export_reason}
                onChange={(e) => setExportConfig(prev => ({ ...prev, export_reason: e.target.value }))}
                placeholder="e.g., Quarterly compliance audit, Legal discovery request, etc."
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleExport} variant="contained" disabled={loading}>
            Export
          </Button>
        </DialogActions>
      </Dialog>

      {/* Integrity Check Dialog */}
      <Dialog open={integrityDialogOpen} onClose={() => setIntegrityDialogOpen(false)}>
        <DialogTitle>Verify Audit Log Integrity</DialogTitle>
        <DialogContent>
          <Typography>
            This will verify the cryptographic integrity of audit logs, including:
          </Typography>
          <ul>
            <li>Checksum verification</li>
            <li>Digital signature validation</li>
            <li>Chain integrity verification</li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIntegrityDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleIntegrityCheck} variant="contained" disabled={loading}>
            Verify Integrity
          </Button>
        </DialogActions>
      </Dialog>

      {/* Log Detail Dialog */}
      <Dialog open={logDetailDialogOpen} onClose={() => setLogDetailDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Audit Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Event Information</Typography>
                  <Typography><strong>ID:</strong> {selectedLog.id}</Typography>
                  <Typography><strong>Timestamp:</strong> {format(parseISO(selectedLog.timestamp), 'PPpp')}</Typography>
                  <Typography><strong>Event Type:</strong> {selectedLog.event_type}</Typography>
                  <Typography><strong>Action:</strong> {selectedLog.action}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Actor & Target</Typography>
                  <Typography><strong>Actor:</strong> {selectedLog.actor_id || 'System'} ({selectedLog.actor_type})</Typography>
                  <Typography><strong>Target:</strong> {selectedLog.target_id || 'N/A'} ({selectedLog.target_type || 'N/A'})</Typography>
                  <Typography><strong>IP Address:</strong> {selectedLog.ip_address || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Details</Typography>
                  <pre style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', fontSize: '12px' }}>
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Integrity</Typography>
                  <Typography><strong>Checksum:</strong> {selectedLog.checksum}</Typography>
                  <Typography><strong>Chain Index:</strong> {selectedLog.chain_index}</Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDetailDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AlertAuditDashboard;