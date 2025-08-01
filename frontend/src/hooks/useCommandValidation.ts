/**
 * React Hook for Command Validation
 * Provides real-time validation with UI feedback
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { 
  CommandValidator, 
  createDefaultValidator,
  ValidationResult,
  CommandSchema
} from '../services/command/CommandValidator';
import { Command, CommandType } from '../services/command/types';
import { z } from 'zod';

export interface ValidationState {
  isValidating: boolean;
  isValid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
  warnings: string[];
  touchedFields: Set<string>;
}

export interface UseCommandValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  debounceMs?: number;
  customValidator?: CommandValidator;
}

export interface UseCommandValidationReturn {
  // Validation state
  validationState: ValidationState;
  
  // Validation methods
  validateCommand: (command: Partial<Command>) => Promise<ValidationResult>;
  validateField: (fieldPath: string, value: any, commandType?: CommandType) => Promise<ValidationResult>;
  clearValidation: () => void;
  
  // Field tracking
  markFieldTouched: (fieldPath: string) => void;
  markAllFieldsTouched: () => void;
  isFieldTouched: (fieldPath: string) => boolean;
  
  // Error helpers
  getFieldError: (fieldPath: string) => string | undefined;
  hasFieldError: (fieldPath: string) => boolean;
  getFieldWarning: (fieldPath: string) => string | undefined;
  
  // Schema helpers
  getFieldSchema: (commandType: CommandType, fieldPath: string) => z.ZodSchema | undefined;
  getParameterSchema: (commandType: CommandType) => z.ZodSchema | undefined;
}

export function useCommandValidation(
  options: UseCommandValidationOptions = {}
): UseCommandValidationReturn {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    customValidator
  } = options;

  // Create or use provided validator
  const validator = useMemo(() => {
    return customValidator || createDefaultValidator();
  }, [customValidator]);

  // Validation state
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    isValid: true,
    errors: [],
    warnings: [],
    touchedFields: new Set()
  });

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  /**
   * Validate a complete command
   */
  const validateCommand = useCallback(async (
    command: Partial<Command>
  ): Promise<ValidationResult> => {
    setValidationState(prev => ({ ...prev, isValidating: true }));

    try {
      const result = await new Promise<ValidationResult>((resolve) => {
        if (debounceMs > 0) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            resolve(validator.validateCommand(command));
          }, debounceMs);
        } else {
          resolve(validator.validateCommand(command));
        }
      });

      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        isValid: result.valid,
        errors: result.errors || [],
        warnings: result.warnings || []
      }));

      return result;
    } catch (error) {
      const errorResult: ValidationResult = {
        valid: false,
        errors: [{
          path: 'general',
          message: error instanceof Error ? error.message : 'Validation failed'
        }]
      };

      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        isValid: false,
        errors: errorResult.errors || [],
        warnings: []
      }));

      return errorResult;
    }
  }, [validator, debounceMs]);

  /**
   * Validate a specific field
   */
  const validateField = useCallback(async (
    fieldPath: string,
    value: any,
    commandType?: CommandType
  ): Promise<ValidationResult> => {
    if (!commandType) {
      return { valid: true };
    }

    // Get the parameter schema for the command type
    const schema = validator.getSchema(commandType);
    
    if (!schema) {
      return { valid: true };
    }

    try {
      // Extract the specific field schema if nested
      const pathParts = fieldPath.split('.');
      let fieldSchema: z.ZodSchema = schema;
      
      for (const part of pathParts) {
        if (fieldSchema instanceof z.ZodObject) {
          const shape = fieldSchema.shape as Record<string, z.ZodSchema>;
          fieldSchema = shape[part];
          if (!fieldSchema) break;
        }
      }

      if (fieldSchema) {
        fieldSchema.parse(value);
      }

      // Remove error for this field
      setValidationState(prev => ({
        ...prev,
        errors: prev.errors.filter(e => !e.path.startsWith(fieldPath))
      }));

      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = {
          path: fieldPath,
          message: error.errors[0]?.message || 'Invalid value'
        };

        setValidationState(prev => ({
          ...prev,
          errors: [
            ...prev.errors.filter(e => !e.path.startsWith(fieldPath)),
            fieldError
          ]
        }));

        return {
          valid: false,
          errors: [fieldError]
        };
      }

      return {
        valid: false,
        errors: [{
          path: fieldPath,
          message: 'Validation failed'
        }]
      };
    }
  }, [validator]);

  /**
   * Clear all validation errors
   */
  const clearValidation = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    setValidationState({
      isValidating: false,
      isValid: true,
      errors: [],
      warnings: [],
      touchedFields: new Set()
    });
  }, []);

  /**
   * Mark a field as touched
   */
  const markFieldTouched = useCallback((fieldPath: string) => {
    setValidationState(prev => ({
      ...prev,
      touchedFields: new Set(prev.touchedFields).add(fieldPath)
    }));
  }, []);

  /**
   * Mark all fields as touched
   */
  const markAllFieldsTouched = useCallback(() => {
    // Extract all field paths from current errors
    const allPaths = validationState.errors.map(e => e.path);
    const uniquePaths = new Set(allPaths);
    
    setValidationState(prev => ({
      ...prev,
      touchedFields: new Set([...prev.touchedFields, ...uniquePaths])
    }));
  }, [validationState.errors]);

  /**
   * Check if a field has been touched
   */
  const isFieldTouched = useCallback((fieldPath: string): boolean => {
    return validationState.touchedFields.has(fieldPath);
  }, [validationState.touchedFields]);

  /**
   * Get error for a specific field
   */
  const getFieldError = useCallback((fieldPath: string): string | undefined => {
    const error = validationState.errors.find(e => e.path === fieldPath);
    return error?.message;
  }, [validationState.errors]);

  /**
   * Check if a field has an error
   */
  const hasFieldError = useCallback((fieldPath: string): boolean => {
    return validationState.errors.some(e => e.path === fieldPath);
  }, [validationState.errors]);

  /**
   * Get warning for a specific field
   */
  const getFieldWarning = useCallback((fieldPath: string): string | undefined => {
    // Warnings are not field-specific in current implementation
    // This could be extended to support field-level warnings
    return undefined;
  }, []);

  /**
   * Get schema for a specific field
   */
  const getFieldSchema = useCallback((
    commandType: CommandType,
    fieldPath: string
  ): z.ZodSchema | undefined => {
    const schema = validator.getSchema(commandType);
    if (!schema) return undefined;

    try {
      const pathParts = fieldPath.split('.');
      let fieldSchema: z.ZodSchema = schema;
      
      for (const part of pathParts) {
        if (fieldSchema instanceof z.ZodObject) {
          const shape = fieldSchema.shape as Record<string, z.ZodSchema>;
          fieldSchema = shape[part];
          if (!fieldSchema) return undefined;
        }
      }

      return fieldSchema;
    } catch {
      return undefined;
    }
  }, [validator]);

  /**
   * Get parameter schema for a command type
   */
  const getParameterSchema = useCallback((
    commandType: CommandType
  ): z.ZodSchema | undefined => {
    return validator.getSchema(commandType);
  }, [validator]);

  // Cleanup on unmount
  useCallback(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    validationState,
    validateCommand,
    validateField,
    clearValidation,
    markFieldTouched,
    markAllFieldsTouched,
    isFieldTouched,
    getFieldError,
    hasFieldError,
    getFieldWarning,
    getFieldSchema,
    getParameterSchema
  };
}

/**
 * Hook for validating command batches
 */
export function useCommandBatchValidation(
  options: UseCommandValidationOptions = {}
) {
  const { customValidator } = options;
  
  const validator = useMemo(() => {
    return customValidator || createDefaultValidator();
  }, [customValidator]);

  const [batchResults, setBatchResults] = useState<
    Array<ValidationResult & { index: number }>
  >([]);

  const validateBatch = useCallback(async (
    commands: Partial<Command>[]
  ): Promise<Array<ValidationResult & { index: number }>> => {
    const results = validator.validateBatch(commands);
    setBatchResults(results);
    return results;
  }, [validator]);

  const getCommandErrors = useCallback((index: number) => {
    return batchResults.find(r => r.index === index)?.errors || [];
  }, [batchResults]);

  const isCommandValid = useCallback((index: number) => {
    return batchResults.find(r => r.index === index)?.valid ?? true;
  }, [batchResults]);

  const clearBatchValidation = useCallback(() => {
    setBatchResults([]);
  }, []);

  return {
    batchResults,
    validateBatch,
    getCommandErrors,
    isCommandValid,
    clearBatchValidation
  };
}