/**
 * Priority Queue implementation for Alert System
 * Uses a min-heap for efficient priority-based operations
 */

import { AlertPriority } from '../../theme/alertPriorities';

export interface QueuedAlert {
  id: string;
  priority: AlertPriority;
  timestamp: Date;
  expiresAt?: Date;
  groupId?: string;
  data: any;
}

export class AlertPriorityQueue {
  private heap: QueuedAlert[] = [];
  private priorityWeights: Record<AlertPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  /**
   * Add an alert to the queue
   * Time complexity: O(log n)
   */
  enqueue(alert: QueuedAlert): void {
    this.heap.push(alert);
    this.bubbleUp(this.heap.length - 1);
  }

  /**
   * Remove and return the highest priority alert
   * Time complexity: O(log n)
   */
  dequeue(): QueuedAlert | undefined {
    if (this.isEmpty()) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0 && last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return top;
  }

  /**
   * Peek at the highest priority alert without removing it
   * Time complexity: O(1)
   */
  peek(): QueuedAlert | undefined {
    return this.heap[0];
  }

  /**
   * Get all alerts of a specific priority
   * Time complexity: O(n)
   */
  getByPriority(priority: AlertPriority): QueuedAlert[] {
    return this.heap.filter(alert => alert.priority === priority);
  }

  /**
   * Remove a specific alert by ID
   * Time complexity: O(n)
   */
  remove(id: string): boolean {
    const index = this.heap.findIndex(alert => alert.id === id);
    if (index === -1) return false;

    const last = this.heap.pop();
    if (index < this.heap.length && last) {
      this.heap[index] = last;
      this.bubbleDown(index);
      this.bubbleUp(index);
    }

    return true;
  }

  /**
   * Remove expired alerts
   * Time complexity: O(n)
   */
  removeExpired(): QueuedAlert[] {
    const now = new Date();
    const expired: QueuedAlert[] = [];
    
    this.heap = this.heap.filter(alert => {
      if (alert.expiresAt && alert.expiresAt <= now) {
        expired.push(alert);
        return false;
      }
      return true;
    });

    // Rebuild heap structure
    this.heapify();
    
    return expired;
  }

  /**
   * Get queue size
   * Time complexity: O(1)
   */
  size(): number {
    return this.heap.length;
  }

  /**
   * Check if queue is empty
   * Time complexity: O(1)
   */
  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Get all alerts in priority order
   * Time complexity: O(n log n)
   */
  toArray(): QueuedAlert[] {
    // Create a copy and sort by priority
    const copy = [...this.heap];
    copy.sort((a, b) => this.compare(a, b));
    return copy;
  }

  /**
   * Clear all alerts
   * Time complexity: O(1)
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Get count by priority
   * Time complexity: O(n)
   */
  getCountByPriority(): Record<AlertPriority, number> {
    const counts: Record<AlertPriority, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    this.heap.forEach(alert => {
      counts[alert.priority]++;
    });

    return counts;
  }

  /**
   * Private helper methods
   */
  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) >= 0) break;

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (
        leftChild < this.heap.length &&
        this.compare(this.heap[leftChild], this.heap[minIndex]) < 0
      ) {
        minIndex = leftChild;
      }

      if (
        rightChild < this.heap.length &&
        this.compare(this.heap[rightChild], this.heap[minIndex]) < 0
      ) {
        minIndex = rightChild;
      }

      if (minIndex === index) break;

      this.swap(index, minIndex);
      index = minIndex;
    }
  }

  private swap(i: number, j: number): void {
    [this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]];
  }

  private compare(a: QueuedAlert, b: QueuedAlert): number {
    // First compare by priority weight
    const priorityDiff = this.priorityWeights[a.priority] - this.priorityWeights[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // If same priority, compare by timestamp (older first)
    return a.timestamp.getTime() - b.timestamp.getTime();
  }

  private heapify(): void {
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this.bubbleDown(i);
    }
  }

  /**
   * Debug method to validate heap property
   */
  isValidHeap(): boolean {
    for (let i = 0; i < Math.floor(this.heap.length / 2); i++) {
      const leftChild = 2 * i + 1;
      const rightChild = 2 * i + 2;

      if (
        leftChild < this.heap.length &&
        this.compare(this.heap[i], this.heap[leftChild]) > 0
      ) {
        return false;
      }

      if (
        rightChild < this.heap.length &&
        this.compare(this.heap[i], this.heap[rightChild]) > 0
      ) {
        return false;
      }
    }
    return true;
  }
}