/**
 * Command History Table Component
 * Displays command history with sorting, filtering, and pagination
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Box,
  Typography,
  CircularProgress,
  Checkbox,
  Menu,
  MenuItem,
  Button
} from '@mui/material';
import {
  Info as InfoIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ViewColumn as ViewColumnIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Schedule as PendingIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { 
  CommandHistory, 
  SortOrder,
  CommandHistoryFilter 
} from '../../types/command-history.types';
import { 
  CommandType, 
  CommandPriority, 
  CommandStatus,
  getPriorityName,
  getStatusColor
} from '../../../../shared/types/command-queue.types';

interface CommandHistoryTableProps {
  data: CommandHistory[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  sortBy: string;
  sortOrder: SortOrder;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sortBy: string, sortOrder: SortOrder) => void;
  onRowClick: (command: CommandHistory) => void;
  onExport: () => void;
  onRefresh: () => void;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

// Column definitions
const COLUMN_DEFINITIONS = {
  commandId: { label: 'Command ID', width: 150, sortable: true },
  commandType: { label: 'Type', width: 150, sortable: true },
  priority: { label: 'Priority', width: 100, sortable: true },
  finalStatus: { label: 'Status', width: 120, sortable: true },
  createdAt: { label: 'Created', width: 180, sortable: true },
  completedAt: { label: 'Completed', width: 180, sortable: true },
  totalExecutionTimeMs: { label: 'Execution Time', width: 120, sortable: true },
  queueWaitTimeMs: { label: 'Queue Time', width: 120, sortable: true },
  retryCount: { label: 'Retries', width: 80, sortable: true },
  userId: { label: 'User', width: 120, sortable: false },
  errorCode: { label: 'Error', width: 120, sortable: true },
  tags: { label: 'Tags', width: 200, sortable: false }
};

// Default visible columns
const DEFAULT_COLUMNS = [
  'commandId',
  'commandType',
  'priority',
  'finalStatus',
  'createdAt',
  'totalExecutionTimeMs',
  'retryCount'
];

export const CommandHistoryTable: React.FC<CommandHistoryTableProps> = ({
  data,
  total,
  page,
  pageSize,
  loading,
  sortBy,
  sortOrder,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onRowClick,
  onExport,
  onRefresh,
  selectedColumns = DEFAULT_COLUMNS,
  onColumnsChange
}) => {
  const [columnMenuAnchor, setColumnMenuAnchor] = useState<null | HTMLElement>(null);

  // Handlers
  const handleSort = useCallback((column: string) => {
    if (COLUMN_DEFINITIONS[column as keyof typeof COLUMN_DEFINITIONS]?.sortable) {
      const newOrder = sortBy === column && sortOrder === SortOrder.ASC 
        ? SortOrder.DESC 
        : SortOrder.ASC;
      onSortChange(column, newOrder);
    }
  }, [sortBy, sortOrder, onSortChange]);

  const handleColumnToggle = useCallback((column: string) => {
    if (selectedColumns.includes(column)) {
      onColumnsChange(selectedColumns.filter(c => c !== column));
    } else {
      onColumnsChange([...selectedColumns, column]);
    }
  }, [selectedColumns, onColumnsChange]);

  // Status icon helper
  const getStatusIcon = useCallback((status: CommandStatus) => {
    switch (status) {
      case CommandStatus.COMPLETED:
        return <SuccessIcon fontSize="small" color="success" />;
      case CommandStatus.FAILED:
      case CommandStatus.TIMEOUT:
        return <ErrorIcon fontSize="small" color="error" />;
      case CommandStatus.CANCELLED:
        return <CancelIcon fontSize="small" color="warning" />;
      case CommandStatus.EXECUTING:
      case CommandStatus.QUEUED:
      case CommandStatus.PENDING:
        return <PendingIcon fontSize="small" color="info" />;
      default:
        return null;
    }
  }, []);

  // Priority chip color
  const getPriorityColor = useCallback((priority: CommandPriority) => {
    switch (priority) {
      case CommandPriority.EMERGENCY:
        return 'error';
      case CommandPriority.HIGH:
        return 'warning';
      case CommandPriority.NORMAL:
        return 'primary';
      case CommandPriority.LOW:
        return 'default';
      default:
        return 'default';
    }
  }, []);

  // Format duration
  const formatDuration = useCallback((ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }, []);

  // Format date
  const formatDate = useCallback((date?: Date | string) => {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'yyyy-MM-dd HH:mm:ss');
  }, []);

  // Render cell content
  const renderCell = useCallback((column: string, row: CommandHistory) => {
    switch (column) {
      case 'commandId':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {row.commandId.slice(0, 8)}...
          </Typography>
        );
      
      case 'commandType':
        return (
          <Chip 
            label={row.commandType} 
            size="small" 
            variant="outlined"
          />
        );
      
      case 'priority':
        return (
          <Chip
            label={getPriorityName(row.priority)}
            size="small"
            color={getPriorityColor(row.priority) as any}
          />
        );
      
      case 'finalStatus':
        return (
          <Box display="flex" alignItems="center" gap={0.5}>
            {getStatusIcon(row.finalStatus)}
            <Typography variant="body2">
              {row.finalStatus}
            </Typography>
          </Box>
        );
      
      case 'createdAt':
        return formatDate(row.createdAt);
      
      case 'completedAt':
        return formatDate(row.completedAt);
      
      case 'totalExecutionTimeMs':
        return formatDuration(row.totalExecutionTimeMs);
      
      case 'queueWaitTimeMs':
        return formatDuration(row.queueWaitTimeMs);
      
      case 'retryCount':
        return row.retryCount || 0;
      
      case 'userId':
        return row.userId || '-';
      
      case 'errorCode':
        return row.errorCode ? (
          <Chip 
            label={row.errorCode} 
            size="small" 
            color="error" 
            variant="outlined"
          />
        ) : '-';
      
      case 'tags':
        return row.tags?.length ? (
          <Box display="flex" gap={0.5} flexWrap="wrap">
            {row.tags.slice(0, 3).map((tag, idx) => (
              <Chip key={idx} label={tag} size="small" />
            ))}
            {row.tags.length > 3 && (
              <Typography variant="caption">+{row.tags.length - 3}</Typography>
            )}
          </Box>
        ) : '-';
      
      default:
        return '-';
    }
  }, [formatDate, formatDuration, getStatusIcon, getPriorityColor]);

  return (
    <Paper elevation={0} sx={{ width: '100%' }}>
      {/* Toolbar */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Typography variant="h6">Command History</Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={onRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton onClick={onExport} disabled={loading}>
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Columns">
            <IconButton onClick={(e) => setColumnMenuAnchor(e.currentTarget)}>
              <ViewColumnIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Column selector menu */}
      <Menu
        anchorEl={columnMenuAnchor}
        open={Boolean(columnMenuAnchor)}
        onClose={() => setColumnMenuAnchor(null)}
      >
        {Object.entries(COLUMN_DEFINITIONS).map(([key, def]) => (
          <MenuItem key={key} onClick={() => handleColumnToggle(key)}>
            <Checkbox
              checked={selectedColumns.includes(key)}
              size="small"
              sx={{ mr: 1 }}
            />
            {def.label}
          </MenuItem>
        ))}
      </Menu>

      {/* Table */}
      <TableContainer sx={{ maxHeight: 'calc(100vh - 300px)' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {selectedColumns.map((column) => {
                const def = COLUMN_DEFINITIONS[column as keyof typeof COLUMN_DEFINITIONS];
                if (!def) return null;
                
                return (
                  <TableCell
                    key={column}
                    style={{ width: def.width }}
                    sortDirection={sortBy === column ? sortOrder : false}
                  >
                    {def.sortable ? (
                      <TableSortLabel
                        active={sortBy === column}
                        direction={sortBy === column ? sortOrder : 'asc'}
                        onClick={() => handleSort(column)}
                      >
                        {def.label}
                      </TableSortLabel>
                    ) : (
                      def.label
                    )}
                  </TableCell>
                );
              })}
              <TableCell width={50} />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={selectedColumns.length + 1} align="center">
                  <CircularProgress size={40} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={selectedColumns.length + 1} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No commands found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.commandId}
                  hover
                  onClick={() => onRowClick(row)}
                  sx={{ cursor: 'pointer' }}
                >
                  {selectedColumns.map((column) => (
                    <TableCell key={column}>
                      {renderCell(column, row)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton size="small">
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={total}
        rowsPerPage={pageSize}
        page={page - 1}
        onPageChange={(_, newPage) => onPageChange(newPage + 1)}
        onRowsPerPageChange={(e) => onPageSizeChange(parseInt(e.target.value, 10))}
      />
    </Paper>
  );
};