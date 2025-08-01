/**
 * Accessibility Components Export Index
 * Centralized exports for all accessibility-enhanced telemetry components
 */

// Base accessibility components
export { default as AccessibleChartBase } from './AccessibleChartBase';
export type { AccessibleChartProps } from './AccessibleChartBase';

export { default as AccessibilityEnhancer } from './AccessibilityEnhancer';
export type { AccessibilityOptions, FocusableElement } from './AccessibilityEnhancer';

// Color and contrast analysis
export { default as ColorContrastAnalyzer } from './ColorContrastAnalyzer';
export type { ColorPalette } from './ColorContrastAnalyzer';

// Testing infrastructure
export { default as AccessibilityTestRunner } from './AccessibilityTestRunner';
export type { 
  TestSuite, 
  AccessibilityTest, 
  TestResult, 
  TestRunResult 
} from './AccessibilityTestRunner';

export { default as AccessibilityAuditor } from './AccessibilityAuditor';
export type { AccessibilityAuditResult } from './AccessibilityAuditor';

// Rover-specific tests
export { ROVER_TELEMETRY_TEST_SUITES } from './RoverTelemetryAccessibilityTests';
export type { RoverTelemetryTestContext } from './RoverTelemetryAccessibilityTests';

// CI/CD Integration
export { 
  AccessibilityCIRunner,
  DEFAULT_ROVER_ACCESSIBILITY_CONFIG,
  runAccessibilityCI
} from './AccessibilityCIIntegration';
export type { 
  AccessibilityCIConfig,
  AccessibilityTestResult,
  AccessibilityReport
} from './AccessibilityCIIntegration';

// Reporting and Dashboard
export { default as AccessibilityReportDashboard } from './AccessibilityReportDashboard';
export type { AccessibilityReportDashboardProps } from './AccessibilityReportDashboard';

export { default as AccessibilityDashboard } from './AccessibilityDashboard';

// Accessible telemetry components
export { default as AccessibleRoverTelemetryChart } from '../../Telemetry/AccessibleRoverTelemetryChart';
export type { 
  AccessibleRoverTelemetryChartProps,
  RoverTelemetryData
} from '../../Telemetry/AccessibleRoverTelemetryChart';

export { default as AccessibleBatteryVisualization } from '../../Telemetry/AccessibleBatteryVisualization';
export type { 
  AccessibleBatteryVisualizationProps,
  BatteryData
} from '../../Telemetry/AccessibleBatteryVisualization';

export { default as AccessibleTemperatureChart } from '../../Telemetry/AccessibleTemperatureChart';
export type { 
  AccessibleTemperatureChartProps,
  TemperatureData
} from '../../Telemetry/AccessibleTemperatureChart';

export { default as AccessibleSpeedGauge } from '../../Telemetry/AccessibleSpeedGauge';
export type { 
  AccessibleSpeedGaugeProps,
  SpeedData
} from '../../Telemetry/AccessibleSpeedGauge';

// Utility functions and constants
export const ACCESSIBILITY_CONSTANTS = {
  WCAG_LEVELS: ['A', 'AA', 'AAA'] as const,
  CONTRAST_RATIOS: {
    AA_NORMAL: 4.5,
    AA_LARGE: 3.0,
    AAA_NORMAL: 7.0,
    AAA_LARGE: 4.5
  },
  FOCUS_INDICATORS: {
    MIN_WIDTH: 2, // pixels
    MIN_OFFSET: 2, // pixels
    MIN_CONTRAST: 3.0
  },
  LIVE_REGION_THROTTLE: 3000, // milliseconds
  KEYBOARD_SHORTCUTS: {
    SUMMARY: 'Alt+S',
    CURRENT_STATUS: 'Alt+C',
    TRENDS: 'Alt+T',
    ALERTS: 'Alt+A',
    TOGGLE_VIEW: 'Alt+V',
    HELP: 'Alt+H',
    DATA_TABLE: 'Alt+D'
  }
};

