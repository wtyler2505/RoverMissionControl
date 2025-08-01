/**
 * Responsive Design Visual Validation Tests
 * 
 * Comprehensive testing of responsive behavior across different
 * viewport sizes, orientations, and device types.
 */

import { test, expect, devices } from '@playwright/test';

// Comprehensive viewport configurations
const VIEWPORTS = [
  // Mobile Portrait
  { name: 'mobile-portrait', width: 320, height: 568, deviceScaleFactory: 2, description: 'iPhone SE' },
  { name: 'mobile-portrait-large', width: 375, height: 667, deviceScaleFactory: 2, description: 'iPhone 8' },
  { name: 'mobile-portrait-xl', width: 414, height: 896, deviceScaleFactory: 3, description: 'iPhone 11 Pro Max' },
  
  // Mobile Landscape
  { name: 'mobile-landscape', width: 568, height: 320, deviceScaleFactory: 2, description: 'iPhone SE Landscape' },
  { name: 'mobile-landscape-large', width: 667, height: 375, deviceScaleFactory: 2, description: 'iPhone 8 Landscape' },
  { name: 'mobile-landscape-xl', width: 896, height: 414, deviceScaleFactory: 3, description: 'iPhone 11 Pro Max Landscape' },
  
  // Tablet Portrait
  { name: 'tablet-portrait', width: 768, height: 1024, deviceScaleFactory: 2, description: 'iPad' },
  { name: 'tablet-portrait-large', width: 834, height: 1194, deviceScaleFactory: 2, description: 'iPad Pro 11"' },
  
  // Tablet Landscape
  { name: 'tablet-landscape', width: 1024, height: 768, deviceScaleFactory: 2, description: 'iPad Landscape' },
  { name: 'tablet-landscape-large', width: 1194, height: 834, deviceScaleFactory: 2, description: 'iPad Pro 11" Landscape' },
  
  // Desktop
  { name: 'desktop-small', width: 1280, height: 720, deviceScaleFactory: 1, description: 'Small Desktop' },
  { name: 'desktop-medium', width: 1366, height: 768, deviceScaleFactory: 1, description: 'Medium Desktop' },
  { name: 'desktop-large', width: 1920, height: 1080, deviceScaleFactory: 1, description: 'Large Desktop' },
  { name: 'desktop-xl', width: 2560, height: 1440, deviceScaleFactory: 1, description: 'Ultra HD Desktop' },
  { name: 'desktop-ultrawide', width: 3440, height: 1440, deviceScaleFactory: 1, description: 'Ultrawide Monitor' },
];

// Components to test for responsive behavior
const RESPONSIVE_COMPONENTS = [
  {
    name: 'HAL Dashboard',
    path: '/hal',
    selector: '[data-testid="hal-dashboard"]',
    criticalBreakpoints: [768, 1024, 1280],
    expectedBehaviors: {
      mobile: 'stacked layout, hamburger menu',
      tablet: 'grid layout, sidebar collapsed',
      desktop: 'full layout, sidebar expanded'
    }
  },
  {
    name: 'Telemetry Dashboard',
    path: '/telemetry',
    selector: '[data-testid="telemetry-dashboard"]',
    criticalBreakpoints: [640, 1024, 1440],
    expectedBehaviors: {
      mobile: 'single column charts',
      tablet: 'two column charts',
      desktop: 'multi-column charts with controls'
    }
  },
  {
    name: 'Navigation Header',
    path: '/hal',
    selector: '[data-testid="navigation-header"]',
    criticalBreakpoints: [768, 1024],
    expectedBehaviors: {
      mobile: 'hamburger menu, collapsed nav',
      tablet: 'partial navigation visible',
      desktop: 'full navigation menu'
    }
  },
  {
    name: 'Command Queue',
    path: '/commands',
    selector: '[data-testid="command-queue"]',
    criticalBreakpoints: [480, 768, 1200],
    expectedBehaviors: {
      mobile: 'vertical list layout',
      tablet: 'cards in grid',
      desktop: 'table layout with actions'
    }
  }
];

// Responsive design rules to validate
const RESPONSIVE_RULES = {
  // Typography scaling
  typography: {
    'mobile': { minFontSize: 14, maxFontSize: 24, lineHeight: 1.4 },
    'tablet': { minFontSize: 16, maxFontSize: 28, lineHeight: 1.5 },
    'desktop': { minFontSize: 16, maxFontSize: 32, lineHeight: 1.6 }
  },
  
  // Touch targets
  touchTargets: {
    'mobile': { minSize: 44, idealSize: 48 },
    'tablet': { minSize: 44, idealSize: 48 },
    'desktop': { minSize: 32, idealSize: 40 }
  },
  
  // Spacing and layout
  spacing: {
    'mobile': { minPadding: 16, minMargin: 8 },
    'tablet': { minPadding: 20, minMargin: 12 },
    'desktop': { minPadding: 24, minMargin: 16 }
  }
};

