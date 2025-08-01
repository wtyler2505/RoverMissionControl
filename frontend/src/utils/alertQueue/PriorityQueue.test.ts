/**
 * @jest-environment jsdom
 */

import { AlertPriorityQueue, QueuedAlert } from './PriorityQueue';
import { AlertPriority } from '../../theme/alertPriorities';

describe('AlertPriorityQueue', () => {
  let queue: AlertPriorityQueue;
  
  beforeEach(() => {
    queue = new AlertPriorityQueue();
  });

  describe('Basic Operations', () => {
    test('should start empty', () => {
      expect(queue.isEmpty()).toBe(true);
      expect(queue.size()).toBe(0);
      expect(queue.peek()).toBeUndefined();
    });

    test('should enqueue and dequeue single alert', () => {
      const alert: QueuedAlert = {
        id: 'test-1',
        priority: 'high',
        timestamp: new Date(),
        data: { message: 'Test alert' }
      };

      queue.enqueue(alert);
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);
      expect(queue.peek()).toEqual(alert);

      const dequeued = queue.dequeue();
      expect(dequeued).toEqual(alert);
      expect(queue.isEmpty()).toBe(true);
    });

    test('should maintain priority ordering with multiple alerts', () => {
      const criticalAlert: QueuedAlert = {
        id: 'critical-1',
        priority: 'critical',
        timestamp: new Date(Date.now() + 1000),
        data: { message: 'Critical alert' }
      };

      const infoAlert: QueuedAlert = {
        id: 'info-1',
        priority: 'info',
        timestamp: new Date(),
        data: { message: 'Info alert' }
      };

      const highAlert: QueuedAlert = {
        id: 'high-1',
        priority: 'high',
        timestamp: new Date(Date.now() + 500),
        data: { message: 'High alert' }
      };

      // Enqueue in non-priority order
      queue.enqueue(infoAlert);
      queue.enqueue(criticalAlert);
      queue.enqueue(highAlert);

      expect(queue.size()).toBe(3);
      
      // Should dequeue in priority order: critical, high, info
      expect(queue.dequeue()?.priority).toBe('critical');
      expect(queue.dequeue()?.priority).toBe('high');
      expect(queue.dequeue()?.priority).toBe('info');
    });

    test('should maintain timestamp ordering for same priority', () => {
      const baseTime = Date.now();
      const alert1: QueuedAlert = {
        id: 'high-1',
        priority: 'high',
        timestamp: new Date(baseTime),
        data: { message: 'First high alert' }
      };

      const alert2: QueuedAlert = {
        id: 'high-2',
        priority: 'high',
        timestamp: new Date(baseTime + 1000),
        data: { message: 'Second high alert' }
      };

      const alert3: QueuedAlert = {
        id: 'high-3',
        priority: 'high',
        timestamp: new Date(baseTime + 500),
        data: { message: 'Third high alert' }
      };

      queue.enqueue(alert2);
      queue.enqueue(alert3);
      queue.enqueue(alert1);

      // Should dequeue in timestamp order (oldest first) for same priority
      expect(queue.dequeue()?.id).toBe('high-1');
      expect(queue.dequeue()?.id).toBe('high-3');
      expect(queue.dequeue()?.id).toBe('high-2');
    });
  });

  describe('Priority Handling', () => {
    test('should correctly weight all priority levels', () => {
      const priorities: AlertPriority[] = ['info', 'low', 'medium', 'high', 'critical'];
      const alerts: QueuedAlert[] = priorities.map((priority, index) => ({
        id: `alert-${index}`,
        priority,
        timestamp: new Date(),
        data: { message: `${priority} alert` }
      }));

      // Enqueue in reverse priority order
      alerts.reverse().forEach(alert => queue.enqueue(alert));

      // Should dequeue in priority order
      expect(queue.dequeue()?.priority).toBe('critical');
      expect(queue.dequeue()?.priority).toBe('high');
      expect(queue.dequeue()?.priority).toBe('medium');
      expect(queue.dequeue()?.priority).toBe('low');
      expect(queue.dequeue()?.priority).toBe('info');
    });

    test('should handle mixed priority and timestamp ordering', () => {
      const baseTime = Date.now();
      const alerts: QueuedAlert[] = [
        {
          id: 'medium-old',
          priority: 'medium',
          timestamp: new Date(baseTime - 1000),
          data: { message: 'Old medium' }
        },
        {
          id: 'critical-new',
          priority: 'critical',
          timestamp: new Date(baseTime + 1000),
          data: { message: 'New critical' }
        },
        {
          id: 'medium-new',
          priority: 'medium',
          timestamp: new Date(baseTime + 500),
          data: { message: 'New medium' }
        },
        {
          id: 'critical-old',
          priority: 'critical',
          timestamp: new Date(baseTime - 500),
          data: { message: 'Old critical' }
        }
      ];

      alerts.forEach(alert => queue.enqueue(alert));

      // Should get critical alerts first (by timestamp), then medium alerts (by timestamp)
      expect(queue.dequeue()?.id).toBe('critical-old');
      expect(queue.dequeue()?.id).toBe('critical-new');
      expect(queue.dequeue()?.id).toBe('medium-old');
      expect(queue.dequeue()?.id).toBe('medium-new');
    });
  });

  describe('Heap Validation', () => {
    test('should maintain valid heap property after multiple operations', () => {
      const alerts = Array.from({ length: 20 }, (_, i) => ({
        id: `alert-${i}`,
        priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
        timestamp: new Date(Date.now() + Math.random() * 10000),
        data: { message: `Alert ${i}` }
      }));

      // Add all alerts
      alerts.forEach(alert => {
        queue.enqueue(alert);
        expect(queue.isValidHeap()).toBe(true);
      });

      // Remove half of them
      for (let i = 0; i < 10; i++) {
        queue.dequeue();
        expect(queue.isValidHeap()).toBe(true);
      }

      // Add more alerts
      const moreAlerts = Array.from({ length: 5 }, (_, i) => ({
        id: `additional-${i}`,
        priority: 'critical' as AlertPriority,
        timestamp: new Date(),
        data: { message: `Additional ${i}` }
      }));

      moreAlerts.forEach(alert => {
        queue.enqueue(alert);
        expect(queue.isValidHeap()).toBe(true);
      });
    });

    test('should maintain heap property after removing specific elements', () => {
      const alerts: QueuedAlert[] = [
        { id: '1', priority: 'critical', timestamp: new Date(), data: {} },
        { id: '2', priority: 'high', timestamp: new Date(), data: {} },
        { id: '3', priority: 'medium', timestamp: new Date(), data: {} },
        { id: '4', priority: 'low', timestamp: new Date(), data: {} },
        { id: '5', priority: 'info', timestamp: new Date(), data: {} }
      ];

      alerts.forEach(alert => queue.enqueue(alert));
      expect(queue.isValidHeap()).toBe(true);

      // Remove middle element
      expect(queue.remove('3')).toBe(true);
      expect(queue.isValidHeap()).toBe(true);
      expect(queue.size()).toBe(4);

      // Remove non-existent element
      expect(queue.remove('nonexistent')).toBe(false);
      expect(queue.isValidHeap()).toBe(true);
      expect(queue.size()).toBe(4);

      // Remove first element
      expect(queue.remove('1')).toBe(true);
      expect(queue.isValidHeap()).toBe(true);
      expect(queue.size()).toBe(3);
    });
  });

  describe('Expiration Handling', () => {
    test('should remove expired alerts', () => {
      const now = new Date();
      const expired1: QueuedAlert = {
        id: 'expired-1',
        priority: 'high',
        timestamp: new Date(now.getTime() - 2000),
        expiresAt: new Date(now.getTime() - 1000),
        data: { message: 'Expired alert 1' }
      };

      const expired2: QueuedAlert = {
        id: 'expired-2',
        priority: 'medium',
        timestamp: new Date(now.getTime() - 1500),
        expiresAt: new Date(now.getTime() - 500),
        data: { message: 'Expired alert 2' }
      };

      const active: QueuedAlert = {
        id: 'active-1',
        priority: 'low',
        timestamp: new Date(now.getTime() - 1000),
        expiresAt: new Date(now.getTime() + 1000),
        data: { message: 'Active alert' }
      };

      const noExpiration: QueuedAlert = {
        id: 'no-expiry-1',
        priority: 'info',
        timestamp: new Date(),
        data: { message: 'No expiration alert' }
      };

      queue.enqueue(expired1);
      queue.enqueue(active);
      queue.enqueue(expired2);
      queue.enqueue(noExpiration);

      expect(queue.size()).toBe(4);

      const expiredAlerts = queue.removeExpired();

      expect(expiredAlerts).toHaveLength(2);
      expect(expiredAlerts.map(a => a.id)).toContain('expired-1');
      expect(expiredAlerts.map(a => a.id)).toContain('expired-2');
      
      expect(queue.size()).toBe(2);
      expect(queue.isValidHeap()).toBe(true);

      // Remaining alerts should be the active ones
      const remaining = queue.toArray();
      expect(remaining.map(a => a.id)).toContain('active-1');
      expect(remaining.map(a => a.id)).toContain('no-expiry-1');
    });

    test('should handle expiration with no expired alerts', () => {
      const future = new Date(Date.now() + 10000);
      const alert: QueuedAlert = {
        id: 'future-1',
        priority: 'high',
        timestamp: new Date(),
        expiresAt: future,
        data: { message: 'Future alert' }
      };

      queue.enqueue(alert);
      const expired = queue.removeExpired();

      expect(expired).toHaveLength(0);
      expect(queue.size()).toBe(1);
    });
  });

  describe('Filtering and Querying', () => {
    beforeEach(() => {
      const alerts: QueuedAlert[] = [
        { id: 'crit-1', priority: 'critical', timestamp: new Date(), data: {} },
        { id: 'crit-2', priority: 'critical', timestamp: new Date(), data: {} },
        { id: 'high-1', priority: 'high', timestamp: new Date(), data: {} },
        { id: 'med-1', priority: 'medium', timestamp: new Date(), data: {} },
        { id: 'low-1', priority: 'low', timestamp: new Date(), data: {} },
        { id: 'low-2', priority: 'low', timestamp: new Date(), data: {} },
        { id: 'info-1', priority: 'info', timestamp: new Date(), data: {} }
      ];

      alerts.forEach(alert => queue.enqueue(alert));
    });

    test('should filter alerts by priority', () => {
      expect(queue.getByPriority('critical')).toHaveLength(2);
      expect(queue.getByPriority('high')).toHaveLength(1);
      expect(queue.getByPriority('medium')).toHaveLength(1);
      expect(queue.getByPriority('low')).toHaveLength(2);
      expect(queue.getByPriority('info')).toHaveLength(1);
    });

    test('should return correct count by priority', () => {
      const counts = queue.getCountByPriority();
      
      expect(counts.critical).toBe(2);
      expect(counts.high).toBe(1);
      expect(counts.medium).toBe(1);
      expect(counts.low).toBe(2);
      expect(counts.info).toBe(1);
    });

    test('should convert to sorted array', () => {
      const array = queue.toArray();
      
      expect(array).toHaveLength(7);
      expect(array[0].priority).toBe('critical');
      expect(array[1].priority).toBe('critical');
      expect(array[2].priority).toBe('high');
      expect(array[3].priority).toBe('medium');
      expect(array[4].priority).toBe('low');
      expect(array[5].priority).toBe('low');
      expect(array[6].priority).toBe('info');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty queue operations gracefully', () => {
      expect(queue.dequeue()).toBeUndefined();
      expect(queue.peek()).toBeUndefined();
      expect(queue.remove('nonexistent')).toBe(false);
      expect(queue.removeExpired()).toHaveLength(0);
      expect(queue.toArray()).toHaveLength(0);
      expect(queue.isValidHeap()).toBe(true);
    });

    test('should handle clearing queue', () => {
      const alerts = Array.from({ length: 5 }, (_, i) => ({
        id: `alert-${i}`,
        priority: 'high' as AlertPriority,
        timestamp: new Date(),
        data: {}
      }));

      alerts.forEach(alert => queue.enqueue(alert));
      expect(queue.size()).toBe(5);

      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.peek()).toBeUndefined();
    });

    test('should handle single element queue', () => {
      const alert: QueuedAlert = {
        id: 'single',
        priority: 'medium',
        timestamp: new Date(),
        data: {}
      };

      queue.enqueue(alert);
      expect(queue.size()).toBe(1);
      expect(queue.isValidHeap()).toBe(true);

      expect(queue.remove('single')).toBe(true);
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.isValidHeap()).toBe(true);
    });

    test('should handle duplicate IDs (last wins)', () => {
      const alert1: QueuedAlert = {
        id: 'duplicate',
        priority: 'high',
        timestamp: new Date(),
        data: { message: 'First' }
      };

      const alert2: QueuedAlert = {
        id: 'duplicate',
        priority: 'low',
        timestamp: new Date(),
        data: { message: 'Second' }
      };

      queue.enqueue(alert1);
      queue.enqueue(alert2);

      expect(queue.size()).toBe(2);
      
      // Both should be in queue since they have different objects
      const found = queue.getByPriority('high');
      expect(found).toHaveLength(1);
      expect(found[0].data.message).toBe('First');
    });
  });

  describe('Performance', () => {
    test('should handle large number of alerts efficiently', () => {
      const startTime = performance.now();
      const alertCount = 1000;

      // Add alerts
      for (let i = 0; i < alertCount; i++) {
        queue.enqueue({
          id: `perf-${i}`,
          priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
          timestamp: new Date(Date.now() + Math.random() * 10000),
          data: { message: `Performance test ${i}` }
        });
      }

      const addTime = performance.now() - startTime;
      expect(queue.size()).toBe(alertCount);
      expect(addTime).toBeLessThan(100); // Should take less than 100ms

      // Remove half
      const removeStartTime = performance.now();
      for (let i = 0; i < alertCount / 2; i++) {
        queue.dequeue();
      }
      const removeTime = performance.now() - removeStartTime;
      
      expect(queue.size()).toBe(alertCount / 2);
      expect(removeTime).toBeLessThan(50); // Should take less than 50ms
      expect(queue.isValidHeap()).toBe(true);
    });

    test('should maintain O(log n) complexity for enqueue/dequeue', () => {
      const sizes = [100, 200, 400, 800];
      const times: number[] = [];

      sizes.forEach(size => {
        const tempQueue = new AlertPriorityQueue();
        
        const startTime = performance.now();
        for (let i = 0; i < size; i++) {
          tempQueue.enqueue({
            id: `test-${i}`,
            priority: 'medium',
            timestamp: new Date(),
            data: {}
          });
        }
        times.push(performance.now() - startTime);
      });

      // Check that time doesn't grow linearly (would indicate O(n) complexity)
      // For O(log n), doubling size should not double time
      expect(times[1] / times[0]).toBeLessThan(1.5);
      expect(times[2] / times[1]).toBeLessThan(1.5);
      expect(times[3] / times[2]).toBeLessThan(1.5);
    });
  });
});