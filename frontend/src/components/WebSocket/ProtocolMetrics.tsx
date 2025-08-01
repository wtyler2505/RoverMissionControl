/**
 * ProtocolMetrics Component
 * Comprehensive protocol performance metrics visualization with real-time updates,
 * export capabilities, and performance recommendations
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  IconButton,
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Chip,
  Tooltip,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Divider,
  Alert,
  AlertTitle,
  Collapse,
  useTheme,
  alpha,
  Stack,
  LinearProgress,
  Badge
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timer as TimerIcon,
  Speed as SpeedIcon,
  Compress as CompressIcon,
  DataUsage as DataUsageIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CompareArrows as CompareArrowsIcon,
  SaveAlt as SaveAltIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Treemap,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Brush,
  ComposedChart
} from 'recharts';
import { format, subMinutes } from 'date-fns';
import { useWebSocket } from './WebSocketProvider';
import {
  Protocol,
  MessageType,
  ProtocolMetrics as IProtocolMetrics,
  ProtocolRecommendation,
  ProtocolSwitchEvent
} from '../../services/websocket/types';

// Time range options
enum TimeRange {
  LAST_5_MIN = 5,
  LAST_15_MIN = 15,
  LAST_30_MIN = 30,
  LAST_1_HR = 60,
  LAST_6_HR = 360,
  LAST_24_HR = 1440
}

// Metric data point interface
interface MetricDataPoint {
  timestamp: number;
  protocol: Protocol;
  encodingTime: number;
  decodingTime: number;
  messageSize: number;
  compressed: boolean;
  compressionRatio?: number;
  messageType: MessageType;
  throughput: number;
  errorRate: number;
  latency: number;
}

// Protocol comparison data
interface ProtocolComparison {
  protocol: Protocol;
  avgEncodingTime: number;
  avgDecodingTime: number;
  avgMessageSize: number;
  avgCompressionRatio: number;
  throughput: number;
  errorRate: number;
  efficiency: number; // Custom efficiency score
  messageCount: number;
  totalBytes: number;
}

// Message distribution data
interface MessageDistribution {
  type: MessageType;
  count: number;
  percentage: number;
  avgSize: number;
  protocol: Protocol;
}

// Export format options
enum ExportFormat {
  CSV = 'csv',
  JSON = 'json'
}

// Chart color palette
const PROTOCOL_COLORS: Record<Protocol, string> = {
  [Protocol.JSON]: '#2196F3',
  [Protocol.MESSAGEPACK]: '#4CAF50',
  [Protocol.CBOR]: '#FF9800',
  [Protocol.BINARY]: '#9C27B0'
};

const MESSAGE_TYPE_COLORS: Record<MessageType, string> = {
  [MessageType.COMMAND]: '#F44336',
  [MessageType.TELEMETRY]: '#2196F3',
  [MessageType.STATUS]: '#4CAF50',
  [MessageType.HEARTBEAT]: '#FF9800',
  [MessageType.AUTH]: '#9C27B0',
  [MessageType.ERROR]: '#E91E63',
  [MessageType.NOTIFICATION]: '#00BCD4',
  [MessageType.BINARY]: '#795548'
};

// Custom tooltip component
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Paper elevation={3} sx={{ p: 1.5 }}>
        <Typography variant="body2" color="textSecondary">
          {format(label, 'MMM dd, HH:mm:ss')}
        </Typography>
        {payload.map((entry: any, index: number) => (
          <Typography
            key={index}
            variant="body2"
            style={{ color: entry.color }}
          >
            {entry.name}: {typeof entry.value === 'number' 
              ? entry.value.toFixed(2) 
              : entry.value}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

// Percentile calculation helper
const calculatePercentile = (values: number[], percentile: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

// Format bytes helper
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Main ProtocolMetrics Component
 */
