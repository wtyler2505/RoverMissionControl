/**
 * MessageQueue - Advanced Message Queuing System
 * Handles offline message storage, prioritization, and retry logic
 */

import {
  QueuedMessage,
  MessageType,
  Priority,
  MessageStorage,
  WebSocketConfig
} from './types';
import { 
  BackpressureManager, 
  BackpressureConfig, 
  FlowControlStats,
  BackpressureCallbacks 
} from './BackpressureManager';

/**
 * IndexedDB-based message storage for offline persistence
 */
class IndexedDBStorage implements MessageStorage {
  private dbName = 'RoverWebSocketQueue';
  private version = 1;
  private storeName = 'messages';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('priority', 'priority', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
        }
      };
    });
  }

  async save(messages: QueuedMessage[]): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    // Clear existing messages
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    // Add new messages
    for (const message of messages) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add(message);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }
    
    db.close();
  }

  async load(): Promise<QueuedMessage[]> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const messages = request.result || [];
        // Sort by priority (descending) then timestamp (ascending)
        messages.sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.timestamp - b.timestamp;
        });
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async size(): Promise<number> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

/**
 * In-memory fallback storage for environments without IndexedDB
 */
class MemoryStorage implements MessageStorage {
  private messages: QueuedMessage[] = [];

  async save(messages: QueuedMessage[]): Promise<void> {
    this.messages = [...messages];
  }

  async load(): Promise<QueuedMessage[]> {
    return [...this.messages].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  async clear(): Promise<void> {
    this.messages = [];
  }

  async size(): Promise<number> {
    return this.messages.length;
  }
}

/**
 * Advanced message queue with prioritization, persistence, and retry logic
 */
export class MessageQueue {
  private messages: QueuedMessage[] = [];
  private processing = false;
  private storage: MessageStorage;
  private config: WebSocketConfig;
  private backpressureManager: BackpressureManager;
  private sendCallback?: (message: QueuedMessage) => Promise<boolean>;
  private processTimer?: NodeJS.Timeout;
  private throughputTimer?: NodeJS.Timeout;
  private lastProcessTime = 0;
  private processedCount = 0;
  private eventCallbacks: {
    onQueueUpdate?: (size: number, processing: boolean) => void;
    onMessageProcessed?: (message: QueuedMessage, success: boolean) => void;
    onError?: (error: Error, message?: QueuedMessage) => void;
    onBackpressure?: (active: boolean, stats: FlowControlStats) => void;
    onMessageDropped?: (message: QueuedMessage, reason: string) => void;
  } = {};

  constructor(config: WebSocketConfig) {
    this.config = config;
    
    // Initialize storage based on environment capabilities
    if (typeof indexedDB !== 'undefined') {
      this.storage = new IndexedDBStorage();
    } else {
      this.storage = new MemoryStorage();
      console.warn('IndexedDB not available, using memory storage for message queue');
    }
    
    // Initialize backpressure manager
    const backpressureConfig: Partial<BackpressureConfig> = {
      maxOutstandingMessages: Math.floor(this.config.queue.maxSize * 0.8),
      maxThroughput: 100, // messages per second
      adaptiveThrottling: true,
      congestionThreshold: 0.7
    };
    
    const backpressureCallbacks: BackpressureCallbacks = {
      onBackpressureChange: (active, level) => {
        const stats = this.backpressureManager.getStats();
        this.eventCallbacks.onBackpressure?.(active, stats);
      },
      onMessageDropped: (id, reason) => {
        const message = this.messages.find(m => m.id === id);
        if (message) {
          this.eventCallbacks.onMessageDropped?.(message, reason);
        }
      },
      onCongestion: (level) => {
        if (this.config.debug) {
          console.warn(`Queue congestion detected: ${(level * 100).toFixed(1)}%`);
        }
      }
    };
    
    this.backpressureManager = new BackpressureManager(
      backpressureConfig, 
      backpressureCallbacks
    );
    
    this.loadPersistedMessages();
    this.startThroughputMonitoring();
  }

  /**
   * Set the callback function for sending messages
   */
  setSendCallback(callback: (message: QueuedMessage) => Promise<boolean>): void {
    this.sendCallback = callback;
  }

  /**
   * Set event callbacks for queue updates
   */
  setEventCallbacks(callbacks: typeof this.eventCallbacks): void {
    this.eventCallbacks = { ...this.eventCallbacks, ...callbacks };
  }

