import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button
} from '@mui/material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Security as SecurityIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Refresh as RefreshIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import auditService, { getSeverityColor, getComplianceColor } from '../../../services/auditService';
import { AuditDashboardStats, AuditSeverity, ComplianceFramework } from '../../../types/audit';

const SEVERITY_COLORS = {
  critical: '#d32f2f',
  high: '#f57c00',
  medium: '#fbc02d',
  low: '#689f38',
  info: '#1976d2'
};

const AuditDashboard: React.FC = () => {
  const [stats, setStats] = useState<AuditDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date())
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardStats = async () => {
    try {
      setError(null);
      const data = await auditService.getDashboardStats(
        dateRange.start.toISOString(),
        dateRange.end.toISOString()
      );
      setStats(data);
    } catch (err) {
      setError('Failed to load dashboard statistics');
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [dateRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardStats();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return null;
  }

  // Prepare chart data
  const severityData = Object.entries(stats.events_by_severity).map(([severity, count]) => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: count,
    color: SEVERITY_COLORS[severity as AuditSeverity]
  }));

  const categoryData = Object.entries(stats.events_by_category).map(([category, count]) => ({
    name: category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count
  }));

  const trendData = stats.trend_data.slice(-7); // Last 7 days

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Audit Dashboard
        </Typography>
        <Box display="flex" gap={2} alignItems="center">
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Start Date"
              value={dateRange.start}
              onChange={(date) => date && setDateRange(prev => ({ ...prev, start: startOfDay(date) }))}
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="End Date"
              value={dateRange.end}
              onChange={(date) => date && setDateRange(prev => ({ ...prev, end: endOfDay(date) }))}
              slotProps={{ textField: { size: 'small' } }}
            />
          </LocalizationProvider>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon className={refreshing ? 'spinning' : ''} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Total Events
                  </Typography>
                  <Typography variant="h4">
                    {stats.total_events.toLocaleString()}
                  </Typography>
                </Box>
                <SecurityIcon color="primary" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Critical Events
                  </Typography>
                  <Typography variant="h4" color="error">
                    {stats.events_by_severity.critical || 0}
                  </Typography>
                </Box>
                <WarningIcon color="error" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Success Rate
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {stats.total_events > 0
                      ? Math.round(((stats.total_events - (stats.events_by_severity.critical || 0)) / stats.total_events) * 100)
                      : 100}%
                  </Typography>
                </Box>
                <CheckCircleIcon color="success" fontSize="large" />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom variant="body2">
                    Trend
                  </Typography>
                  <Typography variant="h4">
                    {trendData.length > 1 &&
                      trendData[trendData.length - 1].total > trendData[trendData.length - 2].total ? (
                      <Box display="flex" alignItems="center" color="error.main">
                        <TrendingUpIcon />
                        +{Math.round(((trendData[trendData.length - 1].total - trendData[trendData.length - 2].total) / trendData[trendData.length - 2].total) * 100)}%
                      </Box>
                    ) : (
                      <Box display="flex" alignItems="center" color="success.main">
                        <TrendingDownIcon />
                        {trendData.length > 1 ? Math.round(((trendData[trendData.length - 1].total - trendData[trendData.length - 2].total) / trendData[trendData.length - 2].total) * 100) : 0}%
                      </Box>
                    )}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Event Trend
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#1976d2" name="Total Events" />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Events by Severity
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Events by Category
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#1976d2" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Top Actors
            </Typography>
            <Box sx={{ overflowY: 'auto', maxHeight: 350 }}>
              {stats.top_actors.map((actor, index) => (
                <Box
                  key={actor.actor_id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 1.5,
                    borderBottom: index < stats.top_actors.length - 1 ? '1px solid #e0e0e0' : 'none'
                  }}
                >
                  <Box>
                    <Typography variant="body1" fontWeight="medium">
                      {actor.actor_name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      ID: {actor.actor_id}
                    </Typography>
                  </Box>
                  <Chip label={`${actor.event_count} events`} size="small" />
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Critical Events */}
      {stats.recent_critical_events.length > 0 && (
        <Grid container spacing={3} mb={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Recent Critical Events
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Timestamp</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Event Type</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Actor</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Target</th>
                      <th style={{ padding: '8px', textAlign: 'left' }}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_critical_events.map((event) => (
                      <tr key={event.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                        <td style={{ padding: '8px' }}>
                          {format(new Date(event.timestamp), 'MMM dd, HH:mm:ss')}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <Chip
                            label={event.event_type}
                            size="small"
                            color="error"
                          />
                        </td>
                        <td style={{ padding: '8px' }}>{event.actor_name}</td>
                        <td style={{ padding: '8px' }}>{event.target_name || '-'}</td>
                        <td style={{ padding: '8px' }}>
                          <Chip
                            label={event.result}
                            size="small"
                            color={event.result === 'success' ? 'success' : 'error'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Compliance Summary */}
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Compliance Summary
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(stats.compliance_summary).map(([framework, summary]) => (
                <Grid item xs={12} sm={6} md={4} key={framework}>
                  <Box
                    sx={{
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa'
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Chip
                        label={framework.toUpperCase().replace(/_/g, ' ')}
                        size="small"
                        style={{ backgroundColor: getComplianceColor(framework as ComplianceFramework) }}
                        sx={{ color: 'white' }}
                      />
                      <Typography variant="caption" color="textSecondary">
                        {summary.retention_days} days retention
                      </Typography>
                    </Box>
                    <Typography variant="h6">{summary.total_events.toLocaleString()}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Events tracked
                    </Typography>
                    <Typography variant="caption" color="textSecondary" display="block" mt={1}>
                      Next archive: {format(new Date(summary.next_archive_date), 'MMM dd, yyyy')}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AuditDashboard;