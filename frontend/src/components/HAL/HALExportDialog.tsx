import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Radio,
  RadioGroup,
  TextField,
  Box,
  Typography,
  Chip,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  Grid,
  Paper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close,
  Download,
  Description,
  DeviceHub,
  Timeline,
  BugReport,
  Settings,
  DateRange,
  FilterList,
  CheckCircle,
  Warning,
  Info,
  FolderZip,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useHALContext } from './HALContext';
import { HALExportOptions } from './types';

interface ExportPreview {
  devices: number;
  activities: number;
  diagnostics: number;
  estimatedSize: string;
}

interface HALExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export const HALExportDialog: React.FC<HALExportDialogProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();
  const { devices, activities, exportData, filter, permissions } = useHALContext();

  const [exportOptions, setExportOptions] = useState<HALExportOptions>({
    format: 'json',
    includeDevices: true,
    includeActivities: true,
    includeDiagnostics: true,
    includeConfiguration: false,
    dateRange: undefined,
    filters: filter,
  });

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [useDateRange, setUseDateRange] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Calculate export preview
  React.useEffect(() => {
    const calculatePreview = () => {
      let deviceCount = devices.length;
      let activityCount = activities.length;
      let diagnosticCount = 0; // Would need to fetch from context

      // Apply filters
      if (exportOptions.filters) {
        // Filter devices based on filters
        if (exportOptions.filters.protocols?.length) {
          deviceCount = devices.filter(d => 
            exportOptions.filters!.protocols!.includes(d.protocol)
          ).length;
        }
      }

      // Apply date range
      if (useDateRange && startDate && endDate) {
        activityCount = activities.filter(a => {
          const activityDate = new Date(a.timestamp);
          return activityDate >= startDate && activityDate <= endDate;
        }).length;
      }

      // Estimate size
      let estimatedBytes = 0;
      if (exportOptions.includeDevices) {
        estimatedBytes += deviceCount * 2048; // ~2KB per device
      }
      if (exportOptions.includeActivities) {
        estimatedBytes += activityCount * 512; // ~512B per activity
      }
      if (exportOptions.includeDiagnostics) {
        estimatedBytes += diagnosticCount * 4096; // ~4KB per diagnostic
      }
      if (exportOptions.includeConfiguration) {
        estimatedBytes += 10240; // ~10KB for config
      }

      // Add overhead for different formats
      switch (exportOptions.format) {
        case 'excel':
          estimatedBytes *= 1.5;
          break;
        case 'pdf':
          estimatedBytes *= 2;
          break;
        case 'csv':
          estimatedBytes *= 0.8;
          break;
      }

      const estimatedSize = formatFileSize(estimatedBytes);

      setPreview({
        devices: exportOptions.includeDevices ? deviceCount : 0,
        activities: exportOptions.includeActivities ? activityCount : 0,
        diagnostics: exportOptions.includeDiagnostics ? diagnosticCount : 0,
        estimatedSize,
      });
    };

    calculatePreview();
  }, [devices, activities, exportOptions, useDateRange, startDate, endDate]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);
    setExportProgress(0);

    try {
      // Update export options with date range
      const finalOptions = {
        ...exportOptions,
        dateRange: useDateRange && startDate && endDate
          ? { start: startDate, end: endDate }
          : undefined,
      };

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const blob = await exportData(finalOptions);
      
      clearInterval(progressInterval);
      setExportProgress(100);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = exportOptions.format === 'excel' ? 'xlsx' : exportOptions.format;
      a.download = `hal-export-${timestamp}.${extension}`;
      
      a.click();
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Export failed:', error);
      setExportError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (!isExporting) {
      onClose();
      // Reset state after close
      setTimeout(() => {
        setExportError(null);
        setExportSuccess(false);
        setExportProgress(0);
      }, 300);
    }
  };

  const formatIcons = {
    json: <Description />,
    csv: <Description />,
    excel: <Description />,
    pdf: <Description />,
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Download />
            <Typography variant="h6">Export HAL Data</Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={isExporting}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {exportError && (
          <Alert severity="error" onClose={() => setExportError(null)} sx={{ mb: 2 }}>
            {exportError}
          </Alert>
        )}

        {exportSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Export completed successfully!
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Format Selection */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Export Format
            </Typography>
            <RadioGroup
              value={exportOptions.format}
              onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as any })}
              row
            >
              <Grid container spacing={2}>
                {(['json', 'csv', 'excel', 'pdf'] as const).map(format => (
                  <Grid item xs={6} sm={3} key={format}>
                    <Paper
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: 2,
                        borderColor: exportOptions.format === format 
                          ? theme.palette.primary.main 
                          : 'transparent',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                        },
                      }}
                      onClick={() => setExportOptions({ ...exportOptions, format })}
                    >
                      <FormControlLabel
                        value={format}
                        control={<Radio />}
                        label={
                          <Box sx={{ textAlign: 'center' }}>
                            {formatIcons[format]}
                            <Typography variant="body2">
                              {format.toUpperCase()}
                            </Typography>
                          </Box>
                        }
                        sx={{ margin: 0, width: '100%' }}
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </RadioGroup>
          </Grid>

          {/* Data Selection */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom>
              Data to Export
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <Checkbox
                    checked={exportOptions.includeDevices}
                    onChange={(e) => setExportOptions({ 
                      ...exportOptions, 
                      includeDevices: e.target.checked 
                    })}
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Devices"
                  secondary={`${preview?.devices || 0} devices`}
                />
                <DeviceHub color="action" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Checkbox
                    checked={exportOptions.includeActivities}
                    onChange={(e) => setExportOptions({ 
                      ...exportOptions, 
                      includeActivities: e.target.checked 
                    })}
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Activity Logs"
                  secondary={`${preview?.activities || 0} activities`}
                />
                <Timeline color="action" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Checkbox
                    checked={exportOptions.includeDiagnostics}
                    onChange={(e) => setExportOptions({ 
                      ...exportOptions, 
                      includeDiagnostics: e.target.checked 
                    })}
                  />
                </ListItemIcon>
                <ListItemText
                  primary="Diagnostic Results"
                  secondary={`${preview?.diagnostics || 0} results`}
                />
                <BugReport color="action" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <Checkbox
                    checked={exportOptions.includeConfiguration}
                    onChange={(e) => setExportOptions({ 
                      ...exportOptions, 
                      includeConfiguration: e.target.checked 
                    })}
                  />
                </ListItemIcon>
                <ListItemText
                  primary="System Configuration"
                  secondary="Current settings and preferences"
                />
                <Settings color="action" />
              </ListItem>
            </List>
          </Grid>

          {/* Date Range Filter */}
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={useDateRange}
                  onChange={(e) => setUseDateRange(e.target.checked)}
                />
              }
              label="Filter by Date Range"
            />
            {useDateRange && (
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <DateTimePicker
                    label="Start Date"
                    value={startDate}
                    onChange={(date) => setStartDate(date)}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                  <DateTimePicker
                    label="End Date"
                    value={endDate}
                    onChange={(date) => setEndDate(date)}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </Box>
              </LocalizationProvider>
            )}
          </Grid>

          {/* Active Filters Display */}
          {filter && Object.keys(filter).length > 0 && (
            <Grid item xs={12}>
              <Alert severity="info" icon={<FilterList />}>
                <Typography variant="body2">
                  Active filters will be applied to the export
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {filter.protocols?.map(p => (
                    <Chip key={p} label={p.toUpperCase()} size="small" />
                  ))}
                  {filter.types?.map(t => (
                    <Chip key={t} label={t} size="small" />
                  ))}
                  {filter.statuses?.map(s => (
                    <Chip key={s} label={s} size="small" />
                  ))}
                </Box>
              </Alert>
            </Grid>
          )}

          {/* Export Preview */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <Typography variant="subtitle2" gutterBottom>
                Export Preview
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2">
                    Estimated Size: <strong>{preview?.estimatedSize}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {preview?.devices || 0} devices, {preview?.activities || 0} activities, 
                    {preview?.diagnostics || 0} diagnostics
                  </Typography>
                </Box>
                {exportOptions.format === 'json' && (
                  <Chip
                    icon={<FolderZip />}
                    label="Will be compressed"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Export Progress */}
        {isExporting && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Exporting data...
            </Typography>
            <LinearProgress variant="determinate" value={exportProgress} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={
            isExporting || 
            !permissions.canExportData ||
            (!exportOptions.includeDevices && 
             !exportOptions.includeActivities && 
             !exportOptions.includeDiagnostics && 
             !exportOptions.includeConfiguration)
          }
          startIcon={isExporting ? null : <Download />}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HALExportDialog;