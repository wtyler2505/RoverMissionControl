import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
  Toolbar,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ToggleButton,
  ToggleButtonGroup,
  Badge,
  Alert,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as DebugIcon,
  Code as CodeIcon,
  Search as SearchIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';

interface LogEntry {
  timestamp: string;
  adapter_id: string;
  protocol_type: string;
  direction: string;
  level: string;
  message?: string;
  device_id?: string;
  data_hex?: string;
  data_size?: number;
  data_ascii?: string;
  metadata: Record<string, any>;
  error?: string;
  sequence_number?: number;
  correlation_id?: string;
  duration_ms?: number;
}

interface LogFilter {
  adapter_ids?: string[];
  protocol_types?: string[];
  directions?: string[];
  levels?: string[];
  device_ids?: string[];
  search_text?: string;
  has_error?: boolean;
}

const LogLevelIcon: React.FC<{ level: string }> = ({ level }) => {
  switch (level.toLowerCase()) {
    case 'error':
      return <ErrorIcon color="error" fontSize="small" />;
    case 'warning':
      return <WarningIcon color="warning" fontSize="small" />;
    case 'info':
      return <InfoIcon color="info" fontSize="small" />;
    case 'debug':
      return <DebugIcon color="action" fontSize="small" />;
    case 'trace':
      return <CodeIcon color="disabled" fontSize="small" />;
    default:
      return null;
  }
};

const DirectionChip: React.FC<{ direction: string }> = ({ direction }) => {
  const color = direction === 'transmit' ? 'primary' : direction === 'receive' ? 'secondary' : 'default';
  const label = direction === 'transmit' ? 'TX' : direction === 'receive' ? 'RX' : 'BI';
  return <Chip label={label} size="small" color={color} />;
};

