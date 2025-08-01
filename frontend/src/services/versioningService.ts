// Service for API versioning and encryption management
import axios, { AxiosResponse } from 'axios';
import {
  APIVersion,
  VersionStrategy,
  VersionMigration,
  EncryptionConfig,
  EncryptionKey,
  VersionUsageMetrics,
  ComplianceStatus,
  VersionFormData,
  StrategyFormData,
  EncryptionFormData,
  KeyFormData,
  VersionFilter,
  MigrationFilter,
  EncryptionFilter,
  KeyFilter,
  APIResponse,
  PaginatedResponse,
  DashboardStats,
  UsageChart
} from '../types/versioning';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Configure axios with authentication
const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Helper function to get current timestamp
const getCurrentTimestamp = async (): Promise<string> => {
  try {
    // In a real implementation, this would call the time-server MCP tool
    // For now, return current ISO string
    return new Date().toISOString();
  } catch (error) {
    console.error('Error getting current time:', error);
    return new Date().toISOString();
  }
};

export class VersioningService {
  // Version Management
  static async getVersions(filter?: VersionFilter): Promise<PaginatedResponse<APIVersion>> {
    const params = new URLSearchParams();
    if (filter?.status?.length) {
      params.append('status', filter.status.join(','));
    }
    if (filter?.searchTerm) {
      params.append('search', filter.searchTerm);
    }
    if (filter?.dateRange) {
      params.append('start_date', filter.dateRange.start);
      params.append('end_date', filter.dateRange.end);
    }
    if (filter?.hasBreakingChanges !== undefined) {
      params.append('breaking_changes', filter.hasBreakingChanges.toString());
    }

    const response: AxiosResponse<PaginatedResponse<APIVersion>> = await apiClient.get(
      `/versioning/versions?${params.toString()}`
    );
    return response.data;
  }

  static async getVersion(id: string): Promise<APIResponse<APIVersion>> {
    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.get(
      `/versioning/versions/${id}`
    );
    return response.data;
  }

