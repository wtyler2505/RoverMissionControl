import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  Chip,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Timer as TimerIcon,
  Block as BlockIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { rateLimitService, RateLimitPolicy } from '../../services/rateLimitService';

interface RateLimitTestingProps {
  policies: RateLimitPolicy[];
}

interface TestResult {
  allowed: boolean;
  policy?: {
    id: string;
    name: string;
    window: string;
    limit: number;
  };
  info: any;
  testDetails: any;
}

export const RateLimitTesting: React.FC<RateLimitTestingProps> = ({ policies }) => {
  const [testData, setTestData] = useState({
    identifier: '',
    endpoint: '/api/users',
    method: 'GET',
    apiKeyId: '',
    userId: '',
    ipAddress: ''
  });
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  const handleTest = async () => {
    if (!testData.identifier || !testData.endpoint) {
      enqueueSnackbar('Please provide identifier and endpoint', { variant: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const result = await rateLimitService.testRateLimit(
        testData.identifier,
        testData.endpoint,
        testData.method,
        testData.apiKeyId || undefined,
        testData.userId || undefined,
        testData.ipAddress || undefined
      );
      setTestResult(result);
    } catch (error: any) {
      enqueueSnackbar('Failed to test rate limit', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getIdentifierType = () => {
    if (testData.apiKeyId) return 'API Key';
    if (testData.userId) return 'User';
    if (testData.ipAddress) return 'IP Address';
    return 'Generic';
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
                  <TextField
                    fullWidth
                    label="Identifier"
                    value={testData.identifier}
                    onChange={(e) => setTestData({ ...testData, identifier: e.target.value })}
                    placeholder="e.g., api_key:123, user:456, ip:192.168.1.1"
                    helperText="The identifier that will be rate limited"
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    fullWidth
                    label="Endpoint"
                    value={testData.endpoint}
                    onChange={(e) => setTestData({ ...testData, endpoint: e.target.value })}
                    placeholder="/api/users/*"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <FormControl fullWidth>
                    <InputLabel>Method</InputLabel>
                    <Select
                      value={testData.method}
                      onChange={(e) => setTestData({ ...testData, method: e.target.value })}
                      label="Method"
                    >
                      <MenuItem value="GET">GET</MenuItem>
                      <MenuItem value="POST">POST</MenuItem>
                      <MenuItem value="PUT">PUT</MenuItem>
                      <MenuItem value="DELETE">DELETE</MenuItem>
                      <MenuItem value="PATCH">PATCH</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                    Optional Context (for more accurate testing)
                  </Typography>
                </Grid>
                
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="API Key ID"
                    value={testData.apiKeyId}
                    onChange={(e) => setTestData({ ...testData, apiKeyId: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="User ID"
                    value={testData.userId}
                    onChange={(e) => setTestData({ ...testData, userId: e.target.value })}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="IP Address"
                    value={testData.ipAddress}
                    onChange={(e) => setTestData({ ...testData, ipAddress: e.target.value })}
                    size="small"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleTest}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <PlayIcon />}
                  >
                    {loading ? 'Testing...' : 'Run Test'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Test Results */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Results
              </Typography>
              
              {!testResult ? (
                <Alert severity="info" icon={<InfoIcon />}>
                  Configure test parameters and run a test to see results
                </Alert>
              ) : (
                <Box>
                  {/* Result Status */}
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 2, 
                      mb: 2,
                      bgcolor: testResult.allowed ? 'success.light' : 'error.light',
                      borderColor: testResult.allowed ? 'success.main' : 'error.main'
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={2}>
                      {testResult.allowed ? (
                        <CheckIcon color="success" sx={{ fontSize: 48 }} />
                      ) : (
                        <BlockIcon color="error" sx={{ fontSize: 48 }} />
                      )}
                      <Box>
                        <Typography variant="h5" fontWeight="bold">
                          Request {testResult.allowed ? 'ALLOWED' : 'BLOCKED'}
                        </Typography>
                        {testResult.info.message && (
                          <Typography variant="body2">
                            {testResult.info.message}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>

                  {/* Policy Details */}
                  {testResult.policy && (
                    <Box mb={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Applied Policy
                      </Typography>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={12}>
                            <Typography variant="body1" fontWeight="medium">
                              {testResult.policy.name}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <SpeedIcon fontSize="small" color="action" />
                              <Typography variant="body2">
                                Limit: {testResult.policy.limit} requests
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={6}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <TimerIcon fontSize="small" color="action" />
                              <Typography variant="body2">
                                Window: {testResult.policy.window}
                              </Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Paper>
                    </Box>
                  )}

                  {/* Rate Limit Info */}
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom>
                      Rate Limit Details
                    </Typography>
                    <List dense>
                      {testResult.info.limit && (
                        <ListItem>
                          <ListItemIcon>
                            <SpeedIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Request Limit"
                            secondary={`${testResult.info.limit} requests per ${testResult.info.window}`}
                          />
                        </ListItem>
                      )}
                      {testResult.info.current_count !== undefined && (
                        <ListItem>
                          <ListItemIcon>
                            <InfoIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Current Count"
                            secondary={testResult.info.current_count}
                          />
                        </ListItem>
                      )}
                      {testResult.info.remaining !== undefined && (
                        <ListItem>
                          <ListItemIcon>
                            <CheckIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Remaining Requests"
                            secondary={testResult.info.remaining}
                          />
                        </ListItem>
                      )}
                      {testResult.info.retry_after_seconds && (
                        <ListItem>
                          <ListItemIcon>
                            <TimerIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Retry After"
                            secondary={`${testResult.info.retry_after_seconds} seconds`}
                          />
                        </ListItem>
                      )}
                      {testResult.info.reset_at && (
                        <ListItem>
                          <ListItemIcon>
                            <ScheduleIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Window Resets At"
                            secondary={new Date(testResult.info.reset_at).toLocaleString()}
                          />
                        </ListItem>
                      )}
                    </List>
                  </Box>

                  {/* Test Details */}
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Test Parameters
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      <Chip 
                        label={`Identifier: ${testResult.testDetails.identifier}`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`${testResult.testDetails.method} ${testResult.testDetails.endpoint}`} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`Type: ${getIdentifierType()}`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Box>
                  </Box>

                  {/* Burst Info */}
                  {testResult.info.burst_info && (
                    <Box mt={2}>
                      <Alert severity="info">
                        <Typography variant="subtitle2" gutterBottom>
                          Burst Information
                        </Typography>
                        <Typography variant="body2">
                          Tokens Remaining: {testResult.info.burst_info.tokens_remaining} / {testResult.info.burst_info.burst_limit}
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Tips */}
        <Grid item xs={12}>
          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="subtitle2" gutterBottom>
              Testing Tips
            </Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Test with different identifiers to see how policies apply to different request sources</li>
              <li>Try various endpoint patterns to understand pattern matching behavior</li>
              <li>Test method-specific limits by changing the HTTP method</li>
              <li>Run multiple tests in succession to observe rate limit enforcement</li>
            </ul>
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
};