/**
 * Feedback History Component
 * 
 * Provides comprehensive feedback history with search, filter, replay,
 * and export capabilities for audit and analysis.
 * 
 * @component
 * @version 1.0.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  Button,
  Menu,
  MenuItem,
  Divider,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Badge,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Replay as ReplayIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  NotificationsActive as AlertIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
  Language as LanguageIcon,
  VolumeUp as SoundIcon,
  Vibration as HapticIcon,
  ScreenShare as ScreenReaderIcon,
  MoreVert as MoreIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider as DateLocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  FeedbackMessage,
  FeedbackSeverity,
  FeedbackChannel,
  SoundPattern,
  HapticPattern,
} from './FeedbackSystem';
import { useLocalization } from './LocalizationProvider';

// Types
export interface FeedbackHistoryEntry extends FeedbackMessage {
  replayCount?: number;
  exportedAt?: Date[];
  tags?: string[];
}

export interface FeedbackFilter {
  severity?: FeedbackSeverity[];
  channels?: FeedbackChannel[];
  dateRange?: {
    start: Date | null;
    end: Date | null;
  };
  searchText?: string;
  acknowledged?: boolean | null;
  persistent?: boolean | null;
  locale?: string[];
  context?: string[];
  tags?: string[];
}

export interface FeedbackHistoryProps {
  /**
   * History entries
   */
  entries: FeedbackHistoryEntry[];
  /**
   * Maximum entries to display
   */
  maxEntries?: number;
  /**
   * Enable replay functionality
   */
  enableReplay?: boolean;
  /**
   * Enable export functionality
   */
  enableExport?: boolean;
  /**
   * Enable deletion
   */
  enableDelete?: boolean;
  /**
   * Callback when an entry is replayed
   */
  onReplay?: (entry: FeedbackHistoryEntry) => void;
  /**
   * Callback when entries are deleted
   */
  onDelete?: (ids: string[]) => void;
  /**
   * Callback when entries are exported
   */
  onExport?: (entries: FeedbackHistoryEntry[], format: 'json' | 'csv' | 'pdf') => void;
}

// Utility functions
const getSeverityIcon = (severity: FeedbackSeverity) => {
  switch (severity) {
    case FeedbackSeverity.SUCCESS:
      return <SuccessIcon />;
    case FeedbackSeverity.INFO:
      return <InfoIcon />;
    case FeedbackSeverity.WARNING:
      return <WarningIcon />;
    case FeedbackSeverity.ERROR:
      return <ErrorIcon />;
    case FeedbackSeverity.CRITICAL:
    case FeedbackSeverity.EMERGENCY:
      return <AlertIcon />;
  }
};

const getSeverityColor = (severity: FeedbackSeverity, theme: any) => {
  switch (severity) {
    case FeedbackSeverity.SUCCESS:
      return theme.palette.success.main;
    case FeedbackSeverity.INFO:
      return theme.palette.info.main;
    case FeedbackSeverity.WARNING:
      return theme.palette.warning.main;
    case FeedbackSeverity.ERROR:
      return theme.palette.error.main;
    case FeedbackSeverity.CRITICAL:
      return theme.palette.error.dark;
    case FeedbackSeverity.EMERGENCY:
      return '#ff0000';
  }
};

const getChannelIcon = (channel: FeedbackChannel) => {
  switch (channel) {
    case FeedbackChannel.VISUAL:
      return null; // Default, no icon
    case FeedbackChannel.AUDITORY:
      return <SoundIcon fontSize="small" />;
    case FeedbackChannel.HAPTIC:
      return <HapticIcon fontSize="small" />;
    case FeedbackChannel.SCREEN_READER:
      return <ScreenReaderIcon fontSize="small" />;
  }
};

