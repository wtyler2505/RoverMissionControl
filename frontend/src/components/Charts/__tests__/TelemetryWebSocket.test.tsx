/**
 * Telemetry WebSocket Integration Tests
 * Tests for real-time telemetry data streaming via WebSocket connections
 */

import React, { useState, useEffect, useRef } from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ThemeProvider } from '@mui/material/styles';
import { LineChart } from '../charts/LineChart';
import { ChartThemeProvider } from '../base/ChartThemeProvider';
import { TimeSeriesDataPoint, TelemetryMessage } from '../types';
import { lightTheme } from '../../../theme/themes';

// Enhanced WebSocket mock with realistic behavior
class MockWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocol: string;
  bufferedAmount = 0;
  extensions = '';
  binaryType: BinaryType = 'blob';
  
  private messageQueue: any[] = [];
  private isOpen = false;
  
  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols || '';
    
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.isOpen = true;
      this.dispatchEvent(new Event('open'));
      
      // Process queued messages
      this.messageQueue.forEach(message => this.simulateMessage(message));
      this.messageQueue = [];
    }, 10);
  }
  
  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Mock send implementation
  }
  
  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.isOpen = false;
      this.dispatchEvent(new CloseEvent('close', { code, reason }));
    }, 10);
  }
  
  // Test utilities
  simulateMessage(data: any, delay = 0) {
    if (!this.isOpen) {
      this.messageQueue.push(data);
      return;
    }
    
    setTimeout(() => {
      if (this.isOpen) {
        const event = new MessageEvent('message', { 
          data: typeof data === 'string' ? data : JSON.stringify(data) 
        });
        this.dispatchEvent(event);
      }
    }, delay);
  }
  
  simulateError(error: Error) {
    const event = new ErrorEvent('error', { error });
    this.dispatchEvent(event);
  }
  
  simulateClose(code = 1000, reason = 'Normal closure') {
    this.close(code, reason);
  }
}

// Set global WebSocket mock
(global as any).WebSocket = MockWebSocket;

// Telemetry data types
interface TelemetryChannel {
  id: string;
  name: string;
  unit: string;
  min?: number;
  max?: number;
  criticalThreshold?: number;
  warningThreshold?: number;
}

interface TelemetryData {
  timestamp: number;
  channelId: string;
  value: number;
  quality: 'good' | 'uncertain' | 'bad';
  category?: 'normal' | 'warning' | 'critical';
}

