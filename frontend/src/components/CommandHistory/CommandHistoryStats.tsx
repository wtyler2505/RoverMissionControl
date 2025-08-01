/**
 * Command History Statistics Component
 * Displays key metrics and charts for command history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  useTheme,
  Skeleton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as DurationIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { commandHistoryService } from '../../services/commandHistoryService';
import { 
  CommandHistoryFilter,
  HistoryStatistics 
} from '../../types/command-history.types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface CommandHistoryStatsProps {
  filters: CommandHistoryFilter;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend,
  loading
}) => {
  const theme = useTheme();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            {loading ? (
              <Skeleton variant="text" width="60%" height={32} />
            ) : (
              <Typography variant="h4" component="div" sx={{ mb: 0.5 }}>
                {value}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="caption" color="textSecondary">
                {subtitle}
              </Typography>
            )}
            {trend !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {trend > 0 ? (
                  <TrendingUpIcon color="success" fontSize="small" />
                ) : (
                  <TrendingDownIcon color="error" fontSize="small" />
                )}
                <Typography
                  variant="caption"
                  color={trend > 0 ? 'success.main' : 'error.main'}
                  sx={{ ml: 0.5 }}
                >
                  {Math.abs(trend)}% from last period
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: color,
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 48,
              minHeight: 48
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export const CommandHistoryStats: React.FC<CommandHistoryStatsProps> = ({ filters }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<HistoryStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await commandHistoryService.getStatistics(
        filters.startTime,
        filters.endTime,
        filters.commandTypes
      );
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Format numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate success rate
  const successRate = statistics ? 
    ((statistics.successfulCommands / statistics.totalCommands) * 100).toFixed(1) : 0;

  // Chart configurations
  const commandTypeChartData = {
    labels: Object.keys(statistics?.commandTypeDistribution || {}),
    datasets: [
      {
        data: Object.values(statistics?.commandTypeDistribution || {}),
        backgroundColor: [
          theme.palette.primary.main,
          theme.palette.secondary.main,
          theme.palette.success.main,
          theme.palette.warning.main,
          theme.palette.error.main,
          theme.palette.info.main
        ],
        borderWidth: 0
      }
    ]
  };

  const statusChartData = {
    labels: Object.keys(statistics?.statusDistribution || {}),
    datasets: [
      {
        label: 'Commands by Status',
        data: Object.values(statistics?.statusDistribution || {}),
        backgroundColor: Object.keys(statistics?.statusDistribution || {}).map(status => {
          switch (status) {
            case 'completed': return theme.palette.success.main;
            case 'failed': return theme.palette.error.main;
            case 'cancelled': return theme.palette.warning.main;
            default: return theme.palette.grey[400];
          }
        })
      }
    ]
  };

  const chartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 10,
          font: {
            size: 11
          }
        }
      }
    }
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  if (error) {
    return (
      <Box sx={{ mb: 3, textAlign: 'center', py: 4 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {/* Stat Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Commands"
            value={formatNumber(statistics?.totalCommands || 0)}
            icon={<RefreshIcon sx={{ color: 'white' }} />}
            color={theme.palette.primary.main}
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Success Rate"
            value={`${successRate}%`}
            subtitle={`${formatNumber(statistics?.successfulCommands || 0)} successful`}
            icon={<SuccessIcon sx={{ color: 'white' }} />}
            color={theme.palette.success.main}
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Failed Commands"
            value={formatNumber(statistics?.failedCommands || 0)}
            subtitle={`${statistics?.totalRetries || 0} retries`}
            icon={<ErrorIcon sx={{ color: 'white' }} />}
            color={theme.palette.error.main}
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Avg Execution Time"
            value={`${(statistics?.avgExecutionTimeMs || 0).toFixed(0)}ms`}
            subtitle={`Max: ${(statistics?.maxExecutionTimeMs || 0).toFixed(0)}ms`}
            icon={<DurationIcon sx={{ color: 'white' }} />}
            color={theme.palette.warning.main}
            loading={loading}
          />
        </Grid>

        {/* Charts */}
        {statistics && !loading && (
          <>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Commands by Type
                  </Typography>
                  <Box sx={{ height: 300, position: 'relative' }}>
                    <Doughnut data={commandTypeChartData} options={chartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Commands by Status
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <Bar data={statusChartData} options={barChartOptions} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
    </Box>
  );
};