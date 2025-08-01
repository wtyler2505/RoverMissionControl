/**
 * ReconnectionNotification - Toast notifications for reconnection events
 * Provides non-intrusive updates about connection state changes
 */

import React, { useEffect, useCallback } from 'react';
import { useSnackbar, VariantType, SnackbarKey } from 'notistack';
import {
  IconButton,
  Button,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useWebSocket } from '../../services/websocket/WebSocketProvider';
import { ConnectionState } from '../../services/websocket/types';
import { CircuitState } from '../../services/websocket/ReconnectionManager';

interface NotificationConfig {
  enableReconnecting: boolean;
  enableSuccess: boolean;
  enableFailure: boolean;
  enableCircuitBreaker: boolean;
  enableMaxAttempts: boolean;
  position: {
    vertical: 'top' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
  autoHideDuration: {
    info: number;
    success: number;
    warning: number;
    error: number;
  };
}

const DEFAULT_CONFIG: NotificationConfig = {
  enableReconnecting: true,
  enableSuccess: true,
  enableFailure: true,
  enableCircuitBreaker: true,
  enableMaxAttempts: true,
  position: {
    vertical: 'bottom',
    horizontal: 'left'
  },
  autoHideDuration: {
    info: 3000,
    success: 5000,
    warning: 7000,
    error: null // Don't auto-hide errors
  }
};

interface ReconnectionNotificationProps {
  config?: Partial<NotificationConfig>;
}

export const ReconnectionNotification: React.FC<ReconnectionNotificationProps> = ({
  config: userConfig = {}
}) => {
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { 
    connectionState, 
    reconnectionManager,
    reconnect 
  } = useWebSocket();

  const activeNotifications = React.useRef<Map<string, SnackbarKey>>(new Map());

  // Helper to close existing notification by key
  const closeNotification = useCallback((key: string) => {
    const snackbarKey = activeNotifications.current.get(key);
    if (snackbarKey) {
      closeSnackbar(snackbarKey);
      activeNotifications.current.delete(key);
    }
  }, [closeSnackbar]);

  // Helper to show notification
  const showNotification = useCallback((
    key: string,
    message: React.ReactNode,
    variant: VariantType,
    persist?: boolean,
    action?: React.ReactNode
  ) => {
    // Close existing notification with same key
    closeNotification(key);

    const snackbarKey = enqueueSnackbar(message, {
      variant,
      persist: persist || config.autoHideDuration[variant] === null,
      autoHideDuration: config.autoHideDuration[variant],
      anchorOrigin: config.position,
      action: (snackbarKey) => (
        <Box display="flex" alignItems="center" gap={1}>
          {action}
          <IconButton
            size="small"
            color="inherit"
            onClick={() => closeSnackbar(snackbarKey)}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )
    });

    activeNotifications.current.set(key, snackbarKey);
  }, [enqueueSnackbar, closeSnackbar, closeNotification, config]);

  // Subscribe to reconnection events
  useEffect(() => {
    if (!reconnectionManager) return;

    const handleReconnectScheduled = (data: any) => {
      if (!config.enableReconnecting) return;

      const message = (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={16} color="inherit" />
          <Typography variant="body2">
            Reconnecting in {Math.ceil(data.delay / 1000)} seconds...
          </Typography>
        </Box>
      );

      showNotification('reconnecting', message, 'info', true);
    };

    const handleReconnectAttempt = (data: any) => {
      if (!config.enableReconnecting) return;

      const message = (
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={16} color="inherit" />
          <Typography variant="body2">
            Reconnection attempt #{data.attempt}...
          </Typography>
        </Box>
      );

      showNotification('reconnecting', message, 'info', true);
    };

    const handleReconnectSuccess = (data: any) => {
      closeNotification('reconnecting');
      
      if (!config.enableSuccess) return;

      const message = (
        <Box display="flex" alignItems="center" gap={1}>
          <CheckCircleIcon />
          <Box>
            <Typography variant="body2">
              Connection restored!
            </Typography>
            {data.attempts > 1 && (
              <Typography variant="caption" color="text.secondary">
                After {data.attempts} attempts
              </Typography>
            )}
          </Box>
        </Box>
      );

      showNotification('success', message, 'success');
    };

    const handleReconnectFailure = (data: any) => {
      if (!config.enableFailure) return;

      const message = (
        <Box display="flex" alignItems="center" gap={1}>
          <WarningIcon />
          <Box>
            <Typography variant="body2">
              Reconnection attempt failed
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data.error?.message || 'Unknown error'}
            </Typography>
          </Box>
        </Box>
      );

      const action = data.nextRetry && (
        <Button
          size="small"
          color="inherit"
          startIcon={<RefreshIcon />}
          onClick={() => reconnect()}
        >
          Retry Now
        </Button>
      );

      showNotification('failure', message, 'warning', false, action);
    };

    const handleCircuitBreakerOpen = (error: any) => {
      closeNotification('reconnecting');
      
      if (!config.enableCircuitBreaker) return;

      const message = (
        <Box display="flex" alignItems="center" gap={1}>
          <ErrorIcon />
          <Box>
            <Typography variant="body2">
              Connection temporarily disabled
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Too many failed attempts. Please try again later.
            </Typography>
          </Box>
        </Box>
      );

      showNotification('circuit-breaker', message, 'error', true);
    };

    const handleMaxAttemptsReached = (error: any) => {
      closeNotification('reconnecting');
      
      if (!config.enableMaxAttempts) return;

      const message = (
        <Box display="flex" alignItems="center" gap={1}>
          <ErrorIcon />
          <Box>
            <Typography variant="body2">
              Maximum reconnection attempts reached
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Unable to establish connection after {error.context?.attempts} attempts
            </Typography>
          </Box>
        </Box>
      );

      const action = (
        <Button
          size="small"
          color="inherit"
          startIcon={<RefreshIcon />}
          onClick={() => reconnect()}
        >
          Try Again
        </Button>
      );

      showNotification('max-attempts', message, 'error', true, action);
    };

    const handleCircuitBreakerStateChange = (data: any) => {
      if (!config.enableCircuitBreaker) return;

      if (data.currentState === CircuitState.HALF_OPEN) {
        const message = (
          <Box display="flex" alignItems="center" gap={1}>
            <InfoIcon />
            <Typography variant="body2">
              Testing connection recovery...
            </Typography>
          </Box>
        );

        showNotification('circuit-breaker-recovery', message, 'info');
      } else if (data.currentState === CircuitState.CLOSED && 
                 data.previousState === CircuitState.HALF_OPEN) {
        closeNotification('circuit-breaker');
        closeNotification('circuit-breaker-recovery');
        
        const message = (
          <Box display="flex" alignItems="center" gap={1}>
            <CheckCircleIcon />
            <Typography variant="body2">
              Connection recovery successful
            </Typography>
          </Box>
        );

        showNotification('circuit-breaker-closed', message, 'success');
      }
    };

    // Subscribe to events
    reconnectionManager.on('reconnect-scheduled', handleReconnectScheduled);
    reconnectionManager.on('reconnect-attempt', handleReconnectAttempt);
    reconnectionManager.on('reconnect-success', handleReconnectSuccess);
    reconnectionManager.on('reconnect-failure', handleReconnectFailure);
    reconnectionManager.on('circuit-breaker-open', handleCircuitBreakerOpen);
    reconnectionManager.on('max-attempts-reached', handleMaxAttemptsReached);
    reconnectionManager.on('circuit-breaker-state-change', handleCircuitBreakerStateChange);

    return () => {
      reconnectionManager.off('reconnect-scheduled', handleReconnectScheduled);
      reconnectionManager.off('reconnect-attempt', handleReconnectAttempt);
      reconnectionManager.off('reconnect-success', handleReconnectSuccess);
      reconnectionManager.off('reconnect-failure', handleReconnectFailure);
      reconnectionManager.off('circuit-breaker-open', handleCircuitBreakerOpen);
      reconnectionManager.off('max-attempts-reached', handleMaxAttemptsReached);
      reconnectionManager.off('circuit-breaker-state-change', handleCircuitBreakerStateChange);
    };
  }, [reconnectionManager, config, showNotification, closeNotification, reconnect]);

