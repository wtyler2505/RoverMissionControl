/**
 * Test Data Fixtures for E2E Tests
 * 
 * Provides consistent test data for HAL components and rover control workflows.
 * Includes device definitions, telemetry data, commands, and user scenarios.
 */

export interface TestDevice {
  id: string;
  name: string;
  type: 'rover' | 'sensor' | 'camera' | 'actuator' | 'communication';
  status: 'connected' | 'disconnected' | 'error';
  connectionType: 'serial' | 'wifi' | 'bluetooth' | 'usb' | 'can';
  connectionParams: Record<string, any>;
  firmwareVersion: string;
  hardwareVersion: string;
  capabilities: string[];
  lastSeen: string;
  telemetryMetrics?: string[];
}

export interface TestTelemetryData {
  deviceId: string;
  metric: string;
  value: number;
  unit: string;
  timestamp: string;
  quality: 'good' | 'poor' | 'bad';
}

export interface TestCommand {
  id: string;
  deviceId: string;
  type: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface TestUser {
  username: string;
  password: string;
  role: 'admin' | 'operator' | 'viewer';
  email: string;
  permissions: string[];
}

/**
 * Test Devices
 */
export const testDevices: TestDevice[] = [
  {
    id: 'arduino_rover_01',
    name: 'Main Rover Controller',
    type: 'rover',
    status: 'connected',
    connectionType: 'serial',
    connectionParams: {
      port: 'COM3',
      baudrate: 115200,
      timeout: 5000
    },
    firmwareVersion: '1.2.3',
    hardwareVersion: '2.0.0',
    capabilities: ['navigation', 'motor_control', 'battery_monitor'],
    lastSeen: new Date().toISOString(),
    telemetryMetrics: ['battery_voltage', 'motor_current', 'position_x', 'position_y', 'heading']
  },
  {
    id: 'esp32_sensor_01',
    name: 'Environmental Sensor Array',
    type: 'sensor',
    status: 'connected',
    connectionType: 'wifi',
    connectionParams: {
      ip: '192.168.1.100',
      port: 80,
      protocol: 'http'
    },
    firmwareVersion: '2.1.0',
    hardwareVersion: '1.5.0',
    capabilities: ['temperature', 'humidity', 'pressure', 'light'],
    lastSeen: new Date(Date.now() - 30000).toISOString(),
    telemetryMetrics: ['temperature', 'humidity', 'pressure', 'light_level']
  },
  {
    id: 'camera_module_01',
    name: 'Navigation Camera',
    type: 'camera',
    status: 'disconnected',
    connectionType: 'usb',
    connectionParams: {
      device_path: '/dev/video0',
      resolution: '1920x1080',
      fps: 30
    },
    firmwareVersion: '1.0.5',
    hardwareVersion: '1.0.0',
    capabilities: ['video_stream', 'image_capture', 'night_vision'],
    lastSeen: new Date(Date.now() - 300000).toISOString(),
    telemetryMetrics: ['frame_rate', 'exposure', 'focus']
  },
  {
    id: 'arm_actuator_01',
    name: 'Robotic Arm Controller',
    type: 'actuator',
    status: 'error',
    connectionType: 'can',
    connectionParams: {
      bus_id: 'can0',
      node_id: 10,
      bitrate: 500000
    },
    firmwareVersion: '3.0.1',
    hardwareVersion: '2.2.0',
    capabilities: ['joint_control', 'force_feedback', 'position_sensing'],
    lastSeen: new Date(Date.now() - 600000).toISOString(),
    telemetryMetrics: ['joint_angles', 'torque', 'temperature']
  },
  {
    id: 'radio_comm_01',
    name: 'Long Range Communication',
    type: 'communication',
    status: 'connected',
    connectionType: 'serial',
    connectionParams: {
      port: 'COM4',
      baudrate: 57600,
      protocol: 'lora'
    },
    firmwareVersion: '1.1.2',
    hardwareVersion: '1.3.0',
    capabilities: ['long_range', 'mesh_network', 'encryption'],
    lastSeen: new Date(Date.now() - 5000).toISOString(),
    telemetryMetrics: ['signal_strength', 'packet_loss', 'data_rate']
  }
];

/**
 * Test Users
 */
export const testUsers: TestUser[] = [
  {
    username: 'admin',
    password: 'Admin@123',
    role: 'admin',
    email: 'admin@rover.mission',
    permissions: ['*'] // All permissions
  },
  {
    username: 'operator',
    password: 'Operator@123',
    role: 'operator',
    email: 'operator@rover.mission',
    permissions: ['device_control', 'telemetry_view', 'command_execute']
  },
  {
    username: 'viewer',
    password: 'Viewer@123',
    role: 'viewer',
    email: 'viewer@rover.mission',
    permissions: ['telemetry_view', 'device_view']
  }
];

/**
 * Generate test telemetry data
 */
export function generateTelemetryData(
  deviceId: string, 
  metrics: string[], 
  duration: number = 3600000, // 1 hour
  interval: number = 1000 // 1 second
): TestTelemetryData[] {
  const data: TestTelemetryData[] = [];
  const now = Date.now();
  const count = Math.floor(duration / interval);

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * interval).toISOString();
    
