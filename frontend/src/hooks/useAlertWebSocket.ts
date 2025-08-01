/**
 * Hook for WebSocket Alert Integration
 * Connects the alert system to real-time WebSocket updates
 */

import { useEffect, useRef } from 'react';
import { useAlertStore } from '../stores/alertStore';
import { AlertPriority } from '../theme/alertPriorities';

interface WebSocketAlert {
  id?: string;
  title?: string;
  message: string;
  priority: AlertPriority;
  source?: string;
  metadata?: Record<string, any>;
  groupId?: string;
  timestamp?: string;
}

interface AlertWebSocketEvents {
  onAlertReceived?: (alert: WebSocketAlert) => void;
  onAlertAcknowledged?: (alertId: string, clientId: string) => void;
  onAlertSync?: (alerts: WebSocketAlert[]) => void;
  onConnectionStateChange?: (connected: boolean) => void;
}

export const useAlertWebSocket = (
  wsClient: any, // WebSocketClient instance
  options: {
    resyncOnReconnect?: boolean;
    adaptiveBatching?: boolean;
    events?: AlertWebSocketEvents;
  } = {}
) => {
  const { resyncOnReconnect = true, adaptiveBatching = true, events = {} } = options;
  const addAlert = useAlertStore(state => state.addAlert);
  const removeAlert = useAlertStore(state => state.removeAlert);
  const clearAlerts = useAlertStore(state => state.clearAlerts);
  const lastSyncRef = useRef<Date>(new Date());
  const reconnectingRef = useRef(false);

  useEffect(() => {
    if (!wsClient) return;

    // Handle incoming alerts
    const handleAlertMessage = async (data: any) => {
      if (data.type === 'ALERT') {
        const alert: WebSocketAlert = data.payload;
        
        // Add to local store
        await addAlert({
          title: alert.title,
          message: alert.message,
          priority: alert.priority,
          metadata: {
            ...alert.metadata,
            wsAlertId: alert.id,
            receivedAt: new Date().toISOString(),
          },
          groupId: alert.groupId,
          source: 'websocket',
        });

        // Call custom handler if provided
        events.onAlertReceived?.(alert);
        
        // Send acknowledgment for critical alerts
        if (alert.priority === 'critical' && alert.id) {
          wsClient.send({
            type: 'ALERT_ACK',
            payload: {
              alertId: alert.id,
              acknowledgedAt: new Date().toISOString(),
            },
          });
        }
      } else if (data.type === 'ALERT_ACK' && data.payload) {
        // Handle acknowledgment from other clients
        const { alertId, clientId } = data.payload;
        events.onAlertAcknowledged?.(alertId, clientId);
      } else if (data.type === 'ALERT_SYNC' && data.payload) {
        // Handle bulk sync
        const alerts: WebSocketAlert[] = data.payload.alerts;
        
        if (resyncOnReconnect && reconnectingRef.current) {
          // Clear old alerts and sync new ones
          clearAlerts();
          
          for (const alert of alerts) {
            await addAlert({
              title: alert.title,
              message: alert.message,
              priority: alert.priority,
              metadata: {
                ...alert.metadata,
                wsAlertId: alert.id,
                syncedAt: new Date().toISOString(),
              },
              groupId: alert.groupId,
              source: 'websocket',
            });
          }
          
          reconnectingRef.current = false;
        }
        
        events.onAlertSync?.(alerts);
        lastSyncRef.current = new Date();
      }
    };

    // Handle connection state changes
    const handleConnectionChange = (connected: boolean) => {
      events.onConnectionStateChange?.(connected);
      
      if (connected && resyncOnReconnect) {
        reconnectingRef.current = true;
        
        // Request sync after reconnection
        wsClient.send({
          type: 'ALERT_SYNC_REQUEST',
          payload: {
            lastSync: lastSyncRef.current.toISOString(),
          },
        });
      }
    };

    // Subscribe to WebSocket events
    wsClient.on('message', handleAlertMessage);
    wsClient.on('connectionChange', handleConnectionChange);

    // Initial sync request
    if (wsClient.isConnected()) {
      wsClient.send({
        type: 'ALERT_SYNC_REQUEST',
        payload: {
          lastSync: lastSyncRef.current.toISOString(),
        },
      });
    }

    // Cleanup
    return () => {
      wsClient.off('message', handleAlertMessage);
      wsClient.off('connectionChange', handleConnectionChange);
    };
  }, [wsClient, addAlert, removeAlert, clearAlerts, resyncOnReconnect, events]);

  // Helper function to send alerts via WebSocket
  const sendAlert = async (alert: Omit<WebSocketAlert, 'id' | 'timestamp'>) => {
    if (!wsClient?.isConnected()) {
      console.warn('WebSocket not connected, queueing alert locally');
      await addAlert({
        ...alert,
        source: 'local',
      });
      return;
    }

    const alertData = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    // Send via WebSocket
    wsClient.send({
      type: 'ALERT',
      payload: alertData,
    });

    // Also add locally for immediate display
    await addAlert({
      ...alert,
      metadata: {
        ...alert.metadata,
        wsAlertId: alertData.id,
        sentAt: alertData.timestamp,
      },
      source: 'local',
    });

    return alertData.id;
  };

  // Helper to acknowledge an alert
  const acknowledgeAlert = (alertId: string) => {
    if (!wsClient?.isConnected()) return;

    wsClient.send({
      type: 'ALERT_ACK',
      payload: {
        alertId,
        acknowledgedAt: new Date().toISOString(),
      },
    });
  };

  // Helper to clear all alerts
  const clearAllAlerts = () => {
    if (!wsClient?.isConnected()) return;

    wsClient.send({
      type: 'ALERT_CLEAR_ALL',
      payload: {
        clearedAt: new Date().toISOString(),
      },
    });

    clearAlerts();
  };

  return {
    sendAlert,
    acknowledgeAlert,
    clearAllAlerts,
    isConnected: wsClient?.isConnected() || false,
  };
};

// Example usage hook
export const useRoverAlerts = () => {
  const wsClient = (window as any).wsClient; // Get from context or global
  
  const { sendAlert } = useAlertWebSocket(wsClient, {
    resyncOnReconnect: true,
    events: {
      onAlertReceived: (alert) => {
        console.log('Alert received:', alert);
        
        // Play sound for critical alerts
        if (alert.priority === 'critical') {
          // playAlertSound();
        }
      },
      onConnectionStateChange: (connected) => {
        if (!connected) {
          // Show offline indicator
          useAlertStore.getState().addAlert({
            message: 'WebSocket connection lost. Alerts may be delayed.',
            priority: 'medium',
            source: 'system',
          });
        }
      },
    },
  });

  return {
    sendCriticalAlert: (message: string, title?: string) => 
      sendAlert({ message, title, priority: 'critical' }),
    sendWarning: (message: string, title?: string) => 
      sendAlert({ message, title, priority: 'medium' }),
    sendInfo: (message: string, title?: string) => 
      sendAlert({ message, title, priority: 'info' }),
  };
};