/**
 * Selection Handler for chart interactions
 * Supports box, brush, and lasso selection modes
 */

import * as d3 from 'd3';
import { SelectionConfig, SelectionBounds, TimeSeriesDataPoint, InteractionEvent } from './types';

export class SelectionHandler {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private config: Required<SelectionConfig>;
  private dimensions: { width: number; height: number };
  private xScale?: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
  private yScale?: d3.ScaleLinear<number, number>;
  private data: TimeSeriesDataPoint[];
  private onInteraction?: (event: InteractionEvent) => void;
  
  // Selection elements
  private selectionOverlay?: d3.Selection<SVGRectElement, unknown, null, undefined>;
  private selectionRect?: d3.Selection<SVGRectElement, unknown, null, undefined>;
  private selectionPath?: d3.Selection<SVGPathElement, unknown, null, undefined>;
  private brush?: d3.BrushBehavior<unknown>;
  
  // Selection state
  private isSelecting = false;
  private startPoint: [number, number] | null = null;
  private lassoPoints: Array<[number, number]> = [];
  private currentSelection: SelectionBounds | null = null;
  private selectedData: TimeSeriesDataPoint[] = [];

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    config: SelectionConfig,
    dimensions: { width: number; height: number },
    scales?: {
      xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
      yScale: d3.ScaleLinear<number, number>;
    },
    data: TimeSeriesDataPoint[] = [],
    onInteraction?: (event: InteractionEvent) => void
  ) {
    this.svg = svg;
    this.container = container;
    this.dimensions = dimensions;
    this.xScale = scales?.xScale;
    this.yScale = scales?.yScale;
    this.data = data;
    this.onInteraction = onInteraction;
    
    // Apply default configuration
    this.config = {
      enabled: true,
      mode: 'box',
      multi: false,
      onSelect: undefined,
      onClear: undefined,
      color: '#2196f3',
      opacity: 0.2,
      ...config
    };
    
    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize selection behavior based on mode
   */
  private initialize(): void {
    switch (this.config.mode) {
      case 'brush':
      case 'x':
      case 'y':
        this.initializeBrush();
        break;
      case 'box':
        this.initializeBoxSelection();
        break;
      case 'lasso':
        this.initializeLassoSelection();
        break;
    }
    
    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Initialize D3 brush for brush/x/y selection modes
   */
  private initializeBrush(): void {
    // Create brush based on mode
    if (this.config.mode === 'x') {
      this.brush = d3.brushX();
    } else if (this.config.mode === 'y') {
      this.brush = d3.brushY();
    } else {
      this.brush = d3.brush();
    }
    
    // Configure brush
    this.brush
      .extent([[0, 0], [this.dimensions.width, this.dimensions.height]])
      .on('start', this.handleBrushStart.bind(this))
      .on('brush', this.handleBrush.bind(this))
      .on('end', this.handleBrushEnd.bind(this));
    
    // Apply brush to container
    this.container.append('g')
      .attr('class', 'brush')
      .call(this.brush);
    
    // Style brush
    this.container.select('.brush')
      .selectAll('.selection')
      .style('fill', this.config.color)
      .style('fill-opacity', this.config.opacity)
      .style('stroke', this.config.color)
      .style('stroke-width', 2);
  }

  /**
   * Initialize box selection
   */
  private initializeBoxSelection(): void {
    // Create selection overlay
    this.selectionOverlay = this.container.append('rect')
      .attr('class', 'selection-overlay')
      .attr('width', this.dimensions.width)
      .attr('height', this.dimensions.height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair');
    
    // Create selection rectangle (initially hidden)
    this.selectionRect = this.container.append('rect')
      .attr('class', 'selection-rect')
      .style('fill', this.config.color)
      .style('fill-opacity', this.config.opacity)
      .style('stroke', this.config.color)
      .style('stroke-width', 2)
      .style('stroke-dasharray', '5,5')
      .style('pointer-events', 'none')
      .style('display', 'none');
    
    // Setup mouse events
    this.selectionOverlay
      .on('mousedown', this.handleBoxMouseDown.bind(this))
      .on('mousemove', this.handleBoxMouseMove.bind(this))
      .on('mouseup', this.handleBoxMouseUp.bind(this))
      .on('mouseleave', this.handleBoxMouseUp.bind(this));
  }

  /**
   * Initialize lasso selection
   */
  private initializeLassoSelection(): void {
    // Create selection overlay
    this.selectionOverlay = this.container.append('rect')
      .attr('class', 'selection-overlay')
      .attr('width', this.dimensions.width)
      .attr('height', this.dimensions.height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .style('cursor', 'crosshair');
    
    // Create lasso path (initially hidden)
    this.selectionPath = this.container.append('path')
      .attr('class', 'selection-path')
      .style('fill', this.config.color)
      .style('fill-opacity', this.config.opacity)
      .style('stroke', this.config.color)
      .style('stroke-width', 2)
      .style('stroke-linejoin', 'round')
      .style('pointer-events', 'none')
      .style('display', 'none');
    
    // Setup mouse events
    this.selectionOverlay
      .on('mousedown', this.handleLassoMouseDown.bind(this))
      .on('mousemove', this.handleLassoMouseMove.bind(this))
      .on('mouseup', this.handleLassoMouseUp.bind(this))
      .on('mouseleave', this.handleLassoMouseUp.bind(this));
  }

  /**
   * Handle brush start
   */
  private handleBrushStart(event: d3.D3BrushEvent<unknown>): void {
    this.isSelecting = true;
    this.svg.classed('selecting', true);
  }

  /**
   * Handle brush move
   */
  private handleBrush(event: d3.D3BrushEvent<unknown>): void {
    if (!event.selection) return;
    
    const selection = event.selection as [[number, number], [number, number]];
    const bounds: SelectionBounds = {
      x1: selection[0][0],
      y1: selection[0][1],
      x2: selection[1][0],
      y2: selection[1][1]
    };
    
    this.currentSelection = bounds;
    this.updateSelectedData(bounds);
  }

  /**
   * Handle brush end
   */
  private handleBrushEnd(event: d3.D3BrushEvent<unknown>): void {
    this.isSelecting = false;
    this.svg.classed('selecting', false);
    
    if (!event.selection) {
      this.clearSelection();
      return;
    }
    
    const selection = event.selection as [[number, number], [number, number]];
    const bounds: SelectionBounds = {
      x1: selection[0][0],
      y1: selection[0][1],
      x2: selection[1][0],
      y2: selection[1][1]
    };
    
    this.finalizeSelection(bounds);
  }

  /**
   * Handle box selection mouse down
   */
  private handleBoxMouseDown(event: MouseEvent): void {
    event.preventDefault();
    
    const [x, y] = d3.pointer(event, this.selectionOverlay!.node());
    this.startPoint = [x, y];
    this.isSelecting = true;
    
    // Show selection rectangle
    this.selectionRect!
      .attr('x', x)
      .attr('y', y)
      .attr('width', 0)
      .attr('height', 0)
      .style('display', 'block');
    
    this.svg.classed('selecting', true);
  }

  /**
   * Handle box selection mouse move
   */
  private handleBoxMouseMove(event: MouseEvent): void {
    if (!this.isSelecting || !this.startPoint) return;
    
    const [x, y] = d3.pointer(event, this.selectionOverlay!.node());
    
    const x1 = Math.min(this.startPoint[0], x);
    const y1 = Math.min(this.startPoint[1], y);
    const x2 = Math.max(this.startPoint[0], x);
    const y2 = Math.max(this.startPoint[1], y);
    
    // Update selection rectangle
    this.selectionRect!
      .attr('x', x1)
      .attr('y', y1)
      .attr('width', x2 - x1)
      .attr('height', y2 - y1);
    
    // Update current selection
    const bounds: SelectionBounds = { x1, y1, x2, y2 };
    this.currentSelection = bounds;
    this.updateSelectedData(bounds);
  }

  /**
   * Handle box selection mouse up
   */
  private handleBoxMouseUp(event: MouseEvent): void {
    if (!this.isSelecting) return;
    
    this.isSelecting = false;
    this.svg.classed('selecting', false);
    
    if (this.currentSelection) {
      const { x1, y1, x2, y2 } = this.currentSelection;
      
      // Check if selection is too small (likely a click)
      if (Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5) {
        this.clearSelection();
      } else {
        this.finalizeSelection(this.currentSelection);
      }
    }
    
    this.startPoint = null;
  }

  /**
   * Handle lasso selection mouse down
   */
  private handleLassoMouseDown(event: MouseEvent): void {
    event.preventDefault();
    
    const [x, y] = d3.pointer(event, this.selectionOverlay!.node());
    this.lassoPoints = [[x, y]];
    this.isSelecting = true;
    
    // Show lasso path
    this.selectionPath!
      .attr('d', `M${x},${y}`)
      .style('display', 'block');
    
    this.svg.classed('selecting', true);
  }

  /**
   * Handle lasso selection mouse move
   */
  private handleLassoMouseMove(event: MouseEvent): void {
    if (!this.isSelecting) return;
    
    const [x, y] = d3.pointer(event, this.selectionOverlay!.node());
    this.lassoPoints.push([x, y]);
    
    // Update lasso path
    const pathData = this.lassoPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
      .join(' ');
    
    this.selectionPath!.attr('d', pathData);
    
    // Update selected data based on lasso
    this.updateSelectedDataFromLasso();
  }

  /**
   * Handle lasso selection mouse up
   */
  private handleLassoMouseUp(event: MouseEvent): void {
    if (!this.isSelecting) return;
    
    this.isSelecting = false;
    this.svg.classed('selecting', false);
    
    if (this.lassoPoints.length > 3) {
      // Close the lasso path
      const pathData = this.lassoPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
        .join(' ') + 'Z';
      
      this.selectionPath!.attr('d', pathData);
      
      // Finalize selection
      this.finalizeLassoSelection();
    } else {
      this.clearSelection();
    }
    
    this.lassoPoints = [];
  }

  /**
   * Update selected data based on bounds
   */
  private updateSelectedData(bounds: SelectionBounds): void {
    if (!this.xScale || !this.yScale) return;
    
    this.selectedData = this.data.filter(d => {
      const x = this.xScale!(d.time) as number;
      const y = this.yScale!(d.value);
      
      return x >= bounds.x1 && x <= bounds.x2 && y >= bounds.y1 && y <= bounds.y2;
    });
    
    // Highlight selected points
    this.highlightSelectedPoints();
  }

  /**
   * Update selected data based on lasso
   */
  private updateSelectedDataFromLasso(): void {
    if (!this.xScale || !this.yScale || this.lassoPoints.length < 3) return;
    
    // Create polygon from lasso points
    const polygon = this.lassoPoints;
    
    this.selectedData = this.data.filter(d => {
      const x = this.xScale!(d.time) as number;
      const y = this.yScale!(d.value);
      
      return this.pointInPolygon([x, y], polygon);
    });
    
    // Highlight selected points
    this.highlightSelectedPoints();
  }

  /**
   * Check if point is inside polygon
   */
  private pointInPolygon(point: [number, number], polygon: Array<[number, number]>): boolean {
    const [x, y] = point;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    
    return inside;
  }

  /**
   * Highlight selected points
   */
  private highlightSelectedPoints(): void {
    // Remove existing highlights
    this.container.selectAll('.selected-point').remove();
    
    if (!this.xScale || !this.yScale) return;
    
    // Add highlights for selected points
    this.container.selectAll('.selected-point')
      .data(this.selectedData)
      .enter()
      .append('circle')
      .attr('class', 'selected-point')
      .attr('cx', d => this.xScale!(d.time) as number)
      .attr('cy', d => this.yScale!(d.value))
      .attr('r', 4)
      .style('fill', this.config.color)
      .style('stroke', '#fff')
      .style('stroke-width', 2)
      .style('pointer-events', 'none');
  }

  /**
   * Finalize selection
   */
  private finalizeSelection(bounds: SelectionBounds): void {
    // Emit interaction event
    if (this.onInteraction) {
      this.onInteraction({
        type: 'select',
        bounds
      });
    }
    
    // Call onSelect callback
    if (this.config.onSelect) {
      this.config.onSelect(bounds, this.selectedData);
    }
    
    // Add selection info panel
    this.showSelectionInfo();
  }

  /**
   * Finalize lasso selection
   */
  private finalizeLassoSelection(): void {
    // Calculate bounds
    const xValues = this.lassoPoints.map(p => p[0]);
    const yValues = this.lassoPoints.map(p => p[1]);
    
    const bounds: SelectionBounds = {
      x1: Math.min(...xValues),
      y1: Math.min(...yValues),
      x2: Math.max(...xValues),
      y2: Math.max(...yValues)
    };
    
    // Emit interaction event
    if (this.onInteraction) {
      this.onInteraction({
        type: 'select',
        bounds
      });
    }
    
    // Call onSelect callback
    if (this.config.onSelect) {
      this.config.onSelect(bounds, this.selectedData);
    }
    
    // Add selection info panel
    this.showSelectionInfo();
  }

  /**
   * Show selection information panel
   */
  private showSelectionInfo(): void {
    // Remove existing info panel
    this.container.selectAll('.selection-info').remove();
    
    if (this.selectedData.length === 0) return;
    
    // Calculate statistics
    const values = this.selectedData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Create info panel
    const infoGroup = this.container.append('g')
      .attr('class', 'selection-info')
      .attr('transform', `translate(10, 10)`);
    
    // Background
    const background = infoGroup.append('rect')
      .attr('rx', 4)
      .attr('fill', 'rgba(0,0,0,0.8)')
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1);
    
    // Text content
    const text = infoGroup.append('text')
      .attr('fill', 'white')
      .attr('font-size', 12)
      .attr('font-family', 'Arial, sans-serif');
    
    text.append('tspan')
      .attr('x', 10)
      .attr('y', 20)
      .attr('font-weight', 'bold')
      .text(`Selected: ${this.selectedData.length} points`);
    
    text.append('tspan')
      .attr('x', 10)
      .attr('y', 40)
      .text(`Min: ${min.toFixed(2)}`);
    
    text.append('tspan')
      .attr('x', 10)
      .attr('y', 55)
      .text(`Max: ${max.toFixed(2)}`);
    
    text.append('tspan')
      .attr('x', 10)
      .attr('y', 70)
      .text(`Avg: ${avg.toFixed(2)}`);
    
    // Size background to fit text
    const bbox = text.node()!.getBBox();
    background
      .attr('x', bbox.x - 10)
      .attr('y', bbox.y - 10)
      .attr('width', bbox.width + 20)
      .attr('height', bbox.height + 20);
  }

  /**
   * Clear selection
   */
  public clearSelection(): void {
    // Clear brush
    if (this.brush && this.container.select('.brush').node()) {
      this.container.select('.brush').call(this.brush.clear);
    }
    
    // Hide selection rectangle
    if (this.selectionRect) {
      this.selectionRect.style('display', 'none');
    }
    
    // Hide selection path
    if (this.selectionPath) {
      this.selectionPath.style('display', 'none');
    }
    
    // Remove highlights
    this.container.selectAll('.selected-point').remove();
    
    // Remove info panel
    this.container.selectAll('.selection-info').remove();
    
    // Reset state
    this.currentSelection = null;
    this.selectedData = [];
    
    // Call onClear callback
    if (this.config.onClear) {
      this.config.onClear();
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    d3.select(window).on('keydown.selection', (event: KeyboardEvent) => {
      // Check if chart is focused
      if (!this.svg.node()?.contains(document.activeElement)) return;
      
      if (event.key === 'Escape') {
        this.clearSelection();
      }
      
      // Ctrl+A to select all
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        event.preventDefault();
        this.selectAll();
      }
    });
  }

  /**
   * Select all data points
   */
  private selectAll(): void {
    const bounds: SelectionBounds = {
      x1: 0,
      y1: 0,
      x2: this.dimensions.width,
      y2: this.dimensions.height
    };
    
    this.currentSelection = bounds;
    this.selectedData = [...this.data];
    
    this.highlightSelectedPoints();
    this.finalizeSelection(bounds);
  }

  /**
   * Update scales
   */
  public updateScales(scales: {
    xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number>;
    yScale: d3.ScaleLinear<number, number>;
  }): void {
    this.xScale = scales.xScale;
    this.yScale = scales.yScale;
  }

  /**
   * Update data
   */
  public updateData(data: TimeSeriesDataPoint[]): void {
    this.data = data;
  }

  /**
   * Update dimensions
   */
  public updateDimensions(dimensions: { width: number; height: number }): void {
    this.dimensions = dimensions;
    
    // Update overlay size
    if (this.selectionOverlay) {
      this.selectionOverlay
        .attr('width', dimensions.width)
        .attr('height', dimensions.height);
    }
    
    // Update brush extent
    if (this.brush) {
      this.brush.extent([[0, 0], [dimensions.width, dimensions.height]]);
      this.container.select('.brush').call(this.brush);
    }
  }

  /**
   * Destroy selection handler
   */
  public destroy(): void {
    // Remove event listeners
    if (this.selectionOverlay) {
      this.selectionOverlay
        .on('mousedown', null)
        .on('mousemove', null)
        .on('mouseup', null)
        .on('mouseleave', null);
    }
    
    // Remove elements
    this.container.selectAll('.brush').remove();
    this.selectionOverlay?.remove();
    this.selectionRect?.remove();
    this.selectionPath?.remove();
    this.container.selectAll('.selected-point').remove();
    this.container.selectAll('.selection-info').remove();
    
    // Remove keyboard shortcuts
    d3.select(window).on('keydown.selection', null);
  }
}