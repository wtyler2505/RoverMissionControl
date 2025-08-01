/**
 * BackpressureManager - Advanced Flow Control and Backpressure Handling
 * Manages message flow rates, congestion detection, and adaptive throttling
 */

import { MessageType, Priority } from './types';

export interface BackpressureConfig {
  maxOutstandingMessages: number;
  maxBytesInFlight: number;
  minThroughput: number; // messages/second
  maxThroughput: number; // messages/second
  congestionThreshold: number; // percentage (0-1)
  adaptiveThrottling: boolean;
  sampleWindow: number; // milliseconds
  burstCapacity: number; // max messages in burst
  burstWindow: number; // milliseconds
}

export interface FlowControlStats {
  outstandingMessages: number;
  bytesInFlight: number;
  currentThroughput: number;
  targetThroughput: number;
  congestionLevel: number; // 0-1
  droppedMessages: number;
  throttledMessages: number;
  backpressureActive: boolean;
  lastAdjustment: number;
}

export interface BackpressureCallbacks {
  onBackpressureChange?: (active: boolean, level: number) => void;
  onThroughputAdjust?: (oldRate: number, newRate: number) => void;
  onMessageDropped?: (messageId: string, reason: string) => void;
  onCongestion?: (level: number) => void;
}

interface MessageRecord {
  id: string;
  size: number;
  timestamp: number;
  acknowledged: boolean;
}

interface ThroughputSample {
  timestamp: number;
  messageCount: number;
  byteCount: number;
}

export class BackpressureManager {
  private config: BackpressureConfig;
  private callbacks: BackpressureCallbacks;
  private outstandingMessages = new Map<string, MessageRecord>();
  private throughputSamples: ThroughputSample[] = [];
  private stats: FlowControlStats;
  private throttleTimer?: NodeJS.Timeout;
  private adjustmentTimer?: NodeJS.Timeout;
  private burstTokens: number;
  private lastBurstRefill: number;
  private congestionStartTime?: number;
  private lastMessageTime = 0;
  private messageRate = 0;

  constructor(
    config: Partial<BackpressureConfig> = {},
    callbacks: BackpressureCallbacks = {}
  ) {
    this.config = {
      maxOutstandingMessages: 100,
      maxBytesInFlight: 1024 * 1024, // 1MB
      minThroughput: 10,
      maxThroughput: 1000,
      congestionThreshold: 0.8,
      adaptiveThrottling: true,
      sampleWindow: 5000,
      burstCapacity: 50,
      burstWindow: 1000,
      ...config
    };

    this.callbacks = callbacks;
    this.burstTokens = this.config.burstCapacity;
    this.lastBurstRefill = Date.now();

    this.stats = {
      outstandingMessages: 0,
      bytesInFlight: 0,
      currentThroughput: 0,
      targetThroughput: this.config.maxThroughput,
      congestionLevel: 0,
      droppedMessages: 0,
      throttledMessages: 0,
      backpressureActive: false,
      lastAdjustment: Date.now()
    };

    if (this.config.adaptiveThrottling) {
      this.startAdaptiveThrottling();
    }
  }

  /**
   * Check if a message can be sent based on current backpressure
   */
  canSend(
    messageSize: number,
    priority: Priority = Priority.NORMAL
  ): { allowed: boolean; reason?: string } {
    // Always allow critical messages
    if (priority === Priority.CRITICAL) {
      return { allowed: true };
    }

    // Check outstanding message limit
    if (this.stats.outstandingMessages >= this.config.maxOutstandingMessages) {
      return { 
        allowed: false, 
        reason: `Outstanding message limit reached (${this.stats.outstandingMessages}/${this.config.maxOutstandingMessages})` 
      };
    }

    // Check bytes in flight limit
    if (this.stats.bytesInFlight + messageSize > this.config.maxBytesInFlight) {
      return { 
        allowed: false, 
        reason: `Bytes in flight limit exceeded (${this.stats.bytesInFlight + messageSize}/${this.config.maxBytesInFlight})` 
      };
    }

    // Check congestion level for low priority messages
    if (priority === Priority.LOW && this.stats.congestionLevel > 0.9) {
      return { 
        allowed: false, 
        reason: 'High congestion - low priority messages blocked' 
      };
    }

    // Check rate limiting
    const now = Date.now();
    const timeSinceLastMessage = now - this.lastMessageTime;
    const minInterval = 1000 / this.stats.targetThroughput;

    if (timeSinceLastMessage < minInterval) {
      // Check burst capacity
      if (this.consumeBurstToken()) {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        reason: `Rate limit exceeded (target: ${this.stats.targetThroughput} msg/s)` 
      };
    }

    return { allowed: true };
  }

  /**
   * Register a message as sent
   */
  onMessageSent(messageId: string, size: number): void {
    this.outstandingMessages.set(messageId, {
      id: messageId,
      size,
      timestamp: Date.now(),
      acknowledged: false
    });

    this.stats.outstandingMessages = this.outstandingMessages.size;
    this.stats.bytesInFlight += size;
    this.lastMessageTime = Date.now();

    // Update throughput samples
    this.recordThroughputSample(1, size);
    
    // Check for backpressure activation
    this.updateBackpressureState();
  }

  /**
   * Mark a message as acknowledged
   */
  onMessageAcknowledged(messageId: string): void {
    const message = this.outstandingMessages.get(messageId);
    if (!message) return;

    message.acknowledged = true;
    this.outstandingMessages.delete(messageId);
    
    this.stats.outstandingMessages = this.outstandingMessages.size;
    this.stats.bytesInFlight -= message.size;

    // Calculate round-trip time for congestion detection
    const rtt = Date.now() - message.timestamp;
    this.updateCongestionLevel(rtt);

    this.updateBackpressureState();
  }

