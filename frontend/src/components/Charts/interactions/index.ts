/**
 * Chart Interactions Module
 * Exports all interaction handlers and components
 */

// Types
export * from './types';

// Core handlers
export { ZoomPanHandler } from './ZoomPanHandler';
export { SelectionHandler } from './SelectionHandler';
export { TouchGestureHandler } from './TouchGestureHandler';
export { KeyboardNavigationHandler } from './KeyboardNavigationHandler';

// React components
export { TooltipHandler, useTooltip } from './TooltipHandler';
export { ContextMenuHandler, getDefaultChartMenuItems } from './ContextMenuHandler';
export { FilterPanel } from './FilterPanel';
export { AnnotationLayer } from './AnnotationLayer';
export { DrillDownBreadcrumb, ChipBreadcrumb } from './DrillDownBreadcrumb';

// Unified manager
export { InteractionManager, useInteractionManager } from './InteractionManager';

// Utility functions for common interaction patterns
export const interactionUtils = {
  /**
   * Create default interaction configuration
   */
  createDefaultConfig: (): import('./types').InteractionConfig => ({
    zoom: {
      enabled: true,
      scaleExtent: [0.5, 10],
      touchable: true
    },
    tooltip: {
      enabled: true,
      followCursor: true,
      showDelay: 0,
      hideDelay: 200
    },
    selection: {
      enabled: true,
      mode: 'box',
      multi: false,
      color: '#2196f3',
      opacity: 0.2
    },
    filter: {
      enabled: false,
      persistState: true
    },
    contextMenu: {
      enabled: true
    },
    drillDown: {
      enabled: false,
      maxDepth: 5
    },
    touch: {
      enabled: true,
      pinchZoom: true,
      panGesture: true,
      swipeGesture: true,
      longPress: true
    },
    keyboard: {
      enabled: true,
      focusable: true,
      announceChanges: true
    },
    annotations: {
      enabled: false,
      toolbar: true
    },
    performance: {
      targetFPS: 60,
      enableWebWorker: true,
      enableViewportCulling: true,
      maxRenderPoints: 10000,
      debounceDelay: 16,
      throttleDelay: 32
    },
    accessibility: {
      announcer: true,
      highContrastMode: false,
      focusIndicator: true,
      keyboardNavigation: true,
      screenReaderDescriptions: true,
      motionReduced: false
    }
  }),

  /**
   * Merge interaction configurations
   */
  mergeConfigs: (
    base: import('./types').InteractionConfig,
    override: Partial<import('./types').InteractionConfig>
  ): import('./types').InteractionConfig => {
    return {
      ...base,
      ...override,
      zoom: { ...base.zoom, ...override.zoom },
      tooltip: { ...base.tooltip, ...override.tooltip },
      selection: { ...base.selection, ...override.selection },
      filter: { ...base.filter, ...override.filter },
      contextMenu: { ...base.contextMenu, ...override.contextMenu },
      drillDown: { ...base.drillDown, ...override.drillDown },
      touch: { ...base.touch, ...override.touch },
      keyboard: { ...base.keyboard, ...override.keyboard },
      annotations: { ...base.annotations, ...override.annotations },
      performance: { ...base.performance, ...override.performance },
      accessibility: { ...base.accessibility, ...override.accessibility }
    };
  },

  /**
   * Check if touch device
   */
  isTouchDevice: (): boolean => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Format number for display
   */
  formatValue: (value: number, precision: number = 2): string => {
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(precision)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(precision)}K`;
    }
    return value.toFixed(precision);
  },

  /**
   * Format time for display
   */
  formatTime: (date: Date, includeMilliseconds: boolean = false): string => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };
    
    if (includeMilliseconds) {
      options.fractionalSecondDigits = 3;
    }
    
    return new Intl.DateTimeFormat('en-US', options).format(date);
  }
};