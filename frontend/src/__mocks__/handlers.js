import { http, HttpResponse } from 'msw';

// Mock API base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const handlers = [
  // Authentication endpoints
  http.post(`${API_BASE_URL}/auth/login`, () => {
    return HttpResponse.json({
      access_token: 'mock-jwt-token',
      token_type: 'bearer',
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      }
    });
  }),

  http.post(`${API_BASE_URL}/auth/logout`, () => {
    return HttpResponse.json({ message: 'Logged out successfully' });
  }),

  http.get(`${API_BASE_URL}/auth/me`, () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      role: 'user'
    });
  }),

  // HAL (Hardware Abstraction Layer) endpoints
  http.get(`${API_BASE_URL}/hal/devices`, () => {
    return HttpResponse.json([
      {
        id: 'device-1',
        name: 'Mock Device 1',
        type: 'sensor',
        status: 'connected',
        lastSeen: new Date().toISOString(),
        capabilities: ['temperature', 'humidity'],
        metadata: {
          version: '1.0.0',
          manufacturer: 'Test Corp'
        }
      },
      {
        id: 'device-2',
        name: 'Mock Device 2',
        type: 'actuator',
        status: 'disconnected',
        lastSeen: new Date(Date.now() - 60000).toISOString(),
        capabilities: ['move', 'rotate'],
        metadata: {
          version: '2.1.0',
          manufacturer: 'Test Corp'
        }
      }
    ]);
  }),

  http.get(`${API_BASE_URL}/hal/devices/:deviceId`, ({ params }) => {
    const { deviceId } = params;
    return HttpResponse.json({
      id: deviceId,
      name: `Mock Device ${deviceId}`,
      type: 'sensor',
      status: 'connected',
      lastSeen: new Date().toISOString(),
      capabilities: ['temperature', 'humidity'],
      metadata: {
        version: '1.0.0',
        manufacturer: 'Test Corp'
      },
      telemetry: {
        temperature: 23.5,
        humidity: 45.2,
        timestamp: new Date().toISOString()
      }
    });
  }),

  http.post(`${API_BASE_URL}/hal/devices/:deviceId/command`, () => {
    return HttpResponse.json({
      commandId: 'cmd-123',
      status: 'queued',
      timestamp: new Date().toISOString()
    });
  }),

  // Telemetry endpoints
  http.get(`${API_BASE_URL}/telemetry/streams`, () => {
    return HttpResponse.json([
      {
        id: 'temp-stream',
        name: 'Temperature Stream',
        type: 'temperature',
        unit: '°C',
        active: true,
        lastUpdate: new Date().toISOString()
      },
      {
        id: 'position-stream',
        name: 'Position Stream',
        type: 'position',
        unit: 'm',
        active: true,
        lastUpdate: new Date().toISOString()
      }
    ]);
  }),

  http.get(`${API_BASE_URL}/telemetry/historical`, ({ request }) => {
    const url = new URL(request.url);
    const stream = url.searchParams.get('stream');
    const startTime = url.searchParams.get('start_time');
    const endTime = url.searchParams.get('end_time');
    
    // Generate mock historical data
    const data = [];
    const start = new Date(startTime || Date.now() - 3600000); // 1 hour ago
    const end = new Date(endTime || Date.now());
    const interval = (end - start) / 100; // 100 data points
    
    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(start.getTime() + (i * interval));
      data.push({
        timestamp: timestamp.toISOString(),
        value: Math.random() * 100,
        stream: stream || 'temp-stream'
      });
    }
    
    return HttpResponse.json({ data });
  }),

  // Command queue endpoints
  http.get(`${API_BASE_URL}/commands/queue`, () => {
    return HttpResponse.json([
      {
        id: 'cmd-1',
        command: 'MOVE_FORWARD',
        parameters: { distance: 10 },
        status: 'pending',
        priority: 'high',
        createdAt: new Date().toISOString(),
        deviceId: 'device-1'
      },
      {
        id: 'cmd-2',
        command: 'ROTATE',
        parameters: { angle: 90 },
        status: 'executing',
        priority: 'medium',
        createdAt: new Date(Date.now() - 30000).toISOString(),
        deviceId: 'device-2'
      }
    ]);
  }),

  http.post(`${API_BASE_URL}/commands`, () => {
    return HttpResponse.json({
      id: 'cmd-new',
      status: 'queued',
      timestamp: new Date().toISOString()
    });
  }),

  http.delete(`${API_BASE_URL}/commands/:commandId`, ({ params }) => {
    return HttpResponse.json({
      id: params.commandId,
      status: 'cancelled',
      timestamp: new Date().toISOString()
    });
  }),

  // Simulation endpoints
  http.get(`${API_BASE_URL}/simulation/status`, () => {
    return HttpResponse.json({
      is_running: true,
      start_time: new Date(Date.now() - 3600000).toISOString(),
      metrics: {
        total_messages: 1250,
        error_count: 3,
        uptime: 3600,
        active_devices: 5
      }
    });
  }),

  http.post(`${API_BASE_URL}/simulation/start`, () => {
    return HttpResponse.json({
      status: 'started',
      timestamp: new Date().toISOString()
    });
  }),

  http.post(`${API_BASE_URL}/simulation/stop`, () => {
    return HttpResponse.json({
      status: 'stopped',
      timestamp: new Date().toISOString()
    });
  }),

  http.get(`${API_BASE_URL}/simulation/devices`, () => {
    return HttpResponse.json([
      {
        id: 'sim-device-1',
        name: 'Simulated Rover',
        type: 'rover',
        status: 'active',
        config: {
          speed: 1.0,
          battery: 85,
          position: { x: 10, y: 20, z: 0 }
        }
      }
    ]);
  }),

  http.get(`${API_BASE_URL}/simulation/scenarios`, () => {
    return HttpResponse.json([
      {
        id: 'scenario-1',
        name: 'Basic Navigation',
        description: 'Simple navigation scenario',
        duration: 300,
        status: 'available'
      },
      {
        id: 'scenario-2',
        name: 'Emergency Stop',
        description: 'Emergency procedures test',
        duration: 60,
        status: 'available'
      }
    ]);
  }),

  // Firmware management endpoints
  http.get(`${API_BASE_URL}/firmware/status`, () => {
    return HttpResponse.json({
      current_version: '1.2.3',
      available_updates: [
        {
          version: '1.2.4',
          release_date: '2024-01-15',
          changelog: 'Bug fixes and performance improvements'
        }
      ],
      last_check: new Date().toISOString()
    });
  }),

  http.post(`${API_BASE_URL}/firmware/upload`, () => {
    return HttpResponse.json({
      upload_id: 'upload-123',
      status: 'processing',
      timestamp: new Date().toISOString()
    });
  }),

  // Hardware discovery endpoints
  http.get(`${API_BASE_URL}/discovery/scan`, () => {
    return HttpResponse.json({
      scan_id: 'scan-123',
      status: 'running',
      progress: 45,
      devices_found: 3
    });
  }),

  http.post(`${API_BASE_URL}/discovery/register`, () => {
    return HttpResponse.json({
      device_id: 'new-device-123',
      status: 'registered',
      timestamp: new Date().toISOString()
    });
  }),

  // Performance monitoring endpoints
  http.get(`${API_BASE_URL}/performance/metrics`, () => {
    return HttpResponse.json({
      cpu_usage: 45.2,
      memory_usage: 67.8,
      network_latency: 12.5,
      disk_usage: 34.1,
      timestamp: new Date().toISOString()
    });
  }),

  // Error handling - Generic error response
  http.get(`${API_BASE_URL}/error`, () => {
    return HttpResponse.json(
      { error: 'Internal server error', code: 500 },
      { status: 500 }
    );
  }),

  // Catch-all handler for unmatched requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      { error: 'Not found', message: `No handler for ${request.method} ${request.url}` },
      { status: 404 }
    );
  })
];