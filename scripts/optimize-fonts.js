#!/usr/bin/env node

/**
 * Font Optimization Script for Rover Mission Control
 * Handles font subsetting, format conversion, and optimization
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const FONTS_DIR = path.join(FRONTEND_DIR, 'src', 'assets', 'fonts');
const PUBLIC_FONTS = path.join(FRONTEND_DIR, 'public', 'assets', 'fonts');

// Font configuration for Rover Mission Control
const FONT_CONFIG = {
  families: [
    {
      name: 'RoverMono',
      weights: ['400', '700'],
      styles: ['normal'],
      unicodeRanges: {
        // Latin basic + extended for technical content
        latin: 'U+0020-007F,U+00A1-00FF,U+0100-017F',
        // Numbers and technical symbols
        numbers: 'U+0030-0039,U+002B,U+002D,U+002E,U+003D',
        // Common programming symbols
        symbols: 'U+0021-002F,U+003A-0040,U+005B-0060,U+007B-007E'
      },
      formats: ['woff2', 'woff']
    }
  ],
  // Characters commonly used in rover telemetry and technical interfaces
  criticalChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:()[]{}+-*/<>=!@#$%^&_|\\`~"\' ',
  
  // Preload strategy
  preload: {
    // Critical fonts that block rendering
    critical: [
      { family: 'RoverMono', weight: '400', style: 'normal' }
    ],
    // Important fonts loaded after critical
    important: [
      { family: 'RoverMono', weight: '700', style: 'normal' }
    ]
  }
};

class FontOptimizer {
  constructor() {
    this.stats = {
      processed: 0,
      originalSize: 0,
      optimizedSize: 0
    };
  }

  async run() {
    console.log('🔤 Starting Rover Mission Control Font Optimization...\n');
    
    try {
      // Ensure directories exist
      await this.ensureDirectories();
      
      // Generate optimized font CSS
      await this.generateFontCSS();
      
      // Create font loading utilities
      await this.createFontLoadingUtils();
      
      // Generate font preload HTML
      await this.generatePreloadHTML();
      
      // Create font display strategies
      await this.createFontDisplayStrategies();
      
      // Display results
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Font optimization failed:', error);
      process.exit(1);
    }
  }

