/**
 * Command Validation Utilities for Frontend
 * Provides client-side validation with immediate UI feedback
 */

import { z } from 'zod';
import { CommandType, CommandPriority, CommandStatus } from './types';

// Re-export command types from backend mapping
export { CommandType, CommandPriority, CommandStatus };

/**
 * Range validator for numeric values
 */
export interface RangeValidator {
  minValue?: number;
  maxValue?: number;
  validate(value: number): boolean;
}

/**
 * Command metadata schema
 */
export const CommandMetadataSchema = z.object({
  source: z.string().min(1).max(100),
  sessionId: z.string().regex(/^[a-zA-Z0-9-_]+$/).optional(),
  userId: z.string().regex(/^[a-zA-Z0-9-_]+$/).optional(),
  correlationId: z.string().regex(/^[a-zA-Z0-9-_]+$/).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  customData: z.record(z.any()).default({}).refine(
    (data) => JSON.stringify(data).length <= 1024,
    { message: "Custom data exceeds size limit (1KB)" }
  ),
});

/**
 * Command result schema
 */
export const CommandResultSchema = z.object({
  success: z.boolean(),
  commandId: z.string().uuid(),
  status: z.nativeEnum(CommandStatus),
  resultData: z.record(z.any()).optional(),
  errorMessage: z.string().max(500).optional(),
  errorDetails: z.record(z.any()).optional(),
  executionTimeMs: z.number().nonnegative().optional(),
  timestamp: z.string().datetime(),
});

/**
 * Base command schema
 */
export const BaseCommandSchema = z.object({
  id: z.string().uuid(),
  commandType: z.nativeEnum(CommandType),
  priority: z.nativeEnum(CommandPriority).default(CommandPriority.NORMAL),
  metadata: CommandMetadataSchema,
  timeoutMs: z.number().int().positive().max(300000).default(30000),
  maxRetries: z.number().int().nonnegative().max(10).default(0),
  
  // Execution state fields
  status: z.nativeEnum(CommandStatus).optional(),
  createdAt: z.string().datetime().optional(),
  queuedAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  retryCount: z.number().int().nonnegative().default(0),
});

/**
 * Movement command parameters
 */
export const MovementParametersSchema = z.object({
  distance: z.number().positive().max(1000).optional(), // meters
  angle: z.number().min(-360).max(360).optional(), // degrees
  duration: z.number().positive().max(60).optional(), // seconds
  speed: z.number().positive().max(10).optional(), // m/s
}).refine(
  (data) => Object.values(data).some(v => v !== undefined),
  { message: "At least one movement parameter must be specified" }
);

/**
 * Speed control parameters
 */
export const SpeedParametersSchema = z.object({
  speed: z.number().nonnegative().max(10), // m/s
  acceleration: z.number().nonnegative().max(5).optional(), // m/s²
}).refine(
  (data) => {
    // Additional safety validation for high speeds
    if (data.speed > 5) {
      console.warn('High speed command:', data.speed);
    }
    return true;
  }
);

/**
 * Power control parameters
 */
export const PowerParametersSchema = z.object({
  powerLevel: z.number().nonnegative().max(100), // percentage
  rampTime: z.number().nonnegative().max(10).optional(), // seconds
});

/**
 * Sensor command parameters
 */
const VALID_SENSORS = ["TEMP_01", "DIST_FRONT", "DIST_REAR", "CAM_MAIN", "IMU_01", "GPS_01"] as const;

export const SensorParametersSchema = z.object({
  sensorId: z.enum(VALID_SENSORS),
  sensorType: z.enum(["temperature", "distance", "camera", "imu", "gps"]).optional(),
  sampleRate: z.number().positive().max(1000).optional(), // Hz
});

/**
 * Calibration parameters
 */
export const CalibrationParametersSchema = z.object({
  sensorId: z.enum(VALID_SENSORS),
  calibrationType: z.enum(["zero", "span", "full"]).default("zero"),
  referenceValue: z.number().optional(),
}).refine(
  (data) => {
    if ((data.calibrationType === 'span' || data.calibrationType === 'full') && 
        data.referenceValue === undefined) {
      return false;
    }
    return true;
  },
  { message: "Reference value required for span/full calibration" }
);

