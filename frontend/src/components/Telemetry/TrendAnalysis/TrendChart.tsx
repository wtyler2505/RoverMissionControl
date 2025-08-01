/**
 * TrendChart - Visualization component for trend analysis results
 * Displays original data, fitted trends, and model comparisons
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Grid,
  Switch,
  FormControlLabel,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as RestartAltIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';
import { Line, Scatter } from 'react-chartjs-2';
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
import { AdvancedTrendAnalysis, TrendModel, TrendType } from '../../../../services/telemetry/trend';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface TrendChartProps {
  stream: TelemetryStream;
  analysis: AdvancedTrendAnalysis;
  height?: number;
  showConfidenceBands?: boolean;
  showResiduals?: boolean;
  onExport?: () => void;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  stream,
  analysis,
  height = 400,
  showConfidenceBands = true,
  showResiduals = false,
  onExport
}) => {
  const [selectedTrend, setSelectedTrend] = React.useState<'best' | 'linear' | 'nonLinear'>('best');
  const [showOriginalData, setShowOriginalData] = React.useState(true);
  const [showDetrended, setShowDetrended] = React.useState(false);
  const [showChangePoints, setShowChangePoints] = React.useState(true);
  const [zoomLevel, setZoomLevel] = React.useState(1);

  // Get the selected trend model
  const trendModel = useMemo(() => {
    if (selectedTrend === 'linear') return analysis.trends.linear;
    if (selectedTrend === 'nonLinear' && analysis.trends.nonLinear) return analysis.trends.nonLinear;
    return analysis.trends.best;
  }, [selectedTrend, analysis]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = stream.timestamps.map((ts, i) => {
      // Format timestamp for display
      const date = new Date(ts);
      return date.toLocaleTimeString();
    });

    const datasets: any[] = [];

    // Original data
    if (showOriginalData) {
      datasets.push({
        label: 'Original Data',
        data: stream.data,
        borderColor: 'rgba(75, 192, 192, 0.8)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        borderWidth: 1,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0,
        fill: false,
      });
    }

    // Trend line
    const trendData = stream.data.map((value, i) => value - trendModel.residuals[i]);
    datasets.push({
      label: `${trendModel.type} Trend`,
      data: trendData,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      fill: false,
    });

    // Confidence bands
    if (showConfidenceBands && trendModel.type !== TrendType.LINEAR) {
      const upperBand = trendData.map((value, i) => value + 2 * Math.sqrt(trendModel.rmse));
      const lowerBand = trendData.map((value, i) => value - 2 * Math.sqrt(trendModel.rmse));

      datasets.push({
        label: 'Upper Confidence Band',
        data: upperBand,
        borderColor: 'rgba(255, 99, 132, 0.3)',
        backgroundColor: 'rgba(255, 99, 132, 0.05)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: '+1',
      });

      datasets.push({
        label: 'Lower Confidence Band',
        data: lowerBand,
        borderColor: 'rgba(255, 99, 132, 0.3)',
        backgroundColor: 'rgba(255, 99, 132, 0.05)',
        borderWidth: 1,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: '-1',
      });
    }

    // Detrended data
    if (showDetrended) {
      datasets.push({
        label: 'Detrended Data',
        data: trendModel.detrended,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        backgroundColor: 'rgba(54, 162, 235, 0.1)',
        borderWidth: 1,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0,
        fill: false,
        yAxisID: 'y1',
      });
    }

    // Change points
    if (showChangePoints && analysis.changePoints.length > 0) {
      const changePointData = new Array(stream.data.length).fill(null);
      analysis.changePoints.forEach(cp => {
        if (cp.index < stream.data.length) {
          changePointData[cp.index] = stream.data[cp.index];
        }
      });

      datasets.push({
        label: 'Change Points',
        data: changePointData,
        borderColor: 'rgba(255, 159, 64, 1)',
        backgroundColor: 'rgba(255, 159, 64, 0.8)',
        borderWidth: 2,
        pointRadius: 8,
        pointHoverRadius: 10,
        pointStyle: 'triangle',
        showLine: false,
      });
    }

    return { labels, datasets };
  }, [stream, trendModel, showOriginalData, showDetrended, showChangePoints, showConfidenceBands, analysis]);

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
        },
      },
      title: {
        display: true,
        text: `Trend Analysis: ${stream.name}`,
        font: {
          size: 16,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<'line'>) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
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
        position: 'left' as const,
        title: {
          display: true,
          text: stream.unit || 'Value',
        },
        min: zoomLevel > 1 ? undefined : undefined,
        max: zoomLevel > 1 ? undefined : undefined,
      },
      y1: {
        display: showDetrended,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Detrended Value',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  }), [stream, showDetrended, zoomLevel]);

  // Residuals chart data
  const residualsChartData = useMemo(() => {
    if (!showResiduals) return null;

    return {
      labels: stream.timestamps.map((_, i) => i),
      datasets: [{
        label: 'Residuals',
        data: trendModel.residuals,
        borderColor: 'rgba(153, 102, 255, 0.8)',
        backgroundColor: 'rgba(153, 102, 255, 0.2)',
        borderWidth: 1,
        pointRadius: 3,
        pointHoverRadius: 5,
        showLine: false,
      }],
    };
  }, [showResiduals, stream, trendModel]);

  const residualsChartOptions: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Residuals Plot',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Index',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Residual',
        },
        // Add zero line
        grid: {
          color: (context) => context.tick.value === 0 ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)',
          lineWidth: (context) => context.tick.value === 0 ? 2 : 1,
        },
      },
    },
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev * 1.5, 5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev / 1.5, 1));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <Box>
      <Card>
        <CardContent>
          {/* Controls */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" gap={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={selectedTrend}
                  onChange={(e) => setSelectedTrend(e.target.value as any)}
                >
                  <MenuItem value="best">Best Model</MenuItem>
                  <MenuItem value="linear">Linear</MenuItem>
                  {analysis.trends.nonLinear && (
                    <MenuItem value="nonLinear">Non-Linear</MenuItem>
                  )}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={showOriginalData}
                    onChange={(e) => setShowOriginalData(e.target.checked)}
                  />
                }
                label="Original Data"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={showDetrended}
                    onChange={(e) => setShowDetrended(e.target.checked)}
                  />
                }
                label="Detrended"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={showChangePoints}
                    onChange={(e) => setShowChangePoints(e.target.checked)}
                  />
                }
                label="Change Points"
              />
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

          {/* Model Info */}
          <Box display="flex" gap={1} mb={2} flexWrap="wrap">
            <Chip
              label={`Model: ${trendModel.type}`}
              color="primary"
              size="small"
            />
            <Chip
              label={`R² = ${trendModel.r2.toFixed(3)}`}
              color="success"
              size="small"
            />
            <Chip
              label={`RMSE = ${trendModel.rmse.toFixed(3)}`}
              color="info"
              size="small"
            />
            <Chip
              label={`MAE = ${trendModel.mae.toFixed(3)}`}
              color="default"
              size="small"
            />
          </Box>

          {/* Main Chart */}
          <Box height={height}>
            <Line data={chartData} options={chartOptions} />
          </Box>

          {/* Model Equation */}
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              <strong>Model Equation:</strong> {trendModel.equation}
            </Typography>
          </Box>

          {/* Residuals Plot */}
          {showResiduals && residualsChartData && (
            <Box mt={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={showResiduals}
                    onChange={(e) => setShowResiduals(e.target.checked)}
                  />
                }
                label="Show Residuals Plot"
              />
              <Box height={200} mt={2}>
                <Scatter data={residualsChartData} options={residualsChartOptions} />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TrendChart;