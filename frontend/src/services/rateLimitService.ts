import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export interface RateLimitPolicy {
  id: string;
  name: string;
  description?: string;
  targetType: 'global' | 'api_key' | 'user' | 'endpoint' | 'ip_address';
  targetValue?: string;
  window: 'minute' | 'hour' | 'day' | 'week' | 'month';
  limit: number;
  burstEnabled: boolean;
  burstLimit?: number;
  burstWindowSeconds?: number;
  customErrorMessage?: string;
  customHeaders?: Record<string, string>;
  excludePatterns?: string[];
  includePatterns?: string[];
  methodSpecific?: Record<string, number>;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: {
    id: string;
    username: string;
  };
}

export interface RateLimitAlert {
  id: string;
  policyId: string;
  policyName?: string;
  name: string;
  description?: string;
  violationThreshold: number;
  timeWindowMinutes: number;
  notifyEmails?: string[];
  notifyWebhooks?: string[];
  notifySlack?: any;
  cooldownMinutes: number;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
}

export interface RateLimitViolation {
  id: string;
  policyId: string;
  policyName: string;
  identifier: string;
  endpoint: string;
  method: string;
  ipAddress?: string;
  windowStart: string;
  requestCount: number;
  limitExceededBy: number;
  actionTaken: string;
  violatedAt: string;
}

export interface RateLimitMetrics {
  policyId?: string;
  policyName?: string;
  bucketStart: string;
  bucketMinutes: number;
  totalRequests: number;
  blockedRequests: number;
  violationRate: number;
  avgResponseTimeMs?: number;
  p95ResponseTimeMs?: number;
  p99ResponseTimeMs?: number;
  topViolators: Array<{ identifier: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
}

export interface RealtimeMetrics {
  timestamp: string;
  activePolicies: number;
  recentViolations: number;
  topViolators: Array<{ identifier: string; count: number }>;
  violationTrend: Array<{ minute: string; violations: number }>;
}

class RateLimitService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Policy Management
  async createPolicy(policy: Partial<RateLimitPolicy>): Promise<RateLimitPolicy> {
    const response = await axios.post(`${API_BASE_URL}/security/rate-limits/policies`, {
      name: policy.name,
      description: policy.description,
      target_type: policy.targetType,
      target_value: policy.targetValue,
      window: policy.window,
      limit: policy.limit,
      burst_enabled: policy.burstEnabled,
      burst_limit: policy.burstLimit,
      burst_window_seconds: policy.burstWindowSeconds,
      custom_error_message: policy.customErrorMessage,
      custom_headers: policy.customHeaders,
      exclude_patterns: policy.excludePatterns,
      include_patterns: policy.includePatterns,
      method_specific: policy.methodSpecific,
      priority: policy.priority,
      is_active: policy.isActive
    }, {
      headers: this.getAuthHeaders()
    });
    return this.transformPolicy(response.data);
  }

