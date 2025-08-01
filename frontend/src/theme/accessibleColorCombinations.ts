/**
 * Accessible Color Combinations Reference for Rover Mission Control
 * All combinations meet WCAG 2.1 AA standards (4.5:1 for normal text, 3:1 for large text/focus indicators)
 * 
 * Last Updated: 2025-07-31
 * Audit Result: 100% WCAG 2.1 AA Compliant (23/23 combinations passing)
 */

export interface AccessibleColorPair {
  foreground: string;
  background: string;
  contrastRatio: number;
  wcagLevel: 'AA' | 'AAA';
  usage: string;
  theme: 'default' | 'dark' | 'high-contrast' | 'mission-critical' | 'all';
  isLargeText?: boolean;
  isFocusIndicator?: boolean;
}

/**
 * WCAG 2.1 AA Compliant Color Combinations
 * All ratios verified and documented for future reference
 */
export const accessibleColorCombinations: AccessibleColorPair[] = [
  // Default Theme - Light Mode
  {
    foreground: '#212121',
    background: '#fafafa',
    contrastRatio: 15.43,
    wcagLevel: 'AAA',
    usage: 'Primary text on default background',
    theme: 'default'
  },
  {
    foreground: '#616161',
    background: '#fafafa',
    contrastRatio: 5.93,
    wcagLevel: 'AA',
    usage: 'Secondary text on default background',
    theme: 'default'
  },
  {
    foreground: '#737373',
    background: '#fafafa',
    contrastRatio: 4.54,
    wcagLevel: 'AA',
    usage: 'Disabled text on default background (improved from #9e9e9e)',
    theme: 'default'
  },
  {
    foreground: '#ffffff',
    background: '#1e3a8a',
    contrastRatio: 10.36,
    wcagLevel: 'AAA',
    usage: 'Button text on primary blue background',
    theme: 'default'
  },

  // Dark Theme - Space Operations
  {
    foreground: '#fafafa',
    background: '#0a0e1a',
    contrastRatio: 18.45,
    wcagLevel: 'AAA',
    usage: 'Primary text on dark background',
    theme: 'dark'
  },
  {
    foreground: '#e0e0e0',
    background: '#0a0e1a',
    contrastRatio: 14.59,
    wcagLevel: 'AAA',
    usage: 'Secondary text on dark background',
    theme: 'dark'
  },
  {
    foreground: '#a3a3a3',
    background: '#0a0e1a',
    contrastRatio: 7.63,
    wcagLevel: 'AAA',
    usage: 'Disabled text on dark background (improved from #757575)',
    theme: 'dark'
  },

  // High Contrast Theme
  {
    foreground: '#000000',
    background: '#ffffff',
    contrastRatio: 21.00,
    wcagLevel: 'AAA',
    usage: 'Maximum contrast text for accessibility',
    theme: 'high-contrast'
  },

  // Mission Critical Theme
  {
    foreground: '#ffffff',
    background: '#000000',
    contrastRatio: 21.00,
    wcagLevel: 'AAA',
    usage: 'Emergency operations maximum contrast',
    theme: 'mission-critical'
  },

  // Status Colors (improved for WCAG compliance)
  {
    foreground: '#2e7d32',
    background: '#fafafa',
    contrastRatio: 4.91,
    wcagLevel: 'AA',
    usage: 'Success status messages',
    theme: 'default'
  },
  {
    foreground: '#bf5000',
    background: '#fafafa',
    contrastRatio: 4.61,
    wcagLevel: 'AA',
    usage: 'Warning status messages (improved from #ed6c02)',
    theme: 'default'
  },
  {
    foreground: '#d32f2f',
    background: '#fafafa',
    contrastRatio: 4.77,
    wcagLevel: 'AA',
    usage: 'Error status messages',
    theme: 'default'
  },
  {
    foreground: '#0277bd',
    background: '#fafafa',
    contrastRatio: 4.60,
    wcagLevel: 'AA',
    usage: 'Info status messages (improved from #0288d1)',
    theme: 'default'
  },

  // Alert Priority Colors (All AA compliant)
  {
    foreground: '#991b1b',
    background: '#fee2e2',
    contrastRatio: 6.80,
    wcagLevel: 'AAA',
    usage: 'Critical priority alerts',
    theme: 'all'
  },
  {
    foreground: '#92400e',
    background: '#fef3c7',
    contrastRatio: 6.37,
    wcagLevel: 'AAA',
    usage: 'High priority alerts',
    theme: 'all'
  },
  {
    foreground: '#1e40af',
    background: '#dbeafe',
    contrastRatio: 7.15,
    wcagLevel: 'AAA',
    usage: 'Medium priority alerts',
    theme: 'all'
  },
  {
    foreground: '#166534',
    background: '#dcfce7',
    contrastRatio: 6.49,
    wcagLevel: 'AAA',
    usage: 'Low priority alerts',
    theme: 'all'
  },

  // Focus Indicators (3:1 minimum requirement)
  {
    foreground: '#3b82f6',
    background: '#0a0e1a',
    contrastRatio: 5.24,
    wcagLevel: 'AA',
    usage: 'Focus outline on dark backgrounds',
    theme: 'dark',
    isFocusIndicator: true
  },
  {
    foreground: '#3b82f6',
    background: '#fafafa',
    contrastRatio: 3.52,
    wcagLevel: 'AA',
    usage: 'Focus outline on light backgrounds',
    theme: 'default',
    isFocusIndicator: true
  },

  // Special Mission Colors (improved for dark backgrounds)
  {
    foreground: '#00bcd4',
    background: '#0a0e1a',
    contrastRatio: 8.38,
    wcagLevel: 'AAA',
    usage: 'Telemetry data indicators',
    theme: 'dark'
  },
  {
    foreground: '#7986cb',
    background: '#0a0e1a',
    contrastRatio: 5.58,
    wcagLevel: 'AA',
    usage: 'Command execution indicators (improved from #3f51b5)',
    theme: 'dark'
  },
  {
    foreground: '#4caf50',
    background: '#0a0e1a',
    contrastRatio: 6.93,
    wcagLevel: 'AAA',
    usage: 'Hardware status indicators',
    theme: 'dark'
  },
  {
    foreground: '#ff1744',
    background: '#0a0e1a',
    contrastRatio: 5.00,
    wcagLevel: 'AA',
    usage: 'Emergency status indicators',
    theme: 'dark'
  }
];

