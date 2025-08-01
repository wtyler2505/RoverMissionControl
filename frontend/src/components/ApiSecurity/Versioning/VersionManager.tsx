import React, { useState, useEffect } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountTree as VersionIcon,
  Settings as StrategyIcon,
  SwapHoriz as MigrationIcon,
  Security as EncryptionIcon,
  VpnKey as KeyIcon,
  Assessment as ComplianceIcon,
  Analytics as AnalyticsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import VersionList from './VersionList';
import VersionStrategy from './VersionStrategy';
import MigrationManager from './MigrationManager';
import EncryptionConfig from './EncryptionConfig';
import KeyManager from './KeyManager';
import ComplianceMonitor from './ComplianceMonitor';
import UsageAnalytics from './UsageAnalytics';

import { VersioningService } from '../../../services/versioningService';
import { DashboardStats } from '../../../types/versioning';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`versioning-tabpanel-${index}`}
      aria-labelledby={`versioning-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `versioning-tab-${index}`,
    'aria-controls': `versioning-tabpanel-${index}`,
  };
}

const VersionManager: React.FC = () => {
  const [value, setValue] = useState(0);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await VersioningService.getDashboardStats();
      if (response.success) {
        setStats(response.data);
      } else {
        setError(response.message || 'Failed to load dashboard stats');
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const handleRefresh = () => {
    loadDashboardStats();
  };

  const getStatusColor = (value: number, threshold: { warning: number; critical: number }) => {
    if (value >= threshold.critical) return 'error';
    if (value >= threshold.warning) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with Stats Dashboard */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            API Versioning & Encryption Management
          </Typography>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : stats ? (
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    API Versions
                  </Typography>
                  <Typography variant="h5" component="div">
                    {stats.totalVersions}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${stats.activeVersions} Active`}
                      color="success"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      label={`${stats.deprecatedVersions} Deprecated`}
                      color="warning"
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    24h Traffic
                  </Typography>
                  <Typography variant="h5" component="div">
                    {stats.totalRequests24h.toLocaleString()}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label={`${stats.avgResponseTime}ms avg`}
                      color="info"
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      label={`${(stats.errorRate * 100).toFixed(1)}% errors`}
                      color={getStatusColor(stats.errorRate * 100, { warning: 1, critical: 5 })}
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Security
                  </Typography>
                  <Typography variant="h5" component="div">
                    {(stats.encryptionCoverage * 100).toFixed(0)}%
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label="Encryption Coverage"
                      color={getStatusColor(stats.encryptionCoverage * 100, { warning: 80, critical: 60 })}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <Chip
                      label={`${stats.activeKeys} Keys`}
                      color="info"
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="textSecondary" gutterBottom>
                    Compliance
                  </Typography>
                  <Typography variant="h5" component="div">
                    {(stats.complianceScore * 100).toFixed(0)}%
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Chip
                      label="Score"
                      color={getStatusColor(stats.complianceScore * 100, { warning: 80, critical: 60 })}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    {stats.pendingMigrations > 0 && (
                      <Chip
                        label={`${stats.pendingMigrations} Pending`}
                        color="warning"
                        size="small"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : null}
      </Box>

      {/* Main Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={value}
            onChange={handleChange}
            aria-label="versioning management tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              icon={<VersionIcon />}
              label="Versions"
              {...a11yProps(0)}
            />
            <Tab
              icon={<StrategyIcon />}
              label="Strategies"
              {...a11yProps(1)}
            />
            <Tab
              icon={<MigrationIcon />}
              label="Migrations"
              {...a11yProps(2)}
            />
            <Tab
              icon={<EncryptionIcon />}
              label="Encryption"
              {...a11yProps(3)}
            />
            <Tab
              icon={<KeyIcon />}
              label="Key Management"
              {...a11yProps(4)}
            />
            <Tab
              icon={<ComplianceIcon />}
              label="Compliance"
              {...a11yProps(5)}
            />
            <Tab
              icon={<AnalyticsIcon />}
              label="Analytics"
              {...a11yProps(6)}
            />
          </Tabs>
        </Box>

        <TabPanel value={value} index={0}>
          <VersionList onStatsChange={loadDashboardStats} />
        </TabPanel>
        <TabPanel value={value} index={1}>
          <VersionStrategy />
        </TabPanel>
        <TabPanel value={value} index={2}>
          <MigrationManager />
        </TabPanel>
        <TabPanel value={value} index={3}>
          <EncryptionConfig />
        </TabPanel>
        <TabPanel value={value} index={4}>
          <KeyManager onStatsChange={loadDashboardStats} />
        </TabPanel>
        <TabPanel value={value} index={5}>
          <ComplianceMonitor />
        </TabPanel>
        <TabPanel value={value} index={6}>
          <UsageAnalytics />
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default VersionManager;