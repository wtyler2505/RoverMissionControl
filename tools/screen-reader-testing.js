/**
 * Screen Reader Testing Utilities
 * 
 * Automated testing setup for screen reader compatibility
 * Simulates NVDA, JAWS, and VoiceOver behaviors
 */

const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

class ScreenReaderTester {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.options = {
      baseURL: options.baseURL || 'http://localhost:3000',
      screenshotDir: options.screenshotDir || './screenshots/screen-reader',
      reportDir: options.reportDir || './reports/screen-reader',
      timeout: options.timeout || 30000,
      ...options
    };
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  ensureDirectories() {
    [this.options.screenshotDir, this.options.reportDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async setup(browserType = 'chromium') {
    console.log(`Setting up ${browserType} browser for screen reader testing...`);
    
    const browserOptions = {
      headless: false, // Keep visible for debugging
      args: [
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--enable-accessibility-object-model',
        '--force-renderer-accessibility'
      ]
    };

    switch (browserType) {
      case 'chromium':
        this.browser = await chromium.launch(browserOptions);
        break;
      case 'firefox':
        this.browser = await firefox.launch(browserOptions);
        break;
      case 'webkit':
        this.browser = await webkit.launch(browserOptions);
        break;
      default:
        throw new Error(`Unsupported browser type: ${browserType}`);
    }

    this.page = await this.browser.newPage();
    
    // Enable accessibility features
    await this.enableAccessibilityFeatures();
    
    console.log('Screen reader testing setup complete');
  }

  async enableAccessibilityFeatures() {
    // Inject screen reader simulation scripts
    await this.page.addInitScript(() => {
      // Mock screen reader API
      window.screenReaderAPI = {
        announcements: [],
        focusHistory: [],
        
        // Simulate screen reader announcements
        announce(text, priority = 'polite') {
          this.announcements.push({
            text,
            priority,
            timestamp: Date.now()
          });
          
          // Dispatch custom event for testing
          window.dispatchEvent(new CustomEvent('screenreader:announce', {
            detail: { text, priority }
          }));
        },
        
        // Track focus changes
        trackFocus(element) {
          const focusInfo = {
            tagName: element.tagName,
            role: element.getAttribute('role'),
            ariaLabel: element.getAttribute('aria-label'),
            ariaLabelledBy: element.getAttribute('aria-labelledby'),
            textContent: element.textContent?.trim(),
            timestamp: Date.now()
          };
          
          this.focusHistory.push(focusInfo);
          
          window.dispatchEvent(new CustomEvent('screenreader:focus', {
            detail: focusInfo
          }));
        },
        
        // Get accessible name
        getAccessibleName(element) {
          // Simplified accessible name calculation
          const ariaLabel = element.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;
          
          const ariaLabelledBy = element.getAttribute('aria-labelledby');
          if (ariaLabelledBy) {
            const labelElement = document.getElementById(ariaLabelledBy);
            if (labelElement) return labelElement.textContent?.trim();
          }
          
          const textContent = element.textContent?.trim();
          if (textContent) return textContent;
          
          // For form elements, check associated label
          if (element.id) {
            const label = document.querySelector(`label[for="${element.id}"]`);
            if (label) return label.textContent?.trim();
          }
          
          return '';
        },
        
        // Simulate virtual cursor navigation
        virtualCursor: {
          position: 0,
          elements: [],
          
          updateElements() {
            // Get all elements that screen readers would navigate to
            this.elements = Array.from(document.querySelectorAll(`
              h1, h2, h3, h4, h5, h6,
              p, div, span,
              a[href], button, input, select, textarea,
              [role="button"], [role="link"], [role="heading"],
              [tabindex]:not([tabindex="-1"]),
              img[alt], [aria-label], [aria-labelledby]
            `)).filter(el => {
              // Filter out hidden elements
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden';
            });
          },
          
          next() {
            this.updateElements();
            if (this.position < this.elements.length - 1) {
              this.position++;
              return this.elements[this.position];
            }
            return null;
          },
          
          previous() {
            if (this.position > 0) {
              this.position--;
              return this.elements[this.position];
            }
            return null;
          },
          
          current() {
            this.updateElements();
            return this.elements[this.position] || null;
          }
        }
      };
      
      // Monitor aria-live regions
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target;
            const ariaLive = target.getAttribute?.('aria-live') || 
                           target.closest?.('[aria-live]')?.getAttribute('aria-live');
            
            if (ariaLive && target.textContent?.trim()) {
              window.screenReaderAPI.announce(target.textContent.trim(), ariaLive);
            }
          }
        });
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // Track focus events
      document.addEventListener('focusin', (event) => {
        window.screenReaderAPI.trackFocus(event.target);
      });
      
      // Monitor role and aria attribute changes
      const attributeObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'attributes' && 
              (mutation.attributeName?.startsWith('aria-') || 
               mutation.attributeName === 'role')) {
            
            window.dispatchEvent(new CustomEvent('screenreader:attribute-change', {
              detail: {
                element: mutation.target,
                attribute: mutation.attributeName,
                oldValue: mutation.oldValue,
                newValue: mutation.target.getAttribute(mutation.attributeName)
              }
            }));
          }
        });
      });
      
      attributeObserver.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeOldValue: true,
        attributeFilter: [
          'role', 'aria-label', 'aria-labelledby', 'aria-describedby',
          'aria-expanded', 'aria-selected', 'aria-checked', 'aria-disabled',
          'aria-hidden', 'aria-live', 'aria-atomic', 'aria-relevant'
        ]
      });
    });
  }

  async testPage(url, testName) {
    console.log(`Testing page: ${url}`);
    
    const report = {
      url,
      testName,
      timestamp: new Date().toISOString(),
      results: {
        announcements: [],
        focusHistory: [],
        headingStructure: [],
        landmarks: [],
        formLabels: [],
        images: [],
        links: [],
        buttons: [],
        violations: []
      }
    };

    try {
      await this.page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for page to settle
      await this.page.waitForTimeout(2000);
      
      // Test heading structure
      report.results.headingStructure = await this.testHeadingStructure();
      
      // Test landmarks
      report.results.landmarks = await this.testLandmarks();
      
      // Test form labels
      report.results.formLabels = await this.testFormLabels();
      
      // Test images
      report.results.images = await this.testImages();
      
      // Test links
      report.results.links = await this.testLinks();
      
      // Test buttons
      report.results.buttons = await this.testButtons();
      
      // Test keyboard navigation
      await this.testKeyboardNavigation(report);
      
      // Test virtual cursor navigation
      await this.testVirtualCursor(report);
      
      // Test live regions
      await this.testLiveRegions(report);
      
      // Collect screen reader events
      const announcements = await this.page.evaluate(() => {
        return window.screenReaderAPI?.announcements || [];
      });
      
      const focusHistory = await this.page.evaluate(() => {
        return window.screenReaderAPI?.focusHistory || [];
      });
      
      report.results.announcements = announcements;
      report.results.focusHistory = focusHistory;
      
      // Take screenshot
      await this.page.screenshot({
        path: path.join(this.options.screenshotDir, `${testName}-${Date.now()}.png`),
        fullPage: true
      });
      
    } catch (error) {
      report.error = error.message;
      console.error(`Error testing ${url}:`, error);
    }
    
    // Save report
    const reportPath = path.join(this.options.reportDir, `${testName}-report.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  async testHeadingStructure() {
    return await this.page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      return headings.map(heading => ({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent?.trim(),
        id: heading.id,
        hasId: !!heading.id
      }));
    });
  }

  async testLandmarks() {
    return await this.page.evaluate(() => {
      const landmarks = Array.from(document.querySelectorAll(`
        [role="main"], main,
        [role="banner"], header,
        [role="contentinfo"], footer,
        [role="navigation"], nav,
        [role="complementary"], aside,
        [role="search"], [role="form"]
      `));
      
      return landmarks.map(landmark => ({
        role: landmark.getAttribute('role') || landmark.tagName.toLowerCase(),
        ariaLabel: landmark.getAttribute('aria-label'),
        ariaLabelledBy: landmark.getAttribute('aria-labelledby'),
        hasAccessibleName: !!(landmark.getAttribute('aria-label') || 
                             landmark.getAttribute('aria-labelledby') ||
                             landmark.textContent?.trim())
      }));
    });
  }

  async testFormLabels() {
    return await this.page.evaluate(() => {
      const formElements = Array.from(document.querySelectorAll('input, select, textarea'));
      return formElements.map(element => {
        const id = element.getAttribute('id');
        const ariaLabel = element.getAttribute('aria-label');
        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        const associatedLabel = id ? document.querySelector(`label[for="${id}"]`) : null;
        
        return {
          type: element.type || element.tagName.toLowerCase(),
          id,
          hasLabel: !!(ariaLabel || ariaLabelledBy || associatedLabel),
          labelText: ariaLabel || 
                    (ariaLabelledBy ? document.getElementById(ariaLabelledBy)?.textContent : null) ||
                    associatedLabel?.textContent?.trim(),
          required: element.hasAttribute('required') || element.getAttribute('aria-required') === 'true'
        };
      });
    });
  }

  async testImages() {
    return await this.page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images.map(img => ({
        src: img.src,
        alt: img.alt,
        hasAlt: img.hasAttribute('alt'),
        decorative: img.alt === '',
        ariaLabel: img.getAttribute('aria-label'),
        ariaLabelledBy: img.getAttribute('aria-labelledby'),
        role: img.getAttribute('role')
      }));
    });
  }

  async testLinks() {
    return await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href], [role="link"]'));
      return links.map(link => ({
        href: link.href,
        text: link.textContent?.trim(),
        ariaLabel: link.getAttribute('aria-label'),
        hasAccessibleName: !!(link.textContent?.trim() || link.getAttribute('aria-label')),
        opensNewWindow: link.target === '_blank'
      }));
    });
  }

  async testButtons() {
    return await this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      return buttons.map(button => ({
        text: button.textContent?.trim(),
        ariaLabel: button.getAttribute('aria-label'),
        ariaLabelledBy: button.getAttribute('aria-labelledby'),
        hasAccessibleName: !!(button.textContent?.trim() || 
                             button.getAttribute('aria-label') ||
                             button.getAttribute('aria-labelledby')),
        disabled: button.disabled || button.getAttribute('aria-disabled') === 'true',
        type: button.type || 'button'
      }));
    });
  }

  async testKeyboardNavigation(report) {
    console.log('Testing keyboard navigation...');
    
    try {
      // Reset focus
      await this.page.keyboard.press('Tab');
      
      const focusableElements = [];
      
      // Tab through first 20 focusable elements
      for (let i = 0; i < 20; i++) {
        await this.page.keyboard.press('Tab');
        await this.page.waitForTimeout(100);
        
        const focusedElement = await this.page.evaluate(() => {
          const element = document.activeElement;
          if (element && element !== document.body) {
            return {
              tagName: element.tagName,
              type: element.type,
              role: element.getAttribute('role'),
              ariaLabel: element.getAttribute('aria-label'),
              textContent: element.textContent?.trim()?.substring(0, 50),
              className: element.className,
              id: element.id
            };
          }
          return null;
        });
        
        if (focusedElement) {
          focusableElements.push(focusedElement);
        }
      }
      
      report.results.keyboardNavigation = {
        focusableElements,
        totalFocusableFound: focusableElements.length
      };
      
    } catch (error) {
      report.results.keyboardNavigation = {
        error: error.message
      };
    }
  }

  async testVirtualCursor(report) {
    console.log('Testing virtual cursor navigation...');
    
    try {
      const virtualCursorElements = await this.page.evaluate(() => {
        const elements = [];
        window.screenReaderAPI.virtualCursor.updateElements();
        
        // Navigate through first 15 elements
        for (let i = 0; i < 15; i++) {
          const element = window.screenReaderAPI.virtualCursor.next();
          if (element) {
            elements.push({
              tagName: element.tagName,
              role: element.getAttribute('role'),
              accessibleName: window.screenReaderAPI.getAccessibleName(element),
              textContent: element.textContent?.trim()?.substring(0, 100)
            });
          } else {
            break;
          }
        }
        
        return elements;
      });
      
      report.results.virtualCursor = {
        elements: virtualCursorElements,
        totalElements: virtualCursorElements.length
      };
      
    } catch (error) {
      report.results.virtualCursor = {
        error: error.message
      };
    }
  }

  async testLiveRegions(report) {
    console.log('Testing live regions...');
    
    try {
      // Find and interact with elements that should trigger live region updates
      const liveRegionTriggers = await this.page.$$('[data-testid*="refresh"], [data-testid*="update"], button[aria-label*="refresh"]');
      
      if (liveRegionTriggers.length > 0) {
        // Clear previous announcements
        await this.page.evaluate(() => {
          if (window.screenReaderAPI) {
            window.screenReaderAPI.announcements = [];
          }
        });
        
        // Click first trigger
        await liveRegionTriggers[0].click();
        await this.page.waitForTimeout(2000);
        
        // Check for announcements
        const announcements = await this.page.evaluate(() => {
          return window.screenReaderAPI?.announcements || [];
        });
        
        report.results.liveRegions = {
          triggersFound: liveRegionTriggers.length,
          announcements: announcements
        };
      } else {
        report.results.liveRegions = {
          triggersFound: 0,
          announcements: []
        };
      }
      
    } catch (error) {
      report.results.liveRegions = {
        error: error.message
      };
    }
  }

  async generateReport(reports) {
    console.log('Generating comprehensive screen reader report...');
    
    const summary = {
      totalPages: reports.length,
      timestamp: new Date().toISOString(),
      overallResults: {
        headings: 0,
        landmarks: 0,
        unlabegedForms: 0,
        imagesWithoutAlt: 0,
        inaccessibleButtons: 0,
        announcements: 0
      }
    };
    
    reports.forEach(report => {
      if (report.results.headingStructure) {
        summary.overallResults.headings += report.results.headingStructure.length;
      }
      if (report.results.landmarks) {
        summary.overallResults.landmarks += report.results.landmarks.length;
      }
      if (report.results.formLabels) {
        summary.overallResults.unlabegedForms += report.results.formLabels.filter(f => !f.hasLabel).length;
      }
      if (report.results.images) {
        summary.overallResults.imagesWithoutAlt += report.results.images.filter(i => !i.hasAlt && !i.decorative).length;
      }
      if (report.results.buttons) {
        summary.overallResults.inaccessibleButtons += report.results.buttons.filter(b => !b.hasAccessibleName).length;
      }
      if (report.results.announcements) {
        summary.overallResults.announcements += report.results.announcements.length;
      }
    });
    
    const reportHtml = this.generateHtmlReport(summary, reports);
    const reportPath = path.join(this.options.reportDir, 'screen-reader-report.html');
    fs.writeFileSync(reportPath, reportHtml);
    
    console.log(`Screen reader report generated: ${reportPath}`);
    return reportPath;
  }

  generateHtmlReport(summary, reports) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Screen Reader Testing Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .report-section { margin: 20px 0; }
        .violation { background: #ffe6e6; padding: 10px; margin: 5px 0; border-left: 4px solid #ff0000; }
        .success { background: #e6ffe6; padding: 10px; margin: 5px 0; border-left: 4px solid #00ff00; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Screen Reader Testing Report</h1>
      
      <div class="summary">
        <h2>Summary</h2>
        <p><strong>Generated:</strong> ${summary.timestamp}</p>
        <p><strong>Pages Tested:</strong> ${summary.totalPages}</p>
        <ul>
          <li>Total Headings: ${summary.overallResults.headings}</li>
          <li>Total Landmarks: ${summary.overallResults.landmarks}</li>
          <li>Unlabeled Form Fields: ${summary.overallResults.unlabegedForms}</li>
          <li>Images Without Alt Text: ${summary.overallResults.imagesWithoutAlt}</li>
          <li>Inaccessible Buttons: ${summary.overallResults.inaccessibleButtons}</li>
          <li>Screen Reader Announcements: ${summary.overallResults.announcements}</li>
        </ul>
      </div>
      
      ${reports.map(report => `
        <div class="report-section">
          <h2>Page: ${report.url}</h2>
          <h3>Heading Structure</h3>
          <table>
            <tr><th>Level</th><th>Text</th><th>Has ID</th></tr>
            ${report.results.headingStructure?.map(h => `
              <tr><td>H${h.level}</td><td>${h.text || 'No text'}</td><td>${h.hasId}</td></tr>
            `).join('') || '<tr><td colspan="3">No headings found</td></tr>'}
          </table>
          
          <h3>Form Labels</h3>
          ${report.results.formLabels?.map(f => `
            <div class="${f.hasLabel ? 'success' : 'violation'}">
              ${f.type} field: ${f.hasLabel ? 'Properly labeled' : 'Missing label'} - "${f.labelText || 'No label'}"
            </div>
          `).join('') || '<p>No form fields found</p>'}
          
          <h3>Screen Reader Announcements</h3>
          ${report.results.announcements?.map(a => `
            <div class="success">
              [${a.priority}] ${a.text}
            </div>
          `).join('') || '<p>No announcements recorded</p>'}
        </div>
      `).join('')}
      
    </body>
    </html>`;
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
    console.log('Screen reader testing teardown complete');
  }
}

// Main execution function
async function runScreenReaderTests() {
  const tester = new ScreenReaderTester({
    baseURL: process.env.BASE_URL || 'http://localhost:3000'
  });

  const testPages = [
    { url: '/', name: 'homepage' },
    { url: '/hal-dashboard', name: 'hal-dashboard' },
    { url: '/device-discovery', name: 'device-discovery' },
    { url: '/telemetry', name: 'telemetry' }
  ];

  const reports = [];

  try {
    await tester.setup('chromium');

    for (const { url, name } of testPages) {
      const fullUrl = `${tester.options.baseURL}${url}`;
      const report = await tester.testPage(fullUrl, name);
      reports.push(report);
    }

    await tester.generateReport(reports);
    
  } catch (error) {
    console.error('Screen reader testing failed:', error);
    process.exit(1);
  } finally {
    await tester.teardown();
  }
}

// Export for use as module or run directly
if (require.main === module) {
  runScreenReaderTests().catch(console.error);
}

module.exports = { ScreenReaderTester };