import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Button,
  Alert,
  Collapse,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  ShowChart as ShowChartIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  GetApp as GetAppIcon,
  ErrorOutline as ErrorOutlineIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  ScatterPlot as ScatterPlotIcon,
  BarChart as BarChartIcon,
  MultilineChart as MultilineChartIcon,
  Autorenew as AutorenewIcon,
  Pause as PauseIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  ChartOptions,
} from 'chart.js';

import { TelemetryAnalyzer, AnalysisReport, TelemetryStream } from '../../services/telemetry/TelemetryAnalyzer';
import { TrendAnalysisPanel } from './TrendAnalysis/TrendAnalysisPanel';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface DataAnalysisPanelProps {
  analyzer: TelemetryAnalyzer;
  streams: TelemetryStream[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
  onExport?: (data: any) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`analysis-tabpanel-${index}`}
    aria-labelledby={`analysis-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const formatNumber = (value: number, decimals: number = 3): string => {
  if (Math.abs(value) < 0.001) return '0';
  return value.toFixed(decimals);
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'increasing': return <TrendingUpIcon color="success" />;
    case 'decreasing': return <TrendingDownIcon color="error" />;
    default: return <TrendingFlatIcon color="info" />;
  }
};

const getAnomalyColor = (percentage: number): 'success' | 'warning' | 'error' => {
  if (percentage < 1) return 'success';
  if (percentage < 5) return 'warning';
  return 'error';
};

export const DataAnalysisPanel: React.FC<DataAnalysisPanelProps> = ({
  analyzer,
  streams,
  autoRefresh = true,
  refreshInterval = 5000,
  className = '',
  onExport
}) => {
  const [analysisResults, setAnalysisResults] = useState<Map<string, AnalysisReport>>(new Map());
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(autoRefresh);
  const [analysisInterval, setAnalysisInterval] = useState(refreshInterval);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  // Update selected stream when streams change
  useEffect(() => {
    if (streams.length > 0 && !selectedStream) {
      setSelectedStream(streams[0].id);
    }
  }, [streams, selectedStream]);

  // Auto-refresh analysis
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (realTimeEnabled && streams.length > 0) {
      const runAnalysis = () => {
        setIsAnalyzing(true);
        const results = analyzer.analyzeAllStreams();
        setAnalysisResults(results);
        setLastAnalysis(new Date());
        setIsAnalyzing(false);
      };

      // Run initial analysis
      runAnalysis();

      // Set up interval
      interval = setInterval(runAnalysis, analysisInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [analyzer, streams, realTimeEnabled, analysisInterval]);

  const runManualAnalysis = useCallback(() => {
    setIsAnalyzing(true);
    const results = analyzer.analyzeAllStreams();
    setAnalysisResults(results);
    setLastAnalysis(new Date());
    setIsAnalyzing(false);
  }, [analyzer]);

  const selectedStreamData = useMemo(() => {
    if (!selectedStream) return null;
    return streams.find(s => s.id === selectedStream);
  }, [selectedStream, streams]);

  const selectedAnalysis = useMemo(() => {
    if (!selectedStream) return null;
    return analysisResults.get(selectedStream);
  }, [selectedStream, analysisResults]);

  const overallStatistics = useMemo(() => {
    const results = Array.from(analysisResults.values());
    if (results.length === 0) return null;

    const totalAnomalies = results.reduce((sum, r) => sum + r.anomalies.count, 0);
    const totalDataPoints = results.reduce((sum, r) => sum + r.summary.dataPoints, 0);
    const avgAnomalyRate = results.reduce((sum, r) => sum + r.anomalies.percentage, 0) / results.length;

    const trendCounts = results.reduce((acc, r) => {
      acc[r.trends.direction] = (acc[r.trends.direction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalStreams: results.length,
      totalDataPoints,
      totalAnomalies,
      avgAnomalyRate,
      trendCounts,
      lastUpdate: lastAnalysis
    };
  }, [analysisResults, lastAnalysis]);

  const frequencyData = useMemo(() => {
    if (!selectedAnalysis || !selectedStreamData) return null;

    const freqAnalysis = analyzer.getFrequencyAnalysis(selectedStream);
    if (!freqAnalysis) return null;

    return {
      labels: freqAnalysis.frequencies.slice(0, 50).map(f => f.toFixed(2)),
      datasets: [{
        label: 'Magnitude',
        data: freqAnalysis.magnitudes.slice(0, 50),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        fill: true,
      }]
    };
  }, [selectedAnalysis, selectedStreamData, selectedStream, analyzer]);

  const correlationData = useMemo(() => {
    if (!selectedAnalysis?.correlations) return null;

    return {
      labels: selectedAnalysis.correlations.map(c => c.streamName),
      datasets: [{
        label: 'Correlation Coefficient',
        data: selectedAnalysis.correlations.map(c => c.coefficient),
        backgroundColor: selectedAnalysis.correlations.map(c => 
          Math.abs(c.coefficient) > 0.7 ? 'rgba(255, 99, 132, 0.8)' :
          Math.abs(c.coefficient) > 0.3 ? 'rgba(255, 205, 86, 0.8)' :
          'rgba(75, 192, 192, 0.8)'
        ),
      }]
    };
  }, [selectedAnalysis]);

  const exportData = useCallback(() => {
    if (!selectedStream || !selectedAnalysis || !selectedStreamData) return;

    const exportReport = analyzer.exportAnalysisReport(selectedStream, 'json');
    if (exportReport && onExport) {
      onExport({
        type: 'analysis-report',
        streamId: selectedStream,
        streamName: selectedStreamData.name,
        timestamp: new Date().toISOString(),
        data: JSON.parse(exportReport)
      });
    }
  }, [analyzer, selectedStream, selectedAnalysis, selectedStreamData, onExport]);

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Analysis Results',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  if (streams.length === 0) {
    return (
      <Card className={className}>
        <CardContent>
          <Alert severity="info" icon={<InfoIcon />}>
            No telemetry streams available for analysis. Add streams to begin analysis.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box className={className}>
      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              <AnalyticsIcon />
              <Typography variant="h6">Data Analysis Panel</Typography>
              {isAnalyzing && <LinearProgress sx={{ width: 200 }} />}
            </Box>

            <Box display="flex" alignItems="center" gap={1}>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Stream</InputLabel>
                <Select
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(e.target.value)}
                  label="Stream"
                >
                  {streams.map(stream => (
                    <MenuItem key={stream.id} value={stream.id}>
                      {stream.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Tooltip title={realTimeEnabled ? "Pause Auto-refresh" : "Resume Auto-refresh"}>
                <IconButton
                  onClick={() => setRealTimeEnabled(!realTimeEnabled)}
                  color={realTimeEnabled ? "primary" : "default"}
                >
                  {realTimeEnabled ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Run Manual Analysis">
                <IconButton onClick={runManualAnalysis} disabled={isAnalyzing}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Settings">
                <IconButton onClick={() => setShowSettings(true)}>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>

              {selectedAnalysis && (
                <Tooltip title="Export Analysis">
                  <IconButton onClick={exportData}>
                    <GetAppIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {lastAnalysis && (
            <Typography variant="caption" color="textSecondary">
              Last analysis: {lastAnalysis.toLocaleTimeString()}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Overview" icon={<AssessmentIcon />} />
          <Tab label="Statistics" icon={<BarChartIcon />} />
          <Tab label="Anomalies" icon={<WarningIcon />} />
          <Tab label="Frequency Analysis" icon={<ShowChartIcon />} />
          <Tab label="Correlations" icon={<ScatterPlotIcon />} />
          <Tab label="Advanced Trends" icon={<MultilineChartIcon />} />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={tabValue} index={0}>
        {overallStatistics && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {overallStatistics.totalStreams}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Streams
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {overallStatistics.totalDataPoints.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Data Points
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {overallStatistics.totalAnomalies}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Anomalies
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color={getAnomalyColor(overallStatistics.avgAnomalyRate)}>
                    {formatNumber(overallStatistics.avgAnomalyRate, 1)}%
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Avg Anomaly Rate
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Stream Summary */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Stream Summary</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Stream</TableCell>
                    <TableCell align="right">Data Points</TableCell>
                    <TableCell align="center">Trend</TableCell>
                    <TableCell align="right">Anomalies</TableCell>
                    <TableCell align="right">Quality</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from(analysisResults.entries()).map(([streamId, analysis]) => {
                    const stream = streams.find(s => s.id === streamId);
                    return (
                      <TableRow key={streamId}>
                        <TableCell>{stream?.name || streamId}</TableCell>
                        <TableCell align="right">{analysis.summary.dataPoints}</TableCell>
                        <TableCell align="center">
                          <Tooltip title={`Trend: ${analysis.trends.direction}`}>
                            {getTrendIcon(analysis.trends.direction)}
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${analysis.anomalies.count} (${formatNumber(analysis.anomalies.percentage, 1)}%)`}
                            size="small"
                            color={getAnomalyColor(analysis.anomalies.percentage)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <LinearProgress
                            variant="determinate"
                            value={Math.max(0, 100 - analysis.anomalies.percentage)}
                            sx={{ width: 60 }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Statistics Tab */}
      <TabPanel value={tabValue} index={1}>
        {selectedAnalysis && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Basic Statistics</Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell>Mean</TableCell>
                        <TableCell align="right">{formatNumber(selectedAnalysis.summary.statistics.mean)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Median</TableCell>
                        <TableCell align="right">{formatNumber(selectedAnalysis.summary.statistics.median)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Standard Deviation</TableCell>
                        <TableCell align="right">{formatNumber(selectedAnalysis.summary.statistics.std)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Minimum</TableCell>
                        <TableCell align="right">{formatNumber(selectedAnalysis.summary.statistics.min)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Maximum</TableCell>
                        <TableCell align="right">{formatNumber(selectedAnalysis.summary.statistics.max)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Advanced Statistics</Typography>
                  {selectedStreamData && (
                    <Table size="small">
                      <TableBody>
                        {(() => {
                          const stats = analyzer.getStreamStatistics(selectedStream);
                          if (!stats) return null;
                          
                          return (
                            <>
                              <TableRow>
                                <TableCell>Skewness</TableCell>
                                <TableCell align="right">{formatNumber(stats.skewness)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>Kurtosis</TableCell>
                                <TableCell align="right">{formatNumber(stats.kurtosis)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>25th Percentile</TableCell>
                                <TableCell align="right">{formatNumber(stats.percentiles.p25)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>75th Percentile</TableCell>
                                <TableCell align="right">{formatNumber(stats.percentiles.p75)}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell>95th Percentile</TableCell>
                                <TableCell align="right">{formatNumber(stats.percentiles.p95)}</TableCell>
                              </TableRow>
                            </>
                          );
                        })()}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Trend Analysis</Typography>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    {getTrendIcon(selectedAnalysis.trends.direction)}
                    <Typography>
                      Direction: <strong>{selectedAnalysis.trends.direction}</strong>
                    </Typography>
                    <Typography>
                      Strength: <strong>{formatNumber(selectedAnalysis.trends.strength)}</strong>
                    </Typography>
                  </Box>
                  
                  {selectedAnalysis.trends.predictions.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Predictions (next 5 points):</Typography>
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {selectedAnalysis.trends.predictions.map((pred, idx) => (
                          <Chip
                            key={idx}
                            label={formatNumber(pred)}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Anomalies Tab */}
      <TabPanel value={tabValue} index={2}>
        {selectedAnalysis && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Anomaly Detection Results</Typography>
                  
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Chip
                      icon={<WarningIcon />}
                      label={`${selectedAnalysis.anomalies.count} anomalies detected`}
                      color={getAnomalyColor(selectedAnalysis.anomalies.percentage)}
                    />
                    <Typography>
                      ({formatNumber(selectedAnalysis.anomalies.percentage, 2)}% of data)
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Method: {selectedAnalysis.anomalies.method}
                    </Typography>
                  </Box>

                  {selectedAnalysis.anomalies.count > 0 && (
                    <Accordion>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography>Anomalous Values ({selectedAnalysis.anomalies.values.length})</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box maxHeight={200} overflow="auto">
                          <Grid container spacing={1}>
                            {selectedAnalysis.anomalies.values.slice(0, 50).map((value, idx) => (
                              <Grid item key={idx}>
                                <Chip
                                  label={`${selectedAnalysis.anomalies.indices[idx]}: ${formatNumber(value)}`}
                                  size="small"
                                  variant="outlined"
                                  color="warning"
                                />
                              </Grid>
                            ))}
                            {selectedAnalysis.anomalies.values.length > 50 && (
                              <Grid item>
                                <Chip
                                  label={`...and ${selectedAnalysis.anomalies.values.length - 50} more`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Frequency Analysis Tab */}
      <TabPanel value={tabValue} index={3}>
        {frequencyData && selectedAnalysis && (
          <Grid container spacing={2}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Frequency Spectrum</Typography>
                  <Box height={300}>
                    <Line data={frequencyData} options={chartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Dominant Frequencies</Typography>
                  
                  <List dense>
                    {selectedAnalysis.frequency.peaks.slice(0, 10).map((peak, idx) => (
                      <ListItem key={idx}>
                        <ListItemIcon>
                          <ShowChartIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={`${formatNumber(peak.frequency, 2)} Hz`}
                          secondary={`Magnitude: ${formatNumber(peak.magnitude, 3)}`}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2">
                    Dominant Frequency: <strong>{formatNumber(selectedAnalysis.frequency.dominantFrequency, 2)} Hz</strong>
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Correlations Tab */}
      <TabPanel value={tabValue} index={4}>
        {selectedAnalysis?.correlations && correlationData ? (
          <Grid container spacing={2}>
            <Grid item xs={12} lg={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Stream Correlations</Typography>
                  <Box height={300}>
                    <Bar data={correlationData} options={chartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>Correlation Strength</Typography>
                  
                  <List dense>
                    {selectedAnalysis.correlations
                      .sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))
                      .map((corr, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={corr.streamName}
                            secondary={
                              <Box>
                                <Typography variant="body2">
                                  Coefficient: {formatNumber(corr.coefficient, 3)}
                                </Typography>
                                <Chip
                                  label={corr.strength}
                                  size="small"
                                  color={
                                    corr.strength === 'strong' ? 'error' :
                                    corr.strength === 'moderate' ? 'warning' : 'default'
                                  }
                                />
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            No correlation data available. Enable correlation analysis in the analyzer configuration.
          </Alert>
        )}
      </TabPanel>

      {/* Advanced Trends Tab */}
      <TabPanel value={tabValue} index={5}>
        {selectedStream && (
          <TrendAnalysisPanel 
            streamId={selectedStream}
            streamName={selectedStreamData?.name || selectedStream}
          />
        )}
      </TabPanel>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Analysis Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={realTimeEnabled}
                  onChange={(e) => setRealTimeEnabled(e.target.checked)}
                />
              }
              label="Enable Real-time Analysis"
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Refresh Interval</InputLabel>
              <Select
                value={analysisInterval}
                onChange={(e) => setAnalysisInterval(Number(e.target.value))}
                label="Refresh Interval"
              >
                <MenuItem value={1000}>1 second</MenuItem>
                <MenuItem value={5000}>5 seconds</MenuItem>
                <MenuItem value={10000}>10 seconds</MenuItem>
                <MenuItem value={30000}>30 seconds</MenuItem>
                <MenuItem value={60000}>1 minute</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataAnalysisPanel;