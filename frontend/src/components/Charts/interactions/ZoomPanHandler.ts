/**
 * Zoom and Pan Handler for D3 charts
 * Provides smooth zooming and panning with touch support
 */

import * as d3 from 'd3';
import { ZoomConfig, ZoomState, InteractionEvent } from './types';

export class ZoomPanHandler {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private config: Required<ZoomConfig>;
  private currentTransform: d3.ZoomTransform;
  private onInteraction?: (event: InteractionEvent) => void;
  private dimensions: { width: number; height: number };
  private zoomOverlay?: d3.Selection<SVGRectElement, unknown, null, undefined>;
  private resetButton?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private zoomIndicator?: d3.Selection<SVGGElement, unknown, null, undefined>;

  constructor(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    container: d3.Selection<SVGGElement, unknown, null, undefined>,
    config: ZoomConfig,
    dimensions: { width: number; height: number },
    onInteraction?: (event: InteractionEvent) => void
  ) {
    this.svg = svg;
    this.container = container;
    this.dimensions = dimensions;
    this.onInteraction = onInteraction;
    
    // Apply default configuration
    this.config = {
      enabled: true,
      scaleExtent: [0.5, 10],
      translateExtent: undefined,
      wheelDelta: 0.001,
      touchable: true,
      clickDistance: 2,
      ...config
    };

    this.currentTransform = d3.zoomIdentity;
    this.zoom = this.createZoomBehavior();
    
    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Create D3 zoom behavior
   */
  private createZoomBehavior(): d3.ZoomBehavior<SVGSVGElement, unknown> {
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent(this.config.scaleExtent)
      .wheelDelta((event) => -event.deltaY * this.config.wheelDelta!)
      .clickDistance(this.config.clickDistance!)
      .on('zoom', this.handleZoom.bind(this))
      .on('start', this.handleZoomStart.bind(this))
      .on('end', this.handleZoomEnd.bind(this));

    // Set translate extent if provided
    if (this.config.translateExtent) {
      zoom.translateExtent(this.config.translateExtent);
    } else {
      // Default translate extent based on dimensions
      const padding = 100;
      zoom.translateExtent([
        [-padding, -padding],
        [this.dimensions.width + padding, this.dimensions.height + padding]
      ]);
    }

    // Configure touch behavior
    if (!this.config.touchable) {
      zoom.filter((event) => !event.touches);
    }

    return zoom;
  }

  /**
   * Initialize zoom behavior
   */
  private initialize(): void {
    // Create zoom overlay
    this.zoomOverlay = this.svg.append('rect')
      .attr('class', 'zoom-overlay')
      .attr('width', this.dimensions.width)
      .attr('height', this.dimensions.height)
      .style('fill', 'none')
      .style('pointer-events', 'all')
      .style('cursor', 'grab');

    // Apply zoom behavior
    this.svg.call(this.zoom);

    // Add UI controls
    this.addResetButton();
    this.addZoomIndicator();
    
    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * Handle zoom event
   */
  private handleZoom(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    this.currentTransform = event.transform;
    
    // Apply transform to container
    this.container.attr('transform', event.transform.toString());
    
    // Update zoom indicator
    this.updateZoomIndicator();
    
    // Emit interaction event
    if (this.onInteraction) {
      const state: ZoomState = {
        k: event.transform.k,
        x: event.transform.x,
        y: event.transform.y
      };
      
      this.onInteraction({
        type: 'zoom',
        state
      });
    }
  }

  /**
   * Handle zoom start
   */
  private handleZoomStart(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    // Change cursor
    this.zoomOverlay?.style('cursor', 'grabbing');
    
    // Add active class for styling
    this.svg.classed('zooming', true);
  }

  /**
   * Handle zoom end
   */
  private handleZoomEnd(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    // Restore cursor
    this.zoomOverlay?.style('cursor', 'grab');
    
    // Remove active class
    this.svg.classed('zooming', false);
  }

  /**
   * Add reset button
   */
  private addResetButton(): void {
    const buttonGroup = this.svg.append('g')
      .attr('class', 'zoom-reset-button')
      .attr('transform', `translate(${this.dimensions.width - 40}, 10)`)
      .style('cursor', 'pointer')
      .attr('role', 'button')
      .attr('tabindex', 0)
      .attr('aria-label', 'Reset zoom');

    // Button background
    buttonGroup.append('rect')
      .attr('width', 30)
      .attr('height', 30)
      .attr('rx', 4)
      .attr('fill', '#ffffff')
      .attr('stroke', '#e0e0e0')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

    // Reset icon
    buttonGroup.append('text')
      .attr('x', 15)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Arial, sans-serif')
      .attr('font-size', 14)
      .attr('fill', '#666')
      .text('⟲');

    // Click handler
    buttonGroup.on('click', () => this.reset());
    buttonGroup.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.reset();
      }
    });

    // Hover effect
    buttonGroup
      .on('mouseenter', function() {
        d3.select(this).select('rect')
          .attr('fill', '#f5f5f5');
      })
      .on('mouseleave', function() {
        d3.select(this).select('rect')
          .attr('fill', '#ffffff');
      });