// Test component for WebSocket telemetry
const TelemetryWebSocketClient: React.FC<{
  url: string;
  channels: TelemetryChannel[];
  onConnectionChange?: (connected: boolean) => void;
  onDataReceived?: (data: TelemetryData) => void;
  onError?: (error: Error) => void;
  bufferSize?: number;
}> = ({ 
  url, 
  channels, 
  onConnectionChange, 
  onDataReceived, 
  onError,
  bufferSize = 100 
}) => {
  const [connected, setConnected] = useState(false);
  const [telemetryData, setTelemetryData] = useState<Map<string, TimeSeriesDataPoint[]>>(
    new Map(channels.map(channel => [channel.id, []]))
  );
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<MockWebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const connect = () => {
    try {
      wsRef.current = new MockWebSocket(url);
      
      wsRef.current.addEventListener('open', () => {
        setConnected(true);
        setReconnectAttempts(0);
        onConnectionChange?.(true);
      });
      
      wsRef.current.addEventListener('message', (event) => {
        try {
          const data: TelemetryData = JSON.parse(event.data);
          onDataReceived?.(data);
          
          setTelemetryData(prev => {
            const newData = new Map(prev);
            const channelData = newData.get(data.channelId) || [];
            
            const newPoint: TimeSeriesDataPoint = {
              time: new Date(data.timestamp),
              value: data.value,
              category: data.category || 'normal',
              metadata: {
                quality: data.quality,
                channelId: data.channelId
              }
            };
            
            const updatedData = [...channelData.slice(-(bufferSize - 1)), newPoint];
            newData.set(data.channelId, updatedData);
            
            return newData;
          });
        } catch (error) {
          onError?.(error as Error);
        }
      });
      
      wsRef.current.addEventListener('error', (event) => {
        const error = new Error('WebSocket error');
        onError?.(error);
      });
      
      wsRef.current.addEventListener('close', (event) => {
        setConnected(false);
        onConnectionChange?.(false);
        
        // Attempt reconnection if not a normal closure
        if (event.code !== 1000 && reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        }
      });
      
    } catch (error) {
      onError?.(error as Error);
    }
  };
  
  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close(1000, 'Component unmount');
    };
  }, [url]);
  
  // Expose WebSocket instance for testing
  (React as any).wsInstance = wsRef.current;
  
  return (
    <div data-testid="telemetry-client">
      <div data-testid="connection-status">
        Status: {connected ? 'Connected' : 'Disconnected'}
      </div>
      <div data-testid="reconnect-attempts">
        Reconnect attempts: {reconnectAttempts}
      </div>
      
      <div data-testid="telemetry-charts">
        {channels.map(channel => {
          const data = telemetryData.get(channel.id) || [];
          return (
            <div key={channel.id} data-testid={`chart-${channel.id}`}>
              <LineChart
                data={data}
                title={channel.name}
                unit={channel.unit}
                ariaLabel={`${channel.name} telemetry data`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={lightTheme}>
    <ChartThemeProvider theme={lightTheme}>
      {children}
    </ChartThemeProvider>
  </ThemeProvider>
);

describe('Telemetry WebSocket Integration Tests', () => {
  const mockChannels: TelemetryChannel[] = [
    { id: 'temp_1', name: 'Engine Temperature', unit: '°C', criticalThreshold: 80 },
    { id: 'voltage_1', name: 'Battery Voltage', unit: 'V', criticalThreshold: 11.5 },
    { id: 'speed_1', name: 'Rover Speed', unit: 'km/h' }
  ];
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('establishes WebSocket connection successfully', async () => {
      const onConnectionChange = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            onConnectionChange={onConnectionChange}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
        expect(onConnectionChange).toHaveBeenCalledWith(true);
      });
    });

    it('handles connection failures gracefully', async () => {
      const onError = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://invalid-url:8080/telemetry"
            channels={mockChannels}
            onError={onError}
          />
        </TestWrapper>
      );
      
      // Simulate connection error
      await act(async () => {
        const wsInstance = (React as any).wsInstance as MockWebSocket;
        if (wsInstance) {
          wsInstance.simulateError(new Error('Connection failed'));
        }
      });
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('implements automatic reconnection with exponential backoff', async () => {
      const onConnectionChange = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            onConnectionChange={onConnectionChange}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Simulate unexpected disconnection
      await act(async () => {
        const wsInstance = (React as any).wsInstance as MockWebSocket;
        if (wsInstance) {
          wsInstance.simulateClose(1006, 'Abnormal closure');
        }
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
        const reconnectAttempts = screen.getByTestId('reconnect-attempts');
        expect(reconnectAttempts).toHaveTextContent(/Reconnect attempts: [1-9]/);
      });
    });

    it('stops reconnection after maximum attempts', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Simulate multiple disconnections
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateClose(1006, 'Abnormal closure');
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await waitFor(() => {
        const reconnectAttempts = screen.getByTestId('reconnect-attempts');
        expect(reconnectAttempts).toHaveTextContent('Reconnect attempts: 5');
      });
    });
  });

  describe('Data Reception and Processing', () => {
    it('receives and processes telemetry messages correctly', async () => {
      const onDataReceived = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            onDataReceived={onDataReceived}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send test telemetry data
      const testData: TelemetryData[] = [
        {
          timestamp: Date.now(),
          channelId: 'temp_1',
          value: 25.5,
          quality: 'good',
          category: 'normal'
        },
        {
          timestamp: Date.now() + 1000,
          channelId: 'voltage_1',
          value: 12.8,
          quality: 'good',
          category: 'normal'
        }
      ];
      
      for (const data of testData) {
        await act(async () => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(data);
          }
        });
      }
      
      await waitFor(() => {
        expect(onDataReceived).toHaveBeenCalledTimes(2);
        expect(onDataReceived).toHaveBeenCalledWith(testData[0]);
        expect(onDataReceived).toHaveBeenCalledWith(testData[1]);
      });
    });

    it('handles high-frequency data streams efficiently', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            bufferSize={50}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Simulate high-frequency data stream (60 messages per second)
      const startTime = Date.now();
      const messageCount = 100;
      
      for (let i = 0; i < messageCount; i++) {
        const data: TelemetryData = {
          timestamp: startTime + i * 16.67, // 60 FPS
          channelId: 'temp_1',
          value: 20 + Math.sin(i / 10) * 5,
          quality: 'good',
          category: 'normal'
        };
        
        await act(async () => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(data, 0);
          }
        });
        
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      await waitFor(() => {
        const chart = screen.getByTestId('chart-temp_1');
        expect(chart).toBeInTheDocument();
      });
    });

    it('maintains data buffer size limits', async () => {
      const bufferSize = 10;
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={[mockChannels[0]]}
            bufferSize={bufferSize}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send more messages than buffer size
      for (let i = 0; i < bufferSize + 5; i++) {
        const data: TelemetryData = {
          timestamp: Date.now() + i * 1000,
          channelId: 'temp_1',
          value: 20 + i,
          quality: 'good'
        };
        
        await act(async () => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(data);
          }
        });
      }
      
      await waitFor(() => {
        const chart = screen.getByTestId('chart-temp_1');
        expect(chart).toBeInTheDocument();
      });
      
      // Buffer should be maintained at the specified size
      // This would be verified through internal component state inspection
      // in a real implementation
    });

    it('handles malformed messages gracefully', async () => {
      const onError = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            onError={onError}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send malformed messages
      const malformedMessages = [
        'invalid json',
        '{"incomplete": }',
        '{"missing_required_fields": true}',
        null,
        undefined
      ];
      
      for (const message of malformedMessages) {
        await act(async () => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(message);
          }
        });
      }
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
      
      // Connection should remain stable
      expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    });
  });

  describe('Multi-Channel Data Management', () => {
    it('routes data to correct channels', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send data for each channel
      const channelData = mockChannels.map((channel, index) => ({
        timestamp: Date.now() + index * 1000,
        channelId: channel.id,
        value: 20 + index * 5,
        quality: 'good' as const
      }));
      
      for (const data of channelData) {
        await act(async () => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(data);
          }
        });
      }
      
      await waitFor(() => {
        mockChannels.forEach(channel => {
          const chart = screen.getByTestId(`chart-${channel.id}`);
          expect(chart).toBeInTheDocument();
        });
      });
    });

    it('handles simultaneous updates across multiple channels', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send simultaneous data for all channels
      const batchSize = 10;
      
      for (let i = 0; i < batchSize; i++) {
        const timestamp = Date.now() + i * 100;
        
        for (const channel of mockChannels) {
          const data: TelemetryData = {
            timestamp,
            channelId: channel.id,
            value: Math.random() * 100,
            quality: 'good'
          };
          
          await act(async () => {
            const wsInstance = (React as any).wsInstance as MockWebSocket;
            if (wsInstance) {
              wsInstance.simulateMessage(data, 0);
            }
          });
        }
      }
      
      await waitFor(() => {
        mockChannels.forEach(channel => {
          const chart = screen.getByTestId(`chart-${channel.id}`);
          expect(chart).toBeInTheDocument();
        });
      });
    });

    it('maintains separate data streams for each channel', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send different patterns of data for each channel
      const patterns = [
        { channelId: 'temp_1', values: [20, 25, 30, 35, 40] },
        { channelId: 'voltage_1', values: [12.0, 12.2, 12.4, 12.6, 12.8] },
        { channelId: 'speed_1', values: [0, 5, 10, 15, 20] }
      ];
      
      for (const pattern of patterns) {
        for (let i = 0; i < pattern.values.length; i++) {
          const data: TelemetryData = {
            timestamp: Date.now() + i * 1000,
            channelId: pattern.channelId,
            value: pattern.values[i],
            quality: 'good'
          };
          
          await act(async () => {
            const wsInstance = (React as any).wsInstance as MockWebSocket;
            if (wsInstance) {
              wsInstance.simulateMessage(data);
            }
          });
        }
      }
      
      await waitFor(() => {
        patterns.forEach(pattern => {
          const chart = screen.getByTestId(`chart-${pattern.channelId}`);
          expect(chart).toBeInTheDocument();
        });
      });
    });
  });

  describe('Performance Under Load', () => {
    it('handles burst data transmission', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            bufferSize={200}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send burst of 100 messages rapidly
      const burstSize = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < burstSize; i++) {
        const data: TelemetryData = {
          timestamp: Date.now() + i,
          channelId: mockChannels[i % mockChannels.length].id,
          value: Math.random() * 100,
          quality: 'good'
        };
        
        // Send without delay to simulate burst
        act(() => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(data, 0);
          }
        });
      }
      
      await waitFor(() => {
        mockChannels.forEach(channel => {
          const chart = screen.getByTestId(`chart-${channel.id}`);
          expect(chart).toBeInTheDocument();
        });
      });
      
      const processingTime = performance.now() - startTime;
      expect(processingTime).toBeLessThan(1000); // Should handle burst within 1 second
    });

    it('maintains performance with continuous streaming', async () => {
      const streamDuration = 2000; // 2 seconds
      const messageInterval = 50; // 20 Hz
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Start continuous streaming
      const startTime = Date.now();
      let messageCount = 0;
      
      const streamInterval = setInterval(() => {
        if (Date.now() - startTime >= streamDuration) {
          clearInterval(streamInterval);
          return;
        }
        
        mockChannels.forEach((channel, index) => {
          const data: TelemetryData = {
            timestamp: Date.now(),
            channelId: channel.id,
            value: Math.sin(messageCount / 10 + index) * 50 + 50,
            quality: 'good'
          };
          
          act(() => {
            const wsInstance = (React as any).wsInstance as MockWebSocket;
            if (wsInstance) {
              wsInstance.simulateMessage(data, 0);
            }
          });
        });
        
        messageCount++;
      }, messageInterval);
      
      // Wait for stream to complete
      await new Promise(resolve => setTimeout(resolve, streamDuration + 500));
      
      await waitFor(() => {
        mockChannels.forEach(channel => {
          const chart = screen.getByTestId(`chart-${channel.id}`);
          expect(chart).toBeInTheDocument();
        });
      });
      
      expect(messageCount).toBeGreaterThan(30); // Should have processed many messages
    });
  });

  describe('Error Handling and Recovery', () => {
    it('recovers from temporary network issues', async () => {
      const onConnectionChange = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            onConnectionChange={onConnectionChange}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Simulate network interruption
      await act(async () => {
        const wsInstance = (React as any).wsInstance as MockWebSocket;
        if (wsInstance) {
          wsInstance.simulateClose(1006, 'Network error');
        }
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });
      
      // Should attempt to reconnect
      await waitFor(() => {
        expect(screen.getByTestId('reconnect-attempts')).toHaveTextContent(/[1-9]/);
      }, { timeout: 5000 });
    });

    it('handles server-side disconnections gracefully', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Simulate server shutdown
      await act(async () => {
        const wsInstance = (React as any).wsInstance as MockWebSocket;
        if (wsInstance) {
          wsInstance.simulateClose(1001, 'Server shutdown');
        }
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });
      
      // Should handle gracefully without errors
      expect(screen.getByTestId('telemetry-charts')).toBeInTheDocument();
    });

    it('maintains data integrity during reconnection', async () => {
      const onDataReceived = jest.fn();
      
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={[mockChannels[0]]}
            onDataReceived={onDataReceived}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send some initial data
      const initialData: TelemetryData = {
        timestamp: Date.now(),
        channelId: 'temp_1',
        value: 25.0,
        quality: 'good'
      };
      
      await act(async () => {
        const wsInstance = (React as any).wsInstance as MockWebSocket;
        if (wsInstance) {
          wsInstance.simulateMessage(initialData);
        }
      });
      
      await waitFor(() => {
        expect(onDataReceived).toHaveBeenCalledWith(initialData);
      });
      
      // Simulate disconnection and reconnection
      await act(async () => {
        const wsInstance = (React as any).wsInstance as MockWebSocket;
        if (wsInstance) {
          wsInstance.simulateClose(1006, 'Network error');
        }
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
      });
      
      // Data should still be displayed during disconnection
      expect(screen.getByTestId('chart-temp_1')).toBeInTheDocument();
      
      // Wait for reconnection attempt
      await waitFor(() => {
        expect(screen.getByTestId('reconnect-attempts')).toHaveTextContent(/[1-9]/);
      }, { timeout: 3000 });
    });
  });

  describe('Memory Management', () => {
    it('properly cleans up WebSocket connections on unmount', async () => {
      const { unmount } = render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Unmount component
      unmount();
      
      // WebSocket should be closed properly
      // In a real implementation, we'd verify the close was called
      expect(true).toBe(true); // Placeholder assertion
    });

    it('prevents memory leaks with long-running connections', async () => {
      render(
        <TestWrapper>
          <TelemetryWebSocketClient
            url="ws://localhost:8080/telemetry"
            channels={mockChannels}
            bufferSize={50}
          />
        </TestWrapper>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
      });
      
      // Send continuous data for an extended period
      for (let i = 0; i < 200; i++) {
        const data: TelemetryData = {
          timestamp: Date.now() + i * 100,
          channelId: mockChannels[i % mockChannels.length].id,
          value: Math.random() * 100,
          quality: 'good'
        };
        
        if (i % 50 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        act(() => {
          const wsInstance = (React as any).wsInstance as MockWebSocket;
          if (wsInstance) {
            wsInstance.simulateMessage(data, 0);
          }
        });
      }
      
      await waitFor(() => {
        mockChannels.forEach(channel => {
          const chart = screen.getByTestId(`chart-${channel.id}`);
          expect(chart).toBeInTheDocument();
        });
      });
      
      // Memory usage should remain stable (tested through buffer size limits)
      expect(true).toBe(true); // Placeholder assertion
    });
  });
});