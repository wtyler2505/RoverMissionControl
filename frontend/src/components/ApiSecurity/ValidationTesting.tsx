import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Alert,
  Tabs,
  Tab,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandIcon,
  ContentCopy as CopyIcon,
  AutoFixHigh as GenerateIcon,
  Speed as SpeedIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import {
  SchemaDefinition,
  ValidationTestRequest,
  ValidationTestResult,
  ValidationError,
  SchemaEndpointMapping
} from '../../types/schema';
import schemaService from '../../services/schemaService';

interface ValidationTestingProps {
  schema?: SchemaDefinition | null;
  schemas: SchemaDefinition[];
}

const ValidationTesting: React.FC<ValidationTestingProps> = ({ schema, schemas }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedSchemaId, setSelectedSchemaId] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [endpoints, setEndpoints] = useState<SchemaEndpointMapping[]>([]);
  const [testData, setTestData] = useState('{}');
  const [validationType, setValidationType] = useState<'request' | 'response'>('request');
  const [statusCode, setStatusCode] = useState('200');
  const [testResult, setTestResult] = useState<ValidationTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [generatingData, setGeneratingData] = useState(false);

  useEffect(() => {
    if (schema) {
      setSelectedSchemaId(schema.id);
    }
  }, [schema]);

  useEffect(() => {
    loadEndpoints();
  }, []);

  useEffect(() => {
    if (selectedSchemaId) {
      generateSampleData();
    }
  }, [selectedSchemaId]);

  const loadEndpoints = async () => {
    try {
      const mappings = await schemaService.getEndpointMappings();
      setEndpoints(mappings);
    } catch (error) {
      console.error('Failed to load endpoints:', error);
    }
  };

  const generateSampleData = async () => {
    if (!selectedSchemaId) return;
    
    setGeneratingData(true);
    try {
      const sampleData = await schemaService.generateSampleData(selectedSchemaId);
      setTestData(JSON.stringify(sampleData, null, 2));
    } catch (error) {
      console.error('Failed to generate sample data:', error);
      // Set a default sample
      setTestData(JSON.stringify({ example: 'value' }, null, 2));
    } finally {
      setGeneratingData(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      let data;
      try {
        data = JSON.parse(testData);
      } catch (error) {
        setTestResult({
          isValid: false,
          errors: [{
            path: '$',
            message: 'Invalid JSON format',
            suggestedFix: 'Ensure the test data is valid JSON'
          }],
          warnings: [],
          executionTime: 0,
          appliedRules: []
        });
        return;
      }

      const request: ValidationTestRequest = {
        data,
        validationType,
        ...(activeTab === 0 && selectedSchemaId ? { schemaId: selectedSchemaId } : {}),
        ...(activeTab === 1 && selectedEndpointId ? { endpointId: selectedEndpointId } : {}),
        ...(validationType === 'response' ? { statusCode: parseInt(statusCode) } : {})
      };

      const result = await schemaService.testValidation(request);
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        isValid: false,
        errors: [{
          path: '$',
          message: error.message || 'Validation test failed',
        }],
        warnings: [],
        executionTime: 0,
        appliedRules: []
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyError = (error: ValidationError) => {
    const errorText = `Path: ${error.path}\nError: ${error.message}${error.suggestedFix ? `\nSuggested Fix: ${error.suggestedFix}` : ''}`;
    navigator.clipboard.writeText(errorText);
  };

  const getErrorIcon = (error: ValidationError) => {
    if (error.keyword === 'required') return <ErrorIcon color="error" fontSize="small" />;
    if (error.keyword === 'type') return <ErrorIcon color="error" fontSize="small" />;
    if (error.keyword === 'pattern') return <WarningIcon color="warning" fontSize="small" />;
    return <ErrorIcon color="error" fontSize="small" />;
  };

  const formatPath = (path: string) => {
    if (path === '$') return 'root';
    return path.replace(/^\$\./, '').replace(/\[(\d+)\]/g, '[$1]');
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Validation Testing Console
        </Typography>
        
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{ mb: 3 }}
        >
          <Tab label="Test Against Schema" />
          <Tab label="Test Against Endpoint" />
        </Tabs>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Stack spacing={2}>
              {activeTab === 0 ? (
                <FormControl fullWidth>
                  <InputLabel>Select Schema</InputLabel>
                  <Select
                    value={selectedSchemaId}
                    label="Select Schema"
                    onChange={(e) => setSelectedSchemaId(e.target.value)}
                  >
                    {schemas.map(s => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.name} (v{s.version})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <FormControl fullWidth>
                  <InputLabel>Select Endpoint</InputLabel>
                  <Select
                    value={selectedEndpointId}
                    label="Select Endpoint"
                    onChange={(e) => setSelectedEndpointId(e.target.value)}
                  >
                    {endpoints.map(ep => (
                      <MenuItem key={ep.id} value={ep.id}>
                        {ep.method} {ep.endpoint}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <FormControl fullWidth>
                <InputLabel>Validation Type</InputLabel>
                <Select
                  value={validationType}
                  label="Validation Type"
                  onChange={(e) => setValidationType(e.target.value as 'request' | 'response')}
                >
                  <MenuItem value="request">Request</MenuItem>
                  <MenuItem value="response">Response</MenuItem>
                </Select>
              </FormControl>

              {validationType === 'response' && (
                <TextField
                  label="Status Code"
                  value={statusCode}
                  onChange={(e) => setStatusCode(e.target.value)}
                  fullWidth
                  type="number"
                />
              )}

              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">
                    Test Data
                  </Typography>
                  <Box>
                    <Tooltip title="Generate sample data">
                      <IconButton
                        size="small"
                        onClick={generateSampleData}
                        disabled={!selectedSchemaId || generatingData}
                      >
                        {generatingData ? <CircularProgress size={16} /> : <GenerateIcon />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                  <Editor
                    height="300px"
                    language="json"
                    value={testData}
                    onChange={(value) => setTestData(value || '{}')}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true
                    }}
                  />
                </Box>
              </Box>

              <Button
                variant="contained"
                fullWidth
                startIcon={testing ? <CircularProgress size={16} /> : <TestIcon />}
                onClick={handleTest}
                disabled={testing || (!selectedSchemaId && !selectedEndpointId)}
              >
                {testing ? 'Testing...' : 'Run Validation Test'}
              </Button>
            </Stack>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                Validation Results
              </Typography>
              
              {!testResult ? (
                <Alert severity="info">
                  Run a validation test to see results here
                </Alert>
              ) : (
                <Stack spacing={2}>
                  <Box display="flex" gap={2} alignItems="center">
                    {testResult.isValid ? (
                      <Chip
                        icon={<ValidIcon />}
                        label="Valid"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<ErrorIcon />}
                        label="Invalid"
                        color="error"
                        size="small"
                      />
                    )}
                    <Chip
                      icon={<SpeedIcon />}
                      label={`${testResult.executionTime}ms`}
                      size="small"
                      variant="outlined"
                    />
                    {testResult.appliedRules.length > 0 && (
                      <Chip
                        label={`${testResult.appliedRules.length} rules applied`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>

                  {testResult.errors.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="error" gutterBottom>
                        Validation Errors ({testResult.errors.length})
                      </Typography>
                      <List dense>
                        {testResult.errors.map((error, index) => (
                          <Accordion key={index} elevation={0}>
                            <AccordionSummary expandIcon={<ExpandIcon />}>
                              <Box display="flex" alignItems="center" gap={1} width="100%">
                                {getErrorIcon(error)}
                                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                  {formatPath(error.path)}
                                </Typography>
                                <Chip
                                  label={error.keyword || 'error'}
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                />
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Stack spacing={1}>
                                <Typography variant="body2">
                                  <strong>Error:</strong> {error.message}
                                </Typography>
                                {error.suggestedFix && (
                                  <Alert severity="info" icon={<InfoIcon />}>
                                    <Typography variant="body2">
                                      <strong>Suggested Fix:</strong> {error.suggestedFix}
                                    </Typography>
                                  </Alert>
                                )}
                                {error.schemaPath && (
                                  <Typography variant="caption" color="text.secondary">
                                    Schema path: {error.schemaPath}
                                  </Typography>
                                )}
                                <Box display="flex" justifyContent="flex-end">
                                  <Tooltip title="Copy error details">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleCopyError(error)}
                                    >
                                      <CopyIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Stack>
                            </AccordionDetails>
                          </Accordion>
                        ))}
                      </List>
                    </Box>
                  )}

                  {testResult.warnings.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="warning.main" gutterBottom>
                        Warnings ({testResult.warnings.length})
                      </Typography>
                      <List dense>
                        {testResult.warnings.map((warning, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <WarningIcon color="warning" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={warning.message}
                              secondary={`Path: ${formatPath(warning.path)} • Severity: ${warning.severity}`}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}

                  {testResult.isValid && testResult.errors.length === 0 && (
                    <Alert severity="success">
                      All validation checks passed successfully!
                    </Alert>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default ValidationTesting;