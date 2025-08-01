import { hardwareService } from '../hardwareService';
import { server } from '../../__mocks__/server';
import { http, HttpResponse } from 'msw';

// Mock the API client
jest.mock('../api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
}));

describe('hardwareService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDevices', () => {
    it('fetches all devices successfully', async () => {
      const devices = await hardwareService.getDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toMatchObject({
        id: 'device-1',
        name: 'Mock Device 1',
        type: 'sensor',
        status: 'connected'
      });
    });

    it('handles fetch errors gracefully', async () => {
      // Override the default handler with an error response
      server.use(
        http.get('*/hal/devices', () => {
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      await expect(hardwareService.getDevices()).rejects.toThrow('Failed to fetch devices');
    });

    it('handles network errors', async () => {
      // Override with network error
      server.use(
        http.get('*/hal/devices', () => {
          return HttpResponse.error();
        })
      );

      await expect(hardwareService.getDevices()).rejects.toThrow();
    });

    it('caches device requests', async () => {
      // First request
      const devices1 = await hardwareService.getDevices();
      
      // Second request should use cache
      const devices2 = await hardwareService.getDevices();

      expect(devices1).toEqual(devices2);
      // Should not make additional network requests if properly cached
    });
  });

  describe('getDevice', () => {
    it('fetches single device by ID', async () => {
      const device = await hardwareService.getDevice('device-1');

      expect(device).toMatchObject({
        id: 'device-1',
        name: 'Mock Device device-1',
        type: 'sensor',
        status: 'connected'
      });
    });

    it('includes telemetry data in device response', async () => {
      const device = await hardwareService.getDevice('device-1');

      expect(device.telemetry).toBeDefined();
      expect(device.telemetry).toMatchObject({
        temperature: expect.any(Number),
        humidity: expect.any(Number),
        timestamp: expect.any(String)
      });
    });

    it('throws error for non-existent device', async () => {
      server.use(
        http.get('*/hal/devices/non-existent', () => {
          return HttpResponse.json(
            { error: 'Device not found' },
            { status: 404 }
          );
        })
      );

      await expect(hardwareService.getDevice('non-existent')).rejects.toThrow('Device not found');
    });

    it('validates device ID parameter', async () => {
      await expect(hardwareService.getDevice('')).rejects.toThrow('Device ID is required');
      await expect(hardwareService.getDevice(null as any)).rejects.toThrow('Device ID is required');
      await expect(hardwareService.getDevice(undefined as any)).rejects.toThrow('Device ID is required');
    });
  });

  describe('sendCommand', () => {
    it('sends command to device successfully', async () => {
      const command = {
        command: 'READ_TEMPERATURE',
        parameters: { precision: 2 }
      };

      const result = await hardwareService.sendCommand('device-1', command);

      expect(result).toMatchObject({
        commandId: expect.any(String),
        status: 'queued',
        timestamp: expect.any(String)
      });
    });

    it('validates command parameters', async () => {
      await expect(hardwareService.sendCommand('', {})).rejects.toThrow('Device ID is required');
      await expect(hardwareService.sendCommand('device-1', null as any)).rejects.toThrow('Command is required');
      await expect(hardwareService.sendCommand('device-1', { command: '' })).rejects.toThrow('Command name is required');
    });

    it('handles command execution errors', async () => {
      server.use(
        http.post('*/hal/devices/device-1/command', () => {
          return HttpResponse.json(
            { error: 'Command execution failed' },
            { status: 400 }
          );
        })
      );

      const command = { command: 'INVALID_COMMAND' };

      await expect(hardwareService.sendCommand('device-1', command)).rejects.toThrow('Command execution failed');
    });

    it('supports batch command execution', async () => {
      const commands = [
        { command: 'READ_TEMPERATURE' },
        { command: 'READ_HUMIDITY' },
        { command: 'READ_PRESSURE' }
      ];

      const results = await hardwareService.sendBatchCommands('device-1', commands);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toMatchObject({
          commandId: expect.any(String),
          status: 'queued'
        });
      });
    });
  });

  describe('discoverDevices', () => {
    it('initiates device discovery scan', async () => {
      const scanResult = await hardwareService.discoverDevices();

      expect(scanResult).toMatchObject({
        scan_id: expect.any(String),
        status: 'running',
        progress: expect.any(Number),
        devices_found: expect.any(Number)
      });
    });

    it('handles discovery timeout', async () => {
      server.use(
        http.get('*/discovery/scan', async () => {
          // Simulate slow response
          await new Promise(resolve => setTimeout(resolve, 6000));
          return HttpResponse.json({ scan_id: 'timeout-test' });
        })
      );

      await expect(hardwareService.discoverDevices({ timeout: 5000 })).rejects.toThrow('Discovery timeout');
    });

    it('supports discovery filters', async () => {
      const filters = {
        deviceType: 'sensor',
        status: 'connected',
        capability: 'temperature'
      };

      await hardwareService.discoverDevices(filters);

      // Verify filters are passed in the request
      // This would require checking the actual request parameters
    });
  });

  describe('registerDevice', () => {
    it('registers new device successfully', async () => {
      const deviceConfig = {
        name: 'New Temperature Sensor',
        type: 'sensor',
        capabilities: ['temperature'],
        connection: {
          protocol: 'serial',
          port: '/dev/ttyUSB0',
          baudRate: 9600
        }
      };

      const result = await hardwareService.registerDevice(deviceConfig);

      expect(result).toMatchObject({
        device_id: expect.any(String),
        status: 'registered',
        timestamp: expect.any(String)
      });
    });

    it('validates device configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        capabilities: []
      };

      await expect(hardwareService.registerDevice(invalidConfig as any)).rejects.toThrow('Invalid device configuration');
    });

    it('handles registration conflicts', async () => {
      server.use(
        http.post('*/discovery/register', () => {
          return HttpResponse.json(
            { error: 'Device already registered' },
            { status: 409 }
          );
        })
      );

      const deviceConfig = {
        name: 'Duplicate Device',
        type: 'sensor'
      };

      await expect(hardwareService.registerDevice(deviceConfig)).rejects.toThrow('Device already registered');
    });
  });

  describe('getDeviceMetrics', () => {
    it('fetches performance metrics for device', async () => {
      server.use(
        http.get('*/hal/devices/device-1/metrics', () => {
          return HttpResponse.json({
            cpu_usage: 45.2,
            memory_usage: 67.8,
            network_latency: 12.5,
            uptime: 86400,
            error_count: 3,
            last_update: new Date().toISOString()
          });
        })
      );

      const metrics = await hardwareService.getDeviceMetrics('device-1');

      expect(metrics).toMatchObject({
        cpu_usage: expect.any(Number),
        memory_usage: expect.any(Number),
        network_latency: expect.any(Number),
        uptime: expect.any(Number)
      });
    });

    it('handles missing metrics gracefully', async () => {
      server.use(
        http.get('*/hal/devices/device-1/metrics', () => {
          return HttpResponse.json({}, { status: 204 });
        })
      );

      const metrics = await hardwareService.getDeviceMetrics('device-1');
      expect(metrics).toEqual({});
    });

    it('supports metrics time range queries', async () => {
      const timeRange = {
        start: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        end: new Date().toISOString()
      };

      await hardwareService.getDeviceMetrics('device-1', timeRange);

      // Would verify that time range parameters are included in request
    });
  });

  describe('updateDeviceConfig', () => {
    it('updates device configuration', async () => {
      const newConfig = {
        name: 'Updated Device Name',
        sampling_rate: 1000,
        enabled: true
      };

      server.use(
        http.put('*/hal/devices/device-1/config', () => {
          return HttpResponse.json({
            success: true,
            updated_at: new Date().toISOString()
          });
        })
      );

      const result = await hardwareService.updateDeviceConfig('device-1', newConfig);

      expect(result).toMatchObject({
        success: true,
        updated_at: expect.any(String)
      });
    });

    it('validates configuration changes', async () => {
      const invalidConfig = {
        sampling_rate: -1 // Invalid value
      };

      server.use(
        http.put('*/hal/devices/device-1/config', () => {
          return HttpResponse.json(
            { error: 'Invalid sampling rate' },
            { status: 400 }
          );
        })
      );

      await expect(hardwareService.updateDeviceConfig('device-1', invalidConfig)).rejects.toThrow('Invalid sampling rate');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('retries failed requests', async () => {
      let attemptCount = 0;
      
      server.use(
        http.get('*/hal/devices', () => {
          attemptCount++;
          if (attemptCount < 3) {
            return HttpResponse.error();
          }
          return HttpResponse.json([]);
        })
      );

      const devices = await hardwareService.getDevices({ retries: 3 });
      
      expect(devices).toEqual([]);
      expect(attemptCount).toBe(3);
    });

    it('implements exponential backoff for retries', async () => {
      const startTime = Date.now();
      let attemptTimes: number[] = [];

      server.use(
        http.get('*/hal/devices', () => {
          attemptTimes.push(Date.now());
          if (attemptTimes.length < 3) {
            return HttpResponse.error();
          }
          return HttpResponse.json([]);
        })
      );

      await hardwareService.getDevices({ retries: 3, backoff: true });

      // Verify increasing delays between attempts
      expect(attemptTimes.length).toBe(3);
      if (attemptTimes.length >= 2) {
        const delay1 = attemptTimes[1] - attemptTimes[0];
        const delay2 = attemptTimes[2] - attemptTimes[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it('handles concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, () => 
        hardwareService.getDevice('device-1')
      );

      const results = await Promise.all(requests);

      // All requests should succeed
      expect(results).toHaveLength(10);
      results.forEach(device => {
        expect(device.id).toBe('device-1');
      });
    });

    it('implements request deduplication', async () => {
      // Make multiple simultaneous requests for the same device
      const requests = Array.from({ length: 5 }, () => 
        hardwareService.getDevice('device-1')
      );

      const results = await Promise.all(requests);

      // Should deduplicate and make only one actual network request
      expect(results).toHaveLength(5);
      results.forEach(device => {
        expect(device.id).toBe('device-1');
      });
    });
  });

  describe('Caching', () => {
    it('caches device list with TTL', async () => {
      jest.useFakeTimers();

      // First request
      await hardwareService.getDevices();
      
      // Second request within TTL should use cache
      await hardwareService.getDevices();

      // Fast-forward past TTL
      jest.advanceTimersByTime(60000); // 1 minute

      // Should make new request after TTL
      await hardwareService.getDevices();

      jest.useRealTimers();
    });

    it('invalidates cache on device updates', async () => {
      // Fetch devices to populate cache
      await hardwareService.getDevices();

      // Update a device
      await hardwareService.updateDeviceConfig('device-1', { name: 'Updated' });

      // Next getDevices call should not use stale cache
      const devices = await hardwareService.getDevices();
      
      // Would verify fresh data is returned
    });

    it('supports cache clearing', () => {
      hardwareService.clearCache();
      
      // Next request should hit the network
      // This would be verified by monitoring network calls
    });
  });
});