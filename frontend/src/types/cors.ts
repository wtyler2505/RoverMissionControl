/**
 * TypeScript interfaces for CORS policy management
 */

export enum CORSPolicyType {
  GLOBAL = 'global',
  ENDPOINT = 'endpoint',
  API_KEY = 'api_key'
}

export interface CORSPolicy {
  id: string;
  name: string;
  description?: string;
  policy_type: CORSPolicyType;
  endpoint_pattern?: string;
  api_key_id?: string;
  priority: number;
  
  // Configuration
  allowed_origins?: string[];
  allow_all_origins: boolean;
  allowed_methods?: string[];
  allow_all_methods: boolean;
  allowed_headers?: string[];
  allow_all_headers: boolean;
  expose_headers?: string[];
  allow_credentials: boolean;
  max_age: number;
  validate_origin_regex: boolean;
  case_sensitive_origins: boolean;
  
  // Status
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  
  // Testing
  test_results?: CORSTestResult;
  last_tested_at?: string;
}

export interface CORSPolicyCreate {
  name: string;
  description?: string;
  policy_type: CORSPolicyType;
  endpoint_pattern?: string;
  api_key_id?: string;
  priority: number;
  
  // Configuration
  allowed_origins?: string[];
  allow_all_origins: boolean;
  allowed_methods?: string[];
  allow_all_methods: boolean;
  allowed_headers?: string[];
  allow_all_headers: boolean;
  expose_headers?: string[];
  allow_credentials: boolean;
  max_age: number;
  validate_origin_regex: boolean;
  case_sensitive_origins: boolean;
}

export interface CORSPolicyUpdate {
  name?: string;
  description?: string;
  endpoint_pattern?: string;
  priority?: number;
  is_active?: boolean;
  
  // Configuration updates
  allowed_origins?: string[];
  allow_all_origins?: boolean;
  allowed_methods?: string[];
  allow_all_methods?: boolean;
  allowed_headers?: string[];
  allow_all_headers?: boolean;
  expose_headers?: string[];
  allow_credentials?: boolean;
  max_age?: number;
  validate_origin_regex?: boolean;
  case_sensitive_origins?: boolean;
}

export interface CORSTestRequest {
  test_origin: string;
  test_method: string;
  test_headers?: string[];
}

export interface CORSTestResult {
  allowed: boolean;
  reason?: string;
  policy_applied?: string;
  headers_allowed?: string[];
  headers_denied?: string[];
  preflight_required: boolean;
  response_headers?: Record<string, string>;
}

export interface CORSViolation {
  id: string;
  timestamp: string;
  origin: string;
  method: string;
  path: string;
  violation_type: string;
  violation_details: Record<string, any>;
  was_blocked: boolean;
  override_reason?: string;
  ip_address?: string;
  api_key_id?: string;
}

export interface CORSPreset {
  id: string;
  name: string;
  description?: string;
  category?: string;
  configuration: Partial<CORSPolicyCreate>;
  usage_count: number;
  is_system: boolean;
}

export interface CreatePolicyFromPresetRequest {
  policy_name: string;
  customizations?: Partial<CORSPolicyCreate>;
}

// Filter types
export interface CORSPolicyFilters {
  policy_type?: CORSPolicyType;
  is_active?: boolean;
  search?: string;
}

export interface CORSViolationFilters {
  policy_id?: string;
  start_date?: string;
  end_date?: string;
  was_blocked?: boolean;
  limit?: number;
}

// Stats types
export interface CORSStats {
  total_policies: number;
  active_policies: number;
  global_policies: number;
  endpoint_policies: number;
  api_key_policies: number;
  violations_today: number;
  violations_blocked: number;
}