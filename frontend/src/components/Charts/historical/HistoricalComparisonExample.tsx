/**
 * HistoricalComparisonExample Component
 * Comprehensive example showcasing all historical data comparison features
 * Demonstrates integration with existing telemetry infrastructure
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Card,
  CardContent,
  CardActions,
  Alert,
  Tabs,
  Tab,
  Divider
} from '@mui/material';
import {
  Timeline as TimelineIcon,
  Compare as CompareIcon,
  Assessment as AssessmentIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';

// Import our historical comparison components
import {
  HistoricalComparisonChart,
  ComparisonModeSelector,
  StatisticalSummaryPanel,
  TimeRangeAlignmentTools,
  ProgressiveDataLoader,
  EnhancedTelemetryChart,
  HistoricalComparisonDashboard,
  useHistoricalComparison
} from './index';

import {
  ComparisonMode,
  HistoricalPeriod,
  AlignmentConfig,
  TimeRange,
  DEFAULT_TIME_PRESETS,
  DEFAULT_COMPARISON_COLORS
} from './types';

// Mock data generator
const generateMockTelemetryData = (
  startTime: Date,
  endTime: Date,
  frequency: number = 1000,
  baseValue: number = 50,
  variation: number = 20,
  trend: number = 0
) => {
  const data = [];
  const duration = endTime.getTime() - startTime.getTime();
  const interval = Math.max(1000, duration / frequency);
  
  for (let time = startTime.getTime(); time < endTime.getTime(); time += interval) {
    const progress = (time - startTime.getTime()) / duration;
    const trendValue = baseValue + trend * progress;
    const noise = (Math.random() - 0.5) * variation;
    const cyclical = Math.sin(time / 100000) * variation * 0.3;
    
    data.push({
      time: new Date(time),
      value: trendValue + noise + cyclical,
      category: 'telemetry',
      metadata: {
        quality: Math.random() * 0.3 + 0.7,
        source: 'mock-generator'
      }
    });
  }
  
  return data;
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const HistoricalComparisonExample: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [currentMode, setCurrentMode] = useState<ComparisonMode>('overlay');
  const [alignment, setAlignment] = useState<AlignmentConfig>({ mode: 'absolute' });

  // Generate mock current data
  const currentData = useMemo(() => {
    const now = new Date();
    const startTime = new Date(now.getTime() - 3600000); // 1 hour ago
    return generateMockTelemetryData(startTime, now, 100, 75, 15, 5);
  }, []);

  // Generate mock historical periods
  const historicalPeriods = useMemo(() => {
    const now = new Date();
    const periods: HistoricalPeriod[] = [
      {
        id: 'yesterday',
        label: 'Yesterday Same Time',
        startTime: new Date(now.getTime() - 24 * 3600000 - 3600000),
        endTime: new Date(now.getTime() - 24 * 3600000),
        color: DEFAULT_COMPARISON_COLORS.historical[0],
        visible: true,
        dataSourceId: 'rover-telemetry'
      },
      {
        id: 'last-week',
        label: 'Last Week Same Time',
        startTime: new Date(now.getTime() - 7 * 24 * 3600000 - 3600000),
        endTime: new Date(now.getTime() - 7 * 24 * 3600000),
        color: DEFAULT_COMPARISON_COLORS.historical[1],
        visible: true,
        dataSourceId: 'rover-telemetry'
      },
      {
        id: 'baseline',
        label: 'Baseline Performance',
        startTime: new Date(now.getTime() - 30 * 24 * 3600000 - 3600000),
        endTime: new Date(now.getTime() - 30 * 24 * 3600000),
        color: DEFAULT_COMPARISON_COLORS.historical[2],
        visible: false,
        dataSourceId: 'rover-telemetry'
      }
    ];
    return periods;
  }, []);

  // Use historical comparison hook
  const {
    datasets,
    statistics,
    loadingStates,
    addHistoricalPeriod,
    removeHistoricalPeriod,
    updateAlignment,
    exportComparison,
    getMemoryUsage
  } = useHistoricalComparison({
    dataService: undefined, // Uses default mock service
    defaultMode: currentMode,
    defaultAlignment: alignment,
    caching: { enabled: true, maxCacheSize: 100, ttl: 600000 }
  });

  // Load initial historical periods
  useEffect(() => {
    historicalPeriods
      .filter(p => p.visible)
      .forEach(period => {
        addHistoricalPeriod(period);
      });
  }, [addHistoricalPeriod]);

  // Current time range for alignment tools
  const currentTimeRange: TimeRange = useMemo(() => {
    if (currentData.length === 0) {
      const now = new Date();
      return {
        start: new Date(now.getTime() - 3600000),
        end: now,
        duration: 3600000
      };
    }
    
    const start = currentData[0].time;
    const end = currentData[currentData.length - 1].time;
    return {
      start,
      end,
      duration: end.getTime() - start.getTime()
    };
  }, [currentData]);

  // Mock telemetry streams for dashboard
  const mockTelemetryStreams = useMemo(() => [
    {
      id: 'battery-voltage',
      name: 'Battery Voltage',
      unit: 'V',
      description: 'Main battery voltage level',
      data: generateMockTelemetryData(
        currentTimeRange.start,
        currentTimeRange.end,
        100,
        12.5,
        0.5,
        -0.1
      )
    },
    {
      id: 'motor-temperature',
      name: 'Motor Temperature',
      unit: '°C',
      description: 'Drive motor temperature',
      data: generateMockTelemetryData(
        currentTimeRange.start,
        currentTimeRange.end,
        100,
        45,
        10,
        2
      )
    },
    {
      id: 'signal-strength',
      name: 'Signal Strength',
      unit: 'dBm',
      description: 'Communication signal strength',
      data: generateMockTelemetryData(
        currentTimeRange.start,
        currentTimeRange.end,
        100,
        -65,
        15,
        0
      )
    }
  ], [currentTimeRange]);

  const renderBasicExample = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        Basic Historical Comparison
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        This example shows the basic historical comparison chart with overlay mode,
        comparing current telemetry data with historical periods.
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <HistoricalComparisonChart
          currentData={currentData.map(d => ({
            ...d,
            historicalPeriod: 'current',
            originalTimestamp: d.time,
            alignedTimestamp: d.time
          }))}
          historicalPeriods={historicalPeriods.filter(p => p.visible)}
          datasets={datasets}
          mode={currentMode}
          alignment={alignment}
          visualization={{
            mode: currentMode,
            alignment,
            showConfidenceBands: true,
            showTrendlines: false,
            showAnomalies: true,
            showStatisticalMarkers: true,
            highlightDifferences: currentMode === 'difference',
            animationDuration: 300,
            colorScheme: DEFAULT_COMPARISON_COLORS
          }}
          progressiveLoading={{
            enableProgressive: true,
            overviewResolution: 100,
            detailResolution: 500,
            fullResolution: 1000,
            chunkSize: 10000,
            maxConcurrentRequests: 3,
            adaptiveLoading: true,
            memoryThreshold: 500
          }}
          dimensions={{ width: 800, height: 400, margin: { top: 20, right: 30, bottom: 40, left: 50 } }}
          showLegend={true}
          showStatistics={false}
          onModeChange={setCurrentMode}
          onAlignmentChange={setAlignment}
        />
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Comparison Mode
              </Typography>
              <ComparisonModeSelector
                currentMode={currentMode}
                availableModes={['overlay', 'side-by-side', 'difference', 'statistical']}
                onModeChange={setCurrentMode}
                showLabels={true}
                showIcons={true}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => exportComparison('json')}
                >
                  Export JSON
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => exportComparison('csv')}
                >
                  Export CSV
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => console.log('Memory:', getMemoryUsage(), 'MB')}
                >
                  Memory: {getMemoryUsage().toFixed(1)}MB
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const renderAdvancedControls = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        Advanced Controls & Analytics
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Advanced features including time range alignment, statistical analysis,
        and progressive data loading capabilities.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <TimeRangeAlignmentTools
            currentRange={currentTimeRange}
            historicalRanges={historicalPeriods.map(p => ({
              start: p.startTime,
              end: p.endTime,
              duration: p.endTime.getTime() - p.startTime.getTime(),
              label: p.label
            }))}
            alignment={alignment}
            presets={DEFAULT_TIME_PRESETS}
            onRangeChange={() => {}}
            onAlignmentChange={(newAlignment) => {
              setAlignment(newAlignment);
              updateAlignment(newAlignment);
            }}
            onPresetSelect={(preset) => {
              console.log('Selected preset:', preset);
            }}
            syncEnabled={true}
          />
        </Grid>

        <Grid item xs={12} lg={4}>
          {Object.keys(loadingStates).length > 0 && (
            <ProgressiveDataLoader
              loadingStates={loadingStates}
              config={{
                enableProgressive: true,
                overviewResolution: 100,
                detailResolution: 500,
                fullResolution: 1000,
                chunkSize: 10000,
                maxConcurrentRequests: 3,
                adaptiveLoading: true,
                memoryThreshold: 500
              }}
              onConfigChange={() => {}}
              onLoadingPhaseChange={() => {}}
              showMemoryUsage={true}
              showPerformanceMetrics={true}
              compactView={false}
            />
          )}
        </Grid>

        {statistics && (
          <Grid item xs={12}>
            <StatisticalSummaryPanel
              statistics={statistics}
              selectedMetrics={['mean', 'stddev', 'correlation', 'min', 'max']}
              onMetricToggle={() => {}}
              showConfidenceIntervals={true}
              precision={2}
              compactMode={false}
              exportable={true}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );

  const renderEnhancedIntegration = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        Enhanced Telemetry Chart Integration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Shows how to integrate historical comparison with existing telemetry charts
        seamlessly while maintaining WebSocket streaming capabilities.
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Click the history icon in the top-right corner to enable comparison mode.
        This demonstrates how historical comparison can be added to existing charts.
      </Alert>

      <EnhancedTelemetryChart
        data={currentData}
        enableHistoricalComparison={true}
        showComparisonControls={true}
        showStatisticalSummary={true}
        showAlignmentTools={true}
        showProgressiveLoader={true}
        compactMode={false}
        onHistoricalPeriodAdded={(period) => {
          console.log('Historical period added:', period);
        }}
        onComparisonModeChanged={(mode) => {
          console.log('Comparison mode changed:', mode);
        }}
        onAlignmentChanged={(alignment) => {
          console.log('Alignment changed:', alignment);
        }}
      />
    </Box>
  );

  const renderDashboardExample = () => (
    <Box>
      <Typography variant="h5" gutterBottom>
        Historical Comparison Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Complete dashboard for managing multiple telemetry streams with historical
        comparison across all data sources.
      </Typography>

      <Paper sx={{ height: '80vh', mt: 2 }}>
        <HistoricalComparisonDashboard
          telemetryStreams={mockTelemetryStreams}
          defaultLayout="tabs"
          allowLayoutChange={true}
          enableRealTimeUpdates={true}
          enableAdvancedAnalytics={true}
          enableDataExport={true}
          enableSessionManagement={true}
          onDataRequest={async (streamId, timeRange, resolution) => {
            // Mock data request
            const stream = mockTelemetryStreams.find(s => s.id === streamId);
            return stream ? generateMockTelemetryData(
              timeRange.start,
              timeRange.end,
              resolution,
              50,
              20,
              0
            ) : [];
          }}
          onSessionSave={(session) => {
            console.log('Session saved:', session);
          }}
          onSessionLoad={(sessionId) => {
            console.log('Loading session:', sessionId);
            return {};
          }}
        />
      </Paper>
    </Box>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box mb={4}>
        <Typography variant="h3" component="h1" gutterBottom>
          Historical Data Comparison Examples
        </Typography>
        <Typography variant="h6" color="text.secondary" paragraph>
          Comprehensive demonstration of historical data comparison capabilities
          for telemetry charts with performance optimization and advanced analytics.
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
          <Tab 
            icon={<TimelineIcon />} 
            label="Basic Comparison" 
            iconPosition="start"
          />
          <Tab 
            icon={<AssessmentIcon />} 
            label="Advanced Controls" 
            iconPosition="start"
          />
          <Tab 
            icon={<CompareIcon />} 
            label="Enhanced Integration" 
            iconPosition="start"
          />
          <Tab 
            icon={<DashboardIcon />} 
            label="Full Dashboard" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {renderBasicExample()}
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {renderAdvancedControls()}
      </TabPanel>

      <TabPanel value={activeTab} index={2}>
        {renderEnhancedIntegration()}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        {renderDashboardExample()}
      </TabPanel>
    </Container>
  );
};

export default HistoricalComparisonExample;