export const ProtocolMetrics: React.FC = () => {
  const theme = useTheme();
  const { client, connectionStatus } = useWebSocket();
  
  // State
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.LAST_15_MIN);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | 'all'>('all');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    performance: true,
    efficiency: true,
    distribution: true,
    timeline: true,
    recommendations: true
  });
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [recommendation, setRecommendation] = useState<ProtocolRecommendation | null>(null);
  
  // Data storage
  const metricsHistory = useRef<MetricDataPoint[]>([]);
  const protocolSwitches = useRef<ProtocolSwitchEvent[]>([]);
  const refreshInterval = useRef<NodeJS.Timeout>();
  
  // Fetch and update metrics
  const updateMetrics = useCallback(() => {
    if (!client) return;
    
    // Get current protocol metrics
    const protocolMetrics = client.getProtocolMetrics();
    const currentProtocol = client.getCurrentProtocol();
    const protocolRecommendation = client.getProtocolRecommendation();
    
    // Create new data point
    const newDataPoint: MetricDataPoint = {
      timestamp: Date.now(),
      protocol: currentProtocol,
      encodingTime: 0,
      decodingTime: 0,
      messageSize: 0,
      compressed: false,
      compressionRatio: 1,
      messageType: MessageType.TELEMETRY,
      throughput: 0,
      errorRate: 0,
      latency: connectionStatus.metrics.currentLatency
    };
    
    // Process protocol metrics
    protocolMetrics.forEach((metrics, protocol) => {
      if (protocol === currentProtocol) {
        newDataPoint.encodingTime = metrics.encodingTime.average;
        newDataPoint.decodingTime = metrics.decodingTime.average;
        newDataPoint.messageSize = metrics.averageMessageSize;
        newDataPoint.compressionRatio = metrics.compressionRatio;
        newDataPoint.throughput = metrics.throughput;
        newDataPoint.errorRate = metrics.errorRate;
      }
    });
    
    // Add to history
    metricsHistory.current.push(newDataPoint);
    
    // Trim old data based on time range
    const cutoffTime = Date.now() - (TimeRange.LAST_24_HR * 60 * 1000);
    metricsHistory.current = metricsHistory.current.filter(
      point => point.timestamp > cutoffTime
    );
    
    // Update recommendation
    if (protocolRecommendation) {
      setRecommendation(protocolRecommendation);
    }
  }, [client, connectionStatus]);
  
  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && client) {
      updateMetrics();
      refreshInterval.current = setInterval(updateMetrics, 5000); // 5 second refresh
    }
    
    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, client, updateMetrics]);
  
  // Listen for protocol switches
  useEffect(() => {
    if (!client) return;
    
    const handleProtocolSwitch = (event: ProtocolSwitchEvent) => {
      protocolSwitches.current.push(event);
    };
    
    // @ts-ignore - Event type handling
    client.on('protocol:switched', handleProtocolSwitch);
    
    return () => {
      // @ts-ignore
      client.off('protocol:switched', handleProtocolSwitch);
    };
  }, [client]);
  
  // Filter data based on time range
  const filteredData = useMemo(() => {
    const cutoffTime = Date.now() - (timeRange * 60 * 1000);
    return metricsHistory.current.filter(point => point.timestamp > cutoffTime);
  }, [timeRange, metricsHistory.current.length]);
  
  // Calculate protocol comparisons
  const protocolComparisons = useMemo((): ProtocolComparison[] => {
    const comparisons = new Map<Protocol, ProtocolComparison>();
    
    // Initialize comparisons
    Object.values(Protocol).forEach(protocol => {
      comparisons.set(protocol, {
        protocol,
        avgEncodingTime: 0,
        avgDecodingTime: 0,
        avgMessageSize: 0,
        avgCompressionRatio: 1,
        throughput: 0,
        errorRate: 0,
        efficiency: 0,
        messageCount: 0,
        totalBytes: 0
      });
    });
    
    // Calculate averages from filtered data
    filteredData.forEach(point => {
      const comp = comparisons.get(point.protocol)!;
      comp.messageCount++;
      comp.totalBytes += point.messageSize;
      comp.avgEncodingTime += point.encodingTime;
      comp.avgDecodingTime += point.decodingTime;
      comp.avgMessageSize += point.messageSize;
      comp.avgCompressionRatio += point.compressionRatio || 1;
      comp.throughput += point.throughput;
      comp.errorRate += point.errorRate;
    });
    
    // Calculate averages and efficiency
    comparisons.forEach(comp => {
      if (comp.messageCount > 0) {
        comp.avgEncodingTime /= comp.messageCount;
        comp.avgDecodingTime /= comp.messageCount;
        comp.avgMessageSize /= comp.messageCount;
        comp.avgCompressionRatio /= comp.messageCount;
        comp.throughput /= comp.messageCount;
        comp.errorRate /= comp.messageCount;
        
        // Calculate efficiency score (0-100)
        const latencyScore = Math.max(0, 100 - (comp.avgEncodingTime + comp.avgDecodingTime));
        const compressionScore = comp.avgCompressionRatio * 20;
        const throughputScore = Math.min(100, comp.throughput);
        const errorScore = Math.max(0, 100 - (comp.errorRate * 100));
        
        comp.efficiency = (latencyScore + compressionScore + throughputScore + errorScore) / 4;
      }
    });
    
    return Array.from(comparisons.values()).filter(comp => comp.messageCount > 0);
  }, [filteredData]);
  
  // Calculate message distribution
  const messageDistribution = useMemo((): MessageDistribution[] => {
    const distribution = new Map<MessageType, MessageDistribution>();
    
    // Initialize distribution
    Object.values(MessageType).forEach(type => {
      distribution.set(type, {
        type,
        count: 0,
        percentage: 0,
        avgSize: 0,
        protocol: Protocol.JSON
      });
    });
    
    // Calculate distribution from filtered data
    const totalMessages = filteredData.length;
    filteredData.forEach(point => {
      const dist = distribution.get(point.messageType)!;
      dist.count++;
      dist.avgSize += point.messageSize;
    });
    
    // Calculate percentages and averages
    distribution.forEach(dist => {
      if (dist.count > 0) {
        dist.percentage = (dist.count / totalMessages) * 100;
        dist.avgSize /= dist.count;
      }
    });
    
    return Array.from(distribution.values()).filter(dist => dist.count > 0);
  }, [filteredData]);
  
  // Calculate percentile metrics
  const percentileMetrics = useMemo(() => {
    const encodingTimes = filteredData.map(d => d.encodingTime);
    const decodingTimes = filteredData.map(d => d.decodingTime);
    const latencies = filteredData.map(d => d.latency);
    
    return {
      encoding: {
        p50: calculatePercentile(encodingTimes, 50),
        p95: calculatePercentile(encodingTimes, 95),
        p99: calculatePercentile(encodingTimes, 99)
      },
      decoding: {
        p50: calculatePercentile(decodingTimes, 50),
        p95: calculatePercentile(decodingTimes, 95),
        p99: calculatePercentile(decodingTimes, 99)
      },
      latency: {
        p50: calculatePercentile(latencies, 50),
        p95: calculatePercentile(latencies, 95),
        p99: calculatePercentile(latencies, 99)
      }
    };
  }, [filteredData]);
  
  // Handle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Handle export
  const handleExport = (format: ExportFormat) => {
    const data = {
      timestamp: new Date().toISOString(),
      timeRange: `Last ${timeRange} minutes`,
      metrics: filteredData,
      protocolComparisons,
      messageDistribution,
      percentileMetrics,
      protocolSwitches: protocolSwitches.current,
      recommendation
    };
    
    let content: string;
    let filename: string;
    let mimeType: string;
    
    if (format === ExportFormat.JSON) {
      content = JSON.stringify(data, null, 2);
      filename = `protocol-metrics-${Date.now()}.json`;
      mimeType = 'application/json';
    } else {
      // Convert to CSV
      const headers = [
        'Timestamp',
        'Protocol',
        'Encoding Time (ms)',
        'Decoding Time (ms)',
        'Message Size (bytes)',
        'Compression Ratio',
        'Throughput (msg/s)',
        'Error Rate',
        'Latency (ms)'
      ];
      
      const rows = filteredData.map(point => [
        new Date(point.timestamp).toISOString(),
        point.protocol,
        point.encodingTime.toFixed(2),
        point.decodingTime.toFixed(2),
        point.messageSize,
        point.compressionRatio?.toFixed(2) || '1.00',
        point.throughput.toFixed(2),
        point.errorRate.toFixed(4),
        point.latency.toFixed(2)
      ]);
      
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
      filename = `protocol-metrics-${Date.now()}.csv`;
      mimeType = 'text/csv';
    }
    
    // Create download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setExportMenuAnchor(null);
  };
  
  // Render performance chart
  const renderPerformanceChart = () => {
    const chartData = filteredData.map(point => ({
      timestamp: point.timestamp,
      encodingTime: point.encodingTime,
      decodingTime: point.decodingTime,
      totalTime: point.encodingTime + point.decodingTime,
      protocol: point.protocol
    }));
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => format(value, 'HH:mm:ss')}
            stroke={theme.palette.text.secondary}
          />
          <YAxis
            label={{ value: 'Time (ms)', angle: -90, position: 'insideLeft' }}
            stroke={theme.palette.text.secondary}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="encodingTime"
            stackId="1"
            fill={alpha(theme.palette.primary.main, 0.6)}
            stroke={theme.palette.primary.main}
            name="Encoding Time"
          />
          <Area
            type="monotone"
            dataKey="decodingTime"
            stackId="1"
            fill={alpha(theme.palette.secondary.main, 0.6)}
            stroke={theme.palette.secondary.main}
            name="Decoding Time"
          />
          <Line
            type="monotone"
            dataKey="totalTime"
            stroke={theme.palette.error.main}
            strokeWidth={2}
            dot={false}
            name="Total Time"
          />
          <Brush
            dataKey="timestamp"
            height={30}
            stroke={theme.palette.primary.main}
            tickFormatter={(value) => format(value, 'HH:mm')}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  };
  
  // Render protocol comparison chart
  const renderProtocolComparisonChart = () => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={protocolComparisons}>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
          <XAxis dataKey="protocol" stroke={theme.palette.text.secondary} />
          <YAxis stroke={theme.palette.text.secondary} />
          <RechartsTooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="avgEncodingTime" fill={theme.palette.primary.main} name="Avg Encoding (ms)" />
          <Bar dataKey="avgDecodingTime" fill={theme.palette.secondary.main} name="Avg Decoding (ms)" />
          <Bar dataKey="efficiency" fill={theme.palette.success.main} name="Efficiency Score" />
        </BarChart>
      </ResponsiveContainer>
    );
  };
  
  // Render message distribution pie chart
  const renderMessageDistributionChart = () => {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={messageDistribution}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.type}: ${entry.percentage.toFixed(1)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="percentage"
          >
            {messageDistribution.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={MESSAGE_TYPE_COLORS[entry.type] || theme.palette.grey[500]} 
              />
            ))}
          </Pie>
          <RechartsTooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  };
  
  // Render bandwidth usage chart
  const renderBandwidthChart = () => {
    const bandwidthData = filteredData.reduce((acc: any[], point, index) => {
      if (index % 5 === 0) { // Sample every 5th point for performance
        const bandwidth = (point.messageSize * point.throughput) / 1024; // KB/s
        acc.push({
          timestamp: point.timestamp,
          bandwidth,
          protocol: point.protocol
        });
      }
      return acc;
    }, []);
    
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={bandwidthData}>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => format(value, 'HH:mm:ss')}
            stroke={theme.palette.text.secondary}
          />
          <YAxis
            label={{ value: 'Bandwidth (KB/s)', angle: -90, position: 'insideLeft' }}
            stroke={theme.palette.text.secondary}
          />
          <RechartsTooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="bandwidth"
            stroke={theme.palette.info.main}
            fill={alpha(theme.palette.info.main, 0.6)}
            name="Bandwidth Usage"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  };
  
  // Render protocol timeline
  const renderProtocolTimeline = () => {
    const timelineData = protocolSwitches.current.map(switchEvent => ({
      timestamp: switchEvent.timestamp,
      event: `${switchEvent.from} → ${switchEvent.to}`,
      reason: switchEvent.reason,
      value: 1
    }));
    
    if (timelineData.length === 0) {
      return (
        <Box p={3} textAlign="center">
          <Typography variant="body2" color="textSecondary">
            No protocol switches recorded in the selected time range
          </Typography>
        </Box>
      );
    }
    
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={timelineData} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(value) => format(value, 'HH:mm:ss')}
            stroke={theme.palette.text.secondary}
          />
          <YAxis hide />
          <RechartsTooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <Paper elevation={3} sx={{ p: 1.5 }}>
                    <Typography variant="body2">{data.event}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Reason: {data.reason}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {format(data.timestamp, 'MMM dd, HH:mm:ss')}
                    </Typography>
                  </Paper>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="value" fill={theme.palette.warning.main} />
        </BarChart>
      </ResponsiveContainer>
    );
  };
  
  // Render recommendation alert
  const renderRecommendation = () => {
    if (!recommendation) return null;
    
    const improvementKeys = Object.keys(recommendation.potentialImprovement) as Array<
      keyof typeof recommendation.potentialImprovement
    >;
    
    return (
      <Alert
        severity="info"
        icon={<TrendingUpIcon />}
        action={
          <Button
            size="small"
            onClick={() => {
              if (client) {
                client.switchProtocol(recommendation.recommendedProtocol);
              }
            }}
          >
            Switch Protocol
          </Button>
        }
      >
        <AlertTitle>Protocol Recommendation</AlertTitle>
        <Typography variant="body2">
          Consider switching from <Chip label={recommendation.currentProtocol} size="small" /> to{' '}
          <Chip label={recommendation.recommendedProtocol} size="small" color="primary" />
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {recommendation.reason}
        </Typography>
        <Box sx={{ mt: 1 }}>
          {improvementKeys.map(key => {
            const value = recommendation.potentialImprovement[key];
            if (value !== undefined) {
              return (
                <Chip
                  key={key}
                  label={`${key}: +${value}%`}
                  size="small"
                  color="success"
                  sx={{ mr: 1 }}
                />
              );
            }
            return null;
          })}
        </Box>
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          Confidence: {(recommendation.confidence * 100).toFixed(0)}%
        </Typography>
      </Alert>
    );
  };
  
  if (!client) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="h6" color="textSecondary">
          WebSocket not connected
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Protocol Performance Metrics
        </Typography>
        
        <Stack direction="row" spacing={2}>
          {/* Time Range Selector */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e: SelectChangeEvent<TimeRange>) => 
                setTimeRange(e.target.value as TimeRange)
              }
            >
              <MenuItem value={TimeRange.LAST_5_MIN}>Last 5 min</MenuItem>
              <MenuItem value={TimeRange.LAST_15_MIN}>Last 15 min</MenuItem>
              <MenuItem value={TimeRange.LAST_30_MIN}>Last 30 min</MenuItem>
              <MenuItem value={TimeRange.LAST_1_HR}>Last 1 hour</MenuItem>
              <MenuItem value={TimeRange.LAST_6_HR}>Last 6 hours</MenuItem>
              <MenuItem value={TimeRange.LAST_24_HR}>Last 24 hours</MenuItem>
            </Select>
          </FormControl>
          
          {/* Protocol Filter */}
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Protocol</InputLabel>
            <Select
              value={selectedProtocol}
              label="Protocol"
              onChange={(e) => setSelectedProtocol(e.target.value as Protocol | 'all')}
            >
              <MenuItem value="all">All Protocols</MenuItem>
              {Object.values(Protocol).map(protocol => (
                <MenuItem key={protocol} value={protocol}>
                  {protocol.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {/* Action Buttons */}
          <ButtonGroup variant="outlined" size="small">
            <Tooltip title={autoRefresh ? "Disable auto-refresh" : "Enable auto-refresh"}>
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                color={autoRefresh ? "primary" : "inherit"}
              >
                <RefreshIcon />
              </Button>
            </Tooltip>
            <Tooltip title="Toggle comparison mode">
              <Button
                onClick={() => setComparisonMode(!comparisonMode)}
                color={comparisonMode ? "primary" : "inherit"}
              >
                <CompareArrowsIcon />
              </Button>
            </Tooltip>
            <Tooltip title="Export metrics">
              <Button onClick={(e) => setExportMenuAnchor(e.currentTarget)}>
                <DownloadIcon />
              </Button>
            </Tooltip>
          </ButtonGroup>
          
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
          >
            <MenuItem onClick={() => handleExport(ExportFormat.CSV)}>
              Export as CSV
            </MenuItem>
            <MenuItem onClick={() => handleExport(ExportFormat.JSON)}>
              Export as JSON
            </MenuItem>
          </Menu>
        </Stack>
      </Box>
      
      {/* Recommendations */}
      {expandedSections.recommendations && (
        <Collapse in={expandedSections.recommendations}>
          <Box sx={{ mb: 3 }}>
            {renderRecommendation()}
          </Box>
        </Collapse>
      )}
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="caption">
                    Current Protocol
                  </Typography>
                  <Typography variant="h5">
                    {client.getCurrentProtocol().toUpperCase()}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
                  <DataUsageIcon color="primary" />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="caption">
                    Avg Latency (P95)
                  </Typography>
                  <Typography variant="h5">
                    {percentileMetrics.latency.p95.toFixed(1)} ms
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    P50: {percentileMetrics.latency.p50.toFixed(1)} ms
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
                  <SpeedIcon color="success" />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="caption">
                    Messages Processed
                  </Typography>
                  <Typography variant="h5">
                    {filteredData.length.toLocaleString()}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {formatBytes(
                      filteredData.reduce((sum, d) => sum + d.messageSize, 0)
                    )}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1) }}>
                  <AssessmentIcon color="info" />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="caption">
                    Compression Ratio
                  </Typography>
                  <Typography variant="h5">
                    {protocolComparisons
                      .find(p => p.protocol === client.getCurrentProtocol())
                      ?.avgCompressionRatio.toFixed(2) || '1.00'}x
                  </Typography>
                  <Typography variant="caption" color="success.main">
                    {((1 - 1 / (protocolComparisons
                      .find(p => p.protocol === client.getCurrentProtocol())
                      ?.avgCompressionRatio || 1)) * 100).toFixed(0)}% saved
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                  <CompressIcon color="warning" />
                </Avatar>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Performance Section */}
      <Paper sx={{ mb: 3 }}>
        <CardHeader
          title="Encoding/Decoding Performance"
          action={
            <IconButton onClick={() => toggleSection('performance')}>
              {expandedSections.performance ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          }
        />
        <Collapse in={expandedSections.performance}>
          <CardContent>
            {renderPerformanceChart()}
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">
                    Encoding (P50/P95/P99)
                  </Typography>
                  <Typography variant="body2">
                    {percentileMetrics.encoding.p50.toFixed(2)} / {' '}
                    {percentileMetrics.encoding.p95.toFixed(2)} / {' '}
                    {percentileMetrics.encoding.p99.toFixed(2)} ms
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">
                    Decoding (P50/P95/P99)
                  </Typography>
                  <Typography variant="body2">
                    {percentileMetrics.decoding.p50.toFixed(2)} / {' '}
                    {percentileMetrics.decoding.p95.toFixed(2)} / {' '}
                    {percentileMetrics.decoding.p99.toFixed(2)} ms
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="textSecondary">
                    Total Processing Time
                  </Typography>
                  <Typography variant="body2">
                    {(
                      percentileMetrics.encoding.p95 + percentileMetrics.decoding.p95
                    ).toFixed(2)} ms (P95)
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Collapse>
      </Paper>
      
      {/* Protocol Comparison */}
      {comparisonMode && (
        <Paper sx={{ mb: 3 }}>
          <CardHeader
            title="Protocol Efficiency Comparison"
            action={
              <IconButton onClick={() => toggleSection('efficiency')}>
                {expandedSections.efficiency ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            }
          />
          <Collapse in={expandedSections.efficiency}>
            <CardContent>
              {renderProtocolComparisonChart()}
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={2}>
                {protocolComparisons.map(comp => (
                  <Grid item xs={12} sm={6} md={3} key={comp.protocol}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="h6" color="primary">
                          {comp.protocol.toUpperCase()}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Messages: {comp.messageCount}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Total: {formatBytes(comp.totalBytes)}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Throughput: {comp.throughput.toFixed(1)} msg/s
                        </Typography>
                        <Typography variant="caption" display="block">
                          Error Rate: {(comp.errorRate * 100).toFixed(2)}%
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={comp.efficiency}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption" color="textSecondary">
                            Efficiency: {comp.efficiency.toFixed(0)}%
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Collapse>
        </Paper>
      )}
      
      {/* Message Distribution */}
      <Paper sx={{ mb: 3 }}>
        <CardHeader
          title="Message Type Distribution"
          action={
            <IconButton onClick={() => toggleSection('distribution')}>
              {expandedSections.distribution ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          }
        />
        <Collapse in={expandedSections.distribution}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                {renderMessageDistributionChart()}
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ height: 300, overflowY: 'auto' }}>
                  {messageDistribution.map(dist => (
                    <Box key={dist.type} sx={{ mb: 2 }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              width: 16,
                              height: 16,
                              borderRadius: 1,
                              bgcolor: MESSAGE_TYPE_COLORS[dist.type]
                            }}
                          />
                          <Typography variant="body2">
                            {dist.type}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="textSecondary">
                          {dist.count} ({dist.percentage.toFixed(1)}%)
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="textSecondary">
                        Avg size: {formatBytes(dist.avgSize)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Collapse>
      </Paper>
      
      {/* Network Bandwidth */}
      <Paper sx={{ mb: 3 }}>
        <CardHeader
          title="Network Bandwidth Usage"
          action={
            <IconButton onClick={() => toggleSection('timeline')}>
              {expandedSections.timeline ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          }
        />
        <Collapse in={expandedSections.timeline}>
          <CardContent>
            {renderBandwidthChart()}
          </CardContent>
        </Collapse>
      </Paper>
      
      {/* Protocol Switch Timeline */}
      <Paper>
        <CardHeader
          title="Protocol Switch Timeline"
          subheader={`${protocolSwitches.current.length} switches recorded`}
        />
        <CardContent>
          {renderProtocolTimeline()}
        </CardContent>
      </Paper>
    </Box>
  );
};

// Fix Avatar import
const Avatar = Box;

export default ProtocolMetrics;