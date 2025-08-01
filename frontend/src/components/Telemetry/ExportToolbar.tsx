/**
 * ExportToolbar - UI component for chart and dashboard export functionality
 * Provides format selection, quality controls, and export progress tracking
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  FormControlLabel,
  Switch,
  Slider,
  Typography,
  CircularProgress,
  Alert,
  Stack,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemSecondaryAction,
  Collapse,
  Snackbar
} from '@mui/material';
import {
  Download,
  Image,
  PictureAsPdf,
  Code,
  TableChart,
  Settings,
  ExpandMore,
  ExpandLess,
  Check,
  Error as ErrorIcon,
  Info,
  Close,
  CloudDownload,
  Description,
  PhotoCamera,
  InsertDriveFile,
  History,
  Delete
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { ChartExportService, ChartExportOptions } from '../../services/export/ChartExportService';
import { DashboardExportService, DashboardExportOptions } from '../../services/export/DashboardExportService';

/**
 * Export toolbar props
 */
export interface ExportToolbarProps {
  exportTarget: 'chart' | 'dashboard';
  chartElement?: HTMLCanvasElement | SVGElement | null;
  dashboardElement?: HTMLElement | null;
  charts?: Map<string, HTMLCanvasElement | SVGElement>;
  dashboardConfig?: any;
  onExportStart?: () => void;
  onExportComplete?: (result: any) => void;
  onExportError?: (error: Error) => void;
}

/**
 * Export history item
 */
interface ExportHistoryItem {
  id: string;
  filename: string;
  format: string;
  size: number;
  timestamp: Date;
  status: 'success' | 'error';
  error?: string;
}

/**
 * Styled components
 */
const ExportButton = styled(Button)(({ theme }) => ({
  minWidth: 120
}));

const OptionSection = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(3)
}));

const QualitySlider = styled(Slider)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(2)
}));

const HistoryItem = styled(ListItem)(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  }
}));

const ProgressOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  zIndex: 1
}));

/**
 * Format icons mapping
 */
const formatIcons: Record<string, React.ReactElement> = {
  png: <Image />,
  svg: <Code />,
  pdf: <PictureAsPdf />,
  json: <Description />,
  csv: <TableChart />,
  config: <Settings />,
  template: <InsertDriveFile />
};

/**
 * ExportToolbar component
 */
