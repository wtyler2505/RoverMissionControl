/**
 * WebSocketProvider - React Context Provider for WebSocket functionality
 * Makes WebSocket client and connection status available throughout the application
 */

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useRef,
  ReactNode 
} from 'react';
import { 
  Snackbar, 
  Alert, 
  AlertTitle,
  Slide,
  SlideProps
} from '@mui/material';
import {
  WebSocketClient,
  WebSocketContextValue,
  WebSocketConfig,
  ConnectionState,
  ConnectionStatus,
  ConnectionOptions,
  MessageType,
  Priority,
  SubscriptionConfig,
  ConnectionMetrics,
  WebSocketError,
  ConnectionEvent,
  HeartbeatData,
  ReconnectAttemptData
} from '../../services/websocket/types';
import { WebSocketClient as WSClient } from '../../services/websocket/WebSocketClient';
import { ConnectionNotification } from './ConnectionNotification';

/**
 * Default WebSocket configuration
 */
const DEFAULT_WS_CONFIG: WebSocketConfig = {
  url: process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws',
  reconnect: true,
  reconnectAttempts: 10,
  reconnectDelay: 2000,
  reconnectDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 20000,
  heartbeatInterval: 25000,
  heartbeatTimeout: 60000,
  protocols: ['json', 'messagepack'],
  compression: true,
  debug: process.env.NODE_ENV === 'development',
  auth: {
    enabled: true,
    tokenRefreshThreshold: 300,
    autoRefresh: true
  },
  queue: {
    maxSize: 1000,
    persistOffline: true,
    priorityEnabled: true
  },
  performance: {
    enableMetrics: true,
    metricsInterval: 5000,
    latencyThreshold: 1000
  }
} as WebSocketConfig;

/**
 * WebSocket Context
 */
const WebSocketContext = createContext<WebSocketContextValue | null>(null);

/**
 * Interface for WebSocket Provider props
 */
interface WebSocketProviderProps {
  children: ReactNode;
  config?: Partial<WebSocketConfig>;
  autoConnect?: boolean;
  showNotifications?: boolean;
  notificationDuration?: number;
}

/**
 * Slide transition component for notifications
 */
function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="down" />;
}

