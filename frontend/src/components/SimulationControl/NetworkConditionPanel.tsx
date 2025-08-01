/**
 * Network Condition Panel
 * Controls network simulation parameters
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Alert,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  NetworkCheck,
  SignalCellular4Bar,
  SignalCellular2Bar,
  SignalCellular0Bar,
  Wifi,
  WifiOff,
  Satellite,
  Speed,
  Timer,
  Warning,
  Refresh,
  Save,
  CloudOff,
  Settings,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { NetworkProfile, NetworkConditionType } from './types';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface NetworkConditionPanelProps {
  currentProfile: NetworkProfile | null;
  onProfileChange: (profileName: string) => void;
}

interface NetworkStats {
  latency: number[];
  packetLoss: number[];
  bandwidth: number[];
  timestamps: string[];
}

const predefinedProfiles: Record<string, Partial<NetworkProfile>> = {
  perfect: {
    name: 'Perfect Network',
    latencyBase: 0.1,
    latencyVariation: 0,
    packetLossRate: 0,
    bandwidthLimit: Infinity,
  },
  satellite: {
    name: 'Satellite Connection',
    latencyBase: 600,
    latencyVariation: 50,
    packetLossRate: 0.01,
    bandwidthLimit: 10 * 1024 * 1024, // 10 Mbps
  },
  cellular_4g: {
    name: '4G Cellular',
    latencyBase: 50,
    latencyVariation: 20,
    packetLossRate: 0.005,
    bandwidthLimit: 50 * 1024 * 1024, // 50 Mbps
  },
  cellular_3g: {
    name: '3G Cellular',
    latencyBase: 150,
    latencyVariation: 50,
    packetLossRate: 0.02,
    bandwidthLimit: 2 * 1024 * 1024, // 2 Mbps
  },
  wifi_good: {
    name: 'Good WiFi',
    latencyBase: 5,
    latencyVariation: 2,
    packetLossRate: 0.001,
    bandwidthLimit: 100 * 1024 * 1024, // 100 Mbps
  },
  wifi_poor: {
    name: 'Poor WiFi',
    latencyBase: 50,
    latencyVariation: 30,
    packetLossRate: 0.05,
    bandwidthLimit: 5 * 1024 * 1024, // 5 Mbps
  },
  congested: {
    name: 'Congested Network',
    latencyBase: 100,
    latencyVariation: 100,
    packetLossRate: 0.1,
    bandwidthLimit: 1 * 1024 * 1024, // 1 Mbps
  }
};

const getNetworkIcon = (profileName: string) => {
  switch (profileName) {
    case 'satellite':
      return <Satellite />;
    case 'cellular_4g':
      return <SignalCellular4Bar />;
    case 'cellular_3g':
      return <SignalCellular2Bar />;
    case 'wifi_good':
      return <Wifi />;
    case 'wifi_poor':
      return <WifiOff />;
    case 'congested':
      return <SignalCellular0Bar />;
    default:
      return <NetworkCheck />;
  }
};

export const NetworkConditionPanel: React.FC<NetworkConditionPanelProps> = ({
  currentProfile,
  onProfileChange
}) => {
  const [selectedProfile, setSelectedProfile] = useState<string>(
    currentProfile?.name || 'wifi_good'
  );
  const [customProfile, setCustomProfile] = useState<NetworkProfile>({
    name: 'Custom',
    latencyBase: 50,
    latencyVariation: 10,
    latencySpikeProbability: 0.05,
    latencySpikeMultiplier: 5,
    packetLossRate: 0.01,
    burstLossProbability: 0.02,
    burstLossDuration: 1,
    bandwidthLimit: 10 * 1024 * 1024,
    bandwidthVariation: 0.1,
    connectionDropRate: 0.5,
    connectionRecoveryTime: 5,
    corruptionRate: 0.001,
    duplicationRate: 0.001,
    reorderRate: 0.01,
    reorderDelay: 100,
    uploadMultiplier: 1,
    enableTimePatterns: false,
    peakHours: [9, 17],
    peakDegradation: 0.5
  });
  
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Mock network statistics
  const [networkStats] = useState<NetworkStats>({
    latency: [45, 48, 52, 46, 55, 49, 51, 47, 53, 48],
    packetLoss: [0, 0.5, 0, 1, 0, 0, 0.5, 0, 0, 0],
    bandwidth: [45, 48, 44, 46, 42, 47, 45, 46, 44, 45],
    timestamps: Array.from({ length: 10 }, (_, i) => 
      new Date(Date.now() - (9 - i) * 1000).toLocaleTimeString()
    )
  });
  
  const handleProfileSelect = (profileName: string) => {
    setSelectedProfile(profileName);
    if (profileName === 'custom') {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      onProfileChange(profileName);
    }
  };
  
  const handleCustomProfileApply = () => {
    // In a real implementation, this would send the custom profile to the backend
    onProfileChange('custom');
  };
  
  const formatBandwidth = (bandwidth: number): string => {
    if (bandwidth === Infinity) return 'Unlimited';
    if (bandwidth >= 1024 * 1024) {
      return `${(bandwidth / (1024 * 1024)).toFixed(1)} Mbps`;
    }
    if (bandwidth >= 1024) {
      return `${(bandwidth / 1024).toFixed(1)} Kbps`;
    }
    return `${bandwidth} bps`;
  };
  
  const latencyChartData = {
    labels: networkStats.timestamps,
    datasets: [
      {
        label: 'Latency (ms)',
        data: networkStats.latency,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }
    ]
  };
  
  const packetLossChartData = {
    labels: networkStats.timestamps,
    datasets: [
      {
        label: 'Packet Loss (%)',
        data: networkStats.packetLoss,
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1
      }
    ]
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      x: {
        display: false
      },
      y: {
        beginAtZero: true
      }
    }
  };
  
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Network Conditions
      </Typography>
      
      {/* Profile Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Network Profile</InputLabel>
                <Select
                  value={selectedProfile}
                  onChange={(e) => handleProfileSelect(e.target.value)}
                  label="Network Profile"
                >
                  {Object.keys(predefinedProfiles).map((key) => (
                    <MenuItem key={key} value={key}>
                      <Box display="flex" alignItems="center" gap={1}>
                        {getNetworkIcon(key)}
                        {predefinedProfiles[key].name}
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem value="custom">
                    <Box display="flex" alignItems="center" gap={1}>
                      <Settings />
                      Custom Profile
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {/* Current Profile Summary */}
            {!isCustomMode && currentProfile && (
              <Grid item xs={12}>
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Latency"
                      secondary={`${currentProfile.latencyBase}ms ± ${currentProfile.latencyVariation}ms`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Packet Loss"
                      secondary={`${(currentProfile.packetLossRate * 100).toFixed(2)}%`}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Bandwidth"
                      secondary={formatBandwidth(currentProfile.bandwidthLimit)}
                    />
                  </ListItem>
                </List>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
      
      {/* Custom Profile Configuration */}
      {isCustomMode && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Custom Network Profile
            </Typography>
            
            <Grid container spacing={2}>
              {/* Latency Configuration */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Latency Configuration
                </Typography>
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Base Latency (ms)"
                  type="number"
                  value={customProfile.latencyBase}
                  onChange={(e) => setCustomProfile({
                    ...customProfile,
                    latencyBase: Number(e.target.value)
                  })}
                />
              </Grid>
              
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Latency Variation (ms)"
                  type="number"
                  value={customProfile.latencyVariation}
                  onChange={(e) => setCustomProfile({
                    ...customProfile,
                    latencyVariation: Number(e.target.value)
                  })}
                />
              </Grid>
              
              {/* Packet Loss Configuration */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Packet Loss Configuration
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography gutterBottom>
                  Packet Loss Rate: {(customProfile.packetLossRate * 100).toFixed(1)}%
                </Typography>
                <Slider
                  value={customProfile.packetLossRate * 100}
                  onChange={(e, value) => setCustomProfile({
                    ...customProfile,
                    packetLossRate: (value as number) / 100
                  })}
                  min={0}
                  max={50}
                  step={0.1}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 10, label: '10%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' }
                  ]}
                />
              </Grid>
              
              {/* Bandwidth Configuration */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                  Bandwidth Configuration
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Typography gutterBottom>
                  Bandwidth Limit: {formatBandwidth(customProfile.bandwidthLimit)}
                </Typography>
                <Slider
                  value={Math.log10(customProfile.bandwidthLimit)}
                  onChange={(e, value) => setCustomProfile({
                    ...customProfile,
                    bandwidthLimit: Math.pow(10, value as number)
                  })}
                  min={3} // 1 Kbps
                  max={9} // 1 Gbps
                  step={0.1}
                  marks={[
                    { value: 3, label: '1 Kbps' },
                    { value: 6, label: '1 Mbps' },
                    { value: 9, label: '1 Gbps' }
                  ]}
                />
              </Grid>
              
              {/* Advanced Settings */}
              <Grid item xs={12}>
                <Button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  endIcon={showAdvanced ? <ExpandLess /> : <ExpandMore />}
                >
                  Advanced Settings
                </Button>
              </Grid>
              
              {showAdvanced && (
                <>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Connection Drop Rate (per hour)"
                      type="number"
                      value={customProfile.connectionDropRate}
                      onChange={(e) => setCustomProfile({
                        ...customProfile,
                        connectionDropRate: Number(e.target.value)
                      })}
                    />
                  </Grid>
                  
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Recovery Time (seconds)"
                      type="number"
                      value={customProfile.connectionRecoveryTime}
                      onChange={(e) => setCustomProfile({
                        ...customProfile,
                        connectionRecoveryTime: Number(e.target.value)
                      })}
                    />
                  </Grid>
                  
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Corruption Rate"
                      type="number"
                      value={customProfile.corruptionRate}
                      onChange={(e) => setCustomProfile({
                        ...customProfile,
                        corruptionRate: Number(e.target.value)
                      })}
                      inputProps={{ step: 0.001, min: 0, max: 1 }}
                    />
                  </Grid>
                  
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Duplication Rate"
                      type="number"
                      value={customProfile.duplicationRate}
                      onChange={(e) => setCustomProfile({
                        ...customProfile,
                        duplicationRate: Number(e.target.value)
                      })}
                      inputProps={{ step: 0.001, min: 0, max: 1 }}
                    />
                  </Grid>
                  
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      label="Reorder Rate"
                      type="number"
                      value={customProfile.reorderRate}
                      onChange={(e) => setCustomProfile({
                        ...customProfile,
                        reorderRate: Number(e.target.value)
                      })}
                      inputProps={{ step: 0.001, min: 0, max: 1 }}
                    />
                  </Grid>
                </>
              )}
              
              <Grid item xs={12}>
                <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                  <Button
                    variant="outlined"
                    onClick={() => setIsCustomMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleCustomProfileApply}
                    startIcon={<Save />}
                  >
                    Apply Custom Profile
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {/* Network Statistics */}
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              Network Statistics
            </Typography>
            <Tooltip title="Refresh">
              <IconButton size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Grid container spacing={2}>
            {/* Latency Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 200 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Latency
                </Typography>
                <Box sx={{ height: 150 }}>
                  <Line data={latencyChartData} options={chartOptions} />
                </Box>
              </Paper>
            </Grid>
            
            {/* Packet Loss Chart */}
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2, height: 200 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Packet Loss
                </Typography>
                <Box sx={{ height: 150 }}>
                  <Line data={packetLossChartData} options={chartOptions} />
                </Box>
              </Paper>
            </Grid>
            
            {/* Connection Status */}
            <Grid item xs={12}>
              <Alert severity="success" icon={<NetworkCheck />}>
                Connection Active - {currentProfile?.name || 'Unknown Profile'}
              </Alert>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};