  /**
   * Handle message timeout or failure
   */
  onMessageFailed(messageId: string): void {
    const message = this.outstandingMessages.get(messageId);
    if (!message) return;

    this.outstandingMessages.delete(messageId);
    this.stats.outstandingMessages = this.outstandingMessages.size;
    this.stats.bytesInFlight -= message.size;

    // Increase congestion level on failure
    this.stats.congestionLevel = Math.min(1, this.stats.congestionLevel + 0.1);
    
    this.updateBackpressureState();
  }

  /**
   * Apply throttling to a message send operation
   */
  async throttle(priority: Priority = Priority.NORMAL): Promise<void> {
    const delay = this.calculateThrottleDelay(priority);
    if (delay > 0) {
      this.stats.throttledMessages++;
      await this.delay(delay);
    }
  }

  /**
   * Drop a message due to backpressure
   */
  dropMessage(messageId: string, reason: string): void {
    this.stats.droppedMessages++;
    this.callbacks.onMessageDropped?.(messageId, reason);
  }

  /**
   * Get current flow control statistics
   */
  getStats(): FlowControlStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.droppedMessages = 0;
    this.stats.throttledMessages = 0;
  }

  /**
   * Clean up old outstanding messages
   */
  cleanupStaleMessages(maxAge: number = 30000): void {
    const now = Date.now();
    const staleMessages: string[] = [];

    this.outstandingMessages.forEach((message, id) => {
      if (now - message.timestamp > maxAge) {
        staleMessages.push(id);
      }
    });

    staleMessages.forEach(id => {
      this.onMessageFailed(id);
    });
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }
    if (this.adjustmentTimer) {
      clearInterval(this.adjustmentTimer);
    }
    this.outstandingMessages.clear();
  }

  private startAdaptiveThrottling(): void {
    // Periodically adjust throughput based on congestion
    this.adjustmentTimer = setInterval(() => {
      this.adjustThroughput();
      this.cleanupStaleMessages();
    }, 1000);
  }

  private adjustThroughput(): void {
    const now = Date.now();
    
    // Calculate current throughput
    const recentSamples = this.throughputSamples.filter(
      s => now - s.timestamp < this.config.sampleWindow
    );
    
    if (recentSamples.length > 0) {
      const totalMessages = recentSamples.reduce((sum, s) => sum + s.messageCount, 0);
      const timeWindow = (now - recentSamples[0].timestamp) / 1000;
      this.stats.currentThroughput = totalMessages / timeWindow;
    }

    // Adjust target throughput based on congestion
    const oldTarget = this.stats.targetThroughput;
    
    if (this.stats.congestionLevel > this.config.congestionThreshold) {
      // Decrease throughput
      this.stats.targetThroughput = Math.max(
        this.config.minThroughput,
        this.stats.targetThroughput * 0.8
      );
    } else if (this.stats.congestionLevel < 0.3) {
      // Increase throughput
      this.stats.targetThroughput = Math.min(
        this.config.maxThroughput,
        this.stats.targetThroughput * 1.1
      );
    }

    if (oldTarget !== this.stats.targetThroughput) {
      this.stats.lastAdjustment = now;
      this.callbacks.onThroughputAdjust?.(oldTarget, this.stats.targetThroughput);
    }

    // Clean old samples
    this.throughputSamples = recentSamples;
  }

  private updateBackpressureState(): void {
    const wasActive = this.stats.backpressureActive;
    
    // Calculate backpressure based on multiple factors
    const messageRatio = this.stats.outstandingMessages / this.config.maxOutstandingMessages;
    const bytesRatio = this.stats.bytesInFlight / this.config.maxBytesInFlight;
    const congestion = this.stats.congestionLevel;
    
    const pressure = Math.max(messageRatio, bytesRatio, congestion);
    
    this.stats.backpressureActive = pressure > this.config.congestionThreshold;
    
    if (wasActive !== this.stats.backpressureActive) {
      this.callbacks.onBackpressureChange?.(this.stats.backpressureActive, pressure);
    }
  }

  private updateCongestionLevel(rtt: number): void {
    // Simple congestion detection based on RTT
    const baseRtt = 50; // Expected RTT in good conditions
    const congestionFactor = Math.min(1, (rtt - baseRtt) / 1000);
    
    // Exponential moving average
    this.stats.congestionLevel = 
      this.stats.congestionLevel * 0.7 + congestionFactor * 0.3;
    
    if (this.stats.congestionLevel > this.config.congestionThreshold) {
      if (!this.congestionStartTime) {
        this.congestionStartTime = Date.now();
      }
      this.callbacks.onCongestion?.(this.stats.congestionLevel);
    } else {
      this.congestionStartTime = undefined;
    }
  }

  private calculateThrottleDelay(priority: Priority): number {
    if (!this.stats.backpressureActive) return 0;
    
    const basedelay = 1000 / this.stats.targetThroughput;
    const priorityMultiplier = {
      [Priority.CRITICAL]: 0,
      [Priority.HIGH]: 0.5,
      [Priority.NORMAL]: 1,
      [Priority.LOW]: 2
    };
    
    return basedelay * priorityMultiplier[priority] * this.stats.congestionLevel;
  }

  private consumeBurstToken(): boolean {
    const now = Date.now();
    
    // Refill burst tokens
    const timeSinceRefill = now - this.lastBurstRefill;
    if (timeSinceRefill >= this.config.burstWindow) {
      this.burstTokens = this.config.burstCapacity;
      this.lastBurstRefill = now;
    }
    
    if (this.burstTokens > 0) {
      this.burstTokens--;
      return true;
    }
    
    return false;
  }

  private recordThroughputSample(messageCount: number, byteCount: number): void {
    this.throughputSamples.push({
      timestamp: Date.now(),
      messageCount,
      byteCount
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}