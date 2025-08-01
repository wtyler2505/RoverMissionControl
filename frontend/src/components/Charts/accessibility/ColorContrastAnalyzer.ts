/**
 * Color Contrast Analyzer for Telemetry Charts
 * WCAG 2.1 AA compliant color analysis and enhancement
 */

export interface ColorPalette {
  id: string;
  name: string;
  description: string;
  colors: string[];
  highContrast: boolean;
  colorBlindFriendly: boolean;
  wcagCompliant: boolean;
}

export interface ContrastResult {
  foreground: string;
  background: string;
  ratio: number;
  level: 'AA' | 'AAA' | 'fail';
  passes: {
    normalAA: boolean;
    normalAAA: boolean;
    largeAA: boolean;
    largeAAA: boolean;
  };
  hex: {
    foreground: string;
    background: string;
  };
}

export interface ColorRecommendation {
  originalColor: string;
  recommendedColor: string;
  reason: string;
  contrastImprovement: number;
}

export class ColorContrastAnalyzer {
  private static readonly WCAG_AA_NORMAL = 4.5;
  private static readonly WCAG_AA_LARGE = 3.0;
  private static readonly WCAG_AAA_NORMAL = 7.0;
  private static readonly WCAG_AAA_LARGE = 4.5;

  /**
   * Predefined accessible color palettes for telemetry charts
   */
  static readonly ACCESSIBLE_PALETTES: ColorPalette[] = [
    {
      id: 'default-accessible',
      name: 'Default Accessible',
      description: 'High contrast colors suitable for most users',
      colors: [
        '#1f77b4', // Blue
        '#ff7f0e', // Orange  
        '#2ca02c', // Green
        '#d62728', // Red
        '#9467bd', // Purple
        '#8c564b', // Brown
        '#e377c2', // Pink
        '#7f7f7f', // Gray
        '#bcbd22', // Olive
        '#17becf'  // Cyan
      ],
      highContrast: false,
      colorBlindFriendly: true,
      wcagCompliant: true
    },
    {
      id: 'high-contrast',
      name: 'High Contrast',
      description: 'Maximum contrast for users with visual impairments',
      colors: [
        '#000000', // Black
        '#ffffff', // White
        '#ffff00', // Yellow
        '#ff0000', // Red
        '#00ff00', // Green
        '#0000ff', // Blue
        '#ff00ff', // Magenta
        '#00ffff'  // Cyan
      ],
      highContrast: true,
      colorBlindFriendly: false,
      wcagCompliant: true
    },
    {
      id: 'colorblind-friendly',
      name: 'Color Blind Friendly',
      description: 'Colors distinguishable by users with color vision deficiencies',
      colors: [
        '#1b9e77', // Teal
        '#d95f02', // Orange
        '#7570b3', // Purple
        '#e7298a', // Pink
        '#66a61e', // Green
        '#e6ab02', // Yellow
        '#a6761d', // Brown
        '#666666'  // Gray
      ],
      highContrast: false,
      colorBlindFriendly: true,
      wcagCompliant: true
    },
    {
      id: 'telemetry-status',
      name: 'Telemetry Status',
      description: 'Colors for telemetry status indicators with high contrast',
      colors: [
        '#2e7d32', // Success (Dark Green)
        '#ed6c02', // Warning (Orange)  
        '#d32f2f', // Critical (Red)
        '#1976d2', // Info (Blue)
        '#7b1fa2', // Unknown (Purple)
        '#616161'  // Disabled (Gray)
      ],
      highContrast: false,
      colorBlindFriendly: true,
      wcagCompliant: true
    },
    {
      id: 'dark-theme',
      name: 'Dark Theme Accessible',
      description: 'High contrast colors optimized for dark backgrounds',
      colors: [
        '#90caf9', // Light Blue
        '#ffcc02', // Light Orange
        '#81c784', // Light Green  
        '#f48fb1', // Light Pink
        '#ce93d8', // Light Purple
        '#ffab91', // Light Orange
        '#fff176', // Light Yellow
        '#b0bec5'  // Light Gray
      ],
      highContrast: false,
      colorBlindFriendly: true,
      wcagCompliant: true
    }
  ];