/**
 * WebSocket Provider component
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  config = {},
  autoConnect = false,
  showNotifications = true,
  notificationDuration = 4000
}) => {
  const [client, setClient] = useState<WebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: ConnectionState.DISCONNECTED,
    connected: false,
    authenticated: false,
    reconnectAttempt: 0,
    metrics: {
      connectionCount: 0,
      reconnectionCount: 0,
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      averageLatency: 0,
      currentLatency: 0,
      lastHeartbeat: 0,
      uptime: 0,
      errorCount: 0,
      queuedMessages: 0
    },
    activeSubscriptions: [],
    queueStatus: {
      size: 0,
      processing: false
    }
  });

  // Notification state
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
    title?: string;
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Reconnection attempt state
  const [reconnectAttempt, setReconnectAttempt] = useState<ReconnectAttemptData | undefined>();

  // Refs for cleanup
  const clientRef = useRef<WebSocketClient | null>(null);
  const configRef = useRef<WebSocketConfig>({ ...DEFAULT_WS_CONFIG, ...config });

  /**
   * Show notification
   */
  const showNotification = useCallback((
    message: string, 
    severity: 'success' | 'info' | 'warning' | 'error',
    title?: string
  ) => {
    if (showNotifications) {
      setNotification({
        open: true,
        message,
        severity,
        title
      });
    }
  }, [showNotifications]);

  /**
   * Close notification
   */
  const closeNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, open: false }));
  }, []);

  /**
   * Initialize WebSocket client
   */
  const initializeClient = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.destroy();
    }

    const wsClient = new WSClient(configRef.current);
    
    // Set up event handlers
    wsClient.on('onConnect', (event: ConnectionEvent) => {
      showNotification('WebSocket connected successfully', 'success', 'Connected');
      setConnectionStatus(wsClient.connectionStatus);
    });

    wsClient.on('onDisconnect', (event: ConnectionEvent) => {
      const reason = event.data?.reason || 'Unknown reason';
      showNotification(`WebSocket disconnected: ${reason}`, 'warning', 'Disconnected');
      setConnectionStatus(wsClient.connectionStatus);
    });

    wsClient.on('onReconnect', (event: ConnectionEvent) => {
      const attempt = event.data?.attemptNumber || 1;
      showNotification(`Reconnected (attempt ${attempt})`, 'success', 'Reconnected');
      setConnectionStatus(wsClient.connectionStatus);
    });

    wsClient.on('onError', (error: WebSocketError) => {
      console.error('WebSocket error:', error);
      
      let message = error.message;
      if (error.type === 'authentication') {
        message = 'Authentication failed. Please check your credentials.';
      } else if (error.type === 'connection') {
        message = 'Connection failed. Please check your network.';
      }
      
      showNotification(message, 'error', 'Connection Error');
      setConnectionStatus(wsClient.connectionStatus);
    });

    wsClient.on('onStateChange', (state: ConnectionState, previousState: ConnectionState) => {
      setConnectionStatus(wsClient.connectionStatus);
      
      // Show state change notifications for important transitions
      if (state === ConnectionState.AUTHENTICATED && previousState !== ConnectionState.AUTHENTICATED) {
        showNotification('Successfully authenticated', 'success', 'Authenticated');
      }
    });

    wsClient.on('onReconnectAttempt', (data: ReconnectAttemptData) => {
      setReconnectAttempt(data);
    });

    wsClient.on('onAuthenticated', (data) => {
      showNotification('Authentication successful', 'success', 'Authenticated');
      setConnectionStatus(wsClient.connectionStatus);
    });

    wsClient.on('onHeartbeat', (data: HeartbeatData) => {
      setConnectionStatus(wsClient.connectionStatus);
    });

    wsClient.on('onQueueUpdate', (size: number, processing: boolean) => {
      setConnectionStatus(prev => ({
        ...prev,
        queueStatus: { size, processing }
      }));
    });

    wsClient.on('onMetricsUpdate', (metrics: ConnectionMetrics) => {
      setConnectionStatus(prev => ({
        ...prev,
        metrics
      }));
    });

    clientRef.current = wsClient;
    setClient(wsClient);

    return wsClient;
  }, [showNotification]);

  /**
   * Manual reconnect handler
   */
  const handleManualReconnect = useCallback(async () => {
    if (client) {
      try {
        await client.reconnect();
      } catch (error) {
        console.error('Manual reconnect failed:', error);
        showNotification('Failed to reconnect', 'error', 'Reconnection Failed');
      }
    }
  }, [client, showNotification]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async (options?: ConnectionOptions) => {
    try {
      let wsClient = clientRef.current;
      
      if (!wsClient) {
        wsClient = initializeClient();
      }

      // Get auth token from localStorage if not provided
      if (!options?.auth?.token) {
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        const role = localStorage.getItem('userRole');
        
        if (token) {
          options = {
            ...options,
            auth: {
              token,
              userId: userId || undefined,
              role: role || undefined,
              ...options?.auth
            }
          };
        }
      }

      await wsClient.connect(options);
    } catch (error) {
      console.error('Failed to connect:', error);
      throw error;
    }
  }, [initializeClient]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.disconnect();
    }
  }, []);

  /**
   * Send message
   */
  const sendMessage = useCallback(async (
    type: MessageType, 
    payload: any, 
    priority?: Priority
  ) => {
    if (!clientRef.current) {
      throw new Error('WebSocket client not initialized');
    }
    
    await clientRef.current.sendMessage(type, payload, priority);
  }, []);

  /**
   * Subscribe to telemetry stream
   */
  const subscribe = useCallback(async (config: SubscriptionConfig): Promise<string> => {
    if (!clientRef.current) {
      throw new Error('WebSocket client not initialized');
    }
    
    return await clientRef.current.subscribe(config);
  }, []);

  /**
   * Unsubscribe from telemetry stream
   */
  const unsubscribe = useCallback(async (subscriptionId: string) => {
    if (!clientRef.current) {
      throw new Error('WebSocket client not initialized');
    }
    
    await clientRef.current.unsubscribe(subscriptionId);
  }, []);

  /**
   * Authenticate with server
   */
  const authenticate = useCallback(async (credentials: ConnectionOptions['auth']) => {
    if (!clientRef.current) {
      throw new Error('WebSocket client not initialized');
    }
    
    if (!credentials) {
      throw new Error('Authentication credentials required');
    }
    
    await clientRef.current.authenticate(credentials);
  }, []);

  /**
   * Get connection metrics
   */
  const getMetrics = useCallback((): ConnectionMetrics => {
    if (!clientRef.current) {
      return connectionStatus.metrics;
    }
    
    return clientRef.current.getMetrics();
  }, [connectionStatus.metrics]);

  /**
   * Clear message queue
   */
  const clearQueue = useCallback(() => {
    // This would need to be implemented in the WebSocketClient
    if (clientRef.current) {
      // clientRef.current.clearQueue();
    }
  }, []);

  /**
   * Export metrics for debugging
   */
  const exportMetrics = useCallback((): string => {
    if (!clientRef.current) {
      return JSON.stringify(connectionStatus, null, 2);
    }
    
    return clientRef.current.exportMetrics();
  }, [connectionStatus]);

  // Initialize client on mount
  useEffect(() => {
    const wsClient = initializeClient();
    
    // Auto-connect if enabled
    if (autoConnect) {
      connect().catch(error => {
        console.warn('Auto-connect failed:', error);
      });
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
        clientRef.current = null;
      }
    };
  }, [initializeClient, connect, autoConnect]);

  // Update connection status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (clientRef.current) {
        setConnectionStatus(clientRef.current.connectionStatus);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Context value
  const contextValue: WebSocketContextValue = {
    client,
    connectionStatus,
    isConnected: connectionStatus.connected,
    isAuthenticated: connectionStatus.authenticated,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    authenticate,
    getMetrics,
    clearQueue,
    exportMetrics
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
      
      {/* Connection status notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={notificationDuration}
        onClose={closeNotification}
        TransitionComponent={SlideTransition}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={closeNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.title && (
            <AlertTitle>{notification.title}</AlertTitle>
          )}
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Connection status notification */}
      <ConnectionNotification
        connectionState={connectionStatus.state}
        reconnectAttempt={reconnectAttempt}
        onManualReconnect={handleManualReconnect}
        position={{ vertical: 'bottom', horizontal: 'left' }}
      />
    </WebSocketContext.Provider>
  );
};

/**
 * Hook to use WebSocket context
 */
export const useWebSocket = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  
  return context;
};

/**
 * Hook to use WebSocket connection status
 */
export const useWebSocketStatus = () => {
  const { connectionStatus, isConnected, isAuthenticated } = useWebSocket();
  
  return {
    status: connectionStatus,
    isConnected,
    isAuthenticated,
    state: connectionStatus.state,
    error: connectionStatus.error,
    metrics: connectionStatus.metrics
  };
};

/**
 * Hook for WebSocket messaging
 */
export const useWebSocketMessaging = () => {
  const { sendMessage, subscribe, unsubscribe } = useWebSocket();
  
  return {
    sendMessage,
    subscribe,
    unsubscribe
  };
};

/**
 * Hook for WebSocket connection management
 */
export const useWebSocketConnection = () => {
  const { connect, disconnect, authenticate, isConnected, isAuthenticated } = useWebSocket();
  
  return {
    connect,
    disconnect,
    authenticate,
    isConnected,
    isAuthenticated
  };
};