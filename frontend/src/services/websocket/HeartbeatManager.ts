/**
 * HeartbeatManager - Manages WebSocket heartbeat/ping-pong mechanism
 * Sends periodic pings and monitors pongs to detect connection health
 */

import { Socket } from 'socket.io-client';
import { HeartbeatData, ConnectionEvent } from './types';

export interface HeartbeatConfig {
  interval: number;          // Interval between heartbeats (ms)
  timeout: number;           // Timeout to wait for pong response (ms)
  maxMissedHeartbeats: number; // Number of missed heartbeats before declaring connection dead
  enablePing?: boolean;      // Enable client-initiated ping
  enablePong?: boolean;      // Respond to server pings
}

export interface HeartbeatStats {
  totalSent: number;
  totalReceived: number;
  missedCount: number;
  consecutiveMissed: number;
  averageLatency: number;
  lastLatency: number;
  lastHeartbeatTime: number;
  isHealthy: boolean;
}

export interface HeartbeatCallbacks {
  onHeartbeat?: (data: HeartbeatData) => void;
  onTimeout?: (consecutiveMissed: number) => void;
  onUnhealthy?: (stats: HeartbeatStats) => void;
  onHealthy?: () => void;
  onLatencyWarning?: (latency: number) => void;
}

export class HeartbeatManager {
  private socket?: Socket;
  private config: HeartbeatConfig;
  private callbacks: HeartbeatCallbacks;
  
  private pingTimer?: NodeJS.Timeout;
  private pongTimer?: NodeJS.Timeout;
  private sequence = 0;
  private pendingPings = new Map<number, { timestamp: number; timer: NodeJS.Timeout }>();
  
  private stats: HeartbeatStats = {
    totalSent: 0,
    totalReceived: 0,
    missedCount: 0,
    consecutiveMissed: 0,
    averageLatency: 0,
    lastLatency: 0,
    lastHeartbeatTime: 0,
    isHealthy: true
  };

  constructor(config: HeartbeatConfig, callbacks: HeartbeatCallbacks = {}) {
    this.config = {
      enablePing: true,
      enablePong: true,
      ...config
    };
    this.callbacks = callbacks;
  }

  /**
   * Start heartbeat monitoring
   */
  start(socket: Socket): void {
    this.socket = socket;
    this.reset();
    
    // Setup socket event listeners
    this.setupSocketListeners();
    
    // Start ping interval if enabled
    if (this.config.enablePing) {
      this.startPingInterval();
    }
  }

  /**
   * Stop heartbeat monitoring
   */
  stop(): void {
    this.clearTimers();
    this.pendingPings.clear();
    this.socket = undefined;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = {
      totalSent: 0,
      totalReceived: 0,
      missedCount: 0,
      consecutiveMissed: 0,
      averageLatency: 0,
      lastLatency: 0,
      lastHeartbeatTime: 0,
      isHealthy: true
    };
    this.sequence = 0;
    this.pendingPings.clear();
  }

  /**
   * Get current heartbeat statistics
   */
  getStats(): HeartbeatStats {
    return { ...this.stats };
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.stats.isHealthy;
  }

  /**
   * Manually trigger a heartbeat
   */
  sendHeartbeat(): void {
    if (!this.socket?.connected) return;
    
    const sequence = ++this.sequence;
    const timestamp = Date.now();
    
    // Set timeout for this ping
    const timer = setTimeout(() => {
      this.handleMissedHeartbeat(sequence);
    }, this.config.timeout);
    
    this.pendingPings.set(sequence, { timestamp, timer });
    
    // Send ping
    this.socket.emit('ping', {
      sequence,
      clientTime: timestamp
    });
    
    this.stats.totalSent++;
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;
    
    // Handle pong responses
    this.socket.on('pong', (data: any) => {
      this.handlePong(data);
    });
    
    // Handle server-initiated pings (if we need to respond)
    if (this.config.enablePong) {
      this.socket.on('ping', (data: any) => {
        this.handleServerPing(data);
      });
    }
    
    // Handle heartbeat events (alternative to ping/pong)
    this.socket.on('heartbeat', (data: HeartbeatData) => {
      this.handleHeartbeat(data);
    });
  }

