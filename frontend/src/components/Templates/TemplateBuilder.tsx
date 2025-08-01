/**
 * Template Builder Component
 * Allows users to create and edit command templates
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  FormControlLabel,
  Checkbox,
  Switch,
  Button,
  IconButton,
  Chip,
  Autocomplete,
  Alert,
  Divider,
  Stack,
  Grid,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  FormHelperText
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Help as HelpIcon,
  Code as CodeIcon,
  Settings as SettingsIcon,
  DragIndicator as DragIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

import { 
  CommandType, 
  CommandPriority 
} from '../../../../shared/types/command-queue.types';
import {
  CommandTemplate,
  TemplateParameter,
  ParameterType,
  UIComponent,
  templateService
} from '../../services/templateService';
import { createDefaultValidator } from '../../services/command/CommandValidator';
import { ParameterInput } from './ParameterInput';
import { TemplatePreview } from './TemplatePreview';

interface TemplateBuilderProps {
  template?: CommandTemplate;
  onSave: (template: Partial<CommandTemplate>) => Promise<void>;
  onCancel: () => void;
  availableCategories?: string[];
  availableRoles?: string[];
}

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  template,
  onSave,
  onCancel,
  availableCategories = ['general', 'movement', 'sensor', 'system', 'diagnostic'],
  availableRoles = []
}) => {
  // Form state
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [commandType, setCommandType] = useState<CommandType>(
    template?.commandType || CommandType.CUSTOM
  );
  const [category, setCategory] = useState(template?.category || 'general');
  const [tags, setTags] = useState<string[]>(template?.tags || []);
  const [icon, setIcon] = useState(template?.icon || '');
  const [isPublic, setIsPublic] = useState(template?.isPublic || false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>(
    template?.allowedRoles || []
  );
  
  // Parameters state
  const [parameters, setParameters] = useState<Record<string, any>>(
    template?.parameters || {}
  );
  const [parameterDefinitions, setParameterDefinitions] = useState<TemplateParameter[]>(
    template?.parameterDefinitions || []
  );
  
  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingParameter, setEditingParameter] = useState<TemplateParameter | null>(null);
  const [editingParameterIndex, setEditingParameterIndex] = useState<number>(-1);
  
  // Validator
  const validator = createDefaultValidator();
  
  // Validate form
  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    }
    
    if (!commandType) {
      newErrors.commandType = 'Command type is required';
    }
    
    // Validate command parameters
    try {
      const testCommand = {
        id: 'test',
        commandType,
        parameters,
        metadata: {
          source: 'template_builder',
          tags: []
        },
        priority: CommandPriority.NORMAL,
        timeoutMs: 30000,
        maxRetries: 0
      };
      
      const validationResult = validator.validateCommand(testCommand);
      if (!validationResult.valid && validationResult.errors) {
        validationResult.errors.forEach(error => {
          newErrors[error.path] = error.message;
        });
      }
    } catch (error) {
      newErrors.parameters = 'Invalid command parameters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, commandType, parameters, validator]);
  
  // Handle parameter definition add/edit
  const handleParameterDefinition = useCallback((param: TemplateParameter, index: number) => {
    const newDefinitions = [...parameterDefinitions];
    
    if (index === -1) {
      // Add new parameter
      newDefinitions.push({
        ...param,
        displayOrder: newDefinitions.length
      });
    } else {
      // Update existing parameter
      newDefinitions[index] = param;
    }
    
    setParameterDefinitions(newDefinitions);
    setEditingParameter(null);
    setEditingParameterIndex(-1);
  }, [parameterDefinitions]);
  
  // Handle parameter definition delete
  const handleDeleteParameter = useCallback((index: number) => {
    const newDefinitions = parameterDefinitions.filter((_, i) => i !== index);
    // Update display order
    newDefinitions.forEach((def, i) => {
      def.displayOrder = i;
    });
    setParameterDefinitions(newDefinitions);
  }, [parameterDefinitions]);
  
  // Handle parameter reordering
  const handleParameterReorder = useCallback((result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(parameterDefinitions);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update display order
    items.forEach((item, index) => {
      item.displayOrder = index;
    });
    
    setParameterDefinitions(items);
  }, [parameterDefinitions]);
  
  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;
    
    setSaving(true);
    try {
      const templateData: Partial<CommandTemplate> = {
        name,
        description,
        commandType,
        parameters,
        parameterSchema: {
          // Build parameter schema from definitions
          type: 'object',
          properties: parameterDefinitions.reduce((acc, def) => {
            acc[def.name] = {
              type: def.parameterType,
              description: def.description,
              ...(def.minValue !== undefined && { minimum: def.minValue }),
              ...(def.maxValue !== undefined && { maximum: def.maxValue }),
              ...(def.enumValues && { enum: def.enumValues }),
              ...(def.pattern && { pattern: def.pattern })
            };
            return acc;
          }, {} as Record<string, any>),
          required: parameterDefinitions
            .filter(def => def.required)
            .map(def => def.name)
        },
        category,
        tags,
        icon,
        isPublic,
        allowedRoles,
        parameterDefinitions
      };
      
      if (template?.id) {
        templateData.id = template.id;
      }
      
      await onSave(templateData);
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrors({ save: 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {template ? 'Edit Template' : 'Create Template'}
        </Typography>
        
        <Grid container spacing={3}>
          {/* Basic Information */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Template Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!errors.name}
              helperText={errors.name}
              required
              margin="normal"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal" error={!!errors.commandType}>
              <FormLabel>Command Type</FormLabel>
              <Select
                value={commandType}
                onChange={(e) => setCommandType(e.target.value as CommandType)}
                required
              >
                {Object.values(CommandType).map(type => (
                  <MenuItem key={type} value={type}>
                    {type.replace(/_/g, ' ').toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
              {errors.commandType && (
                <FormHelperText>{errors.commandType}</FormHelperText>
              )}
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              margin="normal"
              helperText="Describe what this template does and when to use it"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <FormLabel>Category</FormLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Autocomplete
              multiple
              freeSolo
              options={[]}
              value={tags}
              onChange={(_, newValue) => setTags(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  margin="normal"
                  placeholder="Add tags"
                  helperText="Press Enter to add tags"
                />
              )}
            />
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        {/* Parameters Section */}
        <Box>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">Parameters</Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingParameter({
                  name: '',
                  parameterType: ParameterType.STRING,
                  required: false,
                  uiComponent: UIComponent.TEXT
                } as TemplateParameter);
                setEditingParameterIndex(-1);
              }}
            >
              Add Parameter
            </Button>
          </Box>
          
          {parameterDefinitions.length > 0 ? (
            <DragDropContext onDragEnd={handleParameterReorder}>
              <Droppable droppableId="parameters">
                {(provided) => (
                  <Box {...provided.droppableProps} ref={provided.innerRef}>
                    {parameterDefinitions.map((param, index) => (
                      <Draggable
                        key={param.name}
                        draggableId={param.name}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Paper
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{
                              p: 2,
                              mb: 1,
                              backgroundColor: snapshot.isDragging ? 'action.hover' : 'background.paper'
                            }}
                          >
                            <Box display="flex" alignItems="center">
                              <Box {...provided.dragHandleProps} sx={{ mr: 1 }}>
                                <DragIcon />
                              </Box>
                              
                              <Box flex={1}>
                                <Typography variant="subtitle1">
                                  {param.displayName || param.name}
                                  {param.required && (
                                    <Chip
                                      label="Required"
                                      size="small"
                                      color="primary"
                                      sx={{ ml: 1 }}
                                    />
                                  )}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  Type: {param.parameterType} | Component: {param.uiComponent}
                                </Typography>
                                {param.description && (
                                  <Typography variant="body2" color="text.secondary">
                                    {param.description}
                                  </Typography>
                                )}
                              </Box>
                              
                              <IconButton
                                onClick={() => {
                                  setEditingParameter(param);
                                  setEditingParameterIndex(index);
                                }}
                              >
                                <SettingsIcon />
                              </IconButton>
                              
                              <IconButton
                                onClick={() => handleDeleteParameter(index)}
                                color="error"
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Box>
                          </Paper>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <Alert severity="info">
              No parameters defined. Add parameters to make the template configurable.
            </Alert>
          )}
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        {/* Advanced Settings */}
        <Box>
          <Button
            onClick={() => setShowAdvanced(!showAdvanced)}
            endIcon={showAdvanced ? <CloseIcon /> : <SettingsIcon />}
          >
            Advanced Settings
          </Button>
          
          {showAdvanced && (
            <Box mt={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isPublic}
                        onChange={(e) => setIsPublic(e.target.checked)}
                      />
                    }
                    label="Public Template"
                  />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Public templates can be accessed by all users
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Icon"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="e.g., rocket, sensor, settings"
                    helperText="Material icon name for the template"
                  />
                </Grid>
                
                {availableRoles.length > 0 && (
                  <Grid item xs={12}>
                    <Autocomplete
                      multiple
                      options={availableRoles}
                      value={allowedRoles}
                      onChange={(_, newValue) => setAllowedRoles(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Allowed Roles"
                          helperText="Restrict template access to specific roles"
                        />
                      )}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </Box>
        
        {/* Actions */}
        <Box display="flex" justifyContent="space-between" mt={3}>
          <Button
            startIcon={<PreviewIcon />}
            onClick={() => setShowPreview(true)}
          >
            Preview
          </Button>
          
          <Box>
            <Button onClick={onCancel} sx={{ mr: 1 }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Template'}
            </Button>
          </Box>
        </Box>
        
        {errors.save && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errors.save}
          </Alert>
        )}
      </Paper>
      
      {/* Parameter Editor Dialog */}
      {editingParameter && (
        <ParameterEditor
          parameter={editingParameter}
          onSave={(param) => handleParameterDefinition(param, editingParameterIndex)}
          onCancel={() => {
            setEditingParameter(null);
            setEditingParameterIndex(-1);
          }}
        />
      )}
      
      {/* Preview Dialog */}
      {showPreview && (
        <TemplatePreview
          template={{
            name,
            description,
            commandType,
            parameters,
            parameterDefinitions,
            category,
            tags,
            icon
          } as CommandTemplate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </Box>
  );
};

// Parameter Editor Component
interface ParameterEditorProps {
  parameter: TemplateParameter;
  onSave: (parameter: TemplateParameter) => void;
  onCancel: () => void;
}

const ParameterEditor: React.FC<ParameterEditorProps> = ({
  parameter,
  onSave,
  onCancel
}) => {
  const [editedParam, setEditedParam] = useState<TemplateParameter>(parameter);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSave = () => {
    const newErrors: Record<string, string> = {};
    
    if (!editedParam.name.trim()) {
      newErrors.name = 'Parameter name is required';
    }
    
    if (editedParam.parameterType === ParameterType.ENUM && !editedParam.enumValues?.length) {
      newErrors.enumValues = 'Enum values are required for enum type';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSave(editedParam);
  };
  
  return (
    <Dialog open maxWidth="md" fullWidth>
      <DialogTitle>
        {parameter.name ? 'Edit Parameter' : 'Add Parameter'}
      </DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Parameter Name"
              value={editedParam.name}
              onChange={(e) => setEditedParam({ ...editedParam, name: e.target.value })}
              error={!!errors.name}
              helperText={errors.name || 'Internal parameter name (e.g., speed, distance)'}
              margin="normal"
              required
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Display Name"
              value={editedParam.displayName || ''}
              onChange={(e) => setEditedParam({ ...editedParam, displayName: e.target.value })}
              helperText="User-friendly name"
              margin="normal"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={editedParam.description || ''}
              onChange={(e) => setEditedParam({ ...editedParam, description: e.target.value })}
              multiline
              rows={2}
              helperText="Help text for users"
              margin="normal"
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <FormLabel>Parameter Type</FormLabel>
              <Select
                value={editedParam.parameterType}
                onChange={(e) => setEditedParam({ 
                  ...editedParam, 
                  parameterType: e.target.value as ParameterType 
                })}
              >
                {Object.values(ParameterType).map(type => (
                  <MenuItem key={type} value={type}>
                    {type.toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal">
              <FormLabel>UI Component</FormLabel>
              <Select
                value={editedParam.uiComponent}
                onChange={(e) => setEditedParam({ 
                  ...editedParam, 
                  uiComponent: e.target.value as UIComponent 
                })}
              >
                {Object.values(UIComponent).map(comp => (
                  <MenuItem key={comp} value={comp}>
                    {comp.replace(/_/g, ' ').toUpperCase()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={editedParam.required}
                  onChange={(e) => setEditedParam({ 
                    ...editedParam, 
                    required: e.target.checked 
                  })}
                />
              }
              label="Required Parameter"
            />
          </Grid>
          
          {/* Type-specific fields */}
          {editedParam.parameterType === ParameterType.NUMBER && (
            <>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Min Value"
                  type="number"
                  value={editedParam.minValue || ''}
                  onChange={(e) => setEditedParam({ 
                    ...editedParam, 
                    minValue: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  margin="normal"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Max Value"
                  type="number"
                  value={editedParam.maxValue || ''}
                  onChange={(e) => setEditedParam({ 
                    ...editedParam, 
                    maxValue: e.target.value ? Number(e.target.value) : undefined 
                  })}
                  margin="normal"
                />
              </Grid>
            </>
          )}
          
          {editedParam.parameterType === ParameterType.STRING && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Pattern (Regex)"
                value={editedParam.pattern || ''}
                onChange={(e) => setEditedParam({ 
                  ...editedParam, 
                  pattern: e.target.value 
                })}
                helperText="Regular expression for validation"
                margin="normal"
              />
            </Grid>
          )}
          
          {editedParam.parameterType === ParameterType.ENUM && (
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={editedParam.enumValues || []}
                onChange={(_, newValue) => setEditedParam({ 
                  ...editedParam, 
                  enumValues: newValue 
                })}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Enum Values"
                    error={!!errors.enumValues}
                    helperText={errors.enumValues || 'Press Enter to add values'}
                    margin="normal"
                  />
                )}
              />
            </Grid>
          )}
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Placeholder"
              value={editedParam.placeholder || ''}
              onChange={(e) => setEditedParam({ 
                ...editedParam, 
                placeholder: e.target.value 
              })}
              margin="normal"
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Default Value"
              value={JSON.stringify(editedParam.defaultValue || '')}
              onChange={(e) => {
                try {
                  const value = JSON.parse(e.target.value);
                  setEditedParam({ ...editedParam, defaultValue: value });
                } catch {
                  // Invalid JSON, treat as string
                  setEditedParam({ ...editedParam, defaultValue: e.target.value });
                }
              }}
              helperText="JSON format for complex values"
              margin="normal"
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};