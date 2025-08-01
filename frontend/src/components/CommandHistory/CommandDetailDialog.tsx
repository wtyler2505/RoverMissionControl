/**
 * Command Detail Dialog Component
 * Shows detailed information about a specific command including audit trail
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineOppositeContent,
  Card,
  CardContent,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { commandHistoryService } from '../../services/commandHistoryService';
import { 
  CommandHistory, 
  AuditLogEntry 
} from '../../types/command-history.types';
import { 
  CommandStatus,
  getPriorityName,
  CommandPriority
} from '../../../../shared/types/command-queue.types';

interface CommandDetailDialogProps {
  open: boolean;
  onClose: () => void;
  commandId: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`command-detail-tabpanel-${index}`}
      aria-labelledby={`command-detail-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

export const CommandDetailDialog: React.FC<CommandDetailDialogProps> = ({
  open,
  onClose,
  commandId
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState<CommandHistory | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditLogEntry[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load command details
  const loadCommandDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await commandHistoryService.getCommandDetails(commandId, true);
      setCommand(response.command);
      setAuditTrail(response.auditTrail || []);
    } catch (err) {
      console.error('Failed to load command details:', err);
      setError('Failed to load command details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [commandId]);

  useEffect(() => {
    if (open && commandId) {
      loadCommandDetails();
    }
  }, [open, commandId, loadCommandDetails]);

  // Handlers
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCopyCommandId = useCallback(() => {
    navigator.clipboard.writeText(commandId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [commandId]);

  const formatDate = useCallback((date?: Date | string) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'yyyy-MM-dd HH:mm:ss.SSS');
  }, []);

  const formatDuration = useCallback((ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }, []);

  const getStatusIcon = useCallback((status: CommandStatus) => {
    switch (status) {
      case CommandStatus.COMPLETED:
        return <SuccessIcon color="success" />;
      case CommandStatus.FAILED:
      case CommandStatus.TIMEOUT:
        return <ErrorIcon color="error" />;
      case CommandStatus.CANCELLED:
        return <CancelIcon color="warning" />;
      default:
        return <PendingIcon color="info" />;
    }
  }, []);

  const getStatusColor = useCallback((status: CommandStatus) => {
    switch (status) {
      case CommandStatus.COMPLETED:
        return theme.palette.success.main;
      case CommandStatus.FAILED:
      case CommandStatus.TIMEOUT:
        return theme.palette.error.main;
      case CommandStatus.CANCELLED:
        return theme.palette.warning.main;
      default:
        return theme.palette.info.main;
    }
  }, [theme]);

  if (!command && !loading) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">Command Details</Typography>
            {command && (
              <>
                <Typography variant="body2" color="text.secondary">
                  {command.commandId.slice(0, 8)}...
                </Typography>
                <Tooltip title={copySuccess ? "Copied!" : "Copy full ID"}>
                  <IconButton size="small" onClick={handleCopyCommandId}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
          <Box display="flex" gap={1}>
            <IconButton onClick={loadCommandDetails} disabled={loading}>
              <RefreshIcon />
            </IconButton>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : command ? (
          <>
            {/* Summary Card */}
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      {getStatusIcon(command.finalStatus)}
                      <Typography variant="h6">
                        {command.commandType}
                      </Typography>
                      <Chip
                        label={getPriorityName(command.priority)}
                        size="small"
                        color={
                          command.priority === CommandPriority.EMERGENCY ? 'error' :
                          command.priority === CommandPriority.HIGH ? 'warning' :
                          'default'
                        }
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Status: <strong>{command.finalStatus}</strong>
                    </Typography>
                    {command.errorCode && (
                      <Typography variant="body2" color="error">
                        Error: {command.errorCode}
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>Execution Time:</strong> {formatDuration(command.totalExecutionTimeMs)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Queue Time:</strong> {formatDuration(command.queueWaitTimeMs)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Retries:</strong> {command.retryCount}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange}>
                <Tab label="Details" icon={<CodeIcon />} iconPosition="start" />
                <Tab label="Timeline" icon={<TimelineIcon />} iconPosition="start" />
                <Tab label="Audit Trail" icon={<TimelineIcon />} iconPosition="start" />
              </Tabs>
            </Box>

            {/* Details Tab */}
            <TabPanel value={tabValue} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Identification
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>Command ID</strong></TableCell>
                          <TableCell sx={{ fontFamily: 'monospace' }}>{command.commandId}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Type</strong></TableCell>
                          <TableCell>{command.commandType}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Priority</strong></TableCell>
                          <TableCell>{getPriorityName(command.priority)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>User ID</strong></TableCell>
                          <TableCell>{command.userId || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Session ID</strong></TableCell>
                          <TableCell>{command.sessionId || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Source System</strong></TableCell>
                          <TableCell>{command.sourceSystem || '-'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Execution Details
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell><strong>Final Status</strong></TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {getStatusIcon(command.finalStatus)}
                              {command.finalStatus}
                            </Box>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Success</strong></TableCell>
                          <TableCell>{command.success ? 'Yes' : 'No'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Error Code</strong></TableCell>
                          <TableCell>{command.errorCode || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Error Category</strong></TableCell>
                          <TableCell>{command.errorCategory || '-'}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Retry Count</strong></TableCell>
                          <TableCell>{command.retryCount}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell><strong>Data Classification</strong></TableCell>
                          <TableCell>{command.dataClassification || 'internal'}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>

                {/* Parameters and Results */}
                {(command.parameterSummary || command.resultSummary) && (
                  <>
                    {command.parameterSummary && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Parameters
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <pre style={{ margin: 0, overflow: 'auto' }}>
                            {JSON.stringify(command.parameterSummary, null, 2)}
                          </pre>
                        </Paper>
                      </Grid>
                    )}

                    {command.resultSummary && (
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                          Results
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <pre style={{ margin: 0, overflow: 'auto' }}>
                            {JSON.stringify(command.resultSummary, null, 2)}
                          </pre>
                        </Paper>
                      </Grid>
                    )}
                  </>
                )}

                {/* Tags */}
                {command.tags && command.tags.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom>
                      Tags
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {command.tags.map((tag, idx) => (
                        <Chip key={idx} label={tag} size="small" />
                      ))}
                    </Box>
                  </Grid>
                )}
              </Grid>
            </TabPanel>

            {/* Timeline Tab */}
            <TabPanel value={tabValue} index={1}>
              <Timeline position="alternate">
                <TimelineItem>
                  <TimelineOppositeContent color="text.secondary">
                    {formatDate(command.createdAt)}
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot color="primary" />
                    <TimelineConnector />
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography variant="subtitle2">Created</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Command created and validated
                    </Typography>
                  </TimelineContent>
                </TimelineItem>

                {command.queuedAt && (
                  <TimelineItem>
                    <TimelineOppositeContent color="text.secondary">
                      {formatDate(command.queuedAt)}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="info" />
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">Queued</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Added to command queue
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                )}

                {command.startedAt && (
                  <TimelineItem>
                    <TimelineOppositeContent color="text.secondary">
                      {formatDate(command.startedAt)}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot color="warning" />
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">Started</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Execution began
                        {command.queueWaitTimeMs && (
                          <> (waited {formatDuration(command.queueWaitTimeMs)})</>
                        )}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                )}

                {command.completedAt && (
                  <TimelineItem>
                    <TimelineOppositeContent color="text.secondary">
                      {formatDate(command.completedAt)}
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot 
                        color={command.success ? "success" : "error"}
                      />
                    </TimelineSeparator>
                    <TimelineContent>
                      <Typography variant="subtitle2">
                        {command.success ? 'Completed' : 'Failed'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {command.totalExecutionTimeMs && (
                          <>Executed in {formatDuration(command.totalExecutionTimeMs)}</>
                        )}
                        {command.errorCode && (
                          <> with error: {command.errorCode}</>
                        )}
                      </Typography>
                    </TimelineContent>
                  </TimelineItem>
                )}
              </Timeline>
            </TabPanel>

            {/* Audit Trail Tab */}
            <TabPanel value={tabValue} index={2}>
              {auditTrail.length === 0 ? (
                <Alert severity="info">No audit trail available for this command.</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Event Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Details</TableCell>
                        <TableCell>User</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditTrail.map((entry, idx) => (
                        <TableRow key={entry.auditId || idx}>
                          <TableCell>{formatDate(entry.eventTimestamp)}</TableCell>
                          <TableCell>
                            <Chip label={entry.eventType} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Box display="flex" alignItems="center" gap={0.5}>
                              {getStatusIcon(entry.status)}
                              {entry.status}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {entry.eventDetails || '-'}
                            {entry.executionTimeMs && (
                              <Typography variant="caption" display="block">
                                Duration: {formatDuration(entry.executionTimeMs)}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>{entry.userId || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </TabPanel>
          </>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};