/**
 * Command Parser and Validator for Mission Control
 * Handles parsing, validation, and fuzzy matching of commands
 */

import { Command, CommandSuggestion, CommandValidationResult, CommandParameter } from './types';
import { ALL_COMMANDS, COMMAND_CATEGORIES } from './commandRegistry';

/**
 * Parse command input and extract command name and parameters
 */
export function parseCommand(input: string): {
  commandName: string;
  parameters: Record<string, string | number | boolean>;
  rawParameters: string[];
} {
  const trimmed = input.trim().toLowerCase();
  const tokens = tokenizeCommand(trimmed);
  
  if (tokens.length === 0) {
    return { commandName: '', parameters: {}, rawParameters: [] };
  }
  
  // Find the longest matching command name
  let bestMatch = '';
  let matchLength = 0;
  
  for (const command of ALL_COMMANDS) {
    const commandTokens = command.name.toLowerCase().split(' ');
    if (commandTokens.length <= tokens.length && commandTokens.length > matchLength) {
      const inputStart = tokens.slice(0, commandTokens.length).join(' ');
      if (inputStart === commandTokens.join(' ')) {
        bestMatch = command.name;
        matchLength = commandTokens.length;
      }
    }
    
    // Check aliases
    for (const alias of command.aliases || []) {
      const aliasTokens = alias.toLowerCase().split(' ');
      if (aliasTokens.length <= tokens.length && aliasTokens.length > matchLength) {
        const inputStart = tokens.slice(0, aliasTokens.length).join(' ');
        if (inputStart === aliasTokens.join(' ')) {
          bestMatch = command.name;
          matchLength = aliasTokens.length;
        }
      }
    }
  }
  
  const parameterTokens = tokens.slice(matchLength);
  const parameters = parseParameters(parameterTokens);
  
  return {
    commandName: bestMatch,
    parameters,
    rawParameters: parameterTokens
  };
}

/**
 * Tokenize command input handling quoted strings
 */
function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      quoteChar = '';
    } else if (!inQuotes && char === ' ') {
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    tokens.push(current.trim());
  }
  
  return tokens;
}

/**
 * Parse parameter tokens into typed values
 */
function parseParameters(tokens: string[]): Record<string, string | number | boolean> {
  const parameters: Record<string, string | number | boolean> = {};
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // Try to parse as number
    const numValue = parseFloat(token);
    if (!isNaN(numValue) && isFinite(numValue)) {
      parameters[`param${i}`] = numValue;
      continue;
    }
    
    // Try to parse as boolean
    if (token === 'true' || token === 'yes' || token === 'on') {
      parameters[`param${i}`] = true;
      continue;
    }
    if (token === 'false' || token === 'no' || token === 'off') {
      parameters[`param${i}`] = false;
      continue;
    }
    
    // Default to string
    parameters[`param${i}`] = token;
  }
  
  return parameters;
}

/**
 * Find command suggestions using fuzzy matching
 */
