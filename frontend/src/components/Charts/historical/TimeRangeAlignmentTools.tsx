/**
 * TimeRangeAlignmentTools Component
 * Advanced tools for aligning historical periods and synchronizing time ranges
 * Supports absolute time, relative time, and phase alignment modes
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  ButtonGroup,
  Slider,
  TextField,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Schedule as AbsoluteIcon,
  Timeline as RelativeIcon,
  Waves as PhaseIcon,
  Sync as SyncIcon,
  SyncDisabled as SyncDisabledIcon,
  Refresh as ResetIcon,
  Save as SaveIcon,
  Restore as LoadIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Speed as SpeedIcon,
  AccessTime as TimeIcon,
  TuneIcon,
  CompareArrows as CompareIcon
} from '@mui/icons-material';

import {
  TimeRangeAlignmentToolsProps,
  AlignmentMode,
  AlignmentConfig,
  TimeRange,
  TimeRangePreset,
  DEFAULT_TIME_PRESETS
} from './types';

// Alignment mode configuration
const ALIGNMENT_MODE_CONFIG: Record<AlignmentMode, {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
}> = {
  absolute: {
    icon: AbsoluteIcon,
    label: 'Absolute Time',
    description: 'Align data using exact timestamps',
    color: '#2196f3'
  },
  relative: {
    icon: RelativeIcon,
    label: 'Relative Time',
    description: 'Align data relative to a reference point',
    color: '#4caf50'
  },
  phase: {
    icon: PhaseIcon,
    label: 'Phase Alignment',
    description: 'Align data based on phase/pattern matching',
    color: '#ff9800'
  }
};

export const TimeRangeAlignmentTools: React.FC<TimeRangeAlignmentToolsProps> = ({
  currentRange,
  historicalRanges,
  alignment,
  presets = DEFAULT_TIME_PRESETS,
  onRangeChange,
  onAlignmentChange,
  onPresetSelect,
  syncEnabled = true,
  onSyncToggle
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['alignment']));
  const [customRange, setCustomRange] = useState<TimeRange>(currentRange);
  const [previewMode, setPreviewMode] = useState(false);
  const [alignmentPresets, setAlignmentPresets] = useState<AlignmentConfig[]>([]);

  // Handle alignment mode change
  const handleAlignmentModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: AlignmentMode | null
  ) => {
    if (newMode) {
      const newAlignment: AlignmentConfig = {
        ...alignment,
        mode: newMode
      };
      onAlignmentChange(newAlignment);
    }
  };

  // Handle reference point change
  const handleReferencePointChange = (newDate: Date | null) => {
    if (newDate) {
      const newAlignment: AlignmentConfig = {
        ...alignment,
        referencePoint: newDate
      };
      onAlignmentChange(newAlignment);
    }
  };

  // Handle phase offset change
  const handlePhaseOffsetChange = (event: Event, newValue: number | number[]) => {
    const offset = Array.isArray(newValue) ? newValue[0] : newValue;
    const newAlignment: AlignmentConfig = {
      ...alignment,
      phaseOffset: offset * 60 * 1000 // Convert minutes to milliseconds
    };
    onAlignmentChange(newAlignment);
  };

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

  // Calculate alignment statistics
  const alignmentStats = useMemo(() => {
    const totalDuration = historicalRanges.reduce(
      (sum, range) => sum + range.duration,
      currentRange.duration
    );
    
    const overlapCount = historicalRanges.filter(range => 
      range.start < currentRange.end && range.end > currentRange.start
    ).length;
    
    return {
      totalRanges: historicalRanges.length + 1,
      totalDuration,
      averageDuration: totalDuration / (historicalRanges.length + 1),
      overlapCount
    };
  }, [currentRange, historicalRanges]);

  // Render alignment mode selector
  const renderAlignmentModeSelector = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Alignment Mode
      </Typography>
      <ToggleButtonGroup
        value={alignment.mode}
        exclusive
        onChange={handleAlignmentModeChange}
        fullWidth
        size="small"
      >
        {Object.entries(ALIGNMENT_MODE_CONFIG).map(([mode, config]) => {
          const IconComponent = config.icon;
          return (
            <ToggleButton
              key={mode}
              value={mode}
              sx={{
                flexDirection: 'column',
                gap: 0.5,
                py: 1,
                border: 1,
                borderColor: alignment.mode === mode ? config.color : 'divider',
                backgroundColor: alignment.mode === mode ? `${config.color}20` : 'transparent',
                '&:hover': {
                  backgroundColor: `${config.color}30`
                }
              }}
            >
              <IconComponent sx={{ fontSize: 20, color: config.color }} />
              <Typography variant="caption" fontWeight={600}>
                {config.label}
              </Typography>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        {ALIGNMENT_MODE_CONFIG[alignment.mode].description}
      </Typography>
    </Box>
  );

  // Render alignment configuration
  const renderAlignmentConfig = () => {
    switch (alignment.mode) {
      case 'relative':
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Reference Point
            </Typography>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateTimePicker
                value={alignment.referencePoint || currentRange.start}
                onChange={handleReferencePointChange}
                renderInput={(props) => (
                  <TextField {...props} size="small" fullWidth />
                )}
              />
            </LocalizationProvider>
          </Box>
        );
        
      case 'phase':
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Phase Offset (minutes)
            </Typography>
            <Slider
              value={(alignment.phaseOffset || 0) / (60 * 1000)}
              onChange={handlePhaseOffsetChange}
              min={-60}
              max={60}
              step={1}
              marks={[
                { value: -60, label: '-1h' },
                { value: 0, label: '0' },
                { value: 60, label: '+1h' }
              ]}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${value}m`}
            />
          </Box>
        );
        
      default:
        return null;
    }
  };

  // Render time range presets
  const renderTimeRangePresets = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Quick Presets
      </Typography>
      <Grid container spacing={1}>
        {presets.map((preset) => (
          <Grid item key={preset.id}>
            <Chip
              label={preset.label}
              onClick={() => onPresetSelect(preset)}
              variant="outlined"
              size="small"
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'primary.light',
                  color: 'primary.contrastText'
                }
              }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  // Render custom time range
  const renderCustomTimeRange = () => (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Custom Time Range
      </Typography>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <DateTimePicker
              label="Start Time"
              value={customRange.start}
              onChange={(newDate) => {
                if (newDate) {
                  setCustomRange(prev => ({
                    ...prev,
                    start: newDate,
                    duration: prev.end.getTime() - newDate.getTime()
                  }));
                }
              }}
              renderInput={(props) => (
                <TextField {...props} size="small" fullWidth />
              )}
            />
          </Grid>
          <Grid item xs={6}>
            <DateTimePicker
              label="End Time"
              value={customRange.end}
              onChange={(newDate) => {
                if (newDate) {
                  setCustomRange(prev => ({
                    ...prev,
                    end: newDate,
                    duration: newDate.getTime() - prev.start.getTime()
                  }));
                }
              }}
              renderInput={(props) => (
                <TextField {...props} size="small" fullWidth />
              )}
            />
          </Grid>
        </Grid>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PlayIcon />}
          onClick={() => onRangeChange(customRange)}
          sx={{ mt: 1 }}
        >
          Apply Range
        </Button>
      </LocalizationProvider>
    </Box>
  );

  // Render synchronization controls
  const renderSyncControls = () => (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="subtitle2">
          Synchronization
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={syncEnabled}
              onChange={(e) => onSyncToggle?.(e.target.checked)}
              size="small"
            />
          }
          label=""
        />
      </Box>
      
      <Box display="flex" gap={1} flexWrap="wrap">
        <Tooltip title="Sync zoom across all charts">
          <Button
            variant={syncEnabled ? 'contained' : 'outlined'}
            size="small"
            startIcon={syncEnabled ? <SyncIcon /> : <SyncDisabledIcon />}
            color={syncEnabled ? 'primary' : 'inherit'}
          >
            Zoom
          </Button>
        </Tooltip>
        
        <Tooltip title="Sync pan across all charts">
          <Button
            variant={syncEnabled ? 'contained' : 'outlined'}
            size="small"
            startIcon={<CompareIcon />}
            color={syncEnabled ? 'primary' : 'inherit'}
          >
            Pan
          </Button>
        </Tooltip>
        
        <Tooltip title="Sync time selection">
          <Button
            variant={syncEnabled ? 'contained' : 'outlined'}
            size="small"
            startIcon={<TimeIcon />}
            color={syncEnabled ? 'primary' : 'inherit'}
          >
            Selection
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );

  // Render alignment statistics
  const renderAlignmentStats = () => (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ py: 1.5 }}>
        <Typography variant="subtitle2" gutterBottom>
          Alignment Statistics
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Total Ranges
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {alignmentStats.totalRanges}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Overlapping Ranges
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {alignmentStats.overlapCount}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Avg Duration
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {Math.round(alignmentStats.averageDuration / (1000 * 60))}m
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">
              Total Duration
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {Math.round(alignmentStats.totalDuration / (1000 * 60 * 60))}h
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  // Render preset management
  const renderPresetManagement = () => (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Typography variant="subtitle2">
          Alignment Presets
        </Typography>
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Save current alignment as preset">
            <Button startIcon={<SaveIcon />}>
              Save
            </Button>
          </Tooltip>
          <Tooltip title="Load alignment preset">
            <Button startIcon={<LoadIcon />}>
              Load
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>
      
      {alignmentPresets.length > 0 ? (
        <Box display="flex" gap={1} flexWrap="wrap">
          {alignmentPresets.map((preset, index) => (
            <Chip
              key={index}
              label={`Preset ${index + 1}`}
              variant="outlined"
              size="small"
              onClick={() => onAlignmentChange(preset)}
              onDelete={() => {
                setAlignmentPresets(prev => prev.filter((_, i) => i !== index));
              }}
            />
          ))}
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary">
          No saved presets
        </Typography>
      )}
    </Box>
  );

  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={600}>
          Time Range Alignment
        </Typography>
        <Box display="flex" gap={1}>
          <Tooltip title="Reset alignment">
            <IconButton size="small">
              <ResetIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Advanced settings">
            <IconButton size="small">
              <TuneIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Current alignment warning */}
      {alignment.mode !== 'absolute' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Using {ALIGNMENT_MODE_CONFIG[alignment.mode].label.toLowerCase()} alignment. 
          Data timestamps will be adjusted for comparison.
        </Alert>
      )}

      {/* Alignment Configuration */}
      <Accordion
        expanded={expandedSections.has('alignment')}
        onChange={() => toggleSection('alignment')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight={600}>
            Alignment Configuration
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderAlignmentModeSelector()}
          {renderAlignmentConfig()}
          {renderAlignmentStats()}
        </AccordionDetails>
      </Accordion>

      {/* Time Range Selection */}
      <Accordion
        expanded={expandedSections.has('timerange')}
        onChange={() => toggleSection('timerange')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight={600}>
            Time Range Selection
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ mb: 3 }}>
            {renderTimeRangePresets()}
          </Box>
          <Divider sx={{ my: 2 }} />
          {renderCustomTimeRange()}
        </AccordionDetails>
      </Accordion>

      {/* Synchronization */}
      <Accordion
        expanded={expandedSections.has('sync')}
        onChange={() => toggleSection('sync')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight={600}>
            Chart Synchronization
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderSyncControls()}
        </AccordionDetails>
      </Accordion>

      {/* Preset Management */}
      <Accordion
        expanded={expandedSections.has('presets')}
        onChange={() => toggleSection('presets')}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" fontWeight={600}>
            Preset Management
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {renderPresetManagement()}
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default TimeRangeAlignmentTools;