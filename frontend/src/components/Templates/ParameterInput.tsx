/**
 * Parameter Input Component
 * Renders appropriate input controls based on parameter type and configuration
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Slider,
  Switch,
  IconButton,
  InputAdornment,
  FormHelperText,
  Chip,
  Autocomplete,
  Typography,
  Tooltip,
  Paper
} from '@mui/material';
import {
  Help as HelpIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { DatePicker, TimePicker, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import {
  TemplateParameter,
  ParameterType,
  UIComponent
} from '../../services/templateService';

interface ParameterInputProps {
  parameter: TemplateParameter;
  value: any;
  onChange: (value: any) => void;
  error?: string;
  disabled?: boolean;
  onClear?: () => void;
}

export const ParameterInput: React.FC<ParameterInputProps> = ({
  parameter,
  value,
  onChange,
  error,
  disabled = false,
  onClear
}) => {
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  const handleChange = useCallback((newValue: any) => {
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);
  
  const renderInput = () => {
    const uiComponent = parameter.uiComponent || getDefaultUIComponent(parameter.parameterType);
    
    switch (uiComponent) {
      case UIComponent.TEXT:
      case UIComponent.TEXTAREA:
        return (
          <TextField
            fullWidth
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            error={!!error}
            helperText={error || parameter.helpText}
            disabled={disabled}
            multiline={uiComponent === UIComponent.TEXTAREA}
            rows={uiComponent === UIComponent.TEXTAREA ? 4 : 1}
            placeholder={parameter.placeholder}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {parameter.helpText && (
                    <Tooltip title={parameter.helpText}>
                      <IconButton size="small">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onClear && localValue && (
                    <IconButton size="small" onClick={onClear}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </InputAdornment>
              )
            }}
          />
        );
        
      case UIComponent.NUMBER:
        return (
          <TextField
            fullWidth
            type="number"
            value={localValue || ''}
            onChange={(e) => handleChange(e.target.value ? Number(e.target.value) : undefined)}
            error={!!error}
            helperText={error || parameter.helpText}
            disabled={disabled}
            placeholder={parameter.placeholder}
            inputProps={{
              min: parameter.minValue,
              max: parameter.maxValue,
              step: parameter.uiConfig?.step || 1
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  {parameter.helpText && (
                    <Tooltip title={parameter.helpText}>
                      <IconButton size="small">
                        <HelpIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </InputAdornment>
              )
            }}
          />
        );
        
      case UIComponent.SLIDER:
        return (
          <Box>
            <Typography gutterBottom>
              {localValue !== undefined ? localValue : parameter.defaultValue || 0}
            </Typography>
            <Slider
              value={localValue !== undefined ? localValue : parameter.defaultValue || 0}
              onChange={(_, newValue) => handleChange(newValue)}
              disabled={disabled}
              min={parameter.minValue || 0}
              max={parameter.maxValue || 100}
              step={parameter.uiConfig?.step || 1}
              marks={parameter.uiConfig?.marks}
              valueLabelDisplay="auto"
            />
            {(error || parameter.helpText) && (
              <FormHelperText error={!!error}>
                {error || parameter.helpText}
              </FormHelperText>
            )}
          </Box>
        );
        
      case UIComponent.SELECT:
        return (
          <FormControl fullWidth error={!!error}>
            <Select
              value={localValue || ''}
              onChange={(e) => handleChange(e.target.value)}
              disabled={disabled}
              displayEmpty
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {parameter.enumValues?.map((option) => (
                <MenuItem key={option} value={option}>
                  {parameter.uiConfig?.labels?.[option] || option}
                </MenuItem>
              ))}
            </Select>
            {(error || parameter.helpText) && (
              <FormHelperText>{error || parameter.helpText}</FormHelperText>
            )}
          </FormControl>
        );
        
      case UIComponent.RADIO:
        return (
          <FormControl error={!!error}>
            <RadioGroup
              value={localValue || ''}
              onChange={(e) => handleChange(e.target.value)}
            >
              {parameter.enumValues?.map((option) => (
                <FormControlLabel
                  key={option}
                  value={option}
                  control={<Radio />}
                  label={parameter.uiConfig?.labels?.[option] || option}
                  disabled={disabled}
                />
              ))}
            </RadioGroup>
            {(error || parameter.helpText) && (
              <FormHelperText>{error || parameter.helpText}</FormHelperText>
            )}
          </FormControl>
        );
        
      case UIComponent.CHECKBOX:
        return (
          <FormControl error={!!error}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={!!localValue}
                  onChange={(e) => handleChange(e.target.checked)}
                  disabled={disabled}
                />
              }
              label={parameter.displayName || parameter.name}
            />
            {(error || parameter.helpText) && (
              <FormHelperText>{error || parameter.helpText}</FormHelperText>
            )}
          </FormControl>
        );
        
      case UIComponent.DATE_PICKER:
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              value={localValue ? new Date(localValue) : null}
              onChange={(newValue) => handleChange(newValue?.toISOString())}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  error={!!error}
                  helperText={error || parameter.helpText}
                />
              )}
            />
          </LocalizationProvider>
        );
        
      case UIComponent.TIME_PICKER:
        return (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <TimePicker
              value={localValue ? new Date(localValue) : null}
              onChange={(newValue) => handleChange(newValue?.toISOString())}
              disabled={disabled}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  error={!!error}
                  helperText={error || parameter.helpText}
                />
              )}
            />
          </LocalizationProvider>
        );
        
      case UIComponent.COLOR_PICKER:
        return (
          <Box>
            <TextField
              fullWidth
              type="color"
              value={localValue || '#000000'}
              onChange={(e) => handleChange(e.target.value)}
              error={!!error}
              helperText={error || parameter.helpText}
              disabled={disabled}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Box
                      sx={{
                        width: 24,
                        height: 24,
                        backgroundColor: localValue || '#000000',
                        border: '1px solid #ccc',
                        borderRadius: 1
                      }}
                    />
                  </InputAdornment>
                )
              }}
            />
          </Box>
        );
        
      default:
        // Handle array and object types
        if (parameter.parameterType === ParameterType.ARRAY) {
          return <ArrayInput parameter={parameter} value={localValue} onChange={handleChange} error={error} disabled={disabled} />;
        }
        
        if (parameter.parameterType === ParameterType.OBJECT) {
          return <ObjectInput parameter={parameter} value={localValue} onChange={handleChange} error={error} disabled={disabled} />;
        }
        
        // Fallback to text input
        return (
          <TextField
            fullWidth
            value={typeof localValue === 'object' ? JSON.stringify(localValue) : localValue || ''}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleChange(parsed);
              } catch {
                handleChange(e.target.value);
              }
            }}
            error={!!error}
            helperText={error || parameter.helpText || 'JSON format for complex values'}
            disabled={disabled}
            multiline
            rows={4}
          />
        );
    }
  };
  
  return (
    <Box>
      <FormLabel required={parameter.required}>
        {parameter.displayName || parameter.name}
      </FormLabel>
      {parameter.description && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {parameter.description}
        </Typography>
      )}
      <Box mt={1}>
        {renderInput()}
      </Box>
    </Box>
  );
};

// Array Input Component
interface ArrayInputProps {
  parameter: TemplateParameter;
  value: any[];
  onChange: (value: any[]) => void;
  error?: string;
  disabled?: boolean;
}

const ArrayInput: React.FC<ArrayInputProps> = ({
  parameter,
  value = [],
  onChange,
  error,
  disabled
}) => {
  const handleAdd = () => {
    onChange([...value, parameter.uiConfig?.itemDefault || '']);
  };
  
  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };
  
  const handleItemChange = (index: number, newValue: any) => {
    const newArray = [...value];
    newArray[index] = newValue;
    onChange(newArray);
  };
  
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {value.map((item, index) => (
        <Box key={index} display="flex" alignItems="center" mb={1}>
          <Box flex={1}>
            <TextField
              fullWidth
              value={item}
              onChange={(e) => handleItemChange(index, e.target.value)}
              disabled={disabled}
              size="small"
            />
          </Box>
          <IconButton
            onClick={() => handleRemove(index)}
            disabled={disabled}
            size="small"
            color="error"
          >
            <RemoveIcon />
          </IconButton>
        </Box>
      ))}
      
      <Button
        startIcon={<AddIcon />}
        onClick={handleAdd}
        disabled={disabled}
        size="small"
      >
        Add Item
      </Button>
      
      {error && (
        <FormHelperText error>{error}</FormHelperText>
      )}
    </Paper>
  );
};

// Object Input Component
interface ObjectInputProps {
  parameter: TemplateParameter;
  value: Record<string, any>;
  onChange: (value: Record<string, any>) => void;
  error?: string;
  disabled?: boolean;
}

const ObjectInput: React.FC<ObjectInputProps> = ({
  parameter,
  value = {},
  onChange,
  error,
  disabled
}) => {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(value, null, 2));
  const [jsonError, setJsonError] = useState('');
  
  const handleJsonChange = (newJson: string) => {
    setJsonValue(newJson);
    try {
      const parsed = JSON.parse(newJson);
      onChange(parsed);
      setJsonError('');
    } catch (e) {
      setJsonError('Invalid JSON');
    }
  };
  
  const schema = parameter.uiConfig?.schema || {};
  const properties = schema.properties || {};
  
  if (jsonMode || Object.keys(properties).length === 0) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <TextField
          fullWidth
          multiline
          rows={6}
          value={jsonValue}
          onChange={(e) => handleJsonChange(e.target.value)}
          error={!!jsonError || !!error}
          helperText={jsonError || error || 'JSON format'}
          disabled={disabled}
        />
      </Paper>
    );
  }
  
  // Render form based on schema
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      {Object.entries(properties).map(([key, prop]: [string, any]) => (
        <Box key={key} mb={2}>
          <TextField
            fullWidth
            label={prop.title || key}
            value={value[key] || ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            disabled={disabled}
            helperText={prop.description}
            required={schema.required?.includes(key)}
          />
        </Box>
      ))}
      
      {error && (
        <FormHelperText error>{error}</FormHelperText>
      )}
    </Paper>
  );
};

// Helper function to get default UI component for parameter type
function getDefaultUIComponent(parameterType: ParameterType): UIComponent {
  switch (parameterType) {
    case ParameterType.STRING:
      return UIComponent.TEXT;
    case ParameterType.NUMBER:
      return UIComponent.NUMBER;
    case ParameterType.BOOLEAN:
      return UIComponent.CHECKBOX;
    case ParameterType.ENUM:
      return UIComponent.SELECT;
    case ParameterType.DATE:
      return UIComponent.DATE_PICKER;
    default:
      return UIComponent.TEXT;
  }
}