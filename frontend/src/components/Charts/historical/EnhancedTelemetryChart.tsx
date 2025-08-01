/**
 * EnhancedTelemetryChart Component
 * Integration component that adds historical comparison capabilities to existing TelemetryLineChart
 * Provides seamless integration with WebSocket streaming and historical data overlay
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Box, Paper, IconButton, Tooltip, Fab, Menu, MenuItem } from '@mui/material';
import {
  History as HistoryIcon,
  Compare as CompareIcon,
  Settings as SettingsIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon
} from '@mui/icons-material';

import { TelemetryLineChartFC, TelemetryLineChartProps } from '../charts/TelemetryLineChart';
import { HistoricalComparisonChartFC } from './HistoricalComparisonChart';
import { ComparisonModeSelector } from './ComparisonModeSelector';
import { StatisticalSummaryPanel } from './StatisticalSummaryPanel';
import { TimeRangeAlignmentTools } from './TimeRangeAlignmentTools';
import { ProgressiveDataLoader } from './ProgressiveDataLoader';
import { useHistoricalComparison } from './useHistoricalComparison';

import {
  ComparisonMode,
  HistoricalPeriod,
  AlignmentConfig,
  TimeRange,
  TimeRangePreset,
  ProgressiveLoadingConfig,
  DEFAULT_TIME_PRESETS,
  DEFAULT_COMPARISON_COLORS
} from './types';

export interface EnhancedTelemetryChartProps extends TelemetryLineChartProps {
  // Historical comparison features
  enableHistoricalComparison?: boolean;
  historicalDataSourceId?: string;
  defaultComparisonMode?: ComparisonMode;
  
  // UI configuration
  showComparisonControls?: boolean;
  showStatisticalSummary?: boolean;
  showAlignmentTools?: boolean;
  showProgressiveLoader?: boolean;
  compactMode?: boolean;
  
  // Progressive loading configuration
  progressiveLoadingConfig?: Partial<ProgressiveLoadingConfig>;
  
  // Callbacks
  onHistoricalPeriodAdded?: (period: HistoricalPeriod) => void;
  onComparisonModeChanged?: (mode: ComparisonMode) => void;
  onAlignmentChanged?: (alignment: AlignmentConfig) => void;
}

export const EnhancedTelemetryChart: React.FC<EnhancedTelemetryChartProps> = ({
  enableHistoricalComparison = false,
  historicalDataSourceId = 'default',
  defaultComparisonMode = 'overlay',
  showComparisonControls = true,
  showStatisticalSummary = false,
  showAlignmentTools = false,
  showProgressiveLoader = false,
  compactMode = false,
  progressiveLoadingConfig = {},
  onHistoricalPeriodAdded,
  onComparisonModeChanged,
  onAlignmentChanged,
  ...telemetryChartProps
}) => {
  // UI state
  const [isComparisonMode, setIsComparisonMode] = useState(enableHistoricalComparison);
  const [showControls, setShowControls] = useState(showComparisonControls);
  const [selectedPeriods, setSelectedPeriods] = useState<HistoricalPeriod[]>([]);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Progressive loading configuration
  const loadingConfig: ProgressiveLoadingConfig = useMemo(() => ({
    enableProgressive: true,
    overviewResolution: 100,
    detailResolution: 500,
    fullResolution: 1000,
    chunkSize: 10000,
    maxConcurrentRequests: 3,
    adaptiveLoading: true,
    memoryThreshold: 500,
    ...progressiveLoadingConfig
  }), [progressiveLoadingConfig]);

  // Historical comparison hook
  const {
    currentMode,
    datasets,
    statistics,
    loadingStates,
    alignment,
    setMode,
    addHistoricalPeriod,
    removeHistoricalPeriod,
    updateAlignment,
    refreshData,
    exportComparison,
    getMemoryUsage
  } = useHistoricalComparison({
    dataService: undefined, // Will use default service
    defaultMode: defaultComparisonMode,
    defaultAlignment: { mode: 'absolute' },
    progressiveLoading: loadingConfig,
    caching: {
      enabled: true,
      maxCacheSize: 50,
      ttl: 300000 // 5 minutes
    }
  });

  // Current time range based on telemetry data
  const currentTimeRange: TimeRange = useMemo(() => {
    if (!telemetryChartProps.data || telemetryChartProps.data.length === 0) {
      const now = new Date();
      return {
        start: new Date(now.getTime() - 3600000), // 1 hour ago
        end: now,
        duration: 3600000
      };
    }

    const data = telemetryChartProps.data;
    const start = data[0].time;
    const end = data[data.length - 1].time;
    
    return {
      start,
      end,
      duration: end.getTime() - start.getTime()
    };
  }, [telemetryChartProps.data]);

  // Handle comparison mode toggle
  const handleComparisonToggle = useCallback(() => {
    setIsComparisonMode(!isComparisonMode);
    if (!isComparisonMode && selectedPeriods.length === 0) {
      // Auto-add some default periods for demo
      const now = new Date();
      const periods: HistoricalPeriod[] = [
        {
          id: 'yesterday',
          label: 'Yesterday',
          startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          endTime: new Date(now.getTime() - 23 * 60 * 60 * 1000),
          color: DEFAULT_COMPARISON_COLORS.historical[0],
          visible: true,
          dataSourceId: historicalDataSourceId
        },
        {
          id: 'last-week',
          label: 'Last Week',
          startTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          endTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
          color: DEFAULT_COMPARISON_COLORS.historical[1],
          visible: true,
          dataSourceId: historicalDataSourceId
        }
      ];

      periods.forEach(period => {
        addHistoricalPeriod(period);
        setSelectedPeriods(prev => [...prev, period]);
        onHistoricalPeriodAdded?.(period);
      });
    }
  }, [isComparisonMode, selectedPeriods.length, addHistoricalPeriod, historicalDataSourceId, onHistoricalPeriodAdded]);

  // Handle mode change
  const handleModeChange = useCallback((mode: ComparisonMode) => {
    setMode(mode);
    onComparisonModeChanged?.(mode);
  }, [setMode, onComparisonModeChanged]);

  // Handle alignment change
  const handleAlignmentChange = useCallback((newAlignment: AlignmentConfig) => {
    updateAlignment(newAlignment);
    onAlignmentChanged?.(newAlignment);
  }, [updateAlignment, onAlignmentChanged]);

  // Handle time range preset selection
  const handlePresetSelect = useCallback((preset: TimeRangePreset) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - preset.duration);
    
    // Create new historical period
    const period: HistoricalPeriod = {
      id: `preset-${preset.id}-${Date.now()}`,
      label: `${preset.label} (${new Date().toLocaleDateString()})`,
      startTime,
      endTime,
      color: DEFAULT_COMPARISON_COLORS.historical[selectedPeriods.length % DEFAULT_COMPARISON_COLORS.historical.length],
      visible: true,
      dataSourceId: historicalDataSourceId
    };

    addHistoricalPeriod(period);
    setSelectedPeriods(prev => [...prev, period]);
    onHistoricalPeriodAdded?.(period);
  }, [addHistoricalPeriod, selectedPeriods.length, historicalDataSourceId, onHistoricalPeriodAdded]);

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleExport = (format: 'csv' | 'json' | 'png' | 'svg') => {
    exportComparison(format);
    handleMenuClose();
  };

  // Render main chart
  const renderChart = () => {
    if (isComparisonMode && datasets.length > 0) {
      // Convert telemetry data to historical data format for comparison
      const currentData = telemetryChartProps.data?.map(d => ({
        ...d,
        historicalPeriod: 'current',
        originalTimestamp: d.time,
        alignedTimestamp: d.time
      })) || [];

      return (
        <HistoricalComparisonChartFC
          currentData={currentData}
          historicalPeriods={selectedPeriods}
          datasets={datasets}
          mode={currentMode}
          alignment={alignment}
          visualization={{
            mode: currentMode,
            alignment,
            showConfidenceBands: true,
            showTrendlines: false,
            showAnomalies: true,
            showStatisticalMarkers: false,
            highlightDifferences: currentMode === 'difference',
            animationDuration: 300,
            colorScheme: DEFAULT_COMPARISON_COLORS
          }}
          progressiveLoading={loadingConfig}
          showLegend={true}
          showStatistics={showStatisticalSummary}
          onModeChange={handleModeChange}
          onAlignmentChange={handleAlignmentChange}
          onDataRequest={async (period, resolution) => {
            // This would typically make an API call
            return [];
          }}
        />
      );
    } else {
      // Standard telemetry chart
      return <TelemetryLineChartFC {...telemetryChartProps} />;
    }
  };

  // Render control panels
  const renderControls = () => {
    if (!showControls || !isComparisonMode) return null;

    return (
      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Mode selector */}
        <Paper sx={{ p: compactMode ? 1 : 2 }}>
          <ComparisonModeSelector
            currentMode={currentMode}
            availableModes={['overlay', 'side-by-side', 'difference', 'statistical']}
            onModeChange={handleModeChange}
            size={compactMode ? 'small' : 'medium'}
            showLabels={!compactMode}
          />
        </Paper>

        {/* Alignment tools */}
        {showAlignmentTools && (
          <TimeRangeAlignmentTools
            currentRange={currentTimeRange}
            historicalRanges={selectedPeriods.map(p => ({
              start: p.startTime,
              end: p.endTime,
              duration: p.endTime.getTime() - p.startTime.getTime(),
              label: p.label
            }))}
            alignment={alignment}
            presets={DEFAULT_TIME_PRESETS}
            onRangeChange={() => {}} // Not implemented for this integration
            onAlignmentChange={handleAlignmentChange}
            onPresetSelect={handlePresetSelect}
            syncEnabled={true}
          />
        )}

        {/* Progressive loader */}
        {showProgressiveLoader && Object.keys(loadingStates).length > 0 && (
          <ProgressiveDataLoader
            loadingStates={loadingStates}
            config={loadingConfig}
            onConfigChange={() => {}} // Config updates not implemented
            onLoadingPhaseChange={() => {}}
            showMemoryUsage={!compactMode}
            showPerformanceMetrics={!compactMode}
            compactView={compactMode}
          />
        )}

        {/* Statistics panel */}
        {showStatisticalSummary && statistics && (
          <StatisticalSummaryPanel
            statistics={statistics}
            selectedMetrics={['mean', 'stddev', 'correlation']}
            onMetricToggle={() => {}} // Not implemented
            showConfidenceIntervals={true}
            precision={2}
            compactMode={compactMode}
          />
        )}
      </Box>
    );
  };

  return (
    <Box position="relative">
      {/* Main chart */}
      <Paper sx={{ p: compactMode ? 1 : 2, position: 'relative' }}>
        {renderChart()}

        {/* Floating action button for comparison mode */}
        <Fab
          size={compactMode ? 'small' : 'medium'}
          color={isComparisonMode ? 'secondary' : 'primary'}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 1
          }}
          onClick={handleComparisonToggle}
        >
          {isComparisonMode ? <CloseIcon /> : <HistoryIcon />}
        </Fab>

        {/* Menu button for additional actions */}
        {isComparisonMode && (
          <IconButton
            sx={{
              position: 'absolute',
              top: 16,
              right: compactMode ? 72 : 88,
              zIndex: 1,
              backgroundColor: 'background.paper',
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
            onClick={handleMenuOpen}
          >
            <MoreIcon />
          </IconButton>
        )}

        {/* Action menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={() => handleExport('csv')}>Export CSV</MenuItem>
          <MenuItem onClick={() => handleExport('json')}>Export JSON</MenuItem>
          <MenuItem onClick={() => handleExport('png')}>Export PNG</MenuItem>
          <MenuItem onClick={() => setShowControls(!showControls)}>
            {showControls ? 'Hide' : 'Show'} Controls
          </MenuItem>
          <MenuItem onClick={refreshData}>Refresh Data</MenuItem>
          <MenuItem onClick={() => console.log('Memory usage:', getMemoryUsage(), 'MB')}>
            Memory Usage: {getMemoryUsage().toFixed(1)} MB
          </MenuItem>
        </Menu>
      </Paper>

      {/* Control panels */}
      {renderControls()}

      {/* Status indicators */}
      {isComparisonMode && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
          {Object.keys(loadingStates).length > 0 && (
            <Tooltip title="Historical data loading...">
              <IconButton
                size="small"
                sx={{
                  backgroundColor: 'info.main',
                  color: 'info.contrastText',
                  mb: 1,
                  '&:hover': {
                    backgroundColor: 'info.dark'
                  }
                }}
              >
                <CompareIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

export default EnhancedTelemetryChart;