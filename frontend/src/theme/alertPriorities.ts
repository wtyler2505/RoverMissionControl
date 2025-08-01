/**
 * Alert Priority Theme Extensions
 * Defines priority-specific color palettes for all themes
 */

import { Theme } from './themes';

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AlertPriorityColors {
  background: string;
  border: string;
  text: string;
  icon: string;
  hover: string;
  contrast: string; // For text on colored backgrounds
}

export interface AlertPriorityTheme {
  critical: AlertPriorityColors;
  high: AlertPriorityColors;
  medium: AlertPriorityColors;
  low: AlertPriorityColors;
  info: AlertPriorityColors;
}

/**
 * Generate priority colors for the default (light) theme
 */
export const defaultAlertPriorities: AlertPriorityTheme = {
  critical: {
    background: '#fee2e2', // red-100
    border: '#dc2626',     // red-600
    text: '#991b1b',       // red-800
    icon: '#dc2626',       // red-600
    hover: '#fecaca',      // red-200
    contrast: '#ffffff',
  },
  high: {
    background: '#fef3c7', // amber-100
    border: '#f59e0b',     // amber-500
    text: '#92400e',       // amber-800
    icon: '#f59e0b',       // amber-500
    hover: '#fde68a',      // amber-200
    contrast: '#000000',
  },
  medium: {
    background: '#dbeafe', // blue-100
    border: '#3b82f6',     // blue-500
    text: '#1e40af',       // blue-800
    icon: '#3b82f6',       // blue-500
    hover: '#bfdbfe',      // blue-200
    contrast: '#ffffff',
  },
  low: {
    background: '#dcfce7', // green-100
    border: '#22c55e',     // green-500
    text: '#166534',       // green-800
    icon: '#22c55e',       // green-500
    hover: '#bbf7d0',      // green-200
    contrast: '#000000',
  },
  info: {
    background: '#f0f4f8', // neutral-100
    border: '#64748b',     // neutral-500
    text: '#334155',       // neutral-700
    icon: '#64748b',       // neutral-500
    hover: '#e2e8f0',      // neutral-200
    contrast: '#000000',
  },
};

/**
 * Generate priority colors for the dark theme
 */
export const darkAlertPriorities: AlertPriorityTheme = {
  critical: {
    background: 'rgba(239, 68, 68, 0.15)',  // red-500 with opacity
    border: '#ef4444',                       // red-500
    text: '#fca5a5',                         // red-300
    icon: '#ef4444',                         // red-500
    hover: 'rgba(239, 68, 68, 0.25)',
    contrast: '#ffffff',
  },
  high: {
    background: 'rgba(245, 158, 11, 0.15)', // amber-500 with opacity
    border: '#f59e0b',                       // amber-500
    text: '#fcd34d',                         // amber-300
    icon: '#f59e0b',                         // amber-500
    hover: 'rgba(245, 158, 11, 0.25)',
    contrast: '#000000',
  },
  medium: {
    background: 'rgba(59, 130, 246, 0.15)', // blue-500 with opacity
    border: '#3b82f6',                       // blue-500
    text: '#93bbfc',                         // blue-300
    icon: '#3b82f6',                         // blue-500
    hover: 'rgba(59, 130, 246, 0.25)',
    contrast: '#ffffff',
  },
  low: {
    background: 'rgba(34, 197, 94, 0.15)',  // green-500 with opacity
    border: '#22c55e',                       // green-500
    text: '#86efac',                         // green-300
    icon: '#22c55e',                         // green-500
    hover: 'rgba(34, 197, 94, 0.25)',
    contrast: '#000000',
  },
  info: {
    background: 'rgba(100, 116, 139, 0.15)', // neutral-500 with opacity
    border: '#64748b',                        // neutral-500
    text: '#cbd5e1',                          // neutral-300
    icon: '#64748b',                          // neutral-500
    hover: 'rgba(100, 116, 139, 0.25)',
    contrast: '#ffffff',
  },
};

/**
 * Generate priority colors for the high contrast theme
 */
