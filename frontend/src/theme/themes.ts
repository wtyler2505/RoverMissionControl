/**
 * Theme Definitions for Rover Mission Control
 * Supports 4 themes: Default, Dark, High Contrast, and Mission Critical
 */

import { colors, typography, spacing, borderRadius, shadows, transitions } from './tokens';
import { 
  AlertPriorityTheme, 
  defaultAlertPriorities,
  darkAlertPriorities,
  highContrastAlertPriorities,
  missionCriticalAlertPriorities
} from './alertPriorities';

export interface Theme {
  name: string;
  mode: 'light' | 'dark';
  colors: {
    background: {
      default: string;
      paper: string;
      elevated: string;
    };
    text: {
      primary: string;
      secondary: string;
      disabled: string;
      contrast: string;
    };
    divider: string;
    primary: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    secondary: {
      main: string;
      light: string;
      dark: string;
      contrast: string;
    };
    error: typeof colors.error;
    warning: typeof colors.warning;
    success: typeof colors.success;
    info: typeof colors.info;
    // Special mission colors
    telemetry: string;
    command: string;
    hardware: string;
    emergency: string;
  };
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  transitions: typeof transitions;
  // Alert priority colors
  alertPriorities?: AlertPriorityTheme;
}

// Default Theme - Light Professional
export const defaultTheme: Theme = {
  name: 'Default',
  mode: 'light',
  colors: {
    background: {
      default: colors.neutral[50],
      paper: colors.neutral[0],
      elevated: colors.neutral[0],
    },
    text: {
      primary: colors.neutral[900],
      secondary: colors.neutral[700],
      disabled: colors.neutral[500],
      contrast: colors.neutral[0],
    },
    divider: colors.neutral[200],
    primary: {
      main: colors.primary[500],
      light: colors.primary[300],
      dark: colors.primary[700],
      contrast: colors.neutral[0],
    },
    secondary: {
      main: colors.secondary[500],
      light: colors.secondary[300],
      dark: colors.secondary[700],
      contrast: colors.neutral[0],
    },
    error: colors.error,
    warning: colors.warning,
    success: colors.success,
    info: colors.info,
    telemetry: colors.telemetry,
    command: colors.command,
    hardware: colors.hardware,
    emergency: colors.emergency,
  },
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  alertPriorities: defaultAlertPriorities,
};

// Dark Theme - Space Operations
export const darkTheme: Theme = {
  name: 'Dark',
  mode: 'dark',
  colors: {
    background: {
      default: '#0a0a0f',
      paper: '#1a1a2e',
      elevated: '#16213e',
    },
    text: {
      primary: colors.neutral[50],
      secondary: colors.neutral[300],
      disabled: colors.neutral[600],
      contrast: colors.neutral[900],
    },
    divider: 'rgba(255, 255, 255, 0.12)',
    primary: {
      main: colors.primary[400],
      light: colors.primary[200],
      dark: colors.primary[600],
      contrast: colors.neutral[900],
    },
    secondary: {
      main: colors.secondary[400],
      light: colors.secondary[200],
      dark: colors.secondary[600],
      contrast: colors.neutral[900],
    },
    error: {
      light: '#ff6659',
      main: '#f44336',
      dark: '#d32f2f',
      contrast: colors.neutral[0],
    },
    warning: {
      light: '#ffb74d',
      main: '#ffa726',
      dark: '#f57c00',
      contrast: colors.neutral[900],
    },
    success: {
      light: '#81c784',
      main: '#66bb6a',
      dark: '#388e3c',
      contrast: colors.neutral[900],
    },
    info: {
      light: '#64b5f6',
      main: '#42a5f5',
      dark: '#1976d2',
      contrast: colors.neutral[900],
    },
    telemetry: '#4dd0e1',
    command: '#7986cb',
    hardware: '#81c784',
    emergency: '#ff5252',
  },
  typography,
  spacing,
  borderRadius,
  shadows: {
    ...shadows,
    xs: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    sm: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    base: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    md: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
    lg: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
    xl: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
  },
  transitions,
  alertPriorities: darkAlertPriorities,
};

