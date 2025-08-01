import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  LinearProgress,
  Tooltip,
  Menu,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Download as DownloadIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  CloudDownload as CloudDownloadIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Compress as CompressIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, formatDistanceToNow } from 'date-fns';
import auditService, { getComplianceColor } from '../../../services/auditService';
import {
  AuditExport,
  AuditSearchParams,
  ExportFormat,
  ComplianceFramework,
  AuditCategory,
  AuditSeverity
} from '../../../types/audit';

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'N/A';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const AuditExportManager: React.FC = () => {
  const [exports, setExports] = useState<AuditExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedExport, setSelectedExport] = useState<AuditExport | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // Export form state
  const [exportForm, setExportForm] = useState({
    format: ExportFormat.JSON,
    startDate: null as Date | null,
    endDate: null as Date | null,
    categories: [] as AuditCategory[],
    severities: [] as AuditSeverity[],
    searchText: '',
    complianceFramework: undefined as ComplianceFramework | undefined,
    encryptionEnabled: true,
    compressionEnabled: true
  });

  useEffect(() => {
    fetchExports();
    // Set up polling for active exports
    const interval = setInterval(() => {
      if (exports.some(exp => exp.status === 'pending' || exp.status === 'processing')) {
        fetchExports();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [exports]);

  const fetchExports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditService.getExports();
      setExports(data);
    } catch (err) {
      setError('Failed to load exports');
      console.error('Exports error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateExport = async () => {
    try {
      setCreating(true);
      
      const filters: AuditSearchParams = {
        start_date: exportForm.startDate?.toISOString(),
        end_date: exportForm.endDate?.toISOString(),
        categories: exportForm.categories.length > 0 ? exportForm.categories : undefined,
        severities: exportForm.severities.length > 0 ? exportForm.severities : undefined,
        search_text: exportForm.searchText || undefined
      };
      
      const options = {
        compliance_framework: exportForm.complianceFramework,
        encryption_enabled: exportForm.encryptionEnabled,
        compression_enabled: exportForm.compressionEnabled
      };
      
      await auditService.createExport(exportForm.format, filters, options);
      await fetchExports();
      setShowCreateDialog(false);
      
      // Reset form
      setExportForm({
        format: ExportFormat.JSON,
        startDate: null,
        endDate: null,
        categories: [],
        severities: [],
        searchText: '',
        complianceFramework: undefined,
        encryptionEnabled: true,
        compressionEnabled: true
      });
    } catch (err) {
      console.error('Create export error:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDownloadExport = async (exportId: string) => {
    try {
      const blob = await auditService.downloadExport(exportId);
      const exportData = exports.find(exp => exp.id === exportId);
      const filename = `audit-export-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.${exportData?.format || 'json'}`;
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleDeleteExport = async (exportId: string) => {
    try {
      await auditService.deleteExport(exportId);
      await fetchExports();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, exportData: AuditExport) => {
    setAnchorEl(event.currentTarget);
    setSelectedExport(exportData);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedExport(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'processing':
        return <CircularProgress size={16} />;
      default:
        return <PendingIcon color="action" fontSize="small" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'processing': return 'info';
      default: return 'default';
    }
  };

  if (loading && exports.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Export Manager
        </Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<CloudDownloadIcon />}
            onClick={() => setShowCreateDialog(true)}
          >
            Create Export
          </Button>
          <IconButton onClick={fetchExports}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Exports Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Export ID</TableCell>
              <TableCell>Format</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Records</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell>Options</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exports.map((exportData) => (
              <TableRow key={exportData.id} hover>
                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {exportData.id.substring(0, 8)}...
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={exportData.format.toUpperCase()} size="small" />
                </TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getStatusIcon(exportData.status)}
                    <Chip
                      label={exportData.status}
                      size="small"
                      color={getStatusColor(exportData.status) as any}
                    />
                  </Box>
                </TableCell>
                <TableCell>
                  {exportData.record_count?.toLocaleString() || '-'}
                </TableCell>
                <TableCell>
                  {formatFileSize(exportData.file_size)}
                </TableCell>
                <TableCell>
                  <Tooltip title={format(new Date(exportData.exported_at), 'PPpp')}>
                    <Typography variant="body2">
                      {formatDistanceToNow(new Date(exportData.exported_at), { addSuffix: true })}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {exportData.expires_at ? (
                    <Tooltip title={format(new Date(exportData.expires_at), 'PPpp')}>
                      <Typography variant="body2">
                        {formatDistanceToNow(new Date(exportData.expires_at), { addSuffix: true })}
                      </Typography>
                    </Tooltip>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={0.5}>
                    {exportData.encryption_enabled && (
                      <Tooltip title="Encrypted">
                        <LockIcon fontSize="small" color="action" />
                      </Tooltip>
                    )}
                    {exportData.compression_enabled && (
                      <Tooltip title="Compressed">
                        <CompressIcon fontSize="small" color="action" />
                      </Tooltip>
                    )}
                    {exportData.compliance_framework && (
                      <Tooltip title={`${exportData.compliance_framework.toUpperCase()} Compliance`}>
                        <Chip
                          label={exportData.compliance_framework}
                          size="small"
                          style={{
                            backgroundColor: getComplianceColor(exportData.compliance_framework),
                            color: 'white',
                            fontSize: '0.65rem',
                            height: 20
                          }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={1}>
                    {exportData.status === 'completed' && (
                      <Tooltip title="Download">
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadExport(exportData.id)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuClick(e, exportData)}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {selectedExport?.status === 'completed' && (
          <MenuItem onClick={() => {
            handleDownloadExport(selectedExport.id);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        {selectedExport && (
          <MenuItem onClick={() => {
            handleDeleteExport(selectedExport.id);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create Export Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Audit Export</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Export Format</InputLabel>
                <Select
                  value={exportForm.format}
                  onChange={(e) => setExportForm(prev => ({ ...prev, format: e.target.value as ExportFormat }))}
                  label="Export Format"
                >
                  <MenuItem value={ExportFormat.JSON}>JSON</MenuItem>
                  <MenuItem value={ExportFormat.CSV}>CSV</MenuItem>
                  <MenuItem value={ExportFormat.XML}>XML</MenuItem>
                  <MenuItem value={ExportFormat.SYSLOG}>Syslog</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Compliance Framework (Optional)</InputLabel>
                <Select
                  value={exportForm.complianceFramework || ''}
                  onChange={(e) => setExportForm(prev => ({ 
                    ...prev, 
                    complianceFramework: e.target.value as ComplianceFramework || undefined 
                  }))}
                  label="Compliance Framework (Optional)"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value={ComplianceFramework.SOX}>SOX</MenuItem>
                  <MenuItem value={ComplianceFramework.PCI_DSS}>PCI DSS</MenuItem>
                  <MenuItem value={ComplianceFramework.GDPR}>GDPR</MenuItem>
                  <MenuItem value={ComplianceFramework.HIPAA}>HIPAA</MenuItem>
                  <MenuItem value={ComplianceFramework.ISO_27001}>ISO 27001</MenuItem>
                  <MenuItem value={ComplianceFramework.CCPA}>CCPA</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Date Range
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="Start Date"
                      value={exportForm.startDate}
                      onChange={(date) => setExportForm(prev => ({ ...prev, startDate: date }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item xs={12} md={6}>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                      label="End Date"
                      value={exportForm.endDate}
                      onChange={(date) => setExportForm(prev => ({ ...prev, endDate: date }))}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
              </Grid>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Search Text (Optional)"
                value={exportForm.searchText}
                onChange={(e) => setExportForm(prev => ({ ...prev, searchText: e.target.value }))}
                placeholder="Search in audit logs..."
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Categories</InputLabel>
                <Select
                  multiple
                  value={exportForm.categories}
                  onChange={(e) => setExportForm(prev => ({ ...prev, categories: e.target.value as AuditCategory[] }))}
                  label="Categories"
                  renderValue={(selected) => `${selected.length} selected`}
                >
                  {Object.values(AuditCategory).map(category => (
                    <MenuItem key={category} value={category}>
                      <Checkbox checked={exportForm.categories.includes(category)} />
                      <ListItemText primary={category.replace(/_/g, ' ')} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Severities</InputLabel>
                <Select
                  multiple
                  value={exportForm.severities}
                  onChange={(e) => setExportForm(prev => ({ ...prev, severities: e.target.value as AuditSeverity[] }))}
                  label="Severities"
                  renderValue={(selected) => `${selected.length} selected`}
                >
                  {Object.values(AuditSeverity).map(severity => (
                    <MenuItem key={severity} value={severity}>
                      <Checkbox checked={exportForm.severities.includes(severity)} />
                      <ListItemText primary={severity} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportForm.encryptionEnabled}
                      onChange={(e) => setExportForm(prev => ({ ...prev, encryptionEnabled: e.target.checked }))}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <LockIcon fontSize="small" />
                      Enable Encryption
                    </Box>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportForm.compressionEnabled}
                      onChange={(e) => setExportForm(prev => ({ ...prev, compressionEnabled: e.target.checked }))}
                    />
                  }
                  label={
                    <Box display="flex" alignItems="center" gap={1}>
                      <CompressIcon fontSize="small" />
                      Enable Compression
                    </Box>
                  }
                />
              </FormGroup>
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info" icon={<InfoIcon />}>
                The export will be available for download for 7 days after creation. 
                {exportForm.encryptionEnabled && ' Files will be encrypted using AES-256.'}
                {exportForm.compressionEnabled && ' Files will be compressed to reduce size.'}
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateExport}
            variant="contained"
            disabled={creating}
            startIcon={creating && <CircularProgress size={16} />}
          >
            Create Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuditExportManager;