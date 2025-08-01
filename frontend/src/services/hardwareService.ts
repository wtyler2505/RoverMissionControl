import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export interface HardwareAdapter {
  id: string;
  name: string;
  protocol: string;
  connected: boolean;
  status: string;
  statistics?: {
    bytes_sent: number;
    bytes_received: number;
    error_count: number;
    last_activity?: string;
  };
}

export interface HardwareDevice {
  device_id: string;
  name: string;
  protocol_type: string;
  adapter_id: string;
  address?: any;
  capabilities: string[];
  metadata: Record<string, any>;
  is_active: boolean;
}

export interface SystemStatus {
  adapters: Record<string, any>;
  devices: Record<string, any>;
  summary: {
    total_adapters: number;
    connected_adapters: number;
    total_devices: number;
    active_devices: number;
  };
}

class HardwareService {
  async getAdapters(): Promise<HardwareAdapter[]> {
    const response = await axios.get(`${API_BASE_URL}/api/hardware/adapters`);
    return response.data;
  }

  async getAdaptersByProtocol(protocol: string): Promise<HardwareAdapter[]> {
    const response = await axios.get(`${API_BASE_URL}/api/hardware/adapters?protocol=${protocol}`);
    return response.data;
  }

  async connectAdapter(adapterId: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/api/hardware/adapters/${adapterId}/connect`);
  }

  async disconnectAdapter(adapterId: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/api/hardware/adapters/${adapterId}/disconnect`);
  }

  async getDevices(): Promise<HardwareDevice[]> {
    const response = await axios.get(`${API_BASE_URL}/api/hardware/devices`);
    return response.data;
  }

  async getDevice(deviceId: string): Promise<HardwareDevice> {
    const response = await axios.get(`${API_BASE_URL}/api/hardware/devices/${deviceId}`);
    return response.data;
  }

  async sendCommand(deviceId: string, command: any): Promise<any> {
    const response = await axios.post(
      `${API_BASE_URL}/api/hardware/devices/${deviceId}/command`,
      command
    );
    return response.data;
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const response = await axios.get(`${API_BASE_URL}/api/hardware/status`);
    return response.data;
  }

  async scanDevices(adapterId?: string): Promise<Record<string, string[]>> {
    const params = adapterId ? `?adapter_id=${adapterId}` : '';
    const response = await axios.post(`${API_BASE_URL}/api/hardware/scan${params}`);
    return response.data;
  }
}

export const hardwareService = new HardwareService();