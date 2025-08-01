/**
 * PredictionChart - Visualization for multi-step predictions with confidence intervals
 * Displays historical data, predictions, and uncertainty bands
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Switch,
  FormControlLabel,
  Slider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  ShowChart as ShowChartIcon,
  TrendingUp as TrendingUpIcon,
  Functions as FunctionsIcon,
  Layers as LayersIcon,
  Assessment as AssessmentIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon,
  Download as DownloadIcon,
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
  TooltipItem,
} from 'chart.js';

import { TelemetryStream } from '../../../../services/telemetry/TelemetryAnalyzer';
import { PredictionResult, EnsemblePrediction } from '../../../../services/telemetry/trend';

interface PredictionChartProps {
  stream: TelemetryStream;
  prediction: PredictionResult;
  height?: number;
  showHistoricalData?: boolean;
  historicalPoints?: number;
  onExport?: () => void;
}

export const PredictionChart: React.FC<PredictionChartProps> = ({
  stream,
  prediction,
  height = 400,
  showHistoricalData = true,
  historicalPoints = 50,
  onExport
}) => {
  const [showConfidenceIntervals, setShowConfidenceIntervals] = useState(true);
  const [showPredictionIntervals, setShowPredictionIntervals] = useState(false);
  const [showIndividualModels, setShowIndividualModels] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusHorizon, setFocusHorizon] = useState(prediction.predictions.length);

  // Check if this is an ensemble prediction
  const isEnsemble = 'models' in prediction;
  const ensemblePrediction = isEnsemble ? prediction as EnsemblePrediction : null;

  // Prepare chart data
  const chartData = useMemo(() => {
    // Historical data
    const historicalData = showHistoricalData 
      ? stream.data.slice(-historicalPoints)
      : [];
    const historicalTimestamps = showHistoricalData
      ? stream.timestamps.slice(-historicalPoints)
      : [];

    // Combine historical and prediction timestamps
    const allTimestamps = [
      ...historicalTimestamps,
      ...prediction.timestamps.slice(0, focusHorizon).map(ts => new Date(ts))
    ];

    const labels = allTimestamps.map(ts => {
      const date = new Date(ts);
      return date.toLocaleTimeString();
    });

    const datasets: any[] = [];

    // Historical data
    if (showHistoricalData) {
      datasets.push({
        label: 'Historical Data',
        data: [...historicalData, ...new Array(focusHorizon).fill(null)],
        borderColor: 'rgba(75, 192, 192, 0.8)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
        spanGaps: false,
      });
    }

    // Predictions
    const predictionData = new Array(historicalData.length).fill(null)
      .concat(prediction.predictions.slice(0, focusHorizon));
    
    datasets.push({
      label: `${prediction.method} Prediction`,
      data: predictionData,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.1)',
      borderWidth: 2,
      borderDash: [5, 5],
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.1,
      spanGaps: false,
    });

    // Confidence intervals
    if (showConfidenceIntervals && prediction.confidenceIntervals) {
      const lowerCI = new Array(historicalData.length).fill(null)
        .concat(prediction.confidenceIntervals.lower.slice(0, focusHorizon));
      const upperCI = new Array(historicalData.length).fill(null)
        .concat(prediction.confidenceIntervals.upper.slice(0, focusHorizon));

      datasets.push({
        label: `${(prediction.confidenceIntervals.level * 100).toFixed(0)}% Confidence Interval`,
        data: upperCI,
        borderColor: 'rgba(255, 99, 132, 0.3)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        borderWidth: 1,
        borderDash: [2, 2],
        pointRadius: 0,
        fill: '+1',
        spanGaps: false,
      });

      datasets.push({
        label: 'Lower CI',
        data: lowerCI,
        borderColor: 'rgba(255, 99, 132, 0.3)',
        borderWidth: 1,
        borderDash: [2, 2],
        pointRadius: 0,
        fill: false,
        showLine: true,
        spanGaps: false,
      });
    }

    // Prediction intervals
    if (showPredictionIntervals && prediction.predictionIntervals) {
      const lowerPI = new Array(historicalData.length).fill(null)
        .concat(prediction.predictionIntervals.lower.slice(0, focusHorizon));
      const upperPI = new Array(historicalData.length).fill(null)
        .concat(prediction.predictionIntervals.upper.slice(0, focusHorizon));

      datasets.push({
        label: `${(prediction.predictionIntervals.level * 100).toFixed(0)}% Prediction Interval`,
        data: upperPI,
        borderColor: 'rgba(54, 162, 235, 0.3)',
        backgroundColor: 'rgba(54, 162, 235, 0.05)',
        borderWidth: 1,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: '+1',
        spanGaps: false,
      });

      datasets.push({
        label: 'Lower PI',
        data: lowerPI,
        borderColor: 'rgba(54, 162, 235, 0.3)',
        borderWidth: 1,
        borderDash: [8, 4],
        pointRadius: 0,
        fill: false,
        showLine: true,
        spanGaps: false,
      });
    }

    // Individual models for ensemble
    if (showIndividualModels && ensemblePrediction) {
      ensemblePrediction.models.forEach((model, idx) => {
        const modelData = new Array(historicalData.length).fill(null)
          .concat(model.predictions.slice(0, focusHorizon));
        
        datasets.push({
          label: `${model.name} (${(model.weight * 100).toFixed(0)}%)`,
          data: modelData,
          borderColor: `hsla(${idx * 60}, 70%, 50%, 0.7)`,
          backgroundColor: `hsla(${idx * 60}, 70%, 50%, 0.1)`,
          borderWidth: 1,
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.1,
          spanGaps: false,
        });
      });
    }

    return { labels, datasets };
  }, [
    stream, 
    prediction, 
    showHistoricalData, 
    historicalPoints, 
    showConfidenceIntervals,
    showPredictionIntervals, 
    showIndividualModels, 
    focusHorizon,
    ensemblePrediction
  ]);

  // Chart options
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          filter: (item) => {
            // Hide lower CI/PI from legend
            return !item.text.startsWith('Lower');
          }
        },
      },
      title: {
        display: true,
        text: `${stream.name} - ${prediction.method} Prediction`,
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            if (value === null) return '';
            return `${label}: ${value.toFixed(3)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time',
        },
        ticks: {
          maxTicksLimit: 10,
          maxRotation: 45,
          minRotation: 0,
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
  }), [stream, prediction, zoomLevel]);

  // Calculate prediction metrics
  const predictionMetrics = useMemo(() => {
    if (!prediction.metrics) return null;
    
    return {
      mape: prediction.metrics.mape?.toFixed(2),
      smape: prediction.metrics.smape?.toFixed(2),
      mase: prediction.metrics.mase?.toFixed(2)
    };
  }, [prediction]);

  // Handle zoom
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.5, 5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.5, 1));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <Grid container spacing={2}>
      {/* Main Chart */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            {/* Controls */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Box display="flex" gap={2} alignItems="center">
                <FormControlLabel
                  control={
                    <Switch
                      checked={showHistoricalData}
                      onChange={(e) => setShowHistoricalData(e.target.checked)}
                    />
                  }
                  label="Historical Data"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={showConfidenceIntervals}
                      onChange={(e) => setShowConfidenceIntervals(e.target.checked)}
                    />
                  }
                  label="Confidence Intervals"
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={showPredictionIntervals}
                      onChange={(e) => setShowPredictionIntervals(e.target.checked)}
                      disabled={!prediction.predictionIntervals}
                    />
                  }
                  label="Prediction Intervals"
                />

                {isEnsemble && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showIndividualModels}
                        onChange={(e) => setShowIndividualModels(e.target.checked)}
                      />
                    }
                    label="Individual Models"
                  />
                )}
              </Box>

              <Box display="flex" gap={1}>
                <Tooltip title="Zoom In">
                  <IconButton size="small" onClick={handleZoomIn}>
                    <ZoomInIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Zoom Out">
                  <IconButton size="small" onClick={handleZoomOut}>
                    <ZoomOutIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Reset Zoom">
                  <IconButton size="small" onClick={handleResetZoom}>
                    <RestartAltIcon />
                  </IconButton>
                </Tooltip>
                {onExport && (
                  <Tooltip title="Export Chart">
                    <IconButton size="small" onClick={onExport}>
                      <DownloadIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Horizon Slider */}
            <Box mb={2}>
              <Typography gutterBottom>
                Prediction Horizon: {focusHorizon} steps
              </Typography>
              <Slider
                value={focusHorizon}
                onChange={(_, value) => setFocusHorizon(value as number)}
                min={1}
                max={prediction.predictions.length}
                marks={[
                  { value: 1, label: '1' },
                  { value: Math.floor(prediction.predictions.length / 2), label: `${Math.floor(prediction.predictions.length / 2)}` },
                  { value: prediction.predictions.length, label: `${prediction.predictions.length}` }
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            {/* Chart */}
            <Box height={height}>
              <Line data={chartData} options={chartOptions} />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Prediction Details */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Prediction Details
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <TimelineIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Method"
                  secondary={prediction.method}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <ShowChartIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Horizon"
                  secondary={`${prediction.predictions.length} steps`}
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <AssessmentIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Confidence Level"
                  secondary={`${(prediction.confidenceIntervals.level * 100).toFixed(0)}%`}
                />
              </ListItem>

              {isEnsemble && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <ListItem>
                    <ListItemIcon>
                      <LayersIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Ensemble Models"
                      secondary={ensemblePrediction!.models.length}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <FunctionsIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary="Aggregation"
                      secondary={ensemblePrediction!.aggregationMethod}
                    />
                  </ListItem>
                </>
              )}
            </List>

            {predictionMetrics && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom>
                  Performance Metrics
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {predictionMetrics.mape && (
                    <Chip
                      size="small"
                      label={`MAPE: ${predictionMetrics.mape}%`}
                      color="primary"
                    />
                  )}
                  {predictionMetrics.smape && (
                    <Chip
                      size="small"
                      label={`sMAPE: ${predictionMetrics.smape}%`}
                      color="info"
                    />
                  )}
                  {predictionMetrics.mase && (
                    <Chip
                      size="small"
                      label={`MASE: ${predictionMetrics.mase}`}
                      color="default"
                    />
                  )}
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Model Breakdown (for ensemble) */}
      {isEnsemble && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Model Contributions
              </Typography>
              
              <List dense>
                {ensemblePrediction!.models
                  .sort((a, b) => b.weight - a.weight)
                  .map((model, idx) => (
                    <ListItem key={idx}>
                      <ListItemIcon>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: `hsla(${idx * 60}, 70%, 50%, 0.7)`,
                          }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={model.name}
                        secondary={
                          <Box display="flex" justifyContent="space-between">
                            <span>Weight: {(model.weight * 100).toFixed(1)}%</span>
                            <span>Performance: {(model.performance * 100).toFixed(1)}%</span>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Prediction Values */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Prediction Values (Next 5 Steps)
            </Typography>
            
            <Grid container spacing={2}>
              {prediction.predictions.slice(0, 5).map((value, idx) => (
                <Grid item xs={12} sm={6} md={2.4} key={idx}>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', textAlign: 'center' }}>
                    <Typography variant="subtitle2" color="textSecondary">
                      Step {idx + 1}
                    </Typography>
                    <Typography variant="h6">
                      {value.toFixed(3)}
                    </Typography>
                    {prediction.confidenceIntervals && (
                      <Typography variant="caption" color="textSecondary">
                        [{prediction.confidenceIntervals.lower[idx].toFixed(3)}, {prediction.confidenceIntervals.upper[idx].toFixed(3)}]
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default PredictionChart;