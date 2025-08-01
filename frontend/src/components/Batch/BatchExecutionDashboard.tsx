import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  IconButton,
  Button,
  Alert,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Timeline as TimelineIcon,
  Assessment as StatsIcon,
  BugReport as DebugIcon,
  Undo as RollbackIcon,
  Speed as SpeedIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useWebSocket } from '../WebSocket/WebSocketProvider';
import { CommandProgressIndicator } from '../CommandAcknowledgment/CommandProgressIndicator';
import { CommandStatusDisplay } from '../CommandAcknowledgment/CommandStatusDisplay';

interface BatchStatus {
  batchId: string;
  name: string;
  status: 'pending' | 'validating' | 'queued' | 'executing' | 'partially_completed' | 
          'completed' | 'failed' | 'cancelled' | 'rolling_back' | 'rolled_back';
  executionMode: 'sequential' | 'parallel' | 'mixed';
  transactionMode: 'all_or_nothing' | 'best_effort' | 'stop_on_error' | 'isolated';
  totalCommands: number;
  completedCommands: number;
  failedCommands: number;
  progress: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
  currentCommand?: {
    id: string;
    type: string;
    status: string;
    progress: number;
  };
  commandResults: Record<string, any>;
  errorSummary: Array<{
    commandId: string;
    error: string;
    timestamp: string;
  }>;
  rollbackStatus?: string;
}

interface BatchExecutionDashboardProps {
  batchId?: string;
  onBatchSelect?: (batchId: string) => void;
}

