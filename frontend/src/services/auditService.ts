// Audit service for API communication

import axios from 'axios';
import {
  AuditLog,
  AuditDashboardStats,
  AuditSearchParams,
  AuditAlert,
  RetentionPolicy,
  AuditExport,
  ComplianceReport,
  ComplianceFramework,
  ExportFormat,
  AuditAnalytics
} from '../types/audit';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

class AuditService {
  private apiClient = axios.create({
    baseURL: `${API_BASE_URL}/api/security/audit`,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  constructor() {
    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Dashboard and Analytics
  async getDashboardStats(
    startDate?: string,
    endDate?: string
  ): Promise<AuditDashboardStats> {
    const response = await this.apiClient.get('/dashboard', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  async getAnalytics(
    startDate: string,
    endDate: string,
    groupBy?: string
  ): Promise<AuditAnalytics> {
    const response = await this.apiClient.get('/analytics', {
      params: { start_date: startDate, end_date: endDate, group_by: groupBy }
    });
    return response.data;
  }

  // Audit Log Operations
  async searchLogs(params: AuditSearchParams): Promise<{
    logs: AuditLog[];
    total: number;
    page: number;
    page_size: number;
  }> {
    const response = await this.apiClient.post('/search', params);
    return response.data;
  }

  async getLogById(logId: string): Promise<AuditLog> {
    const response = await this.apiClient.get(`/logs/${logId}`);
    return response.data;
  }

  async getTimelineEvents(
    startDate: string,
    endDate: string,
    groupBy?: 'actor' | 'target' | 'category'
  ): Promise<AuditTimelineEvent[]> {
    const response = await this.apiClient.get('/timeline', {
      params: { start_date: startDate, end_date: endDate, group_by: groupBy }
    });
    return response.data;
  }

  // Alert Management
  async getAlerts(): Promise<AuditAlert[]> {
    const response = await this.apiClient.get('/alerts');
    return response.data;
  }

  async getAlertById(alertId: string): Promise<AuditAlert> {
    const response = await this.apiClient.get(`/alerts/${alertId}`);
    return response.data;
  }

  async createAlert(alert: Omit<AuditAlert, 'id' | 'created_at' | 'updated_at' | 'last_triggered' | 'trigger_count'>): Promise<AuditAlert> {
    const response = await this.apiClient.post('/alerts', alert);
    return response.data;
  }

  async updateAlert(
    alertId: string,
    alert: Partial<AuditAlert>
  ): Promise<AuditAlert> {
    const response = await this.apiClient.put(`/alerts/${alertId}`, alert);
    return response.data;
  }

  async deleteAlert(alertId: string): Promise<void> {
    await this.apiClient.delete(`/alerts/${alertId}`);
  }

  async testAlert(alertId: string): Promise<{
    would_trigger: boolean;
    matching_events: number;
    sample_events: AuditLog[];
  }> {
    const response = await this.apiClient.post(`/alerts/${alertId}/test`);
    return response.data;
  }

  // Retention Policy Management
  async getRetentionPolicies(): Promise<RetentionPolicy[]> {
    const response = await this.apiClient.get('/retention-policies');
    return response.data;
  }

  async getRetentionPolicyById(policyId: string): Promise<RetentionPolicy> {
    const response = await this.apiClient.get(`/retention-policies/${policyId}`);
    return response.data;
  }

  async createRetentionPolicy(
    policy: Omit<RetentionPolicy, 'id' | 'created_at' | 'updated_at' | 'applied_count'>
  ): Promise<RetentionPolicy> {
    const response = await this.apiClient.post('/retention-policies', policy);
    return response.data;
  }

  async updateRetentionPolicy(
    policyId: string,
    policy: Partial<RetentionPolicy>
  ): Promise<RetentionPolicy> {
    const response = await this.apiClient.put(`/retention-policies/${policyId}`, policy);
    return response.data;
  }

  async deleteRetentionPolicy(policyId: string): Promise<void> {
    await this.apiClient.delete(`/retention-policies/${policyId}`);
  }

  async applyRetentionPolicy(policyId: string): Promise<{
    archived_count: number;
    deleted_count: number;
    errors: string[];
  }> {
    const response = await this.apiClient.post(`/retention-policies/${policyId}/apply`);
    return response.data;
  }

  // Export Management
  async getExports(): Promise<AuditExport[]> {
    const response = await this.apiClient.get('/exports');
    return response.data;
  }

  async createExport(
    format: ExportFormat,
    filters: AuditSearchParams,
    options?: {
      compliance_framework?: ComplianceFramework;
      encryption_enabled?: boolean;
      compression_enabled?: boolean;
    }
  ): Promise<AuditExport> {
    const response = await this.apiClient.post('/exports', {
      format,
      filters,
      ...options
    });
    return response.data;
  }

  async downloadExport(exportId: string): Promise<Blob> {
    const response = await this.apiClient.get(`/exports/${exportId}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async deleteExport(exportId: string): Promise<void> {
    await this.apiClient.delete(`/exports/${exportId}`);
  }

  // Compliance Reporting
  async getComplianceReports(
    framework?: ComplianceFramework
  ): Promise<ComplianceReport[]> {
    const response = await this.apiClient.get('/compliance/reports', {
      params: { framework }
    });
    return response.data;
  }

  async generateComplianceReport(
    framework: ComplianceFramework,
    startDate: string,
    endDate: string
  ): Promise<ComplianceReport> {
    const response = await this.apiClient.post('/compliance/reports', {
      framework,
      report_period_start: startDate,
      report_period_end: endDate
    });
    return response.data;
  }

  async getComplianceReportById(reportId: string): Promise<ComplianceReport> {
    const response = await this.apiClient.get(`/compliance/reports/${reportId}`);
    return response.data;
  }

  async downloadComplianceReport(reportId: string): Promise<Blob> {
    const response = await this.apiClient.get(
      `/compliance/reports/${reportId}/download`,
      { responseType: 'blob' }
    );
    return response.data;
  }

  async submitComplianceReport(reportId: string): Promise<ComplianceReport> {
    const response = await this.apiClient.post(
      `/compliance/reports/${reportId}/submit`
    );
    return response.data;
  }

  // Utility Methods
  async verifyLogIntegrity(logId: string): Promise<{
    valid: boolean;
    checksum_match: boolean;
    signature_valid: boolean;
    issues: string[];
  }> {
    const response = await this.apiClient.post(`/logs/${logId}/verify`);
    return response.data;
  }

  async getComplianceRequirements(
    framework: ComplianceFramework
  ): Promise<{
    retention_days: number;
    required_fields: string[];
    encryption_required: boolean;
    immutability_required: boolean;
    audit_frequency: string;
  }> {
    const response = await this.apiClient.get(`/compliance/requirements/${framework}`);
    return response.data;
  }

  async getEventTypes(category?: AuditCategory): Promise<string[]> {
    const response = await this.apiClient.get('/event-types', {
      params: { category }
    });
    return response.data;
  }
}

// Create singleton instance
const auditService = new AuditService();

// Helper functions for common operations
export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString();
};

export const getSeverityColor = (severity: AuditSeverity): string => {
  const colors = {
    critical: '#d32f2f',
    high: '#f57c00',
    medium: '#fbc02d',
    low: '#689f38',
    info: '#1976d2'
  };
  return colors[severity] || '#757575';
};

export const getComplianceColor = (framework: ComplianceFramework): string => {
  const colors = {
    sox: '#1565c0',
    pci_dss: '#c62828',
    gdpr: '#2e7d32',
    hipaa: '#6a1b9a',
    iso_27001: '#f57c00',
    ccpa: '#00838f'
  };
  return colors[framework] || '#424242';
};

export default auditService;