  private startPingInterval(): void {
    this.clearPingTimer();
    
    // Send first ping immediately
    this.sendHeartbeat();
    
    // Setup interval for subsequent pings
    this.pingTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.interval);
  }

  private handlePong(data: any): void {
    const { sequence, serverTime } = data;
    const pending = this.pendingPings.get(sequence);
    
    if (!pending) return;
    
    // Clear timeout
    clearTimeout(pending.timer);
    this.pendingPings.delete(sequence);
    
    // Calculate latency
    const now = Date.now();
    const latency = now - pending.timestamp;
    
    // Update stats
    this.stats.totalReceived++;
    this.stats.lastLatency = latency;
    this.stats.lastHeartbeatTime = now;
    this.stats.consecutiveMissed = 0;
    
    // Update average latency
    const totalLatency = this.stats.averageLatency * (this.stats.totalReceived - 1) + latency;
    this.stats.averageLatency = totalLatency / this.stats.totalReceived;
    
    // Check if we're back to healthy
    if (!this.stats.isHealthy) {
      this.stats.isHealthy = true;
      this.callbacks.onHealthy?.();
    }
    
    // Create heartbeat data
    const heartbeatData: HeartbeatData = {
      timestamp: now,
      clientTime: pending.timestamp,
      serverTime: serverTime || now,
      latency,
      sequence
    };
    
    // Notify callbacks
    this.callbacks.onHeartbeat?.(heartbeatData);
    
    // Check for high latency
    if (latency > this.config.timeout * 0.5) {
      this.callbacks.onLatencyWarning?.(latency);
    }
  }

  private handleServerPing(data: any): void {
    if (!this.socket?.connected) return;
    
    // Respond with pong
    this.socket.emit('pong', {
      sequence: data.sequence,
      serverTime: data.serverTime,
      clientTime: Date.now()
    });
  }

  private handleHeartbeat(data: HeartbeatData): void {
    // Update stats from heartbeat
    this.stats.lastHeartbeatTime = data.timestamp;
    this.stats.lastLatency = data.latency;
    this.stats.consecutiveMissed = 0;
    
    // Update average latency
    this.stats.totalReceived++;
    const totalLatency = this.stats.averageLatency * (this.stats.totalReceived - 1) + data.latency;
    this.stats.averageLatency = totalLatency / this.stats.totalReceived;
    
    // Check if we're back to healthy
    if (!this.stats.isHealthy) {
      this.stats.isHealthy = true;
      this.callbacks.onHealthy?.();
    }
    
    this.callbacks.onHeartbeat?.(data);
  }

  private handleMissedHeartbeat(sequence: number): void {
    const pending = this.pendingPings.get(sequence);
    if (!pending) return;
    
    this.pendingPings.delete(sequence);
    
    // Update stats
    this.stats.missedCount++;
    this.stats.consecutiveMissed++;
    
    // Check if connection is unhealthy
    if (this.stats.consecutiveMissed >= this.config.maxMissedHeartbeats) {
      this.stats.isHealthy = false;
      this.callbacks.onUnhealthy?.(this.stats);
      this.callbacks.onTimeout?.(this.stats.consecutiveMissed);
    }
  }

  private clearTimers(): void {
    this.clearPingTimer();
    this.clearPongTimers();
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  private clearPongTimers(): void {
    for (const [_, pending] of this.pendingPings) {
      clearTimeout(pending.timer);
    }
    this.pendingPings.clear();
  }

  /**
   * Export heartbeat data for debugging
   */
  exportData(): object {
    return {
      config: this.config,
      stats: this.stats,
      pendingPings: this.pendingPings.size,
      sequence: this.sequence,
      timestamp: Date.now()
    };
  }
}