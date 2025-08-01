/**
 * Transport Metrics Component
 * Displays detailed metrics for WebSocket and HTTP fallback transports
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  useTheme
} from '@mui/material';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useWebSocket } from './WebSocketProvider';
import { TransportType, TransportMetrics as ITransportMetrics } from '../../services/websocket/TransportManager';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, color, icon }) => {
  const theme = useTheme();
  
  return (
    <Card variant="outlined">
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="text.secondary" gutterBottom variant="caption">
              {title}
            </Typography>
            <Typography variant="h5" component="div" style={{ color }}>
              {value}{unit && <Typography variant="caption" component="span"> {unit}</Typography>}
            </Typography>
          </Box>
          {icon && (
            <Box color={color || theme.palette.text.secondary}>
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export const TransportMetrics: React.FC = () => {
  const { client } = useWebSocket();
  const theme = useTheme();
  const [metrics, setMetrics] = useState<Map<TransportType, ITransportMetrics>>(new Map());
  const [currentTransport, setCurrentTransport] = useState<TransportType>(TransportType.SOCKET_IO);
  const [compressionData, setCompressionData] = useState<any[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<any[]>([]);
  const [updateKey, setUpdateKey] = useState(0);

  useEffect(() => {
    if (!client) return;

    const updateMetrics = () => {
      const allMetrics = client.getTransportMetrics() as Map<TransportType, ITransportMetrics>;
      setMetrics(new Map(allMetrics));
      setCurrentTransport(client.getCurrentTransport());
      
      // Update compression data
      const compressionStats = [];
      for (const [transport, metric] of allMetrics) {
        if (metric.compressionSavings > 0) {
          compressionStats.push({
            transport: getTransportLabel(transport),
            savings: metric.compressionSavings / 1024, // Convert to KB
            ratio: (metric.compressionSavings / metric.bytessSent) * 100
          });
        }
      }
      setCompressionData(compressionStats);
      
      // Update latency history (keep last 10 samples)
      setLatencyHistory(prev => {
        const newEntry = {
          time: new Date().toLocaleTimeString(),
          ...Array.from(allMetrics.entries()).reduce((acc, [transport, metric]) => ({
            ...acc,
            [getTransportLabel(transport)]: metric.avgLatency
          }), {})
        };
        
        const updated = [...prev, newEntry];
        return updated.slice(-10);
      });
      
      setUpdateKey(prev => prev + 1);
    };

    // Initial update
    updateMetrics();

    // Update every 3 seconds
    const interval = setInterval(updateMetrics, 3000);

    return () => clearInterval(interval);
  }, [client]);

  const getTransportLabel = (type: TransportType): string => {
    switch (type) {
      case TransportType.WEBSOCKET:
        return 'WebSocket';
      case TransportType.SOCKET_IO:
        return 'Socket.IO';
      case TransportType.HTTP_LONGPOLL:
        return 'HTTP';
      default:
        return type;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const currentMetrics = metrics.get(currentTransport) || {
    messagessSent: 0,
    messagesReceived: 0,
    bytessSent: 0,
    bytesReceived: 0,
    errors: 0,
    reconnects: 0,
    avgLatency: 0,
    avgBandwidth: 0,
    compressionSavings: 0
  };

  const pieData = [
    { name: 'Sent', value: currentMetrics.bytessSent },
    { name: 'Received', value: currentMetrics.bytesReceived }
  ];

  const COLORS = [theme.palette.primary.main, theme.palette.secondary.main];

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Transport Metrics
      </Typography>
      
      {/* Current Transport Indicator */}
      <Box mb={3}>
        <Chip 
          label={`Current: ${getTransportLabel(currentTransport)}`}
          color="primary"
          size="medium"
        />
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Messages"
            value={currentMetrics.messagessSent + currentMetrics.messagesReceived}
            color={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Data Transferred"
            value={formatBytes(currentMetrics.bytessSent + currentMetrics.bytesReceived)}
            color={theme.palette.info.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Latency"
            value={currentMetrics.avgLatency.toFixed(1)}
            unit="ms"
            color={currentMetrics.avgLatency < 100 ? theme.palette.success.main : theme.palette.warning.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Error Rate"
            value={((currentMetrics.errors / (currentMetrics.messagessSent + currentMetrics.messagesReceived || 1)) * 100).toFixed(1)}
            unit="%"
            color={currentMetrics.errors > 0 ? theme.palette.error.main : theme.palette.success.main}
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Latency History Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Latency History
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={latencyHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                {Array.from(metrics.keys()).map((transport, index) => (
                  <Line
                    key={transport}
                    type="monotone"
                    dataKey={getTransportLabel(transport)}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Data Transfer Pie Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Data Transfer Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatBytes(value)} />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Compression Savings */}
        {compressionData.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Compression Savings
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compressionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="transport" />
                  <YAxis label={{ value: 'Savings (KB)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="savings" fill={theme.palette.primary.main} />
                  <Bar dataKey="ratio" fill={theme.palette.secondary.main} name="Ratio %" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* Detailed Metrics Table */}
      <Box mt={3}>
        <Typography variant="h6" gutterBottom>
          Transport Comparison
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Transport</TableCell>
                <TableCell align="right">Messages Sent</TableCell>
                <TableCell align="right">Messages Received</TableCell>
                <TableCell align="right">Data Sent</TableCell>
                <TableCell align="right">Data Received</TableCell>
                <TableCell align="right">Errors</TableCell>
                <TableCell align="right">Reconnects</TableCell>
                <TableCell align="right">Avg Latency</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from(metrics.entries()).map(([transport, metric]) => (
                <TableRow
                  key={transport}
                  sx={{ 
                    backgroundColor: transport === currentTransport ? 
                      theme.palette.action.selected : 'transparent'
                  }}
                >
                  <TableCell component="th" scope="row">
                    {getTransportLabel(transport)}
                    {transport === currentTransport && (
                      <Chip label="Active" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </TableCell>
                  <TableCell align="right">{metric.messagessSent}</TableCell>
                  <TableCell align="right">{metric.messagesReceived}</TableCell>
                  <TableCell align="right">{formatBytes(metric.bytessSent)}</TableCell>
                  <TableCell align="right">{formatBytes(metric.bytesReceived)}</TableCell>
                  <TableCell align="right">{metric.errors}</TableCell>
                  <TableCell align="right">{metric.reconnects}</TableCell>
                  <TableCell align="right">{metric.avgLatency.toFixed(1)} ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};