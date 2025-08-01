/**
 * Performance Tests for Alert Queue System
 * Tests performance requirements and edge cases under load
 * @jest-environment jsdom
 */

import { AlertPriorityQueue } from './PriorityQueue';
import { AlertQueueManager } from './AlertQueueManager';
import { AlertPriority } from '../../theme/alertPriorities';

// Extend timeout for performance tests
jest.setTimeout(30000);

describe('Alert Queue Performance Tests', () => {
  describe('PriorityQueue Performance', () => {
    test('should maintain O(log n) performance for enqueue operations', () => {
      const queue = new AlertPriorityQueue();
      const testSizes = [100, 500, 1000, 2000, 5000];
      const enqueueTimes: number[] = [];

      testSizes.forEach(size => {
        const tempQueue = new AlertPriorityQueue();
        
        const startTime = performance.now();
        for (let i = 0; i < size; i++) {
          tempQueue.enqueue({
            id: `perf-${i}`,
            priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
            timestamp: new Date(),
            data: { message: `Performance test ${i}` }
          });
        }
        const endTime = performance.now();
        
        enqueueTimes.push(endTime - startTime);
        expect(tempQueue.size()).toBe(size);
        expect(tempQueue.isValidHeap()).toBe(true);
      });

      // Check that time growth is logarithmic, not linear
      // If operations were O(n), doubling size would roughly double time
      // For O(log n), the growth should be much slower
      
      // Compare ratios of times vs ratios of sizes
      for (let i = 1; i < enqueueTimes.length; i++) {
        const timeRatio = enqueueTimes[i] / enqueueTimes[i - 1];
        const sizeRatio = testSizes[i] / testSizes[i - 1];
        
        // Time ratio should be much less than size ratio for O(log n)
        expect(timeRatio).toBeLessThan(sizeRatio * 0.8);
      }

      // Total time for largest test should be reasonable
      expect(enqueueTimes[enqueueTimes.length - 1]).toBeLessThan(500); // Less than 500ms for 5000 items
    });

    test('should maintain O(log n) performance for dequeue operations', () => {
      const testSizes = [1000, 2000, 4000];
      const dequeueTimes: number[] = [];

      testSizes.forEach(size => {
        const queue = new AlertPriorityQueue();
        
        // Fill queue
        for (let i = 0; i < size; i++) {
          queue.enqueue({
            id: `dequeue-test-${i}`,
            priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
            timestamp: new Date(),
            data: { message: `Test ${i}` }
          });
        }

        // Time dequeue operations
        const startTime = performance.now();
        for (let i = 0; i < size; i++) {
          const alert = queue.dequeue();
          expect(alert).toBeDefined();
        }
        const endTime = performance.now();
        
        dequeueTimes.push(endTime - startTime);
        expect(queue.isEmpty()).toBe(true);
      });

      // Check logarithmic growth
      for (let i = 1; i < dequeueTimes.length; i++) {
        const timeRatio = dequeueTimes[i] / dequeueTimes[i - 1];
        const sizeRatio = testSizes[i] / testSizes[i - 1];
        
        expect(timeRatio).toBeLessThan(sizeRatio * 0.8);
      }

      expect(dequeueTimes[dequeueTimes.length - 1]).toBeLessThan(200); // Less than 200ms for 4000 items
    });

    test('should handle mixed operations efficiently under load', () => {
      const queue = new AlertPriorityQueue();
      const operationCount = 10000;
      
      const startTime = performance.now();
      
      for (let i = 0; i < operationCount; i++) {
        const operation = i % 4;
        
        switch (operation) {
          case 0: // Enqueue
            queue.enqueue({
              id: `mixed-${i}`,
              priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
              timestamp: new Date(),
              data: { message: `Mixed operation ${i}` }
            });
            break;
            
          case 1: // Dequeue (if not empty)
            if (!queue.isEmpty()) {
              queue.dequeue();
            }
            break;
            
          case 2: // Peek
            queue.peek();
            break;
            
          case 3: // Check size
            queue.size();
            break;
        }
        
        // Verify heap property occasionally
        if (i % 1000 === 0) {
          expect(queue.isValidHeap()).toBe(true);
        }
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(queue.isValidHeap()).toBe(true);
    });

    test('should handle expiration efficiently with large datasets', () => {
      const queue = new AlertPriorityQueue();
      const alertCount = 5000;
      const now = new Date();
      
      // Add alerts with various expiration times
      for (let i = 0; i < alertCount; i++) {
        const expirationTime = i % 3 === 0 
          ? new Date(now.getTime() - 1000) // Expired
          : new Date(now.getTime() + 10000); // Not expired
          
        queue.enqueue({
          id: `expiration-${i}`,
          priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
          timestamp: new Date(),
          expiresAt: expirationTime,
          data: { message: `Expiration test ${i}` }
        });
      }

      expect(queue.size()).toBe(alertCount);

      const startTime = performance.now();
      const expired = queue.removeExpired();
      const endTime = performance.now();
      
      // Should complete expiration check quickly
      expect(endTime - startTime).toBeLessThan(100);
      
      // Should have removed roughly 1/3 of alerts
      expect(expired.length).toBeCloseTo(alertCount / 3, -100); // Within 100 of expected
      expect(queue.size()).toBe(alertCount - expired.length);
      expect(queue.isValidHeap()).toBe(true);
    });

    test('should maintain performance with frequent priority filtering', () => {
      const queue = new AlertPriorityQueue();
      const alertCount = 2000;
      
      // Fill queue with diverse priorities
      for (let i = 0; i < alertCount; i++) {
        queue.enqueue({
          id: `filter-${i}`,
          priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
          timestamp: new Date(),
          data: { message: `Filter test ${i}` }
        });
      }

      const priorities: AlertPriority[] = ['critical', 'high', 'medium', 'low', 'info'];
      
      const startTime = performance.now();
      
      // Perform many filter operations
      for (let iteration = 0; iteration < 100; iteration++) {
        priorities.forEach(priority => {
          const filtered = queue.getByPriority(priority);
          expect(filtered.length).toBeGreaterThan(0);
          expect(filtered.every(alert => alert.priority === priority)).toBe(true);
        });
        
        const counts = queue.getCountByPriority();
        priorities.forEach(priority => {
          expect(counts[priority]).toBeGreaterThan(0);
        });
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(500); // Should complete in under 500ms
    });
  });

  describe('AlertQueueManager Performance', () => {
    let manager: AlertQueueManager;
    let processedAlerts: any[] = [];

    beforeEach(() => {
      manager = new AlertQueueManager();
      processedAlerts = [];
      
      // Add a simple processor to track processed alerts
      manager.addProcessor(async (alert) => {
        processedAlerts.push(alert);
      });
    });

    afterEach(() => {
      manager.clear();
    });

    test('should handle high-volume alert additions efficiently', async () => {
      const alertCount = 1000;
      const startTime = performance.now();
      
      // Add many alerts rapidly
      const promises = Array.from({ length: alertCount }, (_, i) =>
        manager.addAlert({
          priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
          data: { message: `Volume test ${i}` }
        })
      );

      const ids = await Promise.all(promises);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should complete in under 2 seconds
      expect(ids.length).toBe(alertCount);
      expect(new Set(ids).size).toBe(alertCount); // All IDs should be unique
      
      const status = manager.getStatus();
      expect(status.total).toBe(alertCount);
    });

    test('should process alerts efficiently with realistic timing', async () => {
      const alertCounts = {
        critical: 50,  // Immediate processing
        high: 100,     // 5-second delay
        medium: 200,   // 30-second delay
        low: 150,      // 5-minute delay
        info: 100      // 5-minute delay
      };

      const startTime = performance.now();
      
      // Add alerts of all priorities
      const promises: Promise<string>[] = [];
      Object.entries(alertCounts).forEach(([priority, count]) => {
        for (let i = 0; i < count; i++) {
          promises.push(manager.addAlert({
            priority: priority as AlertPriority,
            data: { message: `${priority} alert ${i}` }
          }));
        }
      });

      await Promise.all(promises);
      const addTime = performance.now() - startTime;
      
      expect(addTime).toBeLessThan(3000); // Addition should be fast
      
      // Check that critical alerts were processed immediately
      const criticalProcessed = processedAlerts.filter(a => a.priority === 'critical');
      expect(criticalProcessed.length).toBe(alertCounts.critical);
      
      const status = manager.getStatus();
      expect(status.total).toBe(Object.values(alertCounts).reduce((a, b) => a + b, 0));
    });

    test('should handle overflow scenarios efficiently', async () => {
      const config = {
        maxTotalAlerts: 100,
        overflowStrategy: 'drop-oldest' as const
      };
      
      const overflowManager = new AlertQueueManager(config);
      
      const startTime = performance.now();
      
      // Add more alerts than the limit
      for (let i = 0; i < 200; i++) {
        await overflowManager.addAlert({
          priority: 'medium',
          data: { message: `Overflow test ${i}` }
        });
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should handle overflow efficiently
      
      const status = overflowManager.getStatus();
      expect(status.total).toBeLessThanOrEqual(config.maxTotalAlerts);
    });

    test('should handle rapid alert removals efficiently', async () => {
      const alertCount = 500;
      const ids: string[] = [];
      
      // Add alerts
      for (let i = 0; i < alertCount; i++) {
        const id = await manager.addAlert({
          priority: 'medium',
          data: { message: `Removal test ${i}` }
        });
        ids.push(id);
      }

      expect(manager.getStatus().total).toBe(alertCount);

      const startTime = performance.now();
      
      // Remove all alerts
      ids.forEach(id => {
        manager.removeAlert(id);
      });
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(200); // Should complete quickly
      expect(manager.getStatus().total).toBe(0);
    });

    test('should maintain performance with complex grouping scenarios', async () => {
      const groupCount = 50;
      const alertsPerGroup = 20;
      
      const startTime = performance.now();
      
      // Create many groups with multiple alerts each
      for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
        const groupId = `performance-group-${groupIndex}`;
        
        for (let alertIndex = 0; alertIndex < alertsPerGroup; alertIndex++) {
          await manager.addAlert({
            priority: 'medium',
            data: { 
              message: `Group ${groupIndex} Alert ${alertIndex}`,
              type: 'grouped-test'
            },
            groupId
          });
        }
      }
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // Should handle grouping efficiently
      
      const status = manager.getStatus();
      expect(status.grouped).toBe(groupCount);
      expect(status.total).toBe(groupCount); // Only group representatives in main queue
    });

    test('should handle concurrent operations under load', async () => {
      const operationCount = 1000;
      const concurrentPromises: Promise<any>[] = [];
      
      const startTime = performance.now();
      
      // Perform many concurrent operations
      for (let i = 0; i < operationCount; i++) {
        const operation = i % 5;
        
        switch (operation) {
          case 0: // Add alert
            concurrentPromises.push(
              manager.addAlert({
                priority: (['critical', 'high', 'medium'] as AlertPriority[])[i % 3],
                data: { message: `Concurrent ${i}` }
              })
            );
            break;
            
          case 1: // Get status
            concurrentPromises.push(
              Promise.resolve(manager.getStatus())
            );
            break;
            
          case 2: // Get all alerts
            concurrentPromises.push(
              Promise.resolve(manager.getAllAlerts())
            );
            break;
            
          case 3: // Remove alert (if we have IDs)
            if (i > 10 && Math.random() > 0.8) {
              // Occasionally remove alerts
              concurrentPromises.push(
                Promise.resolve(manager.removeAlert(`alert-${i - 10}`))
              );
            }
            break;
            
          case 4: // Add grouped alert
            concurrentPromises.push(
              manager.addAlert({
                priority: 'medium',
                data: { message: `Grouped ${i}` },
                groupId: `group-${Math.floor(i / 10)}`
              })
            );
            break;
        }
      }
      
      await Promise.all(concurrentPromises);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should handle concurrency efficiently
      
      const finalStatus = manager.getStatus();
      expect(finalStatus.total).toBeGreaterThan(0);
    });
  });

  describe('Memory Usage Performance', () => {
    test('should handle large queues without excessive memory usage', () => {
      const queue = new AlertPriorityQueue();
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Add a large number of alerts
      for (let i = 0; i < 10000; i++) {
        queue.enqueue({
          id: `memory-${i}`,
          priority: (['critical', 'high', 'medium', 'low', 'info'] as AlertPriority[])[i % 5],
          timestamp: new Date(),
          data: { 
            message: `Memory test ${i}`,
            // Add some additional data to make alerts larger
            metadata: {
              source: 'performance-test',
              index: i,
              timestamp: Date.now()
            }
          }
        });
      }

      const afterAddMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Remove half the alerts
      for (let i = 0; i < 5000; i++) {
        queue.dequeue();
      }

      const afterRemoveMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Memory should be reasonable
      if (performance.memory) {
        const addedMemoryMB = (afterAddMemory - initialMemory) / 1024 / 1024;
        const finalMemoryMB = (afterRemoveMemory - initialMemory) / 1024 / 1024;
        
        expect(addedMemoryMB).toBeLessThan(50); // Less than 50MB for 10k alerts
        expect(finalMemoryMB).toBeLessThan(addedMemoryMB); // Memory should decrease after removal
      }

      expect(queue.size()).toBe(5000);
      expect(queue.isValidHeap()).toBe(true);
    });

    test('should clean up properly on clear', () => {
      const manager = new AlertQueueManager();
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Add many alerts
      const promises = Array.from({ length: 1000 }, (_, i) =>
        manager.addAlert({
          priority: 'medium',
          data: { 
            message: `Cleanup test ${i}`,
            largeData: Array(100).fill(`data-${i}`).join(' ')
          }
        })
      );

      Promise.all(promises).then(() => {
        const afterAddMemory = performance.memory?.usedJSHeapSize || 0;
        
        // Clear everything
        manager.clear();
        
        const afterClearMemory = performance.memory?.usedJSHeapSize || 0;
        
        if (performance.memory) {
          expect(afterClearMemory).toBeLessThanOrEqual(afterAddMemory);
        }
        
        expect(manager.getStatus().total).toBe(0);
      });
    });
  });

  describe('Real-world Performance Scenarios', () => {
    test('should handle typical rover mission control alert load', async () => {
      const manager = new AlertQueueManager();
      let processedCount = 0;
      
      manager.addProcessor(async () => {
        processedCount++;
      });

      // Simulate typical mission control scenario:
      // - Frequent telemetry alerts (info/low)
      // - Occasional system warnings (medium)
      // - Rare but critical system alerts (high/critical)
      
      const scenario = {
        duration: 60000, // 1 minute simulation
        intervals: {
          telemetry: 100,   // Every 100ms
          system: 5000,     // Every 5 seconds
          critical: 30000   // Every 30 seconds
        }
      };

      const startTime = performance.now();
      let telemetryCount = 0;
      let systemCount = 0;
      let criticalCount = 0;

      // Simulate alerts for 1 minute
      while (performance.now() - startTime < scenario.duration) {
        const elapsed = performance.now() - startTime;
        
        // Telemetry alerts
        if (elapsed % scenario.intervals.telemetry < 50) {
          await manager.addAlert({
            priority: Math.random() > 0.3 ? 'info' : 'low',
            data: { 
              message: `Telemetry update ${telemetryCount++}`,
              source: 'telemetry',
              value: Math.random() * 100
            }
          });
        }
        
        // System alerts
        if (elapsed % scenario.intervals.system < 50) {
          await manager.addAlert({
            priority: 'medium',
            data: { 
              message: `System status ${systemCount++}`,
              source: 'system-monitor'
            }
          });
        }
        
        // Critical alerts
        if (elapsed % scenario.intervals.critical < 50) {
          await manager.addAlert({
            priority: Math.random() > 0.5 ? 'high' : 'critical',
            data: { 
              message: `Critical event ${criticalCount++}`,
              source: 'safety-system'
            }
          });
        }
        
        // Small delay to prevent tight loop
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(scenario.duration * 1.1); // Should not exceed expected time by much
      
      const status = manager.getStatus();
      expect(status.total).toBeGreaterThan(0);
      expect(processedCount).toBeGreaterThan(criticalCount); // Critical alerts should be processed
      
      // System should remain responsive
      const operationStart = performance.now();
      const alerts = manager.getAllAlerts();
      const operationEnd = performance.now();
      
      expect(operationEnd - operationStart).toBeLessThan(50); // Operations should remain fast
      expect(alerts.length).toBeGreaterThan(0);
    });

    test('should handle alert storms efficiently', async () => {
      const manager = new AlertQueueManager({
        maxTotalAlerts: 500,
        overflowStrategy: 'compress'
      });

      // Simulate alert storm (system malfunction causing many similar alerts)
      const stormDuration = 5000; // 5 seconds
      const alertsPerSecond = 100;
      const totalAlerts = (stormDuration / 1000) * alertsPerSecond;
      
      const startTime = performance.now();
      
      // Generate alert storm
      const promises: Promise<string>[] = [];
      for (let i = 0; i < totalAlerts; i++) {
        promises.push(manager.addAlert({
          priority: 'high',
          data: { 
            type: 'connection-error',
            message: `Connection failed ${i}`,
            timestamp: Date.now() + i
          },
          groupId: 'connection-storm'
        }));
      }

      await Promise.all(promises);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(stormDuration / 2); // Should handle storm quickly
      
      const status = manager.getStatus();
      expect(status.total).toBeLessThanOrEqual(500); // Should respect limits
      expect(status.grouped).toBeGreaterThan(0); // Should have compressed similar alerts
      
      // System should remain responsive during storm
      const queryStart = performance.now();
      const alerts = manager.getAllAlerts();
      const queryEnd = performance.now();
      
      expect(queryEnd - queryStart).toBeLessThan(10); // Queries should remain fast
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});