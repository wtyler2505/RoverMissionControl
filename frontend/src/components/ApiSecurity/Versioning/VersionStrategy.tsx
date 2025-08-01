import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  CheckCircle as ActiveIcon,
  RadioButtonUnchecked as InactiveIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import { VersioningService } from '../../../services/versioningService';
import {
  VersionStrategy,
  VersionStrategyType,
  VersionStrategyConfig,
  StrategyFormData,
} from '../../../types/versioning';

const VersionStrategyComponent: React.FC = () => {
  const [strategies, setStrategies] = useState<VersionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<VersionStrategy | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');

  // Form state
  const [formData, setFormData] = useState<StrategyFormData>({
    name: '',
    type: VersionStrategyType.URI_BASED,
    description: '',
    configuration: {},
  });

  // Test state
  const [testData, setTestData] = useState({
    url: '',
    headers: {} as Record<string, string>,
    queryParams: {} as Record<string, string>,
  });
  const [testResult, setTestResult] = useState<any>(null);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      const response = await VersioningService.getStrategies();
      if (response.success) {
        setStrategies(response.data);
      } else {
        setError(response.message || 'Failed to load strategies');
      }
    } catch (err) {
      console.error('Error loading strategies:', err);
      setError('Failed to load strategies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  const handleCreate = () => {
    setSelectedStrategy(null);
    setFormData({
      name: '',
      type: VersionStrategyType.URI_BASED,
      description: '',
      configuration: {},
    });
    setMode('create');
    setFormOpen(true);
  };

  const handleEdit = (strategy: VersionStrategy) => {
    setSelectedStrategy(strategy);
    setFormData({
      name: strategy.name,
      type: strategy.type,
      description: strategy.description || '',
      configuration: strategy.configuration,
    });
    setMode('edit');
    setFormOpen(true);
  };

  const handleDelete = async (strategy: VersionStrategy) => {
    if (window.confirm(`Are you sure you want to delete strategy "${strategy.name}"?`)) {
      try {
        const response = await VersioningService.deleteStrategy(strategy.id);
        if (response.success) {
          loadStrategies();
        } else {
          setError(response.message || 'Failed to delete strategy');
        }
      } catch (err) {
        console.error('Error deleting strategy:', err);
        setError('Failed to delete strategy');
      }
    }
  };

  const handleActivate = async (strategy: VersionStrategy) => {
    try {
      const response = await VersioningService.activateStrategy(strategy.id);
      if (response.success) {
        loadStrategies();
      } else {
        setError(response.message || 'Failed to activate strategy');
      }
    } catch (err) {
      console.error('Error activating strategy:', err);
      setError('Failed to activate strategy');
    }
  };

  const handleTest = (strategy: VersionStrategy) => {
    setSelectedStrategy(strategy);
    setTestData({
      url: '',
      headers: {},
      queryParams: {},
    });
    setTestResult(null);
    setTestOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (mode === 'create') {
        const response = await VersioningService.createStrategy(formData);
        if (!response.success) {
          setError(response.message || 'Failed to create strategy');
          return;
        }
      } else if (selectedStrategy) {
        const response = await VersioningService.updateStrategy(selectedStrategy.id, formData);
        if (!response.success) {
          setError(response.message || 'Failed to update strategy');
          return;
        }
      }
      setFormOpen(false);
      loadStrategies();
    } catch (err) {
      console.error('Error saving strategy:', err);
      setError('Failed to save strategy');
    }
  };

  const runTest = async () => {
    if (!selectedStrategy) return;

    try {
      const response = await VersioningService.testStrategy(selectedStrategy.id, testData);
      setTestResult(response.data);
    } catch (err) {
      console.error('Error testing strategy:', err);
      setTestResult({ error: 'Failed to test strategy' });
    }
  };

  const renderStrategyConfiguration = (type: VersionStrategyType, config: VersionStrategyConfig) => {
    const isEditing = formOpen;
    
    switch (type) {
      case VersionStrategyType.URI_BASED:
        return (
          <Box>
            <TextField
              fullWidth
              label="Path Pattern"
              value={config.pathPattern || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                configuration: { ...prev.configuration, pathPattern: e.target.value }
              }))}
              helperText="e.g., /api/v{version}/ or /api/{version}/"
              disabled={!isEditing}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Path Prefix"
              value={config.pathPrefix || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                configuration: { ...prev.configuration, pathPrefix: e.target.value }
              }))}
              helperText="e.g., /v1, /v2"
              disabled={!isEditing}
            />
          </Box>
        );

      case VersionStrategyType.HEADER_BASED:
        return (
          <Box>
            <TextField
              fullWidth
              label="Header Name"
              value={config.headerName || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                configuration: { ...prev.configuration, headerName: e.target.value }
              }))}
              helperText="e.g., API-Version, X-API-Version"
              disabled={!isEditing}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Default Version"
              value={config.defaultVersion || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                configuration: { ...prev.configuration, defaultVersion: e.target.value }
              }))}
              helperText="Version to use when header is missing"
              disabled={!isEditing}
            />
          </Box>
        );

      case VersionStrategyType.QUERY_PARAM:
        return (
          <TextField
            fullWidth
            label="Parameter Name"
            value={config.paramName || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              configuration: { ...prev.configuration, paramName: e.target.value }
            }))}
            helperText="e.g., version, api_version"
            disabled={!isEditing}
          />
        );

      case VersionStrategyType.CONTENT_TYPE:
        return (
          <TextField
            fullWidth
            label="Media Type Pattern"
            value={config.mediaTypePattern || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              configuration: { ...prev.configuration, mediaTypePattern: e.target.value }
            }))}
            helperText="e.g., application/vnd.api+json;version={version}"
            disabled={!isEditing}
          />
        );

      case VersionStrategyType.CUSTOM:
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Custom Logic"
            value={config.customLogic || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              configuration: { ...prev.configuration, customLogic: e.target.value }
            }))}
            helperText="JavaScript function to extract version"
            disabled={!isEditing}
          />
        );

      default:
        return null;
    }
  };

  const getStrategyDescription = (strategy: VersionStrategy) => {
    switch (strategy.type) {
      case VersionStrategyType.URI_BASED:
        return `Path: ${strategy.configuration.pathPattern || 'Not configured'}`;
      case VersionStrategyType.HEADER_BASED:
        return `Header: ${strategy.configuration.headerName || 'Not configured'}`;
      case VersionStrategyType.QUERY_PARAM:
        return `Parameter: ${strategy.configuration.paramName || 'Not configured'}`;
      case VersionStrategyType.CONTENT_TYPE:
        return `Media Type: ${strategy.configuration.mediaTypePattern || 'Not configured'}`;
      case VersionStrategyType.CUSTOM:
        return 'Custom implementation';
      default:
        return 'Unknown strategy';
    }
  };

  const getStrategyExamples = (strategy: VersionStrategy) => {
    switch (strategy.type) {
      case VersionStrategyType.URI_BASED:
        return [
          'GET /api/v1/users',
          'POST /api/v2/orders',
        ];
      case VersionStrategyType.HEADER_BASED:
        return [
          `GET /api/users\n${strategy.configuration.headerName}: 1.0`,
          `POST /api/orders\n${strategy.configuration.headerName}: 2.0`,
        ];
      case VersionStrategyType.QUERY_PARAM:
        return [
          `GET /api/users?${strategy.configuration.paramName}=1.0`,
          `POST /api/orders?${strategy.configuration.paramName}=2.0`,
        ];
      case VersionStrategyType.CONTENT_TYPE:
        return [
          'Content-Type: application/vnd.api+json;version=1.0',
          'Content-Type: application/vnd.api+json;version=2.0',
        ];
      default:
        return [];
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Versioning Strategies</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Strategy
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Strategies Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {strategies.map((strategy) => (
            <Grid item xs={12} md={6} lg={4} key={strategy.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" component="div">
                      {strategy.name}
                    </Typography>
                    <Chip
                      icon={strategy.isActive ? <ActiveIcon /> : <InactiveIcon />}
                      label={strategy.isActive ? 'Active' : 'Inactive'}
                      color={strategy.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Chip
                    label={strategy.type.replace('_', ' ').toUpperCase()}
                    color="primary"
                    size="small"
                    sx={{ mb: 2 }}
                  />

                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {strategy.description || 'No description'}
                  </Typography>

                  <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                    Configuration:
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {getStrategyDescription(strategy)}
                  </Typography>

                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">Examples</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {getStrategyExamples(strategy).map((example, index) => (
                        <Box key={index} sx={{ mb: 1 }}>
                          <Typography variant="body2" fontFamily="monospace" sx={{ 
                            backgroundColor: 'grey.100',
                            p: 1,
                            borderRadius: 1,
                          }}>
                            {example}
                          </Typography>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<TestIcon />}
                    onClick={() => handleTest(strategy)}
                  >
                    Test
                  </Button>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleEdit(strategy)}
                  >
                    Edit
                  </Button>
                  {!strategy.isActive && (
                    <Button
                      size="small"
                      onClick={() => handleActivate(strategy)}
                      color="success"
                    >
                      Activate
                    </Button>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(strategy)}
                    color="error"
                  >
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Strategy Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {mode === 'create' ? 'Create Versioning Strategy' : 'Edit Versioning Strategy'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Strategy Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Strategy Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    type: e.target.value as VersionStrategyType,
                    configuration: {} // Reset configuration when type changes
                  }))}
                  label="Strategy Type"
                >
                  {Object.values(VersionStrategyType).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Configuration
              </Typography>
              {renderStrategyConfiguration(formData.type, formData.configuration)}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Strategy Dialog */}
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Test Strategy: {selectedStrategy?.name}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Test URL"
                value={testData.url}
                onChange={(e) => setTestData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://api.example.com/users"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Headers
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Headers (JSON format)"
                value={JSON.stringify(testData.headers, null, 2)}
                onChange={(e) => {
                  try {
                    const headers = JSON.parse(e.target.value);
                    setTestData(prev => ({ ...prev, headers }));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder='{"API-Version": "1.0"}'
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                Query Parameters
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Query Parameters (JSON format)"
                value={JSON.stringify(testData.queryParams, null, 2)}
                onChange={(e) => {
                  try {
                    const queryParams = JSON.parse(e.target.value);
                    setTestData(prev => ({ ...prev, queryParams }));
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder='{"version": "1.0"}'
              />
            </Grid>

            {testResult && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Test Result
                </Typography>
                <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                  <pre>{JSON.stringify(testResult, null, 2)}</pre>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)}>Close</Button>
          <Button onClick={runTest} variant="contained">
            Run Test
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VersionStrategyComponent;