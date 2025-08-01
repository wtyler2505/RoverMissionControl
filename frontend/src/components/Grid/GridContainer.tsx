/**
 * GridContainer Component - Main container for the flexible drag-and-drop grid system
 * Handles responsive layouts, panel management, and accessibility
 */

import React, { 
  useRef, 
  useCallback, 
  useEffect, 
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle 
} from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { 
  GridConfig, 
  GridBreakpoints, 
  GridCols, 
  PanelLayout, 
  ResponsiveLayouts,
  PanelInstance,
  GridEventHandlers,
  Breakpoint 
} from '../../types/grid';
import { useTheme } from '../../theme/ThemeProvider';
import GridPanel from './GridPanel';
import GridToolbar from './GridToolbar';
import GridErrorBoundary from './GridErrorBoundary';
import { GridProvider } from './GridContext';
import './GridContainer.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// Default configuration for mission-critical operations
const DEFAULT_GRID_CONFIG: GridConfig = {
  cols: 12,
  rowHeight: 60,
  margin: [8, 8],
  containerPadding: [16, 16],
  isDraggable: true,
  isResizable: true,
  compactType: 'vertical',
  preventCollision: false,
  useCSSTransforms: true,
  autoSize: true
};

const DEFAULT_BREAKPOINTS: GridBreakpoints = {
  lg: 1920,
  md: 1366,
  sm: 1024,
  xs: 768,
  xxs: 480
};

const DEFAULT_COLS: GridCols = {
  lg: 12,
  md: 10,
  sm: 8,
  xs: 6,
  xxs: 4
};

export interface GridContainerProps {
  className?: string;
  config?: Partial<GridConfig>;
  breakpoints?: Partial<GridBreakpoints>;
  cols?: Partial<GridCols>;
  layouts?: ResponsiveLayouts;
  panels?: PanelInstance[];
  eventHandlers?: GridEventHandlers;
  onLayoutChange?: (layouts: ResponsiveLayouts) => void;
  onPanelChange?: (panels: PanelInstance[]) => void;
  showToolbar?: boolean;
  enableKeyboardNavigation?: boolean;
  enableAnimations?: boolean;
  reduceMotion?: boolean;
  autoSave?: boolean;
  saveInterval?: number;
  'data-testid'?: string;
}

export interface GridContainerRef {
  exportLayout: () => ResponsiveLayouts;
  importLayout: (layouts: ResponsiveLayouts) => void;
  addPanel: (panelConfig: any, position?: Partial<PanelLayout>) => void;
  removePanel: (panelId: string) => void;
  resetLayout: () => void;
  compactLayout: () => void;
  getGridInstance: () => any;
}

