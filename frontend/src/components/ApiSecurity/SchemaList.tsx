import React, { useState, useMemo } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  InputAdornment
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Download as ExportIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { SchemaDefinition, SchemaType, SchemaStatus, SchemaFilter } from '../../types/schema';
import schemaService from '../../services/schemaService';

interface SchemaListProps {
  schemas: SchemaDefinition[];
  selectedSchema: SchemaDefinition | null;
  onSchemaSelect: (schema: SchemaDefinition) => void;
  onSchemaDelete: (schemaId: string) => void;
  loading: boolean;
}

const SchemaList: React.FC<SchemaListProps> = ({
  schemas,
  selectedSchema,
  onSchemaSelect,
  onSchemaDelete,
  loading
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filter, setFilter] = useState<SchemaFilter>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState<SchemaDefinition | null>(null);

  const filteredSchemas = useMemo(() => {
    return schemas.filter(schema => {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        if (
          !schema.name.toLowerCase().includes(searchLower) &&
          !schema.description?.toLowerCase().includes(searchLower) &&
          !schema.namespace?.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }
      if (filter.type && schema.type !== filter.type) return false;
      if (filter.status && schema.status !== filter.status) return false;
      if (filter.namespace && schema.namespace !== filter.namespace) return false;
      if (filter.tags?.length && !filter.tags.some(tag => schema.tags?.includes(tag))) return false;
      return true;
    });
  }, [schemas, filter]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (key: keyof SchemaFilter, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const handleDeleteClick = (schema: SchemaDefinition) => {
    setSchemaToDelete(schema);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (schemaToDelete) {
      onSchemaDelete(schemaToDelete.id);
      setDeleteDialogOpen(false);
      setSchemaToDelete(null);
    }
  };

  const handleExport = async (schema: SchemaDefinition, format: 'json_schema' | 'openapi') => {
    try {
      const blob = await schemaService.exportSchema(schema.id, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema.name}.${format === 'json_schema' ? 'json' : 'yaml'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export schema:', error);
    }
  };

  const handleCopy = async (schema: SchemaDefinition) => {
    try {
      const newSchema = {
        ...schema,
        id: undefined,
        name: `${schema.name} (Copy)`,
        status: SchemaStatus.DRAFT
      };
      await schemaService.createSchema(newSchema);
      // Trigger refresh in parent component
    } catch (error) {
      console.error('Failed to copy schema:', error);
    }
  };

  const getStatusColor = (status: SchemaStatus) => {
    switch (status) {
      case SchemaStatus.ACTIVE:
        return 'success';
      case SchemaStatus.DRAFT:
        return 'default';
      case SchemaStatus.DEPRECATED:
        return 'warning';
      case SchemaStatus.ARCHIVED:
        return 'error';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: SchemaType) => {
    switch (type) {
      case SchemaType.JSON_SCHEMA:
        return 'JS';
      case SchemaType.OPENAPI:
        return 'OA';
      case SchemaType.SWAGGER:
        return 'SW';
      case SchemaType.GRAPHQL:
        return 'GQ';
      case SchemaType.PROTOBUF:
        return 'PB';
      default:
        return '??';
    }
  };

  const uniqueNamespaces = [...new Set(schemas.map(s => s.namespace).filter(Boolean))];

  return (
    <Box>
      <Paper sx={{ mb: 2, p: 2 }}>
        <Box display="flex" gap={2} alignItems="center">
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={filter.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, maxWidth: 300 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filter.type || ''}
              label="Type"
              onChange={(e) => handleFilterChange('type', e.target.value || undefined)}
            >
              <MenuItem value="">All</MenuItem>
              {Object.values(SchemaType).map(type => (
                <MenuItem key={type} value={type}>
                  {type.replace('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filter.status || ''}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
            >
              <MenuItem value="">All</MenuItem>
              {Object.values(SchemaStatus).map(status => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {uniqueNamespaces.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Namespace</InputLabel>
              <Select
                value={filter.namespace || ''}
                label="Namespace"
                onChange={(e) => handleFilterChange('namespace', e.target.value || undefined)}
              >
                <MenuItem value="">All</MenuItem>
                {uniqueNamespaces.map(ns => (
                  <MenuItem key={ns} value={ns}>
                    {ns}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Namespace</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSchemas
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((schema) => (
                    <TableRow
                      key={schema.id}
                      hover
                      selected={selectedSchema?.id === schema.id}
                      onClick={() => onSchemaSelect(schema)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {schema.name}
                          </Typography>
                          {schema.description && (
                            <Typography variant="caption" color="text.secondary">
                              {schema.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getTypeIcon(schema.type)}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{schema.version}</TableCell>
                      <TableCell>
                        <Chip
                          label={schema.status}
                          size="small"
                          color={getStatusColor(schema.status) as any}
                        />
                      </TableCell>
                      <TableCell>{schema.namespace || '-'}</TableCell>
                      <TableCell>
                        {new Date(schema.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" justifyContent="flex-end" gap={0.5}>
                          <Tooltip title="View">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSchemaSelect(schema);
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(schema);
                              }}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Export as JSON Schema">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExport(schema, 'json_schema');
                              }}
                            >
                              <ExportIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(schema);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            <TablePagination
              rowsPerPageOptions={[5, 10, 25, 50]}
              component="div"
              count={filteredSchemas.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
            />
          </>
        )}
      </TableContainer>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        aria-labelledby="delete-dialog-title"
      >
        <DialogTitle id="delete-dialog-title">
          Delete Schema
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the schema "{schemaToDelete?.name}"? 
            This action cannot be undone and will also remove all associated validation rules and mappings.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchemaList;