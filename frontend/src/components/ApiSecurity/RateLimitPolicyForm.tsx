import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  InputAdornment,
  Alert,
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { RateLimitPolicy, rateLimitService } from '../../services/rateLimitService';
import { useSnackbar } from 'notistack';

interface RateLimitPolicyFormProps {
  open: boolean;
  policy: RateLimitPolicy | null;
  onClose: () => void;
  onSave: () => void;
}

export const RateLimitPolicyForm: React.FC<RateLimitPolicyFormProps> = ({
  open,
  policy,
  onClose,
  onSave
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<RateLimitPolicy>>({
    name: '',
    description: '',
    targetType: 'global',
    targetValue: '',
    window: 'minute',
    limit: 60,
    burstEnabled: false,
    burstLimit: 10,
    burstWindowSeconds: 60,
    customErrorMessage: '',
    customHeaders: {},
    excludePatterns: [],
    includePatterns: [],
    methodSpecific: {},
    priority: 0,
    isActive: true
  });

  const [newExcludePattern, setNewExcludePattern] = useState('');
  const [newIncludePattern, setNewIncludePattern] = useState('');
  const [newHeaderKey, setNewHeaderKey] = useState('');
  const [newHeaderValue, setNewHeaderValue] = useState('');
  const [newMethodLimit, setNewMethodLimit] = useState({ method: '', limit: 0 });

  useEffect(() => {
    if (policy) {
      setFormData(policy);
    }
  }, [policy]);

  const handleChange = (field: keyof RateLimitPolicy, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddExcludePattern = () => {
    if (newExcludePattern) {
      setFormData(prev => ({
        ...prev,
        excludePatterns: [...(prev.excludePatterns || []), newExcludePattern]
      }));
      setNewExcludePattern('');
    }
  };

  const handleRemoveExcludePattern = (index: number) => {
    setFormData(prev => ({
      ...prev,
      excludePatterns: prev.excludePatterns?.filter((_, i) => i !== index) || []
    }));
  };

  const handleAddIncludePattern = () => {
    if (newIncludePattern) {
      setFormData(prev => ({
        ...prev,
        includePatterns: [...(prev.includePatterns || []), newIncludePattern]
      }));
      setNewIncludePattern('');
    }
  };

  const handleRemoveIncludePattern = (index: number) => {
    setFormData(prev => ({
      ...prev,
      includePatterns: prev.includePatterns?.filter((_, i) => i !== index) || []
    }));
  };

  const handleAddHeader = () => {
    if (newHeaderKey && newHeaderValue) {
      setFormData(prev => ({
        ...prev,
        customHeaders: {
          ...prev.customHeaders,
          [newHeaderKey]: newHeaderValue
        }
      }));
      setNewHeaderKey('');
      setNewHeaderValue('');
    }
  };

  const handleRemoveHeader = (key: string) => {
    setFormData(prev => {
      const headers = { ...prev.customHeaders };
      delete headers[key];
      return { ...prev, customHeaders: headers };
    });
  };

  const handleAddMethodLimit = () => {
    if (newMethodLimit.method && newMethodLimit.limit > 0) {
      setFormData(prev => ({
        ...prev,
        methodSpecific: {
          ...prev.methodSpecific,
          [newMethodLimit.method]: newMethodLimit.limit
        }
      }));
      setNewMethodLimit({ method: '', limit: 0 });
    }
  };

  const handleRemoveMethodLimit = (method: string) => {
    setFormData(prev => {
      const limits = { ...prev.methodSpecific };
      delete limits[method];
      return { ...prev, methodSpecific: limits };
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.limit) {
      enqueueSnackbar('Please fill in required fields', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      if (policy) {
        await rateLimitService.updatePolicy(policy.id, formData);
        enqueueSnackbar('Rate limit policy updated successfully', { variant: 'success' });
      } else {
        await rateLimitService.createPolicy(formData);
        enqueueSnackbar('Rate limit policy created successfully', { variant: 'success' });
      }
      onSave();
    } catch (error: any) {
      enqueueSnackbar(
        error.response?.data?.detail || 'Failed to save policy',
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {policy ? 'Edit Rate Limit Policy' : 'Create Rate Limit Policy'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Policy Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={2}
              />
            </Grid>

            {/* Target Configuration */}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Target Type</InputLabel>
                <Select
                  value={formData.targetType}
                  onChange={(e) => handleChange('targetType', e.target.value)}
                  label="Target Type"
                >
                  <MenuItem value="global">Global (All Requests)</MenuItem>
                  <MenuItem value="api_key">Specific API Key</MenuItem>
                  <MenuItem value="user">Specific User</MenuItem>
                  <MenuItem value="endpoint">Endpoint Pattern</MenuItem>
                  <MenuItem value="ip_address">IP Address/Range</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Target Value"
                value={formData.targetValue || ''}
                onChange={(e) => handleChange('targetValue', e.target.value)}
                disabled={formData.targetType === 'global'}
                placeholder={
                  formData.targetType === 'api_key' ? 'API Key ID' :
                  formData.targetType === 'user' ? 'User ID' :
                  formData.targetType === 'endpoint' ? '/api/users/*' :
                  formData.targetType === 'ip_address' ? '192.168.1.0/24' :
                  ''
                }
              />
            </Grid>

            {/* Rate Limit Configuration */}
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Time Window</InputLabel>
                <Select
                  value={formData.window}
                  onChange={(e) => handleChange('window', e.target.value)}
                  label="Time Window"
                >
                  <MenuItem value="minute">Per Minute</MenuItem>
                  <MenuItem value="hour">Per Hour</MenuItem>
                  <MenuItem value="day">Per Day</MenuItem>
                  <MenuItem value="week">Per Week</MenuItem>
                  <MenuItem value="month">Per Month</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Request Limit"
                value={formData.limit}
                onChange={(e) => handleChange('limit', parseInt(e.target.value))}
                InputProps={{
                  inputProps: { min: 1 }
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Priority"
                value={formData.priority}
                onChange={(e) => handleChange('priority', parseInt(e.target.value))}
                InputProps={{
                  inputProps: { min: 0, max: 1000 }
                }}
                helperText="Higher = evaluated first"
              />
            </Grid>            {/* Status */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => handleChange('isActive', e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Advanced Options */}
            <Grid item xs={12}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Burst Configuration</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={formData.burstEnabled}
                            onChange={(e) => handleChange('burstEnabled', e.target.checked)}
                          />
                        }
                        label="Enable Burst Handling"
                      />
                    </Grid>
                    {formData.burstEnabled && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Burst Limit"
                            value={formData.burstLimit}
                            onChange={(e) => handleChange('burstLimit', parseInt(e.target.value))}
                            InputProps={{
                              inputProps: { min: 1 }
                            }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            type="number"
                            label="Burst Window (seconds)"
                            value={formData.burstWindowSeconds}
                            onChange={(e) => handleChange('burstWindowSeconds', parseInt(e.target.value))}
                            InputProps={{
                              inputProps: { min: 1 }
                            }}
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Endpoint Patterns</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="body2" gutterBottom>
                        Exclude Patterns (Rate limit won't apply to these)
                      </Typography>
                      <Box display="flex" gap={1} mb={2}>
                        <TextField
                          size="small"
                          placeholder="/api/health/*"
                          value={newExcludePattern}
                          onChange={(e) => setNewExcludePattern(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddExcludePattern()}
                          sx={{ flex: 1 }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleAddExcludePattern}
                          startIcon={<AddIcon />}
                        >
                          Add
                        </Button>
                      </Box>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {formData.excludePatterns?.map((pattern, index) => (
                          <Chip
                            key={index}
                            label={pattern}
                            onDelete={() => handleRemoveExcludePattern(index)}
                            size="small"
                          />
                        ))}
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Typography variant="body2" gutterBottom>
                        Include Patterns (Rate limit only applies to these)
                      </Typography>
                      <Box display="flex" gap={1} mb={2}>
                        <TextField
                          size="small"
                          placeholder="/api/users/*"
                          value={newIncludePattern}
                          onChange={(e) => setNewIncludePattern(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddIncludePattern()}
                          sx={{ flex: 1 }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleAddIncludePattern}
                          startIcon={<AddIcon />}
                        >
                          Add
                        </Button>
                      </Box>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {formData.includePatterns?.map((pattern, index) => (
                          <Chip
                            key={index}
                            label={pattern}
                            onDelete={() => handleRemoveIncludePattern(index)}
                            size="small"
                          />
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Method-Specific Limits</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Box display="flex" gap={1} mb={2}>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Method</InputLabel>
                          <Select
                            value={newMethodLimit.method}
                            onChange={(e) => setNewMethodLimit({ ...newMethodLimit, method: e.target.value })}
                            label="Method"
                          >
                            <MenuItem value="GET">GET</MenuItem>
                            <MenuItem value="POST">POST</MenuItem>
                            <MenuItem value="PUT">PUT</MenuItem>
                            <MenuItem value="DELETE">DELETE</MenuItem>
                            <MenuItem value="PATCH">PATCH</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          type="number"
                          label="Limit"
                          value={newMethodLimit.limit}
                          onChange={(e) => setNewMethodLimit({ ...newMethodLimit, limit: parseInt(e.target.value) })}
                          sx={{ width: 120 }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleAddMethodLimit}
                          startIcon={<AddIcon />}
                        >
                          Add
                        </Button>
                      </Box>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {Object.entries(formData.methodSpecific || {}).map(([method, limit]) => (
                          <Chip
                            key={method}
                            label={`${method}: ${limit}`}
                            onDelete={() => handleRemoveMethodLimit(method)}
                            size="small"
                          />
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Custom Response</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Custom Error Message"
                        value={formData.customErrorMessage || ''}
                        onChange={(e) => handleChange('customErrorMessage', e.target.value)}
                        placeholder="API rate limit exceeded. Please try again later."
                        multiline
                        rows={2}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" gutterBottom>
                        Custom Headers
                      </Typography>
                      <Box display="flex" gap={1} mb={2}>
                        <TextField
                          size="small"
                          placeholder="Header Key"
                          value={newHeaderKey}
                          onChange={(e) => setNewHeaderKey(e.target.value)}
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          size="small"
                          placeholder="Header Value"
                          value={newHeaderValue}
                          onChange={(e) => setNewHeaderValue(e.target.value)}
                          sx={{ flex: 1 }}
                        />
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleAddHeader}
                          startIcon={<AddIcon />}
                        >
                          Add
                        </Button>
                      </Box>
                      <Box display="flex" flexWrap="wrap" gap={1}>
                        {Object.entries(formData.customHeaders || {}).map(([key, value]) => (
                          <Chip
                            key={key}
                            label={`${key}: ${value}`}
                            onDelete={() => handleRemoveHeader(key)}
                            size="small"
                          />
                        ))}
                      </Box>
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>

            {/* Info Alert */}
            <Grid item xs={12}>
              <Alert severity="info" icon={<InfoIcon />}>
                Rate limit policies are evaluated in priority order (highest first). 
                The first matching policy will be applied to the request.
              </Alert>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading}
        >
          {loading ? 'Saving...' : (policy ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};