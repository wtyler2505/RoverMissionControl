/**
 * TrendAnalysisPanel - Main UI component for advanced trend analysis
 * Displays ARIMA models, non-linear trends, drift detection, and predictions
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  Functions as FunctionsIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  GetApp as GetAppIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Speed as SpeedIcon,
  CompareArrows as CompareArrowsIcon,
  Analytics as AnalyticsIcon,
  Psychology as PsychologyIcon,
} from '@mui/icons-material';

import {
  AdvancedTrendAnalyzer,
  DriftDetector,
  PredictionEngine,
  AdvancedTrendAnalysis,
  DriftResult,
  PredictionResult,
  TrendType,
  DriftMethod,
  createAdvancedTrendAnalyzer,
  createDriftDetector,
  createPredictionEngine
} from '../../../services/telemetry/trend';
import { TelemetryStream } from '../../../services/telemetry/TelemetryAnalyzer';

// Sub-components
import { TrendChart } from './TrendChart';
import { DriftMonitor } from './DriftMonitor';
import { PredictionChart } from './PredictionChart';
import { ModelMetrics } from './ModelMetrics';

interface TrendAnalysisPanelProps {
  streams: TelemetryStream[];
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
    id={`trend-tabpanel-${index}`}
    aria-labelledby={`trend-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const TrendAnalysisPanel: React.FC<TrendAnalysisPanelProps> = ({
  streams,
  className = '',
  onExport
}) => {
  // State
  const [selectedStream, setSelectedStream] = useState<string>('');
  const [tabValue, setTabValue] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<Map<string, AdvancedTrendAnalysis>>(new Map());
  const [driftResults, setDriftResults] = useState<Map<string, DriftResult>>(new Map());
  const [predictionResults, setPredictionResults] = useState<Map<string, PredictionResult>>(new Map());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  
  // Services
  const [trendAnalyzer] = useState(() => createAdvancedTrendAnalyzer({
    enableARIMA: true,
    enableNonLinear: true,
    enableDriftDetection: true,
    enableChangePointDetection: true,
    enablePrediction: true,
    enableSeasonalDecomposition: true
  }));
  
  const [driftDetectors] = useState(() => new Map<string, DriftDetector>());
  const [predictionEngine] = useState(() => createPredictionEngine(trendAnalyzer));

  // Initialize selected stream
  useEffect(() => {
    if (streams.length > 0 && !selectedStream) {
      setSelectedStream(streams[0].id);
    }
  }, [streams, selectedStream]);

  // Initialize drift detectors for streams
  useEffect(() => {
    streams.forEach(stream => {
      if (!driftDetectors.has(stream.id)) {
        const detector = createDriftDetector({
          method: DriftMethod.ADWIN,
          sensitivity: 0.5,
          windowSize: 100
        });
        
        // Subscribe to drift events
        detector.on('drift:detected', (result) => {
          setDriftResults(prev => new Map(prev).set(stream.id, result));
        });
        
        detector.on('drift:warning', (result) => {
          setDriftResults(prev => new Map(prev).set(stream.id, result));
        });
        
        driftDetectors.set(stream.id, detector);
      }
    });
  }, [streams, driftDetectors]);

  // Auto-refresh analysis
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    if (autoRefresh && streams.length > 0) {
      const runAnalysis = async () => {
        await performAnalysis();
      };

      runAnalysis();
      interval = setInterval(runAnalysis, refreshInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, refreshInterval, streams]);

  // Perform comprehensive analysis
  const performAnalysis = useCallback(async () => {
    if (streams.length === 0) return;

    setIsAnalyzing(true);
    const newResults = new Map<string, AdvancedTrendAnalysis>();
    const newPredictions = new Map<string, PredictionResult>();

    try {
      // Analyze each stream
      for (const stream of streams) {
        // Advanced trend analysis
        const analysis = await trendAnalyzer.analyzeStream(stream);
        newResults.set(stream.id, analysis);

        // Update drift detector with latest data
        const detector = driftDetectors.get(stream.id);
        if (detector && stream.data.length > 0) {
          const latestValue = stream.data[stream.data.length - 1];
          const latestTimestamp = stream.timestamps[stream.timestamps.length - 1].getTime();
          const driftResult = detector.processDataPoint(latestValue, latestTimestamp);
          setDriftResults(prev => new Map(prev).set(stream.id, driftResult));
        }

        // Generate predictions
        try {
          const prediction = await predictionEngine.predict(stream, {
            horizon: 20,
            confidenceLevel: 0.95,
            method: 'ensemble'
          });
          newPredictions.set(stream.id, prediction);
        } catch (error) {
          console.error(`Prediction failed for stream ${stream.id}:`, error);
        }
      }

      setAnalysisResults(newResults);
      setPredictionResults(newPredictions);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [streams, trendAnalyzer, driftDetectors, predictionEngine]);

  // Get current stream data
  const currentStream = useMemo(() => {
    return streams.find(s => s.id === selectedStream);
  }, [streams, selectedStream]);

  const currentAnalysis = useMemo(() => {
    return analysisResults.get(selectedStream);
  }, [analysisResults, selectedStream]);

  const currentDrift = useMemo(() => {
    return driftResults.get(selectedStream);
  }, [driftResults, selectedStream]);

  const currentPrediction = useMemo(() => {
    return predictionResults.get(selectedStream);
  }, [predictionResults, selectedStream]);

  // Export analysis data
  const handleExport = useCallback(() => {
    if (!selectedStream || !currentAnalysis) return;

    const exportData = {
      streamId: selectedStream,
      timestamp: new Date().toISOString(),
      analysis: currentAnalysis,
      drift: currentDrift,
      prediction: currentPrediction,
      stream: currentStream
    };

    if (onExport) {
      onExport({
        type: 'trend-analysis',
        data: exportData
      });
    }
  }, [selectedStream, currentAnalysis, currentDrift, currentPrediction, currentStream, onExport]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const stats = {
      totalStreams: streams.length,
      analyzedStreams: analysisResults.size,
      driftsDetected: 0,
      warningsIssued: 0,
      modelsCount: 0,
      changePoints: 0
    };

    driftResults.forEach(result => {
      if (result.detected) stats.driftsDetected++;
      if (result.warning) stats.warningsIssued++;
    });

    analysisResults.forEach(analysis => {
      if (analysis.arima) stats.modelsCount++;
      stats.changePoints += analysis.changePoints.length;
    });

    return stats;
  }, [streams, analysisResults, driftResults]);

  if (streams.length === 0) {
    return (
      <Card className={className}>
        <CardContent>
          <Alert severity="info" icon={<InfoIcon />}>
            No telemetry streams available for trend analysis. Add streams to begin analysis.
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
              <TimelineIcon />
              <Typography variant="h6">Advanced Trend Analysis</Typography>
              {isAnalyzing && <CircularProgress size={20} />}
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

              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                }
                label="Auto"
              />

              <Tooltip title="Run Analysis">
                <IconButton onClick={performAnalysis} disabled={isAnalyzing}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Export Analysis">
                <IconButton onClick={handleExport} disabled={!currentAnalysis}>
                  <GetAppIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Settings">
                <IconButton>
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Summary Statistics */}
          <Box mt={2} display="flex" gap={2} flexWrap="wrap">
            <Chip
              icon={<AnalyticsIcon />}
              label={`${summaryStats.analyzedStreams}/${summaryStats.totalStreams} Analyzed`}
              color="primary"
              variant="outlined"
            />
            <Chip
              icon={<WarningIcon />}
              label={`${summaryStats.driftsDetected} Drifts`}
              color={summaryStats.driftsDetected > 0 ? "warning" : "default"}
              variant="outlined"
            />
            <Chip
              icon={<PsychologyIcon />}
              label={`${summaryStats.modelsCount} Models`}
              color="info"
              variant="outlined"
            />
            <Chip
              icon={<CompareArrowsIcon />}
              label={`${summaryStats.changePoints} Change Points`}
              color={summaryStats.changePoints > 0 ? "secondary" : "default"}
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Trend Models" icon={<TrendingUpIcon />} />
          <Tab label="Drift Detection" icon={<SpeedIcon />} />
          <Tab label="Predictions" icon={<TimelineIcon />} />
          <Tab label="Model Metrics" icon={<FunctionsIcon />} />
        </Tabs>
      </Box>

      {/* Trend Models Tab */}
      <TabPanel value={tabValue} index={0}>
        {currentAnalysis && currentStream ? (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TrendChart
                stream={currentStream}
                analysis={currentAnalysis}
                height={400}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Model Selection
                  </Typography>
                  
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={`Best Model: ${currentAnalysis.trends.best.type}`}
                        secondary={`R² = ${currentAnalysis.trends.best.r2.toFixed(3)}, RMSE = ${currentAnalysis.trends.best.rmse.toFixed(3)}`}
                      />
                    </ListItem>

                    {currentAnalysis.arima && (
                      <ListItem>
                        <ListItemIcon>
                          <FunctionsIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`ARIMA(${currentAnalysis.arima.config.p},${currentAnalysis.arima.config.d},${currentAnalysis.arima.config.q})`}
                          secondary={`AIC = ${currentAnalysis.arima.aic.toFixed(2)}, BIC = ${currentAnalysis.arima.bic.toFixed(2)}`}
                        />
                      </ListItem>
                    )}
                  </List>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" gutterBottom>
                    Stationarity Test
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {currentAnalysis.stationarity.isStationary ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="Stationary"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<ErrorIcon />}
                        label="Non-Stationary"
                        color="error"
                        size="small"
                      />
                    )}
                    <Typography variant="caption">
                      ADF = {currentAnalysis.stationarity.adfStatistic.toFixed(3)}, 
                      p-value = {currentAnalysis.stationarity.pValue.toFixed(3)}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Change Points
                  </Typography>
                  
                  {currentAnalysis.changePoints.length > 0 ? (
                    <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                      {currentAnalysis.changePoints.map((cp, idx) => (
                        <ListItem key={idx}>
                          <ListItemIcon>
                            <Badge
                              badgeContent={cp.direction === 'increase' ? '↑' : '↓'}
                              color={cp.direction === 'increase' ? 'error' : 'primary'}
                            >
                              <CompareArrowsIcon />
                            </Badge>
                          </ListItemIcon>
                          <ListItemText
                            primary={`Index ${cp.index}: ${cp.type} change`}
                            secondary={`Magnitude: ${cp.magnitude.toFixed(3)}, Confidence: ${(cp.confidence * 100).toFixed(0)}%`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No change points detected
                    </Typography>
                  )}

                  {currentAnalysis.seasonality && currentAnalysis.seasonality.detected && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Seasonality
                      </Typography>
                      <Box>
                        <Chip
                          label={`Period: ${currentAnalysis.seasonality.seasonalPeriod}`}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={`Strength: ${(currentAnalysis.seasonality.strength.seasonal * 100).toFixed(0)}%`}
                          size="small"
                        />
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">
            Run analysis to view trend models
          </Alert>
        )}
      </TabPanel>

      {/* Drift Detection Tab */}
      <TabPanel value={tabValue} index={1}>
        {currentDrift && currentStream ? (
          <DriftMonitor
            stream={currentStream}
            driftResult={currentDrift}
            detector={driftDetectors.get(selectedStream)}
          />
        ) : (
          <Alert severity="info">
            Run analysis to view drift detection results
          </Alert>
        )}
      </TabPanel>

      {/* Predictions Tab */}
      <TabPanel value={tabValue} index={2}>
        {currentPrediction && currentStream ? (
          <PredictionChart
            stream={currentStream}
            prediction={currentPrediction}
            height={400}
          />
        ) : (
          <Alert severity="info">
            Run analysis to view predictions
          </Alert>
        )}
      </TabPanel>

      {/* Model Metrics Tab */}
      <TabPanel value={tabValue} index={3}>
        {analysisResults.size > 0 ? (
          <ModelMetrics
            analysisResults={analysisResults}
            predictionEngine={predictionEngine}
          />
        ) : (
          <Alert severity="info">
            Run analysis to view model metrics
          </Alert>
        )}
      </TabPanel>
    </Box>
  );
};

export default TrendAnalysisPanel;