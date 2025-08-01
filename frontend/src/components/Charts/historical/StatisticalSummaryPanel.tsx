/**
 * StatisticalSummaryPanel Component
 * Displays statistical analysis and comparison metrics for historical data
 * Includes trend indicators, deviation metrics, and confidence intervals
 */

import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Collapse,
  Tooltip,
  Divider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Badge,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  ShowChart as CorrelationIcon,
  Timeline as VarianceIcon,
  Assessment as StatIcon,
  Download as ExportIcon,
  FilterList as FilterIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

import {
  StatisticalSummaryPanelProps,
  ComparisonStatistics,
  StatisticalMetric,
  DatasetStatistics
} from './types';

// Metric configuration with formatting and display options
const METRIC_CONFIG: Record<StatisticalMetric, {
  label: string;
  icon: React.ElementType;
  formatter: (value: number, precision?: number) => string;
  description: string;
  color: string;
  category: 'central' | 'spread' | 'distribution' | 'relationship';
}> = {
  mean: {
    label: 'Mean',
    icon: StatIcon,
    formatter: (value, precision = 2) => value.toFixed(precision),
    description: 'Average value of the dataset',
    color: '#2196f3',
    category: 'central'
  },
  median: {
    label: 'Median',
    icon: StatIcon,
    formatter: (value, precision = 2) => value.toFixed(precision),
    description: 'Middle value when data is sorted',
    color: '#4caf50',
    category: 'central'
  },
  min: {
    label: 'Minimum',
    icon: TrendingDownIcon,
    formatter: (value, precision = 2) => value.toFixed(precision),
    description: 'Lowest value in the dataset',
    color: '#f44336',
    category: 'distribution'
  },
  max: {
    label: 'Maximum',
    icon: TrendingUpIcon,
    formatter: (value, precision = 2) => value.toFixed(precision),
    description: 'Highest value in the dataset',
    color: '#ff9800',
    category: 'distribution'
  },
  stddev: {
    label: 'Std Dev',
    icon: VarianceIcon,
    formatter: (value, precision = 3) => value.toFixed(precision),
    description: 'Standard deviation - measure of spread',
    color: '#9c27b0',
    category: 'spread'
  },
  percentile: {
    label: 'Percentiles',
    icon: StatIcon,
    formatter: (value, precision = 2) => value.toFixed(precision),
    description: 'Percentile distribution values',
    color: '#795548',
    category: 'distribution'
  },
  correlation: {
    label: 'Correlation',
    icon: CorrelationIcon,
    formatter: (value, precision = 3) => value.toFixed(precision),
    description: 'Correlation coefficient with current data',
    color: '#607d8b',
    category: 'relationship'
  }
};

// Statistical significance indicators
const getSignificanceLevel = (value: number, type: 'correlation' | 'difference'): {
  level: 'high' | 'medium' | 'low' | 'none';
  color: string;
  label: string;
} => {
  if (type === 'correlation') {
    const abs = Math.abs(value);
    if (abs >= 0.8) return { level: 'high', color: '#4caf50', label: 'Strong' };
    if (abs >= 0.5) return { level: 'medium', color: '#ff9800', label: 'Moderate' };
    if (abs >= 0.3) return { level: 'low', color: '#2196f3', label: 'Weak' };
    return { level: 'none', color: '#9e9e9e', label: 'None' };
  } else {
    const abs = Math.abs(value);
    if (abs >= 0.3) return { level: 'high', color: '#f44336', label: 'High' };
    if (abs >= 0.1) return { level: 'medium', color: '#ff9800', label: 'Medium' };
    if (abs >= 0.05) return { level: 'low', color: '#2196f3', label: 'Low' };
    return { level: 'none', color: '#4caf50', label: 'Minimal' };
  }
};

