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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  VpnKey as KeyIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

import { VersioningService } from '../../../services/versioningService';
import {
  EncryptionConfig,
  EncryptionType,
  EncryptionAlgorithm,
  EncryptionFormData,
  KeyRotationPolicy,
  RotationFrequency,
  HSMConfig,
} from '../../../types/versioning';

const EncryptionConfigComponent: React.FC = () => {
  const [configs, setConfigs] = useState<EncryptionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<EncryptionConfig | null>(null);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [encryptionStatus, setEncryptionStatus] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState<EncryptionFormData>({
    name: '',
    type: EncryptionType.IN_TRANSIT,
    algorithm: EncryptionAlgorithm.AES_256_GCM,
    keySize: 256,
    configuration: {},
    complianceFrameworks: [],
  });

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await VersioningService.getEncryptionConfigs();
      if (response.success) {
        setConfigs(response.data);
      } else {
        setError(response.message || 'Failed to load encryption configurations');
      }
    } catch (err) {
      console.error('Error loading encryption configs:', err);
      setError('Failed to load encryption configurations');
    } finally {
      setLoading(false);
    }
  };

  const loadEncryptionStatus = async () => {
    try {
      const response = await VersioningService.getEncryptionStatus();
      if (response.success) {
        setEncryptionStatus(response.data);
      }
    } catch (err) {
      console.error('Error loading encryption status:', err);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadEncryptionStatus();
  }, []);

  const handleCreate = () => {
    setSelectedConfig(null);
    setFormData({
      name: '',
      type: EncryptionType.IN_TRANSIT,
      algorithm: EncryptionAlgorithm.AES_256_GCM,
      keySize: 256,
      configuration: {},
      complianceFrameworks: [],
    });
    setMode('create');
    setFormOpen(true);
  };

  const handleEdit = (config: EncryptionConfig) => {
    setSelectedConfig(config);
    setFormData({
      name: config.name,
      type: config.type,
      algorithm: config.algorithm,
      keySize: config.keySize,
      configuration: config.configuration,
      complianceFrameworks: config.complianceFrameworks,
      rotationPolicy: config.rotationPolicy,
      hsm: config.hsm,
    });
    setMode('edit');
    setFormOpen(true);
  };

  const handleDelete = async (config: EncryptionConfig) => {
    if (window.confirm(`Are you sure you want to delete encryption configuration "${config.name}"?`)) {
      try {
        const response = await VersioningService.deleteEncryptionConfig(config.id);
        if (response.success) {
          loadConfigs();
          loadEncryptionStatus();
        } else {
          setError(response.message || 'Failed to delete encryption configuration');
        }
      } catch (err) {
        console.error('Error deleting encryption config:', err);
        setError('Failed to delete encryption configuration');
      }
    }
  };

  const handleSubmit = async () => {
    try {
      if (mode === 'create') {
        const response = await VersioningService.createEncryptionConfig(formData);
        if (!response.success) {
          setError(response.message || 'Failed to create encryption configuration');
          return;
        }
      } else if (selectedConfig) {
        const response = await VersioningService.updateEncryptionConfig(selectedConfig.id, formData);
        if (!response.success) {
          setError(response.message || 'Failed to update encryption configuration');
          return;
        }
      }
      setFormOpen(false);
      loadConfigs();
      loadEncryptionStatus();
    } catch (err) {
      console.error('Error saving encryption config:', err);
      setError('Failed to save encryption configuration');
    }
  };

  const getTypeIcon = (type: EncryptionType) => {
    switch (type) {
      case EncryptionType.IN_TRANSIT:
        return <CloudIcon />;
      case EncryptionType.AT_REST:
        return <StorageIcon />;
      case EncryptionType.FIELD_LEVEL:
      case EncryptionType.END_TO_END:
        return <LockIcon />;
      default:
        return <SecurityIcon />;
    }
  };

  const getAlgorithmKeySize = (algorithm: EncryptionAlgorithm): number[] => {
    switch (algorithm) {
      case EncryptionAlgorithm.AES_256_GCM:
      case EncryptionAlgorithm.AES_256_CBC:
        return [256];
      case EncryptionAlgorithm.CHACHA20_POLY1305:
        return [256];
      case EncryptionAlgorithm.RSA_4096:
        return [2048, 3072, 4096];
      case EncryptionAlgorithm.ECC_P256:
        return [256];
      case EncryptionAlgorithm.ECC_P384:
        return [384];
      default:
        return [256];
    }
  };

  const renderConfigurationFields = () => {
    switch (formData.type) {
      case EncryptionType.IN_TRANSIT:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="TLS Version"
                value={formData.configuration.tlsVersion || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  configuration: { ...prev.configuration, tlsVersion: e.target.value }
                }))}
                placeholder="1.3"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Cipher Suites (comma-separated)"
                value={formData.configuration.cipherSuites?.join(', ') || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  configuration: {
                    ...prev.configuration,
                    cipherSuites: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }
                }))}
                placeholder="TLS_AES_256_GCM_SHA384, TLS_AES_128_GCM_SHA256"
              />
            </Grid>
          </Grid>
        );

      case EncryptionType.FIELD_LEVEL:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Encrypted Fields (comma-separated)"
                value={formData.configuration.encryptedFields?.join(', ') || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  configuration: {
                    ...prev.configuration,
                    encryptedFields: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }
                }))}
                placeholder="email, ssn, creditCard"
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  const renderRotationPolicy = () => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">Key Rotation Policy</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.rotationPolicy?.enabled || false}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rotationPolicy: {
                      ...prev.rotationPolicy,
                      enabled: e.target.checked,
                      frequency: prev.rotationPolicy?.frequency || RotationFrequency.MONTHLY,
                      gracePeriod: prev.rotationPolicy?.gracePeriod || 24,
                      autoRotate: prev.rotationPolicy?.autoRotate || false,
                      notificationPeriod: prev.rotationPolicy?.notificationPeriod || 168,
                      retainOldKeys: prev.rotationPolicy?.retainOldKeys || 3,
                    }
                  }))}
                />
              }
              label="Enable Key Rotation"
            />
          </Grid>

          {formData.rotationPolicy?.enabled && (
            <>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Rotation Frequency</InputLabel>
                  <Select
                    value={formData.rotationPolicy?.frequency || RotationFrequency.MONTHLY}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      rotationPolicy: {
                        ...prev.rotationPolicy!,
                        frequency: e.target.value as RotationFrequency
                      }
                    }))}
                    label="Rotation Frequency"
                  >
                    {Object.values(RotationFrequency).map((freq) => (
                      <MenuItem key={freq} value={freq}>
                        {freq.replace('_', ' ').toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Grace Period (hours)"
                  value={formData.rotationPolicy?.gracePeriod || 24}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rotationPolicy: {
                      ...prev.rotationPolicy!,
                      gracePeriod: parseInt(e.target.value)
                    }
                  }))}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Notification Period (hours)"
                  value={formData.rotationPolicy?.notificationPeriod || 168}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rotationPolicy: {
                      ...prev.rotationPolicy!,
                      notificationPeriod: parseInt(e.target.value)
                    }
                  }))}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Retain Old Keys"
                  value={formData.rotationPolicy?.retainOldKeys || 3}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rotationPolicy: {
                      ...prev.rotationPolicy!,
                      retainOldKeys: parseInt(e.target.value)
                    }
                  }))}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.rotationPolicy?.autoRotate || false}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        rotationPolicy: {
                          ...prev.rotationPolicy!,
                          autoRotate: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Auto Rotate Keys"
                />
              </Grid>
            </>
          )}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  const renderHSMConfig = () => (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">HSM Configuration</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.hsm?.enabled || false}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    hsm: {
                      ...prev.hsm,
                      enabled: e.target.checked,
                      provider: prev.hsm?.provider || '',
                      authMethod: prev.hsm?.authMethod || 'token',
                      configuration: prev.hsm?.configuration || {},
                    }
                  }))}
                />
              }
              label="Use Hardware Security Module"
            />
          </Grid>

          {formData.hsm?.enabled && (
            <>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="HSM Provider"
                  value={formData.hsm?.provider || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    hsm: {
                      ...prev.hsm!,
                      provider: e.target.value
                    }
                  }))}
                  placeholder="AWS CloudHSM, Azure Dedicated HSM"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="HSM Endpoint"
                  value={formData.hsm?.endpoint || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    hsm: {
                      ...prev.hsm!,
                      endpoint: e.target.value
                    }
                  }))}
                  placeholder="https://hsm.example.com"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Key Label"
                  value={formData.hsm?.keyLabel || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    hsm: {
                      ...prev.hsm!,
                      keyLabel: e.target.value
                    }
                  }))}
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Auth Method</InputLabel>
                  <Select
                    value={formData.hsm?.authMethod || 'token'}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      hsm: {
                        ...prev.hsm!,
                        authMethod: e.target.value
                      }
                    }))}
                    label="Auth Method"
                  >
                    <MenuItem value="token">Token</MenuItem>
                    <MenuItem value="certificate">Certificate</MenuItem>
                    <MenuItem value="password">Password</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
        </Grid>
      </AccordionDetails>
    </Accordion>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Encryption Configuration</Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => setStatusOpen(true)}
            sx={{ mr: 1 }}
          >
            Status
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            Create Configuration
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Encryption Status Overview */}
      {encryptionStatus && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Encryption Status Overview
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <SecurityIcon color="primary" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Overall Coverage
                  </Typography>
                  <Typography variant="h6">
                    {(encryptionStatus.coverage * 100).toFixed(1)}%
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <KeyIcon color="success" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Active Keys
                  </Typography>
                  <Typography variant="h6">
                    {encryptionStatus.activeKeys}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon color="warning" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Expiring Soon
                  </Typography>
                  <Typography variant="h6">
                    {encryptionStatus.expiringSoon}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CheckIcon color="success" sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    Compliant
                  </Typography>
                  <Typography variant="h6">
                    {encryptionStatus.compliant ? 'Yes' : 'No'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Configurations Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {configs.map((config) => (
            <Grid item xs={12} md={6} lg={4} key={config.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getTypeIcon(config.type)}
                      <Typography variant="h6" component="div" sx={{ ml: 1 }}>
                        {config.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={config.isActive ? 'Active' : 'Inactive'}
                      color={config.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Chip
                    label={config.type.replace('_', ' ').toUpperCase()}
                    color="primary"
                    size="small"
                    sx={{ mb: 1, mr: 1 }}
                  />
                  <Chip
                    label={config.algorithm.replace('_', ' ').toUpperCase()}
                    color="secondary"
                    size="small"
                    sx={{ mb: 1 }}
                  />

                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Key Size: {config.keySize} bits
                  </Typography>

                  {config.complianceFrameworks.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Compliance:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {config.complianceFrameworks.map((framework) => (
                          <Chip
                            key={framework}
                            label={framework}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {config.rotationPolicy?.enabled && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <RefreshIcon fontSize="small" color="info" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="textSecondary">
                        Auto-rotation: {config.rotationPolicy.frequency}
                      </Typography>
                    </Box>
                  )}

                  {config.hsm?.enabled && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <SecurityIcon fontSize="small" color="warning" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="textSecondary">
                        HSM: {config.hsm.provider}
                      </Typography>
                    </Box>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => handleEdit(config)}
                  >
                    Edit
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(config)}
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

      {/* Configuration Form Dialog */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {mode === 'create' ? 'Create Encryption Configuration' : 'Edit Encryption Configuration'}
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 600 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Configuration Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Encryption Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as EncryptionType }))}
                  label="Encryption Type"
                >
                  {Object.values(EncryptionType).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Algorithm</InputLabel>
                <Select
                  value={formData.algorithm}
                  onChange={(e) => {
                    const algorithm = e.target.value as EncryptionAlgorithm;
                    const keySizes = getAlgorithmKeySize(algorithm);
                    setFormData(prev => ({
                      ...prev,
                      algorithm,
                      keySize: keySizes[0]
                    }));
                  }}
                  label="Algorithm"
                >
                  {Object.values(EncryptionAlgorithm).map((algorithm) => (
                    <MenuItem key={algorithm} value={algorithm}>
                      {algorithm.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Key Size</InputLabel>
                <Select
                  value={formData.keySize}
                  onChange={(e) => setFormData(prev => ({ ...prev, keySize: e.target.value as number }))}
                  label="Key Size"
                >
                  {getAlgorithmKeySize(formData.algorithm).map((size) => (
                    <MenuItem key={size} value={size}>
                      {size} bits
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Compliance Frameworks (comma-separated)"
                value={formData.complianceFrameworks.join(', ')}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  complianceFrameworks: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                }))}
                placeholder="GDPR, HIPAA, SOX"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Type-Specific Configuration
              </Typography>
              {renderConfigurationFields()}
            </Grid>

            <Grid item xs={12}>
              {renderRotationPolicy()}
            </Grid>

            <Grid item xs={12}>
              {renderHSMConfig()}
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

      {/* Encryption Status Dialog */}
      <Dialog open={statusOpen} onClose={() => setStatusOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Encryption Status Details</DialogTitle>
        <DialogContent dividers>
          {encryptionStatus && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Coverage by Type
                </Typography>
                {Object.entries(encryptionStatus.coverageByType || {}).map(([type, coverage]) => (
                  <Box key={type} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2">
                        {type.replace('_', ' ').toUpperCase()}
                      </Typography>
                      <Typography variant="body2">
                        {((coverage as number) * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(coverage as number) * 100}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                ))}
              </Grid>

              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Key Status
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Active Keys"
                      secondary={`${encryptionStatus.activeKeys} keys currently in use`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <WarningIcon color="warning" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Expiring Soon"
                      secondary={`${encryptionStatus.expiringSoon} keys expiring within 30 days`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <ErrorIcon color="error" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Expired Keys"
                      secondary={`${encryptionStatus.expiredKeys} keys that need rotation`}
                    />
                  </ListItem>
                </List>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusOpen(false)}>Close</Button>
          <Button onClick={loadEncryptionStatus} startIcon={<RefreshIcon />}>
            Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EncryptionConfigComponent;