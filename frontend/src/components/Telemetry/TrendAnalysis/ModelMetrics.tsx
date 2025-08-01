/**
 * ModelMetrics - Display comprehensive metrics for all trend analysis models
 * Shows performance, comparisons, and model selection insights
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Functions as FunctionsIcon,
  Psychology as PsychologyIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { Bar, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

import { AdvancedTrendAnalysis } from '../../../../services/telemetry/trend';
import { PredictionEngine } from '../../../../services/telemetry/trend';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);

interface ModelMetricsProps {
  analysisResults: Map<string, AdvancedTrendAnalysis>;
  predictionEngine?: PredictionEngine;
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
    id={`metrics-tabpanel-${index}`}
    aria-labelledby={`metrics-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const ModelMetrics: React.FC<ModelMetricsProps> = ({
  analysisResults,
  predictionEngine
}) => {
  const [tabValue, setTabValue] = React.useState(0);

  // Aggregate metrics across all streams
  const aggregateMetrics = useMemo(() => {
    const metrics = {
      totalStreams: analysisResults.size,
      arimaModels: 0,
      nonLinearModels: 0,
      stationaryStreams: 0,
      totalChangePoints: 0,
      averageR2: 0,
      averageRMSE: 0,
      averageAIC: 0,
      bestModels: new Map<string, number>()
    };

    let r2Sum = 0;
    let rmseSum = 0;
    let aicSum = 0;
    let aicCount = 0;

    analysisResults.forEach(analysis => {
      // Count model types
      if (analysis.arima) {
        metrics.arimaModels++;
        aicSum += analysis.arima.aic;
        aicCount++;
      }
      if (analysis.trends.nonLinear) {
        metrics.nonLinearModels++;
      }

      // Count stationary streams
      if (analysis.stationarity.isStationary) {
        metrics.stationaryStreams++;
      }

      // Count change points
      metrics.totalChangePoints += analysis.changePoints.length;

      // Aggregate performance metrics
      r2Sum += analysis.trends.best.r2;
      rmseSum += analysis.trends.best.rmse;

      // Track best model types
      const bestType = analysis.trends.best.type;
      metrics.bestModels.set(bestType, (metrics.bestModels.get(bestType) || 0) + 1);
    });

    metrics.averageR2 = r2Sum / metrics.totalStreams;
    metrics.averageRMSE = rmseSum / metrics.totalStreams;
    metrics.averageAIC = aicCount > 0 ? aicSum / aicCount : 0;

    return metrics;
  }, [analysisResults]);

  // Get prediction engine performance
  const predictionPerformance = useMemo(() => {
    if (!predictionEngine) return null;
    return predictionEngine.getModelPerformance();
  }, [predictionEngine]);

  // Prepare comparison chart data
  const comparisonChartData = useMemo(() => {
    const models: string[] = [];
    const r2Values: number[] = [];
    const rmseValues: number[] = [];
    const counts: number[] = [];

    // Aggregate by model type
    const modelStats = new Map<string, { r2Sum: number; rmseSum: number; count: number }>();

    analysisResults.forEach(analysis => {
      const type = analysis.trends.best.type;
      const stats = modelStats.get(type) || { r2Sum: 0, rmseSum: 0, count: 0 };
      stats.r2Sum += analysis.trends.best.r2;
      stats.rmseSum += analysis.trends.best.rmse;
      stats.count++;
      modelStats.set(type, stats);
    });

    modelStats.forEach((stats, type) => {
      models.push(type);
      r2Values.push(stats.r2Sum / stats.count);
      rmseValues.push(stats.rmseSum / stats.count);
      counts.push(stats.count);
    });

    return {
      labels: models,
      datasets: [
        {
          label: 'Average R²',
          data: r2Values,
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          label: 'Average RMSE',
          data: rmseValues,
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
        },
      ],
    };
  }, [analysisResults]);

  const comparisonChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Model Performance Comparison',
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'R² Score',
        },
        min: 0,
        max: 1,
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'RMSE',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  // Prepare radar chart for model capabilities
  const radarChartData = useMemo(() => {
    if (!predictionPerformance) return null;

    const labels: string[] = [];
    const data: number[] = [];

    predictionPerformance.forEach((performance, model) => {
      labels.push(model);
      data.push(performance);
    });

    return {
      labels,
      datasets: [{
        label: 'Model Performance',
        data,
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(54, 162, 235, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(54, 162, 235, 1)',
      }],
    };
  }, [predictionPerformance]);

  const radarChartOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Prediction Model Performance',
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        max: 1,
        ticks: {
          stepSize: 0.2,
        },
      },
    },
  };

  // Format percentage
  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h4">
                {aggregateMetrics.totalStreams}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Analyzed Streams
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <FunctionsIcon color="secondary" sx={{ fontSize: 40 }} />
              <Typography variant="h4">
                {formatPercent(aggregateMetrics.averageR2)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Average R² Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PsychologyIcon color="info" sx={{ fontSize: 40 }} />
              <Typography variant="h4">
                {aggregateMetrics.arimaModels}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                ARIMA Models
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon color="success" sx={{ fontSize: 40 }} />
              <Typography variant="h4">
                {aggregateMetrics.totalChangePoints}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Change Points
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Model Comparison" />
          <Tab label="Stream Details" />
          <Tab label="Prediction Performance" />
          <Tab label="Model Selection" />
        </Tabs>
      </Box>

      {/* Model Comparison Tab */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={2}>
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Box height={300}>
                  <Bar data={comparisonChartData} options={comparisonChartOptions} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Model Distribution
                </Typography>
                <List dense>
                  {Array.from(aggregateMetrics.bestModels.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([model, count]) => (
                      <ListItem key={model}>
                        <ListItemIcon>
                          <CheckCircleIcon color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={model}
                          secondary={`Selected for ${count} streams (${formatPercent(count / aggregateMetrics.totalStreams)})`}
                        />
                      </ListItem>
                    ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Stream Details Tab */}
      <TabPanel value={tabValue} index={1}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Stream</TableCell>
                <TableCell>Best Model</TableCell>
                <TableCell align="right">R²</TableCell>
                <TableCell align="right">RMSE</TableCell>
                <TableCell align="right">MAE</TableCell>
                <TableCell>ARIMA</TableCell>
                <TableCell>Stationary</TableCell>
                <TableCell align="right">Change Points</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.from(analysisResults.entries()).map(([streamId, analysis]) => (
                <TableRow key={streamId}>
                  <TableCell>{streamId}</TableCell>
                  <TableCell>
                    <Chip
                      label={analysis.trends.best.type}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">
                    {analysis.trends.best.r2.toFixed(3)}
                  </TableCell>
                  <TableCell align="right">
                    {analysis.trends.best.rmse.toFixed(3)}
                  </TableCell>
                  <TableCell align="right">
                    {analysis.trends.best.mae.toFixed(3)}
                  </TableCell>
                  <TableCell>
                    {analysis.arima ? (
                      <Tooltip title={`AIC: ${analysis.arima.aic.toFixed(2)}`}>
                        <Chip
                          label={`(${analysis.arima.config.p},${analysis.arima.config.d},${analysis.arima.config.q})`}
                          size="small"
                          color="info"
                        />
                      </Tooltip>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {analysis.stationarity.isStationary ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <Tooltip title={`p-value: ${analysis.stationarity.pValue.toFixed(3)}`}>
                        <InfoIcon color="warning" fontSize="small" />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {analysis.changePoints.length > 0 ? (
                      <Chip
                        label={analysis.changePoints.length}
                        size="small"
                        color="warning"
                      />
                    ) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Prediction Performance Tab */}
      <TabPanel value={tabValue} index={2}>
        {predictionPerformance && radarChartData ? (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box height={300}>
                    <Radar data={radarChartData} options={radarChartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Model Performance Ranking
                  </Typography>
                  <List dense>
                    {Array.from(predictionPerformance.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([model, performance], idx) => (
                        <ListItem key={model}>
                          <ListItemIcon>
                            <Typography variant="h6" color="primary">
                              #{idx + 1}
                            </Typography>
                          </ListItemIcon>
                          <ListItemText
                            primary={model}
                            secondary={
                              <Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={performance * 100}
                                  sx={{ mb: 0.5 }}
                                />
                                <Typography variant="caption">
                                  Performance: {formatPercent(performance)}
                                </Typography>
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
          <Typography variant="body2" color="textSecondary">
            No prediction performance data available
          </Typography>
        )}
      </TabPanel>

      {/* Model Selection Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Model Selection Insights
                </Typography>
                
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Speed color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Stationarity"
                      secondary={`${formatPercent(aggregateMetrics.stationaryStreams / aggregateMetrics.totalStreams)} of streams are stationary. ARIMA models work best with stationary data.`}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <Timeline color="secondary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Non-Linear Trends"
                      secondary={`${aggregateMetrics.nonLinearModels} streams showed non-linear patterns. These benefit from polynomial or exponential models.`}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <TrendingUpIcon color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Change Points"
                      secondary={`${aggregateMetrics.totalChangePoints} change points detected across all streams. Consider segmented modeling for these streams.`}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemIcon>
                      <AssessmentIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Model Complexity"
                      secondary={`Average AIC: ${aggregateMetrics.averageAIC.toFixed(2)}. Lower AIC indicates better model fit with appropriate complexity.`}
                    />
                  </ListItem>
                </List>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Recommendations
                </Typography>
                <Box>
                  {aggregateMetrics.stationaryStreams < aggregateMetrics.totalStreams * 0.5 && (
                    <Chip
                      label="Consider differencing or detrending for non-stationary streams"
                      color="warning"
                      size="small"
                      sx={{ m: 0.5 }}
                    />
                  )}
                  {aggregateMetrics.averageR2 < 0.7 && (
                    <Chip
                      label="Explore additional features or external variables"
                      color="info"
                      size="small"
                      sx={{ m: 0.5 }}
                    />
                  )}
                  {aggregateMetrics.totalChangePoints > aggregateMetrics.totalStreams && (
                    <Chip
                      label="Implement adaptive models for streams with frequent changes"
                      color="secondary"
                      size="small"
                      sx={{ m: 0.5 }}
                    />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default ModelMetrics;