  /**
   * Analyze color contrast between foreground and background
   */
  static analyzeContrast(foreground: string, background: string): ContrastResult {
    const fgRgb = this.parseColor(foreground);
    const bgRgb = this.parseColor(background);
    
    const fgLuminance = this.getLuminance(fgRgb);
    const bgLuminance = this.getLuminance(bgRgb);
    
    const ratio = this.calculateContrastRatio(fgLuminance, bgLuminance);
    
    const passes = {
      normalAA: ratio >= this.WCAG_AA_NORMAL,
      normalAAA: ratio >= this.WCAG_AAA_NORMAL,
      largeAA: ratio >= this.WCAG_AA_LARGE,
      largeAAA: ratio >= this.WCAG_AAA_LARGE
    };
    
    let level: 'AA' | 'AAA' | 'fail';
    if (passes.normalAAA) level = 'AAA';
    else if (passes.normalAA) level = 'AA';
    else level = 'fail';

    return {
      foreground,
      background,
      ratio,
      level,
      passes,
      hex: {
        foreground: this.rgbToHex(fgRgb),
        background: this.rgbToHex(bgRgb)
      }
    };
  }

  /**
   * Get recommendations for improving color contrast
   */
  static getContrastRecommendations(
    colors: string[], 
    backgroundColor: string = '#ffffff'
  ): ColorRecommendation[] {
    const recommendations: ColorRecommendation[] = [];
    
    colors.forEach(color => {
      const result = this.analyzeContrast(color, backgroundColor);
      
      if (!result.passes.normalAA) {
        const improved = this.improveContrast(color, backgroundColor);
        const newResult = this.analyzeContrast(improved, backgroundColor);
        
        recommendations.push({
          originalColor: color,
          recommendedColor: improved,
          reason: `Original contrast ratio ${result.ratio.toFixed(2)} is below WCAG AA requirement (4.5:1)`,
          contrastImprovement: newResult.ratio - result.ratio
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Improve color contrast by adjusting lightness
   */
  static improveContrast(color: string, backgroundColor: string): string {
    const colorRgb = this.parseColor(color);
    const bgRgb = this.parseColor(backgroundColor);
    const bgLuminance = this.getLuminance(bgRgb);
    
    let hsl = this.rgbToHsl(colorRgb);
    let bestColor = color;
    let bestRatio = this.calculateContrastRatio(this.getLuminance(colorRgb), bgLuminance);
    
    // Try making it darker or lighter
    const directions = bgLuminance > 0.5 ? [-1, 1] : [1, -1]; // Dark background = lighter text first
    
    for (const direction of directions) {
      for (let i = 1; i <= 20; i++) {
        const newLightness = Math.max(0, Math.min(1, hsl.l + (direction * i * 0.05)));
        const newHsl = { ...hsl, l: newLightness };
        const newRgb = this.hslToRgb(newHsl);
        const newLuminance = this.getLuminance(newRgb);
        const newRatio = this.calculateContrastRatio(newLuminance, bgLuminance);
        
        if (newRatio > bestRatio && newRatio >= this.WCAG_AA_NORMAL) {
          bestColor = this.rgbToHex(newRgb);
          bestRatio = newRatio;
          break;
        }
      }
      
      if (bestRatio >= this.WCAG_AA_NORMAL) break;
    }
    
    return bestColor;
  }

  /**
   * Generate accessible color palette based on requirements
   */
  static generateAccessiblePalette(
    baseColors: string[],
    backgroundColor: string = '#ffffff',
    requirements: {
      wcagLevel: 'AA' | 'AAA';
      colorBlindFriendly?: boolean;
      highContrast?: boolean;
    }
  ): string[] {
    const targetRatio = requirements.wcagLevel === 'AAA' ? 
      this.WCAG_AAA_NORMAL : this.WCAG_AA_NORMAL;
    
    let palette = baseColors.map(color => this.improveContrast(color, backgroundColor));
    
    if (requirements.colorBlindFriendly) {
      palette = this.makeColorBlindFriendly(palette);
    }
    
    if (requirements.highContrast) {
      palette = this.makeHighContrast(palette, backgroundColor);
    }
    
    // Ensure colors are distinguishable from each other
    palette = this.ensureColorDistinction(palette, backgroundColor);
    
    return palette;
  }

  /**
   * Test color palette against various color vision deficiencies
   */
  static testColorBlindness(colors: string[]): {
    protanopia: number;
    deuteranopia: number;
    tritanopia: number;
    overall: number;
  } {
    // Simulate color vision deficiencies and test distinguishability
    // This is a simplified implementation - in production, use specialized libraries
    
    const scores = {
      protanopia: this.testProtanopia(colors),
      deuteranopia: this.testDeuteranopia(colors),
      tritanopia: this.testTritanopia(colors),
      overall: 0
    };
    
    scores.overall = (scores.protanopia + scores.deuteranopia + scores.tritanopia) / 3;
    
    return scores;
  }

  /**
   * Get the best accessible palette for given requirements
   */
  static getBestPalette(
    requirements: {
      colorCount: number;
      backgroundColor?: string;
      highContrast?: boolean;
      colorBlindFriendly?: boolean;
      wcagLevel?: 'AA' | 'AAA';
    }
  ): ColorPalette {
    const { 
      colorCount, 
      backgroundColor = '#ffffff',
      highContrast = false,
      colorBlindFriendly = false,
      wcagLevel = 'AA'
    } = requirements;
    
    // Score each palette based on requirements
    let bestPalette = this.ACCESSIBLE_PALETTES[0];
    let bestScore = 0;
    
    for (const palette of this.ACCESSIBLE_PALETTES) {
      let score = 0;
      
      // Check if palette has enough colors
      if (palette.colors.length >= colorCount) score += 20;
      
      // Check feature requirements
      if (highContrast && palette.highContrast) score += 30;
      if (colorBlindFriendly && palette.colorBlindFriendly) score += 30;
      if (palette.wcagCompliant) score += 20;
      
      // Test actual contrast ratios
      const contrastScores = palette.colors.map(color => {
        const result = this.analyzeContrast(color, backgroundColor);
        const target = wcagLevel === 'AAA' ? this.WCAG_AAA_NORMAL : this.WCAG_AA_NORMAL;
        return result.ratio >= target ? 1 : result.ratio / target;
      });
      
      const avgContrast = contrastScores.reduce((a, b) => a + b, 0) / contrastScores.length;
      score += avgContrast * 30;
      
      if (score > bestScore) {
        bestScore = score;
        bestPalette = palette;
      }
    }
    
    return bestPalette;
  }

  /**
   * Parse CSS color string to RGB values
   */
  private static parseColor(color: string): { r: number; g: number; b: number } {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16)
        };
      } else if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16)
        };
      }
    }
    
