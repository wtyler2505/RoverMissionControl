/**
 * Conflict Resolution Dialog Component
 * Handles conflicts between local and remote annotation versions
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Alert,
  Chip,
  Grid,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Warning as WarningIcon,
  CompareArrows as CompareIcon,
  ExpandMore as ExpandMoreIcon,
  CloudDownload as RemoteIcon,
  Computer as LocalIcon,
  Merge as MergeIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { 
  AnnotationConflict,
  EnhancedAnnotation
} from '../../../types/enterprise-annotations';
import useAnnotationStore from '../../../stores/annotationStore';

interface ConflictResolutionDialogProps {
  open: boolean;
  onClose: () => void;
  conflict: AnnotationConflict;
  onResolve: (resolution: 'local' | 'remote' | 'merge') => void;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  open,
  onClose,
  conflict,
  onResolve
}) => {
  const { resolveConflict } = useAnnotationStore();
  const [selectedResolution, setSelectedResolution] = useState<'local' | 'remote' | 'merge' | null>(null);
  const [mergedAnnotation, setMergedAnnotation] = useState<EnhancedAnnotation | null>(null);

  const handleResolve = () => {
    if (selectedResolution) {
      resolveConflict(conflict.id, selectedResolution);
      onResolve(selectedResolution);
      onClose();
    }
  };

  const getDifferences = (): Array<{
    field: string;
    localValue: any;
    remoteValue: any;
    isDifferent: boolean;
  }> => {
    const fields = new Set([
      ...Object.keys(conflict.localVersion),
      ...Object.keys(conflict.remoteVersion)
    ]);

    return Array.from(fields).map(field => ({
      field,
      localValue: (conflict.localVersion as any)[field],
      remoteValue: (conflict.remoteVersion as any)[field],
      isDifferent: JSON.stringify((conflict.localVersion as any)[field]) !== 
                   JSON.stringify((conflict.remoteVersion as any)[field])
    })).filter(diff => diff.isDifferent && !['id', 'version', 'updatedAt'].includes(diff.field));
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'empty';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number' && value > 1000000000000) {
      return format(value, 'MMM d, yyyy HH:mm:ss');
    }
    return String(value);
  };

  const getConflictTypeDetails = () => {
    switch (conflict.type) {
      case 'version':
        return {
          title: 'Version Conflict',
          description: 'The annotation has been modified by another user while you were editing.',
          icon: <CompareIcon />
        };
      case 'permission':
        return {
          title: 'Permission Conflict',
          description: 'Permission settings have changed while you were editing.',
          icon: <WarningIcon />
        };
      case 'lock':
        return {
          title: 'Lock Conflict',
          description: 'The annotation is currently locked by another user.',
          icon: <WarningIcon />
        };
      default:
        return {
          title: 'Conflict Detected',
          description: 'There is a conflict that needs to be resolved.',
          icon: <WarningIcon />
        };
    }
  };

  const conflictDetails = getConflictTypeDetails();
  const differences = getDifferences();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {conflictDetails.icon}
        {conflictDetails.title}
      </DialogTitle>
      
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            {conflictDetails.description}
          </Typography>
        </Alert>

        {/* Conflict Summary */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Conflict Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <LocalIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Your Version (Local)
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Version {conflict.localVersion.version}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Modified by: {conflict.localVersion.updatedBy}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Modified at: {format(conflict.localVersion.updatedAt, 'MMM d, yyyy HH:mm:ss')}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <RemoteIcon color="secondary" />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Server Version (Remote)
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Version {conflict.remoteVersion.version}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Modified by: {conflict.remoteVersion.updatedBy}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Modified at: {format(conflict.remoteVersion.updatedAt, 'MMM d, yyyy HH:mm:ss')}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* Differences */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Differences ({differences.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Field</TableCell>
                  <TableCell>Your Version</TableCell>
                  <TableCell>Server Version</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {differences.map((diff, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {diff.field}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={formatValue(diff.localValue)} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={formatValue(diff.remoteValue)} 
                        size="small" 
                        color="secondary" 
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        {/* Resolution Options */}
        <Box>
          <Typography variant="h6" gutterBottom>
            Choose Resolution
          </Typography>
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value as 'local' | 'remote' | 'merge')}
            >
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <FormControlLabel
                    value="local"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalIcon color="primary" />
                        <Box>
                          <Typography variant="subtitle1">
                            Keep Your Version
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Discard server changes and keep your local edits
                          </Typography>
                        </Box>
                      </Box>
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" variant="outlined">
                    This will overwrite the server version with your local changes. 
                    Other users will see your version after this resolution.
                  </Alert>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <FormControlLabel
                    value="remote"
                    control={<Radio />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RemoteIcon color="secondary" />
                        <Box>
                          <Typography variant="subtitle1">
                            Accept Server Version
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Discard your changes and accept the server version
                          </Typography>
                        </Box>
                      </Box>
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="warning" variant="outlined">
                    This will discard all your local changes and replace them with the server version. 
                    Your edits will be lost.
                  </Alert>
                </AccordionDetails>
              </Accordion>

              <Accordion disabled>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <FormControlLabel
                    value="merge"
                    control={<Radio />}
                    disabled
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MergeIcon />
                        <Box>
                          <Typography variant="subtitle1">
                            Merge Changes
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Manually merge both versions (Coming soon)
                          </Typography>
                        </Box>
                      </Box>
                    }
                    onClick={(e) => e.stopPropagation()}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" variant="outlined">
                    Manual merge functionality will be available in a future update.
                  </Alert>
                </AccordionDetails>
              </Accordion>
            </RadioGroup>
          </FormControl>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleResolve}
          disabled={!selectedResolution}
        >
          Resolve Conflict
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConflictResolutionDialog;