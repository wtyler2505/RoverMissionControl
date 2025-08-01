/**
 * WebSocketStreamSelector - Enhanced component for discovering and subscribing to telemetry streams via WebSocket
 * Integrates with TelemetryStreamManager for real-time stream management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Switch,
  Slider,
  Select,
  MenuItem,
  Tooltip,
  Alert,
  Collapse,
  Stack,
  Divider,
  Badge,
  CircularProgress,
  Tab,
  Tabs,
  Grid,
  Card,
  CardContent,
  CardActions,
  LinearProgress
} from '@mui/material';
import {
  Add,
  Remove,
  Search,
  FilterList,
  Settings,
  Info,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Speed,
  Memory,
  DataUsage,
  Timeline,
  Analytics,
  Sensors,
  Battery80,
  Thermostat,
  Navigation,
  ExpandMore,
  ExpandLess,
  Star,
  StarBorder,
  Lock,
  LockOpen,
  SyncAlt,
  Assessment,
  WifiTethering,
  SignalCellularAlt,
  Router,
  Cable,
  Storage,
  Schedule,
  TrendingUp,
  BugReport,
  PredictiveAnalytics,
  CompareArrows
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { 
  telemetryStreamManager, 
  StreamChannel, 
  StreamAnalysisConfig 
} from '../../services/telemetry/TelemetryStreamManager';
import { 
  TelemetryStreamConfig, 
  BinaryProtocol, 
  StreamQuality 
} from '../../types/telemetry';

/**
 * Stream category type
 */
type StreamCategory = 'all' | 'sensors' | 'system' | 'navigation' | 'power' | 'science' | 'custom';

/**
 * Component props
 */
interface WebSocketStreamSelectorProps {
  onStreamSubscribed?: (streamId: string, config: TelemetryStreamConfig) => void;
  onStreamUnsubscribed?: (streamId: string) => void;
  maxStreams?: number;
  showAdvancedOptions?: boolean;
  favoriteStreams?: string[];
  className?: string;
}

/**
 * Styled components
 */
const SelectorContainer = styled(Paper)(({ theme }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default
}));

const ContentSection = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: theme.spacing(2)
}));

const StreamCard = styled(Card)<{ subscribed?: boolean; quality?: StreamQuality }>(
  ({ theme, subscribed, quality }) => ({
    marginBottom: theme.spacing(2),
    border: subscribed ? `2px solid ${theme.palette.primary.main}` : `1px solid ${theme.palette.divider}`,
    backgroundColor: subscribed ? theme.palette.action.selected : theme.palette.background.paper,
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'visible',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[4]
    },
    '&::before': quality && subscribed ? {
      content: '""',
      position: 'absolute',
      top: -2,
      left: -2,
      right: -2,
      height: 4,
      backgroundColor: 
        quality === StreamQuality.Good ? theme.palette.success.main :
        quality === StreamQuality.Fair ? theme.palette.warning.main :
        theme.palette.error.main,
      borderRadius: '4px 4px 0 0'
    } : {}
  })
);

const CategoryTab = styled(Tab)(({ theme }) => ({
  minHeight: 48,
  textTransform: 'none'
}));

const MetricChip = styled(Chip)(({ theme }) => ({
  height: 24,
  fontSize: '0.75rem',
  '& .MuiChip-icon': {
    fontSize: '1rem'
  }
}));

const AnalysisOption = styled(FormControlLabel)(({ theme }) => ({
  marginLeft: 0,
  marginRight: 0,
  '& .MuiFormControlLabel-label': {
    fontSize: '0.875rem'
  }
}));

/**
 * Helper functions
 */
const getStreamIcon = (channel: StreamChannel): React.ReactNode => {
  const id = channel.id.toLowerCase();
  if (id.includes('temp') || id.includes('thermal')) return <Thermostat />;
  if (id.includes('battery') || id.includes('power')) return <Battery80 />;
  if (id.includes('position') || id.includes('gps')) return <Navigation />;
  if (id.includes('sensor')) return <Sensors />;
  if (id.includes('speed') || id.includes('velocity')) return <Speed />;
  if (id.includes('memory') || id.includes('cpu')) return <Memory />;
  if (id.includes('signal') || id.includes('comm')) return <SignalCellularAlt />;
  if (id.includes('science') || id.includes('instrument')) return <Assessment />;
  return <Timeline />;
};

