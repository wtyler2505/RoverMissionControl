/**
 * ReconnectionManager - Advanced reconnection logic with exponential backoff
 * Implements exponential backoff, jitter, circuit breaker, and telemetry
 */

import { EventEmitter } from 'events';
import { ConnectionState, WebSocketError, ErrorSeverity } from './types';

/**
 * Reconnection strategy types
 */
export enum ReconnectionStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  CONSTANT = 'constant',
  FIBONACCI = 'fibonacci'
}

/**
 * Jitter types for randomization
 */
export enum JitterType {
  NONE = 'none',
  FULL = 'full',
  EQUAL = 'equal',
  DECORRELATED = 'decorrelated'
}

/**
 * Circuit breaker states
 */
export enum CircuitState {
  CLOSED = 'closed',    // Normal operation
  OPEN = 'open',        // Failing, no attempts
  HALF_OPEN = 'half_open' // Testing recovery
}

/**
 * Reconnection configuration
 */
export interface ReconnectionConfig {
  strategy: ReconnectionStrategy;
  baseDelay: number;              // Base delay in ms (default: 500)
  maxDelay: number;               // Maximum delay in ms (default: 30000)
  maxAttempts: number;            // Maximum retry attempts (default: 10)
  factor: number;                 // Multiplier for exponential (default: 2)
  jitterType: JitterType;         // Jitter pattern (default: EQUAL)
  jitterFactor: number;           // Jitter randomization factor (default: 0.3)
  resetTimeout: number;           // Time to reset attempt counter (default: 60000)
  circuitBreakerThreshold: number; // Failures to open circuit (default: 5)
  circuitBreakerTimeout: number;   // Circuit breaker timeout (default: 30000)
  enableTelemetry: boolean;       // Enable detailed telemetry (default: true)
}

/**
 * Default configuration values
 */
export const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
  strategy: ReconnectionStrategy.EXPONENTIAL,
  baseDelay: 500,
  maxDelay: 30000,
  maxAttempts: 10,
  factor: 2,
  jitterType: JitterType.EQUAL,
  jitterFactor: 0.3,
  resetTimeout: 60000,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 30000,
  enableTelemetry: true
};

/**
 * Reconnection attempt data
 */
export interface ReconnectionAttempt {
  attemptNumber: number;
  delay: number;
  scheduledAt: number;
  executedAt?: number;
  success: boolean;
  error?: WebSocketError;
  circuitState: CircuitState;
}

/**
 * Reconnection metrics
 */
export interface ReconnectionMetrics {
  totalAttempts: number;
  successfulReconnections: number;
  failedReconnections: number;
  averageDelay: number;
  maxDelay: number;
  circuitBreakerActivations: number;
  lastAttemptTime?: number;
  lastSuccessTime?: number;
  currentStreak: number;
  longestStreak: number;
}

/**
 * ReconnectionManager class
 */
export class ReconnectionManager extends EventEmitter {
  private config: ReconnectionConfig;
  private attemptNumber: number = 0;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures: number = 0;
  private lastAttemptTime: number = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private circuitBreakerTimer?: NodeJS.Timeout;
  private resetTimer?: NodeJS.Timeout;
  private attempts: ReconnectionAttempt[] = [];
  private metrics: ReconnectionMetrics;
  private previousDelay: number = 0;

  constructor(config: Partial<ReconnectionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_RECONNECTION_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): ReconnectionMetrics {
    return {
      totalAttempts: 0,
      successfulReconnections: 0,
      failedReconnections: 0,
      averageDelay: 0,
      maxDelay: 0,
      circuitBreakerActivations: 0,
      currentStreak: 0,
      longestStreak: 0
    };
  }

  /**
   * Schedule a reconnection attempt
   */
  public scheduleReconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check circuit breaker
      if (this.circuitState === CircuitState.OPEN) {
        const error: WebSocketError = {
          code: 'CIRCUIT_BREAKER_OPEN',
          message: 'Circuit breaker is open, reconnection disabled',
          severity: ErrorSeverity.HIGH,
          timestamp: Date.now(),
          context: { circuitState: this.circuitState }
        };
        this.emit('circuit-breaker-open', error);
        reject(error);
        return;
      }

