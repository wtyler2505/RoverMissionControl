/**
 * Command Template Service
 * Handles all template-related operations for the frontend
 */

import axios from 'axios';
import { 
  CommandType, 
  CommandPriority, 
  CommandCreateRequest 
} from '../../../shared/types/command-queue.types';

// API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const TEMPLATE_API = `${API_BASE_URL}/api/templates`;

/**
 * Parameter types supported by templates
 */
export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
  DATE = 'date',
  ARRAY = 'array',
  OBJECT = 'object'
}

/**
 * UI component types for parameter inputs
 */
export enum UIComponent {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
  SLIDER = 'slider',
  DATE_PICKER = 'date-picker',
  TIME_PICKER = 'time-picker',
  CHECKBOX = 'checkbox',
  RADIO = 'radio',
  TEXTAREA = 'textarea',
  COLOR_PICKER = 'color-picker',
  FILE_PICKER = 'file-picker'
}

/**
 * Template parameter definition
 */
export interface TemplateParameter {
  name: string;
  displayName?: string;
  description?: string;
  parameterType: ParameterType;
  defaultValue?: any;
  required: boolean;
  minValue?: number;
  maxValue?: number;
  enumValues?: any[];
  pattern?: string;
  uiComponent?: UIComponent;
  uiConfig?: Record<string, any>;
  placeholder?: string;
  helpText?: string;
  displayOrder?: number;
}

/**
 * Command template interface
 */
export interface CommandTemplate {
  id: string;
  name: string;
  description?: string;
  commandType: CommandType;
  parameters: Record<string, any>;
  parameterSchema: Record<string, any>;
  validationRules?: Record<string, any>;
  category: string;
  tags: string[];
  icon?: string;
  createdBy: string;
  organizationId?: string;
  isPublic: boolean;
  isSystem: boolean;
  allowedRoles: string[];
  version: number;
  parentTemplateId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  lastUsedAt?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  parameterDefinitions?: TemplateParameter[];
}

/**
 * Template category
 */
export interface TemplateCategory {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentCategoryId?: string;
  displayOrder: number;
  allowedRoles: string[];
}

/**
 * Template list response with pagination
 */