  /**
   * Add a message to the queue
   */
  async enqueue(
    type: MessageType,
    payload: any,
    priority: Priority = Priority.NORMAL,
    maxRetries: number = 3,
    expiresAt?: number
  ): Promise<string> {
    const message: QueuedMessage = {
      id: this.generateMessageId(),
      type,
      payload,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      expiresAt
    };

    // Check backpressure before adding to queue
    const messageSize = JSON.stringify(payload).length;
    const canSend = this.backpressureManager.canSend(messageSize, priority);
    
    if (!canSend.allowed && priority !== Priority.CRITICAL) {
      // Apply backpressure policies
      if (this.messages.length >= this.config.queue.maxSize) {
        if (this.config.queue.priorityEnabled && priority > Priority.LOW) {
          // Try to remove a lower priority message
          const removed = this.removeLowerPriorityMessage(priority);
          if (!removed) {
            this.backpressureManager.dropMessage(message.id, canSend.reason || 'Queue full');
            throw new Error(`Message dropped: ${canSend.reason || 'Queue full'}`);
          }
        } else {
          this.backpressureManager.dropMessage(message.id, canSend.reason || 'Queue full');
          throw new Error(`Message dropped: ${canSend.reason || 'Queue full'}`);
        }
      }
    }

    // Check queue size limit
    if (this.messages.length >= this.config.queue.maxSize) {
      if (this.config.queue.priorityEnabled) {
        // Remove lowest priority message if queue is full
        this.removeLowPriorityMessage();
      } else {
        throw new Error('Message queue is full');
      }
    }

    this.messages.push(message);
    this.sortMessages();
    
    if (this.config.queue.persistOffline) {
      await this.persistMessages();
    }
    
    this.notifyQueueUpdate();
    
    // Start processing if not already running
    if (!this.processing && canSend.allowed) {
      this.scheduleProcessing();
    }
    
    return message.id;
  }

  /**
   * Remove a message from the queue
   */
  async dequeue(messageId: string): Promise<boolean> {
    const index = this.messages.findIndex(msg => msg.id === messageId);
    if (index === -1) return false;
    
    this.messages.splice(index, 1);
    
    if (this.config.queue.persistOffline) {
      await this.persistMessages();
    }
    
    this.notifyQueueUpdate();
    return true;
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.messages.length;
  }

  /**
   * Check if the queue is processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Get all messages in the queue (copy)
   */
  getMessages(): QueuedMessage[] {
    return [...this.messages];
  }

  /**
   * Clear all messages from the queue
   */
  async clear(): Promise<void> {
    this.messages = [];
    await this.storage.clear();
    this.notifyQueueUpdate();
  }

  /**
   * Start processing the queue
   */
  async processQueue(): Promise<void> {
    if (this.processing || !this.sendCallback) return;
    
    this.processing = true;
    this.lastProcessTime = Date.now();
    this.notifyQueueUpdate();
    
    try {
      while (this.messages.length > 0) {
        const message = this.getNextMessage();
        if (!message) break;
        
        // Check if message has expired
        if (message.expiresAt && Date.now() > message.expiresAt) {
          await this.dequeue(message.id);
          continue;
        }
        
        // Apply throttling based on backpressure
        await this.backpressureManager.throttle(message.priority);
        
        // Check if we can send based on current conditions
        const messageSize = JSON.stringify(message.payload).length;
        const canSend = this.backpressureManager.canSend(messageSize, message.priority);
        
        if (!canSend.allowed && message.priority !== Priority.CRITICAL) {
          // Defer processing if backpressure is too high
          if (this.config.debug) {
            console.log(`Deferring message due to backpressure: ${canSend.reason}`);
          }
          await this.delay(100);
          continue;
        }
        
        try {
          // Notify backpressure manager that we're sending
          this.backpressureManager.onMessageSent(message.id, messageSize);
          
          const success = await this.sendCallback(message);
          
          if (success) {
            this.backpressureManager.onMessageAcknowledged(message.id);
            await this.dequeue(message.id);
            this.processedCount++;
            this.eventCallbacks.onMessageProcessed?.(message, true);
          } else {
            this.backpressureManager.onMessageFailed(message.id);
            
            // Increment retry count
            message.retryCount++;
            
            if (message.retryCount >= message.maxRetries) {
              // Max retries reached, remove from queue
              await this.dequeue(message.id);
              this.eventCallbacks.onError?.(
                new Error(`Message failed after ${message.maxRetries} retries`),
                message
              );
            } else {
              // Re-sort queue to handle retry with exponential backoff
              message.timestamp = Date.now() + (1000 * Math.pow(2, message.retryCount));
              this.sortMessages();
              if (this.config.queue.persistOffline) {
                await this.persistMessages();
              }
            }
            
            this.eventCallbacks.onMessageProcessed?.(message, false);
          }
        } catch (error) {
          this.backpressureManager.onMessageFailed(message.id);
          message.retryCount++;
          
          if (message.retryCount >= message.maxRetries) {
            await this.dequeue(message.id);
          } else {
            // Apply exponential backoff for retries
            message.timestamp = Date.now() + (1000 * Math.pow(2, message.retryCount));
            this.sortMessages();
            if (this.config.queue.persistOffline) {
              await this.persistMessages();
            }
          }
          
          this.eventCallbacks.onError?.(error as Error, message);
          this.eventCallbacks.onMessageProcessed?.(message, false);
        }
        
        // Dynamic delay based on queue pressure
        const stats = this.backpressureManager.getStats();
        const delay = stats.backpressureActive ? 100 : 50;
        await this.delay(delay);
      }
    } finally {
      this.processing = false;
      this.notifyQueueUpdate();
      
      // Schedule next processing if there are still messages
      if (this.messages.length > 0) {
        this.scheduleProcessing(1000);
      }
    }
  }

