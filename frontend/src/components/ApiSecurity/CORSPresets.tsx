import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
  Badge,
  CircularProgress
} from '@mui/material';
import {
  Collections as PresetIcon,
  DeveloperMode as DevIcon,
  Public as ProductionIcon,
  Api as ApiIcon,
  PhoneAndroid as MobileIcon,
  Add as AddIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Security as SecurityIcon,
  ContentCopy as CopyIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { corsService } from '../../services/corsService';
import {
  CORSPreset,
  CreatePolicyFromPresetRequest,
  CORSPolicyCreate
} from '../../types/cors';

interface CORSPresetsProps {
  onCreatePolicy: () => void;
}

interface CreatePolicyDialogProps {
  open: boolean;
  preset: CORSPreset | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePolicyDialog({ open, preset, onClose, onSuccess }: CreatePolicyDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [policyName, setPolicyName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preset) {
      setPolicyName(`${preset.name} - ${new Date().toLocaleDateString()}`);
    }
  }, [preset]);

  const handleCreate = async () => {
    if (!preset || !policyName.trim()) return;

    try {
      setLoading(true);
      const request: CreatePolicyFromPresetRequest = {
        policy_name: policyName
      };
      
      await corsService.createPolicyFromPreset(preset.id, request);
      enqueueSnackbar('Policy created successfully from preset', { variant: 'success' });
      onSuccess();
      onClose();
    } catch (error: any) {
      enqueueSnackbar('Failed to create policy from preset', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Policy from Preset</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          This will create a new CORS policy based on the "{preset?.name}" preset configuration.
        </Alert>
        
        <TextField
          fullWidth
          label="Policy Name"
          value={policyName}
          onChange={(e) => setPolicyName(e.target.value)}
          placeholder="Enter a unique name for the new policy"
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          color="primary"
          disabled={loading || !policyName.trim()}
        >
          {loading ? 'Creating...' : 'Create Policy'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export const CORSPresets: React.FC<CORSPresetsProps> = ({ onCreatePolicy }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [presets, setPresets] = useState<CORSPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<CORSPreset | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsPreset, setDetailsPreset] = useState<CORSPreset | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const data = await corsService.getPresets();
      setPresets(data);
    } catch (error: any) {
      enqueueSnackbar('Failed to load CORS presets', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'development':
        return <DevIcon />;
      case 'production':
        return <ProductionIcon />;
      case 'api':
        return <ApiIcon />;
      case 'mobile':
        return <MobileIcon />;
      default:
        return <PresetIcon />;
    }
  };

  const getCategoryColor = (category?: string) => {
    switch (category) {
      case 'development':
        return 'warning';
      case 'production':
        return 'error';
      case 'api':
        return 'primary';
      case 'mobile':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const handleUsePreset = (preset: CORSPreset) => {
    setSelectedPreset(preset);
    setCreateDialogOpen(true);
  };

  const copyConfiguration = (config: any) => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    enqueueSnackbar('Configuration copied to clipboard', { variant: 'success' });
  };

  const formatConfigValue = (value: any): string => {
    if (Array.isArray(value)) {
      return value.length === 0 ? 'None' : value.join(', ');
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return value || 'Not set';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          CORS presets provide pre-configured templates for common use cases. 
          Select a preset to quickly create a new policy with recommended settings.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {presets.map((preset) => (
          <Grid item xs={12} md={6} key={preset.id}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                  {getCategoryIcon(preset.category)}
                  <Typography variant="h6" component="div">
                    {preset.name}
                  </Typography>
                  {preset.is_system && (
                    <Chip
                      icon={<SecurityIcon />}
                      label="System"
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {preset.usage_count > 0 && (
                    <Badge badgeContent={preset.usage_count} color="secondary">
                      <Chip
                        label="Used"
                        size="small"
                        variant="outlined"
                      />
                    </Badge>
                  )}
                </Box>

                <Typography variant="body2" color="textSecondary" gutterBottom>
                  {preset.description}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Configuration Summary:
                </Typography>

                <List dense>
                  {preset.configuration.allowed_origins && (
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Origins"
                        secondary={formatConfigValue(
                          preset.configuration.allow_all_origins 
                            ? 'All Origins' 
                            : preset.configuration.allowed_origins
                        )}
                      />
                    </ListItem>
                  )}

                  {preset.configuration.allowed_methods && (
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Methods"
                        secondary={formatConfigValue(
                          preset.configuration.allow_all_methods
                            ? 'All Methods'
                            : preset.configuration.allowed_methods
                        )}
                      />
                    </ListItem>
                  )}

                  {preset.configuration.allowed_headers && (
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Headers"
                        secondary={formatConfigValue(
                          preset.configuration.allow_all_headers
                            ? 'All Headers'
                            : preset.configuration.allowed_headers
                        )}
                      />
                    </ListItem>
                  )}

                  <ListItem>
                    <ListItemIcon>
                      <CheckIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Credentials"
                      secondary={preset.configuration.allow_credentials ? 'Allowed' : 'Not Allowed'}
                    />
                  </ListItem>

                  {preset.configuration.max_age && (
                    <ListItem>
                      <ListItemIcon>
                        <CheckIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Max Age"
                        secondary={`${preset.configuration.max_age} seconds`}
                      />
                    </ListItem>
                  )}
                </List>
              </CardContent>

              <CardActions>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => handleUsePreset(preset)}
                >
                  Use Preset
                </Button>
                <Tooltip title="View Configuration">
                  <IconButton
                    onClick={() => setDetailsPreset(preset)}
                  >
                    <CodeIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Copy Configuration">
                  <IconButton
                    onClick={() => copyConfiguration(preset.configuration)}
                  >
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Policy Dialog */}
      <CreatePolicyDialog
        open={createDialogOpen}
        preset={selectedPreset}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          onCreatePolicy();
          loadPresets(); // Reload to update usage counts
        }}
      />

      {/* Configuration Details Dialog */}
      <Dialog
        open={!!detailsPreset}
        onClose={() => setDetailsPreset(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {detailsPreset?.name} Configuration
        </DialogTitle>
        <DialogContent>
          <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
            <Typography
              component="pre"
              variant="body2"
              sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}
            >
              {JSON.stringify(detailsPreset?.configuration, null, 2)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsPreset(null)}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<CopyIcon />}
            onClick={() => {
              if (detailsPreset) {
                copyConfiguration(detailsPreset.configuration);
              }
            }}
          >
            Copy
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};