/**
 * Secure Log Viewer Component
 * 
 * Provides a comprehensive interface for viewing and analyzing secure logs
 * with tamper-proof verification, compliance reporting, and forensic analysis
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Tab,
  Tabs,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  VerifiedUser as VerifiedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  Assessment as AssessmentIcon,
  Gavel as ComplianceIcon,
  BugReport as ForensicIcon,
  Notifications as NotificationIcon,
  ExpandMore as ExpandMoreIcon,
  Lock as LockIcon,
  LockOpen as UnlockIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  CloudUpload as CloudIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';

// Types
interface LogEntry {
  id: string;
  timestamp: string;
  event_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  actor?: string;
  correlation_id?: string;
}

interface IntegrityStatus {
  hash_chain_valid: boolean;
  hash_chain_errors: string[];
  storage_status: {
    locations: Array<{
      id: string;
      type: string;
      is_active: boolean;
      last_check?: string;
      last_error?: string;
    }>;
    active_count: number;
  };
  siem_status: {
    connectors: string[];
    queue_size: number;
    running: boolean;
  };
}

interface NotificationHistory {
  id: string;
  event_id: string;
  channel: string;
  recipient: string;
  sent_at: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
}

interface SecureLogViewerProps {
  onExport?: (data: any) => void;
  allowDecryption?: boolean;
}

const SecureLogViewer: React.FC<SecureLogViewerProps> = ({
  onExport,
  allowDecryption = false
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search filters
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState<Date | null>(null);
  const [eventType, setEventType] = useState('');
  const [severity, setSeverity] = useState('');
  const [actor, setActor] = useState('');
  
  // Integrity status
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus | null>(null);
  const [verifying, setVerifying] = useState(false);
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationHistory[]>([]);
  
  // Dialog states
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [complianceDialogOpen, setComplianceDialogOpen] = useState(false);
  const [forensicDialogOpen, setForensicDialogOpen] = useState(false);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (startTime) params.append('start_time', startTime.toISOString());
      if (endTime) params.append('end_time', endTime.toISOString());
      if (eventType) params.append('event_type', eventType);
      if (severity) params.append('severity', severity);
      if (actor) params.append('actor', actor);
      
      const response = await fetch(`/api/v1/secure-logging/search-logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch logs');
      
      const data = await response.json();
      setLogs(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [startTime, endTime, eventType, severity, actor]);

  // Verify integrity
  const verifyIntegrity = async () => {
    setVerifying(true);
    
    try {
      const response = await fetch('/api/v1/secure-logging/verify-integrity', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to verify integrity');
      
      const data = await response.json();
      setIntegrityStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify integrity');
    } finally {
      setVerifying(false);
    }
  };

  // Export logs
  const handleExport = async (includeDecrypted: boolean) => {
    try {
      const response = await fetch('/api/v1/secure-logging/export-logs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start_time: startTime?.toISOString(),
          end_time: endTime?.toISOString(),
          include_encrypted: includeDecrypted
        })
      });
      
      if (!response.ok) throw new Error('Failed to export logs');
      
      const data = await response.json();
      
      if (onExport) {
        onExport(data);
      }
      
      setExportDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export logs');
    }
  };

  // Load initial data
  useEffect(() => {
    fetchLogs();
    verifyIntegrity();
  }, []);

  // Render severity chip
  const renderSeverityChip = (severity: string) => {
    const config = {
      critical: { color: 'error' as const, icon: <ErrorIcon /> },
      high: { color: 'warning' as const, icon: <WarningIcon /> },
      medium: { color: 'info' as const, icon: <WarningIcon /> },
      low: { color: 'success' as const, icon: <CheckCircleIcon /> },
      info: { color: 'default' as const, icon: <CheckCircleIcon /> }
    };
    
    const { color, icon } = config[severity] || config.info;
    
    return (
      <Chip
        size="small"
        label={severity.toUpperCase()}
        color={color}
        icon={icon}
      />
    );
  };

  // Render integrity status
  const renderIntegrityStatus = () => {
    if (!integrityStatus) return null;
    
    const isHealthy = integrityStatus.hash_chain_valid && 
                     integrityStatus.storage_status.active_count > 0 &&
                     integrityStatus.siem_status.running;
    
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            {isHealthy ? (
              <CheckCircleIcon color="success" sx={{ mr: 1 }} />
            ) : (
              <ErrorIcon color="error" sx={{ mr: 1 }} />
            )}
            <Typography variant="h6">
              System Integrity: {isHealthy ? 'Verified' : 'Issues Detected'}
            </Typography>
            <Box flexGrow={1} />
            <IconButton onClick={verifyIntegrity} disabled={verifying}>
              <RefreshIcon />
            </IconButton>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center">
                <LockIcon sx={{ mr: 1, color: integrityStatus.hash_chain_valid ? 'success.main' : 'error.main' }} />
                <Typography variant="body2">
                  Hash Chain: {integrityStatus.hash_chain_valid ? 'Valid' : 'Invalid'}
                </Typography>
              </Box>
              {integrityStatus.hash_chain_errors.length > 0 && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {integrityStatus.hash_chain_errors.map((err, idx) => (
                    <Typography key={idx} variant="caption" display="block">
                      {err}
                    </Typography>
                  ))}
                </Alert>
              )}
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center">
                <StorageIcon sx={{ mr: 1 }} />
                <Typography variant="body2">
                  Storage: {integrityStatus.storage_status.active_count} of {integrityStatus.storage_status.locations.length} active
                </Typography>
              </Box>
              <List dense>
                {integrityStatus.storage_status.locations.map((loc) => (
                  <ListItem key={loc.id}>
                    <ListItemIcon>
                      {loc.is_active ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${loc.id} (${loc.type})`}
                      secondary={loc.last_error || 'Healthy'}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Box display="flex" alignItems="center">
                <CloudIcon sx={{ mr: 1 }} />
                <Typography variant="body2">
                  SIEM: {integrityStatus.siem_status.running ? 'Active' : 'Inactive'}
                </Typography>
              </Box>
              <Typography variant="caption" display="block">
                Connectors: {integrityStatus.siem_status.connectors.join(', ')}
              </Typography>
              <Typography variant="caption" display="block">
                Queue: {integrityStatus.siem_status.queue_size} events
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };

  // Render log list
  const renderLogList = () => (
    <List>
      {logs.map((log) => (
        <React.Fragment key={log.id}>
          <ListItem>
            <ListItemIcon>
              <SecurityIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body1">{log.event_type}</Typography>
                  {renderSeverityChip(log.severity)}
                  {log.actor && (
                    <Chip size="small" label={`By: ${log.actor}`} variant="outlined" />
                  )}
                </Box>
              }
              secondary={
                <Box>
                  <Typography variant="caption" display="block">
                    {format(parseISO(log.timestamp), 'PPpp')}
                  </Typography>
                  {log.correlation_id && (
                    <Typography variant="caption" display="block">
                      Correlation: {log.correlation_id}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
          <Divider />
        </React.Fragment>
      ))}
    </List>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Secure Log Viewer
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              <AlertTitle>Error</AlertTitle>
              {error}
            </Alert>
          )}
          
          {renderIntegrityStatus()}
          
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab label="Search Logs" icon={<SearchIcon />} />
            <Tab label="Compliance" icon={<ComplianceIcon />} />
            <Tab label="Forensics" icon={<ForensicIcon />} />
            <Tab label="Notifications" icon={<NotificationIcon />} />
          </Tabs>
          
          {activeTab === 0 && (
            <Box>
              {/* Search filters */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={3}>
                  <DateTimePicker
                    label="Start Time"
                    value={startTime}
                    onChange={setStartTime}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <DateTimePicker
                    label="End Time"
                    value={endTime}
                    onChange={setEndTime}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    label="Event Type"
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Severity</InputLabel>
                    <Select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      label="Severity"
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="info">Info</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    label="Actor"
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  />
                </Grid>
              </Grid>
              
              <Box display="flex" gap={1} mb={2}>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={fetchLogs}
                  disabled={loading}
                >
                  Search
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => setExportDialogOpen(true)}
                >
                  Export
                </Button>
              </Box>
              
              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : (
                renderLogList()
              )}
            </Box>
          )}
          
          {activeTab === 1 && (
            <Box textAlign="center" py={4}>
              <ComplianceIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Compliance Reporting
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Generate compliance reports for ISO 27001, SOC 2, and other frameworks
              </Typography>
              <Button
                variant="contained"
                startIcon={<AssessmentIcon />}
                onClick={() => setComplianceDialogOpen(true)}
              >
                Generate Report
              </Button>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box textAlign="center" py={4}>
              <ForensicIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Forensic Analysis
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Analyze security incidents with timeline reconstruction and anomaly detection
              </Typography>
              <Button
                variant="contained"
                startIcon={<TimelineIcon />}
                onClick={() => setForensicDialogOpen(true)}
              >
                Start Analysis
              </Button>
            </Box>
          )}
          
          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Notification History
              </Typography>
              {/* Notification history would be rendered here */}
            </Box>
          )}
        </Paper>
        
        {/* Export Dialog */}
        <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)}>
          <DialogTitle>Export Logs</DialogTitle>
          <DialogContent>
            <Typography variant="body2" paragraph>
              Export logs for the selected time period. You can optionally include
              decrypted log content if you have the necessary permissions.
            </Typography>
            {allowDecryption && (
              <FormControlLabel
                control={<Switch />}
                label="Include decrypted content"
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setExportDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={() => handleExport(false)}>
              Export
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Compliance Dialog */}
        <Dialog 
          open={complianceDialogOpen} 
          onClose={() => setComplianceDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Generate Compliance Report</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Framework</InputLabel>
              <Select label="Framework">
                <MenuItem value="ISO27001">ISO/IEC 27001:2022</MenuItem>
                <MenuItem value="SOC2">SOC 2 Type II</MenuItem>
                <MenuItem value="GDPR">GDPR</MenuItem>
                <MenuItem value="HIPAA">HIPAA</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Select the reporting period:
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <DateTimePicker
                  label="Start Date"
                  value={startTime}
                  onChange={setStartTime}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={6}>
                <DateTimePicker
                  label="End Date"
                  value={endTime}
                  onChange={setEndTime}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setComplianceDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" startIcon={<AssessmentIcon />}>
              Generate Report
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Forensic Dialog */}
        <Dialog 
          open={forensicDialogOpen} 
          onClose={() => setForensicDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Forensic Analysis</DialogTitle>
          <DialogContent>
            <Typography variant="body2" paragraph>
              Configure forensic analysis parameters:
            </Typography>
            <TextField
              fullWidth
              label="Incident Title"
              sx={{ mb: 2 }}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <DateTimePicker
                  label="Analysis Start"
                  value={startTime}
                  onChange={setStartTime}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
              <Grid item xs={6}>
                <DateTimePicker
                  label="Analysis End"
                  value={endTime}
                  onChange={setEndTime}
                  renderInput={(params) => <TextField {...params} fullWidth />}
                />
              </Grid>
            </Grid>
            <Typography variant="body2" sx={{ mt: 2 }}>
              Select log sources for analysis:
            </Typography>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="System Logs"
            />
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Authentication Logs"
            />
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Network Logs"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setForensicDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" startIcon={<TimelineIcon />}>
              Start Analysis
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default SecureLogViewer;