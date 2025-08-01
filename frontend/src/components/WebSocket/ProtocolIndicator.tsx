/**
 * ProtocolIndicator - Minimal WebSocket Protocol Status Indicator
 * Shows current protocol with performance color coding and tooltip metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Typography,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import {
  DataObject as JsonIcon,
  Code as BinaryIcon,
  Circle as StatusIcon,
  Speed as SpeedIcon,
  Compress as CompressIcon
} from '@mui/icons-material';
import { Protocol, ProtocolMetrics } from '../../services/websocket/types';
import { useWebSocket } from './WebSocketProvider';

interface ProtocolIndicatorProps {
  variant?: 'chip' | 'icon' | 'text';
  showCompression?: boolean;
  showMetrics?: boolean;
  size?: 'small' | 'medium';
  position?: 'inline' | 'fixed';
}

const protocolConfig: Record<Protocol, { 
  name: string; 
  icon: React.ReactNode; 
  color: string 
}> = {
  [Protocol.JSON]: {
    name: 'JSON',
    icon: <JsonIcon />,
    color: '#2196f3'
  },
  [Protocol.MESSAGEPACK]: {
    name: 'MsgPack',
    icon: <BinaryIcon />,
    color: '#9c27b0'
  },
  [Protocol.CBOR]: {
    name: 'CBOR',
    icon: <BinaryIcon />,
    color: '#ff9800'
  },
  [Protocol.BINARY]: {
    name: 'Binary',
    icon: <BinaryIcon />,
    color: '#4caf50'
  }
};

const getPerformanceColor = (metrics: ProtocolMetrics | undefined): 'success' | 'warning' | 'error' | 'default' => {
  if (!metrics || metrics.messageCount < 5) return 'default';
  
  const avgLatency = metrics.encodingTime.average + metrics.decodingTime.average;
  const errorRate = metrics.errorRate;
  
  if (avgLatency < 10 && errorRate < 0.01) return 'success';
  if (avgLatency < 50 && errorRate < 0.05) return 'warning';
  return 'error';
};

export const ProtocolIndicator: React.FC<ProtocolIndicatorProps> = ({
  variant = 'chip',
  showCompression = true,
  showMetrics = true,
  size = 'small',
  position = 'inline'
}) => {
  const theme = useTheme();
  const { client, connectionStatus } = useWebSocket();
  const [metrics, setMetrics] = useState<ProtocolMetrics | undefined>();
  const [updateTime, setUpdateTime] = useState<number>(Date.now());

  const currentProtocol = useMemo(() => {
    if (!client || !connectionStatus.connected) return Protocol.JSON;
    return client.getCurrentProtocol();
  }, [client, connectionStatus.connected]);

  const compressionEnabled = useMemo(() => {
    return connectionStatus.protocolNegotiation?.compressionEnabled ?? false;
  }, [connectionStatus]);

  // Update metrics periodically
  useEffect(() => {
    if (!client || !connectionStatus.connected) return;

    const updateMetrics = () => {
      const protocolMetrics = client.getProtocolMetrics();
      const currentMetrics = protocolMetrics.get(currentProtocol);
      setMetrics(currentMetrics);
      setUpdateTime(Date.now());
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 3000);

    return () => clearInterval(interval);
  }, [client, connectionStatus.connected, currentProtocol]);

  // Format metrics for tooltip
  const formatTooltipContent = () => {
    if (!metrics || !showMetrics) {
      return `Protocol: ${protocolConfig[currentProtocol].name}`;
    }

    const avgLatency = metrics.encodingTime.average + metrics.decodingTime.average;
    const throughput = metrics.throughput;
    const errorRate = metrics.errorRate * 100;
    const messageCount = metrics.messageCount;

    return (
      <Box sx={{ p: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
          {protocolConfig[currentProtocol].name} Protocol
        </Typography>
        <Stack spacing={0.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">Latency:</Typography>
            <Typography variant="caption">{avgLatency.toFixed(1)}ms</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">Throughput:</Typography>
            <Typography variant="caption">
              {throughput > 1024 ? `${(throughput / 1024).toFixed(1)} KB/s` : `${throughput.toFixed(0)} B/s`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">Error Rate:</Typography>
            <Typography variant="caption">{errorRate.toFixed(2)}%</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">Messages:</Typography>
            <Typography variant="caption">{messageCount}</Typography>
          </Box>
          {compressionEnabled && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="caption" color="text.secondary">Compression:</Typography>
              <Typography variant="caption">Enabled</Typography>
            </Box>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Updated: {new Date(updateTime).toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };

  if (!connectionStatus.connected) {
    return null;
  }

  const performanceColor = getPerformanceColor(metrics);
  const protocolInfo = protocolConfig[currentProtocol];

  // Icon variant
  if (variant === 'icon') {
    return (
      <Tooltip title={formatTooltipContent()} arrow placement="bottom">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: protocolInfo.color,
            position: position === 'fixed' ? 'fixed' : 'relative',
            ...(position === 'fixed' && {
              bottom: 16,
              right: 16,
              bgcolor: 'background.paper',
              borderRadius: 1,
              p: 1,
              boxShadow: 2
            })
          }}
        >
          {React.cloneElement(protocolInfo.icon as React.ReactElement, { 
            fontSize: size as any
          })}
          <StatusIcon 
            sx={{ 
              fontSize: 8, 
              color: theme.palette[performanceColor].main 
            }} 
          />
        </Box>
      </Tooltip>
    );
  }

  // Text variant
  if (variant === 'text') {
    return (
      <Tooltip title={formatTooltipContent()} arrow placement="bottom">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            cursor: 'pointer'
          }}
        >
          <Typography
            variant={size === 'small' ? 'caption' : 'body2'}
            sx={{
              color: protocolInfo.color,
              fontWeight: 'medium'
            }}
          >
            {protocolInfo.name}
          </Typography>
          {showCompression && compressionEnabled && (
            <CompressIcon sx={{ fontSize: size === 'small' ? 12 : 16 }} />
          )}
          <StatusIcon 
            sx={{ 
              fontSize: 8, 
              color: theme.palette[performanceColor].main 
            }} 
          />
        </Box>
      </Tooltip>
    );
  }

  // Default chip variant
  return (
    <Tooltip title={formatTooltipContent()} arrow placement="bottom">
      <Chip
        icon={React.cloneElement(protocolInfo.icon as React.ReactElement, {
          style: { fontSize: size === 'small' ? 16 : 20 } as any
        })}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span>{protocolInfo.name}</span>
            {showCompression && compressionEnabled && (
              <CompressIcon sx={{ fontSize: size === 'small' ? 12 : 14 }} />
            )}
            <StatusIcon 
              sx={{ 
                fontSize: 8, 
                color: theme.palette[performanceColor].main,
                ml: 0.5
              }} 
            />
          </Box>
        }
        size={size}
        sx={{
          bgcolor: alpha(protocolInfo.color, 0.1),
          borderColor: protocolInfo.color,
          '& .MuiChip-icon': {
            color: protocolInfo.color
          },
          position: position === 'fixed' ? 'fixed' : 'relative',
          ...(position === 'fixed' && {
            bottom: 16,
            right: 16,
            boxShadow: 2
          })
        }}
        variant="outlined"
      />
    </Tooltip>
  );
};