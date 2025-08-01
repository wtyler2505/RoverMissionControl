import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Switch,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox,
  ListItemText,
  OutlinedInput,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as ApplyIcon,
  Gavel as LegalHoldIcon,
  Storage as StorageIcon,
  Archive as ArchiveIcon,
  DeleteForever as DeleteForeverIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Policy as PolicyIcon,
  Check as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format, addDays } from 'date-fns';
import auditService, { getComplianceColor } from '../../../services/auditService';
import {
  RetentionPolicy,
  ComplianceFramework,
  AuditCategory
} from '../../../types/audit';

interface PolicyFormData {
  name: string;
  description: string;
  compliance_framework?: ComplianceFramework;
  categories: AuditCategory[];
  retention_days: number;
  archive_after_days?: number;
  delete_after_days: number;
  is_active: boolean;
  legal_hold: boolean;
}

const defaultFormData: PolicyFormData = {
  name: '',
  description: '',
  categories: [],
  retention_days: 365,
  archive_after_days: undefined,
  delete_after_days: 2555, // 7 years default
  is_active: true,
  legal_hold: false
};

const complianceDefaults: Record<ComplianceFramework, { retention: number; delete: number }> = {
  [ComplianceFramework.SOX]: { retention: 2555, delete: 2555 }, // 7 years
  [ComplianceFramework.PCI_DSS]: { retention: 365, delete: 365 }, // 1 year
  [ComplianceFramework.GDPR]: { retention: 1095, delete: 1095 }, // 3 years
  [ComplianceFramework.HIPAA]: { retention: 2190, delete: 2190 }, // 6 years
  [ComplianceFramework.ISO_27001]: { retention: 1095, delete: 1095 }, // 3 years
  [ComplianceFramework.CCPA]: { retention: 730, delete: 730 } // 2 years
};

