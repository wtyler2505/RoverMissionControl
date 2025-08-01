import api from './api';
import {
  SchemaDefinition,
  SchemaFilter,
  SchemaListResponse,
  ValidationRule,
  SchemaVersion,
  SchemaEndpointMapping,
  SchemaImportResult,
  ValidationTestRequest,
  ValidationTestResult,
  SchemaMetrics,
  ValidationLog
} from '../types/schema';

class SchemaService {
  private baseUrl = '/api/schemas';

  // Schema CRUD operations
  async getSchemas(filter?: SchemaFilter, page = 1, pageSize = 20): Promise<SchemaListResponse> {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else if (typeof value === 'object') {
            params.append(key, JSON.stringify(value));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }
    params.append('page', String(page));
    params.append('page_size', String(pageSize));

    const response = await api.get(`${this.baseUrl}?${params.toString()}`);
    return response.data;
  }

  async getSchema(id: string): Promise<SchemaDefinition> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async createSchema(schema: Partial<SchemaDefinition>): Promise<SchemaDefinition> {
    const response = await api.post(this.baseUrl, schema);
    return response.data;
  }

  async updateSchema(id: string, schema: Partial<SchemaDefinition>): Promise<SchemaDefinition> {
    const response = await api.put(`${this.baseUrl}/${id}`, schema);
    return response.data;
  }

  async deleteSchema(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Import/Export operations
  async importOpenAPI(file: File, namespace?: string): Promise<SchemaImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    if (namespace) {
      formData.append('namespace', namespace);
    }

    const response = await api.post(`${this.baseUrl}/import/openapi`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async exportSchema(id: string, format: 'json_schema' | 'openapi' = 'json_schema'): Promise<Blob> {
    const response = await api.get(`${this.baseUrl}/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  }

  // Validation rules
  async getValidationRules(schemaId: string): Promise<ValidationRule[]> {
    const response = await api.get(`${this.baseUrl}/${schemaId}/rules`);
    return response.data;
  }

  async createValidationRule(schemaId: string, rule: Partial<ValidationRule>): Promise<ValidationRule> {
    const response = await api.post(`${this.baseUrl}/${schemaId}/rules`, rule);
    return response.data;
  }

  async updateValidationRule(schemaId: string, ruleId: string, rule: Partial<ValidationRule>): Promise<ValidationRule> {
    const response = await api.put(`${this.baseUrl}/${schemaId}/rules/${ruleId}`, rule);
    return response.data;
  }

  async deleteValidationRule(schemaId: string, ruleId: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${schemaId}/rules/${ruleId}`);
  }

  // Versioning
  async getSchemaVersions(schemaId: string): Promise<SchemaVersion[]> {
    const response = await api.get(`${this.baseUrl}/${schemaId}/versions`);
    return response.data;
  }

  async createSchemaVersion(schemaId: string, version: Partial<SchemaVersion>): Promise<SchemaVersion> {
    const response = await api.post(`${this.baseUrl}/${schemaId}/versions`, version);
    return response.data;
  }

  async compareVersions(schemaId: string, version1: string, version2: string): Promise<any> {
    const response = await api.get(`${this.baseUrl}/${schemaId}/versions/compare`, {
      params: { version1, version2 },
    });
    return response.data;
  }

  // Endpoint mapping
  async getEndpointMappings(schemaId?: string): Promise<SchemaEndpointMapping[]> {
    const url = schemaId ? `${this.baseUrl}/${schemaId}/endpoints` : `${this.baseUrl}/endpoints`;
    const response = await api.get(url);
    return response.data;
  }

  async createEndpointMapping(mapping: Partial<SchemaEndpointMapping>): Promise<SchemaEndpointMapping> {
    const response = await api.post(`${this.baseUrl}/endpoints`, mapping);
    return response.data;
  }

  async updateEndpointMapping(id: string, mapping: Partial<SchemaEndpointMapping>): Promise<SchemaEndpointMapping> {
    const response = await api.put(`${this.baseUrl}/endpoints/${id}`, mapping);
    return response.data;
  }

  async deleteEndpointMapping(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/endpoints/${id}`);
  }

  // Validation testing
  async testValidation(request: ValidationTestRequest): Promise<ValidationTestResult> {
    const response = await api.post(`${this.baseUrl}/validate/test`, request);
    return response.data;
  }

  async validateAgainstSchema(schemaId: string, data: any): Promise<ValidationTestResult> {
    const response = await api.post(`${this.baseUrl}/${schemaId}/validate`, { data });
    return response.data;
  }

  // Metrics and logs
  async getSchemaMetrics(schemaId: string, timeRange?: { start: string; end: string }): Promise<SchemaMetrics> {
    const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
    const response = await api.get(`${this.baseUrl}/${schemaId}/metrics`, { params });
    return response.data;
  }

  async getValidationLogs(
    filter?: {
      schemaId?: string;
      endpointId?: string;
      isValid?: boolean;
      startDate?: string;
      endDate?: string;
    },
    page = 1,
    pageSize = 50
  ): Promise<{ logs: ValidationLog[]; total: number }> {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    params.append('page', String(page));
    params.append('page_size', String(pageSize));

    const response = await api.get(`${this.baseUrl}/logs?${params.toString()}`);
    return response.data;
  }

  // Utility methods
  async generateSampleData(schemaId: string): Promise<any> {
    const response = await api.get(`${this.baseUrl}/${schemaId}/sample`);
    return response.data;
  }

  async analyzeSchemaCoverage(schemaId: string): Promise<any> {
    const response = await api.get(`${this.baseUrl}/${schemaId}/coverage`);
    return response.data;
  }
}

export default new SchemaService();