// Main Component
export const FeedbackHistory: React.FC<FeedbackHistoryProps> = ({
  entries,
  maxEntries = 1000,
  enableReplay = true,
  enableExport = true,
  enableDelete = true,
  onReplay,
  onDelete,
  onExport,
}) => {
  const theme = useTheme();
  const { t } = useLocalization();
  
  // State
  const [filter, setFilter] = useState<FeedbackFilter>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Filter entries
  const filteredEntries = useMemo(() => {
    let result = entries.slice(0, maxEntries);
    
    // Apply filters
    if (filter.severity && filter.severity.length > 0) {
      result = result.filter(entry => filter.severity!.includes(entry.severity));
    }
    
    if (filter.channels && filter.channels.length > 0) {
      result = result.filter(entry => 
        entry.channels.some(channel => filter.channels!.includes(channel))
      );
    }
    
    if (filter.dateRange?.start) {
      result = result.filter(entry => 
        new Date(entry.timestamp) >= filter.dateRange!.start!
      );
    }
    
    if (filter.dateRange?.end) {
      result = result.filter(entry => 
        new Date(entry.timestamp) <= filter.dateRange!.end!
      );
    }
    
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      result = result.filter(entry => 
        entry.title.toLowerCase().includes(searchLower) ||
        entry.message.toLowerCase().includes(searchLower) ||
        entry.details?.toLowerCase().includes(searchLower) ||
        entry.context?.toLowerCase().includes(searchLower)
      );
    }
    
    if (filter.acknowledged !== null && filter.acknowledged !== undefined) {
      result = result.filter(entry => 
        entry.requiresAcknowledgment && entry.acknowledged === filter.acknowledged
      );
    }
    
    if (filter.persistent !== null && filter.persistent !== undefined) {
      result = result.filter(entry => entry.persistent === filter.persistent);
    }
    
    if (filter.locale && filter.locale.length > 0) {
      result = result.filter(entry => 
        filter.locale!.includes(entry.locale || 'en')
      );
    }
    
    if (filter.context && filter.context.length > 0) {
      result = result.filter(entry => 
        entry.context && filter.context!.includes(entry.context)
      );
    }
    
    if (filter.tags && filter.tags.length > 0) {
      result = result.filter(entry => 
        entry.tags?.some(tag => filter.tags!.includes(tag))
      );
    }
    
    return result;
  }, [entries, filter, maxEntries]);
  
  // Pagination
  const paginatedEntries = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredEntries.slice(start, end);
  }, [filteredEntries, page, rowsPerPage]);
  
  // Statistics
  const statistics = useMemo(() => {
    const stats = {
      total: filteredEntries.length,
      bySeverity: {} as Record<FeedbackSeverity, number>,
      byChannel: {} as Record<FeedbackChannel, number>,
      acknowledged: 0,
      persistent: 0,
      averageReplayCount: 0,
    };
    
    // Initialize counters
    Object.values(FeedbackSeverity).forEach(severity => {
      stats.bySeverity[severity] = 0;
    });
    Object.values(FeedbackChannel).forEach(channel => {
      stats.byChannel[channel] = 0;
    });
    
    // Count
    let totalReplayCount = 0;
    filteredEntries.forEach(entry => {
      stats.bySeverity[entry.severity]++;
      entry.channels.forEach(channel => {
        stats.byChannel[channel]++;
      });
      if (entry.acknowledged) stats.acknowledged++;
      if (entry.persistent) stats.persistent++;
      totalReplayCount += entry.replayCount || 0;
    });
    
    stats.averageReplayCount = stats.total > 0 ? totalReplayCount / stats.total : 0;
    
    return stats;
  }, [filteredEntries]);
  
  // Handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(new Set(paginatedEntries.map(entry => entry.id)));
    } else {
      setSelectedIds(new Set());
    }
  };
  
  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  const handleReplay = (entry: FeedbackHistoryEntry) => {
    onReplay?.(entry);
  };
  
  const handleDeleteSelected = () => {
    if (selectedIds.size > 0) {
      onDelete?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };
  
  const handleExport = (format: 'json' | 'csv' | 'pdf') => {
    const entriesToExport = selectedIds.size > 0
      ? filteredEntries.filter(entry => selectedIds.has(entry.id))
      : filteredEntries;
    
    onExport?.(entriesToExport, format);
    setExportMenuAnchor(null);
  };
  
  const handleClearFilter = () => {
    setFilter({});
  };
  
  // Check if filters are active
  const hasActiveFilters = Object.keys(filter).some(key => {
    const value = filter[key as keyof FeedbackFilter];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== null && v !== undefined);
    }
    return value !== null && value !== undefined;
  });
  
  return (
    <Box>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {t('feedback.history.title', { count: statistics.total })}
        </Typography>
        
        {/* Search */}
        <TextField
          size="small"
          placeholder={t('feedback.history.search')}
          value={filter.searchText || ''}
          onChange={(e) => setFilter(prev => ({ ...prev, searchText: e.target.value }))}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: filter.searchText && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setFilter(prev => ({ ...prev, searchText: '' }))}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ width: 300 }}
        />
        
        {/* Filter */}
        <Badge
          badgeContent={hasActiveFilters ? '!' : null}
          color="primary"
        >
          <IconButton
            onClick={(e) => {
              setFilterAnchor(e.currentTarget);
              setShowFilterMenu(true);
            }}
          >
            <FilterIcon />
          </IconButton>
        </Badge>
        
        {/* Actions */}
        {selectedIds.size > 0 && (
          <>
            <Chip
              label={t('feedback.history.selected', { count: selectedIds.size })}
              onDelete={() => setSelectedIds(new Set())}
            />
            
            {enableDelete && (
              <IconButton onClick={handleDeleteSelected} color="error">
                <DeleteIcon />
              </IconButton>
            )}
          </>
        )}
        
        {enableExport && (
          <IconButton
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          >
            <DownloadIcon />
          </IconButton>
        )}
      </Stack>
      
      {/* Statistics Summary */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(statistics.bySeverity).map(([severity, count]) => 
          count > 0 && (
            <Chip
              key={severity}
              icon={getSeverityIcon(severity as FeedbackSeverity)}
              label={`${count} ${severity}`}
              size="small"
              sx={{
                backgroundColor: alpha(
                  getSeverityColor(severity as FeedbackSeverity, theme),
                  0.1
                ),
                color: getSeverityColor(severity as FeedbackSeverity, theme),
              }}
            />
          )
        )}
      </Stack>
      
      {/* Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={
                    selectedIds.size > 0 && 
                    selectedIds.size < paginatedEntries.length
                  }
                  checked={
                    paginatedEntries.length > 0 &&
                    selectedIds.size === paginatedEntries.length
                  }
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>{t('feedback.history.time')}</TableCell>
              <TableCell>{t('feedback.history.severity')}</TableCell>
              <TableCell>{t('feedback.history.title')}</TableCell>
              <TableCell>{t('feedback.history.channels')}</TableCell>
              <TableCell>{t('feedback.history.status')}</TableCell>
              <TableCell align="right">{t('feedback.history.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedEntries.map((entry) => {
              const isSelected = selectedIds.has(entry.id);
              const severityColor = getSeverityColor(entry.severity, theme);
              
              return (
                <TableRow
                  key={entry.id}
                  hover
                  selected={isSelected}
                  onClick={() => handleSelectOne(entry.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox checked={isSelected} />
                  </TableCell>
                  
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Stack>
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      icon={getSeverityIcon(entry.severity)}
                      label={entry.severity}
                      size="small"
                      sx={{
                        backgroundColor: alpha(severityColor, 0.1),
                        color: severityColor,
                      }}
                    />
                  </TableCell>
                  
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        {entry.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {entry.message}
                      </Typography>
                      {entry.context && (
                        <Chip label={entry.context} size="small" variant="outlined" />
                      )}
                    </Stack>
                  </TableCell>
                  
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {entry.channels.map(channel => {
                        const icon = getChannelIcon(channel);
                        return icon ? (
                          <Tooltip key={channel} title={channel}>
                            {icon}
                          </Tooltip>
                        ) : null;
                      })}
                    </Stack>
                  </TableCell>
                  
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      {entry.acknowledged && (
                        <Chip
                          label={t('feedback.history.acknowledged')}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                      {entry.persistent && (
                        <Chip
                          label={t('feedback.history.persistent')}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {entry.replayCount && entry.replayCount > 0 && (
                        <Chip
                          label={`${entry.replayCount}x`}
                          size="small"
                          variant="outlined"
                          icon={<ReplayIcon fontSize="small" />}
                        />
                      )}
                    </Stack>
                  </TableCell>
                  
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDetails(entry.id);
                        }}
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                      
                      {enableReplay && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReplay(entry);
                          }}
                        >
                          <ReplayIcon fontSize="small" />
                        </IconButton>
                      )}
                      
                      <IconButton size="small">
                        <MoreIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        
        <TablePagination
          component="div"
          count={filteredEntries.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
      
      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchor}
        open={showFilterMenu}
        onClose={() => {
          setShowFilterMenu(false);
          setFilterAnchor(null);
        }}
        PaperProps={{
          sx: { width: 350, p: 2 },
        }}
      >
        <Stack spacing={2}>
          <Typography variant="subtitle2">
            {t('feedback.history.filters')}
          </Typography>
          
          {/* Severity Filter */}
          <FormControl size="small" fullWidth>
            <InputLabel>{t('feedback.history.severity')}</InputLabel>
            <Select
              multiple
              value={filter.severity || []}
              onChange={(e: SelectChangeEvent<FeedbackSeverity[]>) => {
                setFilter(prev => ({
                  ...prev,
                  severity: e.target.value as FeedbackSeverity[],
                }));
              }}
              renderValue={(selected) => (
                <Stack direction="row" spacing={0.5}>
                  {selected.map(severity => (
                    <Chip
                      key={severity}
                      label={severity}
                      size="small"
                      sx={{
                        backgroundColor: alpha(
                          getSeverityColor(severity, theme),
                          0.1
                        ),
                        color: getSeverityColor(severity, theme),
                      }}
                    />
                  ))}
                </Stack>
              )}
            >
              {Object.values(FeedbackSeverity).map(severity => (
                <MenuItem key={severity} value={severity}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getSeverityIcon(severity)}
                    <Typography>{severity}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Channel Filter */}
          <FormControl size="small" fullWidth>
            <InputLabel>{t('feedback.history.channels')}</InputLabel>
            <Select
              multiple
              value={filter.channels || []}
              onChange={(e: SelectChangeEvent<FeedbackChannel[]>) => {
                setFilter(prev => ({
                  ...prev,
                  channels: e.target.value as FeedbackChannel[],
                }));
              }}
            >
              {Object.values(FeedbackChannel).map(channel => (
                <MenuItem key={channel} value={channel}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getChannelIcon(channel)}
                    <Typography>{channel}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Date Range */}
          <DateLocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={1}>
              <DatePicker
                label={t('feedback.history.startDate')}
                value={filter.dateRange?.start || null}
                onChange={(date) => {
                  setFilter(prev => ({
                    ...prev,
                    dateRange: {
                      ...prev.dateRange,
                      start: date,
                    },
                  }));
                }}
                slotProps={{
                  textField: { size: 'small', fullWidth: true },
                }}
              />
              <DatePicker
                label={t('feedback.history.endDate')}
                value={filter.dateRange?.end || null}
                onChange={(date) => {
                  setFilter(prev => ({
                    ...prev,
                    dateRange: {
                      ...prev.dateRange,
                      end: date,
                    },
                  }));
                }}
                slotProps={{
                  textField: { size: 'small', fullWidth: true },
                }}
              />
            </Stack>
          </DateLocalizationProvider>
          
          <Divider />
          
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button onClick={handleClearFilter} size="small">
              {t('feedback.history.clearFilters')}
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                setShowFilterMenu(false);
                setFilterAnchor(null);
              }}
            >
              {t('feedback.history.apply')}
            </Button>
          </Stack>
        </Stack>
      </Menu>
      
      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('json')}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DownloadIcon fontSize="small" />
            <Typography>Export as JSON</Typography>
          </Stack>
        </MenuItem>
        <MenuItem onClick={() => handleExport('csv')}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DownloadIcon fontSize="small" />
            <Typography>Export as CSV</Typography>
          </Stack>
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf')}>
          <Stack direction="row" spacing={1} alignItems="center">
            <DownloadIcon fontSize="small" />
            <Typography>Export as PDF</Typography>
          </Stack>
        </MenuItem>
      </Menu>
      
      {/* Details Dialog */}
      {showDetails && (
        <Dialog
          open={true}
          onClose={() => setShowDetails(null)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {t('feedback.history.messageDetails')}
          </DialogTitle>
          <DialogContent>
            {(() => {
              const entry = entries.find(e => e.id === showDetails);
              if (!entry) return null;
              
              return (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {t('feedback.history.timestamp')}
                    </Typography>
                    <Typography>
                      {new Date(entry.timestamp).toLocaleString()}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {t('feedback.history.severity')}
                    </Typography>
                    <Chip
                      icon={getSeverityIcon(entry.severity)}
                      label={entry.severity}
                      sx={{
                        backgroundColor: alpha(
                          getSeverityColor(entry.severity, theme),
                          0.1
                        ),
                        color: getSeverityColor(entry.severity, theme),
                      }}
                    />
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {t('feedback.history.title')}
                    </Typography>
                    <Typography>{entry.title}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {t('feedback.history.message')}
                    </Typography>
                    <Typography>{entry.message}</Typography>
                  </Box>
                  
                  {entry.details && (
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        {t('feedback.history.details')}
                      </Typography>
                      <Typography>{entry.details}</Typography>
                    </Box>
                  )}
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {t('feedback.history.channels')}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {entry.channels.map(channel => (
                        <Chip
                          key={channel}
                          label={channel}
                          size="small"
                          icon={getChannelIcon(channel) || undefined}
                        />
                      ))}
                    </Stack>
                  </Box>
                  
                  {entry.context && (
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        {t('feedback.history.context')}
                      </Typography>
                      <Chip label={entry.context} />
                    </Box>
                  )}
                  
                  {entry.tags && entry.tags.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="textSecondary">
                        {t('feedback.history.tags')}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        {entry.tags.map(tag => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </Box>
                  )}
                  
                  <Box>
                    <Typography variant="subtitle2" color="textSecondary">
                      {t('feedback.history.properties')}
                    </Typography>
                    <Stack spacing={1}>
                      {entry.persistent && (
                        <Typography variant="body2">
                          • {t('feedback.history.persistent')}
                        </Typography>
                      )}
                      {entry.requiresAcknowledgment && (
                        <Typography variant="body2">
                          • {t('feedback.history.requiresAcknowledgment')}
                          {entry.acknowledged && ` (${t('feedback.history.acknowledged')})`}
                        </Typography>
                      )}
                      {entry.soundPattern && (
                        <Typography variant="body2">
                          • Sound: {entry.soundPattern}
                        </Typography>
                      )}
                      {entry.hapticPattern && (
                        <Typography variant="body2">
                          • Haptic: {entry.hapticPattern}
                        </Typography>
                      )}
                      {entry.duration && (
                        <Typography variant="body2">
                          • Duration: {entry.duration}ms
                        </Typography>
                      )}
                      {entry.replayCount && entry.replayCount > 0 && (
                        <Typography variant="body2">
                          • Replayed {entry.replayCount} times
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              );
            })()}
          </DialogContent>
          <DialogActions>
            {enableReplay && showDetails && (
              <Button
                onClick={() => {
                  const entry = entries.find(e => e.id === showDetails);
                  if (entry) {
                    handleReplay(entry);
                  }
                }}
                startIcon={<ReplayIcon />}
              >
                {t('feedback.history.replay')}
              </Button>
            )}
            <Button onClick={() => setShowDetails(null)}>
              {t('feedback.history.close')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default FeedbackHistory;