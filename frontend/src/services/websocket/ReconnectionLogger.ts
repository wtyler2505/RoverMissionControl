/**
 * ReconnectionLogger - Telemetry and logging for WebSocket reconnection events
 * Tracks reconnection attempts, success rates, and performance metrics
 */

import { ConnectionState, ReconnectAttemptData, ConnectionMetrics } from './types';

export interface ReconnectionEvent {
  timestamp: number;
  type: 'attempt' | 'success' | 'failure' | 'manual' | 'give_up';
  attemptNumber: number;
  delay?: number;
  error?: string;
  state: ConnectionState;
  metrics?: ConnectionMetrics;
}

export interface ReconnectionStats {
  totalAttempts: number;
  successfulReconnections: number;
  failedReconnections: number;
  manualReconnections: number;
  averageReconnectionTime: number;
  lastReconnectionTime?: number;
  events: ReconnectionEvent[];
}

export class ReconnectionLogger {
  private stats: ReconnectionStats = {
    totalAttempts: 0,
    successfulReconnections: 0,
    failedReconnections: 0,
    manualReconnections: 0,
    averageReconnectionTime: 0,
    events: []
  };

  private reconnectionStartTime: number | null = null;
  private maxEventHistory = 100;

  /**
   * Log a reconnection attempt
   */
  logAttempt(data: ReconnectAttemptData, state: ConnectionState): void {
    this.stats.totalAttempts++;
    this.reconnectionStartTime = Date.now();

    const event: ReconnectionEvent = {
      timestamp: Date.now(),
      type: 'attempt',
      attemptNumber: data.attemptNumber,
      delay: data.nextRetryIn,
      state
    };

    this.addEvent(event);
    this.sendTelemetry('reconnection_attempt', event);
  }

  /**
   * Log successful reconnection
   */
  logSuccess(attemptNumber: number, state: ConnectionState, metrics?: ConnectionMetrics): void {
    const reconnectionTime = this.reconnectionStartTime 
      ? Date.now() - this.reconnectionStartTime 
      : 0;

    this.stats.successfulReconnections++;
    this.stats.lastReconnectionTime = Date.now();
    
    // Update average reconnection time
    const totalTime = this.stats.averageReconnectionTime * (this.stats.successfulReconnections - 1) + reconnectionTime;
    this.stats.averageReconnectionTime = totalTime / this.stats.successfulReconnections;

    const event: ReconnectionEvent = {
      timestamp: Date.now(),
      type: 'success',
      attemptNumber,
      delay: reconnectionTime,
      state,
      metrics
    };

    this.addEvent(event);
    this.sendTelemetry('reconnection_success', {
      ...event,
      reconnectionTime,
      totalAttempts: this.stats.totalAttempts
    });

    this.reconnectionStartTime = null;
  }

  /**
   * Log failed reconnection
   */
  logFailure(attemptNumber: number, error: Error, state: ConnectionState): void {
    this.stats.failedReconnections++;

    const event: ReconnectionEvent = {
      timestamp: Date.now(),
      type: 'failure',
      attemptNumber,
      error: error.message,
      state
    };

    this.addEvent(event);
    this.sendTelemetry('reconnection_failure', event);
  }

  /**
   * Log manual reconnection
   */
  logManualReconnect(state: ConnectionState): void {
    this.stats.manualReconnections++;
    this.reconnectionStartTime = Date.now();

    const event: ReconnectionEvent = {
      timestamp: Date.now(),
      type: 'manual',
      attemptNumber: 0,
      state
    };

    this.addEvent(event);
    this.sendTelemetry('manual_reconnection', event);
  }

  /**
   * Log when giving up on reconnection
   */
  logGiveUp(attemptNumber: number, state: ConnectionState): void {
    const event: ReconnectionEvent = {
      timestamp: Date.now(),
      type: 'give_up',
      attemptNumber,
      state
    };

    this.addEvent(event);
    this.sendTelemetry('reconnection_give_up', {
      ...event,
      totalAttempts: this.stats.totalAttempts,
      duration: this.reconnectionStartTime ? Date.now() - this.reconnectionStartTime : 0
    });

    this.reconnectionStartTime = null;
  }

  /**
   * Get current statistics
   */
  getStats(): ReconnectionStats {
    return { ...this.stats };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit = 10): ReconnectionEvent[] {
    return this.stats.events.slice(-limit);
  }

  /**
   * Clear statistics
   */
  clearStats(): void {
    this.stats = {
      totalAttempts: 0,
      successfulReconnections: 0,
      failedReconnections: 0,
      manualReconnections: 0,
      averageReconnectionTime: 0,
      events: []
    };
    this.reconnectionStartTime = null;
  }

  /**
   * Export statistics as JSON
   */
  exportStats(): string {
    return JSON.stringify({
      stats: this.stats,
      exportTime: Date.now(),
      sessionInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        onLine: navigator.onLine
      }
    }, null, 2);
  }

  private addEvent(event: ReconnectionEvent): void {
    this.stats.events.push(event);
    
    // Limit event history
    if (this.stats.events.length > this.maxEventHistory) {
      this.stats.events = this.stats.events.slice(-this.maxEventHistory);
    }
  }

  private sendTelemetry(eventType: string, data: any): void {
    // Send to analytics service if available
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track(eventType, data);
    }

    // Log to console in debug mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[WebSocket Telemetry] ${eventType}:`, data);
    }

    // Could also send to a backend telemetry endpoint
    // Example:
    // fetch('/api/telemetry', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ event: eventType, data, timestamp: Date.now() })
    // }).catch(() => {});
  }
}