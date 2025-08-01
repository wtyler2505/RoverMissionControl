/**
 * ExportDialog - Main export configuration interface
 * Provides comprehensive UI for configuring and initiating telemetry data exports
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Checkbox,
  FormControlLabel,
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  Alert,
  CircularProgress,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
  Switch,
  Slider,
  useTheme,
  FormHelperText,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
  Close as CloseIcon,
  FileDownload as FileDownloadIcon,
  Assessment as ReportIcon,
  TableChart as TableIcon,
  PictureAsPdf as PDFIcon,
  Description as ExcelIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  ExportConfig,
  ExportFormat,
  ExportDataSource,
  ExportProgress,
  ExportResult,
  StreamSelection,
  ExportUtils
} from '../../services/export';

/**
 * Export dialog props
 */
export interface ExportDialogProps {
  /** Dialog open state */
  open: boolean;
  /** Available streams for selection */
  streams: Array<{
    id: string;
    name: string;
    unit?: string;
    sampleRate: number;
    dataPoints: number;
  }>;
  /** Initial export configuration */
  initialConfig?: Partial<ExportConfig>;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when export is initiated */
  onExport: (config: ExportConfig) => Promise<string>;
  /** Current export progress (if any) */
  exportProgress?: ExportProgress;
  /** Export result (when completed) */
  exportResult?: ExportResult;
}

/**
 * Export dialog step
 */
type ExportStep = 'format' | 'data' | 'options' | 'review' | 'progress';

/**
 * Format icon mapping
 */
const FORMAT_ICONS: Record<ExportFormat, React.ReactElement> = {
  csv: <TableIcon />,
  json: <FileDownloadIcon />,
  pdf: <PDFIcon />,
  xlsx: <ExcelIcon />,
  png: <ReportIcon />,
  svg: <ReportIcon />
};

/**
 * Main export dialog component
 */
