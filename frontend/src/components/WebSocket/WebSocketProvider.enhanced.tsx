/**
 * Enhanced WebSocketProvider with ReconnectionManager support
 * This shows the modifications needed to expose reconnection functionality
 */

import React, { createContext, useContext, useEffect, useCallback, useRef, useState } from 'react';
import { WebSocketClient } from '../../services/websocket/WebSocketClient';
import { ReconnectionManager } from '../../services/websocket/ReconnectionManager';
import { ConnectionState, ConnectionStatus, WebSocketConfig } from '../../services/websocket/types';

interface WebSocketContextValue {
  client: WebSocketClient | null;
  connectionState: ConnectionState;
  connectionStatus: ConnectionStatus | null;
  reconnectionManager: ReconnectionManager | null;
  connect: (options?: any) => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  cancelReconnect: () => void;
  sendMessage: (type: string, payload: any, priority?: any) => Promise<void>;
  subscribe: (config: any) => Promise<string>;
  unsubscribe: (subscriptionId: string) => Promise<void>;
  isConnected: boolean;
  isReconnecting: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  config?: Partial<WebSocketConfig>;
  autoConnect?: boolean;
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  config = {},
  autoConnect = true,
  children
}) => {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Initialize client
  useEffect(() => {
    const client = new WebSocketClient(config);
    clientRef.current = client;

    // Setup event listeners
    client.on('connected', () => {
      setConnectionState(ConnectionState.CONNECTED);
      setConnectionStatus(client.connectionStatus);
      setIsReconnecting(false);
    });

    client.on('disconnected', () => {
      setConnectionState(ConnectionState.DISCONNECTED);
      setConnectionStatus(client.connectionStatus);
    });

    client.on('reconnecting', () => {
      setConnectionState(ConnectionState.RECONNECTING);
      setIsReconnecting(true);
    });

    client.on('error', (error) => {
      setConnectionState(ConnectionState.ERROR);
      setConnectionStatus(client.connectionStatus);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      client.connect().catch(console.error);
    }

    return () => {
      client.disconnect();
      client.destroy();
    };
  }, []);

  const connect = useCallback(async (options?: any) => {
    if (clientRef.current) {
      await clientRef.current.connect(options);
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
    }
  }, []);

  const reconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.reconnect();
    }
  }, []);

  const cancelReconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.cancelReconnect();
    }
  }, []);

  const sendMessage = useCallback(async (type: string, payload: any, priority?: any) => {
    if (clientRef.current) {
      await clientRef.current.sendMessage(type, payload, priority);
    }
  }, []);

  const subscribe = useCallback(async (config: any) => {
    if (clientRef.current) {
      return await clientRef.current.subscribe(config);
    }
    throw new Error('Client not initialized');
  }, []);

  const unsubscribe = useCallback(async (subscriptionId: string) => {
    if (clientRef.current) {
      await clientRef.current.unsubscribe(subscriptionId);
    }
  }, []);

  const value: WebSocketContextValue = {
    client: clientRef.current,
    connectionState,
    connectionStatus,
    reconnectionManager: clientRef.current?.getReconnectionManager() || null,
    connect,
    disconnect,
    reconnect,
    cancelReconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isReconnecting
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};