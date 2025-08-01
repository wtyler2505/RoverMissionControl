/**
 * Version History Dialog Component
 * Shows annotation version history with diff visualization and revert functionality
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Avatar
} from '@mui/material';
import {
  History as HistoryIcon,
  RestoreIcon,
  CompareArrows as CompareIcon,
  Person as PersonIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { 
  EnhancedAnnotation, 
  AnnotationVersion,
  AnnotationChange
} from '../../../types/enterprise-annotations';
import useAnnotationStore from '../../../stores/annotationStore';

interface VersionHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  annotation: EnhancedAnnotation;
  onRevert: (version: number) => void;
}

export const VersionHistoryDialog: React.FC<VersionHistoryDialogProps> = ({
  open,
  onClose,
  annotation,
  onRevert
}) => {
  const { versionCache, loadVersionHistory, revertToVersion } = useAnnotationStore();
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDiff, setShowDiff] = useState(false);

  const versions = versionCache.get(annotation.id) || [];

  useEffect(() => {
    if (open && annotation.id) {
      // Load version history from API
      loadVersionHistoryFromAPI();
    }
  }, [open, annotation.id]);

  const loadVersionHistoryFromAPI = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      const mockVersions: AnnotationVersion[] = [
        {
          version: 1,
          timestamp: annotation.createdAt,
          userId: annotation.createdBy,
          userName: 'Initial Creator',
          changes: [],
          comment: 'Initial creation'
        },
        ...(annotation.versionHistory || [])
      ];
      
      loadVersionHistory(annotation.id, mockVersions);
    } catch (error) {
      console.error('Failed to load version history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevert = () => {
    if (selectedVersion !== null) {
      revertToVersion(annotation.id, selectedVersion);
      onRevert(selectedVersion);
      onClose();
    }
  };

  const renderChangeDetails = (change: AnnotationChange) => {
    const formatValue = (value: any) => {
      if (value === null || value === undefined) return 'empty';
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return String(value);
    };

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
          {change.field}:
        </Typography>
        <Chip 
          label={formatValue(change.oldValue)} 
          size="small" 
          color="error" 
          variant="outlined"
          sx={{ textDecoration: 'line-through' }}
        />
        <CompareIcon fontSize="small" color="action" />
        <Chip 
          label={formatValue(change.newValue)} 
          size="small" 
          color="success" 
          variant="outlined"
        />
      </Box>
    );
  };

  const getVersionSummary = (version: AnnotationVersion) => {
    const changeTypes = version.changes.map(c => c.field);
    const uniqueTypes = [...new Set(changeTypes)];
    
    if (uniqueTypes.length === 0) return 'No changes';
    if (uniqueTypes.length === 1) return `Updated ${uniqueTypes[0]}`;
    if (uniqueTypes.length === 2) return `Updated ${uniqueTypes[0]} and ${uniqueTypes[1]}`;
    return `Updated ${uniqueTypes.length} fields`;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryIcon />
        Version History
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Chip 
            label={`Version ${annotation.version}`} 
            color="primary" 
            size="small"
          />
          <Chip 
            label={`${versions.length} versions`} 
            variant="outlined" 
            size="small"
          />
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : versions.length === 0 ? (
          <Alert severity="info">No version history available</Alert>
        ) : (
          <Timeline position="right">
            {versions.map((version, index) => (
              <TimelineItem key={version.version}>
                <TimelineOppositeContent 
                  sx={{ m: 'auto 0' }}
                  align="right"
                  variant="body2"
                  color="text.secondary"
                >
                  <Typography variant="caption">
                    {format(version.timestamp, 'MMM d, yyyy')}
                  </Typography>
                  <Typography variant="caption" display="block">
                    {format(version.timestamp, 'HH:mm:ss')}
                  </Typography>
                </TimelineOppositeContent>
                
                <TimelineSeparator>
                  <TimelineConnector sx={{ bgcolor: index === 0 ? 'primary.main' : 'grey.300' }} />
                  <TimelineDot 
                    color={index === 0 ? 'primary' : 'grey'}
                    variant={selectedVersion === version.version ? 'filled' : 'outlined'}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedVersion(version.version)}
                  >
                    {index === 0 ? <EditIcon /> : <HistoryIcon />}
                  </TimelineDot>
                  <TimelineConnector sx={{ bgcolor: 'grey.300' }} />
                </TimelineSeparator>
                
                <TimelineContent sx={{ py: '12px', px: 2 }}>
                  <Paper 
                    elevation={selectedVersion === version.version ? 3 : 1}
                    sx={{ 
                      p: 2, 
                      cursor: 'pointer',
                      border: selectedVersion === version.version ? '2px solid' : '1px solid',
                      borderColor: selectedVersion === version.version ? 'primary.main' : 'divider',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setSelectedVersion(version.version)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                        {version.userName.charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="subtitle2">
                        Version {version.version}
                      </Typography>
                      {index === 0 && (
                        <Chip label="Current" size="small" color="primary" />
                      )}
                      <Box sx={{ ml: 'auto' }}>
                        <Tooltip title="Compare with another version">
                          <IconButton 
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareVersion(version.version);
                              setShowDiff(true);
                            }}
                          >
                            <CompareIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {index !== 0 && (
                          <Tooltip title="Revert to this version">
                            <IconButton 
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVersion(version.version);
                                handleRevert();
                              }}
                            >
                              <RestoreIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {version.userName} • {getVersionSummary(version)}
                    </Typography>
                    
                    {version.comment && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                        "{version.comment}"
                      </Typography>
                    )}
                    
                    {version.changes.length > 0 && (
                      <>
                        <Divider sx={{ my: 1 }} />
                        <Box sx={{ mt: 1 }}>
                          {version.changes.slice(0, 3).map((change, idx) => (
                            <Box key={idx}>
                              {renderChangeDetails(change)}
                            </Box>
                          ))}
                          {version.changes.length > 3 && (
                            <Typography variant="caption" color="text.secondary">
                              and {version.changes.length - 3} more changes...
                            </Typography>
                          )}
                        </Box>
                      </>
                    )}
                  </Paper>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {selectedVersion !== null && selectedVersion !== annotation.version && (
          <Button
            variant="contained"
            startIcon={<RestoreIcon />}
            onClick={handleRevert}
          >
            Revert to Version {selectedVersion}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VersionHistoryDialog;