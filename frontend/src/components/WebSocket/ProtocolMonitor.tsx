/**
 * ProtocolMonitor - WebSocket Protocol Performance Monitor
 * Real-time monitoring of protocol performance metrics with charts and history
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Tooltip,
  Stack,
  Divider,
  Button,
  Alert,
  useTheme,
  alpha
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Timeline as ChartIcon,
  Speed as LatencyIcon,
  DataUsage as ThroughputIcon,
  Error as ErrorIcon,
  Compress as CompressionIcon,
  History as HistoryIcon,
  Download as ExportIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { Protocol, ProtocolMetrics } from '../../services/websocket/types';
import { useWebSocket } from './WebSocketProvider';

interface ProtocolHistory {
  timestamp: number;
  from: Protocol;
  to: Protocol;
  reason: string;
  metrics: {
    latency: number;
    throughput: number;
    errorRate: number;
  };
}

interface ProtocolMonitorProps {
  defaultExpanded?: boolean;
  showHistory?: boolean;
  showComparison?: boolean;
  refreshInterval?: number;
  maxHistoryItems?: number;
}

const protocolNames: Record<Protocol, string> = {
  [Protocol.JSON]: 'JSON',
  [Protocol.MESSAGEPACK]: 'MessagePack',
  [Protocol.CBOR]: 'CBOR',
  [Protocol.BINARY]: 'Binary'
};

const getMetricColor = (value: number, type: 'latency' | 'throughput' | 'error'): string => {
  switch (type) {
    case 'latency':
      if (value < 10) return 'success.main';
      if (value < 50) return 'warning.main';
      return 'error.main';
    case 'throughput':
      if (value > 10240) return 'success.main'; // > 10 KB/s
      if (value > 1024) return 'warning.main';  // > 1 KB/s
      return 'error.main';
    case 'error':
      if (value < 0.01) return 'success.main'; // < 1%
      if (value < 0.05) return 'warning.main'; // < 5%
      return 'error.main';
    default:
      return 'text.primary';
  }
};

export const ProtocolMonitor: React.FC<ProtocolMonitorProps> = ({
  defaultExpanded = false,
  showHistory = true,
  showComparison = true,
  refreshInterval = 2000,
  maxHistoryItems = 10
}) => {
  const theme = useTheme();
  const { client, connectionStatus } = useWebSocket();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [protocolMetrics, setProtocolMetrics] = useState<Map<Protocol, ProtocolMetrics>>(new Map());
  const [switchHistory, setSwitchHistory] = useState<ProtocolHistory[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const historyRef = useRef<ProtocolHistory[]>([]);

  const currentProtocol = useMemo(() => {
    if (!client) return Protocol.JSON;
    return client.getCurrentProtocol();
  }, [client]);

  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const current = protocolMetrics.get(currentProtocol);
    if (!current) return null;

    const totalMessages = current.messageCount;
    const avgLatency = current.encodingTime.average + current.decodingTime.average;
    const avgMessageSize = totalMessages > 0 ? current.totalBytes / totalMessages : 0;
    const compressionRatio = current.compressionRatio || 1;

    return {
      totalMessages,
      avgLatency,
      avgMessageSize,
      compressionRatio,
      throughput: current.throughput,
      errorRate: current.errorRate
    };
  }, [protocolMetrics, currentProtocol]);

  // Update metrics
  useEffect(() => {
    if (!client || !connectionStatus.connected) return;

    const updateMetrics = () => {
      const metrics = client.getProtocolMetrics();
      setProtocolMetrics(metrics);
      setLastUpdate(Date.now());

      // Check for protocol switches (in real implementation, this would come from events)
      const currentProto = client.getCurrentProtocol();
      if (historyRef.current.length > 0) {
        const lastEntry = historyRef.current[0];
        if (lastEntry.to !== currentProto) {
          const newEntry: ProtocolHistory = {
            timestamp: Date.now(),
            from: lastEntry.to,
            to: currentProto,
            reason: 'Manual switch', // Would get from event
            metrics: {
              latency: metrics.get(currentProto)?.encodingTime.average || 0,
              throughput: metrics.get(currentProto)?.throughput || 0,
              errorRate: metrics.get(currentProto)?.errorRate || 0
            }
          };
          historyRef.current = [newEntry, ...historyRef.current.slice(0, maxHistoryItems - 1)];
          setSwitchHistory([...historyRef.current]);
        }
      } else if (historyRef.current.length === 0) {
        // Initialize history
        const initialEntry: ProtocolHistory = {
          timestamp: Date.now(),
          from: currentProto,
          to: currentProto,
          reason: 'Initial connection',
          metrics: {
            latency: metrics.get(currentProto)?.encodingTime.average || 0,
            throughput: metrics.get(currentProto)?.throughput || 0,
            errorRate: metrics.get(currentProto)?.errorRate || 0
          }
        };
        historyRef.current = [initialEntry];
        setSwitchHistory([initialEntry]);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [client, connectionStatus.connected, refreshInterval, maxHistoryItems]);

  // Export metrics
  const handleExportMetrics = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      currentProtocol: protocolNames[currentProtocol],
      metrics: Array.from(protocolMetrics.entries()).map(([protocol, metrics]) => ({
        protocol: protocolNames[protocol],
        ...metrics
      })),
      history: switchHistory,
      aggregateMetrics
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `protocol-metrics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!connectionStatus.connected) {
    return (
      <Paper sx={{ p: 2 }}>
        <Alert severity="info">
          Connect to WebSocket to view protocol metrics
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ChartIcon color="primary" />
          <Box>
            <Typography variant="h6">Protocol Monitor</Typography>
            <Typography variant="caption" color="text.secondary">
              Current: {protocolNames[currentProtocol]} • Last update: {formatTimeAgo(lastUpdate)}
            </Typography>
          </Box>
        </Box>
        <IconButton>
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Current Protocol Summary */}
          {aggregateMetrics && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <LatencyIcon sx={{ color: getMetricColor(aggregateMetrics.avgLatency, 'latency') }} />
                  <Typography variant="h6">
                    {aggregateMetrics.avgLatency.toFixed(1)}ms
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Avg Latency
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <ThroughputIcon sx={{ color: getMetricColor(aggregateMetrics.throughput, 'throughput') }} />
                  <Typography variant="h6">
                    {formatBytes(aggregateMetrics.throughput)}/s
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Throughput
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <CompressionIcon color="primary" />
                  <Typography variant="h6">
                    {(aggregateMetrics.compressionRatio * 100).toFixed(0)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Compression
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <ErrorIcon sx={{ color: getMetricColor(aggregateMetrics.errorRate, 'error') }} />
                  <Typography variant="h6">
                    {(aggregateMetrics.errorRate * 100).toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Error Rate
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Protocol Comparison Table */}
          {showComparison && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1">Protocol Comparison</Typography>
                <Button
                  size="small"
                  startIcon={<ExportIcon />}
                  onClick={handleExportMetrics}
                >
                  Export
                </Button>
              </Box>
              <TableContainer sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Protocol</TableCell>
                      <TableCell align="right">Messages</TableCell>
                      <TableCell align="right">Avg Latency</TableCell>
                      <TableCell align="right">Throughput</TableCell>
                      <TableCell align="right">Avg Size</TableCell>
                      <TableCell align="right">Error Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.from(protocolMetrics.entries()).map(([protocol, metrics]) => {
                      const avgSize = metrics.messageCount > 0 ? metrics.totalBytes / metrics.messageCount : 0;
                      const avgLatency = metrics.encodingTime.average + metrics.decodingTime.average;
                      return (
                        <TableRow
                          key={protocol}
                          sx={{
                            bgcolor: protocol === currentProtocol ? alpha(theme.palette.primary.main, 0.1) : 'transparent'
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {protocolNames[protocol]}
                              {protocol === currentProtocol && (
                                <Chip label="Active" size="small" color="primary" />
                              )}
                            </Box>
                          </TableCell>
                          <TableCell align="right">{metrics.messageCount}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ color: getMetricColor(avgLatency, 'latency') }}
                            >
                              {avgLatency.toFixed(1)}ms
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ color: getMetricColor(metrics.throughput, 'throughput') }}
                            >
                              {formatBytes(metrics.throughput)}/s
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatBytes(avgSize)}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ color: getMetricColor(metrics.errorRate, 'error') }}
                            >
                              {(metrics.errorRate * 100).toFixed(2)}%
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}

          {/* Switch History */}
          {showHistory && switchHistory.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HistoryIcon color="action" />
                <Typography variant="subtitle1">Protocol Switch History</Typography>
              </Box>
              <Stack spacing={1}>
                {switchHistory.slice(0, 5).map((entry, index) => (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ p: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.5) }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {protocolNames[entry.from]} → {protocolNames[entry.to]}
                        </Typography>
                        <Chip
                          label={entry.reason}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatTimeAgo(entry.timestamp)}
                      </Typography>
                    </Box>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};