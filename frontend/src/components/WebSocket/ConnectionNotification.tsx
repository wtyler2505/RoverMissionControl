/**
 * ConnectionNotification - WebSocket Connection Status Notifications
 * Displays toast notifications for connection events with reconnection progress
 */

import React, { useEffect, useState } from 'react';
import { Alert, Snackbar, LinearProgress, Button, Typography, Box, IconButton } from '@mui/material';
import {
  WifiOff as DisconnectedIcon,
  Wifi as ConnectedIcon,
  SyncProblem as ReconnectingIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { ConnectionState, ReconnectAttemptData } from '../../services/websocket/types';

export interface ConnectionNotificationProps {
  connectionState: ConnectionState;
  reconnectAttempt?: ReconnectAttemptData;
  onManualReconnect?: () => void;
  autoHideDuration?: number;
  position?: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}

interface NotificationState {
  open: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  showProgress: boolean;
  showAction: boolean;
}

export const ConnectionNotification: React.FC<ConnectionNotificationProps> = ({
  connectionState,
  reconnectAttempt,
  onManualReconnect,
  autoHideDuration = 6000,
  position = { vertical: 'bottom', horizontal: 'right' }
}) => {
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info',
    showProgress: false,
    showAction: false
  });

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    switch (connectionState) {
      case ConnectionState.DISCONNECTED:
      case ConnectionState.ERROR:
        setNotification({
          open: true,
          message: 'Connection lost. Attempting to reconnect...',
          severity: 'error',
          showProgress: false,
          showAction: true
        });
        break;

      case ConnectionState.RECONNECTING:
        if (reconnectAttempt) {
          const { attemptNumber, maxAttempts, nextRetryIn } = reconnectAttempt;
          setNotification({
            open: true,
            message: `Reconnection attempt ${attemptNumber}/${maxAttempts}...`,
            severity: 'warning',
            showProgress: true,
            showAction: true
          });

          // Update progress bar
          if (nextRetryIn && nextRetryIn > 0) {
            const updateInterval = 100; // Update every 100ms
            let elapsed = 0;
            
            timer = setInterval(() => {
              elapsed += updateInterval;
              const percentage = Math.min((elapsed / nextRetryIn) * 100, 100);
              setProgress(percentage);
              
              if (elapsed >= nextRetryIn) {
                clearInterval(timer);
              }
            }, updateInterval);
          }
        }
        break;

      case ConnectionState.CONNECTED:
      case ConnectionState.AUTHENTICATED:
        // Show success notification briefly
        setNotification({
          open: true,
          message: 'Connected successfully!',
          severity: 'success',
          showProgress: false,
          showAction: false
        });
        setProgress(0);
        break;

      default:
        // No notification for other states
        break;
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [connectionState, reconnectAttempt]);

  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setNotification(prev => ({ ...prev, open: false }));
  };

  const getIcon = () => {
    switch (notification.severity) {
      case 'error':
        return <DisconnectedIcon />;
      case 'warning':
        return <ReconnectingIcon />;
      case 'success':
        return <ConnectedIcon />;
      default:
        return null;
    }
  };

  return (
    <Snackbar
      open={notification.open}
      autoHideDuration={notification.severity === 'success' ? autoHideDuration : null}
      onClose={handleClose}
      anchorOrigin={position}
    >
      <Alert
        severity={notification.severity}
        icon={getIcon()}
        action={
          <>
            {notification.showAction && onManualReconnect && (
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={onManualReconnect}
                sx={{ mr: 1 }}
              >
                Reconnect Now
              </Button>
            )}
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={handleClose}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{ width: '100%', minWidth: 350 }}
      >
        <Box>
          <Typography variant="body2">{notification.message}</Typography>
          {notification.showProgress && reconnectAttempt?.nextRetryIn && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 4, borderRadius: 2 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Next retry in {Math.ceil((reconnectAttempt.nextRetryIn * (100 - progress)) / 100 / 1000)}s
              </Typography>
            </Box>
          )}
        </Box>
      </Alert>
    </Snackbar>
  );
};