export const StatisticalSummaryPanel: React.FC<StatisticalSummaryPanelProps> = ({
  statistics,
  selectedMetrics,
  onMetricToggle,
  showConfidenceIntervals = true,
  precision = 2,
  compactMode = false,
  exportable = true
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'significance'>('name');

  // Toggle section expansion
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Get filtered and sorted metrics
  const processedMetrics = useMemo(() => {
    let metrics = selectedMetrics.filter(metric => {
      if (filterCategory === 'all') return true;
      return METRIC_CONFIG[metric].category === filterCategory;
    });

    // Sort metrics
    metrics.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return METRIC_CONFIG[a].label.localeCompare(METRIC_CONFIG[b].label);
        case 'value':
          const aValue = statistics.current[a] || 0;
          const bValue = statistics.current[b] || 0;
          return bValue - aValue;
        case 'significance':
          // Sort by significance level
          return 0; // Placeholder
        default:
          return 0;
      }
    });

    return metrics;
  }, [selectedMetrics, filterCategory, sortBy, statistics]);

  // Calculate summary insights
  const insights = useMemo(() => {
    const insights: Array<{
      type: 'trend' | 'anomaly' | 'correlation' | 'stability';
      message: string;
      severity: 'info' | 'warning' | 'error';
      icon: React.ElementType;
    }> = [];

    // Check for significant correlations
    Object.entries(statistics.correlations).forEach(([datasetId, correlation]) => {
      const significance = getSignificanceLevel(correlation, 'correlation');
      if (significance.level === 'high') {
        insights.push({
          type: 'correlation',
          message: `Strong correlation (${correlation.toFixed(3)}) detected with ${datasetId}`,
          severity: 'info',
          icon: CorrelationIcon
        });
      } else if (significance.level === 'low' && Math.abs(correlation) < 0.1) {
        insights.push({
          type: 'correlation',
          message: `Low correlation (${correlation.toFixed(3)}) with ${datasetId} - data patterns differ significantly`,
          severity: 'warning',
          icon: WarningIcon
        });
      }
    });

    // Check for high variance
    if (statistics.current.stddev > statistics.current.mean * 0.5) {
      insights.push({
        type: 'stability',
        message: 'High variability detected - data shows significant fluctuations',
        severity: 'warning',
        icon: VarianceIcon
      });
    }

    return insights;
  }, [statistics]);

  const renderMetricCard = (metric: StatisticalMetric) => {
    const config = METRIC_CONFIG[metric];
    const currentValue = statistics.current[metric];
    const Icon = config.icon;

    if (currentValue === undefined) return null;

    return (
      <Card
        key={metric}
        sx={{
          height: compactMode ? 80 : 120,
          cursor: 'pointer',
          transition: 'all 0.2s',
          border: selectedMetrics.includes(metric) ? `2px solid ${config.color}` : '1px solid',
          borderColor: selectedMetrics.includes(metric) ? config.color : 'divider',
          '&:hover': {
            elevation: 4,
            transform: 'translateY(-2px)'
          }
        }}
        onClick={() => onMetricToggle(metric)}
      >
        <CardContent sx={{ p: compactMode ? 1 : 2, '&:last-child': { pb: compactMode ? 1 : 2 } }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Icon sx={{ color: config.color, fontSize: compactMode ? 16 : 20 }} />
              <Typography
                variant={compactMode ? 'caption' : 'body2'}
                fontWeight={600}
                color={config.color}
              >
                {config.label}
              </Typography>
            </Box>
            <Tooltip title={config.description}>
              <InfoIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            </Tooltip>
          </Box>

          <Typography
            variant={compactMode ? 'body2' : 'h6'}
            fontWeight={700}
            color="text.primary"
          >
            {config.formatter(currentValue, precision)}
          </Typography>

          {!compactMode && (
            <Box mt={1}>
              {/* Show comparison with historical data */}
              {Object.keys(statistics.historical).length > 0 && (
                <Box display="flex" gap={0.5} flexWrap="wrap">
                  {Object.entries(statistics.historical).slice(0, 2).map(([datasetId, histStats]) => {
                    const histValue = histStats[metric];
                    if (histValue === undefined) return null;

                    const difference = ((currentValue - histValue) / Math.abs(histValue)) * 100;
                    const isPositive = difference > 0;
                    const TrendIcon = Math.abs(difference) < 1 ? TrendingFlatIcon :
                      isPositive ? TrendingUpIcon : TrendingDownIcon;

                    return (
                      <Chip
                        key={datasetId}
                        size="small"
                        icon={<TrendIcon sx={{ fontSize: 12 }} />}
                        label={`${difference > 0 ? '+' : ''}${difference.toFixed(1)}%`}
                        color={Math.abs(difference) < 5 ? 'default' : isPositive ? 'warning' : 'error'}
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    );
                  })}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPercentileChart = () => {
    if (!selectedMetrics.includes('percentile') || !statistics.current.percentiles) return null;

    const percentiles = statistics.current.percentiles;
    const values = [
      { label: 'P25', value: percentiles.p25 },
      { label: 'P50', value: percentiles.p50 },
      { label: 'P75', value: percentiles.p75 },
      { label: 'P90', value: percentiles.p90 },
      { label: 'P95', value: percentiles.p95 },
      { label: 'P99', value: percentiles.p99 }
    ];

    const max = Math.max(...values.map(v => v.value));

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Percentile Distribution
          </Typography>
          <Box>
            {values.map(({ label, value }) => (
              <Box key={label} sx={{ mb: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                  <Typography variant="caption">{label}</Typography>
                  <Typography variant="caption" fontWeight={600}>
                    {value.toFixed(precision)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(value / max) * 100}
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 2
                    }
                  }}
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderConfidenceIntervals = () => {
    if (!showConfidenceIntervals || Object.keys(statistics.confidenceIntervals).length === 0) {
      return null;
    }

    return (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Confidence Intervals (95%)
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(statistics.confidenceIntervals).map(([datasetId, interval]) => (
              <Grid item xs={12} sm={6} key={datasetId}>
                <Box
                  sx={{
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'background.paper'
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {datasetId}
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    [{interval.lower.toFixed(precision)}, {interval.upper.toFixed(precision)}]
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {(interval.confidence * 100).toFixed(0)}%
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  const renderInsights = () => {
    return (
      <Box mt={2}>
        {insights.map((insight, index) => (
          <Alert
            key={index}
            severity={insight.severity}
            icon={<insight.icon />}
            sx={{ mb: 1 }}
          >
            {insight.message}
          </Alert>
        ))}
      </Box>
    );
  };

  return (
    <Paper sx={{ p: compactMode ? 1 : 2 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={600}>
          Statistical Summary
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          {/* Filter controls */}
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Category"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="central">Central</MenuItem>
              <MenuItem value="spread">Spread</MenuItem>
              <MenuItem value="distribution">Distribution</MenuItem>
              <MenuItem value="relationship">Relationship</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Sort</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              label="Sort"
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="value">Value</MenuItem>
              <MenuItem value="significance">Significance</MenuItem>
            </Select>
          </FormControl>

          {exportable && (
            <Tooltip title="Export Statistics">
              <IconButton size="small">
                <ExportIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Overview Section */}
      <Box mb={2}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('overview')}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Overview
          </Typography>
          <IconButton size="small">
            <ExpandIcon
              sx={{
                transform: expandedSections.has('overview') ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('overview')}>
          <Grid container spacing={compactMode ? 1 : 2} sx={{ mt: 0 }}>
            {processedMetrics.map(metric => (
              <Grid item xs={6} sm={4} md={3} key={metric}>
                {renderMetricCard(metric)}
              </Grid>
            ))}
          </Grid>

          {renderPercentileChart()}
        </Collapse>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Confidence Intervals Section */}
      <Box mb={2}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('confidence')}
        >
          <Typography variant="subtitle1" fontWeight={600}>
            Confidence Intervals
          </Typography>
          <IconButton size="small">
            <ExpandIcon
              sx={{
                transform: expandedSections.has('confidence') ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('confidence')}>
          {renderConfidenceIntervals()}
        </Collapse>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Insights Section */}
      <Box>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          sx={{ cursor: 'pointer' }}
          onClick={() => toggleSection('insights')}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              Insights
            </Typography>
            {insights.length > 0 && (
              <Badge badgeContent={insights.length} color="primary">
                <InfoIcon sx={{ fontSize: 16 }} />
              </Badge>
            )}
          </Box>
          <IconButton size="small">
            <ExpandIcon
              sx={{
                transform: expandedSections.has('insights') ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }}
            />
          </IconButton>
        </Box>

        <Collapse in={expandedSections.has('insights')}>
          {renderInsights()}
        </Collapse>
      </Box>

      {/* Settings */}
      <Box mt={2} pt={2} borderTop={1} borderColor="divider">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <FormControlLabel
            control={
              <Switch
                checked={showConfidenceIntervals}
                size="small"
              />
            }
            label="Show Confidence Intervals"
          />
          <FormControlLabel
            control={
              <Switch
                checked={compactMode}
                size="small"
              />
            }
            label="Compact Mode"
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default StatisticalSummaryPanel;