/**
 * Diagnostic parameters
 */
export const DiagnosticParametersSchema = z.object({
  subsystem: z.enum(["motors", "sensors", "communication", "power", "all"]).default("all"),
  verbose: z.boolean().default(false),
  includeLogs: z.boolean().default(false),
  logDuration: z.number().int().positive().max(3600).optional(), // seconds
});

/**
 * Firmware update parameters
 */
export const FirmwareUpdateParametersSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  checksum: z.string().regex(/^[a-f0-9]{64}$/), // SHA-256
  url: z.string().url().optional(),
  force: z.boolean().default(false),
}).refine(
  (data) => {
    if (data.url && !data.url.startsWith('https://')) {
      return false;
    }
    return true;
  },
  { message: "Firmware updates must use HTTPS" }
);

/**
 * Custom command parameters
 */
export const CustomCommandParametersSchema = z.object({
  commandName: z.string().min(1).max(100),
  parameters: z.record(z.any()).default({}).refine(
    (data) => JSON.stringify(data).length <= 4096,
    { message: "Custom parameters exceed size limit (4KB)" }
  ),
});

/**
 * Command parameter schemas mapping
 */
export const COMMAND_PARAMETER_SCHEMAS = {
  [CommandType.MOVE_FORWARD]: MovementParametersSchema,
  [CommandType.MOVE_BACKWARD]: MovementParametersSchema,
  [CommandType.TURN_LEFT]: MovementParametersSchema,
  [CommandType.TURN_RIGHT]: MovementParametersSchema,
  [CommandType.SET_SPEED]: SpeedParametersSchema,
  [CommandType.SET_POWER]: PowerParametersSchema,
  [CommandType.READ_SENSOR]: SensorParametersSchema,
  [CommandType.CALIBRATE_SENSOR]: CalibrationParametersSchema,
  [CommandType.DIAGNOSTIC]: DiagnosticParametersSchema,
  [CommandType.FIRMWARE_UPDATE]: FirmwareUpdateParametersSchema,
  [CommandType.CUSTOM]: CustomCommandParametersSchema,
} as const;

/**
 * Complete command schema with dynamic parameter validation
 */
export const CommandSchema = BaseCommandSchema.extend({
  parameters: z.record(z.any()).default({}),
}).refine(
  (data) => {
    const schema = COMMAND_PARAMETER_SCHEMAS[data.commandType as keyof typeof COMMAND_PARAMETER_SCHEMAS];
    if (schema) {
      try {
        schema.parse(data.parameters);
        return true;
      } catch (error) {
        return false;
      }
    }
    return true;
  },
  { 
    message: "Invalid parameters for command type",
    path: ["parameters"]
  }
);

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
  }>;
  warnings?: string[];
}

/**
 * Safety rule function type
 */
export type SafetyRule = (command: z.infer<typeof CommandSchema>) => boolean | { valid: boolean; message?: string };

/**
 * Command Validator Class
 */
export class CommandValidator {
  private customValidators: Map<CommandType, (command: any) => ValidationResult> = new Map();
  private safetyRules: Map<CommandType, SafetyRule[]> = new Map();

  /**
   * Register a custom validator for a command type
   */
  registerCustomValidator(commandType: CommandType, validator: (command: any) => ValidationResult): void {
    this.customValidators.set(commandType, validator);
  }

  /**
   * Register a safety rule for a command type
   */
  registerSafetyRule(commandType: CommandType, rule: SafetyRule): void {
    if (!this.safetyRules.has(commandType)) {
      this.safetyRules.set(commandType, []);
    }
    this.safetyRules.get(commandType)!.push(rule);
  }