export const ExportToolbar: React.FC<ExportToolbarProps> = ({
  exportTarget,
  chartElement,
  dashboardElement,
  charts,
  dashboardConfig,
  onExportStart,
  onExportComplete,
  onExportError
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string>('png');
  const [showHistory, setShowHistory] = useState(false);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Export options state
  const [options, setOptions] = useState<ChartExportOptions & DashboardExportOptions>({
    format: 'png',
    quality: 0.95,
    resolution: 150,
    includeAnnotations: true,
    includeTitle: true,
    includeLegend: true,
    dataRange: 'visible',
    includeData: true,
    includeLayout: true,
    includeStyles: true,
    combineCharts: false,
    pageSize: 'A4',
    orientation: 'landscape',
    metadata: {
      title: '',
      description: '',
      author: '',
      timestamp: new Date()
    }
  });

  const chartExportService = ChartExportService.getInstance();
  const dashboardExportService = DashboardExportService.getInstance();

  // Available formats based on export target
  const availableFormats = exportTarget === 'chart' 
    ? ['png', 'svg', 'pdf', 'json', 'csv']
    : ['config', 'template', 'pdf', 'png'];

  /**
   * Handle format selection
   */
  const handleFormatSelect = (format: string) => {
    setSelectedFormat(format);
    setOptions(prev => ({ ...prev, format: format as any }));
    setAnchorEl(null);
    setDialogOpen(true);
  };

  /**
   * Handle option change
   */
  const handleOptionChange = (key: string, value: any) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  /**
   * Handle metadata change
   */
  const handleMetadataChange = (key: string, value: string) => {
    setOptions(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value
      }
    }));
  };

  /**
   * Perform export
   */
  const performExport = async () => {
    setExporting(true);
    onExportStart?.();

    try {
      let result: any;
      let blob: Blob;
      let filename: string;

      if (exportTarget === 'chart' && chartElement) {
        // Chart export
        if (selectedFormat === 'png' || selectedFormat === 'svg') {
          blob = await chartExportService.exportAsImage(chartElement, options);
          filename = options.filename || 
            chartExportService.generateFilename('chart', selectedFormat);
        } else if (selectedFormat === 'pdf') {
          blob = await chartExportService.exportAsPDF(chartElement, options);
          filename = options.filename || 
            chartExportService.generateFilename('chart', 'pdf');
        } else if (selectedFormat === 'json' || selectedFormat === 'csv') {
          // Mock data export - in real implementation, this would come from chart data
          const mockData = {
            metadata: {
              chartType: 'line',
              exportDate: new Date(),
              dataRange: { start: new Date(), end: new Date() },
              series: ['Series 1', 'Series 2']
            },
            data: Array.from({ length: 100 }, (_, i) => ({
              timestamp: Date.now() - i * 1000,
              'Series 1': Math.random() * 100,
              'Series 2': Math.random() * 50
            }))
          };
          
          blob = await chartExportService.exportData(
            mockData,
            selectedFormat as 'json' | 'csv'
          );
          filename = options.filename || 
            chartExportService.generateFilename('chart-data', selectedFormat);
        } else {
          throw new Error('Unsupported format');
        }

        // Download file
        chartExportService.downloadFile(blob, filename);
        result = { blob, filename, format: selectedFormat };

      } else if (exportTarget === 'dashboard') {
        // Dashboard export
        if (selectedFormat === 'config' && dashboardConfig) {
          result = await dashboardExportService.exportConfiguration(
            dashboardConfig,
            options
          );
        } else if (selectedFormat === 'template' && dashboardConfig) {
          result = await dashboardExportService.exportAsTemplate(
            dashboardConfig,
            {
              name: options.metadata?.title || 'Custom Dashboard',
              description: options.metadata?.description || '',
              category: 'custom'
            },
            options
          );
        } else if (selectedFormat === 'pdf' && dashboardElement && charts) {
          result = await dashboardExportService.exportAsPDF(
            dashboardElement,
            charts,
            options
          );
        } else if (selectedFormat === 'png' && dashboardElement && charts) {
          result = await dashboardExportService.exportAsImage(
            dashboardElement,
            charts,
            options
          );
        } else {
          throw new Error('Invalid export configuration');
        }

        // Download file
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        link.click();
        URL.revokeObjectURL(url);
      }

      // Add to history
      const historyItem: ExportHistoryItem = {
        id: Date.now().toString(),
        filename: result?.filename || 'export',
        format: selectedFormat,
        size: result?.blob?.size || 0,
        timestamp: new Date(),
        status: 'success'
      };
      setExportHistory(prev => [historyItem, ...prev.slice(0, 9)]);

      // Show success message
      setSnackbar({
        open: true,
        message: `Export completed successfully`,
        severity: 'success'
      });

      onExportComplete?.(result);
      setDialogOpen(false);

    } catch (error) {
      console.error('Export error:', error);
      
      // Add to history with error
      const historyItem: ExportHistoryItem = {
        id: Date.now().toString(),
        filename: 'failed-export',
        format: selectedFormat,
        size: 0,
        timestamp: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      setExportHistory(prev => [historyItem, ...prev.slice(0, 9)]);

      // Show error message
      setSnackbar({
        open: true,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });

      onExportError?.(error instanceof Error ? error : new Error('Export failed'));
    } finally {
      setExporting(false);
    }
  };

  /**
   * Clear export history
   */
  const clearHistory = () => {
    setExportHistory([]);
  };

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        <ExportButton
          variant="outlined"
          startIcon={<Download />}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          Export
        </ExportButton>
        
        {exportHistory.length > 0 && (
          <Tooltip title="Export History">
            <IconButton
              size="small"
              onClick={() => setShowHistory(!showHistory)}
            >
              <Badge badgeContent={exportHistory.length} color="primary">
                <History />
              </Badge>
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {/* Format selection menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem disabled>
          <Typography variant="subtitle2">Select Export Format</Typography>
        </MenuItem>
        <Divider />
        {availableFormats.map(format => (
          <MenuItem
            key={format}
            onClick={() => handleFormatSelect(format)}
          >
            <ListItemIcon>{formatIcons[format]}</ListItemIcon>
            <ListItemText
              primary={format.toUpperCase()}
              secondary={
                format === 'png' ? 'Raster Image' :
                format === 'svg' ? 'Vector Graphics' :
                format === 'pdf' ? 'Document' :
                format === 'json' ? 'Data (JSON)' :
                format === 'csv' ? 'Data (CSV)' :
                format === 'config' ? 'Configuration' :
                format === 'template' ? 'Dashboard Template' :
                ''
              }
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Export options dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Export {exportTarget === 'chart' ? 'Chart' : 'Dashboard'} as {selectedFormat.toUpperCase()}
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {/* Metadata section */}
            <OptionSection>
              <Typography variant="subtitle2" gutterBottom>
                Metadata
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Title"
                  value={options.metadata?.title || ''}
                  onChange={(e) => handleMetadataChange('title', e.target.value)}
                  fullWidth
                  size="small"
                />
                <TextField
                  label="Description"
                  value={options.metadata?.description || ''}
                  onChange={(e) => handleMetadataChange('description', e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                />
                <TextField
                  label="Author"
                  value={options.metadata?.author || ''}
                  onChange={(e) => handleMetadataChange('author', e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
            </OptionSection>

            {/* Format-specific options */}
            {(selectedFormat === 'png' || selectedFormat === 'pdf') && (
              <OptionSection>
                <Typography variant="subtitle2" gutterBottom>
                  Image Quality
                </Typography>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Quality: {Math.round(options.quality! * 100)}%
                  </Typography>
                  <QualitySlider
                    value={options.quality}
                    onChange={(_, value) => handleOptionChange('quality', value)}
                    min={0.1}
                    max={1}
                    step={0.05}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Resolution: {options.resolution} DPI
                  </Typography>
                  <QualitySlider
                    value={options.resolution}
                    onChange={(_, value) => handleOptionChange('resolution', value)}
                    min={72}
                    max={300}
                    step={1}
                  />
                </Box>
              </OptionSection>
            )}

            {selectedFormat === 'pdf' && (
              <OptionSection>
                <Typography variant="subtitle2" gutterBottom>
                  PDF Options
                </Typography>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Page Size</InputLabel>
                    <Select
                      value={options.pageSize || 'A4'}
                      onChange={(e: SelectChangeEvent) => 
                        handleOptionChange('pageSize', e.target.value)
                      }
                      label="Page Size"
                    >
                      <MenuItem value="A4">A4</MenuItem>
                      <MenuItem value="Letter">Letter</MenuItem>
                      <MenuItem value="Custom">Custom</MenuItem>
                    </Select>
                  </FormControl>
                  
                  <FormControl size="small" fullWidth>
                    <InputLabel>Orientation</InputLabel>
                    <Select
                      value={options.orientation || 'landscape'}
                      onChange={(e: SelectChangeEvent) => 
                        handleOptionChange('orientation', e.target.value)
                      }
                      label="Orientation"
                    >
                      <MenuItem value="portrait">Portrait</MenuItem>
                      <MenuItem value="landscape">Landscape</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
              </OptionSection>
            )}

            {exportTarget === 'chart' && (
              <OptionSection>
                <Typography variant="subtitle2" gutterBottom>
                  Chart Options
                </Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={options.includeAnnotations || false}
                        onChange={(e) => handleOptionChange('includeAnnotations', e.target.checked)}
                      />
                    }
                    label="Include Annotations"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={options.includeTitle || false}
                        onChange={(e) => handleOptionChange('includeTitle', e.target.checked)}
                      />
                    }
                    label="Include Title"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={options.includeLegend || false}
                        onChange={(e) => handleOptionChange('includeLegend', e.target.checked)}
                      />
                    }
                    label="Include Legend"
                  />
                </Stack>
              </OptionSection>
            )}

            {exportTarget === 'dashboard' && selectedFormat === 'png' && (
              <OptionSection>
                <Typography variant="subtitle2" gutterBottom>
                  Dashboard Options
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.combineCharts || false}
                      onChange={(e) => handleOptionChange('combineCharts', e.target.checked)}
                    />
                  }
                  label="Combine Charts in Grid"
                />
              </OptionSection>
            )}
          </Stack>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={performExport}
            disabled={exporting}
            startIcon={exporting ? <CircularProgress size={20} /> : <Download />}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogActions>

        {exporting && (
          <ProgressOverlay>
            <Stack spacing={2} alignItems="center">
              <CircularProgress />
              <Typography>Preparing export...</Typography>
            </Stack>
          </ProgressOverlay>
        )}
      </Dialog>

      {/* Export history */}
      <Collapse in={showHistory}>
        <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle2">Export History</Typography>
            <IconButton size="small" onClick={clearHistory}>
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
          
          <List dense>
            {exportHistory.map(item => (
              <HistoryItem key={item.id} disablePadding>
                <ListItemIcon>
                  {item.status === 'success' ? (
                    <Check color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.filename}
                  secondary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        label={item.format.toUpperCase()}
                        size="small"
                        icon={formatIcons[item.format]}
                      />
                      <Typography variant="caption">
                        {formatFileSize(item.size)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Stack>
                  }
                />
                {item.error && (
                  <ListItemSecondaryAction>
                    <Tooltip title={item.error}>
                      <IconButton edge="end" size="small">
                        <Info fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                )}
              </HistoryItem>
            ))}
          </List>
        </Paper>
      </Collapse>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ExportToolbar;