export const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  streams,
  initialConfig,
  onClose,
  onExport,
  exportProgress,
  exportResult
}) => {
  const theme = useTheme();
  
  // State management
  const [currentStep, setCurrentStep] = useState<ExportStep>('format');
  const [config, setConfig] = useState<ExportConfig>(() => ({
    format: 'csv',
    dataSource: 'raw-telemetry',
    streams: {
      streamIds: [],
      includeAll: true
    },
    includeMetadata: true,
    includeAnalysis: false,
    includeCorrelations: false,
    formatOptions: ExportUtils.getDefaultConfig('csv'),
    filename: ExportUtils.generateFilename({})
  }));
  
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [estimatedFileSize, setEstimatedFileSize] = useState<number>(0);

  // Step definitions
  const steps = [
    { key: 'format', label: 'Format' },
    { key: 'data', label: 'Data Selection' },
    { key: 'options', label: 'Options' },
    { key: 'review', label: 'Review' },
    { key: 'progress', label: 'Export' }
  ];

  // Initialize config with initial values
  useEffect(() => {
    if (initialConfig) {
      setConfig(prev => ({
        ...prev,
        ...initialConfig,
        formatOptions: {
          ...ExportUtils.getDefaultConfig(initialConfig.format || 'csv'),
          ...initialConfig.formatOptions
        }
      }));
    }
  }, [initialConfig]);

  // Update estimated file size when configuration changes
  useEffect(() => {
    const selectedStreamCount = config.streams.includeAll ? 
      streams.length : 
      config.streams.streamIds.length;
    
    const totalDataPoints = config.streams.includeAll ?
      streams.reduce((sum, stream) => sum + stream.dataPoints, 0) :
      streams.filter(s => config.streams.streamIds.includes(s.id))
        .reduce((sum, stream) => sum + stream.dataPoints, 0);

    const size = ExportUtils.estimateFileSize(
      selectedStreamCount,
      totalDataPoints,
      config.format,
      config.includeAnalysis,
      config.includeCorrelations
    );

    setEstimatedFileSize(size);
  }, [config, streams]);

  // Update progress step
  useEffect(() => {
    if (exportProgress && currentStep !== 'progress') {
      setCurrentStep('progress');
    }
  }, [exportProgress, currentStep]);

  // Validate current configuration
  const validate = useCallback(() => {
    const errors: string[] = [];

    // Validate filename
    if (!ExportUtils.validateFilename(config.filename)) {
      errors.push('Invalid filename. Avoid special characters.');
    }

    // Validate stream selection
    if (!config.streams.includeAll && config.streams.streamIds.length === 0) {
      errors.push('Please select at least one stream to export.');
    }

    // Validate time range
    if (config.timeRange) {
      if (config.timeRange.start >= config.timeRange.end) {
        errors.push('End time must be after start time.');
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [config]);

  // Handle step navigation
  const handleNext = useCallback(() => {
    if (!validate()) return;

    const currentIndex = steps.findIndex(step => step.key === currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key as ExportStep);
    }
  }, [currentStep, validate]);

  const handleBack = useCallback(() => {
    const currentIndex = steps.findIndex(step => step.key === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key as ExportStep);
    }
  }, [currentStep]);

  // Handle export initiation
  const handleExport = useCallback(async () => {
    if (!validate()) return;

    try {
      setIsExporting(true);
      const jobId = await onExport(config);
      setCurrentStep('progress');
    } catch (error) {
      console.error('Export failed:', error);
      setValidationErrors([`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setIsExporting(false);
    }
  }, [config, onExport, validate]);

  // Handle configuration updates
  const updateConfig = useCallback((updates: Partial<ExportConfig>) => {
    setConfig(prev => ({
      ...prev,
      ...updates,
      // Update format options when format changes
      ...(updates.format && updates.format !== prev.format ? {
        formatOptions: ExportUtils.getDefaultConfig(updates.format)
      } : {})
    }));
  }, []);

  // Selected streams for display
  const selectedStreams = useMemo(() => {
    return config.streams.includeAll ? 
      streams : 
      streams.filter(stream => config.streams.streamIds.includes(stream.id));
  }, [config.streams, streams]);

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'format':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Choose Export Format
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select the format for your exported data. Each format has different capabilities and use cases.
            </Typography>
            
            <Grid container spacing={2}>
              {(['csv', 'json', 'pdf', 'xlsx'] as ExportFormat[]).map(format => (
                <Grid item xs={12} sm={6} key={format}>
                  <Box
                    onClick={() => updateConfig({ format })}
                    sx={{
                      p: 2,
                      border: `2px solid ${config.format === format ? theme.palette.primary.main : theme.palette.divider}`,
                      borderRadius: 2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      bgcolor: config.format === format ? theme.palette.primary.main + '0A' : 'transparent',
                      '&:hover': {
                        bgcolor: theme.palette.action.hover
                      }
                    }}
                  >
                    {FORMAT_ICONS[format]}
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {format.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {format === 'csv' && 'Comma-separated values for analysis'}
                        {format === 'json' && 'Structured data with metadata'}
                        {format === 'pdf' && 'Professional reports with charts'}
                        {format === 'xlsx' && 'Excel workbooks with formatting'}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Estimated File Size: {ExportUtils.formatFileSize(estimatedFileSize)}
              </Typography>
            </Box>
          </Box>
        );

      case 'data':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Select Data to Export
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.streams.includeAll}
                  onChange={(e) => updateConfig({
                    streams: {
                      ...config.streams,
                      includeAll: e.target.checked
                    }
                  })}
                />
              }
              label="Include All Streams"
              sx={{ mb: 2 }}
            />
            
            {!config.streams.includeAll && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Select Streams ({config.streams.streamIds.length} selected)
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {streams.map(stream => (
                    <ListItem key={stream.id}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={config.streams.streamIds.includes(stream.id)}
                            onChange={(e) => {
                              const streamIds = e.target.checked ?
                                [...config.streams.streamIds, stream.id] :
                                config.streams.streamIds.filter(id => id !== stream.id);
                              
                              updateConfig({
                                streams: {
                                  ...config.streams,
                                  streamIds
                                }
                              });
                            }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2">{stream.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {stream.dataPoints} points • {stream.sampleRate}Hz
                              {stream.unit && ` • ${stream.unit}`}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom>
              Additional Data
            </Typography>
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeAnalysis}
                  onChange={(e) => updateConfig({ includeAnalysis: e.target.checked })}
                />
              }
              label="Include Statistical Analysis"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeCorrelations}
                  onChange={(e) => updateConfig({ includeCorrelations: e.target.checked })}
                />
              }
              label="Include Correlation Analysis"
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.includeMetadata}
                  onChange={(e) => updateConfig({ includeMetadata: e.target.checked })}
                />
              }
              label="Include Export Metadata"
            />
          </Box>
        );

      case 'options':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Export Options
            </Typography>
            
            <TextField
              fullWidth
              label="Filename"
              value={config.filename}
              onChange={(e) => updateConfig({ filename: e.target.value })}
              sx={{ mb: 3 }}
              helperText="File extension will be added automatically"
            />

            {/* Format-specific options */}
            {config.format === 'csv' && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>CSV Options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Delimiter</InputLabel>
                        <Select
                          value={config.formatOptions.csv?.delimiter || ','}
                          onChange={(e) => updateConfig({
                            formatOptions: {
                              ...config.formatOptions,
                              csv: {
                                ...config.formatOptions.csv,
                                delimiter: e.target.value as ',' | ';' | '\t'
                              }
                            }
                          })}
                        >
                          <MenuItem value=",">Comma (,)</MenuItem>
                          <MenuItem value=";">Semicolon (;)</MenuItem>
                          <MenuItem value="\t">Tab</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Number Precision"
                        type="number"
                        value={config.formatOptions.csv?.precision || 6}
                        onChange={(e) => updateConfig({
                          formatOptions: {
                            ...config.formatOptions,
                            csv: {
                              ...config.formatOptions.csv,
                              precision: parseInt(e.target.value)
                            }
                          }
                        })}
                        inputProps={{ min: 0, max: 15 }}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={config.formatOptions.csv?.includeHeaders !== false}
                            onChange={(e) => updateConfig({
                              formatOptions: {
                                ...config.formatOptions,
                                csv: {
                                  ...config.formatOptions.csv,
                                  includeHeaders: e.target.checked
                                }
                              }
                            })}
                          />
                        }
                        label="Include Column Headers"
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            )}

            {config.format === 'json' && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>JSON Options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.formatOptions.json?.prettyPrint !== false}
                        onChange={(e) => updateConfig({
                          formatOptions: {
                            ...config.formatOptions,
                            json: {
                              ...config.formatOptions.json,
                              prettyPrint: e.target.checked
                            }
                          }
                        })}
                      />
                    }
                    label="Pretty Print (formatted with indentation)"
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.formatOptions.json?.includeSchema === true}
                        onChange={(e) => updateConfig({
                          formatOptions: {
                            ...config.formatOptions,
                            json: {
                              ...config.formatOptions.json,
                              includeSchema: e.target.checked
                            }
                          }
                        })}
                      />
                    }
                    label="Include JSON Schema"
                  />
                </AccordionDetails>
              </Accordion>
            )}

            {config.format === 'pdf' && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>PDF Options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Orientation</InputLabel>
                        <Select
                          value={config.formatOptions.pdf?.orientation || 'portrait'}
                          onChange={(e) => updateConfig({
                            formatOptions: {
                              ...config.formatOptions,
                              pdf: {
                                ...config.formatOptions.pdf,
                                orientation: e.target.value as 'portrait' | 'landscape'
                              }
                            }
                          })}
                        >
                          <MenuItem value="portrait">Portrait</MenuItem>
                          <MenuItem value="landscape">Landscape</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>Page Size</InputLabel>
                        <Select
                          value={config.formatOptions.pdf?.pageSize || 'A4'}
                          onChange={(e) => updateConfig({
                            formatOptions: {
                              ...config.formatOptions,
                              pdf: {
                                ...config.formatOptions.pdf,
                                pageSize: e.target.value as 'A4' | 'Letter' | 'Legal'
                              }
                            }
                          })}
                        >
                          <MenuItem value="A4">A4</MenuItem>
                          <MenuItem value="Letter">Letter</MenuItem>
                          <MenuItem value="Legal">Legal</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Report Title"
                        value={config.formatOptions.pdf?.title || ''}
                        onChange={(e) => updateConfig({
                          formatOptions: {
                            ...config.formatOptions,
                            pdf: {
                              ...config.formatOptions.pdf,
                              title: e.target.value
                            }
                          }
                        })}
                      />
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            )}

            {config.format === 'xlsx' && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Excel Options</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.formatOptions.xlsx?.separateSheets !== false}
                        onChange={(e) => updateConfig({
                          formatOptions: {
                            ...config.formatOptions,
                            xlsx: {
                              ...config.formatOptions.xlsx,
                              separateSheets: e.target.checked
                            }
                          }
                        })}
                      />
                    }
                    label="Create Separate Sheets for Different Data Types"
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={config.formatOptions.xlsx?.applyFormatting !== false}
                        onChange={(e) => updateConfig({
                          formatOptions: {
                            ...config.formatOptions,
                            xlsx: {
                              ...config.formatOptions.xlsx,
                              applyFormatting: e.target.checked
                            }
                          }
                        })}
                      />
                    }
                    label="Apply Formatting and Styling"
                  />
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        );

      case 'review':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Review Export Configuration
            </Typography>
            
            <List>
              <ListItem>
                <ListItemText
                  primary="Format"
                  secondary={config.format.toUpperCase()}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Streams"
                  secondary={config.streams.includeAll ? 
                    `All streams (${streams.length})` : 
                    `${config.streams.streamIds.length} selected`
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Data Points"
                  secondary={selectedStreams.reduce((sum, s) => sum + s.dataPoints, 0).toLocaleString()}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Additional Data"
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      {config.includeAnalysis && <Chip label="Analysis" size="small" />}
                      {config.includeCorrelations && <Chip label="Correlations" size="small" />}
                      {config.includeMetadata && <Chip label="Metadata" size="small" />}
                    </Box>
                  }
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Estimated File Size"
                  secondary={ExportUtils.formatFileSize(estimatedFileSize)}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Output Filename"
                  secondary={`${config.filename}.${config.format}`}
                />
              </ListItem>
            </List>
          </Box>
        );

      case 'progress':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              {exportProgress ? 'Exporting...' : exportResult ? 'Export Complete' : 'Export Started'}
            </Typography>
            
            {exportProgress && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LinearProgress 
                    variant="determinate" 
                    value={exportProgress.percentage} 
                    sx={{ flexGrow: 1, mr: 1 }} 
                  />
                  <Typography variant="body2" color="text.secondary">
                    {exportProgress.percentage.toFixed(0)}%
                  </Typography>
                </Box>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {exportProgress.currentOperation}
                </Typography>
                
                {exportProgress.itemsProcessed > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {exportProgress.itemsProcessed.toLocaleString()} of {exportProgress.totalItems.toLocaleString()} items processed
                  </Typography>
                )}
                
                {exportProgress.estimatedCompletion && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Estimated completion: {exportProgress.estimatedCompletion.toLocaleTimeString()}
                  </Typography>
                )}
              </Box>
            )}
            
            {exportResult && (
              <Box>
                {exportResult.success ? (
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Export completed successfully!
                  </Alert>
                ) : (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Export failed: {exportResult.errors?.join(', ')}
                  </Alert>
                )}
                
                {exportResult.success && exportResult.file && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Download Your Export
                    </Typography>
                    
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      href={exportResult.file.downloadUrl}
                      download={exportResult.file.filename}
                      sx={{ mb: 2 }}
                    >
                      Download {exportResult.file.filename}
                    </Button>
                    
                    <Typography variant="body2" color="text.secondary">
                      File size: {ExportUtils.formatFileSize(exportResult.file.size)}
                      <br />
                      Processing time: {(exportResult.stats.processingTime / 1000).toFixed(1)}s
                      <br />
                      Streams exported: {exportResult.stats.streamsExported}
                      <br />
                      Data points: {exportResult.stats.dataPointsExported.toLocaleString()}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  const currentStepIndex = steps.findIndex(step => step.key === currentStep);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Export Telemetry Data
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Stepper activeStep={currentStepIndex}>
            {steps.map((step) => (
              <Step key={step.key}>
                <StepLabel>{step.label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
        
        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validationErrors.map((error, index) => (
              <div key={index}>{error}</div>
            ))}
          </Alert>
        )}
        
        {renderStepContent()}
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={handleBack} 
          disabled={currentStepIndex === 0 || currentStep === 'progress'}
        >
          Back
        </Button>
        
        {currentStep !== 'progress' && currentStep !== 'review' && (
          <Button 
            onClick={handleNext}
            variant="contained"
            disabled={validationErrors.length > 0}
          >
            Next
          </Button>
        )}
        
        {currentStep === 'review' && (
          <Button 
            onClick={handleExport}
            variant="contained" 
            color="primary"
            disabled={isExporting || validationErrors.length > 0}
            startIcon={isExporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
          >
            {isExporting ? 'Starting Export...' : 'Start Export'}
          </Button>
        )}
        
        {(currentStep === 'progress' && exportResult) && (
          <Button onClick={onClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;