  async getPolicies(targetType?: string, activeOnly: boolean = true): Promise<RateLimitPolicy[]> {
    const params: any = { active_only: activeOnly };
    if (targetType) params.target_type = targetType;
    
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/policies`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.map(this.transformPolicy);
  }

  async getPolicy(policyId: string): Promise<RateLimitPolicy> {
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/policies/${policyId}`, {
      headers: this.getAuthHeaders()
    });
    return this.transformPolicy(response.data);
  }

  async updatePolicy(policyId: string, updates: Partial<RateLimitPolicy>): Promise<RateLimitPolicy> {
    const response = await axios.put(`${API_BASE_URL}/security/rate-limits/policies/${policyId}`, {
      name: updates.name,
      description: updates.description,
      target_value: updates.targetValue,
      limit: updates.limit,
      burst_enabled: updates.burstEnabled,
      burst_limit: updates.burstLimit,
      burst_window_seconds: updates.burstWindowSeconds,
      custom_error_message: updates.customErrorMessage,
      custom_headers: updates.customHeaders,
      exclude_patterns: updates.excludePatterns,
      include_patterns: updates.includePatterns,
      method_specific: updates.methodSpecific,
      priority: updates.priority,
      is_active: updates.isActive
    }, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async deletePolicy(policyId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/security/rate-limits/policies/${policyId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // Alert Management
  async createAlert(alert: Partial<RateLimitAlert>): Promise<RateLimitAlert> {
    const response = await axios.post(`${API_BASE_URL}/security/rate-limits/alerts`, {
      policy_id: alert.policyId,
      name: alert.name,
      description: alert.description,
      violation_threshold: alert.violationThreshold,
      time_window_minutes: alert.timeWindowMinutes,
      notify_emails: alert.notifyEmails,
      notify_webhooks: alert.notifyWebhooks,
      notify_slack: alert.notifySlack,
      cooldown_minutes: alert.cooldownMinutes,
      is_active: alert.isActive
    }, {
      headers: this.getAuthHeaders()
    });
    return this.transformAlert(response.data);
  }

  async getAlerts(policyId?: string, activeOnly: boolean = true): Promise<RateLimitAlert[]> {
    const params: any = { active_only: activeOnly };
    if (policyId) params.policy_id = policyId;
    
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/alerts`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.map(this.transformAlert);
  }

  // Monitoring
  async getViolations(
    policyId?: string,
    identifier?: string,
    hoursBack: number = 24,
    limit: number = 100
  ): Promise<RateLimitViolation[]> {
    const params: any = { hours_back: hoursBack, limit };
    if (policyId) params.policy_id = policyId;
    if (identifier) params.identifier = identifier;
    
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/violations`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.map(this.transformViolation);
  }

  async getMetrics(policyId?: string, hoursBack: number = 24): Promise<RateLimitMetrics[]> {
    const params: any = { hours_back: hoursBack };
    if (policyId) params.policy_id = policyId;
    
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/metrics`, {
      headers: this.getAuthHeaders(),
      params
    });
    return response.data.map(this.transformMetrics);
  }

  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/metrics/realtime`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async triggerMetricsCollection(bucketMinutes: number = 5): Promise<void> {
    await axios.post(`${API_BASE_URL}/security/rate-limits/metrics/collect`, null, {
      headers: this.getAuthHeaders(),
      params: { bucket_minutes: bucketMinutes }
    });
  }

  // Testing
  async testRateLimit(
    identifier: string,
    endpoint: string,
    method: string = 'GET',
    apiKeyId?: string,
    userId?: string,
    ipAddress?: string
  ): Promise<{
    allowed: boolean;
    policy?: any;
    info: any;
    testDetails: any;
  }> {
    const response = await axios.post(`${API_BASE_URL}/security/rate-limits/test`, {
      identifier,
      endpoint,
      method,
      api_key_id: apiKeyId,
      user_id: userId,
      ip_address: ipAddress
    }, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  // Export
  async exportPolicies(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/security/rate-limits/export`, {
      headers: this.getAuthHeaders(),
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }

  // Transform helpers
  private transformPolicy(data: any): RateLimitPolicy {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      targetType: data.target_type,
      targetValue: data.target_value,
      window: data.window,
      limit: data.limit,
      burstEnabled: data.burst_enabled,
      burstLimit: data.burst_limit,
      burstWindowSeconds: data.burst_window_seconds,
      customErrorMessage: data.custom_error_message,
      customHeaders: data.custom_headers,
      excludePatterns: data.exclude_patterns,
      includePatterns: data.include_patterns,
      methodSpecific: data.method_specific,
      priority: data.priority,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      createdBy: data.created_by
    };
  }

  private transformAlert(data: any): RateLimitAlert {
    return {
      id: data.id,
      policyId: data.policy_id,
      policyName: data.policy_name,
      name: data.name,
      description: data.description,
      violationThreshold: data.violation_threshold,
      timeWindowMinutes: data.time_window_minutes,
      notifyEmails: data.notify_emails,
      notifyWebhooks: data.notify_webhooks,
      notifySlack: data.notify_slack,
      cooldownMinutes: data.cooldown_minutes,
      isActive: data.is_active,
      lastTriggeredAt: data.last_triggered_at,
      triggerCount: data.trigger_count
    };
  }

  private transformViolation(data: any): RateLimitViolation {
    return {
      id: data.id,
      policyId: data.policy_id,
      policyName: data.policy_name,
      identifier: data.identifier,
      endpoint: data.endpoint,
      method: data.method,
      ipAddress: data.ip_address,
      windowStart: data.window_start,
      requestCount: data.request_count,
      limitExceededBy: data.limit_exceeded_by,
      actionTaken: data.action_taken,
      violatedAt: data.violated_at
    };
  }

  private transformMetrics(data: any): RateLimitMetrics {
    return {
      policyId: data.policy_id,
      policyName: data.policy_name,
      bucketStart: data.bucket_start,
      bucketMinutes: data.bucket_minutes,
      totalRequests: data.total_requests,
      blockedRequests: data.blocked_requests,
      violationRate: data.violation_rate,
      avgResponseTimeMs: data.avg_response_time_ms,
      p95ResponseTimeMs: data.p95_response_time_ms,
      p99ResponseTimeMs: data.p99_response_time_ms,
      topViolators: data.top_violators,
      topEndpoints: data.top_endpoints
    };
  }
}

export const rateLimitService = new RateLimitService();