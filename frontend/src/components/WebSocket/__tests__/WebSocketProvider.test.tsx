import React from 'react';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../../../__tests__/test-utils';
import { WebSocketProvider, useWebSocket } from '../WebSocketProvider';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  id: 'test-socket-id'
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket)
}));

// Test component that uses the WebSocket context
const TestComponent: React.FC = () => {
  const { 
    isConnected, 
    lastMessage, 
    sendMessage, 
    subscribe, 
    unsubscribe,
    connectionStatus,
    reconnectAttempts
  } = useWebSocket();

  return (
    <div>
      <div data-testid="connection-status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="connection-details">
        Status: {connectionStatus}, Attempts: {reconnectAttempts}
      </div>
      <div data-testid="last-message">
        {lastMessage ? JSON.stringify(lastMessage) : 'No message'}
      </div>
      <button 
        data-testid="send-message" 
        onClick={() => sendMessage('test-event', { data: 'test' })}
      >
        Send Message
      </button>
      <button 
        data-testid="subscribe" 
        onClick={() => subscribe('test-event', () => {})}
      >
        Subscribe
      </button>
      <button 
        data-testid="unsubscribe" 
        onClick={() => unsubscribe('test-event')}
      >
        Unsubscribe
      </button>
    </div>
  );
};

