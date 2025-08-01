/**
 * Example Command Form Component
 * Demonstrates real-time validation with user feedback
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Paper,
  Typography,
  Stack,
  Slider,
  Switch,
  FormControlLabel,
  CircularProgress,
  Divider
} from '@mui/material';
import { Send as SendIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useCommandValidation } from '../../hooks/useCommandValidation';
import { 
  CommandValidationFeedback, 
  FieldValidationFeedback,
  ValidationSummary 
} from './CommandValidationFeedback';
import { 
  Command, 
  CommandType, 
  CommandPriority,
  MovementParameters,
  SpeedParameters,
  PowerParameters
} from '../../services/command/types';
import { useCommandSerializer } from '../../services/command/CommandSerializer';
import { Protocol } from '../../services/websocket/types';

interface CommandFormProps {
  onSubmit: (command: Command, serialized: Uint8Array) => Promise<void>;
  defaultCommandType?: CommandType;
  showAdvancedOptions?: boolean;
}

export const CommandForm: React.FC<CommandFormProps> = ({
  onSubmit,
  defaultCommandType = CommandType.MOVE_FORWARD,
  showAdvancedOptions = true
}) => {
  // Form state
  const [commandType, setCommandType] = useState<CommandType>(defaultCommandType);
  const [priority, setPriority] = useState<CommandPriority>(CommandPriority.NORMAL);
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [protocol, setProtocol] = useState<Protocol>(Protocol.MESSAGEPACK);
  const [compress, setCompress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation hook
  const {
    validationState,
    validateCommand,
    validateField,
    clearValidation,
    markFieldTouched,
    markAllFieldsTouched,
    isFieldTouched,
    getFieldError,
    hasFieldError,
    getParameterSchema
  } = useCommandValidation({
    validateOnChange: true,
    validateOnBlur: true,
    debounceMs: 300
  });

  // Serialization hook
  const serializer = useCommandSerializer();

  // Handle command type change
  const handleCommandTypeChange = useCallback((newType: CommandType) => {
    setCommandType(newType);
    setParameters({}); // Reset parameters
    clearValidation(); // Clear validation
  }, [clearValidation]);

  // Handle parameter change
  const handleParameterChange = useCallback(async (
    paramName: string,
    value: any
  ) => {
    const newParams = { ...parameters, [paramName]: value };
    setParameters(newParams);

    // Validate the specific field
    await validateField(`parameters.${paramName}`, value, commandType);
  }, [parameters, commandType, validateField]);

  // Handle field blur
  const handleFieldBlur = useCallback((fieldPath: string) => {
    markFieldTouched(fieldPath);
  }, [markFieldTouched]);

  // Handle form submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched to show all errors
    markAllFieldsTouched();

    // Create command object
    const command: Partial<Command> = {
      id: crypto.randomUUID(),
      commandType,
      priority,
      parameters,
      metadata: {
        source: 'ui_form',
        tags: ['user_command'],
        customData: {
          protocol,
          compressed: compress
        }
      },
      timeoutMs: 30000,
      maxRetries: priority === CommandPriority.EMERGENCY ? 0 : 2
    };

    // Validate complete command
    const validationResult = await validateCommand(command);
    
    if (!validationResult.valid) {
      return; // Validation errors are displayed by the UI
    }

    // Serialize command
    setIsSubmitting(true);
    try {
      const serialized = await serializer.serialize(command, {
        protocol,
        compress,
        validate: true
      });

      // Call the submit handler
      await onSubmit(command as Command, serialized.data as Uint8Array);
      
      // Reset form on success
      setParameters({});
      clearValidation();
    } catch (error) {
      console.error('Command submission failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    commandType,
    priority,
    parameters,
    protocol,
    compress,
    validateCommand,
    markAllFieldsTouched,
    serializer,
    onSubmit,
    clearValidation
  ]);

  // Render parameter fields based on command type
  const renderParameterFields = () => {
    switch (commandType) {
      case CommandType.MOVE_FORWARD:
      case CommandType.MOVE_BACKWARD:
        return (
          <Stack spacing={2}>
            <TextField
              label="Distance (meters)"
              type="number"
              value={parameters.distance || ''}
              onChange={(e) => handleParameterChange('distance', parseFloat(e.target.value))}
              onBlur={() => handleFieldBlur('parameters.distance')}
              error={hasFieldError('parameters.distance')}
              fullWidth
              inputProps={{ min: 0.1, max: 100, step: 0.1 }}
            />
            <FieldValidationFeedback
              error={getFieldError('parameters.distance')}
              touched={isFieldTouched('parameters.distance')}
            />
            
            <TextField
              label="Speed (m/s)"
              type="number"
              value={parameters.speed || ''}
              onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
              onBlur={() => handleFieldBlur('parameters.speed')}
              error={hasFieldError('parameters.speed')}
              fullWidth
              inputProps={{ min: 0.1, max: 5, step: 0.1 }}
            />
            <FieldValidationFeedback
              error={getFieldError('parameters.speed')}
              touched={isFieldTouched('parameters.speed')}
            />
          </Stack>
        );

      case CommandType.TURN_LEFT:
      case CommandType.TURN_RIGHT:
        return (
          <Stack spacing={2}>
            <Box>
              <Typography gutterBottom>Angle: {parameters.angle || 0}°</Typography>
              <Slider
                value={parameters.angle || 0}
                onChange={(e, value) => handleParameterChange('angle', value)}
                onBlur={() => handleFieldBlur('parameters.angle')}
                min={0}
                max={360}
                step={1}
                marks={[
                  { value: 0, label: '0°' },
                  { value: 90, label: '90°' },
                  { value: 180, label: '180°' },
                  { value: 270, label: '270°' },
                  { value: 360, label: '360°' }
                ]}
              />
              <FieldValidationFeedback
                error={getFieldError('parameters.angle')}
                touched={isFieldTouched('parameters.angle')}
              />
            </Box>
          </Stack>
        );

      case CommandType.SET_SPEED:
        return (
          <Stack spacing={2}>
            <TextField
              label="Target Speed (m/s)"
              type="number"
              value={parameters.speed || ''}
              onChange={(e) => handleParameterChange('speed', parseFloat(e.target.value))}
              onBlur={() => handleFieldBlur('parameters.speed')}
              error={hasFieldError('parameters.speed')}
              fullWidth
              required
              inputProps={{ min: 0, max: 10, step: 0.1 }}
            />
            <FieldValidationFeedback
              error={getFieldError('parameters.speed')}
              touched={isFieldTouched('parameters.speed')}
            />
            
            <TextField
              label="Acceleration (m/s²)"
              type="number"
              value={parameters.acceleration || ''}
              onChange={(e) => handleParameterChange('acceleration', parseFloat(e.target.value))}
              onBlur={() => handleFieldBlur('parameters.acceleration')}
              error={hasFieldError('parameters.acceleration')}
              fullWidth
              inputProps={{ min: 0, max: 5, step: 0.1 }}
            />
            <FieldValidationFeedback
              error={getFieldError('parameters.acceleration')}
              touched={isFieldTouched('parameters.acceleration')}
            />
          </Stack>
        );

      case CommandType.SET_POWER:
        return (
          <Stack spacing={2}>
            <Box>
              <Typography gutterBottom>
                Power Level: {parameters.powerLevel || 0}%
              </Typography>
              <Slider
                value={parameters.powerLevel || 0}
                onChange={(e, value) => handleParameterChange('powerLevel', value)}
                onBlur={() => handleFieldBlur('parameters.powerLevel')}
                min={0}
                max={100}
                step={1}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 25, label: '25%' },
                  { value: 50, label: '50%' },
                  { value: 75, label: '75%' },
                  { value: 100, label: '100%' }
                ]}
                color={parameters.powerLevel > 80 ? 'warning' : 'primary'}
              />
              <FieldValidationFeedback
                error={getFieldError('parameters.powerLevel')}
                touched={isFieldTouched('parameters.powerLevel')}
              />
            </Box>
          </Stack>
        );

      case CommandType.EMERGENCY_STOP:
        return (
          <Typography color="error" variant="body2">
            Emergency Stop will halt all rover operations immediately!
          </Typography>
        );

      default:
        return (
          <Typography variant="body2" color="text.secondary">
            No parameters required for this command type.
          </Typography>
        );
    }
  };

  // Estimate serialization sizes
  const getSizeEstimates = () => {
    const command = { commandType, priority, parameters };
    const estimates = serializer.compareProtocols(command);
    return estimates;
  };

  return (
    <Paper elevation={3} sx={{ p: 3 }}>
      <form onSubmit={handleSubmit}>
        <Stack spacing={3}>
          <Typography variant="h6">Command Builder</Typography>
          
          {/* Command Type Selection */}
          <FormControl fullWidth>
            <InputLabel>Command Type</InputLabel>
            <Select
              value={commandType}
              onChange={(e) => handleCommandTypeChange(e.target.value as CommandType)}
              label="Command Type"
            >
              <MenuItem value={CommandType.MOVE_FORWARD}>Move Forward</MenuItem>
              <MenuItem value={CommandType.MOVE_BACKWARD}>Move Backward</MenuItem>
              <MenuItem value={CommandType.TURN_LEFT}>Turn Left</MenuItem>
              <MenuItem value={CommandType.TURN_RIGHT}>Turn Right</MenuItem>
              <MenuItem value={CommandType.STOP}>Stop</MenuItem>
              <MenuItem value={CommandType.EMERGENCY_STOP}>Emergency Stop</MenuItem>
              <MenuItem value={CommandType.SET_SPEED}>Set Speed</MenuItem>
              <MenuItem value={CommandType.SET_POWER}>Set Power</MenuItem>
            </Select>
          </FormControl>

          {/* Priority Selection */}
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as CommandPriority)}
              label="Priority"
              disabled={commandType === CommandType.EMERGENCY_STOP}
            >
              <MenuItem value={CommandPriority.LOW}>Low</MenuItem>
              <MenuItem value={CommandPriority.NORMAL}>Normal</MenuItem>
              <MenuItem value={CommandPriority.HIGH}>High</MenuItem>
              <MenuItem value={CommandPriority.EMERGENCY}>Emergency</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          {/* Command Parameters */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Parameters
            </Typography>
            {renderParameterFields()}
          </Box>

          {/* Advanced Options */}
          {showAdvancedOptions && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Serialization Options
                </Typography>
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Protocol</InputLabel>
                    <Select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value as Protocol)}
                      label="Protocol"
                    >
                      <MenuItem value={Protocol.JSON}>JSON</MenuItem>
                      <MenuItem value={Protocol.MESSAGEPACK}>MessagePack</MenuItem>
                      <MenuItem value={Protocol.CBOR}>CBOR</MenuItem>
                    </Select>
                    <FormHelperText>
                      Estimated sizes: {Object.entries(getSizeEstimates())
                        .map(([p, size]) => `${p}: ${size}B`)
                        .join(', ')}
                    </FormHelperText>
                  </FormControl>
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={compress}
                        onChange={(e) => setCompress(e.target.checked)}
                      />
                    }
                    label="Enable compression"
                  />
                </Stack>
              </Box>
            </>
          )}

          {/* Validation Summary */}
          <ValidationSummary
            validationState={validationState}
            showDetails={false}
          />

          {/* Validation Feedback */}
          <CommandValidationFeedback
            validationState={validationState}
            showSuccessMessage={false}
            compact={false}
          />

          {/* Action Buttons */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              onClick={() => {
                setParameters({});
                clearValidation();
              }}
              startIcon={<ClearIcon />}
            >
              Clear
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting || !validationState.isValid}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <SendIcon />}
              color={commandType === CommandType.EMERGENCY_STOP ? 'error' : 'primary'}
            >
              {isSubmitting ? 'Sending...' : 'Send Command'}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Paper>
  );
};