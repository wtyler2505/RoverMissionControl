/**
 * Color Contrast Validation Tool
 * 
 * Automated testing for WCAG 2.1 AA/AAA color contrast compliance
 * Tests all text/background combinations across themes
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class ColorContrastValidator {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.options = {
      baseURL: options.baseURL || 'http://localhost:3000',
      reportDir: options.reportDir || './reports/color-contrast',
      screenshotDir: options.screenshotDir || './screenshots/color-contrast',
      themes: options.themes || ['light', 'dark', 'high-contrast'],
      wcagLevel: options.wcagLevel || 'AA', // AA or AAA
      ...options
    };
    
    // WCAG contrast ratio requirements
    this.contrastRequirements = {
      AA: {
        normal: 4.5,
        large: 3.0,
        nonText: 3.0
      },
      AAA: {
        normal: 7.0,
        large: 4.5,
        nonText: 3.0
      }
    };
    
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.options.reportDir, this.options.screenshotDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async setup() {
    console.log('Setting up browser for color contrast validation...');
    
    this.browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security', '--force-color-profile=srgb']
    });
    
    this.page = await this.browser.newPage();
    
    // Inject color contrast utilities
    await this.injectContrastUtilities();
    
    console.log('Color contrast validator setup complete');
  }

  async injectContrastUtilities() {
    await this.page.addInitScript(() => {
      // Color contrast calculation utilities
      window.contrastUtils = {
        // Convert RGB to relative luminance
        getLuminance(r, g, b) {
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
        },
        
        // Calculate contrast ratio between two colors
        getContrastRatio(color1, color2) {
          const lum1 = this.getLuminance(...color1);
          const lum2 = this.getLuminance(...color2);
          const brightest = Math.max(lum1, lum2);
          const darkest = Math.min(lum1, lum2);
          return (brightest + 0.05) / (darkest + 0.05);
        },
        
        // Parse RGB color from computed style
        parseRGB(colorStr) {
          const match = colorStr.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
          return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
        },
        
        // Parse RGBA color from computed style
        parseRGBA(colorStr) {
          let match = colorStr.match(/rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+),\\s*([\\d.]+)\\)/);
          if (match) {
            return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseFloat(match[4])];
          }
          
          match = colorStr.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
          return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), 1] : null;
        },
        
        // Get effective background color (considering transparency)
        getEffectiveBackgroundColor(element) {
          let current = element;
          let bgColor = null;
          
          while (current && current !== document.body) {
            const style = window.getComputedStyle(current);
            const bg = style.backgroundColor;
            
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
              const parsed = this.parseRGBA(bg);
              if (parsed && parsed[3] > 0) {
                if (!bgColor) {
                  bgColor = parsed;
                } else {
                  // Alpha blending
                  const alpha = parsed[3];
                  bgColor = [
                    Math.round(parsed[0] * alpha + bgColor[0] * (1 - alpha)),
                    Math.round(parsed[1] * alpha + bgColor[1] * (1 - alpha)),
                    Math.round(parsed[2] * alpha + bgColor[2] * (1 - alpha)),
                    Math.min(1, bgColor[3] + alpha)
                  ];
                }
              }
            }
            current = current.parentElement;
          }
          
          // Default to white background if none found
          return bgColor ? bgColor.slice(0, 3) : [255, 255, 255];
        },
        
        // Check if text is considered large (18pt+ or 14pt+ bold)
        isLargeText(element) {
          const style = window.getComputedStyle(element);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = style.fontWeight;
          
          // Convert px to pt (assuming 96 DPI)
          const fontSizePt = fontSize * 0.75;
          
          return fontSizePt >= 18 || (fontSizePt >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
        },
        
        // Get all text elements with their contrast information
        getAllTextElements() {
          const textElements = [];
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode: (node) => {
                // Skip empty text nodes and whitespace-only nodes
                if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
                
                // Skip script and style content
                const parent = node.parentElement;
                if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
                  return NodeFilter.FILTER_REJECT;
                }
                
                // Skip hidden elements
                const style = window.getComputedStyle(parent);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                  return NodeFilter.FILTER_REJECT;
                }
                
                return NodeFilter.FILTER_ACCEPT;
              }
            }
          );
          
          let textNode;
          while (textNode = walker.nextNode()) {
            const element = textNode.parentElement;
            const style = window.getComputedStyle(element);
            
            const textColor = this.parseRGB(style.color);
            const backgroundColor = this.getEffectiveBackgroundColor(element);
            
            if (textColor && backgroundColor) {
              const contrastRatio = this.getContrastRatio(textColor, backgroundColor);
              const isLarge = this.isLargeText(element);
              
              textElements.push({
                text: textNode.textContent.trim().substring(0, 100),
                element: {
                  tagName: element.tagName,
                  className: element.className,
                  id: element.id,
                  fontSize: style.fontSize,
                  fontWeight: style.fontWeight
                },
                colors: {
                  text: textColor,
                  background: backgroundColor,
                  textString: style.color,
                  backgroundString: style.backgroundColor
                },
                contrast: {
                  ratio: contrastRatio,
                  isLarge: isLarge,
                  passes: {
                    AA: contrastRatio >= (isLarge ? 3.0 : 4.5),
                    AAA: contrastRatio >= (isLarge ? 4.5 : 7.0)
                  }
                },
                position: element.getBoundingClientRect()
              });
            }
          }
          
          return textElements;
        },
        
        // Get all non-text UI elements (buttons, form controls, etc.)
        getNonTextElements() {
          const elements = [];
          const selectors = [
            'button', 'input', 'select', 'textarea',
            '[role="button"]', '[role="link"]', '[role="tab"]',
            'a[href]', '.icon', '[class*="icon"]'
          ];
          
          selectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
              const style = window.getComputedStyle(element);
              
              // Skip hidden elements
              if (style.display === 'none' || style.visibility === 'hidden') return;
              
              const borderColor = this.parseRGB(style.borderColor);
              const backgroundColor = this.parseRGB(style.backgroundColor);
              const parentBgColor = this.getEffectiveBackgroundColor(element.parentElement);
              
              if (borderColor && parentBgColor) {
                const borderContrast = this.getContrastRatio(borderColor, parentBgColor);
                
                elements.push({
                  element: {
                    tagName: element.tagName,
                    className: element.className,
                    id: element.id,
                    role: element.getAttribute('role')
                  },
                  colors: {
                    border: borderColor,
                    background: parentBgColor,
                    borderString: style.borderColor,
                    backgroundString: style.backgroundColor
                  },
                  contrast: {
                    ratio: borderContrast,
                    passes: {
                      AA: borderContrast >= 3.0,
                      AAA: borderContrast >= 3.0
                    }
                  },
                  position: element.getBoundingClientRect()
                });
              }
            });
          });
          
          return elements;
        }
      };
    });
  }

  async validatePage(url, theme = 'light') {
    console.log(`Validating color contrast for ${url} with ${theme} theme...`);
    
    const report = {
      url,
      theme,
      timestamp: new Date().toISOString(),
      wcagLevel: this.options.wcagLevel,
      results: {
        textElements: [],
        nonTextElements: [],
        summary: {
          totalText: 0,
          totalNonText: 0,
          textPassed: 0,
          textFailed: 0,
          nonTextPassed: 0,
          nonTextFailed: 0
        },
        violations: []
      }
    };

    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      
      // Apply theme
      await this.applyTheme(theme);
      
      // Wait for theme to apply
      await this.page.waitForTimeout(1000);
      
      // Get all text elements and their contrast ratios
      const textElements = await this.page.evaluate(() => {
        return window.contrastUtils.getAllTextElements();
      });
      
      // Get all non-text elements
      const nonTextElements = await this.page.evaluate(() => {
        return window.contrastUtils.getNonTextElements();
      });
      
      report.results.textElements = textElements;
      report.results.nonTextElements = nonTextElements;
      
      // Calculate summary
      const wcagLevel = this.options.wcagLevel;
      report.results.summary.totalText = textElements.length;
      report.results.summary.totalNonText = nonTextElements.length;
      report.results.summary.textPassed = textElements.filter(e => e.contrast.passes[wcagLevel]).length;
      report.results.summary.textFailed = textElements.filter(e => !e.contrast.passes[wcagLevel]).length;
      report.results.summary.nonTextPassed = nonTextElements.filter(e => e.contrast.passes[wcagLevel]).length;
      report.results.summary.nonTextFailed = nonTextElements.filter(e => !e.contrast.passes[wcagLevel]).length;
      
      // Collect violations
      const textViolations = textElements
        .filter(e => !e.contrast.passes[wcagLevel])
        .map(e => ({
          type: 'text',
          element: e.element,
          text: e.text,
          contrast: e.contrast.ratio,
          required: e.contrast.isLarge ? this.contrastRequirements[wcagLevel].large : this.contrastRequirements[wcagLevel].normal,
          colors: e.colors,
          position: e.position
        }));
      
      const nonTextViolations = nonTextElements
        .filter(e => !e.contrast.passes[wcagLevel])
        .map(e => ({
          type: 'non-text',
          element: e.element,
          contrast: e.contrast.ratio,
          required: this.contrastRequirements[wcagLevel].nonText,
          colors: e.colors,
          position: e.position
        }));
      
      report.results.violations = [...textViolations, ...nonTextViolations];
      
      // Take screenshot
      await this.page.screenshot({
        path: path.join(this.options.screenshotDir, `${theme}-${url.replace(/[^a-zA-Z0-9]/g, '_')}.png`),
        fullPage: true
      });
      
      // Highlight violations if any
      if (report.results.violations.length > 0) {
        await this.highlightViolations(report.results.violations);
        await this.page.screenshot({
          path: path.join(this.options.screenshotDir, `${theme}-${url.replace(/[^a-zA-Z0-9]/g, '_')}-violations.png`),
          fullPage: true
        });
      }
      
    } catch (error) {
      report.error = error.message;
      console.error(`Error validating ${url}:`, error);
    }
    
    return report;
  }

  async applyTheme(theme) {
    switch (theme) {
      case 'dark':
        await this.page.addStyleTag({
          content: `
            html { filter: invert(1) hue-rotate(180deg); }
            img, video, iframe { filter: invert(1) hue-rotate(180deg); }
          `
        });
        break;
      case 'high-contrast':
        await this.page.addStyleTag({
          content: `
            * {
              background: black !important;
              color: white !important;
              border-color: white !important;
            }
            a, button {
              color: yellow !important;
            }
            input, select, textarea {
              background: white !important;
              color: black !important;
            }
          `
        });
        break;
      case 'light':
      default:
        // No modifications needed for light theme
        break;
    }
  }

  async highlightViolations(violations) {
    await this.page.evaluate((violationsData) => {
      // Remove existing highlights
      document.querySelectorAll('.contrast-violation-highlight').forEach(el => el.remove());
      
      violationsData.forEach((violation, index) => {
        // Find elements at the violation position
        const elements = document.elementsFromPoint(
          violation.position.x + violation.position.width / 2,
          violation.position.y + violation.position.height / 2
        );
        
        const targetElement = elements.find(el => 
          el.tagName === violation.element.tagName &&
          el.className === violation.element.className &&
          el.id === violation.element.id
        );
        
        if (targetElement) {
          // Create highlight overlay
          const highlight = document.createElement('div');
          highlight.className = 'contrast-violation-highlight';
          highlight.style.cssText = `
            position: absolute;
            top: ${violation.position.y}px;
            left: ${violation.position.x}px;
            width: ${violation.position.width}px;
            height: ${violation.position.height}px;
            border: 3px solid red;
            background: rgba(255, 0, 0, 0.1);
            pointer-events: none;
            z-index: 9999;
          `;
          
          // Add violation info
          const info = document.createElement('div');
          info.style.cssText = `
            position: absolute;
            top: -25px;
            left: 0;
            background: red;
            color: white;
            padding: 2px 5px;
            font-size: 12px;
            font-family: monospace;
            white-space: nowrap;
          `;
          info.textContent = `Ratio: ${violation.contrast.toFixed(2)} (Required: ${violation.required})`;
          highlight.appendChild(info);
          
          document.body.appendChild(highlight);
        }
      });
    }, violations);
  }

  async validateAllPages() {
    const testPages = [
      { url: '/', name: 'homepage' },
      { url: '/hal-dashboard', name: 'hal-dashboard' },
      { url: '/device-discovery', name: 'device-discovery' },
      { url: '/telemetry', name: 'telemetry' },
      { url: '/simulation', name: 'simulation' }
    ];

    const allReports = [];

    for (const theme of this.options.themes) {
      console.log(`\\nTesting ${theme} theme...`);
      
      for (const { url, name } of testPages) {
        const fullUrl = `${this.options.baseURL}${url}`;
        const report = await this.validatePage(fullUrl, theme);
        report.pageName = name;
        allReports.push(report);
      }
    }

    // Generate comprehensive report
    await this.generateReport(allReports);
    
    return allReports;
  }

  async generateReport(reports) {
    console.log('Generating color contrast report...');
    
    const summary = {
      timestamp: new Date().toISOString(),
      wcagLevel: this.options.wcagLevel,
      totalPages: reports.length,
      themes: [...new Set(reports.map(r => r.theme))],
      overallResults: {
        totalTextElements: 0,
        totalNonTextElements: 0,
        textViolations: 0,
        nonTextViolations: 0,
        passRate: 0
      },
      themeResults: {}
    };
    
    // Calculate overall statistics
    reports.forEach(report => {
      summary.overallResults.totalTextElements += report.results.summary.totalText;
      summary.overallResults.totalNonTextElements += report.results.summary.totalNonText;
      summary.overallResults.textViolations += report.results.summary.textFailed;
      summary.overallResults.nonTextViolations += report.results.summary.nonTextFailed;
      
      if (!summary.themeResults[report.theme]) {
        summary.themeResults[report.theme] = {
          pages: 0,
          violations: 0,
          elements: 0
        };
      }
      
      summary.themeResults[report.theme].pages++;
      summary.themeResults[report.theme].violations += report.results.violations.length;
      summary.themeResults[report.theme].elements += report.results.summary.totalText + report.results.summary.totalNonText;
    });
    
    const totalElements = summary.overallResults.totalTextElements + summary.overallResults.totalNonTextElements;
    const totalViolations = summary.overallResults.textViolations + summary.overallResults.nonTextViolations;
    summary.overallResults.passRate = totalElements > 0 ? ((totalElements - totalViolations) / totalElements * 100).toFixed(2) : 100;
    
    // Generate HTML report
    const htmlReport = this.generateHtmlReport(summary, reports);
    const reportPath = path.join(this.options.reportDir, 'color-contrast-report.html');
    fs.writeFileSync(reportPath, htmlReport);
    
    // Generate JSON report
    const jsonReport = { summary, reports };
    const jsonPath = path.join(this.options.reportDir, 'color-contrast-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    
    console.log(`Color contrast report generated: ${reportPath}`);
    return { htmlPath: reportPath, jsonPath, summary };
  }

  generateHtmlReport(summary, reports) {
    const criticalViolations = reports.flatMap(r => r.results.violations.filter(v => v.contrast < 3.0));
    const seriousViolations = reports.flatMap(r => r.results.violations.filter(v => v.contrast >= 3.0 && v.contrast < 4.5));
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Color Contrast Validation Report - WCAG ${summary.wcagLevel}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .pass { color: #28a745; font-weight: bold; }
        .fail { color: #dc3545; font-weight: bold; }
        .violation { background: #ffe6e6; padding: 15px; margin: 10px 0; border-left: 4px solid #dc3545; }
        .violation.critical { border-left-color: #ff0000; }
        .violation.serious { border-left-color: #ff6600; }
        .color-swatch { display: inline-block; width: 20px; height: 20px; border: 1px solid #ccc; margin-right: 5px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f2f2f2; }
        .theme-section { margin: 30px 0; }
        .stats { display: flex; gap: 20px; margin: 20px 0; }
        .stat-card { background: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; }
        .contrast-ratio { font-family: monospace; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Color Contrast Validation Report</h1>
      <p><strong>WCAG ${summary.wcagLevel} Compliance Check</strong></p>
      
      <div class="summary">
        <h2>Executive Summary</h2>
        <div class="stats">
          <div class="stat-card">
            <h3>Overall Pass Rate</h3>
            <div class="${summary.overallResults.passRate >= 95 ? 'pass' : 'fail'}" style="font-size: 2em;">
              ${summary.overallResults.passRate}%
            </div>
          </div>
          <div class="stat-card">
            <h3>Elements Tested</h3>
            <div style="font-size: 2em;">
              ${summary.overallResults.totalTextElements + summary.overallResults.totalNonTextElements}
            </div>
            <small>${summary.overallResults.totalTextElements} text, ${summary.overallResults.totalNonTextElements} non-text</small>
          </div>
          <div class="stat-card">
            <h3>Violations Found</h3>
            <div class="fail" style="font-size: 2em;">
              ${summary.overallResults.textViolations + summary.overallResults.nonTextViolations}
            </div>
            <small>${summary.overallResults.textViolations} text, ${summary.overallResults.nonTextViolations} non-text</small>
          </div>
        </div>
        
        <h3>Theme Breakdown</h3>
        <table>
          <tr><th>Theme</th><th>Pages</th><th>Elements</th><th>Violations</th><th>Pass Rate</th></tr>
          ${Object.entries(summary.themeResults).map(([theme, results]) => {
            const passRate = results.elements > 0 ? ((results.elements - results.violations) / results.elements * 100).toFixed(1) : 100;
            return `<tr>
              <td>${theme}</td>
              <td>${results.pages}</td>
              <td>${results.elements}</td>
              <td class="${results.violations > 0 ? 'fail' : 'pass'}">${results.violations}</td>
              <td class="${passRate >= 95 ? 'pass' : 'fail'}">${passRate}%</td>
            </tr>`;
          }).join('')}
        </table>
      </div>
      
      ${summary.overallResults.textViolations + summary.overallResults.nonTextViolations > 0 ? `
        <h2>Critical Issues (Contrast < 3.0)</h2>
        ${criticalViolations.map(v => `
          <div class="violation critical">
            <h4>${v.type === 'text' ? 'Text' : 'UI Element'}: ${v.element.tagName}${v.element.className ? '.' + v.element.className : ''}</h4>
            <p><strong>Text:</strong> "${v.text || 'N/A'}"</p>
            <p><strong>Contrast Ratio:</strong> <span class="contrast-ratio">${v.contrast.toFixed(2)}:1</span> (Required: ${v.required}:1)</p>
            <p><strong>Colors:</strong> 
              <span class="color-swatch" style="background-color: rgb(${v.colors.text?.join(',') || v.colors.border?.join(',')});"></span>
              Text/Border vs
              <span class="color-swatch" style="background-color: rgb(${v.colors.background.join(',')});"></span>
              Background
            </p>
          </div>
        `).join('') || '<p>No critical violations found.</p>'}
        
        <h2>Serious Issues (Contrast 3.0-4.5)</h2>
        ${seriousViolations.map(v => `
          <div class="violation serious">
            <h4>${v.type === 'text' ? 'Text' : 'UI Element'}: ${v.element.tagName}${v.element.className ? '.' + v.element.className : ''}</h4>
            <p><strong>Text:</strong> "${v.text || 'N/A'}"</p>
            <p><strong>Contrast Ratio:</strong> <span class="contrast-ratio">${v.contrast.toFixed(2)}:1</span> (Required: ${v.required}:1)</p>
            <p><strong>Colors:</strong> 
              <span class="color-swatch" style="background-color: rgb(${v.colors.text?.join(',') || v.colors.border?.join(',')});"></span>
              Text/Border vs
              <span class="color-swatch" style="background-color: rgb(${v.colors.background.join(',')});"></span>
              Background
            </p>
          </div>
        `).join('') || '<p>No serious violations found.</p>'}
      ` : '<h2 class="pass">✅ No Color Contrast Violations Found!</h2>'}
      
      <h2>Detailed Results by Page</h2>
      ${reports.map(report => `
        <div class="theme-section">
          <h3>${report.pageName} (${report.theme} theme)</h3>
          <p><strong>URL:</strong> ${report.url}</p>
          <p><strong>Elements Tested:</strong> ${report.results.summary.totalText + report.results.summary.totalNonText}</p>
          <p><strong>Violations:</strong> <span class="${report.results.violations.length > 0 ? 'fail' : 'pass'}">${report.results.violations.length}</span></p>
          
          ${report.results.violations.length > 0 ? `
            <h4>Violations:</h4>
            ${report.results.violations.slice(0, 10).map(v => `
              <div class="violation">
                <strong>${v.element.tagName}:</strong> ${v.text || 'UI Element'}
                <br><strong>Ratio:</strong> ${v.contrast.toFixed(2)}:1 (Required: ${v.required}:1)
              </div>
            `).join('')}
            ${report.results.violations.length > 10 ? `<p><em>... and ${report.results.violations.length - 10} more violations</em></p>` : ''}
          ` : '<p class="pass">✅ All elements pass contrast requirements</p>'}
        </div>
      `).join('')}
      
      <hr>
      <p><small>Generated on ${summary.timestamp}</small></p>
      <p><small>WCAG ${summary.wcagLevel} Requirements: Normal text ${summary.wcagLevel === 'AA' ? '4.5' : '7.0'}:1, Large text ${summary.wcagLevel === 'AA' ? '3.0' : '4.5'}:1, UI elements 3.0:1</small></p>
    </body>
    </html>`;
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('Color contrast validator teardown complete');
  }
}

// Main execution function
async function runColorContrastValidation() {
  const validator = new ColorContrastValidator({
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    wcagLevel: process.env.WCAG_LEVEL || 'AA',
    themes: ['light', 'dark', 'high-contrast']
  });

  try {
    await validator.setup();
    const reports = await validator.validateAllPages();
    
    console.log('\\n=== Color Contrast Validation Complete ===');
    console.log(`Total pages tested: ${reports.length}`);
    
    const totalViolations = reports.reduce((sum, r) => sum + r.results.violations.length, 0);
    console.log(`Total violations found: ${totalViolations}`);
    
    if (totalViolations > 0) {
      console.log('❌ Color contrast validation failed');
      process.exit(1);
    } else {
      console.log('✅ All color contrast tests passed');
    }
    
  } catch (error) {
    console.error('Color contrast validation failed:', error);
    process.exit(1);
  } finally {
    await validator.teardown();
  }
}

// Export for use as module or run directly
if (require.main === module) {
  runColorContrastValidation().catch(console.error);
}

module.exports = { ColorContrastValidator };