// High Contrast Theme - Accessibility Focus
export const highContrastTheme: Theme = {
  name: 'High Contrast',
  mode: 'light',
  colors: {
    background: {
      default: colors.neutral[0],
      paper: colors.neutral[0],
      elevated: colors.neutral[0],
    },
    text: {
      primary: colors.neutral[1000],
      secondary: colors.neutral[900],
      disabled: colors.neutral[600],
      contrast: colors.neutral[0],
    },
    divider: colors.neutral[900],
    primary: {
      main: colors.primary[900],
      light: colors.primary[700],
      dark: colors.primary[900],
      contrast: colors.neutral[0],
    },
    secondary: {
      main: colors.secondary[900],
      light: colors.secondary[700],
      dark: colors.secondary[900],
      contrast: colors.neutral[0],
    },
    error: {
      light: '#d32f2f',
      main: '#c62828',
      dark: '#b71c1c',
      contrast: colors.neutral[0],
    },
    warning: {
      light: '#f57c00',
      main: '#ef6c00',
      dark: '#e65100',
      contrast: colors.neutral[0],
    },
    success: {
      light: '#388e3c',
      main: '#2e7d32',
      dark: '#1b5e20',
      contrast: colors.neutral[0],
    },
    info: {
      light: '#1976d2',
      main: '#1565c0',
      dark: '#0d47a1',
      contrast: colors.neutral[0],
    },
    telemetry: '#00838f',
    command: '#283593',
    hardware: '#2e7d32',
    emergency: '#b71c1c',
  },
  typography: {
    ...typography,
    fontWeight: {
      ...typography.fontWeight,
      regular: 500,
      medium: 600,
      semibold: 700,
      bold: 800,
    },
  },
  spacing,
  borderRadius,
  shadows: {
    ...shadows,
    // Add borders instead of shadows for high contrast
    xs: 'inset 0 0 0 1px currentColor',
    sm: 'inset 0 0 0 2px currentColor',
    base: 'inset 0 0 0 2px currentColor',
    md: 'inset 0 0 0 3px currentColor',
    lg: 'inset 0 0 0 3px currentColor',
    xl: 'inset 0 0 0 4px currentColor',
  },
  transitions,
  alertPriorities: highContrastAlertPriorities,
};

// Mission Critical Theme - Emergency Operations
export const missionCriticalTheme: Theme = {
  name: 'Mission Critical',
  mode: 'dark',
  colors: {
    background: {
      default: '#000000',
      paper: '#0a0a0a',
      elevated: '#141414',
    },
    text: {
      primary: '#ffffff',
      secondary: '#e0e0e0',
      disabled: '#757575',
      contrast: '#000000',
    },
    divider: 'rgba(255, 255, 255, 0.2)',
    primary: {
      main: '#ff1744', // Red for critical
      light: '#ff5252',
      dark: '#d50000',
      contrast: colors.neutral[0],
    },
    secondary: {
      main: '#00e676', // Green for safe
      light: '#69f0ae',
      dark: '#00c853',
      contrast: colors.neutral[900],
    },
    error: {
      light: '#ff5252',
      main: '#ff1744',
      dark: '#d50000',
      contrast: colors.neutral[0],
    },
    warning: {
      light: '#ffeb3b',
      main: '#ffc107',
      dark: '#ff8f00',
      contrast: colors.neutral[900],
    },
    success: {
      light: '#69f0ae',
      main: '#00e676',
      dark: '#00c853',
      contrast: colors.neutral[900],
    },
    info: {
      light: '#40c4ff',
      main: '#00b8d4',
      dark: '#0091ea',
      contrast: colors.neutral[0],
    },
    telemetry: '#00e5ff',
    command: '#ff6e40',
    hardware: '#00e676',
    emergency: '#ff1744',
  },
  typography: {
    ...typography,
    fontFamily: {
      ...typography.fontFamily,
      primary: '"Roboto Mono", "JetBrains Mono", Consolas, monospace',
    },
  },
  spacing,
  borderRadius: {
    ...borderRadius,
    sm: '0',
    base: '0',
    md: '0',
    lg: '0',
  },
  shadows: {
    ...shadows,
    // Glow effects for mission critical
    xs: '0 0 4px rgba(255, 23, 68, 0.3)',
    sm: '0 0 8px rgba(255, 23, 68, 0.4)',
    base: '0 0 12px rgba(255, 23, 68, 0.5)',
    md: '0 0 16px rgba(255, 23, 68, 0.6)',
    lg: '0 0 24px rgba(255, 23, 68, 0.7)',
    xl: '0 0 32px rgba(255, 23, 68, 0.8)',
  },
  transitions,
  alertPriorities: missionCriticalAlertPriorities,
};

export const themes = {
  default: defaultTheme,
  dark: darkTheme,
  highContrast: highContrastTheme,
  missionCritical: missionCriticalTheme,
};

export type ThemeName = keyof typeof themes;