/**
 * Touch Gesture Handler for mobile and touch-enabled devices
 * Supports pinch zoom, pan, swipe, and long press gestures
 */

import * as d3 from 'd3';
import { TouchGestureConfig, TouchGestureState, InteractionEvent } from './types';

interface Touch {
  identifier: number;
  pageX: number;
  pageY: number;
  clientX: number;
  clientY: number;
}

export class TouchGestureHandler {
  private element: d3.Selection<SVGElement, unknown, null, undefined>;
  private config: Required<TouchGestureConfig>;
  private onInteraction?: (event: InteractionEvent) => void;
  
  // Touch state tracking
  private touches: Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }> = new Map();
  private lastScale = 1;
  private lastRotation = 0;
  private initialDistance = 0;
  private initialAngle = 0;
  private longPressTimer?: NodeJS.Timeout;
  private swipeStartTime = 0;
  private swipeStartX = 0;
  private swipeStartY = 0;
  
  // Gesture thresholds
  private readonly LONG_PRESS_DURATION = 500; // ms
  private readonly SWIPE_THRESHOLD = 50; // pixels
  private readonly SWIPE_VELOCITY_THRESHOLD = 0.5; // pixels/ms
  private readonly PINCH_THRESHOLD = 0.1; // scale change threshold
  private readonly ROTATION_THRESHOLD = 5; // degrees

  constructor(
    element: d3.Selection<SVGElement, unknown, null, undefined>,
    config: TouchGestureConfig,
    onInteraction?: (event: InteractionEvent) => void
  ) {
    this.element = element;
    this.onInteraction = onInteraction;
    
    // Apply default configuration
    this.config = {
      enabled: true,
      pinchZoom: true,
      panGesture: true,
      rotateGesture: false,
      swipeGesture: true,
      longPress: true,
      onGesture: undefined,
      ...config
    };
    
    if (this.config.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize touch event listeners
   */
  private initialize(): void {
    const node = this.element.node();
    if (!node) return;
    
    // Touch events
    node.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    node.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    node.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    node.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: false });
    
    // Prevent default touch behaviors
    node.style.touchAction = 'none';
    node.style.userSelect = 'none';
    node.style.webkitUserSelect = 'none';
  }

  /**
   * Handle touch start
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    // Update touches map
    Array.from(event.touches).forEach(touch => {
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now()
      });
    });
    
    // Handle different touch counts
    switch (event.touches.length) {
      case 1:
        this.handleSingleTouchStart(event.touches[0]);
        break;
      case 2:
        this.handleDoubleTouchStart(event.touches);
        break;
    }
    
    // Emit gesture event
    this.emitGestureState('start');
  }

  /**
   * Handle single touch start
   */
  private handleSingleTouchStart(touch: Touch): void {
    // Initialize swipe tracking
    if (this.config.swipeGesture) {
      this.swipeStartTime = Date.now();
      this.swipeStartX = touch.clientX;
      this.swipeStartY = touch.clientY;
    }
    
    // Start long press timer
    if (this.config.longPress) {
      this.cancelLongPress();
      this.longPressTimer = setTimeout(() => {
        this.handleLongPress(touch.clientX, touch.clientY);
      }, this.LONG_PRESS_DURATION);
    }
  }

  /**
   * Handle double touch start (pinch/rotate)
   */
  private handleDoubleTouchStart(touches: TouchList): void {
    // Cancel long press
    this.cancelLongPress();
    
    if (touches.length !== 2) return;
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    
    // Calculate initial distance for pinch
    if (this.config.pinchZoom) {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      this.initialDistance = Math.sqrt(dx * dx + dy * dy);
    }
    
    // Calculate initial angle for rotation
    if (this.config.rotateGesture) {
      this.initialAngle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      ) * 180 / Math.PI;
    }
  }

  /**
   * Handle touch move
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    // Cancel long press on move
    if (this.touches.size === 1 && this.longPressTimer) {
      const touch = this.touches.values().next().value;
      const dx = event.touches[0].clientX - touch.startX;
      const dy = event.touches[0].clientY - touch.startY;
      
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        this.cancelLongPress();
      }
    }
    
    // Update touches
    Array.from(event.touches).forEach(touch => {
      const trackedTouch = this.touches.get(touch.identifier);
      if (trackedTouch) {
        trackedTouch.x = touch.clientX;
        trackedTouch.y = touch.clientY;
      }
    });
    
    // Handle different touch counts
    switch (event.touches.length) {
      case 1:
        this.handleSingleTouchMove(event.touches[0]);
        break;
      case 2:
        this.handleDoubleTouchMove(event.touches);
        break;
    }
    
    // Emit gesture event
    this.emitGestureState('move');
  }

  /**
   * Handle single touch move (pan)
   */
  private handleSingleTouchMove(touch: Touch): void {
    if (!this.config.panGesture) return;
    
    const trackedTouch = this.touches.get(touch.identifier);
    if (!trackedTouch) return;
    
    const dx = touch.clientX - trackedTouch.startX;
    const dy = touch.clientY - trackedTouch.startY;
    
    // Emit pan event
    if (this.onInteraction) {
      this.onInteraction({
        type: 'pan',
        delta: { x: dx, y: dy }
      });
    }
    
    // Custom gesture callback
    this.config.onGesture?.('pan', this.getGestureState());
  }

  /**
   * Handle double touch move (pinch/rotate)
   */
  private handleDoubleTouchMove(touches: TouchList): void {
    if (touches.length !== 2) return;
    
    const touch1 = touches[0];
    const touch2 = touches[1];
    
    // Calculate pinch scale
    if (this.config.pinchZoom && this.initialDistance > 0) {
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      const scale = currentDistance / this.initialDistance;
      
      if (Math.abs(scale - this.lastScale) > this.PINCH_THRESHOLD) {
        this.lastScale = scale;
        
        // Emit zoom event
        if (this.onInteraction) {
          const center = {
            x: (touch1.clientX + touch2.clientX) / 2,
            y: (touch1.clientY + touch2.clientY) / 2
          };
          
          this.onInteraction({
            type: 'zoom',
            state: { k: scale, x: center.x, y: center.y }
          });
        }
        
        // Custom gesture callback
        this.config.onGesture?.('pinch', this.getGestureState());
      }
    }
    
    // Calculate rotation
    if (this.config.rotateGesture) {
      const currentAngle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      ) * 180 / Math.PI;
      
      const rotation = currentAngle - this.initialAngle;
      
      if (Math.abs(rotation - this.lastRotation) > this.ROTATION_THRESHOLD) {
        this.lastRotation = rotation;
        
        // Custom gesture callback
        this.config.onGesture?.('rotate', this.getGestureState());
      }
    }
  }

  /**
   * Handle touch end
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    // Handle swipe detection
    if (event.changedTouches.length === 1 && this.touches.size === 1) {
      this.detectSwipe(event.changedTouches[0]);
    }
    
    // Remove ended touches
    Array.from(event.changedTouches).forEach(touch => {
      this.touches.delete(touch.identifier);
    });
    
    // Reset gesture state if all touches ended
    if (this.touches.size === 0) {
      this.resetGestureState();
    }
    
    // Cancel long press
    this.cancelLongPress();
    
    // Emit gesture event
    this.emitGestureState('end');
  }

  /**
   * Handle touch cancel
   */
  private handleTouchCancel(event: TouchEvent): void {
    event.preventDefault();
    
    // Remove cancelled touches
    Array.from(event.changedTouches).forEach(touch => {
      this.touches.delete(touch.identifier);
    });
    
    // Reset if all touches cancelled
    if (this.touches.size === 0) {
      this.resetGestureState();
    }
    
    // Cancel long press
    this.cancelLongPress();
    
    // Emit gesture event
    this.emitGestureState('cancel');
  }

  /**
   * Detect swipe gesture
   */
  private detectSwipe(touch: Touch): void {
    if (!this.config.swipeGesture) return;
    
    const endTime = Date.now();
    const dx = touch.clientX - this.swipeStartX;
    const dy = touch.clientY - this.swipeStartY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = endTime - this.swipeStartTime;
    const velocity = distance / duration;
    
    // Check if it's a swipe
    if (distance > this.SWIPE_THRESHOLD && velocity > this.SWIPE_VELOCITY_THRESHOLD) {
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      let direction: string;
      
      // Determine swipe direction
      if (angle > -45 && angle <= 45) {
        direction = 'right';
      } else if (angle > 45 && angle <= 135) {
        direction = 'down';
      } else if (angle > 135 || angle <= -135) {
        direction = 'left';
      } else {
        direction = 'up';
      }
      
      // Custom gesture callback
      this.config.onGesture?.(`swipe-${direction}`, this.getGestureState());
    }
  }

  /**
   * Handle long press
   */
  private handleLongPress(x: number, y: number): void {
    if (!this.config.longPress) return;
    
    // Convert to element coordinates
    const rect = this.element.node()!.getBoundingClientRect();
    const elementX = x - rect.left;
    const elementY = y - rect.top;
    
    // Emit context menu event
    if (this.onInteraction) {
      this.onInteraction({
        type: 'contextmenu',
        context: { x, y, chartX: elementX, chartY: elementY }
      });
    }
    
    // Custom gesture callback
    this.config.onGesture?.('longpress', this.getGestureState());
  }

  /**
   * Cancel long press timer
   */
  private cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  /**
   * Get current gesture state
   */
  private getGestureState(): TouchGestureState {
    const touchArray = Array.from(this.touches.values());
    const center = this.calculateCenter(touchArray);
    
    return {
      touches: touchArray.map(t => ({ id: 0, x: t.x, y: t.y })),
      scale: this.lastScale,
      rotation: this.lastRotation,
      center
    };
  }

  /**
   * Calculate center of touches
   */
  private calculateCenter(touches: Array<{ x: number; y: number }>): { x: number; y: number } | undefined {
    if (touches.length === 0) return undefined;
    
    const sumX = touches.reduce((sum, t) => sum + t.x, 0);
    const sumY = touches.reduce((sum, t) => sum + t.y, 0);
    
    return {
      x: sumX / touches.length,
      y: sumY / touches.length
    };
  }

  /**
   * Reset gesture state
   */
  private resetGestureState(): void {
    this.lastScale = 1;
    this.lastRotation = 0;
    this.initialDistance = 0;
    this.initialAngle = 0;
    this.swipeStartTime = 0;
    this.swipeStartX = 0;
    this.swipeStartY = 0;
  }

  /**
   * Emit gesture state
   */
  private emitGestureState(phase: string): void {
    if (this.onInteraction) {
      this.onInteraction({
        type: 'gesture',
        gesture: phase,
        state: this.getGestureState()
      });
    }
  }

  /**
   * Enable or disable touch gestures
   */
  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    
    const node = this.element.node();
    if (!node) return;
    
    if (enabled) {
      this.initialize();
    } else {
      node.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      node.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      node.removeEventListener('touchend', this.handleTouchEnd.bind(this));
      node.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
      
      node.style.touchAction = '';
      node.style.userSelect = '';
      node.style.webkitUserSelect = '';
    }
  }

  /**
   * Destroy touch gesture handler
   */
  public destroy(): void {
    this.setEnabled(false);
    this.cancelLongPress();
    this.touches.clear();
    this.resetGestureState();
  }
}