/**
 * Unified Interaction Manager for telemetry charts
 * Coordinates all interaction handlers and provides a single interface
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  InteractionConfig, 
  InteractionState, 
  InteractionEvent, 
  InteractionCallbacks,
  TimeSeriesDataPoint,
  FilterState,
  DrillDownState,
  Annotation
} from './types';
import { ZoomPanHandler } from './ZoomPanHandler';
import { TooltipHandler } from './TooltipHandler';
import { SelectionHandler } from './SelectionHandler';
import { ContextMenuHandler, getDefaultChartMenuItems } from './ContextMenuHandler';
import { FilterPanel } from './FilterPanel';
import { TouchGestureHandler } from './TouchGestureHandler';
import { KeyboardNavigationHandler } from './KeyboardNavigationHandler';
import { AnnotationLayer } from './AnnotationLayer';
import { DrillDownBreadcrumb } from './DrillDownBreadcrumb';

interface InteractionManagerProps {
  svg: React.RefObject<SVGSVGElement>;
  container: React.RefObject<SVGGElement>;
  dimensions: { width: number; height: number; margin: any };
  scales?: {
    xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
  };
  data?: TimeSeriesDataPoint[];
  multiSeries?: Record<string, TimeSeriesDataPoint[]>;
  seriesColors?: Record<string, string>;
  config?: InteractionConfig;
  callbacks?: InteractionCallbacks;
  onExport?: (format: 'csv' | 'json' | 'image') => void;
}

export const InteractionManager: React.FC<InteractionManagerProps> = ({
  svg,
  container,
  dimensions,
  scales,
  data = [],
  multiSeries,
  seriesColors,
  config = {},
  callbacks,
  onExport
}) => {
  // State
  const [interactionState, setInteractionState] = useState<InteractionState>({
    zoom: { k: 1, x: 0, y: 0 },
    selection: null,
    hoveredPoint: null,
    filters: {},
    drillDown: { level: 0, path: [] },
    annotations: [],
    contextMenuOpen: false,
    tooltipVisible: false,
    focusedElement: null
  });

  // Refs for handlers
  const zoomHandlerRef = useRef<ZoomPanHandler | null>(null);
  const selectionHandlerRef = useRef<SelectionHandler | null>(null);
  const touchHandlerRef = useRef<TouchGestureHandler | null>(null);
  const keyboardHandlerRef = useRef<KeyboardNavigationHandler | null>(null);

  /**
   * Handle interaction events from child handlers
   */
  const handleInteraction = useCallback((event: InteractionEvent) => {
    // Update state based on event type
    switch (event.type) {
      case 'zoom':
        setInteractionState(prev => ({ ...prev, zoom: event.state }));
        break;
      case 'select':
        setInteractionState(prev => ({ ...prev, selection: event.bounds }));
        break;
      case 'hover':
        setInteractionState(prev => ({ ...prev, hoveredPoint: event.point }));
        break;
      case 'filter':
        setInteractionState(prev => ({ ...prev, filters: event.filters }));
        break;
      case 'drill':
        setInteractionState(prev => ({ 
          ...prev, 
          drillDown: { ...prev.drillDown, level: event.level, currentView: event.data }
        }));
        break;
      case 'annotation':
        setInteractionState(prev => {
          const annotations = [...prev.annotations];
          switch (event.action) {
            case 'add':
              annotations.push(event.annotation);
              break;
            case 'edit':
              const editIndex = annotations.findIndex(a => a.id === event.annotation.id);
              if (editIndex !== -1) {
                annotations[editIndex] = event.annotation;
              }
              break;
            case 'delete':
              const deleteIndex = annotations.findIndex(a => a.id === event.annotation.id);
              if (deleteIndex !== -1) {
                annotations.splice(deleteIndex, 1);
              }
              break;
          }
          return { ...prev, annotations };
        });
        break;
    }

    // Call external callback
    callbacks?.onInteraction?.(event);
  }, [callbacks]);

  /**
   * Initialize zoom/pan handler
   */
  useEffect(() => {
    if (!svg.current || !container.current || !config.zoom?.enabled) return;

    const handler = new ZoomPanHandler(
      d3.select(svg.current),
      d3.select(container.current),
      config.zoom,
      dimensions,
      handleInteraction
    );

    zoomHandlerRef.current = handler;

    return () => {
      handler.destroy();
      zoomHandlerRef.current = null;
    };
  }, [svg, container, dimensions, config.zoom, handleInteraction]);

  /**
   * Initialize selection handler
   */
  useEffect(() => {
    if (!svg.current || !container.current || !config.selection?.enabled || !scales) return;

    const handler = new SelectionHandler(
      d3.select(svg.current),
      d3.select(container.current),
      config.selection,
      dimensions,
      scales,
      data,
      handleInteraction
    );

    selectionHandlerRef.current = handler;

    return () => {
      handler.destroy();
      selectionHandlerRef.current = null;
    };
  }, [svg, container, dimensions, scales, data, config.selection, handleInteraction]);

  /**
   * Update handlers when data or scales change
   */
  useEffect(() => {
    if (selectionHandlerRef.current && scales) {
      selectionHandlerRef.current.updateScales(scales);
      selectionHandlerRef.current.updateData(data);
    }
  }, [scales, data]);

  /**
   * Handle filter changes
   */
  const handleFilterChange = useCallback((filters: FilterState) => {
    handleInteraction({ type: 'filter', filters });
  }, [handleInteraction]);

  /**
   * Handle drill-down navigation
   */
  const handleDrillDown = useCallback(async (item: any, level: number) => {
    if (config.drillDown?.onDrill) {
      const data = await config.drillDown.onDrill(item, level);
      handleInteraction({ type: 'drill', level, data });
    }
  }, [config.drillDown, handleInteraction]);

  /**
   * Handle drill-down back navigation
   */
  const handleDrillBack = useCallback(() => {
    if (interactionState.drillDown.level > 0) {
      const newLevel = interactionState.drillDown.level - 1;
      const newPath = interactionState.drillDown.path.slice(0, -1);
      setInteractionState(prev => ({
        ...prev,
        drillDown: { ...prev.drillDown, level: newLevel, path: newPath }
      }));
      config.drillDown?.onBack?.();
    }
  }, [interactionState.drillDown, config.drillDown]);

  /**
   * Handle export actions
   */
  const handleExportCSV = useCallback(() => {
    onExport?.('csv');
  }, [onExport]);

  const handleExportJSON = useCallback(() => {
    onExport?.('json');
  }, [onExport]);

  const handleCopyImage = useCallback(() => {
    onExport?.('image');
  }, [onExport]);

  const handleResetView = useCallback(() => {
    zoomHandlerRef.current?.reset();
    selectionHandlerRef.current?.clearSelection();
  }, []);

  /**
   * Context menu items
   */
  const contextMenuItems = config.contextMenu?.items || getDefaultChartMenuItems(
    handleExportCSV,
    handleExportJSON,
    handleCopyImage,
    handleResetView
  );

  // Notify state changes
  useEffect(() => {
    callbacks?.onStateChange?.(interactionState);
  }, [interactionState, callbacks]);

  return (
    <>
      {/* Tooltip */}
      {config.tooltip?.enabled !== false && (
        <TooltipHandler
          {...config.tooltip}
          containerRef={svg}
          chartDimensions={dimensions}
          xScale={scales?.xScale}
          yScale={scales?.yScale}
          data={data}
          multiSeries={multiSeries}
          seriesColors={seriesColors}
        />
      )}

      {/* Context Menu */}
      {config.contextMenu?.enabled !== false && (
        <ContextMenuHandler
          {...config.contextMenu}
          items={contextMenuItems}
          containerRef={svg}
          chartDimensions={dimensions}
        />
      )}

      {/* Filter Panel */}
      {config.filter?.enabled && (
        <FilterPanel
          {...config.filter}
          filters={interactionState.filters}
          onFilterChange={handleFilterChange}
        />
      )}

      {/* Drill-down Breadcrumb */}
      {config.drillDown?.enabled && interactionState.drillDown.level > 0 && (
        <DrillDownBreadcrumb
          path={interactionState.drillDown.path}
          onNavigate={handleDrillBack}
          renderer={config.drillDown.breadcrumbRenderer}
        />
      )}

      {/* Annotation Layer */}
      {config.annotations?.enabled && svg.current && container.current && scales && (
        <AnnotationLayer
          svg={svg.current}
          container={container.current}
          annotations={interactionState.annotations}
          scales={scales}
          dimensions={dimensions}
          config={config.annotations}
          onAnnotationChange={(action, annotation) => {
            handleInteraction({ type: 'annotation', action, annotation });
          }}
        />
      )}
    </>
  );
};

/**
 * Hook for using the interaction manager
 */
export const useInteractionManager = (
  config?: InteractionConfig,
  callbacks?: InteractionCallbacks
) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<SVGGElement>(null);
  const [state, setState] = useState<InteractionState>({
    zoom: { k: 1, x: 0, y: 0 },
    selection: null,
    hoveredPoint: null,
    filters: {},
    drillDown: { level: 0, path: [] },
    annotations: [],
    contextMenuOpen: false,
    tooltipVisible: false,
    focusedElement: null
  });

  const handleStateChange = useCallback((newState: Partial<InteractionState>) => {
    setState(prev => ({ ...prev, ...newState }));
  }, []);

  const props = {
    svg: svgRef,
    container: containerRef,
    config,
    callbacks: {
      ...callbacks,
      onStateChange: handleStateChange
    }
  };

  return {
    svgRef,
    containerRef,
    interactionProps: props,
    interactionState: state
  };
};