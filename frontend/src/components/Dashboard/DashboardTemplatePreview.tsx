/**
 * DashboardTemplatePreview - Preview component for dashboard templates
 */

import React, { useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  Chip,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  IconButton,
  Tooltip,
  useTheme,
  alpha
} from '@mui/material';
import {
  Close,
  Dashboard,
  Timeline,
  Storage,
  Warning,
  Error,
  CheckCircle,
  Schedule,
  Refresh,
  Lock,
  LockOpen,
  ThreeDRotation,
  CloudDownload,
  Layers,
  Speed,
  Memory
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  DashboardTemplate,
  DashboardContext,
  TemplateValidationResult
} from '../../types/dashboardTemplates';

/**
 * Props for DashboardTemplatePreview
 */
export interface DashboardTemplatePreviewProps {
  open: boolean;
  template: DashboardTemplate;
  context: DashboardContext;
  validationResult?: TemplateValidationResult;
  onClose: () => void;
  onApply: () => void;
}

/**
 * Styled components
 */
const PreviewContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  height: 400,
  position: 'relative',
  overflow: 'hidden'
}));

const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(12, 1fr)',
  gap: theme.spacing(1),
  height: '100%',
  position: 'relative'
}));

const PanelPreview = styled(Paper)<{ $w: number; $h: number; $x: number; $y: number }>(
  ({ theme, $w, $h, $x, $y }) => ({
    gridColumn: `${$x + 1} / span ${$w}`,
    gridRow: `${$y + 1} / span ${$h}`,
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(theme.palette.primary.main, 0.05),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
      transform: 'scale(1.02)'
    }
  })
);

const FeatureChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5)
}));

const ValidationIcon = styled(Box)<{ $status: 'valid' | 'warning' | 'error' }>(
  ({ theme, $status }) => ({
    display: 'inline-flex',
    alignItems: 'center',
    color: $status === 'valid' 
      ? theme.palette.success.main
      : $status === 'warning'
      ? theme.palette.warning.main
      : theme.palette.error.main
  })
);

/**
 * Get feature icon
 */
const getFeatureIcon = (feature: string) => {
  switch (feature) {
    case 'autoRefresh': return <Refresh fontSize="small" />;
    case 'syncTime': return <Schedule fontSize="small" />;
    case 'enableCorrelation': return <Timeline fontSize="small" />;
    case 'enable3DVisualization': return <ThreeDRotation fontSize="small" />;
    case 'enableExport': return <CloudDownload fontSize="small" />;
    case 'lockLayout': return <Lock fontSize="small" />;
    default: return <Layers fontSize="small" />;
  }
};

/**
 * Format time window
 */
const formatTimeWindow = (milliseconds: number): string => {
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  
  if (days >= 1) return `${Math.round(days)} day${days > 1 ? 's' : ''}`;
  if (hours >= 1) return `${Math.round(hours)} hour${hours > 1 ? 's' : ''}`;
  if (minutes >= 1) return `${Math.round(minutes)} minute${minutes > 1 ? 's' : ''}`;
  return `${Math.round(seconds)} second${seconds > 1 ? 's' : ''}`;
};

/**
 * DashboardTemplatePreview component
 */