    for (const metric of metrics) {
      data.push({
        deviceId,
        metric,
        value: generateMetricValue(metric, i),
        unit: getMetricUnit(metric),
        timestamp,
        quality: Math.random() > 0.1 ? 'good' : Math.random() > 0.5 ? 'poor' : 'bad'
      });
    }
  }

  return data;
}

/**
 * Generate realistic metric values
 */
function generateMetricValue(metric: string, index: number): number {
  const baseValue = getBaseMetricValue(metric);
  const variation = getMetricVariation(metric);
  const noise = (Math.random() - 0.5) * variation;
  const trend = getTrendValue(metric, index);
  
  return Math.round((baseValue + noise + trend) * 100) / 100;
}

/**
 * Get base values for different metrics
 */
function getBaseMetricValue(metric: string): number {
  const baseValues: Record<string, number> = {
    battery_voltage: 12.0,
    motor_current: 1.5,
    position_x: 0,
    position_y: 0,
    heading: 0,
    temperature: 25.0,
    humidity: 50.0,
    pressure: 1013.25,
    light_level: 500,
    frame_rate: 30,
    exposure: 100,
    focus: 50,
    joint_angles: 0,
    torque: 5.0,
    signal_strength: -70,
    packet_loss: 0.1,
    data_rate: 1000
  };
  
  return baseValues[metric] || 0;
}

/**
 * Get variation ranges for metrics
 */
function getMetricVariation(metric: string): number {
  const variations: Record<string, number> = {
    battery_voltage: 1.0,
    motor_current: 0.5,
    position_x: 10,
    position_y: 10,
    heading: 5,
    temperature: 5.0,
    humidity: 10.0,
    pressure: 5.0,
    light_level: 100,
    frame_rate: 2,
    exposure: 20,
    focus: 10,
    joint_angles: 10,
    torque: 2.0,
    signal_strength: 10,
    packet_loss: 0.2,
    data_rate: 200
  };
  
  return variations[metric] || 1.0;
}

/**
 * Get trend values to simulate realistic changes over time
 */
function getTrendValue(metric: string, index: number): number {
  switch (metric) {
    case 'battery_voltage':
      return -0.0001 * index; // Slow discharge
    case 'temperature':
      return Math.sin(index * 0.01) * 2; // Cyclic variation
    case 'position_x':
      return Math.sin(index * 0.001) * 50; // Movement pattern
    case 'position_y':
      return Math.cos(index * 0.001) * 50; // Movement pattern
    default:
      return 0;
  }
}

/**
 * Get units for different metrics
 */
function getMetricUnit(metric: string): string {
  const units: Record<string, string> = {
    battery_voltage: 'V',
    motor_current: 'A',
    position_x: 'm',
    position_y: 'm',
    heading: '°',
    temperature: '°C',
    humidity: '%',
    pressure: 'hPa',
    light_level: 'lux',
    frame_rate: 'fps',
    exposure: 'ms',
    focus: '%',
    joint_angles: '°',
    torque: 'Nm',
    signal_strength: 'dBm',
    packet_loss: '%',
    data_rate: 'bps'
  };
  
  return units[metric] || '';
}

