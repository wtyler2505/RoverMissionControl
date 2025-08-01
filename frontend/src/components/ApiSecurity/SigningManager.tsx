import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Alert,
  Snackbar,
  FormControl,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  InputLabel,
  Paper,
  Tooltip,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Key as KeyIcon,
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { signingService } from '../../services/signingService';
import { SignatureVerificationTool } from './SignatureVerificationTool';
import { SigningSampleCode } from './SigningSampleCode';
import { apiKeyService } from '../../services/apiKeyService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`signing-tabpanel-${index}`}
      aria-labelledby={`signing-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const SigningManager: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [configurations, setConfigurations] = useState<any[]>([]);
  const [algorithms, setAlgorithms] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [newConfig, setNewConfig] = useState({
    name: '',
    description: '',
    algorithm: 'HMAC-SHA256',
    keySize: 2048,
    includeHeaders: ['host', 'content-type', 'content-length'],
    timestampToleranceSeconds: 300,
    requireNonce: true,
    requireBodyHash: true,
    jwtExpiresInSeconds: 300,
    jwtCustomClaims: {},
    allowedEndpoints: [],
    blockedEndpoints: [],
    requireSecureTransport: true
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configsData, algorithmsData, keysData] = await Promise.all([
        signingService.getConfigurations(!showInactive),
        signingService.getSupportedAlgorithms(),
        apiKeyService.getApiKeys(false)
      ]);
      
      setConfigurations(configsData);
      setAlgorithms(algorithmsData.algorithms);
      setApiKeys(keysData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    try {
      await signingService.createConfiguration(newConfig);
      setSuccess('Configuration created successfully');
      setCreateDialogOpen(false);
      loadData();
      resetNewConfig();
    } catch (err) {
      setError('Failed to create configuration');
    }
  };

  const handleUpdateConfig = async () => {
    if (!selectedConfig) return;
    
    try {
      await signingService.updateConfiguration(selectedConfig.id, selectedConfig);
      setSuccess('Configuration updated successfully');
      setEditDialogOpen(false);
      loadData();
    } catch (err) {
      setError('Failed to update configuration');
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this configuration?')) {
      return;
    }
    
    try {
      await signingService.deleteConfiguration(configId);
      setSuccess('Configuration deactivated successfully');
      loadData();
    } catch (err) {
      setError('Failed to deactivate configuration');
    }
  };

  const resetNewConfig = () => {
    setNewConfig({
      name: '',
      description: '',
      algorithm: 'HMAC-SHA256',
      keySize: 2048,
      includeHeaders: ['host', 'content-type', 'content-length'],
      timestampToleranceSeconds: 300,
      requireNonce: true,
      requireBodyHash: true,
      jwtExpiresInSeconds: 300,
      jwtCustomClaims: {},
      allowedEndpoints: [],
      blockedEndpoints: [],
      requireSecureTransport: true
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard');
  };

  const getAlgorithmInfo = (algorithmId: string) => {
    return algorithms.find(a => a.id === algorithmId) || {};
  };

  const getAlgorithmColor = (type: string) => {
    return type === 'symmetric' ? 'primary' : 'secondary';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Request Signing & Verification
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Configuration
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
          <Tab label="Configurations" icon={<SecurityIcon />} />
          <Tab label="Verification Tool" icon={<CheckCircleIcon />} />
          <Tab label="Sample Code" icon={<CodeIcon />} />
          <Tab label="Troubleshooting" icon={<BugReportIcon />} />
          <Tab label="Statistics" icon={<AssessmentIcon />} />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked);
                  loadData();
                }}
              />
            }
            label="Show inactive configurations"
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {configurations.map((config) => {
              const algorithmInfo = getAlgorithmInfo(config.algorithm);
              return (
                <Grid item xs={12} md={6} key={config.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6" component="h2">
                          {config.name}
                        </Typography>
                        <Box>
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedConfig(config);
                              setEditDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteConfig(config.id)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>
                      
                      {config.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {config.description}
                        </Typography>
                      )}

                      <Box sx={{ mb: 2 }}>
                        <Chip
                          label={config.algorithm}
                          color={getAlgorithmColor(algorithmInfo.type)}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        {!config.isActive && (
                          <Chip label="Inactive" size="small" color="default" />
                        )}
                      </Box>

                      <List dense>
                        <ListItem>
                          <ListItemIcon>
                            <SecurityIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Security Type"
                            secondary={algorithmInfo.type}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            <InfoIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Timestamp Tolerance"
                            secondary={`${config.timestampToleranceSeconds} seconds`}
                          />
                        </ListItem>
                        <ListItem>
                          <ListItemIcon>
                            {config.requireNonce ? <CheckCircleIcon fontSize="small" color="success" /> : <ErrorIcon fontSize="small" color="error" />}
                          </ListItemIcon>
                          <ListItemText
                            primary="Replay Protection (Nonce)"
                            secondary={config.requireNonce ? 'Enabled' : 'Disabled'}
                          />
                        </ListItem>
                        {config.algorithm.startsWith('JWT') && (
                          <ListItem>
                            <ListItemIcon>
                              <InfoIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="JWT Expiration"
                              secondary={`${config.jwtExpiresInSeconds} seconds`}
                            />
                          </ListItem>
                        )}
                      </List>

                      {config.publicKey && (
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2">Public Key</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box sx={{ position: 'relative' }}>
                              <TextField
                                fullWidth
                                multiline
                                rows={4}
                                value={config.publicKey}
                                InputProps={{
                                  readOnly: true,
                                  sx: { fontFamily: 'monospace', fontSize: '0.8rem' }
                                }}
                              />
                              <IconButton
                                sx={{ position: 'absolute', top: 8, right: 8 }}
                                onClick={() => copyToClipboard(config.publicKey)}
                              >
                                <CopyIcon />
                              </IconButton>
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <SignatureVerificationTool />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <SigningSampleCode algorithms={algorithms} />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <SigningTroubleshooting apiKeys={apiKeys} />
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <SigningStatistics apiKeys={apiKeys} configurations={configurations} />
      </TabPanel>

      {/* Create Configuration Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Signing Configuration</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Configuration Name"
                  value={newConfig.name}
                  onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={newConfig.description}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Algorithm</InputLabel>
                  <Select
                    value={newConfig.algorithm}
                    onChange={(e) => setNewConfig({ ...newConfig, algorithm: e.target.value })}
                  >
                    {algorithms.map((algo) => (
                      <MenuItem key={algo.id} value={algo.id}>
                        <Box>
                          <Typography>{algo.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {algo.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Timestamp Tolerance (seconds)"
                  type="number"
                  value={newConfig.timestampToleranceSeconds}
                  onChange={(e) => setNewConfig({
                    ...newConfig,
                    timestampToleranceSeconds: parseInt(e.target.value)
                  })}
                  InputProps={{ inputProps: { min: 60, max: 3600 } }}
                />
              </Grid>
              {newConfig.algorithm.includes('RSA') && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Key Size</InputLabel>
                    <Select
                      value={newConfig.keySize}
                      onChange={(e) => setNewConfig({ ...newConfig, keySize: Number(e.target.value) })}
                    >
                      <MenuItem value={2048}>2048 bits</MenuItem>
                      <MenuItem value={3072}>3072 bits</MenuItem>
                      <MenuItem value={4096}>4096 bits</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {newConfig.algorithm.startsWith('JWT') && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="JWT Expiration (seconds)"
                    type="number"
                    value={newConfig.jwtExpiresInSeconds}
                    onChange={(e) => setNewConfig({
                      ...newConfig,
                      jwtExpiresInSeconds: parseInt(e.target.value)
                    })}
                    InputProps={{ inputProps: { min: 60, max: 3600 } }}
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newConfig.requireNonce}
                      onChange={(e) => setNewConfig({
                        ...newConfig,
                        requireNonce: e.target.checked
                      })}
                    />
                  }
                  label="Require nonce (replay protection)"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newConfig.requireBodyHash}
                      onChange={(e) => setNewConfig({
                        ...newConfig,
                        requireBodyHash: e.target.checked
                      })}
                    />
                  }
                  label="Require body hash"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={newConfig.requireSecureTransport}
                      onChange={(e) => setNewConfig({
                        ...newConfig,
                        requireSecureTransport: e.target.checked
                      })}
                    />
                  }
                  label="Require HTTPS"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateConfig}
            variant="contained"
            disabled={!newConfig.name}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Configuration Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Signing Configuration</DialogTitle>
        <DialogContent>
          {selectedConfig && (
            <Box sx={{ pt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Configuration Name"
                    value={selectedConfig.name}
                    onChange={(e) => setSelectedConfig({
                      ...selectedConfig,
                      name: e.target.value
                    })}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    value={selectedConfig.description || ''}
                    onChange={(e) => setSelectedConfig({
                      ...selectedConfig,
                      description: e.target.value
                    })}
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Alert severity="info">
                    Algorithm cannot be changed after creation
                  </Alert>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Timestamp Tolerance (seconds)"
                    type="number"
                    value={selectedConfig.timestampToleranceSeconds}
                    onChange={(e) => setSelectedConfig({
                      ...selectedConfig,
                      timestampToleranceSeconds: parseInt(e.target.value)
                    })}
                    InputProps={{ inputProps: { min: 60, max: 3600 } }}
                  />
                </Grid>
                {selectedConfig.algorithm.startsWith('JWT') && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="JWT Expiration (seconds)"
                      type="number"
                      value={selectedConfig.jwtExpiresInSeconds}
                      onChange={(e) => setSelectedConfig({
                        ...selectedConfig,
                        jwtExpiresInSeconds: parseInt(e.target.value)
                      })}
                      InputProps={{ inputProps: { min: 60, max: 3600 } }}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedConfig.requireNonce}
                        onChange={(e) => setSelectedConfig({
                          ...selectedConfig,
                          requireNonce: e.target.checked
                        })}
                      />
                    }
                    label="Require nonce (replay protection)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedConfig.requireBodyHash}
                        onChange={(e) => setSelectedConfig({
                          ...selectedConfig,
                          requireBodyHash: e.target.checked
                        })}
                      />
                    }
                    label="Require body hash"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedConfig.requireSecureTransport}
                        onChange={(e) => setSelectedConfig({
                          ...selectedConfig,
                          requireSecureTransport: e.target.checked
                        })}
                      />
                    }
                    label="Require HTTPS"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectedConfig.isActive}
                        onChange={(e) => setSelectedConfig({
                          ...selectedConfig,
                          isActive: e.target.checked
                        })}
                      />
                    }
                    label="Active"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateConfig}
            variant="contained"
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert severity="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Separate components for tabs

const SigningTroubleshooting: React.FC<{ apiKeys: any[] }> = ({ apiKeys }) => {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState('');
  const [daysBack, setDaysBack] = useState(7);

  const loadErrors = async () => {
    try {
      setLoading(true);
      const data = await signingService.getVerificationErrors(
        selectedApiKey || undefined,
        daysBack
      );
      setErrors(data);
    } catch (err) {
      console.error('Failed to load verification errors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadErrors();
  }, [selectedApiKey, daysBack]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Signature Verification Errors
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>API Key</InputLabel>
          <Select
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
          >
            <MenuItem value="">All Keys</MenuItem>
            {apiKeys.map((key) => (
              <MenuItem key={key.id} value={key.id}>
                {key.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Days Back</InputLabel>
          <Select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
          >
            <MenuItem value={1}>1 day</MenuItem>
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
            <MenuItem value={90}>90 days</MenuItem>
          </Select>
        </FormControl>
        
        <Button
          variant="outlined"
          onClick={loadErrors}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <CircularProgress />
      ) : errors.length === 0 ? (
        <Alert severity="success">
          No verification errors found in the selected period
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>API Key</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Endpoint</TableCell>
                <TableCell>Error</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {errors.map((error) => (
                <TableRow key={error.id}>
                  <TableCell>
                    {format(new Date(error.verifiedAt), 'MMM d HH:mm:ss')}
                  </TableCell>
                  <TableCell>{error.apiKeyId}</TableCell>
                  <TableCell>{error.method}</TableCell>
                  <TableCell>{error.endpoint}</TableCell>
                  <TableCell>
                    <Chip
                      label={error.errorCode}
                      color="error"
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={error.errorMessage}>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                        {error.errorMessage}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

const SigningStatistics: React.FC<{ apiKeys: any[], configurations: any[] }> = ({
  apiKeys,
  configurations
}) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState('');
  const [selectedConfig, setSelectedConfig] = useState('');
  const [daysBack, setDaysBack] = useState(30);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await signingService.getVerificationStats(
        selectedApiKey || undefined,
        selectedConfig || undefined,
        daysBack
      );
      setStats(data);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedApiKey, selectedConfig, daysBack]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Signature Verification Statistics
      </Typography>
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>API Key</InputLabel>
          <Select
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
          >
            <MenuItem value="">All Keys</MenuItem>
            {apiKeys.map((key) => (
              <MenuItem key={key.id} value={key.id}>
                {key.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Configuration</InputLabel>
          <Select
            value={selectedConfig}
            onChange={(e) => setSelectedConfig(e.target.value)}
          >
            <MenuItem value="">All Configurations</MenuItem>
            {configurations.map((config) => (
              <MenuItem key={config.id} value={config.id}>
                {config.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value))}
          >
            <MenuItem value={7}>7 days</MenuItem>
            <MenuItem value={30}>30 days</MenuItem>
            <MenuItem value={90}>90 days</MenuItem>
            <MenuItem value={365}>1 year</MenuItem>
          </Select>
        </FormControl>
        
        <Button
          variant="outlined"
          onClick={loadStats}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <CircularProgress />
      ) : stats ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Verifications
                </Typography>
                <Typography variant="h4">
                  {stats.total_verifications.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Success Rate
                </Typography>
                <Typography variant="h4" color="success.main">
                  {stats.success_rate.toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Failed Signatures
                </Typography>
                <Typography variant="h4" color="error.main">
                  {stats.invalid_signatures.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Avg Verification Time
                </Typography>
                <Typography variant="h4">
                  {stats.average_verification_time_ms.toFixed(0)}ms
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          {Object.keys(stats.error_breakdown).length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Error Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(stats.error_breakdown).map(([error, count]) => (
                      <Chip
                        key={error}
                        label={`${error}: ${count}`}
                        color="error"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      ) : null}
    </Box>
  );
};