export const DashboardTemplatePreview: React.FC<DashboardTemplatePreviewProps> = ({
  open,
  template,
  context,
  validationResult,
  onClose,
  onApply
}) => {
  const theme = useTheme();
  
  // Calculate grid layout bounds
  const gridBounds = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    
    template.panels.forEach(panel => {
      const right = panel.position.x + panel.position.w;
      const bottom = panel.position.y + panel.position.h;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });
    
    return { width: Math.max(maxX, 12), height: maxY };
  }, [template.panels]);
  
  // Get enabled features
  const enabledFeatures = useMemo(() => {
    return Object.entries(template.features)
      .filter(([_, value]) => value === true)
      .map(([key]) => key);
  }, [template.features]);
  
  // Get validation status
  const validationStatus = useMemo(() => {
    if (!validationResult) return undefined;
    if (!validationResult.valid) return 'error';
    if (validationResult.warnings.length > 0) return 'warning';
    return 'valid';
  }, [validationResult]);
  
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="h5">{template.name}</Typography>
            {validationStatus && (
              <ValidationIcon $status={validationStatus}>
                {validationStatus === 'valid' && <CheckCircle />}
                {validationStatus === 'warning' && <Warning />}
                {validationStatus === 'error' && <Error />}
                <Typography variant="body2" ml={0.5}>
                  {validationStatus}
                </Typography>
              </ValidationIcon>
            )}
          </Stack>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {template.description}
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={3}>
          {/* Layout preview */}
          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              Layout Preview
            </Typography>
            <PreviewContainer>
              <GridContainer style={{ gridTemplateRows: `repeat(${gridBounds.height}, 1fr)` }}>
                {template.panels.map(panel => (
                  <Tooltip
                    key={panel.id}
                    title={
                      <Box>
                        <Typography variant="subtitle2">{panel.customConfig?.title || panel.templateId}</Typography>
                        <Typography variant="caption">
                          Position: ({panel.position.x}, {panel.position.y})
                        </Typography>
                        <Typography variant="caption" display="block">
                          Size: {panel.position.w}x{panel.position.h}
                        </Typography>
                      </Box>
                    }
                  >
                    <PanelPreview
                      $w={panel.position.w}
                      $h={panel.position.h}
                      $x={panel.position.x}
                      $y={panel.position.y}
                      elevation={1}
                    >
                      <Dashboard color="primary" />
                      <Typography variant="caption" align="center" mt={1}>
                        {panel.customConfig?.title || panel.templateId}
                      </Typography>
                    </PanelPreview>
                  </Tooltip>
                ))}
              </GridContainer>
            </PreviewContainer>
          </Grid>
          
          {/* Template details */}
          <Grid item xs={12} md={4}>
            <Stack spacing={3}>
              {/* Metadata */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Details
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <Layers />
                    </ListItemIcon>
                    <ListItemText
                      primary="Panels"
                      secondary={`${template.panels.length} visualization panels`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Schedule />
                    </ListItemIcon>
                    <ListItemText
                      primary="Time Window"
                      secondary={formatTimeWindow(template.defaultTimeWindow)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Storage />
                    </ListItemIcon>
                    <ListItemText
                      primary="Required Streams"
                      secondary={`${template.requiredStreams.length} data streams`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <Speed />
                    </ListItemIcon>
                    <ListItemText
                      primary="Performance Impact"
                      secondary={validationResult?.performanceImpact || 'Unknown'}
                    />
                  </ListItem>
                </List>
              </Box>
              
              <Divider />
              
              {/* Features */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  Features
                </Typography>
                <Box>
                  {enabledFeatures.map(feature => (
                    <FeatureChip
                      key={feature}
                      icon={getFeatureIcon(feature)}
                      label={feature.replace(/([A-Z])/g, ' $1').trim()}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                  {template.features.refreshInterval && (
                    <FeatureChip
                      icon={<Refresh />}
                      label={`Refresh: ${template.features.refreshInterval}ms`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
              
              {/* Validation results */}
              {validationResult && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Validation
                    </Typography>
                    
                    {validationResult.errors.length > 0 && (
                      <Alert severity="error" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Errors:
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {validationResult.errors.map((error, index) => (
                            <li key={index}><Typography variant="caption">{error}</Typography></li>
                          ))}
                        </ul>
                      </Alert>
                    )}
                    
                    {validationResult.warnings.length > 0 && (
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Warnings:
                        </Typography>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {validationResult.warnings.map((warning, index) => (
                            <li key={index}><Typography variant="caption">{warning}</Typography></li>
                          ))}
                        </ul>
                      </Alert>
                    )}
                    
                    {validationResult.missingStreams.length > 0 && (
                      <Alert severity="info">
                        <Typography variant="subtitle2" gutterBottom>
                          Missing Streams:
                        </Typography>
                        <Typography variant="caption">
                          {validationResult.missingStreams.join(', ')}
                        </Typography>
                      </Alert>
                    )}
                    
                    {validationResult.valid && validationResult.errors.length === 0 && validationResult.warnings.length === 0 && (
                      <Alert severity="success">
                        Template is valid and ready to use
                      </Alert>
                    )}
                  </Box>
                </>
              )}
              
              {/* Tags */}
              {template.tags && template.tags.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Tags
                    </Typography>
                    <Box>
                      {template.tags.map(tag => (
                        <Chip
                          key={tag}
                          label={tag}
                          size="small"
                          sx={{ m: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </>
              )}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={onApply}
          disabled={validationStatus === 'error'}
          startIcon={<Dashboard />}
        >
          Apply Template
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DashboardTemplatePreview;