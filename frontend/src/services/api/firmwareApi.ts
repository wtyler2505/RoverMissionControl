/**
 * Firmware API Service
 * Handles all firmware-related API calls
 */

import { apiClient } from './client';

export interface FirmwareVersion {
  device_id: string;
  version: string;
  major: number;
  minor: number;
  patch: number;
  build?: number;
  timestamp: string;
}

export interface FirmwareUpdate {
  update_available: boolean;
  current_version: string;
  latest_version: string;
  update_priority: 'critical' | 'high' | 'normal' | 'low' | 'optional';
  critical_update: boolean;
  release_date?: string;
  changelog?: string;
  size: number;
}

export interface FirmwareUpdateSession {
  session_id: string;
  device_id: string;
  state: string;
  progress: number;
  source_version: string;
  target_version: string;
  start_time: string;
  elapsed_time: number;
  retry_count: number;
  emergency_stop: boolean;
  errors: number;
  last_checkpoint?: any;
}

export interface FirmwareValidationResult {
  device_id: string;
  version: string;
  validation_result: string;
  valid: boolean;
  timestamp: string;
}

export interface UpdateHistoryItem {
  session_id: string;
  timestamp: string;
  from_version: string;
  to_version: string;
  status: string;
  duration: number;
}

export interface EmergencyStopStatus {
  emergency_stop_active: boolean;
  active_sessions: number;
  timestamp: string;
}

class FirmwareApi {
  private basePath = '/api/firmware';

  // Device firmware operations
  async getDeviceFirmwareVersion(deviceId: string): Promise<FirmwareVersion> {
    const response = await apiClient.get(`${this.basePath}/devices/${deviceId}/version`);
    return response.data;
  }

  async checkFirmwareUpdates(deviceId: string): Promise<FirmwareUpdate> {
    const response = await apiClient.get(`${this.basePath}/devices/${deviceId}/check-updates`);
    return response.data;
  }

  async startFirmwareUpdate(
    deviceId: string,
    targetVersion: string,
    force: boolean = false
  ): Promise<{ success: boolean; session_id: string; message: string }> {
    const response = await apiClient.post(`${this.basePath}/devices/${deviceId}/update`, {
      target_version: targetVersion,
      force,
    });
    return response.data;
  }

  async validateDeviceFirmware(
    deviceId: string,
    version: string
  ): Promise<FirmwareValidationResult> {
    const response = await apiClient.post(`${this.basePath}/devices/${deviceId}/validate`, {
      version,
    });
    return response.data;
  }

  async getDeviceUpdateHistory(
    deviceId: string,
    limit: number = 10
  ): Promise<UpdateHistoryItem[]> {
    const response = await apiClient.get(
      `${this.basePath}/devices/${deviceId}/history?limit=${limit}`
    );
    return response.data;
  }

  // Repository operations
  async listFirmwareRepository(deviceId?: string): Promise<Record<string, any[]>> {
    const params = deviceId ? `?device_id=${deviceId}` : '';
    const response = await apiClient.get(`${this.basePath}/repository${params}`);
    return response.data;
  }

  async deleteFirmware(deviceId: string, version: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/repository/${deviceId}/${version}`);
  }

  async cleanupOldFirmware(
    deviceId: string,
    keepCount: number = 3
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`${this.basePath}/repository/cleanup`, {
      device_id: deviceId,
      keep_count: keepCount,
    });
    return response.data;
  }

  // Session management
  async getUpdateSessions(): Promise<Record<string, FirmwareUpdateSession>> {
    const response = await apiClient.get(`${this.basePath}/sessions`);
    return response.data;
  }

  async getSessionStatus(sessionId: string): Promise<FirmwareUpdateSession> {
    const response = await apiClient.get(`${this.basePath}/sessions/${sessionId}`);
    return response.data;
  }

  async cancelUpdateSession(
    sessionId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`${this.basePath}/sessions/${sessionId}/cancel`);
    return response.data;
  }

  // Emergency stop operations
  async getEmergencyStopStatus(): Promise<EmergencyStopStatus> {
    const response = await apiClient.get(`${this.basePath}/emergency-stop/status`);
    return response.data;
  }

  async triggerEmergencyStop(): Promise<{ success: boolean; message: string; timestamp: string }> {
    const response = await apiClient.post(`${this.basePath}/emergency-stop`);
    return response.data;
  }

  async clearEmergencyStop(): Promise<{ success: boolean; message: string; timestamp: string }> {
    const response = await apiClient.post(`${this.basePath}/emergency-stop/clear`);
    return response.data;
  }

  // Health check
  async getSystemHealth(): Promise<{
    healthy: boolean;
    emergency_stop_active: boolean;
    active_updates: number;
    repository_size: number;
    timestamp: string;
  }> {
    const response = await apiClient.get(`${this.basePath}/health`);
    return response.data;
  }
}

export const firmwareApi = new FirmwareApi();