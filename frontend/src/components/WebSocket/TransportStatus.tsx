/**
 * Transport Status Component
 * Displays current transport type, compression status, and connection quality
 */

import React, { useEffect, useState } from 'react';
import { Box, Chip, Tooltip, Typography, LinearProgress, Paper } from '@mui/material';
import {
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
  CompressOutlined as CompressIcon,
  CloudQueue as CloudIcon,
  Speed as SpeedIcon,
  SignalCellularAlt as SignalIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useWebSocket } from './WebSocketProvider';
import { TransportType, TransportStatus as ITransportStatus } from '../../services/websocket/TransportManager';

interface TransportStatusProps {
  variant?: 'minimal' | 'detailed' | 'full';
  showMetrics?: boolean;
}

export const TransportStatus: React.FC<TransportStatusProps> = ({
  variant = 'minimal',
  showMetrics = false
}) => {
  const { client } = useWebSocket();
  const [transportStatus, setTransportStatus] = useState<ITransportStatus | null>(null);
  const [compressionRatio, setCompressionRatio] = useState<number | undefined>();
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    if (!client) return;

    const updateStatus = () => {
      const status = client.getTransportStatus();
      setTransportStatus(status);
      setCompressionRatio(status.compressionRatio);
      setUpdateKey(prev => prev + 1);
    };

    // Initial update
    updateStatus();

    // Update every 2 seconds
    const interval = setInterval(updateStatus, 2000);

    return () => clearInterval(interval);
  }, [client]);

  const getTransportIcon = (type: TransportType) => {
    switch (type) {
      case TransportType.WEBSOCKET:
      case TransportType.SOCKET_IO:
        return <WifiIcon />;
      case TransportType.HTTP_LONGPOLL:
        return <CloudIcon />;
      default:
        return <WifiOffIcon />;
    }
  };

  const getTransportLabel = (type: TransportType) => {
    switch (type) {
      case TransportType.WEBSOCKET:
        return 'WebSocket';
      case TransportType.SOCKET_IO:
        return 'Socket.IO';
      case TransportType.HTTP_LONGPOLL:
        return 'HTTP Fallback';
      default:
        return 'Unknown';
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent':
        return '#4caf50';
      case 'good':
        return '#8bc34a';
      case 'fair':
        return '#ff9800';
      case 'poor':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const getQualityIcon = (quality: string) => {
    const color = getQualityColor(quality);
    return (
      <SignalIcon 
        style={{ color }} 
        fontSize={variant === 'minimal' ? 'small' : 'default'}
      />
    );
  };

  if (!transportStatus) {
    return null;
  }

  // Minimal variant - just icons
  if (variant === 'minimal') {
    return (
      <Box display="flex" alignItems="center" gap={0.5}>
        <Tooltip title={`Transport: ${getTransportLabel(transportStatus.type)}`}>
          <Box display="flex" alignItems="center">
            {getTransportIcon(transportStatus.type)}
          </Box>
        </Tooltip>
        
        {transportStatus.compressionEnabled && (
          <Tooltip title={`Compression: ${compressionRatio ? `${(compressionRatio * 100).toFixed(0)}%` : 'Active'}`}>
            <CompressIcon fontSize="small" color="primary" />
          </Tooltip>
        )}
        
        <Tooltip title={`Connection: ${transportStatus.connectionQuality}`}>
          {getQualityIcon(transportStatus.connectionQuality)}
        </Tooltip>
        
        {transportStatus.fallbackReason && (
          <Tooltip title={`Fallback: ${transportStatus.fallbackReason}`}>
            <WarningIcon fontSize="small" color="warning" />
          </Tooltip>
        )}
      </Box>
    );
  }

  // Detailed variant - chips with labels
  if (variant === 'detailed') {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <Chip
          size="small"
          icon={getTransportIcon(transportStatus.type)}
          label={getTransportLabel(transportStatus.type)}
          color={transportStatus.connected ? 'success' : 'error'}
          variant={transportStatus.connected ? 'filled' : 'outlined'}
        />
        
        {transportStatus.compressionEnabled && (
          <Chip
            size="small"
            icon={<CompressIcon />}
            label={compressionRatio ? `${(compressionRatio * 100).toFixed(0)}%` : 'Compression'}
            color="primary"
            variant="outlined"
          />
        )}
        
        <Chip
          size="small"
          icon={getQualityIcon(transportStatus.connectionQuality)}
          label={transportStatus.connectionQuality}
          style={{ 
            borderColor: getQualityColor(transportStatus.connectionQuality),
            color: getQualityColor(transportStatus.connectionQuality)
          }}
          variant="outlined"
        />
        
        {transportStatus.latency > 0 && (
          <Chip
            size="small"
            icon={<SpeedIcon />}
            label={`${transportStatus.latency}ms`}
            variant="outlined"
          />
        )}
      </Box>
    );
  }

  // Full variant - detailed panel
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Connection Status
      </Typography>
      
      <Box display="flex" flexDirection="column" gap={2}>
        {/* Transport Info */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Transport
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
            {getTransportIcon(transportStatus.type)}
            <Typography variant="body1">
              {getTransportLabel(transportStatus.type)}
            </Typography>
            {transportStatus.fallbackReason && (
              <Tooltip title={transportStatus.fallbackReason}>
                <WarningIcon color="warning" fontSize="small" />
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Connection Quality */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Connection Quality
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
            {getQualityIcon(transportStatus.connectionQuality)}
            <Typography 
              variant="body1" 
              style={{ color: getQualityColor(transportStatus.connectionQuality) }}
            >
              {transportStatus.connectionQuality.charAt(0).toUpperCase() + transportStatus.connectionQuality.slice(1)}
            </Typography>
          </Box>
        </Box>

        {/* Compression */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Compression
          </Typography>
          <Box display="flex" alignItems="center" gap={1} mt={0.5}>
            <CompressIcon color={transportStatus.compressionEnabled ? 'primary' : 'disabled'} />
            <Typography variant="body1">
              {transportStatus.compressionEnabled 
                ? `Active${compressionRatio ? ` (${(compressionRatio * 100).toFixed(0)}% ratio)` : ''}`
                : 'Disabled'
              }
            </Typography>
          </Box>
        </Box>

        {/* Metrics */}
        {showMetrics && (
          <>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Latency
              </Typography>
              <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                <SpeedIcon />
                <Typography variant="body1">
                  {transportStatus.latency}ms
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Math.min(100, (transportStatus.latency / 300) * 100)}
                  sx={{ flexGrow: 1, height: 6 }}
                  color={transportStatus.latency < 100 ? 'success' : transportStatus.latency < 200 ? 'warning' : 'error'}
                />
              </Box>
            </Box>

            {transportStatus.bandwidth > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Bandwidth
                </Typography>
                <Typography variant="body1">
                  {(transportStatus.bandwidth / 1024).toFixed(1)} KB/s
                </Typography>
              </Box>
            )}
          </>
        )}

        {/* Last Error */}
        {transportStatus.lastError && (
          <Box>
            <Typography variant="subtitle2" color="error">
              Last Error
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {transportStatus.lastError}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};