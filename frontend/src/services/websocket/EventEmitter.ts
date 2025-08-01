/**
 * Simple EventEmitter implementation for browser environments
 * Provides a subset of Node.js EventEmitter functionality
 */

type EventListener = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string | symbol, EventListener[]> = new Map();
  private maxListeners = 10;

  /**
   * Add a listener for the given event
   */
  on(event: string | symbol, listener: EventListener): this {
    return this.addListener(event, listener);
  }

  /**
   * Add a listener for the given event
   */
  addListener(event: string | symbol, listener: EventListener): this {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    
    const listeners = this.events.get(event)!;
    listeners.push(listener);
    
    // Warn if listener count exceeds max
    if (listeners.length > this.maxListeners && this.maxListeners !== 0) {
      console.warn(
        `Warning: Possible EventEmitter memory leak detected. ` +
        `${listeners.length} ${String(event)} listeners added. ` +
        `Use emitter.setMaxListeners() to increase limit`
      );
    }
    
    return this;
  }

  /**
   * Add a one-time listener for the given event
   */
  once(event: string | symbol, listener: EventListener): this {
    const onceWrapper = (...args: any[]) => {
      this.removeListener(event, onceWrapper);
      listener.apply(this, args);
    };
    
    // Preserve original listener for removeListener
    (onceWrapper as any).listener = listener;
    
    return this.on(event, onceWrapper);
  }

  /**
   * Remove a listener from the given event
   */
  removeListener(event: string | symbol, listener: EventListener): this {
    const listeners = this.events.get(event);
    if (!listeners) return this;
    
    const index = listeners.findIndex(l => 
      l === listener || (l as any).listener === listener
    );
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
    
    if (listeners.length === 0) {
      this.events.delete(event);
    }
    
    return this;
  }

  /**
   * Alias for removeListener
   */
  off(event: string | symbol, listener: EventListener): this {
    return this.removeListener(event, listener);
  }

  /**
   * Remove all listeners for the given event, or all events
   */
  removeAllListeners(event?: string | symbol): this {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
    return this;
  }

  /**
   * Emit an event with the given arguments
   */
  emit(event: string | symbol, ...args: any[]): boolean {
    const listeners = this.events.get(event);
    if (!listeners || listeners.length === 0) return false;
    
    // Create a copy to avoid issues if listeners modify the array
    const listenersCopy = [...listeners];
    
    for (const listener of listenersCopy) {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    }
    
    return true;
  }

  /**
   * Return the number of listeners for the given event
   */
  listenerCount(event: string | symbol): number {
    const listeners = this.events.get(event);
    return listeners ? listeners.length : 0;
  }

  /**
   * Return an array of listeners for the given event
   */
  listeners(event: string | symbol): EventListener[] {
    const listeners = this.events.get(event);
    return listeners ? [...listeners] : [];
  }

  /**
   * Return an array of event names
   */
  eventNames(): (string | symbol)[] {
    return Array.from(this.events.keys());
  }

  /**
   * Set the maximum number of listeners
   */
  setMaxListeners(max: number): this {
    this.maxListeners = max;
    return this;
  }

  /**
   * Get the maximum number of listeners
   */
  getMaxListeners(): number {
    return this.maxListeners;
  }
}

// Export as both named and default
export default EventEmitter;

/**
 * Type-safe EventEmitter for specific event maps
 * Can be used as: EventEmitter<MyEventMap>
 */
export type TypedEventListener<T = any> = (data: T) => void;

export interface EventMap {
  [event: string]: any;
}

/**
 * Generic type-safe EventEmitter
 * Usage: class MyEmitter extends TypedEventEmitter<MyEventMap> {}
 */
export class TypedEventEmitter<T extends EventMap = any> extends EventEmitter {
  on<K extends keyof T>(event: K, listener: TypedEventListener<T[K]>): this {
    return super.on(event as string | symbol, listener);
  }

  off<K extends keyof T>(event: K, listener: TypedEventListener<T[K]>): this {
    return super.off(event as string | symbol, listener);
  }

  once<K extends keyof T>(event: K, listener: TypedEventListener<T[K]>): this {
    return super.once(event as string | symbol, listener);
  }

  emit<K extends keyof T>(event: K, data: T[K]): boolean {
    return super.emit(event as string | symbol, data);
  }

  removeListener<K extends keyof T>(event: K, listener: TypedEventListener<T[K]>): this {
    return super.removeListener(event as string | symbol, listener);
  }

  removeAllListeners<K extends keyof T>(event?: K): this {
    return super.removeAllListeners(event as string | symbol | undefined);
  }

  listenerCount<K extends keyof T>(event: K): number {
    return super.listenerCount(event as string | symbol);
  }

  listeners<K extends keyof T>(event: K): TypedEventListener<T[K]>[] {
    return super.listeners(event as string | symbol) as TypedEventListener<T[K]>[];
  }
}