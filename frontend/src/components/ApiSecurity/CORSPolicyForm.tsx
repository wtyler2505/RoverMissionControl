import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Box,
  Typography,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  InputAdornment,
  Autocomplete
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { corsService } from '../../services/corsService';
import {
  CORSPolicy,
  CORSPolicyCreate,
  CORSPolicyUpdate,
  CORSPolicyType
} from '../../types/cors';

interface CORSPolicyFormProps {
  open: boolean;
  policy: CORSPolicy | null;
  onClose: () => void;
  onSave: () => void;
}

const COMMON_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
const COMMON_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'X-API-Key',
  'X-Requested-With',
  'Cache-Control',
  'X-CSRF-Token'
];

export const CORSPolicyForm: React.FC<CORSPolicyFormProps> = ({
  open,
  policy,
  onClose,
  onSave
}) => {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  
  // Form state
  const [formData, setFormData] = useState<CORSPolicyCreate>({
    name: '',
    description: '',
    policy_type: CORSPolicyType.GLOBAL,
    endpoint_pattern: '',
    api_key_id: '',
    priority: 0,
    allowed_origins: [],
    allow_all_origins: false,
    allowed_methods: ['GET', 'POST', 'OPTIONS'],
    allow_all_methods: false,
    allowed_headers: ['Authorization', 'Content-Type'],
    allow_all_headers: false,
    expose_headers: [],
    allow_credentials: false,
    max_age: 3600,
    validate_origin_regex: false,
    case_sensitive_origins: false
  });

  // Custom inputs for array fields
  const [originInput, setOriginInput] = useState('');
  const [methodInput, setMethodInput] = useState('');
  const [headerInput, setHeaderInput] = useState('');
  const [exposeHeaderInput, setExposeHeaderInput] = useState('');

  useEffect(() => {
    if (policy) {
      setFormData({
        name: policy.name,
        description: policy.description || '',
        policy_type: policy.policy_type,
        endpoint_pattern: policy.endpoint_pattern || '',
        api_key_id: policy.api_key_id || '',
        priority: policy.priority,
        allowed_origins: policy.allowed_origins || [],
        allow_all_origins: policy.allow_all_origins,
        allowed_methods: policy.allowed_methods || [],
        allow_all_methods: policy.allow_all_methods,
        allowed_headers: policy.allowed_headers || [],
        allow_all_headers: policy.allow_all_headers,
        expose_headers: policy.expose_headers || [],
        allow_credentials: policy.allow_credentials,
        max_age: policy.max_age,
        validate_origin_regex: policy.validate_origin_regex,
        case_sensitive_origins: policy.case_sensitive_origins
      });
    }
  }, [policy]);

  const handleFieldChange = (field: keyof CORSPolicyCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]); // Clear errors on change
  };

  const handleAddOrigin = () => {
    if (originInput.trim()) {
      handleFieldChange('allowed_origins', [...(formData.allowed_origins || []), originInput.trim()]);
      setOriginInput('');
    }
  };

  const handleRemoveOrigin = (index: number) => {
    const origins = [...(formData.allowed_origins || [])];
    origins.splice(index, 1);
    handleFieldChange('allowed_origins', origins);
  };

  const handleAddHeader = (type: 'allowed' | 'expose') => {
    const input = type === 'allowed' ? headerInput : exposeHeaderInput;
    const field = type === 'allowed' ? 'allowed_headers' : 'expose_headers';
    
    if (input.trim()) {
      handleFieldChange(field, [...(formData[field] || []), input.trim()]);
      if (type === 'allowed') {
        setHeaderInput('');
      } else {
        setExposeHeaderInput('');
      }
    }
  };

  const handleRemoveHeader = (type: 'allowed' | 'expose', index: number) => {
    const field = type === 'allowed' ? 'allowed_headers' : 'expose_headers';
    const headers = [...(formData[field] || [])];
    headers.splice(index, 1);
    handleFieldChange(field, headers);
  };

  const validateForm = (): boolean => {
    const validationErrors = corsService.validateConfiguration(formData);
    
    if (!formData.name.trim()) {
      validationErrors.push('Policy name is required');
    }
    
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      if (policy) {
        // Update existing policy
        const updates: CORSPolicyUpdate = { ...formData };
        await corsService.updatePolicy(policy.id, updates);
        enqueueSnackbar('CORS policy updated successfully', { variant: 'success' });
      } else {
        // Create new policy
        await corsService.createPolicy(formData);
        enqueueSnackbar('CORS policy created successfully', { variant: 'success' });
      }
      
      onSave();
    } catch (error: any) {
      enqueueSnackbar(error.response?.data?.detail || 'Failed to save policy', { 
        variant: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {policy ? 'Edit CORS Policy' : 'Create CORS Policy'}
      </DialogTitle>
      
      <DialogContent>
        {errors.length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Policy Name"
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              required
              helperText="Unique name for this policy"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Policy Type</InputLabel>
              <Select
                value={formData.policy_type}
                label="Policy Type"
                onChange={(e) => handleFieldChange('policy_type', e.target.value)}
              >
                <MenuItem value={CORSPolicyType.GLOBAL}>Global</MenuItem>
                <MenuItem value={CORSPolicyType.ENDPOINT}>Endpoint</MenuItem>
                <MenuItem value={CORSPolicyType.API_KEY}>API Key</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              multiline
              rows={2}
            />
          </Grid>
          
          {formData.policy_type === CORSPolicyType.ENDPOINT && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Endpoint Pattern"
                value={formData.endpoint_pattern}
                onChange={(e) => handleFieldChange('endpoint_pattern', e.target.value)}
                helperText="Regex pattern (e.g., ^/api/v1/.*)"
                required
              />
            </Grid>
          )}
          
          {formData.policy_type === CORSPolicyType.API_KEY && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="API Key ID"
                value={formData.api_key_id}
                onChange={(e) => handleFieldChange('api_key_id', e.target.value)}
                required
              />
            </Grid>
          )}
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Priority"
              type="number"
              value={formData.priority}
              onChange={(e) => handleFieldChange('priority', parseInt(e.target.value) || 0)}
              helperText="Higher priority policies override lower ones"
            />
          </Grid>

          {/* Origins Configuration */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Origins Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.allow_all_origins}
                          onChange={(e) => handleFieldChange('allow_all_origins', e.target.checked)}
                        />
                      }
                      label="Allow all origins (*)"
                    />
                    {formData.allow_all_origins && formData.allow_credentials && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        Cannot allow credentials when allowing all origins (security restriction)
                      </Alert>
                    )}
                  </Grid>
                  
                  {!formData.allow_all_origins && (
                    <>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Add Origin"
                          value={originInput}
                          onChange={(e) => setOriginInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddOrigin()}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton onClick={handleAddOrigin}>
                                  <AddIcon />
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                          helperText="e.g., https://example.com or http://localhost:3000"
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {formData.allowed_origins?.map((origin, index) => (
                            <Chip
                              key={index}
                              label={origin}
                              onDelete={() => handleRemoveOrigin(index)}
                            />
                          ))}
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.validate_origin_regex}
                              onChange={(e) => handleFieldChange('validate_origin_regex', e.target.checked)}
                            />
                          }
                          label="Use regex for origin matching"
                        />
                      </Grid>
                      
                      <Grid item xs={12} md={6}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.case_sensitive_origins}
                              onChange={(e) => handleFieldChange('case_sensitive_origins', e.target.checked)}
                            />
                          }
                          label="Case-sensitive origin matching"
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Methods Configuration */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Methods Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.allow_all_methods}
                          onChange={(e) => handleFieldChange('allow_all_methods', e.target.checked)}
                        />
                      }
                      label="Allow all HTTP methods"
                    />
                  </Grid>
                  
                  {!formData.allow_all_methods && (
                    <Grid item xs={12}>
                      <Autocomplete
                        multiple
                        options={COMMON_METHODS}
                        value={formData.allowed_methods || []}
                        onChange={(e, value) => handleFieldChange('allowed_methods', value)}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Allowed Methods"
                            placeholder="Select methods"
                          />
                        )}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip label={option} {...getTagProps({ index })} />
                          ))
                        }
                      />
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Headers Configuration */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Headers Configuration</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.allow_all_headers}
                          onChange={(e) => handleFieldChange('allow_all_headers', e.target.checked)}
                        />
                      }
                      label="Allow all request headers"
                    />
                  </Grid>
                  
                  {!formData.allow_all_headers && (
                    <>
                      <Grid item xs={12}>
                        <Autocomplete
                          freeSolo
                          options={COMMON_HEADERS}
                          value={headerInput}
                          onChange={(e, value) => setHeaderInput(value || '')}
                          onInputChange={(e, value) => setHeaderInput(value)}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Add Allowed Header"
                              onKeyPress={(e) => e.key === 'Enter' && handleAddHeader('allowed')}
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {params.InputProps.endAdornment}
                                    <InputAdornment position="end">
                                      <IconButton onClick={() => handleAddHeader('allowed')}>
                                        <AddIcon />
                                      </IconButton>
                                    </InputAdornment>
                                  </>
                                )
                              }}
                            />
                          )}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Box display="flex" flexWrap="wrap" gap={1}>
                          {formData.allowed_headers?.map((header, index) => (
                            <Chip
                              key={index}
                              label={header}
                              onDelete={() => handleRemoveHeader('allowed', index)}
                            />
                          ))}
                        </Box>
                      </Grid>
                    </>
                  )}
                  
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                      Exposed Headers
                    </Typography>
                    <TextField
                      fullWidth
                      label="Add Exposed Header"
                      value={exposeHeaderInput}
                      onChange={(e) => setExposeHeaderInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddHeader('expose')}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => handleAddHeader('expose')}>
                              <AddIcon />
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                      helperText="Headers that browsers are allowed to access"
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {formData.expose_headers?.map((header, index) => (
                        <Chip
                          key={index}
                          label={header}
                          onDelete={() => handleRemoveHeader('expose', index)}
                        />
                      ))}
                    </Box>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Advanced Settings */}
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Advanced Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.allow_credentials}
                          onChange={(e) => handleFieldChange('allow_credentials', e.target.checked)}
                        />
                      }
                      label="Allow credentials"
                    />
                    <Typography variant="caption" color="textSecondary">
                      Include cookies and authorization headers
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Max Age (seconds)"
                      type="number"
                      value={formData.max_age}
                      onChange={(e) => handleFieldChange('max_age', parseInt(e.target.value) || 0)}
                      helperText="Preflight cache duration (0-86400)"
                      InputProps={{
                        inputProps: { min: 0, max: 86400 }
                      }}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : (policy ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};