#!/usr/bin/env node

/**
 * Asset Optimization Script for Rover Mission Control
 * Optimizes images, fonts, and other static assets for production
 */

const fs = require('fs');
const path = require('path');
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminPngquant = require('imagemin-pngquant');
const imageminSvgo = require('imagemin-svgo');
const imageminWebp = require('imagemin-webp');
const imageminAvif = require('imagemin-avif');
const sharp = require('sharp');

const ROOT_DIR = path.join(__dirname, '..');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const SRC_ASSETS = path.join(FRONTEND_DIR, 'src', 'assets');
const PUBLIC_ASSETS = path.join(FRONTEND_DIR, 'public', 'assets');
const BUILD_ASSETS = path.join(FRONTEND_DIR, 'build', 'static');

// Configuration
const CONFIG = {
  images: {
    quality: {
      jpeg: 85,
      webp: 80,
      avif: 70,
      png: [0.6, 0.8]
    },
    breakpoints: [480, 768, 1024, 1440, 1920],
    formats: ['webp', 'avif', 'original']
  },
  optimization: {
    // Target 50-70% size reduction
    aggressive: process.env.NODE_ENV === 'production',
    generateResponsive: true,
    generateModernFormats: true
  }
};

class AssetOptimizer {
  constructor() {
    this.stats = {
      processed: 0,
      originalSize: 0,
      optimizedSize: 0,
      saved: 0
    };
  }

  async run() {
    console.log('🚀 Starting Rover Mission Control Asset Optimization...\n');
    
    try {
      // Ensure output directories exist
      await this.ensureDirectories();
      
      // Generate sample assets if they don't exist
      await this.generateSampleAssets();
      
      // Optimize images
      await this.optimizeImages();
      
      // Process fonts (integration with font optimizer)
      await this.processFonts();
      
      // Generate asset manifest
      await this.generateAssetManifest();
      
      // Create performance report
      await this.generatePerformanceReport();
      
      // Display results
      this.displayResults();
      
    } catch (error) {
      console.error('❌ Optimization failed:', error);
      process.exit(1);
    }
  }