      // Check max attempts
      if (this.attemptNumber >= this.config.maxAttempts) {
        const error: WebSocketError = {
          code: 'MAX_ATTEMPTS_REACHED',
          message: `Maximum reconnection attempts (${this.config.maxAttempts}) reached`,
          severity: ErrorSeverity.HIGH,
          timestamp: Date.now(),
          context: { attempts: this.attemptNumber }
        };
        this.emit('max-attempts-reached', error);
        this.openCircuitBreaker();
        reject(error);
        return;
      }

      // Calculate delay with strategy and jitter
      const delay = this.calculateDelay();
      this.attemptNumber++;

      // Create attempt record
      const attempt: ReconnectionAttempt = {
        attemptNumber: this.attemptNumber,
        delay,
        scheduledAt: Date.now(),
        success: false,
        circuitState: this.circuitState
      };
      this.attempts.push(attempt);

      // Emit scheduling event
      this.emit('reconnect-scheduled', {
        attempt: this.attemptNumber,
        delay,
        nextAttemptTime: Date.now() + delay
      });

      // Clear existing timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }

      // Schedule reconnection
      this.reconnectTimer = setTimeout(() => {
        attempt.executedAt = Date.now();
        this.lastAttemptTime = Date.now();
        this.metrics.totalAttempts++;
        
        this.emit('reconnect-attempt', {
          attempt: this.attemptNumber,
          totalAttempts: this.metrics.totalAttempts
        });
        
        resolve();
      }, delay);

