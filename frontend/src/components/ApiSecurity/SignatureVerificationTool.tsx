import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  CircularProgress
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  ContentCopy as CopyIcon,
  Info as InfoIcon,
  VpnKey as KeyIcon,
  Schedule as ScheduleIcon,
  Fingerprint as FingerprintIcon
} from '@mui/icons-material';
import { signingService } from '../../services/signingService';

export const SignatureVerificationTool: React.FC = () => {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('');
  const [headers, setHeaders] = useState<{ [key: string]: string }>({
    'Host': 'api.example.com',
    'Content-Type': 'application/json'
  });
  const [body, setBody] = useState('');
  const [headerInput, setHeaderInput] = useState('');
  
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [testSignatureResult, setTestSignatureResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddHeader = () => {
    const parts = headerInput.split(':');
    if (parts.length === 2) {
      const key = parts[0].trim();
      const value = parts[1].trim();
      if (key && value) {
        setHeaders({ ...headers, [key]: value });
        setHeaderInput('');
      }
    }
  };

  const handleRemoveHeader = (key: string) => {
    const { [key]: _, ...rest } = headers;
    setHeaders(rest);
  };

  const handleVerifySignature = async () => {
    if (!url) {
      setError('URL is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await signingService.verifySignature({
        method,
        url,
        headers,
        body: body || undefined
      });
      
      setVerificationResult(result);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSignature = async (algorithm: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await signingService.testSignatureGeneration(algorithm);
      setTestSignatureResult(result);
    } catch (err: any) {
      setError(err.message || 'Test generation failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatHeaders = (headers: { [key: string]: string }) => {
    return Object.entries(headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Signature Verification Tool
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Request Details
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <FormControl fullWidth>
                    <InputLabel>Method</InputLabel>
                    <Select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                    >
                      <MenuItem value="GET">GET</MenuItem>
                      <MenuItem value="POST">POST</MenuItem>
                      <MenuItem value="PUT">PUT</MenuItem>
                      <MenuItem value="DELETE">DELETE</MenuItem>
                      <MenuItem value="PATCH">PATCH</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={8}>
                  <TextField
                    fullWidth
                    label="URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/endpoint"
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Headers
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {Object.entries(headers).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${value}`}
                        onDelete={() => handleRemoveHeader(key)}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Header-Name: Value"
                      value={headerInput}
                      onChange={(e) => setHeaderInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddHeader();
                        }
                      }}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleAddHeader}
                      disabled={!headerInput.includes(':')}
                    >
                      Add
                    </Button>
                  </Box>
                </Grid>
                
                {['POST', 'PUT', 'PATCH'].includes(method) && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Request Body"
                      multiline
                      rows={4}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder='{"key": "value"}'
                    />
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleVerifySignature}
                    disabled={loading || !url}
                  >
                    Verify Signature
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          {verificationResult && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  {verificationResult.is_valid ? (
                    <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  ) : (
                    <ErrorIcon color="error" sx={{ mr: 1 }} />
                  )}
                  <Typography variant="h6">
                    {verificationResult.is_valid ? 'Valid Signature' : 'Invalid Signature'}
                  </Typography>
                </Box>
                
                {verificationResult.error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {verificationResult.error}
                  </Alert>
                )}
                
                {verificationResult.api_key_id && (
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <KeyIcon fontSize="small" sx={{ mr: 1 }} />
                            API Key
                          </Box>
                        </TableCell>
                        <TableCell>{verificationResult.api_key_name}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FingerprintIcon fontSize="small" sx={{ mr: 1 }} />
                            Key ID
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {verificationResult.api_key_id}
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ScheduleIcon fontSize="small" sx={{ mr: 1 }} />
                            Verified At
                          </Box>
                        </TableCell>
                        <TableCell>
                          {new Date(verificationResult.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" gutterBottom>
        Test Signature Generation
      </Typography>
      
      <Grid container spacing={2}>
        {['HMAC-SHA256', 'JWT-HS256', 'RSA-SHA256'].map((algorithm) => (
          <Grid item key={algorithm}>
            <Button
              variant="outlined"
              onClick={() => handleTestSignature(algorithm)}
            >
              Test {algorithm}
            </Button>
          </Grid>
        ))}
      </Grid>

      {testSignatureResult && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Test Signature Result
            </Typography>
            
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
              <Typography variant="subtitle2" gutterBottom>
                Test Data
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                {JSON.stringify(testSignatureResult.test_data, null, 2)}
              </Typography>
            </Paper>
            
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  Signature Headers
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(formatHeaders(testSignatureResult.signature_headers))}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
                {formatHeaders(testSignatureResult.signature_headers)}
              </Typography>
            </Paper>
            
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.100' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">
                  Canonical Request
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(testSignatureResult.canonical_request)}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {testSignatureResult.canonical_request}
              </Typography>
            </Paper>
            
            <Alert severity="info" icon={<InfoIcon />}>
              Test secret: <code>{testSignatureResult.test_secret}</code>
            </Alert>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};