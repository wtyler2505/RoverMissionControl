import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useWebSocket } from '../WebSocket';
import {
  HALDevice,
  HALActivity,
  HALSettings,
  HALStatistics,
  HALFilter,
  HALPermissions,
  HALNotification,
  SimulationProfile,
  FirmwareInfo,
  DiagnosticResult,
  CommunicationLog,
} from './types';

interface HALContextType {
  // State
  devices: HALDevice[];
  activities: HALActivity[];
  settings: HALSettings;
  statistics: HALStatistics;
  notifications: HALNotification[];
  permissions: HALPermissions;
  filter: HALFilter;
  selectedDevice: HALDevice | null;
  isLoading: boolean;
  isRefreshing: boolean;
  simulationProfile: SimulationProfile | null;

  // Device Management
  refreshDevices: () => Promise<void>;
  connectDevice: (deviceId: string) => Promise<void>;
  disconnectDevice: (deviceId: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  updateDevice: (deviceId: string, updates: Partial<HALDevice>) => Promise<void>;
  selectDevice: (device: HALDevice | null) => void;

  // Discovery
  startDiscovery: () => Promise<void>;
  stopDiscovery: () => Promise<void>;
  isDiscovering: boolean;

  // Diagnostics
  runDiagnostics: (deviceId: string) => Promise<DiagnosticResult>;
  getDiagnosticHistory: (deviceId: string) => Promise<DiagnosticResult[]>;

  // Firmware
  checkFirmwareUpdates: (deviceId: string) => Promise<FirmwareInfo | null>;
  updateFirmware: (deviceId: string, firmwareId: string) => Promise<void>;
  firmwareProgress: Record<string, number>;

  // Communication
  sendCommand: (deviceId: string, command: any) => Promise<any>;
  getCommunicationLogs: (deviceId: string, limit?: number) => Promise<CommunicationLog[]>;

  // Simulation
  startSimulation: (profile: SimulationProfile) => Promise<void>;
  stopSimulation: () => Promise<void>;
  isSimulating: boolean;

  // Settings
  updateSettings: (settings: Partial<HALSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;

  // Filters
  setFilter: (filter: HALFilter) => void;
  clearFilter: () => void;

  // Notifications
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;

  // Export
  exportData: (options: any) => Promise<Blob>;
}

const defaultSettings: HALSettings = {
  autoDiscovery: true,
  discoveryInterval: 30,
  connectionTimeout: 5000,
  retryAttempts: 3,
  logLevel: 'info',
  enableSimulation: true,
  defaultProtocol: 'serial',
  notifications: {
    deviceConnection: true,
    firmwareUpdates: true,
    errors: true,
    diagnostics: true,
  },
  export: {
    format: 'json',
    includeRawData: false,
    compression: false,
  },
};

const defaultStatistics: HALStatistics = {
  totalDevices: 0,
  connectedDevices: 0,
  protocolBreakdown: {},
  typeBreakdown: {},
  healthSummary: {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
  },
  activitySummary: {
    last24Hours: 0,
    last7Days: 0,
    last30Days: 0,
  },
  performance: {
    averageLatency: 0,
    packetLoss: 0,
    throughput: 0,
    uptime: 0,
  },
};

const defaultPermissions: HALPermissions = {
  canViewDevices: true,
  canManageDevices: true,
  canRunDiagnostics: true,
  canUpdateFirmware: true,
  canViewLogs: true,
  canExportData: true,
  canManageSimulation: true,
  canChangeSettings: true,
};

const HALContext = createContext<HALContextType | undefined>(undefined);

export const useHALContext = () => {
  const context = useContext(HALContext);
  if (!context) {
    throw new Error('useHALContext must be used within a HALProvider');
  }
  return context;
};

interface HALProviderProps {
  children: ReactNode;
}

export const HALProvider: React.FC<HALProviderProps> = ({ children }) => {
  const { sendMessage, subscribe, unsubscribe } = useWebSocket();

  // State
  const [devices, setDevices] = useState<HALDevice[]>([]);
  const [activities, setActivities] = useState<HALActivity[]>([]);
  const [settings, setSettings] = useState<HALSettings>(defaultSettings);
  const [statistics, setStatistics] = useState<HALStatistics>(defaultStatistics);
  const [notifications, setNotifications] = useState<HALNotification[]>([]);
  const [permissions, setPermissions] = useState<HALPermissions>(defaultPermissions);
  const [filter, setFilter] = useState<HALFilter>({});
  const [selectedDevice, setSelectedDevice] = useState<HALDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationProfile, setSimulationProfile] = useState<SimulationProfile | null>(null);
  const [firmwareProgress, setFirmwareProgress] = useState<Record<string, number>>({});

  // Initialize
  useEffect(() => {
    loadInitialData();
    setupWebSocketSubscriptions();

    return () => {
      cleanupWebSocketSubscriptions();
    };
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Fetch initial data from API
      const [devicesRes, settingsRes, statsRes, permsRes] = await Promise.all([
        fetch('/api/hal/devices'),
        fetch('/api/hal/settings'),
        fetch('/api/hal/statistics'),
        fetch('/api/hal/permissions'),
      ]);

      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        setDevices(devicesData);
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistics(statsData);
      }

      if (permsRes.ok) {
        const permsData = await permsRes.json();
        setPermissions(permsData);
      }
    } catch (error) {
      console.error('Failed to load HAL data:', error);
      addNotification({
        type: 'system',
        severity: 'error',
        title: 'Initialization Error',
        message: 'Failed to load HAL data. Some features may be unavailable.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setupWebSocketSubscriptions = () => {
    // Subscribe to device events
    subscribe('hal:device:connected', handleDeviceConnected);
    subscribe('hal:device:disconnected', handleDeviceDisconnected);
    subscribe('hal:device:updated', handleDeviceUpdated);
    subscribe('hal:device:discovered', handleDeviceDiscovered);

    // Subscribe to activity events
    subscribe('hal:activity', handleActivity);

    // Subscribe to notification events
    subscribe('hal:notification', handleNotification);

    // Subscribe to statistics updates
    subscribe('hal:statistics', handleStatisticsUpdate);

    // Subscribe to firmware progress
    subscribe('hal:firmware:progress', handleFirmwareProgress);
  };

  const cleanupWebSocketSubscriptions = () => {
    unsubscribe('hal:device:connected', handleDeviceConnected);
    unsubscribe('hal:device:disconnected', handleDeviceDisconnected);
    unsubscribe('hal:device:updated', handleDeviceUpdated);
    unsubscribe('hal:device:discovered', handleDeviceDiscovered);
    unsubscribe('hal:activity', handleActivity);
    unsubscribe('hal:notification', handleNotification);
    unsubscribe('hal:statistics', handleStatisticsUpdate);
    unsubscribe('hal:firmware:progress', handleFirmwareProgress);
  };

  // WebSocket Event Handlers
  const handleDeviceConnected = (device: HALDevice) => {
    setDevices(prev => {
      const existing = prev.find(d => d.id === device.id);
      if (existing) {
        return prev.map(d => d.id === device.id ? { ...device, status: 'connected' } : d);
      }
      return [...prev, { ...device, status: 'connected' }];
    });
    addActivity({
      type: 'device_connected',
      deviceId: device.id,
      deviceName: device.name,
      message: `Device ${device.name} connected`,
      severity: 'success',
    });
  };

  const handleDeviceDisconnected = (deviceId: string) => {
    setDevices(prev => prev.map(d => 
      d.id === deviceId ? { ...d, status: 'disconnected' } : d
    ));
    const device = devices.find(d => d.id === deviceId);
    addActivity({
      type: 'device_disconnected',
      deviceId,
      deviceName: device?.name,
      message: `Device ${device?.name || deviceId} disconnected`,
      severity: 'warning',
    });
  };

  const handleDeviceUpdated = (update: Partial<HALDevice> & { id: string }) => {
    setDevices(prev => prev.map(d => 
      d.id === update.id ? { ...d, ...update } : d
    ));
  };

  const handleDeviceDiscovered = (device: HALDevice) => {
    addNotification({
      type: 'device',
      severity: 'info',
      title: 'New Device Discovered',
      message: `Found ${device.type} device: ${device.name}`,
      deviceId: device.id,
      actionRequired: true,
      actions: [
        { label: 'Connect', action: 'connect', primary: true },
        { label: 'Ignore', action: 'ignore' },
      ],
    });
  };

  const handleActivity = (activity: HALActivity) => {
    addActivity(activity);
  };

  const handleNotification = (notification: HALNotification) => {
    setNotifications(prev => [notification, ...prev]);
  };

  const handleStatisticsUpdate = (stats: Partial<HALStatistics>) => {
    setStatistics(prev => ({ ...prev, ...stats }));
  };

  const handleFirmwareProgress = (data: { deviceId: string; progress: number }) => {
    setFirmwareProgress(prev => ({ ...prev, [data.deviceId]: data.progress }));
    if (data.progress >= 100) {
      setTimeout(() => {
        setFirmwareProgress(prev => {
          const { [data.deviceId]: _, ...rest } = prev;
          return rest;
        });
      }, 2000);
    }
  };

  // Helper Functions
  const addActivity = (activity: Omit<HALActivity, 'id' | 'timestamp'>) => {
    const newActivity: HALActivity = {
      ...activity,
      id: `activity-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 100)); // Keep last 100
  };

  const addNotification = (notification: Omit<HALNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: HALNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  // API Methods
  const refreshDevices = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/hal/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Failed to refresh devices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const connectDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/hal/devices/${deviceId}/connect`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to connect device');
      }
    } catch (error) {
      console.error('Failed to connect device:', error);
      throw error;
    }
  };

  const disconnectDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/hal/devices/${deviceId}/disconnect`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to disconnect device');
      }
    } catch (error) {
      console.error('Failed to disconnect device:', error);
      throw error;
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/hal/devices/${deviceId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        if (selectedDevice?.id === deviceId) {
          setSelectedDevice(null);
        }
      }
    } catch (error) {
      console.error('Failed to remove device:', error);
      throw error;
    }
  };

  const updateDevice = async (deviceId: string, updates: Partial<HALDevice>) => {
    try {
      const response = await fetch(`/api/hal/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        throw new Error('Failed to update device');
      }
    } catch (error) {
      console.error('Failed to update device:', error);
      throw error;
    }
  };

  const selectDevice = (device: HALDevice | null) => {
    setSelectedDevice(device);
  };

  const startDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const response = await fetch('/api/hal/discovery/start', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to start discovery');
      }
    } catch (error) {
      console.error('Failed to start discovery:', error);
      setIsDiscovering(false);
      throw error;
    }
  };

  const stopDiscovery = async () => {
    try {
      const response = await fetch('/api/hal/discovery/stop', {
        method: 'POST',
      });
      if (response.ok) {
        setIsDiscovering(false);
      }
    } catch (error) {
      console.error('Failed to stop discovery:', error);
    }
  };

  const runDiagnostics = async (deviceId: string): Promise<DiagnosticResult> => {
    const response = await fetch(`/api/hal/devices/${deviceId}/diagnostics`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to run diagnostics');
    }
    return response.json();
  };

  const getDiagnosticHistory = async (deviceId: string): Promise<DiagnosticResult[]> => {
    const response = await fetch(`/api/hal/devices/${deviceId}/diagnostics/history`);
    if (!response.ok) {
      throw new Error('Failed to get diagnostic history');
    }
    return response.json();
  };

  const checkFirmwareUpdates = async (deviceId: string): Promise<FirmwareInfo | null> => {
    const response = await fetch(`/api/hal/devices/${deviceId}/firmware/check`);
    if (!response.ok) {
      throw new Error('Failed to check firmware updates');
    }
    const data = await response.json();
    return data.available ? data.firmware : null;
  };

  const updateFirmware = async (deviceId: string, firmwareId: string) => {
    const response = await fetch(`/api/hal/devices/${deviceId}/firmware/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firmwareId }),
    });
    if (!response.ok) {
      throw new Error('Failed to update firmware');
    }
  };

  const sendCommand = async (deviceId: string, command: any): Promise<any> => {
    const response = await fetch(`/api/hal/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      throw new Error('Failed to send command');
    }
    return response.json();
  };

  const getCommunicationLogs = async (deviceId: string, limit: number = 100): Promise<CommunicationLog[]> => {
    const response = await fetch(`/api/hal/devices/${deviceId}/logs?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to get communication logs');
    }
    return response.json();
  };

  const startSimulation = async (profile: SimulationProfile) => {
    setIsSimulating(true);
    setSimulationProfile(profile);
    try {
      const response = await fetch('/api/hal/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!response.ok) {
        throw new Error('Failed to start simulation');
      }
    } catch (error) {
      console.error('Failed to start simulation:', error);
      setIsSimulating(false);
      setSimulationProfile(null);
      throw error;
    }
  };

  const stopSimulation = async () => {
    try {
      const response = await fetch('/api/hal/simulation/stop', {
        method: 'POST',
      });
      if (response.ok) {
        setIsSimulating(false);
        setSimulationProfile(null);
      }
    } catch (error) {
      console.error('Failed to stop simulation:', error);
    }
  };

  const updateSettings = async (updates: Partial<HALSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      const response = await fetch('/api/hal/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      // Rollback on error
      setSettings(settings);
      throw error;
    }
  };

  const resetSettings = async () => {
    setSettings(defaultSettings);
    try {
      const response = await fetch('/api/hal/settings/reset', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }
    } catch (error) {
      console.error('Failed to reset settings:', error);
      throw error;
    }
  };

  const clearFilter = () => {
    setFilter({});
  };

  const markNotificationRead = (notificationId: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    ));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const exportData = async (options: any): Promise<Blob> => {
    const response = await fetch('/api/hal/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!response.ok) {
      throw new Error('Failed to export data');
    }
    return response.blob();
  };

  const value: HALContextType = {
    // State
    devices,
    activities,
    settings,
    statistics,
    notifications,
    permissions,
    filter,
    selectedDevice,
    isLoading,
    isRefreshing,
    simulationProfile,

    // Device Management
    refreshDevices,
    connectDevice,
    disconnectDevice,
    removeDevice,
    updateDevice,
    selectDevice,

    // Discovery
    startDiscovery,
    stopDiscovery,
    isDiscovering,

    // Diagnostics
    runDiagnostics,
    getDiagnosticHistory,

    // Firmware
    checkFirmwareUpdates,
    updateFirmware,
    firmwareProgress,

    // Communication
    sendCommand,
    getCommunicationLogs,

    // Simulation
    startSimulation,
    stopSimulation,
    isSimulating,

    // Settings
    updateSettings,
    resetSettings,

    // Filters
    setFilter,
    clearFilter,

    // Notifications
    markNotificationRead,
    clearNotifications,

    // Export
    exportData,
  };

  return <HALContext.Provider value={value}>{children}</HALContext.Provider>;
};

export default HALProvider;