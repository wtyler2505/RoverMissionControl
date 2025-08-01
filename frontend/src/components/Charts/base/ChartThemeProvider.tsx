/**
 * ChartThemeProvider Component
 * Provides theme integration for D3.js charts with Material-UI
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Theme } from '../../../theme/themes';

export interface ChartTheme {
  // Color palettes
  colors: {
    primary: string[];
    secondary: string[];
    categorical: string[];
    sequential: string[];
    diverging: string[];
    success: string;
    warning: string;
    error: string;
    info: string;
    telemetry: string;
    command: string;
    hardware: string;
    emergency: string;
  };
  
  // Text styles
  text: {
    primary: string;
    secondary: string;
    disabled: string;
    contrast: string;
    fontSize: {
      title: number;
      label: number;
      tick: number;
      tooltip: number;
    };
    fontFamily: string;
  };
  
  // Background colors
  background: {
    default: string;
    paper: string;
    tooltip: string;
    overlay: string;
  };
  
  // Grid and axis styles
  grid: {
    color: string;
    strokeWidth: number;
    dashArray: string;
    opacity: number;
  };
  
  axis: {
    color: string;
    strokeWidth: number;
    fontSize: number;
  };
  
  // Interactive states
  states: {
    hover: {
      opacity: number;
      strokeWidth: number;
      filter?: string;
    };
    active: {
      opacity: number;
      strokeWidth: number;
    };
    disabled: {
      opacity: number;
    };
  };
  
  // Shadows and effects
  effects: {
    shadow: string;
    glow: string;
    blur: number;
  };
  
  // Animation settings
  animation: {
    duration: number;
    easing: string;
  };
  
  // Chart-specific settings
  chart: {
    padding: number;
    cornerRadius: number;
    strokeWidth: number;
  };
}

const ChartThemeContext = createContext<ChartTheme | null>(null);

export const useChartTheme = (): ChartTheme => {
  const theme = useContext(ChartThemeContext);
  if (!theme) {
    throw new Error('useChartTheme must be used within ChartThemeProvider');
  }
  return theme;
};

interface ChartThemeProviderProps {
  children: React.ReactNode;
  customTheme?: Partial<ChartTheme>;
}

export const ChartThemeProvider: React.FC<ChartThemeProviderProps> = ({ 
  children, 
  customTheme 
}) => {
  const muiTheme = useTheme() as any; // Cast to any to access our custom theme
  const appTheme = muiTheme.appTheme as Theme | undefined;
  
  const chartTheme = useMemo<ChartTheme>(() => {
    // Use app theme if available, otherwise fall back to MUI theme
    const colors = appTheme?.colors || {
      primary: { main: muiTheme.palette.primary.main },
      secondary: { main: muiTheme.palette.secondary.main },
      error: { main: muiTheme.palette.error.main },
      warning: { main: muiTheme.palette.warning.main },
      success: { main: muiTheme.palette.success.main },
      info: { main: muiTheme.palette.info.main },
      text: {
        primary: muiTheme.palette.text.primary,
        secondary: muiTheme.palette.text.secondary,
        disabled: muiTheme.palette.text.disabled
      },
      background: {
        default: muiTheme.palette.background.default,
        paper: muiTheme.palette.background.paper
      },
      divider: muiTheme.palette.divider,
      telemetry: '#00bcd4',
      command: '#7b1fa2',
      hardware: '#4caf50',
      emergency: '#f44336'
    };
    
    const baseTheme: ChartTheme = {
      colors: {
        primary: generateColorScale(colors.primary?.main || muiTheme.palette.primary.main),
        secondary: generateColorScale(colors.secondary?.main || muiTheme.palette.secondary.main),
        categorical: [
          colors.primary?.main || muiTheme.palette.primary.main,
          colors.secondary?.main || muiTheme.palette.secondary.main,
          colors.telemetry,
          colors.command,
          colors.hardware,
          colors.success?.main || muiTheme.palette.success.main,
          colors.warning?.main || muiTheme.palette.warning.main,
          colors.info?.main || muiTheme.palette.info.main
        ],
        sequential: generateSequentialScale(colors.primary?.main || muiTheme.palette.primary.main),
        diverging: generateDivergingScale(
          colors.error?.main || muiTheme.palette.error.main,
          colors.success?.main || muiTheme.palette.success.main
        ),
        success: colors.success?.main || muiTheme.palette.success.main,
        warning: colors.warning?.main || muiTheme.palette.warning.main,
        error: colors.error?.main || muiTheme.palette.error.main,
        info: colors.info?.main || muiTheme.palette.info.main,
        telemetry: colors.telemetry,
        command: colors.command,
        hardware: colors.hardware,
        emergency: colors.emergency
      },
      
      text: {
        primary: colors.text?.primary || muiTheme.palette.text.primary,
        secondary: colors.text?.secondary || muiTheme.palette.text.secondary,
        disabled: colors.text?.disabled || muiTheme.palette.text.disabled,
        contrast: colors.text?.contrast || '#ffffff',
        fontSize: {
          title: 16,
          label: 12,
          tick: 10,
          tooltip: 11
        },
        fontFamily: appTheme?.typography?.fontFamily?.primary || muiTheme.typography.fontFamily
      },
      
      background: {
        default: colors.background?.default || muiTheme.palette.background.default,
        paper: colors.background?.paper || muiTheme.palette.background.paper,
        tooltip: muiTheme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        overlay: muiTheme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.3)'
      },
      
      grid: {
        color: colors.divider || muiTheme.palette.divider,
        strokeWidth: 1,
        dashArray: '3,3',
        opacity: muiTheme.palette.mode === 'dark' ? 0.2 : 0.3
      },
      
      axis: {
        color: colors.text?.secondary || muiTheme.palette.text.secondary,
        strokeWidth: 1,
        fontSize: 10
      },
      
      states: {
        hover: {
          opacity: 0.8,
          strokeWidth: 2,
          filter: muiTheme.palette.mode === 'dark' ? 'brightness(1.2)' : 'brightness(0.9)'
        },
        active: {
          opacity: 1,
          strokeWidth: 3
        },
        disabled: {
          opacity: 0.3
        }
      },
      
      effects: {
        shadow: appTheme?.shadows?.base || muiTheme.shadows[2],
        glow: muiTheme.palette.mode === 'dark' 
          ? '0 0 10px rgba(255, 255, 255, 0.3)' 
          : '0 0 10px rgba(0, 0, 0, 0.2)',
        blur: 4
      },
      
      animation: {
        duration: appTheme?.transitions?.duration?.base || 300,
        easing: appTheme?.transitions?.easing?.inOut || 'ease-in-out'
      },
      
      chart: {
        padding: 20,
        cornerRadius: appTheme?.borderRadius?.base || 4,
        strokeWidth: 2
      }
    };
    
    // Merge with custom theme
    return customTheme ? mergeThemes(baseTheme, customTheme) : baseTheme;
  }, [muiTheme, appTheme, customTheme]);
  
  return (
    <ChartThemeContext.Provider value={chartTheme}>
      {children}
    </ChartThemeContext.Provider>
  );
};

/**
 * Generate a color scale from a base color
 */
