import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Box,
  Typography,
  Grid,
  Alert,
  Divider,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
  Upload as UploadIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { VersioningService } from '../../../services/versioningService';
import { APIVersion, VersionStatus, VersionFormData } from '../../../types/versioning';

interface Props {
  version?: APIVersion | null;
  mode: 'create' | 'edit' | 'view';
  onSave: () => void;
  onCancel: () => void;
}

const VersionForm: React.FC<Props> = ({ version, mode, onSave, onCancel }) => {
  const [formData, setFormData] = useState<VersionFormData>({
    version: '',
    title: '',
    description: '',
    status: VersionStatus.DRAFT,
    releaseDate: new Date().toISOString(),
    isDefault: false,
    breakingChanges: [],
    features: [],
    compatibleVersions: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBreakingChange, setNewBreakingChange] = useState('');
  const [newFeature, setNewFeature] = useState('');
  const [newCompatibleVersion, setNewCompatibleVersion] = useState('');
  const [apiSpecFile, setApiSpecFile] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (version && (mode === 'edit' || mode === 'view')) {
      setFormData({
        version: version.version,
        title: version.title,
        description: version.description || '',
        status: version.status,
        releaseDate: version.releaseDate,
        deprecationDate: version.deprecationDate,
        eolDate: version.eolDate,
        isDefault: version.isDefault,
        breakingChanges: [...version.breakingChanges],
        features: [...version.features],
        compatibleVersions: [...version.compatibleVersions],
        apiSpec: version.apiSpec,
      });
    }
  }, [version, mode]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.version) {
      errors.version = 'Version is required';
    } else if (!/^\d+\.\d+(\.\d+)?$/.test(formData.version)) {
      errors.version = 'Version must follow semantic versioning (e.g., 1.0.0)';
    }

    if (!formData.title) {
      errors.title = 'Title is required';
    }

    if (!formData.releaseDate) {
      errors.releaseDate = 'Release date is required';
    }

    if (formData.deprecationDate && formData.eolDate) {
      if (new Date(formData.deprecationDate) >= new Date(formData.eolDate)) {
        errors.eolDate = 'End of life date must be after deprecation date';
      }
    }

    if (new Date(formData.releaseDate) > new Date()) {
      // Allow future release dates but warn
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mode === 'create') {
        const response = await VersioningService.createVersion(formData);
        if (!response.success) {
          setError(response.message || 'Failed to create version');
          return;
        }
      } else if (mode === 'edit' && version) {
        const response = await VersioningService.updateVersion(version.id, formData);
        if (!response.success) {
          setError(response.message || 'Failed to update version');
          return;
        }
      }

      onSave();
    } catch (err) {
      console.error('Error saving version:', err);
      setError('Failed to save version');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof VersionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const addBreakingChange = () => {
    if (newBreakingChange.trim()) {
      setFormData(prev => ({
        ...prev,
        breakingChanges: [...prev.breakingChanges, newBreakingChange.trim()],
      }));
      setNewBreakingChange('');
    }
  };

  const removeBreakingChange = (index: number) => {
    setFormData(prev => ({
      ...prev,
      breakingChanges: prev.breakingChanges.filter((_, i) => i !== index),
    }));
  };

  const addFeature = () => {
    if (newFeature.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()],
      }));
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const addCompatibleVersion = () => {
    if (newCompatibleVersion.trim()) {
      setFormData(prev => ({
        ...prev,
        compatibleVersions: [...prev.compatibleVersions, newCompatibleVersion.trim()],
      }));
      setNewCompatibleVersion('');
    }
  };

  const removeCompatibleVersion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      compatibleVersions: prev.compatibleVersions.filter((_, i) => i !== index),
    }));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setApiSpecFile(file);
      // In a real implementation, you might want to parse and preview the spec
    }
  };

  const isReadOnly = mode === 'view';

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DialogTitle>
        {mode === 'create' && 'Create New API Version'}
        {mode === 'edit' && `Edit Version ${version?.version}`}
        {mode === 'view' && `View Version ${version?.version}`}
      </DialogTitle>

      <DialogContent dividers sx={{ minHeight: 600, maxHeight: '80vh' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Version"
              value={formData.version}
              onChange={(e) => handleInputChange('version', e.target.value)}
              error={!!validationErrors.version}
              helperText={validationErrors.version || 'Use semantic versioning (e.g., 1.0.0)'}
              disabled={isReadOnly}
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                label="Status"
                disabled={isReadOnly}
              >
                {Object.values(VersionStatus).map((status) => (
                  <MenuItem key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              error={!!validationErrors.title}
              helperText={validationErrors.title}
              disabled={isReadOnly}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              multiline
              rows={3}
              disabled={isReadOnly}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <DateTimePicker
              label="Release Date"
              value={new Date(formData.releaseDate)}
              onChange={(date) => handleInputChange('releaseDate', date?.toISOString())}
              disabled={isReadOnly}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!validationErrors.releaseDate,
                  helperText: validationErrors.releaseDate,
                  required: true,
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isDefault}
                  onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                  disabled={isReadOnly}
                />
              }
              label="Set as Default Version"
            />
          </Grid>

          {/* Lifecycle Dates */}
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Lifecycle Management
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <DateTimePicker
              label="Deprecation Date (Optional)"
              value={formData.deprecationDate ? new Date(formData.deprecationDate) : null}
              onChange={(date) => handleInputChange('deprecationDate', date?.toISOString())}
              disabled={isReadOnly}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: 'When this version will be deprecated',
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <DateTimePicker
              label="End of Life Date (Optional)"
              value={formData.eolDate ? new Date(formData.eolDate) : null}
              onChange={(date) => handleInputChange('eolDate', date?.toISOString())}
              disabled={isReadOnly}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!validationErrors.eolDate,
                  helperText: validationErrors.eolDate || 'When this version will be retired',
                }
              }}
            />
          </Grid>

          {/* Advanced Configuration */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Advanced Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  {/* Breaking Changes */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Breaking Changes
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <TextField
                        fullWidth
                        label="Add breaking change"
                        value={newBreakingChange}
                        onChange={(e) => setNewBreakingChange(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addBreakingChange()}
                        disabled={isReadOnly}
                        size="small"
                      />
                      <Button
                        onClick={addBreakingChange}
                        disabled={!newBreakingChange.trim() || isReadOnly}
                        startIcon={<AddIcon />}
                      >
                        Add
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {formData.breakingChanges.map((change, index) => (
                        <Chip
                          key={index}
                          label={change}
                          onDelete={isReadOnly ? undefined : () => removeBreakingChange(index)}
                          color="warning"
                        />
                      ))}
                    </Box>
                  </Grid>

                  {/* Features */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      New Features
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <TextField
                        fullWidth
                        label="Add feature"
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                        disabled={isReadOnly}
                        size="small"
                      />
                      <Button
                        onClick={addFeature}
                        disabled={!newFeature.trim() || isReadOnly}
                        startIcon={<AddIcon />}
                      >
                        Add
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {formData.features.map((feature, index) => (
                        <Chip
                          key={index}
                          label={feature}
                          onDelete={isReadOnly ? undefined : () => removeFeature(index)}
                          color="success"
                        />
                      ))}
                    </Box>
                  </Grid>

                  {/* Compatible Versions */}
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      Compatible Versions
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <TextField
                        fullWidth
                        label="Add compatible version"
                        value={newCompatibleVersion}
                        onChange={(e) => setNewCompatibleVersion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCompatibleVersion()}
                        disabled={isReadOnly}
                        size="small"
                      />
                      <Button
                        onClick={addCompatibleVersion}
                        disabled={!newCompatibleVersion.trim() || isReadOnly}
                        startIcon={<AddIcon />}
                      >
                        Add
                      </Button>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {formData.compatibleVersions.map((version, index) => (
                        <Chip
                          key={index}
                          label={version}
                          onDelete={isReadOnly ? undefined : () => removeCompatibleVersion(index)}
                          color="info"
                        />
                      ))}
                    </Box>
                  </Grid>

                  {/* API Specification Upload */}
                  {!isReadOnly && (
                    <Grid item xs={12}>
                      <Typography variant="subtitle1" gutterBottom>
                        API Specification
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<UploadIcon />}
                        >
                          Upload OpenAPI Spec
                          <input
                            type="file"
                            hidden
                            accept=".json,.yaml,.yml"
                            onChange={handleFileUpload}
                          />
                        </Button>
                        {apiSpecFile && (
                          <Typography variant="body2" color="textSecondary">
                            {apiSpecFile.name}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  )}

                  {/* View API Spec */}
                  {formData.apiSpec && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1">
                          API Specification
                        </Typography>
                        <Tooltip title="View Full Specification">
                          <IconButton size="small">
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      <Typography variant="body2" color="textSecondary">
                        OpenAPI specification is attached to this version
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>
          {mode === 'view' ? 'Close' : 'Cancel'}
        </Button>
        {!isReadOnly && (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : mode === 'create' ? 'Create Version' : 'Update Version'}
          </Button>
        )}
      </DialogActions>
    </LocalizationProvider>
  );
};

export default VersionForm;