export const CommunicationLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({});
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const tableEndRef = useRef<HTMLDivElement>(null);

  const { socket, isConnected } = useWebSocket('/api/hardware/logs/ws', {
    onMessage: (data) => {
      if (data.type === 'log') {
        setLogs((prev) => {
          const newLogs = [...prev, data.entry];
          // Keep only last 1000 logs in memory
          if (newLogs.length > 1000) {
            return newLogs.slice(-1000);
          }
          return newLogs;
        });
      }
    },
  });

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.search_text) params.append('search_text', filter.search_text);
      if (filter.adapter_ids?.length) {
        filter.adapter_ids.forEach(id => params.append('adapter_ids', id));
      }
      if (filter.levels?.length) {
        filter.levels.forEach(level => params.append('levels', level));
      }

      const response = await fetch(`/api/hardware/logs/search?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const handleExport = async (format: 'json' | 'csv' | 'text') => {
    try {
      const response = await fetch(`/api/hardware/logs/export?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comm_logs_${new Date().toISOString()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all logs?')) {
      try {
        const response = await fetch('/api/hardware/logs/clear', {
          method: 'DELETE',
        });
        if (response.ok) {
          setLogs([]);
        }
      } catch (error) {
        console.error('Failed to clear logs:', error);
      }
    }
  };

  const renderDataPreview = (entry: LogEntry) => {
    if (!entry.data_hex) return null;

    return (
      <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
        <Typography variant="caption" color="textSecondary">
          Hex: {entry.data_hex.substring(0, 32)}{entry.data_hex.length > 32 ? '...' : ''}
        </Typography>
        {entry.data_ascii && (
          <Typography variant="caption" color="textSecondary" display="block">
            ASCII: {entry.data_ascii.substring(0, 32)}{entry.data_ascii.length > 32 ? '...' : ''}
          </Typography>
        )}
      </Box>
    );
  };

  const renderLogDetails = () => {
    if (!selectedLog) return null;

    return (
      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Log Entry Details
          <Typography variant="caption" display="block" color="textSecondary">
            {new Date(selectedLog.timestamp).toLocaleString()}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="textSecondary">Adapter ID</Typography>
              <Typography variant="body1">{selectedLog.adapter_id}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="textSecondary">Protocol</Typography>
              <Typography variant="body1">{selectedLog.protocol_type}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="textSecondary">Direction</Typography>
              <DirectionChip direction={selectedLog.direction} />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="textSecondary">Level</Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <LogLevelIcon level={selectedLog.level} />
                <Typography variant="body1">{selectedLog.level}</Typography>
              </Box>
            </Grid>
            {selectedLog.device_id && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Device ID</Typography>
                <Typography variant="body1">{selectedLog.device_id}</Typography>
              </Grid>
            )}
            {selectedLog.message && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Message</Typography>
                <Typography variant="body1">{selectedLog.message}</Typography>
              </Grid>
            )}
            {selectedLog.error && (
              <Grid item xs={12}>
                <Alert severity="error">
                  <Typography variant="body2">{selectedLog.error}</Typography>
                </Alert>
              </Grid>
            )}
            {selectedLog.data_hex && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Data</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.100' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {selectedLog.data_hex}
                  </Typography>
                  {selectedLog.data_ascii && (
                    <>
                      <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 2 }}>ASCII</Typography>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {selectedLog.data_ascii}
                      </Typography>
                    </>
                  )}
                </Paper>
              </Grid>
            )}
            {Object.keys(selectedLog.metadata).length > 0 && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Metadata</Typography>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </Paper>
              </Grid>
            )}
            {selectedLog.duration_ms && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="textSecondary">Duration</Typography>
                <Typography variant="body1">{selectedLog.duration_ms.toFixed(2)} ms</Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Toolbar disableGutters>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Communication Logs
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
            sx={{ mr: 2 }}
          >
            <ToggleButton value="table">
              <Tooltip title="Table View">
                <FilterIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="raw">
              <Tooltip title="Raw View">
                <CodeIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={() => setAutoScroll(!autoScroll)} color={autoScroll ? 'primary' : 'default'}>
            <Tooltip title="Auto-scroll">
              <Badge variant="dot" invisible={!autoScroll}>
                <ExpandMoreIcon />
              </Badge>
            </Tooltip>
          </IconButton>
          <IconButton onClick={fetchLogs} disabled={loading}>
            <Tooltip title="Refresh">
              {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
            </Tooltip>
          </IconButton>
          <IconButton onClick={() => setStreaming(!streaming)} color={streaming ? 'primary' : 'default'}>
            <Tooltip title={streaming ? 'Stop streaming' : 'Start streaming'}>
              {streaming ? <PauseIcon /> : <PlayIcon />}
            </Tooltip>
          </IconButton>
          <IconButton onClick={handleClearLogs}>
            <Tooltip title="Clear logs">
              <ClearIcon />
            </Tooltip>
          </IconButton>
          <IconButton onClick={() => handleExport('json')}>
            <Tooltip title="Export logs">
              <DownloadIcon />
            </Tooltip>
          </IconButton>
        </Toolbar>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Search"
                  variant="outlined"
                  size="small"
                  value={filter.search_text || ''}
                  onChange={(e) => setFilter({ ...filter, search_text: e.target.value })}
                  InputProps={{
                    startAdornment: <SearchIcon color="action" />,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Log Level</InputLabel>
                  <Select
                    multiple
                    value={filter.levels || []}
                    onChange={(e) => setFilter({ ...filter, levels: e.target.value as string[] })}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {(selected as string[]).map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {['trace', 'debug', 'info', 'warning', 'error'].map((level) => (
                      <MenuItem key={level} value={level}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LogLevelIcon level={level} />
                          {level}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={fetchLogs}
                  startIcon={<FilterIcon />}
                  disabled={loading}
                >
                  Apply Filters
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Paper>

      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'table' ? (
          <TableContainer sx={{ flexGrow: 1 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time</TableCell>
                  <TableCell>Level</TableCell>
                  <TableCell>Adapter</TableCell>
                  <TableCell>Protocol</TableCell>
                  <TableCell>Direction</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log, index) => (
                  <TableRow
                    key={`${log.sequence_number}-${index}`}
                    hover
                    sx={{
                      bgcolor: log.error ? 'error.light' : log.level === 'warning' ? 'warning.light' : 'inherit',
                      opacity: log.level === 'trace' ? 0.7 : 1,
                    }}
                  >
                    <TableCell>
                      <Tooltip title={new Date(log.timestamp).toLocaleString()}>
                        <Typography variant="caption">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <LogLevelIcon level={log.level} />
                        <Typography variant="caption">{log.level}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">{log.adapter_id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={log.protocol_type} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <DirectionChip direction={log.direction} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                        {log.message || log.error || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{renderDataPreview(log)}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedLog(log);
                          setDetailsOpen(true);
                        }}
                      >
                        <Tooltip title="View details">
                          <InfoIcon fontSize="small" />
                        </Tooltip>
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div ref={tableEndRef} />
          </TableContainer>
        ) : (
          <Box sx={{ p: 2, overflow: 'auto', bgcolor: 'grey.900', color: 'grey.100' }}>
            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {logs.map((log) => JSON.stringify(log, null, 2)).join('\n\n')}
            </pre>
            <div ref={tableEndRef} />
          </Box>
        )}
      </Paper>

      {renderLogDetails()}
    </Box>
  );
};
