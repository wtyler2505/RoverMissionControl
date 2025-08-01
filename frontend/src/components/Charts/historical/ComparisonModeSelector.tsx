/**
 * ComparisonModeSelector Component
 * UI component for selecting comparison visualization modes
 * Supports overlay, side-by-side, difference, and statistical views
 */

import React from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton,
  Typography,
  Paper,
  Divider,
  Chip
} from '@mui/material';
import {
  Timeline as OverlayIcon,
  ViewColumn as SideBySideIcon,
  ShowChart as DifferenceIcon,
  Assessment as StatisticalIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import { ComparisonMode, ComparisonModeSelectorProps } from './types';

// Mode configuration with icons and descriptions
const MODE_CONFIG: Record<ComparisonMode, {
  icon: React.ElementType;
  label: string;
  description: string;
  shortcut?: string;
  color: string;
}> = {
  overlay: {
    icon: OverlayIcon,
    label: 'Overlay',
    description: 'Display all datasets on the same chart with transparency',
    shortcut: 'Alt+O',
    color: '#2196f3'
  },
  'side-by-side': {
    icon: SideBySideIcon,
    label: 'Side by Side',
    description: 'Show each dataset in separate adjacent charts',
    shortcut: 'Alt+S',
    color: '#4caf50'
  },
  difference: {
    icon: DifferenceIcon,
    label: 'Difference',
    description: 'Visualize the difference between current and historical data',
    shortcut: 'Alt+D',
    color: '#ff9800'
  },
  statistical: {
    icon: StatisticalIcon,
    label: 'Statistical',
    description: 'Show statistical comparison with box plots and confidence intervals',
    shortcut: 'Alt+T',
    color: '#9c27b0'
  }
};

export const ComparisonModeSelector: React.FC<ComparisonModeSelectorProps> = ({
  currentMode,
  availableModes,
  onModeChange,
  disabled = false,
  size = 'medium',
  orientation = 'horizontal',
  showLabels = true,
  showIcons = true
}) => {
  const handleModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: ComparisonMode | null
  ) => {
    if (newMode && !disabled) {
      onModeChange(newMode);
    }
  };

  const renderModeButton = (mode: ComparisonMode) => {
    const config = MODE_CONFIG[mode];
    const IconComponent = config.icon;
    const isSelected = currentMode === mode;
    const isAvailable = availableModes.includes(mode);

    if (!isAvailable) return null;

    const button = (
      <ToggleButton
        value={mode}
        selected={isSelected}
        disabled={disabled}
        size={size}
        sx={{
          border: 1,
          borderColor: isSelected ? config.color : 'divider',
          backgroundColor: isSelected ? `${config.color}20` : 'transparent',
          color: isSelected ? config.color : 'text.primary',
          '&:hover': {
            backgroundColor: `${config.color}30`,
            borderColor: config.color
          },
          '&.Mui-selected': {
            backgroundColor: `${config.color}20`,
            borderColor: config.color,
            color: config.color,
            '&:hover': {
              backgroundColor: `${config.color}30`
            }
          },
          minWidth: orientation === 'horizontal' ? 120 : 80,
          minHeight: 48,
          flexDirection: orientation === 'vertical' ? 'column' : 'row',
          gap: 0.5
        }}
      >
        {showIcons && (
          <IconComponent 
            fontSize={size === 'small' ? 'small' : 'medium'} 
          />
        )}
        {showLabels && (
          <Typography 
            variant={size === 'small' ? 'caption' : 'body2'}
            fontWeight={isSelected ? 600 : 400}
          >
            {config.label}
          </Typography>
        )}
      </ToggleButton>
    );

    return (
      <Tooltip
        key={mode}
        title={
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {config.label}
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              {config.description}
            </Typography>
            {config.shortcut && (
              <Chip
                label={config.shortcut}
                size="small"
                variant="outlined"
                sx={{ mt: 1, fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
        }
        placement={orientation === 'horizontal' ? 'top' : 'right'}
        arrow
      >
        {button}
      </Tooltip>
    );
  };

  // Compact mode for small spaces
  if (size === 'small' && !showLabels) {
    return (
      <Paper elevation={1} sx={{ p: 0.5, borderRadius: 2 }}>
        <ToggleButtonGroup
          value={currentMode}
          exclusive
          onChange={handleModeChange}
          orientation={orientation}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              border: 'none',
              borderRadius: 1.5,
              margin: 0.25,
              minWidth: 36,
              minHeight: 36
            }
          }}
        >
          {availableModes.map(renderModeButton)}
        </ToggleButtonGroup>
      </Paper>
    );
  }

  // Standard mode selector
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        gap: 1,
        alignItems: orientation === 'horizontal' ? 'center' : 'stretch'
      }}
    >
      <Typography variant="subtitle2" color="text.secondary" sx={{ minWidth: 'fit-content' }}>
        Comparison Mode:
      </Typography>
      
      <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <ToggleButtonGroup
          value={currentMode}
          exclusive
          onChange={handleModeChange}
          orientation={orientation}
          size={size}
          sx={{
            '& .MuiToggleButton-root': {
              border: 'none',
              '&:not(:first-of-type)': {
                borderLeft: orientation === 'horizontal' ? '1px solid' : 'none',
                borderTop: orientation === 'vertical' ? '1px solid' : 'none',
                borderColor: 'divider'
              }
            }
          }}
        >
          {availableModes.map(renderModeButton)}
        </ToggleButtonGroup>
      </Paper>

      {/* Info button */}
      <Tooltip
        title={
          <Box>
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Comparison Modes
            </Typography>
            {availableModes.map(mode => {
              const config = MODE_CONFIG[mode];
              return (
                <Box key={mode} sx={{ mb: 1 }}>
                  <Typography variant="caption" fontWeight={600}>
                    {config.label}:
                  </Typography>
                  <Typography variant="caption" display="block">
                    {config.description}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        }
        placement="bottom"
        arrow
      >
        <IconButton size="small" sx={{ ml: 0.5 }}>
          <InfoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

// Enhanced mode selector with additional features
export const EnhancedComparisonModeSelector: React.FC<ComparisonModeSelectorProps & {
  showModeStats?: boolean;
  onModeInfo?: (mode: ComparisonMode) => void;
  customModeConfig?: Partial<Record<ComparisonMode, Partial<typeof MODE_CONFIG[ComparisonMode]>>>;
}> = ({
  showModeStats = false,
  onModeInfo,
  customModeConfig = {},
  ...props
}) => {
  const [hoveredMode, setHoveredMode] = React.useState<ComparisonMode | null>(null);

  const mergedConfig = React.useMemo(() => {
    const merged = { ...MODE_CONFIG };
    Object.entries(customModeConfig).forEach(([mode, config]) => {
      if (merged[mode as ComparisonMode]) {
        merged[mode as ComparisonMode] = { ...merged[mode as ComparisonMode], ...config };
      }
    });
    return merged;
  }, [customModeConfig]);

  const handleModeHover = (mode: ComparisonMode | null) => {
    setHoveredMode(mode);
  };

  const handleModeInfo = (mode: ComparisonMode) => {
    onModeInfo?.(mode);
  };

  return (
    <Box>
      <ComparisonModeSelector {...props} />
      
      {/* Mode preview */}
      {hoveredMode && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1,
            p: 2,
            zIndex: 1000,
            borderLeft: 3,
            borderColor: mergedConfig[hoveredMode].color
          }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            <mergedConfig[hoveredMode].icon 
              sx={{ color: mergedConfig[hoveredMode].color }} 
            />
            <Typography variant="h6">
              {mergedConfig[hoveredMode].label} Mode
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" mb={2}>
            {mergedConfig[hoveredMode].description}
          </Typography>
          
          {showModeStats && (
            <Box>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                Best for: Data comparison, trend analysis, statistical insights
              </Typography>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

// Keyboard shortcut handler hook
export const useComparisonModeShortcuts = (
  onModeChange: (mode: ComparisonMode) => void,
  availableModes: ComparisonMode[]
) => {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;

      const shortcuts: Record<string, ComparisonMode> = {
        'o': 'overlay',
        's': 'side-by-side',
        'd': 'difference',
        't': 'statistical'
      };

      const mode = shortcuts[event.key.toLowerCase()];
      if (mode && availableModes.includes(mode)) {
        event.preventDefault();
        onModeChange(mode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange, availableModes]);
};

// Mode selector with preset configurations
export const PresetComparisonModeSelector: React.FC<ComparisonModeSelectorProps & {
  preset?: 'minimal' | 'full' | 'research' | 'operational';
}> = ({ preset = 'full', ...props }) => {
  const presetConfigs = {
    minimal: {
      availableModes: ['overlay', 'difference'] as ComparisonMode[],
      showLabels: false,
      size: 'small' as const
    },
    full: {
      availableModes: ['overlay', 'side-by-side', 'difference', 'statistical'] as ComparisonMode[],
      showLabels: true,
      size: 'medium' as const
    },
    research: {
      availableModes: ['statistical', 'difference', 'overlay'] as ComparisonMode[],
      showLabels: true,
      size: 'large' as const
    },
    operational: {
      availableModes: ['overlay', 'side-by-side'] as ComparisonMode[],
      showLabels: true,
      size: 'medium' as const
    }
  };

  const config = presetConfigs[preset];

  return (
    <ComparisonModeSelector
      {...props}
      {...config}
      availableModes={props.availableModes || config.availableModes}
    />
  );
};

export default ComparisonModeSelector;