export const highContrastAlertPriorities: AlertPriorityTheme = {
  critical: {
    background: '#ffffff',
    border: '#b91c1c',     // red-700
    text: '#991b1b',       // red-800
    icon: '#b91c1c',       // red-700
    hover: '#fef2f2',      // red-50
    contrast: '#ffffff',
  },
  high: {
    background: '#ffffff',
    border: '#d97706',     // amber-600
    text: '#92400e',       // amber-800
    icon: '#d97706',       // amber-600
    hover: '#fffbeb',      // amber-50
    contrast: '#ffffff',
  },
  medium: {
    background: '#ffffff',
    border: '#2563eb',     // blue-600
    text: '#1e40af',       // blue-800
    icon: '#2563eb',       // blue-600
    hover: '#eff6ff',      // blue-50
    contrast: '#ffffff',
  },
  low: {
    background: '#ffffff',
    border: '#16a34a',     // green-600
    text: '#166534',       // green-800
    icon: '#16a34a',       // green-600
    hover: '#f0fdf4',      // green-50
    contrast: '#ffffff',
  },
  info: {
    background: '#ffffff',
    border: '#475569',     // neutral-600
    text: '#1e293b',       // neutral-800
    icon: '#475569',       // neutral-600
    hover: '#f8fafc',      // neutral-50
    contrast: '#ffffff',
  },
};

/**
 * Generate priority colors for the mission critical theme
 */
export const missionCriticalAlertPriorities: AlertPriorityTheme = {
  critical: {
    background: 'rgba(255, 23, 68, 0.2)',   // Using theme primary (red)
    border: '#ff1744',
    text: '#ff5252',
    icon: '#ff1744',
    hover: 'rgba(255, 23, 68, 0.3)',
    contrast: '#ffffff',
  },
  high: {
    background: 'rgba(255, 193, 7, 0.2)',   // warning yellow
    border: '#ffc107',
    text: '#ffeb3b',
    icon: '#ffc107',
    hover: 'rgba(255, 193, 7, 0.3)',
    contrast: '#000000',
  },
  medium: {
    background: 'rgba(0, 184, 212, 0.2)',   // info cyan
    border: '#00b8d4',
    text: '#40c4ff',
    icon: '#00b8d4',
    hover: 'rgba(0, 184, 212, 0.3)',
    contrast: '#ffffff',
  },
  low: {
    background: 'rgba(0, 230, 118, 0.2)',   // success green
    border: '#00e676',
    text: '#69f0ae',
    icon: '#00e676',
    hover: 'rgba(0, 230, 118, 0.3)',
    contrast: '#000000',
  },
  info: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '#757575',
    text: '#e0e0e0',
    icon: '#757575',
    hover: 'rgba(255, 255, 255, 0.1)',
    contrast: '#ffffff',
  },
};

/**
 * Get priority colors for a specific theme
 */
export function getAlertPriorityColors(theme: Theme): AlertPriorityTheme {
  switch (theme.name) {
    case 'Dark':
      return darkAlertPriorities;
    case 'High Contrast':
      return highContrastAlertPriorities;
    case 'Mission Critical':
      return missionCriticalAlertPriorities;
    default:
      return defaultAlertPriorities;
  }
}

/**
 * Animation configurations for different priority levels
 */
export const priorityAnimations = {
  critical: {
    entrance: 'slideInWithPulse',
    duration: '300ms',
    easing: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)', // Elastic easing
  },
  high: {
    entrance: 'slideInFromTop',
    duration: '250ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Ease out
  },
  medium: {
    entrance: 'fadeIn',
    duration: '200ms',
    easing: 'ease-out',
  },
  low: {
    entrance: 'fadeIn',
    duration: '300ms',
    easing: 'ease-out',
  },
  info: {
    entrance: 'fadeIn',
    duration: '400ms',
    easing: 'ease-out',
  },
};

/**
 * Icon styles for different priority levels
 */
export const priorityIconStyles = {
  critical: {
    animation: 'pulse 1s infinite',
    size: '24px',
  },
  high: {
    animation: 'none',
    size: '22px',
  },
  medium: {
    animation: 'none',
    size: '20px',
  },
  low: {
    animation: 'none',
    size: '20px',
  },
  info: {
    animation: 'none',
    size: '18px',
  },
};