/**
 * Color Improvement History
 * Documents all changes made for WCAG 2.1 AA compliance
 */
export const colorImprovementHistory = {
  auditDate: '2025-07-31',
  originalFailures: 5,
  finalPassRate: '100%',
  improvements: [
    {
      element: 'Disabled text (default theme)',
      original: '#9e9e9e',
      improved: '#737373',
      originalRatio: 2.57,
      improvedRatio: 4.54,
      improvement: '+76.7%'
    },
    {
      element: 'Disabled text (dark theme)',
      original: '#757575',
      improved: '#a3a3a3',
      originalRatio: 4.18,
      improvedRatio: 7.63,
      improvement: '+82.5%'
    },
    {
      element: 'Warning status',
      original: '#ed6c02',
      improved: '#bf5000',
      originalRatio: 2.98,
      improvedRatio: 4.61,
      improvement: '+54.7%'
    },
    {
      element: 'Info status',
      original: '#0288d1',
      improved: '#0277bd',
      originalRatio: 3.70,
      improvedRatio: 4.60,
      improvement: '+24.3%'
    },
    {
      element: 'Command color (dark theme)',
      original: '#3f51b5',
      improved: '#7986cb',
      originalRatio: 2.80,
      improvedRatio: 5.58,
      improvement: '+99.3%'
    }
  ]
};

/**
 * Usage Guidelines for Designers and Developers
 */
export const colorUsageGuidelines = {
  general: [
    'Always test color combinations with the provided accessibility analyzer',
    'Ensure minimum 4.5:1 contrast for normal text (AA standard)',
    'Ensure minimum 3.0:1 contrast for large text (18pt+ or 14pt+ bold)',
    'Focus indicators require minimum 3.0:1 contrast with adjacent colors',
    'Test with color blindness simulators (protanopia, deuteranopia, tritanopia)',
    'Provide alternative indicators beyond color (icons, shapes, text)'
  ],
  
  implementation: [
    'Use semantic color tokens (success, warning, error, info) rather than raw hex values',
    'Reference this file when creating new color combinations',
    'Document any new color combinations with their contrast ratios',
    'Test in all supported themes (default, dark, high-contrast, mission-critical)',
    'Consider users with visual impairments in all design decisions'
  ],
  
  testing: [
    'Use automated contrast checking tools during development',
    'Test with actual screen readers and assistive technologies',
    'Verify readability in various lighting conditions',
    'Check color combinations on different display types (LCD, OLED, e-ink)',
    'Validate with users who have visual impairments when possible'
  ]
};

/**
 * Helper function to validate new color combinations
 */
export function validateColorCombination(
  foreground: string,
  background: string,
  isLargeText: boolean = false,
  isFocusIndicator: boolean = false
): {
  passes: boolean;
  ratio: number;
  level: 'fail' | 'AA' | 'AAA';
  recommendation?: string;
} {
  // This would use the same contrast calculation logic as the analyzer
  // For now, returning a placeholder structure
  return {
    passes: false,
    ratio: 0,
    level: 'fail',
    recommendation: 'Use the colorContrastAnalyzer utility for actual validation'
  };
}

export default {
  accessibleColorCombinations,
  colorImprovementHistory,
  colorUsageGuidelines,
  validateColorCombination
};