export function findCommandSuggestions(
  input: string,
  maxSuggestions: number = 10
): CommandSuggestion[] {
  if (!input.trim()) {
    return [];
  }
  
  const query = input.toLowerCase().trim();
  const suggestions: CommandSuggestion[] = [];
  
  for (const command of ALL_COMMANDS) {
    // Exact match
    if (command.name.toLowerCase() === query) {
      suggestions.push({
        command,
        score: 100,
        matchType: 'exact',
        highlightRanges: [{ start: 0, end: command.name.length }]
      });
      continue;
    }
    
    // Prefix match
    if (command.name.toLowerCase().startsWith(query)) {
      suggestions.push({
        command,
        score: 90,
        matchType: 'prefix',
        highlightRanges: [{ start: 0, end: query.length }]
      });
      continue;
    }
    
    // Alias matches
    for (const alias of command.aliases || []) {
      if (alias.toLowerCase() === query) {
        suggestions.push({
          command,
          score: 95,
          matchType: 'alias',
          highlightRanges: [{ start: 0, end: alias.length }]
        });
        continue;
      }
      if (alias.toLowerCase().startsWith(query)) {
        suggestions.push({
          command,
          score: 85,
          matchType: 'alias',
          highlightRanges: [{ start: 0, end: query.length }]
        });
        continue;
      }
    }
    
    // Fuzzy match
    const fuzzyScore = calculateFuzzyScore(query, command.name.toLowerCase());
    if (fuzzyScore > 0.5) {
      suggestions.push({
        command,
        score: Math.round(fuzzyScore * 80),
        matchType: 'fuzzy',
        highlightRanges: findFuzzyHighlights(query, command.name.toLowerCase())
      });
    }
    
    // Category match
    const categoryName = COMMAND_CATEGORIES[command.category].name.toLowerCase();
    if (categoryName.includes(query) || query.includes(categoryName)) {
      suggestions.push({
        command,
        score: 60,
        matchType: 'category'
      });
    }
  }
  
  // Sort by score and remove duplicates
  const uniqueSuggestions = suggestions
    .sort((a, b) => b.score - a.score)
    .filter((suggestion, index, array) => 
      index === array.findIndex(s => s.command.id === suggestion.command.id)
    )
    .slice(0, maxSuggestions);
  
  return uniqueSuggestions;
}

/**
 * Calculate fuzzy matching score between two strings
 */
function calculateFuzzyScore(query: string, target: string): number {
  if (query.length === 0) return 0;
  if (target.length === 0) return 0;
  
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= query.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= target.length; j++) {
      if (i === 0) {
        matrix[i][j] = j;
      } else if (j === 0) {
        matrix[i][j] = i;
      } else {
        matrix[i][j] = 0;
      }
    }
  }
  
  // Fill matrix using Levenshtein distance algorithm
  for (let i = 1; i <= query.length; i++) {
    for (let j = 1; j <= target.length; j++) {
      const cost = query[i - 1] === target[j - 1] ? 0 : 1;
      
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[query.length][target.length];
  const maxLength = Math.max(query.length, target.length);
  return 1 - (distance / maxLength);
}

/**
 * Find highlight ranges for fuzzy matches
 */
function findFuzzyHighlights(query: string, target: string): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let queryIndex = 0;
  
  for (let i = 0; i < target.length && queryIndex < query.length; i++) {
    if (target[i] === query[queryIndex]) {
      const start = i;
      let end = i + 1;
      
      // Find consecutive matches
      while (end < target.length && queryIndex + 1 < query.length && 
             target[end] === query[queryIndex + 1]) {
        end++;
        queryIndex++;
      }
      
      ranges.push({ start, end });
      queryIndex++;
    }
  }
  
  return ranges;
}

/**
 * Validate command and parameters
 */
export function validateCommand(
  command: Command,
  parameters: Record<string, any>
): CommandValidationResult {
  const result: CommandValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
    parameterValidation: {}
  };
  
  // Check required parameters
  const requiredParams = command.parameters?.filter(p => p.required) || [];
  const providedParamCount = Object.keys(parameters).length;
  
  if (requiredParams.length > providedParamCount) {
    result.isValid = false;
    result.errors.push(
      `Missing required parameters. Expected ${requiredParams.length}, got ${providedParamCount}`
    );
    
    for (const param of requiredParams) {
      if (!parameters[param.name] && !parameters[`param${requiredParams.indexOf(param)}`]) {
        result.parameterValidation[param.name] = {
          isValid: false,
          error: `Required parameter '${param.name}' is missing`,
          suggestion: `Add ${param.name} (${param.description})`
        };
      }
    }
  }
  
  // Validate parameter types and ranges
  command.parameters?.forEach((paramDef, index) => {
    const paramValue = parameters[paramDef.name] || parameters[`param${index}`];
    
    if (paramValue !== undefined) {
      const validation = validateParameter(paramDef, paramValue);
      result.parameterValidation[paramDef.name] = validation;
      
      if (!validation.isValid) {
        result.isValid = false;
        if (validation.error) {
          result.errors.push(`Parameter '${paramDef.name}': ${validation.error}`);
        }
      }
      
      if (validation.suggestion) {
        result.suggestions.push(validation.suggestion);
      }
    }
  });
  
  // Command-specific warnings
  if (command.dangerLevel === 'high' || command.dangerLevel === 'critical') {
    result.warnings.push(
      `This is a ${command.dangerLevel} danger level command. Please review before execution.`
    );
  }
  
  if (command.executionTime === 'long') {
    result.warnings.push('This command may take a long time to execute.');
  }
  
  return result;
}

