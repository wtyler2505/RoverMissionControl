import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  Settings as SettingsIcon,
  Extension as ExtensionIcon,
  Router as RouterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import axios from 'axios';

interface DeviceCapability {
  capability_id: string;
  name: string;
  category: string;
  supported: boolean;
  version?: string;
  parameters: Record<string, any>;
  limitations: string[];
}

interface DeviceCapabilities {
  device_id: string;
  device_name: string;
  protocol_type: string;
  firmware_version?: string;
  hardware_version?: string;
  max_baud_rate?: number;
  supported_protocols: string[];
  buffer_size?: number;
  capabilities: DeviceCapability[];
  max_throughput?: number;
  max_packet_size?: number;
  min_response_time?: number;
  metadata: Record<string, any>;
}

interface CapabilityViewerProps {
  deviceId: string;
  onClose?: () => void;
}

const CapabilityViewer: React.FC<CapabilityViewerProps> = ({ deviceId, onClose }) => {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['communication']);

  useEffect(() => {
    fetchCapabilities();
  }, [deviceId]);

  const fetchCapabilities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(`/api/hardware/diagnostics/capabilities/${deviceId}`);
      setCapabilities(response.data);
    } catch (err) {
      setError('Failed to fetch device capabilities');
      console.error('Error fetching capabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'communication':
        return <RouterIcon />;
      case 'performance':
        return <SpeedIcon />;
      case 'storage':
        return <StorageIcon />;
      case 'features':
        return <ExtensionIcon />;
      default:
        return <SettingsIcon />;
    }
  };

  const formatValue = (value: any): string => {
    if (typeof value === 'number') {
      if (value > 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
      } else if (value > 1000) {
        return `${(value / 1000).toFixed(2)}K`;
      }
      return value.toString();
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const groupCapabilitiesByCategory = () => {
    if (!capabilities) return {};
    
    return capabilities.capabilities.reduce((acc, cap) => {
      if (!acc[cap.category]) {
        acc[cap.category] = [];
      }
      acc[cap.category].push(cap);
      return acc;
    }, {} as Record<string, DeviceCapability[]>);
  };

  const handleCategoryToggle = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !capabilities) {
    return (
      <Alert severity="error" action={
        <IconButton size="small" onClick={fetchCapabilities}>
          <RefreshIcon />
        </IconButton>
      }>
        {error || 'Failed to load capabilities'}
      </Alert>
    );
  }

  const groupedCapabilities = groupCapabilitiesByCategory();

  return (
    <Box>
      {/* Device Overview */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {capabilities.device_name} Capabilities
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Protocol Type"
                    secondary={capabilities.protocol_type.toUpperCase()}
                  />
                </ListItem>
                {capabilities.firmware_version && (
                  <ListItem>
                    <ListItemText
                      primary="Firmware Version"
                      secondary={capabilities.firmware_version}
                    />
                  </ListItem>
                )}
                {capabilities.hardware_version && (
                  <ListItem>
                    <ListItemText
                      primary="Hardware Version"
                      secondary={capabilities.hardware_version}
                    />
                  </ListItem>
                )}
              </List>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <List dense>
                {capabilities.max_baud_rate && (
                  <ListItem>
                    <ListItemText
                      primary="Max Baud Rate"
                      secondary={`${capabilities.max_baud_rate.toLocaleString()} bps`}
                    />
                  </ListItem>
                )}
                {capabilities.buffer_size && (
                  <ListItem>
                    <ListItemText
                      primary="Buffer Size"
                      secondary={`${capabilities.buffer_size} bytes`}
                    />
                  </ListItem>
                )}
                {capabilities.max_packet_size && (
                  <ListItem>
                    <ListItemText
                      primary="Max Packet Size"
                      secondary={`${capabilities.max_packet_size} bytes`}
                    />
                  </ListItem>
                )}
              </List>
            </Grid>
          </Grid>

          {/* Supported Protocols */}
          {capabilities.supported_protocols.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Supported Protocols
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {capabilities.supported_protocols.map((protocol) => (
                  <Chip
                    key={protocol}
                    label={protocol}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Capabilities by Category */}
      {Object.entries(groupedCapabilities).map(([category, caps]) => (
        <Accordion
          key={category}
          expanded={expandedCategories.includes(category)}
          onChange={() => handleCategoryToggle(category)}
          sx={{ mb: 1 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box display="flex" alignItems="center" gap={2}>
              {getCategoryIcon(category)}
              <Typography variant="h6">
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Typography>
              <Badge badgeContent={caps.length} color="primary">
                <Box />
              </Badge>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Capability</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell>Version</TableCell>
                    <TableCell>Parameters</TableCell>
                    <TableCell>Limitations</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {caps.map((cap) => (
                    <TableRow key={cap.capability_id}>
                      <TableCell>
                        <Typography variant="body2">{cap.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {cap.capability_id}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        {cap.supported ? (
                          <Tooltip title="Supported">
                            <CheckIcon color="success" />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Not Supported">
                            <CancelIcon color="error" />
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        {cap.version || '-'}
                      </TableCell>
                      <TableCell>
                        {Object.keys(cap.parameters).length > 0 ? (
                          <Box>
                            {Object.entries(cap.parameters).map(([key, value]) => (
                              <Typography key={key} variant="caption" display="block">
                                {key}: {formatValue(value)}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {cap.limitations.length > 0 ? (
                          <Box>
                            {cap.limitations.map((limitation, idx) => (
                              <Typography key={idx} variant="caption" display="block" color="warning.main">
                                • {limitation}
                              </Typography>
                            ))}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Performance Limits */}
      {(capabilities.max_throughput || capabilities.min_response_time) && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance Limits
            </Typography>
            <Grid container spacing={2}>
              {capabilities.max_throughput && (
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SpeedIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2">Max Throughput</Typography>
                      <Typography variant="h5">
                        {(capabilities.max_throughput / 1024).toFixed(2)} KB/s
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}
              {capabilities.min_response_time && (
                <Grid item xs={12} sm={6}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <SpeedIcon color="primary" />
                    <Box>
                      <Typography variant="subtitle2">Min Response Time</Typography>
                      <Typography variant="h5">
                        {capabilities.min_response_time} ms
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Additional Metadata */}
      {Object.keys(capabilities.metadata).length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Additional Information
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {Object.entries(capabilities.metadata).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell component="th" scope="row">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </TableCell>
                      <TableCell>{formatValue(value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CapabilityViewer;