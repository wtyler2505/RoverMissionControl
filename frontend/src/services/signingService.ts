import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export interface SigningConfiguration {
  id: string;
  name: string;
  description?: string;
  algorithm: string;
  keySize?: number;
  publicKey?: string;
  includeHeaders: string[];
  timestampToleranceSeconds: number;
  requireNonce: boolean;
  requireBodyHash: boolean;
  jwtExpiresInSeconds?: number;
  jwtCustomClaims?: Record<string, any>;
  allowedEndpoints?: string[];
  blockedEndpoints?: string[];
  requireSecureTransport: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SigningAlgorithm {
  id: string;
  name: string;
  type: 'symmetric' | 'asymmetric';
  description: string;
  keyRequirements: string;
}

export interface SignRequestData {
  apiKeyId: string;
  configId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface VerifyRequestData {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface SignatureVerificationLog {
  id: string;
  apiKeyId: string;
  configurationId: string;
  method: string;
  endpoint: string;
  ipAddress: string;
  userAgent: string;
  algorithmUsed: string;
  timestampProvided?: string;
  nonce?: string;
  isValid: boolean;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  verificationTimeMs?: number;
  verifiedAt: string;
}

export interface SampleCode {
  id: string;
  language: string;
  algorithm: string;
  framework?: string;
  title: string;
  description?: string;
  code: string;
  dependencies?: string[];
  version?: string;
  testedWith?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

class SigningService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Configuration Management
  async getConfigurations(activeOnly: boolean = true): Promise<SigningConfiguration[]> {
    const response = await axios.get(`${API_BASE_URL}/security/signing/configurations`, {
      headers: this.getAuthHeaders(),
      params: { active_only: activeOnly }
    });
    return response.data;
  }

  async getConfiguration(configId: string): Promise<SigningConfiguration> {
    const response = await axios.get(`${API_BASE_URL}/security/signing/configurations/${configId}`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async createConfiguration(config: Partial<SigningConfiguration>): Promise<SigningConfiguration> {
    const response = await axios.post(`${API_BASE_URL}/security/signing/configurations`, config, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async updateConfiguration(configId: string, updates: Partial<SigningConfiguration>): Promise<SigningConfiguration> {
    const response = await axios.put(`${API_BASE_URL}/security/signing/configurations/${configId}`, updates, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async deleteConfiguration(configId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/security/signing/configurations/${configId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Signing and Verification
  async signRequest(data: SignRequestData): Promise<{
    headers: Record<string, string>;
    algorithm: string;
    timestamp: string;
    message: string;
  }> {
    const response = await axios.post(`${API_BASE_URL}/security/signing/sign`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async verifySignature(data: VerifyRequestData): Promise<{
    is_valid: boolean;
    error?: string;
    api_key_id?: string;
    api_key_name?: string;
    timestamp: string;
  }> {
    const response = await axios.post(`${API_BASE_URL}/security/signing/verify`, data, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  // Error Troubleshooting
  async getVerificationErrors(
    apiKeyId?: string,
    daysBack: number = 7,
    limit: number = 100
  ): Promise<SignatureVerificationLog[]> {
    const response = await axios.get(`${API_BASE_URL}/security/signing/verification-errors`, {
      headers: this.getAuthHeaders(),
      params: {
        api_key_id: apiKeyId,
        days_back: daysBack,
        limit
      }
    });
    return response.data;
  }

  async getVerificationStats(
    apiKeyId?: string,
    configId?: string,
    daysBack: number = 30
  ): Promise<{
    period_days: number;
    total_verifications: number;
    valid_signatures: number;
    invalid_signatures: number;
    success_rate: number;
    error_breakdown: Record<string, number>;
    average_verification_time_ms: number;
    calculated_at: string;
  }> {
    const response = await axios.get(`${API_BASE_URL}/security/signing/verification-stats`, {
      headers: this.getAuthHeaders(),
      params: {
        api_key_id: apiKeyId,
        config_id: configId,
        days_back: daysBack
      }
    });
    return response.data;
  }

  // Sample Code
  async getSampleCode(
    language: string,
    algorithm: string,
    framework?: string
  ): Promise<SampleCode> {
    const response = await axios.get(
      `${API_BASE_URL}/security/signing/sample-code/${language}/${algorithm}`,
      {
        headers: this.getAuthHeaders(),
        params: framework ? { framework } : {}
      }
    );
    return response.data;
  }

  async createSampleCode(sample: Partial<SampleCode>): Promise<SampleCode> {
    const response = await axios.post(`${API_BASE_URL}/security/signing/sample-code`, sample, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  // Algorithms
  async getSupportedAlgorithms(): Promise<{ algorithms: SigningAlgorithm[] }> {
    const response = await axios.get(`${API_BASE_URL}/security/signing/algorithms`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  // Testing
  async testSignatureGeneration(algorithm: string): Promise<{
    test_data: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: string;
    };
    signature_headers: Record<string, string>;
    canonical_request: string;
    test_secret: string;
    message: string;
  }> {
    const response = await axios.post(`${API_BASE_URL}/security/signing/test-signature`, null, {
      headers: this.getAuthHeaders(),
      params: { algorithm }
    });
    return response.data;
  }

  // Cleanup
  async cleanupNonces(olderThanHours: number = 24): Promise<{
    deleted: number;
    cutoff: string;
    message: string;
  }> {
    const response = await axios.post(`${API_BASE_URL}/security/signing/cleanup-nonces`, null, {
      headers: this.getAuthHeaders(),
      params: { older_than_hours: olderThanHours }
    });
    return response.data;
  }
}

export const signingService = new SigningService();