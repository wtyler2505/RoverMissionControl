/**
 * WebSocket Compression and HTTP Fallback Integration Test
 * Tests the complete flow of compression and fallback mechanisms
 */

import { WebSocketClient } from '../WebSocketClient';
import { TransportManager, TransportType } from '../TransportManager';
import { Protocol, MessageType, Priority } from '../types';

// Mock Socket.IO
jest.mock('socket.io-client', () => ({
  io: jest.fn().mockReturnValue({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    compress: jest.fn().mockReturnThis(),
    binary: jest.fn().mockReturnThis(),
    io: {
      opts: {
        transports: ['websocket', 'polling']
      }
    }
  })
}));

// Mock fetch for HTTP fallback
global.fetch = jest.fn();

describe('WebSocket Compression and HTTP Fallback Integration', () => {
  let client: WebSocketClient;
  let transportManager: TransportManager;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();

    // Setup successful HTTP responses by default
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        session_id: 'test-session-123',
        messages: []
      })
    });

    // Create client with compression enabled
    client = new WebSocketClient({
      url: 'http://localhost:8000',
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { token: 'test-token' },
      compression: true,
      transports: ['websocket', 'polling']
    });

    // Get transport manager
    transportManager = (client as any).transportManager;
  });

  afterEach(() => {
    client.disconnect();
  });

  describe('Compression Features', () => {
    it('should negotiate compression on connection', async () => {
      const negotiationPromise = new Promise<void>((resolve) => {
        client.on('protocol:negotiated', (result) => {
          expect(result.compressionEnabled).toBe(true);
          expect(result.compressionAlgorithm).toBe('gzip');
          resolve();
        });
      });

      await client.connect();
      
      // Simulate protocol negotiation
      const protocolManager = (client as any).protocolManager;
      await protocolManager.negotiateProtocol();

      await negotiationPromise;
    });

    it('should compress large messages automatically', async () => {
      await client.connect();

      // Create a large payload that should trigger compression
      const largePayload = {
        data: 'x'.repeat(1024), // 1KB of data
        timestamp: Date.now(),
        values: Array(100).fill(0).map((_, i) => ({ index: i, value: Math.random() }))
      };

      const message = await client.sendMessage({
        type: MessageType.TELEMETRY_UPDATE,
        payload: largePayload,
        priority: Priority.NORMAL
      });

      expect(message.compressed).toBe(true);
      expect(message.protocol).toBe(Protocol.JSON); // Should still use JSON with compression
    });

    it('should track compression metrics', async () => {
      await client.connect();

      // Send several messages to build up metrics
      for (let i = 0; i < 5; i++) {
        await client.sendMessage({
          type: MessageType.TELEMETRY_UPDATE,
          payload: { data: 'test'.repeat(250), index: i },
          priority: Priority.NORMAL
        });
      }

      const metrics = transportManager.getMetrics(TransportType.SOCKET_IO);
      expect(metrics.compressionSavings).toBeGreaterThan(0);
      
      const status = transportManager.getStatus();
      expect(status.compressionEnabled).toBe(true);
      expect(status.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('HTTP Fallback Features', () => {
    it('should fallback to HTTP when WebSocket fails', async () => {
      // Mock WebSocket as unavailable
      jest.spyOn(transportManager as any, 'checkWebSocketAvailability').mockResolvedValue(false);

      const fallbackPromise = new Promise<void>((resolve) => {
        transportManager.on('transport:switched', (from, to, reason) => {
          expect(from).toBe(TransportType.SOCKET_IO);
          expect(to).toBe(TransportType.HTTP_LONGPOLL);
          expect(reason).toContain('WebSocket');
          resolve();
        });
      });

      // Force a transport check
      await (transportManager as any).checkFallbackNeeded();

      await fallbackPromise;
      expect(transportManager.getCurrentTransport()).toBe(TransportType.HTTP_LONGPOLL);
    });

    it('should maintain message delivery during fallback', async () => {
      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);

      // Send a message through HTTP fallback
      const message = await client.sendMessage({
        type: MessageType.COMMAND,
        payload: { command: 'move', direction: 'forward' },
        priority: Priority.HIGH
      });

      expect(message.acknowledged).toBe(false); // HTTP doesn't have immediate ack
      
      // Verify HTTP endpoint was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/fallback/send'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('move')
        })
      );
    });

    it('should automatically switch back to WebSocket when available', async () => {
      // Start with HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);
      expect(transportManager.getCurrentTransport()).toBe(TransportType.HTTP_LONGPOLL);

      // Mock WebSocket becoming available
      jest.spyOn(transportManager as any, 'checkWebSocketAvailability').mockResolvedValue(true);
      
      const switchBackPromise = new Promise<void>((resolve) => {
        transportManager.on('transport:switched', (from, to) => {
          if (to === TransportType.SOCKET_IO) {
            expect(from).toBe(TransportType.HTTP_LONGPOLL);
            resolve();
          }
        });
      });

      // Trigger health check
      await (transportManager as any).checkTransportHealth();

      await switchBackPromise;
      expect(transportManager.getCurrentTransport()).toBe(TransportType.SOCKET_IO);
    });
  });

  describe('Combined Features', () => {
    it('should handle compression with HTTP fallback', async () => {
      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);

      // Send a large message that would benefit from compression
      const largeMessage = await client.sendMessage({
        type: MessageType.TELEMETRY_UPDATE,
        payload: { 
          data: Array(1000).fill(0).map(() => Math.random()),
          metadata: 'test'.repeat(100)
        },
        priority: Priority.NORMAL
      });

      // HTTP fallback should still compress if configured
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      expect(requestBody.compress).toBe(true);
    });

    it('should maintain quality metrics across transport switches', async () => {
      // Start with WebSocket
      await client.connect();
      
      // Send some messages to build metrics
      for (let i = 0; i < 3; i++) {
        await client.sendMessage({
          type: MessageType.TELEMETRY_UPDATE,
          payload: { index: i },
          priority: Priority.NORMAL
        });
      }

      const wsMetrics = transportManager.getMetrics(TransportType.SOCKET_IO);
      expect(wsMetrics.messagessSent).toBe(3);

      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);

      // Send more messages
      for (let i = 0; i < 2; i++) {
        await client.sendMessage({
          type: MessageType.TELEMETRY_UPDATE,
          payload: { index: i },
          priority: Priority.NORMAL
        });
      }

      const httpMetrics = transportManager.getMetrics(TransportType.HTTP_LONGPOLL);
      expect(httpMetrics.messagessSent).toBe(2);

      // Both transports should have independent metrics
      expect(wsMetrics.messagessSent).toBe(3);
      expect(httpMetrics.messagessSent).toBe(2);
    });

    it('should notify user of transport and compression changes', async () => {
      const notifications: string[] = [];

      transportManager.on('transport:switched', (from, to, reason) => {
        notifications.push(`Transport: ${from} -> ${to} (${reason})`);
      });

      transportManager.on('compression:status', (enabled, ratio) => {
        notifications.push(`Compression: ${enabled ? 'enabled' : 'disabled'} (${ratio?.toFixed(2) || 'N/A'})`);
      });

      // Connect and enable compression
      await client.connect();
      transportManager.updateCompressionStatus(true, 0.65);

      // Switch to HTTP fallback
      await transportManager.forceTransport(TransportType.HTTP_LONGPOLL);

      // Verify notifications were generated
      expect(notifications).toContain('Compression: enabled (0.65)');
      expect(notifications.some(n => n.includes('Transport:'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle compression errors gracefully', async () => {
      await client.connect();

      // Mock compression error
      const protocolManager = (client as any).protocolManager;
      jest.spyOn(protocolManager, 'compressMessage').mockRejectedValueOnce(new Error('Compression failed'));

      // Message should still be sent uncompressed
      const message = await client.sendMessage({
        type: MessageType.COMMAND,
        payload: { data: 'test' },
        priority: Priority.HIGH
      });

      expect(message.compressed).toBe(false);
    });

    it('should handle HTTP fallback connection errors', async () => {
      // Mock fetch to fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

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
        // Expected error
      }

      await errorPromise;
    });

    it('should handle rapid transport switches', async () => {
      // Rapidly switch between transports
      const switches = [];
      
      for (let i = 0; i < 5; i++) {
        const transport = i % 2 === 0 ? TransportType.HTTP_LONGPOLL : TransportType.SOCKET_IO;
        switches.push(transportManager.forceTransport(transport));
      }

      // All switches should complete without errors
      await expect(Promise.all(switches)).resolves.toBeDefined();
      
      // Final transport should be set correctly
      const finalTransport = transportManager.getCurrentTransport();
      expect([TransportType.SOCKET_IO, TransportType.HTTP_LONGPOLL]).toContain(finalTransport);
    });
  });

  describe('Performance', () => {
    it('should maintain low latency with compression', async () => {
      await client.connect();

      const startTime = Date.now();
      
      // Send multiple compressed messages
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(client.sendMessage({
          type: MessageType.TELEMETRY_UPDATE,
          payload: { data: 'x'.repeat(500), index: i },
          priority: Priority.NORMAL
        }));
      }

      await Promise.all(promises);
      const endTime = Date.now();

      // Should complete reasonably fast even with compression
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second for 10 messages
    });

    it('should optimize compression based on message size', async () => {
      await client.connect();

      // Small message - should not be compressed
      const smallMessage = await client.sendMessage({
        type: MessageType.HEARTBEAT,
        payload: { timestamp: Date.now() },
        priority: Priority.LOW
      });
      expect(smallMessage.compressed).toBe(false);

      // Large message - should be compressed
      const largeMessage = await client.sendMessage({
        type: MessageType.TELEMETRY_UPDATE,
        payload: { data: 'x'.repeat(2000) },
        priority: Priority.NORMAL
      });
      expect(largeMessage.compressed).toBe(true);
    });
  });
});