const BatchExecutionDashboard: React.FC<BatchExecutionDashboardProps> = ({
  batchId: propBatchId,
  onBatchSelect,
}) => {
  const { sendMessage, subscribe, unsubscribe } = useWebSocket();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(propBatchId || null);
  const [batches, setBatches] = useState<Record<string, BatchStatus>>({});
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [selectedTab, setSelectedTab] = useState(0);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackBatchId, setRollbackBatchId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Subscribe to batch updates
  useEffect(() => {
    const handleBatchUpdate = (data: any) => {
      if (data.type === 'batch.status') {
        setBatches(prev => ({
          ...prev,
          [data.batchId]: data.batch,
        }));
      } else if (data.type === 'batch.progress') {
        setBatches(prev => ({
          ...prev,
          [data.batchId]: {
            ...prev[data.batchId],
            ...data.progress,
          },
        }));
      } else if (data.type === 'batch.completed') {
        setBatches(prev => ({
          ...prev,
          [data.batchId]: {
            ...prev[data.batchId],
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        }));
      }
    };

    const unsubscribeFunc = subscribe('batch.*', handleBatchUpdate);
    
    // Load initial batch list
    sendMessage({
      type: 'batch.list',
      payload: {},
    });

    return () => {
      unsubscribeFunc();
    };
  }, [subscribe, unsubscribe, sendMessage]);

  // Handle batch selection
  const handleBatchSelect = useCallback((batchId: string) => {
    setSelectedBatchId(batchId);
    if (onBatchSelect) {
      onBatchSelect(batchId);
    }

    // Request detailed batch status
    sendMessage({
      type: 'batch.get',
      payload: { batchId },
    });
  }, [onBatchSelect, sendMessage]);

  // Handle batch operations
  const handleBatchOperation = useCallback((batchId: string, operation: string) => {
    sendMessage({
      type: 'batch.operation',
      payload: {
        batchId,
        operation,
      },
    });
  }, [sendMessage]);

  // Toggle batch expansion
  const toggleBatchExpansion = useCallback((batchId: string) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
  }, []);

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <SuccessIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'executing':
        return <CircularProgress size={20} />;
      case 'cancelled':
      case 'rolled_back':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'executing':
        return 'info';
      case 'cancelled':
      case 'rolled_back':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Format elapsed time
  const formatElapsedTime = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Filter and sort batches
  const filteredBatches = Object.values(batches)
    .filter(batch => filterStatus === 'all' || batch.status === filterStatus)
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'progress':
          return b.progress - a.progress;
        case 'createdAt':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // Render batch summary card
  const renderBatchSummary = (batch: BatchStatus) => (
    <Card
      key={batch.batchId}
      sx={{
        mb: 2,
        cursor: 'pointer',
        border: selectedBatchId === batch.batchId ? 2 : 0,
        borderColor: 'primary.main',
      }}
      onClick={() => handleBatchSelect(batch.batchId)}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            {getStatusIcon(batch.status)}
            <Typography variant="h6">{batch.name}</Typography>
            <Chip
              label={batch.status.replace('_', ' ')}
              size="small"
              color={getStatusColor(batch.status) as any}
            />
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                toggleBatchExpansion(batch.batchId);
              }}
            >
              {expandedBatches.has(batch.batchId) ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
          </Box>
        </Box>

        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Typography variant="body2" color="text.secondary">
            {batch.completedCommands + batch.failedCommands}/{batch.totalCommands} commands
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Mode: {batch.executionMode}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Created: {format(new Date(batch.createdAt), 'MMM d, HH:mm')}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={batch.progress}
          sx={{ mb: 1 }}
          color={batch.failedCommands > 0 ? 'warning' : 'primary'}
        />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2">
            {batch.progress.toFixed(0)}% Complete
          </Typography>
          {batch.elapsedTime && (
            <Typography variant="body2" color="text.secondary">
              Elapsed: {formatElapsedTime(batch.elapsedTime)}
            </Typography>
          )}
        </Box>

        <Collapse in={expandedBatches.has(batch.batchId)}>
          <Divider sx={{ my: 2 }} />
          
          {/* Command breakdown */}
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main">
                  {batch.completedCommands}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Completed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="error.main">
                  {batch.failedCommands}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Failed
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4}>
              <Box textAlign="center">
                <Typography variant="h4" color="info.main">
                  {batch.totalCommands - batch.completedCommands - batch.failedCommands}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pending
                </Typography>
              </Box>
            </Grid>
          </Grid>

          {/* Current command */}
          {batch.currentCommand && batch.status === 'executing' && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Currently Executing:
              </Typography>
              <Alert severity="info" icon={<SpeedIcon />}>
                {batch.currentCommand.type} - {batch.currentCommand.status}
                <LinearProgress
                  variant="determinate"
                  value={batch.currentCommand.progress * 100}
                  sx={{ mt: 1 }}
                />
              </Alert>
            </Box>
          )}

          {/* Errors */}
          {batch.errorSummary.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom color="error">
                Errors ({batch.errorSummary.length}):
              </Typography>
              <List dense>
                {batch.errorSummary.slice(0, 3).map((error, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <ErrorIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={error.error}
                      secondary={`Command ${error.commandId} - ${format(new Date(error.timestamp), 'HH:mm:ss')}`}
                    />
                  </ListItem>
                ))}
                {batch.errorSummary.length > 3 && (
                  <ListItem>
                    <ListItemText
                      secondary={`... and ${batch.errorSummary.length - 3} more errors`}
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          )}

          {/* Actions */}
          <Box mt={2} display="flex" gap={1}>
            {batch.status === 'executing' && (
              <>
                <Button
                  size="small"
                  startIcon={<PauseIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchOperation(batch.batchId, 'pause');
                  }}
                >
                  Pause
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<StopIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchOperation(batch.batchId, 'cancel');
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
            {batch.status === 'failed' && (
              <Button
                size="small"
                startIcon={<RefreshIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleBatchOperation(batch.batchId, 'retry');
                }}
              >
                Retry Failed
              </Button>
            )}
            {batch.status === 'completed' && batch.transactionMode === 'all_or_nothing' && (
              <Button
                size="small"
                startIcon={<RollbackIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  setRollbackBatchId(batch.batchId);
                  setShowRollbackDialog(true);
                }}
              >
                Rollback
              </Button>
            )}
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );

  // Render detailed view
  const renderDetailedView = () => {
    const batch = selectedBatchId ? batches[selectedBatchId] : null;
    if (!batch) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Select a batch to view details
          </Typography>
        </Paper>
      );
    }

    return (
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h5">{batch.name}</Typography>
            <Chip
              label={batch.status.replace('_', ' ')}
              color={getStatusColor(batch.status) as any}
            />
          </Box>
          <Box display="flex" gap={1}>
            <IconButton size="small">
              <TimelineIcon />
            </IconButton>
            <IconButton size="small">
              <StatsIcon />
            </IconButton>
            <IconButton size="small">
              <DebugIcon />
            </IconButton>
          </Box>
        </Box>

        <Tabs value={selectedTab} onChange={(_, v) => setSelectedTab(v)} sx={{ mb: 3 }}>
          <Tab label="Overview" />
          <Tab label="Commands" />
          <Tab label="Timeline" />
          <Tab label="Errors" />
        </Tabs>

        {/* Overview Tab */}
        {selectedTab === 0 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Execution Details
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Execution Mode"
                      secondary={batch.executionMode}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Transaction Mode"
                      secondary={batch.transactionMode.replace('_', ' ')}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Created"
                      secondary={format(new Date(batch.createdAt), 'PPpp')}
                    />
                  </ListItem>
                  {batch.startedAt && (
                    <ListItem>
                      <ListItemText
                        primary="Started"
                        secondary={format(new Date(batch.startedAt), 'PPpp')}
                      />
                    </ListItem>
                  )}
                  {batch.completedAt && (
                    <ListItem>
                      <ListItemText
                        primary="Completed"
                        secondary={format(new Date(batch.completedAt), 'PPpp')}
                      />
                    </ListItem>
                  )}
                </List>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Progress Summary
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <CircularProgress
                    variant="determinate"
                    value={batch.progress}
                    size={120}
                    thickness={4}
                    sx={{ display: 'block', mx: 'auto' }}
                  />
                  <Typography variant="h4" align="center" sx={{ mt: 1 }}>
                    {batch.progress.toFixed(0)}%
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={4} textAlign="center">
                    <Typography variant="h6" color="success.main">
                      {batch.completedCommands}
                    </Typography>
                    <Typography variant="body2">Completed</Typography>
                  </Grid>
                  <Grid item xs={4} textAlign="center">
                    <Typography variant="h6" color="error.main">
                      {batch.failedCommands}
                    </Typography>
                    <Typography variant="body2">Failed</Typography>
                  </Grid>
                  <Grid item xs={4} textAlign="center">
                    <Typography variant="h6" color="info.main">
                      {batch.totalCommands - batch.completedCommands - batch.failedCommands}
                    </Typography>
                    <Typography variant="body2">Pending</Typography>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Commands Tab */}
        {selectedTab === 1 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Command</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(batch.commandResults).map(([commandId, result]) => (
                  <TableRow key={commandId}>
                    <TableCell>{commandId}</TableCell>
                    <TableCell>{result.type}</TableCell>
                    <TableCell>
                      <Chip
                        label={result.status}
                        size="small"
                        color={result.success ? 'success' : 'error'}
                      />
                    </TableCell>
                    <TableCell>{formatElapsedTime(result.executionTime)}</TableCell>
                    <TableCell>
                      {result.error ? (
                        <Tooltip title={result.error}>
                          <ErrorIcon color="error" fontSize="small" />
                        </Tooltip>
                      ) : (
                        <SuccessIcon color="success" fontSize="small" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Timeline Tab */}
        {selectedTab === 2 && (
          <Box>
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              Timeline visualization coming soon...
            </Typography>
          </Box>
        )}

        {/* Errors Tab */}
        {selectedTab === 3 && (
          <Box>
            {batch.errorSummary.length === 0 ? (
              <Alert severity="success">No errors encountered</Alert>
            ) : (
              <List>
                {batch.errorSummary.map((error, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary={error.error}
                      secondary={
                        <>
                          Command: {error.commandId}
                          <br />
                          Time: {format(new Date(error.timestamp), 'PPpp')}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Paper>
    );
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Batch List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Active Batches</Typography>
              <IconButton size="small" onClick={() => sendMessage({ type: 'batch.list' })}>
                <RefreshIcon />
              </IconButton>
            </Box>

            <Box mb={2}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="executing">Executing</MenuItem>
                      <MenuItem value="completed">Completed</MenuItem>
                      <MenuItem value="failed">Failed</MenuItem>
                      <MenuItem value="cancelled">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Sort By</InputLabel>
                    <Select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <MenuItem value="createdAt">Created</MenuItem>
                      <MenuItem value="name">Name</MenuItem>
                      <MenuItem value="status">Status</MenuItem>
                      <MenuItem value="progress">Progress</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ maxHeight: 'calc(100vh - 300px)', overflow: 'auto' }}>
              {filteredBatches.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                  No batches found
                </Typography>
              ) : (
                filteredBatches
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map(renderBatchSummary)
              )}
            </Box>

            <TablePagination
              component="div"
              count={filteredBatches.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </Paper>
        </Grid>

        {/* Detailed View */}
        <Grid item xs={12} md={8}>
          {renderDetailedView()}
        </Grid>
      </Grid>

      {/* Rollback Dialog */}
      <Dialog
        open={showRollbackDialog}
        onClose={() => {
          setShowRollbackDialog(false);
          setRollbackBatchId(null);
        }}
      >
        <DialogTitle>Confirm Rollback</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This will attempt to reverse all successfully executed commands in this batch.
            Some operations may not be reversible.
          </Alert>
          <Typography>
            Are you sure you want to rollback this batch?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowRollbackDialog(false);
            setRollbackBatchId(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => {
              if (rollbackBatchId) {
                handleBatchOperation(rollbackBatchId, 'rollback');
              }
              setShowRollbackDialog(false);
              setRollbackBatchId(null);
            }}
          >
            Rollback
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BatchExecutionDashboard;