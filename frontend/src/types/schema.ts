// Schema validation types

export enum SchemaType {
  JSON_SCHEMA = 'json_schema',
  OPENAPI = 'openapi',
  SWAGGER = 'swagger',
  GRAPHQL = 'graphql',
  PROTOBUF = 'protobuf'
}

export enum SchemaStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived'
}

export enum RuleType {
  REQUIRED_FIELD = 'required_field',
  TYPE_CHECK = 'type_check',
  RANGE_CHECK = 'range_check',
  PATTERN_MATCH = 'pattern_match',
  CUSTOM_FUNCTION = 'custom_function',
  BUSINESS_LOGIC = 'business_logic',
  SECURITY_CHECK = 'security_check'
}

export enum RuleSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

export interface SchemaDefinition {
  id: string;
  name: string;
  description?: string;
  type: SchemaType;
  version: string;
  schema: any; // JSON Schema or OpenAPI spec
  namespace?: string;
  tags?: string[];
  status: SchemaStatus;
  isPublic: boolean;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  description?: string;
  ruleType: RuleType;
  severity: RuleSeverity;
  field?: string;
  condition: string;
  errorMessage: string;
  customValidator?: string;
  metadata?: Record<string, any>;
  isActive: boolean;
  businessContext?: string;
  complianceRequirements?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SchemaVersion {
  id: string;
  schemaId: string;
  version: string;
  changes: string;
  breakingChanges: boolean;
  migrationGuide?: string;
  releaseNotes?: string;
  publishedAt?: string;
  deprecatedAt?: string;
  retiredAt?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ValidationLog {
  id: string;
  schemaId?: string;
  endpointId?: string;
  requestId: string;
  validationType: 'request' | 'response';
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  performanceMs: number;
  userId?: string;
  clientIp?: string;
  userAgent?: string;
  timestamp: string;
}

export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
  params?: Record<string, any>;
  schemaPath?: string;
  suggestedFix?: string;
}

export interface ValidationWarning {
  path: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SchemaEndpointMapping {
  id: string;
  schemaId: string;
  endpoint: string;
  method: string;
  requestSchemaId?: string;
  responseSchemaId?: string;
  responseSchemas?: Record<string, string>; // status code -> schema ID
  isActive: boolean;
  version?: string;
  validationOverrides?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaImportResult {
  success: boolean;
  schemaId?: string;
  endpoints?: SchemaEndpointMapping[];
  errors?: string[];
  warnings?: string[];
}

export interface ValidationTestRequest {
  schemaId?: string;
  endpointId?: string;
  data: any;
  validationType: 'request' | 'response';
  statusCode?: number;
}

export interface ValidationTestResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  executionTime: number;
  appliedRules: string[];
}

export interface SchemaMetrics {
  schemaId: string;
  totalValidations: number;
  failedValidations: number;
  averageValidationTime: number;
  lastValidationAt?: string;
  topErrors: Array<{
    path: string;
    count: number;
    message: string;
  }>;
}

export interface SchemaFilter {
  search?: string;
  type?: SchemaType;
  status?: SchemaStatus;
  namespace?: string;
  tags?: string[];
  createdBy?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SchemaListResponse {
  schemas: SchemaDefinition[];
  total: number;
  page: number;
  pageSize: number;
}