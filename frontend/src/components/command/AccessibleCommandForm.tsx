/**
 * Accessible Command Form Implementation
 * Demonstrates the accessible form validation system with a real-world rover command form
 */

import React, { useState, useCallback } from 'react';
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import { Theme } from '../../theme/themes';
import { AccessibleForm, FormFieldWrapper } from '../ui/core/Form/AccessibleForm';
import { Input } from '../ui/core/Input/Input';
import { Button } from '../ui/core/Button/Button';
import { FormConfig } from '../../hooks/useAccessibleFormValidation';
import { FormError } from '../ui/core/FormError/FormError';
import { useFocusManagement } from '../../contexts/FocusManagementContext';

// Command types for rover operations
export enum CommandType {
  MOVE_FORWARD = 'move_forward',
  MOVE_BACKWARD = 'move_backward',
  TURN_LEFT = 'turn_left',
  TURN_RIGHT = 'turn_right',
  STOP = 'stop',
  EMERGENCY_STOP = 'emergency_stop',
  SET_SPEED = 'set_speed',
  SET_POWER = 'set_power',
}

export enum CommandPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

interface CommandFormData {
  commandType: CommandType;
  priority: CommandPriority;
  distance?: number;
  speed?: number;
  angle?: number;
  powerLevel?: number;
  notes?: string;
}

interface AccessibleCommandFormProps {
  onSubmit: (command: CommandFormData) => Promise<void>;
  initialCommand?: Partial<CommandFormData>;
  disabled?: boolean;
  className?: string;
}

const FormContainer = styled.div<{ theme: Theme }>`
  max-width: 600px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing[6]};
  background-color: ${({ theme }) => theme.colors.background.paper};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.md};

  /* Mission Critical theme styling */
  ${({ theme }) => theme.name === 'missionCritical' && css`
    border: 2px solid ${theme.colors.primary.main};
    box-shadow: 0 0 20px ${theme.colors.primary.main}20;
  `}
`;

const FieldGroup = styled.div<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[4]};
`;

const FieldRow = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing[3]};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SelectField = styled.select<{ theme: Theme; hasError?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing[3]};
  border: 2px solid ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.background.paper};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary.main}40;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.background.default};
    color: ${({ theme }) => theme.colors.text.disabled};
    cursor: not-allowed;
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    border-width: 3px;
  }
`;

const TextAreaField = styled.textarea<{ theme: Theme; hasError?: boolean }>`
  width: 100%;
  min-height: 80px;
  padding: ${({ theme }) => theme.spacing[3]};
  border: 2px solid ${({ theme, hasError }) => hasError ? theme.colors.error.main : theme.colors.divider};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background-color: ${({ theme }) => theme.colors.background.paper};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary.main}40;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.colors.background.default};
    color: ${({ theme }) => theme.colors.text.disabled};
    cursor: not-allowed;
  }
`;

const RangeSlider = styled.input<{ theme: Theme }>`
  width: 100%;
  height: 8px;
  background: ${({ theme }) => theme.colors.divider};
  border-radius: 4px;
  outline: none;
  
  &::-webkit-slider-thumb {
    appearance: none;
    width: 20px;
    height: 20px;
    background: ${({ theme }) => theme.colors.primary.main};
    border-radius: 50%;
    cursor: pointer;
    
    &:focus {
      box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary.main}40;
    }
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: ${({ theme }) => theme.colors.primary.main};
    border-radius: 50%;
    cursor: pointer;
    border: none;
    
    &:focus {
      box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary.main}40;
    }
  }
`;

const SliderValue = styled.div<{ theme: Theme }>`
  text-align: center;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-top: ${({ theme }) => theme.spacing[1]};
`;