function generateColorScale(baseColor: string, steps = 5): string[] {
  const colors: string[] = [];
  const rgb = hexToRgb(baseColor);
  
  if (!rgb) return [baseColor];
  
  for (let i = 0; i < steps; i++) {
    const factor = 0.4 + (i / (steps - 1)) * 0.6;
    colors.push(rgbToHex(
      Math.round(rgb.r * factor),
      Math.round(rgb.g * factor),
      Math.round(rgb.b * factor)
    ));
  }
  
  return colors;
}

/**
 * Generate a sequential color scale
 */
function generateSequentialScale(baseColor: string, steps = 9): string[] {
  const colors: string[] = [];
  const rgb = hexToRgb(baseColor);
  
  if (!rgb) return [baseColor];
  
  for (let i = 0; i < steps; i++) {
    const factor = 0.1 + (i / (steps - 1)) * 0.9;
    colors.push(rgbToHex(
      Math.round(255 - (255 - rgb.r) * factor),
      Math.round(255 - (255 - rgb.g) * factor),
      Math.round(255 - (255 - rgb.b) * factor)
    ));
  }
  
  return colors;
}

/**
 * Generate a diverging color scale
 */
function generateDivergingScale(negativeColor: string, positiveColor: string, steps = 9): string[] {
  const colors: string[] = [];
  const negRgb = hexToRgb(negativeColor);
  const posRgb = hexToRgb(positiveColor);
  
  if (!negRgb || !posRgb) return [negativeColor, '#ffffff', positiveColor];
  
  const middle = Math.floor(steps / 2);
  
  for (let i = 0; i < steps; i++) {
    if (i < middle) {
      const factor = i / middle;
      colors.push(rgbToHex(
        Math.round(negRgb.r + (255 - negRgb.r) * factor),
        Math.round(negRgb.g + (255 - negRgb.g) * factor),
        Math.round(negRgb.b + (255 - negRgb.b) * factor)
      ));
    } else if (i === middle && steps % 2 === 1) {
      colors.push('#ffffff');
    } else {
      const factor = (i - middle) / (steps - middle - 1);
      colors.push(rgbToHex(
        Math.round(255 - (255 - posRgb.r) * factor),
        Math.round(255 - (255 - posRgb.g) * factor),
        Math.round(255 - (255 - posRgb.b) * factor)
      ));
    }
  }
  
  return colors;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Deep merge themes
 */
function mergeThemes(base: ChartTheme, custom: Partial<ChartTheme>): ChartTheme {
  return {
    colors: { ...base.colors, ...custom.colors },
    text: { 
      ...base.text, 
      ...custom.text,
      fontSize: { ...base.text.fontSize, ...custom.text?.fontSize }
    },
    background: { ...base.background, ...custom.background },
    grid: { ...base.grid, ...custom.grid },
    axis: { ...base.axis, ...custom.axis },
    states: {
      hover: { ...base.states.hover, ...custom.states?.hover },
      active: { ...base.states.active, ...custom.states?.active },
      disabled: { ...base.states.disabled, ...custom.states?.disabled }
    },
    effects: { ...base.effects, ...custom.effects },
    animation: { ...base.animation, ...custom.animation },
    chart: { ...base.chart, ...custom.chart }
  };
}

export default ChartThemeProvider;