export interface TemplateListResponse {
  templates: CommandTemplate[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/**
 * Template execution request
 */
export interface TemplateExecuteRequest {
  parameterValues: Record<string, any>;
  priority?: CommandPriority;
  timeoutMs?: number;
  maxRetries?: number;
  tags?: string[];
}

/**
 * Template execution response
 */
export interface TemplateExecuteResponse {
  commandId: string;
  executionId: string;
  status: string;
  command: CommandCreateRequest;
}

/**
 * Template share request
 */
export interface TemplateShareRequest {
  userId?: string;
  organizationId?: string;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
  expiresAt?: string;
}

/**
 * Template export data
 */
export interface TemplateExportData {
  template: CommandTemplate;
  parameterDefinitions: TemplateParameter[];
  exportVersion: string;
  exportedAt: string;
  exportedBy: string;
}

/**
 * Template filter options
 */
export interface TemplateFilters {
  category?: string;
  commandType?: CommandType;
  search?: string;
  includeShared?: boolean;
  includeSystem?: boolean;
}

/**
 * Template sort options
 */
export interface TemplateSortOptions {
  sortBy: 'name' | 'created_at' | 'usage_count' | 'last_used_at';
  sortOrder: 'asc' | 'desc';
}

/**
 * Template Service Class
 */
export class TemplateService {
  private authToken?: string;
  
  constructor(authToken?: string) {
    this.authToken = authToken;
  }
  
  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }
  
  /**
   * Get request headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }
  
  /**
   * List templates with filters and pagination
   */
  async listTemplates(
    filters: TemplateFilters = {},
    page: number = 1,
    pageSize: number = 20,
    sort: TemplateSortOptions = { sortBy: 'name', sortOrder: 'asc' }
  ): Promise<TemplateListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      sort_by: sort.sortBy,
      sort_order: sort.sortOrder,
      include_shared: (filters.includeShared ?? true).toString(),
      include_system: (filters.includeSystem ?? true).toString()
    });
    
    if (filters.category) params.append('category', filters.category);
    if (filters.commandType) params.append('command_type', filters.commandType);
    if (filters.search) params.append('search', filters.search);
    
    const response = await axios.get<TemplateListResponse>(
      `${TEMPLATE_API}?${params}`,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Get template categories
   */
  async getCategories(): Promise<TemplateCategory[]> {
    const response = await axios.get<TemplateCategory[]>(
      `${TEMPLATE_API}/categories`,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Get a specific template
   */
  async getTemplate(templateId: string): Promise<CommandTemplate> {
    const response = await axios.get<CommandTemplate>(
      `${TEMPLATE_API}/${templateId}`,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Create a new template
   */
  async createTemplate(template: Partial<CommandTemplate>): Promise<CommandTemplate> {
    const response = await axios.post<CommandTemplate>(
      TEMPLATE_API,
      template,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string, 
    updates: Partial<CommandTemplate>
  ): Promise<CommandTemplate> {
    const response = await axios.put<CommandTemplate>(
      `${TEMPLATE_API}/${templateId}`,
      updates,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await axios.delete(
      `${TEMPLATE_API}/${templateId}`,
      { headers: this.getHeaders() }
    );
  }
  
  /**
   * Execute a template
   */
  async executeTemplate(
    templateId: string,
    request: TemplateExecuteRequest
  ): Promise<TemplateExecuteResponse> {
    const response = await axios.post<TemplateExecuteResponse>(
      `${TEMPLATE_API}/${templateId}/execute`,
      request,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Duplicate a template
   */
  async duplicateTemplate(
    templateId: string,
    newName: string
  ): Promise<CommandTemplate> {
    const response = await axios.post<CommandTemplate>(
      `${TEMPLATE_API}/${templateId}/duplicate`,
      { new_name: newName },
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Share a template
   */
  async shareTemplate(
    templateId: string,
    shareRequest: TemplateShareRequest
  ): Promise<{ message: string; shareId: string }> {
    const response = await axios.post<{ message: string; share_id: string }>(
      `${TEMPLATE_API}/${templateId}/share`,
      shareRequest,
      { headers: this.getHeaders() }
    );
    
    return {
      message: response.data.message,
      shareId: response.data.share_id
    };
  }
  
  /**
   * Export a template
   */
  async exportTemplate(
    templateId: string,
    includeParameters: boolean = true
  ): Promise<TemplateExportData> {
    const params = new URLSearchParams({
      include_parameters: includeParameters.toString()
    });
    
    const response = await axios.get<TemplateExportData>(
      `${TEMPLATE_API}/${templateId}/export?${params}`,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Import a template
   */
  async importTemplate(exportData: TemplateExportData): Promise<CommandTemplate> {
    const response = await axios.post<CommandTemplate>(
      `${TEMPLATE_API}/import`,
      exportData,
      { headers: this.getHeaders() }
    );
    
    return response.data;
  }
  
  /**
   * Validate template parameters
   */
  validateParameters(
    template: CommandTemplate,
    parameterValues: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check required parameters
    if (template.parameterDefinitions) {
      for (const paramDef of template.parameterDefinitions) {
        if (paramDef.required && !(paramDef.name in parameterValues)) {
          errors.push(`Required parameter '${paramDef.displayName || paramDef.name}' is missing`);
        }
        
        const value = parameterValues[paramDef.name];
        
        if (value !== undefined) {
          // Type validation
          switch (paramDef.parameterType) {
            case ParameterType.NUMBER:
              if (typeof value !== 'number') {
                errors.push(`Parameter '${paramDef.displayName || paramDef.name}' must be a number`);
              } else {
                if (paramDef.minValue !== undefined && value < paramDef.minValue) {
                  errors.push(`Parameter '${paramDef.displayName || paramDef.name}' must be >= ${paramDef.minValue}`);
                }
                if (paramDef.maxValue !== undefined && value > paramDef.maxValue) {
                  errors.push(`Parameter '${paramDef.displayName || paramDef.name}' must be <= ${paramDef.maxValue}`);
                }
              }
              break;
              
            case ParameterType.STRING:
              if (typeof value !== 'string') {
                errors.push(`Parameter '${paramDef.displayName || paramDef.name}' must be a string`);
              } else if (paramDef.pattern) {
                const regex = new RegExp(paramDef.pattern);
                if (!regex.test(value)) {
                  errors.push(`Parameter '${paramDef.displayName || paramDef.name}' does not match required pattern`);
                }
              }
              break;
              
            case ParameterType.BOOLEAN:
              if (typeof value !== 'boolean') {
                errors.push(`Parameter '${paramDef.displayName || paramDef.name}' must be a boolean`);
              }
              break;
              
            case ParameterType.ENUM:
              if (paramDef.enumValues && !paramDef.enumValues.includes(value)) {
                errors.push(`Parameter '${paramDef.displayName || paramDef.name}' must be one of: ${paramDef.enumValues.join(', ')}`);
              }
              break;
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Build command from template
   */
  buildCommand(
    template: CommandTemplate,
    parameterValues: Record<string, any>,
    options: {
      priority?: CommandPriority;
      timeoutMs?: number;
      maxRetries?: number;
      metadata?: Record<string, any>;
    } = {}
  ): CommandCreateRequest {
    // Merge template parameters with provided values
    const finalParameters = {
      ...template.parameters,
      ...parameterValues
    };
    
    return {
      commandType: template.commandType,
      parameters: finalParameters,
      priority: options.priority || CommandPriority.NORMAL,
      timeoutMs: options.timeoutMs || 30000,
      maxRetries: options.maxRetries || 0,
      metadata: {
        source: `template:${template.id}`,
        templateName: template.name,
        tags: template.tags,
        ...options.metadata
      }
    };
  }
}

// Create singleton instance
export const templateService = new TemplateService();

// Export default
export default templateService;