/**
 * Validate individual parameter
 */
function validateParameter(
  paramDef: CommandParameter,
  value: any
): { isValid: boolean; error?: string; suggestion?: string } {
  // Type validation
  switch (paramDef.type) {
    case 'number':
    case 'range':
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return {
          isValid: false,
          error: `Expected number, got ${typeof value}`,
          suggestion: `Enter a numeric value for ${paramDef.name}`
        };
      }
      
      if (paramDef.min !== undefined && numValue < paramDef.min) {
        return {
          isValid: false,
          error: `Value ${numValue} is below minimum ${paramDef.min}`,
          suggestion: `Use a value >= ${paramDef.min}`
        };
      }
      
      if (paramDef.max !== undefined && numValue > paramDef.max) {
        return {
          isValid: false,
          error: `Value ${numValue} is above maximum ${paramDef.max}`,
          suggestion: `Use a value <= ${paramDef.max}`
        };
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return {
          isValid: false,
          error: `Expected boolean, got ${typeof value}`,
          suggestion: `Use true/false, yes/no, or on/off for ${paramDef.name}`
        };
      }
      break;
      
    case 'select':
      const stringValue = String(value);
      const validOptions = paramDef.options?.map(opt => String(opt.value)) || [];
      if (!validOptions.includes(stringValue)) {
        return {
          isValid: false,
          error: `Invalid option '${stringValue}'`,
          suggestion: `Valid options: ${validOptions.join(', ')}`
        };
      }
      break;
      
    case 'string':
      if (paramDef.validation && !paramDef.validation.test(String(value))) {
        return {
          isValid: false,
          error: 'Value does not match required format',
          suggestion: `Check the format for ${paramDef.name}`
        };
      }
      break;
  }
  
  return { isValid: true };
}

/**
 * Format command for display with syntax highlighting
 */
export function formatCommandSyntax(command: Command): string {
  return command.syntax
    .replace(/<([^>]+)>/g, '<span class="required-param">$1</span>')
    .replace(/\[([^\]]+)\]/g, '<span class="optional-param">[$1]</span>');
}

/**
 * Get command help text
 */
export function getCommandHelp(command: Command): string {
  let help = `${command.name} - ${command.description}\n\n`;
  help += `Syntax: ${command.syntax}\n`;
  help += `Category: ${COMMAND_CATEGORIES[command.category].name}\n`;
  help += `Danger Level: ${command.dangerLevel || 'none'}\n`;
  help += `Execution Time: ${command.executionTime || 'unknown'}\n`;
  
  if (command.parameters && command.parameters.length > 0) {
    help += '\nParameters:\n';
    for (const param of command.parameters) {
      help += `  ${param.name} (${param.type})${param.required ? ' *' : ''}: ${param.description}\n`;
      if (param.min !== undefined || param.max !== undefined) {
        help += `    Range: ${param.min || 'none'} - ${param.max || 'unlimited'}\n`;
      }
      if (param.options) {
        help += `    Options: ${param.options.map(opt => opt.value).join(', ')}\n`;
      }
    }
  }
  
  if (command.aliases && command.aliases.length > 0) {
    help += `\nAliases: ${command.aliases.join(', ')}\n`;
  }
  
  if (command.examples && command.examples.length > 0) {
    help += '\nExamples:\n';
    for (const example of command.examples) {
      help += `  ${example.command} - ${example.description}\n`;
    }
  }
  
  return help;
}