const RetentionPolicyManager: React.FC = () => {
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [formData, setFormData] = useState<PolicyFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [applyResults, setApplyResults] = useState<any>(null);
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await auditService.getRetentionPolicies();
      setPolicies(data);
    } catch (err) {
      setError('Failed to load retention policies');
      console.error('Policies error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePolicy = async (policyId: string, isActive: boolean) => {
    try {
      await auditService.updateRetentionPolicy(policyId, { is_active: isActive });
      setPolicies(prev => prev.map(policy => 
        policy.id === policyId ? { ...policy, is_active: isActive } : policy
      ));
    } catch (err) {
      console.error('Toggle policy error:', err);
    }
  };

  const handleApplyPolicy = async (policyId: string) => {
    if (!window.confirm('Are you sure you want to apply this retention policy? This will archive/delete logs based on the policy settings.')) {
      return;
    }
    
    try {
      setApplying(policyId);
      const result = await auditService.applyRetentionPolicy(policyId);
      setApplyResults(result);
      setShowApplyDialog(true);
      await fetchPolicies(); // Refresh to get updated counts
    } catch (err) {
      console.error('Apply policy error:', err);
    } finally {
      setApplying(null);
    }
  };

  const handleEditPolicy = (policy: RetentionPolicy) => {
    setEditingPolicy(policy);
    setFormData({
      name: policy.name,
      description: policy.description || '',
      compliance_framework: policy.compliance_framework,
      categories: policy.categories,
      retention_days: policy.retention_days,
      archive_after_days: policy.archive_after_days,
      delete_after_days: policy.delete_after_days,
      is_active: policy.is_active,
      legal_hold: policy.legal_hold
    });
    setShowDialog(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (window.confirm('Are you sure you want to delete this retention policy?')) {
      try {
        await auditService.deleteRetentionPolicy(policyId);
        await fetchPolicies();
      } catch (err) {
        console.error('Delete policy error:', err);
      }
    }
  };

  const handleSavePolicy = async () => {
    try {
      setSaving(true);
      
      if (editingPolicy) {
        await auditService.updateRetentionPolicy(editingPolicy.id, formData);
      } else {
        await auditService.createRetentionPolicy(formData as any);
      }
      
      await fetchPolicies();
      handleCloseDialog();
    } catch (err) {
      console.error('Save policy error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingPolicy(null);
    setFormData(defaultFormData);
  };

  const handleComplianceFrameworkChange = (framework: ComplianceFramework | '') => {
    if (framework && complianceDefaults[framework]) {
      const defaults = complianceDefaults[framework];
      setFormData(prev => ({
        ...prev,
        compliance_framework: framework,
        retention_days: defaults.retention,
        delete_after_days: defaults.delete
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        compliance_framework: undefined
      }));
    }
  };

  const getTotalAffectedLogs = () => {
    return policies.reduce((sum, policy) => sum + policy.applied_count, 0);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Retention Policy Manager
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowDialog(true)}
        >
          Create Policy
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Policy Statistics */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total Policies
                  </Typography>
                  <Typography variant="h4">
                    {policies.length}
                  </Typography>
                </Box>
                <PolicyIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Active Policies
                  </Typography>
                  <Typography variant="h4">
                    {policies.filter(p => p.is_active).length}
                  </Typography>
                </Box>
                <CheckIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Logs Managed
                  </Typography>
                  <Typography variant="h4">
                    {getTotalAffectedLogs().toLocaleString()}
                  </Typography>
                </Box>
                <StorageIcon color="action" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Policies Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Policy Name</TableCell>
              <TableCell>Framework</TableCell>
              <TableCell>Categories</TableCell>
              <TableCell>Retention</TableCell>
              <TableCell>Archive</TableCell>
              <TableCell>Delete</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Applied To</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((policy) => (
              <TableRow key={policy.id}>
                <TableCell>
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {policy.name}
                      {policy.legal_hold && (
                        <Tooltip title="Legal Hold">
                          <LegalHoldIcon 
                            fontSize="small" 
                            color="warning" 
                            sx={{ ml: 1, verticalAlign: 'middle' }}
                          />
                        </Tooltip>
                      )}
                    </Typography>
                    {policy.description && (
                      <Typography variant="caption" color="textSecondary">
                        {policy.description}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {policy.compliance_framework ? (
                    <Chip
                      label={policy.compliance_framework.toUpperCase().replace(/_/g, ' ')}
                      size="small"
                      style={{
                        backgroundColor: getComplianceColor(policy.compliance_framework),
                        color: 'white'
                      }}
                    />
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {policy.categories.length > 0 ? (
                    <Tooltip title={policy.categories.map(c => c.replace(/_/g, ' ')).join(', ')}>
                      <Chip label={`${policy.categories.length} categories`} size="small" />
                    </Tooltip>
                  ) : (
                    <Chip label="All" size="small" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>{policy.retention_days} days</TableCell>
                <TableCell>
                  {policy.archive_after_days ? `${policy.archive_after_days} days` : '-'}
                </TableCell>
                <TableCell>{policy.delete_after_days} days</TableCell>
                <TableCell>
                  <Switch
                    checked={policy.is_active}
                    onChange={(e) => handleTogglePolicy(policy.id, e.target.checked)}
                    color="primary"
                    disabled={policy.legal_hold}
                  />
                </TableCell>
                <TableCell>
                  {policy.applied_count.toLocaleString()} logs
                </TableCell>
                <TableCell align="right">
                  <Box display="flex" justifyContent="flex-end" gap={1}>
                    <Tooltip title="Apply Policy">
                      <IconButton
                        size="small"
                        onClick={() => handleApplyPolicy(policy.id)}
                        disabled={applying === policy.id || !policy.is_active}
                      >
                        {applying === policy.id ? <CircularProgress size={16} /> : <ApplyIcon />}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEditPolicy(policy)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        onClick={() => handleDeletePolicy(policy.id)}
                        disabled={policy.legal_hold}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Policy Dialog */}
      <Dialog open={showDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingPolicy ? 'Edit Retention Policy' : 'Create Retention Policy'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Policy Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Compliance Framework</InputLabel>
                <Select
                  value={formData.compliance_framework || ''}
                  onChange={(e) => handleComplianceFrameworkChange(e.target.value as ComplianceFramework | '')}
                  label="Compliance Framework"
                >
                  <MenuItem value="">None</MenuItem>
                  {Object.values(ComplianceFramework).map(framework => (
                    <MenuItem key={framework} value={framework}>
                      {framework.toUpperCase().replace(/_/g, ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Categories</InputLabel>
                <Select
                  multiple
                  value={formData.categories}
                  onChange={(e) => setFormData(prev => ({ ...prev, categories: e.target.value as AuditCategory[] }))}
                  input={<OutlinedInput label="Categories" />}
                  renderValue={(selected) => selected.length === 0 ? 'All Categories' : `${selected.length} selected`}
                >
                  {Object.values(AuditCategory).map(category => (
                    <MenuItem key={category} value={category}>
                      <Checkbox checked={formData.categories.includes(category)} />
                      <ListItemText primary={category.replace(/_/g, ' ')} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <Alert severity="info" icon={<InfoIcon />}>
                Retention timeline: Logs are kept for retention period → optionally archived → deleted after delete period
              </Alert>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Retention Days"
                value={formData.retention_days}
                onChange={(e) => setFormData(prev => ({ ...prev, retention_days: parseInt(e.target.value) }))}
                helperText="Days to keep logs accessible"
                required
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Archive After Days (Optional)"
                value={formData.archive_after_days || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  archive_after_days: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
                helperText="Days before archiving"
              />
            </Grid>
            
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="number"
                label="Delete After Days"
                value={formData.delete_after_days}
                onChange={(e) => setFormData(prev => ({ ...prev, delete_after_days: parseInt(e.target.value) }))}
                helperText="Days before permanent deletion"
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.legal_hold}
                    onChange={(e) => setFormData(prev => ({ ...prev, legal_hold: e.target.checked }))}
                  />
                }
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <LegalHoldIcon fontSize="small" />
                    Legal Hold (prevents deletion)
                  </Box>
                }
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                }
                label="Policy is active"
              />
            </Grid>
            
            {formData.compliance_framework && (
              <Grid item xs={12}>
                <Alert severity="warning" icon={<WarningIcon />}>
                  {formData.compliance_framework.toUpperCase().replace(/_/g, ' ')} requires minimum retention of{' '}
                  {complianceDefaults[formData.compliance_framework].retention} days
                </Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSavePolicy}
            variant="contained"
            disabled={saving || !formData.name || formData.retention_days <= 0 || formData.delete_after_days <= 0}
            startIcon={saving && <CircularProgress size={16} />}
          >
            {editingPolicy ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Results Dialog */}
      <Dialog open={showApplyDialog} onClose={() => setShowApplyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Policy Application Results</DialogTitle>
        <DialogContent>
          {applyResults && (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                Retention policy applied successfully
              </Alert>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    <ArchiveIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Logs Archived"
                    secondary={`${applyResults.archived_count.toLocaleString()} logs`}
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <DeleteForeverIcon color="error" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Logs Deleted"
                    secondary={`${applyResults.deleted_count.toLocaleString()} logs`}
                  />
                </ListItem>
                
                {applyResults.errors && applyResults.errors.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <ListItem>
                      <ListItemIcon>
                        <WarningIcon color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Errors Encountered"
                        secondary={
                          <List dense>
                            {applyResults.errors.map((error: string, index: number) => (
                              <ListItem key={index}>
                                <Typography variant="body2" color="error">
                                  • {error}
                                </Typography>
                              </ListItem>
                            ))}
                          </List>
                        }
                      />
                    </ListItem>
                  </>
                )}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowApplyDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RetentionPolicyManager;