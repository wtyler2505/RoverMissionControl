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
  Chip,
  Alert,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as ExecuteIcon,
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
  Undo as RollbackIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Description as DocumentIcon,
} from '@mui/icons-material';

import { VersioningService } from '../../../services/versioningService';
import {
  VersionMigration,
  MigrationStatus,
  CompatibilityLevel,
  MigrationStep,
  MigrationStepStatus,
  APIVersion,
} from '../../../types/versioning';

const MigrationManager: React.FC = () => {
  const [migrations, setMigrations] = useState<VersionMigration[]>([]);
  const [versions, setVersions] = useState<APIVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [planOpen, setPlanOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  
  const [selectedMigration, setSelectedMigration] = useState<VersionMigration | null>(null);
  const [migrationGuide, setMigrationGuide] = useState<string>('');
  
  // Plan form state
  const [planForm, setPlanForm] = useState({
    fromVersion: '',
    toVersion: '',
  });
  
  // Execution state
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  const loadMigrations = async () => {
    try {
      setLoading(true);
      const [migrationsResponse, versionsResponse] = await Promise.all([
        VersioningService.getMigrations(),
        VersioningService.getVersions(),
      ]);
      
      if (migrationsResponse.success) {
        setMigrations(migrationsResponse.data);
      }
      
      if (versionsResponse.success) {
        setVersions(versionsResponse.data);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load migration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMigrations();
  }, []);

  const handleCreatePlan = () => {
    setPlanForm({ fromVersion: '', toVersion: '' });
    setPlanOpen(true);
  };

  const handleSubmitPlan = async () => {
    try {
      const response = await VersioningService.createMigrationPlan(
        planForm.fromVersion,
        planForm.toVersion
      );
      
      if (response.success) {
        setPlanOpen(false);
        loadMigrations();
      } else {
        setError(response.message || 'Failed to create migration plan');
      }
    } catch (err) {
      console.error('Error creating migration plan:', err);
      setError('Failed to create migration plan');
    }
  };

  const handleViewMigration = (migration: VersionMigration) => {
    setSelectedMigration(migration);
    setViewOpen(true);
  };

  const handleExecuteMigration = (migration: VersionMigration) => {
    setSelectedMigration(migration);
    setExecutionResult(null);
    setExecuteOpen(true);
  };

  const handleRunExecution = async (dryRun = false) => {
    if (!selectedMigration) return;

    try {
      setExecuting(true);
      const response = await VersioningService.executeMigration(selectedMigration.id, dryRun);
      setExecutionResult(response.data);
      
      if (response.success && !dryRun) {
        loadMigrations(); // Refresh to show updated status
      }
    } catch (err) {
      console.error('Error executing migration:', err);
      setExecutionResult({ error: 'Failed to execute migration' });
    } finally {
      setExecuting(false);
    }
  };

  const handleRollback = async (migration: VersionMigration) => {
    if (window.confirm('Are you sure you want to rollback this migration?')) {
      try {
        const response = await VersioningService.rollbackMigration(migration.id);
        if (response.success) {
          loadMigrations();
        } else {
          setError(response.message || 'Failed to rollback migration');
        }
      } catch (err) {
        console.error('Error rolling back migration:', err);
        setError('Failed to rollback migration');
      }
    }
  };

  const handleDownloadGuide = async (migration: VersionMigration) => {
    try {
      setSelectedMigration(migration);
      const response = await VersioningService.getMigrationGuide(
        migration.fromVersion,
        migration.toVersion,
        'markdown'
      );
      
      if (response.success) {
        setMigrationGuide(response.data);
        setGuideOpen(true);
      } else {
        setError(response.message || 'Failed to generate migration guide');
      }
    } catch (err) {
      console.error('Error generating migration guide:', err);
      setError('Failed to generate migration guide');
    }
  };

  const getStatusColor = (status: MigrationStatus) => {
    switch (status) {
      case MigrationStatus.COMPLETED:
        return 'success';
      case MigrationStatus.IN_PROGRESS:
        return 'info';
      case MigrationStatus.FAILED:
        return 'error';
      case MigrationStatus.ROLLED_BACK:
        return 'warning';
      default:
        return 'default';
    }
  };

  const getCompatibilityColor = (level: CompatibilityLevel) => {
    switch (level) {
      case CompatibilityLevel.FULLY_COMPATIBLE:
        return 'success';
      case CompatibilityLevel.BACKWARD_COMPATIBLE:
        return 'info';
      case CompatibilityLevel.BREAKING_CHANGES:
        return 'warning';
      case CompatibilityLevel.INCOMPATIBLE:
        return 'error';
      default:
        return 'default';
    }
  };

  const getStepIcon = (status: MigrationStepStatus) => {
    switch (status) {
      case MigrationStepStatus.COMPLETED:
        return <CheckIcon color="success" />;
      case MigrationStepStatus.FAILED:
        return <ErrorIcon color="error" />;
      case MigrationStepStatus.RUNNING:
        return <CircularProgress size={16} />;
      default:
        return <InfoIcon color="disabled" />;
    }
  };

  const calculateProgress = (migration: VersionMigration): number => {
    if (!migration.executionLog || migration.executionLog.length === 0) return 0;
    
    const completedSteps = migration.executionLog.filter(
      log => log.status === MigrationStepStatus.COMPLETED
    ).length;
    
    return (completedSteps / migration.migrationSteps.length) * 100;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Migration Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreatePlan}
        >
          Create Migration Plan
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Migrations List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {migrations.map((migration) => (
            <Grid item xs={12} key={migration.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" component="div">
                        {migration.title}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {migration.fromVersion} → {migration.toVersion}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        label={migration.status.replace('_', ' ').toUpperCase()}
                        color={getStatusColor(migration.status)}
                        size="small"
                      />
                      <Chip
                        label={migration.compatibility.replace('_', ' ').toUpperCase()}
                        color={getCompatibilityColor(migration.compatibility)}
                        size="small"
                      />
                    </Box>
                  </Box>

                  {migration.description && (
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {migration.description}
                    </Typography>
                  )}

                  {/* Progress Bar for In-Progress Migrations */}
                  {migration.status === MigrationStatus.IN_PROGRESS && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="textSecondary" gutterBottom>
                        Migration Progress
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={calculateProgress(migration)}
                        sx={{ height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption" color="textSecondary">
                        {Math.round(calculateProgress(migration))}% complete
                      </Typography>
                    </Box>
                  )}

                  {/* Migration Steps Summary */}
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2">
                        Migration Steps ({migration.migrationSteps.length})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {migration.migrationSteps.map((step) => {
                          const log = migration.executionLog?.find(l => l.stepId === step.id);
                          return (
                            <ListItem key={step.id}>
                              <ListItemIcon>
                                {getStepIcon(log?.status || MigrationStepStatus.PENDING)}
                              </ListItemIcon>
                              <ListItemText
                                primary={step.title}
                                secondary={step.description}
                              />
                              {step.estimatedDuration && (
                                <Typography variant="caption" color="textSecondary">
                                  ~{step.estimatedDuration}min
                                </Typography>
                              )}
                            </ListItem>
                          );
                        })}
                      </List>
                    </AccordionDetails>
                  </Accordion>

                  {migration.estimatedDuration && (
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      Estimated Duration: {migration.estimatedDuration} minutes
                    </Typography>
                  )}
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => handleViewMigration(migration)}
                  >
                    View Details
                  </Button>
                  
                  {migration.status === MigrationStatus.PLANNED && (
                    <Button
                      size="small"
                      startIcon={<ExecuteIcon />}
                      onClick={() => handleExecuteMigration(migration)}
                      color="primary"
                    >
                      Execute
                    </Button>
                  )}
                  
                  {migration.status === MigrationStatus.COMPLETED && (
                    <Button
                      size="small"
                      startIcon={<RollbackIcon />}
                      onClick={() => handleRollback(migration)}
                      color="warning"
                    >
                      Rollback
                    </Button>
                  )}
                  
                  <Button
                    size="small"
                    startIcon={<DocumentIcon />}
                    onClick={() => handleDownloadGuide(migration)}
                  >
                    Migration Guide
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Migration Plan Dialog */}
      <Dialog open={planOpen} onClose={() => setPlanOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Migration Plan</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>From Version</InputLabel>
                <Select
                  value={planForm.fromVersion}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, fromVersion: e.target.value }))}
                  label="From Version"
                >
                  {versions.map((version) => (
                    <MenuItem key={version.id} value={version.version}>
                      {version.version} - {version.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>To Version</InputLabel>
                <Select
                  value={planForm.toVersion}
                  onChange={(e) => setPlanForm(prev => ({ ...prev, toVersion: e.target.value }))}
                  label="To Version"
                >
                  {versions.map((version) => (
                    <MenuItem key={version.id} value={version.version}>
                      {version.version} - {version.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmitPlan}
            variant="contained"
            disabled={!planForm.fromVersion || !planForm.toVersion}
          >
            Create Plan
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Migration Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Migration Details</DialogTitle>
        <DialogContent dividers>
          {selectedMigration && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  {selectedMigration.title}
                </Typography>
                <Typography variant="body1" color="textSecondary" gutterBottom>
                  {selectedMigration.description}
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2">From Version:</Typography>
                <Typography variant="body2">{selectedMigration.fromVersion}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2">To Version:</Typography>
                <Typography variant="body2">{selectedMigration.toVersion}</Typography>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2">Status:</Typography>
                <Chip
                  label={selectedMigration.status.replace('_', ' ').toUpperCase()}
                  color={getStatusColor(selectedMigration.status)}
                  size="small"
                />
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2">Compatibility:</Typography>
                <Chip
                  label={selectedMigration.compatibility.replace('_', ' ').toUpperCase()}
                  color={getCompatibilityColor(selectedMigration.compatibility)}
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Migration Steps:
                </Typography>
                <Stepper orientation="vertical">
                  {selectedMigration.migrationSteps.map((step) => {
                    const log = selectedMigration.executionLog?.find(l => l.stepId === step.id);
                    return (
                      <Step key={step.id} active={true}>
                        <StepLabel icon={getStepIcon(log?.status || MigrationStepStatus.PENDING)}>
                          {step.title}
                        </StepLabel>
                        <StepContent>
                          <Typography variant="body2" color="textSecondary">
                            {step.description}
                          </Typography>
                          {step.script && (
                            <Box sx={{ mt: 1, p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
                              <Typography variant="caption" color="textSecondary">
                                Script:
                              </Typography>
                              <Typography variant="body2" fontFamily="monospace">
                                {step.script}
                              </Typography>
                            </Box>
                          )}
                          {log?.error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              {log.error}
                            </Alert>
                          )}
                        </StepContent>
                      </Step>
                    );
                  })}
                </Stepper>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Execute Migration Dialog */}
      <Dialog open={executeOpen} onClose={() => setExecuteOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Execute Migration</DialogTitle>
        <DialogContent dividers>
          {selectedMigration && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedMigration.title}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                This will execute the migration from {selectedMigration.fromVersion} to {selectedMigration.toVersion}
              </Typography>

              {executionResult && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Execution Result:
                  </Typography>
                  <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
                    <pre style={{ fontSize: '12px', margin: 0 }}>
                      {JSON.stringify(executionResult, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExecuteOpen(false)}>Close</Button>
          <Button
            onClick={() => handleRunExecution(true)}
            disabled={executing}
            color="info"
          >
            {executing ? 'Running...' : 'Dry Run'}
          </Button>
          <Button
            onClick={() => handleRunExecution(false)}
            disabled={executing}
            variant="contained"
            color="primary"
          >
            {executing ? 'Executing...' : 'Execute Migration'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Migration Guide Dialog */}
      <Dialog open={guideOpen} onClose={() => setGuideOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Migration Guide</DialogTitle>
        <DialogContent dividers>
          <Paper sx={{ p: 2, backgroundColor: 'grey.50', maxHeight: 600, overflow: 'auto' }}>
            <pre style={{ fontSize: '14px', margin: 0, whiteSpace: 'pre-wrap' }}>
              {migrationGuide}
            </pre>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuideOpen(false)}>Close</Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => {
              const blob = new Blob([migrationGuide], { type: 'text/markdown' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `migration-guide-${selectedMigration?.fromVersion}-to-${selectedMigration?.toVersion}.md`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MigrationManager;