    this.resetButton = buttonGroup;
  }

  /**
   * Add zoom level indicator
   */
  private addZoomIndicator(): void {
    const indicatorGroup = this.svg.append('g')
      .attr('class', 'zoom-indicator')
      .attr('transform', `translate(${this.dimensions.width - 100}, 50)`);

    // Background
    indicatorGroup.append('rect')
      .attr('width', 80)
      .attr('height', 24)
      .attr('rx', 12)
      .attr('fill', 'rgba(0,0,0,0.7)');

    // Zoom level text
    indicatorGroup.append('text')
      .attr('class', 'zoom-level')
      .attr('x', 40)
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'Arial, sans-serif')
      .attr('font-size', 12)
      .attr('fill', '#ffffff')
      .text('100%');

    this.zoomIndicator = indicatorGroup;
    
    // Initially hide, show only when zoomed
    this.zoomIndicator.style('opacity', 0);
  }

  /**
   * Update zoom indicator
   */
  private updateZoomIndicator(): void {
    if (!this.zoomIndicator) return;

    const zoomLevel = Math.round(this.currentTransform.k * 100);
    
    this.zoomIndicator
      .select('.zoom-level')
      .text(`${zoomLevel}%`);

    // Show/hide based on zoom level
    this.zoomIndicator
      .transition()
      .duration(200)
      .style('opacity', zoomLevel === 100 ? 0 : 1);
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    d3.select(window).on('keydown.zoom', (event: KeyboardEvent) => {
      // Check if chart is focused
      if (!this.svg.node()?.contains(document.activeElement)) return;

      switch (event.key) {
        case '+':
        case '=':
          event.preventDefault();
          this.zoomIn();
          break;
        case '-':
        case '_':
          event.preventDefault();
          this.zoomOut();
          break;
        case '0':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.reset();
          }
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.pan(-50, 0);
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.pan(50, 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.pan(0, -50);
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.pan(0, 50);
          break;
      }
    });
  }

  /**
   * Programmatic zoom in
   */
  public zoomIn(factor: number = 1.2): void {
    this.svg.transition()
      .duration(300)
      .call(this.zoom.scaleBy, factor);
  }

  /**
   * Programmatic zoom out
   */
  public zoomOut(factor: number = 0.8): void {
    this.svg.transition()
      .duration(300)
      .call(this.zoom.scaleBy, factor);
  }

  /**
   * Programmatic pan
   */
  public pan(dx: number, dy: number): void {
    const currentTransform = d3.zoomTransform(this.svg.node()!);
    const newTransform = currentTransform.translate(dx, dy);
    
    this.svg.transition()
      .duration(300)
      .call(this.zoom.transform, newTransform);
  }

  /**
   * Reset zoom to initial state
   */
  public reset(): void {
    this.svg.transition()
      .duration(300)
      .call(this.zoom.transform, d3.zoomIdentity);
  }

  /**
   * Zoom to specific bounds
   */
  public zoomToBounds(x1: number, y1: number, x2: number, y2: number, padding: number = 20): void {
    const width = x2 - x1;
    const height = y2 - y1;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const scale = Math.min(
      (this.dimensions.width - padding * 2) / width,
      (this.dimensions.height - padding * 2) / height
    );

    const translate = [
      this.dimensions.width / 2 - scale * midX,
      this.dimensions.height / 2 - scale * midY
    ];

    this.svg.transition()
      .duration(750)
      .call(
        this.zoom.transform,
        d3.zoomIdentity
          .translate(translate[0], translate[1])
          .scale(scale)
      );
  }

  /**
   * Get current zoom state
   */
  public getState(): ZoomState {
    return {
      k: this.currentTransform.k,
      x: this.currentTransform.x,
      y: this.currentTransform.y
    };
  }

  /**
   * Set zoom state
   */
  public setState(state: ZoomState): void {
    const transform = d3.zoomIdentity
      .translate(state.x, state.y)
      .scale(state.k);
    
    this.svg.call(this.zoom.transform, transform);
  }

  /**
   * Enable or disable zoom
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    if (enabled) {
      this.svg.call(this.zoom);
    } else {
      this.svg.on('.zoom', null);
    }
  }

  /**
   * Update dimensions
   */
  public updateDimensions(dimensions: { width: number; height: number }): void {
    this.dimensions = dimensions;
    
    // Update overlay size
    this.zoomOverlay?.attr('width', dimensions.width).attr('height', dimensions.height);
    
    // Update control positions
    this.resetButton?.attr('transform', `translate(${dimensions.width - 40}, 10)`);
    this.zoomIndicator?.attr('transform', `translate(${dimensions.width - 100}, 50)`);
    
    // Update translate extent
    const padding = 100;
    this.zoom.translateExtent([
      [-padding, -padding],
      [dimensions.width + padding, dimensions.height + padding]
    ]);
  }

  /**
   * Destroy zoom handler
   */
  public destroy(): void {
    // Remove zoom behavior
    this.svg.on('.zoom', null);
    
    // Remove UI elements
    this.zoomOverlay?.remove();
    this.resetButton?.remove();
    this.zoomIndicator?.remove();
    
    // Remove keyboard shortcuts
    d3.select(window).on('keydown.zoom', null);
  }
}