const getStreamCategory = (channel: StreamChannel): StreamCategory => {
  const id = channel.id.toLowerCase();
  if (id.includes('sensor')) return 'sensors';
  if (id.includes('cpu') || id.includes('memory') || id.includes('system')) return 'system';
  if (id.includes('position') || id.includes('gps') || id.includes('navigation')) return 'navigation';
  if (id.includes('battery') || id.includes('power') || id.includes('voltage')) return 'power';
  if (id.includes('science') || id.includes('instrument') || id.includes('spectro')) return 'science';
  return 'custom';
};

const formatDataRate = (rate: number): string => {
  if (rate >= 1000) return `${(rate / 1000).toFixed(1)}kHz`;
  if (rate >= 1) return `${rate.toFixed(1)}Hz`;
  return `${(rate * 1000).toFixed(0)}mHz`;
};

/**
 * WebSocketStreamSelector component
 */
export const WebSocketStreamSelector: React.FC<WebSocketStreamSelectorProps> = ({
  onStreamSubscribed,
  onStreamUnsubscribed,
  maxStreams = 20,
  showAdvancedOptions = true,
  favoriteStreams = [],
  className
}) => {
  // State
  const [channels, setChannels] = useState<StreamChannel[]>([]);
  const [subscriptions, setSubscriptions] = useState<Map<string, any>>(new Map());
  const [streamHealth, setStreamHealth] = useState<Map<string, any>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StreamCategory>('all');
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<StreamChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set(favoriteStreams));
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [showOnlySubscribed, setShowOnlySubscribed] = useState(false);
  
  // Stream configuration state
  const [streamConfig, setStreamConfig] = useState<Partial<TelemetryStreamConfig>>({
    bufferSize: 10000,
    decimationRatio: 10,
    frequency: 1
  });
  
  // Analysis configuration state
  const [analysisConfig, setAnalysisConfig] = useState<StreamAnalysisConfig>({
    enableStatistics: true,
    enableAnomalyDetection: false,
    enableCorrelation: false,
    enableTrendAnalysis: false,
    enablePredictions: false,
    enableDriftDetection: false,
    correlationStreams: [],
    anomalyThreshold: 3,
    predictionHorizon: 10
  });

  /**
   * Initialize and load channels
   */
  useEffect(() => {
    const initializeSelector = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialize stream manager
        await telemetryStreamManager.initialize();

        // Get available channels
        const availableChannels = telemetryStreamManager.getAvailableChannels();
        setChannels(availableChannels);

        // Get active subscriptions
        const activeStreams = telemetryStreamManager.getActiveStreams();
        const subsMap = new Map();
        activeStreams.forEach(stream => {
          subsMap.set(stream.config.streamId, stream);
        });
        setSubscriptions(subsMap);

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initializeSelector();

    // Listen for stream events
    const handleStreamSubscribed = (channel: StreamChannel) => {
      setChannels(prev => [...prev, channel]);
    };

    const handleStreamHealth = (health: any) => {
      setStreamHealth(prev => new Map(prev).set(health.streamId, health));
    };

    telemetryStreamManager.on('stream:subscribed', handleStreamSubscribed);
    telemetryStreamManager.on('stream:health', handleStreamHealth);

    return () => {
      telemetryStreamManager.off('stream:subscribed', handleStreamSubscribed);
      telemetryStreamManager.off('stream:health', handleStreamHealth);
    };
  }, []);

  /**
   * Update stream health periodically
   */
  useEffect(() => {
    const updateHealth = () => {
      const health = telemetryStreamManager.getStreamHealth();
      if (Array.isArray(health)) {
        const healthMap = new Map();
        health.forEach(h => healthMap.set(h.streamId, h));
        setStreamHealth(healthMap);
      }
    };

    updateHealth();
    const interval = setInterval(updateHealth, 2000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Filter channels
   */
  const filteredChannels = channels.filter(channel => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!channel.id.toLowerCase().includes(query) && 
          !channel.name.toLowerCase().includes(query) &&
          !(channel.description || '').toLowerCase().includes(query)) {
        return false;
      }
    }

    // Category filter
    if (selectedCategory !== 'all' && getStreamCategory(channel) !== selectedCategory) {
      return false;
    }

    // Active filter
    if (showOnlyActive) {
      const health = streamHealth.get(channel.id);
      if (!health || health.status === 'offline') {
        return false;
      }
    }

    // Subscribed filter
    if (showOnlySubscribed && !subscriptions.has(channel.id)) {
      return false;
    }

    return true;
  });

  /**
   * Group channels
   */
  const groupedChannels = {
    favorites: filteredChannels.filter(ch => favorites.has(ch.id)),
    subscribed: filteredChannels.filter(ch => subscriptions.has(ch.id) && !favorites.has(ch.id)),
    available: filteredChannels.filter(ch => !subscriptions.has(ch.id) && !favorites.has(ch.id))
  };

  /**
   * Handle stream subscription
   */
  const handleSubscribe = async (channel: StreamChannel) => {
    try {
      const subscription = await telemetryStreamManager.subscribe(
        channel.id,
        streamConfig,
        showAdvancedOptions ? analysisConfig : undefined
      );

      setSubscriptions(prev => new Map(prev).set(channel.id, subscription));
      onStreamSubscribed?.(channel.id, subscription.config);
      
    } catch (err) {
      console.error('Failed to subscribe:', err);
      setError(`Failed to subscribe to ${channel.name}: ${err.message}`);
    }
  };

  /**
   * Handle stream unsubscription
   */
  const handleUnsubscribe = async (streamId: string) => {
    try {
      await telemetryStreamManager.unsubscribe(streamId);
      setSubscriptions(prev => {
        const newMap = new Map(prev);
        newMap.delete(streamId);
        return newMap;
      });
      onStreamUnsubscribed?.(streamId);
    } catch (err) {
      console.error('Failed to unsubscribe:', err);
      setError(`Failed to unsubscribe: ${err.message}`);
    }
  };

  /**
   * Handle configuration dialog
   */
  const handleConfigureStream = (channel: StreamChannel) => {
    setSelectedChannel(channel);
    
    // Reset to channel defaults
    setStreamConfig({
      bufferSize: 10000,
      decimationRatio: 10,
      frequency: channel.frequency
    });
    
    // Load existing config if subscribed
    const existing = subscriptions.get(channel.id);
    if (existing) {
      setStreamConfig(existing.config);
    }
    
    setConfigDialogOpen(true);
  };

  /**
   * Handle configuration save
   */
  const handleConfigSave = async () => {
    if (!selectedChannel) return;

    try {
      // If already subscribed, unsubscribe first
      if (subscriptions.has(selectedChannel.id)) {
        await handleUnsubscribe(selectedChannel.id);
      }

      // Subscribe with new configuration
      await handleSubscribe(selectedChannel);
      setConfigDialogOpen(false);
    } catch (err) {
      console.error('Failed to apply configuration:', err);
    }
  };

  /**
   * Toggle favorite
   */
  const toggleFavorite = (streamId: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(streamId)) {
        newSet.delete(streamId);
      } else {
        newSet.add(streamId);
      }
      return newSet;
    });
  };

  /**
   * Get category counts
   */
  const getCategoryCount = (category: StreamCategory): number => {
    if (category === 'all') return channels.length;
    return channels.filter(ch => getStreamCategory(ch) === category).length;
  };

  /**
   * Render stream card
   */
  const renderStreamCard = (channel: StreamChannel) => {
    const isSubscribed = subscriptions.has(channel.id);
    const isFavorite = favorites.has(channel.id);
    const health = streamHealth.get(channel.id);
    const stats = isSubscribed ? telemetryStreamManager.getStreamStatistics(channel.id) : null;

    return (
      <StreamCard 
        key={channel.id} 
        subscribed={isSubscribed}
        quality={health?.quality}
      >
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box flex={1}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <Box sx={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 1,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {getStreamIcon(channel)}
                </Box>
                <Box flex={1}>
                  <Typography variant="h6" component="div">
                    {channel.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {channel.id}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => toggleFavorite(channel.id)}>
                  {isFavorite ? <Star color="primary" /> : <StarBorder />}
                </IconButton>
              </Stack>

              {channel.description && (
                <Typography variant="body2" color="text.secondary" paragraph>
                  {channel.description}
                </Typography>
              )}

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <MetricChip
                  icon={<Speed />}
                  label={formatDataRate(channel.frequency)}
                  size="small"
                  color={isSubscribed ? 'primary' : 'default'}
                />
                <MetricChip
                  icon={<Storage />}
                  label={channel.dataType}
                  size="small"
                  variant="outlined"
                />
                {channel.unit && (
                  <MetricChip
                    label={channel.unit}
                    size="small"
                    variant="outlined"
                  />
                )}
                {channel.protocol && (
                  <MetricChip
                    icon={<Cable />}
                    label={channel.protocol}
                    size="small"
                    variant="outlined"
                  />
                )}
                {channel.requiresAuth && (
                  <MetricChip
                    icon={<Lock />}
                    label={channel.requiredRole || 'Auth'}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Stack>

              {isSubscribed && health && (
                <Box mt={2}>
                  <Stack direction="row" spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Status
                      </Typography>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        {health.status === 'healthy' && <CheckCircle color="success" fontSize="small" />}
                        {health.status === 'degraded' && <Warning color="warning" fontSize="small" />}
                        {health.status === 'unhealthy' && <ErrorIcon color="error" fontSize="small" />}
                        <Typography variant="body2" fontWeight="bold">
                          {health.status}
                        </Typography>
                      </Stack>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Latency
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {health.latency}ms
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Data Rate
                      </Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {formatDataRate(health.dataRate)}
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {stats && (
                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        Buffer: {stats.bufferUsage?.toFixed(0)}% ({stats.dataPoints} points)
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={stats.bufferUsage || 0}
                        sx={{ mt: 0.5 }}
                      />
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Stack>
        </CardContent>
        
        <CardActions>
          <Button
            size="small"
            startIcon={<Settings />}
            onClick={() => handleConfigureStream(channel)}
          >
            Configure
          </Button>
          {isSubscribed ? (
            <Button
              size="small"
              color="error"
              startIcon={<Remove />}
              onClick={() => handleUnsubscribe(channel.id)}
            >
              Unsubscribe
            </Button>
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleSubscribe(channel)}
              disabled={subscriptions.size >= maxStreams}
            >
              Subscribe
            </Button>
          )}
        </CardActions>
      </StreamCard>
    );
  };

  return (
    <SelectorContainer className={className}>
      <HeaderSection>
        <Typography variant="h5" gutterBottom>
          Telemetry Stream Manager
        </Typography>
        
        <Stack spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search streams by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              )
            }}
          />

          <Stack direction="row" spacing={2} alignItems="center">
            <Box flex={1}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                {subscriptions.size} / {maxStreams} streams active
              </Alert>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyActive}
                  onChange={(e) => setShowOnlyActive(e.target.checked)}
                  size="small"
                />
              }
              label="Active only"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlySubscribed}
                  onChange={(e) => setShowOnlySubscribed(e.target.checked)}
                  size="small"
                />
              }
              label="Subscribed only"
            />
          </Stack>
        </Stack>
      </HeaderSection>

      <Tabs
        value={selectedCategory}
        onChange={(e, value) => setSelectedCategory(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <CategoryTab 
          label="All" 
          value="all" 
          icon={<Badge badgeContent={getCategoryCount('all')} color="primary">
            <Timeline />
          </Badge>}
          iconPosition="end"
        />
        <CategoryTab 
          label="Sensors" 
          value="sensors" 
          icon={<Badge badgeContent={getCategoryCount('sensors')} color="primary">
            <Sensors />
          </Badge>}
          iconPosition="end"
        />
        <CategoryTab 
          label="System" 
          value="system" 
          icon={<Badge badgeContent={getCategoryCount('system')} color="primary">
            <Memory />
          </Badge>}
          iconPosition="end"
        />
        <CategoryTab 
          label="Navigation" 
          value="navigation" 
          icon={<Badge badgeContent={getCategoryCount('navigation')} color="primary">
            <Navigation />
          </Badge>}
          iconPosition="end"
        />
        <CategoryTab 
          label="Power" 
          value="power" 
          icon={<Badge badgeContent={getCategoryCount('power')} color="primary">
            <Battery80 />
          </Badge>}
          iconPosition="end"
        />
        <CategoryTab 
          label="Science" 
          value="science" 
          icon={<Badge badgeContent={getCategoryCount('science')} color="primary">
            <Assessment />
          </Badge>}
          iconPosition="end"
        />
        <CategoryTab 
          label="Custom" 
          value="custom" 
          icon={<Badge badgeContent={getCategoryCount('custom')} color="primary">
            <Router />
          </Badge>}
          iconPosition="end"
        />
      </Tabs>

      <ContentSection>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : (
          <>
            {/* Favorites */}
            {groupedChannels.favorites.length > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" gutterBottom>
                  Favorites ({groupedChannels.favorites.length})
                </Typography>
                {groupedChannels.favorites.map(renderStreamCard)}
                <Divider sx={{ my: 3 }} />
              </>
            )}

            {/* Subscribed */}
            {groupedChannels.subscribed.length > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" gutterBottom>
                  Subscribed ({groupedChannels.subscribed.length})
                </Typography>
                {groupedChannels.subscribed.map(renderStreamCard)}
                <Divider sx={{ my: 3 }} />
              </>
            )}

            {/* Available */}
            {groupedChannels.available.length > 0 && (
              <>
                <Typography variant="overline" color="text.secondary" gutterBottom>
                  Available ({groupedChannels.available.length})
                </Typography>
                {groupedChannels.available.map(renderStreamCard)}
              </>
            )}

            {filteredChannels.length === 0 && (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No streams found matching your criteria
                </Typography>
              </Box>
            )}
          </>
        )}
      </ContentSection>

      {/* Configuration Dialog */}
      <Dialog
        open={configDialogOpen}
        onClose={() => setConfigDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Configure Stream: {selectedChannel?.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* Stream Configuration */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Stream Settings
              </Typography>
              
              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Buffer Size: {streamConfig.bufferSize?.toLocaleString()} points
                  </Typography>
                  <Slider
                    value={streamConfig.bufferSize || 10000}
                    onChange={(e, value) => setStreamConfig(prev => ({
                      ...prev,
                      bufferSize: value as number
                    }))}
                    min={1000}
                    max={100000}
                    step={1000}
                    marks={[
                      { value: 1000, label: '1k' },
                      { value: 25000, label: '25k' },
                      { value: 50000, label: '50k' },
                      { value: 100000, label: '100k' }
                    ]}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" gutterBottom>
                    Decimation Ratio: {streamConfig.decimationRatio}:1
                  </Typography>
                  <Slider
                    value={streamConfig.decimationRatio || 10}
                    onChange={(e, value) => setStreamConfig(prev => ({
                      ...prev,
                      decimationRatio: value as number
                    }))}
                    min={1}
                    max={100}
                    marks={[
                      { value: 1, label: 'None' },
                      { value: 10, label: '10:1' },
                      { value: 50, label: '50:1' },
                      { value: 100, label: '100:1' }
                    ]}
                  />
                </Box>

                <Box>
                  <Typography variant="body2" gutterBottom>
                    Sampling Rate: {streamConfig.frequency} Hz
                  </Typography>
                  <Slider
                    value={streamConfig.frequency || selectedChannel?.frequency || 1}
                    onChange={(e, value) => setStreamConfig(prev => ({
                      ...prev,
                      frequency: value as number
                    }))}
                    min={0.1}
                    max={selectedChannel?.frequency || 10}
                    step={0.1}
                    marks={[
                      { value: 0.1, label: '0.1 Hz' },
                      { value: 1, label: '1 Hz' },
                      { value: selectedChannel?.frequency || 10, label: `${selectedChannel?.frequency || 10} Hz` }
                    ]}
                  />
                </Box>
              </Stack>
            </Grid>

            {/* Analysis Configuration */}
            {showAdvancedOptions && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Real-time Analysis
                </Typography>
                
                <Stack spacing={2}>
                  <AnalysisOption
                    control={
                      <Switch
                        checked={analysisConfig.enableStatistics}
                        onChange={(e) => setAnalysisConfig(prev => ({
                          ...prev,
                          enableStatistics: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Analytics fontSize="small" />
                        <span>Statistical Analysis</span>
                      </Stack>
                    }
                  />
                  
                  <AnalysisOption
                    control={
                      <Switch
                        checked={analysisConfig.enableAnomalyDetection}
                        onChange={(e) => setAnalysisConfig(prev => ({
                          ...prev,
                          enableAnomalyDetection: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <BugReport fontSize="small" />
                        <span>Anomaly Detection</span>
                      </Stack>
                    }
                  />
                  
                  <AnalysisOption
                    control={
                      <Switch
                        checked={analysisConfig.enableTrendAnalysis}
                        onChange={(e) => setAnalysisConfig(prev => ({
                          ...prev,
                          enableTrendAnalysis: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TrendingUp fontSize="small" />
                        <span>Trend Analysis</span>
                      </Stack>
                    }
                  />
                  
                  <AnalysisOption
                    control={
                      <Switch
                        checked={analysisConfig.enableDriftDetection}
                        onChange={(e) => setAnalysisConfig(prev => ({
                          ...prev,
                          enableDriftDetection: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <SyncAlt fontSize="small" />
                        <span>Drift Detection</span>
                      </Stack>
                    }
                  />
                  
                  <AnalysisOption
                    control={
                      <Switch
                        checked={analysisConfig.enablePredictions}
                        onChange={(e) => setAnalysisConfig(prev => ({
                          ...prev,
                          enablePredictions: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <PredictiveAnalytics fontSize="small" />
                        <span>Predictions</span>
                      </Stack>
                    }
                  />
                  
                  <AnalysisOption
                    control={
                      <Switch
                        checked={analysisConfig.enableCorrelation}
                        onChange={(e) => setAnalysisConfig(prev => ({
                          ...prev,
                          enableCorrelation: e.target.checked
                        }))}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CompareArrows fontSize="small" />
                        <span>Correlation Analysis</span>
                      </Stack>
                    }
                  />

                  {analysisConfig.enableAnomalyDetection && (
                    <TextField
                      label="Anomaly Threshold (σ)"
                      type="number"
                      size="small"
                      value={analysisConfig.anomalyThreshold || 3}
                      onChange={(e) => setAnalysisConfig(prev => ({
                        ...prev,
                        anomalyThreshold: parseFloat(e.target.value) || 3
                      }))}
                      helperText="Standard deviations for anomaly detection"
                      fullWidth
                    />
                  )}

                  {analysisConfig.enablePredictions && (
                    <TextField
                      label="Prediction Horizon"
                      type="number"
                      size="small"
                      value={analysisConfig.predictionHorizon || 10}
                      onChange={(e) => setAnalysisConfig(prev => ({
                        ...prev,
                        predictionHorizon: parseInt(e.target.value) || 10
                      }))}
                      helperText="Number of future points to predict"
                      fullWidth
                    />
                  )}
                </Stack>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfigSave} variant="contained">
            Apply Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </SelectorContainer>
  );
};

export default WebSocketStreamSelector;