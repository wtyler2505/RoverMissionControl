import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  FormControlLabel,
  Switch,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid
} from '@mui/material';
import {
  Add as AddIcon,
  History as VersionIcon,
  CompareArrows as CompareIcon,
  Warning as BreakingIcon,
  Info as InfoIcon,
  ExpandMore as ExpandIcon,
  Download as ExportIcon,
  ContentCopy as CopyIcon,
  Publish as PublishIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import { DiffEditor } from '@monaco-editor/react';
import { SchemaVersion } from '../../types/schema';
import schemaService from '../../services/schemaService';

interface SchemaVersioningProps {
  schemaId: string;
  currentVersion: string;
  onVersionChange?: () => void;
}

const SchemaVersioning: React.FC<SchemaVersioningProps> = ({
  schemaId,
  currentVersion,
  onVersionChange
}) => {
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    version: '',
    changes: '',
    breakingChanges: false,
    migrationGuide: '',
    releaseNotes: ''
  });
  const [selectedVersions, setSelectedVersions] = useState<[string, string]>(['', '']);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [schemaId]);

  const loadVersions = async () => {
    setLoading(true);
    try {
      const versionsData = await schemaService.getSchemaVersions(schemaId);
      setVersions(versionsData.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVersion = () => {
    const lastVersion = versions[0]?.version || '1.0.0';
    const versionParts = lastVersion.split('.').map(Number);
    
    // Suggest next version
    const suggestedVersion = formData.breakingChanges
      ? `${versionParts[0] + 1}.0.0` // Major version for breaking changes
      : `${versionParts[0]}.${versionParts[1] + 1}.0`; // Minor version otherwise
    
    setFormData(prev => ({ ...prev, version: suggestedVersion }));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      await schemaService.createSchemaVersion(schemaId, formData);
      setDialogOpen(false);
      setFormData({
        version: '',
        changes: '',
        breakingChanges: false,
        migrationGuide: '',
        releaseNotes: ''
      });
      loadVersions();
      onVersionChange?.();
    } catch (error) {
      console.error('Failed to create version:', error);
    }
  };

  const handleCompare = async () => {
    if (selectedVersions[0] && selectedVersions[1]) {
      setComparing(true);
      try {
        const comparison = await schemaService.compareVersions(
          schemaId,
          selectedVersions[0],
          selectedVersions[1]
        );
        setComparisonData(comparison);
        setCompareDialogOpen(true);
      } catch (error) {
        console.error('Failed to compare versions:', error);
      } finally {
        setComparing(false);
      }
    }
  };

  const handleExportVersion = async (version: SchemaVersion) => {
    try {
      const schema = await schemaService.getSchema(schemaId);
      const exportData = {
        schema,
        version,
        exportedAt: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${schema.name}-v${version.version}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export version:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getVersionStatus = (version: SchemaVersion) => {
    if (version.retiredAt) return { label: 'Retired', color: 'error' };
    if (version.deprecatedAt) return { label: 'Deprecated', color: 'warning' };
    if (version.publishedAt) return { label: 'Published', color: 'success' };
    return { label: 'Draft', color: 'default' };
  };

  const isCurrentVersion = (version: string) => version === currentVersion;

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6">
            Version History
          </Typography>
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<CompareIcon />}
              onClick={() => setCompareDialogOpen(true)}
              disabled={versions.length < 2}
            >
              Compare Versions
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateVersion}
            >
              Create Version
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : versions.length === 0 ? (
          <Alert severity="info">
            No version history available. Create your first version to start tracking changes.
          </Alert>
        ) : (
          <Timeline position="alternate">
            {versions.map((version, index) => {
              const status = getVersionStatus(version);
              const isCurrent = isCurrentVersion(version.version);
              
              return (
                <TimelineItem key={version.id}>
                  <TimelineOppositeContent color="text.secondary">
                    <Typography variant="body2">
                      {formatDate(version.createdAt)}
                    </Typography>
                    {version.createdBy && (
                      <Typography variant="caption">
                        by {version.createdBy}
                      </Typography>
                    )}
                  </TimelineOppositeContent>
                  <TimelineSeparator>
                    <TimelineDot 
                      color={isCurrent ? 'primary' : 'grey'}
                      variant={isCurrent ? 'filled' : 'outlined'}
                    >
                      <VersionIcon />
                    </TimelineDot>
                    {index < versions.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Paper elevation={3} sx={{ p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="h6">
                            v{version.version}
                          </Typography>
                          {isCurrent && (
                            <Chip label="Current" size="small" color="primary" />
                          )}
                          <Chip 
                            label={status.label} 
                            size="small" 
                            color={status.color as any}
                          />
                          {version.breakingChanges && (
                            <Tooltip title="Breaking changes">
                              <BreakingIcon color="warning" fontSize="small" />
                            </Tooltip>
                          )}
                        </Box>
                        <Tooltip title="Export version">
                          <IconButton 
                            size="small"
                            onClick={() => handleExportVersion(version)}
                          >
                            <ExportIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                      
                      <Typography variant="body2" gutterBottom>
                        {version.changes}
                      </Typography>
                      
                      {(version.migrationGuide || version.releaseNotes) && (
                        <Accordion elevation={0}>
                          <AccordionSummary expandIcon={<ExpandIcon />}>
                            <Typography variant="body2">
                              More details
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={2}>
                              {version.migrationGuide && (
                                <Box>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Migration Guide
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {version.migrationGuide}
                                  </Typography>
                                </Box>
                              )}
                              {version.releaseNotes && (
                                <Box>
                                  <Typography variant="subtitle2" gutterBottom>
                                    Release Notes
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {version.releaseNotes}
                                  </Typography>
                                </Box>
                              )}
                              {version.publishedAt && (
                                <Typography variant="caption" color="text.secondary">
                                  Published: {formatDate(version.publishedAt)}
                                </Typography>
                              )}
                              {version.deprecatedAt && (
                                <Alert severity="warning" icon={<InfoIcon />}>
                                  <Typography variant="caption">
                                    Deprecated: {formatDate(version.deprecatedAt)}
                                  </Typography>
                                </Alert>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      )}
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}
      </Paper>

      {/* Create Version Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Version</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Alert severity="info">
              Current version: v{currentVersion}
            </Alert>
            
            <TextField
              label="Version Number"
              value={formData.version}
              onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
              fullWidth
              required
              helperText="Use semantic versioning (e.g., 2.0.0)"
            />
            
            <TextField
              label="Changes Summary"
              value={formData.changes}
              onChange={(e) => setFormData(prev => ({ ...prev, changes: e.target.value }))}
              fullWidth
              required
              multiline
              rows={3}
              helperText="Brief description of what changed in this version"
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.breakingChanges}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    breakingChanges: e.target.checked 
                  }))}
                />
              }
              label="Contains breaking changes"
            />
            
            {formData.breakingChanges && (
              <TextField
                label="Migration Guide"
                value={formData.migrationGuide}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  migrationGuide: e.target.value 
                }))}
                fullWidth
                multiline
                rows={4}
                helperText="Instructions for migrating from the previous version"
              />
            )}
            
            <TextField
              label="Release Notes (optional)"
              value={formData.releaseNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, releaseNotes: e.target.value }))}
              fullWidth
              multiline
              rows={4}
              helperText="Detailed release notes for this version"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.version || !formData.changes}
          >
            Create Version
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compare Versions Dialog */}
      <Dialog 
        open={compareDialogOpen} 
        onClose={() => setCompareDialogOpen(false)} 
        maxWidth="lg" 
        fullWidth
      >
        <DialogTitle>Compare Versions</DialogTitle>
        <DialogContent>
          {!comparisonData ? (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <TextField
                      select
                      label="Version 1 (Older)"
                      value={selectedVersions[0]}
                      onChange={(e) => setSelectedVersions([e.target.value, selectedVersions[1]])}
                      SelectProps={{ native: true }}
                    >
                      <option value="">Select version</option>
                      {versions.map(v => (
                        <option key={v.id} value={v.version}>
                          v{v.version}
                        </option>
                      ))}
                    </TextField>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <TextField
                      select
                      label="Version 2 (Newer)"
                      value={selectedVersions[1]}
                      onChange={(e) => setSelectedVersions([selectedVersions[0], e.target.value])}
                      SelectProps={{ native: true }}
                    >
                      <option value="">Select version</option>
                      {versions.map(v => (
                        <option key={v.id} value={v.version}>
                          v{v.version}
                        </option>
                      ))}
                    </TextField>
                  </FormControl>
                </Grid>
              </Grid>
              
              <Box display="flex" justifyContent="center">
                <Button
                  variant="contained"
                  startIcon={comparing ? <CircularProgress size={16} /> : <CompareIcon />}
                  onClick={handleCompare}
                  disabled={!selectedVersions[0] || !selectedVersions[1] || comparing}
                >
                  {comparing ? 'Comparing...' : 'Compare'}
                </Button>
              </Box>
            </Stack>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Comparing v{selectedVersions[0]} → v{selectedVersions[1]}
              </Typography>
              <Box sx={{ height: 500, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <DiffEditor
                  original={JSON.stringify(comparisonData.original, null, 2)}
                  modified={JSON.stringify(comparisonData.modified, null, 2)}
                  language="json"
                  theme="vs-light"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false
                  }}
                />
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {comparisonData && (
            <Button onClick={() => {
              setComparisonData(null);
              setSelectedVersions(['', '']);
            }}>
              New Comparison
            </Button>
          )}
          <Button onClick={() => {
            setCompareDialogOpen(false);
            setComparisonData(null);
            setSelectedVersions(['', '']);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SchemaVersioning;