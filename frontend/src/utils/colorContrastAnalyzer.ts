/**
 * Color Contrast Analyzer for WCAG 2.1 AA/AAA Compliance
 * Analyzes all color combinations used in the Rover Mission Control system
 */

interface ContrastResult {
  ratio: number;
  wcag21AA: boolean;
  wcag21AAA: boolean;
  level: 'fail' | 'aa' | 'aaa';
}

interface ColorCombination {
  foreground: string;
  background: string;
  context: string;
  isLargeText?: boolean;
  isFocusIndicator?: boolean;
}

interface ContrastAnalysisResult {
  combination: ColorCombination;
  result: ContrastResult;
  recommendations?: string[];
}

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): [number, number, number] {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  return [r, g, b];
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 guidelines
 */
function getRelativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(value => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
function calculateContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Evaluate contrast ratio against WCAG 2.1 standards
 */
function evaluateContrast(
  ratio: number, 
  isLargeText: boolean = false,
  isFocusIndicator: boolean = false
): ContrastResult {
  // WCAG 2.1 AA standards
  const aaThreshold = isLargeText ? 3.0 : 4.5;
  const aaaThreshold = isLargeText ? 4.5 : 7.0;
  
  // Focus indicators have a minimum 3:1 requirement
  const focusThreshold = 3.0;
  
  let wcag21AA: boolean;
  let wcag21AAA: boolean;
  
  if (isFocusIndicator) {
    wcag21AA = ratio >= focusThreshold;
    wcag21AAA = ratio >= focusThreshold;
  } else {
    wcag21AA = ratio >= aaThreshold;
    wcag21AAA = ratio >= aaaThreshold;
  }
  
  let level: 'fail' | 'aa' | 'aaa';
  if (wcag21AAA) {
    level = 'aaa';
  } else if (wcag21AA) {
    level = 'aa';
  } else {
    level = 'fail';
  }
  
  return {
    ratio,
    wcag21AA,
    wcag21AAA,
    level
  };
}

/**
 * Generate color improvement recommendations
 */
function generateRecommendations(
  combination: ColorCombination,
  result: ContrastResult
): string[] {
  const recommendations: string[] = [];
  
  if (result.level === 'fail') {
    recommendations.push(
      `Current ratio ${result.ratio.toFixed(2)}:1 fails WCAG 2.1 AA standards`
    );
    
    const requiredRatio = combination.isLargeText ? 3.0 : 4.5;
    recommendations.push(
      `Need minimum ${requiredRatio}:1 ratio for AA compliance`
    );
    
    if (combination.isFocusIndicator) {
      recommendations.push('Focus indicators require minimum 3:1 contrast ratio');
    }
    
    // Suggest specific improvements
    if (result.ratio < 2.0) {
      recommendations.push('Consider using high contrast color pairs (black/white)');
    } else if (result.ratio < 3.0) {
      recommendations.push('Darken foreground or lighten background significantly');
    } else {
      recommendations.push('Minor adjustments needed - darken foreground or lighten background');
    }
  } else if (result.level === 'aa') {
    recommendations.push('Meets AA standards - consider AAA for better accessibility');
  }
  
  return recommendations;
}

/**
 * Define all color combinations used in the application
 */
export function getColorCombinations(): ColorCombination[] {
  return [
    // Default Theme Combinations
    {
      foreground: '#212121', // neutral[900] - primary text
      background: '#fafafa', // neutral[50] - default background
      context: 'Default theme - primary text on background'
    },
    {
      foreground: '#616161', // neutral[700] - secondary text
      background: '#fafafa', // neutral[50] - default background
      context: 'Default theme - secondary text on background'
    },
    {
      foreground: '#9e9e9e', // neutral[500] - disabled text
      background: '#fafafa', // neutral[50] - default background
      context: 'Default theme - disabled text on background'
    },
    {
      foreground: '#ffffff', // contrast text
      background: '#1e3a8a', // primary[500] - button background
      context: 'Default theme - button text on primary background'
    },
    
    // Dark Theme Combinations
    {
      foreground: '#fafafa', // neutral[50] - primary text
      background: '#0a0e1a', // dark background
      context: 'Dark theme - primary text on background'
    },
    {
      foreground: '#e0e0e0', // neutral[300] - secondary text
      background: '#0a0e1a', // dark background
      context: 'Dark theme - secondary text on background'
    },
    {
      foreground: '#757575', // neutral[600] - disabled text
      background: '#0a0e1a', // dark background
      context: 'Dark theme - disabled text on background'
    },
    
    // High Contrast Theme Combinations
    {
      foreground: '#000000', // neutral[1000] - primary text
      background: '#ffffff', // neutral[0] - background
      context: 'High contrast theme - primary text on background'
    },
    {
      foreground: '#212121', // neutral[900] - secondary text
      background: '#ffffff', // neutral[0] - background
      context: 'High contrast theme - secondary text on background'
    },
    
    // Mission Critical Theme Combinations
    {
      foreground: '#ffffff', // primary text
      background: '#000000', // background
      context: 'Mission critical theme - primary text on background'
    },
    {
      foreground: '#e0e0e0', // secondary text
      background: '#000000', // background
      context: 'Mission critical theme - secondary text on background'
    },
    
    // Status Colors on Default Background
    {
      foreground: '#2e7d32', // success.main
      background: '#fafafa', // neutral[50]
      context: 'Success status text on default background'
    },
    {
      foreground: '#ed6c02', // warning.main
      background: '#fafafa', // neutral[50]
      context: 'Warning status text on default background'
    },
    {
      foreground: '#d32f2f', // error.main
      background: '#fafafa', // neutral[50]
      context: 'Error status text on default background'
    },
    {
      foreground: '#0288d1', // info.main
      background: '#fafafa', // neutral[50]
      context: 'Info status text on default background'
    },
    
    // Alert Priority Colors (Default Theme)
    {
      foreground: '#991b1b', // critical text
      background: '#fee2e2', // critical background
      context: 'Critical alert - text on background'
    },
    {
      foreground: '#92400e', // high text
      background: '#fef3c7', // high background
      context: 'High priority alert - text on background'
    },
    {
      foreground: '#1e40af', // medium text
      background: '#dbeafe', // medium background
      context: 'Medium priority alert - text on background'
    },
    {
      foreground: '#166534', // low text
      background: '#dcfce7', // low background
      context: 'Low priority alert - text on background'
    },
    
    // Focus Indicators (Critical for WCAG 2.1)
    {
      foreground: '#3b82f6', // accent-blue (focus outline)
      background: '#0a0e1a', // dark background
      context: 'Focus indicator on dark background',
      isFocusIndicator: true
    },
    {
      foreground: '#3b82f6', // accent-blue (focus outline)
      background: '#fafafa', // light background
      context: 'Focus indicator on light background',
      isFocusIndicator: true
    },
    
    // Special Mission Colors
    {
      foreground: '#00bcd4', // telemetry
      background: '#0a0e1a', // dark background
      context: 'Telemetry color on dark background'
    },
    {
      foreground: '#3f51b5', // command
      background: '#0a0e1a', // dark background
      context: 'Command color on dark background'
    },
    {
      foreground: '#4caf50', // hardware
      background: '#0a0e1a', // dark background
      context: 'Hardware color on dark background'
    },
    {
      foreground: '#ff1744', // emergency
      background: '#0a0e1a', // dark background
      context: 'Emergency color on dark background'
    },
    
    // Large Text Combinations (18pt+ or 14pt+ bold)
    {
      foreground: '#616161', // neutral[700]
      background: '#fafafa', // neutral[50]
      context: 'Large text - secondary on background',
      isLargeText: true
    },
    {
      foreground: '#9e9e9e', // neutral[500]  
      background: '#fafafa', // neutral[50]
      context: 'Large text - disabled on background',
      isLargeText: true
    }
  ];
}

/**
 * Analyze all color combinations for WCAG 2.1 compliance
 */
export function analyzeColorContrast(): ContrastAnalysisResult[] {
  const combinations = getColorCombinations();
  
  return combinations.map(combination => {
    const ratio = calculateContrastRatio(combination.foreground, combination.background);
    const result = evaluateContrast(
      ratio, 
      combination.isLargeText, 
      combination.isFocusIndicator
    );
    const recommendations = generateRecommendations(combination, result);
    
    return {
      combination,
      result,
      recommendations
    };
  });
}

/**
 * Generate summary report of contrast analysis
 */
export function generateContrastReport(): {
  summary: {
    total: number;
    passing: number;
    failing: number;
    aaCompliant: number;
    aaaCompliant: number;
  };
  failingCombinations: ContrastAnalysisResult[];
  recommendations: string[];
} {
  const results = analyzeColorContrast();
  
  const summary = {
    total: results.length,
    passing: results.filter(r => r.result.wcag21AA).length,
    failing: results.filter(r => !r.result.wcag21AA).length,
    aaCompliant: results.filter(r => r.result.wcag21AA).length,
    aaaCompliant: results.filter(r => r.result.wcag21AAA).length
  };
  
  const failingCombinations = results.filter(r => !r.result.wcag21AA);
  
  const recommendations = [
    `${summary.failing} out of ${summary.total} color combinations fail WCAG 2.1 AA standards`,
    `Focus on fixing critical UI elements first (focus indicators, emergency buttons, status messages)`,
    `Consider implementing a high contrast mode toggle for users with visual impairments`,
    `Test all color combinations with color blindness simulators`,
    `Document approved color combinations for consistent future use`
  ];
  
  return {
    summary,
    failingCombinations,
    recommendations
  };
}

/**
 * Suggest improved colors for failing combinations
 */
export function suggestColorImprovements(
  foreground: string,
  background: string,
  targetRatio: number = 4.5
): { improvedForeground: string; improvedBackground: string; newRatio: number } {
  // Simple algorithm to suggest improvements
  // In a real implementation, this would be more sophisticated
  
  const currentRatio = calculateContrastRatio(foreground, background);
  
  if (currentRatio >= targetRatio) {
    return {
      improvedForeground: foreground,
      improvedBackground: background,
      newRatio: currentRatio
    };
  }
  
  // For now, suggest high contrast pairs for failing combinations
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);
  
  const fgLuminance = getRelativeLuminance(fgRgb);
  const bgLuminance = getRelativeLuminance(bgRgb);
  
  let improvedForeground = foreground;
  let improvedBackground = background;
  
  if (fgLuminance > bgLuminance) {
    // Foreground is lighter, so darken it or lighten background
    if (bgLuminance < 0.5) {
      improvedBackground = '#ffffff'; // Lighten background
    } else {
      improvedForeground = '#000000'; // Darken foreground
    }
  } else {
    // Background is lighter, so lighten foreground or darken background
    if (fgLuminance < 0.5) {
      improvedForeground = '#ffffff'; // Lighten foreground
    } else {
      improvedBackground = '#000000'; // Darken background
    }
  }
  
  const newRatio = calculateContrastRatio(improvedForeground, improvedBackground);
  
  return {
    improvedForeground,
    improvedBackground,
    newRatio
  };
}

export default {
  analyzeColorContrast,
  generateContrastReport,
  calculateContrastRatio,
  suggestColorImprovements
};