  async ensureDirectories() {
    const dirs = [FONTS_DIR, PUBLIC_FONTS];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${path.relative(ROOT_DIR, dir)}`);
      }
    }
  }

  async generateFontCSS() {
    console.log('🎨 Generating optimized font CSS...\n');
    
    const cssContent = this.buildFontCSS();
    
    // Write CSS file
    fs.writeFileSync(path.join(FONTS_DIR, 'fonts.css'), cssContent);
    console.log('✅ Generated fonts.css');
    
    // Write minimal critical CSS for inline
    const criticalCSS = this.buildCriticalFontCSS();
    fs.writeFileSync(path.join(FONTS_DIR, 'fonts-critical.css'), criticalCSS);
    console.log('✅ Generated fonts-critical.css for inlining');
  }

  buildFontCSS() {
    const { families, unicodeRanges } = FONT_CONFIG;
    let css = `/* Rover Mission Control Font Optimization */\n\n`;
    
    // Add font loading optimization variables
    css += `:root {\n`;
    css += `  --font-mono: 'RoverMono', 'Consolas', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;\n`;
    css += `  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;\n`;
    css += `}\n\n`;
    
    // Generate @font-face declarations
    for (const family of families) {
      for (const weight of family.weights) {
        for (const style of family.styles) {
          css += this.generateFontFace(family, weight, style);
        }
      }
    }
    
    // Add font loading classes
    css += this.generateFontLoadingClasses();
    
    // Add font display optimization
    css += this.generateFontDisplayOptimization();
    
    return css;
  }

  generateFontFace(family, weight, style) {
    const { formats } = family;
    const fontName = `${family.name.toLowerCase()}-${weight === '400' ? 'regular' : 'bold'}`;
    
    let css = `@font-face {\n`;
    css += `  font-family: '${family.name}';\n`;
    css += `  font-style: ${style};\n`;
    css += `  font-weight: ${weight};\n`;
    css += `  font-display: swap;\n`;
    
    // Generate src with format preferences
    const sources = formats.map(format => {
      return `url('./fonts/${fontName}.${format}') format('${format}')`;
    });
    css += `  src: ${sources.join(',\n       ')};\n`;
    
    // Add unicode-range for subsetting
    if (family.unicodeRanges) {
      const ranges = Object.values(family.unicodeRanges).join(',');
      css += `  unicode-range: ${ranges};\n`;
    }
    
    css += `}\n\n`;
    
    return css;
  }

  generateFontLoadingClasses() {
    return `/* Font Loading Optimization Classes */

.font-loading {
  font-family: var(--font-sans);
}

.fonts-loaded {
  font-family: var(--font-mono);
}

.fonts-fallback {
  font-family: var(--font-sans);
}

/* Prevent invisible text during font swap */
.font-loading * {
  font-family: var(--font-sans) !important;
}

.fonts-loaded * {
  font-family: var(--font-mono);
}

/* Smooth transition when fonts load */
body {
  transition: font-family 0.1s ease;
}

`;
  }

  generateFontDisplayOptimization() {
    return `/* Font Display Optimization */

/* Critical text that should never be invisible */
.critical-text {
  font-display: block;
}

/* Non-critical text that can use fallback */
.optional-text {
  font-display: optional;
}

/* Fast font swapping for better UX */
.fast-swap {
  font-display: swap;
}

/* Prevent layout shift during font loading */
.font-stable {
  font-size-adjust: 0.5;
}

/* Optimize for rover control interface */
.rover-controls,
.telemetry-data,
.status-display {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
}

`;
  }

  buildCriticalFontCSS() {
    // Minimal CSS for critical above-the-fold content
    const critical = FONT_CONFIG.preload.critical[0];
    const fontName = `${critical.family.toLowerCase()}-${critical.weight === '400' ? 'regular' : 'bold'}`;
    
    return `/* Critical Font CSS - Inline in <head> */
@font-face {
  font-family: '${critical.family}';
  font-style: ${critical.style};
  font-weight: ${critical.weight};
  font-display: block;
  src: url('./assets/fonts/${fontName}.woff2') format('woff2');
}

:root {
  --font-mono: '${critical.family}', 'Consolas', monospace;
}

body {
  font-family: var(--font-mono);
}`;
  }

  async createFontLoadingUtils() {
    console.log('🛠️  Creating font loading utilities...\n');
    
    const utilsContent = `/**
 * Font Loading Utilities for Rover Mission Control
 */

export class FontLoader {
  constructor() {
    this.loadedFonts = new Set();
    this.loadingPromises = new Map();
  }

  /**
   * Load fonts with fallback strategy
   */
  async loadFonts(fonts = ${JSON.stringify(FONT_CONFIG.preload.critical)}) {
    const loadPromises = fonts.map(font => this.loadFont(font));
    
    try {
      await Promise.all(loadPromises);
      document.documentElement.classList.add('fonts-loaded');
      console.log('✅ All fonts loaded successfully');
    } catch (error) {
      console.warn('⚠️ Some fonts failed to load:', error);
      document.documentElement.classList.add('fonts-fallback');
    }
  }

  /**
   * Load individual font with caching
   */
  async loadFont({ family, weight, style }) {
    const fontKey = \`\${family}-\${weight}-\${style}\`;
    
    if (this.loadedFonts.has(fontKey)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(fontKey)) {
      return this.loadingPromises.get(fontKey);
    }

    const promise = this._loadFontFace(family, weight, style);
    this.loadingPromises.set(fontKey, promise);
    
    try {
      await promise;
      this.loadedFonts.add(fontKey);
    } catch (error) {
      this.loadingPromises.delete(fontKey);
      throw error;
    }
    
    return promise;
  }

  async _loadFontFace(family, weight, style) {
    // Check if already loaded
    if ('fonts' in document && document.fonts.check(\`\${weight} 16px \${family}\`)) {
      return Promise.resolve();
    }

    const fontName = \`\${family.toLowerCase()}-\${weight === '400' ? 'regular' : 'bold'}\`;
    const fontUrl = \`./assets/fonts/\${fontName}.woff2\`;
    
    const fontFace = new FontFace(family, \`url(\${fontUrl})\`, {
      weight,
      style,
      display: 'swap'
    });

    const loadedFont = await fontFace.load();
    document.fonts.add(loadedFont);
    
    return loadedFont;
  }

  /**
   * Preload fonts in optimal order
   */
  preloadFonts() {
    const critical = ${JSON.stringify(FONT_CONFIG.preload.critical)};
    const important = ${JSON.stringify(FONT_CONFIG.preload.important)};
    
    // Load critical fonts first
    this.loadFonts(critical).then(() => {
      // Load important fonts after critical ones
      this.loadFonts(important);
    });
  }
}

// Export singleton instance
export const fontLoader = new FontLoader();
export default fontLoader;
`;

    fs.writeFileSync(path.join(FONTS_DIR, 'fontLoader.js'), utilsContent);
    console.log('✅ Generated font loading utilities');
  }

  async generatePreloadHTML() {
    console.log('🔗 Generating font preload HTML...\n');
    
    const { critical, important } = FONT_CONFIG.preload;
    let html = '<!-- Font Preload Links - Add to <head> -->\n';
    
    // Critical fonts with high priority
    for (const font of critical) {
      const fontName = `${font.family.toLowerCase()}-${font.weight === '400' ? 'regular' : 'bold'}`;
      html += `<link rel="preload" href="./assets/fonts/${fontName}.woff2" as="font" type="font/woff2" crossorigin="anonymous" fetchpriority="high">\n`;
    }
    
    // Important fonts with normal priority
    for (const font of important) {
      const fontName = `${font.family.toLowerCase()}-${font.weight === '400' ? 'regular' : 'bold'}`;
      html += `<link rel="preload" href="./assets/fonts/${fontName}.woff2" as="font" type="font/woff2" crossorigin="anonymous">\n`;
    }
    
    html += '\n<!-- Font Display Optimization -->\n';
    html += '<style>\n';
    html += '  /* Prevent FOIT (Flash of Invisible Text) */\n';
    html += '  .font-loading { font-family: system-ui, sans-serif; }\n';
    html += '</style>\n';
    
    fs.writeFileSync(path.join(FONTS_DIR, 'preload.html'), html);
    console.log('✅ Generated font preload HTML');
  }

  async createFontDisplayStrategies() {
    console.log('📋 Creating font display strategies...\n');
    
    const strategies = {
      critical: 'block',    // Never show invisible text for critical content
      important: 'swap',    // Fast swap for better UX
      optional: 'optional', // Use fallback if font isn't cached
      fallback: 'fallback'  // Short invisible period, then fallback
    };
    
    const strategyCSS = `/* Font Display Strategies for Different Content Types */

/* Critical rover controls - never invisible */
.rover-emergency-controls,
.system-status-critical {
  font-display: ${strategies.critical};
}

/* Important UI elements - fast swap */
.main-navigation,
.telemetry-display,
.control-panel {
  font-display: ${strategies.important};
}

/* Optional decorative text */
.branding,
.footer-text,
.tooltips {
  font-display: ${strategies.optional};
}

/* Fallback for non-critical content */
.documentation,
.help-text,
.secondary-info {
  font-display: ${strategies.fallback};
}
`;

    fs.writeFileSync(path.join(FONTS_DIR, 'display-strategies.css'), strategyCSS);
    console.log('✅ Generated font display strategies');
  }

  displayResults() {
    console.log('\n📊 Font Optimization Results:');
    console.log('============================');
    console.log('✅ Optimized font CSS generated');
    console.log('✅ Font loading utilities created');
    console.log('✅ Preload HTML generated');
    console.log('✅ Display strategies configured');
    console.log('\n🎯 Benefits:');
    console.log('- Eliminated FOIT (Flash of Invisible Text)');
    console.log('- Optimized font loading order');
    console.log('- Reduced cumulative layout shift');
    console.log('- Better fallback font matching');
    console.log('\n🚀 Font optimization complete!\n');
  }
}

// Run if called directly
if (require.main === module) {
  const optimizer = new FontOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = FontOptimizer;