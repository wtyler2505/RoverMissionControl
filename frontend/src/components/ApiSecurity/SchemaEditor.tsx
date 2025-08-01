import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Typography,
  Alert,
  Chip,
  Stack,
  Grid,
  IconButton,
  Tooltip,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Save as SaveIcon,
  Cancel as CancelIcon,
  Code as CodeIcon,
  FormatAlignLeft as FormatIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Close as RemoveIcon
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import { SchemaDefinition, SchemaType, SchemaStatus } from '../../types/schema';

interface SchemaEditorProps {
  schema?: SchemaDefinition | null;
  onSave: (schema: SchemaDefinition) => void;
  onCancel: () => void;
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({ schema, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Partial<SchemaDefinition>>({
    name: '',
    description: '',
    type: SchemaType.JSON_SCHEMA,
    version: '1.0.0',
    schema: {},
    namespace: '',
    tags: [],
    status: SchemaStatus.DRAFT,
    isPublic: false,
    metadata: {}
  });
  const [schemaContent, setSchemaContent] = useState('{}');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    if (schema) {
      setFormData(schema);
      setSchemaContent(JSON.stringify(schema.schema, null, 2));
      validateSchema(JSON.stringify(schema.schema, null, 2));
    } else {
      // Reset for new schema
      const defaultSchema = getDefaultSchema(SchemaType.JSON_SCHEMA);
      setFormData({
        name: '',
        description: '',
        type: SchemaType.JSON_SCHEMA,
        version: '1.0.0',
        schema: defaultSchema,
        namespace: '',
        tags: [],
        status: SchemaStatus.DRAFT,
        isPublic: false,
        metadata: {}
      });
      setSchemaContent(JSON.stringify(defaultSchema, null, 2));
    }
  }, [schema]);

  const getDefaultSchema = (type: SchemaType) => {
    switch (type) {
      case SchemaType.JSON_SCHEMA:
        return {
          "$schema": "http://json-schema.org/draft-07/schema#",
          "type": "object",
          "properties": {
            "example": {
              "type": "string",
              "description": "An example property"
            }
          },
          "required": []
        };
      case SchemaType.OPENAPI:
        return {
          "openapi": "3.0.0",
          "info": {
            "title": "API",
            "version": "1.0.0"
          },
          "paths": {}
        };
      case SchemaType.SWAGGER:
        return {
          "swagger": "2.0",
          "info": {
            "title": "API",
            "version": "1.0.0"
          },
          "paths": {}
        };
      default:
        return {};
    }
  };

  const validateSchema = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      setIsValid(true);
      setValidationError(null);
      return parsed;
    } catch (error: any) {
      setIsValid(false);
      setValidationError(error.message);
      return null;
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setSchemaContent(value);
      setIsDirty(true);
      const parsed = validateSchema(value);
      if (parsed) {
        setFormData(prev => ({ ...prev, schema: parsed }));
      }
    }
  };

  const handleFieldChange = (field: keyof SchemaDefinition, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    // If changing schema type, update the default schema
    if (field === 'type' && value !== formData.type) {
      const defaultSchema = getDefaultSchema(value);
      setSchemaContent(JSON.stringify(defaultSchema, null, 2));
      setFormData(prev => ({ ...prev, schema: defaultSchema }));
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
      setIsDirty(true);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!formData.name) {
      setValidationError('Schema name is required');
      return;
    }
    if (!isValid) {
      setValidationError('Schema content is not valid JSON');
      return;
    }
    
    onSave(formData as SchemaDefinition);
    setIsDirty(false);
  };

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(schemaContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setSchemaContent(formatted);
      if (editorRef.current) {
        editorRef.current.setValue(formatted);
      }
    } catch (error) {
      // JSON is invalid, can't format
    }
  };

  const getLanguageForType = (type: SchemaType) => {
    switch (type) {
      case SchemaType.GRAPHQL:
        return 'graphql';
      case SchemaType.PROTOBUF:
        return 'protobuf';
      default:
        return 'json';
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          {schema ? `Edit Schema: ${schema.name}` : 'Create New Schema'}
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <TextField
                label="Schema Name"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                fullWidth
                required
                error={!formData.name && isDirty}
                helperText={!formData.name && isDirty ? 'Name is required' : ''}
              />
              
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                fullWidth
                multiline
                rows={2}
              />
              
              <FormControl fullWidth>
                <InputLabel>Schema Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Schema Type"
                  onChange={(e) => handleFieldChange('type', e.target.value)}
                >
                  {Object.values(SchemaType).map(type => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ')}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                label="Version"
                value={formData.version}
                onChange={(e) => handleFieldChange('version', e.target.value)}
                fullWidth
              />
              
              <TextField
                label="Namespace"
                value={formData.namespace}
                onChange={(e) => handleFieldChange('namespace', e.target.value)}
                fullWidth
                helperText="Optional: Group related schemas"
              />
              
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                >
                  {Object.values(SchemaStatus).map(status => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isPublic}
                    onChange={(e) => handleFieldChange('isPublic', e.target.checked)}
                  />
                }
                label="Public Schema"
              />
              
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Tags
                </Typography>
                <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                  {formData.tags?.map(tag => (
                    <Chip
                      key={tag}
                      label={tag}
                      size="small"
                      onDelete={() => handleRemoveTag(tag)}
                    />
                  ))}
                </Box>
                <Box display="flex" gap={1}>
                  <TextField
                    size="small"
                    placeholder="Add tag"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    fullWidth
                  />
                  <IconButton onClick={handleAddTag} size="small">
                    <AddIcon />
                  </IconButton>
                </Box>
              </Box>
            </Stack>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">
                  Schema Definition
                </Typography>
                <Box display="flex" gap={1}>
                  {isValid ? (
                    <Chip
                      icon={<ValidIcon />}
                      label="Valid"
                      color="success"
                      size="small"
                    />
                  ) : (
                    <Chip
                      icon={<ErrorIcon />}
                      label="Invalid"
                      color="error"
                      size="small"
                    />
                  )}
                  <Tooltip title="Format JSON">
                    <IconButton onClick={formatJSON} size="small">
                      <FormatIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Editor
                  height="400px"
                  language={getLanguageForType(formData.type || SchemaType.JSON_SCHEMA)}
                  value={schemaContent}
                  onChange={handleEditorChange}
                  onMount={(editor) => { editorRef.current = editor; }}
                  theme="vs-light"
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 14,
                    wordWrap: 'on',
                    automaticLayout: true,
                    formatOnPaste: true,
                    formatOnType: true
                  }}
                />
              </Box>
              
              {validationError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {validationError}
                </Alert>
              )}
            </Box>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 3 }} />
        
        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="outlined"
            startIcon={<CancelIcon />}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!isValid || !formData.name}
          >
            {schema ? 'Update Schema' : 'Create Schema'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SchemaEditor;