// Helper functions
export const accessibilityUtils = {
  /**
   * Generate ARIA label for telemetry data point
   */
  generateDataPointLabel: (
    value: number, 
    unit: string, 
    timestamp: Date, 
    status?: string,
    index?: number,
    total?: number
  ): string => {
    const parts = [];
    
    if (index !== undefined && total !== undefined) {
      parts.push(`Data point ${index + 1} of ${total}`);
    }
    
    parts.push(`Value: ${value}${unit}`);
    parts.push(`Time: ${timestamp.toLocaleString()}`);
    
    if (status) {
      parts.push(`Status: ${status}`);
    }
    
    return parts.join(', ');
  },

  /**
   * Generate comprehensive chart summary
   */
  generateChartSummary: (
    chartType: string,
    dataPoints: any[],
    currentValue?: number,
    unit?: string,
    thresholds?: { warning?: number; critical?: number }
  ): string => {
    if (dataPoints.length === 0) {
      return `${chartType} chart contains no data`;
    }

    const summary = [`${chartType} chart with ${dataPoints.length} data points`];
    
    if (currentValue !== undefined && unit) {
      summary.push(`Current value: ${currentValue}${unit}`);
    }
    
    // Add statistical summary for numeric data
    const numericValues = dataPoints
      .map(d => typeof d.value === 'number' ? d.value : d)
      .filter(v => typeof v === 'number');
    
    if (numericValues.length > 0) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      
      summary.push(`Range: ${min.toFixed(2)} to ${max.toFixed(2)}, average: ${avg.toFixed(2)}`);
    }
    
    if (thresholds) {
      const thresholdInfo = [];
      if (thresholds.warning) thresholdInfo.push(`Warning: ${thresholds.warning}`);
      if (thresholds.critical) thresholdInfo.push(`Critical: ${thresholds.critical}`);
      if (thresholdInfo.length > 0) {
        summary.push(`Thresholds - ${thresholdInfo.join(', ')}`);
      }
    }
    
    return summary.join('. ');
  },

  /**
   * Throttle screen reader announcements
   */
  createAnnouncementThrottler: (delay: number = ACCESSIBILITY_CONSTANTS.LIVE_REGION_THROTTLE) => {
    let lastAnnouncement = 0;
    
    return (message: string, liveRegion: HTMLElement, priority: 'polite' | 'assertive' = 'polite') => {
      const now = Date.now();
      
      if (now - lastAnnouncement < delay) {
        return false; // Throttled
      }
      
      liveRegion.setAttribute('aria-live', priority);
      liveRegion.textContent = '';
      
      setTimeout(() => {
        liveRegion.textContent = message;
        lastAnnouncement = now;
      }, 100);
      
      return true; // Announced
    };
  },

  /**
   * Validate color contrast ratio
   */
  validateContrast: (
    foreground: string, 
    background: string, 
    wcagLevel: 'AA' | 'AAA' = 'AA',
    isLargeText: boolean = false
  ): { ratio: number; passes: boolean; recommendation?: string } => {
    // This is a simplified implementation
    // In production, use a proper color contrast library
    const ratio = 4.5; // Mock ratio
    
    const threshold = wcagLevel === 'AAA' ? 
      (isLargeText ? ACCESSIBILITY_CONSTANTS.CONTRAST_RATIOS.AAA_LARGE : ACCESSIBILITY_CONSTANTS.CONTRAST_RATIOS.AAA_NORMAL) :
      (isLargeText ? ACCESSIBILITY_CONSTANTS.CONTRAST_RATIOS.AA_LARGE : ACCESSIBILITY_CONSTANTS.CONTRAST_RATIOS.AA_NORMAL);
    
    const passes = ratio >= threshold;
    
    return {
      ratio,
      passes,
      recommendation: passes ? undefined : `Increase contrast to meet ${wcagLevel} ${isLargeText ? 'large text' : 'normal text'} requirements (${threshold}:1)`
    };
  },

  /**
   * Generate keyboard navigation instructions
   */
  generateKeyboardInstructions: (componentType: 'chart' | 'gauge' | 'table' | 'dashboard'): string[] => {
    const common = [
      `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.SUMMARY} - Announce data summary`,
      `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.HELP} - Show keyboard help`,
      'Tab - Navigate between interactive elements',
      'Enter/Space - Activate current element',
      'Escape - Exit focus mode'
    ];

    const specific: Record<string, string[]> = {
      chart: [
        'Arrow keys - Navigate data points',
        'Home/End - Jump to first/last data point',
        'Ctrl + +/- - Zoom in/out',
        'Ctrl + 0 - Reset zoom'
      ],
      gauge: [
        `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.CURRENT_STATUS} - Announce current status`,
        `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.TOGGLE_VIEW} - Toggle between views`
      ],
      table: [
        'Arrow keys - Navigate table cells',
        'Ctrl + Home - Jump to first cell',
        'Ctrl + End - Jump to last cell'
      ],
      dashboard: [
        `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.ALERTS} - Announce active alerts`,
        `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.TRENDS} - Announce trend information`,
        `${ACCESSIBILITY_CONSTANTS.KEYBOARD_SHORTCUTS.DATA_TABLE} - Switch to data table view`
      ]
    };

    return [...common, ...(specific[componentType] || [])];
  }
};

/**
 * HOC for adding accessibility features to any component
 */
export const withAccessibility = <P extends object>(
  Component: React.ComponentType<P>,
  options: Partial<AccessibilityOptions> = {}
) => {
  return React.forwardRef<any, P>((props, ref) => {
    return React.createElement(
      AccessibilityEnhancer,
      {
        chartType: options.chartType || 'Interactive Component',
        chartData: [],
        options: {
          enabled: true,
          screenReaderOptimized: false,
          keyboardNavigation: true,
          liveRegions: true,
          alternativeFormats: true,
          colorBlindFriendly: true,
          ...options
        }
      },
      React.createElement(Component, { ...props, ref })
    );
  });
};

// Re-export React for convenience
export { React } from 'react';