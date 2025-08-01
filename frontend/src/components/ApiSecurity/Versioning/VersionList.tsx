import React, { useState, useEffect } from 'react';
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
  Dialog,
  Typography,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  GetApp as ExportIcon,
  Archive as ArchiveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

import VersionForm from './VersionForm';
import { VersioningService } from '../../../services/versioningService';
import { APIVersion, VersionStatus, VersionFilter } from '../../../types/versioning';

interface Props {
  onStatsChange?: () => void;
}

const VersionList: React.FC<Props> = ({ onStatsChange }) => {
  const [versions, setVersions] = useState<APIVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  
  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<APIVersion | null>(null);
  const [viewMode, setViewMode] = useState<'create' | 'edit' | 'view'>('create');
  
  // Filter state
  const [filter, setFilter] = useState<VersionFilter>({
    searchTerm: '',
    status: [],
  });

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await VersioningService.getVersions({
        ...filter,
        // Add pagination params if your backend supports them
      });
      
      if (response.success) {
        setVersions(response.data);
        setTotal(response.pagination?.total || response.data.length);
      } else {
        setError(response.message || 'Failed to load versions');
      }
    } catch (err) {
      console.error('Error loading versions:', err);
      setError('Failed to load versions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [filter, page, rowsPerPage]);

  const handleFilterChange = (field: keyof VersionFilter, value: any) => {
    setFilter(prev => ({
      ...prev,
      [field]: value,
    }));
    setPage(0); // Reset to first page when filtering
  };

  const handleCreate = () => {
    setSelectedVersion(null);
    setViewMode('create');
    setFormOpen(true);
  };

  const handleEdit = (version: APIVersion) => {
    setSelectedVersion(version);
    setViewMode('edit');
    setFormOpen(true);
  };

  const handleView = (version: APIVersion) => {
    setSelectedVersion(version);
    setViewMode('view');
    setFormOpen(true);
  };

  const handleSetDefault = async (version: APIVersion) => {
    try {
      const response = await VersioningService.setDefaultVersion(version.id);
      if (response.success) {
        loadVersions();
        onStatsChange?.();
      } else {
        setError(response.message || 'Failed to set default version');
      }
    } catch (err) {
      console.error('Error setting default version:', err);
      setError('Failed to set default version');
    }
  };

  const handleDeprecate = async (version: APIVersion) => {
    try {
      const response = await VersioningService.deprecateVersion(version.id);
      if (response.success) {
        loadVersions();
        onStatsChange?.();
      } else {
        setError(response.message || 'Failed to deprecate version');
      }
    } catch (err) {
      console.error('Error deprecating version:', err);
      setError('Failed to deprecate version');
    }
  };

  const handleRetire = async (version: APIVersion) => {
    try {
      const response = await VersioningService.retireVersion(version.id);
      if (response.success) {
        loadVersions();
        onStatsChange?.();
      } else {
        setError(response.message || 'Failed to retire version');
      }
    } catch (err) {
      console.error('Error retiring version:', err);
      setError('Failed to retire version');
    }
  };

  const handleDelete = async (version: APIVersion) => {
    if (window.confirm(`Are you sure you want to delete version ${version.version}?`)) {
      try {
        const response = await VersioningService.deleteVersion(version.id);
        if (response.success) {
          loadVersions();
          onStatsChange?.();
        } else {
          setError(response.message || 'Failed to delete version');
        }
      } catch (err) {
        console.error('Error deleting version:', err);
        setError('Failed to delete version');
      }
    }
  };

  const handleExport = async (version: APIVersion) => {
    try {
      const response = await VersioningService.exportVersion(version.id, 'openapi');
      if (response.success) {
        // Create download link
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${version.version}-openapi.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        setError(response.message || 'Failed to export version');
      }
    } catch (err) {
      console.error('Error exporting version:', err);
      setError('Failed to export version');
    }
  };

  const getStatusColor = (status: VersionStatus) => {
    switch (status) {
      case VersionStatus.ACTIVE:
        return 'success';
      case VersionStatus.DEPRECATED:
        return 'warning';
      case VersionStatus.RETIRED:
        return 'error';
      case VersionStatus.DRAFT:
        return 'info';
      default:
        return 'default';
    }
  };

  const getVersionActions = (version: APIVersion) => {
    const actions = [];

    // View action (always available)
    actions.push(
      <Tooltip key="view" title="View Details">
        <IconButton size="small" onClick={() => handleView(version)}>
          <ViewIcon />
        </IconButton>
      </Tooltip>
    );

    // Edit action (not for retired versions)
    if (version.status !== VersionStatus.RETIRED) {
      actions.push(
        <Tooltip key="edit" title="Edit Version">
          <IconButton size="small" onClick={() => handleEdit(version)}>
            <EditIcon />
          </IconButton>
        </Tooltip>
      );
    }

    // Set default action (only for active versions that aren't already default)
    if (version.status === VersionStatus.ACTIVE && !version.isDefault) {
      actions.push(
        <Tooltip key="default" title="Set as Default">
          <IconButton size="small" onClick={() => handleSetDefault(version)}>
            <StarBorderIcon />
          </IconButton>
        </Tooltip>
      );
    }

    // Deprecate action (only for active versions)
    if (version.status === VersionStatus.ACTIVE) {
      actions.push(
        <Tooltip key="deprecate" title="Deprecate Version">
          <IconButton size="small" onClick={() => handleDeprecate(version)}>
            <WarningIcon />
          </IconButton>
        </Tooltip>
      );
    }

    // Retire action (only for deprecated versions)
    if (version.status === VersionStatus.DEPRECATED) {
      actions.push(
        <Tooltip key="retire" title="Retire Version">
          <IconButton size="small" onClick={() => handleRetire(version)}>
            <ArchiveIcon />
          </IconButton>
        </Tooltip>
      );
    }

    // Export action
    actions.push(
      <Tooltip key="export" title="Export OpenAPI Spec">
        <IconButton size="small" onClick={() => handleExport(version)}>
          <ExportIcon />
        </IconButton>
      </Tooltip>
    );

    // Delete action (only for draft or retired versions)
    if (version.status === VersionStatus.DRAFT || version.status === VersionStatus.RETIRED) {
      actions.push(
        <Tooltip key="delete" title="Delete Version">
          <IconButton size="small" onClick={() => handleDelete(version)}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      );
    }

    return actions;
  };

  return (
    <Box>
      {/* Header and Controls */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">API Versions</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Version
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Search versions"
            value={filter.searchTerm || ''}
            onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              multiple
              value={filter.status || []}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              label="Status"
            >
              {Object.values(VersionStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  {status.replace('_', ' ').toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Versions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Version</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Release Date</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>Breaking Changes</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : versions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No versions found
                </TableCell>
              </TableRow>
            ) : (
              versions.map((version) => (
                <TableRow key={version.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {version.version}
                      </Typography>
                      {version.isDefault && (
                        <Tooltip title="Default Version">
                          <StarIcon color="primary" sx={{ ml: 1, fontSize: '1rem' }} />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{version.title}</Typography>
                    {version.description && (
                      <Typography variant="caption" color="textSecondary">
                        {version.description.substring(0, 50)}
                        {version.description.length > 50 && '...'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={version.status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(version.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(version.releaseDate).toLocaleDateString()}
                    </Typography>
                    {version.deprecationDate && (
                      <Typography variant="caption" color="warning.main">
                        Deprecated: {new Date(version.deprecationDate).toLocaleDateString()}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {version.usageCount.toLocaleString()} requests
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {version.breakingChanges.length > 0 ? (
                      <Chip
                        label={`${version.breakingChanges.length} breaking`}
                        color="warning"
                        size="small"
                      />
                    ) : (
                      <Chip
                        label="No breaking changes"
                        color="success"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {getVersionActions(version)}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(event, newPage) => setPage(newPage)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </TableContainer>

      {/* Version Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <VersionForm
          version={selectedVersion}
          mode={viewMode}
          onSave={() => {
            setFormOpen(false);
            loadVersions();
            onStatsChange?.();
          }}
          onCancel={() => setFormOpen(false)}
        />
      </Dialog>
    </Box>
  );
};

export default VersionList;