const GridContainer = forwardRef<GridContainerRef, GridContainerProps>(({
  className = '',
  config: customConfig = {},
  breakpoints: customBreakpoints = {},
  cols: customCols = {},
  layouts: initialLayouts,
  panels: initialPanels = [],
  eventHandlers = {},
  onLayoutChange,
  onPanelChange,
  showToolbar = true,
  enableKeyboardNavigation = true,
  enableAnimations = true,
  reduceMotion = false,
  autoSave = true,
  saveInterval = 5000,
  'data-testid': dataTestId = 'grid-container'
}, ref) => {
  
  const theme = useTheme();
  const gridRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Merge configurations with defaults
  const config = useMemo(() => ({
    ...DEFAULT_GRID_CONFIG,
    ...customConfig
  }), [customConfig]);
  
  const breakpoints = useMemo(() => ({
    ...DEFAULT_BREAKPOINTS,
    ...customBreakpoints
  }), [customBreakpoints]);
  
  const cols = useMemo(() => ({
    ...DEFAULT_COLS,
    ...customCols
  }), [customCols]);

  // State management
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(
    initialLayouts || {
      lg: [], md: [], sm: [], xs: [], xxs: []
    }
  );
  
  const [panels, setPanels] = useState<PanelInstance[]>(initialPanels);
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('lg');
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [draggedPanel, setDraggedPanel] = useState<string | undefined>();

  // Auto-save functionality
  useEffect(() => {
    if (!autoSave) return;
    
    const saveTimer = setInterval(() => {
      const layoutData = {
        layouts,
        panels,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      try {
        localStorage.setItem('rover-grid-layout', JSON.stringify(layoutData));
      } catch (error) {
        console.warn('Failed to save grid layout:', error);
      }
    }, saveInterval);

    return () => clearInterval(saveTimer);
  }, [layouts, panels, autoSave, saveInterval]);

  // Load saved layout on mount
  useEffect(() => {
    if (!autoSave) return;
    
    try {
      const savedData = localStorage.getItem('rover-grid-layout');
      if (savedData) {
        const { layouts: savedLayouts, panels: savedPanels } = JSON.parse(savedData);
        if (savedLayouts && savedPanels) {
          setLayouts(savedLayouts);
          setPanels(savedPanels);
        }
      }
    } catch (error) {
      console.warn('Failed to load saved grid layout:', error);
    }
  }, [autoSave]);

  // Layout change handler with validation
  const handleLayoutChange = useCallback((currentLayout: PanelLayout[], allLayouts: ResponsiveLayouts) => {
    // Validate layout before applying
    const isValidLayout = currentLayout.every(item => 
      item.x >= 0 && 
      item.y >= 0 && 
      item.w > 0 && 
      item.h > 0 && 
      item.x + item.w <= cols[currentBreakpoint]
    );

    if (!isValidLayout) {
      console.warn('Invalid layout detected, skipping update');
      return;
    }

    setLayouts(allLayouts);
    onLayoutChange?.(allLayouts);
    
    // Update panel instances with new layout data
    const updatedPanels = panels.map(panel => {
      const layoutItem = currentLayout.find(item => item.i === panel.id);
      if (layoutItem) {
        return {
          ...panel,
          layout: layoutItem,
          lastModified: Date.now()
        };
      }
      return panel;
    });
    
    setPanels(updatedPanels);
    onPanelChange?.(updatedPanels);
  }, [currentBreakpoint, cols, panels, onLayoutChange, onPanelChange]);

  // Breakpoint change handler
  const handleBreakpointChange = useCallback((breakpoint: string) => {
    setCurrentBreakpoint(breakpoint as Breakpoint);
  }, []);

  // Enhanced drag handlers with accessibility
  const handleDragStart = useCallback((layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => {
    setIsDragging(true);
    setDraggedPanel(newItem.i);
    
    // Announce to screen readers
    if (enableKeyboardNavigation) {
      const announcement = `Started dragging panel ${newItem.i}`;
      announceToScreenReader(announcement);
    }
    
    eventHandlers.onDragStart?.(layout, oldItem, newItem, placeholder, e, element);
  }, [enableKeyboardNavigation, eventHandlers]);

  const handleDragStop = useCallback((layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => {
    setIsDragging(false);
    setDraggedPanel(undefined);
    
    // Announce to screen readers
    if (enableKeyboardNavigation) {
      const announcement = `Moved panel ${newItem.i} to position ${newItem.x}, ${newItem.y}`;
      announceToScreenReader(announcement);
    }
    
    eventHandlers.onDragStop?.(layout, oldItem, newItem, placeholder, e, element);
  }, [enableKeyboardNavigation, eventHandlers]);

  // Resize handlers
  const handleResizeStart = useCallback((layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => {
    setIsResizing(true);
    eventHandlers.onResizeStart?.(layout, oldItem, newItem, placeholder, e, element);
  }, [eventHandlers]);

  const handleResizeStop = useCallback((layout: PanelLayout[], oldItem: PanelLayout, newItem: PanelLayout, placeholder: PanelLayout, e: MouseEvent, element: HTMLElement) => {
    setIsResizing(false);
    
    // Announce to screen readers
    if (enableKeyboardNavigation) {
      const announcement = `Resized panel ${newItem.i} to ${newItem.w} by ${newItem.h}`;
      announceToScreenReader(announcement);
    }
    
    eventHandlers.onResizeStop?.(layout, oldItem, newItem, placeholder, e, element);
  }, [enableKeyboardNavigation, eventHandlers]);

  // Utility function for screen reader announcements
  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  // Panel management functions
  const addPanel = useCallback((panelConfig: any, position?: Partial<PanelLayout>) => {
    const newPanel: PanelInstance = {
      id: `panel-${Date.now()}`,
      panelId: panelConfig.id,
      layout: {
        i: `panel-${Date.now()}`,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        w: position?.w ?? panelConfig.defaultSize.w,
        h: position?.h ?? panelConfig.defaultSize.h,
        minW: panelConfig.minSize.w,
        minH: panelConfig.minSize.h,
        maxW: panelConfig.maxSize?.w,
        maxH: panelConfig.maxSize?.h,
        ...position
      },
      config: {},
      isMinimized: false,
      isMaximized: false,
      isVisible: true,
      lastModified: Date.now()
    };

    setPanels(prev => [...prev, newPanel]);
    
    // Add to current breakpoint layout
    setLayouts(prev => ({
      ...prev,
      [currentBreakpoint]: [...prev[currentBreakpoint], newPanel.layout]
    }));
  }, [currentBreakpoint]);

  const removePanel = useCallback((panelId: string) => {
    setPanels(prev => prev.filter(panel => panel.id !== panelId));
    
    // Remove from all layouts
    setLayouts(prev => {
      const newLayouts = { ...prev };
      Object.keys(newLayouts).forEach(breakpoint => {
        newLayouts[breakpoint as Breakpoint] = newLayouts[breakpoint as Breakpoint]
          .filter(item => item.i !== panelId);
      });
      return newLayouts;
    });
  }, []);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    exportLayout: () => layouts,
    importLayout: (newLayouts: ResponsiveLayouts) => setLayouts(newLayouts),
    addPanel,
    removePanel,
    resetLayout: () => {
      setLayouts({ lg: [], md: [], sm: [], xs: [], xxs: [] });
      setPanels([]);
    },
    compactLayout: () => {
      if (gridRef.current) {
        gridRef.current.compactLayout();
      }
    },
    getGridInstance: () => gridRef.current
  }), [layouts, addPanel, removePanel]);

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle when grid is focused
      if (!containerRef.current?.contains(document.activeElement)) return;

      // Escape key to cancel drag/resize
      if (e.key === 'Escape' && (isDragging || isResizing)) {
        e.preventDefault();
        // Reset to previous state
        return;
      }

      // Arrow keys for panel movement
      if (e.ctrlKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        // Implement keyboard-based panel movement
        const focusedPanel = document.activeElement?.closest('[data-grid-item]');
        if (focusedPanel) {
          const panelId = focusedPanel.getAttribute('data-grid-item');
          // Move panel based on arrow key
          console.log(`Move panel ${panelId} with ${e.key}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardNavigation, isDragging, isResizing]);

  // Render panels
  const renderPanels = useCallback(() => {
    return panels.map(panel => (
      <div key={panel.id} data-grid-item={panel.id}>
        <GridPanel
          panel={panel}
          onRemove={() => removePanel(panel.id)}
          onMinimize={() => {
            setPanels(prev => prev.map(p =>
              p.id === panel.id ? { ...p, isMinimized: !p.isMinimized } : p
            ));
          }}
          theme={theme}
          enableAnimations={enableAnimations && !reduceMotion}
        />
      </div>
    ));
  }, [panels, removePanel, theme, enableAnimations, reduceMotion]);

  return (
    <GridProvider
      value={{
        layouts,
        panels,
        currentBreakpoint,
        isDragging,
        isResizing,
        draggedPanel,
        addPanel,
        removePanel,
        config,
        breakpoints,
        cols
      }}
    >
      <GridErrorBoundary>
        <div 
          ref={containerRef}
          className={`grid-container ${className} ${theme.mode}`}
          data-testid={dataTestId}
          data-reduce-motion={reduceMotion}
          tabIndex={enableKeyboardNavigation ? 0 : -1}
          role="application"
          aria-label="Mission Control Grid Layout"
        >
          {showToolbar && (
            <GridToolbar
              onAddPanel={addPanel}
              onResetLayout={() => {
                setLayouts({ lg: [], md: [], sm: [], xs: [], xxs: [] });
                setPanels([]);
              }}
              onCompactLayout={() => gridRef.current?.compactLayout()}
              currentBreakpoint={currentBreakpoint}
              panelCount={panels.length}
            />
          )}
          
          <ResponsiveGridLayout
            ref={gridRef}
            className="grid-layout"
            layouts={layouts}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={config.rowHeight}
            margin={config.margin}
            containerPadding={config.containerPadding}
            isDraggable={config.isDraggable && !reduceMotion}
            isResizable={config.isResizable && !reduceMotion}
            compactType={config.compactType}
            preventCollision={config.preventCollision}
            useCSSTransforms={config.useCSSTransforms}
            autoSize={config.autoSize}
            onLayoutChange={handleLayoutChange}
            onBreakpointChange={handleBreakpointChange}
            onDragStart={handleDragStart}
            onDragStop={handleDragStop}
            onResizeStart={handleResizeStart}
            onResizeStop={handleResizeStop}
            measureBeforeMount={false}
            draggableHandle=".panel-drag-handle"
            resizeHandles={['se', 'sw', 'ne', 'nw']}
          >
            {renderPanels()}
          </ResponsiveGridLayout>
        </div>
      </GridErrorBoundary>
    </GridProvider>
  );
});

GridContainer.displayName = 'GridContainer';

export default GridContainer;