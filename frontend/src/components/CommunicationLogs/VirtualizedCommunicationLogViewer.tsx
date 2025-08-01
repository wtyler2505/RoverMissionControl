/**
 * VirtualizedCommunicationLogViewer
 * High-performance virtualized version of CommunicationLogViewer
 * Optimized for handling 10,000+ log entries with smooth scrolling
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
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
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { useWebSocket } from '../../hooks/useWebSocket';
import VirtualizedTable, { TableColumn, VirtualizedTableRow } from '../virtualization/VirtualizedTable';

// Reuse interfaces from original component
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

// Enhanced log entry with virtualization support
interface VirtualizedLogEntry extends LogEntry {
  id: string;
  height?: number;
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

export const VirtualizedCommunicationLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<VirtualizedLogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>({});
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [sortBy, setSortBy] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const tableRef = useRef<any>(null);
  const scrollPositionRef = useRef<number>(0);
  
  const { socket, isConnected } = useWebSocket('/api/hardware/logs/ws', {
    onMessage: (data) => {
      if (data.type === 'log') {
        const newEntry: VirtualizedLogEntry = {
          ...data.entry,
          id: `${data.entry.sequence_number || Date.now()}-${Math.random()}`,
          height: 60, // Standard row height for consistent performance
        };
        
        setLogs((prev) => {
          const newLogs = [...prev, newEntry];
          // Keep only last 10000 logs in memory for performance
          if (newLogs.length > 10000) {
            return newLogs.slice(-10000);
          }
          return newLogs;
        });
      }
    },
  });

  // Auto-scroll to bottom when new logs arrive and auto-scroll is enabled
  useEffect(() => {
    if (autoScroll && logs.length > 0 && tableRef.current) {
      // Scroll to the last row
      tableRef.current.scrollToRow(logs.length - 1);
    }
  }, [logs, autoScroll]);

  // Define table columns with optimized renderers
  const columns: TableColumn<VirtualizedLogEntry>[] = useMemo(() => [
    {
      id: 'timestamp',
      label: 'Time',
      width: 120,
      sortable: true,
      sticky: 'left',
      render: (value: string) => (
        <Tooltip title={new Date(value).toLocaleString()}>
          <Typography variant="caption" noWrap>
            {formatDistanceToNow(new Date(value), { addSuffix: true })}
          </Typography>
        </Tooltip>
      ),
      getValue: (row) => row.timestamp,
    },
    {
      id: 'level',
      label: 'Level',
      width: 100,
      sortable: true,
      render: (value: string) => (
        <Box display="flex" alignItems="center" gap={0.5}>
          <LogLevelIcon level={value} />
          <Typography variant="caption">{value}</Typography>
        </Box>
      ),
      getValue: (row) => row.level,
    },
    {
      id: 'adapter_id',
      label: 'Adapter',
      width: 120,
      sortable: true,
      render: (value: string) => (
        <Typography variant="caption" noWrap>{value}</Typography>
      ),
      getValue: (row) => row.adapter_id,
    },
    {
      id: 'protocol_type',
      label: 'Protocol',
      width: 100,
      sortable: true,
      render: (value: string) => (
        <Chip label={value} size="small" variant="outlined" />
      ),
      getValue: (row) => row.protocol_type,
    },
    {
      id: 'direction',
      label: 'Direction',
      width: 90,
      sortable: true,
      render: (value: string) => <DirectionChip direction={value} />,
      getValue: (row) => row.direction,
    },
    {
      id: 'message',
      label: 'Message',
      width: 300,
      render: (value: string, row: VirtualizedLogEntry) => (
        <Typography variant="body2" noWrap sx={{ maxWidth: 280 }}>
          {value || row.error || '-'}
        </Typography>
      ),
      getValue: (row) => row.message || row.error || '',
    },
    {
      id: 'data_preview',
      label: 'Data',
      width: 200,
      render: (value: any, row: VirtualizedLogEntry) => {
        if (!row.data_hex) return null;
        return (
          <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            <Typography variant="caption" color="textSecondary" noWrap>
              Hex: {row.data_hex.substring(0, 16)}{row.data_hex.length > 16 ? '...' : ''}
            </Typography>
            {row.data_ascii && (
              <Typography variant="caption" color="textSecondary" display="block" noWrap>
                ASCII: {row.data_ascii.substring(0, 16)}{row.data_ascii.length > 16 ? '...' : ''}
              </Typography>
            )}
          </Box>
        );
      },
      getValue: (row) => row.data_hex || '',
    },
    {
      id: 'actions',
      label: 'Actions',
      width: 60,
      align: 'center',
      sticky: 'right',
      render: (value: any, row: VirtualizedLogEntry) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedLog(row);
            setDetailsOpen(true);
          }}
        >
          <Tooltip title="View details">
            <InfoIcon fontSize="small" />
          </Tooltip>
        </IconButton>
      ),
    },
  ], []);

  // Convert logs to table rows
  const tableRows: VirtualizedTableRow[] = useMemo(() => {
    return logs.map((log) => ({
      id: log.id,
      data: log,
      height: 52, // Consistent row height
      selected: selectedRows.has(log.id),
    }));
  }, [logs, selectedRows]);

  // Enhanced filter and search logic
  const filteredRows = useMemo(() => {
    let filtered = [...tableRows];

    // Apply filters (same logic as original component)
    if (filter.search_text?.trim()) {
      const term = filter.search_text.toLowerCase();
      filtered = filtered.filter(row => {
        const log = row.data as VirtualizedLogEntry;
        return log.message?.toLowerCase().includes(term) ||
               log.adapter_id.toLowerCase().includes(term) ||
               log.protocol_type.toLowerCase().includes(term) ||
               log.device_id?.toLowerCase().includes(term) ||
               log.error?.toLowerCase().includes(term);
      });
    }

    if (filter.levels?.length) {
      filtered = filtered.filter(row => filter.levels!.includes(row.data.level));
    }

    if (filter.adapter_ids?.length) {
      filtered = filtered.filter(row => filter.adapter_ids!.includes(row.data.adapter_id));
    }

    if (filter.protocol_types?.length) {
      filtered = filtered.filter(row => filter.protocol_types!.includes(row.data.protocol_type));
    }

    if (filter.directions?.length) {
      filtered = filtered.filter(row => filter.directions!.includes(row.data.direction));
    }

    if (filter.has_error !== undefined) {
      filtered = filtered.filter(row => !!row.data.error === filter.has_error);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aLog = a.data as VirtualizedLogEntry;
      const bLog = b.data as VirtualizedLogEntry;
      
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'timestamp':
          aValue = new Date(aLog.timestamp).getTime();
          bValue = new Date(bLog.timestamp).getTime();
          break;
        case 'level':
          const levelOrder = { critical: 5, error: 4, warning: 3, info: 2, debug: 1, trace: 0 };
          aValue = levelOrder[aLog.level as keyof typeof levelOrder] || 0;
          bValue = levelOrder[bLog.level as keyof typeof levelOrder] || 0;
          break;
        default:
          aValue = aLog[sortBy as keyof VirtualizedLogEntry];
          bValue = bLog[sortBy as keyof VirtualizedLogEntry];
      }

      if (aValue === bValue) return 0;
      const result = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? result : -result;
    });

    return filtered;
  }, [tableRows, filter, sortBy, sortDirection]);

  // Fetch logs function
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
        const virtualizedLogs: VirtualizedLogEntry[] = data.map((log: LogEntry, index: number) => ({
          ...log,
          id: `${log.sequence_number || index}-${Date.now()}`,
          height: 52,
        }));
        setLogs(virtualizedLogs);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Handle table interactions
  const handleRowClick = useCallback((row: VirtualizedTableRow) => {
    setSelectedLog(row.data);
    setDetailsOpen(true);
  }, []);

  const handleRowSelect = useCallback((rowId: string | number, selected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(rowId);
      } else {
        newSet.delete(rowId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedRows(new Set(filteredRows.map(row => row.id)));
    } else {
      setSelectedRows(new Set());
    }
  }, [filteredRows]);

  const handleSort = useCallback((columnId: string) => {
    if (sortBy === columnId) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(columnId);
      setSortDirection('asc');
    }
  }, [sortBy]);

  // Handle export (reuse from original component)
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

  // Render log details dialog (reuse from original)
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
      {/* Header and controls (reuse from original with minor modifications) */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Toolbar disableGutters>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Communication Logs (Virtualized)
            <Typography variant="caption" display="block" color="textSecondary">
              Showing {filteredRows.length} of {logs.length} entries
            </Typography>
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

        {/* Filters section - simplified for demo */}
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
                />
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

      {/* Virtualized table */}
      <Paper sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'table' ? (
          <VirtualizedTable
            ref={tableRef}
            columns={columns}
            rows={filteredRows}
            height={600} // Adjust based on container
            selectable
            selectedRows={selectedRows}
            onRowSelect={handleRowSelect}
            onSelectAll={handleSelectAll}
            onRowClick={handleRowClick}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSort={handleSort}
            loading={loading}
            loadingRowCount={20}
            stickyHeader
            striped
            ariaLabel="Communication logs table"
            caption="Real-time communication logs with hardware adapters"
          />
        ) : (
          <Box sx={{ p: 2, overflow: 'auto', bgcolor: 'grey.900', color: 'grey.100', flexGrow: 1 }}>
            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {filteredRows.map((row) => JSON.stringify(row.data, null, 2)).join('\n\n')}
            </pre>
          </Box>
        )}
      </Paper>

      {renderLogDetails()}
    </Box>
  );
};

export default VirtualizedCommunicationLogViewer;