  static async createVersion(data: VersionFormData): Promise<APIResponse<APIVersion>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.post(
      '/versioning/versions',
      payload
    );
    return response.data;
  }

  static async updateVersion(id: string, data: Partial<VersionFormData>): Promise<APIResponse<APIVersion>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.put(
      `/versioning/versions/${id}`,
      payload
    );
    return response.data;
  }

  static async deleteVersion(id: string): Promise<APIResponse<void>> {
    const response: AxiosResponse<APIResponse<void>> = await apiClient.delete(
      `/versioning/versions/${id}`
    );
    return response.data;
  }

  static async setDefaultVersion(id: string): Promise<APIResponse<APIVersion>> {
    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.put(
      `/versioning/versions/${id}/set-default`
    );
    return response.data;
  }

  static async deprecateVersion(id: string, deprecationDate?: string): Promise<APIResponse<APIVersion>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      deprecationDate: deprecationDate || timestamp,
    };

    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.put(
      `/versioning/versions/${id}/deprecate`,
      payload
    );
    return response.data;
  }

  static async retireVersion(id: string, eolDate?: string): Promise<APIResponse<APIVersion>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      eolDate: eolDate || timestamp,
    };

    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.put(
      `/versioning/versions/${id}/retire`,
      payload
    );
    return response.data;
  }

  // Version Strategy Management
  static async getStrategies(): Promise<APIResponse<VersionStrategy[]>> {
    const response: AxiosResponse<APIResponse<VersionStrategy[]>> = await apiClient.get(
      '/versioning/strategies'
    );
    return response.data;
  }

  static async getStrategy(id: string): Promise<APIResponse<VersionStrategy>> {
    const response: AxiosResponse<APIResponse<VersionStrategy>> = await apiClient.get(
      `/versioning/strategies/${id}`
    );
    return response.data;
  }

  static async createStrategy(data: StrategyFormData): Promise<APIResponse<VersionStrategy>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<VersionStrategy>> = await apiClient.post(
      '/versioning/strategies',
      payload
    );
    return response.data;
  }

  static async updateStrategy(id: string, data: Partial<StrategyFormData>): Promise<APIResponse<VersionStrategy>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<VersionStrategy>> = await apiClient.put(
      `/versioning/strategies/${id}`,
      payload
    );
    return response.data;
  }

  static async deleteStrategy(id: string): Promise<APIResponse<void>> {
    const response: AxiosResponse<APIResponse<void>> = await apiClient.delete(
      `/versioning/strategies/${id}`
    );
    return response.data;
  }

  static async activateStrategy(id: string): Promise<APIResponse<VersionStrategy>> {
    const response: AxiosResponse<APIResponse<VersionStrategy>> = await apiClient.put(
      `/versioning/strategies/${id}/activate`
    );
    return response.data;
  }

  static async testStrategy(id: string, testData: any): Promise<APIResponse<any>> {
    const response: AxiosResponse<APIResponse<any>> = await apiClient.post(
      `/versioning/strategies/${id}/test`,
      testData
    );
    return response.data;
  }

  // Migration Management
  static async getMigrations(filter?: MigrationFilter): Promise<PaginatedResponse<VersionMigration>> {
    const params = new URLSearchParams();
    if (filter?.status?.length) {
      params.append('status', filter.status.join(','));
    }
    if (filter?.fromVersion) {
      params.append('from_version', filter.fromVersion);
    }
    if (filter?.toVersion) {
      params.append('to_version', filter.toVersion);
    }
    if (filter?.searchTerm) {
      params.append('search', filter.searchTerm);
    }

    const response: AxiosResponse<PaginatedResponse<VersionMigration>> = await apiClient.get(
      `/versioning/migrations?${params.toString()}`
    );
    return response.data;
  }

  static async getMigration(id: string): Promise<APIResponse<VersionMigration>> {
    const response: AxiosResponse<APIResponse<VersionMigration>> = await apiClient.get(
      `/versioning/migrations/${id}`
    );
    return response.data;
  }

  static async createMigrationPlan(fromVersion: string, toVersion: string): Promise<APIResponse<VersionMigration>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      fromVersion,
      toVersion,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<VersionMigration>> = await apiClient.post(
      '/versioning/migrations/plan',
      payload
    );
    return response.data;
  }

  static async executeMigration(id: string, dryRun = false): Promise<APIResponse<any>> {
    const payload = { dryRun };
    const response: AxiosResponse<APIResponse<any>> = await apiClient.post(
      `/versioning/migrations/${id}/execute`,
      payload
    );
    return response.data;
  }

  static async rollbackMigration(id: string): Promise<APIResponse<any>> {
    const response: AxiosResponse<APIResponse<any>> = await apiClient.post(
      `/versioning/migrations/${id}/rollback`
    );
    return response.data;
  }

  static async getMigrationGuide(fromVersion: string, toVersion: string, format = 'markdown'): Promise<APIResponse<string>> {
    const response: AxiosResponse<APIResponse<string>> = await apiClient.get(
      `/versioning/migrations/guide?from_version=${fromVersion}&to_version=${toVersion}&format=${format}`
    );
    return response.data;
  }

  // Encryption Configuration Management
  static async getEncryptionConfigs(filter?: EncryptionFilter): Promise<PaginatedResponse<EncryptionConfig>> {
    const params = new URLSearchParams();
    if (filter?.type?.length) {
      params.append('type', filter.type.join(','));
    }
    if (filter?.algorithm?.length) {
      params.append('algorithm', filter.algorithm.join(','));
    }
    if (filter?.status !== undefined) {
      params.append('active', filter.status.toString());
    }
    if (filter?.searchTerm) {
      params.append('search', filter.searchTerm);
    }

    const response: AxiosResponse<PaginatedResponse<EncryptionConfig>> = await apiClient.get(
      `/versioning/encryption/configs?${params.toString()}`
    );
    return response.data;
  }

  static async getEncryptionConfig(id: string): Promise<APIResponse<EncryptionConfig>> {
    const response: AxiosResponse<APIResponse<EncryptionConfig>> = await apiClient.get(
      `/versioning/encryption/configs/${id}`
    );
    return response.data;
  }

  static async createEncryptionConfig(data: EncryptionFormData): Promise<APIResponse<EncryptionConfig>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<EncryptionConfig>> = await apiClient.post(
      '/versioning/encryption/configs',
      payload
    );
    return response.data;
  }

  static async updateEncryptionConfig(id: string, data: Partial<EncryptionFormData>): Promise<APIResponse<EncryptionConfig>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      updatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<EncryptionConfig>> = await apiClient.put(
      `/versioning/encryption/configs/${id}`,
      payload
    );
    return response.data;
  }

  static async deleteEncryptionConfig(id: string): Promise<APIResponse<void>> {
    const response: AxiosResponse<APIResponse<void>> = await apiClient.delete(
      `/versioning/encryption/configs/${id}`
    );
    return response.data;
  }

  static async getEncryptionStatus(): Promise<APIResponse<any>> {
    const response: AxiosResponse<APIResponse<any>> = await apiClient.get(
      '/versioning/encryption/status'
    );
    return response.data;
  }

  // Key Management
  static async getKeys(filter?: KeyFilter): Promise<PaginatedResponse<EncryptionKey>> {
    const params = new URLSearchParams();
    if (filter?.type?.length) {
      params.append('type', filter.type.join(','));
    }
    if (filter?.status?.length) {
      params.append('status', filter.status.join(','));
    }
    if (filter?.algorithm?.length) {
      params.append('algorithm', filter.algorithm.join(','));
    }
    if (filter?.expiringBefore) {
      params.append('expiring_before', filter.expiringBefore);
    }
    if (filter?.searchTerm) {
      params.append('search', filter.searchTerm);
    }

    const response: AxiosResponse<PaginatedResponse<EncryptionKey>> = await apiClient.get(
      `/versioning/keys?${params.toString()}`
    );
    return response.data;
  }

  static async getKey(id: string): Promise<APIResponse<EncryptionKey>> {
    const response: AxiosResponse<APIResponse<EncryptionKey>> = await apiClient.get(
      `/versioning/keys/${id}`
    );
    return response.data;
  }

  static async generateKey(data: KeyFormData): Promise<APIResponse<EncryptionKey>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      ...data,
      createdAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<EncryptionKey>> = await apiClient.post(
      '/versioning/keys/generate',
      payload
    );
    return response.data;
  }

  static async rotateKey(id: string, gracePeriod?: number): Promise<APIResponse<EncryptionKey>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      gracePeriod,
      rotatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<EncryptionKey>> = await apiClient.post(
      `/versioning/keys/${id}/rotate`,
      payload
    );
    return response.data;
  }

  static async revokeKey(id: string, reason?: string): Promise<APIResponse<void>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      reason,
      revokedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<void>> = await apiClient.post(
      `/versioning/keys/${id}/revoke`,
      payload
    );
    return response.data;
  }

  static async getKeyUsage(id: string): Promise<APIResponse<any>> {
    const response: AxiosResponse<APIResponse<any>> = await apiClient.get(
      `/versioning/keys/${id}/usage`
    );
    return response.data;
  }

  // Usage Analytics
  static async getVersionMetrics(version?: string, timeRange = '30d'): Promise<APIResponse<VersionUsageMetrics>> {
    const params = new URLSearchParams();
    if (version) {
      params.append('version', version);
    }
    params.append('time_range', timeRange);

    const response: AxiosResponse<APIResponse<VersionUsageMetrics>> = await apiClient.get(
      `/versioning/metrics?${params.toString()}`
    );
    return response.data;
  }

  static async getUsageAnalytics(timeRange = '30d'): Promise<APIResponse<UsageChart[]>> {
    const response: AxiosResponse<APIResponse<UsageChart[]>> = await apiClient.get(
      `/versioning/analytics?time_range=${timeRange}`
    );
    return response.data;
  }

  static async getDashboardStats(): Promise<APIResponse<DashboardStats>> {
    const response: AxiosResponse<APIResponse<DashboardStats>> = await apiClient.get(
      '/versioning/dashboard'
    );
    return response.data;
  }

  // Compliance Management
  static async getComplianceStatus(framework?: string): Promise<APIResponse<ComplianceStatus[]>> {
    const params = framework ? `?framework=${framework}` : '';
    const response: AxiosResponse<APIResponse<ComplianceStatus[]>> = await apiClient.get(
      `/versioning/compliance${params}`
    );
    return response.data;
  }

  static async generateComplianceReport(framework: string, format = 'pdf'): Promise<APIResponse<any>> {
    const timestamp = await getCurrentTimestamp();
    const payload = {
      framework,
      format,
      generatedAt: timestamp,
    };

    const response: AxiosResponse<APIResponse<any>> = await apiClient.post(
      '/versioning/compliance/report',
      payload
    );
    return response.data;
  }

  static async getComplianceFrameworks(): Promise<APIResponse<string[]>> {
    const response: AxiosResponse<APIResponse<string[]>> = await apiClient.get(
      '/versioning/compliance/frameworks'
    );
    return response.data;
  }

  // Version Compatibility
  static async checkCompatibility(fromVersion: string, toVersion: string): Promise<APIResponse<any>> {
    const response: AxiosResponse<APIResponse<any>> = await apiClient.get(
      `/versioning/compatibility?from_version=${fromVersion}&to_version=${toVersion}`
    );
    return response.data;
  }

  // Import/Export
  static async importOpenAPISpec(file: File, version?: string): Promise<APIResponse<APIVersion>> {
    const formData = new FormData();
    formData.append('file', file);
    if (version) {
      formData.append('version', version);
    }

    const response: AxiosResponse<APIResponse<APIVersion>> = await apiClient.post(
      '/versioning/import/openapi',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  static async exportVersion(id: string, format = 'openapi'): Promise<APIResponse<any>> {
    const response: AxiosResponse<APIResponse<any>> = await apiClient.get(
      `/versioning/versions/${id}/export?format=${format}`
    );
    return response.data;
  }

  static async bulkExport(versionIds: string[], format = 'openapi'): Promise<APIResponse<any>> {
    const payload = {
      versionIds,
      format,
    };

    const response: AxiosResponse<APIResponse<any>> = await apiClient.post(
      '/versioning/export/bulk',
      payload
    );
    return response.data;
  }
}

export default VersioningService;