  /**
   * Validate a command
   */
  validateCommand(commandData: any): ValidationResult {
    const errors: Array<{ path: string; message: string }> = [];
    const warnings: string[] = [];

    try {
      // Basic schema validation
      const command = CommandSchema.parse(commandData);

      // Validate specific parameters
      const paramSchema = COMMAND_PARAMETER_SCHEMAS[command.commandType as keyof typeof COMMAND_PARAMETER_SCHEMAS];
      if (paramSchema) {
        try {
          paramSchema.parse(command.parameters);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(...error.errors.map(e => ({
              path: `parameters.${e.path.join('.')}`,
              message: e.message
            })));
          }
        }
      }

      // Custom validation
      const customValidator = this.customValidators.get(command.commandType);
      if (customValidator) {
        const result = customValidator(command);
        if (!result.valid && result.errors) {
          errors.push(...result.errors);
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      }

      // Safety rules
      const rules = this.safetyRules.get(command.commandType) || [];
      for (const rule of rules) {
        const result = rule(command);
        if (typeof result === 'boolean' && !result) {
          errors.push({
            path: 'safety',
            message: `Safety rule violation for ${command.commandType}`
          });
        } else if (typeof result === 'object' && !result.valid) {
          errors.push({
            path: 'safety',
            message: result.message || `Safety rule violation for ${command.commandType}`
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined
      };

    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        };
      }
      
      return {
        valid: false,
        errors: [{
          path: 'general',
          message: error instanceof Error ? error.message : 'Validation failed'
        }]
      };
    }
  }

  /**
   * Validate multiple commands
   */
  validateBatch(commands: any[]): Array<ValidationResult & { index: number }> {
    return commands.map((cmd, index) => ({
      index,
      ...this.validateCommand(cmd)
    }));
  }

  /**
   * Get validation schema for a command type
   */
  getSchema(commandType: CommandType): z.ZodSchema | undefined {
    return COMMAND_PARAMETER_SCHEMAS[commandType as keyof typeof COMMAND_PARAMETER_SCHEMAS];
  }
}

/**
 * Default safety rules
 */
export const defaultSafetyRules = {
  emergencyStop: (command: z.infer<typeof CommandSchema>): boolean => {
    // Emergency stop should always be allowed
    return true;
  },

  movementSpeed: (command: z.infer<typeof CommandSchema>): SafetyRule => {
    if (command.commandType === CommandType.MOVE_FORWARD || 
        command.commandType === CommandType.MOVE_BACKWARD) {
      const speed = command.parameters.speed || 0;
      if (speed > 5.0) {
        return { 
          valid: false, 
          message: `Speed ${speed} m/s exceeds safe limit of 5.0 m/s` 
        };
      }
    }
    return { valid: true };
  },

  powerLevel: (command: z.infer<typeof CommandSchema>): SafetyRule => {
    if (command.commandType === CommandType.SET_POWER) {
      const power = command.parameters.powerLevel || 0;
      if (power > 80.0) {
        return { 
          valid: false, 
          message: `Power level ${power}% exceeds safe limit of 80%` 
        };
      }
    }
    return { valid: true };
  },

  firmwareUpdate: (command: z.infer<typeof CommandSchema>): SafetyRule => {
    if (command.commandType === CommandType.FIRMWARE_UPDATE) {
      // Check if system is in safe state for update
      // This would typically check system status
      return { 
        valid: true, 
        message: "Ensure rover is stationary before update" 
      };
    }
    return { valid: true };
  }
};

/**
 * Create a pre-configured validator with default safety rules
 */
export function createDefaultValidator(): CommandValidator {
  const validator = new CommandValidator();
  
  // Register default safety rules
  validator.registerSafetyRule(CommandType.EMERGENCY_STOP, defaultSafetyRules.emergencyStop);
  validator.registerSafetyRule(CommandType.MOVE_FORWARD, defaultSafetyRules.movementSpeed);
  validator.registerSafetyRule(CommandType.MOVE_BACKWARD, defaultSafetyRules.movementSpeed);
  validator.registerSafetyRule(CommandType.SET_POWER, defaultSafetyRules.powerLevel);
  validator.registerSafetyRule(CommandType.FIRMWARE_UPDATE, defaultSafetyRules.firmwareUpdate);
  
  return validator;
}