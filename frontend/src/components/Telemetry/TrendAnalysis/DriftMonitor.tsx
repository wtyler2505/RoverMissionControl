/**
 * DriftMonitor - Real-time drift detection visualization
 * Displays drift status, statistics, and historical drift events
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Alert,
  AlertTitle,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';

import { TelemetryStream } from '../../../../services/telemetry/TelemetryAnalyzer';
import { DriftResult, DriftDetector, DriftMethod } from '../../../../services/telemetry/trend';

interface DriftMonitorProps {
  stream: TelemetryStream;
  driftResult: DriftResult;
  detector?: DriftDetector;
  height?: number;
  onConfigChange?: (method: DriftMethod, sensitivity: number) => void;
}

interface DriftEvent {
  timestamp: Date;
  type: 'drift' | 'warning';
  confidence: number;
  meanChange: number;
  varianceChange: number;
}

export const DriftMonitor: React.FC<DriftMonitorProps> = ({
  stream,
  driftResult,
  detector,
  height = 400,
  onConfigChange
}) => {
  const [driftHistory, setDriftHistory] = useState<DriftEvent[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<DriftMethod>(DriftMethod.ADWIN);
  const [sensitivity, setSensitivity] = useState(0.5);

  // Update drift history
  useEffect(() => {
    if (driftResult.detected || driftResult.warning) {
      setDriftHistory(prev => {
        const newEvent: DriftEvent = {
          timestamp: new Date(driftResult.driftTimestamp || Date.now()),
          type: driftResult.detected ? 'drift' : 'warning',
          confidence: driftResult.confidence,
          meanChange: driftResult.currentMean - driftResult.referenceMean,
          varianceChange: driftResult.currentVariance - driftResult.referenceVariance
        };
        
        // Keep last 50 events
        const updated = [...prev, newEvent];
        if (updated.length > 50) {
          updated.shift();
        }
        return updated;
      });
    }
  }, [driftResult]);

  // Get drift statistics
  const driftStats = useMemo(() => {
    if (!detector) return null;
    return detector.getDriftStatistics();
  }, [detector, driftResult]); // Re-calculate when drift result changes

  // Prepare status chart data
  const statusChartData = useMemo(() => {
    const recentData = stream.data.slice(-100);
    const labels = recentData.map((_, i) => i.toString());
    
    // Calculate reference and current windows
    const windowSize = Math.min(30, Math.floor(recentData.length / 2));
    const referenceWindow = recentData.slice(0, windowSize);
    const currentWindow = recentData.slice(-windowSize);
    
    const referenceMean = referenceWindow.reduce((a, b) => a + b, 0) / windowSize;
    const currentMean = currentWindow.reduce((a, b) => a + b, 0) / windowSize;

    return {
      labels,
      datasets: [
        {
          label: 'Data',
          data: recentData,
          borderColor: 'rgba(75, 192, 192, 0.8)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          borderWidth: 1,
          pointRadius: 2,
          tension: 0.1,
        },
        {
          label: 'Reference Mean',
          data: new Array(recentData.length).fill(referenceMean),
          borderColor: 'rgba(54, 162, 235, 0.8)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Current Mean',
          data: new Array(recentData.length).fill(currentMean),
          borderColor: driftResult.detected ? 'rgba(255, 99, 132, 0.8)' : 
                       driftResult.warning ? 'rgba(255, 159, 64, 0.8)' : 
                       'rgba(75, 192, 192, 0.8)',
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ]
    };
  }, [stream.data, driftResult]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Drift Detection Status',
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Sample Index',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: stream.unit || 'Value',
        },
      },
    },
  };

  // Get status color and icon
  const getStatusDisplay = () => {
    if (driftResult.detected) {
      return {
        color: 'error' as const,
        icon: <ErrorIcon />,
        text: 'Drift Detected',
        severity: 'error' as const
      };
    } else if (driftResult.warning) {
      return {
        color: 'warning' as const,
        icon: <WarningIcon />,
        text: 'Warning',
        severity: 'warning' as const
      };
    }
    return {
      color: 'success' as const,
      icon: <CheckCircleIcon />,
      text: 'Stable',
      severity: 'success' as const
    };
  };

  const status = getStatusDisplay();

  // Format confidence percentage
  const confidencePercent = (driftResult.confidence * 100).toFixed(1);

  // Mean change direction
  const meanChange = driftResult.currentMean - driftResult.referenceMean;
  const meanChangePercent = driftResult.referenceMean !== 0 
    ? ((meanChange / driftResult.referenceMean) * 100).toFixed(1)
    : '0.0';

  return (
    <Grid container spacing={2}>
      {/* Status Alert */}
      <Grid item xs={12}>
        <Alert severity={status.severity} icon={status.icon}>
          <AlertTitle>{status.text}</AlertTitle>
          {driftResult.detected && (
            <Typography variant="body2">
              Significant drift detected with {confidencePercent}% confidence.
              Mean shifted by {meanChangePercent}% ({meanChange > 0 ? '+' : ''}{meanChange.toFixed(3)}).
            </Typography>
          )}
          {driftResult.warning && !driftResult.detected && (
            <Typography variant="body2">
              Potential drift detected. Monitoring for confirmation.
            </Typography>
          )}
          {!driftResult.detected && !driftResult.warning && (
            <Typography variant="body2">
              No significant drift detected. System is stable.
            </Typography>
          )}
        </Alert>
      </Grid>

      {/* Drift Statistics */}
      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Drift Statistics
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <SpeedIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Test Statistic"
                  secondary={driftResult.statistics.testStatistic.toFixed(3)}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <AssessmentIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Threshold"
                  secondary={driftResult.statistics.threshold.toFixed(3)}
                />
              </ListItem>
              
              {driftResult.statistics.pValue !== undefined && (
                <ListItem>
                  <ListItemIcon>
                    <TimelineIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary="P-Value"
                    secondary={driftResult.statistics.pValue.toFixed(4)}
                  />
                </ListItem>
              )}
              
              <Divider sx={{ my: 1 }} />
              
              <ListItem>
                <ListItemIcon>
                  {meanChange > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                </ListItemIcon>
                <ListItemText
                  primary="Mean Change"
                  secondary={`${meanChange > 0 ? '+' : ''}${meanChange.toFixed(3)} (${meanChangePercent}%)`}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <TimelineIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Variance Ratio"
                  secondary={(driftResult.currentVariance / (driftResult.referenceVariance || 1)).toFixed(2)}
                />
              </ListItem>
            </List>

            {driftStats && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Detection Summary
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`${driftStats.samplesProcessed} samples`}
                    color="primary"
                  />
                  <Chip
                    size="small"
                    label={`${driftStats.driftsDetected} drifts`}
                    color={driftStats.driftsDetected > 0 ? "error" : "default"}
                  />
                  <Chip
                    size="small"
                    label={`${driftStats.warningsIssued} warnings`}
                    color={driftStats.warningsIssued > 0 ? "warning" : "default"}
                  />
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Drift Visualization */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Drift Monitoring
              </Typography>
              <Box display="flex" gap={1}>
                <Tooltip title="Refresh">
                  <IconButton size="small">
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Settings">
                  <IconButton size="small" onClick={() => setShowSettings(!showSettings)}>
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {showSettings && (
              <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Detection Method</InputLabel>
                      <Select
                        value={selectedMethod}
                        onChange={(e) => {
                          setSelectedMethod(e.target.value as DriftMethod);
                          if (onConfigChange) {
                            onConfigChange(e.target.value as DriftMethod, sensitivity);
                          }
                        }}
                        label="Detection Method"
                      >
                        <MenuItem value={DriftMethod.ADWIN}>ADWIN</MenuItem>
                        <MenuItem value={DriftMethod.PAGE_HINKLEY}>Page-Hinkley</MenuItem>
                        <MenuItem value={DriftMethod.DDM}>DDM</MenuItem>
                        <MenuItem value={DriftMethod.EDDM}>EDDM</MenuItem>
                        <MenuItem value={DriftMethod.CUSUM}>CUSUM</MenuItem>
                        <MenuItem value={DriftMethod.EWMA}>EWMA</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sensitivity</InputLabel>
                      <Select
                        value={sensitivity}
                        onChange={(e) => {
                          setSensitivity(Number(e.target.value));
                          if (onConfigChange) {
                            onConfigChange(selectedMethod, Number(e.target.value));
                          }
                        }}
                        label="Sensitivity"
                      >
                        <MenuItem value={0.1}>Low (0.1)</MenuItem>
                        <MenuItem value={0.3}>Medium-Low (0.3)</MenuItem>
                        <MenuItem value={0.5}>Medium (0.5)</MenuItem>
                        <MenuItem value={0.7}>Medium-High (0.7)</MenuItem>
                        <MenuItem value={0.9}>High (0.9)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>
            )}

            <Box height={height}>
              <Line data={statusChartData} options={chartOptions} />
            </Box>

            {/* Confidence Progress */}
            <Box mt={2}>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="textSecondary">
                  Detection Confidence
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {confidencePercent}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={driftResult.confidence * 100}
                color={status.color}
                sx={{ height: 8, borderRadius: 1 }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Drift History */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Drift History
            </Typography>
            
            {driftHistory.length > 0 ? (
              <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                {driftHistory.slice().reverse().map((event, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      {event.type === 'drift' ? (
                        <ErrorIcon color="error" />
                      ) : (
                        <WarningIcon color="warning" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${event.type === 'drift' ? 'Drift' : 'Warning'} at ${event.timestamp.toLocaleTimeString()}`}
                      secondary={`Confidence: ${(event.confidence * 100).toFixed(1)}%, Mean change: ${event.meanChange > 0 ? '+' : ''}${event.meanChange.toFixed(3)}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="textSecondary">
                No drift events recorded
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default DriftMonitor;