    // Handle rgb() and rgba() colors
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3])
      };
    }
    
    // Handle named colors (simplified)
    const namedColors: Record<string, { r: number; g: number; b: number }> = {
      black: { r: 0, g: 0, b: 0 },
      white: { r: 255, g: 255, b: 255 },
      red: { r: 255, g: 0, b: 0 },
      green: { r: 0, g: 128, b: 0 },
      blue: { r: 0, g: 0, b: 255 }
    };
    
    return namedColors[color.toLowerCase()] || { r: 0, g: 0, b: 0 };
  }

  /**
   * Calculate relative luminance
   */
  private static getLuminance(rgb: { r: number; g: number; b: number }): number {
    const { r, g, b } = rgb;
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculate contrast ratio between two luminance values
   */
  private static calculateContrastRatio(lum1: number, lum2: number): number {
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Convert RGB to hex
   */
  private static rgbToHex(rgb: { r: number; g: number; b: number }): string {
    const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  /**
   * Convert RGB to HSL
   */
  private static rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h, s, l };
  }

  /**
   * Convert HSL to RGB
   */
  private static hslToRgb(hsl: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
    const { h, s, l } = hsl;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  private static makeColorBlindFriendly(colors: string[]): string[] {
    // Adjust colors to be more distinguishable for color blind users
    // This is a simplified implementation
    return colors.map((color, index) => {
      const rgb = this.parseColor(color);
      const hsl = this.rgbToHsl(rgb);
      
      // Adjust hue to avoid problematic red-green combinations
      if (hsl.h >= 0 && hsl.h <= 0.17) { // Red range
        hsl.h = 0.05; // Pure red
      } else if (hsl.h >= 0.25 && hsl.h <= 0.42) { // Green range  
        hsl.h = 0.33; // Pure green
      }
      
      // Increase saturation for better distinction
      hsl.s = Math.max(0.7, hsl.s);
      
      return this.rgbToHex(this.hslToRgb(hsl));
    });
  }

  private static makeHighContrast(colors: string[], backgroundColor: string): string[] {
    const bgLuminance = this.getLuminance(this.parseColor(backgroundColor));
    
    return colors.map(color => {
      const rgb = this.parseColor(color);
      const hsl = this.rgbToHsl(rgb);
      
      // Push lightness to extremes for high contrast
      if (bgLuminance > 0.5) {
        // Light background - make colors darker
        hsl.l = Math.min(0.3, hsl.l);
      } else {
        // Dark background - make colors lighter
        hsl.l = Math.max(0.7, hsl.l);
      }
      
      return this.rgbToHex(this.hslToRgb(hsl));
    });
  }

  private static ensureColorDistinction(colors: string[], backgroundColor: string): string[] {
    const result = [...colors];
    
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const contrast = this.analyzeContrast(result[i], result[j]);
        
        // If colors are too similar, adjust one of them
        if (contrast.ratio < 2.0) {
          const rgb = this.parseColor(result[j]);
          const hsl = this.rgbToHsl(rgb);
          hsl.l = hsl.l > 0.5 ? hsl.l - 0.2 : hsl.l + 0.2;
          result[j] = this.rgbToHex(this.hslToRgb(hsl));
        }
      }
    }
    
    return result;
  }

  // Simplified color blindness simulation tests
  private static testProtanopia(colors: string[]): number {
    // Test red-green color blindness (protanopia)
    // This is a simplified test - in production, use proper color vision simulation
    let distinguishableCount = 0;
    
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        // Simulate protanopia by reducing red channel
        const color1 = this.simulateProtanopia(colors[i]);
        const color2 = this.simulateProtanopia(colors[j]);
        
        const contrast = this.analyzeContrast(color1, color2);
        if (contrast.ratio >= 1.5) distinguishableCount++;
      }
    }
    
    const totalPairs = (colors.length * (colors.length - 1)) / 2;
    return totalPairs > 0 ? (distinguishableCount / totalPairs) * 100 : 100;
  }

  private static testDeuteranopia(colors: string[]): number {
    // Test green color blindness (deuteranopia)
    let distinguishableCount = 0;
    
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const color1 = this.simulateDeuteranopia(colors[i]);
        const color2 = this.simulateDeuteranopia(colors[j]);
        
        const contrast = this.analyzeContrast(color1, color2);
        if (contrast.ratio >= 1.5) distinguishableCount++;
      }
    }
    
    const totalPairs = (colors.length * (colors.length - 1)) / 2;
    return totalPairs > 0 ? (distinguishableCount / totalPairs) * 100 : 100;
  }

  private static testTritanopia(colors: string[]): number {
    // Test blue-yellow color blindness (tritanopia)
    let distinguishableCount = 0;
    
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const color1 = this.simulateTritanopia(colors[i]);
        const color2 = this.simulateTritanopia(colors[j]);
        
        const contrast = this.analyzeContrast(color1, color2);
        if (contrast.ratio >= 1.5) distinguishableCount++;
      }
    }
    
    const totalPairs = (colors.length * (colors.length - 1)) / 2;
    return totalPairs > 0 ? (distinguishableCount / totalPairs) * 100 : 100;
  }

  private static simulateProtanopia(color: string): string {
    const rgb = this.parseColor(color);
    // Simplified protanopia simulation - reduce red channel
    return this.rgbToHex({
      r: Math.round(rgb.r * 0.567 + rgb.g * 0.433),
      g: rgb.g,
      b: rgb.b
    });
  }

  private static simulateDeuteranopia(color: string): string {
    const rgb = this.parseColor(color);
    // Simplified deuteranopia simulation - modify red and green
    return this.rgbToHex({
      r: Math.round(rgb.r * 0.625 + rgb.g * 0.375),
      g: Math.round(rgb.r * 0.7 + rgb.g * 0.3),
      b: rgb.b
    });
  }

  private static simulateTritanopia(color: string): string {
    const rgb = this.parseColor(color);
    // Simplified tritanopia simulation - modify blue
    return this.rgbToHex({
      r: rgb.r,
      g: Math.round(rgb.g * 0.95 + rgb.b * 0.05),
      b: Math.round(rgb.g * 0.433 + rgb.b * 0.567)
    });
  }
}

export default ColorContrastAnalyzer;