describe('WebSocketProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = false;
  });

  describe('Connection Management', () => {
    it('initializes connection on mount', () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    });

    it('updates connection status when socket connects', async () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      // Simulate connection
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      act(() => {
        mockSocket.connected = true;
        connectCallback?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
    });

    it('updates connection status when socket disconnects', async () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      // First connect
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      act(() => {
        mockSocket.connected = true;
        connectCallback?.();
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });

      // Then disconnect
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      act(() => {
        mockSocket.connected = false;
        disconnectCallback?.('transport close');
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });
    });

    it('handles connection errors', async () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1];

      act(() => {
        errorCallback?.(new Error('Connection failed'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('connection-details')).toHaveTextContent('error');
      });
    });
  });

  describe('Message Handling', () => {
    it('sends messages through socket', async () => {
      const user = userEvent.setup();
      
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const sendButton = screen.getByTestId('send-message');
      await user.click(sendButton);

      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('receives and displays messages', async () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      // Find the generic message callback
      const messageCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      const testMessage = { event: 'test-event', data: { value: 42 } };

      act(() => {
        messageCallback?.(testMessage);
      });

      await waitFor(() => {
        expect(screen.getByTestId('last-message')).toHaveTextContent(
          JSON.stringify(testMessage)
        );
      });
    });

    it('handles malformed messages gracefully', async () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const messageCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      // Send malformed message
      act(() => {
        messageCallback?.(null);
      });

      // Should not crash and should maintain "No message" state
      expect(screen.getByTestId('last-message')).toHaveTextContent('No message');
    });
  });

  describe('Event Subscription', () => {
    it('subscribes to events', async () => {
      const user = userEvent.setup();
      
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const subscribeButton = screen.getByTestId('subscribe');
      await user.click(subscribeButton);

      expect(mockSocket.on).toHaveBeenCalledWith('test-event', expect.any(Function));
    });

    it('unsubscribes from events', async () => {
      const user = userEvent.setup();
      
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      // First subscribe
      const subscribeButton = screen.getByTestId('subscribe');
      await user.click(subscribeButton);

      // Then unsubscribe
      const unsubscribeButton = screen.getByTestId('unsubscribe');
      await user.click(unsubscribeButton);

      expect(mockSocket.off).toHaveBeenCalledWith('test-event');
    });

    it('delivers messages to subscribed handlers', async () => {
      const messageHandler = jest.fn();
      
      const TestSubscriberComponent: React.FC = () => {
        const { subscribe } = useWebSocket();
        
        React.useEffect(() => {
          subscribe('telemetry:data', messageHandler);
        }, [subscribe]);

        return <div>Subscriber</div>;
      };

      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestSubscriberComponent />
        </WebSocketProvider>
      );

      // Find the telemetry data callback
      const telemetryCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'telemetry:data'
      )?.[1];

      const telemetryData = { temperature: 23.5, timestamp: Date.now() };

      act(() => {
        telemetryCallback?.(telemetryData);
      });

      expect(messageHandler).toHaveBeenCalledWith(telemetryData);
    });
  });

  describe('Reconnection Logic', () => {
    it('attempts to reconnect on disconnect', async () => {
      jest.useFakeTimers();
      
      render(
        <WebSocketProvider url="ws://localhost:8000" reconnectInterval={1000}>
          <TestComponent />
        </WebSocketProvider>
      );

      // Simulate disconnect
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      act(() => {
        disconnectCallback?.('transport close');
      });

      // Fast-forward time to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockSocket.connect).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('tracks reconnection attempts', async () => {
      jest.useFakeTimers();
      
      render(
        <WebSocketProvider url="ws://localhost:8000" reconnectInterval={1000}>
          <TestComponent />
        </WebSocketProvider>
      );

      // Simulate multiple disconnections
      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      for (let i = 0; i < 3; i++) {
        act(() => {
          disconnectCallback?.('transport close');
          jest.advanceTimersByTime(1000);
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('connection-details')).toHaveTextContent('Attempts: 3');
      });

      jest.useRealTimers();
    });

    it('stops reconnecting after max attempts', async () => {
      jest.useFakeTimers();
      
      render(
        <WebSocketProvider 
          url="ws://localhost:8000" 
          reconnectInterval={1000}
          maxReconnectAttempts={2}
        >
          <TestComponent />
        </WebSocketProvider>
      );

      const disconnectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      // Exceed max attempts
      for (let i = 0; i < 3; i++) {
        act(() => {
          disconnectCallback?.('transport close');
          jest.advanceTimersByTime(1000);
        });
      }

      // Should stop attempting after max reached
      const connectCallCount = mockSocket.connect.mock.calls.length;
      
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(mockSocket.connect.mock.calls.length).toBe(connectCallCount);

      jest.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('disconnects socket on unmount', () => {
      const { unmount } = render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('cleans up event listeners on unmount', () => {
      const { unmount } = render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const offCallsBeforeUnmount = mockSocket.off.mock.calls.length;
      
      unmount();

      expect(mockSocket.off.mock.calls.length).toBeGreaterThan(offCallsBeforeUnmount);
    });
  });

  describe('Configuration', () => {
    it('accepts custom socket configuration', () => {
      const customConfig = {
        transports: ['websocket'],
        timeout: 5000,
        forceNew: true
      };

      render(
        <WebSocketProvider url="ws://localhost:8000" options={customConfig}>
          <TestComponent />
        </WebSocketProvider>
      );

      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith('ws://localhost:8000', customConfig);
    });

    it('uses default configuration when none provided', () => {
      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const { io } = require('socket.io-client');
      expect(io).toHaveBeenCalledWith('ws://localhost:8000', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('handles socket creation errors', () => {
      const { io } = require('socket.io-client');
      io.mockImplementation(() => {
        throw new Error('Failed to create socket');
      });

      expect(() => {
        render(
          <WebSocketProvider url="ws://localhost:8000">
            <TestComponent />
          </WebSocketProvider>
        );
      }).not.toThrow();

      // Should show disconnected state
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    });

    it('handles message sending errors gracefully', async () => {
      const user = userEvent.setup();
      mockSocket.emit.mockImplementation(() => {
        throw new Error('Send failed');
      });

      render(
        <WebSocketProvider url="ws://localhost:8000">
          <TestComponent />
        </WebSocketProvider>
      );

      const sendButton = screen.getByTestId('send-message');
      
      // Should not throw error
      expect(async () => {
        await user.click(sendButton);
      }).not.toThrow();
    });
  });
});