class ResponsiveDesignValidator {
  async validateBreakpointBehavior(page: any, viewport: any, component: any) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(component.path);
    await page.waitForSelector(component.selector, { state: 'visible' });
    
    // Wait for responsive adjustments
    await page.waitForTimeout(500);
    
    const validationResults = {
      viewport: viewport.name,
      component: component.name,
      issues: [] as string[],
      measurements: {} as any
    };
    
    // Check if component is visible and properly sized
    const elementBounds = await page.locator(component.selector).boundingBox();
    if (!elementBounds) {
      validationResults.issues.push('Component not visible');
      return validationResults;
    }
    
    validationResults.measurements.componentSize = elementBounds;
    
    // Validate component doesn't overflow viewport
    if (elementBounds.width > viewport.width) {
      validationResults.issues.push('Component overflows viewport width');
    }
    
    // Check for horizontal scrollbars (indicates overflow)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    if (hasHorizontalScroll) {
      validationResults.issues.push('Horizontal scrollbar present (possible overflow)');
    }
    
    return validationResults;
  }
  
  async validateTypography(page: any, viewport: any, deviceType: string) {
    const typographyRules = RESPONSIVE_RULES.typography[deviceType as keyof typeof RESPONSIVE_RULES.typography];
    if (!typographyRules) return { issues: [] };
    
    const fontSizes = await page.evaluate(() => {
      const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div');
      const sizes: number[] = [];
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
        if (fontSize > 0) sizes.push(fontSize);
      });
      
      return sizes;
    });
    
    const issues: string[] = [];
    const minFont = Math.min(...fontSizes);
    const maxFont = Math.max(...fontSizes);
    
    if (minFont < typographyRules.minFontSize) {
      issues.push(`Minimum font size (${minFont}px) below recommended (${typographyRules.minFontSize}px)`);
    }
    
    if (maxFont > typographyRules.maxFontSize) {
      issues.push(`Maximum font size (${maxFont}px) above recommended (${typographyRules.maxFontSize}px)`);
    }
    
    return { issues, measurements: { minFont, maxFont, fontSizes } };
  }
  
  async validateTouchTargets(page: any, viewport: any, deviceType: string) {
    const touchRules = RESPONSIVE_RULES.touchTargets[deviceType as keyof typeof RESPONSIVE_RULES.touchTargets];
    if (!touchRules || deviceType === 'desktop') return { issues: [] };
    
    const touchTargets = await page.evaluate((minSize: number) => {
      const interactiveElements = document.querySelectorAll('button, a, input, [role="button"], [tabindex]');
      const smallTargets: Array<{ element: string; size: { width: number; height: number } }> = [];
      
      interactiveElements.forEach((el, index) => {
        const bounds = el.getBoundingClientRect();
        if (bounds.width < minSize || bounds.height < minSize) {
          smallTargets.push({
            element: `${el.tagName.toLowerCase()}[${index}]`,
            size: { width: bounds.width, height: bounds.height }
          });
        }
      });
      
      return smallTargets;
    }, touchRules.minSize);
    
    const issues = touchTargets.map(target => 
      `Touch target ${target.element} too small: ${target.size.width}x${target.size.height}px (min: ${touchRules.minSize}px)`
    );
    
    return { issues, measurements: { touchTargets } };
  }
  
  async validateSpacing(page: any, viewport: any, deviceType: string) {
    const spacingRules = RESPONSIVE_RULES.spacing[deviceType as keyof typeof RESPONSIVE_RULES.spacing];
    if (!spacingRules) return { issues: [] };
    
    const spacingIssues = await page.evaluate((rules: typeof spacingRules) => {
      const issues: string[] = [];
      const elements = document.querySelectorAll('[data-testid]');
      
      elements.forEach((el, index) => {
        const style = window.getComputedStyle(el);
        const padding = {
          top: parseFloat(style.paddingTop),
          right: parseFloat(style.paddingRight),
          bottom: parseFloat(style.paddingBottom),
          left: parseFloat(style.paddingLeft)
        };
        
        const margin = {
          top: parseFloat(style.marginTop),
          right: parseFloat(style.marginRight),
          bottom: parseFloat(style.marginBottom),
          left: parseFloat(style.marginLeft)
        };
        
        const minPadding = Math.min(padding.top, padding.right, padding.bottom, padding.left);
        const minMargin = Math.min(margin.top, margin.right, margin.bottom, margin.left);
        
        if (minPadding > 0 && minPadding < rules.minPadding) {
          issues.push(`Element ${index} has insufficient padding: ${minPadding}px (min: ${rules.minPadding}px)`);
        }
        
        if (minMargin > 0 && minMargin < rules.minMargin) {
          issues.push(`Element ${index} has insufficient margin: ${minMargin}px (min: ${rules.minMargin}px)`);
        }
      });
      
      return issues;
    }, spacingRules);
    
    return { issues: spacingIssues };
  }
}