/**
 * Generate test commands
 */
export function generateTestCommands(deviceIds: string[]): TestCommand[] {
  const commands: TestCommand[] = [];
  const commandTypes = {
    rover: ['move', 'stop', 'rotate', 'set_speed'],
    sensor: ['calibrate', 'set_interval', 'reset'],
    camera: ['start_stream', 'capture_image', 'set_resolution'],
    actuator: ['move_to_position', 'set_torque', 'home'],
    communication: ['set_channel', 'send_message', 'configure']
  };

  deviceIds.forEach((deviceId, index) => {
    const device = testDevices.find(d => d.id === deviceId);
    if (!device) return;

    const availableCommands = commandTypes[device.type] || ['ping'];
    const commandType = availableCommands[index % availableCommands.length];

    commands.push({
      id: `cmd_${index + 1}`,
      deviceId,
      type: commandType,
      parameters: generateCommandParameters(commandType),
      status: ['pending', 'executing', 'completed', 'failed'][index % 4] as any,
      createdAt: new Date(Date.now() - index * 60000).toISOString(),
      executedAt: index % 4 !== 0 ? new Date(Date.now() - index * 60000 + 5000).toISOString() : undefined,
      completedAt: index % 4 === 2 ? new Date(Date.now() - index * 60000 + 10000).toISOString() : undefined,
      error: index % 4 === 3 ? 'Command execution failed: Device timeout' : undefined
    });
  });

  return commands;
}

/**
 * Generate parameters for different command types
 */
function generateCommandParameters(commandType: string): Record<string, any> {
  const parameterMap: Record<string, Record<string, any>> = {
    move: { direction: 'forward', distance: 10, speed: 50 },
    stop: {},
    rotate: { angle: 90, speed: 30 },
    set_speed: { speed: 75 },
    calibrate: { sensor_type: 'temperature' },
    set_interval: { interval: 1000 },
    reset: {},
    start_stream: { resolution: '1920x1080', fps: 30 },
    capture_image: { format: 'jpeg', quality: 95 },
    set_resolution: { width: 1920, height: 1080 },
    move_to_position: { x: 100, y: 50, z: 25 },
    set_torque: { torque: 10.5 },
    home: {},
    set_channel: { channel: 5, frequency: 433.92 },
    send_message: { message: 'Status update', priority: 'normal' },
    configure: { parameter: 'transmission_power', value: 20 },
    ping: { timeout: 5000 }
  };

  return parameterMap[commandType] || {};
}

/**
 * Scenario definitions for E2E testing
 */
export const testScenarios = {
  deviceDiscovery: {
    name: 'Device Discovery and Registration',
    description: 'Test complete device discovery workflow',
    steps: [
      'Navigate to device discovery',
      'Start device scan',
      'Verify discovered devices',
      'Register new device',
      'Test device connection',
      'Verify device in active list'
    ]
  },
  
  telemetryMonitoring: {
    name: 'Real-time Telemetry Monitoring',
    description: 'Test telemetry data streaming and visualization',
    steps: [
      'Navigate to telemetry dashboard',
      'Select device for monitoring',
      'Verify real-time data updates',
      'Test data filtering and search',
      'Export telemetry data',
      'Verify export file'
    ]
  },
  
  commandExecution: {
    name: 'Command Execution Workflow',
    description: 'Test device command execution and monitoring',
    steps: [
      'Navigate to device control',
      'Select target device',
      'Send movement command',
      'Monitor command progress',
      'Verify command completion',
      'Check command history'
    ]
  },

  firmwareUpdate: {
    name: 'Firmware Update Process',
    description: 'Test firmware update workflow',
    steps: [
      'Navigate to firmware management',
      'Check for updates',
      'Select device for update',
      'Upload firmware file',
      'Monitor update progress',
      'Verify update completion'
    ]
  },

  emergencyStop: {
    name: 'Emergency Stop Procedure',
    description: 'Test emergency stop functionality',
    steps: [
      'Start rover movement',
      'Trigger emergency stop',
      'Verify immediate stop',
      'Check system status',
      'Reset emergency state',
      'Resume normal operation'
    ]
  },

  multiUserAccess: {
    name: 'Multi-user Access Control',
    description: 'Test role-based access control',
    steps: [
      'Login as admin user',
      'Verify admin privileges',
      'Switch to operator user',
      'Test operator limitations',
      'Switch to viewer user',
      'Verify read-only access'
    ]
  }
};