  // Handle connection state changes
  useEffect(() => {
    switch (connectionState) {
      case ConnectionState.CONNECTING:
        showNotification('connecting', 
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={16} color="inherit" />
            <Typography variant="body2">Connecting...</Typography>
          </Box>, 
          'info', 
          true
        );
        break;

      case ConnectionState.CONNECTED:
        closeNotification('connecting');
        closeNotification('disconnected');
        break;

      case ConnectionState.DISCONNECTED:
        closeNotification('connecting');
        showNotification('disconnected',
          <Box display="flex" alignItems="center" gap={1}>
            <WarningIcon />
            <Typography variant="body2">Connection lost</Typography>
          </Box>,
          'warning'
        );
        break;

      case ConnectionState.ERROR:
        closeNotification('connecting');
        showNotification('error',
          <Box display="flex" alignItems="center" gap={1}>
            <ErrorIcon />
            <Typography variant="body2">Connection error</Typography>
          </Box>,
          'error',
          true,
          <Button
            size="small"
            color="inherit"
            startIcon={<RefreshIcon />}
            onClick={() => reconnect()}
          >
            Retry
          </Button>
        );
        break;
    }
  }, [connectionState, showNotification, closeNotification, reconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeNotifications.current.forEach((key) => closeSnackbar(key));
      activeNotifications.current.clear();
    };
  }, [closeSnackbar]);

  return null; // This component doesn't render anything itself
};