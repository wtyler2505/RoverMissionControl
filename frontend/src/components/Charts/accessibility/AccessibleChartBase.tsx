/**
 * Accessible Chart Base Component
 * Base class for all accessibility-enhanced telemetry charts
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@mui/material/styles';
import { Box, Button, Typography } from '@mui/material';

import AccessibilityEnhancer, { AccessibilityOptions, FocusableElement } from './AccessibilityEnhancer';
import ColorContrastAnalyzer, { ColorPalette } from './ColorContrastAnalyzer';
import { BaseChartProps } from '../types';

export interface AccessibleChartProps extends BaseChartProps {
  accessibility?: Partial<AccessibilityOptions>;
  colorPalette?: string | ColorPalette;
  highContrast?: boolean;
  reducedMotion?: boolean;
  screenReaderMode?: boolean;
}

interface AccessibleChartState {
  focusedElement: FocusableElement | null;
  accessibilityMode: 'default' | 'screen-reader' | 'keyboard-only' | 'high-contrast';
  currentPalette: ColorPalette;
  contrastRatios: Map<string, number>;
}

export abstract class AccessibleChartBase<P extends AccessibleChartProps = AccessibleChartProps> 
  extends React.Component<P, AccessibleChartState> {
  
  protected containerRef = React.createRef<HTMLDivElement>();
  protected chartRef = React.createRef<SVGSVGElement>();
  protected canvasRef = React.createRef<HTMLCanvasElement>();
  
  protected svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  protected canvas: CanvasRenderingContext2D | null = null;
  protected focusableElements: FocusableElement[] = [];
  
  // Accessibility-specific properties
  protected ariaLiveRegion: HTMLDivElement | null = null;
  protected keyboardHandler: ((event: KeyboardEvent) => void) | null = null;
  
  constructor(props: P) {
    super(props);
    
    const defaultAccessibility: AccessibilityOptions = {
      enabled: true,
      screenReaderOptimized: false,
      highContrast: false,
      reducedMotion: false,
      colorBlindFriendly: true,
      keyboardNavigation: true,
      liveRegions: true,
      alternativeFormats: true
    };

    const palette = this.resolvePalette(props.colorPalette);

    this.state = {
      focusedElement: null,
      accessibilityMode: 'default',
      currentPalette: palette,
      contrastRatios: new Map()
    };
  }

  componentDidMount() {
    this.initializeAccessibility();
    this.setupChart();
    this.validateColorContrast();
  }

  componentDidUpdate(prevProps: P) {
    if (prevProps.data !== this.props.data) {
      this.updateChart();
      this.updateAccessibilityFeatures();
    }

    if (prevProps.accessibility !== this.props.accessibility ||
        prevProps.highContrast !== this.props.highContrast ||
        prevProps.reducedMotion !== this.props.reducedMotion) {
      this.updateAccessibilityMode();
    }

    if (prevProps.colorPalette !== this.props.colorPalette) {
      const newPalette = this.resolvePalette(this.props.colorPalette);
      this.setState({ currentPalette: newPalette }, () => {
        this.validateColorContrast();
        this.updateChart();
      });
    }
  }

  componentWillUnmount() {
    this.cleanup();
  }

  /**
   * Initialize accessibility features
   */
  protected initializeAccessibility() {
    if (!this.containerRef.current) return;

    const options = this.getAccessibilityOptions();
    
    if (options.enabled) {
      this.setupAriaAttributes();
      this.setupKeyboardNavigation();
      this.setupLiveRegions();
      this.detectAccessibilityMode();
    }
  }

  /**
   * Setup ARIA attributes for the chart
   */
  protected setupAriaAttributes() {
    if (!this.chartRef.current && !this.canvasRef.current) return;

    const chartElement = this.chartRef.current || this.canvasRef.current;
    if (!chartElement) return;

    // Basic ARIA attributes
    chartElement.setAttribute('role', 'img');
    chartElement.setAttribute('aria-label', this.generateAriaLabel());
    
    // Add description
    const descriptionId = `chart-desc-${Date.now()}`;
    chartElement.setAttribute('aria-describedby', descriptionId);
    
    // Create description element
    const description = document.createElement('div');
    description.id = descriptionId;
    description.className = 'sr-only';
    description.textContent = this.generateDataSummary();
    
    if (this.containerRef.current) {
      this.containerRef.current.appendChild(description);
    }

    // Make focusable for keyboard navigation
    chartElement.setAttribute('tabindex', '0');
  }

  /**
   * Setup keyboard navigation
   */
  protected setupKeyboardNavigation() {
    if (!this.containerRef.current) return;
    
    const options = this.getAccessibilityOptions();
    if (!options.keyboardNavigation) return;

    this.keyboardHandler = this.handleKeyboardEvent.bind(this);
    this.containerRef.current.addEventListener('keydown', this.keyboardHandler);
    this.containerRef.current.addEventListener('focus', this.handleFocus.bind(this));
    this.containerRef.current.addEventListener('blur', this.handleBlur.bind(this));
  }

  /**
   * Setup live regions for screen reader announcements
   */
  protected setupLiveRegions() {
    const options = this.getAccessibilityOptions();
    if (!options.liveRegions || !this.containerRef.current) return;

    this.ariaLiveRegion = document.createElement('div');
    this.ariaLiveRegion.setAttribute('aria-live', 'polite');
    this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
    this.ariaLiveRegion.className = 'sr-only';
    this.containerRef.current.appendChild(this.ariaLiveRegion);
  }

  /**
   * Detect user's accessibility preferences
   */
  protected detectAccessibilityMode() {
    // Check for high contrast preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      this.setState({ accessibilityMode: 'high-contrast' });
    }

    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.applyReducedMotion();
    }

    // Check for screen reader (simplified detection)
    if (navigator.userAgent.includes('NVDA') || navigator.userAgent.includes('JAWS')) {
      this.setState({ accessibilityMode: 'screen-reader' });
    }
  }

  /**
   * Handle keyboard events
   */
  protected handleKeyboardEvent(event: KeyboardEvent) {
    const { key, ctrlKey, shiftKey, altKey } = event;
    
    switch (key) {
      case 'ArrowRight':
        event.preventDefault();
        this.navigateNext();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.navigatePrevious();
        break;
      case 'Home':
        event.preventDefault();
        this.navigateToFirst();
        break;
      case 'End':
        event.preventDefault();
        this.navigateToLast();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.activateCurrentElement();
        break;
      case 'Escape':
        event.preventDefault();
        this.exitFocusMode();
        break;
      case '+':
      case '=':
        if (ctrlKey) {
          event.preventDefault();
          this.zoomIn();
        }
        break;
      case '-':
        if (ctrlKey) {
          event.preventDefault();
          this.zoomOut();
        }
        break;
      case '0':
        if (ctrlKey) {
          event.preventDefault();
          this.resetZoom();
        }
        break;
      case 'h':
        if (altKey) {
          event.preventDefault();
          this.toggleHighContrast();
        }
        break;
      case 's':
        if (altKey) {
          event.preventDefault();
          this.announceDataSummary();
        }
        break;
    }
  }

  /**
   * Navigation methods
   */
  protected navigateNext() {
    const currentIndex = this.getCurrentFocusIndex();
    const nextIndex = Math.min(currentIndex + 1, this.focusableElements.length - 1);
    this.focusElement(nextIndex);
  }

  protected navigatePrevious() {
    const currentIndex = this.getCurrentFocusIndex();
    const prevIndex = Math.max(currentIndex - 1, 0);
    this.focusElement(prevIndex);
  }

  protected navigateToFirst() {
    this.focusElement(0);
  }

  protected navigateToLast() {
    this.focusElement(this.focusableElements.length - 1);
  }

  protected activateCurrentElement() {
    const { focusedElement } = this.state;
    if (!focusedElement) return;

    if (focusedElement.type === 'data-point') {
      this.onDataPointActivate(focusedElement);
    } else if (focusedElement.type === 'control') {
      this.onControlActivate(focusedElement);
    }

    this.announceToScreenReader(`Activated: ${focusedElement.ariaLabel}`);
  }

  protected exitFocusMode() {
    this.setState({ focusedElement: null });
    this.removeFocusIndicator();
  }

  /**
   * Zoom methods
   */
  protected abstract zoomIn(): void;
  protected abstract zoomOut(): void;
  protected abstract resetZoom(): void;

  /**
   * Focus management
   */
  protected handleFocus() {
    if (this.focusableElements.length > 0 && !this.state.focusedElement) {
      this.focusElement(0);
    }
  }

  protected handleBlur() {
    this.setState({ focusedElement: null });
    this.removeFocusIndicator();
  }

  protected focusElement(index: number) {
    if (index < 0 || index >= this.focusableElements.length) return;

    const element = this.focusableElements[index];
    this.setState({ focusedElement: element });
    
    this.addFocusIndicator(element.element);
    this.announceToScreenReader(element.ariaLabel + (element.description ? '. ' + element.description : ''));
    
    // Scroll into view if needed
    element.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  protected getCurrentFocusIndex(): number {
    const { focusedElement } = this.state;
    if (!focusedElement) return -1;
    return this.focusableElements.findIndex(el => el.element === focusedElement.element);
  }

  protected addFocusIndicator(element: HTMLElement) {
    this.removeFocusIndicator();
    element.classList.add('accessibility-focused');
    element.style.outline = '2px solid #1976d2';
    element.style.outlineOffset = '2px';
  }

  protected removeFocusIndicator() {
    const focused = this.containerRef.current?.querySelector('.accessibility-focused');
    if (focused) {
      focused.classList.remove('accessibility-focused');
      (focused as HTMLElement).style.outline = '';
      (focused as HTMLElement).style.outlineOffset = '';
    }
  }

  /**
   * Screen reader announcements
   */
  protected announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.ariaLiveRegion) return;
    
    this.ariaLiveRegion.setAttribute('aria-live', priority);
    this.ariaLiveRegion.textContent = '';
    
    // Delay to ensure screen reader picks up the change
    setTimeout(() => {
      if (this.ariaLiveRegion) {
        this.ariaLiveRegion.textContent = message;
      }
    }, 100);
  }

  protected announceDataSummary() {
    const summary = this.generateDataSummary();
    this.announceToScreenReader(summary, 'assertive');
  }

  /**
   * Accessibility mode methods
   */
  protected updateAccessibilityMode() {
    const options = this.getAccessibilityOptions();
    
    if (options.highContrast || this.props.highContrast) {
      this.applyHighContrastMode();
    }
    
    if (options.reducedMotion || this.props.reducedMotion) {
      this.applyReducedMotion();
    }
    
    if (options.screenReaderOptimized || this.props.screenReaderMode) {
      this.applyScreenReaderOptimizations();
    }
  }

  protected applyHighContrastMode() {
    if (!this.containerRef.current) return;
    
    this.containerRef.current.classList.add('high-contrast-mode');
    
    // Use high contrast palette
    const highContrastPalette = ColorContrastAnalyzer.ACCESSIBLE_PALETTES.find(p => p.highContrast);
    if (highContrastPalette) {
      this.setState({ currentPalette: highContrastPalette }, () => {
        this.updateChart();
      });
    }
  }

  protected applyReducedMotion() {
    if (!this.containerRef.current) return;
    
    this.containerRef.current.classList.add('reduced-motion');
    
    // Disable or minimize animations
    const style = document.createElement('style');
    style.textContent = `
      .reduced-motion *, 
      .reduced-motion *::before, 
      .reduced-motion *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    `;
    document.head.appendChild(style);
  }

  protected applyScreenReaderOptimizations() {
    this.setState({ accessibilityMode: 'screen-reader' });
    
    // Enhance ARIA labels and descriptions
    this.updateAriaAttributes();
    
    // Increase frequency of live region updates
    this.setupEnhancedLiveRegions();
  }

  protected toggleHighContrast() {
    const isHighContrast = this.containerRef.current?.classList.contains('high-contrast-mode');
    
    if (isHighContrast) {
      this.containerRef.current?.classList.remove('high-contrast-mode');
      const defaultPalette = this.resolvePalette(this.props.colorPalette);
      this.setState({ currentPalette: defaultPalette }, () => this.updateChart());
    } else {
      this.applyHighContrastMode();
    }
    
    this.announceToScreenReader(
      isHighContrast ? 'High contrast mode disabled' : 'High contrast mode enabled'
    );
  }

  /**
   * Color and contrast methods
   */
  protected resolvePalette(paletteSpec?: string | ColorPalette): ColorPalette {
    if (typeof paletteSpec === 'object') {
      return paletteSpec;
    }
    
    if (typeof paletteSpec === 'string') {
      const found = ColorContrastAnalyzer.ACCESSIBLE_PALETTES.find(p => p.id === paletteSpec);
      if (found) return found;
    }
    
    // Return best palette for current requirements
    return ColorContrastAnalyzer.getBestPalette({
      colorCount: Math.max(8, this.props.data?.length || 8),
      backgroundColor: this.getBackgroundColor(),
      colorBlindFriendly: this.getAccessibilityOptions().colorBlindFriendly,
      highContrast: this.props.highContrast || this.getAccessibilityOptions().highContrast,
      wcagLevel: 'AA'
    });
  }

  protected validateColorContrast() {
    const backgroundColor = this.getBackgroundColor();
    const contrastRatios = new Map<string, number>();
    
    this.state.currentPalette.colors.forEach(color => {
      const result = ColorContrastAnalyzer.analyzeContrast(color, backgroundColor);
      contrastRatios.set(color, result.ratio);
      
      if (!result.passes.normalAA) {
        console.warn(`Color ${color} fails WCAG AA contrast requirements (${result.ratio.toFixed(2)}:1)`);
      }
    });
    
    this.setState({ contrastRatios });
  }

  protected getBackgroundColor(): string {
    if (!this.containerRef.current) return '#ffffff';
    
    const style = window.getComputedStyle(this.containerRef.current);
    return style.backgroundColor || '#ffffff';
  }

  /**
   * Utility methods
   */
  protected getAccessibilityOptions(): AccessibilityOptions {
    const defaultOptions: AccessibilityOptions = {
      enabled: true,
      screenReaderOptimized: false,
      highContrast: false,
      reducedMotion: false,
      colorBlindFriendly: true,
      keyboardNavigation: true,
      liveRegions: true,
      alternativeFormats: true
    };
    
    return { ...defaultOptions, ...this.props.accessibility };
  }

  protected updateAccessibilityFeatures() {
    this.discoverFocusableElements();
    this.updateAriaAttributes();
  }

  protected discoverFocusableElements() {
    if (!this.containerRef.current) return;
    
    this.focusableElements = [];
    
    // Find data points
    const dataPoints = this.containerRef.current.querySelectorAll('.point, .bar, .segment, .cell');
    dataPoints.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      const dataPoint = this.props.data?.[index];
      
      if (dataPoint) {
        this.focusableElements.push({
          element: htmlEl,
          type: 'data-point',
          ariaLabel: this.generateDataPointLabel(dataPoint, index),
          description: this.generateDataPointDescription(dataPoint, index),
          value: dataPoint
        });
      }
    });
    
    // Find controls
    const controls = this.containerRef.current.querySelectorAll('button, [role="button"], .control');
    controls.forEach(el => {
      const htmlEl = el as HTMLElement;
      this.focusableElements.push({
        element: htmlEl,
        type: 'control',
        ariaLabel: htmlEl.getAttribute('aria-label') || htmlEl.textContent || 'Control'
      });
    });
  }

  protected updateAriaAttributes() {
    const chartElement = this.chartRef.current || this.canvasRef.current;
    if (!chartElement) return;
    
    chartElement.setAttribute('aria-label', this.generateAriaLabel());
    
    const descElement = this.containerRef.current?.querySelector('[aria-describedby]');
    if (descElement) {
      const descId = descElement.getAttribute('aria-describedby');
      const desc = document.getElementById(descId!);
      if (desc) {
        desc.textContent = this.generateDataSummary();
      }
    }
  }

  protected setupEnhancedLiveRegions() {
    // Create additional live regions for different types of announcements
    if (!this.containerRef.current) return;
    
    const statusRegion = document.createElement('div');
    statusRegion.setAttribute('aria-live', 'polite');
    statusRegion.setAttribute('aria-label', 'Chart status updates');
    statusRegion.className = 'sr-only';
    this.containerRef.current.appendChild(statusRegion);
    
    const alertRegion = document.createElement('div');
    alertRegion.setAttribute('aria-live', 'assertive');
    alertRegion.setAttribute('aria-label', 'Chart alerts');
    alertRegion.className = 'sr-only';
    this.containerRef.current.appendChild(alertRegion);
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract setupChart(): void;
  protected abstract updateChart(): void;
  protected abstract generateAriaLabel(): string;
  protected abstract generateDataSummary(): string;
  protected abstract generateDataPointLabel(dataPoint: any, index: number): string;
  protected abstract generateDataPointDescription(dataPoint: any, index: number): string;
  protected abstract onDataPointActivate(element: FocusableElement): void;
  protected abstract onControlActivate(element: FocusableElement): void;

  /**
   * Cleanup
   */
  protected cleanup() {
    if (this.keyboardHandler && this.containerRef.current) {
      this.containerRef.current.removeEventListener('keydown', this.keyboardHandler);
    }
    
    // Clean up any added elements
    const addedElements = this.containerRef.current?.querySelectorAll('.sr-only');
    addedElements?.forEach(el => el.remove());
  }

  render() {
    const options = this.getAccessibilityOptions();
    
    return (
      <AccessibilityEnhancer
        chartType={this.props.ariaLabel || 'Chart'}
        chartData={this.props.data || []}
        options={options}
        onFocusChange={(element) => this.setState({ focusedElement: element })}
        onDataPointSelect={this.props.onDataPointClick}
        onKeyboardAction={(action, element) => {
          // Handle keyboard actions
          switch (action) {
            case 'zoom-in':
              this.zoomIn();
              break;
            case 'zoom-out':
              this.zoomOut();
              break;
            case 'zoom-reset':
              this.resetZoom();
              break;
          }
        }}
      >
        <Box ref={this.containerRef} className="accessible-chart-container">
          {this.props.renderMode === 'canvas' ? (
            <canvas ref={this.canvasRef} />
          ) : (
            <svg ref={this.chartRef} />
          )}
          
          {/* Accessibility controls */}
          {options.alternativeFormats && (
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => this.toggleHighContrast()}
                aria-label="Toggle high contrast mode"
              >
                High Contrast
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => this.announceDataSummary()}
                aria-label="Announce data summary"
              >
                Summarize
              </Button>
            </Box>
          )}
        </Box>
      </AccessibilityEnhancer>
    );
  }
}

export default AccessibleChartBase;