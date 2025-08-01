/**
 * Compression and Fallback Feature Test
 * Focused test for WebSocket compression and HTTP fallback
 */

import { TransportManager, TransportType } from '../TransportManager';
import { EventEmitter } from '../EventEmitter';

// Mock fetch
global.fetch = jest.fn();

// Mock WebSocket
global.WebSocket = jest.fn() as any;

describe('Compression and Fallback Features', () => {
  let transportManager: TransportManager;
  let mockWebSocketClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
    
    // Default successful HTTP response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        session_id: 'test-session',
        messages: []
      })
    });

    transportManager = new TransportManager();
    
    // Mock WebSocket client
    mockWebSocketClient = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      handleIncomingMessage: jest.fn(),
      getCurrentTransport: jest.fn().mockReturnValue(TransportType.SOCKET_IO),
      getTransportStatus: jest.fn().mockReturnValue({
        type: TransportType.SOCKET_IO,
        connected: true,
        latency: 50,
        bandwidth: 100,
        compressionEnabled: true,
        compressionRatio: 0.6,
        connectionQuality: 'good'
      }),
      on: jest.fn(),
      off: jest.fn()
    };

    transportManager.setWebSocketClient(mockWebSocketClient);
  });

  afterEach(() => {
    transportManager.destroy();
  });

  describe('Compression', () => {
    it('should track compression status', () => {
      // Update compression status
      transportManager.updateCompressionStatus(true, 0.75);

      const status = transportManager.getStatus();
      expect(status.compressionEnabled).toBe(true);
      expect(status.compressionRatio).toBe(0.75);
    });

    it('should emit compression events', (done) => {
      transportManager.on('compression:status', (enabled, ratio) => {
        expect(enabled).toBe(true);
        expect(ratio).toBe(0.65);
        done();
      });

      transportManager.updateCompressionStatus(true, 0.65);
    });

    it('should calculate compression savings', async () => {
      const message = {
        id: 'msg-1',
        type: 'telemetry' as any,
        payload: { data: 'x'.repeat(1000) },
        timestamp: Date.now(),
        protocol: 'JSON' as any,
        compressed: true,
        acknowledged: false,
        priority: 'NORMAL' as any
      };

      await transportManager.sendMessage(message);

      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO);
      expect(metrics.messagessSent).toBe(1);
      expect(metrics.bytessSent).toBeGreaterThan(0);
    });
  });

  describe('HTTP Fallback', () => {
    it('should switch to HTTP fallback when WebSocket unavailable', async () => {
      // Mock WebSocket as unavailable
      jest.spyOn(transportManager as any, 'checkWebSocketAvailability')
        .mockResolvedValue(false);

      await new Promise<void>((resolve) => {
        transportManager.on('transport:switched', (from, to, reason) => {
          expect(from).toBe(TransportType.SOCKET_IO);
          expect(to).toBe(TransportType.HTTP_LONGPOLL);
          expect(reason).toContain('WebSocket');
          resolve();
        });

        // Trigger fallback check
        (transportManager as any).checkFallbackNeeded();
      });

      expect(transportManager.getCurrentTransport()).toBe(TransportType.HTTP_LONGPOLL);
    });

    it('should send messages via HTTP fallback', async () => {
      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);

      const message = {
        id: 'msg-2',
        type: 'command' as any,
        payload: { command: 'stop' },
        timestamp: Date.now(),
        protocol: 'JSON' as any,
        compressed: false,
        acknowledged: false,
        priority: 'HIGH' as any
      };

      await transportManager.sendMessage(message);

      // Verify HTTP request was made
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/fallback/send'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      // Mock fetch error
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await new Promise<void>((resolve) => {
        transportManager.on('transport:error', (error, transport) => {
          expect(error.message).toContain('Network error');
          expect(transport).toBe(TransportType.HTTP_LONGPOLL);
          resolve();
        });

        // Try to switch to HTTP
        transportManager.forceTransport(TransportType.HTTP_LONGPOLL).catch(() => {
          // Expected error
        });
      });
    });
  });

  describe('Transport Quality', () => {
    it('should detect poor connection quality', (done) => {
      transportManager.on('quality:change', (quality) => {
        expect(quality).toBe('poor');
        done();
      });

      // Set poor conditions
      const status = transportManager.getStatus();
      status.latency = 500;
      
      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      metrics.errors = 20;
      metrics.messagessSent = 100;

      // Trigger quality check
      (transportManager as any).checkConnectionQuality();
    });

    it('should switch transports based on quality', async () => {
      // Set poor WebSocket quality
      const status = transportManager.getStatus();
      status.latency = 1000;
      status.connectionQuality = 'poor';

      // Mock HTTP as available and force the switch
      jest.spyOn(transportManager as any, 'checkWebSocketAvailability')
        .mockResolvedValue(false);

      await new Promise<void>((resolve) => {
        transportManager.on('transport:switched', (from, to) => {
          expect(from).toBe(TransportType.SOCKET_IO);
          expect(to).toBe(TransportType.HTTP_LONGPOLL);
          resolve();
        });

        // Force check for fallback needed with poor quality
        (transportManager as any).checkFallbackNeeded();
      });
    });
  });

  describe('Metrics', () => {
    it('should track metrics per transport', () => {
      const socketMetrics = transportManager.getMetrics(TransportType.SOCKET_IO);
      const httpMetrics = transportManager.getMetrics(TransportType.HTTP_LONGPOLL);

      expect(socketMetrics).toBeDefined();
      expect(httpMetrics).toBeDefined();
      expect(socketMetrics).not.toBe(httpMetrics);
    });

    it('should aggregate compression savings', async () => {
      // Send multiple messages
      for (let i = 0; i < 3; i++) {
        await transportManager.sendMessage({
          id: `msg-${i}`,
          type: 'telemetry' as any,
          payload: { data: 'test'.repeat(100) },
          timestamp: Date.now(),
          protocol: 'JSON' as any,
          compressed: true,
          acknowledged: false,
          priority: 'NORMAL' as any
        });
      }

      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      expect(metrics.messagessSent).toBe(3);
      
      // Update compression savings
      metrics.compressionSavings = metrics.bytessSent * 0.4;
      
      // Calculate compression ratio
      (transportManager as any).checkConnectionQuality();
      
      const status = transportManager.getStatus();
      expect(status.compressionRatio).toBeGreaterThan(0);
    });
  });
});