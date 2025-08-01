/**
 * Firmware Upload Dialog Component
 * Interface for uploading new firmware to the repository
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Security as SecurityIcon,
  Description as FileIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { firmwareApi } from '../../services/api/firmwareApi';

interface FirmwareUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const FirmwareUploadDialog: React.FC<FirmwareUploadDialogProps> = ({
  open,
  onClose,
  onUploadComplete,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  
  // Form fields
  const [deviceId, setDeviceId] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [version, setVersion] = useState('');
  const [priority, setPriority] = useState('normal');
  const [criticalUpdate, setCriticalUpdate] = useState(false);
  const [changelog, setChangelog] = useState('');
  
  // Validation states
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.bin', '.hex', '.fw'],
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};
    
    switch (step) {
      case 0:
        if (!file) {
          errors.file = 'Please select a firmware file';
        }
        break;
        
      case 1:
        if (!deviceId.trim()) {
          errors.deviceId = 'Device ID is required';
        }
        if (!deviceModel.trim()) {
          errors.deviceModel = 'Device model is required';
        }
        if (!version.trim()) {
          errors.version = 'Version is required';
        } else if (!/^\d+\.\d+\.\d+/.test(version)) {
          errors.version = 'Version must follow semantic versioning (e.g., 1.0.0)';
        }
        break;
        
      case 2:
        // Optional fields, no validation required
        break;
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleUpload = async () => {
    if (!file || !validateStep(1)) return;
    
    setUploading(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('device_id', deviceId);
      formData.append('device_model', deviceModel);
      formData.append('version', version);
      formData.append('update_priority', priority);
      formData.append('critical_update', criticalUpdate.toString());
      if (changelog) {
        formData.append('changelog', changelog);
      }
      
      const response = await fetch('/api/firmware/repository/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }
      
      onUploadComplete();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload firmware');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setFile(null);
    setDeviceId('');
    setDeviceModel('');
    setVersion('');
    setPriority('normal');
    setCriticalUpdate(false);
    setChangelog('');
    setValidationErrors({});
    setError('');
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const steps = [
    'Select Firmware File',
    'Device Information',
    'Update Details',
    'Review & Upload',
  ];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Upload Firmware</DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Stepper activeStep={activeStep} orientation="vertical">
          <Step>
            <StepLabel>Select Firmware File</StepLabel>
            <StepContent>
              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.400',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                  mb: 2,
                }}
              >
                <input {...getInputProps()} />
                <UploadIcon sx={{ fontSize: 48, color: 'grey.500', mb: 2 }} />
                <Typography variant="body1" gutterBottom>
                  {isDragActive
                    ? 'Drop the firmware file here'
                    : 'Drag and drop firmware file here, or click to select'}
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  Supported formats: .bin, .hex, .fw (max 50MB)
                </Typography>
              </Box>
              
              {file && (
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <FileIcon color="primary" />
                    <Box flex={1}>
                      <Typography variant="body2">{file.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {formatBytes(file.size)}
                      </Typography>
                    </Box>
                    <CheckIcon color="success" />
                  </Box>
                </Paper>
              )}
              
              {validationErrors.file && (
                <Typography color="error" variant="caption">
                  {validationErrors.file}
                </Typography>
              )}
              
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleNext} variant="contained" disabled={!file}>
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>Device Information</StepLabel>
            <StepContent>
              <TextField
                fullWidth
                label="Device ID"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                margin="normal"
                required
                error={!!validationErrors.deviceId}
                helperText={validationErrors.deviceId || 'Unique identifier for the device'}
              />
              
              <TextField
                fullWidth
                label="Device Model"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                margin="normal"
                required
                error={!!validationErrors.deviceModel}
                helperText={validationErrors.deviceModel || 'Model name of the device'}
              />
              
              <TextField
                fullWidth
                label="Firmware Version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                margin="normal"
                required
                error={!!validationErrors.version}
                helperText={validationErrors.version || 'Semantic version (e.g., 1.0.0)'}
                placeholder="1.0.0"
              />
              
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleBack}>Back</Button>
                <Button onClick={handleNext} variant="contained" sx={{ ml: 1 }}>
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>Update Details</StepLabel>
            <StepContent>
              <FormControl fullWidth margin="normal">
                <InputLabel>Update Priority</InputLabel>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  label="Update Priority"
                >
                  <MenuItem value="optional">Optional</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={criticalUpdate}
                    onChange={(e) => setCriticalUpdate(e.target.checked)}
                    color="error"
                  />
                }
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <SecurityIcon color={criticalUpdate ? 'error' : 'inherit'} />
                    <Typography>Mark as Critical Security Update</Typography>
                  </Box>
                }
                sx={{ mt: 2 }}
              />
              
              <TextField
                fullWidth
                label="Changelog"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                margin="normal"
                multiline
                rows={4}
                helperText="Describe what's new in this version"
              />
              
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleBack}>Back</Button>
                <Button onClick={handleNext} variant="contained" sx={{ ml: 1 }}>
                  Next
                </Button>
              </Box>
            </StepContent>
          </Step>
          
          <Step>
            <StepLabel>Review & Upload</StepLabel>
            <StepContent>
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>
                  Upload Summary
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <FileIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="File"
                      secondary={`${file?.name} (${file ? formatBytes(file.size) : ''})`}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Device"
                      secondary={`${deviceId} - ${deviceModel}`}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Version"
                      secondary={version}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Priority"
                      secondary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {priority.toUpperCase()}
                          {criticalUpdate && (
                            <SecurityIcon color="error" fontSize="small" />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </List>
              </Paper>
              
              {uploading && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    Uploading firmware...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}
              
              <Box sx={{ mt: 2 }}>
                <Button onClick={handleBack} disabled={uploading}>
                  Back
                </Button>
                <Button
                  onClick={handleUpload}
                  variant="contained"
                  sx={{ ml: 1 }}
                  disabled={uploading}
                  startIcon={<UploadIcon />}
                >
                  Upload Firmware
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={uploading}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FirmwareUploadDialog;