  async ensureDirectories() {
    const dirs = [
      path.join(SRC_ASSETS, 'images', 'optimized'),
      path.join(SRC_ASSETS, 'images', 'responsive'),
      path.join(PUBLIC_ASSETS, 'images'),
      path.join(PUBLIC_ASSETS, 'fonts')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${path.relative(ROOT_DIR, dir)}`);
      }
    }
  }

  async generateSampleAssets() {
    console.log('🎨 Generating sample rover assets...\n');
    
    // Generate sample rover images with different sizes
    const sampleImages = [
      { name: 'rover-hero', width: 1920, height: 1080, color: '#0a0e1a' },
      { name: 'rover-dashboard', width: 800, height: 600, color: '#1a1f2e' },
      { name: 'mission-badge', width: 200, height: 200, color: '#3b82f6' },
      { name: 'telemetry-background', width: 1200, height: 800, color: '#242938' }
    ];

    for (const img of sampleImages) {
      const outputPath = path.join(SRC_ASSETS, 'images', 'rovers', `${img.name}.png`);
      
      if (!fs.existsSync(outputPath)) {
        await sharp({
          create: {
            width: img.width,
            height: img.height,
            channels: 4,
            background: { r: 16, g: 25, b: 41, alpha: 1 }
          }
        })
        .png()
        .toFile(outputPath);
        
        console.log(`✅ Generated sample image: ${img.name}.png (${img.width}x${img.height})`);
      }
    }

    // Generate sample icons
    const iconSizes = [16, 24, 32, 48, 64, 128, 256];
    const iconColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    
    for (let i = 0; i < iconColors.length; i++) {
      const iconName = ['control', 'telemetry', 'warning', 'error'][i];
      
      for (const size of iconSizes) {
        const outputPath = path.join(SRC_ASSETS, 'images', 'icons', `${iconName}-${size}.png`);
        
        if (!fs.existsSync(outputPath)) {
          await sharp({
            create: {
              width: size,
              height: size,
              channels: 4,
              background: iconColors[i]
            }
          })
          .png()
          .toFile(outputPath);
        }
      }
      
      console.log(`✅ Generated icon set: ${iconName} (${iconSizes.length} sizes)`);
    }
  }

  async optimizeImages() {
    console.log('\n🖼️  Optimizing images...\n');
    
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.svg'];
    const imagePaths = await this.findFiles(SRC_ASSETS, imageExtensions);
    
    for (const imagePath of imagePaths) {
      await this.processImage(imagePath);
    }
  }

  async processImage(imagePath) {
    const relativePath = path.relative(SRC_ASSETS, imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(relativePath);
    
    const outputDir = path.join(SRC_ASSETS, 'images', 'optimized', dirname);
    const responsiveDir = path.join(SRC_ASSETS, 'images', 'responsive', dirname);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    if (!fs.existsSync(responsiveDir)) {
      fs.mkdirSync(responsiveDir, { recursive: true });
    }

    const originalStats = fs.statSync(imagePath);
    this.stats.originalSize += originalStats.size;

    try {
      // Standard optimization
      await this.optimizeStandard(imagePath, outputDir, basename, ext);
      
      // Generate responsive variants if it's a large image
      if (originalStats.size > 50000 && ['.png', '.jpg', '.jpeg'].includes(ext)) {
        await this.generateResponsiveVariants(imagePath, responsiveDir, basename);
      }
      
      this.stats.processed++;
      console.log(`✅ Optimized: ${relativePath}`);
      
    } catch (error) {
      console.error(`❌ Failed to optimize ${relativePath}:`, error.message);
    }
  }

  async optimizeStandard(inputPath, outputDir, basename, ext) {
    const outputs = [];
    
    // Original format optimization
    if (ext === '.svg') {
      await imagemin([inputPath], {
        destination: outputDir,
        plugins: [
          imageminSvgo({
            plugins: [
              { name: 'removeViewBox', active: false },
              { name: 'cleanupIDs', active: false }
            ]
          })
        ]
      });
      outputs.push(`${basename}.svg`);
    } else {
      // Raster image optimization
      const plugins = [];
      
      if (['.jpg', '.jpeg'].includes(ext)) {
        plugins.push(imageminMozjpeg({ quality: CONFIG.images.quality.jpeg }));
      } else if (ext === '.png') {
        plugins.push(imageminPngquant({ quality: CONFIG.images.quality.png }));
      }
      
      await imagemin([inputPath], {
        destination: outputDir,
        plugins
      });
      outputs.push(`${basename}${ext}`);
      
      // Generate modern formats
      if (CONFIG.optimization.generateModernFormats) {
        const sharpImage = sharp(inputPath);
        
        // WebP
        await sharpImage
          .webp({ quality: CONFIG.images.quality.webp })
          .toFile(path.join(outputDir, `${basename}.webp`));
        outputs.push(`${basename}.webp`);
        
        // AVIF (if supported)
        try {
          await sharpImage
            .avif({ quality: CONFIG.images.quality.avif })
            .toFile(path.join(outputDir, `${basename}.avif`));
          outputs.push(`${basename}.avif`);
        } catch (error) {
          // AVIF might not be supported on all systems
          console.log(`⚠️  AVIF generation skipped for ${basename}: ${error.message}`);
        }
      }
    }

    // Update stats
    for (const output of outputs) {
      const outputPath = path.join(outputDir, output);
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        this.stats.optimizedSize += stats.size;
      }
    }
  }

  async generateResponsiveVariants(inputPath, outputDir, basename) {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Only generate smaller variants
    const applicableBreakpoints = CONFIG.images.breakpoints.filter(bp => bp < metadata.width);
    
    for (const width of applicableBreakpoints) {
      const height = Math.round((metadata.height * width) / metadata.width);
      
      // Original format
      const ext = path.extname(inputPath);
      await image
        .resize(width, height, { withoutEnlargement: true })
        .toFile(path.join(outputDir, `${basename}-${width}w${ext}`));
      
      // Modern formats
      if (CONFIG.optimization.generateModernFormats) {
        await image
          .resize(width, height, { withoutEnlargement: true })
          .webp({ quality: CONFIG.images.quality.webp })
          .toFile(path.join(outputDir, `${basename}-${width}w.webp`));
        
        try {
          await image
            .resize(width, height, { withoutEnlargement: true })
            .avif({ quality: CONFIG.images.quality.avif })
            .toFile(path.join(outputDir, `${basename}-${width}w.avif`));
        } catch (error) {
          // AVIF might not be supported
        }
      }
    }
  }

  async processFonts() {
    console.log('\n🔤 Processing fonts (integrating with font optimizer)...\n');
    
    // Check if font optimizer has already run
    const fontOptimizerOutput = path.join(SRC_ASSETS, 'fonts', 'fonts.css');
    
    if (fs.existsSync(fontOptimizerOutput)) {
      console.log('✅ Font optimization already completed by font optimizer');
      return;
    }
    
    // Run basic font processing if font optimizer hasn't run
    const basicFontsCSS = `
/* Basic Rover Mission Control Font Setup */
:root {
  --font-mono: 'Consolas', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

body {
  font-family: var(--font-mono);
  font-display: swap;
}
`.trim();

    fs.writeFileSync(path.join(SRC_ASSETS, 'fonts', 'fonts.css'), basicFontsCSS);
    console.log('✅ Generated basic fonts.css (run optimize:fonts for full optimization)');
  }

  async generatePerformanceReport() {
    console.log('\n📊 Generating performance report...\n');
    
    const report = {
      timestamp: new Date().toISOString(),
      optimization: {
        images: {
          processed: this.stats.processed,
          originalSize: this.stats.originalSize,
          optimizedSize: this.stats.optimizedSize,
          savings: this.stats.originalSize - this.stats.optimizedSize,
          savingsPercent: this.stats.originalSize > 0 ? 
            ((this.stats.originalSize - this.stats.optimizedSize) / this.stats.originalSize * 100).toFixed(1) : 0
        },
        formats: {
          modern: ['webp', 'avif'],
          fallback: ['png', 'jpg', 'gif'],
          generated: await this.countOptimizedImages()
        }
      },
      recommendations: [
        {
          type: 'critical',
          message: 'Implement HTTP/2 server push for critical assets',
          priority: 'high'
        },
        {
          type: 'optimization',
          message: 'Use CDN with proper cache headers for static assets',
          priority: 'medium'
        },
        {
          type: 'monitoring',
          message: 'Set up Core Web Vitals monitoring',
          priority: 'medium'
        }
      ],
      caching: {
        strategy: 'Cache-first for assets, Network-first for API',
        serviceWorker: 'Enabled with modern format support',
        headers: 'Optimized for 1-year caching with immutable assets'
      },
      lighthouse: {
        targets: {
          performance: '>90',
          accessibility: '>95',
          bestPractices: '>90',
          seo: '>90'
        },
        critical: [
          'First Contentful Paint < 1.5s',
          'Largest Contentful Paint < 2.5s',
          'Cumulative Layout Shift < 0.1'
        ]
      }
    };
    
    fs.writeFileSync(
      path.join(SRC_ASSETS, 'performance-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Generate human-readable report
    const readableReport = this.generateReadableReport(report);
    fs.writeFileSync(
      path.join(SRC_ASSETS, 'performance-report.md'),
      readableReport
    );
    
    console.log('✅ Generated performance report');
  }

  async countOptimizedImages() {
    const optimizedDir = path.join(SRC_ASSETS, 'images', 'optimized');
    if (!fs.existsSync(optimizedDir)) return { webp: 0, avif: 0, total: 0 };
    
    const files = await this.findFiles(optimizedDir, ['.webp', '.avif', '.png', '.jpg', '.jpeg', '.gif']);
    
    return {
      webp: files.filter(f => f.endsWith('.webp')).length,
      avif: files.filter(f => f.endsWith('.avif')).length,
      total: files.length
    };
  }

  generateReadableReport(report) {
    const { optimization, recommendations, caching } = report;
    
    return `# Rover Mission Control Asset Optimization Report

Generated: ${report.timestamp}

## Image Optimization Results

- **Files Processed**: ${optimization.images.processed}
- **Original Size**: ${this.formatBytes(optimization.images.originalSize)}
- **Optimized Size**: ${this.formatBytes(optimization.images.optimizedSize)}
- **Space Saved**: ${this.formatBytes(optimization.images.savings)} (${optimization.images.savingsPercent}%)

## Modern Format Support

- **WebP Images**: ${optimization.formats.generated.webp}
- **AVIF Images**: ${optimization.formats.generated.avif}
- **Total Optimized**: ${optimization.formats.generated.total}

## Performance Recommendations

${recommendations.map(rec => `- **${rec.type.toUpperCase()}** (${rec.priority}): ${rec.message}`).join('\n')}

## Caching Strategy

- **Strategy**: ${caching.strategy}
- **Service Worker**: ${caching.serviceWorker}
- **Cache Headers**: ${caching.headers}

## Next Steps

1. Run \`npm run build:production\` to apply optimizations
2. Test with Lighthouse to verify performance improvements
3. Monitor Core Web Vitals in production
4. Consider implementing HTTP/2 server push for critical resources

## Performance Targets

${report.lighthouse.critical.map(target => `- ${target}`).join('\n')}
`;
  }

  async generateAssetManifest() {
    console.log('\n📋 Generating asset manifest...\n');
    
    const manifest = {
      generated: new Date().toISOString(),
      config: CONFIG,
      stats: this.stats,
      images: {
        optimized: await this.scanDirectory(path.join(SRC_ASSETS, 'images', 'optimized')),
        responsive: await this.scanDirectory(path.join(SRC_ASSETS, 'images', 'responsive'))
      }
    };

    fs.writeFileSync(
      path.join(SRC_ASSETS, 'asset-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    console.log('✅ Generated asset manifest');
  }

  async scanDirectory(dir) {
    const assets = {};
    
    if (!fs.existsSync(dir)) return assets;
    
    const scan = (currentDir, prefix = '') => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scan(fullPath, prefix + item + '/');
        } else {
          const key = prefix + item;
          assets[key] = {
            path: path.relative(SRC_ASSETS, fullPath),
            size: stat.size,
            modified: stat.mtime.toISOString()
          };
        }
      }
    };
    
    scan(dir);
    return assets;
  }

  async findFiles(dir, extensions) {
    const files = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const scan = (currentDir) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('optimized')) {
          scan(fullPath);
        } else if (extensions.includes(path.extname(item).toLowerCase())) {
          files.push(fullPath);
        }
      }
    };
    
    scan(dir);
    return files;
  }

  displayResults() {
    const savedBytes = this.stats.originalSize - this.stats.optimizedSize;
    const savedPercent = ((savedBytes / this.stats.originalSize) * 100).toFixed(1);
    
    console.log('\n📊 Optimization Results:');
    console.log('========================');
    console.log(`Files processed: ${this.stats.processed}`);
    console.log(`Original size: ${this.formatBytes(this.stats.originalSize)}`);
    console.log(`Optimized size: ${this.formatBytes(this.stats.optimizedSize)}`);
    console.log(`Space saved: ${this.formatBytes(savedBytes)} (${savedPercent}%)`);
    console.log('\n🎉 Asset optimization complete!\n');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Run if called directly
if (require.main === module) {
  const optimizer = new AssetOptimizer();
  optimizer.run().catch(console.error);
}

module.exports = AssetOptimizer;