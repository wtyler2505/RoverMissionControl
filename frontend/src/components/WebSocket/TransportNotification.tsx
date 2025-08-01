/**
 * Transport Notification Component
 * Shows notifications when transport changes or connection issues occur
 */

import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Snackbar, Slide, IconButton } from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import { Close as CloseIcon } from '@mui/icons-material';
import { useWebSocket } from './WebSocketProvider';
import { TransportType } from '../../services/websocket/TransportManager';

function SlideTransition(props: TransitionProps & {
  children: React.ReactElement<any, any>;
}) {
  return <Slide {...props} direction="up" />;
}

interface TransportNotificationProps {
  autoHideDuration?: number;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

interface NotificationData {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  autoHide: boolean;
}

export const TransportNotification: React.FC<TransportNotificationProps> = ({
  autoHideDuration = 6000,
  position = { vertical: 'bottom', horizontal: 'right' }
}) => {
  const { client } = useWebSocket();
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);

  useEffect(() => {
    if (!client) return;

    // Get the transport manager from the client
    const transportManager = (client as any).transportManager;
    if (!transportManager) return;

    const handleTransportSwitch = (from: TransportType, to: TransportType, reason: string) => {
      const notification: NotificationData = {
        id: `transport-${Date.now()}`,
        severity: to === TransportType.HTTP_LONGPOLL ? 'warning' : 'info',
        title: 'Connection Changed',
        message: to === TransportType.HTTP_LONGPOLL 
          ? `Switched to HTTP fallback: ${reason}`
          : `WebSocket connection restored`,
        autoHide: to !== TransportType.HTTP_LONGPOLL
      };
      
      addNotification(notification);
    };

    const handleTransportError = (error: Error, transport: TransportType) => {
      const notification: NotificationData = {
        id: `error-${Date.now()}`,
        severity: 'error',
        title: 'Connection Error',
        message: `${transport} error: ${error.message}`,
        autoHide: false
      };
      
      addNotification(notification);
    };

    const handleQualityChange = (quality: string) => {
      if (quality === 'poor') {
        const notification: NotificationData = {
          id: `quality-${Date.now()}`,
          severity: 'warning',
          title: 'Poor Connection',
          message: 'Connection quality is degraded. Some features may be slow.',
          autoHide: true
        };
        
        addNotification(notification);
      }
    };

    const handleCompressionStatus = (enabled: boolean, ratio?: number) => {
      // Only notify on significant compression changes
      if (enabled && ratio && ratio > 0.5) {
        const notification: NotificationData = {
          id: `compression-${Date.now()}`,
          severity: 'success',
          title: 'Compression Active',
          message: `Data compression saving ${(ratio * 100).toFixed(0)}% bandwidth`,
          autoHide: true
        };
        
        addNotification(notification);
      }
    };

    // Subscribe to transport events
    transportManager.on('transport:switched', handleTransportSwitch);
    transportManager.on('transport:error', handleTransportError);
    transportManager.on('quality:change', handleQualityChange);
    transportManager.on('compression:status', handleCompressionStatus);

    return () => {
      transportManager.off('transport:switched', handleTransportSwitch);
      transportManager.off('transport:error', handleTransportError);
      transportManager.off('quality:change', handleQualityChange);
      transportManager.off('compression:status', handleCompressionStatus);
    };
  }, [client]);

  const addNotification = (notification: NotificationData) => {
    setNotifications(prev => [...prev, notification]);
    
    // If no current notification, show this one
    if (!currentNotification) {
      setCurrentNotification(notification);
    }
  };

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }

    setCurrentNotification(null);
    
    // Show next notification after a brief delay
    setTimeout(() => {
      setNotifications(prev => {
        const remaining = prev.filter(n => n.id !== currentNotification?.id);
        if (remaining.length > 0) {
          setCurrentNotification(remaining[0]);
          return remaining.slice(1);
        }
        return [];
      });
    }, 300);
  };

  if (!currentNotification) {
    return null;
  }

  return (
    <Snackbar
      open={true}
      autoHideDuration={currentNotification.autoHide ? autoHideDuration : null}
      onClose={handleClose}
      TransitionComponent={SlideTransition}
      anchorOrigin={position}
    >
      <Alert
        severity={currentNotification.severity}
        variant="filled"
        onClose={handleClose}
        action={
          !currentNotification.autoHide && (
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={handleClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )
        }
        sx={{ 
          minWidth: 300,
          boxShadow: 3
        }}
      >
        <AlertTitle>{currentNotification.title}</AlertTitle>
        {currentNotification.message}
      </Alert>
    </Snackbar>
  );
};