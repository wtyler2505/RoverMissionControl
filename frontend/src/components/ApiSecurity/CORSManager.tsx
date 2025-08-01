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
  BugReport as TestIcon,
  Report as ViolationIcon,
  Collections as PresetIcon,
  FileDownload as ExportIcon,
  MoreVert as MoreIcon,
  Security as SecurityIcon,
  Public as PublicIcon,
  Link as EndpointIcon,
  Key as KeyIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { corsService } from '../../services/corsService';
import { CORSPolicy, CORSPolicyType, CORSStats } from '../../types/cors';
import { CORSPolicyList } from './CORSPolicyList';
import { CORSPolicyForm } from './CORSPolicyForm';
import { CORSTesting } from './CORSTesting';
import { CORSViolations } from './CORSViolations';
import { CORSPresets } from './CORSPresets';

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
      id={`cors-tabpanel-${index}`}
      aria-labelledby={`cors-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const CORSManager: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<CORSPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<CORSPolicy | null>(null);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [stats, setStats] = useState<CORSStats | null>(null);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [policiesData, statsData] = await Promise.all([
        corsService.getPolicies(),
        corsService.getStats()
      ]);
      setPolicies(policiesData);
      setStats(statsData);
    } catch (error: any) {
      enqueueSnackbar('Failed to load CORS data', { variant: 'error' });
      console.error('Load data error:', error);
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

  const handleEditPolicy = (policy: CORSPolicy) => {
    setSelectedPolicy(policy);
    setShowPolicyForm(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    try {
      await corsService.deletePolicy(policyId);
      enqueueSnackbar('CORS policy deleted successfully', { variant: 'success' });
      await loadData();
    } catch (error: any) {
      enqueueSnackbar('Failed to delete policy', { variant: 'error' });
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const blob = await corsService.exportPolicies(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cors_policies.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      enqueueSnackbar(`Policies exported as ${format.toUpperCase()}`, { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar('Failed to export policies', { variant: 'error' });
    }
  };

  const getPolicyTypeIcon = (type: CORSPolicyType) => {
    switch (type) {
      case CORSPolicyType.GLOBAL:
        return <PublicIcon fontSize="small" />;
      case CORSPolicyType.ENDPOINT:
        return <EndpointIcon fontSize="small" />;
      case CORSPolicyType.API_KEY:
        return <KeyIcon fontSize="small" />;
    }
  };

  const getPolicyTypeColor = (type: CORSPolicyType) => {
    switch (type) {
      case CORSPolicyType.GLOBAL:
        return 'primary';
      case CORSPolicyType.ENDPOINT:
        return 'secondary';
      case CORSPolicyType.API_KEY:
        return 'default';
    }
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h2">
              <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              CORS Policy Management
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
              {stats && (
                <Grid container spacing={2} mb={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Active Policies
                        </Typography>
                        <Typography variant="h4">
                          {stats.active_policies}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          of {stats.total_policies} total
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Policy Types
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Chip
                            icon={<PublicIcon />}
                            label={stats.global_policies}
                            size="small"
                            color="primary"
                          />
                          <Chip
                            icon={<EndpointIcon />}
                            label={stats.endpoint_policies}
                            size="small"
                            color="secondary"
                          />
                          <Chip
                            icon={<KeyIcon />}
                            label={stats.api_key_policies}
                            size="small"
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Violations Today
                        </Typography>
                        <Typography variant="h4">
                          {stats.violations_today}
                        </Typography>
                        <Typography variant="body2" color="error">
                          {stats.violations_blocked} blocked
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom variant="body2">
                          Security Level
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1}>
                          <SecurityIcon color="success" />
                          <Typography variant="h6" color="success.main">
                            Secure
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              )}

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
                    label="Testing" 
                    icon={<TestIcon />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Violations" 
                    icon={<ViolationIcon />}
                    iconPosition="start"
                  />
                  <Tab 
                    label="Presets" 
                    icon={<PresetIcon />}
                    iconPosition="start"
                  />
                </Tabs>
              </Box>

              <TabPanel value={tabValue} index={0}>
                <CORSPolicyList
                  policies={policies}
                  onEdit={handleEditPolicy}
                  onDelete={handleDeletePolicy}
                  onRefresh={loadData}
                />
              </TabPanel>

              <TabPanel value={tabValue} index={1}>
                <CORSTesting policies={policies} />
              </TabPanel>

              <TabPanel value={tabValue} index={2}>
                <CORSViolations policies={policies} />
              </TabPanel>

              <TabPanel value={tabValue} index={3}>
                <CORSPresets onCreatePolicy={loadData} />
              </TabPanel>
            </>
          )}
        </CardContent>
      </Card>

      {/* Policy Form Dialog */}
      {showPolicyForm && (
        <CORSPolicyForm
          open={showPolicyForm}
          policy={selectedPolicy}
          onClose={() => setShowPolicyForm(false)}
          onSave={async () => {
            setShowPolicyForm(false);
            await loadData();
          }}
        />
      )}
    </Box>
  );
};