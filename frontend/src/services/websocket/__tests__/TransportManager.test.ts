/**
 * TransportManager Tests
 * Test suite for WebSocket compression and HTTP fallback mechanisms
 */

import { TransportManager, TransportType, TransportStatus } from '../TransportManager';
import { EventEmitter } from '../EventEmitter';

// Mock fetch for HTTP fallback tests
global.fetch = jest.fn();

describe('TransportManager', () => {
  let transportManager: TransportManager;
  let mockWebSocketClient: any;

  beforeEach(() => {
    // Reset fetch mock before each test
    (global.fetch as jest.Mock).mockReset();
    
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
      } as TransportStatus),
      on: jest.fn(),
      off: jest.fn()
    };

    transportManager.setWebSocketClient(mockWebSocketClient);
    
    // Clear all intervals
    jest.clearAllTimers();
  });

  afterEach(() => {
    transportManager.destroy();
    jest.clearAllMocks();
  });

  describe('Transport Detection', () => {
    it('should initialize with Socket.IO as default transport', () => {
      expect(transportManager.getCurrentTransport()).toBe(TransportType.SOCKET_IO);
    });

    it('should detect WebSocket availability', async () => {
      // Mock WebSocket constructor
      const mockWebSocket = {
        close: jest.fn(),
        onopen: null as any,
        onerror: null as any
      };
      
      global.WebSocket = jest.fn().mockImplementation(() => mockWebSocket) as any;

      // Trigger WebSocket availability check
      const checkPromise = (transportManager as any).checkWebSocketAvailability();
      
      // Simulate successful connection
      mockWebSocket.onopen?.();
      
      const result = await checkPromise;
      expect(result).toBe(true);
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should detect WebSocket unavailability', async () => {
      // Mock WebSocket constructor to throw error
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('WebSocket not supported');
      }) as any;

      const result = await (transportManager as any).checkWebSocketAvailability();
      expect(result).toBe(false);
    });
  });

  describe('HTTP Fallback', () => {
    beforeEach(() => {
      // Mock successful HTTP responses
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          session_id: 'test-session-123',
          messages: []
        })
      });
    });

    it('should switch to HTTP fallback when WebSocket is unavailable', async () => {
      const switchPromise = new Promise<void>((resolve) => {
        transportManager.on('transport:switched', (from, to, reason) => {
          expect(from).toBe(TransportType.SOCKET_IO);
          expect(to).toBe(TransportType.HTTP_LONGPOLL);
          expect(reason).toBe('WebSocket unavailable');
          resolve();
        });
      });

      // Mock WebSocket as unavailable
      jest.spyOn(transportManager as any, 'checkWebSocketAvailability').mockResolvedValue(false);
      
      // Trigger fallback check
      await (transportManager as any).checkFallbackNeeded();
      
      await switchPromise;
      expect(transportManager.getCurrentTransport()).toBe(TransportType.HTTP_LONGPOLL);
    });

    it('should maintain session during HTTP fallback', async () => {
      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);
      
      // Send a message
      await transportManager.sendMessage({
        id: 'msg-1',
        type: 'test' as any,
        payload: { data: 'test' },
        timestamp: Date.now(),
        protocol: 'JSON' as any,
        compressed: false,
        acknowledged: false,
        priority: 'NORMAL' as any
      });

      // Verify fetch was called with correct parameters
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

    it('should handle HTTP fallback errors gracefully', async () => {
      // Mock fetch error for session creation
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const errorPromise = new Promise<void>((resolve) => {
        transportManager.on('transport:error', (error, transport) => {
          expect(error.message).toContain('Network error');
          expect(transport).toBe(TransportType.HTTP_LONGPOLL);
          resolve();
        });
      });

      try {
        await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);
      } catch (error) {
        // Expected error during transport switch
      }
      
      await errorPromise;
    });
  });

  describe('Compression Status', () => {
    it('should update compression status', () => {
      const statusPromise = new Promise<void>((resolve) => {
        transportManager.on('compression:status', (enabled, ratio) => {
          expect(enabled).toBe(true);
          expect(ratio).toBe(0.7);
          resolve();
        });
      });

      transportManager.updateCompressionStatus(true, 0.7);
      
      const status = transportManager.getStatus();
      expect(status.compressionEnabled).toBe(true);
      expect(status.compressionRatio).toBe(0.7);
    });

    it('should emit compression status changes', async () => {
      const compressionPromise = new Promise<void>((resolve) => {
        transportManager.on('compression:status', (enabled, ratio) => {
          expect(enabled).toBe(true);
          expect(ratio).toBeGreaterThan(0);
          resolve();
        });
      });

      // Simulate compression metrics update
      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      metrics.compressionSavings = 1000;
      metrics.bytessSent = 2000;
      
      // Trigger quality check which calculates compression ratio
      (transportManager as any).checkConnectionQuality();
      
      await compressionPromise;
    });
  });

  describe('Connection Quality Monitoring', () => {
    it('should calculate connection quality based on latency and errors', () => {
      const qualityPromise = new Promise<void>((resolve) => {
        transportManager.on('quality:change', (quality) => {
          expect(quality).toBe('excellent');
          resolve();
        });
      });

      // Set excellent conditions
      const status = transportManager.getStatus();
      status.latency = 30;
      
      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      metrics.errors = 0;
      metrics.messagessSent = 100;
      metrics.messagesReceived = 100;
      
      // Trigger quality check
      (transportManager as any).checkConnectionQuality();
    });

    it('should detect poor connection quality', () => {
      const qualityPromise = new Promise<void>((resolve) => {
        transportManager.on('quality:change', (quality) => {
          expect(quality).toBe('poor');
          resolve();
        });
      });

      // Set poor conditions
      const status = transportManager.getStatus();
      status.latency = 500;
      
      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      metrics.errors = 20;
      metrics.messagessSent = 100;
      metrics.messagesReceived = 100;
      
      // Trigger quality check
      (transportManager as any).checkConnectionQuality();
    });
  });

  describe('Transport Switching', () => {
    beforeEach(() => {
      // Setup successful HTTP response for this test group
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          session_id: 'test-session-123',
          messages: []
        })
      });
    });

    it('should switch back to WebSocket when available', async () => {
      // Start with HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);
      expect(transportManager.getCurrentTransport()).toBe(TransportType.HTTP_LONGPOLL);

      // Mock WebSocket as available again
      jest.spyOn(transportManager as any, 'checkWebSocketAvailability').mockResolvedValue(true);
      mockWebSocketClient.reconnect = jest.fn().mockResolvedValue(undefined);

      const switchPromise = new Promise<void>((resolve) => {
        transportManager.on('transport:switched', (from, to, reason) => {
          if (to === TransportType.SOCKET_IO) {
            expect(from).toBe(TransportType.HTTP_LONGPOLL);
            expect(reason).toBe('WebSocket available');
            resolve();
          }
        });
      });

      // Trigger transport health check
      await (transportManager as any).checkTransportHealth();
      
      await switchPromise;
      expect(transportManager.getCurrentTransport()).toBe(TransportType.SOCKET_IO);
    });

    it('should handle transport switch errors', async () => {
      // Mock reconnect failure
      mockWebSocketClient.reconnect = jest.fn().mockRejectedValue(new Error('Reconnect failed'));

      // Start with HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);

      const errorPromise = new Promise<void>((resolve) => {
        transportManager.on('transport:error', (error, transport) => {
          expect(error.message).toBe('Reconnect failed');
          expect(transport).toBe(TransportType.SOCKET_IO);
          resolve();
        });
      });

      // Try to switch back to WebSocket
      await (transportManager as any).switchToWebSocket();
      
      await errorPromise;
      // Should remain on HTTP fallback
      expect(transportManager.getCurrentTransport()).toBe(TransportType.HTTP_LONGPOLL);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track transport metrics separately', () => {
      const socketMetrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      const httpMetrics = transportManager.getMetrics(TransportType.HTTP_LONGPOLL) as any;
      
      expect(socketMetrics).toBeDefined();
      expect(httpMetrics).toBeDefined();
      expect(socketMetrics).not.toBe(httpMetrics);
    });

    it('should update metrics when sending messages', async () => {
      const message = {
        id: 'msg-1',
        type: 'test' as any,
        payload: { data: 'test' },
        timestamp: Date.now(),
        protocol: 'JSON' as any,
        compressed: false,
        acknowledged: false,
        priority: 'NORMAL' as any
      };

      await transportManager.sendMessage(message);
      
      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO) as any;
      expect(metrics.messagessSent).toBe(1);
      expect(metrics.bytessSent).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      // Setup successful HTTP response for cleanup tests
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          session_id: 'test-session-123',
          messages: []
        })
      });
    });

    it('should cleanup resources on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      transportManager.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalledTimes(2); // quality and health check intervals
    });

    it('should disconnect HTTP fallback on destroy', async () => {
      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);
      
      // Mock abort controller
      const abortSpy = jest.fn();
      (transportManager as any).httpFallback.abortController = { abort: abortSpy };
      
      transportManager.destroy();
      
      expect(abortSpy).toHaveBeenCalled();
    });
  });
});