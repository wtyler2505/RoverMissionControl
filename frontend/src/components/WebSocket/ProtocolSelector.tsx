/**
 * ProtocolSelector - WebSocket Protocol Selection Component
 * Allows manual protocol switching and shows auto-optimization status
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Typography,
  Switch,
  FormControlLabel,
  Tooltip,
  Alert,
  IconButton,
  Collapse,
  Stack,
  Divider,
  Paper,
  SelectChangeEvent,
  useTheme
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Compress as CompressIcon,
  DataObject as JsonIcon,
  BinaryData as BinaryIcon,
  AutoMode as AutoIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  CheckCircle as OptimalIcon,
  Warning as SuboptimalIcon
} from '@mui/icons-material';
import { Protocol, ProtocolMetrics, ProtocolRecommendation } from '../../services/websocket/types';
import { useWebSocket } from './WebSocketProvider';

interface ProtocolSelectorProps {
  variant?: 'standard' | 'compact';
  showRecommendations?: boolean;
  showMetrics?: boolean;
  onProtocolChange?: (protocol: Protocol, isManual: boolean) => void;
}

const protocolInfo: Record<Protocol, { name: string; icon: React.ReactNode; description: string }> = {
  [Protocol.JSON]: {
    name: 'JSON',
    icon: <JsonIcon />,
    description: 'Human-readable, widely compatible'
  },
  [Protocol.MESSAGEPACK]: {
    name: 'MessagePack',
    icon: <BinaryIcon />,
    description: 'Binary format, efficient serialization'
  },
  [Protocol.CBOR]: {
    name: 'CBOR',
    icon: <BinaryIcon />,
    description: 'Concise Binary Object Representation'
  },
  [Protocol.BINARY]: {
    name: 'Binary',
    icon: <BinaryIcon />,
    description: 'Raw binary protocol'
  }
};

export const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({
  variant = 'standard',
  showRecommendations = true,
  showMetrics = true,
  onProtocolChange
}) => {
  const theme = useTheme();
  const { client, connectionStatus } = useWebSocket();
  const [autoOptimize, setAutoOptimize] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [recommendation, setRecommendation] = useState<ProtocolRecommendation | null>(null);
  const [protocolMetrics, setProtocolMetrics] = useState<Map<Protocol, ProtocolMetrics>>(new Map());
  const [isChanging, setIsChanging] = useState(false);

  // Get current protocol
  const currentProtocol = useMemo(() => {
    if (!client) return Protocol.JSON;
    return client.getCurrentProtocol();
  }, [client]);

  // Get compression status
  const compressionEnabled = useMemo(() => {
    return connectionStatus.protocolNegotiation?.compressionEnabled ?? false;
  }, [connectionStatus]);

  // Update metrics periodically
  useEffect(() => {
    if (!client || !connectionStatus.connected) return;

    const updateMetrics = () => {
      const metrics = client.getProtocolMetrics();
      setProtocolMetrics(metrics);
      
      const rec = client.getProtocolRecommendation();
      setRecommendation(rec);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);

    return () => clearInterval(interval);
  }, [client, connectionStatus.connected]);

  // Handle protocol change
  const handleProtocolChange = useCallback(async (event: SelectChangeEvent<Protocol>) => {
    if (!client || isChanging) return;

    const newProtocol = event.target.value as Protocol;
    if (newProtocol === currentProtocol) return;

    setIsChanging(true);
    try {
      await client.switchProtocol(newProtocol);
      onProtocolChange?.(newProtocol, true);
    } catch (error) {
      console.error('Failed to switch protocol:', error);
    } finally {
      setIsChanging(false);
    }
  }, [client, currentProtocol, isChanging, onProtocolChange]);

  // Handle auto-optimize toggle
  const handleAutoOptimizeToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setAutoOptimize(event.target.checked);
    // In a real implementation, this would configure the ProtocolManager
  }, []);

  // Get performance indicator
  const getPerformanceIndicator = (protocol: Protocol) => {
    const metrics = protocolMetrics.get(protocol);
    if (!metrics || metrics.messageCount < 10) return null;

    const avgLatency = metrics.encodingTime.average + metrics.decodingTime.average;
    const isOptimal = recommendation?.recommendedProtocol === protocol;
    
    if (isOptimal) {
      return (
        <Tooltip title="Recommended protocol">
          <OptimalIcon color="success" fontSize="small" />
        </Tooltip>
      );
    }

    if (avgLatency > 50) {
      return (
        <Tooltip title="High latency">
          <SuboptimalIcon color="warning" fontSize="small" />
        </Tooltip>
      );
    }

    return null;
  };

  // Format metrics for display
  const formatMetrics = (metrics: ProtocolMetrics) => {
    const avgLatency = metrics.encodingTime.average + metrics.decodingTime.average;
    const throughput = metrics.throughput;
    const errorRate = metrics.errorRate;

    return {
      latency: `${avgLatency.toFixed(1)}ms`,
      throughput: throughput > 1024 ? `${(throughput / 1024).toFixed(1)} KB/s` : `${throughput.toFixed(0)} B/s`,
      errorRate: `${(errorRate * 100).toFixed(1)}%`
    };
  };

  if (variant === 'compact') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip
          icon={protocolInfo[currentProtocol].icon as React.ReactElement}
          label={protocolInfo[currentProtocol].name}
          color={connectionStatus.connected ? 'primary' : 'default'}
          size="small"
          sx={{ minWidth: 100 }}
        />
        {compressionEnabled && (
          <Tooltip title="Compression enabled">
            <CompressIcon fontSize="small" color="action" />
          </Tooltip>
        )}
        {autoOptimize && (
          <Tooltip title="Auto-optimization enabled">
            <AutoIcon fontSize="small" color="primary" />
          </Tooltip>
        )}
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Protocol Configuration</Typography>
          <IconButton size="small" onClick={() => setShowInfo(!showInfo)}>
            <InfoIcon />
          </IconButton>
        </Box>

        <Collapse in={showInfo}>
          <Alert severity="info" sx={{ mb: 2 }}>
            WebSocket protocols determine how data is serialized for transmission.
            JSON is human-readable but larger, while binary protocols are more efficient.
          </Alert>
        </Collapse>

        <FormControl fullWidth disabled={!connectionStatus.connected || isChanging}>
          <InputLabel>Protocol</InputLabel>
          <Select
            value={currentProtocol}
            onChange={handleProtocolChange}
            label="Protocol"
            startAdornment={protocolInfo[currentProtocol].icon}
          >
            {Object.entries(protocolInfo).map(([protocol, info]) => (
              <MenuItem key={protocol} value={protocol}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 1 }}>
                    {info.icon}
                    <Box>
                      <Typography variant="body2">{info.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {info.description}
                      </Typography>
                    </Box>
                  </Box>
                  {getPerformanceIndicator(protocol as Protocol)}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoOptimize}
                onChange={handleAutoOptimizeToggle}
                color="primary"
              />
            }
            label="Auto-optimize protocol"
          />
          {compressionEnabled && (
            <Chip
              icon={<CompressIcon />}
              label="Compression"
              color="primary"
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {showRecommendations && recommendation && (
          <>
            <Divider />
            <Alert 
              severity="info" 
              action={
                <Tooltip title="Apply recommendation">
                  <IconButton
                    size="small"
                    onClick={() => {
                      const event = { target: { value: recommendation.recommendedProtocol } } as SelectChangeEvent<Protocol>;
                      handleProtocolChange(event);
                    }}
                    disabled={isChanging}
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <Typography variant="body2">
                Recommendation: Switch to {protocolInfo[recommendation.recommendedProtocol].name}
              </Typography>
              <Typography variant="caption" display="block">
                {recommendation.reason} (Confidence: {(recommendation.confidence * 100).toFixed(0)}%)
              </Typography>
            </Alert>
          </>
        )}

        {showMetrics && protocolMetrics.size > 0 && (
          <>
            <Divider />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Current Performance ({protocolInfo[currentProtocol].name})
              </Typography>
              {protocolMetrics.get(currentProtocol) && (
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  {Object.entries(formatMetrics(protocolMetrics.get(currentProtocol)!)).map(([key, value]) => (
                    <Chip
                      key={key}
                      icon={<SpeedIcon />}
                      label={`${key}: ${value}`}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
};