export const AccessibleCommandForm: React.FC<AccessibleCommandFormProps> = ({
  onSubmit,
  initialCommand = {},
  disabled = false,
  className,
}) => {
  const { focusVisible } = useFocusManagement();

  // Form configuration with validation rules
  const formConfig: FormConfig = {
    commandType: {
      label: 'Command Type',
      rules: {
        required: true,
      },
      liveValidation: false,
    },
    priority: {
      label: 'Priority Level',
      rules: {
        required: true,
      },
      liveValidation: false,
    },
    distance: {
      label: 'Distance',
      type: 'number',
      rules: {
        min: 0.1,
        max: 100,
        custom: (value) => {
          if (value && (value < 0.1 || value > 100)) {
            return 'Distance must be between 0.1 and 100 meters';
          }
          return null;
        },
      },
      ariaDescribedBy: ['distance-help'],
    },
    speed: {
      label: 'Speed',
      type: 'number',
      rules: {
        min: 0.1,
        max: 10,
        custom: (value) => {
          if (value && (value < 0.1 || value > 10)) {
            return 'Speed must be between 0.1 and 10 m/s';
          }
          return null;
        },
      },
      ariaDescribedBy: ['speed-help'],
    },
    angle: {
      label: 'Turn Angle',
      type: 'number',
      rules: {
        min: 1,
        max: 360,
      },
      ariaDescribedBy: ['angle-help'],
    },
    powerLevel: {
      label: 'Power Level',
      type: 'number',
      rules: {
        min: 0,
        max: 100,
      },
      ariaDescribedBy: ['power-help'],
    },
    notes: {
      label: 'Additional Notes',
      rules: {
        maxLength: 500,
      },
      ariaDescribedBy: ['notes-help'],
    },
  };

  // Form state for conditional fields
  const [selectedCommandType, setSelectedCommandType] = useState<CommandType>(
    (initialCommand.commandType as CommandType) || CommandType.MOVE_FORWARD
  );

  // Handle form submission
  const handleSubmit = useCallback(async (values: Record<string, any>) => {
    const commandData: CommandFormData = {
      commandType: values.commandType as CommandType,
      priority: values.priority as CommandPriority,
      distance: values.distance ? parseFloat(values.distance) : undefined,
      speed: values.speed ? parseFloat(values.speed) : undefined,
      angle: values.angle ? parseFloat(values.angle) : undefined,
      powerLevel: values.powerLevel ? parseFloat(values.powerLevel) : undefined,
      notes: values.notes || undefined,
    };

    await onSubmit(commandData);
  }, [onSubmit]);

  // Get initial form values
  const getInitialValues = () => ({
    commandType: initialCommand.commandType || CommandType.MOVE_FORWARD,
    priority: initialCommand.priority || CommandPriority.NORMAL,
    distance: initialCommand.distance?.toString() || '',
    speed: initialCommand.speed?.toString() || '',
    angle: initialCommand.angle?.toString() || '',
    powerLevel: initialCommand.powerLevel?.toString() || '',
    notes: initialCommand.notes || '',
  });

  // Render parameter fields based on command type
  const renderParameterFields = () => {
    switch (selectedCommandType) {
      case CommandType.MOVE_FORWARD:
      case CommandType.MOVE_BACKWARD:
        return (
          <FieldGroup>
            <FormFieldWrapper>
              <Input
                name="distance"
                type="number"
                label="Distance (meters)"
                placeholder="Enter distance in meters"
                min={0.1}
                max={100}
                step={0.1}
                disabled={disabled}
              />
              <div id="distance-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Specify how far the rover should move (0.1 to 100 meters)
              </div>
            </FormFieldWrapper>

            <FormFieldWrapper>
              <Input
                name="speed"
                type="number"
                label="Speed (m/s)"
                placeholder="Enter speed in meters per second"
                min={0.1}
                max={10}
                step={0.1}
                disabled={disabled}
              />
              <div id="speed-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Movement speed (0.1 to 10 m/s, recommended: 1-3 m/s)
              </div>
            </FormFieldWrapper>
          </FieldGroup>
        );

      case CommandType.TURN_LEFT:
      case CommandType.TURN_RIGHT:
        return (
          <FieldGroup>
            <FormFieldWrapper>
              <label htmlFor="angle-slider" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Turn Angle: {selectedCommandType === CommandType.TURN_LEFT ? 'Left' : 'Right'}
              </label>
              <RangeSlider
                id="angle-slider"
                name="angle"
                type="range"
                min={1}
                max={360}
                step={1}
                disabled={disabled}
                aria-describedby="angle-help angle-value"
                onChange={(e) => {
                  // Handle range slider change
                  const event = {
                    target: { value: e.target.value, name: 'angle' }
                  } as React.ChangeEvent<HTMLInputElement>;
                  // This will be handled by the form's field props
                }}
              />
              <SliderValue id="angle-value">
                {/* This will be updated by the form state */}
                degrees
              </SliderValue>
              <div id="angle-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Specify turn angle in degrees (1-360°)
              </div>
            </FormFieldWrapper>
          </FieldGroup>
        );

      case CommandType.SET_POWER:
        return (
          <FieldGroup>
            <FormFieldWrapper>
              <label htmlFor="power-slider" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Power Level
              </label>
              <RangeSlider
                id="power-slider"
                name="powerLevel"
                type="range"
                min={0}
                max={100}
                step={1}
                disabled={disabled}
                aria-describedby="power-help power-value"
              />
              <SliderValue id="power-value">
                % power
              </SliderValue>
              <div id="power-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Set rover power level (0-100%). Warning: Levels above 80% should be used with caution.
              </div>
            </FormFieldWrapper>
          </FieldGroup>
        );

      case CommandType.SET_SPEED:
        return (
          <FieldGroup>
            <FormFieldWrapper>
              <Input
                name="speed"
                type="number"
                label="Target Speed (m/s)"
                placeholder="Enter target speed"
                min={0.1}
                max={10}
                step={0.1}
                disabled={disabled}
                required
              />
              <div id="speed-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Set rover movement speed (0.1 to 10 m/s)
              </div>
            </FormFieldWrapper>
          </FieldGroup>
        );

      case CommandType.EMERGENCY_STOP:
        return (
          <FieldGroup>
            <div style={{ 
              padding: '1rem', 
              backgroundColor: 'var(--error-light)', 
              border: '2px solid var(--error-main)', 
              borderRadius: '0.5rem',
              color: 'var(--error-dark)'
            }}>
              <strong>⚠ Warning:</strong> Emergency Stop will immediately halt all rover operations. 
              Use only in emergency situations.
            </div>
          </FieldGroup>
        );

      default:
        return null;
    }
  };

  return (
    <FormContainer className={className}>
      <AccessibleForm
        config={formConfig}
        onSubmit={handleSubmit}
        initialValues={getInitialValues()}
        title="Rover Command Control"
        description="Configure and send commands to the rover. All fields marked with * are required."
        submitText="Send Command"
        resetText="Clear Form"
        showResetButton
        disabled={disabled}
        formName="rover-command"
        testId="rover-command-form"
        validateOnChange
        validateOnBlur
      >
        <FieldRow>
          <FormFieldWrapper>
            <label htmlFor="commandType" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Command Type <span style={{ color: 'var(--error-main)' }}>*</span>
            </label>
            <SelectField
              id="commandType"
              name="commandType"
              disabled={disabled}
              onChange={(e) => {
                setSelectedCommandType(e.target.value as CommandType);
                // This will also be handled by the form's field props
              }}
              aria-describedby="commandType-help"
            >
              <option value={CommandType.MOVE_FORWARD}>Move Forward</option>
              <option value={CommandType.MOVE_BACKWARD}>Move Backward</option>
              <option value={CommandType.TURN_LEFT}>Turn Left</option>
              <option value={CommandType.TURN_RIGHT}>Turn Right</option>
              <option value={CommandType.STOP}>Stop</option>
              <option value={CommandType.EMERGENCY_STOP}>Emergency Stop</option>
              <option value={CommandType.SET_SPEED}>Set Speed</option>
              <option value={CommandType.SET_POWER}>Set Power</option>
            </SelectField>
            <div id="commandType-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Select the type of command to send to the rover
            </div>
          </FormFieldWrapper>

          <FormFieldWrapper>
            <label htmlFor="priority" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Priority Level <span style={{ color: 'var(--error-main)' }}>*</span>
            </label>
            <SelectField
              id="priority"
              name="priority"
              disabled={disabled || selectedCommandType === CommandType.EMERGENCY_STOP}
              aria-describedby="priority-help"
            >
              <option value={CommandPriority.LOW}>Low</option>
              <option value={CommandPriority.NORMAL}>Normal</option>
              <option value={CommandPriority.HIGH}>High</option>
              <option value={CommandPriority.EMERGENCY}>Emergency</option>
            </SelectField>
            <div id="priority-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Set command execution priority
            </div>
          </FormFieldWrapper>
        </FieldRow>

        {renderParameterFields()}

        <FormFieldWrapper>
          <label htmlFor="notes" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Additional Notes
          </label>
          <TextAreaField
            id="notes"
            name="notes"
            placeholder="Optional notes about this command..."
            disabled={disabled}
            aria-describedby="notes-help"
          />
          <div id="notes-help" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Optional notes or context for this command (max 500 characters)
          </div>
        </FormFieldWrapper>
      </AccessibleForm>
    </FormContainer>
  );
};