      // Set reset timer
      this.setResetTimer();
    });
  }

  /**
   * Calculate delay based on strategy and jitter
   */
  private calculateDelay(): number {
    let baseDelay: number;

    switch (this.config.strategy) {
      case ReconnectionStrategy.EXPONENTIAL:
        baseDelay = Math.min(
          this.config.baseDelay * Math.pow(this.config.factor, this.attemptNumber),
          this.config.maxDelay
        );
        break;

      case ReconnectionStrategy.LINEAR:
        baseDelay = Math.min(
          this.config.baseDelay + (this.config.baseDelay * this.attemptNumber),
          this.config.maxDelay
        );
        break;

      case ReconnectionStrategy.FIBONACCI:
        baseDelay = Math.min(
          this.calculateFibonacciDelay(this.attemptNumber),
          this.config.maxDelay
        );
        break;

      case ReconnectionStrategy.CONSTANT:
      default:
        baseDelay = this.config.baseDelay;
    }

    // Apply jitter
    const delayWithJitter = this.applyJitter(baseDelay);
    
    // Update metrics
    this.metrics.maxDelay = Math.max(this.metrics.maxDelay, delayWithJitter);
    
    return delayWithJitter;
  }

  /**
   * Calculate Fibonacci delay
   */
  private calculateFibonacciDelay(n: number): number {
    if (n <= 1) return this.config.baseDelay;
    let a = this.config.baseDelay;
    let b = this.config.baseDelay;
    for (let i = 2; i <= n; i++) {
      const temp = a + b;
      a = b;
      b = temp;
    }
    return b;
  }

  /**
   * Apply jitter to delay
   */
  private applyJitter(delay: number): number {
    switch (this.config.jitterType) {
      case JitterType.FULL:
        // Full jitter: random between 0 and delay
        return Math.random() * delay;

      case JitterType.EQUAL:
        // Equal jitter: half constant, half random
        return delay / 2 + (Math.random() * delay / 2);

      case JitterType.DECORRELATED:
        // Decorrelated jitter: based on previous delay
        const decorrelated = Math.min(
          this.config.maxDelay,
          Math.random() * 3 * this.previousDelay
        );
        this.previousDelay = decorrelated;
        return decorrelated || this.config.baseDelay;

      case JitterType.NONE:
      default:
        return delay;
    }
  }

  /**
   * Mark reconnection attempt as successful
   */
  public onReconnectSuccess(): void {
    const lastAttempt = this.attempts[this.attempts.length - 1];
    if (lastAttempt) {
      lastAttempt.success = true;
    }

    this.metrics.successfulReconnections++;
    this.metrics.lastSuccessTime = Date.now();
    this.metrics.currentStreak++;
    this.metrics.longestStreak = Math.max(
      this.metrics.longestStreak,
      this.metrics.currentStreak
    );

    // Update average delay
    const totalDelay = this.attempts.reduce((sum, a) => sum + a.delay, 0);
    this.metrics.averageDelay = totalDelay / this.attempts.length;

    // Reset state
    this.attemptNumber = 0;
    this.consecutiveFailures = 0;
    this.closeCircuitBreaker();
    this.clearTimers();

    this.emit('reconnect-success', {
      attempts: this.attemptNumber,
      totalTime: Date.now() - this.attempts[0].scheduledAt
    });
  }

  /**
   * Mark reconnection attempt as failed
   */
  public onReconnectFailure(error: WebSocketError): void {
    const lastAttempt = this.attempts[this.attempts.length - 1];
    if (lastAttempt) {
      lastAttempt.success = false;
      lastAttempt.error = error;
    }

    this.metrics.failedReconnections++;
    this.metrics.currentStreak = 0;
    this.consecutiveFailures++;

    // Check circuit breaker threshold
    if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
      this.openCircuitBreaker();
    }

    this.emit('reconnect-failure', {
      attempt: this.attemptNumber,
      error,
      nextRetry: this.attemptNumber < this.config.maxAttempts
    });
  }

  /**
   * Open circuit breaker
   */
  private openCircuitBreaker(): void {
    if (this.circuitState === CircuitState.OPEN) return;

    this.circuitState = CircuitState.OPEN;
    this.metrics.circuitBreakerActivations++;

    this.emit('circuit-breaker-state-change', {
      previousState: CircuitState.CLOSED,
      currentState: CircuitState.OPEN,
      reason: 'Consecutive failures exceeded threshold'
    });

    // Schedule half-open transition
    this.circuitBreakerTimer = setTimeout(() => {
      this.circuitState = CircuitState.HALF_OPEN;
      this.emit('circuit-breaker-state-change', {
        previousState: CircuitState.OPEN,
        currentState: CircuitState.HALF_OPEN,
        reason: 'Testing recovery'
      });
    }, this.config.circuitBreakerTimeout);
  }

  /**
   * Close circuit breaker
   */
  private closeCircuitBreaker(): void {
    if (this.circuitState === CircuitState.CLOSED) return;

    const previousState = this.circuitState;
    this.circuitState = CircuitState.CLOSED;

    this.emit('circuit-breaker-state-change', {
      previousState,
      currentState: CircuitState.CLOSED,
      reason: 'Connection recovered'
    });

    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
      this.circuitBreakerTimer = undefined;
    }
  }

  /**
   * Set reset timer
   */
  private setResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      if (this.attemptNumber > 0) {
        this.attemptNumber = 0;
        this.emit('attempt-counter-reset', {
          reason: 'Reset timeout reached',
          timeout: this.config.resetTimeout
        });
      }
    }, this.config.resetTimeout);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.circuitBreakerTimer) {
      clearTimeout(this.circuitBreakerTimer);
      this.circuitBreakerTimer = undefined;
    }
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = undefined;
    }
  }

  /**
   * Cancel pending reconnection
   */
  public cancelReconnect(): void {
    this.clearTimers();
    this.emit('reconnect-cancelled', {
      pendingAttempts: this.config.maxAttempts - this.attemptNumber
    });
  }

  /**
   * Reset reconnection state
   */
  public reset(): void {
    this.attemptNumber = 0;
    this.consecutiveFailures = 0;
    this.attempts = [];
    this.previousDelay = 0;
    this.closeCircuitBreaker();
    this.clearTimers();
    this.emit('reconnect-reset');
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ReconnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent attempts
   */
  public getRecentAttempts(limit: number = 10): ReconnectionAttempt[] {
    return this.attempts.slice(-limit);
  }

  /**
   * Get circuit breaker state
   */
  public getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get next retry delay
   */
  public getNextRetryDelay(): number {
    return this.calculateDelay();
  }

  /**
   * Check if reconnection is allowed
   */
  public canReconnect(): boolean {
    return (
      this.circuitState !== CircuitState.OPEN &&
      this.attemptNumber < this.config.maxAttempts
    );
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ReconnectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config-updated', this.config);
  }

  /**
   * Destroy manager
   */
  public destroy(): void {
    this.clearTimers();
    this.removeAllListeners();
  }
}