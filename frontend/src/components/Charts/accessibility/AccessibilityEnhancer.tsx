/**
 * Accessibility Enhancer for Telemetry Charts
 * Provides comprehensive accessibility features and WCAG 2.1 AA compliance
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent } from '@mui/material';

export interface AccessibilityOptions {
  enabled: boolean;
  screenReaderOptimized: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  colorBlindFriendly: boolean;
  keyboardNavigation: boolean;
  liveRegions: boolean;
  alternativeFormats: boolean;
}

export interface FocusableElement {
  element: HTMLElement;
  type: 'data-point' | 'control' | 'navigation';
  ariaLabel: string;
  description?: string;
  value?: any;
  coordinates?: { x: number; y: number };
}

export interface AccessibilityAnnouncementOptions {
  priority: 'polite' | 'assertive';
  atomic: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
}

interface AccessibilityEnhancerProps {
  children: React.ReactNode;
  chartType: string;
  chartData: any[];
  options: AccessibilityOptions;
  onFocusChange?: (element: FocusableElement | null) => void;
  onDataPointSelect?: (dataPoint: any, index: number) => void;
  onKeyboardAction?: (action: string, element: FocusableElement) => void;
}

export const AccessibilityEnhancer: React.FC<AccessibilityEnhancerProps> = ({
  children,
  chartType,
  chartData,
  options,
  onFocusChange,
  onDataPointSelect,
  onKeyboardAction
}) => {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  
  const [focusedElement, setFocusedElement] = useState<FocusableElement | null>(null);
  const [focusableElements, setFocusableElements] = useState<FocusableElement[]>([]);
  const [showDataTable, setShowDataTable] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [currentFocusIndex, setCurrentFocusIndex] = useState(-1);

  // Initialize accessibility features
  useEffect(() => {
    if (!options.enabled || !containerRef.current) return;

    initializeAccessibilityFeatures();
    setupKeyboardNavigation();
    setupFocusManagement();
    
    return () => {
      cleanup();
    };
  }, [options.enabled, chartData]);

  // Update live regions when data changes
  useEffect(() => {
    if (options.liveRegions && chartData.length > 0) {
      const summary = generateDataSummary();
      announceToScreenReader(summary, { priority: 'polite', atomic: true });
    }
  }, [chartData, options.liveRegions]);

  // Apply accessibility styles based on options
  useEffect(() => {
    if (!containerRef.current) return;

    applyAccessibilityStyles();
  }, [options.highContrast, options.reducedMotion, options.colorBlindFriendly]);

  const initializeAccessibilityFeatures = () => {
    if (!containerRef.current) return;

    // Add ARIA attributes to container
    const container = containerRef.current;
    container.setAttribute('role', 'img');
    container.setAttribute('aria-label', `${chartType} chart with ${chartData.length} data points`);
    
    if (descriptionRef.current) {
      container.setAttribute('aria-describedby', 'chart-description');
    }

    // Make container focusable for keyboard navigation
    if (options.keyboardNavigation) {
      container.setAttribute('tabindex', '0');
    }

    // Discover focusable elements
    discoverFocusableElements();
  };

  const discoverFocusableElements = () => {
    if (!containerRef.current) return;

    const elements: FocusableElement[] = [];
    
    // Find all interactive chart elements
    const dataPoints = containerRef.current.querySelectorAll('.point, .bar, .segment, .node');
    dataPoints.forEach((el, index) => {
      const htmlEl = el as HTMLElement;
      const dataPoint = chartData[index];
      
      if (dataPoint) {
        elements.push({
          element: htmlEl,
          type: 'data-point',
          ariaLabel: generateDataPointLabel(dataPoint, index),
          description: generateDataPointDescription(dataPoint, index),
          value: dataPoint,
          coordinates: getElementCoordinates(htmlEl)
        });
      }
    });

    // Find control elements
    const controls = containerRef.current.querySelectorAll('button, [role="button"], .control');
    controls.forEach((el) => {
      const htmlEl = el as HTMLElement;
      elements.push({
        element: htmlEl,
        type: 'control',
        ariaLabel: htmlEl.getAttribute('aria-label') || htmlEl.textContent || 'Control',
        description: htmlEl.getAttribute('aria-describedby') ? 
          document.getElementById(htmlEl.getAttribute('aria-describedby')!)?.textContent : undefined
      });
    });

    setFocusableElements(elements.filter(el => el.element.offsetParent !== null));
  };

  const setupKeyboardNavigation = () => {
    if (!options.keyboardNavigation || !containerRef.current) return;

    const container = containerRef.current;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, shiftKey, altKey } = event;
      
      switch (key) {
        case 'ArrowRight':
          event.preventDefault();
          navigateToNext();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigateToPrevious();
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (shiftKey) {
            panChart('up');
          } else {
            navigateToParent();
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (shiftKey) {
            panChart('down');
          } else {
            navigateToChild();
          }
          break;
        case 'Home':
          event.preventDefault();
          navigateToFirst();
          break;
        case 'End':
          event.preventDefault();
          navigateToLast();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          activateCurrentElement();
          break;
        case 'Escape':
          event.preventDefault();
          exitFocusMode();
          break;
        case '+':
        case '=':
          if (ctrlKey) {
            event.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (ctrlKey) {
            event.preventDefault();
            zoomOut();
          }
          break;
        case '0':
          if (ctrlKey) {
            event.preventDefault();
            resetZoom();
          }
          break;
        case 'h':
        case 'H':
          if (ctrlKey || altKey) {
            event.preventDefault();
            setShowKeyboardHelp(true);
          }
          break;
        case 't':
        case 'T':
          if (ctrlKey || altKey) {
            event.preventDefault();
            setShowDataTable(true);
          }
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  };

  const setupFocusManagement = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    const handleFocus = () => {
      if (currentFocusIndex === -1 && focusableElements.length > 0) {
        setCurrentFocusIndex(0);
        focusElement(focusableElements[0]);
      }
    };

    const handleBlur = () => {
      setCurrentFocusIndex(-1);
      setFocusedElement(null);
      onFocusChange?.(null);
    };

    container.addEventListener('focus', handleFocus);
    container.addEventListener('blur', handleBlur);
    
    return () => {
      container.removeEventListener('focus', handleFocus);
      container.removeEventListener('blur', handleBlur);
    };
  };

  const navigateToNext = () => {
    if (focusableElements.length === 0) return;
    const nextIndex = (currentFocusIndex + 1) % focusableElements.length;
    navigateToIndex(nextIndex);
  };

  const navigateToPrevious = () => {
    if (focusableElements.length === 0) return;
    const prevIndex = currentFocusIndex <= 0 ? focusableElements.length - 1 : currentFocusIndex - 1;
    navigateToIndex(prevIndex);
  };

  const navigateToFirst = () => {
    if (focusableElements.length > 0) {
      navigateToIndex(0);
    }
  };

  const navigateToLast = () => {
    if (focusableElements.length > 0) {
      navigateToIndex(focusableElements.length - 1);
    }
  };

  const navigateToParent = () => {
    // Navigate to parent element in hierarchical charts
    const current = focusedElement;
    if (current && current.type === 'data-point') {
      // Implementation depends on chart structure
      onKeyboardAction?.('navigate-parent', current);
    }
  };

  const navigateToChild = () => {
    // Navigate to child element in hierarchical charts
    const current = focusedElement;
    if (current && current.type === 'data-point') {
      // Implementation depends on chart structure
      onKeyboardAction?.('navigate-child', current);
    }
  };

  const navigateToIndex = (index: number) => {
    if (index < 0 || index >= focusableElements.length) return;

    setCurrentFocusIndex(index);
    const element = focusableElements[index];
    focusElement(element);
  };

  const focusElement = (element: FocusableElement) => {
    setFocusedElement(element);
    onFocusChange?.(element);

    // Visual focus indicator
    addFocusIndicator(element.element);

    // Screen reader announcement
    if (options.screenReaderOptimized) {
      const announcement = `${element.ariaLabel}${element.description ? '. ' + element.description : ''}`;
      announceToScreenReader(announcement, { priority: 'polite', atomic: true });
    }

    // Ensure element is visible
    scrollIntoViewIfNeeded(element.element);
  };

  const activateCurrentElement = () => {
    if (!focusedElement) return;

    if (focusedElement.type === 'data-point') {
      const index = chartData.findIndex(d => d === focusedElement.value);
      if (index !== -1) {
        onDataPointSelect?.(focusedElement.value, index);
        announceToScreenReader(
          `Selected data point: ${focusedElement.ariaLabel}`,
          { priority: 'assertive', atomic: true }
        );
      }
    } else if (focusedElement.type === 'control') {
      focusedElement.element.click();
    }

    onKeyboardAction?.('activate', focusedElement);
  };

  const exitFocusMode = () => {
    setCurrentFocusIndex(-1);
    setFocusedElement(null);
    removeFocusIndicator();
    onFocusChange?.(null);
  };

  const panChart = (direction: 'up' | 'down' | 'left' | 'right') => {
    onKeyboardAction?.(`pan-${direction}`, focusedElement!);
    announceToScreenReader(`Chart panned ${direction}`, { priority: 'polite', atomic: false });
  };

  const zoomIn = () => {
    onKeyboardAction?.('zoom-in', focusedElement!);
    announceToScreenReader('Chart zoomed in', { priority: 'polite', atomic: false });
  };

  const zoomOut = () => {
    onKeyboardAction?.('zoom-out', focusedElement!);
    announceToScreenReader('Chart zoomed out', { priority: 'polite', atomic: false });
  };

  const resetZoom = () => {
    onKeyboardAction?.('zoom-reset', focusedElement!);
    announceToScreenReader('Chart zoom reset', { priority: 'polite', atomic: false });
  };

  const addFocusIndicator = (element: HTMLElement) => {
    removeFocusIndicator();
    element.classList.add('accessibility-focused');
    element.style.outline = `2px solid ${theme.palette.primary.main}`;
    element.style.outlineOffset = '2px';
  };

  const removeFocusIndicator = () => {
    const focused = containerRef.current?.querySelector('.accessibility-focused');
    if (focused) {
      focused.classList.remove('accessibility-focused');
      (focused as HTMLElement).style.outline = '';
      (focused as HTMLElement).style.outlineOffset = '';
    }
  };

  const scrollIntoViewIfNeeded = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (!containerRect) return;

    if (rect.bottom > containerRect.bottom || rect.top < containerRect.top ||
        rect.right > containerRect.right || rect.left < containerRect.left) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  };

  const announceToScreenReader = (
    message: string, 
    options: AccessibilityAnnouncementOptions = { priority: 'polite', atomic: true }
  ) => {
    if (!liveRegionRef.current || !options.enabled) return;

    const liveRegion = liveRegionRef.current;
    liveRegion.setAttribute('aria-live', options.priority);
    liveRegion.setAttribute('aria-atomic', options.atomic.toString());
    
    if (options.relevant) {
      liveRegion.setAttribute('aria-relevant', options.relevant);
    }

    // Clear and set new content
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = message;
    }, 10);
  };

  const generateDataSummary = (): string => {
    if (chartData.length === 0) return `${chartType} chart has no data`;

    const summary = [`${chartType} chart contains ${chartData.length} data points`];
    
    // Add statistical summary for numeric data
    if (chartData.length > 0 && typeof chartData[0].value === 'number') {
      const values = chartData.map(d => d.value).filter(v => typeof v === 'number');
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      
      summary.push(`Values range from ${min.toFixed(2)} to ${max.toFixed(2)} with an average of ${avg.toFixed(2)}`);
    }

    // Add category summary
    const categories = chartData.reduce((acc: Record<string, number>, d) => {
      const category = d.category || 'normal';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    const categoryText = Object.entries(categories)
      .map(([category, count]) => `${count} ${category}`)
      .join(', ');
    
    if (categoryText) {
      summary.push(`Data distribution: ${categoryText}`);
    }

    return summary.join('. ');
  };

  const generateDataPointLabel = (dataPoint: any, index: number): string => {
    const baseLabel = `Data point ${index + 1} of ${chartData.length}`;
    
    if (dataPoint.time) {
      const timeStr = new Date(dataPoint.time).toLocaleString();
      return `${baseLabel}, Time: ${timeStr}`;
    }
    
    if (dataPoint.x !== undefined && dataPoint.y !== undefined) {
      return `${baseLabel}, X: ${dataPoint.x}, Y: ${dataPoint.y}`;
    }
    
    if (dataPoint.value !== undefined) {
      return `${baseLabel}, Value: ${dataPoint.value}`;
    }
    
    return baseLabel;
  };

  const generateDataPointDescription = (dataPoint: any, index: number): string => {
    const parts: string[] = [];
    
    if (dataPoint.category) {
      parts.push(`Status: ${dataPoint.category}`);
    }
    
    if (dataPoint.metadata?.sensor) {
      parts.push(`Sensor: ${dataPoint.metadata.sensor}`);
    }
    
    if (dataPoint.metadata?.location) {
      parts.push(`Location: ${dataPoint.metadata.location}`);
    }
    
    if (dataPoint.metadata?.quality) {
      parts.push(`Quality: ${dataPoint.metadata.quality}`);
    }
    
    return parts.join(', ');
  };

  const getElementCoordinates = (element: HTMLElement): { x: number; y: number } => {
    const rect = element.getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    
    if (!containerRect) return { x: 0, y: 0 };
    
    return {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2
    };
  };

  const applyAccessibilityStyles = () => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    // High contrast mode
    if (options.highContrast) {
      container.classList.add('high-contrast-mode');
      container.style.setProperty('--chart-background', '#000000');
      container.style.setProperty('--chart-foreground', '#ffffff');
      container.style.setProperty('--chart-accent', '#ffff00');
    } else {
      container.classList.remove('high-contrast-mode');
      container.style.removeProperty('--chart-background');
      container.style.removeProperty('--chart-foreground');
      container.style.removeProperty('--chart-accent');
    }

    // Reduced motion
    if (options.reducedMotion) {
      container.classList.add('reduced-motion');
      container.style.setProperty('--animation-duration', '0.01ms');
      container.style.setProperty('--transition-duration', '0.01ms');
    } else {
      container.classList.remove('reduced-motion');
      container.style.removeProperty('--animation-duration');
      container.style.removeProperty('--transition-duration');
    }

    // Color blind friendly mode
    if (options.colorBlindFriendly) {
      container.classList.add('colorblind-friendly');
      // Apply patterns and shapes in addition to colors
      container.style.setProperty('--use-patterns', '1');
    } else {
      container.classList.remove('colorblind-friendly');
      container.style.removeProperty('--use-patterns');
    }
  };

  const cleanup = () => {
    removeFocusIndicator();
  };

  const renderDataTable = () => {
    if (!showDataTable || chartData.length === 0) return null;

    return (
      <Dialog
        open={showDataTable}
        onClose={() => setShowDataTable(false)}
        maxWidth="lg"
        fullWidth
        aria-labelledby="data-table-title"
      >
        <DialogTitle id="data-table-title">
          {chartType} Chart Data Table
        </DialogTitle>
        <DialogContent>
          <table role="table" aria-label={`${chartType} chart data`} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th scope="col" style={{ border: '1px solid #ccc', padding: '8px' }}>Index</th>
                {chartData[0]?.time && <th scope="col" style={{ border: '1px solid #ccc', padding: '8px' }}>Time</th>}
                {chartData[0]?.x !== undefined && <th scope="col" style={{ border: '1px solid #ccc', padding: '8px' }}>X</th>}
                {chartData[0]?.y !== undefined && <th scope="col" style={{ border: '1px solid #ccc', padding: '8px' }}>Y</th>}
                {chartData[0]?.value !== undefined && <th scope="col" style={{ border: '1px solid #ccc', padding: '8px' }}>Value</th>}
                {chartData[0]?.category && <th scope="col" style={{ border: '1px solid #ccc', padding: '8px' }}>Category</th>}
              </tr>
            </thead>
            <tbody>
              {chartData.slice(0, 1000).map((point, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{index + 1}</td>
                  {point.time && <td style={{ border: '1px solid #ccc', padding: '8px' }}>{new Date(point.time).toLocaleString()}</td>}
                  {point.x !== undefined && <td style={{ border: '1px solid #ccc', padding: '8px' }}>{point.x}</td>}
                  {point.y !== undefined && <td style={{ border: '1px solid #ccc', padding: '8px' }}>{point.y}</td>}
                  {point.value !== undefined && <td style={{ border: '1px solid #ccc', padding: '8px' }}>{point.value}</td>}
                  {point.category && <td style={{ border: '1px solid #ccc', padding: '8px' }}>{point.category}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          {chartData.length > 1000 && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Showing first 1000 of {chartData.length} data points
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  const renderKeyboardHelp = () => {
    if (!showKeyboardHelp) return null;

    const shortcuts = [
      { key: 'Arrow Keys', description: 'Navigate between data points' },
      { key: 'Home/End', description: 'Jump to first/last data point' },
      { key: 'Enter/Space', description: 'Select current data point' },
      { key: 'Escape', description: 'Exit focus mode' },
      { key: 'Ctrl + +/-', description: 'Zoom in/out' },
      { key: 'Ctrl + 0', description: 'Reset zoom' },
      { key: 'Shift + Arrow Keys', description: 'Pan chart' },
      { key: 'Ctrl/Alt + H', description: 'Show keyboard help' },
      { key: 'Ctrl/Alt + T', description: 'Show data table' }
    ];

    return (
      <Dialog
        open={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
        aria-labelledby="keyboard-help-title"
      >
        <DialogTitle id="keyboard-help-title">
          Keyboard Navigation Help
        </DialogTitle>
        <DialogContent>
          <table role="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left', padding: '8px' }}>Shortcut</th>
                <th scope="col" style={{ textAlign: 'left', padding: '8px' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((shortcut, index) => (
                <tr key={index}>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{shortcut.key}</td>
                  <td style={{ padding: '8px' }}>{shortcut.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Box ref={containerRef} className="accessibility-enhanced-chart" position="relative">
      {/* Screen reader only description */}
      <div
        ref={descriptionRef}
        id="chart-description"
        className="sr-only"
        style={{ 
          position: 'absolute', 
          left: '-10000px', 
          width: '1px', 
          height: '1px', 
          overflow: 'hidden' 
        }}
      >
        {generateDataSummary()}
      </div>

      {/* Live region for announcements */}
      {options.liveRegions && (
        <div
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          style={{ 
            position: 'absolute', 
            left: '-10000px', 
            width: '1px', 
            height: '1px', 
            overflow: 'hidden' 
          }}
        />
      )}

      {/* Chart content */}
      {children}

      {/* Alternative formats */}
      {options.alternativeFormats && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowDataTable(true)}
            aria-label="View chart data in table format"
          >
            Data Table
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowKeyboardHelp(true)}
            aria-label="View keyboard navigation help"
          >
            Keyboard Help
          </Button>
        </Box>
      )}

      {/* Dialogs */}
      {renderDataTable()}
      {renderKeyboardHelp()}

      {/* Focus indicator styles */}
      <style jsx>{`
        .accessibility-enhanced-chart .accessibility-focused {
          outline: 2px solid ${theme.palette.primary.main} !important;
          outline-offset: 2px !important;
        }
        
        .accessibility-enhanced-chart.high-contrast-mode {
          background-color: #000000 !important;
          color: #ffffff !important;
        }
        
        .accessibility-enhanced-chart.high-contrast-mode * {
          border-color: #ffffff !important;
        }
        
        .accessibility-enhanced-chart.reduced-motion *,
        .accessibility-enhanced-chart.reduced-motion *::before,
        .accessibility-enhanced-chart.reduced-motion *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
        
        .accessibility-enhanced-chart.colorblind-friendly [data-category="critical"] {
          background-image: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px);
        }
        
        .accessibility-enhanced-chart.colorblind-friendly [data-category="warning"] {
          background-image: repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px);
        }
        
        .sr-only {
          position: absolute !important;
          left: -10000px !important;
          width: 1px !important;
          height: 1px !important;
          overflow: hidden !important;
        }
      `}</style>
    </Box>
  );
};

export default AccessibilityEnhancer;