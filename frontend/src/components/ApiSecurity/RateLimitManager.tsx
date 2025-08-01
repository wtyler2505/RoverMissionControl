import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Tabs,
  Tab,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  NotificationsActive as AlertIcon,
  BugReport as TestIcon,
  FileDownload as ExportIcon,
  MoreVert as MoreIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { rateLimitService, RateLimitPolicy } from '../../services/rateLimitService';
import { RateLimitPolicyList } from './RateLimitPolicyList';
import { RateLimitPolicyForm } from './RateLimitPolicyForm';
import { RateLimitMonitoring } from './RateLimitMonitoring';
import { RateLimitAlerts } from './RateLimitAlerts';
import { RateLimitTesting } from './RateLimitTesting';

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
      id={`rate-limit-tabpanel-${index}`}
      aria-labelledby={`rate-limit-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const RateLimitManager: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<RateLimitPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<RateLimitPolicy | null>(null);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await rateLimitService.getPolicies();
      setPolicies(data);
    } catch (error: any) {
      enqueueSnackbar('Failed to load rate limit policies', { variant: 'error' });
      console.error('Load policies error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCreatePolicy = () => {
    setSelectedPolicy(null);
    setShowPolicyForm(true);
  };

  const handleEditPolicy = (policy: RateLimitPolicy) => {
    setSelectedPolicy(policy);
    setShowPolicyForm(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    try {
      await rateLimitService.deletePolicy(policyId);
      enqueueSnackbar('Rate limit policy deleted successfully', { variant: 'success' });
      await loadPolicies();
    } catch (error: any) {
      enqueueSnackbar('Failed to delete policy', { variant: 'error' });
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await rateLimitService.exportPolicies(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rate_limit_policies.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      enqueueSnackbar(`Policies exported as ${format.toUpperCase()}`, { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar('Failed to export policies', { variant: 'error' });
    }
  };

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'global':
        return '🌍';
      case 'api_key':
        return '🔑';
      case 'user':
        return '👤';
      case 'endpoint':
        return '🔗';
      case 'ip_address':
        return '🌐';
      default:
        return '❓';
    }
  };

  const getWindowIcon = (window: string) => {
    switch (window) {
      case 'minute':
        return '⏱️';
      case 'hour':
        return '⏰';
      case 'day':
        return '📅';
      case 'week':
        return '📆';
      case 'month':
        return '🗓️';
      default:
        return '❓';
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h2">
              <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Rate Limiting Configuration
            </Typography>
            <Box>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleCreatePolicy}
                sx={{ mr: 1 }}
              >
                Create Policy
              </Button>
              <IconButton
                onClick={(e) => setAnchorEl(e.currentTarget)}
                size="small"
              >
                <MoreIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
              >
                <MenuItem onClick={() => { handleExport('json'); setAnchorEl(null); }}>
                  <ExportIcon sx={{ mr: 1 }} fontSize="small" />
                  Export as JSON
                </MenuItem>
                <MenuItem onClick={() => { handleExport('csv'); setAnchorEl(null); }}>
                  <ExportIcon sx={{ mr: 1 }} fontSize="small" />
                  Export as CSV
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Summary Stats */}
              <Grid container spacing={2} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Active Policies
                      </Typography>
                      <Typography variant="h4">
                        {policies.filter(p => p.isActive).length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Global Policies
                      </Typography>
                      <Typography variant="h4">
                        {policies.filter(p => p.targetType === 'global').length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        API Key Policies
                      </Typography>
                      <Typography variant="h4">
                        {policies.filter(p => p.targetType === 'api_key').length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom variant="body2">
                        Burst Enabled
                      </Typography>
                      <Typography variant="h4">
                        {policies.filter(p => p.burstEnabled).length}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Tabs */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  <Tab 
                    label="Policies" 
                    icon={<SettingsIcon />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Monitoring" 
                    icon={<AnalyticsIcon />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Alerts" 
                    icon={<AlertIcon />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Testing" 
                    icon={<TestIcon />}
                    iconPosition="start"
                  />
                </Tabs>
              </Box>

              <TabPanel value={tabValue} index={0}>
                <RateLimitPolicyList
                  policies={policies}
                  onEdit={handleEditPolicy}
                  onDelete={handleDeletePolicy}
                  onRefresh={loadPolicies}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <RateLimitMonitoring policies={policies} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <RateLimitAlerts policies={policies} />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <RateLimitTesting policies={policies} />
              </TabPanel>
            </>
          )}
        </CardContent>
      </Card>

      {/* Policy Form Dialog */}
      {showPolicyForm && (
        <RateLimitPolicyForm
          open={showPolicyForm}
          policy={selectedPolicy}
          onClose={() => setShowPolicyForm(false)}
          onSave={async () => {
            setShowPolicyForm(false);
            await loadPolicies();
          }}
        />
      )}
    </Box>
  );
};