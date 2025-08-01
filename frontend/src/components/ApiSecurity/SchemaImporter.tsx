import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Description as FileIcon,
  Cancel as CancelIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { SchemaImportResult } from '../../types/schema';
import schemaService from '../../services/schemaService';

interface SchemaImporterProps {
  onImportSuccess: (result: SchemaImportResult) => void;
  onCancel: () => void;
}

const SchemaImporter: React.FC<SchemaImporterProps> = ({ onImportSuccess, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [namespace, setNamespace] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<SchemaImportResult | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      setImportResult(null);
      setValidationErrors([]);
      
      // Read file content for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setPreviewContent(content);
        validateFileContent(content, file.name);
      };
      reader.readAsText(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
      'application/x-yaml': ['.yaml', '.yml'],
      'text/yaml': ['.yaml', '.yml']
    },
    maxFiles: 1
  });

  const validateFileContent = (content: string, filename: string) => {
    const errors: string[] = [];
    
    try {
      let parsed: any;
      if (filename.endsWith('.json')) {
        parsed = JSON.parse(content);
      } else {
        // For YAML files, we'll trust the backend to parse
        return;
      }
      
      // Check for OpenAPI/Swagger structure
      if (!parsed.openapi && !parsed.swagger) {
        errors.push('File does not appear to be an OpenAPI or Swagger specification');
      }
      
      if (parsed.openapi && !parsed.openapi.startsWith('3.')) {
        errors.push('Only OpenAPI 3.x is supported');
      }
      
      if (!parsed.info?.title) {
        errors.push('Missing required field: info.title');
      }
      
      if (!parsed.info?.version) {
        errors.push('Missing required field: info.version');
      }
      
      if (!parsed.paths || Object.keys(parsed.paths).length === 0) {
        errors.push('No API paths defined');
      }
    } catch (error: any) {
      errors.push(`Invalid JSON: ${error.message}`);
    }
    
    setValidationErrors(errors);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setImportResult(null);
    
    try {
      const result = await schemaService.importOpenAPI(file, namespace);
      setImportResult(result);
      
      if (result.success) {
        setTimeout(() => {
          onImportSuccess(result);
        }, 2000);
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        errors: [error.message || 'Import failed']
      });
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPreviewContent(null);
    setValidationErrors([]);
    setImportResult(null);
  };

  const getFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Import OpenAPI/Swagger Schema
        </Typography>
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Import OpenAPI 3.x or Swagger 2.0 specifications. The importer will:
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Create schema definitions from your API specification</li>
            <li>Automatically generate endpoint mappings from paths</li>
            <li>Extract request/response schemas for validation</li>
            <li>Set up initial validation rules based on the spec</li>
          </ul>
        </Alert>

        {!file && (
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s'
            }}
          >
            <input {...getInputProps()} />
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              {isDragActive ? 'Drop the file here' : 'Drag & drop OpenAPI/Swagger file here'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              or
            </Typography>
            <Button variant="outlined" startIcon={<UploadIcon />}>
              Browse Files
            </Button>
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 2 }}>
              Supported formats: JSON (.json), YAML (.yaml, .yml)
            </Typography>
          </Box>
        )}

        {file && (
          <Box>
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={2}>
                  <FileIcon color="primary" />
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {getFileSize(file.size)}
                    </Typography>
                  </Box>
                </Box>
                <Tooltip title="Remove file">
                  <IconButton onClick={handleRemoveFile} size="small">
                    <CancelIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>

            {validationErrors.length > 0 && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Validation Warnings:
                </Typography>
                <List dense>
                  {validationErrors.map((error, index) => (
                    <ListItem key={index} disableGutters>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <WarningIcon fontSize="small" color="warning" />
                      </ListItemIcon>
                      <ListItemText primary={error} />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            <TextField
              label="Namespace (optional)"
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
              fullWidth
              sx={{ mb: 3 }}
              helperText="Group imported schemas under a namespace"
            />

            {previewContent && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>
                  File Preview (first 500 characters):
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
                    {previewContent.substring(0, 500)}
                    {previewContent.length > 500 && '...'}
                  </pre>
                </Paper>
              </Box>
            )}
          </Box>
        )}

        {importing && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" gutterBottom>
              Importing schema...
            </Typography>
            <LinearProgress />
          </Box>
        )}

        {importResult && (
          <Alert 
            severity={importResult.success ? 'success' : 'error'} 
            sx={{ mb: 3 }}
          >
            {importResult.success ? (
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Import Successful!
                </Typography>
                <Typography variant="body2">
                  Schema ID: {importResult.schemaId}
                </Typography>
                {importResult.endpoints && importResult.endpoints.length > 0 && (
                  <Typography variant="body2">
                    Created {importResult.endpoints.length} endpoint mappings
                  </Typography>
                )}
                {importResult.warnings && importResult.warnings.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="warning.main">
                      Warnings:
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {importResult.warnings.map((warning, index) => (
                        <li key={index}>
                          <Typography variant="caption">{warning}</Typography>
                        </li>
                      ))}
                    </ul>
                  </Box>
                )}
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Import Failed
                </Typography>
                {importResult.errors?.map((error, index) => (
                  <Typography key={index} variant="body2">
                    • {error}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<UploadIcon />}
            onClick={handleImport}
            disabled={!file || importing || (importResult?.success ?? false)}
          >
            Import Schema
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SchemaImporter;