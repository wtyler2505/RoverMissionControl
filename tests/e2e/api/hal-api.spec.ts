import { test, expect } from '@playwright/test';
import { testDevices, testUsers, mockAPIResponses } from '../fixtures/test-data';

/**
 * HAL API Integration Tests
 * 
 * Tests the Hardware Abstraction Layer API endpoints
 * using Playwright's API testing capabilities.
 */

test.describe('HAL API Tests', () => {
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000';
  let authToken: string;

  test.beforeAll(async ({ request }) => {
    // Authenticate and get token
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: {
        username: testUsers[0].username,
        password: testUsers[0].password
      }
    });

    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;
  });

  test.describe('Device Management API', () => {
    test('should list all devices', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const devices = await response.json();
      expect(Array.isArray(devices)).toBeTruthy();
      
      // Verify device structure
      if (devices.length > 0) {
        const device = devices[0];
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('status');
        expect(device).toHaveProperty('connectionType');
      }
    });

    test('should get specific device details', async ({ request }) => {
      const deviceId = testDevices[0].id;
      
      const response = await request.get(`${API_BASE}/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const device = await response.json();
      expect(device.id).toBe(deviceId);
      expect(device).toHaveProperty('name');
      expect(device).toHaveProperty('type');
      expect(device).toHaveProperty('connectionParams');
      expect(device).toHaveProperty('capabilities');
    });

    test('should create new device', async ({ request }) => {
      const newDevice = {
        name: 'API Test Device',
        type: 'sensor',
        connectionType: 'wifi',
        connectionParams: {
          ip: '192.168.1.201',
          port: 8080
        },
        capabilities: ['temperature', 'humidity']
      };

      const response = await request.post(`${API_BASE}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: newDevice
      });

      expect(response.ok()).toBeTruthy();
      
      const createdDevice = await response.json();
      expect(createdDevice).toHaveProperty('id');
      expect(createdDevice.name).toBe(newDevice.name);
      expect(createdDevice.type).toBe(newDevice.type);
    });

    test('should update device configuration', async ({ request }) => {
      const deviceId = testDevices[0].id;
      const updateData = {
        name: 'Updated Device Name',
        connectionParams: {
          ...testDevices[0].connectionParams,
          timeout: 10000
        }
      };

      const response = await request.put(`${API_BASE}/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: updateData
      });

      expect(response.ok()).toBeTruthy();
      
      const updatedDevice = await response.json();
      expect(updatedDevice.name).toBe(updateData.name);
      expect(updatedDevice.connectionParams.timeout).toBe(10000);
    });

    test('should delete device', async ({ request }) => {
      // First create a device to delete
      const deviceToDelete = {
        name: 'Device To Delete',
        type: 'test',
        connectionType: 'mock',
        connectionParams: {}
      };

      const createResponse = await request.post(`${API_BASE}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: deviceToDelete
      });

      const createdDevice = await createResponse.json();
      const deviceId = createdDevice.id;

      // Now delete it
      const deleteResponse = await request.delete(`${API_BASE}/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(deleteResponse.ok()).toBeTruthy();

      // Verify it's gone
      const getResponse = await request.get(`${API_BASE}/api/devices/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(getResponse.status()).toBe(404);
    });

    test('should handle device not found', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices/nonexistent-device`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(404);
      
      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.error.toLowerCase()).toContain('not found');
    });
  });

  test.describe('Device Discovery API', () => {
    test('should start device scan', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/devices/scan`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('scanId');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('started');
    });

    test('should get scan status', async ({ request }) => {
      // Start a scan first
      const scanResponse = await request.post(`${API_BASE}/api/devices/scan`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const scanResult = await scanResponse.json();
      const scanId = scanResult.scanId;

      // Get scan status
      const statusResponse = await request.get(`${API_BASE}/api/devices/scan/${scanId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(statusResponse.ok()).toBeTruthy();
      
      const status = await statusResponse.json();
      expect(status).toHaveProperty('scanId');
      expect(status).toHaveProperty('status');
      expect(['started', 'running', 'completed', 'failed']).toContain(status.status);
    });

    test('should get discovered devices', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices/discovered`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const discoveredDevices = await response.json();
      expect(Array.isArray(discoveredDevices)).toBeTruthy();
      
      // Check structure of discovered devices
      if (discoveredDevices.length > 0) {
        const device = discoveredDevices[0];
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('discoveredAt');
        expect(device).toHaveProperty('registered');
      }
    });

    test('should register discovered device', async ({ request }) => {
      // Get discovered devices first
      const discoveredResponse = await request.get(`${API_BASE}/api/devices/discovered`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const discoveredDevices = await discoveredResponse.json();
      
      if (discoveredDevices.length > 0) {
        const deviceToRegister = discoveredDevices.find(d => !d.registered);
        
        if (deviceToRegister) {
          const registerResponse = await request.post(`${API_BASE}/api/devices/register`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            data: {
              discoveredDeviceId: deviceToRegister.id,
              name: deviceToRegister.name || 'Registered Device',
              configuration: {}
            }
          });

          expect(registerResponse.ok()).toBeTruthy();
          
          const registeredDevice = await registerResponse.json();
          expect(registeredDevice).toHaveProperty('id');
          expect(registeredDevice).toHaveProperty('registered');
          expect(registeredDevice.registered).toBe(true);
        }
      }
    });
  });

  test.describe('Telemetry API', () => {
    test('should get latest telemetry for device', async ({ request }) => {
      const deviceId = testDevices[0].id;
      
      const response = await request.get(`${API_BASE}/api/telemetry/${deviceId}/latest`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const telemetryData = await response.json();
      expect(Array.isArray(telemetryData)).toBeTruthy();
      
      if (telemetryData.length > 0) {
        const dataPoint = telemetryData[0];
        expect(dataPoint).toHaveProperty('deviceId');
        expect(dataPoint).toHaveProperty('metric');
        expect(dataPoint).toHaveProperty('value');
        expect(dataPoint).toHaveProperty('unit');
        expect(dataPoint).toHaveProperty('timestamp');
      }
    });

    test('should get historical telemetry data', async ({ request }) => {
      const deviceId = testDevices[0].id;
      const fromTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      const toTime = new Date().toISOString();
      
      const response = await request.get(`${API_BASE}/api/telemetry/${deviceId}/historical`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          from: fromTime,
          to: toTime,
          metrics: 'battery_voltage,motor_current'
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const historicalData = await response.json();
      expect(Array.isArray(historicalData)).toBeTruthy();
      
      // Verify data is within time range
      for (const dataPoint of historicalData.slice(0, 10)) {
        const timestamp = new Date(dataPoint.timestamp);
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(fromTime).getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(new Date(toTime).getTime());
      }
    });

    test('should get telemetry statistics', async ({ request }) => {
      const deviceId = testDevices[0].id;
      
      const response = await request.get(`${API_BASE}/api/telemetry/${deviceId}/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          metric: 'battery_voltage',
          period: '1h'
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const stats = await response.json();
      expect(stats).toHaveProperty('metric');
      expect(stats).toHaveProperty('period');
      expect(stats).toHaveProperty('min');
      expect(stats).toHaveProperty('max');
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('count');
    });
  });

  test.describe('Command API', () => {
    test('should send command to device', async ({ request }) => {
      const deviceId = testDevices[0].id;
      const command = {
        type: 'ping',
        parameters: {
          timeout: 5000
        }
      };

      const response = await request.post(`${API_BASE}/api/commands/${deviceId}/execute`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: command
      });

      expect(response.ok()).toBeTruthy();
      
      const result = await response.json();
      expect(result).toHaveProperty('commandId');
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('pending');
    });

    test('should get command status', async ({ request }) => {
      const deviceId = testDevices[0].id;
      
      // Send a command first
      const commandResponse = await request.post(`${API_BASE}/api/commands/${deviceId}/execute`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          type: 'status',
          parameters: {}
        }
      });

      const commandResult = await commandResponse.json();
      const commandId = commandResult.commandId;

      // Get command status
      const statusResponse = await request.get(`${API_BASE}/api/commands/${commandId}/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(statusResponse.ok()).toBeTruthy();
      
      const status = await statusResponse.json();
      expect(status).toHaveProperty('commandId');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('createdAt');
    });

    test('should cancel pending command', async ({ request }) => {
      const deviceId = testDevices[0].id;
      
      // Send a long-running command
      const commandResponse = await request.post(`${API_BASE}/api/commands/${deviceId}/execute`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          type: 'move',
          parameters: {
            direction: 'forward',
            distance: 100,
            speed: 10 // Slow speed for long execution
          }
        }
      });

      const commandResult = await commandResponse.json();
      const commandId = commandResult.commandId;

      // Cancel the command
      const cancelResponse = await request.post(`${API_BASE}/api/commands/${commandId}/cancel`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(cancelResponse.ok()).toBeTruthy();
      
      const cancelResult = await cancelResponse.json();
      expect(cancelResult).toHaveProperty('status');
      expect(cancelResult.status).toBe('cancelled');
    });

    test('should get command history', async ({ request }) => {
      const deviceId = testDevices[0].id;
      
      const response = await request.get(`${API_BASE}/api/commands/${deviceId}/history`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        params: {
          limit: '10',
          offset: '0'
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const history = await response.json();
      expect(Array.isArray(history)).toBeTruthy();
      
      if (history.length > 0) {
        const command = history[0];
        expect(command).toHaveProperty('commandId');
        expect(command).toHaveProperty('type');
        expect(command).toHaveProperty('status');
        expect(command).toHaveProperty('createdAt');
      }
    });
  });

  test.describe('System Status API', () => {
    test('should get system health status', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/system/health`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const health = await response.json();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('components');
      expect(['healthy', 'warning', 'critical']).toContain(health.status);
    });

    test('should get system statistics', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/system/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const stats = await response.json();
      expect(stats).toHaveProperty('totalDevices');
      expect(stats).toHaveProperty('activeDevices');
      expect(stats).toHaveProperty('pendingCommands');
      expect(stats).toHaveProperty('systemUptime');
      expect(stats).toHaveProperty('lastScanTime');
    });

    test('should get system alerts', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/system/alerts`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.ok()).toBeTruthy();
      
      const alerts = await response.json();
      expect(Array.isArray(alerts)).toBeTruthy();
      
      if (alerts.length > 0) {
        const alert = alerts[0];
        expect(alert).toHaveProperty('id');
        expect(alert).toHaveProperty('level');
        expect(alert).toHaveProperty('message');
        expect(alert).toHaveProperty('timestamp');
        expect(['info', 'warning', 'error']).toContain(alert.level);
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle unauthorized requests', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices`);
      
      expect(response.status()).toBe(401);
      
      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error.error.toLowerCase()).toContain('unauthorized');
    });

    test('should handle invalid device ID', async ({ request }) => {
      const response = await request.get(`${API_BASE}/api/devices/invalid-device-id`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      expect(response.status()).toBe(404);
    });

    test('should handle malformed JSON', async ({ request }) => {
      const response = await request.post(`${API_BASE}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: '{ invalid json'
      });

      expect(response.status()).toBe(400);
    });

    test('should handle rate limiting', async ({ request }) => {
      // Send many requests quickly to trigger rate limiting
      const promises = Array.from({ length: 100 }, () =>
        request.get(`${API_BASE}/api/system/health`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
      );

      const responses = await Promise.all(promises);
      
      // At least some should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status() === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  test.describe('Performance', () => {
    test('should respond to health check within acceptable time', async ({ request }) => {
      const startTime = Date.now();
      
      const response = await request.get(`${API_BASE}/api/system/health`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      const responseTime = Date.now() - startTime;
      
      expect(response.ok()).toBeTruthy();
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    test('should handle concurrent device requests efficiently', async ({ request }) => {
      const deviceIds = testDevices.slice(0, 5).map(d => d.id);
      
      const startTime = Date.now();
      
      const promises = deviceIds.map(deviceId =>
        request.get(`${API_BASE}/api/devices/${deviceId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        })
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      expect(responses.every(r => r.ok())).toBeTruthy();
      
      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(5000); // Within 5 seconds for 5 concurrent requests
    });
  });

  test.describe('Data Validation', () => {
    test('should validate device creation data', async ({ request }) => {
      const invalidDevice = {
        // Missing required fields
        name: '',
        type: 'invalid_type',
        connectionParams: 'not_an_object'
      };

      const response = await request.post(`${API_BASE}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: invalidDevice
      });

      expect(response.status()).toBe(400);
      
      const error = await response.json();
      expect(error).toHaveProperty('error');
      expect(error).toHaveProperty('validation_errors');
      expect(Array.isArray(error.validation_errors)).toBeTruthy();
    });

    test('should validate command parameters', async ({ request }) => {
      const deviceId = testDevices[0].id;
      const invalidCommand = {
        type: '', // Empty type
        parameters: 'not_an_object'
      };

      const response = await request.post(`${API_BASE}/api/commands/${deviceId}/execute`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: invalidCommand
      });

      expect(response.status()).toBe(400);
    });
  });
});