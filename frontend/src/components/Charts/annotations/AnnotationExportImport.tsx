/**
 * Annotation Export/Import Component
 * Handles bulk export and import of annotations in various formats
 */

import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Typography,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Paper,
  Divider,
  Grid,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  FileDownload as ExportIcon,
  FileUpload as ImportIcon,
  Description as FileIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import {
  EnhancedAnnotation,
  AnnotationExportFormat,
  EnhancedAnnotationExportOptions,
  AnnotationImportOptions
} from '../../../types/enterprise-annotations';
import useAnnotationStore from '../../../stores/annotationStore';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AnnotationExportImportProps {
  chartId?: string;
  selectedAnnotations?: string[];
  onComplete?: () => void;
}

export const AnnotationExportImport: React.FC<AnnotationExportImportProps> = ({
  chartId,
  selectedAnnotations = [],
  onComplete
}) => {
  const { annotations, addAnnotation, batchUpdateAnnotations } = useAnnotationStore();
  
  const [mode, setMode] = useState<'export' | 'import'>('export');
  const [exportOptions, setExportOptions] = useState<EnhancedAnnotationExportOptions>({
    format: 'json',
    includeHistory: false,
    includeAuditTrail: false,
    includeAttachments: false,
    annotations: selectedAnnotations
  });
  const [importOptions, setImportOptions] = useState<AnnotationImportOptions>({
    format: 'json',
    mergeStrategy: 'merge',
    validatePermissions: true
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Array<{
    type: 'success' | 'error' | 'warning';
    message: string;
  }>>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAnnotationsToExport = (): EnhancedAnnotation[] => {
    const annotationIds = exportOptions.annotations?.length 
      ? exportOptions.annotations 
      : Array.from(annotations.keys());
      
    return annotationIds
      .map(id => annotations.get(id))
      .filter((a): a is EnhancedAnnotation => a !== undefined)
      .filter(a => !chartId || a.chartId === chartId);
  };

  const handleExport = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    
    try {
      const annotationsToExport = getAnnotationsToExport();
      setProgress(20);
      
      switch (exportOptions.format) {
        case 'json':
          await exportJSON(annotationsToExport);
          break;
        case 'csv':
          await exportCSV(annotationsToExport);
          break;
        case 'xlsx':
          await exportXLSX(annotationsToExport);
          break;
        case 'pdf':
          await exportPDF(annotationsToExport);
          break;
      }
      
      setProgress(100);
      setResults([{
        type: 'success',
        message: `Successfully exported ${annotationsToExport.length} annotations`
      }]);
      
      if (onComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (error) {
      setResults([{
        type: 'error',
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportJSON = async (annotations: EnhancedAnnotation[]) => {
    const exportData = {
      version: '1.0',
      exportDate: Date.now(),
      annotations: annotations.map(a => ({
        ...a,
        versionHistory: exportOptions.includeHistory ? a.versionHistory : undefined,
        auditTrail: exportOptions.includeAuditTrail ? a.auditTrail : undefined,
        attachments: exportOptions.includeAttachments ? a.attachments : undefined
      })),
      metadata: {
        chartId,
        totalCount: annotations.length,
        exportedBy: 'current-user', // Replace with actual user
        options: exportOptions
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    saveAs(blob, `annotations-export-${format(Date.now(), 'yyyyMMdd-HHmmss')}.json`);
  };

  const exportCSV = async (annotations: EnhancedAnnotation[]) => {
    const headers = [
      'ID', 'Type', 'Title', 'Text', 'X', 'Y', 'Chart ID', 
      'Created By', 'Created At', 'Updated By', 'Updated At',
      'Version', 'Tags', 'Severity'
    ];
    
    const rows = annotations.map(a => [
      a.id,
      a.type,
      a.title || '',
      a.text || '',
      a.x,
      a.y,
      a.chartId,
      a.createdBy,
      format(a.createdAt, 'yyyy-MM-dd HH:mm:ss'),
      a.updatedBy,
      format(a.updatedAt, 'yyyy-MM-dd HH:mm:ss'),
      a.version,
      a.tags?.join(';') || '',
      a.severity || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    saveAs(blob, `annotations-export-${format(Date.now(), 'yyyyMMdd-HHmmss')}.csv`);
  };

  const exportXLSX = async (annotations: EnhancedAnnotation[]) => {
    const workbook = XLSX.utils.book_new();
    
    // Main annotations sheet
    const annotationData = annotations.map(a => ({
      ID: a.id,
      Type: a.type,
      Title: a.title || '',
      Text: a.text || '',
      'X Position': a.x,
      'Y Position': a.y,
      'Chart ID': a.chartId,
      'Created By': a.createdBy,
      'Created At': format(a.createdAt, 'yyyy-MM-dd HH:mm:ss'),
      'Updated By': a.updatedBy,
      'Updated At': format(a.updatedAt, 'yyyy-MM-dd HH:mm:ss'),
      Version: a.version,
      Tags: a.tags?.join(';') || '',
      Severity: a.severity || ''
    }));
    
    const annotationSheet = XLSX.utils.json_to_sheet(annotationData);
    XLSX.utils.book_append_sheet(workbook, annotationSheet, 'Annotations');
    
    // Version history sheet
    if (exportOptions.includeHistory) {
      const versionData: any[] = [];
      annotations.forEach(a => {
        a.versionHistory?.forEach(v => {
          versionData.push({
            'Annotation ID': a.id,
            'Version': v.version,
            'Timestamp': format(v.timestamp, 'yyyy-MM-dd HH:mm:ss'),
            'User ID': v.userId,
            'User Name': v.userName,
            'Comment': v.comment || '',
            'Changes': v.changes.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; ')
          });
        });
      });
      
      if (versionData.length > 0) {
        const versionSheet = XLSX.utils.json_to_sheet(versionData);
        XLSX.utils.book_append_sheet(workbook, versionSheet, 'Version History');
      }
    }
    
    const xlsxBlob = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([xlsxBlob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `annotations-export-${format(Date.now(), 'yyyyMMdd-HHmmss')}.xlsx`);
  };

  const exportPDF = async (annotations: EnhancedAnnotation[]) => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Annotation Export Report', 14, 20);
    
    // Metadata
    doc.setFontSize(10);
    doc.text(`Export Date: ${format(Date.now(), 'MMMM d, yyyy HH:mm')}`, 14, 30);
    doc.text(`Total Annotations: ${annotations.length}`, 14, 36);
    if (chartId) {
      doc.text(`Chart ID: ${chartId}`, 14, 42);
    }
    
    // Table data
    const tableData = annotations.map(a => [
      a.type,
      a.title || a.text || 'No content',
      a.createdBy,
      format(a.createdAt, 'MM/dd/yyyy'),
      a.version.toString(),
      a.severity || 'N/A'
    ]);
    
    // @ts-ignore - jspdf-autotable types issue
    doc.autoTable({
      head: [['Type', 'Content', 'Created By', 'Date', 'Version', 'Severity']],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 150, 243] }
    });
    
    doc.save(`annotations-export-${format(Date.now(), 'yyyyMMdd-HHmmss')}.pdf`);
  };

  const handleImport = async () => {
    if (!importFile) {
      setResults([{
        type: 'error',
        message: 'Please select a file to import'
      }]);
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    setResults([]);
    
    try {
      const content = await readFileContent(importFile);
      setProgress(30);
      
      let importedAnnotations: EnhancedAnnotation[] = [];
      
      switch (importOptions.format) {
        case 'json':
          importedAnnotations = await parseJSON(content);
          break;
        case 'csv':
          importedAnnotations = await parseCSV(content);
          break;
      }
      
      setProgress(60);
      
      // Process imported annotations
      const results = await processImportedAnnotations(importedAnnotations);
      
      setProgress(100);
      setResults(results);
      
      if (onComplete && results.some(r => r.type === 'success')) {
        setTimeout(onComplete, 1500);
      }
    } catch (error) {
      setResults([{
        type: 'error',
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const parseJSON = async (content: string): Promise<EnhancedAnnotation[]> => {
    const data = JSON.parse(content);
    
    if (!data.annotations || !Array.isArray(data.annotations)) {
      throw new Error('Invalid JSON format: missing annotations array');
    }
    
    return data.annotations;
  };

  const parseCSV = async (content: string): Promise<EnhancedAnnotation[]> => {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const annotations: EnhancedAnnotation[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const annotation: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index];
        
        switch (header.toLowerCase()) {
          case 'id':
            annotation.id = value;
            break;
          case 'type':
            annotation.type = value;
            break;
          case 'title':
            annotation.title = value;
            break;
          case 'text':
            annotation.text = value;
            break;
          case 'x':
          case 'x position':
            annotation.x = parseFloat(value);
            break;
          case 'y':
          case 'y position':
            annotation.y = parseFloat(value);
            break;
          case 'chart id':
            annotation.chartId = value;
            break;
          case 'created by':
            annotation.createdBy = value;
            break;
          case 'tags':
            annotation.tags = value ? value.split(';') : [];
            break;
          case 'severity':
            annotation.severity = value;
            break;
        }
      });
      
      // Set defaults for required fields
      annotation.version = 1;
      annotation.createdAt = Date.now();
      annotation.updatedAt = Date.now();
      annotation.updatedBy = annotation.createdBy || 'imported';
      
      annotations.push(annotation as EnhancedAnnotation);
    }
    
    return annotations;
  };

  const processImportedAnnotations = async (
    importedAnnotations: EnhancedAnnotation[]
  ): Promise<Array<{ type: 'success' | 'error' | 'warning'; message: string }>> => {
    const results: Array<{ type: 'success' | 'error' | 'warning'; message: string }> = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const annotation of importedAnnotations) {
      try {
        const existingAnnotation = annotations.get(annotation.id);
        
        if (existingAnnotation) {
          switch (importOptions.mergeStrategy) {
            case 'replace':
              addAnnotation(annotation);
              successCount++;
              break;
              
            case 'merge':
              const merged = {
                ...existingAnnotation,
                ...annotation,
                version: existingAnnotation.version + 1,
                updatedAt: Date.now()
              };
              addAnnotation(merged);
              successCount++;
              break;
              
            case 'skip':
              skipCount++;
              break;
          }
        } else {
          // New annotation
          if (chartId) {
            annotation.chartId = chartId;
          }
          addAnnotation(annotation);
          successCount++;
        }
      } catch (error) {
        errorCount++;
        results.push({
          type: 'error',
          message: `Failed to import annotation ${annotation.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    if (successCount > 0) {
      results.unshift({
        type: 'success',
        message: `Successfully imported ${successCount} annotations`
      });
    }
    
    if (skipCount > 0) {
      results.push({
        type: 'warning',
        message: `Skipped ${skipCount} existing annotations`
      });
    }
    
    if (errorCount > 0) {
      results.push({
        type: 'error',
        message: `Failed to import ${errorCount} annotations`
      });
    }
    
    return results;
  };

  return (
    <Box sx={{ p: 2 }}>
      {/* Mode Selection */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant={mode === 'export' ? 'contained' : 'outlined'}
          startIcon={<ExportIcon />}
          onClick={() => setMode('export')}
          fullWidth
        >
          Export Annotations
        </Button>
        <Button
          variant={mode === 'import' ? 'contained' : 'outlined'}
          startIcon={<ImportIcon />}
          onClick={() => setMode('import')}
          fullWidth
        >
          Import Annotations
        </Button>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Export Options */}
      {mode === 'export' && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Export Options
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl component="fieldset">
                <Typography variant="subtitle2" gutterBottom>
                  Format
                </Typography>
                <RadioGroup
                  value={exportOptions.format}
                  onChange={(e) => setExportOptions({
                    ...exportOptions,
                    format: e.target.value as AnnotationExportFormat
                  })}
                >
                  <FormControlLabel 
                    value="json" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">JSON</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Complete data with all metadata
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="csv" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">CSV</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Spreadsheet compatible, basic data only
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="xlsx" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">Excel (XLSX)</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Multiple sheets with full data
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel 
                    value="pdf" 
                    control={<Radio />} 
                    label={
                      <Box>
                        <Typography variant="body2">PDF Report</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Formatted report for sharing
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>
            </Grid>
            
            {(exportOptions.format === 'json' || exportOptions.format === 'xlsx') && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Include Additional Data
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.includeHistory}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        includeHistory: e.target.checked
                      })}
                    />
                  }
                  label="Version History"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.includeAuditTrail}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        includeAuditTrail: e.target.checked
                      })}
                    />
                  }
                  label="Audit Trail"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.includeAttachments}
                      onChange={(e) => setExportOptions({
                        ...exportOptions,
                        includeAttachments: e.target.checked
                      })}
                    />
                  }
                  label="Attachments"
                />
              </Grid>
            )}
            
            <Grid item xs={12}>
              <Alert severity="info">
                {selectedAnnotations.length > 0
                  ? `Exporting ${selectedAnnotations.length} selected annotations`
                  : `Exporting all ${getAnnotationsToExport().length} annotations`}
              </Alert>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Import Options */}
      {mode === 'import' && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Import Options
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv"
                style={{ display: 'none' }}
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImportIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1">
                  Click to select file
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Supported formats: JSON, CSV
                </Typography>
              </Paper>
              
              {importFile && (
                <Chip
                  label={importFile.name}
                  onDelete={() => setImportFile(null)}
                  sx={{ mt: 1 }}
                />
              )}
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Merge Strategy</InputLabel>
                <Select
                  value={importOptions.mergeStrategy}
                  onChange={(e) => setImportOptions({
                    ...importOptions,
                    mergeStrategy: e.target.value as 'replace' | 'merge' | 'skip'
                  })}
                >
                  <MenuItem value="replace">Replace existing</MenuItem>
                  <MenuItem value="merge">Merge with existing</MenuItem>
                  <MenuItem value="skip">Skip existing</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={importOptions.validatePermissions}
                    onChange={(e) => setImportOptions({
                      ...importOptions,
                      validatePermissions: e.target.checked
                    })}
                  />
                }
                label="Validate permissions"
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Progress */}
      {isProcessing && (
        <Box sx={{ mt: 3 }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {mode === 'export' ? 'Exporting...' : 'Importing...'} {progress}%
          </Typography>
        </Box>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Results
          </Typography>
          <List>
            {results.map((result, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {result.type === 'success' && <SuccessIcon color="success" />}
                  {result.type === 'error' && <ErrorIcon color="error" />}
                  {result.type === 'warning' && <WarningIcon color="warning" />}
                </ListItemIcon>
                <ListItemText primary={result.message} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onComplete}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={mode === 'export' ? handleExport : handleImport}
          disabled={isProcessing || (mode === 'import' && !importFile)}
          startIcon={mode === 'export' ? <ExportIcon /> : <ImportIcon />}
        >
          {mode === 'export' ? 'Export' : 'Import'}
        </Button>
      </Box>
    </Box>
  );
};

export default AnnotationExportImport;