/**
 * Mock WebSocket messages for testing
 */
export const mockWebSocketMessages = {
  deviceConnected: (deviceId: string) => ({
    type: 'device_status',
    device_id: deviceId,
    status: 'connected',
    timestamp: new Date().toISOString()
  }),

  deviceDisconnected: (deviceId: string) => ({
    type: 'device_status',
    device_id: deviceId,
    status: 'disconnected',
    timestamp: new Date().toISOString()
  }),

  telemetryUpdate: (deviceId: string, metrics: Record<string, number>) => ({
    type: 'telemetry',
    device_id: deviceId,
    data: metrics,
    timestamp: new Date().toISOString()
  }),

  commandStatus: (commandId: string, status: string, result?: any) => ({
    type: 'command_status',
    command_id: commandId,
    status,
    result,
    timestamp: new Date().toISOString()
  }),

  systemAlert: (level: 'info' | 'warning' | 'error', message: string) => ({
    type: 'system_alert',
    level,
    message,
    timestamp: new Date().toISOString()
  })
};

/**
 * API response mocks
 */
export const mockAPIResponses = {
  devices: {
    list: testDevices,
    get: (deviceId: string) => testDevices.find(d => d.id === deviceId),
    create: (device: Partial<TestDevice>) => ({ ...device, id: `device_${Date.now()}` }),
    update: (deviceId: string, updates: Partial<TestDevice>) => ({ ...testDevices.find(d => d.id === deviceId), ...updates }),
    delete: (deviceId: string) => ({ success: true, deviceId })
  },

  telemetry: {
    latest: (deviceId: string) => generateTelemetryData(deviceId, testDevices.find(d => d.id === deviceId)?.telemetryMetrics || [], 60000, 1000),
    historical: (deviceId: string, from: string, to: string) => generateTelemetryData(deviceId, testDevices.find(d => d.id === deviceId)?.telemetryMetrics || [], 3600000, 5000)
  },

  commands: {
    list: generateTestCommands(testDevices.map(d => d.id)),
    execute: (deviceId: string, commandType: string, parameters: any) => ({
      id: `cmd_${Date.now()}`,
      deviceId,
      type: commandType,
      parameters,
      status: 'pending',
      createdAt: new Date().toISOString()
    })
  },

  auth: {
    login: (username: string, password: string) => {
      const user = testUsers.find(u => u.username === username && u.password === password);
      return user ? {
        token: `jwt_token_${username}_${Date.now()}`,
        user: { ...user, password: undefined }
      } : null;
    },
    verify: (token: string) => ({ valid: true, user: testUsers[0] })
  }
};

/**
 * Performance test data
 */
export const performanceTestData = {
  highVolumeDevices: Array.from({ length: 100 }, (_, i) => ({
    ...testDevices[0],
    id: `device_${i}`,
    name: `Test Device ${i}`
  })),

  highFrequencyTelemetry: (deviceId: string) => 
    generateTelemetryData(deviceId, ['metric1', 'metric2', 'metric3'], 60000, 100), // 10Hz for 1 minute

  bulkCommands: Array.from({ length: 50 }, (_, i) => ({
    id: `bulk_cmd_${i}`,
    deviceId: `device_${i % 5}`,
    type: 'ping',
    parameters: {},
    status: 'pending' as const,
    createdAt: new Date().toISOString()
  }))
};

/**
 * Error simulation data
 */
export const errorScenarios = {
  networkTimeout: { type: 'network', delay: 30000 },
  deviceUnresponsive: { type: 'device', deviceId: 'arduino_rover_01' },
  invalidCommand: { type: 'command', error: 'Invalid parameter format' },
  authenticationFailure: { type: 'auth', error: 'Token expired' },
  databaseError: { type: 'database', error: 'Connection lost' },
  firmwareCorruption: { type: 'firmware', error: 'Checksum mismatch' }
};