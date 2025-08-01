import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface DeviceIdentity {
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  firmware_version?: string;
  hardware_version?: string;
  protocol_version?: string;
}

export interface DeviceCapability {
  name: string;
  category: string;
  description?: string;
  parameters?: Record<string, any>;
  read_only?: boolean;
}

export interface DiscoveredDevice {
  device_id: string;
  protocol_type: string;
  address?: any;
  discovery_method: string;
  discovered_at: string;
  device_class: string;
  identity: DeviceIdentity;
  capabilities: DeviceCapability[];
  metadata: Record<string, any>;
  confidence: number;
}

export interface ManualDeviceData {
  device_id?: string;
  protocol_type: string;
  address?: any;
  device_class?: string;
  identity?: DeviceIdentity;
  capabilities?: DeviceCapability[];
  metadata?: Record<string, any>;
}

export interface DiscoveryConfig {
  auto_discovery_interval?: number;
  probe_timeout?: number;
  max_retries?: number;
  enable_passive_discovery?: boolean;
  enable_broadcast?: boolean;
}

export interface DiscoveryStatus {
  discovered_devices: number;
  active_discovery_tasks: string[];
  devices_by_protocol: Record<string, number>;
  devices_by_class: Record<string, number>;
  configuration: DiscoveryConfig;
}

class DiscoveryService {
  private wsConnection: WebSocket | null = null;

  async startDiscovery(protocols?: string[], methods?: string[]): Promise<any> {
    const params = new URLSearchParams();
    protocols?.forEach(p => params.append('protocols', p));
    methods?.forEach(m => params.append('methods', m));

    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/start?${params.toString()}`
    );
    return response.data;
  }

  async stopDiscovery(protocols?: string[]): Promise<any> {
    const params = new URLSearchParams();
    protocols?.forEach(p => params.append('protocols', p));

    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/stop?${params.toString()}`
    );
    return response.data;
  }

  async scanNow(protocol?: string): Promise<any> {
    const params = protocol ? `?protocol=${protocol}` : '';
    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/scan${params}`
    );
    return response.data;
  }

  async getDiscoveredDevices(
    protocol?: string,
    deviceClass?: string
  ): Promise<DiscoveredDevice[]> {
    const params = new URLSearchParams();
    if (protocol) params.append('protocol', protocol);
    if (deviceClass) params.append('device_class', deviceClass);

    const response = await axios.get(
      `${API_BASE_URL}/api/hardware/discovery/devices?${params.toString()}`
    );
    return response.data;
  }

  async getDeviceInfo(deviceId: string): Promise<DiscoveredDevice> {
    const response = await axios.get(
      `${API_BASE_URL}/api/hardware/discovery/devices/${deviceId}`
    );
    return response.data;
  }

  async registerDevice(
    deviceId: string,
    adapterId: string,
    name?: string
  ): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/devices/register`,
      {
        device_id: deviceId,
        adapter_id: adapterId,
        name
      }
    );
    return response.data;
  }

  async registerManualDevice(deviceData: ManualDeviceData): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/devices/manual`,
      deviceData
    );
    return response.data;
  }

  async removeDevice(deviceId: string): Promise<any> {
    const response = await axios.delete(
      `${API_BASE_URL}/api/hardware/discovery/devices/${deviceId}`
    );
    return response.data;
  }

  async getDiscoveryStatus(): Promise<DiscoveryStatus> {
    const response = await axios.get(
      `${API_BASE_URL}/api/hardware/discovery/status`
    );
    return response.data;
  }

  async updateConfig(config: DiscoveryConfig): Promise<any> {
    const response = await axios.patch(
      `${API_BASE_URL}/api/hardware/discovery/config`,
      config
    );
    return response.data;
  }

  async exportDeviceRegistry(filePath: string): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/export?file_path=${encodeURIComponent(filePath)}`
    );
    return response.data;
  }

  async importDeviceRegistry(filePath: string): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/discovery/import?file_path=${encodeURIComponent(filePath)}`
    );
    return response.data;
  }

  connectWebSocket(onEvent: (event: any) => void): WebSocket | null {
    try {
      const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
      this.wsConnection = new WebSocket(`${wsUrl}/api/hardware/discovery/events`);

      this.wsConnection.onopen = () => {
        console.log('Discovery WebSocket connected');
      };

      this.wsConnection.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onEvent(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.wsConnection.onerror = (error) => {
        console.error('Discovery WebSocket error:', error);
      };

      this.wsConnection.onclose = () => {
        console.log('Discovery WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (this.wsConnection?.readyState === WebSocket.CLOSED) {
            this.connectWebSocket(onEvent);
          }
        }, 5000);
      };

      // Send periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        if (this.wsConnection?.readyState === WebSocket.OPEN) {
          this.wsConnection.send('ping');
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      return this.wsConnection;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      return null;
    }
  }

  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }
}

export const discoveryService = new DiscoveryService();