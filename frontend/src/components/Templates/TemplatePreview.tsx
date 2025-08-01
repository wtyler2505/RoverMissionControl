/**
 * Template Preview Component
 * Shows a preview of how the template will appear to users
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Typography,
  Chip,
  Divider,
  Paper,
  Grid,
  Alert,
  Tabs,
  Tab,
  Stack
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Code as CodeIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { CommandTemplate } from '../../services/templateService';
import { ParameterInput } from './ParameterInput';
import { CommandPriority } from '../../../../shared/types/command-queue.types';

interface TemplatePreviewProps {
  template: CommandTemplate;
  onClose: () => void;
  onExecute?: (parameterValues: Record<string, any>) => void;
}

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
      id={`template-preview-tabpanel-${index}`}
      aria-labelledby={`template-preview-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  onClose,
  onExecute
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Initialize parameter values with defaults
  React.useEffect(() => {
    const initialValues: Record<string, any> = {};
    
    // Set defaults from template parameters
    Object.entries(template.parameters || {}).forEach(([key, value]) => {
      initialValues[key] = value;
    });
    
    // Override with defaults from parameter definitions
    template.parameterDefinitions?.forEach(param => {
      if (param.defaultValue !== undefined) {
        initialValues[param.name] = param.defaultValue;
      }
    });
    
    setParameterValues(initialValues);
  }, [template]);
  
  const handleParameterChange = (paramName: string, value: any) => {
    setParameterValues(prev => ({
      ...prev,
      [paramName]: value
    }));
    
    // Clear error for this parameter
    if (errors[paramName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[paramName];
        return newErrors;
      });
    }
  };
  
  const handleExecute = () => {
    // Validate required parameters
    const newErrors: Record<string, string> = {};
    
    template.parameterDefinitions?.forEach(param => {
      if (param.required && !parameterValues[param.name]) {
        newErrors[param.name] = `${param.displayName || param.name} is required`;
      }
    });
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    if (onExecute) {
      onExecute(parameterValues);
    }
  };
  
  const generateCommandJson = () => {
    const command = {
      commandType: template.commandType,
      parameters: {
        ...template.parameters,
        ...parameterValues
      },
      priority: CommandPriority.NORMAL,
      metadata: {
        source: `template:${template.id}`,
        templateName: template.name,
        tags: template.tags
      }
    };
    
    return JSON.stringify(command, null, 2);
  };
  
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Template Preview: {template.name}</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab icon={<DescriptionIcon />} label="Parameters" />
            <Tab icon={<CodeIcon />} label="JSON Preview" />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          {/* Template Info */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: 'background.default' }}>
            <Typography variant="subtitle1" gutterBottom>
              {template.description || 'No description provided'}
            </Typography>
            
            <Stack direction="row" spacing={1} flexWrap="wrap" mt={2}>
              <Chip
                label={template.commandType.replace(/_/g, ' ').toUpperCase()}
                color="primary"
                size="small"
              />
              <Chip
                label={template.category}
                size="small"
              />
              {template.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Stack>
          </Paper>
          
          {/* Parameters Form */}
          {template.parameterDefinitions && template.parameterDefinitions.length > 0 ? (
            <Grid container spacing={3}>
              {template.parameterDefinitions
                .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
                .map(param => (
                  <Grid item xs={12} key={param.name}>
                    <ParameterInput
                      parameter={param}
                      value={parameterValues[param.name]}
                      onChange={(value) => handleParameterChange(param.name, value)}
                      error={errors[param.name]}
                      onClear={() => handleParameterChange(param.name, undefined)}
                    />
                  </Grid>
                ))}
            </Grid>
          ) : (
            <Alert severity="info">
              This template has no configurable parameters.
            </Alert>
          )}
          
          {/* Validation Errors */}
          {Object.keys(errors).length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Please fix the errors above before executing the template.
            </Alert>
          )}
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {/* JSON Preview */}
          <Typography variant="subtitle2" gutterBottom>
            Generated Command JSON:
          </Typography>
          
          <Paper
            elevation={0}
            sx={{
              backgroundColor: '#1e1e1e',
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: '400px'
            }}
          >
            <SyntaxHighlighter
              language="json"
              style={vscDarkPlus}
              customStyle={{
                margin: 0,
                padding: '16px'
              }}
            >
              {generateCommandJson()}
            </SyntaxHighlighter>
          </Paper>
          
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 2 }}
            onClick={() => {
              navigator.clipboard.writeText(generateCommandJson());
            }}
          >
            Copy JSON
          </Button>
        </TabPanel>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {onExecute && (
          <Button
            variant="contained"
            startIcon={<PlayIcon />}
            onClick={handleExecute}
            disabled={tabValue === 1} // Disable on JSON tab
          >
            Execute Template
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};