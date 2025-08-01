import axios from 'axios';
import {
  RotationPolicy,
  RotationJob,
  RotationHistory,
  RotationMetrics,
  UpcomingRotation
} from '../types/rotation';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

class RotationService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  // Rotation Policies
  async getRotationPolicies(): Promise<RotationPolicy[]> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/policies`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async getRotationPolicy(policyId: string): Promise<RotationPolicy> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/policies/${policyId}`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async createRotationPolicy(policy: Partial<RotationPolicy>): Promise<RotationPolicy> {
    const response = await axios.post(`${API_BASE_URL}/keys/rotation/policies`, policy, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async updateRotationPolicy(policyId: string, updates: Partial<RotationPolicy>): Promise<RotationPolicy> {
    const response = await axios.put(`${API_BASE_URL}/keys/rotation/policies/${policyId}`, updates, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async deleteRotationPolicy(policyId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/keys/rotation/policies/${policyId}`, {
      headers: this.getAuthHeaders()
    });
  }

  async applyPolicyToKeys(policyId: string, apiKeyIds: string[]): Promise<void> {
    await axios.post(`${API_BASE_URL}/keys/rotation/policies/${policyId}/apply`, {
      api_key_ids: apiKeyIds
    }, {
      headers: this.getAuthHeaders()
    });
  }

  // Rotation Jobs
  async getUpcomingRotations(daysAhead: number = 30): Promise<UpcomingRotation[]> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/upcoming`, {
      headers: this.getAuthHeaders(),
      params: { days_ahead: daysAhead }
    });
    return response.data;
  }

  async scheduleRotation(policyId: string, scheduledAt: string, apiKeyIds?: string[]): Promise<RotationJob> {
    const response = await axios.post(`${API_BASE_URL}/keys/rotation/schedule`, {
      policy_id: policyId,
      scheduled_at: scheduledAt,
      api_key_ids: apiKeyIds
    }, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async executeRotation(jobId: string): Promise<RotationJob> {
    const response = await axios.post(`${API_BASE_URL}/keys/rotation/jobs/${jobId}/execute`, {}, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async approveRotation(jobId: string, notes: string): Promise<RotationJob> {
    const response = await axios.post(`${API_BASE_URL}/keys/rotation/jobs/${jobId}/approve`, {
      notes
    }, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async cancelRotation(jobId: string, reason: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/keys/rotation/jobs/${jobId}/cancel`, {
      reason
    }, {
      headers: this.getAuthHeaders()
    });
  }

  // Rotation History
  async getRotationHistory(daysBack: number = 90, apiKeyId?: string, policyId?: string): Promise<RotationHistory[]> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/history`, {
      headers: this.getAuthHeaders(),
      params: {
        days_back: daysBack,
        api_key_id: apiKeyId,
        policy_id: policyId
      }
    });
    return response.data;
  }

  // Rotation Metrics
  async getRotationMetrics(startDate?: string, endDate?: string): Promise<RotationMetrics> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/metrics`, {
      headers: this.getAuthHeaders(),
      params: {
        start_date: startDate,
        end_date: endDate
      }
    });
    return response.data;
  }

  // Notification Settings
  async getNotificationSettings(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/notifications/settings`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async updateNotificationSettings(settings: any): Promise<void> {
    await axios.put(`${API_BASE_URL}/keys/rotation/notifications/settings`, settings, {
      headers: this.getAuthHeaders()
    });
  }

  async testNotification(channel: string, recipient: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/keys/rotation/notifications/test`, {
      channel,
      recipient
    }, {
      headers: this.getAuthHeaders()
    });
  }

  // Auto-update Connectors
  async getAutoUpdateConnectors(): Promise<any[]> {
    const response = await axios.get(`${API_BASE_URL}/keys/rotation/connectors`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async createAutoUpdateConnector(connector: any): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/keys/rotation/connectors`, connector, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async testAutoUpdateConnector(connectorId: string): Promise<{ success: boolean; message: string }> {
    const response = await axios.post(`${API_BASE_URL}/keys/rotation/connectors/${connectorId}/test`, {}, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }
}

export const rotationService = new RotationService();