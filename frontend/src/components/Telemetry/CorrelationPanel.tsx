/**
 * CorrelationPanel - Interactive correlation analysis interface
 * Provides comprehensive UI for analyzing correlations between telemetry streams
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Divider,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ExpandMore as ExpandMoreIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { 
  CorrelationAnalyzer,
  CorrelationMatrixEntry,
  CorrelationStreamData,
  LagAnalysisConfig 
} from '../../services/telemetry/CorrelationAnalyzer';
import { CorrelationMatrix } from './CorrelationMatrix';
import { LagAnalysisChart } from './LagAnalysisChart';

/**
 * Correlation panel props
 */
export interface CorrelationPanelProps {
  /** Available telemetry streams */
  streams: CorrelationStreamData[];
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Enable real-time updates */
  realTimeMode?: boolean;
  /** Initial lag analysis configuration */
  initialLagConfig?: Partial<LagAnalysisConfig>;
  /** Callback when correlation analysis starts */
  onAnalysisStart?: () => void;
  /** Callback when correlation analysis completes */
  onAnalysisComplete?: (results: Map<string, CorrelationMatrixEntry>) => void;
  /** Callback when streams are updated */
  onStreamsUpdate?: (streams: CorrelationStreamData[]) => void;
}

/**
 * Tab panel helper component
 */
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`correlation-tabpanel-${index}`}
    aria-labelledby={`correlation-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

/**
 * Stream pair selection dialog
 */
interface StreamPairDialogProps {
  open: boolean;
  streams: CorrelationStreamData[];
  onClose: () => void;
  onSelect: (streamId1: string, streamId2: string) => void;
}

const StreamPairDialog: React.FC<StreamPairDialogProps> = ({
  open,
  streams,
  onClose,
  onSelect
}) => {
  const [selectedStream1, setSelectedStream1] = useState('');
  const [selectedStream2, setSelectedStream2] = useState('');

  const handleSelect = () => {
    if (selectedStream1 && selectedStream2 && selectedStream1 !== selectedStream2) {
      onSelect(selectedStream1, selectedStream2);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Stream Pair for Detailed Analysis</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>First Stream</InputLabel>
            <Select
              value={selectedStream1}
              onChange={(e) => setSelectedStream1(e.target.value)}
              label="First Stream"
            >
              {streams.map(stream => (
                <MenuItem key={stream.id} value={stream.id}>
                  {stream.name} ({stream.data.length} points)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Second Stream</InputLabel>
            <Select
              value={selectedStream2}
              onChange={(e) => setSelectedStream2(e.target.value)}
              label="Second Stream"
              disabled={!selectedStream1}
            >
              {streams
                .filter(stream => stream.id !== selectedStream1)
                .map(stream => (
                  <MenuItem key={stream.id} value={stream.id}>
                    {stream.name} ({stream.data.length} points)
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedStream1 || !selectedStream2 || selectedStream1 === selectedStream2}
        >
          Analyze
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Main correlation analysis panel
 */
export const CorrelationPanel: React.FC<CorrelationPanelProps> = ({
  streams,
  refreshInterval = 5000,
  realTimeMode = false,
  initialLagConfig,
  onAnalysisStart,
  onAnalysisComplete,
  onStreamsUpdate
}) => {
  const theme = useTheme();
  
  // State management
  const [analyzer] = useState(() => new CorrelationAnalyzer(initialLagConfig));
  const [correlationMatrix, setCorrelationMatrix] = useState<Map<string, CorrelationMatrixEntry>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(realTimeMode);
  const [currentTab, setCurrentTab] = useState(0);
  const [selectedStreamPair, setSelectedStreamPair] = useState<{
    streamId1: string;
    streamId2: string;
    entry: CorrelationMatrixEntry;
  } | null>(null);
  const [pairDialogOpen, setPairDialogOpen] = useState(false);
  const [lagConfig, setLagConfig] = useState<LagAnalysisConfig>(
    analyzer.getLagAnalysisConfig()
  );

  // Stream statistics
  const streamStats = useMemo(() => {
    return streams.map(stream => ({
      ...stream,
      dataPoints: stream.data.length,
      hasData: stream.data.length > 0,
      timeRange: stream.timestamps.length > 0 ? {
        start: stream.timestamps[0],
        end: stream.timestamps[stream.timestamps.length - 1]
      } : null
    }));
  }, [streams]);

  // Valid stream pairs (streams with sufficient data)
  const validStreams = useMemo(() => {
    return streams.filter(stream => stream.data.length >= 3);
  }, [streams]);

  // Correlation statistics
  const correlationStats = useMemo(() => {
    const entries = Array.from(correlationMatrix.values());
    const strongCorrelations = entries.filter(e => Math.abs(e.pearson.coefficient) >= 0.7);
    const moderateCorrelations = entries.filter(e => 
      Math.abs(e.pearson.coefficient) >= 0.4 && Math.abs(e.pearson.coefficient) < 0.7
    );
    const significantLags = entries.reduce((sum, e) => sum + e.crossCorrelation.significantLags.length, 0);
    
    return {
      totalPairs: entries.length,
      strongCorrelations: strongCorrelations.length,
      moderateCorrelations: moderateCorrelations.length,
      significantLags,
      highestCorrelation: entries.reduce((max, e) => 
        Math.abs(e.pearson.coefficient) > Math.abs(max) ? e.pearson.coefficient : max, 0
      )
    };
  }, [correlationMatrix]);

  // Initialize analyzer with streams
  useEffect(() => {
    validStreams.forEach(stream => {
      analyzer.addStream(stream);
    });
  }, [analyzer, validStreams]);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      handleAnalyze();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Analysis function
  const handleAnalyze = useCallback(async () => {
    if (validStreams.length < 2) return;
    
    setIsAnalyzing(true);
    onAnalysisStart?.();

    try {
      // Update analyzer with latest stream data
      validStreams.forEach(stream => {
        analyzer.updateStreamData(stream.id, stream.data, stream.timestamps);
      });

      // Calculate correlation matrix
      const results = analyzer.calculateCorrelationMatrix();
      setCorrelationMatrix(results);
      
      onAnalysisComplete?.(results);
    } catch (error) {
      console.error('Correlation analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [validStreams, analyzer, onAnalysisStart, onAnalysisComplete]);

  // Handle stream pair selection for detailed analysis
  const handleStreamPairSelect = useCallback((streamId1: string, streamId2: string) => {
    const entry = analyzer.getCorrelation(streamId1, streamId2);
    if (entry) {
      setSelectedStreamPair({ streamId1, streamId2, entry });
      setCurrentTab(2); // Switch to detailed analysis tab
    }
  }, [analyzer]);

  // Handle matrix cell click
  const handleMatrixCellClick = useCallback((streamId1: string, streamId2: string) => {
    handleStreamPairSelect(streamId1, streamId2);
  }, [handleStreamPairSelect]);

  // Update lag configuration
  const handleLagConfigUpdate = useCallback((newConfig: Partial<LagAnalysisConfig>) => {
    const updatedConfig = { ...lagConfig, ...newConfig };
    setLagConfig(updatedConfig);
    analyzer.updateLagAnalysisConfig(updatedConfig);
  }, [analyzer, lagConfig]);

  if (validStreams.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="info">
          <Typography variant="h6">No Data Available</Typography>
          <Typography>
            At least 2 streams with 3 or more data points are required for correlation analysis.
          </Typography>
        </Alert>
      </Paper>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Control Panel */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Button
              variant="contained"
              onClick={handleAnalyze}
              disabled={isAnalyzing || validStreams.length < 2}
              startIcon={isAnalyzing ? <LinearProgress size={20} /> : <PlayIcon />}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Correlations'}
            </Button>
          </Grid>
          
          <Grid item>
            <FormControlLabel
              control={
                <Switch
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
              }
              label="Auto Refresh"
            />
          </Grid>

          <Grid item>
            <Button
              variant="outlined"
              onClick={() => setPairDialogOpen(true)}
              disabled={validStreams.length < 2}
            >
              Select Stream Pair
            </Button>
          </Grid>

          <Grid item xs>
            {/* Statistics */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label={`${validStreams.length} Streams`} 
                color="primary" 
                variant="outlined" 
                size="small"
              />
              <Chip 
                label={`${correlationStats.totalPairs} Pairs`} 
                variant="outlined" 
                size="small"
              />
              <Chip 
                label={`${correlationStats.strongCorrelations} Strong`} 
                color="error" 
                variant="outlined" 
                size="small"
              />
              <Chip 
                label={`${correlationStats.significantLags} Sig. Lags`} 
                color="warning" 
                variant="outlined" 
                size="small"
              />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Content Tabs */}
      <Paper>
        <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)}>
          <Tab label="Overview" />
          <Tab label="Correlation Matrix" />
          <Tab label="Detailed Analysis" />
          <Tab label="Configuration" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={currentTab} index={0}>
          <Grid container spacing={3}>
            {/* Stream Status Cards */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Stream Status
                  </Typography>
                  <List dense>
                    {streamStats.map(stream => (
                      <ListItem key={stream.id}>
                        <ListItemText
                          primary={stream.name}
                          secondary={`${stream.dataPoints} points, ${stream.sampleRate}Hz`}
                        />
                        <ListItemSecondaryAction>
                          <Chip
                            label={stream.hasData ? 'Active' : 'No Data'}
                            color={stream.hasData ? 'success' : 'default'}
                            size="small"
                          />
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Correlations */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Strongest Correlations
                  </Typography>
                  {correlationMatrix.size > 0 ? (
                    <List dense>
                      {Array.from(correlationMatrix.values())
                        .sort((a, b) => Math.abs(b.pearson.coefficient) - Math.abs(a.pearson.coefficient))
                        .slice(0, 5)
                        .map(entry => (
                          <ListItem 
                            key={`${entry.streamId1}:${entry.streamId2}`}
                            button
                            onClick={() => handleStreamPairSelect(entry.streamId1, entry.streamId2)}
                          >
                            <ListItemText
                              primary={`${entry.streamName1} ↔ ${entry.streamName2}`}
                              secondary={`Pearson: ${entry.pearson.coefficient.toFixed(3)} | Spearman: ${entry.spearman.coefficient.toFixed(3)}`}
                            />
                            <ListItemSecondaryAction>
                              <Chip
                                icon={entry.pearson.coefficient > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                                label={entry.pearson.significance}
                                color={entry.pearson.significance === 'strong' ? 'error' : 
                                      entry.pearson.significance === 'moderate' ? 'warning' : 'default'}
                                size="small"
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))
                      }
                    </List>
                  ) : (
                    <Alert severity="info">
                      Run correlation analysis to see results
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Analysis Summary */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Analysis Summary
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="primary">
                          {correlationStats.totalPairs}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Stream Pairs
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="error">
                          {correlationStats.strongCorrelations}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Strong Correlations
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="warning">
                          {correlationStats.moderateCorrelations}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Moderate Correlations
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color="info">
                          {correlationStats.significantLags}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Significant Lags
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Correlation Matrix Tab */}
        <TabPanel value={currentTab} index={1}>
          {correlationMatrix.size > 0 ? (
            <CorrelationMatrix
              correlations={Array.from(correlationMatrix.values())}
              streamNames={validStreams.map(s => s.id)}
              onCellClick={handleMatrixCellClick}
              interactive={true}
              showValues={true}
            />
          ) : (
            <Alert severity="info">
              Run correlation analysis to generate the matrix
            </Alert>
          )}
        </TabPanel>

        {/* Detailed Analysis Tab */}
        <TabPanel value={currentTab} index={2}>
          {selectedStreamPair ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Detailed Analysis: {selectedStreamPair.entry.streamName1} ↔ {selectedStreamPair.entry.streamName2}
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom>
                        Statistical Correlations
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Pearson:</Typography>
                          <Typography fontWeight="bold">
                            {selectedStreamPair.entry.pearson.coefficient.toFixed(4)} 
                            ({selectedStreamPair.entry.pearson.significance})
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Spearman:</Typography>
                          <Typography fontWeight="bold">
                            {selectedStreamPair.entry.spearman.coefficient.toFixed(4)}
                            ({selectedStreamPair.entry.spearman.significance})
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>Sample Size:</Typography>
                          <Typography>{selectedStreamPair.entry.pearson.sampleSize}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography>P-Value:</Typography>
                          <Typography>{selectedStreamPair.entry.pearson.pValue?.toFixed(6) || 'N/A'}</Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12}>
                  <LagAnalysisChart
                    crossCorrelation={selectedStreamPair.entry.crossCorrelation}
                    streamName1={selectedStreamPair.entry.streamName1}
                    streamName2={selectedStreamPair.entry.streamName2}
                    interactive={true}
                    showSignificantLags={true}
                  />
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Alert severity="info">
              Select a stream pair from the matrix or use "Select Stream Pair" button to view detailed analysis
            </Alert>
          )}
        </TabPanel>

        {/* Configuration Tab */}
        <TabPanel value={currentTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Correlation Analysis Configuration
          </Typography>
          
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Lag Analysis Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Maximum Lag</Typography>
                  {/* Slider for max lag would go here */}
                  <Typography variant="body2" color="text.secondary">
                    Current: {lagConfig.maxLag} samples
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Significance Threshold</Typography>
                  {/* Slider for significance threshold would go here */}
                  <Typography variant="body2" color="text.secondary">
                    Current: {lagConfig.significanceThreshold}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Window Size</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current: {lagConfig.windowSize} samples
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography gutterBottom>Analysis Step</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Current: {lagConfig.step} samples
                  </Typography>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={() => {
              // Reset to defaults
              const defaultConfig = new CorrelationAnalyzer().getLagAnalysisConfig();
              setLagConfig(defaultConfig);
              analyzer.updateLagAnalysisConfig(defaultConfig);
            }}>
              Reset to Defaults
            </Button>
            <Button variant="contained" onClick={handleAnalyze}>
              Apply & Reanalyze
            </Button>
          </Box>
        </TabPanel>
      </Paper>

      {/* Stream Pair Selection Dialog */}
      <StreamPairDialog
        open={pairDialogOpen}
        streams={validStreams}
        onClose={() => setPairDialogOpen(false)}
        onSelect={handleStreamPairSelect}
      />
    </Box>
  );
};

export default CorrelationPanel;