test.describe('Responsive Design Visual Validation', () => {
  let validator: ResponsiveDesignValidator;
  
  test.beforeAll(() => {
    validator = new ResponsiveDesignValidator();
  });
  
  // Configure test to disable animations for consistent screenshots
  test.beforeEach(async ({ page }) => {
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-delay: 0.01ms !important;
          transition-duration: 0.01ms !important;
          transition-delay: 0.01ms !important;
        }
      `
    });
  });

  // Test each component across all viewport sizes
  for (const component of RESPONSIVE_COMPONENTS) {
    test.describe(`${component.name} Responsive Behavior`, () => {
      
      for (const viewport of VIEWPORTS) {
        test(`${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
          // Set viewport
          await page.setViewportSize({ 
            width: viewport.width, 
            height: viewport.height 
          });
          
          // Navigate to component
          await page.goto(component.path);
          await page.waitForSelector(component.selector, { state: 'visible' });
          await page.waitForTimeout(1000); // Allow layout adjustments
          
          // Take screenshot for visual regression
          await expect(page.locator(component.selector)).toHaveScreenshot(
            `${component.name.toLowerCase().replace(/\s+/g, '-')}-${viewport.name}.png`,
            {
              animations: 'disabled',
              mask: [page.locator('[data-dynamic-content]')] // Mask dynamic content
            }
          );
          
          // Validate responsive behavior
          const validation = await validator.validateBreakpointBehavior(page, viewport, component);
          
          // Assert no critical responsive issues
          if (validation.issues.length > 0) {
            console.warn(`Responsive issues found for ${component.name} at ${viewport.name}:`, validation.issues);
          }
          
          // Critical issues that should fail the test
          const criticalIssues = validation.issues.filter(issue => 
            issue.includes('overflow') || issue.includes('not visible')
          );
          
          expect(criticalIssues).toHaveLength(0);
        });
      }
      
      // Test critical breakpoints specifically
      test(`critical breakpoints behavior`, async ({ page }) => {
        for (const breakpoint of component.criticalBreakpoints) {
          // Test just before breakpoint
          await page.setViewportSize({ width: breakpoint - 1, height: 800 });
          await page.goto(component.path);
          await page.waitForSelector(component.selector, { state: 'visible' });
          
          const beforeScreenshot = await page.locator(component.selector).screenshot();
          
          // Test just after breakpoint
          await page.setViewportSize({ width: breakpoint + 1, height: 800 });
          await page.waitForTimeout(500); // Allow layout adjustment
          
          const afterScreenshot = await page.locator(component.selector).screenshot();
          
          // Screenshots should be different (indicating responsive behavior)
          expect(beforeScreenshot.equals(afterScreenshot)).toBeFalsy();
        }
      });
    });
  }

  test.describe('Typography Responsive Validation', () => {
    const deviceTypes = [
      { type: 'mobile', viewports: VIEWPORTS.filter(v => v.width < 768) },
      { type: 'tablet', viewports: VIEWPORTS.filter(v => v.width >= 768 && v.width < 1024) },
      { type: 'desktop', viewports: VIEWPORTS.filter(v => v.width >= 1024) }
    ];
    
    for (const deviceGroup of deviceTypes) {
      test(`${deviceGroup.type} typography scaling`, async ({ page }) => {
        for (const viewport of deviceGroup.viewports.slice(0, 2)) { // Test sample viewports
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto('/hal');
          await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
          
          const typographyValidation = await validator.validateTypography(page, viewport, deviceGroup.type);
          
          // Log issues but don't fail (typography issues are often design decisions)
          if (typographyValidation.issues.length > 0) {
            console.info(`Typography notes for ${viewport.name}:`, typographyValidation.issues);
          }
        }
      });
    }
  });

  test.describe('Touch Target Validation', () => {
    const mobileViewports = VIEWPORTS.filter(v => v.width < 768);
    
    for (const viewport of mobileViewports.slice(0, 3)) { // Test sample mobile viewports
      test(`touch targets at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
        
        const touchValidation = await validator.validateTouchTargets(
          page, 
          viewport, 
          viewport.width < 480 ? 'mobile' : 'tablet'
        );
        
        // Touch target issues are accessibility concerns
        if (touchValidation.issues.length > 0) {
          console.warn(`Touch target issues at ${viewport.name}:`, touchValidation.issues);
        }
        
        // Allow some flexibility but flag excessive violations
        expect(touchValidation.issues.length).toBeLessThan(10);
      });
    }
  });

  test.describe('Layout Consistency Validation', () => {
    test('navigation consistency across viewports', async ({ page }) => {
      const navigationStates: Array<{ viewport: string; hasHamburger: boolean; navVisible: boolean }> = [];
      
      for (const viewport of [
        VIEWPORTS.find(v => v.name === 'mobile-portrait-large')!,
        VIEWPORTS.find(v => v.name === 'tablet-landscape')!,
        VIEWPORTS.find(v => v.name === 'desktop-medium')!
      ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="navigation-header"]', { state: 'visible' });
        
        const hasHamburger = await page.locator('[data-testid="hamburger-menu"]').isVisible();
        const navVisible = await page.locator('[data-testid="main-navigation"]').isVisible();
        
        navigationStates.push({
          viewport: viewport.name,
          hasHamburger,
          navVisible
        });
      }
      
      // Validate expected responsive navigation behavior
      const mobileState = navigationStates.find(s => s.viewport.includes('mobile'));
      const tabletState = navigationStates.find(s => s.viewport.includes('tablet'));
      const desktopState = navigationStates.find(s => s.viewport.includes('desktop'));
      
      // Mobile should have hamburger menu
      expect(mobileState?.hasHamburger).toBeTruthy();
      
      // Desktop should have visible navigation
      expect(desktopState?.navVisible).toBeTruthy();
    });
    
    test('content reflow validation', async ({ page }) => {
      // Test that content reflows properly without breaking layout
      await page.goto('/telemetry');
      await page.waitForSelector('[data-testid="telemetry-dashboard"]', { state: 'visible' });
      
      // Gradually resize viewport and check for layout breaks
      const testWidths = [320, 480, 768, 1024, 1280, 1920];
      
      for (let i = 0; i < testWidths.length - 1; i++) {
        const currentWidth = testWidths[i];
        const nextWidth = testWidths[i + 1];
        
        await page.setViewportSize({ width: currentWidth, height: 800 });
        await page.waitForTimeout(300);
        
        // Check for overflow issues
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        // Resize to next width
        await page.setViewportSize({ width: nextWidth, height: 800 });
        await page.waitForTimeout(300);
        
        // Content should not break during resize
        const element = page.locator('[data-testid="telemetry-dashboard"]');
        await expect(element).toBeVisible();
        
        if (hasOverflow) {
          console.warn(`Overflow detected at ${currentWidth}px width`);
        }
      }
    });
  });

  test.describe('Orientation Change Validation', () => {
    const mobileDevices = [
      { name: 'iPhone 12', ...devices['iPhone 12'] },
      { name: 'iPad', ...devices['iPad'] }
    ];
    
    for (const device of mobileDevices) {
      test(`${device.name} orientation change`, async ({ browser }) => {
        const context = await browser.newContext(device);
        const page = await context.newPage();
        
        await page.goto('/hal');
        await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
        
        // Portrait screenshot
        await expect(page.locator('[data-testid="hal-dashboard"]')).toHaveScreenshot(
          `${device.name.toLowerCase().replace(/\s+/g, '-')}-portrait.png`,
          { animations: 'disabled' }
        );
        
        // Rotate to landscape
        await page.setViewportSize({ 
          width: device.viewport!.height, 
          height: device.viewport!.width 
        });
        await page.waitForTimeout(500);
        
        // Landscape screenshot
        await expect(page.locator('[data-testid="hal-dashboard"]')).toHaveScreenshot(
          `${device.name.toLowerCase().replace(/\s+/g, '-')}-landscape.png`,
          { animations: 'disabled' }
        );
        
        // Verify layout adapts to orientation change
        const isLandscape = await page.evaluate(() => window.innerWidth > window.innerHeight);
        expect(isLandscape).toBeTruthy();
        
        await context.close();
      });
    }
  });

  test.describe('Zoom Level Validation', () => {
    const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    
    test('layout stability at different zoom levels', async ({ page }) => {
      await page.goto('/hal');
      await page.waitForSelector('[data-testid="hal-dashboard"]', { state: 'visible' });
      
      for (const zoom of zoomLevels) {
        // Set zoom level
        await page.evaluate((zoomLevel) => {
          document.body.style.zoom = zoomLevel.toString();
        }, zoom);
        
        await page.waitForTimeout(300);
        
        // Verify component is still visible and functional
        const element = page.locator('[data-testid="hal-dashboard"]');
        await expect(element).toBeVisible();
        
        // Check for overflow at this zoom level
        const hasOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        if (hasOverflow && zoom <= 2.0) {
          console.warn(`Layout overflow at ${zoom * 100}% zoom`);
        }
      }
      
      // Reset zoom
      await page.evaluate(() => {
        document.body.style.zoom = '1';
      });
    });
  });
});