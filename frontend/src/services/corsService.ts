/**
 * Service for managing CORS policies
 */
import axios from 'axios';
import {
  CORSPolicy,
  CORSPolicyCreate,
  CORSPolicyUpdate,
  CORSTestRequest,
  CORSTestResult,
  CORSViolation,
  CORSPreset,
  CreatePolicyFromPresetRequest,
  CORSPolicyFilters,
  CORSViolationFilters
} from '../types/cors';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class CORSService {
  private baseURL = `${API_BASE_URL}/api/cors`;

  /**
   * Get all CORS policies
   */
  async getPolicies(filters?: CORSPolicyFilters): Promise<CORSPolicy[]> {
    const response = await axios.get(`${this.baseURL}/policies`, {
      params: filters
    });
    return response.data;
  }

  /**
   * Get a specific CORS policy
   */
  async getPolicy(policyId: string): Promise<CORSPolicy> {
    const response = await axios.get(`${this.baseURL}/policies/${policyId}`);
    return response.data;
  }

  /**
   * Create a new CORS policy
   */
  async createPolicy(policy: CORSPolicyCreate): Promise<CORSPolicy> {
    const response = await axios.post(`${this.baseURL}/policies`, policy);
    return response.data;
  }

  /**
   * Update a CORS policy
   */
  async updatePolicy(policyId: string, updates: CORSPolicyUpdate): Promise<CORSPolicy> {
    const response = await axios.put(`${this.baseURL}/policies/${policyId}`, updates);
    return response.data;
  }

  /**
   * Delete a CORS policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    await axios.delete(`${this.baseURL}/policies/${policyId}`);
  }

  /**
   * Test a CORS policy
   */
  async testPolicy(policyId: string, testRequest: CORSTestRequest): Promise<CORSTestResult> {
    const response = await axios.post(`${this.baseURL}/policies/${policyId}/test`, testRequest);
    return response.data;
  }

  /**
   * Get CORS violations
   */
  async getViolations(filters?: CORSViolationFilters): Promise<CORSViolation[]> {
    const response = await axios.get(`${this.baseURL}/violations`, {
      params: filters
    });
    return response.data;
  }

  /**
   * Get CORS presets
   */
  async getPresets(): Promise<CORSPreset[]> {
    const response = await axios.get(`${this.baseURL}/presets`);
    return response.data;
  }

  /**
   * Create policy from preset
   */
  async createPolicyFromPreset(
    presetId: string, 
    request: CreatePolicyFromPresetRequest
  ): Promise<CORSPolicy> {
    const response = await axios.post(
      `${this.baseURL}/presets/${presetId}/create-policy`, 
      request
    );
    return response.data;
  }

  /**
   * Export policies in specified format
   */
  async exportPolicies(format: 'json' | 'csv'): Promise<Blob> {
    const response = await axios.get(`${this.baseURL}/policies/export`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }

  /**
   * Get CORS statistics
   */
  async getStats(): Promise<any> {
    const response = await axios.get(`${this.baseURL}/stats`);
    return response.data;
  }

  /**
   * Validate CORS configuration
   */
  validateConfiguration(config: Partial<CORSPolicyCreate>): string[] {
    const errors: string[] = [];

    // Validate origins
    if (!config.allow_all_origins && (!config.allowed_origins || config.allowed_origins.length === 0)) {
      errors.push('At least one origin must be specified when not allowing all origins');
    }

    // Validate methods
    if (!config.allow_all_methods && (!config.allowed_methods || config.allowed_methods.length === 0)) {
      errors.push('At least one method must be specified when not allowing all methods');
    }

    // Validate headers
    if (!config.allow_all_headers && config.allowed_headers && config.allowed_headers.length === 0) {
      errors.push('Headers array cannot be empty when specified');
    }

    // Validate credentials with wildcard origin
    if (config.allow_credentials && config.allow_all_origins) {
      errors.push('Cannot allow credentials when allowing all origins (security restriction)');
    }

    // Validate max_age
    if (config.max_age !== undefined && (config.max_age < 0 || config.max_age > 86400)) {
      errors.push('Max age must be between 0 and 86400 seconds (24 hours)');
    }

    // Validate endpoint pattern if policy type is endpoint
    if (config.policy_type === 'endpoint' && !config.endpoint_pattern) {
      errors.push('Endpoint pattern is required for endpoint-type policies');
    }

    return errors;
  }

  /**
   * Format origin for display
   */
  formatOrigin(origin: string): string {
    if (origin === '*') return 'All Origins';
    return origin;
  }

  /**
   * Parse origin patterns
   */
  parseOriginPatterns(patterns: string): string[] {
    return patterns
      .split(/[,\n]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }
}

export const corsService = new CORSService();