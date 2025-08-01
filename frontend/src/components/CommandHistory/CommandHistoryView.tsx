/**
 * Main Command History View Component
 * Orchestrates the command history UI with filters, table, and actions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Alert,
  Snackbar,
  Breadcrumbs,
  Link,
  CircularProgress,
  Backdrop
} from '@mui/material';
import {
  NavigateNext as NavigateNextIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { commandHistoryService } from '../../services/commandHistoryService';
import {
  CommandHistory,
  CommandHistoryFilter,
  CommandHistoryResponse,
  SortOrder,
  ExportFormat
} from '../../types/command-history.types';
import { CommandHistoryTable } from './CommandHistoryTable';
import { CommandHistoryFilters } from './CommandHistoryFilters';
import { CommandHistoryExportDialog } from './CommandHistoryExportDialog';
import { CommandDetailDialog } from './CommandDetailDialog';
import { CommandHistoryStats } from './CommandHistoryStats';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

// Default page size
const DEFAULT_PAGE_SIZE = 25;

// Default columns to show
const DEFAULT_COLUMNS = [
  'commandId',
  'commandType',
  'priority',
  'finalStatus',
  'createdAt',
  'totalExecutionTimeMs',
  'retryCount'
];

export const CommandHistoryView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasPermission } = useAuth();
  const { subscribe, unsubscribe } = useWebSocket();

  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Data state
  const [historyData, setHistoryData] = useState<CommandHistoryResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 0
  });
  
  // Filter state
  const [filters, setFilters] = useState<CommandHistoryFilter>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>(SortOrder.DESC);
  
  // UI state
  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<CommandHistory | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  
  // Metadata for filters
  const [availableCommandTypes, setAvailableCommandTypes] = useState<string[]>([]);
  const [availableErrorCodes, setAvailableErrorCodes] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Permission check
  const canViewHistory = hasPermission('VIEW_COMMAND_HISTORY');
  const canExportHistory = hasPermission('EXPORT_COMMAND_HISTORY');

  // Load command history
  const loadHistory = useCallback(async () => {
    if (!canViewHistory) return;

    setLoading(true);
    setError(null);

    try {
      const response = await commandHistoryService.getCommandHistory(
        filters,
        page,
        pageSize,
        sortBy,
        sortOrder
      );
      
      setHistoryData(response);
      
      // Update available filters based on results
      if (response.items.length > 0) {
        const types = new Set(response.items.map(item => item.commandType));
        setAvailableCommandTypes(prev => [...new Set([...prev, ...types])]);
        
        const errorCodes = new Set(response.items
          .filter(item => item.errorCode)
          .map(item => item.errorCode!));
        setAvailableErrorCodes(prev => [...new Set([...prev, ...errorCodes])]);
        
        const users = new Set(response.items
          .filter(item => item.userId)
          .map(item => item.userId!));
        setAvailableUsers(prev => [...new Set([...prev, ...users])]);
        
        const tags = new Set(response.items
          .flatMap(item => item.tags || []));
        setAvailableTags(prev => [...new Set([...prev, ...tags])]);
      }
    } catch (err) {
      console.error('Failed to load command history:', err);
      setError('Failed to load command history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [canViewHistory, filters, page, pageSize, sortBy, sortOrder]);

  // Load initial data
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Subscribe to real-time updates
  useEffect(() => {
    const handleCommandUpdate = (update: any) => {
      // Refresh the current page if a command is updated
      if (update.commandId) {
        loadHistory();
      }
    };

    const unsubscribeFn = subscribe('command_history_update', handleCommandUpdate);
    return () => {
      unsubscribeFn();
    };
  }, [subscribe, loadHistory]);

  // Handlers
  const handleFiltersChange = useCallback((newFilters: CommandHistoryFilter) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const handleSearch = useCallback(() => {
    setPage(1);
    loadHistory();
  }, [loadHistory]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
    loadHistory();
  }, [loadHistory]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((newSortBy: string, newSortOrder: SortOrder) => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const handleRowClick = useCallback((command: CommandHistory) => {
    setSelectedCommand(command);
    setDetailDialogOpen(true);
  }, []);

  const handleExport = useCallback(() => {
    if (!canExportHistory) {
      setError('You do not have permission to export command history.');
      return;
    }
    setExportDialogOpen(true);
  }, [canExportHistory]);

  const handleExportConfirm = useCallback(async (
    format: ExportFormat,
    columns: string[],
    includeAuditTrail: boolean
  ) => {
    setExportDialogOpen(false);
    setLoading(true);

    try {
      await commandHistoryService.exportHistory({
        format,
        filters,
        columns,
        includeAuditTrail
      });
      
      setSuccess(`Export completed successfully.`);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export command history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleRefresh = useCallback(() => {
    commandHistoryService.clearCache();
    loadHistory();
  }, [loadHistory]);

  // Permission denied view
  if (!canViewHistory) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">
          You do not have permission to view command history.
          Please contact your administrator.
        </Alert>
      </Container>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link
              color="inherit"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
            >
              Dashboard
            </Link>
            <Typography color="text.primary">Command History</Typography>
          </Breadcrumbs>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
            <HistoryIcon sx={{ mr: 1, fontSize: 32 }} />
            <Typography variant="h4" component="h1">
              Command History
            </Typography>
          </Box>
        </Box>

        {/* Statistics */}
        <CommandHistoryStats filters={filters} />

        {/* Filters */}
        <CommandHistoryFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onSearch={handleSearch}
          onClear={handleClearFilters}
          availableCommandTypes={availableCommandTypes}
          availableErrorCodes={availableErrorCodes}
          availableUsers={availableUsers}
          availableTags={availableTags}
        />

        {/* Table */}
        <CommandHistoryTable
          data={historyData.items}
          total={historyData.total}
          page={page}
          pageSize={pageSize}
          loading={loading}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onSortChange={handleSortChange}
          onRowClick={handleRowClick}
          onExport={handleExport}
          onRefresh={handleRefresh}
          selectedColumns={selectedColumns}
          onColumnsChange={setSelectedColumns}
        />

        {/* Dialogs */}
        <CommandHistoryExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          onExport={handleExportConfirm}
          availableColumns={Object.keys(historyData.items[0] || {})}
          defaultColumns={selectedColumns}
        />

        {selectedCommand && (
          <CommandDetailDialog
            open={detailDialogOpen}
            onClose={() => {
              setDetailDialogOpen(false);
              setSelectedCommand(null);
            }}
            commandId={selectedCommand.commandId}
          />
        )}

        {/* Loading backdrop */}
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={loading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>

        {/* Notifications */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
        >
          <Alert onClose={() => setError(null)} severity="error">
            {error}
          </Alert>
        </Snackbar>

        <Snackbar
          open={!!success}
          autoHideDuration={4000}
          onClose={() => setSuccess(null)}
        >
          <Alert onClose={() => setSuccess(null)} severity="success">
            {success}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};