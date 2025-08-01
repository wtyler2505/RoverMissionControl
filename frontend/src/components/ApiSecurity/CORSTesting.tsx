import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { corsService } from '../../services/corsService';
import {
  CORSPolicy,
  CORSTestRequest,
  CORSTestResult
} from '../../types/cors';

interface CORSTestingProps {
  policies: CORSPolicy[];
}

interface TestHistory {
  timestamp: Date;
  policy: string;
  request: CORSTestRequest;
  result: CORSTestResult;
}

const COMMON_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://example.com',
  'https://app.example.com',
  'https://api.example.com',
  'null', // for file:// and data: URLs
  'chrome-extension://example'
];

const COMMON_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];

const COMMON_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'X-API-Key',
  'X-Requested-With',
  'Cache-Control',
  'X-CSRF-Token',
  'X-Custom-Header'
];

export const CORSTesting: React.FC<CORSTestingProps> = ({ policies }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');
  const [testOrigin, setTestOrigin] = useState('http://localhost:3000');
  const [testMethod, setTestMethod] = useState('GET');
  const [testHeaders, setTestHeaders] = useState<string[]>(['Authorization', 'Content-Type']);
  const [customHeader, setCustomHeader] = useState('');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<CORSTestResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestHistory[]>([]);

  const handleTest = async () => {
    if (!selectedPolicy) {
      enqueueSnackbar('Please select a policy to test', { variant: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setTestResult(null);

      const request: CORSTestRequest = {
        test_origin: testOrigin,
        test_method: testMethod,
        test_headers: testHeaders.length > 0 ? testHeaders : undefined
      };

      const result = await corsService.testPolicy(selectedPolicy, request);
      setTestResult(result);

      // Add to history
      const policy = policies.find(p => p.id === selectedPolicy);
      if (policy) {
        setTestHistory(prev => [{
          timestamp: new Date(),
          policy: policy.name,
          request,
          result
        }, ...prev.slice(0, 9)]); // Keep last 10 tests
      }

      enqueueSnackbar(
        result.allowed ? 'Request would be allowed' : 'Request would be blocked',
        { variant: result.allowed ? 'success' : 'error' }
      );
    } catch (error: any) {
      enqueueSnackbar('Failed to test CORS policy', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddHeader = () => {
    if (customHeader && !testHeaders.includes(customHeader)) {
      setTestHeaders([...testHeaders, customHeader]);
      setCustomHeader('');
    }
  };

  const handleRemoveHeader = (header: string) => {
    setTestHeaders(testHeaders.filter(h => h !== header));
  };

  const generateCurlCommand = () => {
    let cmd = `curl -X ${testMethod}`;
    cmd += ` -H "Origin: ${testOrigin}"`;
    testHeaders.forEach(header => {
      cmd += ` -H "${header}: <value>"`;
    });
    cmd += ` https://your-api.com/endpoint`;
    return cmd;
  };

  const generateJavaScriptCode = () => {
    return `fetch('https://your-api.com/endpoint', {
  method: '${testMethod}',
  headers: {
${testHeaders.map(h => `    '${h}': '<value>'`).join(',\n')}
  },
  credentials: 'include' // if credentials are needed
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar('Copied to clipboard', { variant: 'success' });
  };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Test Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Configuration
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Select Policy</InputLabel>
                    <Select
                      value={selectedPolicy}
                      label="Select Policy"
                      onChange={(e) => setSelectedPolicy(e.target.value)}
                    >
                      {policies.map(policy => (
                        <MenuItem key={policy.id} value={policy.id}>
                          {policy.name} ({policy.policy_type})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Test Origin</InputLabel>
                    <Select
                      value={testOrigin}
                      label="Test Origin"
                      onChange={(e) => setTestOrigin(e.target.value)}
                    >
                      {COMMON_ORIGINS.map(origin => (
                        <MenuItem key={origin} value={origin}>
                          {origin}
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">Custom...</MenuItem>
                    </Select>
                  </FormControl>
                  {testOrigin === 'custom' && (
                    <TextField
                      fullWidth
                      label="Custom Origin"
                      value={testOrigin}
                      onChange={(e) => setTestOrigin(e.target.value)}
                      sx={{ mt: 1 }}
                      placeholder="https://example.com"
                    />
                  )}
                </Grid>

                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>HTTP Method</InputLabel>
                    <Select
                      value={testMethod}
                      label="HTTP Method"
                      onChange={(e) => setTestMethod(e.target.value)}
                    >
                      {COMMON_METHODS.map(method => (
                        <MenuItem key={method} value={method}>
                          {method}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Request Headers
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1} mb={1}>
                    {testHeaders.map(header => (
                      <Chip
                        key={header}
                        label={header}
                        onDelete={() => handleRemoveHeader(header)}
                      />
                    ))}
                  </Box>
                  <Box display="flex" gap={1}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Add Header</InputLabel>
                      <Select
                        value={customHeader}
                        label="Add Header"
                        onChange={(e) => setCustomHeader(e.target.value)}
                      >
                        {COMMON_HEADERS
                          .filter(h => !testHeaders.includes(h))
                          .map(header => (
                            <MenuItem key={header} value={header}>
                              {header}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                    <Button
                      variant="outlined"
                      onClick={handleAddHeader}
                      disabled={!customHeader}
                    >
                      Add
                    </Button>
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<TestIcon />}
                    onClick={handleTest}
                    disabled={loading || !selectedPolicy}
                  >
                    {loading ? 'Testing...' : 'Test CORS Policy'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Code Examples */}
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Code Examples</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2">cURL Command</Typography>
                  <IconButton size="small" onClick={() => copyToClipboard(generateCurlCommand())}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {generateCurlCommand()}
                  </Typography>
                </Paper>

                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1} mt={2}>
                  <Typography variant="subtitle2">JavaScript Fetch</Typography>
                  <IconButton size="small" onClick={() => copyToClipboard(generateJavaScriptCode())}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                  <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {generateJavaScriptCode()}
                  </Typography>
                </Paper>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>

        {/* Test Results */}
        <Grid item xs={12} md={6}>
          {loading && (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          )}

          {testResult && !loading && (
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {testResult.allowed ? (
                    <PassIcon color="success" />
                  ) : (
                    <FailIcon color="error" />
                  )}
                  <Typography variant="h6">
                    Request {testResult.allowed ? 'Allowed' : 'Blocked'}
                  </Typography>
                </Box>

                {testResult.reason && (
                  <Alert severity={testResult.allowed ? 'success' : 'error'} sx={{ mb: 2 }}>
                    {testResult.reason}
                  </Alert>
                )}

                <List>
                  {testResult.policy_applied && (
                    <ListItem>
                      <ListItemIcon>
                        <InfoIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Policy Applied"
                        secondary={testResult.policy_applied}
                      />
                    </ListItem>
                  )}

                  {testResult.preflight_required && (
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Preflight Required"
                        secondary="This request would trigger a preflight OPTIONS request"
                      />
                    </ListItem>
                  )}

                  {testResult.headers_allowed && testResult.headers_allowed.length > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <PassIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Allowed Headers"
                        secondary={testResult.headers_allowed.join(', ')}
                      />
                    </ListItem>
                  )}

                  {testResult.headers_denied && testResult.headers_denied.length > 0 && (
                    <ListItem>
                      <ListItemIcon>
                        <FailIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Denied Headers"
                        secondary={testResult.headers_denied.join(', ')}
                      />
                    </ListItem>
                  )}
                </List>

                {testResult.response_headers && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle2" gutterBottom>
                      Response Headers
                    </Typography>
                    <Paper sx={{ p: 2, bgcolor: 'grey.100' }}>
                      {Object.entries(testResult.response_headers).map(([key, value]) => (
                        <Typography key={key} variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {key}: {value}
                        </Typography>
                      ))}
                    </Paper>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Test History */}
          {testHistory.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Test History
                </Typography>
                <List dense>
                  {testHistory.map((test, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {test.result.allowed ? (
                          <PassIcon color="success" fontSize="small" />
                        ) : (
                          <FailIcon color="error" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={`${test.policy} - ${test.request.test_origin}`}
                        secondary={`${test.request.test_method} - ${test.timestamp.toLocaleTimeString()}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
};