  /**
   * Stop processing the queue
   */
  stopProcessing(): void {
    this.processing = false;
    this.notifyQueueUpdate();
  }

  /**
   * Get backpressure statistics
   */
  getBackpressureStats(): FlowControlStats {
    return this.backpressureManager.getStats();
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    byPriority: Record<Priority, number>;
    byType: Record<MessageType, number>;
    processing: boolean;
    oldestTimestamp?: number;
    newestTimestamp?: number;
    throughput: number;
    backpressure: FlowControlStats;
  } {
    const stats = {
      total: this.messages.length,
      byPriority: {} as Record<Priority, number>,
      byType: {} as Record<MessageType, number>,
      processing: this.processing,
      oldestTimestamp: undefined as number | undefined,
      newestTimestamp: undefined as number | undefined,
      throughput: this.calculateThroughput(),
      backpressure: this.backpressureManager.getStats()
    };
    
    // Initialize counters
    Object.values(Priority).forEach(priority => {
      if (typeof priority === 'number') {
        stats.byPriority[priority] = 0;
      }
    });
    
    Object.values(MessageType).forEach(type => {
      stats.byType[type] = 0;
    });
    
    // Count messages
    for (const message of this.messages) {
      stats.byPriority[message.priority]++;
      stats.byType[message.type]++;
      
      if (!stats.oldestTimestamp || message.timestamp < stats.oldestTimestamp) {
        stats.oldestTimestamp = message.timestamp;
      }
      
      if (!stats.newestTimestamp || message.timestamp > stats.newestTimestamp) {
        stats.newestTimestamp = message.timestamp;
      }
    }
    
    return stats;
  }

  /**
   * Export queue data for debugging
   */
  exportData(): string {
    return JSON.stringify({
      messages: this.messages,
      stats: this.getStats(),
      config: this.config.queue,
      timestamp: Date.now()
    }, null, 2);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sortMessages(): void {
    this.messages.sort((a, b) => {
      // Sort by priority (descending) then timestamp (ascending)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  private getNextMessage(): QueuedMessage | null {
    return this.messages.length > 0 ? this.messages[0] : null;
  }

  private removeLowPriorityMessage(): void {
    // Find and remove the lowest priority, oldest message
    let lowestIndex = 0;
    let lowestPriority = this.messages[0]?.priority ?? Priority.CRITICAL;
    let oldestTimestamp = this.messages[0]?.timestamp ?? Date.now();
    
    for (let i = 1; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message.priority < lowestPriority || 
          (message.priority === lowestPriority && message.timestamp < oldestTimestamp)) {
        lowestIndex = i;
        lowestPriority = message.priority;
        oldestTimestamp = message.timestamp;
      }
    }
    
    this.messages.splice(lowestIndex, 1);
  }

  private removeLowerPriorityMessage(thanPriority: Priority): boolean {
    // Find and remove a message with lower priority
    for (let i = 0; i < this.messages.length; i++) {
      if (this.messages[i].priority < thanPriority) {
        const removed = this.messages.splice(i, 1)[0];
        this.backpressureManager.dropMessage(
          removed.id, 
          `Removed to make room for higher priority message`
        );
        return true;
      }
    }
    return false;
  }

  private scheduleProcessing(delay: number = 0): void {
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }
    
    this.processTimer = setTimeout(() => {
      this.processQueue();
    }, delay);
  }

  private startThroughputMonitoring(): void {
    this.throughputTimer = setInterval(() => {
      // Clean up stale messages in backpressure manager
      this.backpressureManager.cleanupStaleMessages();
    }, 5000);
  }

  private calculateThroughput(): number {
    if (this.lastProcessTime === 0) return 0;
    
    const timeDiff = (Date.now() - this.lastProcessTime) / 1000; // seconds
    if (timeDiff === 0) return 0;
    
    return this.processedCount / timeDiff;
  }

  private async loadPersistedMessages(): Promise<void> {
    if (!this.config.queue.persistOffline) return;
    
    try {
      this.messages = await this.storage.load();
      this.notifyQueueUpdate();
    } catch (error) {
      console.warn('Failed to load persisted messages:', error);
      this.eventCallbacks.onError?.(error as Error);
    }
  }

  private async persistMessages(): Promise<void> {
    try {
      await this.storage.save(this.messages);
    } catch (error) {
      console.warn('Failed to persist messages:', error);
      this.eventCallbacks.onError?.(error as Error);
    }
  }

  private notifyQueueUpdate(): void {
    this.eventCallbacks.onQueueUpdate?.(this.messages.length, this.processing);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.stopProcessing();
    
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }
    
    if (this.throughputTimer) {
      clearInterval(this.throughputTimer);
    }
    
    if (this.config.queue.persistOffline) {
      await this.persistMessages();
    }
    
    this.backpressureManager.destroy();
    this.messages = [];
    this.eventCallbacks = {};
  }
}